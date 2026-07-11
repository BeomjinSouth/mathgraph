# Teacher Site Release Hardening Design

**Date:** 2026-07-10
**Owner:** Codex
**Status:** Approved for autonomous execution

## Context

MathGraph already supports the core desktop teacher workflow, but the July worktree contains several uncommitted changes and the production deployment still serves the June 19 version. The readiness audit identified four release-blocking groups: owner/proxy security, copied-object reference integrity, mobile/touch usability, and incomplete undo/deployment quality gates.

The current worktree is authoritative. Its existing password login, fail-closed token signing, HTML escaping, AI patch transactions, parser fixes, and AI conversation changes must be preserved and completed rather than discarded.

## Goals

1. Close the validated owner-login, proxy, and command-palette security findings without weakening guest mode or the existing owner proxy.
2. Ensure copied composite objects refer only to their copied dependencies and remain correct through undo/redo.
3. Make the editor usable at 390×844 with accessible panel controls and primary touch/pen drawing while preserving desktop mouse behavior.
4. Make common teacher edits undoable and keep AI/paste batches atomic.
5. Replace the no-op Vercel build gate with real verification, correct stale documentation, commit/push all completed changes, and deploy only after production prerequisites are present.

## Non-goals

- Do not add new mathematical primitives, PDF import/export, statistics charts, pinch zoom, or two-finger panning in this release.
- Do not perform a broad visual redesign of the desktop editor.
- Do not claim full WCAG conformance; this pass addresses the responsive and input blockers needed for the core flow.
- Do not enable GPT-5.6 by default while official docs describe it as partner preview. Keep GPT-5.5 as the default and GPT-5.4 variants as supported alternatives until availability changes.

## Selected Delivery Sequence

1. Security and proxy boundary closure.
2. Composite-copy reference integrity.
3. Mobile responsive drawers and touch/pen bridge.
4. Undo consistency and deployment-quality cleanup.
5. Full browser verification, environment check, production deployment, and documentation closeout.

Each phase is independently testable and committed. Existing dirty hunks are preserved and assigned to the phase that owns them.

## Security Design

### Command palette

- Treat the palette query as untrusted.
- Reuse `escapeHtml()` for HTML contexts and add a small regular-expression escape helper for highlight matching.
- The algebra hint may display the query, but the resulting DOM must contain text only; an `<img onerror>` payload must never create an element or event handler.
- Static command names, categories, and shortcuts remain unchanged.

### Owner login and tokens

- Compare secret strings through equal-length SHA-256 digests before `timingSafeEqual()` so unequal input lengths do not trigger a direct length short-circuit.
- Apply a login-attempt budget of 10 attempts per 15 minutes per normalized client-address/name key, enforced per serverless instance.
- Return `429` with `Retry-After` after exhaustion while keeping the existing generic invalid-credential message for normal failures.
- Key the OpenAI proxy limiter by the verified owner subject instead of the bearer token so obtaining a new token does not reset the proxy budget.
- Keep the existing fail-closed requirements for `MATHGRAPH_LOGIN_SECRET` and `MATHGRAPH_OWNER_PASSWORD`.

### Request validation and cost boundary

- Measure UTF-8 JSON size even when Vercel has already parsed `req.body` into an object.
- Accept only fields used by MathGraph: `model`, `input`, `reasoning`, `text`, and optional `previous_response_id`.
- Force `store: false`, disallow caller-selected tools/background/stream/service tier, and cap output with server-owned `max_output_tokens`.
- Default `MATHGRAPH_PROXY_MAX_OUTPUT_TOKENS` to 16,384 and `MATHGRAPH_PROXY_TIMEOUT_MS` to 120,000.
- Abort the upstream fetch on timeout and return a clear retryable gateway-timeout response.
- Preserve valid text and image Structured Outputs requests from the current client.

### Guest API-key migration

- Treat a legacy `apiKey` embedded in `graphA_ai_config` as sensitive migration input, not as a supported persistent setting.
- On first load, move that value to `sessionStorage`, immediately rewrite the local-storage record without `apiKey`, and prefer an already-present session key.
- If session storage is unavailable, still remove the persistent key and keep it only in the current in-memory configuration.

## Composite-copy Reference Design

- Add one pure reference-remapping helper shared by `GraphAApp.pasteObjects()` and `PatchApplier.resolveReferences()`.
- Remap `dependencies` plus all explicit single-ID fields, including `circle1Id`, `circle2Id`, and `tangentPointId`.
- Remap all array-ID fields, including `vertexIds`, `baseVertexIds`, `topVertexIds`, and `boundaryObjectIds`.
- Do not mutate the source clipboard payload.
- A pasted polygon, lens, prism, tangent circle, or closed region must no longer react to movement of its original dependencies.
- Paste remains one undo step; redo restores the already-remapped serialized data.

