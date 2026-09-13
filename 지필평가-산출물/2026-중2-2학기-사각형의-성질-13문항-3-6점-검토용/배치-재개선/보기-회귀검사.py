"""Forward-test the real statement-box insertion, including a wrapped item."""
from pathlib import Path
from zipfile import ZipFile
from lxml import etree as E
import sys,json
BASE=Path(__file__).resolve().parent
sys.path.insert(0,r'C:\Users\pbj95\.codex\skills\pbj-exam-hwpx\scripts')
from native_author import NativeDocument
from exam_tools import prepare
NS={'hp':'http://www.hancom.co.kr/hwpml/2011/paragraph'}
prepared=BASE/'보기-회귀-준비.hwpx';output=BASE/'보기-회귀.hwpx'
if prepared.exists() or output.exists():raise FileExistsError('기존 검사 파일 보존')
prepare(BASE.parent/'가독성-개선/시험정보.json',prepared)
project=BASE.parent.parent/'2026-중2-2학기-사각형의-성질-고난도-개정본'
with NativeDocument(prepared,mathgraph_root=project) as doc:
    doc.body_start();doc.question([('text','항상 옳은 것을 모두 고른 것은?')],5)
    doc.statement_box([[('text',s)] for s in [
        '평행사변형에서 한 각이 직각이면 직사각형이다.',
        '평행사변형에서 네 변의 길이가 같으면 정사각형이다.',
        '평행사변형에서 두 대각선의 길이가 같으면 직사각형이다.',
        '마름모에서 두 대각선의 길이가 같으면 정사각형이다.']])
    doc.choices([[('text',s)] for s in ['ㄱ, ㄷ, ㄹ','ㄱ, ㄷ','ㄱ, ㄴ, ㄷ','ㄱ, ㄹ','ㄱ, ㄴ, ㄷ, ㄹ']],rows=(3,2))
    doc.question([('text','다음 문항이 온전히 이어지는지 확인하는 검사 문항이다.')],3)
    doc.save(output)
with ZipFile(output) as z:r=E.fromstring(z.read('Contents/section0.xml'))
questions=[i for i,p in enumerate(r) if p.get('styleIDRef')=='3']
tables=[(i,p.find('.//hp:tbl',NS)) for i,p in enumerate(r) if '＜보 기＞' in ''.join(p.itertext())]
assert len(questions)==2 and len(tables)==1
at,table=tables[0]
statements=[''.join(p.findall('.//hp:t',NS)[0].itertext()) for p in table.findall('.//hp:p',NS) if p.findall('.//hp:t',NS) and ''.join(p.itertext()).lstrip().startswith(tuple('ㄱㄴㄷㄹ'))]
result={'adjacent_to_question':at==questions[0]+1,'leading_one_space':all(s.startswith(' '+c+'. ') for s,c in zip(statements,'ㄱㄴㄷㄹ')),'statement_count':len(statements),'next_question_preserved':len(questions)==2,'shutdown':doc.session.shutdown}
(BASE/'보기-회귀-결과.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(result,ensure_ascii=False));assert result['adjacent_to_question'] and result['leading_one_space'] and result['statement_count']==4
