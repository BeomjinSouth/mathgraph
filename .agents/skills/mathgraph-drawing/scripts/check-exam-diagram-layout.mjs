#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const POINT_TYPES = new Set([
    'point',
    'pointOnLine',
    'pointOnObject',
    'pointOnCircle',
    'intersection',
    'midpoint',
    'circleCenterPoint'
]);

export function analyzeExamDiagramProject(project, options = {}) {
    const objects = Array.isArray(project?.objects) ? project.objects : [];
    const byId = new Map(objects.filter(object => object?.id).map(object => [object.id, object]));
    const scale = Number(project?.view?.scale) || 50;
    const minNamedPointGapPx = Number(options.minNamedPointGapPx) || 48;
    const issues = [];

    const addIssue = (severity, code, message, objectIds = []) => {
        issues.push({ severity, code, message, objectIds });
    };

    const labeledPoints = objects
        .filter(object => POINT_TYPES.has(object.type))
        .filter(object => object.visible !== false && object.showLabel !== false && String(object.label || '').trim())
        .map(object => ({ object, point: resolvePoint(object.id, byId) }))
        .filter(record => record.point);

    for (const { object } of labeledPoints) {
        const fontSize = Number(object.fontSize) || 27;
        const pointSize = Number(object.pointSize) || 0;
        const offsetX = Number(object?.labelOffset?.x);
        const offsetY = Number(object?.labelOffset?.y);

        const markerReason = options.pointMarkerReasons?.[object.id];
        if (pointSize > 0 && !(typeof markerReason === 'string' && markerReason.trim())) {
            addIssue('error', 'named-point-marker-visible', `${object.label}에 불필요한 점 표식이 있습니다.`, [object.id]);
        }
        if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) {
            addIssue('warning', 'label-offset-missing', `${object.label}의 명시적 labelOffset이 없습니다.`, [object.id]);
            continue;
        }

        const offsetDistance = Math.hypot(offsetX, offsetY);
        if (offsetDistance > Math.max(72, fontSize * 2.4)) {
            addIssue(
                'warning',
                'label-offset-too-far',
                `${object.label} 라벨이 점에서 ${offsetDistance.toFixed(1)}px 떨어져 있습니다. 라벨 대신 점 배치를 다시 검토하세요.`,
                [object.id]
            );
        }
        if (offsetY < -fontSize * 0.45) {
            addIssue(
                'warning',
                'top-label-baseline-too-high',
                `${object.label}의 위쪽 라벨 기준선이 과도하게 높습니다. textBaseline=bottom을 고려해 y를 0 부근부터 검토하세요.`,
                [object.id]
            );
        }
    }

    for (let i = 0; i < labeledPoints.length; i += 1) {
        for (let j = i + 1; j < labeledPoints.length; j += 1) {
            const first = labeledPoints[i];
            const second = labeledPoints[j];
            const gapPx = distance(first.point, second.point) * scale;
            if (gapPx < minNamedPointGapPx) {
                addIssue(
                    'warning',
                    'named-points-too-close',
                    `${first.object.label}와 ${second.object.label}의 화면 간격이 ${gapPx.toFixed(1)}px뿐입니다. 라벨을 멀리 밀기 전에 점 간격을 넓히세요.`,
                    [first.object.id, second.object.id]
                );
            }
        }
    }

    for (const dimension of objects.filter(object => object.type === 'lengthDimension')) {
        if (!Number.isFinite(Number(dimension.curvature))) {
            addIssue('error', 'length-curvature-missing', '길이 호의 curvature가 저장되지 않았습니다.', [dimension.id]);
        }
        if ((Number(dimension.lineWidth) || 0) < 2) {
            addIssue('warning', 'length-stroke-too-thin', '길이 호 선 굵기가 시험지 실선에 비해 너무 얇습니다.', [dimension.id]);
        }
    }

    return {
        fileFormat: project?.format || null,
        objectCount: objects.length,
        errorCount: issues.filter(issue => issue.severity === 'error').length,
        warningCount: issues.filter(issue => issue.severity === 'warning').length,
        issues
    };
}

