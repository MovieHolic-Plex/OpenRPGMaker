"""고르기 서버(pick_server.py)에 붙는 소품 하네스 경로. pick_server 가 이 파일이 있으면 불러 쓴다.

  GET  /harness                         슈퍼하네싱 통합 입구(web/super.html)
  GET  /harness/props                   기물 고르는 화면(web/index.html)
  GET  /api/harness/state               판·후보·상태 + 일꾼 상태
  GET  /api/harness/suggestions        기존 원본의 자동 파생 제안(주문 전 읽기)
  GET  /api/harness/objects             시트의 기물 전부(기물 고르기 패널)
  GET  /api/harness/thumb/<slug>.png    지금 시트(handInteriorSpec + interior-chipset)에서 잘라 낸 기물 그림
  POST /api/harness/decide   {id, round, choice: "h12-C"|"keep", rejects: {"h12-A": ["view", …]}, note}
                             → choice 는 picks.sqlite 에 사용자 선택(client=web)으로, 판정·이유·메모는 harness.sqlite 에
  POST /api/harness/draw     {ids: [...], note, base, n, round, rejects}  → 기물마다 새 판(후보 n장) 대기열 + 일꾼 시작
"""
import gzip, io, json, os, sqlite3, sys, threading, time

if not __package__:
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
    __package__ = 'src.harnesses.interior-props'

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, 'scripts/content/hand-interior-pick'))
from . import brief, store  # noqa: E402
from . import harness  # noqa: E402
from common import CONTENT_ROOT, CAND, NEW_ITEMS, RESIZE_STAMP, SETS, V5, WORKER_RE, geom, objects_by_id, slug, objects_by_slug, size_from_note, write_resize  # noqa: E402
import picks_db  # noqa: E402
from . import shared_publish  # noqa: E402
from . import super_bridge  # noqa: E402
import outline_select  # noqa: E402

SPEC = os.path.join(CONTENT_ROOT, 'src/assets/handInteriorSpec.json')
SHEET = os.path.join(CONTENT_ROOT, 'public/assets/atlas-interior/interior-chipset.png')
_thumb = {'mtime': None, 'cache': {}}
DRAW_LOCK = threading.Lock()
# 뒤에서 도는 draw 가 실패하면 화면이 영영 「그리는 중」으로 기다렸다 — 실패를 번호를 붙여 상태에 실어 보낸다.
_DRAW_ERR = {}   # 기물 id → {seq, error}
_ERR_SEQ = [0]


class Conflict(Exception):
    """이미 끝난 판에 또 확정 같은 것 — 409."""


def _note(item, cand):
    p = os.path.join(CAND, slug(item), cand + '.note')
    try:
        return open(p, encoding='utf-8').read().strip().split('\n')[0][:300]
    except OSError:
        return ''


