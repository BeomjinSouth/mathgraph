// Deterministic source cases. Variant 4 is held out from the initial repair loop.
// Source coordinates/conditions are independent of any layout correction.
export function buildExamDiagramCases() {
    const cases = [];
    const names = ['예각삼각형', '둔각삼각형', '직각삼각형', '좁은 삼각형',
        '평행사변형의 대각선', '직사각형의 대각선', '사다리꼴', '마름모', '연꼴',
        '한 꼭짓점의 인접각', '음의 x축을 가로지르는 각', '연장선의 교점',
        '삼각형의 수선', '중점 연결', '원의 내접각', '반지름과 접선', '두 현의 교점',
        '일직선 위 부분 길이', '독립된 같은 길이 표시', '두 일차함수', '포물선과 현',
        '구간별 함수의 열린 점', '수직선의 구간 끝점', '각기둥', '각뿔'];
    for (let family = 0; family < names.length; family++) {
        for (let variant = 0; variant < 4; variant++) {
            const operations = [];
            const conditions = [];
            const id = `E${String(family * 4 + variant + 1).padStart(3, '0')}`;
            const rotation = [0, 0.52, -0.88, 2.91][variant];
            const point = (id, x, y, extra = {}) => {
                if (family < 19 && family !== 10) {
                    [x, y] = [x * Math.cos(rotation) - y * Math.sin(rotation), x * Math.sin(rotation) + y * Math.cos(rotation)];
                }
                const label = variant === 2 ? `${id}′` : id;
                operations.push({ op: 'create', type: 'point', id, x, y, label, fontSize: 27, pointSize: 0, ...extra });
                return id;
            };
            const add = (type, id, fields) => {
                operations.push({ op: 'create', type, id, lineWidth: 3, showLabel: false, ...fields });
                return id;
            };
            const seg = (a, b, extra = {}) => add('segment', `${a}${b}`, { point1Id: a, point2Id: b, ...extra });
            const poly = ids => add('polygon', `poly_${ids.join('')}`, { vertexIds: ids, fillOpacity: 0 });
            const angle = (a, v, b, value, extra = {}) => {
                const angId = `angle_${a}${v}${b}`;
                add('angleDimension', angId, { vertexId: v, point1Id: a, point2Id: b,
                    arcRadius: 0.55, labelFontSize: 22, customText: value, ...extra });
                conditions.push({ kind: 'angle-label', id: angId, points: [a, v, b], display: value });
            };
            const length = (a, b, text, curvature = 80) => {
                const lineId = `${a}${b}`;
                if (!operations.some(o => o.id === lineId))
                    seg(a, b, { visible: false });
                const lengthId = `length_${lineId}`;
                add('lengthDimension', lengthId, { segmentId: lineId, curvature, labelFontSize: 22, customText: text });
                conditions.push({ kind: 'length-label', id: lengthId, display: text, curvature });
            };
            const derived = (type, id, props) => add(type, id, {
                label: variant === 2 ? `${id}′` : id, showLabel: true, fontSize: 27, pointSize: 0, ...props
            });
            const long = variant === 1 ? '3x+12' : variant === 2 ? '2√3 cm' : 'x+5';
            if (family <= 3) {
                const tops = [[-0.5, 3.8], [-4.3, 2.6], [-3, 4], [1.8, 4.9]];
                point('A', -3, -1);
                point('B', 3, -1);
                point('C', ...tops[family]);
                poly(['A', 'B', 'C']);
                angle('A', 'C', 'B', variant === 1 ? '2x+15°' : 'x°');
                length('A', 'B', long, -90);
                if (family === 2) {
                    seg('A', 'B', { visible: false });
                    seg('A', 'C', { visible: false });
                    add('rightAngleMarker', 'right', { vertexId: 'A', line1Id: 'AB', line2Id: 'AC' });
                }
            }
            else if (family <= 8) {
                const shapes = {
                    4: [[-3, -2], [2, -2], [3, 2], [-2, 2]], 5: [[-3, -2], [3, -2], [3, 2], [-3, 2]],
                    6: [[-3, -2], [3, -2], [1.5, 2], [-1, 2]], 7: [[-3, 0], [0, -2], [3, 0], [0, 2]],
                    8: [[-3, 0], [0, -1.7], [2, 0], [0, 1.7]]
                };
                shapes[family].forEach((p, i) => point('ABCD'[i], ...p));
                poly(['A', 'B', 'C', 'D']);
                seg('A', 'C');
                seg('B', 'D');
                derived('intersection', 'O', { object1Id: 'AC', object2Id: 'BD' });
                angle('B', 'A', 'C', variant === 1 ? 'x+10°' : 'x°');
                length('A', 'B', long, -75);
                conditions.push({ kind: 'intersection', id: 'O', lines: ['AC', 'BD'] });
            }
            else if (family === 9) {
                point('O', -2, -2);
                point('A', 4, -2);
                point('B', 3, 1);
                point('C', -0.7, 3);
                seg('O', 'A');
                seg('O', 'B');
                seg('O', 'C');
                angle('A', 'O', 'B', variant === 1 ? '2x+20°' : 'x°');
                angle('B', 'O', 'C', variant === 2 ? '3y−5°' : 'y°', { arcRadius: 0.85 });
            }
            else if (family === 10) {
                const theta = [165, 175, -175, -155][variant] * Math.PI / 180;
                point('O', 1.5, 0);
                point('A', 1.5 + 4 * Math.cos(theta), 4 * Math.sin(theta));
                point('B', 1.5 + 4 * Math.cos(theta + 0.65), 4 * Math.sin(theta + 0.65));
                seg('O', 'A');
                seg('O', 'B');
                angle('A', 'O', 'B', 'x+10°', { markerCount: 1 });
            }
            else if (family === 11) {
                point('A', -3, 2);
                point('B', 0, 0.5);
                point('C', -3, -2);
                point('D', 0, -0.5);
                seg('A', 'B');
                seg('C', 'D');
                add('line', 'supportAB', { point1Id: 'A', point2Id: 'B', visible: false });
                add('line', 'supportCD', { point1Id: 'C', point2Id: 'D', visible: false });
                derived('intersection', 'P', { object1Id: 'supportAB', object2Id: 'supportCD' });
                seg('B', 'P', { dashed: true });
                seg('D', 'P', { dashed: true });
                conditions.push({ kind: 'intersection', id: 'P', lines: ['AB', 'CD'] });
            }
            else if (family === 12) {
                point('A', -3, -2);
                point('B', 3, -2);
                point('C', variant === 1 ? -4.5 : -0.5, 3);
                poly(['A', 'B', 'C']);
                seg('A', 'B', { visible: false });
                add('line', 'baseSupport', { point1Id: 'A', point2Id: 'B', visible: false });
                add('perpendicular', 'altitude', { throughPointId: 'C', baseLineId: 'baseSupport', visible: false });
                derived('intersection', 'H', { object1Id: 'baseSupport', object2Id: 'altitude' });
                seg('C', 'H');
                if (variant === 1)
                    seg('A', 'H', { dashed: true });
                add('rightAngleMarker', 'right', { vertexId: 'H', line1Id: 'AB', line2Id: 'CH' });
                conditions.push({ kind: 'right', points: ['C', 'H', 'B'] });
            }
            else if (family === 13) {
                point('A', -3, -2);
                point('B', 3, -2);
                point('C', -0.7, 3);
                poly(['A', 'B', 'C']);
                seg('A', 'C', { visible: false });
                seg('B', 'C', { visible: false });
                derived('midpoint', 'M', { segmentId: 'AC' });
                derived('midpoint', 'N', { segmentId: 'BC' });
                seg('M', 'N');
                length('M', 'N', long, 70);
                conditions.push({ kind: 'midpoint', id: 'M', ends: ['A', 'C'] }, { kind: 'midpoint', id: 'N', ends: ['B', 'C'] });
            }
            else if (family >= 14 && family <= 16) {
                point('O', 0, 0);
                point('R', 3, 0, { visible: false, showLabel: false });
                add('circle', 'circle', { centerId: 'O', pointOnCircleId: 'R' });
                const polar = (id, t) => derived('pointOnCircle', id, { circleId: 'circle', angle: t + rotation });
                polar('A', 0.35);
                polar('B', 2.8);
                if (family === 14) {
                    polar('C', 4.7);
                    poly(['A', 'B', 'C']);
                    angle('A', 'C', 'B', 'x°');
                }
                if (family === 15) {
                    // Tangent is perpendicular to OA, exact support endpoints.
                    const t = 0.35;
                    point('T', 3 * Math.cos(t) - 3 * Math.sin(t), 3 * Math.sin(t) + 3 * Math.cos(t));
                    point('U', 3 * Math.cos(t) + 2 * Math.sin(t), 3 * Math.sin(t) - 2 * Math.cos(t), { visible: false, showLabel: false });
                    seg('T', 'U');
                    seg('O', 'A');
                    seg('A', 'T', { visible: false });
                    add('rightAngleMarker', 'right', { vertexId: 'A', line1Id: 'OA', line2Id: 'AT' });
                    conditions.push({ kind: 'right', points: ['O', 'A', 'T'] });
                }
                if (family === 16) {
                    polar('C', 4.1);
                    polar('D', 5.7);
                    seg('A', 'C');
                    seg('B', 'D');
                    derived('intersection', 'P', { object1Id: 'AC', object2Id: 'BD' });
                    angle('A', 'P', 'B', 'y°');
                    conditions.push({ kind: 'intersection', id: 'P', lines: ['AC', 'BD'] });
                }
            }
            else if (family === 17) {
                point('A', -3, 0);
                point('B', 3, 0);
                seg('A', 'B');
                const t = [23 / 36, 11 / 16, 0.4, 23 / 36][variant];
                derived('pointOnLine', 'M', { lineId: 'AB', t });
                const first = variant === 1 ? '3x+2' : long;
                const total = variant === 1 ? '16 cm' : variant === 2 ? '5√3 cm' : '12 cm';
                // Put the whole-span dimension opposite the longer partial label.
                // Stacking both wide labels on the same side leaves no readable gap.
                length('A', 'M', first, 90);
                length('M', 'B', '2x−1', -90);
                length('A', 'B', total, -180);
                conditions.push({ kind: 'division', id: 'M', ends: ['A', 'B'], t });
            }
            else if (family === 18) {
                point('A', -3, 0);
                point('B', 0, -2.4);
                point('C', 2, 0);
                point('D', 0, 2.4);
                poly(['A', 'B', 'C', 'D']);
                for (const [a, b] of [['A', 'B'], ['A', 'D'], ['C', 'B'], ['C', 'D']])
                    seg(a, b, { visible: false });
                add('equalLengthMarker', 'equal1', { segment1Id: 'AB', segment2Id: 'AD', tickCount: 1 });
                add('equalLengthMarker', 'equal2', { segment1Id: 'CB', segment2Id: 'CD', tickCount: 2 });
            }
            else if (family === 19) {
                const m = [0.5, 1, 1.5, -0.7][variant];
                add('function', 'f', { expression: `${m}*x+1`, xMin: -3, xMax: 3, label: 'f', showLabel: true, fontSize: 22 });
                add('function', 'g', { expression: `${-m}*x-1`, xMin: -3, xMax: 3, label: 'g', showLabel: true, fontSize: 22 });
                point('P', -1 / m, 0);
                conditions.push({ kind: 'coordinate', id: 'P', expected: [-1 / m, 0] });
            }
            else if (family === 20) {
                const a = [0.4, 0.6, -0.4, -0.6][variant];
                add('function', 'f', { expression: `${a}*x^2-1`, xMin: -3, xMax: 3, showLabel: true, label: 'f', fontSize: 22 });
                point('A', -2, 4 * a - 1);
                point('B', 2, 4 * a - 1);
                seg('A', 'B');
                point('V', 0, -1);
                conditions.push({ kind: 'coordinate', id: 'V', expected: [0, -1] });
            }
            else if (family === 21) {
                const x = [-1, 0, 1, 1.5][variant];
                add('function', 'left', { expression: '0.5*x+1', xMin: -3, xMax: x });
                add('function', 'right', { expression: '-0.5*x-1', xMin: x, xMax: 3 });
                point('A', x, 0.5 * x + 1, { pointSize: 6, pointStyle: 'open' });
                point('B', x, -0.5 * x - 1, { pointSize: 6, pointStyle: 'closed' });
                conditions.push({ kind: 'endpoint', id: 'A', style: 'open' }, { kind: 'endpoint', id: 'B', style: 'closed' });
            }
            else if (family === 22) {
                add('numberLine', 'axis', { start: -4, end: 4, step: 1, y: 0, fontSize: 22, showArrows: true,
                    customMarks: [{ value: variant === 1 ? -Math.sqrt(2) : [-1.5, -1.5, -2.3, -0.7][variant], label: variant === 1 ? '−√2' : 'a', endpoint: 'open' },
                        { value: variant === 2 ? Math.sqrt(6) : [2.5, 1.7, 2.5, 3.2][variant], label: variant === 2 ? '√6' : 'b', endpoint: 'closed' }] });
            }
            else if (family === 23) {
                const triangle = variant % 2 === 1;
                const coords = triangle ? [[-3, -1], [1, -1], [-1, 2]] : [[-3, -2], [1, -2], [1, 1], [-3, 1]];
                const base = coords.map((p, i) => point('ABCD'[i], ...p));
                const top = coords.map((p, i) => point('EFGH'[i], p[0] + [1.5, 2, 1.8, 2.4][variant], p[1] + [1.2, 0.7, -1, -0.7][variant]));
                add('prism', 'solid', { baseVertexIds: base, topVertexIds: top });
                length('A', 'B', long, variant >= 2 ? 75 : -75);
            }
            else {
                const stretch = 1 + variant * 0.1;
                point('A', -3 * stretch, -1.7);
                point('B', 1.5 * stretch, -2.2);
                point('C', 3 * stretch, 0.1);
                point('D', -1.5 * stretch, 0.6);
                point('V', [-1.3, -0.4, -1.6, -0.8][variant], [3.2, 3.5, 3.2, 3.7][variant]);
                add('pyramid', 'solid', { baseVertexIds: ['A', 'B', 'C', 'D'], apexId: 'V' });
                length('A', 'B', long, -90);
            }
            // Exercise bad model-proposed offsets as well as absent offsets.
            // This is not a saved teacher edit and may be corrected at generation time.
            if (variant === 2) {
                const proposed = operations.find(o => o.type === 'point' && o.visible !== false);
                if (proposed) proposed.labelOffset = { x: -85, y: -24 };
            }
            cases.push({ id, family: names[family], variant: variant + 1, split: variant === 3 ? 'holdout' : 'development',
                preserveExplicitOffsets: false,
                title: `${names[family]} · ${['기본', '긴 조건', '기울기·기호', '검증용 변형'][variant]}`,
                source: 'agent-synthetic; teacher-approved rules, not teacher-approved examples',
                operations, conditions, view: { width: 700, height: 600, scale: family >= 19 ? 40 : 48, offset: { x: 0, y: 0 } } });
        }
    }
    return cases;
}
