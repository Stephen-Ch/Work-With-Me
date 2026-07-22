# Prompt Template (Mode-Aware)

> Default workflow is Vibe Lite. Use Strict only when risk requires it.
> Canonical mode guide: [AI-WORKFLOW.md](../AI-WORKFLOW.md)

---

## 1) Vibe Lite Prompt (Default, max 80 lines)

```text
[TAG: [LITE-<slug>-<nn>]]
MODE: LITE
GOAL:
SCOPE:
DO-NOT-TOUCH:
VERIFY:
STOP-IF:
TASKS:
1)
2)

REPORT FORMAT:
- [same-tag — done|blocked|partial|needs review|no changes]
- Files changed:
- Checks run:
- Remaining risk / next step:
```

---

## 2) Vibe Strict Prompt (max 150 lines)

Use when `RiskCheck=STRICT` or task risk is explicitly high.

```text
[TAG: [STRICT-<slug>-<nn>]]
MODE: STRICT
GOAL:
SCOPE:
DO-NOT-TOUCH:
VERIFY:
STOP-IF:
STRICT SAFEGUARDS:
- (Prompt Review Gate / Proof-of-Read / fuller evidence as needed)
TASKS:
1)
2)

REPORT FORMAT:
- [same-tag — done|blocked|partial|needs review|no changes]
- Files changed:
- Checks run:
- Remaining risk / next step:
- Extra strict evidence (if requested):
```

---

## 3) Emergency Bug Prompt (max 80 lines)

```text
[TAG: [EMERGENCY-<slug>-<nn>]]
MODE: EMERGENCY
GOAL: Urgent narrow fix.
SCOPE: One affected path.
DO-NOT-TOUCH: No refactor, no broad cleanup.
VERIFY: Narrow test/check only.
STOP-IF: First focused attempt fails or scope expands.
TASKS:
1)

REPORT FORMAT:
- [same-tag — done|blocked|partial|needs review|no changes]
- Files changed:
- Checks run:
- Remaining risk / immediate next step:
```

---

## 4) Emergency Strict Prompt (max 80 lines)

Use for urgent work that also hits Strict triggers.

```text
[TAG: [EMERGENCY-STRICT-<slug>-<nn>]]
MODE: EMERGENCY-STRICT
GOAL:
STRICT TRIGGER:
SCOPE:
DO-NOT-TOUCH:
VERIFY:
STOP-IF:
TASKS:
1)

REPORT FORMAT:
- [same-tag — done|blocked|partial|needs review|no changes]
- Files changed:
- Checks run:
- Remaining risk / immediate next step:
```

---

## Tiny-Step TDD (Optional tactic)

For behavior-changing code tasks:

1. identify or write one failing test
2. make the smallest code change
3. run the narrowest relevant test
4. stop after green and report

This tactic does not reintroduce unrelated Strict ceremony into Lite prompts.
