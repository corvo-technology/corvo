// Opt-in network check for the built-in app catalog; not part of `pnpm test`.
// Usage: pnpm exec tsx scripts/probe-app-catalog.ts
import { APP_CATALOG } from "../packages/core/src/app-catalog-data.ts";

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "catalog-probe", version: "0.0.0" },
  },
};

let failed = 0;
for (const entry of APP_CATALOG) {
  try {
    const response = await fetch(entry.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(initialize),
      redirect: "manual",
      signal: AbortSignal.timeout(5_000),
    });
    const challenge = response.headers.get("www-authenticate");
    if (response.ok && entry.auth.kind === "none")
      console.log(`${entry.slug}: ok (${response.status})`);
    else if (response.status === 401 && (challenge || entry.auth.kind === "key"))
      console.log(`${entry.slug}: needs-auth (401${challenge ? " + WWW-Authenticate" : ""})`);
    else {
      failed++;
      console.log(`${entry.slug}: FAIL (HTTP ${response.status})`);
    }
  } catch (error) {
    failed++;
    console.log(`${entry.slug}: FAIL (${error instanceof Error ? error.message : String(error)})`);
  }
}
process.exit(failed ? 1 : 0);