function resolvePoint(id, byId, resolving = new Set()) {
    if (!id || resolving.has(id)) return null;
    const object = byId.get(id);
    if (!object) return null;
    const nextResolving = new Set(resolving).add(id);

    if (object.type === 'point') {
        return finitePoint(object.x, object.y);
    }
    if (object.type === 'midpoint') {
        const segment = byId.get(object.segmentId);
        const first = resolvePoint(segment?.point1Id, byId, nextResolving);
        const second = resolvePoint(segment?.point2Id, byId, nextResolving);
        return first && second
            ? { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }
            : null;
    }
    if (object.type === 'pointOnLine' || object.type === 'pointOnObject') {
        const line = byId.get(object.lineId);
        const first = resolvePoint(line?.point1Id, byId, nextResolving);
        const second = resolvePoint(line?.point2Id, byId, nextResolving);
        const t = Number(object.t);
        return first && second && Number.isFinite(t)
            ? { x: first.x + (second.x - first.x) * t, y: first.y + (second.y - first.y) * t }
            : null;
    }
    if (object.type === 'intersection') {
        const firstLine = byId.get(object.object1Id);
        const secondLine = byId.get(object.object2Id);
        const a = resolvePoint(firstLine?.point1Id, byId, nextResolving);
        const b = resolvePoint(firstLine?.point2Id, byId, nextResolving);
        const c = resolvePoint(secondLine?.point1Id, byId, nextResolving);
        const d = resolvePoint(secondLine?.point2Id, byId, nextResolving);
        return lineIntersection(a, b, c, d);
    }
    if (object.type === 'circleCenterPoint') {
        const circle = byId.get(object.circleId);
        return resolvePoint(circle?.centerId, byId, nextResolving);
    }
    return null;
}

function finitePoint(x, y) {
    const point = { x: Number(x), y: Number(y) };
    return Number.isFinite(point.x) && Number.isFinite(point.y) ? point : null;
}

function lineIntersection(a, b, c, d) {
    if (!a || !b || !c || !d) return null;
    const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
    if (Math.abs(denominator) < 1e-9) return null;
    const firstCross = a.x * b.y - a.y * b.x;
    const secondCross = c.x * d.y - c.y * d.x;
    return {
        x: (firstCross * (c.x - d.x) - (a.x - b.x) * secondCross) / denominator,
        y: (firstCross * (c.y - d.y) - (a.y - b.y) * secondCross) / denominator
    };
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function runCli() {
    const args = process.argv.slice(2);
    const strict = args.includes('--strict');
    const pointMarkerReasons = {};
    const files = [];
    for (let index = 0; index < args.length; index += 1) {
        if (args[index] === '--strict') continue;
        if (args[index] === '--point-marker') {
            const value = args[++index] || '';
            const separator = value.indexOf('=');
            if (separator <= 0 || !value.slice(separator + 1).trim()) {
                throw new Error('--point-marker는 id=수학적_이유 형식으로 지정하세요.');
            }
            pointMarkerReasons[value.slice(0, separator)] = value.slice(separator + 1);
        } else files.push(args[index]);
    }
    if (files.length === 0) {
        console.error('사용법: node check-exam-diagram-layout.mjs [--strict] <project.mathgraph.json> [...]');
        process.exitCode = 2;
        return;
    }

    let shouldFail = false;
    for (const file of files) {
        const absolute = path.resolve(file);
        const project = JSON.parse(fs.readFileSync(absolute, 'utf8'));
        const result = analyzeExamDiagramProject(project, { pointMarkerReasons });
        console.log(JSON.stringify({ file: absolute, ...result }, null, 2));
        if (result.errorCount > 0 || (strict && result.warningCount > 0)) shouldFail = true;
    }
    if (shouldFail) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    runCli();
}
