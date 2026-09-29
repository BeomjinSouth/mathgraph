// Explicit placement pass. Never runs on load, zoom or ordinary point movement.
import { Vec2 } from './Geometry.js';
export function arrangeAnnotations(app, { automatic = false, targetIds = null } = {}) {
    const objects = app.objectManager.getAllObjects(), canvas = app.canvas, history = app.historyManager;
    const edit = (o, key, value) => {
        const old = o[key];
        if (JSON.stringify(old) === JSON.stringify(value)) return;
        history.recordPropertyChange(o.id, key, structuredClone(old), structuredClone(value));
        o[key] = key === 'labelOffset' ? new Vec2(value.x, value.y) : value;
    };
    history.beginTransaction();
    for (const o of objects) {
        if (!o.visible || !o.valid || (targetIds && !targetIds.has(o.id))) continue;
        if (o.type === 'angleDimension' && !automatic) {
            edit(o, 'labelOffset', {x:0,y:0}); edit(o, 'labelPlacement', 'centered');
        } else if (o.type === 'lengthDimension' && !automatic) {
            edit(o, 'labelOffset', {x:0,y:0}); edit(o, 'labelOnCurve', true); edit(o, 'labelT', 0.5);
        } else if (o.getPosition && o.showLabel && o.label && (!automatic || !o.labelPositionFixed)) {
            const p = o.getPosition();
            const neighbors = new Map();
            for (const shape of objects) {
                if (!shape.visible || !shape.valid) continue;
                if (shape.type === 'segment') {
                    const otherId = shape.point1Id === o.id ? shape.point2Id : shape.point2Id === o.id ? shape.point1Id : null;
                    const other = otherId && app.objectManager.getObject(otherId);
                    if (other?.getPosition) neighbors.set(otherId, other.getPosition());
                } else if (shape.type === 'polygon') {
                    const ids = shape.vertexIds, i = ids.indexOf(o.id);
                    if (i >= 0) for (const id of [ids[(i+1)%ids.length], ids[(i+ids.length-1)%ids.length]]) {
                        const other = app.objectManager.getObject(id);
                        if (other?.getPosition) neighbors.set(id, other.getPosition());
                    }
                }
            }
            if (!neighbors.size) continue;
            let dx=0,dy=0;
            for (const q of neighbors.values()) { const n=Math.hypot(q.x-p.x,q.y-p.y); if(n>1e-8){dx-=(q.x-p.x)/n;dy+=(q.y-p.y)/n;} }
            let n=Math.hypot(dx,dy);
            if(n<.1){dx=0;dy=-1;n=1;}
            dx/=n;dy/=n;
            canvas.ctx.save(); canvas.ctx.font=`${o.fontSize}px "Times New Roman", serif`;
            const width=canvas.ctx.measureText(o.label).width;canvas.ctx.restore();
            const radius=Math.abs(dx)*width/2+Math.abs(dy)*o.fontSize/2+8;
            edit(o,'labelOffset',{x:dx*radius-width/2,y:dy*radius+o.fontSize/2});
            if(!automatic) edit(o,'labelPositionFixed',true);
        }
    }
    history.commitTransaction(); app.render();
}
