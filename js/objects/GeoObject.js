/**
 * GeoObject.js - 기하 객체 기본 클래스
 * 모든 기하 객체의 공통 인터페이스 정의
 */

import { Vec2 } from '../utils/Geometry.js';

// 유니크 ID 생성
let idCounter = 0;
function generateId() {
    return `obj_${Date.now()}_${++idCounter}`;
}

// 객체 타입 상수
export const ObjectType = {
    POINT: 'point',
    POINT_ON_OBJECT: 'pointOnObject',
    INTERSECTION: 'intersection',
    MIDPOINT: 'midpoint',

    SEGMENT: 'segment',
    LINE: 'line',
    RAY: 'ray',

    CIRCLE: 'circle',
    CIRCLE_THREE_POINTS: 'circleThreePoints',

    // Mk.2: 곡선/영역 도형
    ARC: 'arc',
    SECTOR: 'sector',
    CIRCULAR_SEGMENT: 'circularSegment',

    PARALLEL: 'parallel',
    PERPENDICULAR: 'perpendicular',
    PERPENDICULAR_BISECTOR: 'perpendicularBisector',
    ANGLE_BISECTOR: 'angleBisector',

    TANGENT_CIRCLE: 'tangentCircle',
    TANGENT_FUNCTION: 'tangentFunction',

    FUNCTION: 'function',

    VECTOR: 'vector',

    RIGHT_ANGLE_MARKER: 'rightAngleMarker',
    EQUAL_LENGTH_MARKER: 'equalLengthMarker',

    PRISM: 'prism',
    PYRAMID: 'pyramid',

    // Mk.4: 수직선
    NUMBER_LINE: 'numberLine'
};

// 라벨 생성기
const labelGenerators = {
    point: (() => {
        let i = 0;
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        return () => {
            if (i < 26) return letters[i++];
            return letters[Math.floor((i - 26) / 26)] + letters[(i++) % 26];
        };
    })(),

    line: (() => {
        let i = 0;
        const letters = 'abcdefghijklmnopqrstuvwxyz';
        return () => {
            if (i < 26) return letters[i++];
            return letters[Math.floor((i - 26) / 26)] + letters[(i++) % 26];
        };
    })(),

    circle: (() => {
        let i = 0;
        return () => `c${++i}`;
    })(),

    function: (() => {
        let i = 0;
        const letters = 'fghijklmnopqrstuvwxyz';
        return () => {
            if (i < letters.length) return letters[i++];
            // 26개 초과 시 f1, g1, ... 형태
            const base = Math.floor((i - letters.length) / letters.length);
            const idx = (i++ - letters.length) % letters.length;
            return letters[idx] + (base + 1);
        };
    })()
};

export function generateLabel(type) {
    if (type === ObjectType.POINT ||
        type === ObjectType.POINT_ON_OBJECT ||
        type === ObjectType.INTERSECTION ||
        type === ObjectType.MIDPOINT) {
        return labelGenerators.point();
    }
    if (type === ObjectType.SEGMENT ||
        type === ObjectType.LINE ||
        type === ObjectType.RAY ||
        type === ObjectType.PARALLEL ||
        type === ObjectType.PERPENDICULAR ||
        type === ObjectType.PERPENDICULAR_BISECTOR ||
        type === ObjectType.ANGLE_BISECTOR ||
        type === ObjectType.TANGENT_CIRCLE ||
        type === ObjectType.TANGENT_FUNCTION) {
        return labelGenerators.line();
    }
    if (type === ObjectType.CIRCLE || type === ObjectType.CIRCLE_THREE_POINTS ||
        type === ObjectType.ARC || type === ObjectType.SECTOR ||
        type === ObjectType.CIRCULAR_SEGMENT) {
        return labelGenerators.circle();
    }
    if (type === ObjectType.FUNCTION) {
        return labelGenerators.function();
    }
    return '';
}

/**
 * 기하 객체 기본 클래스
 */
