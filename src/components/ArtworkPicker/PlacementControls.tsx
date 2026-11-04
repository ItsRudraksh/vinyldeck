// src/components/ArtworkPicker/PlacementControls.tsx
// Where the selected image goes on the record, and how it sits there. Changes show on
// the record at once and are saved after a short pause, so a drag writes to disk once.

import { useEffect, useRef } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { setAlbumArtPlacement } from "../../lib/discogs";
import { useAlbumArtStore } from "../../lib/discogs/store";
import { DEFAULT_ART_PLACEMENT } from "../../lib/discogs/types";
import type { AlbumArt, ArtPlacement } from "../../lib/discogs/types";
import { clampZoomPercent, fitZoomPercent } from "../../lib/vinyl/artworkFit";
import { ArtworkFit } from "../VinylRecord/ArtworkFit";

const SAVE_DELAY_MS = 250;
const MAX_OFFSET_PERCENT = 100;
const ARROW_STEP = 1;
const ARROW_STEP_LARGE = 5;
const ZOOM_SLIDER_MIN = 50;
const ZOOM_SLIDER_MAX = 300;

interface PlacementControlsProps {
  art: AlbumArt;
  imageId: string;
  artworkSrc: string | null;
  wholeDisc: boolean;
  isAdjusting: boolean;
  onAdjustingChange(isAdjusting: boolean): void;
  onError(message: string | null): void;
}

export function PlacementControls({
  art,
  imageId,
  artworkSrc,
  wholeDisc,
  isAdjusting,
  onAdjustingChange,
  onError,
}: PlacementControlsProps) {
  const change = usePlacementSaver(art, imageId, onError);
  const placement = art.placement;
  const dragRef = useRef<{
    pointerX: number;
    pointerY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  function moveTo(offsetX: number, offsetY: number) {
    change({
      ...placement,
      offsetX: clampOffset(offsetX),
      offsetY: clampOffset(offsetY),
    });
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      offsetX: placement.offsetX,
      offsetY: placement.offsetY,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const size = event.currentTarget.getBoundingClientRect().width;
    if (size === 0) return;
    moveTo(
      drag.offsetX + ((event.clientX - drag.pointerX) / size) * 100,
      drag.offsetY + ((event.clientY - drag.pointerY) / size) * 100,
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? ARROW_STEP_LARGE : ARROW_STEP;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    moveTo(placement.offsetX + move[0], placement.offsetY + move[1]);
  }

  async function fitWholeImage() {
    if (!artworkSrc) return;
    const image = new Image();
    image.src = artworkSrc;
    try {
      await image.decode();
    } catch {
      return;
    }
    change({
      ...placement,
      zoomPercent: fitZoomPercent(image.naturalWidth / image.naturalHeight),
      offsetX: 0,
      offsetY: 0,
    });
  }

  function chooseMode(mode: "center" | "disc") {
    if (mode === (wholeDisc ? "disc" : "center")) return;
    // The two areas differ in size, so an adjustment made for one means nothing on the other.
    change({ ...DEFAULT_ART_PLACEMENT, mode });
  }

  return (
    <section className="artwork-placement" aria-label="Image placement">
      <div className="artwork-placement__modes" role="group" aria-label="Show image on">
        {(
          [
            ["center", "Center"],
            ["disc", "Whole disc"],
          ] as const
        ).map(([mode, label]) => {
          const isActive = mode === (wholeDisc ? "disc" : "center");
          return (
            <button
              key={mode}
              type="button"
              data-placement-mode={mode}
              className={`artwork-placement__mode${isActive ? " artwork-placement__mode--active" : ""}`}
              aria-pressed={isActive}
              onClick={() => chooseMode(mode)}
            >
              {label}
            </button>
          );
        })}
      </div>

      {!isAdjusting && (
        <button
          type="button"
          data-placement-action="adjust"
          className="artwork-placement__action"
          onClick={() => onAdjustingChange(true)}
        >
          Adjust image
        </button>
      )}

      {isAdjusting && artworkSrc && (
        <>
          <div
            className="artwork-placement__preview"
            role="application"
            tabIndex={0}
            aria-label="Drag or use the arrow keys to move the image"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={() => {
              dragRef.current = null;
            }}
            onPointerCancel={() => {
              dragRef.current = null;
            }}
            onKeyDown={handleKeyDown}
          >
            <ArtworkFit src={artworkSrc} alt="" placement={placement} />
          </div>

          <label className="artwork-placement__zoom">
            <span>Zoom</span>
            <input
              type="range"
              min={ZOOM_SLIDER_MIN}
              max={ZOOM_SLIDER_MAX}
              step={1}
              value={placement.zoomPercent}
              onChange={(event) =>
                change({
                  ...placement,
                  zoomPercent: clampZoomPercent(Number(event.target.value)),
                })
              }
            />
            <output>{placement.zoomPercent}%</output>
          </label>

          <div className="artwork-placement__actions">
            <button
              type="button"
              data-placement-action="fit"
              className="artwork-placement__action"
              onClick={() => void fitWholeImage()}
            >
              Fit
            </button>
            <button
              type="button"
              data-placement-action="reset"
              className="artwork-placement__action"
              onClick={() =>
                change({
                  ...placement,
                  zoomPercent: DEFAULT_ART_PLACEMENT.zoomPercent,
                  offsetX: 0,
                  offsetY: 0,
                })
              }
            >
              Reset
            </button>
            <button
              type="button"
              data-placement-action="done"
              className="artwork-placement__action artwork-placement__action--primary"
              onClick={() => onAdjustingChange(false)}
            >
              Done
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function clampOffset(offset: number): number {
  return Math.round(
    Math.min(MAX_OFFSET_PERCENT, Math.max(-MAX_OFFSET_PERCENT, offset)),
  );
}

function usePlacementSaver(
  art: AlbumArt,
  imageId: string,
  onError: (message: string | null) => void,
): (next: ArtPlacement) => void {
  const pendingRef = useRef<{
    key: string;
    imageId: string;
    placement: ArtPlacement;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const lastSavedRef = useRef(art);
  const latestSaveRef = useRef(0);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  function flush() {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;

    const save = latestSaveRef.current + 1;
    latestSaveRef.current = save;
    setAlbumArtPlacement(pending.key, pending.imageId, pending.placement)
      .then((confirmed) => {
        lastSavedRef.current = confirmed;
        if (latestSaveRef.current === save && !pendingRef.current) {
          useAlbumArtStore.getState().applyChange(confirmed);
        }
      })
      .catch((reason) => {
        console.warn("[Discogs] Placement save failed:", reason);
        if (latestSaveRef.current !== save) return;
        useAlbumArtStore.getState().applyChange(lastSavedRef.current);
        onErrorRef.current("That adjustment couldn't be saved.");
      });
  }

  // Leaving mid-pause must not lose the last change.
  useEffect(() => flush, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (next) => {
    onError(null);
    useAlbumArtStore.getState().previewPlacement(next);
    if (pendingRef.current) clearTimeout(pendingRef.current.timer);
    pendingRef.current = {
      key: art.key,
      imageId,
      placement: next,
      timer: setTimeout(flush, SAVE_DELAY_MS),
    };
  };
}
