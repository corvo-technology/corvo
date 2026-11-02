import { describe, expect, it } from "vitest";
import {
  generatePartnerKey,
  hashPartnerKey,
  partnerKeyPrefix,
  verifyPartnerKey,
} from "./partner-key.js";

describe("partner keys", () => {
  it("makes a key that verifies against the hash it was stored as", () => {
    const { key, hash } = generatePartnerKey();
    expect(verifyPartnerKey(key, hash)).toBe(true);
  });

  it("never stores or returns the key inside its hash or prefix", () => {
    const { key, hash, prefix } = generatePartnerKey();
    expect(hash).not.toContain(key);
    expect(key).toContain(prefix);
    expect(prefix.length).toBeLessThan(key.length / 2);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("makes a different key every time", () => {
    const first = generatePartnerKey();
    const second = generatePartnerKey();
    expect(first.key).not.toBe(second.key);
    expect(first.prefix).not.toBe(second.prefix);
    expect(first.hash).not.toBe(second.hash);
  });

  it("hashes the same key to the same value", () => {
    const { key, hash } = generatePartnerKey();
    expect(hashPartnerKey(key)).toBe(hash);
  });

  it("refuses a wrong key, a key cut short, an empty key and a hash that is not a hash", () => {
    const { key, hash } = generatePartnerKey();
    const other = generatePartnerKey().key;
    expect(verifyPartnerKey(other, hash)).toBe(false);
    expect(verifyPartnerKey(key.slice(0, -1), hash)).toBe(false);
    expect(verifyPartnerKey(`${key}x`, hash)).toBe(false);
    expect(verifyPartnerKey("", hash)).toBe(false);
    expect(verifyPartnerKey(key, "")).toBe(false);
    expect(verifyPartnerKey(key, "not-a-hash")).toBe(false);
  });

  it("finds the prefix of a well-formed key, and nothing in anything else", () => {
    const { key, prefix } = generatePartnerKey();
    expect(partnerKeyPrefix(key)).toBe(prefix);
    expect(partnerKeyPrefix("")).toBeNull();
    expect(partnerKeyPrefix("Bearer nonsense")).toBeNull();
    expect(partnerKeyPrefix(`${"a".repeat(400)}`)).toBeNull();
  });
});
