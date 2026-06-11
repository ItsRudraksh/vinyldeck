import { afterEach, describe, expect, it } from "vitest";
import { EMPTY_PLAYBACK, useVinylDeckStore } from "./store";
import type { PlaybackSource, PlaybackState } from "./types";

function makeSnapshot(track: string): PlaybackState {
  return {
    ...EMPTY_PLAYBACK,
    track,
    artist: "Artist",
    album: "Album",
    duration: 120,
    position: 12,
    isPlaying: true,
    sourceName: "Test",
    sourceId: track,
    canControl: true,
  };
}

function createFakeSource(initialState = EMPTY_PLAYBACK) {
  const listeners = new Set<(state: PlaybackState) => void>();
  const source: PlaybackSource = {
    getState: () => initialState,
    play: () => {},
    pause: () => {},
    togglePlayPause: () => {},
    next: () => {},
    previous: () => {},
    seekTo: () => {},
    onStateChange(callback) {
      listeners.add(callback);
      fake.unsubscribeCount += 1;
      return () => {
        listeners.delete(callback);
        fake.unsubscribeRunCount += 1;
      };
    },
    async start() {
      fake.startCount += 1;
    },
    stop() {
      fake.stopCount += 1;
    },
  };

  const fake = {
    source,
    startCount: 0,
    stopCount: 0,
    unsubscribeCount: 0,
    unsubscribeRunCount: 0,
    listenerCount: () => listeners.size,
    emit(state: PlaybackState) {
      listeners.forEach((listener) => listener(state));
    },
  };

  return fake;
}

afterEach(() => {
  useVinylDeckStore.getState().clearSource();
});

describe("playback store source lifecycle", () => {
  it("subscribes once and ignores duplicate same-source registration", () => {
    const fake = createFakeSource(makeSnapshot("One"));

    useVinylDeckStore.getState().setSource(fake.source);
    useVinylDeckStore.getState().setSource(fake.source);

    expect(fake.startCount).toBe(1);
    expect(fake.stopCount).toBe(0);
    expect(fake.listenerCount()).toBe(1);
    expect(fake.unsubscribeCount).toBe(1);
  });

  it("routes source events into playback state", () => {
    const fake = createFakeSource();
    const nextSnapshot = makeSnapshot("Two");

    useVinylDeckStore.getState().setSource(fake.source);
    fake.emit(nextSnapshot);

    expect(useVinylDeckStore.getState().playback).toEqual(nextSnapshot);
  });

  it("clears the active source with unsubscribe, stop, and empty playback reset", () => {
    const fake = createFakeSource(makeSnapshot("Three"));

    useVinylDeckStore.getState().setSource(fake.source);
    useVinylDeckStore.getState().clearSource(fake.source);

    expect(fake.unsubscribeRunCount).toBe(1);
    expect(fake.stopCount).toBe(1);
    expect(fake.listenerCount()).toBe(0);
    expect(useVinylDeckStore.getState().source).toBeNull();
    expect(useVinylDeckStore.getState().sourceUnsubscribe).toBeNull();
    expect(useVinylDeckStore.getState().playback).toEqual(EMPTY_PLAYBACK);
  });

  it("ignores stale cleanup for a non-current source", () => {
    const stale = createFakeSource(makeSnapshot("Old"));
    const current = createFakeSource(makeSnapshot("New"));

    useVinylDeckStore.getState().setSource(current.source);
    useVinylDeckStore.getState().clearSource(stale.source);

    expect(stale.stopCount).toBe(0);
    expect(current.stopCount).toBe(0);
    expect(useVinylDeckStore.getState().source).toBe(current.source);
  });

  it("stops and unsubscribes the old source on source swap", () => {
    const oldSource = createFakeSource(makeSnapshot("Old"));
    const newSource = createFakeSource(makeSnapshot("New"));

    useVinylDeckStore.getState().setSource(oldSource.source);
    useVinylDeckStore.getState().setSource(newSource.source);

    expect(oldSource.unsubscribeRunCount).toBe(1);
    expect(oldSource.stopCount).toBe(1);
    expect(oldSource.listenerCount()).toBe(0);
    expect(newSource.listenerCount()).toBe(1);
    expect(useVinylDeckStore.getState().source).toBe(newSource.source);
  });
});
