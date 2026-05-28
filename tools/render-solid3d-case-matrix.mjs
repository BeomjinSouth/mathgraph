import { createServer } from 'node:http';
import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(repoRoot, 'tmp', 'solid3d-case-matrix');
const screenshotDir = path.join(outputDir, 'screenshots');

const mimeTypes = new Map([
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'application/javascript; charset=utf-8'],
    ['.css', 'text/css; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.svg', 'image/svg+xml'],
    ['.png', 'image/png'],
    ['.ico', 'image/x-icon']
]);

function round(value) {
    return Number(value.toFixed(6));
}

function point(id, x, y, params = {}) {
    return {
        op: 'create',
        type: 'point',
        id,
        x: round(x),
        y: round(y),
        visible: false,
        showLabel: false,
        ...params
    };
}

function prism(id, baseVertexIds, topVertexIds, params = {}) {
    return {
        op: 'create',
        type: 'prism',
        id,
        baseVertexIds,
        topVertexIds,
        color: '#000000',
        lineWidth: 2,
        showLabel: false,
        ...params
    };
}

function pyramid(id, baseVertexIds, apexId, params = {}) {
    return {
        op: 'create',
        type: 'pyramid',
        id,
        baseVertexIds,
        apexId,
        color: '#000000',
        lineWidth: 2,
        showLabel: false,
        ...params
    };
}

function segment(id, point1Id, point2Id, params = {}) {
    return {
        op: 'create',
        type: 'segment',
        id,
        point1Id,
        point2Id,
        color: '#000000',
        lineWidth: 1.5,
        showLabel: false,
        ...params
    };
}

function polygon(id, vertexIds, params = {}) {
    return {
        op: 'create',
        type: 'polygon',
        id,
        vertexIds,
        color: '#000000',
        lineWidth: 1.5,
        fillColor: '#000000',
        fillOpacity: 0,
        showLabel: false,
        ...params
    };
}

function rectangleVertices(width, height, centerX = 0, centerY = 0) {
    const halfW = width / 2;
    const halfH = height / 2;
    return [
        [centerX - halfW, centerY - halfH],
        [centerX + halfW, centerY - halfH],
        [centerX + halfW, centerY + halfH],
        [centerX - halfW, centerY + halfH]
    ];
}

function regularPolygonVertices(count, radius = 2, centerX = 0, centerY = 0, startAngle = -Math.PI / 2) {
    return Array.from({ length: count }, (_, index) => {
        const angle = startAngle + index * 2 * Math.PI / count;
        return [
            centerX + radius * Math.cos(angle),
            centerY + radius * Math.sin(angle)
        ];
    });
}

function createPrismOps(prefix, baseVertices, shiftX, shiftY, params = {}) {
    const baseIds = baseVertices.map((_, index) => `${prefix}_B${index}`);
    const topIds = baseVertices.map((_, index) => `${prefix}_T${index}`);
    const pointOps = [
        ...baseVertices.map(([x, y], index) => point(baseIds[index], x, y)),
        ...baseVertices.map(([x, y], index) => point(topIds[index], x + shiftX, y + shiftY))
    ];

    return [
        ...pointOps,
        prism(`${prefix}_solid`, baseIds, topIds, params)
    ];
}

function createPyramidOps(prefix, baseVertices, apexX, apexY, params = {}) {
    const baseIds = baseVertices.map((_, index) => `${prefix}_B${index}`);
    const apexId = `${prefix}_V`;

    return [
        ...baseVertices.map(([x, y], index) => point(baseIds[index], x, y)),
        point(apexId, apexX, apexY),
        pyramid(`${prefix}_solid`, baseIds, apexId, params)
    ];
}

function makeCase(id, title, operations, params = {}) {
    const expectedSolidCount = operations.filter(op => op.op === 'create' && (op.type === 'prism' || op.type === 'pyramid')).length;
    return {
        id,
        title,
        operations,
        expectedSolidCount,
        minNonWhitePixels: 250,
        expectDashedSegments: true,
        ...params
    };
}

