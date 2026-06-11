import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { EMPTY_PLAYBACK } from "./store";
import type { PlaybackSource, PlaybackState } from "./types";

const MEDIA_SNAPSHOT_EVENT = "media-state-changed";

export interface BackendMediaSnapshot {
  track: string;
  artist: string;
  album: string;
  artworkDataUrl: string | null;
  duration: number;
  position: number;
  isPlaying: boolean;
  sourceName: string;
  sourceId: string;
  canSeek: boolean;
  canSkip: boolean;
  canControl: boolean;
}

type MediaCommand =
  | "cmd_media_play"
  | "cmd_media_pause"
  | "cmd_media_toggle_play_pause"
  | "cmd_media_next"
  | "cmd_media_previous";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

export function isBackendMediaSnapshot(value: unknown): value is BackendMediaSnapshot {
  if (!isRecord(value)) return false;

  return (
    typeof value.track === "string" &&
    typeof value.artist === "string" &&
    typeof value.album === "string" &&
    isNullableString(value.artworkDataUrl) &&
    isNonNegativeFiniteNumber(value.duration) &&
    isNonNegativeFiniteNumber(value.position) &&
    typeof value.isPlaying === "boolean" &&
    typeof value.sourceName === "string" &&
    typeof value.sourceId === "string" &&
    typeof value.canSeek === "boolean" &&
    typeof value.canSkip === "boolean" &&
    typeof value.canControl === "boolean"
  );
}

export function mapBackendMediaSnapshot(
  snapshot: BackendMediaSnapshot | null | undefined,
): PlaybackState {
  if (!snapshot) return EMPTY_PLAYBACK;

  return {
    track: snapshot.track,
    artist: snapshot.artist,
    album: snapshot.album,
    artworkDataUrl: snapshot.artworkDataUrl,
    duration: snapshot.duration,
    position: snapshot.position,
    isPlaying: snapshot.isPlaying,
    sourceName: snapshot.sourceName,
    sourceId: snapshot.sourceId,
    canSeek: snapshot.canSeek,
    canSkip: snapshot.canSkip,
    canControl: snapshot.canControl,
  };
}

function parseBackendMediaSnapshot(payload: unknown): PlaybackState {
  if (payload === null || payload === undefined) return EMPTY_PLAYBACK;
  if (!isBackendMediaSnapshot(payload)) {
    throw new Error("Invalid backend media snapshot payload");
  }

  return mapBackendMediaSnapshot(payload);
}

export function createTauriSource(): PlaybackSource {
  let currentState = EMPTY_PLAYBACK;
  let started = false;
  const listeners = new Set<(state: PlaybackState) => void>();
  const unlisteners: Array<() => void> = [];

  function notify(state: PlaybackState) {
    currentState = state;
    listeners.forEach((listener) => listener(state));
  }

  function invokeCommand(command: MediaCommand) {
    if (!isTauri()) return;
    void invoke<unknown>(command)
      .then((payload) => notify(parseBackendMediaSnapshot(payload)))
      .catch((error) => console.warn(`[TauriSource] ${command} failed:`, error));
  }

  return {
    getState() {
      return currentState;
    },

    async start() {
      if (!isTauri() || started) return;
      started = true;

      const unlistenSnapshot = await listen<unknown>(
        MEDIA_SNAPSHOT_EVENT,
        ({ payload }) => {
          try {
            notify(parseBackendMediaSnapshot(payload));
          } catch (error) {
            console.warn("[TauriSource] media-state-changed payload rejected:", error);
          }
        },
      );
      unlisteners.push(unlistenSnapshot);

      notify(parseBackendMediaSnapshot(await invoke<unknown>("cmd_media_snapshot")));
    },

    stop() {
      started = false;
      while (unlisteners.length > 0) {
        unlisteners.pop()?.();
      }
      listeners.clear();
    },

    onStateChange(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },

    play() {
      invokeCommand("cmd_media_play");
    },

    pause() {
      invokeCommand("cmd_media_pause");
    },

    togglePlayPause() {
      invokeCommand("cmd_media_toggle_play_pause");
    },

    next() {
      invokeCommand("cmd_media_next");
    },

    previous() {
      invokeCommand("cmd_media_previous");
    },

    seekTo(seconds: number) {
      if (!isTauri()) return;
      void invoke<unknown>("cmd_media_seek", { seconds })
        .then((payload) => notify(parseBackendMediaSnapshot(payload)))
        .catch((error) => console.warn("[TauriSource] cmd_media_seek failed:", error));
    },
  };
}
