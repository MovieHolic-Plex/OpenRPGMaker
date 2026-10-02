#!/usr/bin/env python3
"""월드맵 아이콘 하네스 — 이미 만든 아이콘을 검수자가 보고, 사용자가 받기/버리기를 정한다.

  python3 src/harnesses/worldmap-icons/harness.py intake            # 세트의 아이콘을 모두 그림으로(단품 8배·지도 자리 3배·1배)
  python3 src/harnesses/worldmap-icons/harness.py review [--set S] [--redo]   # 독립 검수자(Codex) — 시점 계약 판정
  python3 src/harnesses/worldmap-icons/harness.py status
  python3 src/harnesses/worldmap-icons/harness.py serve --port 18313  # 사용자 화면
  python3 src/harnesses/worldmap-icons/harness.py export            # 결정을 harness-data/worldmap-icons/decisions.json 으로

감독은 고르지 않는다. 받기/버리기는 화면에서 사용자만 한다(client=web). 받은 것도 바로 지도·번들에 넣지 않는다 —
결정 파일을 보고 다음 단계(버린 것 다시 그리기 · 받은 것 등록)를 따로 연다.
"""
import argparse
import hashlib
import json
import re
import os
import shutil
import sqlite3
import subprocess
import sys
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent.parent
sys.path.insert(0, str(HERE))
KIT_DIR = ROOT / 'tiledata' / 'worldmap-kit'
DATA = Path(os.environ.get('WMI_HARNESS_DATA', os.path.expanduser('~/.local/share/oprn/worldmap-icon-harness')))
ITEMS = DATA / 'items'
LOGS = DATA / 'logs'
WORK = DATA / 'work'          # 검수자 작업 폴더(저장소 밖 — 저장소 AGENTS.md 를 안 싣는다)
REF = DATA / 'ref-easyrpg-x4.png'
EXPORT = ROOT / 'harness-data' / 'worldmap-icons' / 'decisions.json'
CODEX_MODEL = os.environ.get('WMI_HARNESS_CODEX_MODEL', 'gpt-6.1-sol')
EFFORT = os.environ.get('WMI_HARNESS_EFFORT', 'medium')
PAR = int(os.environ.get('WMI_HARNESS_PAR', '12'))
TIMEOUT_S = int(os.environ.get('WMI_HARNESS_TIMEOUT', str(20 * 60)))
# 세트 = iconsets/<id>/manifest.json 이 있는 폴더(_ 로 시작하는 공용 폴더 제외). 앞 셋은 처음부터 있던 세트라 순서를 고정한다.
_FIRST = ('fantasy', 'desert-east', 'modern-sf')
_ALL = sorted(p.parent.name for p in (ROOT / 'tiledata' / 'worldmap-kit' / 'iconsets').glob('*/manifest.json') if not p.parent.name.startswith('_'))
SETS = tuple(s for s in _FIRST if s in _ALL) + tuple(s for s in _ALL if s not in _FIRST)
REASONS = ['옆면 보임(아이소)', '시점 이상', '안 읽힘', '화풍 다름', '크기·비례', '지저분함', '원래(v9)가 나음']


def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


# ─────────────────────────────── 저장소(추가만) ───────────────────────────────
def db():
    DATA.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DATA / 'harness.sqlite', timeout=120)
    c.row_factory = sqlite3.Row
    c.execute('pragma journal_mode=wal')   # 화면 서버·일꾼·명령이 같이 쓴다 — 읽기가 쓰기를 막지 않게
    c.executescript('''
      create table if not exists items(id text primary key, iset text, name text, role text, cells text, descr text,
                                       place text, used int, sha text, updated text);
      create table if not exists reviews(id integer primary key, item text, sha text, engine text, status text, pid int,
                                         started text, finished text, verdict text, codes text, body text, log text);
      create table if not exists decisions(id integer primary key, item text, sha text, decision text, reasons text,
                                           note text, client text, at text);
    ''')
    return c


