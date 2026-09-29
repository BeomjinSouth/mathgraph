import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { curriculumCases, probabilityCases } from '../tests/fixtures/curriculum-drawing-cases.js';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'mathgraph-curriculum-check'));
await fs.mkdir(output, { recursive: true });
const server = http.createServer(async (req, res) => {
    try {
        const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
        if (!(pathname === '/' || /^\/(index\.html|favicon\.svg|js\/|css\/|runtime\/)/.test(pathname))) { res.writeHead(404).end(); return; }
        const filename = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
        if (!filename.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
        res.setHeader('content-type', { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' }[path.extname(filename)] || 'application/octet-stream');
        res.end(await fs.readFile(filename));
    } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], results = [];
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => window.app?.canvas?.width > 0);
    await page.locator('#guestLoginButton').click();
    for (const spec of [...curriculumCases, ...probabilityCases]) {
        const result = await page.evaluate(async spec => {
            const app = window.app, ensure = (condition, message) => { if (!condition) throw Error(message); };
            app.objectManager.clear(); app.historyManager.clear();
            app.canvas.scale = 50; app.canvas.offset.x = app.canvas.offset.y = 0;
            app.canvas.showGrid = app.canvas.showXAxis = app.canvas.showYAxis = false;
            app.aiService.config.provider = 'local'; app.aiService.config.apiKey = '';
            const result = await app.aiService.processCommand(spec.prompt, app.buildAIContext());
            ensure(result.success, result.error);
            ensure(app.processAIJSON(result.json, { userMessage: spec.prompt, mode: result.mode, generated: true }), 'app rejected diagram');
            const obj = app.objectManager.getAllObjects()[0]; ensure(obj.valid, 'invalid diagram');
            const textBoxes = (obj.parts || []).filter(p => p.text !== undefined).map(p => {
                const point = obj.screen(app.canvas, p.x, p.y), ctx = app.canvas.ctx;
                ctx.font = `${p.small ? obj.fontSize * 0.85 : obj.fontSize}px sans-serif`;
                const width = ctx.measureText(p.text).width;
                return { text: p.text, left: point.x - (p.align === 'left' ? 0 : p.align === 'right' ? width : width / 2), top: point.y - obj.fontSize / 2, width, height: obj.fontSize };
            });
            ensure(textBoxes.every(b => b.left >= 0 && b.top >= 0 && b.left + b.width <= app.canvas.width && b.top + b.height <= app.canvas.height), 'clipped text');
            const overlaps = [];
            textBoxes.forEach((a, i) => textBoxes.slice(i + 1).forEach(b => {
                if (a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height) overlaps.push([a.text, b.text]);
            }));
            const render = () => { const c = document.createElement('canvas'); app.renderSceneToCanvas(c, { includeGrid: false, includeAxes: false, includeBackground: true }); return c; };
            const image = render(), png = image.toDataURL();
            if (obj.type === 'annularSector' && obj.innerRadius > 0) {
                const c = obj.screen(app.canvas, 0, 0), pixel = image.getContext('2d').getImageData(Math.round(c.x), Math.round(c.y), 1, 1).data;
                ensure(pixel[0] > 248, 'annular hole is filled');
            }
            if (obj.type === 'vennDiagram') {
                const tables = { 'venn-intersection': [0, 0, 0, 1], 'venn-union': [0, 1, 1, 1],
                    'venn-difference': [0, 1, 0, 0], 'venn-complement': [1, 0, 0, 0],
                    'venn-three': [0, 0, 0, 1, 0, 1, 0, 1], 'venn-de-morgan': [0, 0, 0, 0, 1, 0, 0, 0],
                    'venn-reverse': [0, 0, 1, 0], 'venn-a-complement': [1, 0, 1, 0] };
                const table = tables[spec.id], circles = obj.parts.filter(p => p.commands?.length === 3 && p.commands[1][0] === 'A').map(p => p.commands[1]);
                let checked = 0;
                for (let xi = 1; xi < 20; xi++) for (let yi = 1; yi < 16; yi++) {
                    const x = obj.width * xi / 20, y = obj.height * yi / 16;
                    if (circles.some(([, cx, cy, r]) => Math.abs(Math.hypot(x - cx, y - cy) - r) * app.canvas.scale < 6)) continue;
                    const p = obj.screen(app.canvas, x, y);
                    if (textBoxes.some(b => p.x > b.left - 3 && p.x < b.left + b.width + 3 && p.y > b.top - 3 && p.y < b.top + b.height + 3)) continue;
                    const mask = circles.reduce((bits, [, cx, cy, r], i) => bits | (Math.hypot(x - cx, y - cy) < r ? 1 << i : 0), 0);
                    const shade = image.getContext('2d').getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data[0] < 245;
                    ensure(shade === Boolean(table[mask]), `wrong Venn region at ${x},${y}, mask=${mask}`); checked++;
                }
                ensure(checked > 150, 'insufficient Venn pixel samples');
            }
            app.historyManager.undo(); ensure(app.objectManager.getAllObjects().length === 0, 'undo failed');
            app.historyManager.redo(); ensure(render().toDataURL() === png, 'redo changed pixels');
            const project = app.buildProjectEnvelope();
            await app.importProjectFile(new File([JSON.stringify(project)], `${spec.id}.mathgraph.json`, { type: 'application/json' }));
            ensure(render().toDataURL() === png, 'project import changed pixels');
            const diagram = app.objectManager.getAllObjects()[0];
            const svg = app.buildSVGMarkup({ includeBackground: true, includeGrid: false, includeAxes: false });
            ensure((diagram.type === 'function' ? /<path|<polyline/.test(svg) : svg.includes(`data-type="${diagram.type}"`)) && !svg.includes('NaN'), 'native SVG missing');
            app.objectManager.selectObject(diagram); app.updateSidebar(); app.render();
            return { id: spec.id, prompt: spec.prompt, type: diagram.type, overlaps, png, project, svg, width: image.width, height: image.height };
        }, spec);
        await fs.writeFile(path.join(output, `${spec.id}.png`), Buffer.from(result.png.split(',')[1], 'base64'));
        await fs.writeFile(path.join(output, `${spec.id}.svg`), result.svg);
        await fs.writeFile(path.join(output, `${spec.id}.mathgraph.json`), JSON.stringify(result.project, null, 2));
        if (['histogram-density', 'annular', 'prism-net', 'cone-net', 'pie', 'venn-three', 'binomial', 'normal'].includes(spec.id)) {
            await page.waitForFunction(() => !document.querySelector('.toast'));
            await page.screenshot({ path: path.join(output, `${spec.id}-app.png`) });
        }
        delete result.png; delete result.svg; delete result.project;
        results.push(result);
    }
    // Real property-panel edit and failure recovery, not only object API checks.
    await page.locator('input[data-field="height"]').fill('5');
    await page.getByRole('button', { name: '적용', exact: true }).click();
    if (await page.evaluate(() => window.app.objectManager.getAllObjects()[0].height) !== 5) throw Error('property edit not applied');
    await page.locator('input[data-field="height"]').fill('-1');
    await page.getByRole('button', { name: '적용', exact: true }).click();
    if (!(await page.locator('[data-curriculum-properties] [role="alert"]').textContent())) throw Error('property error missing');
    if (await page.evaluate(() => window.app.objectManager.getAllObjects()[0].height) !== 5) throw Error('invalid edit changed object');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => window.app.isCompactLayout === true && document.getElementById('property-panel').classList.contains('collapsed'));
    await page.waitForFunction(() => !document.querySelector('.toast'));
    await page.evaluate(() => {
        const app = window.app;
        app.objectManager.clear(); app.historyManager.clear();
        app.canvas.scale = 50; app.canvas.offset.x = app.canvas.offset.y = 0;
    });
    if (!(await page.locator('#chatInput').isVisible())) await page.locator('#toggleChat').click();
    await page.locator('#chatInput').fill('표준정규분포 -1<=x<=1 색칠');
    await page.locator('#sendMessage').click();
    await page.waitForFunction(() => window.app.objectManager.getAllObjects().some(o => o.chartKind === 'normal'));
    const mobileBounds = await page.evaluate(() => {
        const app = window.app, object = app.objectManager.getAllObjects()[0], bounds = object.getBounds();
        return { width: app.canvas.width, left: app.canvas.toScreen({ x: bounds.minX, y: bounds.minY }).x,
            right: app.canvas.toScreen({ x: bounds.maxX, y: bounds.maxY }).x };
    });
    if (mobileBounds.left < 0 || mobileBounds.right > mobileBounds.width) throw Error('fresh mobile diagram clipped');
    await page.screenshot({ path: path.join(output, 'mobile.png') });
    const report = { checks: results.length, pageErrors: errors, propertyEdit: true, invalidEditPreserved: true, mobileButtonFlow: true, mobileBounds, results };
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report, results: results.filter(r => r.overlaps.length), output }, null, 2));
    if (errors.length || results.some(r => r.overlaps.length)) process.exitCode = 1;
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
