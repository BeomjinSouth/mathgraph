"""Create exact GraphA inputs and export them through the real MathGraph app."""
import json, math, subprocess, sys
from pathlib import Path
BASE=Path(__file__).resolve().parent
DEST=BASE/'MathGraph'
NODE=r'C:\Users\pbj95\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
EXPORT=r'C:\Users\pbj95\.codex\skills\pbj-exam-hwpx\scripts\export_mathgraph.mjs'
PROJECT=r'C:\Users\pbj95\Desktop\mathGraph\dist'

def scene(coords, diagonals=()):
    ops=[]
    for key,(x,y) in coords.items():
        ops.append(dict(op='create',id=key,type='point',x=x,y=y,label=key,fontSize=27,pointSize=3,
                        labelOffset={'x':-27 if key in ('A','D') else 12,'y':18 if key in ('A','B') else -24}))
    ops.append(dict(op='create',id='outline',type='polygon',vertexIds=list('ABCD'),fillOpacity=0,showLabel=False))
    for seg in diagonals:ops.append(dict(op='create',id=seg,type='segment',point1Id=seg[0],point2Id=seg[1],dashed=False))
    return ops

def angle(ops, coords, name, value, radius=1.1):
    a,v,b=[coords[k] for k in name]
    s=math.atan2(a[1]-v[1],a[0]-v[0]);e=math.atan2(b[1]-v[1],b[0]-v[0])
    diff=(e-s)%(2*math.pi)
    if diff>math.pi:s,e=e,s;diff=2*math.pi-diff
    actual=s+diff/2;desired=actual
    r=radius*1.65
    # Compensate the old app's atan2 wrap in label placement, without changing the angle rays.
    offset={'x':r*math.cos(desired)-radius*1.5*math.cos(actual),
            'y':r*math.sin(desired)-radius*1.5*math.sin(actual)}
    ops.append(dict(op='create',id='angle_'+name,type='angleDimension',vertexId=name[1],point1Id=name[0],point2Id=name[2],
                    arcRadius=radius,customText=value,labelFontSize=22,labelOffset=offset))

def length(ops,name,value,curvature):
    ops.append(dict(op='create',id=name,type='segment',point1Id=name[0],point2Id=name[1],visible=False))
    ops.append(dict(op='create',id='len_'+name,type='lengthDimension',segmentId=name,customText=value,
                    labelFontSize=22,curvature=curvature))

def save(name,ops):
    if len(sys.argv)>1 and name not in sys.argv[1:]:return
    DEST.mkdir(exist_ok=True)
    path=DEST/(name+'.grapha.json')
    path.write_text(json.dumps({'operations':ops},ensure_ascii=False,indent=2),encoding='utf8')
    version='v6' if name=='09' else ('v5' if name=='E2' else 'v4')
    extra=['--width-mm','86' if name=='E2' else '96','--width-reason','두 조건 수식을 11pt로 유지하며 해당 각 내부에 배치할 공간 확보'] if name in ('E2','09') else []
    result=subprocess.run([NODE,EXPORT,'--input',str(path),'--output',str(DEST/(name+'-내보내기-'+version+'.json')),
                           '--project',PROJECT,'--scale','35',*extra],check=True)

if __name__=='__main__':
    shift=4*math.cos(math.radians(81));height=4*math.sin(math.radians(81))
    p={'A':(-3.5,0),'B':(3.5,0),'C':(3.5+shift,height),'D':(-3.5+shift,height)}
    o=scene(p);angle(o,p,'DAB','(3x+15)°');angle(o,p,'ABC','(5x-11)°');save('01',o)
    p={'A':(-3.25,0),'B':(3.25,0),'C':(4.45,math.sqrt(4.5**2-1.2**2)),'D':(-2.05,math.sqrt(4.5**2-1.2**2))}
    o=scene(p);length(o,'AB','3x-2',-100);length(o,'CD','x+8',-100);save('02',o)
    p={'A':(-6,0),'B':(-0.5,-5),'C':(6,0),'D':(0.5,5)}
    o=scene(p,('AC','BD'));o.append(dict(op='create',id='O',type='intersection',object1Id='AC',object2Id='BD',label='O',fontSize=27,pointSize=3,labelOffset={'x':-8,'y':-35}))
    length(o,'AO','2x+1',-75);length(o,'OC','x+7',75);save('03',o)
    for name,theta,labels in [('09',36,[('BAC','(x+12)°'),('ABD','(2x+6)°')]),
                              ('E2',38,[('BAC','(x+10)°'),('ABC','(3x+20)°')]),
                              ('E4',40,[('ABC','(4x+20)°'),('ACB','2x°')])]:
        h=6*math.tan(math.radians(theta))
        p={'A':(-6,0),'B':(0,-h),'C':(6,0),'D':(0,h)}
        o=scene(p,('AC','BD') if name=='09' else ('AC',))
        for ang,txt in labels:
            angle(o,p,ang,txt,1.2)
            if name=='09':o[-1]['labelFontSize']=18
            if ang=='ABD':
                o[-1]['labelOffset']['x']-=0.9
                o[-1]['labelOffset']['y']+=0.8
                o[-1]['labelFontSize']=18
            if ang=='ABC':o[-1]['labelOffset']['y']+=0.3 if name=='E2' else 1.2
        save(name,o)