def _sha(p):
    return hashlib.sha1(Path(p).read_bytes()).hexdigest()[:12]


def item_dir(item_id):
    s, n = item_id.split('/', 1)
    return ITEMS / s / n


# ─────────────────────────────── intake ───────────────────────────────
def intake(sets):
    import render
    c = db()
    render.reference(REF)
    cache = DATA / 'cache'
    for s in sets:
        rows = render.render_set(s, ITEMS / s, cache)
        for r in rows:
            iid = f'{s}/{r["name"]}'
            sha = _sha(item_dir(iid) / 'icon.png')
            c.execute('insert or replace into items values(?,?,?,?,?,?,?,?,?,?)',
                      (iid, s, r['name'], r['role'], json.dumps(r['cells']), r['desc'], r['place'], int(r['used']), sha, now()))
        c.commit()
        print(f'{s}: 아이콘 {len(rows)}장 (지도 자리 없음 {sum(1 for r in rows if not r["place"])})')


# ─────────────────────────────── 검수자 ───────────────────────────────
def role_names():
    d = json.loads((KIT_DIR / 'kit' / 'roles.json').read_text())
    return {r['id']: r['name'] for r in d['roles']}


# 세트별 예외(사용자 결정). 빈 문자열이면 계약 그대로.
SET_RULES = {
    'starmap': ('- **성계 지도 세트:** 아이콘은 땅이 아니라 검은 우주 배경에 놓인다(ctx 는 임시 별 바탕). 행성·소행성·성운은 자연물처럼 `SIDE` 를 면제하고 '
                '땅 그림자가 없는 게 정상이다. 정거장·함선은 윗면+정면 계약을 따른다. 대신 `READ`(우주에서 무엇인지 읽히는가)와 `STYLE` 을 본다.'),
    'desert-east': ('- **사막·동양풍 세트 예외 (사용자 결정, 2026-10-02):** 이 세트는 3D 장면을 비스듬한 카메라로 찍은 원래 그림이 더 낫다는 사용자 판단이다 — '
                    '**옆면이 약간 보이는 것은 괜찮다**, 옆면만으로 `SIDE` 를 주지 않는다. 옆면이 정면보다 넓어 마름모로 보일 때만 `SIDE`, '
                    '윗면 전체가 평행사변형으로 크게 기울면 `DIAG`. 대신 `READ`(무엇인지 읽히는가)와 `STYLE` 을 본다.'),
    'modern-sf': ('- **현대·SF 세트 예외 (사용자 결정, 2026-10-02):** 고층 빌딩은 정면만으로는 판때기처럼 납작해지므로 '
                  '**옆면이 약간 보이는 것은 괜찮다** — 옆면만으로 `SIDE` 를 주지 않는다. 옆면이 정면보다 넓어 건물이 마름모로 보일 때만 `SIDE`, '
                  '윗면 전체가 평행사변형으로 크게 기울면 `DIAG`. 원래 세트 그림(경사 투영, 오른쪽 옆면 약간)은 이 세트의 정상 시점이다 — '
                  '그것만으로는 `SIDE`·`DIAG` 가 아니다. 대신 `READ`(무엇인지 읽히는가)와 `STYLE` 을 본다.'),
}

