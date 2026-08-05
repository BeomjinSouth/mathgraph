/**
 * Canvas.js - 캔버스 관리 클래스
 * 좌표계, 확대/축소, 이동, 격자 렌더링
 */

import { Vec2, Geometry } from '../utils/Geometry.js';
import { MathUtils } from '../utils/MathUtils.js';
import { getScaledAxisArrowStyle } from '../utils/AxisArrowStyle.js';

export class Canvas {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');

        // 뷰포트 설정
        this.offset = new Vec2(0, 0); // 화면 중심의 수학 좌표
        this.scale = 50; // 1 수학 단위 = 50 픽셀

        // 설정
        this.showGrid = true;
        this.showXAxis = true;
        this.showYAxis = true;
        this.showAxisNumbers = true;
        this.axisNumberInterval = 'auto';
        this.backgroundColor = '#ffffff';

        // 그리드 설정
        this.gridColor = '#e5e5e5';
        this.gridMajorColor = '#cccccc';
        this.axisColor = '#333333';
        this.labelBounds = [];

        // 크기 초기화
        this.resize();
    }

    /**
     * 캔버스 크기 조정
     */
    resize() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();

        // 고해상도 디스플레이 지원
        const dpr = window.devicePixelRatio || 1;

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;

        this.ctx.scale(dpr, dpr);

        this.width = rect.width;
        this.height = rect.height;
    }

    /**
     * 수학 좌표 → 화면 좌표
     */
    toScreen(mathCoord) {
        return new Vec2(
            this.width / 2 + (mathCoord.x - this.offset.x) * this.scale,
            this.height / 2 - (mathCoord.y - this.offset.y) * this.scale
        );
    }

    /**
     * 화면 좌표 → 수학 좌표
     */
    toMath(screenCoord) {
        return new Vec2(
            (screenCoord.x - this.width / 2) / this.scale + this.offset.x,
            -(screenCoord.y - this.height / 2) / this.scale + this.offset.y
        );
    }

    /**
     * 수학 길이 → 화면 길이
     */
    toScreenLength(mathLength) {
        return mathLength * this.scale;
    }

    /**
     * 화면 길이 → 수학 길이
     */
    toMathLength(screenLength) {
        return screenLength / this.scale;
    }

    /**
     * 확대/축소
     */
    zoom(factor, center = null) {
        const oldScale = this.scale;
        this.scale = MathUtils.clamp(this.scale * factor, 5, 500);

        // 중심점 기준 확대/축소
        if (center) {
            const mathCenter = this.toMath(center);
            const actualFactor = this.scale / oldScale;
            this.offset = mathCenter.add(
                this.offset.sub(mathCenter).mul(1 / actualFactor)
            );
        }
    }

    /**
     * 확대율 설정
     */
    setZoom(scale) {
        this.scale = MathUtils.clamp(scale, 5, 500);
    }

    /**
     * 뷰 이동 (화면 픽셀 단위) - 드래그 방향과 이동 방향 일치
     */
    pan(dx, dy) {
        this.offset.x += dx / this.scale;
        this.offset.y -= dy / this.scale;
    }

    /**
     * 뷰 초기화
     */
    resetView() {
        this.offset = new Vec2(0, 0);
        this.scale = 50;
    }

    /**
     * 현재 줌 레벨 (백분율)
     */
    getZoomPercent() {
        return Math.round((this.scale / 50) * 100);
    }

    /**
     * 보이는 영역의 수학 좌표 범위
     */
    getVisibleBounds() {
        const margin = 0;
        const topLeft = this.toMath(new Vec2(-margin, -margin));
        const bottomRight = this.toMath(new Vec2(this.width + margin, this.height + margin));

        return {
            minX: topLeft.x,
            maxX: bottomRight.x,
            minY: bottomRight.y,
            maxY: topLeft.y
        };
    }

    /**
     * 캔버스 지우기
     */
    clear() {
        this.resetLabelLayout();
        this.ctx.fillStyle = this.backgroundColor;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    /**
     * 한 프레임 안에서 이미 그린 라벨의 화면 영역을 초기화합니다.
     */
    resetLabelLayout() {
        this.labelBounds = [];
    }

    /**
     * 격자 그리기
     */
    drawGrid() {
        if (!this.showGrid) return;

        const bounds = this.getVisibleBounds();
        const ctx = this.ctx;

        const gap = this.getGridGap();

        ctx.strokeStyle = this.gridColor;
        ctx.lineWidth = 0.5;

        // 세로선
        const startX = Math.floor(bounds.minX / gap) * gap;
        for (let x = startX; x <= bounds.maxX; x += gap) {
            const screenX = this.toScreen(new Vec2(x, 0)).x;

            ctx.beginPath();
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, this.height);

            // 5의 배수는 더 진하게
            if (MathUtils.isZero(x % (gap * 5))) {
                ctx.strokeStyle = this.gridMajorColor;
                ctx.lineWidth = 1;
            } else {
                ctx.strokeStyle = this.gridColor;
                ctx.lineWidth = 0.5;
            }
            ctx.stroke();
        }

        // 가로선
        const startY = Math.floor(bounds.minY / gap) * gap;
        for (let y = startY; y <= bounds.maxY; y += gap) {
            const screenY = this.toScreen(new Vec2(0, y)).y;

            ctx.beginPath();
            ctx.moveTo(0, screenY);
            ctx.lineTo(this.width, screenY);

            if (MathUtils.isZero(y % (gap * 5))) {
                ctx.strokeStyle = this.gridMajorColor;
                ctx.lineWidth = 1;
            } else {
                ctx.strokeStyle = this.gridColor;
                ctx.lineWidth = 0.5;
            }
            ctx.stroke();
        }
    }

    /**
     * 축 그리기
     */
    drawAxes() {
        // X축과 Y축 모두 비활성화면 레이블도 그리지 않음
        if (!this.showXAxis && !this.showYAxis) return;

        const ctx = this.ctx;
        const origin = this.toScreen(new Vec2(0, 0));
        const bounds = this.getVisibleBounds();
        const axisArrow = getScaledAxisArrowStyle();

        ctx.strokeStyle = this.axisColor;
        ctx.lineWidth = 1.5;
        ctx.fillStyle = this.axisColor;

        // X축
        if (this.showXAxis && bounds.minY <= 0 && bounds.maxY >= 0) {
            ctx.beginPath();
            ctx.moveTo(0, origin.y);
            ctx.lineTo(Math.max(0, this.width - axisArrow.baseInset), origin.y);
            ctx.stroke();

            // 화살표
            ctx.beginPath();
            ctx.moveTo(Math.max(0, this.width - axisArrow.tipInset), origin.y);
            ctx.lineTo(Math.max(0, this.width - axisArrow.baseInset), origin.y - axisArrow.halfWidth);
            ctx.lineTo(Math.max(0, this.width - axisArrow.baseInset), origin.y + axisArrow.halfWidth);
            ctx.closePath();
            ctx.fill();

            ctx.save();
            ctx.font = 'italic 22px "Times New Roman", serif';
            ctx.fillStyle = this.axisColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(
                'x',
                MathUtils.clamp(this.width - axisArrow.xLabelInset, 0, this.width),
                MathUtils.clamp(origin.y + axisArrow.xLabelGap, axisArrow.xLabelMinGap, this.height - axisArrow.xLabelBottomInset)
            );
            ctx.restore();
        }

        // Y축
        if (this.showYAxis && bounds.minX <= 0 && bounds.maxX >= 0) {
            ctx.beginPath();
            ctx.moveTo(origin.x, Math.min(this.height, axisArrow.baseInset));
            ctx.lineTo(origin.x, this.height);
            ctx.stroke();

            // 화살표
            ctx.beginPath();
            ctx.moveTo(origin.x, Math.max(0, axisArrow.tipInset));
            ctx.lineTo(origin.x - axisArrow.halfWidth, Math.min(this.height, axisArrow.baseInset));
            ctx.lineTo(origin.x + axisArrow.halfWidth, Math.min(this.height, axisArrow.baseInset));
            ctx.closePath();
            ctx.fill();

            ctx.save();
            ctx.font = 'italic 22px "Times New Roman", serif';
            ctx.fillStyle = this.axisColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText('y', MathUtils.clamp(origin.x - axisArrow.yLabelInset, 10, this.width - 10), axisArrow.yLabelBaseline);
            ctx.restore();
        }

        // 눈금 및 레이블
        this.drawAxisLabels();
    }

    /**
     * 축 레이블 그리기
     */
    drawAxisLabels() {
        const ctx = this.ctx;
        const origin = this.toScreen(new Vec2(0, 0));
        const bounds = this.getVisibleBounds();

        const gap = this.getAxisNumberGap();

        ctx.font = '11px "Noto Sans KR", sans-serif';
        ctx.fillStyle = '#666666';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // X축 레이블 (X축이 활성화된 경우에만)
        if (this.showXAxis) {
            for (const x of this.getTickValues(bounds.minX, bounds.maxX, gap)) {
                if (MathUtils.isZero(x)) continue;

                const screenX = this.toScreen(new Vec2(x, 0)).x;
                const labelY = MathUtils.clamp(origin.y + 5, 5, this.height - 20);

                // 눈금
                ctx.strokeStyle = this.axisColor;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(screenX, origin.y - 3);
                ctx.lineTo(screenX, origin.y + 3);
                ctx.stroke();

                if (this.showAxisNumbers) {
                    const label = this.formatAxisNumber(x, gap);
                    this.drawAxisNumberLabel(label, screenX, labelY, {
                        horizontal: 'center',
                        vertical: 'top'
                    });
                }
            }
        }

        // Y축 레이블 (Y축이 활성화된 경우에만)
        if (this.showYAxis) {
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';

            for (const y of this.getTickValues(bounds.minY, bounds.maxY, gap)) {
                if (MathUtils.isZero(y)) continue;

                const screenY = this.toScreen(new Vec2(0, y)).y;
                const labelX = MathUtils.clamp(origin.x - 5, 25, this.width - 5);

                // 눈금
                ctx.strokeStyle = this.axisColor;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(origin.x - 3, screenY);
                ctx.lineTo(origin.x + 3, screenY);
                ctx.stroke();

                if (this.showAxisNumbers) {
                    const label = this.formatAxisNumber(y, gap);
                    this.drawAxisNumberLabel(label, labelX, screenY, {
                        horizontal: 'right',
                        vertical: 'middle'
                    });
                }
            }
        }

        // 원점 O (양쪽 축이 모두 보일 때만)
        if (this.showAxisNumbers && this.showXAxis && this.showYAxis &&
            bounds.minX <= 0 && bounds.maxX >= 0 &&
            bounds.minY <= 0 && bounds.maxY >= 0) {
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            this.drawAxisNumberLabel('O', origin.x - 5, origin.y + 5, {
                horizontal: 'right',
                vertical: 'top'
            });
        }
    }

    drawAxisNumberLabel(text, x, y, options = {}) {
        const {
            fontSize = 11,
            color = '#666666',
            horizontal = 'center',
            vertical = 'top'
        } = options;

        const parts = this.parseMathExpression(text);
        const width = this.measureMathExpression(parts, this.ctx, fontSize);

        let drawX = x;
        if (horizontal === 'center') {
            drawX -= width / 2;
        } else if (horizontal === 'right') {
            drawX -= width;
        }

        let baselineY = y;
        if (vertical === 'top') {
            baselineY += fontSize;
        } else if (vertical === 'middle') {
            baselineY += fontSize / 2;
        }

        this.renderMathExpression(parts, this.ctx, drawX, baselineY, fontSize, color);
    }

    getAxisNumberGap() {
        const fixedGap = this.getFixedAxisNumberGap();
        if (fixedGap !== null) {
            return fixedGap;
        }

        const targetPixelGap = 100;
        const rawGap = targetPixelGap / this.scale;
        const possibleGaps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
        for (const gap of possibleGaps) {
            if (gap >= rawGap) {
                return gap;
            }
        }
        return possibleGaps[possibleGaps.length - 1];
    }

    getFixedAxisNumberGap() {
        if (this.axisNumberInterval === 'auto') {
            return null;
        }

        const fixedGap = Number(this.axisNumberInterval);
        return Number.isFinite(fixedGap) && fixedGap > 0 ? fixedGap : null;
    }

    getGridGap() {
        const fixedGap = this.getFixedAxisNumberGap();
        if (fixedGap !== null) {
            return fixedGap;
        }

        const targetPixelGap = 50;
        const rawGap = targetPixelGap / this.scale;
        const possibleGaps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
        for (const gap of possibleGaps) {
            if (gap >= rawGap) {
                return gap;
            }
        }
        return possibleGaps[possibleGaps.length - 1];
    }

    getTickValues(min, max, gap) {
        if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(gap) || gap <= 0) {
            return [];
        }

        const start = Math.ceil((min - MathUtils.EPSILON) / gap);
        const end = Math.floor((max + MathUtils.EPSILON) / gap);
        const decimals = this.getDecimalPlaces(gap);
        const values = [];

        for (let tick = start; tick <= end; tick++) {
            values.push(Number((tick * gap).toFixed(decimals)));
        }

        return values;
    }

    formatAxisNumber(value, gap = 1) {
        if (MathUtils.isZero(value)) {
            return '0';
        }

        const decimals = this.getDecimalPlaces(gap);
        return Number(value.toFixed(decimals)).toString();
    }

    getDecimalPlaces(value) {
        const text = String(value);
        if (text.includes('e-')) {
            return Math.min(8, Number(text.split('e-')[1]) || 0);
        }
        const decimal = text.split('.')[1];
        return decimal ? Math.min(8, decimal.length) : 0;
    }

    /**
     * 점 그리기
     */
    drawPoint(pos, options = {}) {
        const ctx = this.ctx;
        const screen = this.toScreen(pos);

        const {
            radius = 4,
            color = '#000000',
            borderColor = '#000000',
            borderWidth = 1.5,
            highlighted = false,
            selected = false,
            pointStyle = 'closed'
        } = options;

        const baseRadius = Math.max(0, Number(radius) || 0);
        if (baseRadius <= 0) {
            return;
        }

        const r = highlighted ? baseRadius + 2 : baseRadius;

        // 선택 표시
        if (selected) {
            ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, r + 6, 0, Math.PI * 2);
            ctx.fill();
        }

        // 테두리
        ctx.fillStyle = borderColor;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, r + borderWidth, 0, Math.PI * 2);
        ctx.fill();

        // 점
        ctx.fillStyle = pointStyle === 'open' ? (this.backgroundColor || '#ffffff') : color;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * 선 그리기 (선분)
     */
    drawSegment(p1, p2, options = {}) {
        const ctx = this.ctx;
        const s1 = this.toScreen(p1);
        const s2 = this.toScreen(p2);

        const {
            color = '#000000',
            width = 2,
            dashed = false,
            dashPattern = [5, 5],
            highlighted = false,
            selected = false
        } = options;

        ctx.strokeStyle = color;
        ctx.lineWidth = highlighted ? width + 1 : width;
        ctx.lineCap = 'round';

        if (dashed) {
            ctx.setLineDash(dashPattern);
        } else {
            ctx.setLineDash([]);
        }

        // 선택 표시
        if (selected) {
            ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
            ctx.lineWidth = width + 6;
            ctx.beginPath();
            ctx.moveTo(s1.x, s1.y);
            ctx.lineTo(s2.x, s2.y);
            ctx.stroke();
            ctx.strokeStyle = color;
            ctx.lineWidth = highlighted ? width + 1 : width;
        }

        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);
        ctx.stroke();

        ctx.setLineDash([]);
    }

    /**
     * 수학 좌표 점들을 잇는 매끄러운 폴리라인을 그린다.
     */
    drawPolyline(points, options = {}) {
        if (!Array.isArray(points) || points.length < 2) return;

        const ctx = this.ctx;
        const screenPoints = points.map(point => this.toScreen(point));
        const {
            color = '#000000',
            width = 2,
            dashed = false,
            dashPattern = [5, 5],
            highlighted = false,
            selected = false,
            closed = false,
            fillColor = null
        } = options;

        const trace = () => {
            ctx.beginPath();
            ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
            for (let i = 1; i < screenPoints.length; i++) {
                ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
            }
            if (closed) ctx.closePath();
        };

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash(dashed ? dashPattern : []);

        if (selected) {
            ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
            ctx.lineWidth = width + 6;
            trace();
            ctx.stroke();
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = highlighted ? width + 1 : width;
        trace();
        if (fillColor && closed) {
            ctx.fillStyle = fillColor;
            ctx.fill();
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    /**
     * 무한 직선 그리기
     */
    drawLine(p1, p2, options = {}) {
        const bounds = this.getVisibleBounds();
        const dir = p2.sub(p1).normalize();

        // 뷰포트 경계까지 확장
        const maxDist = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 2;
        const extP1 = p1.sub(dir.mul(maxDist));
        const extP2 = p1.add(dir.mul(maxDist));

        this.drawSegment(extP1, extP2, options);
    }

    /**
     * 반직선 그리기
     */
    drawRay(origin, direction, options = {}) {
        const bounds = this.getVisibleBounds();
        const dir = direction.normalize();

        const endPoint = this.getRayEndPoint(origin, dir, bounds);

        this.drawSegment(origin, endPoint, options);
        this.drawArrowHead(origin, endPoint, options);
    }

    /**
     * 반직선의 보이는 끝점을 현재 뷰포트 경계로 계산
     */
    getRayEndPoint(origin, dir, bounds = this.getVisibleBounds()) {
        if (!dir || dir.length() < MathUtils.EPSILON) {
            return origin.clone();
        }

        const normalized = dir.normalize();
        const candidates = [];

        if (Math.abs(normalized.x) > MathUtils.EPSILON) {
            const xBound = normalized.x > 0 ? bounds.maxX : bounds.minX;
            const t = (xBound - origin.x) / normalized.x;
            if (t >= 0) candidates.push(t);
        }

        if (Math.abs(normalized.y) > MathUtils.EPSILON) {
            const yBound = normalized.y > 0 ? bounds.maxY : bounds.minY;
            const t = (yBound - origin.y) / normalized.y;
            if (t >= 0) candidates.push(t);
        }

        const finiteCandidates = candidates
            .filter(t => Number.isFinite(t))
            .sort((a, b) => a - b);

        if (finiteCandidates.length > 0) {
            return origin.add(normalized.mul(finiteCandidates[0]));
        }

        const maxDist = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 2;
        return origin.add(normalized.mul(maxDist));
    }

    /**
     * 원 그리기
     */
    drawCircle(center, radius, options = {}) {
        const ctx = this.ctx;
        const screenCenter = this.toScreen(center);
        const screenRadius = this.toScreenLength(radius);

        const {
            color = '#000000',
            width = 2,
            fillColor = null,
            dashed = false,
            highlighted = false,
            selected = false
        } = options;

        // 선택 표시
        if (selected) {
            ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
            ctx.lineWidth = width + 6;
            ctx.beginPath();
            ctx.arc(screenCenter.x, screenCenter.y, screenRadius, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = highlighted ? width + 1 : width;

        if (dashed) {
            ctx.setLineDash([5, 5]);
        } else {
            ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.arc(screenCenter.x, screenCenter.y, screenRadius, 0, Math.PI * 2);

        if (fillColor) {
            ctx.fillStyle = fillColor;
            ctx.fill();
        }
        ctx.stroke();

        ctx.setLineDash([]);
    }

    /**
     * 벡터 그리기 (화살표)
     */
    drawVector(from, to, options = {}) {
        const {
            color = '#000000',
            width = 2,
            arrowSize = 10
        } = options;

        // 선
        this.drawSegment(from, to, { ...options, color, width });

        // 화살표 머리
        this.drawArrowHead(from, to, { ...options, color, arrowSize });
    }

    /**
     * 채워진 삼각형 화살표 머리 그리기
     */
    drawArrowHead(from, to, options = {}) {
        const ctx = this.ctx;
        const s1 = this.toScreen(from);
        const s2 = this.toScreen(to);

        const {
            color = '#000000',
            arrowSize = 10
        } = options;

        const dir = new Vec2(s2.x - s1.x, s2.y - s1.y);
        const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
        if (len < 1) return;

        const unitDir = new Vec2(dir.x / len, dir.y / len);
        const perpDir = new Vec2(-unitDir.y, unitDir.x);

        const arrowP1 = new Vec2(
            s2.x - unitDir.x * arrowSize - perpDir.x * arrowSize * 0.4,
            s2.y - unitDir.y * arrowSize - perpDir.y * arrowSize * 0.4
        );
        const arrowP2 = new Vec2(
            s2.x - unitDir.x * arrowSize + perpDir.x * arrowSize * 0.4,
            s2.y - unitDir.y * arrowSize + perpDir.y * arrowSize * 0.4
        );

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(s2.x, s2.y);
        ctx.lineTo(arrowP1.x, arrowP1.y);
        ctx.lineTo(arrowP2.x, arrowP2.y);
        ctx.closePath();
        ctx.fill();
    }

    /**
     * 텍스트 라벨 그리기
     */
    drawLabel(pos, text, options = {}) {
        const ctx = this.ctx;
        const screen = this.toScreen(pos);

        const {
            fontSize = 14,
            color = '#000000',
            offsetX = 8,
            offsetY = -8,
            backgroundColor = null,
            italic = false // Mk.2: 기본은 정자체(roman), true면 기울임
        } = options;

        // Mk.2: 기본 roman, 옵션으로 italic 선택
        if (italic) {
            ctx.font = `italic ${fontSize}px "Times New Roman", "STIX Two Math", Georgia, serif`;
        } else {
            ctx.font = `${fontSize}px "Times New Roman", "STIX Two Math", Georgia, serif`;
        }
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';

        const metrics = ctx.measureText(text);
        const padding = backgroundColor ? 3 : 1;
        const candidates = this.getLabelOffsetCandidates(offsetX, offsetY, metrics.width, fontSize);
        let chosen = null;
        let bestScore = Number.POSITIVE_INFINITY;

        for (const candidate of candidates) {
            const x = screen.x + candidate.offsetX;
            const y = screen.y + candidate.offsetY;
            const box = {
                x: x - padding,
                y: y - fontSize - padding,
                w: metrics.width + padding * 2,
                h: fontSize + padding * 2
            };
            const score = this.labelConflictScore(box);
            if (score < bestScore) {
                bestScore = score;
                chosen = { x, y, box };
            }
            if (score === 0) break;
        }

        const x = chosen?.x ?? screen.x + offsetX;
        const y = chosen?.y ?? screen.y + offsetY;
        const labelBox = chosen?.box ?? {
            x: x - padding,
            y: y - fontSize - padding,
            w: metrics.width + padding * 2,
            h: fontSize + padding * 2
        };
        this.labelBounds.push(labelBox);

        if (backgroundColor) {
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(
                x - padding,
                y - fontSize - padding,
                metrics.width + padding * 2,
                fontSize + padding * 2
            );
        }

        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
    }

    getLabelOffsetCandidates(offsetX, offsetY, textWidth, fontSize) {
        const gap = 8;
        const left = -textWidth - gap;
        const below = fontSize + gap;
        const above = -fontSize - gap;
        const center = -textWidth / 2;
        const candidates = [
            { offsetX, offsetY },
            { offsetX, offsetY: offsetY + below },
            { offsetX: left, offsetY },
            { offsetX: left, offsetY: offsetY + below },
            { offsetX, offsetY: offsetY + above },
            { offsetX: left, offsetY: offsetY + above },
            { offsetX: center, offsetY: offsetY + below },
            { offsetX: center, offsetY: offsetY + above }
        ];

        const seen = new Set();
        return candidates.filter(candidate => {
            const key = `${Math.round(candidate.offsetX * 10)}:${Math.round(candidate.offsetY * 10)}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    labelConflictScore(box) {
        let score = 0;
        for (const existing of this.labelBounds) {
            const overlapWidth = Math.min(box.x + box.w, existing.x + existing.w) - Math.max(box.x, existing.x);
            const overlapHeight = Math.min(box.y + box.h, existing.y + existing.h) - Math.max(box.y, existing.y);
            if (overlapWidth > 0 && overlapHeight > 0) {
                score += overlapWidth * overlapHeight;
            }
        }

        const outside =
            Math.max(0, -box.x) +
            Math.max(0, -box.y) +
            Math.max(0, box.x + box.w - this.width) +
            Math.max(0, box.y + box.h - this.height);

        return score + outside * 1000;
    }

    /**
     * 직각 표시 그리기
     */
    drawRightAngleMarker(vertex, p1, p2, options = {}) {
        const ctx = this.ctx;
        const size = options.size || 12;
        const color = options.color || '#000000';

        const screenVertex = this.toScreen(vertex);
        const dir1 = p1.sub(vertex).normalize();
        const dir2 = p2.sub(vertex).normalize();

        const screenSize = size;
        const corner1 = new Vec2(
            screenVertex.x + dir1.x * screenSize * this.scale / 50,
            screenVertex.y - dir1.y * screenSize * this.scale / 50
        );
        const corner2 = new Vec2(
            screenVertex.x + dir2.x * screenSize * this.scale / 50,
            screenVertex.y - dir2.y * screenSize * this.scale / 50
        );
        const corner3 = new Vec2(
            corner1.x + (corner2.x - screenVertex.x),
            corner1.y + (corner2.y - screenVertex.y)
        );

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(corner1.x, corner1.y);
        ctx.lineTo(corner3.x, corner3.y);
        ctx.lineTo(corner2.x, corner2.y);
        ctx.stroke();
    }

    /**
     * 같은 길이 표시 (틱 마크)
     */
    drawEqualLengthMarker(p1, p2, options = {}) {
        const ctx = this.ctx;
        const tickCount = options.tickCount || 1;
        const baseSize = options.size || 8;
        const color = options.color || '#000000';
        const lineWidth = options.lineWidth || 2;

        // lineWidth에 비례하여 전체 크기 스케일링
        const scale = lineWidth / 2;
        const tickSize = baseSize * scale;
        const spacing = 4 * scale;

        const mid = Geometry.midpoint(p1, p2);
        const screenMid = this.toScreen(mid);
        const dir = p2.sub(p1).normalize();
        const perp = dir.perpendicular();

        const screenPerp = new Vec2(perp.x, -perp.y);
        const startOffset = -((tickCount - 1) * spacing) / 2;

        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'square';  // 각진 모서리
        ctx.lineJoin = 'miter';

        for (let i = 0; i < tickCount; i++) {
            const offset = startOffset + i * spacing;
            const center = new Vec2(
                screenMid.x + dir.x * offset,
                screenMid.y - dir.y * offset
            );

            ctx.beginPath();
            ctx.moveTo(
                center.x - screenPerp.x * tickSize / 2,
                center.y - screenPerp.y * tickSize / 2
            );
            ctx.lineTo(
                center.x + screenPerp.x * tickSize / 2,
                center.y + screenPerp.y * tickSize / 2
            );
            ctx.stroke();
        }

        // 기본값 복원
        ctx.lineCap = 'round';
    }

    /**
     * 함수 그래프 그리기 (도메인 제한 지원)
     */
    drawFunction(fn, options = {}) {
        const ctx = this.ctx;
        const bounds = this.getVisibleBounds();

        const {
            color = '#000000',
            width = 2,
            samples = 500,
            highlighted = false,
            selected = false,
            xMin = null,
            xMax = null,
            yMin = null,
            yMax = null
        } = options;

        ctx.strokeStyle = color;
        ctx.lineWidth = highlighted ? width + 1 : width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);

        // 도메인 제한 적용
        const drawMinX = xMin !== null ? Math.max(bounds.minX, xMin) : bounds.minX;
        const drawMaxX = xMax !== null ? Math.min(bounds.maxX, xMax) : bounds.maxX;
        const drawMinY = yMin !== null ? yMin : null;
        const drawMaxY = yMax !== null ? yMax : null;

        if (drawMinX >= drawMaxX) return; // 그릴 범위가 없음
        if (drawMinY !== null && drawMaxY !== null && drawMinY >= drawMaxY) return;

        const step = (drawMaxX - drawMinX) / samples;
        let isDrawing = false;
        let prevY = null;
        let prevX = null;

        ctx.beginPath();

        for (let x = drawMinX; x <= drawMaxX; x += step) {
            const y = fn(x);

            // NaN, Infinity, 범위 밖 체크
            if (isNaN(y) || !isFinite(y)) {
                if (isDrawing) {
                    ctx.stroke();
                    ctx.beginPath();
                    isDrawing = false;
                }
                prevY = null;
                prevX = null;
                continue;
            }

            // 불연속 감지: 부호 변화 + 급격한 기울기
            if (prevY !== null && prevX !== null) {
                const dy = y - prevY;
                const dx = x - prevX;
                const slope = Math.abs(dy / dx);

                // 부호 변화 또는 급격한 기울기 변화 (불연속 의심)
                const signChanged = (prevY > 0 && y < 0) || (prevY < 0 && y > 0);
                const slopeThreshold = Math.max(100, (bounds.maxY - bounds.minY) * 10);

                if (signChanged && slope > slopeThreshold) {
                    // 불연속점으로 판단 - 선 끊기
                    ctx.stroke();
                    ctx.beginPath();
                    isDrawing = false;
                }
                // y값이 화면 범위를 크게 벗어나는 경우도 끊기
                else if (Math.abs(y) > (bounds.maxY - bounds.minY) * 5) {
                    ctx.stroke();
                    ctx.beginPath();
                    isDrawing = false;
                }
            }

            // 화면 범위 체크 (너무 벗어나면 그리지 않음)
            if (y < bounds.minY - 100 || y > bounds.maxY + 100) {
                if (isDrawing) {
                    ctx.stroke();
                    ctx.beginPath();
                    isDrawing = false;
                }
                prevY = y;
                prevX = x;
                continue;
            }

            if ((drawMinY !== null && y < drawMinY) ||
                (drawMaxY !== null && y > drawMaxY)) {
                if (isDrawing) {
                    ctx.stroke();
                    ctx.beginPath();
                    isDrawing = false;
                }
                prevY = y;
                prevX = x;
                continue;
            }

            const screen = this.toScreen(new Vec2(x, y));

            if (!isDrawing) {
                ctx.moveTo(screen.x, screen.y);
                isDrawing = true;
            } else {
                ctx.lineTo(screen.x, screen.y);
            }

            prevY = y;
            prevX = x;
        }

        if (isDrawing) {
            ctx.stroke();
        }
    }

    /**
     * 수학 수식 라벨 그리기 (LaTeX 스타일)
     * 간단한 수식 변환으로 위/아래첨자 렌더링
     */
    drawMathLabel(pos, text, options = {}) {
        const ctx = this.ctx;
        const screen = this.toScreen(pos);

        const {
            fontSize = 14,
            color = '#000000',
            offsetX = 8,
            offsetY = -8,
            backgroundColor = null,
            align = 'left'
        } = options;

        const y = screen.y + offsetY;

        // 수식을 렌더링 가능한 형태로 변환
        const renderedParts = this.parseMathExpression(text, fontSize, color);
        const totalWidth = this.measureMathExpression(renderedParts, ctx, fontSize);
        const alignedOffset = align === 'center' ? -totalWidth / 2 :
            align === 'right' ? -totalWidth : 0;
        const x = screen.x + offsetX + alignedOffset;

        // 배경 그리기
        if (backgroundColor) {
            const padding = 3;
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(
                x - padding,
                y - fontSize - padding,
                totalWidth + padding * 2,
                fontSize + padding * 2
            );
        }

        // 수식 렌더링
        this.renderMathExpression(renderedParts, ctx, x, y, fontSize, color);
    }

    /**
     * 수학 표현식 파싱 (위첨자/아래첨자 지원)
     */
    parseMathExpression(text, fontSize, color) {
        text = String(text ?? '');
        const parts = [];
        let i = 0;

        while (i < text.length) {
            const latexFraction = this.parseLatexFractionAt(text, i);
            const radical = this.parseRadicalAt(text, i);
            if (radical) {
                parts.push(radical.part);
                i = radical.nextIndex;
            } else if (latexFraction) {
                parts.push(latexFraction.part);
                i = latexFraction.nextIndex;
            } else if (text[i] === '^') {
                // 위첨자
                i++;
                if (text[i] === '{') {
                    // 중괄호로 묶인 경우
                    const end = text.indexOf('}', i);
                    if (end !== -1) {
                        parts.push({ type: 'super', text: this.normalizeMathLabelText(text.slice(i + 1, end)) });
                        i = end + 1;
                    } else {
                        parts.push({ type: 'super', text: this.normalizeMathLabelText(text.slice(i + 1)) });
                        break;
                    }
                } else {
                    // 단일 문자
                    parts.push({ type: 'super', text: this.normalizeMathLabelText(text[i] || '') });
                    i++;
                }
            } else if (text[i] === '_') {
                // 아래첨자
                i++;
                if (text[i] === '{') {
                    const end = text.indexOf('}', i);
                    if (end !== -1) {
                        parts.push({ type: 'sub', text: this.normalizeMathLabelText(text.slice(i + 1, end)) });
                        i = end + 1;
                    } else {
                        parts.push({ type: 'sub', text: this.normalizeMathLabelText(text.slice(i + 1)) });
                        break;
                    }
                } else {
                    parts.push({ type: 'sub', text: this.normalizeMathLabelText(text[i] || '') });
                    i++;
                }
            } else if (text[i] === '*') {
                // * 문자는 곱셈 기호로 생략
                i++;
            } else {
                // 일반 텍스트 수집
                let normalText = '';
                while (i < text.length &&
                    text[i] !== '^' &&
                    text[i] !== '_' &&
                    text[i] !== '*' &&
                    !text.startsWith('\\frac', i) &&
                    !text.startsWith('\\sqrt', i) &&
                    !text.toLowerCase().startsWith('sqrt(', i)) {
                    normalText += text[i];
                    i++;
                }
                if (normalText) {
                    this.appendMathLabelTextParts(parts, normalText);
                }
            }
        }

        return parts;
    }

    appendMathLabelTextParts(parts, text) {
        let index = 0;
        const source = String(text ?? '');

        while (index < source.length) {
            const fraction = this.findAsciiFractionInText(source, index);
            if (!fraction) {
                const rest = source.slice(index);
                if (rest) {
                    parts.push({ type: 'normal', text: this.normalizeMathLabelText(rest) });
                }
                return;
            }

            if (fraction.start > index) {
                parts.push({
                    type: 'normal',
                    text: this.normalizeMathLabelText(source.slice(index, fraction.start))
                });
            }

            parts.push(this.createFractionPart(fraction.numerator, fraction.denominator));
            index = fraction.end;
        }
    }

    createFractionPart(numeratorText, denominatorText) {
        return {
            type: 'fraction',
            numerator: this.parseMathExpression(this.stripOuterFractionGrouping(numeratorText)),
            denominator: this.parseMathExpression(this.stripOuterFractionGrouping(denominatorText))
        };
    }

    findAsciiFractionInText(text, fromIndex = 0) {
        let slashIndex = text.indexOf('/', fromIndex);

        while (slashIndex !== -1) {
            const numerator = this.readFractionNumerator(text, slashIndex);
            const denominator = this.readFractionDenominator(text, slashIndex);

            if (numerator && denominator && numerator.start >= fromIndex) {
                return {
                    start: numerator.start,
                    end: denominator.end,
                    numerator: numerator.text,
                    denominator: denominator.text
                };
            }

            slashIndex = text.indexOf('/', slashIndex + 1);
        }

        return null;
    }

    readFractionNumerator(text, slashIndex) {
        let i = slashIndex - 1;
        while (i >= 0 && /\s/.test(text[i])) i--;
        if (i < 0) return null;

        const end = i + 1;
        if (text[i] === ')') {
            const start = this.findMatchingOpenParen(text, i);
            if (start !== -1) {
                return { start, end, text: text.slice(start, end) };
            }
            return null;
        }

        if (this.isMathNumberChar(text[i])) {
            while (i >= 0 && this.isMathNumberChar(text[i])) i--;
            return { start: i + 1, end, text: text.slice(i + 1, end) };
        }

        if (this.isMathIdentifierChar(text[i])) {
            while (i >= 0 && this.isMathIdentifierChar(text[i])) i--;
            return { start: i + 1, end, text: text.slice(i + 1, end) };
        }

        return null;
    }

    readFractionDenominator(text, slashIndex) {
        let i = slashIndex + 1;
        while (i < text.length && /\s/.test(text[i])) i++;
        if (i >= text.length) return null;

        const start = i;
        if (text[i] === '(') {
            const end = this.findMatchingCloseParen(text, i);
            if (end !== -1) {
                return { start, end: end + 1, text: text.slice(start, end + 1) };
            }
            return null;
        }

        if (this.isMathNumberChar(text[i])) {
            while (i < text.length && this.isMathNumberChar(text[i])) i++;
            return { start, end: i, text: text.slice(start, i) };
        }

        if (this.isMathIdentifierChar(text[i])) {
            while (i < text.length && this.isMathIdentifierChar(text[i])) i++;
            return { start, end: i, text: text.slice(start, i) };
        }

        return null;
    }

    parseLatexFractionAt(text, index) {
        if (!String(text).startsWith('\\frac', index)) {
            return null;
        }

        let cursor = index + '\\frac'.length;
        while (cursor < text.length && /\s/.test(text[cursor])) cursor++;
        if (text[cursor] !== '{') return null;

        const numerator = this.readBracedGroup(text, cursor);
        if (!numerator) return null;

        cursor = numerator.end + 1;
        while (cursor < text.length && /\s/.test(text[cursor])) cursor++;
        if (text[cursor] !== '{') return null;

        const denominator = this.readBracedGroup(text, cursor);
        if (!denominator) return null;

        return {
            part: this.createFractionPart(numerator.text, denominator.text),
            nextIndex: denominator.end + 1
        };
    }

    parseRadicalAt(text, index) {
        const source = String(text ?? '');
        if (source.toLowerCase().startsWith('sqrt(', index)) {
            const openIndex = index + 'sqrt'.length;
            const closeIndex = this.findMatchingCloseParen(source, openIndex);
            if (closeIndex === -1) return null;
            return {
                part: {
                    type: 'radical',
                    radicand: this.parseMathExpression(source.slice(openIndex + 1, closeIndex))
                },
                nextIndex: closeIndex + 1
            };
        }
        if (!source.startsWith('\\sqrt', index)) return null;
        let cursor = index + '\\sqrt'.length;
        while (cursor < source.length && /\s/.test(source[cursor])) cursor++;
        if (source[cursor] !== '{') return null;
        const radicand = this.readBracedGroup(source, cursor);
        if (!radicand) return null;
        return {
            part: {
                type: 'radical',
                radicand: this.parseMathExpression(radicand.text)
            },
            nextIndex: radicand.end + 1
        };
    }

    readBracedGroup(text, openIndex) {
        if (text[openIndex] !== '{') return null;

        let depth = 0;
        for (let i = openIndex; i < text.length; i++) {
            if (text[i] === '{') depth++;
            if (text[i] === '}') {
                depth--;
                if (depth === 0) {
                    return {
                        start: openIndex,
                        end: i,
                        text: text.slice(openIndex + 1, i)
                    };
                }
            }
        }

        return null;
    }

    findMatchingOpenParen(text, closeIndex) {
        let depth = 0;
        for (let i = closeIndex; i >= 0; i--) {
            if (text[i] === ')') depth++;
            if (text[i] === '(') {
                depth--;
                if (depth === 0) return i;
            }
        }
        return -1;
    }

    findMatchingCloseParen(text, openIndex) {
        let depth = 0;
        for (let i = openIndex; i < text.length; i++) {
            if (text[i] === '(') depth++;
            if (text[i] === ')') {
                depth--;
                if (depth === 0) return i;
            }
        }
        return -1;
    }

    stripOuterFractionGrouping(text) {
        const trimmed = String(text ?? '').trim();
        if (trimmed.startsWith('(') &&
            trimmed.endsWith(')') &&
            this.findMatchingCloseParen(trimmed, 0) === trimmed.length - 1) {
            return trimmed.slice(1, -1);
        }
        return trimmed;
    }

    isMathNumberChar(char) {
        return /[0-9.]/.test(char);
    }

    isMathIdentifierChar(char) {
        return /[a-zA-Zπ]/.test(char);
    }

    normalizeMathLabelText(text) {
        return String(text ?? '').replace(/-/g, '\u2212');
    }

    /**
     * 수학 표현식 너비 측정
     */
    measureMathExpression(parts, ctx, fontSize) {
        let totalWidth = 0;
        const italicFont = `italic ${fontSize}px "Times New Roman", "STIX Two Math", Georgia, serif`;
        const romanFont = `${fontSize}px "Times New Roman", "STIX Two Math", Georgia, serif`;
        const smallItalicFont = `italic ${fontSize * 0.7}px "Times New Roman", "STIX Two Math", Georgia, serif`;
        const smallRomanFont = `${fontSize * 0.7}px "Times New Roman", "STIX Two Math", Georgia, serif`;

        // 정자체로 표시할 함수명 목록
        const romanFunctions = ['sin', 'cos', 'tan', 'cot', 'sec', 'csc',
            'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh',
            'log', 'ln', 'exp', 'lim', 'max', 'min', 'abs'];

        for (const part of parts) {
            if (part.type === 'radical') {
                const radicalWidth = Math.max(6, fontSize * 0.68);
                const radicandWidth = this.measureMathExpression(part.radicand, ctx, fontSize);
                totalWidth += radicalWidth + radicandWidth + Math.max(2, fontSize * 0.08);
                continue;
            }
            if (part.type === 'fraction') {
                const fractionFontSize = fontSize * 0.72;
                const padding = Math.max(4, fontSize * 0.14);
                const numeratorWidth = this.measureMathExpression(part.numerator, ctx, fractionFontSize);
                const denominatorWidth = this.measureMathExpression(part.denominator, ctx, fractionFontSize);
                totalWidth += Math.max(numeratorWidth, denominatorWidth) + padding * 2;
                continue;
            }

            const text = part.text;
            const isSmall = part.type === 'super' || part.type === 'sub';

            // 함수명 찾아서 정자체로 측정
            let idx = 0;
            while (idx < text.length) {
                let foundFunc = null;
                let funcEnd = idx;

                for (const func of romanFunctions.sort((a, b) => b.length - a.length)) {
                    if (text.slice(idx).toLowerCase().startsWith(func)) {
                        foundFunc = text.slice(idx, idx + func.length);
                        funcEnd = idx + func.length;
                        break;
                    }
                }

                if (foundFunc) {
                    ctx.font = isSmall ? smallRomanFont : romanFont;
                    totalWidth += ctx.measureText(foundFunc).width;
                    idx = funcEnd;
                } else {
                    const char = text[idx];
                    const isLetter = /[a-zA-ZαβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ]/.test(char);

                    if (isSmall) {
                        ctx.font = isLetter ? smallItalicFont : smallRomanFont;
                    } else {
                        ctx.font = isLetter ? italicFont : romanFont;
                    }
                    totalWidth += ctx.measureText(char).width;
                    idx++;
                }
            }
        }

        return totalWidth;
    }

    /**
     * 수학 표현식 렌더링
     * - 변수(x, y, a...) → 이탤릭
     * - 함수명(sin, cos, tan...), 숫자, 연산자, 괄호 → 정자체
     */
    renderMathExpression(parts, ctx, startX, startY, fontSize, color) {
        let currentX = startX;
        const italicFont = `italic ${fontSize}px "Times New Roman", "STIX Two Math", Georgia, serif`;
        const romanFont = `${fontSize}px "Times New Roman", "STIX Two Math", Georgia, serif`;
        const smallItalicFont = `italic ${fontSize * 0.7}px "Times New Roman", "STIX Two Math", Georgia, serif`;
        const smallRomanFont = `${fontSize * 0.7}px "Times New Roman", "STIX Two Math", Georgia, serif`;

        // 정자체로 표시할 함수명 목록
        const romanFunctions = ['sin', 'cos', 'tan', 'cot', 'sec', 'csc',
            'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh',
            'log', 'ln', 'exp', 'lim', 'max', 'min', 'abs'];

        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';

        for (const part of parts) {
            if (part.type === 'radical') {
                const radicalWidth = Math.max(6, fontSize * 0.68);
                const padding = Math.max(2, fontSize * 0.08);
                const radicandWidth = this.measureMathExpression(part.radicand, ctx, fontSize);
                const radicandX = currentX + radicalWidth;
                const topY = startY - fontSize * 0.88;

                ctx.strokeStyle = color;
                ctx.lineWidth = Math.max(1, fontSize * 0.04);
                ctx.beginPath();
                ctx.moveTo(currentX, startY - fontSize * 0.34);
                ctx.lineTo(currentX + radicalWidth * 0.2, startY - fontSize * 0.34);
                ctx.lineTo(currentX + radicalWidth * 0.38, startY - fontSize * 0.06);
                ctx.lineTo(currentX + radicalWidth * 0.64, topY);
                ctx.lineTo(radicandX + radicandWidth + padding * 0.5, topY);
                ctx.stroke();
                this.renderMathExpression(part.radicand, ctx, radicandX, startY, fontSize, color);
                currentX += radicalWidth + radicandWidth + padding;
                continue;
            }
            if (part.type === 'fraction') {
                const fractionFontSize = fontSize * 0.72;
                const padding = Math.max(4, fontSize * 0.14);
                const numeratorWidth = this.measureMathExpression(part.numerator, ctx, fractionFontSize);
                const denominatorWidth = this.measureMathExpression(part.denominator, ctx, fractionFontSize);
                const fractionWidth = Math.max(numeratorWidth, denominatorWidth) + padding * 2;
                const barY = startY - fontSize * 0.32;
                const numeratorX = currentX + (fractionWidth - numeratorWidth) / 2;
                const denominatorX = currentX + (fractionWidth - denominatorWidth) / 2;
                const numeratorBaseline = barY - fontSize * 0.1;
                const denominatorBaseline = barY + fractionFontSize + fontSize * 0.16;

                this.renderMathExpression(part.numerator, ctx, numeratorX, numeratorBaseline, fractionFontSize, color);

                ctx.strokeStyle = color;
                ctx.lineWidth = Math.max(1, fontSize * 0.04);
                ctx.beginPath();
                ctx.moveTo(currentX + padding * 0.5, barY);
                ctx.lineTo(currentX + fractionWidth - padding * 0.5, barY);
                ctx.stroke();

                this.renderMathExpression(part.denominator, ctx, denominatorX, denominatorBaseline, fractionFontSize, color);
                currentX += fractionWidth;
                continue;
            }

            let text = part.text;
            const isSmall = part.type === 'super' || part.type === 'sub';
            const yOffset = part.type === 'super' ? -fontSize * 0.35 :
                part.type === 'sub' ? fontSize * 0.1 : 0;

            // 함수명 찾아서 정자체로 처리
            let idx = 0;
            while (idx < text.length) {
                let foundFunc = null;
                let funcEnd = idx;

                // 함수명 체크 (가장 긴 것부터)
                for (const func of romanFunctions.sort((a, b) => b.length - a.length)) {
                    if (text.slice(idx).toLowerCase().startsWith(func)) {
                        foundFunc = text.slice(idx, idx + func.length);
                        funcEnd = idx + func.length;
                        break;
                    }
                }

                if (foundFunc) {
                    // 함수명은 정자체로
                    ctx.font = isSmall ? smallRomanFont : romanFont;
                    ctx.fillText(foundFunc, currentX, startY + yOffset);
                    currentX += ctx.measureText(foundFunc).width;
                    idx = funcEnd;
                } else {
                    // 개별 문자 처리
                    const char = text[idx];
                    // 단일 알파벳 변수는 이탤릭 (그리스 문자 포함)
                    const isLetter = /[a-zA-ZαβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ]/.test(char);

                    if (isSmall) {
                        ctx.font = isLetter ? smallItalicFont : smallRomanFont;
                    } else {
                        ctx.font = isLetter ? italicFont : romanFont;
                    }

                    ctx.fillText(char, currentX, startY + yOffset);
                    currentX += ctx.measureText(char).width;
                    idx++;
                }
            }
        }
    }

    /**
     * 다각형 그리기
     */
    drawPolygon(vertices, options = {}) {
        const ctx = this.ctx;

        const {
            strokeColor = '#000000',
            fillColor = null,
            width = 2,
            dashed = false,
            close = true
        } = options;

        if (vertices.length < 2) return;

        const screenVerts = vertices.map(v => this.toScreen(v));

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = width;

        if (dashed) {
            ctx.setLineDash([5, 5]);
        } else {
            ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.moveTo(screenVerts[0].x, screenVerts[0].y);

        for (let i = 1; i < screenVerts.length; i++) {
            ctx.lineTo(screenVerts[i].x, screenVerts[i].y);
        }

        if (close) {
            ctx.closePath();
        }

        if (fillColor) {
            ctx.fillStyle = fillColor;
            ctx.fill();
        }
        ctx.stroke();

        ctx.setLineDash([]);
    }
}

export default Canvas;
