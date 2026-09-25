import { FunctionParser } from '../utils/Parser.js';
import { ObjectManager } from '../core/ObjectManager.js';
import { normalizeMathText, readConstant, readHorizontalAreaBoundary, readRequestedXBounds } from './FunctionAreaIntent.js';

const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(a), Math.abs(b));
const fail = text => ({ error: `구간별 함수 요청: ${text}` });

/** Explicit finite branches, e.g. f(x)={x+1 (-2<=x<0); x^2 (0<=x<=2)}. */
export function readPiecewiseFunctionIntent(message) {
    const source = normalizeMathText(message);
    const assignments = [...source.matchAll(/([a-z])\s*\(\s*x\s*\)\s*=/gi)];
    const names = new Set(assignments.map(match => match[1].toLowerCase()));
    const requested = /구간별|조각별|piecewise/i.test(source) ||
        (assignments.length > 1 && names.size === 1) || /[a-z]\s*\(\s*x\s*\)\s*=\s*\{/.test(source);
    if (!requested) return null;
    if (names.size !== 1) return fail('한 함수의 조각별 식과 구간을 적어 주세요.');
    if (/접선|법선|미분|교점|평행|수직|대칭|이동|회전|최대|최소|tangent/i.test(source))
        return fail('이 요청의 추가 작도 조건은 아직 함께 처리할 수 없습니다.');

    const first = assignments[0];
    let cursor = first.index + first[0].length;
    const intervals = [], stack = [];
    for (let i = cursor; i < source.length; i++) {
        if (source[i] === '(') stack.push(i);
        else if (source[i] === ')' && stack.length) {
            const start = stack.pop();
            const interval = source.slice(start + 1, i).match(/^\s*(.+?)\s*(<=|≤|<)\s*x\s*(<=|≤|<)\s*(.+?)\s*$/i);
            if (interval) intervals.push({ start, end: i + 1, interval });
        }
    }
    if (intervals.length < 2 || intervals.length > 12)
        return fail('각 식 뒤에 유한한 구간을 괄호로 적어 주세요. 예: x+1 (-2<=x<0), x^2 (0<=x<=2).');

    const branches = [];
    for (const { start, end, interval } of intervals) {
        const expression = source.slice(cursor, start).trim().replace(/^[,;{]\s*/, '')
            .replace(/^[a-z]\s*\(\s*x\s*\)\s*=\s*/i, '').trim();
        const xMin = readConstant(interval[1]), xMax = readConstant(interval[4]);
        if (xMin === null || xMax === null || xMin >= xMax)
            return fail('각 구간의 양 끝에는 시작값보다 끝값이 큰 유한한 상수식을 적어 주세요.');
        let evaluate;
        try { evaluate = FunctionParser.parse(expression); }
        catch { return fail('조각별 함수식을 읽을 수 없습니다.'); }
        const yMin = evaluate(xMin), yMax = evaluate(xMax);
        if (![yMin, yMax, evaluate((xMin + xMax) / 2)].every(Number.isFinite))
            return fail('지정한 구간과 끝점에서 함수값을 계산할 수 없습니다.');
        branches.push({ expression, xMin, xMax, leftClosed: interval[2] !== '<',
            rightClosed: interval[3] !== '<', yMin, yMax, evaluate });
        cursor = end;
    }
    const tail = source.slice(cursor).replace(/^\s*}/, '');
    if (/[a-z]\s*\(\s*x\s*\)\s*=|[<>≤≥]/i.test(tail))
        return fail('구간 없이 남은 함수식이나 부등식이 있습니다.');
    branches.sort((a, b) => a.xMin - b.xMin);
    for (let i = 1; i < branches.length; i++) {
        const left = branches[i - 1], right = branches[i];
        if (right.xMin < left.xMax || (right.xMin === left.xMax && left.rightClosed && right.leftClosed && !close(left.yMax, right.yMin)))
            return fail('조각의 정의역이 겹치거나 한 x에 서로 다른 두 함수값이 지정되어 있습니다.');
    }
    const endpoints = [];
    for (const branch of branches) {
        for (const [x, y, closed] of [[branch.xMin, branch.yMin, branch.leftClosed], [branch.xMax, branch.yMax, branch.rightClosed]]) {
            const existing = endpoints.find(point => close(point.x, x) && close(point.y, y));
            if (existing) existing.closed ||= closed;
            else endpoints.push({ x, y, closed });
        }
    }
    const shaded = /색칠|음영|넓이|shad(?:e|ed)|\barea\b/i.test(source);
    const boundary = shaded ? readHorizontalAreaBoundary(tail) : {};
    if (boundary.error) return fail(boundary.error);
    if (shaded && boundary.baselineY === null)
        return fail('색칠할 두 번째 경계로 x축 또는 수평선 y=c를 적어 주세요.');
    const bounds = readRequestedXBounds(tail);
    if (shaded && /\bx\s*=/.test(tail) && !bounds)
        return fail('색칠할 x 구간의 끝값을 읽을 수 없습니다.');
    if (bounds && bounds.xMin >= bounds.xMax) return fail('색칠할 구간의 시작값은 끝값보다 작아야 합니다.');
    const areas = shaded ? branches.map((branch, index) => ({ index,
        xMin: Math.max(branch.xMin, bounds?.xMin ?? -Infinity),
        xMax: Math.min(branch.xMax, bounds?.xMax ?? Infinity) })).filter(area => area.xMin < area.xMax) : [];
    if (shaded && !areas.length) return fail('함수의 정의역 안에 색칠할 구간이 없습니다.');
    if (bounds && (bounds.xMin < branches[0].xMin || bounds.xMax > branches.at(-1).xMax))
        return fail('색칠할 구간이 함수의 정의역 범위를 벗어납니다.');
    return { name: first[1].toLowerCase(), branches, endpoints, areas, baselineY: boundary.baselineY };
}

export function buildPiecewiseFunctionOperations(message) {
    const intent = readPiecewiseFunctionIntent(message);
    if (!intent || intent.error) return intent;
    const { name, branches, endpoints, areas, baselineY } = intent;
    const operations = branches.map((branch, index) => ({ op: 'create', type: 'function',
        id: `${name}_piece_${index + 1}`, label: name, showLabel: false,
        expression: branch.expression, xMin: branch.xMin, xMax: branch.xMax }));
    const manager = new ObjectManager();
    const graphs = branches.map(branch => manager.createFunction(branch.expression, { xMin: branch.xMin, xMax: branch.xMax }));
    for (const area of areas) {
        if (!manager.createFunctionRegion(graphs[area.index].id, null, area.xMin, area.xMax, { baselineY }).valid)
            return fail('색칠 구간에 정의되지 않는 값이나 끊어진 음영 경계가 있습니다.');
        operations.push({ op: 'create', type: 'functionRegion', id: `piece_area_${area.index + 1}`,
            function1Id: operations[area.index].id, xMin: area.xMin, xMax: area.xMax,
            baselineY, fillOpacity: 0.2, showLabel: false });
    }
    endpoints.forEach((point, index) => operations.push({ op: 'create', type: 'point', id: `piece_endpoint_${index + 1}`,
        x: point.x, y: point.y, label: null, showLabel: false, pointSize: 5,
        pointStyle: point.closed ? 'closed' : 'open' }));
    return { operations };
}

export function validatePiecewiseFunctionIntent(message, creates) {
    const intent = readPiecewiseFunctionIntent(message);
    if (!intent) return [];
    if (intent.error) return [intent.error];
    const graphs = creates.filter(op => op.type === 'function');
    const matched = intent.branches.map(branch => graphs.find(graph => {
        if (graph.visible === false || !close(graph.xMin, branch.xMin) || !close(graph.xMax, branch.xMax)) return false;
        try {
            const evaluate = FunctionParser.parse(graph.expression);
            return [0, 0.13, 0.31, 0.5, 0.71, 0.89, 1].every(t => {
                const x = branch.xMin + t * (branch.xMax - branch.xMin);
                return close(evaluate(x), branch.evaluate(x));
            });
        } catch { return false; }
    }));
    const errors = [];
    if (matched.some(graph => !graph) || new Set(matched).size !== intent.branches.length || graphs.length !== matched.length)
        errors.push('구간별 함수의 식·정의역 또는 조각 수가 요청과 다릅니다.');
    const points = creates.filter(op => op.type === 'point' && op.visible !== false && (op.pointSize ?? 4) > 0);
    for (const point of intent.endpoints) {
        const nearby = points.filter(op => close(op.x, point.x) && close(op.y, point.y));
        if (nearby.length !== 1 || nearby[0].pointStyle !== (point.closed ? 'closed' : 'open'))
            errors.push('구간별 함수의 열린 점·닫힌 점 또는 끝점 위치가 요청과 다릅니다.');
    }
    const areas = creates.filter(op => op.type === 'functionRegion');
    if (areas.length !== intent.areas.length || intent.areas.some(area => !areas.some(op =>
        matched[area.index] && op.function1Id === matched[area.index].id && !op.function2Id &&
        close(op.xMin, area.xMin) && close(op.xMax, area.xMax) && close(op.baselineY ?? 0, intent.baselineY) &&
        op.visible !== false && (op.fillOpacity ?? 0.2) > 0)))
        errors.push('구간별 함수의 음영이 요청한 조각·구간·수평 경계와 다릅니다.');
    return [...new Set(errors)];
}