# 정면 카메라 장면 세트(_scene3d, camera.kx == 0). 시선이 동·서 벽과 직각이라 평평한 옆벽은 0px 다.
# 원래 빛(왼쪽 위) 때문에 원통·원뿔·모임지붕 끝·둥근 바위의 오른쪽이 어둡고, 검수자가 그 명암을 옆면으로 읽었다
# (2026-10-02, 새 세트 13개 첫 검수 FAIL 의 147건이 SIDE). 다른 코드는 엄격하게 둔다.
FRONT3D_RULE = ('- **정면 카메라 3D 장면 세트:** 이 그림은 3D 장면을 정남쪽 카메라(KX=0)로 레이캐스트한 것이라 **평평한 동·서 옆벽은 수학적으로 0px** 이다. '
                '빛이 왼쪽 위에서 오므로 원통 탑·원뿔·모임지붕(사방 경사 지붕)의 끝 경사·둥근 바위·돔의 **오른쪽이 왼쪽보다 어두운 것은 명암이지 옆면이 아니다** — '
                '그것만으로 `SIDE` 를 주지 않는다. `SIDE` 는 정면 벽 옆에 **위 모서리가 사선으로 뒤로 물러나는 별도의 세로 벽 평면**(상자의 옆면)이 실제로 보일 때만. '
                '`DIAG`·`FRONT`·`READ`·`STYLE` 은 엄격하게 본다 — 1배 지도에서 무엇인지 안 읽히거나, 정면 벽이 없어 순수 평면도로 보이거나, 칩셋 결과 다르면 떨어뜨린다.')
for _s in SETS:
    try:
        _cam = json.loads((ROOT / 'tiledata' / 'worldmap-kit' / 'iconsets' / _s / 'manifest.json').read_text()).get('camera') or {}
    except (OSError, ValueError):
        continue
    if _cam.get('kx', None) == 0:
        SET_RULES[_s] = FRONT3D_RULE + ('\n' + SET_RULES[_s] if _s in SET_RULES else '')


def set_names():
    """세트 id → manifest 의 이름(화면 탭용)."""
    out = {}
    for s in SETS:
        try:
            out[s] = json.loads((ROOT / 'tiledata' / 'worldmap-kit' / 'iconsets' / s / 'manifest.json').read_text())['name']
        except (OSError, ValueError, KeyError):
            pass
    return out


def set_rule(iset):
    return SET_RULES.get(iset, '')


def _prompt(it):
    t = (HERE / 'review.md').read_text(encoding='utf-8')
    if it['iset'] in SET_RULES:
        # 예외 세트는 「공격적으로 떨어뜨린다」 절을 뺀다 — 절이 남아 있으면 예외 한 줄을 넣어도 검수자가 SIDE 를 줬다(현대·SF 22장 중 21장).
        t = re.sub(r'## 판정 태도.*?(?=## verdict\.json)', '## 판정 태도 — 이 세트의 예외\n{SET_RULE}\n\n', t, flags=re.S)
        t = t.replace('**이번 검수에서 가장 중요하다.**', '')
    w, h = json.loads(it['cells'])
    rep = {'{SET}': it['iset'], '{NAME}': it['name'], '{ROLE}': it['role'], '{ROLE_NAME}': role_names().get(it['role'], it['role']),
           '{W}': str(w), '{H}': str(h), '{DESC}': it['descr'] or '(설명 없음)', '{DIR}': str(item_dir(it['id'])), '{REF}': str(REF), '{SET_RULE}': set_rule(it['iset'])}
    for k, v in rep.items():
        t = t.replace(k, v)
    return t


def _start(c, it):
    d = item_dir(it['id'])
    try:
        (d / 'verdict.json').unlink()
    except OSError:
        pass
    LOGS.mkdir(parents=True, exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)
    log = LOGS / (it['id'].replace('/', '__') + f'.{int(time.time())}.log')
    pf = log.with_suffix('.prompt.txt')
    pf.write_text(_prompt(it), encoding='utf-8')
    cmd = [shutil.which('codex') or os.path.expanduser('~/.local/bin/codex'), 'exec', '-m', CODEX_MODEL,
           '-c', f'model_reasoning_effort="{EFFORT}"', '--skip-git-repo-check', '-s', 'workspace-write',
           '--add-dir', str(DATA), '--add-dir', str(ROOT), '-C', str(WORK), '-']
    p = subprocess.Popen(cmd, cwd=WORK, stdin=open(pf, 'rb'), stdout=open(log, 'w'), stderr=subprocess.STDOUT,
                         start_new_session=True)
    cur = c.execute('insert into reviews(item,sha,engine,status,pid,started,log) values(?,?,?,?,?,?,?)',
                    (it['id'], it['sha'], f'codex:{CODEX_MODEL}:{EFFORT}', 'running', p.pid, now(), str(log)))
    c.commit()
    return p, cur.lastrowid, time.time()


