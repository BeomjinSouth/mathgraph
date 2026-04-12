export class HistoryManager {
    constructor(objectManager) {
        this.objectManager = objectManager;
        this.undoStack = [];
        this.redoStack = [];
        this.maxSize = 100;
        this.pendingAction = null;
        this.listeners = {
            historyChanged: []
        };
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

    getObjectState(obj) {
        if (obj.position) {
            return { x: obj.position.x, y: obj.position.y };
        }
        if (obj.t !== undefined) {
            return { t: obj.t };
        }
        if (obj.angle !== undefined) {
            return { angle: obj.angle };
        }
        if (obj.x !== undefined) {
            return { x: obj.x };
        }
        return {};
    }

    restoreObjectState(obj, state) {
        if (obj.position && state.x !== undefined) {
            obj.position.x = state.x;
            obj.position.y = state.y;
        }
        if (obj.t !== undefined && state.t !== undefined) {
            obj.t = state.t;
        }
        if (obj.angle !== undefined && state.angle !== undefined) {
            obj.angle = state.angle;
        }
        if (obj.x !== undefined && state.x !== undefined) {
            obj.x = state.x;
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
            case 'drag':
                this.undoDrag(action);
                break;
        }

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
            case 'drag':
                this.redoDrag(action);
                break;
        }

        this.undoStack.push(action);

        this.emit('historyChanged', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        });

        return true;
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
            obj[action.property] = action.oldValue;
            this.objectManager.updateObject(action.objectId);
        }
    }

    redoPropertyChange(action) {
        const obj = this.objectManager.getObject(action.objectId);
        if (obj) {
            obj[action.property] = action.newValue;
            this.objectManager.updateObject(action.objectId);
        }
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
            pendingAction: this.cloneValue(this.pendingAction)
        };
    }

    restoreSnapshot(snapshot) {
        if (!snapshot) return;

        this.undoStack = this.cloneValue(snapshot.undoStack || []);
        this.redoStack = this.cloneValue(snapshot.redoStack || []);
        this.pendingAction = this.cloneValue(snapshot.pendingAction || null);

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
