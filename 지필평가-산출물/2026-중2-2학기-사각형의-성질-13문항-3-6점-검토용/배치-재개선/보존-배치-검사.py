"""Verify user edits, real angle radii and every question's printed placement."""
from pathlib import Path
from zipfile import ZipFile
from lxml import etree as E
import json,sys,hashlib,re
import pypdfium2 as pdfium
BASE=Path(__file__).resolve().parent;version=sys.argv[1] if len(sys.argv)>1 else 'v2'
SOURCE=BASE.parent/'가독성-개선/학생용-사각형의-성질-가독성-개선-완성-내가수정한거.hwpx'
TARGET=BASE/f'학생용-배치조정-{version}.hwpx'
NS={'hp':'http://www.hancom.co.kr/hwpml/2011/paragraph','hc':'http://www.hancom.co.kr/hwpml/2011/core'}
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def inspect(path):
    with ZipFile(path) as z:
        root=E.fromstring(z.read('Contents/section0.xml'));binaries={Path(n).stem:z.read(n) for n in z.namelist() if n.startswith('BinData/')}
    current=None;counts={'MC':0,'E':0};items={}
    for index,p in enumerate(root):
        if p.get('styleIDRef') in ('3','4'):
            prefix='MC' if p.get('styleIDRef')=='3' else 'E';counts[prefix]+=1;current=prefix+str(counts[prefix]);items[current]={'paragraph':index,'labels':{},'pictures':[],'scripts':[]}
        if current is None:continue
        item=items[current];item['scripts'] += [s.text for s in p.findall('.//hp:script',NS)]
        for box in p.findall('./hp:run/hp:rect',NS):
            eq=box.find('.//hp:equation',NS)
            if eq is None:continue
            key=eq.findtext('hp:script','',NS)
            item['labels'][key]={'pos':dict(box.find('hp:pos',NS).attrib),'size':dict(box.find('hp:sz',NS).attrib),
                'equation_size':dict(eq.find('hp:sz',NS).attrib),'baseUnit':eq.get('baseUnit'),
                'anchor_role':'question' if index==item['paragraph'] else 'diagram'}
        for pic in p.findall('./hp:run/hp:pic',NS):
            ref=pic.find('hc:img',NS).get('binaryItemIDRef')
            item['pictures'].append({'size':dict(pic.find('hp:sz',NS).attrib),'binary_sha256':hashlib.sha256(binaries[ref]).hexdigest()})
    return root,items
oldroot,old=inspect(SOURCE);root,new=inspect(TARGET);errors=[];preserved=[]
for id,item in old.items():
    for script,label in item['labels'].items():
        got=new[id]['labels'].get(script)
        if got!=label:errors.append('USER_LABEL_CHANGED: '+id+' '+script)
        else:preserved.append(id+' '+script)
    if item['pictures'] and item['pictures'][0]['size']!=new[id]['pictures'][0]['size']:errors.append('USER_PICTURE_SIZE_CHANGED: '+id)
for id in ('MC2','MC3'):
    if old[id]['pictures']!=new[id]['pictures']:errors.append('UNCHANGED_GEOMETRY_CHANGED: '+id)
if '{rm O} it' not in new['MC9']['labels']:errors.append('INTERSECTION_O_MISSING')
for s in ('ANGLE {rm BAO}','ANGLE {rm ABO}'):
    if not any(s in t for t in new['MC9']['scripts']):errors.append('ANGLE_NAME_MISSING: '+s)
arcs=[]
for key,id in [('01','MC1'),('09','MC9'),('E2','E2'),('E4','E4')]:
    exp=json.loads((BASE/'MathGraph'/f'{key}-작은호-v2.json').read_text(encoding='utf8'))
    width=int(new[id]['pictures'][0]['size']['width'])*25.4/7200
    for arc in exp['printProfile']['angleArcs']:
        actual=arc['radius']*exp['captureFrame']['scale']/exp['captureFrame']['crop']['width']*width
        arcs.append({'id':id,'radius_mm':actual})
        if abs(actual-3)>0.02:errors.append('ARC_PRINT_RADIUS: '+id)
table_index=next(i for i,p in enumerate(root) if '＜보 기＞' in ''.join(p.itertext()))
if table_index!=new['MC7']['paragraph']+1:errors.append('EMPTY_PARAGRAPH_BEFORE_STATEMENTS')
statements=[''.join(p.itertext()) for p in root[table_index].findall('.//hp:p',NS) if ''.join(p.itertext()).lstrip().startswith(tuple('ㄱㄴㄷㄹ'))]
if len(statements)!=4 or any(not s.startswith(' '+c+'. ') for s,c in zip(statements,'ㄱㄴㄷㄹ')):errors.append('STATEMENT_PREFIX_SPACE')
expected=[(2,'left')]*3+[(2,'right')]*5+[(3,'left')]*3+[(3,'right')]*2
pdf=pdfium.PdfDocument(TARGET.with_suffix('.pdf'));texts=[];locators=[]
for n,p in enumerate(pdf,1):
    t=p.get_textpage();chars=[];indices=[]
    for i in range(t.count_chars()):
        for c in t.get_text_range(i,1):
            if not c.isspace():chars.append(c);indices.append(i)
    texts.append((''.join(chars),indices,t,p.get_width(),p.get_height()))
def hits(needle):
    out=[]
    for pn,(text,indices,t,width,height) in enumerate(texts,1):
        start=text.find(needle)
        while start>=0:
            x,bot,right,top=t.get_charbox(indices[start]);out.append({'page':pn,'column':'left' if x<width/2 else 'right','y_mm':(height-top)*25.4/72})
            start=text.find(needle,start+1)
    return out
for (id,item),(pn,col) in zip(new.items(),expected):
    needle=id[2:]+'.' if id.startswith('MC') else '【논술형'+id[1:]+'】';found=hits(needle)
    if len(found)!=1 or (found[0]['page'],found[0]['column'])!=(pn,col):errors.append('QUESTION_PLACEMENT: '+id)
    locators.append({'id':id,'text':needle,'expected_page':pn,'expected_column':col,'actual':found})
if len(pdf)!=3:errors.append('PAGE_COUNT: '+str(len(pdf)))
result={'ok':not errors,'errors':errors,'source_sha256':sha(SOURCE),'target_sha256':sha(TARGET),'pdf_sha256':sha(TARGET.with_suffix('.pdf')),
        'user_labels_preserved':len(preserved),'angle_arcs':arcs,'statement_prefixes':statements,'questions':locators,
        'limitations':'라벨 원좌표 보존과 배치·호 크기를 확인한다. 실제 글자/선 겹침, 문항 끝·풀이 공간은 최종 PDF 직접 검토와 별도 전달 검사로 확인해야 한다.'}
(BASE/f'보존-배치-{version}-검사.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({k:v for k,v in result.items() if k not in ('questions','statement_prefixes')},ensure_ascii=False))