def _finish(c, rid, it, code):
    v = item_dir(it['id']) / 'verdict.json'
    body, verdict, codes, status = None, None, '[]', 'failed'
    if v.exists():
        try:
            body = json.loads(v.read_text())
            verdict = str(body.get('verdict', '')).upper() or None
            codes = json.dumps(body.get('codes') or [], ensure_ascii=False)
            status = 'done'
        except (ValueError, OSError):
            pass
    c.execute('update reviews set status=?, finished=?, verdict=?, codes=?, body=? where id=?',
              (status, now(), verdict, codes, json.dumps(body, ensure_ascii=False) if body else None, rid))
    c.commit()
    print(f'{now()} {it["id"]}: {status} {verdict or ""} {codes} (exit {code})', flush=True)


def review(sets, redo=False, only=None):
    c = db()
    q = [dict(r) for r in c.execute('select * from items order by iset, role, name') if r['iset'] in sets]
    if only:
        q = [r for r in q if r['id'] in only or r['name'] in only]
    if not redo:
        done = {(r['item'], r['sha']) for r in c.execute("select item, sha from reviews where status='done'")}
        q = [r for r in q if (r['id'], r['sha']) not in done]
    print(f'검수 {len(q)}장, 동시 {PAR}', flush=True)
    running = []
    while q or running:
        while q and len(running) < PAR:
            it = q.pop(0)
            p, rid, t0 = _start(c, it)
            running.append((p, rid, it, t0))
        time.sleep(3)
        for tup in list(running):
            p, rid, it, t0 = tup
            code = p.poll()
            if code is None and time.time() - t0 > TIMEOUT_S:
                p.kill()
                code = 'timeout'
            if code is not None:
                running.remove(tup)
                _finish(c, rid, it, code)
    export()


def status():
    c = db()
    for s in SETS:
        n = c.execute('select count(*) from items where iset=?', (s,)).fetchone()[0]
        rv = c.execute("select verdict, count(*) from reviews r join items i on i.id=r.item and i.sha=r.sha "
                       "where i.iset=? and r.status='done' group by verdict", (s,)).fetchall()
        dec = _latest_decisions(c)
        acc = sum(1 for k, v in dec.items() if k.startswith(s + '/') and v['decision'] == 'accept')
        rej = sum(1 for k, v in dec.items() if k.startswith(s + '/') and v['decision'] == 'reject')
        print(f'{s:12s} 아이콘 {n:3d} · 검수 {dict((r[0], r[1]) for r in rv)} · 사용자 받기 {acc} 버리기 {rej}')
    for r in c.execute("select item, pid, started from reviews where status='running'"):
        print('  검수 중', r['item'], 'pid', r['pid'], r['started'])


# ─────────────────────────────── 결정 ───────────────────────────────
def _latest_decisions(c):
    """아이템마다 마지막 결정 — 그림이 바뀌었으면(sha 다름) 옛 결정은 무효."""
    sha = {r['id']: r['sha'] for r in c.execute('select id, sha from items')}
    out = {}
    for r in c.execute('select * from decisions order by id'):
        if sha.get(r['item']) != r['sha']:
            continue
        if r['decision'] == 'drop':          # 다시 그린 후보 하나를 버린 것 — 아이콘의 결정은 아니다
            continue
        if r['decision'] == 'clear':
            out.pop(r['item'], None)
        elif r['decision'] == 'pick':        # 다시 그린 후보를 고른 것. note = '<판>/<글자>|메모'
            key, _, memo = (r['note'] or '').partition('|')
            out[r['item']] = dict(decision='pick', cand=key, reasons=[], note=memo, at=r['at'])
        else:
            out[r['item']] = dict(decision=r['decision'], reasons=json.loads(r['reasons'] or '[]'), note=r['note'] or '', at=r['at'])
    return out


