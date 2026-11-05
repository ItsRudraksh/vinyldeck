import { describe, expect, it } from "vitest";
import { DEFAULT_ART_PLACEMENT } from "../discogs/types";
import { coverBox, fitZoomPercent, placementTransform } from "./artworkFit";

describe("coverBox", () => {
  it("makes a square image fill the area exactly", () => {
    expect(coverBox(1)).toEqual({ left: 0, top: 0, width: 100, height: 100 });
  });

  it("centers the overflow of a wide image", () => {
    expect(coverBox(2)).toEqual({ left: -50, top: 0, width: 200, height: 100 });
  });

  it("centers the overflow of a tall image", () => {
    expect(coverBox(0.5)).toEqual({ left: 0, top: -50, width: 100, height: 200 });
  });

  it("treats an unknown size as square", () => {
    expect(coverBox(0).width).toBe(100);
    expect(coverBox(Number.NaN).width).toBe(100);
  });
});

describe("fitZoomPercent", () => {
  it("fits a square inside the circle", () => {
    expect(fitZoomPercent(1)).toBe(70);
  });

  it("zooms out further for a non-square image", () => {
    expect(fitZoomPercent(1.5)).toBeLessThan(fitZoomPercent(1));
    expect(fitZoomPercent(2 / 3)).toBe(fitZoomPercent(1.5));
  });

  it("stays within the allowed range", () => {
    expect(fitZoomPercent(20)).toBe(50);
  });
});

describe("placementTransform", () => {
  it("leaves the default placement unchanged", () => {
    expect(placementTransform(DEFAULT_ART_PLACEMENT)).toBe(
      "translate(0%, 0%) scale(1)",
    );
  });

  it("applies offset and zoom", () => {
    expect(
      placementTransform({
        mode: "disc",
        zoomPercent: 150,
        offsetX: 10,
        offsetY: -5,
      }),
    ).toBe("translate(10%, -5%) scale(1.5)");
  });
});
