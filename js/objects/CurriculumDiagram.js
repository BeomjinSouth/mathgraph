import { GeoObject } from './GeoObject.js';
import { Vec2 } from '../utils/Geometry.js';
import { parseSetExpression, vennCircles, buildVennRegion } from './VennGeometry.js';

export const CURRICULUM_TYPES = ['statisticalChart', 'annularSector', 'solidNet', 'vennDiagram'];
export const CHART_KINDS = ['bar', 'pie', 'histogram', 'frequencyPolygon', 'boxPlot', 'dotPlot', 'scatter', 'line', 'discrete', 'normal'];
export const NET_KINDS = ['cube', 'cuboid', 'cylinder', 'cone', 'prism', 'pyramid'];
export const CURRICULUM_FIELDS = ['chartKind', 'dataValues', 'dataLabels', 'dataX', 'dataY', 'binEdges',
    'netKind', 'depth', 'sideCount', 'radius', 'innerRadius', 'startAngle', 'sweepAngle', 'showMeasurements', 'setCount', 'setExpression', 'mean', 'standardDeviation', 'xMin', 'xMax'];
const TAU = Math.PI * 2;
const clone = value => JSON.parse(JSON.stringify(value));
const number = value => Number(value.toPrecision(6)).toString();
const finiteList = value => Array.isArray(value) && value.length > 0 && value.length <= 200 && value.every(v => Number.isFinite(v) && Math.abs(v) <= 1e12);
const increasing = values => values.every((v, i) => i === 0 || v > values[i - 1]);

