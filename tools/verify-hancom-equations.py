"""Create owned Hancom fixtures to inspect equation scope and photo recognition.

Uses the adapter's documented EquationCreate/EqEdit and CreatePageImage paths.
Only documents created by this run are read, saved, or rendered.
"""
import json
from pathlib import Path
import sys
import uuid
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'runtime' / 'hancom'))
from hancom import Hancom
from model import prepare_insert

output = root / 'output' / 'hancom-qa' / ('equation-scope-' + uuid.uuid4().hex[:8])
output.mkdir(parents=True)
adapter = Hancom()


def text(value):
    return {'kind': 'text', 'value': value}


def equation(value):
    return {'kind': 'equation', 'value': value}


def create_fixture(stem, paragraphs, number='', font_size=14):
    result = adapter.insert(prepare_insert({
        'requestId': uuid.uuid4().hex, 'documentId': 'new', 'number': number,
        'fontSize': font_size, 'paragraphs': paragraphs, 'diagram': None,
    }))
    hwp, document, _ = adapter.documents[result['documentId']]
    identity = int(document.DocumentID)
    if document.FullName:
        raise RuntimeError('새로 만든 이름 없는 시험 문서가 아닙니다.')
    adapter.activate(hwp, document)
    if int(hwp.XHwpDocuments.Active_XHwpDocument.DocumentID) != identity:
        raise RuntimeError('시험 문서가 전환되었습니다.')
    xml = hwp.GetTextFile('HWPML2X', '')
    scripts = [element.text for element in ET.fromstring(xml).iter('SCRIPT')]
    assert len(scripts) == result['equationCount']
    assert hwp.SaveAs(str(output / (stem + '.hwpx')), 'HWPX', '')
    assert hwp.CreatePageImage(str(output / (stem + '.bmp')), 0, 160, 24, 'bmp')
    (output / (stem + '.xml')).write_text(xml, encoding='utf-8')
    return {'file': stem, 'scripts': scripts, 'pages': int(hwp.PageCount),
            'windowHandle': int(hwp.XHwpWindows.Active_XHwpWindow.WindowHandle)}


cases = [
    ('지수 뒤 덧셈', 'y=-x^2+4'),
    ('분수 뒤 곱셈과 덧셈', r'y=\frac{1}{2}x^2+3'),
    ('아래첨자 뒤 덧셈', 'a_n+1'),
    ('여러 항의 첨자', 'x_{n+1}^2+3'),
    ('그리스 문자 지수', r'x^\alpha+1'),
    ('유니코드 지수와 문자', 'πr²+1'),
    ('중첩 분수', r'\frac{1}{\frac{2}{3}}+4'),
    ('삼차근과 지수', r'\sqrt[3]{x^2+1}+2'),
    ('합의 위아래 첨자', r'\sum_{i=1}^n i^2+1'),
]
scope = create_fixture('수식-범위-검증', [
    {'kind': 'body', 'segments': [text(label + '  '), equation(value)]}
    for label, value in cases
])
problem = create_fixture('문제-사진-검증', [
    {'kind': 'body', 'segments': [text('이차함수 '), equation('y=-x^2+4'),
        text('의 그래프를 그리고, 그래프가 '), equation('x'),
        text('축과 만나는 두 점 사이의 거리를 구하시오.')]},
    {'kind': 'choice', 'segments': [text('① '), equation(r'\frac{1}{2}'),
        text('    ② '), equation(r'\sqrt{3}'), text('    ③ '), equation('2'),
        text('    ④ '), equation('4'), text('    ⑤ '), equation('8')]},
], number='2')
print(json.dumps({'output': str(output), 'scope': scope, 'problem': problem}, ensure_ascii=False))
