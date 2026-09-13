"""Small reusable authoring surface for the preserved school template.

Use text/equation parts, explicit choice rows, real MathGraph diagram exports.
Do not infer mathematical correctness from successful generation.
"""
from pathlib import Path
from zipfile import ZipFile
from lxml import etree as E
import importlib,sys,re
from equations import to_hwp
from diagram_writer import compose_inline_diagram
from native_session import OwnedHwp,require
HH={'hh':'http://www.hancom.co.kr/hwpml/2011/head'}
HP={'hp':'http://www.hancom.co.kr/hwpml/2011/paragraph'}
MATH_TEXT=re.compile(r'[A-Za-z0-9=+<>×÷±≤≥≠√π∠△°$\\]')
STATEMENT_STYLE='<보기>, 다음 상자 안 문장'
STATEMENT_LABELS='ㄱㄴㄷㄹㅁㅂㅅㅇ'
POINT_TYPES={'point','intersection','midpoint','pointOnLine','pointOnCircle','circleCenterPoint'}

def point_label_name(value):
    match=re.fullmatch(r'\\mathrm\{([A-Za-z][A-Za-z0-9]*)\}',value or '')
    return match.group(1) if match else value

class NativeDocument:
    def __init__(self, prepared=None, mathgraph_root='C:/Users/pbj95/Desktop/mathGraph'):
        self.prepared=Path(prepared).resolve() if prepared else None
        self.skill_root=Path(__file__).resolve().parents[1]
        self.runtime=Path(mathgraph_root)/'runtime/hancom'
        self.session=OwnedHwp();self.styles={};self.writer=None;self.h=None
        self.column_width_mm=112.0;self._question_count=0;self._layout_fresh=True
        if self.prepared:
            with ZipFile(self.prepared) as z:
                header=E.fromstring(z.read('Contents/header.xml'))
                section=E.fromstring(z.read('Contents/section0.xml'))
            self.styles={s.get('name'):i for i,s in enumerate(header.findall('.//hh:style',HH))}
            page=section.find('.//hp:pagePr',HP);columns=section.findall('.//hp:colPr[@colCount="2"]',HP)
            if page is not None and columns:
                margin=page.find('hp:margin',HP);gap=int(columns[-1].get('sameGap','0'))
                usable=int(page.get('width'))-int(margin.get('left'))-int(margin.get('right'))-int(margin.get('gutter','0'))
                self.column_width_mm=((usable-gap)/2)*25.4/7200

    def __enter__(self):
        self.session.__enter__()
        try:
            if self.prepared:self.session.open(self.prepared)
            self.h=self.session.h
            if not (self.runtime/'hancom.py').is_file():raise RuntimeError('MathGraph 한글 입력 모듈을 찾지 못했습니다.')
            sys.path.insert(0,str(self.runtime))
            from hancom import Hancom
            self.writer=Hancom()
            self.writer.scratch=(self.h,int(self.h.XHwpDocuments.Active_XHwpDocument.DocumentID))
            return self
        except BaseException:
            self.__exit__(*sys.exc_info());raise

    def __exit__(self,*args):
        self.writer=None;self.h=None
        return self.session.__exit__(*args)

    def _ready(self):
        self.session.check();self.writer._check_write_target(self.h)

    def style(self,name='바탕글'):
        self._ready()
        if self.prepared:
            if name not in self.styles:raise ValueError('원본에 없는 스타일: '+name)
            index=self.styles[name]
            if index<10:
                require(self.h.HAction.Run('StyleShortcut'+str(index+1)),'원본 스타일 적용')
            else:
                p=self.h.HParameterSet.HStyle;self.h.HAction.GetDefault('StyleEx',p.HSet);p.Apply=index
                require(self.h.HAction.Execute('StyleEx',p.HSet),'원본 스타일 적용')
        elif name!='바탕글':raise ValueError('교사용 기본 문서에는 문항 자동 번호 스타일이 없습니다.')
        c=self.h.HParameterSet.HCharShape;self.h.HAction.GetDefault('CharShape',c.HSet);c.Height=1100
        require(self.h.HAction.Execute('CharShape',c.HSet),'본문 글자 크기 적용')

    def body_start(self):
        self._ready();require(self.h.HAction.Run('MoveDocBegin'),'문서 처음으로 이동')
        self._find_and_delete('{{BODY}}','본문 작성 위치 찾기');self.style()
        self._question_count=0;self._layout_fresh=True

    def _find_and_delete(self,text,operation):
        p=self.h.HParameterSet.HFindReplace;self.h.HAction.GetDefault('RepeatFind',p.HSet)
        p.FindString=text;p.Direction=0;p.IgnoreMessage=1
        require(self.h.HAction.Execute('RepeatFind',p.HSet),operation)
        require(self.h.HAction.Run('Delete'),operation+' 표시자 제거')

    def parts(self,parts,metadata=False):
        self._ready()
        for kind,value in parts:
            if not isinstance(value,str):raise ValueError('문단 조각은 문자열이어야 합니다.')
            if kind in ('eq','e'):
                self.writer._equation(self.h,to_hwp(value),11)
            elif kind in ('text','t'):
                if not metadata and MATH_TEXT.search(value):raise ValueError('수학 표현은 수식 조각으로 분리하세요: '+value)
                if '\t' in value or '\n' in value or '\r' in value:raise ValueError('문단과 선택지 행은 별도 메서드로 나누세요.')
                self.writer._text(self.h,value)
            else:raise ValueError('문단 조각 종류는 text 또는 eq입니다.')

    def paragraph(self,style='바탕글'):
        self._ready();self.writer._break(self.h);self.style(style)

    def line(self,parts,style='바탕글',metadata=False):
        self.style(style);self.parts(parts,metadata);self.paragraph();self._layout_fresh=False

    def question(self,parts,points,kind='mc'):
        if kind not in ('mc','essay'):raise ValueError('문항 종류를 확인하세요.')
        if isinstance(points,bool) or not isinstance(points,(int,float)) or points<=0:raise ValueError('양수 배점이 필요합니다.')
        if self._question_count and not self._layout_fresh:
            self.style();self.writer._break(self.h)
        self.style('선택형문항(번호자동부여)' if kind=='mc' else '논술형문항(번호자동부여)')
        self.parts(parts);self.parts([('text',f' [{points:g}점]')],metadata=True);self.paragraph()
        self._question_count+=1;self._layout_fresh=False

    def choices(self,choices,rows=(5,)):
        if len(choices)!=5 or len(rows) not in (1,2,3,5) or any(type(n)!=int or n<1 for n in rows) or sum(rows)!=5:raise ValueError('다섯 보기를 1·2·3·5행으로 배정하세요.')
        if len(rows)==5 and tuple(rows)!=(1,1,1,1,1):raise ValueError('5행 선택지는 한 행에 보기 하나입니다.')
        at=0
        for count in rows:
            self.style(f'{len(rows)}행 선택지')
            for col in range(count):
                if col:self.writer._text(self.h,'\t')
                self.writer._text(self.h,'①②③④⑤'[at]+' ');self.parts(choices[at]);at+=1
            self.paragraph()
        self._layout_fresh=False

    def statement_box(self,statements,labels=None):
        if not isinstance(statements,(list,tuple)) or not 1<=len(statements)<=len(STATEMENT_LABELS):
            raise ValueError('보기 상자에는 1~8개의 문장을 넣으세요.')
        if any(not isinstance(parts,(list,tuple)) or not parts for parts in statements):
            raise ValueError('보기 상자의 각 문장은 text/eq 조각 목록이어야 합니다.')
        labels=list(labels) if labels is not None else list(STATEMENT_LABELS[:len(statements)])
        if len(labels)!=len(statements) or any(not isinstance(label,str) or not label.strip() for label in labels):
            raise ValueError('보기 문장 수와 기호 수를 맞추세요.')
        fragment=self.skill_root/'assets/statement-box.hwpx'
        if not fragment.is_file():raise RuntimeError('보기 상자 원본 조각을 찾지 못했습니다.')
        insertion=tuple(self.h.GetPos())
        p=self.h.HParameterSet.HInsertFile;self.h.HAction.GetDefault('InsertFile',p.HSet)
        for key,value in {'FileName':str(fragment),'FileFormat':'HWPX','FileArg':'','KeepSection':0,'KeepCharshape':1,'KeepParashape':1,'KeepStyle':0,'MoveNextPos':1}.items():p.HSet.SetItem(key,value)
        require(self.h.HAction.Execute('InsertFile',p.HSet),'원본 보기 상자 삽입')
        table_anchor=None;ctrl=self.h.HeadCtrl
        while ctrl is not None:
            if ctrl.CtrlID=='tbl':
                try:
                    anchor=ctrl.GetAnchorPos(0);position=tuple(anchor.Item(key) for key in ('List','Para','Pos')) if anchor is not None else None
                except Exception:
                    position=None
                if position is not None and position[0]==insertion[0] and position[1]>=insertion[1] and (table_anchor is None or position<table_anchor):table_anchor=position
            ctrl=ctrl.Next
        if table_anchor is not None and table_anchor[1]==insertion[1]+1:
            require(self.h.SetPos(*insertion),'보기 상자 앞 문단 위치 이동')
            require(self.h.HAction.Run('MoveParaEnd'),'보기 상자 앞 문단 끝 확인')
            if tuple(self.h.GetPos())==insertion:
                require(self.h.SetPos(*insertion),'보기 상자 앞 빈 문단 위치 이동')
                require(self.h.HAction.Run('Delete'),'보기 상자 앞 빈 문단 제거')
        require(self.h.SetPos(*insertion),'보기 상자 시작 위치 이동')
        self._find_and_delete('{{PBJ_STATEMENT_BOX}}','보기 상자 내용 위치 찾기')
        self.style(STATEMENT_STYLE)
        for index,(label,parts) in enumerate(zip(labels,statements)):
            self.writer._text(self.h,' '+label.rstrip('.')+'. ');self.parts(parts)
            if index+1<len(statements):self.paragraph(STATEMENT_STYLE)
        require(self.h.SetPos(*insertion),'보기 상자 뒤 위치 이동')
        self._find_and_delete('{{PBJ_STATEMENT_BOX_END}}','보기 상자 뒤 위치 찾기')
        self.style();self._layout_fresh=False

    def space(self,lines=1):
        if type(lines)!=int or not 0<=lines<=60:raise ValueError('풀이 공간의 줄 수를 확인하세요.')
        self.style()
        for _ in range(lines):self.writer._break(self.h)
        if lines:self._layout_fresh=True

    def new_column(self):
        self.style();require(self.h.HAction.Run('BreakColumn'),'단 나눔');self._layout_fresh=True

    def new_page(self):
        self.style();require(self.h.HAction.Run('BreakPage'),'쪽 나눔');self._layout_fresh=True

    def diagram(self,export):
        from model import prepare_insert
        self.style()
        diagram=export.get('diagram',export)
        prepared=prepare_insert({'requestId':'exam-diagram-native','documentId':'new','number':'','fontSize':11,'paragraphs':[],'diagram':diagram})
        raw_labels=diagram.get('labels',[])
        if len(raw_labels)!=len(prepared['labels']):raise RuntimeError('MathGraph 라벨 변환 수가 맞지 않습니다.')
        point_names={o.get('label') for o in export.get('project',[]) if o.get('type') in POINT_TYPES and o.get('showLabel') is not False and o.get('label')}
        for raw,label in zip(raw_labels,prepared['labels']):
            label['is_point']=point_label_name(raw.get('text')) in point_names
            label['font_pt']=13 if label['is_point'] else 11
        receipt=compose_inline_diagram(self.h,self.writer,prepared,self.column_width_mm)
        if not hasattr(self,'diagram_receipts'):self.diagram_receipts=[]
        self.diagram_receipts.append(receipt)
        self.style();self._layout_fresh=False

    def save(self,path):
        path=Path(path).resolve()
        if path.exists():raise FileExistsError('기존 최종 파일을 덮어쓰지 않습니다: '+str(path))
        self.session.save(path)
