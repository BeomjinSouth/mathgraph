/** Compact only a complete numeric measurement; never rewrite an expression. */
export function compactMeasurementText(text) {
    const match = String(text).match(/^\s*([+-]?\d+(?:\.\d+)?)(?:\s*(°|cm|㎝|mm|㎜|m|rad))?\s*$/i);
    if (!match) return String(text);
    const number = match[1].replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
    return (Number(number) === 0 ? '0' : number) + (match[2] || '');
}

export function formatMeasurement(value, precision) {
    return compactMeasurementText(value.toFixed(precision));
}
