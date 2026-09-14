"""Generate 24 editable GraphA calibration samples and one contact sheet."""
from pathlib import Path
import json
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

BASE = Path(__file__).resolve().parent
SRC = BASE / "GraphA"
OUT = BASE / "내보내기"
PROJECT_FILES = BASE / "프로젝트"
SRC.mkdir(exist_ok=True)
OUT.mkdir(exist_ok=True)
PROJECT_FILES.mkdir(exist_ok=True)
NODE = r"C:\Users\pbj95\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
EXPORT = r"C:\Users\pbj95\.codex\skills\pbj-exam-hwpx\scripts\export_mathgraph.mjs"
PROJECT = r"C:\Users\pbj95\Desktop\mathGraph\dist"


def point(name, x, y, dx=10, dy=-18):
    return {"op":"create","id":name,"type":"point","x":x,"y":y,"label":name,
            "pointSize":0,"fontSize":27,"labelOffset":{"x":dx,"y":dy}}


def segment(name, a, b, visible=True):
    item={"op":"create","id":name,"type":"segment","point1Id":a,"point2Id":b,"lineWidth":3}
    if not visible:item["visible"]=False
    return item


def polygon(name, vertices):
    return {"op":"create","id":name,"type":"polygon","vertexIds":vertices,
            "fillOpacity":0,"showLabel":False,"lineWidth":3}


def angle(name, vertex, a, b, text, radius=1.2, offset=None):
    item={"op":"create","id":name,"type":"angleDimension","vertexId":vertex,
          "point1Id":a,"point2Id":b,"arcRadius":radius,"customText":text,"labelFontSize":22,"lineWidth":3}
    if offset:item["labelOffset"]={"x":offset[0],"y":offset[1]}
    return item


def length(name, seg, text, curvature):
    return {"op":"create","id":name,"type":"lengthDimension","segmentId":seg,
            "customText":text,"labelFontSize":22,"curvature":curvature,"lineWidth":3}


samples=[]
def add(code,title,group,ops,angle_mm="source",length_mm="source",width=68.2):
    samples.append({"id":code,"title":title,"group":group,"operations":ops,
                    "angle_mm":angle_mm,"length_mm":length_mm,"width_mm":width})


# P01-P06: point-name placement and point-free vertices/intersections.
add("P01","예각삼각형의 점 이름","점 이름",[
    point("A",-5,-3,-26,20),point("B",5,-3,12,20),point("C",0,4,-5,-24),polygon("ABC",["A","B","C"])])
add("P02","둔각삼각형의 점 이름","점 이름",[
    point("A",-6,-2,-26,20),point("B",6,-2,12,20),point("C",-3,2,-18,-24),polygon("ABC",["A","B","C"])])
add("P03","직각삼각형의 점 이름","점 이름",[
    point("A",-5,-3,-26,20),point("B",5,-3,12,20),point("C",-5,4,-26,-24),polygon("ABC",["A","B","C"])])
add("P04","평행사변형의 점 이름","점 이름",[
    point("A",-5,-3,-26,20),point("B",4,-3,12,20),point("C",6,3,12,-24),point("D",-3,3,-26,-24),polygon("ABCD",["A","B","C","D"])])
add("P05","사다리꼴의 점 이름","점 이름",[
    point("A",-6,-3,-26,20),point("B",6,-3,12,20),point("C",3,3,12,-24),point("D",-2,3,-26,-24),polygon("ABCD",["A","B","C","D"])])
ops=[point("A",-6,0,-26,20),point("C",6,0,12,20),segment("AC","A","C")]
ops += [{"op":"create","id":"O","type":"midpoint","segmentId":"AC","label":"O","pointSize":0,"fontSize":27,"labelOffset":{"x":12,"y":20}},segment("AO","A","O",False),segment("OC","O","C",False),length("lenAO","AO","2x+1",-80),length("lenOC","OC","x+7",80)]
add("P06","교점 O의 이름 위치","점 이름",ops)

# P07-P12: angle arcs and value-label association.
add("P07","예각의 호와 각도식","각도 호",[
    point("A",-5,-3,-26,20),point("B",5,-3,12,20),point("C",-1,4,-8,-24),polygon("ABC",["A","B","C"]),angle("angA","A","B","C","(x+15)°")],3)
add("P08","둔각의 호와 값","각도 호",[
    point("A",-5,-3,-26,20),point("B",5,-3,12,20),point("C",-2,2,-10,-24),polygon("ABC",["A","B","C"]),angle("angB","B","C","A","112°")],4)
add("P09","한 꼭짓점의 두 겹 호","각도 호",[
    point("A",-5,-3,-26,20),point("B",0,0,12,20),point("C",5,-3,12,20),point("D",4,4,12,-24),segment("BA","B","A"),segment("BC","B","C"),segment("BD","B","D"),
    angle("small","B","C","D","α",1.0),angle("large","B","A","D","β",1.7)],3)
