import test from 'node:test';
import assert from 'node:assert/strict';
import { AIService, GRAPH_OPERATIONS_JSON_SCHEMA, fetchWithTimeout } from '../js/ai/AIService.js';
import { reviewGeneratedDrawing, validateDrawingReview, validateReviewScope, drawingReviewFormat } from '../js/ai/DrawingReview.js';

test('compact review creation schemas retain candidate fields and fallback support without unrelated nulls', () => {
    const candidate=[{op:'create',type:'point',id:'A',x:0,y:0,label:'A',pointSize:0},
        {op:'create',type:'lengthDimension',id:'length',segmentId:'AB',customText:'6cm'}];
    const format=drawingReviewFormat(GRAPH_OPERATIONS_JSON_SCHEMA,candidate);
    const branches=format.schema.properties.operations.items.anyOf;
    const point=branches.find(branch=>branch.properties.type.enum?.[0]==='point');
    assert.ok(point.properties.x&&point.properties.labelOffset&&point.properties.pointStyle);
    assert.equal(point.properties.function1Id,undefined);
    const length=branches.find(branch=>branch.properties.type.enum?.[0]==='lengthDimension');
    assert.ok(length.properties.segmentId&&length.properties.customText&&length.properties.labelT);
    assert.deepEqual(point.required,Object.keys(point.properties));
    assert.equal(point.additionalProperties,false);
    const added=branches.find(branch=>branch.properties.type.enum?.includes('function'));
    assert.ok(added.properties.expression,'a previously absent native type remains supported');
    assert.ok(branches.some(branch=>branch.properties.op.enum.includes('update')&&branch.properties.op.enum.includes('delete')));
    assert.equal(GRAPH_OPERATIONS_JSON_SCHEMA.properties.operations.items.properties.function1Id!==undefined,true,'original schema stays unchanged');
});

const original = { operations: [{ op: 'create', id: 'A', type: 'point', x: 0, y: 0 }] };
const pass = () => ({ verdict: 'pass', checks: [{ condition: '점 A', evidence: '그림에서 확인', status: 'met' }], issues: [], operations: [] });
const revise = () => ({ verdict: 'revise', checks: [{ condition: 'A 위치', evidence: '글자가 선과 겹침', status: 'unmet' }],
    issues: ['글자 겹침'], operations: [{ ...original.operations[0], labelOffset: { x: 20, y: 0 } }] });
const prepare = json => ({ json, imageDataUrl: 'data:image/png;base64,AAAA', view: {} });

test('review inspects a render without mutating input and stops on first pass', async () => {
    let calls = 0;
    const result = await reviewGeneratedDrawing({ json: original, prepare, validate() {}, review: async candidate => {
        calls++;
        assert.equal(candidate.imageDataUrl, 'data:image/png;base64,AAAA');
        candidate.json.operations[0].label = 'A';
        return pass();
    } });
    assert.equal(result.status, 'passed');
    assert.equal(calls, 1);
    assert.equal(original.operations[0].label, undefined);
});

test('a complete repair is validated, rendered again, and capped at two reviews', async () => {
    const stages = [], seen = [], renders = [];
    const result = await reviewGeneratedDrawing({ json: original, prepare: json => { renders.push(json); return prepare(json); },
        validate(json) { assert.equal(json.operations[0].labelOffset.x, 20); }, onProgress: stage => stages.push(stage),
        review: async (candidate, options) => {
            seen.push(candidate.json);
            return options.attempt === 0 ? revise() : pass();
        } });
    assert.equal(result.status, 'passed');
    assert.equal(seen.length, 2);
    assert.equal(renders.length, 2);
    assert.equal(seen[1].operations[0].labelOffset.x, 20);
    assert.deepEqual(stages, ['reviewing', 'reviewing_revision']);
    const unresolved = await reviewGeneratedDrawing({ json: original, prepare, validate() {}, review: async () => revise() });
    assert.equal(unresolved.status, 'needs_attention');
    assert.equal(unresolved.reports.length, 2);
});

test('uncertainty, contradictory pass and malformed replies cannot become a pass', async () => {
    assert.throws(() => validateDrawingReview({ ...pass(), issues: ['겹침'] }));
    assert.throws(() => validateDrawingReview({ ...pass(), checks: [] }));
    assert.throws(() => validateDrawingReview({ ...pass(), checks: [{ condition: 'A', evidence: '', status: 'met' }] }));
    for (const reply of [null, { ...pass(), checks: [{ condition: 'A', evidence: '불명확', status: 'uncertain' }] }]) {
        const result = await reviewGeneratedDrawing({ json: original, prepare, validate() {}, review: async () => reply });
        assert.equal(result.status, 'unavailable');
        assert.deepEqual(result.candidate.json, original);
    }
    const result = await reviewGeneratedDrawing({ json: original, prepare, validate() {},
        review: async () => ({ ...pass(), verdict: 'uncertain', issues: ['선 관계 불명확'] }) });
    assert.equal(result.status, 'needs_attention');
});