// Used at the schema boundary, on editing, and on project restoration.
export function validateCurriculumDiagram(data) {
    const errors = [];
    if (!CURRICULUM_TYPES.includes(data.type)) return errors;
    for (const key of ['x', 'y']) if (!Number.isFinite(data[key]) || Math.abs(data[key]) > 1e6) errors.push(`${key} 좌표는 절댓값 1000000 이내의 수여야 합니다.`);
    if (data.fillOpacity !== undefined && (!Number.isFinite(data.fillOpacity) || data.fillOpacity < 0 || data.fillOpacity > 1)) errors.push('음영 진하기는 0~1이어야 합니다.');
    for (const key of ['fontSize', 'lineWidth']) if (data[key] !== undefined && (!Number.isFinite(data[key]) || data[key] <= 0 || data[key] > 144)) errors.push(`${key}은 0보다 크고 144 이하여야 합니다.`);
    if (data.showMeasurements !== undefined && typeof data.showMeasurements !== 'boolean') errors.push('치수 표시 여부는 참 또는 거짓이어야 합니다.');
    const positive = key => {
        const label = { width: data.type === 'solidNet' ? '밑면의 변 길이' : '너비',
            height: data.netKind === 'cone' ? '모선 길이' : data.netKind === 'pyramid' ? '옆면 높이' : '높이',
            depth: '세로', radius: '반지름', standardDeviation: '표준편차' }[key] || key;
        if (!Number.isFinite(data[key]) || data[key] <= 0 || data[key] > 1e6) errors.push(`${label} 값은 0보다 크고 1000000 이하여야 합니다.`);
    };
    if (data.type === 'vennDiagram') {
        positive('width'); positive('height');
        if (![2, 3].includes(data.setCount)) errors.push('벤 다이어그램은 두 집합 또는 세 집합을 지원합니다.');
        if (typeof data.setExpression !== 'string' || data.setExpression.length > 200) errors.push('음영 집합식을 200자 이내로 입력하세요.');
        else { try { parseSetExpression(data.setExpression, data.setCount); } catch (error) { errors.push(error.message); } }
    }
    if (data.type === 'annularSector') {
        positive('radius');
        if (!Number.isFinite(data.innerRadius) || data.innerRadius < 0 || data.innerRadius >= data.radius)
            errors.push('안쪽 반지름은 0 이상이고 바깥쪽 반지름보다 작아야 합니다.');
        if (!Number.isFinite(data.startAngle)) errors.push('시작각이 필요합니다.');
        if (!Number.isFinite(data.sweepAngle) || data.sweepAngle <= 0 || data.sweepAngle > 360)
            errors.push('중심각은 0°보다 크고 360° 이하여야 합니다.');
    }
    if (data.type === 'solidNet') {
        if (!NET_KINDS.includes(data.netKind)) errors.push('지원하지 않는 전개도입니다.');
        positive('width'); positive('height');
        if (data.netKind === 'cuboid') positive('depth');
        if (['cylinder', 'cone'].includes(data.netKind)) positive('radius');
        if (data.netKind === 'cone' && data.height <= data.radius) errors.push('원뿔 모선은 밑면 반지름보다 길어야 합니다.');
        if (['prism', 'pyramid'].includes(data.netKind)) {
            if (!Number.isInteger(data.sideCount) || data.sideCount < 3 || data.sideCount > 12)
                errors.push('정다각형의 변 수는 3~12의 정수여야 합니다.');
            if (data.netKind === 'pyramid' && data.height <= data.width / (2 * Math.tan(Math.PI / data.sideCount)))
                errors.push('정각뿔 옆면의 높이는 밑면의 내접원 반지름보다 커야 합니다.');
        }
    }
    if (data.type === 'statisticalChart') {
        positive('width'); positive('height');
        if (!CHART_KINDS.includes(data.chartKind)) errors.push('지원하지 않는 통계 그림입니다.');
        if (data.chartKind === 'normal') {
            if (!Number.isFinite(data.mean) || Math.abs(data.mean) > 1e6) errors.push('평균을 지정하세요.');
            positive('standardDeviation');
            if ((data.xMin !== undefined || data.xMax !== undefined) &&
                (!Number.isFinite(data.xMin) || !Number.isFinite(data.xMax) || data.xMin >= data.xMax)) errors.push('음영 구간은 유한한 두 수로 지정하세요.');
        } else if (data.chartKind === 'scatter') {
            if (!finiteList(data.dataX) || !finiteList(data.dataY) || data.dataX.length !== data.dataY.length)
                errors.push('산점도의 x, y 자료는 같은 개수의 유한한 수여야 합니다.');
        } else {
            if (!finiteList(data.dataValues)) errors.push('자료는 1~200개의 유한한 수여야 합니다.');
            else {
                if (['pie', 'histogram', 'frequencyPolygon'].includes(data.chartKind) && data.dataValues.some(v => v < 0))
                    errors.push('도수와 원그래프 값은 음수일 수 없습니다.');
                if (data.chartKind === 'pie' && data.dataValues.reduce((a, b) => a + b, 0) <= 0)
                    errors.push('원그래프 값의 합은 0보다 커야 합니다.');
                if (data.chartKind === 'discrete' && (data.dataValues.some(v => v < 0 || v > 1) ||
                    Math.abs(data.dataValues.reduce((sum, v) => sum + v, 0) - 1) > 1e-6))
                    errors.push('확률은 0~1이고 전체 확률의 합은 1이어야 합니다.');
                if (data.chartKind === 'boxPlot' && (data.dataValues.length !== 5 || data.dataValues.some((v, i, a) => i && v < a[i - 1])))
                    errors.push('상자그림에는 최솟값, 제1사분위수, 중앙값, 제3사분위수, 최댓값을 오름차순으로 입력하세요.');
                if (['histogram', 'frequencyPolygon'].includes(data.chartKind) &&
                    (!finiteList(data.binEdges) || data.binEdges.length !== data.dataValues.length + 1 || !increasing(data.binEdges)))
                    errors.push('계급 경계는 도수보다 하나 많아야 하며 작은 값부터 나열해야 합니다.');
            }
        }
        if (data.dataLabels !== undefined && (!Array.isArray(data.dataLabels) || data.dataLabels.some(v => typeof v !== 'string' || v.length > 80) ||
            (data.dataLabels.length && data.dataLabels.length !== data.dataValues?.length)))
            errors.push('항목 이름은 값과 같은 개수로 입력하세요.');
    }
    return errors;
}

