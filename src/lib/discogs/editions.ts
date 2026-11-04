// src/lib/discogs/editions.ts
// How an edition is described and filtered in the picker.

import type { AlbumEdition } from "./types";

export interface EditionFormatFilter {
  format: string;
  count: number;
}

/** In list order, which already puts vinyl first. Unknown formats get no filter. */
export function editionFormatFilters(
  editions: AlbumEdition[],
): EditionFormatFilter[] {
  const counts = new Map<string, number>();
  for (const { majorFormat } of editions) {
    if (majorFormat) counts.set(majorFormat, (counts.get(majorFormat) ?? 0) + 1);
  }
  return [...counts].map(([format, count]) => ({ format, count }));
}

/** Its own name when Discogs gives one, otherwise what kind of edition it is. */
export function editionHeading(edition: AlbumEdition): string {
  return (
    edition.name || edition.format || edition.majorFormat || edition.title
  );
}

export function editionDetailLines(
  edition: AlbumEdition,
  albumTitle: string,
): string[] {
  const kind = edition.name
    ? [edition.majorFormat, edition.format]
    : [edition.majorFormat];
  const lines = [
    joinParts(kind),
    joinParts([edition.country, edition.year, edition.catno]),
  ];
  // "Positions (Deluxe)" under "Positions" is a real difference worth showing.
  if (edition.title && !sameTitle(edition.title, albumTitle)) {
    lines.unshift(edition.title);
  }
  return lines.filter(Boolean);
}

function joinParts(parts: string[]): string {
  return parts.filter((part) => part.trim()).join(" · ");
}

function sameTitle(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
