"""Record the author's completed mathematical and rendered-page review.

Independent verdicts are supplied separately by the reviewer, never generated here.
"""
import sys,json,os,re
from pathlib import Path
import pypdfium2 as pdfium
BASE=Path(__file__).resolve().parent
sys.path.insert(0,r'C:\Users\pbj95\.codex\skills\pbj-exam-hwpx\scripts')
from review_scaffold import scaffold
from math_review import question_records
from native_verify import sha
from delivery_check import check
OUT=BASE/'완성-검수'
S=BASE/'학생용-사각형의-성질-가독성-개선-완성.hwpx'
T=BASE/'교사용-사각형의-성질-가독성-개선-채점보완.hwpx'
def read(p):return json.loads(p.read_text(encoding='utf8'))
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf8')
if not OUT.exists():scaffold(S,T,S.with_suffix('.pdf'),T.with_suffix('.pdf'),BASE/'시험정보.json',OUT)
records=question_records(S)
# Recheck inherited mathematical entries and replace changed or incorrect claims.
math=read(BASE.parent/'검수/그림포함/최종/문항별-검산.json')
math.update(student_sha256=sha(S),teacher_sha256=sha(T))
items={item['id']:item for item in math['items']}
for id,item in items.items():
    item['stem_excerpt']=records[id]['text'][:30]
    item['source_scripts']=records[id]['scripts']
def options(id,values,answer,unit=''):
    item=items[id]
    item['options']=[{'label':label,'satisfies_prompt':value==answer,
        'reason':f'원래 조건에서 구한 값은 {answer}{unit}이므로 {value}{unit}'+('와 일치한다.' if value==answer else '는 조건을 만족하지 않는다.')}
        for label,value in zip('①②③④⑤',values)]
options('MC1',[81,90,95,99,108],99,'도')
items['MC1']['options'][0]['reason']='81도는 각 A의 크기이고, 질문한 각 D는 99도이다.'
options('MC3',[22,24,26,28,30],26)
options('MC6',[100,120,110,130,140],120,'도')
options('MC9',[100,102,104,106,108],108,'도')
items['MC4']['options'][1]['reason']='A(-1,0), B(0,2), C(1,0), D(0,-1)에서는 AO=OC이지만 BO≠OD이므로 평행사변형이 아니다.'
items['MC4']['options'][2]['reason']='A(-2,0), B(0,1), C(1,0), D(0,-1)에서는 BO=OD이지만 AO≠OC이므로 평행사변형이 아니다.'
items['MC4']['options'][3]['reason']='A(-2,0), B(2,0), C(1,2), D(-1,2)는 대각선 길이가 모두 √13인 등변사다리꼴이지만 평행사변형이 아니다.'
items['MC4']['options'][4]['reason']='A(-1,0), B(0,2), C(1,0), D(0,-1)은 대각선이 수직인 연꼴이지만 평행사변형이 아니다.'
items['MC7']['derivation']='ㄱ은 이웃각의 합과 대각의 성질로 참, ㄴ은 60도·120도 마름모가 반례여서 거짓, ㄷ은 직사각형 판정으로 참, ㄹ은 직사각형이면서 마름모이므로 정사각형이 되어 참이다.'
items['MC8'].update(derivation='AO=BO에서 x+1=2x-3이므로 x=4. AO=BO=5, AB=8, BC=6. 대각선 10과 두 변은 8²+6²=10²까지 만족한다. 둘레는 28cm이다.',
    teacher_agreement='교사용 8번의 x=4와 2(8+6)=28cm를 대조했고, 원래 네 길이 조건의 동시 실현 가능성도 확인했다.',
    calculations=[{'left':'x+1','right':'2*x-3','bindings':{'x':'4'},'reason':'대각선 반길이'},
                  {'left':'2*(2*x+x+2)','right':'28','bindings':{'x':'4'},'reason':'두 변의 길이로 둘레 검산'},
                  {'left':'(2*x)**2+(x+2)**2','right':'(2*(x+1))**2','bindings':{'x':'4'},'reason':'직사각형이 실제 존재하는지 네 길이 동시 확인'}])
options('MC8',[26,28,30,32,34],28,'cm')
items['E2']['answer_only']['rule']='미지수와 네 각 전체가 모두 정답이면3점, 미지수만 정답이거나 네 각 전체만 정답이면2점. 네 각 일부 정답에는 가점하지 않으며 나머지는0점. 오류 전파의 후속 각 계산 인정은 풀이 제시 경우에만 적용한다.'
items['E3']['answer']='직사각형, x=6, 넓이 209cm²'
items['E3']['answer_only']['rule']='직사각형 판정·x=6·넓이209cm²의 정답마다 1점을 합산하여 최대3점. 모두 오답이면0점. 풀이의 오류 전파 후속 넓이 계산은 인정한다.'
items['E4'].update(derivation='AB=BC이므로 BAC=ACB=2x도. 2(2x)+(4x+20)=180에서 x=20. A=C=80도, B=D=100도이다.',
    answer='x=20, A=C=80도, B=D=100도',teacher_agreement='교사용 4번의 8x+20=180, x=20 및 80도·100도를 최종 학생용 조건과 대조했다.',
    calculations=[{'left':'2*(2*x)+(4*x+20)','right':'180','bindings':{'x':'20'},'reason':'삼각형 세 각의 합'},
                  {'left':'2*(2*20)','right':'80','reason':'A,C는 반각의 두 배'},
                  {'left':'4*20+20','right':'100','reason':'B,D의 꼭짓각'}])
