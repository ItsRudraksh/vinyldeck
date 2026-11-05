// src/lib/vinyl/discPhoto.ts
// Discogs does not say what an image shows, and many are photos of the record itself.
// Squeezed into the center label, such a photo becomes a tiny record inside the record,
// so it is recognized here: by default it fills the whole disc, cropped to its rim.
//
// A record is recognized by geometry and material: a large circular rim plus a smaller
// concentric circle at label size, with smooth wax between them. Busy covers have edges
// everywhere, so any circle "fits" them; requiring the wax to be smooth is what tells
// them apart. A miss only means the image starts on the center, and the user can move it.

/** Analysis resolution: enough to find the circles, cheap enough to run on a change. */
const ANALYSIS_SIZE = 128;
const RIM_ANGLES = 40;
const EDGE_SAMPLE_OFFSET = 1.5;
/** How far into the wax to check that it is smooth. */
const WAX_PROBE_DISTANCE = 4;
const EDGE_MIN_COLOR_DISTANCE = 18;

const MAX_CENTER_OFFSET_RATIO = 0.16;
const MIN_RIM_RADIUS_RATIO = 0.36;
const MAX_RIM_RADIUS_RATIO = 0.56;
const MIN_RIM_IN_FRAME = 0.5;
/** Edge coverage on the circle minus edge coverage in the wax beside it. */
const MIN_RIM_SCORE = 0.42;

/** A 12-inch LP's label is about a third of its diameter; 7 and 10 inch run larger. */
const MIN_LABEL_RATIO = 0.24;
const MAX_LABEL_RATIO = 0.5;
const MIN_LABEL_SCORE = 0.42;

/** Crops just inside the rim, so no background fringe spins around the edge. */
const RIM_CROP_RATIO = 0.985;
const MAX_SURFACE_SIZE = 1024;
const SURFACE_JPEG_QUALITY = 0.92;

export interface DiscCircle {
  /** Center and rim radius, as fractions of the image's width and height. */
  centerX: number;
  centerY: number;
  radius: number;
  /** Label radius as a fraction of the rim radius. */
  labelRatio: number;
}

interface PixelImage {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
}

function colorDistanceAt(
  image: PixelImage,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const a = (Math.round(ay) * image.width + Math.round(ax)) * 4;
  const b = (Math.round(by) * image.width + Math.round(bx)) * 4;
  const { rgba } = image;
  return (
    Math.abs(rgba[a] - rgba[b]) +
    Math.abs(rgba[a + 1] - rgba[b + 1]) +
    Math.abs(rgba[a + 2] - rgba[b + 2])
  );
}

/** Share of a circle's visible points that sit on a color edge, plus how much is visible. */
function circleEdgeScore(
  image: PixelImage,
  centerX: number,
  centerY: number,
  radius: number,
): { coverage: number; inFrame: number } {
  const maxX = image.width - 1;
  const maxY = image.height - 1;
  let visible = 0;
  let edges = 0;

  for (let step = 0; step < RIM_ANGLES; step += 1) {
    const angle = (step / RIM_ANGLES) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const inX = centerX + (radius - EDGE_SAMPLE_OFFSET) * cos;
    const inY = centerY + (radius - EDGE_SAMPLE_OFFSET) * sin;
    const outX = centerX + (radius + EDGE_SAMPLE_OFFSET) * cos;
    const outY = centerY + (radius + EDGE_SAMPLE_OFFSET) * sin;
    if (outX < 0 || outY < 0 || outX > maxX || outY > maxY) continue;

    visible += 1;
    if (
      colorDistanceAt(image, inX, inY, outX, outY) >= EDGE_MIN_COLOR_DISTANCE
    ) {
      edges += 1;
    }
  }

  return {
    coverage: visible === 0 ? 0 : edges / visible,
    inFrame: visible / RIM_ANGLES,
  };
}

/** A sharp circle with smooth wax on the side at `waxRadius` scores high; texture does not. */
function circleScore(
  image: PixelImage,
  centerX: number,
  centerY: number,
  radius: number,
  waxRadius: number,
): { score: number; inFrame: number } {
  const circle = circleEdgeScore(image, centerX, centerY, radius);
  const wax = circleEdgeScore(image, centerX, centerY, waxRadius);
  return { score: circle.coverage - wax.coverage, inFrame: circle.inFrame };
}

