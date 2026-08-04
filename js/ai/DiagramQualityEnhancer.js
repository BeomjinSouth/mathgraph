/**
 * DiagramQualityEnhancer.js
 *
 * App-owned post-processing for common exam-style diagram readability issues.
 * This is deliberately deterministic: the model proposes GraphA operations,
 * then MathGraph fixes layout details that should not depend on model taste.
 */

const POINT_LIKE_TYPES = new Set([
    'point',
    'pointOnCircle',
    'pointOnLine',
    'intersection',
    'midpoint',
    'circleCenterPoint'
]);

export function enhanceDiagramQuality(payload, requestText = '', options = {}) {
    const operations = Array.isArray(payload?.operations)
        ? cloneOperations(payload.operations)
        : [];

    if (operations.length === 0 || options.enabled === false) {
        return payload;
    }

    const ctx = buildContext(operations);
    const text = String(requestText || '');

    applyGeneralLabelDecluttering(ctx);
    applyPromptSpecificLabelOffsets(ctx, text);
    normalizeRequestedAreaShading(ctx, text);
    addLargeRightAngleAids(ctx, text);
    normalizeThreeCircleLensLayout(ctx, text);
    normalizeSquarePyramidMidsectionLayout(ctx, text);
    normalizeNestedRectangularPrismLayout(ctx, text);
    normalizePrismCrossSectionLayout(ctx, text);
    normalizeNestedTriangularSolidLayout(ctx, text);

    return { ...payload, operations };
}

function cloneOperations(operations) {
    return operations.map(operation => {
        const copy = { ...operation };
        if (Array.isArray(operation.baseVertexIds)) copy.baseVertexIds = [...operation.baseVertexIds];
        if (Array.isArray(operation.topVertexIds)) copy.topVertexIds = [...operation.topVertexIds];
        if (Array.isArray(operation.vertexIds)) copy.vertexIds = [...operation.vertexIds];
        if (operation.labelOffset && typeof operation.labelOffset === 'object') {
            copy.labelOffset = { ...operation.labelOffset };
        }
        return copy;
    });
}

function buildContext(operations) {
    const byId = new Map();
    for (const operation of operations) {
        if (typeof operation.id === 'string' && operation.id) {
            byId.set(operation.id, operation);
        }
    }
    return {
        operations,
        byId,
        byType(type) {
            return operations.filter(operation => operation.type === type);
        }
    };
}

function applyGeneralLabelDecluttering(ctx) {
    const labeled = ctx.operations
        .filter(operation => POINT_LIKE_TYPES.has(operation.type))
        .filter(operation => operation.visible !== false && operation.showLabel !== false)
        .map(operation => ({ operation, point: resolvePoint(ctx, operation.id) }))
        .filter(item => item.point);

    for (let i = 0; i < labeled.length; i += 1) {
        const close = [];
        for (let j = 0; j < labeled.length; j += 1) {
            if (i === j) continue;
            if (distance(labeled[i].point, labeled[j].point) < 1.15) {
                close.push(labeled[j]);
            }
        }

        if (close.length === 0 || hasUsableLabelOffset(labeled[i].operation)) continue;
        const cluster = [labeled[i], ...close].map(item => item.point);
        const center = averagePoint(cluster);
        const direction = normalize(subtract(labeled[i].point, center)) || fallbackDirection(i);
        setLabelOffset(labeled[i].operation, direction.x * 16, -direction.y * 16);
    }
}

function applyPromptSpecificLabelOffsets(ctx, text) {
    if (/접선|tangent/i.test(text)) {
        for (const record of visiblePointRecords(ctx)) {
            const name = visibleName(record.operation);
            if (!/^T\d*$/i.test(name) || hasUsableLabelOffset(record.operation)) continue;
            const yDirection = record.point.y >= 0 ? -1 : 1;
            setLabelOffset(record.operation, 14, yDirection * 12);
        }
    }

    if (/오일러|Euler/i.test(text)) {
        const offsets = {
            O: { x: -16, y: 8 },
            G: { x: 14, y: -12 },
            H: { x: 16, y: 10 }
        };
        for (const [name, offset] of Object.entries(offsets)) {
            const operation = findNamedPoint(ctx, name);
            if (operation && !hasUsableLabelOffset(operation)) {
                setLabelOffset(operation, offset.x, offset.y);
            }
        }
    }
}

