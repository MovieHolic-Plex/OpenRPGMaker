#!/usr/bin/env python3
"""고르는 화면의 선택·메모 정본 = SQLite (표준 라이브러리 sqlite3, WAL, synchronous=FULL).

DB: ~/.local/share/oprn/hand-interior-pick/picks.sqlite  (저장소 밖 — 워크트리가 지워져도 남는다. HIP_DB 로 바꿀 수 있다)
  events     추가만 하는 이력. UPDATE/DELETE 하지 않는다. 한 줄 = 한 번의 저장과 **그 뒤의 전체 상태**(choice·note·variants·note_at).
  current    events 에서 파생되는 지금 상태. events 와 같은 트랜잭션에서 갱신한다.
  addressed  감독자·에이전트가 적는 「메모 반영」 {item_id: at, summary} (옛 addressed.json 대체). 바꿀 때마다 addressed_log 에도 추가.

picks.json·addressed.json 은 **내보내기**다(apply_picks.py·make_jobs.py 호환, 커밋용). 쓰기 뒤마다 원자적으로 다시 쓴다.
직접 고쳐도 DB 에 반영되지 않고 다음 저장 때 덮인다(덮기 전 다른 내용이면 backups/ 에 사본을 남긴다).

CLI:
  python3 scripts/content/hand-interior-pick/picks_db.py address <id> "<요약>"   메모 반영 기록
  python3 scripts/content/hand-interior-pick/picks_db.py history <id>            그 기물의 이력
  python3 scripts/content/hand-interior-pick/picks_db.py show [<id>]             현재 상태(JSON)
  python3 scripts/content/hand-interior-pick/picks_db.py export                  picks.json·addressed.json 다시 쓰기
  python3 scripts/content/hand-interior-pick/picks_db.py verify                  picks.json 과 DB 대조
  python3 scripts/content/hand-interior-pick/picks_db.py import                  빈 DB 에만: picks.json·addressed.json 을 import 이벤트로
  python3 scripts/content/hand-interior-pick/picks_db.py backup                  지금 백업 하나(최근 14개 유지)
  python3 scripts/content/hand-interior-pick/picks_db.py restore <이벤트 id>     그 이벤트의 레코드를 시각(at·noteAt)까지 그대로 새 이벤트로
"""
import datetime, glob, hashlib, json, os, shutil, sqlite3, sys, threading

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
PICK = os.environ.get('HIP_PICK', os.path.join(ROOT, 'tiledata', 'hand-interior', 'pick'))   # 시험용으로만 바꾼다
PICKS_JSON = os.path.join(PICK, 'picks.json')
ADDRESSED_JSON = os.path.join(PICK, 'addressed.json')
DATA = os.path.expanduser(os.environ.get('HIP_DATA', '~/.local/share/oprn/hand-interior-pick'))
DB = os.environ.get('HIP_DB', os.path.join(DATA, 'picks.sqlite'))
BACKUPS = os.path.join(DATA, 'backups')
KEEP = 14
LOCK = threading.RLock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS events(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  item_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('pick','note','variants','clear','import')),
  choice TEXT, note TEXT, variants_json TEXT, note_at TEXT,
  client TEXT);
CREATE INDEX IF NOT EXISTS events_item ON events(item_id, id);
CREATE TRIGGER IF NOT EXISTS events_no_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT, 'events 는 추가만'); END;
CREATE TRIGGER IF NOT EXISTS events_no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT, 'events 는 추가만'); END;
CREATE TABLE IF NOT EXISTS current(
  item_id TEXT PRIMARY KEY, choice TEXT, note TEXT, variants_json TEXT, at TEXT NOT NULL, note_at TEXT);
