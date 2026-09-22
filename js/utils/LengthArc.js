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

// Clip the curve itself against the label box, including a dragged label.
// Centered labels still leave two symmetric pieces with mirrored dash phase.
export function lengthArcPieces(arc, box = null) {
    if (!box) return [[arc.start, arc.control, arc.end]];
    const edges = { x: [box.x - .05, box.x + box.width + .05], y: [box.y - .05, box.y + box.height + .05] };
    const cuts = [0, 1];
    for (const axis of ['x', 'y']) {
        const a = arc.start[axis] - 2 * arc.control[axis] + arc.end[axis];
        const b = 2 * (arc.control[axis] - arc.start[axis]);
        for (const edge of edges[axis]) {
            const c = arc.start[axis] - edge;
            const discriminant = b * b - 4 * a * c;
            const roots = Math.abs(a) < 1e-12
                ? Math.abs(b) < 1e-12 ? [] : [-c / b]
                : discriminant < 0 ? [] : [(-b - Math.sqrt(discriminant)) / (2 * a), (-b + Math.sqrt(discriminant)) / (2 * a)];
            cuts.push(...roots.filter(t => t > 0 && t < 1));
        }
    }
    cuts.sort((a, b) => a - b);
    const intervals = [];
    for (let i = 1; i < cuts.length; i++) {
        const from = cuts[i - 1], to = cuts[i];
        if (to - from < 1e-12) continue;
        const p = arc.at((from + to) / 2);
        if (p.x >= edges.x[0] && p.x <= edges.x[1] && p.y >= edges.y[0] && p.y <= edges.y[1]) continue;
        const previous = intervals.at(-1);
        if (previous && Math.abs(previous[1] - from) < 1e-12) previous[1] = to;
        else intervals.push([from, to]);
    }
    return intervals.map(([from, to]) => {
        const start = arc.at(from), end = arc.at(to);
        const control = {};
        for (const axis of ['x', 'y']) {
            control[axis] = start[axis] + (to - from) * ((1 - from) * (arc.control[axis] - arc.start[axis]) + from * (arc.end[axis] - arc.control[axis]));
        }
        return to === 1 && from > 0 ? [end, control, start] : [start, control, end];
    });
}
