# VinylDeck 0.1.0 Release Notes

VinylDeck `0.1.0` is the current Windows desktop MVP baseline. It is suitable for local development, visual review, and desktop integration testing.

## Included

- Tauri v2 Windows desktop shell
- React 19 visual engine
- Real Windows SMTC media snapshots
- In-app play/pause, previous, next, and seek commands when supported
- Main, fullscreen, and mini-player windows
- Tray lifecycle with explicit quit
- Backend-owned persisted settings
- Noir and Glass visual shells
- Album-art ambient color extraction
- Animated CSS vinyl deck with physical tonearm
- Keyboard shortcuts, tooltips, keycap hints, and context menu
- Frontend and Rust regression tests

## Build Metadata

| Item | Value |
| --- | --- |
| App version | `0.1.0` |
| Package name | `vinyldeck` |
| Product name | `VinylDeck` |
| Tauri identifier | `com.vinyldeck.app` |
| Bundle targets | MSI, NSIS |

## Verification

Use these commands for the release baseline:

```powershell
npm run build
npm run test:frontend
npm run fmt:rust
npm run clippy:rust
npm run test:rust
npm run tauri build -- --debug
```

## Known Release Work

Before a public packaged release, complete:

- clean installer validation
- WebView2 bootstrap validation
- uninstall/reinstall smoke test
- settings-location verification
- player compatibility matrix
- bundle identifier review
- tray playback command-path revalidation

## Out Of Scope For 0.1.0

- shortcut editing UI
- start-with-Windows/autostart
- splash screen
- active WebGL vinyl renderer
- mobile builds
