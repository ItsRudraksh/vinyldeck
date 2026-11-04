import { describe, expect, it } from "vitest";
import { placeArtwork } from "./prepareArtwork";

const cover = { labelSrc: "trimmed", surfaceSrc: "trimmed", discLabelRatio: null };
const recordPhoto = { labelSrc: "whole", surfaceSrc: "crop", discLabelRatio: 0.33 };

describe("placeArtwork", () => {
  it("automatically fills the disc only with a photo of a record", () => {
    expect(placeArtwork(cover, "auto")).toEqual({
      src: "trimmed",
      wholeDisc: false,
      discLabelRatio: null,
    });
    expect(placeArtwork(recordPhoto, "auto")).toEqual({
      src: "crop",
      wholeDisc: true,
      discLabelRatio: 0.33,
    });
  });

  it("puts a cover on the whole disc when asked", () => {
    expect(placeArtwork(cover, "disc")).toEqual({
      src: "trimmed",
      wholeDisc: true,
      discLabelRatio: null,
    });
  });

  it("puts a photo of a record on the center when asked", () => {
    expect(placeArtwork(recordPhoto, "center")).toEqual({
      src: "whole",
      wholeDisc: false,
      discLabelRatio: null,
    });
  });
});
