// src/lib/discogs/index.ts
// Thin proxy over the backend Discogs service. The credential, HTTP calls and disk
// cache all live in Rust; WebViews only exchange album identities and data URLs.

import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  AlbumArt,
  AlbumArtImage,
  AlbumEdition,
  AlbumEditions,
  ArtPlacement,
  EditionDetails,
} from "./types";

const ART_CHANGED_EVENT = "discogs-art-changed";
const STATUSES = ["found", "notFound", "unconfigured", "unavailable"];
const ART_MODES = ["auto", "center", "disc"];
const ARTIST_SEPARATOR =
  /,|;| feat\.? | ft\.? | featuring | with | x | \/ | vs\.? /;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAlbumArtImage(value: unknown): value is AlbumArtImage {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.kind === "string" &&
    typeof value.width === "number" &&
    typeof value.height === "number" &&
    typeof value.source === "string"
  );
}

function isArtPlacement(value: unknown): value is ArtPlacement {
  return (
    isRecord(value) &&
    typeof value.mode === "string" &&
    ART_MODES.includes(value.mode) &&
    typeof value.zoomPercent === "number" &&
    typeof value.offsetX === "number" &&
    typeof value.offsetY === "number"
  );
}

export function isAlbumArt(value: unknown): value is AlbumArt {
  return (
    isRecord(value) &&
    typeof value.key === "string" &&
    typeof value.status === "string" &&
    STATUSES.includes(value.status) &&
    Array.isArray(value.images) &&
    value.images.every(isAlbumArtImage) &&
    (typeof value.selectedImageId === "string" ||
      value.selectedImageId === null) &&
    (typeof value.artworkDataUrl === "string" ||
      value.artworkDataUrl === null) &&
    isArtPlacement(value.placement) &&
    (typeof value.selectedReleaseId === "number" ||
      value.selectedReleaseId === null) &&
    (typeof value.retryAfterSeconds === "number" ||
      value.retryAfterSeconds === null)
  );
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isAlbumEdition(value: unknown): value is AlbumEdition {
  return (
    isRecord(value) &&
    typeof value.releaseId === "number" &&
    typeof value.title === "string" &&
    typeof value.majorFormat === "string" &&
    typeof value.format === "string" &&
    typeof value.country === "string" &&
    typeof value.year === "string" &&
    typeof value.label === "string" &&
    typeof value.catno === "string" &&
    isNullableString(value.name)
  );
}

export function isAlbumEditions(value: unknown): value is AlbumEditions {
  return (
    isRecord(value) &&
    Array.isArray(value.editions) &&
    value.editions.every(isAlbumEdition) &&
    typeof value.totalCount === "number"
  );
}

export function isEditionDetails(value: unknown): value is EditionDetails {
  return (
    isRecord(value) &&
    isNullableString(value.name) &&
    Array.isArray(value.images) &&
    value.images.every(isAlbumArtImage)
  );
}

function parseAlbumArt(payload: unknown): AlbumArt {
  if (!isAlbumArt(payload)) throw new Error("Invalid album art payload");
  return payload;
}

/**
 * Identifies "the same album" across tracks, so moving between songs of one album
 * causes no flicker and no lookup. Null when artist or album is missing.
 *
 * Only decides when to ask the backend again; the backend's own `key` stays the
 * authority for caching, so a disagreement costs one cheap cached lookup at most.
 */
export function albumIdentity(artist: string, album: string): string | null {
  const primaryArtist = artist.toLowerCase().split(ARTIST_SEPARATOR)[0];
  const normalizedArtist = normalizeIdentityPart(primaryArtist);
  const normalizedAlbum = normalizeIdentityPart(album);
  if (!normalizedArtist || !normalizedAlbum) return null;
  return `${normalizedArtist}|${normalizedAlbum}`;
}

function normalizeIdentityPart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function isAlbumArtAvailable(): boolean {
  return isTauri();
}

export async function resolveAlbumArt(
  artist: string,
  album: string,
): Promise<AlbumArt> {
  return parseAlbumArt(
    await invoke<unknown>("cmd_discogs_resolve", { artist, album }),
  );
}

export async function selectAlbumArt(
  key: string,
  imageId: string,
): Promise<AlbumArt> {
  return parseAlbumArt(
    await invoke<unknown>("cmd_discogs_select", { key, imageId }),
  );
}

export async function setAlbumArtPlacement(
  key: string,
  imageId: string,
  placement: ArtPlacement,
): Promise<AlbumArt> {
  return parseAlbumArt(
    await invoke<unknown>("cmd_discogs_set_placement", {
      key,
      imageId,
      placement,
    }),
  );
}

export async function fetchAlbumEditions(key: string): Promise<AlbumEditions> {
  const editions = await invoke<unknown>("cmd_discogs_editions", { key });
  if (!isAlbumEditions(editions)) throw new Error("Invalid editions payload");
  return editions;
}

/**
 * Null only for a `background` request, when the backend is saving its API budget.
 * Ask again later; a request the user made directly is never held back.
 */
export async function fetchEditionDetails(
  key: string,
  releaseId: number,
  background: boolean,
): Promise<EditionDetails | null> {
  const details = await invoke<unknown>("cmd_discogs_edition_details", {
    key,
    releaseId,
    background,
  });
  if (details === null) return null;
  if (!isEditionDetails(details)) throw new Error("Invalid edition payload");
  return details;
}

export async function fetchEditionThumbnail(
  key: string,
  releaseId: number,
): Promise<string | null> {
  const thumbnail = await invoke<unknown>("cmd_discogs_edition_thumbnail", {
    key,
    releaseId,
  });
  return typeof thumbnail === "string" ? thumbnail : null;
}

export async function fetchAlbumArtThumbnail(
  key: string,
  imageId: string,
): Promise<string | null> {
  const thumbnail = await invoke<unknown>("cmd_discogs_thumbnail", {
    key,
    imageId,
  });
  return typeof thumbnail === "string" ? thumbnail : null;
}

/** Selections made in any window reach every window through this event. */
export async function subscribeToAlbumArtChanges(
  listener: (art: AlbumArt) => void,
): Promise<() => void> {
  return listen<unknown>(ART_CHANGED_EVENT, ({ payload }) => {
    if (isAlbumArt(payload)) {
      listener(payload);
    } else {
      console.warn("[Discogs] Ignored malformed art event");
    }
  });
}
