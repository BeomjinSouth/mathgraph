/**
 * Dimension.js - 치수 객체 (Mk.2)
 * 각도 치수, 길이 치수
 */

import { GeoObject, ObjectType } from './GeoObject.js';
import { Vec2 } from '../utils/Geometry.js';
import { DEFAULT_LENGTH_ARC_HEIGHT, lengthArcGeometry, chooseLengthArcHeight, lengthArcPieces } from '../utils/LengthArc.js';
import { MathUtils } from '../utils/MathUtils.js';
import { segmentDistance, curveDistance, quadraticAt, leaderGeometry, drawLeader } from '../utils/AnnotationGeometry.js';

// ObjectType 확장 (동적으로 추가)
if (!ObjectType.ANGLE_DIMENSION) {
    ObjectType.ANGLE_DIMENSION = 'angleDimension';
}
if (!ObjectType.LENGTH_DIMENSION) {
    ObjectType.LENGTH_DIMENSION = 'lengthDimension';
}

/**
 * 각도 치수 - 세 점 또는 두 선으로 구성된 각도 표시
 */
export class AngleDimension extends GeoObject {
    constructor(vertexId, point1Id, point2Id, params = {}) {
        super(ObjectType.ANGLE_DIMENSION, params);
        this.vertexId = vertexId;     // 꼭짓점
        this.point1Id = point1Id;     // 첫 번째 점 (시작각 방향)
        this.point2Id = point2Id;     // 두 번째 점 (끝각 방향)

        this.addDependency(vertexId);
        this.addDependency(point1Id);
        this.addDependency(point2Id);

        // 스타일
        this.arcRadius = params.arcRadius || 0.5; // 호 반지름 (수학 단위)
        this.showValue = params.showValue !== false; // 값 표시 여부
        this.markerCount = params.markerCount || 0; // 동일 각도 표시 선 수 (0, 1, 2, 3)
        this.arcCount = Math.max(1, Math.min(3, Math.round(Number(params.arcCount) || 1)));

        // Mk.2: 라벨 드래그 오프셋 및 사용자 정의 텍스트
        // 불러오기에서 평범한 {x,y}로 들어오므로 Vec2로 감싸 clone() 등을 보존한다.
        this.labelOffset = params.labelOffset
            ? new Vec2(params.labelOffset.x, params.labelOffset.y)
            : new Vec2(0, 0);
        this.customText = params.customText || null; // null이면 자동 계산값 표시

        // Mk2.1: 표시 설정
        // - precision: 자동 계산값(각도)의 소수점 자리수
        // - labelFontSize: 라벨 폰트 크기 (캔버스에 그려지는 숫자 크기)
        this.precision = (params.precision !== undefined) ? params.precision : 1;
        this.labelFontSize = params.labelFontSize || (params.type ? 14 : 20);
        // Old project files keep their exact label anchor; new annotations are centered.
        this.labelPlacement = params.labelPlacement || (params.type ? 'legacy' : 'centered');
        this.leaderMode = ['auto','always','none'].includes(params.leaderMode) ? params.leaderMode : 'auto';
        this.leaderCurvature = Number.isFinite(params.leaderCurvature) ? MathUtils.clamp(params.leaderCurvature, -300, 300) : 28;

        // 계산된 값
        this.vertex = null;
        this.angle = 0; // 라디안
        this.startAngle = 0;
        this.endAngle = 0;
    }

    update(objectManager) {
        const vertex = objectManager.getObject(this.vertexId);
        const point1 = objectManager.getObject(this.point1Id);
        const point2 = objectManager.getObject(this.point2Id);

        if (!vertex || !point1 || !point2 ||
            !vertex.valid || !point1.valid || !point2.valid) {
            this.valid = false;
            return;
        }

        this.vertex = vertex.getPosition();
        const pos1 = point1.getPosition();
        const pos2 = point2.getPosition();

        this.startAngle = Math.atan2(pos1.y - this.vertex.y, pos1.x - this.vertex.x);
        this.endAngle = Math.atan2(pos2.y - this.vertex.y, pos2.x - this.vertex.x);

        // 각도 계산 (0 ~ 180도로 제한)
        let diff = this.endAngle - this.startAngle;
        while (diff < 0) diff += Math.PI * 2;
        while (diff > Math.PI * 2) diff -= Math.PI * 2;

        // 작은 각도 선택
        if (diff > Math.PI) {
            diff = Math.PI * 2 - diff;
            // 방향 반전
            const temp = this.startAngle;
            this.startAngle = this.endAngle;
            this.endAngle = temp;
        }

        // Keep both directions in the same turn. Averaging +170° and -170°
        // otherwise places the label/tick at 0°, opposite the rendered arc.
        this.endAngle = this.startAngle + diff;

        this.angle = diff;
        this.valid = pos1.distanceTo(this.vertex) > 1e-9 && pos2.distanceTo(this.vertex) > 1e-9;
    }

