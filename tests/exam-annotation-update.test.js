import test from 'node:test';
import assert from 'node:assert/strict';
import { AIService } from '../js/ai/AIService.js';
import { ObjectManager } from '../js/core/ObjectManager.js';
import { HistoryManager } from '../js/core/HistoryManager.js';
import { PatchApplier } from '../js/ai/PatchApplier.js';
import { SchemaValidator } from '../js/ai/SchemaValidator.js';

async function setup() {
    const ai = new AIService({provider:'local',apiKey:''});
    const result = await ai.processCommand('삼각형 ABC에서 AB=AC, ∠B=∠C, BC=6cm, ∠A=40°를 표시해줘.');
    assert.equal(result.success, true, result.error);
    const manager = new ObjectManager(), history = new HistoryManager(manager);
    const patch = new PatchApplier(manager, history);
    assert.equal(patch.apply(result.json).success, true);
    history.clear();
    return {ai,manager,history,patch};
}

test('dimension updates change the requested values and survive undo, redo and project reload', async () => {
    const {manager,history,patch} = await setup();
    const angle = manager.getAllObjects().find(op => op.type === 'angleDimension' && op.customText);
    const length = manager.getAllObjects().find(op => op.type === 'lengthDimension');
    const before = manager.toJSON();
    const changes = {operations:[
        {op:'update',id:angle.id,arcRadius:0.4,markerCount:2,showValue:false,customText:'40°',labelFontSize:19,precision:0},
        {op:'update',id:length.id,curvature:72,customText:'6.0 cm',labelFontSize:18,precision:1}
    ]};
    assert.equal(new SchemaValidator().validate(changes).valid, true);
    assert.equal(patch.apply(changes).success, true);
    assert.deepEqual([angle.arcRadius,angle.markerCount,angle.showValue,angle.labelFontSize,angle.precision],[0.4,2,false,19,0]);
    assert.deepEqual([length.curvature,length.customText,length.labelFontSize,length.precision],[72,'6.0 cm',18,1]);
    const after = manager.toJSON();
    history.undo(); assert.deepEqual(manager.toJSON(),before);
    history.redo(); assert.deepEqual(manager.toJSON(),after);
    const restored = new ObjectManager(); restored.fromJSON(after);
    const drawingState = data => data.objects.map(({createdAt,...object}) => object);
    assert.deepEqual(drawingState(restored.toJSON()),drawingState(after));
    assert.equal(patch.apply({operations:[{op:'update',id:length.id,customText:null}]}).success,true);
    assert.equal(length.customText,null);
});

test('one request can add a numeric angle using existing teacher points without moving them', async () => {
    const {ai,manager} = await setup();
    const objects = manager.getAllObjects();
    const point = name => objects.find(op => op.type === 'point' && op.label === name);
    const original = objects.find(op => op.type === 'angleDimension' && op.vertexId === point('A').id);
    const context = {objects:manager.toJSON().objects};
    const saved = JSON.stringify(context);
    const command = {operations:[{op:'update',id:original.id,showValue:true,customText:'40°',arcRadius:0.45}]};
    assert.equal(ai.validateCommandResult(command,context,{mode:'patch',userMessage:'∠BAC=40°의 각도 호를 줄여줘.'}).valid,true);
    assert.equal(JSON.stringify(context),saved);
    const create = {operations:[{op:'create',id:'new_angle',type:'angleDimension',vertexId:point('A').id,
        point1Id:point('B').id,point2Id:point('C').id,showValue:true,customText:'40°'}]};
    assert.equal(ai.validateCommandResult(create,context,{mode:'command',userMessage:'∠BAC=40°를 표시해줘.'}).valid,true);
    const wrong = {operations:[{op:'update',id:original.id,showValue:true,customText:'70°'}]};
    assert.equal(ai.validateCommandResult(wrong,context,{mode:'patch',userMessage:'∠BAC=40°를 표시해줘.'}).valid,false);
    assert.equal(JSON.stringify(context),saved);
});

test('annotation validation uses the updated and deleted geometry, not the earlier canvas', async () => {
    const {ai,manager} = await setup();
    const objects = manager.getAllObjects(), context = {objects:manager.toJSON().objects};
    const a = objects.find(op => op.label === 'A');
    const marker = objects.find(op => op.type === 'equalLengthMarker');
    for (const operations of [
        [{op:'update',id:a.id,x:1}],
        [{op:'delete',id:marker.id}],
        [{op:'update',id:marker.id,visible:false}]
    ]) assert.equal(ai.validateCommandResult({operations},context,{mode:'patch',userMessage:'AB=AC를 유지해줘.'}).valid,false);
    assert.equal(a.position.x,0);
    assert.equal(marker.visible,true);
    manager.createCurvedSolid('sphere',{x:20,y:20,width:4,height:4});
    const withSolid = {objects:manager.toJSON().objects};
    assert.equal(ai.validateCommandResult({operations:[{op:'update',id:a.id,x:1}]},withSolid,
        {mode:'patch',userMessage:'AB=AC를 유지해줘.'}).valid,false,'unrelated solid must not bypass plane measurement');
});

test('dimension update validation rejects invalid numbers even when update omits its type', () => {
    const validator = new SchemaValidator();
    for (const fields of [{arcRadius:0},{curvature:Infinity},{markerCount:-1},{labelFontSize:0},{precision:-1},{precision:101},{showValue:'yes'}])
        assert.equal(validator.validate({operations:[{op:'update',id:'dim',...fields}]}).valid,false,JSON.stringify(fields));
});

test('new geometry on an occupied canvas resolves its remapped references in annotation validation', async () => {
    const ai=new AIService({provider:'local',apiKey:''});
    const manager=new ObjectManager();
    manager.createPoint(20,20,{label:'Z',pointSize:0});
    const context={objects:manager.toJSON().objects};
    for (const prompt of [
        '삼각형 ABC에서 AB=AC, ∠ABC=∠BCA, BC=6cm, ∠BAC=40°를 표시해줘.',
        '원 O에서 반지름 OA=OB=3cm, ∠AOB=60°, 부채꼴 AOB를 색칠해줘.',
        '사각뿔 V-ABCD에서 AB=4cm, 높이 6cm를 표시해줘.'
    ]) {
        const result=await ai.processCommand(prompt,context);
        assert.equal(result.success,true,result.error);
    }
});
