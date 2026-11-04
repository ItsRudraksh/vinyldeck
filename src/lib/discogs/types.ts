// src/lib/discogs/types.ts
// Mirrors the Rust `AlbumArt` IPC contract (src-tauri/src/discogs/mod.rs).

export type AlbumArtStatus =
  | "found"
  | "notFound"
  | "unconfigured"
  | "unavailable";

export interface AlbumArtImage {
  id: string;
  kind: string; // Discogs image type: "primary" | "secondary"
  width: number;
  height: number;
  source: string; // Which release it came from, e.g. "Vinyl · Columbia · 2013"
}

export type ArtMode = "auto" | "center" | "disc";

export interface ArtPlacement {
  mode: ArtMode;
  zoomPercent: number;
  offsetX: number;
  offsetY: number;
}

export const DEFAULT_ART_PLACEMENT: ArtPlacement = {
  mode: "auto",
  zoomPercent: 100,
  offsetX: 0,
  offsetY: 0,
};

export interface AlbumEdition {
  releaseId: number;
  title: string;
  majorFormat: string; // "Vinyl", "CD", "Cassette"...
  format: string; // "LP, Album, Limited Edition"
  country: string;
  year: string;
  label: string;
  catno: string;
  name: string | null; // "Glow In The Dark". Known once its details are fetched
}

export interface AlbumEditions {
  editions: AlbumEdition[];
  totalCount: number;
}

export interface EditionDetails {
  name: string | null;
  images: AlbumArtImage[];
}

export interface AlbumArt {
  key: string;
  status: AlbumArtStatus;
  images: AlbumArtImage[];
  selectedImageId: string | null;
  artworkDataUrl: string | null;
  placement: ArtPlacement;
  selectedReleaseId: number | null; // The edition the selected image came from
  retryAfterSeconds: number | null;
}
