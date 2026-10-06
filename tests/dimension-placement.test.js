import test from 'node:test';
import assert from 'node:assert/strict';
import { equivalentPrismEdges, preferExteriorPrismDimensions } from '../js/ai/DimensionPlacement.js';
import { enhanceDiagramQuality } from '../js/ai/DiagramQualityEnhancer.js';
import { SemanticValidator } from '../js/ai/SemanticValidator.js';
import { ObjectManager } from '../js/core/ObjectManager.js';
import { HistoryManager } from '../js/core/HistoryManager.js';
import { PatchApplier } from '../js/ai/PatchApplier.js';
const solid = () => [
    ...[['A',-4,-3],['B',2,-3],['C',2,1],['D',-4,1],['E',-2,-1.5],['F',4,-1.5],['G',4,2.5],['H',-2,2.5]]
        .map(([id,x,y])=>({op:'create',id,type:'point',label:id,x,y,pointSize:0})),
    {op:'create',id:'box',type:'prism',baseVertexIds:['A','B','C','D'],topVertexIds:['E','F','G','H']},
    ...['AB','BC','AE'].map(id=>({op:'create',id,type:'segment',point1Id:id[0],point2Id:id[1],visible:false})),
    ...[['AB','6cm'],['BC','4cm'],['AE','3cm']].map(([side,customText])=>({op:'create',id:'dim'+side,type:'lengthDimension',segmentId:side,customText,labelOnCurve:true}))
];

test('prism dimensions use exact structural equivalence, not an arbitrary equal-looking edge', () => {
    const ops=solid(),points=new Map(ops.filter(o=>o.type==='point').map(o=>[o.id,o])),prism=ops.find(o=>o.type==='prism');
    assert.deepEqual(equivalentPrismEdges(prism,points,['B','C']),[['B','C'],['F','G']]);
    assert.deepEqual(equivalentPrismEdges(prism,points,['E','A']),[['A','E'],['B','F'],['C','G'],['D','H']]);
    assert.deepEqual(equivalentPrismEdges(prism,points,['A','C']),[]);
    points.get('G').x+=.1;
    assert.deepEqual(equivalentPrismEdges(prism,points,['B','C']),[]);
});

test('outer prism anchors preserve vertices, dimension values, operation order and pinned annotations', () => {
    const ops=solid(),coordinates=JSON.stringify(ops.filter(o=>o.type==='point'));
    preferExteriorPrismDimensions(ops,new Set(['dimAB']));
    assert.equal(JSON.stringify(ops.filter(o=>o.type==='point')),coordinates);
    assert.equal(ops.find(o=>o.id==='dimAB').segmentId,'AB');
    for(const [id,side] of [['dimBC','FG'],['dimAE','DH']]) {
        const dim=ops.find(o=>o.id===id),segment=ops.find(o=>o.id===dim.segmentId);
        assert.equal(segment.point1Id+segment.point2Id,side);
        assert.equal(segment.visible,false);
        assert.ok(ops.indexOf(segment)<ops.indexOf(dim));
    }
    const semantic=new SemanticValidator().validateExamAnnotationIntent({operations:ops},{prompt:'직육면체 ABCD-EFGH에서 AB=6cm, BC=4cm, AE=3cm를 표시해줘.'});
    assert.equal(semantic.valid,true,semantic.errors.join(' '));
    const wrong=structuredClone(ops);wrong.find(o=>o.id==='dimBC').segmentId='AB';
    assert.equal(new SemanticValidator().validateExamAnnotationIntent({operations:wrong},{prompt:'BC=4cm, AE=3cm 입체 치수'}).valid,false);
    const pinned=solid();preferExteriorPrismDimensions(pinned,new Set(['dimBC','dimAE']));
    assert.equal(pinned.find(o=>o.id==='dimBC').segmentId,'BC');
    const explicit=solid();preferExteriorPrismDimensions(explicit,new Set(),'AE에 직접 치수를 표시해줘.');
    assert.equal(explicit.find(o=>o.id==='dimAE').segmentId,'AE');
});

