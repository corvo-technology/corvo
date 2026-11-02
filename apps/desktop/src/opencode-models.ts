import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { startOpenCodeModels } from "@corvo/adapters/opencode-models";
import { readPrivateFile, writePrivateFile } from "./setup-store.js";

type Start = typeof startOpenCodeModels;

/**
 * OpenCode's free models, offered to the local engine as its local model server. The address
 * is kept between launches so a running engine does not have to restart to learn it again.
 * Fails closed: without OpenCode, or on any error, the app simply has no such models.
 */
export async function prepareOpenCodeModels(
  userDataDir: string,
  start: Start = startOpenCodeModels,
  timeoutMs = 20_000,
) {
  // Starting the app never waits long for this: past the limit the app goes on without it,
  // and the server that finishes late is shut down.
  const work = prepare(userDataDir, start);
  const late = Symbol("late");
  const timer = new Promise<typeof late>((resolve) =>
    setTimeout(() => resolve(late), timeoutMs).unref(),
  );
  const first = await Promise.race([work, timer]);
  if (first !== late) return first;
  void work.then((result) => result?.close());
  return undefined;
}

async function prepare(userDataDir: string, start: Start) {
  try {
    const dataDir = path.join(userDataDir, "opencode");
    await mkdir(dataDir, { recursive: true, mode: 0o700 });
    const configFile = path.join(userDataDir, "opencode-models.json");
    let secret = randomBytes(24).toString("hex");
    let port: number | undefined;
    try {
      const saved = JSON.parse((await readPrivateFile(configFile, 1024)) ?? "null");
      if (/^[a-f0-9]{48}$/.test(saved?.secret)) secret = saved.secret;
      if (Number.isInteger(saved?.port) && saved.port >= 1024 && saved.port <= 65535)
        port = saved.port;
    } catch {
      /* A bad file is replaced. */
    }
    let running: Awaited<ReturnType<Start>>;
    try {
      running = await start({ dataDir, secret, ...(port !== undefined ? { port } : {}) });
    } catch (error) {
      // The remembered port may be taken now; any other port will do.
      if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
      running = await start({ dataDir, secret });
    }
    if (!running) return undefined;
    const url = new URL(running.baseUrl);
    await writePrivateFile(configFile, JSON.stringify({ secret, port: Number(url.port) }));
    return { url: running.baseUrl, models: running.models, close: running.close };
  } catch {
    return undefined;
  }
}
