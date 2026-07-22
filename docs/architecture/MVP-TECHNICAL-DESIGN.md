# Work With Me MVP Technical Design

## Scope and Constraints
This document defines the target technical design for migrating from the inherited six-control scored implementation to the locked first MVP.

Locked product constraints (from product docs) are treated as hard requirements:
- Exactly five required permanent questions.
- Exactly one A/B/C selection per question.
- No scoring, no averaging, no named profile.
- Deterministic prompt generation from exact authored strings.
- Optional capacity modifier selected on the result screen.
- No backend, no accounts, no analytics.
- No persistent completed-answer storage.

Out of scope for this document:
- Production implementation changes.
- UI redesign beyond architecture-level accessibility patterns.

## Current Architecture Summary
Current implementation (baseline) is a six-control model with one question per control and a scoring stage:
- Domain model centers on `Setting`, `ControlId`, `V2Control`, `SetupResult`.
- Setup flow loads `working-with-me.json`, flattens `controls[].questions[]`, and records answers in session storage.
- Result flow computes per-control settings via `scoreSetup(...)` (average mapping) and assembles output via `generateDocument(...)`.
- Session key is `wwm-session-v2` with version marker `v: 2`.
- Guard requires complete six-question state before entering `/result`.
- UI still includes age-gate controls and analytics event hooks.
- Result screen currently includes an external feedback form link.

## Target Architecture (MVP)
### High-level flow
1. Load fixed authored MVP content (questions, options, modules, opening/closing, capacity strings).
2. Collect exactly one option selection for each of the five required questions.
3. Validate full permanent profile completeness.
4. Generate permanent prompt by exact ordered concatenation:
   1. Shared opening
   2. Selected Q1 module
   3. Selected Q2 module
   4. Selected Q3 module
   5. Selected Q4 module
   6. Selected Q5 module
   7. Shared closing
5. Apply exact duplicate defensive guard only.
6. Allow optional capacity selection on results screen and generate capacity modifier separately.

### Architectural modules
- `MvpContentRepository` (pure data access + structural validation of content payload).
- `MvpPromptGenerator` (deterministic permanent prompt generation only).
- `CapacityModifierGenerator` (deterministic temporary modifier generation only).
- `MvpSessionStore` (versioned session state in browser session storage only).
- `MvpResultGuard` (requires complete five-answer permanent profile).

## Recommended Domain Types
Use stable semantic identifiers for all permanent and temporary state.

```ts
export type PermanentQuestionId =
  | 'starting-work'
  | 'information-load'
  | 'decision-support'
  | 'side-topics'
  | 'interruption-recovery';

export type OptionCode = 'A' | 'B' | 'C';

export type CapacityId = 'usual' | 'limited' | 'very-limited';

export type PermanentOptionId =
  | 'starting-work:A' | 'starting-work:B' | 'starting-work:C'
  | 'information-load:A' | 'information-load:B' | 'information-load:C'
  | 'decision-support:A' | 'decision-support:B' | 'decision-support:C'
  | 'side-topics:A' | 'side-topics:B' | 'side-topics:C'
  | 'interruption-recovery:A' | 'interruption-recovery:B' | 'interruption-recovery:C';

export interface PermanentSelections {
  'starting-work': OptionCode;
  'information-load': OptionCode;
  'decision-support': OptionCode;
  'side-topics': OptionCode;
  'interruption-recovery': OptionCode;
}

export interface MvpSessionV1 {
  schemaVersion: 1;
  flow: 'questionnaire';
  startedAtIso: string;
  updatedAtIso: string;
  permanentSelections: Partial<PermanentSelections>;
  capacity: CapacityId | null;
}
```

Serialized values are exact and stable:
- Question IDs: `starting-work`, `information-load`, `decision-support`, `side-topics`, `interruption-recovery`.
- Option identity: `questionId:OptionCode`, e.g. `decision-support:B`.
- Capacity IDs: `usual`, `limited`, `very-limited`.

## Proposed Content Schema
## Content-source options evaluated
1. Typed TypeScript constants
- Pros: maximum compile-time safety, no runtime load failure.
- Cons: less friendly for copy review and editorial iteration; larger code diffs for copy changes.

