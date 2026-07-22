# MVP Release Candidate Status

Date: 2026-07-22
Branch: feature/mvp-release-cleanup

## Product behavior locked for release

- Five answers create reusable permanent instructions.
- Optional bandwidth adds a temporary final paragraph for the current AI conversation only.
- The app shows one combined preview block and one Copy instructions action.
- No temporary paragraph is added for no selection or Usual bandwidth.
- Changing bandwidth never alters saved permanent preferences.

## One-copy workflow verification

- Composition point: composeInstructionsForCopy(permanentPrompt, capacityModifier)
- Separator contract: permanent + "\n\n" + modifier
- No-selection result: permanent-only
- Usual result: permanent-only
- Limited result: permanent + exact Limited modifier
- Very-limited result: permanent + exact Very limited modifier
- Preview equals clipboard target for the single copy action
- Modifier replacement verified (no duplication when switching Limited -> Very limited)
- Reload preserves capacity and reproduces identical composed preview
- Start Over clears permanent and capacity session state

## Hostile audit (updated rule set)

Verified:

- generatePermanentPrompt(...) remains capacity-independent.
- Permanent prompt segments and word count remain capacity-independent.
- Capacity remains separate in session state and content definitions.
- composeInstructionsForCopy(...) is the only intentional composition point.
- Limited/Very limited modifiers are appended only after exactly one blank line.
- Displayed preview and copied text are identical.
- Exactly one copy action is present.
- No-selection and Usual both produce permanent-only output.
- Capacity is not part of permanent-profile identity.

Search audit for obsolete concepts:

- Removed two-copy behavior from production UI.
- Removed obsolete symbols and flows tied to separate permanent/temporary copy actions.
- Removed inherited six-control runtime and retired placeholder runtime specs.

## Accessibility and responsive checks

Automated:

- Keyboard-only completion through question 1-5 to result.
- Keyboard-driven capacity change paths validated.
- Single copy control remains present across capacity states.
- 320 CSS pixel viewport dist smoke test passes.

Manual:

- 400% zoom check completed in browser with readable content, visible controls, and no blocked primary actions.
- Reduced-motion support added via prefers-reduced-motion global fallback.

## Privacy and data-flow audit

- Runtime code contains no analytics or telemetry calls.
- Runtime code contains no external feedback form links.
- Session persistence is browser sessionStorage only.
- Legacy key wwm-session-v2 is purged during MVP session store hydration.

## Legacy cleanup summary

- Removed inherited six-control runtime modules and dead placeholder routes/specs not used by MVP flow.
- Removed obsolete legacy content export script and package script entry.
- Renamed dist e2e smoke spec away from Rawls terminology.

## Required release evidence checklist

- One preview: pass
- One Copy instructions button: pass
- No-selection permanent-only output: pass
- Usual permanent-only output: pass
- Limited combined output: pass
- Very-limited combined output: pass
- Exact blank-line separation: pass
- Reload persistence: pass
- Permanent-generator independence: pass
- 243 permanent profiles: pass
- 729 profile/capacity combinations: pass
- Keyboard-only completion: pass
- Narrow-viewport usability: pass
- 400% zoom usability: pass
- Strict result guarding: pass
- Start Over clearing all MVP session state: pass
- No analytics or external data collection: pass
- No inherited six-control executable runtime: pass
