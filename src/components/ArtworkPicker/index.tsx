// src/components/ArtworkPicker/index.tsx
// Discreet trigger + side drawer for choosing which Discogs image the vinyl uses.
// A drawer rather than a modal: the record stays visible, so a choice can be seen
// landing on it. Touches only artwork state, never the playback source.

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { selectAlbumArt } from "../../lib/discogs";
import { hashThumbnail, uniqueCoverIds } from "../../lib/discogs/coverDedupe";
import { useAlbumArtStore } from "../../lib/discogs/store";
import type { AlbumArt, AlbumArtImage } from "../../lib/discogs/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "../Tooltip";
import { EditionBrowser } from "./EditionBrowser";
import { PlacementControls } from "./PlacementControls";
import { useAlbumThumbnails } from "./useAlbumThumbnails";
import type { ThumbnailState } from "./useAlbumThumbnails";
import "./ArtworkPicker.css";

const DRAWER_SPRING = { type: "spring", stiffness: 320, damping: 34 } as const;

interface ArtworkPickerProps {
  art: AlbumArt | null;
  album: string;
  artworkSrc: string | null;
  wholeDisc: boolean;
}

export function ArtworkPicker({
  art,
  album,
  artworkSrc,
  wholeDisc,
}: ArtworkPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Even a single image can be placed and adjusted.
  const hasChoices = art?.status === "found" && art.images.length > 0;
  const showDrawer = isOpen && hasChoices;

  useEffect(() => {
    if (!showDrawer) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // Marked handled so the same key does not also leave fullscreen.
      event.preventDefault();
      setIsOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [showDrawer]);

  return (
    <>
      {hasChoices && (
        <Tooltip side="bottom">
          <TooltipTrigger>
            <button
              type="button"
              className="settings-trigger artwork-picker-trigger"
              aria-label="Choose vinyl artwork"
              aria-haspopup="dialog"
              aria-expanded={showDrawer}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsOpen((open) => !open);
              }}
            >
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="8.25"
                  stroke="currentColor"
                  strokeWidth="1.55"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="3"
                  stroke="currentColor"
                  strokeWidth="1.55"
                />
                <path
                  d="M12 6.4a5.6 5.6 0 0 1 5.6 5.6"
                  stroke="currentColor"
                  strokeWidth="1.55"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </TooltipTrigger>
          <TooltipContent>Vinyl artwork</TooltipContent>
        </Tooltip>
      )}

      <AnimatePresence>
        {showDrawer && art && (
          <>
            <motion.div
              key="artwork-picker-dismiss"
              className="artwork-picker-dismiss"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />
            <motion.aside
              key="artwork-picker-drawer"
              className="artwork-picker"
              role="dialog"
              aria-label="Choose vinyl artwork"
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 32 }}
              transition={DRAWER_SPRING}
            >
              <ArtworkPickerContent
                art={art}
                album={album}
                artworkSrc={artworkSrc}
                wholeDisc={wholeDisc}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function ArtworkPickerContent({
  art,
  album,
  artworkSrc,
  wholeDisc,
}: Required<Pick<ArtworkPickerProps, "album" | "artworkSrc" | "wholeDisc">> & {
  art: AlbumArt;
}) {
  const thumbnails = useAlbumThumbnails(art.key, art.images);
  const coverHashes = useCoverHashes(art, thumbnails);
  const [error, setError] = useState<string | null>(null);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [isBrowsingEditions, setIsBrowsingEditions] = useState(false);
  const latestChoiceRef = useRef(0);

  useEffect(() => {
    setError(null);
    setIsAdjusting(false);
    setIsBrowsingEditions(false);
  }, [art.key]);

  function handleSelect(
    image: AlbumArtImage,
    tileThumbnails: Record<string, ThumbnailState>,
  ) {
    if (image.id === art.selectedImageId) return;

    const choice = latestChoiceRef.current + 1;
    latestChoiceRef.current = choice;
    setError(null);

    const store = useAlbumArtStore.getState();
    const thumbnail = tileThumbnails[image.id];
    const previousArt = art;
    store.previewSelection(
      image.id,
      thumbnail && thumbnail !== "failed" ? thumbnail : null,
    );

    selectAlbumArt(art.key, image.id)
      .then((confirmed) => {
        if (latestChoiceRef.current === choice) {
          useAlbumArtStore.getState().applyChange(confirmed);
        }
      })
      .catch((reason) => {
        console.warn("[Discogs] Artwork selection failed:", reason);
        if (latestChoiceRef.current !== choice) return;
        useAlbumArtStore.getState().applyChange(previousArt);
        setError("That image can't be loaded right now.");
      });
  }

  const visibleCoverIds = useMemo(
    () =>
      uniqueCoverIds(
        art.images.filter(isCover).map((image) => image.id),
        coverHashes,
        art.selectedImageId,
      ),
    [art.images, art.selectedImageId, coverHashes],
  );
  const covers = art.images.filter(
    (image) => isCover(image) && visibleCoverIds.has(image.id),
  );
  const photos = art.images.filter((image) => !isCover(image));

  function renderTile(
    image: AlbumArtImage,
    index: number,
    tileThumbnails: Record<string, ThumbnailState>,
  ) {
    const thumbnail = tileThumbnails[image.id];
    const isSelected = image.id === art.selectedImageId;
    return (
      <button
        key={image.id}
        type="button"
        data-image-id={image.id}
        className={`artwork-picker__tile${isSelected ? " artwork-picker__tile--selected" : ""}`}
        aria-pressed={isSelected}
        aria-label={`Image ${index + 1}${image.source ? `, ${image.source}` : ""}`}
        title={image.source}
        onClick={() => handleSelect(image, tileThumbnails)}
      >
        {thumbnail && thumbnail !== "failed" ? (
          <img src={thumbnail} alt="" draggable={false} />
        ) : (
          <span
            className={`artwork-picker__placeholder${thumbnail === "failed" ? "" : " artwork-picker__placeholder--loading"}`}
          />
        )}
        {isSelected && (
          <span className="artwork-picker__check" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
      </button>
    );
  }

  return (
    <>
      <header className="artwork-picker__header">
        <p className="artwork-picker__kicker">Vinyl artwork</p>
        <h2 className="artwork-picker__album" title={album}>
          {album}
        </h2>
      </header>

      {art.selectedImageId && art.artworkDataUrl && (
        <PlacementControls
          key={`${art.key}|${art.selectedImageId}`}
          art={art}
          imageId={art.selectedImageId}
          artworkSrc={artworkSrc}
          wholeDisc={wholeDisc}
          isAdjusting={isAdjusting}
          onAdjustingChange={setIsAdjusting}
          onError={setError}
        />
      )}

      {!isAdjusting && isBrowsingEditions && (
        <EditionBrowser
          art={art}
          album={album}
          renderTile={renderTile}
          onBack={() => setIsBrowsingEditions(false)}
        />
      )}

      {!isAdjusting && !isBrowsingEditions && (
        <>
          <button
            type="button"
            data-browse-editions
            className="artwork-placement__action artwork-picker__editions"
            onClick={() => setIsBrowsingEditions(true)}
          >
            All editions of this album ›
          </button>
          <div className="artwork-picker__grid">
            {covers.length > 0 && (
              <p className="artwork-picker__section">Covers</p>
            )}
            {covers.map((image, index) => renderTile(image, index, thumbnails))}
            {photos.length > 0 && (
              <p className="artwork-picker__section">Photos</p>
            )}
            {photos.map((image, index) =>
              renderTile(image, covers.length + index, thumbnails),
            )}
          </div>
        </>
      )}

      <footer className="artwork-picker__footer">
        {error ? (
          <p className="artwork-picker__error" role="alert">
            {error}
          </p>
        ) : (
          <p className="artwork-picker__credit">Images from Discogs</p>
        )}
      </footer>
    </>
  );
}

function isCover(image: AlbumArtImage): boolean {
  return image.kind === "primary";
}

/** Fingerprints cover thumbnails as they arrive, so repeats can be hidden. */
function useCoverHashes(
  art: AlbumArt,
  thumbnails: Record<string, ThumbnailState>,
): Record<string, string> {
  const [hashes, setHashes] = useState<Record<string, string>>({});
  const requestedRef = useRef(new Set<string>());

  useEffect(() => {
    requestedRef.current = new Set();
    setHashes({});
  }, [art.key]);

  useEffect(() => {
    for (const image of art.images.filter(isCover)) {
      const thumbnail = thumbnails[image.id];
      if (
        !thumbnail ||
        thumbnail === "failed" ||
        requestedRef.current.has(image.id)
      ) {
        continue;
      }
      requestedRef.current.add(image.id);
      const requested = requestedRef.current;
      hashThumbnail(thumbnail)
        .then((hash) => {
          if (hash && requestedRef.current === requested) {
            setHashes((current) => ({ ...current, [image.id]: hash }));
          }
        })
        .catch(() => {});
    }
  }, [art.images, thumbnails]);

  return hashes;
}
