import { FunctionParser } from '../utils/Parser.js';

export const normalizeMathText = source => String(source || '').replace(/[−–—]/g, '-').replace(/π/g, 'pi');

// Read the complete mathematical prefix, including commas inside min/max calls.
// Never accept only the numeric prefix of a malformed or variable expression.
export function readMathExpression(source) {
    let depth = 0, end = 0;
    for (; end < source.length; end++) {
        const ch = source[end];
        if (ch === '(') depth++;
        else if (ch === ')') {
            if (depth === 0) break;
            depth--;
        }
        if ((depth === 0 && /[,;，\n]/.test(ch)) || !/[a-zA-Z0-9π+\-*/%^().,\s]/.test(ch)) break;
        if (depth === 0 && /^\s+(?:[xy]\s*=|[a-z]\s*\(\s*x\s*\)\s*=)/i.test(source.slice(end))) break;
    }
    return source.slice(0, end).trim().replace(/\.$/, '').trim();
}

export function readConstant(expression) {
    try { return FunctionParser.parseConstant(normalizeMathText(expression)); }
    catch { return null; }
}

export function readRequestedXBounds(source) {
    source = normalizeMathText(source);
    const fromTo = source.match(/\bx\s*=\s*([^;\n가-힣=]+?)\s*(?:부터|에서|~|～|\bto\b)\s*(?:x\s*=\s*)?(.+)/i);
    const between = source.match(/([^,;\n가-힣<>=≤]+?)\s*(?:≤|<=|<)\s*x\s*(?:≤|<=|<)\s*(.+)/i);
    const match = fromTo || between;
    if (!match) return null;
    const xMin = readConstant(match[1].trim());
    const xMax = readConstant(readMathExpression(match[2]));
    return xMin === null || xMax === null ? null : { xMin, xMax };
}

export function readHorizontalAreaBoundary(source) {
    source = normalizeMathText(source);
    const assignments = [...source.matchAll(/\by\s*=/gi)];
    const mentionsXAxis = /x축|x-axis/i.test(source);
    if (assignments.length > 1)
        return { error: '두 번째 경계는 하나의 수평선 y=c로 명확하게 적어 주세요.' };
    const assignment = assignments[0];
    const value = assignment ? readConstant(readMathExpression(source.slice(assignment.index + assignment[0].length)))
        : mentionsXAxis ? 0 : null;
    if (assignment && value === null)
        return { error: '수평선 y=c의 경계값에는 변수가 없는 유한한 상수식을 적어 주세요.' };
    if (mentionsXAxis && value !== 0)
        return { error: 'x축과 다른 수평선이 함께 적혀 있어 색칠할 경계가 모호합니다.' };
    return { baselineY: value };
}
