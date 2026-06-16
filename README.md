# mathGraph

Static math graph editor built with vanilla HTML, CSS, and JavaScript.

## Current Status

- Production deployment: https://mathgraph-five.vercel.app
- Local Vercel project link is configured for this workspace
- Local git repository is initialized and ready to push once a GitHub remote is chosen

## Project Structure

- `index.html`: main application shell
- `css/styles.css`: application styles
- `js/main.js`: app bootstrap and orchestration
- `js/core/`: canvas, object, history, and settings managers
- `js/objects/`: geometry object implementations
- `js/ui/`: UI panels, toolbar, and command palette
- `docs/`: reference documentation
- `.agent/`: planning and implementation notes used during work

## Local Workflow

1. Install dependencies with `npm install`
2. Run `npx vercel dev` to preview through the Vercel local runtime
3. Open the production URL after deployment to confirm the app loads

## Login And AI API Modes

The app opens with a login landing overlay.

- Entering `박범진` starts owner mode. OpenAI requests are sent to the same-origin Vercel proxy at `api/openai-responses.js`, so the browser does not need to store or display an OpenAI API key.
- Clicking `게스트로 진행` starts guest mode. Guests can use local deterministic fallback without a key, or enter their own OpenAI/Gemini API key in AI settings for provider-backed requests.
- Owner mode requires `OPENAI_API_KEY` to be configured as a Vercel environment variable. If it is missing, the proxy returns a clear setup error instead of falling back silently.

## Deployment

This repository is configured as a static Vercel project.

- `vercel.json` keeps the output directory at the repository root
- `npm run vercel-build` is a no-op build step for static deployment
- `.vercel/project.json` stores the local link to the Vercel project and should stay uncommitted
- `OPENAI_API_KEY` is required in the Vercel project for the `박범진` default OpenAI mode
- Optional owner-mode environment variables:
  - `MATHGRAPH_OWNER_NAME`: overrides the default owner name `박범진`
  - `MATHGRAPH_LOGIN_SECRET`: signs owner-session tokens independently from the OpenAI key
  - `MATHGRAPH_OWNER_TOKEN_TTL_MS`: controls owner-session token lifetime

## Working Agreement

See `AGENTS.md` for the repo-wide workflow rules, including documentation updates, Vercel linkage, and GitHub push expectations.
