const number = '[0-9]+(?:\\.[0-9]+)?';

function equalities(message) {
    return [...message.matchAll(/(?:∠[A-Z]|[A-Z]{1,2})=(?:∠[A-Z]|[A-Z]{1,2}|[0-9]+(?:\.[0-9]+)?(?:cm|°)?)/g)]
        .map(match => match[0]);
}

function exactly(message, expected) {
    const actual = equalities(message);
    return actual.length === expected.length && expected.every(item => actual.includes(item));
}

function point(id, x, y, labelOffset) {
    return { op: 'create', type: 'point', id, x, y, label: id, pointSize: 0, labelOffset };
}

function side(a, b) {
    return { op: 'create', type: 'segment', id: `${a}${b}`, point1Id: a, point2Id: b, visible: false };
}

function polygon(labels) {
    return { op: 'create', type: 'polygon', id: `poly_${labels.join('')}`, vertexIds: labels,
        fillOpacity: 0, lineWidth: 2, showLabel: false };
}

function angle(vertex, neighbor1, neighbor2, options = {}) {
    return { op: 'create', type: 'angleDimension', id: `angle_${vertex}`,
        vertexId: vertex, point1Id: neighbor1, point2Id: neighbor2,
        arcRadius: 0.62, ...options };
}

function length(segmentId, text) {
    return { op: 'create', type: 'lengthDimension', id: `length_${segmentId}`,
        segmentId, customText: text, curvature: -52, lineWidth: 3, labelFontSize: 15 };
}

function buildIsosceles(message) {
    if (!/삼각형ABC/.test(message)) return null;
    const base = message.match(new RegExp(`BC=(${number})(cm)?`));
    const apex = message.match(new RegExp(`∠A=(${number})°`));
    if (!message.includes('AB=AC') || !message.includes('∠B=∠C') || !base || !apex ||
        !exactly(message, ['AB=AC', '∠B=∠C', base[0], apex[0]])) return null;

    const width = Number(base[1]);
    const degrees = Number(apex[1]);
    if (!(width > 0 && width <= 12 && degrees >= 20 && degrees <= 140)) {
        return { error: '시험 도형 요청: 밑변은 0보다 크고 12cm 이하, 꼭지각은 20° 이상 140° 이하인 경우만 현재 자동 배치합니다.' };
    }
    const half = width / 2;
    const height = half / Math.tan(degrees * Math.PI / 360);
    if (height > 9) {
        return { error: '시험 도형 요청: 이 각도와 밑변의 조합은 기본 화면을 벗어납니다. 배율을 지정하거나 다른 방법으로 그려 주세요.' };
    }
    const operations = [
        point('A', 0, height / 2, { x: -8, y: 0 }),
        point('B', -half, -height / 2, { x: -29, y: 25 }),
        point('C', half, -height / 2, { x: 13, y: 25 }),
        polygon(['A', 'B', 'C']),
        side('A', 'B'), side('A', 'C'), side('B', 'C'),
        { op: 'create', type: 'equalLengthMarker', id: 'equal_AB_AC', segment1Id: 'AB', segment2Id: 'AC', tickCount: 1 },
        angle('B', 'A', 'C', { markerCount: 1, showValue: false }),
        angle('C', 'B', 'A', { markerCount: 1, showValue: false }),
        angle('A', 'C', 'B', { showValue: true, customText: `${apex[1]}°`, arcRadius: 0.75 }),
        length('BC', `${base[1]}${base[2] ? ' cm' : ''}`)
    ];
    return { operations };
}

function buildParallelogram(message) {
    if (!/평행사변형ABCD/.test(message)) return null;
    const base = message.match(new RegExp(`AB=(${number})(cm)?`));
    const corner = message.match(new RegExp(`∠A=(${number})°`));
    if (!message.includes('AB=CD') || !message.includes('BC=DA') || !message.includes('∠A=∠C') ||
        !base || !corner || !exactly(message, ['AB=CD', 'BC=DA', '∠A=∠C', base[0], corner[0]])) return null;

    const width = Number(base[1]);
    const degrees = Number(corner[1]);
    if (!(width > 0 && width <= 12 && degrees >= 30 && degrees <= 150)) {
        return { error: '시험 도형 요청: 밑변은 0보다 크고 12cm 이하, 내각은 30° 이상 150° 이하인 경우만 현재 자동 배치합니다.' };
    }
    const sideLength = Math.min(4, width * 0.65);
    const theta = degrees * Math.PI / 180;
    const dx = sideLength * Math.cos(theta), dy = sideLength * Math.sin(theta);
    if (width + Math.abs(dx) > 12) {
        return { error: '시험 도형 요청: 이 길이와 각도의 조합은 기본 화면을 벗어납니다. 배율을 지정하거나 다른 방법으로 그려 주세요.' };
    }
    const left = -(width + dx) / 2;
    const bottom = -dy / 2;
    const operations = [
        point('A', left, bottom, { x: -29, y: 25 }),
        point('B', left + width, bottom, { x: 13, y: 25 }),
        point('C', left + width + dx, bottom + dy, { x: 13, y: 0 }),
        point('D', left + dx, bottom + dy, { x: -29, y: 0 }),
        polygon(['A', 'B', 'C', 'D']),
        side('A', 'B'), side('B', 'C'), side('C', 'D'), side('D', 'A'),
        { op: 'create', type: 'equalLengthMarker', id: 'equal_AB_CD', segment1Id: 'AB', segment2Id: 'CD', tickCount: 1 },
        { op: 'create', type: 'equalLengthMarker', id: 'equal_BC_DA', segment1Id: 'BC', segment2Id: 'DA', tickCount: 2 },
        angle('A', 'B', 'D', { markerCount: 1, customText: `${corner[1]}°`, showValue: true }),
        angle('C', 'D', 'B', { markerCount: 1, showValue: false }),
        length('AB', `${base[1]}${base[2] ? ' cm' : ''}`)
    ];
    return { operations };
}

/** Only explicit, fully checked exam conditions are handled offline. */
export function buildExamGeometryOperations(message) {
    const compact = String(message).replace(/\s+/g, '').replace(/＝/g, '=');
    if (/(삼각형|평행사변형|사각형)/.test(compact) &&
        /높이|넓이|둘레|대각선|중선|외접|내접|수선|중점|반지름|색칠|음영|접선|직각|수직|부채꼴/.test(compact)) {
        return { error: '시험 도형 요청: 추가 도형 조건을 모두 해석하지 못해 그림을 만들지 않았습니다.' };
    }
    const built = buildIsosceles(compact) || buildParallelogram(compact);
    if (built) return built;
    if (/(삼각형|평행사변형|사각형)/.test(compact) &&
        (/[=∠]/.test(compact) || /같은(길이|각)|[0-9]+(?:\.[0-9]+)?(?:cm|°)/i.test(compact))) {
        return { error: '시험 도형 요청: 길이·각 조건을 모두 해석하지 못해 그림을 만들지 않았습니다. 현재는 ABC의 AB=AC·∠B=∠C·BC 길이·∠A, 또는 ABCD 평행사변형의 두 쌍의 변·∠A=∠C·AB 길이·∠A를 함께 지정한 형식을 지원합니다.' };
    }
    return null;
}
