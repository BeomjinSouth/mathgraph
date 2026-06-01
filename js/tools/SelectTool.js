/**
 * SelectTool.js - 선택/이동 도구 (Mk.2 확장)
 * - Shift+클릭: 다중 선택
 * - 드래그 박스: 영역 내 선택
 * - Shift+드래그: 평행이동
 */

import { Tool } from './Tool.js';
import { Geometry, Vec2 } from '../utils/Geometry.js';

const INFINITE_LINE_TYPES = new Set([
    'line',
    'parallel',
    'perpendicular',
    'perpendicularBisector',
    'angleBisector',
    'tangentCircle',
    'tangentFunction'
]);

const RAY_TYPES = new Set(['ray']);

export class SelectTool extends Tool {
    constructor() {
        super('select');
        this.isDragging = false;
        this.isRotating = false;
        this.isBoxSelecting = false;
        this.isShiftDragging = false; // Mk.2: Shift+드래그 평행이동
        this.draggedObjects = [];
        this.clickStartPos = null;
        this.clickStartMathPos = null;
        this.clickStartTime = null; // 클릭 시작 시간

        // Mk.2: 드래그 박스 선택
        this.boxStart = null;
        this.boxEnd = null;

        // 빈 공간 클릭 감지용
        this.emptySpaceClick = false;
    }

    activate(app) {
        super.activate(app);
        app.canvasElement.style.cursor = 'default';
    }

    getCursor() {
        return 'default';
    }

    getObjectRotationCenter(object, app) {
        if (!object?.getRotationCenter) {
            return null;
        }

        const center = object.getRotationCenter(app.objectManager);
        if (!center || !Number.isFinite(center.x) || !Number.isFinite(center.y)) {
            return null;
        }

        return center;
    }

    isRotationGesture(object, event, app) {
        const modifierPressed = event.ctrlKey || event.metaKey;
        return modifierPressed &&
            this.getObjectDragTargets(object, app).length > 0 &&
            !!this.getObjectRotationCenter(object, app);
    }

    getObjectDragTargets(object, app) {
        if (!object?.getDragTargets) {
            return [];
        }

        return object.getDragTargets(app.objectManager).filter(target =>
            target &&
            target.isDraggable?.() &&
            typeof target.getPosition === 'function' &&
            typeof target.setPosition === 'function'
        );
    }

    collectSelectionDragTargets(objects, app) {
        const pointsToMove = new Set();

        for (const obj of objects) {
            if (!obj) continue;

            if (obj.type === 'point' && obj.isDraggable?.()) {
                pointsToMove.add(obj);
                continue;
            }

            const customTargets = this.getObjectDragTargets(obj, app);
            if (customTargets.length > 0) {
                for (const target of customTargets) {
                    pointsToMove.add(target);
                }
                continue;
            }

            if (!obj.dependencies) continue;

            for (const depId of obj.dependencies) {
                const dep = app.objectManager.getObject(depId);
                if (
                    dep?.type === 'point' &&
                    dep.isDraggable?.() &&
                    typeof dep.getPosition === 'function' &&
                    typeof dep.setPosition === 'function'
                ) {
                    pointsToMove.add(dep);
                }
            }
        }

        return Array.from(pointsToMove);
    }

    getSelectionRect(start, end) {
        return {
            minX: Math.min(start.x, end.x),
            maxX: Math.max(start.x, end.x),
            minY: Math.min(start.y, end.y),
            maxY: Math.max(start.y, end.y)
        };
    }

    pointInSelectionRect(point, rect) {
        return point &&
            Number.isFinite(point.x) &&
            Number.isFinite(point.y) &&
            point.x >= rect.minX &&
            point.x <= rect.maxX &&
            point.y >= rect.minY &&
            point.y <= rect.maxY;
    }

    selectionRectCorners(rect) {
        return [
            new Vec2(rect.minX, rect.minY),
            new Vec2(rect.maxX, rect.minY),
            new Vec2(rect.maxX, rect.maxY),
            new Vec2(rect.minX, rect.maxY)
        ];
    }

    segmentIntersectsSelectionRect(p1, p2, rect) {
        if (this.pointInSelectionRect(p1, rect) || this.pointInSelectionRect(p2, rect)) {
            return true;
        }

        const corners = this.selectionRectCorners(rect);
        for (let i = 0; i < corners.length; i++) {
            const edgeStart = corners[i];
            const edgeEnd = corners[(i + 1) % corners.length];
            if (Geometry.segmentSegmentIntersection(p1, p2, edgeStart, edgeEnd)) {
                return true;
            }
        }

        return false;
    }

