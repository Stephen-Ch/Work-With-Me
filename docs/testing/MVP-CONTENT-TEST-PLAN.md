# Work With Me MVP Content Test Plan

## Purpose
Define pre-implementation validation for Work With Me content and deterministic prompt generation. This plan is documentation-only and does not require application-code changes.

## Regression Requirement
If a user prompt is already clear and well specified, the response should not be unnecessarily interrupted, shortened, or reframed.

## Layer 1: Deterministic Generator Tests
Layer 1 validates generator output text only. These tests do not call an AI model.

### Deterministic Assertions
- Exact module selection from five answers.
- Exact sentence assembly order.
- Exact module ordering per catalog.
- Deterministic deduplication behavior.
- Shared explicit-override sentence present in every permanent prompt.
- No forbidden condition-related terms in generated output.
- No duplicate instruction lines after assembly.
- Permanent prompt within word-count limits.
- No capacity modifier for Usual bandwidth.
- Correct Limited bandwidth modifier text.
- Correct Very limited bandwidth modifier text.

### Exhaustive Coverage Requirements
- All permanent profiles: $3^5 = 243$ combinations must be generated and checked.
- All permanent-profile and capacity combinations: $3^6 = 729$ combinations must be generated and checked.
- Coverage is complete only when every combination passes deterministic assertions.

### Layer 1 Test Matrix

| Test ID | Scope | Input | Expected deterministic output rule | Prohibited output | Pass / Fail rule |
|---|---|---|---|---|---|
| G01 | Module selection | Any single profile | Exactly 5 permanent modules selected, one per question area | Missing or extra permanent module | PASS if exactly 5 modules map from answers. |
| G02 | Assembly order | Any single profile | Output order: opening, Q1, Q2, Q3, Q4, Q5, closing | Any sentence-order drift | PASS if line order is exact. |
| G03 | Deduplication | Overlap-heavy profile | Overlapping instructions collapsed by catalog rules | Repeated duplicate intent sentence | PASS if only one final sentence per duplicate intent remains. |
| G04 | Override line presence | Any profile | Closing override sentence always present | Missing override sentence | PASS if closing text matches catalog exactly. |
| G05 | No forbidden condition terms | Any profile | Output contains no condition-related terms | Condition-related terms appear | PASS if regex scan returns zero matches. |
| G06 | Permanent length limit | Any profile | Permanent prompt 90-140 words, hard max 180 | Over 180 words | PASS if within configured range and under hard max. |
| G07 | Capacity usual | Any profile + Usual bandwidth | No capacity modifier returned | Any non-empty modifier string | PASS if modifier output is empty. |
| G08 | Capacity limited | Any profile + Limited bandwidth | Exact limited modifier string returned | Paraphrased or altered modifier | PASS if exact string match. |
| G09 | Capacity very limited | Any profile + Very limited bandwidth | Exact very-limited modifier string returned | Paraphrased or altered modifier | PASS if exact string match. |
| G10 | Exhaustive permanent coverage | 243 permanent profiles | All 243 generated and validated | Missing profile combinations | PASS if profile count equals 243 and all pass G01-G07. |
| G11 | Exhaustive profile-capacity coverage | 729 profile-capacity combinations | All 729 generated and validated | Missing profile-capacity combinations | PASS if combination count equals 729 and all pass G01-G09. |

## Layer 2: Behavioral Effectiveness Tests
Layer 2 is manual validation against an AI assistant. These tests are not deterministic.

### Required Scenarios

