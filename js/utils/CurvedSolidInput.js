const CURVED_SOLID_KINDS = new Set(['cylinder', 'cone', 'sphere']);

export function buildCurvedSolidInput(values = {}) {
    const kind = String(values.kind || '');
    if (!CURVED_SOLID_KINDS.has(kind)) {
        throw new Error('지원하지 않는 곡면 입체입니다.');
    }

    const x = Number(values.x);
    const y = Number(values.y);
    const width = Number(values.width);
    const height = Number(values.height);
    const ellipseRatio = values.ellipseRatio === undefined || values.ellipseRatio === ''
        ? 0.28
        : Number(values.ellipseRatio);

    if (![x, y, width, height, ellipseRatio].every(Number.isFinite)) {
        throw new Error('곡면 입체의 위치와 크기를 숫자로 입력하세요.');
    }
    if (width <= 0 || height <= 0) {
        throw new Error('곡면 입체의 너비와 높이는 0보다 커야 합니다.');
    }

    return {
        kind,
        x,
        y,
        width,
        height,
        ellipseRatio: Math.min(0.6, Math.max(0.12, ellipseRatio)),
        showHiddenLines: values.showHiddenLines !== false
    };
}

export default buildCurvedSolidInput;
