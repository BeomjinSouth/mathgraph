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
import { TextTool } from './tools/TextTool.js';
import { CurvedSolidTool } from './tools/CurvedSolidTool.js';
import { FillTool } from './tools/FillTool.js';
import { AreaExportTool } from './tools/AreaExportTool.js';

// 유틸리티
import { Vec2 } from './utils/Geometry.js';
import { MathUtils } from './utils/MathUtils.js';

// Mk.2: AI 모듈
import { SchemaValidator } from './ai/SchemaValidator.js';
import { PatchApplier } from './ai/PatchApplier.js';
import {
    AIService,
    DEFAULT_OPENAI_MODEL,
    OPENAI_MODEL_OPTIONS,
    GEMINI_MODEL_OPTIONS,
    AI_IMAGE_PREPROCESS_JPEG_QUALITY,
    chooseImagePreprocessPlan,
    formatAIValidationMessage
} from './ai/AIService.js';
import { parseAIJSONPayload } from './ai/JSONUtils.js';

// Mk.2: UI 모듈
import { AlgebraInput } from './ui/AlgebraInput.js';
import { CommandPalette } from './ui/CommandPalette.js';
import { getGeneratedIconName, hydrateGeneratedIcons, setGeneratedIcon } from './ui/IconRenderer.js';
import { SettingsManager } from './core/SettingsManager.js';
import {
    getAreaExportAxisOverlayGeometry,
    scaleExportAreaRect
} from './utils/ExportArea.js';
import { getScaledAxisArrowStyle } from './utils/AxisArrowStyle.js';
import { escapeHtml } from './utils/Html.js';
import { remapObjectReferences } from './utils/ObjectReferences.js';
import { applyRecordedPropertyChange } from './utils/HistoryEdits.js';
import {
    createAnimationFrameCoalescer,
    isCompactViewport,
    nextCompactPanelState
} from './utils/ResponsiveLayout.js';
import {
    createProjectEnvelope,
    parseProjectFile
} from './utils/ProjectFile.js';
import {
    getPhysicalExportPlan,
    TEACHER_EXPORT_PRESETS
} from './utils/TeacherExport.js';
import { buildCurvedSolidInput } from './utils/CurvedSolidInput.js';
import { TeacherWorkflow } from './ui/TeacherWorkflow.js';
import { analyzeDrawingSupport } from './ai/SupportPreflight.js';

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
        this.lastImageReference = null;
        this.authSession = this.loadAuthSession();
        this.applyAuthSession(this.authSession, { persist: false, syncUi: false });

        // Mk.2: UI 모듈 초기화
        this.algebraInput = new AlgebraInput(this.objectManager);
        this.commandPalette = new CommandPalette(this);

        // Mk.2: 설정 관리 초기화
        this.settingsManager = new SettingsManager();
        this.syncDefaultPointParams();
        this.syncCanvasViewSettings();

        // Mk.4: 숨김 객체 보기 상태 초기화
        this.showHiddenObjects = false;
        this.currentFillColor = '#000000';
        this.currentFillOpacity = 0.24;
        this.projectName = localStorage.getItem('graphA_project_name') || '수학 시험 그림';
        this.lastSupportResult = analyzeDrawingSupport('');

        this.setupTools();
        this.setupUI();
        this.setupResponsiveLayout();
        this.setupTeacherWorkflow();
        this.setupEventListeners();

        // 초기 렌더링
        this.render();

        console.log('그래프A Mk2.1 준비 완료! 📐');
    }

    syncDefaultPointParams() {
        this.objectManager.setDefaultPointParams(this.settingsManager.getDefaultPointParams());
    }

    syncCanvasViewSettings() {
        this.canvas.showAxisNumbers = this.settingsManager.showAxisNumbers;
        this.canvas.axisNumberInterval = this.settingsManager.axisNumberInterval;
    }

    getAuthSessionStorageKey() {
        return 'graphA_auth_session';
    }

    loadAuthSession() {
        try {
            const saved = sessionStorage.getItem(this.getAuthSessionStorageKey());
            if (!saved) return null;

            const session = JSON.parse(saved);
            if (session?.mode === 'owner') {
                const expiresAt = Number(session.expiresAt) || 0;
                if (!session.token || expiresAt <= Date.now()) {
                    sessionStorage.removeItem(this.getAuthSessionStorageKey());
                    return null;
                }
                return {
                    mode: 'owner',
                    displayName: session.displayName || '박범진',
                    token: session.token,
                    expiresAt
                };
            }

            if (session?.mode === 'guest') {
                return { mode: 'guest', displayName: '게스트' };
            }
        } catch (error) {
            console.warn('Auth session load failed:', error);
        }

        return null;
    }

    saveAuthSession(session) {
        if (!session) {
            sessionStorage.removeItem(this.getAuthSessionStorageKey());
            return;
        }

        sessionStorage.setItem(this.getAuthSessionStorageKey(), JSON.stringify(session));
    }

    applyAuthSession(session, options = {}) {
        const { persist = true, syncUi = true } = options;
        this.authSession = session || null;

        if (persist) {
            this.saveAuthSession(this.authSession);
        }

        if (this.authSession?.mode === 'owner') {
            this.aiService.setAuthSession({
                mode: 'owner',
                token: this.authSession.token,
                expiresAt: this.authSession.expiresAt
            });
        } else {
            this.aiService.setAuthSession({ mode: 'guest' });
        }

        if (syncUi) {
            this.syncAuthModeUI();
            this.syncAISettingsControls();
        }
    }

    isOwnerMode() {
        return this.authSession?.mode === 'owner'
            && this.aiService.config.authMode === 'owner'
            && Boolean(this.aiService.config.proxyToken);
    }

    /**
     * 로그아웃 - 세션(오너 토큰 포함)을 지우고 로그인 랜딩으로 돌아갑니다.
     * applyAuthSession(null)이 sessionStorage 세션 제거와 프록시 토큰 초기화까지 수행합니다.
     */
    logout() {
        this.applyAuthSession(null);
        // 공용 PC에서 다음 사용자에게 게스트 API 키가 노출되지 않도록 자격 증명을 지운다.
        this.aiService.clearCredentials();
        this.syncAISettingsControls();
        this.setAuthMessage('', 'info');
        this.showToast('로그아웃되었습니다.', 'info');
    }

    syncAuthModeUI() {
        const landing = document.getElementById('authLanding');
        const badge = document.getElementById('authModeBadge');
        const isAuthenticated = Boolean(this.authSession);

        document.body.classList.toggle('auth-locked', !isAuthenticated);
        landing?.classList.toggle('hidden', isAuthenticated);

        if (badge) {
            if (this.isOwnerMode()) {
                badge.textContent = '박범진 · 기본 API';
                badge.className = 'auth-mode-badge owner';
            } else if (this.authSession?.mode === 'guest') {
                badge.textContent = '게스트 · 직접 API';
                badge.className = 'auth-mode-badge guest';
            } else {
                badge.textContent = '로그인 필요';
                badge.className = 'auth-mode-badge';
            }
        }

        if (!isAuthenticated) {
            requestAnimationFrame(() => document.getElementById('ownerNameInput')?.focus());
        }
    }

    setAuthMessage(message = '', type = 'info') {
        const messageEl = document.getElementById('authLoginMessage');
        if (!messageEl) return;
        messageEl.textContent = message;
        messageEl.dataset.type = type;
    }

    async loginAsOwner(name, password) {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, password })
        });

        let payload = null;
        try {
            payload = await response.json();
        } catch {
            payload = null;
        }

        if (!response.ok) {
            throw new Error(payload?.error || '로그인 요청에 실패했습니다.');
        }

        if (!payload?.token || !payload?.expiresAt) {
            throw new Error('로그인 토큰을 받지 못했습니다.');
        }

        return {
            mode: 'owner',
            displayName: payload.displayName || '박범진',
            token: payload.token,
            expiresAt: payload.expiresAt
        };
    }

    setupAuthLanding() {
        const landing = document.getElementById('authLanding');
        const form = document.getElementById('ownerLoginForm');
        const input = document.getElementById('ownerNameInput');
        const passwordInput = document.getElementById('ownerPasswordInput');
        const guestButton = document.getElementById('guestLoginButton');
        const ownerButton = document.getElementById('ownerLoginButton');

        if (!landing || !form || !input || !guestButton) {
            return;
        }

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const name = input.value.trim();
            const password = passwordInput?.value || '';
            if (!name) {
                this.setAuthMessage('이름을 입력하세요.', 'warning');
                input.focus();
                return;
            }
            if (!password) {
                this.setAuthMessage('비밀번호를 입력하세요.', 'warning');
                passwordInput?.focus();
                return;
            }

            ownerButton.disabled = true;
            this.setAuthMessage('로그인 확인 중...', 'info');

            try {
                const session = await this.loginAsOwner(name, password);
                if (passwordInput) {
                    passwordInput.value = '';
                }
                this.applyAuthSession(session);
                this.setAuthMessage('');
                this.showToast('박범진 모드로 시작합니다. OpenAI 기본 API를 사용합니다.', 'success');
            } catch (error) {
                this.setAuthMessage(error?.message || '로그인에 실패했습니다.', 'error');
            } finally {
                ownerButton.disabled = false;
            }
        });

        guestButton.addEventListener('click', () => {
            this.applyAuthSession({ mode: 'guest', displayName: '게스트' });
            this.setAuthMessage('');
            this.showToast('게스트 모드입니다. AI 설정에서 API 키를 직접 입력하세요.', 'info');
        });

        this.syncAuthModeUI();
    }

    isPointLikeObject(obj) {
        return ['point', 'pointOnObject', 'intersection', 'midpoint'].includes(obj?.type);
    }

    getPointLikeObjects(objects = this.objectManager.getAllObjects()) {
        return objects.filter(obj => this.isPointLikeObject(obj));
    }

    formatPointSize(size) {
        const normalized = this.settingsManager.normalizePointSize(size);
        return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(1);
    }

    syncPointSizeRange(input, display, size) {
        const normalized = this.settingsManager.normalizePointSize(size);
        if (input) {
            input.value = String(normalized);
        }
        if (display) {
            display.textContent = this.formatPointSize(normalized);
        }
        return normalized;
    }

    createPointSizeControl({ labelText = '점 크기:', value = 4, noteText = '', onInput }) {
        const row = document.createElement('div');
        row.className = 'property-row point-size-row';

        const label = document.createElement('label');
        label.textContent = labelText;

        const input = document.createElement('input');
        input.type = 'range';
        input.min = '0';
        input.max = '20';
        input.step = '1';
        input.className = 'prop-slider point-size-slider';

        const display = document.createElement('span');
        display.className = 'value-display point-size-value';

        row.append(label, input, display);

        if (noteText) {
            const note = document.createElement('span');
            note.className = 'property-note';
            note.textContent = noteText;
            row.appendChild(note);
        }

        const setValue = (nextSize) => this.syncPointSizeRange(input, display, nextSize);
        setValue(value);

        input.addEventListener('mousedown', e => e.stopPropagation());
        input.addEventListener('click', e => e.stopPropagation());
        input.addEventListener('input', (e) => {
            const size = setValue(e.target.value);
            onInput?.(size, e);
        });

        return { row, input, display, setValue };
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
        this.toolManager.registerTool('fill', new FillTool());
        this.toolManager.registerTool('areaExport', new AreaExportTool());

        // Mk.4: 수직선 도구
        this.toolManager.registerTool('numberLine', new NumberLineTool());
        this.toolManager.registerTool('textLabel', new TextTool());
        this.toolManager.registerTool('cylinder', new CurvedSolidTool('cylinder'));
        this.toolManager.registerTool('cone', new CurvedSolidTool('cone'));
        this.toolManager.registerTool('sphere', new CurvedSolidTool('sphere'));

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
                        const icon = getGeneratedIconName(item.querySelector('.material-symbols-outlined'));
                        if (icon) {
                            setGeneratedIcon(trigger.querySelector('.material-symbols-outlined'), icon);
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
        this.setupFillControls();

        // 되돌리기/다시하기
        document.getElementById('undoBtn')?.addEventListener('click', () => {
            this.historyManager.undo();
            this.render();
        });

        document.getElementById('redoBtn')?.addEventListener('click', () => {
            this.historyManager.redo();
            this.render();
        });

        // 저장/불러오기 (명령 팔레트 외에 툴바에서도 접근 가능하도록)
        document.getElementById('saveSceneBtn')?.addEventListener('click', () => {
            this.saveToLocal();
        });

        document.getElementById('loadSceneBtn')?.addEventListener('click', () => {
            this.loadFromLocal();
        });

        // 로그아웃 (공용 PC에서 오너 세션이 남지 않도록)
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            this.logout();
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
        const showAxisNumbersPanel = document.getElementById('showAxisNumbersPanel');
        const axisNumberIntervalPanel = document.getElementById('axisNumberIntervalPanel');

        showGridPanel?.addEventListener('change', (e) => {
            this.setGridVisibility(e.target.checked, { syncInputs: false });
        });
        showXAxisPanel?.addEventListener('change', (e) => {
            this.setAxesVisibility(e.target.checked, this.canvas.showYAxis, { syncInputs: false });
        });
        showYAxisPanel?.addEventListener('change', (e) => {
            this.setAxesVisibility(this.canvas.showXAxis, e.target.checked, { syncInputs: false });
        });
        showAxisNumbersPanel?.addEventListener('change', (e) => {
            this.setAxisNumbersVisibility(e.target.checked, { syncInputs: false });
        });
        axisNumberIntervalPanel?.addEventListener('change', (e) => {
            this.setAxisNumberInterval(e.target.value, { syncInputs: false });
        });

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
        this.syncViewToggleInputs();
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
            this.toggleToolPanel();
        });

        // 우측 패널 토글
        document.getElementById('toggleRightSidebar')?.addEventListener('click', () => {
            this.togglePropertyPanel();
        });

        // 참고
        // - 예전에는 캔버스 우측상단의 "tune" 버튼(openPropertyPanel)로 우측 패널을 열 수 있었으나,
        //   해당 플로팅 UI를 제거했기 때문에 관련 이벤트 리스너도 함께 제거합니다.

        // 채팅 패널 토글
        document.getElementById('toggleChat')?.addEventListener('click', (e) => {
            e.stopPropagation();
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
            this.syncDefaultPointParams();
            this.render();
            this.showToast(newState ? '모든 점 숨김' : '모든 점 표시', 'info');

            // 아이콘 변경
            const btn = document.getElementById('hideAllPoints');
            const icon = btn?.querySelector('.material-symbols-outlined');
            if (icon) {
                setGeneratedIcon(icon, newState ? 'visibility' : 'visibility_off');
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

        const defaultPointSizeInput = document.getElementById('defaultPointSize');
        const defaultPointSizeValue = document.getElementById('defaultPointSizeValue');
        if (defaultPointSizeInput) {
            this.syncPointSizeRange(defaultPointSizeInput, defaultPointSizeValue, this.settingsManager.defaultStyles.pointSize);
            defaultPointSizeInput.addEventListener('input', (e) => {
                const pointSize = this.syncPointSizeRange(defaultPointSizeInput, defaultPointSizeValue, e.target.value);
                this.settingsManager.setDefaultPointSize(pointSize);
                this.syncDefaultPointParams();
            });
        }

        const defaultPointBodyHidden = document.getElementById('defaultPointBodyHidden');
        if (defaultPointBodyHidden) {
            defaultPointBodyHidden.checked = this.settingsManager.hideNewPointBodies;
            defaultPointBodyHidden.addEventListener('change', (e) => {
                this.settingsManager.setHideNewPointBodies(e.target.checked);
                this.syncDefaultPointParams();
                this.showToast(e.target.checked ? '새 점은 이름만 표시됩니다.' : '새 점 본체가 다시 표시됩니다.', 'info');
            });
        }

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

        const bulkPointSizeInput = document.getElementById('bulkPointSize');
        const bulkPointSizeValue = document.getElementById('bulkPointSizeValue');
        if (bulkPointSizeInput) {
            this.syncPointSizeRange(bulkPointSizeInput, bulkPointSizeValue, this.settingsManager.defaultStyles.pointSize);
            bulkPointSizeInput.addEventListener('input', (e) => {
                this.syncPointSizeRange(bulkPointSizeInput, bulkPointSizeValue, e.target.value);
            });
        }

        document.getElementById('applyBulkPointSize')?.addEventListener('click', () => {
            const pointSize = this.syncPointSizeRange(bulkPointSizeInput, bulkPointSizeValue, bulkPointSizeInput?.value);
            const changedCount = this.settingsManager.applyPointSizeToAll(this.objectManager, pointSize);
            this.render();
            this.updateSidebar();
            this.updatePropertyPanel();
            this.showToast(`${changedCount}개 점에 크기 적용됨`, 'success');
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

        document.getElementById('areaExportBtn')?.addEventListener('click', () => {
            this.startAreaExport();
        });

        const projectNameInput = document.getElementById('projectNameInput');
        if (projectNameInput) {
            projectNameInput.value = this.projectName;
            projectNameInput.addEventListener('change', () => {
                this.setProjectName(projectNameInput.value);
            });
        }

        document.getElementById('projectExportBtn')?.addEventListener('click', () => {
            this.exportProjectFile();
        });

        const projectImportInput = document.getElementById('projectImportInput');
        document.getElementById('projectImportBtn')?.addEventListener('click', () => {
            projectImportInput?.click();
        });
        projectImportInput?.addEventListener('change', async () => {
            const file = projectImportInput.files?.[0];
            projectImportInput.value = '';
            if (!file) return;
            await this.importProjectFile(file);
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
        this.setupAuthLanding();

        // Mk.4: 수직선 모달
        this.setupNumberLineModal();
        this.setupTextLabelModal();
        this.setupCurvedSolidModal();
        hydrateGeneratedIcons(document);
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
            areaExport: '영역 저장',
            select: '선택', point: '점', pointOnObject: '선 위의 점',
            intersection: '교점', midpoint: '중점', segment: '선분',
            line: '직선', ray: '반직선', vector: '벡터',
            parallel: '평행선', perpendicular: '수선',
            perpendicularBisector: '수직이등분선', angleBisector: '각의 이등분선',
            tangentCircle: '원의 접선', tangentFunction: '함수 접선',
            circle: '원', circleThreePoints: '세 점 원',
            arc: '호', sector: '부채꼴', circularSegment: '활꼴',
            polygon: '다각형', fill: '채우기', prism: '각기둥', pyramid: '각뿔',
            angleDimension: '각도', lengthDimension: '길이',
            rightAngle: '직각', equalLength: '같은 길이',
            numberLine: '수직선', textLabel: '텍스트',
            cylinder: '원기둥', cone: '원뿔', sphere: '구',
            function: '함수'
        };

        const toolIcons = {
            areaExport: 'crop_free',
            select: 'near_me',
            point: 'fiber_manual_record',
            pointOnObject: 'commit',
            intersection: 'hub',
            midpoint: 'radio_button_checked',
            segment: 'horizontal_rule',
            line: 'diagonal_line',
            ray: 'arrow_right_alt',
            vector: 'arrow_outward',
            parallel: 'drag_handle',
            perpendicular: 'add',
            perpendicularBisector: 'vertical_align_center',
            angleBisector: 'call_split',
            tangentCircle: 'motion_photos_pause',
            tangentFunction: 'query_stats',
            circle: 'radio_button_unchecked',
            circleThreePoints: 'filter_tilt_shift',
            arc: 'rss_feed',
            sector: 'donut_small',
            circularSegment: 'nightlight_round',
            polygon: 'pentagon',
            fill: 'format_color_fill',
            prism: 'view_in_ar',
            pyramid: 'details',
            angleDimension: 'angle',
            lengthDimension: 'architecture',
            rightAngle: 'square_foot',
            equalLength: 'straighten',
            numberLine: 'timeline',
            textLabel: 'text_fields',
            cylinder: 'view_in_ar',
            cone: 'change_history',
            sphere: 'circle',
            function: 'functions'
        };

        const nameEl = document.getElementById('currentToolName');
        if (nameEl) {
            nameEl.textContent = toolNames[toolName] || toolName;
        }

        setGeneratedIcon(document.getElementById('currentToolIcon'), toolIcons[toolName] || 'near_me');
    }

    /**
     * 이벤트 리스너 설정
     */
    setupFillControls() {
        const colorInput = document.getElementById('fillColorInput');
        const opacityInput = document.getElementById('fillOpacityInput');
        const opacityValue = document.getElementById('fillOpacityValue');

        if (colorInput) {
            this.currentFillColor = colorInput.value || this.currentFillColor;
            colorInput.addEventListener('input', (event) => {
                this.currentFillColor = event.target.value || '#000000';
            });
        }

        if (opacityInput) {
            const syncOpacity = () => {
                const next = Number.parseFloat(opacityInput.value);
                this.currentFillOpacity = Number.isFinite(next) ? next : 0.24;
                if (opacityValue) {
                    opacityValue.textContent = `${Math.round(this.currentFillOpacity * 100)}%`;
                }
            };
            syncOpacity();
            opacityInput.addEventListener('input', syncOpacity);
        }
    }

    readPanelOpenState() {
        return {
            toolOpen: !document.getElementById('tool-panel')?.classList.contains('collapsed'),
            propertyOpen: !document.getElementById('property-panel')?.classList.contains('collapsed')
        };
    }

    applyPanelOpenState(state) {
        const nextState = {
            toolOpen: Boolean(state?.toolOpen),
            propertyOpen: Boolean(state?.propertyOpen)
        };
        const toolPanel = document.getElementById('tool-panel');
        const propertyPanel = document.getElementById('property-panel');
        const leftToggle = document.getElementById('toggleLeftSidebar');
        const rightToggle = document.getElementById('toggleRightSidebar');

        toolPanel?.classList.toggle('collapsed', !nextState.toolOpen);
        propertyPanel?.classList.toggle('collapsed', !nextState.propertyOpen);
        leftToggle?.setAttribute('aria-expanded', String(nextState.toolOpen));
        rightToggle?.setAttribute('aria-expanded', String(nextState.propertyOpen));

        const leftIcon = leftToggle?.querySelector('.material-symbols-outlined');
        const rightIcon = rightToggle?.querySelector('.material-symbols-outlined');
        if (leftIcon) {
            setGeneratedIcon(leftIcon, nextState.toolOpen ? 'left_panel_close' : 'left_panel_open');
        }
        if (rightIcon) {
            setGeneratedIcon(rightIcon, nextState.propertyOpen ? 'right_panel_close' : 'right_panel_open');
        }

        this.scheduleCanvasResize?.();
    }

    toggleToolPanel() {
        if (this.isCompactLayout) {
            this.compactPanelState = nextCompactPanelState(this.compactPanelState, 'toggleTool');
            this.applyPanelOpenState(this.compactPanelState);
            return;
        }

        const current = this.readPanelOpenState();
        this.desktopPanelState = { ...current, toolOpen: !current.toolOpen };
        this.applyPanelOpenState(this.desktopPanelState);
    }

    togglePropertyPanel() {
        if (this.isCompactLayout) {
            this.compactPanelState = nextCompactPanelState(this.compactPanelState, 'toggleProperty');
            this.applyPanelOpenState(this.compactPanelState);
            return;
        }

        const current = this.readPanelOpenState();
        this.desktopPanelState = { ...current, propertyOpen: !current.propertyOpen };
        this.applyPanelOpenState(this.desktopPanelState);
    }

    syncViewportMode() {
        if (typeof this.isCompactLayout !== 'boolean') return;
        const matches = this.compactMediaQuery
            ? Boolean(this.compactMediaQuery.matches)
            : isCompactViewport(window.innerWidth);
        if (matches !== this.isCompactLayout) {
            this.handleCompactViewportChange?.({ matches });
        }
    }

    setupResponsiveLayout() {
        const toolPanel = document.getElementById('tool-panel');
        const propertyPanel = document.getElementById('property-panel');
        const canvasContainer = document.getElementById('canvas-container');
        if (!toolPanel || !propertyPanel || !canvasContainer) return;

        this.desktopPanelState = this.readPanelOpenState();
        this.compactPanelState = { toolOpen: false, propertyOpen: false };

        const requestFrame = typeof window.requestAnimationFrame === 'function'
            ? window.requestAnimationFrame.bind(window)
            : callback => setTimeout(callback, 0);
        this.scheduleCanvasResize = createAnimationFrameCoalescer(() => {
            this.canvas.resize();
            this.render();
        }, requestFrame);

        if (typeof ResizeObserver === 'function') {
            this.canvasResizeObserver = new ResizeObserver(() => {
                // 일부 임베디드 환경은 matchMedia change 이벤트를 전달하지 않으므로
                // 컨테이너 크기가 바뀔 때마다 현재 뷰포트 모드를 동기적으로 재확인한다.
                this.syncViewportMode();
                this.scheduleCanvasResize();
            });
            this.canvasResizeObserver.observe(canvasContainer);
        }

        const applyViewportMode = compact => {
            const wasCompact = this.isCompactLayout;
            if (compact && wasCompact !== true) {
                this.desktopPanelState = this.readPanelOpenState();
                this.compactPanelState = { toolOpen: false, propertyOpen: false };
            }

            this.isCompactLayout = compact;
            this.applyPanelOpenState(compact ? this.compactPanelState : this.desktopPanelState);
        };

        this.compactMediaQuery = typeof window.matchMedia === 'function'
            ? window.matchMedia('(max-width: 900px)')
            : null;
        const initialCompact = this.compactMediaQuery
            ? this.compactMediaQuery.matches
            : isCompactViewport(window.innerWidth);
        applyViewportMode(initialCompact);

        this.handleCompactViewportChange = event => applyViewportMode(Boolean(event.matches));
        if (typeof this.compactMediaQuery?.addEventListener === 'function') {
            this.compactMediaQuery.addEventListener('change', this.handleCompactViewportChange);
        } else if (typeof this.compactMediaQuery?.addListener === 'function') {
            this.compactMediaQuery.addListener(this.handleCompactViewportChange);
        }

    }

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
            this.syncViewportMode?.();
            if (this.scheduleCanvasResize) {
                this.scheduleCanvasResize();
            } else {
                this.canvas.resize();
                this.render();
            }
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

        // 붙여넣기 전체를 하나의 undo 단위로 묶습니다.
        this.historyManager.beginTransaction();

        // 각 객체를 새로 생성
        for (const objData of this.clipboard) {
            let newData = { ...objData };

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

            newData = remapObjectReferences(newData, idMap);

            // 객체 생성
            const newObj = this.objectManager.createFromJSON(newData);
            if (newObj) {
                this.objectManager.addObject(newObj);
                newObjects.push(newObj);
                this.historyManager.recordCreate(newObj);
            }
        }

        this.historyManager.commitTransaction();

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
     * 속성 편집을 히스토리 기록과 함께 적용합니다.
     * 슬라이더/색상 피커처럼 input으로 라이브 반영된 편집은 oldValue로 시작값을 넘겨
     * 종료 시점에 한 번만 기록합니다.
     */
    recordObjectPropertyEdit(obj, property, newValue, { oldValue, apply } = {}) {
        return applyRecordedPropertyChange({
            object: obj,
            property,
            newValue,
            oldValue,
            historyManager: this.historyManager,
            apply
        });
    }

    /**
     * 개별 속성 UI 업데이트 (간소화 버전)
     */
    updateIndividualProperties(selected) {
        const container = document.getElementById('individualProperty');
        if (!container) return;

        container.innerHTML = '';

        const selectedPointLikeObjects = this.getPointLikeObjects(selected);
        if (selected.length > 1 && selectedPointLikeObjects.length > 0) {
            const currentSize = selectedPointLikeObjects.every(obj => obj.pointSize === selectedPointLikeObjects[0].pointSize)
                ? selectedPointLikeObjects[0].pointSize
                : this.settingsManager.defaultStyles.pointSize;
            // 일괄 크기 변경도 한 번의 undo 단위가 되도록 시작값을 기억했다가 종료 시 배치 기록한다.
            let bulkSizeStart;
            const sizeControl = this.createPointSizeControl({
                labelText: '선택 점 크기:',
                value: currentSize,
                noteText: `${selectedPointLikeObjects.length}개`,
                onInput: (size) => {
                    if (!bulkSizeStart) {
                        bulkSizeStart = new Map(selectedPointLikeObjects.map(obj => [obj.id, obj.pointSize]));
                    }
                    this.settingsManager.applyPointSizeToObjects(selectedPointLikeObjects, size);
                    this.render();
                    this.updateSidebar();
                }
            });
            sizeControl.input.addEventListener('change', () => {
                if (!bulkSizeStart) return;
                this.historyManager.beginTransaction();
                for (const obj of selectedPointLikeObjects) {
                    const startSize = bulkSizeStart.get(obj.id);
                    if (startSize !== obj.pointSize) {
                        this.historyManager.recordPropertyChange(obj.id, 'pointSize', startSize, obj.pointSize);
                    }
                }
                this.historyManager.commitTransaction();
                bulkSizeStart = undefined;
            });
            container.appendChild(sizeControl.row);
        }

        if (selected.length === 1) {
            const obj = selected[0];

            // 이름 또는 독립 텍스트 수정
            const nameRow = document.createElement('div');
            nameRow.className = 'property-row';
            nameRow.innerHTML = `
                <label>${obj.type === 'textLabel' ? '텍스트:' : '이름:'}</label>
                <input type="text" class="prop-input">
            `;
            const nameInput = nameRow.querySelector('input');
            nameInput.value = obj.type === 'textLabel' ? obj.text : (obj.label || '');
            // 이벤트 버블링 차단 - 클릭 시 선택 해제 방지
            nameInput.addEventListener('mousedown', e => e.stopPropagation());
            nameInput.addEventListener('click', e => e.stopPropagation());
            nameInput.addEventListener('change', (e) => {
                if (obj.type === 'textLabel') {
                    this.recordObjectPropertyEdit(obj, 'text', e.target.value, {
                        apply: (target, value) => {
                            target.text = value;
                            target.update();
                        }
                    });
                } else {
                    this.recordObjectPropertyEdit(obj, 'label', e.target.value);
                }
                this.updateSidebar(); // 목록 이름 업데이트
                this.render();
            });
            container.appendChild(nameRow);

            // 색상 수정
            const colorRow = document.createElement('div');
            colorRow.className = 'property-row';
            colorRow.innerHTML = `
                <label>색상:</label>
                <input type="color" value="${escapeHtml(obj.color)}" class="prop-input">
            `;
            const colorInput = colorRow.querySelector('input');
            colorInput.addEventListener('mousedown', e => e.stopPropagation());
            colorInput.addEventListener('click', e => e.stopPropagation());
            // 피커 드래그 동안은 라이브 반영만 하고, 닫힐 때(change) 시작값 대비 한 번만 기록한다.
            let colorEditStart;
            colorInput.addEventListener('input', (e) => {
                if (colorEditStart === undefined) colorEditStart = obj.color;
                obj.color = e.target.value;
                this.render();
                this.updateSidebar(); // 목록 아이콘 색상 업데이트
            });
            colorInput.addEventListener('change', (e) => {
                const startColor = colorEditStart !== undefined ? colorEditStart : obj.color;
                colorEditStart = undefined;
                this.recordObjectPropertyEdit(obj, 'color', e.target.value, { oldValue: startColor });
                this.render();
                this.updateSidebar();
            });
            container.appendChild(colorRow);

            if (obj.type === 'textLabel') {
                const fontRow = document.createElement('div');
                fontRow.className = 'property-row';
                fontRow.innerHTML = `
                    <label>글씨:</label>
                    <input type="range" min="10" max="72" value="${obj.fontSize}" class="prop-slider">
                    <span class="value-display">${obj.fontSize}</span>
                `;
                const fontInput = fontRow.querySelector('input');
                const fontDisplay = fontRow.querySelector('.value-display');
                fontInput.addEventListener('input', (event) => {
                    obj.fontSize = Number(event.target.value);
                    fontDisplay.textContent = String(obj.fontSize);
                    this.render();
                });
                container.appendChild(fontRow);

                const alignRow = document.createElement('div');
                alignRow.className = 'property-row';
                alignRow.innerHTML = `
                    <label>정렬:</label>
                    <select class="prop-select">
                        <option value="left">왼쪽</option>
                        <option value="center">가운데</option>
                        <option value="right">오른쪽</option>
                    </select>
                `;
                const alignSelect = alignRow.querySelector('select');
                alignSelect.value = obj.align;
                alignSelect.addEventListener('change', (event) => {
                    obj.align = event.target.value;
                    this.render();
                });
                container.appendChild(alignRow);

                const positionRow = document.createElement('div');
                positionRow.className = 'property-row full-width';
                positionRow.innerHTML = `
                    <label>위치:</label>
                    <input type="number" class="prop-input text-x" step="any" value="${obj.position.x}" aria-label="텍스트 x 좌표">
                    <input type="number" class="prop-input text-y" step="any" value="${obj.position.y}" aria-label="텍스트 y 좌표">
                `;
                positionRow.querySelector('.text-x').addEventListener('change', (event) => {
                    if (Number.isFinite(event.target.valueAsNumber)) obj.position.x = event.target.valueAsNumber;
                    this.render();
                });
                positionRow.querySelector('.text-y').addEventListener('change', (event) => {
                    if (Number.isFinite(event.target.valueAsNumber)) obj.position.y = event.target.valueAsNumber;
                    this.render();
                });
                container.appendChild(positionRow);
            }

            if (['cylinder', 'cone', 'sphere'].includes(obj.type)) {
                const sizeRow = document.createElement('div');
                sizeRow.className = 'property-row full-width';
                sizeRow.innerHTML = `
                    <label>크기:</label>
                    <input type="number" class="prop-input solid-width" min="0.1" step="0.1" value="${obj.width}" aria-label="입체 너비">
                    <span>×</span>
                    <input type="number" class="prop-input solid-height" min="0.1" step="0.1" value="${obj.height}" aria-label="입체 높이">
                `;
                const updateDimension = (property, input) => {
                    const value = Number(input.value);
                    if (Number.isFinite(value) && value > 0) {
                        obj[property] = value;
                        if (obj.type === 'sphere') {
                            obj.width = value;
                            obj.height = value;
                            sizeRow.querySelector('.solid-width').value = value;
                            sizeRow.querySelector('.solid-height').value = value;
                        }
                        obj.update();
                        this.render();
                    }
                };
                sizeRow.querySelector('.solid-width').addEventListener('change', (event) => updateDimension('width', event.target));
                sizeRow.querySelector('.solid-height').addEventListener('change', (event) => updateDimension('height', event.target));
                container.appendChild(sizeRow);

                const ellipseRow = document.createElement('div');
                ellipseRow.className = 'property-row';
                ellipseRow.innerHTML = `
                    <label>곡선 깊이:</label>
                    <input type="range" min="0.12" max="0.6" step="0.01" value="${obj.ellipseRatio}" class="prop-slider">
                    <span class="value-display">${Math.round(obj.ellipseRatio * 100)}%</span>
                `;
                const ellipseInput = ellipseRow.querySelector('input');
                const ellipseValue = ellipseRow.querySelector('.value-display');
                ellipseInput.addEventListener('input', (event) => {
                    obj.ellipseRatio = Number(event.target.value);
                    ellipseValue.textContent = `${Math.round(obj.ellipseRatio * 100)}%`;
                    obj.update();
                    this.render();
                });
                container.appendChild(ellipseRow);

                const hiddenRow = document.createElement('div');
                hiddenRow.className = 'property-row';
                hiddenRow.innerHTML = `
                    <label>숨은 곡선:</label>
                    <input type="checkbox" class="prop-input" ${obj.showHiddenLines ? 'checked' : ''}>
                    <span class="property-note">점선 표시</span>
                `;
                hiddenRow.querySelector('input').addEventListener('change', (event) => {
                    obj.showHiddenLines = event.target.checked;
                    this.render();
                });
                container.appendChild(hiddenRow);
            }

            if (this.isPointLikeObject(obj)) {
                let pointSizeEditStart;
                const pointSizeControl = this.createPointSizeControl({
                    value: obj.pointSize,
                    onInput: (size) => {
                        if (pointSizeEditStart === undefined) pointSizeEditStart = obj.pointSize;
                        obj.pointSize = size;
                        const bodyToggle = container.querySelector('.point-body-toggle');
                        if (bodyToggle) {
                            bodyToggle.checked = size > 0;
                        }
                        this.render();
                        this.updateSidebar();
                    }
                });
                pointSizeControl.input.addEventListener('change', () => {
                    const startSize = pointSizeEditStart !== undefined ? pointSizeEditStart : obj.pointSize;
                    pointSizeEditStart = undefined;
                    this.recordObjectPropertyEdit(obj, 'pointSize', obj.pointSize, { oldValue: startSize });
                });
                container.appendChild(pointSizeControl.row);

                const bodyRow = document.createElement('div');
                bodyRow.className = 'property-row';
                bodyRow.innerHTML = `
                    <label>점 본체:</label>
                    <input type="checkbox" ${obj.pointSize > 0 ? 'checked' : ''} class="prop-input point-body-toggle">
                    <span class="property-note">보이기</span>
                `;
                const bodyInput = bodyRow.querySelector('input');
                bodyInput.addEventListener('mousedown', e => e.stopPropagation());
                bodyInput.addEventListener('click', e => e.stopPropagation());
                bodyInput.addEventListener('change', (e) => {
                    const nextSize = e.target.checked
                        ? this.settingsManager.normalizePointSize(this.settingsManager.defaultStyles.pointSize)
                        : 0;
                    this.recordObjectPropertyEdit(obj, 'pointSize', nextSize);
                    pointSizeControl.setValue(obj.pointSize);
                    this.render();
                    this.updateSidebar();
                });
                container.appendChild(bodyRow);
            }

            // 선 굵기 (점 제외)
            if (!this.isPointLikeObject(obj) && obj.type !== 'textLabel') {
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
                let lineWidthEditStart;
                widthInput.addEventListener('input', (e) => {
                    if (lineWidthEditStart === undefined) lineWidthEditStart = obj.lineWidth || 2;
                    const width = parseInt(e.target.value);
                    obj.lineWidth = width;
                    widthDisplay.textContent = width;
                    this.render();
                });
                widthInput.addEventListener('change', () => {
                    const startWidth = lineWidthEditStart !== undefined ? lineWidthEditStart : (obj.lineWidth || 2);
                    lineWidthEditStart = undefined;
                    this.recordObjectPropertyEdit(obj, 'lineWidth', obj.lineWidth, { oldValue: startWidth });
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
                            const nextPos = {
                                x: type === 'x' ? val : obj.position.x,
                                y: type === 'y' ? val : obj.position.y
                            };
                            this.recordObjectPropertyEdit(obj, 'position', nextPos, {
                                oldValue: { x: obj.position.x, y: obj.position.y },
                                apply: (target, value) => {
                                    if (typeof target.setPosition === 'function') {
                                        target.setPosition(value.x, value.y);
                                    } else {
                                        target.position.x = value.x;
                                        target.position.y = value.y;
                                    }
                                }
                            });
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
                    <input type="text" value="${escapeHtml(obj.expression || '')}" class="prop-input" placeholder="예: x^2 - 2*x + 1">
                `;
                const exprInput = exprRow.querySelector('input');
                exprInput.addEventListener('mousedown', e => e.stopPropagation());
                exprInput.addEventListener('click', e => e.stopPropagation());
                exprInput.addEventListener('change', (e) => {
                    const newExpr = e.target.value.trim();
                    if (newExpr) {
                        this.recordObjectPropertyEdit(obj, 'expression', newExpr, {
                            apply: (target, value) => target.setExpression(value)
                        });
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

                // 도메인/치역(x/y 범위) 설정
                const createFunctionRangeRow = (axis, minKey, maxKey) => {
                    const rangeRow = document.createElement('div');
                    rangeRow.className = 'property-row';
                    const minValue = obj[minKey] !== null ? obj[minKey] : '';
                    const maxValue = obj[maxKey] !== null ? obj[maxKey] : '';
                    rangeRow.innerHTML = `
                        <label>${axis} 범위:</label>
                        <div style="display: flex; gap: 4px; align-items: center;">
                            <input type="number" class="prop-input min-input" value="${minValue}" placeholder="-∞" style="width: 60px;">
                            <span>~</span>
                            <input type="number" class="prop-input max-input" value="${maxValue}" placeholder="∞" style="width: 60px;">
                        </div>
                    `;

                    const minInput = rangeRow.querySelector('.min-input');
                    const maxInput = rangeRow.querySelector('.max-input');

                    [minInput, maxInput].forEach(input => {
                        input.addEventListener('mousedown', e => e.stopPropagation());
                        input.addEventListener('click', e => e.stopPropagation());
                    });

                    minInput.addEventListener('change', (e) => {
                        this.updateFunctionRangeValue(obj, minKey, e.target);
                    });
                    maxInput.addEventListener('change', (e) => {
                        this.updateFunctionRangeValue(obj, maxKey, e.target);
                    });

                    return rangeRow;
                };

                container.appendChild(createFunctionRangeRow('x', 'xMin', 'xMax'));
                container.appendChild(createFunctionRangeRow('y', 'yMin', 'yMax'));

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
                    <input type="text" class="prop-input" placeholder="비우면 자동(계산값)" value="${escapeHtml(customValue)}">
                `;
                const customInput = customRow.querySelector('input');
                customInput.addEventListener('mousedown', e => e.stopPropagation());
                customInput.addEventListener('click', e => e.stopPropagation());
                let customTextEditStart;
                customInput.addEventListener('input', (e) => {
                    if (customTextEditStart === undefined) customTextEditStart = obj.customText ?? null;
                    // 빈 값이면 자동 표시로 복귀
                    const v = e.target.value.trim();
                    obj.customText = v.length === 0 ? null : v;
                    this.render();
                });
                customInput.addEventListener('change', (e) => {
                    const startText = customTextEditStart !== undefined ? customTextEditStart : (obj.customText ?? null);
                    customTextEditStart = undefined;
                    const v = e.target.value.trim();
                    this.recordObjectPropertyEdit(obj, 'customText', v.length === 0 ? null : v, { oldValue: startText });
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
                let fontSizeEditStart;
                fontInput.addEventListener('input', (e) => {
                    if (fontSizeEditStart === undefined) fontSizeEditStart = obj.labelFontSize || 14;
                    const v = parseInt(e.target.value);
                    obj.labelFontSize = v;
                    fontDisplay.textContent = v;
                    this.render();
                });
                fontInput.addEventListener('change', () => {
                    const startSize = fontSizeEditStart !== undefined ? fontSizeEditStart : (obj.labelFontSize || 14);
                    fontSizeEditStart = undefined;
                    this.recordObjectPropertyEdit(obj, 'labelFontSize', obj.labelFontSize, { oldValue: startSize });
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
                    this.recordObjectPropertyEdit(obj, 'precision', parseInt(e.target.value));
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
                helpRow.innerHTML = `<small style="color: #888;">💡 드래그하면 이동, Ctrl+드래그하면 회전합니다. 모서리를 클릭하면 해당 모서리가 강조됩니다.</small>`;
                container.appendChild(helpRow);
            }
        }
    }

    /**
     * 렌더링
     */
    getRenderOrderedObjects() {
        const pointLikeTypes = new Set(['point', 'pointOnObject', 'intersection', 'midpoint']);
        const backgroundRegionTypes = new Set(['closedRegion']);
        const objects = this.objectManager.getAllObjects();

        return [
            ...objects.filter(obj => backgroundRegionTypes.has(obj.type)),
            ...objects.filter(obj => !backgroundRegionTypes.has(obj.type) && !pointLikeTypes.has(obj.type)),
            ...objects.filter(obj => pointLikeTypes.has(obj.type))
        ];
    }

    areAxesVisible() {
        return this.canvas.showXAxis || this.canvas.showYAxis;
    }

    syncViewToggleInputs() {
        const showGridPanel = document.getElementById('showGridPanel');
        const showXAxisPanel = document.getElementById('showXAxisPanel');
        const showYAxisPanel = document.getElementById('showYAxisPanel');
        const showAxisNumbersPanel = document.getElementById('showAxisNumbersPanel');
        const axisNumberIntervalPanel = document.getElementById('axisNumberIntervalPanel');

        if (showGridPanel) showGridPanel.checked = !!this.canvas.showGrid;
        if (showXAxisPanel) showXAxisPanel.checked = !!this.canvas.showXAxis;
        if (showYAxisPanel) showYAxisPanel.checked = !!this.canvas.showYAxis;
        if (showAxisNumbersPanel) showAxisNumbersPanel.checked = !!this.canvas.showAxisNumbers;
        if (axisNumberIntervalPanel) axisNumberIntervalPanel.value = String(this.canvas.axisNumberInterval || 'auto');
    }

    setGridVisibility(visible, { render = true, syncInputs = true } = {}) {
        this.canvas.showGrid = !!visible;

        if (syncInputs) {
            this.syncViewToggleInputs();
        }
        if (render) {
            this.render();
        }
    }

    setAxesVisibility(xVisible, yVisible, { render = true, syncInputs = true } = {}) {
        this.canvas.showXAxis = !!xVisible;
        this.canvas.showYAxis = !!yVisible;

        if (syncInputs) {
            this.syncViewToggleInputs();
        }
        if (render) {
            this.render();
        }
    }

    setAxisNumbersVisibility(visible, { render = true, syncInputs = true } = {}) {
        this.settingsManager.setShowAxisNumbers(visible);
        this.canvas.showAxisNumbers = this.settingsManager.showAxisNumbers;

        if (syncInputs) {
            this.syncViewToggleInputs();
        }
        if (render) {
            this.render();
        }
    }

    setAxisNumberInterval(interval, { render = true, syncInputs = true } = {}) {
        this.settingsManager.setAxisNumberInterval(interval);
        this.canvas.axisNumberInterval = this.settingsManager.axisNumberInterval;

        if (syncInputs) {
            this.syncViewToggleInputs();
        }
        if (render) {
            this.render();
        }
    }

    updateFunctionRangeValue(obj, key, input) {
        const rawValue = input.value.trim();
        if (rawValue === '') {
            this.recordObjectPropertyEdit(obj, key, null);
            this.render();
            return;
        }

        const value = Number(rawValue);
        if (!Number.isFinite(value)) {
            input.value = obj[key] ?? '';
            this.showToast('범위 값은 숫자여야 합니다', 'warning');
            return;
        }

        this.recordObjectPropertyEdit(obj, key, value);
        this.render();
    }

    toggleAxesVisibility() {
        const nextVisible = !this.areAxesVisible();
        this.setAxesVisibility(nextVisible, nextVisible);
        return nextVisible;
    }

    render() {
        this.canvas.clear();
        this.canvas.drawGrid();
        this.canvas.drawAxes();

        // 모든 객체 렌더링
        for (const obj of this.getRenderOrderedObjects()) {
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
            hydrateGeneratedIcons(objectList);
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
                        <div class="object-name">${escapeHtml(obj.label || '(이름 없음)')}</div>
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
        hydrateGeneratedIcons(objectList);

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
            polygon: '다각형', lensRegion: '렌즈 영역', prism: '각기둥', pyramid: '각뿔',
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
            lensRegion: 'lens',
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
        const doAreaExport = document.getElementById('doAreaExport');

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

        doAreaExport?.addEventListener('click', () => {
            modal.classList.add('hidden');
            this.startAreaExport();
        });
    }

    /**
     * 내보내기 모달 표시
     */
    showExportModal() {
        const modal = document.getElementById('exportModal');
        modal?.classList.remove('hidden');
    }

    startAreaExport() {
        this.toolManager.setTool('areaExport');
        this.showToast('저장할 영역을 드래그하세요.', 'info');
        this.render();
    }

    /**
     * 실제 내보내기 수행
     */
    doExport(options = {}) {
        const exportOptions = this.getExportOptions(options);
        const { format, scale, includeBackground, includeGrid, includeAxes } = exportOptions;

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

        for (const obj of this.getRenderOrderedObjects()) {
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
            this.downloadCanvas(tempCanvas, `graph_${Date.now()}.png`);
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
    renderSceneToCanvas(targetCanvas, {
        scale = 1,
        includeBackground = true,
        includeGrid = false,
        includeAxes = true
    } = {}) {
        const targetCtx = targetCanvas.getContext('2d');
        targetCanvas.width = this.canvas.width * scale;
        targetCanvas.height = this.canvas.height * scale;

        targetCtx.save();
        targetCtx.scale(scale, scale);

        if (includeBackground) {
            targetCtx.fillStyle = '#ffffff';
            targetCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        const originalCtx = this.canvas.ctx;
        const oldShowGrid = this.canvas.showGrid;
        const oldShowXAxis = this.canvas.showXAxis;
        const oldShowYAxis = this.canvas.showYAxis;
        const oldLabelBounds = this.canvas.labelBounds;

        this.canvas.ctx = targetCtx;
        this.canvas.showGrid = includeGrid;
        this.canvas.showXAxis = includeAxes;
        this.canvas.showYAxis = includeAxes;
        this.canvas.resetLabelLayout();

        if (includeGrid) this.canvas.drawGrid();
        if (includeAxes) this.canvas.drawAxes();

        for (const obj of this.getRenderOrderedObjects()) {
            if (obj.visible) {
                obj.render(this.canvas);
            }
        }

        this.canvas.ctx = originalCtx;
        this.canvas.showGrid = oldShowGrid;
        this.canvas.showXAxis = oldShowXAxis;
        this.canvas.showYAxis = oldShowYAxis;
        this.canvas.labelBounds = oldLabelBounds;
        targetCtx.restore();
    }

    escapeSVG(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    buildSVGPath(points, close = false) {
        if (!points || points.length === 0) return '';

        const commands = points.map((point, index) => {
            const prefix = index === 0 ? 'M' : 'L';
            return `${prefix} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
        });

        if (close) {
            commands.push('Z');
        }

        return commands.join(' ');
    }

    buildSVGStrokeAttributes(obj, { fill = 'none', fillOpacity = null } = {}) {
        const attrs = [
            `stroke="${this.escapeSVG(obj.color || '#000000')}"`,
            `stroke-width="${obj.lineWidth || 2}"`,
            `stroke-linecap="round"`,
            `stroke-linejoin="round"`,
            `fill="${this.escapeSVG(fill)}"`
        ];

        if (obj.dashed) {
            attrs.push('stroke-dasharray="5 5"');
        }
        if (fillOpacity !== null) {
            attrs.push(`fill-opacity="${fillOpacity}"`);
        }

        return attrs.join(' ');
    }

    buildSVGGridMarkup() {
        const bounds = this.canvas.getVisibleBounds();
        const gap = this.canvas.getGridGap ? this.canvas.getGridGap() : 1;

        const parts = ['<g id="grid" stroke="#e5e5e5" stroke-width="0.5" fill="none">'];
        const startX = Math.floor(bounds.minX / gap) * gap;
        const startY = Math.floor(bounds.minY / gap) * gap;

        for (let x = startX; x <= bounds.maxX; x += gap) {
            const screenX = this.canvas.toScreen(new Vec2(x, 0)).x;
            parts.push(
                `<line x1="${screenX.toFixed(2)}" y1="0" x2="${screenX.toFixed(2)}" y2="${this.canvas.height}" />`
            );
        }

        for (let y = startY; y <= bounds.maxY; y += gap) {
            const screenY = this.canvas.toScreen(new Vec2(0, y)).y;
            parts.push(
                `<line x1="0" y1="${screenY.toFixed(2)}" x2="${this.canvas.width}" y2="${screenY.toFixed(2)}" />`
            );
        }

        parts.push('</g>');
        return parts.join('\n');
    }

    buildSVGAxesMarkup(cropRect = null) {
        const origin = this.canvas.toScreen(new Vec2(0, 0));
        const color = this.escapeSVG(this.canvas.axisColor || '#333333');
        const axisRect = cropRect || {
            x: 0,
            y: 0,
            width: this.canvas.width,
            height: this.canvas.height
        };
        const left = axisRect.x;
        const top = axisRect.y;
        const right = axisRect.x + axisRect.width;
        const bottom = axisRect.y + axisRect.height;
        const clamp = (value, min, max) => {
            if (max < min) return min;
            return MathUtils.clamp(value, min, max);
        };
        const axisArrow = getScaledAxisArrowStyle();
        const parts = [`<g id="axes" stroke="${color}" fill="${color}" stroke-width="1.5">`];

        if (origin.y >= top && origin.y <= bottom) {
            const arrowTipX = Math.max(left, right - axisArrow.tipInset);
            const arrowBaseX = Math.max(left, right - axisArrow.baseInset);
            const lineEndX = arrowBaseX;
            parts.push(`<line x1="${left.toFixed(2)}" y1="${origin.y.toFixed(2)}" x2="${lineEndX.toFixed(2)}" y2="${origin.y.toFixed(2)}" />`);
            parts.push(
                `<path d="M ${arrowTipX.toFixed(2)} ${origin.y.toFixed(2)} ` +
                `L ${arrowBaseX.toFixed(2)} ${(origin.y - axisArrow.halfWidth).toFixed(2)} ` +
                `L ${arrowBaseX.toFixed(2)} ${(origin.y + axisArrow.halfWidth).toFixed(2)} Z" />`
            );
            const labelX = clamp(right - axisArrow.xLabelInset, left, right);
            const labelY = clamp(origin.y + axisArrow.xLabelGap, top + axisArrow.xLabelMinGap, bottom - axisArrow.xLabelBottomInset);
            parts.push(
                `<text x="${labelX.toFixed(2)}" y="${labelY.toFixed(2)}" ` +
                `font-family="Times New Roman, serif" font-size="22" font-style="italic" ` +
                `text-anchor="middle" dominant-baseline="hanging">${this.escapeSVG('x')}</text>`
            );
        }

        if (origin.x >= left && origin.x <= right) {
            const arrowTipY = Math.min(bottom, top + axisArrow.tipInset);
            const arrowBaseY = Math.min(bottom, top + axisArrow.baseInset);
            const lineStartY = arrowBaseY;
            parts.push(`<line x1="${origin.x.toFixed(2)}" y1="${lineStartY.toFixed(2)}" x2="${origin.x.toFixed(2)}" y2="${bottom.toFixed(2)}" />`);
            parts.push(
                `<path d="M ${origin.x.toFixed(2)} ${arrowTipY.toFixed(2)} ` +
                `L ${(origin.x - axisArrow.halfWidth).toFixed(2)} ${arrowBaseY.toFixed(2)} ` +
                `L ${(origin.x + axisArrow.halfWidth).toFixed(2)} ${arrowBaseY.toFixed(2)} Z" />`
            );
            const labelX = clamp(origin.x - axisArrow.yLabelInset, left, right);
            const labelY = clamp(top + axisArrow.yLabelBaseline, top, bottom);
            parts.push(
                `<text x="${labelX.toFixed(2)}" y="${labelY.toFixed(2)}" ` +
                `font-family="Times New Roman, serif" font-size="22" font-style="italic" ` +
                `text-anchor="middle" dominant-baseline="text-after-edge">${this.escapeSVG('y')}</text>`
            );
        }

        parts.push('</g>');
        return parts.join('\n');
    }

    getSVGLineGeometry(obj) {
        const point1 = obj.getPoint1 ? obj.getPoint1() : null;
        const point2 = obj.getPoint2 ? obj.getPoint2() : null;

        if (!point1 || !point2) {
            return null;
        }

        const direction = point2.sub(point1);
        if (direction.length() === 0) {
            return null;
        }

        const bounds = this.canvas.getVisibleBounds();
        const maxDist = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 2;

        if (obj.type === 'segment' || obj.type === 'vector') {
            return {
                start: this.canvas.toScreen(point1),
                end: this.canvas.toScreen(point2)
            };
        }

        if (obj.type === 'ray') {
            const rayEnd = typeof this.canvas.getRayEndPoint === 'function'
                ? this.canvas.getRayEndPoint(point1, direction.normalize(), bounds)
                : point1.add(direction.normalize().mul(maxDist));
            return {
                start: this.canvas.toScreen(point1),
                end: this.canvas.toScreen(rayEnd)
            };
        }

        const unit = direction.normalize();
        return {
            start: this.canvas.toScreen(point1.sub(unit.mul(maxDist))),
            end: this.canvas.toScreen(point1.add(unit.mul(maxDist)))
        };
    }

    buildSVGPointMarkup(obj) {
        const position = obj.getPosition ? obj.getPosition() : obj.position;
        if (!position) return '';

        const screen = this.canvas.toScreen(position);
        const radius = obj.pointSize !== undefined ? Math.max(0, Number(obj.pointSize) || 0) : 4;
        if (radius <= 0) return '';

        const stroke = this.escapeSVG(obj.color || '#000000');
        const fill = obj.pointStyle === 'open' ? this.escapeSVG(this.canvas.backgroundColor || '#ffffff') : stroke;

        return [
            `<g data-type="${this.escapeSVG(obj.type)}" data-id="${this.escapeSVG(obj.id)}">`,
            `<circle cx="${screen.x.toFixed(2)}" cy="${screen.y.toFixed(2)}" r="${(radius + 1.5).toFixed(2)}" fill="${stroke}" />`,
            `<circle cx="${screen.x.toFixed(2)}" cy="${screen.y.toFixed(2)}" r="${radius.toFixed(2)}" fill="${fill}" />`,
            '</g>'
        ].join('');
    }

    buildSVGLineMarkup(obj) {
        const geometry = this.getSVGLineGeometry(obj);
        if (!geometry) return '';

        return `<line x1="${geometry.start.x.toFixed(2)}" y1="${geometry.start.y.toFixed(2)}" ` +
            `x2="${geometry.end.x.toFixed(2)}" y2="${geometry.end.y.toFixed(2)}" ${this.buildSVGStrokeAttributes(obj)} />`;
    }

    buildSVGVectorMarkup(obj) {
        const geometry = this.getSVGLineGeometry(obj);
        if (!geometry) return '';

        const arrowSize = 10;
        const dx = geometry.end.x - geometry.start.x;
        const dy = geometry.end.y - geometry.start.y;
        const length = Math.hypot(dx, dy);

        if (length < 1) {
            return this.buildSVGLineMarkup(obj);
        }

        const ux = dx / length;
        const uy = dy / length;
        const px = -uy;
        const py = ux;
        const arrowP1 = {
            x: geometry.end.x - ux * arrowSize - px * arrowSize * 0.4,
            y: geometry.end.y - uy * arrowSize - py * arrowSize * 0.4
        };
        const arrowP2 = {
            x: geometry.end.x - ux * arrowSize + px * arrowSize * 0.4,
            y: geometry.end.y - uy * arrowSize + py * arrowSize * 0.4
        };
        const color = this.escapeSVG(obj.color || '#000000');

        return [
            `<g data-type="${this.escapeSVG(obj.type)}" data-id="${this.escapeSVG(obj.id)}">`,
            `<line x1="${geometry.start.x.toFixed(2)}" y1="${geometry.start.y.toFixed(2)}" ` +
            `x2="${geometry.end.x.toFixed(2)}" y2="${geometry.end.y.toFixed(2)}" ${this.buildSVGStrokeAttributes(obj)} />`,
            `<polygon points="${geometry.end.x.toFixed(2)},${geometry.end.y.toFixed(2)} ` +
            `${arrowP1.x.toFixed(2)},${arrowP1.y.toFixed(2)} ${arrowP2.x.toFixed(2)},${arrowP2.y.toFixed(2)}" ` +
            `fill="${color}" />`,
            '</g>'
        ].join('');
    }

    buildSVGCircleMarkup(obj) {
        const center = obj.getCenter ? obj.getCenter() : null;
        const radius = obj.getRadius ? obj.getRadius() : null;

        if (!center || radius === null || radius === undefined) {
            return '';
        }

        const screenCenter = this.canvas.toScreen(center);
        const screenRadius = this.canvas.toScreenLength(radius);
        const fill = obj.fillOpacity > 0 ? (obj.fillColor || obj.color) : 'none';
        const fillOpacity = obj.fillOpacity > 0 ? obj.fillOpacity : null;
        return `<circle cx="${screenCenter.x.toFixed(2)}" cy="${screenCenter.y.toFixed(2)}" ` +
            `r="${screenRadius.toFixed(2)}" ${this.buildSVGStrokeAttributes(obj, { fill, fillOpacity })} />`;
    }

    buildSVGConicMarkup(obj) {
        if (!obj.valid || typeof obj.getPolylines !== 'function') return '';

        const polylines = obj.getPolylines(this.canvas.getVisibleBounds(), 360);
        const isEllipse = obj.type === 'ellipse';
        const fill = isEllipse && obj.fillOpacity > 0 ? (obj.fillColor || obj.color) : 'none';
        const fillOpacity = isEllipse && obj.fillOpacity > 0 ? obj.fillOpacity : null;
        const paths = polylines
            .filter(points => Array.isArray(points) && points.length >= 2)
            .map(points => {
                const screenPoints = points.map(point => this.canvas.toScreen(point));
                return `<path d="${this.buildSVGPath(screenPoints, isEllipse)}" ` +
                    `${this.buildSVGStrokeAttributes(obj, { fill, fillOpacity })} />`;
            });

        if (paths.length === 0) return '';
        return `<g data-type="${this.escapeSVG(obj.type)}" data-id="${this.escapeSVG(obj.id)}">` +
            paths.join('') + '</g>';
    }

    sampleArcScreenPoints(obj, samples = 64) {
        if (!obj.center || !obj.valid) return [];

        const start = obj.startAngle;
        const end = obj.endAngle;
        let delta = end - start;
        while (delta < 0) delta += Math.PI * 2;

        let direction = 1;
        let sweep = delta;
        if (obj.mode === 'major') {
            if (delta <= Math.PI) {
                direction = -1;
                sweep = Math.PI * 2 - delta;
            }
        } else if (delta > Math.PI) {
            direction = -1;
            sweep = Math.PI * 2 - delta;
        }

        const points = [];
        for (let i = 0; i <= samples; i++) {
            const angle = start + direction * sweep * (i / samples);
            const mathPoint = new Vec2(
                obj.center.x + obj.radius * Math.cos(angle),
                obj.center.y + obj.radius * Math.sin(angle)
            );
            points.push(this.canvas.toScreen(mathPoint));
        }

        return points;
    }

    buildSVGArcMarkup(obj) {
        const points = this.sampleArcScreenPoints(obj);
        if (points.length < 2) return '';
        return `<path d="${this.buildSVGPath(points)}" ${this.buildSVGStrokeAttributes(obj)} />`;
    }

    buildSVGSectorMarkup(obj) {
        const points = this.sampleArcScreenPoints(obj);
        if (points.length < 2 || !obj.center) return '';

        const center = this.canvas.toScreen(obj.center);
        return `<path d="${this.buildSVGPath([center, ...points], true)}" ` +
            `${this.buildSVGStrokeAttributes(obj, { fill: obj.fillColor || obj.color, fillOpacity: obj.fillOpacity ?? 0.3 })} />`;
    }

    buildSVGCircularSegmentMarkup(obj) {
        const points = this.sampleArcScreenPoints(obj);
        if (points.length < 2) return '';

        return `<path d="${this.buildSVGPath(points, true)}" ` +
            `${this.buildSVGStrokeAttributes(obj, { fill: obj.fillColor || obj.color, fillOpacity: obj.fillOpacity ?? 0.3 })} />`;
    }

    buildSVGPolygonMarkup(obj) {
        if (!obj.valid || !Array.isArray(obj.vertices) || obj.vertices.length < 3) return '';

        const points = obj.vertices
            .map(vertex => this.canvas.toScreen(vertex))
            .map(point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
            .join(' ');

        return `<polygon points="${points}" ` +
            `${this.buildSVGStrokeAttributes(obj, { fill: obj.fillColor || obj.color, fillOpacity: obj.fillOpacity ?? 0.12 })} />`;
    }

    buildSVGClosedRegionMarkup(obj) {
        if (!obj.valid || !Array.isArray(obj.vertices) || obj.vertices.length < 3) return '';

        const points = obj.vertices
            .map(vertex => this.canvas.toScreen(vertex))
            .map(point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
            .join(' ');

        return `<polygon points="${points}" ` +
            `${this.buildSVGStrokeAttributes(obj, { fill: obj.fillColor || obj.color, fillOpacity: obj.fillOpacity ?? 0.24 })} />`;
    }

    buildSVGLensRegionMarkup(obj) {
        if (!obj.valid || !Array.isArray(obj.pathPoints) || obj.pathPoints.length < 3) return '';

        const points = obj.pathPoints.map(point => this.canvas.toScreen(point));
        return `<path d="${this.buildSVGPath(points, true)}" ` +
            `${this.buildSVGStrokeAttributes(obj, { fill: obj.fillColor || obj.color, fillOpacity: obj.fillOpacity ?? 0.24 })} />`;
    }

    buildSVGFunctionMarkup(obj) {
        if (!obj.getFunction || !obj.valid) return '';

        const fn = obj.getFunction();
        if (!fn) return '';

        const bounds = this.canvas.getVisibleBounds();
        const drawMinX = obj.xMin !== null ? Math.max(bounds.minX, obj.xMin) : bounds.minX;
        const drawMaxX = obj.xMax !== null ? Math.min(bounds.maxX, obj.xMax) : bounds.maxX;
        const drawMinY = obj.yMin !== null ? obj.yMin : null;
        const drawMaxY = obj.yMax !== null ? obj.yMax : null;

        if (drawMinX >= drawMaxX) return '';
        if (drawMinY !== null && drawMaxY !== null && drawMinY >= drawMaxY) return '';

        const samples = 500;
        const step = (drawMaxX - drawMinX) / samples;
        const segments = [];
        let current = [];
        let prevY = null;
        let prevX = null;

        for (let x = drawMinX; x <= drawMaxX; x += step) {
            const y = fn(x);

            if (Number.isNaN(y) || !Number.isFinite(y)) {
                if (current.length > 1) {
                    segments.push(current);
                }
                current = [];
                prevY = null;
                prevX = null;
                continue;
            }

            if ((drawMinY !== null && y < drawMinY) ||
                (drawMaxY !== null && y > drawMaxY)) {
                if (current.length > 1) {
                    segments.push(current);
                }
                current = [];
                prevY = y;
                prevX = x;
                continue;
            }

            if (prevY !== null && prevX !== null) {
                const dy = y - prevY;
                const dx = x - prevX;
                const slope = Math.abs(dy / dx);
                const signChanged = (prevY > 0 && y < 0) || (prevY < 0 && y > 0);
                const slopeThreshold = Math.max(100, (bounds.maxY - bounds.minY) * 10);

                if ((signChanged && slope > slopeThreshold) || Math.abs(y) > (bounds.maxY - bounds.minY) * 5) {
                    if (current.length > 1) {
                        segments.push(current);
                    }
                    current = [];
                }
            }

            if (y < bounds.minY - 100 || y > bounds.maxY + 100) {
                if (current.length > 1) {
                    segments.push(current);
                }
                current = [];
                prevY = y;
                prevX = x;
                continue;
            }

            current.push(this.canvas.toScreen(new Vec2(x, y)));
            prevY = y;
            prevX = x;
        }

        if (current.length > 1) {
            segments.push(current);
        }

        return segments.map((points) => {
            return `<path d="${this.buildSVGPath(points)}" ${this.buildSVGStrokeAttributes(obj)} />`;
        }).join('\n');
    }

    buildSVGTextLabelMarkup(obj) {
        if (!obj.valid || !obj.position) return '';
        const position = this.canvas.toScreen(obj.position);
        const anchor = obj.align === 'center' ? 'middle' : obj.align === 'right' ? 'end' : 'start';
        const color = this.escapeSVG(obj.color || '#000000');
        return `<text data-type="textLabel" data-id="${this.escapeSVG(obj.id)}" ` +
            `x="${position.x.toFixed(2)}" y="${position.y.toFixed(2)}" ` +
            `font-family="Noto Sans KR, Times New Roman, sans-serif" ` +
            `font-size="${obj.fontSize || 18}" text-anchor="${anchor}" fill="${color}">` +
            `${this.escapeSVG(obj.text || '')}</text>`;
    }

    buildSVGCurvedSolidMarkup(obj) {
        if (!obj.valid || !obj.position) return '';
        const center = this.canvas.toScreen(obj.position);
        const rx = this.canvas.toScreenLength(obj.width / 2);
        const halfHeight = this.canvas.toScreenLength(obj.height / 2);
        const ry = Math.max(3, rx * obj.ellipseRatio);
        const stroke = this.escapeSVG(obj.color || '#000000');
        const width = obj.lineWidth || 2;
        const common = `fill="none" stroke="${stroke}" stroke-width="${width}"`;
        const dashed = obj.showHiddenLines ? ` stroke-dasharray="5 4"` : '';
        const parts = [`<g data-type="${this.escapeSVG(obj.type)}" data-id="${this.escapeSVG(obj.id)}">`];

        if (obj.type === 'cylinder') {
            const topY = center.y - halfHeight + ry;
            const bottomY = center.y + halfHeight - ry;
            parts.push(`<ellipse cx="${center.x.toFixed(2)}" cy="${topY.toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" ${common} />`);
            if (obj.showHiddenLines) {
                parts.push(`<path d="M ${(center.x - rx).toFixed(2)} ${bottomY.toFixed(2)} A ${rx.toFixed(2)} ${ry.toFixed(2)} 0 0 1 ${(center.x + rx).toFixed(2)} ${bottomY.toFixed(2)}" ${common}${dashed} />`);
            }
            parts.push(`<path d="M ${(center.x - rx).toFixed(2)} ${bottomY.toFixed(2)} A ${rx.toFixed(2)} ${ry.toFixed(2)} 0 0 0 ${(center.x + rx).toFixed(2)} ${bottomY.toFixed(2)}" ${common} />`);
            parts.push(`<line x1="${(center.x - rx).toFixed(2)}" y1="${topY.toFixed(2)}" x2="${(center.x - rx).toFixed(2)}" y2="${bottomY.toFixed(2)}" ${common} />`);
            parts.push(`<line x1="${(center.x + rx).toFixed(2)}" y1="${topY.toFixed(2)}" x2="${(center.x + rx).toFixed(2)}" y2="${bottomY.toFixed(2)}" ${common} />`);
        } else if (obj.type === 'cone') {
            const apexY = center.y - halfHeight;
            const baseY = center.y + halfHeight - ry;
            parts.push(`<path d="M ${center.x.toFixed(2)} ${apexY.toFixed(2)} L ${(center.x - rx).toFixed(2)} ${baseY.toFixed(2)} M ${center.x.toFixed(2)} ${apexY.toFixed(2)} L ${(center.x + rx).toFixed(2)} ${baseY.toFixed(2)}" ${common} />`);
            if (obj.showHiddenLines) {
                parts.push(`<path d="M ${(center.x - rx).toFixed(2)} ${baseY.toFixed(2)} A ${rx.toFixed(2)} ${ry.toFixed(2)} 0 0 1 ${(center.x + rx).toFixed(2)} ${baseY.toFixed(2)}" ${common}${dashed} />`);
            }
            parts.push(`<path d="M ${(center.x - rx).toFixed(2)} ${baseY.toFixed(2)} A ${rx.toFixed(2)} ${ry.toFixed(2)} 0 0 0 ${(center.x + rx).toFixed(2)} ${baseY.toFixed(2)}" ${common} />`);
        } else {
            const radius = Math.min(rx, halfHeight);
            parts.push(`<circle cx="${center.x.toFixed(2)}" cy="${center.y.toFixed(2)}" r="${radius.toFixed(2)}" ${common} />`);
            if (obj.showHiddenLines) {
                parts.push(`<path d="M ${(center.x - radius).toFixed(2)} ${center.y.toFixed(2)} A ${radius.toFixed(2)} ${ry.toFixed(2)} 0 0 1 ${(center.x + radius).toFixed(2)} ${center.y.toFixed(2)}" ${common}${dashed} />`);
            }
            parts.push(`<path d="M ${(center.x - radius).toFixed(2)} ${center.y.toFixed(2)} A ${radius.toFixed(2)} ${ry.toFixed(2)} 0 0 0 ${(center.x + radius).toFixed(2)} ${center.y.toFixed(2)}" ${common} />`);
        }

        parts.push('</g>');
        return parts.join('\n');
    }

    buildSVGNumberLineMarkup(obj) {
        if (!obj.valid) return '';

        const startPos = this.canvas.toScreen(new Vec2(obj.start, obj.y));
        const endPos = this.canvas.toScreen(new Vec2(obj.end, obj.y));
        const tickScreenHeight = this.canvas.toScreenLength(obj.tickHeight || 0.15);
        const color = this.escapeSVG(obj.color || '#000000');
        const parts = [
            `<g data-type="${this.escapeSVG(obj.type)}" data-id="${this.escapeSVG(obj.id)}" ` +
            `stroke="${color}" fill="${color}" stroke-width="${obj.lineWidth || 2}">`,
            `<line x1="${startPos.x.toFixed(2)}" y1="${startPos.y.toFixed(2)}" ` +
            `x2="${endPos.x.toFixed(2)}" y2="${endPos.y.toFixed(2)}" />`
        ];

        if (obj.showArrows !== false) {
            parts.push(
                `<path d="M ${(startPos.x + 8).toFixed(2)} ${(startPos.y - 4).toFixed(2)} ` +
                `L ${startPos.x.toFixed(2)} ${startPos.y.toFixed(2)} ` +
                `L ${(startPos.x + 8).toFixed(2)} ${(startPos.y + 4).toFixed(2)}" fill="none" />`
            );
            parts.push(
                `<path d="M ${(endPos.x - 8).toFixed(2)} ${(endPos.y - 4).toFixed(2)} ` +
                `L ${endPos.x.toFixed(2)} ${endPos.y.toFixed(2)} ` +
                `L ${(endPos.x - 8).toFixed(2)} ${(endPos.y + 4).toFixed(2)}" fill="none" />`
            );
        }

        for (let value = obj.start; value <= obj.end; value += obj.step) {
            const rounded = Math.round(value * 1000000) / 1000000;
            const position = this.canvas.toScreen(new Vec2(rounded, obj.y));
            parts.push(
                `<line x1="${position.x.toFixed(2)}" y1="${(position.y - tickScreenHeight).toFixed(2)}" ` +
                `x2="${position.x.toFixed(2)}" y2="${(position.y + tickScreenHeight).toFixed(2)}" />`
            );
        }

        for (const mark of obj.customMarks || []) {
            const position = this.canvas.toScreen(new Vec2(mark.value, obj.y));
            const markColor = this.escapeSVG(mark.color || obj.color || '#000000');
            if (mark.endpoint === 'open' || mark.endpoint === 'closed') {
                const radius = Math.max(4, (obj.lineWidth || 2) * 1.8);
                const fill = mark.endpoint === 'closed' ? markColor : '#ffffff';
                parts.push(
                    `<circle cx="${position.x.toFixed(2)}" cy="${position.y.toFixed(2)}" ` +
                    `r="${radius.toFixed(2)}" stroke="${markColor}" fill="${fill}" />`
                );
            } else {
                parts.push(
                    `<line x1="${position.x.toFixed(2)}" y1="${(position.y - tickScreenHeight * 1.5).toFixed(2)}" ` +
                    `x2="${position.x.toFixed(2)}" y2="${(position.y + tickScreenHeight * 1.5).toFixed(2)}" ` +
                    `stroke="${markColor}" />`
                );
            }
            if (mark.label) {
                parts.push(
                    `<text x="${position.x.toFixed(2)}" y="${(position.y - tickScreenHeight * 1.5 - 5).toFixed(2)}" ` +
                    `font-size="${Math.max(8, (obj.fontSize || 14) - 2)}" text-anchor="middle" fill="${markColor}">` +
                    `${this.escapeSVG(mark.label)}</text>`
                );
            }
        }

        parts.push('</g>');
        return parts.join('\n');
    }

    buildSVGObjectMarkup(obj) {
        switch (obj.type) {
            case 'point':
            case 'pointOnObject':
            case 'intersection':
            case 'midpoint':
                return this.buildSVGPointMarkup(obj);
            case 'segment':
            case 'line':
            case 'parallel':
            case 'perpendicular':
            case 'perpendicularBisector':
            case 'angleBisector':
            case 'tangentCircle':
            case 'tangentFunction':
                return this.buildSVGLineMarkup(obj);
            case 'ray':
            case 'vector':
                return this.buildSVGVectorMarkup(obj);
            case 'circle':
            case 'circleThreePoints':
                return this.buildSVGCircleMarkup(obj);
            case 'ellipse':
            case 'hyperbola':
            case 'parabola':
                return this.buildSVGConicMarkup(obj);
            case 'function':
                return this.buildSVGFunctionMarkup(obj);
            case 'arc':
                return this.buildSVGArcMarkup(obj);
            case 'sector':
                return this.buildSVGSectorMarkup(obj);
            case 'circularSegment':
                return this.buildSVGCircularSegmentMarkup(obj);
            case 'lensRegion':
                return this.buildSVGLensRegionMarkup(obj);
            case 'closedRegion':
                return this.buildSVGClosedRegionMarkup(obj);
            case 'polygon':
                return this.buildSVGPolygonMarkup(obj);
            case 'numberLine':
                return this.buildSVGNumberLineMarkup(obj);
            case 'textLabel':
                return this.buildSVGTextLabelMarkup(obj);
            case 'cylinder':
            case 'cone':
            case 'sphere':
                return this.buildSVGCurvedSolidMarkup(obj);
            default:
                return '';
        }
    }

    buildSVGMarkup({
        includeBackground = true,
        includeGrid = false,
        includeAxes = true,
        fallbackDataUrl = null,
        cropRect = null
    } = {}) {
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const width = cropRect ? cropRect.width : canvasWidth;
        const height = cropRect ? cropRect.height : canvasHeight;
        const viewBox = cropRect
            ? `${cropRect.x} ${cropRect.y} ${cropRect.width} ${cropRect.height}`
            : `0 0 ${canvasWidth} ${canvasHeight}`;
        const parts = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">`
        ];

        if (includeBackground) {
            parts.push(`<rect width="${canvasWidth}" height="${canvasHeight}" fill="${this.escapeSVG(this.canvas.backgroundColor || '#ffffff')}" />`);
        }

        if (fallbackDataUrl) {
            const imageRect = cropRect || { x: 0, y: 0, width: canvasWidth, height: canvasHeight };
            parts.push(
                `<image href="${fallbackDataUrl}" x="${imageRect.x}" y="${imageRect.y}" ` +
                `width="${imageRect.width}" height="${imageRect.height}" preserveAspectRatio="none" />`
            );
        }

        if (includeGrid) {
            parts.push(this.buildSVGGridMarkup());
        }
        if (includeAxes) {
            parts.push(this.buildSVGAxesMarkup(cropRect));
        }

        const objectMarkup = this.getRenderOrderedObjects()
            .filter((obj) => obj.visible)
            .map((obj) => this.buildSVGObjectMarkup(obj))
            .filter(Boolean);

        if (objectMarkup.length > 0) {
            parts.push('<g id="vector-objects">');
            parts.push(...objectMarkup);
            parts.push('</g>');
        }

        parts.push('</svg>');
        return parts.join('\n');
    }

    getExportOptions(options = {}) {
        const format = options.format ?? document.querySelector('input[name="exportFormat"]:checked')?.value ?? 'png';
        const requestedScale = options.scale ?? parseInt(document.querySelector('input[name="exportScale"]:checked')?.value || '1', 10);
        const presetKey = options.teacherPreset
            ?? document.getElementById('teacherExportPreset')?.value
            ?? 'standard';
        const preset = TEACHER_EXPORT_PRESETS[presetKey] || null;
        const physicalPlan = format === 'png' && preset
            ? getPhysicalExportPlan({
                ...preset,
                sourceWidth: this.canvas.width,
                sourceHeight: this.canvas.height
            })
            : null;

        return {
            format,
            requestedScale,
            scale: format === 'png' ? (physicalPlan?.scale ?? requestedScale) : 1,
            teacherPreset: presetKey,
            physicalPlan,
            includeBackground: options.includeBackground ?? document.getElementById('exportBackground')?.checked ?? true,
            includeGrid: options.includeGrid ?? document.getElementById('exportGrid')?.checked ?? false,
            includeAxes: options.includeAxes ?? document.getElementById('exportAxes')?.checked ?? true
        };
    }

    downloadCanvas(canvas, filename) {
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    drawAreaExportAxisOverlay(targetCtx, screenRect, scale = 1) {
        const geometry = getAreaExportAxisOverlayGeometry(
            screenRect,
            this.canvas.toScreen(new Vec2(0, 0)),
            scale
        );
        if (!geometry.xAxis && !geometry.yAxis) return;

        const drawAxis = (axis) => {
            if (!axis) return;

            targetCtx.beginPath();
            targetCtx.moveTo(axis.line.x1, axis.line.y1);
            targetCtx.lineTo(axis.line.x2, axis.line.y2);
            targetCtx.stroke();

            targetCtx.beginPath();
            targetCtx.moveTo(axis.arrow[0].x, axis.arrow[0].y);
            targetCtx.lineTo(axis.arrow[1].x, axis.arrow[1].y);
            targetCtx.lineTo(axis.arrow[2].x, axis.arrow[2].y);
            targetCtx.closePath();
            targetCtx.fill();

            targetCtx.save();
            targetCtx.font = `italic ${axis.label.fontSize}px "Times New Roman", serif`;
            targetCtx.fillStyle = this.canvas.axisColor || '#333333';
            targetCtx.textAlign = 'center';
            targetCtx.textBaseline = axis.label.baseline;
            targetCtx.fillText(axis.label.text, axis.label.x, axis.label.y);
            targetCtx.restore();
        };

        targetCtx.save();
        targetCtx.strokeStyle = this.canvas.axisColor || '#333333';
        targetCtx.fillStyle = this.canvas.axisColor || '#333333';
        targetCtx.lineWidth = Math.max(1, 1.5 * geometry.scale);
        drawAxis(geometry.xAxis);
        drawAxis(geometry.yAxis);
        targetCtx.restore();
    }

    renderSceneAreaToCanvas(screenRect, options = {}) {
        const {
            scale,
            includeBackground,
            includeGrid,
            includeAxes,
            overlayAreaAxes = true
        } = options;
        const sourceCanvas = document.createElement('canvas');
        this.renderSceneToCanvas(sourceCanvas, {
            scale,
            includeBackground,
            includeGrid,
            includeAxes
        });

        const scaledRect = scaleExportAreaRect(screenRect, scale);
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = scaledRect.width;
        cropCanvas.height = scaledRect.height;

        cropCanvas.getContext('2d').drawImage(
            sourceCanvas,
            scaledRect.x,
            scaledRect.y,
            scaledRect.width,
            scaledRect.height,
            0,
            0,
            scaledRect.width,
            scaledRect.height
        );

        if (includeAxes && overlayAreaAxes) {
            this.drawAreaExportAxisOverlay(cropCanvas.getContext('2d'), screenRect, scale);
        }

        return cropCanvas;
    }

    doExport(options = {}) {
        const exportOptions = this.getExportOptions(options);
        const { format, scale, includeBackground, includeGrid, includeAxes } = exportOptions;

        const tempCanvas = document.createElement('canvas');
        this.renderSceneToCanvas(tempCanvas, {
            scale,
            includeBackground,
            includeGrid,
            includeAxes
        });

        if (format === 'png') {
            this.downloadCanvas(tempCanvas, `graph_${Date.now()}.png`);
        } else {
            this.exportSVG({
                includeBackground,
                includeGrid,
                includeAxes,
                sourceCanvas: tempCanvas
            });
        }

        this.showToast(`${format.toUpperCase()} 파일로 내보냈습니다.`, 'success');
    }

    exportAreaFromScreenRect(screenRect, options = {}) {
        const exportOptions = this.getExportOptions(options);
        const { format, scale, includeBackground, includeGrid, includeAxes } = exportOptions;
        const cropCanvas = this.renderSceneAreaToCanvas(screenRect, {
            scale,
            includeBackground,
            includeGrid,
            includeAxes,
            overlayAreaAxes: format === 'png'
        });

        if (format === 'png') {
            this.downloadCanvas(cropCanvas, `graph_area_${Date.now()}.png`);
        } else {
            this.exportSVG({
                includeBackground,
                includeGrid,
                includeAxes,
                sourceCanvas: cropCanvas,
                cropRect: screenRect
            });
        }

        this.showToast(`${format.toUpperCase()} 영역을 저장했습니다.`, 'success');
    }

    exportSVG(options = {}) {
        const includeBackground = options.includeBackground ?? true;
        const includeGrid = options.includeGrid ?? false;
        const includeAxes = options.includeAxes ?? true;
        const sourceCanvas = options.sourceCanvas ?? document.createElement('canvas');
        const cropRect = options.cropRect ?? null;

        if (!options.sourceCanvas) {
            this.renderSceneToCanvas(sourceCanvas, {
                includeBackground,
                includeGrid,
                includeAxes
            });
        }

        const svg = this.buildSVGMarkup({
            includeBackground,
            includeGrid,
            includeAxes,
            fallbackDataUrl: sourceCanvas.toDataURL('image/png'),
            cropRect
        });

        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `graph_${Date.now()}.svg`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    }

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
                e.target.value = '';
            }
        });

        document.addEventListener('paste', (e) => {
            this.handleClipboardPaste(e);
        });
    }

    setupTeacherWorkflow() {
        const prompt = document.getElementById('chatInput');
        const status = document.getElementById('teacherWorkflowStatus');
        const retry = document.getElementById('teacherRetryBtn');
        const summary = document.getElementById('teacherQaSummary');
        const liveRegion = document.getElementById('teacherWorkflowLive');
        this.teacherWorkflow = new TeacherWorkflow({ prompt, status, retry, summary, liveRegion });

        prompt?.addEventListener('input', () => {
            this.teacherWorkflow.setPrompt(prompt.value);
        });
        retry?.addEventListener('click', () => {
            this.sendChatMessage();
        });

        const updateSummary = () => this.updateTeacherQualitySummary();
        this.objectManager.on('objectAdded', updateSummary);
        this.objectManager.on('objectRemoved', updateSummary);
        this.objectManager.on('objectUpdated', updateSummary);
        this.updateTeacherQualitySummary();
    }

    setTeacherWorkflowState(state, details = {}) {
        this.teacherWorkflow?.setState(state, details);
        if (state === 'error') {
            const alert = document.getElementById('teacherWorkflowAlert');
            if (alert) alert.textContent = details.message || '그림을 생성하지 못했습니다.';
        }
    }

    updateTeacherQualitySummary() {
        return this.teacherWorkflow?.updateQualitySummary(
            this.objectManager.getAllObjects(),
            this.lastSupportResult
        );
    }

    /**
     * AI 설정 모달 설정
     */
    populateAIModelOptions(provider, modelSelect) {
        if (!modelSelect) return;

        modelSelect.innerHTML = '';
        if (provider === 'openai') {
            OPENAI_MODEL_OPTIONS.forEach(({ label, value }) => {
                modelSelect.add(new Option(label, value));
            });
        } else if (provider === 'gemini') {
            GEMINI_MODEL_OPTIONS.forEach(({ label, value }) => {
                modelSelect.add(new Option(label, value));
            });
        } else {
            modelSelect.add(new Option('로컬 (패턴 매칭)', 'local'));
        }
    }

    updateAISettingsAuthState({ providerSelect, apiKeyInput, modelSelect, apiKeyGroup, authHint } = {}) {
        const ownerMode = this.isOwnerMode();
        const provider = ownerMode ? 'openai' : (providerSelect?.value || this.aiService.config.provider || 'local');

        if (providerSelect) {
            providerSelect.value = provider;
            providerSelect.disabled = ownerMode;
        }

        this.populateAIModelOptions(provider, modelSelect);
        if (modelSelect) {
            const model = ownerMode
                ? (this.aiService.config.model || DEFAULT_OPENAI_MODEL)
                : (this.aiService.config.model || modelSelect.value);
            modelSelect.value = model;
            if (!modelSelect.value && modelSelect.options.length > 0) {
                modelSelect.selectedIndex = 0;
            }
        }

        if (apiKeyInput) {
            apiKeyInput.value = ownerMode ? '' : (this.aiService.config.apiKey || '');
            apiKeyInput.disabled = ownerMode;
        }

        if (apiKeyGroup) {
            apiKeyGroup.style.display = (ownerMode || provider === 'local') ? 'none' : 'block';
        }

        if (authHint) {
            authHint.textContent = ownerMode
                ? '박범진 모드: OpenAI는 서버 기본 API를 사용합니다.'
                : '게스트 모드: OpenAI/Gemini 사용 시 API 키를 직접 입력하세요.';
        }
    }

    syncAISettingsControls() {
        this.updateAISettingsAuthState({
            providerSelect: document.getElementById('aiProviderPanel'),
            apiKeyInput: document.getElementById('aiApiKeyPanel'),
            modelSelect: document.getElementById('aiModelPanel'),
            apiKeyGroup: document.getElementById('apiKeyGroupPanel'),
            authHint: document.getElementById('aiAuthHintPanel')
        });

        this.updateAISettingsAuthState({
            providerSelect: document.getElementById('aiProvider'),
            apiKeyInput: document.getElementById('aiApiKey'),
            modelSelect: document.getElementById('aiModel'),
            apiKeyGroup: document.getElementById('apiKeyGroup'),
            authHint: document.getElementById('aiAuthHint')
        });
    }

    saveAISettingsFromControls({ providerSelect, apiKeyInput, modelSelect } = {}) {
        const ownerMode = this.isOwnerMode();
        const provider = ownerMode ? 'openai' : (providerSelect?.value || 'local');
        const apiKey = ownerMode ? '' : (apiKeyInput?.value || '');
        const model = modelSelect?.value || (provider === 'openai' ? DEFAULT_OPENAI_MODEL : provider);

        if (ownerMode) {
            this.aiService.config.provider = 'openai';
            this.aiService.config.apiKey = '';
            this.aiService.config.model = model || DEFAULT_OPENAI_MODEL;
            this.aiService.config.authMode = 'owner';
            this.aiService.config.save();
        } else {
            this.aiService.setProvider(provider);
            this.aiService.setApiKey(apiKey);
            this.aiService.config.model = model;
            this.aiService.config.authMode = 'guest';
            this.aiService.config.save();
        }

        this.syncAISettingsControls();
    }

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
            this.updateAISettingsAuthState({
                providerSelect,
                apiKeyInput,
                modelSelect,
                apiKeyGroup,
                authHint: document.getElementById('aiAuthHint')
            });
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
            this.saveAISettingsFromControls({ providerSelect, apiKeyInput, modelSelect });
            modal?.classList.add('hidden');
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
            this.updateAISettingsAuthState({
                providerSelect,
                apiKeyInput,
                modelSelect,
                apiKeyGroup,
                authHint: document.getElementById('aiAuthHintPanel')
            });
        });

        // API 키 보기 토글
        toggleBtn?.addEventListener('click', () => {
            const isPassword = apiKeyInput.type === 'password';
            apiKeyInput.type = isPassword ? 'text' : 'password';
            toggleBtn.querySelector('span').textContent = isPassword ? 'visibility_off' : 'visibility';
        });

        // 저장
        saveBtn.addEventListener('click', () => {
            this.saveAISettingsFromControls({ providerSelect, apiKeyInput, modelSelect });
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
        this.syncAISettingsControls();
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

        this.syncAISettingsControls();
        modal?.classList.remove('hidden');
    }

    /**
     * 채팅 메시지 전송
     */
    sendChatMessage() {
        const input = document.getElementById('chatInput');
        const message = input?.value.trim();

        if (!message) return;

        this.teacherWorkflow?.setPrompt(message);
        this.lastSupportResult = analyzeDrawingSupport(message);
        this.updateTeacherQualitySummary();
        // 사용자 메시지 추가
        this.addChatMessage(message, 'user');

        if (this.lastSupportResult.status === 'excluded') {
            this.setTeacherWorkflowState('warning', { message: this.lastSupportResult.message });
            this.addChatMessage(`⚠️ ${this.lastSupportResult.message}`, 'assistant');
            return;
        }

        this.setTeacherWorkflowState('checking', { message: this.lastSupportResult.message });

        // AI 응답 (현재는 시뮬레이션)
        setTimeout(() => {
            this.processAICommand(message);
        }, 500);
    }

    /**
     * 채팅 메시지 추가
     */
    addChatMessage(content, type, options = {}) {
        const messages = document.getElementById('chatMessages');
        if (!messages) return;

        const div = document.createElement('div');
        div.className = `message ${type}`;
        const body = document.createElement('div');
        body.className = 'message-content';
        body.textContent = content;
        div.appendChild(body);

        if (options.meta) {
            const meta = document.createElement('div');
            meta.className = 'message-meta';
            meta.textContent = options.meta;
            div.appendChild(meta);
        }

        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
        return div;
    }

    getAIModelResultMeta(result) {
        const parts = [];
        if (result?.mode === 'problem_diagram') {
            parts.push('문제그림 모드로 생성됨');
        }
        if (!result?.model) return parts.join(' · ');
        const initialModel = result.initialModel;
        const finalModel = result.model;
        if (initialModel && initialModel !== finalModel) {
            parts.push(`모델: ${initialModel} -> ${finalModel}`);
            return parts.join(' · ');
        }
        parts.push(`모델: ${finalModel}`);
        return parts.join(' · ');
    }

    addChatImagePreview(imageDataUrl) {
        const messages = document.getElementById('chatMessages');
        if (!messages) return null;

        const div = document.createElement('div');
        div.className = 'message user';

        const body = document.createElement('div');
        body.className = 'message-content';

        const image = document.createElement('img');
        image.src = imageDataUrl;
        image.className = 'chat-image-preview';
        image.alt = '업로드한 이미지 미리보기';

        body.appendChild(image);
        div.appendChild(body);
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
        return div;
    }

    removeChatMessage(messageNode) {
        if (messageNode?.parentNode) {
            messageNode.parentNode.removeChild(messageNode);
        }
    }

    /**
     * AI 명령 처리 (Mk.2: AIService 사용)
     */
    async processAICommand(message) {
        const trimmedMessage = message.trim();

        // JSON 형식인지 확인 - 직접 처리
        if (trimmedMessage.startsWith('{') || trimmedMessage.startsWith('[') ||
            trimmedMessage.startsWith('```')) {
            this.setTeacherWorkflowState('generating');
            return this.processAIJSON(trimmedMessage);
        }

        // 로딩 표시
        const loadingMessage = this.addChatMessage('처리 중... ⏳', 'assistant');
        this.setTeacherWorkflowState('generating');

        try {
            // 현재 캔버스 상태를 컨텍스트로 전달
            const context = this.buildAIContext();

            // AIService로 처리
            const result = await this.aiService.processCommand(message, context);

            if (result.success && result.json) {
                // JSON 패치 적용
                return this.processAIJSON(result.json, {
                    modelMeta: this.getAIModelResultMeta(result)
                });
            } else if (result.error) {
                this.addChatMessage(result.error, 'assistant');
                this.setTeacherWorkflowState('error', { message: result.error });
                return false;
            }
        } catch (error) {
            console.error('AI 명령 처리 실패:', error);
            const message = error.message || 'AI 요청 처리 중 오류가 발생했습니다.';
            this.addChatMessage(`❌ ${message}`, 'assistant');
            this.setTeacherWorkflowState('error', { message });
            return false;
        } finally {
            this.removeChatMessage(loadingMessage);
            this.updateSidebar();
            this.updateTeacherQualitySummary();
        }
    }

    buildAIContext() {
        return {
            objects: this.objectManager.getAllObjects().map(o => {
                const serialized = typeof o.toJSON === 'function' ? o.toJSON() : {};
                return {
                    ...serialized,
                    id: o.id,
                    type: o.type,
                    label: o.label,
                    dependencies: Array.isArray(o.dependencies) ? [...o.dependencies] : [],
                    ...(o.position ? { x: o.position.x, y: o.position.y } : {})
                };
            }),
            selectedObjectIds: this.objectManager.getSelectedObjects().map(o => o.id)
        };
    }

    /**
     * Mk.2: AI JSON 패치 처리
     */
    processAIJSON(jsonInput, intentOptions = {}) {
        // 1. 스키마 검증
        const validationResult = this.schemaValidator.parseAndValidate(jsonInput);

        if (!validationResult.valid) {
            const message = formatAIValidationMessage(validationResult.errors);
            this.addChatMessage(
                `⚠️ ${message}`,
                'assistant'
            );
            console.error('AI JSON 검증 실패:', validationResult.errors);

            this.setTeacherWorkflowState('error', { message });
            return false;
        }

        // 2. 파싱된 JSON 추출
        let data;
        try {
            data = parseAIJSONPayload(jsonInput);
        } catch (e) {
            this.addChatMessage(`⚠️ JSON 파싱 실패: ${e.message}`, 'assistant');
            this.setTeacherWorkflowState('error', { message: e.message });
            return false;
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
            const message = refResult.errors.join(' ');
            this.setTeacherWorkflowState('error', { message });
            return false;
        }

        // 4. 패치 적용
        const intentResult = this.schemaValidator.validateIntent(data, {
            ...intentOptions,
            context: intentOptions.context || this.buildAIContext(),
            maxOperations: intentOptions.mode === 'recreate'
                ? (intentOptions.maxOperations ?? 45)
                : intentOptions.maxOperations
        });

        if (!intentResult.valid) {
            this.addChatMessage(
                `❌ AI 요청 의미 검증 실패:\n• ${intentResult.errors.join('\n• ')}`,
                'assistant'
            );
            console.error('AI semantic validation failed:', intentResult.errors);
            const message = intentResult.errors.join(' ');
            this.setTeacherWorkflowState('error', { message });
            return false;
        }

        const patchResult = this.patchApplier.apply(data);

        if (patchResult.success) {
            this.render();
            this.updateSidebar();
            this.addChatMessage(`✅ ${patchResult.message}`, 'assistant', {
                meta: intentOptions.modelMeta || ''
            });
            this.setTeacherWorkflowState('complete');
            this.updateTeacherQualitySummary();
            return true;
        } else {
            this.addChatMessage(
                `❌ 적용 실패: ${patchResult.message}\n${patchResult.errors.join('\n')}`,
                'assistant'
            );
            console.error('AI 패치 적용 실패:', patchResult);
            this.setTeacherWorkflowState('error', { message: patchResult.message });
            return false;
        }
    }

    /**
     * 이미지 업로드 처리 (AIService 비전 사용)
     */
    handleClipboardPaste(event) {
        const file = this.getClipboardImageFile(event.clipboardData);
        if (!file) {
            return;
        }

        const target = event.target;
        const inChat = typeof target?.closest === 'function' && target.closest('#chat-panel');
        const inEditable = typeof target?.closest === 'function' &&
            target.closest('input, textarea, [contenteditable="true"]');

        if (inEditable && !inChat) {
            return;
        }

        event.preventDefault();
        document.getElementById('chat-panel')?.classList.remove('collapsed');
        this.handleImageUpload(file, { source: 'paste' });
    }

    getClipboardImageFile(clipboardData) {
        const items = Array.from(clipboardData?.items || []);
        for (const item of items) {
            if (item.type?.startsWith('image/')) {
                return item.getAsFile();
            }
        }
        return null;
    }

    getImageDataUrlByteSize(dataUrl) {
        const value = String(dataUrl || '');
        const commaIndex = value.indexOf(',');
        if (commaIndex < 0) return value.length;
        const base64Length = value.length - commaIndex - 1;
        return Math.round((base64Length * 3) / 4);
    }

    loadImageForAI(dataUrl) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('Image preprocessing failed to load the source image.'));
            image.src = dataUrl;
        });
    }

    findSafeImageContentBounds(image) {
        const sourceWidth = image.naturalWidth || image.width;
        const sourceHeight = image.naturalHeight || image.height;
        if (!sourceWidth || !sourceHeight || typeof document === 'undefined' || !document.createElement) return null;

        const sampleLongEdge = 720;
        const sampleScale = Math.min(1, sampleLongEdge / Math.max(sourceWidth, sourceHeight));
        const sampleWidth = Math.max(1, Math.round(sourceWidth * sampleScale));
        const sampleHeight = Math.max(1, Math.round(sourceHeight * sampleScale));
        const canvas = document.createElement('canvas');
        canvas.width = sampleWidth;
        canvas.height = sampleHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sampleWidth, sampleHeight);
        ctx.drawImage(image, 0, 0, sampleWidth, sampleHeight);

        const imageData = ctx.getImageData(0, 0, sampleWidth, sampleHeight);
        const data = imageData.data;
        const cornerSize = Math.max(4, Math.round(Math.min(sampleWidth, sampleHeight) * 0.035));
        const corners = [
            [0, 0],
            [sampleWidth - cornerSize, 0],
            [0, sampleHeight - cornerSize],
            [sampleWidth - cornerSize, sampleHeight - cornerSize]
        ];
        const background = { r: 0, g: 0, b: 0, count: 0 };

        for (const [startX, startY] of corners) {
            for (let y = startY; y < Math.min(sampleHeight, startY + cornerSize); y += 2) {
                for (let x = startX; x < Math.min(sampleWidth, startX + cornerSize); x += 2) {
                    const index = (y * sampleWidth + x) * 4;
                    background.r += data[index];
                    background.g += data[index + 1];
                    background.b += data[index + 2];
                    background.count += 1;
                }
            }
        }

        if (!background.count) return null;
        background.r /= background.count;
        background.g /= background.count;
        background.b /= background.count;

        const threshold = 30;
        let minX = sampleWidth;
        let minY = sampleHeight;
        let maxX = -1;
        let maxY = -1;

        for (let y = 0; y < sampleHeight; y++) {
            for (let x = 0; x < sampleWidth; x++) {
                const index = (y * sampleWidth + x) * 4;
                const alpha = data[index + 3];
                const dr = data[index] - background.r;
                const dg = data[index + 1] - background.g;
                const db = data[index + 2] - background.b;
                const distance = Math.sqrt((dr * dr) + (dg * dg) + (db * db));
                if (alpha > 24 && distance > threshold) {
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }
        }

        if (maxX < minX || maxY < minY) return null;

        const scaleX = sourceWidth / sampleWidth;
        const scaleY = sourceHeight / sampleHeight;
        return {
            x: Math.floor(minX * scaleX),
            y: Math.floor(minY * scaleY),
            width: Math.ceil((maxX - minX + 1) * scaleX),
            height: Math.ceil((maxY - minY + 1) * scaleY)
        };
    }

    async prepareImageForAI(imageDataUrl, options = {}) {
        const originalBytes = this.getImageDataUrlByteSize(imageDataUrl);
        const image = await this.loadImageForAI(imageDataUrl);
        const sourceWidth = image.naturalWidth || image.width;
        const sourceHeight = image.naturalHeight || image.height;
        const cropBounds = this.findSafeImageContentBounds(image);
        const plan = chooseImagePreprocessPlan(
            { width: sourceWidth, height: sourceHeight },
            cropBounds,
            options
        );
        const metadata = {
            originalWidth: plan.originalWidth,
            originalHeight: plan.originalHeight,
            processedWidth: plan.processedWidth,
            processedHeight: plan.processedHeight,
            cropApplied: plan.crop.applied,
            resized: plan.resized,
            scale: Number(plan.scale.toFixed(4)),
            originalBytes,
            processedBytes: originalBytes,
            usedOriginal: true
        };

        if (!plan.crop.applied && !plan.resized) {
            return { dataUrl: imageDataUrl, metadata };
        }

        const canvas = document.createElement('canvas');
        canvas.width = plan.processedWidth;
        canvas.height = plan.processedHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return { dataUrl: imageDataUrl, metadata: { ...metadata, preprocessingSkipped: 'canvas-unavailable' } };
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
            image,
            plan.crop.x,
            plan.crop.y,
            plan.crop.width,
            plan.crop.height,
            0,
            0,
            plan.processedWidth,
            plan.processedHeight
        );

        const dataUrl = canvas.toDataURL('image/jpeg', AI_IMAGE_PREPROCESS_JPEG_QUALITY);
        return {
            dataUrl,
            metadata: {
                ...metadata,
                processedBytes: this.getImageDataUrlByteSize(dataUrl),
                usedOriginal: false
            }
        };
    }

    handleImageUpload(file, options = {}) {
        const reader = new FileReader();

        reader.onload = async (e) => {
            const imageDataUrl = e.target.result;
            const input = document.getElementById('chatInput');
            const instruction = input?.value.trim() || '';
            const mode = instruction ? 'patch' : 'recreate';
            const aiContext = this.buildAIContext();

            if (instruction) {
                this.addChatMessage(instruction, 'user');
                input.value = '';
                input.style.height = 'auto';
            }

            // 이미지 미리보기 메시지
            this.addChatImagePreview(imageDataUrl);
            this.lastImageReference = {
                imageDataUrl,
                processedImageDataUrl: imageDataUrl,
                preprocessing: null,
                source: options.source || 'upload',
                mode,
                instruction
            };

            // 로딩 메시지
            const loadingText = mode === 'patch'
                ? '이미지와 요청을 바탕으로 필요한 부분만 수정 중입니다...'
                : '사진의 도식이나 문제 조건을 바탕으로 도형을 구성 중입니다...';
            const loadingMessage = this.addChatMessage(loadingText, 'assistant');

            try {
                let analysisImageDataUrl = imageDataUrl;
                let preprocessing = null;
                try {
                    const preparedImage = await this.prepareImageForAI(imageDataUrl, { mode });
                    analysisImageDataUrl = preparedImage.dataUrl;
                    preprocessing = preparedImage.metadata;
                } catch (preprocessError) {
                    console.warn('AI image preprocessing skipped:', preprocessError);
                    preprocessing = {
                        failed: true,
                        error: preprocessError?.message || String(preprocessError)
                    };
                }

                this.lastImageReference = {
                    imageDataUrl,
                    processedImageDataUrl: analysisImageDataUrl,
                    preprocessing,
                    source: options.source || 'upload',
                    mode,
                    instruction
                };

                // AIService로 이미지 분석
                const result = await this.aiService.analyzeImage(analysisImageDataUrl, {
                    instruction,
                    mode,
                    context: aiContext
                });

                if (result.success && result.json) {
                    this.addChatMessage(
                        mode === 'patch'
                            ? '요청한 부분 수정 패치를 만들었습니다.'
                            : '사진의 도식이나 문제 조건을 바탕으로 도형을 만들었습니다.',
                        'assistant'
                    );
                    this.processAIJSON(result.json, {
                        mode,
                        instruction,
                        context: aiContext,
                        maxOperations: mode === 'recreate' ? 45 : undefined,
                        modelMeta: this.getAIModelResultMeta(result)
                    });
                } else if (result.error) {
                    this.addChatMessage(`❌ ${result.error}`, 'assistant');
                } else {
                    this.addChatMessage('이미지에서 도형을 인식하지 못했습니다. 다시 시도해주세요.', 'assistant');
                }
            } catch (error) {
                console.error('이미지 분석 처리 실패:', error);
                this.addChatMessage(`❌ ${error.message || '이미지 분석 중 오류가 발생했습니다.'}`, 'assistant');
            } finally {
                this.removeChatMessage(loadingMessage);
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
            projectName: this.projectName,
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

            if (typeof data.projectName === 'string' && data.projectName.trim()) {
                this.setProjectName(data.projectName);
            }

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

    setProjectName(name) {
        this.projectName = String(name || '수학 시험 그림').trim() || '수학 시험 그림';
        localStorage.setItem('graphA_project_name', this.projectName);
        const input = document.getElementById('projectNameInput');
        if (input) input.value = this.projectName;
    }

    buildProjectEnvelope() {
        return createProjectEnvelope({
            name: this.projectName,
            view: {
                offset: {
                    x: this.canvas.offset.x,
                    y: this.canvas.offset.y
                },
                scale: this.canvas.scale
            },
            objects: this.objectManager.toJSON()
        });
    }

    sanitizeProjectFilename(name) {
        const safe = String(name || 'mathgraph-project')
            .replace(/[\\/:*?"<>|]+/g, '-')
            .replace(/\s+/g, ' ')
            .trim();
        return safe || 'mathgraph-project';
    }

    exportProjectFile() {
        const envelope = this.buildProjectEnvelope();
        const blob = new Blob([JSON.stringify(envelope, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = this.sanitizeProjectFilename(this.projectName) + '.mathgraph.json';
        link.click();
        URL.revokeObjectURL(url);
        this.showToast('프로젝트 파일을 저장했습니다.', 'success');
    }

    async importProjectFile(file) {
        try {
            const envelope = parseProjectFile(await file.text());
            const candidateManager = new ObjectManager();
            candidateManager.fromJSON(envelope.objects);
            if (candidateManager.toJSON().length !== envelope.objects.length) {
                throw new Error('지원하지 않는 객체가 포함되어 있습니다.');
            }

            this.objectManager.fromJSON(envelope.objects);
            this.canvas.offset.x = envelope.view.offset.x;
            this.canvas.offset.y = envelope.view.offset.y;
            this.canvas.scale = envelope.view.scale;
            this.setProjectName(envelope.name);
            this.historyManager.clear();
            this.updateSidebar();
            this.updateZoomDisplay();
            this.render();
            this.showToast('프로젝트를 불러왔습니다.', 'success');
        } catch (error) {
            this.showToast(error.message || '프로젝트 파일을 불러오지 못했습니다.', 'error');
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
            const parseMarks = (inputId, endpoint) => String(document.getElementById(inputId)?.value || '')
                .split(',')
                .map(value => Number(value.trim()))
                .filter(Number.isFinite)
                .map(value => ({ value, endpoint }));

            if (start >= end) {
                this.showToast('끝값이 시작값보다 커야 합니다', 'warning');
                return;
            }

            const numberLine = this.objectManager.createNumberLine({
                start, end, step, y,
                customMarks: [
                    ...parseMarks('nlOpenMarks', 'open'),
                    ...parseMarks('nlClosedMarks', 'closed')
                ]
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

    openTextLabelModal(mathPosition) {
        const modal = document.getElementById('textLabelModal');
        if (!modal) return;
        this.pendingTextPosition = mathPosition.clone ? mathPosition.clone() : new Vec2(mathPosition.x, mathPosition.y);
        modal.classList.remove('hidden');
        const input = document.getElementById('textLabelContent');
        if (input) {
            input.value = '';
            requestAnimationFrame(() => input.focus());
        }
    }

    setupTextLabelModal() {
        const modal = document.getElementById('textLabelModal');
        const createBtn = document.getElementById('textLabelCreateBtn');
        const cancelBtn = document.getElementById('textLabelCancelBtn');
        const input = document.getElementById('textLabelContent');
        if (!modal || !createBtn || !cancelBtn || !input) return;

        const close = () => {
            modal.classList.add('hidden');
            this.pendingTextPosition = null;
            this.toolManager.returnToSelect();
        };

        createBtn.addEventListener('click', () => {
            const text = input.value.trim();
            if (!text) {
                this.showToast('넣을 글이나 수식을 입력하세요.', 'warning');
                return;
            }
            const position = this.pendingTextPosition || new Vec2(0, 0);
            const fontSize = Number(document.getElementById('textLabelFontSize')?.value) || 18;
            const align = document.getElementById('textLabelAlign')?.value || 'left';
            const label = this.objectManager.createTextLabel(text, position.x, position.y, {
                fontSize,
                align
            });
            this.historyManager.recordCreate(label);
            this.objectManager.clearSelection();
            this.objectManager.selectObject(label);
            this.updateSidebar();
            this.updatePropertyPanel();
            this.render();
            this.showToast('텍스트를 추가했습니다.', 'success');
            close();
        });

        cancelBtn.addEventListener('click', close);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) close();
        });
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                createBtn.click();
            }
        });
    }

    openCurvedSolidModal(kind) {
        const modal = document.getElementById('curvedSolidModal');
        if (!modal) return;
        this.pendingCurvedSolidKind = kind;
        const names = { cylinder: '원기둥', cone: '원뿔', sphere: '구' };
        const title = document.getElementById('curvedSolidTitle');
        if (title) title.textContent = `${names[kind] || '곡면 입체'} 만들기`;
        document.getElementById('curvedSolidWidth').value = kind === 'sphere' ? '5' : '4';
        document.getElementById('curvedSolidHeight').value = kind === 'sphere' ? '5' : '6';
        modal.classList.remove('hidden');
    }

    setupCurvedSolidModal() {
        const modal = document.getElementById('curvedSolidModal');
        const createBtn = document.getElementById('curvedSolidCreateBtn');
        const cancelBtn = document.getElementById('curvedSolidCancelBtn');
        if (!modal || !createBtn || !cancelBtn) return;

        const close = () => {
            modal.classList.add('hidden');
            this.pendingCurvedSolidKind = null;
            this.toolManager.returnToSelect();
        };

        createBtn.addEventListener('click', () => {
            try {
                const input = buildCurvedSolidInput({
                    kind: this.pendingCurvedSolidKind,
                    x: document.getElementById('curvedSolidX').value,
                    y: document.getElementById('curvedSolidY').value,
                    width: document.getElementById('curvedSolidWidth').value,
                    height: document.getElementById('curvedSolidHeight').value,
                    ellipseRatio: document.getElementById('curvedSolidEllipseRatio').value,
                    showHiddenLines: document.getElementById('curvedSolidHiddenLines').checked
                });
                const solid = this.objectManager.createCurvedSolid(input.kind, input);
                this.historyManager.recordCreate(solid);
                this.objectManager.clearSelection();
                this.objectManager.selectObject(solid);
                this.updateSidebar();
                this.updatePropertyPanel();
                this.render();
                this.showToast(`${solid.getTypeName()}을 추가했습니다.`, 'success');
                close();
            } catch (error) {
                this.showToast(error.message, 'warning');
            }
        });

        cancelBtn.addEventListener('click', close);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) close();
        });
    }
}

// 앱 시작
document.addEventListener('DOMContentLoaded', () => {
    window.app = new GraphAApp();
});

export default GraphAApp;
11
