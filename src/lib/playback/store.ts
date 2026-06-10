// src/lib/playback/store.ts
// Zustand v5 store — single source of truth for playback state + theme.
// Uses subscribeWithSelector middleware for granular subscriptions.

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { PlaybackState, PlaybackSource } from "./types";
import type { ThemeId } from "../themes/applier";

// ── Store state types ─────────────────────────────────────────
export interface PlaybackStoreState {
  // Current playback snapshot (from source)
  playback: PlaybackState;

  // Raw sync data for client-side position extrapolation
  lastKnownPosition: number;
  lastSyncTime: number; // ms since epoch

  // Active theme
  theme: ThemeId;

  // Album art ambient — Noir only toggle (default off)
  artAmbient: boolean;

  // Active source (runtime, not persisted)
  source: PlaybackSource | null;

  // Dev visual QA: force no-media state without stopping MockSource.
  devForceEmpty: boolean;
}

export interface PlaybackStoreActions {
  // Initialize with a source
  setSource(source: PlaybackSource): void;

  // Called by source.onStateChange
  updatePlayback(state: PlaybackState): void;

  // Client-side position (extrapolated from lastSync + elapsed)
  getPosition(): number;

  // Theme
  setTheme(theme: ThemeId): void;

  // Noir ambient toggle
  setArtAmbient(enabled: boolean): void;

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
    artAmbient: false,
    source: null,
    devForceEmpty: false,

    // ── Set source and subscribe to its state changes ─────────
    setSource(source) {
      const existing = get().source;
      if (existing) existing.stop();

      const initialState = source.getState();
      set({
        source,
        playback: initialState,
        lastKnownPosition: initialState.position,
        lastSyncTime: Date.now(),
      });

      // Subscribe to state changes from source
      const unsubscribe = source.onStateChange((state) => {
        get().updatePlayback(state);
      });

      // Start the source
      source.start().catch(console.error);

      // Store unsubscribe for cleanup (not in state — closure)
      // Cleanup happens when setSource is called again or source.stop()
      void unsubscribe; // captured in closure, source.stop() ends it
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

    // ── Theme ─────────────────────────────────────────────────
    setTheme(theme) {
      set({ theme });
    },

    setArtAmbient(enabled) {
      set({ artAmbient: enabled });
    },

    setDevForceEmpty(enabled) {
      set({ devForceEmpty: enabled });
    },
  }))
);

// ── Convenience selectors (stable references) ─────────────────
export const selectPlayback = (s: VinylDeckStore) => s.playback;
export const selectIsPlaying = (s: VinylDeckStore) => s.playback.isPlaying;
export const selectTrack = (s: VinylDeckStore) => s.playback.track;
export const selectArtwork = (s: VinylDeckStore) => s.playback.artworkDataUrl;
export const selectTheme = (s: VinylDeckStore) => s.theme;
export const selectSource = (s: VinylDeckStore) => s.source;
export const selectDevForceEmpty = (s: VinylDeckStore) => s.devForceEmpty;
