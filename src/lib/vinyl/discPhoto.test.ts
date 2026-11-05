import { describe, expect, it } from "vitest";
import { detectDiscCircle } from "./discPhoto";

const SIZE = 128;

type Paint = (x: number, y: number) => number[];

function render(paint: Paint, width = SIZE, height = SIZE): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = paint(x, y);
      rgba.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  return rgba;
}

const PINK = [245, 205, 210];
const LABEL = [120, 90, 50];
const TABLE = [170, 140, 110];

function record(
  options: {
    centerX?: number;
    centerY?: number;
    radius?: number;
    labelRadius?: number;
    wax?: number[];
    background?: number[];
  } = {},
): Paint {
  const {
    centerX = 64,
    centerY = 64,
    radius = 60,
    labelRadius = 21,
    wax = PINK,
    background = TABLE,
  } = options;
  return (x, y) => {
    const distance = Math.hypot(x - centerX, y - centerY);
    if (distance <= labelRadius) return LABEL;
    return distance <= radius ? wax : background;
  };
}

describe("detectDiscCircle", () => {
  it("finds a record filling the frame, with an accurate spindle", () => {
    const disc = detectDiscCircle(render(record()), SIZE, SIZE);
    expect(disc).not.toBeNull();
    expect(disc!.centerX * SIZE).toBeCloseTo(64, -0.5);
    expect(disc!.centerY * SIZE).toBeCloseTo(64, -0.5);
    expect(disc!.radius * SIZE).toBeGreaterThan(58);
    expect(disc!.radius * SIZE).toBeLessThan(62);
    expect(disc!.labelRatio).toBeGreaterThan(0.31);
    expect(disc!.labelRatio).toBeLessThan(0.39);
  });

  it("finds an off-center record", () => {
    const disc = detectDiscCircle(
      render(record({ centerX: 72, centerY: 58, radius: 50, labelRadius: 18 })),
      SIZE,
      SIZE,
    );
    expect(disc!.centerX * SIZE).toBeCloseTo(72, -0.5);
    expect(disc!.centerY * SIZE).toBeCloseTo(58, -0.5);
  });

  it("finds a record whose rim is slightly out of frame", () => {
    const disc = detectDiscCircle(
      render(record({ radius: 66, labelRadius: 22 })),
      SIZE,
      SIZE,
    );
    expect(disc).not.toBeNull();
  });

  it("rejects a flat square cover", () => {
    const cover = render((x, y) =>
      x > 20 && x < 108 && y > 30 && y < 90 ? [200, 40, 40] : [20, 30, 60],
    );
    expect(detectDiscCircle(cover, SIZE, SIZE)).toBeNull();
  });

  it("rejects a single circle with no label, like a sun on a cover", () => {
    const sun = render((x, y) =>
      Math.hypot(x - 64, y - 64) <= 56 ? [240, 180, 40] : [20, 30, 60],
    );
    expect(detectDiscCircle(sun, SIZE, SIZE)).toBeNull();
  });

  it("rejects a record too small to fill the disc", () => {
    const small = render(record({ radius: 30, labelRadius: 10 }));
    expect(detectDiscCircle(small, SIZE, SIZE)).toBeNull();
  });

  it("rejects noise and solid color", () => {
    let seed = 7;
    const noise = render(() => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const v = seed % 256;
      return [v, (v * 7) % 256, (v * 13) % 256];
    });
    expect(detectDiscCircle(noise, SIZE, SIZE)).toBeNull();
    expect(detectDiscCircle(render(() => [90, 90, 90]), SIZE, SIZE)).toBeNull();
  });

  it("ignores images too small to analyze", () => {
    expect(detectDiscCircle(new Uint8ClampedArray(64), 4, 4)).toBeNull();
  });
});
