// src/components/ArtworkPicker/EditionBrowser.tsx
// Every edition on the album's Discogs page, and the images of each. A name such as
// "Glow In The Dark" takes one API request per edition, so names are asked for only
// as rows come into view, and the backend holds back when its budget runs low.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  fetchAlbumEditions,
  fetchEditionDetails,
  fetchEditionThumbnail,
} from "../../lib/discogs";
import {
  editionDetailLines,
  editionFormatFilters,
  editionHeading,
} from "../../lib/discogs/editions";
import type {
  AlbumArt,
  AlbumArtImage,
  AlbumEdition,
  AlbumEditions,
  EditionDetails,
} from "../../lib/discogs/types";
import { useAlbumThumbnails } from "./useAlbumThumbnails";
import type { ThumbnailState } from "./useAlbumThumbnails";

const NAME_RETRY_MS = 20_000;

type Loaded<T> =
  | { state: "loading" }
  | { state: "failed" }
  | { state: "ready"; value: T };

export type RenderTile = (
  image: AlbumArtImage,
  index: number,
  thumbnails: Record<string, ThumbnailState>,
) => ReactNode;

interface EditionBrowserProps {
  art: AlbumArt;
  album: string;
  renderTile: RenderTile;
  onBack(): void;
}

export function EditionBrowser({
  art,
  album,
  renderTile,
  onBack,
}: EditionBrowserProps) {
  const [list, setList] = useState<Loaded<AlbumEditions>>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<string | null>(null);
  const [opened, setOpened] = useState<AlbumEdition | null>(null);
  // Names learned while browsing, so going back shows them without asking again.
  const [names, setNames] = useState<Record<number, string>>({});

  useEffect(() => {
    let cancelled = false;
    setList({ state: "loading" });
    fetchAlbumEditions(art.key)
      .then((value) => {
        if (!cancelled) setList({ state: "ready", value });
      })
      .catch((reason) => {
        console.warn("[Discogs] Editions failed to load:", reason);
        if (!cancelled) setList({ state: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [art.key, attempt]);

  const learnName = useCallback((releaseId: number, name: string) => {
    setNames((current) => ({ ...current, [releaseId]: name }));
  }, []);

  const withName = (edition: AlbumEdition): AlbumEdition => ({
    ...edition,
    name: edition.name ?? names[edition.releaseId] ?? null,
  });

  const editions = list.state === "ready" ? list.value.editions : [];
  const filters = editionFormatFilters(editions);
  const visible = filter
    ? editions.filter((edition) => edition.majorFormat === filter)
    : editions;
  const totalCount = list.state === "ready" ? list.value.totalCount : 0;

  return (
    <div className="artwork-editions">
      {opened && (
        <EditionImages
          art={art}
          album={album}
          edition={withName(opened)}
          renderTile={renderTile}
          onLearnName={learnName}
          onBack={() => setOpened(null)}
        />
      )}

      {/* Stays mounted while an edition is open, to keep its filter and scroll position. */}
      <div className="artwork-editions__list-view" hidden={opened !== null}>
        <button
          type="button"
          className="artwork-editions__back"
          onClick={onBack}
        >
          ‹ Images
        </button>

        {list.state === "loading" && (
          <p className="artwork-editions__message" role="status">
            Loading editions…
          </p>
        )}

        {list.state === "failed" && (
          <div className="artwork-editions__message" role="alert">
            <p>Editions can't be loaded right now.</p>
            <button
              type="button"
              className="artwork-placement__action"
              onClick={() => setAttempt((current) => current + 1)}
            >
              Try again
            </button>
          </div>
        )}

        {list.state === "ready" && editions.length === 0 && (
          <p className="artwork-editions__message">
            Discogs lists no editions for this album.
          </p>
        )}

        {filters.length > 1 && (
          <div
            className="artwork-editions__filters"
            role="group"
            aria-label="Filter editions by format"
          >
            <FilterChip
              label={`All ${editions.length}`}
              isActive={filter === null}
              onClick={() => setFilter(null)}
            />
            {filters.map(({ format, count }) => (
              <FilterChip
                key={format}
                label={`${format} ${count}`}
                isActive={filter === format}
                onClick={() => setFilter(format)}
              />
            ))}
          </div>
        )}

        {visible.length > 0 && (
          <ul className="artwork-editions__list">
            {visible.map((edition) => (
              <EditionRow
                key={edition.releaseId}
                albumKey={art.key}
                album={album}
                edition={withName(edition)}
                isSelected={art.selectedReleaseId === edition.releaseId}
                onLearnName={learnName}
                onOpen={() => setOpened(edition)}
              />
            ))}
          </ul>
        )}

        {totalCount > editions.length && (
          <p className="artwork-editions__note">
            Showing the first {editions.length} of {totalCount}.
          </p>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      className={`artwork-editions__filter${isActive ? " artwork-editions__filter--active" : ""}`}
      aria-pressed={isActive}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function EditionRow({
  albumKey,
  album,
  edition,
  isSelected,
  onLearnName,
  onOpen,
}: {
  albumKey: string;
  album: string;
  edition: AlbumEdition;
  isSelected: boolean;
  onLearnName(releaseId: number, name: string): void;
  onOpen(): void;
}) {
  const rowRef = useRef<HTMLLIElement>(null);
  const [isOnScreen, setIsOnScreen] = useState(false);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [needsName, setNeedsName] = useState(edition.name === null);
  const releaseId = edition.releaseId;

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const observer = new IntersectionObserver(([entry]) =>
      setIsOnScreen(entry.isIntersecting),
    );
    observer.observe(row);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isOnScreen || thumbnail) return;
    let cancelled = false;
    fetchEditionThumbnail(albumKey, releaseId)
      .then((value) => {
        if (!cancelled && value) setThumbnail(value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [albumKey, isOnScreen, releaseId, thumbnail]);

  useEffect(() => {
    if (!isOnScreen || !needsName) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    function ask() {
      fetchEditionDetails(albumKey, releaseId, true)
        .then((details) => {
          if (cancelled) return;
          if (!details) {
            retryTimer = setTimeout(ask, NAME_RETRY_MS);
            return;
          }
          setNeedsName(false);
          if (details.name) onLearnName(releaseId, details.name);
        })
        .catch(() => {
          if (!cancelled) retryTimer = setTimeout(ask, NAME_RETRY_MS);
        });
    }
    ask();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [albumKey, isOnScreen, needsName, onLearnName, releaseId]);

  return (
    <li ref={rowRef}>
      <button
        type="button"
        data-release-id={releaseId}
        className={`artwork-editions__row${isSelected ? " artwork-editions__row--selected" : ""}`}
        aria-current={isSelected ? "true" : undefined}
        onClick={onOpen}
      >
        <span className="artwork-editions__thumb">
          {thumbnail && <img src={thumbnail} alt="" draggable={false} />}
        </span>
        <span className="artwork-editions__text">
          <strong>{editionHeading(edition)}</strong>
          {editionDetailLines(edition, album).map((line) => (
            <small key={line}>{line}</small>
          ))}
        </span>
      </button>
    </li>
  );
}

function EditionImages({
  art,
  album,
  edition,
  renderTile,
  onLearnName,
  onBack,
}: {
  art: AlbumArt;
  album: string;
  edition: AlbumEdition;
  renderTile: RenderTile;
  onLearnName(releaseId: number, name: string): void;
  onBack(): void;
}) {
  const [details, setDetails] = useState<Loaded<EditionDetails>>({
    state: "loading",
  });
  const [attempt, setAttempt] = useState(0);
  const { releaseId } = edition;

  useEffect(() => {
    let cancelled = false;
    setDetails({ state: "loading" });
    fetchEditionDetails(art.key, releaseId, false)
      .then((value) => {
        if (cancelled) return;
        if (!value) {
          setDetails({ state: "failed" });
          return;
        }
        setDetails({ state: "ready", value });
        if (value.name) onLearnName(releaseId, value.name);
      })
      .catch((reason) => {
        console.warn("[Discogs] Edition failed to load:", reason);
        if (!cancelled) setDetails({ state: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [art.key, attempt, onLearnName, releaseId]);

  const images = details.state === "ready" ? details.value.images : [];
  const thumbnails = useAlbumThumbnails(art.key, images);

  return (
    <div className="artwork-editions__images">
      <button type="button" className="artwork-editions__back" onClick={onBack}>
        ‹ All editions
      </button>
      <div className="artwork-editions__heading">
        <strong>{editionHeading(edition)}</strong>
        {editionDetailLines(edition, album).map((line) => (
          <small key={line}>{line}</small>
        ))}
      </div>

      {details.state === "loading" && (
        <p className="artwork-editions__message" role="status">
          Loading images…
        </p>
      )}
      {details.state === "failed" && (
        <div className="artwork-editions__message" role="alert">
          <p>This edition can't be loaded right now.</p>
          <button
            type="button"
            className="artwork-placement__action"
            onClick={() => setAttempt((current) => current + 1)}
          >
            Try again
          </button>
        </div>
      )}
      {details.state === "ready" && images.length === 0 && (
        <p className="artwork-editions__message">
          Discogs has no images for this edition.
        </p>
      )}
      {images.length > 0 && (
        <div className="artwork-picker__grid">
          {images.map((image, index) => renderTile(image, index, thumbnails))}
        </div>
      )}
    </div>
  );
}
