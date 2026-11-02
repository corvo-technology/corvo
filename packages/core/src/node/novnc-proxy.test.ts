import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createNovncProxy } from "./novnc-proxy.js";

const log = { info: () => undefined, warn: () => undefined };
const servers: ReturnType<typeof createServer>[] = [];

async function serve(api: string) {
  const proxy = createNovncProxy({ secret: "fake-secret", api, log });
  const server = createServer((req, res) => {
    void proxy.request(req, res).then((handled) => {
      if (!handled) {
        res.statusCode = 204;
        res.end();
      }
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

describe("createNovncProxy", () => {
  it("leaves paths outside the screen to the caller", async () => {
    const base = await serve("http://127.0.0.1:1");
    expect((await fetch(`${base}/rpc/threads`)).status).toBe(204);
  });

  it("refuses a screen path when the authority cannot confirm it", async () => {
    const base = await serve("http://127.0.0.1:1");
    const response = await fetch(`${base}/novnc/session/view/not-a-capability/`);
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
