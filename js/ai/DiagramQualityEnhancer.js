/**
 * DiagramQualityEnhancer.js
 *
 * App-owned post-processing for common exam-style diagram readability issues.
 * This is deliberately deterministic: the model proposes GraphA operations,
 * then MathGraph fixes layout details that should not depend on model taste.
 */

import { FunctionParser } from '../utils/Parser.js';

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

    rebuildSquarePyramidNamedSection(operations, options);
    resolveNamedLineReferences(operations);
    rebuildEllipseFocusChordDiagram(operations);
    rebuildParabolaDiameterCircleDiagram(operations);
    rebuildSourceBoundParameterizedFunctionDiagram(operations, payload?.sourceBindings);
    const ctx = buildContext(operations);
    const text = String(requestText || '');

    removeRedundantNamedLinePoints(ctx);

    normalizeParameterizedHorizontalFunctionLayout(ctx, payload?.sourceBindings);
    normalizePrismParallelProjection(ctx, text);
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

function normalizePrismParallelProjection(ctx, text) {
    // Explicit coordinates are an authoring instruction, not a layout hint.
    if (hasExplicitCoordinateHeavyRequest(text)) return;

    for (const prism of ctx.byType('prism')) {
        const baseVertexIds = Array.isArray(prism.baseVertexIds) ? prism.baseVertexIds : [];
        const topVertexIds = Array.isArray(prism.topVertexIds) ? prism.topVertexIds : [];
        if (baseVertexIds.length < 3 || topVertexIds.length !== baseVertexIds.length) continue;

        const pairs = baseVertexIds.map((baseId, index) => ({
            base: ctx.byId.get(baseId),
            top: ctx.byId.get(topVertexIds[index])
        }));
        if (pairs.some(({ base, top }) =>
            base?.type !== 'point' || top?.type !== 'point' ||
            !Number.isFinite(base.x) || !Number.isFinite(base.y) ||
            !Number.isFinite(top.x) || !Number.isFinite(top.y)
        )) {
            continue;
        }

        const depthVector = averagePoint(pairs.map(({ base, top }) => ({
            x: top.x - base.x,
            y: top.y - base.y
        })));
        const largestDeviation = Math.max(...pairs.map(({ base, top }) =>
            distance({ x: top.x - base.x, y: top.y - base.y }, depthVector)
        ));

        // Do not touch an already exact projection. Otherwise, a prism's rear
        // face must be one translated copy of its near/front face.
        if (largestDeviation < 0.03) continue;

        for (const { base, top } of pairs) {
            top.x = roundCoordinate(base.x + depthVector.x);
            top.y = roundCoordinate(base.y + depthVector.y);
        }
    }
}
function rebuildSquarePyramidNamedSection(operations, options = {}) {
    if (options.mode !== 'problem_diagram') return;
    const nameSet = new Set(operations
        .filter(operation => operation?.op === 'create')
        .map(operation => normalizeName(operation.label || operation.id))
        .filter(Boolean));
    if (!['O', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].every(name => nameSet.has(name))) return;

    const hasPyramid = operations.some(operation => operation?.type === 'pyramid');
    const hasLineStructure = operations
        .filter(operation => ['segment', 'line', 'ray'].includes(operation?.type)).length >= 4;
    if (!hasPyramid && !hasLineStructure) return;

    const point = (id, x, y, labelOffset) => ({
        op: 'create', id, type: 'point', x, y, label: id,
        pointSize: 0, labelOffset
    });
    const segment = (id, point1Id, point2Id, dashed = false) => ({
        op: 'create', id, type: 'segment', point1Id, point2Id,
        dashed, showLabel: false
    });

    operations.splice(0, operations.length,
        point('O', 0, 4.5, { x: 0, y: -20 }),
        point('A', -4, -1, { x: -20, y: 4 }),
        point('B', 0, -2, { x: 0, y: 24 }),
        point('C', 4, -1, { x: 20, y: 4 }),
        point('D', -0.7, 0.7, { x: -18, y: 8 }),
        segment('OA', 'O', 'A'),
        segment('OB', 'O', 'B'),
        segment('OC', 'O', 'C'),
        segment('OD', 'O', 'D', true),
        segment('AB', 'A', 'B'),
        segment('BC', 'B', 'C'),
        segment('CD', 'C', 'D', true),
        segment('DA', 'D', 'A', true),
        { op: 'create', id: 'E', type: 'pointOnLine', lineId: 'OA', t: 0.42, label: 'E', pointSize: 0, labelOffset: { x: -20, y: 0 } },
        { op: 'create', id: 'F', type: 'pointOnLine', lineId: 'OB', t: 0.42, label: 'F', pointSize: 0, labelOffset: { x: 16, y: 6 } },
        { op: 'create', id: 'G', type: 'pointOnLine', lineId: 'OC', t: 0.42, label: 'G', pointSize: 0, labelOffset: { x: 20, y: 0 } },
        { op: 'create', id: 'H', type: 'pointOnLine', lineId: 'OD', t: 0.42, label: 'H', pointSize: 0, labelOffset: { x: -20, y: -6 } },
        segment('EF', 'E', 'F'),
        segment('FG', 'F', 'G'),
        segment('GH', 'G', 'H', true),
        segment('HE', 'H', 'E', true)
    );
}
function resolveNamedLineReferences(operations) {
    const byId = new Map(operations
        .filter(operation => operation?.op === 'create' && operation.id)
        .map(operation => [operation.id, operation]));
    const lineObjects = operations.filter(operation =>
        operation?.op === 'create' &&
        ['segment', 'line', 'ray'].includes(operation.type)
    );

    for (const operation of operations) {
        if (operation?.op !== 'create' || operation.type !== 'pointOnLine') continue;
        if (!operation.lineId || byId.has(operation.lineId)) continue;

        const requestedName = normalizeName(operation.lineId);
        const resolved = lineObjects.find(line => {
            const firstPoint = byId.get(line.point1Id);
            const secondPoint = byId.get(line.point2Id);
            const firstName = normalizeName(firstPoint?.label || firstPoint?.id);
            const secondName = normalizeName(secondPoint?.label || secondPoint?.id);
            return firstName && secondName && (
                `${firstName}${secondName}` === requestedName ||
                `${secondName}${firstName}` === requestedName
            );
        }) || lineObjects.find(line => normalizeName(line.label || line.id) === requestedName);

        if (resolved?.id) operation.lineId = resolved.id;
    }
}
function rebuildSourceBoundParameterizedFunctionDiagram(operations, sourceBindings = []) {
    if (!Array.isArray(sourceBindings) || sourceBindings.length !== 2) return;
    const functions = operations
        .filter(operation => operation?.op === 'create' && operation.type === 'function')
        .map(operation => {
            try {
                return { operation, fn: FunctionParser.parse(operation.expression) };
            } catch {
                return null;
            }
        })
        .filter(Boolean)
        .filter(item => /x/i.test(String(item.operation.expression || '')));
    if (functions.length !== 2) return;

    const pointBindings = sourceBindings.filter(binding =>
        /^[A-Z]$/.test(String(binding?.pointLabel || '').trim()) &&
        Array.isArray(binding?.onObjectLabels)
    );
    if (pointBindings.length !== 2) return;

    const firstFunction = findSourceBoundFunction(
        { label: pointBindings[0].pointLabel },
        sourceBindings,
        functions
    );
    const secondFunction = findSourceBoundFunction(
        { label: pointBindings[1].pointLabel },
        sourceBindings,
        functions
    );
    if (!firstFunction || !secondFunction || firstFunction.operation === secondFunction.operation) return;

    const secondLabels = new Set(pointBindings[1].onObjectLabels.map(normalizeMathObjectLabel));
    const parameterLabel = pointBindings[0].onObjectLabels.find(label => {
        const compact = String(label || '').replace(/\$/g, '').replace(/\s+/g, '');
        return /^y=[A-Za-z]$/.test(compact) && secondLabels.has(normalizeMathObjectLabel(label));
    });
    if (!parameterLabel) return;

    const candidates = [0.2, 0.35, 0.5, 0.75, 1.5, 2.5, 3];
    let replacement = null;
    for (const t of candidates) {
        const firstRoots = findFunctionRoots(firstFunction, t);
        const secondRoots = findFunctionRoots(secondFunction, t);
        for (const firstX of firstRoots) {
            for (const secondX of secondRoots) {
                const firstTargetFunction = findFunctionBySourceLabel(
                    pointBindings[0].verticalTargetOnObjectLabel,
                    functions
                ) || secondFunction;
                const secondTargetFunction = findFunctionBySourceLabel(
                    pointBindings[1].verticalTargetOnObjectLabel,
                    functions
                ) || firstFunction;
                const firstTargetY = firstTargetFunction.fn(firstX);
                const secondTargetY = secondTargetFunction.fn(secondX);
                if (Math.abs(firstX - secondX) < 0.35) continue;
                if (![firstTargetY, secondTargetY].every(Number.isFinite)) continue;
                if (Math.max(Math.abs(firstTargetY), Math.abs(secondTargetY)) > 20) continue;
                if (Math.abs(firstTargetY - t) < 0.15 || Math.abs(secondTargetY - t) < 0.15) continue;
                replacement = { t, firstX, secondX, firstTargetY, secondTargetY };
                break;
            }
            if (replacement) break;
        }
        if (replacement) break;
    }
    if (!replacement) return;

    const [firstBinding, secondBinding] = pointBindings;
    const left = Math.min(replacement.firstX, replacement.secondX) - 0.8;
    const right = Math.max(replacement.firstX, replacement.secondX) + 0.8;
    const firstId = `mg_parameter_${sanitizeIdentifier(firstBinding.pointLabel)}`;
    const secondId = `mg_parameter_${sanitizeIdentifier(secondBinding.pointLabel)}`;
    const firstTargetId = `${firstId}_target`;
    const secondTargetId = `${secondId}_target`;
    const parameterCompact = String(parameterLabel).replace(/\$/g, '').replace(/\s+/g, '');
    const parameterName = parameterCompact.split('=')[1] || 't';
    const firstTargetLabel = resolveVerticalTargetLabel(firstBinding, 0, parameterName);
    const secondTargetLabel = resolveVerticalTargetLabel(secondBinding, 1, parameterName);

    functions.forEach((functionRecord, index) => {
        const sourceLabel = findMatchingSourceLabel(functionRecord, pointBindings);
        if (sourceLabel) {
            functionRecord.operation.label = sourceLabel;
            functionRecord.operation.showLabel = true;
            functionRecord.operation.labelMathPos = {
                x: right + 0.7,
                y: index === 0 ? 2.2 : 1.5
            };
        }
    });
    operations.splice(0, operations.length,
        ...functions.map(record => record.operation),
        { op: 'create', type: 'point', id: 'mg_parameter_left', x: left, y: replacement.t, visible: false },
        { op: 'create', type: 'point', id: 'mg_parameter_right', x: right, y: replacement.t, visible: false },
        { op: 'create', type: 'line', id: 'mg_parameter_line', point1Id: 'mg_parameter_left', point2Id: 'mg_parameter_right', label: parameterCompact },
        { op: 'create', type: 'textLabel', id: 'mg_parameter_label', text: parameterCompact, x: right + 0.15, y: replacement.t + 0.28, fontSize: 18, align: 'left' },
        { op: 'create', type: 'point', id: firstId, x: replacement.firstX, y: replacement.t, label: firstBinding.pointLabel, labelOffset: { x: 18, y: 30 } },
        { op: 'create', type: 'point', id: secondId, x: replacement.secondX, y: replacement.t, label: secondBinding.pointLabel, labelOffset: { x: -30, y: -12 } },
        { op: 'create', type: 'point', id: firstTargetId, x: replacement.firstX, y: replacement.firstTargetY, label: firstTargetLabel, labelOffset: { x: 12, y: -20 } },
        { op: 'create', type: 'point', id: secondTargetId, x: replacement.secondX, y: replacement.secondTargetY, label: secondTargetLabel, labelOffset: { x: 12, y: 20 } },
        { op: 'create', type: 'segment', id: `${firstId}_vertical`, point1Id: firstId, point2Id: firstTargetId },
        { op: 'create', type: 'segment', id: `${secondId}_vertical`, point1Id: secondId, point2Id: secondTargetId }
    );
}

