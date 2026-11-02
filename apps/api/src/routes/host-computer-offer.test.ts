import { describe, expect, it } from "vitest";
import { hostComputerOffer } from "./shared.js";

describe("hostComputerOffer", () => {
  it("keeps Docker and this Mac as the two choices of a Docker deployment", () => {
    expect(
      hostComputerOffer({
        provider: "docker",
        hostConnected: false,
        choiceEnabled: true,
        stored: null,
      }),
    ).toEqual({ computerHost: null, canChoose: true, provider: "docker" });
    expect(
      hostComputerOffer({
        provider: "docker",
        hostConnected: false,
        choiceEnabled: true,
        stored: "this-mac",
      }),
    ).toEqual({ computerHost: "this-mac", canChoose: true, provider: "docker" });
  });

  it("lets the desktop app's engine, which has no isolated computer, offer this Mac", () => {
    expect(
      hostComputerOffer({
        provider: "none",
        hostConnected: true,
        choiceEnabled: true,
        stored: null,
      }),
    ).toEqual({ computerHost: null, canChoose: true, provider: "none" });
  });

  it("reports computers as on once the person allowed this Mac, and ignores a Docker choice there", () => {
    expect(
      hostComputerOffer({
        provider: "none",
        hostConnected: true,
        choiceEnabled: true,
        stored: "this-mac",
      }),
    ).toEqual({ computerHost: "this-mac", canChoose: true, provider: "desktop" });
    expect(
      hostComputerOffer({
        provider: "none",
        hostConnected: true,
        choiceEnabled: true,
        stored: "docker",
      }),
    ).toEqual({ computerHost: null, canChoose: true, provider: "none" });
  });

  it("offers nothing without a connection to this computer or when the app does not manage the choice", () => {
    expect(
      hostComputerOffer({
        provider: "none",
        hostConnected: false,
        choiceEnabled: true,
        stored: "this-mac",
      }),
    ).toEqual({ computerHost: null, canChoose: false, provider: "none" });
    expect(
      hostComputerOffer({
        provider: "none",
        hostConnected: true,
        choiceEnabled: false,
        stored: null,
      }),
    ).toEqual({ computerHost: null, canChoose: false, provider: "none" });
    expect(
      hostComputerOffer({
        provider: "e2b",
        hostConnected: true,
        choiceEnabled: true,
        stored: "this-mac",
      }),
    ).toEqual({ computerHost: null, canChoose: false, provider: "e2b" });
  });

  it("treats the desktop provider as this Mac", () => {
    expect(
      hostComputerOffer({
        provider: "desktop",
        hostConnected: false,
        choiceEnabled: false,
        stored: null,
      }),
    ).toEqual({ computerHost: "this-mac", canChoose: false, provider: "desktop" });
  });
});
