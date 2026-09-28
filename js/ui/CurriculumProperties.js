import { PatchApplier } from '../ai/PatchApplier.js';
import { validateCurriculumDiagram } from '../objects/CurriculumDiagram.js';

export function appendCurriculumProperties(app, container, object) {
    const fields = object.type === 'annularSector'
        ? [['radius', '바깥 반지름'], ['innerRadius', '안쪽 반지름'], ['startAngle', '시작각 (°)'], ['sweepAngle', '중심각 (°)']]
        : [['width', object.type === 'solidNet' ? '밑면 변 길이' : '너비'], ['height', object.netKind === 'cone' ? '모선 길이' : object.netKind === 'pyramid' ? '옆면 높이' : '높이']];
    if (object.type === 'solidNet') {
        if (object.netKind === 'cube') fields.splice(1, 1);
        if (['cone', 'cylinder'].includes(object.netKind)) { fields.splice(0, 1); fields.push(['radius', '밑면 반지름']); }
        if (object.netKind === 'cuboid') fields.push(['depth', '세로']);
        if (['prism', 'pyramid'].includes(object.netKind)) fields.push(['sideCount', '밑면 변 수']);
    }
    if (object.type === 'statisticalChart') {
        if (object.chartKind === 'normal') {
            fields.push(['mean', '평균'], ['standardDeviation', '표준편차']);
            if (Number.isFinite(object.xMin)) fields.push(['xMin', '음영 시작'], ['xMax', '음영 끝']);
        } else if (object.chartKind === 'scatter') fields.push(['dataX', 'x 자료'], ['dataY', 'y 자료']);
        else fields.push(['dataValues', object.chartKind === 'boxPlot' ? '최소, Q1, 중앙, Q3, 최대' : '자료']);
        if (['histogram', 'frequencyPolygon'].includes(object.chartKind)) fields.push(['binEdges', '계급 경계']);
        if (['bar', 'pie', 'line'].includes(object.chartKind)) fields.push(['dataLabels', '항목']);
    }
    if (object.type === 'vennDiagram') fields.push(['setCount', '집합 수'], ['setExpression', '음영 집합식']);
    const form = document.createElement('div');
    form.className = 'property-row full-width';
    form.dataset.curriculumProperties = '';
    form.style.cssText = 'display:grid;gap:8px;min-width:0';
    const inputs = new Map();
    for (const [field, name] of fields) {
        const label = document.createElement('label'); label.textContent = name;
        const input = document.createElement('input'); input.className = 'prop-input';
        const array = ['dataValues', 'dataX', 'dataY', 'binEdges', 'dataLabels'].includes(field);
        input.type = array || field === 'setExpression' ? 'text' : 'number'; input.step = 'any';
        input.value = array ? (object[field] || []).join(', ') : object[field];
        input.setAttribute('aria-label', name); input.dataset.field = field;
        label.appendChild(input); form.appendChild(label); inputs.set(field, { input, array });
    }
    const error = document.createElement('span'); error.setAttribute('role', 'alert'); error.style.color = '#b91c1c';
    const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn-secondary'; button.textContent = '적용';
    button.addEventListener('click', () => {
        const operation = { op: 'update', id: object.id };
        for (const [field, { input, array }] of inputs) {
            operation[field] = array ? input.value.split(/[,;\n]/).map(v => v.trim()).filter(Boolean)
                .map(v => field === 'dataLabels' ? v : Number(v)) : field === 'setExpression' ? input.value : input.valueAsNumber;
        }
        // Apply arrays together: changing class counts and boundaries must be atomic.
        const current = app.objectManager.getObject(object.id);
        const problems = validateCurriculumDiagram({ ...current.toJSON(), ...operation });
        if (problems.length) { error.textContent = problems.join(' '); return; }
        const result = new PatchApplier(app.objectManager, app.historyManager).apply({ operations: [operation] });
        if (!result.success) { error.textContent = result.errors.join(' '); return; }
        app.render(); app.updateSidebar();
    });
    form.append(error, button); container.appendChild(form);
}