// Paths use mathematical coordinates, including exact circular arcs. Both export
// and Canvas consume these commands, so holes and dashed folds cannot diverge.
export class CurriculumDiagram extends GeoObject {
    constructor(type, options = {}) {
        super(type, { showLabel: false, fontSize: 17, lineWidth: 2, ...options });
        if (Number.isFinite(options.createdAt)) this.createdAt = options.createdAt;
        this.position = new Vec2(options.x ?? 0, options.y ?? 0);
        this.width = options.width ?? 10;
        this.height = options.height ?? 6;
        this.fillOpacity = options.fillOpacity ?? 0.16;
        this.fillColor = options.fillColor ?? this.color;
        for (const key of CURRICULUM_FIELDS) if (options[key] !== undefined) this[key] = clone(options[key]);
        this.update();
    }

    update() {
        this.errors = validateCurriculumDiagram(this.toJSON());
        this.valid = this.errors.length === 0;
        this.parts = [];
        if (!this.valid) return;
        if (this.type === 'annularSector') this.buildAnnularSector();
        else if (this.type === 'solidNet') { this.buildNet(); if (this.showMeasurements) this.buildNetMeasurements(); }
        else if (this.type === 'vennDiagram') this.buildVenn();
        else this.buildChart();
    }
    path(commands, options = {}) { this.parts.push({ commands, ...options }); }
    line(x1, y1, x2, y2, options = {}) { this.path([['M', x1, y1], ['L', x2, y2]], options); }
    polygon(points, options = {}) { this.path(points.map(([x, y], i) => [i ? 'L' : 'M', x, y]).concat([['Z']]), options); }
    rect(x, y, w, h, options = {}) { this.polygon([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], options); }
    circle(x, y, r, options = {}) { this.path([['M', x + r, y], ['A', x, y, r, 0, TAU], ['Z']], options); }
    text(x, y, text, options = {}) { this.parts.push({ x, y, text: String(text), ...options }); }
    arc(x, y, r, start, sweep, options = {}) {
        this.path([['M', x + r * Math.cos(start), y + r * Math.sin(start)], ['A', x, y, r, start, sweep]], options);
    }

    buildAnnularSector() {
        const start = this.startAngle * Math.PI / 180, sweep = this.sweepAngle * Math.PI / 180;
        const end = start + sweep, r = this.radius, inner = this.innerRadius;
        const commands = [['M', r * Math.cos(start), r * Math.sin(start)], ['A', 0, 0, r, start, sweep]];
        if (this.sweepAngle === 360) commands.push(['Z'], ['M', inner * Math.cos(end), inner * Math.sin(end)]);
        else commands.push(['L', inner * Math.cos(end), inner * Math.sin(end)]);
        if (inner > 0) commands.push(['A', 0, 0, inner, end, -sweep]);
        commands.push(['Z']);
        this.path(commands, { fill: true });
    }

    buildVenn() {
        const circles = vennCircles(this.width, this.height, this.setCount);
        const commands = buildVennRegion(circles, parseSetExpression(this.setExpression, this.setCount), this.width, this.height);
        if (commands.length) this.path(commands, { fill: true, stroke: false });
        this.rect(0, 0, this.width, this.height);
        circles.forEach((c, i) => {
            this.circle(c.x, c.y, c.r);
            const angle = i === 0 ? 2.2 : i === 1 ? 0.94 : -Math.PI / 2;
            this.text(c.x + c.r * 0.75 * Math.cos(angle), c.y + c.r * 0.75 * Math.sin(angle), 'ABC'[i]);
        });
        this.text(0.3, this.height - 0.35, 'U');
    }

