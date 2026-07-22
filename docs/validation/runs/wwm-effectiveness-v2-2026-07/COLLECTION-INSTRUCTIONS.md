# Collection Instructions

Run ID: wwm-effectiveness-v2-2026-07

## Required environment
- Use one consistent model version per platform run and record the exact displayed model label.
- Use a fresh conversation for every packet.
- Disable memory, custom instructions, personalization, tools, and web access where possible; record if unavailable.
- Do not mention evaluation context to the assistant.
- Do not regenerate for quality preference; first valid response only.

## Message order
- If packet step 1 is type instruction: send step 1, wait for acknowledgement/response, then send step 2 prompt.
- If packet step 1 is type prompt: send it as the first message.
- Preserve the evaluated answer exactly as returned to the case prompt.

## Output preservation
- Save evaluated output to the packet destination file as UTF-8 text/markdown.
- Preserve refusals, tool offers, irrelevant text, errors, and formatting.
- Do not edit wording, punctuation, markdown, or structure.

## Required metadata per raw file
Include a metadata header with:
- platform
- exact model label
- local date/time
- packetId
- caseId
- blindedLabel
- webEnabled yes/no
- toolsEnabled yes/no
- memoryOrCustomInstructionsDisabled yes/no/unknown
- responseRegenerated (must be no unless technical retry)
- technicalError yes/no
- retryReference if applicable
- collectorNotes (technical only)

## Technical failure retries
Allowed only for network/outage/empty/truncated/UI failure cases.
- Keep failed attempt file.
- Retry in a fresh conversation using same packet.
- Label retry clearly; do not overwrite failed attempt.
