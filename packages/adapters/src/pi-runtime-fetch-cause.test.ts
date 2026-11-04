import { describe, expect, it } from "vitest";
import { modelRequestFetch } from "./pi-runtime-stream.js";

/** What undici throws: a bare `fetch failed` with the reason one level down. */
const failed = (cause?: unknown) =>
  Object.assign(new TypeError("fetch failed"), cause === undefined ? {} : { cause });
const reason = (message: string, code?: string) => Object.assign(new Error(message), { code });

const rejecting = (error: unknown) => async () => {
  throw error;
};
const run = (error: unknown, url = "https://api.example.com/v1/messages?key=secret-key-123") =>
  modelRequestFetch(rejecting(error) as typeof fetch, 60_000)(url, {});

describe("a model request that fails on the network", () => {
  it("says why, so a certificate problem is not mistaken for a slow provider", async () => {
    const error = await run(
      failed(reason("unable to verify the first certificate", "UNABLE_TO_VERIFY_LEAF_SIGNATURE")),
    ).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(
      "fetch failed (api.example.com): unable to verify the first certificate (UNABLE_TO_VERIFY_LEAF_SIGNATURE)",
    );
  });

  it("names the first address that failed when every address was tried", async () => {
    const aggregate = new AggregateError(
      [
        reason("connect ETIMEDOUT 2606:4700::1:443", "ETIMEDOUT"),
        reason("connect ENETUNREACH 1.2.3.4:443"),
      ],
      "",
    );
    const error = await run(failed(aggregate)).catch((e) => e);
    expect(error.message).toBe(
      "fetch failed (api.example.com): connect ETIMEDOUT 2606:4700::1:443",
    );
  });

  it("shows the host and never the path or the query, which can carry a key", async () => {
    const error = await run(
      failed(reason("getaddrinfo ENOTFOUND api.example.com", "ENOTFOUND")),
    ).catch((e) => e);
    expect(error.message).toContain("api.example.com");
    expect(error.message).not.toContain("secret-key-123");
    expect(error.message).not.toContain("/v1/messages");
  });

  it("still names the host when the network gave no reason", async () => {
    const error = await run(failed()).catch((e) => e);
    expect(error.message).toBe("fetch failed (api.example.com)");
  });

  it("stays the same TypeError with its cause, so what reads the chain still can", async () => {
    const cause = reason("connect ECONNRESET", "ECONNRESET");
    const original = failed(cause);
    const error = await run(original).catch((e) => e);
    expect(error).toBe(original);
    expect(error).toBeInstanceOf(TypeError);
    expect(error.cause).toBe(cause);
  });

  it("leaves a cancelled request and any other error exactly as they were", async () => {
    const abort = Object.assign(new Error("This operation was aborted"), { name: "AbortError" });
    expect(await run(abort).catch((e) => e)).toBe(abort);
    const other = new RangeError("something else");
    expect(await run(other).catch((e) => e)).toBe(other);
  });

  it("returns the response of a request that worked", async () => {
    const response = await modelRequestFetch(
      (async () => new Response("ok")) as typeof fetch,
      60_000,
    )("https://api.example.com/v1", {});
    expect(await response.text()).toBe("ok");
  });
});
