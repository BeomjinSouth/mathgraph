import sys,json,base64
from pathlib import Path
BASE=Path(__file__).resolve().parent
sys.path.insert(0,r'C:\Users\pbj95\.codex\skills\pbj-exam-hwpx\scripts')
from native_author import NativeDocument,point_label_name
from native_label_layout import NativeLabelLayout
from equations import to_hwp
records=[]
with NativeDocument(mathgraph_root=BASE.parent.parent/'2026-중2-2학기-사각형의-성질-고난도-개정본') as doc:
    for key in ['01','02','03','09','E2','E4']:
        suffix='v6' if key=='09' else ('v5' if key=='E2' else 'v4')
        data=json.loads((BASE/'MathGraph'/f'{key}-내보내기-{suffix}.json').read_text(encoding='utf8'))
        d=data['diagram'];layout=NativeLabelLayout(base64.b64decode(d['png'].split(',')[1]),d['widthMm'])
        points={o['label'] for o in data['project'] if o['type'] in ('point','intersection')}
        for l in sorted(d['labels'],key=lambda l:point_label_name(l['text']) in points):
            label={**l,'is_point':point_label_name(l['text']) in points,'script':to_hwp(l['text'])}
            label['font_pt']=13 if label['is_point'] else 11
            ctrl=doc.writer._equation(doc.h,label['script'],label['font_pt']);p=ctrl.Properties
            w,h=int(p.Item('Width')),int(p.Item('Height'))
            record={'diagram':key,'label':label,'width':w,'height':h}
            try:record['placement']=layout.place(label,w,h)
            except RuntimeError as e:record['error']=str(e)
            records.append(record);doc.space(1)
            print(key,label['script'],w,h,record.get('error','PASS'),flush=True)
(BASE/'라벨-사전실측.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf8')
