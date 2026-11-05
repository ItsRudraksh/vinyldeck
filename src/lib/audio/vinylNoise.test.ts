import { describe, expect, it } from "vitest";
import {
  createRandom,
  generateCrackle,
  generateHiss,
  volumeToGain,
} from "./vinylNoise";

const RATE = 8000;
const LENGTH = RATE * 4;

function peak(samples: Float32Array): number {
  return samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
}

function largestStep(samples: Float32Array, from: number, to: number): number {
  let largest = 0;
  for (let index = from; index < to; index += 1) {
    const next = samples[(index + 1) % samples.length];
    largest = Math.max(largest, Math.abs(next - samples[index]));
  }
  return largest;
}

describe("generateHiss", () => {
  const hiss = generateHiss(LENGTH, RATE, createRandom(1));

  it("is normalized and has the requested length", () => {
    expect(hiss).toHaveLength(LENGTH);
    expect(peak(hiss)).toBeCloseTo(1, 5);
  });

  it("loops without a click at the seam", () => {
    const seam = Math.abs(hiss[0] - hiss[LENGTH - 1]);
    const typical = largestStep(hiss, 1000, 3000);
    expect(seam).toBeLessThanOrEqual(typical);
  });
});

describe("generateCrackle", () => {
  const crackle = generateCrackle(LENGTH, RATE, createRandom(2));

  it("is normalized and has the requested length", () => {
    expect(crackle).toHaveLength(LENGTH);
    expect(peak(crackle)).toBeCloseTo(1, 5);
  });

  it("stays mostly quiet between clicks", () => {
    const quiet = crackle.filter((sample) => Math.abs(sample) < 0.01).length;
    expect(quiet / LENGTH).toBeGreaterThan(0.5);
  });

  it("has a few loud pops among many quiet ticks", () => {
    const loud = crackle.filter((sample) => Math.abs(sample) > 0.5).length;
    const audible = crackle.filter((sample) => Math.abs(sample) > 0.02).length;
    expect(loud).toBeGreaterThan(0);
    expect(loud).toBeLessThan(audible / 5);
  });
});

describe("generation is reproducible", () => {
  it("matches for one seed and differs across seeds", () => {
    const first = generateCrackle(RATE, RATE, createRandom(7));
    const same = generateCrackle(RATE, RATE, createRandom(7));
    const other = generateCrackle(RATE, RATE, createRandom(8));
    expect(same).toEqual(first);
    expect(other).not.toEqual(first);
  });
});

describe("volumeToGain", () => {
  it("is silent at zero and bounded at full volume", () => {
    expect(volumeToGain(0)).toBe(0);
    expect(volumeToGain(100)).toBeLessThanOrEqual(0.5);
    expect(volumeToGain(100)).toBeGreaterThan(0);
  });

  it("rises with the slider and clamps out-of-range values", () => {
    expect(volumeToGain(50)).toBeLessThan(volumeToGain(100) / 2);
    expect(volumeToGain(150)).toBe(volumeToGain(100));
    expect(volumeToGain(-5)).toBe(0);
  });
});
