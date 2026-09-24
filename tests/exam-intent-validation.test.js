import test from 'node:test';
import assert from 'node:assert/strict';
import { AIService } from '../js/ai/AIService.js';

const service = () => new AIService({ provider: 'local', apiKey: '' });
const check = (service, json, prompt) => service.validateCommandResult(json, null,
    { mode: 'command', userMessage: prompt });

test('command validation rejects annotation omissions and wrong attachments', async () => {
    const prompt = '삼각형 ABC에서 AB=AC, ∠B=∠C, BC=6cm, ∠A=40°를 표시해줘.';
    const ai = service();
    const complete = (await ai.processCommand(prompt)).json;
    assert.equal(check(ai, complete, prompt).valid, true);
    const mutations = [
        ops => ops.filter(op => op.type !== 'equalLengthMarker'),
        ops => ops.map(op => op.id === 'equal_AB_AC' ? { ...op, segment2Id: 'BC' } : op),
        ops => ops.filter(op => op.id !== 'angle_C'),
        ops => ops.map(op => op.id === 'angle_A' ? { ...op, customText: '50°' } : op),
        ops => ops.filter(op => op.type !== 'lengthDimension'),
        ops => ops.map(op => op.id === 'length_BC' ? { ...op, segmentId: 'AB' } : op)
    ];
    for (const mutate of mutations) {
        const invalid = { operations: mutate(structuredClone(complete.operations)) };
        assert.equal(check(ai, invalid, prompt).valid, false, JSON.stringify(invalid));
    }
});

test('command validation rejects incomplete function area and tangent even for schema-valid JSON', async () => {
    const prompt = 'f(x)=x^2, g(x)=1, x=-1부터 1까지 두 그래프 사이를 색칠하고 f(x)의 x=0.5에서의 접선을 그려줘.';
    const ai = service();
    const complete = (await ai.processCommand(prompt)).json;
    assert.equal(check(ai, complete, prompt).valid, true);
    for (const omitted of ['functionRegion', 'tangentFunction']) {
        const invalid = { operations: complete.operations.filter(op => op.type !== omitted) };
        assert.equal(check(ai, invalid, prompt).valid, false, omitted);
    }
});

test('independent equal-length groups cannot reuse one tick count', async () => {
    const prompt = '평행사변형 ABCD에서 AB=CD, BC=DA, ∠A=∠C, AB=8cm, ∠A=70°를 표시해줘.';
    const ai = service();
    const complete = (await ai.processCommand(prompt)).json;
    assert.equal(check(ai, complete, prompt).valid, true);
    const invalid = { operations: complete.operations.map(op =>
        op.id === 'equal_BC_DA' ? { ...op, tickCount: 1 } : op) };
    assert.equal(check(ai, invalid, prompt).valid, false);
});

test('command validation rejects a named solid missing its requested vertices', async () => {
    const prompt = '정육면체 ABCD-EFGH에서 모서리 4cm를 표시해줘.';
    const ai = service();
    const complete = (await ai.processCommand(prompt)).json;
    assert.equal(check(ai, complete, prompt).valid, true);
    const invalid = { operations: complete.operations.map(op => op.label === 'H' ? { ...op, label: 'Q' } : op) };
    assert.equal(check(ai, invalid, prompt).valid, false);
});

test('command validation checks radius, height and hidden rear arc of a cylinder', async () => {
    const prompt = '원기둥의 반지름은 3cm, 높이는 6cm이고 뒤쪽 원호는 점선으로 그려줘.';
    const ai = service();
    const complete = (await ai.processCommand(prompt)).json;
    assert.equal(check(ai, complete, prompt).valid, true);
    const mutations = [
        ops => ops.map(op => op.type === 'cylinder' ? { ...op, width: 4 } : op),
        ops => ops.map(op => op.type === 'cylinder' ? { ...op, height: 6 } : op),
        ops => ops.map(op => op.type === 'cylinder' ? { ...op, showHiddenLines: false } : op),
        ops => ops.filter(op => op.id !== 'length_top_rightbottom_right'),
        ops => ops.map(op => op.id === 'length_top_centertop_right' ? { ...op, customText: '4 cm' } : op),
        ops => ops.map(op => op.id === 'top_center' ? { ...op, x: 0.5 } : op),
        ops => ops.map(op => op.id === 'bottom_right' ? { ...op, x: 2.5 } : op)
    ];
    for (const mutate of mutations) {
        const invalid = { operations: mutate(structuredClone(complete.operations)) };
        assert.equal(check(ai, invalid, prompt).valid, false, JSON.stringify(invalid));
    }
});

test('command validation rejects a pyramid with a displaced apex, foot or height annotation', async () => {
    const prompt = '사각뿔 V-ABCD에서 밑면 AB=4cm, 높이 6cm를 표시해줘.';
    const ai = service();
    const complete = (await ai.processCommand(prompt)).json;
    assert.equal(check(ai, complete, prompt).valid, true);
    const mutations = [
        ops => ops.map(op => op.id === 'V' ? { ...op, y: op.y + 1 } : op),
        ops => ops.map(op => op.id === 'height_foot' ? { ...op, x: op.x + 0.5 } : op),
        ops => ops.map(op => op.id === 'height_line' ? { ...op, dashed: false } : op),
        ops => ops.map(op => op.id === 'length_height' ? { ...op, customText: '5 cm' } : op),
        ops => ops.map(op => op.id === 'D' ? { ...op, label: 'Q' } : op),
        ops => ops.filter(op => op.id !== 'length_height')
    ];
    for (const mutate of mutations) {
        const invalid = { operations: mutate(structuredClone(complete.operations)) };
        assert.equal(check(ai, invalid, prompt).valid, false, JSON.stringify(invalid));
    }
});
