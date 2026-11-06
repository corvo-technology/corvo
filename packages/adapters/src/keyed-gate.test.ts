import { describe, expect, it } from "vitest";
import { createKeyedGate } from "./keyed-gate.js";

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe("createKeyedGate", () => {
  it("runs one task at a time per key, in order", async () => {
    const gate = createKeyedGate({ maxWaiting: 3 });
    const order: string[] = [];
    const first = deferred();
    const a = gate.run("n1", async () => {
      order.push("a:start");
      await first.promise;
      order.push("a:end");
      return "a";
    });
    const b = gate.run("n1", async () => {
      order.push("b:start");
      return "b";
    });
    await Promise.resolve();
    expect(order).toEqual(["a:start"]);
    first.resolve();
    expect(await a).toBe("a");
    expect(await b).toBe("b");
    expect(order).toEqual(["a:start", "a:end", "b:start"]);
  });

  it("turns away what would wait behind a full queue, without running it", async () => {
    const gate = createKeyedGate({ maxWaiting: 2 });
    const hold = deferred();
    let ran = 0;
    const slow = () => gate.run("n1", async () => (ran++, await hold.promise, "done"));
    const results = [slow(), slow(), slow(), slow(), slow()];
    await Promise.resolve();
    // One running, two waiting; the rest are refused at once.
    expect(await Promise.all(results.slice(3))).toEqual(["full", "full"]);
    hold.resolve();
    expect(await Promise.all(results.slice(0, 3))).toEqual(["done", "done", "done"]);
    expect(ran).toBe(3);
  });

  it("keeps keys independent, and frees the slot when a task fails", async () => {
    const gate = createKeyedGate({ maxWaiting: 0 });
    const hold = deferred();
    const busy = gate.run("n1", async () => {
      await hold.promise;
      return "x";
    });
    await Promise.resolve();
    expect(await gate.run("n1", async () => "y")).toBe("full");
    expect(await gate.run("n2", async () => "z")).toBe("z");
    hold.resolve();
    await busy;
    await expect(gate.run("n1", async () => Promise.reject(new Error("boom")))).rejects.toThrow(
      "boom",
    );
    expect(await gate.run("n1", async () => "after")).toBe("after");
  });
});
