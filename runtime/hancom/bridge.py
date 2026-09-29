"""Loopback-only, origin- and token-bound bridge. No arbitrary paths or commands."""
import argparse
from collections import OrderedDict
import hashlib
import hmac
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import secrets
import time
from urllib.parse import urlsplit
import webbrowser
from model import prepare_insert

PORT = 18765
DEFAULT_ORIGINS = {'https://mathgraph-five.vercel.app', 'http://127.0.0.1:8766', 'http://localhost:8766'}
MAX_BODY = 13000000


class BridgeServer(HTTPServer):
    allow_reuse_address = True

    def __init__(self, adapter, token=None, origins=None, port=PORT):
        super().__init__(('127.0.0.1', port), Handler)
        self.adapter = adapter
        self.token = token or secrets.token_urlsafe(32)
        self.origins = set(origins or DEFAULT_ORIGINS)
        self.receipts = OrderedDict()
        self.auth_attempts = []

    def service_actions(self):
        # HwpAutomation is an STA COM server. Pump its messages between requests
        # so window/document activation and callbacks can finish while idle.
        if hasattr(self.adapter, 'com'):
            self.adapter.com.PumpWaitingMessages()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # Never log tokens, problem text, document names or pictures.

    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def respond(self, code, value):
        data = json.dumps(value, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        if self.headers.get('Origin') in self.server.origins:
            self.send_header('Access-Control-Allow-Origin', self.headers['Origin'])
            self.send_header('Vary', 'Origin')
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        try:
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def boundary(self, authenticated=True):
        port = self.server.server_address[1]
        if self.headers.get('Host') not in {f'127.0.0.1:{port}', f'localhost:{port}'} or self.headers.get('Origin') not in self.server.origins:
            self.respond(403, {'error': '허용된 MathGraph에서만 연결할 수 있습니다.'})
            return False
        if authenticated:
            now = time.monotonic()
            self.server.auth_attempts = [t for t in self.server.auth_attempts if now - t < 60]
            if len(self.server.auth_attempts) >= 30:
                self.respond(429, {'error': '연결 시도가 너무 많습니다. 잠시 후 다시 확인해 주세요.'})
                return False
            if not hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + self.server.token):
                self.server.auth_attempts.append(now)
                self.respond(401, {'error': '한글 연결이 만료되었습니다. 연결 프로그램에서 연 MathGraph를 사용해 주세요.'})
                return False
        return True

    def do_OPTIONS(self):
        if not self.boundary(False):
            return
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', self.headers['Origin'])
        self.send_header('Vary', 'Origin')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Access-Control-Max-Age', '600')
        self.end_headers()

    def do_GET(self):
        if not self.boundary():
            return
        if self.path != '/documents':
            self.respond(404, {'error': '지원하지 않는 요청입니다.'})
            return
        try:
            self.respond(200, {'documents': self.server.adapter.list_documents()})
        except Exception:
            self.respond(503, {'error': '한글의 문서 목록을 읽지 못했습니다. 한글의 확인창을 닫고 다시 연결해 주세요.'})

    def do_POST(self):
        if not self.boundary():
            return
        if self.path != '/insert' or self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
            self.respond(400, {'error': '지원하지 않는 입력 요청입니다.'})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length < 2 or length > MAX_BODY or self.headers.get('Transfer-Encoding'):
                self.respond(413, {'error': '입력 자료가 너무 크거나 크기 정보가 없습니다.'})
                return
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise ValueError('입력 자료를 끝까지 받지 못했습니다.')
            value = json.loads(raw, parse_constant=lambda _: (_ for _ in ()).throw(ValueError('잘못된 숫자입니다.')))
            prepared = prepare_insert(value)
            request_id = value['requestId']
            digest = hashlib.sha256(raw).hexdigest()
            previous = self.server.receipts.get(request_id)
            if previous:
                if previous[0] != digest:
                    self.respond(409, {'error': '같은 요청 번호에 다른 내용이 있습니다.'})
                else:
                    self.respond(previous[1], previous[2])
                return
            # Retain all receipts for the life of a helper session. Failing closed
            # avoids a delayed retry becoming a new insertion after eviction.
            if len(self.server.receipts) >= 256:
                self.respond(409, {'error': '이번 연결의 입력 횟수가 찼습니다. 프로그램을 다시 실행해 주세요.'})
                return
            try:
                result = self.server.adapter.insert(prepared)
                code = 200
            except (ValueError, RuntimeError) as error:
                code, result = 422, {'error': str(error), 'final': True}
            except Exception:
                code, result = 500, {'error': '한글 작업을 완료하지 못했습니다. 문서를 확인해 주세요. 같은 요청은 중복 입력하지 않습니다.', 'final': True}
            self.server.receipts[request_id] = (digest, code, result)
            self.respond(code, result)
        except (ValueError, UnicodeDecodeError, KeyError, TypeError) as error:
            self.respond(400, {'error': str(error) if isinstance(error, ValueError) else '입력 자료 형식을 확인해 주세요.', 'final': True})


def main():
    parser = argparse.ArgumentParser(description='MathGraph 한글 연결')
    parser.add_argument('--app-url', default='https://mathgraph-five.vercel.app')
    parser.add_argument('--no-open', action='store_true')
    args = parser.parse_args()
    origin = urlsplit(args.app_url)
    app_origin = f'{origin.scheme}://{origin.netloc}'
    if app_origin not in DEFAULT_ORIGINS or origin.username or origin.password:
        raise SystemExit('등록된 MathGraph 주소를 사용해 주세요.')
    from hancom import Hancom
    server = BridgeServer(Hancom())
    print('MathGraph 한글 연결을 시작했습니다. 종료하려면 이 창에서 Ctrl+C를 누르세요.')
    print('현재 탭 연결 코드: ' + server.token)
    if not args.no_open:
        webbrowser.open(app_origin + '/#mathgraph-hwp=' + server.token)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
