export async function verifyAnnotationUpdateInApp(placement = 'centered') {
    const app = window.app;
    const ensure = (ok,message) => { if (!ok) throw Error('annotation-update: '+message); };
    app.objectManager.clear(); app.historyManager.clear();
    app.canvas.scale=50; app.canvas.offset.x=app.canvas.offset.y=0;
    app.aiService.config.provider='local'; app.aiService.config.apiKey='';
    const prompt='삼각형 ABC에서 AB=AC, ∠ABC=∠BCA, BC=6cm, ∠BAC=40°를 표시해줘.';
    const generated=await app.aiService.processCommand(prompt,app.buildAIContext());
    ensure(generated.success,generated.error);
    for (const op of generated.json.operations.filter(op=>op.type==='angleDimension')) op.labelPlacement=placement;
    ensure(app.processAIJSON(generated.json,{mode:'command'}),'initial create rejected');
    app.historyManager.clear();
    const objects=app.objectManager.getAllObjects();
    const points=objects.filter(o=>o.type==='point');
    const teacherState=()=>JSON.stringify(app.objectManager.getAllObjects().filter(o=>o.type==='point')
        .map(o=>({id:o.id,position:o.position,labelOffset:o.labelOffset})));
    const originalPoints=teacherState();
    const angles=objects.filter(o=>o.type==='angleDimension');
    const angle=angles.find(o=>o.customText);
    const length=objects.find(o=>o.type==='lengthDimension');
    const render=()=>{
        const canvas=document.createElement('canvas');
        app.renderSceneToCanvas(canvas,{includeGrid:false,includeAxes:false,includeBackground:true});
        return canvas.toDataURL();
    };
    const before=render();
    const operations=[
        // The legacy anchor adds +8/-8 screen pixels; a centered label must not inherit its x compensation.
        {op:'update',id:angle.id,arcRadius:0.55,customText:'40°',labelFontSize:28,precision:1,
            labelOffset:{x:placement==='legacy' ? -0.16 : 0,y:-1}},
        {op:'update',id:length.id,curvature:-72,customText:'6cm',labelFontSize:28,precision:1},
        ...angles.filter(o=>o!==angle).map(o=>({op:'update',id:o.id,markerCount:1,showValue:false})),
        ...points.map(o=>({op:'update',id:o.id,fontSize:34}))
    ];
    const instruction='AB=AC, ∠ABC=∠BCA, BC=6cm, ∠BAC=40°를 유지하고 각도 호와 길이 호를 조정하고 각도식은 아래로 옮겨줘.';
    const validation=app.aiService.validateCommandResult({operations},app.buildAIContext(),{mode:'patch',userMessage:instruction});
    ensure(validation.valid,validation.errors.join(' '));
    ensure(app.processAIJSON({operations},{mode:'command',userMessage:instruction}),'update rejected');
    ensure(angle.arcRadius===0.55 && angle.customText==='40°' && angle.labelFontSize===28 && angle.precision===1,'angle update ignored');
    ensure(angle.labelPlacement===placement,'requested anchor was not preserved');
    ensure(length.curvature===-72 && length.customText==='6cm' && length.labelFontSize===28,'length update ignored');
    ensure(points.every(o=>o.fontSize===34),'point names did not grow');
    ensure(angles.filter(o=>o!==angle).every(o=>o.markerCount===1),'equal-angle count ignored');
    ensure(teacherState()===originalPoints,'teacher coordinates or offsets changed');
    const after=render(); ensure(after!==before,'render did not change');
    ensure(!angle._leaderCurve,'legible interior value has an unnecessary arrow');
    const vertices=points.map(point=>app.canvas.toScreen(point.position));
    const box=angle._labelBox;
    ensure(box,'angle label has no measured box');
    for (const [x,y] of [[box.x,box.y],[box.x+box.w,box.y],[box.x,box.y+box.h],[box.x+box.w,box.y+box.h]]) {
        const crosses=vertices.map((v,i)=>{
            const next=vertices[(i+1)%vertices.length];
            return (next.x-v.x)*(y-v.y)-(next.y-v.y)*(x-v.x);
        });
        ensure(crosses.every(value=>value>=0)||crosses.every(value=>value<=0),'angle label crosses triangle sides');
    }
    app.historyManager.undo(); ensure(render()===before,'undo pixels changed');
    app.historyManager.redo(); ensure(render()===after,'redo pixels changed');
    const project=app.buildProjectEnvelope();
    await app.importProjectFile(new File([JSON.stringify(project)],'annotation-update.mathgraph.json',{type:'application/json'}));
    ensure(render()===after,'saved update pixels changed');
    ensure(teacherState()===originalPoints,'reloaded teacher coordinates changed');
    ensure(app.objectManager.getObject(angle.id).labelPlacement===placement,'saved angle anchor changed');
    // Also run the real natural-language service flow with a fixed model response.
    // This checks integration without claiming an external-model success rate.
    const ai=app.aiService, savedProvider=ai.config.provider, savedCall=ai.callOpenAI, savedCredentials=ai.hasProviderCredentials;
    const existingAngle=app.objectManager.getAllObjects().find(o=>o.id===angle.id);
    const restore={operations:[{op:'update',id:existingAngle.id,arcRadius:0.5,customText:'40°',labelFontSize:16}]};
    try {
        ai.config.provider='openai'; ai.hasProviderCredentials=()=>true;
        ai.callOpenAI=async()=>JSON.stringify(restore);
        const answer=await ai.processCommand('기존 ∠BAC=40°의 각도 호를 조금 줄여줘.',app.buildAIContext());
        ensure(answer.success,answer.error);
        ensure(app.processAIJSON(answer.json,{mode:'command'}),'fixed model update rejected');
        ensure(existingAngle.arcRadius===0.5 && existingAngle.labelFontSize===16,'fixed model update ignored');
        app.historyManager.undo(); ensure(render()===after,'model edit undo failed');
    } finally { ai.config.provider=savedProvider; ai.callOpenAI=savedCall; ai.hasProviderCredentials=savedCredentials; }
    return {id:'annotation-update',placement,objectCount:objects.length,teacherPositionsPreserved:true,unnecessaryLeaderRemoved:true,
        undoRedo:true,importExport:true,fixedModelResponse:true,externalModelCalled:false,image:after,project};
}