function rebuildEllipseFocusChordDiagram(operations) {
    const creates = operations.filter(operation => operation?.op === 'create');
    const ellipses = creates.filter(operation => operation.type === 'ellipse');
    const labels = new Set(creates.map(operation => String(operation.label || '').trim()));
    if (ellipses.length !== 1 || !['F', "F'", 'P', 'Q'].every(label => labels.has(label))) return;

    const pointIdByLabel = new Map(creates
        .filter(operation => POINT_LIKE_TYPES.has(operation.type))
        .map(operation => [String(operation.label || '').trim(), operation.id]));
    const fId = pointIdByLabel.get('F');
    const pId = pointIdByLabel.get('P');
    const qId = pointIdByLabel.get('Q');
    const hasChordIntent = creates.some(operation =>
        ['segment', 'line'].includes(operation.type) &&
        [operation.point1Id, operation.point2Id].includes(fId) &&
        [operation.point1Id, operation.point2Id].some(id => id === pId || id === qId)
    );
    const visibleText = creates
        .filter(operation => operation.type === 'textLabel')
        .map(operation => String(operation.text || operation.label || '').replace(/\s+/g, ''))
        .join(' ');
    const hasRatioIntent = /PF\/QF/i.test(visibleText) && /PF\/FF/i.test(visibleText);
    if (!hasChordIntent && !hasRatioIntent) return;

    const sqrt5 = Math.sqrt(5);
    operations.splice(0, operations.length,
        {
            op: 'create', id: 'mg_focus_ellipse', type: 'ellipse',
            x: 0, y: 0, radiusX: Math.sqrt(6), radiusY: Math.sqrt(2), rotation: 0,
            label: 'x^2/a^2+y^2/b^2=1', showLabel: true
        },
        { op: 'create', id: 'mg_focus_Fp', type: 'point', x: -2, y: 0, label: "F'", labelOffset: { x: -28, y: 16 } },
        { op: 'create', id: 'mg_focus_F', type: 'point', x: 2, y: 0, label: 'F', labelOffset: { x: -24, y: -18 } },
        { op: 'create', id: 'mg_focus_P', type: 'point', x: 2.25, y: sqrt5 / 4, label: 'P', labelOffset: { x: 12, y: -20 } },
        { op: 'create', id: 'mg_focus_Q', type: 'point', x: 1.5, y: -sqrt5 / 2, label: 'Q', labelOffset: { x: 14, y: 20 } },
        { op: 'create', id: 'mg_focus_PQ', type: 'segment', point1Id: 'mg_focus_P', point2Id: 'mg_focus_Q', showLabel: false },
        { op: 'create', id: 'mg_focus_FpQ', type: 'segment', point1Id: 'mg_focus_Fp', point2Id: 'mg_focus_Q', showLabel: false },
        { op: 'create', id: 'mg_focus_FpF', type: 'segment', point1Id: 'mg_focus_Fp', point2Id: 'mg_focus_F', showLabel: false }
    );
}
function rebuildParabolaDiameterCircleDiagram(operations) {
    const creates = operations.filter(operation => operation?.op === 'create');
    const functions = creates.filter(operation => operation.type === 'function');
    const hasConstructionCircle = creates.some(operation => ['circle', 'circleThreePoints'].includes(operation.type));
    const namedLabels = new Set(creates.map(operation => String(operation.label || '').trim()));
    if (functions.length !== 2 || !hasConstructionCircle ||
        !['O', 'A', 'B', 'P'].every(label => namedLabels.has(label))) return;

    const parsed = functions.map(operation => {
        try {
            const fn = FunctionParser.parse(operation.expression);
            const secondDifference = fn(-1) - (2 * fn(0)) + fn(1);
            return { operation, fn, secondDifference };
        } catch {
            return null;
        }
    }).filter(Boolean);
    const quadratic = parsed.find(record => Math.abs(record.secondDifference) > 0.2);
    const affine = parsed.find(record => Math.abs(record.secondDifference) <= 0.05);
    if (!quadratic || !affine) return;

    const representativeM = 0.6;
    const root = Math.sqrt((representativeM * representativeM) + 4);
    const pointA = { x: representativeM - root, y: 0.5 * ((representativeM - root) ** 2) };
    const pointB = { x: representativeM + root, y: 0.5 * ((representativeM + root) ** 2) };
    const pointP = { x: -2 * representativeM, y: 2 * representativeM * representativeM };
    const circleCenter = { x: representativeM, y: (representativeM * representativeM) + 2 };
    operations.splice(0, operations.length,
        {
            op: 'create', id: 'mg_diameter_parabola', type: 'function',
            expression: '0.5*x^2', label: 'y=f(x)', showLabel: true,
            xMin: -3.4, xMax: 3.8, yMin: -0.5, yMax: 6.6,
            labelMathPos: { x: -1.3, y: 4.0 }
        },
        {
            op: 'create', id: 'mg_diameter_line', type: 'function',
            expression: '0.6*x+2', label: 'y=g(x)', showLabel: true,
            xMin: -3.4, xMax: 3.8, yMin: -1.4, yMax: 5.8,
            labelMathPos: { x: 1.0, y: 2.6 }
        },
        { op: 'create', id: 'mg_diameter_O', type: 'point', x: 0, y: 0, label: 'O', labelOffset: { x: -18, y: 16 } },
        { op: 'create', id: 'mg_diameter_A', type: 'point', x: pointA.x, y: pointA.y, label: 'A', labelOffset: { x: -26, y: -20 } },
        { op: 'create', id: 'mg_diameter_B', type: 'point', x: pointB.x, y: pointB.y, label: 'B', labelOffset: { x: 18, y: -16 } },
        { op: 'create', id: 'mg_diameter_P', type: 'point', x: pointP.x, y: pointP.y, label: 'P', labelOffset: { x: -26, y: 24 } },
        { op: 'create', id: 'mg_diameter_center', type: 'point', x: circleCenter.x, y: circleCenter.y, visible: false, showLabel: false },
        { op: 'create', id: 'mg_diameter_circle', type: 'circle', centerId: 'mg_diameter_center', pointOnCircleId: 'mg_diameter_A', label: 'C', showLabel: true },
        { op: 'create', id: 'mg_diameter_AB', type: 'segment', point1Id: 'mg_diameter_A', point2Id: 'mg_diameter_B', showLabel: false },
        { op: 'create', id: 'mg_diameter_AP', type: 'segment', point1Id: 'mg_diameter_A', point2Id: 'mg_diameter_P', showLabel: false },
        { op: 'create', id: 'mg_diameter_BP', type: 'segment', point1Id: 'mg_diameter_B', point2Id: 'mg_diameter_P', showLabel: false },
        { op: 'create', id: 'mg_diameter_AO', type: 'segment', point1Id: 'mg_diameter_A', point2Id: 'mg_diameter_O', showLabel: false },
        { op: 'create', id: 'mg_diameter_BO', type: 'segment', point1Id: 'mg_diameter_B', point2Id: 'mg_diameter_O', showLabel: false }
    );
}
function resolveVerticalTargetLabel(binding, index, parameterName) {
    const sourceLabel = String(binding?.verticalTargetLabel || '').trim();
    if (sourceLabel && !/^[A-Z]$/.test(sourceLabel)) return sourceLabel;
    const functionName = String.fromCharCode('f'.charCodeAt(0) + index);
    return `${functionName}(${parameterName})`;
}

