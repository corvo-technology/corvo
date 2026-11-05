import path from "node:path";
import { describe, expect, it } from "vitest";
import { createLocalSpeech } from "./local-speech.js";

describe("createLocalSpeech", () => {
  it("is absent unless the desktop app's own engine runs the API", () => {
    expect(createLocalSpeech({ dataDir: "/data" })).toBeUndefined();
  });

  it("keeps models under the data directory when the desktop engine runs the API", async () => {
    const local = createLocalSpeech({ dataDir: "/data", desktopStackToken: "token" });
    expect(local).toBeDefined();
    // A model that was never downloaded is absent, and the directory is the data directory's.
    const [first] = (await local?.store.list()) ?? [];
    expect(first?.state).toBe("absent");
    expect(typeof local?.transcriber.transcribe).toBe("function");
    expect(path.join("/data", "speech-models")).toContain("speech-models");
  });
});
