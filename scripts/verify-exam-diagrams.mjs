import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import os from 'node:os';
import { buildExamDiagramCases } from './exam-diagram-cases.mjs';
import { buildComplexExamDiagramCases } from './complex-exam-diagram-cases.mjs';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const argv = process.argv.slice(2);
const flag = (name, fallback) => argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback;
const phase = flag('--phase', 'baseline');
const split = flag('--split', 'all');
const suite = flag('--suite', 'original');
if (!['original', 'complex'].includes(suite)) throw Error(`Unknown suite: ${suite}`);
const generatedCases = suite === 'complex' ? buildComplexExamDiagramCases() : buildExamDiagramCases();
const output = path.resolve(root, flag('--output', `output/exam-diagrams-${suite}/${phase}`));
const input = flag('--input', null);
const custom = input ? JSON.parse(await fs.readFile(path.resolve(input), 'utf8')) : null;
const cases = argv.includes('--app-only') ? [] : custom ? [{ id: 'custom-1', family: '사용자 도형', title: '입력 도형 검수', split: 'custom', conditions: custom.conditions || [],
        preserveExplicitOffsets: !argv.includes('--generated'),
        view: { width: 700, height: 600, scale: 48, offset: { x: 0, y: 0 }, ...custom.view }, operations: custom.operations }]
    : generatedCases.filter(c => split === 'all' || c.split === split);
