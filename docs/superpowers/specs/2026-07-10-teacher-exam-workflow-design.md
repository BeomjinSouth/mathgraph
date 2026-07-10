# Teacher Exam-Diagram Workflow Design

Date: 2026-07-10

## Goal

Make MathGraph practical for Korean teachers who need an editable mock-exam or CSAT diagram, while explicitly excluding new first-class statistical chart objects from this work.

The selected visual target is `docs/design-references/teacher-workflow/selected-canvas-dock-target.png`: a canvas-first desktop layout with a compact left tool rail, a non-overlapping bottom AI command dock, and a focused right inspector/quality panel.

## Scope

### Included

- A teacher production workspace that preserves a wide canvas at common laptop sizes.
- A bottom AI command dock with visible readiness, progress, success, warning, and retry states.
- A right-side exam QA summary for label crowding, monochrome print suitability, unsupported approximations, and export readiness.
- Named project save/load using portable JSON files while keeping local autosave compatibility.
- HWP/Word-oriented PNG export presets based on physical width and DPI, plus existing SVG and area export.
- Standalone text objects for short annotations, units, and figure notes.
- First-class cylinder, cone, and sphere projections with editable monochrome exam styling.
- Open/closed endpoint semantics for number-line custom marks.
- AI schema parity for function domain/range limits and intersection branch hints.
- Keyboard focus for the canvas and status announcements for non-visual feedback.
- Documentation, tests, production deployment, and Vercel verification.

### Excluded

- First-class histogram, scatter-plot, box-plot, frequency-polygon, or other statistical chart objects.
- Full document/page layout, question-bank management, or collaborative editing.
- General 3D modeling, camera rotation, or physically accurate perspective.
- Pixel-identical copying of textbook pages.
- Arbitrary rich text; standalone text is intentionally short and single-block.

## User Workflow

1. The teacher opens or creates a named project.
2. The teacher pastes a full problem, image, or concise drawing request into the bottom command dock.
3. MathGraph performs a local support preflight before any provider call.
4. The dock shows the current state: checking, generating, repairing, complete, warning, or error.
5. The result appears on the editable canvas without a floating panel covering it.
6. The right panel lists print and approximation checks and offers a focused retry/edit action.
7. The teacher can add or edit standalone annotations and supported curved solids manually.
8. The teacher exports a portable project JSON or an HWP-ready PNG at a selected physical width and DPI.

## Architecture

### Teacher workflow modules

- `js/ui/TeacherWorkflow.js`
  - Owns dock state rendering, support-preflight messages, project-name display, and QA summary rendering.
  - Receives app callbacks instead of reaching into unrelated modules.
- `js/utils/TeacherExport.js`
  - Converts millimetres and DPI to target pixel dimensions.
  - Defines export presets and validates physical export input.
- `js/utils/ProjectFile.js`
  - Creates and validates portable MathGraph project envelopes.
  - Keeps serialization separate from browser download/upload mechanics.
- `js/ai/SupportPreflight.js`
  - Detects known unsupported or approximate request families before generation.
  - Statistical charts are reported as excluded, not silently approximated.

### New editable objects

- `js/objects/TextLabel.js`
  - Short standalone text with position, font size, alignment, and monochrome color.
- `js/objects/CurvedSolid.js`
  - Cylinder, cone, and sphere as deterministic 2D textbook projections.
  - Hidden edges use dashed strokes; these objects remain editable vector geometry.

### Existing integration points

- `ObjectManager`, `SchemaValidator`, `PatchApplier`, `AIService`, and `SceneGraphCompiler` gain the new supported types and fields.
- `main.js` wires the new modules into the existing app lifecycle without taking over their internal responsibilities.
- `index.html` and `css/styles.css` implement the selected canvas-dock layout using the existing visual system.

## Data Contracts

### Project file

```json
{
  "format": "mathgraph-project",
  "version": 1,
  "name": "수학 모의고사 12번",
  "savedAt": "2026-07-10T00:00:00.000Z",
  "view": { "offset": { "x": 0, "y": 0 }, "scale": 50 },
  "objects": []
}
```

Unknown versions and invalid object arrays fail with a Korean error message and do not mutate the current canvas.

### Physical export

`targetPixels = round(widthMm / 25.4 * dpi)`.

Supported preset defaults:

- HWP compact: 80 mm, 300 dpi.
- HWP wide: 120 mm, 300 dpi.
- Print high-resolution: 160 mm, 600 dpi.

The export keeps aspect ratio. Extremely large results are capped with a clear warning rather than allocating an unsafe canvas.

### Curved solids

- `cylinder`: center, radiusX, radiusY, height.
- `cone`: center, radiusX, radiusY, height, apexOffset.
- `sphere`: center, radiusX, radiusY.

All dimensions are positive finite numbers. Default stroke is `#000000`; fill is off unless explicitly requested.

### Number-line endpoints

Custom marks accept `endpoint: "open" | "closed" | null`. Open endpoints render as hollow circles; closed endpoints render as filled circles.

### AI parity

- Function create/update accepts nullable `xMin`, `xMax`, `yMin`, and `yMax`.
- Intersection create accepts nullable `branch`: `first`, `second`, `left`, `right`, `upper`, or `lower`.
- Unsupported chart terms remain warnings in the support preflight.

## Error Handling

- Project import validates completely before applying.
- AI dock errors keep the prompt and expose retry.
- Support warnings never claim exact support for approximated objects.
- Export validation rejects non-finite, non-positive, or over-budget dimensions.
- New object deserialization ignores no required field; it reports invalid project data.
- All multi-object AI changes continue to use history transactions and rollback.

## Accessibility

- The canvas is keyboard-focusable and has concise keyboard instructions.
- Dock state uses `role="status"` and `aria-live="polite"`.
- Error states use `role="alert"`.
- Icon buttons keep accessible Korean names and visible focus rings.
- The 1280 × 720 layout keeps the prompt, primary action, and export control visible without covering the canvas.

## Testing

- Unit tests for project envelopes, physical export math, support preflight, open endpoints, new object serialization, schema validation, and AI patch application.
- Existing full Node test suite after every task group.
- Browser verification at 1600 × 900 and 1280 × 720.
- Design QA compares the selected generated target with the implemented workspace.
- Production smoke checks project import/export controls, AI dock state, canvas focus, and HWP preset visibility.

## Rollout

The work ships in three independently testable commits:

1. Teacher project/export foundation.
2. Text, curved solids, number-line endpoints, and AI schema parity.
3. Canvas-dock UI, support preflight, accessibility, docs, and production deployment.

The existing production behavior remains available throughout; local autosave, PNG/SVG export, and current geometry objects are preserved.
