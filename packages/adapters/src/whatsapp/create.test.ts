import type { SecretStore } from "@corvo/adapter-kit";
import type { PrismaClient } from "@corvo/db";
import { describe, expect, it } from "vitest";
import { createWhatsAppLinkSurface } from "./create.js";
import { WHATSAPP_LINK_PROVIDER, WhatsAppLinkSurface } from "./link-surface.js";

describe("createWhatsAppLinkSurface", () => {
  it("builds the surface for the linked-number provider, without touching WhatsApp until used", () => {
    const surface = createWhatsAppLinkSurface({
      prisma: {} as PrismaClient,
      secrets: {} as SecretStore,
    });
    expect(surface).toBeInstanceOf(WhatsAppLinkSurface);
    expect(surface.platforms().map((p) => p.provider)).toEqual([WHATSAPP_LINK_PROVIDER]);
  });
});