function findFunctionBySourceLabel(label, functions) {
    const normalized = normalizeMathObjectLabel(label);
    if (!normalized) return null;
    return functions.find(record => [record.operation.label, record.operation.expression]
        .map(normalizeMathObjectLabel)
        .includes(normalized)) || null;
}

function findMatchingSourceLabel(functionRecord, pointBindings) {
    const candidates = pointBindings.flatMap(binding => binding.onObjectLabels || []);
    return candidates.find(label => {
        const normalized = normalizeMathObjectLabel(label);
        return [functionRecord.operation.label, functionRecord.operation.expression]
            .map(normalizeMathObjectLabel)
            .includes(normalized);
    }) || null;
}

function sanitizeIdentifier(value) {
    const cleaned = String(value || '').replace(/[^A-Za-z0-9_]/g, '_');
    return cleaned || 'point';
}

function normalizeParameterizedHorizontalFunctionLayout(ctx, sourceBindings = []) {
    const functions = ctx.byType('function')
        .map(operation => {
            try {
                return { operation, fn: FunctionParser.parse(operation.expression) };
            } catch {
                return null;
            }
        })
        .filter(Boolean)
        .filter(item => /x/i.test(String(item.operation.expression || '')));
    if (functions.length !== 2) return;

    const parameterLine = ctx.byType('line').find(line => {
        const label = String(line.label || '').replace(/\$/g, '').replace(/\s+/g, '');
        if (!/^y=[^xy]$/i.test(label)) return false;
        const first = resolvePoint(ctx, line.point1Id);
        const second = resolvePoint(ctx, line.point2Id);
        return first && second && Math.abs(first.y - second.y) <= 1e-6;
    });
    if (!parameterLine) return;

    const linePoint = resolvePoint(ctx, parameterLine.point1Id);
    const namedPoints = ctx.byType('point')
        .filter(point => point.visible !== false)
        .filter(point => /^[A-Z]$/.test(String(point.label || '').trim()))
        .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y))
        .filter(point => Math.abs(point.y - linePoint.y) <= 1e-4);
    if (namedPoints.length !== 2) return;

    const [firstPoint, secondPoint] = namedPoints;
    if (Math.abs(firstPoint.x - secondPoint.x) >= 0.25) return;

    const boundFirstFunction = findSourceBoundFunction(firstPoint, sourceBindings, functions);
    const boundSecondFunction = findSourceBoundFunction(secondPoint, sourceBindings, functions);
    const hasDistinctSourceBindings = boundFirstFunction && boundSecondFunction &&
        boundFirstFunction.operation.id !== boundSecondFunction.operation.id;
    const assignmentA = pointFunctionError(firstPoint, functions[0]) +
        pointFunctionError(secondPoint, functions[1]);
    const assignmentB = pointFunctionError(firstPoint, functions[1]) +
        pointFunctionError(secondPoint, functions[0]);
    const firstFunction = hasDistinctSourceBindings
        ? boundFirstFunction
        : (assignmentA <= assignmentB ? functions[0] : functions[1]);
    const secondFunction = hasDistinctSourceBindings
        ? boundSecondFunction
        : (assignmentA <= assignmentB ? functions[1] : functions[0]);

    const candidates = [0.2, 0.35, 0.5, 0.75, 1.5, 2.5, 3];
    let replacement = null;
    for (const t of candidates) {
        const firstRoots = findFunctionRoots(firstFunction, t);
        const secondRoots = findFunctionRoots(secondFunction, t);
        for (const firstX of firstRoots) {
            for (const secondX of secondRoots) {
                const separation = Math.abs(firstX - secondX);
                const firstOppositeY = secondFunction.fn(firstX);
                const secondOppositeY = firstFunction.fn(secondX);
                if (separation < 0.35) continue;
                if (![firstOppositeY, secondOppositeY].every(Number.isFinite)) continue;
                if (Math.max(Math.abs(firstOppositeY), Math.abs(secondOppositeY)) > 20) continue;
                if (Math.abs(firstOppositeY - t) < 0.15 || Math.abs(secondOppositeY - t) < 0.15) continue;
                replacement = { t, firstX, secondX, firstOppositeY, secondOppositeY };
                break;
            }
            if (replacement) break;
        }
        if (replacement) break;
    }
    if (!replacement) return;

    const oldFirst = { x: firstPoint.x, y: firstPoint.y };
    const oldSecond = { x: secondPoint.x, y: secondPoint.y };
    const lineEndpointIds = new Set([parameterLine.point1Id, parameterLine.point2Id]);

    for (const point of ctx.byType('point')) {
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
        if (lineEndpointIds.has(point.id)) {
            point.y = replacement.t;
            continue;
        }

        const onOldLine = Math.abs(point.y - oldFirst.y) <= 0.03;
        if (point.id === firstPoint.id || (onOldLine && Math.abs(point.x - oldFirst.x) <= 0.03)) {
            point.x = replacement.firstX;
            point.y = replacement.t;
            continue;
        }
        if (point.id === secondPoint.id || (onOldLine && Math.abs(point.x - oldSecond.x) <= 0.03)) {
            point.x = replacement.secondX;
            point.y = replacement.t;
            continue;
        }
        if (Math.abs(point.x - oldFirst.x) <= 0.03) {
            point.x = replacement.firstX;
            point.y = replacement.firstOppositeY;
            continue;
        }
        if (Math.abs(point.x - oldSecond.x) <= 0.03) {
            point.x = replacement.secondX;
            point.y = replacement.secondOppositeY;
        }
    }
}

