/**
 * Canvas.js - 캔버스 관리 클래스
 * 좌표계, 확대/축소, 이동, 격자 렌더링
 */

import { Vec2, Geometry } from '../utils/Geometry.js';
import { MathUtils } from '../utils/MathUtils.js';

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
        this.backgroundColor = '#ffffff';

        // 그리드 설정
        this.gridColor = '#e5e5e5';
        this.gridMajorColor = '#cccccc';
        this.axisColor = '#333333';

        // 크기 초기화
        this.resize();

        // 리사이즈 이벤트
        window.addEventListener('resize', () => this.resize());
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
        this.ctx.fillStyle = this.backgroundColor;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    /**
     * 격자 그리기
     */
    drawGrid() {
        if (!this.showGrid) return;

        const bounds = this.getVisibleBounds();
        const ctx = this.ctx;

        // 격자 간격 계산 (화면에서 적절한 간격 유지)
        const targetPixelGap = 50;
        const rawGap = targetPixelGap / this.scale;

        // 1, 2, 5, 10, 20, 50... 중 적절한 값 선택
        const possibleGaps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
        let gap = possibleGaps[0];
        for (const g of possibleGaps) {
            if (g >= rawGap) {
                gap = g;
                break;
            }
        }

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

        ctx.strokeStyle = this.axisColor;
        ctx.lineWidth = 1.5;

        // X축
        if (this.showXAxis && bounds.minY <= 0 && bounds.maxY >= 0) {
            ctx.beginPath();
            ctx.moveTo(0, origin.y);
            ctx.lineTo(this.width, origin.y);
            ctx.stroke();

            // 화살표
            ctx.beginPath();
            ctx.moveTo(this.width - 10, origin.y - 5);
            ctx.lineTo(this.width, origin.y);
            ctx.lineTo(this.width - 10, origin.y + 5);
            ctx.stroke();
        }

        // Y축
        if (this.showYAxis && bounds.minX <= 0 && bounds.maxX >= 0) {
            ctx.beginPath();
            ctx.moveTo(origin.x, 0);
            ctx.lineTo(origin.x, this.height);
            ctx.stroke();

            // 화살표
            ctx.beginPath();
            ctx.moveTo(origin.x - 5, 10);
            ctx.lineTo(origin.x, 0);
            ctx.lineTo(origin.x + 5, 10);
            ctx.stroke();
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

        // 간격 계산
        const targetPixelGap = 100;
        const rawGap = targetPixelGap / this.scale;
        const possibleGaps = [0.5, 1, 2, 5, 10, 20, 50, 100];
        let gap = possibleGaps[0];
        for (const g of possibleGaps) {
            if (g >= rawGap) {
                gap = g;
                break;
            }
        }

        ctx.font = '11px "Noto Sans KR", sans-serif';
        ctx.fillStyle = '#666666';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // X축 레이블 (X축이 활성화된 경우에만)
        if (this.showXAxis) {
            const startX = Math.floor(bounds.minX / gap) * gap;
            for (let x = startX; x <= bounds.maxX; x += gap) {
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

                // 레이블
                const label = Number.isInteger(x) ? x.toString() : x.toFixed(1);
                ctx.fillText(label, screenX, labelY);
            }
        }

        // Y축 레이블 (Y축이 활성화된 경우에만)
        if (this.showYAxis) {
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';

            const startY = Math.floor(bounds.minY / gap) * gap;
            for (let y = startY; y <= bounds.maxY; y += gap) {
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

                // 레이블
                const label = Number.isInteger(y) ? y.toString() : y.toFixed(1);
                ctx.fillText(label, labelX, screenY);
            }
        }

        // 원점 O (양쪽 축이 모두 보일 때만)
        if (this.showXAxis && this.showYAxis &&
            bounds.minX <= 0 && bounds.maxX >= 0 &&
            bounds.minY <= 0 && bounds.maxY >= 0) {
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            ctx.fillText('O', origin.x - 5, origin.y + 5);
        }
    }

    /**
     * 점 그리기
     */
    drawPoint(pos, options = {}) {
        const ctx = this.ctx;
        const screen = this.toScreen(pos);

        const {
            radius = 4,
            color = '#6366f1',
            borderColor = '#ffffff',
            borderWidth = 1.5,
            highlighted = false,
            selected = false
        } = options;

        const r = highlighted ? radius + 2 : radius;

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
        ctx.fillStyle = color;
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
            color = '#3b82f6',
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

        const maxDist = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 2;
        const endPoint = origin.add(dir.mul(maxDist));

        this.drawSegment(origin, endPoint, options);
    }

    /**
     * 원 그리기
     */
    drawCircle(center, radius, options = {}) {
        const ctx = this.ctx;
        const screenCenter = this.toScreen(center);
        const screenRadius = this.toScreenLength(radius);

        const {
            color = '#22c55e',
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
        const ctx = this.ctx;
        const s1 = this.toScreen(from);
        const s2 = this.toScreen(to);

        const {
            color = '#ec4899',
            width = 2,
            arrowSize = 10,
            highlighted = false,
            selected = false
        } = options;

        // 선
        this.drawSegment(from, to, { ...options, color, width });

        // 화살표 머리
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
            color = '#333333',
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

        const x = screen.x + offsetX;
        const y = screen.y + offsetY;

        if (backgroundColor) {
            const metrics = ctx.measureText(text);
            const padding = 3;
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

    /**
     * 직각 표시 그리기
     */
    drawRightAngleMarker(vertex, p1, p2, options = {}) {
        const ctx = this.ctx;
        const size = options.size || 12;
        const color = options.color || '#8b5cf6';

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
        const color = options.color || '#8b5cf6';
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
            color = '#f97316',
            width = 2,
            samples = 500,
            highlighted = false,
            selected = false,
            xMin = null,
            xMax = null
        } = options;

        ctx.strokeStyle = color;
        ctx.lineWidth = highlighted ? width + 1 : width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);

        // 도메인 제한 적용
        const drawMinX = xMin !== null ? Math.max(bounds.minX, xMin) : bounds.minX;
        const drawMaxX = xMax !== null ? Math.min(bounds.maxX, xMax) : bounds.maxX;

        if (drawMinX >= drawMaxX) return; // 그릴 범위가 없음

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
            color = '#333333',
            offsetX = 8,
            offsetY = -8,
            backgroundColor = null
        } = options;

        const x = screen.x + offsetX;
        const y = screen.y + offsetY;

        // 수식을 렌더링 가능한 형태로 변환
        const renderedParts = this.parseMathExpression(text, fontSize, color);

        // 배경 그리기
        if (backgroundColor) {
            const totalWidth = this.measureMathExpression(renderedParts, ctx, fontSize);
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
        const parts = [];
        let i = 0;

        while (i < text.length) {
            if (text[i] === '^') {
                // 위첨자
                i++;
                if (text[i] === '{') {
                    // 중괄호로 묶인 경우
                    const end = text.indexOf('}', i);
                    if (end !== -1) {
                        parts.push({ type: 'super', text: text.slice(i + 1, end) });
                        i = end + 1;
                    } else {
                        parts.push({ type: 'super', text: text.slice(i + 1) });
                        break;
                    }
                } else {
                    // 단일 문자
                    parts.push({ type: 'super', text: text[i] || '' });
                    i++;
                }
            } else if (text[i] === '_') {
                // 아래첨자
                i++;
                if (text[i] === '{') {
                    const end = text.indexOf('}', i);
                    if (end !== -1) {
                        parts.push({ type: 'sub', text: text.slice(i + 1, end) });
                        i = end + 1;
                    } else {
                        parts.push({ type: 'sub', text: text.slice(i + 1) });
                        break;
                    }
                } else {
                    parts.push({ type: 'sub', text: text[i] || '' });
                    i++;
                }
            } else if (text[i] === '*') {
                // * 문자는 곱셈 기호로 생략
                i++;
            } else {
                // 일반 텍스트 수집
                let normalText = '';
                while (i < text.length && text[i] !== '^' && text[i] !== '_' && text[i] !== '*') {
                    normalText += text[i];
                    i++;
                }
                if (normalText) {
                    parts.push({ type: 'normal', text: normalText });
                }
            }
        }

        return parts;
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
            strokeColor = '#3b82f6',
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
