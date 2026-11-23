// src/lib/playback/store.ts
// Zustand v5 store — single source of truth for playback state + theme.
// Uses subscribeWithSelector middleware for granular subscriptions.

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { PlaybackState, PlaybackSource } from "./types";
import type { AmbientModeId, ThemeId } from "../themes/applier";
import { DEFAULT_SETTINGS } from "../settings/types";
import type { PersistedSettings } from "../settings/types";
import type { TrackChangeDirection } from "../trackTransition/types";

const PENDING_SEEK_TIMEOUT_MS = 1500;
const PENDING_SEEK_SETTLE_SECONDS = 1.25;

// ── Store state types ─────────────────────────────────────────
export interface PlaybackStoreState {
  playback: PlaybackState;
  lastKnownPosition: number;
  lastSyncTime: number;
  theme: ThemeId;
  ambientMode: AmbientModeId;
  artAmbient: boolean;
  settings: PersistedSettings;
  source: PlaybackSource | null;
  sourceUnsubscribe: (() => void) | null;
  devForceEmpty: boolean;
  pendingSeekPosition: number | null;
  pendingSeekStartedAt: number;
  trackChangeDirection: TrackChangeDirection;
  trackChangeNonce: number;
  pendingTrackChangeDirection: TrackChangeDirection;
}

export interface PlaybackStoreActions {
  setSource(source: PlaybackSource): void;
  clearSource(source?: PlaybackSource): void;
  updatePlayback(state: PlaybackState): void;
  getPosition(): number;
  beginPendingSeek(seconds: number): void;
  clearPendingSeek(): void;
  hydrateSettings(settings: PersistedSettings): void;
  updateSettings(partial: Partial<PersistedSettings>): void;
  setWindowMode(mode: PersistedSettings["windowMode"]): void;
  setAlwaysOnTop(enabled: boolean): void;
  setDevForceEmpty(enabled: boolean): void;
  markTrackChangeIntent(direction: TrackChangeDirection): void;
}

export type VinylDeckStore = PlaybackStoreState & PlaybackStoreActions;

export const EMPTY_PLAYBACK: PlaybackState = {
  track: "",
  artist: "",
  album: "",
  artworkDataUrl: null,
  duration: 0,
  position: 0,
  isPlaying: false,
  sourceName: "",
  sourceId: "",
  canSeek: false,
  canSkip: false,
  canControl: false,
};

