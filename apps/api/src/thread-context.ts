import { historyCompactJob } from "@corvo/adapter-kit";
import { COMPRESS_KEEP_RECENT } from "@corvo/adapters";
import type { RouterDeps } from "./router.js";

/** Asks for the older part of a chat to be summarized now; the summary replaces it in later turns. */
export async function compressThread(deps: Pick<RouterDeps, "jobs">, threadId: string) {
  await deps.jobs.enqueue(historyCompactJob(threadId, COMPRESS_KEEP_RECENT));
}
