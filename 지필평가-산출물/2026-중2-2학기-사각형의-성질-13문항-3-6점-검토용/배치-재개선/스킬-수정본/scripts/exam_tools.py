"""Read-only exam inspection/audit and non-overwriting template preparation."""
import argparse,collections,copy,hashlib,json,re,sys
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED,ZIP_STORED
from lxml import etree as E

ROOT=Path(__file__).resolve().parents[1]
HP='http://www.hancom.co.kr/hwpml/2011/paragraph'
HH='http://www.hancom.co.kr/hwpml/2011/head'
NS={'hp':HP,'hh':HH}
STYLE_MC='선택형문항(번호자동부여)'
STYLE_ESSAY='논술형문항(번호자동부여)'
STYLE_STATEMENT='<보기>, 다음 상자 안 문장'
CHOICES=['1행 선택지','2행 선택지','3행 선택지','5행 선택지']

def read(path):
 with ZipFile(path) as z:
  parts={n:z.read(n) for n in z.namelist() if n.startswith('Contents/section') and n.endswith('.xml')}
  return E.fromstring(z.read('Contents/header.xml')),[(n,E.fromstring(s)) for n,s in sorted(parts.items())]
def styles(h):
 return {s.get('name'):s for s in h.findall('.//hh:style',NS)}
def plain(p):return ''.join(p.xpath('.//hp:t/text()',namespaces=NS))
def own_plain(p):return ''.join(p.xpath('./hp:run/hp:t/text()',namespaces=NS))
def table_shape(t):
 result={'rows':t.get('rowCnt'),'columns':t.get('colCnt')}
 for name in ['sz','inMargin','outMargin']:
  v=t.find('hp:'+name,NS);result[name]=dict(v.attrib) if v is not None else None
 result['cells']=[{'addr':dict(c.find('hp:cellAddr',NS).attrib),'span':dict(c.find('hp:cellSpan',NS).attrib),'size':dict(c.find('hp:cellSz',NS).attrib),'hasMargin':c.get('hasMargin'),'margin':dict(c.find('hp:cellMargin',NS).attrib)} for c in t.findall('./hp:tr/hp:tc',NS)]
 return result
def template_text_errors(sections,metadata=None):
 """Compare each retained cell with the blank template, allowing only its tokens."""
 _,blank=read(ROOT/'assets/blank-exam.hwpx')
 actual={t.get('id'):t for _,r in sections for t in r.findall('.//hp:tbl',NS)}
 errors=[]
 for _,r in blank:
  for t in r.findall('.//hp:tbl',NS):
   target=actual.get(t.get('id'))
   if target is None:continue
   cells=target.findall('./hp:tr/hp:tc',NS)
   for i,c in enumerate(t.findall('./hp:tr/hp:tc',NS)):
    if i>=len(cells):continue
    source=plain(c)
    if metadata is not None:
     for token,replacement in metadata_values(metadata).items():source=source.replace(token,replacement)
    source=re.sub(r'\s+','',source);value=re.sub(r'\s+','',plain(cells[i]))
    fragments=re.split(r'(\{\{[A-Z_]+\}\})',source);pattern=''
    for fragment in fragments:
     if re.fullmatch(r'\{\{[A-Z_]+\}\}',fragment):
      token=fragment[2:-2]
      if token in ('MONTH','DAY','PERIOD'):pattern+=r'\d{0,3}'
      elif token in ('YEAR','SEMESTER','ROUND','GRADE','PAGES','SHEETS','MC_COUNT','ESSAY_COUNT','TOTAL'):pattern+=r'\d+(?:\.\d+)?'
      elif token in ('MC_POINTS','ESSAY_POINTS'):pattern+=r'[0-9점×문항=.,]{1,150}'
      else:pattern+=r'.{1,150}?'
     else:pattern+=re.escape(fragment)
    if not re.fullmatch(pattern,value):errors.append(f'SOURCE_TABLE_TEXT_CHANGED: {t.get("id")} cell={i}')
 return errors
def choice_layout_errors(groups):
 errors=[]
 for q,rows in enumerate(groups,1):
  names={name for name,count,lines in rows};rows=[row for row in rows if row[1]]
  if not rows:continue
  if len(names)!=1:errors.append(f'CHOICE_MIXED_LAYOUT: MC{q}');continue
  name=next(iter(names));expected=int(name[0]);counts=[row[1] for row in rows]
  if len(rows)!=expected or sum(counts)!=5 or (expected==5 and counts!=[1]*5):errors.append(f'CHOICE_ROW_STRUCTURE: MC{q}')
  if any(count>1 and lines>1 for _,count,lines in rows):errors.append(f'CHOICE_ROW_OVERFLOW: MC{q}')
 return errors
