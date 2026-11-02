// `pnpm --filter @corvo/api partner:embed-demo`: a pretend partner website on http://localhost:4310
// for trying the embedded assistant. Needs PARTNER_API_URL and PARTNER_API_KEY; CORVO_WEB_URL is
// where the browser loads the SDK from (default: PARTNER_API_URL).
import { createServer } from "node:http";
import { createEmbedDemo } from "./partner-embed-demo-command.js";

const port = Number(process.env.PORT ?? 4310);
try {
  const handle = createEmbedDemo(process.env);
  createServer(async (req, res) => {
    const response = await handle(
      new Request(`http://localhost:${port}${req.url ?? "/"}`, { method: req.method }),
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  }).listen(port, "127.0.0.1", () => {
    process.stdout.write(`Open http://localhost:${port}\n`);
  });
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
