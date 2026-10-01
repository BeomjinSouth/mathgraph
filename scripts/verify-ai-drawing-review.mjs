/** Real browser/renderer, fixed provider responses: no model charges or private inputs. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = path.join(root, 'output/ai-drawing-review');
await fs.mkdir(output, { recursive: true });
const fixture = (await fs.readFile(path.join(root,
    '.agents/skills/mathgraph-drawing/references/synthetic-drawing-data.jsonl'), 'utf8')).trim().split('\n')
    .map(line => JSON.parse(line)).find(item => item.id === 'plane_acute_angle_curved_leader');
const request = fixture.user_prompt_ko;
const initial = { operations: structuredClone(fixture.operations) };
const revised = structuredClone(initial);
revised.operations.find(op => op.id === 'angle_A').leaderCurvature = 65;
const checks = [{ condition: 'AB=5cm와 A각 20°', status: 'met', evidence: '해당 변과 각에 표시됨' },
    { condition: '각도 숫자에서 호로 곡선 화살표', status: 'met', evidence: '숫자와 자기 호가 연결됨' }];
const pass = { verdict: 'pass', checks, issues: [], operations: [] };
const revise = { verdict: 'revise', checks: [...checks, { condition: '곡선 표시', status: 'unmet', evidence: '곡선을 더 벌려야 함' }],
    issues: ['곡선 화살표 간격 조정'], operations: revised.operations };
const uncertain = { ...pass, verdict: 'uncertain', issues: ['그림 연결을 확인하지 못함'] };
const server = http.createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (!(pathname === '/' || pathname === '/favicon.svg' || /^\/(js|css|runtime)\//.test(pathname))) {
        res.writeHead(404).end(); return;
    }
    const filename = path.resolve(root, pathname === '/' ? 'index.html' : '.' + pathname);
    if (!filename.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    try {
        const data = await fs.readFile(filename);
        res.setHeader('content-type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
            '.json': 'application/json', '.svg': 'image/svg+xml' }[path.extname(filename)] || 'text/plain');
        res.end(data);
    } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
let browser;
const results = [], errors = [];
try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.locator('#guestLoginButton').click();
    await page.waitForFunction(() => Boolean(window.app));
    let queue = [], captures = [], blocked = null;
    await page.route('https://api.openai.com/v1/responses', async route => {
        const body = route.request().postDataJSON();
        captures.push(body);
        const reply = queue.shift();
        assert.notEqual(reply, undefined, 'unexpected extra model call');
        if (reply === 'wait') {
            blocked = route;
            return;
        }
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ output_text: JSON.stringify(reply) }) });
    });
    const reset = async () => {
        queue = []; captures = []; blocked = null;
        await page.evaluate(() => {
            const app = window.app;
            app.objectManager.clear(); app.historyManager.clear();
            app.canvas.scale = 50; app.canvas.offset.x = app.canvas.offset.y = 0;
            app.canvas.showGrid = app.canvas.showXAxis = app.canvas.showYAxis = false;
            app.aiService.config.provider = 'openai'; app.aiService.config.model = 'gpt-5.6-luna';
            app.aiService.config.apiKey = 'synthetic-key'; app.aiService.config.authMode = 'guest';
            app.aiService.conversationHistory = [];
            document.getElementById('chatMessages').replaceChildren(); app.render();
        });
    };
    const generate = () => page.evaluate(request => window.app.processAICommand(request), request);
    const count = () => page.evaluate(() => window.app.objectManager.getAllObjects().length);
    const waitForReview = () => page.waitForFunction(() => window.app.teacherWorkflow?.state === 'reviewing');

    await reset(); queue = [initial, revise, pass];
    assert.equal(await generate(), true);
    assert.equal(captures.length, 3);
    assert.equal(captures[1].text.format.name, 'drawing_review');
    assert.equal(captures[2].text.format.name, 'drawing_review');
    const reviewImages = captures.slice(1).map(body => body.input[1].content.find(part => part.type === 'input_image').image_url);
    assert.notEqual(reviewImages[0], reviewImages[1], 'repair must be rendered again');
    await fs.writeFile(path.join(output, 'before.png'), Buffer.from(reviewImages[0].split(',')[1], 'base64'));
    await fs.writeFile(path.join(output, 'after.png'), Buffer.from(reviewImages[1].split(',')[1], 'base64'));
    const state = await page.evaluate(() => {
        const app = window.app;
        const angle = app.objectManager.getAllObjects().find(obj => obj.type === 'angleDimension');
        const history = JSON.parse(app.aiService.conversationHistory.at(-1).content);
        const pixel = () => {
            const element = document.createElement('canvas');
            app.renderSceneToCanvas(element, { includeGrid: false, includeAxes: false });
            return element.toDataURL();
        };
        const image = pixel(), project = app.objectManager.toJSON();
        app.historyManager.undo();
        const undone = app.objectManager.getAllObjects().length;
        app.historyManager.redo();
        const redoSame = pixel() === image;
        app.objectManager.fromJSON(project); app.render();
        return { curvature: angle.leaderCurvature, historyCurvature: history.operations.find(op => op.id === 'angle_A').leaderCurvature,
            undone, redoSame, restoredSame: pixel() === image, count: project.objects.length, project,
            status: app.lastDrawingReview.status };
    });
    assert.equal(state.curvature, 65); assert.equal(state.historyCurvature, 65);
    assert.equal(state.undone, 0); assert.equal(state.redoSame, true); assert.equal(state.restoredSame, true);
    assert.equal(state.status, 'passed'); assert.equal(state.count, 8);
    await fs.writeFile(path.join(output, 'revised.mathgraph.json'), JSON.stringify(state.project, null, 2));
    await page.screenshot({ path: path.join(output, 'desktop.png') });
    results.push('text-render-repair-rerender-history-undo-redo-save');

    await reset(); queue = [initial, uncertain];
    assert.equal(await generate(), false); assert.equal(await count(), 0);
    assert.equal(await page.locator('#chatMessages button').count() > 0, true,
        await page.locator('#chatMessages').innerText());
    await page.getByRole('button', { name: '초안 반영', exact: true }).click();
    assert.equal(await count(), 8);
    results.push('uncertain-holds-draft-explicit-apply');

    await reset(); queue = [initial, uncertain]; await generate();
    await page.evaluate(() => window.app.objectManager.createPoint(9, 9, { label: '교사점' }));
    await page.getByRole('button', { name: '초안 반영', exact: true }).click();
    assert.equal(await count(), 1);
    results.push('stale-draft-cannot-overwrite-teacher-edit');

    await reset(); queue = [initial, 'wait'];
    const pending = generate();
    await waitForReview();
    assert.equal(await count(), 0);
    assert.equal(await page.evaluate(request => window.app.processAICommand(request), request), false);
    await page.evaluate(() => window.app.objectManager.createPoint(9, 9, { label: '교사점', labelOffset: { x: 37, y: 15 } }));
    while (!blocked) await new Promise(resolve => setTimeout(resolve, 10));
    await blocked.fulfill({ contentType: 'application/json', body: JSON.stringify({ output_text: JSON.stringify(pass) }) });
    assert.equal(await pending, false); assert.equal(await count(), 1);
    results.push('private-preview-duplicate-guard-manual-edit');

    await reset(); queue = [initial, 'wait'];
    const cancelled = generate(); await waitForReview();
    await page.getByRole('button', { name: '중단', exact: true }).click();
    assert.equal(await cancelled, false); assert.equal(await count(), 0);
    assert.equal(await page.locator('#sendMessage').isEnabled(), true);
    if (blocked) await blocked.abort().catch(() => {});
    results.push('cancel-review-no-late-apply');

    await reset(); queue = [initial, revise, uncertain];
    assert.equal(await generate(), false); assert.equal(await count(), 0);
    assert.equal(captures.length, 3);
    results.push('one-repair-limit-unresolved-holds');

    await reset(); queue = [initial, pass];
    const teacher = await page.evaluate(() => {
        const point = window.app.objectManager.createPoint(7, 7, { label: '교사점', locked: true, labelOffset: { x: 36, y: 12 } });
        return point.toJSON();
    });
    assert.equal(await generate(), true);
    assert.deepEqual(await page.evaluate(id => window.app.objectManager.getObject(id).toJSON(), teacher.id), teacher);
    results.push('existing-locked-point-coordinate-label-preserved');

    await reset();
    const lockedId = await page.evaluate(() => window.app.objectManager.createPoint(1, 1, { label: '잠금', locked: true }).id);
    queue = [{ operations: [{ op: 'update', id: lockedId, x: 2 }] }];
    assert.equal(await page.evaluate(() => window.app.processAICommand('점의 위치를 바꿔줘.')), false);
    assert.equal(captures.length, 1);
    assert.equal(await page.evaluate(id => window.app.objectManager.getObject(id).position.x, lockedId), 1);
    results.push('locked-object-update-blocked-before-review');

    await reset();
    const graphRequest = 'f(x)=x^2, y=1, x=-1부터 1까지 함수와 직선 사이의 넓이를 색칠해줘.';
    const graph = await page.evaluate(request => window.app.aiService.buildFallbackCommandResult(request, window.app.buildAIContext()).json, graphRequest);
    queue = [graph, pass];
    assert.equal(await page.evaluate(request => window.app.processAICommand(request), graphRequest), true);
    const compared = await page.evaluate(() => {
        const app = window.app, element = document.createElement('canvas');
        app.renderSceneToCanvas(element, { includeGrid: false, includeAxes: false });
        return { image: element.toDataURL(), scale: app.canvas.scale };
    });
    assert.notEqual(compared.scale, 50);
    assert.equal(compared.image, captures[1].input[1].content.find(part => part.type === 'input_image').image_url);
    results.push('function-fit-render-equals-final-view');

    await reset(); queue = [initial, pass];
    const sourceImage = reviewImages[1];
    await page.evaluate(source => {
        const app = window.app;
        // Fixed legacy image analysis output; the review still uses actual fetch transport + rendering.
        app.aiService.analyzeImage = async () => ({ success: true, json: source.initial });
        document.getElementById('chatInput').value = source.request;
        const bytes = Uint8Array.from(atob(source.image.split(',')[1]), c => c.charCodeAt(0));
        app.handleImageUpload(new File([bytes], 'synthetic.png', { type: 'image/png' }));
    }, { initial, request, image: sourceImage });
    // Generation is stubbed above, so only the review response is needed.
    queue = [pass];
    await page.waitForFunction(() => window.app.lastDrawingReview?.status === 'passed' &&
        !window.app.activeDrawingRequest && window.app.objectManager.getAllObjects().length === 8);
    assert.equal(captures.length, 1);
    assert.equal(captures[0].input[1].content.filter(part => part.type === 'input_image').length, 2);
    results.push('image-source-and-actual-render-review');

    await reset();
    await page.evaluate(() => { window.app.aiService.config.provider = 'local'; window.app.aiService.config.apiKey = ''; });
    assert.equal(await page.evaluate(() => window.app.processAICommand('중심 (0,0), 반지름 3인 원을 그려줘.')), true);
    assert.equal(captures.length, 0);
    assert.equal(await page.evaluate(() => window.app.lastDrawingReview.status), 'local');
    results.push('local-generation-without-extra-calls');

    await reset(); queue = [initial, uncertain];
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => window.app.isCompactLayout && Math.abs(window.app.canvas.width -
        document.getElementById('canvas-container').getBoundingClientRect().width) < 1);
    await generate();
    await page.screenshot({ path: path.join(output, 'mobile-draft.png') });
    const mobile = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
        button: document.querySelector('#chatMessages button')?.getBoundingClientRect().toJSON() }));
    assert.equal(mobile.scroll <= mobile.width + 1, true);
    assert.equal(mobile.button.x >= 0 && mobile.button.x + mobile.button.width <= mobile.width, true);
    await page.getByRole('button', { name: '초안 반영', exact: true }).focus();
    await page.keyboard.press('Enter'); assert.equal(await count(), 8);
    results.push('mobile-draft-keyboard-no-horizontal-overflow');
    assert.deepEqual(errors, []);
    const summary = { status: 'passed', fixedModelResponses: true, liveExternalModel: false,
        cases: results, browserErrors: errors, source: 'working-tree' };
    await fs.writeFile(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary));
} finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
}