    infiniteLineIntersectsSelectionRect(p1, p2, rect) {
        const direction = p2.sub(p1);
        if (direction.lengthSq() <= 1e-12) {
            return false;
        }

        const signedDistances = this.selectionRectCorners(rect)
            .map(corner => direction.cross(corner.sub(p1)));

        const min = Math.min(...signedDistances);
        const max = Math.max(...signedDistances);

        return min <= 0 && max >= 0;
    }

    rayIntersectsSelectionRect(origin, throughPoint, rect) {
        if (this.pointInSelectionRect(origin, rect)) {
            return true;
        }

        const direction = throughPoint.sub(origin).normalize();
        if (direction.lengthSq() <= 1e-12) {
            return false;
        }

        const rectSpan = Math.max(rect.maxX - rect.minX, rect.maxY - rect.minY, 1);
        const farthestCornerDistance = Math.max(
            ...this.selectionRectCorners(rect).map(corner => corner.distanceTo(origin))
        );
        const farPoint = origin.add(direction.mul(farthestCornerDistance + rectSpan * 2 + 1));
        return this.segmentIntersectsSelectionRect(origin, farPoint, rect);
    }

    circleIntersectsSelectionRect(center, radius, rect) {
        if (!center || !Number.isFinite(radius) || radius < 0) {
            return false;
        }

        if (this.pointInSelectionRect(center, rect)) {
            return true;
        }

        const closestX = Math.max(rect.minX, Math.min(center.x, rect.maxX));
        const closestY = Math.max(rect.minY, Math.min(center.y, rect.maxY));
        const closest = new Vec2(closestX, closestY);
        const minDistSq = closest.distanceToSq(center);
        const maxDistSq = Math.max(
            ...this.selectionRectCorners(rect).map(corner => corner.distanceToSq(center))
        );
        const radiusSq = radius * radius;

        return minDistSq <= radiusSq && maxDistSq >= radiusSq;
    }

    functionIntersectsSelectionRect(object, rect) {
        if (typeof object.getFunction !== 'function') {
            return false;
        }

        const fn = object.getFunction();
        if (typeof fn !== 'function') {
            return false;
        }

        let minX = rect.minX;
        let maxX = rect.maxX;
        if (object.xMin !== null && object.xMin !== undefined) {
            minX = Math.max(minX, object.xMin);
        }
        if (object.xMax !== null && object.xMax !== undefined) {
            maxX = Math.min(maxX, object.xMax);
        }
        if (minX > maxX) {
            return false;
        }

        const spanX = Math.max(maxX - minX, 1e-6);
        const spanY = Math.max(rect.maxY - rect.minY, 1e-6);
        const steps = Math.max(32, Math.min(240, Math.ceil(spanX * 48)));
        let previous = null;

        for (let i = 0; i <= steps; i++) {
            const x = minX + spanX * (i / steps);
            let y;
            try {
                y = fn(x);
            } catch {
                previous = null;
                continue;
            }

            if (!Number.isFinite(y)) {
                previous = null;
                continue;
            }

            if (typeof object.isPointWithinVisibleRange === 'function' &&
                !object.isPointWithinVisibleRange(x, y)) {
                previous = null;
                continue;
            }

            const current = new Vec2(x, y);
            if (this.pointInSelectionRect(current, rect)) {
                return true;
            }

            if (previous && Math.abs(current.y - previous.y) <= Math.max(spanY * 6, 10)) {
                if (this.segmentIntersectsSelectionRect(previous, current, rect)) {
                    return true;
                }
            }

            previous = current;
        }

        return false;
    }

    getObjectSelectionPoints(object, app) {
        const points = [];

        if (typeof object.getPosition === 'function') {
            points.push(object.getPosition());
        }

        if (typeof object.getCenter === 'function') {
            const center = object.getCenter();
            if (center) points.push(center);
        }

        if (typeof object.getTangentPoint === 'function') {
            points.push(object.getTangentPoint());
        }

        if (typeof object.getVertices === 'function') {
            for (const vertex of object.getVertices()) {
                if (vertex?.position) {
                    points.push(vertex.position);
                }
            }
        }

        if (Array.isArray(object.vertices)) {
            points.push(...object.vertices);
        }

        if (Array.isArray(object.dependencies)) {
            for (const depId of object.dependencies) {
                const dependency = app.objectManager.getObject(depId);
                if (dependency?.getPosition) {
                    points.push(dependency.getPosition());
                }
            }
        }

        return points.filter(point =>
            point &&
            Number.isFinite(point.x) &&
            Number.isFinite(point.y)
        );
    }

