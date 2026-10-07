"""Serve the building review screen inside another HTTP server (슈퍼하네싱), one instance per tileset profile.

  /harness/beodeul/...              profile beodeul (old links keep working)
  /harness/buildings/<profile>/...  any profile in profiles.json

The review code, receipts and decision table stay the ones in queue.py: for every profile queue.py is loaded once under its own
module name with that profile's data dir / seed dir / gate switch in the environment, then queue.Handler's reply/js helpers are
lent to the host handler for one request. Same signed gate files and hash-bound decisions as the standalone `serve`. Not signed.

Also owns /api/store/*: bake (decisions -> installed bundle) and publish (staging, or production with a confirm hash + one-time
token that is passed to the publisher through the environment and never stored).
"""
import importlib.util
import json
import os
import subprocess
import sys
import threading
import time
import types
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

NODE = Path(__file__).resolve().parent
ROOT = NODE.parents[3]
PREFIX = '/harness/beodeul'            # the first profile (beodeul), kept for old links
PREFIX_ALL = '/harness/buildings'      # /harness/buildings/<profile>/...
DEFAULT = 'beodeul'
STEPS = {'bake': 'scripts/content/rebuild-building-bundle.sh'}
_modules = {}
_load_lock = threading.RLock()
JOB = {'state': 'idle', 'step': None, 'profile': None, 'log': [], 'started': None, 'ended': None, 'result': None}
JOB_LOCK = threading.Lock()
PLAN = {}  # profile -> {'value': dict|None, 'at': float, 'busy': bool}; the plan takes ~30 s (vite-node + two store lookups)


def _path():
    if str(NODE) not in sys.path:
        sys.path.append(str(NODE))


def _profile(pid):
    _path()
    from profiles import load_profile
    return load_profile(pid)


def list_profiles():
    _path()
    from profiles import all_profiles
    return [{'id': p['id'], 'label': p['label'], 'gate': p.get('gate', True), 'store': 'bundle' in p} for p in all_profiles()]


def module(profile=DEFAULT):
    """One queue.py instance per profile: DATA/SOURCE/GATE are read from the environment at import, so the profile's
    values are set around the import and each instance keeps its own review DB, token and receipts."""
    with _load_lock:
        if profile not in _modules:
            _path()  # appended, never inserted, so queue.py here can't shadow the stdlib `queue`
            pr = _profile(profile)
            env = {'BEODEUL_BUILDING_REVIEW_DATA': str(pr['data']), 'BUILDING_REVIEW_SOURCE': pr['seedDir'],
                   'BUILDING_REVIEW_GATE': 'on' if pr.get('gate', True) else 'off'}
            saved = {k: os.environ.get(k) for k in env}
            os.environ.update(env)
            try:
                name = 'beodeul_review_queue_' + profile
                spec = importlib.util.spec_from_file_location(name, NODE / 'queue.py')
                mod = importlib.util.module_from_spec(spec)
                sys.modules[name] = mod
                spec.loader.exec_module(mod)
            finally:
                for key, value in saved.items():
                    if value is None:
                        os.environ.pop(key, None)
                    else:
                        os.environ[key] = value
            _modules[profile] = mod
        return _modules[profile]


def route(path):
    """(profile, path without the prefix) for a request this module serves, else None."""
    if path == PREFIX or path.startswith(PREFIX + '/'):
        return DEFAULT, path[len(PREFIX):]
    if path.startswith(PREFIX_ALL + '/'):
        profile, slash, tail = path[len(PREFIX_ALL) + 1:].partition('/')
        if profile and profile.replace('-', '').replace('_', '').isalnum():
            return profile, (slash + tail)
    return None


def owns(path):
    return route(path) is not None


def _run(cmd, env_extra=None, timeout=1800):
    proc = subprocess.run(cmd, cwd=ROOT, env={**os.environ, **(env_extra or {})}, capture_output=True, text=True, timeout=timeout)
    return proc.returncode, (proc.stdout or '') + (proc.stderr or '')


