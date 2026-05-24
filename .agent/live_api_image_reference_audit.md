# Live API Image Reference Audit

## Summary

- Task: Verify the image paste/recreate and targeted patch workflow with real external OpenAI API calls.
- Date: 2026-05-24
- Model used: `gpt-5.5`
- API key handling: user-provided key was used only through process/browser memory during the test and was not written to project files.
- Source images: local textbook PDF crops under `tmp/image-reference-pdf-audit/source-crops/`.
- Evidence:
  - `tmp/image-reference-pdf-audit/live-api-app/01_circle_recreate_live_app.json`
  - `tmp/image-reference-pdf-audit/live-api-service/live-api-service-results.json`
  - `tmp/image-reference-pdf-audit/live-api-contact-sheet.png`

## What Was Tested

1. Browser app image paste flow with a real OpenAI request.
2. Direct `AIService.analyzeImage()` live OpenAI calls using the same Responses API request builder.
3. Returned GraphA `operations[]` validation through `SchemaValidator`.
4. Returned GraphA JSON application on the real MathGraph canvas.
5. Screenshot capture and non-white-pixel smoke checks.

## Results

| Case | Prompt | API result | Render result | Judgment |
| --- | --- | --- | --- | --- |
| Circle recreate | Paste only: recreate circle O with points A-E and related arc/sector structure | HTTP 200, 8 operations, schema valid | 8 objects, rendered | Flow works, but model only recreated circle and points, missing arc/sector semantics. |
| Partial patch | Change only selected point A to red and make it larger; keep other points and the circle unchanged | HTTP 200, 4 operations, schema/reference valid | 12 objects, rendered | Technically valid, semantically wrong: model ignored selected-point edit and created textbook exercise structures instead. |
| Solid recreate | Paste only: recreate rectangular prism/cylinder source | HTTP 200, 60 operations, schema valid | 60 objects, rendered | Rendered, but slow and heavy. Cylinder remains an approximation because no first-class cylinder primitive exists. |
| Linear graph recreate | Paste only: recreate two lines and intersection A(-1, 5) | HTTP 200, 58 operations, schema valid | 58 objects, rendered | Good mathematical reconstruction, but overproduces grid/axis objects. |

## Findings

- The external API integration works: the key was accepted, `gpt-5.5` was available, Responses API calls returned HTTP 200, `store:false`, strict `graph_operations` output, and `input_image` with `detail:"high"` were sent.
- The browser app can call OpenAI directly and apply the result; the first live browser paste created 7 objects with no console errors.
- Recreate mode is usable for simple diagrams, but fidelity varies. The model recognizes core geometry, yet it may omit textbook substructures such as arcs, sectors, and construction annotations.
- Patch mode needs stronger guardrails. With a selected object and a text instruction, the model still followed the source image's exercise text and generated new objects instead of updating the selected point.
- Complex textbook images can produce too many low-level objects. The solid and graph cases rendered, but operation counts were high and response latency was long.
- Current runtime limitations are visible in real API output: curved solids and chart-like diagrams still need either first-class primitives or explicit approximation policy.

## Recommended Follow-Up

1. Strengthen image patch prompts so text instructions outrank image exercise text.
2. Add patch-mode post-validation: if selected ids exist, require at least one `update`/`delete` targeting selected ids unless the user explicitly asks to create new objects.
3. Add an operation-count budget for image recreation and ask the model to ignore decorative grids/UI screenshots unless requested.
4. Add first-class cylinder/cone/sphere and chart primitives before expecting high textbook fidelity for those categories.
5. Keep direct browser OpenAI usage limited to personal BYOK testing; use a server-side proxy before shared classroom deployment.