    getObjectSelectionSegments(object) {
        const segments = [];

        if (typeof object.getEdges === 'function') {
            for (const edge of object.getEdges()) {
                if (edge?.p1 && edge?.p2) {
                    segments.push({ p1: edge.p1, p2: edge.p2, mode: 'segment' });
                }
            }
        }

        if (Array.isArray(object.vertices) && object.vertices.length >= 2) {
            for (let i = 0; i < object.vertices.length; i++) {
                segments.push({
                    p1: object.vertices[i],
                    p2: object.vertices[(i + 1) % object.vertices.length],
                    mode: 'segment'
                });
            }
        }

        if (typeof object.getPoint1 === 'function' && typeof object.getPoint2 === 'function') {
            const p1 = object.getPoint1();
            const p2 = object.getPoint2();
            const mode = INFINITE_LINE_TYPES.has(object.type)
                ? 'line'
                : (RAY_TYPES.has(object.type) ? 'ray' : 'segment');
            segments.push({ p1, p2, mode });
        }

        return segments.filter(segment =>
            segment.p1 &&
            segment.p2 &&
            Number.isFinite(segment.p1.x) &&
            Number.isFinite(segment.p1.y) &&
            Number.isFinite(segment.p2.x) &&
            Number.isFinite(segment.p2.y)
        );
    }

    fallbackHitTestIntersectsSelectionRect(object, rect, app) {
        if (typeof object.hitTest !== 'function') {
            return false;
        }

        const samplePoints = [
            new Vec2((rect.minX + rect.maxX) / 2, (rect.minY + rect.maxY) / 2),
            ...this.selectionRectCorners(rect),
            new Vec2((rect.minX + rect.maxX) / 2, rect.minY),
            new Vec2((rect.minX + rect.maxX) / 2, rect.maxY),
            new Vec2(rect.minX, (rect.minY + rect.maxY) / 2),
            new Vec2(rect.maxX, (rect.minY + rect.maxY) / 2)
        ];

        return samplePoints.some(point => object.hitTest(point, 8, app.canvas));
    }

    objectIntersectsSelectionRect(object, rect, app) {
        if (!object?.visible || !object.valid) {
            return false;
        }

        if (this.functionIntersectsSelectionRect(object, rect)) {
            return true;
        }

        if (typeof object.getCenter === 'function' && typeof object.getRadius === 'function') {
            if (this.circleIntersectsSelectionRect(object.getCenter(), object.getRadius(), rect)) {
                return true;
            }
        }

        for (const point of this.getObjectSelectionPoints(object, app)) {
            if (this.pointInSelectionRect(point, rect)) {
                return true;
            }
        }

        for (const segment of this.getObjectSelectionSegments(object)) {
            if (segment.mode === 'line' && this.infiniteLineIntersectsSelectionRect(segment.p1, segment.p2, rect)) {
                return true;
            }
            if (segment.mode === 'ray' && this.rayIntersectsSelectionRect(segment.p1, segment.p2, rect)) {
                return true;
            }
            if (segment.mode === 'segment' && this.segmentIntersectsSelectionRect(segment.p1, segment.p2, rect)) {
                return true;
            }
        }

        return this.fallbackHitTestIntersectsSelectionRect(object, rect, app);
    }

    selectObjectsInBox(app, rect, addToSelection = false) {
        if (!addToSelection) {
            app.objectManager.clearSelection();
        }

        let selectedCount = 0;
        for (const obj of app.objectManager.getAllObjects()) {
            if (this.objectIntersectsSelectionRect(obj, rect, app)) {
                app.objectManager.selectObject(obj, true);
                selectedCount += 1;
            }
        }

        return selectedCount;
    }

