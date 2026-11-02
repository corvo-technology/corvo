import { SkillStoreEntrySchema, STORE_CATEGORIES } from "@corvo/contracts";
import { describe, expect, it } from "vitest";
import { SKILL_STORE } from "./skill-store-data.js";

describe("SKILL_STORE", () => {
  it("has entries that parse, with unique slugs and unique names in each language", () => {
    expect(SKILL_STORE.length).toBeGreaterThan(0);
    for (const entry of SKILL_STORE) expect(() => SkillStoreEntrySchema.parse(entry)).not.toThrow();
    for (const pick of [
      (e: (typeof SKILL_STORE)[number]) => e.slug,
      (e: (typeof SKILL_STORE)[number]) => e.name.en,
      (e: (typeof SKILL_STORE)[number]) => e.name["pt-BR"],
    ]) {
      const values = SKILL_STORE.map((entry) => pick(entry).toLowerCase());
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it("has a Portuguese text that differs from the English one, for every text", () => {
    for (const entry of SKILL_STORE)
      for (const field of [entry.name, entry.description, entry.body])
        expect(field["pt-BR"]).not.toBe(field.en);
  });

  it("keeps names plain so the pickers match them as typed", () => {
    for (const entry of SKILL_STORE)
      for (const name of [entry.name.en, entry.name["pt-BR"]])
        expect(name).toMatch(/^[A-Za-z0-9 -]+$/);
  });

  it("keeps each description short enough for the / picker", () => {
    for (const entry of SKILL_STORE)
      for (const text of [entry.description.en, entry.description["pt-BR"]])
        expect(text.length).toBeLessThanOrEqual(90);
  });

  it("writes Portuguese bodies with their accents; only the names are plain", () => {
    for (const entry of SKILL_STORE) expect(entry.body["pt-BR"]).toMatch(/[À-ÿ]/);
  });

  it("has the money skills, each saying it only prepares the work and never acts on its own", () => {
    const money = [
      "cash-flow-forecast",
      "invoice-chase",
      "month-close",
      "monthly-result",
      "bank-reconciliation",
      "bills-to-pay",
      "payroll-prep",
      "tax-calendar",
      "pricing-margin",
      "expense-review",
    ];
    for (const slug of money) {
      const entry = SKILL_STORE.find((skill) => skill.slug === slug);
      expect(entry, slug).toBeDefined();
      expect(entry!.body.en, slug).toMatch(
        /\b(never|do not|not accounting advice|not tax advice|only read|not the official)\b/i,
      );
      expect(entry!.body["pt-BR"], slug).toMatch(/\b(nunca|não|nao)\b/i);
    }
  });

  it("has the marketing and design skills, none of which posts, spends or changes anything itself", () => {
    const slugs = [
      "content-calendar",
      "viral-ideas",
      "short-video-script",
      "social-post",
      "brand-voice",
      "content-strategy",
      "review-reply",
      "ad-review",
      "local-visibility",
      "campaign-plan",
      "growth-report",
      "design-critique",
      "interface-design",
      "ux-writing",
      "accessibility-check",
      "design-handoff",
      "brand-kit",
    ];
    for (const slug of slugs)
      expect(
        SKILL_STORE.find((skill) => skill.slug === slug),
        slug,
      ).toBeDefined();
    // The skills that could publish or spend say plainly that the owner does it.
    for (const slug of [
      "content-calendar",
      "viral-ideas",
      "short-video-script",
      "social-post",
      "review-reply",
      "ad-review",
      "campaign-plan",
    ]) {
      const entry = SKILL_STORE.find((skill) => skill.slug === slug)!;
      expect(entry.body.en, slug).toMatch(
        /owner[^.]*\b(publishes|posts|decides|approves|makes)\b|never (post|publish|change)/i,
      );
      expect(entry.body["pt-BR"], slug).toMatch(
        /dono[^.]*(publica|decide|aprova|faz)|nunca (publique|altere)|quem (publica|decide)/i,
      );
    }
  });

  it("has the management, sales and customer skills, which prepare and draft but never act", () => {
    const slugs = [
      "weekly-plan",
      "business-pulse",
      "restock-plan",
      "candidate-screening",
      "job-post",
      "vendor-review",
      "process-doc",
      "risk-check",
      "lead-triage",
      "sales-followup",
      "quote-builder",
      "support-faq",
      "inbox-triage",
      "goals-review",
    ];
    for (const slug of slugs)
      expect(
        SKILL_STORE.find((skill) => skill.slug === slug),
        slug,
      ).toBeDefined();
    // The ones that could send, buy or hire say that the owner does it.
    for (const slug of [
      "weekly-plan",
      "restock-plan",
      "candidate-screening",
      "job-post",
      "vendor-review",
      "lead-triage",
      "sales-followup",
      "quote-builder",
      "inbox-triage",
    ]) {
      const entry = SKILL_STORE.find((skill) => skill.slug === slug)!;
      expect(entry.body.en, slug).toMatch(
        /owner[^.]*\b(publish|send|sends|confirm|chooses|decides|reviews?)\b|never (send|place|accept|open)/i,
      );
      expect(entry.body["pt-BR"], slug).toMatch(
        /\b(publica|decide|escolhe|envia|confirma|revisa|aprova)\w*\b[^.]*\bdono\b|\bdono\b[^.]*\b(publica|decide|escolhe|envia|confirma|revisa|aprova|publicar|enviar|confirmar|revisar)|nunca (envie|faça|aceite|abra)/i,
      );
    }
  });

  it("puts every skill in a known category", () => {
    for (const entry of SKILL_STORE) expect(STORE_CATEGORIES, entry.slug).toContain(entry.category);
  });

  it("keeps the money skills together under finance and the design skills under design", () => {
    const category = (slug: string) => SKILL_STORE.find((skill) => skill.slug === slug)?.category;
    for (const slug of ["cash-flow-forecast", "tax-calendar", "payroll-prep", "month-close"])
      expect(category(slug), slug).toBe("finance");
    for (const slug of ["design-critique", "interface-design", "accessibility-check"])
      expect(category(slug), slug).toBe("design");
  });
});