    buildChart() {
        const w = this.width, h = this.height, values = this.dataValues || [];
        const labels = this.dataLabels || [];
        if (this.chartKind === 'normal') { this.buildNormalDistribution(); return; }
        if (this.chartKind === 'pie') {
            const r = Math.min(w, h) * 0.4, sum = values.reduce((a, b) => a + b, 0);
            let start = Math.PI / 2;
            values.forEach((value, i) => {
                if (!value) return;
                const sweep = TAU * value / sum;
                this.path([['M', 0, 0], ['L', r * Math.cos(start), r * Math.sin(start)], ['A', 0, 0, r, start, sweep], ['Z']], { fill: true });
                const mid = start + sweep / 2;
                this.text(0.65 * r * Math.cos(mid), 0.65 * r * Math.sin(mid), `${number(100 * value / sum)}%`, { small: true });
                start += sweep;
            });
            values.forEach((value, i) => this.text(r + 0.65, r - i * Math.max(0.5, h / Math.max(1, values.length)), `${labels[i] ?? i + 1}: ${number(value)}`, { align: 'left' }));
            return;
        }
        let x0 = 0, x1 = values.length || 1, y0 = 0, y1 = Math.max(0, ...values) || 1;
        if (['histogram', 'frequencyPolygon'].includes(this.chartKind)) [x0, x1] = [this.binEdges[0], this.binEdges.at(-1)];
        if (this.chartKind === 'frequencyPolygon') {
            x0 -= (this.binEdges[1] - this.binEdges[0]) / 2;
            x1 += (this.binEdges.at(-1) - this.binEdges.at(-2)) / 2;
        }
        if (['boxPlot', 'dotPlot'].includes(this.chartKind)) [x0, x1] = [Math.min(...values), Math.max(...values)];
        if (this.chartKind === 'scatter') {
            x0 = Math.min(0, ...this.dataX); x1 = Math.max(0, ...this.dataX);
            y0 = Math.min(0, ...this.dataY); y1 = Math.max(0, ...this.dataY);
        }
        if (['bar', 'line'].includes(this.chartKind)) y0 = Math.min(0, ...values);
        const density = this.chartKind === 'histogram' && this.binEdges.slice(1).some((v, i) => Math.abs(v - this.binEdges[i] - (this.binEdges[1] - this.binEdges[0])) > 1e-9);
        const heights = density ? values.map((v, i) => v / (this.binEdges[i + 1] - this.binEdges[i])) : values;
        if (density) y1 = Math.max(0, ...heights) || 1;
        const frequencies = new Map();
        if (this.chartKind === 'dotPlot') {
            values.forEach(v => frequencies.set(v, (frequencies.get(v) || 0) + 1));
            y1 = Math.max(...frequencies.values()) + 1;
        }
        if (x0 === x1) { x0 -= 1; x1 += 1; }
        if (y0 === y1) { y0 -= 1; y1 += 1; }
        if (this.chartKind === 'discrete') {
            const power = 10 ** Math.floor(Math.log10(y1 / 5));
            const step = [1, 2, 5, 10].find(v => v * power >= y1 / 5) * power;
            y1 = step * 5;
        }
        if (this.chartKind === 'scatter') { const dx = (x1 - x0) * 0.08, dy = (y1 - y0) * 0.08; x0 -= dx; x1 += dx; y0 -= dy; y1 += dy; }
        const X = v => (v - x0) / (x1 - x0) * w;
        const Y = v => (v - y0) / (y1 - y0) * h;
        const baseline = ['dotPlot', 'boxPlot'].includes(this.chartKind) ? 0 : Y(0);
        this.line(0, baseline, w, baseline);
        if (!['boxPlot', 'dotPlot'].includes(this.chartKind)) {
            this.line(0, 0, 0, h);
            for (let i = 0; i <= 5; i++) {
                const v = y0 + (y1 - y0) * i / 5;
                this.line(-0.1, h * i / 5, 0, h * i / 5);
                this.text(-0.4, h * i / 5, number(v), { align: 'right' });
            }
            if (density) this.text(0, h + 0.5, '도수밀도', { align: 'left' });
        }
        const tick = v => { this.line(X(v), baseline, X(v), baseline - 0.12); this.text(X(v), baseline - 0.65, number(v)); };
        if (['bar', 'line', 'discrete'].includes(this.chartKind)) {
            values.forEach((v, i) => {
                const x = (i + 0.5) * w / values.length;
                if (this.chartKind === 'bar') this.rect(x - w / values.length * 0.35, baseline, w / values.length * 0.7, Y(v) - baseline, { fill: true });
                else {
                    if (this.chartKind === 'discrete') this.line(x, baseline, x, Y(v));
                    else if (i) this.line((i - 0.5) * w / values.length, Y(values[i - 1]), x, Y(v));
                    this.circle(x, Y(v), 0.06, { fill: true, opacity: 1 });
                }
                if (this.chartKind !== 'discrete' || i % Math.ceil(values.length / 11) === 0 || i === values.length - 1)
                    this.text(x, baseline - 0.5, labels[i] ?? i + 1);
                if (this.chartKind !== 'discrete') this.text(x, Y(v) + (v >= 0 ? 0.35 : -0.35), number(v));
            });
        } else if (['histogram', 'frequencyPolygon'].includes(this.chartKind)) {
            this.binEdges.forEach(tick);
            heights.forEach((v, i) => {
                const left = X(this.binEdges[i]), right = X(this.binEdges[i + 1]);
                if (this.chartKind === 'histogram') this.rect(left, baseline, right - left, Y(v) - baseline, { fill: true });
                else {
                    const x = (left + right) / 2;
                    if (i === 0) this.line(X(x0), baseline, x, Y(v));
                    if (i) this.line(X((this.binEdges[i - 1] + this.binEdges[i]) / 2), Y(heights[i - 1]), x, Y(v));
                    if (i === heights.length - 1) this.line(x, Y(v), X(x1), baseline);
                    this.circle(x, Y(v), 0.055, { fill: true, opacity: 1 });
                }
            });
        } else if (this.chartKind === 'boxPlot') {
            const [min, q1, median, q3, max] = values.map(X), y = h / 2;
            this.line(min, y, q1, y); this.line(q3, y, max, y);
            this.rect(q1, y - 0.6, q3 - q1, 1.2, { fill: true });
            for (const x of [min, max]) this.line(x, y - 0.35, x, y + 0.35);
            this.line(median, y - 0.6, median, y + 0.6);
            [...new Set(values)].forEach(tick);
        } else if (this.chartKind === 'dotPlot') {
            [...frequencies].sort((a, b) => a[0] - b[0]).forEach(([v, count]) => {
                tick(v);
                for (let i = 1; i <= count; i++) this.circle(X(v), Y(i), Math.min(0.1, h / (y1 * 4)), { fill: true, opacity: 1 });
            });
        } else if (this.chartKind === 'scatter') {
            for (let i = 0; i <= 5; i++) tick(x0 + (x1 - x0) * i / 5);
            this.dataX.forEach((v, i) => this.circle(X(v), Y(this.dataY[i]), 0.07, { fill: true, opacity: 1 }));
        }
    }

