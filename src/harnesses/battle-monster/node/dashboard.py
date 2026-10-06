"""Human result inbox; AI production stays behind the HTTP interface.

The durable request journal precedes ledger writes. Replaying a request after
restart is idempotent. Only the human endpoint records Allow/Modify/Deny.
"""
import argparse
import base64
import copy
import json
from html import escape
from pathlib import Path
import secrets
import shutil
import threading
import time
import uuid
from contextlib import nullcontext
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
from pipeline import Harness, REPO, POSES, EXTRA_POSES, identifier, load, save, lock, sha, canonical, stamp

from motions import bake_motions

HERE = Path(__file__).resolve().parent


class ChoiceError(ValueError):
    """A message intended for the person using the result inbox."""


class Dashboard:
    def __init__(self, args):
        self.args = args
        self.harness = Harness(args)
        self.seed_version = self.harness.seed_path.stat().st_mtime_ns
        self.root = self.harness.root
        self.requests = self.root / 'dashboard/requests'
        self.requests.mkdir(parents=True, exist_ok=True)
        self.mutex = threading.RLock()
        self.cache = {}
        self.token = secrets.token_urlsafe(32)
        self.wake = threading.Event()
        self.stopping = threading.Event()
        # systemd stops the entire process group; interrupted requests resume
        # from baked sources / critique reports, never from a model's exit claim.
        for path in sorted(self.requests.glob('*.json')):
            job = load(path)
            if job['state'] == 'recording':
                self.record_decision(job)
                job['state'] = 'done' if job['action'] == 'deny' else 'queued'
                save(path, job)
            elif job['state'] == 'running':
                job['state'] = 'cancelled' if job.get('supersededBy') else 'queued'
                save(path, job)
        jobs = self.jobs()
        for job in jobs:
            newer = [j for j in jobs if j['key'] == job['key'] and j['createdAt'] > job['createdAt']]
            if newer and job['state'] in ('queued', 'recording'):
                job.update(state='cancelled', supersededBy=max(newer, key=lambda j: j['createdAt'])['id'])
                save(self.requests / (job['id'] + '.json'), job)

    def directory(self, key):
        parts = key.split('/') if isinstance(key, str) else []
        if len(parts) != 2:
            raise ValueError('후보를 다시 선택해 주세요.')
        for part in parts:
            identifier(part)
        path = (self.root / parts[0] / parts[1]).resolve()
        if not path.is_relative_to(self.root) or not (path / 'brief.json').is_file():
            raise ValueError('후보를 찾을 수 없습니다.')
        return path

    def jobs(self):
        return [load(path) for path in sorted(self.requests.glob('*.json'))]

    def refresh_seed(self):
        version = self.harness.seed_path.stat().st_mtime_ns
        if version != self.seed_version:
            self.harness = Harness(self.args)
            self.seed_version = version
            self.cache.clear()

    def snapshot(self, directory, already_locked=False):
        files = (sorted((directory / 'source').rglob('*'))
                 + [directory / 'brief.json', directory / 'provenance.json']
                 + sorted(directory.glob('critique-*.json')))
        fingerprint = [(str(p), p.stat().st_mtime_ns, p.stat().st_size) for p in files if p.is_file()]
        key = str(directory.relative_to(self.root))
        cached = self.cache.get(key)
        if cached and cached['fingerprint'] == fingerprint:
            return copy.deepcopy(cached['snapshot'])
        with nullcontext() if already_locked else lock(directory / '.lock'):
            phase = 'suite' if all((directory / 'source/actions' / (pose + '.pxgrid')).exists() for pose in EXTRA_POSES) else 'poses' if all((directory / 'source/poses' / (pose + '.pxgrid')).exists() for pose in POSES) else 'idle'
            report = self.harness.bake(directory, phase)
            reports = {phase: report}
            if phase == 'suite':
                reports['poses'] = self.harness.bake(directory, 'poses')
            if phase in ('poses', 'suite'):
                reports['idle'] = self.harness.bake(directory, 'idle')
            brief = self.harness.brief(directory)
            image = directory / 'preview' / phase / 'sheet.png'
            provenance = load(directory / 'provenance.json')
            _, frames, _ = self.harness.pixels(directory, phase)
            motions = bake_motions(directory, brief, frames)
            from urllib.parse import urlencode
            for motion in motions:
                if motion['available']:
                    query = urlencode({'key': key, 'motion': motion['id'], 'binding': report['binding']})
                    motion.update(gif='/api/motion?' + query, poster='/api/motion?' + query + '&still=1')
            snapshot = {'key': key, 'name': provenance.get('displayName') or brief['monster']['name'], 'cell': brief['monster']['cell'],
                        'idleFrameMs': brief['monster']['idleFrameMs'], 'phase': phase,
                        'bindings': {p: r['binding'] for p, r in reports.items()},
                        'ready': all(r['pass'] for r in reports.values()),
                        'image': 'data:image/png;base64,' + base64.b64encode(image.read_bytes()).decode(),
                        'motions': motions, 'skill': brief['monster'].get('skill', '').split(':', 1)[0].split('.', 1)[0],
                        'kind': brief['monster'].get('kind', 'creature'),
                        'parent': provenance.get('parent'), 'correction': provenance.get('userCorrection', ''),
                        'replacesPendingParent': bool(provenance.get('kind') == 'bounded-quality-repair'
                            and report['pass'] and self.harness.current_critique(directory, phase, report))}
        self.cache[key] = {'fingerprint': fingerprint, 'snapshot': snapshot}
        return copy.deepcopy(snapshot)

    def decorate(self, snapshot):
        directory = self.directory(snapshot['key'])
        phase = snapshot['phase']
        latest = self.harness.latest_decision(directory, phase)
        decision = self.harness.decision(directory, phase, snapshot['bindings'][phase])
        snapshot['choice'] = {'keep': 'allow', 'rework': 'modify', 'discard': 'deny'}.get(decision, 'pending')
        snapshot['version'] = sha(canonical({'bindings': snapshot['bindings'], 'latest': latest}))
        snapshot['note'] = latest['note'] if latest else snapshot.get('correction', '')
        snapshot['decisionAt'] = latest['at'] if latest else ''
        return snapshot

    def state(self):
        with self.mutex:
            self.refresh_seed()
            jobs = self.jobs()
            hidden = {j.get('target') for j in jobs if j['state'] != 'done'}
            items = []
            for directory in self.harness.candidates():
                key = str(directory.relative_to(self.root))
                if key in hidden:
                    continue
                try:
                    item = self.decorate(self.snapshot(directory))
                    related = [j for j in jobs if j['key'] == key]
                    job = max(related, key=lambda j: j['createdAt']) if related else None
                    item['working'] = bool(job and not job.get('supersededBy') and job['state'] in ('queued', 'running', 'recording'))
                    item['failed'] = bool(job and job['state'] == 'failed')
                    item['download'] = '/api/download?id=' + job['id'] if job and job.get('pack') and item['choice'] == 'allow' else None
                    if item['parent']:
                        parent = self.snapshot(self.directory(item['parent']))
                        item['before'] = parent['image']
                        item['beforePhase'] = parent['phase']
                        item['beforeMotions'] = parent['motions']
                    items.append(item)
                except (OSError, ValueError, KeyError):
                    # Incomplete authoring sources are an AI concern. The last
                    # complete parent stays visible while its revision is made.
                    continue
            making = 0
            if self.root == (REPO / 'qa-runs/harnesses/battle-monster').resolve():
                for wave in ('battle-monster-human-wave', 'battle-monster-extra-motion-wave', 'battle-monster-reference-wave', 'battle-monster-silhouette-wave', 'battle-monster-baram-quality-wave', 'battle-monster-ornate-boss-wave', 'battle-monster-fifty-wave'):
                    for task in (REPO / 'qa-runs' / wave / 'tasks').glob('*.json'):
                        making += load(task)['state'] in ('queued', 'running')
            selected = {}
            by_key = {i['key']: i for i in items}
            # A finished, independently reviewed AI defect repair replaces its
            # undecided draft in the review queue. Both stay in history, and
            # real Allow/Modify/Deny decisions are never created or altered.
            for item in items:
                parent = by_key.get(item['parent'])
                if item['replacesPendingParent'] and parent and parent['choice'] == 'pending':
                    parent['reviewSupersededBy'] = item['key']
            # Replay real choices. Removing the active version never silently
            # resurrects a previously replaced Allow; rejecting a competing
            # pending candidate does not revoke the selected one either.
            for decision in self.harness.ledger()['decisions']:
                item = by_key.get(decision['candidate'])
                if (not item or decision['phase'] != item['phase']
                        or decision['binding'] != item['bindings'][item['phase']]):
                    continue
                species = item['key'].split('/')[0]
                if decision['choice'] == 'keep':
                    selected[species] = item
                elif selected.get(species) is item:
                    selected.pop(species)
            selected = {species: i for species, i in selected.items() if i['choice'] == 'allow'}
            for item in items:
                item['active'] = selected.get(item['key'].split('/')[0]) is item
            selection = [{'key': i['key'], 'bindings': i['bindings']} for i in selected.values()]
            latest = max((i for i in items if i['decisionAt']), key=lambda i: i['decisionAt'], default=None)
            return {'items': items, 'working': sum(not j.get('supersededBy') and j['state'] in ('queued', 'running') for j in jobs),
                    'making': making, 'selection': selection,
                    'lastDecision': {'name': latest['name'], 'action': latest['choice']} if latest else None,
                    'uiVersion': sha(b''.join((HERE / f).read_bytes() for f in ('dashboard.js', 'dashboard.html', 'dashboard.css')))}

    def record_decision(self, job):
        with lock(self.harness.ledger_path.with_suffix('.lock')):
            ledger = self.harness.ledger()
            existing = {(r.get('requestId'), r['phase']) for r in ledger['decisions']}
            for phase, binding in job['bindings'].items():
                if (job['id'], phase) not in existing:
                    ledger['decisions'].append({'candidate': job['key'], 'phase': phase,
                        'choice': {'allow': 'keep', 'modify': 'rework', 'deny': 'discard'}[job['action']],
                        'binding': binding, 'by': job.get('by', 'dashboard-user'), 'note': job['note'] or job['action'],
                        'at': job['createdAt'], 'requestId': job['id'],
                        **({'delegatedGoal': job['delegatedGoal']} if job.get('delegatedGoal') else {})})
            save(self.harness.ledger_path, ledger)

    def decide(self, payload):
        action = payload.get('action')
        if action not in ('allow', 'modify', 'deny'):
            raise ChoiceError('Allow, Modify, Deny 중 하나를 선택해 주세요.')
        request_id = str(uuid.UUID(payload.get('requestId', '')))
        note = payload.get('note', '')
        if not isinstance(note, str) or len(note) > 4000 or (action == 'modify' and not note.strip()):
            raise ChoiceError('어떻게 고칠지 적어 주세요. 최대 4,000자입니다.')
        directory = self.directory(payload.get('key'))
        # Choices do not wait for a model/ZIP lock. Check the published source
        # binding read-only; authoring creates a separate child candidate.
        with self.mutex:
            self.refresh_seed()
            path = self.requests / (request_id + '.json')
            if path.exists():
                job = load(path)
                if (job['key'], job['action'], job['note']) != (payload.get('key'), action, note.strip()):
                    raise ChoiceError('이미 처리된 요청입니다. 다시 선택해 주세요.')
                return {'saved': True, 'requestId': request_id}
            snapshot = self.decorate(self.snapshot(directory))
            if payload.get('version') != snapshot['version']:
                raise ChoiceError('새 결과나 선택이 있습니다. 갱신된 그림을 보고 다시 선택해 주세요.')
            if action == 'allow' and not snapshot['ready']:
                raise ChoiceError('AI가 결과를 준비 중입니다. 잠시 후 다시 확인해 주세요.')
            delegated = payload.get('delegatedGoal')
            if delegated is not None:
                plan_path = REPO / 'harness-data/battle-monster/fifty-monsters-plan.json'
                plan = load(plan_path)
                expected = {'planSha256': sha(plan_path.read_bytes()),
                            'originalUserText': plan['authorization']['originalUserText']}
                permitted = {r['id'] + '/' + plan['candidate'] for r in plan['roster']}
                if (self.root != (REPO / 'qa-runs/harnesses/battle-monster').resolve()
                        or delegated != expected or plan['authorization']['source'] != 'current-thread-user-goal'
                        or snapshot['key'] not in permitted or action != 'allow' or snapshot['phase'] != 'suite'
                        or expected['originalUserText'] not in note):
                    raise ChoiceError('현재 사용자가 위임한 제작 목록과 원문을 확인해 주세요.')
                if snapshot['choice'] in ('deny', 'modify'):
                    raise ChoiceError('사용자가 나중에 선택한 Deny/Modify를 유지합니다.')
                report = load(directory / 'check-suite.json')
                review = self.harness.current_critique(directory, 'suite', report)
                if (not report['pass'] or report['binding'] != snapshot['bindings']['suite']
                        or not review or review['recommendation'] != 'keep'
                        or any(sha((directory / name).read_bytes()) != digest
                               for name, digest in report['images'].items())):
                    raise ChoiceError('현재 원본의 픽셀 검사와 실제 독립 시각 keep가 먼저 필요합니다.')
            jobs = self.jobs()
            for phase, binding in snapshot['bindings'].items():
                if self.harness.pixels(directory, phase)[2]['binding'] != binding:
                    raise ChoiceError('그림이 변경되었습니다. 갱신된 결과를 보고 선택해 주세요.')
            job = {'id': request_id, 'key': snapshot['key'], 'action': action, 'note': note.strip(),
                   'bindings': snapshot['bindings'], 'phase': snapshot['phase'], 'createdAt': stamp(), 'state': 'recording'}
            if delegated is not None:
                job.update(by='user-delegated-goal', delegatedGoal=delegated)
            if action == 'modify' or (action == 'allow' and snapshot['phase'] == 'idle'):
                job['target'] = directory.parent.name + '/rev-' + request_id.replace('-', '')[:16]
            save(path, job)
            self.record_decision(job)
            for previous in jobs:
                if previous['key'] == snapshot['key'] and previous['state'] in ('queued', 'running', 'recording'):
                    previous['supersededBy'] = request_id
                    if previous['state'] != 'running':
                        previous['state'] = 'cancelled'
                    save(self.requests / (previous['id'] + '.json'), previous)
            job['state'] = 'done' if action == 'deny' else 'queued'
            save(path, job)
            self.wake.set()
            return {'saved': True, 'requestId': request_id}

    def runner(self, note='', out=None):
        args = copy.copy(self.args)
        args.note = note
        args.prepare_only = False
        args.out = out
        return Harness(args)

    def author(self, harness, directory, phase, job):
        instruction = harness.args.note
        protected = [directory / 'source/palette.json'] if phase in ('poses', 'actions') else []
        protected += [directory / 'source/poses' / (p + '.pxgrid') for p in (POSES if phase == 'actions' else POSES[:1] if phase == 'poses' else ())]
        original = {path: path.read_bytes() for path in protected}
        def restore():
            for path, pixels in original.items():
                path.write_bytes(pixels)
        for attempt in range(3):
            before = len(load(directory / 'provenance.json')['jobs'])
            try:
                report = harness.work(directory, 'author', phase)
                if any(path.read_bytes() != pixels for path, pixels in original.items()):
                    raise ValueError('이미 선택된 원본/팔레트를 바꾸지 말고 추가 동작만 저작하세요.')
                if report['pass']:
                    return report
                problem = '; '.join(report['errors'])
            except ValueError as error:
                runs = load(directory / 'provenance.json')['jobs']
                if len(runs) == before or runs[-1].get('exitCode') != 0:
                    restore()
                    raise  # A failed model invocation is not a pixel repair.
                problem = str(error)
            archive = directory / 'technical-repairs' / uuid.uuid4().hex
            shutil.copytree(directory / 'source', archive / 'source')
            job.setdefault('technicalRepairs', []).append({'problem': problem, 'at': stamp(),
                                                          'source': str(archive.relative_to(self.root))})
            self.update_job(job)
            restore()
            if attempt == 2:
                raise ValueError('기술 오류 재수정 한도 초과: ' + problem)
            harness.args.note = (instruction + '\nTechnical repair: ' + problem
                + '\nPreserve the intended visual design and repair only these contract errors in literal source grids. '
                  'Grounded idle_a must have opaque contact at y=cell-4; no ink may extend below it. '
                  'Do not move/transform whole frames or substitute generated shapes.')

    def process(self, job):
        directory = self.directory(job['key'])
        harness = self.runner(job['note'])
        with self.mutex:
            self.snapshot(directory)  # Cache the immutable parent before its job takes the lock.
        for phase, binding in job['bindings'].items():
            if harness.pixels(directory, phase)[2]['binding'] != binding:
                raise ValueError('요청 후 원본이 변경됨')
        if job['action'] == 'modify' or job['phase'] == 'idle':
            expanding = job['action'] == 'allow'
            target = self.root / job['target']
            if not target.exists():
                harness.init(target)
                shutil.copytree(directory / 'source', target / 'source', dirs_exist_ok=True)
                reference = directory / 'preview' / job['phase'] / 'checker.png'
                shutil.copyfile(reference, target / 'reference.png')
                provenance = load(target / 'provenance.json')
                provenance.update({'parent': job['key'], 'requestId': job['id'],
                                   'displayName': load(directory / 'provenance.json').get('displayName'),
                                   'userCorrection': '선택한 기본 자세에 동작 추가' if expanding else job['note']})
                save(target / 'provenance.json', provenance)
            with lock(target / '.lock'):
                if not job.get('authored'):
                    if expanding:
                        protected = {p: p.read_bytes() for p in (target / 'source/palette.json', target / 'source/poses/idle_a.pxgrid')}
                        harness.args.note += '\nPreserve palette.json and idle_a byte-for-byte; author the missing poses and actions only.'
                    report = self.author(harness, target, 'complete', job)
                    if expanding and any(p.read_bytes() != value for p, value in protected.items()):
                        for p, value in protected.items():
                            p.write_bytes(value)
                        raise ValueError('선택한 기본 자세가 바뀌어서 동작 확장을 보류했습니다.')
                    if report['binding'] == job['bindings'].get(job['phase']):
                        raise ValueError('수정 지시가 그림에 반영되지 않았습니다.')
                    job['authored'] = True
                    self.update_job(job)
                phase = 'suite'
                report = harness.bake(target, phase)
                if not report['pass']:
                    raise ValueError('수정 후보 픽셀 검사 실패')
                if not harness.current_critique(target, phase, report):
                    harness.work(target, 'critique', phase)
            return
        # An Allow is the user's choice immediately. The AI finishes its checks
        # and packaging afterwards; a failure cannot silently revoke that choice.
        with lock(directory / '.lock'):
            reports = {}
            for phase in job['bindings']:
                report = harness.bake(directory, phase)
                reports[phase] = report
                if not report['pass']:
                    raise ValueError('선택 결과 픽셀 검사 실패')
            if len(harness.review_coverage(directory, reports)) != len(reports):
                harness.work(directory, 'critique', job['phase'])
            out = self.root / 'packs' / (job['id'] + '.zip')
            if out.exists():
                out.unlink()  # Only this request owns this deterministic output.
            harness.args.out = str(out)
            result = harness.pack(directory)
            job['pack'] = result['zip']
            self.update_job(job)

    def update_job(self, job):
        with self.mutex:
            path = self.requests / (job['id'] + '.json')
            previous = load(path) if path.exists() else {}
            if previous.get('supersededBy'):
                job['supersededBy'] = previous['supersededBy']
            save(path, job)

    def worker(self):
        while not self.stopping.is_set():
            with self.mutex:
                pending = sorted((j for j in self.jobs() if j['state'] == 'queued'), key=lambda j: j['createdAt'])
                job = pending[0] if pending else None
                if job:
                    job['state'] = 'running'
                    job.pop('error', None)
                    job.pop('finishedAt', None)
                    self.update_job(job)
            if not job:
                self.wake.wait(2)
                self.wake.clear()
                continue
            try:
                self.process(job)
                job['state'] = 'done'
            except Exception as error:
                job['state'] = 'failed'
                job['error'] = str(error)
            with self.mutex:
                if load(self.requests / (job['id'] + '.json')).get('supersededBy'):
                    job['state'] = 'cancelled'
                    job.pop('error', None)
                job['finishedAt'] = stamp()
                self.update_job(job)


