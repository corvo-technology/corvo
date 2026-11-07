/** The rate and shape the speech models read; the server decodes this format without extra tools. */
const SPEECH_RATE = 16000;

/** 16-bit mono PCM wav from samples in -1..1. */
export function pcmToWav(samples: Float32Array, rate = SPEECH_RATE): Blob {
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(bytes);
  const ascii = (at: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 32768 : clamped * 32767, true);
  }
  return new Blob([bytes], { type: "audio/wav" });
}

function mono(buffer: AudioBuffer): Float32Array {
  const first = buffer.getChannelData(0);
  if (buffer.numberOfChannels === 1) return first;
  const out = new Float32Array(first.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < out.length; i++) {
      out[i] = (out[i] ?? 0) + (data[i] ?? 0) / buffer.numberOfChannels;
    }
  }
  return out;
}

async function at16k(buffer: AudioBuffer): Promise<Float32Array> {
  if (buffer.sampleRate === SPEECH_RATE || typeof OfflineAudioContext !== "function") {
    return mono(buffer);
  }
  const length = Math.max(1, Math.ceil(buffer.duration * SPEECH_RATE));
  const offline = new OfflineAudioContext(1, length, SPEECH_RATE);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();
  return (await offline.startRendering()).getChannelData(0);
}

/**
 * Browsers record WebM or MP4, which the local speech engine does not read. The browser can decode
 * what it recorded, so the recording goes out as wav. When it cannot, the original is sent and the
 * server decides.
 */
export async function recordingToWav(recording: Blob): Promise<Blob> {
  const host = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const Ctor = host.AudioContext ?? host.webkitAudioContext;
  if (!Ctor) return recording;
  let context: AudioContext | undefined;
  try {
    context = new Ctor();
    const decoded = await context.decodeAudioData(await recording.arrayBuffer());
    const samples = await at16k(decoded);
    return samples.length === 0 ? recording : pcmToWav(samples);
  } catch {
    return recording;
  } finally {
    void context?.close().catch(() => undefined);
  }
}