    buildNormalDistribution() {
        const mean = this.mean, sigma = this.standardDeviation, peak = 1 / (sigma * Math.sqrt(2 * Math.PI));
        const low = Math.min(mean - 4 * sigma, this.xMin ?? Infinity), high = Math.max(mean + 4 * sigma, this.xMax ?? -Infinity);
        const X = x => (x - low) / (high - low) * this.width;
        const Y = x => Math.exp(-0.5 * ((x - mean) / sigma) ** 2) * this.height * 0.85;
        this.line(0, 0, this.width, 0); this.line(0, 0, 0, this.height);
        for (let i = 0; i <= 4; i++) this.text(-0.3, this.height * 0.85 * i / 4, Number((peak * i / 4).toPrecision(3)), { align: 'right' });
        const ticks = Array.from({ length: 7 }, (_, i) => mean + (i - 3) * sigma);
        for (const bound of [this.xMin, this.xMax]) if (Number.isFinite(bound) && !ticks.some(x => Math.abs(x - bound) < sigma * 0.15)) ticks.push(bound);
        for (const x of ticks) { this.line(X(x), 0, X(x), -0.1); this.text(X(x), -0.4, number(x)); }
        if (Number.isFinite(this.xMin)) {
            const points = [['M', X(this.xMin), 0]];
            for (let i = 0; i <= 160; i++) { const x = this.xMin + (this.xMax - this.xMin) * i / 160; points.push(['L', X(x), Y(x)]); }
            points.push(['L', X(this.xMax), 0], ['Z']); this.path(points, { fill: true, stroke: false });
            for (const x of [this.xMin, this.xMax]) this.line(X(x), 0, X(x), Y(x), { dashed: true });
        }
        const curve = Array.from({ length: 321 }, (_, i) => { const x = low + (high - low) * i / 320; return [i ? 'L' : 'M', X(x), Y(x)]; });
        this.path(curve);
        this.text(this.width / 2, this.height + 0.4, `μ=${number(mean)}, σ=${number(sigma)}`);
    }

