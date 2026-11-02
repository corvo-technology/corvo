// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  ownMessageJustSent,
  pressTakesScroll,
  transcriptCanSnapAfterFrame,
  transcriptIsNearEnd,
  transcriptMovedDown,
} from "./transcript-scroll.js";

describe("transcriptIsNearEnd", () => {
  it("follows only while the viewport is within 80px of the latest message", () => {
    expect(transcriptIsNearEnd({ scrollHeight: 1_000, scrollTop: 421, clientHeight: 500 })).toBe(
      true,
    );
    expect(transcriptIsNearEnd({ scrollHeight: 1_000, scrollTop: 420, clientHeight: 500 })).toBe(
      false,
    );
  });
});

describe("transcriptCanSnapAfterFrame", () => {
  it("does not snap after the reader moves while the frame is queued", () => {
    const transcript = { scrollTop: 950 };
    expect(transcriptCanSnapAfterFrame(transcript, transcript, 950)).toBe(true);
    transcript.scrollTop = 920;
    expect(transcriptCanSnapAfterFrame(transcript, transcript, 950)).toBe(false);
  });

  it("does not snap a replacement transcript", () => {
    const queuedTranscript = { scrollTop: 950 };
    const replacementTranscript = { scrollTop: 950 };
    expect(transcriptCanSnapAfterFrame(replacementTranscript, queuedTranscript, 950)).toBe(false);
  });
});

describe("transcriptMovedDown", () => {
  it("does not treat an uninitialized baseline as downward movement", () => {
    expect(transcriptMovedDown(null, 920)).toBe(false);
    expect(transcriptMovedDown(950, 920)).toBe(false);
    expect(transcriptMovedDown(920, 950)).toBe(true);
  });
});

describe("ownMessageJustSent", () => {
  const sent = [
    { id: "a", role: "bot" },
    { id: "b", role: "user" },
  ];
  it("is true when the newest message is the person's and is new", () => {
    expect(ownMessageJustSent("a", sent)).toBe(true);
  });

  it("is false for a bot reply, for the same message again, and when the chat has just opened", () => {
    expect(ownMessageJustSent("a", [...sent, { id: "c", role: "bot" }])).toBe(false);
    expect(ownMessageJustSent("b", sent)).toBe(false);
    expect(ownMessageJustSent(null, sent)).toBe(false);
    expect(ownMessageJustSent("a", [])).toBe(false);
  });
});

describe("pressTakesScroll", () => {
  it("lets a press on a control in a message keep following, and a press on the text take the scroll", () => {
    const host = document.createElement("div");
    host.innerHTML = '<p id="text">hi</p><button id="answer"><span id="label">A</span></button>';
    expect(pressTakesScroll(host.querySelector("#text"))).toBe(true);
    expect(pressTakesScroll(host.querySelector("#answer"))).toBe(false);
    expect(pressTakesScroll(host.querySelector("#label"))).toBe(false);
    expect(pressTakesScroll(null)).toBe(true);
  });
});