2. Runtime JSON with validation
- Pros: content maintainability and copy-edit workflow are strong.
- Cons: runtime load/parse failure risk; weaker compile-time guarantees.

3. Hybrid (recommended)
- Pros: combines maintainability and deterministic runtime safety.
- Pros: can support build-time schema validation and generated typed facade.
- Pros: keeps exhaustive 243/729 enumeration tests deterministic and stable.
- Cons: slightly more tooling than pure TS constants.

## Recommendation
Use a hybrid approach:
- Author the MVP prompt catalog as JSON (content-owned artifact).
- Validate at build/test time with strict schema + invariant checks.
- Load through a typed adapter that returns a fully validated, immutable runtime model.
- Fail closed on invalid content: no fallback scoring logic, no inferred defaults.

## Prompt and Capacity Contracts
```ts
export interface PermanentPromptResult {
  prompt: string;
  segments: readonly string[]; // opening + q1..q5 + closing after exact-duplicate guard
  wordCount: number;
  targetRangeStatus: 'below-target' | 'within-target' | 'above-target'; // report only
}

export interface ProfileValidationResult {
  valid: boolean;
  missingQuestionIds: PermanentQuestionId[];
  unknownQuestionIds: string[];
  unknownOptionCodes: string[];
}

export function validateProfile(
  selections: Partial<Record<PermanentQuestionId, string>>
): ProfileValidationResult;

export function generatePermanentPrompt(input: {
  selections: PermanentSelections;
  sharedOpening: string;
  sharedClosing: string;
  moduleLookup: Readonly<Record<PermanentOptionId, string>>;
}): PermanentPromptResult;

export function generateCapacityModifier(input: {
  capacity: CapacityId;
  exactLimitedModifier: string;
  exactVeryLimitedModifier: string;
}): string | null;

export function countWords(text: string): number;
```

Generator invariants:
- No scoring and no averaging.
- No AI model call.
- No paraphrase/rewriting/semantic merge.
- Concatenate exact authored strings only.
- Exact duplicate defense only after normalized full-string comparison.
- Keep first duplicate occurrence only.

## Session State Lifecycle
## Storage key and schema
- Storage medium: `sessionStorage` only.
- Proposed key: `wwm-mvp-session-v1`.
- Schema version: `schemaVersion: 1`.

## Lifecycle behavior
- On app start:
  - If key is missing: start empty questionnaire session.
  - If payload schema/version is invalid: remove key and start empty session.
  - If payload includes legacy six-control shapes: remove key and start empty session.
- During questionnaire:
  - Persist each answer update to `sessionStorage`.
  - Persist optional capacity separately in same session object (`capacity` field) or parallel key if preferred.
- On `/result` reload in same browser session:
  - Rehydrate complete five-answer state and render same permanent prompt.
  - Rehydrate capacity selection if present.
- On start over:
  - Delete `wwm-mvp-session-v1` (or set empty state and persist).
  - Navigate to intro.
- Natural expiration:
  - Data disappears when the browser session ends (tab/window session lifecycle per browser behavior).

No migration path from `wwm-session-v2` is required or allowed for answer transformation.

## Route and Guard Behavior
## `/result` guard
- Allow navigation only when all five required permanent answers are present and valid.
- Reject partial profile, unknown IDs, unknown option codes, malformed session payload.
- Redirect target for invalid state: `/setup`.

## Missing content behavior
- If content cannot load or fails validation:
  - show deterministic error state with retry action.
  - do not generate fallback prompt.

## Reload behavior
- `/setup` reload preserves in-progress answers for active session.
- `/result` reload works only when full valid profile exists.
- malformed session on reload clears state and returns user to `/setup`.

## Start-over behavior
- Clear session payload and capacity state.
- Return to intro and require fresh five-question path.

## Error Handling Strategy
- Fail closed on malformed content/session.
- Typed validation errors include structured code + message for UI-safe rendering.
- Do not auto-fill missing answers with default `B`.
- Do not silently continue after validation failure.

## Accessibility Design
## Answer interaction pattern recommendation
Use semantic radio groups for each question.

Reasoning:
- The product model is single-selection per question.
- Native radio semantics provide expected screen-reader and keyboard behavior.
- Arrow key navigation and selected-state announcement are standardized.

