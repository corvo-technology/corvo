import { describe, expect, it } from "vitest";
import { partnerSessionExpired } from "./partner-tenants.js";

const HOUR = 60 * 60_000;
const now = new Date("2026-11-02T12:00:00Z");
const started = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * HOUR);

describe("partnerSessionExpired", () => {
  it("ends a partner customer's session eight hours after it began, however it was renewed", () => {
    const email = "p-0123456789abcdef01234567@partner.invalid";
    expect(partnerSessionExpired({ email, createdAt: started(7) }, now)).toBe(false);
    expect(partnerSessionExpired({ email, createdAt: started(9) }, now)).toBe(true);
  });

  it("leaves every other account's session alone", () => {
    expect(
      partnerSessionExpired({ email: "person@example.com", createdAt: started(500) }, now),
    ).toBe(false);
  });
});
