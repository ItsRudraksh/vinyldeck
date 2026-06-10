# Agent Instructions: VinylDeck

Always use **caveman full mode** for maximum token efficiency (`/caveman full` or auto-trigger).

## The VinylDeck Implementation Workflow (Strictly Enforced)

Every new implementation session MUST follow this exact sequence:

1. **Initialize Efficiency**: Read `AGENTS.md` and activate `caveman full mode`.
2. **Rebuild Context**: Read ALL living documents inside `c:\Coding\vinyldeck\.agents\memory\`. This is the brain of the project.
3. **Consult PRDs**: You MUST read the Project Requirements Documents (`raw/prds/`). If you don't read them all, you must at minimum read `PRD-05-build-sequence.md` and the specific PRD relevant to the current phase on the roadmap.
4. **Scope the Task**: ONLY read the key files/code relevant to the current stage or implementation phase. Do not blow up context by reading the whole codebase.
5. **Visuals (No Self-Assuming)**: For visual implementations, NEVER self-assume design.
   - Consult `c:\Coding\vinyldeck\.agents\memory\stitch-ui-designs.txt`.
   - Read `top_20_designs.md` and detailed reviews (`.agents/memory/reviews/detailed_*.md`).
   - Inspect the HTML and image files directly to capture the exact CSS properties.
6. **Implementation & Fast Tooling**: Execute the task.
   - **Research Tooling**: You have access to `rg` (ripgrep) and `fd` (fd-find) on this system. Use these native, blazingly fast tools for file and directory research instead of slow, raw PowerShell commands.
   - You have the freedom to deviate from the PRDs if a decision is better, BUT you must auto-verify and auto-test your implementation before committing.
7. **Bug Handling**: If an implementation causes a bug or you are unsure, DO NOT guess. Immediately use the web search tool to search for possible solutions, combining it with your own reasoning to find the up-to-date fix.
8. **Execution Summary**: Once complete, summarize exactly what was done and explicitly list ALL affected files (even if only 1 character was changed).
9. **Manual Verification**: Provide exact steps for the user to manually verify the implementation. Do not mark the task as "Done" until the user has manually tested and approved it.
10. **Update Memory**: Before finishing, update all relevant memory docs in `.agents/memory/` so no information is left stale.

## Authorized Skills to Invoke (By Use Case)

You MUST invoke the right set of skills based on the task at hand for maximum efficiency. Use the `view_file` tool to load these skills from `c:\Coding\vinyldeck\.agents\skills\`.

### Frontend & Visual Engine

- **`react-component-performance`**: Invoke for strict 60fps+ requirements to prevent React re-render bloat.
- **`react-ui-patterns`**: Invoke when scaffolding new views.
- **`zustand-store-ts`**: Invoke for global state management setup.
- **`design-taste-frontend` / `high-end-visual-design`**: Invoke to enforce cinematic, physical UI aesthetics.
- **`minimalist-ui`**: Invoke for clean, typography-focused layouts.

### Backend & Desktop Shell (Rust/Tauri)

- **`rust-pro`**: Invoke when writing the SMTC polling loop, Tauri commands, or any Rust backend logic.

### General Workflow & Parallelization

- **`caveman` / `caveman-help`**: Always trigger for token compression.
- **`caveman-commit`**: Invoke for writing ultra-compressed conventional commits.
- **`subagent-driven-development` / `dispatching-parallel-agents`**: Invoke when handling multi-file/independent scaffolding tasks to parallelize work.

### Debugging & Verification

- **`systematic-debugging`**: Invoke immediately when hitting bugs, panics, or test failures before proposing fixes.
- **`verification-before-completion`**: Invoke to ensure you do not claim success without running code/tests.

## Core Tech Stack

- **Frontend**: React 19, TypeScript, `motion/react` v12, Zustand v5, `@vibrant/core`
- **Backend**: Tauri v2, Rust
- **Styling**: Pure CSS (Custom Properties for themes), no Tailwind. Theming based on 5 core cinematic identities: Noir, Glass, Aurora, Vapor, Paper.

## Living Memory Documents (`.agents/memory/`)

Agents MUST update these files to preserve context across sessions. Never assume a user will remember where we left off.

- `state.md`: Current progress, blockers, and active stage.
- `decisions.md`: Architectural locks and technical choices.
- `roadmap.md`: The 6-stage build sequence from PRD-05.
- `context.md`: High-level vision and stack.
- `workflow-scaffold.md`: The strict "Visual First" sequence for scaffolding the app.
- `design-guidelines.md`: The NON-NEGOTIABLE visual rules (OLED blacks, glassmorphism, textures).
- `animation-physics.md`: The exact `cubic-bezier` curves, parallax math, and inertia physics.
- `ui-review-map.md`: Complete index of the 20 expert reviews from the design phase.

## Package Manager & File-Scoped Commands

Use **npm**: `npm install`, `npm run tauri dev`, `npm run tauri build`

## Commit Attribution

AI commits MUST include:

```text
Co-Authored-By: (the agent model's name and attribution byline)
```