export const useVinylDeckStore = create<VinylDeckStore>()(
  subscribeWithSelector((set, get) => ({
    playback: EMPTY_PLAYBACK,
    lastKnownPosition: 0,
    lastSyncTime: Date.now(),
    theme: "noir",
    ambientMode: "off",
    artAmbient: false,
    settings: DEFAULT_SETTINGS,
    source: null,
    sourceUnsubscribe: null,
    devForceEmpty: false,
    pendingSeekPosition: null,
    pendingSeekStartedAt: 0,
    trackChangeDirection: "unknown",
    trackChangeNonce: 0,
    pendingTrackChangeDirection: "unknown",

    setSource(source) {
      const { source: existing, sourceUnsubscribe: existingUnsubscribe } = get();
      if (existing === source && existingUnsubscribe) return;

      if (existingUnsubscribe) existingUnsubscribe();
      if (existing) existing.stop();

      const initialState = source.getState();
      set({
        source,
        sourceUnsubscribe: null,
        playback: initialState,
        lastKnownPosition: initialState.position,
        lastSyncTime: Date.now(),
        pendingSeekPosition: null,
        pendingSeekStartedAt: 0,
        trackChangeDirection: "unknown",
        trackChangeNonce: 0,
        pendingTrackChangeDirection: "unknown",
      });

      const unsubscribe = source.onStateChange((state) => {
        get().updatePlayback(state);
      });

      set({ sourceUnsubscribe: unsubscribe });

      source.start().catch((error) => {
        console.error(error);
        if (get().source === source) get().clearSource(source);
      });
    },

    clearSource(source) {
      const { source: existing, sourceUnsubscribe } = get();
      if (source && existing !== source) return;

      if (sourceUnsubscribe) sourceUnsubscribe();
      if (existing) existing.stop();

      set({
        source: null,
        sourceUnsubscribe: null,
        playback: EMPTY_PLAYBACK,
        lastKnownPosition: 0,
        lastSyncTime: Date.now(),
        pendingSeekPosition: null,
        pendingSeekStartedAt: 0,
        trackChangeDirection: "unknown",
        trackChangeNonce: 0,
        pendingTrackChangeDirection: "unknown",
      });
    },

    updatePlayback(state) {
      const current = get();
      const trackChanged =
        state.track !== current.playback.track ||
        state.artist !== current.playback.artist ||
        state.album !== current.playback.album ||
        state.sourceId !== current.playback.sourceId;

      // Never wipe cover art to null on same-track play/pause/seek events
      const nextPlayback =
        !trackChanged &&
        !state.artworkDataUrl &&
        current.playback.artworkDataUrl
          ? { ...state, artworkDataUrl: current.playback.artworkDataUrl }
          : state;

      const pendingSeekExpired =
        current.pendingSeekPosition !== null &&
        Date.now() - current.pendingSeekStartedAt > PENDING_SEEK_TIMEOUT_MS;
      const pendingSeekSettled =
        current.pendingSeekPosition !== null &&
        Math.abs(nextPlayback.position - current.pendingSeekPosition) <=
          PENDING_SEEK_SETTLE_SECONDS;
      const consumeDirection =
        trackChanged && current.pendingTrackChangeDirection !== "unknown";

      set({
        playback: nextPlayback,
        lastKnownPosition: nextPlayback.position,
        lastSyncTime: Date.now(),
        pendingSeekPosition:
          pendingSeekExpired || pendingSeekSettled || trackChanged
            ? null
            : current.pendingSeekPosition,
        pendingSeekStartedAt:
          pendingSeekExpired || pendingSeekSettled || trackChanged
            ? 0
            : current.pendingSeekStartedAt,
        trackChangeDirection: consumeDirection
          ? current.pendingTrackChangeDirection
          : trackChanged
            ? "unknown"
            : current.trackChangeDirection,
        trackChangeNonce: trackChanged
          ? current.trackChangeNonce + 1
          : current.trackChangeNonce,
        pendingTrackChangeDirection: consumeDirection
          ? "unknown"
          : current.pendingTrackChangeDirection,
      });
    },

    getPosition() {
      const {
        playback,
        lastKnownPosition,
        lastSyncTime,
        pendingSeekPosition,
        pendingSeekStartedAt,
      } = get();
      if (
        pendingSeekPosition !== null &&
        Date.now() - pendingSeekStartedAt <= PENDING_SEEK_TIMEOUT_MS
      ) {
        return Math.min(Math.max(pendingSeekPosition, 0), playback.duration);
      }
      if (!playback.isPlaying) return lastKnownPosition;
      const elapsed = (Date.now() - lastSyncTime) / 1000;
      return Math.min(lastKnownPosition + elapsed, playback.duration);
    },

    beginPendingSeek(seconds) {
      const duration = get().playback.duration;
      if (duration <= 0) return;
      set({
        pendingSeekPosition: Math.min(Math.max(seconds, 0), duration),
        pendingSeekStartedAt: Date.now(),
      });
    },

    clearPendingSeek() {
      set({ pendingSeekPosition: null, pendingSeekStartedAt: 0 });
    },

    hydrateSettings(settings) {
      set({
        settings,
        theme: settings.theme,
        ambientMode: settings.ambientMode,
        artAmbient: settings.ambientMode !== "off",
      });
    },

    updateSettings(partial) {
      set((state) => {
        const nextSettings = { ...state.settings, ...partial };
        if (partial.artAmbient !== undefined && partial.ambientMode === undefined) {
          nextSettings.ambientMode = partial.artAmbient ? "beam" : "off";
        }
        nextSettings.ambientMode = nextSettings.ambientMode === "off" ? "off" : "beam";
        nextSettings.artAmbient = nextSettings.ambientMode !== "off";

        return {
          settings: nextSettings,
          theme: nextSettings.theme,
          ambientMode: nextSettings.ambientMode,
          artAmbient: nextSettings.artAmbient,
        };
      });
    },

    setWindowMode(mode) {
      set((state) => ({
        settings: {
          ...state.settings,
          windowMode: mode === "mini" ? state.settings.windowMode : mode,
        },
      }));
    },

    setAlwaysOnTop(enabled) {
      set((state) => ({
        settings: { ...state.settings, alwaysOnTop: enabled },
      }));
    },

    setDevForceEmpty(enabled) {
      set({ devForceEmpty: enabled });
    },

    markTrackChangeIntent(direction) {
      set({ pendingTrackChangeDirection: direction });
    },
  }))
);

export const selectPlayback = (s: VinylDeckStore) => s.playback;
export const selectIsPlaying = (s: VinylDeckStore) => s.playback.isPlaying;
export const selectTrack = (s: VinylDeckStore) => s.playback.track;
export const selectArtwork = (s: VinylDeckStore) => s.playback.artworkDataUrl;
export const selectTheme = (s: VinylDeckStore) => s.theme;
export const selectAmbientMode = (s: VinylDeckStore) => s.ambientMode;
export const selectSource = (s: VinylDeckStore) => s.source;
export const selectDevForceEmpty = (s: VinylDeckStore) => s.devForceEmpty;
export const selectSettings = (s: VinylDeckStore) => s.settings;
export const selectTrackChangeDirection = (s: VinylDeckStore) =>
  s.trackChangeDirection;
export const selectTrackChangeNonce = (s: VinylDeckStore) => s.trackChangeNonce;
