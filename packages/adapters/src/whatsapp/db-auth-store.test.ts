import type { SecretStore } from "@corvo/adapter-kit";
import type { PrismaClient } from "@corvo/db";
import { describe, expect, it } from "vitest";
import { DbWhatsAppAuthStore } from "./db-auth-store.js";

type Row = { installationId: string; name: string; ciphertext: string };

function setup() {
  const rows: Row[] = [];
  const prisma = {
    whatsAppAuthEntry: {
      findUnique: async ({
        where,
      }: {
        where: { installationId_name: { installationId: string; name: string } };
      }) =>
        rows.find(
          (row) =>
            row.installationId === where.installationId_name.installationId &&
            row.name === where.installationId_name.name,
        ) ?? null,
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { installationId_name: { installationId: string; name: string } };
        create: Row;
        update: { ciphertext: string };
      }) => {
        const found = rows.find(
          (row) =>
            row.installationId === where.installationId_name.installationId &&
            row.name === where.installationId_name.name,
        );
        if (found) found.ciphertext = update.ciphertext;
        else rows.push({ ...create });
      },
      deleteMany: async ({ where }: { where: { installationId: string; name?: string } }) => {
        for (let i = rows.length - 1; i >= 0; i--) {
          const row = rows[i] as Row;
          if (
            row.installationId === where.installationId &&
            (where.name === undefined || row.name === where.name)
          ) {
            rows.splice(i, 1);
          }
        }
      },
    },
  } as unknown as PrismaClient;
  const secrets = {
    put: async (plaintext: string) => ({
      id: "x",
      ref: "r",
      ciphertext: `enc(${plaintext.split("").reverse().join("")})`,
    }),
    load: async (ciphertext: string) => ciphertext.slice(4, -1).split("").reverse().join(""),
  } as unknown as SecretStore;
  const ctx = { spaceId: "space-1", userId: "user-1" };
  return { rows, store: (id: string) => new DbWhatsAppAuthStore(prisma, secrets, id, ctx) };
}

describe("DbWhatsAppAuthStore", () => {
  it("stores values encrypted and reads them back", async () => {
    const { rows, store } = setup();
    const auth = store("inst-1");
    await auth.set("creds", "top-secret");
    expect(rows[0]?.ciphertext).not.toContain("top-secret");
    expect(await auth.get("creds")).toBe("top-secret");
    await auth.set("creds", "changed");
    expect(rows).toHaveLength(1);
    expect(await auth.get("creds")).toBe("changed");
  });

  it("deletes an entry when the value is undefined", async () => {
    const { rows, store } = setup();
    const auth = store("inst-1");
    await auth.set("a", "1");
    await auth.set("a", undefined);
    expect(rows).toHaveLength(0);
    expect(await auth.get("a")).toBeUndefined();
  });

  it("clears one number's entries and no other's", async () => {
    const { rows, store } = setup();
    await store("inst-1").set("a", "1");
    await store("inst-1").set("b", "2");
    await store("inst-2").set("a", "3");
    await store("inst-1").clear();
    expect(rows.map((row) => row.installationId)).toEqual(["inst-2"]);
  });
});
