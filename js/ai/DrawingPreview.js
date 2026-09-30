import { ObjectManager } from '../core/ObjectManager.js';
import { HistoryManager } from '../core/HistoryManager.js';
import { PatchApplier } from './PatchApplier.js';

/** Reuse the app's complete apply/fit path on isolated objects, history and canvas. */
export function prepareDrawingPreview(app, json, context, intentOptions = {}) {
    const sandbox = Object.create(Object.getPrototypeOf(app));
    sandbox.objectManager = new ObjectManager();
    sandbox.objectManager.fromJSON({ objects: structuredClone(context.objects) });
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
    if (!sandbox.processAIJSON(candidate, { ...intentOptions, context, trace: null }))
        throw new Error(messages.at(-1) || '그림을 미리 확인하지 못했습니다.');
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
        canvas.ctx.save();
        try { obj.render(canvas); } finally { canvas.ctx.restore(); }
    }
    return { json: candidate, view: sandbox.buildAIContext().view, imageDataUrl: element.toDataURL('image/png') };
}
