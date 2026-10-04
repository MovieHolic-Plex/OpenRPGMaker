"""슈퍼하네스 기록 — 개념 큐·작업·진행 로그·설정. SQLite 한 파일(~/.local/share/oprn/super-harness/sh.sqlite)."""
import json
import os
import sqlite3
import threading
import time

DATA = os.environ.get('SUPER_HARNESS_DATA', os.path.expanduser('~/.local/share/oprn/super-harness'))
DB = os.path.join(DATA, 'sh.sqlite')
_lock = threading.RLock()

# 개념이 지나가는 칸. 화면의 칸 순서와 같다.
STAGES = ['discovered', 'plan', 'plan-review', 'survey', 'material-review', 'art-review', 'art-context-review', 'waiting', 'art', 'build', 'review', 'probe', 'bake', 'done', 'blocked', 'discarded', 'unbake']
ACTIVE = ('plan', 'plan-review', 'survey', 'material-review', 'art-context-review', 'build', 'review', 'probe', 'bake', 'unbake')

DEFAULT_SETTINGS = {
    'paused': '0',
    'max_active': '8',          # 동시에 만드는 개념 수 (2026-10-03 사용자 「큐 늘려서 빠르게 많이」)
    'max_codex': '16',          # 동시에 도는 codex 작업 수
    'max_art_revisions': '2',   # 조립 검수 실패 후 자동 재생성 상한 (개념별 brief가 더 낮으면 우선)
    'max_art': '1',            # 칩 제작은 격리 워크트리 하나씩, 후보 선택은 사람
    'max_probe': '4',           # 동시에 도는 조수 시험(qa:game gen) 수 — 판마다 메모리 2~3GB
    'min_waiting': '8',         # 발견 칸에 이만큼 쌓여 있지 않으면 낱말을 더 찾는다
    'max_attempts': '3',        # 만들기 재시도 상한 — 넘으면 막힘
    'discover_every_min': '10',
}


def now():
    return time.strftime('%Y-%m-%dT%H:%M:%S')


def connect():
    os.makedirs(DATA, exist_ok=True)
    con = sqlite3.connect(DB, timeout=30, check_same_thread=False)
    con.row_factory = sqlite3.Row
    con.execute('PRAGMA journal_mode=WAL')
    return con


def init():
    with _lock, connect() as con:
        con.executescript('''
        CREATE TABLE IF NOT EXISTS concepts(
          id TEXT PRIMARY KEY, title TEXT, aliases TEXT, why TEXT, source TEXT, priority REAL,
          stage TEXT, status TEXT, attempt INTEGER DEFAULT 1, created TEXT, updated TEXT,
          feedback TEXT DEFAULT '[]', reasons TEXT DEFAULT '[]', pr TEXT, note TEXT);
        CREATE TABLE IF NOT EXISTS jobs(
          id INTEGER PRIMARY KEY AUTOINCREMENT, concept TEXT, kind TEXT, tag TEXT, status TEXT,
          pid INTEGER, log TEXT, started TEXT, ended TEXT, result TEXT);
        CREATE TABLE IF NOT EXISTS log(
          id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT, concept TEXT, text TEXT);
        CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE IF NOT EXISTS art_selections(
          concept TEXT NOT NULL, group_id TEXT NOT NULL, candidate_id TEXT NOT NULL,
          fingerprint TEXT NOT NULL, source_json TEXT NOT NULL, selected_at TEXT NOT NULL,
          PRIMARY KEY(concept,group_id));
        CREATE TABLE IF NOT EXISTS gaps(
          id INTEGER PRIMARY KEY AUTOINCREMENT, concept TEXT, kind TEXT, what TEXT, route TEXT,
          status TEXT DEFAULT 'open', created TEXT);
        ''')
        cols = {r[1] for r in con.execute('PRAGMA table_info(concepts)')}
        if 'parent' not in cols:
            con.execute('ALTER TABLE concepts ADD COLUMN parent TEXT')
        if 'requires' not in cols:
            con.execute("ALTER TABLE concepts ADD COLUMN requires TEXT DEFAULT '[]'")
        for field in ('art_revision', 'art_review_attempt'):
            if field not in cols: con.execute(f'ALTER TABLE concepts ADD COLUMN {field} INTEGER DEFAULT 0')
        gcols = {r[1] for r in con.execute('PRAGMA table_info(gaps)')}
        if 'item' not in gcols:
            con.execute('ALTER TABLE gaps ADD COLUMN item TEXT')
        if 'children_spawned' not in cols:
            con.execute('ALTER TABLE concepts ADD COLUMN children_spawned INTEGER DEFAULT 0')
        version = con.execute("SELECT value FROM settings WHERE key='material_gate_version'").fetchone()
        if not version or version[0] != '2':
            # 기존 초안·그림은 보존하고, 배포 전의 모든 개념을 새 재료 관문 앞으로 옮긴다.
            con.execute("UPDATE concepts SET stage='survey', status='queued', note='재료 관문 재확인 — 이전 초안은 보존됨' WHERE stage NOT IN ('done','discarded','unbake')")
            con.execute("INSERT OR REPLACE INTO settings VALUES('material_gate_version','2')")
            con.execute("INSERT OR REPLACE INTO settings VALUES('paused','1')")
        if 'plan_attempt' not in cols:
            con.execute('ALTER TABLE concepts ADD COLUMN plan_attempt INTEGER DEFAULT 1')
        planning = con.execute("SELECT value FROM settings WHERE key='planning_gate_version'").fetchone()
        if not planning or planning[0] != '1':
            con.execute("UPDATE concepts SET stage='plan', status='queued', note='기획·텍스트 도면 관문 재확인 — 이전 초안 보존' WHERE stage NOT IN ('done','discarded','unbake')")
            con.execute("INSERT OR REPLACE INTO settings VALUES('planning_gate_version','1')")
            con.execute("INSERT OR REPLACE INTO settings VALUES('paused','1')")
        # 폐기한 하루 상한은 기존 저장소에서도 제거한다.
        con.execute("DELETE FROM settings WHERE key IN ('budget_codex_day', 'budget_probe_day')")
        for k, v in DEFAULT_SETTINGS.items():
            con.execute('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)', (k, v))


