const number = '[0-9]+(?:\\.[0-9]+)?';

/** A single, fully stated central-angle circle/sector exam diagram. */
export function buildExamCircleOperations(message) {
    const compact = String(message).replace(/\s+/g, '').replace(/＝/g, '=');
    if (/원기둥|원뿔|삼각형|사각형/.test(compact)) return null;
    const circleIntent = /부채꼴|중심각|∠[A-Z]{3}|호[A-Z]{2}/.test(compact);
    if (!circleIntent) return null;

    const angle = compact.match(new RegExp(`∠([A-Z])([A-Z])([A-Z])=(${number})°`));
    const radiusText = compact.match(new RegExp(`반지름(?:은|는|이|가)?(${number})(cm|㎝)?`, 'i'));
    const equalRadius = compact.match(new RegExp(`([A-Z]{2})=([A-Z]{2})=(${number})(cm|㎝)?`, 'i'));
    const centerName = angle?.[2], firstName = angle?.[1], lastName = angle?.[3];
    const radius = Number(equalRadius?.[3] ?? radiusText?.[1]);
    const degrees = Number(angle?.[4]);
    const sectorName = compact.match(/부채꼴([A-Z])([A-Z])([A-Z])/);
    const arcName = compact.match(/호([A-Z])([A-Z])/);
    const centeredAt = compact.match(/(?:중심(?:이|은|은점|이점)?|원)([A-Z])/);
    const hasUnsupportedExtra = /접선|(?<!반)지름|현|부피|둘레|활꼴|교점|중점|외접|내접|호.{0,4}길이|넓이.{0,10}값/.test(compact);
    const assignmentCount = [...compact.matchAll(/=/g)].length;
    const numericCount = [...compact.matchAll(/[0-9]+(?:\.[0-9]+)?(?:cm|㎝|°)?/gi)].length;
    const radiusPair = equalRadius && new Set([equalRadius[1][1], equalRadius[2][1]]).size === 2 &&
        [equalRadius[1], equalRadius[2]].every(side =>
            side.length === 2 && side[0] === centerName && [firstName, lastName].includes(side[1]));
    const validNames = angle && firstName !== lastName && centerName !== firstName && centerName !== lastName &&
        (!sectorName || sectorName[1] === firstName && sectorName[2] === centerName && sectorName[3] === lastName) &&
        (!arcName || [arcName[1], arcName[2]].sort().join('') === [firstName, lastName].sort().join('')) &&
        (!centeredAt || centeredAt[1] === centerName);
    if (!validNames || (!radiusText && !radiusPair) || (equalRadius && !radiusPair) ||
        hasUnsupportedExtra || assignmentCount !== (equalRadius ? 3 : 1) ||
        numericCount !== 2 || !(radius >= 1 && radius <= 8 && degrees >= 15 && degrees <= 165)) {
        return { error: '원·부채꼴 요청: 중심·반지름(1~8cm)·중심각(15~165°)·호나 부채꼴의 점 이름을 모두 일치하게 적어 주세요. 추가 조건은 일부만 그리지 않습니다.' };
    }

    const rad = degrees * Math.PI / 180;
    const point = (id, x, y, offset) => ({ op: 'create', type: 'point', id,
        x, y, label: id, pointSize: 0, labelOffset: offset });
    const operations = [
        point(centerName, 0, 0, { x: -30, y: 28 }),
        point(firstName, radius, 0, { x: 11, y: 25 }),
        point(lastName, radius * Math.cos(rad), radius * Math.sin(rad),
            degrees > 90 ? { x: -28, y: 0 } : { x: 10, y: 0 }),
        { op: 'create', type: 'circle', id: 'exam_circle',
            centerId: centerName, pointOnCircleId: firstName,
            fillOpacity: 0, showLabel: false, lineWidth: arcName && !sectorName ? 1.5 : 2 },
        { op: 'create', type: 'segment', id: `${centerName}${firstName}`,
            point1Id: centerName, point2Id: firstName, showLabel: false, lineWidth: 2 },
        { op: 'create', type: 'segment', id: `${centerName}${lastName}`,
            point1Id: centerName, point2Id: lastName, showLabel: false, lineWidth: 2 }
    ];
    if (equalRadius) operations.push({ op: 'create', type: 'equalLengthMarker', id: 'equal_radii',
        segment1Id: `${centerName}${firstName}`, segment2Id: `${centerName}${lastName}`, tickCount: 1 });
    const annotatedSide = equalRadius ? equalRadius[2] : `${centerName}${firstName}`;
    operations.push({ op: 'create', type: 'lengthDimension', id: 'radius_length',
        segmentId: annotatedSide, customText: `${radius}${(equalRadius?.[4] || radiusText?.[2]) ? ' cm' : ''}`,
        curvature: equalRadius ? 70 : -55, lineWidth: 3, labelFontSize: 15 });
    const shadesSector = /부채꼴/.test(compact) && /색칠|음영|넓이.{0,20}(?:구하|찾|계산)/.test(compact);
    if (shadesSector || sectorName) {
        operations.push({ op: 'create', type: 'sector', id: 'requested_sector',
            circleId: 'exam_circle', startPointId: firstName, endPointId: lastName,
            mode: 'minor', fillColor: '#000000', fillOpacity: shadesSector ? 0.2 : 0,
            showLabel: false, lineWidth: 2 });
    } else if (arcName) {
        operations.push({ op: 'create', type: 'arc', id: 'requested_arc',
            circleId: 'exam_circle', startPointId: firstName, endPointId: lastName,
            mode: 'minor', showLabel: false, lineWidth: 4 });
    }
    operations.push({ op: 'create', type: 'angleDimension', id: 'central_angle',
        vertexId: centerName, point1Id: firstName, point2Id: lastName,
        arcRadius: 0.72, showValue: true, customText: `${degrees}°`, labelFontSize: 15 });
    return { operations };
}