| Test ID | Complete generated profile | Capacity modifier | User prompt | Expected behavior | Prohibited behavior | Observable pass / fail rule |
|---|---|---|---|---|---|---|
| B01 | Q1-A, Q2-A, Q3-A, Q4-A, Q5-A | None | Draft a clear 120-word project update for my manager. | Direct, concise draft with one clear structure. | Wandering preamble or unnecessary clarification question. | PASS if draft is concise, complete, and directly usable. |
| B02 | Q1-C, Q2-C, Q3-B, Q4-B, Q5-C | None | Write a comprehensive proposal outline for migrating our reporting pipeline. | Provides fuller context, tradeoffs, and scannable structure. | Over-shortened response that omits key sections. | PASS if context and structure are both present and usable. |
| B03 | Q1-A, Q2-A, Q3-A, Q4-A, Q5-A | None | Write concise TypeScript to parse a CSV line with quoted fields. | Gives code quickly with minimal but sufficient explanation. | Long conceptual detour before code. | PASS if code appears first and works as a reasonable starting point. |
| B04 | Q1-B, Q2-B, Q3-C, Q4-B, Q5-B | None | Help me plan next quarter priorities for our team. | Asks one question only if missing information could change recommendation, then continues. | Multiple gatekeeping questions or refusal to proceed. | PASS if at most one clarifying question appears and progress continues. |
| B05 | Q1-B, Q2-B, Q3-C, Q4-B, Q5-B | None | Which vendor should we choose if we must launch in 30 days but have limited support staff? | Recognizes enough material information and gives usable recommendation flow. | Unnecessary clarifying question despite sufficient input. | PASS if response proceeds without needless interruption. |
| B06 | Q1-B, Q2-B, Q3-B, Q4-B, Q5-B | None | Compare these two rollout strategies: pilot-first versus region-first. | Concise comparison with tradeoffs and practical conclusion. | One-sided answer with no tradeoff framing. | PASS if both options and tradeoffs are explicit. |
| B07 | Q1-B, Q2-B, Q3-B, Q4-C, Q5-B | None | We started on launch planning, but now I want to explore partner enablement ideas. | Follows useful side topic while keeping continuity. | Forcing return to original task when user clearly branches. | PASS if side topic is followed without losing coherence. |
| B08 | Q1-B, Q2-B, Q3-B, Q4-A, Q5-B | None | Also, should we redesign the logo while we discuss deployment tasks? | Flags drift and keeps focus on current task. | Spending most of response on logo tangent. | PASS if drift is flagged and response stays deployment-focused. |
| B09 | Q1-A, Q2-A, Q3-A, Q4-A, Q5-A | None | Continue from where we left off on the launch checklist. | Continues from prior action with little recap. | Full restart recap with no next action. | PASS if response resumes quickly with next action. |
| B10 | Q1-C, Q2-C, Q3-B, Q4-B, Q5-C | None | I have been away for two weeks. Pick up our incident-response plan. | Reconstructs key decisions, open questions, and next step. | Minimal response that ignores lost context. | PASS if response includes reconstruction plus next step. |
| B11 | Q1-B, Q2-A, Q3-B, Q4-B, Q5-B | Limited bandwidth | Summarize what I should do next on this customer escalation. | Uses compact session modifier while staying actionable. | Long, multi-branch explanation by default. | PASS if answer is compact and still complete enough to act. |
| B12 | Q1-A, Q2-A, Q3-A, Q4-A, Q5-A | Very limited bandwidth | Tell me what to do right now for this urgent blocker. | Essentials-only output, one action at a time. | Multiple optional paths by default. | PASS if response gives minimal actionable output first. |
| B13 | Q1-A, Q2-A, Q3-A, Q4-A, Q5-A | Very limited bandwidth | Give me three detailed implementation options with pros and cons. | Explicit request overrides brevity defaults and returns requested depth. | Capacity modifier suppresses requested depth/options. | PASS if response honors detailed multi-option request. |
| B14 | Q1-B, Q2-B, Q3-B, Q4-B, Q5-B | None | What is the HTTP status code for Not Found? | Direct factual answer with no unnecessary personalization layer. | Added profile commentary that adds noise. | PASS if answer is direct and concise. |

## Word-Count Validation Targets
- Permanent prompt: target 90-140 words, hard maximum 180.
- Limited bandwidth modifier: 20-40 words.
- Very limited bandwidth modifier: 20-40 words.
- Usual bandwidth: no modifier.

## Test Execution Notes
- Layer 1 is deterministic and automated in future implementation.
- Layer 2 is manual and observational; it should not be described as deterministic.
