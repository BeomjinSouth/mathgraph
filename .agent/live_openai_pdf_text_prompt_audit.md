# Live OpenAI PDF Text-Prompt Drawing Audit

## Scope

- Task: call an external OpenAI API directly for the PDF-derived MathGraph drawing samples and show the prompt/output evidence.
- Date: 2026-05-24
- Endpoint: `POST https://api.openai.com/v1/responses`
- Model selected by live `GET https://api.openai.com/v1/models`: `gpt-4.1-mini`
- API key handling: the user-provided key was used only through `OPENAI_API_KEY` in the process environment and was not written to project files.

## Inputs

The live run used 12 non-overlapping textbook-style diagram categories from `tests/fixtures/pdf-ai-drawing-samples.json`, but overrode the garbled fixture Korean with clean Korean prompts inside `tools/run-live-openai-pdf-ai-samples.mjs`.

## Outputs

- Full prompt/output report: `tmp/live-openai-pdf-ai-samples/live-openai-prompt-output-report.md`
- Raw sanitized result JSON: `tmp/live-openai-pdf-ai-samples/live-openai-results.json`
- Per-sample screenshots: `tmp/live-openai-pdf-ai-samples/screenshots/*.png`

## Verification

- All 12 final OpenAI responses passed `SchemaValidator.validate()`.
- All 12 final OpenAI responses passed `SchemaValidator.validateReferences()`.
- All 12 final OpenAI responses rendered on the real MathGraph canvas with non-white pixels.
- Four samples needed one validation-repair retry before the final valid output:
  - histogram/frequency polygon
  - triangle incircle
  - quadratic function graph
  - trigonometric right triangle

## Findings

- Direct external API calling works end to end for text-prompt GraphA generation.
- The model can produce renderable GraphA operations, but strict field-name prompting and validation repair are necessary.
- Outputs are structurally similar rather than pixel-identical to the PDF figures.
- Chart-like and curved-solid categories remain approximations because MathGraph does not yet have first-class chart or curved-solid primitives.
