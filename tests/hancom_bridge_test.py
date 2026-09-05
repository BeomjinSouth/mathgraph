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
    def test_equations(self):
        self.assertEqual(to_hwp(r'\frac{\sqrt{3}}{2}'), '{sqrt {3}} over {2}')
        self.assertEqual(to_hwp(r'3\,\mathrm{cm}'), '3~rm {cm}')
        self.assertEqual(to_hwp('πr²'), 'pi r^2')
        self.assertEqual(prepare_insert(PAYLOAD)['equationCount'], 1)
    def test_unsupported_and_unbalanced(self):
        for value in (r'\unknown{x}', r'\frac{a}', r'\sqrt{x', 'x}'):
            with self.assertRaises(ValueError): to_hwp(value)
    def test_plain_math_and_paths_rejected_before_mutation(self):
        bad=copy.deepcopy(PAYLOAD)
        bad['paragraphs'][0]['segments'][0]['value']='길이 3 cm'
        with self.assertRaises(ValueError): prepare_insert(bad)
        bad=copy.deepcopy(PAYLOAD); bad['path']='C:/untrusted.hwp'
        with self.assertRaises(ValueError): prepare_insert(bad)
    def test_numeric_and_png_limits(self):
        inherited=copy.deepcopy(PAYLOAD); inherited['fontSize']=0
        self.assertEqual(prepare_insert(inherited)['fontSize'],0)
        for size in (float('nan'),True,200):
            bad=copy.deepcopy(PAYLOAD); bad['fontSize']=size
            with self.assertRaises(ValueError): prepare_insert(bad)
        bad=copy.deepcopy(PAYLOAD); bad['diagram']={'widthMm':80,'aspect':1,'png':'data:image/png;base64,eA=='}
        with self.assertRaises(ValueError): prepare_insert(bad)

class NativeGuardTest(unittest.TestCase):
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
