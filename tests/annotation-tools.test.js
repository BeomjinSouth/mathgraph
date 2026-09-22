import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectManager } from '../js/core/ObjectManager.js';
import { HistoryManager } from '../js/core/HistoryManager.js';
import { EqualAngleTool, CoordinateGuidesTool } from '../js/tools/AnnotationTools.js';
import { LengthDimensionTool } from '../js/tools/DimensionTool.js';
import { RightAngleTool, EqualLengthTool, ParallelMarkerTool } from '../js/tools/MarkerTool.js';
import { Vec2 } from '../js/utils/Geometry.js';
import { remapObjectReferences } from '../js/utils/ObjectReferences.js';

function setup() {
    const calls = [];
    const ctx = new Proxy({}, { get: (target, key) => key in target ? target[key] :
        key === 'measureText' ? () => ({ width: 22 }) : (...args) => calls.push([key, ...args]) });
    const manager = new ObjectManager();
    const app = { objectManager: manager, historyManager: new HistoryManager(manager),
        canvas: { ctx, scale: 50, toScreen: p => new Vec2(p.x * 50, -p.y * 50),
            toScreenLength: v => v * 50, toMathLength: v => v / 50 },
        render() {}, showToast() {}, toolManager: { returnToSelect() {} } };
    return { app, manager, calls, point: (x, y) => manager.createPoint(x, y, { pointSize: 0 }) };
}
function click(tool, app, position) { tool.onMouseDown(position, app.canvas.toScreen(position), {}, app); }
function reload(manager) {
    const restored = new ObjectManager();
    restored.fromJSON(JSON.parse(JSON.stringify(manager.toJSON())));
    return restored;
}

test('same-angle tool creates two symbolic marks in one undo and preserves independent vertices', () => {
    const { app, manager, point } = setup();
    const points = [point(4, 0), point(0, 0), point(3, 3), point(9, 0), point(5, 0), point(8, 3)];
    const tool = new EqualAngleTool();
    tool.activate(app);
    for (const p of points) click(tool, app, p.getPosition());
    const angles = manager.getAllObjects().filter(o => o.type === 'angleDimension');
    assert.equal(angles.length, 2);
    assert.deepEqual(angles.map(o => [o.showValue, o.markerCount]), [[false, 1], [false, 1]]);
    assert.equal(app.historyManager.undoStack.length, 1);
    app.historyManager.undo();
    assert.equal(manager.getAllObjects().length, 6);
    app.historyManager.redo();
    assert.equal(manager.getAllObjects().length, 8);
    assert.equal(reload(manager).getObject(angles[0].id).markerCount, 1);
});

test('same-angle cancellation and selecting the same angle twice leave no marks', () => {
    const { app, manager, point } = setup();
    const points = [point(4, 0), point(0, 0), point(3, 3)];
    const tool = new EqualAngleTool();
    tool.activate(app);
    for (const p of [...points, ...points.toReversed()]) click(tool, app, p.getPosition());
    assert.equal(manager.getAllObjects().length, 3);
    tool.cancel(app);
    assert.equal(tool.points.length, 0);
    assert.equal(app.historyManager.undoStack.length, 0);
});

test('polygon length annotation creates an invisible segment, follows vertices and undoes atomically', () => {
    const { app, manager, point, calls } = setup();
    const points = [point(0, 0), point(4, 0), point(4, 3)];
    manager.createPolygon(points.map(p => p.id));
    click(new LengthDimensionTool(), app, new Vec2(2, 0));
    const dimension = manager.getAllObjects().find(o => o.type === 'lengthDimension');
    assert.equal(dimension.getLength(), 4);
    assert.equal(manager.getObject(dimension.segmentId).visible, false);
    dimension.curvature = -80;
    dimension.lineStyle = 'dotted';
    dimension.render(app.canvas);
    assert.ok(calls.some(([key, dash]) => key === 'setLineDash' && dash.join() === '1,4'));
    const restored = reload(manager).getObject(dimension.id);
    assert.equal(restored.curvature, -80);
    assert.equal(restored.lineStyle, 'dotted');
    points[1].setPosition(6, 0);
    manager.updateAll();
    assert.equal(dimension.getLength(), 6);
    app.historyManager.undo();
    assert.equal(manager.getAllObjects().length, 4);
    app.historyManager.redo();
    assert.equal(manager.getAllObjects().length, 6);
});

