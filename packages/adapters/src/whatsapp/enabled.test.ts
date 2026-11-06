import { describe, expect, it } from "vitest";
import { linkedWhatsAppEnabled } from "./enabled.js";

describe("linkedWhatsAppEnabled", () => {
  it("is on in the desktop app's own engine", () => {
    expect(linkedWhatsAppEnabled({ desktopStackToken: "token" })).toBe(true);
  });

  it("is on where the operator turns it on", () => {
    expect(linkedWhatsAppEnabled({ operatorSwitch: true })).toBe(true);
  });

  it("is off on a server with neither, so no number can be linked and no socket opens", () => {
    expect(linkedWhatsAppEnabled({})).toBe(false);
    expect(linkedWhatsAppEnabled({ desktopStackToken: "", operatorSwitch: false })).toBe(false);
  });
});
