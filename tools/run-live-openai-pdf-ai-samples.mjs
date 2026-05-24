import { createServer } from 'node:http';
import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

import { extractOpenAIResponseText, stripNullFields } from '../js/ai/AIService.js';
import { parseAIJSONPayload } from '../js/ai/JSONUtils.js';
import { SchemaValidator } from '../js/ai/SchemaValidator.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = path.join(repoRoot, 'tests', 'fixtures', 'pdf-ai-drawing-samples.json');
const outputDir = process.env.LIVE_AI_OUTPUT_DIR
    ? path.resolve(process.env.LIVE_AI_OUTPUT_DIR)
    : path.join(repoRoot, 'tmp', 'live-openai-pdf-ai-samples');
const screenshotDir = path.join(outputDir, 'screenshots');
const endpoint = 'https://api.openai.com/v1/responses';

const cleanText = {
    math3_p0127_radical_number_line: {
        unit: '제곱근과 실수',
        prompt: '수직선에 0, 1, √2를 표시하고, 밑변과 높이가 각각 1인 직각삼각형과 반지름 √2인 원호를 이용해 √2의 위치를 보여줘.'
    },
    math1_p0150_parallel_transversal_angles: {
        unit: '기본 도형',
        prompt: '평행한 두 직선과 한 직선의 횡단선을 그리고, 두 교점에서 같은 위치의 각을 같은 표시로 나타내 평행선에서 생기는 각의 관계를 보여줘.'
    },
    math1_p0156_circle_sector: {
        unit: '평면도형',
        prompt: '중심 O인 원에서 반지름 OA, OB와 작은 호 AB를 그리고, 부채꼴 AOB를 연하게 칠한 뒤 중심각을 표시해줘.'
    },
    math1_p0227_rectangular_prism: {
        unit: '입체도형',
        prompt: '직육면체를 그리고 가로, 세로, 높이 모서리를 표시해줘. 같은 페이지의 원기둥, 원뿔, 구는 현재 지원 범위 밖이라 직육면체 중심으로 표현해줘.'
    },
    math1_p0638_histogram_frequency_polygon: {
        unit: '통계',
        prompt: '계급 0-2, 2-4, 4-6, 6-8의 히스토그램 막대를 그리고, 각 막대 가운데를 이은 도수분포다각형을 함께 그려줘.'
    },
    math2_p0290_linear_graph_intersection: {
        unit: '일차함수와 그래프',
        prompt: '좌표평면에서 두 직선 y=0.5x+1, y=-x+4를 그리고 두 직선의 교점 P를 표시해줘.'
    },
    math2_p0404_triangle_incircle: {
        unit: '삼각형과 사각형의 성질',
        prompt: '삼각형 ABC의 내접원처럼 보이도록 내부의 점 I를 중심으로 원을 그리고, 각 변의 접점 D, E, F와 반지름 IE를 표시해줘.'
    },
    math2_p0437_similarity_triangles: {
        unit: '도형의 닮음과 피타고라스 정리',
        prompt: '서로 닮은 두 삼각형 ABC와 DEF를 나란히 그리고, 대응하는 변과 각을 같은 표시로 나타내줘.'
    },
    math3_p0291_quadratic_function: {
        unit: '이차함수와 그래프',
        prompt: '이차함수 y=x^2-2x-3의 그래프, 대칭축 x=1, 꼭짓점 V, x축과의 교점 하나를 표시해줘.'
    },
    math3_p0354_trig_right_triangle: {
        unit: '삼각비',
        prompt: '직각삼각형 ABC에서 ∠B=90°, ∠A=30°가 보이도록 그리고 빗변과 높이 관계를 표시해줘.'
    },
    math3_p0443_distribution_curves: {
        unit: '대푯값과 산포도',
        prompt: '평균은 같고 산포도가 다른 두 종 모양 곡선을 좌표평면에 겹쳐 그려줘.'
    },
    math3_p0442_scatter_plot: {
        unit: '상관관계',
        prompt: '좌표평면에 오른쪽 위로 올라가는 산점도를 여러 점으로 찍고, 대략적인 추세선을 그려줘.'
    }
};

const compactFormat = {
    type: 'json_schema',
    name: 'graph_operations_compact',
    strict: false,
    schema: {
        type: 'object',
        properties: {
            operations: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        op: { type: 'string', enum: ['create'] },
                        id: { type: 'string' },
                        type: { type: 'string' }
                    },
                    required: ['op', 'id', 'type'],
                    additionalProperties: true
                }
            }
        },
        required: ['operations'],
        additionalProperties: false
    }
};

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
        'gpt-4.1-mini',
        'gpt-4o-mini',
        'gpt-5-mini',
        'gpt-5',
        'gpt-4.1',
        'gpt-4o'
    ].filter(Boolean);
    const models = await openAIRequest(apiKey, 'https://api.openai.com/v1/models', { method: 'GET' });
    const ids = new Set((models.data || []).map(model => model.id));
    for (const model of preferred) {
        if (ids.has(model)) return model;
    }
    return preferred.at(-1);
}

