# Vibe Kit Compression Options Research

## Summary Verdict
- Recommended now: Candidate 4 (Tighten session-start operator experience), then Candidate 3 (Replace repeated rule text with references).
- Defer: Candidate 1 (Collapse overlapping gates), Candidate 2 (Move detail out of protocol), Candidate 6 (Shrink wording without weakening rules).
- Reject: Candidate 5 (Cap active top-level concepts) as an immediate implementation; keep as a long-horizon design constraint only.
- Biggest expected gain: Candidate 2 with an estimated protocol reduction of 180 lines and ~1,200 words by relocating non-normative detail/examples to standards/templates while preserving canonical rules in protocol-v7.
- Biggest risk: Drift risk from fragmented authority if rule text is moved instead of summarized and linked (protocol-v7 explicitly defines canonical authority and strict STOP behavior).

## Candidate 1 — Collapse overlapping gates
- Current duplication found:
  - Prompt Review Gate and confidence/command-lock framing appears in multiple protocol locations and companion docs.
  - Repetition signal counts across required docs: "Prompt Review Gate" appears 18 times, "RESEARCH-ONLY" appears 33 times, "CLEAN FIELD READY" appears 15 times.
  - Evidence: protocol/protocol-v7.md:L13, L19, L21, L29, L31, L597, L648, L1698, L1704-L1706; protocol/working-agreement-v1.md:L24, L126, L131; session-start-checklist.md:L11, L23-L24.
- Exact files/sections involved:
  - protocol/protocol-v7.md (Core Rules, No Guessing/Tiered Confidence Gate, RESEARCH-ONLY Command Lock, Required Reading flow).
  - protocol/working-agreement-v1.md (Communication Protocol, Confidence Gate).
  - session-start-checklist.md (pre-flight gate reminders and prior parked-work trigger).
- Expected gain:
  - If gate restatements in secondary locations are replaced with canonical links only, estimated reduction is 21 lines and ~160 words across required docs.
  - Secondary gain: less contradiction risk between gate copies.
- Risk:
  - Over-collapsing can hurt standalone readability for operators who only open the checklist or working agreement.
- Safest implementation:
  - Keep full normative text only in protocol-v7 Core Rules; in other files keep one-line behavior summary plus direct anchor links.
  - Preserve one explicit confidence threshold mention in working-agreement for prompt-only usability.
- Recommendation:
  - Defer until after Candidate 4. Treat as a follow-up dedupe pass once session-start UX is simplified.

## Candidate 2 — Move detail out of protocol into standards/templates
- Current duplication found:
  - protocol-v7 contains long procedural examples and templates that overlap with standards/template intent.
  - research-standard already says not to duplicate full rule text and points back to protocol-v7 canonical sections.
  - Evidence: protocol/protocol-v7.md:L766-L827 (Evidence Pack template block), L830-L857 (Research Saved + Indexed details), L1129-L1263 (session-close contract detail); standards/research-standard.md:L96-L104, L136-L143; docs/status/REPORT-KIT-PROTOCOL-V7-SIZE-REDUCTION-PLAN-001.md:L25-L29, L102.
- Exact files/sections involved:
  - protocol/protocol-v7.md sections around Evidence Pack, Research Saved + Indexed, and End-of-Session Full Contract.
  - standards/research-standard.md and existing templates.
- Expected gain:
  - Estimated 180 lines and ~1,200 words removed from protocol-v7 by moving non-normative examples/checklists to standards/templates and replacing with links.
  - Additional long-term maintainability gain from one maintenance locus per artifact type.
- Risk:
  - High drift/authority risk if normative rule text moves out of protocol-v7 instead of examples only.
- Safest implementation:
  - Move examples, sample command blocks, and reusable tables only.
  - Keep MUST/STOP language in protocol-v7; standards/templates remain implementation aids.
- Recommendation:
  - Defer. High upside, but should be executed in staged slices with link-validation checks each slice.

## Candidate 3 — Replace repeated rule text with references
- Current duplication found:
  - Confidence and RESEARCH-ONLY behavior appears in protocol-v7, working-agreement, and research-standard.
  - research-standard already uses canonical-reference language, but still repeats threshold text and lifecycle details.
  - Evidence: protocol/protocol-v7.md:L597-L633, L648-L716; protocol/working-agreement-v1.md:L24, L126, L131; standards/research-standard.md:L43-L50, L136-L143.
- Exact files/sections involved:
  - protocol/working-agreement-v1.md Confidence/Communication lines.
  - standards/research-standard.md Confidence Thresholds and Indexing canonical-reference lines.
- Expected gain:
  - Estimated reduction: 38 lines and ~280 words across non-authoritative docs by replacing restated thresholds/rules with one-line summaries + anchor links.
