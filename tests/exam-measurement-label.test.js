import test from 'node:test';
import assert from 'node:assert/strict';
import { AIService } from '../js/ai/AIService.js';
import { SemanticValidator } from '../js/ai/SemanticValidator.js';
import { ObjectManager } from '../js/core/ObjectManager.js';
import { HistoryManager } from '../js/core/HistoryManager.js';
import { PatchApplier } from '../js/ai/PatchApplier.js';
import { reviewGeneratedDrawing } from '../js/ai/DrawingReview.js';
import { measurementLabelMatches } from '../js/ai/MeasurementLabel.js';

const prompt = '삼각형 ABC에서 AB=AC, ∠ABC=∠BCA, BC=6cm, ∠BAC=40°를 표시해줘.';
const service = () => new AIService({ provider: 'local', apiKey: '' });
const validate = (json, request = prompt, context) => new SemanticValidator()
    .validateExamAnnotationIntent(json, { prompt: request, context });

test('numeric annotations compare the whole label and units, not just its prefix', async () => {
    const original = (await service().processCommand(prompt)).json;
    for (const [id, texts] of [
        ['angle_A', ['40+10°', '40/2°', '40x°', '40 rad', '40° = 60°', '40° 이상']],
        ['length_BC', ['6/2 cm', '6+1 cm', '6 m', '6 mm', '6 cm²', '6cm = 9cm', '6cm 이상']]
    ]) for (const customText of texts) {
        const changed = structuredClone(original);
        changed.operations.find(op => op.id === id).customText = customText;
        assert.equal(validate(changed).valid, false, customText);
    }
});

test('equivalent constant labels and unit conversions retain correct mathematical values', async () => {
    const original = (await service().processCommand(prompt)).json;
    for (const [id, texts] of [
        ['angle_A', ['40.0°', '(80/2)°', '20+20°', '2*pi/9 rad', '40']],
        ['length_BC', ['6.00 cm', 'sqrt(36) cm', '60 mm', '0.06 m', '6 ㎝', '6']]
    ]) for (const customText of texts) {
        const changed = structuredClone(original);
        changed.operations.find(op => op.id === id).customText = customText;
        assert.equal(validate(changed).valid, true, customText);
    }
});

test('automatic measurement labels must retain the requested decimals after rounding', () => {
    const degree = 40.49;
    const angle = { operations: [
        { op: 'create', type: 'point', id: 'A', label: 'A', x: 3, y: 0 },
        { op: 'create', type: 'point', id: 'O', label: 'O', x: 0, y: 0 },
        { op: 'create', type: 'point', id: 'B', label: 'B', x: 3*Math.cos(degree*Math.PI/180), y: 3*Math.sin(degree*Math.PI/180) },
        { op: 'create', type: 'angleDimension', id: 'angle', vertexId: 'O', point1Id: 'A', point2Id: 'B', precision: 0 }
    ] };
    const length = { operations: [
        { op: 'create', type: 'point', id: 'A', label: 'A', x: 0, y: 0 },
        { op: 'create', type: 'point', id: 'B', label: 'B', x: 6.125, y: 0 },
        { op: 'create', type: 'segment', id: 'AB', point1Id: 'A', point2Id: 'B' },
        { op: 'create', type: 'lengthDimension', id: 'length', segmentId: 'AB', precision: 1 }
    ] };
    for (const [json, request, enough] of [[angle, '∠AOB=40.49°를 표시해줘.', 2], [length, 'AB=6.125cm를 표시해줘.', 3]]) {
        assert.equal(validate(json, request).valid, false, 'rounded label loses information');
        json.operations.at(-1).precision = enough;
        assert.equal(validate(json, request).valid, true, 'sufficient precision preserves the value');
        json.operations.at(-1).precision = 0;
        json.operations.at(-1).customText = json === angle ? '40.49°' : '6.125 cm';
        assert.equal(validate(json, request).valid, true, 'custom text takes precedence over precision');
    }
});

