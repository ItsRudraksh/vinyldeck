# VinylDeck Backend Continuation Prompt

Use this prompt when a backend execution chat becomes too large and work must continue in a fresh chat.

---

````text
## CONTEXT

Previous VinylDeck backend chat became too large. Continue remaining backend work in this fresh chat without restarting planning or repeating completed research.

Workspace:
`C:\Coding\vinyldeck`

Current date:
June 11, 2026

## ROLE

You are an elite Senior Rust/Tauri v2 + React/TypeScript engineer continuing VinylDeck, a Windows desktop app that turns current system media into a premium cinematic vinyl visualizer.

Stage 2 Visual Engine is approved. Preserve visuals and performance.

## FIRST RULE

Do not start from scratch.

Rebuild state from local project files, determine last completed backend task, then continue from the next unchecked task in:

`C:\Coding\vinyldeck\backend_master_task_list.md`

As of this handoff, Backend Phase 0 through Phase 9 are complete and manually approved, including the B8 same-duration track/artwork sync fix and B9 frontend TauriSource integration. Backend Phase 10 is active: B10.1-B10.2 are implemented and verified. Continue from the next unchecked task in `backend_master_task_list.md`, currently **B10.3**.

## REQUIRED STARTUP ORDER

Before code edits:

1. Read caveman mode:
   `C:\Coding\vinyldeck\.agents\skills\caveman\SKILL.md`

2. Read project rulebook:
   `C:\Coding\vinyldeck\AGENTS.md`

3. Read backend execution plan:
   `C:\Coding\vinyldeck\backend_master_task_list.md`

4. Read backend research cache:
   `C:\Coding\vinyldeck\.agents\memory\backend-research.md`

5. Read living state:
   - `C:\Coding\vinyldeck\.agents\memory\state.md`
   - `C:\Coding\vinyldeck\.agents\memory\decisions.md`
   - `C:\Coding\vinyldeck\.agents\memory\roadmap.md`
   - `C:\Coding\vinyldeck\task.md`
   - `C:\Coding\vinyldeck\master_task_list.md`

6. Inspect Git state:
   - `git status --short`
   - `git log --oneline -5`

7. Read only code files relevant to the next unchecked backend task.

8. Invoke needed skills:
   - `rust-pro` for Rust/Tauri/SMTC
   - `typescript-pro` for TS contracts/adapters
   - `zustand-store-ts` for store/settings work
   - `systematic-debugging` on first failure
   - `verification-before-completion` before any success claim
   - `caveman-commit` for commits

## RESEARCH POLICY

Do not repeat completed web research.

Use:
`C:\Coding\vinyldeck\.agents\memory\backend-research.md`

as local source of truth for:

- Tauri `isTauri()` source selection
- Tauri Store plugin setup/API
- Tauri capabilities/permissions
- Tauri event listener cleanup
- Tauri tray/window/close semantics
- SMTC session manager basics
- SMTC command boolean results
- SMTC seek ticks
- SMTC artwork thumbnail streams
- 500ms polling/artwork cache strategy

Browse only if:

1. Exact compile/runtime error contradicts local research.
2. Installed `node_modules` or Cargo registry lacks required API.
3. New backend concept appears.

If browsing happens, use official Tauri or Microsoft docs only, then update:
`C:\Coding\vinyldeck\.agents\memory\backend-research.md`

## APPROVED ARCHITECTURE LOCKS

- Native Windows titlebar for Phase 1 main window.
- Fullscreen and Mini frameless.
- `main` and `fullscreen` reuse main window.
- `mini` is separate `280×280`, always-on-top, main hidden.
- Browser uses MockSource.
- Tauri dev/build uses real SMTC/TauriSource.
- Optional `VITE_FORCE_MOCK_SOURCE=true` can force MockSource in Tauri.
- SMTC polls every 500ms.
- Cache artwork/media properties; never decode artwork every poll.
- Focused-window shortcuts only.
- Close hides to tray.
- Explicit Quit/Ctrl+Q exits process.
- Persisted settings are backend-owned through Rust commands/events; Zustand is a frontend cache only.
- Runtime QA state like `devForceEmpty` is never persisted.
- Keep `windows = 0.56` unless verified blocker requires upgrade.
- Preserve locked `PlaybackSource` / `PlaybackState`.
- Preserve approved Stage 2 visuals.

## CURRENT HANDOFF STATE

