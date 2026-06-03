# Axis Number Math Labels

## Task

- Date: 2026-06-03
- User request: Coordinate-axis numbers and tick-interval labels should render like LaTeX/math labels, not plain canvas UI text.

## Scope

- Update coordinate-axis numeric labels to use the existing MathGraph math-label parser and renderer.
- Preserve the current axis number visibility toggle and fixed/automatic interval behavior.
- Keep tick marks, axis drawing, settings persistence, function rendering, and GraphA schemas unchanged.

## Plan

1. Reuse `Canvas.parseMathExpression()`, `measureMathExpression()`, and `renderMathExpression()` for axis numbers.
2. Add a small axis-number alignment helper so x-axis, y-axis, and origin labels keep their current placement.
3. Update focused axis-label tests to check math-rendered minus signs and math font usage.
4. Run focused tests, full tests, build/whitespace checks, and rendered browser smoke.

## Acceptance

- Negative axis numbers render with the math minus glyph instead of ASCII `-`.
- Axis numbers use the same math font path as function labels.
- Hiding axis numbers still keeps tick marks visible.
- Existing interval values such as `0.1`, `1`, and `2` remain unchanged.

## Result

- State: Done locally.
- Code changed:
  - `js/core/Canvas.js`
  - `tests/axis-label-settings.test.js`
- Verification:
  - `node --check js\core\Canvas.js`; passed.
  - `node --test tests\axis-label-settings.test.js`; passed with 4 tests.
  - `node --test tests\math-label-rendering.test.js`; passed with 6 tests.
  - Playwright local smoke on `http://127.0.0.1:4191/`; axis labels rendered through the math font path, math minus code `8722` was present, ASCII hyphen code `45` was absent, origin `O` rendered through the math font path, and there were 0 console issues / 0 failed requests.
  - `npm.cmd test`; passed with 160 tests.
  - `npm.cmd run vercel-build`; passed.
  - `git diff --check`; passed with line-ending warnings only.

## Notes

- Browser plugin use was attempted first, but the required Node REPL JavaScript execution tool was not exposed in this session. Playwright was used as the rendered-validation fallback.
- Manual Vercel deploy was not run from the dirty workspace because unrelated in-progress files are currently present and a direct deploy would include them.