test('solid and circle numeric dimensions reject misleading full labels', async () => {
    for (const request of [
        '원기둥에서 반지름 3cm, 높이 6cm를 표시해줘.',
        '사각뿔 V-ABCD에서 AB=4cm, 높이 6cm를 표시해줘.',
        '원 O에서 반지름 OA=OB=3cm, ∠AOB=60°, 부채꼴 AOB를 색칠해줘.'
    ]) {
        const result = await service().processCommand(request);
        assert.equal(result.success, true, result.error);
        assert.equal(validate(result.json, request).valid, true);
        for (const op of result.json.operations.filter(op => ['lengthDimension', 'angleDimension'].includes(op.type))) {
            const changed = structuredClone(result.json);
            changed.operations.find(item => item.id === op.id).customText = op.customText.replace(/(\d+(?:\.\d+)?)/, '$1+1');
            assert.equal(validate(changed, request).valid, false, `${request}: ${op.id}`);
        }
    }
});

test('numeric label checks also reject an incorrect existing-object edit without mutation', async () => {
    const ai = service(), generated = await ai.processCommand(prompt);
    const manager = new ObjectManager();
    new PatchApplier(manager, new HistoryManager(manager)).apply(generated.json);
    const angle = manager.getAllObjects().find(obj => obj.type === 'angleDimension' && obj.customText);
    const context = { objects: manager.toJSON().objects }, saved = JSON.stringify(context);
    const wrong = { operations: [{ op: 'update', id: angle.id, customText: '40+10°' }] };
    assert.equal(validate(wrong, prompt, context).valid, false);
    wrong.operations[0].customText = '20+20°';
    assert.equal(validate(wrong, prompt, context).valid, true);
    assert.equal(JSON.stringify(context), saved);
    assert.equal(angle.customText, '40°');
});

test('hidden, empty, nonfinite or malformed labels cannot satisfy a numeric condition', () => {
    for (const customText of ['', ' ', '40/0°', '40..0°', '40°?', '40 cm', '40²°'])
        assert.equal(measurementLabelMatches({ type: 'angleDimension', customText }, 40, 40), false, customText);
    for (const fields of [{ visible: false }, { showValue: false }, { label: false }, { precision: -1 }])
        assert.equal(measurementLabelMatches({ type: 'angleDimension', ...fields }, 40, 40), false);
    assert.equal(measurementLabelMatches({ type: 'lengthDimension' }, 6, NaN), false);
});

test('named Korean angle phrases receive the same numeric and ray checks as the angle symbol', async () => {
    const original = (await service().processCommand(prompt)).json;
    const manager = new ObjectManager();
    new PatchApplier(manager, new HistoryManager(manager)).apply(original);
    const context = { objects: manager.toJSON().objects };
    const angle = manager.getAllObjects().find(obj => obj.type === 'angleDimension' && obj.customText);
    for (const request of ['A각 40°', 'A각은 40도', '각 BAC는 40°', '각 BAC의 크기는 40도', '∠BAC는 40°']) {
        assert.equal(validate(original, request).valid, true, request);
        const incorrect = structuredClone(original);
        incorrect.operations.find(op => op.id === 'angle_A').customText = '40+10°';
        assert.equal(validate(incorrect, request).valid, false, request);
        const changed = { operations: [{ op: 'update', id: angle.id, customText: '40+10°' }] };
        assert.equal(validate(changed, request, context).valid, false, request);
        changed.operations[0].customText = '20+20°';
        assert.equal(validate(changed, request, context).valid, true, request);
    }
    const incorrectRay = structuredClone(original);
    incorrectRay.operations.find(op => op.id === 'angle_A').point1Id = 'A';
    assert.equal(validate(incorrectRay, '각 BAC는 40도').valid, false);
});

