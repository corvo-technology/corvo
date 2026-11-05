# Local audio transcription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audio that reaches an agent (web chat attachment, Telegram voice note, team chat) is transcribed on the owner's computer by a downloadable Whisper-class model, and the agent reads the transcript.

**Architecture:** A new voice provider, "This computer" (`local`), sits behind the existing `VoiceProvider` interface. A `LocalModelStore` downloads and verifies models under `DATA_DIR`; a `SpeechTranscriber` runs the engine in a worker thread. Each entry point creates its run as today but, when the owner's message carries audio, enqueues a durable `audio.transcribe` job instead of `run.continue`; the job transcribes, stores the transcript, rewrites the task prompt and then enqueues `run.continue`.

**Tech Stack:** TypeScript, Prisma and PostgreSQL, vitest, oRPC contracts, sherpa-onnx Node package (engine to be confirmed by Task 1), a WebAssembly Ogg/Opus decoder, React for Settings.

**Spec:** `docs/superpowers/specs/2026-11-05-local-transcription-design.md`

## Global Constraints

- Shared behavior and contracts live in packages. Engine specifics stay in one adapter file. The engine sits behind `VoiceProvider`, and nothing outside the adapter imports the engine package.
- Tests are deterministic and offline. A scripted transcriber replaces the real engine everywhere in CI; no real model is downloaded in CI.
- Model downloads use a fixed HTTPS origin and a pinned SHA-256 per model. A URL is never taken from chat or from a model.
- Migrations are additive: the previous release must keep working against the new schema. New tenant tables get row-level-security policies.
- Every visible word is UI. The PR that adds copy quotes it and says why it is needed.
- Use top-level `import type`, never inline type imports. Commit messages and PR titles are Conventional Commits and end with the attribution trailer.
- A selected hosted provider is never replaced silently, and audio is never sent to a provider the owner did not select.
- Only the owner's audio is transcribed. Audio from anyone else is attached untranscribed.
- Limits and values from the spec: English or Portuguese per clip, language Automatic with override (Automatic, English, Portuguese); existing 8 MiB limit (`MAX_TRANSCRIBE_BYTES`); a download that makes no progress for several minutes counts as failed; one download at a time, shared by waiting audios.
- Out of scope: mobile, spoken replies, live calls on the local model, server deployments.

## Review Focus

The most likely inputs and conditions the spec leaves implicit. Each has a test in the task that owns it.

1. A clip with no speech, or a corrupt file: the agent gets "no speech" or "not transcribed", never an empty transcript or a stuck run. (Tasks 4, 7)
2. A second audio arrives while the first download runs: both share the one download and each run is released on its own. (Tasks 3, 8)
3. The transcript contains text that reads like an instruction: it stays inside a labeled machine-transcript block. (Task 7)
4. The app quits or crashes mid-download: the partial file is discarded and never used as a model. (Task 3)
5. The channel retries the same update, or the model is removed while a job runs: one job per run, and a clear failure note instead of a crash. (Tasks 8, 9)

## File Structure

| Path | Responsibility |
|---|---|
| `packages/adapter-kit/src/types.ts`, `interfaces.ts`, `background-jobs.ts` | `VoiceTranscribeResult`, the `audio.transcribe` job |
| `packages/adapters/src/local-speech-models.ts` | model catalog, `LocalModelStore` |
| `packages/adapters/src/audio-decode.ts` | any supported audio to 16 kHz mono PCM |
| `packages/adapters/src/speech-transcriber.ts` | `SpeechTranscriber` interface, `ScriptedTranscriber` |
| `packages/adapters/src/sherpa-whisper-transcriber.ts` | the real engine in a worker thread (only file importing the engine) |
| `packages/adapters/src/local-voice.ts` | `LocalVoiceProvider` |
| `packages/adapters/src/audio-transcription.ts` | `transcribeAudioArtifact`, transcript notes |
| `packages/adapters/src/background-job-handlers.ts` | the `audio.transcribe` handler |
| `apps/api/src/audio-hold.ts` | shared "start the run, or hold it for audio" step used by the entry points |
| `packages/db/prisma/schema.prisma` and a new migration | `ArtifactTranscript` |
| `apps/web/src/pages/VoiceSettingsOverlay.tsx` | the "This computer" section |

---

