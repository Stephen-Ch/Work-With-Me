# Work With Me Legacy Migration Map

## Purpose
This map defines file-by-file migration intent from inherited six-control scored behavior to the locked first MVP architecture.

Classification legend:
- retain unchanged
- retain with revision
- replace
- remove
- investigate during implementation

## File-by-File Map

| File | Classification | Current responsibility | Target responsibility | Required change | Risk | Tests affected | Planned phase |
|---|---|---|---|---|---|---|---|
| src/app/core/content/types.ts | replace | Six-control `V2*` content model and scoring-oriented types | Stable five-question semantic domain types | Replace with MVP domain model (`PermanentQuestionId`, `OptionCode`, `CapacityId`, `PermanentSelections`, prompt catalog types) | High: shared type breakage | content/service, setup, result, generator specs | 1 |
| src/assets/content/working-with-me.json | replace | Six controls with per-control outputs and legacy guardrails | Five-question direct-selection content with 15 permanent modules, shared opening/closing, capacity definitions | Replace schema and payload to match locked docs exactly | High: content/schema mismatch | content tests, setup/result tests, generator tests | 1 |
| src/app/core/content/content.service.ts | retain with revision | Runtime fetch of old JSON and state signal | Load MVP content and run strict validation adapter | Update service contract + fail-closed behavior | Medium | content.service.spec.ts, setup/result initialization tests | 1 |
| src/app/core/content/content.service.spec.ts | retain with revision | Verifies six controls and V2 shape | Verify MVP schema, five questions, exact module inventory metadata | Rewrite expectations and fixture assumptions | Medium | this file | 1 |
| src/app/core/engine/scoring.engine.ts | remove | Averages A/B/C responses into control setting (`scoreSetup`) | None | Remove file and references | High: hidden fallback risk if left in path | scoring and result specs | 2, 10 |
| src/app/core/engine/document.generator.ts | replace | Builds document from control settings | Deterministic exact-string permanent prompt generator | Replace with `generatePermanentPrompt` contract implementation | High: core behavior change | document generator specs + result specs | 2 |
| src/app/core/engine/document.generator.spec.ts | replace | Tests six-control inclusion and old word ranges | Deterministic exact-string assembly tests aligned to locked plan | Replace with fixed-order, exact-text, duplicate-guard tests | High | this file + exhaustive generator suite | 3 |
| src/app/core/session/session.store.ts | replace | Stores six answers under `wwm-session-v2`, version `v:2` | Stores versioned MVP session under sessionStorage only | Replace schema with `wwm-mvp-session-v1` and strict validation/clear invalid | High: stale-schema behavior | session store, guard, setup/result tests | 4 |
| src/app/core/session/session.store.spec.ts | replace | Tests six question IDs and old key/version | Tests five-question IDs, schema v1, stale purge behavior, result reload behavior | Rewrite for new schema and lifecycle requirements | High | this file | 4 |
| src/app/features/setup.component.ts | replace | Six-question flattened control flow and analytics event | Five-question direct selection flow with stable IDs | Replace question source and progress logic; remove analytics call; no default answer fallback | High | setup.component.spec.ts, e2e | 5 |
| src/app/features/setup.component.spec.ts | replace | Expects 6 questions and old IDs | Expects 5 required questions with stable semantic IDs | Rewrite tests for five-question cardinality and no fallback behavior | High | this file + e2e | 5 |
| src/app/features/result.guard.ts | retain with revision | Guards result route using old completion semantics and stale comments | Strict five-answer valid-profile guard | Update guard checks and malformed-session handling | High | result.guard.spec.ts, integration specs | 6 |
| src/app/features/result.guard.spec.ts | replace | Tests six-answer assumptions | Tests strict five-answer requirement and malformed session redirects | Rewrite test fixtures and assertions | Medium | this file | 6 |
| src/app/features/result.component.ts | replace | Runs scoring + document generation, includes feedback link and analytics events | Renders permanent prompt + separate capacity modifier/copy actions | Remove scoring calls, add separate capacity controls/copy status, remove analytics and feedback link | High | result.component.spec.ts, e2e | 7, 8, 10 |
| src/app/features/result.component.spec.ts | replace | Tests old copy behavior and six-control derived output | Tests permanent prompt copy, capacity copy, clipboard failure, separation invariants | Rewrite tests to new contracts | High | this file | 7, 8 |
| src/app/features/intro/intro.component.ts | replace | Includes age-gate, analytics event, six-dimension copy | MVP intro copy and entry actions without age gate/analytics | Remove both age checkboxes/state/gating logic and legacy dimension text | Medium | intro.component.spec.ts, e2e | 9, 10 |
| src/app/features/intro/intro.component.spec.ts | replace | Tests age gate enable/disable and resume behavior | Tests intro MVP copy, start/resume flow, no age gate | Rewrite to new UI semantics | Medium | this file + e2e intro checks | 9, 10 |
| src/app/app.routes.ts | retain with revision | Basic routes already aligned but depends on legacy guard behavior | Keep route skeleton; enforce strict result guard flow | Minimal updates tied to guard/session replacement | Low | route/guard tests, e2e navigation | 6 |
| src/app/app.html | retain with revision | App shell with legacy prototype header copy | Neutral MVP shell copy | Minor wording cleanup only | Low | app.spec.ts snapshot/sentinel | 9 |
| src/index.html | retain unchanged | Basic HTML shell with title/manifest/no analytics script | Keep shell minimal | No functional change required unless title/meta update needed | Low | smoke tests | 12 |
| src/app/app.ts | retain unchanged | Root standalone app host | Keep as root host | No behavior migration change needed | Low | app.spec.ts | 12 |
| src/app/app.spec.ts | retain with revision | Weak sentinel comments referencing router-outlet-only expectation | Keep smoke creation + update sentinel to actual shell | Align assertions with real app shell | Low | this file | 12 |
| src/app/shared/share/share-card.service.ts | remove | Legacy Rawls share-card export service, currently unused | None for MVP | Remove unused service and dependency references if unreferenced | Medium: test fallout only | share-card.service.spec.ts | 10 |
| src/app/shared/share/share-card.service.spec.ts | remove | Tests legacy share-card service | None | Remove with service | Low | this file | 10 |
| src/app/core/scoring/scoring-engine.ts | remove | Legacy Likert dimension scoring helper | None | Remove if no remaining references | Medium | scoring-engine.spec.ts | 10 |
| src/app/core/scoring/scoring-engine.spec.ts | remove | Tests legacy Likert scoring | None | Remove with engine | Low | this file | 10 |
| src/app/core/engine/profile.ts | remove | Legacy named-profile computation | None | Remove; named profiles are out of MVP | High: potential hidden dependency | profile.spec.ts | 10 |
| src/app/core/engine/profile.spec.ts | remove | Tests named-profile logic | None | Remove with profile engine | Low | this file | 10 |
| src/app/features/followups.guard.ts | remove | Retired V1 placeholder file | None | Delete dead file | Low | followups guard placeholder specs | 10 |
| src/app/features/followups.guard.spec.ts | remove | Placeholder retired test | None | Delete dead test | Low | this file | 10 |
| src/app/features/followups-guard.production-content-contract.spec.ts | remove | Placeholder retired contract | None | Delete dead test | Low | this file | 10 |
| src/app/features/question-v2.component.ts | remove | Retired V1 placeholder file | None | Delete dead file | Low | related placeholder references | 10 |
| src/app/features/lens.component.ts | remove | Retired V1 placeholder file | None | Delete dead file | Low | none | 10 |
| src/app/features/select.component.ts | remove | Retired V1 placeholder file | None | Delete dead file | Low | select.component.spec.ts | 10 |
| src/app/features/select.component.spec.ts | remove | Placeholder retired test | None | Delete dead test | Low | this file | 10 |
| src/app/features/result.persona.router.spec.ts | remove | Placeholder legacy persona route test | None | Delete dead test | Low | this file | 10 |
| src/app/integration/real-content-flow.integration.spec.ts | replace | Placeholder retired V1 integration test | MVP integration for setup-to-result deterministic flow | Replace with meaningful integration test | Medium | this file | 11 |
| src/app/integration/result-guard.production-content-contract.spec.ts | replace | Placeholder retired contract test | MVP result-guard contract tests | Replace with strict profile completeness contract | Medium | this file | 6, 11 |
| e2e/single-category.spec.ts | replace | Six-question + age-gate smoke | Five-question + strict result/capacity copy flow | Rewrite to MVP flow and accessibility path | High | this file | 11 |
| e2e/td-rawls-001-smoke-dist.spec.ts | replace | Dist smoke with Rawls naming + age-gate assumptions | Dist smoke for MVP flow without age-gate | Rewrite test id usage and flow assertions | Medium | this file | 11 |
| playwright.dist.config.ts | retain with revision | Legacy naming/comments from Rawls story | Keep dist smoke config with updated test-match names | Rename/retarget comments and match set | Low | e2e dist workflow | 11 |
| scripts/content-export-app.js | remove | Exports legacy Rawls pipeline into `rawls-values.generated.json` | None for MVP permanent prompt model | Remove or archive outside MVP runtime path | Medium: build script coupling | content export script tests | 10 |
| scripts/content-export-app.spec.mjs | remove | Validates legacy export behavior | None | Remove with export script | Low | this file | 10 |
| scripts/generate-mixed-profile-outputs.js | remove | Legacy profile output generation tool | None for MVP | Remove/archive to docs if needed | Low | none (utility only) | 10 |
| docs/project/MIXED-PROFILE-OUTPUTS.md and related manifest docs | investigate during implementation | Legacy profile-oriented documentation and examples | Archive or replace with MVP deterministic examples | Decide archival vs replacement based on doc strategy | Low | docs-only | 12 |
| src/assets/images/home.png and src/assets/images/output.png | investigate during implementation | Legacy hero/support images | Keep only images used by MVP pages | Audit references; remove orphan assets | Low | visual regression/e2e screenshot baselines | 12 |
| src/assets/personas/ (empty) | remove | Legacy personas directory placeholder | None | Remove empty directory from source tree | Low | none | 12 |

## Legacy Concepts and Explicit Disposition
- Six-control `ControlId` model: replace with five semantic question IDs.
- `scoreSetup` averaging pipeline: remove.
- Named profile computation (`profile.ts`): remove.
- Old question IDs (`load-q1` etc): replace with semantic IDs.
- Session key `wwm-session-v2`: replace with `wwm-mvp-session-v1`.
- External feedback form link (`forms.gle`): remove for MVP.
- Analytics hooks (`track(...)`, Plausible events): remove for MVP.
- Age-gate controls and state: remove.
- Rawls-labeled scripts/assets/copy: remove or archive per row above.

## Notes
- This map is design intent; implementation follows staged TDD plan.
- No production code changes are made by this document.