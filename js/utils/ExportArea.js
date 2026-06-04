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

export function getAreaExportAxisOverlayGeometry(screenRect, origin, scale = 1) {
    if (!screenRect || !origin) {
        return {
            scale: 1,
            rect: null,
            origin: null,
            xAxis: null,
            yAxis: null
        };
    }

    const safeScale = Number.isFinite(Number(scale)) && Number(scale) > 0 ? Number(scale) : 1;
    const rect = scaleExportAreaRect(screenRect, safeScale);
    const originInCrop = {
        x: (Number(origin.x) * safeScale) - rect.x,
        y: (Number(origin.y) * safeScale) - rect.y
    };

    const isInRange = (value, min, max) => (
        Number.isFinite(value) &&
        value >= min &&
        value <= max
    );
    const clamp = (value, min, max) => {
        if (max < min) return min;
        return Math.max(min, Math.min(max, value));
    };

    const lineInset = 11 * safeScale;
    const tipInset = 2 * safeScale;
    const baseInset = 13 * safeScale;
    const halfArrow = 5.5 * safeScale;
    const connectorLength = 32 * safeScale;
    const labelFontSize = 22 * safeScale;

    const xAxis = isInRange(originInCrop.y, 0, rect.height)
        ? {
            line: {
                x1: Math.max(0, rect.width - connectorLength),
                y1: originInCrop.y,
                x2: Math.max(0, rect.width - lineInset),
                y2: originInCrop.y
            },
            arrow: [
                { x: Math.max(0, rect.width - tipInset), y: originInCrop.y },
                { x: Math.max(0, rect.width - baseInset), y: originInCrop.y - halfArrow },
                { x: Math.max(0, rect.width - baseInset), y: originInCrop.y + halfArrow }
            ],
            label: {
                text: 'x',
                x: clamp(rect.width - (17 * safeScale), 0, rect.width),
                y: clamp(originInCrop.y + (10 * safeScale), 4 * safeScale, rect.height - (26 * safeScale)),
                fontSize: labelFontSize,
                baseline: 'top'
            }
        }
        : null;

    const yAxis = isInRange(originInCrop.x, 0, rect.width)
        ? {
            line: {
                x1: originInCrop.x,
                y1: Math.min(rect.height, lineInset),
                x2: originInCrop.x,
                y2: Math.min(rect.height, connectorLength)
            },
            arrow: [
                { x: originInCrop.x, y: Math.max(0, tipInset) },
                { x: originInCrop.x - halfArrow, y: Math.min(rect.height, baseInset) },
                { x: originInCrop.x + halfArrow, y: Math.min(rect.height, baseInset) }
            ],
            label: {
                text: 'y',
                x: clamp(originInCrop.x - (10 * safeScale), 0, rect.width),
                y: clamp(22 * safeScale, 0, rect.height),
                fontSize: labelFontSize,
                baseline: 'bottom'
            }
        }
        : null;

    return {
        scale: safeScale,
        rect,
        origin: originInCrop,
        xAxis,
        yAxis
    };
}

export default {
    MIN_EXPORT_AREA_SIZE,
    normalizeExportAreaRect,
    scaleExportAreaRect,
    getAreaExportAxisOverlayGeometry
};
