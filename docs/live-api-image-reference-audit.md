# Live API Image Reference Audit

Date: 2026-05-24

## Purpose

Verify the MathGraph image-reference workflow against real textbook PDF crops, using live OpenAI API calls for image recreation and targeted patch requests.

## Inputs

- Source crops:
  - `tmp/image-reference-pdf-audit/source-crops/01_circle_sector_source.png`
  - `tmp/image-reference-pdf-audit/source-crops/02_solid_source.png`
  - `tmp/image-reference-pdf-audit/source-crops/03_linear_graph_source.png`
  - `tmp/image-reference-pdf-audit/source-crops/04_circle_patch_source.png`
- Model: `gpt-5.5`
- Endpoint: `POST https://api.openai.com/v1/responses`
- API key: provided at runtime only, not written to files.

## Evidence Files

- Browser app live call:
  - `tmp/image-reference-pdf-audit/live-api-app/01_circle_recreate_live_app.json`
  - `tmp/image-reference-pdf-audit/live-api-app/01_circle_recreate_live_app.png`
- Full live API/render audit:
  - `tmp/image-reference-pdf-audit/live-api-service/live-api-service-results.json`
  - `tmp/image-reference-pdf-audit/live-api-contact-sheet.png`
  - `tmp/image-reference-pdf-audit/live-api-service/*.png`

## Prompt And Result Summary

| Case | User prompt | Result | Issue |
| --- | --- | --- | --- |
| Circle recreate | Paste only: recreate circle O with points A-E and arc/sector relations | HTTP 200, 8 operations, schema valid, rendered 8 objects | Circle and points were reconstructed, but arc/sector relations were omitted. |
| Partial patch | Change only selected point A to red and make it larger; keep other points and the circle unchanged | HTTP 200, 4 operations, schema/reference valid, rendered 12 objects | The model did not update point A. It created sector/angle/chord objects from the textbook exercise text instead. |
| Solid recreate | Paste only: recreate the rectangular prism and cylinder source as closely as possible | HTTP 200, 60 operations, schema valid, rendered 60 objects | Rendered, but slow and heavy. Cylinder is approximated because there is no first-class cylinder object. |
| Linear graph recreate | Paste only: recreate the coordinate-plane two-line graph and intersection A(-1, 5) | HTTP 200, 58 operations, schema valid, rendered 58 objects | Main math structure was captured, but the model also generated many low-level grid/axis objects. |

## Verification

- Checked model availability through `GET https://api.openai.com/v1/models`; `gpt-5.5` was available.
- Ran one browser app paste flow with a real API call; response was HTTP 200, 7 objects were created, and no console errors occurred.
- Ran four live `AIService.analyzeImage()` calls through the same Responses API request builder.
- Validated returned payloads with `SchemaValidator`.
- Applied returned payloads to the real MathGraph canvas and captured screenshots.
- Console errors: none in the successful live service run.

## Findings

- The API plumbing is working. Images are sent as data URLs with `input_image`, and strict GraphA `operations[]` output is received and applied.
- The implementation is not yet reliable enough for "exactly edit only this part" without additional guardrails.
- Patch mode especially needs stricter instruction hierarchy and post-validation. The text instruction and selected-object context must override text visible inside the pasted textbook image.
- Recreate mode should add an operation budget and clearer instruction to ignore decorative textbook UI, page text, and dense grids unless the user asks for them.
- Curved solid and chart primitives remain product gaps, not only prompt issues.

## Next Implementation Targets

1. Add patch-mode semantic validation: selected object ids must be updated when the user asks for a selected-object edit.
2. Add a prompt rule: in patch mode, do not solve or copy exercise text from the image unless the user asks.
3. Add a max-operation budget or simplification pass for image recreation.
4. Add first-class cylinder/cone/sphere and chart primitives for textbook parity.
