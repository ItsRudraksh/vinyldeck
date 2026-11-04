import { beforeEach, describe, expect, it } from "vitest";
import {
  albumIdentity,
  isAlbumArt,
  isAlbumEditions,
  isEditionDetails,
} from "./index";
import { artForAlbum, useAlbumArtStore } from "./store";
import { DEFAULT_ART_PLACEMENT } from "./types";
import type { AlbumArt } from "./types";

function art(overrides: Partial<AlbumArt> = {}): AlbumArt {
  return {
    key: "daft punk|discovery",
    status: "found",
    images: [
      { id: "a", kind: "primary", width: 600, height: 600, source: "Main" },
      { id: "b", kind: "secondary", width: 600, height: 600, source: "Main" },
    ],
    selectedImageId: "a",
    artworkDataUrl: "data:image/jpeg;base64,AAAA",
    placement: DEFAULT_ART_PLACEMENT,
    selectedReleaseId: null,
    retryAfterSeconds: null,
    ...overrides,
  };
}

describe("albumIdentity", () => {
  it("keeps every track of an album on one identity", () => {
    const base = albumIdentity("Daft Punk", "Random Access Memories");
    expect(base).toBe("daft punk|random access memories");
    expect(
      albumIdentity("Daft Punk, Pharrell Williams", "Random Access Memories"),
    ).toBe(base);
    expect(
      albumIdentity("DAFT PUNK feat. Nile Rodgers", "random access memories"),
    ).toBe(base);
  });

  it("folds accents and punctuation", () => {
    expect(albumIdentity("Björk", "Homogenic")).toBe("bjork|homogenic");
    expect(albumIdentity("Simon & Garfunkel", "Don't Stop!")).toBe(
      "simon and garfunkel|dont stop",
    );
  });

  it("separates different albums and rejects missing metadata", () => {
    expect(albumIdentity("Daft Punk", "Discovery")).not.toBe(
      albumIdentity("Daft Punk", "Homework"),
    );
    expect(albumIdentity("", "Discovery")).toBeNull();
    expect(albumIdentity("Daft Punk", "  ")).toBeNull();
  });
});

describe("isAlbumArt", () => {
  it("accepts the backend contract", () => {
    expect(isAlbumArt(art())).toBe(true);
    expect(
      isAlbumArt(
        art({
          status: "unavailable",
          images: [],
          selectedImageId: null,
          artworkDataUrl: null,
          retryAfterSeconds: 60,
        }),
      ),
    ).toBe(true);
  });

  it("rejects malformed payloads", () => {
    expect(isAlbumArt(null)).toBe(false);
    expect(isAlbumArt({ ...art(), status: "great" })).toBe(false);
    expect(isAlbumArt({ ...art(), images: [{ id: 1 }] })).toBe(false);
    expect(isAlbumArt({ ...art(), artworkDataUrl: 5 })).toBe(false);
    expect(isAlbumArt({ ...art(), placement: null })).toBe(false);
    expect(isAlbumArt({ ...art(), selectedReleaseId: "1" })).toBe(false);
    expect(
      isAlbumArt({
        ...art(),
        placement: { ...DEFAULT_ART_PLACEMENT, mode: "sideways" },
      }),
    ).toBe(false);
  });
});

describe("edition payloads", () => {
  const edition = {
    releaseId: 1,
    title: "Positions",
    majorFormat: "Vinyl",
    format: "LP",
    country: "US",
    year: "2021",
    label: "Republic",
    catno: "B1",
    name: null,
  };

  it("accepts the backend contract", () => {
    expect(isAlbumEditions({ editions: [edition], totalCount: 1 })).toBe(true);
    expect(
      isEditionDetails({
        name: "Glow In The Dark",
        images: art().images,
      }),
    ).toBe(true);
  });

  it("rejects malformed payloads", () => {
    expect(isAlbumEditions({ editions: [{ releaseId: "1" }], totalCount: 1 })).toBe(
      false,
    );
    expect(isAlbumEditions({ editions: [edition] })).toBe(false);
    expect(isEditionDetails({ name: 3, images: [] })).toBe(false);
    expect(isEditionDetails({ name: null, images: [{}] })).toBe(false);
  });
});

describe("album art store", () => {
  const discovery = "daft punk|discovery";
  const homework = "daft punk|homework";

  beforeEach(() => {
    useAlbumArtStore.setState({ identity: null, art: null });
  });

  it("drops a slow response for an album that is no longer playing", () => {
    const store = useAlbumArtStore.getState();
    store.setCurrentAlbum(discovery);
    store.setCurrentAlbum(homework);
    store.applyResolved(discovery, art());

    expect(useAlbumArtStore.getState().art).toBeNull();
  });

  it("clears art when the album changes but not within an album", () => {
    const store = useAlbumArtStore.getState();
    store.setCurrentAlbum(discovery);
    store.applyResolved(discovery, art());

    store.setCurrentAlbum(discovery);
    expect(useAlbumArtStore.getState().art).not.toBeNull();

    store.setCurrentAlbum(homework);
    expect(useAlbumArtStore.getState().art).toBeNull();
  });

  it("ignores pushed changes for other albums", () => {
    const store = useAlbumArtStore.getState();
    store.setCurrentAlbum(discovery);
    store.applyResolved(discovery, art());

    store.applyChange(art({ key: "other|album", selectedImageId: "z" }));
    expect(useAlbumArtStore.getState().art?.selectedImageId).toBe("a");

    store.applyChange(art({ selectedImageId: "b" }));
    expect(useAlbumArtStore.getState().art?.selectedImageId).toBe("b");
  });

  it("previews a selection immediately, keeping art if no preview exists", () => {
    const store = useAlbumArtStore.getState();
    store.setCurrentAlbum(discovery);
    store.applyResolved(discovery, art());

    store.previewSelection("b", "data:image/jpeg;base64,BBBB");
    expect(useAlbumArtStore.getState().art).toMatchObject({
      selectedImageId: "b",
      artworkDataUrl: "data:image/jpeg;base64,BBBB",
    });

    store.previewSelection("a", null);
    expect(useAlbumArtStore.getState().art).toMatchObject({
      selectedImageId: "a",
      artworkDataUrl: "data:image/jpeg;base64,BBBB",
    });
  });

  it("previews a placement, and a new selection starts from the default", () => {
    const store = useAlbumArtStore.getState();
    store.setCurrentAlbum(discovery);
    store.applyResolved(discovery, art());
    const placement = {
      mode: "disc",
      zoomPercent: 140,
      offsetX: 5,
      offsetY: -5,
    } as const;

    store.previewPlacement(placement);
    expect(useAlbumArtStore.getState().art?.placement).toEqual(placement);

    store.previewSelection("b", null);
    expect(useAlbumArtStore.getState().art?.placement).toEqual(
      DEFAULT_ART_PLACEMENT,
    );
  });

  it("never exposes art stored for a different album", () => {
    expect(artForAlbum(discovery, art(), homework)).toBeNull();
    expect(artForAlbum(discovery, art(), null)).toBeNull();
    expect(artForAlbum(discovery, art(), discovery)).not.toBeNull();
  });
});
