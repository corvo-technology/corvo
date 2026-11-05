import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { AudioDecodeError, decodeAudio, UnsupportedAudioFormatError } from "./audio-decode.js";

const tone = () => readFile(new URL("./test-fixtures/audio/tone.ogg", import.meta.url));

/** A minimal PCM16 WAV: `seconds` of a ramp, at `rate`, with `channels` identical channels. */
function wav(rate: number, seconds: number, channels = 1, left = 8000, right = left) {
  const frames = Math.round(rate * seconds);
  const data = Buffer.alloc(frames * channels * 2);
  for (let i = 0; i < frames; i++) {
    data.writeInt16LE(left, i * channels * 2);
    if (channels === 2) data.writeInt16LE(right, (i * channels + 1) * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(data.length, 40);
  return new Uint8Array(Buffer.concat([header, data]));
}

describe("decodeAudio", () => {
  it("decodes Ogg/Opus to 16 kHz mono with the expected duration", async () => {
    const decoded = await decodeAudio(new Uint8Array(await tone()), "audio/ogg");
    expect(decoded.sampleRate).toBe(16000);
    expect(decoded.seconds).toBeGreaterThan(0.9);
    expect(decoded.seconds).toBeLessThan(1.1);
    expect(decoded.pcm).toBeInstanceOf(Float32Array);
    expect(decoded.pcm.length).toBe(Math.round(decoded.seconds * 16000));
    const peak = decoded.pcm.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
    expect(peak).toBeGreaterThan(0.1);
    expect(peak).toBeLessThanOrEqual(1);
  });

  it("decodes a 16 kHz wav without changing its samples", async () => {
    const decoded = await decodeAudio(wav(16000, 0.5), "audio/wav");
    expect(decoded.pcm.length).toBe(8000);
    expect(decoded.pcm[0]).toBeCloseTo(8000 / 32768, 5);
    expect(decoded.seconds).toBeCloseTo(0.5, 5);
  });

  it("resamples a 44.1 kHz wav to 16 kHz and keeps its duration", async () => {
    const decoded = await decodeAudio(wav(44100, 1), "audio/x-wav");
    expect(decoded.sampleRate).toBe(16000);
    expect(decoded.pcm.length).toBe(16000);
    expect(decoded.pcm[8000]).toBeCloseTo(8000 / 32768, 3);
  });

  it("mixes a stereo wav down to mono", async () => {
    const decoded = await decodeAudio(wav(16000, 0.25, 2, 10000, 2000), "audio/wav");
    expect(decoded.pcm.length).toBe(4000);
    expect(decoded.pcm[0]).toBeCloseTo(6000 / 32768, 5);
  });

  it("reports formats it cannot read as unsupported, whatever the mime type says", async () => {
    const mp3 = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0x21, 0, 0, 0, 0]);
    const m4a = new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20]);
    const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 1]);
    for (const bytes of [mp3, m4a, webm]) {
      await expect(decodeAudio(bytes, "audio/ogg")).rejects.toBeInstanceOf(
        UnsupportedAudioFormatError,
      );
    }
  });

  it("reports Ogg Vorbis as unsupported, not as broken", async () => {
    const vorbis = new Uint8Array(
      Buffer.from("OggS\0\x02\0\0\0\0\0\0\0\0\x01vorbis\0\0\0\0", "latin1"),
    );
    await expect(decodeAudio(vorbis, "audio/ogg")).rejects.toBeInstanceOf(
      UnsupportedAudioFormatError,
    );
  });

  it("a corrupt Ogg/Opus file throws and does not hang", async () => {
    const bytes = new Uint8Array(await tone());
    const broken = new Uint8Array(bytes.length);
    broken.set(bytes.subarray(0, 64));
    broken.fill(0xa5, 64);
    await expect(decodeAudio(broken, "audio/ogg")).rejects.toBeInstanceOf(AudioDecodeError);
    await expect(
      decodeAudio(new Uint8Array(Buffer.from("OggS" + "\0".repeat(80), "latin1")), "audio/ogg"),
    ).rejects.toBeInstanceOf(AudioDecodeError);
  });

  it("an empty buffer and a wav with no samples throw", async () => {
    await expect(decodeAudio(new Uint8Array(), "audio/ogg")).rejects.toBeInstanceOf(
      AudioDecodeError,
    );
    await expect(decodeAudio(wav(16000, 0), "audio/wav")).rejects.toBeInstanceOf(AudioDecodeError);
  });
});