def _publisher(profile, target, extra=None, env_extra=None):
    code, out = _run(['npx', 'vite-node', 'store-server/scripts/publishBuildings.ts', '--profile', profile, '--target', target, *(extra or [])], env_extra, 600)
    line = next((l for l in reversed(out.strip().splitlines()) if l.startswith('{')), None)
    try:
        return json.loads(line) if line else {'ok': False, 'error': (out.strip().splitlines() or ['출력 없음'])[-1][:300]}
    except json.JSONDecodeError:
        return {'ok': False, 'error': 'publisher output unreadable'}


def _refresh_plan(profile):
    entry = PLAN.setdefault(profile, {'value': None, 'at': 0, 'busy': False})
    if entry['busy']:
        return
    entry['busy'] = True

    def run():
        try:
            entry['value'] = _publisher(profile, 'plan')
            entry['at'] = time.time()
        finally:
            entry['busy'] = False
    threading.Thread(target=run, daemon=True, name='building-store-plan').start()


def _job_view():
    with JOB_LOCK:
        return {k: JOB[k] for k in ('state', 'step', 'profile', 'started', 'ended', 'result')} | {'log': JOB['log'][-40:]}


def store_status(profile, fresh=False):
    """Allowed count in the live DB vs. what the installed bundle holds, plus where it is on each store (plan is cached)."""
    q = module(profile)
    pr = _profile(profile)
    allowed = q.snapshot()['counts']['allow']
    if 'bundle' not in pr:
        return {'profile': profile, 'label': pr['label'], 'allowed': allowed, 'installed': 0, 'bakeNeeded': False,
                'plan': {'ok': False, 'error': '이 프로필은 아직 설치·스토어 팩이 없습니다.'}, 'planPending': False, 'job': _job_view()}
    catalog = ROOT / pr['bundle']['catalog']
    installed = len(json.loads(catalog.read_text())['buildings']) if catalog.exists() else 0
    entry = PLAN.get(profile)
    if fresh or entry is None or time.time() - entry['at'] > 120:
        _refresh_plan(profile)
        entry = PLAN[profile]
    return {'profile': profile, 'label': pr['label'], 'allowed': allowed, 'installed': installed, 'bakeNeeded': allowed != installed,
            'plan': entry['value'], 'planPending': entry['busy'], 'job': _job_view()}


def _start(profile, step, work):
    with JOB_LOCK:
        if JOB['state'] == 'running':
            raise ValueError('다른 작업이 진행 중입니다.')
        JOB.update(state='running', step=step, profile=profile, log=[], started=time.time(), ended=None, result=None)

    def run():
        try:
            result = work()
            ok = bool(result.get('ok', True)) if isinstance(result, dict) else True
        except Exception as error:  # noqa: BLE001 - surfaced to the screen, not swallowed
            result, ok = {'ok': False, 'error': str(error)[:300]}, False
        PLAN.pop(profile, None)  # what is on the stores / in the bundle just changed
        with JOB_LOCK:
            JOB.update(state='done' if ok else 'failed', ended=time.time(), result=result)
    threading.Thread(target=run, daemon=True, name='building-store-job').start()


def start_bake(profile):
    """Allowed decisions -> decisions.json -> installed sheet/catalog/references (the same steps as the CLI)."""
    def work():
        code, out = _run([sys.executable, str(NODE / 'decisions_sync.py'), 'export'], {'BUILDING_REVIEW_PROFILE': profile})
        with JOB_LOCK:
            JOB['log'].append(out.strip()[-300:])
        if code:
            return {'ok': False, 'error': 'decisions export 실패'}
        code, out = _run(['bash', STEPS['bake'], profile])
        tail = [l for l in out.strip().splitlines() if '{' in l][-1:] or out.strip().splitlines()[-1:]
        with JOB_LOCK:
            JOB['log'].append((tail or [''])[0][:300])
        return {'ok': code == 0, 'error': None if code == 0 else '굽기 실패(로그 마지막 줄 확인)'}
    _start(profile, 'bake', work)