### Task 1: Engine spike (done, see the record)

Result: `docs/superpowers/specs/2026-11-05-local-transcription-engine-spike.md`. Verdict go, on macOS Apple Silicon under Electron 45 and in a worker thread; Windows and Linux are not run and are proven by the desktop release build in Task 11. The steps below are kept as the record of what was done.

Settles the engine and fills every model constant the later tasks need. If it fails, stop and return to the owner; do not continue on a guess.

**Files:**
- Create: `docs/superpowers/specs/2026-11-05-local-transcription-engine-spike.md` (the record)
- Create outside the repo: a scratch directory for the throwaway script

**Interfaces:**
- Produces: the chosen engine and package version; for each offered model its `id`, label, size in bytes, SHA-256, download URL (fixed origin) and the files the engine needs; whether the Ogg/Opus decoder works under the desktop engine's Node runtime; which audio formats decode.

- [x] **Step 1: Generate test audio with no real voices.** Use the operating system's text to speech to produce a short English clip and a short Portuguese clip, then convert to 16 kHz mono WAV and to Ogg/Opus. Keep them out of the repo.
- [x] **Step 2: Run the engine under plain Node.** Install the engine's Node package and a multilingual Whisper model. Transcribe both clips with language unset, then with each language set. Record the text, the detected language, the time and the peak memory.
- [x] **Step 3: Run it under the desktop engine's runtime.** Start the same script with the desktop app's Electron binary and `ELECTRON_RUN_AS_NODE=1`, as the embedded engine does (`apps/desktop/src/embedded-engine.ts`). Record whether the native addon loads. Find how the packaged app must unpack it (`git grep -l asarUnpack apps/desktop`).
- [x] **Step 4: Check the other systems.** Confirm the package publishes binaries for macOS (arm64, x64), Windows (x64, arm64) and Linux (x64, arm64). Run the script on Windows and Linux through a throwaway CI job or a machine you have; record the result honestly, including what was not run.
- [x] **Step 5: Decode check.** Decode the Ogg/Opus clip with the WebAssembly decoder under the same runtime. Record which of wav, ogg/opus, mp3, m4a and webm decode.
- [x] **Step 6: Write the record and commit.** Include the model table with real digests, the fallback decision (whisper.cpp) if the engine fails, and a one-line verdict.

```bash
git add docs/superpowers/specs/2026-11-05-local-transcription-engine-spike.md
git commit -m "docs(superpowers): record the local transcription engine spike"
```

---

### Task 2: Contracts and the job

**Files:**
- Modify: `packages/adapter-kit/src/types.ts` (near `VoiceTranscribeRequest`, line ~711, and `BackgroundJobPayloads`, line ~725), `packages/adapter-kit/src/interfaces.ts:482`, `packages/adapter-kit/src/background-jobs.ts`
- Modify: the module defining `VoiceCatalogEntrySchema` and `VoiceCredentialSchema` (imported at `packages/contracts/src/rpc.ts:128`), and the `voice` routes in `packages/contracts/src/rpc.ts` (~1250)
- Test: `packages/adapter-kit/src/background-jobs.test.ts`, a contracts test next to the schema

**Interfaces:**
- Produces:
  - `export interface VoiceTranscribeResult { text: string; language?: string }`; `VoiceProvider.transcribe?` now returns `Promise<VoiceTranscribeResult>`.
  - Job `"audio.transcribe"` with payload `{ runId: string }`; `export function audioTranscribeJob(runId: string): BackgroundJob` with `replaceKey` `audio.transcribe:${runId}`.
  - Contract `LocalSpeechModelSchema`: `{ id: string; label: string; sizeBytes: number; languages: string[]; state: "absent" | "downloading" | "ready" | "failed"; bytesDone: number; error?: string }`.
  - RPC: `voice.localModels` (output `z.array(LocalSpeechModelSchema)`), `voice.downloadLocalModel`, `voice.cancelLocalModelDownload`, `voice.removeLocalModel` (input `{ id: string }`, output `{ ok: true }`).
  - `voice.connect` accepts `provider: "local"` with `sttModel` carrying the model id and a new optional `language: "auto" | "en" | "pt"`.

