"""Verify the native 10 mm diagram-label text box in an isolated Hancom app."""
import base64
import json
from pathlib import Path
import sys
import uuid
import xml.etree.ElementTree as ET
import zipfile

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'runtime' / 'hancom'))

from hancom import DIAGRAM_LABEL_BOX_SIZE, Hancom
from model import prepare_insert


output = root / 'output' / 'hancom-qa' / ('label-box-' + uuid.uuid4().hex[:8])
output.mkdir(parents=True)
png = 'data:image/png;base64,' + (
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP+RCPnigAAAABJRU5ErkJggg=='
)
payload = {
    'requestId': 'label-box-' + uuid.uuid4().hex,
    'documentId': 'new', 'number': '', 'fontSize': 11, 'paragraphs': [],
    'diagram': {'png': png, 'widthMm': 40, 'aspect': 1,
                'labels': [{'text': r'\mathrm{E}', 'x': .5, 'y': .5,
                            'fontSize': .03}]},
}
prepared = prepare_insert(payload)
adapter = Hancom()
hwp = adapter._new_hwp()
document = hwp.XHwpDocuments.Add(False)
adapter.activate(hwp, document)
adapter.scratch = (hwp, int(document.DocumentID))
# This test owns the HwpObject and document, and keeps it off-screen.
hwp.XHwpWindows.Active_XHwpWindow.Visible = False
adapter._compose(hwp, prepared)

target = output / '라벨-상자-검증.hwpx'
assert hwp.SaveAs(str(target), 'HWPX', '')
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
    for entry in archive.infolist():
        if entry.filename.endswith('.xml'):
            ET.fromstring(archive.read(entry))
    section = archive.read('Contents/section0.xml').decode('utf-8')

assert f'width="{DIAGRAM_LABEL_BOX_SIZE}" widthRelTo="ABSOLUTE"' in section
assert f'height="{DIAGRAM_LABEL_BOX_SIZE}" heightRelTo="ABSOLUTE"' in section
assert '<hp:lineShape color="#000000" width="0" style="NONE"' in section
assert '<hp:drawText ' in section
assert '<hp:script>{rm E} it</hp:script>' in section
assert 'treatAsChar="0"' in section and 'textWrap="IN_FRONT_OF_TEXT"' in section
with zipfile.ZipFile(target) as archive:
    header = archive.read('Contents/header.xml').decode('utf-8')
assert '<hh:align horizontal="CENTER" vertical="BASELINE"/>' in header
receipt = {'file': str(target), 'boxSizeHwpUnit': DIAGRAM_LABEL_BOX_SIZE,
           'boxSizeMm': DIAGRAM_LABEL_BOX_SIZE * 25.4 / 7200,
           'nativeEquation': '{rm E} it'}
(output / 'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(receipt, ensure_ascii=False))
document.Close(False)
hwp.Quit()
