import { createServer } from 'node:http';
import { access, mkdir, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = path.join(repoRoot, 'tests', 'fixtures', 'pdf-ai-drawing-samples.json');
const outputDir = path.join(repoRoot, 'tmp', 'browser-captures', 'pdf-ai-drawing-samples');

const mimeTypes = new Map([
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'application/javascript; charset=utf-8'],
    ['.css', 'text/css; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.svg', 'image/svg+xml'],
    ['.png', 'image/png']
]);

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

async function main() {
    const samples = JSON.parse(await readFile(fixturePath, 'utf8'));
    await mkdir(outputDir, { recursive: true });
    const { server, url } = await startStaticServer();
    const executablePath = await findExistingChromiumExecutable();
    const browser = await chromium.launch({
        headless: true,
        ...(executablePath ? { executablePath } : {})
    });

    try {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        await page.goto(url, { waitUntil: 'load' });
        await page.waitForFunction(() => window.app?.objectManager && window.app?.processAIJSON);

        const results = [];

        for (const sample of samples) {
            const result = await page.evaluate((currentSample) => {
                const app = window.app;
                app.objectManager.clear();
                app.historyManager.clear();
                app.canvas.resetView();
                app.canvas.showGrid = false;
                app.canvas.showXAxis = false;
                app.canvas.showYAxis = false;
                app.processAIJSON(JSON.stringify({ operations: currentSample.operations }));
                app.render();

                const canvas = document.getElementById('mainCanvas');
                const ctx = canvas.getContext('2d');
                const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                let nonWhitePixels = 0;

                for (let i = 0; i < pixels.length; i += 4) {
                    if (pixels[i] < 248 || pixels[i + 1] < 248 || pixels[i + 2] < 248) {
                        nonWhitePixels += 1;
                    }
                }

                const objects = app.objectManager.getAllObjects();

                return {
                    id: currentSample.id,
                    objectCount: objects.length,
                    visibleObjectCount: objects.filter(object => object.visible !== false).length,
                    nonWhitePixels
                };
            }, sample);

            const screenshotPath = path.join(outputDir, `${sample.id}.png`);
            await page.locator('#mainCanvas').screenshot({ path: screenshotPath });
            results.push({ ...result, screenshotPath });
        }

        const failures = results.filter(result => result.objectCount === 0 || result.nonWhitePixels < 100);
        console.log(JSON.stringify({ url, results, failures }, null, 2));

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
