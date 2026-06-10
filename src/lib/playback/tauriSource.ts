import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { EMPTY_PLAYBACK } from "./store";
import type { PlaybackSource, PlaybackState } from "./types";

const MEDIA_SNAPSHOT_EVENT = "media-state-changed";

type MediaCommand =
  | "cmd_media_play"
  | "cmd_media_pause"
  | "cmd_media_toggle_play_pause"
  | "cmd_media_next"
  | "cmd_media_previous";

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
    void invoke<PlaybackState>(command)
      .then(notify)
      .catch((error) => console.warn(`[TauriSource] ${command} failed:`, error));
  }

  return {
    getState() {
      return currentState;
    },

    async start() {
      if (!isTauri() || started) return;
      started = true;

      const unlistenSnapshot = await listen<PlaybackState>(
        MEDIA_SNAPSHOT_EVENT,
        ({ payload }) => {
          notify(payload);
        },
      );
      unlisteners.push(unlistenSnapshot);

      notify(await invoke<PlaybackState>("cmd_media_snapshot"));
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
      void invoke<PlaybackState>("cmd_media_seek", { seconds })
        .then(notify)
        .catch((error) => console.warn("[TauriSource] cmd_media_seek failed:", error));
    },
  };
}
