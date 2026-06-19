# Problem Text Exam Diagram Mode

## Goal

Allow a user to paste a complete Korean math exam problem into the existing AI chat and receive an editable MathGraph diagram for the problem statement, not a solution or answer.

## Scope

- Detect full problem statements inside the existing chat flow and route them to an internal `problem_diagram` mode.
- Keep the output contract unchanged: `{ "operations": [...] }`.
- Use the existing OpenAI Responses API, owner proxy, strict GraphA structured output, repair, and renderer pipeline.
- Prefer monochrome exam-style diagrams with short labels, hidden helper points, and no copied problem prose or answer choices.
- Use deterministic fallback only when a known local pattern is recognized. Otherwise require an OpenAI/Gemini connection for whole-problem interpretation.

## Out Of Scope

- No new server API.
- No new Vercel environment variable.
- No new image-generation route.
- No unsupported primitive expansion for histogram, scatter, box plot, cylinder, cone, or sphere in v1.

## Implementation Plan

1. Add `problem_diagram` as an internal AI command mode selected by full-problem detection.
2. Strengthen the problem prompt so the model extracts drawable mathematical structure and avoids solving, answer text, and copied prose.
3. Prioritize graph, plane geometry, circle, number line, solid, marker, and known-gap references for problem mode.
4. Add semantic validation for problem diagrams:
   - non-empty visible diagram,
   - no solution/prose/answer-choice text objects,
   - at least one object family matching the problem domain.
5. Reuse the existing one-shot repair flow when schema, reference, or semantic validation fails.
6. Surface a small UI meta message: `문제그림 모드로 생성됨`.

## Acceptance Criteria

- Full Korean problem text routes to `problem_diagram`.
- Short drawing commands still route to `command`.
- A whole problem without provider credentials returns a clear connection-required message unless deterministic fallback succeeds.
- Problem diagrams that contain solution prose or answer choices fail semantic validation and trigger one repair attempt.
- Existing command and image recreation flows remain compatible.

## Verification Plan

- Unit tests for mode detection, prompt/reference selection, no-key failure, OpenAI success, semantic repair, and prose rejection.
- Fixture tests for representative Korean problem categories.
- Project checks: `node --check`, `node --test`, `npm.cmd test`, `npm.cmd run vercel-build`, `git diff --check`.
- Production deployment and smoke check after implementation.