function buildCases() {
    const cases = [
        makeCase('rect_prism_shift_up_right', 'Rectangular prism, rear face up-right',
            createPrismOps('rpur', rectangleVertices(4, 2), 1, 1)),
        makeCase('rect_prism_shift_up_left', 'Rectangular prism, rear face up-left',
            createPrismOps('rpul', rectangleVertices(4, 2), -1, 1)),
        makeCase('rect_prism_shift_down_right', 'Rectangular prism, rear face down-right',
            createPrismOps('rpdr', rectangleVertices(4, 2), 1, -1)),
        makeCase('rect_prism_shift_down_left', 'Rectangular prism, rear face down-left',
            createPrismOps('rpdl', rectangleVertices(4, 2), -1, -1)),
        makeCase('wide_rect_prism', 'Wide rectangular prism',
            createPrismOps('wrp', rectangleVertices(5.6, 1.7), 1.4, 0.7)),
        makeCase('tall_rect_prism', 'Tall rectangular prism',
            createPrismOps('trp', rectangleVertices(2.2, 4.2), -0.9, 1.2)),
        makeCase('skinny_slanted_prism', 'Skinny slanted prism',
            createPrismOps('ssp', rectangleVertices(1.2, 4.8), 0.75, -1.15)),
        makeCase('triangular_prism_up_right', 'Triangular prism, rear face up-right',
            createPrismOps('tpu', regularPolygonVertices(3, 2.2), 1, 1)),
        makeCase('triangular_prism_up_left', 'Triangular prism, rear face up-left',
            createPrismOps('tpl', regularPolygonVertices(3, 2.2), -1, 1)),
        makeCase('triangular_prism_down_right', 'Triangular prism, rear face down-right',
            createPrismOps('tpd', regularPolygonVertices(3, 2.2), 1, -1)),
        makeCase('pentagonal_prism_up_right', 'Pentagonal prism, rear face up-right',
            createPrismOps('ppu', regularPolygonVertices(5, 2.1), 1.1, 0.9)),
        makeCase('pentagonal_prism_up_left', 'Pentagonal prism, rear face up-left',
            createPrismOps('ppl', regularPolygonVertices(5, 2.1), -1.1, 0.9)),
        makeCase('hexagonal_prism_up_right', 'Hexagonal prism, rear face up-right',
            createPrismOps('hpu', regularPolygonVertices(6, 2.1), 1.15, 0.75)),
        makeCase('hexagonal_prism_down_left', 'Hexagonal prism, rear face down-left',
            createPrismOps('hpd', regularPolygonVertices(6, 2.1), -1, -0.9)),
        makeCase('triangular_pyramid_high', 'Triangular pyramid, high apex',
            createPyramidOps('tyh', regularPolygonVertices(3, 2.1), 0, 3.1)),
        makeCase('triangular_pyramid_low', 'Triangular pyramid, low apex',
            createPyramidOps('tyl', regularPolygonVertices(3, 2.1), 0, -3.1)),
        makeCase('square_pyramid_center_high', 'Square pyramid, centered high apex',
            createPyramidOps('sqh', rectangleVertices(3.3, 3.3), 0, 3.2)),
        makeCase('square_pyramid_left_high', 'Square pyramid, left high apex',
            createPyramidOps('sql', rectangleVertices(3.3, 3.3), -2.1, 2.7)),
        makeCase('square_pyramid_right_low', 'Square pyramid, right low apex',
            createPyramidOps('sqr', rectangleVertices(3.3, 3.3), 2.1, -2.7)),
        makeCase('pentagonal_pyramid_left', 'Pentagonal pyramid, left apex',
            createPyramidOps('pyl', regularPolygonVertices(5, 2.1), -2.2, 2.5)),
        makeCase('hexagonal_pyramid_right', 'Hexagonal pyramid, right apex',
            createPyramidOps('hyr', regularPolygonVertices(6, 2.1), 2.2, 2.5))
    ];

    const crossSectionOps = createPrismOps('cs', rectangleVertices(4.6, 2.4), 1.1, 0.95);
    crossSectionOps.push(
        segment('cs_diag', 'cs_B0', 'cs_T2', { dashed: true, lineWidth: 1 }),
        polygon('cs_section', ['cs_B1', 'cs_T1', 'cs_T2', 'cs_B2'], {
            fillOpacity: 0.08,
            lineWidth: 1
        })
    );
    cases.push(makeCase('prism_with_diagonal_cross_section', 'Prism with diagonal and cross-section', crossSectionOps));

    const nestedOps = [
        ...createPrismOps('outer', rectangleVertices(5.4, 3.1), 1.2, 1.0, { lineWidth: 2 }),
        ...createPyramidOps('inner_py', rectangleVertices(1.6, 1.1, -0.55, -0.1), -0.15, 1.15, { lineWidth: 1.5 }),
        ...createPrismOps('inner_pr', rectangleVertices(1.15, 0.8, 1.0, -0.55), 0.45, 0.38, { lineWidth: 1.3 })
    ];
    cases.push(makeCase('nested_prism_pyramid_and_prism', 'Outer prism with separated inner solids', nestedOps, {
        minNonWhitePixels: 500,
        expectedSolidCount: 3
    }));

    const twoPrismsOps = [
        ...createPrismOps('left_pr', rectangleVertices(2.1, 1.5, -2.6, 0), 0.75, 0.7, { lineWidth: 1.8 }),
        ...createPrismOps('right_pr', regularPolygonVertices(5, 1.25, 2.6, 0), -0.65, 0.85, { lineWidth: 1.8 })
    ];
    cases.push(makeCase('two_prisms_separated', 'Separated rectangular and pentagonal prisms', twoPrismsOps, {
        minNonWhitePixels: 450,
        expectedSolidCount: 2
    }));

    return cases;
}

