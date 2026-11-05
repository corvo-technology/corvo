import { describe, expect, it } from "vitest";
import { LOCAL_VOICE_PROVIDER_ID, LocalSpeechModelSchema } from "./domain.js";
import { appContract } from "./rpc.js";

const connectInput = appContract.voice.connect["~orpc"].inputSchema;

const model = {
  id: "base",
  label: "Base",
  sizeBytes: 207_557_382,
  languages: ["en", "pt"],
  state: "absent",
  bytesDone: 0,
};

describe("local speech model contract", () => {
  it("accepts every model state and rejects an unknown one", () => {
    for (const state of ["absent", "downloading", "ready", "failed"]) {
      expect(LocalSpeechModelSchema.safeParse({ ...model, state }).success).toBe(true);
    }
    expect(LocalSpeechModelSchema.safeParse({ ...model, state: "paused" }).success).toBe(false);
  });

  it("keeps an error only as optional text", () => {
    expect(
      LocalSpeechModelSchema.safeParse({ ...model, state: "failed", error: "offline" }).success,
    ).toBe(true);
    expect(LocalSpeechModelSchema.safeParse({ ...model, error: 3 }).success).toBe(false);
  });
});

describe("voice.connect for the local provider", () => {
  it("names the local provider 'local'", () => {
    expect(LOCAL_VOICE_PROVIDER_ID).toBe("local");
  });

  it("accepts the local provider without an api key and with a model and language", () => {
    const parsed = connectInput?.safeParse({
      provider: LOCAL_VOICE_PROVIDER_ID,
      sttModel: "base",
      language: "pt",
    });
    expect(parsed?.success).toBe(true);
  });

  it("still requires a key for a hosted provider", () => {
    expect(connectInput?.safeParse({ provider: "openai", apiKey: "" }).success).toBe(false);
  });

  it("rejects a language other than auto, en or pt", () => {
    expect(
      connectInput?.safeParse({
        provider: LOCAL_VOICE_PROVIDER_ID,
        sttModel: "base",
        language: "fr",
      }).success,
    ).toBe(false);
  });

  it("requires a model for the local provider", () => {
    expect(connectInput?.safeParse({ provider: LOCAL_VOICE_PROVIDER_ID }).success).toBe(false);
  });
});