add("P10","서로 다른 꼭짓점의 두 각","각도 호",[
    point("A",-5,-3,-26,20),point("B",5,-3,12,20),point("C",4,3,12,-24),point("D",-3,3,-26,-24),polygon("ABCD",["A","B","C","D"]),
    angle("angA","A","B","D","(x+10)°"),angle("angB","B","C","A","(2x+20)°")],4)
add("P11","마름모 대각선의 반각","각도 호",[
    point("A",-6,0,-26,12),point("B",0,-4,12,20),point("C",6,0,12,-10),point("D",0,4,-8,-24),polygon("ABCD",["A","B","C","D"]),segment("AC","A","C"),
    angle("halfA","A","B","C","28°")],4)
add("P12","직각에 가까운 큰 각","각도 호",[
    point("A",-5,-3,-26,20),point("B",5,-3,12,20),point("C",4.5,3,12,-24),polygon("ABC",["A","B","C"]),angle("angB","B","C","A","(x+5)°")],5)

# P13-P18: length curves; the sign chooses the outside of each segment.
add("P13","수평선분 위 길이 호","길이 호",[
    point("A",-5,0,-26,20),point("B",5,0,12,20),segment("AB","A","B",False),length("len","AB","x+4",100)],length_mm=4)
add("P14","수평선분 아래 길이 호","길이 호",[
    point("A",-5,0,-26,-24),point("B",5,0,12,-24),segment("AB","A","B",False),length("len","AB","2x-1",-100)],length_mm=5)
add("P15","기울어진 변의 길이 호","길이 호",[
    point("A",-4,-3,-26,20),point("B",4,3,12,-24),segment("AB","A","B",False),length("len","AB","7cm",100)],length_mm=5)
add("P16","마주 보는 두 변의 길이","길이 호",[
    point("A",-5,-3,-26,20),point("B",4,-3,12,20),point("C",6,3,12,-24),point("D",-3,3,-26,-24),polygon("ABCD",["A","B","C","D"]),
    segment("AB","A","B",False),segment("CD","C","D",False),length("lenAB","AB","3x-2",-100),length("lenCD","CD","x+8",-100)],length_mm=5)
ops=[point("A",-6,0,-26,20),point("C",6,0,12,20),segment("AC","A","C")]
ops += [{"op":"create","id":"O","type":"midpoint","segmentId":"AC","label":"O","pointSize":0,"fontSize":27,"labelOffset":{"x":12,"y":20}},segment("AO","A","O",False),segment("OC","O","C",False),length("lenAO","AO","2x+1",-80),length("lenOC","OC","x+7",80)]
add("P17","대각선 두 부분의 길이","길이 호",ops,length_mm=7)
add("P18","좁은 삼각형의 두 길이","길이 호",[
    point("A",-4,-3,-26,20),point("B",4,-3,12,20),point("C",0,4,-8,-24),polygon("ABC",["A","B","C"]),
    segment("AC","A","C",False),segment("BC","B","C",False),length("lenAC","AC","x+2",100),length("lenBC","BC","2x-3",-100)],length_mm=6)

# P19-P24: intersections and crowded textbook layouts without point markers.
ops=[point("A",-6,-3,-26,20),point("B",4,-3,12,20),point("C",6,3,12,-24),point("D",-4,3,-26,-24),polygon("ABCD",["A","B","C","D"]),segment("AC","A","C"),segment("BD","B","D")]
ops.append({"op":"create","id":"O","type":"intersection","object1Id":"AC","object2Id":"BD","label":"O","pointSize":0,"fontSize":27,"labelOffset":{"x":12,"y":-22}})
add("P19","평행사변형 대각선 교점","교점·복합",ops)
ops=[point("A",-5,-3,-26,20),point("B",5,-3,12,20),point("C",0,4,-8,-24),point("D",0,-3,-8,22),point("E",2.5,.5,12,-20),polygon("ABC",["A","B","C"]),segment("CD","C","D"),segment("AE","A","E")]
ops.append({"op":"create","id":"G","type":"intersection","object1Id":"CD","object2Id":"AE","label":"G","pointSize":0,"fontSize":27,"labelOffset":{"x":12,"y":-22}})
add("P20","삼각형 내부 두 선의 교점","교점·복합",ops)
add("P21","연장선 바깥 교점","교점·복합",[
    point("A",-5,-3,-26,20),point("B",0,-1,-8,20),point("C",-4,3,-26,-24),point("D",2,0,12,-24),
    {"op":"create","id":"l1","type":"line","point1Id":"A","point2Id":"B","visible":False},
    {"op":"create","id":"l2","type":"line","point1Id":"C","point2Id":"D","visible":False},
    {"op":"create","id":"P","type":"intersection","object1Id":"l1","object2Id":"l2","label":"P","pointSize":0,"fontSize":27,"labelOffset":{"x":12,"y":-22}},
    segment("AP","A","P"),segment("CP","C","P")])
