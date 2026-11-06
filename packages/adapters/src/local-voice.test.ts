import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioDecodeError, UnsupportedAudioFormatError } from "./audio-decode.js";
import { LocalVoiceProvider, parseLocalVoiceSecret } from "./local-voice.js";
import { ScriptedTranscriber } from "./speech-transcriber.js";

const ctx = {
  operationId: "voice",
  traceId: "voice",
  spaceId: "w",
  userId: "u",
  signal: new AbortController().signal,
};

/** A PCM16 mono WAV at 16 kHz, half a second long. */
function wav() {
  const frames = 8000;
  const data = Buffer.alloc(frames * 2, 1);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(16000, 24);
  header.writeUInt32LE(32000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(data.length, 40);
  return new Uint8Array(Buffer.concat([header, data]));
}

/** A PCM16 mono WAV at 16 kHz, `seconds` long. */
function wavOf(seconds: number) {
  const data = Buffer.alloc(seconds * 16000 * 2, 1);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(16000, 24);
  header.writeUInt32LE(32000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(data.length, 40);
  return new Uint8Array(Buffer.concat([header, data]));
}

function provider(respond?: ConstructorParameters<typeof ScriptedTranscriber>[0]) {
  const store = { ensure: vi.fn(async (_id: string) => "/models/base") };
  const transcriber = new ScriptedTranscriber(respond);
  return { store, transcriber, provider: new LocalVoiceProvider({ store, transcriber }) };
}

const secret = (language = "auto") => JSON.stringify({ model: "base", language });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LocalVoiceProvider", () => {
  it("transcribes through the transcriber and returns the detected language", async () => {
    const {
      provider: local,
      store,
      transcriber,
    } = provider(() => ({
      text: "olá, mundo",
      language: "pt",
    }));
    const result = await local.transcribe(
      { audio: wav(), mimeType: "audio/wav", apiKey: secret() },
      ctx,
    );
    expect(result).toEqual({ text: "olá, mundo", language: "pt" });
    expect(store.ensure).toHaveBeenCalledWith("base", expect.anything());
    expect(transcriber.calls).toHaveLength(1);
    expect(transcriber.calls[0]).toMatchObject({
      modelDir: "/models/base",
      sampleRate: 16000,
      language: undefined,
    });
    expect(transcriber.calls[0]?.pcm.length).toBe(8000);
  });

  it("passes the saved language, and lets a caller's hint win over it", async () => {
    const saved = provider();
    await saved.provider.transcribe(
      { audio: wav(), mimeType: "audio/wav", apiKey: secret("pt") },
      ctx,
    );
    expect(saved.transcriber.calls[0]?.language).toBe("pt");
    const hinted = provider();
    await hinted.provider.transcribe(
      { audio: wav(), mimeType: "audio/wav", apiKey: secret("pt"), language: "en" },
      ctx,
    );
    expect(hinted.transcriber.calls[0]?.language).toBe("en");
  });

  it("does not download a model or run the engine for audio it cannot read", async () => {
    const { provider: local, store, transcriber } = provider();
    await expect(
      local.transcribe(
        { audio: new Uint8Array([0x49, 0x44, 0x33, 4]), mimeType: "audio/mpeg", apiKey: secret() },
        ctx,
      ),
    ).rejects.toBeInstanceOf(UnsupportedAudioFormatError);
    await expect(
      local.transcribe({ audio: new Uint8Array(), mimeType: "audio/ogg", apiKey: secret() }, ctx),
    ).rejects.toBeInstanceOf(AudioDecodeError);
    expect(store.ensure).not.toHaveBeenCalled();
    expect(transcriber.calls).toHaveLength(0);
  });

  it("never reaches the network", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { provider: local } = provider();
    await local.transcribe({ audio: wav(), mimeType: "audio/wav", apiKey: secret() }, ctx);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reads Ogg/Opus voice notes", async () => {
    const tone = new Uint8Array(
      await readFile(new URL("./test-fixtures/audio/tone.ogg", import.meta.url)),
    );
    const { provider: local, transcriber } = provider();
    await local.transcribe({ audio: tone, mimeType: "audio/ogg", apiKey: secret() }, ctx);
    expect(transcriber.calls[0]?.pcm.length).toBeGreaterThan(15000);
  });

  it("transcribes a long recording in windows the engine reads whole, and joins them in order", async () => {
    // The engine reads only the first 30 seconds of what it is given.
    const longWav = wavOf(75);
    let call = 0;
    const { provider: local, transcriber } = provider(() => {
      call += 1;
      return { text: `part ${call}`, language: "pt" };
    });
    const result = await local.transcribe(
      { audio: longWav, mimeType: "audio/wav", apiKey: secret() },
      ctx,
    );
    expect(transcriber.calls.length).toBeGreaterThanOrEqual(3);
    for (const piece of transcriber.calls) expect(piece.pcm.length / 16000).toBeLessThanOrEqual(30);
    expect(result.text).toBe(transcriber.calls.map((_, index) => `part ${index + 1}`).join(" "));
    expect(result.language).toBe("pt");
  });

  it("settles the language on the first window, so one note is not read in two languages", async () => {
    const { provider: local, transcriber } = provider((input) => ({
      text: "x",
      language: input.language ? input.language : "pt",
    }));
    await local.transcribe({ audio: wavOf(70), mimeType: "audio/wav", apiKey: secret() }, ctx);
    expect(transcriber.calls[0]?.language).toBeUndefined();
    for (const piece of transcriber.calls.slice(1)) expect(piece.language).toBe("pt");
  });

  it("describes a transcription-only provider with no voices", async () => {
    const { provider: local } = provider();
    expect(local.describe()).toMatchObject({
      id: "local",
      capabilities: { catalog: true, synthesize: false, transcribe: true },
    });
    await expect(local.verify(secret(), ctx)).resolves.toEqual({ ok: true });
    await expect(local.listVoices(secret(), ctx)).resolves.toEqual([]);
    await expect(
      local.synthesize({ text: "hi", voiceId: "x", apiKey: secret() }, ctx),
    ).rejects.toThrow(/not available/i);
  });
});

describe("parseLocalVoiceSecret", () => {
  it("reads the model and language", () => {
    expect(parseLocalVoiceSecret(secret("en"))).toEqual({ model: "base", language: "en" });
  });

  it("rejects text that is not a model choice", () => {
    expect(() => parseLocalVoiceSecret("not json")).toThrow(/model/i);
    expect(() => parseLocalVoiceSecret(JSON.stringify({ model: "", language: "auto" }))).toThrow(
      /model/i,
    );
    expect(() => parseLocalVoiceSecret(JSON.stringify({ model: "base", language: "fr" }))).toThrow(
      /language/i,
    );
  });
});
