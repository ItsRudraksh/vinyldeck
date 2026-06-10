# BUG-002: Mini Theme Persistence / Cross-Window Settings

Status: pending, skipped for later.

Date marked pending: 2026-06-11.

## Summary

Mini mode theme/customization syncing remains unresolved enough that work is paused. The suspected core issue is settings persistence and cross-window state authority between the `main` and `mini` Tauri WebViews.

## Evidence

- User observed main localStorage showing selected theme `paper`.
- Mini localStorage showed stale/default theme `noir` with a newer `writtenAt`.
- After main reload, main localStorage also became `noir`, matching the mini timestamp.
- Real Tauri Store file at `C:\Users\rudra\AppData\Roaming\com.vinyldeck.app\settings.json` was inspected and contained `theme: "noir"`, confirming the persisted store had been overwritten by stale/default state.
- Console/Tauri logs showed no frontend errors.

## Fixes Tried

- Made mini window creation async because Windows/Tauri WebView2 creation hung when building the mini WebView from a synchronous command. User confirmed this fixed blank/white mini creation.
- Moved main-window hide until after mini build completed.
- Added mini UX polish: centered vinyl, controls absolute overlay, hover/touch reveal, return-to-main button, corner snapping, and programmatic drag.
- Destroyed mini window when returning to main/fullscreen so closing main can exit.
- Tried `localStorage` handoff key `vinyldeck:settings-handoff` to pass current settings from main to mini. This was wrong and was removed because separate WebViews can hold stale localStorage and the mini could overwrite the real Tauri Store with default Noir.
- Current code uses only `tauri-plugin-store` for desktop persistence, flushes settings before opening mini, and clears the legacy localStorage handoff key during desktop settings load.

## Current Hypothesis

The app still needs a stronger cross-window settings/state strategy. Candidate directions:

- Single backend-owned settings source with Tauri commands/events and no independent per-window write authority.
- Main window owns settings writes; mini is read-only or receives events.
- Use Tauri event bus to emit settings snapshots on change and when mini becomes ready.
- Use a separate Rust-managed state object or store command API to avoid two WebViews racing through plugin-store.
- Reconsider whether mini should be a second WebView or a native overlay/child window with explicit hydration.

## Responsible Files

- `src/lib/settings/index.ts`
- `src/lib/settings/types.ts`
- `src/lib/playback/store.ts`
- `src/App.tsx`
- `src/components/Settings/index.tsx`
- `src/views/MiniView.tsx`
- `src-tauri/src/window/mod.rs`
- `src/lib/window/index.ts`
- `src/lib/window/types.ts`
- `src-tauri/capabilities/default.json`

## Decision

Do not spend more implementation time on this bug until a second diagnosis is available. Continue backend task list from the next approved item.