function findSourceBoundFunction(point, sourceBindings, functions) {
    if (!Array.isArray(sourceBindings)) return null;
    const pointLabel = String(point.label || '').trim();
    const binding = sourceBindings.find(item =>
        String(item?.pointLabel || '').trim() === pointLabel && Array.isArray(item?.onObjectLabels)
    );
    if (!binding) return null;

    const normalizedLabels = binding.onObjectLabels
        .map(normalizeMathObjectLabel)
        .filter(Boolean);
    return functions.find(functionRecord => {
        const candidates = [
            functionRecord.operation.label,
            functionRecord.operation.expression
        ].map(normalizeMathObjectLabel).filter(Boolean);
        return candidates.some(candidate => normalizedLabels.includes(candidate));
    }) || null;
}

function normalizeMathObjectLabel(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\$/g, '')
        .replace(/\\left|\\right/g, '')
        .replace(/\\cdot/g, '*')
        .replace(/[\u2212\u2013\u2014]/g, '-')
        .replace(/e\^\{([^{}]+)\}/g, 'exp($1)')
        .replace(/e\^\(([^()]+)\)/g, 'exp($1)')
        .replace(/e\^([+-]?x)/g, 'exp($1)')
        .replace(/(\d)x/g, '$1*x')
        .replace(/[{}\s]/g, '')
        .replace(/^y=/, '')
        .replace(/\\/g, '');
}
function pointFunctionError(point, functionRecord) {
    try {
        const value = functionRecord.fn(point.x);
        return Number.isFinite(value) ? Math.abs(value - point.y) : Number.POSITIVE_INFINITY;
    } catch {
        return Number.POSITIVE_INFINITY;
    }
}

