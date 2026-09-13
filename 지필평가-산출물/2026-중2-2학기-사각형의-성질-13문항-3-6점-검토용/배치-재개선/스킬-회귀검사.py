"""Exercise defaults and reject loss of actual user edits; never edit sources."""
from pathlib import Path
from zipfile import ZipFile
from lxml import etree as E
import json,sys,tempfile,subprocess
BASE=Path(__file__).resolve().parent;OLD=BASE.parent/'가독성-개선'
SKILL=Path(r'C:\Users\pbj95\.codex\skills\pbj-exam-hwpx')
sys.path.insert(0,str(SKILL/'scripts'))
from preserved_diagram_review import check
NODE=r'C:\Users\pbj95\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
source=BASE/'학생용-배치조정-v2.hwpx';review=BASE/'검수-v2/학생용-검수.json'
manifest=json.loads(review.read_text(encoding='utf8'));results={}
with tempfile.TemporaryDirectory(prefix='exam-layout-regression-') as temp:
    temp=Path(temp)
    for mode in ('default','source'):
        out=temp/(mode+'.json')
        args=[NODE,str(SKILL/'scripts/export_mathgraph.mjs'),'--input',str(OLD/'MathGraph/01.grapha.json'),
              '--output',str(out),'--project',r'C:\Users\pbj95\Desktop\mathGraph\dist','--scale','35']
        if mode=='source':args+=['--angle-radius-mm','source']
        subprocess.run(args,check=True,capture_output=True)
        got=json.loads(out.read_text(encoding='utf8'))
        reference=json.loads((BASE/'MathGraph/01-작은호-v2.json' if mode=='default' else OLD/'MathGraph/01-내보내기-v4.json').read_text(encoding='utf8'))
        results[mode+'_geometry_matches_verified_render']=got['diagram']['png']==reference['diagram']['png']
        if mode=='default':results['default_arcs_are_3mm']=len(got['printProfile']['angleArcs'])==2 and all(abs(a['radiusMm']-3)<1e-9 for a in got['printProfile']['angleArcs'])
    results['final_preservation_passes']=check(source,review,manifest)==[]
    with ZipFile(source) as z:entries=[(i,z.read(i.filename)) for i in z.infolist()]
    root=E.fromstring(next(data for info,data in entries if info.filename=='Contents/section0.xml'))
    ns={'hp':'http://www.hancom.co.kr/hwpml/2011/paragraph'}
    rect=next(r for r in root.findall('.//hp:rect',ns) if r.find('.//hp:equation',ns) is not None)
    pos=rect.find('hp:pos',ns)
    pos.set('horzOffset',str(int(pos.get('horzOffset'))+100))
    changed=temp/'moved-user-label.hwpx'
    with ZipFile(changed,'w') as z:
        for info,data in entries:z.writestr(info,E.tostring(root,encoding='UTF-8',xml_declaration=True) if info.filename=='Contents/section0.xml' else data)
    errors=check(changed,review,manifest)
    results['unauthorized_label_move_is_rejected']=any(e.startswith('USER_LABEL_CHANGED:') for e in errors)
result={'ok':all(results.values()),'checks':results}
(BASE/'스킬-회귀-결과.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(result,ensure_ascii=False));raise SystemExit(0 if result['ok'] else 2)
