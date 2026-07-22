# Work With Me MVP Product Specification

## Problem Statement
Work With Me helps people turn common work barriers into practical instructions for an AI assistant. Many professionals can use AI more effectively when the assistant responds in a way that is easier to understand, act on, and apply. The product gives users a short, nonclinical questionnaire that translates their working preferences into copy-ready instructions.

## Target Users
- Employees who use AI to draft, plan, summarize, compare options, or restart interrupted work.
- Individual contributors who want clearer, more useful AI responses without building custom prompts from scratch.
- Teams that want a lightweight, privacy-preserving productivity tool.

## Business Value
- Helps employees get more usable output from AI with less setup friction.
- Reduces repeated prompt rewriting by giving users a reusable instruction block.
- Supports broader AI adoption by making responses more practical and easier to apply.
- Keeps the product simple enough for fast internal experimentation.

## Nonclinical Boundaries
- The product does not diagnose, label, score, or judge users.
- The product does not mention or target any health condition in the questionnaire or generated output.
- The product does not claim to treat or improve any condition.
- The product does not infer personal traits from the answers.
- The product uses neutral language about work preferences and current capacity only.

## Complete User Flow
1. User opens Work With Me and sees a short explanation of what the tool does.
2. User answers five required questions about how they want AI to help.
3. User optionally selects a current capacity level.
4. User optionally adds one short recurring-frustration note in free text.
5. The product generates a permanent Work With Me prompt.
6. If a current capacity level was selected, the product also generates a temporary session modifier.
7. If free text was provided, the product adds one short custom instruction that reflects that recurring frustration.
8. User copies the generated text into an AI assistant.

The exact placement of the current-capacity selector and the edit/preview experience are still open decisions and are tracked in [OPEN-DECISIONS.md](OPEN-DECISIONS.md).

## Finalized Questions
### 1. Starting unclear or complex work
Question: When you start a task that feels unclear or complex, what helps most?
- Give me one clear first step.
- Break it into a few concrete steps and show the order.
- Give me the full picture, then recommend a starting point.

### 2. Managing information load
Question: When information is piling up, what should the assistant do?
- Keep it short and focus on the essentials.
- Give a short summary first, then add supporting detail.
- Include fuller context, but keep the structure easy to scan.

### 3. Making decisions among reasonable options
Question: When several reasonable options exist, what should the assistant do?
- Recommend one option clearly.
- Compare the main options and note the tradeoffs.
- Ask me one clarifying question before recommending.

### 4. Maintaining focus and handling tangents
Question: When the conversation starts drifting, what should the assistant do?
- Keep me on the original task and point out the drift.
- Mention the tangent briefly, then return to the main task.
- Follow the tangent if I ask to explore it.

### 5. Resuming after interruption
Question: When I return after a break, what should the assistant do?
- Resume from the last concrete step without repeating everything.
- Summarize where we left off, then continue.
- Rebuild the context quickly if needed, then continue.

## Current-Capacity Selector
The MVP includes one optional current-capacity selector with these working labels:
- regular capacity
- strained capacity
- depleted capacity

The selector is not a diagnostic tool. It only changes the temporary session modifier so the assistant can adjust response length and pacing for the current session.

## Optional Free-Text Question
Prompt: Is there one recurring work frustration you want the assistant to remember?

Guidance:
- Keep it to one short sentence.
- Treat it as a recurring instruction, not as a label.
- Use it only if the user enters text.

## Expected Completion Time
- 2 to 4 minutes for most users.
- Slightly longer if the user adds a free-text instruction.

## Output Formats
### Permanent output
A copy-ready plain-text Work With Me prompt that combines the five permanent answers into one reusable instruction block.

### Temporary output
A short session modifier that reflects the selected current capacity and is intended for the current chat only.

### Optional output
A single custom instruction sentence generated from the user’s recurring frustration note when present.

## Accessibility and Privacy Principles
- Use short, plain language.
- Keep choices concrete and easy to scan.
- Avoid jargon and avoid requiring users to self-label.
- Make the questionnaire usable with keyboard and screen reader support.
- Do not store responses on a backend in the MVP.
- Minimize data collection to only what is needed for generation.
- Avoid asking for personally sensitive details.

## Out of Scope
- Diagnostic language or condition-based personalization.
- Scoring, ranking, or profile assignment.
- Personality assessment.
- Accounts, analytics, enterprise integrations, or server-side storage.
- Product redesign of the current screens.
- Platform-specific AI integrations in the MVP.
- Claims of measured productivity improvement before evidence exists.

## MVP Acceptance Criteria
- The product asks exactly five required questions.
- Every required question offers exactly three answer choices.
- The product offers one optional current-capacity selector with exactly three choices.
- The product accepts one optional recurring-frustration free-text instruction.
- The product generates one permanent Work With Me prompt.
- The product generates one temporary session modifier when capacity is selected.
- The permanent prompt uses neutral, nonclinical language.
- The generated text is copy-ready and understandable without extra editing.
- The MVP does not diagnose, label, score, or judge the user.
- The MVP does not require a backend.
- The MVP does not claim proven productivity gains.
