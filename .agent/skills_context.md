# Skills and Context

## Relevant Skills

- Skill: OpenAI Vibe Coding Context
- Why it matters:
  - This task extends the OpenAI Responses API Structured Outputs schema for AI graph generation, so local reference maps and current official docs must be checked before implementation.
- Skill: PDF
- Why it matters:
  - The task compares local teacher-guide PDFs against rendered app output, so representative pages should be rendered or visually inspected.
- Skill: Browser / Frontend Testing Debugging
- Why it matters:
  - The user explicitly asked to use computer/browser validation, and the rendered canvas must be checked with screenshots.
- Skill: Middle School Math 2026
- Why it matters:
  - The three PDFs are middle-school math teacher-guide sources from the user's 2026 math materials folder.
- Local context read:
  - `AGENTS.md`
  - `docs/openai-url-inventory.yaml`
  - `docs/openai-context-map.md`
  - `docs/openai-core-summaries.md`
  - `docs/openai-docs-map.yaml`
  - `docs/vibecoding-openai-guide.md`
  - `docs/progress-log.md`
- Official docs checked:
  - `https://developers.openai.com/api/docs/guides/structured-outputs`
  - `https://developers.openai.com/api/reference/resources/responses/methods/create`
  - `https://developers.openai.com/api/docs/guides/tools-computer-use`

## Current Task Notes

- Use Responses API Structured Outputs (`text.format.type = "json_schema"`) rather than older JSON mode.
- Keep model IDs configurable; current reference default for complex reasoning/coding is `gpt-5.5`.
- Strict schemas require required fields; use nullable fields and strip `null` values before local validation/application.
- Set `store: false` for graph-generation requests unless a future product decision needs stored responses.
- Direct browser API key storage remains a personal/BYOK compromise, not ideal for public deployment.
- PDF sample coverage checked:
  - Math 1 pages 280, 284, 286, and 287: line/angle relationships, sectors, solids, and statistical graphs.
  - Math 2 pages 290, 314, 404, and 437: line-intersection graphs, linear-function graph questions, plane-figure reasoning, and triangle similarity.
  - Math 3 pages 7, 287, and 345: number-line radicals, quadratic functions, and trigonometry planning.
- Main gap selected for this pass:
  - First-class `polygon` support with fill/stroke styling and AI parity, because it underpins triangles, quadrilaterals, similarity diagrams, shaded graph regions, and histogram-style bars.
- Validation completed:
  - `npm.cmd test` passed with 27 tests.
  - `git diff --check` passed with line-ending warnings only.
  - Headless Chrome screenshots were captured in `tmp/browser-captures/`.
  - The representative coverage scene created valid polygon, sector, function, number-line, and prism objects with no browser console errors.
- Follow-up coverage still needed:
  - Statistical chart primitives such as histogram, frequency polygon, box plot, dot plot, scatter plot, and table-backed chart helpers.
  - Curved solid primitives such as cylinder, cone, sphere, net, and revolution-style diagrams.

---

## Previous Relevant Skills

- Skill: None required beyond core repo work
- Why it matters:
  - This batch stays within the existing vanilla JS app architecture and does not require a specialized external workflow.

## Repo Notes

- Project-specific conventions:
  - Update task docs before and after feature work.
  - Keep Vercel linkage intact.
  - Do not revert unrelated dirty worktree changes.
- Important directories:
  - `.agent/` for working docs
  - `docs/` for user/developer-facing references
  - `js/` for application runtime
- Known constraints:
  - Multiple core files are already modified in the current worktree.
  - Git remote is currently unset.

## Working Rules

- Do not revert other people's changes.
- Keep edits focused on the task.
- Update the tracking docs as the task evolves.
- Use `implementation_plan.md` only when a fuller roadmap is needed.

## Useful References

- Docs:
  - `docs/ai-reference.md`
  - `.agent/implementation_plan.md`
- Decisions:
  - Finish visible gaps before adding broader new surface area.
- Commands:
  - `git status --short --branch`
  - `npm test`
