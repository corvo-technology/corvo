# WhatsApp linked number engine spike

Result of Task 1 of `docs/superpowers/plans/2026-11-06-whatsapp-linked-number.md`.

**Verdict: go with `@whiskeysockets/baileys` 6.7.24.** It is plain JavaScript (no native module), loads in Node 25 and in Electron 45.0.0 started as Node with `ELECTRON_RUN_AS_NODE=1` (the way the embedded engine starts the API), and reaches WhatsApp and receives a pairing QR with an in-memory auth state. The live parts (a real scan, real messages) were not run; see "Not verified".

## What was run

- Candidates: 6.7.24 (latest 6.x, 2026-07-29) and 7.0.0-rc14 (the npm `latest` tag, a release candidate).
- Runtimes: Node 25.2.1 and Electron 45.0.0 (the installed desktop app's own binary), on an Apple Silicon Mac.
- A probe that builds a socket with an in-memory auth state and a silent logger and waits for the first QR.

## Results

| | 6.7.24 | 7.0.0-rc14 |
|---|---|---|
| Loads in Node | yes | yes |
| Loads in Electron 45 as Node | yes | yes |
| Receives a QR (about 237 characters) | yes, in both runtimes | no: the connection closes with "Connection Terminated" every time, in both runtimes, on three runs |
| Native files | none | none |

7.0.0-rc14 is not usable today, whatever the reason, so the choice is 6.7.24. Pin it exactly.

Memory: the process was about 40 to 60 MB resident before loading the library and 105 to 130 MB after loading it and starting a socket. Sockets that only wait for a QR end quickly, so this does not measure what one connected number holds. That has to be measured on a live number (see below).

## Findings that change the build

1. **Use 6.7.24, pinned, behind our own interface.** The npm `latest` tag is a release candidate that does not connect, so a floating install would break.
2. **No native module.** Nothing to unpack from the asar. It still goes in the engine's external packages so the bundle does not inline it, like `sherpa-onnx-node`.
3. **Names confirmed in the 6.7.24 types**: `requestPairingCode`, `sendPresenceUpdate` (typing), `readMessages`, `downloadMediaMessage`, the `connection.update` event with a `qr` field, and `DisconnectReason.loggedOut` (401) and `connectionReplaced` (440). A logged-out close must end the number's session; only other closes reconnect.
4. **`messages.upsert` carries a `type`**: `notify` for live messages and `append` for ones replayed from history. The adapter maps `append`, and the `messaging-history.set` event, to `history: true`.

## Not verified

- A real scan and real messages. The JID shapes of the self-chat, a one-to-one chat and a group, the `fromMe` flag on each, and how a voice note or image downloads were not observed. WhatsApp now also addresses people by a LID (`@lid`) in addition to a phone JID, so the self-chat test in `mapIncoming` must accept both forms of the account's own id. The sample payloads in Task 4's tests are built from the library's types, and the first live link must check them.
- Memory of one connected number and of a dozen.
- Whether the pairing code works for the account type in use.
- Windows and Linux, and the packaged app: the library is plain JavaScript, so it loads wherever Node does, but the desktop release build is where it must be proven.
