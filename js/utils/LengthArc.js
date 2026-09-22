// Heights are perpendicular distances from the segment to the arc's apex,
// in logical canvas pixels, independent of the segment's length or direction.
export const DEFAULT_LENGTH_ARC_HEIGHT = 24;

export function lengthArcGeometry(start, end, height = DEFAULT_LENGTH_ARC_HEIGHT) {
    const dx = end.x - start.x, dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (!length) return null;
    const normal = { x: dy / length, y: -dx / length };
    const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const control = { x: middle.x + 2 * height * normal.x, y: middle.y + 2 * height * normal.y };
    const at = t => ({
        x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x,
        y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y
    });
    return { start, end, control, length, height, normal, middle, apex: at(.5), at };
}

function distanceToSegment(point, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
}

export function chooseLengthArcHeight(start, end, preferred, obstacles = [], clearance = 4) {
    const candidates = [1, .85, .7, .55, .4].map(factor => preferred * factor);
    let best = candidates[0], bestScore = Infinity;
    for (const height of candidates) {
        const arc = lengthArcGeometry(start, end, height);
        if (!arc) return 0;
        let score = 0;
        // Converging lines at a shared endpoint are intentional. Judge the
        // usable middle of the arc, not that unavoidable endpoint contact.
        for (let step = 8; step <= 32; step++) {
            const point = arc.at(step / 40);
            for (const [a, b] of obstacles) {
                const distance = distanceToSegment(point, a, b);
                if (distance < clearance) score += clearance - distance;
            }
        }
        if (score < bestScore) { best = height; bestScore = score; }
        if (score === 0) break;
    }
    return best;
}

// Two actual sub-curves, not a white rectangle painted over the geometry.
// Their gap is symmetric about the apex and contains the horizontal label box.
export function lengthArcPieces(arc, box = null) {
    if (!box) return [[arc.start, arc.control, arc.end]];
    let half = 0;
    for (let step = 0; step <= 499; step++) {
        const delta = step / 1000;
        const points = [arc.at(.5 - delta), arc.at(.5 + delta)];
        const outside = points.every(p => p.x < box.x || p.x > box.x + box.width || p.y < box.y || p.y > box.y + box.height);
        if (outside) { half = delta; break; }
        half = .499;
    }
    const t = .5 - half;
    if (t <= .001) return [];
    const leftControl = { x: arc.start.x + t * (arc.control.x - arc.start.x), y: arc.start.y + t * (arc.control.y - arc.start.y) };
    const rightControl = { x: arc.end.x + t * (arc.control.x - arc.end.x), y: arc.end.y + t * (arc.control.y - arc.end.y) };
    // Draw both from the endpoints toward the gap so the dash phase mirrors.
    return [[arc.start, leftControl, arc.at(t)], [arc.end, rightControl, arc.at(1 - t)]];
}
