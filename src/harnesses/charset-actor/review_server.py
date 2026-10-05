"""GIF review HTTP service. Durable choices respond before shared publication.

This entry point is separate from the sealed pixel authoring tools. The native
producer keeps its original tool hashes while UI serving and sync can evolve.
"""
import argparse
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

import harness as H
import studio


def stamp(path):
    try:
        s = path.stat()
        return (s.st_ino, s.st_mtime_ns, s.st_ctime_ns, s.st_size)
    except FileNotFoundError:
        return None


def item_revision():
    """Observe inputs/receipts, not growing artist logs or the producer heartbeat."""
    paths = [H.HERE / name for name in ('motion.py', 'animal_motion.py', 'delivery.py')]
    paths.extend((H.LOCAL_BRIEFS, H.HDATA / 'briefs.json'))
    paths.extend(H.INPUTS.glob('*'))
    live = []
    for root in (H.DATA / 'runs').glob('*'):
        if root.name == 'reviewtest':
            continue
        paths.extend(root / name for name in ('manifest.json', 'discarded.json'))
        paths.extend((root / 'recipe').rglob('*'))
        for w in root.glob('*__*'):
            paths.extend(w / name for name in ('meta.json', 'out.chr.txt', 'base.chr.txt', 'desc.json',
                                               'published.json', 'model-frames.json', 'pixel-edits.json'))
            paths.extend((w / 'views').glob('*'))
            paths.extend((w / 'face').glob('*/face_x4.png'))
            paths.extend(w / name for name in ('face/meta.json', 'face/views/face_x4.png',
                                               'face_gen/meta.json', 'face_gen/face_x4.png'))
            try:
                pid = json.loads((w / 'meta.json').read_text()).get('pid')
                live.append((str(w), H._alive(pid)))
            except (OSError, ValueError):
                pass
    return tuple((str(p), stamp(p)) for p in paths if not p.is_dir()), tuple(live)