export async function verifyExteriorAngleInApp() {
    const app=window.app,ensure=(ok,message)=>{if(!ok)throw Error('exterior-angle: '+message);};
    const {enhanceDiagramQuality}=await import('/js/ai/DiagramQualityEnhancer.js');
    const {boxOutsidePolygon}=await import('/js/utils/AnnotationGeometry.js');
    app.objectManager.clear();app.historyManager.clear();
    app.canvas.scale=50;app.canvas.offset.x=app.canvas.offset.y=0;
    const half=.3,height=half/Math.tan(20*Math.PI/180);
    const operations=[
        {op:'create',type:'point',id:'A',label:'A',x:0,y:height/2,pointSize:0},
        {op:'create',type:'point',id:'B',label:'B',x:-half,y:-height/2,pointSize:0},
        {op:'create',type:'point',id:'C',label:'C',x:half,y:-height/2,pointSize:0},
        {op:'create',type:'polygon',id:'triangle',vertexIds:['A','B','C'],fillOpacity:0,showLabel:false},
        {op:'create',type:'angleDimension',id:'apex',vertexId:'A',point1Id:'B',point2Id:'C',
            arcRadius:.2,customText:'40.0°',labelFontSize:28}
    ];
    const prepared=enhanceDiagramQuality({operations},'삼각형의 꼭지각 40°를 읽기 쉽게 표시해줘.',
        {preserveExplicitOffsets:false,view:{width:app.canvas.width,height:app.canvas.height,scale:50}});
    ensure(app.processAIJSON(prepared,{mode:'command'}),'create rejected');
    const render=()=>{const c=document.createElement('canvas');
        app.renderSceneToCanvas(c,{includeGrid:false,includeAxes:false,includeBackground:true});return c.toDataURL();};
    const image=render(),angle=app.objectManager.getAllObjects().find(o=>o.type==='angleDimension');
    const polygon=app.objectManager.getAllObjects().find(o=>o.type==='polygon');
    ensure(boxOutsidePolygon(angle._labelBox,polygon.vertices.map(p=>app.canvas.toScreen(p))),'number is not outside triangle');
    ensure(angle._leaderCurve,'exterior number lost its leader');
    const curve=angle._leaderCurve,anchor=angle.getArcAnchor(app.canvas);
    const gap=Math.hypot(curve.end.x-anchor.x,curve.end.y-anchor.y);
    ensure(Math.abs(angle.distanceToArc(curve.end,app.canvas)-7)<1e-6,'tip touches its visible arc');
    const vertex=app.canvas.toScreen(angle.vertex),radius=angle.arcRadius*app.canvas.scale;
    const nearestArcGap=Math.min(...Array.from({length:101},(_,i)=>{
        const t=angle.startAngle+angle.angle*i/100;
        return Math.hypot(curve.end.x-vertex.x-radius*Math.cos(t),curve.end.y-vertex.y+radius*Math.sin(t));
    }));
    ensure(nearestArcGap>=6.99,'tip is too close to another part of its arc');
    const project=app.buildProjectEnvelope();
    const stableObjects=objects=>JSON.stringify(objects,(key,value)=>key==='createdAt'?undefined:value);
    const before=stableObjects(project.objects);
    app.historyManager.undo();ensure(app.objectManager.getAllObjects().length===0,'undo failed');
    app.historyManager.redo();ensure(render()===image,'redo pixels changed');
    await app.importProjectFile(new File([JSON.stringify(project)],'angle-outside.mathgraph.json',{type:'application/json'}));
    ensure(render()===image,'saved pixels changed');
    ensure(stableObjects(app.buildProjectEnvelope().objects)===before,'saved objects changed');
    return {id:'angle-outside',outsideTriangle:true,tipGap:gap,nearestArcGap,
        undoRedo:true,importExport:true,externalModelCalled:false,image,project};
}
