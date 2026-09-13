"""Create smaller angle arcs through the actual app; keep old image framing."""
from pathlib import Path
import json,subprocess,sys
BASE=Path(__file__).resolve().parent
OLD=BASE.parent/'가독성-개선'
NODE=r'C:\Users\pbj95\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
EXPORT=r'C:\Users\pbj95\.codex\skills\pbj-exam-hwpx\scripts\export_mathgraph.mjs'
radius=float(sys.argv[1]) if len(sys.argv)>1 else 2.2
suffix=sys.argv[2] if len(sys.argv)>2 else ''
for key,width in [('01',68.2),('09',96),('E2',86),('E4',68.2)]:
    target=BASE/'MathGraph'/f'{key}-작은호{suffix}.json'
    if target.exists():
        print(key,'기존 이번 회차 내보내기 유지');continue
    source=OLD/'MathGraph'/f'{key}.grapha.json'
    if key=='09':
        data=json.loads(source.read_text(encoding='utf8'));ops=data['operations']
        at=next(i for i,o in enumerate(ops) if o['type']=='angleDimension')
        ops.insert(at,{'op':'create','id':'O','type':'intersection','object1Id':'AC','object2Id':'BD',
                       'label':'O','fontSize':27,'pointSize':3,'labelOffset':{'x':12,'y':18}})
        for o in ops:
            if o['type']=='angleDimension':o['point2Id']='O'
        source=BASE/'MathGraph/09-교점O.grapha.json'
        source.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8')
    args=[NODE,EXPORT,'--input',str(source),'--output',str(target),'--project',r'C:\Users\pbj95\Desktop\mathGraph\dist',
          '--scale','35','--width-mm',str(width),'--angle-radius-mm',str(radius)]
    if width!=68.2:args+=['--width-reason','사용자가 조정한 기존 그림·라벨의 인쇄 크기 보존']
    subprocess.run(args,check=True)
    result=json.loads(target.read_text(encoding='utf8'))
    version='v6' if key=='09' else 'v5' if key=='E2' else 'v4'
    before=json.loads((OLD/'MathGraph'/f'{key}-내보내기-{version}.json').read_text(encoding='utf8'))
    if abs(result['diagram']['aspect']-before['diagram']['aspect'])>1e-10:
        raise RuntimeError(key+': 크롭 비율이 바뀌어 사용자 위치를 그대로 보존할 수 없습니다.')
    print(key,f'인쇄 호 반지름{radius}mm·크롭비율 유지')
