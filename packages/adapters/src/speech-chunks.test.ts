import { describe, expect, it } from "vitest";
import { MAX_SPEECH_WINDOW_SECONDS, splitForSpeech } from "./speech-chunks.js";

const RATE = 16000;
/** `seconds` of a steady tone, with a silent gap of `gapSeconds` starting at `gapAt` seconds. */
function tone(seconds: number, gap?: { at: number; length: number }) {
  const pcm = new Float32Array(Math.round(seconds * RATE)).fill(0.4);
  if (gap) pcm.fill(0, Math.round(gap.at * RATE), Math.round((gap.at + gap.length) * RATE));
  return pcm;
}

describe("splitForSpeech", () => {
  it("leaves a clip within the engine's window as one piece", () => {
    const pcm = tone(20);
    expect(splitForSpeech(pcm)).toEqual([pcm]);
  });

  it("splits a long clip into windows the engine reads whole, and loses no sample", () => {
    const pcm = tone(95);
    const pieces = splitForSpeech(pcm);
    expect(pieces.length).toBeGreaterThanOrEqual(4);
    for (const piece of pieces) {
      expect(piece.length).toBeGreaterThan(0);
      expect(piece.length / RATE).toBeLessThanOrEqual(MAX_SPEECH_WINDOW_SECONDS);
    }
    expect(pieces.reduce((sum, piece) => sum + piece.length, 0)).toBe(pcm.length);
  });

  it("cuts in a pause when there is one near the end of a window, not in a word", () => {
    const pcm = tone(50, { at: 25.6, length: 0.4 });
    const [first] = splitForSpeech(pcm);
    const end = (first?.length ?? 0) / RATE;
    expect(end).toBeGreaterThanOrEqual(25.6);
    expect(end).toBeLessThanOrEqual(26.0);
  });

  it("never stalls on a clip that is all silence", () => {
    const pieces = splitForSpeech(new Float32Array(70 * RATE));
    expect(pieces.length).toBeGreaterThanOrEqual(3);
    expect(pieces.reduce((sum, piece) => sum + piece.length, 0)).toBe(70 * RATE);
  });
});
