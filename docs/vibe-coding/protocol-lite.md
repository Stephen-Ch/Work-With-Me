# Protocol Lite

> **File Version:** 2026-07-17
> **Purpose:** Fast, practical default workflow. Use this first.

---

## Default Model

- **Default mode:** Vibe Lite
- **Escalation mode:** Vibe Strict / Octopus
- **Urgent narrow fixes:** Emergency Bug
- **Urgent + Strict triggers:** Emergency Strict

Canonical mode guide: [AI-WORKFLOW.md](AI-WORKFLOW.md)

---

## Deterministic Risk Signal

Session-start emits a read-only risk signal, including `RiskCheck=LITE|STRICT`.

- If `RiskCheck=STRICT`, use Vibe Strict or Emergency Strict before editing.
- AI may raise risk but may not lower a deterministic Strict result.
- Risk signal is non-mutating and fails closed when rules are missing/unreadable.

---

## Task Tag Traceability

Start every prompt with a searchable task tag:

- `[LITE-accordion-focus-04]`
- `[STRICT-session-start-risk-check-01]`
- `[EMERGENCY-email-confirmation-02]`
- `[EMERGENCY-STRICT-login-failure-01]`

Echo the same tag in every response with one result word:

- `done`
- `blocked`
- `partial`
- `needs review`
- `no changes`

Example response line:

`[LITE-accordion-focus-04 — done]`

No registry or approval gate is required.

---

## Lite Prompt Minimum

1. Task tag
2. Goal
3. Scope
4. Do-not-touch list
5. Verification plan
6. Stop-if boundary

Lite default does **not** require:

- formal PROMPT-ID ceremony
- default 95%/99% confidence percentages
- default Proof-of-Read
- default Prompt Review Gate
- default full completion report

---

## Lite Completion Format

1. Tag/result
2. Files changed
3. Checks run
4. Remaining risk or next step

Use fuller reporting in Strict mode when needed.

---

## Emergency Rules

### Emergency Bug

- smallest safe urgent fix
- no refactor
- verify affected path
- stop after one focused attempt

### Emergency Strict

If urgent work hits Strict triggers (auth, login, permissions, roles, secrets, database/migrations/schema, deploy/CI-CD, session-start/update tooling, shared scripts, Vibe kit files), use Emergency Strict.

---

## Tiny-Step TDD (Supported)

For behavior-changing code tasks:

1. identify/write one failing test
2. make the smallest code change
3. run the narrowest relevant test
4. stop at green and report

This is a tactic, not a universal governance system.

---

## Strict References

- Strict/Octopus rules: [protocol/protocol-v7.md](protocol/protocol-v7.md)
- Strict hard gates: [protocol/hard-rules.md](protocol/hard-rules.md)
- Command reference: [protocol/canonical-commands.md](protocol/canonical-commands.md)
