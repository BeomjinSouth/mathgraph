"""Opt-in smoke test against newly created Hancom documents, never user files."""
from pathlib import Path
import json
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'runtime' / 'hancom'))
from hancom import Hancom
from model import prepare_insert

root = Path(__file__).resolve().parents[1]
adapter = Hancom()
original = adapter.list_documents()
print(json.dumps({'existingDocuments': len(original)}))
payload = {
    'requestId': 'live-smoke-20260905', 'documentId': 'new', 'number': '1', 'fontSize': 11,
    'paragraphs': [
        {'kind': 'body', 'segments': [
            {'kind': 'text', 'value': '함수 '}, {'kind': 'equation', 'value': 'y=-x^2+4'},
            {'kind': 'text', 'value': '의 그래프 위의 점 '}, {'kind': 'equation', 'value': 'A(1,3)'},
            {'kind': 'text', 'value': '에 대하여 다음 물음에 답하시오.'}
        ]},
        {'kind': 'choice', 'segments': [
            {'kind': 'text', 'value': '① '}, {'kind': 'equation', 'value': r'\frac{1}{2}'},
            {'kind': 'text', 'value': '    ② '}, {'kind': 'equation', 'value': r'\sqrt{3}'},
            {'kind': 'text', 'value': '    ③ '}, {'kind': 'equation', 'value': r'3\,\mathrm{cm}'}
        ]}
    ], 'diagram': None
}
fixture = root / 'output' / 'hancom-qa' / 'diagram.json'
if fixture.exists():
    payload['diagram'] = json.loads(fixture.read_text(encoding='utf-8-sig'))
result = adapter.insert(prepare_insert(payload))
print(json.dumps(result, ensure_ascii=False))
hwp = adapter.created[-1]
xml = hwp.GetTextFile('HWPML2X', '')
print(json.dumps({'equations': xml.count('<EQUATION '), 'pictures': xml.count('<PICTURE '), 'pages': hwp.PageCount}))
output = root / 'output' / 'hancom-qa' / '한글-입력-시험.hwpx'
if not hwp.SaveAs(str(output), 'HWPX', ''):
    raise RuntimeError('시험 결과 저장 실패')
print(str(output))
