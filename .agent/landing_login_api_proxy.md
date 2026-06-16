# Landing Login And Default OpenAI Proxy

## Summary

- Task: Add an initial login landing screen and route the named owner flow through a default OpenAI API proxy.
- Owner: Codex
- Date: 2026-06-16
- Related files:
  - `index.html`
  - `css/styles.css`
  - `js/main.js`
  - `js/ai/AIService.js`
  - `api/login.js`
  - `api/openai-responses.js`
  - `tests/ai-flow.test.js`
  - `README.md`
  - `docs/ai-reference.md`

## User Request

- Show a landing/login screen first.
- If the user enters `박범진`, allow OpenAI API use without typing an API key.
- Also provide a `게스트로 진행` button.
- Guest mode must require the user to enter their own API key for provider-backed AI use.

## Design Target

- Generated concept reference: `C:\Users\pbj95\.codex\generated_images\019ecdfa-bb79-75a1-b4bb-6c25c7bb9c7d\ig_069803515c5bfc08016a30a320d4188191a9dad7573f1f8a5f.png`
- Direction:
  - Keep the existing dark glass MathGraph editor style.
  - Use a compact first-run overlay rather than a marketing landing page.
  - Preserve the usable editor as the first post-login screen.

## Architecture

- Client session mode:
  - `owner`: name input equals `박범진`; OpenAI requests use the same-origin Vercel proxy.
  - `guest`: user clicks `게스트로 진행`; OpenAI/Gemini requests keep the current BYOK browser flow.
- Server proxy:
  - `api/login.js` returns a short-lived signed token for owner mode.
  - `api/openai-responses.js` validates that token, reads `OPENAI_API_KEY` from Vercel environment variables, and forwards the existing Responses API request body to OpenAI.
- Security boundary:
  - Do not place an OpenAI API key in client JavaScript, HTML, localStorage, docs, tests, or commits.
  - The name gate is a convenience gate, not strong authentication. A stronger auth system remains future work if the app is shared broadly.

## Acceptance Criteria

- [x] First load shows a login landing screen before the editor can be used.
- [x] Entering `박범진` starts owner mode and hides direct API-key input for OpenAI.
- [x] Guest button enters the editor but keeps API-key input required for OpenAI/Gemini.
- [x] Owner OpenAI text and image calls go through `/api/openai-responses`.
- [x] Proxy calls fail clearly when `OPENAI_API_KEY` is not configured on the server.
- [x] Existing local fallback behavior still works.
- [x] Tests/build/whitespace checks and browser smoke are recorded.
- [x] Vercel environment requirement and deployment status are documented.

## Verification Plan

- `node --check js\ai\AIService.js`
- `node --check js\main.js`
- `node --check api\login.js`
- `node --check api\openai-responses.js`
- `node --test tests\ai-flow.test.js`
- `npm.cmd test`
- `npm.cmd run vercel-build`
- `git diff --check`
- Browser/Playwright smoke for owner login, guest login, settings visibility, and app load.

## Implementation Result

- Added the first-load auth landing overlay in `index.html` and `css/styles.css`.
- Added session-mode handling in `js/main.js`.
- Added owner-token login and OpenAI proxy endpoints in `api/login.js` and `api/openai-responses.js`.
- Updated `js/ai/AIService.js` so owner OpenAI text/image calls use `/api/openai-responses`, while guest calls keep the existing direct BYOK provider path.
- Added regression coverage in `tests/ai-flow.test.js` for owner proxy routing.

## Verification Result

- `node --check js\ai\AIService.js`; passed.
- `node --check js\main.js`; passed.
- `node --check api\login.js`; passed.
- `node --check api\openai-responses.js`; passed.
- `node --test tests\ai-flow.test.js`; passed with 46 tests.
- `npm.cmd test`; passed with 176 tests.
- `npm.cmd run vercel-build`; passed.
- `git diff --check`; passed with line-ending warnings only.
- In-app Browser loaded `http://127.0.0.1:4196/`, confirmed the landing screen and owner-mode UI state, and saved screenshots under `tmp/browser-captures/`.
- Isolated Playwright smoke confirmed initial landing, owner mode, guest mode, 390px mobile layout, 0 console errors, and 0 failed requests.
- Local proxy check confirmed missing server `OPENAI_API_KEY` returns a clear 500 setup error.
- `npx.cmd vercel deploy --prod --yes`; production deployment `dpl_9DFsZijPBTySUu7MY1sdYJ9KdfBR` created at `https://mathgraph-qsc02lwab-beomjinsouths-projects.vercel.app`.
- `npx.cmd vercel inspect https://mathgraph-qsc02lwab-beomjinsouths-projects.vercel.app`; target `production`, status `Ready`, primary alias attached, and serverless functions present.
- `https://mathgraph-five.vercel.app/`; returned HTTP 200.
- Production Playwright smoke confirmed initial, owner, and guest flows with `window.app`, 0 console errors, and 0 failed requests.
- Production owner proxy missing-env check returned the documented 500 setup error.

## Deployment Notes

- `npx.cmd vercel env ls` currently reports encrypted Production values for `OPENAI_API_KEY` and `MATHGRAPH_LOGIN_SECRET`.
- Owner mode default OpenAI calls are now enabled on Production.
- Production alias: `https://mathgraph-five.vercel.app`.
- Production deployment URL: `https://mathgraph-qsc02lwab-beomjinsouths-projects.vercel.app`.

## 2026-06-16 Environment Update

- Added `OPENAI_API_KEY` as an encrypted Production Vercel environment variable.
- Added `MATHGRAPH_LOGIN_SECRET` as an encrypted Production Vercel environment variable with a separate generated random value.
- Redeployed production after the env changes; latest Ready deployment inspected through the production alias is `dpl_DWWGxucahW8ffQfH5BVbFD7tFe9L` at `https://mathgraph-pge0mlrn2-beomjinsouths-projects.vercel.app`.
- Verified owner login and `/api/openai-responses` through `vercel curl`; the proxy returned an OpenAI response with output `OK`.
- Preview branch env setup was blocked because the Vercel project has no connected Git repository. Development sensitive env setup was skipped because Vercel does not allow Sensitive variables in Development.
