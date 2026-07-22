# Work With Me Evidence Lineage

## Scope
This document records evidence lineage across major product versions in this repository.

It separates:
- confirmed repository artifacts,
- project-report-supported claims,
- recollections that still need source recovery,
- unknowns.

## Confidence Labels
- confirmed by repository artifact
- supported by project report
- recollection requiring verification
- unknown

## Version 1: Original Seven-Dimension/Scored Version

- Name: Rawls ideals/persona scoring flow
- Approximate date: 2025-11 through 2026-01 (artifact-dated docs and tests)
- Questionnaire structure: 7 ideals with Likert-style answer ranges, follow-up positions, and deeper dives/challenges
- Generation model: scoring/aggregation pipeline with persona/profile computation
- Principal product theory: values-based reflection and persona-oriented explanation
- Implementation status: historical; removed from current MVP runtime
- Behavioral testing occurred: not confirmed for WITH/WITHOUT style assistant-output experiments
- What was tested: unit, contract, integration, and e2e around content shape, route flow, scoring/persona, and challenge triggers
- What passed: historical logs repeatedly report green unit/build runs for that stack
- What failed: no specific behavioral-effectiveness failure artifacts located in repository snapshot
- What changed afterward: architecture pivoted away from scores/profiles and legacy routes toward Work With Me prompt instructions
- Findings that survived into current product: fail-closed validation discipline, deterministic content contracts, strict guard behavior
- Findings dropped or weakened: score/persona-centered output framing and ideal/challenge interaction model
- Sources:
  - docs/testing/test-catalog.md
  - docs/handoffs/handoff-2026-01-03-protocol-v7-verification-mode.md
  - docs/architecture/LEGACY-MIGRATION-MAP.md
- Confidence: confirmed by repository artifact

## Version 2: Five-Control Direct-Mapping Version

- Name: five-control direct-mapping (intermediate)
- Approximate date: not directly evidenced in currently tracked files
- Questionnaire structure: not reliably recoverable from current tree
- Generation model: direct mapping claim exists in lineage discussions, but implementation evidence is not directly present in current tracked files
- Principal product theory: reduce scoring abstraction and map selected controls more directly to output behavior
- Implementation status: uncertain from current tree alone
- Behavioral testing occurred: unknown
- What was tested: unknown
- What passed: unknown
- What failed: unknown
- What changed afterward: likely superseded by six-control session-coach and then five-question MVP
- Findings that survived into current product: possible conceptual move toward explicit authored instruction text
- Findings dropped or weakened: unknown
- Sources:
  - no explicit five-control artifact located via repository search on current tree
- Confidence: recollection requiring verification

## Version 3: Six-Control Session-Coach Version

- Name: session-coach six-control instructions
- Approximate date: 2025-12 to early 2026 (artifact dates)
- Questionnaire structure: six controls (load, scope, challenge, rigor, coachingThreshold, coachingDelivery), each with one A/B/C question
- Generation model: per-control output modules with universal guardrails in content payload; legacy runtime also included score-oriented pathways per migration records
- Principal product theory: conversation coaching and guardrails with user preference controls
- Implementation status: historical runtime; now superseded
- Behavioral testing occurred: deterministic and workflow tests are evidenced; explicit reproducible WITH/WITHOUT outcome packet is not located in current tree
- What was tested: content pipeline integrity, route behavior, component behavior, and runtime contracts
- What passed: historical test/build logs in status reports; artifacts describe green gates for those changes
- What failed: no direct archived failure transcript for reported brevity regressions found in repository snapshot
- What was changed afterward: six-control runtime removed, one-copy five-question Work With Me MVP implemented
- Findings that survived into current product:
  - "answer normally when request is already clear" intent
  - "state a reasonable assumption and continue" intent
  - "ask one question only when materially needed" intent
- Findings dropped or weakened:
  - six-control schema and coaching-threshold/coaching-delivery control split
  - legacy copy-and-routing model and historical score-linked code paths
- Sources:
  - src/assets/content/working-with-me.json
  - docs/status/session-coach-pivot.md
  - docs/architecture/LEGACY-MIGRATION-MAP.md
- Confidence: confirmed by repository artifact

## Version 4: Current Five-Question Work With Me MVP

