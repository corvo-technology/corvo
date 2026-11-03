// `pnpm partner create|rotate|disable|enable <slug> ...`: manages the SaaS partners that send
// their customers to Rook. Run on the server, as the runtime login, with DATABASE_URL set.
import {
  createDb,
  createPartner,
  rotatePartnerKey,
  runAsSystem,
  setPartnerEnabled,
} from "@corvo/db";
import { runPartnerCommand } from "./partner-command.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const { prisma, pool } = createDb(databaseUrl);
try {
  const output = await runAsSystem("partner administration", () =>
    runPartnerCommand(process.argv.slice(2), {
      createPartner: (input) => createPartner(prisma, input),
      rotatePartnerKey: (slug) => rotatePartnerKey(prisma, slug),
      setPartnerEnabled: (slug, enabled) => setPartnerEnabled(prisma, slug, enabled),
    }),
  );
  process.stdout.write(`${output}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  await pool.end();
}
