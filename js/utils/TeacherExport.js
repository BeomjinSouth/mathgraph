export const TEACHER_EXPORT_PRESETS = Object.freeze({
    hwpCompact: Object.freeze({
        label: 'HWP용 · 80 mm · 300 dpi',
        widthMm: 80,
        dpi: 300
    }),
    hwpWide: Object.freeze({
        label: 'HWP용 넓게 · 120 mm · 300 dpi',
        widthMm: 120,
        dpi: 300
    }),
    printHigh: Object.freeze({
        label: '고해상도 · 160 mm · 600 dpi',
        widthMm: 160,
        dpi: 600
    })
});

function positiveFinite(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
}

export function getPhysicalExportPlan({
    widthMm,
    dpi,
    sourceWidth,
    sourceHeight,
    maxPixels = 40_000_000
}) {
    const safeWidthMm = positiveFinite(widthMm);
    const safeDpi = positiveFinite(dpi);
    const safeSourceWidth = positiveFinite(sourceWidth);
    const safeSourceHeight = positiveFinite(sourceHeight);
    const safeMaxPixels = positiveFinite(maxPixels);

    if (!safeWidthMm || !safeDpi || !safeSourceWidth || !safeSourceHeight || !safeMaxPixels) {
        throw new Error('올바른 출력 크기와 DPI를 입력하세요.');
    }

    const width = Math.round(safeWidthMm / 25.4 * safeDpi);
    const height = Math.round(width * safeSourceHeight / safeSourceWidth);
    if (width * height > safeMaxPixels) {
        throw new Error('내보내기 크기가 너무 큽니다. 출력 폭이나 DPI를 낮춰 주세요.');
    }

    return {
        width,
        height,
        scale: width / safeSourceWidth,
        widthMm: safeWidthMm,
        dpi: safeDpi
    };
}
