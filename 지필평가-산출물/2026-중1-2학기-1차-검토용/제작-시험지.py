"""원안지 HWPX의 본문을 편집 가능한 한글 수식 개체로 조립하고 검토용 PDF를 만든다."""
from __future__ import annotations
import base64, copy, hashlib, json, sys
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED, ZIP_STORED
from lxml import etree as E
from reportlab.lib.pagesizes import landscape
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

ROOT=Path(__file__).resolve().parent; SKILL=Path(r"C:\Users\pbj95\.codex\skills\pbj-exam-hwpx")
sys.path.insert(0,str(SKILL/'scripts')); from equations import to_hwp
from exam_tools import metadata_values
STUDENT=ROOT/'2026-중1-2학기-1차-지필평가-학생용-검토용.hwpx'
TEACHER=ROOT/'2026-중1-2학기-1차-지필평가-정답해설-검토용.hwpx'
SPDF=ROOT/'2026-중1-2학기-1차-지필평가-학생용-미리보기.pdf'; TPDF=ROOT/'2026-중1-2학기-1차-지필평가-정답해설-미리보기.pdf'
DIAGRAM=ROOT/'MathGraph-그림'/'문항3-평행선의-각.png'
HP='http://www.hancom.co.kr/hwpml/2011/paragraph'; HC='http://www.hancom.co.kr/hwpml/2011/core'; OPF='http://www.idpf.org/2007/opf/'
NS={'hp':HP,'hc':HC,'opf':OPF}; ST={'normal':('0','3','14'),'mc':('3','6','2'),'essay':('4','27','14'),'choice':('6','4','14')}

Q=[
 ([('t','다음 중 두 끝점을 모두 가지는 도형은? [8점]')],['① 직선','② 반직선','③ 각','④ 선분','⑤ 평면']),
 ([('t','두 직선이 한 점에서 만날 때, 한 각의 크기가 '),('e',r'64^{\circ}'),('t','이다. 이 각과 맞꼭지각의 크기는? [8점]')],['① 26°','② 64°','③ 116°','④ 128°','⑤ 180°']),
 ([('t','다음 그림에서 '),('e',r'l\parallel{}m'),('t','일 때, 표시한 두 각의 관계로 옳은 것은? [8점]')],['① 엇각이므로 서로 보각이다.','② 동위각이므로 서로 크기가 같다.','③ 맞꼭지각이므로 서로 크기가 같다.','④ 내대각이므로 서로 보각이다.','⑤ 두 각 사이에는 일정한 관계가 없다.']),
 ([('t','선분 '),('e',r'\bar{\mathrm{AB}}'),('t','의 수직이등분선 위에 있는 점 '),('e',r'\mathrm{P}'),('t','에 대하여 항상 옳은 것은? [8점]')],[r'① \bar{AP}>\bar{BP}',r'② \bar{AP}=\bar{BP}',r'③ \bar{AP}<\bar{BP}',r'④ \bar{AB}=\bar{AP}',r'⑤ \bar{AB}=\bar{BP}']),
 ([('t','두 삼각형이 합동임을 보이기에 충분한 조건은? [8점]')],['① 한 변의 길이와 한 각의 크기가 각각 같다.','② 두 각의 크기가 각각 같다.','③ 세 각의 크기가 각각 같다.','④ 두 변의 길이와 그 끼인각의 크기가 각각 같다.','⑤ 한 변의 길이와 그 양 끝각의 크기가 각각 같다.']),
 ([('e',r'\triangle\mathrm{ABC}\cong\triangle\mathrm{DEF}'),('t','일 때, 서로 대응하는 각은? [8점]')],[r'① \angle A=\angle E',r'② \angle B=\angle D',r'③ \angle B=\angle E',r'④ \angle C=\angle E',r'⑤ \angle C=\angle D']),
 ([('e',r'\bar{\mathrm{AB}}=\bar{\mathrm{AC}}'),('t','인 이등변삼각형 '),('e',r'\triangle\mathrm{ABC}'),('t','에서 '),('e',r'\angle\mathrm{B}=52^{\circ}'),('t','일 때, '),('e',r'\angle\mathrm{A}'),('t','의 크기는? [8점]')],['① 52°','② 76°','③ 90°','④ 104°','⑤ 128°']),
 ([('e',r'\triangle\mathrm{ABC}'),('t','에서 '),('e',r'\angle\mathrm{B}=45^{\circ}'),('t',', '),('e',r'\angle\mathrm{C}=65^{\circ}'),('t','일 때, 꼭짓점 '),('e',r'\mathrm{A}'),('t','에서의 외각의 크기는? [8점]')],['① 70°','② 90°','③ 100°','④ 110°','⑤ 135°'])]
