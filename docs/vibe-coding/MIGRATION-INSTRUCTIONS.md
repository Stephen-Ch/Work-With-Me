# Vibe-Coding Protocol Migration Instructions

**Version:** v7.2.19  
**Last Updated:** 2026-03-14

## Purpose
Guide for migrating vibe-coding protocol v7 to other projects (new projects or upgrading from older protocol versions).

## Core Principle
The protocol is **project-agnostic** by design. Gates, sequencing rules, and enforcement mechanisms never change. Only project-specific context (hot files, routes, tech stack) requires customization.

---

## Breaking Changes (v7.2.19)

- **Confidence line canonicalized to `Confidence: <percentage>%`** across Prompt Review Gate + templates. Old forms (`HIGH/MEDIUM/LOW`, `(0-100)`) are deprecated. After pulling this kit version, run `doc-audit -StartSession` and grep for old confidence formats (should return 0 hits).

---

## Legacy Consumer One-Time Migration Pilot

PROMPT-ID: KIT-LEGACY-CONSUMER-MIGRATION-PILOT-DOCS-AND-DRY-RUN-001

### Why this exists

Some existing consumers may still have older local `tools/kit-update.ps1` versions where the default ref was `main`.
Because `tentacles on` maps to `run-vibe -Tool start`, and start can invoke `kit-update` when lag is detected, those legacy consumers must not use old `tentacles on` as the first migration step.

### Mandatory warning

For existing consumers, do **not** run old `tentacles on` first.
First perform a one-time manual subtree migration to `release/consumer-payload`.

### One-time migration command pattern

Use this pattern:

```powershell
git subtree pull --prefix=<DOCS_ROOT>/vibe-coding `
  https://github.com/Stephen-Ch/vibe-coding-kit.git release/consumer-payload --squash