- Name: five-question deterministic one-copy MVP
- Approximate date: 2026-07 (release-candidate and merged main state)
- Questionnaire structure: five permanent questions with A/B/C, plus optional capacity selector (usual/limited/very-limited)
- Generation model: deterministic permanent generator plus separate capacity modifier composed into one copy block at result time
- Principal product theory: reusable baseline instructions with optional temporary bandwidth paragraph
- Implementation status: active production runtime in this repository
- Behavioral testing occurred: deterministic correctness is thoroughly tested; behavioral effectiveness remains unproven
- What was tested: 243 permanent and 729 profile-capacity combinatorial determinism, result-guard integrity, one-copy composition behavior, reload and e2e paths
- What passed: full unit/build/e2e gates and combinatorial assertions
- What failed: no reproducible effectiveness gate results yet
- What changed afterward: this phase introduces evidence recovery and a new effectiveness-gate package (prepared, not yet model-run)
- Findings that survived into current product:
  - explicit-request precedence
  - one-question-only clarification intent for material uncertainty
  - continue-with-assumption behavior in shared closing
- Findings dropped or weakened:
  - previous stack-specific coaching controls and legacy route model
- Sources:
  - docs/product/MVP-PRODUCT-SPEC.md
  - src/app/core/mvp/mvp-content.repository.ts
  - src/app/core/mvp/mvp-generator.ts
  - src/app/core/mvp/mvp-generator.spec.ts
  - docs/status/MVP-RELEASE-CANDIDATE.md
- Confidence: confirmed by repository artifact

## Required Evidence Finding: Assumption and Clarification Behavior

### Earlier evidence located
- In six-control content, coachingDelivery B explicitly says to answer using a reasonable assumption and name it:
  - src/assets/content/working-with-me.json (coachingDelivery.output.B)
- In current MVP shared closing:
  - "state a reasonable assumption and continue"
  - "ask one question only when the answer would materially change the result"
- In current MVP shared opening:
  - "Answer normally when my request is already clear and specific"
- In current MVP Q3-C module:
  - "Ask one question first only when missing information could materially change the recommendation."

### Earlier effectiveness proof status
- A historical WITH/WITHOUT gate pattern is referenced in current status documentation, but a full reproducible prior-results artifact with preserved raw outputs is not located in this repository snapshot.
- Therefore, improvement claims are not upgraded to confirmed proof here.

### Continuity map
- stating a reasonable assumption: preserved in current product
- continuing without unnecessary interruption: partially preserved (text intent preserved; empirical confirmation pending)
- asking one focused question only when needed: preserved in current product
- avoiding generic tail-end question lists: partially preserved (intent implied; explicit measured evidence not located)
- doing little or nothing different for already-clear prompts: preserved in current product

### Confidence
- text-level continuity: confirmed by repository artifact
- behavior-level improvement claims: supported by project report or recollection requiring verification (case-by-case)

## Required Evidence Finding: Brevity Behavior

### Located in repository
- Prior-reported candidate wording exists in legacy six-control content (load output B):
  - "For broad or open-ended requests that do not ask for full detail, answer in 5 bullet points or fewer, under 100 words total, then stop -- no numbered multi-section framework -- and expand only the part I ask about next."
  - Source: src/assets/content/working-with-me.json

### Not located in repository snapshot
- explicit artifact proving a separate soft-brevity instruction failure
- archived raw response proving approximately 400-word output
- archived first hard-cap revision text distinct from the wording above
- archived test transcript proving reported 273-word recount
- exact pass/fail run packet with model/provider metadata, repeated runs, and locked criterion logs

### Evidence status
- existing wording artifact: confirmed by repository artifact
- performance claims around 400-word failure / 273-word recount / final success: supported by hostile-review narrative but requiring source recovery

## Pivot Continuity Summary

| Finding | Continuity |
|---|---|
| Deterministic authored-string generation contracts | preserved in current product |
| Exhaustive combinatorial deterministic checks | preserved in current product |
| Assumption + one-question clarification principle | preserved in current product |
| Clear-prompt minimal interference principle | preserved in current product |
| Six-control coaching architecture | not preserved |
| Score/persona-based output model | not preserved |
| Prior behavior-effectiveness proof packet | unknown |
| Hard-cap brevity efficacy proof with raw outputs | unknown |

## Evidence Gaps to Recover
- historical WITH/WITHOUT result packets with raw outputs and condition labels
- exact prompts and acceptance criteria used for brevity failure and recovery claims
- model/provider/version metadata and rerun counts for those historical results
- immutable commit or artifact links for reported word-count outcomes