    buildNet() {
        const s = this.width, h = this.height, r = this.radius;
        if (['cube', 'cuboid'].includes(this.netKind)) {
            const d = this.netKind === 'cube' ? s : this.depth, height = this.netKind === 'cube' ? s : h;
            const widths = [s, d, s, d]; let x = 0;
            // Draw outer edges once; shared face edges are dashed folds.
            this.line(0, 0, 0, height); this.line(2 * (s + d), 0, 2 * (s + d), height);
            widths.forEach((width, i) => {
                this.line(x, 0, x + width, 0, { dashed: i === 0 });
                this.line(x, height, x + width, height, { dashed: i === 0 });
                if (i) this.line(x, 0, x, height, { dashed: true });
                x += width;
            });
            for (const [y, sign] of [[0, -1], [height, 1]]) {
                this.line(0, y, 0, y + sign * d); this.line(s, y, s, y + sign * d); this.line(0, y + sign * d, s, y + sign * d);
            }
        } else if (this.netKind === 'cylinder') {
            this.rect(0, 0, TAU * r, h);
            this.circle(Math.PI * r, -r, r); this.circle(Math.PI * r, h + r, r);
        } else if (this.netKind === 'cone') {
            const sweep = TAU * r / h, start = -sweep / 2;
            this.path([['M', 0, 0], ['L', h * Math.cos(start), h * Math.sin(start)], ['A', 0, 0, h, start, sweep], ['Z']]);
            this.circle(h + r, 0, r);
        } else if (this.netKind === 'prism') {
            const n = this.sideCount;
            for (let i = 1; i < n; i++) this.line(i * s, 0, i * s, h, { dashed: true });
            this.line(0, 0, 0, h); this.line(n * s, 0, n * s, h);
            for (const [y, sign] of [[0, -1], [h, 1]]) {
                this.line(0, y, s, y, { dashed: true }); this.line(s, y, n * s, y);
                let x = s, yy = y; const commands = [['M', s, y]];
                for (let i = 1; i < n; i++) { x += s * Math.cos(sign * TAU * i / n); yy += s * Math.sin(sign * TAU * i / n); commands.push(['L', x, yy]); }
                this.path(commands);
            }
        } else {
            const n = this.sideCount, radius = s / (2 * Math.sin(Math.PI / n));
            const vertices = Array.from({ length: n }, (_, i) => [radius * Math.cos(TAU * i / n), radius * Math.sin(TAU * i / n)]);
            vertices.forEach(([x1, y1], i) => {
                const [x2, y2] = vertices[(i + 1) % n];
                const apex = [(x1 + x2) / 2 + (y2 - y1) / s * h, (y1 + y2) / 2 - (x2 - x1) / s * h];
                this.line(x1, y1, x2, y2, { dashed: true });
                this.path([['M', x1, y1], ['L', ...apex], ['L', x2, y2]]);
            });
        }
    }

