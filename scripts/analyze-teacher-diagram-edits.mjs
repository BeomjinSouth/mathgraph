import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

// Compare preserved teacher files, never agent-adjusted working copies.
const root = '지필평가-산출물/도형-기준표-24종';
const directory = `${root}/사용자-수정본-20260914`;
const baseline = 'dd23552';
const latest = new Map();
for (const file of fs.readdirSync(directory).filter(file => file.endsWith('.json'))) {
    const project = JSON.parse(fs.readFileSync(`${directory}/${file}`, 'utf8'));
    const id = file.slice(0, 3);
    if (!latest.has(id) || project.savedAt > latest.get(id).project.savedAt) latest.set(id, { file, project });
}
const upper = [], angles = [], changes = [];
const equal = (a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-6;
    if (a && b && typeof a === 'object' && typeof b === 'object') {
        return [...new Set([...Object.keys(a), ...Object.keys(b)])].every(key => equal(a[key], b[key]));
    }
    return a === b;
};
for (const [id, { file, project }] of [...latest].sort()) {
    const original = JSON.parse(execFileSync('git', ['show', `${baseline}:${root}/프로젝트/${id}.mathgraph.json`], { encoding: 'utf8' }));
    for (const object of project.objects) {
        const before = original.objects.find(item => item.id === object.id);
        if (!before) continue;
        const fields = {};
        for (const key of ['x', 'y', 'labelOffset', 'arcRadius', 'curvature', 'fontSize', 'labelFontSize', 'pointSize', 'visible']) {
            if (!equal(before[key], object[key])) fields[key] = { before: before[key] ?? null, after: object[key] ?? null };
        }
        if (Object.keys(fields).length) changes.push({ id, file, label: object.label, type: object.type, fields });
        if (object.type === 'point' && before.labelOffset?.y === -24 && object.labelOffset?.y > -24) upper.push({ id, y: object.labelOffset.y });
        if (object.type === 'angleDimension') angles.push({ id, radiusChanged: !equal(before.arcRadius, object.arcRadius), labelChanged: !equal(before.labelOffset, object.labelOffset) });
    }
}
console.log(JSON.stringify({ baseline, files: latest.size, upper: { count: upper.length, diagrams: new Set(upper.map(item => item.id)).size, range: [Math.min(...upper.map(item => item.y)), Math.max(...upper.map(item => item.y))] }, angles, changes }, null, 2));
