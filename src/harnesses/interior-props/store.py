"""소품 하네스 기록 — SQLite (저장소 밖, 워크트리가 지워져도 남는다).

DB: ~/.local/share/oprn/prop-harness/harness.sqlite  (PROP_HARNESS_DATA 로 폴더를 바꿀 수 있다)
  rounds    한 기물에 대한 「한 판」(후보 N장을 한꺼번에 찍는다). 후보 이름 = h<판 번호>-<A..E>
  runs      판 안의 작업자 한 명(= 후보 한 장). queued → running → done | failed
            phase = draw(그리기) | review(검수). 한 장은 그리기 → 깨짐 검사 → 검수를 돌고, 떨어지면 attempt+1 로 다시 그린다.
            review = 마지막 검수 결과(json), history = 지난 시도들의 탈락 이유(json 목록)
  feedback  사용자의 판정(pick·reject·keep)·이유·메모. 추가만 한다 — 다음 판의 작업지시서가 읽는다.
고른 결과(어느 후보를 시트에 쓰나)의 정본은 여전히 picks.sqlite(picks_db.py)다. 여기는 하네스 진행·피드백만.
"""
import datetime, json, os, sqlite3, threading

DATA = os.environ.get('PROP_HARNESS_DATA', os.path.expanduser('~/.local/share/oprn/prop-harness'))
DB = os.path.join(DATA, 'harness.sqlite')
LOCK = threading.RLock()
_C = None

SCHEMA = '''
CREATE TABLE IF NOT EXISTS rounds(id INTEGER PRIMARY KEY AUTOINCREMENT, item TEXT NOT NULL, created TEXT NOT NULL,
  note TEXT DEFAULT '', base TEXT DEFAULT '', n INTEGER NOT NULL, model TEXT, effort TEXT, root TEXT, brief TEXT);
CREATE TABLE IF NOT EXISTS runs(id INTEGER PRIMARY KEY AUTOINCREMENT, round INTEGER NOT NULL, letter TEXT NOT NULL,
  direction TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', pid INTEGER, started TEXT, ended TEXT, log TEXT,
  ok INTEGER, error TEXT, UNIQUE(round, letter));
CREATE TABLE IF NOT EXISTS feedback(id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, item TEXT NOT NULL,
  round INTEGER, cand TEXT, verdict TEXT NOT NULL, reasons TEXT DEFAULT '[]', note TEXT DEFAULT '');
'''


def now():
    return datetime.datetime.now().astimezone().isoformat(timespec='seconds')


def conn():
    global _C
    with LOCK:
        if _C is None:
            os.makedirs(DATA, exist_ok=True)
            _C = sqlite3.connect(DB, check_same_thread=False, isolation_level=None, timeout=30)
            _C.row_factory = sqlite3.Row
            _C.execute('PRAGMA journal_mode=WAL'); _C.execute('PRAGMA synchronous=FULL')
            _C.executescript(SCHEMA)
            have = {r[1] for r in _C.execute('PRAGMA table_info(runs)')}
            for col, decl in (('attempt', 'INTEGER DEFAULT 1'), ('phase', "TEXT DEFAULT 'draw'"),
                              ('review', "TEXT DEFAULT ''"), ('history', "TEXT DEFAULT '[]'")):
                if col not in have: _C.execute(f'ALTER TABLE runs ADD COLUMN {col} {decl}')
        return _C


def q(sql, args=()):
    with LOCK:
        return [dict(r) for r in conn().execute(sql, args).fetchall()]


def x(sql, args=()):
    with LOCK:
        return conn().execute(sql, args).lastrowid


def new_round(item, n, directions, note='', base='', model='', effort='', root=''):
    """판 하나 + 작업자 n 명(queued). directions = [(글자, 방향 설명)…]."""
    with LOCK:
        c = conn(); c.execute('BEGIN')
        try:
            rid = c.execute('INSERT INTO rounds(item,created,note,base,n,model,effort,root) VALUES(?,?,?,?,?,?,?,?)',
                            (item, now(), note, base, n, model, effort, root)).lastrowid
            for letter, d in directions[:n]:
                c.execute('INSERT INTO runs(round,letter,direction) VALUES(?,?,?)', (rid, letter, d))
            c.execute('COMMIT')
        except Exception:
            c.execute('ROLLBACK'); raise
    return rid


def set_brief(rid, path):
    x('UPDATE rounds SET brief=? WHERE id=?', (path, rid))


def runs(rid=None, status=None):
    sql = 'SELECT runs.*, rounds.item, rounds.root, rounds.brief, rounds.note AS rnote, rounds.base, rounds.model, rounds.effort ' \
          'FROM runs JOIN rounds ON rounds.id=runs.round'
    cond, args = [], []
    if rid is not None: cond.append('runs.round=?'); args.append(rid)
    if status: cond.append('runs.status IN (%s)' % ','.join('?' * len(status))); args += list(status)
    if cond: sql += ' WHERE ' + ' AND '.join(cond)
    return q(sql + ' ORDER BY runs.round, runs.letter', args)


def update_run(run_id, **kw):
    if not kw: return
    x('UPDATE runs SET %s WHERE id=?' % ','.join(f'{k}=?' for k in kw), list(kw.values()) + [run_id])


def rounds(item=None):
    if item: return q('SELECT * FROM rounds WHERE item=? ORDER BY id', (item,))
    return q('SELECT * FROM rounds ORDER BY id')


def add_feedback(item, verdict, round_=None, cand='', reasons=(), note=''):
    return x('INSERT INTO feedback(at,item,round,cand,verdict,reasons,note) VALUES(?,?,?,?,?,?,?)',
             (now(), item, round_, cand, verdict, json.dumps(list(reasons), ensure_ascii=False), note or ''))


def feedback(item=None):
    rows = q('SELECT * FROM feedback WHERE item=? ORDER BY id', (item,)) if item else q('SELECT * FROM feedback ORDER BY id')
    for r in rows: r['reasons'] = json.loads(r['reasons'] or '[]')
    return rows
