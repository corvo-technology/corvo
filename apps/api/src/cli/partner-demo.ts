// `pnpm partner:demo`: acts as a partner's server against a running Corvo API, for trying the
// pilot by hand. Needs PARTNER_API_URL and PARTNER_API_KEY.
import { runPartnerDemo } from "./partner-demo-command.js";

try {
  process.stdout.write(`${await runPartnerDemo(process.env)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