    render(canvas) {
        this._labelBox = null;
        this._leaderCurve = null;
        if (!this.visible || !this.valid || !this.vertex) return;

        const ctx = canvas.ctx;
        const screenVertex = canvas.toScreen(this.vertex);
        const screenRadius = canvas.toScreenLength(this.arcRadius);

        // 선택/하이라이트 스타일
        if (!canvas.isExporting && (this.selected || this.highlighted)) {
            ctx.strokeStyle = this.selected ? '#f97316' : '#fbbf24';
            ctx.lineWidth = 3;
        } else {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.lineWidth;
        }

        // 각도가 90도인지 확인 (precision에 따른 반올림 적용)
        const degrees = this.angle * 180 / Math.PI;
        const isRightAngle = this.isRightAngle();

        if (isRightAngle) {
            // 직각 마커 그리기 (ㄱ 모양 사각형)
            const size = screenRadius * 0.6;

            // 시작각 방향으로 점1, 끝각 방향으로 점2
            const dir1X = Math.cos(-this.startAngle);
            const dir1Y = Math.sin(-this.startAngle);
            const dir2X = Math.cos(-this.endAngle);
            const dir2Y = Math.sin(-this.endAngle);

            // 직각 사각형의 세 꼭짓점 (꼭짓점에서 시작)
            const p1x = screenVertex.x + dir1X * size;
            const p1y = screenVertex.y + dir1Y * size;
            const p2x = screenVertex.x + dir1X * size + dir2X * size;
            const p2y = screenVertex.y + dir1Y * size + dir2Y * size;
            const p3x = screenVertex.x + dir2X * size;
            const p3y = screenVertex.y + dir2Y * size;

            ctx.beginPath();
            ctx.moveTo(p1x, p1y);
            ctx.lineTo(p2x, p2y);
            ctx.lineTo(p3x, p3y);
            ctx.stroke();
        } else {
            // 일반 각도: 호 그리기
            for (let i = 0; i < this.arcCount; i++) {
                ctx.beginPath();
                ctx.arc(screenVertex.x, screenVertex.y, screenRadius + i * 5,
                    -this.endAngle, -this.startAngle);
                ctx.stroke();
            }
        }

        // 동일 각도 표시 선
        if (this.markerCount > 0 && !isRightAngle) {
            const midAngle = (this.startAngle + this.endAngle) / 2;
            const innerR = Math.max(0, screenRadius - 5);
            const outerR = screenRadius + (this.arcCount - 1) * 5 + 5;

            ctx.beginPath();
            for (let i = 0; i < this.markerCount; i++) {
                const offset = (i - (this.markerCount - 1) / 2) * 5;
                const x1 = screenVertex.x + innerR * Math.cos(-midAngle) + offset * Math.sin(-midAngle);
                const y1 = screenVertex.y + innerR * Math.sin(-midAngle) - offset * Math.cos(-midAngle);
                const x2 = screenVertex.x + outerR * Math.cos(-midAngle) + offset * Math.sin(-midAngle);
                const y2 = screenVertex.y + outerR * Math.sin(-midAngle) - offset * Math.cos(-midAngle);
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
            }
            ctx.stroke();
        }

        // 값 표시 (직각은 숫자 안 보여도 됨 - 선택적)
        if (this.showValue && this.label !== false) {
            const midAngle = (this.startAngle + this.endAngle) / 2;
            const labelDist = this.labelPlacement === 'legacy' ? this.arcRadius * 1.5
                : this.arcRadius + (this.labelFontSize * 0.75 + 6) / canvas.scale;
            const labelPos = new Vec2(
                this.vertex.x + labelDist * Math.cos(midAngle) + this.labelOffset.x,
                this.vertex.y + labelDist * Math.sin(midAngle) + this.labelOffset.y
            );

            // Mk.2: 사용자 정의 텍스트 또는 자동 계산값
            // 직각이면 숫자 대신 빈칸 또는 작은 표시
            let displayText;
            if (this.customText !== null) {
                displayText = this.customText;
            } else if (isRightAngle) {
                displayText = '90°'; // 직각일 때도 숫자 표시 (선택적으로 빈 문자열 가능)
            } else {
                displayText = `${degrees.toFixed(this.precision)}°`;
            }

            /*
              Mk2.1: "숫자(라벨) 클릭으로 선택/편집"을 가능하게 하려면
              라벨의 화면 위치(바운딩 박스)를 저장해 hitTest에서 사용할 수 있어야 합니다.
            */
            const screen = canvas.toScreen(labelPos);
            const offsetX = this.labelPlacement === 'legacy' ? 8 : 0;
            const offsetY = this.labelPlacement === 'legacy' ? -8 : 0;
            ctx.font = `${this.labelFontSize}px "Times New Roman", "STIX Two Math", Georgia, serif`;
            const metrics = ctx.measureText(displayText);
            const padding = 4;
            const x = screen.x + offsetX;
            const y = screen.y + offsetY;

            // 라벨 바운딩 박스 저장 (screen 좌표)
            this._labelBox = {
                x: x - metrics.width / 2 - padding,
                y: y - (this.labelFontSize / 2) - padding,
                w: metrics.width + padding * 2,
                h: this.labelFontSize + padding * 2
            };

            const anchor = this.getArcAnchor(canvas);
            const textDistance = Math.hypot(x - anchor.x, y - anchor.y);
            const textAngle = Math.atan2(labelPos.y - this.vertex.y, labelPos.x - this.vertex.x);
            const detached = textDistance > Math.max(34, this.labelFontSize * 1.8) || !this.isAngleInRange(textAngle);
            if (this.leaderMode === 'always' || (this.leaderMode === 'auto' && detached)) {
                this._leaderCurve = leaderGeometry(this._labelBox, anchor, this.leaderCurvature);
                drawLeader(ctx, this._leaderCurve, this.color, this.lineWidth);
            }

            // Generated labels are placed in free space. Do not erase geometry
            // with an opaque rectangle when a label overlaps a different object.
            ctx.fillStyle = this.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(displayText, x, y);
        }
        if (this.selected && !canvas.isExporting) {
            const handle = this._leaderCurve && quadraticAt(this._leaderCurve.start, this._leaderCurve.control, this._leaderCurve.end, 0.5);
            ctx.save(); ctx.setLineDash([]); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#f97316'; ctx.lineWidth = 1.5;
            if (handle) { ctx.beginPath(); ctx.arc(handle.x, handle.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
            ctx.restore();
        }
    }

    isRightAngle() { return Math.abs(this.angle - Math.PI / 2) < 1e-8 && this.markerCount === 0 && this.arcCount === 1; }

    getArcAnchor(canvas) {
        const middle = (this.startAngle + this.endAngle) / 2;
        const radius = this.arcRadius * (this.isRightAngle() ? 0.6 * Math.SQRT2 : 1);
        return canvas.toScreen({ x: this.vertex.x + radius * Math.cos(middle), y: this.vertex.y + radius * Math.sin(middle) });
    }

    /**
     * 각도 값 반환 (도)
     */
    getAngleDegrees() {
        return this.angle * 180 / Math.PI;
    }

    hitTest(point, threshold, canvas) {
        this._hitPart = null;
        if (!this.visible || !this.valid || !this.vertex) return false;

        // Mk2.1: 라벨 클릭도 hit로 인정 (숫자 클릭 편집 UX)
        if (this._labelBox) {
            const sp = canvas.toScreen(point);
            const inLabel = (
                sp.x >= this._labelBox.x && sp.x <= this._labelBox.x + this._labelBox.w &&
                sp.y >= this._labelBox.y && sp.y <= this._labelBox.y + this._labelBox.h
            );
            if (inLabel) {
                this._hitPart = 'label';
                return true;
            }
        }

        if (this.isRightAngle()) {
            const v = canvas.toScreen(this.vertex), size = canvas.toScreenLength(this.arcRadius) * 0.6;
            const p = { x: v.x + size * Math.cos(this.startAngle), y: v.y - size * Math.sin(this.startAngle) };
            const q = { x: v.x + size * Math.cos(this.endAngle), y: v.y - size * Math.sin(this.endAngle) };
            const corner = { x: p.x + q.x - v.x, y: p.y + q.y - v.y }, sp = canvas.toScreen(point);
            const hit = Math.min(segmentDistance(sp, p, corner), segmentDistance(sp, corner, q)) < threshold;
            if (hit) { this._hitPart = 'shape'; return true; }
        } else {
            const dist = point.distanceTo(this.vertex);
            const angle = Math.atan2(point.y - this.vertex.y, point.x - this.vertex.x);
            if (Array.from({ length: this.arcCount }, (_, i) => Math.abs(dist - this.arcRadius - canvas.toMathLength(i * 5)) < canvas.toMathLength(threshold)).some(Boolean) && this.isAngleInRange(angle)) {
                this._hitPart = 'shape'; return true;
            }
        }
        if (this._leaderCurve && curveDistance(canvas.toScreen(point), this._leaderCurve) < threshold) {
            this._hitPart = 'leader'; return true;
        }
        return false;
    }

    isAngleInRange(angle) {
        let start = this.startAngle;
        let end = this.endAngle;

        while (start < 0) start += Math.PI * 2;
        while (end < 0) end += Math.PI * 2;
        while (angle < 0) angle += Math.PI * 2;

        if (start > end) {
            return angle >= start || angle <= end;
        } else {
            return angle >= start && angle <= end;
        }
    }

    isDraggable() {
        return !this.locked;
    }

    startDrag(point, canvas) {
        this.dragStart = point.clone();
        this.labelOffsetStart = this.labelOffset.clone();
        this.arcRadiusStart = this.arcRadius;
        this.leaderCurvatureStart = this.leaderCurvature;
        this._draggingLeader = this._hitPart === 'leader';
        this._leaderNormalStart = this._leaderCurve?.normal;

        // 라벨을 클릭했는지 호를 클릭했는지 판별
        this._draggingLabel = (this._hitPart === 'label');
    }

    drag(point, delta, canvas) {
        if (!this.vertex) return;

        const moveVec = new Vec2(
            point.x - this.dragStart.x,
            point.y - this.dragStart.y
        );

        if (this._draggingLeader && this._leaderNormalStart) {
            const n = this._leaderNormalStart;
            this.leaderCurvature = MathUtils.clamp(this.leaderCurvatureStart + 2 * canvas.scale * (moveVec.x * n.x - moveVec.y * n.y), -300, 300);
        } else if (this._draggingLabel) {
            // 라벨만 이동 (자유롭게)
            this.labelOffset = new Vec2(
                this.labelOffsetStart.x + moveVec.x,
                this.labelOffsetStart.y + moveVec.y
            );
        } else {
            // 호 드래그: 반지름만 조정
            const radialDir = this.dragStart.sub(this.vertex).normalize();
            const radialMove = moveVec.x * radialDir.x + moveVec.y * radialDir.y;
            const factor = this.isRightAngle() ? Math.max(0.1, this.dragStart.distanceTo(this.vertex) / this.arcRadiusStart) : 1;
            this.arcRadius = Math.max(0.08, Math.min(20, this.arcRadiusStart + radialMove / factor));
        }
    }

    endDrag() {
        delete this.dragStart;
        delete this.labelOffsetStart;
        delete this.arcRadiusStart;
        delete this._draggingLabel;
        delete this._draggingLeader;
        delete this._leaderNormalStart;
        delete this.leaderCurvatureStart;
    }

    getIconClass() {
        return 'marker';
    }

    getTypeName() {
        return '각도 치수';
    }

    toJSON() {
        return {
            ...super.toJSON(),
            vertexId: this.vertexId,
            point1Id: this.point1Id,
            point2Id: this.point2Id,
            arcRadius: this.arcRadius,
            showValue: this.showValue,
            markerCount: this.markerCount,
            arcCount: this.arcCount,
            labelOffset: { x: this.labelOffset.x, y: this.labelOffset.y },
            customText: this.customText,
            precision: this.precision,
            labelFontSize: this.labelFontSize,
            labelPlacement: this.labelPlacement, leaderMode: this.leaderMode, leaderCurvature: this.leaderCurvature
        };
    }
}

/**
 * 길이 치수 - 선분의 길이 표시
 */
export class LengthDimension extends GeoObject {
    constructor(segmentId, params = {}) {
        super(ObjectType.LENGTH_DIMENSION, params);
        this.segmentId = segmentId;

        this.addDependency(segmentId);

        // 스타일
        this.offset = params.offset || 0.5; // 선분에서 떨어진 거리
        this.showValue = params.showValue !== false;
        this.lineStyle = ['solid', 'dashed', 'dotted'].includes(params.lineStyle) ? params.lineStyle : 'dashed';
        // Keep the legacy control-point offset for old project files/UI drags.
        this.curvature = Number.isFinite(params.arcHeight) ? params.arcHeight * 2
            : Number.isFinite(params.curvature) ? params.curvature : DEFAULT_LENGTH_ARC_HEIGHT * 2;
        this.labelFontSize = params.labelFontSize || 24; // 80 mm 출력에서 길이값을 읽을 수 있는 기본 크기
        this.lineWidth = params.lineWidth ?? (params.type ? 3 : 2);
        this.dashLength = Number.isFinite(params.dashLength) ? MathUtils.clamp(params.dashLength, 1, 40) : 7;
        this.dashGap = Number.isFinite(params.dashGap) ? MathUtils.clamp(params.dashGap, 1, 40) : 7;
        this.labelOnCurve = typeof params.labelOnCurve === 'boolean' ? params.labelOnCurve : !(params.type || params.labelOffset);
        this.labelT = Number.isFinite(params.labelT) ? MathUtils.clamp(params.labelT, 0.1, 0.9) : 0.5;
        this.precision = (params.precision !== undefined) ? params.precision : 2;

        // Mk.2: 라벨 드래그 오프셋 및 사용자 정의 텍스트
        // 불러오기에서 평범한 {x,y}로 들어오므로 Vec2로 감싸 clone() 등을 보존한다.
        this.labelOffset = params.labelOffset
            ? new Vec2(params.labelOffset.x, params.labelOffset.y)
            : new Vec2(0, 0);
        // AI/JSON uses label for the printed value. The property panel uses
        // customText. Accept both without turning an omitted label into text.
        this.customText = params.customText ?? params.label ?? null;

        // 계산된 값
        this.point1 = null;
        this.point2 = null;
        this.length = 0;
    }

    get arcHeight() { return this.curvature / 2; }
    set arcHeight(value) { if (Number.isFinite(value)) this.curvature = value * 2; }

    update(objectManager) {
        const segment = objectManager.getObject(this.segmentId);

        if (!segment || !segment.valid) {
            this.valid = false;
            return;
        }

        this.point1 = segment.getPoint1();
        this.point2 = segment.getPoint2();

        if (!this.point1 || !this.point2) {
            this.valid = false;
            return;
        }

        this.length = this.point1.distanceTo(this.point2);
        this._obstacles = objectManager.getAllObjects().filter(object => object.id !== this.segmentId && object.visible && object.valid
            && typeof object.getPoint1 === 'function' && typeof object.getPoint2 === 'function')
            .map(object => [object.getPoint1(), object.getPoint2()]).filter(pair => pair.every(Boolean));
        this.valid = true;
    }

    render(canvas) {
        this._labelBox = null;
        if (!this.visible || !this.valid || !this.point1 || !this.point2) return;

        const ctx = canvas.ctx;

        // 선분의 방향 벡터와 수직 벡터
        const dx = this.point2.x - this.point1.x;
        const dy = this.point2.y - this.point1.y;
        const len = Math.sqrt(dx * dx + dy * dy);

        if (len === 0) return;

        // 화면 좌표로 변환
        const s1 = canvas.toScreen(this.point1);
        const s2 = canvas.toScreen(this.point2);

        const obstacles = (this._obstacles || []).map(pair => pair.map(point => canvas.toScreen(point)));
        const lengthStr = String(this.customText !== null ? this.customText : this.length.toFixed(this.precision));
        const variable = /^[a-zα-ω]$/u.test(lengthStr.trim());
        ctx.font = `${variable ? 'italic ' : ''}${this.labelFontSize}px "Times New Roman", "STIX Two Math", serif`;
        const textWidth = ctx.measureText(lengthStr).width;
        const boxHeight = this.labelFontSize * 1.5;
        const padding = Math.max(5, this.labelFontSize * .4);
        const nx = Math.abs((s2.y - s1.y) / Math.hypot(s2.x - s1.x, s2.y - s1.y));
        const ny = Math.abs((s2.x - s1.x) / Math.hypot(s2.x - s1.x, s2.y - s1.y));
        // Keep the entire horizontal native-equation box off its own segment,
        // including the extra descent and right bearing of that equation.
        const minimumHeight = nx * (Math.max(textWidth * 1.25, this.labelFontSize) - textWidth / 2 + padding)
            + ny * (boxHeight - this.labelFontSize / 2 + padding) + 2;
        const preferred = Math.sign(this.curvature || 1) * Math.max(Math.abs(this.curvature / 2), minimumHeight);
        const chosenHeight = chooseLengthArcHeight(s1, s2, preferred, obstacles);
        const height = Math.sign(preferred) * Math.max(Math.abs(chosenHeight), minimumHeight);
        const arc = lengthArcGeometry(s1, s2, height);
        this._renderedArc = arc;
        const labelPoint = arc.at(this.labelT);
        const labelX = labelPoint.x + this.labelOffset.x * canvas.scale;
        const labelY = labelPoint.y - this.labelOffset.y * canvas.scale;
        const labelBox = { x: labelX - textWidth / 2, y: labelY - this.labelFontSize / 2,
            width: Math.max(textWidth * 1.25, this.labelFontSize), height: boxHeight };
        const gapBox = { x: labelBox.x - padding, y: labelBox.y - padding,
            width: labelBox.width + padding * 2, height: labelBox.height + padding * 2 };

        // 선택/하이라이트 스타일
        if (!canvas.isExporting && (this.selected || this.highlighted)) {
            ctx.strokeStyle = this.selected ? '#f97316' : '#fbbf24';
            ctx.lineWidth = Math.max(2, this.lineWidth);
        } else {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.lineWidth;
        }

        // 점선 곡선 그리기
        ctx.setLineDash(this.lineStyle === 'solid' ? [] : this.lineStyle === 'dotted' ? [1, 4] : [this.dashLength, this.dashGap]);
        for (const [start, control, end] of lengthArcPieces(arc, this.showValue ? gapBox : null)) {
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.quadraticCurveTo(control.x, control.y, end.x, end.y);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        // 값 표시 (곡선 중간)
        if (this.showValue) {
            // 베지어 곡선 중간점 계산 (t=0.5) + 라벨 오프셋
            // Mk2.1: 라벨 바운딩 박스 저장 (숫자 클릭 선택/편집)
            this._labelBox = {
                x: labelX - textWidth / 2 - padding, y: labelY - this.labelFontSize / 2 - padding,
                w: textWidth + padding * 2, h: this.labelFontSize + padding * 2
            };

            // 텍스트
            ctx.fillStyle = this.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const previousAnchor = canvas.exportLabelAnchor;
            canvas.exportLabelAnchor = { fixed: true, gapBox };
            try { ctx.fillText(lengthStr, labelX, labelY); }
            finally { canvas.exportLabelAnchor = previousAnchor; }
        }
    }

    drawArrow(ctx, x1, y1, x2, y2, size) {
        const angle = Math.atan2(y2 - y1, x2 - x1);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + size * Math.cos(angle - Math.PI / 6), y1 + size * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + size * Math.cos(angle + Math.PI / 6), y1 + size * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
    }

    /**
     * 길이 값 반환
     */
    getLength() {
        return this.length;
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid || !this.point1 || !this.point2) return false;

        // Mk2.1: 라벨 클릭도 hit로 인정
        if (this._labelBox) {
            const sp = canvas.toScreen(point);
            const inLabel = (
                sp.x >= this._labelBox.x && sp.x <= this._labelBox.x + this._labelBox.w &&
                sp.y >= this._labelBox.y && sp.y <= this._labelBox.y + this._labelBox.h
            );
            if (inLabel) {
                this._hitPart = 'label';
                return true;
            }
        }

        // 실제 화면에 그린 베지어 곡선에서의 거리
        const dx = this.point2.x - this.point1.x;
        const dy = this.point2.y - this.point1.y;
        const len = Math.sqrt(dx * dx + dy * dy);

        if (len === 0) return false;

        const s1 = canvas.toScreen(this.point1);
        const s2 = canvas.toScreen(this.point2);
        const arc = this._renderedArc || lengthArcGeometry(s1, s2, this.curvature / 2);
        const screenPoint = canvas.toScreen(point);
        let dist = Number.POSITIVE_INFINITY;
        let previous = s1;
        for (let step = 1; step <= 40; step += 1) {
            const t = step / 40;
            const sample = arc.at(t);
            const current = new Vec2(sample.x, sample.y);
            dist = Math.min(dist, this.pointToSegmentDist(screenPoint, previous, current));
            previous = current;
        }
        const ok = dist < threshold;
        this._hitPart = ok ? 'shape' : null;
        return ok;
    }

    pointToSegmentDist(point, p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const lenSq = dx * dx + dy * dy;

        if (lenSq === 0) return point.distanceTo(p1);

        let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));

        const nearestX = p1.x + t * dx;
        const nearestY = p1.y + t * dy;

        return Math.sqrt((point.x - nearestX) ** 2 + (point.y - nearestY) ** 2);
    }