export class GeoObject {
    constructor(type, params = {}) {
        this.id = generateId();
        this.type = type;

        // 라벨 설정
        this.label = params.label || generateLabel(type);

        // Mk.2: 선 객체는 기본적으로 라벨 숨김
        const isLineType = [
            ObjectType.SEGMENT, ObjectType.LINE, ObjectType.RAY,
            ObjectType.PARALLEL, ObjectType.PERPENDICULAR,
            ObjectType.PERPENDICULAR_BISECTOR, ObjectType.ANGLE_BISECTOR
        ].includes(type);
        this.showLabel = params.showLabel !== undefined ? params.showLabel : !isLineType;

        // 스타일 (기본: 검정색, 굵기 3, 폰트 30)
        this.color = params.color || '#000000';
        this.lineWidth = params.lineWidth || 3;
        this.pointSize = params.pointSize || 6;
        this.fontSize = params.fontSize || 30;
        this.dashed = params.dashed || false;

        // 라벨 오프셋 (드래그로 위치 조정 가능)
        this.labelOffset = params.labelOffset ?
            new Vec2(params.labelOffset.x, params.labelOffset.y) :
            new Vec2(10, -10); // 기본: 오른쪽 위

        // 가시성 및 잠금
        this.visible = params.visible !== undefined ? params.visible : true;
        this.locked = params.locked || false;

        // 의존성
        this.dependencies = []; // 이 객체가 의존하는 객체들의 ID
        this.dependents = [];   // 이 객체에 의존하는 객체들의 ID

        // 상태
        this.selected = false;
        this.highlighted = false;
        this.valid = true; // 계산 가능 여부

        // 생성 시간
        this.createdAt = Date.now();
    }

    /**
     * 기본 색상 (타입별)
     */
    getDefaultColor() {
        const colorMap = {
            [ObjectType.POINT]: '#6366f1',
            [ObjectType.POINT_ON_OBJECT]: '#6366f1',
            [ObjectType.INTERSECTION]: '#6366f1',
            [ObjectType.MIDPOINT]: '#6366f1',
            [ObjectType.SEGMENT]: '#3b82f6',
            [ObjectType.LINE]: '#3b82f6',
            [ObjectType.RAY]: '#3b82f6',
            [ObjectType.CIRCLE]: '#22c55e',
            [ObjectType.CIRCLE_THREE_POINTS]: '#22c55e',
            [ObjectType.PARALLEL]: '#3b82f6',
            [ObjectType.PERPENDICULAR]: '#3b82f6',
            [ObjectType.PERPENDICULAR_BISECTOR]: '#3b82f6',
            [ObjectType.ANGLE_BISECTOR]: '#3b82f6',
            [ObjectType.TANGENT_CIRCLE]: '#3b82f6',
            [ObjectType.TANGENT_FUNCTION]: '#3b82f6',
            [ObjectType.FUNCTION]: '#f97316',
            [ObjectType.VECTOR]: '#ec4899',
            [ObjectType.RIGHT_ANGLE_MARKER]: '#8b5cf6',
            [ObjectType.EQUAL_LENGTH_MARKER]: '#8b5cf6'
        };
        return colorMap[this.type] || '#3b82f6';
    }

    /**
     * 위치 업데이트 (자식 클래스에서 구현)
     */
    update(objectManager) {
        // 오버라이드 필요
    }

    /**
     * 렌더링 (자식 클래스에서 구현)
     */
    render(canvas) {
        // 오버라이드 필요
    }

    /**
     * 점 히트 테스트 (자식 클래스에서 구현)
     * @param {Vec2} point - 수학 좌표
     * @param {number} threshold - 픽셀 단위 거리 임계값
     * @param {Canvas} canvas - 캔버스 (좌표 변환용)
     * @returns {boolean}
     */
    hitTest(point, threshold, canvas) {
        return false;
    }

    /**
     * 드래그 가능 여부
     */
    isDraggable() {
        return !this.locked && this.visible;
    }