def _latest_reviews(c):
    out = {}
    for r in c.execute("select r.* from reviews r join items i on i.id=r.item and i.sha=r.sha order by r.id"):
        out[r['item']] = dict(status=r['status'], verdict=r['verdict'], codes=json.loads(r['codes'] or '[]'),
                              body=json.loads(r['body']) if r['body'] else None, engine=r['engine'])
    return out


def unstrict(sets):
    """감독이 엄격 기준으로 일괄로 적은 버림(client=harness-strict)을 clear 로 덮는다. 사용자가 직접 정한 것은 건드리지 않는다."""
    c = db()
    last = {}
    for r in c.execute('select * from decisions order by id'):
        if r['decision'] != 'drop':
            last[r['item']] = r
    done = []
    for it in c.execute('select * from items'):
        r = last.get(it['id'])
        if it['iset'] in sets and r and r['client'] == 'harness-strict' and r['decision'] == 'reject':
            c.execute('insert into decisions(item,sha,decision,reasons,note,client,at) values(?,?,?,?,?,?,?)',
                      (it['id'], it['sha'], 'clear', '[]', '세트 예외(사용자 2026-10-02): 옆면 약간 허용 — 엄격 일괄 버림 취소', 'harness-strict', now()))
            done.append(it['id'])
    c.commit()
    export()
    return done


def export():
    c = db()
    dec, rv = _latest_decisions(c), _latest_reviews(c)
    items = {}
    for r in c.execute('select * from items order by iset, role, name'):
        x = dec.get(r['id'])
        v = rv.get(r['id'])
        items[r['id']] = dict(role=r['role'], cells=json.loads(r['cells']), sha=r['sha'],
                              decision=x['decision'] if x else None, reasons=x['reasons'] if x else [], note=x['note'] if x else '',
                              decided_at=x['at'] if x else None, picked=x.get('cand') if x else None,
                              review=(dict(verdict=v['verdict'], codes=v['codes'], reads_as=(v['body'] or {}).get('reads_as', ''))
                                      if v and v['status'] == 'done' else None))
    EXPORT.parent.mkdir(parents=True, exist_ok=True)
    EXPORT.write_text(json.dumps(dict(schema='worldmap-icon-decisions/1', note='client=web 결정만. 감독이 쓰지 않는다.', items=items),
                                 ensure_ascii=False, indent=1) + '\n')


