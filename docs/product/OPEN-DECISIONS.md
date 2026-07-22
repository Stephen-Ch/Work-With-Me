# Work With Me Open Decisions

These items are intentionally unresolved. They should be reviewed before product implementation or public launch.

| Issue | Decision | Available options | Recommendation | Reasoning | Evidence that would change the recommendation |
|---|---|---|---|---|---|
| Final product name | Open | Work With Me; Work With Me AI; another internal-facing name | Keep Work With Me for now | It is short, neutral, and matches the current repository identity. | Stakeholder feedback that the name is confusing, too generic, or already used elsewhere. |
| Label for the current-capacity option | Open | regular capacity; steady capacity; normal capacity; another neutral label | Steady capacity | It reads as plain language and avoids implying evaluation. | User testing showing that another label is clearer or feels more natural. |
| Placement of the current-capacity selector | Open | During setup; after the five questions; on the result screen | After the five required questions, before generation | It keeps the selector visible as session context rather than as a permanent preference. | Evidence that completion drops when the selector appears late or that users miss it. |
| Whether the optional free-text answer belongs in the permanent prompt | Open | Include it in the permanent prompt; keep it separate; disable it in MVP | Keep it separate from the core five-question prompt | It preserves the five-question core and reduces prompt bloat. | Evidence that users expect the note to behave like a standing preference and want it merged. |
| Whether users should preview and edit generated instructions | Open | Preview only; preview and edit; copy-only output | Preview and edit later, not in the first MVP | Transparency helps users trust the output, but editing adds product complexity. | Evidence that users need immediate editing to correct wording before copying. |
| Output style | Open | Platform-neutral; platform-specific; both | Platform-neutral | A neutral prompt is easier to reuse across common AI assistants. | Evidence that a target platform requires a different format or that users want one-click templates. |
| Whether responses are saved locally | Open | No saving; session-only saving; local storage saving | No saving in the first MVP | It keeps the product simple and privacy-forward. | Evidence that repeat usage suffers without local persistence. |
| Public mention of cognitive accessibility | Open | Mention publicly; mention only in support material; do not mention | Mention only in supporting material for now | It keeps the public framing focused on productivity while still preserving the design principle internally. | Evidence that the public message should explicitly include accessibility to improve clarity or adoption. |
| How to describe business value without promising measured gains | Open | Say it improves productivity; say it helps people get clearer AI responses; make no value claim | Say it helps people get AI responses that are easier to understand, act on, and apply | It is concrete, useful, and does not overclaim evidence. | Evidence from user testing or research that supports a stronger productivity claim. |

## Notes
- None of these decisions should be treated as final implementation rules until Stephen confirms them.
- The current docs use the proposed MVP shape as a working assumption, not as a product launch commitment.
