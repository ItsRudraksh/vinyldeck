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
  - S: settings
  - A: Art Ambient
  - Escape: exit fullscreen or close settings first
  - Ctrl+Q: explicit quit

Shortcuts can be disabled from Settings -> Other. Escape remains available for Settings/fullscreen escape behavior.

## Window Modes

- Main mode is the standard native Windows window.
- Fullscreen reuses the main window.
- Mini mode opens a compact always-on-top player window and hides the main window.
- Closing app windows hides them to tray. Use tray Quit or Ctrl+Q for a full exit.

## Themes And Settings

VinylDeck currently exposes two visual shells: Noir and Glass. Older Aurora, Vapor, and Paper saved values are migrated into the current shell/ambient model. Settings persist through the Rust backend and sync across main/mini windows.

Art Ambient is an optional album-colour glow for the active shell. Film Grain, Vinyl Wobble, Lean-Back Mode, Cursor Hide, Idle Timeout, Always On Top, Window Mode, Keyboard Shortcuts, and Quit To Tray are persisted settings.

Right-click the main player for the custom VinylDeck context menu: playback actions, Art Ambient, fullscreen, mini, Settings, and Quit. In mini mode, the menu keeps mini-safe actions.

Track changes are directional when triggered inside VinylDeck: Next enters from the left and exits right; Previous enters from the right and exits left. The record remains anchored and only receives an in-place rotational skip impulse.

## V1 Limitations

- This is the V1 development baseline, not the final distribution pass.
- Version is `0.1.0`.
- Phase 11 installer validation is deferred.
- Tray open/mini/quit lifecycle is available. Tray playback controls need SMTC-path revalidation before distribution.
- Shortcut editing UI, start-with-Windows/autostart, splash screen, and active WebGL vinyl are not implemented.