def blank_paragraph(p):
 return not plain(p).strip() and not p.xpath('.//hp:tbl|.//hp:pic|.//hp:equation|.//hp:rect|.//hp:container',namespaces=NS)
def diagram_format_errors(h,p,at):
 errors=[];pictures=p.findall('.//hp:pic',NS)
 if len(pictures)!=1:return ['DIAGRAM_PICTURE_COUNT: '+at]
 picture=pictures[0];pos=picture.find('hp:pos',NS)
 if pos is None or pos.get('treatAsChar')!='1' or pos.get('flowWithText')!='1':errors.append('DIAGRAM_NOT_INLINE: '+at)
 para=h.find('.//hh:paraPr[@id="'+p.get('paraPrIDRef')+'"]',NS);align=para.find('hh:align',NS) if para is not None else None
 if align is None or align.get('horizontal')!='CENTER':errors.append('DIAGRAM_PARAGRAPH_NOT_CENTERED: '+at)
 for box in p.findall('.//hp:rect',NS):
  boxpos=box.find('hp:pos',NS)
  if boxpos is None or boxpos.get('treatAsChar')!='0' or boxpos.get('flowWithText')!='1':errors.append('DIAGRAM_LABEL_NOT_FLOWING: '+at)
  equation=box.find('.//hp:equation',NS);script=equation.findtext('hp:script','',NS) if equation is not None else ''
  if re.fullmatch(r'\s*\{?\s*rm\s+[A-Z]\s*\}?\s*(?:it)?\s*',script) and equation.get('baseUnit')!='1300':errors.append('DIAGRAM_POINT_LABEL_SIZE: '+script)
 return errors
def describe(path):
 h,sections=read(path)
 return {'sha256':hashlib.sha256(Path(path).read_bytes()).hexdigest(),'pages_xml':[dict(p.attrib) for _,r in sections for p in r.findall('.//hp:pagePr',NS)],'columns':[dict(c.attrib) for _,r in sections for c in r.findall('.//hp:colPr',NS)],'styles':{n:dict(s.attrib) for n,s in styles(h).items()},'tables':[{'id':t.get('id'),**table_shape(t)} for _,r in sections for t in r.findall('.//hp:tbl',NS)]}
def write_package(source,dest,replacements):
 dest=Path(dest)
 if dest.exists():raise ValueError('출력 파일이 이미 있습니다. 새 이름을 사용하세요.')
 if ROOT==dest.resolve() or ROOT in dest.resolve().parents:raise ValueError('스킬과 원본 폴더에는 결과를 저장하지 않습니다.')
 dest.parent.mkdir(parents=True,exist_ok=True)
 with ZipFile(source) as src,ZipFile(dest,'w',ZIP_DEFLATED) as dst:
  for i in src.infolist():
   data=src.read(i.filename)
   if i.filename.endswith('.xml') and i.filename.startswith('Contents/'):
    text=data.decode('utf-8')
    for old,new in replacements.items():text=text.replace(old,new)
    E.fromstring(text.encode('utf-8'))
    data=text.encode('utf-8')
   if i.filename.startswith('Preview/'):
    # Never ship the original questions/answers as a stale preview of a new exam.
    data=b''
   dst.writestr(i,data,compress_type=ZIP_STORED if i.filename=='mimetype' else ZIP_DEFLATED)