def setting(key):
    with _lock, connect() as con:
        row = con.execute('SELECT value FROM settings WHERE key=?', (key,)).fetchone()
    return row['value'] if row else DEFAULT_SETTINGS.get(key)


def set_setting(key, value):
    with _lock, connect() as con:
        con.execute('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)', (key, str(value)))


def log(concept, text):
    with _lock, connect() as con:
        con.execute('INSERT INTO log(at,concept,text) VALUES(?,?,?)', (now(), concept, text))


def concepts(where='1=1', args=()):
    with _lock, connect() as con:
        rows = con.execute(f'SELECT * FROM concepts WHERE {where} ORDER BY priority DESC, created', args).fetchall()
    return [_concept(r) for r in rows]


def concept(cid):
    found = concepts('id=?', (cid,))
    return found[0] if found else None


def _concept(r):
    d = dict(r)
    for k in ('aliases', 'feedback', 'reasons', 'requires'):
        d[k] = json.loads(d.get(k) or '[]')
    return d


def add_concept(cid, title, aliases, why, source, priority, parent=None):
    with _lock, connect() as con:
        if con.execute('SELECT 1 FROM concepts WHERE id=?', (cid,)).fetchone():
            return False
        con.execute('INSERT INTO concepts(id,title,aliases,why,source,priority,stage,status,created,updated,parent) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
                    (cid, title, json.dumps(aliases, ensure_ascii=False), why, source, priority, 'discovered', 'queued', now(), now(), parent))
    log(cid, f'발견 — {why}')
    return True


def update_concept(cid, **fields):
    for k in ('aliases', 'feedback', 'reasons', 'requires'):
        if k in fields and not isinstance(fields[k], str):
            fields[k] = json.dumps(fields[k], ensure_ascii=False)
    fields['updated'] = now()
    cols = ', '.join(f'{k}=?' for k in fields)
    with _lock, connect() as con:
        con.execute(f'UPDATE concepts SET {cols} WHERE id=?', (*fields.values(), cid))


def add_job(concept, kind, tag, log_path):
    with _lock, connect() as con:
        cur = con.execute('INSERT INTO jobs(concept,kind,tag,status,log,started) VALUES(?,?,?,?,?,?)',
                          (concept, kind, tag, 'running', log_path, now()))
        return cur.lastrowid


def update_job(jid, **fields):
    if 'result' in fields and not isinstance(fields['result'], str):
        fields['result'] = json.dumps(fields['result'], ensure_ascii=False)
    cols = ', '.join(f'{k}=?' for k in fields)
    with _lock, connect() as con:
        con.execute(f'UPDATE jobs SET {cols} WHERE id=?', (*fields.values(), jid))


def jobs(where='1=1', args=(), limit=400):
    with _lock, connect() as con:
        rows = con.execute(f'SELECT * FROM jobs WHERE {where} ORDER BY id DESC LIMIT {int(limit)}', args).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d['result'] = json.loads(d['result']) if d['result'] else None
        out.append(d)
    return out


def started_today(kinds):
    day = time.strftime('%Y-%m-%d')
    marks = ','.join('?' * len(kinds))
    with _lock, connect() as con:
        return con.execute(f"SELECT COUNT(*) FROM jobs WHERE started LIKE ? AND kind IN ({marks})", (day + '%', *kinds)).fetchone()[0]


def recent_log(limit=200, concept=None):
    with _lock, connect() as con:
        if concept:
            rows = con.execute('SELECT * FROM log WHERE concept=? ORDER BY id DESC LIMIT ?', (concept, limit)).fetchall()
        else:
            rows = con.execute('SELECT * FROM log ORDER BY id DESC LIMIT ?', (limit,)).fetchall()
    return [dict(r) for r in rows]


def add_gap(concept, kind, what, route, item=None):
    item_json = json.dumps(item, ensure_ascii=False) if item else None
    with _lock, connect() as con:
        if con.execute('SELECT 1 FROM gaps WHERE concept=? AND what=?', (concept, what)).fetchone():
            if item_json:
                con.execute('UPDATE gaps SET item=? WHERE concept=? AND what=?', (item_json, concept, what))
            return
        con.execute('INSERT INTO gaps(concept,kind,what,route,created,item) VALUES(?,?,?,?,?,?)', (concept, kind, what, route, now(), item_json))


def gaps():
    with _lock, connect() as con:
        rows = [dict(r) for r in con.execute('SELECT * FROM gaps ORDER BY id DESC').fetchall()]
    for r in rows:
        r['item'] = json.loads(r['item']) if r.get('item') else None
    return rows
