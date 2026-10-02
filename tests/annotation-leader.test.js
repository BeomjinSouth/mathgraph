import test from 'node:test';
import assert from 'node:assert/strict';
import { AngleDimension, LengthDimension } from '../js/objects/Dimension.js';
import { Vec2 } from '../js/utils/Geometry.js';
import { quadraticAt, curveDistance, boxOutsidePolygon, leaderGeometry } from '../js/utils/AnnotationGeometry.js';
import { compactMeasurementText, formatMeasurement } from '../js/utils/MeasurementText.js';
import { ObjectManager } from '../js/core/ObjectManager.js';
import { HistoryManager } from '../js/core/HistoryManager.js';
import { PatchApplier } from '../js/ai/PatchApplier.js';
import { SchemaValidator } from '../js/ai/SchemaValidator.js';
import { AIService, GRAPH_OPERATIONS_JSON_SCHEMA } from '../js/ai/AIService.js';
import { compileSceneGraph } from '../js/ai/SceneGraphCompiler.js';
import { PROBLEM_SCENE_RESPONSE_FORMAT } from '../js/ai/ProblemScenePipeline.js';

function canvas() {
    const calls=[];
    const ctx=new Proxy({calls,measureText:text=>({width:text.length*8,actualBoundingBoxLeft:text.length*4,actualBoundingBoxRight:text.length*4,actualBoundingBoxAscent:8,actualBoundingBoxDescent:3})},
        {get:(o,k)=>k in o?o[k]:(...args)=>calls.push([k,...args])});
    return {ctx,scale:100,toScreen:p=>new Vec2(p.x*100,-p.y*100),toMath:p=>new Vec2(p.x/100,-p.y/100),toScreenLength:n=>n*100,toMathLength:n=>n/100};
}
function setup(degrees=60,params={}) {
    const manager=new ObjectManager(),history=new HistoryManager(manager),c=canvas();
    const v=manager.createPoint(0,0),p=manager.createPoint(4,0),q=manager.createPoint(4*Math.cos(degrees*Math.PI/180),4*Math.sin(degrees*Math.PI/180));
    const d=manager.createAngleDimension(v.id,p.id,q.id,params);
    return {manager,history,c,d,v,p,q};
}
test('rounding 89.6 degrees to 90 never changes its arc into a right-angle square',()=>{
    const {d,c}=setup(89.6,{precision:0});d.render(c);
    assert.equal(d.isRightAngle(),false);assert.ok(c.ctx.calls.some(a=>a[0]==='arc'));
    const right=setup(90);right.d.render(right.c);assert.equal(right.d.isRightAngle(),true);
    assert.equal(right.c.ctx.calls.some(a=>a[0]==='arc'),false);
});
test('large right-angle square is pickable on its visible edge, not an invisible circle',()=>{
    const {d,c}=setup(90,{arcRadius:1.5,showValue:false});d.render(c);
    assert.equal(d.hitTest(new Vec2(.9,.45),5,c),true);
    assert.equal(d.hitTest(new Vec2(1.5*Math.cos(Math.PI/4),1.5*Math.sin(Math.PI/4)),5,c),false);
});
test('right-angle equality marks and multiple arcs retain their existing arc geometry',()=>{
    for(const params of [{arcCount:2},{markerCount:1}]) {
        const {d,c}=setup(90,{showValue:false,...params});d.render(c);
        assert.equal(d.isRightAngle(),false);
        assert.equal(c.ctx.calls.filter(call=>call[0]==='arc').length,params.arcCount||1);
        const radius=d.arcRadius+c.toMathLength((d.arcCount-1)*5);
        assert.equal(d.hitTest(new Vec2(radius/Math.SQRT2,radius/Math.SQRT2),3,c),true);
    }
});
test('detached angle labels keep an editable association and a visible gap at their own arc',()=>{
    const {d,c}=setup(60,{labelOffset:{x:-1.3,y:1},arcRadius:.6});d.render(c);
    assert.ok(d._leaderCurve);const curve=d._leaderCurve,anchor=d.getArcAnchor(c);
    assert.deepEqual(curve.anchor,anchor);
    assert.ok(Math.abs(d.distanceToArc(curve.end,c)-7)<1e-6);
    assert.ok(Math.abs(Math.hypot(anchor.x,anchor.y)-60)<1e-8);
    const b=d._labelBox;assert.ok(curve.start.x<b.x||curve.start.x>b.x+b.w||curve.start.y<b.y||curve.start.y>b.y+b.h);
    const mid=quadraticAt(curve.start,curve.control,curve.end,.5);
    assert.ok(curveDistance(mid,curve)<.001);assert.equal(d.hitTest(c.toMath(mid),5,c),true);assert.equal(d._hitPart,'leader');
    assert.equal(d.hitTest(c.toMath(anchor),5,c),true);assert.equal(d._hitPart,'shape','arrow tip must not steal the arc resize gesture');
});
test('a legible angle value deeper inside the angle has no unnecessary automatic arrow',()=>{
    const {d,c}=setup(40,{labelOffset:{x:1,y:.4},customText:'40.0°',labelFontSize:28});
    d.render(c);assert.equal(d._leaderCurve,null);
    assert.ok(c.ctx.calls.some(call=>call[0]==='fillText' && call[1]==='40°'));
    const before=d.toJSON();d.render(c);assert.deepEqual(d.toJSON(),before);
});
test('integer measurements are compact but expressions, units and fractional values are not misread',()=>{
    for (const [input,expected] of [['40.0°','40°'],['6.0 cm','6cm'],['6.25 cm','6.25cm'],
        ['0.0','0'],['40+10°','40+10°'],['6/2 cm','6/2 cm'],['x+1','x+1']])
        assert.equal(compactMeasurementText(input),expected);
    assert.equal(formatMeasurement(6,2),'6');assert.equal(formatMeasurement(6.25,2),'6.25');
    const {manager,c}=setup();const a=manager.createPoint(0,0),b=manager.createPoint(6,0);
    const segment=manager.createSegment(a.id,b.id),length=manager.createLengthDimension(segment.id,{customText:'6.0 cm'});
    length.render(c);assert.ok(c.ctx.calls.some(call=>call[0]==='fillText' && call[1]==='6cm'));
});
test('an angle uses the current triangle boundary even before the polygon updates after a point move',()=>{
    const {manager,d,c,v,p,q}=setup(40,{labelOffset:{x:1,y:.4},customText:'40°',labelFontSize:28});
    const polygon=manager.createPolygon([v.id,p.id,q.id],{fillOpacity:0,showLabel:false});
    d.update(manager);d.render(c);assert.equal(d._leaderCurve,null);
    p.position=new Vec2(1,0);q.position=new Vec2(Math.cos(40*Math.PI/180),Math.sin(40*Math.PI/180));
    d.update(manager);d.render(c);assert.ok(d._leaderCurve,'text outside the shrunken triangle needs a leader');
    polygon.update(manager);d.update(manager);d.render(c);assert.ok(d._leaderCurve);
});
test('exterior annotation boxes cannot contain, overlap or cross the triangle boundary',()=>{
    const triangle=[{x:0,y:0},{x:-100,y:200},{x:100,y:200}];
    assert.equal(boxOutsidePolygon({x:-40,y:100,w:80,h:30},triangle),false);
    assert.equal(boxOutsidePolygon({x:-160,y:100,w:120,h:30},triangle),false);
    assert.equal(boxOutsidePolygon({x:-180,y:100,w:70,h:30},triangle),true);
    assert.equal(boxOutsidePolygon({x:-200,y:-50,w:400,h:300},triangle),false);
});
test('the leader arrowhead remains readable in proportion to a thick stroke',()=>{
    const {d,c}=setup(40,{labelOffset:{x:-2,y:1},lineWidth:6});
    d.render(c);const end=d._leaderCurve.end;
    const legs=c.ctx.calls.filter(call=>call[0]==='lineTo').slice(-2);
    assert.equal(legs.length,2);
    assert.ok(legs.every(call=>Math.hypot(call[1]-end.x,call[2]-end.y)>20));
});
test('wide exterior expressions retain a leader even when its initial control point lies inside the text box',()=>{
    const box={x:100,y:100,w:150,h:36},anchor={x:70,y:155};
    const curve=leaderGeometry(box,anchor,28,2.5);
    assert.ok(curve,'an exterior expression must not silently lose its arrow');
    assert.ok(curve.start.x<box.x||curve.start.x>box.x+box.w||curve.start.y<box.y||curve.start.y>box.y+box.h);
    assert.ok(Math.hypot(curve.end.x-anchor.x,curve.end.y-anchor.y)>=6.99);
});
test('leader clearance is measured to the visible arc and right-angle edges, not only their middle anchor',()=>{
    for(const degrees of [25,60,90]) {
        const {d,c}=setup(degrees,{labelOffset:{x:-1.3,y:1},arcRadius:.6});
        d.render(c);assert.ok(d._leaderCurve);
        assert.ok(Math.abs(d.distanceToArc(d._leaderCurve.end,c)-7)<1e-6);
    }
});
test('nearby text has no automatic leader and explicit leader modes and hidden values are respected',()=>{
    const {d,c}=setup();d.render(c);assert.equal(d._leaderCurve,null);
    d.labelOffset=new Vec2(-2,1);d.leaderMode='none';d.render(c);assert.equal(d._leaderCurve,null);
    d.leaderMode='always';d.render(c);assert.ok(d._leaderCurve);
    d.showValue=false;d.render(c);assert.equal(d._leaderCurve,null);
});
test('arc radius and leader bend drag both survive undo/redo and project reload',()=>{
    const {d,c,history,manager}=setup(60,{labelOffset:{x:-2,y:1}});d.render(c);
    for(const part of ['shape','leader']){
        d._hitPart=part;const start=new Vec2(.5,.2);d.startDrag(start,c);history.startDrag([d]);
        const before=d.toJSON();d.drag(new Vec2(.9,.8),new Vec2(.4,.6),c);d.endDrag();history.endDrag([d]);const after=d.toJSON();
        assert.notDeepEqual(after,before);history.undo();assert.deepEqual(d.toJSON(),before);history.redo();assert.deepEqual(d.toJSON(),after);d.render(c);
    }
    const copy=new ObjectManager();copy.fromJSON(JSON.parse(JSON.stringify(manager.toJSON())));
    assert.equal(copy.getObject(d.id).leaderCurvature,d.leaderCurvature);assert.equal(copy.getObject(d.id).arcRadius,d.arcRadius);
});
test('attached length text drags the curve through its new position and is undoable',()=>{
    const m=new ObjectManager(),h=new HistoryManager(m),c=canvas();
    const a=m.createPoint(0,0),b=m.createPoint(6,0),s=m.createSegment(a.id,b.id),d=m.createLengthDimension(s.id);
    d.render(c);const before=d.toJSON();d._hitPart='label';d.startDrag(new Vec2(3,.125),c);h.startDrag([d]);
    d.drag(new Vec2(4,-.8),new Vec2(1,-.925),c);d.endDrag();h.endDrag([d]);d.render(c);
    assert.ok(Math.abs(d.labelT-2/3)<1e-8);assert.ok(d.curvature<0);
    const box=d._labelBox;assert.ok(Math.abs(box.x+box.w/2-400)<1);
    assert.ok(Math.abs(d.curvature*2*d.labelT*(1-d.labelT)+80)<1e-8);
    const after=d.toJSON();h.undo();assert.deepEqual(d.toJSON(),before);h.redo();assert.deepEqual(d.toJSON(),after);
    assert.deepEqual(a.position,new Vec2(0,0));assert.deepEqual(b.position,new Vec2(6,0));
});
test('legacy projects keep free length offsets and the old angular text anchor',()=>{
    const a=new AngleDimension('v','p','q',{type:'angleDimension',labelOffset:{x:1,y:2}});
    const l=new LengthDimension('s',{type:'lengthDimension',labelOffset:{x:1,y:2}});
    assert.equal(a.labelPlacement,'legacy');assert.equal(l.labelOnCurve,false);
    const restored=new LengthDimension('s',l.toJSON());assert.equal(restored.labelOnCurve,false);assert.deepEqual(restored.labelOffset,new Vec2(1,2));
});
test('AI create/update, strict schema and scene relation all preserve annotation controls',()=>{
    const {manager,history,d}=setup();const patch=new PatchApplier(manager,history);
    const fields={leaderMode:'always',leaderCurvature:-42,labelPlacement:'centered'};
    assert.equal(patch.apply({operations:[{op:'update',id:d.id,...fields}]}).success,true);
    for(const[k,v]of Object.entries(fields))assert.equal(d[k],v);
    for(const field of ['leaderMode','leaderCurvature','labelPlacement','curvature','precision','dashLength','dashGap','labelOnCurve','labelT'])
        assert.ok(field in GRAPH_OPERATIONS_JSON_SCHEMA.properties.operations.items.properties);
    const style=PROBLEM_SCENE_RESPONSE_FORMAT.schema.properties.scene.properties.relations.items.properties.style;
    for(const field of ['leaderMode','leaderCurvature','labelOnCurve','labelT','dashLength','dashGap']) {
        assert.ok(field in style.properties);assert.ok(style.required.includes(field));
    }
    const compiled=compileSceneGraph({nodes:[{id:'V',kind:'point',x:0,y:0},{id:'P',kind:'point',x:4,y:0},{id:'Q',kind:'point',x:2,y:3}],relations:[{id:'angle',kind:'angleDimension',vertexId:'V',point1Id:'P',point2Id:'Q',...fields}]});
    const op=compiled.operations.find(o=>o.type==='angleDimension');assert.ok(op);for(const[k,v]of Object.entries(fields))assert.equal(op[k],v);
});
test('annotation validators reject invalid controls even for untyped updates',()=>{
    for(const fields of [{leaderMode:'curved'},{leaderCurvature:NaN},{leaderCurvature:301},{dashGap:0},{dashLength:Infinity},{labelOnCurve:'yes'},{labelT:1},{labelPlacement:'random'}])
        assert.equal(new SchemaValidator().validate({operations:[{op:'update',id:'angle',...fields}]}).valid,false);
});
test('retrieved AI context explains when to use the attached curved arrow and includes examples',()=>{
    const ai=new AIService({provider:'local'}),prompt=ai.buildDrawingReferencePromptFromManual({},null,'각도 숫자가 겹치면 곡선 화살표로 표시해줘');
    assert.match(prompt,/leaderMode:auto/);assert.match(prompt,/FROM the text box TO its own angle arc/);assert.match(prompt,/labelOnCurve:true/);
    for (const request of ['지시선으로 연결해줘','곡선 화살표를 붙여줘','점선 간격을 넓혀줘']) {
        const selected=ai.selectDrawingReferenceTypes(request);
        assert.ok(selected.objectTypes.has('angleDimension'), request);
        assert.ok(selected.objectTypes.has('lengthDimension'), request);
    }
});

test('new numeric controls are safe when a project bypasses the AI schema',()=>{
    const d=new LengthDimension('s',{dashLength:-8,dashGap:100,labelOnCurve:'invalid'});
    assert.equal(d.dashLength,1);assert.equal(d.dashGap,40);assert.equal(typeof d.labelOnCurve,'boolean');
    const a=new AngleDimension('v','p','q',{leaderCurvature:1000,leaderMode:'unknown'});
    assert.equal(a.leaderCurvature,300);assert.equal(a.leaderMode,'auto');
});
test('exports preserve curved arrows without the interactive bend handle',()=>{
    const {d,c}=setup(60,{labelOffset:{x:-2,y:1}});d.selected=true;d.render(c);
    assert.equal(c.ctx.calls.filter(v=>v[0]==='arc').length,2);
    c.ctx.calls.length=0;c.isExporting=true;d.render(c);
    assert.ok(d._leaderCurve);assert.equal(c.ctx.calls.filter(v=>v[0]==='arc').length,1);
});
