// src/lib/playback/store.ts
// Zustand v5 store — single source of truth for playback state + theme.
// Uses subscribeWithSelector middleware for granular subscriptions.

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { PlaybackState, PlaybackSource } from "./types";
import type { AmbientModeId, ThemeId } from "../themes/applier";
import { DEFAULT_SETTINGS } from "../settings/types";
import type { PersistedSettings } from "../settings/types";

// ── Store state types ─────────────────────────────────────────
export interface PlaybackStoreState {
  // Current playback snapshot (from source)
  playback: PlaybackState;

  // Raw sync data for client-side position extrapolation
  lastKnownPosition: number;
  lastSyncTime: number; // ms since epoch

  // Active theme
  theme: ThemeId;

  // Album-reactive lighting mode. artAmbient remains as legacy derived flag.
  ambientMode: AmbientModeId;
  artAmbient: boolean;

  // Persisted settings (runtime QA state stays separate)
  settings: PersistedSettings;

  // Active source (runtime, not persisted)
  source: PlaybackSource | null;
  sourceUnsubscribe: (() => void) | null;

  // Dev visual QA: force no-media state without stopping MockSource.
  devForceEmpty: boolean;
}

export interface PlaybackStoreActions {
  // Initialize with a source
  setSource(source: PlaybackSource): void;
  clearSource(source?: PlaybackSource): void;

  // Called by source.onStateChange
  updatePlayback(state: PlaybackState): void;

  // Client-side position (extrapolated from lastSync + elapsed)
  getPosition(): number;

  // Persisted settings
  hydrateSettings(settings: PersistedSettings): void;
  updateSettings(partial: Partial<PersistedSettings>): void;
  setWindowMode(mode: PersistedSettings["windowMode"]): void;
  setAlwaysOnTop(enabled: boolean): void;

  // Dev visual QA
  setDevForceEmpty(enabled: boolean): void;
}

export type VinylDeckStore = PlaybackStoreState & PlaybackStoreActions;

// ── Default empty playback state ──────────────────────────────
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

// ── Store ─────────────────────────────────────────────────────
export const useVinylDeckStore = create<VinylDeckStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
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

    // ── Set source and subscribe to its state changes ─────────
    setSource(source) {
      const { source: existing, sourceUnsubscribe: existingUnsubscribe } =
        get();
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
      });

      // Subscribe to state changes from source
      const unsubscribe = source.onStateChange((state) => {
        get().updatePlayback(state);
      });

      set({ sourceUnsubscribe: unsubscribe });

      // Start the source
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
      });
    },

    // ── Update playback snapshot from source event ────────────
    updatePlayback(state) {
      set({
        playback: state,
        lastKnownPosition: state.position,
        lastSyncTime: Date.now(),
      });
    },

    // ── Client-side position extrapolation ────────────────────
    // Between SMTC sync events, advance position using elapsed real time.
    getPosition() {
      const { playback, lastKnownPosition, lastSyncTime } = get();
      if (!playback.isPlaying) return lastKnownPosition;
      const elapsed = (Date.now() - lastSyncTime) / 1000;
      return Math.min(lastKnownPosition + elapsed, playback.duration);
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
        if (
          partial.artAmbient !== undefined &&
          partial.ambientMode === undefined
        ) {
          nextSettings.ambientMode = partial.artAmbient ? "beam" : "off";
        }
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
  })),
);

// ── Convenience selectors (stable references) ─────────────────
export const selectPlayback = (s: VinylDeckStore) => s.playback;
export const selectIsPlaying = (s: VinylDeckStore) => s.playback.isPlaying;
export const selectTrack = (s: VinylDeckStore) => s.playback.track;
export const selectArtwork = (s: VinylDeckStore) => s.playback.artworkDataUrl;
export const selectTheme = (s: VinylDeckStore) => s.theme;
export const selectAmbientMode = (s: VinylDeckStore) => s.ambientMode;
export const selectSource = (s: VinylDeckStore) => s.source;
export const selectDevForceEmpty = (s: VinylDeckStore) => s.devForceEmpty;
export const selectSettings = (s: VinylDeckStore) => s.settings;