/** Finds a record in an image, or null when the image does not clearly show one. */
export function detectDiscCircle(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): DiscCircle | null {
  if (width < 16 || height < 16) return null;

  const image: PixelImage = { rgba, width, height };
  const shortSide = Math.min(width, height);
  const maxOffsetX = width * MAX_CENTER_OFFSET_RATIO;
  const maxOffsetY = height * MAX_CENTER_OFFSET_RATIO;
  const minRadius = shortSide * MIN_RIM_RADIUS_RATIO;
  const maxRadius = shortSide * MAX_RIM_RADIUS_RATIO;

  let best: { x: number; y: number; r: number; score: number } | null = null;

  const consider = (x: number, y: number, r: number) => {
    const { score, inFrame } = circleScore(
      image,
      x,
      y,
      r,
      r - WAX_PROBE_DISTANCE,
    );
    if (inFrame < MIN_RIM_IN_FRAME) return;
    if (!best || score > best.score) best = { x, y, r, score };
  };

  for (let dy = -maxOffsetY; dy <= maxOffsetY; dy += 4) {
    for (let dx = -maxOffsetX; dx <= maxOffsetX; dx += 4) {
      for (let r = minRadius; r <= maxRadius; r += 1) {
        consider(width / 2 + dx, height / 2 + dy, r);
      }
    }
  }
  if (!best) return null;

  // Refine: the disc spins around this point, so it has to be accurate.
  const coarse: { x: number; y: number; r: number } = best;
  for (let dy = -3; dy <= 3; dy += 1) {
    for (let dx = -3; dx <= 3; dx += 1) {
      for (let dr = -1.5; dr <= 1.5; dr += 0.5) {
        consider(coarse.x + dx, coarse.y + dy, coarse.r + dr);
      }
    }
  }

  const rim = best as { x: number; y: number; r: number; score: number };
  if (rim.score < MIN_RIM_SCORE) return null;

  let labelRatio = 0;
  let labelScore = -1;
  for (
    let ratio = MIN_LABEL_RATIO;
    ratio <= MAX_LABEL_RATIO;
    ratio += 1 / rim.r
  ) {
    const labelRadius = rim.r * ratio;
    const { score } = circleScore(
      image,
      rim.x,
      rim.y,
      labelRadius,
      labelRadius + WAX_PROBE_DISTANCE,
    );
    if (score > labelScore) {
      labelScore = score;
      labelRatio = ratio;
    }
  }
  if (labelScore < MIN_LABEL_SCORE) return null;

  return {
    centerX: rim.x / width,
    centerY: rim.y / height,
    radius: rim.r / width,
    labelRatio,
  };
}

/** Runs detection on an image at analysis resolution. */
export function findDiscInImage(image: HTMLImageElement): DiscCircle | null {
  const { naturalWidth, naturalHeight } = image;
  if (naturalWidth === 0 || naturalHeight === 0) return null;

  const scale = ANALYSIS_SIZE / Math.max(naturalWidth, naturalHeight);
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(image, 0, 0, width, height);
  return detectDiscCircle(
    context.getImageData(0, 0, width, height).data,
    width,
    height,
  );
}

/** Crops the record into a square centered on its spindle, ready to spin as the disc. */
export function cropDiscSurface(
  image: HTMLImageElement,
  disc: DiscCircle,
): string | null {
  const { naturalWidth, naturalHeight } = image;
  const radius = disc.radius * naturalWidth * RIM_CROP_RATIO;
  const centerX = disc.centerX * naturalWidth;
  const centerY = disc.centerY * naturalHeight;
  const size = Math.min(MAX_SURFACE_SIZE, Math.round(radius * 2));

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return null;

  // A rim slightly out of frame must not leave a hole: fill with the record's own color,
  // sampled from the groove area halfway between label and rim.
  const sample = document.createElement("canvas");
  sample.width = 1;
  sample.height = 1;
  const sampleContext = sample.getContext("2d");
  if (sampleContext) {
    const inset = radius * 0.7;
    sampleContext.drawImage(
      image,
      centerX + inset - radius * 0.05,
      centerY - radius * 0.05,
      radius * 0.1,
      radius * 0.1,
      0,
      0,
      1,
      1,
    );
    context.drawImage(sample, 0, 0, size, size);
  }

  context.drawImage(
    image,
    centerX - radius,
    centerY - radius,
    radius * 2,
    radius * 2,
    0,
    0,
    size,
    size,
  );
  return canvas.toDataURL("image/jpeg", SURFACE_JPEG_QUALITY);
}
