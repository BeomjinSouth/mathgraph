"""Validate the complete insertion before connecting to a document."""
import base64
import math
import re
import struct
from equations import to_hwp


def finite(value, low, high, label):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
        raise ValueError(label + ' 값이 올바르지 않습니다.')
    return value


def prepare_insert(value):
    if not isinstance(value, dict) or set(value) - {'requestId', 'documentId', 'number', 'paragraphs', 'diagram', 'fontSize'}:
        raise ValueError('입력 자료 형식이 올바르지 않습니다.')
    if not re.fullmatch(r'[A-Za-z0-9_-]{8,100}', str(value.get('requestId', ''))):
        raise ValueError('요청 번호가 올바르지 않습니다.')
    document_id = value.get('documentId')
    if not isinstance(document_id, str) or not document_id or len(document_id) > 100:
        raise ValueError('입력할 한글 문서를 선택해 주세요.')
    number = value.get('number', '')
    if not isinstance(number, str) or not re.fullmatch(r'\d{0,4}', number):
        raise ValueError('문제 번호를 확인해 주세요.')
    raw_font_size = value.get('fontSize', 0)
    font_size = 0 if type(raw_font_size) in (int, float) and raw_font_size == 0 else finite(raw_font_size, 8, 20, '글자 크기')
    paragraphs = value.get('paragraphs', [])
    if not isinstance(paragraphs, list) or len(paragraphs) > 100:
        raise ValueError('한 번에 문제 한 개씩 입력해 주세요.')
    result = {'documentId': document_id, 'number': number, 'fontSize': font_size, 'paragraphs': [], 'diagram': None}
    total = 0
    equation_count = 0
    for paragraph in paragraphs:
        if not isinstance(paragraph, dict) or paragraph.get('kind') not in ('body', 'condition', 'choice'):
            raise ValueError('문단 형식을 확인해 주세요.')
        parts = paragraph.get('segments')
        if not isinstance(parts, list) or len(parts) > 300:
            raise ValueError('문단이 너무 깁니다.')
        output = []
        for part in parts:
            if not isinstance(part, dict) or part.get('kind') not in ('text', 'equation') or not isinstance(part.get('value'), str):
                raise ValueError('본문과 수식을 구분할 수 없습니다.')
            text = part['value']
            total += len(text)
            if total > 30000:
                raise ValueError('한 번에 문제 한 개씩 입력해 주세요.')
            if part['kind'] == 'equation':
                text = to_hwp(text)
                equation_count += 1
            elif re.search(r'[A-Za-z0-9=+<>×÷±≤≥≠√π∠△°$\\\x00-\x08\x0b-\x1f]', text):
                raise ValueError('본문의 숫자와 수학 표현은 수식으로 입력해야 합니다.')
            output.append({'kind': part['kind'], 'value': text})
        result['paragraphs'].append({'kind': paragraph['kind'], 'segments': output})
    diagram = value.get('diagram')
    if diagram is not None:
        if not isinstance(diagram, dict):
            raise ValueError('그림 정보가 올바르지 않습니다.')
        width = finite(diagram.get('widthMm'), 40, 160, '그림 폭')
        aspect = finite(diagram.get('aspect'), .05, 4, '그림 비율')
        if width * aspect > 230:
            raise ValueError('그림이 한 쪽보다 깁니다. 그림 폭을 줄여 주세요.')
        encoded = diagram.get('png', '')
        if not isinstance(encoded, str) or not encoded.startswith('data:image/png;base64,') or len(encoded) > 12000000:
            raise ValueError('PNG 그림이 없거나 너무 큽니다.')
        try:
            png = base64.b64decode(encoded.split(',', 1)[1], validate=True)
        except ValueError as error:
            raise ValueError('그림 데이터를 읽을 수 없습니다.') from error
        if png[:8] != b'\x89PNG\r\n\x1a\n' or len(png) < 33 or png[12:16] != b'IHDR':
            raise ValueError('올바른 PNG 그림이 아닙니다.')
        pixel_w, pixel_h = struct.unpack('>II', png[16:24])
        if not pixel_w or not pixel_h or pixel_w * pixel_h > 40000000 or abs(pixel_h / pixel_w - aspect) > .02:
            raise ValueError('그림 크기와 비율을 확인해 주세요.')
        raw_labels = diagram.get('labels', [])
        if not isinstance(raw_labels, list) or len(raw_labels) > 300:
            raise ValueError('그림의 라벨이 너무 많습니다.')
        labels = []
        for label in raw_labels:
            if not isinstance(label, dict):
                raise ValueError('그림 라벨이 올바르지 않습니다.')
            labels.append({
                'script': to_hwp(label.get('text')),
                'x': finite(label.get('x'), 0, 1, '라벨 위치'),
                'y': finite(label.get('y'), 0, aspect, '라벨 위치'),
                'fontSize': finite(label.get('fontSize'), .001, .3, '라벨 크기')
            })
        equation_count += len(labels)
        result['diagram'] = {'png': png, 'widthMm': width, 'aspect': aspect, 'labels': labels}
    if not result['paragraphs'] and not result['diagram']:
        raise ValueError('입력할 문제나 그림이 없습니다.')
    if equation_count > 500:
        raise ValueError('수식이 너무 많습니다. 한 번에 문제 한 개씩 입력해 주세요.')
    result['equationCount'] = equation_count
    return result
