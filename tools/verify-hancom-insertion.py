"""Opt-in Windows integration test: bodies are read only from this run's new documents."""
from pathlib import Path
import json
import sys
import uuid
import xml.etree.ElementTree as ET
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'runtime' / 'hancom'))
from hancom import Hancom
from model import prepare_insert

root=Path(__file__).resolve().parents[1]
output=root/'output/hancom-qa'/uuid.uuid4().hex[:8]
output.mkdir(parents=True)
adapter=Hancom()
adapter.list_documents()  # Only titles/identities from existing documents.
app=next(iter(adapter.documents.values()))[0] if adapter.documents else adapter._new_hwp()
doc=app.XHwpDocuments.Add(False)
adapter.activate(app,doc)
adapter._text(app,'보존할 시험 문서')
adapter._equation(app,'a^2+b^2=c^2',11)
print('created preservation fixture',flush=True)

# Both surrounding text and a different open document must survive.
original_xml=app.GetTextFile('HWPML2X','')
(output/'before.xml').write_text(original_xml,encoding='utf-8')
target_doc=app.XHwpDocuments.Add(False)
adapter.activate(app,target_doc)
char=app.HParameterSet.HCharShape
app.HAction.GetDefault('CharShape',char.HSet)
char.Height=1300
assert app.HAction.Execute('CharShape',char.HSet)
adapter._text(app,'앞문단')
adapter._break(app)
caret=tuple(app.GetPos())
adapter._text(app,'뒷문단')
assert app.SetPos(*caret)
target_id=int(target_doc.DocumentID)
listed=adapter.list_documents()
identity=next(identity for identity,data in adapter.documents.items() if data[0]._oleobj_==app._oleobj_ and int(data[1].DocumentID)==target_id)
count_before=app.XHwpDocuments.Count
payload={'requestId':uuid.uuid4().hex,'documentId':identity,'number':'3','fontSize':0,
         'paragraphs':[{'kind':'body','segments':[{'kind':'text','value':'중간에 넣은 함수 '},{'kind':'equation','value':'y=x^2'}]},
                       {'kind':'condition','segments':[{'kind':'text','value':'(가) '},{'kind':'equation','value':'x>0'}]}],'diagram':None}
print('inserting into owned target',flush=True)
result=adapter.insert(prepare_insert(payload))
assert app.XHwpDocuments.Count==count_before,'준비 문서가 남았습니다.'
adapter.activate(app,target_doc)
text=app.GetTextFile('TEXT','')
assert text.index('앞문단') < text.index('중간에 넣은 함수') < text.index('뒷문단'), repr(text)
target_xml=app.GetTextFile('HWPML2X','')
assert target_xml.count('<EQUATION ')==2
assert 'BaseUnit="1300"' in target_xml,'커서의 글자 크기를 따르지 않았습니다.'
print('insertion and native equations verified',flush=True)
adapter.activate(app,doc)
after_xml=app.GetTextFile('HWPML2X','')
(output/'after.xml').write_text(after_xml,encoding='utf-8')
assert ET.tostring(ET.fromstring(after_xml).find('BODY'))==ET.tostring(ET.fromstring(original_xml).find('BODY')), '다른 문서 본문이 바뀌었습니다.'
print('other owned document unchanged',flush=True)
assert app.SaveAs(str(output/'보존-검증.hwpx'),'HWPX','')
adapter.activate(app,target_doc)
assert app.SaveAs(str(output/'커서-삽입-검증.hwpx'),'HWPX','')
assert app.CreatePageImage(str(output/'커서-삽입-검증.bmp'),0,120,24,'bmp')
print(json.dumps({'cursorOrder':'앞문단 → 문제 → 뒷문단','otherDocumentUnchanged':True,'inheritedFontPt':13,'scratchRemoved':True,'output':str(output),'result':result},ensure_ascii=False))
