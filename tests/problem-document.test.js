import test from 'node:test';
import assert from 'node:assert/strict';
import { splitProblemMath, buildProblemParagraphs, chooseHwpDocument, mathPartsToLatex, problemEquationPreview } from '../js/utils/ProblemDocument.js';
import { createProjectEnvelope, parseProjectFile } from '../js/utils/ProjectFile.js';
import { HwpBridgeClient } from '../js/utils/HwpBridgeClient.js';
import { ObjectManager } from '../js/core/ObjectManager.js';

test('미리보기의 선분 정체와 평행 기호를 맞추고 변수 및 명시적 글자 모양을 보존한다', () => {
    const source = '\\bar{BC}\\parallel\\bar{DE}+x';
    assert.equal(problemEquationPreview(source), '\\bar{\\mathrm{BC}}\\mathrel{/\\mkern-3mu/}\\bar{\\mathrm{DE}}+x');
    assert.equal(problemEquationPreview('\\bar{x}+\\bar{\\mathit{AB}}'), '\\bar{x}+\\bar{\\mathit{AB}}');
    assert.equal(splitProblemMath('$' + source + '$')[0].value, source);
});

test('실제 편집기의 문제와 연결된 도형을 프로젝트 파일로 왕복한다', async () => {
    const oldDocument=globalThis.document, oldWindow=globalThis.window;
    globalThis.document={addEventListener(){}}; globalThis.window={};
    let GraphAApp;
    try { ({default:GraphAApp}=await import('../js/main.js')); }
    finally { globalThis.document=oldDocument; globalThis.window=oldWindow; }
    const manager=new ObjectManager();
    const a=manager.createPoint(1,3,{label:'A'}), b=manager.createPoint(-2,-2,{label:'B'});
    manager.createSegment(a.id,b.id);
    const problem={number:'7',blocks:[{kind:'body',text:'선분 $AB$의 길이를 구하시오.'}],warnings:[]};
    const source={projectName:'보존 시험',canvas:{offset:{x:17,y:23},scale:75},objectManager:manager,problemComposer:{problem}};
    const file=GraphAApp.prototype.buildProjectEnvelope.call(source);
    assert.equal(file.objects.length,3);
    let message='';
    const restored={objectManager:new ObjectManager(),canvas:{offset:{}},problemComposer:{renderProblem(){}},
        historyManager:{clear(){}},setProjectName(name){this.projectName=name;},updateSidebar(){},updateZoomDisplay(){},render(){},showToast(text){message=text;}};
    await GraphAApp.prototype.importProjectFile.call(restored,{text:async()=>JSON.stringify(file)});
    assert.equal(message,'프로젝트를 불러왔습니다.');
    const geometry = value => value.objects.map(({createdAt,...object})=>object);
    assert.deepEqual(geometry(restored.objectManager.toJSON()),geometry(manager.toJSON()));
    assert.deepEqual(restored.problemComposer.problem,problem);
    assert.deepEqual(restored.canvas,source.canvas);
});

test('사진에서 읽은 여러 줄과 선택지 사이의 줄바꿈을 한글 문단으로 보존한다', () => {
    const paragraphs=buildProblemParagraphs({blocks:[{kind:'body',text:'함수 $y=x^2$\n다음 물음에 답하시오.\n① $1$\n② $2$'}]});
    assert.equal(paragraphs.length,4);
    assert.equal(paragraphs[2].segments[0].value,'① ');
    assert.equal(paragraphs[3].segments[1].value,'2');
});

test('본문, 분수, 단위와 선택지 번호를 각각 올바른 개체로 구분한다', () => {
    const problem = { number:'12', blocks:[{kind:'body',text:'길이가 $3\\,\\mathrm{cm}$인 선분 $AB$'}, {kind:'choice',text:'① $\\frac{1}{2}$'}], warnings:[] };
    const paragraphs = buildProblemParagraphs(problem);
    assert.equal(paragraphs[0].segments[1].kind, 'equation');
    assert.equal(paragraphs[1].segments[0].value, '① ');
    assert.equal(paragraphs[1].segments[1].value, '\\frac{1}{2}');
    const project = createProjectEnvelope({name:'문제', objects:[],problem});
    assert.deepEqual(parseProjectFile(JSON.stringify(project)).problem, problem);
});
test('일반 글자에 남은 수식과 짝이 없는 구분자를 입력 전에 거부한다', () => {
    assert.throws(() => buildProblemParagraphs({blocks:[{kind:'body',text:'길이 3 cm'}]}), /수학 표현/);
    assert.throws(() => splitProblemMath('함수 $x^2'), /시작과 끝/);
});