    isDraggable() {
        return !this.locked;
    }

    startDrag(point, canvas) {
        this.dragStart = point.clone();
        this.labelOffsetStart = this.labelOffset.clone();
        this.curvatureStart = this.curvature;
        this.labelTStart = this.labelT;
        this.dragMode = this._hitPart === 'label' ? 'label' : 'curve';
        this._draggingLabel = this.dragMode === 'label';

        // 선분 방향 벡터 계산
        if (this.point1 && this.point2) {
            const dx = this.point2.x - this.point1.x;
            const dy = this.point2.y - this.point1.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0) {
                this.segmentDir = new Vec2(dx / len, dy / len);
                this.segmentPerp = new Vec2(-dy / len, dx / len);
            }
        }
    }

    drag(point, delta, canvas) {
        const moveVec = new Vec2(
            point.x - this.dragStart.x,
            point.y - this.dragStart.y
        );

        if (this.dragMode === 'label' && this.labelOnCurve && this.segmentDir) {
            const direction = this.segmentDir, rel = point.sub(this.point1);
            const length = this.point1.distanceTo(this.point2);
            this.labelT = MathUtils.clamp((rel.x * direction.x + rel.y * direction.y) / length, 0.1, 0.9);
            const normal = rel.x * this.segmentPerp.x + rel.y * this.segmentPerp.y;
            this.curvature = MathUtils.clamp(normal * canvas.scale / (2 * this.labelT * (1 - this.labelT)), -500, 500);
            this.labelOffset = new Vec2(0, 0);
            return;
        }
        if (this.dragMode === 'label') {
            this.labelOffset = new Vec2(
                this.labelOffsetStart.x + moveVec.x,
                this.labelOffsetStart.y + moveVec.y
            );
            return;
        }

        if (this.segmentDir && this.segmentPerp) {
            // 선분에 수직 방향 이동량 → 곡률 조정
            const perpMove = moveVec.x * this.segmentPerp.x + moveVec.y * this.segmentPerp.y;
            this.curvature = MathUtils.clamp(this.curvatureStart + perpMove * canvas.scale * 2, -500, 500);
        } else {
            this.curvature = this.curvatureStart;
        }
    }

    endDrag() {
        delete this.dragStart;
        delete this.labelOffsetStart;
        delete this.curvatureStart;
        delete this.segmentDir;
        delete this.segmentPerp;
        delete this.dragMode;
        delete this._draggingLabel;
        delete this._hitPart;
    }

    getIconClass() {
        return 'marker';
    }

    getTypeName() {
        return '길이 치수';
    }

    toJSON() {
        return {
            ...super.toJSON(),
            segmentId: this.segmentId,
            lineStyle: this.lineStyle,
            offset: this.offset,
            showValue: this.showValue,
            labelOffset: { x: this.labelOffset.x, y: this.labelOffset.y },
            customText: this.customText,
            curvature: this.curvature,
            arcHeight: this.curvature / 2,
            dashLength: this.dashLength, dashGap: this.dashGap, labelOnCurve: this.labelOnCurve, labelT: this.labelT,
            labelFontSize: this.labelFontSize,
            precision: this.precision
        };
    }
}

export default { AngleDimension, LengthDimension };
