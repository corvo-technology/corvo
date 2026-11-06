# Local audio transcription: design

Status: draft for review. Part 1 of two. Part 2 (the agent speaking back) is out of scope here.

## Intent

An owner wants to send audio and have an agent act on it as text: a voice note sent through Telegram, or an audio file attached in the chat. Today Rook stores the audio and shows a player, and the agent is only told that a file is attached, so it cannot act on what was said.

This should be free and easy. Nothing to configure, no account, no key: the first audio just works, with the speech model running on the owner's own computer. A hosted provider stays available for owners who prefer one.

## Goals

- Audio that reaches an agent is transcribed, and the agent reads the transcript as part of the message. The original audio stays attached.
- Three entry points get it through one shared step: audio attached in the web chat, voice notes from messaging channels (Telegram first), and audio in the team chat bridge.
- The default is a local model on the machine that runs the engine. Audio does not leave the machine unless the owner chose a hosted provider.
- Audio is in English or Portuguese, one language per clip, never mixed inside one clip. The language is detected per clip, with an override.
- First audio with nothing configured: the app downloads the default local model by itself, then transcribes. The owner decided this. The audio waits for the download, and the owner can see that it is happening.
- Settings → Voice gets a "This computer" option next to the existing providers. It lists local models with size and languages, and offers Download, Use and Remove with progress. A downloaded model stays until removed.
- The existing providers (OpenAI, ElevenLabs, Fish Audio, self-hosted) keep working, and when one is selected it transcribes attached audio too.

## Non-goals

- The mobile app. It has no local engine, and phone-only flows are not part of this work.
- Spoken replies, text to speech, and live calls on the local model. Part 2.
- Mixed languages within one clip, speaker separation, translation, and video.
- Server or cloud deployments. "This computer" is offered only where the engine runs on the owner's own machine.

## Anti-goals

These would make it a failure even if transcription technically works.

- A download that starts without the owner knowing, or audio that waits with no sign of why.
- Losing the audio, or hanging the message, when the download or transcription fails. The agent must still receive the message.
- Sending audio to a hosted service the owner did not choose.
- A transcript presented as a perfect record. It is machine output and can be wrong.

## Constraints

- `AGENTS.md` applies. Shared behavior and contracts live in packages. The local engine sits behind the existing voice-provider interface, and engine specifics stay in one adapter. Tests are deterministic and offline, with a scripted engine standing in for the real one.
- Every visible word is UI. The PR that adds copy quotes it and justifies it.
- Model downloads are security-sensitive: a fixed HTTPS origin, a pinned SHA-256 per model, and never a URL taken from chat or from a model.
- The transcript has the same trust as typed text from that sender in that channel. It is labeled as a machine transcript.
- Prior art, behavior only: OpenBot (PolyForm Noncommercial, so no code is copied) offers local dictation models in Settings → Voice, downloaded on demand, with a language setting and a way to delete them. Cubebot (Apache-2.0) runs English-only embedded models through sherpa-onnx, downloads them on first use and checks a pinned digest. Its embedded models do not cover Portuguese, which is why this design starts from a multilingual model.

## Decided by the owner

- Languages are English or Portuguese per audio.
- Mobile is out of scope for now.
- Work in parts: receive audio first, the agent speaking later.
- With nothing configured, the first audio triggers an automatic download of the local model.
- Settings has an add-local control, like OpenBot's.

## The design (calls marked as mine)

**Where audio enters.** Three places build the prompt from attachments today: `buildSendPrompt` in `apps/api/src/artifacts.ts` for the web chat, `storeInboundMedia` and `promptTextForAttachments` in `apps/api/src/messaging-inbound.ts` for channels, and the same call in `apps/api/src/team-chat-bridge.ts`. One shared step, "transcribe the audio artifacts", runs before the prompt is built, and the transcript is added to the prompt. *My call:* the transcript is a labeled block that names the detected language.

**The provider.** *My call:* a new voice provider, "This computer", in the voice catalog with transcription only and no credential. The existing transcribe path (`transcribeVoice` in `apps/api/src/voice.ts`, limited by `MAX_TRANSCRIBE_BYTES`) is what attached audio calls, so a hosted provider and the local one are interchangeable.

**The models.** *My call:* two multilingual Whisper-class models, a small default and a larger "better" option, with their sizes shown. The builder picks the exact models after measuring English and Portuguese accuracy on real voice notes. English-only models are excluded.