- [ ] **Step 1: Write the failing tests.** `parses an audio.transcribe job` (payload with `runId` parses; an empty `runId` throws); `audioTranscribeJob is keyed by run` (two calls give the same `replaceKey`); `LocalSpeechModelSchema rejects an unknown state`.
- [ ] **Step 2: Run to verify failure.** `pnpm exec vitest run packages/adapter-kit/src/background-jobs.test.ts` fails with an unknown job name.
- [ ] **Step 3: Implement** the types, the payload schema entry, `audioTranscribeJob`, the contract schemas and the routes. Existing providers keep returning `{ text }`; the field is optional.
- [ ] **Step 4: Run to verify pass,** then typecheck `packages/adapter-kit` and `packages/contracts`.
- [ ] **Step 5: Commit.**

```bash
git commit -m "feat(contracts): add the audio transcription job and local speech model contract"
```

---

### Task 3: Model store

**Files:**
- Create: `packages/adapters/src/local-speech-models.ts`
- Test: `packages/adapters/src/local-speech-models.test.ts`

**Interfaces:**
- Consumes: the model table from Task 1.
- Produces:
  - `export interface LocalSpeechModelSpec { id: string; label: string; sizeBytes: number; sha256: string; url: string; languages: readonly string[] }` and `export const LOCAL_SPEECH_MODELS: readonly LocalSpeechModelSpec[]` (values from the spike record; the digests there come from one download each and must be checked against a second download before they are pinned). Default model: base; better model: small.
  - `export class LocalModelStore { constructor(options: { dir: string; fetch?: typeof fetch; stallMs?: number; models?: readonly LocalSpeechModelSpec[] }); list(): Promise<LocalSpeechModelInfo[]>; ensure(id: string, options?: { signal?: AbortSignal }): Promise<string>; cancel(id: string): void; remove(id: string): Promise<void> }`. `ensure` resolves to the model directory. After extraction it keeps only the int8 encoder, the int8 decoder and the tokens file (the archives also hold fp32 copies the engine does not need). `LocalSpeechModelInfo` is the Task 2 contract shape.

- [ ] **Step 1: Write the failing tests** against a local HTTP server that serves a fake archive:
  - `ensure downloads, verifies the digest and returns the directory`.
  - `a digest mismatch fails and leaves nothing behind`.
  - `two ensure calls for one model make one request and both resolve` (Review Focus 2).
  - `a partial file left by a crash is discarded and never reported ready` (Review Focus 4).
  - `no progress for stallMs fails the download with a clear error`.
  - `cancel stops a running download and reports absent`.
  - `remove deletes the model and ensure then downloads it again`.
  - `a url outside the catalog is never fetched`.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement** with a state file per model for progress, an atomic rename after the digest check, and one active download at a time. Only catalog urls are fetched.
- [ ] **Step 4: Run to verify pass,** typecheck, and lint the two files with `pnpm exec biome check <files>`.
- [ ] **Step 5: Commit** `feat(adapters): add the local speech model store`.

---

### Task 4: Audio decoding

**Files:**
- Create: `packages/adapters/src/audio-decode.ts`
- Create: small fixtures under `packages/adapters/test-fixtures/audio/` with a README giving the command that made each one
- Test: `packages/adapters/src/audio-decode.test.ts`

**Interfaces:**
- Produces: `export async function decodeAudio(bytes: Uint8Array, mimeType: string): Promise<{ pcm: Float32Array; sampleRate: 16000; seconds: number }>` and `export class UnsupportedAudioFormatError extends Error`.

- [ ] **Step 1: Write the failing tests.** `decodes Ogg/Opus to 16 kHz mono with the expected duration`; `decodes wav`; `a format the spike did not confirm throws UnsupportedAudioFormatError`; `a corrupt file throws and does not hang` (Review Focus 1); `an empty buffer throws`.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement** with the WebAssembly Ogg/Opus decoder and a resampler to 16 kHz mono. Supported formats are exactly those the spike confirmed: WAV and Ogg/Opus. mp3, m4a and webm throw `UnsupportedAudioFormatError`, and the pipeline reports them as not transcribed.
- [ ] **Step 4: Run to verify pass,** typecheck, lint.
- [ ] **Step 5: Commit** `feat(adapters): decode voice notes to speech-ready audio`.

---

### Task 5: Engine adapter and the local provider