```

Common prefix examples:

- Standard consumer path: `docs/vibe-coding`
- LessonWriter-shaped path: `docs-engineering/vibe-coding`

### Verification Checklist (post-migration)

All items must pass before returning to normal `tentacles on` usage:

1. Required runtime files are present under `<DOCS_ROOT>/vibe-coding/`:
   - `tools/run-vibe.ps1`
   - `tools/session-start.ps1`
   - `tools/kit-update.ps1`
   - `tools/sync-forgpt.ps1`
   - `README.md`
   - `QUICKSTART.md`
2. Forbidden files are absent from the migrated subtree:
   - `REPORT-KIT-*`
   - `docs/research/*`
   - `kit-workspace/*`
   - consumer postmortem templates/artifacts and internal release-test harness files
3. `<DOCS_ROOT>/vibe-coding/tools/kit-update.ps1` default ref is `release/consumer-payload`.
4. `run-vibe -Tool session-start` completes without HARD STOP after migration.

### Stop Conditions (pilot migration)

Stop immediately if any condition is true:

- Working tree is dirty before migration
- Current branch is not the planned pilot branch
- Subtree source/ref is not `release/consumer-payload`
- Forbidden files appear after subtree pull
- `session-start` hard-stops after migration
- Any step would require force-push

### Rollback and governance note

- Perform migration on an isolated pilot branch in the consumer repo.
- Do not merge the migration branch into the consumer default branch until validation passes.
- If validation fails, revert the migration commit on the pilot branch and reassess.

### Dry-Run Checklist for the future pilot prompt

Use this checklist before touching any real consumer:

1. Identify the consumer `DOCS_ROOT` and exact subtree prefix.
2. Identify current installed kit state (version and local `kit-update.ps1` ref default).
3. Create an isolated migration branch in that consumer.
4. Run one-time subtree pull from `release/consumer-payload`.
5. Verify required/forbidden file assertions and script defaults.
6. Run `run-vibe -Tool session-start` and `run-vibe -Tool doc-audit -Mode Consumer -StartSession`.
7. Commit evidence only if all checks pass.

### Explicit scope statement

This document section is planning and instruction only.
No real consumer migration was executed while creating this update.

---

## Migration Checklist

### Phase 1: Copy Core Bundle (Always Identical)

Copy these files/directories unchanged from source project:

```
<DOCS_ROOT>/vibe-coding/protocol/
├── protocol-v7.md                    # Core rules (gates, sequencing, enforcement)
├── copilot-instructions-v7.md        # Copilot-specific protocol (CUSTOMIZE later)
├── required-artifacts.md             # Doc Audit rules (CUSTOMIZE examples)
├── alignment-mode.md                 # Alignment Mode workflow
├── verification-mode.md              # Verification Mode workflow
├── prompt-lifecycle.md               # State definitions (READY/IN-PROGRESS/etc)
├── stay-on-track.md                  # Cross-cutting coverage rules
├── working-agreement-v1.md           # 3-party sequencing rules
├── merge-prompt-template.md          # Merge/rollback template
└── templates/                        # Control Deck templates
    ├── VISION.template.md
    ├── EPICS.template.md
    └── NEXT.template.md

<DOCS_ROOT>/Start-Here-For-AI.md             # Consumer thin shell — CREATE from templates/start-here-template.md (do NOT copy)
<DOCS_ROOT>/vibe-coding/VIBE-CODING.VERSION.md   # Version tracking
.github/copilot-instructions.md       # Enforcer (points to protocol, CUSTOMIZE path)

### Doc Audit (Low-Noise v1) — Portable Install

- Purpose: Control Deck placeholder scan (<DOCS_ROOT>/project/* only) and NEXT freshness when PRs include non-docs changes.
- Copy these into the target repo:
   - <DOCS_ROOT>/vibe-coding/tools/doc-audit.ps1
   - scripts/doc-audit.ps1
   - docs/vibe-coding.config.json
   - .github/workflows/doc-audit.yml
- Run locally: pwsh ./scripts/doc-audit.ps1
- CI behavior:
   - Placeholder scan is Control Deck only (<DOCS_ROOT>/project/VISION.md, EPICS.md, NEXT.md)
   - NEXT.md update is required only when the PR changes any path outside doc-only prefixes (default: docs/)
```

### Phase 2: Run Project Assessment Prompt

Before customizing, run the diagnostic prompt below to identify what needs adaptation.

### Phase 3: Customize Project-Specific References

**A) Remove project-specific references:**

Search and replace in copied files:
- File headers: `"— ExampleProject"` → `"— [Your Project Name]"`
- Route references: `src/app/app.routes.ts` → `[your routes file path]`
- Example content: Replace ExampleProject VISION/EPICS examples with placeholders

**B) Keep copilot-instructions-v7.md portable; use an overlay for project-specific context:**

Do NOT edit `copilot-instructions-v7.md` directly — it is part of the kit head and will be overwritten on subtree pull. Instead, create a consumer overlay:

1. Copy `templates/copilot-instructions-overlay.example.md` to `<DOCS_ROOT>/overlays/copilot-instructions-overlay.md`
2. Fill in project-specific context (framework, hot files, routes, build commands)
3. Reference the overlay from `.github/copilot-instructions.md`

See [templates/copilot-instructions-overlay.example.md](templates/copilot-instructions-overlay.example.md) for the full template.

**C) Create consumer overlays from kit templates:**

Do NOT edit kit head files — customize via overlays. Copy each template and fill in project-specific values:

| Kit Template | Copy To | Purpose |
|-------------|---------|----------|
| `templates/overlay-index.example.md` | `<DOCS_ROOT>/overlays/overlay-index.md` | Overlay manifest |
| `templates/stack-profile-overlay.example.md` | `<DOCS_ROOT>/overlays/stack-profile.md` | Install/build/test/start commands + constraints |
| `templates/merge-commands-overlay.example.md` | `<DOCS_ROOT>/overlays/merge-commands.md` | Build Gate + Test Gate commands |
| `templates/hot-files-overlay.example.md` | `<DOCS_ROOT>/overlays/hot-files.md` | Hot files requiring analysis-first workflow |
| `templates/repo-policy-overlay.example.md` | `<DOCS_ROOT>/overlays/repo-policy.md` | Branch policy, PR rules, merge method |

The Return Packet Gate reads hot-files.md to decide triggers. The merge prompt template reads merge-commands.md for build/test commands. Both fall back gracefully if overlays are missing, but creating them up front is recommended.

2. **Hot Files** (files >300 LOC or high churn):
   ```markdown
   ## [Project] Hot Files (Two-Path Rule)
   Files requiring analysis-first OR full-file replacement:
   - [path/to/router.ts] - routing config, 350 LOC
   - [path/to/store.ts] - global state, 400 LOC
   - [path/to/main-component.ts] - coordinator, 320 LOC
   ```

3. **Route Coverage Table Pattern** (cross-cutting changes):
   ```markdown
   - Route Coverage Table using [your project] routes from `[routes file path]`:
     | Route | Status | Evidence |
     | ----- | ------ | -------- |
     | [route1] | UPDATED / NO CHANGE REQUIRED | [reason] |
   ```

4. **Content/Build Pipeline** (if applicable):
   ```markdown
   - Content pipeline: [source files] → [build scripts] → [output artifacts]
   ```

**C) Update protocol-v7.md cross-cutting section:**

Line 234 references ExampleProject routes. Update with your project's route structure:
```markdown
For ANY cross-cutting change, your completion report MUST include a route coverage table using the actual [Project] routes from `[routes file path]`:
```

**D) Update required-artifacts.md examples:**

Lines 90-107 use ExampleProject as <DOCS_ROOT>/project/VISION.md example. Replace with generic examples or your project's actual purpose statement.

**E) Create consumer Start-Here from the thin-shell template:**

Do NOT copy `Start-Here-For-AI.md` from another consumer repo. Consumer Start-Here files may contain large amounts of kit protocol text that immediately goes stale on the next kit update.

Instead:

```powershell
Copy-Item "<DOCS_ROOT>/vibe-coding/templates/start-here-template.md" `
          "<DOCS_ROOT>/Start-Here-For-AI.md"
```

Fill in `[Project Name]` and replace all `<DOCS_ROOT>` and `<SUBTREE>` placeholders with this repo's actual paths. Make no other content changes.

**Do not add to Start-Here:** gate definitions, session-sequencing rules, rerun-trigger commands, Population Gate instructions, or any other kit protocol behavior. Those live in `<DOCS_ROOT>/vibe-coding/`. Copying them in creates cleanup work after every kit update.

### Phase 4: Create Control Deck

**If migrating to NEW project (no existing docs):**

1. Copy templates to `<DOCS_ROOT>/project/`:
   ```
   cp <DOCS_ROOT>/vibe-coding/protocol/templates/VISION.template.md <DOCS_ROOT>/project/VISION.md
   cp <DOCS_ROOT>/vibe-coding/protocol/templates/EPICS.template.md <DOCS_ROOT>/project/EPICS.md
   cp <DOCS_ROOT>/vibe-coding/protocol/templates/NEXT.template.md <DOCS_ROOT>/project/NEXT.md
   ```

2. Populate with actual content (work with product owner/Stephen to fill sections)

3. Verify Population Gate PASS:
   ```bash
   # Run placeholder scan
   grep -iE '(TBD|TODO|TEMPLATE|PLACEHOLDER|FILL IN|COMING SOON|XXX|FIXME|TO BE DETERMINED|<fill)' <DOCS_ROOT>/project/VISION.md <DOCS_ROOT>/project/EPICS.md <DOCS_ROOT>/project/NEXT.md
   
   # Should return no matches (exit code 1 means PASS)
   ```

**If migrating to EXISTING project (has <DOCS_ROOT>/project/):**

1. Verify existing VISION/EPICS/NEXT meet required-artifacts.md thresholds:
   - <DOCS_ROOT>/project/VISION.md sections >= 25 words each
   - <DOCS_ROOT>/project/EPICS.md descriptions >= 15 words with goals + success criteria
   - <DOCS_ROOT>/project/NEXT.md NEXT STEP >= 10 words, DoD >= 10 words, Done When items >= 6 words

2. If thresholds not met, expand content before running Doc Audit

### Phase 5: Update Enforcer

Edit `.github/copilot-instructions.md` to point to new protocol location:

```markdown
# Copilot Instructions — [Your Project] (Enforcer)

Before any work:
1) Read `<DOCS_ROOT>/Start-Here-For-AI.md`
2) Follow `<DOCS_ROOT>/vibe-coding/protocol/protocol-v7.md` + `<DOCS_ROOT>/vibe-coding/protocol/copilot-instructions-v7.md`

Non-negotiables (every response):
1) Proof-of-Read (file + quote + "Applying: rule")
2) Prompt Review Gate (what / best next step YES/NO / confidence)
3) Stop on error (non-zero exit → stop, propose smallest fix, wait)
4) Green Gate for code prompts:
   - [your test command, e.g., npm test]
   - [your build command, e.g., npm run build]
```

### Phase 6: Run Initial Doc Audit

After migration complete, verify setup with Start-of-Session Doc Audit:

1. Open Copilot in new project
2. Paste: "Run Start-of-Session Doc Audit"
3. Verify PASS (all 5 checks green)
4. If FAIL, enter Alignment Mode to remediate

---

## Upgrading from Older Protocol Version

**If target project has vibe-coding v6.x or earlier:**

1. Archive old protocol:
   ```bash
   mkdir -p docs/archive/deprecated/
   mv <DOCS_ROOT>/vibe-coding/protocol docs/archive/deprecated/protocol-v6
   ```

2. Copy v7.1.0 bundle fresh (Phase 1 above)

3. Migrate any project-specific customizations from archived version:
   - Check old copilot-instructions for hot files list
   - Check old protocol for route coverage patterns
   - Preserve any working agreements specific to team

4. Update Control Deck if format changed (e.g., <DOCS_ROOT>/project/NEXT.md gained "Done When" section in v7)

5. Run Doc Audit to verify Population Gate with new thresholds

**Breaking changes v6 → v7:**
- Population Gate now requires word-count thresholds (not just "substantive content")
- 3-Party Approval Gate added (alignment-mode.md canonical)
- Prompt Review Gate now 4 lines (was 3 in some v6 variants)
- Command Lock sequencing clarified (reads allowed after gate, before Proof-of-Read)

---

## Project Assessment Diagnostic Prompt

Run this prompt in target project BEFORE migration to identify customization needs:

\`\`\`markdown
PROMPT-ID: VIBE-CODING-V7-PROJECT-ASSESSMENT-001

GOAL: Diagnose project-specific context needed for vibe-coding v7 migration

SCOPE:
- Read codebase structure to identify hot files (>300 LOC, routing/state/coordination)
- Read routing config to identify cross-cutting coverage requirements
- Read package.json + test/build config to identify tech stack
- Read existing <DOCS_ROOT>/project/ (if exists) to assess Control Deck population
- Output assessment report with customization checklist

TASKS:
A) Identify framework + tech stack from package.json dependencies
B) Locate routing configuration file (search for app.routes.ts, routes.tsx, app/\*\*/route.ts patterns)
C) Identify hot files (>300 LOC in src/) focusing on:
   - Routing/navigation coordinators
   - Global state management
   - Main layout/shell components
   - Content pipeline build scripts
