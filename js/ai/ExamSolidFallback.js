const dimension = '[0-9]+(?:\\.[0-9]+)?';

function namedPoint(id, x, y) {
    return { op: 'create', type: 'point', id, label: id, x, y, pointSize: 0 };
}

function lengthMark(a, b, text, curvature = -60, visibleSegment = false) {
    return [
        { op: 'create', type: 'segment', id: `${a}${b}`, point1Id: a, point2Id: b,
            visible: visibleSegment, showLabel: false },
        { op: 'create', type: 'lengthDimension', id: `length_${a}${b}`, segmentId: `${a}${b}`,
            customText: text, curvature, lineWidth: 3, labelFontSize: 15 }
    ];
}

function cylinder(message) {
    if (!/원기둥/.test(message) || hasUnrepresentedCondition(message)) return null;
    const radius = message.match(new RegExp(`반지름(?:의길이)?(?:은|는|이|가)?(${dimension})(cm|㎝)?`, 'i'));
    const height = message.match(new RegExp(`높이(?:는|가|이)?(${dimension})(cm|㎝)?`, 'i'));
    if (!radius || !height || message.includes('=') ||
        [...message.matchAll(/[0-9]+(?:\.[0-9]+)?(?:cm|㎝)?/gi)].length !== 2) return null;
    const r = Number(radius[1]), h = Number(height[1]);
    if (!(r >= 1 && r <= 5 && h >= 2 && h <= 10))
        return { error: '시험 입체도형 요청: 반지름 1~5cm, 높이 2~10cm인 원기둥만 현재 자동 배치합니다.' };

    const ellipseRatio = 0.28;
    // CurvedSolid.height includes both ellipse half-heights. The distance
    // between the two face centers must equal the stated cylinder height.
    const totalHeight = h + 2 * r * ellipseRatio;
    const helper = (id, x, y) => ({ op: 'create', type: 'point', id, x, y,
        label: null, showLabel: false, pointSize: 0, visible: false });
    return { operations: [
        { op: 'create', type: 'cylinder', id: 'exam_cylinder', x: 0, y: 0,
            width: 2 * r, height: totalHeight, ellipseRatio, showHiddenLines: true,
            showLabel: false, lineWidth: 2 },
        helper('top_center', 0, h / 2),
        helper('top_right', r, h / 2),
        helper('bottom_right', r, -h / 2),
        ...lengthMark('top_center', 'top_right', `${radius[1]}${radius[2] ? ' cm' : ''}`, -45, true),
        ...lengthMark('top_right', 'bottom_right', `${height[1]}${height[2] ? ' cm' : ''}`, 85)
    ] };
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

function quadrilateralPyramid(message) {
    const names = message.match(/사각뿔([A-Z])[-–—]([A-Z]{4})/);
    if (!names || hasUnrepresentedCondition(message)) return null;
    const [apexName, baseNames] = [names[1], [...names[2]]];
    if (new Set([apexName, ...baseNames]).size !== 5) return null;
    const edgeName = `${baseNames[0]}${baseNames[1]}`;
    const edge = message.match(new RegExp(`${edgeName}=(${dimension})(cm|㎝)?`, 'i'));
    const height = message.match(new RegExp(`높이(?:는|가|이)?(${dimension})(cm|㎝)?`, 'i'));
    if (!edge || !height || [...message.matchAll(/[0-9]+(?:\.[0-9]+)?(?:cm|㎝)?/gi)].length !== 2 ||
        [...message.matchAll(/=/g)].length !== 1) return null;
    const size = Number(edge[1]), tall = Number(height[1]);
    if (!(size >= 2 && size <= 7 && tall >= Math.max(3, size * 0.8) && tall <= 10))
        return { error: '시험 입체도형 요청: 밑변 2~7cm, 높이는 밑변의 0.8배 이상이면서 3~10cm인 사각뿔만 현재 자동 배치합니다.' };

    const left = -size / 2 - 1, bottom = -2;
    const depthX = size / 4, depthY = size / 2;
    const base = [[left, bottom], [left + size, bottom],
        [left + size + depthX, bottom + depthY], [left + depthX, bottom + depthY]];
    const center = [left + size / 2 + depthX / 2, bottom + depthY / 2];
    // An upright textbook projection keeps the altitude measurable on the
    // drawing itself; the foot is the center of the projected base.
    const apex = [center[0], center[1] + tall];
    const helper = { op: 'create', type: 'point', id: 'height_foot',
        x: center[0], y: center[1], label: null, showLabel: false,
        pointSize: 0, visible: false };
    const operations = [
        ...base.map((p, i) => namedPoint(baseNames[i], p[0], p[1])),
        namedPoint(apexName, apex[0], apex[1]), helper,
        { op: 'create', type: 'pyramid', id: 'exam_pyramid',
            baseVertexIds: baseNames, apexId: apexName, showLabel: false, lineWidth: 2 },
        ...lengthMark(baseNames[0], baseNames[1], `${edge[1]}${edge[2] ? ' cm' : ''}`),
        { op: 'create', type: 'segment', id: 'height_line',
            point1Id: 'height_foot', point2Id: apexName, dashed: true,
            showLabel: false, lineWidth: 2 },
        { op: 'create', type: 'lengthDimension', id: 'length_height',
            segmentId: 'height_line', customText: `${height[1]}${height[2] ? ' cm' : ''}`,
            curvature: 30, lineWidth: 3, labelFontSize: 15,
            labelOffset: { x: -0.2, y: 0 } }
    ];
    return { operations };
}

/** Handle only solid dimensions whose meaning is explicitly represented. */
export function buildExamSolidOperations(message) {
    const compact = String(message).replace(/\s+/g, '').replace(/＝/g, '=');
    const built = cylinder(compact) || triangularPrism(compact) || cube(compact) || quadrilateralPyramid(compact);
    if (built) return built;
    const mentionsSolid = /(삼각기둥|사각기둥|각기둥|사각뿔|각뿔|정육면체|직육면체|원기둥|원뿔)/.test(compact) ||
        /(?:^|[^가-힣])구(?=$|를|을|와|과|가|이|의|안|속|내부)/.test(compact);
    if (mentionsSolid &&
        (/[0-9]+(?:\.[0-9]+)?\s*(?:cm|㎝)/i.test(compact) ||
            /(?:반지름|높이|모서리)(?:은|는|이|가|의길이)?[0-9]+(?:\.[0-9]+)?/i.test(compact) ||
            /(?:[A-Z]{3,4}[-–—][A-Z]{3,4}|부피|겉넓이|단면)/.test(compact))) {
        return { error: '시험 입체도형 요청: 이름·길이·숨은선 조건을 모두 표현할 수 없어 일부만 그리지 않았습니다. 현재는 밑변과 높이가 명시된 삼각기둥·사각뿔, 모서리 길이가 명시된 정육면체, 반지름과 높이가 명시된 원기둥을 지원합니다.' };
    }
    return null;
}
