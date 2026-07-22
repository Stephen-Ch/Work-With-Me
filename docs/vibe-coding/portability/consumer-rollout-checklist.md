# Consumer Rollout Checklist

**Added:** 2026-05-06 — derived from Rawls and WorkingWithMe rollout experience  
**Updated:** 2026-05-07 — Dealers Choice rollout lessons (path detection, run-vibe -Ref gap, squash+merge commit pair, owner-only deletion, solo closeout, Remote Reality WARN interpretation)
**Purpose:** Reusable step-by-step checklist for rolling out a vibe-kit update to one consumer repo at a time.

---

## Rules Before Starting

- **One consumer repo at a time.** Do not begin a second consumer until the first reaches UPDATED CLEANLY or ALREADY CURRENT.
- **No broad rollout.** Each consumer must pass this checklist independently.
- **Reports stay outside consumer repos.** No report artifacts may be created, generated, or committed inside a consumer repo at any point during rollout.
- **No push during rollout.** Push is explicitly forbidden until closeout verification passes and the operator authorizes it.

---

## Stop Classifications

When this checklist reaches a stop condition, classify and record the outcome:

| Classification | Meaning |
|---|---|
| `UPDATED CLEANLY` | Rollout completed, all closeout checks pass, tree clean |
| `ALREADY CURRENT` | kit-update returned NOOP(Current), no update needed |
| `NEEDS PREFLIGHT CLEANUP` | Dirty tree items remain after triage; rollout blocked pending resolution |
| `GIT REPO BLOCKER` | Git state prevents rollout (unmerged conflicts, detached HEAD, missing remote, etc.) |
| `PAYLOAD / TOOLING BLOCKER` | Source payload or tool verification failed; rollout blocked pending kit-side fix |
| `UNEXPECTED APP IMPACT` | Update scope would touch app/runtime files; stop and escalate |

---

## Step 1 — Verify Source / Payload / Version

Before touching any consumer repo, confirm the kit source and payload are ready.

- [ ] Confirm vibe-coding-kit is on `main` at the expected SHA.
- [ ] Confirm `release/consumer-payload` SHA matches the latest published payload (run `git log -1 origin/release/consumer-payload`).
- [ ] Confirm `VIBE-CODING.VERSION.md` on the payload branch shows the expected version (e.g., v7.5.16).
- [ ] Confirm payload contains `tools/git-helpers.ps1` with `Get-DocsRoot` and `Get-FullTreeStatus`.
- [ ] Confirm payload `tools/session-start.ps1` dot-sources `git-helpers.ps1`.
- [ ] Confirm payload `tools/kit-update.ps1` dot-sources `git-helpers.ps1` and contains Phase 4 untracked gate and Phase 5B default-branch gate.

**If any check fails: PAYLOAD / TOOLING BLOCKER.** Stop. Resolve kit-side before touching any consumer.

---

## Step 2 — Confirm Consumer Repo Identity

- [ ] Confirm consumer repo path (absolute path).
- [ ] Confirm consumer repo name / purpose.
- [ ] **Detect exact kit installation path** — do not assume `docs/vibe-coding` is the subtree root. Common consumer paths include `docs/vibe-coding` and `docs-engineering/vibe-coding`. Verify with:
  ```powershell
  Test-Path 'docs/vibe-coding/VIBE-CODING.VERSION.md'
  Resolve-Path 'docs/vibe-coding' -ErrorAction SilentlyContinue
  ```
  Record the confirmed subtree root. Use this path — not an assumed path — in all subsequent steps.
- [ ] **Check for stale git lock** — confirm `.git/index.lock` does not exist:
  ```powershell
  Test-Path '.git/index.lock'
  ```
  If present: check for active git processes (`Get-Process -Name git -ErrorAction SilentlyContinue`). If none found, the lock is stale — remove it (`Remove-Item '.git/index.lock'`). If any git process is running, **GIT REPO BLOCKER** — stop and wait. See MIGRATION-INSTRUCTIONS.md Blocker 1.
- [ ] Run `git rev-parse --show-toplevel` from inside the repo to confirm repo root.
- [ ] Run `git rev-parse --abbrev-ref HEAD` to record current branch.
- [ ] Detect default branch: `git ls-remote --symref origin HEAD 2>$null | Select-String 'ref: refs/heads/'` — record the result.
- [ ] Confirm current branch is **not** the default branch. If on default branch, create a rollout branch now:
  ```powershell
  git checkout -b x/kit-rollout-YYYYMMDD-001
  ```
