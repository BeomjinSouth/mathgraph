"""Native Hancom adapter. Only self-created scratch documents are cleared/closed.

References: Hancom HwpAutomation (2025-04), Get/SetTextFile p24-25,
InsertPicture p26, XHwpDocuments p46-51; EqEdit p56, ShapeObject p126-128.
"""
from pathlib import Path
import tempfile
import time
import uuid


class Hancom:
    def __init__(self):
        try:
            import pythoncom
            import win32com.client
            import win32gui
        except ImportError as error:
            raise RuntimeError('한글 연결에 필요한 pywin32가 없습니다. 시작.cmd를 다시 실행해 주세요.') from error
        self.com = pythoncom
        self.win32 = win32com.client
        self.gui = win32gui
        pythoncom.CoInitialize()
        self.ids = {}
        self.apps = {}
        self.documents = {}
        self.created = []
        self.scratch = None

    def list_documents(self):
        context = self.com.CreateBindCtx(0)
        rot = self.com.GetRunningObjectTable()
        found = {}
        seen = set()
        failures = []
        active_apps = set()
        for moniker in rot.EnumRunning():
            name = ''
            try:
                name = moniker.GetDisplayName(context, moniker)
                if not name.startswith('!HwpObject.'):
                    continue
                active_apps.add(name)
                hwp = self.apps.get(name)
                if hwp is None:
                    raw = rot.GetObject(moniker).QueryInterface(self.com.IID_IDispatch)
                    hwp = self.win32.gencache.EnsureDispatch(raw)
                    self.apps[name] = hwp
                self._ensure_ready(hwp)
                for index in range(hwp.XHwpDocuments.Count):
                    doc = hwp.XHwpDocuments.Item(index)
                    if self.scratch and hwp._oleobj_ == self.scratch[0]._oleobj_ and int(doc.DocumentID) == self.scratch[1]:
                        continue
                    doc_key = (name, int(doc.DocumentID))
                    if doc_key in seen:
                        continue
                    seen.add(doc_key)
                    identity = self.ids.setdefault(doc_key, uuid.uuid4().hex)
                    title = str(doc.FullName or '').replace('\\', '/').rsplit('/', 1)[-1]
                    title = title or f'저장 전 문서 {len(found) + 1}'
                    found[identity] = (hwp, doc, title)
            except Exception:
                if name.startswith('!HwpObject.'):
                    failures.append(name)
                    self.apps.pop(name, None)
                    self.ids = {key: value for key, value in self.ids.items() if key[0] != name}
        if failures:
            raise RuntimeError('열린 한글 문서를 확인하지 못했습니다. 한글의 확인창을 닫고 다시 연결해 주세요.')
        for name in set(self.apps) - active_apps:
            del self.apps[name]
            self.ids = {key: value for key, value in self.ids.items() if key[0] != name}
        self.documents = found
        self.ids = {key: value for key, value in self.ids.items() if key in seen}
        titles = [data[2] for data in found.values()]
        result = []
        for key, (hwp, doc, title) in found.items():
            if titles.count(title) > 1:
                folder = str(doc.FullName).replace('\\', '/').rsplit('/', 2)[-2]
                title += ' · ' + folder
            active = int(hwp.XHwpDocuments.Active_XHwpDocument.DocumentID) == int(doc.DocumentID)
            result.append({'id': key, 'title': title, 'active': active})
        return result

    def _new_hwp(self):
        try:
            hwp = self.win32.DispatchEx('HWPFrame.HwpObject')
            context = self.com.CreateBindCtx(0)
            for moniker in self.com.GetRunningObjectTable().EnumRunning():
                name = moniker.GetDisplayName(context, moniker)
                if name.startswith('!HwpObject.') and name not in self.apps:
                    self.apps[name] = hwp
            # Use an already registered path-check module. Do not change registry,
            # disable prompts, or install a permissive security DLL.
            try:
                hwp.RegisterModule('FilePathCheckDLL', 'FilePathCheckerModule')
            except Exception:
                pass
            return hwp
        except Exception as error:
            raise RuntimeError('한컴오피스 한글을 실행할 수 없습니다. 설치 상태를 확인해 주세요.') from error

    def _text(self, hwp, text):
        self._check_write_target(hwp)
        if not text:
            return
        params = hwp.HParameterSet.HInsertText
        hwp.HAction.GetDefault('InsertText', params.HSet)
        params.Text = text
        if not hwp.HAction.Execute('InsertText', params.HSet):
            raise RuntimeError('한글 본문을 입력하지 못했습니다.')

    def _equation(self, hwp, script, font_size, floating=None):
        self._check_write_target(hwp)
        before_position = tuple(hwp.GetPos())
        params = hwp.HParameterSet.HEqEdit
        hwp.HAction.GetDefault('EquationCreate', params.HSet)
        params.string = script
        params.EqFontName = 'HancomEQN'
        params.BaseUnit = int(font_size * 100)
        params.Version = 'Equation Version 60'
        shape = {
            'TreatAsChar': 0 if floating else 1,
            'OutsideMarginLeft': 0, 'OutsideMarginRight': 0,
            'OutsideMarginTop': 0, 'OutsideMarginBottom': 0,
        }
        if floating:
            shape.update({
                'HorzRelTo': 3, 'VertRelTo': 2, 'HorzAlign': 0, 'VertAlign': 0,
                'HorzOffset': round(floating[0] * 7200 / 25.4),
                'VertOffset': round(floating[1] * 7200 / 25.4),
                'TextWrap': 3, 'FlowWithText': 0, 'AllowOverlap': 1
            })
        for key, value in shape.items():
            params.HSet.SetItem(key, value)
        # Create inline so the caret reliably advances past the new control.
        # Floating placement is applied to that verified control afterwards.
        params.HSet.SetItem('TreatAsChar', 1)
        if not hwp.HAction.Execute('EquationCreate', params.HSet):
            raise RuntimeError('한글 수식 개체를 만들지 못했습니다.')
        after_equation = tuple(hwp.GetPos())
        ctrl = hwp.HeadCtrl
        while ctrl is not None:
            if ctrl.CtrlID == 'eqed':
                anchor = ctrl.GetAnchorPos(0)
                if tuple(anchor.Item(key) for key in ('List', 'Para', 'Pos')) == before_position:
                    break
            ctrl = ctrl.Next
        if ctrl is None or ctrl.CtrlID != 'eqed':
            raise RuntimeError('생성된 수식 개체를 확인하지 못했습니다.')
        properties = ctrl.Properties
        for key, value in shape.items():
            properties.SetItem(key, value)
        ctrl.Properties = properties
        hwp.HAction.Run('Cancel')
        hwp.SetPos(*after_equation)

    def _break(self, hwp):
        self._check_write_target(hwp)
        if not hwp.HAction.Run('BreakPara'):
            raise RuntimeError('한글 문단을 추가하지 못했습니다.')

    def _ensure_ready(self, hwp):
        for index in range(hwp.XHwpWindows.Count):
            handle = int(hwp.XHwpWindows.Item(index).WindowHandle)
            if not self.gui.IsWindowEnabled(handle):
                raise RuntimeError('한글의 저장·파일 선택 등 확인창을 닫고 다시 시도해 주세요.')

    def _check_write_target(self, hwp):
        self._ensure_ready(hwp)
        if self.scratch and int(hwp.XHwpDocuments.Active_XHwpDocument.DocumentID) != self.scratch[1]:
            raise RuntimeError('작업 중 한글 문서가 바뀌었습니다. 원본에는 입력하지 않았습니다.')

    def activate(self, hwp, document):
        self._ensure_ready(hwp)
        expected = int(document.DocumentID)
        document.SetActive_XHwpDocument()
        deadline = time.monotonic() + 3
        while int(hwp.XHwpDocuments.Active_XHwpDocument.DocumentID) != expected:
            if time.monotonic() >= deadline:
                raise RuntimeError('한글 문서를 전환하지 못했습니다. 확인창을 닫고 다시 시도해 주세요.')
            self.com.PumpWaitingMessages()
            time.sleep(.02)
        self._ensure_ready(hwp)

    def _discard_scratch(self, hwp, document, document_id):
        self.activate(hwp, document)
        if int(document.DocumentID) != document_id:
            raise RuntimeError('준비 문서를 확인하지 못했습니다. 원본에는 입력하지 않았습니다.')
        # Clear creates another blank document and invalidates the old identity.
        # Close the exact owned document once, then wait for its removal.
        if not document.Close(False):
            raise RuntimeError('준비 문서를 닫지 못했습니다. 한글의 확인창을 확인해 주세요.')
        deadline = time.monotonic() + 3
        while any(int(hwp.XHwpDocuments.Item(i).DocumentID) == document_id
                  for i in range(hwp.XHwpDocuments.Count)):
            if time.monotonic() >= deadline:
                raise RuntimeError('준비 문서를 닫지 못했습니다. 원본에는 입력하지 않았습니다.')
            self.com.PumpWaitingMessages()
            time.sleep(.02)

    def _compose(self, hwp, prepared, inherited=None):
        self._check_write_target(hwp)
        if inherited:
            hwp.CharShape = inherited['char']
            hwp.ParaShape = inherited['para']
        font_size = prepared['fontSize'] or (inherited['char'].Item('Height') / 100 if inherited else 11)
        char = hwp.HParameterSet.HCharShape
        hwp.HAction.GetDefault('CharShape', char.HSet)
        char.Height = int(font_size * 100)
        hwp.HAction.Execute('CharShape', char.HSet)
        para = hwp.HParameterSet.HParaShape
        hwp.HAction.GetDefault('ParagraphShape', para.HSet)
        if not inherited:
            para.AlignType = 0
            para.LineSpacing = 160
            para.LineSpacingType = 0
        hwp.HAction.Execute('ParagraphShape', para.HSet)
        base_para = hwp.ParaShape.Clone()
        for index, paragraph in enumerate(prepared['paragraphs']):
            self._check_write_target(hwp)
            hwp.ParaShape = base_para.Clone()
            if paragraph['kind'] == 'condition':
                hwp.HAction.GetDefault('ParagraphShape', para.HSet)
                for side in ('Left', 'Right', 'Top', 'Bottom'):
                    setattr(para.BorderFill, 'BorderType' + side, 1)
                    setattr(para.BorderFill, 'BorderWidth' + side, 1)
                    setattr(para, 'BorderOffset' + side, 170)
                para.BorderConnect = 1
                hwp.HAction.Execute('ParagraphShape', para.HSet)
            if index == 0 and prepared['number']:
                self._text(hwp, prepared['number'] + '. ')
            for part in paragraph['segments']:
                if part['kind'] == 'equation':
                    self._equation(hwp, part['value'], font_size)
                else:
                    self._text(hwp, part['value'])
            self._break(hwp)
        hwp.ParaShape = base_para.Clone()
        diagram = prepared.get('diagram')
        if diagram:
            hwp.ParaShape = base_para.Clone()
            hwp.HAction.GetDefault('ParagraphShape', para.HSet)
            para.AlignType = 1
            para.Indentation = 0
            para.LeftMargin = 0
            hwp.HAction.Execute('ParagraphShape', para.HSet)
            anchor = tuple(hwp.GetPos())
            with tempfile.TemporaryDirectory(prefix='mathgraph-') as directory:
                path = Path(directory) / 'diagram.png'
                path.write_bytes(diagram['png'])
                self._check_write_target(hwp)
                picture = hwp.InsertPicture(str(path.resolve()), True, 1, False, False, 0, diagram['widthMm'], diagram['widthMm'] * diagram['aspect'])
                if picture is None:
                    raise RuntimeError('그림을 넣지 못했습니다. 한글의 파일 접근 확인창이 열려 있는지 확인해 주세요.')
                properties = picture.Properties
                for key, value in {'TreatAsChar': 1, 'OutsideMarginLeft': 0, 'OutsideMarginRight': 0, 'OutsideMarginTop': 0, 'OutsideMarginBottom': 0}.items():
                    properties.SetItem(key, value)
                picture.Properties = properties
                hwp.HAction.Run('Cancel')
                for label in diagram['labels']:
                    hwp.SetPos(*anchor)
                    size = max(5, min(24, label['fontSize'] * diagram['widthMm'] * 72 / 25.4))
                    self._equation(hwp, label['script'], size, (label['x'] * diagram['widthMm'], label['y'] * diagram['widthMm']))
                hwp.HAction.Run('MoveParaEnd')
                self._break(hwp)
        self._break(hwp)

    def insert(self, prepared):
        self.list_documents()
        target = None
        caret = None
        inherited = None
        if prepared['documentId'] != 'new':
            target = self.documents.get(prepared['documentId'])
            if target is None:
                raise ValueError('선택한 문서가 닫혔습니다. 문서 목록을 다시 확인해 주세요.')
            hwp, document, title = target
            self.activate(hwp, document)
            if int(hwp.EditMode) != 1:
                raise ValueError('선택한 한글 문서는 읽기 전용이거나 편집이 제한되어 있습니다.')
            if int(hwp.SelectionMode) & 15:
                raise ValueError('한글에서 선택 영역을 해제하고 커서를 놓은 뒤 다시 넣어 주세요.')
            caret = tuple(hwp.GetPos())
            inherited = {'char': hwp.CharShape.Clone(), 'para': hwp.ParaShape.Clone()}
        # Use a specific new document, never Clear/Quit a shared Hwp application.
        # Hancom can share one COM application across several document windows.
        if self.documents:
            scratch = target[0] if target else next(iter(self.documents.values()))[0]
            scratch_document = scratch.XHwpDocuments.Add(False)
        else:
            scratch = self._new_hwp()
            existing = scratch.XHwpDocuments.Item(0)
            if existing.FullName or scratch.IsModified:
                scratch_document = scratch.XHwpDocuments.Add(False)
            else:
                scratch_document = existing
        self.activate(scratch, scratch_document)
        scratch_id = int(scratch_document.DocumentID)
        self.scratch = (scratch, scratch_id)
        retained = False
        scratch_closed = False
        cleanup_attempted = False
        try:
            self._compose(scratch, prepared, inherited)
            # A native HWP stream preserves equations and relative-positioned labels.
            # Build it before mutating the user's document.
            content = scratch.GetTextFile('HWP', '')
            if not content:
                raise RuntimeError('준비한 문제의 한글 데이터를 읽지 못했습니다.')
            if target:
                cleanup_attempted = True
                self._discard_scratch(scratch, scratch_document, scratch_id)
                scratch_closed = True
                self.scratch = None
                self.list_documents()
                if prepared['documentId'] not in self.documents:
                    raise ValueError('선택한 문서가 닫혔습니다. 입력하지 않았습니다.')
                self.activate(hwp, document)
                if tuple(hwp.GetPos()) != caret or int(hwp.SelectionMode) & 15:
                    raise ValueError('한글의 커서 위치가 바뀌었습니다. 현재 위치를 확인한 뒤 다시 넣어 주세요.')
                if not hwp.SetTextFile(content, 'HWP', 'insertfile'):
                    raise RuntimeError('한글에 넣는 중 오류가 발생했습니다. 문서를 확인해 주세요.')
                hwp.XHwpWindows.Active_XHwpWindow.Visible = True
            else:
                self.activate(scratch, scratch_document)
                scratch.XHwpWindows.Active_XHwpWindow.Visible = True
                self.created.append(scratch)
                retained = True
                title = '새 한글 문서'
            self.scratch = None
            self.list_documents()
            document_id = prepared['documentId']
            if retained:
                document_id = next((identity for identity, data in self.documents.items()
                                    if data[0]._oleobj_ == scratch._oleobj_ and int(data[1].DocumentID) == scratch_id), None)
            return {'ok': True, 'documentId': document_id, 'title': title, 'equationCount': prepared['equationCount'], 'hasDiagram': bool(prepared['diagram'])}
        finally:
            self.scratch = None
            if not retained and not scratch_closed and not cleanup_attempted:
                try:
                    self._discard_scratch(scratch, scratch_document, scratch_id)
                    if target:
                        self.activate(hwp, document)
                except Exception:
                    pass
