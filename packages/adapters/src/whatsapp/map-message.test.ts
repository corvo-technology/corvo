import { describe, expect, it } from "vitest";
import { mapIncoming, type RawWhatsAppMessage } from "./map-message.js";

const own = ["15550001@s.whatsapp.net", "99900001@lid"];
const options = (history = false) => ({
  ownIds: own,
  history,
  download: async () => new Uint8Array([1, 2, 3]),
});
const raw = (
  over: Partial<RawWhatsAppMessage> & { key?: Partial<RawWhatsAppMessage["key"]> } = {},
) =>
  ({
    key: { remoteJid: "15550100@s.whatsapp.net", fromMe: false, id: "m1", ...over.key },
    message: "message" in over ? over.message : { conversation: "hello" },
    messageTimestamp: over.messageTimestamp ?? 1_767_225_600,
    pushName: over.pushName ?? "Ana",
  }) as RawWhatsAppMessage;

describe("mapIncoming", () => {
  it("maps a one-to-one text message from someone else", () => {
    const mapped = mapIncoming(raw(), options());
    expect(mapped).toMatchObject({
      chat: { id: "15550100@s.whatsapp.net", kind: "direct" },
      messageId: "m1",
      senderId: "15550100@s.whatsapp.net",
      senderName: "Ana",
      fromMe: false,
      text: "hello",
      history: false,
    });
    expect(mapped?.sentAt.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("recognizes the self chat by the phone id and by the LID, device suffix ignored", () => {
    const byPhone = mapIncoming(
      raw({ key: { remoteJid: "15550001:7@s.whatsapp.net", fromMe: true } }),
      options(),
    );
    const byLid = mapIncoming(raw({ key: { remoteJid: "99900001@lid", fromMe: true } }), options());
    expect(byPhone?.chat.kind).toBe("self");
    expect(byLid?.chat.kind).toBe("self");
  });

  it("keeps the owner's own message in a friend's chat as fromMe, in a direct chat", () => {
    const mapped = mapIncoming(
      raw({ key: { remoteJid: "15550100@s.whatsapp.net", fromMe: true } }),
      options(),
    );
    expect(mapped).toMatchObject({ chat: { kind: "direct" }, fromMe: true });
  });

  it("marks a group and uses the participant as the sender", () => {
    const mapped = mapIncoming(
      raw({ key: { remoteJid: "120363@g.us", participant: "15550123@s.whatsapp.net" } }),
      options(),
    );
    expect(mapped).toMatchObject({ chat: { kind: "group" }, senderId: "15550123@s.whatsapp.net" });
  });

  it("marks history replays", () => {
    expect(mapIncoming(raw(), options(true))?.history).toBe(true);
  });

  it("reads extended text, and image and document captions", () => {
    expect(
      mapIncoming(raw({ message: { extendedTextMessage: { text: "link" } } }), options())?.text,
    ).toBe("link");
    const image = mapIncoming(
      raw({
        message: { imageMessage: { caption: "look", mimetype: "image/jpeg", fileLength: 10 } },
      }),
      options(),
    );
    expect(image).toMatchObject({
      text: "look",
      media: { kind: "image", mimeType: "image/jpeg", size: 10 },
    });
  });

  it("maps a voice note to audio media that downloads", async () => {
    const voice = mapIncoming(
      raw({
        message: {
          audioMessage: { mimetype: "audio/ogg; codecs=opus", fileLength: 4096, ptt: true },
        },
      }),
      options(),
    );
    expect(voice).toMatchObject({
      text: "",
      media: { kind: "audio", mimeType: "audio/ogg; codecs=opus", size: 4096 },
    });
    expect(await voice?.media?.download()).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("maps a document with its file name", () => {
    const doc = mapIncoming(
      raw({
        message: {
          documentMessage: { mimetype: "application/pdf", fileName: "a.pdf", fileLength: 99 },
        },
      }),
      options(),
    );
    expect(doc?.media).toMatchObject({ kind: "file", name: "a.pdf", size: 99 });
  });

  it("drops reactions, protocol messages, statuses, newsletters and empty messages", () => {
    expect(
      mapIncoming(raw({ message: { reactionMessage: { text: "👍" } } }), options()),
    ).toBeUndefined();
    expect(mapIncoming(raw({ message: { protocolMessage: {} } }), options())).toBeUndefined();
    expect(mapIncoming(raw({ key: { remoteJid: "status@broadcast" } }), options())).toBeUndefined();
    expect(mapIncoming(raw({ key: { remoteJid: "1@newsletter" } }), options())).toBeUndefined();
    expect(mapIncoming(raw({ message: null }), options())).toBeUndefined();
  });
});
