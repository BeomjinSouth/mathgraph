import test from 'node:test';
import assert from 'node:assert/strict';
import { AIService, fetchWithTimeout } from '../js/ai/AIService.js';
import { recognizeProblemDocument } from '../js/ai/ProblemRecognition.js';
import { buildProblemParagraphs } from '../js/utils/ProblemDocument.js';
import { ProblemComposer } from '../js/ui/ProblemComposer.js';

test('연결 프로그램이 연 새 탭은 로그인 후 한글 입력창을 열고 로그아웃 시 닫는다', () => {
    let opened=0, closed=0, authMessage='';
    const composer={app:{authSession:null,setAuthMessage(value){authMessage=value;}},client:{token:''},
        dialog:{open:false,showModal(){this.open=true;opened++;},close(){this.open=false;closed++;}},
        updateFigure(){},open(){ProblemComposer.prototype.open.call(this);}};
    composer.open();
    assert.equal(opened,0);
    assert.equal(composer.pendingOpen,true);
    assert.match(authMessage,/로그인/);
    composer.app.authSession={mode:'guest'};
    ProblemComposer.prototype.onAuthChanged.call(composer);
    assert.equal(opened,1);
    assert.equal(composer.pendingOpen,false);
    ProblemComposer.prototype.onAuthChanged.call(composer);
    assert.equal(opened,1);
    composer.app.authSession=null;
    ProblemComposer.prototype.onAuthChanged.call(composer);
    assert.equal(closed,1);
    assert.equal(composer.dialog.open,false);
    composer.app.authSession={mode:'owner'};
    ProblemComposer.prototype.onAuthChanged.call(composer);
    assert.equal(opened,2);
});

test('자동 입력은 문제와 그림 인식이 모두 성공하고 확인 사항이 없을 때만 실행한다', async () => {
    for (const [recognized, diagram, warnings, automatic, expected] of [
        [true,true,[],true,1], [true,false,[],true,0], [false,true,[],true,0],
        [true,true,['흐린 수식 확인'],true,0], [true,true,[],false,0]
    ]) {
        let inserted=0, opened=0;
        const composer={problem:{warnings},updateFigure(){},status(){},
            el(){return {checked:automatic};},async insert(){inserted++;},open(){opened++;}};
        await ProblemComposer.prototype.imageFinished.call(composer,Promise.resolve(recognized),diagram);
        assert.equal(inserted,expected);
        if(!expected) assert.equal(opened,1);
    }
});

test('사진 인식은 기존 OpenAI 전송 방식과 엄격한 문제 형식을 사용한다', async () => {
    const service=new AIService({provider:'openai',model:'gpt-5.4',apiKey:'test-key',authMode:'guest',save(){}});
    const previous=globalThis.fetch;
    const expected={number:'8',blocks:[{kind:'body',text:'함수 $y=-x^2+4$의 그래프를 보시오.'},
        {kind:'condition',text:'점 $A(1,3)$'}, {kind:'choice',text:'① $\\frac{1}{2}$\n② $\\sqrt{3}$'}],warnings:[]};
    globalThis.fetch=async(url, options)=>{
        assert.match(url,/\/v1\/responses$/);
        const body=JSON.parse(options.body);
        assert.equal(body.text.format.type,'json_schema');
        assert.equal(body.text.format.strict,true);
        assert.equal(body.input[1].content[1].detail,'high');
        assert.equal(body.input[1].content[1].image_url,'data:image/png;base64,dGVzdA==');
        return new Response(JSON.stringify({output_text:JSON.stringify(expected)}),{status:200});
    };
    try {
        const result=await recognizeProblemDocument(service,'data:image/png;base64,dGVzdA==');
        assert.deepEqual(result,expected);
        assert.equal(buildProblemParagraphs(result).flatMap(p=>p.segments).filter(p=>p.kind==='equation').length,4);
    } finally { globalThis.fetch=previous; }
});

test('사용자가 중단하면 진행 중인 사진 요청을 즉시 취소한다', async () => {
    const previous=globalThis.fetch, controller=new AbortController();
    globalThis.fetch=async(url,{signal})=>new Promise((resolve,reject)=>{
        signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
        controller.abort();
    });
    try { await assert.rejects(fetchWithTimeout('/test',{signal:controller.signal}),/중단|취소/); }
    finally { globalThis.fetch=previous; }
});

test('인식 결과가 불완전하면 본문을 임의로 만들지 않는다', async () => {
    const service=new AIService({provider:'openai',model:'gpt-5.4',apiKey:'test-key',authMode:'guest',save(){}});
    const previous=globalThis.fetch;
    globalThis.fetch=async()=>new Response(JSON.stringify({output_text:'응답이 잘렸습니다.'}));
    try { await assert.rejects(recognizeProblemDocument(service,'data:image/png;base64,dGVzdA==')); }
    finally { globalThis.fetch=previous; }
});
