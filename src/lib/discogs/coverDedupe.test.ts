import { describe, expect, it } from "vitest";
import { differenceHash, hashDistance, uniqueCoverIds } from "./coverDedupe";

const SIZE = 72; // 9 x 8 grayscale pixels.

function gradient(): number[] {
  return Array.from({ length: SIZE }, (_, index) => (index % 9) * 20);
}

function flip(hash: string, bits: number): string {
  return hash
    .split("")
    .map((bit, index) => (index < bits ? (bit === "1" ? "0" : "1") : bit))
    .join("");
}

const BASE = "0".repeat(64);

describe("differenceHash", () => {
  it("produces 64 bits that depend on brightness direction", () => {
    const rising = differenceHash(gradient());
    const falling = differenceHash(gradient().map((value) => 255 - value));
    expect(rising).toBe("0".repeat(64));
    expect(falling).toBe("1".repeat(64));
  });

  it("ignores uniform brightness changes, like a lighter scan", () => {
    const lighter = gradient().map((value) => value + 40);
    expect(hashDistance(differenceHash(gradient()), differenceHash(lighter))).toBe(0);
  });
});

describe("uniqueCoverIds", () => {
  it("keeps the first of each look-alike group", () => {
    const visible = uniqueCoverIds(
      ["a", "b", "c"],
      { a: BASE, b: flip(BASE, 5), c: flip(BASE, 40) },
      null,
    );
    expect([...visible]).toEqual(["a", "c"]);
  });

  it("keeps covers that have no fingerprint yet", () => {
    const visible = uniqueCoverIds(["a", "b"], { a: BASE }, null);
    expect([...visible]).toEqual(["a", "b"]);
  });

  it("never hides the selected cover, even when it is a repeat", () => {
    const visible = uniqueCoverIds(
      ["a", "b"],
      { a: BASE, b: flip(BASE, 2) },
      "b",
    );
    expect([...visible]).toEqual(["a", "b"]);
  });
});
