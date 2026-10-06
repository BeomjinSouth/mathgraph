import test from 'node:test';
import assert from 'node:assert/strict';
import { fitFreshDrawingView, prepareFreshCoordinatePlane, prepareDrawingPreview } from '../js/ai/DrawingPreview.js';

test('a requested coordinate plane is prepared natively without axis stand-in objects',()=>{
    const canvas={...view(),showXAxis:false,showYAxis:false};
    assert.equal(prepareFreshCoordinatePlane(canvas,{objects:[]},'좌표평면에 y=2를 그려줘.'),true);
    assert.equal(canvas.showXAxis,true);assert.equal(canvas.showYAxis,true);
    for(const [objects,request] of [[[{id:'teacher'}],'좌표평면에 함수를 추가해줘.'],
        [[], '좌표평면 없이 함수만 그려줘.'],[[],'좌표평면에 그리되 축은 숨겨줘.'],[[],'삼각형을 그려줘.']]){
        const fixed={showXAxis:false,showYAxis:false};
        assert.equal(prepareFreshCoordinatePlane(fixed,{objects},request),false);
        assert.deepEqual(fixed,{showXAxis:false,showYAxis:false});
    }
});

const view=()=>({width:960,height:540,scale:50,offset:{x:0,y:0}});
const points=()=>[[20,10],[26,10],[24,18]].map(([x,y])=>({type:'point',valid:true,getPosition:()=>({x,y})}));

test('fresh preview framing makes off-screen geometry visible without changing its coordinates',()=>{
    const objects=points(),coordinates=objects.map(o=>o.getPosition()),canvas=view();
    assert.equal(fitFreshDrawingView(canvas,objects,{objects:[],view:view()}),true);
    for(const point of coordinates){
        assert.ok(Math.abs(point.x-canvas.offset.x)*canvas.scale<canvas.width/2-40);
        assert.ok(Math.abs(point.y-canvas.offset.y)*canvas.scale<canvas.height/2-40);
    }
    assert.deepEqual(objects.map(o=>o.getPosition()),coordinates);
    assert.ok(Number.isFinite(canvas.scale)&&canvas.scale>0);
});

test('preview framing preserves teacher scenes and manually adjusted views',()=>{
    for(const context of [{objects:[{id:'teacher'}],view:view()},
        {objects:[],view:{...view(),scale:80}},{objects:[],view:{...view(),offset:{x:2,y:0}}}]){
        const canvas=structuredClone(context.view),before=structuredClone(canvas);
        assert.equal(fitFreshDrawingView(canvas,points(),context),false);
        assert.deepEqual(canvas,before);
    }
    const canvas=view();
    assert.equal(fitFreshDrawingView(canvas,[...points(),{type:'function',valid:true}],{objects:[],view:view()}),false,
        'function domains use the existing graph fitting path');
});

test('circle extents are framed, not just its center and radius endpoint',()=>{
    const center={x:12,y:7},radius=5,canvas=view();
    assert.equal(fitFreshDrawingView(canvas,[{type:'circle',valid:true,getCenter:()=>center,getRadius:()=>radius}],{objects:[],view:view()}),true);
    assert.ok(radius*canvas.scale<Math.min(canvas.width,canvas.height)/2-40);
    assert.deepEqual(canvas.offset,center);
});

test('preview keeps the same shared stroke state as live export without selection decorations',()=>{
    const previousDocument=globalThis.document;
    const ctx={lineCap:'butt',fillRect(){}};
    const seen=[];
    const objects=[{visible:true,selected:true,highlighted:true,render(canvas){
        seen.push([this.selected,this.highlighted]);canvas.ctx.lineCap='round';
    }},{visible:true,render(canvas){seen.push(canvas.ctx.lineCap);}}];
    const element={getContext:()=>ctx,toDataURL:()=>`rendered:${ctx.lineCap}`};
    globalThis.document={createElement:()=>element};
    class PreviewApp {
        processAIJSON(){return true;}
        getRenderOrderedObjects(){return objects;}
        buildAIContext(){return {view:this.canvas};}
    }
    try {
        const app=new PreviewApp();
        app.objectManager={defaultPointParams:{}};
        app.aiService={config:{}};
        app.canvas={...view(),resetLabelLayout(){}};
        const preview=prepareDrawingPreview(app,{operations:[]},{objects:[],view:view()});
        assert.deepEqual(seen,[[false,false],'round']);
        assert.equal(preview.imageDataUrl,'rendered:round');
        assert.equal(objects[0].selected,true);assert.equal(objects[0].highlighted,true);
    } finally {
        if(previousDocument===undefined)delete globalThis.document;
        else globalThis.document=previousDocument;
    }
});
