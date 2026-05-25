import { createServer } from 'node:http';
import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

import {
    AIService,
    GRAPH_OPERATIONS_RESPONSE_FORMAT,
    IMAGE_RECREATE_OPERATION_BUDGET,
    extractOpenAIResponseText,
    stripNullFields
} from '../js/ai/AIService.js';
import { parseAIJSONPayload } from '../js/ai/JSONUtils.js';
import { SchemaValidator } from '../js/ai/SchemaValidator.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const referenceIndexPath = path.join(repoRoot, '.agents', 'skills', 'mathgraph-drawing', 'references', 'retrieval-index.json');
const featureManualPath = path.join(repoRoot, '.agents', 'skills', 'mathgraph-drawing', 'references', 'feature-manual.json');
const outputDir = process.env.LIVE_AI_OUTPUT_DIR
    ? path.resolve(process.env.LIVE_AI_OUTPUT_DIR)
    : path.join(repoRoot, 'tmp', 'live-openai-random-drawing-smoke');
const screenshotDir = path.join(outputDir, 'screenshots');
const endpoint = 'https://api.openai.com/v1/responses';

const smokePrompts = [
    {
        id: 'triangle_circumcircle_altitude',
        title: 'Triangle, circumcircle, altitude',
        tags: 'plane triangle circle construction',
        promptKo: '삼각형 ABC를 그리고, 세 점을 지나는 외접원과 C에서 AB로 내린 높이, 높이의 발 H, 직각 표시, 변 AB의 길이 표시를 함께 그려줘.',
        showAxes: false
    },
    {
        id: 'circle_sector_tangent',
        title: 'Circle sector and tangent',
        tags: 'circle sector arc tangent',
        promptKo: '중심 O인 원 위에 점 A, B를 잡고 부채꼴 AOB를 연하게 칠해. 작은 호 AB, 현 AB, 점 A에서의 접선, 중심각 표시를 함께 그려줘.',
        showAxes: false
    },
    {
        id: 'quadratic_line_intersections',
        title: 'Quadratic graph and line',
        tags: 'graph function quadratic line intersection tangent',
        promptKo: '좌표평면에 이차함수 y=x^2-4와 직선 y=x+2를 그리고, 교점들을 표시해. 이차함수의 꼭짓점 V와 x=1에서의 접선도 함께 그려줘.',
        showAxes: true
    },
    {
        id: 'radical_number_line',
        title: 'Radical number line construction',
        tags: 'number_line radical plane construction',
        promptKo: '수직선 -1부터 4까지를 그리고 0, 1, √2를 표시해. 밑변과 높이가 각각 1인 직각삼각형과 반지름 √2에 해당하는 원호로 √2 위치를 설명하는 그림을 그려줘.',
        showAxes: false
    },
    {
        id: 'square_pyramid',
        title: 'Square pyramid',
        tags: 'solid pyramid polygon',
        promptKo: '정사각형 밑면 ABCD와 꼭짓점 V를 가진 사각뿔 V-ABCD를 그려. 보이는 모서리와 숨은 모서리, 밑면의 대각선, 높이처럼 보이는 선분을 함께 표현해줘.',
        showAxes: false
    }
];

const mimeTypes = new Map([
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'application/javascript; charset=utf-8'],
    ['.css', 'text/css; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.svg', 'image/svg+xml'],
    ['.png', 'image/png']
]);

const asMarkdownPath = filePath => path.resolve(filePath).replaceAll(path.sep, '/');