Design requirements:
- `fieldset` + `legend` per question.
- One radio input per A/B/C option with visible label text.
- Programmatic error association for unanswered required question.
- Visible focus indicator compliant with contrast requirements.
- Progress text announced using polite live region.
- Copy-action success/failure status announced via live region.
- Respect `prefers-reduced-motion` and maintain usability at 400% zoom.

## Clipboard Behavior
- Separate buttons:
  - Copy permanent prompt.
  - Copy capacity modifier (only when capacity is `limited` or `very-limited`).
- Copy outcomes:
  - Success message announced and visible.
  - Failure message provides manual-select fallback guidance.
- Capacity copy must never alter permanent prompt state.

## Dependency Policy
- No new runtime dependency is required for deterministic prompt generation.
- Keep runtime dependencies minimal: Angular + existing platform APIs.
- Optional development-time schema tooling allowed only if it does not add production runtime cost.
- Remove unused share/export dependencies as part of migration phase if no longer used.

## Browser Support Assumptions
- Evergreen Chromium/Firefox/Safari-class browsers.
- Required APIs: `sessionStorage`, `navigator.clipboard` (with graceful fallback messaging), ES2022 features supported by Angular build target.
- No IE or legacy browser support.

## Architecture Decisions and Reasoning
1. Remove scoring engine rather than adapting it.
- Reason: scoring/averaging contradicts locked MVP model and risks hidden behavior.

2. Keep permanent profile and capacity as separate state machines.
- Reason: capacity is temporary and not part of 243-profile identity.

3. Use stable semantic IDs independent of display order or copy text.
- Reason: deterministic tests and future copy edits must not break identity logic.

4. Use exact-string generation with single exact-duplicate defensive guard.
- Reason: complies with locked prompt-catalog behavior and avoids semantic drift.

5. Enforce strict result guard requiring complete five-answer profile.
- Reason: prevents partial-profile output and hidden fallback behavior.

6. Remove analytics and external feedback collection from MVP flow.
- Reason: aligns with product decision of no analytics/no external data collection in MVP.

7. Remove age-gate controls from intro flow.
- Reason: not part of locked MVP and currently introduces unrelated gating behavior.

## Required Risk Analysis
| Risk | Likelihood | Impact | Mitigation | Verification method |
|---|---|---|---|---|
| Old six-control assumptions hidden in tests or copy | High | High | Keep file-level migration map and replace/remove legacy tests by phase, not all at once | Search for legacy IDs/types (`ControlId`, six old question IDs), then run full tests |
| Silent fallback to default B answers | Medium | High | Disallow fallback defaults in validators and guard; fail closed on partial profile | Unit tests asserting missing selections fail validation and block `/result` |
| Accidental partial-profile generation | Medium | High | Strict profile validation before generation and strict result guard | Guard tests + generator precondition tests |
| Content text drifting between docs and code | Medium | High | Single structured content source with schema checks and exact-string assertions | Contract tests comparing generated strings to authored source |
| Word-count implementation differences | Medium | Medium | One canonical `countWords(...)` function used by all generator tests | Dedicated word-count unit tests with edge-case fixtures |
| Stale session schema | High | High | Versioned session key and schema; purge invalid/legacy payloads | Session-store tests for malformed and legacy payload invalidation |
| Duplicate copy controls confusing users | Medium | Medium | Distinct labels for permanent prompt copy vs capacity modifier copy + status messaging | Result component tests for separate controls and copy targets |
| Capacity modifier mistaken as part of permanent prompt | Medium | High | Separate render sections and separate copy actions; immutable permanent prompt after capacity change | Result tests asserting permanent output unchanged when capacity changes |
| Analytics or feedback collection surviving unintentionally | Medium | High | Explicit removal phase + search gate for `plausible`, `track(`, `forms.gle`, event names | Pre-merge keyword scan over source/e2e/config + test updates |
| Application tests passing while obsolete product behavior remains | Medium | High | Replace placeholder/retired tests with behavior-enforcing MVP tests | Coverage checklist from automation design + e2e scenario matrix |
| Large all-at-once migration obscuring regressions | High | High | 12-phase incremental TDD plan with rollback boundaries per commit | Per-phase red/green gates and `npm test` + `npm run build` at each phase |