def metadata_values(m):
 for k in ['year','semester','round','grade','pages']:
  if not isinstance(m.get(k),int) or isinstance(m.get(k),bool) or m[k]<1:raise ValueError(k+'는 양의 정수여야 합니다.')
 if m['semester'] not in [1,2]:raise ValueError('학기는 1 또는 2입니다.')
 for k in ['mc_points','essay_points']:
  if not isinstance(m.get(k),list) or any(isinstance(p,bool) or not isinstance(p,(int,float)) or p<=0 for p in m[k]):raise ValueError(k+'에는 각 문항의 양수 배점을 넣습니다.')
 if not m['mc_points'] and not m['essay_points']:raise ValueError('문항이 없습니다.')
 def split_points(values):return ', '.join(f'{p:g}점×{n}문항={p*n:g}점' for p,n in sorted(collections.Counter(values).items())) or '0문항'
 title=m.get('exam_title',f"{m['year']}학년도 {m['semester']}학기 {m['round']}차 지필 평가")
 if not isinstance(title,str) or not title.strip():raise ValueError('시험 제목을 확인하세요.')
 vals={'YEAR':m['year'],'SEMESTER':m['semester'],'ROUND':m['round'],'GRADE':m['grade'],'PAGES':m['pages'],'SHEETS':m.get('sheets',m['pages']),'EXAM_TITLE':title,'FOOTER_KIND':m.get('footer_kind','지필평가'),'MONTH':m.get('month',''),'DAY':m.get('day',''),'PERIOD':m.get('period',''),'MC_COUNT':len(m['mc_points']),'ESSAY_COUNT':len(m['essay_points']),'MC_POINTS':split_points(m['mc_points']),'ESSAY_POINTS':split_points(m['essay_points']),'TOTAL':f"{sum(m['mc_points'])+sum(m['essay_points']):g}"}
 for k,v in vals.items():
  if any(c in str(v) for c in '<>&{}'):raise ValueError(k+'에 템플릿/XML 기호가 있습니다.')
 return {'{{'+k+'}}':str(v) for k,v in vals.items()}
def prepare(metadata,output):
 m=json.loads(Path(metadata).read_text(encoding='utf-8-sig'))
 vals=metadata_values(m)
 write_package(ROOT/'assets/blank-exam.hwpx',output,vals)
 return {'status':'PREPARED_NOT_FINAL','file':str(Path(output).resolve()),'mc':len(m['mc_points']),'essay':len(m['essay_points']),'total':sum(m['mc_points'])+sum(m['essay_points']),'next':'BODY 문단을 원본 스타일의 본문·수식으로 교체하고 실제 한글 렌더 후 audit를 실행하세요.'}

