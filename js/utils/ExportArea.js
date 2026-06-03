export const MIN_EXPORT_AREA_SIZE = 8;

export function normalizeExportAreaRect(start, end, bounds, minSize = MIN_EXPORT_AREA_SIZE) {
    if (!start || !end || !bounds) return null;

    const width = Number(bounds.width);
    const height = Number(bounds.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return null;
    }

    const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value)));
    const x1 = clamp(start.x, 0, width);
    const y1 = clamp(start.y, 0, height);
    const x2 = clamp(end.x, 0, width);
    const y2 = clamp(end.y, 0, height);

    const rect = {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1)
    };

    if (rect.width < minSize || rect.height < minSize) {
        return null;
    }

    return rect;
}

export function scaleExportAreaRect(rect, scale = 1) {
    const safeScale = Number.isFinite(Number(scale)) && Number(scale) > 0 ? Number(scale) : 1;
    return {
        x: Math.round(rect.x * safeScale),
        y: Math.round(rect.y * safeScale),
        width: Math.max(1, Math.round(rect.width * safeScale)),
        height: Math.max(1, Math.round(rect.height * safeScale))
    };
}

export default {
    MIN_EXPORT_AREA_SIZE,
    normalizeExportAreaRect,
    scaleExportAreaRect
};
