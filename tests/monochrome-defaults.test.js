import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { SettingsManager } from '../js/core/SettingsManager.js';
import { GeoObject, ObjectType } from '../js/objects/GeoObject.js';
import { Polygon } from '../js/objects/Polygon.js';
import { CircularSegment, Sector } from '../js/objects/Arc.js';

const BLACK = '#000000';

function collectStyleColors(value, found = []) {
    if (Array.isArray(value)) {
        for (const item of value) collectStyleColors(item, found);
        return found;
    }

    if (value && typeof value === 'object') {
        for (const [key, item] of Object.entries(value)) {
            if ((key === 'color' || key === 'fillColor') && typeof item === 'string') {
                found.push({ key, value: item });
            } else {
                collectStyleColors(item, found);
            }
        }
    }

    return found;
}

test('runtime object defaults are monochrome black', () => {
    const defaults = [
        new GeoObject(ObjectType.POINT),
        new GeoObject(ObjectType.SEGMENT),
        new GeoObject(ObjectType.CIRCLE),
        new GeoObject(ObjectType.FUNCTION),
        new GeoObject(ObjectType.VECTOR),
        new Polygon(['A', 'B', 'C']),
        new Sector('c1', 'A', 'B'),
        new CircularSegment('c1', 'A', 'B')
    ];

    for (const object of defaults) {
        assert.equal(object.color, BLACK, `${object.type} stroke color`);
        assert.equal(object.getDefaultColor(), BLACK, `${object.type} getDefaultColor`);
        if ('fillColor' in object) {
            assert.equal(object.fillColor, BLACK, `${object.type} fill color`);
        }
    }
});

test('legacy stored default palette migrates to black', () => {
    const previousLocalStorage = globalThis.localStorage;
    const storage = {
        graphA_settings: JSON.stringify({
            defaultStyles: {
                pointColor: '#6366f1',
                lineColor: '#3b82f6',
                circleColor: '#22c55e',
                functionColor: '#f97316'
            }
        })
    };

    globalThis.localStorage = {
        getItem(key) {
            return storage[key] ?? null;
        },
        setItem(key, value) {
            storage[key] = value;
        }
    };

    try {
        const settings = new SettingsManager();
        for (const key of ['pointColor', 'lineColor', 'circleColor', 'functionColor']) {
            assert.equal(settings.defaultStyles[key], BLACK, key);
        }

        const saved = JSON.parse(storage.graphA_settings);
        assert.equal(saved.defaultStyles.lineColor, BLACK);
    } finally {
        if (previousLocalStorage === undefined) {
            delete globalThis.localStorage;
        } else {
            globalThis.localStorage = previousLocalStorage;
        }
    }
});

test('AI drawing references use black style colors by default', () => {
    const syntheticPath = new URL('../.agents/skills/mathgraph-drawing/references/synthetic-drawing-data.jsonl', import.meta.url);
    const syntheticRecords = readFileSync(syntheticPath, 'utf8')
        .trim()
        .split(/\r?\n/)
        .map(line => JSON.parse(line));

    const pdfSamplesPath = new URL('./fixtures/pdf-ai-drawing-samples.json', import.meta.url);
    const pdfSamples = JSON.parse(readFileSync(pdfSamplesPath, 'utf8'));

    for (const [label, records] of [
        ['synthetic drawing data', syntheticRecords],
        ['PDF drawing samples', pdfSamples]
    ]) {
        for (const { key, value } of collectStyleColors(records)) {
            assert.equal(value, BLACK, `${label} ${key}`);
        }
    }
});
