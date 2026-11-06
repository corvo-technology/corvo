/**
 * The speech engine reads only the first 30 seconds of what it is given and drops the rest, so a
 * longer recording is cut into windows a little under that, one after another.
 */
export const MAX_SPEECH_WINDOW_SECONDS = 28;
/** How far back from a window's end to look for a pause to cut in. */
const PAUSE_SEARCH_SECONDS = 4;
/** The length of the stretch whose loudness decides where a pause is. */
const FRAME_SECONDS = 0.05;

function loudness(pcm: Float32Array, from: number, length: number): number {
  let sum = 0;
  for (let i = from; i < from + length; i++) sum += (pcm[i] ?? 0) ** 2;
  return sum / length;
}

/** The start of the quietest short stretch within the last seconds before `end`. */
function quietestCut(pcm: Float32Array, rate: number, start: number, end: number): number {
  const frame = Math.max(1, Math.round(FRAME_SECONDS * rate));
  const from = Math.max(start + frame, end - Math.round(PAUSE_SEARCH_SECONDS * rate));
  let best = end;
  let bestLoudness = Number.POSITIVE_INFINITY;
  for (let at = from; at + frame <= end; at += frame) {
    const level = loudness(pcm, at, frame);
    if (level < bestLoudness) {
      bestLoudness = level;
      best = at + Math.floor(frame / 2);
    }
  }
  return best;
}

/**
 * Splits mono samples into consecutive pieces no longer than the engine's window, cutting in the
 * quietest moment near each window's end so a word is not cut in half. No sample is lost.
 */
export function splitForSpeech(pcm: Float32Array, rate = 16000): Float32Array[] {
  const window = Math.round(MAX_SPEECH_WINDOW_SECONDS * rate);
  if (pcm.length <= window) return [pcm];
  const pieces: Float32Array[] = [];
  let start = 0;
  while (pcm.length - start > window) {
    const cut = quietestCut(pcm, rate, start, start + window);
    pieces.push(pcm.subarray(start, cut));
    start = cut;
  }
  pieces.push(pcm.subarray(start));
  return pieces;
}
