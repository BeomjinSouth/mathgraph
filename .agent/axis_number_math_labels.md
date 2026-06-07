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
  - `npx.cmd vercel inspect https://mathgraph-five.vercel.app`; production deployment `dpl_14iiHaoC4MGXCYxbWNks5ptXj7ad` was `Ready` with the primary alias attached.
  - `https://mathgraph-five.vercel.app/`; returned HTTP 200.
  - Playwright production smoke on `https://mathgraph-five.vercel.app/`; axis labels rendered through the math font path, math minus code `8722` was present, ASCII hyphen code `45` was absent, origin `O` rendered through the math font path, and there were 0 console issues / 0 failed requests.

## Notes

- Browser plugin use was attempted first, but the required Node REPL JavaScript execution tool was not exposed in this session. Playwright was used as the rendered-validation fallback.
- Manual Vercel deploy was not run from this task turn, but the production alias was inspected after the branch update and the live site contains the axis-number math-label behavior.

## Follow-up: Axis Arrow Reference-Style Refinement

- Date: 2026-06-05
- User request:
  - The previous filled arrowheads are present, but the shape still differs from the provided reference.
- Plan:
  - Centralize axis-arrow metrics.
  - Make the arrowheads slimmer, longer, and closer to the canvas or crop edge.
  - Keep canvas, SVG, and drag-area export overlays visually aligned.
- Result:
  - Canvas, SVG, and drag-area PNG overlays now share one refined axis-arrow metric set.
  - Arrowheads are slimmer and closer to the selected area's edge or canvas edge.
  - Local and production download smokes confirmed the refined edge-arrow behavior.

## Follow-up: Axis Arrows And Fixed Grid Interval

- Date: 2026-06-03
- User request:
  - Make x/y axis arrowheads and labels look like the provided textbook-style reference: a solid arrowhead with italic serif `x` and `y` labels near the arrow tips.
  - When `축 숫자 간격` is fixed to `1` or another numeric interval, keep the grid at that same math-unit interval while zooming in or out.

## Follow-up Plan

1. Add a shared grid-gap resolver so automatic mode keeps zoom-adaptive grid spacing and fixed axis-number mode also fixes the grid interval.
2. Update canvas axis rendering to use filled arrowheads and italic serif axis labels.
3. Keep SVG export grid/axis rendering aligned with the canvas behavior.
4. Add focused tests for fixed grid spacing and axis arrow/label drawing calls.

## Follow-up: Drag-Area Export Axis Arrowheads

- Date: 2026-06-04
- User request:
  - When saving only a dragged area, the x/y axis arrowheads should still appear.
  - If an axis crosses the selected area, its arrowhead should be drawn at the selected area's edge.
- Result:
  - PNG area export overlays crop-edge axis arrows only for axes that cross the selected rectangle.
  - SVG area export draws vector x/y arrowheads at the crop viewBox right/top edges.
  - Local and production drag/download smokes confirmed the saved crop contains the new axis-end arrows.