await fs.mkdir(output, { recursive: true });
const server = http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url, 'http://127.0.0.1');
        if (url.pathname === '/lab') {
            res.setHeader('content-type', 'text/html');
            res.end('<!doctype html><meta charset="utf-8"><title>MathGraph 도형 검수</title><div><canvas></canvas></div>');
            return;
        }
        const filename = path.resolve(root, url.pathname === '/' ? 'index.html' : '.' + decodeURIComponent(url.pathname));
        if (!filename.startsWith(root + path.sep) || url.pathname.includes('/.git') || url.pathname.includes('/.env')) {
            res.writeHead(403).end();
            return;
        }
        const data = argv.includes('--original-code') && url.pathname.startsWith('/js/')
            ? execFileSync('git', ['show', `a370cb0:${url.pathname.slice(1)}`], { cwd: root, maxBuffer: 4 * 1024 * 1024 })
            : await fs.readFile(filename);
        const type = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' }[path.extname(filename)] || 'application/octet-stream';
        res.setHeader('content-type', type);
        res.end(data);
    }
    catch {
        res.writeHead(404).end();
    }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
    browser = await chromium.launch({ channel: process.env.EXAM_BROWSER_CHANNEL || 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1000, height: 760 }, deviceScaleFactor: 1 });
    const consoleErrors = [];
    page.on('pageerror', error => consoleErrors.push(error.message));
    await page.goto(url + '/lab');
    await page.evaluate(async () => { window.renderCase = (await import('/scripts/exam-diagram-browser.mjs')).renderExamCase; });
    const results = [];
    for (const source of cases) {
        const result = await page.evaluate(source => window.renderCase(source), source);
        if (result.image) {
            await fs.writeFile(path.join(output, source.id + '.png'), Buffer.from(result.image.split(',')[1], 'base64'));
            delete result.image;
        }
        if (result.project) {
            await fs.writeFile(path.join(output, source.id + '.mathgraph.json'), JSON.stringify(result.project, null, 2));
            delete result.project;
        }
        if (result.prepared) {
            await fs.writeFile(path.join(output, source.id + '.graphA.json'), JSON.stringify(result.prepared, null, 2));
            delete result.prepared;
        }
        await fs.writeFile(path.join(output, source.id + '.source.json'), JSON.stringify(source, null, 2));
        results.push(result);
        if (results.length % 10 === 0)
            console.log(`${phase}: ${results.length}/${cases.length}`);
    }
    const byCode = {};
    for (const r of results)
        for (const i of r.issues || [])
            byCode[i.code] = (byCode[i.code] || 0) + 1;
    const summary = { phase, split, suite, sourceHash: createHash('sha256').update(JSON.stringify(cases)).digest('hex'),
        rendererRevision: argv.includes('--original-code') ? 'a370cb0' : 'working-tree',
        caseCount: results.length, familyCount: new Set(results.map(r => r.family)).size,
        failedCases: results.filter(r => r.errors?.length || r.issues?.length).length, byCode, consoleErrors };
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ summary, results }, null, 2));
    if (suite === 'complex' && argv.includes('--mutation-audit')) {
        const mutations = [
            { id: 'C001', change: source => { source.operations.find(op => op.id === 'equalACBC').tickCount = 2; },
                expected: 'equal-length-mismatch' },
            { id: 'C001', change: source => { source.operations.find(op => op.id === 'ang_BAC').markerCount = 2; },
                expected: 'equal-angle-mismatch' },
            { id: 'C016', change: source => { source.conditions.find(c => c.kind === 'solid-edges').hidden = []; },
                expected: 'solid-edge-style-mismatch' },
            { id: 'C022', change: source => { source.operations.find(op => op.id === 'area').xMax = 0.5; },
                expected: 'function-region-boundary-mismatch' }
        ];
        const checked = [];
        for (const mutation of mutations) {
            const source = structuredClone(generatedCases.find(c => c.id === mutation.id));
            mutation.change(source);
            const result = await page.evaluate(source => window.renderCase(source), source);
            const actual = (result.issues || []).map(issue => issue.code);
            checked.push({ id: mutation.id, expected: mutation.expected, detected: actual.includes(mutation.expected) });
        }
        await fs.writeFile(path.join(output, 'mutation-audit.json'), JSON.stringify(checked, null, 2));
        if (checked.some(item => !item.detected)) {
            console.error('Mutation audit missed a deliberate error:', checked.filter(item => !item.detected));
            process.exitCode = 1;
        }
    }
    // Contact sheets use the actual exported canvases, without re-drawing the diagrams.
    for (let start = 0; start < results.length; start += 12) {
        const part = results.slice(start, start + 12);
        const images = await Promise.all(part.map(async (r) => ({ id: r.id, title: r.title, image: 'data:image/png;base64,' + (await fs.readFile(path.join(output, r.id + '.png'))).toString('base64') })));
        const sheet = await page.evaluate(async (images) => {
            const c = document.createElement('canvas');
            c.width = 1500;
            c.height = Math.ceil(images.length / 3) * 460;
            const ctx = c.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, c.width, c.height);
            for (let i = 0; i < images.length; i++) {
                const x = (i % 3) * 500, y = Math.floor(i / 3) * 460;
                const img = new Image();
                img.src = images[i].image;
                await img.decode();
                ctx.drawImage(img, x, y + 30, 500, 500 * img.height / img.width);
                ctx.fillStyle = '#000';
                ctx.font = '17px sans-serif';
                ctx.fillText(images[i].id + ' ' + images[i].title, x + 10, y + 22);
                ctx.strokeStyle = '#bbb';
                ctx.strokeRect(x, y, 500, 460);
            }
            return c.toDataURL();
        }, images);
        await fs.writeFile(path.join(output, `sheet-${String(start / 12 + 1).padStart(2, '0')}.png`), Buffer.from(sheet.split(',')[1], 'base64'));
    }
    console.log(JSON.stringify(summary, null, 2));
    if (argv.includes('--app-check') || argv.includes('--app-only')) {
        const appPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        const errors = [];
        appPage.on('pageerror', error => errors.push(error.message));
        await appPage.goto(url + '/');
        await appPage.waitForFunction(() => window.app?.canvas?.width > 0);
        await appPage.locator('#guestLoginButton').click();
        const checks = [];
        const appIds = suite === 'complex'
            ? ['C001', 'C006', 'C017', 'C020', 'C022', 'C026', 'C039', 'C045']
            : ['E014', 'E042', 'E055', 'E071', 'E096', 'E100'];
        for (const id of appIds) {
            const source = generatedCases.find(c => c.id === id);
            const checked = await appPage.evaluate(async (source) => {
                const app = window.app;
                app.objectManager.clear();
                app.historyManager.clear();
                app.canvas.scale = source.view.scale;
                app.canvas.offset.x = 0;
                app.canvas.offset.y = 0;
                const input = { operations: source.operations };
                const before = JSON.stringify(input);
                const payload = app.aiService.enhanceDiagramQuality(input, source.prompt || '시험 도형', app.buildAIContext());
                if (JSON.stringify(input) !== before)
                    throw Error('source was mutated');
                if (!app.processAIJSON(JSON.stringify(payload), { mode: 'command' }))
                    throw Error('app rejected ' + source.id);
                if (source.operations.some(operation => operation.type === 'functionRegion')) {
                    const svg = app.buildSVGMarkup({ includeAxes: false, includeBackground: true });
                    const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
                    const areaPath = document.querySelector('path[data-type="functionRegion"]');
                    if (!areaPath || areaPath.getAttribute('fill-opacity') !== '0.2' ||
                        areaPath.getAttribute('stroke') !== 'none')
                        throw Error('SVG area missing or not filled');
                }
                const count = app.objectManager.getAllObjects().length;
                // Re-created objects have a new creation timestamp, which is not a visual edit.
                const serialize = () => JSON.stringify(app.objectManager.toJSON(), (key, value) => key === 'createdAt' ? undefined : value);
                const state = serialize();
                app.historyManager.undo();
                if (app.objectManager.getAllObjects().length !== 0)
                    throw Error('undo failed');
                app.historyManager.redo();
                if (serialize() !== state) {
                    const old = JSON.parse(state).objects, current = app.objectManager.toJSON().objects;
                    const differences = old.flatMap((o, i) => Object.keys(o).filter(k => JSON.stringify(o[k]) !== JSON.stringify(current[i]?.[k])).map(k => ({ index: i, type: o.type, key: k, before: o[k], after: current[i]?.[k] })));
                    throw Error('redo changed layout: ' + JSON.stringify(differences));
                }
                const saved = app.buildProjectEnvelope();
                const image = document.createElement('canvas');
                app.renderSceneToCanvas(image, { includeGrid: false, includeAxes: false, includeBackground: true });
                const pixels = image.toDataURL();
                await app.importProjectFile(new File([JSON.stringify(saved)], source.id + '.mathgraph.json', { type: 'application/json' }));
                if (serialize() !== state)
                    throw Error('project import changed layout');
                const restored = document.createElement('canvas');
                app.renderSceneToCanvas(restored, { includeGrid: false, includeAxes: false, includeBackground: true });
                if (pixels !== restored.toDataURL())
                    return { id: source.id, error: 'export pixels changed after import', before: pixels, after: restored.toDataURL() };
                return { id: source.id, objectCount: count, undoRedo: true, importExport: true };
            }, source);
            if (checked.error) {
                await fs.writeFile(path.join(output, 'app-before.png'), Buffer.from(checked.before.split(',')[1], 'base64'));
                await fs.writeFile(path.join(output, 'app-after.png'), Buffer.from(checked.after.split(',')[1], 'base64'));
                throw Error(checked.id + ': ' + checked.error);
            }
            checks.push(checked);
        }
        const oneShotChecks = [];
        const geometryOneShotChecks = [];
        const solidOneShotChecks = [];
        let existingViewPreserved = null;
        if (suite === 'complex') {
            const prompts = [
                { id: 'parabola', text: '함수 f(x)=x^2, g(x)=1에 대하여 x=-1부터 1까지 두 그래프 사이의 넓이를 색칠해줘.',
                    inside: [0.5, 0.6], outside: [0.5, 1.6] },
                { id: 'exponential', text: 'f(x)=2^x, g(x)=1, x=0부터 2까지 두 함수 사이 넓이를 색칠해줘.',
                    inside: [1, 1.5], outside: [1, 0.5] },
                { id: 'reciprocal', text: 'f(x)=1/x, x=1부터 4까지 x축과 그래프 사이 넓이를 색칠해줘.',
                    inside: [2, 0.25], outside: [2, -0.7] },
                { id: 'cubic', text: 'f(x)=2.5*(x^3-x), x=-1부터 1까지 x축과 그래프 사이 넓이를 색칠해줘.',
                    inside: [-0.5, 0.4], outside: [-0.5, -0.4] },
                { id: 'parabola-tangent', text: 'f(x)=x^2, g(x)=1, x=-1부터 1까지 두 그래프 사이를 색칠하고 f(x)의 x=0.5에서의 접선을 그려줘.',
                    inside: [0.5, 0.6], outside: [0.5, 1.6], tangent: true }
            ];
            for (const prompt of prompts) {
                const checked = await appPage.evaluate(async (prompt) => {
                    const app = window.app;
                    app.objectManager.clear();
                    app.historyManager.clear();
                    app.canvas.scale = 50;
                    app.canvas.offset.x = 0;
                    app.canvas.offset.y = 0;
                    app.aiService.config.provider = 'local';
                    app.aiService.config.apiKey = '';
                    const result = await app.aiService.processCommand(prompt.text, app.buildAIContext());
                    if (!result.success) throw Error(prompt.id + ': ' + result.error);
                    if (!app.processAIJSON(JSON.stringify(result.json), { mode: 'command' }))
                        throw Error(prompt.id + ': app rejected one-shot GraphA');
                    const areas = app.objectManager.getAllObjects().filter(obj => obj.type === 'functionRegion');
                    if (areas.length !== 1 || !areas[0].valid)
                        throw Error(prompt.id + ': area missing or invalid');
                    if (prompt.tangent && !app.objectManager.getAllObjects().some(obj => obj.type === 'tangentFunction' && obj.valid))
                        throw Error(prompt.id + ': tangent missing or invalid');
                    if (app.canvas.scale <= 50)
                        throw Error(prompt.id + ': area was not fitted to the empty canvas');
                    const image = document.createElement('canvas');
                    app.renderSceneToCanvas(image, { includeGrid: false, includeAxes: true, includeBackground: true });
                    const sample = position => {
                        const p = app.canvas.toScreen({ x: position[0], y: position[1] });
                        return image.getContext('2d').getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data[0];
                    };
                    const inside = sample(prompt.inside), outside = sample(prompt.outside);
                    if (inside >= 245 || outside <= 240)
                        throw Error(prompt.id + ': fill pixels wrong, inside=' + inside + ', outside=' + outside);
                    return { id: prompt.id, operationTypes: result.json.operations.map(op => op.type),
                        fittedScale: app.canvas.scale, fillInside: inside, fillOutside: outside,
                        image: image.toDataURL() };
                }, prompt);
                await fs.writeFile(path.join(output, `one-shot-${checked.id}.png`),
                    Buffer.from(checked.image.split(',')[1], 'base64'));
                delete checked.image;
                oneShotChecks.push(checked);
            }
            const geometryPrompts = [
                { id: 'isosceles', text: '삼각형 ABC에서 AB=AC, ∠B=∠C, BC=6cm, ∠A=40°를 표시해줘.',
                    labels: ['A', 'B', 'C'], angles: [70, 70, 40], ticks: [1], length: 6 },
                { id: 'parallelogram', text: '평행사변형 ABCD에서 AB=CD, BC=DA, ∠A=∠C, AB=8cm, ∠A=70°를 표시해줘.',
                    labels: ['A', 'B', 'C', 'D'], angles: [70, 70], ticks: [1, 2], length: 8 }
            ];
            for (const prompt of geometryPrompts) {
                const checked = await appPage.evaluate(async (prompt) => {
                    const app = window.app;
                    app.objectManager.clear();
                    app.historyManager.clear();
                    app.canvas.scale = 50;
                    app.canvas.offset.x = 0;
                    app.canvas.offset.y = 0;
                    app.aiService.config.provider = 'local';
                    app.aiService.config.apiKey = '';
                    const result = await app.aiService.processCommand(prompt.text, app.buildAIContext());
                    if (!result.success || !app.processAIJSON(JSON.stringify(result.json), { mode: 'command' }))
                        throw Error(prompt.id + ': one-shot request failed: ' + result.error);
                    const objects = app.objectManager.getAllObjects();
                    const points = objects.filter(o => o.type === 'point');
                    const angles = objects.filter(o => o.type === 'angleDimension');
                    const ticks = objects.filter(o => o.type === 'equalLengthMarker');
                    const dimension = objects.find(o => o.type === 'lengthDimension');
                    if (JSON.stringify(points.map(o => o.label)) !== JSON.stringify(prompt.labels) ||
                        points.some(o => o.pointSize !== 0) ||
                        JSON.stringify(angles.map(o => Math.round(o.getAngleDegrees()))) !== JSON.stringify(prompt.angles) ||
                        JSON.stringify(ticks.map(o => o.tickCount)) !== JSON.stringify(prompt.ticks) ||
                        Math.abs(dimension?.length - prompt.length) > 1e-8 ||
                        objects.some(o => !o.valid))
                        throw Error(prompt.id + ': rendered geometry does not match the requested conditions');
                    const count = objects.length;
                    app.historyManager.undo();
                    if (app.objectManager.getAllObjects().length !== 0)
                        throw Error(prompt.id + ': undo failed');
                    app.historyManager.redo();
                    if (app.objectManager.getAllObjects().length !== count)
                        throw Error(prompt.id + ': redo failed');
                    const saved = app.buildProjectEnvelope();
                    const image = document.createElement('canvas');
                    app.renderSceneToCanvas(image, { includeGrid: false, includeAxes: false, includeBackground: true });
                    const beforePixels = image.toDataURL();
                    await app.importProjectFile(new File([JSON.stringify(saved)], prompt.id + '.mathgraph.json', { type: 'application/json' }));
                    if (app.objectManager.getAllObjects().length !== count)
                        throw Error(prompt.id + ': project import changed object count');
                    app.renderSceneToCanvas(image, { includeGrid: false, includeAxes: false, includeBackground: true });
                    if (image.toDataURL() !== beforePixels)
                        throw Error(prompt.id + ': project import changed rendered pixels');
                    return { id: prompt.id, count, angles: angles.map(o => Math.round(o.getAngleDegrees())),
                        tickGroups: ticks.map(o => o.tickCount), length: dimension.length, image: image.toDataURL() };
                }, prompt);
                await fs.writeFile(path.join(output, `one-shot-${checked.id}.png`),
                    Buffer.from(checked.image.split(',')[1], 'base64'));
                delete checked.image;
                geometryOneShotChecks.push(checked);
            }
            const solidPrompts = [
                { id: 'triangular-prism', text: '삼각기둥 ABC-DEF에서 AB=4cm, 높이 6cm, 가려진 모서리는 점선으로 표시해줘.',
                    labels: ['A', 'B', 'C', 'D', 'E', 'F'], dimensions: ['4 cm', '6 cm'] },
                { id: 'cube', text: '정육면체 ABCD-EFGH에서 모서리 4cm를 표시해줘.',
                    labels: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], dimensions: ['4 cm'] },
                { id: 'cylinder', text: '원기둥의 반지름은 3cm, 높이는 6cm이고 뒤쪽 원호는 점선으로 그려줘.',
                    kind: 'cylinder', dimensions: ['3 cm', '6 cm'] },
                { id: 'square-pyramid', text: '사각뿔 V-ABCD에서 밑면 AB=4cm, 높이 6cm를 표시해줘.',
                    kind: 'pyramid', labels: ['A', 'B', 'C', 'D', 'V'], dimensions: ['4 cm', '6 cm'] }
            ];
            for (const prompt of solidPrompts) {
                const checked = await appPage.evaluate(async (prompt) => {
                    const app = window.app;
                    app.objectManager.clear();
                    app.historyManager.clear();
                    app.canvas.scale = 50;
                    app.canvas.offset.x = 0;
                    app.canvas.offset.y = 0;
                    app.aiService.config.provider = 'local';
                    app.aiService.config.apiKey = '';
                    const result = await app.aiService.processCommand(prompt.text, app.buildAIContext());
                    if (!result.success || !app.processAIJSON(JSON.stringify(result.json), { mode: 'command' }))
                        throw Error(prompt.id + ': one-shot request failed: ' + result.error);
                    const objects = app.objectManager.getAllObjects();
                    const points = objects.filter(o => o.type === 'point');
                    const dimensions = objects.filter(o => o.type === 'lengthDimension');
                    const prism = objects.find(o => o.type === 'prism');
                    const pyramid = objects.find(o => o.type === 'pyramid');
                    const cylinder = objects.find(o => o.type === 'cylinder');
                    if (JSON.stringify(dimensions.map(o => o.customText)) !== JSON.stringify(prompt.dimensions) ||
                        points.some(o => o.pointSize !== 0) || objects.some(o => !o.valid))
                        throw Error(prompt.id + ': dimensions or objects missing');
                    if (prompt.kind === 'cylinder') {
                        const supports = objects.filter(o => o.type === 'segment');
                        if (!cylinder?.showHiddenLines || Math.abs(cylinder.width - 6) > 1e-8 ||
                            Math.abs(cylinder.height - cylinder.width * cylinder.ellipseRatio - 6) > 1e-8 ||
                            JSON.stringify(dimensions.map(o => o.length)) !== JSON.stringify([3, 6]) ||
                            points.length !== 3 || points.some(o => o.visible !== false || o.showLabel !== false) ||
                            JSON.stringify(supports.map(o => o.visible)) !== JSON.stringify([true, false]))
                            throw Error(prompt.id + ': radius, height, or dashed rear arc missing');
                    } else if (prompt.kind === 'pyramid') {
                        const visiblePoints = points.filter(o => o.visible !== false);
                        const foot = points.find(o => o.visible === false);
                        const apex = visiblePoints.find(o => o.label === 'V');
                        const base = visiblePoints.filter(o => o.label !== 'V');
                        const cx = base.reduce((sum, o) => sum + o.position.x, 0) / 4;
                        const cy = base.reduce((sum, o) => sum + o.position.y, 0) / 4;
                        if (JSON.stringify(visiblePoints.map(o => o.label)) !== JSON.stringify(prompt.labels) ||
                            !pyramid?.valid || pyramid._hiddenEdges.length < 2 || !foot || foot.pointSize !== 0 ||
                            Math.abs(foot.position.x - cx) > 1e-8 || Math.abs(foot.position.y - cy) > 1e-8 ||
                            Math.abs(apex.position.x - cx) > 1e-8 ||
                            Math.abs(apex.position.y - cy - 6) > 1e-8 ||
                            Math.abs(dimensions[1].length - 6) > 1e-8)
                            throw Error(prompt.id + ': upright pyramid height, labels, or hidden edges missing');
                    } else if (JSON.stringify(points.map(o => o.label)) !== JSON.stringify(prompt.labels) ||
                        !prism?.valid || prism._hiddenEdges.length < 1) {
                        throw Error(prompt.id + ': prism labels or hidden edges missing');
                    }
                    const count = objects.length;
                    const image = document.createElement('canvas');
                    app.renderSceneToCanvas(image, { includeGrid: false, includeAxes: false, includeBackground: true });
                    const beforePixels = image.toDataURL();
                    app.historyManager.undo();
                    if (app.objectManager.getAllObjects().length !== 0)
                        throw Error(prompt.id + ': undo failed');
                    app.historyManager.redo();
                    if (app.objectManager.getAllObjects().length !== count)
                        throw Error(prompt.id + ': redo failed');
                    const saved = app.buildProjectEnvelope();
                    await app.importProjectFile(new File([JSON.stringify(saved)], prompt.id + '.mathgraph.json', { type: 'application/json' }));
                    app.renderSceneToCanvas(image, { includeGrid: false, includeAxes: false, includeBackground: true });
                    if (image.toDataURL() !== beforePixels)
                        throw Error(prompt.id + ': project import changed rendered pixels');
                    return { id: prompt.id, count, hiddenEdges: prism?._hiddenEdges || pyramid?._hiddenEdges || null,
                        rearArcDashed: cylinder?.showHiddenLines || null,
                        dimensions: dimensions.map(o => o.customText), image: beforePixels, project: saved };
                }, prompt);
                await fs.writeFile(path.join(output, `one-shot-${checked.id}.png`),
                    Buffer.from(checked.image.split(',')[1], 'base64'));
                await fs.writeFile(path.join(output, `one-shot-${checked.id}.mathgraph.json`),
                    JSON.stringify(checked.project, null, 2));
                delete checked.image;
                delete checked.project;
                solidOneShotChecks.push(checked);
            }
            existingViewPreserved = await appPage.evaluate(async () => {
                const app = window.app;
                const prompt = 'f(x)=x^2, g(x)=1, x=-1부터 1까지 두 함수 사이 넓이를 색칠해줘.';
                app.objectManager.clear();
                app.historyManager.clear();
                app.canvas.scale = 80;
                app.canvas.offset.x = 1;
                app.canvas.offset.y = -1;
                let result = await app.aiService.processCommand(prompt, app.buildAIContext());
                if (!result.success || !app.processAIJSON(JSON.stringify(result.json), { mode: 'command' }))
                    throw Error('custom view area creation failed');
                if (app.canvas.scale !== 80 || app.canvas.offset.x !== 1 || app.canvas.offset.y !== -1)
                    throw Error('custom view was overwritten');
                app.objectManager.clear();
                app.historyManager.clear();
                app.canvas.scale = 50;
                app.canvas.offset.x = 0;
                app.canvas.offset.y = 0;
                const teacherPoint = app.objectManager.createPoint(-3, -2,
                    { label: 'T', labelOffset: { x: 0, y: 0 }, pointSize: 0 });
                const teacherId = teacherPoint.id;
                result = await app.aiService.processCommand(prompt, app.buildAIContext());
                if (!result.success || !app.processAIJSON(JSON.stringify(result.json), { mode: 'command' }))
                    throw Error('existing-object area creation failed');
                if (app.canvas.scale !== 50 || !app.objectManager.getObject(teacherId) ||
                    JSON.stringify(app.objectManager.getObject(teacherId).toJSON().labelOffset) !== JSON.stringify({ x: 0, y: 0 }))
                    throw Error('existing teacher view/object changed');
                return true;
            });
        }
        const preserved = await appPage.evaluate(async () => {
            const app = window.app;
            const input = { operations: [{ op: 'create', type: 'point', id: 'manual', label: 'Q', x: -3, y: -2, pointSize: 0, labelOffset: { x: 0, y: 0 } }] };
            const { enhanceDiagramQuality } = await import('/js/ai/DiagramQualityEnhancer.js');
            const result = enhanceDiagramQuality(input, '시험 도형', { context: app.buildAIContext() });
            if (JSON.stringify(result.operations[0].labelOffset) !== JSON.stringify({ x: 0, y: 0 }))
                throw Error('explicit offset changed');
            const locked = { operations: [{ ...input.operations[0], locked: true }] };
            const lockedResult = app.aiService.enhanceDiagramQuality(locked, '시험 도형', app.buildAIContext());
            if (JSON.stringify(lockedResult.operations[0].labelOffset) !== JSON.stringify({ x: 0, y: 0 }))
                throw Error('locked label changed');
            const existing = JSON.stringify(app.objectManager.toJSON());
            const bad = { operations: [{ ...input.operations[0], labelOffset: { x: -85, y: -24 } }] };
            const corrected = app.aiService.enhanceDiagramQuality(bad, '시험 도형', app.buildAIContext());
            if (JSON.stringify(corrected.operations[0].labelOffset) === JSON.stringify(bad.operations[0].labelOffset))
                throw Error('model-proposed bad offset was not corrected');
            if (JSON.stringify(app.objectManager.toJSON()) !== existing)
                throw Error('existing teacher objects changed during generation');
            if (app.aiService.enhanceDiagramQuality(input, '', null, 'patch') !== input)
                throw Error('patch mode modified');
            return true;
        });
        const screenshotDir = path.join(os.tmpdir(), 'mathgraph-exam100-qa');
        await fs.mkdir(screenshotDir, { recursive: true });
        await appPage.waitForFunction(() => document.querySelectorAll('.toast').length === 0);
        await appPage.screenshot({ path: path.join(screenshotDir, 'desktop.png') });
        await appPage.setViewportSize({ width: 390, height: 844 });
        await appPage.waitForFunction(() => window.app.canvas.width > 0 && window.app.canvas.width < 500);
        await appPage.screenshot({ path: path.join(screenshotDir, 'mobile.png') });
        const appResult = { url: appPage.url(), title: await appPage.title(), checks, oneShotChecks, geometryOneShotChecks, solidOneShotChecks, existingViewPreserved,
            explicitPositionsPreserved: preserved, errors, screenshotDir };
        await fs.writeFile(path.join(output, 'app-check.json'), JSON.stringify(appResult, null, 2));
        console.log(JSON.stringify(appResult, null, 2));
        if (errors.length)
            process.exitCode = 1;
    }
    if (argv.includes('--strict') && (summary.failedCases || consoleErrors.length))
        process.exitCode = 1;
}
finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
}