# ─────────────────────────────── 화면 ───────────────────────────────
class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype='application/json; charset=utf-8'):
        b = body if isinstance(body, bytes) else body.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(b)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        p = unquote(self.path.split('?')[0])
        if p in ('/', '/harness', '/index.html'):
            return self._send(200, (HERE / 'web' / 'index.html').read_bytes(), 'text/html; charset=utf-8')
        if p == '/api/state':
            c = db()
            dec, rv, rn = _latest_decisions(c), _latest_reviews(c), role_names()
            items = []
            order = {s: i for i, s in enumerate(SETS)}
            rows = sorted(c.execute('select * from items'), key=lambda r: (order.get(r['iset'], 9), r['role'], r['name']))
            for r in rows:
                items.append(dict(id=r['id'], set=r['iset'], name=r['name'], role=r['role'], role_name=rn.get(r['role'], r['role']),
                                  cells=json.loads(r['cells']), desc=r['descr'], place=r['place'], used=bool(r['used']), sha=r['sha'],
                                  review=rv.get(r['id']), decision=dec.get(r['id'])))
            return self._send(200, json.dumps(dict(items=items, reasons=REASONS, sets=list(SETS), set_names=set_names()), ensure_ascii=False))
        if p == '/ref.png':
            return self._send(200, REF.read_bytes(), 'image/png')
        if p.startswith('/api/rounds/'):
            import redraw
            return self._send(200, json.dumps(redraw.rounds_of(db(), p[len('/api/rounds/'):]), ensure_ascii=False))
        if p.startswith('/c/'):
            parts = p[3:].split('/')
            if len(parts) == 4 and all(x and '..' not in x for x in parts) and parts[3].endswith('.png'):
                import redraw
                f = redraw.ROUNDS / parts[0] / parts[1] / parts[2] / parts[3]
                if f.is_file():
                    return self._send(200, f.read_bytes(), 'image/png')
        if p.startswith('/f/'):
            parts = p[3:].split('/')
            if len(parts) == 3 and all(x and '..' not in x for x in parts) and parts[2].endswith('.png'):
                f = ITEMS / parts[0] / parts[1] / parts[2]
                if f.is_file():
                    return self._send(200, f.read_bytes(), 'image/png')
        return self._send(404, '{"error":"not found"}')

    def do_POST(self):
        if self.path == '/api/draw':
            try:
                import redraw
                d = json.loads(self.rfile.read(int(self.headers.get('Content-Length', '0'))) or b'{}')
                rid = redraw.open_round(str(d.get('id')), str(d.get('note') or ''), str(d.get('base') or ''), int(d.get('n') or 5))
                return self._send(200, json.dumps({'ok': True, 'round': rid}))
            except (ValueError, KeyError) as e:
                return self._send(400, json.dumps({'error': str(e)}, ensure_ascii=False))
        if self.path == '/api/decide_bulk':
            # 사용자가 화면에서 누른 일괄 받기/되돌리기. ids 는 화면이 고른 목록(검수 ✓ · 안 정함) — 서버는 그대로 적는다.
            try:
                d = json.loads(self.rfile.read(int(self.headers.get('Content-Length', '0'))) or b'{}')
                if d.get('decision') not in ('accept', 'clear') or not isinstance(d.get('ids'), list):
                    raise ValueError('decision/ids')
                c = db()
                sha = {r['id']: r['sha'] for r in c.execute('select id, sha from items')}
                ids = [i for i in d['ids'] if i in sha]
                note = '일괄 받기' if d['decision'] == 'accept' else '일괄 받기 되돌림'
                c.executemany('insert into decisions(item,sha,decision,reasons,note,client,at) values(?,?,?,?,?,?,?)',
                              [(i, sha[i], d['decision'], '[]', note, 'web', now()) for i in ids])
                c.commit()
                export()
                return self._send(200, json.dumps({'ok': True, 'n': len(ids)}))
            except (ValueError, KeyError) as e:
                return self._send(400, json.dumps({'error': str(e)}))
        if self.path != '/api/decide':
            return self._send(404, '{"error":"not found"}')
        try:
            d = json.loads(self.rfile.read(int(self.headers.get('Content-Length', '0'))) or b'{}')
            if d.get('decision') not in ('accept', 'reject', 'clear', 'pick', 'drop'):
                raise ValueError('decision')
            if d['decision'] in ('pick', 'drop'):   # 후보 표시는 note 앞에 '<판>/<글자>|'
                if not str(d.get('cand') or '').startswith('r'):
                    raise ValueError('cand')
                d['note'] = f"{d['cand']}|{d.get('note') or ''}"
            c = db()
            it = c.execute('select sha from items where id=?', (d.get('id'),)).fetchone()
            if not it:
                raise ValueError('id')
            c.execute('insert into decisions(item,sha,decision,reasons,note,client,at) values(?,?,?,?,?,?,?)',
                      (d['id'], it['sha'], d['decision'], json.dumps(d.get('reasons') or [], ensure_ascii=False),
                       str(d.get('note') or '')[:2000], 'web', now()))
            c.commit()
            export()
            return self._send(200, '{"ok":true}')
        except (ValueError, KeyError) as e:
            return self._send(400, json.dumps({'error': str(e)}))