test('배점 표기는 일반 글자로 보존하고 수학 숫자 검사는 유지한다', () => {
    for (const score of ['[4점]', '(2.5점)']) {
        const paragraphs = buildProblemParagraphs({blocks:[{kind:'body',text:`$x$의 값은? ${score}`}]});
        assert.deepEqual(paragraphs[0].segments, [
            {kind:'equation',value:'x'}, {kind:'text',value:`의 값은? ${score}`}
        ]);
    }
    for (const text of ['점 4개 [4점]', '[4cm]', '$x$의 값은? [4점]+2']) {
        assert.throws(() => buildProblemParagraphs({blocks:[{kind:'body',text}]}), /수학 표현/);
    }
});
test('그림의 복합 라벨을 하나의 수식으로 보존한다', () => {
    assert.equal(mathPartsToLatex([{type:'fraction',numerator:[{type:'radical',radicand:[{type:'text',text:'3'}]}],denominator:[{type:'text',text:'2'}]}]), '\\frac{\\sqrt{3}}{2}');
});
test('문서 없음, 하나, 여러 개, 닫힌 선택 및 새 문서 선택을 구분한다', () => {
    const a={id:'a'},b={id:'b'};
    assert.equal(chooseHwpDocument([]), 'new');
    assert.equal(chooseHwpDocument([a]), 'a');
    assert.equal(chooseHwpDocument([a,b]), '');
    assert.equal(chooseHwpDocument([a,b],'gone'), '');
    assert.equal(chooseHwpDocument([a,b],'b'), 'b');
    assert.equal(chooseHwpDocument([a],'new'), 'new');
});
const storage={getItem:()=> 'a'.repeat(40),setItem:()=>{}};
test('문서 목록 조회 시간 초과는 입력 결과 미확인과 구분한다', async () => {
    const client=new HwpBridgeClient({storage,fetchImpl:async()=>{throw new DOMException('Aborted','AbortError');}});
    await assert.rejects(client.documents(),/로컬 연결 허용/);
    assert.equal(client.pending,null);
    await assert.rejects(client.insert({documentId:'new'}),/같은 요청/);
    assert.ok(client.pending?.requestId);
});

test('빈 사진이나 지원하지 않는 파일 오류는 열린 한글 입력창 안에서도 보인다', async () => {
    const oldDocument=globalThis.document, oldWindow=globalThis.window;
    globalThis.document={addEventListener(){}}; globalThis.window={};
    let GraphAApp;
    try { ({default:GraphAApp}=await import('../js/main.js')); }
    finally { globalThis.document=oldDocument; globalThis.window=oldWindow; }
    let shown='', inline='';
    const app={showToast(message){shown=message;},problemComposer:{dialog:{open:true},status(message){inline=message;}}};
    GraphAApp.prototype.handleImageUpload.call(app,{type:'image/png',size:0});
    assert.match(inline,/비어/); assert.equal(inline,shown);
    GraphAApp.prototype.handleImageUpload.call(app,{type:'application/pdf',size:100});
    assert.match(inline,/PNG/); assert.equal(inline,shown);
    assert.equal(app.imageUploadBusy,undefined);
});
test('fetch 호출의 수신 객체와 네트워크 실패 재시도의 요청 번호를 보존한다', async () => {
    const ids=[]; let count=0;
    const client=new HwpBridgeClient({storage,fetchImpl:function(url,init) {
        assert.equal(this, globalThis);
        ids.push(JSON.parse(init.body).requestId);
        if (++count === 1) throw new TypeError('network');
        return Promise.resolve({ok:true,json:async()=>({ok:true})});
    }});
    await assert.rejects(client.insert({documentId:'new'}), /연결 프로그램/);
    await assert.rejects(client.insert({documentId:'different'}), /앞선 입력/);
    await client.retryPending();
    assert.equal(ids[0],ids[1]); assert.equal(client.pending,null);
});
test('확정된 변환 실패는 내용을 수정하여 다시 입력할 수 있다', async () => {
    const client=new HwpBridgeClient({storage,fetchImpl:async()=>({ok:false,json:async()=>({error:'지원하지 않는 수식',final:true})})});
    await assert.rejects(client.insert({documentId:'new'}), /수식/);
    assert.equal(client.pending,null);
});
