import { createHmac, timingSafeEqual } from "node:crypto";
import { SecretStoreUnavailableError } from "@corvo/adapter-kit";
import type { Hono } from "hono";
import { readBoundedBody } from "./http-body.js";
import type { WebhookDeps, WebhookSecretCache } from "./webhook-inbound.js";
import {
  deliverWebhookEvent,
  formatUntrustedDeliveryPayload,
  loadWebhookTarget,
  parseWebhookPayload,
  WEBHOOK_MAX_BODY_BYTES,
} from "./webhook-inbound.js";

const RECEIVED_EVENT = "inbox.email.received";

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function text(value: unknown, max: number): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
}

function mailIds(payload: Record<string, unknown>) {
  const data = record(payload.data);
  const inboxId = text(data?.inbox_id, 100);
  const threadId = text(data?.thread_id, 100);
  const emailId = text(data?.email_id, 100);
  return inboxId && threadId && emailId ? { data, inboxId, threadId, emailId } : undefined;
}

/**
 * What wakes the bot: which mail arrived, never its body. The bot reads the message through the
 * inbox service, which has already hidden invisible text and screened it. The sender and subject
 * are written by a stranger, so they stay inside the untrusted block.
 */
export function formatEmailEventPrompt(payload: Record<string, unknown>): string {
  const ids = mailIds(payload);
  const email = record(ids?.data?.email);
  return formatUntrustedDeliveryPayload("[Inbound Email]", {
    inboxId: ids?.inboxId,
    threadId: ids?.threadId,
    emailId: ids?.emailId,
    from: text(email?.from, 320),
    subject: text(email?.subject, 300),
  });
}

/**
 * The address's secret part. It is derived one way from the bot's webhook secret, so the
 * address can be handed to the inbox service without exposing the secret the generic webhook uses.
 */
export function emailWakeToken(webhookSecret: string): string {
  return createHmac("sha256", webhookSecret).update("email-agent").digest("base64url");
}

export function emailWakePath(botId: string, webhookSecret: string): string {
  return `/api/v1/bots/${botId}/email/${emailWakeToken(webhookSecret)}`;
}

function hasValidWakeToken(given: string, webhookSecret: string): boolean {
  const expected = Buffer.from(emailWakeToken(webhookSecret));
  const actual = Buffer.from(given);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Mount the inbox delivery route, addressed by the bot's email token, onto the shared webhook deps. */
export function mountEmailWebhookRoute(
  app: Hono,
  deps: WebhookDeps,
  secretCache: WebhookSecretCache,
) {
  app.post("/api/v1/bots/:botId/email/:token", async (c) => {
    const unauthorized = () => c.json({ error: "Unauthorized" }, 401);

    // Reject oversized bodies before target lookup so size limits do not reveal active bots.
    const raw = await readBoundedBody(c.req.raw, WEBHOOK_MAX_BODY_BYTES);
    if (raw === null) return c.json({ error: "Payload too large" }, 413);

    let target: Awaited<ReturnType<typeof loadWebhookTarget>>;
    try {
      target = await loadWebhookTarget(deps, secretCache, c.req.param("botId"));
    } catch (error) {
      if (error instanceof SecretStoreUnavailableError) {
        return c.json({ error: "Service unavailable" }, 503);
      }
      throw error;
    }
    if (!target) return unauthorized();
    if (!hasValidWakeToken(c.req.param("token"), target.expected)) return unauthorized();

    const payload = parseWebhookPayload(raw, c.req.header("content-type"));
    if (payload.type !== RECEIVED_EVENT || !mailIds(payload)) {
      return c.json({ ok: true, ignored: true });
    }

    return c.json(
      await deliverWebhookEvent(deps, target, {
        prompt: formatEmailEventPrompt(payload),
        routines: [],
        source: "email",
        // Both header names carry the same delivery id; retries reuse it.
        idempotencyKey: (c.req.header("webhook-id") ?? c.req.header("svix-id"))?.trim(),
      }),
    );
  });
}
