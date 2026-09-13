"""Change only the ninth explanation to use the named intersection O."""
from pathlib import Path
from zipfile import ZipFile
from lxml import etree as E
import sys,json,hashlib
BASE=Path(__file__).resolve().parent
SOURCE=BASE.parent/'가독성-개선/교사용-사각형의-성질-가독성-개선-채점보완.hwpx'
TARGET=BASE/'교사용-배치조정-v2.hwpx'
sys.path.insert(0,r'C:\Users\pbj95\.codex\skills\pbj-exam-hwpx\scripts')
from native_author import NativeDocument
from native_session import require
with ZipFile(SOURCE) as z:root=E.fromstring(z.read('Contents/section0.xml'))
NS={'hp':'http://www.hancom.co.kr/hwpml/2011/paragraph'}
heading=next(i for i,p in enumerate(root) if ''.join(''.join(t.itertext()) for t in p.findall('.//hp:t',NS)).replace(' ','')=='선택형9번[5점]')
before=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
project=BASE.parent.parent/'2026-중2-2학기-사각형의-성질-고난도-개정본'
with NativeDocument(SOURCE,mathgraph_root=project) as doc:
    h=doc.h;require(h.SetPos(0,heading+1,0),'9번 해설 이동')
    require(h.HAction.Run('MoveSelParaEnd'),'9번 해설 문단 선택');require(h.HAction.Run('Delete'),'9번 해설 내용 교체')
    doc.parts([('text','정답은 ⑤이다. 마름모의 두 대각선은 수직이므로 직각삼각형 '),('eq',r'\mathrm{ABO}'),
        ('text','에서 '),('eq',r'\angle\mathrm{BAO}+\angle\mathrm{ABO}=90^{\circ}'),('text','이다. 따라서 '),
        ('eq',r'(x+12)+(2x+6)=90'),('text','에서 '),('eq','x=24'),('text','이다. 대각선이 꼭짓각을 이등분하므로 '),
        ('eq',r'\angle\mathrm{D}=\angle\mathrm{B}=2\angle\mathrm{ABO}=108^{\circ}'),('text','이다.')])
    doc.save(TARGET)
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==before
print(json.dumps({'target':str(TARGET),'source_unchanged':True,'shutdown':doc.session.shutdown},ensure_ascii=False))
