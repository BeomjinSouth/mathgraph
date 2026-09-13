"""Preserve user's paragraphs/labels; adjust breaks, arcs and the ninth item."""
from pathlib import Path
from zipfile import ZipFile
from copy import deepcopy
import sys,json,base64,hashlib
from lxml import etree as E
BASE=Path(__file__).resolve().parent;OLD=BASE.parent/'가독성-개선'
SOURCE=OLD/'학생용-사각형의-성질-가독성-개선-완성-내가수정한거.hwpx'
VERSION=sys.argv[1] if len(sys.argv)>1 else 'v1'
SUFFIX='' if VERSION=='v1' else '-v2'
PREP=BASE/f'사용자보존-준비-{VERSION}.hwpx';TARGET=BASE/f'학생용-배치조정-{VERSION}.hwpx'
sys.path.insert(0,r'C:\Users\pbj95\.codex\skills\hwpx-skill\scripts')
from clone_form import clone
sys.path.insert(0,r'C:\Users\pbj95\.codex\skills\pbj-exam-hwpx\scripts')
from native_author import NativeDocument
from native_session import require
from diagram_writer import _diagram_label
from equations import to_hwp
HP='http://www.hancom.co.kr/hwpml/2011/paragraph';NS={'hp':HP,'hc':'http://www.hancom.co.kr/hwpml/2011/core'}
if PREP.exists() or TARGET.exists():raise FileExistsError('새 버전 경로를 사용하세요.')
clone(str(SOURCE),str(PREP),replacements={'총 (4)면':'총 (3)면','총 ( 4 )장 ( 4 )쪽':'총 ( 3 )장 ( 3 )쪽',
    'ㄱ. 평행사변형':' ㄱ. 평행사변형','ㄴ. 평행사변형':' ㄴ. 평행사변형','ㄷ. 평행사변형':' ㄷ. 평행사변형','ㄹ. 마름모':' ㄹ. 마름모'})
with ZipFile(PREP) as z:entries=[(entry,z.read(entry.filename)) for entry in z.infolist()]
section=E.fromstring(dict((e.filename,v) for e,v in entries)['Contents/section0.xml'])
original=list(section);starts=[i for i,p in enumerate(original) if p.get('styleIDRef') in ('3','4')]
assert len(starts)==13
def empty(p):
    return not ''.join(p.itertext()).strip() and not any(E.QName(x).localname in ('pic','rect','equation','tbl','ctrl','secPr') for x in p.iter())
gap=next(p for p in original[starts[0]:] if empty(p))
last=max(int(p.get('id','0')) for p in section.iter('{'+HP+'}p'))
def blanks(n):
    global last
    result=[]
    for _ in range(n):
        p=deepcopy(gap);last+=1;p.set('id',str(last));p.set('pageBreak','0');p.set('columnBreak','0');result.append(p)
    return result
tail=next(i for i,p in enumerate(original) if '※ 확인 사항' in ''.join(p.itertext()))
blocks=[]
for n,start in enumerate(starts):
    end=starts[n+1] if n+1<len(starts) else tail
    blocks.append([p for p in original[start:end] if not empty(p)])
space_lines=[1,1,0,2,2,2,2,0,1,5,7,13,11]
new=list(original[:starts[0]])
new_starts=[];diagram_paras={};names=iter(['01','02','03','09','E2','E4'])
for n,block in enumerate(blocks):
    new_starts.append(len(new))
    for p in block:p.set('pageBreak','0');p.set('columnBreak','0')
    if n in (3,11):block[0].set('columnBreak','1')
    if n==8:block[0].set('pageBreak','1')
    for p in block:
        if p.find('.//hp:pic',NS) is not None:diagram_paras[next(names)]=len(new)
        new.append(p)
    new.extend(blanks(space_lines[n]))
new.extend(original[tail:])
for p in list(section):section.remove(p)
for p in new:section.append(p)
# One leading space can wrap the longest statement; give the final merged row
# a further native 11pt/160% line, keeping the source border/column structure.
for table in section.findall('.//hp:tbl',NS):
    if '＜보 기＞' not in ''.join(table.itertext()):continue
    size=table.find('hp:sz',NS);size.set('height',str(int(size.get('height'))+1760))
    for cell in table.findall('hp:tr',NS)[-1].findall('hp:tc',NS):
        size=cell.find('hp:cellSz',NS);size.set('height',str(int(size.get('height'))+1760))
