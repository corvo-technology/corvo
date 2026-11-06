import type { SecretStore } from "@corvo/adapter-kit";
import type { PrismaClient } from "@corvo/db";
import type { Pool } from "pg";
import { createBaileysClient } from "./baileys-client.js";
import { DbWhatsAppAuthStore } from "./db-auth-store.js";
import { WhatsAppLinkSurface } from "./link-surface.js";
import { createInProcessNumberLock, createPostgresNumberLock } from "./number-lock.js";

/**
 * The composition root's one call: the linked-number surface with the real WhatsApp client, each
 * number's session in the encrypted store, and a per-number lock through the shared database
 * (or in the process when there is none).
 */
export function createWhatsAppLinkSurface(deps: {
  prisma: PrismaClient;
  secrets: SecretStore;
  pool?: Pick<Pool, "connect"> | undefined;
}): WhatsAppLinkSurface {
  return new WhatsAppLinkSurface({
    prisma: deps.prisma,
    createClient: (auth) => createBaileysClient(auth),
    authStoreFor: (installation) =>
      new DbWhatsAppAuthStore(deps.prisma, deps.secrets, installation.id, {
        spaceId: installation.spaceId,
        userId: installation.userId,
      }),
    acquireLock: deps.pool ? createPostgresNumberLock(deps.pool) : createInProcessNumberLock(),
  });
}