function startStaticServer() {
    const server = createServer(async (req, res) => {
        try {
            const rawUrl = new URL(req.url || '/', 'http://127.0.0.1');
            if (rawUrl.pathname === '/favicon.ico') {
                res.writeHead(204);
                res.end();
                return;
            }

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

            res.writeHead(200, {
                'Content-Type': mimeTypes.get(path.extname(filePath)) || 'application/octet-stream'
            });
            res.end(await readFile(filePath));
        } catch {
            res.writeHead(404);
            res.end('Not found');
        }
    });

    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            resolve({ server, url: `http://127.0.0.1:${address.port}/` });
        });
    });
}

async function findExistingChromiumExecutable() {
    if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
        return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
    }

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
            // Try the next locally installed browser revision.
        }
    }

    return null;
}

function evaluateFailures(caseDef, result) {
    const failures = [];

    if (result.thrownError) {
        failures.push(`case threw in browser: ${result.thrownError}`);
    }
    if (result.consoleErrors.length > 0) {
        failures.push(`console errors: ${result.consoleErrors.join(' | ')}`);
    }
    if (result.invalidObjects.length > 0) {
        failures.push(`invalid objects: ${result.invalidObjects.map(object => `${object.id}:${object.type}`).join(', ')}`);
    }
    if (result.objectCount === 0) {
        failures.push('no objects were created');
    }
    if (result.solidCount !== caseDef.expectedSolidCount) {
        failures.push(`expected ${caseDef.expectedSolidCount} solids, got ${result.solidCount}`);
    }
    if (result.nonWhitePixels < caseDef.minNonWhitePixels) {
        failures.push(`canvas output too sparse: ${result.nonWhitePixels} non-white pixels`);
    }
    if (caseDef.expectDashedSegments && result.dashedSegmentCount === 0) {
        failures.push('no dashed segments were drawn');
    }
    if (result.solidSegmentCount === 0) {
        failures.push('no solid segments were drawn');
    }

    for (const solid of result.solids) {
        if (solid.type === 'prism') {
            const hiddenBaseEdges = solid.hiddenEdges.filter(edge => edge.type === 'base');
            const hiddenRearEdges = solid.hiddenEdges.filter(edge => edge.type === 'top' || edge.type === 'vertical');
            if (hiddenBaseEdges.length > 0) {
                failures.push(`prism ${solid.id} hid front/base edges: ${JSON.stringify(hiddenBaseEdges)}`);
            }
            if (hiddenRearEdges.length === 0) {
                failures.push(`prism ${solid.id} did not classify any rear/top/depth hidden edge`);
            }
        }

        if (solid.type === 'pyramid') {
            if (solid.hiddenEdges.length === 0) {
                failures.push(`pyramid ${solid.id} did not classify any hidden edge`);
            }
            const unsupportedEdges = solid.hiddenEdges.filter(edge => edge.type !== 'base' && edge.type !== 'lateral');
            if (unsupportedEdges.length > 0) {
                failures.push(`pyramid ${solid.id} reported unsupported hidden-edge types: ${JSON.stringify(unsupportedEdges)}`);
            }
        }
    }

    return failures;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

async function writeContactSheet(page, results, contactSheetPath) {
    const cards = [];

    for (const result of results) {
        const png = await readFile(result.screenshotPath);
        const dataUrl = `data:image/png;base64,${png.toString('base64')}`;
        const status = result.failures.length === 0 ? 'PASS' : 'FAIL';
        cards.push(`
            <article class="card ${status.toLowerCase()}">
                <h2>${escapeHtml(result.id)}</h2>
                <p>${escapeHtml(result.title)}</p>
                <img src="${dataUrl}" alt="${escapeHtml(result.id)}" />
                <footer>${status} · solids ${result.solidCount} · dashed ${result.dashedSegmentCount} · pixels ${result.nonWhitePixels}</footer>
            </article>
        `);
    }

    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.setContent(`
        <!doctype html>
        <html>
        <head>
            <meta charset="utf-8" />
            <style>
                * { box-sizing: border-box; }
                body {
                    margin: 0;
                    padding: 24px;
                    font-family: Arial, sans-serif;
                    background: #f5f5f5;
                    color: #111;
                }
                h1 {
                    margin: 0 0 18px;
                    font-size: 28px;
                    letter-spacing: 0;
                }
                .grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 16px;
                }
                .card {
                    background: #fff;
                    border: 1px solid #d4d4d4;
                    border-radius: 6px;
                    padding: 10px;
                }
                .card.fail {
                    border-color: #b91c1c;
                }
                h2 {
                    margin: 0 0 4px;
                    font-size: 14px;
                    letter-spacing: 0;
                }
                p {
                    min-height: 32px;
                    margin: 0 0 8px;
                    font-size: 12px;
                    line-height: 1.35;
                    color: #444;
                }
                img {
                    display: block;
                    width: 100%;
                    aspect-ratio: 16 / 10;
                    object-fit: contain;
                    border: 1px solid #e5e5e5;
                    background: #fff;
                }
                footer {
                    margin-top: 8px;
                    font-size: 12px;
                    color: #333;
                }
            </style>
        </head>
        <body>
            <h1>Solid3D Case Matrix</h1>
            <section class="grid">${cards.join('')}</section>
        </body>
        </html>
    `, { waitUntil: 'load' });
    await page.screenshot({ path: contactSheetPath, fullPage: true });
}

async function writeReports(results, failures, contactSheetPath) {
    const jsonPath = path.join(outputDir, 'solid3d-case-matrix-report.json');
    const mdPath = path.join(outputDir, 'solid3d-case-matrix-report.md');
    const serializable = {
        generatedAt: new Date().toISOString(),
        caseCount: results.length,
        failureCount: failures.length,
        contactSheetPath,
        results,
        failures
    };

    await writeFile(jsonPath, `${JSON.stringify(serializable, null, 2)}\n`, 'utf8');

    const rows = results.map(result => {
        const hidden = result.solids
            .map(solid => `${solid.type}:${solid.hiddenEdges.map(edge => `${edge.type}${edge.index}`).join(',') || 'none'}`)
            .join('<br>');
        return `| ${result.failures.length === 0 ? 'PASS' : 'FAIL'} | ${result.id} | ${result.solidCount} | ${result.dashedSegmentCount} | ${result.nonWhitePixels} | ${hidden} |`;
    });

    await writeFile(mdPath, [
        '# Solid3D Case Matrix Report',
        '',
        `- Cases: ${results.length}`,
        `- Failures: ${failures.length}`,
        `- Contact sheet: ${path.relative(repoRoot, contactSheetPath).replaceAll('\\', '/')}`,
        '',
        '| Status | Case | Solids | Dashed segments | Non-white pixels | Hidden edges |',
        '| --- | --- | ---: | ---: | ---: | --- |',
        ...rows,
        ''
    ].join('\n'), 'utf8');

    return { jsonPath, mdPath };
}

async function renderCase(page, caseDef, consoleErrors, pageErrors) {
    const consoleStart = consoleErrors.length;
    const pageErrorStart = pageErrors.length;

    const result = await page.evaluate((payload) => {
        const app = window.app;
        const canvasElement = document.getElementById('mainCanvas');
        const drawnSegments = [];
        const originalDrawSegment = app.canvas.drawSegment.bind(app.canvas);
        let thrownError = null;

        app.objectManager.clear();
        app.historyManager.clear();
        app.canvas.resetView();
        app.canvas.setZoom(58);
        app.canvas.showGrid = false;
        app.canvas.showXAxis = false;
        app.canvas.showYAxis = false;
        app.render();

        app.canvas.drawSegment = (p1, p2, options = {}) => {
            drawnSegments.push({
                dashed: options.dashed === true,
                p1: { x: p1.x, y: p1.y },
                p2: { x: p2.x, y: p2.y }
            });
            return originalDrawSegment(p1, p2, options);
        };

        try {
            app.processAIJSON(JSON.stringify({ operations: payload.operations }));
            drawnSegments.length = 0;
            app.render();
        } catch (error) {
            thrownError = error?.message || String(error);
        } finally {
            app.canvas.drawSegment = originalDrawSegment;
        }

        const ctx = canvasElement.getContext('2d');
        const pixels = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height).data;
        let nonWhitePixels = 0;

        for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i] < 248 || pixels[i + 1] < 248 || pixels[i + 2] < 248) {
                nonWhitePixels += 1;
            }
        }

        const objects = app.objectManager.getAllObjects();
        const solids = objects
            .filter(object => object.type === 'prism' || object.type === 'pyramid')
            .map(object => ({
                id: object.id,
                type: object.type,
                valid: object.valid === true,
                hiddenEdges: Array.isArray(object._hiddenEdges)
                    ? object._hiddenEdges.map(edge => ({ type: edge.type, index: edge.index }))
                    : [],
                baseVertexCount: Array.isArray(object.baseVertexIds) ? object.baseVertexIds.length : 0,
                topVertexCount: Array.isArray(object.topVertexIds) ? object.topVertexIds.length : 0,
                hasApex: typeof object.apexId === 'string'
            }));

        return {
            thrownError,
            objectCount: objects.length,
            visibleObjectCount: objects.filter(object => object.visible !== false).length,
            invalidObjects: objects
                .filter(object => object.valid === false)
                .map(object => ({ id: object.id, type: object.type })),
            solidCount: solids.length,
            solids,
            drawnSegmentCount: drawnSegments.length,
            dashedSegmentCount: drawnSegments.filter(segment => segment.dashed).length,
            solidSegmentCount: drawnSegments.filter(segment => !segment.dashed).length,
            nonWhitePixels
        };
    }, { operations: caseDef.operations });

    const screenshotPath = path.join(screenshotDir, `${caseDef.id}.png`);
    await page.locator('#mainCanvas').screenshot({ path: screenshotPath });

    const caseConsoleErrors = consoleErrors.slice(consoleStart);
    const casePageErrors = pageErrors.slice(pageErrorStart);
    const merged = {
        id: caseDef.id,
        title: caseDef.title,
        screenshotPath,
        consoleErrors: [...caseConsoleErrors, ...casePageErrors],
        ...result
    };
    const failures = evaluateFailures(caseDef, merged);
    return { ...merged, failures };
}