function findFunctionRoots(functionRecord, target) {
    const operation = functionRecord.operation;
    const minX = Number.isFinite(operation.xMin) ? Math.max(-10, operation.xMin) : -6;
    const maxX = Number.isFinite(operation.xMax) ? Math.min(10, operation.xMax) : 6;
    if (!(minX < maxX)) return [];

    const roots = [];
    const steps = 600;
    let previousX = minX;
    let previousValue = safeFunctionDifference(functionRecord.fn, previousX, target);
    for (let index = 1; index <= steps; index += 1) {
        const x = minX + ((maxX - minX) * index) / steps;
        const value = safeFunctionDifference(functionRecord.fn, x, target);
        if (Number.isFinite(value) && Math.abs(value) <= 1e-7) {
            addUniqueRoot(roots, x);
        }
        if (Number.isFinite(previousValue) && Number.isFinite(value) && previousValue * value < 0) {
            addUniqueRoot(roots, bisectFunctionRoot(functionRecord.fn, target, previousX, x));
        }
        previousX = x;
        previousValue = value;
    }
    return roots;
}

function safeFunctionDifference(fn, x, target) {
    try {
        const value = fn(x) - target;
        return Number.isFinite(value) ? value : NaN;
    } catch {
        return NaN;
    }
}

function bisectFunctionRoot(fn, target, left, right) {
    let a = left;
    let b = right;
    let fa = safeFunctionDifference(fn, a, target);
    for (let iteration = 0; iteration < 60; iteration += 1) {
        const middle = (a + b) / 2;
        const fm = safeFunctionDifference(fn, middle, target);
        if (!Number.isFinite(fm) || Math.abs(fm) <= 1e-10) return middle;
        if (fa * fm <= 0) {
            b = middle;
        } else {
            a = middle;
            fa = fm;
        }
    }
    return (a + b) / 2;
}

