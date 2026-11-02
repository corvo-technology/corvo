import { describe, expect, it, vi } from "vitest";
import { isBlockedAuthPath } from "./index.js";
import { LOCAL_OWNER_EMAIL, localTokenMatches, withCurrentOwnerEmail } from "./local-entry.js";

describe("localTokenMatches", () => {
  it("accepts only the exact token", () => {
    const token = "a".repeat(64);
    expect(localTokenMatches(token, token)).toBe(true);
    expect(localTokenMatches("b".repeat(64), token)).toBe(false);
    expect(localTokenMatches(token.slice(1), token)).toBe(false);
  });

  it("refuses when either side is empty, so an unset token opens nothing", () => {
    expect(localTokenMatches("", "")).toBe(false);
    expect(localTokenMatches("a".repeat(64), "")).toBe(false);
    expect(localTokenMatches("", "a".repeat(64))).toBe(false);
  });
});

describe("the public auth handler", () => {
  it("does not serve the local entry", () => {
    expect(isBlockedAuthPath("/local/enter")).toBe(true);
  });
});

describe("the local owner's address", () => {
  it("is a readable placeholder, not one that looks broken", () => {
    expect(LOCAL_OWNER_EMAIL).toBe("owner@local.me");
  });

  it("moves an owner created with the old placeholder to the current one", async () => {
    const updateUser = vi.fn(async (_id: string, data: { email: string }) => ({
      id: "u1",
      email: data.email,
    }));
    const user = { id: "u1", email: "owner@local.invalid", name: "" };
    const result = await withCurrentOwnerEmail({ updateUser }, user);
    expect(updateUser).toHaveBeenCalledWith("u1", { email: "owner@local.me" });
    expect(result.email).toBe("owner@local.me");
  });

  it("leaves any other address alone, including one the person set", async () => {
    const updateUser = vi.fn();
    const user = { id: "u1", email: "ana@example.com", name: "Ana" };
    expect(await withCurrentOwnerEmail({ updateUser }, user)).toBe(user);
    expect(updateUser).not.toHaveBeenCalled();
  });
});
