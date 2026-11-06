import type { SecretStore } from "@corvo/adapter-kit";
import type { PrismaClient } from "@corvo/db";
import { runAsSystem } from "@corvo/db";
import type { WhatsAppAuthStore } from "./client.js";

/** One linked number's session, each value encrypted with the deployment's secret store. */
export class DbWhatsAppAuthStore implements WhatsAppAuthStore {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly secrets: SecretStore,
    private readonly installationId: string,
    private readonly owner: { spaceId: string; userId: string },
  ) {}

  private recordId(name: string) {
    return `${this.installationId}:${name}`;
  }

  async get(name: string): Promise<string | undefined> {
    const row = await runAsSystem("read whatsapp session entry", () =>
      this.prisma.whatsAppAuthEntry.findUnique({
        where: { installationId_name: { installationId: this.installationId, name } },
      }),
    );
    return row ? this.secrets.load(row.ciphertext, this.recordId(name)) : undefined;
  }

  async set(name: string, value: string | undefined): Promise<void> {
    if (value === undefined) {
      await runAsSystem("delete whatsapp session entry", () =>
        this.prisma.whatsAppAuthEntry.deleteMany({
          where: { installationId: this.installationId, name },
        }),
      );
      return;
    }
    const sealed = await this.secrets.put(
      value,
      {
        operationId: this.recordId(name),
        traceId: this.recordId(name),
        spaceId: this.owner.spaceId,
        userId: this.owner.userId,
        signal: AbortSignal.timeout(10_000),
      },
      { recordId: this.recordId(name) },
    );
    await runAsSystem("write whatsapp session entry", () =>
      this.prisma.whatsAppAuthEntry.upsert({
        where: { installationId_name: { installationId: this.installationId, name } },
        create: { installationId: this.installationId, name, ciphertext: sealed.ciphertext },
        update: { ciphertext: sealed.ciphertext },
      }),
    );
  }

  async clear(): Promise<void> {
    await runAsSystem("clear whatsapp session", () =>
      this.prisma.whatsAppAuthEntry.deleteMany({ where: { installationId: this.installationId } }),
    );
  }
}
