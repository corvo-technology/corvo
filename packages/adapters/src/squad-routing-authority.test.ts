import { describe, expect, it, vi } from "vitest";
import { squadRoutingAuthority } from "./run-tools-messaging.js";

const mainCall = JSON.stringify(["pi-tool", "main", "call-1"]);
const helperCall = JSON.stringify(["pi-tool", "helper-1", "call-1"]);

function ctx(over: { live?: boolean | null; ownerStarted?: boolean; outsideMessage?: boolean }) {
  const findUnique = vi.fn(async () =>
    over.live === null ? null : { squadRouting: over.live ?? true },
  );
  return {
    findUnique,
    ctx: {
      deps: { prisma: { bot: { findUnique } } },
      run: { botId: "bot-a" },
      source: { ownerStartedRun: over.ownerStarted ?? true },
      trust: { receivedOutsideMessage: vi.fn(async () => over.outsideMessage ?? false) },
    } as never,
  };
}

describe("squadRoutingAuthority", () => {
  it("grants routing to a switched-on bot in a run its owner started", async () => {
    const f = ctx({});
    await expect(squadRoutingAuthority(f.ctx, mainCall)).resolves.toEqual({
      squadRouting: true,
      ownerStarted: true,
    });
  });

  it("reads the switch again, so turning it off mid-run takes effect", async () => {
    const f = ctx({ live: false });
    await expect(squadRoutingAuthority(f.ctx, mainCall)).resolves.toMatchObject({
      squadRouting: false,
    });
    expect(f.findUnique).toHaveBeenCalledWith({
      where: { id: "bot-a" },
      select: { squadRouting: true },
    });
  });

  it("denies a bot that no longer exists", async () => {
    const f = ctx({ live: null });
    await expect(squadRoutingAuthority(f.ctx, mainCall)).resolves.toMatchObject({
      squadRouting: false,
    });
  });

  it("denies a helper the run started", async () => {
    const f = ctx({});
    await expect(squadRoutingAuthority(f.ctx, helperCall)).resolves.toMatchObject({
      squadRouting: false,
    });
  });

  it("denies a run the owner did not start, without reading the switch", async () => {
    const f = ctx({ ownerStarted: false });
    await expect(squadRoutingAuthority(f.ctx, mainCall)).resolves.toEqual({
      squadRouting: false,
      ownerStarted: false,
    });
    expect(f.findUnique).not.toHaveBeenCalled();
  });

  it("denies routing once a channel or webhook message reached the run", async () => {
    const f = ctx({ outsideMessage: true });
    await expect(squadRoutingAuthority(f.ctx, mainCall)).resolves.toMatchObject({
      squadRouting: false,
    });
  });
});
