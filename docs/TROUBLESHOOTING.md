# Troubleshooting

## No Track Appears

- Confirm the media app exposes Windows media controls.
- Try Spotify first; it was the primary live validation source.
- Start playback after VinylDeck is open and wait about one poll interval.
- Use `npm run tauri dev`; browser `npm run dev` uses mock playback only.

## Track Details Look One Song Behind

This was fixed in the Phase 8/9 sync pass by including track metadata in the artwork cache key and routing Tauri through real SMTC snapshots/events. If it returns, inspect `src-tauri/src/media/poller.rs` and `src/lib/playback/tauriSource.ts` first.

## Controls Are Disabled

VinylDeck respects SMTC capability flags. Some sources allow play/pause but not previous/next or seek.

## Progress Looks Less Than Real Time

The backend polls SMTC every 500ms and emits position resyncs periodically. The UI should not invent unsupported seeking behavior. Prefer capability-gated controls over fake progress state.

## App Closes To Tray Instead Of Exiting

This is expected while `Quit To Tray` is enabled. Turn it off in Settings -> Other if the window close button should exit the app. Tray Quit and Ctrl+Q always request explicit exit when shortcuts are enabled.

## Keyboard Shortcuts Do Nothing

Check Settings -> Other -> Keyboard Shortcuts. When disabled, all focused-window shortcuts are disabled except Escape for closing Settings or leaving fullscreen.

## WebView2 Shutdown Log

A benign WebView2 shutdown message was observed during manual lifecycle testing. Treat it as non-blocking unless it coincides with a failed reopen or stuck process.

## Debug Bundle Warning

`npm run tauri build -- --debug` currently emits a non-blocking warning that `com.vinyldeck.app` ends with `.app`. Handle this during the deferred Phase 11 distribution cleanup.

## Tray Playback Menu Does Not Match In-App SMTC Controls

The in-app controls use `cmd_smtc_*`. The tray playback menu still references the legacy backend media command path. Revalidate and unify this before treating tray playback as distribution-ready.

## WebGL Vinyl Is Not Active

Expected. The WebGL renderer is a dormant experiment and is hardcoded off. The CSS vinyl renderer is the active path.
