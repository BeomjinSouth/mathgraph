import { ObjectManager } from '../core/ObjectManager.js';
import { HistoryManager } from '../core/HistoryManager.js';
import { PatchApplier } from './PatchApplier.js';
import { normalizeGeneratedAnnotationStyles } from './DiagramQualityEnhancer.js';
import { layoutGeneratedOperationLabels } from './RenderedLabelLayout.js';

export function prepareFreshCoordinatePlane(canvas, context, request) {
    if (context.objects.length || !/좌표평면|coordinate\s*plane/i.test(request) ||
        /(?:좌표평면|좌표축|축).{0,8}(?:없이|숨|없애|빼|그리지|표시하지)/.test(request)) return false;
    canvas.showXAxis=canvas.showYAxis=true;
    return true;
}

/** Fit only an untouched empty viewport; coordinates and teacher views are never rewritten. */
export function fitFreshDrawingView(canvas, objects, context) {
    if (context.objects.length || Math.abs(context.view.scale-50)>1e-9 ||
        Math.abs(context.view.offset.x)>1e-9 || Math.abs(context.view.offset.y)>1e-9 ||
        objects.some(obj=>obj.type==='function' || typeof obj.getBounds==='function')) return false;
    const points=[];
    for(const object of objects.filter(obj=>obj.valid)) {
        if(object.type!=='textLabel') {
            const point=object.getPosition?.();
            if(Number.isFinite(point?.x)&&Number.isFinite(point?.y))points.push(point);
        }
        const center=object.getCenter?.(),radius=object.getRadius?.();
        if(Number.isFinite(center?.x)&&Number.isFinite(center?.y)&&Number.isFinite(radius)&&radius>0)
            points.push({x:center.x-radius,y:center.y-radius},{x:center.x+radius,y:center.y+radius});
        if(['cylinder','cone','sphere'].includes(object.type)) {
            const center=object.position;
            points.push({x:center.x-object.width/2,y:center.y-object.height/2},
                {x:center.x+object.width/2,y:center.y+object.height/2});
        }
    }
    if(!points.length)return false;
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const marginX=Math.min(120,canvas.width*.18),marginY=Math.min(110,canvas.height*.2);
    const scale=Math.min(160,(canvas.width-2*marginX)/Math.max(1,maxX-minX),(canvas.height-2*marginY)/Math.max(1,maxY-minY));
    if(!Number.isFinite(scale)||scale<=0)return false;
    canvas.scale=scale;canvas.offset.x=(minX+maxX)/2;canvas.offset.y=(minY+maxY)/2;
    return true;
}

/** Reuse the app's complete apply/fit path on isolated objects, history and canvas. */
export function prepareDrawingPreview(app, json, context, intentOptions = {}) {
    const sandbox = Object.create(Object.getPrototypeOf(app));
    sandbox.objectManager = new ObjectManager();
    sandbox.objectManager.fromJSON({ objects: structuredClone(context.objects) });
    const initialObjects = sandbox.objectManager.toJSON().objects;
    const locked = sandbox.objectManager.getAllObjects().filter(obj => obj.locked)
        .map(obj => [obj.id, JSON.stringify(obj.toJSON())]);
    sandbox.objectManager.setDefaultPointParams({ ...app.objectManager.defaultPointParams });
    sandbox.historyManager = new HistoryManager(sandbox.objectManager);
    sandbox.patchApplier = new PatchApplier(sandbox.objectManager, sandbox.historyManager);
    sandbox.schemaValidator = app.schemaValidator;
    sandbox.aiService = app.aiService;
    const element = document.createElement('canvas');
    element.width = Math.max(1, Math.ceil(context.view.width));
    element.height = Math.max(1, Math.ceil(context.view.height));
    sandbox.canvas = Object.assign(Object.create(Object.getPrototypeOf(app.canvas)), app.canvas, context.view, {
        canvas: element, ctx: element.getContext('2d'), offset: { ...context.view.offset },
        labelBounds: [], isExporting: true
    });
    if (!sandbox.canvas.ctx) throw new Error('그림 확인용 화면을 만들지 못했습니다.');
    const messages = [];
    sandbox.addChatMessage = message => messages.push(message);
    for (const name of ['render', 'updateSidebar', 'updateTeacherQualitySummary', 'setTeacherWorkflowState', 'updateZoomDisplay'])
        sandbox[name] = () => {};
    const candidate = structuredClone(json);
    const generated = intentOptions.generated && intentOptions.mode !== 'patch' &&
        app.aiService.config.diagramQualityEnhancement !== false;
    const request = intentOptions.userMessage || intentOptions.instruction || '';
    if (generated) {
        normalizeGeneratedAnnotationStyles(candidate.operations, request);
        prepareFreshCoordinatePlane(sandbox.canvas, context, request);
    }
    if (!sandbox.processAIJSON(candidate, { ...intentOptions, context, trace: null }))
        throw new Error(messages.at(-1) || '그림을 미리 확인하지 못했습니다.');
    if (generated) {
        fitFreshDrawingView(sandbox.canvas, sandbox.objectManager.getAllObjects(), context);
        layoutGeneratedOperationLabels(candidate.operations, { view:sandbox.buildAIContext().view,
            pinnedIds:new Set(candidate.operations.filter(op=>op.locked).map(op=>op.id)),
            existingObjects:context.objects, rerouteLengths:true });
        // Rebuild only the private scene so the reviewed pixels and returned
        // operations contain the exact same final-scale label placements.
        sandbox.objectManager.fromJSON({objects:structuredClone(initialObjects)});
        for (const state of initialObjects) {
            const object=sandbox.objectManager.getObject(state.id);
            if(object)object.createdAt=state.createdAt;
        }
        sandbox.historyManager = new HistoryManager(sandbox.objectManager);
        sandbox.patchApplier = new PatchApplier(sandbox.objectManager, sandbox.historyManager);
        const applied=sandbox.patchApplier.apply(candidate);
        if(!applied.success)throw new Error(applied.message);
    }
    if (locked.some(([id, state]) => JSON.stringify(sandbox.objectManager.getObject(id)?.toJSON()) !== state))
        throw new Error('잠긴 도형을 바꾸는 결과는 자동으로 반영할 수 없습니다.');
    const invalid = sandbox.objectManager.getAllObjects().filter(obj => obj.visible && !obj.valid);
    if (invalid.length) throw new Error('그릴 수 없는 도형이 포함되어 있습니다.');
    const canvas = sandbox.canvas;
    canvas.ctx.fillStyle = canvas.backgroundColor || '#ffffff';
    canvas.ctx.fillRect(0, 0, canvas.width, canvas.height);
    canvas.resetLabelLayout();
    if (canvas.showGrid) canvas.drawGrid();
    if (canvas.showXAxis || canvas.showYAxis) canvas.drawAxes();
    for (const obj of sandbox.getRenderOrderedObjects()) {
        if (!obj.visible) continue;
        // Match the live/export renderer's shared stroke state (for example,
        // rounded line caps), while excluding selection decorations.
        const selected=obj.selected,highlighted=obj.highlighted;
        try { obj.selected=false;obj.highlighted=false;obj.render(canvas); }
        finally { obj.selected=selected;obj.highlighted=highlighted; }
    }
    return { json: candidate, view: sandbox.buildAIContext().view, imageDataUrl: element.toDataURL('image/png') };
}
