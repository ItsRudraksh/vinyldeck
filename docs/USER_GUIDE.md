# User Guide

## Start VinylDeck

Run the desktop app with:

```powershell
npm run tauri dev
```

Start media in Spotify, a browser, or VLC. VinylDeck should pick up the active Windows media session and show track details, album art, play state, duration, and controls.

## Controls

- Play/pause, previous, and next are available when the current source reports support.
- Seek is hidden/disabled when unsupported. V1 relies on SMTC state resync rather than forcing a fake progress model.
- Keyboard shortcuts work while the VinylDeck window is focused:
  - Space: play/pause
  - Left/Right: previous/next
  - F: fullscreen
  - M: mini player
  - T: cycle theme
  - Escape: exit fullscreen or close settings first
  - Ctrl+Q: explicit quit

## Window Modes

- Main mode is the standard native Windows window.
- Fullscreen reuses the main window.
- Mini mode opens a compact always-on-top player window and hides the main window.
- Closing app windows hides them to tray. Use tray Quit or Ctrl+Q for a full exit.

## Themes And Settings

VinylDeck includes Noir, Glass, Aurora, Vapor, and Paper themes. Settings persist through the Rust backend and sync across main/mini windows.

Album Art Ambient is intentionally Noir-only. Film Grain, Vinyl Wobble, Lean-Back Mode, Cursor Hide, Idle Timeout, Always On Top, and Window Mode are persisted settings.

## V1 Limitations

- This is the V1 development baseline, not the final distribution pass.
- Phase 11 installer validation is deferred.
- Tray open/mini/quit lifecycle is available. Tray playback controls need SMTC-path revalidation before distribution.