- [ ] Record rollout branch name.

---

## Step 3 — Run Consumer Dirty Tree Triage

- [ ] Run `git status --porcelain -u`. If output is empty, skip to Step 4.
- [ ] If not empty, classify every dirty item using the triage procedure:  
  **[MIGRATION-INSTRUCTIONS.md → Consumer Dirty Tree Triage](../MIGRATION-INSTRUCTIONS.md)**
- [ ] For **Category 1** (docs/research only): inspect, commit on rollout branch, continue.
- [ ] For **Category 2** (report artifact): quarantine outside consumer repo, do not commit, continue.
- [ ] For **Category 3** (recalled kit file): see Step 4 below.
- [ ] For **Category 4** (app/runtime files): **NEEDS PREFLIGHT CLEANUP.** Stop. Do not proceed.
- [ ] For **Category 5** (unknown): **NEEDS PREFLIGHT CLEANUP.** Stop. Request operator review.
- [ ] For **Category 6** (`docs/forGPT/**` — generated AI handoff packet): inspect files, confirm markdown/JSON only and no secrets, commit if safe with `docs(forgpt): refresh AI handoff packet`, continue.
- [ ] After handling all items: run `git status --porcelain -u` again — must be empty before continuing.

**Warning:** Do not add `docs/forGPT/` to `.gitignore` or delete it by default — it may be durable AI handoff state. See triage Category 6 in [MIGRATION-INSTRUCTIONS.md](../MIGRATION-INSTRUCTIONS.md) for full inspection rules.

---

## Step 4 — Check / Remove Known Recalled File

- [ ] Check: `git ls-files docs/vibe-coding/.vscode/`
- [ ] If the file `docs/vibe-coding/.vscode/settings.json` is tracked:
  ```powershell
  git rm "docs/vibe-coding/.vscode/settings.json"
  git commit -m "chore: remove denylist-recalled vscode settings before kit update"
  ```
- [ ] If present but untracked: delete it and confirm it no longer appears in `git status --porcelain -u`.
- [ ] If absent: no action needed.
- [ ] Confirm `git status --porcelain -u` is empty before continuing.

**Background:** `docs/vibe-coding/.vscode/settings.json` was distributed by early payload versions and later recalled via denylist. Present on any consumer that received a pre-recall payload. One-time cleanup — will not return via future subtree pulls.

---

## Step 5 — Select Safe Updater Path

Choose exactly one of the following:

**Option A — Use installed updater (repaired/current):**  
Use if the consumer's installed `tools/kit-update.ps1` already contains Phase 4 (untracked gate) and Phase 5B (default-branch gate).  
Check: `Select-String -Path docs/vibe-coding/tools/kit-update.ps1 -Pattern 'Untracked files detected'`

**Option B — Use trusted source updater (stale consumer):**  
Use if the installed updater predates the gates or the consumer is bootstrapping for the first time.
```powershell
& "C:\Users\schur\workspaces\vibe-coding-kit\tools\kit-update.ps1" -RepoRoot "C:\path\to\consumer"
```

- [ ] Record which option was selected and why.

**Note on `run-vibe.ps1` and `-Ref` passthrough:** `run-vibe.ps1` may not forward the `-Ref` flag to `kit-update.ps1`. If your rollout requires targeting `release/consumer-payload` explicitly, invoke `kit-update.ps1` directly (Option B) rather than going through `run-vibe`. Do not rely on Option A for ref-sensitive updates until `-Ref` passthrough is verified.

---

## Step 6 — Run Dry Run / WhatIf

- [ ] Run the selected updater with `-WhatIf`:
  - Option A: `.\docs\vibe-coding\tools\kit-update.ps1 -WhatIf`
  - Option B: `& "C:\Users\schur\workspaces\vibe-coding-kit\tools\kit-update.ps1" -RepoRoot "C:\path\to\consumer" -WhatIf`
