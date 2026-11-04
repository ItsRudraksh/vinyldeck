// src/lib/vinyl/artworkTrim.ts
// Player thumbnails and Discogs scans often carry a white margin around the art.
// On a circular label that margin reads as a white-edged square, so it is removed
// before the image reaches the record.

const WHITE_MIN_CHANNEL = 232;
/** A row or column counts as margin when nearly all of it is white (JPEG noise). */
const MARGIN_LINE_WHITE_RATIO = 0.97;
/** Below this, the "margin" is the design: a white cover with a small logo stays whole. */
const MIN_CONTENT_RATIO = 0.4;
/** Extra crop past the margin, to drop the soft transition compression leaves there. */
const EDGE_INSET_RATIO = 0.01;
const TRIMMED_JPEG_QUALITY = 0.92;

export interface ContentBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Bounds of the art inside its white margin, or null if there is nothing to trim. */
export function findContentBounds(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): ContentBounds | null {
  if (width <= 0 || height <= 0) return null;

  const isWhite = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    return (
      rgba[index] >= WHITE_MIN_CHANNEL &&
      rgba[index + 1] >= WHITE_MIN_CHANNEL &&
      rgba[index + 2] >= WHITE_MIN_CHANNEL
    );
  };
  const rowIsMargin = (y: number) => {
    let white = 0;
    for (let x = 0; x < width; x += 1) if (isWhite(x, y)) white += 1;
    return white / width >= MARGIN_LINE_WHITE_RATIO;
  };
  const columnIsMargin = (x: number) => {
    let white = 0;
    for (let y = 0; y < height; y += 1) if (isWhite(x, y)) white += 1;
    return white / height >= MARGIN_LINE_WHITE_RATIO;
  };

  let top = 0;
  while (top < height && rowIsMargin(top)) top += 1;
  if (top === height) return null; // Entirely white: that is the artwork.

  let bottom = height - 1;
  while (bottom > top && rowIsMargin(bottom)) bottom -= 1;
  let left = 0;
  while (left < width - 1 && columnIsMargin(left)) left += 1;
  let right = width - 1;
  while (right > left && columnIsMargin(right)) right -= 1;

  const hasMargin =
    top > 0 || left > 0 || bottom < height - 1 || right < width - 1;
  if (!hasMargin) return null;

  const contentWidth = right - left + 1;
  const contentHeight = bottom - top + 1;
  if (
    contentWidth / width < MIN_CONTENT_RATIO ||
    contentHeight / height < MIN_CONTENT_RATIO
  ) {
    return null;
  }

  const insetX = left > 0 || right < width - 1 ? Math.round(contentWidth * EDGE_INSET_RATIO) : 0;
  const insetY = top > 0 || bottom < height - 1 ? Math.round(contentHeight * EDGE_INSET_RATIO) : 0;
  return {
    x: left + insetX,
    y: top + insetY,
    width: contentWidth - insetX * 2,
    height: contentHeight - insetY * 2,
  };
}

/** Returns a trimmed copy of a decoded image, or `src` itself when no trim applies. */
export function trimArtworkMargins(image: HTMLImageElement, src: string): string {
  const { naturalWidth: width, naturalHeight: height } = image;
  if (width === 0 || height === 0) return src;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return src;
    context.drawImage(image, 0, 0);

    const bounds = findContentBounds(
      context.getImageData(0, 0, width, height).data,
      width,
      height,
    );
    if (!bounds) return src;

    const trimmed = document.createElement("canvas");
    trimmed.width = bounds.width;
    trimmed.height = bounds.height;
    trimmed
      .getContext("2d")
      ?.drawImage(
        canvas,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        0,
        0,
        bounds.width,
        bounds.height,
      );
    return trimmed.toDataURL("image/jpeg", TRIMMED_JPEG_QUALITY);
  } catch (error) {
    // Showing the original beats showing nothing.
    console.warn("[VinylDeck] Artwork trim failed:", error);
    return src;
  }
}
