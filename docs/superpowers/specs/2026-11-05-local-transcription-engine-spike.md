# Local transcription engine spike

Result of Task 1 of `docs/superpowers/plans/2026-11-05-local-transcription.md`.

**Verdict: go with the sherpa-onnx Node package and Whisper models, on macOS Apple Silicon.** It loads and transcribes inside Electron 45.0.0 (the runtime the installed desktop app uses, started as Node with `ELECTRON_RUN_AS_NODE=1`, the way the embedded engine starts the API), including inside a worker thread. Windows and Linux were not run; see "Not verified".

## What was run

- Engine: `sherpa-onnx-node` 2.0.1 with the `sherpa-onnx-darwin-arm64` binary package.
- Decoder: `ogg-opus-decoder` 1.7.5 (WebAssembly), asked for 16 kHz mono.
- Audio: one English and one Portuguese (Brazil) sentence made with the operating system's text to speech, as 16 kHz mono WAV and as Ogg/Opus at 48 kHz, 24 kbps (what Telegram voice notes look like). Real recordings were not used, so noisy-audio accuracy is not measured.
- Runtimes: Node 24.22 and Electron 45.0.0, on an Apple Silicon Mac.

## Results

Transcription of the two sentences, language left on automatic. Every run returned the right language (`en`, `pt`) in the result's `lang` field.

| Model | Load | Decode (3.6 s / 5.7 s clips) | Memory (RSS) | Text |
|---|---|---|---|---|
| `base` | 0.3 to 0.6 s | 0.36 to 0.7 s | 360 to 590 MB | Correct, except Portuguese "por que" came out as "porque" |
| `small` | 1.0 to 1.2 s | 1.4 to 2.5 s | about 540 MB | Correct in both languages |

- Setting the language explicitly gave the same text as automatic detection on both clips.
- Ogg/Opus decoding took 20 to 35 ms for both clips and needs no ffmpeg. Ogg/Opus to text gave the same text as WAV to text, in both runtimes.
- The recognizer also ran inside a `worker_threads` worker under both runtimes.

## Findings that change the build

1. **Electron forbids external buffers.** `readWave` fails under Electron with "External buffers are not allowed". Passing samples in with `acceptWaveform({ sampleRate, samples })` works. The adapter must decode audio itself and never call engine functions that return native buffers.
2. **The archives hold fp32 and int8 together.** Only the int8 encoder, the int8 decoder and the tokens file are needed. The model store should keep only those after extraction.
3. **GitHub publishes no digest for these assets.** The digests below are from one download each and must be checked against a second download before they are pinned in code.
4. **The result carries the detected language**, so the transcript label and the contract's `language` field are feasible.

## Model table (from the `asr-models` release of the sherpa-onnx project)

| Model id | Archive bytes | Archive SHA-256 | Kept on disk (int8 + tokens) |
|---|---|---|---|
| `sherpa-onnx-whisper-base` | 207,557,382 | `911b2083efd7c0dca2ac3b358b75222660dc09fb716d64fbfc417ba6c99ff3de` | 160,609,290 bytes |
| `sherpa-onnx-whisper-small` | 639,387,718 | `486a46afbb7ba798507190ffe02fea2dd726049af212e774537efac6afb210a6` | 375,485,327 bytes |

Origin: `https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/<id>.tar.bz2`. Files needed per model: `<name>-encoder.int8.onnx`, `<name>-decoder.int8.onnx`, `<name>-tokens.txt`, where `<name>` is `base` or `small`.

Recommendation: `base` as the default, because the first download is the wait the owner feels (about 208 MB), and `small` as the better-accuracy option (about 639 MB). `turbo` (564 MB archive, multilingual) and `large-v3` (1.07 GB) exist and were not tried.

## Decoding

Confirmed: WAV (parsed in JavaScript) and Ogg/Opus. Not tried: mp3, m4a, webm. The decoder used handles only Ogg/Opus, so in the first version those formats should be reported as "not transcribed" and added later with their own WebAssembly decoder if needed.

## Not verified

- Windows and Linux. The package publishes binaries for macOS (arm64, x64), Windows (x64, arm64, ia32) and Linux (x64, arm64), and that is all that was checked. The desktop release build runs on each system and is where this must be proven.
- The packaged app. The engine was run from a plain folder, not from the packaged archive. How the native files must be unpacked is still to be found in Task 11.
- Accuracy on real, noisy voice notes, and on audio longer than a few seconds.
- The `turbo` model, and any model other than `base` and `small`.
