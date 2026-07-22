# Work With Me MVP Implementation Plan (TDD)

## Plan Principles
- Small, reviewable commits with explicit rollback boundaries.
- Red -> Green -> Refactor workflow per phase.
- No scoring/averaging compatibility layer.
- No implementation on `main`; work on feature branch only.

## Phase 1: Domain Types and Fixed Content Model
Goal:
- Introduce stable semantic IDs and typed MVP content model.

Files expected to change:
- `src/app/core/content/types.ts`
- `src/assets/content/working-with-me.json`
- `src/app/core/content/content.service.ts`
- `src/app/core/content/content.service.spec.ts`

Red test introduced first:
- New unit test asserting exactly five semantic question IDs and 15 module entries fails against current six-control schema.

Implementation work:
- Replace V2 control types with MVP semantic types.
- Add typed content adapter validation for locked structure.

Verification commands:
- `npm test -- --include src/app/core/content/content.service.spec.ts`
- `npm run build`

Acceptance gate:
- Content service returns valid typed MVP model; no control-based fields required.

Proposed commit message:
- `refactor: define MVP semantic content model`

Rollback boundary:
- Revert only content/type/service commit without affecting generator or UI phases.

## Phase 2: Pure Deterministic Prompt Generator
Goal:
- Replace score-based generator pipeline with exact ordered concatenation.

Files expected to change:
- `src/app/core/engine/scoring.engine.ts` (removed)
- `src/app/core/engine/document.generator.ts` (replaced)
- `src/app/core/engine/document.generator.spec.ts`

Red test introduced first:
- Exact-order test for opening + Q1..Q5 + closing fails with old generator behavior.

Implementation work:
- Implement `generatePermanentPrompt(...)`, duplicate guard normalization, and `countWords(...)`.

Verification commands:
- `npm test -- --include src/app/core/engine/document.generator.spec.ts`
- `npm run build`

Acceptance gate:
- Generator produces exact authored strings in fixed order; no scoring imports remain.

Proposed commit message:
- `refactor: replace scoring pipeline with deterministic prompt generator`

Rollback boundary:
- Revert generator-only commit while preserving Phase 1 domain schema.

## Phase 3: Exhaustive 243/729 Generator Tests
Goal:
- Add exhaustive deterministic tests and capacity exact-string checks.

Files expected to change:
- `src/app/core/engine/document.generator.spec.ts` (or split into dedicated test files)
- optionally new `src/app/core/engine/prompt.exhaustive.spec.ts`

Red test introduced first:
- Exhaustive count assertion fails because test harness not yet implemented.

Implementation work:
- Implement profile enumerators for 243 permanent profiles and 729 profile-capacity combinations.
- Add forbidden-term scanner and exact duplicate assertions.
- Add report-only target-range checks (90-140) and hard-fail > 180.

Verification commands:
- `npm test -- --include src/app/core/engine/**/*.spec.ts`
- `npm run build`

Acceptance gate:
- Exhaustive suites pass with deterministic assertions and reporting behavior.

Proposed commit message:
- `test: add exhaustive deterministic prompt generation coverage`

Rollback boundary:
- Revert exhaustive-test commit without impacting runtime behavior.

## Phase 4: Versioned Session-State Replacement
Goal:
- Replace six-control session schema with MVP versioned session model.

Files expected to change:
- `src/app/core/session/session.store.ts`
- `src/app/core/session/session.store.spec.ts`

Red test introduced first:
- Test expecting invalid legacy `wwm-session-v2` payload to be purged fails.

Implementation work:
- Introduce key `wwm-mvp-session-v1` and schema version `1`.
- Support active-session persistence only; no completed-history persistence.

Verification commands:
- `npm test -- --include src/app/core/session/session.store.spec.ts`
- `npm run build`

Acceptance gate:
- Active progress persists in session; malformed/legacy payloads are discarded safely.

Proposed commit message:
- `refactor: replace session schema with MVP v1 session model`

Rollback boundary:
- Revert session commit without touching generator/content model.

## Phase 5: Five-Question Setup Flow
Goal:
- Transition setup UI from six controls to five required semantic questions.

Files expected to change:
- `src/app/features/setup.component.ts`
- `src/app/features/setup.component.spec.ts`

Red test introduced first:
- Existing spec expecting 6 questions fails after introducing 5-question assertions.

Implementation work:
- Bind setup to semantic question list from MVP content model.
- Ensure exactly one A/B/C choice per question and deterministic ordering.
- Remove analytics call from setup flow.

Verification commands:
- `npm test -- --include src/app/features/setup.component.spec.ts`
- `npm run build`

Acceptance gate:
- Setup presents exactly five questions and requires an answer to advance.

Proposed commit message:
- `feat: implement five-question setup flow`

Rollback boundary:
- Revert setup-only commit while retaining domain/generator/session layers.

## Phase 6: Strict Result Guard
Goal:
- Enforce full valid permanent profile before `/result`.

Files expected to change:
- `src/app/features/result.guard.ts`
- `src/app/features/result.guard.spec.ts`
- `src/app/integration/result-guard.production-content-contract.spec.ts`

Red test introduced first:
- Guard test expecting redirect on malformed/partial profile fails with old behavior.

Implementation work:
- Validate complete five-answer state and known IDs/options before allowing route.

Verification commands:
- `npm test -- --include src/app/features/result.guard.spec.ts`
- `npm run build`

Acceptance gate:
- Partial or malformed sessions always redirect to `/setup`.

Proposed commit message:
- `feat: enforce strict MVP result guard`

Rollback boundary:
- Revert guard commit without affecting setup persistence logic.

## Phase 7: Permanent Prompt Result Presentation and Copy
Goal:
- Render deterministic permanent prompt with dedicated copy action.