E9=[('t','이등변삼각형 '),('e',r'\triangle\mathrm{ABC}'),('t','에서 '),('e',r'\bar{\mathrm{AB}}=\bar{\mathrm{AC}}'),('t',', '),('e',r'\angle\mathrm{B}=52^{\circ}'),('t','이다. '),('e',r'\angle\mathrm{A}=x^{\circ}'),('t','라 할 때, '),('e','x'),('t','의 값을 구하는 과정을 쓰시오. [16점]')]
E10=[('t','두 삼각형에서 '),('e',r'\bar{\mathrm{AB}}=\bar{\mathrm{DE}}'),('t',', '),('e',r'\bar{\mathrm{BC}}=\bar{\mathrm{EF}}'),('t',', '),('e',r'\angle\mathrm{B}=\angle\mathrm{E}'),('t','이다. 두 삼각형이 합동임을 설명하고, '),('e',r'\bar{\mathrm{AC}}'),('t','와 같은 길이의 선분을 쓰시오. [20점]')]

class Build:
 def __init__(self,root,eq,pic):self.root=root;self.eq=eq;self.pic=pic;self.n=870000000;self.z=1
 def p(self,k='normal',first=False,break_=False):
  s,para,char=ST[k]; self.n+=1;p=E.Element(E.QName(HP,'p'),id=str(self.n),paraPrIDRef=para,styleIDRef=s,pageBreak='1' if break_ else '0',columnBreak='0',merged='0');r=E.SubElement(p,E.QName(HP,'run'),charPrIDRef=char)
  if first:
   c=E.SubElement(r,E.QName(HP,'ctrl'));x=E.SubElement(c,E.QName(HP,'colPr'),id='',type='NEWSPAPER',layout='LEFT',colCount='2',sameSz='1',sameGap='1420');E.SubElement(x,E.QName(HP,'colLine'),type='SOLID',width='0.12 mm',color='#000000')
  return p,r
 def eqadd(self,r,latex):
  self.n+=1;self.z+=1;e=copy.deepcopy(self.eq);e.set('id',str(self.n));e.set('zOrder',str(self.z));script=to_hwp(latex);e.find('hp:script',NS).text=script;sz=e.find('hp:sz',NS);sz.set('width',str(max(525,min(6500,360*len(script.replace(' ',''))))));sz.set('height','1500' if any(a in script for a in ('over','sqrt','^')) else '1125');r.append(e)
 def picadd(self,r):
  self.n+=1;self.z+=1;p=copy.deepcopy(self.pic);p.set('id',str(self.n));p.set('zOrder',str(self.z));p.set('textWrap','TOP_AND_BOTTOM');p.find('hc:img',NS).set('binaryItemIDRef','mathgraph_q3');w,h=22677,13606
  p.find('hp:orgSz',NS).attrib.update({'width':str(w),'height':str(h)});p.find('hp:curSz',NS).attrib.update({'width':str(w),'height':str(h)});p.find('hp:imgDim',NS).attrib.update({'dimwidth':str(w),'dimheight':str(h)});p.find('hp:imgClip',NS).attrib.update({'left':'0','right':str(w),'top':'0','bottom':str(h)});p.find('hp:sz',NS).attrib.update({'width':str(w),'height':str(h)});pos=p.find('hp:pos',NS);pos.attrib.update({'treatAsChar':'1','vertRelTo':'PARA','horzRelTo':'PARA','vertOffset':'0','horzOffset':'0'})
  for tag,x,y in [('pt0',0,0),('pt1',w,0),('pt2',w,h),('pt3',0,h)]:p.find('hp:imgRect',NS).find('hc:'+tag,NS).attrib.update({'x':str(x),'y':str(y)})
  p.find('hp:shapeComment',NS).text='MathGraph에서 내보낸 평행선의 각 그림입니다.';r.append(p)
 def add(self,k,frags,first=False,break_=False,picture=False):
  p,r=self.p(k,first,break_)
  for typ,val in frags:self.eqadd(r,val) if typ=='e' else E.SubElement(r,E.QName(HP,'t')).__setattr__('text',val)
  if picture:self.picadd(r)
  self.root.append(p)

def seed():
 with ZipFile(SKILL/'assets'/'original-exam.hwpx') as z:o=E.fromstring(z.read('Contents/section0.xml'))
 eq=next(o.iter(E.QName(HP,'equation')))
 ref=Path(r'C:\Users\pbj95\Desktop\mathGraph\HWPX-자동화\수업지도안_중등_성호중_박범진.hwpx')
 with ZipFile(ref) as z:pic=E.fromstring(z.read('Contents/section0.xml')).find('.//hp:pic',NS)
 return eq,pic
