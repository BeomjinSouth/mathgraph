const dimension = '[0-9]+(?:\\.[0-9]+)?';

function namedPoint(id, x, y) {
    return { op: 'create', type: 'point', id, label: id, x, y, pointSize: 0 };
}

function lengthMark(a, b, text, curvature = -60) {
    return [
        { op: 'create', type: 'segment', id: `${a}${b}`, point1Id: a, point2Id: b, visible: false },
        { op: 'create', type: 'lengthDimension', id: `length_${a}${b}`, segmentId: `${a}${b}`,
            customText: text, curvature, lineWidth: 3, labelFontSize: 15 }
    ];
}

function hasUnrepresentedCondition(message) {
    return /부피|겉넓이|단면|대각선|직각|수직|평행|색칠|음영|중점|각도|∠/.test(message);
}

function triangularPrism(message) {
    const names = message.match(/삼각기둥([A-Z]{3})[-–—]([A-Z]{3})/);
    if (!names) return null;
    const labels = [...names[1], ...names[2]];
    if (new Set(labels).size !== 6 || hasUnrepresentedCondition(message)) return null;
    const edgeName = `${labels[0]}${labels[1]}`;
    const edge = message.match(new RegExp(`${edgeName}=(${dimension})(cm)?`, 'i'));
    const height = message.match(new RegExp(`높이(?:는|가)?(${dimension})(cm)?`, 'i'));
    if (!edge || !height) return null;
    const numbers = [...message.matchAll(/[0-9]+(?:\.[0-9]+)?(?:cm)?/gi)];
    if (numbers.length !== 2 || [...message.matchAll(/=/g)].length !== 1) return null;
    const width = Number(edge[1]), tall = Number(height[1]);
    if (!(width >= 2 && width <= 8 && tall >= 2 && tall <= 10))
        return { error: '시험 입체도형 요청: 밑변 2~8cm, 높이 2~10cm만 현재 자동 배치합니다.' };
    // The rear face is a textbook oblique projection. Its screen displacement is
    // deliberately shortened; the height annotation gives the 3-D value.
    const front = [[-width / 2, -1.6], [width / 2, -1.6], [0, 1.4]];
    const shift = [1.6, 1.1];
    const operations = [...front.map((p, i) => namedPoint(labels[i], p[0], p[1])),
        ...front.map((p, i) => namedPoint(labels[i + 3], p[0] + shift[0], p[1] + shift[1])),
        { op: 'create', type: 'prism', id: 'exam_prism',
            baseVertexIds: labels.slice(0, 3), topVertexIds: labels.slice(3),
            showLabel: false, lineWidth: 2 },
        ...lengthMark(labels[0], labels[1], `${edge[1]}${edge[2] ? ' cm' : ''}`),
        ...lengthMark(labels[1], labels[4], `${height[1]}${height[2] ? ' cm' : ''}`, -80)
    ];
    return { operations };
}

function cube(message) {
    const names = message.match(/정육면체([A-Z]{4})[-–—]([A-Z]{4})/);
    if (!names) return null;
    const labels = [...names[1], ...names[2]];
    if (new Set(labels).size !== 8 || hasUnrepresentedCondition(message)) return null;
    const edge = message.match(new RegExp(`모서리(?:의)?(?:길이(?:는|가)?)?(${dimension})(cm)?`, 'i'));
    if (!edge || [...message.matchAll(/[0-9]+(?:\.[0-9]+)?(?:cm)?/gi)].length !== 1 || message.includes('=')) return null;
    const size = Number(edge[1]);
    if (!(size >= 2 && size <= 7))
        return { error: '시험 입체도형 요청: 모서리 2~7cm인 정육면체만 현재 자동 배치합니다.' };
    const half = size / 2;
    const front = [[-half, -half], [half, -half], [half, half], [-half, half]];
    const shift = [Math.min(1.8, size * 0.4), Math.min(1.4, size * 0.32)];
    const operations = [...front.map((p, i) => namedPoint(labels[i], p[0], p[1])),
        ...front.map((p, i) => namedPoint(labels[i + 4], p[0] + shift[0], p[1] + shift[1])),
        { op: 'create', type: 'prism', id: 'exam_cube',
            baseVertexIds: labels.slice(0, 4), topVertexIds: labels.slice(4),
            showLabel: false, lineWidth: 2 },
        ...lengthMark(labels[0], labels[1], `${edge[1]}${edge[2] ? ' cm' : ''}`)
    ];
    return { operations };
}

/** Handle only solid dimensions whose meaning is explicitly represented. */
export function buildExamSolidOperations(message) {
    const compact = String(message).replace(/\s+/g, '').replace(/＝/g, '=');
    const built = triangularPrism(compact) || cube(compact);
    if (built) return built;
    if (/(삼각기둥|사각기둥|각기둥|사각뿔|각뿔|정육면체|직육면체|원기둥|원뿔|구)/.test(compact) &&
        (/[0-9]+(?:\.[0-9]+)?\s*(?:cm|㎝)/i.test(compact) ||
            /(?:[A-Z]{3,4}[-–—][A-Z]{3,4}|부피|겉넓이|단면)/.test(compact))) {
        return { error: '시험 입체도형 요청: 이름·길이·숨은선 조건을 모두 표현할 수 없어 일부만 그리지 않았습니다. 현재는 밑변과 높이가 명시된 ABC-DEF형 삼각기둥 또는 모서리 길이가 명시된 ABCD-EFGH형 정육면체를 지원합니다.' };
    }
    return null;
}
