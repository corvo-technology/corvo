import { describe, expect, it, vi } from "vitest";
import { runPartnerCommand } from "./partner-command.js";

function deps() {
  return {
    createPartner: vi.fn(async (input: { slug: string; name: string }) => ({
      partner: { slug: input.slug, name: input.name },
      key: "cpk_FAKE.fake-secret",
    })),
    rotatePartnerKey: vi.fn(async (slug: string) => ({
      partner: { slug, name: "Acme" },
      key: "cpk_NEW.new-secret",
    })),
    setPartnerEnabled: vi.fn(async () => undefined),
  };
}

describe("partner command", () => {
  it("creates a partner and shows its key once, saying it cannot be shown again", async () => {
    const d = deps();
    const output = await runPartnerCommand(["create", "acme-saas", "Acme SaaS"], d);
    expect(d.createPartner).toHaveBeenCalledWith({ slug: "acme-saas", name: "Acme SaaS" });
    expect(output).toContain("cpk_FAKE.fake-secret");
    expect(output.toLowerCase()).toContain("will not be shown again");
  });

  it("rotates a key, and says the old one stopped working", async () => {
    const d = deps();
    const output = await runPartnerCommand(["rotate", "acme-saas"], d);
    expect(d.rotatePartnerKey).toHaveBeenCalledWith("acme-saas");
    expect(output).toContain("cpk_NEW.new-secret");
    expect(output.toLowerCase()).toContain("old key no longer works");
  });

  it("disables and enables a partner without printing any key", async () => {
    const d = deps();
    await expect(runPartnerCommand(["disable", "acme-saas"], d)).resolves.not.toContain("cpk_");
    await expect(runPartnerCommand(["enable", "acme-saas"], d)).resolves.not.toContain("cpk_");
    expect(d.setPartnerEnabled).toHaveBeenNthCalledWith(1, "acme-saas", false);
    expect(d.setPartnerEnabled).toHaveBeenNthCalledWith(2, "acme-saas", true);
  });

  it("refuses a missing or unknown command and a slug that is not safe, before touching anything", async () => {
    const d = deps();
    await expect(runPartnerCommand([], d)).rejects.toThrow(/usage/i);
    await expect(runPartnerCommand(["explode", "acme"], d)).rejects.toThrow(/usage/i);
    await expect(runPartnerCommand(["create", "Bad Slug!", "Acme"], d)).rejects.toThrow(/slug/i);
    await expect(runPartnerCommand(["create", "acme"], d)).rejects.toThrow(/usage/i);
    expect(d.createPartner).not.toHaveBeenCalled();
    expect(d.rotatePartnerKey).not.toHaveBeenCalled();
    expect(d.setPartnerEnabled).not.toHaveBeenCalled();
  });
});