- B4 tray/lifecycle is approved: tray menu, Open/Mini, tray playback controls, close-to-tray, left-click restore, tray status sync.
- B5 focused shortcuts are approved: Space, Left/Right, F, M, T, Escape, Ctrl+Q. Explicit quit destroys main/mini before exit; `Chrome_WidgetWin_0 Error = 1412` is documented as non-blocking WebView2/Chromium teardown noise when the process exits cleanly.
- B6 SMTC data model/core is approved: direct `windows = 0.56`, Rust `MediaSnapshot`, SMTC acquisition, lightweight playback/timeline/capability read, metadata read, bounded artwork stream-to-data-URL helper.
- B7 SMTC commands are approved and manually tested against Spotify: `cmd_smtc_snapshot`, `cmd_smtc_play`, `cmd_smtc_pause`, `cmd_smtc_toggle_play_pause`, `cmd_smtc_next`, `cmd_smtc_previous`, `cmd_smtc_seek`.
- `cmd_smtc_snapshot` intentionally returns `artworkDataUrl: null` for now. SMTC artwork is available as a WinRT stream, but artwork stream refs are not safe inside Tauri command futures. Phase 8 should handle artwork inside the poller/backend boundary, convert stream -> bytes -> data URL, then emit plain `MediaSnapshot`.
- Current `TauriSource` no longer calls the old `cmd_media_*` backend mock authority for Tauri playback. Initial load uses `cmd_smtc_snapshot`, events come from the B8 poller, and controls invoke real `cmd_smtc_*` commands. Browser mock behavior remains separate.
- B8.1-B8.6 plus sync fix are complete and manually approved: `src-tauri/src/media/poller.rs` starts one guarded 500ms SMTC poller from setup, survives transient SMTC errors with rate-limited logs, reads metadata text every poll, caches artwork by source + track + artist + album + duration identity, emits immediate semantic changes, emits 2s position resyncs, sends one empty snapshot on session end, blocks duplicate pollers, suppresses redundant unchanged events, and has fake-snapshot state-machine tests. User confirmed real Spotify sync is seamless.
- B9.1-B9.7 are complete and manually approved. `src/lib/playback/tauriSource.ts` validates unknown Tauri IPC/event payloads against the Rust `MediaSnapshot` camelCase serde contract, maps null/undefined snapshots to `EMPTY_PLAYBACK`, subscribes to `media-state-changed`, fetches initial state through `cmd_smtc_snapshot`, handles start/stop listener races so retained unlisteners run once, and invokes real `cmd_smtc_*` controls in fire-and-forget mode with bounded error logging. Zustand store owns source teardown through `clearSource(source?)`. Runtime source factory exists at `src/lib/playback/sourceFactory.ts`, and App uses it. Vitest adapter/lifecycle tests exist.
- B10.1-B10.2 are complete: Rust poller regression covers cold no-media, media starts after app, media app exits, repeated no-media silence, media restart, and session switch between players. Metadata/artwork edge tests cover missing artwork, empty metadata, oversized/unknown artwork bytes, unknown/non-finite duration handling, sparse poller snapshots, and frontend adapter acceptance/rejection. Next work: B10.3 command capability edge cases.

## CONTINUATION WORKFLOW

1. Identify last completed backend task from `backend_master_task_list.md`, Git log, and memory docs.
2. State next active task ID.
3. Give terse action plan.
4. Edit only files needed for that task.
5. Run task-specific verification.
6. Mark task checkbox only after verification.
7. Update memory/task docs.
8. Commit coherent verified work with Conventional Commit +:

```text
Co-Authored-By: Codex <codex@openai.com>
````

9. Continue until next manual checkpoint.
10. At checkpoint, stop and report:
    - completed tasks
    - affected files
    - verification results
    - manual verification steps
    - blockers/risks

Do not proceed past manual checkpoint without user approval.

## SAFETY RULES

- Use npm only.
- Use `rg`/`rg --files` for search.
- Use `apply_patch` for manual edits.
- No destructive commands.
- Never use scaffold `--force`.
- Never revert user changes.
- No runtime `todo!()`, `unwrap()`, or panic paths.
- Handle no media, missing artwork, unsupported controls, transient WinRT errors.
- Check SMTC command returned booleans.
- Retain/call Tauri event unlisten functions.
- Preserve browser MockSource behavior.
- Do not use Browser verification unless user explicitly requests it.
- No completion claim without fresh verification.

## OUTPUT STYLE

Caveman full mode. Terse, technical, no filler.

## BEGIN

Rebuild context, identify next unchecked backend task, and continue from there.

```

```