test('revision cannot expand edits to existing or locked objects or drop original creates', () => {
    const initial = { operations: [...original.operations, { op: 'update', id: 'teacher', labelOffset: { x: 0, y: 2 } }] };
    const context = { objects: [{ id: 'teacher' }, { id: 'other' }] };
    validateReviewScope(initial, structuredClone(initial), context);
    for (const change of [
        copy => { copy.operations[1].id = 'other'; },
        copy => { copy.operations[1].x = 20; },
        copy => { copy.operations.push({ op: 'delete', id: 'other' }); },
        copy => { copy.operations.shift(); },
        copy => { copy.operations[0].type = 'circle'; },
        copy => { copy.operations.push({ op: 'create', id: 'teacher', type: 'point', x: 3, y: 4 }); }
    ]) {
        const modified = structuredClone(initial); change(modified);
        assert.throws(() => validateReviewScope(initial, modified, context));
    }
    assert.throws(() => validateReviewScope(initial, initial, { objects: [{ id: 'teacher', locked: true }] }));
});

test('failed semantic repair retains the last valid draft and makes no second call', async () => {
    let calls = 0;
    const result = await reviewGeneratedDrawing({ json: original, prepare, review: async () => { calls++; return revise(); },
        validate() { throw new Error('길이 조건 불일치'); } });
    assert.equal(result.status, 'unavailable');
    assert.equal(calls, 1);
    assert.deepEqual(result.candidate.json, original);
    assert.match(result.error, /길이 조건/);
});

test('local generation runs no model review; cancellation blocks a late pass', async () => {
    assert.equal((await reviewGeneratedDrawing({ json: original, prepare })).status, 'local');
    const controller = new AbortController();
    await assert.rejects(reviewGeneratedDrawing({ json: original, prepare, signal: controller.signal, validate() {},
        review: async () => { controller.abort(); return pass(); } }), { name: 'AbortError' });
});

test('OpenAI review includes rendered/source images, original conditions, strict output and no history mutation', async () => {
    const service = new AIService({ provider: 'openai', apiKey: 'synthetic-key', model: 'gpt-5.6-luna', save() {} });
    service.buildDrawingReferencePrompt = async () => 'SUPPORTED FIELDS';
    let body, reviewTimeout;
    const oldFetch = globalThis.fetch;
    const oldTimeout = AbortSignal.timeout;
    AbortSignal.timeout = milliseconds => { reviewTimeout = milliseconds; return oldTimeout(milliseconds); };
    globalThis.fetch = async (url, init) => {
        body = JSON.parse(init.body);
        return new Response(JSON.stringify({ output_text: JSON.stringify(pass()) }));
    };
    try {
        await service.reviewRenderedDrawing({ request: 'AB=5cm, 각도 호를 확인', context: { objects: [] },
            candidate: prepare(original), sourceImage: 'data:image/png;base64,BBBB' });
        assert.equal(body.text.format.name, 'drawing_review');
        assert.equal(body.text.format.strict, true);
        assert.equal(body.store, false);
        assert.equal(body.max_output_tokens, 16384);
        assert.ok(reviewTimeout > 90000 && reviewTimeout <= 240000,
            'a large structured OpenAI repair must fit within the upstream time budget');
        assert.equal(body.input[1].content.filter(item => item.type === 'input_image').length, 2);
        assert.match(body.input[1].content[0].text, /AB=5cm/);
        assert.match(body.input[0].content, /SUPPORTED FIELDS/);
        assert.equal(service.conversationHistory.length, 0);
        assert.deepEqual(drawingReviewFormat(GRAPH_OPERATIONS_JSON_SCHEMA).schema.required,
            ['verdict', 'checks', 'issues', 'operations']);
    } finally { globalThis.fetch = oldFetch; AbortSignal.timeout = oldTimeout; }
});

test('Gemini review sends image bytes and obeys local validation without history mutation', async () => {
    const service = new AIService({ provider: 'gemini', apiKey: 'synthetic-key', model: 'test-model', save() {} });
    service.buildDrawingReferencePrompt = async () => '';
    const oldFetch = globalThis.fetch;
    let body;
    globalThis.fetch = async (url, init) => {
        body = JSON.parse(init.body);
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(pass()) }] } }] }));
    };
    try {
        validateDrawingReview(await service.reviewRenderedDrawing({ request: '점 A', context: {}, candidate: prepare(original) }));
        assert.equal(body.contents[0].parts[1].inlineData.mimeType, 'image/png');
        assert.equal(body.contents[0].parts[1].inlineData.data, 'AAAA');
        assert.equal(service.conversationHistory.length, 0);
    } finally { globalThis.fetch = oldFetch; }
});

test('fetch cancellation immediately aborts the transport and remains distinct from timeout', async () => {
    const oldFetch = globalThis.fetch, controller = new AbortController();
    globalThis.fetch = async (url, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    });
    try {
        const request = fetchWithTimeout('https://synthetic.invalid', { signal: controller.signal });
        controller.abort();
        await assert.rejects(request, { name: 'AbortError' });
        await assert.rejects(fetchWithTimeout('https://synthetic.invalid', { signal: controller.signal }), { name: 'AbortError' });
        const timedOut = await reviewGeneratedDrawing({ json: original, prepare,
            review: async () => { throw new DOMException('timeout', 'TimeoutError'); } });
        assert.equal(timedOut.status, 'unavailable');
        assert.match(timedOut.error, /시간이 초과/);
    } finally { globalThis.fetch = oldFetch; }
});

test('cancellation still reaches response-body reads after response headers arrive', async () => {
    const oldFetch = globalThis.fetch, controller = new AbortController();
    globalThis.fetch = async (url, { signal }) => ({ json: () => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    }) });
    try {
        const response = await fetchWithTimeout('https://synthetic.invalid', { signal: controller.signal });
        const body = response.json();
        controller.abort();
        await assert.rejects(body, { name: 'AbortError' });
    } finally { globalThis.fetch = oldFetch; }
});