def serve(port, host):
    db()
    print(f'월드맵 아이콘 하네스 화면: http://{host}:{port}/', flush=True)
    ThreadingHTTPServer((host, port), H).serve_forever()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    a = sub.add_parser('intake'); a.add_argument('--set', action='append', choices=SETS)
    a = sub.add_parser('review'); a.add_argument('--set', action='append', choices=SETS); a.add_argument('--redo', action='store_true')
    a.add_argument('--only', nargs='*', help='아이템 id(세트/이름) 또는 이름')
    sub.add_parser('status')
    sub.add_parser('export')
    a = sub.add_parser('draw', help='다시 그리기 판 열기'); a.add_argument('item'); a.add_argument('--note', default='')
    a.add_argument('--base', default='', help="'r<판>/<글자>' = 그 후보에서 출발"); a.add_argument('-n', type=int, default=5)
    sub.add_parser('pool', help='다시 그리기 일꾼(draw 가 알아서 띄운다)')
    a = sub.add_parser('restrict', help='끝난 합격 후보에 엄격 검수를 다시 적용(떨어지면 다시 그림·끝내 폐기)'); a.add_argument('--round', type=int, action='append')
    a = sub.add_parser('purge', help='사용자 미결정 아이콘 중 투영 세트·엄격 불합격을 버리고 다시 그리기 판을 연다'); a.add_argument('--set', action='append', choices=SETS)
    a.add_argument('-n', type=int, default=3)
    a = sub.add_parser('front', help='투영 렌더러 세트를 같은 3D 장면 그대로 정면 카메라로 다시 찍어 후보(R)로 올린다'); a.add_argument('--set', action='append')
    a = sub.add_parser('hand', help='감독이 손으로 고친 그림을 후보로 올린다'); a.add_argument('item'); a.add_argument('script'); a.add_argument('--note', default='')
    a = sub.add_parser('unstrict', help='감독이 엄격 기준으로 적은 버림(client=harness-strict)을 지운다 — 사용자 결정 전으로'); a.add_argument('--set', action='append', required=True)
    a = sub.add_parser('preview', help='작업자 자가 확인: <폴더>/cand.png → 8배·지도 자리·check.json'); a.add_argument('out'); a.add_argument('--item')
    a = sub.add_parser('serve'); a.add_argument('--port', type=int, default=18313); a.add_argument('--host', default='0.0.0.0')
    a = ap.parse_args()
    if a.cmd == 'intake':
        intake(a.set or SETS)
    elif a.cmd == 'review':
        review(a.set or SETS, a.redo, a.only)
    elif a.cmd == 'status':
        status()
    elif a.cmd == 'export':
        export()
    elif a.cmd == 'draw':
        import redraw
        print('판', redraw.open_round(a.item, a.note, a.base, a.n))
    elif a.cmd == 'restrict':
        import redraw
        print('다시 검수', redraw.restrict(a.round))
    elif a.cmd == 'purge':
        import redraw
        rej, op = redraw.purge(a.set or SETS, a.n, ('A', 'B', 'C', 'D', 'E')[:a.n])
        print(f'버림 {len(rej)} · 새 판 {len(op)}')
        for x in rej:
            print(' ', x)
    elif a.cmd == 'front':
        import front
        for x in front.add_candidates(tuple(a.set) if a.set else front.FRONT_SETS):
            print(' ', *x)
    elif a.cmd == 'hand':
        import redraw
        print(redraw.add_hand(a.item, a.script, a.note))
    elif a.cmd == 'unstrict':
        print('지움', len(unstrict(a.set)))
    elif a.cmd == 'pool':
        import redraw
        redraw.pool()
    elif a.cmd == 'preview':
        import redraw
        redraw.preview(a.out, a.item)
    elif a.cmd == 'serve':
        serve(a.port, a.host)


if __name__ == '__main__':
    main()
