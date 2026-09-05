import { recognizeProblemDocument } from '../ai/ProblemRecognition.js';
import { buildProblemParagraphs, normalizeProblemDocument, splitProblemMath, chooseHwpDocument } from '../utils/ProblemDocument.js';
import { HwpBridgeClient } from '../utils/HwpBridgeClient.js';
import { captureHwpDiagram } from '../utils/HwpDiagram.js';

export class ProblemComposer {
    constructor(app) {
        this.app = app;
        this.client = new HwpBridgeClient();
        this.problem = { number: '', blocks: [], warnings: [] };
        this.busy = false;
        this.recognition = null;
        this.dialog = document.createElement('dialog');
        this.dialog.className = 'problem-dialog';
        this.dialog.setAttribute('aria-labelledby', 'problemDialogTitle');
        this.dialog.innerHTML = `
            <header class="problem-heading"><div><span class="problem-eyebrow">MathGraph → 한글</span><h2 id="problemDialogTitle">한글에 문제 넣기</h2></div><button type="button" class="problem-close" aria-label="닫기">×</button></header>
            <div class="problem-layout"><section class="problem-sheet">
                <div class="problem-sheet-tools"><button type="button" class="btn btn-secondary" data-action="photo">사진 가져오기</button><button type="button" class="btn btn-secondary" data-action="recognize">다시 인식</button><button type="button" class="btn btn-secondary" data-action="edit">내용 수정</button><button type="button" class="btn btn-secondary" data-action="cancel" hidden>인식 중단</button></div>
                <label class="problem-number">문제 번호 <input id="problemNumber" type="text" inputmode="numeric" maxlength="4" placeholder="없음"></label>
                <div class="problem-preview" id="problemPreview"></div>
                <div class="problem-editors" hidden></div>
                <p class="problem-math-help" hidden>수식은 $x^2$처럼 표시합니다. 조건과 선택지는 각각의 칸에서 수정할 수 있습니다.</p>
                <div class="problem-figure"><img alt="현재 작업판의 그림" hidden><span>그림을 만든 뒤 이곳에서 확인할 수 있습니다.</span></div>
                <details class="problem-source" hidden><summary>원본 사진 보기</summary><img alt="문제를 인식한 원본 사진"></details>
            </section><aside class="problem-settings">
                <h3>입력할 문서</h3>
                <p id="hwpConnectionStatus" class="problem-muted" role="status">한글 연결을 확인해 주세요.</p>
                <select id="hwpDocument" aria-label="입력할 한글 문서"><option value="">연결 확인 필요</option></select>
                <button type="button" class="btn btn-secondary" data-action="connect">연결 확인</button>
                <p class="problem-muted">문서 하나는 자동 선택합니다. 여러 개면 제목과 ‘현재 문서’ 표시를 확인해 고르세요. 선택한 문서의 커서 위치에 넣습니다.</p>
                <div class="problem-divider"></div><h3>입력 모양</h3>
                <label>본문 글자 크기<select id="hwpFontSize"><option value="0" selected>현재 문서에 맞춤</option><option value="10">10 pt</option><option value="11">11 pt</option><option value="12">12 pt</option></select></label>
                <label>그림 폭<select id="hwpDiagramWidth"><option value="80">80 mm · 두 단 시험지</option><option value="120" selected>120 mm · 넓은 본문</option><option value="150">150 mm · 활동지</option></select></label>
                <label class="problem-check"><input id="hwpIncludeDiagram" type="checkbox" checked>현재 그림 포함</label>
                <label class="problem-check"><input id="hwpIncludeAxes" type="checkbox" checked>좌표축 포함</label>
                <label class="problem-check"><input id="hwpAutoInsert" type="checkbox">다음 사진부터 인식 후 바로 넣기</label>
                <p class="problem-muted">확인할 내용이 있거나 그림 생성에 실패하면 자동 입력을 멈춥니다.</p>
                <details class="hwp-setup"><summary>처음 연결하기</summary><p>Windows에 한글이 설치되어 있어야 합니다.</p><ol><li><a href="downloads/mathgraph-hancom.zip" download>연결 프로그램 받기</a></li><li>압축을 풀고 <b>시작.cmd</b>를 실행합니다.</li><li>자동으로 열리는 MathGraph에서 작업합니다.</li></ol><p>현재 탭을 연결하려면 프로그램에 표시된 연결 코드를 입력하세요.</p><input id="hwpPairToken" type="password" autocomplete="off" aria-label="한글 연결 코드"><button class="btn btn-secondary" type="button" data-action="pair">코드로 연결</button></details>
            </aside></div>
            <footer class="problem-footer"><div><p id="problemStatus" role="status" aria-live="polite">사진을 가져오거나 문제를 직접 입력해 주세요.</p><label class="problem-check problem-review" hidden><input id="problemReviewed" type="checkbox">확인 사항을 검토하고 필요한 내용을 수정했습니다.</label></div><button class="btn btn-secondary" type="button" data-action="retry" hidden>결과 다시 확인</button><button class="btn btn-primary" type="button" data-action="insert">커서 위치에 넣기</button></footer>`;
        document.body.append(this.dialog);
        this.dialog.querySelector('.problem-close').addEventListener('click', () => this.dialog.close());
        this.dialog.addEventListener('click', event => {
            const action = event.target.closest('[data-action]')?.dataset.action;
            if (action) this.perform(action);
        });
        this.dialog.querySelector('#problemNumber').addEventListener('input', event => { this.problem.number = event.target.value; });
        for (const id of ['hwpIncludeDiagram', 'hwpIncludeAxes', 'hwpDiagramWidth']) this.dialog.querySelector('#' + id).addEventListener('change', () => this.updateFigure());
        document.getElementById('openHwpBtn')?.addEventListener('click', () => this.open());
        const hash = new URLSearchParams(location.hash.slice(1));
        const token = hash.get('mathgraph-hwp');
        if (token) {
            try { this.client.connect(token); } catch (error) { this.status(error.message); }
            hash.delete('mathgraph-hwp');
            history.replaceState(null, '', location.pathname + location.search + (hash.size ? '#' + hash : ''));
            this.open();
        }
        this.renderProblem();
    }
    el(selector) { return this.dialog.querySelector(selector); }
    status(message, warning = false) {
        this.el('#problemStatus').textContent = message;
        this.el('#problemStatus').classList.toggle('is-error', warning);
    }
    async perform(action) {
        try {
            if (action === 'photo') {
                this.app.imageUploadIntent = 'problem';
                document.getElementById('imageInput')?.click();
            }
            else if (action === 'edit') this.toggleEdit();
            else if (action === 'connect') await this.refreshDocuments();
            else if (action === 'pair') {
                this.client.connect(this.el('#hwpPairToken').value.trim());
                this.el('#hwpPairToken').value = '';
                await this.refreshDocuments();
            } else if (action === 'recognize') {
                const image = this.app.lastImageReference?.imageDataUrl;
                if (!image) throw new Error('먼저 문제 사진을 가져와 주세요.');
                await this.startRecognition(image);
            } else if (action === 'insert') await this.insert();
            else if (action === 'retry') {
                this.setBusy(true);
                try { await this.inserted(await this.client.retryPending()); } finally { this.setBusy(false); }
            } else if (action === 'cancel') {
                this.controller?.abort();
                this.app.imageAbortController?.abort();
                this.status('인식을 중단했습니다. 이전 문제는 그대로 남아 있습니다.');
            }
        } catch (error) {
            this.status(error.message, true);
            this.el('[data-action="retry"]').hidden = !this.client.pending;
        }
    }
    open() {
        if (!this.dialog.open) this.dialog.showModal();
        this.updateFigure();
        if (this.client.token) this.refreshDocuments().catch(error => this.status(error.message, true));
    }
    async refreshDocuments() {
        const { documents } = await this.client.documents();
        const select = this.el('#hwpDocument');
        const chosen = chooseHwpDocument(documents, select.value);
        select.replaceChildren();
        if (documents.length > 1) select.add(new Option('입력할 문서를 선택하세요', ''));
        for (const doc of documents) select.add(new Option(doc.title + (doc.active ? ' · 현재 문서' : ''), doc.id));
        select.add(new Option('새 한글 문서', 'new'));
        select.value = chosen;
        this.el('#hwpConnectionStatus').textContent = `연결됨 · 열린 문서 ${documents.length}개`;
        return documents;
    }
    async startRecognition(image) {
        if (this.recognition) throw new Error('현재 사진을 인식하고 있습니다. 완료 후 다시 시도해 주세요.');
        this.controller = new AbortController();
        this.setBusy(true);
        this.el('[data-action="cancel"]').hidden = false;
        this.status('사진의 문제와 수식을 읽고 있습니다.');
        this.el('.problem-source').hidden = false;
        this.el('.problem-source img').src = image;
        const signal = this.controller.signal;
        const run = (async () => {
            const prepared = await this.app.prepareImageForAI(image, { mode: 'problem_diagram' });
            if (signal.aborted) throw new Error('사진 인식을 중단했습니다.');
            return recognizeProblemDocument(this.app.aiService, prepared.dataUrl, { signal });
        })();
        this.recognition = run;
        try {
            const document = await run;
            if (this.controller.signal.aborted) return false;
            this.problem = document;
            this.el('#problemReviewed').checked = false;
            this.el('.problem-editors').hidden = true;
            this.el('.problem-math-help').hidden = true;
            this.renderProblem();
            this.status(document.warnings.length ? document.warnings.join(' · ') : '문제를 읽었습니다. 본문과 그림을 확인해 주세요.', document.warnings.length > 0);
            return true;
        } catch (error) {
            this.status(error.message, true);
            return false;
        } finally {
            if (this.recognition === run) this.recognition = null;
            this.el('[data-action="cancel"]').hidden = true;
            this.setBusy(false);
        }
    }
    async imageFinished(recognition, diagramApplied) {
        const recognized = await recognition;
        this.updateFigure();
        if (!recognized) { if (recognition) this.open(); return; }
        if (!diagramApplied) this.status('문제는 읽었지만 그림 생성은 완료하지 못했습니다. 그림을 확인한 뒤 넣어 주세요.', true);
        const automatic = this.el('#hwpAutoInsert').checked;
        if (automatic && recognized && diagramApplied && !this.problem.warnings.length) {
            try { await this.insert(); } catch (error) { this.status(error.message, true); this.open(); }
        } else this.open();
    }
    renderProblem() {
        this.el('#problemNumber').value = this.problem.number;
        this.el('.problem-review').hidden = this.problem.warnings.length === 0;
        const preview = this.el('#problemPreview');
        preview.replaceChildren();
        if (!this.problem.blocks.length) {
            const empty = document.createElement('p');
            empty.className = 'problem-empty'; empty.textContent = '사진 속 문제를 가져오거나, 내용 수정에서 직접 입력하세요.';
            preview.append(empty);
        }
        for (const block of this.problem.blocks) {
            const paragraph = document.createElement('p');
            paragraph.className = 'problem-block problem-' + block.kind;
            try {
                for (const part of splitProblemMath(block.text)) {
                    const span = document.createElement('span');
                    if (part.kind === 'equation' && globalThis.katex) globalThis.katex.render(part.value, span, { throwOnError: false, trust: false, strict: 'ignore' });
                    else span.textContent = part.value;
                    paragraph.append(span);
                }
            } catch { paragraph.textContent = block.text; }
            preview.append(paragraph);
        }
    }
    toggleEdit() {
        const editors = this.el('.problem-editors');
        editors.hidden = !editors.hidden;
        this.el('.problem-math-help').hidden = editors.hidden;
        if (editors.hidden) return;
        if (!this.problem.blocks.length) this.problem.blocks.push({ kind: 'body', text: '' });
        editors.replaceChildren();
        this.problem.blocks.forEach((block, index) => {
            const label = document.createElement('label');
            label.textContent = ({ body: '본문', condition: '조건·보기', choice: '선택지' })[block.kind];
            const textarea = document.createElement('textarea'); textarea.rows = 3; textarea.value = block.text;
            textarea.addEventListener('input', () => { this.problem.blocks[index].text = textarea.value; this.el('#problemReviewed').checked = false; this.renderProblem(); });
            label.append(textarea); editors.append(label);
        });
    }
    updateFigure() {
        const hasObjects = this.app.objectManager.getAllObjects().some(o => o.visible);
        const image = this.el('.problem-figure img');
        image.hidden = !hasObjects || !this.el('#hwpIncludeDiagram').checked;
        this.el('.problem-figure span').hidden = !image.hidden;
        if (image.hidden) return;
        const canvas = document.createElement('canvas');
        this.app.renderSceneToCanvas(canvas, { includeAxes: this.el('#hwpIncludeAxes').checked, includeGrid: false });
        image.src = canvas.toDataURL('image/png');
    }
    setBusy(value) {
        this.busy = value;
        for (const action of ['insert', 'photo', 'recognize']) this.el(`[data-action="${action}"]`).disabled = value;
    }
    async insert() {
        if (this.busy || this.app.imageUploadBusy) throw new Error('문제와 그림의 인식이 끝난 뒤 넣어 주세요.');
        const problem = normalizeProblemDocument(this.problem);
        if (problem.warnings.length && !this.el('#problemReviewed').checked) throw new Error('확인 사항을 검토하고 수정한 뒤 확인 표시를 해 주세요.');
        const paragraphs = buildProblemParagraphs(problem);
        const selectionBefore = this.el('#hwpDocument').value;
        if (!selectionBefore) throw new Error('연결을 확인하고 입력할 한글 문서를 선택해 주세요.');
        await this.refreshDocuments();
        if (selectionBefore !== this.el('#hwpDocument').value) throw new Error('열린 문서가 바뀌었습니다. 입력할 문서를 다시 선택해 주세요.');
        const hasObjects = this.app.objectManager.getAllObjects().some(o => o.visible);
        const diagram = this.el('#hwpIncludeDiagram').checked && hasObjects ? captureHwpDiagram(this.app, {
            widthMm: Number(this.el('#hwpDiagramWidth').value), includeAxes: this.el('#hwpIncludeAxes').checked
        }) : null;
        if (!paragraphs.length && !diagram) throw new Error('입력할 문제나 그림이 없습니다.');
        this.setBusy(true);
        this.status('수식과 그림을 준비해 한글에 넣고 있습니다.');
        try {
            await this.inserted(await this.client.insert({ documentId: selectionBefore, number: problem.number, paragraphs, diagram, fontSize: Number(this.el('#hwpFontSize').value) }));
        } finally { this.setBusy(false); }
    }
    async inserted(result) {
        this.status(`${result.title}에 입력했습니다. 수식 ${result.equationCount}개${result.hasDiagram ? '와 그림을' : '를'} 확인해 주세요.`);
        this.el('[data-action="retry"]').hidden = true;
        this.app.showToast('한글의 커서 위치에 문제를 넣었습니다.', 'success');
        if (result.documentId) {
            try {
                await this.refreshDocuments();
                this.el('#hwpDocument').value = result.documentId;
            } catch { /* Successful insertion remains successful if a subsequent read fails. */ }
        }
    }
}