function normalizeRequestedAreaShading(ctx, text) {
    const targetName = extractRequestedAreaTarget(text);
    if (!targetName) return;

    const targetTokens = tokenizePointNames(targetName);
    if (targetTokens.length < 3) return;

    const pointOperations = targetTokens.map(token => findNamedPoint(ctx, token));
    if (pointOperations.some(operation => !operation?.id)) return;

    const targetIds = pointOperations.map(operation => operation.id);
    let polygon = ctx.byType('polygon').find(operation =>
        Array.isArray(operation.vertexIds) &&
        hasSameCyclicVertices(ctx, operation.vertexIds, targetTokens)
    );

    if (!polygon) {
        polygon = {
            op: 'create',
            id: uniqueId(ctx, `area_${targetTokens.join('')}`),
            type: 'polygon',
            vertexIds: targetIds,
            fillColor: '#000000',
            fillOpacity: 0.18,
            showLabel: false
        };

        const dependencyEnd = Math.max(...targetIds.map(id =>
            ctx.operations.findIndex(operation => operation.id === id)
        )) + 1;
        ctx.operations.splice(Math.max(0, dependencyEnd), 0, polygon);
        ctx.byId.set(polygon.id, polygon);
    }

    polygon.fillColor = polygon.fillColor || '#000000';
    if (!Number.isFinite(Number(polygon.fillOpacity)) || Number(polygon.fillOpacity) < 0.18) {
        polygon.fillOpacity = 0.18;
    }
    polygon.showLabel = false;
}

function extractRequestedAreaTarget(text) {
    const source = String(text || '');
    const namedArea = /(삼각형|사각형|다각형)\s*([A-Z](?:['′’])?\d*(?:\s*[A-Z](?:['′’])?\d*){2,7})\s*의\s*넓이/gi;
    let match;

    while ((match = namedArea.exec(source)) !== null) {
        const tail = source.slice(namedArea.lastIndex);
        const clause = tail.split(/[.。?\n]/, 1)[0].slice(0, 80);
        const asksDirectly = /^\s*(?:(?:의\s*)?(?:값|최댓값|최솟값)(?:은|는|을|를)?|(?:을|를)\s*)(?:\s*(?:구하|찾|계산|얼마|몇|최대|최소)|\s*$)/i.test(clause);
        const asksAsQuestion = /^\s*(?:은|는)\s*(?:얼마|몇)/i.test(clause);
        const alias = clause.match(/^\s*(?:을|를)\s*([A-Za-z])\s*라\s*(?:하자|하고|할\s*때)/);
        const asksViaAlias = alias
            ? new RegExp(`${alias[1]}\\s*의\\s*(?:값|최댓값|최솟값)|${alias[1]}\\s*[=^]`, 'i').test(source.slice(namedArea.lastIndex))
            : false;

        if (asksDirectly || asksAsQuestion || asksViaAlias) {
            return match[2].replace(/\s+/g, '');
        }
    }

    return null;
}

