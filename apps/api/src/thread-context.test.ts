import { COMPRESS_KEEP_RECENT } from "@corvo/adapters";
import { describe, expect, it, vi } from "vitest";
import { compressThread } from "./thread-context.js";

describe("compressThread", () => {
  it("queues one compaction that keeps the newest messages", async () => {
    const enqueue = vi.fn(async () => undefined);
    await compressThread({ jobs: { enqueue } } as never, "thread-1");
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "history.compact",
        payload: { threadId: "thread-1", keepRecent: COMPRESS_KEEP_RECENT },
      }),
    );
  });
});
