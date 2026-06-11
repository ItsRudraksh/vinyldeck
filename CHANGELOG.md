# Changelog

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