function developerPrompt() {
    return [
        'You convert Korean middle-school math textbook figure requests into GraphA operations JSON.',
        'Return only JSON matching {"operations":[...]} and do not include prose or Markdown.',
        'Every operation must include "op":"create", "id", and "type".',
        'Use exact GraphA field names. Never use aliases such as p1, p2, from, to, points, vertices, center, radius, width, height, or equation.',
        'Create referenced objects before objects that refer to them.',
        'Omit null and unused fields.',
        'Prefer explicit coordinates plus point, segment, line, circle, polygon, arc, sector, function, prism, numberLine, angleDimension, lengthDimension, rightAngleMarker, and equalLengthMarker.',
        'Avoid construction helper types unless every required field is present.',
        'Required field names: point x/y; segment/line point1Id/point2Id; circle centerId/pointOnCircleId; intersection object1Id/object2Id; angleDimension vertexId/point1Id/point2Id; lengthDimension segmentId; polygon vertexIds; arc/sector circleId/startPointId/endPointId/mode; function expression; prism baseVertexIds/topVertexIds; numberLine start/end/step/y.',
        'Valid example: {"operations":[{"op":"create","id":"A","type":"point","x":0,"y":0},{"op":"create","id":"B","type":"point","x":4,"y":0},{"op":"create","id":"AB","type":"segment","point1Id":"A","point2Id":"B"}]}'
    ].join('\n');
}

function sampleMeta(sample) {
    const clean = cleanText[sample.id] || {};
    return {
        id: sample.id,
        pdfKey: sample.pdfKey,
        sourcePage: sample.sourcePage,
        unit: clean.unit || sample.unit,
        promptKo: clean.prompt || sample.promptKo,
        category: sample.category,
        expectedParity: sample.expectedParity
    };
}