async function main() {
    const cases = buildCases();
    await mkdir(screenshotDir, { recursive: true });

    const { server, url } = await startStaticServer();
    const executablePath = await findExistingChromiumExecutable();
    const browser = await chromium.launch({
        headless: true,
        ...(executablePath ? { executablePath } : {})
    });

    try {
        const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
        const consoleErrors = [];
        const pageErrors = [];

        page.on('console', message => {
            if (message.type() === 'error' && !message.text().includes('favicon')) {
                consoleErrors.push(message.text());
            }
        });
        page.on('pageerror', error => {
            pageErrors.push(error?.message || String(error));
        });

        await page.goto(url, { waitUntil: 'load' });
        await page.waitForFunction(() => window.app?.objectManager && window.app?.processAIJSON);
        await page.addStyleTag({
            content: `
                .canvas-controls,
                .coord-display,
                .snap-options,
                #chat-panel,
                #toast-container {
                    display: none !important;
                }
            `
        });
        await page.waitForTimeout(100);

        const results = [];
        for (const caseDef of cases) {
            results.push(await renderCase(page, caseDef, consoleErrors, pageErrors));
        }

        const failures = results.filter(result => result.failures.length > 0);
        const contactSheetPath = path.join(outputDir, 'contact-sheet.png');
        await writeContactSheet(page, results, contactSheetPath);
        const reportPaths = await writeReports(results, failures, contactSheetPath);

        console.log(JSON.stringify({
            url,
            caseCount: results.length,
            failureCount: failures.length,
            contactSheetPath,
            reportPaths,
            failures: failures.map(result => ({ id: result.id, failures: result.failures }))
        }, null, 2));

        if (failures.length > 0) {
            process.exitCode = 1;
        }
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