function tokenizePointNames(name) {
    return String(name || '').match(/[A-Z](?:['′’])?\d*/gi) || [];
}

function hasSameCyclicVertices(ctx, vertexIds, targetTokens) {
    if (vertexIds.length !== targetTokens.length) return false;
    const actual = vertexIds.map(id => {
        const operation = ctx.byId.get(id);
        return normalizeName(operation?.label || operation?.id || id);
    });
    const expected = targetTokens.map(normalizeName);
    return isCyclicSequence(actual, expected) || isCyclicSequence([...actual].reverse(), expected);
}

function isCyclicSequence(actual, expected) {
    const doubled = [...actual, ...actual];
    return actual.some((_, start) =>
        expected.every((value, offset) => doubled[start + offset] === value)
    );
}

function addLargeRightAngleAids(ctx, text) {
    const needsVisibleAid = /동심|부채꼴|직각|right\s*angle|quarter|sector|90도\s*방향|90-degree direction/i.test(text);
    if (!needsVisibleAid) return;

    for (const marker of ctx.byType('rightAngleMarker')) {
        const alreadyHasAid = ctx.byType('angleDimension').some(angle =>
            angle.vertexId === marker.vertexId &&
            Number(angle.arcRadius) >= 0.7
        );
        if (alreadyHasAid) continue;

        const point1Id = farEndpointId(ctx, ctx.byId.get(marker.line1Id), marker.vertexId);
        const point2Id = farEndpointId(ctx, ctx.byId.get(marker.line2Id), marker.vertexId);
        if (!point1Id || !point2Id || point1Id === marker.vertexId || point2Id === marker.vertexId) continue;

        const id = uniqueId(ctx, `${marker.id || 'right'}_angle_aid`);
        const aid = {
            op: 'create',
            id,
            type: 'angleDimension',
            vertexId: marker.vertexId,
            point1Id,
            point2Id,
            arcRadius: 0.75,
            showValue: false,
            showLabel: false
        };
        ctx.operations.push(aid);
        ctx.byId.set(id, aid);
    }
}

function normalizeThreeCircleLensLayout(ctx, text) {
    const mentionsThreeCircles = /(세\s*원|three\s*circles|three-circle|O\s*,\s*P\s*,\s*Q|O\s*P\s*Q)/i.test(text);
    const mentionsLens = /(렌즈|공통부분|겹치|lens|overlap|intersection)/i.test(text);
    if (!mentionsThreeCircles || !mentionsLens) return;

    const circles = ctx.byType('circle');
    const lenses = ctx.byType('lensRegion');
    if (circles.length < 3 || lenses.length < 3) return;

    for (const lens of lenses) {
        lens.showLabel = false;
        if (lens.fillOpacity === undefined || Number(lens.fillOpacity) < 0.16) {
            lens.fillOpacity = 0.22;
        }
    }

    const records = circles
        .slice(0, 3)
        .map((circle, index) => {
            circle.showLabel = false;
            return circleRecord(ctx, circle, ['O', 'P', 'Q'][index]);
        })
        .filter(Boolean);
    if (records.length < 3) return;

    const center = averagePoint(records.map(record => record.center));
    for (const record of records) {
        hidePointLike(record.centerOp);
        if (record.radiusOp) hidePointLike(record.radiusOp);

        const direction = normalize(subtract(record.center, center)) || fallbackDirection(records.indexOf(record));
        const anchorDistance = Math.max(record.radius * 1.22, record.radius + 0.7);
        const anchor = {
            x: roundCoordinate(record.center.x + direction.x * anchorDistance),
            y: roundCoordinate(record.center.y + direction.y * anchorDistance)
        };
        ensureExternalLabelAnchor(ctx, record.label, anchor);
    }
}

function normalizeSquarePyramidMidsectionLayout(ctx, text) {
    const mentionsSquarePyramid = /(정사각뿔|square\s*pyramid)/i.test(text);
    const mentionsSection = /(중간\s*단면|단면|mid.?section|cross.?section)/i.test(text);
    if (!mentionsSquarePyramid || !mentionsSection) return;

    const pyramid = ctx.byType('pyramid').find(item =>
        Array.isArray(item.baseVertexIds) &&
        item.baseVertexIds.length === 4 &&
        item.apexId
    );
    if (!pyramid) return;

    pyramid.showLabel = false;

    const structuralIds = new Set([...(pyramid.baseVertexIds || []), pyramid.apexId].filter(Boolean));
    for (const polygon of ctx.byType('polygon')) {
        polygon.showLabel = false;
        const isSection = Array.isArray(polygon.vertexIds) &&
            polygon.vertexIds.length >= 4 &&
            !polygon.vertexIds.every(id => structuralIds.has(id));
        if (isSection && (polygon.fillOpacity === undefined || Number(polygon.fillOpacity) < 0.16)) {
            polygon.fillOpacity = 0.2;
        }
    }

    for (const point of ctx.byType('point')) {
        if (!structuralIds.has(point.id)) {
            hidePointLike(point);
        }
    }

    const apex = ctx.byId.get(pyramid.apexId);
    if (apex?.type === 'point') {
        apex.label = apex.label || 'V';
        apex.showLabel = true;
    }

    const heightSegments = ctx.byType('segment').filter(segment => {
        if (segment.point1Id === pyramid.apexId || segment.point2Id === pyramid.apexId) return true;
        const p1 = ctx.byId.get(segment.point1Id);
        const p2 = ctx.byId.get(segment.point2Id);
        return p1?.type === 'point' && p2?.type === 'point' && Math.abs(Number(p1.x) - Number(p2.x)) < 0.1;
    });
    for (const segment of heightSegments) {
        segment.dashed = true;
        segment.showLabel = false;
    }
}

function normalizeNestedRectangularPrismLayout(ctx, text) {
    const mentionsRectangularPrism = /(직육면체|rectangular\s*prism|cuboid|box)/i.test(text);
    const mentionsInnerCube = /(정육면체|작은|안에|inside|inner|cube)/i.test(text);
    if (!mentionsRectangularPrism || !mentionsInnerCube) return;

    const prisms = ctx.byType('prism').filter(prism =>
        Array.isArray(prism.baseVertexIds) &&
        Array.isArray(prism.topVertexIds) &&
        prism.baseVertexIds.length === 4 &&
        prism.topVertexIds.length === 4
    );
    if (prisms.length < 2) return;

    for (const prism of prisms) {
        prism.showLabel = false;
    }

    const innerPrism = prisms[1];
    const innerPointIds = new Set([...(innerPrism.baseVertexIds || []), ...(innerPrism.topVertexIds || [])]);
    for (const pointId of innerPointIds) {
        const point = ctx.byId.get(pointId);
        if (point?.type === 'point') {
            hidePointLike(point);
        }
    }
}

function normalizePrismCrossSectionLayout(ctx, text) {
    const mentionsPrism = /(직육면체|각기둥|rectangular prism|prism|cuboid|box)/i.test(text);
    const mentionsCrossSection = /(단면|cross.?section)/i.test(text);
    if (!mentionsPrism || !mentionsCrossSection) return;
    if (hasExplicitCoordinateHeavyRequest(text)) return;

    const prism = ctx.byType('prism')[0];
    if (!prism) return;
    const outerPoints = solidPointOperations(ctx, prism);
    if (outerPoints.length < 6) return;

    ensureProjectionSize(outerPoints, { minWidth: 7, minHeight: 5, minAspectRatio: 1.25 });

    const outerBounds = boundsOf(outerPoints.map(item => ({
        x: item.operation.x,
        y: item.operation.y
    })));
    const outerIds = new Set([...(prism.baseVertexIds || []), ...(prism.topVertexIds || [])]);
    const section = ctx.byType('polygon').find(polygon =>
        Array.isArray(polygon.vertexIds) &&
        polygon.vertexIds.length >= 4 &&
        !polygon.vertexIds.every(id => outerIds.has(id))
    );
    if (!section) return;

    const sectionPoints = section.vertexIds
        .slice(0, 4)
        .map(id => ctx.byId.get(id))
        .filter(operation => operation?.type === 'point');
    if (sectionPoints.length < 4) return;

    const width = outerBounds.maxX - outerBounds.minX;
    const height = outerBounds.maxY - outerBounds.minY;
    const targets = [
        { x: outerBounds.minX + width * 0.18, y: outerBounds.minY + height * 0.24 },
        { x: outerBounds.minX + width * 0.68, y: outerBounds.minY + height * 0.24 },
        { x: outerBounds.minX + width * 0.86, y: outerBounds.minY + height * 0.78 },
        { x: outerBounds.minX + width * 0.36, y: outerBounds.minY + height * 0.78 }
    ];

    for (let index = 0; index < sectionPoints.length; index += 1) {
        sectionPoints[index].x = roundCoordinate(targets[index].x);
        sectionPoints[index].y = roundCoordinate(targets[index].y);
        sectionPoints[index].visible = false;
        sectionPoints[index].showLabel = false;
    }

    if (section.fillOpacity === undefined || section.fillOpacity < 0.16) {
        section.fillOpacity = 0.18;
    }
    section.showLabel = false;
}

function normalizeNestedTriangularSolidLayout(ctx, text) {
    if (!/(삼각기둥|triangular prism)/i.test(text) || !/(삼각뿔|pyramid)/i.test(text)) return;
    if (hasExplicitCoordinateHeavyRequest(text)) return;

    const prism = ctx.byType('prism').find(item =>
        Array.isArray(item.baseVertexIds) &&
        Array.isArray(item.topVertexIds) &&
        item.baseVertexIds.length === 3 &&
        item.topVertexIds.length === 3
    );
    const pyramid = ctx.byType('pyramid').find(item =>
        Array.isArray(item.baseVertexIds) &&
        item.baseVertexIds.length === 3
    );
    if (!prism || !pyramid) return;

    const outerPoints = solidPointOperations(ctx, prism);
    if (outerPoints.length < 6) return;
    ensureProjectionSize(outerPoints, { minWidth: 7, minHeight: 5.8, minAspectRatio: 0.95 });

    const outerBounds = boundsOf(outerPoints.map(item => ({
        x: item.operation.x,
        y: item.operation.y
    })));
    const width = outerBounds.maxX - outerBounds.minX;
    const height = outerBounds.maxY - outerBounds.minY;
    const innerIds = [...pyramid.baseVertexIds, pyramid.apexId].filter(Boolean);
    const innerPoints = innerIds
        .map(id => ctx.byId.get(id))
        .filter(operation => operation?.type === 'point');
    if (innerPoints.length < 4) return;

    const targets = [
        { x: outerBounds.minX + width * 0.35, y: outerBounds.minY + height * 0.28 },
        { x: outerBounds.minX + width * 0.68, y: outerBounds.minY + height * 0.28 },
        { x: outerBounds.minX + width * 0.48, y: outerBounds.minY + height * 0.52 },
        { x: outerBounds.minX + width * 0.56, y: outerBounds.minY + height * 0.72 }
    ];

    for (let index = 0; index < innerPoints.length; index += 1) {
        innerPoints[index].x = roundCoordinate(targets[index].x);
        innerPoints[index].y = roundCoordinate(targets[index].y);
        innerPoints[index].visible = false;
        innerPoints[index].showLabel = false;
    }
}

function ensureProjectionSize(pointRecords, rule) {
    const points = pointRecords.map(item => item.point);
    const box = boundsOf(points);
    const width = box.maxX - box.minX;
    const height = box.maxY - box.minY;
    if (width <= 0 || height <= 0) return;

    let scaleX = Math.max(1, rule.minWidth / width);
    let scaleY = Math.max(1, rule.minHeight / height);
    if (Number.isFinite(rule.minAspectRatio) && (width * scaleX) / (height * scaleY) < rule.minAspectRatio) {
        scaleX = Math.max(scaleX, (rule.minAspectRatio * height * scaleY) / width);
    }

    if (scaleX <= 1 && scaleY <= 1) return;
    const center = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };

    for (const { operation, point } of pointRecords) {
        operation.x = roundCoordinate(center.x + (point.x - center.x) * scaleX);
        operation.y = roundCoordinate(center.y + (point.y - center.y) * scaleY);
    }
}

function solidPointOperations(ctx, solid) {
    const ids = solid.type === 'prism'
        ? [...(solid.baseVertexIds || []), ...(solid.topVertexIds || [])]
        : [...(solid.baseVertexIds || []), solid.apexId].filter(Boolean);

    return ids
        .map(id => ctx.byId.get(id))
        .filter(operation => operation?.type === 'point')
        .map(operation => ({ operation, point: { x: operation.x, y: operation.y } }))
        .filter(item => Number.isFinite(item.point.x) && Number.isFinite(item.point.y));
}

function circleRecord(ctx, circle, fallbackLabel) {
    const centerOp = ctx.byId.get(circle.centerId);
    const radiusOp = ctx.byId.get(circle.pointOnCircleId);
    const center = resolvePoint(ctx, circle.centerId);
    const radiusPoint = resolvePoint(ctx, circle.pointOnCircleId);
    if (!centerOp || !center || !radiusPoint) return null;
    return {
        circle,
        centerOp,
        radiusOp,
        center,
        radius: distance(center, radiusPoint),
        label: String(centerOp.label || fallbackLabel || circle.label || circle.id || '').trim()
    };
}

function hidePointLike(operation) {
    if (!operation) return;
    operation.visible = false;
    operation.showLabel = false;
    operation.pointSize = 0;
}

function ensureExternalLabelAnchor(ctx, label, point) {
    const normalizedLabel = normalizeName(label);
    if (!normalizedLabel) return null;

    const existing = ctx.operations.find(operation =>
        operation.type === 'point' &&
        normalizeName(operation.label) === normalizedLabel &&
        /_label$/.test(String(operation.id || ''))
    );
    if (existing) {
        existing.x = point.x;
        existing.y = point.y;
        existing.visible = true;
        existing.showLabel = true;
        existing.pointSize = Math.min(Number(existing.pointSize) || 0, 0.1);
        existing.label = label;
        return existing;
    }

    const id = uniqueId(ctx, `${normalizedLabel}_label`);
    const anchor = {
        op: 'create',
        id,
        type: 'point',
        x: point.x,
        y: point.y,
        label,
        pointSize: 0,
        showLabel: true,
        visible: true
    };
    ctx.operations.push(anchor);
    ctx.byId.set(id, anchor);
    return anchor;
}

function visiblePointRecords(ctx) {
    return ctx.operations
        .filter(operation => POINT_LIKE_TYPES.has(operation.type))
        .filter(operation => operation.visible !== false && operation.showLabel !== false)
        .map(operation => ({ operation, point: resolvePoint(ctx, operation.id) }))
        .filter(item => item.point);
}

function findNamedPoint(ctx, name) {
    const normalizedName = normalizeName(name);
    return ctx.operations.find(operation =>
        POINT_LIKE_TYPES.has(operation.type) &&
        (normalizeName(operation.id) === normalizedName || normalizeName(operation.label) === normalizedName)
    );
}

function visibleName(operation) {
    return String(operation.label || operation.id || '').replace(/\s+/g, '');
}

function normalizeName(value) {
    return String(value || '').replace(/[′’]/g, "'").replace(/\s+/g, '').toUpperCase();
}

function hasUsableLabelOffset(operation) {
    const x = Number(operation?.labelOffset?.x);
    const y = Number(operation?.labelOffset?.y);
    return Number.isFinite(x) && Number.isFinite(y) && Math.hypot(x, y) >= 6;
}

function setLabelOffset(operation, x, y) {
    operation.labelOffset = {
        x: Math.round(x),
        y: Math.round(y)
    };
}

function farEndpointId(ctx, line, vertexId) {
    if (!line) return null;
    if (line.point1Id === vertexId) return line.point2Id;
    if (line.point2Id === vertexId) return line.point1Id;

    const vertex = resolvePoint(ctx, vertexId);
    const p1 = resolvePoint(ctx, line.point1Id);
    const p2 = resolvePoint(ctx, line.point2Id);
    if (!vertex || !p1 || !p2) return line.point2Id || line.point1Id || null;
    return distance(vertex, p1) >= distance(vertex, p2) ? line.point1Id : line.point2Id;
}

function resolvePoint(ctx, id) {
    const operation = ctx.byId.get(id);
    if (!operation) return null;
    if (operation.type === 'point') {
        return Number.isFinite(operation.x) && Number.isFinite(operation.y)
            ? { x: operation.x, y: operation.y }
            : null;
    }
    if (operation.type === 'pointOnCircle') {
        const circle = ctx.byId.get(operation.circleId);
        const center = resolvePoint(ctx, circle?.centerId);
        const radiusPoint = resolvePoint(ctx, circle?.pointOnCircleId);
        if (!center || !radiusPoint || !Number.isFinite(operation.angle)) return null;
        const radius = distance(center, radiusPoint);
        return {
            x: center.x + radius * Math.cos(operation.angle),
            y: center.y + radius * Math.sin(operation.angle)
        };
    }
    if (operation.type === 'midpoint') {
        const segment = ctx.byId.get(operation.segmentId);
        const p1 = resolvePoint(ctx, segment?.point1Id);
        const p2 = resolvePoint(ctx, segment?.point2Id);
        return p1 && p2 ? { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 } : null;
    }
    return null;
}

function uniqueId(ctx, base) {
    let candidate = base;
    let index = 1;
    while (ctx.byId.has(candidate)) {
        candidate = `${base}_${index}`;
        index += 1;
    }
    return candidate;
}

function hasExplicitCoordinateHeavyRequest(text) {
    const coordinateMatches = String(text).match(/\(\s*[+-]?\d+(?:\.\d+)?\s*,\s*[+-]?\d+(?:\.\d+)?\s*\)/g);
    return (coordinateMatches || []).length >= 3;
}

function boundsOf(points) {
    return {
        minX: Math.min(...points.map(point => point.x)),
        maxX: Math.max(...points.map(point => point.x)),
        minY: Math.min(...points.map(point => point.y)),
        maxY: Math.max(...points.map(point => point.y))
    };
}

function averagePoint(points) {
    return {
        x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
        y: points.reduce((sum, point) => sum + point.y, 0) / points.length
    };
}

function subtract(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
}

function normalize(vector) {
    const length = Math.hypot(vector.x, vector.y);
    return length > 0 ? { x: vector.x / length, y: vector.y / length } : null;
}

function fallbackDirection(index) {
    const angle = (index % 8) * Math.PI / 4;
    return { x: Math.cos(angle), y: Math.sin(angle) };
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function roundCoordinate(value) {
    return Number(value.toFixed(2));
}

export default enhanceDiagramQuality;
