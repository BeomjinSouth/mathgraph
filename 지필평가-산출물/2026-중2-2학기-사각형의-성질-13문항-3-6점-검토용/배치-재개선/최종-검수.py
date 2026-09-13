"""Bind observed page review and preserved-user-layout evidence to final files."""
from pathlib import Path
import json,sys,os
import pypdfium2 as pdfium
BASE=Path(__file__).resolve().parent;OLD=BASE.parent/'가독성-개선';OUT=BASE/'검수-v2'
S=BASE/'학생용-배치조정-v2.hwpx';T=BASE/'교사용-배치조정-v2.hwpx'
sys.path.insert(0,r'C:\Users\pbj95\.codex\skills\pbj-exam-hwpx\scripts')
from review_scaffold import scaffold
from math_review import question_records
from native_verify import sha
from delivery_check import check
def load(p):return json.loads(Path(p).read_text(encoding='utf8'))
def save(p,v):Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf8')
metadata=load(OLD/'시험정보.json');metadata.update(pages=3,sheets=3);save(BASE/'시험정보.json',metadata)
if not OUT.exists():scaffold(S,T,S.with_suffix('.pdf'),T.with_suffix('.pdf'),BASE/'시험정보.json',OUT)
math=load(OLD/'완성-검수/문항별-검산.json');math.update(student_sha256=sha(S),teacher_sha256=sha(T))
records=question_records(S)
for item in math['items']:
    r=records[item['id']];item.update(stem_excerpt=r['text'][:30],source_scripts=r['scripts'])
    if item['id']=='MC9':
        item.update(derivation='O는 두 대각선의 교점이며 AOB=90도이다. BAO+ABO=90에서 (x+12)+(2x+6)=90, x=24. D=B=2ABO=108도이다.',
            teacher_agreement='새 교사용 9번의 직각삼각형 ABO 두 예각의 합과 D=2ABO=108도를 대조했다.',
            calculations=[{'left':'(x+12)+(2*x+6)','right':'90','bindings':{'x':'24'},'reason':'직각삼각형 ABO의 두 예각'},
                          {'left':'2*(2*x+6)','right':'108','bindings':{'x':'24'},'reason':'대각선의 각 이등분과 마주보는 각'}])
save(OUT/'문항별-검산.json',math)
observations={'학생용':[
 '표지의13문항·60점·3장3쪽이 실제와 일치하며 학교 원안지 구조가 유지된다.',
 '왼쪽1~3번과 오른쪽4~8번을 전부 보았다.3번의 D를 포함해 그림과선택지가 같은 단에 있다.7번보기는질문직후이며 기호앞공백과줄바꿈후테두리여유가있다.두 단 하단까지문항이분산되어있다.',
 '왼쪽9번·논술1·2,오른쪽논술3·4를 보았다.O는교점에있고BAO·ABO호와문구가대응한다.작은호와점이름이읽힌다.논술문항사이와마지막문항뒤의빈부분은풀이공간으로배정되어있다.확인사항과꼬리말잘림없음.'],
 '교사용':['선택형1~9번과수정한직각삼각형ABO해설이1쪽안에들어간다.수식의정체/기울임과줄바꿈을확인했다.',
 '논술1~3번의풀이·부분점수·답만쓴경우기준이잘리지않는다.앞선검토에서확정한채점기준이유지된다.',
 '논술4번제목·풀이·채점기준이같은쪽에있다.본문수식과점수문구가온전히보인다.']}
for role in ('학생용','교사용'):
    path=OUT/f'{role}-검수.json';r=load(path)
    for page,observation in zip(r['pages'],observations[role]):page.update(no_clipping=True,no_overlap=True,layout_matches=True,observations=observation)
    r['content']={k:True for k in ('solved','unique_answers','scope_checked','scores_checked','roman_italic_checked','student_teacher_agree')}
    r['content']['notes']='학생용·교사용실제PDF각3쪽을직접확인했고변경문항9번을교점O기준으로검산했다.기존문항의수학적내용은그대로이며수정본의수식원문과대조했다.사용자가조정한37개라벨의위치·크기·앵커역할보존을실제파일로검사했다.'
    if role=='학생용':
        baseline=OLD/'학생용-사각형의-성질-가독성-개선-완성-내가수정한거.hwpx'
        r['user_layout_preservation']={'source':os.path.relpath(baseline,OUT),'source_sha256':sha(baseline)}
        geos=load(OLD/'검증-결과.json')['geometry']
        for d,g in zip(r['diagrams'],geos):
            key=g['id'];export=BASE/'MathGraph'/f'{key}-작은호-v2.json' if key in ('01','09','E2','E4') else Path(g['export'])
            conditions=g['conditions']
            if key=='09':
                for c in conditions:
                    if c['kind']=='angle':c['points'][-1]='O'
                conditions.append({'kind':'angle','points':['A','O','B'],'expected':90,'reason':'대각선의 교점에서 이루는 직각'})
            d.update(export=os.path.relpath(export,OUT),export_sha256=sha(export),conditions=conditions)
        placements=load(BASE/'보존-배치-v2-검사.json')['questions']
        pdf=pdfium.PdfDocument(S.with_suffix('.pdf'));texts=[];fifths={}
        for pn,p in enumerate(pdf,1):
            t=p.get_textpage();chars=[];indices=[]
            for i in range(t.count_chars()):
                for char in t.get_text_range(i,1):
                    if not char.isspace():chars.append(char);indices.append(i)
            text=''.join(chars);texts.append(text)
            for i,c in enumerate(text):
                if c=='⑤':
                    col='left' if t.get_charbox(indices[i])[0]<p.get_width()/2 else 'right'
                    fifths.setdefault((pn,col),[]).append((i,text))
        for q,p in zip(r['questions'],placements):
            q.update(text=p['text'],page=p['expected_page'],column=p['expected_column'])
            if q['id'].startswith('MC'):
                i,text=fifths[(q['page'],q['column'])].pop(0)
                for before in range(50):
                    needle=text[max(0,i-before):i+5]
                    if sum(t.count(needle) for t in texts)==1:break
                else:raise ValueError('마지막보기고유위치없음')
                q['end_text']=needle
    save(path,r)
for role,source,kind in [('학생용',S,'student'),('교사용',T,'teacher')]:
    r=load(OUT/f'{role}-검수.json')
    result=check(source,source.with_suffix('.pdf'),BASE/f'{role}-배치조정-v2-한글검증.json',OUT/f'{role}-검수.json',kind,
                 9 if kind=='student' else None,4 if kind=='student' else None,60 if kind=='student' else None,
                 [d['paragraph'] for d in r.get('diagrams',[])])
    save(OUT/f'{role}-전달검사.json',result);print(role,result['ok'],result['errors'])