function userPrompt(sample, repair = null) {
    const meta = sampleMeta(sample);
    const lines = [
        '[PDF 교과서 그림을 GraphA로 다시 그리기]',
        `sample id: ${meta.id}`,
        `textbook key: ${meta.pdfKey}`,
        `source page: ${meta.sourcePage}`,
        `unit: ${meta.unit}`,
        `non-overlapping category: ${meta.category}`,
        '',
        '그림 요청:',
        meta.promptKo,
        '',
        '요구사항:',
        '1. 위 설명의 수학적 구조가 보이도록 GraphA operations[]를 생성하세요.',
        '2. PDF와 완전히 같은 픽셀 그림이 아니라, 같은 수학 개념을 판별할 수 있는 구조적 재현을 목표로 하세요.',
        '3. 모든 operation에는 반드시 "op":"create"를 넣으세요.',
        '4. 선분/직선은 point1Id/point2Id만 사용하고 p1/p2 같은 별칭은 쓰지 마세요.',
        '5. 모든 참조 id는 앞에서 생성된 객체를 가리키게 하세요.',
        '6. 출력은 JSON 객체 하나만 반환하세요.'
    ];

    if (repair) {
        lines.push(
            '',
            '[이전 응답 수정 요청]',
            '아래 이전 응답은 GraphA 검증에 실패했습니다. 같은 그림 요청을 유지하되 오류를 모두 고친 완전한 operations[] JSON을 다시 반환하세요.',
            '이전 오류:',
            repair.errors.join('\n'),
            '',
            '이전 JSON:',
            JSON.stringify(repair.payload, null, 2)
        );
    }
    return lines.join('\n');
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

async function callSample(apiKey, model, sample, repair = null, attempt = 1) {
    const request = {
        endpoint,
        model,
        developerPrompt: developerPrompt(),
        userPrompt: userPrompt(sample, repair),
        attempt
    };
    const data = await openAIRequest(apiKey, endpoint, {
        method: 'POST',
        body: JSON.stringify({
            model,
            input: [
                { role: 'developer', content: request.developerPrompt },
                { role: 'user', content: request.userPrompt }
            ],
            text: { format: compactFormat },
            temperature: Number(process.env.LIVE_AI_TEMPERATURE || 0),
            max_output_tokens: Number(process.env.LIVE_AI_MAX_OUTPUT_TOKENS || 7000)
        })
    });
    const parsed = parsePayload(data);
    return {
        sample: sampleMeta(sample),
        request,
        response: {
            id: data.id || null,
            model: data.model || model,
            rawText: parsed.rawText,
            payload: parsed.payload
        }
    };
}

function validate(result, validator) {
    const schema = validator.validate(result.response.payload);
    const refs = validator.validateReferences(result.response.payload, new Set());
    return {
        schemaValid: schema.valid,
        schemaErrors: schema.errors,
        referencesValid: refs.valid,
        referenceErrors: refs.errors,
        operationCount: result.response.payload.operations.length
    };
}

async function callWithRetries(apiKey, model, sample, validator) {
    const maxAttempts = Number(process.env.LIVE_AI_MAX_ATTEMPTS || 3);
    let repair = null;
    let result = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        result = await callSample(apiKey, model, sample, repair, attempt);
        result.validation = validate(result, validator);
        if (result.validation.schemaValid && result.validation.referencesValid) return result;
        const errors = [...result.validation.schemaErrors, ...result.validation.referenceErrors];
        console.error(`Validation failed for ${sample.id} on attempt ${attempt}: ${errors.join(' | ')}`);
        repair = { errors, payload: result.response.payload };
    }
    return result;
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
    try {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        await page.goto(url, { waitUntil: 'load' });
        await page.waitForFunction(() => window.app?.objectManager && window.app?.processAIJSON);
        for (const result of results) {
            const renderResult = await page.evaluate((current) => {
                const app = window.app;
                app.objectManager.clear();
                app.historyManager.clear();
                app.canvas.resetView();
                app.canvas.showGrid = false;
                app.canvas.showXAxis = false;
                app.canvas.showYAxis = false;
                let applyError = null;
                try {
                    app.processAIJSON(JSON.stringify(current.response.payload));
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
            const screenshotPath = path.join(screenshotDir, `${result.sample.id}.png`);
            await page.locator('#mainCanvas').screenshot({ path: screenshotPath });
            result.render = {
                ...renderResult,
                screenshotPath: asMarkdownPath(screenshotPath),
                rendered: !renderResult.applyError && renderResult.objectCount > 0 && renderResult.nonWhitePixels >= 100
            };
        }
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
}

function report(meta, results) {
    const lines = [
        '# Live OpenAI PDF AI Drawing Samples',
        '',
        `- generatedAt: ${meta.generatedAt}`,
        `- endpoint: ${endpoint}`,
        `- model: ${meta.model}`,
        '- apiKey: provided via OPENAI_API_KEY, not written to this report',
        '',
        '이 보고서는 OpenAI Responses API를 직접 호출한 프롬프트, 실제 응답 JSON, MathGraph 렌더 결과를 함께 기록한다.',
        ''
    ];
    results.forEach((result, index) => {
        lines.push(`## ${index + 1}. ${result.sample.id}`);
        lines.push('');
        lines.push(`- unit: ${result.sample.unit}`);
        lines.push(`- category: ${result.sample.category}`);
        lines.push(`- responseId: ${result.response.id}`);
        lines.push(`- attempt: ${result.request.attempt}`);
        lines.push(`- validation: schema=${result.validation.schemaValid}, references=${result.validation.referencesValid}, render=${result.render?.rendered}`);
        lines.push(`- screenshot: ${result.render?.screenshotPath || ''}`);
        lines.push('');
        if (result.render?.screenshotPath) lines.push(`![${result.sample.id}](${result.render.screenshotPath})`, '');
        lines.push('### API Prompt', '', '```text', result.request.userPrompt, '```', '');
        lines.push('### API Output', '', '```json', JSON.stringify(result.response.payload, null, 2), '```', '');
    });
    return lines.join('\n');
}

async function main() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is required.');
    const samples = JSON.parse(await readFile(fixturePath, 'utf8'));
    const selected = samples.slice(0, Number(process.env.LIVE_AI_SAMPLE_LIMIT || samples.length));
    const model = await chooseModel(apiKey);
    const validator = new SchemaValidator();
    await mkdir(outputDir, { recursive: true });
    const results = [];
    for (const sample of selected) {
        console.log(`Calling OpenAI for ${sample.id} with ${model}...`);
        results.push(await callWithRetries(apiKey, model, sample, validator));
    }
    await render(results);
    const meta = {
        generatedAt: new Date().toISOString(),
        endpoint,
        model,
        sampleCount: results.length
    };
    const resultPath = path.join(outputDir, 'live-openai-results.json');
    const reportPath = path.join(outputDir, 'live-openai-prompt-output-report.md');
    await writeFile(resultPath, JSON.stringify({ meta, results }, null, 2), 'utf8');
    await writeFile(reportPath, report(meta, results), 'utf8');
    const failures = results.filter(result => !result.validation.schemaValid || !result.validation.referencesValid || !result.render?.rendered);
    console.log(JSON.stringify({
        meta,
        resultPath: asMarkdownPath(resultPath),
        reportPath: asMarkdownPath(reportPath),
        screenshots: asMarkdownPath(screenshotDir),
        failures: failures.map(result => result.sample.id)
    }, null, 2));
    if (failures.length > 0) process.exitCode = 1;
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
