"""사용자 확정 → 내구성 있는 반영 대기열 → 격리 굽기 → 호스트 공용 SQLite.

선택 DB는 먼저 저장한다. 게시 실패가 선택을 취소하지 않는다. 프로세스가 꺼져도
다음 서버 시작에서 대기열을 다시 열며, 여러 확정은 하나의 최신 판으로 합친다.
"""
import fcntl, hashlib, json, os, shutil, sqlite3, subprocess, sys, tempfile, time
from pathlib import Path
from contextlib import contextmanager

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
DATA = Path(os.environ.get('PROP_HARNESS_DATA', str(Path.home() / '.local/share/oprn/prop-harness')))
DB = str(DATA / 'shared-publish.sqlite')
LOCK = DATA / 'shared-publish.lock'
LIBRARY = 'oprn-hand-interior-harness'
sys.path.insert(0, str(ROOT / 'scripts/content/hand-interior-pick'))


@contextmanager
def connect():
    DATA.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB, timeout=30); c.row_factory = sqlite3.Row
    c.execute('PRAGMA journal_mode=WAL')
    c.execute('CREATE TABLE IF NOT EXISTS job (id INTEGER PRIMARY KEY, root TEXT, desired TEXT, completed TEXT, '
              'state TEXT, requested REAL, updated REAL, error TEXT, receipt TEXT)')
    try:
        with c: yield c
    finally: c.close()


def status():
    with connect() as c: row = c.execute('SELECT * FROM job WHERE id=1').fetchone()
    if not row: return {'state': 'idle', 'library': LIBRARY}
    d = dict(row); d.pop('root', None); d.pop('desired', None); d.pop('completed', None)
    d['library'] = LIBRARY
    if d.get('receipt'): d['receipt'] = json.loads(d['receipt'])
    return d


def selections():
    import picks_db
    return {i: {k: v.get(k) for k in ('choice', 'variants')} for i, v in picks_db.current_all().items()
            if v.get('choice') and (v['choice'] != 'v5' or v.get('variants'))}


def request(force=False):
    selected = selections()
    fp = hashlib.sha256(json.dumps(selected, sort_keys=True).encode()).hexdigest()
    with connect() as c:
        old = c.execute('SELECT * FROM job WHERE id=1').fetchone()
        if old and old['desired'] == fp and not force:
            if old['state'] == 'done': return status()
        else:
            c.execute("INSERT INTO job VALUES(1,?,?,NULL,'queued',?,?, '',NULL) ON CONFLICT(id) DO UPDATE SET "
                      "root=excluded.root,desired=excluded.desired,completed=NULL,state='queued',requested=excluded.requested,error=''",
                      (str(ROOT), fp, time.time(), time.time()))
    log = open(DATA / 'shared-publish.log', 'ab')
    try: subprocess.Popen([sys.executable, str(HERE / 'shared_publish.py'), 'worker'], cwd=ROOT,
                          stdout=log, stderr=log, start_new_session=True)
    finally: log.close()
    return status()


