import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { decodeAudio } from "./audio-decode.js";
import { SherpaWhisperTranscriber } from "./sherpa-whisper-transcriber.js";

// Runs the real engine, so it is off by default: CI is offline and downloads no model.
//   RUN_LOCAL_SPEECH_ENGINE=1
//   LOCAL_SPEECH_MODEL_DIR=<folder holding <name>-encoder.int8.onnx, <name>-decoder.int8.onnx, <name>-tokens.txt>
//   LOCAL_SPEECH_MODEL_NAME=<name, default "base">   LOCAL_SPEECH_CLIP=<wav or ogg/opus file>
const enabled = process.env.RUN_LOCAL_SPEECH_ENGINE === "1";

describe.skipIf(!enabled)("SherpaWhisperTranscriber (real engine)", () => {
  it("transcribes a clip and reports the language it heard", async () => {
    const name = process.env.LOCAL_SPEECH_MODEL_NAME ?? "base";
    const source = process.env.LOCAL_SPEECH_MODEL_DIR ?? "";
    const clip = process.env.LOCAL_SPEECH_CLIP ?? "";
    // The engine reads files named after the folder, as the model store lays them out.
    const root = await mkdtemp(path.join(tmpdir(), "whisper-"));
    const modelDir = path.join(root, name);
    await symlink(source, modelDir);
    const { pcm } = await decodeAudio(new Uint8Array(await readFile(clip)), "audio/ogg");
    const transcriber = new SherpaWhisperTranscriber();
    try {
      const result = await transcriber.transcribe({ pcm, sampleRate: 16000, modelDir });
      expect(result.text.length).toBeGreaterThan(5);
      expect(["en", "pt"]).toContain(result.language);
      const again = await transcriber.transcribe({
        pcm,
        sampleRate: 16000,
        language: "pt",
        modelDir,
      });
      expect(again.text.length).toBeGreaterThan(0);
    } finally {
      await transcriber.close();
      await rm(root, { recursive: true, force: true });
    }
  }, 120_000);
});