Files expected to change:
- `src/app/features/result.component.ts`
- `src/app/features/result.component.spec.ts`

Red test introduced first:
- Test expecting result to use deterministic generator and exact visible copy text fails.

Implementation work:
- Remove scoring invocation and bind result to `generatePermanentPrompt(...)`.
- Keep explicit copy success/failure status.

Verification commands:
- `npm test -- --include src/app/features/result.component.spec.ts`
- `npm run build`

Acceptance gate:
- Permanent prompt copy action copies exact displayed text.

Proposed commit message:
- `feat: render deterministic permanent prompt on result`

Rollback boundary:
- Revert result-render commit while keeping strict guard in place.

## Phase 8: Capacity Selector, Modifier, and Separate Copy Action
Goal:
- Add optional temporary capacity behavior without mutating permanent profile.

Files expected to change:
- `src/app/features/result.component.ts`
- `src/app/features/result.component.spec.ts`
- optionally new `src/app/core/engine/capacity.generator.ts` + spec

Red test introduced first:
- Test proving capacity changes do not regenerate permanent prompt fails initially.

Implementation work:
- Add `generateCapacityModifier(...)` with exact strings.
- Add separate capacity copy control and status announcement.

Verification commands:
- `npm test -- --include src/app/features/result.component.spec.ts`
- `npm run build`

Acceptance gate:
- Capacity modifier is independent and optional; permanent prompt remains unchanged when capacity changes.

Proposed commit message:
- `feat: add temporary capacity modifier with separate copy action`

Rollback boundary:
- Revert capacity commit with no effect on permanent prompt generation.

## Phase 9: Intro-Page Productivity Copy and Obsolete-Control Removal
Goal:
- Align intro content with locked MVP framing and remove obsolete six-control framing.

Files expected to change:
- `src/app/features/intro/intro.component.ts`
- `src/app/features/intro/intro.component.spec.ts`
- `src/app/app.html`

Red test introduced first:
- Intro spec fails because age-gate or legacy copy is still present.

Implementation work:
- Replace obsolete copy references and six-dimension labels.
- Keep resume/start behavior for active session.

Verification commands:
- `npm test -- --include src/app/features/intro/intro.component.spec.ts`
- `npm run build`

Acceptance gate:
- Intro reflects MVP flow and no obsolete control-language remains.

Proposed commit message:
- `feat: align intro experience with locked MVP flow`

Rollback boundary:
- Revert intro/shell copy commit independently.

## Phase 10: Analytics, Feedback-Form, Age-Gate, and Legacy-Code Removal
Goal:
- Remove all non-MVP data collection and retired legacy artifacts.

Files expected to change:
- `src/app/features/intro/intro.component.ts`
- `src/app/features/setup.component.ts`
- `src/app/features/result.component.ts`
- `src/app/shared/share/share-card.service.ts` and spec
- `src/app/core/scoring/scoring-engine.ts` and spec
- `src/app/core/engine/profile.ts` and spec
- retired placeholder files in `src/app/features` and `src/app/integration`
- `e2e` specs referencing age-gate and old flow

Red test introduced first:
- Search-based or spec assertion expecting zero analytics/form hooks fails before removals.

Implementation work:
- Remove `track(...)` wrappers and Plausible event calls.
- Remove `forms.gle` feedback link.
- Remove age-gate state and both checkboxes.
- Remove obsolete legacy modules and placeholder tests.

Verification commands:
- `npm test`
- `npm run build`
- targeted search command for `plausible|forms.gle|assessment_|setup_completed|document_copied|age-gate|13 or older`

Acceptance gate:
- No analytics hooks, external feedback collection, or age-gate logic remain.

Proposed commit message:
- `chore: remove legacy data-collection and retired modules`

Rollback boundary:
- Revert this cleanup commit if unexpected dependency break appears.

## Phase 11: Accessibility and Responsive Verification
Goal:
- Ensure MVP interaction patterns remain keyboard and screen-reader robust.

Files expected to change:
- `src/app/features/setup.component.ts` + spec
- `src/app/features/result.component.ts` + spec
- `e2e/*.spec.ts`
- `src/app/integration/real-content-flow.integration.spec.ts`

Red test introduced first:
- Keyboard-only e2e and ARIA assertions fail against pre-adjusted templates.

Implementation work:
- Implement semantic radio-group question UI.
- Add live-region announcements for copy status.
- Ensure focus order and 400% zoom resilience.

Verification commands:
- `npm test`
- `npm run e2e` (or `npm run e2e:dist` where required)
- `npm run build`

Acceptance gate:
- Keyboard-only path and result reload/start-over flows pass automated checks.

Proposed commit message:
- `test: harden MVP accessibility and e2e interaction coverage`

Rollback boundary:
- Revert accessibility commit without undoing deterministic generation core.

## Phase 12: Full Regression and Cleanup
Goal:
- Finalize migration, eliminate stale references, and validate all gates.

Files expected to change:
- residual comments, obsolete docs links, config naming drift

Red test introduced first:
- Final regression suite catches stale references.

Implementation work:
- Run full tests/build and migration checklists.
- Remove or archive leftover obsolete assets/copy after verification.

Verification commands:
- `npm test`
- `npm run build`
- `npm run e2e:dist` (if part of release gate)

Acceptance gate:
- All tests pass, deterministic architecture enforced, and no forbidden legacy behaviors remain.

Proposed commit message:
- `chore: finalize MVP migration cleanup and regression`

Rollback boundary:
- Revert only final cleanup commit if regression appears.

## Summary
- Planned phases: 12
- Commit strategy: one phase per commit, no squash-all migration commit.