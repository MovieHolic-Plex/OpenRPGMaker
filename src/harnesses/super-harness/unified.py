#!/usr/bin/env python3
"""One supervisor and HTTP listener for spatial learning, prop derivation and publication.

    python3 src/harnesses/super-harness/unified.py run

Preserves the existing SQLite stores and pause state. The optional legacy listener only
redirects bookmarks; it never loads a second worker, picker or publication queue.
"""
import argparse
import fcntl
import importlib.util
import os
from pathlib import Path
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[3]
sys.path.append(str(ROOT / 'src/harnesses/beodeul-building-review/node'))
import mount as beodeul_review  # noqa: E402  버들항 건물 검수 화면(/harness/beodeul)


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def components():
    # A live spatial development checkout may be retained until its current work lands.
    # Its modules keep their established CLI imports; props use an isolated package.
    spatial_root = Path(os.environ.get('SUPER_HARNESS_CODE_ROOT', str(ROOT))).resolve()
    sh = load('oprn_spatial_supervisor', spatial_root / 'src/harnesses/super-harness/sh.py')
    # Spatial art jobs own isolated worktrees. Never send the live prop data paths
    # into their subprocesses, including the currently developing spatial executor.
    for key in ('PROP_HARNESS_CONTENT_ROOT', 'PROP_HARNESS_DATA', 'HIP_DATA', 'HIP_DB', 'HIP_PICK'):
        sh.ENV.pop(key, None)
    # Spawned preview workers must be able to import their callable's module.
    pick = load('pick_server', ROOT / 'scripts/content/hand-interior-pick/pick_server.py')
    if pick.HAPI is None:
        raise RuntimeError('기물 파생 API가 없습니다.')
    if pick.HAPI.store is sh.store:
        raise RuntimeError('기물·공간 저장소 모듈이 충돌했습니다.')
    pick.HAPI.super_bridge.attach_space(sh.gallery_list)
    return sh, pick


def handler(sh, pick):
    class Unified(pick.H):
        def send(self, code, body, ctype='application/json; charset=utf-8', cache=None):
            return sh.Handler.send(self, code, body, ctype, cache)

        def do_GET(self):
            path = urlsplit(self.path).path
            if beodeul_review.owns(path):
                return beodeul_review.dispatch(self, 'GET')
            if path in ('/', '/index.html'):
                return self.file(str(ROOT / 'src/harnesses/interior-props/web/super.html'), 'text/html; charset=utf-8')
            if path == '/spaces':
                return self.file(os.path.join(sh.HERE, 'web/gallery.html'), 'text/html; charset=utf-8')
            if path == '/api/super-harness/runtime':
                return self.send(200, dict(unified=True, pid=os.getpid(), port=sh.PORT,
                                          propsStore=pick.HAPI.store.DATA, spaceStore=sh.DATA,
                                          contentRoot=pick.CONTENT_ROOT, spaceCodeRoot=sh.ROOT,
                                          codeRoot=str(ROOT)))
            if path.startswith(('/harness', '/api/harness/', '/api/super-harness/', '/c/', '/ctx/', '/out/')) or path in ('/api/history', '/favicon.ico'):
                return pick.H.do_GET(self)
            return sh.Handler.do_GET(self)

        def do_POST(self):
            if beodeul_review.owns(urlsplit(self.path).path):
                return beodeul_review.dispatch(self, 'POST')
            if urlsplit(self.path).path == '/api/action':
                return sh.Handler.do_POST(self)
            return pick.H.do_POST(self)

    return Unified


def redirect_handler(port):
    class Redirect(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_GET(self):
            # Only the port changes, so the browser keeps its tab hash and view selection.
            hostname = urlsplit('//' + self.headers.get('Host', 'localhost')).hostname or 'localhost'
            host = '[' + hostname + ']' if ':' in hostname else hostname
            target = 'http://' + host + ':' + str(port) + self.path
            self.send_response(307)
            self.send_header('Location', target)
            self.send_header('Content-Length', '0')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()

        def do_POST(self):
            # Cached picker pages also migrate their confirmed choices to the same API.
            return self.do_GET()

    return Redirect


def initialize(sh, pick):
    sh.store.init()
    pick.picks_db.conn()
    pick.picks_db.ensure_imported()
    pick.picks_db.export()
    pick.picks_db.backup_loop()
    pick.warm_loop()
    pick.HAPI.start()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('command', choices=('run', 'serve'), nargs='?', default='run')
    ap.add_argument('--port', type=int, default=int(os.environ.get('SUPER_HARNESS_PORT', '18315')))
    ap.add_argument('--legacy-port', type=int, default=int(os.environ.get('SUPER_HARNESS_LEGACY_PORT', '18312')))
    ap.add_argument('--host', default='0.0.0.0')
    args = ap.parse_args()
    os.environ['SUPER_HARNESS_PORT'] = str(args.port)
    sh, pick = components()
    Path(sh.DATA).mkdir(parents=True, exist_ok=True)
    with open(Path(sh.DATA) / 'unified.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        ThreadingHTTPServer.daemon_threads = True
        # Bind both sockets before initializing queues, so a port conflict cannot start workers.
        server = ThreadingHTTPServer((args.host, args.port), handler(sh, pick))
        legacy = None
        try:
            if args.legacy_port and args.legacy_port != args.port:
                legacy = ThreadingHTTPServer((args.host, args.legacy_port), redirect_handler(args.port))
            initialize(sh, pick)
            if legacy:
                threading.Thread(target=legacy.serve_forever, daemon=True, name='legacy-redirect').start()
            print(f'슈퍼하네싱 http://{args.host}:{args.port}/ — pid {os.getpid()}', flush=True)
            if args.command == 'run':
                threading.Thread(target=server.serve_forever, daemon=True, name='unified-http').start()
                sh.daemon()
            else:
                server.serve_forever()
        finally:
            server.server_close()
            if legacy:
                legacy.server_close()


if __name__ == '__main__':
    main()
