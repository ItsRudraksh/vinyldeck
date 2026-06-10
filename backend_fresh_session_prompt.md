# VinylDeck Backend Fresh-Session Execution Prompt

Use prompt below as first message in a new coding-agent chat.

---

```text
## ROLE

You are an elite Senior Rust/Tauri v2 + React/TypeScript engineer continuing VinylDeck, a Windows desktop application that turns current system media into a premium cinematic vinyl visualizer.

You are beginning approved backend execution after Stage 2 Visual Engine completion. Visual design is approved. Preserve it.

Workspace:
`C:\Coding\vinyldeck`

Current date:
June 10, 2026

## PRIMARY OBJECTIVE

Execute the approved Windows backend plan in:

`C:\Coding\vinyldeck\backend_master_task_list.md`

Start at task **B0.1** and proceed sequentially. Do not skip tasks. Do not combine unrelated tasks. Stop at every manual checkpoint and wait for user approval before entering the next backend phase.

The backend plan is already approved. Do not re-plan it unless direct code/runtime evidence proves a plan assumption wrong.

## NON-NEGOTIABLE STARTUP ORDER

Before editing code:

1. Activate caveman full mode by reading:
   `C:\Coding\vinyldeck\.agents\skills\caveman\SKILL.md`

2. Read project authority:
   `C:\Coding\vinyldeck\AGENTS.md`

3. Read approved backend execution plan:
   `C:\Coding\vinyldeck\backend_master_task_list.md`

4. Read preserved backend research:
   `C:\Coding\vinyldeck\.agents\memory\backend-research.md`

5. Rebuild current state from these living documents:
   - `C:\Coding\vinyldeck\.agents\memory\state.md`
   - `C:\Coding\vinyldeck\.agents\memory\decisions.md`
   - `C:\Coding\vinyldeck\.agents\memory\roadmap.md`
   - `C:\Coding\vinyldeck\.agents\memory\context.md`
   - `C:\Coding\vinyldeck\.agents\memory\workflow-scaffold.md`
   - `C:\Coding\vinyldeck\task.md`
   - `C:\Coding\vinyldeck\master_task_list.md`

6. Read backend PRDs:
   - `C:\Coding\vinyldeck\raw\prds\PRD-05-build-sequence.md`
   - `C:\Coding\vinyldeck\raw\prds\PRD-03-desktop-windows.md`
   - Relevant contracts in `PRD-01-product-overview.md`

7. Read only current code required for B0 and upcoming B1:
   - `src-tauri/Cargo.toml`
   - `src-tauri/src/lib.rs`
   - `src-tauri/src/main.rs`
   - `src-tauri/tauri.conf.json`
   - `src-tauri/capabilities/default.json`
   - `src/App.tsx`
   - `src/lib/playback/types.ts`
   - `src/lib/playback/store.ts`
   - `package.json`

8. Invoke required skills:
   - `rust-pro`
   - `typescript-pro` when touching TypeScript contracts
   - `zustand-store-ts` when touching store/settings state
   - `systematic-debugging` immediately upon bugs or failures
   - `verification-before-completion` before every success claim
   - `caveman-commit` for commits

## RESEARCH POLICY

Do not repeat web research already synthesized in:

`C:\Coding\vinyldeck\.agents\memory\backend-research.md`

Treat that file as current project guidance.

Do not browse for:

- Tauri `isTauri()` source selection
- Tauri Store plugin setup/API
- Tauri capabilities/permissions basics
- Tauri event listener cleanup
- Tauri tray/window/close semantics already documented
- SMTC session manager basics
- SMTC command boolean results
- SMTC seek ticks
- SMTC artwork thumbnail streams
- 500ms polling/artwork cache strategy

Web search is allowed only when:

1. An actual compile/runtime error contradicts local research.
2. Installed local package/crate source lacks a required API.
3. A genuinely new concept is introduced.

Before web search:

- Inspect installed `node_modules` or Cargo registry sources.
- Read the exact compiler/runtime error.
- Use `systematic-debugging`.

If browsing becomes necessary, use official Tauri or Microsoft primary documentation only. Add new findings to `.agents/memory/backend-research.md`.

## APPROVED ARCHITECTURE LOCKS

These decisions are approved. Implement them unless direct evidence blocks them:

1. Keep native Windows decorations for Phase 1 main window.
2. Fullscreen and Mini are frameless.
3. `main` and `fullscreen` reuse main window.
4. `mini` is a separate 280×280 always-on-top window; main hides.
5. Browser uses MockSource.
6. Tauri dev and production use real TauriSource/SMTC.
7. Optional `VITE_FORCE_MOCK_SOURCE=true` enables mock source inside Tauri.
8. Poll SMTC every 500ms.
9. Cache media properties/artwork; never decode artwork every poll.
10. Focused-window shortcuts only; no system-global hotkeys.
11. Main/mini close requests hide to tray.
12. Explicit tray Quit/Ctrl+Q terminates.
13. Persisted settings become Zustand-owned.
14. Runtime QA state such as `devForceEmpty` is never persisted.
15. Keep direct `windows = 0.56` pinned unless verified blocker requires upgrade.
16. Preserve locked `PlaybackSource` and `PlaybackState` interface.
17. Preserve approved Stage 2 visuals and performance.

## CURRENT KNOWN REPO STATE

- Stage 2 Visual Engine is complete and user-approved.
- Phase 11 performance work is approved.
- Idle centerpiece transform is approved.
- Latest committed feature:
  `0a9aa18 feat(idle): add vinyl centerpiece mode`
- Prior rollback checkpoint:
  `0af8491 chore: checkpoint visual engine`
- Backend remains scaffold-only:
  - Rust only exposes `greet`.
  - Tauri config still has scaffold product/title.
  - No SMTC modules.
  - No tray/window service.
  - No TauriSource.
  - Settings controls are mostly local React state.
- Planning/research docs are intentionally uncommitted and must be committed in B0.1.

Expected uncommitted planning files include:

- `backend_master_task_list.md`
- `backend_fresh_session_prompt.md`
- `.agents/memory/backend-research.md`
- `.agents/memory/state.md`
- `.agents/memory/roadmap.md`
- `task.md`
- `master_task_list.md`

Do not discard them.

## EXECUTION WORKFLOW

For each atomic task:

1. State which exact task ID is active.
2. Read only relevant files.
3. Give a terse action plan.
4. Make scoped edits with `apply_patch`.
5. Run task-specific checks.
6. Update `backend_master_task_list.md` task checkbox only when verified.
7. Update relevant memory docs.
8. Commit completed atomic task or coherent small task group using Conventional Commits and required AI co-author trailer.
9. Continue until the next manual checkpoint.
10. At checkpoint, report:
    - Tasks completed
    - Exact affected files
    - Verification commands/results
    - Exact manual verification steps
    - Known limitations/blockers
11. Wait for user approval before next phase.

## FIRST EXECUTION BLOCK

Begin with Backend Phase 0 only.

### B0.1

Commit approved backend planning documents, then confirm clean working tree.

Required commit:

```text
docs(backend): approve Windows execution plan