def audit(path,mc=None,essay=None,points=None,diagram_paragraphs=(),metadata=None,diagram_label_anchors=()):
 errors=[];warnings=[]
 h,sections=read(path);oh,orig_sections=read(ROOT/'assets/original-exam.hwpx')
 by_name=styles(h);original_names=styles(oh)
 for name in [STYLE_MC,STYLE_ESSAY,*CHOICES]:
  if name not in by_name:errors.append('STYLE_MISSING: '+name)
  elif name in CHOICES:
   p=h.find('.//hh:paraPr[@id="'+by_name[name].get('paraPrIDRef')+'"]',NS)
   if any(x.get('type')!='PERCENT' or x.get('value')!='160' for x in p.findall('.//hh:lineSpacing',NS)):errors.append('CHOICE_LINE_SPACING: '+name)
   oldp=oh.find('.//hh:paraPr[@id="'+original_names[name].get('paraPrIDRef')+'"]',NS)
   tab=h.find('.//hh:tabPr[@id="'+p.get('tabPrIDRef')+'"]',NS)
   oldtab=oh.find('.//hh:tabPr[@id="'+oldp.get('tabPrIDRef')+'"]',NS)
   def tab_items(el):return [dict(x.attrib) for x in el] if el is not None else None
   if tab_items(tab)!=tab_items(oldtab):errors.append('CHOICE_TAB_CHANGED: '+name)
 base_page=orig_sections[0][1].find('.//hp:pagePr',NS)
 for _,r in sections:
  for p in r.findall('.//hp:pagePr',NS):
   if dict(p.attrib)!=dict(base_page.attrib) or dict(p.find('hp:margin',NS).attrib)!=dict(base_page.find('hp:margin',NS).attrib):errors.append('PAGE_LAYOUT_CHANGED')
  twocol=[c for c in r.findall('.//hp:colPr',NS) if c.get('colCount')=='2']
  if not twocol:errors.append('TWO_COLUMNS_MISSING')
  for c in twocol:
   if c.get('sameGap')!='1420':errors.append('COLUMN_GAP_CHANGED')
 base_tables={t.get('id'):table_shape(t) for _,r in orig_sections for t in r.findall('.//hp:tbl',NS)}
 tables={t.get('id'):table_shape(t) for _,r in sections for t in r.findall('.//hp:tbl',NS)}
 for id,shape in base_tables.items():
  if id not in tables:errors.append('SOURCE_TABLE_MISSING: '+id)
  elif shape!=tables[id]:errors.append('SOURCE_TABLE_LAYOUT_CHANGED: '+id)
 errors.extend(template_text_errors(sections,metadata))
 name_by_id={s.get('id'):n for n,s in by_name.items()}
 counts=collections.Counter();score=0;eq_count=0;choice_counts=[];active_choices=None;choice_groups=[];choice_rows=None;last_choice_end=None
 statement_boxes=[]
 for section_name,r in sections:
  for index,t in enumerate(r.findall('.//hp:tbl',NS)):
   label=re.sub(r'\s+','',''.join(t.xpath('.//hp:t/text()',namespaces=NS)))
   if '＜보기＞' not in label:continue
   statement_boxes.append((section_name,index,t))
   pos=t.find('hp:pos',NS)
   if t.get('rowCnt')!='4' or t.get('colCnt')!='3' or pos is None or pos.get('treatAsChar')!='1':errors.append('STATEMENT_BOX_LAYOUT')
   bottom=[c for c in t.findall('./hp:tr/hp:tc',NS) if c.find('hp:cellAddr',NS).get('rowAddr')=='3']
   if len(bottom)!=1 or any(name_by_id.get(p.get('styleIDRef'))!=STYLE_STATEMENT for p in bottom[0].findall('.//hp:p',NS)):errors.append('STATEMENT_BOX_STYLE')
 body_header_id=list(base_tables)[6]
 for section_name,r in sections:
  body=False
  for index,p in enumerate(r):
   if any(t.get('id')==body_header_id for t in p.findall('.//hp:tbl',NS)):
    body=True;continue
   if not body:continue
   kind=name_by_id.get(p.get('styleIDRef'),'')
   if '{{' in plain(p):errors.append('UNFILLED_TOKEN')
   s=own_plain(p)
   if re.match(r'^\s*(\d+\.|【(?:논술형|서술형)\s*\d+】)',s):errors.append('MANUAL_QUESTION_NUMBER: '+s[:25])
   if kind in [STYLE_MC,STYLE_ESSAY]:
    if counts[STYLE_MC]+counts[STYLE_ESSAY] and last_choice_end is not None:
     between=list(r)[last_choice_end+1:index]
     separated=any(x.get('pageBreak')=='1' or x.get('columnBreak')=='1' for x in [*between,p]) or any(blank_paragraph(x) for x in between)
     if not separated:errors.append('QUESTION_GAP_MISSING')
    last_choice_end=None
    effective=h.find('.//hh:paraPr[@id="'+p.get('paraPrIDRef')+'"]',NS)
    heading=effective.find('hh:heading',NS) if effective is not None else None
    expected_mode='OUTLINE' if kind==STYLE_MC else 'NUMBER'
    if heading is None or heading.get('type')!=expected_mode:errors.append('AUTO_NUMBER_MODE: '+kind)
    if active_choices is not None:choice_counts.append(active_choices)
    if choice_rows is not None:choice_groups.append(choice_rows)
    active_choices='' if kind==STYLE_MC else None
    choice_rows=[] if kind==STYLE_MC else None
    counts[kind]+=1
    match=re.search(r'\[\s*(\d+(?:\.\d+)?)\s*점\s*\]',s)
    if not match:errors.append('POINTS_MISSING: '+s[:25])
    else:score+=float(match[1])
   if kind in CHOICES and active_choices is not None:
    marks=''.join(c for c in s if c in '①②③④⑤');active_choices+=marks
    if marks:choice_rows.append((kind,len(marks),len(p.findall('./hp:linesegarray/hp:lineseg',NS))));last_choice_end=index
   if len(re.findall(r'[ㄱ-ㅎ]\.',s))>=2:errors.append('STATEMENTS_OUTSIDE_BOX: '+s[:35])
   if re.search(r'_{5,}',s):errors.append('ANSWER_RULE_AS_TEXT')
   if kind in [STYLE_MC,STYLE_ESSAY,*CHOICES]:
    stripped=re.sub(r'\[[^\]]*점\]','',s)
    if re.search(r'[A-Za-z0-9]',stripped):errors.append('PLAIN_MATH_TEXT: '+stripped[:35])
   is_diagram=f'{section_name}:{index}' in diagram_paragraphs
   if is_diagram:errors.extend(diagram_format_errors(h,p,f'{section_name}:{index}'))
   for eq in p.findall('.//hp:equation',NS):
    eq_count+=1;pos=eq.find('hp:pos',NS);script=eq.findtext('hp:script','',NS)
    boxed=any(E.QName(a).localname in ['rect','container','pic'] for a in eq.iterancestors())
    preserved_label=boxed and (f'{section_name}:{index}',script) in diagram_label_anchors and re.fullmatch(r'\{rm [A-Z][A-Za-z0-9]*\} it',script) is not None
    if preserved_label and (pos is None or pos.get('treatAsChar')!='1' or eq.get('baseUnit')!='1300'):errors.append('PRESERVED_POINT_LABEL_STYLE: '+script)
    if not is_diagram and not preserved_label and (boxed or pos is None or pos.get('treatAsChar')!='1'):errors.append('BODY_EQUATION_NOT_INLINE: '+script)
    if re.search(r'[가-힣]{3,}',script):errors.append('KOREAN_SENTENCE_IN_EQUATION: '+script)
    if re.search(r'[~`]\s*\{?\s*rm\s+cm',script):errors.append('CM_EXPLICIT_SPACING: '+script)
    if re.search(r'\bPARALLEL\b|∥',script):errors.append('WRONG_PARALLEL_GLYPH: '+script)
    if re.search(r'[~`]\s*\U000f005a|\U000f005a\s*[~`]',script):errors.append('PARALLEL_EXPLICIT_SPACING: '+script)
    if re.search(r'ANGLE[^=]*=\s*[^,()]*[a-z]\s*[+-]\s*\d+\s*\^\{\s*circ\s*\}',script):errors.append('ANGLE_DEGREE_SCOPE: '+script)
    if not s.strip() and not boxed and re.fullmatch(r'[\s{},rm itA-Z]+',script) and script.count(',')>=2:errors.append('DIAGRAM_LABELS_AS_LIST: '+script)
   if not is_diagram and p.findall('.//hp:pic',NS):errors.append('UNDECLARED_DIAGRAM: '+f'{section_name}:{index}')
  if active_choices is not None:choice_counts.append(active_choices);active_choices=None
  if choice_rows is not None:choice_groups.append(choice_rows);choice_rows=None
  if '{{' in plain(r):errors.append('UNFILLED_TOKEN')
  if r.xpath('.//hp:fieldBegin[@type="MEMO"]',namespaces=NS):errors.append('MEMO_REMAINS')
  if r.findall('.//hp:markpenBegin',NS):errors.append('HIGHLIGHT_REMAINS')
 for c in choice_counts:
  if c!='①②③④⑤':errors.append('CHOICES_INCOMPLETE_OR_DUPLICATED: '+c)
 errors.extend(choice_layout_errors(choice_groups))
 for name,want in [(STYLE_MC,mc),(STYLE_ESSAY,essay)]:
  if want is not None and counts[name]!=want:errors.append('QUESTION_COUNT: '+name+f' expected={want} actual={counts[name]}')
 if points is not None and abs(score-points)>1e-8:errors.append(f'POINT_TOTAL: expected={points} actual={score}')
 return {'ok':not errors,'status':'STRUCTURE_ONLY','delivery_ready':False,'errors':sorted(set(errors)),'warnings':warnings,'mc':counts[STYLE_MC],'essay':counts[STYLE_ESSAY],'points':score,'equations':eq_count,'statement_boxes':len(statement_boxes),'limitation':'구조 검사만 수행했습니다. 수학적 정답·실제 렌더·한글 편집 검증은 별도입니다.'}
def main():
 p=argparse.ArgumentParser();sub=p.add_subparsers(dest='cmd',required=True)
 v=sub.add_parser('inspect');v.add_argument('file')
 v=sub.add_parser('prepare');v.add_argument('--metadata',required=True);v.add_argument('--output',required=True)
 v=sub.add_parser('audit');v.add_argument('file');v.add_argument('--mc',type=int);v.add_argument('--essay',type=int);v.add_argument('--points',type=float);v.add_argument('--diagram-paragraph',action='append',default=[])
 a=p.parse_args()
 try:
  result=describe(a.file) if a.cmd=='inspect' else prepare(a.metadata,a.output) if a.cmd=='prepare' else audit(a.file,a.mc,a.essay,a.points,a.diagram_paragraph)
  print(json.dumps(result,ensure_ascii=False,indent=2));return 0 if result.get('ok',True) else 2
 except (ValueError,OSError,E.XMLSyntaxError) as exc:
  print(json.dumps({'ok':False,'error':str(exc)},ensure_ascii=False));return 2
if __name__=='__main__':raise SystemExit(main())
