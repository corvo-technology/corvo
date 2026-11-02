import type { Actor } from "@corvo/contracts";
import { describe, expect, it, vi } from "vitest";
import { chiefAsFirstAgent, startStarterTeam } from "./starter-team.js";

const actor: Actor = {
  spaceId: "space-1",
  userId: "user-1",
  email: "fake@example.test",
  isDeploymentOwner: false,
};
const deps = { prisma: {}, jobs: {}, env: {} } as never;

const chief = { id: "chief-1", threadId: "t-1" } as never;

function steps(created: boolean) {
  const ensure = vi.fn(async () => ({
    botId: "chief-1",
    created,
    ...(created ? { bot: chief } : {}),
  }));
  const greet = vi.fn(async () => undefined);
  return { ensure, greet };
}

describe("startStarterTeam", () => {
  it("asks for the team in the person's language and has a new Chief greet them once", async () => {
    const s = steps(true);
    await expect(startStarterTeam(deps, actor, "pt-BR", s)).resolves.toEqual({
      botId: "chief-1",
      created: true,
    });
    expect(s.ensure).toHaveBeenCalledWith(expect.anything(), actor, "pt-BR");
    expect(s.greet).toHaveBeenCalledTimes(1);
    expect(s.greet).toHaveBeenCalledWith(deps, actor, chief);
  });

  it("starts nothing when the Chief was already there", async () => {
    const s = steps(false);
    await expect(startStarterTeam(deps, actor, "en", s)).resolves.toEqual({
      botId: "chief-1",
      created: false,
    });
    expect(s.greet).not.toHaveBeenCalled();
  });

  it("still returns the Chief when the greeting cannot be started", async () => {
    const s = steps(true);
    s.greet.mockRejectedValue(new Error("queue down"));
    await expect(startStarterTeam(deps, actor, "en", s)).resolves.toEqual({
      botId: "chief-1",
      created: true,
    });
  });
});

describe("chiefAsFirstAgent", () => {
  it("makes the Chief for the chat app the message came through, in English, and returns its id", async () => {
    const ensure = vi.fn(async () => ({ botId: "chief-1", created: true }));
    const firstAgent = chiefAsFirstAgent({} as never, ensure as never);
    const who = { ...actor, isDeploymentOwner: false as const };
    await expect(firstAgent({ actor: who, provider: "telegram", address: "42" })).resolves.toEqual({
      botId: "chief-1",
    });
    expect(ensure).toHaveBeenCalledWith(expect.anything(), who, "en", undefined, {
      channel: "telegram",
    });
  });

  it("lets a failure stop the account from being set up half-way", async () => {
    const ensure = vi.fn(async () => {
      throw new Error("down");
    });
    const firstAgent = chiefAsFirstAgent({} as never, ensure as never);
    await expect(
      firstAgent({
        actor: { ...actor, isDeploymentOwner: false },
        provider: "slack",
        address: "u1",
      }),
    ).rejects.toThrow("down");
  });
});