CREATE TABLE IF NOT EXISTS addressed(item_id TEXT PRIMARY KEY, at TEXT NOT NULL, summary TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS addressed_log(id INTEGER PRIMARY KEY AUTOINCREMENT, item_id TEXT NOT NULL, at TEXT NOT NULL,
  summary TEXT NOT NULL, client TEXT);
CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
"""

_conn = None

def now():
    return datetime.datetime.now().astimezone().isoformat(timespec='seconds')

def conn():
    global _conn
    with LOCK:
        if _conn is None:
            os.makedirs(os.path.dirname(DB), exist_ok=True)
            c = sqlite3.connect(DB, check_same_thread=False, isolation_level=None, timeout=30)
            c.row_factory = sqlite3.Row
            c.execute('PRAGMA journal_mode=WAL'); c.execute('PRAGMA synchronous=FULL'); c.execute('PRAGMA foreign_keys=ON')
            c.executescript(SCHEMA)
            _conn = c
        return _conn

class tx:
    """BEGIN IMMEDIATE … COMMIT (예외면 ROLLBACK). 프로세스 안에서는 LOCK 으로 한 번에 하나."""
    def __enter__(self):
        LOCK.acquire(); self.c = conn(); self.c.execute('BEGIN IMMEDIATE'); return self.c
    def __exit__(self, et, e, tb):
        try:
            self.c.execute('COMMIT' if et is None else 'ROLLBACK')
        finally:
            LOCK.release()
        return False

# ── 레코드 ↔ 행 (picks.json 의 모양 {at, choice, note, noteAt?, variants?} 를 그대로 되살린다) ──
def row_to_rec(r):
    rec = dict(at=r['at'], choice=r['choice'], note=r['note'] if r['note'] is not None else '')
    if r['note_at'] is not None: rec['noteAt'] = r['note_at']
    if r['variants_json']:
        vs = json.loads(r['variants_json'])
        if vs: rec['variants'] = vs
    return rec

def rec_cols(rec):
    vs = rec.get('variants') or []
    return (rec.get('choice'), rec.get('note', ''), json.dumps(vs, ensure_ascii=False) if vs else None, rec.get('at'), rec.get('noteAt'))

def current_all(c=None):
    c = c or conn()
    with LOCK:
        return {r['item_id']: row_to_rec(r) for r in c.execute('SELECT * FROM current ORDER BY item_id')}

def current_one(c, item):
    r = c.execute('SELECT * FROM current WHERE item_id=?', (item,)).fetchone()
    return row_to_rec(r) if r else None

def addressed_all(c=None):
    c = c or conn()
    with LOCK:
        return {r['item_id']: dict(at=r['at'], summary=r['summary']) for r in c.execute('SELECT * FROM addressed ORDER BY item_id')}

def _event(c, item, kind, rec, client, at=None):
    choice, note, vj, rat, nat = rec_cols(rec) if rec else (None, None, None, None, None)
    cur = c.execute('INSERT INTO events(at,item_id,kind,choice,note,variants_json,note_at,client) VALUES(?,?,?,?,?,?,?,?)',
                    (at or rat or now(), item, kind, choice, note, vj, nat, client))
    if rec is None:
        c.execute('DELETE FROM current WHERE item_id=?', (item,))
    else:
        c.execute('INSERT INTO current(item_id,choice,note,variants_json,at,note_at) VALUES(?,?,?,?,?,?) '
                  'ON CONFLICT(item_id) DO UPDATE SET choice=excluded.choice, note=excluded.note, '
                  'variants_json=excluded.variants_json, at=excluded.at, note_at=excluded.note_at',
                  (item, choice, note, vj, rat, nat))
    return cur.lastrowid

def _kind(cur, rec, body):
    if rec['choice'] != cur.get('choice') or not cur: return 'pick'
    if rec.get('variants', []) != cur.get('variants', []): return 'variants'
    if rec['note'] != cur.get('note', ''): return 'note'
    return 'pick' if 'choice' in body else 'note' if 'note' in body else 'variants'

def apply(item, body, client='web', keep_note_at=None):
    """옛 pick_server 의 POST /api/pick 규칙 그대로. body 에 없는 키(choice·note·variants)는 기존 값 유지.
    한 트랜잭션에서 events 추가 + current 갱신. 커밋 뒤 (새 레코드|None, 이벤트 id) 를 돌려준다."""
    with tx() as c:
        cur = current_one(c, item) or {}
        if body.get('clear'):
            eid = _event(c, item, 'clear', None, client, at=now())
            return None, eid
        t = now()
        note = body.get('note', cur.get('note', ''))
        if note is None: note = ''
        rec = dict(choice=body.get('choice') if 'choice' in body else cur.get('choice'), note=note, at=t)
        if note:   # 메모가 바뀐 때만 noteAt 을 새로 — 「메모 반영됨(?)」 판정의 기준
            rec['noteAt'] = t if note != cur.get('note', '') else cur.get('noteAt', cur.get('at', t))
            if keep_note_at: rec['noteAt'] = keep_note_at   # 되돌리기: 그 메모를 처음 쓴 시각을 그대로(반영 판정이 안 흔들리게)
        vs = body['variants'] if 'variants' in body else cur.get('variants', [])
        vs = [v for k, v in enumerate(vs) if v != rec['choice'] and v not in vs[:k]]   # 주 선택·중복 제외, 순서 유지
        if vs: rec['variants'] = vs
        eid = _event(c, item, _kind(cur, rec, body), rec, client)
        return rec, eid

def restore_exact(eid, client='restore'):
    """과거 이벤트 뒤의 레코드를 **시각(at·noteAt)까지 그대로** 새 이벤트로 다시 적는다. 시험·사고 복구용(CLI restore)."""
    r = event(eid)
    if r is None: raise KeyError('없는 이벤트 %s' % eid)
    with tx() as c:
        cur = current_one(c, r['item_id']) or {}
        if r['kind'] == 'clear':
            return r['item_id'], (None, _event(c, r['item_id'], 'clear', None, client, at=now()))
        rec = row_to_rec(r)
        return r['item_id'], (rec, _event(c, r['item_id'], _kind(cur, rec, {'choice': 1}), rec, client))

def history(item, limit=500):
    with LOCK:
        rows = conn().execute('SELECT * FROM events WHERE item_id=? ORDER BY id DESC LIMIT ?', (item, limit)).fetchall()
    out = []
    for r in rows:
        out.append(dict(id=r['id'], at=r['at'], kind=r['kind'], choice=r['choice'], note=r['note'], client=r['client'],
                        noteAt=r['note_at'], variants=json.loads(r['variants_json']) if r['variants_json'] else []))
    return out

def event(eid):
    with LOCK:
        r = conn().execute('SELECT * FROM events WHERE id=?', (eid,)).fetchone()
    return r

def revert(eid, client='revert'):
    """과거 이벤트 뒤의 상태를 **새 이벤트로** 다시 적용한다(이력은 지우지 않는다)."""
    r = event(eid)
    if r is None: raise KeyError('없는 이벤트 %s' % eid)
    if r['kind'] == 'clear':
        return r['item_id'], apply(r['item_id'], {'clear': True}, client)
    body = dict(choice=r['choice'], note=r['note'] or '', variants=json.loads(r['variants_json']) if r['variants_json'] else [])
    return r['item_id'], apply(r['item_id'], body, client, keep_note_at=r['note_at'])

def set_addressed(item, summary, client='cli', at=None):
    with tx() as c:
        at = at or now()
        c.execute('INSERT INTO addressed(item_id,at,summary) VALUES(?,?,?) ON CONFLICT(item_id) DO UPDATE SET at=excluded.at, summary=excluded.summary',
                  (item, at, summary))
        c.execute('INSERT INTO addressed_log(item_id,at,summary,client) VALUES(?,?,?,?)', (item, at, summary, client))
    return dict(at=at, summary=summary)

# ── 내보내기 ──
def dumps_picks(p):
    return json.dumps(p, ensure_ascii=False, indent=1, sort_keys=True) + '\n'

def _sha(path):
    try: return hashlib.sha256(open(path, 'rb').read()).hexdigest()
    except OSError: return None

def _meta(c, k, v=None):
    if v is None:
        r = c.execute('SELECT v FROM meta WHERE k=?', (k,)).fetchone(); return r['v'] if r else None
    c.execute('INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v', (k, v))

def _atomic(path, text):
    tmp = path + '.tmp%d' % os.getpid()
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(text); f.flush(); os.fsync(f.fileno())
    os.replace(tmp, path)

def export():
    """picks.json·addressed.json 을 DB 에서 다시 쓴다. 지난 내보내기 뒤 누가 파일을 직접 고쳤으면 덮기 전에 backups/ 에 사본."""
    with LOCK:
        c = conn()
        for path, key, text in ((PICKS_JSON, 'export_picks_sha', dumps_picks(current_all(c))),
                                (ADDRESSED_JSON, 'export_addressed_sha', dumps_picks(addressed_all(c)))):
            old = _sha(path); last = _meta(c, key)
            new = hashlib.sha256(text.encode('utf-8')).hexdigest()
            if old == new:
                if last != new: _meta(c, key, new)
                continue
            if old and last and old != last:
                os.makedirs(BACKUPS, exist_ok=True)
                shutil.copy2(path, os.path.join(BACKUPS, 'divergent-%s-%s' % (datetime.datetime.now().strftime('%Y%m%d-%H%M%S'), os.path.basename(path))))
            _atomic(path, text); _meta(c, key, new)

def sync_addressed_file():
    """옛 습관 호환: 누가 addressed.json 을 직접 고쳤으면(지난 내보내기와 다르면) 달라진 항목을 DB 에 넣고 다시 내보낸다. 지우기는 반영 안 함."""
    with LOCK:
        c = conn(); sha = _sha(ADDRESSED_JSON)
        if sha is None or sha == _meta(c, 'export_addressed_sha'): return 0
        try: f = json.load(open(ADDRESSED_JSON, encoding='utf-8'))
        except (OSError, ValueError): return 0
        db = addressed_all(c); n = 0
        for k, a in f.items():
            if isinstance(a, dict) and db.get(k) != dict(at=a.get('at'), summary=a.get('summary', '')):
                set_addressed(k, a.get('summary', ''), client='file:addressed.json', at=a.get('at') or now()); n += 1
        export(); return n

# ── 이전 ──
def import_json():
    """빈 DB 에만. picks.json 레코드 하나 = kind='import' 이벤트 하나(시각은 레코드의 at)."""
    picks = json.load(open(PICKS_JSON, encoding='utf-8')) if os.path.exists(PICKS_JSON) else {}
    addressed = json.load(open(ADDRESSED_JSON, encoding='utf-8')) if os.path.exists(ADDRESSED_JSON) else {}
    with tx() as c:
        if c.execute('SELECT COUNT(*) FROM events').fetchone()[0]:
            raise RuntimeError('DB 에 이미 이벤트가 있다 — import 는 빈 DB 에만')
        for item in sorted(picks):
            _event(c, item, 'import', picks[item], 'import:picks.json')
        for item in sorted(addressed):
            a = addressed[item]
            c.execute('INSERT INTO addressed(item_id,at,summary) VALUES(?,?,?)', (item, a['at'], a.get('summary', '')))
            c.execute('INSERT INTO addressed_log(item_id,at,summary,client) VALUES(?,?,?,?)', (item, a['at'], a.get('summary', ''), 'import:addressed.json'))
        _meta(c, 'export_picks_sha', _sha(PICKS_JSON) or ''); _meta(c, 'export_addressed_sha', _sha(ADDRESSED_JSON) or '')
        _meta(c, 'imported_at', now())
    return len(picks), len(addressed)

def ensure_imported():
    with LOCK:
        if conn().execute('SELECT COUNT(*) FROM events').fetchone()[0] == 0 and os.path.exists(PICKS_JSON):
            n = import_json(); print('picks_db: 이전 %d 선택 · %d 반영 기록' % n, flush=True); verify(verbose=True)

def verify(verbose=False):
    """picks.json·addressed.json 과 DB current/addressed 를 건수·내용으로 대조."""
    picks = json.load(open(PICKS_JSON, encoding='utf-8')) if os.path.exists(PICKS_JSON) else {}
    addressed = json.load(open(ADDRESSED_JSON, encoding='utf-8')) if os.path.exists(ADDRESSED_JSON) else {}
    db, da = current_all(), addressed_all()
    diff = [k for k in sorted(set(picks) | set(db)) if picks.get(k) != db.get(k)]
    adiff = [k for k in sorted(set(addressed) | set(da)) if addressed.get(k) != da.get(k)]
    same_bytes = open(PICKS_JSON, encoding='utf-8').read() == dumps_picks(db) if os.path.exists(PICKS_JSON) else None
    ok = not diff and not adiff
    msg = ('picks.json %d건 / DB current %d건 · 내용 다름 %d · 바이트 동일 %s · addressed.json %d / DB %d · 다름 %d → %s'
           % (len(picks), len(db), len(diff), same_bytes, len(addressed), len(da), len(adiff), '일치' if ok else '불일치'))
    if verbose or not ok: print('picks_db verify: ' + msg, flush=True)
    for k in diff[:20]: print('  다름', k, 'json=', picks.get(k), 'db=', db.get(k))
    for k in adiff[:20]: print('  반영 다름', k, addressed.get(k), da.get(k))
    return ok

# ── 백업 ──
def backup(tag='auto'):
    os.makedirs(BACKUPS, exist_ok=True)
    dest = os.path.join(BACKUPS, 'picks-%s-%s.sqlite' % (datetime.datetime.now().strftime('%Y%m%d-%H%M%S'), tag))
    with LOCK:
        d = sqlite3.connect(dest)
        try: conn().backup(d)
        finally: d.close()
    olds = sorted(glob.glob(os.path.join(BACKUPS, 'picks-*.sqlite')))
    for p in olds[:-KEEP]: os.remove(p)
    return dest

def backup_loop(stop_event=None):
    """시작할 때 하나, 그 뒤 하루에 하나."""
    def run():
        try: print('picks_db 백업:', backup('start'), flush=True)
        except Exception as e: print('picks_db 백업 실패:', repr(e), flush=True)
        while not (stop_event and stop_event.is_set()):
            if stop_event: stop_event.wait(86400)
            else: threading.Event().wait(86400)
            try: print('picks_db 백업:', backup('daily'), flush=True)
            except Exception as e: print('picks_db 백업 실패:', repr(e), flush=True)
    t = threading.Thread(target=run, name='picks-backup', daemon=True); t.start(); return t

def main(argv):
    if not argv: print(__doc__); return 2
    cmd, args = argv[0], argv[1:]
    if cmd == 'address':
        if len(args) != 2: print('사용: address <id> "<요약>"'); return 2
        print(json.dumps({args[0]: set_addressed(args[0], args[1])}, ensure_ascii=False)); export(); return 0
    if cmd == 'history':
        for e in reversed(history(args[0])):
            print('#%d %s %-8s choice=%s variants=%s note=%r (%s)' % (e['id'], e['at'], e['kind'], e['choice'], e['variants'], e['note'], e['client']))
        return 0
    if cmd == 'show':
        cur = current_all(); print(json.dumps(cur.get(args[0]) if args else cur, ensure_ascii=False, indent=1)); return 0
    if cmd == 'export': export(); print('내보냄', PICKS_JSON); return 0
    if cmd == 'verify': return 0 if verify(verbose=True) else 1
    if cmd == 'import': print('이전 %d 선택 · %d 반영 기록' % import_json()); return 0 if verify(verbose=True) else 1
    if cmd == 'backup': print(backup('manual')); return 0
    if cmd == 'restore':   # restore <이벤트 id> — 그 이벤트의 레코드를 시각까지 그대로 다시 적는다
        i, (rec, eid) = restore_exact(int(args[0])); print(json.dumps({'id': i, 'event': eid, 'pick': rec}, ensure_ascii=False)); export(); return 0
    print(__doc__); return 2

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