    beginPointDrag(targets, mathPos, app) {
        if (!targets || targets.length === 0) {
            return false;
        }

        this.draggedObjects = targets;
        this.isDragging = true;
        this.isMultiDrag = true;
        this.multiDragStart = mathPos.clone();

        this.dragStartPositions = new Map();
        for (const obj of this.draggedObjects) {
            if (obj.getPosition) {
                this.dragStartPositions.set(obj.id, obj.getPosition());
            }
        }

        app.historyManager.startDrag(this.draggedObjects);
        return true;
    }

    beginObjectRotation(object, mathPos, app) {
        const rotationCenter = this.getObjectRotationCenter(object, app);
        const rotationTargets = this.getObjectDragTargets(object, app);

        if (!rotationCenter || rotationTargets.length === 0) {
            return false;
        }

        const startVector = mathPos.sub(rotationCenter);
        if (startVector.lengthSq() < 1e-6) {
            return false;
        }

        this.isRotating = true;
        this.rotationObject = object;
        this.rotationCenter = rotationCenter.clone();
        this.rotationStartAngle = startVector.angle();
        this.draggedObjects = rotationTargets;
        this.dragStartPositions = new Map();

        for (const target of rotationTargets) {
            this.dragStartPositions.set(target.id, target.getPosition());
        }

        app.historyManager.startDrag(rotationTargets);
        app.canvasElement.style.cursor = 'grabbing';
        return true;
    }

