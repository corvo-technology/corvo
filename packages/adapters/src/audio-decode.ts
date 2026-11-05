import { OggOpusDecoder } from "ogg-opus-decoder";

export const SPEECH_SAMPLE_RATE = 16000;

export interface DecodedAudio {
  /** Mono samples in -1..1 at 16 kHz, the rate the speech models read. */
  pcm: Float32Array;
  sampleRate: 16000;
  seconds: number;
}

/** A format this version does not read (mp3, m4a, webm, Ogg Vorbis, 24-bit wav, ...). */
export class UnsupportedAudioFormatError extends Error {
  constructor(mimeType: string) {
    super(`Audio of type "${mimeType.slice(0, 60)}" cannot be read here.`);
    this.name = "UnsupportedAudioFormatError";
  }
}

/** The file is a supported format but empty or damaged. */
export class AudioDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AudioDecodeError";
  }
}

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  Buffer.from(bytes.subarray(start, end)).toString("latin1");

/**
 * Reads WAV (PCM, 16-bit) and Ogg/Opus into 16 kHz mono. The format is taken from the bytes, not
 * from `mimeType`, which is only used in messages: a channel's label for a voice note is not proof.
 */
export async function decodeAudio(bytes: Uint8Array, mimeType: string): Promise<DecodedAudio> {
  if (bytes.byteLength === 0) throw new AudioDecodeError("The audio is empty.");
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WAVE")
    return decodeWav(bytes, mimeType);
  if (ascii(bytes, 0, 4) === "OggS") return decodeOgg(bytes, mimeType);
  throw new UnsupportedAudioFormatError(mimeType);
}

function finish(channels: Float32Array[], rate: number): DecodedAudio {
  const mono = mixDown(channels);
  const pcm = rate === SPEECH_SAMPLE_RATE ? mono : resample(mono, rate);
  if (pcm.length === 0) throw new AudioDecodeError("The audio holds no samples.");
  return { pcm, sampleRate: SPEECH_SAMPLE_RATE, seconds: pcm.length / SPEECH_SAMPLE_RATE };
}

function mixDown(channels: Float32Array[]): Float32Array {
  const first = channels[0];
  if (!first) return new Float32Array();
  if (channels.length === 1) return first;
  const out = new Float32Array(first.length);
  for (const channel of channels) {
    for (let i = 0; i < out.length; i++)
      out[i] = (out[i] ?? 0) + (channel[i] ?? 0) / channels.length;
  }
  return out;
}

/** Averages the source samples under each output sample when shrinking, so high tones do not alias. */
function resample(input: Float32Array, rate: number): Float32Array {
  const ratio = rate / SPEECH_SAMPLE_RATE;
  const length = Math.floor(input.length / ratio);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    if (ratio < 1) {
      const at = i * ratio;
      const low = Math.floor(at);
      const a = input[low] ?? 0;
      const b = input[Math.min(low + 1, input.length - 1)] ?? a;
      out[i] = a + (b - a) * (at - low);
      continue;
    }
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.max(start + 1, Math.floor((i + 1) * ratio)));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j] ?? 0;
    out[i] = sum / (end - start);
  }
  return out;
}

function decodeWav(bytes: Uint8Array, mimeType: string): DecodedAudio {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let channels = 0;
  let rate = 0;
  let offset = 12;
  while (offset + 8 <= bytes.byteLength) {
    const id = ascii(bytes, offset, offset + 4);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt ") {
      const format = view.getUint16(body, true);
      channels = view.getUint16(body + 2, true);
      rate = view.getUint32(body + 4, true);
      if (format !== 1 || view.getUint16(body + 14, true) !== 16) {
        throw new UnsupportedAudioFormatError(mimeType);
      }
    } else if (id === "data") {
      if (channels < 1 || rate < 1) throw new AudioDecodeError("The wav has no format chunk.");
      const available = Math.min(size, bytes.byteLength - body);
      const frames = Math.floor(available / (channels * 2));
      const planes = Array.from({ length: channels }, () => new Float32Array(frames));
      for (let i = 0; i < frames; i++) {
        for (let c = 0; c < channels; c++) {
          (planes[c] as Float32Array)[i] =
            view.getInt16(body + (i * channels + c) * 2, true) / 32768;
        }
      }
      return finish(planes, rate);
    }
    offset = body + size + (size % 2);
  }
  throw new AudioDecodeError("The wav has no audio data.");
}

async function decodeOgg(bytes: Uint8Array, mimeType: string): Promise<DecodedAudio> {
  const head = ascii(bytes, 0, Math.min(bytes.byteLength, 256));
  if (head.includes("\u0001vorbis")) throw new UnsupportedAudioFormatError(mimeType);
  if (!head.includes("OpusHead")) throw new AudioDecodeError("The Ogg file is not readable.");
  const decoder = new OggOpusDecoder({ forceStereo: false });
  try {
    await decoder.ready;
    const { channelData, samplesDecoded, sampleRate } = await decoder.decodeFile(bytes);
    if (samplesDecoded === 0 || channelData.length === 0) {
      throw new AudioDecodeError("The Opus audio holds no samples.");
    }
    return finish(channelData, sampleRate);
  } catch (error) {
    if (error instanceof AudioDecodeError) throw error;
    throw new AudioDecodeError(
      `The Opus audio could not be decoded: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  } finally {
    decoder.free();
  }
}