**The engine.** *My call, to confirm with a short spike:* the sherpa-onnx Node package, run in a separate worker so it does not block the engine and its memory is released. Its published packages cover macOS (Intel and Apple Silicon), Windows (x64, arm64, ia32) and Linux (x64, arm64). That is verified as published, not verified inside the desktop app, and not verified with Whisper models. The fallback is a whisper.cpp binary.

**Decoding.** Telegram voice notes are Ogg/Opus, and Rook has no audio decoder or ffmpeg today. *My call:* a WebAssembly Ogg/Opus decoder, so nothing has to be installed. An unsupported format is reported to the agent as "audio not transcribed" and never dropped without a word.

**First audio with nothing configured.**
1. The audio arrives and is stored, as today.
2. If no transcribing provider is selected and the engine is local, the default model download starts and the owner sees one short status in the conversation.
3. The message waits. When the model is ready the audio is transcribed and the agent runs on the text.
4. *My call:* if the download fails or the machine is offline, the agent receives the message with the audio attached and a note that it could not be transcribed, and the owner is told once. Nothing is lost.
5. Where the engine is not on the owner's machine, nothing downloads and behavior is unchanged unless a hosted provider is configured.

**Language.** Automatic by default, with an override: automatic, English, Portuguese. Detection is weakest on very short clips, which is the reason for the override.

**Consent.** Local transcription sends nothing out, so it needs no AI-data-sharing consent. Hosted providers keep their existing consent.

**Settings.** *My call:* "This computer" appears only in the desktop app, as a list of models with size and languages, and Download, Use and Remove with a progress bar. Downloads run one at a time. Removing frees the disk.

**Tests.** A scripted engine runs the conformance tests offline. Hook tests cover each of the three entry points. A download test checks the digest and the failure paths. No real model is used in CI.

## Settled in review

**Where the engine runs (from the code).** The desktop app's embedded engine starts the bundled API and worker as child processes and gives them a data directory under the app's user data. The API already reads a desktop-engine setting (`CORVO_DESKTOP_STACK_TOKEN` in `apps/api/src/env.ts`) that only the embedded engine sets. So the API knows it is the owner's local engine from that setting, and the model files, the downloader and the model state live on the API and worker side under `DATA_DIR`. Settings → Voice talks to the API as it does for every other provider, with no new bridge to the Electron main process. A web-only or server deployment does not set it, so it never sees "This computer".

**The provider contract (from the code).** `transcribe` in `packages/adapter-kit/src/interfaces.ts` takes a request that already has an optional `language` hint, and returns only `{ text }`. `apiKey` is a required string. Two backward-compatible changes: the result may carry an optional `language` (the detected one), and a provider with no credential receives an empty key and ignores it. Every existing provider keeps working unchanged.

**My calls.**

- *The message waits for the transcript.* The agent is not run until the transcript is ready or has failed, because an agent that answers before hearing the audio answers the wrong question. The message appears in the conversation at once with the audio and a transcribing status, and the agent run is queued when the text is ready.
- *Several audios share one download.* While a download runs, later audios wait on the same one. A download that stops making progress for several minutes counts as failed and falls back as described in the first-audio flow. The owner can cancel from Settings.
- *A restart mid-download.* The partial file is discarded and the pending audio is retried on the next start, once. If that fails it falls back to the audio with a note.
- *A selected hosted provider is never replaced silently.* The automatic download happens only when no transcribing provider is selected. If a hosted provider is selected and fails or is not consented, the agent gets the audio with a note that it was not transcribed, and no model is downloaded behind the owner's choice. Audio is never sent to a provider the owner did not select.
- *Only the owner's audio uses the engine.* Transcription and the automatic download are triggered by audio from the owner's own linked identity and from the owner's own chat. Audio from anyone else is attached without transcription. This keeps a stranger who messages the bot from starting a large download or using the machine's processor.
- *Where the status shows.* In the conversation in the app, and as one short reply in the channel the audio came from, so an owner who is not looking at the app still sees why nothing has happened yet.
- *The transcript is stored.* It is saved with the audio's artifact as an additive field, so a retry or a later run does not transcribe again. Showing it to the owner is optional and left to the builder. The prompt always carries it, labeled as a machine transcript.
- *Long audio.* The existing 8 MiB limit applies to the file. Ogg/Opus voice notes are small, so the limit is rarely reached. Audio over it is not transcribed, and the agent is told.

## Left to the builder

The exact models and sizes. Confirming the engine with a spike. The decoder. Which formats to accept. The status wording and exactly where it appears. Whether downloads can resume. Whether the owner can see the stored transcript.
