import { readConstant } from './FunctionAreaIntent.js';

/** Compare what the annotation actually prints, not parseFloat's numeric prefix.
 * Bare numbers keep the diagram's conventional units: degrees or centimetres.
 */
export function measurementLabelMatches(annotation, expected, actualValue) {
    if (!annotation || annotation.visible === false || annotation.showValue === false ||
        (annotation.type === 'angleDimension' && annotation.label === false)) return false;
    const isAngle = annotation.type === 'angleDimension';
    let displayed;
    if (annotation.customText !== null && annotation.customText !== undefined) {
        if (typeof annotation.customText !== 'string' || !annotation.customText.trim()) return false;
        const text = annotation.customText.trim();
        const unit = text.match(isAngle ? /(°|rad)\s*$/i : /(cm|㎝|mm|㎜|m)\s*$/i);
        const expression = unit ? text.slice(0, unit.index).trim() : text;
        displayed = readConstant(expression);
        if (displayed === null) return false;
        const suffix = unit?.[1].toLowerCase();
        if (isAngle && suffix === 'rad') displayed *= 180 / Math.PI;
        if (!isAngle && ['mm', '㎜'].includes(suffix)) displayed /= 10;
        if (!isAngle && suffix === 'm') displayed *= 100;
    } else {
        if (!Number.isFinite(actualValue)) return false;
        const precision = annotation.precision ?? (isAngle ? 1 : 2);
        if (!Number.isInteger(precision) || precision < 0 || precision > 100) return false;
        // Match the right-angle renderer, which always prints 90° regardless of precision.
        displayed = isAngle && Math.abs(actualValue - 90) < 1e-8 * 180 / Math.PI
            ? 90 : Number(actualValue.toFixed(precision));
    }
    return Number.isFinite(displayed) && Number.isFinite(expected) &&
        Math.abs(displayed - expected) <= 1e-8 * Math.max(1, Math.abs(expected));
}
