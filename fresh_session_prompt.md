# VinylDeck Fresh Session Prompt

Use this as the first message in any new VinylDeck coding-agent chat.

```text
Continue VinylDeck in a fresh coding-agent session.

Workspace:
C:\Coding\vinyldeck

Core rule:
Do not restart planning. Rebuild current state from local docs, memory, and git, then wait for the user's newest instruction.

Startup sequence:

1. Read and follow:
   - C:\Coding\vinyldeck\AGENTS.md
   - C:\Coding\vinyldeck\fresh_session_prompt.md

2. Activate the repo's required efficiency mode by reading:
   - C:\Users\rudra\.agents\skills\caveman\SKILL.md

3. Rebuild project state from living memory:
   - C:\Coding\vinyldeck\.agents\memory\state.md
   - C:\Coding\vinyldeck\.agents\memory\decisions.md
   - C:\Coding\vinyldeck\.agents\memory\context.md
   - C:\Coding\vinyldeck\.agents\memory\roadmap.md
   - C:\Coding\vinyldeck\.agents\memory\workflow-scaffold.md
   - C:\Coding\vinyldeck\.agents\memory\backend-research.md

4. Read project docs enough to understand current scope:
   - C:\Coding\vinyldeck\README.md
   - C:\Coding\vinyldeck\docs\ARCHITECTURE.md
   - C:\Coding\vinyldeck\docs\DEVELOPMENT.md
   - C:\Coding\vinyldeck\docs\RELEASE_V1.md
   - C:\Coding\vinyldeck\llms.txt

5. Read planning/task files:
   - C:\Coding\vinyldeck\task.md
   - C:\Coding\vinyldeck\backend_master_task_list.md
   - C:\Coding\vinyldeck\raw\prds\PRD-05-build-sequence.md
   - The PRD relevant to the user's current task.

6. Inspect git before editing:
   - git status --short
   - git log --oneline -8

7. Identify the current task from the newest user request plus local state. Do not assume the next unchecked checkbox is automatically active if memory/docs say it is on hold.

Current baseline:

- Current repo is the V1 documentation/build baseline.
- Backend Phase 10 automated hardening passed.
- Real Spotify/SMTC sync was user-approved as seamless.
- Phase 11 Windows distribution is on hold until the user explicitly resumes it.
- Standard docs exist under docs/, with README.md, CHANGELOG.md, and llms.txt.
- In-app playback uses real SMTC through TauriSource and cmd_smtc_*.
- Browser development uses MockSource.
- Persisted settings are backend-owned through Rust commands/events.
- Tray open/mini/quit lifecycle exists; tray playback menu SMTC unification should be revalidated before distribution-grade release.

Research policy:

- Do not repeat completed backend research; use .agents/memory/backend-research.md.
- Browse only for a new or contradictory compile/runtime/API problem.
- Prefer installed package/crate source and official docs.
- If new durable research is discovered, update .agents/memory/backend-research.md.

Implementation workflow:

1. State the active task in one terse line.
2. Read only relevant files.
3. Make scoped edits with apply_patch.
4. Run task-appropriate verification.
5. Update affected memory docs in .agents/memory/.
6. Update task/planning docs if status changed.
7. If this prompt becomes stale, update C:\Coding\vinyldeck\fresh_session_prompt.md in the same change.
8. Commit coherent verified work when appropriate using Conventional Commits and:

   Co-Authored-By: Codex <codex@openai.com>

Manual checkpoints:

- Stop at explicit manual checkpoints.
- Report affected files, verification commands/results, manual test steps, and known limitations.
- Do not move past a held phase or manual checkpoint without user approval.

Safety:

- Use npm, not yarn or pnpm.
- Use rg/fd for search.
- Never use destructive commands or scaffold --force.
- Never revert user changes unless explicitly asked.
- Preserve approved visuals and backend-owned authority rules.
- Do not claim completion without verification.

Begin by rebuilding context, checking git state, and following the user's newest instruction.
```