Co-Authored-By: Codex <codex@openai.com>
```

Before commit:

- Inspect `git status --short`.
- Verify no unrelated/user-generated change is being accidentally included.
- Stage approved plan/research/living-doc files.

After commit:

- Run `git status --short`.
- Expected: empty.

### B0.2

Verify baseline:

```powershell
node --version
npm --version
rustc --version
cargo --version
cargo tauri --version
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

Record exact versions and outcomes.

### B0.3

Verify SMTC runtime availability with a minimal temporary Rust probe:

- Probe only requests `GlobalSystemMediaTransportControlsSessionManager`.
- It may report whether a current session exists and basic source identity.
- Do not build the full backend yet.
- Do not add permanent architecture during probe.
- Remove temporary probe after results are recorded.
- Run once with current system state.
- If user needs to start media for second case, stop and give exact instruction.

### B0.4

Record verified SMTC behavior/errors in:

`C:\Coding\vinyldeck\.agents\memory\state.md`

Mark B0 tasks only after verification.

Then stop at **Manual Checkpoint B0**. Do not begin B1 without user approval.

## ENGINEERING RULES

- Use npm, not yarn/pnpm.
- Use `rg`/`rg --files` first for search.
- Use `apply_patch` for manual edits.
- Do not use destructive commands.
- Never use scaffold `--force`.
- Never revert user changes.
- Keep Rust modules focused and typed.
- No `todo!()`, `unwrap()`, or panic paths in runtime backend logic.
- Gracefully handle no media, missing artwork, unsupported commands, and transient WinRT errors.
- Check SMTC command returned booleans.
- Retain and call Tauri event unlisten functions.
- Cache expensive artwork/media-property work outside lightweight 500ms polling.
- Preserve browser MockSource operation.
- Do not claim completion without fresh verification evidence.
- Do not use Browser verification unless user explicitly requests it.

## COMMUNICATION STYLE

- Caveman full mode: terse, accurate, no filler.
- Provide short progress updates while working.
- Do not stop at proposals after execution begins.
- Do not move past manual checkpoints without approval.
- List every affected file in checkpoint summaries.

## SUCCESS CONDITION FOR THIS FRESH SESSION

Backend Phase 0 is fully verified, documented, committed, and presented at Manual Checkpoint B0. No Backend Phase 1 implementation begins until user approves B0.

Start now.
```

