# Candidate 2 Reassessment

## Verdict
- Proceed (staged, examples-only).
- Scope is viable only if extraction is limited to non-normative templates/examples and preserves protocol section anchors.

## Prior Research Lookup
- Intended command:
  - `./tools/check-prior-research.ps1 -Terms "candidate 2","protocol extraction","evidence pack","research saved indexed","template"`
- Result: tool currently fails with PowerShell parser error at `tools/check-prior-research.ps1:115`.
- Fallback manual lookup used (canonical fallback path in protocol):
  - `grep_search` across `docs/research/*.md`, `docs/status/*.md`, and protocol links.
- Relevant prior docs read:
  - `R-001-Vibe-Kit-Compression-Options.md`
  - `docs/status/REPORT-KIT-PROTOCOL-V7-SIZE-REDUCTION-PLAN-001.md`
- Conclusion: prior work exists and supports staged extraction of examples/templates only.

## Protocol Section Classification

| Section | Classification | Why |
|---|---|---|
| No Guessing / Tiered Confidence Gate | CANONICAL | Defines thresholds, STOP behavior, and enforcement semantics. |
| RESEARCH-ONLY Command Lock | CANONICAL | Defines allowed/forbidden actions and hard constraints. |
| INSTRUMENTATION Scope | MIXED | Guardrail rules are canonical; comparison/explanatory table can be moved. |
| Evidence Pack Requirement | MIXED | Required sections + confidence statement are canonical; template block is detail. |
| Research Saved + Indexed | MIXED | MUST-save/MUST-index is canonical; index field exposition can be summarized. |

## Safe Extraction Candidates

| Candidate | Section | Reason | Risk |
|---|---|---|---|
| 1 | Evidence Pack Template (Section B) | Pure example/template content; no new policy introduced by moving it. | LOW |
| 2 | Prior Research Lookup command examples | Example command snippets can live in standard/tool docs while retaining one-line rule in protocol. | LOW-MEDIUM |
| 3 | ResearchIndex explanatory detail block | Detailed field list duplicates research-standard ownership. | MEDIUM |
| 4 | INSTRUMENTATION vs RESEARCH-ONLY comparison table | Explanatory contrast can move if canonical constraints remain in-place. | MEDIUM |

## Do NOT Touch
- No Guessing / Tiered Confidence Gate normative thresholds and STOP semantics.
- RESEARCH-ONLY Command Lock allowed/forbidden rule statements.
- Evidence Pack Requirement Section A (required evidence categories) and Section C (confidence statement).
- Research Saved + Indexed MUST-save/MUST-index rule language.

## Estimated Gain
- Conservative extractable detail (safe-first set):
  - Evidence Pack Template (B): 40 lines, 107 words
  - Prior Lookup step examples: 16 lines, 95 words
  - ResearchIndex detail block: 16 lines, 62 words
- Total potential (safe-first):
  - 72 lines
  - 264 words
- Extended optional candidate (higher caution):
  - INSTRUMENTATION comparison table: 12 lines, 105 words
- Total including optional candidate:
  - 84 lines
  - 369 words

## Risks
- Drift risk:
  - Moving examples to standards/templates can drift from canonical rule updates unless links are maintained and audited.
- Enforcement mismatch risk:
  - Section titles/anchors are widely linked; removing or renaming headings can break references and operator flow.
- Authority ambiguity risk:
  - If extracted text contains MUST/STOP wording, authority may become fragmented.
- Operator confusion risk:
  - Over-compression can force unnecessary context switching if local one-line executable summaries are not kept.

## Script Coupling Check
- No direct script parsing dependence found on protocol prose wording for Candidate 2 targets.
- Main coupling is documentation/anchor coupling (many markdown references to canonical protocol anchors).

## Proposed Staged Plan

### Stage 1 (exact scope)
- Extract only `Evidence Pack Requirement -> B) Evidence Pack Template` into a standard/template document.
- Keep protocol section heading and add one-line executable summary + canonical pointer.
- Keep all MUST/STOP rules and thresholds in protocol unchanged.

### Stage 2 (validation method)
- Validate anchor integrity (all existing protocol links still resolve).
- Run doc audit and protocol index verification.
- Review standalone readability in protocol section (no link-only gap).

### Stage 3 (expand only if no drift)
- If Stage 1 remains stable, evaluate one additional detail block (Prior Lookup examples OR ResearchIndex detail), one at a time.
- Repeat validation after each extraction slice.

## Recommendation
- Single next step: run a Stage 1 implementation prompt for extracting only the Evidence Pack template block, then validate links + doc audit before considering any further Candidate 2 extraction.
