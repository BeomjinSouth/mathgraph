/**
 * ObjectManager.js - 객체 관리 클래스
 * 객체 생성, 삭제, 의존성 관리, 업데이트
 */

import { ObjectType } from '../objects/GeoObject.js';
import { Vec2 } from '../utils/Geometry.js';
import { FreePoint, PointOnLine, PointOnCircle, IntersectionPoint, Midpoint, CircleCenterPoint } from '../objects/Point.js';
import { Segment, Line, Ray, ParallelLine, PerpendicularLine, PerpendicularBisector, AngleBisector } from '../objects/Line.js';
import { Circle, CircleThreePoints, TangentCircle } from '../objects/Circle.js';
import { FunctionGraph, TangentFunction } from '../objects/Function.js';
import { Vector } from '../objects/Vector.js';
import { RightAngleMarker, EqualLengthMarker } from '../objects/Marker.js';
import { Arc, Sector, CircularSegment } from '../objects/Arc.js'; // Mk.2
import { AngleDimension, LengthDimension } from '../objects/Dimension.js'; // Mk.2
import { Prism, Pyramid } from '../objects/Solid3D.js'; // Mk.3
import { NumberLine } from '../objects/NumberLine.js'; // Mk.4

export class ObjectManager {
    constructor() {
        this.objects = new Map(); // id -> object
        this.objectOrder = []; // 생성 순서대로 ID 저장

        this.selectedObjects = new Set();
        this.highlightedObject = null;

        // 이벤트 리스너
        this.listeners = {
            objectAdded: [],
            objectRemoved: [],
            objectUpdated: [],
            selectionChanged: []
        };
    }