for parent in section.iter():
    for cache in list(parent.findall('hp:linesegarray',NS)):parent.remove(cache)
changes={}
for key in ('01','09','E2','E4'):
    data=json.loads((BASE/'MathGraph'/f'{key}-작은호{SUFFIX}.json').read_text(encoding='utf8'))
    pic=section[diagram_paras[key]].find('.//hp:pic',NS)
    ref=pic.find('hc:img',NS).get('binaryItemIDRef')
    binary=next(e.filename for e,_ in entries if e.filename.startswith('BinData/') and Path(e.filename).stem==ref)
    changes[binary]=base64.b64decode(data['diagram']['png'].split(',')[1])
changes['Contents/section0.xml']=E.tostring(section,encoding='UTF-8',xml_declaration=True)
with ZipFile(PREP,'w') as z:
    for info,data in entries:z.writestr(info,changes.get(info.filename,data))
# All user shape coordinates and anchors survive the prepared-document edit.
source_shapes=[E.tostring(x) for p in original[starts[0]:tail] for x in p.findall('./hp:run/hp:rect',NS)]
assert len(source_shapes)==37
project=BASE.parent.parent/'2026-중2-2학기-사각형의-성질-고난도-개정본'
with NativeDocument(PREP,mathgraph_root=project) as doc:
    h=doc.h;paragraph9=new_starts[8]
    controls=[];ctrl=h.HeadCtrl
    while ctrl is not None:
        anchor=ctrl.GetAnchorPos(0)
        pos=tuple(anchor.Item(k) for k in ('List','Para','Pos')) if anchor else None
        if ctrl.CtrlID=='eqed' and pos and pos[0]==0 and pos[1]==paragraph9:controls.append((ctrl,pos))
        ctrl=ctrl.Next
    updated=[]
    for ctrl,pos in reversed(controls):
        require(h.SetPos(*pos),'9번 수식 이동');require(h.HAction.Run('SelectCtrlFront'),'9번 수식 선택')
        param=h.HParameterSet.HEqEdit;h.HAction.GetDefault('EquationModify',param.HSet)
        old=param.string;value=old.replace('{rm BAC}','{rm BAO}').replace('{rm ABD}','{rm ABO}')
        if value!=old:
            param.string=value;require(h.HAction.Execute('EquationModify',param.HSet),'교점 기준 각 표기');updated.append(value)
        h.HAction.Run('Cancel')
    if len(updated)!=2:raise RuntimeError('9번 각 수식 두 개를 찾지 못함')
    require(h.SetPos(0,paragraph9,0),'9번 본문 이동')
    param=h.HParameterSet.HFindReplace;h.HAction.GetDefault('RepeatFind',param.HSet)
    param.FindString='에서';param.Direction=0;param.IgnoreMessage=1
    require(h.HAction.Execute('RepeatFind',param.HSet),'9번 교점 설명 삽입 위치')
    if h.GetPos()[1]!=paragraph9:raise RuntimeError('다른 문항은 수정하지 않습니다.')
    require(h.HAction.Run('Delete'),'9번 연결어 교체')
    doc.writer._text(h,'의 두 대각선의 교점을 ');doc.writer._equation(h,to_hwp(r'\mathrm{O}'),11);doc.writer._text(h,'라 하자. ')
    d=json.loads((BASE/'MathGraph'/f'09-작은호{SUFFIX}.json').read_text(encoding='utf8'))['diagram']
    label=next(x for x in d['labels'] if x['text']==r'\mathrm{O}')
    require(h.SetPos(0,diagram_paras['09'],0),'교점 이름 삽입 위치')
    _diagram_label(h,doc.writer,to_hwp(r'\mathrm{O}'),13,(doc.column_width_mm-d['widthMm'])/2+label['x']*d['widthMm'],label['y']*d['widthMm'])
    doc.save(TARGET)
report={'source':str(SOURCE),'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'target':str(TARGET),'target_sha256':hashlib.sha256(TARGET.read_bytes()).hexdigest(),
        'question_paragraphs':new_starts,'diagram_paragraphs':diagram_paras,'space_lines':space_lines,
        'user_shapes_before_native_save':len(source_shapes),'shutdown':doc.session.shutdown}
(BASE/f'배치조정-{VERSION}-기록.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(report,ensure_ascii=False))