    onMouseDown(mathPos, screenPos, event, app) {
        this.clickStartPos = screenPos.clone();
        this.clickStartMathPos = mathPos.clone();
        this.clickStartTime = Date.now(); // 클릭 시작 시간 기록
        this.isShiftDragging = false;
        this.clickedObject = null;
        this.emptySpaceClick = false;

        // Mk.2: 점을 우선 검색 (선/원 위의 점도 클릭 가능하도록)
        // Mk.4: 숨김 객체 보기 모드일 때 숨김 객체도 클릭 가능
        const includeHidden = app.showHiddenObjects || false;
        const clickedPoint = app.objectManager.findPointAt(mathPos, 8, app.canvas, includeHidden);
        const clickedObj = clickedPoint || app.objectManager.findObjectAt(mathPos, 8, app.canvas, null, includeHidden);

        // 숨김 객체를 클릭하면 자동으로 숨김 해제
        if (clickedObj && !clickedObj.visible) {
            clickedObj.visible = true;
            app.showToast(`${clickedObj.label || '객체'} 숨김 해제`, 'info');
            app.updateSidebar();
        }

        if (clickedObj) {
            this.clickedObject = clickedObj;

            // Shift+클릭: 다중 선택 토글
            if (event.shiftKey) {
                if (clickedObj.selected) {
                    app.objectManager.deselectObject(clickedObj);
                } else {
                    app.objectManager.selectObject(clickedObj, true);
                }
            } else {
                // 일반 클릭: 객체 선택 (점 우선)
                if (clickedPoint) {
                    app.objectManager.selectObject(clickedPoint, false);
                } else if (!clickedObj.selected) {
                    app.objectManager.selectObject(clickedObj, false);
                }
            }

            if (this.isRotationGesture(clickedObj, event, app) &&
                this.beginObjectRotation(clickedObj, mathPos, app)) {
                // Ctrl+드래그 회전 시작
            } else {
                // 다중 선택된 상태에서 선택된 객체 중 하나를 클릭하면 모두 이동
                const selectedObjects = app.objectManager.getSelectedObjects();

                if (clickedObj.selected && selectedObjects.length > 1) {
                    const pointsToMove = this.collectSelectionDragTargets(selectedObjects, app);
                    this.beginPointDrag(pointsToMove, mathPos, app);
                } else if (clickedObj.isDraggable && clickedObj.isDraggable()) {
                    // 단일 객체 드래그
                    this.draggedObjects = [clickedObj];
                    this.isDragging = true;
                    this.isMultiDrag = false;

                    if (clickedObj.startDrag) {
                        clickedObj.startDrag(mathPos, app.canvas, app.objectManager);
                    }
                    app.historyManager.startDrag(this.draggedObjects);
                } else {
                    const dragTargets = this.getObjectDragTargets(clickedObj, app);
                    this.beginPointDrag(dragTargets, mathPos, app);
                }
            }
        } else {
            // 빈 공간 클릭
            const selectedObjects = app.objectManager.getSelectedObjects();

            // 이미 선택된 객체가 있고, Shift 키 안 눌렸으면 다중 드래그 시작
            if (selectedObjects.length > 0 && !event.shiftKey) {
                const pointsToMove = this.collectSelectionDragTargets(selectedObjects, app);
                if (this.beginPointDrag(pointsToMove, mathPos, app)) {
                    app.render();
                    return;
                }
            }

            // 선택 해제는 mouseUp에서 짧은 클릭인 경우에만 수행
            // 드래그 박스 선택 준비 (실제 선택은 드래그 후 mouseUp에서)
            this.emptySpaceClick = true;
            this.isBoxSelecting = true;
            this.boxStart = mathPos.clone();
            this.boxEnd = mathPos.clone();
        }

        app.render();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        // Mk.2: 드래그 박스 선택 중
        if (this.isBoxSelecting) {
            this.boxEnd = mathPos.clone();
            app.render();
            return;
        }

        if (this.isRotating && this.draggedObjects.length > 0 && this.rotationCenter && this.dragStartPositions) {
            const currentVector = mathPos.sub(this.rotationCenter);
            if (currentVector.lengthSq() < 1e-6) {
                return;
            }

            let angleDelta = currentVector.angle() - this.rotationStartAngle;
            while (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
            while (angleDelta < -Math.PI) angleDelta += Math.PI * 2;

            for (const obj of this.draggedObjects) {
                const startPos = this.dragStartPositions.get(obj.id);
                if (!startPos || !obj.setPosition) {
                    continue;
                }

                const rotated = startPos.sub(this.rotationCenter).rotate(angleDelta).add(this.rotationCenter);
                obj.setPosition(rotated.x, rotated.y);
            }

            app.objectManager.updateAll();
            app.canvasElement.style.cursor = 'grabbing';
            app.render();
            return;
        }

        if (this.isDragging && this.draggedObjects.length > 0) {
            // 다중 선택 드래그: 모든 점을 동일 벡터로 평행이동
            if (this.isMultiDrag && this.multiDragStart && this.dragStartPositions) {
                const moveVector = mathPos.sub(this.multiDragStart);

                for (const obj of this.draggedObjects) {
                    const startPos = this.dragStartPositions.get(obj.id);
                    if (startPos && obj.setPosition) {
                        obj.setPosition(
                            startPos.x + moveVector.x,
                            startPos.y + moveVector.y
                        );
                    }
                }
            } else {
                // 단일 객체 드래그
                for (const obj of this.draggedObjects) {
                    if (obj.drag) {
                        obj.drag(mathPos, delta, app.canvas, app.objectManager);
                    }
                }
            }

            app.objectManager.updateAll();
            app.render();
        } else {
            // 호버 하이라이트
            const hoveredObj = app.objectManager.findObjectAt(mathPos, 8, app.canvas);
            app.objectManager.highlightObject(hoveredObj);

            // Mk.2: 개선된 커서 처리
            if (hoveredObj) {
                const dragTargets = this.getObjectDragTargets(hoveredObj, app);
                if (this.isRotationGesture(hoveredObj, event, app)) {
                    app.canvasElement.style.cursor = 'crosshair';
                } else if (hoveredObj.isDraggable?.() || dragTargets.length > 0) {
                    app.canvasElement.style.cursor = 'grab';
                } else {
                    app.canvasElement.style.cursor = 'pointer';
                }
            } else {
                app.canvasElement.style.cursor = 'default';
            }

            app.render();
        }
    }

    onMouseUp(mathPos, screenPos, event, app) {
        // 빈 공간 짧은 클릭 감지 (드래그 거리 작고 시간 짧으면)
        if (this.emptySpaceClick && this.clickStartTime && this.clickStartMathPos) {
            const clickDuration = Date.now() - this.clickStartTime;
            const clickDistance = mathPos.sub(this.clickStartMathPos).length();

            // 200ms 이하, 0.3 단위 이하 이동이면 짧은 클릭
            if (clickDuration < 200 && clickDistance < 0.3) {
                // 선택 해제
                if (!event.shiftKey) {
                    app.objectManager.clearSelection();
                }
                // 박스 선택 취소
                this.isBoxSelecting = false;
                this.boxStart = null;
                this.boxEnd = null;
                this.emptySpaceClick = false;
                app.render();
                return;
            }
        }

        // Mk.2: 드래그 박스 선택 완료
        if (this.isBoxSelecting && this.boxStart && this.boxEnd) {
            const rect = this.getSelectionRect(this.boxStart, this.boxEnd);

            // 박스 크기가 충분히 크면 선택 수행
            if (rect.maxX - rect.minX > 0.1 || rect.maxY - rect.minY > 0.1) {
                this.selectObjectsInBox(app, rect, event.shiftKey);
                if (false) {
                // Shift 안 눌렸으면 기존 선택 해제
                if (!event.shiftKey) {
                    app.objectManager.clearSelection();
                }

                const allObjects = app.objectManager.getAllObjects();

                for (const obj of allObjects) {
                    // 숨겨진 객체는 선택 불가
                    if (!obj.visible) continue;

                    let shouldSelect = false;

                    // 점인 경우: getPosition으로 체크
                    if (obj.getPosition) {
                        const pos = obj.getPosition();
                        if (pos.x >= minX && pos.x <= maxX &&
                            pos.y >= minY && pos.y <= maxY) {
                            shouldSelect = true;
                        }
                    }
                    // 선분/직선/반직선/벡터: dependencies를 통해 양 끝점 확인
                    else if (obj.dependencies && obj.dependencies.length >= 2) {
                        const p1 = app.objectManager.getObject(obj.dependencies[0]);
                        const p2 = app.objectManager.getObject(obj.dependencies[1]);

                        if (p1?.getPosition && p2?.getPosition) {
                            const pos1 = p1.getPosition();
                            const pos2 = p2.getPosition();

                            const p1In = pos1.x >= minX && pos1.x <= maxX &&
                                pos1.y >= minY && pos1.y <= maxY;
                            const p2In = pos2.x >= minX && pos2.x <= maxX &&
                                pos2.y >= minY && pos2.y <= maxY;

                            // 둘 중 하나라도 박스 안에 있으면 선택
                            if (p1In || p2In) {
                                shouldSelect = true;
                            }
                        }
                    }
                    // 원인 경우: 중심이 박스 안에 있으면 선택
                    else if (obj.getCenter) {
                        const center = obj.getCenter();
                        if (center && center.x >= minX && center.x <= maxX &&
                            center.y >= minY && center.y <= maxY) {
                            shouldSelect = true;
                        }
                    }

                    if (shouldSelect) {
                        app.objectManager.selectObject(obj, true); // 추가 선택
                    }
                }
            }

                }
            this.isBoxSelecting = false;
            this.boxStart = null;
            this.boxEnd = null;
            this.emptySpaceClick = false;
            app.render();
        }

        if (this.isDragging || this.isRotating) {
            // 드래그 종료
            for (const obj of this.draggedObjects) {
                if (obj.endDrag) {
                    obj.endDrag();
                }
            }

            // 히스토리 종료
            app.historyManager.endDrag(this.draggedObjects);

            this.isDragging = false;
            this.isRotating = false;
            this.isShiftDragging = false;
            this.isMultiDrag = false;
            this.multiDragStart = null;
            this.rotationObject = null;
            this.rotationCenter = null;
            this.rotationStartAngle = null;
            this.dragStartPositions = null;
            this.draggedObjects = [];
            app.canvasElement.style.cursor = 'default';
        }

        this.clickStartPos = null;
        this.clickStartMathPos = null;
        this.clickStartTime = null;
        this.emptySpaceClick = false;
        app.updatePropertyPanel();
    }

    // Mk.2: 드래그 박스 렌더링
    render(canvas, app) {
        if (this.isBoxSelecting && this.boxStart && this.boxEnd) {
            const ctx = canvas.ctx;
            const s1 = canvas.toScreen(this.boxStart);
            const s2 = canvas.toScreen(this.boxEnd);

            const x = Math.min(s1.x, s2.x);
            const y = Math.min(s1.y, s2.y);
            const w = Math.abs(s2.x - s1.x);
            const h = Math.abs(s2.y - s1.y);

            // 반투명 채움
            ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
            ctx.fillRect(x, y, w, h);

            // 테두리
            ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(x, y, w, h);
            ctx.setLineDash([]);
        }
    }

    cancel(app) {
        super.cancel(app);
        this.isDragging = false;
        this.isRotating = false;
        this.isBoxSelecting = false;
        this.isShiftDragging = false;
        this.draggedObjects = [];
        this.boxStart = null;
        this.boxEnd = null;
        this.rotationObject = null;
        this.rotationCenter = null;
        this.rotationStartAngle = null;
        app.objectManager.clearSelection();
        app.render();
    }
}

export default SelectTool;
