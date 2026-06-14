# VinylDeck Full Audit, Documentation, Commit, And Push Prompt

Use this prompt in a fresh Codex chat/thread for the final consolidation pass.

## Short Handoff Prompt

```text
Read and follow `C:\Coding\vinyldeck\full_audit_docs_commit_handoff_prompt.md` exactly. This is a final VinylDeck consolidation pass: rebuild full context from current code/git/docs/memory, inspect the running app at `http://localhost:1420`, record all new project state into memory docs, identify unneeded files, update README/docs/version notes, then commit and push. Do not make any edits until the context/audit phase is complete and you have reported the planned edit/commit scope.
```

---

## Full Prompt

```text
You are Codex working in `C:\Coding\vinyldeck`.

This is a crucial final consolidation pass after multiple parallel implementation threads. Your job is to rebuild exact current context from the actual repository state, verify the running app, update project memory/docs, identify cleanup candidates, commit intentionally, and push.

Core rule: do not assume anything from old memory or prior chat summaries is current. Treat actual code, git diff, local docs, and the running app as truth.

Important: Do not make edits during the initial audit/context phase. First read, inspect, verify, and produce a concise audit plan with the exact files you intend to update. Only after that proceed with documentation/memory edits, checks, commit, and push.

Repository instructions:
- Read `C:\Coding\vinyldeck\AGENTS.md` first if present.
- Use caveman full mode if repo instructions require it, but keep final docs/prompts normal and clear.
- Use `rg` and `fd` for code/file research.
- Use `apply_patch` for manual edits.
- Do not revert unrelated dirty work unless explicitly instructed.
- Preserve user/other-thread changes.
- If something is ambiguous or risky, inspect concrete code and git history before deciding.
- Do not remove files during this pass unless they are clearly generated junk and user approval is given. Listing unneeded files is required; deletion is not automatically required.

Primary outcome:
1. Rebuild full project context from live repo state.
2. Inspect current git tree and all modified/untracked/deleted files.
3. Read relevant new/modified code directly, not only docs.
4. Interact with the running app at `http://localhost:1420`.
5. Update all relevant memory docs in `.agents/memory/`.
6. List unrequired or suspicious files currently in the codebase.
7. Update README and all relevant docs under `docs/`.
8. Set/report the app version appropriately using the project’s existing technical versioning conventions.
9. Run verification checks.
10. Commit all intended changes with proper attribution.
11. Push the branch.

Do not skip browser verification. The app is expected to already be running at:
`http://localhost:1420`

Use the Browser/in-app browser tool for visual and interactive verification. If Browser is unavailable, state that explicitly and use the best fallback, but do not silently skip app inspection.

Detailed workflow:

PHASE 0 - Safety Baseline

1. Confirm current working directory:
   - `pwd`
   - Expected: `C:\Coding\vinyldeck`

2. Read repo instructions:
   - `AGENTS.md`
   - any other local agent instructions if referenced by `AGENTS.md`

3. Record git baseline:
   - `git status --short --branch`
   - `git diff --stat`
   - `git diff --name-status`
   - `git branch --show-current`
   - `git remote -v`
   - `git log --oneline -n 10`

4. Do not edit yet. Store the observed state in your notes.

PHASE 1 - Rebuild Context From Living Memory And Planning Docs