class ReviewState:
    def __init__(self, start_workers=True):
        self.lock = threading.Lock()
        self.choice_lock = threading.Lock()
        self.ready = threading.Event()
        self.publish_wake = threading.Event()
        self.items = []
        self.blocked_by_run = {}
        self.error = None
        self.wanted = 0
        self.finished = 0
        self.publishing = False
        self.mirrors = set()
        self.stopping = threading.Event()
        self.workers = []
        self.queue_publication()
        if start_workers:
            for target in (self.refresh_loop, self.publication_loop):
                worker = threading.Thread(target=target, daemon=True)
                self.workers.append(worker)
                worker.start()

    def close(self):
        self.stopping.set()
        self.ready.set()
        self.publish_wake.set()
        for worker in self.workers:
            worker.join(timeout=5)

    def queue_publication(self, candidate=None):
        with self.lock:
            self.wanted += 1
            if candidate:
                self.mirrors.add(candidate)
        self.publish_wake.set()

    def refresh_loop(self):
        previous = None
        while not self.stopping.is_set():
            try:
                revision = item_revision()
                if revision != previous:
                    items = H._items()
                    blocked = {r['run']: r['blocked'] for r in studio.runs(items)}
                    with self.lock:
                        self.items, self.blocked_by_run, self.error = items, blocked, None
                    previous = revision
                    self.ready.set()
                    self.queue_publication()
            except Exception as error:
                with self.lock:
                    self.error = str(error)
            self.stopping.wait(2)

    def publication_loop(self):
        self.ready.wait()
        # A restart repairs mirrors, including a clear whose journal receipt was
        # committed before the previous HTTP process exited.
        with self.lock:
            self.mirrors.update(it['id'] for it in self.items if it['review_mode'] == 'human')
        while not self.stopping.is_set():
            self.publish_wake.wait()
            if self.stopping.is_set():
                break
            self.publish_wake.clear()
            with self.lock:
                wanted = self.wanted
                mirrors, self.mirrors = self.mirrors, set()
                self.publishing = True
            journal = stamp(H.DECISIONS)
            try:
                # Publication never owns the decisions lock: the journal is the
                # source of truth, and a concurrent change schedules another pass.
                with H.data_lock('shared-publication'):
                    legacy = False
                    for candidate in mirrors:
                        w = H.run_dir(candidate.split('/')[0]) / candidate.split('/')[1]
                        if w.is_dir() and H.human_review(w):
                            latest = H._decisions().get(candidate)
                            H.sync_human_decision(w, latest or dict(id=candidate, decision='clear'))
                        elif w.is_dir():
                            legacy = True
                    if legacy:
                        H.export_decisions()
                    receipt = H.publish_shared_library()
                    H.write_json_atomic(H.DATA / 'review-publication.json', dict(journal=journal, receipt=receipt))
                with self.lock:
                    self.finished = wanted
            except Exception as error:
                H.write_json_atomic(H.DATA / 'shared-library-error.json', dict(error=str(error), at=H.now()))
                with self.lock:
                    self.mirrors.update(mirrors)
                self.stopping.wait(3)
                self.publish_wake.set()
            finally:
                with self.lock:
                    self.publishing = False
            if stamp(H.DECISIONS) != journal:
                self.queue_publication()

    def get(self):
        with H.data_lock('decisions'):
            decisions = H._decisions()
            journal = stamp(H.DECISIONS)
        with self.lock:
            items = [dict(it) for it in self.items]
            pending = self.publishing or self.finished < self.wanted
            error = self.error
            blocked = dict(self.blocked_by_run)
        for it in items:
            rec = decisions.get(it['id'])
            w = H.run_dir(it['run']) / it['dir']
            it['decision'] = rec if H.effective_decision(w, rec, it['gate']) else None
            it['decision_stale'] = bool(rec and not it['decision'])
            if it.get('quality'):
                q = dict(it['quality'])
                q['reasons'] = [r for r in q['reasons'] if r not in ('사용자 폐기', '사용자 버림')]
                if it['decision'] and it['decision']['decision'] == 'reject':
                    q['reasons'].append('사용자 폐기' if it['review_mode'] == 'human' else '사용자 버림')
                q['eligible'] = not q['reasons']
                it['quality'] = q
        def read(name):
            try:
                return json.loads((H.DATA / name).read_text())
            except (OSError, ValueError):
                return None
        publication = read('review-publication.json')
        pending = pending or not publication or publication.get('journal') != (list(journal) if journal else None)
        return dict(items=items, reasons=H.REASONS, runs=studio.runs(items, blocked_by_run=blocked, decisions=decisions) if self.ready.is_set() else [],
                    loading=not self.ready.is_set(), stateError=error,
                    sharedLibrary=read('shared-library.json'), sharedLibraryError=read('shared-library-error.json'),
                    sharedLibraryPending=pending)

    def decide(self, d):
        if d.get('decision') not in ('accept', 'reject', 'clear') or not isinstance(d.get('id'), str):
            return 400, dict(error='잘못된 선택')
        parts = d['id'].split('/')
        if len(parts) != 2 or any(p in ('', '.', '..') for p in parts):
            return 400, dict(error='잘못된 후보')
        root = (H.DATA / 'runs').resolve()
        w = root / d['id']
        if not w.is_dir() or not w.resolve().is_relative_to(root):
            return 404, dict(error='candidate missing')
        with self.choice_lock, H.data_lock('decisions'):
            receipt = H.decision_receipt(d.get('mutationId'))
            if receipt:
                if any(receipt.get(k) != d.get(k) for k in ('id', 'decision', 'inspected')):
                    return 409, dict(error='mutation conflict')
            else:
                gate = H.current_gate(w)
                if d.get('inspected') != H.binding(gate):
                    return 409, dict(error='그림이 변경되었습니다. 새 GIF를 확인해 주세요.')
                if d['decision'] == 'accept' and not H.quality(w, 'accept', gate)['eligible']:
                    return 409, dict(error='결손/검사 실패 결과는 받을 수 없습니다', fails=gate['fails'])
                receipt = dict(id=d['id'], decision=d['decision'], mutationId=d.get('mutationId'),
                               inspected=H.binding(gate), reasons=d.get('reasons') or [], note=d.get('note') or '',
                               client='web', at=H.now())
                H.DATA.mkdir(parents=True, exist_ok=True)
                with H.DECISIONS.open('a', encoding='utf-8') as fh:
                    fh.write(json.dumps(receipt, ensure_ascii=False) + '\n')
                    fh.flush()
                    os.fsync(fh.fileno())
        # Even a repeated old accept repairs from the latest journal decision.
        self.queue_publication(d['id'])
        return 200, receipt


