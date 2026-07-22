# Work With Me MVP Automation Test Design

## Purpose
Translate locked product/content requirements into implementable automated test design for the MVP migration.

## Test Layers
### Layer A: Deterministic automated output tests
Scope:
- Pure generation contracts.
- No AI model call.
- No behavioral effectiveness judgments.

### Layer B: UI integration and route/session tests
Scope:
- Setup/result flows.
- Guard enforcement.
- Session persistence and recovery.
- Copy actions and accessibility state.

### Layer C: Manual behavioral tests against AI assistant
Scope:
- Human-reviewed assistant output usefulness.
- Not automated in MVP.

## Unit-Test Structure
Recommended suites:
1. `prompt-catalog.validator.spec.ts`
2. `permanent-prompt.generator.spec.ts`
3. `capacity-modifier.generator.spec.ts`
4. `profile.validation.spec.ts`
5. `word-count.spec.ts`
6. `session.store.spec.ts`
7. `result.guard.spec.ts`
8. `setup.component.spec.ts`
9. `result.component.spec.ts`
10. `intro.component.spec.ts`

## Deterministic Generator Coverage
### Exhaustive profile enumeration (243)
Strategy:
- Enumerate all tuples of five option codes (`A|B|C`) in deterministic lexicographic order.
- Map tuple to semantic selection object keyed by question ID.
- Generate permanent prompt and assert hard invariants.

Expected profile count:
- $3^5 = 243$

### Exhaustive profile-capacity enumeration (729)
Strategy:
- Cross product of 243 permanent profiles and 3 capacities (`usual|limited|very-limited`).
- Assert permanent prompt invariants plus capacity exact-string invariants.

Expected combination count:
- $3^6 = 729$

### Required exact-string assertions
For each generated permanent prompt:
- Shared opening exact match.
- Shared closing exact match.
- Exactly one selected module per question.
- Exactly five module strings between opening and closing.
- Selected modules appear in fixed Q1->Q5 order.
- Module strings are exact authored strings (no rewrite).

### Exact duplicate defense assertions
- Duplicate check uses normalized full-string equality only.
- Normalization limited to outer trim and whitespace collapse.
- Only later exact duplicate full strings are removed.
- Surviving strings remain byte-for-byte authored strings.
- Add dedicated test proving Q1-C and Q2-C are both preserved.

### Forbidden-term scanning
Case-insensitive scan applies only to generated outputs:
- permanent prompt text
- capacity modifier text

Term list:
- ADHD
- burnout
- neurotypical
- diagnosis
- diagnose
- diagnostic
- disorder
- impairment
- disability
- disabled
- medical condition
- mental health condition

### Word-count checks
- Hard fail when permanent prompt word count > 180.
- Report-only flags when < 90 or > 140.
- No content rewriting to force target range.

### Capacity exactness checks
- `usual` -> no modifier (`null` or empty by contract).
- `limited` -> exact authored limited string.
- `very-limited` -> exact authored very-limited string.

## Session-Store Test Design
Coverage:
- initialize empty state with schema version 1.
- persist answer per question ID in session storage.
- reject unknown question IDs and unknown option codes.
- clear malformed payloads.
- clear legacy payload (`wwm-session-v2` or incompatible shape).
- preserve active progress across reload within browser session.
- preserve result-page reload with complete valid profile.
- clear all state on start-over.
- verify capacity state remains separate from permanent profile identity.

## Route-Guard Test Design
Coverage:
- allow `/result` only when all five required selections are valid.
- redirect partial profile to `/setup`.
- redirect malformed session to `/setup` and clear invalid data.
- redirect when content unavailable for result rendering.
- preserve valid reload path.

## Setup Component Test Design
Coverage:
- render exactly five required questions.
- render exactly three options per question.
- enforce single selection per question.
- deterministic question order.
- keyboard navigation across radio options.
- progress semantics announced.
- no hidden default answer fallback.
- no analytics event calls.
- no age-gate controls.

## Result Component Test Design
Coverage:
- display permanent prompt from deterministic generator.
- permanent prompt copy action copies exact visible text.
- capacity selector renders on results only.
- capacity change updates only temporary modifier.
- permanent prompt content is unchanged after capacity changes.
- capacity modifier copy action is separate from permanent prompt copy.
- clipboard failure state messaging and announcement.
- start-over clears session and routes correctly.
- no analytics calls and no feedback-form link.

## Accessibility Assertions
Automated checks should include:
- semantic radio group structure per question.
- labels and legends exposed to assistive tech.
- visible focus style on keyboard navigation.
- selected-state announcement (`checked` state) works.
- error messaging is associated and announced.
- copy status announced via live region.
- reduced-motion mode keeps interaction intact.
- layout remains usable at 400% zoom.

## Playwright Coverage Plan
### Happy paths
- Intro -> setup -> result with five answers.
- Copy permanent prompt.
- Select capacity and copy capacity modifier.

### Keyboard-only path
- Complete setup using keyboard only.
- Trigger copy actions with keyboard.

### Result reload
- Reload `/result` with valid in-session state and verify stable output.

### Start-over path
- Start over from result and verify session cleared.

### Malformed-session recovery
- Seed invalid session payload and verify redirect/recovery behavior.

## Inherited Tests to Replace or Remove
Replace:
- `src/app/core/engine/document.generator.spec.ts`
- `src/app/core/session/session.store.spec.ts`
- `src/app/features/setup.component.spec.ts`
- `src/app/features/result.component.spec.ts`
- `src/app/features/result.guard.spec.ts`
- `src/app/features/intro/intro.component.spec.ts`
- `e2e/single-category.spec.ts`
- `e2e/td-rawls-001-smoke-dist.spec.ts`
- `src/app/integration/result-guard.production-content-contract.spec.ts`
- `src/app/integration/real-content-flow.integration.spec.ts`

Remove with legacy functionality:
- `src/app/core/engine/profile.spec.ts`
- `src/app/core/scoring/scoring-engine.spec.ts`
- `src/app/features/followups.guard.spec.ts`
- `src/app/features/followups-guard.production-content-contract.spec.ts`
- `src/app/features/select.component.spec.ts`
- `src/app/features/result.persona.router.spec.ts`
- `src/app/shared/share/share-card.service.spec.ts` (if share service removed)

## Planned Automated Test Categories
1. Content schema validation.
2. Profile selection validation.
3. Deterministic permanent assembly order.
4. Exact module text assertions.
5. Duplicate-defense-only behavior.
6. Forbidden-term generated-output scan.
7. Word-count hard/target behavior.
8. Exhaustive 243 profile coverage.
9. Exhaustive 729 profile-capacity coverage.
10. Capacity exact-string generation.
11. Session lifecycle and invalidation.
12. Result guard strictness and recovery.
13. Setup UI selection and progress behavior.
14. Result UI copy and split copy actions.
15. Accessibility unit/integration assertions.
16. Playwright end-to-end deterministic flows.

## Non-Automated in MVP
Manual behavioral effectiveness tests against AI assistants remain manual and are not automated in MVP CI.