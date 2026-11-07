import { afterEach, describe, expect, it, vi } from "vitest";
import { pcmToWav, recordingToWav } from "./speech-wav.js";

const text = (bytes: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...bytes.subarray(from, to));

describe("pcmToWav", () => {
  it("writes a 16-bit mono 16 kHz PCM wav", async () => {
    const wav = pcmToWav(new Float32Array([0, 0.5, -0.5, 1, -1, 2]));
    const bytes = new Uint8Array(await wav.arrayBuffer());
    const view = new DataView(bytes.buffer);
    expect(wav.type).toBe("audio/wav");
    expect(text(bytes, 0, 4)).toBe("RIFF");
    expect(text(bytes, 8, 12)).toBe("WAVE");
    expect(text(bytes, 12, 16)).toBe("fmt ");
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(text(bytes, 36, 40)).toBe("data");
    expect(view.getUint32(40, true)).toBe(12);
    expect(view.getInt16(44 + 2, true)).toBe(16383);
    expect(view.getInt16(44 + 6, true)).toBe(32767);
    expect(view.getInt16(44 + 8, true)).toBe(-32768);
    expect(view.getInt16(44 + 10, true)).toBe(32767);
  });
});

describe("recordingToWav", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("turns a browser recording into wav", async () => {
    class FakeContext {
      async decodeAudioData() {
        return {
          length: 4,
          sampleRate: 16000,
          numberOfChannels: 1,
          getChannelData: () => new Float32Array([0, 0.5, -0.5, 0]),
        };
      }
      close() {
        return Promise.resolve();
      }
    }
    vi.stubGlobal("AudioContext", FakeContext);
    const wav = await recordingToWav(new Blob(["webm"], { type: "audio/webm;codecs=opus" }));
    expect(wav.type).toBe("audio/wav");
    expect(wav.size).toBe(44 + 8);
  });

  it("sends the recording as it is when the browser cannot decode it", async () => {
    class FakeContext {
      async decodeAudioData() {
        throw new Error("EncodingError");
      }
      close() {
        return Promise.resolve();
      }
    }
    vi.stubGlobal("AudioContext", FakeContext);
    const original = new Blob(["webm"], { type: "audio/webm" });
    expect(await recordingToWav(original)).toBe(original);
  });
});
