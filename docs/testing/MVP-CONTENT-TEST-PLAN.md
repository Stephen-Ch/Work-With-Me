# Work With Me MVP Content Test Plan

## Purpose
This plan defines content tests for the questionnaire and generated prompts before implementation. It focuses on text quality, output assembly, and behavior selection. It does not test application code.

## Regression Requirement
Clear, well-specified prompts must not be unnecessarily interrupted, shortened, or reframed. If the user already gave enough detail, the assistant should answer directly and keep the requested shape.

## Coverage Rules
- Exactly five required questions must be represented in the module coverage.
- Every required question must have exactly three answer choices.
- All 15 permanent answer modules must be tested at least once.
- All 3 capacity states must be tested at least once.
- The prompt generator must be tested with mixed profiles and conflicting choices.
- The prompt generator must be tested with concise writing, detailed writing, concise coding, complex planning, interrupted-task resumption, low-capacity work, explicit override, and no-personalization-needed requests.

## Individual Permanent-Module Tests

| ID | Module | Input profile | User prompt | Expected AI behavior | Prohibited behavior | Pass / Fail criteria |
|---|---|---|---|---|---|---|
| T01 | WWM-PM-START-A | start-A / load-B / decide-B / focus-B / resume-B / cap=regular | I have a new project and I do not know where to begin. | Give one clear first step and stop after the first step unless asked for more. | Long preamble, multiple branching paths, motivational tone. | PASS if the answer opens with one step and stays tight. FAIL if it starts with a long overview or several options. |
| T02 | WWM-PM-START-B | start-B / load-B / decide-B / focus-B / resume-B / cap=regular | Outline a product rollout plan. | Break the task into a short ordered list of concrete steps. | Free-form brainstorming without order. | PASS if the response is a short ordered plan. FAIL if the response is unstructured or vague. |
| T03 | WWM-PM-START-C | start-C / load-B / decide-B / focus-B / resume-B / cap=regular | Explain the options for moving this work forward. | Give the full picture, then recommend a starting point. | Hiding context or jumping straight to a narrow answer. | PASS if context comes first and a starting point follows. FAIL if the context is omitted. |
| T04 | WWM-PM-LOAD-A | start-B / load-A / decide-B / focus-B / resume-B / cap=regular | Summarize this long update for me. | Keep it short and focus on the essentials. | Extra background, long digressions, repeated framing. | PASS if the answer is brief and essential. FAIL if it becomes a long summary. |
| T05 | WWM-PM-LOAD-B | start-B / load-B / decide-B / focus-B / resume-B / cap=regular | Explain the main differences between these options. | Give a short summary first, then supporting detail. | Buried main point or excessive detail before the summary. | PASS if the first sentence is the main point. FAIL if the main point is delayed. |
| T06 | WWM-PM-LOAD-C | start-B / load-C / decide-B / focus-B / resume-B / cap=regular | I need the broader context on this plan. | Include fuller context, but keep the structure easy to scan. | Flattened one-line answer that omits needed context. | PASS if the answer is fuller but still organized. FAIL if it is dense or unreadable. |
| T07 | WWM-PM-DECIDE-A | start-B / load-B / decide-A / focus-B / resume-B / cap=regular | I am choosing between two vendors. | Recommend one option clearly and explain why it is the strongest choice. | Refusing to choose when the prompt asks for a choice. | PASS if one option is recommended. FAIL if the answer only compares options without choosing. |
| T08 | WWM-PM-DECIDE-B | start-B / load-B / decide-B / focus-B / resume-B / cap=regular | Compare these two approaches. | Compare the main options, name the tradeoffs, and keep it concise. | One-sided answer that ignores tradeoffs. | PASS if the tradeoffs are explicit. FAIL if the comparison is missing. |
| T09 | WWM-PM-DECIDE-C | start-B / load-B / decide-C / focus-B / resume-B / cap=regular | Which option should I pick? | Ask one clarifying question before recommending when the choice depends on missing information. | Multiple clarifying questions or premature recommendation. | PASS if one clarifying question appears first. FAIL if it recommends before clarifying. |
| T10 | WWM-PM-FOCUS-A | start-B / load-B / decide-B / focus-A / resume-B / cap=regular | I also want to talk about an unrelated issue. | Keep the response tied to the original task and point out drift when it matters. | Following the tangent without returning to the main task. | PASS if drift is noted and the main task remains centered. FAIL if the tangent takes over. |
| T11 | WWM-PM-FOCUS-B | start-B / load-B / decide-B / focus-B / resume-B / cap=regular | By the way, what about this side topic? | Mention the tangent briefly, then return to the main task. | Ignoring the tangent completely or staying on it too long. | PASS if the tangent is acknowledged once and the main task resumes. FAIL if the response wanders. |
| T12 | WWM-PM-FOCUS-C | start-B / load-B / decide-B / focus-C / resume-B / cap=regular | Let’s explore the side idea instead. | Follow the tangent when the user explicitly asks to explore it. | Forcing the original task when the user changed direction. | PASS if the new topic is followed. FAIL if the assistant insists on the prior topic. |
| T13 | WWM-PM-RESUME-A | start-B / load-B / decide-B / focus-B / resume-A / cap=regular | Continue from the last draft. | Resume from the last concrete step and avoid repeating material. | Rewriting the entire context from scratch. | PASS if the answer starts where the work left off. FAIL if it restarts from the beginning. |
| T14 | WWM-PM-RESUME-B | start-B / load-B / decide-B / focus-B / resume-B / cap=regular | I stepped away from the plan. | Summarize where we left off, then continue from there. | Skipping the recap or jumping to a new topic. | PASS if the recap is short and accurate. FAIL if the recap is missing or too long. |
| T15 | WWM-PM-RESUME-C | start-B / load-B / decide-B / focus-B / resume-C / cap=regular | It has been a while and I need context again. | Rebuild the context quickly when needed, then continue with the next useful step. | Overexplaining the old context or stalling. | PASS if the context is rebuilt efficiently. FAIL if the answer is bloated or circular. |