async function openAIRequest(apiKey, url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            ...(options.headers || {})
        }
    });
    const text = await response.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = { raw: text };
    }
    if (!response.ok) {
        const error = new Error(data?.error?.message || text || `OpenAI HTTP ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
    }
    return data;
}

async function chooseModel(apiKey) {
    const preferred = [
        process.env.OPENAI_MODEL,
        'gpt-5.4-mini',
        'gpt-4.1-mini',
        'gpt-5-mini',
        'gpt-4o-mini',
        'gpt-5.5',
        'gpt-4.1',
        'gpt-4o'
    ].filter(Boolean);
    const models = await openAIRequest(apiKey, 'https://api.openai.com/v1/models', { method: 'GET' });
    const ids = new Set((models.data || []).map(model => model.id));
    for (const model of preferred) {
        if (ids.has(model)) return model;
    }
    const fallback = [...ids].find(id => /^gpt-/.test(id) && !/audio|realtime|transcribe|tts|image/i.test(id));
    if (!fallback) {
        throw new Error('No GPT text model was visible to this API key.');
    }
    return fallback;
}

async function buildReferencePrompt(prompt) {
    const [manual, index] = await Promise.all([
        readFile(featureManualPath, 'utf8').then(JSON.parse),
        readFile(referenceIndexPath, 'utf8').then(JSON.parse)
    ]);
    const service = new AIService({
        provider: 'local',
        apiKey: '',
        referenceManual: manual,
        referenceIndex: index
    });
    return service.buildDrawingReferencePromptFromManual(
        manual,
        index,
        `${prompt.tags}\n${prompt.promptKo}`,
        null,
        'recreate'
    );
}

function developerPrompt(referencePrompt = '') {
    return [
        'You convert Korean MathGraph drawing requests into GraphA operations JSON.',
        'Return only a JSON object shaped exactly as {"operations":[...]} with no prose or Markdown.',
        'Use only supported GraphA operation fields. Do not invent aliases such as p1, p2, from, to, points, vertices, center, radius, width, height, equation, or text.',
        'Every referenced id must be created earlier in the same operations array unless it already exists in the canvas context.',
        'Prefer black default geometry. Omit color fields unless a non-black color is explicitly requested.',
        `Keep the drawing at or below ${IMAGE_RECREATE_OPERATION_BUDGET} operations.`,
        'For graph/function prompts, create functions with expression strings only, such as "x^2 - 4". Never include "y=" in a function expression.',
        'For quadratic/parabola prompts, create an actual function object for the parabola; do not approximate it only with points or line segments.',
        'For pointOnCircle, use angle in radians. Do not use t for pointOnCircle.',
        'For sector/arc requests, create distinct start and end points on the circle so the shaded sector has visible area.',
        'For tangent-to-circle requests, prefer tangentCircle with circleId and tangentPointId.',
        'For tangent-to-function requests, prefer tangentFunction with functionId and x.',
        'For chart-like or unsupported details, approximate with points, segments, polygons, numberLine, prism, or pyramid only.',
        referencePrompt
    ].filter(Boolean).join('\n');
}

function repairPrompt(prompt, previousPayload, errors) {
    return [
        prompt.promptKo,
        '',
        '위 요청에 대한 이전 GraphA JSON이 로컬 검증에 실패했습니다.',
        '아래 오류를 모두 고쳐서 {"operations":[...]} JSON만 다시 반환하세요.',
        '',
        'Validation errors:',
        errors.map(error => `- ${error}`).join('\n'),
        '',
        'Previous JSON:',
        JSON.stringify(previousPayload, null, 2)
    ].join('\n');
}

function parsePayload(data) {
    const rawText = extractOpenAIResponseText(data);
    const parsed = data.output_parsed || parseAIJSONPayload(rawText);
    const payload = stripNullFields(Array.isArray(parsed) ? { operations: parsed } : parsed);
    if (!Array.isArray(payload?.operations)) {
        throw new Error('OpenAI response did not contain operations[].');
    }
    return { rawText, payload };
}

export function validatePayload(payload, validator, prompt = null) {
    const schema = validator.validate(payload);
    const refs = validator.validateReferences(payload, new Set());
    const intent = validator.validateIntent(payload, {
        mode: 'recreate',
        maxOperations: IMAGE_RECREATE_OPERATION_BUDGET
    });
    const runtimeErrors = validateRuntimeReadablePayload(payload);
    const semanticErrors = prompt ? validateSmokeSemantics(payload, prompt) : [];
    const errors = [
        ...schema.errors,
        ...refs.errors,
        ...intent.errors,
        ...runtimeErrors,
        ...semanticErrors
    ];
    return {
        schemaValid: schema.valid,
        referencesValid: refs.valid,
        intentValid: intent.valid,
        runtimeReadable: runtimeErrors.length === 0,
        semanticValid: semanticErrors.length === 0,
        valid: schema.valid && refs.valid && intent.valid && runtimeErrors.length === 0 && semanticErrors.length === 0,
        errors,
        operationCount: payload.operations.length
    };
}

export function validateRuntimeReadablePayload(payload) {
    const operations = Array.isArray(payload?.operations) ? payload.operations : [];
    const errors = [];
    operations.forEach((operation, index) => {
        if (operation.type === 'function' && typeof operation.expression === 'string') {
            if (operation.expression.includes('=')) {
                errors.push(`operations[${index}]: function expression must omit "y=" and contain only the right-hand side.`);
            }
        }
        if (operation.type === 'pointOnCircle' && operation.t !== undefined) {
            errors.push(`operations[${index}]: pointOnCircle must use angle in radians; t is ignored by the runtime.`);
        }
    });
    return errors;
}

export function validateSmokeSemantics(payload, prompt) {
    const operations = Array.isArray(payload?.operations) ? payload.operations : [];
    const ctx = buildOperationContext(operations);
    const errors = [];

    if (prompt?.id === 'circle_sector_tangent') {
        const sectors = ctx.byType('sector');
        const arcs = ctx.byType('arc');
        if (sectors.length === 0) {
            errors.push('circle_sector_tangent: expected a sector object for the requested sector AOB.');
        }
        if (arcs.length === 0) {
            errors.push('circle_sector_tangent: expected an arc object for the requested minor arc AB.');
        }

        for (const sector of sectors) {
            const span = angularSpanForCircleRegion(ctx, sector);
            if (!Number.isFinite(span)) {
                errors.push(`circle_sector_tangent: sector "${sector.id || '(no id)'}" must reference resolvable distinct circle start/end points.`);
            } else if (span < 0.15) {
                errors.push(`circle_sector_tangent: sector "${sector.id || '(no id)'}" has near-zero angular span, so it will not appear as a visible sector.`);
            }
            if (sector.fillOpacity !== undefined && sector.fillOpacity <= 0.05) {
                errors.push(`circle_sector_tangent: sector "${sector.id || '(no id)'}" fillOpacity is too low to serve as a visible shaded sector.`);
            }
        }
    }

    if (prompt?.id === 'quadratic_line_intersections') {
        const quadraticFunctions = ctx.byType('function').filter(operation =>
            isQuadraticExpression(operation.expression) && !String(operation.expression || '').includes('=')
        );
        if (quadraticFunctions.length === 0) {
            errors.push('quadratic_line_intersections: expected an actual function object with RHS-only quadratic expression, for example "x^2 - 4".');
        }
        if (ctx.byType('tangentFunction').length === 0) {
            errors.push('quadratic_line_intersections: expected a tangentFunction object for the requested tangent at x=1.');
        }
    }

    return errors;
}

function buildOperationContext(operations) {
    const creates = operations.filter(operation => operation?.op === 'create');
    const byId = new Map();
    for (const operation of creates) {
        if (typeof operation.id === 'string' && operation.id) {
            byId.set(operation.id, operation);
        }
    }
    return {
        creates,
        byId,
        byType(type) {
            return creates.filter(operation => operation.type === type);
        }
    };
}

function angularSpanForCircleRegion(ctx, region) {
    const circle = ctx.byId.get(region.circleId);
    const center = resolvePoint(ctx, circle?.centerId, new Set());
    const start = resolvePoint(ctx, region.startPointId, new Set());
    const end = resolvePoint(ctx, region.endPointId, new Set());
    if (!center || !start || !end) return NaN;
    if (distance(start, end) < 0.05) return 0;
    const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
    const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
    let span = endAngle - startAngle;
    while (span < 0) span += Math.PI * 2;
    while (span >= Math.PI * 2) span -= Math.PI * 2;
    if (region.mode === 'major') {
        return Math.PI * 2 - span;
    }
    return Math.min(span, Math.PI * 2 - span);
}

function resolvePoint(ctx, id, visited) {
    if (!id || visited.has(id)) return null;
    visited.add(id);
    const operation = ctx.byId.get(id);
    if (!operation) return null;
    if (operation.type === 'point') {
        if (!Number.isFinite(operation.x) || !Number.isFinite(operation.y)) return null;
        return { x: operation.x, y: operation.y };
    }
    if (operation.type === 'pointOnCircle') {
        if (!Number.isFinite(operation.angle)) return null;
        const circle = ctx.byId.get(operation.circleId);
        const center = resolvePoint(ctx, circle?.centerId, visited);
        const radiusPoint = resolvePoint(ctx, circle?.pointOnCircleId, visited);
        if (!center || !radiusPoint) return null;
        const radius = distance(center, radiusPoint);
        if (radius <= 0) return null;
        return {
            x: center.x + radius * Math.cos(operation.angle),
            y: center.y + radius * Math.sin(operation.angle)
        };
    }
    return null;
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function isQuadraticExpression(expression) {
    const normalized = String(expression || '').replace(/\s+/g, '').toLowerCase();
    return /x\^2|x\*\*2|x\*x|pow\(x,2\)/.test(normalized);
}

async function callPrompt(apiKey, model, prompt, validator) {
    const maxAttempts = Number(process.env.LIVE_AI_MAX_ATTEMPTS || 3);
    const referencePrompt = await buildReferencePrompt(prompt);
    let previousPayload = null;
    let errors = [];
    let lastResult = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const userText = attempt === 1
            ? prompt.promptKo
            : repairPrompt(prompt, previousPayload, errors);
        const requestBody = {
            model,
            input: [
                { role: 'developer', content: developerPrompt(referencePrompt) },
                { role: 'user', content: userText }
            ],
            store: false,
            text: {
                format: GRAPH_OPERATIONS_RESPONSE_FORMAT
            }
        };
        if (/^(gpt-5|o[1-9]|o\d)/.test(model)) {
            requestBody.reasoning = { effort: 'low' };
            requestBody.text.verbosity = 'low';
        }
        requestBody.max_output_tokens = Number(process.env.LIVE_AI_MAX_OUTPUT_TOKENS || 7000);

        const data = await openAIRequest(apiKey, endpoint, {
            method: 'POST',
            body: JSON.stringify(requestBody)
        });
        const parsed = parsePayload(data);
        const validation = validatePayload(parsed.payload, validator, prompt);
        lastResult = {
            prompt,
            request: {
                endpoint,
                model,
                attempt,
                userPrompt: userText,
                developerPrompt: developerPrompt(referencePrompt)
            },
            response: {
                id: data.id || null,
                model: data.model || model,
                rawText: parsed.rawText,
                payload: parsed.payload
            },
            validation
        };
        if (validation.valid) return lastResult;
        previousPayload = parsed.payload;
        errors = validation.errors;
    }

    return lastResult;
}

function startStaticServer() {
    const server = createServer(async (req, res) => {
        try {
            const rawUrl = new URL(req.url || '/', 'http://127.0.0.1');
            const requested = rawUrl.pathname === '/' ? '/index.html' : decodeURIComponent(rawUrl.pathname);
            const filePath = path.normalize(path.join(repoRoot, requested));
            if (!filePath.startsWith(repoRoot)) {
                res.writeHead(403);
                res.end('Forbidden');
                return;
            }
            const info = await stat(filePath);
            if (!info.isFile()) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': mimeTypes.get(path.extname(filePath)) || 'application/octet-stream' });
            res.end(await readFile(filePath));
        } catch {
            res.writeHead(404);
            res.end('Not found');
        }
    });
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` }));
    });
}