test('equal-length and parallel marks accept polygon edges without leaving helpers on cancel', () => {
    for (const Tool of [EqualLengthTool, ParallelMarkerTool]) {
        const { app, manager, point } = setup();
        manager.createPolygon([point(0, 0), point(4, 0), point(4, 3), point(0, 3)].map(p => p.id));
        const tool = new Tool();
        tool.activate(app);
        click(tool, app, new Vec2(2, 0));
        tool.cancel(app);
        assert.equal(manager.getAllObjects().length, 5);
        click(tool, app, new Vec2(2, 0));
        click(tool, app, new Vec2(2, 3));
        assert.equal(manager.getAllObjects().length, 8);
        app.historyManager.undo();
        assert.equal(manager.getAllObjects().length, 5);
        app.historyManager.redo();
        assert.equal(reload(manager).getAllObjects().filter(o => o.type.endsWith('Marker')).length, 1);
    }
});

test('right-angle tool rejects oblique lines and creates a hidden intersection in one undo', () => {
    const { app, manager, point } = setup();
    const a = point(0, 0), b = point(4, 0), c = point(0, 3), d = point(4, 3);
    manager.createSegment(a.id, b.id);
    manager.createSegment(a.id, c.id);
    manager.createSegment(a.id, d.id);
    const tool = new RightAngleTool();
    tool.activate(app);
    click(tool, app, new Vec2(2, 0));
    click(tool, app, new Vec2(2, 1.5));
    assert.equal(manager.getAllObjects().length, 7);
    assert.equal(app.historyManager.undoStack.length, 0);
    click(tool, app, new Vec2(2, 0));
    click(tool, app, new Vec2(0, 1.5));
    assert.equal(manager.getAllObjects().find(o => o.type === 'intersection').visible, false);
    assert.equal(manager.getAllObjects().find(o => o.type === 'rightAngleMarker').valid, true);
    app.historyManager.undo();
    assert.equal(manager.getAllObjects().length, 7);
    app.historyManager.redo();
    assert.equal(manager.getAllObjects().length, 9);
});

test('angle rendering does not round an oblique angle into a right angle; double arcs remain selectable', () => {
    const { app, manager, point, calls } = setup();
    const a = point(4, 0), b = point(0, 0), c = point(0.02, 4);
    const angle = manager.createAngleDimension(b.id, a.id, c.id, { precision: 0, showValue: false });
    angle.render(app.canvas);
    assert.equal(calls.filter(([key]) => key === 'arc').length, 1);
    calls.length = 0;
    angle.arcCount = 3;
    angle.render(app.canvas);
    assert.equal(calls.filter(([key]) => key === 'arc').length, 3);
    const radius = angle.arcRadius + 10 / app.canvas.scale;
    assert.equal(angle.hitTest(new Vec2(radius / Math.sqrt(2), radius / Math.sqrt(2)), 2, app.canvas), true);
    assert.equal(reload(manager).getObject(angle.id).arcCount, 3);
});

test('coordinate guides track dependent points in all quadrants and omit zero-length legs', () => {
    for (const [x, y] of [[3, 2], [-3, 2], [-3, -2], [3, -2]]) {
        const { app, manager, point } = setup();
        const source = point(x, y);
        const guides = manager.createCoordinateGuides(source.id);
        assert.deepEqual(guides.getSegments().map(([, end]) => [end.x, end.y]), [[x, 0], [0, y]]);
        assert.equal(guides.hitTest(new Vec2(x, y / 2), 3, app.canvas), true);
        guides.render(app.canvas);
        source.setPosition(0, y);
        manager.updateAll();
        assert.equal(guides.getSegments().length, 1);
        assert.equal(reload(manager).getObject(guides.id).position.x, 0);
        const mapped = remapObjectReferences(guides.toJSON(), new Map([[source.id, 'copy-point']]));
        assert.equal(mapped.originId, 'copy-point');
        assert.deepEqual(mapped.dependencies, ['copy-point']);
    }
});

