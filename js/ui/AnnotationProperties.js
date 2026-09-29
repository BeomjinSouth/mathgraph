/** Native labelled controls share the application's property history path. */
export function appendAnnotationProperties(app, container, obj) {
    const add = (key, label, { options, min, max, step = 1, boolean = false } = {}) => {
        const row = document.createElement('div');
        row.className = 'property-row';
        const caption = document.createElement('label');
        const input = document.createElement(options ? 'select' : 'input');
        input.id = `annotation-${key}`;
        caption.htmlFor = input.id;
        caption.textContent = label;
        input.className = options ? 'prop-select' : 'prop-input';
        if (options) {
            for (const [value, text] of options) input.add(new Option(text, value));
        } else {
            input.type = boolean ? 'checkbox' : 'number';
            if (!boolean) {
                if (min !== undefined) input.min = min;
                if (max !== undefined) input.max = max;
                input.step = step;
            }
        }
        if (boolean) input.checked = obj[key];
        else input.value = obj[key];
        input.addEventListener('change', () => {
            const value = boolean ? input.checked : options ? input.value : Number(input.value);
            if (!boolean && !options && (input.value.trim() === '' || !Number.isFinite(value) ||
                (min !== undefined && value < min) || (max !== undefined && value > max) ||
                (step === 1 && !Number.isInteger(value)))) {
                input.value = obj[key];
                app.showToast('입력 범위에 맞는 숫자를 입력하세요.', 'warning');
                return;
            }
            app.recordObjectPropertyEdit(obj, key, value);
            app.render();
        });
        row.append(caption, input);
        container.appendChild(row);
        return input;
    };

    if (['angleDimension', 'lengthDimension', 'coordinateGuides'].includes(obj.type)) {
        add('showValue', '값 표시', { boolean: true });
    }
    if (obj.type === 'lengthDimension') {
        add('lineStyle', '치수선', { options: [['dashed', '점선'], ['dotted', '가는 점선'], ['solid', '실선']] });
        const curvature = add('curvature', '휨 (px)', { step: 0.5 });
        const flip = document.createElement('button');
        flip.type = 'button';
        flip.className = 'btn-small';
        flip.textContent = '길이 호 방향 뒤집기';
        flip.addEventListener('click', () => {
            app.recordObjectPropertyEdit(obj, 'curvature', -obj.curvature);
            curvature.value = obj.curvature;
            app.render();
        });
        container.appendChild(flip);
    }
    if (obj.type === 'angleDimension') {
        add('markerCount', '같은 각 빗금', { min: 0, max: 12 });
        add('arcCount', '호 개수', { min: 1, max: 3 });
        add('arcRadius', '호 반지름', { min: 0.05, max: 20, step: 0.05 });
    }
    if (['equalLengthMarker', 'parallelMarker'].includes(obj.type)) {
        add('tickCount', obj.type === 'parallelMarker' ? '화살표 개수' : '빗금 개수', { min: 1, max: 12 });
    }
    if (['equalLengthMarker', 'parallelMarker', 'rightAngleMarker'].includes(obj.type)) {
        add('size', '표시 크기', { min: 2, max: 40 });
    }
    if (obj.type === 'coordinateGuides') {
        add('showX', 'x축까지 표시', { boolean: true });
        add('showY', 'y축까지 표시', { boolean: true });
        add('precision', '소수 자릿수', { min: 0, max: 4 });
        add('labelFontSize', '글씨 크기', { min: 8, max: 60 });
    }
}