**Files:**
- Create: `packages/adapters/src/speech-transcriber.ts`, `sherpa-whisper-transcriber.ts`, `local-voice.ts`
- Modify: `packages/adapters/src/voice-factory.ts` (`VOICE_CATALOG`, `listVoiceCatalog`, `createVoiceProvider`, `isVoiceProviderId`)
- Test: `packages/adapters/src/local-voice.test.ts`, `packages/adapters/src/voice-factory.test.ts`

**Interfaces:**
- Consumes: `LocalModelStore` (Task 3), `decodeAudio` (Task 4), `VoiceTranscribeResult` (Task 2).
- Produces:
  - `export interface SpeechTranscriber { transcribe(input: { pcm: Float32Array; sampleRate: 16000; language?: string; modelDir: string; signal?: AbortSignal }): Promise<VoiceTranscribeResult> }`.
  - `export class ScriptedTranscriber implements SpeechTranscriber` returning canned results keyed by a fixture label; `export class SherpaWhisperTranscriber implements SpeechTranscriber` (worker thread; the only file that imports the engine).
  - `export const LOCAL_VOICE_PROVIDER_ID = "local"`; `export class LocalVoiceProvider implements VoiceProvider` taking `{ store: LocalModelStore; transcriber: SpeechTranscriber }`: transcription only, `verify` ok, `listVoices` empty, `synthesize` throws "not available yet".
  - `listVoiceCatalog(options: { allowPrivateEndpoint?: boolean; localEngine?: boolean })` lists `local` ("This computer", `transcribe: true`) only when `localEngine` is true; `createVoiceProvider(kind, options)` accepts `options.local`.

- [ ] **Step 1: Write the failing tests.** `the catalog lists local only on a local engine`; `createVoiceProvider("local") builds a provider that transcribes through the scripted transcriber and returns the detected language`; `local never reaches the network` (no fetch is called); `the language override is passed through`; `synthesize throws`.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement.** The adapter never calls engine functions that return native buffers (for example `readWave`), because Electron forbids them; it passes the decoded samples to `acceptWaveform` and reads the detected language from the result's `lang`. `LocalVoiceProvider.transcribe` calls `decodeAudio`, then `store.ensure(modelId)`, then the transcriber. The model id and language come from the credential plaintext (Task 6).
- [ ] **Step 4: Run to verify pass,** plus a real-engine smoke test marked to run only when `RUN_LOCAL_SPEECH_ENGINE=1`, using the spike's model; typecheck, lint.
- [ ] **Step 5: Commit** `feat(adapters): add the local voice provider for transcription`.

---

### Task 6: Settings API and the local-engine flag

