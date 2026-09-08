import copy
import http.client
import json
from pathlib import Path
import sys
import threading
import unittest
from types import SimpleNamespace
from unittest.mock import Mock
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'runtime' / 'hancom'))
from bridge import BridgeServer
from model import prepare_insert
from equations import to_hwp
from hancom import Hancom

PAYLOAD = {'requestId':'regression-001','documentId':'new','number':'1','fontSize':11,
           'paragraphs':[{'kind':'body','segments':[{'kind':'text','value':'함수 '},
                         {'kind':'equation','value':r'y=\frac{1}{2}x^2'}]}], 'diagram':None}

class ModelTest(unittest.TestCase):
    def test_script_scope_preserves_following_terms(self):
        self.assertEqual(to_hwp('y=-x^2+4'), 'y=-x^{2}+4')
        self.assertEqual(to_hwp('a_n+1'), 'a_{n}+1')
        self.assertEqual(to_hwp('x_{n+1}^2+3'), 'x_{n+1}^{2}+3')
        self.assertEqual(to_hwp(r'x^\alpha+1'), 'x^{alpha}+1')
        self.assertEqual(to_hwp('x^θ+1'), 'x^{theta} +1')
        self.assertEqual(to_hwp('x²+4'), 'x^{2}+4')
        self.assertEqual(to_hwp(r'\frac{1}{2}x^2+3'), '{{1} over {2}}x^{2}+3')
        self.assertEqual(to_hwp(r'\frac{1}{\frac{2}{3}}+4'), '{{1} over {{{2} over {3}}}}+4')
    def test_missing_or_ambiguous_script_argument_is_rejected(self):
        for source in ('x^', 'x_', 'x^}', 'x^_2', 'x^-2'):
            with self.subTest(source=source), self.assertRaises(ValueError):
                to_hwp(source)
    def test_equations(self):
        self.assertEqual(to_hwp(r'\frac{\sqrt{3}}{2}'), '{{sqrt {3}} over {2}}')
        self.assertEqual(to_hwp(r'3\,\mathrm{cm}'), '3{rm cm} it')
        self.assertEqual(to_hwp(r'3\quad\mathrm{cm}'), '3{rm cm} it')
        self.assertEqual(to_hwp('πr²'), 'pi r^{2}')
        self.assertEqual(prepare_insert(PAYLOAD)['equationCount'], 1)
    def test_roman_geometry_and_parallel_without_style_leak(self):
        self.assertEqual(to_hwp(r'\bar{BC}\parallel\bar{DE}'), 'bar {rm BC} it\U000f005abar {rm DE} it')
        self.assertEqual(to_hwp(r'\mathrm{A}'), '{rm A} it')
        self.assertEqual(to_hwp(r'\mathrm{AB}+x'), '{rm AB} it +x')
        self.assertEqual(to_hwp(r'\mathrm{A\mathit{x}B}+y'), '{rm A{it x} rm B} it +y')
        self.assertEqual(to_hwp(r'\bar{x}+x'), 'bar {x}+x')
        self.assertEqual(to_hwp('BC+x'), 'BC+x')
    def test_unsupported_and_unbalanced(self):
        for value in (r'\unknown{x}', r'\frac{a}', r'\sqrt{x', 'x}'):
            with self.assertRaises(ValueError): to_hwp(value)
    def test_plain_math_and_paths_rejected_before_mutation(self):
        bad=copy.deepcopy(PAYLOAD)
        bad['paragraphs'][0]['segments'][0]['value']='길이 3 cm'
        with self.assertRaises(ValueError): prepare_insert(bad)
        bad=copy.deepcopy(PAYLOAD); bad['path']='C:/untrusted.hwp'
        with self.assertRaises(ValueError): prepare_insert(bad)
    def test_scores_remain_text_without_allowing_unwrapped_math(self):
        for score in ('[4점]', '(2.5점)'):
            payload = copy.deepcopy(PAYLOAD)
            payload['paragraphs'][0]['segments'][0]['value'] = '값을 구하시오. ' + score
            result = prepare_insert(payload)
            self.assertEqual(result['paragraphs'][0]['segments'][0]['value'], '값을 구하시오. ' + score)
            self.assertEqual(result['equationCount'], 1)
        for text in ('점 4개 [4점]', '[4cm]', '[4점]+2', '[4\x0b점]'):
            payload = copy.deepcopy(PAYLOAD)
            payload['paragraphs'][0]['segments'][0]['value'] = text
            with self.subTest(text=text), self.assertRaises(ValueError):
                prepare_insert(payload)
    def test_numeric_and_png_limits(self):
        inherited=copy.deepcopy(PAYLOAD); inherited['fontSize']=0
        self.assertEqual(prepare_insert(inherited)['fontSize'],0)
        for size in (float('nan'),True,200):
            bad=copy.deepcopy(PAYLOAD); bad['fontSize']=size
            with self.assertRaises(ValueError): prepare_insert(bad)
        bad=copy.deepcopy(PAYLOAD); bad['diagram']={'widthMm':80,'aspect':1,'png':'data:image/png;base64,eA=='}
        with self.assertRaises(ValueError): prepare_insert(bad)