def build(dest,teacher=False):
 eq,pic=seed()
 with ZipFile(SKILL/'assets'/'blank-exam.hwpx') as z:files={i.filename:z.read(i.filename) for i in z.infolist()}
 replacements=metadata_values(json.loads((ROOT/'시험정보.json').read_text(encoding='utf-8-sig')))
 for name,data in list(files.items()):
  if name.startswith('Contents/') and name.endswith('.xml'):
   text=data.decode('utf-8')
   for old,new in replacements.items():text=text.replace(old,new)
   files[name]=text.encode('utf-8')
 sec=E.fromstring(files['Contents/section0.xml'])
 token=next((p for p in sec.findall('.//hp:p',NS) if '{{BODY}}' in ''.join(p.xpath('.//hp:t/text()',namespaces=NS))),None)
 if token is None: token=next(p for p in sec.findall('.//hp:p',NS) if '다음 중 두 끝점을' in ''.join(p.xpath('.//hp:t/text()',namespaces=NS)))
 parent=token.getparent();idx=parent.index(token);parent.remove(token)
 scratch=E.Element(E.QName(HP,'scratch'));b=Build(scratch,eq,pic)
 if not teacher:
  for i,(f,ch) in enumerate(Q):
   b.add('mc',f,first=i==0,break_=i==4)
   if i==2:b.add('normal',[],picture=True)
   for c in ch:
    if '\\' in c:
     mark,formula=c[:1],c[2:];b.add('choice',[('t',mark+' '),('e',formula)])
    elif any('0' <= ch <= '9' for ch in c):
     mark,formula=c[:1],c[2:].replace('°',r'^{\circ}');b.add('choice',[('t',mark+' '),('e',formula)])
    else:b.add('choice',[('t',c)])
  b.add('essay',E9,break_=True)
  for _ in range(5):b.add('normal',[])
  b.add('essay',E10)
  for _ in range(6):b.add('normal',[])
 else:
  b.add('normal',[('t','2026학년도 2학기 1차 지필평가 검토용 — 정답·해설 및 채점 기준')],first=True)
  for x in ['창작 문항이며, 시행 날짜와 교시는 미확정입니다.','선택형 정답: ①④  ②②  ③②  ④②  ⑤④  ⑥③  ⑦②  ⑧④','1번: 선분은 두 끝점을 모두 가진다.','2번: 맞꼭지각은 서로 크기가 같다.','3번: 평행선에서 동위각은 서로 크기가 같다.','4번: 수직이등분선 위의 점은 양 끝점에서 같은 거리에 있다.','5번: 두 변과 그 끼인각이 각각 같으면 SAS 합동이다.','6번: 합동 기호의 순서에서 B와 E가 대응한다.','7번: 밑각이 각각 52도이므로 꼭지각은 76도이다.','8번: 외각은 이웃하지 않은 두 내각의 합으로 45도+65도=110도이다.']:b.add('normal',[('t',x)])
  b.add('essay',[('t','9번 채점 기준 [16점]')]);b.add('normal',[('t','밑각이 같은 이등변삼각형임을 사용: 4점. '),('e',r'52^{\circ}+52^{\circ}+x^{\circ}=180^{\circ}'),('t','를 세움: 6점. '),('e','x=76'),('t','을 구함: 6점. 답만 쓰면 4점.')]);b.add('essay',[('t','10번 채점 기준 [20점]')]);b.add('normal',[('t','대응 관계 설정: 4점. 두 변과 그 끼인각이 각각 같으므로 SAS 합동: 10점. 대응변이므로 '),('e',r'\bar{\mathrm{AC}}=\bar{\mathrm{DF}}'),('t',': 6점. 합동만 쓰고 결론이 없으면 최대 14점.')])
 for off,p in enumerate(list(scratch)):parent.insert(idx+off,p)
 files['Contents/section0.xml']=E.tostring(sec,xml_declaration=True,encoding='UTF-8');data=DIAGRAM.read_bytes();files['BinData/MathGraph-Q3.png']=data;pack=E.fromstring(files['Contents/content.hpf']);man=pack.find('opf:manifest',NS);man.append(E.Element(E.QName(OPF,'item'),id='mathgraph_q3',href='BinData/MathGraph-Q3.png',**{'media-type':'image/png','isEmbeded':'1','hashkey':base64.b64encode(hashlib.md5(data).digest()).decode()}));files['Contents/content.hpf']=E.tostring(pack,xml_declaration=True,encoding='UTF-8')
 with ZipFile(dest,'w',ZIP_DEFLATED) as z:
  for n,d in files.items():z.writestr(n,d,compress_type=ZIP_STORED if n=='mimetype' else ZIP_DEFLATED)

