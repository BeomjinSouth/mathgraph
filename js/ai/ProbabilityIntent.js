import { readConstant, readRequestedXBounds } from './FunctionAreaIntent.js';

export function binomialProbabilities(n, p) {
    const logs = [0];
    for (let i = 1; i <= n; i++) logs[i] = logs[i - 1] + Math.log(i);
    return Array.from({ length: n + 1 }, (_, k) => p === 0 ? Number(k === 0) : p === 1 ? Number(k === n)
        : Math.exp(logs[n] - logs[k] - logs[n - k] + k * Math.log(p) + (n - k) * Math.log1p(-p)));
}

function constantAfter(text, names) {
    const value = text.match(new RegExp(`(?:${names})\\s*(?:은|는|이|가)?\\s*[:=]?\\s*([+\\-\\d.eE/]+)`, 'i'));
    if (!value) return null;
    return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value[1]) ? Number(value[1]) : readConstant(value[1]);
}

export function buildProbabilityOperations(input) {
    const text = String(input || '').normalize('NFKC');
    if (!/정규\s*분포|이항\s*분포|normal\s*distribution|binomial/i.test(text)) return null;
    if (/바꿔|변경|수정|삭제|지워/.test(text)) return null;
    const fail = error => ({ error: `수학 그림 요청: ${error}` });
    if (/\by\s*=|\bf\s*\(x\)|\bg\s*\(x\)/i.test(text) ||
        [...text.matchAll(/정규\s*분포|이항\s*분포|normal\s*distribution|binomial/gi)].length > 1 ||
        [...text.matchAll(/\bB\s*\(/gi)].length > 1 || [...text.matchAll(/평균/g)].length > 1)
        return fail('서로 다른 그림을 함께 요청했습니다. 확률분포별로 요청을 나누어 입력하세요.');
    if (/이항\s*분포|binomial/i.test(text)) {
        const parameters = text.match(/B\s*\(\s*([^,]+),\s*([^)]*)\)/i);
        const n = parameters ? readConstant(parameters[1]) : constantAfter(text, '시행\\s*(?:횟수|수)|n');
        const p = parameters ? readConstant(parameters[2]) : constantAfter(text, '성공\\s*확률|확률|p');
        if (!Number.isInteger(n) || n < 1 || n > 100 || !Number.isFinite(p) || p < 0 || p > 1)
            return fail('이항분포의 시행 횟수(1~100)와 성공 확률(0~1)을 지정하세요. 예: 이항분포 B(10, 1/2).');
        if (/누적|음영|색칠|칠해/.test(text)) return fail('이항분포의 이 요청은 각 값의 확률을 나타내는 그래프를 지원합니다. 누적확률이나 선택 구간의 음영은 별도로 지정해야 합니다.');
        return { operations: [{ op: 'create', id: 'binomial', type: 'statisticalChart', chartKind: 'discrete', x: -5, y: -3,
            width: 10, height: 6, dataValues: binomialProbabilities(n, p), dataLabels: Array.from({ length: n + 1 }, (_, k) => String(k)), label: `B(${n}, ${p})` }] };
    }
    const mean = /표준\s*정규/.test(text) ? 0 : constantAfter(text, '평균|mu');
    const standardDeviation = /표준\s*정규/.test(text) ? 1 : constantAfter(text, '표준\\s*편차|sigma');
    if (!Number.isFinite(mean) || !Number.isFinite(standardDeviation) || standardDeviation <= 0)
        return fail('정규분포의 평균과 양수인 표준편차를 지정하세요. 예: 평균 0, 표준편차 1인 정규분포.');
    const bounds = readRequestedXBounds(text);
    const shaded = /음영|색칠|칠해|넓이/.test(text);
    if (shaded && (!bounds || bounds.xMin >= bounds.xMax)) return fail('음영 구간을 -1<=x<=1처럼 지정하세요.');
    const operations = [{ op: 'create', id: 'normal', type: 'statisticalChart', chartKind: 'normal', x: -5, y: -3,
        width: 10, height: 6, mean, standardDeviation, ...(shaded ? bounds : {}) }];
    return { operations };
}

export function validateProbabilityIntent(data, prompt) {
    const expected = buildProbabilityOperations(prompt);
    if (!expected) return [];
    if (expected.error) return [expected.error];
    const creates = (data?.operations || []).filter(op => op.op === 'create');
    const source = expected.operations[0];
    if (source.chartKind === 'discrete') {
        const matches = creates.some(op => op.type === source.type && op.chartKind === 'discrete' &&
            JSON.stringify(op.dataLabels) === JSON.stringify(source.dataLabels) &&
            op.dataValues?.length === source.dataValues.length && op.dataValues.every((v, i) => Math.abs(v - source.dataValues[i]) < 1e-8));
        return matches ? [] : ['이항분포의 확률 또는 확률변수 값이 요청과 다릅니다.'];
    }
    return creates.some(op => op.type === 'statisticalChart' && op.chartKind === 'normal' &&
        ['mean', 'standardDeviation', 'xMin', 'xMax'].every(key => source[key] === op[key])) ? [] : ['정규분포의 평균·표준편차 또는 음영 구간이 요청과 다릅니다.'];
}