ops=[{"op":"create","id":"O","type":"point","x":0,"y":0,"label":None,"showLabel":False,"visible":False},
     {"op":"create","id":"R","type":"point","x":5,"y":0,"label":None,"showLabel":False,"visible":False},
     {"op":"create","id":"c","type":"circle","centerId":"O","pointOnCircleId":"R","lineWidth":3,"showLabel":False},
     point("A",-4,-3,-26,20),point("B",4,3,12,-24),point("C",-4,3,-26,-24),point("D",4,-3,12,20),segment("AB","A","B"),segment("CD","C","D")]
ops.append({"op":"create","id":"P","type":"intersection","object1Id":"AB","object2Id":"CD","label":"P","pointSize":0,"fontSize":27,"labelOffset":{"x":12,"y":-22}})
add("P22","원 안 두 현의 교점","교점·복합",ops,width=80)
add("P23","수선의 발과 직각 표시","교점·복합",[
    point("A",-5,-3,-26,20),point("B",5,-3,12,20),point("C",1,4,-8,-24),polygon("ABC",["A","B","C"]),segment("AB","A","B"),
    {"op":"create","id":"H","type":"pointOnLine","lineId":"AB","t":.6,"label":"H","pointSize":0},segment("CH","C","H"),
    {"op":"create","id":"rightH","type":"rightAngleMarker","vertexId":"H","line1Id":"AB","line2Id":"CH","lineWidth":3}])
add("P24","복합 라벨과 평행 표시","교점·복합",[
    point("A",-6,-3,-26,20),point("B",5,-3,12,20),point("C",4,3,12,-24),point("D",-3,3,-26,-24),polygon("ABCD",["A","B","C","D"]),segment("AC","A","C"),
    {"op":"create","id":"M","type":"midpoint","segmentId":"AC","label":"M","pointSize":0,"fontSize":27,"labelOffset":{"x":12,"y":-22}},
    segment("AB","A","B",False),segment("CD","C","D",False),length("lenAB","AB","a",-90),length("lenCD","CD","a",-90),angle("angA","A","B","C","35°")],angle_mm=4,length_mm=5)


manifest=[]
for sample in samples:
    source=SRC/f"{sample['id']}.grapha.json"
    target=OUT/f"{sample['id']}.json"
    source.write_text(json.dumps({"operations":sample["operations"]},ensure_ascii=False,indent=2),encoding="utf-8")
    command=[NODE,EXPORT,"--input",str(source),"--output",str(target),"--project",PROJECT,
             "--scale","42","--width-mm",str(sample["width_mm"]),"--point-markers","none",
             "--angle-radius-mm",str(sample["angle_mm"]),"--length-arc-height-mm",str(sample["length_mm"])]
    if sample["width_mm"]!=68.2:
        command += ["--width-reason","기준표에서 넓은 원·교점 배치의 가독성을 비교"]
    if not target.exists():
        subprocess.run(command,check=True)
    manifest.append({k:sample[k] for k in ("id","title","group","angle_mm","length_mm","width_mm")})

    exported=json.loads(target.read_text(encoding="utf-8"))
    frame=exported["captureFrame"]
    envelope={
        "format":"mathgraph-project",
        "version":1,
        "name":f"{sample['id']} {sample['title']}",
        "savedAt":"2026-09-14T00:00:00.000Z",
        "view":{"offset":frame["offset"],"scale":frame["scale"]},
        "objects":exported["project"],
    }
    (PROJECT_FILES/f"{sample['id']}.mathgraph.json").write_text(
        json.dumps(envelope,ensure_ascii=False,indent=2),encoding="utf-8")

(BASE/"시안목록.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")

font_path=Path(r"C:\Windows\Fonts\malgun.ttf")
title_font=ImageFont.truetype(str(font_path),28) if font_path.exists() else ImageFont.load_default()
id_font=ImageFont.truetype(str(font_path),24) if font_path.exists() else ImageFont.load_default()
card_w,card_h=520,390
sheet=Image.new("RGB",(card_w*4,card_h*6),(235,235,235))
draw=ImageDraw.Draw(sheet)
for index,sample in enumerate(samples):
    image=Image.open(OUT/f"{sample['id']}.preview.png").convert("RGB")
    image.thumbnail((card_w-28,card_h-70),Image.Resampling.LANCZOS)
    x=(index%4)*card_w;y=(index//4)*card_h
    draw.rectangle((x+4,y+4,x+card_w-4,y+card_h-4),fill="white",outline="black",width=2)
    draw.text((x+16,y+10),sample["id"],font=id_font,fill="black")
    draw.text((x+85,y+10),sample["title"],font=title_font,fill="black")
    sheet.paste(image,(x+(card_w-image.width)//2,y+58+(card_h-70-image.height)//2))
sheet.save(BASE/"도형-기준표-24종.png",dpi=(180,180))
print(json.dumps({"samples":len(samples),"sheet":str(BASE/'도형-기준표-24종.png')},ensure_ascii=False))