def state():
    by = objects_by_id(); cur = picks_db.current_all(); fb = store.feedback()
    decided = {}
    for f in fb:
        if f['verdict'] in ('pick', 'keep') and f['round']: decided[(f['item'], f['round'])] = f
    items = {}
    for rd in store.rounds():
        i = rd['item']; o = by.get(i)
        if not o: continue
        s = slug(i)
        it = items.setdefault(i, dict(id=i, slug=s, name=o['name_ko'], desc=o['description'], category=o['category_ko'],
                                      kind=o['kind_ko'], canvas=geom(o)['canvas'], current=(cur.get(i) or {}).get('choice') or 'v5',
                                      isNew=bool(o.get('new')), use=o.get('use') or [],
                                      set=_set_view(o), parent=o.get('parent'), derive=o.get('derive'),
                                      rounds=[], last=rd['created']))
        runs = []
        for r in store.runs(rd['id']):
            cand = f"h{rd['id']}-{r['letter']}"
            png = os.path.join(CAND, s, cand + '.png')
            try: rv = json.loads(r.get('review') or '{}')
            except ValueError: rv = {}
            try: hist = json.loads(r.get('history') or '[]')
            except ValueError: hist = []
            runs.append(dict(letter=r['letter'], cand=cand, direction=r['direction'].split(':')[0], directionFull=r['direction'],
                             status=r['status'], ok=r['ok'], error=r['error'] or '', note=_note(i, cand),
                             phase=r.get('phase') or 'draw', attempt=r.get('attempt') or 1,
                             engine=r.get('engine') or '', reviewEngine=r.get('review_engine') or '',
                             review=dict(verdict=rv.get('verdict'), codes=rv.get('codes') or [], reasons=rv.get('reasons', ''),
                                         surfaces=rv.get('surfaces', ''), top=rv.get('top', ''), topRows=rv.get('top_rows'), fix=rv.get('fix', ''), worse=rv.get('worse')) if rv else None,
                             history=[dict(attempt=h['attempt'], stage=h['stage'],
                                           why=('; '.join(h.get('hard', [])) if h['stage'] == 'hard' else
                                                ', '.join((h.get('review') or {}).get('codes') or []) + ' — ' + (h.get('review') or {}).get('reasons', '')
                                                if h['stage'] == 'review' else h.get('error', ''))[:400]) for h in hist],
                             v=int(os.path.getmtime(png)) if os.path.exists(png) else 0, selDiff=_sel_diff(png)))
        d = decided.get((i, rd['id']))
        it['rounds'].append(dict(id=rd['id'], created=rd['created'], note=rd['note'], base=rd['base'], runs=runs,
                                 decided=dict(verdict=d['verdict'], cand=d['cand'], at=d['at']) if d else None))
        it['last'] = max(it['last'], rd['created'])
    out = []
    for it in items.values():
        lr = it['rounds'][-1]; rs = lr['runs']
        busy = sum(1 for r in rs if r['status'] in ('queued', 'running'))
        it['status'] = 'drawing' if busy else ('done' if lr['decided'] else 'ready')
        it['busy'] = busy; it['readyCount'] = sum(1 for r in rs if r['status'] == 'done' and r['ok'])
        it['passCount'] = sum(1 for r in rs if r['status'] == 'done' and r['ok'] and (r['review'] or {}).get('verdict') == 'PASS')
        it['rejected'] = sorted({f['cand'] for f in fb if f['item'] == it['id'] and f['verdict'] == 'reject'})
        out.append(it)
    order = {'ready': 0, 'drawing': 1, 'done': 2}
    out.sort(key=lambda t: (order[t['status']], t['last']))
    allruns = store.runs()
    return dict(items=out, reasons=brief.REASONS,
                pool=dict(alive=harness.pool_alive(), queued=sum(1 for r in allruns if r['status'] == 'queued'),
                          running=sum(1 for r in allruns if r['status'] == 'running'), par=harness.MAX_PAR, attempts=harness.MAX_ATTEMPTS, reviewEffort=harness.REVIEW_EFFORT,
                          model=harness.MODEL, effort=harness.EFFORT),
                drawErrSeq=_ERR_SEQ[0], drawErrors=dict(_DRAW_ERR), sharedPublish=shared_publish.status())


def _set_view(o):
    s = o.get('set')
    if not s: return None
    return dict(parent=s['parent'], derive=s['derive'], ms=s.get('ms'), picked=s.get('picked'),
                slots=[{k: x.get(k) for k in ('key', 'label', 'x', 'y', 'w', 'h', 'locked', 'child')} for x in s['slots']])


def objects():
    by = objects_by_id(); cur = picks_db.current_all(); rounds = {}
    for rd in store.rounds(): rounds[rd['item']] = rounds.get(rd['item'], 0) + 1
    spec = json.load(open(SPEC, encoding='utf-8'))['objects']
    out = []
    for i, o in spec.items():
        m = by.get(i)
        out.append(dict(id=i, slug=slug(i), name=o['ko'], category=o.get('category_ko', ''), kind=o['kind'],
                        desc=(m or {}).get('description', o.get('desc', '')), current=(cur.get(i) or {}).get('choice') or 'v5',
                        rounds=rounds.get(i, 0), known=bool(m)))
    for i, m in by.items():   # 아직 시트에 안 구운 새 기물(new/items.json) — 고르면 빈 캔버스에서 다섯 갈래로 그린다
        if i in spec or not m.get('new') or m.get('set'): continue   # 파생 묶음은 파생 창에서만
        out.append(dict(id=i, slug=slug(i), name=m['name_ko'], category=m['category_ko'], kind=m['kind'], desc=m['description'],
                        current=(cur.get(i) or {}).get('choice') or 'v5', rounds=rounds.get(i, 0), known=True, isNew=True,
                        use=m.get('use') or []))
    out.sort(key=lambda t: (t['category'], t['name']))
    return out