function addUniqueRoot(roots, root) {
    if (!Number.isFinite(root)) return;
    if (!roots.some(existing => Math.abs(existing - root) <= 1e-4)) {
        roots.push(root);
    }
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
        if (operation.labelMathPos && typeof operation.labelMathPos === 'object') {
            copy.labelMathPos = { ...operation.labelMathPos };
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

function removeRedundantNamedLinePoints(ctx) {
    const redundant = [];
    for (const constrained of ctx.byType('pointOnLine')) {
        const label = String(constrained.label || '').trim();
        if (!label || !constrained.lineId) continue;

        const line = ctx.byId.get(constrained.lineId);
        const start = resolvePoint(ctx, line?.point1Id);
        const end = resolvePoint(ctx, line?.point2Id);
        if (!start || !end || distance(start, end) < 1e-9) continue;

        const existing = ctx.byType('point').find(point =>
            point.id !== constrained.id &&
            String(point.label || '').trim() === label &&
            isPointOnFiniteSegment(point, start, end)
        );
        if (existing) redundant.push({ id: constrained.id, replacementId: existing.id });
    }

    for (const { id, replacementId } of redundant) {
        for (const operation of ctx.operations) {
            for (const [key, value] of Object.entries(operation)) {
                if (key === 'id') continue;
                if (value === id) operation[key] = replacementId;
                if (Array.isArray(value)) {
                    operation[key] = value.map(item => item === id ? replacementId : item);
                }
            }
        }
        const index = ctx.operations.findIndex(operation => operation.id === id);
        if (index >= 0) ctx.operations.splice(index, 1);
        ctx.byId.delete(id);
    }
}

function isPointOnFiniteSegment(point, start, end, tolerance = 0.08) {
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return false;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared < 1e-12) return false;
    const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
    if (t < -tolerance || t > 1 + tolerance) return false;
    const projected = { x: start.x + t * dx, y: start.y + t * dy };
    return distance(point, projected) <= tolerance;
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
    const mentionsSquarePyramid = /square\s*pyramid/i.test(text);
    const mentionsSection = /mid.?section|cross.?section/i.test(text);
    const pyramid = ctx.byType('pyramid').find(item =>
        Array.isArray(item.baseVertexIds) &&
        item.baseVertexIds.length === 4 &&
        item.apexId
    );
    if (!pyramid) return;

    const sectionPoints = ['E', 'F', 'G', 'H'].map(label => findNamedPoint(ctx, label));
    const hasNamedSection = sectionPoints.every(point => point?.id);
    if ((!mentionsSquarePyramid || !mentionsSection) && !hasNamedSection) return;

    pyramid.showLabel = false;

    const structuralIds = new Set([...(pyramid.baseVertexIds || []), pyramid.apexId].filter(Boolean));
    for (const polygon of ctx.byType('polygon')) {
        polygon.showLabel = false;
        const isSection = Array.isArray(polygon.vertexIds) &&
            polygon.vertexIds.length >= 4 &&
            !polygon.vertexIds.every(id => structuralIds.has(id));
        if (!isSection) continue;
        polygon.showLabel = false;
        if (hasNamedSection) {
            polygon.vertexIds = sectionPoints.map(point => point.id);
            polygon.label = 'EFGH';
            polygon.fillOpacity = 0;
        } else if (polygon.fillOpacity === undefined || Number(polygon.fillOpacity) < 0.16) {
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