**Files:**
- Modify: `apps/api/src/env.ts` (add `localEngine`, true exactly when the desktop engine setting at line ~223 is set), `apps/api/src/voice.ts` (`voiceCredentialPlaintext`, `persistVoiceCredential`, `toVoiceStatus`), the route file that implements `voice.*` (`apps/api/src/routes/account.ts`), `apps/api/src/app.ts` (construct the store under `DATA_DIR/speech-models`)
- Test: `apps/api/src/voice.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 3, 5.
- Produces: `voice.localModels`, `voice.downloadLocalModel`, `voice.cancelLocalModelDownload`, `voice.removeLocalModel` handlers; selecting a model is `voice.connect` with `provider: "local"`, which stores `{ model, language }` as the credential plaintext and makes it the default.

- [ ] **Step 1: Write the failing tests.** `the catalog omits local on a non-desktop deployment`; `connect with provider local stores the model and language and becomes the default`; `connect with local is refused when the engine is not local`; `localModels lists state and progress`; `removing a model that is selected clears the selection`; `toVoiceStatus reports transcribe true and ready false for local` (no speaking yet).
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement.** No API key is read for `local`. Downloads call the store and return at once; progress is read from `localModels`.
- [ ] **Step 4: Run to verify pass,** typecheck, lint.
- [ ] **Step 5: Commit** `feat(api): manage local speech models from voice settings`.

---

### Task 7: Transcript storage and the pipeline

**Files:**
- Modify: `packages/db/prisma/schema.prisma`; create `packages/db/prisma/migrations/<timestamp>_artifact_transcripts/migration.sql` (copy the policy pattern of `20261108000000_wiki_curator`)
- Create: `packages/adapters/src/audio-transcription.ts`
- Modify: `packages/core/src/attachments.ts:115` (`promptTextForAttachments`)
- Test: `packages/adapters/src/audio-transcription.test.ts`, `packages/core/src/attachments.test.ts`

**Interfaces:**
- Consumes: `decodeAudio`, `VoiceProvider`, `LocalModelStore`, the default voice credential loader in `apps/api/src/voice.ts`.
- Produces:
  - Prisma model `ArtifactTranscript { artifactId @id, spaceId, status ("done" | "failed"), text?, language?, reason?, createdAt }` mapped to `artifact_transcripts`, with the tenant and system policies.
  - `export type TranscriptionOutcome = { status: "transcribed"; text: string; language?: string } | { status: "failed"; reason: "unsupported-format" | "too-large" | "no-speech" | "download-failed" | "provider-failed" }`.
  - `export async function transcribeAudioArtifact(deps: AudioTranscriptionDeps, input: { artifactId: string; actor: Actor }): Promise<TranscriptionOutcome>`: returns the stored outcome without transcribing again; otherwise picks the provider (selected provider; with none selected and a local engine, the local default model, downloading it); never substitutes a local download when a hosted provider is selected.
  - `export function transcriptNote(name: string, outcome: TranscriptionOutcome): string`: for success `Machine transcript of "<name>" (<language>), may contain errors:\n<text>`; for failure `Audio "<name>" was not transcribed (<reason>).`
  - `promptTextForAttachments(text, artifacts: Array<{ name: string; mimeType: string; size: number; note?: string }>)` appends each `note` after the file line.

- [ ] **Step 1: Write the failing tests.** Pipeline: `stores and reuses a transcript so a second call does not transcribe`; `a hosted provider that fails, or has no consent, yields provider-failed and downloads nothing`; `with no provider selected and a local engine, the default model is downloaded then used`; `no provider and no local engine yields provider-failed`; `silence yields no-speech, not an empty transcript` (Review Focus 1); `over 8 MiB yields too-large`; `a transcript that reads like an instruction stays inside the labeled block` (Review Focus 3). Core: `notes are appended after the file line`.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement** the migration, the model, the pipeline and the prompt change. The migration is additive.
- [ ] **Step 4: Run to verify pass,** run the migration against a disposable database (`pnpm test:integration` path used by the db package tests), typecheck, lint.
- [ ] **Step 5: Commit** `feat(adapters): transcribe audio artifacts and store the transcript`.

---

### Task 8: The `audio.transcribe` job

**Files:**
- Modify: `packages/adapters/src/background-job-handlers.ts` (add the handler beside `routine.next-step`, line ~156)
- Test: `packages/adapters/src/background-job-handlers.test.ts` or a new `audio-transcribe-job.test.ts`

**Interfaces:**
- Consumes: `audioTranscribeJob` (Task 2), `transcribeAudioArtifact`, `transcriptNote`, `runContinueJob`.
- Produces: the handler for `"audio.transcribe"` `{ runId }`: reads the run and its task, finds the audio artifacts of the run's user message, settles each one, rewrites `task.prompt` with the notes, enqueues `run.continue` exactly once, and posts one short status message in the conversation while a model download is needed. When the run came from a messaging channel, it also queues one short reply to that channel through the existing outbound path.

- [ ] **Step 1: Write the failing tests.** `releases the run with the transcript in the prompt`; `a failure releases the run with a "not transcribed" note, never leaves it stuck`; `two runs waiting on one download are each released when it finishes` (Review Focus 2); `a repeated job for the same run enqueues run.continue once` (Review Focus 5); `a model removed mid-job gives a failure note, not a crash` (Review Focus 5); `a restart re-runs the job and reuses stored transcripts`; `only audio from the owner is transcribed`; `a channel-origin run gets exactly one short reply in that channel, and a web run gets none`.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement.** Use `asOwner` like the neighbouring handlers. Post the status with the existing message publishing helper, once per run.
- [ ] **Step 4: Run to verify pass,** typecheck, lint.
- [ ] **Step 5: Commit** `feat(adapters): hold a run until its audio is transcribed`.

---

### Task 9: Entry points

**Files:**
- Create: `apps/api/src/audio-hold.ts`
- Modify: `apps/api/src/thread-target.ts` (the two sends at lines ~940 and ~1113), `apps/api/src/messaging-inbound.ts` (the send and enqueue at lines ~171 to ~209), `apps/api/src/team-chat-bridge.ts` (the send at ~722 and the run creation at ~1361)
- Test: `apps/api/src/audio-hold.test.ts` and one test per entry point beside its existing tests

**Interfaces:**
- Consumes: `audioTranscribeJob`, `runContinueJob`, the owner check each entry point already has.
- Produces: `export async function startRunOrAwaitAudio(deps: { jobs: JobPublisher; prisma: PrismaClient }, input: { runId: string; artifactIds: string[]; fromOwner: boolean }): Promise<"started" | "held">`: when the sender is the owner and an artifact is audio, enqueues `audioTranscribeJob(runId)` and returns `"held"`; otherwise enqueues `runContinueJob(runId)`.

- [ ] **Step 1: Write the failing tests.** `an owner voice note holds the run and enqueues audio.transcribe`; `audio from someone else is attached and the run starts at once`; `a message without audio is unchanged`; `a retried Telegram update does not create a second job` (Review Focus 5); one test per entry point proving it calls the helper with the right artifacts.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement.** Replace the direct `run.continue` enqueue at each site with the helper. Do not delay the webhook response.
- [ ] **Step 4: Run to verify pass,** typecheck, lint. Add one offline journey in `packages/testkit` that sends a scripted voice note through the messaging path and asserts the agent's prompt contains the scripted transcript.
- [ ] **Step 5: Commit** `feat(api): transcribe the owner's audio before the agent runs`.

