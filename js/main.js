/**
 * main.js 역할
 * 이 파일은 그래프A 앱의 "중앙 조립" 파일입니다.
 * Canvas, ObjectManager, HistoryManager, ToolManager, EventHandler 등 핵심 모듈을 생성하고
 * HTML UI와 연결해 클릭, 키보드, 사이드바, 모달, AI 기능이 함께 동작하도록 구성합니다.
 *
 * 이번 변경의 의도는 다음과 같습니다.
 * - Mk2.1 버전 표기를 로그와 UI 동작에서 일관되게 맞추기 위함입니다.
 * - 선택 삭제가 실제로 동작하도록 HistoryManager.recordDelete 호출 방식을 올바르게 고칩니다.
 * - 우측 설정 탭의 AI 설정을 모달이 아닌 인라인 UI로 바로 보여주기 위함입니다.
 * - 점 좌표 표시가 한 줄로 보이도록 HTML 생성 방식을 더 단단하게 만듭니다.
 */

import { Canvas } from './core/Canvas.js';
import { ObjectManager } from './core/ObjectManager.js';
import { HistoryManager } from './core/HistoryManager.js';
import { EventHandler } from './core/EventHandler.js';
import { ToolManager } from './tools/Tool.js';

// 도구들 import
import { SelectTool } from './tools/SelectTool.js';
import { PointTool, PointOnObjectTool } from './tools/PointTool.js';
import { SegmentTool, LineTool, RayTool, VectorTool } from './tools/LineTool.js';
import { CircleTool, CircleThreePointsTool, TangentCircleTool } from './tools/CircleTool.js';
import {
    IntersectionTool, MidpointTool, ParallelTool, PerpendicularTool,
    PerpendicularBisectorTool, AngleBisectorTool
} from './tools/ConstructionTools.js';
import { FunctionTool, TangentFunctionTool } from './tools/FunctionTool.js';
import { RightAngleTool, EqualLengthTool } from './tools/MarkerTool.js';
import { PrismTool, PyramidTool } from './tools/Solid3DTool.js';
import { ArcTool, SectorTool, CircularSegmentTool } from './tools/ArcTool.js'; // Mk.2
import { AngleDimensionTool, LengthDimensionTool } from './tools/DimensionTool.js'; // Mk.2
import { PolygonTool } from './tools/PolygonTool.js'; // Mk.2
import { NumberLineTool } from './tools/NumberLineTool.js'; // Mk.4

// 유틸리티
import { Vec2 } from './utils/Geometry.js';

// Mk.2: AI 모듈
import { SchemaValidator } from './ai/SchemaValidator.js';
import { PatchApplier } from './ai/PatchApplier.js';
import { AIService } from './ai/AIService.js';

// Mk.2: UI 모듈
import { AlgebraInput } from './ui/AlgebraInput.js';
import { CommandPalette } from './ui/CommandPalette.js';
import { SettingsManager } from './core/SettingsManager.js';

// Mk.2: 설정 관리
import { SettingsManager } from './core/SettingsManager.js';

/**
 * 그래프A 애플리케이션
 */
class GraphAApp {
    constructor() {
        this.canvasElement = document.getElementById('mainCanvas');
        this.canvas = new Canvas(this.canvasElement);

        this.objectManager = new ObjectManager();
        this.historyManager = new HistoryManager(this.objectManager);
        this.toolManager = new ToolManager(this);
        this.eventHandler = new EventHandler(this);

        // Mk.2: AI 모듈 초기화
        this.schemaValidator = new SchemaValidator();
        this.patchApplier = new PatchApplier(this.objectManager, this.historyManager);
        this.aiService = new AIService();

        // Mk.2: UI 모듈 초기화
        this.algebraInput = new AlgebraInput(this.objectManager);
        this.commandPalette = new CommandPalette(this);

        // Mk.2: 설정 관리 초기화
        this.settingsManager = new SettingsManager();

        // Mk.4: 숨김 객체 보기 상태 초기화
        this.showHiddenObjects = false;

        this.setupTools();
        this.setupUI();
        this.setupEventListeners();

        // 초기 렌더링
        this.render();

        console.log('그래프A Mk2.1 준비 완료! 📐');
    }

    exportPNG(options = {}) {
        this.doExport({ format: 'png', ...options });
    }

    /**
     * 도구 등록
     */
    setupTools() {
        this.toolManager.registerTool('select', new SelectTool());
        this.toolManager.registerTool('point', new PointTool());
        this.toolManager.registerTool('pointOnObject', new PointOnObjectTool());
        this.toolManager.registerTool('segment', new SegmentTool());
        this.toolManager.registerTool('line', new LineTool());
        this.toolManager.registerTool('ray', new RayTool());
        this.toolManager.registerTool('vector', new VectorTool());
        this.toolManager.registerTool('circle', new CircleTool());
        this.toolManager.registerTool('circleThreePoints', new CircleThreePointsTool());
        this.toolManager.registerTool('intersection', new IntersectionTool());
        this.toolManager.registerTool('midpoint', new MidpointTool());
        this.toolManager.registerTool('parallel', new ParallelTool());
        this.toolManager.registerTool('perpendicular', new PerpendicularTool());
        this.toolManager.registerTool('perpendicularBisector', new PerpendicularBisectorTool());
        this.toolManager.registerTool('angleBisector', new AngleBisectorTool());
        this.toolManager.registerTool('tangentCircle', new TangentCircleTool());
        this.toolManager.registerTool('tangentFunction', new TangentFunctionTool());
        this.toolManager.registerTool('function', new FunctionTool());
        this.toolManager.registerTool('rightAngle', new RightAngleTool());
        this.toolManager.registerTool('equalLength', new EqualLengthTool());
        this.toolManager.registerTool('prism', new PrismTool());
        this.toolManager.registerTool('pyramid', new PyramidTool());

        // Mk.2: 호/부채꼴/활꼴 도구
        this.toolManager.registerTool('arc', new ArcTool());
        this.toolManager.registerTool('sector', new SectorTool());
        this.toolManager.registerTool('circularSegment', new CircularSegmentTool());

        // Mk.2: 치수 도구
        this.toolManager.registerTool('angleDimension', new AngleDimensionTool());
        this.toolManager.registerTool('lengthDimension', new LengthDimensionTool());

        // Mk.2: 다각형 도구
        this.toolManager.registerTool('polygon', new PolygonTool());

        // Mk.4: 수직선 도구
        this.toolManager.registerTool('numberLine', new NumberLineTool());

        // 기본 도구 선택
        this.toolManager.setTool('select');
    }

