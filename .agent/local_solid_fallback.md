# Local Solid Fallback

## Task

- Diagnose why the AI chat returned "요청을 이해하지 못했습니다" for `직육면체 ABCD EFGH 내부에 정육면체가 작게 있는거 그려줘`.
- Add a narrow deterministic fallback so API-free/local mode can draw rectangular prisms and nested small cubes with first-class `prism` objects.

## Plan

1. Confirm the failure path in `AIService.fallbackProcess()`.
2. Add a deterministic solid builder before the legacy fallback examples.
3. Keep all solid output in supported GraphA `point` and `prism` operations.
4. Add focused tests for the exact Korean prompt and a single rectangular prism prompt.
5. Update reference docs/progress notes and run focused plus full validation.

## Acceptance Criteria

- [x] The exact user prompt succeeds in local fallback mode.
- [x] The output creates two `prism` objects and sixteen dependency points.
- [x] The outer prism uses the requested labels `A` through `H`.
- [x] The inner prism remains visibly smaller and inside the outer projection.
- [x] Existing tests continue to pass.

## Notes

- This does not add a new 3D primitive. A cube is represented with the existing `prism` object, matching current MathGraph solid support.
- Curved solids remain out of scope for this fix.
- Root cause: the provider/API-free path reached `fallbackProcess()`, but its deterministic builders did not include rectangular-prism or nested-solid language; the later legacy solid fallback only recognized generic `기둥/각기둥` wording.

## Verification

- `node --check js\ai\AIService.js`
- `node --test tests\ai-flow.test.js`
- `npm.cmd test`
- `npm.cmd run vercel-build`
- `git diff --check`
- Local Playwright smoke on `http://127.0.0.1:4195/`: same prompt created 16 points and 2 prisms with no failure text, console issues, or failed requests.
- Production Playwright smoke on `https://mathgraph-five.vercel.app/`: same prompt created 16 points and 2 prisms, visible outer labels `A` through `H`, no failure text, console issues, or failed requests.