def start_publish(profile, target, confirm=None, link_token=None):
    def work():
        result = _publisher(profile, target, ['--confirm', confirm] if confirm else [], {'STORE_LINK_TOKEN': link_token} if link_token else None)
        with JOB_LOCK:
            JOB['log'].append(f"{target}: {result.get('action') or result.get('error')}")
        return result
    _start(profile, 'publish-' + target, work)


def _plain(handler, code, value):
    data = json.dumps(value, ensure_ascii=False).encode()
    handler.send_response(code)
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    handler.send_header('Content-Length', str(len(data)))
    handler.end_headers()
    handler.wfile.write(data)


def _store_api(handler, method, parts, profile, rest):
    """/api/store/{status,job,bake,publish}: bake/publish need the review token header, like decisions."""
    q = module(profile)
    reply = lambda code, value: q.Handler.reply(handler, code, json.dumps(value, ensure_ascii=False).encode())  # noqa: E731
    name = rest.removeprefix('/api/store/')
    try:
        if method == 'GET' and name == 'status':
            return reply(200, store_status(profile, fresh='fresh' in parse_qs(parts.query)))
        if method == 'GET' and name == 'job':
            return reply(200, _job_view())
        if method == 'POST' and name in ('bake', 'publish'):
            if handler.headers.get('X-Review-Token') != q.TOKEN:
                return reply(403, {'error': '화면에서 다시 시도해 주세요.'})
            size = int(handler.headers.get('Content-Length', '0'))
            if not 0 < size <= 4096:
                raise ValueError('요청 크기 오류')
            data = json.loads(handler.rfile.read(size))
            if name == 'bake':
                start_bake(profile)
            else:
                target = data.get('target')
                if target not in ('staging', 'production'):
                    raise ValueError('target 오류')
                if target == 'production' and (not data.get('confirm') or not data.get('linkToken')):
                    raise ValueError('운영은 확인 코드와 일회용 토큰이 필요합니다.')
                start_publish(profile, target, data.get('confirm'), data.get('linkToken'))
            return reply(202, {'started': True})
        return reply(404, {'error': 'not found'})
    except (ValueError, json.JSONDecodeError) as error:
        return reply(409, {'error': str(error)})
    except subprocess.TimeoutExpired:
        return reply(504, {'error': '시간 초과'})


def dispatch(handler, method):
    """Run queue.Handler.do_<method> for a request whose path starts with a profile prefix."""
    parts = urlsplit(handler.path)
    profile, rest = route(parts.path)
    if rest == '':  # relative URLs in the page need the trailing slash
        handler.send_response(308)
        handler.send_header('Location', parts.path + '/' + ('?' + parts.query if parts.query else ''))
        handler.send_header('Content-Length', '0')
        handler.end_headers()
        return
    try:
        q = module(profile)
    except SystemExit as error:
        return _plain(handler, 404, {'error': str(error)})
    if rest.startswith('/api/store/'):
        return _store_api(handler, method, parts, profile, rest)
    if rest == '/api/profiles' and method == 'GET':
        return q.Handler.reply(handler, 200, json.dumps({'current': profile, 'profiles': list_profiles()}, ensure_ascii=False).encode())
    if rest == '/' and method == 'GET':
        pr = _profile(profile)
        label = pr['label']
        noun = '검수' if pr.get('kind') == 'props' else '건물 검수'
        html = (ROOT / 'src/harnesses/beodeul-building-review/web/index.html').read_text()
        html = html.replace('버들항 건물 검수', f'{label} {noun}').replace('버들항 · 건물 검수', f'{label} · {noun}')
        return q.Handler.reply(handler, 200, html.encode(), 'text/html; charset=utf-8')
    saved = handler.path
    handler.path = rest + ('?' + parts.query if parts.query else '')
    handler.reply = types.MethodType(q.Handler.reply, handler)
    handler.js = types.MethodType(q.Handler.js, handler)
    try:
        return getattr(q.Handler, 'do_' + method)(handler)
    finally:
        handler.path = saved
        for name in ('reply', 'js'):
            handler.__dict__.pop(name, None)