    /**
     * UI 이벤트 설정
     */
    setupUI() {
        // 도구 버튼들
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                if (tool) {
                    this.toolManager.setTool(tool);
                }
            });
        });

        // Mk.2: 드롭다운 메뉴 아이템 클릭
        document.querySelectorAll('.tool-dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                const tool = item.dataset.tool;
                if (tool) {
                    this.toolManager.setTool(tool);

                    // 부모 트리거 버튼의 아이콘과 data-tool 업데이트
                    const dropdown = item.closest('.tool-dropdown');
                    const trigger = dropdown?.previousElementSibling;
                    if (trigger && trigger.classList.contains('tool-group-trigger')) {
                        const icon = item.querySelector('.material-symbols-outlined')?.textContent;
                        if (icon) {
                            trigger.querySelector('.material-symbols-outlined').textContent = icon;
                        }
                        trigger.dataset.tool = tool;
                    }
                }
            });
        });

        // Mk.2: 카테고리 버튼 클릭 -> 서브메뉴 표시
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.dataset.category;

                // 카테고리 버튼 활성화
                document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // 서브메뉴 표시
                document.querySelectorAll('.submenu-content').forEach(s => s.classList.remove('active'));
                const submenu = document.querySelector(`.submenu-content[data-category="${category}"]`);
                if (submenu) {
                    submenu.classList.add('active');
                }
            });
        });

        // Mk.2: 도구 아이템 클릭
        document.querySelectorAll('.tool-item').forEach(item => {
            item.addEventListener('click', () => {
                const tool = item.dataset.tool;
                if (tool) {
                    this.toolManager.setTool(tool);

                    // 모든 도구 아이템 비활성화 후 현재 활성화
                    document.querySelectorAll('.tool-item').forEach(t => t.classList.remove('active'));
                    item.classList.add('active');

                    this.updateToolPanelUI(tool);
                }
            });
        });

        // 초기 서브메뉴 표시
        document.querySelector('.submenu-content[data-category="select"]')?.classList.add('active');

        // 되돌리기/다시하기
        document.getElementById('undoBtn')?.addEventListener('click', () => {
            this.historyManager.undo();
            this.render();
        });

        document.getElementById('redoBtn')?.addEventListener('click', () => {
            this.historyManager.redo();
            this.render();
        });

        // 줌 컨트롤
        document.getElementById('zoomIn')?.addEventListener('click', () => {
            this.canvas.zoom(1.2);
            this.render();
            this.updateZoomDisplay();
        });

        document.getElementById('zoomOut')?.addEventListener('click', () => {
            this.canvas.zoom(0.8);
            this.render();
            this.updateZoomDisplay();
        });

        document.getElementById('resetView')?.addEventListener('click', () => {
            this.canvas.resetView();
            this.render();
            this.updateZoomDisplay();
        });

        // 격자/축 토글 (우측 속성 패널의 "보기" 옵션만 사용)
        /*
          배경 설명
          - 이전 버전은 "캔버스 우측상단(view-options)"과 "우측 속성 패널(앱 설정 탭)"에
            격자/축 토글 UI가 각각 존재했고, 둘을 서로 동기화했습니다.
          - 사용자 요청으로 캔버스 우측상단 플로팅 토글 UI는 제거했습니다.

          현재 동작
          - 이 앱의 실제 상태값은 this.canvas.showGrid / this.canvas.showXAxis / this.canvas.showYAxis 입니다.
          - 우측 속성 패널의 체크박스(showGridPanel/showXAxisPanel/showYAxisPanel)를 바꾸면
            위 상태값을 갱신하고 render()로 즉시 화면에 반영합니다.
        */
        const showGridPanel = document.getElementById('showGridPanel');
        const showXAxisPanel = document.getElementById('showXAxisPanel');
        const showYAxisPanel = document.getElementById('showYAxisPanel');

        const syncShowGridFromPanel = (checked) => {
            this.canvas.showGrid = checked;
            this.render();
        };

        const syncShowXAxisFromPanel = (checked) => {
            this.canvas.showXAxis = checked;
            this.render();
        };

        const syncShowYAxisFromPanel = (checked) => {
            this.canvas.showYAxis = checked;
            this.render();
        };

        showGridPanel?.addEventListener('change', (e) => syncShowGridFromPanel(e.target.checked));
        showXAxisPanel?.addEventListener('change', (e) => syncShowXAxisFromPanel(e.target.checked));
        showYAxisPanel?.addEventListener('change', (e) => syncShowYAxisFromPanel(e.target.checked));

        // 숨김 객체 보기 토글
        const showHiddenPanel = document.getElementById('showHiddenPanel');
        showHiddenPanel?.addEventListener('change', (e) => {
            this.showHiddenObjects = e.target.checked;
            this.render();
            this.updateSidebar();
        });

        // 숨김 버튼 (속성 패널)
        document.getElementById('hideSelection')?.addEventListener('click', () => {
            this.toggleVisibility();
        });

        // 초기 상태는 우측 패널 체크 상태를 캔버스 상태에 반영합니다.
        if (showGridPanel) this.canvas.showGrid = showGridPanel.checked;
        if (showXAxisPanel) this.canvas.showXAxis = showXAxisPanel.checked;
        if (showYAxisPanel) this.canvas.showYAxis = showYAxisPanel.checked;
        this.showHiddenObjects = showHiddenPanel?.checked || false;

        // 사이드바 토글
        document.getElementById('toggleSidebar')?.addEventListener('click', () => {
            document.getElementById('sidebar')?.classList.toggle('collapsed');
        });

        // 속성 패널 토글
        document.getElementById('togglePanel')?.addEventListener('click', () => {
            document.getElementById('property-panel')?.classList.toggle('collapsed');
        });

        // 좌측 패널 토글
        document.getElementById('toggleLeftSidebar')?.addEventListener('click', () => {
            const panel = document.getElementById('tool-panel');
            if (panel) {
                panel.classList.toggle('collapsed');
                const btn = document.getElementById('toggleLeftSidebar');
                const icon = btn?.querySelector('.material-symbols-outlined');
                if (icon) {
                    icon.textContent = panel.classList.contains('collapsed') ? 'left_panel_open' : 'left_panel_close';
                }
            }
        });

        // 우측 패널 토글
        document.getElementById('toggleRightSidebar')?.addEventListener('click', () => {
            const panel = document.getElementById('property-panel');
            if (panel) {
                panel.classList.toggle('collapsed');
                const btn = document.getElementById('toggleRightSidebar');
                const icon = btn?.querySelector('.material-symbols-outlined');
                if (icon) {
                    icon.textContent = panel.classList.contains('collapsed') ? 'right_panel_open' : 'right_panel_close';
                }
            }
        });

        // 참고
        // - 예전에는 캔버스 우측상단의 "tune" 버튼(openPropertyPanel)로 우측 패널을 열 수 있었으나,
        //   해당 플로팅 UI를 제거했기 때문에 관련 이벤트 리스너도 함께 제거합니다.

        // 채팅 패널 토글
        document.getElementById('toggleChat')?.addEventListener('click', () => {
            document.getElementById('chat-panel')?.classList.toggle('collapsed');
        });

        // Mk.2: 스냅 모드 변경
        const snapModeSelect = document.getElementById('snapMode');
        if (snapModeSelect) {
            // 초기값 설정
            snapModeSelect.value = this.settingsManager.snapMode;
            snapModeSelect.addEventListener('change', (e) => {
                this.settingsManager.setSnapMode(e.target.value);
                this.showToast(`스냅 모드: ${e.target.options[e.target.selectedIndex].text}`, 'info');
            });
        }

        // Mk.2: 속성 패널의 스냅 모드 선택
        const snapModePanel = document.getElementById('snapModePanel');
        if (snapModePanel) {
            snapModePanel.value = this.settingsManager.snapMode;
            snapModePanel.addEventListener('change', (e) => {
                this.settingsManager.setSnapMode(e.target.value);
                // 캔버스 위의 snapMode도 동기화
                const snapModeSelect = document.getElementById('snapMode');
                if (snapModeSelect) snapModeSelect.value = e.target.value;
                this.showToast(`스냅 모드: ${e.target.options[e.target.selectedIndex].text}`, 'info');
            });
        }

        // Mk.2: 모든 점 숨기기/보이기
        document.getElementById('hideAllPoints')?.addEventListener('click', () => {
            const newState = !this.settingsManager.hidePoints;
            this.settingsManager.togglePointsVisibility(this.objectManager, newState);
            this.render();
            this.showToast(newState ? '모든 점 숨김' : '모든 점 표시', 'info');

            // 아이콘 변경
            const btn = document.getElementById('hideAllPoints');
            const icon = btn?.querySelector('.material-symbols-outlined');
            if (icon) {
                icon.textContent = newState ? 'visibility' : 'visibility_off';
            }
        });

        // 자석 기능 토글
        const magnetBtn = document.getElementById('toggleMagnet');
        if (magnetBtn) {
            // 초기 상태 반영
            if (this.settingsManager.magnetEnabled) {
                magnetBtn.classList.add('active');
            }

            magnetBtn.addEventListener('click', () => {
                const enabled = this.settingsManager.toggleMagnet();
                magnetBtn.classList.toggle('active', enabled);
                this.showToast(enabled ? '자석 기능 ON (0.5 단위)' : '자석 기능 OFF', 'info');
            });
        }

        document.querySelector('.chat-header')?.addEventListener('click', () => {
            document.getElementById('chat-panel')?.classList.toggle('collapsed');
        });

        // 설명서 모달
        const manualModal = document.getElementById('manualModal');
        document.getElementById('openManual')?.addEventListener('click', () => {
            manualModal?.classList.add('active');
        });

        // 모달 닫기 (설명서 및 기타 모달)
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.modal-overlay')?.classList.remove('active');
            });
        });

        // 모달 배경 클릭 시 닫기
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove('active');
                }
            });
        });

        // 설명서 탭 전환
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // 탭 버튼 활성화
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // 탭 컨텐츠 전환
                const tabId = btn.dataset.tab;
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                    if (content.id === `tab-${tabId}`) {
                        content.classList.add('active');
                    }
                });
            });
        });

        // Mk.2: 기본 색상 변경
        document.getElementById('defaultColor')?.addEventListener('change', (e) => {
            this.settingsManager.setDefaultStyle('lineColor', e.target.value);
            this.settingsManager.setDefaultStyle('circleColor', e.target.value);
        });

        // Mk.2: 우측 패널 카테고리 탭 전환
        document.querySelectorAll('.prop-category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const prop = btn.dataset.prop;

                // 탭 활성화
                document.querySelectorAll('.prop-category-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // 패널 내용 표시
                document.querySelectorAll('.prop-content').forEach(c => c.classList.remove('active'));
                const content = document.querySelector(`.prop-content[data-prop="${prop}"]`);
                if (content) {
                    content.classList.add('active');
                }
            });
        });

        // Mk.2: 기본 선 굵기 변경
        document.getElementById('defaultLineWidth')?.addEventListener('change', (e) => {
            this.settingsManager.setDefaultStyle('lineWidth', parseInt(e.target.value));
        });

        // Mk.2: 기본 색상 변경
        document.getElementById('defaultColor')?.addEventListener('input', (e) => {
            this.settingsManager.setDefaultStyle('color', e.target.value);
        });

        // Mk.2: 일괄 색상 적용
        document.getElementById('applyBulkColor')?.addEventListener('click', () => {
            const color = document.getElementById('bulkColor').value;
            this.settingsManager.applyStylesToAll(this.objectManager, { color });
            this.render();
            this.showToast('모든 객체에 색상 적용됨', 'success');
        });

        // Mk.2: 일괄 선 굵기 적용
        document.getElementById('applyBulkWidth')?.addEventListener('click', () => {
            const lineWidth = parseInt(document.getElementById('bulkLineWidth').value);
            this.settingsManager.applyStylesToAll(this.objectManager, { lineWidth });
            this.render();
            this.showToast('모든 객체에 선 굵기 적용됨', 'success');
        });

        // Mk.2: 선택된 객체 복사
        document.getElementById('copySelection')?.addEventListener('click', () => {
            this.copySelectedObjects();
        });

        // Mk.2: 붙여넣기
        document.getElementById('pasteSelection')?.addEventListener('click', () => {
            this.pasteObjects();
        });

        // Mk.2: 선택된 객체 삭제
        document.getElementById('deleteSelection')?.addEventListener('click', () => {
            this.deleteSelectedObjects();
        });

        // 내보내기 버튼
        document.getElementById('exportBtn')?.addEventListener('click', () => {
            this.showExportModal();
        });

        // 함수 모달
        this.setupFunctionModal();

        // 내보내기 모달
        this.setupExportModal();

        // 채팅 입력
        this.setupChat();

        // Mk2.1: AI 설정은 설정 탭에서 바로 보이는 인라인 UI가 기본입니다
        this.setupAISettingsPanel();

        // 호환을 위해 모달도 유지합니다. HTML에서 제거되면 이 함수는 조용히 무시됩니다.
        this.setupAISettingsModal();

        // Mk.4: 수직선 모달
        this.setupNumberLineModal();
    }

    /**
     * 도구 패널 UI 업데이트
     */
    updateToolPanelUI(toolName) {
        // 모든 버튼에서 active 제거
        document.querySelectorAll('.tool-panel-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tool === toolName) {
                btn.classList.add('active');
            }
        });

        // 현재 도구 표시 업데이트
        const toolNames = {
            select: '선택', point: '점', pointOnObject: '선 위의 점',
            intersection: '교점', midpoint: '중점', segment: '선분',
            line: '직선', ray: '반직선', vector: '벡터',
            parallel: '평행선', perpendicular: '수선',
            perpendicularBisector: '수직이등분선', angleBisector: '각의 이등분선',
            tangentCircle: '원의 접선', tangentFunction: '함수 접선',
            circle: '원', circleThreePoints: '세 점 원',
            arc: '호', sector: '부채꼴', circularSegment: '활꼴',
            polygon: '다각형', prism: '각기둥', pyramid: '각뿔',
            angleDimension: '각도', lengthDimension: '길이',
            rightAngle: '직각', equalLength: '같은 길이',
            function: '함수'
        };

        const nameEl = document.getElementById('currentToolName');
        if (nameEl) {
            nameEl.textContent = toolNames[toolName] || toolName;
        }
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 객체 추가/삭제 시 사이드바 업데이트
        this.objectManager.on('objectAdded', (obj) => {
            this.updateSidebar();
        });

        this.objectManager.on('objectRemoved', () => {
            this.updateSidebar();
            this.render();
        });

        this.objectManager.on('selectionChanged', () => {
            this.updateSidebar();
            this.updatePropertyPanel();
        });

        // 히스토리 변경
        this.historyManager.on('historyChanged', (data) => {
            const undoBtn = document.getElementById('undoBtn');
            const redoBtn = document.getElementById('redoBtn');

            if (undoBtn) undoBtn.disabled = !data.canUndo;
            if (redoBtn) redoBtn.disabled = !data.canRedo;
        });

        // 윈도우 리사이즈
        window.addEventListener('resize', () => {
            this.canvas.resize();
            this.render();
        });

        // Mk.2: 클립보드 초기화
        this.clipboard = [];
    }

    /**
     * 선택된 객체 숨기기/보이기 토글 (H 키)
     */
    toggleVisibility() {
        const selected = this.objectManager.getSelectedObjects();
        if (selected.length === 0) {
            this.showToast('숨길 객체를 선택하세요', 'warning');
            return;
        }

        // 모두 같은 상태면 반전, 아니면 모두 숨기기
        const allHidden = selected.every(obj => !obj.visible);

        for (const obj of selected) {
            obj.visible = allHidden;  // 모두 숨겨져 있으면 보이기, 아니면 숨기기
        }

        // 숨기면 선택 해제
        if (!allHidden) {
            this.objectManager.clearSelection();
        }

        this.render();
        this.updateSidebar();
        this.showToast(allHidden ? `${selected.length}개 객체 표시됨` : `${selected.length}개 객체 숨겨짐 (H로 다시 표시)`, 'info');
    }

    /**
     * 선택된 객체 복사 (모든 타입 지원 - 의존성 순서 유지)
     */
    copySelectedObjects() {
        const selected = this.objectManager.getSelectedObjects();
        if (selected.length === 0) {
            this.showToast('복사할 객체를 선택하세요', 'warning');
            return;
        }

        // 위상 정렬: 의존 객체가 먼저 오도록 정렬
        const toCopy = [];
        const addedIds = new Set();

        const addWithDependencies = (obj) => {
            if (addedIds.has(obj.id)) return;

            // 의존 객체 먼저 추가
            for (const depId of obj.dependencies || []) {
                const dep = this.objectManager.getObject(depId);
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
        this.showToast(`${selected.length}개 객체 복사됨 (의존 객체 포함 ${toCopy.length}개)`, 'success');
    }

    /**
     * 붙여넣기 (createFromJSON 사용 - 모든 타입 지원)
     */
    pasteObjects() {
        if (!this.clipboard || this.clipboard.length === 0) {
            this.showToast('붙여넣을 객체가 없습니다', 'warning');
            return;
        }

        const offset = 0.5;
        const newObjects = [];
        const idMap = new Map(); // 원본 ID -> 새 ID 매핑

        // 선택 해제
        this.objectManager.clearSelection();

        // 각 객체를 새로 생성
        for (const objData of this.clipboard) {
            const newData = { ...objData };

            // 새 ID 생성
            const newId = 'paste_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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

            // baseVertexIds 배열 처리
            if (newData.baseVertexIds) {
                newData.baseVertexIds = newData.baseVertexIds.map(id => idMap.get(id) || id);
            }
            if (newData.apexId && idMap.has(newData.apexId)) {
                newData.apexId = idMap.get(newData.apexId);
            }

            // 객체 생성
            const newObj = this.objectManager.createFromJSON(newData);
            if (newObj) {
                this.objectManager.addObject(newObj);
                newObjects.push(newObj);
                this.historyManager.recordCreate(newObj);
            }
        }

        // 새 객체 선택
        newObjects.forEach(obj => this.objectManager.selectObject(obj, true));

        this.objectManager.updateAll();
        this.showToast(`${newObjects.length}개 객체 붙여넣기됨`, 'success');
        this.render();
        this.updateSidebar();
    }

    /**
     * 선택된 객체 삭제
     */
    deleteSelectedObjects() {
        const selected = this.objectManager.getSelectedObjects();
        if (selected.length === 0) {
            this.showToast('삭제할 객체를 선택하세요', 'warning');
            return;
        }

        const objectsToDelete = [];
        const seenIds = new Set();

        for (const obj of selected) {
            if (!obj || seenIds.has(obj.id)) continue;
            seenIds.add(obj.id);
            objectsToDelete.push(obj);

            for (const dependent of this.objectManager.getDependents(obj.id)) {
                if (!dependent || seenIds.has(dependent.id)) continue;
                seenIds.add(dependent.id);
                objectsToDelete.push(dependent);
            }
        }

        const count = objectsToDelete.length;

        /*
          히스토리 기록은 "삭제되는 객체들의 스냅샷"을 한 번에 저장해야
          undo에서 정확히 복원할 수 있고, 삭제 중간에 오류가 나도 일관성이 유지됩니다.

          또한 HistoryManager.recordDelete는 배열을 기대하는 형태이므로
          여기서는 selected 전체를 한 번에 전달합니다.
        */
        this.historyManager.recordDelete(objectsToDelete);

        for (const obj of [...selected]) {
            this.objectManager.removeObject(obj.id);
        }

        this.showToast(`${count}개 객체 삭제됨`, 'success');
        this.render();
    }

    /**
     * 속성 패널 업데이트
     */
    updatePropertyPanel() {
        const selected = this.objectManager.getSelectedObjects();
        const emptyState = document.getElementById('propertyEmptyState');
        const selectionActions = document.getElementById('selectionActions');
        const selectedCount = document.getElementById('selectedCount');
        const individualProperty = document.getElementById('individualProperty');

        if (selected.length > 0) {
            // 선택된 객체가 있음
            emptyState.style.display = 'none';
            selectionActions.style.display = 'block';
            individualProperty.style.display = 'block';
            if (selectedCount) selectedCount.textContent = selected.length;

            // '선택' 탭이 활성화되어 있지 않다면 활성화 (첫 선택 시 사용자 경험 향상)
            const activeTab = document.querySelector('.prop-category-btn.active');
            if (activeTab && activeTab.dataset.prop !== 'selection') {
                // 사용자가 다른 탭을 보고 있다면 굳이 강제로 전환하지 말지 결정해야 함
                // 여기서는 사용자가 명시적으로 선택했으므로 선택 탭으로 이동하는 것이 자연스러움
                document.querySelector('.prop-category-btn[data-prop="selection"]')?.click();
            } else if (!activeTab) {
                // 아무 탭도 활성화 안된 경우 (초기)
                document.querySelector('.prop-category-btn[data-prop="selection"]')?.click();
            }

            // 개별 속성 생성 (단일 선택시 상세, 다중 선택시 공통 속성 등)
            // 현재는 간단히 구현
            this.updateIndividualProperties(selected);

        } else {
            // 선택된 객체 없음
            emptyState.style.display = 'flex';
            selectionActions.style.display = 'none';
            individualProperty.style.display = 'none';
        }
    }

    /**
     * 개별 속성 UI 업데이트 (간소화 버전)
     */
    updateIndividualProperties(selected) {
        const container = document.getElementById('individualProperty');
        if (!container) return;

        container.innerHTML = '';

        if (selected.length === 1) {
            const obj = selected[0];

            // 이름 수정
            const nameRow = document.createElement('div');
            nameRow.className = 'property-row';
            nameRow.innerHTML = `
                <label>이름:</label>
                <input type="text" value="${obj.label || ''}" class="prop-input">
            `;
            const nameInput = nameRow.querySelector('input');
            // 이벤트 버블링 차단 - 클릭 시 선택 해제 방지
            nameInput.addEventListener('mousedown', e => e.stopPropagation());
            nameInput.addEventListener('click', e => e.stopPropagation());
            nameInput.addEventListener('change', (e) => {
                obj.label = e.target.value;
                this.updateSidebar(); // 목록 이름 업데이트
                this.render();
            });
            container.appendChild(nameRow);

            // 색상 수정
            const colorRow = document.createElement('div');
            colorRow.className = 'property-row';
            colorRow.innerHTML = `
                <label>색상:</label>
                <input type="color" value="${obj.color}" class="prop-input">
            `;
            const colorInput = colorRow.querySelector('input');
            colorInput.addEventListener('mousedown', e => e.stopPropagation());
            colorInput.addEventListener('click', e => e.stopPropagation());
            colorInput.addEventListener('input', (e) => {
                obj.color = e.target.value;
                this.render();
                this.updateSidebar(); // 목록 아이콘 색상 업데이트
            });
            container.appendChild(colorRow);

            // 선 굵기 (점 제외)
            if (obj.type !== 'point') {
                const widthRow = document.createElement('div');
                widthRow.className = 'property-row';
                widthRow.innerHTML = `
                    <label>굵기:</label>
                    <input type="range" min="1" max="10" value="${obj.lineWidth || 2}" class="prop-slider">
                    <span class="value-display">${obj.lineWidth || 2}</span>
                `;
                const widthInput = widthRow.querySelector('input');
                const widthDisplay = widthRow.querySelector('span');
                widthInput.addEventListener('mousedown', e => e.stopPropagation());
                widthInput.addEventListener('click', e => e.stopPropagation());
                widthInput.addEventListener('input', (e) => {
                    const width = parseInt(e.target.value);
                    obj.lineWidth = width;
                    widthDisplay.textContent = width;
                    this.render();
                });
                container.appendChild(widthRow);
            }

            // 좌표 (점인 경우)
            if (obj.type === 'point' && obj.position) {
                const coordHTML = this.getPointCoordinateHTML(obj);
                const coordRow = document.createElement('div');
                coordRow.className = 'property-row full-width';
                coordRow.innerHTML = `<label>좌표:</label> ${coordHTML}`;

                // 좌표 입력 이벤트 연결
                coordRow.querySelectorAll('.coord-input').forEach(input => {
                    // 이벤트 버블링 차단 - 클릭 시 선택 해제 방지
                    input.addEventListener('mousedown', e => e.stopPropagation());
                    input.addEventListener('click', e => e.stopPropagation());
                    input.addEventListener('change', (e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) {
                            const type = e.target.dataset.coord;
                            if (type === 'x') obj.position.x = val;
                            if (type === 'y') obj.position.y = val;
                            this.objectManager.updateAll();
                            this.render();
                        }
                    });
                });

                container.appendChild(coordRow);
            }

            // 함수 수식 편집 (함수 타입인 경우)
            if (obj.type === 'function') {
                // 수식 편집
                const exprRow = document.createElement('div');
                exprRow.className = 'property-row';
                exprRow.innerHTML = `
                    <label>수식:</label>
                    <input type="text" value="${obj.expression || ''}" class="prop-input" placeholder="예: x^2 - 2*x + 1">
                `;
                const exprInput = exprRow.querySelector('input');
                exprInput.addEventListener('mousedown', e => e.stopPropagation());
                exprInput.addEventListener('click', e => e.stopPropagation());
                exprInput.addEventListener('change', (e) => {
                    const newExpr = e.target.value.trim();
                    if (newExpr) {
                        obj.setExpression(newExpr);
                        if (obj.valid) {
                            this.showToast('함수 식이 업데이트됨', 'success');
                        } else {
                            this.showToast(`표현식 오류: ${obj.getError()}`, 'error');
                        }
                        this.render();
                        this.updateSidebar();
                    }
                });
                container.appendChild(exprRow);

                // 도메인(x 범위) 설정
                const domainRow = document.createElement('div');
                domainRow.className = 'property-row';
                const xMin = obj.xMin !== null ? obj.xMin : '';
                const xMax = obj.xMax !== null ? obj.xMax : '';
                domainRow.innerHTML = `
                    <label>x 범위:</label>
                    <div style="display: flex; gap: 4px; align-items: center;">
                        <input type="number" class="prop-input xmin-input" value="${xMin}" placeholder="-∞" style="width: 60px;">
                        <span>~</span>
                        <input type="number" class="prop-input xmax-input" value="${xMax}" placeholder="∞" style="width: 60px;">
                    </div>
                `;
                const xminInput = domainRow.querySelector('.xmin-input');
                const xmaxInput = domainRow.querySelector('.xmax-input');

                [xminInput, xmaxInput].forEach(input => {
                    input.addEventListener('mousedown', e => e.stopPropagation());
                    input.addEventListener('click', e => e.stopPropagation());
                });

                xminInput.addEventListener('change', (e) => {
                    obj.xMin = e.target.value.trim() === '' ? null : parseFloat(e.target.value);
                    this.render();
                });
                xmaxInput.addEventListener('change', (e) => {
                    obj.xMax = e.target.value.trim() === '' ? null : parseFloat(e.target.value);
                    this.render();
                });
                container.appendChild(domainRow);

                // 라벨 위치 초기화 버튼
                const resetRow = document.createElement('div');
                resetRow.className = 'property-row';
                resetRow.innerHTML = `
                    <label>라벨:</label>
                    <button class="prop-btn reset-label-btn">위치 초기화</button>
                `;
                const resetBtn = resetRow.querySelector('.reset-label-btn');
                resetBtn.addEventListener('mousedown', e => e.stopPropagation());
                resetBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // 라벨 위치 초기화 (새 방식)
                    if (obj.resetLabelPosition) {
                        obj.resetLabelPosition();
                    }
                    this.render();
                    this.showToast('라벨 위치가 초기화됨', 'info');
                });
                container.appendChild(resetRow);

                // 안내 문구
                const helpRow = document.createElement('div');
                helpRow.className = 'property-row help-text';
                helpRow.innerHTML = `<small style="color: #888;">💡 그래프 옆 수식 라벨을 드래그하여 위치를 조정할 수 있습니다.</small>`;
                container.appendChild(helpRow);
            }

            /*
              Mk2.1: 치수(길이/각도) 숫자 표시 편집
              요구사항 정리
              - 숫자를 클릭하면 선택이 되며, 우측 패널에서 폰트 크기/텍스트 수정이 가능해야 합니다.
              - 자동 계산값의 소수점 자리수도 우측 패널에서 조절 가능해야 합니다.

              구현 방식
              - 캔버스 위 숫자를 클릭하면 (Dimension.js hitTest가 라벨 박스까지 포함)
                치수 객체가 선택됩니다.
              - 선택되면 아래 UI가 나타나고, 여기서 즉시 수정 가능합니다.
            */
            if (obj.type === 'lengthDimension' || obj.type === 'angleDimension') {
                // 구분 제목
                const title = document.createElement('h4');
                title.textContent = '치수 표시';
                container.appendChild(title);

                // 사용자 텍스트
                const customRow = document.createElement('div');
                customRow.className = 'property-row';
                const customValue = (obj.customText !== null && obj.customText !== undefined) ? obj.customText : '';
                customRow.innerHTML = `
                    <label>텍스트:</label>
                    <input type="text" class="prop-input" placeholder="비우면 자동(계산값)" value="${customValue}">
                `;
                const customInput = customRow.querySelector('input');
                customInput.addEventListener('mousedown', e => e.stopPropagation());
                customInput.addEventListener('click', e => e.stopPropagation());
                customInput.addEventListener('input', (e) => {
                    // 빈 값이면 자동 표시로 복귀
                    const v = e.target.value.trim();
                    obj.customText = v.length === 0 ? null : v;
                    this.render();
                });
                container.appendChild(customRow);

                // 폰트 크기
                const fontRow = document.createElement('div');
                fontRow.className = 'property-row';
                const fontSize = obj.labelFontSize || 14;
                fontRow.innerHTML = `
                    <label>글씨:</label>
                    <input type="range" min="8" max="60" value="${fontSize}" class="prop-slider">
                    <span class="value-display">${fontSize}</span>
                `;
                const fontInput = fontRow.querySelector('input');
                const fontDisplay = fontRow.querySelector('span');
                fontInput.addEventListener('mousedown', e => e.stopPropagation());
                fontInput.addEventListener('click', e => e.stopPropagation());
                fontInput.addEventListener('input', (e) => {
                    const v = parseInt(e.target.value);
                    obj.labelFontSize = v;
                    fontDisplay.textContent = v;
                    this.render();
                });
                container.appendChild(fontRow);

                // 소수점 자리수 (자동 계산값일 때 사용)
                const precisionRow = document.createElement('div');
                precisionRow.className = 'property-row';
                const precision = (obj.precision !== undefined && obj.precision !== null) ? obj.precision : (obj.type === 'angleDimension' ? 1 : 2);
                precisionRow.innerHTML = `
                    <label>소수:</label>
                    <select class="prop-select">
                        <option value="0">0자리</option>
                        <option value="1">1자리</option>
                        <option value="2">2자리</option>
                        <option value="3">3자리</option>
                        <option value="4">4자리</option>
                    </select>
                `;
                const precisionSelect = precisionRow.querySelector('select');
                precisionSelect.value = String(precision);
                precisionSelect.addEventListener('mousedown', e => e.stopPropagation());
                precisionSelect.addEventListener('click', e => e.stopPropagation());
                precisionSelect.addEventListener('change', (e) => {
                    obj.precision = parseInt(e.target.value);
                    this.render();
                });
                container.appendChild(precisionRow);
            }

            // 각기둥/각뿔 모서리 정보 표시
            if (obj.type === 'prism' || obj.type === 'pyramid') {
                // 구분 제목
                const title = document.createElement('h4');
                title.textContent = '모서리 정보';
                title.style.marginTop = '16px';
                title.style.marginBottom = '8px';
                container.appendChild(title);

                // 모서리 목록
                const edges = obj.getEdges ? obj.getEdges() : [];

                if (edges.length > 0) {
                    const edgeList = document.createElement('div');
                    edgeList.className = 'edge-list';
                    edgeList.style.cssText = 'max-height: 200px; overflow-y: auto; font-size: 12px;';

                    // 모서리 유형별 그룹화
                    const grouped = {};
                    for (const edge of edges) {
                        if (!grouped[edge.type]) grouped[edge.type] = [];
                        grouped[edge.type].push(edge);
                    }

                    const typeLabels = {
                        base: '밑면',
                        top: '윗면',
                        vertical: '세로',
                        lateral: '측면'
                    };

                    for (const [type, typeEdges] of Object.entries(grouped)) {
                        const groupDiv = document.createElement('div');
                        groupDiv.style.marginBottom = '8px';

                        const groupTitle = document.createElement('div');
                        groupTitle.style.cssText = 'font-weight: bold; margin-bottom: 4px; color: #888;';
                        groupTitle.textContent = typeLabels[type] || type;
                        groupDiv.appendChild(groupTitle);

                        for (const edge of typeEdges) {
                            const edgeDiv = document.createElement('div');
                            edgeDiv.style.cssText = 'padding: 2px 0; display: flex; justify-content: space-between;';
                            edgeDiv.innerHTML = `
                                <span>모서리 ${edge.index + 1}</span>
                                <span style="color: var(--accent-primary);">${edge.length.toFixed(2)}</span>
                            `;
                            groupDiv.appendChild(edgeDiv);
                        }

                        edgeList.appendChild(groupDiv);
                    }

                    container.appendChild(edgeList);
                }

                // 선택된 모서리 정보
                const activeEdge = obj.getActiveEdge ? obj.getActiveEdge() : null;
                if (activeEdge) {
                    const activeRow = document.createElement('div');
                    activeRow.className = 'property-row';
                    activeRow.style.cssText = 'margin-top: 12px; padding: 8px; background: rgba(99, 102, 241, 0.1); border-radius: 4px;';
                    activeRow.innerHTML = `
                        <div style="font-size: 12px; color: #aaa;">선택된 모서리</div>
                        <div style="font-size: 16px; font-weight: bold; color: var(--accent-primary);">
                            길이: ${activeEdge.length.toFixed(2)}
                        </div>
                    `;
                    container.appendChild(activeRow);
                }

                // 안내 문구
                const helpRow = document.createElement('div');
                helpRow.className = 'property-row help-text';
                helpRow.innerHTML = `<small style="color: #888;">💡 모서리를 클릭하면 해당 모서리가 강조됩니다.</small>`;
                container.appendChild(helpRow);
            }
        }
    }

    /**
     * 렌더링
     */
    render() {
        this.canvas.clear();
        this.canvas.drawGrid();
        this.canvas.drawAxes();

        // 모든 객체 렌더링
        for (const obj of this.objectManager.getAllObjects()) {
            if (obj.visible) {
                obj.render(this.canvas);
            } else if (this.showHiddenObjects) {
                // 숨김 객체 보기 모드: 30% 투명도로 표시
                const ctx = this.canvas.ctx;
                ctx.save();
                ctx.globalAlpha = 0.3;
                obj.render(this.canvas);
                ctx.restore();
            }
        }

        // 현재 도구의 미리보기 렌더링
        const currentTool = this.toolManager.getCurrentTool();
        if (currentTool && currentTool.render) {
            currentTool.render(this.canvas, this);
        }
    }

    /**
     * 줌 레벨 표시 업데이트
     */
    updateZoomDisplay() {
        const zoomLevel = document.getElementById('zoomLevel');
        if (zoomLevel) {
            zoomLevel.textContent = `${this.canvas.getZoomPercent()}%`;
        }
    }

    /**
     * 좌표 포맷팅 (정수면 정수로, 소수면 2자리까지)
     */
    formatCoordinate(value) {
        if (Number.isInteger(value)) {
            return value.toString();
        }
        // 거의 정수인 경우 (반올림 오차 처리)
        if (Math.abs(value - Math.round(value)) < 0.0001) {
            return Math.round(value).toString();
        }
        return value.toFixed(2);
    }

    /**
     * 점 객체의 좌표 HTML 생성
     */
    getPointCoordinateHTML(obj) {
        if (!obj.getPosition) return '';

        const pos = obj.getPosition();
        const x = this.formatCoordinate(pos.x);
        const y = this.formatCoordinate(pos.y);
        const isEditable = !obj.locked;

        if (isEditable) {
            return `
                <div class="object-coords" data-id="${obj.id}">
                    <!--
                      줄바꿈 문제 방지
                      - 좌표 입력 사이에 불필요한 공백과 줄바꿈이 들어가면
                        패널 폭이 좁을 때 x와 y가 다른 줄로 내려갈 수 있습니다.
                      - 따라서 쉼표 주변 공백을 최소화하고 한 줄 레이아웃을 유지합니다.
                    -->
                    (<input type="text" class="coord-input" data-coord="x" value="${x}" size="4">,<input type="text" class="coord-input" data-coord="y" value="${y}" size="4">)
                </div>
            `;
        } else {
            return `<div class="object-coords readonly">(${x}, ${y})</div>`;
        }
    }

    /**
     * 사이드바 업데이트 (객체 목록)
     */
    updateSidebar() {
        const objectList = document.getElementById('objectList');
        if (!objectList) return;

        const objects = this.objectManager.getAllObjects();

        if (objects.length === 0) {
            objectList.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-outlined">add_circle_outline</span>
                    <p>도구를 선택하고 캔버스에 그려보세요</p>
                </div>
            `;
            return;
        }

        objectList.innerHTML = objects.map(obj => {
            const coordsHTML = obj.getPosition ? this.getPointCoordinateHTML(obj) : '';
            const isActive = obj.selected ? 'selected' : '';
            const hiddenClass = obj.visible ? '' : 'hidden-object';
            const iconName = this.getObjectIconName(obj.type);
            const typeLabel = this.getObjectTypeLabel(obj.type);

            return `
                <div class="object-item ${isActive} ${hiddenClass}" data-id="${obj.id}">
                    <div class="object-icon ${obj.type}">
                        <span class="material-symbols-outlined">${iconName}</span>
                    </div>
                    <div class="object-info">
                        <div class="object-name">${obj.label || '(이름 없음)'}</div>
                        <div class="object-type">${typeLabel}</div>
                        ${coordsHTML}
                    </div>
                    <div class="object-actions">
                        <button class="toggle-visibility" title="${obj.visible ? '숨기기' : '보이기'}">
                            <span class="material-symbols-outlined">${obj.visible ? 'visibility' : 'visibility_off'}</span>
                        </button>
                        <button class="delete-object" title="삭제">
                            <span class="material-symbols-outlined">delete</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // 이벤트 바인딩
        objectList.querySelectorAll('.object-item').forEach(item => {
            const id = item.dataset.id;
            const obj = this.objectManager.getObject(id);
            if (!obj) return;

            item.addEventListener('click', (e) => {
                if (!e.target.closest('.object-actions') && !e.target.closest('.coord-input')) {
                    this.objectManager.selectObject(obj, e.shiftKey); // Shift 키로 다중 선택 지원
                    this.render();
                }
            });

            item.addEventListener('mouseenter', () => {
                this.objectManager.highlightObject(obj);
                this.render();
            });

            item.addEventListener('mouseleave', () => {
                this.objectManager.clearHighlight();
                this.render();
            });

            item.querySelector('.toggle-visibility')?.addEventListener('click', (e) => {
                e.stopPropagation();
                obj.visible = !obj.visible;
                this.updateSidebar(); // 아이콘 변경을 위해 재렌더링
                this.render();
            });

            item.querySelector('.delete-object')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.historyManager.recordDelete([obj]);
                this.objectManager.removeObject(obj.id);
                this.render();
            });

            // 좌표 입력 이벤트
            item.querySelectorAll('.coord-input').forEach(input => {
                input.addEventListener('click', e => e.stopPropagation());
                input.addEventListener('change', e => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && obj.setPosition) {
                        const type = input.dataset.coord;
                        const pos = obj.getPosition();

                        // 히스토리 기록
                        const oldPos = { ...pos };

                        if (type === 'x') obj.setPosition(val, pos.y);
                        else obj.setPosition(pos.x, val);

                        this.historyManager.recordPropertyChange(obj.id, 'position', oldPos, obj.getPosition());

                        this.objectManager.updateAll();
                        this.render();
                    }
                });
            });
        });
    }

    getObjectTypeLabel(type) {
        const labels = {
            point: '점', segment: '선분', line: '직선', ray: '반직선', vector: '벡터',
            circle: '원', arc: '호', sector: '부채꼴', circularSegment: '활꼴',
            polygon: '다각형', prism: '각기둥', pyramid: '각뿔',
            angleDimension: '각도', lengthDimension: '길이',
            function: '함수'
        };
        return labels[type] || type;
    }

    getObjectIconName(type) {
        const icons = {
            point: 'radio_button_unchecked',
            segment: 'horizontal_rule',
            line: 'show_chart',
            ray: 'trending_flat',
            vector: 'arrow_forward',
            circle: 'circle',
            arc: 'line_curve',
            sector: 'pie_chart',
            circularSegment: 'incomplete_circle',
            polygon: 'pentagon',
            prism: 'deployed_code',
            pyramid: 'change_history',
            angleDimension: 'angle',
            lengthDimension: 'architecture',
            rightAngle: 'square_foot',
            equalLength: 'straighten',
            function: 'ssid_chart'
        };
        return icons[type] || 'interests';
    }

    /**
     * 함수 모달 설정
     */
    setupFunctionModal() {
        const modal = document.getElementById('functionModal');
        const input = document.getElementById('functionExpression');
        const addBtn = document.getElementById('addFunction');

        // 닫기 버튼들
        modal?.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        });

        // 배경 클릭으로 닫기
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });

        addBtn?.addEventListener('click', () => {
            const expression = input.value.trim();
            if (expression) {
                const func = this.objectManager.createFunction(expression);

                if (func.valid) {
                    this.historyManager.recordCreate(func);
                    this.objectManager.selectObject(func);
                    this.showToast(`함수 ${func.label} 생성`, 'success');
                    modal.classList.add('hidden');
                    input.value = '';
                } else {
                    this.showToast(`표현식 오류: ${func.getError()}`, 'error');
                    this.objectManager.removeObject(func.id);
                }

                this.render();
            }
        });

        // Enter로 추가
        input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                addBtn.click();
            }
        });
    }

    /**
     * 함수 모달 표시
     */
    showFunctionModal() {
        const modal = document.getElementById('functionModal');
        const input = document.getElementById('functionExpression');

        modal?.classList.remove('hidden');
        input?.focus();
    }

    /**
     * 내보내기 모달 설정
     */
    setupExportModal() {
        const modal = document.getElementById('exportModal');
        const doExport = document.getElementById('doExport');

        modal?.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        });

        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });

        // 형식 변경 시 PNG 옵션 토글
        modal?.querySelectorAll('input[name="exportFormat"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const pngOptions = document.getElementById('pngOptions');
                if (pngOptions) {
                    pngOptions.style.display = radio.value === 'png' ? 'flex' : 'none';
                }
            });
        });

        doExport?.addEventListener('click', () => {
            this.doExport();
            modal.classList.add('hidden');
        });
    }

    /**
     * 내보내기 모달 표시
     */
    showExportModal() {
        const modal = document.getElementById('exportModal');
        modal?.classList.remove('hidden');
    }

    /**
     * 실제 내보내기 수행
     */
    doExport(options = {}) {
        const format = options.format ?? document.querySelector('input[name="exportFormat"]:checked')?.value ?? 'png';
        const scale = options.scale ?? parseInt(document.querySelector('input[name="exportScale"]:checked')?.value || '1', 10);
        const includeBackground = options.includeBackground ?? document.getElementById('exportBackground')?.checked ?? true;
        const includeGrid = options.includeGrid ?? document.getElementById('exportGrid')?.checked ?? false;
        const includeAxes = options.includeAxes ?? document.getElementById('exportAxes')?.checked ?? true;

        // 임시 캔버스 생성
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        const width = this.canvas.width * scale;
        const height = this.canvas.height * scale;

        tempCanvas.width = width;
        tempCanvas.height = height;

        // 스케일 적용
        tempCtx.scale(scale, scale);

        // 배경
        if (includeBackground) {
            tempCtx.fillStyle = '#ffffff';
            tempCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // 기존 설정 저장
        const oldShowGrid = this.canvas.showGrid;
        const oldShowAxes = this.canvas.showAxes;

        // 임시 설정
        this.canvas.showGrid = includeGrid;
        this.canvas.showAxes = includeAxes;

        // 임시 ctx로 교체하여 렌더링
        const originalCtx = this.canvas.ctx;
        this.canvas.ctx = tempCtx;

        if (includeGrid) this.canvas.drawGrid();
        if (includeAxes) this.canvas.drawAxes();

        for (const obj of this.objectManager.getAllObjects()) {
            if (obj.visible) {
                obj.render(this.canvas);
            }
        }

        // 복원
        this.canvas.ctx = originalCtx;
        this.canvas.showGrid = oldShowGrid;
        this.canvas.showAxes = oldShowAxes;

        // 다운로드
        if (format === 'png') {
            const link = document.createElement('a');
            link.download = `graph_${Date.now()}.png`;
            link.href = tempCanvas.toDataURL('image/png');
            link.click();
        } else {
            // SVG 내보내기 (간단 구현)
            this.exportSVG(includeBackground, includeGrid, includeAxes);
        }

        this.showToast(`${format.toUpperCase()} 파일로 내보냈습니다.`, 'success');
    }

    /**
     * SVG 내보내기
     */
    exportSVG(includeBackground = true, includeGrid = false, includeAxes = true) {
        // 간단한 SVG 생성 (추후 개선 필요)
        let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${this.canvas.width}" height="${this.canvas.height}">
`;

        if (includeBackground) {
            svg += `<rect width="100%" height="100%" fill="white"/>`;
        }

        // TODO: 객체들을 SVG 요소로 변환

        svg += `</svg>`;

        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `graph_${Date.now()}.svg`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    }

    /**
     * 채팅 설정
     */
    setupChat() {
        const input = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendMessage');
        const uploadBtn = document.getElementById('uploadImage');
        const imageInput = document.getElementById('imageInput');

        sendBtn?.addEventListener('click', () => {
            this.sendChatMessage();
        });

        input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendChatMessage();
            }
        });

        // 자동 높이 조절
        input?.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 100) + 'px';
        });

        uploadBtn?.addEventListener('click', () => {
            imageInput?.click();
        });

        imageInput?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) {
                this.handleImageUpload(file);
            }
        });
    }

    /**
     * AI 설정 모달 설정
     */
    setupAISettingsModal() {
        const modal = document.getElementById('aiSettingsModal');
        const providerSelect = document.getElementById('aiProvider');
        const apiKeyInput = document.getElementById('aiApiKey');
        const modelSelect = document.getElementById('aiModel');
        const saveBtn = document.getElementById('saveAISettings');
        const toggleBtn = document.getElementById('toggleApiKeyVisibility');
        const apiKeyGroup = document.getElementById('apiKeyGroup');

        /*
          AI 설정 진입점 변경
          - Mk2.1에서는 설정 탭 안에 AI 설정이 "인라인"으로 기본 노출됩니다.
          - 다만 과거 UI 또는 실험용 UI에서 모달 방식이 남아있을 수 있어
            호환 차원에서 settingsBtn 또는 openAISettings 같은 진입점이 존재하면 모달을 열도록 유지합니다.
        */
        ['settingsBtn', 'openAISettings'].forEach((id) => {
            document.getElementById(id)?.addEventListener('click', () => {
                this.showAISettingsModal();
            });
        });

        // 닫기 버튼들
        modal?.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        });

        // 배경 클릭으로 닫기
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });

        // 프로바이더 변경 시 모델 옵션 업데이트
        providerSelect?.addEventListener('change', () => {
            const provider = providerSelect.value;

            // API 키 그룹 표시/숨김
            if (apiKeyGroup) {
                apiKeyGroup.style.display = provider === 'local' ? 'none' : 'block';
            }

            // 모델 옵션 업데이트
            if (modelSelect) {
                modelSelect.innerHTML = '';
                if (provider === 'openai') {
                    modelSelect.add(new Option('GPT-5.2 (권장)', 'gpt-5.2'));
                    modelSelect.add(new Option('GPT-5.2 Pro (더 정확)', 'gpt-5.2-pro'));
                    modelSelect.add(new Option('GPT-5 Mini (빠름/저렴)', 'gpt-5-mini'));
                } else if (provider === 'gemini') {
                    modelSelect.add(new Option('Gemini 1.5 Flash', 'gemini-1.5-flash'));
                    modelSelect.add(new Option('Gemini 1.5 Pro', 'gemini-1.5-pro'));
                } else {
                    modelSelect.add(new Option('로컬 (패턴 매칭)', 'local'));
                }
            }
        });

        // API 키 보기/숨기기 토글
        toggleBtn?.addEventListener('click', () => {
            if (apiKeyInput) {
                const isPassword = apiKeyInput.type === 'password';
                apiKeyInput.type = isPassword ? 'text' : 'password';
                toggleBtn.querySelector('span').textContent = isPassword ? 'visibility_off' : 'visibility';
            }
        });

        // 저장 버튼
        saveBtn?.addEventListener('click', () => {
            const provider = providerSelect?.value || 'local';
            const apiKey = apiKeyInput?.value || '';
            const model = modelSelect?.value || '';

            // AIService에 설정 적용
            this.aiService.setProvider(provider);
            this.aiService.setApiKey(apiKey);
            this.aiService.config.model = model;
            this.aiService.config.save();

            modal.classList.add('hidden');
            this.showToast('AI 설정이 저장되었습니다.', 'success');
        });
    }

    /**
     * Mk2.1 AI 설정 패널
     * - 설정 탭에 AI 설정을 "바로 보이게" 제공하기 위한 인라인 UI 연결입니다.
     * - 모달과 다르게 숨김과 표시를 제어하지 않고, 화면에 항상 노출됩니다.
     */
    setupAISettingsPanel() {
        const providerSelect = document.getElementById('aiProviderPanel');
        const apiKeyInput = document.getElementById('aiApiKeyPanel');
        const modelSelect = document.getElementById('aiModelPanel');
        const saveBtn = document.getElementById('saveAISettingsPanel');
        const toggleBtn = document.getElementById('toggleApiKeyVisibilityPanel');
        const apiKeyGroup = document.getElementById('apiKeyGroupPanel');

        // HTML이 없는 경우 조용히 종료합니다
        if (!providerSelect || !apiKeyInput || !modelSelect || !saveBtn) {
            return;
        }

        // 프로바이더 변경 시 모델 옵션 업데이트
        providerSelect.addEventListener('change', () => {
            const provider = providerSelect.value;

            // API 키 그룹 표시와 숨김
            if (apiKeyGroup) {
                apiKeyGroup.style.display = provider === 'local' ? 'none' : 'block';
            }

            // 모델 옵션 업데이트
            modelSelect.innerHTML = '';
            if (provider === 'openai') {
                modelSelect.add(new Option('GPT-5.2 (권장)', 'gpt-5.2'));
                modelSelect.add(new Option('GPT-5.2 Pro (더 정확)', 'gpt-5.2-pro'));
                modelSelect.add(new Option('GPT-5 Mini (빠름/저렴)', 'gpt-5-mini'));
            } else if (provider === 'gemini') {
                modelSelect.add(new Option('Gemini 1.5 Flash', 'gemini-1.5-flash'));
                modelSelect.add(new Option('Gemini 1.5 Pro', 'gemini-1.5-pro'));
            } else {
                modelSelect.add(new Option('로컬 (패턴 매칭)', 'local'));
            }
        });

        // API 키 보기 토글
        toggleBtn?.addEventListener('click', () => {
            const isPassword = apiKeyInput.type === 'password';
            apiKeyInput.type = isPassword ? 'text' : 'password';
            toggleBtn.querySelector('span').textContent = isPassword ? 'visibility_off' : 'visibility';
        });

        // 저장
        saveBtn.addEventListener('click', () => {
            const provider = providerSelect.value || 'local';
            const apiKey = apiKeyInput.value || '';
            const model = modelSelect.value || '';

            this.aiService.setProvider(provider);
            this.aiService.setApiKey(apiKey);
            this.aiService.config.model = model;
            this.aiService.config.save();

            this.showToast('AI 설정이 저장되었습니다.', 'success');
        });

        // 현재 설정을 UI에 반영
        providerSelect.value = this.aiService.config.provider;
        apiKeyInput.value = this.aiService.config.apiKey;

        // change를 발생시켜 모델 목록을 provider에 맞게 재구성한 뒤 model 값을 설정합니다
        providerSelect.dispatchEvent(new Event('change'));
        modelSelect.value = this.aiService.config.model;

        if (apiKeyGroup) {
            apiKeyGroup.style.display = this.aiService.config.provider === 'local' ? 'none' : 'block';
        }
    }

    /**
     * AI 설정 모달 표시
     */
    showAISettingsModal() {
        const modal = document.getElementById('aiSettingsModal');
        const providerSelect = document.getElementById('aiProvider');
        const apiKeyInput = document.getElementById('aiApiKey');
        const modelSelect = document.getElementById('aiModel');
        const apiKeyGroup = document.getElementById('apiKeyGroup');

        // 현재 설정 로드
        if (providerSelect) {
            providerSelect.value = this.aiService.config.provider;
        }
        if (apiKeyInput) {
            apiKeyInput.value = this.aiService.config.apiKey;
        }
        if (modelSelect) {
            // 모델 목록 업데이트 후 현재 값 설정
            providerSelect?.dispatchEvent(new Event('change'));
            modelSelect.value = this.aiService.config.model;
        }
        if (apiKeyGroup) {
            apiKeyGroup.style.display = this.aiService.config.provider === 'local' ? 'none' : 'block';
        }

        modal?.classList.remove('hidden');
    }

    /**
     * 채팅 메시지 전송
     */
    sendChatMessage() {
        const input = document.getElementById('chatInput');
        const message = input?.value.trim();

        if (!message) return;

        // 사용자 메시지 추가
        this.addChatMessage(message, 'user');
        input.value = '';
        input.style.height = 'auto';

        // AI 응답 (현재는 시뮬레이션)
        setTimeout(() => {
            this.processAICommand(message);
        }, 500);
    }

    /**
     * 채팅 메시지 추가
     */
    addChatMessage(content, type) {
        const messages = document.getElementById('chatMessages');
        if (!messages) return;

        const div = document.createElement('div');
        div.className = `message ${type}`;
        div.innerHTML = `<div class="message-content">${content}</div>`;
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
    }

    /**
     * AI 명령 처리 (Mk.2: AIService 사용)
     */
    async processAICommand(message) {
        // JSON 형식인지 확인 - 직접 처리
        if (message.trim().startsWith('{') || message.trim().startsWith('[') ||
            message.trim().startsWith('```json')) {
            this.processAIJSON(message);
            return;
        }

        // 로딩 표시
        this.addChatMessage('처리 중... ⏳', 'assistant');

        // 현재 캔버스 상태를 컨텍스트로 전달
        const context = {
            objects: this.objectManager.getAllObjects().map(o => ({
                id: o.id,
                type: o.type,
                label: o.label
            }))
        };

        // AIService로 처리
        const result = await this.aiService.processCommand(message, context);

        // 로딩 메시지 제거
        const messages = document.getElementById('chatMessages');
        if (messages && messages.lastChild) {
            const lastMsg = messages.lastChild;
            if (lastMsg.textContent.includes('처리 중...')) {
                messages.removeChild(lastMsg);
            }
        }

        if (result.success && result.json) {
            // JSON 패치 적용
            this.processAIJSON(JSON.stringify(result.json));
        } else if (result.error) {
            this.addChatMessage(result.error, 'assistant');
        }

        this.updateSidebar();
    }

    /**
     * Mk.2: AI JSON 패치 처리
     */
    processAIJSON(jsonString) {
        // 1. 스키마 검증
        const validationResult = this.schemaValidator.parseAndValidate(jsonString);

        if (!validationResult.valid) {
            this.addChatMessage(
                `⚠️ JSON 검증 실패:\n• ${validationResult.errors.join('\n• ')}`,
                'assistant'
            );
            console.error('AI JSON 검증 실패:', validationResult.errors);
            return;
        }

        // 2. 파싱된 JSON 추출
        let data;
        try {
            let cleanJson = jsonString.trim();
            if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7);
            if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3);
            if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);
            data = JSON.parse(cleanJson.trim());
        } catch (e) {
            this.addChatMessage(`⚠️ JSON 파싱 실패: ${e.message}`, 'assistant');
            return;
        }

        // 3. 참조 ID 검증
        const existingIds = new Set(this.objectManager.getAllObjects().map(o => o.id));
        const refResult = this.schemaValidator.validateReferences(data, existingIds);

        if (!refResult.valid) {
            this.addChatMessage(
                `⚠️ 참조 검증 실패:\n• ${refResult.errors.join('\n• ')}`,
                'assistant'
            );
            console.error('AI 참조 검증 실패:', refResult.errors);
            return;
        }

        // 4. 패치 적용
        const patchResult = this.patchApplier.apply(data);

        if (patchResult.success) {
            this.render();
            this.updateSidebar();
            this.addChatMessage(`✅ ${patchResult.message}`, 'assistant');
        } else {
            this.addChatMessage(
                `❌ 적용 실패: ${patchResult.message}\n${patchResult.errors.join('\n')}`,
                'assistant'
            );
            console.error('AI 패치 적용 실패:', patchResult);
        }
    }

    /**
     * 이미지 업로드 처리 (AIService 비전 사용)
     */
    handleImageUpload(file) {
        const reader = new FileReader();

        reader.onload = async (e) => {
            const imageDataUrl = e.target.result;

            // 이미지 미리보기 메시지
            this.addChatMessage(`<img src="${imageDataUrl}" style="max-width: 200px; border-radius: 8px;">`, 'user');

            // 로딩 메시지
            this.addChatMessage('이미지를 분석 중입니다... 🔍', 'assistant');

            // AIService로 이미지 분석
            const result = await this.aiService.analyzeImage(imageDataUrl);

            // 로딩 메시지 제거
            const messages = document.getElementById('chatMessages');
            if (messages && messages.lastChild) {
                const lastMsg = messages.lastChild;
                if (lastMsg.textContent.includes('분석 중')) {
                    messages.removeChild(lastMsg);
                }
            }

            if (result.success && result.json) {
                this.addChatMessage('이미지에서 도형을 인식했습니다! 📐', 'assistant');
                this.processAIJSON(JSON.stringify(result.json));
            } else if (result.error) {
                this.addChatMessage(`❌ ${result.error}`, 'assistant');
            } else {
                this.addChatMessage('이미지에서 도형을 인식하지 못했습니다. 다시 시도해주세요.', 'assistant');
            }
        };

        reader.readAsDataURL(file);
    }

    /**
     * 토스트 알림
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }

    /**
     * 로컬 저장
     */
    saveToLocal() {
        const data = {
            version: '1.0',
            canvas: {
                offsetX: this.canvas.offset.x,
                offsetY: this.canvas.offset.y,
                scale: this.canvas.scale
            },
            objects: this.objectManager.toJSON()
        };

        localStorage.setItem('graphA_save', JSON.stringify(data));
        this.showToast('저장되었습니다.', 'success');
    }

    /**
     * 로컬에서 불러오기
     */
    loadFromLocal() {
        const saved = localStorage.getItem('graphA_save');
        if (!saved) {
            this.showToast('저장된 데이터가 없습니다.', 'warning');
            return;
        }

        try {
            const data = JSON.parse(saved);

            if (data.canvas) {
                this.canvas.offset.x = data.canvas.offsetX;
                this.canvas.offset.y = data.canvas.offsetY;
                this.canvas.scale = data.canvas.scale;
            }

            if (data.objects) {
                this.objectManager.fromJSON(data.objects);
            }

            // A freshly loaded document becomes the new baseline state.
            this.historyManager.clear();
            this.updateSidebar();
            this.updateZoomDisplay();
            this.render();

            this.showToast('불러왔습니다.', 'success');
        } catch (error) {
            this.showToast('데이터를 불러오는 중 오류가 발생했습니다.', 'error');
            console.error(error);
        }
    }

    /**
     * Mk.4: 수직선 모달 설정
     */
    setupNumberLineModal() {
        const modal = document.getElementById('numberLineModal');
        const createBtn = document.getElementById('nlCreateBtn');
        const cancelBtn = document.getElementById('nlCancelBtn');

        if (!modal || !createBtn || !cancelBtn) return;

        // 생성 버튼
        createBtn.addEventListener('click', () => {
            const start = parseFloat(document.getElementById('nlStart').value) || -5;
            const end = parseFloat(document.getElementById('nlEnd').value) || 5;
            const step = Math.max(0.1, parseFloat(document.getElementById('nlStep').value) || 1);
            const y = parseFloat(document.getElementById('nlY').value) || 0;

            if (start >= end) {
                this.showToast('끝값이 시작값보다 커야 합니다', 'warning');
                return;
            }

            const numberLine = this.objectManager.createNumberLine({
                start, end, step, y
            });

            this.historyManager.recordCreate(numberLine);
            this.render();
            this.updateSidebar();
            this.showToast(`수직선 생성됨 (${start} ~ ${end})`, 'success');

            modal.classList.add('hidden');
            this.toolManager.returnToSelect();
        });

        // 취소 버튼
        cancelBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            this.toolManager.returnToSelect();
        });

        // 오버레이 클릭으로 닫기
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
                this.toolManager.returnToSelect();
            }
        });

        // ESC 키로 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                modal.classList.add('hidden');
                this.toolManager.returnToSelect();
            }
        });
    }
}

// 앱 시작
document.addEventListener('DOMContentLoaded', () => {
    window.app = new GraphAApp();
});

export default GraphAApp;
11
