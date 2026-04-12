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

## Deployment

This repository is configured as a static Vercel project.

- `vercel.json` keeps the output directory at the repository root
- `npm run vercel-build` is a no-op build step for static deployment
- `.vercel/project.json` stores the local link to the Vercel project and should stay uncommitted

## Working Agreement

See `AGENTS.md` for the repo-wide workflow rules, including documentation updates, Vercel linkage, and GitHub push expectations.