def serve(args):
    dashboard = Dashboard(args)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def send(self, status, value, content_type='application/json; charset=utf-8'):
            raw = value if isinstance(value, bytes) else json.dumps(value, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header('Content-Type', content_type)
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'")
            self.send_header('Content-Length', str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def do_GET(self):
            url = urlparse(self.path)
            try:
                if url.path in ('/', '/index.html'):
                    html = (HERE / 'dashboard.html').read_text().replace('__TOKEN__', dashboard.token)
                    html = html.replace('__THEME__', escape(dashboard.harness.seed['style']['theme']))
                    return self.send(200, html.encode(), 'text/html; charset=utf-8')
                if url.path in ('/dashboard.js', '/dashboard.css'):
                    kind = 'text/javascript' if url.path.endswith('.js') else 'text/css'
                    return self.send(200, (HERE / url.path[1:]).read_bytes(), kind + '; charset=utf-8')
                if url.path == '/api/state':
                    return self.send(200, dashboard.state())
                if url.path == '/api/motion':
                    query = parse_qs(url.query)
                    with dashboard.mutex:
                        directory = dashboard.directory(query.get('key', [''])[0])
                        item = dashboard.snapshot(directory)
                        if query.get('binding', [''])[0] != item['bindings'][item['phase']]:
                            raise ValueError('현재 결과와 다른 움직임')
                        motion = query.get('motion', [''])[0]
                        if not any(m['id'] == motion and m['available'] for m in item['motions']):
                            raise ValueError('아직 준비되지 않은 움직임')
                        extension = 'png' if query.get('still') == ['1'] else 'gif'
                        path = directory / 'preview/motions' / (motion + '.' + extension)
                        return self.send(200, path.read_bytes(), 'image/' + extension)
                if url.path == '/api/download':
                    job_id = str(uuid.UUID(parse_qs(url.query).get('id', [''])[0]))
                    with dashboard.mutex:
                        job = load(dashboard.requests / (job_id + '.json'))
                        item = dashboard.decorate(dashboard.snapshot(dashboard.directory(job['key'])))
                        if item['choice'] != 'allow' or item['bindings'] != job['bindings'] or job['state'] != 'done':
                            raise ValueError('현재 선택한 결과만 받을 수 있습니다.')
                        path = Path(job['pack']).resolve()
                        if not path.is_relative_to(dashboard.root / 'packs'):
                            raise ValueError('팩 경로 오류')
                        return self.send(200, path.read_bytes(), 'application/zip')
                return self.send(404, {'error': '찾을 수 없습니다.'})
            except (ValueError, OSError, KeyError):
                return self.send(409, {'error': '결과를 다시 불러와 주세요.'})

        def do_POST(self):
            origin = self.headers.get('Origin')
            if (self.path != '/api/decision' or self.headers.get('X-Review-Token') != dashboard.token
                    or (origin is not None and origin != 'http://' + self.headers.get('Host', ''))):
                return self.send(403, {'error': '대시보드를 새로 열어 주세요.'})
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 16000:
                    raise ValueError('요청 크기를 확인해 주세요.')
                body = json.loads(self.rfile.read(length))
                if not isinstance(body, dict):
                    raise ValueError('요청을 다시 선택해 주세요.')
                return self.send(200, dashboard.decide(body))
            except ChoiceError as error:
                return self.send(409, {'error': str(error)})
            except (ValueError, OSError, TypeError, KeyError):
                return self.send(409, {'error': '결과를 다시 불러온 뒤 선택해 주세요. AI가 작업 중이면 잠시 기다려 주세요.'})

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    if not args.pause_worker:
        threading.Thread(target=dashboard.worker, daemon=True).start()
    print(f'Monster review: http://{args.host}:{server.server_port}/', flush=True)
    try:
        server.serve_forever()
    finally:
        dashboard.stopping.set()
        server.server_close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seed', default=str(REPO / 'harness-data/battle-monster/seed.json'))
    parser.add_argument('--root', default=str(REPO / 'qa-runs/harnesses/battle-monster'))
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=18346)
    parser.add_argument('--pause-worker', action='store_true', help='진단용: 요청을 저장하되 AI 실행은 보류')
    args = parser.parse_args()
    with lock(Path(args.root).resolve() / 'dashboard/server.lock'):
        serve(args)


if __name__ == '__main__':
    main()
