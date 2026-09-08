import test from 'node:test';
import assert from 'node:assert/strict';
import { lengthArcGeometry, lengthArcPieces, chooseLengthArcHeight } from '../js/utils/LengthArc.js';
import { LengthDimension } from '../js/objects/Dimension.js';

test('length arcs have the same absolute height and reflection symmetry in every direction', () => {
    for (const end of [{x:200,y:0},{x:60,y:80},{x:-100,y:240}]) {
        const arc = lengthArcGeometry({x:0,y:0},end,24);
        assert.ok(Math.abs(Math.hypot(arc.apex.x-arc.middle.x,arc.apex.y-arc.middle.y)-24)<1e-9);
        for (const t of [.1,.25,.4]) {
            const a=arc.at(t),b=arc.at(1-t);
            const dx=(a.x+b.x)/2-arc.middle.x,dy=(a.y+b.y)/2-arc.middle.y;
            assert.ok(Math.abs(dx*end.x+dy*end.y)<1e-8);
        }
    }
});
test('arc pieces stop outside a centered label gap with mirrored dash direction', () => {
    const arc=lengthArcGeometry({x:0,y:100},{x:200,y:100},24);
    const box={x:85,y:62,width:30,height:28};
    const pieces=lengthArcPieces(arc,box);
    assert.equal(pieces.length,2);
    assert.ok(pieces[0][2].x<85 && pieces[1][2].x>115);
    assert.ok(Math.abs(pieces[0][2].x+pieces[1][2].x-200)<1e-9);
    assert.deepEqual(pieces[0][0],arc.start);
    assert.deepEqual(pieces[1][0],arc.end);
});
test('obstructed arcs lower their height; free arcs retain their default', () => {
    const a={x:0,y:100},b={x:200,y:100};
    assert.equal(chooseLengthArcHeight(a,b,24),24);
    assert.ok(chooseLengthArcHeight(a,b,24,[[{x:70,y:76},{x:130,y:76}]])<24);
});
test('height survives save/load and legacy curvature retains its meaning', () => {
    const dimension=new LengthDimension('s',{arcHeight:-24});
    assert.equal(dimension.curvature,-48);
    dimension.arcHeight=-15;
    assert.equal(new LengthDimension('s',dimension.toJSON()).arcHeight,-15);
    assert.equal(new LengthDimension('s',{curvature:32}).arcHeight,16);
});
