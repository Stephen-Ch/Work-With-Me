# Effectiveness Gate Toolkit

This folder contains a local, provider-neutral toolkit for manually running the Work With Me effectiveness gate.

No network access or API keys are required.

## Files
- cases.json: required test prompts, intent, and pass criteria
- conditions.json: condition definitions, profile set, capacity plan, and candidate hard-cap wording
- results-template.json: manual run template to copy and fill
- analyze-results.mjs: prepare randomized review packets and analyze completed results
- analyze-results.spec.mjs: node:test coverage for analyzer behavior

## Usage
Prepare randomized review packet (deterministic with seed):

node tools/effectiveness-gate/analyze-results.mjs prepare --seed 20260722 --out tools/effectiveness-gate/review-packet.json

Analyze a populated results file:

node tools/effectiveness-gate/analyze-results.mjs analyze --input tools/effectiveness-gate/results-template.json --out tools/effectiveness-gate/analysis-output.json

## Manual Run Notes
- Run each case in fresh conversations per condition.
- Keep prompts and instruction blocks exact.
- Do not edit model outputs.
- Preserve raw text in results files.
- Capture platform, model, date, web/tools state, and active system/custom instructions.

## Important
The candidate hard-cap wording in conditions.json is experimental and nonproduction.
