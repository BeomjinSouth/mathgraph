import test from 'node:test';
import assert from 'node:assert/strict';
import { AIService } from '../js/ai/AIService.js';
import { SemanticValidator } from '../js/ai/SemanticValidator.js';

const shortPrompt = '삼각형 ABC에서 AB=AC, ∠B=∠C, BC=6cm, ∠A=40°를 표시해줘.';
const longPrompt = '삼각형 ABC에서 AB=AC, ∠ABC=∠BCA, BC=6cm, ∠BAC=40°를 표시해줘.';
const service = () => new AIService({ provider: 'local', apiKey: '' });
const validate = (json, prompt) => new SemanticValidator().validateExamAnnotationIntent(json, { prompt });

test('three-letter interior angles generate the same verified triangle in one request', async () => {
    const reference = await service().processCommand(shortPrompt);
    const result = await service().processCommand(longPrompt);
    assert.equal(result.success, true, result.error);
    assert.deepEqual(result.json.operations, reference.json.operations);
    const reversed = await service().processCommand('삼각형 ABC에서 AB=AC, ∠CBA=∠ACB, BC=6cm, ∠CAB=40°를 표시해줘.');
    assert.equal(reversed.success, true, reversed.error);
    assert.deepEqual(reversed.json.operations, reference.json.operations);
});

test('three-letter angles require their two rays, visible arcs and correct geometric values', async () => {
    const complete = (await service().processCommand(shortPrompt)).json;
    assert.equal(validate(complete, longPrompt).valid, true);
    for (const mutate of [
        ops => { ops.splice(ops.findIndex(op => op.id === 'angle_B'), 1); },
        ops => { ops.find(op => op.id === 'angle_B').vertexId = 'A'; },
        ops => { ops.find(op => op.id === 'angle_B').point1Id = 'B'; },
        ops => { ops.find(op => op.id === 'angle_B').visible = false; },
        ops => { ops.find(op => op.id === 'angle_C').markerCount = 2; },
        ops => { ops.find(op => op.id === 'A').x += 1; },
        ops => { ops.find(op => op.id === 'A').y += 1; },
        ops => { ops.find(op => op.id === 'angle_A').customText = '140°'; },
        ops => { ops.find(op => op.id === 'length_BC').visible = false; }
    ]) {
        const changed = structuredClone(complete); mutate(changed.operations);
        assert.equal(validate(changed, longPrompt).valid, false, JSON.stringify(changed));
    }
});

test('same ray helper points may replace angle endpoints but opposite extensions may not', async () => {
    const complete = (await service().processCommand(shortPrompt)).json;
    const a = complete.operations.find(op => op.id === 'A');
    const b = complete.operations.find(op => op.id === 'B');
    const helper = { op: 'create', type: 'point', id: 'P', x: 2*a.x-b.x, y: 2*a.y-b.y, showLabel: false };
    complete.operations.unshift(helper);
    complete.operations.find(op => op.id === 'angle_B').point1Id = 'P';
    assert.equal(validate(complete, longPrompt).valid, true);
    helper.x = 2*b.x-a.x; helper.y = 2*b.y-a.y;
    assert.equal(validate(complete, longPrompt).valid, false);
});

test('connected equal-length chains share ticks; independent chains have different ticks', () => {
    const operations = ['A','B','C','D','E','F','G','H'].map((id, i) => ({
        op:'create', type:'point', id, label:id, x:i < 5 ? i : 6 + (i-5)*2, y:i < 5 ? 0 : 2, pointSize:0
    }));
    for (const pair of ['AB','BC','CD','DE','FG','GH']) operations.push({op:'create',type:'segment',id:pair,point1Id:pair[0],point2Id:pair[1]});
    for (const [first, second, ticks] of [['AB','BC',1],['BC','CD',1],['CD','DE',1],['FG','GH',2]])
        operations.push({op:'create',type:'equalLengthMarker',id:`${first}_${second}`,segment1Id:first,segment2Id:second,tickCount:ticks});
    const prompt = 'AB=BC=CD=DE, FG=GH를 같은 길이 표식으로 표시해줘.';
    assert.equal(validate({operations}, prompt).valid, true);
    const last = operations.at(-1); last.tickCount = 1;
    assert.equal(validate({operations}, prompt).valid, false, 'independent group merged');
    last.tickCount = 2;
    operations.find(op => op.id === 'BC_CD').tickCount = 3;
    assert.equal(validate({operations}, prompt).valid, false, 'connected group split');
});

test('a custom length label cannot hide incorrect plane geometry', async () => {
    const complete = (await service().processCommand(shortPrompt)).json;
    complete.operations.find(op => op.id === 'B').x -= 1;
    assert.equal(validate(complete, '삼각형 ABC에서 BC=6cm를 표시해줘.').valid, false);
});

test('midpoints and points on segments retain their computed geometry in annotation checks', () => {
    for (const midpoint of [
        {op:'create',type:'midpoint',id:'M',segmentId:'AB',label:'M'},
        {op:'create',type:'pointOnLine',id:'M',lineId:'AB',t:0.5,label:'M'}
    ]) {
        const operations = [
            {op:'create',type:'point',id:'A',label:'A',x:0,y:0},
            {op:'create',type:'point',id:'B',label:'B',x:4,y:0},
            {op:'create',type:'segment',id:'AB',point1Id:'A',point2Id:'B'}, midpoint,
            {op:'create',type:'segment',id:'AM',point1Id:'A',point2Id:'M'},
            {op:'create',type:'segment',id:'MB',point1Id:'M',point2Id:'B'},
            {op:'create',type:'equalLengthMarker',id:'mark',segment1Id:'AM',segment2Id:'MB',tickCount:1},
            {op:'create',type:'lengthDimension',id:'length',segmentId:'AM',customText:'2 cm'}
        ];
        const prompt = 'AM=MB, AM=2cm를 표시해줘.';
        assert.equal(validate({operations}, prompt).valid, true, midpoint.type);
        if (midpoint.type === 'pointOnLine') {
            midpoint.t = 0.4;
            assert.equal(validate({operations}, prompt).valid, false);
        }
    }
});

test('independent equal-angle groups retain distinct counts and actual equal angles', () => {
    const operations = [];
    for (const [i, [name, degree, markerCount]] of [['AOB',30,1],['CPD',30,1],['ERF',60,2],['GSH',60,2]].entries()) {
        const rad = degree * Math.PI / 180;
        for (const [id,x,y] of [[name[1],i*4,0],[name[0],i*4+2,0],[name[2],i*4+2*Math.cos(rad),2*Math.sin(rad)]])
            operations.push({op:'create',type:'point',id,label:id,x,y});
        operations.push({op:'create',type:'angleDimension',id:name,vertexId:name[1],point1Id:name[0],point2Id:name[2],markerCount,showValue:false});
    }
    const prompt = '∠AOB=∠CPD, ∠ERF=∠GSH를 표시해줘.';
    assert.equal(validate({operations},prompt).valid, true);
    for (const op of operations.filter(op => ['ERF','GSH'].includes(op.id))) op.markerCount = 1;
    assert.equal(validate({operations},prompt).valid, false);
    for (const op of operations.filter(op => ['ERF','GSH'].includes(op.id))) op.markerCount = 2;
    operations.find(op => op.id === 'D').y += 0.4;
    assert.equal(validate({operations},prompt).valid, false);
});
