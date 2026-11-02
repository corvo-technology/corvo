import type { CorvoDesktop } from "@corvo/contracts";
import { describe, expect, it, vi } from "vitest";
import { chooseHostComputer } from "./host-computer";

function desktop(requestAccess: boolean, managesHostChoice = true) {
  const computer = {
    managesHostChoice,
    requestAccess: vi.fn().mockResolvedValue(requestAccess),
    revokeAccess: vi.fn().mockResolvedValue(undefined),
  };
  return { computer, bridge: { computer } as unknown as CorvoDesktop };
}

describe("chooseHostComputer", () => {
  it("saves this-mac only when the native prompt is accepted", async () => {
    const accepted = desktop(true);
    await expect(chooseHostComputer(accepted.bridge, "this-mac")).resolves.toBe(true);
    const declined = desktop(false);
    await expect(chooseHostComputer(declined.bridge, "this-mac")).resolves.toBe(false);
  });

  it("revokes local access when Docker is chosen", async () => {
    const { bridge, computer } = desktop(true);
    await expect(chooseHostComputer(bridge, "docker")).resolves.toBe(true);
    expect(computer.revokeAccess).toHaveBeenCalledOnce();
    expect(computer.requestAccess).not.toHaveBeenCalled();
  });

  it("asks for the latest desktop app when the choice is not managed", async () => {
    const { bridge } = desktop(true, false);
    await expect(chooseHostComputer(bridge, "docker")).rejects.toThrow(
      "Local computer access requires the latest desktop app.",
    );
    await expect(chooseHostComputer(undefined, "docker")).rejects.toThrow(
      "Local computer access requires the latest desktop app.",
    );
  });
});
