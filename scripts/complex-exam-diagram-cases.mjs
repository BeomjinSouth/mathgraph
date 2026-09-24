// New source cases stay separate from the teacher-reviewed 24 and the original 100.
// The third variation in each family is withheld from the initial repair cycle.
export function buildComplexExamDiagramCases() {
    const names = [
        '이등변삼각형의 각·길이', '평행사변형의 독립 표식', '맞꼭지각과 연장선',
        '원의 같은 현과 중심각', '접선과 수선·치수', '각기둥의 숨은 모서리',
        '각뿔의 숨은 모서리', '포물선과 수평선의 넓이', '포물선과 직선의 넓이',
        '사인곡선의 넓이', '지수함수와 수평선의 넓이', '역함수 가지의 넓이',
        '삼차함수 두 영역', '제곱근함수와 직선의 넓이', '부채꼴과 원호의 음영'
    ];
    const cases = [];
    for (let family = 0; family < names.length; family++) {
        for (let variant = 0; variant < 3; variant++) {
            const operations = [], conditions = [];
            const id = `C${String(family * 3 + variant + 1).padStart(3, '0')}`;
            const turn = family <= 4 ? [0, 0.25, -0.32][variant] : 0;
            const point = (name, x, y, props = {}) => {
                if (turn) [x, y] = [x * Math.cos(turn) - y * Math.sin(turn), x * Math.sin(turn) + y * Math.cos(turn)];
                operations.push({ op: 'create', type: 'point', id: name, x, y, label: name,
                    pointSize: 0, fontSize: 27, ...props });
            };
            const add = (type, name, props = {}) => {
                operations.push({ op: 'create', type, id: name, lineWidth: 3, showLabel: false, ...props });
                return name;
            };
            const segment = (a, b, props = {}) => add('segment', `${a}${b}`, { point1Id: a, point2Id: b, ...props });
            const angle = (a, v, b, text = null, marks = 0, radius = 0.58) => {
                const name = `ang_${a}${v}${b}`;
                add('angleDimension', name, { point1Id: a, vertexId: v, point2Id: b,
                    markerCount: marks, arcRadius: radius, showValue: Boolean(text),
                    ...(text ? { customText: text, labelFontSize: 22 } : {}) });
                conditions.push({ kind: 'angle-arc', id: name, points: [a, v, b], radius, marks });
                if (text) conditions.push({ kind: 'angle-label', id: name, points: [a, v, b], display: text });
                return name;
            };
            const length = (a, b, text, curvature) => {
                const lineId = `${a}${b}`;
                if (!operations.some(o => o.id === lineId)) segment(a, b, { visible: false });
                const name = `len_${a}${b}`;
                add('lengthDimension', name, { segmentId: lineId, curvature, customText: text, labelFontSize: 22 });
                conditions.push({ kind: 'length-label', id: name, display: text, curvature });
                conditions.push({ kind: 'length-curve', id: name, dashed: true, lineWidth: 3 });
            };
            const equalLength = (name, a, b, c, d, ticks) => {
                for (const [u, v] of [[a, b], [c, d]])
                    if (!operations.some(o => o.id === `${u}${v}`)) segment(u, v, { visible: false });
                add('equalLengthMarker', name, { segment1Id: `${a}${b}`, segment2Id: `${c}${d}`, tickCount: ticks });
                conditions.push({ kind: 'equal-length', id: name, segments: [`${a}${b}`, `${c}${d}`], ticks });
            };
            const functionGraph = (name, expression, xMin, xMax, label = name) =>
                add('function', name, { expression, xMin, xMax, label, showLabel: true, fontSize: 20 });
            const region = (name, function1Id, function2Id, xMin, xMax, baselineY, probes) => {
                add('functionRegion', name, { function1Id, ...(function2Id ? { function2Id } : { baselineY }),
                    xMin, xMax, fillColor: '#000000', fillOpacity: 0.2 });
                conditions.push({ kind: 'function-region', id: name, function1Id,
                    function2Id: function2Id || null, xMin, xMax, baselineY, probes });
            };
            if (family === 0) {
                point('A', -3, -1.5); point('B', 3, -1.5); point('C', 0, 3.3);
                add('polygon', 'outline', { vertexIds: ['A', 'B', 'C'], fillOpacity: 0 });
                equalLength('equalACBC', 'A', 'C', 'B', 'C', 1);
                const first = angle('B', 'A', 'C', null, 1);
                const second = angle('A', 'B', 'C', null, 1);
                conditions.push({ kind: 'equal-angle', ids: [first, second], marks: 1 });
                angle('A', 'C', 'B', variant === 1 ? '2x+20°' : 'x°', 0, 0.7);
                length('A', 'B', variant === 1 ? '3x+12 cm' : '2√7 cm', -88);
            } else if (family === 1) {
                [['A', -3, -2], ['B', 2, -2], ['C', 3, 1.6], ['D', -2, 1.6]]
                    .forEach(([name, x, y]) => point(name, x, y));
                add('polygon', 'outline', { vertexIds: ['A', 'B', 'C', 'D'], fillOpacity: 0 });
                equalLength('equalLong', 'A', 'B', 'C', 'D', 1);
                equalLength('equalShort', 'B', 'C', 'D', 'A', 2);
                const a = angle('D', 'A', 'B', null, 1);
                const c = angle('B', 'C', 'D', null, 1);
                conditions.push({ kind: 'equal-angle', ids: [a, c], marks: 1 });
                length('A', 'B', variant === 2 ? 'x+17' : '12 cm', -80);
            } else if (family === 2) {
                point('A', -3, -2); point('B', 3, 2); point('C', -3, 2); point('D', 3, -2);
                segment('A', 'B'); segment('C', 'D');
                add('intersection', 'O', { object1Id: 'AB', object2Id: 'CD', label: 'O', showLabel: true,
                    fontSize: 27, pointSize: 0 });
                const a = angle('A', 'O', 'C', null, 2, 0.72);
                const b = angle('B', 'O', 'D', null, 2, 0.72);
                conditions.push({ kind: 'equal-angle', ids: [a, b], marks: 2 });
                angle('C', 'O', 'B', variant === 1 ? '3x−10°' : 'y°', 0, 1.12);
            } else if (family === 3) {
                point('O', 0, 0); point('R', 3, 0, { visible: false, showLabel: false });
                add('circle', 'circle', { centerId: 'O', pointOnCircleId: 'R' });
                for (const [name, x, y] of [['A', -2.4, 1.8], ['B', 2.4, 1.8], ['C', -2.4, -1.8], ['D', 2.4, -1.8]])
                    point(name, x, y);
                segment('A', 'B'); segment('C', 'D'); segment('O', 'A'); segment('O', 'B');
                equalLength('chords', 'A', 'B', 'C', 'D', 1);
                const a = angle('A', 'O', 'B', null, 1, 0.6);
                const c = angle('C', 'O', 'D', null, 1, 0.6);
                conditions.push({ kind: 'equal-angle', ids: [a, c], marks: 1 });
                length('A', 'B', variant === 2 ? '2a+3' : 'a+5', 85);
            } else if (family === 4) {
                point('O', 0, 0); point('A', 3, 0); point('T', 3, 2.8);
                add('circle', 'circle', { centerId: 'O', pointOnCircleId: 'A' });
                segment('O', 'A'); segment('A', 'T');
                add('rightAngleMarker', 'right', { vertexId: 'A', line1Id: 'OA', line2Id: 'AT' });
                conditions.push({ kind: 'right', points: ['O', 'A', 'T'] });
                length('O', 'A', variant === 1 ? 'r+2' : '3 cm', -70);
            } else if (family === 5) {
                const depth = [1.5, 1.9, 2.3][variant];
                for (const [name, x, y] of [['A', -3, -2], ['B', 1, -2], ['C', 1, 1], ['D', -3, 1],
                    ['E', -3 + depth, -2 + 1], ['F', 1 + depth, -2 + 1], ['G', 1 + depth, 2], ['H', -3 + depth, 2]])
                    point(name, x, y);
                add('prism', 'solid', { baseVertexIds: ['A', 'B', 'C', 'D'], topVertexIds: ['E', 'F', 'G', 'H'] });
                conditions.push({ kind: 'solid-edges', id: 'solid', minDashed: 1, minSolid: 5, front: ['A', 'B'],
                    hidden: [['A', 'E'], ['E', 'F'], ['E', 'H']] });
                length('A', 'B', variant === 2 ? '3x+2' : '8 cm', -85);
            } else if (family === 6) {
                for (const [name, x, y] of [['A', -3, -1.5], ['B', 1.5, -2], ['C', 3, 0], ['D', -1.5, 0.6],
                    ['V', -0.7 + variant * 0.15, 3.5]]) point(name, x, y);
                add('pyramid', 'solid', { baseVertexIds: ['A', 'B', 'C', 'D'], apexId: 'V' });
                conditions.push({ kind: 'solid-edges', id: 'solid', minDashed: 1, minSolid: 4, front: ['A', 'B'],
                    hidden: [['C', 'D'], ['D', 'A'], ['D', 'V']] });
                length('A', 'B', variant === 1 ? '√61 cm' : 'x+5', -85);
            } else if (family === 7) {
                const h = [1, 2, 3][variant];
                functionGraph('f', 'x^2', -2, 2);
                functionGraph('g', `${h}`, -2, 2);
                const r = Math.sqrt(h);
                region('area', 'g', 'f', -r, r, 0,
                    [{ x: 0, y: h / 2, inside: true }, { x: 0, y: h + 0.5, inside: false },
                        { x: 1.5 * r, y: h / 2, inside: false }]);
            } else if (family === 8) {
                const lift = [0, 0.5, -0.5][variant];
                functionGraph('f', `${4 + lift}-x^2`, -3, 2);
                functionGraph('g', `x+${2 + lift}`, -3, 2);
                region('area', 'f', 'g', -2, 1, 0,
                    [{ x: 0, y: 3 + lift, inside: true }, { x: 0, y: 1 + lift, inside: false },
                        { x: 1.4, y: 2 + lift, inside: false }]);
            } else if (family === 9) {
                const factor = [1, 1.5, 0.7][variant];
                functionGraph('f', factor === 1 ? 'sin(x)' : `${factor}*sin(x)`, 0, Math.PI);
                region('area', 'f', null, 0, Math.PI, 0,
                    [{ x: Math.PI / 2, y: factor / 2, inside: true },
                        { x: Math.PI / 2, y: -0.4, inside: false }, { x: -0.4, y: 0.2, inside: false }]);
            } else if (family === 10) {
                const base = [2, 3, 1.5][variant];
                functionGraph('f', `${base}^x`, 0, 2);
                functionGraph('g', '1', 0, 2, 'y = 1');
                region('area', 'f', 'g', 0, 2, 0,
                    [{ x: 1, y: (1 + base) / 2, inside: true }, { x: 1, y: 0.5, inside: false },
                        { x: -0.4, y: 1.4, inside: false }]);
            } else if (family === 11) {
                const factor = [1, 1.5, 2][variant];
                functionGraph('f', `${factor}/x`, 0.5, 4);
                region('area', 'f', null, 1, 4, 0,
                    [{ x: 2, y: factor / 4, inside: true }, { x: 2, y: -0.5, inside: false },
                        { x: 0.5, y: factor / 2, inside: false }]);
            } else if (family === 12) {
                const factor = [2.5, 3.5, 4.5][variant];
                functionGraph('f', `${factor}*(x^3-x)`, -1, 1);
                region('area', 'f', null, -1, 1, 0,
                    [{ x: -0.5, y: factor * 0.2, inside: true },
                        { x: 0.5, y: -factor * 0.2, inside: true },
                        { x: 0.5, y: factor * 0.2, inside: false }]);
            } else if (family === 13) {
                const factor = [1, 1.4, 0.8][variant];
                functionGraph('f', factor === 1 ? 'sqrt(x)' : `${factor}*sqrt(x)`, 0, 4);
                functionGraph('g', `${factor / 2}*x`, 0, 4);
                region('area', 'f', 'g', 0, 4, 0,
                    [{ x: 1, y: factor * 0.75, inside: true },
                        { x: 1, y: factor * 1.3, inside: false },
                        { x: -0.5, y: factor * 0.5, inside: false }]);
            } else {
                point('O', 0, 0); point('R', 3, 0, { visible: false, showLabel: false });
                add('circle', 'circle', { centerId: 'O', pointOnCircleId: 'R' });
                const end = [Math.PI / 2, 2 * Math.PI / 3, Math.PI / 3][variant];
                point('A', 3, 0); point('B', 3 * Math.cos(end), 3 * Math.sin(end));
                segment('O', 'A'); segment('O', 'B');
                add('sector', 'area', { circleId: 'circle', startPointId: 'A', endPointId: 'B',
                    fillColor: '#000000', fillOpacity: 0.2 });
                conditions.push({ kind: 'fill-probes', id: 'area', probes: [
                    { x: 1, y: 0.7, inside: true }, { x: -1.5, y: -1, inside: false },
                    { x: 3.5, y: 0.5, inside: false }] });
                angle('A', 'O', 'B', variant === 1 ? '120°' : variant === 2 ? '60°' : '90°', 0, 0.65);
            }
            cases.push({ id, family: names[family], variant: variant + 1,
                split: variant === 2 ? 'holdout' : 'development',
                title: `${names[family]} · ${variant + 1}`,
                prompt: `${names[family]}의 시험 문항에 필요한 도형을 그리고 표시된 영역의 넓이를 구하는 문제라면 지정 영역만 색칠한다.`,
                source: 'agent-synthetic; not a teacher-approved example', preserveExplicitOffsets: false,
                showAxes: family >= 7 && family <= 13,
                operations, conditions,
                view: { width: 700, height: 600,
                    scale: family === 7 ? 68 : family === 8 ? 55 : family === 9 ? 100 :
                        family === 10 ? [55, 28, 75][variant] : family === 11 ? [82, 78, 65][variant] :
                            family === 12 ? 105 : family === 13 ? 75 : 48,
                    offset: { x: 0, y: 0 } } });
        }
    }
    return cases;
}