class NativeGuardTest(unittest.TestCase):
    def test_diagram_label_box_is_exactly_ten_mm_and_unlocked(self):
        shape = Hancom._diagram_label_box_shape(50, 25, 600, 900)
        self.assertEqual(shape['TreatAsChar'], 0)
        self.assertEqual(shape['TextWrap'], 3)
        self.assertEqual(shape['Lock'], 0)
        self.assertEqual(shape['ProtectSize'], 0)
        self.assertTrue(shape['AllowOverlap'])
        self.assertEqual(shape['WidthRelTo'], 4)
        self.assertEqual(shape['HeightRelTo'], 2)
        self.assertAlmostEqual(shape['Width'] * 25.4 / 7200, 10, delta=.01)
        self.assertAlmostEqual(shape['Height'] * 25.4 / 7200, 10, delta=.01)
        self.assertEqual(shape['HorzOffset'] + (shape['Width'] - 600) // 2, round(50 * 7200 / 25.4))
        self.assertEqual(shape['VertOffset'] + (shape['Height'] - 900) // 2, round(25 * 7200 / 25.4))

    def make_adapter(self):
        adapter=Hancom.__new__(Hancom)
        adapter.scratch=None
        adapter.gui=SimpleNamespace(IsWindowEnabled=lambda handle: handle!=2)
        hwp=SimpleNamespace(XHwpWindows=SimpleNamespace(Count=2,Item=lambda index:SimpleNamespace(WindowHandle=index+1)),
                            HAction=Mock())
        return adapter,hwp
    def test_modal_in_another_window_blocks_writes(self):
        adapter,hwp=self.make_adapter()
        with self.assertRaisesRegex(RuntimeError,'확인창'):
            adapter._text(hwp,'시험 본문')
        hwp.HAction.Execute.assert_not_called()
    def test_switching_away_from_scratch_blocks_writes(self):
        adapter,hwp=self.make_adapter()
        adapter.gui.IsWindowEnabled=lambda handle:True
        adapter.scratch=(hwp,10)
        hwp.XHwpDocuments=SimpleNamespace(Active_XHwpDocument=SimpleNamespace(DocumentID=20))
        with self.assertRaisesRegex(RuntimeError,'문서가 바뀌었습니다'):
            adapter._text(hwp,'시험 본문')
        hwp.HAction.Execute.assert_not_called()

class Adapter:
    def __init__(self): self.calls=0
    def list_documents(self): return [{'id':'a','title':'시험 문서'}]
    def insert(self,payload):
        self.calls+=1
        if payload['documentId']=='closed': raise ValueError('닫힌 문서')
        return {'ok':True,'equationCount':payload['equationCount']}

class BridgeTest(unittest.TestCase):
    def setUp(self):
        self.adapter=Adapter()
        self.server=BridgeServer(self.adapter,token='test-session',port=0)
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True)
        self.thread.start()
    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join()
    def request(self,method='POST',payload=None,origin='http://127.0.0.1:8766',token='test-session',extra=None):
        conn=http.client.HTTPConnection('127.0.0.1',self.server.server_port,timeout=3)
        headers={'Origin':origin,'Authorization':'Bearer '+token,'Content-Type':'application/json',**(extra or {})}
        conn.request(method,'/insert' if method=='POST' else '/documents',json.dumps(payload or PAYLOAD) if method=='POST' else None,headers)
        response=conn.getresponse(); status=response.status
        data=response.read()
        conn.close()
        return status, json.loads(data) if data else None
    def test_duplicate_is_exactly_once(self):
        self.assertEqual(self.request()[0],200)
        self.assertEqual(self.request()[0],200)
        self.assertEqual(self.adapter.calls,1)
        bad=copy.deepcopy(PAYLOAD); bad['number']='2'
        self.assertEqual(self.request(payload=bad)[0],409)
        self.assertEqual(self.adapter.calls,1)
    def test_boundaries(self):
        self.assertEqual(self.request(origin='https://evil.example')[0],403)
        self.assertEqual(self.request(token='wrong')[0],401)
        self.assertEqual(self.request(extra={'Host':'evil.example'})[0],403)
        self.assertEqual(self.adapter.calls,0)
    def test_oversized_and_invalid_payload(self):
        self.assertEqual(self.request(extra={'Content-Length':'14000000'})[0],413)
        bad=copy.deepcopy(PAYLOAD); bad['fontSize']=200
        status,result=self.request(payload=bad)
        self.assertEqual(status,400); self.assertTrue(result['final'])
        self.assertEqual(self.adapter.calls,0)
    def test_closed_document_and_retries(self):
        bad=copy.deepcopy(PAYLOAD); bad['documentId']='closed'
        self.assertEqual(self.request(payload=bad)[0],422)
        self.assertEqual(self.request(payload=bad)[0],422)
        self.assertEqual(self.adapter.calls,1)
    def test_documents_and_preflight(self):
        self.assertEqual(self.request(method='GET')[1]['documents'][0]['id'],'a')
        self.assertEqual(self.request(method='OPTIONS')[0],204)

if __name__=='__main__': unittest.main()
