import { createRequire } from "node:module";
import { Worker } from "node:worker_threads";
import type { VoiceTranscribeResult } from "@corvo/adapter-kit";
import type { SpeechTranscribeInput, SpeechTranscriber } from "./speech-transcriber.js";

/**
 * The only file that knows the sherpa-onnx engine. The recognizer runs in a worker thread so it
 * never blocks the engine's event loop, and the worker is ended when idle so the model's memory
 * (a few hundred MB) is given back.
 *
 * The engine is told the samples directly. It is never asked for a native buffer (for example by
 * `readWave`), because Electron forbids them.
 *
 * The worker is inline source rather than a separate file so a bundled app has nothing to locate;
 * it receives the engine's resolved path instead of resolving it from the current directory.
 */
const WORKER_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads");
const path = require("node:path");
const sherpa = require(workerData.engine);
let cached;
function recognizerFor(modelDir, language) {
  const key = modelDir + "|" + language;
  if (cached && cached.key === key) return cached.recognizer;
  const name = path.basename(modelDir);
  const recognizer = new sherpa.OfflineRecognizer({
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: {
      whisper: {
        encoder: path.join(modelDir, name + "-encoder.int8.onnx"),
        decoder: path.join(modelDir, name + "-decoder.int8.onnx"),
        language,
        task: "transcribe",
        tailPaddings: -1,
      },
      tokens: path.join(modelDir, name + "-tokens.txt"),
      numThreads: workerData.numThreads,
      provider: "cpu",
      debug: 0,
    },
  });
  cached = { key, recognizer };
  return recognizer;
}
parentPort.on("message", (job) => {
  try {
    const recognizer = recognizerFor(job.modelDir, job.language);
    const stream = recognizer.createStream();
    stream.acceptWaveform({ sampleRate: 16000, samples: job.samples });
    recognizer.decode(stream);
    const result = recognizer.getResult(stream);
    parentPort.postMessage({ id: job.id, text: String(result.text || "").trim(), language: result.lang || undefined });
  } catch (error) {
    parentPort.postMessage({ id: job.id, error: error && error.message ? error.message : String(error) });
  }
});
`;

export interface SherpaWhisperOptions {
  /** CPU threads for decoding; half the cores by default, at least 2. */
  numThreads?: number;
  /** How long the worker (and the model in memory) is kept after the last clip. */
  idleMs?: number;
}

type Reply = { id: number; text?: string; language?: string; error?: string };

export class SherpaWhisperTranscriber implements SpeechTranscriber {
  private worker: Worker | undefined;
  private idleTimer: NodeJS.Timeout | undefined;
  private nextId = 1;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly numThreads: number;
  private readonly idleMs: number;

  constructor(options: SherpaWhisperOptions = {}) {
    this.numThreads = options.numThreads ?? 4;
    this.idleMs = options.idleMs ?? 60_000;
  }

  /** One clip at a time: the recognizer and the CPU are shared. */
  transcribe(input: SpeechTranscribeInput): Promise<VoiceTranscribeResult> {
    const run = this.queue.then(() => this.runOne(input));
    this.queue = run.catch(() => undefined);
    return run;
  }

  async close(): Promise<void> {
    clearTimeout(this.idleTimer);
    await this.stopWorker();
  }

  private start(): Worker {
    if (this.worker) return this.worker;
    const engine = createRequire(import.meta.url).resolve("sherpa-onnx-node");
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: { engine, numThreads: this.numThreads },
    });
    this.worker = worker;
    worker.once("exit", () => {
      if (this.worker === worker) this.worker = undefined;
    });
    return worker;
  }

  private async stopWorker() {
    const worker = this.worker;
    this.worker = undefined;
    await worker?.terminate();
  }

  private runOne(input: SpeechTranscribeInput): Promise<VoiceTranscribeResult> {
    clearTimeout(this.idleTimer);
    if (input.signal?.aborted) return Promise.reject(new Error("Transcription cancelled."));
    const worker = this.start();
    const id = this.nextId++;
    return new Promise<VoiceTranscribeResult>((resolve, reject) => {
      const cleanup = () => {
        worker.off("message", onMessage);
        worker.off("error", onError);
        input.signal?.removeEventListener("abort", onAbort);
        this.idleTimer = setTimeout(() => void this.stopWorker(), this.idleMs);
        this.idleTimer.unref();
      };
      const onMessage = (reply: Reply) => {
        if (reply.id !== id) return;
        cleanup();
        if (reply.error) reject(new Error(`Transcription failed: ${reply.error}`));
        else
          resolve({
            text: reply.text ?? "",
            ...(reply.language ? { language: reply.language } : {}),
          });
      };
      const onError = (error: Error) => {
        cleanup();
        void this.stopWorker();
        reject(error);
      };
      const onAbort = () => {
        cleanup();
        void this.stopWorker();
        reject(new Error("Transcription cancelled."));
      };
      worker.on("message", onMessage);
      worker.on("error", onError);
      input.signal?.addEventListener("abort", onAbort, { once: true });
      const samples = new Float32Array(input.pcm);
      worker.postMessage(
        { id, modelDir: input.modelDir, language: input.language ?? "", samples },
        [samples.buffer],
      );
    });
  }
}
