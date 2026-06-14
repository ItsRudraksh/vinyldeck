# Changelog

## Current Consolidation - 2026-06-14

### Added

- Interaction polish documentation for optimistic seek display, directional track text, in-place vinyl skip impulse, complete tonearm pass, tooltips/keycaps, custom context menu, Keyboard Shortcuts toggle, and Quit To Tray toggle.
- Browser verification notes for the current main player at `http://localhost:1420/`.

### Changed

- Documented Noir and Glass as the active shells; Aurora, Vapor, and Paper are legacy-migrated values.
- Documented CSS vinyl as the active renderer with WebGL hard-OFF.
- Kept version at `0.1.0` across package, Tauri, and Cargo metadata.

### Deferred

- Final manual approval in the live Tauri shell for the latest interaction polish.
- Shortcut editing UI, start-with-Windows/autostart, splash screen, active WebGL vinyl, and Phase 11 distribution validation.

## V1 Baseline - 2026-06-11

### Added

- Windows Tauri shell for VinylDeck.
- Real SMTC media snapshots, artwork, capabilities, and in-app controls.
- Cached SMTC polling bridge with semantic-change events and position resyncs.
- Backend-owned settings authority with cross-window sync.
- Main, fullscreen, mini window modes, tray lifecycle, and focused shortcuts.
- Standard documentation set: README, architecture, API, development, user guide, troubleshooting, release notes, and `llms.txt`.

### Fixed

- Same-duration track changes no longer reuse stale artwork/metadata.
- Tauri source lifecycle now cleans event listeners and avoids duplicate source subscriptions.
- Controls and shortcuts respect source capabilities.

### Deferred

- Phase 11 Windows distribution validation.
- Tray playback menu SMTC path unification before distribution-grade release.
