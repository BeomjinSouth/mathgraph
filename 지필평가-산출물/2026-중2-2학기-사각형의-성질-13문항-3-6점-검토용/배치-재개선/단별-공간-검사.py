"""Measure actual PDF block ends and allocated working space in millimetres."""
from pathlib import Path
import json,re
import pypdfium2 as pdfium
BASE=Path(__file__).resolve().parent
review=json.loads((BASE/'검수-v2/학생용-검수.json').read_text(encoding='utf8'))
pdf=pdfium.PdfDocument(BASE/'학생용-배치조정-v2.pdf');pages=[]
for p in pdf:
    t=p.get_textpage();text='';indices=[]
    for i in range(t.count_chars()):
        for c in t.get_text_range(i,1):
            if not c.isspace():text+=c;indices.append(i)
    pages.append((p,t,text,indices))
def box(page,needle):
    p,t,text,indices=pages[page-1];needle=re.sub(r'\s+','',needle);at=text.index(needle)
    rects=[t.get_charbox(indices[i]) for i in range(at,at+len(needle))]
    return {'top_mm':(p.get_height()-max(r[3] for r in rects))*25.4/72,'bottom_mm':(p.get_height()-min(r[1] for r in rects))*25.4/72}
questions=[]
for q in review['questions']:
    if not q['id'].startswith('MC'):continue
    start=box(q['page'],q['text']);end=box(q['page'],q['end_text'])
    questions.append({'id':q['id'],'page':q['page'],'column':q['column'],'start_mm':start['top_mm'],'end_mm':end['bottom_mm']})
bottom=330.0
column_bottoms=[{'page':2,'column':col,'last_item':rows[-1]['id'],'bottom_gap_mm':round(bottom-rows[-1]['end_mm'],1)} for col in ('left','right') for rows in [[q for q in questions if q['page']==2 and q['column']==col]]]
picture_bounds=[o.get_bounds() for o in pdf[2].get_objects() if isinstance(o,pdfium.PdfImage)]
height=pdf[2].get_height();width=pdf[2].get_width()
left=sorted((r for r in picture_bounds if r[0]<width/2),key=lambda r:-r[3]);right=[r for r in picture_bounds if r[0]>=width/2]
workspaces={
 'E1':box(3,'【논술형2】')['top_mm']-box(3,'정사각형임을설명하시오.[6점]')['bottom_mm'],
 'E2':bottom-(height-left[-1][1])*25.4/72,
 'E3':box(3,'【논술형4】')['top_mm']-box(3,'값과넓이를구하는풀이과정을쓰시오.[6점]')['bottom_mm'],
 'E4':box(3,'※확인사항')['top_mm']-(height-right[0][1])*25.4/72}
result={'body_bottom_reference_mm':bottom,'mc_blocks':questions,'column_bottoms':column_bottoms,
 'essay_workspaces_mm':{k:round(v,1) for k,v in workspaces.items()},
 'notes':'문항 간 공백은 텍스트의 실제 끝과 다음 시작 사이 거리다. 논술형 마지막 문항은 그림 아래부터 본문 하단 또는 확인사항 전까지의 풀이 공간이다. 바닥을 채우기 위한 장식은 추가하지 않았다.'}
assert all(0<=r['bottom_gap_mm']<=40 for r in column_bottoms)
assert all(v>=25 for v in workspaces.values())
(BASE/'단별-공간-검사.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'column_bottoms':column_bottoms,'essay_workspaces_mm':result['essay_workspaces_mm']},ensure_ascii=False))