async function chromiumExecutable() {
    if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
    const root = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
    const candidates = [];
    try {
        for (const entry of await readdir(root, { withFileTypes: true })) {
            if (!entry.isDirectory() || !entry.name.startsWith('chromium')) continue;
            candidates.push(
                path.join(root, entry.name, 'chrome-win', 'chrome.exe'),
                path.join(root, entry.name, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe')
            );
        }
    } catch {
        return null;
    }
    candidates.sort().reverse();
    for (const candidate of candidates) {
        try {
            await access(candidate);
            return candidate;
        } catch {
            // Try the next locally installed browser.
        }
    }
    return null;
}

async function render(results) {
    await mkdir(screenshotDir, { recursive: true });
    const { server, url } = await startStaticServer();
    const executablePath = await chromiumExecutable();
    const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const consoleErrors = [];
    try {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        page.on('console', message => {
            if (message.type() === 'error') consoleErrors.push(message.text());
        });
        await page.goto(url, { waitUntil: 'load' });
        await page.waitForFunction(() => window.app?.objectManager && window.app?.processAIJSON);
        await page.addStyleTag({
            content: '.canvas-controls, #chat-panel { display: none !important; }'
        });
        for (const result of results) {
            const renderResult = await page.evaluate((current) => {
                const app = window.app;
                app.objectManager.clear();
                app.historyManager.clear();
                app.canvas.resetView();
                app.canvas.showGrid = current.prompt.showAxes;
                app.canvas.showXAxis = current.prompt.showAxes;
                app.canvas.showYAxis = current.prompt.showAxes;
                let applyError = null;
                try {
                    app.processAIJSON(JSON.stringify(current.response.payload), {
                        mode: 'recreate',
                        maxOperations: 45
                    });
                    app.render();
                } catch (error) {
                    applyError = error.message;
                    app.render();
                }
                const canvas = document.getElementById('mainCanvas');
                const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
                let nonWhitePixels = 0;
                for (let i = 0; i < pixels.length; i += 4) {
                    if (pixels[i] < 248 || pixels[i + 1] < 248 || pixels[i + 2] < 248) nonWhitePixels += 1;
                }
                const objects = app.objectManager.getAllObjects();
                return {
                    applyError,
                    objectCount: objects.length,
                    visibleObjectCount: objects.filter(object => object.visible !== false).length,
                    nonWhitePixels
                };
            }, result);
            const screenshotPath = path.join(screenshotDir, `${result.prompt.id}.png`);
            await page.locator('#mainCanvas').screenshot({ path: screenshotPath });
            result.render = {
                ...renderResult,
                screenshotPath: asMarkdownPath(screenshotPath),
                rendered: !renderResult.applyError && renderResult.objectCount > 0 && renderResult.nonWhitePixels >= 100
            };
        }

        const contactSheetPath = path.join(outputDir, 'contact-sheet.png');
        const cards = await Promise.all(results.map(async result => {
            const imageData = await readFile(path.resolve(result.render.screenshotPath));
            const imageUrl = `data:image/png;base64,${imageData.toString('base64')}`;
            return `
                <figure>
                    <img src="${imageUrl}" alt="${result.prompt.id}">
                    <figcaption>${result.prompt.title}<br>${result.validation.operationCount} ops, ${result.render.objectCount} objects</figcaption>
                </figure>
            `;
        }));
        await page.setContent(`
            <!doctype html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #f5f5f5; color: #111; }
                    h1 { margin: 0 0 16px; font-size: 20px; }
                    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
                    figure { margin: 0; background: #fff; border: 1px solid #ddd; padding: 8px; }
                    img { display: block; width: 100%; height: auto; border: 1px solid #eee; }
                    figcaption { padding-top: 6px; font-size: 12px; line-height: 1.35; }
                </style>
            </head>
            <body>
                <h1>Live OpenAI Random MathGraph Smoke</h1>
                <div class="grid">${cards.join('\n')}</div>
            </body>
            </html>
        `, { waitUntil: 'load' });
        await page.screenshot({ path: contactSheetPath, fullPage: true });
        return {
            contactSheetPath: asMarkdownPath(contactSheetPath),
            consoleErrors
        };
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
}

function report(meta, results) {
    const lines = [
        '# Live OpenAI Random MathGraph Smoke',
        '',
        `- generatedAt: ${meta.generatedAt}`,
        `- endpoint: ${endpoint}`,
        `- model: ${meta.model}`,
        '- apiKey: provided via OPENAI_API_KEY, not written to this report',
        `- contactSheet: ${meta.contactSheetPath}`,
        '',
        'This report records real OpenAI Responses API calls, local GraphA validation, and browser canvas render results.',
        ''
    ];
    for (const result of results) {
        lines.push(`## ${result.prompt.id}`);
        lines.push('');
        lines.push(`- title: ${result.prompt.title}`);
        lines.push(`- responseId: ${result.response.id}`);
        lines.push(`- attempt: ${result.request.attempt}`);
        lines.push(`- validation: schema=${result.validation.schemaValid}, references=${result.validation.referencesValid}, intent=${result.validation.intentValid}, runtime=${result.validation.runtimeReadable}, semantic=${result.validation.semanticValid}`);
        lines.push(`- render: rendered=${result.render?.rendered}, objects=${result.render?.objectCount}, nonWhitePixels=${result.render?.nonWhitePixels}`);
        lines.push(`- screenshot: ${result.render?.screenshotPath}`);
        if (result.validation.errors.length > 0) {
            lines.push(`- validationErrors: ${result.validation.errors.join(' | ')}`);
        }
        lines.push('');
        lines.push('### Prompt', '', '```text', result.prompt.promptKo, '```', '');
        lines.push('### Operations', '', '```json', JSON.stringify(result.response.payload, null, 2), '```', '');
    }
    return lines.join('\n');
}

async function main() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is required.');

    await mkdir(outputDir, { recursive: true });
    const validator = new SchemaValidator();
    const model = await chooseModel(apiKey);
    const limit = Number(process.env.LIVE_AI_SAMPLE_LIMIT || smokePrompts.length);
    const selectedPrompts = smokePrompts.slice(0, limit);
    const results = [];

    for (const prompt of selectedPrompts) {
        console.log(`Calling OpenAI for ${prompt.id} with ${model}...`);
        results.push(await callPrompt(apiKey, model, prompt, validator));
    }

    const renderMeta = await render(results);
    const meta = {
        generatedAt: new Date().toISOString(),
        endpoint,
        model,
        promptCount: results.length,
        contactSheetPath: renderMeta.contactSheetPath,
        consoleErrorCount: renderMeta.consoleErrors.length,
        consoleErrors: renderMeta.consoleErrors
    };
    const resultPath = path.join(outputDir, 'live-openai-random-results.json');
    const reportPath = path.join(outputDir, 'live-openai-random-report.md');
    await writeFile(resultPath, JSON.stringify({ meta, results }, null, 2), 'utf8');
    await writeFile(reportPath, report(meta, results), 'utf8');

    const failures = results.filter(result =>
        !result.validation.valid ||
        !result.render?.rendered
    );

    console.log(JSON.stringify({
        meta,
        resultPath: asMarkdownPath(resultPath),
        reportPath: asMarkdownPath(reportPath),
        screenshotDir: asMarkdownPath(screenshotDir),
        failures: failures.map(result => result.prompt.id)
    }, null, 2));

    if (failures.length > 0 || renderMeta.consoleErrors.length > 0) {
        process.exit(1);
    }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
    main().catch(error => {
        console.error(error.message);
        process.exit(1);
    });
}