def thumb(s):
    from PIL import Image
    mt = (os.path.getmtime(SPEC), os.path.getmtime(SHEET))
    if _thumb['mtime'] != mt:
        _thumb.pop('byslug', None)
        _thumb.update(mtime=mt, cache={}, spec=json.load(open(SPEC, encoding='utf-8'))['objects'],
                      sheet=Image.open(SHEET).convert('RGBA'))
    if s in _thumb['cache']: return _thumb['cache'][s]
    if 'byslug' not in _thumb: _thumb['byslug'] = {slug(k): v for k, v in _thumb['spec'].items()}
    o = _thumb['byslug'].get(s)
    if not o:   # 시트에 없는 새 기물: 고른 후보가 있으면 그 그림, 없으면 None
        m = objects_by_slug().get(s)
        ch = m and ((picks_db.current_all().get(m['id']) or {}).get('choice') or 'v5')
        p = m and ch != 'v5' and os.path.join(CAND, s, ch + '.png')
        if not (p and os.path.exists(p)): return None
        return open(p, 'rb').read()
    CH = _thumb['sheet']; C = CH.size[0] // 16
    xs = [c[0] for c in o['cells']]; ys = [c[1] for c in o['cells']]; x0, y0 = min(xs), min(ys)
    im = Image.new('RGBA', ((max(xs) - x0 + 1) * 16, (max(ys) - y0 + 1) * 16))
    for dx, dy, t, _ in o['cells']:
        im.alpha_composite(CH.crop(((t % C) * 16, (t // C) * 16, (t % C) * 16 + 16, (t // C) * 16 + 16)), ((dx - x0) * 16, (dy - y0) * 16))
    b = io.BytesIO(); im.save(b, 'PNG'); _thumb['cache'][s] = b.getvalue()
    return _thumb['cache'][s]


# ---------------------------------------------------------------- 빠른 상태 (2026-10-03)
# 상태 JSON(3.7MB)을 요청마다 새로 만들면 바쁜 서버에서 한 번에 25초가 걸렸다(사용자 신고 「harness 엔드포인트 느리다」).
# 이제: ① 기록 DB(harness.sqlite·picks.sqlite)와 기물 명세의 파일 시각을 지문으로 삼아, 바뀌었을 때만 한 번 만든다(뒤에서 1초마다 확인).
#        ② 만든 JSON 은 gzip 해 메모리와 derived.sqlite 에 둔다 → 요청은 들고 있던 바이트를 바로 준다. 서버를 다시 켜도 처음부터 빠르다.
#        ③ 「테두리 꼭 필요한 곳만」 차이 칸 수(그림 두 장을 여는 비싼 계산)도 derived.sqlite 에 남긴다(첫 계산 7.8초 → 0초).
# derived.sqlite 는 기록 DB 와 다른 파일이다 — 캐시를 쓰는 일이 지문을 바꿔 다시 만들기를 부르지 않게.
DERIVED = os.path.join(store.DATA, 'derived.sqlite')
_DC = None
_DLOCK = threading.RLock()


def _dconn():
    global _DC
    with _DLOCK:
        if _DC is None:
            _DC = sqlite3.connect(DERIVED, check_same_thread=False, isolation_level=None, timeout=30)
            _DC.execute('PRAGMA journal_mode=WAL')
            _DC.executescript('CREATE TABLE IF NOT EXISTS seldiff(k TEXT PRIMARY KEY, n INTEGER);'
                              'CREATE TABLE IF NOT EXISTS snapshot(k TEXT PRIMARY KEY, fp TEXT, gz BLOB, at REAL);')
        return _DC


_SELD = {}
def _sel_diff(png):
    """「테두리 꼭 필요한 곳만」 벌이 그린 그대로와 몇 칸 다른가(없으면 None) — 거의 같으면 화면에 한 장만 보인다."""
    sp = png[:-4] + outline_select.SUFFIX + '.png'
    try: k = f'{png}|{os.path.getmtime(png)}|{os.path.getmtime(sp)}'
    except OSError: return None
    if k in _SELD: return _SELD[k]
    with _DLOCK:
        row = _dconn().execute('SELECT n FROM seldiff WHERE k=?', (k,)).fetchone()
    if row: _SELD[k] = row[0]; return row[0]
    from PIL import Image, ImageChops
    d = ImageChops.difference(Image.open(png).convert('RGBA'), Image.open(sp).convert('RGBA'))
    n = sum(1 for v in d.get_flattened_data() if max(v) > 0)
    with _DLOCK:
        _dconn().execute('INSERT OR REPLACE INTO seldiff(k,n) VALUES(?,?)', (k, n))
    _SELD[k] = n
    return n


def _fingerprint():
    """상태를 바꾸는 것들의 파일 시각 — 같으면 들고 있던 상태를 그대로 준다."""
    fs = [store.DB, store.DB + '-wal', picks_db.DB, picks_db.DB + '-wal', NEW_ITEMS, os.path.join(V5, 'interior-meta.json'), RESIZE_STAMP, SETS, shared_publish.DB, shared_publish.DB + '-wal']
    out = []
    for f in fs:
        try: st = os.stat(f); out.append(f'{st.st_mtime_ns}:{st.st_size}')
        except OSError: out.append('-')
    return '|'.join(out) + f'|e{_ERR_SEQ[0]}'


_SNAP = {'fp': None, 'gz': None, 'raw': None}
_BUILD = threading.Lock()


def _build(fp):
    raw = json.dumps(state(), ensure_ascii=False).encode('utf-8')
    gz = gzip.compress(raw, 5)
    _SNAP.update(fp=fp, gz=gz, raw=None)
    with _DLOCK:
        _dconn().execute('INSERT OR REPLACE INTO snapshot(k,fp,gz,at) VALUES(?,?,?,?)', ('state', fp, gz, time.time()))


def state_gz(max_stale=False):
    """gzip 한 상태 JSON. 지문이 같으면 바로, 다르면 한 사람만 새로 만들고 나머지는 그 결과를 기다린다."""
    fp = _fingerprint()
    if _SNAP['fp'] == fp or (max_stale and _SNAP['gz']): return _SNAP['gz']
    with _BUILD:
        if _SNAP['fp'] != fp: _build(fp)
    return _SNAP['gz']


def _refresher():
    """뒤에서 1초마다 지문을 보고 바뀌었으면 미리 만들어 둔다 — 화면의 3초 폴링이 거의 늘 만들어진 바이트를 받는다."""
    last_publish_check = time.monotonic()
    while True:
        try:
            if time.monotonic() - last_publish_check >= 30:
                queue_shared_publish()  # 꺼진 일꾼도 내구성 대기열에서 다시 시작한다.
                last_publish_check = time.monotonic()
            fp = _fingerprint()
            if fp != _SNAP['fp']:
                with _BUILD:
                    if _SNAP['fp'] != fp: _build(fp)
        except Exception as e:
            print('상태 미리 만들기 실패:', repr(e), flush=True)
        time.sleep(1)


def start():
    """서버가 켜질 때 한 번: 지난 스냅숏을 바로 쓸 수 있게 올리고, 미리 만드는 일꾼을 띄운다."""
    try:
        with _DLOCK:
            row = _dconn().execute("SELECT fp, gz FROM snapshot WHERE k='state'").fetchone()
        if row: _SNAP.update(fp=row[0], gz=row[1])
    except Exception as e:
        print('상태 스냅숏 읽기 실패:', repr(e), flush=True)
    queue_shared_publish()
    threading.Thread(target=_refresher, daemon=True, name='state-refresh').start()


def queue_shared_publish():
    # 사용자 선택은 이미 저장됐다. 등록 대기열 실패로 선택 저장이 실패했다고 답하지 않는다.
    try: return shared_publish.request()
    except Exception as e:
        print('공용 반영 대기열 실패:', repr(e), flush=True)
        return dict(state='error', error=str(e))


def _exists(item, c):
    b = outline_select.split(str(c))[0]   # `h12-C.sel` = 같은 후보의 「테두리 꼭 필요한 곳만」 벌
    return bool(WORKER_RE.match(b + '.pxg')) and os.path.exists(os.path.join(CAND, slug(item), b + '.pxg'))


def _record_rejects(item, rnd, rejects, note=''):
    for cand, reasons in (rejects or {}).items():
        if _exists(item, cand): store.add_feedback(item, 'reject', rnd, cand, reasons or [], '')


def decide(body):
    i = body['id']; rnd = body.get('round'); choice = body.get('choice'); note = str(body.get('note') or '')[:2000]
    if i not in objects_by_id(): raise ValueError('모르는 기물')
    if choice != 'keep' and not _exists(i, choice): raise ValueError('없는 후보')
    rs = [rd['id'] for rd in store.rounds(i)]
    if rnd is not None and rs and int(rnd) != max(rs): raise Conflict(f'옛 판(h{rnd})이다 — 지금 판은 h{max(rs)}')
    # 같은 판에 같은 확정이 또 오면(키 두 번 등) 중복이다. 다른 후보로 바꾸는 것은 마음을 바꾼 것이라 받는다.
    last = [f for f in store.feedback(i) if f['round'] == rnd and f['verdict'] in ('pick', 'keep')]
    if last and (last[-1]['verdict'], last[-1]['cand']) == (('keep', '') if choice == 'keep' else ('pick', choice)):
        raise Conflict('이미 그렇게 확정됐다')
    _record_rejects(i, rnd, body.get('rejects'))
    if choice == 'keep':
        store.add_feedback(i, 'keep', rnd, '', [], note)
    else:
        children = None
        if objects_by_id()[i].get('set'):
            from . import derive
            children = [dict(id=c, name=n) for c, n in derive.slice_pick(i, choice, rnd)]
        picks_db.apply(i, {'choice': choice}, 'web')
        try: picks_db.export()
        except Exception as e: print('picks.json 내보내기 실패:', repr(e), flush=True)
        store.add_feedback(i, 'pick', rnd, choice, [], note)
        queue_shared_publish()
        if children is not None: return dict(ok=True, children=children)
    return dict(ok=True)


def draw(body):
    ids = [i for i in body.get('ids', []) if i in objects_by_id()]
    if not ids: raise ValueError('기물이 없다')
    n = max(1, min(5, int(body.get('n') or harness.N_DEFAULT))); note = str(body.get('note') or '')[:2000]; base = str(body.get('base') or '')
    if base and (len(ids) != 1 or not _exists(ids[0], base)): raise ValueError('출발 후보가 없다')
    resized = None; slot = str(body.get('slot') or '')
    if slot and (len(ids) != 1 or not base or not objects_by_id()[ids[0]].get('set')): raise ValueError('칸 다시 그리기는 묶음 하나·출발 후보가 있어야 한다')
    if slot and slot not in [x['key'] for x in objects_by_id()[ids[0]]['set']['slots'] if not x['locked']]: raise ValueError(f'고칠 수 없는 칸 {slot!r}')
    if len(ids) == 1 and not objects_by_id()[ids[0]].get('set'):   # 메모의 「2x2」 같은 크기 요청은 글로만 넘기지 않고 캔버스·칸 수·검사까지 바꾼다(resize.json)
        sz = size_from_note(note); o = objects_by_id()[ids[0]]; fp = geom(o)['footprint']
        cur = (int(fp.get('w') or 1), int(fp.get('h') or 0) if int(fp.get('h') or 0) else geom(o)['canvas'][1] // 16)
        if sz and sz != cur:
            spec = write_resize(o, sz[0], sz[1], f'사용자 메모: {note[:200]}')
            resized = dict(w=sz[0], h=sz[1], canvas=spec['canvas'])
            if base and not base.startswith('v5'): base = ''   # 옛 크기 후보에서 출발하면 캔버스가 안 맞는다
    if body.get('round') and len(ids) == 1:
        _record_rejects(ids[0], body['round'], body.get('rejects'))
        store.add_feedback(ids[0], 'redraw', body['round'], base, [], note)

    def work():
        with DRAW_LOCK:
            try:
                harness.draw(ids, n, note, base, slot=slot)
                for i in ids: _DRAW_ERR.pop(i, None)
            except Exception as e:
                print('하네스 draw 실패:', repr(e), flush=True)
                _ERR_SEQ[0] += 1
                for i in ids: _DRAW_ERR[i] = dict(seq=_ERR_SEQ[0], error=repr(e)[:300])
    threading.Thread(target=work, daemon=True).start()
    return dict(ok=True, ids=ids, resized=resized)


def derive_order(body):
    """파생 창의 주문: {id, facing, state:'열림'|'', loop, size:[w,h]|null, note}. 묶음·큰 판을 만들고 바로 뽑는다."""
    from . import derive
    i = body['id']; by = objects_by_id()
    if i not in by: raise ValueError('모르는 기물')
    if by[i].get('set'): raise ValueError('파생 묶음에서 또 파생하지 않는다 — 원본 기물에서')
    note = str(body.get('note') or '')[:2000]; jobs = []
    if body.get('facing'): jobs.append((derive.make_set(i, 'facing', note=note), ''))
    if body.get('state'): jobs.append((derive.make_set(i, 'state', label=str(body['state']), note=note), ''))
    if body.get('loop'): jobs.append((derive.make_set(i, 'loop', note=note), ''))
    if body.get('size'):
        w, h = [int(v) for v in body['size']]
        if not (1 <= w <= 8 and 1 <= h <= 8): raise ValueError('크기는 1~8칸')
        cur = brief.current_choice(i)
        jobs.append((derive.make_size(i, w, h, note=note), f'{cur}@{i}'))
    if not jobs: raise ValueError('고른 파생이 없다')
    made = [dict(id=j, name=objects_by_id()[j]['name_ko']) for j, _ in jobs]

    def work():
        with DRAW_LOCK:
            for j, base in jobs:
                try:
                    harness.draw([j], harness.N_DEFAULT, note, base)
                    _DRAW_ERR.pop(j, None)
                except BaseException as e:   # SystemExit(명세 검사)도 화면에 알린다
                    print('파생 draw 실패:', j, repr(e), flush=True)
                    _ERR_SEQ[0] += 1; _DRAW_ERR[j] = dict(seq=_ERR_SEQ[0], error=repr(e)[:300])
    threading.Thread(target=work, daemon=True).start()
    return dict(ok=True, made=made)


def handle(h, method, parts, body=None):
    """처리했으면 True. h = BaseHTTPRequestHandler(send·file 메서드가 있는 pick_server.H)."""
    if super_bridge.handle(h, method, parts):
        return True
    if method == 'GET':
        if parts == ['harness']:
            h.file(os.path.join(HERE, 'web', 'super.html'), 'text/html; charset=utf-8'); return True
        if parts == ['harness', 'props']:
            h.file(os.path.join(HERE, 'web', 'index.html'), 'text/html; charset=utf-8'); return True
        if parts == ['api', 'harness', 'state']:
            # 서버가 막 켜져 아직 새로 못 만들었으면 지난 스냅숏이라도 바로 준다(1초 안에 새 것으로 바뀐다)
            gz = state_gz(max_stale=True)
            if 'gzip' in (h.headers.get('Accept-Encoding') or ''):
                h.send_response(200); h.send_header('Content-Type', 'application/json; charset=utf-8')
                h.send_header('Content-Encoding', 'gzip'); h.send_header('Content-Length', str(len(gz)))
                h.send_header('Cache-Control', 'no-store'); h.end_headers(); h.wfile.write(gz)
            else:
                h.send(200, gzip.decompress(gz))
            return True
        if len(parts) == 4 and parts[:3] == ['api', 'harness', 'derive']:
            from . import derive
            try: h.send(200, json.dumps(derive.suggest(parts[3]), ensure_ascii=False))
            except KeyError: h.send(404, json.dumps({'error': '모르는 기물'}, ensure_ascii=False))
            return True
        if parts == ['api', 'harness', 'suggestions']:
            from . import derive
            h.send(200, json.dumps(derive.suggestions(), ensure_ascii=False)); return True
        if parts == ['api', 'harness', 'objects']:
            h.send(200, json.dumps(objects(), ensure_ascii=False)); return True
        if len(parts) == 4 and parts[:3] == ['api', 'harness', 'thumb'] and parts[3].endswith('.png'):
            b = thumb(parts[3][:-4])
            if b is None: h.send(404, '{}')
            else: h.send(200, b, 'image/png')   # 주소에 ?v=<지금 그림> 이 붙어 오면 send 가 하루 캐시를 단다
            return True
        return False
    if method == 'POST' and parts[:2] == ['api', 'harness']:
        try:
            if parts == ['api', 'harness', 'decide']: res = decide(body or {})
            elif parts == ['api', 'harness', 'draw']: res = draw(body or {})
            elif parts == ['api', 'harness', 'derive']: res = derive_order(body or {})
            elif parts == ['api', 'harness', 'publish']: res = shared_publish.request(force=True)
            else: h.send(404, '{}'); return True
        except Conflict as e:
            h.send(409, json.dumps({'error': str(e)}, ensure_ascii=False)); return True
        except (KeyError, ValueError, TypeError) as e:
            h.send(400, json.dumps({'error': str(e)}, ensure_ascii=False)); return True
        except Exception as e:   # 밖으로 새면 연결이 그냥 끊겨 화면은 「Failed to fetch」만 봤다
            print('하네스 POST 실패:', repr(e), flush=True)
            h.send(500, json.dumps({'error': f'서버 오류: {e!r}'[:300]}, ensure_ascii=False)); return True
        h.send(200, json.dumps(res, ensure_ascii=False)); return True
    return False
