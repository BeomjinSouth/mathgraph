# mathGraph

Static math graph editor built with vanilla HTML, CSS, and JavaScript.

## Current Status

- Production deployment: https://mathgraph-five.vercel.app
- GitHub remote: https://github.com/BeomjinSouth/mathgraph (branch `codex/ai-fallback-recovery` is the current direct-deploy branch)
- Local Vercel project link is configured for this workspace

## Project Structure

- `index.html`: main application shell
- `css/styles.css`: application styles (desktop layout plus canvas-first mobile drawers)
- `js/main.js`: app bootstrap and orchestration
- `js/core/`: canvas, object, history, event, and settings managers
- `js/objects/`: geometry object implementations
- `js/tools/`: interactive editing tools
- `js/ui/`: UI panels, toolbar, algebra input, and command palette
- `js/utils/`: pure helpers (geometry, responsive layout, history edits, references)
- `api/`, `lib/`: Vercel serverless login/OpenAI-proxy endpoints and shared auth utilities
- `tests/`: `node --test` suites covering editing, history, security, and layout behavior
- `docs/`: reference documentation
- `.agent/`: planning and implementation notes used during work

## Local Workflow

1. Install dependencies with `npm install`
2. Run `npm test` (same suite as the build gate) before committing
3. Run `npx vercel dev` to preview through the Vercel local runtime
4. Open the production URL after deployment to confirm the app loads

## Login And AI API Modes

The app opens with a login landing overlay.

- Owner mode requires the owner name **and** the owner password. Both are verified
  server-side by `api/login.js`; on success the browser receives a signed,
  time-limited session token that is kept in `sessionStorage` only. OpenAI requests
  are then sent to the same-origin Vercel proxy at `api/openai-responses.js`, so the
  browser never stores or displays the server's OpenAI API key.
- Clicking `게스트로 진행` starts guest mode. Guests can use the local deterministic
  fallback without a key, or enter their own OpenAI/Gemini API key in AI settings
  (stored in `sessionStorage`, cleared when the tab closes).
- The toolbar's logout button clears the session (including the owner token) and
  returns to the landing overlay.
- The OpenAI proxy is constrained server-side: model allow-list, request body size
  cap, verified-owner-subject rate limit, output-token cap, and request timeout.

## Editing Highlights

- Desktop mouse plus primary touch/pen input on the canvas (`touch-action: none`,
  pointer-cancel rolls back an in-progress drag without recording history).
- At viewports of 900px and below the tool/property panels become mutually
  exclusive overlay drawers and the canvas keeps the full width.
- Copy/paste rewrites internal references (`vertexIds`, circle references, etc.)
  so pasted composites never point back at the originals.
- Undo/redo covers tool drawing, drags (including points constrained to lines or
  circles and number lines), property-panel edits (label, color, point size, line
  width, coordinates, function expression/ranges, dimension text/format), algebra
  creation (a circle expression is one atomic undo step), AI patches, and paste.
- AI operations and project files support editable `ellipse`, `hyperbola`, and
  `parabola` objects with translation, rotation, selection, drag, canvas
  rendering, and SVG export.
- Save/load to browser storage is available from the toolbar and the command
  palette (Ctrl+K).

## Deployment

This repository is configured as a static Vercel project. The hardened release
(name+password owner login, constrained proxy) has been live on the public alias
since 2026-07-18.

- `vercel.json` serves the built `dist/` directory; `scripts/build-static.mjs`
  copies only the runtime whitelist (`index.html`, `favicon.svg`, `css/`, `js/`,
  `runtime/`) into it, so uploaded sources (tests, tools, agent references) are
  never publicly served
- `npm run vercel-build` runs the full `node --test` suite and then the static
  builder — both locally and on Vercel, so a remote build fails when tests fail
  (`tests/`, `tools/`, and `.agents/` upload with the deployment for this reason)
- `.vercel/project.json` stores the local link to the Vercel project and should stay uncommitted
- Required environment variables (production):
  - `OPENAI_API_KEY`: used by the owner-mode OpenAI proxy
  - `MATHGRAPH_LOGIN_SECRET`: signs owner-session tokens; the server fails closed (503) without it
  - `MATHGRAPH_OWNER_PASSWORD`: owner login password; owner login is disabled (503) without it, and the browser login field accepts at most 1024 characters
- Optional environment variables:
  - `MATHGRAPH_OWNER_NAME`: overrides the default owner name
  - `MATHGRAPH_OWNER_TOKEN_TTL_MS`: owner-session token lifetime (default 12h)
  - `MATHGRAPH_LOGIN_RATE_WINDOW_MS` / `MATHGRAPH_LOGIN_RATE_MAX`: login attempt rate limit (default 10 tries / 15 min, enforced for both address-wide and address+account buckets)
  - `MATHGRAPH_PROXY_ALLOWED_MODELS`: comma-separated proxy model allow-list override
  - `MATHGRAPH_PROXY_MAX_BODY_BYTES`: proxy request body cap (default 10 MB)
  - `MATHGRAPH_PROXY_RATE_WINDOW_MS` / `MATHGRAPH_PROXY_RATE_MAX`: proxy rate limit (default 30 requests / 60 s per verified owner subject, enforced per serverless instance)
  - `MATHGRAPH_PROXY_MAX_OUTPUT_TOKENS`: forced `max_output_tokens` on proxied requests (default 16384)
  - `MATHGRAPH_PROXY_TIMEOUT_MS`: upstream OpenAI request timeout (default 120 s)
- Fixed login request defenses:
  - login JSON is capped at 8 KB; names at 128 characters; passwords at 1024 characters
  - attacker-controlled address/name key parts are SHA-256 hashed; login and proxy use separate per-instance stores capped at 2048 buckets each
  - expired buckets are reclaimed, but a full active store rejects new keys instead of evicting another active rate limit

## Working Agreement

See `AGENTS.md` for the repo-wide workflow rules, including documentation updates, Vercel linkage, and GitHub push expectations.
