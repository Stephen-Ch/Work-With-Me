# Work With Me MVP Decisions

## Status
All decisions in this file are locked for first MVP implementation planning.

## Decision Record

| Area | Locked decision |
|---|---|
| Product identity | Working name is Work With Me, treated as provisional for internal use. |
| Core questionnaire | Exactly five required permanent questions, each with exactly three answer choices. |
| Profiling model | No scores and no named profiles. |
| Free-text input | No optional free-text input in first MVP. |
| Output style | Generated output is platform-neutral. |
| Output interaction | Users preview and copy output; users cannot edit generated output in-product in first MVP. |
| Architecture | No backend services. |
| User management | No accounts. |
| Analytics | No analytics. |
| Persistence | No persistent storage of completed answers. |
| Temporary state | In-session temporary state is allowed to preserve active questionnaire progress. |
| Capacity placement | Optional capacity selector is on the results screen, separate from permanent preferences. |
| Capacity question | How much bandwidth do you have right now? |
| Capacity choices | Usual bandwidth, Limited bandwidth, Very limited bandwidth. |
| Capacity behavior | Usual bandwidth gives no modifier. Limited bandwidth gives compact modifier. Very limited bandwidth gives essentials-only modifier. |
| Capacity precedence | Capacity instructions are temporary defaults. Explicit user requests always override them. |
| Public framing | Lead with AI-enabled productivity. Cognitive accessibility may be explained in supporting material. |
| Business value wording | Helps people get AI responses that are easier to understand, act on, and apply. |
| Claims policy | Do not claim measured productivity improvement. |
| Generation method | Prompt generation is deterministic from fixed authored modules and fixed assembly rules. |
| Generator constraints | No AI model call, no dynamic paraphrasing, no trait inference, no instruction invention. |

## MVP Readiness Note
No unresolved implementation decisions remain for first MVP scope in this document set.
