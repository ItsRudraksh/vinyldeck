import { describe, expect, it } from "vitest";
import { findContentBounds } from "./artworkTrim";

const WHITE = [255, 255, 255];
const ART = [30, 60, 120];

/** Builds an image: `paint` decides each pixel's color. */
function image(
  width: number,
  height: number,
  paint: (x: number, y: number) => number[],
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = paint(x, y);
      rgba.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  return rgba;
}

function framed(
  width: number,
  height: number,
  box: { left: number; top: number; right: number; bottom: number },
): Uint8ClampedArray {
  return image(width, height, (x, y) =>
    x >= box.left && x <= box.right && y >= box.top && y <= box.bottom
      ? ART
      : WHITE,
  );
}

describe("findContentBounds", () => {
  it("removes a white margin on all sides", () => {
    const bounds = findContentBounds(
      framed(100, 100, { left: 20, top: 20, right: 79, bottom: 79 }),
      100,
      100,
    );
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(20);
    expect(bounds!.y).toBeGreaterThanOrEqual(20);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(80);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(80);
    expect(bounds!.width).toBeGreaterThanOrEqual(56);
  });

  it("removes side bars from a wide thumbnail", () => {
    const bounds = findContentBounds(
      framed(160, 90, { left: 35, top: 0, right: 124, bottom: 89 }),
      160,
      90,
    );
    expect(bounds).toMatchObject({ y: 0, height: 90 });
    expect(bounds!.x).toBeGreaterThanOrEqual(35);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(125);
  });

  it("tolerates compression noise inside the margin", () => {
    const noisy = image(100, 100, (x, y) => {
      if (x >= 20 && x < 80 && y >= 20 && y < 80) return ART;
      return (x * 7 + y * 13) % 97 === 0 ? [200, 200, 200] : [250, 252, 248];
    });
    expect(findContentBounds(noisy, 100, 100)?.x).toBeGreaterThanOrEqual(20);
  });

  it("leaves artwork without a margin untouched", () => {
    expect(
      findContentBounds(image(50, 50, () => ART), 50, 50),
    ).toBeNull();
  });

  it("keeps white inside the art when the edges are not all white", () => {
    const whiteCenter = image(100, 100, (x, y) =>
      x > 10 && x < 90 && y > 10 && y < 90 ? WHITE : ART,
    );
    expect(findContentBounds(whiteCenter, 100, 100)).toBeNull();
  });

  it("does not treat a fully white cover as a margin", () => {
    expect(
      findContentBounds(image(50, 50, () => WHITE), 50, 50),
    ).toBeNull();
  });

  it("does not zoom into a small logo on a white cover", () => {
    expect(
      findContentBounds(
        framed(100, 100, { left: 40, top: 40, right: 59, bottom: 59 }),
        100,
        100,
      ),
    ).toBeNull();
  });

  it("does not treat black bars as a margin", () => {
    const blackBars = image(100, 100, (_x, y) =>
      y < 15 || y >= 85 ? [0, 0, 0] : ART,
    );
    expect(findContentBounds(blackBars, 100, 100)).toBeNull();
  });
});