D) Check if <DOCS_ROOT>/project/ exists:
   - If YES: read VISION/EPICS/NEXT and assess word counts vs v7 thresholds
   - If NO: note Control Deck creation required
E) Identify cross-cutting patterns (search src/ for shared CSS vars, component libraries, copy dictionaries)
F) Output assessment report with:
   - Framework/stack summary
   - Routes file path + route list
   - Hot files list (path + LOC + purpose)
   - Control Deck status (exists/needs-creation/needs-expansion)
   - Cross-cutting patterns requiring coverage tables
   - Customization checklist (what to update in overlay + protocol-v7.md)

# END PROMPT
\`\`\`

**Assessment Report Format:**

\`\`\`markdown
# Vibe-Coding v7 Migration Assessment — [Project Name]

## Tech Stack
- Framework: [name + version]
- State: [management approach]
- Routing: [library + config file path]
- Build: [tool + commands]
- Tests: [framework + command]

## Hot Files (Candidates for Two-Path Rule)
| File | LOC | Purpose | Churn Risk |
|------|-----|---------|-----------|
| [path] | [count] | [description] | [HIGH/MEDIUM/LOW] |

## Routing Structure
Routes file: `[path to routes config]`

Routes requiring cross-cutting coverage:
- [route1]
- [route2]
...

## Control Deck Status
- `<DOCS_ROOT>/project/VISION.md`: [EXISTS (meets thresholds) / EXISTS (needs expansion) / MISSING]
- `<DOCS_ROOT>/project/EPICS.md`: [EXISTS / MISSING]
- `<DOCS_ROOT>/project/NEXT.md`: [EXISTS / MISSING]

Population Gate blockers:
- [list any sections below word-count thresholds or containing placeholders]

## Cross-Cutting Patterns
Patterns requiring route coverage tables:
- [e.g., Shared CSS variables in styles/theme.scss]
- [e.g., UI component library in src/components/shared]
- [e.g., Copy dictionary in src/i18n/en.json]

## Customization Checklist

### copilot-instructions-v7.md
- [ ] Do NOT edit directly — create a consumer overlay at `<DOCS_ROOT>/overlays/copilot-instructions-overlay.md` instead
- [ ] Copy `templates/copilot-instructions-overlay.example.md` and fill in project-specific context
- [ ] Add hot files, routes, and build commands to the overlay

### Consumer Overlays
- [ ] Copy all templates from `templates/*-overlay.example.md` to `<DOCS_ROOT>/overlays/`
- [ ] Fill in `stack-profile.md` with install/build/test/start commands
- [ ] Fill in `merge-commands.md` with Build Gate and Test Gate commands
- [ ] Fill in `hot-files.md` with files >300 LOC or high churn
- [ ] Fill in `repo-policy.md` with branch/PR/merge conventions

### protocol-v7.md
- [ ] Update cross-cutting route reference (line 234): replace `src/app/app.routes.ts` with `[your routes file]`
- [ ] Update file header (line 1): "— ExampleProject" → "— [Your Project]"

### required-artifacts.md
- [ ] Update <DOCS_ROOT>/project/VISION.md examples (lines 90-107): replace ExampleProject examples with [your project purpose] or generic placeholders

### Start-Here-For-AI.md
- [ ] Create from `templates/start-here-template.md` (do NOT copy from another consumer repo)
- [ ] Fill in `[Project Name]` and replace all `<DOCS_ROOT>` and `<SUBTREE>` placeholders
- [ ] Do not add kit protocol text — keep thin; all protocol behavior lives in `<DOCS_ROOT>/vibe-coding/`

### Control Deck (<DOCS_ROOT>/project/)
- [ ] [Create VISION/EPICS/NEXT from templates OR expand existing to meet thresholds]

## Migration Readiness
- **Ready to migrate?** [YES (all customization identified) / NO (blockers below)]
- **Blockers:** [list any missing info or decisions needed]
\`\`\`

---

## Key Invariants (Never Change Across Projects)

These elements are **project-agnostic** and must remain identical:

### Gates
- Prompt Review Gate format (4 lines: What, Best next step, Confidence, Work state)
- Vision & User Story Gate requirements (Story ID, NEXT STEP citation)
- Proof-of-Read format (file + quote + "Applying: rule")
- Population Gate thresholds (word counts: 25/10/6)
- 3-Party Approval Gate checklist structure

### Sequencing
- Command Lock (no terminal/edits/searches before Prompt Review Gate)
- Session flow (Prompt Review Gate → Proof-of-Read → Doc Audit → work)
- Doc Audit rerun triggers (Control Deck changes since last audit)

### Prompt Classes
- FORMAL WORK PROMPT (requires PROMPT-ID, allows execution)
- CONVERSATIONAL REQUEST (no PROMPT-ID, read-only tools only)

### State Definitions
- READY, IN-PROGRESS, COMPLETE, MERGED, OBSOLETE (from prompt-lifecycle.md)

### Enforcement Rules
- Green Gate (tests + build before commit)
- Hot File Protocol (analysis-first OR full-file replacement)
- Cross-cutting coverage (route table required)
- Scope discipline (stay inside SCOPE GUARDRAILS)

---

## Tunables (Customize Per Project)

These elements **must be adapted** to each project:

### Context
- Project name (file headers)
- Framework/tech stack (copilot-instructions)
- Architecture patterns (copilot-instructions)

### Hot Files
- List of files >300 LOC or high churn
- Routing coordinators
- State management files
- Main layout components

### Routes
- Routes file path
- Route list for coverage tables
- Parameterized route patterns

### Cross-Cutting Patterns
- Shared component libraries
- CSS variable systems
- Copy dictionaries
- Build pipeline artifacts

### Control Deck Content
- <DOCS_ROOT>/project/VISION.md (product purpose, unique to each project)
- <DOCS_ROOT>/project/EPICS.md (feature roadmap, unique to each project)
- <DOCS_ROOT>/project/NEXT.md (current story, unique to each project)

---

## Common Migration Pitfalls

1. **Forgetting to update copilot-instructions hot files** → AI doesn't know which files need analysis-first
2. **Leaving project-specific routes in protocol-v7.md** → cross-cutting coverage tables show wrong routes
3. **Copying Control Deck templates without populating** → Doc Audit FAIL on placeholders
4. **Not running assessment prompt first** → miss project-specific patterns requiring coverage
5. **Changing gate formats** → breaks enforcement consistency across projects
6. **Updating thresholds per project** → Population Gate becomes subjective

---

## Support

For migration questions or protocol issues:
1. Check protocol-reassessment-post-sweep-2026-01-05.md for known gaps
2. Run assessment prompt to diagnose customization needs
3. Verify Control Deck population before first Doc Audit

---

**Last Updated:** 2026-02-26  
**Protocol Version:** v7.2.7

---

## Stale Consumer Bootstrap Procedure

PROMPT-ID: KIT-FULL-CLEAN-TREE-DOCUMENT-STALE-CONSUMER-BOOTSTRAP-20260505-001

**Added:** 2026-05-05 — derived from Rawls first-consumer bootstrap validation

### Purpose

Existing consumers may be stale. Their installed `tools/kit-update.ps1` may predate the repaired safety gates introduced in the full-clean-tree-gate remediation (Phase 3/4/5B). Stale consumers must not rely on their own old updater for the bootstrap update — the old updater cannot be trusted to enforce the gates it is supposed to add.

This procedure ensures that every stale consumer bootstrap is a single, gated operation rather than a rediscovery process.

---

### 1. Source/Payload Preflight

Perform all of these before touching any consumer repo. Stop on any failure.

- [ ] Confirm the repaired source branch commit SHA (current HEAD of `x/full-clean-tree-gate-20260505-001` or successor).
- [ ] Confirm `release/consumer-payload` SHA matches the published repaired payload.
- [ ] Confirm payload version in `VIBE-CODING.VERSION.md` is the expected repaired version.
- [ ] Confirm `tools/kit-update.ps1` in the payload contains Phase 4 gate: `"Untracked files detected. Full clean tree required before kit update."`
- [ ] Confirm `tools/kit-update.ps1` in the payload contains Phase 5B gate: `"kit-update must not run on the repo default branch"` and consumer-remote default-branch detection.
- [ ] Confirm `tools/session-start.ps1` in the payload contains Phase 3 behavior: `git status --porcelain -u` and `"Untracked items:"`.
- [ ] **If source and published payload are out of sync, STOP.** Run `publish-consumer-payload.ps1` first to bring the payload up to date, then re-verify. Do not bootstrap any consumer against a stale payload.

This is a preflight gate, not a mid-update discovery. Any sync issue must be resolved before any consumer is touched.

---

### 2. Consumer Preflight

Perform inside the consumer repo before running any updater.

- [ ] Consumer working tree must be fully clean: `git status --porcelain -u` returns empty output. Any dirty state — including untracked files — is a hard stop.
- [ ] Current branch must **not** be the consumer repo's default branch (`main`, `master`, or remote-detected default).
- [ ] Create or switch to a dedicated local validation branch (e.g., `x/kit-bootstrap-YYYYMMDD-001`).
- [ ] Confirm no push will occur during bootstrap. Push is explicitly forbidden until closeout verification passes.
- [ ] Confirm no app or runtime files are expected to change. Only `docs/vibe-coding/**` and related kit paths should be affected.

---

### 3. Trusted Updater Rule

For stale consumers, the installed `kit-update.ps1` predates the safety gates and must not be used as the entry point.

- Invoke the repaired updater by **full absolute path** from the trusted `vibe-coding-kit` source checkout.
- Example:
  ```powershell
  & "C:\Users\schur\workspaces\vibe-coding-kit\tools\kit-update.ps1" -ConsumerRoot "C:\path\to\consumer"
  ```
- Do not trust or invoke the stale consumer's installed `tools/kit-update.ps1` until after bootstrap succeeds and closeout verification passes.

---

### 4. Denylist-Recalled File Preflight

Before running the subtree pull, check for tracked denylist-recalled files.

- [ ] Explicitly check for: `docs/vibe-coding/.vscode/settings.json` (confirmed present in Rawls pre-bootstrap working tree).
- [ ] Check for any other tracked files under `docs/vibe-coding/.vscode/`.
- [ ] If present, remove and commit the recalled file on the validation branch before retrying bootstrap:
  ```powershell
  git rm "docs/vibe-coding/.vscode/settings.json"
  git commit -m "chore: remove denylist-recalled vscode settings before kit bootstrap"
  ```
- [ ] Then retry the bootstrap from the beginning of this procedure.

**Note:** This is a one-time migration artifact from earlier payload versions that included `.vscode/settings.json` before it was added to the denylist. It is not a recurring gate failure — once removed, it will not return via future subtree pulls.

---

### 5. Report and Artifact Boundary

- Reports must **not** be generated inside consumer repos.
- Consumer repos are frozen. Generating a report inside one creates an untracked or tracked artifact that must be quarantined before any further work.
- Reports belong outside the consumer repo, preferably in `OctopusHead` or another designated reporting location.
- If a report artifact appears in a consumer repo working tree:
  1. Move it outside the consumer repo (e.g., copy to `OctopusHead/docs/status/`).
  2. Confirm consumer `git status --porcelain -u` is empty again before continuing.
  3. Do not commit the report inside the consumer repo.

---

### 6. Update Sequence

Execute in this exact order. Stop on any failure. Do not skip steps.

1. **Verify payload** — re-confirm `release/consumer-payload` SHA and gates (Source/Payload Preflight above).
2. **Run trusted updater dry run:**
   ```powershell
   & "C:\Users\schur\workspaces\vibe-coding-kit\tools\kit-update.ps1" -ConsumerRoot "C:\path\to\consumer" -WhatIf
   ```
3. **Review dry-run output.** Confirm expected files only. Confirm no app/runtime files appear in scope.
4. **Run actual trusted updater** only after dry run passes cleanly:
   ```powershell
   & "C:\Users\schur\workspaces\vibe-coding-kit\tools\kit-update.ps1" -ConsumerRoot "C:\path\to\consumer"
   ```
5. **Stop immediately after update.** Do not run additional commands. Do not push.

---

### 7. Closeout Verification

Before declaring the bootstrap complete, verify all of the following. Each item must be captured in the session closeout report.

- [ ] **Update branch** — confirm still on the validation branch, not default branch.
- [ ] **Final `git status --porcelain -u`** — must return empty output.
- [ ] **Latest commit SHA** — record the exact SHA of the update commit.
- [ ] **Exact changed files** — record every file changed by the update commit.
- [ ] **No app/runtime files changed** — confirm changed files are limited to `docs/vibe-coding/**` and related kit paths only.
- [ ] **Installed kit version** — read `docs/vibe-coding/VIBE-CODING.VERSION.md` and record the version.
- [ ] **Phase 4 gate present** — `docs/vibe-coding/tools/kit-update.ps1` contains `"Untracked files detected. Full clean tree required before kit update."`
- [ ] **Phase 5B gate present** — `docs/vibe-coding/tools/kit-update.ps1` contains `"kit-update must not run on the repo default branch"`.
- [ ] **Phase 3 behavior present** — `docs/vibe-coding/tools/session-start.ps1` contains `git status --porcelain -u` and `"Untracked items:"`.
- [ ] **Recalled `.vscode/settings.json` absent** — `docs/vibe-coding/.vscode/settings.json` is not tracked and not present in working tree.
- [ ] **Branch has no upstream** — confirm `git branch -vv` shows no upstream for the validation branch (no accidental push target).
- [ ] **Nothing was pushed** — explicitly confirm `git log --branches --not --remotes` shows the validation branch commit is local-only.

---

### 8. One-by-One Unfreeze Rule

Rawls was the first consumer to complete this bootstrap procedure. It validates that the procedure works, but it does not authorize broad rollout.

- **Do not unfreeze multiple consumers at once.**
- Each consumer must pass this entire stale-consumer bootstrap checklist independently.
- Unfreeze consumers one at a time, in order of priority.
- A consumer is only unfrozen after its closeout verification passes and is recorded.

---

### 9. OctopusHead Follow-Up (TODO — Do Not Implement Now)

After bootstrap procedures are complete for all registered consumers, OctopusHead should run a scan to confirm:

- [ ] `docs/vibe-coding/.vscode/settings.json` is absent (untracked, not present) in all registered consumer repos.
- [ ] No other tracked denylist-recalled remnants remain in any registered consumer subtree path.
- [ ] No report artifacts were accidentally committed inside any consumer repo.

**Do not implement OctopusHead scanning changes in any consumer bootstrap prompt.** This is a separate, deferred OctopusHead task to be scheduled after all consumers are bootstrapped.

---

## Consumer Dirty Tree Triage

**Added:** 2026-05-06 — derived from Rawls and WorkingWithMe rollout experience

### Purpose

Before any kit rollout or bootstrap, the consumer repo's working tree must be fully clean (`git status --porcelain -u` returns empty). When the tree is not clean, this procedure classifies every dirty item into exactly one of five categories and specifies the required action for each. Do not proceed with kit-update until all dirty items are resolved or stopped on.

**Hard rules that apply during triage:**
- No push during triage.
- No kit-update from the default branch.
- Final working tree must be empty (`git status --porcelain -u`) before rollout resumes.

---

### Category 1 — Durable Docs/Research Only

**Signs:** Untracked or modified files under `docs/research/`, `ResearchIndex.md`, `docs/project/`, `docs/forGPT/`, or other docs-only paths. No app code, no runtime files, no generated output.

**Examples:**
- `docs/research/R-009-SomeResearch.md` (new untracked)
- `docs/research/ResearchIndex.md` (modified to add entry)
- `docs/project/NEXT.md` (updated)

**Required action:**
1. Inspect each file for content coherence — confirm it is purely doc/research content and contains no app-specific implementation code.
2. If coherent, stage and commit on the rollout branch with a plain doc commit message.
3. Verify `git status --porcelain -u` returns empty after commit.
4. Continue rollout.

**Hard limit:** No app code, no runtime files, no generated output may be committed under this category. If any staged file contains app/runtime content, stop and reclassify as Category 4.

---

### Category 2 — Report Artifact in Consumer Repo

**Signs:** A `REPORT-*.md`, `POSTMORTEM-*.md`, or other kit-generated report artifact appears in the consumer repo's working tree (untracked or tracked), typically in the repo root or `docs/status/`.

**Examples:**
- `REPORT-KIT-SOMETHING-20260506-001.md` (untracked in repo root)
- `docs/status/REPORT-KIT-SOMETHING-20260506-001.md` (untracked)

**Required action:**
1. Copy the file outside the consumer repo (e.g., to `OctopusHead/docs/status/` or another designated reporting location).
2. Confirm the copy succeeded.
3. Delete the original from the consumer working tree (do not commit it).
4. Verify `git status --porcelain -u` no longer shows the file.
5. Continue rollout.

**Hard rule:** Reports must not be generated inside consumer repos. A report artifact in a consumer repo is always the result of a boundary violation in a previous step. Quarantine it — do not commit it in the consumer repo.

---

### Category 3 — Known Recalled Kit Payload File

**Signs:** `docs/vibe-coding/.vscode/settings.json` is present (tracked or untracked).

**Background:** Early kit payload versions included `.vscode/settings.json` in the `docs/vibe-coding/` subtree. This file was subsequently added to the payload denylist and is no longer distributed by any current payload. However, consumers who received an older payload may still have it tracked in their subtree. This is a one-time migration artifact — once removed, it will not return via future subtree pulls.

**Known recalled files:**
- `docs/vibe-coding/.vscode/settings.json` (confirmed present in pre-v7.5.15 consumer subtrees)
- Any other file under `docs/vibe-coding/.vscode/`

**Required action:**
1. Check for presence: `git ls-files docs/vibe-coding/.vscode/`
2. If tracked, remove with git tracking awareness:
   ```powershell
   git rm "docs/vibe-coding/.vscode/settings.json"
   git commit -m "chore: remove denylist-recalled vscode settings before kit update"
   ```
3. If untracked only (not in git index), simply delete the file and verify it no longer appears in `git status --porcelain -u`.
4. Continue rollout.

**Note:** This is not a recurring kit failure. No action is needed for consumers that never received the old payload or have already been cleaned.

---

### Category 4 — App/Runtime Files

**Signs:** Any staged, modified, or untracked file that is part of the app's source code, runtime configuration, generated output, or build artifacts.

**Examples:**
- `src/components/MyComponent.tsx`
- `prisma/schema.prisma`
- `.env.local`
- `node_modules/` (if unintentionally untracked)
- Any compiled or generated file

**Required action:**
1. **STOP.** Do not stage, commit, stash, or modify these files.
2. Do not proceed with kit rollout.
3. The operator must resolve the dirty app state through normal development workflow (commit, stash, or discard) before kit rollout is attempted.
4. This is not a kit rollout issue — it is a pre-existing dirty development state that must be resolved first.

---

### Category 5 — Unknown Files

**Signs:** Any file that does not clearly fit Categories 1–4.

**Required action:**
1. **STOP.**
2. Do not stage, commit, stash, or modify.
3. Request operator review. Describe the file(s) and their paths.
4. Wait for explicit classification before proceeding.

---

### Category 6 — Generated AI Handoff Packet (`docs/forGPT/**`)

**Signs:** Untracked files under `docs/forGPT/` generated by `run-vibe start` or `sync-forgpt.ps1` during rollout closeout. Typically appears after running session-start as a closeout verification step.

**Examples:**
- `docs/forGPT/EPICS.md`
- `docs/forGPT/NEXT.md`
- `docs/forGPT/VISION.md`
- `docs/forGPT/ResearchIndex.md`
- `docs/forGPT/protocol-lite.md`
- `docs/forGPT/VIBE-CODING-KIT-README.md`
- `docs/forGPT/VERSION-MANIFEST.md`
- `docs/forGPT/forgpt.manifest.json`

**Background:** Kit v7.5.16 introduced `sync-forgpt.ps1`, which `run-vibe start` calls on first run to bootstrap the AI handoff packet directory. This is expected behavior — it mirrors approved project docs and kit files for AI context handoff. It is not a payload boundary violation.

**Required action:**
1. Inspect every file in `docs/forGPT/`. Confirm:
   - All files are **markdown** (`.md`) or **JSON** (`.json`) only. No `.js`, `.ps1`, `.sh`, `.py`, config files, test harnesses, or executable content.
   - `VERSION-MANIFEST.md` or `forgpt.manifest.json` indicates generated by `sync-forgpt.ps1`.
   - **No secrets, credentials, tokens, passwords, private keys, or `.env` values** are present in any file.
   - Content matches copies of approved project docs (`VISION.md`, `EPICS.md`, `NEXT.md`, etc.) and kit files (`protocol-lite.md`, `QUICKSTART.md`, `README.md`). No app-specific implementation code.
2. If all checks pass, stage and commit:
   ```powershell
   git add docs/forGPT/
   git commit -m "docs(forgpt): refresh AI handoff packet"
   ```
3. Rerun `run-vibe start` (or `kit-update -WhatIf`) to confirm the tree is now clean.
4. Continue rollout.

**Hard stops:**
- If any file contains non-markdown/non-JSON content, secrets, or unknown formats: **STOP.** Do not commit. Request operator review.
- If files include app implementation code, test harnesses, or executable scripts: **STOP.** Classify as Category 4 or 5 and request review.
- Do not add `docs/forGPT/` to `.gitignore` without explicit operator approval — this directory may be durable AI handoff state that should be committed.
- Do not delete `docs/forGPT/` by default. It is generated from approved sources and is safe to keep.

**Important clarification — not all files under `docs/` are automatically safe:**  
Files under `docs/` that are executable or config-like (e.g., `.js`, `.ps1`, `.sh`, `.py`, `.json` config files that are not handoff manifests, test harnesses) require inspection and explicit operator approval before commit. The `docs/forGPT/` exception applies only to the markdown/JSON handoff files described above.

---

---

## Rollout Blockers and Conflict Resolution

**Added:** 2026-05-07 — derived from Mortality v7.5.16 rollout experience

These are pre-update and mid-update conditions that are not dirty working tree items but can block or fail a kit rollout. They have defined safe resolution paths.

---

### Blocker 1 — Stale Git Lock File (`.git/index.lock`)

**Signs:** A 0-byte (or small) file exists at `.git/index.lock`. Git commands fail with a message like `Another git process seems to be running in this repository`.

**Classification:** `GIT REPO BLOCKER` until confirmed stale.

**Required action:**
1. **Do not delete blindly.** The lock may belong to a live git process.
2. Check for active git processes:
   ```powershell
   Get-Process -Name git -ErrorAction SilentlyContinue
   ```
3. If any `git.exe` processes are running: **STOP.** Wait for them to complete or identify and terminate with operator approval.
4. If no git processes are running: the lock is stale. Remove it:
   ```powershell
   Remove-Item '.git/index.lock'
   ```
5. Retry the git operation that failed.
6. If uncertain about any process: **STOP and request review.**

---

### Blocker 2 — Kit-Subtree Deleted-File Conflict

**Signs:** `git subtree pull` fails with a merge conflict where the conflicted file is a kit-managed file under `docs/vibe-coding/**` that no longer exists in the current `release/consumer-payload`.

**Example:** `docs/vibe-coding/PAUSE.md` — present in the consumer's installed subtree, deleted in the new payload.

**Applies only when all of the following are true:**
- The conflict is confined to `docs/vibe-coding/**` (kit subtree path only).
- The conflicted file is absent from the current `release/consumer-payload` (verify with `git show origin/release/consumer-payload:<path>`).
- Accepting the deletion does not affect any app or runtime files.

**Safe resolution:**
1. Confirm the file is absent from payload:
   ```powershell
   git show vibe-coding-kit/release/consumer-payload:docs/vibe-coding/PAUSE.md
   # Expected: fatal: Path '...' does not exist in 'vibe-coding-kit/release/consumer-payload'
   ```
2. Accept the deletion:
   ```powershell
   git rm docs/vibe-coding/PAUSE.md
   ```
3. Complete the merge:
   ```powershell
   git merge --continue
   # or: git commit
   ```
4. Confirm `git status --porcelain -u` is clean.

**Hard stops:**
- If the conflict involves content changes (not just deletion): **STOP.** Do not resolve. Report the conflict.
- If any app or runtime files are in the conflict: **STOP.** Classify as `UNEXPECTED APP IMPACT`.
- If there are multiple conflicted files or any uncertainty: **STOP and request review.**
- Do not use `git reset --hard` or `git checkout --theirs` without explicit operator approval.

---

### Blocker 3 — Stale forGPT Source Reference After Kit File Deletion

**Signs:** After resolving a kit-file deletion (Blocker 2 above), `forgpt.manifest.json` or an equivalent forGPT configuration file still references the deleted kit file. Running `sync-forgpt.ps1` or `run-vibe start` will fail or generate an error when it tries to copy a source file that no longer exists.

**Example:** `forgpt.manifest.json` lists `docs/vibe-coding/PAUSE.md` as a source file, but that file was removed from the kit subtree.

**Required action:**
1. After resolving a kit-file deletion, inspect `forgpt.manifest.json` (and any related manifest/config) for references to the deleted file:
   ```powershell
   Select-String -Path 'docs/forGPT/forgpt.manifest.json' -Pattern 'PAUSE'
   ```
2. If the deleted file is still referenced: remove only that stale reference from the manifest. Do not delete or rewrite the entire manifest.
3. Confirm the remaining manifest entries all point to files that exist.
4. Commit the manifest cleanup as a docs-only change:
   ```powershell
   git add docs/forGPT/forgpt.manifest.json
   git commit -m "docs(forgpt): remove stale kit file reference from manifest"
   ```
5. Then regenerate/refresh the forGPT packet via `run-vibe start` or `sync-forgpt.ps1`.
6. Confirm no secrets and that the final packet contains only markdown/JSON files.
7. Commit the refreshed packet with: `docs(forgpt): refresh AI handoff packet`

**Hard stops:**
- If the manifest references files that appear to be app or runtime dependencies: **STOP and request review.**
- If removing the stale reference causes the manifest to become empty or structurally invalid: **STOP and request review.**

---

### Triage Completion Criterion

All items in `git status --porcelain -u` must have been processed through one of the six categories. The triage is complete only when `git status --porcelain -u` returns empty output and no Category 4 or 5 items were encountered (or any encountered were resolved with operator approval). Category 6 items (generated `docs/forGPT/**` files) must be inspected and committed before the tree can be declared clean.

**See also:** [portability/consumer-rollout-checklist.md](portability/consumer-rollout-checklist.md) for the full step-by-step rollout flow that incorporates this triage procedure.
