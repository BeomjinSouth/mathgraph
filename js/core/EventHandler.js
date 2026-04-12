/**
 * EventHandler.js 역할
 * 이 파일은 캔버스에서 발생하는 마우스와 키보드 입력을 받아
 * 현재 도구에 전달하고, 선택과 삭제 같은 공통 동작을 처리합니다.
 *
 * 이번 변경의 의도는 다음과 같습니다.
 * - 사용자가 요청한 주요 기능 단축키를 추가합니다.
 * - 예시로 제시된 점 D, 선분 S, 이동 V를 실제로 반영합니다.
 * - 입력창에서 타이핑 중일 때 단축키가 실행되지 않도록 기존 규칙은 유지합니다.
 */

import { Vec2 } from '../utils/Geometry.js';

export class EventHandler {
    constructor(app) {
        this.app = app;
        this.canvas = app.canvas;
        this.canvasElement = app.canvasElement;

        // 상태
        this.isDragging = false;
        this.isPanning = false;
        this.dragStartPos = null;
        this.lastMousePos = null;
        this.draggedObject = null;

        // Mk.2: 스페이스바 패닝 상태
        this.spaceKeyDown = false;
        this.panStartScreenPos = null;

        // 클릭 임계값 (픽셀)
        this.clickThreshold = 8;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // 마우스 이벤트 (캔버스 내부)
        this.canvasElement.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvasElement.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvasElement.addEventListener('mouseleave', this.onMouseLeave.bind(this));
        this.canvasElement.addEventListener('wheel', this.onWheel.bind(this));
        this.canvasElement.addEventListener('dblclick', this.onDoubleClick.bind(this));

        // 마우스 이벤트 (document 레벨 - 캔버스 밖에서도 드래그 지원)
        document.addEventListener('mousemove', this.onDocumentMouseMove.bind(this));
        document.addEventListener('mouseup', this.onDocumentMouseUp.bind(this));

        // 컨텍스트 메뉴 방지
        this.canvasElement.addEventListener('contextmenu', e => e.preventDefault());

        // 키보드 이벤트
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));
    }

    /**
     * 마우스 좌표를 캔버스 좌표로 변환
     */
    getMousePos(event) {
        const rect = this.canvasElement.getBoundingClientRect();
        return new Vec2(
            event.clientX - rect.left,
            event.clientY - rect.top
        );
    }

    /**
     * 마우스 다운
     */
    onMouseDown(event) {
        const screenPos = this.getMousePos(event);
        const mathPos = this.canvas.toMath(screenPos);

        this.dragStartPos = screenPos.clone();
        this.panStartScreenPos = screenPos.clone();
        this.lastMousePos = mathPos.clone();

        // 우클릭, 휠클릭, Alt+클릭: 패닝
        if (event.button === 1 || event.button === 2 ||
            (event.button === 0 && event.altKey)) {
            this.isPanning = true;
            this.canvasElement.classList.add('panning');
            return;
        }

        // Mk.2: 스페이스바 누른 상태에서 클릭하면 패닝
        if (this.spaceKeyDown && event.button === 0) {
            this.isPanning = true;
            this.canvasElement.classList.add('panning');
            return;
        }

        // 빈 배경에서 드래그는 도구에 위임 (박스 선택 등)

        // 자석 기능 적용
        const snappedMathPos = this.applyMagnetSnap(mathPos);

        // 현재 도구에 마우스 다운 전달
        const tool = this.app.toolManager?.getCurrentTool();
        if (tool) {
            tool.onMouseDown(snappedMathPos, screenPos, event, this.app);
        }
    }

    /**
     * 자석 스냅 적용
     */
    applyMagnetSnap(mathPos) {
        if (!this.app.settingsManager?.magnetEnabled) {
            return mathPos;
        }
        const step = this.app.settingsManager.magnetStep || 0.5;
        return new Vec2(
            Math.round(mathPos.x / step) * step,
            Math.round(mathPos.y / step) * step
        );
    }

    /**
     * 마우스 이동
     */
    onMouseMove(event) {
        const screenPos = this.getMousePos(event);
        const mathPos = this.canvas.toMath(screenPos);

        // 좌표 표시 업데이트
        this.updateCoordinateDisplay(mathPos);

        // 패닝
        if (this.isPanning && this.dragStartPos) {
            const dx = screenPos.x - this.dragStartPos.x;
            const dy = screenPos.y - this.dragStartPos.y;
            this.canvas.pan(-dx, -dy);
            this.dragStartPos = screenPos.clone();
            this.app.render();
            return;
        }

        // 현재 도구에 마우스 이동 전달
        const tool = this.app.toolManager?.getCurrentTool();
        if (tool) {
            const snappedMathPos = this.applyMagnetSnap(mathPos);
            const delta = this.lastMousePos ? snappedMathPos.sub(this.lastMousePos) : new Vec2(0, 0);
            tool.onMouseMove(snappedMathPos, screenPos, delta, event, this.app);
        }

        this.lastMousePos = mathPos.clone();
    }

    /**
     * Document 레벨 마우스 이동 (캔버스 밖에서도 드래그 지원)
     */
    onDocumentMouseMove(event) {
        // 캔버스 내부면 기존 핸들러가 처리
        const rect = this.canvasElement.getBoundingClientRect();
        const isInsideCanvas = (
            event.clientX >= rect.left && event.clientX <= rect.right &&
            event.clientY >= rect.top && event.clientY <= rect.bottom
        );

        if (isInsideCanvas) {
            return; // 캔버스 내부는 onMouseMove가 처리
        }

        // 캔버스 밖에서 드래그 중일 때만 처리
        if (!this.isPanning && !this.dragStartPos) {
            return;
        }

        const screenPos = new Vec2(
            event.clientX - rect.left,
            event.clientY - rect.top
        );
        const mathPos = this.canvas.toMath(screenPos);

        // 패닝
        if (this.isPanning && this.dragStartPos) {
            const dx = screenPos.x - this.dragStartPos.x;
            const dy = screenPos.y - this.dragStartPos.y;
            this.canvas.pan(-dx, -dy);
            this.dragStartPos = screenPos.clone();
            this.app.render();
            return;
        }

        // 현재 도구에 마우스 이동 전달
        const tool = this.app.toolManager?.getCurrentTool();
        if (tool) {
            const snappedMathPos = this.applyMagnetSnap(mathPos);
            const delta = this.lastMousePos ? snappedMathPos.sub(this.lastMousePos) : new Vec2(0, 0);
            tool.onMouseMove(snappedMathPos, screenPos, delta, event, this.app);
        }

        this.lastMousePos = mathPos.clone();
    }

    /**
     * Document 레벨 마우스 업 (캔버스 밖에서도 드래그 종료 지원)
     */
    onDocumentMouseUp(event) {
        // 캔버스 드래그 중이었다면 종료 처리
        if (this.dragStartPos) {
            const rect = this.canvasElement.getBoundingClientRect();
            const screenPos = new Vec2(
                event.clientX - rect.left,
                event.clientY - rect.top
            );
            const mathPos = this.canvas.toMath(screenPos);

            // 패닝 종료
            if (this.isPanning) {
                this.isPanning = false;
                this.canvasElement.classList.remove('panning');
                // 스페이스바가 여전히 눌려있으면 pan-ready 유지
                if (this.spaceKeyDown) {
                    this.canvasElement.classList.add('pan-ready');
                }
                this.dragStartPos = null;
                this.panStartScreenPos = null;
                return;
            }

            // Mk.2 Fix: 삭제 버튼 등 UI 클릭 시 선택이 해제되는 문제 해결
            // 드래그가 시작된 경우(this.dragStartPos 존재)에만 도구에 mouseUp을 전달합니다.
            // UI 버튼을 단순 클릭한 경우에는 dragStartPos가 null이므로 여기를 타지 않습니다.
            const tool = this.app.toolManager?.getCurrentTool();
            if (tool) {
                tool.onMouseUp(mathPos, screenPos, event, this.app);
            }

            this.dragStartPos = null;
        }
    }

    /**
     * 마우스 이탈 - 드래그 중이면 상태 유지
     */
    onMouseLeave(event) {
        // 드래그 중이면 상태 유지 (document 레벨에서 계속 처리)
        // 하이라이트만 해제
        this.app.objectManager.clearHighlight();
        this.app.render();
    }

    /**
     * 마우스 휠 (확대/축소)
     */
    onWheel(event) {
        event.preventDefault();

        const screenPos = this.getMousePos(event);
        const factor = event.deltaY < 0 ? 1.1 : 0.9;

        this.canvas.zoom(factor, screenPos);
        this.app.render();
        this.app.updateZoomDisplay();
    }

    /**
     * 더블클릭
     */
    onDoubleClick(event) {
        const screenPos = this.getMousePos(event);
        const mathPos = this.canvas.toMath(screenPos);

        const tool = this.app.toolManager?.getCurrentTool();
        if (tool && tool.onDoubleClick) {
            tool.onDoubleClick(mathPos, screenPos, event, this.app);
        }
    }

    /**
     * 키 다운
     */
    onKeyDown(event) {
        // 입력 필드에서는 무시
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }

        // 수정자 키
        const ctrl = event.ctrlKey || event.metaKey;
        const shift = event.shiftKey;

        // Mk2.1: 단축키 IME 대응 (event.code 사용)
        // event.key는 한글 상태에서 'Process' 등으로 나오거나 한글 문자가 나와서 매칭이 어렵습니다.
        // event.code는 키보드 위치 기반이므로 'KeyV' 등으로 일정하게 들어옵니다.
        const code = event.code;

        switch (code) {
            case 'KeyZ':
                if (ctrl && !shift) {
                    event.preventDefault();
                    this.app.historyManager.undo();
                    this.app.render();
                } else if (ctrl && shift) {
                    event.preventDefault();
                    this.app.historyManager.redo();
                    this.app.render();
                }
                break;

            case 'KeyY':
                if (ctrl) {
                    event.preventDefault();
                    this.app.historyManager.redo();
                    this.app.render();
                }
                break;

            case 'Delete':
            case 'Backspace':
                event.preventDefault();
                this.app.deleteSelectedObjects();
                break;

            case 'Escape':
                event.preventDefault();
                this.app.objectManager.clearSelection();
                this.app.toolManager?.getCurrentTool()?.cancel?.(this.app);
                this.app.render();
                break;

            case 'KeyA':
                if (ctrl) {
                    event.preventDefault();
                    // 전체 선택
                    for (const obj of this.app.objectManager.getAllObjects()) {
                        this.app.objectManager.selectObject(obj, true);
                    }
                    this.app.render();
                } else {
                    // Mk2.1: 각도 치수 단축키 (A)
                    this.app.toolManager?.setTool('angleDimension');
                }
                break;

            // Mk.2: 복사 (Ctrl+C) / 원 도구 (C)
            case 'KeyC':
                if (ctrl) {
                    event.preventDefault();
                    this.app.copySelectedObjects?.();
                } else {
                    this.app.toolManager?.setTool('circle');
                }
                break;

            // Mk.2: 붙여넣기 (Ctrl+V) / 선택 도구 (V)
            case 'KeyV':
                if (ctrl) {
                    event.preventDefault();
                    this.app.pasteObjects?.();
                } else {
                    this.app.toolManager?.setTool('select');
                }
                break;

            case 'KeyD':
                if (!ctrl) this.app.toolManager?.setTool('point');
                break;
            case 'KeyS':
                if (!ctrl) this.app.toolManager?.setTool('segment');
                break;
            case 'KeyL':
                if (!ctrl) this.app.toolManager?.setTool('line');
                break;
            case 'KeyR':
                if (!ctrl) this.app.toolManager?.setTool('ray');
                break;
            case 'KeyE':
                // Mk2.1: 길이 치수 단축키 (E)
                if (!ctrl) this.app.toolManager?.setTool('lengthDimension');
                break;
            case 'KeyW':
                // Mk2.1: 벡터 단축키 (W) - E는 길이 치수로 이동
                if (!ctrl) this.app.toolManager?.setTool('vector');
                break;
            case 'KeyF':
                if (!ctrl) this.app.toolManager?.setTool('function');
                break;
            case 'KeyI':
                if (!ctrl) this.app.toolManager?.setTool('intersection');
                break;
            case 'KeyM':
                if (!ctrl) this.app.toolManager?.setTool('midpoint');
                break;
            case 'KeyP':
                if (!ctrl) this.app.toolManager?.setTool('polygon');
                break;
            case 'KeyN':
                if (!ctrl) this.app.toolManager?.setTool('numberLine');
                break;

            // Mk.2: 숨기기/보이기 토글 (H)
            case 'KeyH':
                if (!ctrl) {
                    event.preventDefault();
                    this.app.toggleVisibility?.();
                }
                break;

            // Mk.2: 스페이스바 패닝
            case 'Space':
                if (!this.spaceKeyDown) {
                    event.preventDefault();
                    this.spaceKeyDown = true;
                    this.canvasElement.classList.add('pan-ready');
                }
                break;
        }
    }

    /**
     * 키 업
     */
    onKeyUp(event) {
        // Mk.2: 스페이스바 패닝 해제
        if (event.code === 'Space') {
            this.spaceKeyDown = false;
            this.canvasElement.classList.remove('pan-ready');
            if (this.isPanning) {
                this.isPanning = false;
                this.canvasElement.classList.remove('panning');
            }
        }
    }

    /**
     * 좌표 표시 업데이트
     */
    updateCoordinateDisplay(mathPos) {
        const coordDisplay = document.getElementById('mouseCoords');
        if (coordDisplay) {
            const x = mathPos.x.toFixed(2);
            const y = mathPos.y.toFixed(2);
            coordDisplay.textContent = `(${x}, ${y})`;
        }
    }

    /**
     * Mk.2: 선택된 객체 복사
     */
    copySelectedObjects() {
        const selected = this.app.objectManager.getSelectedObjects();
        if (selected.length === 0) {
            this.app.showToast('복사할 객체를 선택하세요', 'warning');
            return;
        }

        // 선택된 객체와 그 의존 객체들을 JSON으로 저장
        const toCopy = [];
        const addedIds = new Set();

        // 의존성 순서대로 추가
        const addWithDependencies = (obj) => {
            if (addedIds.has(obj.id)) return;

            // 의존 객체 먼저 추가
            for (const depId of obj.dependencies || []) {
                const dep = this.app.objectManager.getObject(depId);
                if (dep && !addedIds.has(depId)) {
                    addWithDependencies(dep);
                }
            }

            toCopy.push(obj.toJSON());
            addedIds.add(obj.id);
        };

        for (const obj of selected) {
            addWithDependencies(obj);
        }

        this.clipboard = toCopy;
        this.app.showToast(`${selected.length}개 객체 복사됨`, 'success');
    }

    /**
     * Mk.2: 클립보드에서 객체 붙여넣기
     */
    pasteObjects() {
        if (!this.clipboard || this.clipboard.length === 0) {
            this.app.showToast('붙여넣을 객체가 없습니다', 'warning');
            return;
        }

        // ID 매핑 (원본 ID -> 새 ID)
        const idMap = new Map();
        const offset = 0.5; // 위치 오프셋

        // 선택 해제
        this.app.objectManager.clearSelection();

        // 각 객체를 새로 생성
        for (const objData of this.clipboard) {
            const newData = { ...objData };

            // 새 ID 생성
            const newId = 'obj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            idMap.set(objData.id, newId);
            newData.id = newId;

            // 새 라벨 생성
            if (newData.label) {
                newData.label = newData.label + "'";
            }

            // 위치 오프셋 적용 (점인 경우)
            if (newData.x !== undefined) {
                newData.x += offset;
                newData.y += offset;
            }

            // 의존성 ID 업데이트
            if (newData.dependencies) {
                newData.dependencies = newData.dependencies.map(depId =>
                    idMap.get(depId) || depId
                );
            }

            // 참조 ID들 업데이트
            const refFields = ['point1Id', 'point2Id', 'point3Id', 'centerId', 'pointOnCircleId',
                'originId', 'directionPointId', 'lineId', 'circleId', 'segmentId',
                'object1Id', 'object2Id', 'baseLineId', 'throughPointId',
                'startPointId', 'endPointId', 'functionId', 'vertexId',
                'line1Id', 'line2Id', 'segment1Id', 'segment2Id'];

            for (const field of refFields) {
                if (newData[field] && idMap.has(newData[field])) {
                    newData[field] = idMap.get(newData[field]);
                }
            }

            // baseVertexIds 배열 처리 (입체도형)
            if (newData.baseVertexIds) {
                newData.baseVertexIds = newData.baseVertexIds.map(id => idMap.get(id) || id);
            }
            if (newData.apexId && idMap.has(newData.apexId)) {
                newData.apexId = idMap.get(newData.apexId);
            }

            // 객체 생성
            const newObj = this.app.objectManager.createFromJSON(newData);
            if (newObj) {
                this.app.objectManager.selectObject(newObj, true);
            }
        }

        this.app.objectManager.updateAll();
        this.app.render();
        this.app.updateSidebar();
        this.app.showToast(`${this.clipboard.length}개 객체 붙여넣기 완료`, 'success');
    }
}

export default EventHandler;
