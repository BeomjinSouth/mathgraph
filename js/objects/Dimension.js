/**
 * Dimension.js - 치수 객체 (Mk.2)
 * 각도 치수, 길이 치수
 */

import { GeoObject, ObjectType } from './GeoObject.js';
import { Vec2 } from '../utils/Geometry.js';

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

        // Mk.2: 라벨 드래그 오프셋 및 사용자 정의 텍스트
        this.labelOffset = params.labelOffset || new Vec2(0, 0);
        this.customText = params.customText || null; // null이면 자동 계산값 표시

        // Mk2.1: 표시 설정
        // - precision: 자동 계산값(각도)의 소수점 자리수
        // - labelFontSize: 라벨 폰트 크기 (캔버스에 그려지는 숫자 크기)
        this.precision = (params.precision !== undefined) ? params.precision : 1;
        this.labelFontSize = params.labelFontSize || 14;

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

        this.angle = diff;
        this.valid = true;
    }

    render(canvas) {
        if (!this.visible || !this.valid || !this.vertex) return;

        const ctx = canvas.ctx;
        const screenVertex = canvas.toScreen(this.vertex);
        const screenRadius = canvas.toScreenLength(this.arcRadius);

        // 선택/하이라이트 스타일
        if (this.selected || this.highlighted) {
            ctx.strokeStyle = this.selected ? '#f97316' : '#fbbf24';
            ctx.lineWidth = 3;
        } else {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.lineWidth;
        }

        // 각도가 90도인지 확인 (precision에 따른 반올림 적용)
        const degrees = this.angle * 180 / Math.PI;
        const roundedDegrees = parseFloat(degrees.toFixed(this.precision));
        const isRightAngle = roundedDegrees === 90;

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
            ctx.beginPath();
            ctx.arc(screenVertex.x, screenVertex.y, screenRadius,
                -this.endAngle, -this.startAngle);
            ctx.stroke();
        }

        // 동일 각도 표시 선
        if (this.markerCount > 0 && !isRightAngle) {
            const midAngle = (this.startAngle + this.endAngle) / 2;
            const innerR = screenRadius * 0.6;
            const outerR = screenRadius * 1.1;

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
            const labelDist = this.arcRadius * 1.5;
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
            const offsetX = 8;
            const offsetY = -8;
            ctx.font = `${this.labelFontSize}px "Noto Sans KR", sans-serif`;
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

            // 기존 drawLabel 대신, 중앙 정렬 + 배경 박스로 가독성 향상
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(this._labelBox.x, this._labelBox.y, this._labelBox.w, this._labelBox.h);
            ctx.fillStyle = this.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(displayText, x, y);
        }
    }

    /**
     * 각도 값 반환 (도)
     */
    getAngleDegrees() {
        return this.angle * 180 / Math.PI;
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid || !this.vertex) return false;

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

        const dist = point.distanceTo(this.vertex);
        const onArc = Math.abs(dist - this.arcRadius) < canvas.toMathLength(threshold);

        if (!onArc) return false;

        // 각도 범위 확인
        const angle = Math.atan2(point.y - this.vertex.y, point.x - this.vertex.x);
        const ok = this.isAngleInRange(angle);
        this._hitPart = ok ? 'shape' : null;
        return ok;
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
        return true; // 라벨 위치 및 호 크기 드래그 가능
    }

    startDrag(point, canvas) {
        this.dragStart = point.clone();
        this.labelOffsetStart = this.labelOffset.clone();
        this.arcRadiusStart = this.arcRadius;

        // 라벨을 클릭했는지 호를 클릭했는지 판별
        this._draggingLabel = (this._hitPart === 'label');
    }

    drag(point, delta, canvas) {
        if (!this.vertex) return;

        const moveVec = new Vec2(
            point.x - this.dragStart.x,
            point.y - this.dragStart.y
        );

        if (this._draggingLabel) {
            // 라벨만 이동 (자유롭게)
            this.labelOffset = new Vec2(
                this.labelOffsetStart.x + moveVec.x,
                this.labelOffsetStart.y + moveVec.y
            );
        } else {
            // 호 드래그: 반지름만 조정
            const radialDir = this.dragStart.sub(this.vertex).normalize();
            const radialMove = moveVec.x * radialDir.x + moveVec.y * radialDir.y;
            this.arcRadius = Math.max(0.2, Math.min(3, this.arcRadiusStart + radialMove));
        }
    }

    endDrag() {
        delete this.dragStart;
        delete this.labelOffsetStart;
        delete this.arcRadiusStart;
        delete this._draggingLabel;
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
            labelOffset: { x: this.labelOffset.x, y: this.labelOffset.y },
            customText: this.customText,
            precision: this.precision,
            labelFontSize: this.labelFontSize
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
        this.curvature = params.curvature || 25; // 곡선의 휨 정도 (픽셀)
        this.labelFontSize = params.labelFontSize || 12; // 라벨 폰트 크기
        this.precision = (params.precision !== undefined) ? params.precision : 2;

        // Mk.2: 라벨 드래그 오프셋 및 사용자 정의 텍스트
        this.labelOffset = params.labelOffset || new Vec2(0, 0);
        this.customText = params.customText || null;

        // 계산된 값
        this.point1 = null;
        this.point2 = null;
        this.length = 0;
    }

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
        this.valid = true;
    }

    render(canvas) {
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

        // 곡선 중간점 (베지어 제어점)
        const midX = (s1.x + s2.x) / 2;
        const midY = (s1.y + s2.y) / 2;

        // 수직 방향으로 오프셋 (스크린 좌표) - curvature로 조절 가능
        const screenOffset = this.curvature;
        const perpX = -dy / len;
        const perpY = dx / len;
        const ctrlX = midX + perpX * screenOffset;
        const ctrlY = midY - perpY * screenOffset;

        // 선택/하이라이트 스타일
        if (this.selected || this.highlighted) {
            ctx.strokeStyle = this.selected ? '#f97316' : '#fbbf24';
            ctx.lineWidth = 2;
        } else {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 1;
        }

        // 점선 곡선 그리기
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.quadraticCurveTo(ctrlX, ctrlY, s2.x, s2.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // 값 표시 (곡선 중간)
        if (this.showValue) {
            // 베지어 곡선 중간점 계산 (t=0.5) + 라벨 오프셋
            const labelOffsetScreen = canvas.toScreenLength(Math.sqrt(
                this.labelOffset.x * this.labelOffset.x + this.labelOffset.y * this.labelOffset.y
            ));
            const bezierMidX = 0.25 * s1.x + 0.5 * ctrlX + 0.25 * s2.x + this.labelOffset.x * canvas.scale;
            const bezierMidY = 0.25 * s1.y + 0.5 * ctrlY + 0.25 * s2.y - this.labelOffset.y * canvas.scale;

            // Mk.2: 사용자 정의 텍스트 또는 자동 계산값
            const lengthStr = this.customText !== null ? this.customText : this.length.toFixed(this.precision);
            ctx.font = `${this.labelFontSize}px "Noto Sans KR", sans-serif`;
            const textWidth = ctx.measureText(lengthStr).width;

            // 배경 박스 (반투명 흰색)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            const boxHeight = this.labelFontSize + 4;
            ctx.fillRect(bezierMidX - textWidth / 2 - 4, bezierMidY - boxHeight / 2, textWidth + 8, boxHeight);

            // Mk2.1: 라벨 바운딩 박스 저장 (숫자 클릭 선택/편집)
            this._labelBox = {
                x: bezierMidX - textWidth / 2 - 4,
                y: bezierMidY - boxHeight / 2,
                w: textWidth + 8,
                h: boxHeight
            };

            // 텍스트
            ctx.fillStyle = this.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(lengthStr, bezierMidX, bezierMidY);
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

        // 오프셋된 치수선에서의 거리
        const dx = this.point2.x - this.point1.x;
        const dy = this.point2.y - this.point1.y;
        const len = Math.sqrt(dx * dx + dy * dy);

        if (len === 0) return false;

        const perpX = -dy / len * this.offset;
        const perpY = dx / len * this.offset;

        const p1 = new Vec2(this.point1.x + perpX, this.point1.y + perpY);
        const p2 = new Vec2(this.point2.x + perpX, this.point2.y + perpY);

        // 선분까지의 거리 계산
        const dist = this.pointToSegmentDist(point, p1, p2);
        const ok = dist < canvas.toMathLength(threshold);
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
        return true; // 라벨 위치 및 곡률 드래그 가능
    }

    startDrag(point, canvas) {
        this.dragStart = point.clone();
        this.labelOffsetStart = this.labelOffset.clone();
        this.curvatureStart = this.curvature;

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

        if (this.segmentDir && this.segmentPerp) {
            // 선분에 수직 방향 이동량 → 곡률 조정
            const perpMove = moveVec.x * this.segmentPerp.x + moveVec.y * this.segmentPerp.y;
            this.curvature = Math.max(5, Math.min(100, this.curvatureStart + perpMove * canvas.scale * 2));

            // 선분에 평행 방향 이동량 → 라벨 위치 조정
            const paraMove = moveVec.x * this.segmentDir.x + moveVec.y * this.segmentDir.y;
            this.labelOffset = new Vec2(
                this.labelOffsetStart.x + paraMove * this.segmentDir.x,
                this.labelOffsetStart.y + paraMove * this.segmentDir.y
            );
        } else {
            // 방향 정보가 없으면 기존 방식
            this.labelOffset = new Vec2(
                this.labelOffsetStart.x + moveVec.x,
                this.labelOffsetStart.y + moveVec.y
            );
        }
    }

    endDrag() {
        delete this.dragStart;
        delete this.labelOffsetStart;
        delete this.curvatureStart;
        delete this.segmentDir;
        delete this.segmentPerp;
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
            offset: this.offset,
            showValue: this.showValue,
            labelOffset: { x: this.labelOffset.x, y: this.labelOffset.y },
            customText: this.customText,
            labelFontSize: this.labelFontSize,
            precision: this.precision
        };
    }
}

export default { AngleDimension, LengthDimension };
