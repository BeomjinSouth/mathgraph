import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createProjectEnvelope,
    parseProjectFile,
    validateProjectEnvelope
} from '../js/utils/ProjectFile.js';

test('project envelope round-trips a named document', () => {
    const envelope = createProjectEnvelope({
        name: '수학 모의고사 12번',
        savedAt: '2026-07-10T00:00:00.000Z',
        view: { offset: { x: 1, y: 2 }, scale: 50 },
        objects: [{ id: 'A', type: 'point', x: 0, y: 0 }]
    });

    assert.equal(validateProjectEnvelope(envelope).valid, true);
    assert.equal(parseProjectFile(JSON.stringify(envelope)).name, '수학 모의고사 12번');
    assert.deepEqual(envelope.view, {
        offset: { x: 1, y: 2 },
        scale: 50
    });
});

test('project parsing rejects unknown versions before returning objects', () => {
    assert.throws(
        () => parseProjectFile('{"format":"mathgraph-project","version":2,"objects":[]}'),
        /지원하지 않는 프로젝트 버전/
    );
});

test('project parsing rejects invalid object collections', () => {
    assert.throws(
        () => parseProjectFile('{"format":"mathgraph-project","version":1,"name":"x","savedAt":"2026-07-10T00:00:00.000Z","view":{"offset":{"x":0,"y":0},"scale":50},"objects":{}}'),
        /객체 목록/
    );
});
