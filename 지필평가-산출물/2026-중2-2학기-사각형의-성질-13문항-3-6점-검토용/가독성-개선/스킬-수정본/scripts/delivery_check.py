"""Require hash-bound native and human evidence; structural PASS is insufficient."""
from pathlib import Path
import argparse,json,re
from native_verify import equations,sha
from exam_tools import audit,read,NS
from equations import to_hwp
from math_review import review as review_math,question_records
from geometry_review import review as review_geometry
def linked(base,name):
 if not isinstance(name,str) or not name:raise ValueError('연결된 검증 파일 경로가 필요합니다.')
 return (Path(base).parent/name).resolve()

def signed_offset(value):
 # Hancom writes negative paragraph-relative positions as unsigned DWORDs.
 offset=int(value)
 if not -(2**31)<=offset<2**32:raise ValueError('HWPX 위치값이 32비트 범위를 벗어났습니다.')
 return offset-2**32 if offset>=2**31 else offset

def hash_matches(recorded,actual):
 return isinstance(recorded,str) and re.fullmatch(r'[0-9a-fA-F]{64}',recorded) is not None and recorded.lower()==actual.lower()
def point_label_name(value):
 match=re.fullmatch(r'\\mathrm\{([A-Za-z][A-Za-z0-9]*)\}',value or '')
 return match.group(1) if match else value
