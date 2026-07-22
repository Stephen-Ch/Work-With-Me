# MVP Effectiveness Gate V2

## Purpose
Establish a reproducible, provider-neutral behavioral-effectiveness gate for the current five-question Work With Me product.

This gate does not call external APIs and does not generate synthetic model outputs.

## Conditions
1. WITHOUT
- No Work With Me instructions.

2. CURRENT
- Exact instructions generated from current production content.

3. CANDIDATE-HARD-CAP
- Same permanent profile as CURRENT, but for test purposes only, replace Q2-A behavior with the experimental candidate wording below.

Experimental nonproduction candidate wording (derived from prior reported finding, awaiting confirmation):

For broad or open-ended requests that don't ask for full detail, answer in 5 bullet points or fewer, under 100 words total, then stop -- no numbered multi-section framework -- and expand only the part I'm asked about next.

## Profiles
Minimum profiles required:

- Profile A (Directive and brief)
  - Q1-A, Q2-A, Q3-A, Q4-A, Q5-B
- Profile B (Structured and comparative)
  - Q1-B, Q2-B, Q3-B, Q4-B, Q5-B
- Profile C (Context and clarification)
  - Q1-C, Q2-C, Q3-C, Q4-B, Q5-C

Capacity coverage:
- no modifier baseline
- Limited on at least two applicable prompts
- Very limited on at least two applicable prompts

Hard-cap comparison applies only where Q2-A is active.

## Test Cases
Eight required prompts are defined in:
- tools/effectiveness-gate/cases.json

The set covers:
1. Clear, fully specified writing request
2. Clear, fully specified coding request
3. Vague writing request missing audience or goal
4. Broad planning request
5. Style request with no example
6. Task requiring unavailable source material
7. Decision request with one materially important missing fact
8. Interrupted-project resumption scenario

## Protocol
- Use clean assistant conversations for every run.
- Keep user prompt identical across compared conditions.
- Paste exact condition instruction text with no edits.
- Do not edit assistant responses.
- Preserve raw outputs.
- Record assistant platform, model name, date, web/tools enabled state, and active system/custom instructions.
- Distinguish objective metrics from subjective scoring.

## Randomization and Blinding
Use tools/effectiveness-gate/analyze-results.mjs prepare mode to generate per-case randomized A/B/C condition labels with a deterministic seed.

- Reviewers score A/B/C outputs without seeing real condition names.
- Condition answer key is stored separately in the generated packet.

## Required Measurements
The analyzer supports:
- word count
- character count
- bullet count
- numbered-heading/section count
- question mark count
- begins with actionable step (heuristic)
- explicit recommendation present (heuristic)
- explicit assumption present (heuristic)
- asks more than one question
- multi-section framework detected
- cap violation checks when cap rules are provided
- manual reviewer scores and notes

Manual review fields required per response:
- easierToActOn (1-5)
- appropriateDetail (1-5)
- followedPreference (1-5)
- unnecessaryInterference (yes/no)
- visibleImprovementOverWithout (yes/no)
- notes

## Pass Bar (predefined)
### Clear prompts
- CURRENT and CANDIDATE must not materially worsen answer quality.
- No unnecessary clarifying interruption.
- No forced structure that conflicts with explicit request.

### Underspecified prompts
- At least one concrete improvement over WITHOUT.
- No generic multi-question interrogation lists.
- No invented certainty when a material fact is missing.

### Brevity prompts
For CANDIDATE-HARD-CAP:
- five bullets or fewer
- under 100 words
- no numbered multi-section framework
- no non-response when a useful short answer is possible

For CURRENT:
- behavior is recorded as observed; criterion is not rewritten post hoc.

### Overall
- Visible improvement on a majority of prompts where profile should matter.
- No significant degradation on clear prompts.
- Improvement claims must describe behavior, not vague tone preference.
- Failures and ambiguities must be reported.

## Scope Boundaries
- No production prompt content changes in this gate package.
- No backend, account, telemetry, analytics, or new persistence.
- No claims of statistical significance from this small-sample gate.