## Mobile and Pointer Design

Before editing the responsive UI, generate and save a 16:9 target design sheet with two 390×844 states: canvas-first default and one open tool drawer. Use the existing dark/glass visual language and Korean labels as the visual source of truth.

At viewports up to 900px:

- Remove both 320px panels from normal flex flow and render them as left/right overlay drawers.
- Start both drawers closed, keep their toggles above the drawers, and allow only one drawer open at a time.
- Size each drawer to `min(320px, calc(100vw - 48px))`.
- Keep the canvas container at the full available width and clamp the chat panel inside the viewport.
- Observe canvas-container size changes and coalesce `canvas.resize()` plus render calls with `requestAnimationFrame`.
- Preserve the existing mouse event path. Bridge only primary touch/pen pointer events into it, ignore compatibility mouse duplication, and use `touch-action: none`.
- On `pointercancel` or lost capture, roll back any pending history drag, invoke the active tool's cancellation path, release capture best-effort, and clear both input-layer and tool-layer gesture state without committing an export or selection action.
- Exclude pinch zoom and multi-touch gestures.

Desktop at 1280×720 retains two 320px side panels and the existing mouse, wheel, double-click, right/middle-click, Alt, and Space interactions.

## Undo Design

- Preserve the new history transaction API for AI patches and paste batches.
- Record property-panel label, color, size, width, coordinates, and function-expression changes with old/new values.
- Record command-palette algebra creation from the full before/after object delta so a circle and its helper points undo atomically.
- Capture constrained-point state using its authoritative parameter (`t` or `angle`) rather than only derived position.
- Capture number-line vertical position and transaction state in snapshots used for rollback.
- Restore point coordinates through `setPosition()` and function expressions through `setExpression()` so undo preserves runtime object invariants.
- Keep every direct user edit as one understandable undo step; do not combine unrelated edits.
- This release closes the named teacher-edit gaps; specialized drag-state adapters outside those paths remain a documented follow-up rather than an unverified claim of universal undo coverage.

## Build and Documentation Design

- Change `build` and `vercel-build` from echo-only commands to the real test suite.
- Keep the official model configuration unchanged for this release: GPT-5.5 is the documented default, GPT-5.4/mini/nano remain supported, and GPT-5.6 remains opt-in only after broad API availability.
- Update README, AI reference, AGENTS environment variables, PRD, implementation tracking, skills context, readiness audit, and progress log.
- Commit screenshots/design references only when they are deliberate project artifacts.

## Verification

### Automated

- Every behavior change follows red-green TDD with focused Node tests.
- Full `npm.cmd test` passes.
- `npm.cmd run vercel-build` runs the real suite and passes.
- JavaScript syntax checks pass for changed runtime/server files.
- `git diff --check` reports no whitespace errors.

### Browser

- Use the in-app Browser on local MathGraph.
- Desktop 1280×720: page identity, meaningful DOM, no framework overlay, no relevant console errors, guest entry, manual point/function creation, drawer state, drag/pan/wheel behavior.
- Mobile 390×844: nonzero full-width canvas, no horizontal overflow, mutually exclusive drawers, chat inside viewport, one primary touch/pen point creation, drag cleanup after cancellation.
- Additional 768×1024 and 1024×768 breakpoint checks.

### Security closure

- The original command-palette payload creates no executable DOM.
- Parsed object bodies over the configured byte cap receive `413`.
- Repeated invalid owner login receives `429` and a valid control still works within budget.
- A new owner token does not bypass the proxy subject limiter.
- Disallowed Responses fields are not forwarded upstream.
- A legacy local-storage API key is removed during configuration load and remains available only for the current session.

### Deployment

- Confirm Vercel Production has `OPENAI_API_KEY`, `MATHGRAPH_LOGIN_SECRET`, and `MATHGRAPH_OWNER_PASSWORD` before deployment.
- Deploy only the verified committed branch.
- Inspect the deployment as `production` and `Ready`, confirm the primary alias, HTTP 200, and repeat the production browser smoke.
- If Vercel authentication or a required secret is unavailable, do not deploy an owner-login-breaking build; record the exact blocker while continuing all local/GitHub work.

## Completion Criteria

- All five delivery phases are implemented, tested, reviewed, documented, and committed.
- GitHub branch contains the completed work with no task-owned unstaged changes.
- Production either runs the verified release with all prerequisites or has a precisely documented external credential blocker after every safe in-scope alternative has been exhausted.
