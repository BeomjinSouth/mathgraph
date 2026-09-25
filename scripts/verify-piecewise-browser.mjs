export const piecewiseBrowserCases = [
    { id: 'piecewise-jump', text: '구간별 함수 f(x)=x+1 (-2<=x<0), f(x)=x^2 (0<=x<=2)의 그래프를 그려줘.',
        domains: [[-2, 0], [0, 2]], endpoints: [[-2, -1, 'closed'], [0, 1, 'open'], [0, 0, 'closed'], [2, 4, 'closed']],
        outside: [[-1, 1], [1, 2]] },
    { id: 'piecewise-shaded-jump', text: '구간별 함수 f(x)={x+1 (-2<=x<0); x^2 (0<=x<=2)}와 y=1/2 사이의 넓이를 색칠해줘.',
        domains: [[-2, 0], [0, 2]], areas: [[-2, 0], [0, 2]], baseline: 0.5,
        endpoints: [[-2, -1, 'closed'], [0, 1, 'open'], [0, 0, 'closed'], [2, 4, 'closed']],
        inside: [[-1.5, -0.2], [-0.25, 0.65], [1.5, 1.4]], outside: [[-1.5, 0.9], [1.5, -0.3]] },
    { id: 'piecewise-gap', text: '구간별 함수 f(x)={sin(x) (-pi<=x<0); sqrt(x) (0<=x<=1); 1/x (2<x<=4)}와 x축 사이에서 x=-pi/2부터 3까지의 넓이를 색칠해줘.',
        domains: [[-Math.PI, 0], [0, 1], [2, 4]], areas: [[-Math.PI / 2, 0], [0, 1], [2, 3]], baseline: 0,
        endpoints: [[-Math.PI, 0, 'closed'], [0, 0, 'closed'], [1, 1, 'closed'], [2, 0.5, 'open'], [4, 0.25, 'closed']],
        inside: [[-1, -0.4], [0.64, 0.4], [2.5, 0.2]], outside: [[1.5, 0.3], [3.5, 0.15], [-2, -0.4]] },
    { id: 'piecewise-hole', text: '구간별 함수 f(x)={x+1 (-2<=x<0); 1-x (0<x<=2)}의 그래프를 그려줘.',
        domains: [[-2, 0], [0, 2]], endpoints: [[-2, -1, 'closed'], [0, 1, 'open'], [2, -1, 'closed']],
        outside: [[0.5, 1.5], [-0.5, 1.5]] },
    { id: 'symbolic-sine', text: 'f(x)=sin(x), y=1/2, x=0부터 pi까지 함수와 직선 사이의 넓이를 색칠해줘.',
        domains: [[0, Math.PI]], areas: [[0, Math.PI]], baseline: 0.5,
        inside: [[1.57, 0.75], [0.2, 0.35]], outside: [[1.57, 0.25], [0.2, 0.7]] },
    { id: 'symbolic-max', text: 'f(x)=max(x,0), y=-1/2, x=-3/2부터 3/2까지 함수와 직선 사이를 색칠해줘.',
        domains: [[-1.5, 1.5]], areas: [[-1.5, 1.5]], baseline: -0.5,
        inside: [[-0.7, -0.25], [0.8, 0.4]], outside: [[-0.7, 0.25], [0.8, -0.8]] }
];

export async function verifyPiecewiseInApp(spec) {
    const app = window.app;
    const close = (a, b) => Math.abs(a - b) < 1e-8;
    const ensure = (ok, message) => { if (!ok) throw Error(spec.id + ': ' + message); };
    app.objectManager.clear();
    app.historyManager.clear();
    app.canvas.scale = 50;
    app.canvas.offset.x = app.canvas.offset.y = 0;
    app.canvas.showXAxis = app.canvas.showYAxis = true;
    app.aiService.config.provider = 'local';
    app.aiService.config.apiKey = '';
    const result = await app.aiService.processCommand(spec.text, app.buildAIContext());
    ensure(result.success, result.error);
    ensure(app.processAIJSON(result.json, { mode: result.mode, userMessage: spec.text, generated: true }), 'canvas rejected result');
    const objects = app.objectManager.getAllObjects();
    ensure(objects.every(object => object.valid), 'invalid object');
    const graphs = objects.filter(object => object.type === 'function');
    ensure(graphs.length === spec.domains.length && graphs.every((graph, i) =>
        close(graph.xMin, spec.domains[i][0]) && close(graph.xMax, spec.domains[i][1])), 'domain mismatch');
    const areas = objects.filter(object => object.type === 'functionRegion');
    ensure(areas.length === (spec.areas?.length || 0), 'area count mismatch');
    ensure(areas.every((area, i) => close(area.xMin, spec.areas[i][0]) && close(area.xMax, spec.areas[i][1]) &&
        close(area.baselineY, spec.baseline)), 'shading boundary mismatch');
    const points = objects.filter(object => object.type === 'point');
    ensure(points.length === (spec.endpoints?.length || 0), 'endpoint count mismatch');
    for (const [x, y, style] of spec.endpoints || [])
        ensure(points.some(point => close(point.position.x, x) && close(point.position.y, y) && point.pointStyle === style), 'endpoint mismatch');
    const render = () => {
        const canvas = document.createElement('canvas');
        app.renderSceneToCanvas(canvas, { includeGrid: false, includeAxes: true, includeBackground: true });
        return canvas;
    };
    const image = render();
    for (const graph of graphs.filter(graph => graph.showLabel)) {
        const box = graph.getLabelBounds(app.canvas);
        ensure(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= image.width && box.y + box.height <= image.height,
            'function label clipped');
    }
    const pixel = (position, dx = 0, dy = 0) => {
        const p = app.canvas.toScreen({ x: position[0], y: position[1] });
        ensure(p.x >= 10 && p.y >= 10 && p.x < image.width - 10 && p.y < image.height - 10, 'clipped sample');
        return image.getContext('2d').getImageData(Math.round(p.x + dx), Math.round(p.y + dy), 1, 1).data[0];
    };
    const inside = (spec.inside || []).map(position => pixel(position));
    const outside = (spec.outside || []).map(position => pixel(position));
    ensure(inside.every(value => value < 245) && outside.every(value => value > 240), 'wrong shaded pixels ' + JSON.stringify({ inside, outside }));
    const endpointPixels = (spec.endpoints || []).map(([x, y, style]) => {
        const center = pixel([x, y]);
        const rim = Math.min(pixel([x, y], 5.8, 0), pixel([x, y], -5.8, 0), pixel([x, y], 0, 5.8));
        ensure(style === 'open' ? center > 245 && rim < 160 : center < 40, 'wrong endpoint pixels ' + JSON.stringify({ x, y, style, center, rim }));
        return { x, y, style, center, rim };
    });
    const png = image.toDataURL(), count = objects.length;
    app.historyManager.undo();
    ensure(app.objectManager.getAllObjects().length === 0, 'undo failed');
    app.historyManager.redo();
    ensure(app.objectManager.getAllObjects().length === count && render().toDataURL() === png, 'redo changed picture');
    const project = app.buildProjectEnvelope();
    await app.importProjectFile(new File([JSON.stringify(project)], spec.id + '.mathgraph.json', { type: 'application/json' }));
    ensure(render().toDataURL() === png, 'save/import changed picture');
    return { id: spec.id, domains: spec.domains, endpointPixels, inside, outside,
        undoRedo: true, importExport: true, png, project, graphA: result.json };
}
