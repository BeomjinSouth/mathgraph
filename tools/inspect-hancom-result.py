"""Opt-in QA: inspect only an explicitly identified, task-created Hancom window."""
import argparse
import json
from pathlib import Path
import sys
import uuid
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'runtime/hancom'))
from hancom import Hancom

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--window-handle',type=int,required=True)
args=parser.parse_args()
adapter=Hancom()
adapter.list_documents()  # Titles and identities only.
found=None
for app in adapter.apps.values():
    for index in range(app.XHwpWindows.Count):
        window=app.XHwpWindows.Item(index)
        if int(window.WindowHandle)==args.window_handle:
            if int(app.XHwpWindows.Active_XHwpWindow.WindowHandle)!=args.window_handle:
                raise RuntimeError('지정한 시험 창을 먼저 활성화해 주세요.')
            found=(app,app.XHwpDocuments.Active_XHwpDocument)
            break
    if found: break
if not found: raise RuntimeError('지정한 시험 창을 찾지 못했습니다.')
app,document=found
if document.FullName: raise RuntimeError('새로 생성한 이름 없는 시험 문서만 검사할 수 있습니다.')
adapter.activate(app,document)
xml=app.GetTextFile('HWPML2X','')
if '다음 물음에 답하시오.' not in xml: raise RuntimeError('예상한 합성 시험 문제가 아닙니다.')
output=Path(__file__).resolve().parents[1]/'output/hancom-qa'/uuid.uuid4().hex[:8]
output.mkdir(parents=True)
assert app.SaveAs(str(output/'문제와-수식-검증.hwpx'),'HWPX','')
assert app.CreatePageImage(str(output/'문제와-수식-검증.bmp'),0,120,24,'bmp')
(output/'document.xml').write_text(xml,encoding='utf-8')
print(json.dumps({'equations':xml.count('<EQUATION '),'pictures':xml.count('<PICTURE '),
                  'pages':app.PageCount,'output':str(output)},ensure_ascii=False))
