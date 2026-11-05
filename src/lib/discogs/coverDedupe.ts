// src/lib/discogs/coverDedupe.ts
// Most versions of an album share one cover, and Discogs gives each its own URL, so
// repeats can only be told apart by how they look. A difference hash fingerprints the
// coarse picture and tolerates the scan-to-scan variation of the same printed cover.

const HASH_WIDTH = 9;
const HASH_HEIGHT = 8;
/** Out of 64 bits. Calibrated against real Discogs thumbnails. */
const SAME_COVER_MAX_DISTANCE = 12;

/** One bit per horizontally adjacent pixel pair: is the left one brighter? */
export function differenceHash(grayscale: ArrayLike<number>): string {
  let bits = "";
  for (let y = 0; y < HASH_HEIGHT; y += 1) {
    for (let x = 0; x < HASH_WIDTH - 1; x += 1) {
      const left = grayscale[y * HASH_WIDTH + x];
      const right = grayscale[y * HASH_WIDTH + x + 1];
      bits += left > right ? "1" : "0";
    }
  }
  return bits;
}

export function hashDistance(a: string, b: string): number {
  let distance = 0;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) distance += 1;
  }
  return distance;
}

/**
 * Ids to show, in order: the first of each look-alike group, plus the selected cover
 * so the current choice never vanishes. Covers without a hash yet stay visible.
 */
export function uniqueCoverIds(
  ids: string[],
  hashes: Record<string, string>,
  selectedId: string | null,
): Set<string> {
  const visible = new Set<string>();
  const seenHashes: string[] = [];

  for (const id of ids) {
    const hash = hashes[id];
    if (!hash) {
      visible.add(id);
      continue;
    }
    const isRepeat = seenHashes.some(
      (seen) => hashDistance(seen, hash) <= SAME_COVER_MAX_DISTANCE,
    );
    if (!isRepeat) {
      seenHashes.push(hash);
      visible.add(id);
    } else if (id === selectedId) {
      visible.add(id);
    }
  }
  return visible;
}

export async function hashThumbnail(dataUrl: string): Promise<string | null> {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.width = HASH_WIDTH;
  canvas.height = HASH_HEIGHT;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(image, 0, 0, HASH_WIDTH, HASH_HEIGHT);
  const { data } = context.getImageData(0, 0, HASH_WIDTH, HASH_HEIGHT);
  const grayscale = new Array<number>(HASH_WIDTH * HASH_HEIGHT);
  for (let index = 0; index < grayscale.length; index += 1) {
    const offset = index * 4;
    grayscale[index] =
      data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
  }
  return differenceHash(grayscale);
}
