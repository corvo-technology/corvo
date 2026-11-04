import { describe, expect, it } from "vitest";
import { fieldChanges } from "./ticket-fields";

describe("fieldChanges", () => {
  const current = [
    { name: "Contact", value: "ana@example.com" },
    { name: "Source", value: "Fair" },
  ];

  it("sends nothing when the rows did not change", () => {
    expect(fieldChanges(current, current)).toEqual({});
  });

  it("sends a changed or added value, and an empty value for a removed row", () => {
    const rows = [
      { name: "Contact", value: "bo@example.com" },
      { name: "City", value: "Lisbon" },
    ];
    expect(fieldChanges(current, rows)).toEqual({
      Contact: "bo@example.com",
      City: "Lisbon",
      Source: "",
    });
  });

  it("ignores a row with no name or no value yet", () => {
    expect(
      fieldChanges(current, [...current, { name: "", value: "x" }, { name: "Note", value: "" }]),
    ).toEqual({});
  });
});
