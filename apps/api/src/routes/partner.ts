import { PartnerTemplate } from "@corvo/contracts";
import {
  createOwnedPartner,
  findOwnedPartner,
  listOwnedPartnerTenants,
  partnerWalletSummary,
  rotateOwnedPartnerKey,
  runAsSystem,
  setOwnedPartnerTemplate,
  setPartnerLimits,
  setPartnerTenantState,
} from "@corvo/db";
import { ORPCError } from "@orpc/server";
import { assertMcpRemoteEndpoint } from "../mcp-servers.js";
import type { RouterContext } from "./context.js";

/** The people the deployment names (PARTNER_ADMIN_EMAILS) may run a partner programme. */
export function isPartnerAdmin(
  env: { partnerAdminEmails?: string[] } | undefined,
  email: string,
): boolean {
  const wanted = email.trim().toLowerCase();
  return (env?.partnerAdminEmails ?? []).some((admin) => admin.trim().toLowerCase() === wanted);
}

export function partnerRoutes(ctx: RouterContext) {
  const { deps, authed } = ctx;
  const admin = authed.use(async ({ context, next }) => {
    if (!isPartnerAdmin(deps.env, context.actor.email)) throw new ORPCError("NOT_FOUND");
    return next();
  });
  // Partner tables belong to the system, not to a space.
  const asSystem = <T>(fn: () => Promise<T>) => runAsSystem("partner administration", fn);
  const owned = async (userId: string) => {
    const partner = await findOwnedPartner(deps.prisma, userId);
    if (!partner) throw new ORPCError("NOT_FOUND");
    return partner;
  };
  return {
    partner: {
      status: admin.partner.status.handler(({ context }) =>
        asSystem(async () => {
          const partner = await findOwnedPartner(deps.prisma, context.actor.userId);
          if (!partner) return { partner: null };
          const tenants = await listOwnedPartnerTenants(deps.prisma, partner.id);
          const now = new Date();
          const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
          return {
            partner: {
              name: partner.name,
              keyPrefix: partner.keyPrefix,
              template: PartnerTemplate.safeParse(partner.template).data ?? null,
              wallet: await partnerWalletSummary(deps.prisma, partner.id, period),
              tenants: tenants.map((tenant) => ({
                ...tenant,
                state: tenant.state === "suspended" ? ("suspended" as const) : ("enabled" as const),
              })),
            },
          };
        }),
      ),
      create: admin.partner.create.handler(({ context, input }) =>
        asSystem(async () => {
          try {
            const { key } = await createOwnedPartner(deps.prisma, context.actor.userId, input.name);
            return { key };
          } catch (error) {
            if (error instanceof Error && error.message === "Already a partner") {
              throw new ORPCError("CONFLICT");
            }
            throw error;
          }
        }),
      ),
      rotateKey: admin.partner.rotateKey.handler(({ context }) =>
        asSystem(async () => {
          await owned(context.actor.userId);
          const { key } = await rotateOwnedPartnerKey(deps.prisma, context.actor.userId);
          return { key };
        }),
      ),
      setTemplate: admin.partner.setTemplate.handler(({ context, input }) =>
        asSystem(async () => {
          await owned(context.actor.userId);
          // The same network policy as any other connector, checked when it is saved.
          if (input.template?.connector) {
            await assertMcpRemoteEndpoint(input.template.connector.endpoint, deps);
          }
          await setOwnedPartnerTemplate(deps.prisma, context.actor.userId, input.template);
          return { ok: true as const };
        }),
      ),
      setLimits: admin.partner.setLimits.handler(({ context, input }) =>
        asSystem(async () => {
          const partner = await owned(context.actor.userId);
          await setPartnerLimits(deps.prisma, partner.id, input);
          return { ok: true as const };
        }),
      ),
      setTenantState: admin.partner.setTenantState.handler(({ context, input }) =>
        asSystem(async () => {
          const partner = await owned(context.actor.userId);
          const found = await setPartnerTenantState(
            deps.prisma,
            partner.id,
            input.externalTenantId,
            input.state,
          );
          if (!found) throw new ORPCError("NOT_FOUND");
          return { ok: true as const };
        }),
      ),
    },
  };
}
