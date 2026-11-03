import { describe, expect, it } from "vitest";
import { mayRouteWithoutOwner } from "./run-tools-messaging.js";

describe("mayRouteWithoutOwner", () => {
  it("lets the owner's own runs and routines route", () => {
    expect(mayRouteWithoutOwner("user", true)).toBe(true);
    expect(mayRouteWithoutOwner("routine", false)).toBe(true);
  });

  it("lets a router woken by the answer to its own routed handoff route the next stage", () => {
    expect(mayRouteWithoutOwner("bot_message", false, { continuesRouting: true })).toBe(true);
  });

  it("does not let any other peer message, or a webhook or channel run, route", () => {
    expect(mayRouteWithoutOwner("bot_message", false, {})).toBe(false);
    expect(mayRouteWithoutOwner("bot_message", false, null)).toBe(false);
    expect(mayRouteWithoutOwner("bot_message", false)).toBe(false);
    expect(mayRouteWithoutOwner("webhook", false, { continuesRouting: true })).toBe(false);
    expect(mayRouteWithoutOwner("messaging", false, { continuesRouting: true })).toBe(false);
  });
});
