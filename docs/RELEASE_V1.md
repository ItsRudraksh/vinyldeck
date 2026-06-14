# VinylDeck 0.1.0 Release Notes

VinylDeck `0.1.0` is the current Windows desktop MVP baseline. Release installers have been built and smoke-tested on Windows.

## Included

- Tauri v2 Windows desktop shell
- React 19 visual engine
- Real Windows SMTC media snapshots
- In-app play/pause, previous, next, and seek commands when supported
- Main, fullscreen, and mini-player windows
- Tray lifecycle with explicit quit
- Backend-owned persisted settings
- Opt-in Start With Windows setting
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

Release installers built on 2026-06-14:

| Installer | Size | Notes |
| --- | ---: | --- |
| `VinylDeck_0.1.0_x64_en-US.msi` | 3.82 MiB | Installed successfully; appears in Control Panel |
| `VinylDeck_0.1.0_x64-setup.exe` | 2.61 MiB | NSIS installer output |

Installed-app validation:

- MSI install completed successfully.
- Default install location is acceptable.
- Custom install location `C:\Apps\VinylDeck` worked.
- App appeared in Windows Control Panel.
- User verified expected app behavior after installation.
- Installer size is accepted as optimal for this release.

## Known Release Work

Before a public packaged release, complete or recheck:

- WebView2 bootstrap validation
- settings-location verification
- player compatibility matrix
- bundle identifier review
- tray playback command-path revalidation
- code signing to replace Windows UAC `Publisher: Unknown`

## Out Of Scope For 0.1.0

- shortcut editing UI
- splash screen
- active WebGL vinyl renderer
- mobile builds