## Capacity-State Tests

| ID | Module | Input profile | User prompt | Expected AI behavior | Prohibited behavior | Pass / Fail criteria |
|---|---|---|---|---|---|---|
| T16 | WWM-CAP-REGULAR | any permanent profile / cap=regular | Give me a standard project update. | Use the permanent prompt as written with no extra compression. | Adding an extra capacity warning or shortening without cause. | PASS if the answer reflects the selected permanent profile only. FAIL if the response is artificially compressed. |
| T17 | WWM-CAP-STRAINED | any permanent profile / cap=strained | Give me a standard project update. | Keep responses compact and practical. | Long explanations, unnecessary branches, or repeated reassurance. | PASS if the response is noticeably shorter than regular. FAIL if it is essentially the same length and shape as regular capacity. |
| T18 | WWM-CAP-DEPLETED | any permanent profile / cap=depleted | Give me a standard project update. | Prioritize brevity and clarity and give the minimum useful answer. | Extra options, long context, or follow-on branching. | PASS if the answer is the shortest useful form. FAIL if it adds nonessential structure. |

## Mixed-Profile and Conflict Tests

| ID | Input profile | User prompt | Expected AI behavior | Prohibited behavior | Pass / Fail criteria |
|---|---|---|---|---|---|
| T19 | start-A / load-A / decide-A / focus-A / resume-A / cap=regular | Write a short internal update email. | Produce a brief direct draft with one clear start and one clear recommendation. | Over-structuring or adding extra explanation. | PASS if the output is concise and ready to use. FAIL if it becomes a multi-section memo. |
| T20 | start-C / load-C / decide-B / focus-B / resume-B / cap=regular | Draft a detailed memo explaining this plan. | Give fuller context in a readable structure and include tradeoffs. | Cutting the memo down to a bare summary. | PASS if the answer is detailed but scannable. FAIL if important context is omitted. |
| T21 | start-A / load-A / decide-A / focus-A / resume-A / cap=regular | Write TypeScript for a helper that filters duplicates. | Give code-first help with a short explanation only if needed. | Long preambles, excess reassurance, or unrelated design talk. | PASS if code appears quickly and explanation stays short. FAIL if the answer delays the code. |
| T22 | start-B / load-B / decide-B / focus-A / resume-B / cap=regular | Plan a rollout with dependencies, review steps, and risks. | Provide an ordered plan, note tradeoffs, and keep focus on the rollout. | Wandering into unrelated topics. | PASS if the response is an ordered rollout plan. FAIL if the main plan is buried. |
| T23 | start-B / load-B / decide-B / focus-A / resume-A / cap=regular | Continue from where we stopped. | Resume the previous work without restarting from the top. | Repeating the entire prior answer. | PASS if the response picks up where the thread left off. FAIL if it restates the whole context. |
| T24 | start-A / load-A / decide-A / focus-A / resume-A / cap=depleted | I only have ten minutes to finish this. | Give the minimum useful answer, one step at a time. | Multi-step expansion, long context, or extra options. | PASS if the answer is very short and actionable. FAIL if it tries to be comprehensive. |
| T25 | start-B / load-B / decide-B / focus-B / resume-B / cap=regular | Ignore your defaults and give me three options with pros and cons. | Follow the explicit user request and give three options with tradeoffs. | Forcing the profile defaults instead of the direct request. | PASS if the explicit request overrides the profile. FAIL if the profile suppresses the requested options. |
| T26 | any profile / cap=regular | What is the capital of France? | Answer directly without personalization or extra framing. | Unnecessary profile-based commentary. | PASS if the answer is direct and brief. FAIL if the assistant adds a profile-driven preamble. |
| T27 | start-A / load-C / decide-C / focus-B / resume-B / cap=strained | I need to decide how to present this update. | Use the profile to keep the answer concise, but still clarify or recommend if the decision needs it. | Overloading the answer or asking multiple questions. | PASS if the answer balances brevity with useful decision support. FAIL if it is noisy or overlong. |
| T28 | start-B / load-B / decide-B / focus-B / resume-B / cap=regular | Summarize this 200-word note in exactly 60 words. | Respect the user’s explicit length constraint and do not interrupt with extra personalization. | Shortening below the requested length or adding an unnecessary clarification. | PASS if the output is about 60 words and follows the request. FAIL if the assistant overrides the user’s format request. |

## Sample Prompt Length Checks
Three representative samples were generated during review and counted as follows:

| Sample | Profile summary | Permanent prompt words | Capacity modifier words |
|---|---|---:|---:|
| S1 | Balanced profile with regular capacity | 138 | 0 |
| S2 | Conflicted profile with strained capacity | 120 | 26 |
| S3 | Low-capacity profile with depleted capacity | 125 | 30 |

These sample lengths confirm the working targets:
- permanent prompt: normally 120 to 180 words
- capacity modifier: normally 25 to 50 words

Each review sample should still confirm that the permanent prompt is readable, the capacity modifier stays brief, and the combined output does not repeat the same instruction twice.