- Risk:
  - Too much indirection can force frequent context switching for new operators.
- Safest implementation:
  - Use "rule sentence + canonical link" pattern; do not use "link only" paragraphs.
  - Keep one short inline threshold reminder where operationally critical.
- Recommendation:
  - Recommended now (after Candidate 4) because it is low-risk and localized.

## Candidate 4 — Tighten session-start operator experience
- Current duplication found:
  - session-start-checklist is dense (29 checkboxes in 90 lines) while session-start.ps1 already computes and prints the same gate verdicts plus required actions.
  - Evidence: session-start-checklist.md:L11-L25, L46-L53; tools/session-start.ps1:L303, L511, L607, L711, L798-L821.
- Exact files/sections involved:
  - session-start-checklist.md pre-flight and "If Any Check Fails" blocks.
  - tools/session-start.ps1 session audit block and required-action output.
- Expected gain:
  - Tightening checklist to "run audit + review required actions + only manual exceptions" can reduce checklist surface by ~15 checklist items and ~28 lines.
  - Cognitive gain: one command plus one interpretation loop, instead of parallel gate-by-gate reading.
- Risk:
  - If condensed too aggressively, rare but important edge-case actions become less visible.
- Safest implementation:
  - Preserve explicit links to each gate section, but collapse repeated prose into one compact operator decision flow.
  - Keep end-of-session section unchanged in first pass.
- Recommendation:
  - Recommended now as the safest high-impact compression candidate.

## Candidate 5 — Cap active top-level concepts
- Current duplication found:
  - Protocol concept surface is high: 53 H2 sections and 118 H3 sections; average H2 section span is 38.83 lines (max 117).
  - Evidence: protocol/protocol-v7.md heading metrics from current scan; historical index inventory also reports high heading count context (docs/status/REPORT-KIT-PROTOCOL-V7-INDEX-RESEARCH-001.md:L21, L125).
- Exact files/sections involved:
  - protocol/protocol-v7.md overall structure.
- Expected gain:
  - If capped to 40 active H2 concepts, potential long-term compression is 13 sections x 38.83 average lines = 504.79 lines equivalent content pressure removed or archived.
- Risk:
  - High semantic-loss risk: hard caps can force premature deletion or oversimplification of still-needed safeguards.
- Safest implementation:
  - Do not enforce as a hard edit rule yet.
  - First classify sections into: canonical invariant, operational guide, historical/rationale; archive only low-frequency rationale blocks.
- Recommendation:
  - Reject as an immediate implementation candidate; keep as a governance KPI for future pruning.

## Candidate 6 — Shrink wording without weakening rules
- Current duplication found:
  - Required-doc baseline size is large: protocol-v7 (2,068 lines, 15,155 words), session-start-checklist (90 lines, 1,363 words), working-agreement (139 lines, 1,144 words), research-standard (196 lines, 792 words).
  - Evidence: current metrics scan; protocol duplication and explanatory redundancy visible around gate sections and repeated confidence explanations (protocol/protocol-v7.md:L19, L585-L593, L601-L633).
- Exact files/sections involved:
  - protocol/protocol-v7.md primary target; checklist/working-agreement/standard as secondary.
- Expected gain:
  - A conservative 10% wording compression on protocol-v7 alone equals ~1,516 words.
  - If applied to the four required markdown docs together (18,454 words baseline), 10% yields ~1,845 words.
- Risk:
  - Quiet weakening risk: modal verbs (MUST/SHOULD), exception clauses, and STOP conditions can be accidentally softened.
- Safest implementation:
  - Restrict first pass to non-normative explanatory sentences only.
  - Freeze normative bullets and threshold numbers; require side-by-side semantic diff review.
- Recommendation:
  - Defer until after Candidate 4 and Candidate 3.

## Cross-Cutting Risks
- Drift risk:
  - Fragmenting rules across too many files can create authority ambiguity; protocol-v7 explicitly positions itself as canonical for gate behavior and thresholds (protocol/protocol-v7.md:L13-L39, L597-L609).
- Enforcement risk:
  - If compression edits miss script-coupled assumptions, docs can diverge from tooling behavior (tools/session-start.ps1:L798-L821; tools/end-session.ps1:L596, L646-L649).
- Onboarding risk:
  - Over-linking without minimal local summary increases click-depth and context switching for new contributors.
- Stephen cognitive-load risk:
  - Current checklist density (29 checkboxes in 90 lines) and repeated gate prose increase startup friction; simplification helps only if high-signal steps remain explicit (session-start-checklist.md:L11-L25).

## Recommended Next Step
Implement one tiny change only: Candidate 4 first-pass compression of session-start-checklist pre-flight text by replacing per-gate prose duplication with one audit-driven decision flow that references existing gate anchors.

No protocol or script behavior changes in this step.
