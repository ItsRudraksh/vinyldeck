import { describe, expect, it } from "vitest";
import {
  editionDetailLines,
  editionFormatFilters,
  editionHeading,
} from "./editions";
import type { AlbumEdition } from "./types";

function edition(overrides: Partial<AlbumEdition> = {}): AlbumEdition {
  return {
    releaseId: 1,
    title: "Positions",
    majorFormat: "Vinyl",
    format: "LP, Album",
    country: "US",
    year: "2021",
    label: "Republic Records",
    catno: "B0033223-01",
    name: null,
    ...overrides,
  };
}

describe("editionFormatFilters", () => {
  it("counts each format, in list order", () => {
    expect(
      editionFormatFilters([
        edition(),
        edition({ majorFormat: "CD" }),
        edition(),
        edition({ majorFormat: "" }),
      ]),
    ).toEqual([
      { format: "Vinyl", count: 2 },
      { format: "CD", count: 1 },
    ]);
  });
});

describe("editionHeading", () => {
  it("prefers the edition's own name", () => {
    expect(editionHeading(edition({ name: "Glow In The Dark" }))).toBe(
      "Glow In The Dark",
    );
  });

  it("falls back to what is known about it", () => {
    expect(editionHeading(edition())).toBe("LP, Album");
    expect(editionHeading(edition({ format: "" }))).toBe("Vinyl");
    expect(editionHeading(edition({ format: "", majorFormat: "" }))).toBe(
      "Positions",
    );
  });
});

describe("editionDetailLines", () => {
  it("does not repeat the format already used as the heading", () => {
    expect(editionDetailLines(edition(), "Positions")).toEqual([
      "Vinyl",
      "US · 2021 · B0033223-01",
    ]);
  });

  it("shows the format once the name is the heading", () => {
    expect(
      editionDetailLines(edition({ name: "Glow In The Dark" }), "Positions")[0],
    ).toBe("Vinyl · LP, Album");
  });

  it("shows a title that differs from the album's", () => {
    expect(
      editionDetailLines(edition({ title: "Positions (Deluxe)" }), "positions")[0],
    ).toBe("Positions (Deluxe)");
  });

  it("leaves out what is missing", () => {
    expect(
      editionDetailLines(
        edition({ country: "", year: "", catno: "" }),
        "Positions",
      ),
    ).toEqual(["Vinyl"]);
  });
});