def diagram_checks(source,review_path,review):
 errors=[];header,sections=read(source)
 actual={f'{name}:{i}':p for name,r in sections for i,p in enumerate(r) if p.findall('.//hp:pic',NS)}
 declared=review.get('diagrams',[])
 if sorted(d.get('paragraph','') for d in declared)!=sorted(actual):return ['DIAGRAM_EVIDENCE_COVERAGE']
 for item in declared:
  at=item['paragraph'];p=actual[at];export_path=linked(review_path,item.get('export'))
  if item.get('export_sha256')!=sha(export_path):errors.append('DIAGRAM_EXPORT_HASH: '+at)
  export=json.loads(export_path.read_text(encoding='utf8'));diagram=export.get('diagram',export)
  errors.extend(error+': '+at for error in review_geometry(export,item.get('conditions')))
  picture=p.find('.//hp:pic',NS);size=picture.find('hp:sz',NS);position=picture.find('hp:pos',NS);width=diagram['widthMm']*7200/25.4;height=width*diagram['aspect']
  if abs(int(size.get('width'))-width)>2 or abs(int(size.get('height'))-height)>2:errors.append('DIAGRAM_ASPECT_OR_SIZE: '+at)
  if position is None or position.get('treatAsChar')!='1' or position.get('flowWithText')!='1':errors.append('DIAGRAM_NOT_INLINE: '+at)
  para=header.find('.//hh:paraPr[@id="'+p.get('paraPrIDRef')+'"]',NS);align=para.find('hh:align',NS) if para is not None else None
  if align is None or align.get('horizontal')!='CENTER':errors.append('DIAGRAM_PARAGRAPH_NOT_CENTERED: '+at)
  line=p.find('./hp:linesegarray/hp:lineseg',NS)
  if line is None:errors.append('DIAGRAM_LINE_LAYOUT_MISSING: '+at);picture_left=0
  else:picture_left=max(0,(int(line.get('horzsize'))-width)/2)
  labels=diagram.get('labels',[]);boxes=p.findall('.//hp:rect',NS)
  if len(labels)!=len(boxes):errors.append('DIAGRAM_LABEL_COUNT: '+at);continue
  point_names={o.get('label') for o in export.get('project',[]) if o.get('type') in ('point','intersection','midpoint','pointOnLine','pointOnCircle','circleCenterPoint') and o.get('showLabel') is not False and o.get('label')}
  remaining=list(boxes)
  for label in labels:
   script=to_hwp(label['text']);matches=[box for box in remaining if box.findtext('.//hp:script','',NS)==script]
   if len(matches)!=1:errors.append('DIAGRAM_LABEL_SCRIPT: '+at);continue
   box=matches[0];remaining.remove(box);pos=box.find('hp:pos',NS);bs=box.find('hp:sz',NS);equation=box.find('.//hp:equation',NS);es=equation.find('hp:sz',NS)
   if pos is None or pos.get('treatAsChar')!='0' or pos.get('flowWithText')!='1':errors.append('DIAGRAM_LABEL_NOT_FLOWING: '+at);continue
   x=signed_offset(pos.get('horzOffset'))+max(0,(int(bs.get('width'))-int(es.get('width')))//2)
   y=signed_offset(pos.get('vertOffset'))+max(0,(int(bs.get('height'))-int(es.get('height')))//2)
   # Coordinates may be locally reflowed after measuring real Hancom equations.
   # Validate final boxes against geometry, not against obsolete canvas positions.
   if point_label_name(label.get('text')) in point_names and equation.get('baseUnit')!='1300':errors.append('DIAGRAM_POINT_LABEL_SIZE: '+at)
 from verify_native_labels import check as check_native_labels
 if declared:
  try:errors.extend(check_native_labels(source,[linked(review_path,item.get('export')) for item in declared])['errors'])
  except (OSError,ValueError,KeyError,TypeError) as error:errors.append('NATIVE_LABEL_LAYOUT: '+str(error))
 return errors

def independent_checks(source,pdf,review_path,r):
 import pypdfium2 as pdfium
 errors=[];paths={key:linked(review_path,r.get(key)) for key in ('student_file','teacher_file','student_pdf','teacher_pdf','math_review','independent_review')}
 m=review_math(paths['student_file'],paths['teacher_file'],paths['math_review']);errors.extend(m['errors'])
 independent=json.loads(paths['independent_review'].read_text(encoding='utf8'))
 if independent.get('schema')!=2:errors.append('INDEPENDENT_SCHEMA')
 if not independent.get('reviewer_task') or not independent.get('author_task') or independent['reviewer_task']==independent['author_task']:errors.append('INDEPENDENT_REVIEWER_REQUIRED')
 if independent.get('status')!='PASS' or independent.get('blocking_findings')!=[]:errors.append('INDEPENDENT_FINDINGS_OPEN')
 for key in ('student_file','teacher_file','student_pdf','teacher_pdf'):
  hash_key=key.replace('_file','')+'_sha256'
  if not hash_matches(independent.get(hash_key),sha(paths[key])):errors.append('INDEPENDENT_HASH: '+key)
 for role in ('student','teacher'):
  with pdfium.PdfDocument(paths[role+'_pdf']) as d:count=len(d)
  if independent.get(role+'_pages_reviewed')!=list(range(1,count+1)):errors.append('INDEPENDENT_PAGES: '+role)
 items=independent.get('items',[])
 if sorted(item.get('id','') for item in items)!=sorted(question_records(paths['student_file'])):errors.append('INDEPENDENT_ITEM_COVERAGE')
 if any(item.get('verdict')!='PASS' or not item.get('reason') for item in items):errors.append('INDEPENDENT_ITEM_UNRESOLVED')
 if not independent.get('visual_findings') or not independent.get('limitations'):errors.append('INDEPENDENT_REPORT_INCOMPLETE')
 matching=[role for role in ('student','teacher') if sha(source)==sha(paths[role+'_file'])]
 if len(matching)!=1:errors.append('PACKAGE_SOURCE_MISMATCH')
 elif sha(pdf)!=sha(paths[matching[0]+'_pdf']):errors.append('PACKAGE_PDF_MISMATCH')
 return errors,m
def check(source,pdf,native,review,role='student',mc=None,essay=None,points=None,diagrams=()):
 import pypdfium2 as pdfium
 errors=[];source,pdf=Path(source),Path(pdf)
 n=json.loads(Path(native).read_text(encoding='utf8'));r=json.loads(Path(review).read_text(encoding='utf8'))
 if r.get('schema')!=2:errors.append('REVIEW_SCHEMA_2_REQUIRED')
 if n.get('schema')!=2 or n.get('shutdown',{}).get('ok') is not True:errors.append('NATIVE_SHUTDOWN_UNVERIFIED')
 for report,label in [(n,'NATIVE'),(r,'REVIEW')]:
  if report.get('source_sha256')!=sha(source):errors.append(label+'_SOURCE_HASH')
  if report.get('pdf_sha256')!=sha(pdf):errors.append(label+'_PDF_HASH')
 if not n.get('ok') or n.get('errors'):errors.append('NATIVE_FAILED')
 if n.get('engine')!='Hancom HWPFrame.HwpObject SaveAs PDF':errors.append('NATIVE_ENGINE')
 if n.get('equation_edit') is not True or n.get('inline_flow') is not True:errors.append('EDIT_OR_FLOW_UNVERIFIED')
 expected=equations(source);measured=n.get('equations',[])
 if len(expected)!=len(measured):errors.append('MEASUREMENT_COUNT')
 for i,(e,m) in enumerate(zip(expected,measured)):
  if any(m.get(k)!=v for k,v in e.items()):errors.append('MEASUREMENT_SOURCE: '+str(i))
  if not m.get('ok') or any(abs(e[k]-m.get('native',{}).get(k,-999999))>1 for k in ('width','height')):errors.append('NATIVE_DIMENSION: '+str(i))
 d=pdfium.PdfDocument(pdf);pages=len(d)
 if not pages==n.get('native_pages')==n.get('pdf_pages')==r.get('expected_pages'):errors.append('PAGES')
 reviewed=r.get('pages',[])
 if sorted(p.get('page',0) for p in reviewed)!=list(range(1,pages+1)):errors.append('ALL_PAGES_NOT_REVIEWED')
 for p in reviewed:
  if any(p.get(k) is not True for k in ('no_clipping','no_overlap','layout_matches')) or not p.get('observations'):errors.append('VISUAL_REVIEW_INCOMPLETE')
 content=r.get('content',{})
 if any(content.get(k) is not True for k in ('solved','unique_answers','scope_checked','scores_checked','roman_italic_checked','student_teacher_agree')):errors.append('CONTENT_REVIEW_INCOMPLETE')
 if not content.get('notes'):errors.append('CONTENT_NOTES_MISSING')
 math_result=None
 try:
  more,math_result=independent_checks(source,pdf,review,r);errors.extend(more)
 except (OSError,ValueError,KeyError,TypeError) as error:errors.append('INDEPENDENT_EVIDENCE: '+str(error))
 structure=None
 if role=='student':
  if any(v is None for v in (mc,essay,points)):errors.append('EXPECTED_COUNTS_REQUIRED')
  metadata=None
  try:
   metadata=json.loads(linked(review,r.get('metadata_file')).read_text(encoding='utf-8-sig'))
   if metadata.get('pages')!=pages:errors.append('METADATA_PAGE_COUNT')
   if len(metadata.get('mc_points',[]))!=mc or len(metadata.get('essay_points',[]))!=essay:errors.append('METADATA_QUESTION_COUNT')
   if sum(metadata.get('mc_points',[]))+sum(metadata.get('essay_points',[]))!=points:errors.append('METADATA_TOTAL_POINTS')
  except (OSError,ValueError,KeyError,TypeError) as error:errors.append('METADATA_REQUIRED: '+str(error))
  structure=audit(source,mc,essay,points,diagrams,metadata)
  errors.extend(structure['errors'])
  try:errors.extend(diagram_checks(source,review,r))
  except (OSError,ValueError,KeyError,TypeError,AttributeError) as error:errors.append('DIAGRAM_EVIDENCE: '+str(error))
  locators=r.get('questions',[])
  if len(locators)!=(mc or 0)+(essay or 0):errors.append('QUESTION_PLACEMENT_COUNT')
  if sorted(q.get('id','') for q in locators)!=sorted([f'MC{i+1}' for i in range(mc or 0)]+[f'E{i+1}' for i in range(essay or 0)]):errors.append('QUESTION_PLACEMENT_IDS')
  # Find real PDF glyphs, not a separately typed transcript. Whitespace is irrelevant.
  page_text=[]
  for p in d:
   t=p.get_textpage();text='';indices=[]
   for i in range(t.count_chars()):
    for char in t.get_text_range(i,1):
     if not char.isspace():text+=char;indices.append(i)
   page_text.append((text,indices,t,p.get_width()))
  for q in locators:
   needle=re.sub(r'\s+','',q.get('text',''));hits=[]
   if not needle:errors.append('QUESTION_LOCATOR_EMPTY');continue
   for pn,(text,indices,t,width) in enumerate(page_text,1):
    start=text.find(needle)
    while start>=0:
     x=t.get_charbox(indices[start])[0];hits.append((pn,'left' if x<width/2 else 'right'));start=text.find(needle,start+1)
   if hits!=[(q.get('page'),q.get('column'))]:errors.append('QUESTION_PLACEMENT: '+q.get('id',''))
   if q.get('id','').startswith('MC'):
    end=re.sub(r'\s+','',q.get('end_text',''));end_hits=[]
    # A unique PDF excerpt may include earlier choices for context, but the
    # fifth-choice glyph itself must remain in the question's page/column.
    anchor=end.rfind('⑤')
    if anchor<0:errors.append('QUESTION_END_LOCATOR_REQUIRED: '+q.get('id',''));continue
    for pn,(text,indices,t,width) in enumerate(page_text,1):
     start=text.find(end)
     while start>=0:
      x=t.get_charbox(indices[start+anchor])[0];end_hits.append((pn,'left' if x<width/2 else 'right'));start=text.find(end,start+1)
    if end_hits!=[(q.get('page'),q.get('column'))]:errors.append('QUESTION_END_PLACEMENT: '+q.get('id',''))
 return {'ok':not errors,'delivery_ready':not errors,'status':'REVIEWED_WITH_INDEPENDENT_EVIDENCE' if not errors else 'NOT_READY','errors':sorted(set(errors)),'structure':structure,'math_review':math_result,'limitation':'독립 검토 파일과 최종 산출물 연결, 산술 검산, 실제 실행·배치를 확인합니다. 검산 모델과 사람의 기하학적 논증 자체를 자동 증명하지는 않습니다.'}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('--pdf',required=True);p.add_argument('--native',required=True);p.add_argument('--review',required=True);p.add_argument('--role',choices=['student','teacher'],default='student');p.add_argument('--mc',type=int);p.add_argument('--essay',type=int);p.add_argument('--points',type=float);p.add_argument('--diagram-paragraph',action='append',default=[]);a=p.parse_args()
 try:r=check(a.source,a.pdf,a.native,a.review,a.role,a.mc,a.essay,a.points,a.diagram_paragraph)
 except (OSError,ValueError,KeyError,TypeError) as e:r={'ok':False,'delivery_ready':False,'errors':[str(e)]}
 print(json.dumps(r,ensure_ascii=False,indent=2));raise SystemExit(0 if r['ok'] else 2)
