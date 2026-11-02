import type { Api, Model } from "@earendil-works/pi-ai";
import { describe, expect, it, vi } from "vitest";
import { withProviderResponse } from "./pi-runtime.js";

const model = {} as Model<Api>;
const response = { status: 200, headers: { "x-test": "1" } };

describe("withProviderResponse", () => {
  it("leaves the options alone when nobody is listening", () => {
    const options = { signal: undefined };
    expect(withProviderResponse({}, "anthropic", options)).toBe(options);
  });

  it("tells the listener which provider answered and with what headers", async () => {
    const onProviderResponse = vi.fn();
    const options = withProviderResponse({ onProviderResponse }, "openai-codex", undefined);
    await options?.onResponse?.(response, model);
    expect(onProviderResponse).toHaveBeenCalledWith({
      provider: "openai-codex",
      headers: { "x-test": "1" },
    });
  });

  it("still calls the hook it wraps", async () => {
    const inner = vi.fn();
    const options = withProviderResponse({ onProviderResponse: () => undefined }, "p", {
      onResponse: inner,
    });
    await options?.onResponse?.(response, model);
    expect(inner).toHaveBeenCalledWith(response, model);
  });

  it("never lets a failing listener touch the run", async () => {
    const inner = vi.fn();
    const options = withProviderResponse(
      {
        onProviderResponse: () => {
          throw new Error("boom");
        },
      },
      "p",
      { onResponse: inner },
    );
    expect(() => options?.onResponse?.(response, model)).not.toThrow();
    expect(inner).toHaveBeenCalled();
  });
});
