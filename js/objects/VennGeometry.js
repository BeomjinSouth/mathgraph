// A small Boolean-expression parser: no JavaScript evaluation or user code.
export function parseSetExpression(source, setCount = 2) {
    const text = String(source || '').replace(/\s/g, '').replace(/∩/g, '&').replace(/∪/g, '|').replace(/\\/g, '-')
        .replace(/\^c|ᶜ/gi, "'");
    if (!text) return () => false;
    let index = 0;
    const atom = () => {
        if (text[index] === '!') { index++; const inner = atom(); return bits => !inner(bits); }
        let result;
        if (text[index] === '(') { index++; result = union(); if (text[index++] !== ')') throw Error('집합식의 괄호가 맞지 않습니다.'); }
        else {
            const token = text[index++];
            if (token === 'U') result = () => true;
            else {
                if (!'ABC'.slice(0, setCount).includes(token) || !token) throw Error('집합식에는 A, B, C와 ∩, ∪, -, !, 괄호를 사용하세요.');
                result = bits => bits[token.charCodeAt(0) - 65];
            }
        }
        while (text[index] === "'") { index++; const prior = result; result = bits => !prior(bits); }
        return result;
    };
    const intersection = () => {
        let left = atom();
        while (text[index] === '&' || text[index] === '-') {
            const op = text[index++], right = atom(), prior = left;
            left = bits => op === '&' ? prior(bits) && right(bits) : prior(bits) && !right(bits);
        }
        return left;
    };
    const union = () => {
        let left = intersection();
        while (text[index] === '|') { index++; const right = intersection(), prior = left; left = bits => prior(bits) || right(bits); }
        return left;
    };
    const predicate = union();
    if (index !== text.length) throw Error('집합식 전체를 해석하지 못했습니다.');
    return predicate;
}

export function vennCircles(width, height, count) {
    const r = Math.min(width / 4, height / (count === 3 ? 3.5 : 2.7));
    const y = height / 2 + (count === 3 ? r * 0.35 : 0);
    const circles = [{ x: width / 2 - r * 0.5, y, r }, { x: width / 2 + r * 0.5, y, r }];
    if (count === 3) circles.push({ x: width / 2, y: y - r * 0.85, r });
    return circles;
}

// Boundaries of Boolean regions in an arrangement of circles, using true arcs.
export function buildVennRegion(circles, predicate, width, height) {
    const TAU = Math.PI * 2, segments = [];
    const inside = (x, y) => predicate(circles.map(c => Math.hypot(x - c.x, y - c.y) < c.r));
    for (const circle of circles) {
        const angles = [0, TAU];
        for (const other of circles) {
            if (other === circle) continue;
            const d = Math.hypot(other.x - circle.x, other.y - circle.y);
            if (d >= circle.r + other.r || d <= Math.abs(circle.r - other.r)) continue;
            const alpha = Math.atan2(other.y - circle.y, other.x - circle.x);
            const beta = Math.acos((circle.r ** 2 + d ** 2 - other.r ** 2) / (2 * circle.r * d));
            angles.push((alpha - beta + TAU) % TAU, (alpha + beta + TAU) % TAU);
        }
        angles.sort((a, b) => a - b);
        for (let i = 0; i < angles.length - 1; i++) {
            const start = angles[i], end = angles[i + 1], mid = (start + end) / 2, epsilon = circle.r * 1e-6;
            const inner = inside(circle.x + (circle.r - epsilon) * Math.cos(mid), circle.y + (circle.r - epsilon) * Math.sin(mid));
            const outer = inside(circle.x + (circle.r + epsilon) * Math.cos(mid), circle.y + (circle.r + epsilon) * Math.sin(mid));
            if (inner === outer) continue;
            const a = inner ? start : end, sweep = inner ? end - start : start - end;
            segments.push({ start: [circle.x + circle.r * Math.cos(a), circle.y + circle.r * Math.sin(a)],
                end: [circle.x + circle.r * Math.cos(a + sweep), circle.y + circle.r * Math.sin(a + sweep)],
                command: ['A', circle.x, circle.y, circle.r, a, sweep] });
        }
    }
    const commands = predicate(circles.map(() => false)) ? [['M', 0, 0], ['L', width, 0], ['L', width, height], ['L', 0, height], ['Z']] : [];
    while (segments.length) {
        let segment = segments.shift();
        const origin = segment.start;
        commands.push(['M', ...origin], segment.command);
        while (Math.hypot(segment.end[0] - origin[0], segment.end[1] - origin[1]) > 1e-7) {
            const next = segments.findIndex(candidate => Math.hypot(candidate.start[0] - segment.end[0], candidate.start[1] - segment.end[1]) < 1e-7);
            if (next < 0) throw Error('집합 영역의 경계를 연결하지 못했습니다.');
            segment = segments.splice(next, 1)[0]; commands.push(segment.command);
        }
        commands.push(['Z']);
    }
    return commands;
}
