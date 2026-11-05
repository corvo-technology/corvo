import type {
  AdapterContext,
  AdapterDescriptor,
  SpeechClip,
  VoiceCapabilities,
  VoiceInfo,
  VoiceProvider,
  VoiceSynthesizeRequest,
  VoiceTranscribeRequest,
  VoiceTranscribeResult,
  VoiceVerifyResult,
} from "@corvo/adapter-kit";
import { LOCAL_VOICE_PROVIDER_ID } from "@corvo/contracts";
import { decodeAudio } from "./audio-decode.js";
import type { LocalModelStore } from "./local-speech-models.js";
import { splitForSpeech } from "./speech-chunks.js";
import type { SpeechTranscriber } from "./speech-transcriber.js";

export { LOCAL_VOICE_PROVIDER_ID };

export type LocalVoiceLanguage = "auto" | "en" | "pt";

/** What the owner chose, stored as the connection's secret: no key exists for this provider. */
export function parseLocalVoiceSecret(plaintext: string): {
  model: string;
  language: LocalVoiceLanguage;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new Error("The local voice connection has no model.");
  }
  const record = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const model = typeof record.model === "string" ? record.model.trim() : "";
  if (!model) throw new Error("The local voice connection has no model.");
  const language = record.language ?? "auto";
  if (language !== "auto" && language !== "en" && language !== "pt") {
    throw new Error("The local voice connection has an unknown language.");
  }
  return { model, language };
}

/** "pt-BR" and "PT_br" both mean the model's "pt". */
function primaryLanguage(tag: string | undefined): string | undefined {
  const primary = tag?.split(/[-_]/)[0]?.trim().toLowerCase();
  return primary || undefined;
}

export interface LocalVoiceDeps {
  store: Pick<LocalModelStore, "ensure">;
  transcriber: SpeechTranscriber;
}

/** Transcription on the owner's own computer. No key, nothing leaves the machine. */
export class LocalVoiceProvider implements VoiceProvider {
  constructor(private readonly deps: LocalVoiceDeps) {}

  describe(): AdapterDescriptor<VoiceCapabilities> {
    return {
      id: LOCAL_VOICE_PROVIDER_ID,
      contractVersion: "1",
      adapterVersion: "0.1.0",
      capabilities: { catalog: true, synthesize: false, transcribe: true },
    };
  }

  async verify(_secret: string, _context: AdapterContext): Promise<VoiceVerifyResult> {
    return { ok: true };
  }

  async listVoices(_secret: string, _context: AdapterContext): Promise<VoiceInfo[]> {
    return [];
  }

  async synthesize(
    _request: VoiceSynthesizeRequest,
    _context: AdapterContext,
  ): Promise<SpeechClip> {
    throw new Error("Spoken replies are not available on this computer yet.");
  }

  async transcribe(
    request: VoiceTranscribeRequest,
    context: AdapterContext,
  ): Promise<VoiceTranscribeResult> {
    const { model, language } = parseLocalVoiceSecret(request.apiKey);
    // Decode first: audio this version cannot read must not start a model download.
    const audio = await decodeAudio(request.audio, request.mimeType);
    const signal = request.signal ?? context.signal;
    const modelDir = await this.deps.store.ensure(model, { signal });
    // The engine reads only the first 30 seconds, so a long note goes through in windows. The
    // first window settles the language, so one note is never read as two.
    let spoken = primaryLanguage(request.language) ?? (language === "auto" ? undefined : language);
    const texts: string[] = [];
    let heard: string | undefined;
    for (const pcm of splitForSpeech(audio.pcm, audio.sampleRate)) {
      const part = await this.deps.transcriber.transcribe({
        pcm,
        sampleRate: audio.sampleRate,
        language: spoken,
        modelDir,
        signal,
      });
      if (part.text.trim()) texts.push(part.text.trim());
      heard ??= part.language;
      spoken ??= part.language;
    }
    return { text: texts.join(" "), ...(heard ? { language: heard } : {}) };
  }
}