test('coordinate guide tool reuses existing guides and source deletion removes the dependent guide', () => {
    const { app, manager, point } = setup();
    const a = point(2, 3), b = point(6, 3);
    const segment = manager.createSegment(a.id, b.id);
    const mid = manager.createMidpoint(segment.id);
    const tool = new CoordinateGuidesTool();
    click(tool, app, mid.getPosition());
    click(tool, app, mid.getPosition());
    const guides = manager.getAllObjects().filter(o => o.type === 'coordinateGuides');
    assert.equal(guides.length, 1);
    a.setPosition(4, 5);
    manager.updateAll();
    assert.deepEqual(guides[0].position, new Vec2(5, 4));
    manager.removeObject(mid.id);
    assert.equal(manager.getObject(guides[0].id), undefined);
});

test('large angle radius and signed length curvature remain stable on click and undo a drag', () => {
    const { app, manager, point } = setup();
    const a = point(0, 0), b = point(4, 0), c = point(3, 3);
    const angle = manager.createAngleDimension(a.id, b.id, c.id, { arcRadius: 5 });
    angle._hitPart = 'shape';
    app.historyManager.startDrag([angle]);
    angle.startDrag(new Vec2(5, 0), app.canvas);
    angle.drag(new Vec2(5, 0), new Vec2(0, 0), app.canvas);
    assert.equal(angle.arcRadius, 5);
    angle.drag(new Vec2(6, 0), new Vec2(1, 0), app.canvas);
    app.historyManager.endDrag([angle]);
    angle.endDrag();
    assert.equal(angle.arcRadius, 6);
    app.historyManager.undo();
    assert.equal(angle.arcRadius, 5);
    app.historyManager.redo();
    assert.equal(angle.arcRadius, 6);
    const line = manager.createSegment(a.id, b.id);
    const length = manager.createLengthDimension(line.id, { curvature: 400 });
    length._hitPart = 'shape';
    length.startDrag(new Vec2(2, 4), app.canvas);
    length.drag(new Vec2(2, 4.1), new Vec2(0, 0.1), app.canvas);
    assert.ok(length.curvature > 400);
});

test('legacy distinct equal-length groups above five survive reloading', () => {
    const { manager, point } = setup();
    const a = point(0, 0), b = point(4, 0), c = point(0, 3), d = point(4, 3);
    const ab = manager.createSegment(a.id, b.id), cd = manager.createSegment(c.id, d.id);
    const mark = manager.createEqualLengthMarker(ab.id, cd.id, { tickCount: 7 });
    assert.equal(reload(manager).getObject(mark.id).tickCount, 7);
});

test('outer parallel chevrons are selectable and reversed segment endpoints keep the same direction', () => {
    const { app, manager, point } = setup();
    const a = point(0, 0), b = point(4, 0), c = point(0, 3), d = point(4, 3);
    const ab = manager.createSegment(a.id, b.id), dc = manager.createSegment(d.id, c.id);
    const mark = manager.createParallelMarker(ab.id, dc.id, { tickCount: 5, size: 40 });
    const paths = mark.getMarkerPaths(app.canvas);
    assert.equal(paths.length, 10);
    assert.ok(paths.every(([a, b]) => b.x > a.x));
    const tip = paths[4][1];
    assert.equal(mark.hitTest(new Vec2(tip.x / 50, -tip.y / 50), 2, app.canvas), true);
});

test('coordinate value remains selectable when the source lies on an axis without a visible leg', () => {
    const { app, manager, point } = setup();
    const source = point(3, 0);
    const guide = manager.createCoordinateGuides(source.id, { showY: false });
    guide.render(app.canvas);
    assert.equal(guide.getSegments().length, 0);
    assert.equal(guide.hitTest(new Vec2(3, -0.2), 2, app.canvas), true);
});