def handler(state):
    root = (H.DATA / 'runs').resolve()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def send(self, code, body, content_type='application/json; charset=utf-8'):
            if isinstance(body, dict):
                body = json.dumps(body, ensure_ascii=False)
            if isinstance(body, str):
                body = body.encode('utf-8')
            self.send_response(code)
            self.send_header('Content-Type', content_type)
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass  # A lost connection never rolls back a durable journal choice.

        def do_GET(self):
            path = unquote(self.path.split('?', 1)[0])
            if path in ('/', '/index.html'):
                return self.send(200, (H.HERE / 'web/index.html').read_bytes(), 'text/html; charset=utf-8')
            if path == '/api/state':
                return self.send(200, state.get())
            for prefix, directory in (('/f/', root), ('/downloads/', (H.DATA / 'downloads').resolve()),
                                       ('/in/', H.INPUTS.resolve())):
                if path.startswith(prefix):
                    file = (directory / path[len(prefix):]).resolve()
                    if not file.is_file() or not file.is_relative_to(directory):
                        return self.send(404, 'not found', 'text/plain')
                    kind = {'.png': 'image/png', '.gif': 'image/gif', '.zip': 'application/zip',
                            '.json': 'application/json', '.html': 'text/html; charset=utf-8'}
                    return self.send(200, file.read_bytes(), kind.get(file.suffix, 'text/plain; charset=utf-8'))
            self.send(404, dict(error='not found'))

        def do_POST(self):
            try:
                d = json.loads(self.rfile.read(int(self.headers.get('Content-Length') or 0)))
                if not isinstance(d, dict):
                    raise ValueError('JSON 객체가 필요합니다')
                if self.path == '/api/decide':
                    return self.send(*state.decide(d))
                if self.path == '/api/publish':
                    state.queue_publication()
                    return self.send(200, dict(queued=True))
                if self.path == '/api/produce':
                    result = studio.create(d)
                elif self.path in ('/api/pause', '/api/resume'):
                    result = studio.control(d.get('run'), self.path == '/api/resume')
                elif self.path == '/api/export':
                    with H.data_lock('decisions'):
                        decisions = H._decisions()
                    with H.data_lock('exports'):
                        result = studio.export_kept(d.get('run', 'all'), decisions=decisions)
                else:
                    return self.send(404, dict(error='not found'))
                self.send(200, result)
            except (ValueError, TypeError, KeyError) as error:
                self.send(409, dict(error=str(error)))
            except Exception as error:
                self.send(500, dict(error=str(error)))

    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=18314)
    args = parser.parse_args()
    # Host review choices and mirrors stay outside tracked source files.
    H.EXPORT = H.DATA / 'decisions-export.json'
    H.ACCEPTED = H.DATA / 'accepted-legacy'
    state = ReviewState()
    print(f'http://mdc-server:{args.port}/', flush=True)
    server = ThreadingHTTPServer(('0.0.0.0', args.port), handler(state))
    try:
        server.serve_forever()
    finally:
        server.server_close()
        state.close()


if __name__ == '__main__':
    main()