    buildNetMeasurements() {
        const s = this.width, h = this.height, r = this.radius;
        if (['cube', 'cuboid'].includes(this.netKind)) {
            const d = this.netKind === 'cube' ? s : this.depth;
            this.text(s / 2, -d - 0.35, number(s));
            if (this.netKind === 'cuboid') {
                this.text(-0.35, -d / 2, number(d), { align: 'right' });
                this.text(-0.35, h / 2, number(h), { align: 'right' });
            }
        } else if (this.netKind === 'cylinder') {
            this.text(Math.PI * r, h - 0.35, `${number(2 * r)}π`);
            this.text(-0.35, h / 2, number(h), { align: 'right' });
            this.line(Math.PI * r, -r, Math.PI * r + r, -r);
            this.text(Math.PI * r + r / 2, -r + 0.35, number(r));
        } else if (this.netKind === 'cone') {
            const a = Math.PI * r / h;
            this.text(h / 2 * Math.cos(a), h / 2 * Math.sin(a) + 0.4, number(h));
            this.line(h + r, 0, h + 2 * r, 0);
            this.text(h + 1.5 * r, 0.35, number(r));
        } else if (this.netKind === 'prism') {
            this.text(s / 2, h - 0.35, number(s));
            this.text(this.sideCount * s + 0.35, h / 2, number(h), { align: 'left' });
        } else {
            const radius = s / (2 * Math.sin(Math.PI / this.sideCount));
            const a = Math.PI / this.sideCount, apothem = radius * Math.cos(a);
            this.line(apothem * Math.cos(a), apothem * Math.sin(a), (apothem + h) * Math.cos(a), (apothem + h) * Math.sin(a), { dashed: true });
            this.text((apothem + h / 2) * Math.cos(a) + 0.3, (apothem + h / 2) * Math.sin(a), number(h));
            this.text((apothem - 0.4) * Math.cos(a), (apothem - 0.4) * Math.sin(a), number(s));
        }
    }

