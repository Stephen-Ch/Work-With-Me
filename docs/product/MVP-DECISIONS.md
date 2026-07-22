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
| One-copy composition model | Permanent profile content and capacity content remain separate internally; result UI composes one copy block for user output. |
| Copy interaction | Result screen exposes one Copy instructions action for the composed preview. |
| Composition rules | No-selection and Usual append nothing. Limited and Very limited append after exactly one blank line. |
| Identity boundary | Capacity modifier is temporary and never changes permanent-profile identity or selections. |
| Public framing | Lead with AI-enabled productivity. Cognitive accessibility may be explained in supporting material. |
| Business value wording | Helps people get AI responses that are easier to understand, act on, and apply. |
| Claims policy | Do not claim measured productivity improvement. |
| Generation method | Prompt generation is deterministic from fixed authored modules and fixed assembly rules. |
| Assembly order | Permanent prompt order is fixed: Shared opening, selected Q1 module, selected Q2 module, selected Q3 module, selected Q4 module, selected Q5 module, Shared closing. |
| Selection cardinality | Exactly one module is selected from each question for every permanent prompt. |
| Generator constraints | No AI model call, no dynamic paraphrasing, no trait inference, no instruction invention. |
| Text-integrity constraints | No shortening, rewriting, semantic merging, dynamic alternate wording, or semantic redundancy inference across authored module strings. |
| Duplicate defense | After fixed-order assembly, remove only full-string duplicates that are exactly equal after whitespace normalization. Preserve first occurrence. |
| Duplicate-normalization scope | Duplicate comparison may trim outer whitespace and collapse consecutive whitespace to one space only. |
| Duplicate expectation | No current authored modules are expected to be exact duplicates; duplicate defense is integrity-only. |

## MVP Readiness Note
No unresolved implementation decisions remain for first MVP scope in this document set.
