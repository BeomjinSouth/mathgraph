// Shared screen-space geometry for rendering, picking and dragging annotations.
import { Geometry } from './Geometry.js';
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function segmentDistance(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, n = dx * dx + dy * dy;
    const t = n ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / n)) : 0;
    return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}
export function quadraticAt(a, c, b, t) {
    const u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
        y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}
export function curveDistance(p, { start, control, end }) {
    let previous = start, best = Infinity;
    for (let i = 1; i <= 64; i++) {
        const next = quadraticAt(start, control, end, i / 64);
        best = Math.min(best, segmentDistance(p, previous, next));
        previous = next;
    }
    return best;
}
export function leaderGeometry(box, anchor, curvature, width = 2) {
    const end = anchor;
    const center = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    const n = distance(center, end);
    if (n < 1) return null;
    const normal = { x: -(end.y - center.y) / n, y: (end.x - center.x) / n };
    const control = { x: (center.x + end.x) / 2 + normal.x * curvature,
        y: (center.y + end.y) / 2 + normal.y * curvature };
    const dx = control.x - center.x, dy = control.y - center.y;
    const ratio = Math.max(Math.abs(dx) / (box.w / 2 + 3), Math.abs(dy) / (box.h / 2 + 3));
    if (ratio <= 1) return null;
    const start = { x: center.x + dx / ratio, y: center.y + dy / ratio };
    // Trim the existing curve, rather than moving the arc or changing its identity.
    const gap = Math.max(7, width * 1.5);
    if (distance(start, anchor) <= gap + 2) return null;
    let low = 0, high = 1;
    for (let i = 0; i < 30; i++) {
        const t = (low + high) / 2;
        if (distance(quadraticAt(start, control, anchor, t), anchor) > gap) low = t;
        else high = t;
    }
    const t = (low + high) / 2;
    return { start, control: { x:start.x+t*(control.x-start.x), y:start.y+t*(control.y-start.y) },
        end:quadraticAt(start,control,anchor,t), normal, anchor, gap };
}
export function drawLeader(ctx, curve, color, width) {
    if (!curve) return;
    const { start, control, end } = curve;
    ctx.save();
    ctx.strokeStyle = ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1, width * 0.6);
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(control.x, control.y, end.x, end.y); ctx.stroke();
    const angle = Math.atan2(end.y - control.y, end.x - control.x), size = Math.max(10, ctx.lineWidth * 6);
    ctx.beginPath(); ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - size * Math.cos(angle) + size * 0.42 * Math.sin(angle), end.y - size * Math.sin(angle) - size * 0.42 * Math.cos(angle));
    ctx.lineTo(end.x - size * Math.cos(angle) - size * 0.42 * Math.sin(angle), end.y - size * Math.sin(angle) + size * 0.42 * Math.cos(angle));
    ctx.closePath(); ctx.fill(); ctx.restore();
}

export function boxCorners(box) {
    return [{x:box.x,y:box.y},{x:box.x+box.w,y:box.y},
        {x:box.x+box.w,y:box.y+box.h},{x:box.x,y:box.y+box.h}];
}

/** A label outside a polygon must not straddle one of its sides. */
export function boxOutsidePolygon(box, vertices) {
    if (boxCorners(box).some(p => Geometry.pointInPolygon(p, vertices))) return false;
    for (let i=0;i<vertices.length;i++) {
        const a=vertices[i],b=vertices[(i+1)%vertices.length];
        let low=0,high=1;
        const dx=b.x-a.x,dy=b.y-a.y;
        const constraints=[[-dx,a.x-box.x],[dx,box.x+box.w-a.x],[-dy,a.y-box.y],[dy,box.y+box.h-a.y]];
        let intersects=true;
        for (const [p,q] of constraints) {
            if (p===0) { if(q<0) {intersects=false;break;} continue; }
            const t=q/p;
            if(p<0) low=Math.max(low,t); else high=Math.min(high,t);
            if(low>high) {intersects=false;break;}
        }
        if(intersects) return false;
    }
    return true;
}