def snapshot(root, selected):
    """출력은 임시 폴더에만 쓴다. 현재 시트와 후보를 굽는 도중에 바꾸지 않는다."""
    stage = Path(tempfile.mkdtemp(prefix='oprn-prop-publish-'))
    def copy(rel):
        src, dst = root / rel, stage / rel
        if not src.exists(): return
        dst.parent.mkdir(parents=True, exist_ok=True)
        if src.is_dir(): shutil.copytree(src, dst, ignore=shutil.ignore_patterns('__pycache__', '.cache'))
        else: shutil.copy2(src, dst)
    try:
        for rel in ['src', 'tsconfig.json', 'package.json', 'scripts/ontology-ts-loader.mjs',
                    'scripts/lib/sharedContentSqlite.ts', 'scripts/content/hand-interior',
                    'scripts/content/hand-interior-pick', 'scripts/content/pixel-harness/pxgrid',
                    'tiledata/hand-interior/v5', 'tiledata/hand-interior/new',
                    'tiledata/hand-interior/v5-maps', 'tiledata/hand-interior/pick/palette',
                    'public/assets/atlas-interior', 'public/assets/hand-interior-references']: copy(rel)
        # 다른 칩셋의 정적 참고 JSON도 TS 기본값 모듈이 가져온다. 읽기 전용 입력으로 연결한다.
        for p in (root / 'tiledata').iterdir():
            dst = stage / 'tiledata' / p.name
            if not dst.exists(): dst.symlink_to(p, target_is_directory=p.is_dir())
        (stage / 'node_modules').symlink_to((root / 'node_modules').resolve(), target_is_directory=True)
        (stage / 'public/assets/atlas-biomes').symlink_to(root / 'public/assets/atlas-biomes', target_is_directory=True)
        # 공용에 이미 설치된 맵의 칸 번호가 다음 선택으로 밀리지 않게 직전 게시판을 사용한다.
        shared_db = Path(os.environ.get('OPRN_SHARED_CONTENT_SQLITE', str(Path(os.environ.get('XDG_DATA_HOME', str(Path.home() / '.local/share'))) / 'oprn/shared-content.sqlite')))
        if shared_db.exists():
            with sqlite3.connect(f'file:{shared_db}?mode=ro', uri=True) as c:
                old = c.execute('SELECT revision FROM content_libraries WHERE id=?', (LIBRARY,)).fetchone()
            if old:
                baseline = DATA / 'baselines' / old[0]
                if not baseline.exists(): raise RuntimeError('이전 공용 판본의 칸 번호 자료가 없습니다: ' + old[0])
                for p in baseline.rglob('*'):
                    if p.is_file(): shutil.copy2(p, stage / p.relative_to(baseline))
        import common
        for item, v in selected.items():
            src = root / 'tiledata/hand-interior/pick/candidates' / common.slug(item)
            dst = stage / 'tiledata/hand-interior/pick/candidates' / common.slug(item)
            dst.mkdir(parents=True, exist_ok=True)
            names = [str(v['choice']).split('.')[0]] + [str(x).split('.')[0] for x in v.get('variants') or []]
            for p in src.iterdir() if src.exists() else []:
                if p.is_file() and (p.suffix == '.pal' or p.name in ('resize.json', 'anim-mask.png', 'info.json', 'v5.png')
                                   or any(p.name.startswith(n + '.') for n in names)):
                    shutil.copy2(p, dst / p.name)
        pick = stage / 'tiledata/hand-interior/pick/picks.json'
        pick.parent.mkdir(parents=True, exist_ok=True); pick.write_text(json.dumps(selected, ensure_ascii=False))
        return stage
    except Exception:
        shutil.rmtree(stage); raise


def publish(root, selected):
    stage = snapshot(root, selected)
    try:
        env = dict(os.environ, HAND_INTERIOR_PICKS_JSON=str(stage / 'tiledata/hand-interior/pick/picks.json'))
        for cmd in ([sys.executable, 'scripts/content/hand-interior/build_tileset.py'],
                    ['bun', 'scripts/content/hand-interior/prepare-references.mts']):
            print('RUN', cmd, flush=True)
            subprocess.run(cmd, cwd=stage, env=env, check=True, timeout=900)
            if cmd[0] == sys.executable:
                checks = json.loads((stage / 'tiledata/hand-interior/v5-maps/check.json').read_text())
                bad = [r['map'] for r in checks if any(r.get(k) for k in ('structDiffPx', 'pixelDiffAllFrames', 'walkMismatch', 'unreached'))]
                if bad: raise RuntimeError('예제 맵 검사 실패: ' + ', '.join(bad))
        # 게시 스크립트는 원본 체크아웃의 코드로 실행하고 산출물만 격리 폴더에서 읽는다.
        receipt = subprocess.check_output(['node', str(root / 'src/harnesses/interior-props/publish_shared.mjs'), str(stage)],
                                          cwd=root, env=env, text=True, timeout=180)
        return json.loads(receipt.strip().splitlines()[-1])
    finally: shutil.rmtree(stage)


def worker():
    DATA.mkdir(parents=True, exist_ok=True)
    with open(LOCK, 'a') as lock:
        try: fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError: return
        while True:
            with connect() as c: row = c.execute('SELECT * FROM job WHERE id=1').fetchone()
            if not row or row['desired'] == row['completed']: return
            delay = max(0, row['requested'] + 3 - time.time())
            if row['state'] == 'error': delay = max(delay, row['updated'] + 60 - time.time())
            if delay: time.sleep(min(3, delay)); continue
            root = Path(row['root']); desired = row['desired']
            with connect() as c: c.execute("UPDATE job SET state='publishing',error='',updated=? WHERE id=1 AND desired=?", (time.time(), desired))
            try:
                selected = selections()
                actual = hashlib.sha256(json.dumps(selected, sort_keys=True).encode()).hexdigest()
                if actual != desired: request(); continue
                receipt = publish(root, selected)
                with connect() as c:
                    c.execute("UPDATE job SET completed=?,state=CASE WHEN desired=? THEN 'done' ELSE 'queued' END,"
                              "updated=?,error='',receipt=? WHERE id=1", (desired, desired, time.time(), json.dumps(receipt)))
                print('PUBLISHED', receipt, flush=True)
            except Exception as e:
                print('PUBLISH FAILED', repr(e), flush=True)
                with connect() as c:
                    c.execute("UPDATE job SET state='error',updated=?,error=? WHERE id=1 AND desired=?",
                              (time.time(), str(e)[:1000], desired))


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'worker': worker()
    else: print(json.dumps(request(force='--force' in sys.argv), ensure_ascii=False))
