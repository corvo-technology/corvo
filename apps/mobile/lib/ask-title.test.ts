import { describe, expect, it } from "vitest";
import { plainAskTitle } from "./ask-title.js";

describe("plainAskTitle", () => {
  it("shows a name the card title escaped for Markdown as typed", () => {
    expect(plainAskTitle("Change the model of my\\_bot?")).toBe("Change the model of my_bot?");
  });

  it("removes the escape from every character card titles escape, and only those", () => {
    expect(plainAskTitle("\\\\ \\` \\* \\_ \\[ \\] \\< \\> \\~ \\|")).toBe("\\ ` * _ [ ] < > ~ |");
    expect(plainAskTitle("Open C:\\temp\\# now")).toBe("Open C:\\temp\\# now");
  });
});

describe("plainAskTitle for an approval", () => {
  it("shows the raw tool name as words", () => {
    expect(plainAskTitle("Review before CANVA_CREATE_DESIGN_IMPORT_JOB")).toBe(
      "Review before Canva create design import job",
    );
  });
});
