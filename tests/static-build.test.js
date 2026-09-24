import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { STATIC_BUILD_TARGETS, buildStaticOutput } from '../scripts/build-static.mjs';

const repoRoot = new URL('..', import.meta.url);

function readRootFile(name) {
    return readFileSync(new URL(name, repoRoot), 'utf8');
}

test('runtime drawing references match the project drawing skill', () => {
    const digest = file => createHash('sha256')
        .update(JSON.stringify(JSON.parse(readRootFile(file))))
        .digest('hex');
    for (const name of ['feature-manual.json', 'retrieval-index.json']) {
        assert.equal(
            digest(`runtime/mathgraph-drawing/references/${name}`),
            digest(`.agents/skills/mathgraph-drawing/references/${name}`),
            `the app and the drawing skill must use the same ${name}`
        );
    }
});

test('vercel config serves the built dist directory instead of the repo root', () => {
    const vercelConfig = JSON.parse(readRootFile('vercel.json'));
    assert.equal(vercelConfig.outputDirectory, 'dist');
    assert.equal(vercelConfig.buildCommand, 'npm run vercel-build');
});

test('the remote build runs the test suite before the static builder', () => {
    const pkg = JSON.parse(readRootFile('package.json'));
    assert.match(
        pkg.scripts['vercel-build'],
        /^node --test && node scripts\/build-static\.mjs$/,
        'vercel-build must fail the deploy on test failure before producing dist'
    );
});

test('the deployment upload includes the test suite and its inputs', () => {
    const ignore = readRootFile('.vercelignore')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));

    for (const required of ['/tests/', '/tools/', '/.agents/']) {
        assert.equal(
            ignore.includes(required),
            false,
            `${required} must upload so the remote node --test runs a nonzero suite`
        );
    }

    // 로컬에서 만든 낡은 dist와 비-런타임 작업물은 업로드하지 않는다.
    for (const excluded of ['/dist/', '/docs/', '/.agent/', '/node_modules/', '/tmp/']) {
        assert.equal(ignore.includes(excluded), true, `${excluded} must stay excluded from uploads`);
    }
});

test('the static builder publishes only whitelisted runtime assets', async () => {
    assert.deepEqual(
        STATIC_BUILD_TARGETS,
        ['index.html', 'favicon.svg', 'css', 'js', 'runtime'],
        'the published surface is the runtime whitelist from the release contract'
    );

    const distUrl = await buildStaticOutput();

    for (const expected of [
        'index.html',
        'favicon.svg',
        'css/styles.css',
        'js/main.js',
        'runtime/mathgraph-drawing/references/retrieval-index.json'
    ]) {
        assert.equal(existsSync(new URL(expected, distUrl)), true, `dist must contain ${expected}`);
    }

    for (const excluded of ['tests', 'docs', 'tools', 'api', 'lib', '.agents', 'node_modules', 'scripts']) {
        assert.equal(existsSync(new URL(excluded, distUrl)), false, `dist must not contain ${excluded}`);
    }
});
