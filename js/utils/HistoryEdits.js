/**
 * HistoryEdits.js 역할
 * 속성 패널 등 UI에서 발생하는 단발 속성 편집을
 * "적용 + 히스토리 기록"이 항상 짝을 이루도록 감싸는 순수 유틸입니다.
 *
 * - 이전/새 값을 복제해 저장하므로 이후 객체가 변형돼도 히스토리가 오염되지 않습니다.
 * - 값이 같으면 적용도 기록도 하지 않습니다.
 * - 좌표(setPosition)나 수식(setExpression)처럼 불변식을 지키는 세터가 필요한 경우
 *   apply 콜백으로 주입할 수 있습니다.
 * - 슬라이더/색상 피커처럼 input 이벤트로 이미 라이브 반영된 연속 편집은
 *   시작 시점 값을 oldValue로 넘겨 종료 시점에 한 번만 기록합니다.
 */

function clonePlainValue(value) {
    if (value === null || value === undefined || typeof value !== 'object') {
        return value;
    }
    if (typeof value.clone === 'function') {
        return value.clone();
    }
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value);
        } catch {
            // 복제 불가 객체는 JSON 경로로 폴백한다.
        }
    }
    return JSON.parse(JSON.stringify(value));
}

function valuesEqual(left, right) {
    if (left === right) return true;
    if (left === null || right === null || left === undefined || right === undefined) {
        return false;
    }
    if (typeof left === 'object' && typeof right === 'object') {
        return JSON.stringify(left) === JSON.stringify(right);
    }
    return false;
}

export function readPropertyValue(object, propertyPath) {
    if (!propertyPath.includes('.')) {
        return object?.[propertyPath];
    }
    let current = object;
    for (const key of propertyPath.split('.')) {
        if (current === null || current === undefined) return undefined;
        current = current[key];
    }
    return current;
}

export function writePropertyValue(object, propertyPath, value) {
    if (!propertyPath.includes('.')) {
        object[propertyPath] = value;
        return;
    }
    const path = propertyPath.split('.');
    let current = object;
    for (let i = 0; i < path.length - 1; i++) {
        current = current?.[path[i]];
        if (!current) return;
    }
    current[path[path.length - 1]] = value;
}

/**
 * 속성 변경을 적용하고 히스토리에 기록합니다.
 * @returns {boolean} 실제로 변경·기록됐으면 true
 */
export function applyRecordedPropertyChange({
    object,
    property,
    newValue,
    oldValue,
    historyManager,
    apply
}) {
    if (!object || !property) return false;

    const previous = clonePlainValue(
        oldValue !== undefined ? oldValue : readPropertyValue(object, property)
    );
    const next = clonePlainValue(newValue);

    if (valuesEqual(previous, next)) {
        return false;
    }

    if (typeof apply === 'function') {
        apply(object, newValue);
    } else {
        writePropertyValue(object, property, newValue);
    }

    historyManager?.recordPropertyChange?.(object.id, property, previous, next);
    return true;
}

export default { applyRecordedPropertyChange, readPropertyValue, writePropertyValue };
