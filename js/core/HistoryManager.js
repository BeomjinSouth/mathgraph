export class HistoryManager {
    constructor(objectManager) {
        this.objectManager = objectManager;
        this.undoStack = [];
        this.redoStack = [];
        this.maxSize = 100;
        this.pendingAction = null;
        // 트랜잭션(배치) 상태: 여러 record()를 하나의 undo 단위로 묶기 위한 버퍼입니다.
        this.transactionDepth = 0;
        this.transactionBuffer = null;
        this.listeners = {
            historyChanged: []
        };
    }

    /**
     * 트랜잭션 시작 - 이후 record() 호출은 버퍼에 모였다가 commit 시 하나의 배치로 기록됩니다.
     * 중첩 호출을 지원하며 가장 바깥 commit에서만 실제 기록됩니다.
     */
    beginTransaction() {
        if (this.transactionDepth === 0) {
            this.transactionBuffer = [];
        }
        this.transactionDepth += 1;
    }

    /**
     * 트랜잭션 종료 - 버퍼에 모인 액션을 배치(2개 이상) 또는 단일 액션(1개)으로 기록합니다.
     */
    commitTransaction() {
        if (this.transactionDepth === 0) {
            return;
        }
        this.transactionDepth -= 1;
        if (this.transactionDepth > 0) {
            return;
        }

        const actions = this.transactionBuffer || [];
        this.transactionBuffer = null;

        if (actions.length === 0) {
            return;
        }
        if (actions.length === 1) {
            this.commit(actions[0]);
        } else {
            this.commit({ type: 'batch', actions });
        }
    }

    /**
     * 트랜잭션 취소 - 버퍼를 버리고 아무것도 기록하지 않습니다. (패치 롤백 등에서 사용)
     */
    abortTransaction() {
        this.transactionDepth = 0;
        this.transactionBuffer = null;
    }

    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }

    record(action) {
        // 트랜잭션 중이면 즉시 기록하지 않고 버퍼에 모읍니다.
        if (this.transactionDepth > 0) {
            this.transactionBuffer.push(action);
            return;
        }

        this.commit(action);
    }

    commit(action) {
        this.undoStack.push(action);

        while (this.undoStack.length > this.maxSize) {
            this.undoStack.shift();
        }

        this.redoStack = [];

        this.emit('historyChanged', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        });
    }

    recordCreate(object) {
        this.record({
            type: 'create',
            objectData: object.toJSON()
        });
    }

    recordDelete(objects) {
        const normalized = Array.isArray(objects) ? objects : (objects ? [objects] : []);
        const objectsData = [];
        const seenIds = new Set();

        for (const obj of normalized) {
            if (!obj || seenIds.has(obj.id)) continue;
            seenIds.add(obj.id);
            objectsData.push(obj.toJSON());
        }

        if (objectsData.length === 0) {
            return;
        }

        this.record({
            type: 'delete',
            objectsData
        });
    }

    recordPropertyChange(objectId, property, oldValue, newValue) {
        this.record({
            type: 'propertyChange',
            objectId,
            property,
            oldValue,
            newValue
        });
    }

    recordBatch(actions) {
        const normalized = Array.isArray(actions) ? actions.filter(Boolean) : [];
        if (normalized.length === 0) return;

        this.record({
            type: 'batch',
            actions: normalized
        });
    }

    startDrag(objects) {
        this.pendingAction = {
            type: 'drag',
            objectsData: objects.map(obj => ({
                id: obj.id,
                startState: this.getObjectState(obj)
            }))
        };
    }

    endDrag(objects) {
        if (!this.pendingAction || this.pendingAction.type !== 'drag') return;

        for (const data of this.pendingAction.objectsData) {
            const obj = this.objectManager.getObject(data.id);
            if (obj) {
                data.endState = this.getObjectState(obj);
            }
        }

        const hasChanges = this.pendingAction.objectsData.some(data =>
            JSON.stringify(data.startState) !== JSON.stringify(data.endState)
        );

        if (hasChanges) {
            this.record(this.pendingAction);
        }

        this.pendingAction = null;
    }

    /**
     * 보류 중인 드래그를 기록 없이 종료합니다.
     * restore가 true면 드래그 시작 시점 상태로 객체를 되돌립니다. (포인터 취소 등에서 사용)
     */
    cancelPendingDrag({ restore = true } = {}) {
        const pending = this.pendingAction;
        if (!pending || pending.type !== 'drag') {
            return false;
        }

        if (restore) {
            for (const data of pending.objectsData) {
                const obj = this.objectManager.getObject(data.id);
                if (obj) {
                    this.restoreObjectState(obj, data.startState);
                }
            }
            this.objectManager.updateAll();
        }

        this.pendingAction = null;
        return true;
    }

    /**
     * 드래그 히스토리에 저장할 "권위 있는" 상태를 고릅니다.
     * 제약점(선 위의 점 t, 원 위의 점 angle)과 수직선(y)은 파생 좌표(position)가 아니라
     * 원본 파라미터를 저장해야 undo 후 update()가 올바른 위치를 재계산합니다.
     * 치수(dimension)의 angle은 표시용 파생 상태이므로 타입으로 구분해 제외합니다.
     */
    getObjectState(obj) {
        if (obj.type === 'pointOnObject' && obj.t !== undefined) {
            return { t: obj.t };
        }
        if (obj.type === 'pointOnObject' && obj.angle !== undefined) {
            return { angle: obj.angle };
        }
        if (obj.type === 'numberLine' && obj.y !== undefined) {
            return { y: obj.y };
        }
        if (obj.position) {
            return { x: obj.position.x, y: obj.position.y };
        }
        if (obj.x !== undefined || obj.y !== undefined) {
            return { x: obj.x, y: obj.y };
        }
        return {};
    }

    restoreObjectState(obj, state) {
        if (obj.type === 'pointOnObject' && state.t !== undefined) {
            obj.t = state.t;
            return;
        }
        if (obj.type === 'pointOnObject' && state.angle !== undefined) {
            obj.angle = state.angle;
            return;
        }
        if (obj.type === 'numberLine' && state.y !== undefined) {
            obj.y = state.y;
            return;
        }
        if (obj.position && state.x !== undefined) {
            if (typeof obj.setPosition === 'function') {
                obj.setPosition(state.x, state.y);
            } else {
                obj.position.x = state.x;
                obj.position.y = state.y;
            }
            return;
        }
        if (obj.x !== undefined && state.x !== undefined) {
            obj.x = state.x;
        }
        if (obj.y !== undefined && state.y !== undefined) {
            obj.y = state.y;
        }
    }

    canUndo() {
        return this.undoStack.length > 0;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }

    undo() {
        if (!this.canUndo()) return false;

        const action = this.undoStack.pop();
        this.undoAction(action);
        this.redoStack.push(action);

        this.emit('historyChanged', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        });

        return true;
    }

    redo() {
        if (!this.canRedo()) return false;

        const action = this.redoStack.pop();
        this.redoAction(action);
        this.undoStack.push(action);

        this.emit('historyChanged', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        });

        return true;
    }

    /**
     * 단일 액션 undo 디스패치 (배치의 자식 액션도 이 경로를 재사용합니다).
     */
    undoAction(action) {
        switch (action.type) {
            case 'create':
                this.undoCreate(action);
                break;
            case 'delete':
                this.undoDelete(action);
                break;
            case 'propertyChange':
                this.undoPropertyChange(action);
                break;
            case 'batch':
                this.undoBatch(action);
                break;
            case 'drag':
                this.undoDrag(action);
                break;
        }
    }

    /**
     * 단일 액션 redo 디스패치 (배치의 자식 액션도 이 경로를 재사용합니다).
     */
    redoAction(action) {
        switch (action.type) {
            case 'create':
                this.redoCreate(action);
                break;
            case 'delete':
                this.redoDelete(action);
                break;
            case 'propertyChange':
                this.redoPropertyChange(action);
                break;
            case 'batch':
                this.redoBatch(action);
                break;
            case 'drag':
                this.redoDrag(action);
                break;
        }
    }

    undoCreate(action) {
        this.objectManager.removeObject(action.objectData.id, false);
    }

    redoCreate(action) {
        const obj = this.objectManager.createFromJSON(action.objectData);
        if (obj) {
            obj.id = action.objectData.id;
            this.objectManager.addObject(obj);
        }
    }

    undoDelete(action) {
        const restoredOrder = this.getRestoreOrder(action.objectsData);

        for (const data of restoredOrder) {
            const obj = this.objectManager.createFromJSON(data);
            if (obj) {
                obj.id = data.id;
                this.objectManager.addObject(obj);
            }
        }
    }

    redoDelete(action) {
        for (const data of [...action.objectsData].reverse()) {
            this.objectManager.removeObject(data.id, false);
        }
    }

    undoPropertyChange(action) {
        const obj = this.objectManager.getObject(action.objectId);
        if (obj) {
            this.setPropertyValue(obj, action.property, action.oldValue);
            this.objectManager.updateObject(action.objectId);
        }
    }

    redoPropertyChange(action) {
        const obj = this.objectManager.getObject(action.objectId);
        if (obj) {
            this.setPropertyValue(obj, action.property, action.newValue);
            this.objectManager.updateObject(action.objectId);
        }
    }

    undoBatch(action) {
        // 자식 액션을 역순으로 되돌립니다 (create/delete/propertyChange/drag 모두 지원).
        for (const childAction of [...action.actions].reverse()) {
            this.undoAction(childAction);
        }
    }

    redoBatch(action) {
        // 자식 액션을 정순으로 다시 적용합니다.
        for (const childAction of action.actions) {
            this.redoAction(childAction);
        }
    }

    setPropertyValue(target, propertyPath, value) {
        // 위치/수식은 런타임 상태(Vec2, 파서)를 재구축하는 세터를 통해 복원해야 한다.
        // 단순 대입은 Vec2를 평범한 객체로, 함수 파서를 낡은 상태로 남겨 이후 편집을 깨뜨린다.
        if (propertyPath === 'position' &&
            typeof target.setPosition === 'function' &&
            value && value.x !== undefined && value.y !== undefined) {
            target.setPosition(value.x, value.y);
            return;
        }
        if (propertyPath === 'expression' && typeof target.setExpression === 'function') {
            target.setExpression(value);
            return;
        }

        if (!propertyPath.includes('.')) {
            target[propertyPath] = value;
            return;
        }

        const path = propertyPath.split('.');
        let current = target;
        for (let i = 0; i < path.length - 1; i++) {
            current = current?.[path[i]];
            if (!current) {
                return;
            }
        }

        current[path[path.length - 1]] = value;
    }

    undoDrag(action) {
        for (const data of action.objectsData) {
            const obj = this.objectManager.getObject(data.id);
            if (obj) {
                this.restoreObjectState(obj, data.startState);
            }
        }
        this.objectManager.updateAll();
    }

    redoDrag(action) {
        for (const data of action.objectsData) {
            const obj = this.objectManager.getObject(data.id);
            if (obj) {
                this.restoreObjectState(obj, data.endState);
            }
        }
        this.objectManager.updateAll();
    }

    createSnapshot() {
        return {
            undoStack: this.cloneValue(this.undoStack),
            redoStack: this.cloneValue(this.redoStack),
            pendingAction: this.cloneValue(this.pendingAction),
            transactionDepth: this.transactionDepth,
            transactionBuffer: this.cloneValue(this.transactionBuffer)
        };
    }

    restoreSnapshot(snapshot) {
        if (!snapshot) return;

        this.undoStack = this.cloneValue(snapshot.undoStack || []);
        this.redoStack = this.cloneValue(snapshot.redoStack || []);
        this.pendingAction = this.cloneValue(snapshot.pendingAction || null);
        this.transactionDepth = Number.isInteger(snapshot.transactionDepth)
            ? snapshot.transactionDepth
            : 0;
        this.transactionBuffer = this.cloneValue(snapshot.transactionBuffer ?? null);

        this.emit('historyChanged', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        });
    }

    getRestoreOrder(objectsData) {
        const pending = Array.isArray(objectsData) ? objectsData.slice() : [];
        const deletedIds = new Set(pending.map(data => data.id));
        const restoredIds = new Set();
        const ordered = [];

        while (pending.length > 0) {
            let progress = false;

            for (let i = 0; i < pending.length; i++) {
                const data = pending[i];
                const dependencies = Array.isArray(data.dependencies) ? data.dependencies : [];
                const canRestore = dependencies.every(depId => !deletedIds.has(depId) || restoredIds.has(depId));

                if (canRestore) {
                    ordered.push(data);
                    restoredIds.add(data.id);
                    pending.splice(i, 1);
                    progress = true;
                    break;
                }
            }

            if (!progress) {
                ordered.push(...pending);
                break;
            }
        }

        return ordered;
    }

    cloneValue(value) {
        if (value === null || value === undefined) {
            return value;
        }

        if (typeof structuredClone === 'function') {
            return structuredClone(value);
        }

        return JSON.parse(JSON.stringify(value));
    }

    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.pendingAction = null;

        this.emit('historyChanged', {
            canUndo: false,
            canRedo: false
        });
    }
}

export default HistoryManager;