    getBounds() {
        const points = [];
        for (const part of this.parts) {
            if (part.text !== undefined) points.push([part.x, part.y]);
            for (const cmd of part.commands || []) {
                if (cmd[0] === 'M' || cmd[0] === 'L') points.push([cmd[1], cmd[2]]);
                if (cmd[0] === 'A') {
                    const [, x, y, r] = cmd;
                    points.push([x - r, y - r], [x + r, y + r]);
                }
            }
        }
        return { minX: this.position.x + Math.min(0, ...points.map(p => p[0])), maxX: this.position.x + Math.max(0, ...points.map(p => p[0])),
            minY: this.position.y + Math.min(0, ...points.map(p => p[1])), maxY: this.position.y + Math.max(0, ...points.map(p => p[1])) };
    }
    screen(canvas, x, y) { return canvas.toScreen({ x: x + this.position.x, y: y + this.position.y }); }
    render(canvas) {
        if (!this.visible || !this.valid) return;
        const ctx = canvas.ctx;
        ctx.save();
        ctx.strokeStyle = this.selected || this.highlighted ? '#f97316' : this.color;
        ctx.lineWidth = this.lineWidth;
        for (const part of this.parts) {
            ctx.setLineDash(part.dashed || this.dashed ? [5, 4] : []);
            if (part.text !== undefined) {
                const p = this.screen(canvas, part.x, part.y);
                ctx.fillStyle = this.color; ctx.font = `${part.small ? this.fontSize * 0.85 : this.fontSize}px sans-serif`;
                ctx.textAlign = part.align || 'center'; ctx.textBaseline = 'middle'; ctx.fillText(part.text, p.x, p.y); continue;
            }
            ctx.beginPath();
            for (const cmd of part.commands) {
                const [kind, x, y, r, start, sweep] = cmd, p = this.screen(canvas, x || 0, y || 0);
                if (kind === 'M') ctx.moveTo(p.x, p.y);
                if (kind === 'L') ctx.lineTo(p.x, p.y);
                if (kind === 'A') ctx.arc(p.x, p.y, canvas.toScreenLength(r), -start, -(start + sweep), sweep > 0);
                if (kind === 'Z') ctx.closePath();
            }
            if (part.fill) { ctx.globalAlpha = part.opacity ?? this.fillOpacity; ctx.fillStyle = this.fillColor; ctx.fill('evenodd'); ctx.globalAlpha = 1; }
            if (part.stroke !== false) ctx.stroke();
        }
        ctx.restore();
    }
    toSVG(canvas) {
        if (!this.visible || !this.valid) return '';
        const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
        const parts = this.parts.map(part => {
            if (part.text !== undefined) {
                const p = this.screen(canvas, part.x, part.y);
                return `<text x="${p.x}" y="${p.y}" text-anchor="${{ left: 'start', right: 'end' }[part.align] || 'middle'}" dominant-baseline="central" font-family="sans-serif" font-size="${part.small ? this.fontSize * 0.85 : this.fontSize}" fill="${esc(this.color)}">${esc(part.text)}</text>`;
            }
            const d = part.commands.map(cmd => {
                const [kind, x, y, r, start, sweep] = cmd, p = this.screen(canvas, x || 0, y || 0);
                if (kind === 'M' || kind === 'L') return `${kind}${p.x},${p.y}`;
                if (kind === 'Z') return 'Z';
                const pieces = Math.ceil(Math.abs(sweep) / Math.PI), radius = canvas.toScreenLength(r);
                return Array.from({ length: pieces }, (_, i) => {
                    const end = start + sweep * (i + 1) / pieces, q = this.screen(canvas, x + r * Math.cos(end), y + r * Math.sin(end));
                    return `A${radius},${radius} 0 0 ${sweep > 0 ? 0 : 1} ${q.x},${q.y}`;
                }).join(' ');
            }).join(' ');
            return `<path d="${d}" fill="${part.fill ? esc(this.fillColor) : 'none'}" fill-opacity="${part.opacity ?? this.fillOpacity}" fill-rule="evenodd" stroke="${part.stroke === false ? 'none' : esc(this.color)}" stroke-width="${this.lineWidth}"${part.dashed || this.dashed ? ' stroke-dasharray="5 4"' : ''}/>`;
        });
        return `<g data-type="${this.type}" data-id="${esc(this.id)}">${parts.join('')}</g>`;
    }
    getPosition() { return this.position.clone(); }
    setPosition(x, y) { this.position = new Vec2(x, y); }
    getDragTargets() { return this.locked ? [] : [this]; }
    containsPoint(point) {
        if (!this.valid) return false;
        if (this.type === 'annularSector') {
            const dx = point.x - this.position.x, dy = point.y - this.position.y, r = Math.hypot(dx, dy);
            const angle = ((Math.atan2(dy, dx) * 180 / Math.PI - this.startAngle) % 360 + 360) % 360;
            return r >= this.innerRadius && r <= this.radius && angle <= this.sweepAngle;
        }
        const b = this.getBounds();
        return point.x >= b.minX && point.x <= b.maxX && point.y >= b.minY && point.y <= b.maxY;
    }
    hitTest(point) { return this.containsPoint(point); }
    isDraggable() { return !this.locked; }
    startDrag(point) { this.dragOffset = this.position.sub(new Vec2(point.x, point.y)); }
    drag(point) { this.position = new Vec2(point.x, point.y).add(this.dragOffset || new Vec2(0, 0)); }
    endDrag() { delete this.dragOffset; }
    getTypeName() { return { statisticalChart: '통계 그림', annularSector: '고리 부채꼴', solidNet: '전개도', vennDiagram: '벤 다이어그램' }[this.type]; }
    getIconClass() { return this.type === 'statisticalChart' ? 'bar_chart' : 'category'; }
    toJSON() {
        const data = { ...super.toJSON(), x: this.position.x, y: this.position.y, width: this.width, height: this.height, fillColor: this.fillColor, fillOpacity: this.fillOpacity };
        for (const key of CURRICULUM_FIELDS) if (this[key] !== undefined) data[key] = clone(this[key]);
        return data;
    }
}