test('visual review cannot approve a misleading repair after it passed structural checks', async () => {
    const original = (await service().processCommand(prompt)).json;
    const incorrect = structuredClone(original);
    incorrect.operations.find(op => op.id === 'angle_A').customText = '40+10°';
    let calls = 0;
    const result = await reviewGeneratedDrawing({ json: original,
        prepare: json => ({ json, imageDataUrl: 'data:image/png;base64,AAAA' }),
        validate(json) { const checked = validate(json); if (!checked.valid) throw new Error(checked.errors.join(' ')); },
        review: async () => { calls++; return { verdict: 'revise', checks: [{ condition: '∠BAC=40°',
            evidence: '각도 숫자의 위치 수정이 필요함', status: 'unmet' }], issues: ['각도 글자 수정'], operations: incorrect.operations }; }
    });
    assert.equal(result.status, 'unavailable');
    assert.equal(calls, 1);
    assert.deepEqual(result.candidate.json, original);
    assert.match(result.error, /값이 일치/);
});

test('an explicitly requested algebraic angle label retains the independently specified geometry', async () => {
    const original = (await service().processCommand(prompt)).json;
    original.operations.find(op => op.id === 'angle_A').customText = '(2x+15)°';
    const request = prompt + ' A의 각도 호에 (2x+15)°를 적어줘.';
    assert.equal(validate(original, request).valid, true);
    assert.equal(validate(original, prompt).valid, false, 'an unsolicited formula is not a numeric label');
    for (const customText of ['(2x+16)°', '40x°', '(2x+15) rad']) {
        const changed = structuredClone(original);
        changed.operations.find(op => op.id === 'angle_A').customText = customText;
        assert.equal(validate(changed, request).valid, false, customText);
    }
    const wrong = structuredClone(original);
    wrong.operations.find(op => op.id === 'A').y *= 0.5;
    assert.equal(validate(wrong, request).valid, false, 'the requested formula must not bypass the numeric angle');
    const hidden = structuredClone(original);
    hidden.operations.find(op => op.id === 'angle_A').showValue = false;
    assert.equal(validate(hidden, request).valid, false);
    assert.equal(validate(original, prompt + ' B의 각도 호에 (2x+15)°를 적어줘.').valid, false);
});

test('one correctly anchored dimension can label an explicitly equal length group', () => {
    const request = '평행사변형 ABCD에서 AB=CD=5cm, BC=DA=3cm이다. AB와 BC에 치수를 표시해줘.';
    const original = { operations: [
        ...[['A',0,0],['B',5,0],['C',5,3],['D',0,3]].map(([id,x,y]) => ({op:'create',type:'point',id,label:id,x,y})),
        ...['AB','BC','CD','DA'].map(id => ({op:'create',type:'segment',id,point1Id:id[0],point2Id:id[1]})),
        {op:'create',type:'equalLengthMarker',id:'eq1',segment1Id:'AB',segment2Id:'CD',tickCount:1},
        {op:'create',type:'equalLengthMarker',id:'eq2',segment1Id:'BC',segment2Id:'DA',tickCount:2},
        {op:'create',type:'lengthDimension',id:'long',segmentId:'AB',customText:'5cm'},
        {op:'create',type:'lengthDimension',id:'short',segmentId:'BC',customText:'3cm'}
    ] };
    assert.equal(validate(original, request).valid, true);
    for (const fields of [{customText:'3cm'}, {segmentId:'BC'}, {showValue:false}]) {
        const changed = structuredClone(original);
        Object.assign(changed.operations.find(op => op.id === 'long'), fields);
        assert.equal(validate(changed, request).valid, false);
    }
    const wrong = structuredClone(original);
    wrong.operations.find(op => op.id === 'C').x = 6;
    assert.equal(validate(wrong, request).valid, false, 'an equality mark cannot replace correct geometry');
    assert.equal(validate(original, 'AB=5cm, CD=5cm, BC=3cm, DA=3cm').valid, false,
        'equal numeric values alone do not authorize transferring a dimension');
});