- [ ] Confirm output shows `KIT UPDATE PLAN` and the expected diff scope.
- [ ] Confirm **no app/runtime files** appear in the planned changes. Only `docs/vibe-coding/**` and related kit paths are expected.
- [ ] Confirm no error exits during dry run.
- [ ] **Confirm working tree is still fully clean** — run `git status --porcelain -u` immediately before the actual update. Phase 4 of kit-update will halt on any untracked file, even files that were present but not yet committed. All untracked files must be resolved (committed or removed) before proceeding.
- [ ] If unexpected files appear in scope: **UNEXPECTED APP IMPACT.** Stop and escalate.

---

## Step 7 — Run Actual Update

- [ ] Confirm still on rollout branch (not default branch).
- [ ] Run the actual update (same option as Step 6, without `-WhatIf`).
- [ ] Record update output (version before/after, files changed, exit code).
- [ ] **If the update succeeds:** stop immediately after update completes. Do not push.- [ ] **Expect squash + merge commit pair:** `git subtree pull` produces two commits — a squash commit and a merge commit — rather than a single conventional `chore(kit):` commit. This is canonical git subtree behavior and is not an error. Record both SHAs.
- [ ] **Owner-only file deletion is expected cleanup:** The payload intentionally excludes owner-only files (`REPORT-KIT-*`, `kit-workspace/`, `PAUSE.md`). If the subtree pull removes these from the consumer, this is correct — not contamination. Confirm deleted files are confined to `docs/vibe-coding/**` only.- [ ] **If subtree pull fails with a deleted-file conflict under `docs/vibe-coding/**`:**
  1. Confirm the conflicted file is absent from current payload:
     ```powershell
     git show vibe-coding-kit/release/consumer-payload:docs/vibe-coding/<filename>
     # Expected: fatal — file does not exist in payload
     ```
  2. If absent from payload and conflict is deletion-only (no content conflict, no app/runtime files):
     ```powershell
     git rm docs/vibe-coding/<filename>
     git merge --continue
     ```
  3. Confirm `git status --porcelain -u` is clean after merge.
  4. If conflict involves content changes, app/runtime files, or multiple files: **STOP.** Do not resolve. Report as `GIT REPO BLOCKER`. See MIGRATION-INSTRUCTIONS.md Blocker 2.
- [ ] Do not push.

---

## Step 8 — Commit Kit-Only Changes

- [ ] Run `git status --porcelain -u` — record all changed files.
- [ ] Confirm all changed files are under `docs/vibe-coding/**` or equivalent kit subtree path. No app/runtime files.
- [ ] If the updater did not auto-commit, stage and commit:
  ```powershell
  git add docs/vibe-coding/
  git commit -m "chore(kit): update to vX.Y.Z"
  ```
- [ ] If app/runtime files appear in the diff: **UNEXPECTED APP IMPACT.** Stop. Do not commit.

---

## Step 9 — Closeout Verification

All items must pass before declaring the rollout complete.

- [ ] **Still on rollout branch** — confirm `git rev-parse --abbrev-ref HEAD` is the rollout branch, not the default branch.
- [ ] **Installed kit version** — read `docs/vibe-coding/VIBE-CODING.VERSION.md` → confirm expected version.
- [ ] **git-helpers.ps1 present** — confirm `docs/vibe-coding/tools/git-helpers.ps1` exists and contains `Get-DocsRoot` and `Get-FullTreeStatus`.
- [ ] **session-start dot-sources helper** — confirm `docs/vibe-coding/tools/session-start.ps1` contains `$gitHelpersScript = Join-Path $PSScriptRoot 'git-helpers.ps1'`.
- [ ] **kit-update dot-sources helper** — confirm `docs/vibe-coding/tools/kit-update.ps1` contains same.
- [ ] **kit-update -WhatIf returns NOOP(Current)** — run `.\docs\vibe-coding\tools\kit-update.ps1 -WhatIf` and confirm output contains `NOOP` or `Current`.
- [ ] **Phase 4 gate present** — `docs/vibe-coding/tools/kit-update.ps1` contains `"Untracked files detected. Full clean tree required before kit update."`.
- [ ] **Phase 5B gate present** — `docs/vibe-coding/tools/kit-update.ps1` contains `"kit-update must not run on the repo default branch"`.
- [ ] **Recalled file absent** — `docs/vibe-coding/.vscode/settings.json` is not tracked and not present.
- [ ] **Handle generated `docs/forGPT/**` files** — if `run-vibe start` generated handoff packet files:
  1. Inspect each file: markdown/JSON only, no secrets, no executable content.
  2. Confirm `VERSION-MANIFEST.md` or `forgpt.manifest.json` shows generated by `sync-forgpt.ps1`.
  3. **After any kit file deletion (Step 7 Blocker 2):** inspect `forgpt.manifest.json` for stale references to the deleted file before refreshing. Remove stale references and commit as `docs(forgpt): remove stale kit file reference from manifest`. See MIGRATION-INSTRUCTIONS.md Blocker 3.
  4. If safe, commit refreshed packet: `git add docs/forGPT/ && git commit -m "docs(forgpt): refresh AI handoff packet"`
  5. If not safe, stop and request operator review before committing.
  6. **Do not add `docs/forGPT/` to `.gitignore` or delete it** without operator approval.
