/**
 * ObjectReferences.js 역할
 * 객체 직렬화 데이터에 포함되는 다른 객체 ID 필드를 한곳에서 관리합니다.
 * 붙여넣기와 AI 패치가 같은 참조 계약을 사용해야 복합 도형이 원본 객체를 다시 참조하지 않습니다.
 */

export const SINGLE_REFERENCE_FIELDS = Object.freeze([
    'point1Id', 'point2Id', 'point3Id', 'centerId', 'pointOnCircleId',
    'originId', 'directionPointId', 'lineId', 'circleId', 'segmentId',
    'circle1Id', 'circle2Id', 'object1Id', 'object2Id', 'baseLineId',
    'throughPointId', 'startPointId', 'endPointId', 'functionId', 'vertexId',
    'line1Id', 'line2Id', 'segment1Id', 'segment2Id', 'tangentPointId', 'apexId'
]);

export const ARRAY_REFERENCE_FIELDS = Object.freeze([
    'dependencies', 'vertexIds', 'baseVertexIds', 'topVertexIds', 'boundaryObjectIds'
]);

export function remapObjectReferences(data, idMap) {
    const resolved = { ...data };

    for (const field of SINGLE_REFERENCE_FIELDS) {
        const currentId = resolved[field];
        if (idMap.has(currentId)) {
            resolved[field] = idMap.get(currentId);
        }
    }

    for (const field of ARRAY_REFERENCE_FIELDS) {
        if (!Array.isArray(resolved[field])) continue;
        resolved[field] = resolved[field].map(id => idMap.has(id) ? idMap.get(id) : id);
    }

    return resolved;
}
