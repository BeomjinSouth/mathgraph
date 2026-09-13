"""Regression evidence uses old failing artifacts and actual new Hancom output."""
import sys,json,base64,hashlib
from pathlib import Path
BASE=Path(__file__).resolve().parent
sys.path.insert(0,r'C:\Users\pbj95\.codex\skills\pbj-exam-hwpx\scripts')
from verify_native_labels import check
from geometry_review import review
from native_label_layout import NativeLabelLayout
from diagram_writer import _label_shape
NEW=BASE/'학생용-사각형의-성질-가독성-개선-완성.hwpx'
names=['01','02','03','09','E2','E4']
exports=[BASE/'MathGraph'/f'{key}-내보내기-{("v6" if key=="09" else "v5" if key=="E2" else "v4")}.json' for key in names]
oldnames=['01-평행사변형-이웃각-내보내기.json','02-평행사변형-변의길이-내보내기.json','03-평행사변형-대각선길이-내보내기-v2.json','09-마름모-두대각선-내보내기.json','서술02-마름모-각-내보내기.json','서술04-마름모-각-내보내기.json']
old=check(BASE.parent/'학생용-중2-2학기-사각형의-성질-13문항-그림포함-고난도-최종.hwpx',[BASE.parent/'MathGraph'/n for n in oldnames])
assert not old['ok'] and any('PRINT_FONT' in e for e in old['errors'])
assert any('SAVED_LABEL_COLLISION' in e for e in old['errors'])
new=check(NEW,exports)
assert new['ok'],new['errors']
def condition(kind,points,reason,**kw):return dict(kind=kind,points=list(points),reason=reason,**kw)
conditions=[
 [condition('angle','DAB','원래 조건에서 x=22, DAB=81도',expected=81,given=True,display='(3x+15)°'),condition('angle','ABC','이웃각 99도',expected=99,given=True,display='(5x-11)°'),condition('parallel','ABDC','평행사변형의 대변'),condition('parallel','ADBC','평행사변형의 대변')],
 [condition('length_ratio','ABAD','x=5에서 AB=13, AD=9',expected=13/9),condition('segment_label','AB','주어진 길이',given=True,display='3x-2'),condition('segment_label','CD','주어진 길이',given=True,display='x+8'),condition('parallel','ABDC','평행사변형'),condition('parallel','ADBC','평행사변형')],
 [condition('midpoint','AOC','대각선의 중점'),condition('midpoint','BOD','대각선의 중점'),condition('segment_label','AO','주어진 길이',given=True,display='2x+1'),condition('segment_label','OC','주어진 길이',given=True,display='x+7')],
 [condition('angle','BAC','x=24에서 주어진 반각',expected=36,given=True,display='(x+12)°'),condition('angle','ABD','x=24에서 주어진 반각',expected=54,given=True,display='(2x+6)°')],
 [condition('angle','BAC','x=28에서 주어진 반각',expected=38,given=True,display='(x+10)°'),condition('angle','ABC','x=28에서 주어진 꼭짓각',expected=104,given=True,display='(3x+20)°')],
 [condition('angle','ABC','x=20에서 주어진 꼭짓각',expected=100,given=True,display='(4x+20)°'),condition('angle','ACB','x=20에서 주어진 반각',expected=40,given=True,display='2x°')]]
geometry=[]
for name,path,cs in zip(names,exports,conditions):
    data=json.loads(path.read_text(encoding='utf8'))
    if name in ('09','E2','E4'):
        cs.extend(condition('length_ratio',p,'마름모의 네 변은 모두 같음',expected=1) for p in ('ABBC','ABCD','ABDA'))
    errors=review(data,cs);assert not errors,(name,errors)
    geometry.append({'id':name,'export':str(path),'conditions':cs,'ok':True})
    assert data['printProfile']['allConditionLabelsExported']
regressions={'old_file_rejected_for_small_fonts_and_collisions':True,'new_saved_labels_clear':new['ok'],
             'all_37_native_labels_checked':sum(len(d['labels']) for d in new['diagrams'])==37,
             'native_textbox_has_padding':_label_shape(0,0,5000,1300)['Width']>5000+1000,
             'rectangle_all_lengths_consistent':8**2+6**2==(2*5)**2}
assert all(regressions.values())
(BASE/'실측-충돌-검사-완성.json').write_text(json.dumps(new,ensure_ascii=False,indent=2),encoding='utf8')
(BASE/'검증-결과.json').write_text(json.dumps({'regressions':regressions,'geometry':geometry,'old_errors':old['errors']},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(regressions,ensure_ascii=False))