    /**
     * 드래그 시작 (자식 클래스에서 구현)
     */
    startDrag(point, canvas) {
        // 오버라이드 필요
    }

    /**
     * 드래그 중 (자식 클래스에서 구현)
     */
    drag(point, delta, canvas) {
        // 오버라이드 필요
    }

    /**
     * 드래그 종료 (자식 클래스에서 구현)
     */
    endDrag() {
        // 오버라이드 필요
    }

    /**
     * 의존성 추가
     */
    addDependency(objectId) {
        if (!this.dependencies.includes(objectId)) {
            this.dependencies.push(objectId);
        }
    }

    /**
     * 의존 객체 추가
     */
    addDependent(objectId) {
        if (!this.dependents.includes(objectId)) {
            this.dependents.push(objectId);
        }
    }

    /**
     * 의존 객체 제거
     */
    removeDependent(objectId) {
        const idx = this.dependents.indexOf(objectId);
        if (idx !== -1) {
            this.dependents.splice(idx, 1);
        }
    }

    /**
     * JSON 직렬화
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            label: this.label,
            showLabel: this.showLabel,
            color: this.color,
            lineWidth: this.lineWidth,
            pointSize: this.pointSize,
            fontSize: this.fontSize,
            dashed: this.dashed,
            visible: this.visible,
            locked: this.locked,
            dependencies: [...this.dependencies],
            createdAt: this.createdAt
        };
    }

    /**
     * 타입별 아이콘 클래스
     */
    getIconClass() {
        const iconMap = {
            [ObjectType.POINT]: 'point',
            [ObjectType.POINT_ON_OBJECT]: 'point',
            [ObjectType.INTERSECTION]: 'point',
            [ObjectType.MIDPOINT]: 'point',
            [ObjectType.SEGMENT]: 'line',
            [ObjectType.LINE]: 'line',
            [ObjectType.RAY]: 'line',
            [ObjectType.CIRCLE]: 'circle',
            [ObjectType.CIRCLE_THREE_POINTS]: 'circle',
            [ObjectType.FUNCTION]: 'function',
            [ObjectType.VECTOR]: 'vector',
            [ObjectType.RIGHT_ANGLE_MARKER]: 'marker',
            [ObjectType.EQUAL_LENGTH_MARKER]: 'marker'
        };
        return iconMap[this.type] || 'line';
    }

    /**
     * 타입별 표시 이름
     */
    getTypeName() {
        const nameMap = {
            [ObjectType.POINT]: '점',
            [ObjectType.POINT_ON_OBJECT]: '선 위의 점',
            [ObjectType.INTERSECTION]: '교점',
            [ObjectType.MIDPOINT]: '중점',
            [ObjectType.SEGMENT]: '선분',
            [ObjectType.LINE]: '직선',
            [ObjectType.RAY]: '반직선',
            [ObjectType.CIRCLE]: '원',
            [ObjectType.CIRCLE_THREE_POINTS]: '세점원',
            [ObjectType.PARALLEL]: '평행선',
            [ObjectType.PERPENDICULAR]: '수선',
            [ObjectType.PERPENDICULAR_BISECTOR]: '수직이등분선',
            [ObjectType.ANGLE_BISECTOR]: '각의 이등분선',
            [ObjectType.TANGENT_CIRCLE]: '원의 접선',
            [ObjectType.TANGENT_FUNCTION]: '함수의 접선',
            [ObjectType.FUNCTION]: '함수',
            [ObjectType.VECTOR]: '벡터',
            [ObjectType.RIGHT_ANGLE_MARKER]: '직각 표시',
            [ObjectType.EQUAL_LENGTH_MARKER]: '같은 길이 표시',
            [ObjectType.PRISM]: '각기둥',
            [ObjectType.PYRAMID]: '각뿔',
            [ObjectType.NUMBER_LINE]: '수직선'
        };
        return nameMap[this.type] || '객체';
    }
}

export default GeoObject;
