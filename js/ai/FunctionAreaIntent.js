const NUMBER = '([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+))';

export function readRequestedXBounds(source) {
    const fromTo = new RegExp(`x\\s*=\\s*${NUMBER}\\s*(?:부터|에서|~|～|to)\\s*(?:x\\s*=\\s*)?${NUMBER}`, 'i');
    const between = new RegExp(`${NUMBER}\\s*(?:≤|<=|<)\\s*x\\s*(?:≤|<=|<)\\s*${NUMBER}`, 'i');
    const match = source.match(fromTo) || source.match(between);
    return match ? { xMin: Number(match[1]), xMax: Number(match[2]) } : null;
}

export function readHorizontalAreaBoundary(source) {
    const numeric = [...source.matchAll(/\by\s*=\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))(?=$|[\s,;，。가-힣]|\.(?!\d))/gi)];
    const mentionsY = /\by\s*=/i.test(source);
    const mentionsXAxis = /x축|x-axis/i.test(source);
    if (numeric.length > 1 || (mentionsY && numeric.length !== 1))
        return { error: '두 번째 경계는 하나의 수평선 y=c로 명확하게 적어 주세요.' };
    const value = numeric.length ? Number(numeric[0][1]) : mentionsXAxis ? 0 : null;
    if (mentionsXAxis && value !== 0)
        return { error: 'x축과 다른 수평선이 함께 적혀 있어 색칠할 경계가 모호합니다.' };
    return { baselineY: value };
}