---

### Task 10: Settings UI

**Files:**
- Modify: `apps/web/src/pages/VoiceSettingsOverlay.tsx`
- Test: `apps/web/src/pages/VoiceSettingsOverlay.test.tsx` (create); an e2e spec that opens the screen so CI captures it

**Interfaces:**
- Consumes: the Task 2 RPC.
- Produces: a "This computer" provider section: one row per model with size and languages, buttons Download, Use, Remove and Cancel, a progress bar, and a language select (Automatic, English, Portuguese). Shown only when the catalog lists `local`.

- [ ] **Step 1: Write the failing tests.** `local does not appear when the catalog omits it`; `a model row shows its size and a Download button`; `while downloading it shows progress and Cancel`; `Use selects the model and the language`; `Remove asks nothing extra and the row returns to Download`.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement** with the existing shadcn components and tokens; poll `voice.localModels` while any model is downloading. Keep copy to the minimum and list every string for the PR.
- [ ] **Step 4: Run to verify pass,** typecheck, lint, and let CI run the e2e; do not run the desktop e2e on a maintainer's machine.
- [ ] **Step 5: Commit** `feat(web): choose and download a local speech model in voice settings`.

---

### Task 11: Packaging and docs

**Files:**
- Modify: the desktop packaging configuration found in Task 1 (unpack the engine's native files); `docs/` add `local-transcription.md`

**Interfaces:**
- Consumes: the spike record.

- [ ] **Step 1: Verify the packaged app loads the engine.** Build the desktop package on the maintainer's machine without opening a window, and run the Task 1 script against the unpacked files.
- [ ] **Step 2: Apply the unpack rule** and repeat Step 1 until the engine loads from the package.
- [ ] **Step 3: Write `docs/local-transcription.md`:** what it does, where models live, how to remove them, the languages, the 8 MiB limit and that only the owner's audio is transcribed.
- [ ] **Step 4: Commit** `build(desktop): ship the local speech engine` and `docs: describe local audio transcription`.

---

## Self-Review

- **Spec coverage:** goals map to Tasks 5 to 9 (provider, transcript in prompt, three entry points, local default, first-audio download, language); Settings list to Tasks 6 and 10; existing providers to Tasks 5 and 7; decisions from review (message waits, shared download, restart, no silent hosted replacement, owner only, status, stored transcript, long audio) to Tasks 3, 7, 8 and 9; the engine and decoder to Tasks 1, 4 and 5.
- **Type consistency:** `VoiceTranscribeResult`, `SpeechTranscriber`, `LocalModelStore`, `TranscriptionOutcome`, `audioTranscribeJob` and `startRunOrAwaitAudio` are defined once and reused with the same names.
- **Open by design:** model ids, sizes and digests come from Task 1; status wording and its exact position are the builder's.
