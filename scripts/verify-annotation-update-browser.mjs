export async function verifyAnnotationUpdateInApp() {
    const app = window.app;
    const ensure = (ok,message) => { if (!ok) throw Error('annotation-update: '+message); };
    app.objectManager.clear(); app.historyManager.clear();
    app.canvas.scale=50; app.canvas.offset.x=app.canvas.offset.y=0;
    app.aiService.config.provider='local'; app.aiService.config.apiKey='';
    const prompt='삼각형 ABC에서 AB=AC, ∠ABC=∠BCA, BC=6cm, ∠BAC=40°를 표시해줘.';
    const generated=await app.aiService.processCommand(prompt,app.buildAIContext());
    ensure(generated.success,generated.error);
    ensure(app.processAIJSON(generated.json,{mode:'command'}),'initial create rejected');
    app.historyManager.clear();
    const objects=app.objectManager.getAllObjects();
    const points=objects.filter(o=>o.type==='point');
    const teacherState=()=>JSON.stringify(app.objectManager.getAllObjects().filter(o=>o.type==='point')
        .map(o=>({id:o.id,position:o.position,labelOffset:o.labelOffset,fontSize:o.fontSize})));
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
        {op:'update',id:angle.id,arcRadius:0.55,customText:'40.0°',labelFontSize:18,precision:1,labelOffset:{x:-0.16,y:-1}},
        {op:'update',id:length.id,curvature:-72,customText:'6.0 cm',labelFontSize:18,precision:1},
        ...angles.filter(o=>o!==angle).map(o=>({op:'update',id:o.id,markerCount:2,showValue:false}))
    ];
    const instruction='AB=AC, ∠ABC=∠BCA, BC=6cm, ∠BAC=40°를 유지하고 각도 호와 길이 호를 조정하고 각도식은 아래로 옮겨줘.';
    const validation=app.aiService.validateCommandResult({operations},app.buildAIContext(),{mode:'patch',userMessage:instruction});
    ensure(validation.valid,validation.errors.join(' '));
    ensure(app.processAIJSON({operations},{mode:'command',userMessage:instruction}),'update rejected');
    ensure(angle.arcRadius===0.55 && angle.customText==='40.0°' && angle.labelFontSize===18 && angle.precision===1,'angle update ignored');
    ensure(length.curvature===-72 && length.customText==='6.0 cm' && length.labelFontSize===18,'length update ignored');
    ensure(angles.filter(o=>o!==angle).every(o=>o.markerCount===2),'equal-angle count ignored');
    ensure(teacherState()===originalPoints,'teacher coordinates or offsets changed');
    const after=render(); ensure(after!==before,'render did not change');
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
    return {id:'annotation-update',objectCount:objects.length,teacherPositionsPreserved:true,
        undoRedo:true,importExport:true,fixedModelResponse:true,externalModelCalled:false,image:after,project};
}