test('fresh formula labels become readable without changing an explicit font request or manual position', () => {
    const json={operations:[{op:'create',id:'f',type:'function',expression:'2',fontSize:18,labelMathPos:{x:.75,y:2.3}},
        {op:'create',id:'label',type:'textLabel',text:'y=2',x:.5,y:2.6,fontSize:18}]};
    const fresh=enhanceDiagramQuality(json,'함수식 글자를 크게 해줘.',{preserveExplicitOffsets:false});
    assert.ok(fresh.operations.every(o=>o.fontSize>=24));
    const requested=enhanceDiagramQuality(json,'글자 18px로 그려줘.',{preserveExplicitOffsets:false});
    assert.ok(requested.operations.every(o=>o.fontSize===18));
    assert.deepEqual(requested.operations[1],json.operations[1]);
    assert.deepEqual(enhanceDiagramQuality(json,'교사 그림',{pinnedLabelIds:['f']}),json);
    assert.equal(json.operations[1].fontSize,18,'input is not mutated');
});

test('automatic equality ticks have bounded visual size independent of stroke width and survive saving', () => {
    const manager=new ObjectManager(),history=new HistoryManager(manager);
    const ops={operations:[...[[0,0],[6,0],[0,4],[6,4]].map(([x,y],i)=>({op:'create',id:'p'+i,type:'point',x,y})),
        {op:'create',id:'s1',type:'segment',point1Id:'p0',point2Id:'p1'},
        {op:'create',id:'s2',type:'segment',point1Id:'p2',point2Id:'p3'},
        {op:'create',id:'equal',type:'equalLengthMarker',segment1Id:'s1',segment2Id:'s2',tickCount:2}]};
    assert.equal(new PatchApplier(manager,history).apply(ops).success,true);
    const marker=manager.getAllObjects().find(o=>o.type==='equalLengthMarker');
    const draw=()=>{const calls=[];marker.render({scale:48,drawEqualLengthMarker:(a,b,style)=>calls.push(style)});return calls[0];};
    marker.lineWidth=1;const thin=draw();marker.lineWidth=4;const thick=draw();
    assert.equal(thin.size*thin.lineWidth/2,thick.size*thick.lineWidth/2);
    assert.ok(thin.size*thin.lineWidth/2>=10&&thin.size*thin.lineWidth/2<=16);
    assert.equal(thin.tickCount,2);assert.equal(thin.spacing,thick.spacing);
    const saved=manager.toJSON();manager.fromJSON(saved);
    assert.equal(manager.getAllObjects().find(o=>o.type==='equalLengthMarker').sizeMode,'auto');
    saved.objects.find(o=>o.type==='equalLengthMarker').size=14;
    delete saved.objects.find(o=>o.type==='equalLengthMarker').sizeMode;
    manager.fromJSON(saved);const legacy=manager.getAllObjects().find(o=>o.type==='equalLengthMarker');
    assert.equal(legacy.sizeMode,'fixed');assert.equal(legacy.size,14);
});

test('new generation normalizes model-proposed small annotation styles, not just missing defaults', () => {
    const operations=[
        {op:'create',id:'A',type:'point',x:0,y:0,label:'A',fontSize:16},
        {op:'create',id:'B',type:'point',x:6,y:0,label:'B'},
        {op:'create',id:'C',type:'point',x:0,y:4,label:'C'},
        {op:'create',id:'AB',type:'segment',point1Id:'A',point2Id:'B'},
        {op:'create',id:'AC',type:'segment',point1Id:'A',point2Id:'C'},
        {op:'create',id:'length',type:'lengthDimension',segmentId:'AB',labelFontSize:14},
        {op:'create',id:'angle',type:'angleDimension',vertexId:'A',point1Id:'B',point2Id:'C',labelFontSize:16}
    ];
    const normalized=enhanceDiagramQuality({operations},'시험용 그림을 그려줘.',{preserveExplicitOffsets:false,renderedLayout:false}).operations;
    for(const id of ['length','angle'])assert.equal(normalized.find(o=>o.id===id).labelFontSize,24);
    assert.equal(normalized.find(o=>o.id==='A').fontSize,24);
    const fixed=enhanceDiagramQuality({operations},'글자는 16px이고 같은 길이 눈금의 크기는 20px로 해줘.',{preserveExplicitOffsets:false,renderedLayout:false}).operations;
    assert.equal(fixed.find(o=>o.id==='A').fontSize,16);
    assert.equal(fixed.find(o=>o.id==='angle').labelFontSize,16);
    const teacher=enhanceDiagramQuality({operations},'기존 교사 그림',{renderedLayout:false}).operations;
    assert.equal(teacher.find(o=>o.id==='length').labelFontSize,14);
});