    /**
     * 이벤트 리스너 등록
     */
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    /**
     * 이벤트 발생
     */
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }

    /**
     * 객체 추가
     */
    addObject(object) {
        this.objects.set(object.id, object);
        this.objectOrder.push(object.id);

        // 의존성 등록
        for (const depId of object.dependencies) {
            const dep = this.objects.get(depId);
            if (dep) {
                dep.addDependent(object.id);
            }
        }

        // 초기 업데이트
        object.update(this);

        this.emit('objectAdded', object);
        return object;
    }

    /**
     * 객체 조회
     */
    getObject(id) {
        return this.objects.get(id);
    }

    /**
     * 모든 객체 반환 (생성 순서)
     */
    getAllObjects() {
        return this.objectOrder.map(id => this.objects.get(id)).filter(Boolean);
    }

    /**
     * 타입별 객체 필터
     */
    getObjectsByType(type) {
        return this.getAllObjects().filter(obj => obj.type === type);
    }

    /**
     * 객체 삭제
     */
    removeObject(id, cascade = true) {
        const object = this.objects.get(id);
        if (!object) return [];

        const removedIds = [id];

        // 연쇄 삭제
        if (cascade) {
            const dependents = [...object.dependents];
            for (const depId of dependents) {
                removedIds.push(...this.removeObject(depId, true));
            }
        }

        // 의존 관계 정리
        for (const depId of object.dependencies) {
            const dep = this.objects.get(depId);
            if (dep) {
                dep.removeDependent(id);
            }
        }

        // 선택 해제
        this.selectedObjects.delete(id);
        if (this.highlightedObject === object) {
            this.highlightedObject = null;
        }

        // 맵에서 제거
        this.objects.delete(id);
        const idx = this.objectOrder.indexOf(id);
        if (idx !== -1) {
            this.objectOrder.splice(idx, 1);
        }

        this.emit('objectRemoved', { id, object });

        return removedIds;
    }

    /**
     * 삭제 시 함께 삭제될 객체 목록 조회
     */
    getDependents(id) {
        const object = this.objects.get(id);
        if (!object) return [];

        const result = [];
        const visited = new Set();

        const collect = (objId) => {
            if (visited.has(objId)) return;
            visited.add(objId);

            const obj = this.objects.get(objId);
            if (!obj) return;

            for (const depId of obj.dependents) {
                result.push(this.objects.get(depId));
                collect(depId);
            }
        };

        collect(id);
        return result.filter(Boolean);
    }

    /**
     * 모든 객체 업데이트
     */
    updateAll() {
        // 위상 정렬 순서로 업데이트 (의존성 순서)
        const sorted = this.topologicalSort();

        for (const id of sorted) {
            const obj = this.objects.get(id);
            if (obj) {
                obj.update(this);
            }
        }

        this.emit('objectUpdated', null);
    }

    /**
     * 특정 객체와 그 의존 객체들 업데이트
     */
    updateObject(id) {
        const object = this.objects.get(id);
        if (!object) return;

        object.update(this);

        // 의존 객체들도 업데이트
        const toUpdate = [...object.dependents];
        const visited = new Set([id]);

        while (toUpdate.length > 0) {
            const depId = toUpdate.shift();
            if (visited.has(depId)) continue;
            visited.add(depId);

            const dep = this.objects.get(depId);
            if (dep) {
                dep.update(this);
                toUpdate.push(...dep.dependents);
            }
        }

        this.emit('objectUpdated', object);
    }

    /**
     * 위상 정렬 (의존성 순서)
     */
    topologicalSort() {
        const result = [];
        const visited = new Set();
        const temp = new Set();

        const visit = (id) => {
            if (visited.has(id)) return;
            if (temp.has(id)) return; // 순환 의존성 방지

            temp.add(id);

            const obj = this.objects.get(id);
            if (obj) {
                for (const depId of obj.dependencies) {
                    visit(depId);
                }
            }

            temp.delete(id);
            visited.add(id);
            result.push(id);
        };

        for (const id of this.objectOrder) {
            visit(id);
        }

        return result;
    }

    /**
     * 객체 선택
     */
    selectObject(object, addToSelection = false) {
        if (!addToSelection) {
            this.clearSelection();
        }

        if (object) {
            object.selected = true;
            this.selectedObjects.add(object.id);
        }

        this.emit('selectionChanged', this.getSelectedObjects());
    }

    /**
     * 선택 해제
     */
    deselectObject(object) {
        if (object) {
            object.selected = false;
            this.selectedObjects.delete(object.id);
        }

        this.emit('selectionChanged', this.getSelectedObjects());
    }

    /**
     * 전체 선택 해제
     */
    clearSelection() {
        for (const id of this.selectedObjects) {
            const obj = this.objects.get(id);
            if (obj) {
                obj.selected = false;
            }
        }
        this.selectedObjects.clear();

        this.emit('selectionChanged', []);
    }

    /**
     * 선택된 객체 목록
     */
    getSelectedObjects() {
        return Array.from(this.selectedObjects)
            .map(id => this.objects.get(id))
            .filter(Boolean);
    }

    /**
     * 객체 하이라이트
     */
    highlightObject(object) {
        if (this.highlightedObject && this.highlightedObject !== object) {
            this.highlightedObject.highlighted = false;
        }

        if (object) {
            object.highlighted = true;
        }

        this.highlightedObject = object;
    }

    /**
     * 하이라이트 해제
     */
    clearHighlight() {
        if (this.highlightedObject) {
            this.highlightedObject.highlighted = false;
            this.highlightedObject = null;
        }
    }

    /**
     * 점 좌표에서 가장 가까운 객체 찾기
     * @param {Vec2} point - 클릭 위치
     * @param {number} threshold - 클릭 허용 범위
     * @param {Canvas} canvas - 캔버스 객체
     * @param {Function} filter - 필터 함수 (선택)
     * @param {boolean} includeHidden - 숨김 객체 포함 여부 (기본 false)
     */
    findObjectAt(point, threshold, canvas, filter = null, includeHidden = false) {
        // 역순으로 검색 (나중에 생성된 것이 위에 있음)
        const objects = [...this.getAllObjects()].reverse();

        for (const obj of objects) {
            // 숨김 객체는 includeHidden이 true일 때만 클릭 가능
            if (!obj.visible && !includeHidden) continue;
            if (!obj.valid) continue;
            if (filter && !filter(obj)) continue;

            if (obj.hitTest(point, threshold, canvas)) {
                return obj;
            }
        }

        return null;
    }

    /**
     * 점만 찾기
     */
    findPointAt(point, threshold, canvas, includeHidden = false) {
        return this.findObjectAt(point, threshold, canvas, obj =>
            [ObjectType.POINT, ObjectType.POINT_ON_OBJECT,
            ObjectType.INTERSECTION, ObjectType.MIDPOINT].includes(obj.type),
            includeHidden
        );
    }

    /**
     * 선 종류만 찾기
     */
    findLineAt(point, threshold, canvas) {
        return this.findObjectAt(point, threshold, canvas, obj =>
            [ObjectType.SEGMENT, ObjectType.LINE, ObjectType.RAY,
            ObjectType.PARALLEL, ObjectType.PERPENDICULAR,
            ObjectType.PERPENDICULAR_BISECTOR, ObjectType.ANGLE_BISECTOR,
            ObjectType.TANGENT_CIRCLE, ObjectType.TANGENT_FUNCTION].includes(obj.type)
        );
    }

    /**
     * 원 종류만 찾기
     */
    findCircleAt(point, threshold, canvas) {
        return this.findObjectAt(point, threshold, canvas, obj =>
            [ObjectType.CIRCLE, ObjectType.CIRCLE_THREE_POINTS].includes(obj.type)
        );
    }

    /**
     * 전체 지우기
     */
    clear() {
        this.objects.clear();
        this.objectOrder = [];
        this.selectedObjects.clear();
        this.highlightedObject = null;

        this.emit('objectRemoved', { id: null, object: null });
    }

    /**
     * JSON으로 직렬화
     */
    toJSON() {
        return {
            objects: this.objectOrder.map(id => {
                const obj = this.objects.get(id);
                return obj ? obj.toJSON() : null;
            }).filter(Boolean)
        };
    }

    /**
     * JSON에서 복원
     */
    fromJSON(data) {
        this.clear();

        for (const objData of data.objects) {
            const obj = this.createFromJSON(objData);
            if (obj) {
                this.objects.set(obj.id, obj);
                this.objectOrder.push(obj.id);
            }
        }

        // 의존성 재구축
        for (const obj of this.objects.values()) {
            for (const depId of obj.dependencies) {
                const dep = this.objects.get(depId);
                if (dep) {
                    dep.addDependent(obj.id);
                }
            }
        }

        // 전체 업데이트
        this.updateAll();
    }

    /**
     * JSON 데이터에서 객체 생성
     */
    createFromJSON(data) {
        let obj = null;

        switch (data.type) {
            // 점 타입들
            case ObjectType.POINT:
            case 'point':
                obj = new FreePoint(data.x, data.y, data);
                break;

            case ObjectType.POINT_ON_OBJECT:
            case 'pointOnObject':
                if (data.lineId) {
                    obj = new PointOnLine(data.lineId, data.t || 0.5, data);
                } else if (data.circleId) {
                    obj = new PointOnCircle(data.circleId, data.angle || 0, data);
                }
                break;

            case ObjectType.INTERSECTION:
            case 'intersection':
                const anchor = (data.anchorX !== undefined && data.anchorY !== undefined)
                    ? new Vec2(data.anchorX, data.anchorY) : null;
                obj = new IntersectionPoint(data.object1Id, data.object2Id, anchor, data);
                break;

            case ObjectType.MIDPOINT:
            case 'midpoint':
                obj = new Midpoint(data.segmentId, data);
                break;

            // 선 타입들
            case ObjectType.SEGMENT:
            case 'segment':
                obj = new Segment(data.point1Id, data.point2Id, data);
                break;

            case ObjectType.LINE:
            case 'line':
                obj = new Line(data.point1Id, data.point2Id, data);
                break;

            case ObjectType.RAY:
            case 'ray':
                obj = new Ray(data.originId, data.directionPointId, data);
                break;

            case ObjectType.PARALLEL:
            case 'parallel':
                obj = new ParallelLine(data.baseLineId, data.throughPointId, data);
                break;

            case ObjectType.PERPENDICULAR:
            case 'perpendicular':
                obj = new PerpendicularLine(data.throughPointId, data.baseLineId, data);
                break;

            case ObjectType.PERPENDICULAR_BISECTOR:
            case 'perpendicularBisector':
                obj = new PerpendicularBisector(data.segmentId, data);
                break;

            case ObjectType.ANGLE_BISECTOR:
            case 'angleBisector':
                obj = new AngleBisector(data.line1Id, data.line2Id, data);
                break;

            // 원 타입들
            case ObjectType.CIRCLE:
            case 'circle':
                obj = new Circle(data.centerId, data.pointOnCircleId, data);
                break;

            case ObjectType.CIRCLE_THREE_POINTS:
            case 'circleThreePoints':
                obj = new CircleThreePoints(data.point1Id, data.point2Id, data.point3Id, data);
                break;

            case ObjectType.TANGENT_CIRCLE:
            case 'tangentCircle':
                obj = new TangentCircle(data.circleId, data.tangentPointId, data);
                break;

            // 호/부채꼴/활꼴
            case ObjectType.ARC:
            case 'arc':
                obj = new Arc(data.circleId, data.startPointId, data.endPointId, data.mode || 'minor', data);
                break;

            case ObjectType.SECTOR:
            case 'sector':
                obj = new Sector(data.circleId, data.startPointId, data.endPointId, data.mode || 'minor', data);
                break;

            case ObjectType.CIRCULAR_SEGMENT:
            case 'circularSegment':
                obj = new CircularSegment(data.circleId, data.startPointId, data.endPointId, data.mode || 'minor', data);
                break;

            // 함수
            case ObjectType.FUNCTION:
            case 'function':
                obj = new FunctionGraph(data.expression, data);
                break;

            case ObjectType.TANGENT_FUNCTION:
            case 'tangentFunction':
                obj = new TangentFunction(data.functionId, data.x || 0, data);
                break;

            // 벡터
            case ObjectType.VECTOR:
            case 'vector':
                obj = new Vector(data.startPointId, data.endPointId, data);
                break;

            // 마커
            case ObjectType.RIGHT_ANGLE_MARKER:
            case 'rightAngleMarker':
                obj = new RightAngleMarker(data.vertexId, data.line1Id, data.line2Id, data);
                break;

            case ObjectType.EQUAL_LENGTH_MARKER:
            case 'equalLengthMarker':
                obj = new EqualLengthMarker(data.segment1Id, data.segment2Id, data);
                break;

            // 치수
            case 'angleDimension':
                obj = new AngleDimension(data.vertexId, data.point1Id, data.point2Id, data);
                break;

            case 'lengthDimension':
                obj = new LengthDimension(data.segmentId, data);
                break;

            // 3D 입체도형
            case ObjectType.PRISM:
            case 'prism':
                obj = new Prism(data.baseVertexIds, data.topVertexIds, data);
                break;

            case ObjectType.PYRAMID:
            case 'pyramid':
                obj = new Pyramid(data.baseVertexIds, data.apexId, data);
                break;

            case ObjectType.NUMBER_LINE:
            case 'numberLine':
                obj = new NumberLine(data);
                break;

            default:
                console.warn(`알 수 없는 객체 타입: ${data.type}`);
                return null;
        }

        // 공통 속성 복원
        if (obj) {
            obj.id = data.id;
            obj.dependencies = data.dependencies || [];
            if (data.labelOffset) {
                obj.labelOffset = new Vec2(data.labelOffset.x, data.labelOffset.y);
            }
        }

        return obj;
    }

    /**
     * 객체 생성 헬퍼들
     */
    createPoint(x, y, params = {}) {
        return this.addObject(new FreePoint(x, y, params));
    }

    createSegment(point1Id, point2Id, params = {}) {
        return this.addObject(new Segment(point1Id, point2Id, params));
    }

    createLine(point1Id, point2Id, params = {}) {
        return this.addObject(new Line(point1Id, point2Id, params));
    }

    createRay(originId, directionPointId, params = {}) {
        return this.addObject(new Ray(originId, directionPointId, params));
    }

    createCircle(centerId, pointOnCircleId, params = {}) {
        return this.addObject(new Circle(centerId, pointOnCircleId, params));
    }

    createCircleThreePoints(point1Id, point2Id, point3Id, params = {}) {
        return this.addObject(new CircleThreePoints(point1Id, point2Id, point3Id, params));
    }

    createIntersection(object1Id, object2Id, anchor = null, params = {}) {
        return this.addObject(new IntersectionPoint(object1Id, object2Id, anchor, params));
    }

    createMidpoint(segmentId, params = {}) {
        return this.addObject(new Midpoint(segmentId, params));
    }

    createPointOnLine(lineId, t = 0.5, params = {}) {
        return this.addObject(new PointOnLine(lineId, t, params));
    }

    createPointOnCircle(circleId, angle = 0, params = {}) {
        return this.addObject(new PointOnCircle(circleId, angle, params));
    }

    createParallelLine(baseLineId, throughPointId, params = {}) {
        return this.addObject(new ParallelLine(baseLineId, throughPointId, params));
    }

    createPerpendicularLine(throughPointId, baseLineId, params = {}) {
        return this.addObject(new PerpendicularLine(throughPointId, baseLineId, params));
    }

    createPerpendicularBisector(segmentId, params = {}) {
        return this.addObject(new PerpendicularBisector(segmentId, params));
    }

    createAngleBisector(line1Id, line2Id, params = {}) {
        return this.addObject(new AngleBisector(line1Id, line2Id, params));
    }

    createTangentCircle(circleId, tangentPointId, params = {}) {
        return this.addObject(new TangentCircle(circleId, tangentPointId, params));
    }

    createFunction(expression, params = {}) {
        return this.addObject(new FunctionGraph(expression, params));
    }

    createTangentFunction(functionId, x, params = {}) {
        return this.addObject(new TangentFunction(functionId, x, params));
    }

    createVector(startPointId, endPointId, params = {}) {
        return this.addObject(new Vector(startPointId, endPointId, params));
    }

    createRightAngleMarker(vertexId, line1Id, line2Id, params = {}) {
        return this.addObject(new RightAngleMarker(vertexId, line1Id, line2Id, params));
    }

    createEqualLengthMarker(segment1Id, segment2Id, params = {}) {
        return this.addObject(new EqualLengthMarker(segment1Id, segment2Id, params));
    }

    // Mk.2: 호/부채꼴/활꼴 생성
    createArc(circleId, startPointId, endPointId, mode = 'minor', params = {}) {
        return this.addObject(new Arc(circleId, startPointId, endPointId, mode, params));
    }

    createSector(circleId, startPointId, endPointId, mode = 'minor', params = {}) {
        return this.addObject(new Sector(circleId, startPointId, endPointId, mode, params));
    }

    createCircularSegment(circleId, startPointId, endPointId, mode = 'minor', params = {}) {
        return this.addObject(new CircularSegment(circleId, startPointId, endPointId, mode, params));
    }

    // Mk.2: 치수 생성
    createAngleDimension(vertexId, point1Id, point2Id, params = {}) {
        return this.addObject(new AngleDimension(vertexId, point1Id, point2Id, params));
    }

    createLengthDimension(segmentId, params = {}) {
        return this.addObject(new LengthDimension(segmentId, params));
    }

    // Mk.3: 3D 입체도형 생성
    createPrism(baseVertexIds, topVertexIds, params = {}) {
        return this.addObject(new Prism(baseVertexIds, topVertexIds, params));
    }

    createPyramid(baseVertexIds, apexId, params = {}) {
        return this.addObject(new Pyramid(baseVertexIds, apexId, params));
    }

    // Mk.4: 원의 중심점 생성
    createCircleCenterPoint(circleId, params = {}) {
        return this.addObject(new CircleCenterPoint(circleId, params));
    }

    // Mk.4: 수직선 생성
    createNumberLine(params = {}) {
        return this.addObject(new NumberLine(params));
    }
}

export default ObjectManager;
