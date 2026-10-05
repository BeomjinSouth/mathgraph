const pairKey = pair => pair.slice().sort().join('\0');
const finitePoint = point => Number.isFinite(point?.x) && Number.isFinite(point?.y);

/** Only identities implied by an exact translated prism, not visually equal lengths. */
export function equivalentPrismEdges(prism, points, pair) {
    const base = prism.baseVertexIds || [], top = prism.topVertexIds || [];
    if (base.length < 3 || top.length !== base.length || [...base, ...top].some(id => !finitePoint(points.get(id)))) return [];
    const shift = {x:points.get(top[0]).x-points.get(base[0]).x, y:points.get(top[0]).y-points.get(base[0]).y};
    if (Math.hypot(shift.x,shift.y) < 1e-9 || base.some((id,i) =>
        Math.hypot(points.get(top[i]).x-points.get(id).x-shift.x,points.get(top[i]).y-points.get(id).y-shift.y) > 1e-6)) return [];
    const groups = base.map((id,i) => [[id,base[(i+1)%base.length]],[top[i],top[(i+1)%base.length]]]);
    groups.push(base.map((id,i) => [id,top[i]]));
    return groups.find(group => group.some(edge => pairKey(edge) === pairKey(pair))) || [];
}

export function convexBoundary(points) {
    const sorted = points.filter(finitePoint).slice().sort((a,b) => a.x-b.x || a.y-b.y)
        .filter((point,i,list) => !i || point.x!==list[i-1].x || point.y!==list[i-1].y);
    const cross = (a,b,c) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    const half = list => {const hull=[];for(const point of list){while(hull.length>1 && cross(hull.at(-2),hull.at(-1),point)<=1e-9)hull.pop();hull.push(point);}return hull;};
    if(sorted.length<3)return sorted;
    return [...half(sorted).slice(0,-1),...half(sorted.slice().reverse()).slice(0,-1)];
}

const distanceSegment = (p,a,b) => {
    const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
    return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
};
function onBoundary(pair, hull, points) {
    return hull.some((a,i) => pair.every(id => distanceSegment(points.get(id),a,hull[(i+1)%hull.length])<1e-7));
}

/** Move a new dimension to a mathematically identical outer edge; never move vertices. */
export function preferExteriorPrismDimensions(operations, pinnedIds = new Set(), request = '') {
    const points=new Map(operations.filter(op=>op.op==='create'&&op.type==='point').map(op=>[op.id,op]));
    const prisms=operations.filter(op=>op.op==='create'&&op.type==='prism'&&op.visible!==false);
    const segments=operations.filter(op=>op.op==='create'&&op.type==='segment');
    const used=new Set(operations.map(op=>op.id));
    for(const dimension of operations.filter(op=>op.op==='create'&&op.type==='lengthDimension'&&op.labelOnCurve!==false)) {
        if(pinnedIds.has(dimension.id)||dimension.locked)continue;
        const anchor=segments.find(segment=>segment.id===dimension.segmentId);if(!anchor)continue;
        const original=[anchor.point1Id,anchor.point2Id];
        const named=original.map(id=>points.get(id)?.label).join('');
        if(named && new RegExp(`${named}\\s*에(?:는)?\\s*(?:직접|치수|길이)`).test(request))continue;
        for(const prism of prisms) {
            const group=equivalentPrismEdges(prism,points,original);if(!group.length)continue;
            const hull=convexBoundary([...prism.baseVertexIds,...prism.topVertexIds].map(id=>points.get(id)));
            if(onBoundary(original,hull,points))break;
            const midpoint=pair=>({x:(points.get(pair[0]).x+points.get(pair[1]).x)/2,y:(points.get(pair[0]).y+points.get(pair[1]).y)/2});
            const initial=midpoint(original);
            const candidates=group.filter(pair=>onBoundary(pair,hull,points)).sort((a,b)=>{
                const first=midpoint(a),second=midpoint(b);
                return Math.hypot(first.x-initial.x,first.y-initial.y)-Math.hypot(second.x-initial.x,second.y-initial.y);
            });
            const pair=candidates[0];if(!pair)break;
            let segment=segments.find(segment=>pairKey([segment.point1Id,segment.point2Id])===pairKey(pair));
            if(!segment) {
                const prefix=`${dimension.id}_outer_anchor`;let id=prefix,index=2;while(used.has(id))id=prefix+'_'+index++;
                used.add(id);segment={op:'create',type:'segment',id,point1Id:pair[0],point2Id:pair[1],visible:false,showLabel:false};
                operations.splice(operations.indexOf(dimension),0,segment);segments.push(segment);
            }
            dimension.segmentId=segment.id;
            break;
        }
    }
}
