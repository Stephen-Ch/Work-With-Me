# Work With Me MVP Product Specification

## Product Identity
- Working product name: Work With Me.
- Name status: provisional for internal use.

## Problem Statement
AI can improve productivity only when responses are easy to understand, act on, and apply. Work With Me turns a short set of practical preferences into copy-ready assistant instructions so people spend less time rewriting prompts.

## Target Users
- Employees using AI for writing, planning, coding support, decision support, and interrupted-work recovery.
- Individual contributors who want predictable AI response style without setup overhead.
- Teams exploring AI-enabled productivity with a lightweight, privacy-first workflow.

## Business Value
Helps people get AI responses that are easier to understand, act on, and apply.

## Product Boundaries
- Exactly five required permanent questions.
- Exactly three answers per required question.
- No scores.
- No named profiles.
- No optional free-text input in the first MVP.
- Platform-neutral generated output.
- Users can preview and copy generated output.
- Users cannot edit generated output inside the first MVP.
- No backend.
- No accounts.
- No analytics.
- No persistent storage of completed answers.
- Temporary in-session state is allowed during an active questionnaire.

## Public Framing
- Primary framing: AI-enabled productivity.
- Cognitive accessibility may be described in supporting material.
- No claims of measured productivity improvement.

## Complete User Flow
1. User opens Work With Me and sees a brief productivity-focused explanation.
2. User answers five required permanent questions.
3. User sees a generated permanent Work With Me prompt.
4. User previews and copies the permanent prompt.
5. User optionally selects current capacity on the results screen.
6. If capacity is selected, user sees a temporary session modifier.
7. User copies the capacity modifier if needed for the current chat.

## Finalized Permanent Questions
### 1. Starting unclear or complex work
When a task feels unclear or complex, what helps most?
- Give me one clear first step.
- Break it into a short ordered plan.
- Give me the broader picture, then recommend where to start.

### 2. Managing information load
When information is piling up, what should the assistant do?
- Keep it brief and focus on the essentials.
- Start with a summary, then add the detail I need.
- Give me fuller context in a clear, scannable structure.

### 3. Making decisions
When several reasonable options exist, what should the assistant do?
- Recommend one option and explain why.
- Compare the main options and tradeoffs.
- Ask one question first when missing information could change the recommendation.

### 4. Handling side topics
When a conversation branches into side topics, what should the assistant do?
- Keep me on the current task and flag the drift.
- Briefly park useful side topics, then return to the task.
- Follow useful side topics unless I ask to return.

### 5. Returning after an interruption
When I return after a break, what should the assistant do?
- Continue from the last action with little or no recap.
- Give me a brief recap, then the next step.
- Reconstruct the key decisions, open questions, and next step.

## Capacity Selector (Optional, Temporary)
Location: results screen, separate from permanent preferences.

Question: How much bandwidth do you have right now?
- Usual bandwidth
- Limited bandwidth
- Very limited bandwidth

Behavior:
- Usual bandwidth: no additional session modifier.
- Limited bandwidth: compact session modifier.
- Very limited bandwidth: essentials-only session modifier.
- Capacity instructions are temporary defaults for the current session.
- Explicit user requests always override capacity defaults.

## Generated Prompt Rules
### Shared opening
Use these preferences when they are relevant. Answer normally when my request is already clear and specific.

### Shared closing
My explicit request overrides these defaults. When key information is missing, state a reasonable assumption and continue. Ask one question only when the answer would materially change the result.

### Length targets
- Permanent prompt: normally 90 to 140 words.
- Permanent prompt hard maximum: 180 words.
- Limited-bandwidth modifier: 20 to 40 words.
- Very-limited-bandwidth modifier: 20 to 40 words.
- Usual bandwidth: no modifier.

### Precedence order
1. User's explicit current request.
2. Temporary capacity modifier.
3. Permanent Work With Me preferences.
4. General assistant defaults.

The capacity modifier must not suppress explicitly requested depth, options, formatting, or completeness.

## Deterministic Generation Requirements
- Prompt generation must use fixed authored modules.
- Prompt assembly order is fixed: Shared opening, selected Q1 module, selected Q2 module, selected Q3 module, selected Q4 module, selected Q5 module, Shared closing.
- Exactly one module is selected from each question.
- The generator must not call an AI model.
- The generator must not shorten authored module text.
- The generator must not paraphrase modules dynamically.
- The generator must not rewrite modules dynamically.
- The generator must not merge module text based on meaning.
- The generator must not select alternate wording dynamically.
- The generator must not infer that differently worded authored strings are redundant.
- The generator must not infer user traits.
- The generator must not invent extra instructions.
- The only duplicate defense is exact full-string duplicate removal after whitespace-normalized comparison.
- Duplicate comparison normalization may only trim leading and trailing whitespace and collapse consecutive whitespace to one space.
- No current authored modules are expected to be exact duplicates; this guard is defensive integrity only.

## Accessibility and Privacy Principles
- Keep language plain and actionable.
- Keep choices concrete and scannable.
- Preserve keyboard and screen-reader usability.
- Keep processing local in the first MVP.
- Avoid collecting unnecessary user data.

## Out of Scope
- Condition-related personalization.
- Scoring systems and profile labels.
- User-editable prompt authoring inside the MVP UI.
- Platform-specific integrations.
- Accounts, backend services, analytics, and persistence.

## MVP Acceptance Criteria
- Exactly five required permanent questions.
- Exactly three answer choices for each required question.
- Exactly 15 permanent modules (one per answer choice).
- Exactly three capacity-state definitions.
- Exactly one selected module per question in generated permanent prompts.
- No free-text feature in first MVP.
- Platform-neutral output only.
- Preview and copy enabled; in-product edit disabled.
- Deterministic, module-based generator only.

## Decision Lock Reference
All MVP decisions in this spec are locked for implementation planning and are mirrored in [MVP-DECISIONS.md](MVP-DECISIONS.md).