def pdf(dest,title,lines,image=False):
 pdfmetrics.registerFont(TTFont('Malgun',r'C:\Windows\Fonts\malgun.ttf'));w,h=landscape((364*mm,257*mm));c=Canvas(str(dest),pagesize=(w,h));c.setTitle(title);y=h-20*mm;c.setFont('Malgun',17);c.drawCentredString(w/2,y,title);y-=16*mm;c.setFont('Malgun',11)
 for line in lines:
  if line=='[새쪽]':c.showPage();y=h-20*mm;c.setFont('Malgun',11);continue
  if line=='[그림]':c.drawImage(str(DIAGRAM),25*mm,y-48*mm,width=80*mm,height=48*mm,preserveAspectRatio=True);y-=55*mm;continue
  if y<25*mm:c.showPage();y=h-20*mm;c.setFont('Malgun',11)
  c.drawString(20*mm,y,line);y-=8*mm
 c.showPage();c.save()
def main():
 if not DIAGRAM.exists():raise SystemExit('MathGraph 그림을 찾지 못했습니다.')
 build(STUDENT);build(TEACHER,True)
 student=['1. 다음 중 두 끝점을 모두 가지는 도형은? [8점]','① 직선  ② 반직선  ③ 각  ④ 선분  ⑤ 평면','2. 한 각이 64°일 때, 맞꼭지각의 크기는? [8점]','①26°  ②64°  ③116°  ④128°  ⑤180°','3. 다음 그림에서 l∥m일 때, 표시한 두 각의 관계로 옳은 것은? [8점]','[그림]','① 엇각·보각  ② 동위각·같음  ③ 맞꼭지각·같음  ④ 내대각·보각  ⑤ 관계 없음','4. 선분 AB의 수직이등분선 위의 점 P에 대하여 항상 옳은 것은? [8점]','① AP>BP  ② AP=BP  ③ AP<BP  ④ AB=AP  ⑤ AB=BP','[새쪽]','5. 두 삼각형이 합동임을 보이기에 충분한 조건은? [8점]','① 한 변과 한 각  ② 두 각  ③ 세 각  ④ 두 변과 그 끼인각  ⑤ 한 변과 양 끝각','6. △ABC≅△DEF일 때, 대응하는 각은? [8점]','① ∠A=∠E  ② ∠B=∠D  ③ ∠B=∠E  ④ ∠C=∠E  ⑤ ∠C=∠D','7. AB=AC, ∠B=52°일 때 ∠A의 크기는? [8점]','①52°  ②76°  ③90°  ④104°  ⑤128°','8. ∠B=45°, ∠C=65°일 때 A에서의 외각은? [8점]','①70°  ②90°  ③100°  ④110°  ⑤135°','[새쪽]','9. AB=AC, ∠B=52°일 때 ∠A=x°의 값을 구하는 과정을 쓰시오. [16점]','____________________________________________________________________________','____________________________________________________________________________','____________________________________________________________________________','____________________________________________________________________________','10. AB=DE, BC=EF, ∠B=∠E일 때 합동을 설명하고 AC와 같은 길이를 쓰시오. [20점]','____________________________________________________________________________','____________________________________________________________________________','____________________________________________________________________________','____________________________________________________________________________']
 teacher=['선택형 정답: ①④  ②②  ③②  ④②  ⑤④  ⑥③  ⑦②  ⑧④','1번 선분은 두 끝점을 모두 가진다.','2번 맞꼭지각은 서로 크기가 같다.','3번 평행선의 동위각은 서로 크기가 같다.','4번 수직이등분선 위의 점은 양 끝점에서 같은 거리에 있다.','5번 두 변과 그 끼인각이 각각 같으면 SAS 합동이다.','6번 합동 기호 순서에서 B와 E가 대응한다.','7번 꼭지각은 180°−52°−52°=76°이다.','8번 외각은 45°+65°=110°이다.','9번 [16점] 밑각 사용 4점, 52°+52°+x°=180° 6점, x=76 6점. 답만 4점.','10번 [20점] 대응 관계 4점, SAS 합동 10점, AC=DF 결론 6점. 합동만 최대 14점.']
 pdf(SPDF,'2026학년도 2학기 1차 지필평가 검토용',student,True);pdf(TPDF,'정답·해설 및 채점 기준',teacher)
if __name__=='__main__':main()