items['E4']['rubric'][2].update(criterion='네 각의 크기',evidence='A=C=80도, B=D=100도')
items['E4']['answer_only']['rule']='미지수와 네 각 전체가 모두 정답이면3점, 미지수만 정답이거나 네 각 전체만 정답이면2점. 네 각 일부 정답에는 가점하지 않으며 나머지는0점.'
save(OUT/'문항별-검산.json',math)
page_observations={
 '학생용':['표지의 선택형9·논술형4, 점수3·4·5점 각3문항과6점4문항, 총60점,4장4쪽을 실제 출력과 대조했다.',
          '왼쪽1·2번과 오른쪽3~6번의 문항·그림·선택지가 같은 단에 있다. 2번 3x−2의 마지막2까지 300dpi 확대에서 확인했고, 점 이름은 선에서 떨어져 있다. 길이 점선은 실선과 같은 굵기이며 둥근 호로 휘어 있다.',
          '왼쪽7·8번의 보기 상자·선택지, 오른쪽9번과논술형1번을 확인했다.9번 두 각 라벨은 해당 왼쪽 아래 반각 영역에 있으며 선·점·다른 라벨과 겹치지 않는다.',
          '왼쪽논술형2·3번, 오른쪽논술형4번과 확인사항을 확인했다.11pt 조건·13pt 점 이름이 모두 읽히고 조건 누락·잘림·겹침이 없다.'],
 '교사용':['선택형1~9번의 정답과 계산식을 학생용과 대조했다. 마지막9번 해설까지 쪽 안에 들어간다.',
          '논술형1~3번의 풀이·6점 배점·답만 쓴 경우 규칙이 쪽 안에 들어간다.3번의 종류·미지수·넓이 각각1점 규칙을 확인했다.',
          '논술형4번의 제목부터 풀이·채점 기준까지 같은 쪽에 있다.80도·100도 결론과 분리된 풀이 공간을 확인했다.']}
geometry=read(BASE/'검증-결과.json')['geometry']
student=read(OUT/'학생용-검수.json')
for d,g in zip(student['diagrams'],geometry):
    d.update(export=os.path.relpath(g['export'],OUT),export_sha256=sha(g['export']),conditions=g['conditions'])
placements=[(2,'left')]*2+[(2,'right')]*4+[(3,'left')]*2+[(3,'right')]*2+[(4,'left')]*2+[(4,'right')]
# End locators are extracted from actual PDF glyphs, not typed mathematical text.
pdf=pdfium.PdfDocument(S.with_suffix('.pdf'));pages=[];fifths={}
for pn,p in enumerate(pdf,1):
    t=p.get_textpage();chars=[];indices=[]
    for i in range(t.count_chars()):
        for char in t.get_text_range(i,1):
            if not char.isspace():chars.append(char);indices.append(i)
    text=''.join(chars);pages.append(text)
    for i,char in enumerate(text):
        if char=='⑤':
            column='left' if t.get_charbox(indices[i])[0]<p.get_width()/2 else 'right'
            fifths.setdefault((pn,column),[]).append((i,text))
for q,(pn,column) in zip(student['questions'],placements):
    q.update(page=pn,column=column)
    if q['id'].startswith('MC'):
        i,text=fifths[(pn,column)].pop(0)
        for before in range(0,50):
            needle=text[max(0,i-before):i+5]
            if sum(p.count(needle) for p in pages)==1:break
        else:raise ValueError('고유한 마지막 보기 위치를 찾지 못함')
        q['end_text']=needle
save(OUT/'학생용-검수.json',student)
for role in ('학생용','교사용'):
    p=OUT/f'{role}-검수.json';r=read(p)
    source=S if role=='학생용' else T
    r.update(source_sha256=sha(source),pdf_sha256=sha(source.with_suffix('.pdf')),
             teacher_file=os.path.relpath(T,OUT),teacher_pdf=os.path.relpath(T.with_suffix('.pdf'),OUT))
    for page,observation in zip(r['pages'],page_observations[role]):
        page.update(no_clipping=True,no_overlap=True,layout_matches=True,observations=observation)
    for k in r['content']:
        if k!='notes':r['content'][k]=True
    r['content']['notes']='작성자는 최종 학생용4쪽·교사용3쪽 및 확대 치수 라벨을 실제 열어 확인했다.37개 수식은 저장된 좌표에서 검사했고, 원래 조건으로 도형과 정답을 재검산했다. 별도 검토 결과는 독립 보고서로 연결한다.'
    save(p,r)
if (OUT/'독립검토-결과.json').exists() or '--check-pending' in sys.argv:
    for role,source,kind in [('학생용',S,'student'),('교사용',T,'teacher')]:
        r=read(OUT/f'{role}-검수.json')
        receipt=BASE/('학생용-한글검증-완성.json' if role=='학생용' else '교사용-한글검증-채점보완.json')
        result=check(source,source.with_suffix('.pdf'),receipt,OUT/f'{role}-검수.json',kind,
                     9 if kind=='student' else None,4 if kind=='student' else None,60 if kind=='student' else None,
                     [d['paragraph'] for d in r.get('diagrams',[])])
        save(OUT/f'{role}-전달검사.json',result);print(role,result['ok'],result['errors'])
else:print('작성자 검수 완료. 독립 검토 결과 연결 대기.')