- [ ] **Rerun `kit-update -WhatIf` after forGPT commit** — must return `NOOP(Current)` with clean tree.
- [ ] **Final `git status --porcelain -u`** — must return empty output.
- [ ] **Dirty forGPT output is a next-session blocker:** If `sync-forgpt.ps1` ran during closeout and generated or modified files in `docs/forGPT/`, those files must be committed before ending the session. An uncommitted `docs/forGPT/` will fail the clean-tree check at the start of the next session. Do not exit until `git status --porcelain -u` is empty.
- [ ] **No push** — confirm `git log --branches --not --remotes` shows the rollout branch commit is local-only.
- [ ] **No reports committed** — confirm no `REPORT-*.md` or `POSTMORTEM-*.md` files appear in `git log --name-only -1`.
- [ ] **Distinguish default branch state before closeout merge:** Confirm whether the rollout branch is (a) ahead of default — normal, ready to merge — or (b) behind/diverged — default received commits during rollout, requires operator decision. Do not merge a diverged branch without explicit operator review.
- [ ] **Solo repo closeout variant:** For consumer repos with no team PR review, a clean verified rollout branch may be merged to the default branch and pushed directly rather than PR'd. Only do this when: (a) all Step 9 checks pass, (b) the operator explicitly approves the merge, and (c) the merge is fast-forward or docs-only.
- [ ] **Remote Reality WARN on no-PR branch is expected:** When a rollout branch is pushed but no PR exists, end-session Remote Reality will report WARN (not PASS). This is expected until either: (a) a PR is created, or (b) the branch is merged to default and the default branch tracking is updated. Document the WARN as expected in the session closeout log.

**If all items pass:** Classification = `UPDATED CLEANLY`.  
**If kit-update returned NOOP:** Classification = `ALREADY CURRENT`.  
**Record the classification and commit SHA before ending the session.**

---

---

## Future Runtime Improvement Candidates

These gaps were identified during consumer rollouts. They are candidates for future script changes but must not be implemented during docs-only harvest sessions.

| Item | Gap | Source |
|---|---|---|
| `run-vibe.ps1 -Ref passthrough` | `run-vibe.ps1` does not forward `-Ref` to `kit-update.ps1`. Rollouts requiring an explicit ref must invoke `kit-update.ps1` directly. | Dealers Choice rollout, 2026-05-07 |
| End-session WARN for dirty generated forGPT output | End-session should detect uncommitted `docs/forGPT/` output from `sync-forgpt.ps1` and warn before allowing clean-close. | Dealers Choice rollout, 2026-05-07 |
| Cleaner Remote Reality reporting | End-session should distinguish: (a) pushed branch with no PR (expected WARN), (b) default branch behind/diverged (escalation needed), (c) default branch ahead after solo merge (clean). Current output conflates these states. | Dealers Choice rollout, 2026-05-07 |

---

## See Also

- [MIGRATION-INSTRUCTIONS.md — Consumer Dirty Tree Triage](../MIGRATION-INSTRUCTIONS.md) — five-category triage for pre-rollout dirty tree resolution
- [MIGRATION-INSTRUCTIONS.md — Stale Consumer Bootstrap Procedure](../MIGRATION-INSTRUCTIONS.md) — full stale-consumer bootstrap flow for first-time updates from old payloads
- [portability/subtree-playbook.md](subtree-playbook.md) — subtree add/pull workflows and layout reference
