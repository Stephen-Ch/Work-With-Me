# Work With Me

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Work With Me is an MVP web app that helps a user create reusable AI instructions from five fixed preference answers.

The app is nonclinical. It does not diagnose, label, or profile medical or mental health conditions.

## MVP behavior

- The five required answers generate permanent instructions.
- An optional bandwidth choice can append a temporary final paragraph for the current AI conversation only.
- The result screen presents one combined block to copy.
- No temporary paragraph is added when no bandwidth is selected or when Usual bandwidth is selected.
- Changing bandwidth never changes the saved permanent preferences.
- The permanent generator remains deterministic across all 243 permanent profiles.
- The combined preview/copy behavior is validated across all 729 profile-capacity combinations.

## Privacy and data

- Session state is stored in browser sessionStorage only.
- No analytics or third-party telemetry is sent by the app runtime.
- No backend, account, or cloud sync is required.
- Start Over clears MVP session state.

## Running locally

Prerequisite: Node.js.

Install dependencies: `npm install`
Start dev server: `npm start`
Run tests: `npm test`
Build production bundle: `npm run build`
Run dist browser acceptance: `npm run e2e:dist`

## Stack

- Angular 20 + TypeScript
- Tailwind CSS
- Karma/Jasmine unit tests
- Playwright end-to-end tests (dist smoke acceptance)

## License

MIT. See [LICENSE](LICENSE).
