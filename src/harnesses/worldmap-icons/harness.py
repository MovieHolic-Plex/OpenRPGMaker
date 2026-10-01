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
PAR = int(os.environ.get('WMI_HARNESS_PAR', '8'))
TIMEOUT_S = int(os.environ.get('WMI_HARNESS_TIMEOUT', str(20 * 60)))
SETS = ('fantasy', 'desert-east', 'modern-sf')
REASONS = ['옆면 보임(아이소)', '시점 이상', '안 읽힘', '화풍 다름', '크기·비례', '지저분함', '원래(v9)가 나음']


def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


# ─────────────────────────────── 저장소(추가만) ───────────────────────────────
def db():
    DATA.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DATA / 'harness.sqlite', timeout=30)
    c.row_factory = sqlite3.Row
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


def _prompt(it):
    t = (HERE / 'review.md').read_text(encoding='utf-8')
    w, h = json.loads(it['cells'])
    rep = {'{SET}': it['iset'], '{NAME}': it['name'], '{ROLE}': it['role'], '{ROLE_NAME}': role_names().get(it['role'], it['role']),
           '{W}': str(w), '{H}': str(h), '{DESC}': it['descr'] or '(설명 없음)', '{DIR}': str(item_dir(it['id'])), '{REF}': str(REF)}
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
        if r['decision'] == 'clear':
            out.pop(r['item'], None)
        else:
            out[r['item']] = dict(decision=r['decision'], reasons=json.loads(r['reasons'] or '[]'), note=r['note'] or '', at=r['at'])
    return out


def _latest_reviews(c):
    out = {}
    for r in c.execute("select r.* from reviews r join items i on i.id=r.item and i.sha=r.sha order by r.id"):
        out[r['item']] = dict(status=r['status'], verdict=r['verdict'], codes=json.loads(r['codes'] or '[]'),
                              body=json.loads(r['body']) if r['body'] else None, engine=r['engine'])
    return out


def export():
    c = db()
    dec, rv = _latest_decisions(c), _latest_reviews(c)
    items = {}
    for r in c.execute('select * from items order by iset, role, name'):
        x = dec.get(r['id'])
        v = rv.get(r['id'])
        items[r['id']] = dict(role=r['role'], cells=json.loads(r['cells']), sha=r['sha'],
                              decision=x['decision'] if x else None, reasons=x['reasons'] if x else [], note=x['note'] if x else '',
                              decided_at=x['at'] if x else None,
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
            return self._send(200, json.dumps(dict(items=items, reasons=REASONS, sets=list(SETS)), ensure_ascii=False))
        if p == '/ref.png':
            return self._send(200, REF.read_bytes(), 'image/png')
        if p.startswith('/f/'):
            parts = p[3:].split('/')
            if len(parts) == 3 and all(x and '..' not in x for x in parts) and parts[2].endswith('.png'):
                f = ITEMS / parts[0] / parts[1] / parts[2]
                if f.is_file():
                    return self._send(200, f.read_bytes(), 'image/png')
        return self._send(404, '{"error":"not found"}')

    def do_POST(self):
        if self.path != '/api/decide':
            return self._send(404, '{"error":"not found"}')
        try:
            d = json.loads(self.rfile.read(int(self.headers.get('Content-Length', '0'))) or b'{}')
            if d.get('decision') not in ('accept', 'reject', 'clear'):
                raise ValueError('decision')
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
    elif a.cmd == 'serve':
        serve(a.port, a.host)


if __name__ == '__main__':
    main()
