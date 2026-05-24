# PDF AI Drawing Audit

## Summary

- Task: Teacher-guide PDF diagram sampling and MathGraph AI drawing parity check
- Owner: Codex
- Date: 2026-05-24
- Related inputs:
  - `중_수학1(김화경)_지도서.pdf`
  - `중등_수학2_류희찬(15개정)_지도서.pdf`
  - `중등_수학3_이준열(15개정)_지도서.pdf`

## Goal

Sample several non-overlapping diagram categories from the local middle-school teacher-guide PDFs, convert each sampled diagram into a Korean AI drawing request, generate a validated GraphA `operations[]` payload, and check whether MathGraph can render the same mathematical structure.

## Scope

- Include representative textbook diagram categories rather than every page.
- Prefer categories that map to different MathGraph object families:
  - number lines
  - coordinate/function graphs
  - plane geometry
  - circles/sectors
  - solid figures
  - statistics/chart-style diagrams
- Treat the large PDF files as local source inputs only; do not commit them.

## Method

1. Read the project operating docs and MathGraph drawing references.
2. Use PyMuPDF to inspect PDF page counts, search candidate unit keywords, and render candidate sample pages.
3. Select non-overlapping samples by unit/category.
4. Write Korean prompt requests and corresponding GraphA `operations[]` patches.
5. Validate every patch against the current `SchemaValidator`.
6. Render representative patches in the browser and compare visually against the PDF samples.

## Parity Scale

- `match`: MathGraph can reproduce the same mathematical structure with current first-class objects.
- `structural_match`: Mathematical relations match, but textbook layout/text styling differs.
- `approximation`: The figure is representable only by composing lower-level objects.
- `gap`: Current runtime lacks a needed primitive or schema capability.

## Expected Constraints

- Exact pixel-level equality is not expected because the app recreates vector math objects rather than cloning textbook artwork.
- Histogram, scatter, box-plot, curved-solid, and free text label primitives remain known gaps unless approximated with polygons, segments, labels attached to objects, or supported solid primitives.

## Completion Notes

- Selected 12 non-overlapping sample categories across the three PDFs.
- Added reusable sample fixture: `tests/fixtures/pdf-ai-drawing-samples.json`.
- Added validation coverage: `tests/pdf-ai-drawing-samples.test.js`.
- Added browser render helper: `tools/render-pdf-ai-drawing-samples.mjs`.
- Wrote the human-readable audit report: `docs/pdf-ai-drawing-sample-audit.md`.
- Rendered screenshot contact sheet: `tmp/browser-captures/pdf-ai-drawing-samples/contact-sheet.png`.

## Verification Results

- `npm.cmd test`: passed with 32 tests.
- `node tools\render-pdf-ai-drawing-samples.mjs`: passed with 12 rendered samples and 0 failures.

## Follow-up

- Add first-class chart primitives before expecting exact histogram, frequency polygon, scatter plot, or box plot parity.
- Add curved solid primitives before expecting exact cylinder, cone, or sphere parity.
- Add independent text-label objects for closer textbook layout recreation.