Read all living memory documents under:
`C:\Coding\vinyldeck\.agents\memory\`

At minimum read:
- `.agents/memory/state.md`
- `.agents/memory/decisions.md`
- `.agents/memory/roadmap.md`
- `.agents/memory/context.md`
- `.agents/memory/workflow-scaffold.md`
- `.agents/memory/design-guidelines.md`
- `.agents/memory/animation-physics.md`
- `.agents/memory/ui-review-map.md`
- `.agents/memory/backend-research.md` if present
- any `.agents/memory/bugs/*.md`
- any `.agents/memory/reviews/*.md` that is directly relevant to current UI decisions

Also read:
- `README.md`
- `master_task_list.md`
- `backend_master_task_list.md`
- `interaction_polish_task_list.md` if present
- `task.md` if present
- every file in `docs/`
- PRDs in `raw/prds/`, especially:
  - `PRD-01-product-overview.md`
  - `PRD-02-visual-engine.md`
  - `PRD-03-desktop-windows.md`
  - `PRD-05-build-sequence.md`

Goal of this phase:
- Identify what docs claim is complete.
- Identify what docs are stale.
- Identify what decisions changed in recent code.
- Identify any pending manual approval notes that need to remain pending.

PHASE 2 - Inspect Current Code And Git Changes

Use `git status --short` and `git diff --name-only` to build a file map.

For every modified, deleted, and untracked source/doc/config file:
1. Read the file directly.
2. Understand whether it is product code, docs, memory, generated artifact, dependency output, scratch file, screenshot, or accidental junk.
3. If modified, inspect the diff:
   - `git diff -- <file>`
4. If untracked, inspect enough of the file to classify it.

Important likely areas to inspect carefully:
- `src/App.tsx`
- `src/views/MainView.tsx`
- `src/views/MiniView.tsx`
- `src/components/VinylRecord/`
- `src/components/NeedleArm/`
- `src/components/TrackInfo/`
- `src/components/Controls/`
- `src/components/ProgressRing/`
- `src/components/Settings/`
- `src/components/AmbientLayer/`
- `src/components/AppContextMenu/`
- `src/components/Tooltip/`
- `src/components/Kbd/`
- `src/components/LiquidGlass/`
- `src/hooks/`
- `src/lib/playback/`
- `src/lib/settings/`
- `src/lib/themes/`
- `src/lib/trackTransition/`
- `src/styles/`
- `src-tauri/src/settings/`
- `src-tauri/src/tray.rs`
- `src-tauri/tauri.conf.json`
- `package.json`
- `package-lock.json`
- any version-bearing files

Specific implementation facts to verify from code:
- WebGL vinyl renderer is preserved but hardcoded OFF.
- Center spindle hole is removed and must remain removed.
- CSS vinyl renderer is the active path.
- TrackInfo transition direction:
  - `next`: new track enters from left and old exits right.
  - `previous`: new track enters from right and old exits left.
- VinylRecord must not slide left/right on track transitions.
- VinylRecord may use only in-place rotational skip impulse.
- NeedleArm is one visually connected assembly, not disconnected floating pieces.
- Progress timer/render isolation perf pass is present.
- Mouse sheen is RAF-throttled.
- `useVinylRotation` has one scheduler/RAF structure, not duplicated RAF starters.
- Shortcut editing UI is cancelled/not implemented.
- Start-with-Windows/autostart is cancelled/not implemented.
- Splash screen is cancelled/not implemented.
- Interaction polish features are present if code says they are present:
  - scrub blink fix / pending seek
  - tooltips
  - keyboard shortcut enable toggle
  - context menu
  - quit-to-tray toggle
  - directional track text transition
  - prev/next vinyl skip impulse
  - tonearm connector/completeness fix

PHASE 3 - Browser Verification Of Running App

Open `http://localhost:1420` in the in-app Browser.

If already open, reload once after code/doc changes are not yet made; initially just inspect current app.

Use browser screenshots and DOM inspection where useful.

Verify these user flows manually through Browser:
1. App loads with main player visible.
2. Play/pause button works visually.
3. Previous/next controls work visually.
4. TrackInfo direction feels correct:
   - Next should move left-to-right as requested.
   - Previous should move right-to-left as requested.
5. Vinyl does not slide; it remains physically anchored.
6. Vinyl has no center spindle hole.
7. WebGL is not active:
   - wrapper should report CSS renderer if inspectable.
   - no WebGL canvas should be active/mounted if feature flag is hard-OFF.
8. NeedleArm appears connected as one assembly.
9. Art Ambient toggle works visually on/off.
10. Theme switching works:
    - Noir
    - Glass
    - any other currently exposed themes, if present
11. Settings opens/closes.
12. Settings tabs and toggles work at least enough to confirm UI is not broken.
13. Keyboard shortcuts toggle exists and affects shortcuts if implemented.
14. Quit-to-tray toggle exists if implemented.
15. Custom right-click context menu opens.
16. Context menu actions are present and do not visually break the page.
17. Mini view/window mode controls if available through UI/context/settings.
18. Source badge renders.
19. No obvious overlap, disconnection, missing assets, or visually broken major UI elements.

Capture notes:
- What passed.
- What needs user manual review.
- Any visual issues discovered.
- Do not fix new visual issues unless they are documentation-only or tiny clearly safe text corrections. This pass is mainly consolidation, docs, and commit.

PHASE 4 - Classify Unrequired/Suspicious Files

Produce a cleanup candidate list. Do not delete by default.

Classify:
- screenshots or pasted images, e.g. `image.png`, `image copy.png`, temporary clipboard assets
- one-off context files, e.g. `shadcn-*.md`
- completed task plans that may or may not belong in repo
- generated build outputs accidentally present
- orphaned code made dormant intentionally, such as WebGL files
- deleted files that need explanation, e.g. `fresh_session_prompt.md`
- duplicate docs or stale prompt files

For each item, provide:
- path
- current git status: tracked modified/deleted or untracked
- category
- recommendation: keep, move to docs/archive, ignore, add to `.gitignore`, delete after approval, or commit
- reason

PHASE 5 - Audit Plan Before Editing

Before making edits, report:
1. Files you plan to edit.
2. Files you plan to stage.
3. Files you recommend not staging.
4. Docs/memory updates needed.
5. Verification commands you will run.
6. Commit message proposal.

Then continue unless you hit a risky ambiguity requiring user approval.

PHASE 6 - Update Memory Docs

Update all relevant files in `.agents/memory/` so future agents have accurate current state.

At minimum update:
- `.agents/memory/state.md`
  - current stage/status
  - completed interaction polish state
  - WebGL dormant OFF decision
  - spindle hole removed decision
  - TrackInfo direction mapping
  - VinylRecord no slide decision
  - NeedleArm connected assembly state
  - cancelled discussion items:
    - shortcut editing UI
    - start-with-Windows/autostart
    - splash screen
  - remaining blockers/manual approvals
- `.agents/memory/decisions.md`
  - record architectural decisions and cancelled features
  - record performance constraints: no visual downgrade for perf changes
  - record active renderer decision
- Any other memory docs whose content is stale after current implementation.

Rules:
- Memory must be concise but complete.
- Do not exaggerate verification. If something was visually inspected but not exhaustively tested, say that.
- Do not mark work “done” if user manual approval is still pending.

PHASE 7 - Update README And Docs

Read all docs before editing. Update only what is stale or missing.

Likely docs:
- `README.md`
- `docs/API.md`
- `docs/USER_GUIDE.md`
- `docs/TROUBLESHOOTING.md`
- any architecture/design/dev docs under `docs/`

Documentation updates must reflect actual current app behavior:
- Current tech stack.
- How to run:
  - `npm install`
  - `npm run dev` or exact command currently used
  - `npm run tauri dev`
  - `npm run build`
  - frontend test command
  - Rust/Tauri test command
- Current settings/features:
  - themes
  - Art Ambient
  - keyboard shortcuts toggle
  - quit-to-tray toggle
  - context menu
  - mini mode if implemented
  - track transitions
  - vinyl pressing behavior
- Cancelled/not-current features:
  - shortcut editing UI
  - start with Windows
  - splash screen
  - active WebGL vinyl renderer
- Known dormant experiment:
  - WebGL vinyl code exists but hardcoded OFF
- Manual verification steps.
- Troubleshooting for local dev, Tauri, settings, tray/quit behavior if relevant.

Versioning:
- Inspect `package.json`, `src-tauri/tauri.conf.json`, Cargo metadata, README badges, and docs for current version.
- Determine existing versioning convention.
- If this consolidation warrants a version bump, apply a technically appropriate version bump consistently across all version-bearing files.
- If version should not change, document current version accurately.
- Do not invent marketing version names unless project already uses them.

PHASE 8 - Verification

Run relevant checks after docs/memory edits:
- `npm run build`
- `npm run test:frontend`
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `git diff --check`

If a check fails:
1. Read the full failure.
2. Fix only if it is in your scope and clearly caused by your changes.
3. If unrelated/baseline, report it clearly and ask before broad fixes.

Do not claim pass without fresh command output from this session.

PHASE 9 - Stage, Commit, Push

Before staging:
- Review `git status --short`.
- Review `git diff --stat`.
- Review diffs for all files you intend to stage.
- Ensure no accidental screenshots, local temp files, or scratch files are staged unless intentionally part of docs.

Stage only intended files.

Commit requirements:
- Use an intentional concise commit message.
- Include AI co-author attribution required by repo instructions:
  `Co-Authored-By: (the agent model's name and attribution byline)`
- If repo has an established commit style, follow it.

Suggested commit subject:
`docs: consolidate current app state`

Suggested commit body structure:
- Summarize memory/docs updates.
- Summarize verification.
- Note that WebGL remains dormant/off, and cancelled items remain cancelled.
- Include co-author line.

After commit:
- Push current branch to its upstream if configured.
- If upstream is not configured, inspect remotes and branch name, then push with `--set-upstream origin <branch>` only if safe.
- Report commit hash and push result.

PHASE 10 - Final Report

Final response must include:
1. What context was rebuilt.
2. What app flows were verified in Browser.
3. What docs/memory files were updated.
4. What unneeded/suspicious files were found and recommendations.
5. Version decision/bump details.
6. Verification command results.
7. Commit hash.
8. Push result.
9. Remaining manual review items, if any.

Tone:
- concise but complete
- no overclaiming
- concrete file paths
- no “done” unless commit and push succeeded

Hard boundaries:
- Do not implement shortcut editing UI.
- Do not implement autostart/start-with-Windows.
- Do not implement splash screen.
- Do not re-enable WebGL vinyl.
- Do not add vinyl left/right slide.
- Do not restore center spindle hole.
- Do not simplify or degrade visual effects for performance.
- Do not delete cleanup candidates without approval.
- Do not silently skip Browser verification.
- Do not stage unrelated local junk.
```
