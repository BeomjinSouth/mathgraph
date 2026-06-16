# Vercel Live OpenAI Proxy Check

## Date

2026-06-16

## Goal

Verify that the production Vercel site can send prior MathGraph drawing prompts through the real OpenAI-backed owner proxy, then compare the rendered GraphA objects against the prompt intent.

## Scope

- Configure Vercel production environment variables needed by the owner OpenAI proxy.
- Do not commit or document secret values.
- Use `https://mathgraph-five.vercel.app` for runtime verification.
- Check more than "output exists": record API response status, object families, visible labels, and screenshot evidence for the prior 9/10-style prompts and the nested prism prompt.

## Findings So Far

- `OPENAI_API_KEY` and `MATHGRAPH_LOGIN_SECRET` are configured in Vercel Production.
- A temporary `MATHGRAPH_OWNER_NAME` environment value can be unsafe when injected through a non-UTF-8 shell path, so the production deployment should rely on the source default owner name instead.
- PowerShell-to-Node inline Playwright scripts must force UTF-8 pipeline encoding or use Unicode escapes for Korean literals, otherwise owner login and prompt text can be mangled before reaching the site.
- `.agents/` reference files are not served in Vercel production, so `AIService` now fetches public runtime copies under `runtime/mathgraph-drawing/references/` first.
- Live OpenAI output can create correct object families while still leaving helper dots or labels visible; `DiagramQualityEnhancer` now normalizes the three audited layouts before rendering.

## Verification Plan

1. Remove `MATHGRAPH_OWNER_NAME` from Vercel Production so the app uses the UTF-8 source default.
2. Redeploy production so the function runtime receives the final environment snapshot.
3. Confirm deployment status, aliases, and HTTP 200.
4. Run Playwright against the production alias in owner mode.
5. Confirm `/api/openai-responses` returns 2xx for each prompt.
6. Inspect object counts and screenshots for:
   - three equal circles with three pairwise lens regions and external `O/P/Q` labels;
   - square pyramid with shaded midsection and dashed height;
   - rectangular prism `ABCDEFGH` containing a smaller cube/prism.

## Completion Criteria

- Live owner login succeeds.
- At least one OpenAI proxy response id is observed per prompt.
- The rendered object families match each prompt's core requirements.
- Remaining visual or semantic issues are recorded before final response.

## Final Result

- Production deployment: `dpl_HUdQoHPYE7KNQNRqLPYX5owaR7Cw`.
- Production alias: `https://mathgraph-five.vercel.app`.
- Runtime references returned 200 for both required JSON files.
- Owner login returned 200 and all three `/api/openai-responses` calls returned 200.
- Observed OpenAI response model: `gpt-5.5-2026-04-23`.
- 9번 three-circle lens prompt: passed after cleanup; visible output has three circles, three shaded lens regions, external `O/P/Q` labels, and no visible center/helper dots.
- 10번 square-pyramid prompt: passed after cleanup; visible output has a first-class pyramid, shaded midsection, dashed height, and only structural vertex labels.
- Nested prism prompt: passed after cleanup; visible output has outer `A` through `H` labels and an unlabeled inner prism.
- Final Playwright run reported no console issues and no failed requests.
