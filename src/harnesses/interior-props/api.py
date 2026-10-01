"""고르기 서버(pick_server.py)에 붙는 소품 하네스 경로. pick_server 가 이 파일이 있으면 불러 쓴다.

  GET  /harness                         고르는 화면(web/index.html)
  GET  /api/harness/state               판·후보·상태 + 일꾼 상태
  GET  /api/harness/objects             시트의 기물 전부(기물 고르기 패널)
  GET  /api/harness/thumb/<slug>.png    지금 시트(handInteriorSpec + interior-chipset)에서 잘라 낸 기물 그림
  POST /api/harness/decide   {id, round, choice: "h12-C"|"keep", rejects: {"h12-A": ["view", …]}, note}
                             → choice 는 picks.sqlite 에 사용자 선택(client=web)으로, 판정·이유·메모는 harness.sqlite 에
  POST /api/harness/draw     {ids: [...], note, base, n, round, rejects}  → 기물마다 새 판(후보 n장) 대기열 + 일꾼 시작
"""
import io, json, os, sys, threading

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, 'scripts/content/hand-interior-pick'))
import store  # noqa: E402
import harness  # noqa: E402
from common import CAND, WORKER_RE, geom, objects_by_id, slug, objects_by_slug  # noqa: E402
import picks_db  # noqa: E402

SPEC = os.path.join(ROOT, 'src/assets/handInteriorSpec.json')
SHEET = os.path.join(ROOT, 'public/assets/atlas-interior/interior-chipset.png')
_thumb = {'mtime': None, 'cache': {}}
DRAW_LOCK = threading.Lock()


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
                                         surfaces=rv.get('surfaces', ''), worse=rv.get('worse')) if rv else None,
                             history=[dict(attempt=h['attempt'], stage=h['stage'],
                                           why=('; '.join(h.get('hard', [])) if h['stage'] == 'hard' else
                                                ', '.join((h.get('review') or {}).get('codes') or []) + ' — ' + (h.get('review') or {}).get('reasons', '')
                                                if h['stage'] == 'review' else h.get('error', ''))[:400]) for h in hist],
                             v=int(os.path.getmtime(png)) if os.path.exists(png) else 0))
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
    return dict(items=out, reasons=__import__('brief').REASONS,
                pool=dict(alive=harness.pool_alive(), queued=sum(1 for r in allruns if r['status'] == 'queued'),
                          running=sum(1 for r in allruns if r['status'] == 'running'), par=harness.MAX_PAR, attempts=harness.MAX_ATTEMPTS, reviewEffort=harness.REVIEW_EFFORT,
                          model=harness.MODEL, effort=harness.EFFORT))


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
        if i in spec or not m.get('new'): continue
        out.append(dict(id=i, slug=slug(i), name=m['name_ko'], category=m['category_ko'], kind=m['kind'], desc=m['description'],
                        current=(cur.get(i) or {}).get('choice') or 'v5', rounds=rounds.get(i, 0), known=True, isNew=True,
                        use=m.get('use') or []))
    out.sort(key=lambda t: (t['category'], t['name']))
    return out


def thumb(s):
    from PIL import Image
    mt = (os.path.getmtime(SPEC), os.path.getmtime(SHEET))
    if _thumb['mtime'] != mt:
        _thumb.update(mtime=mt, cache={}, spec=json.load(open(SPEC, encoding='utf-8'))['objects'],
                      sheet=Image.open(SHEET).convert('RGBA'))
    if s in _thumb['cache']: return _thumb['cache'][s]
    o = next((v for k, v in _thumb['spec'].items() if slug(k) == s), None)
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


def _exists(item, c):
    return bool(WORKER_RE.match(str(c) + '.pxg')) and os.path.exists(os.path.join(CAND, slug(item), str(c) + '.pxg'))


def _record_rejects(item, rnd, rejects, note=''):
    for cand, reasons in (rejects or {}).items():
        if _exists(item, cand): store.add_feedback(item, 'reject', rnd, cand, reasons or [], '')


def decide(body):
    i = body['id']; rnd = body.get('round'); choice = body.get('choice'); note = str(body.get('note') or '')[:2000]
    if i not in objects_by_id(): raise ValueError('모르는 기물')
    if choice != 'keep' and not _exists(i, choice): raise ValueError('없는 후보')
    _record_rejects(i, rnd, body.get('rejects'))
    if choice == 'keep':
        store.add_feedback(i, 'keep', rnd, '', [], note)
    else:
        picks_db.apply(i, {'choice': choice}, 'web')
        try: picks_db.export()
        except Exception as e: print('picks.json 내보내기 실패:', repr(e), flush=True)
        store.add_feedback(i, 'pick', rnd, choice, [], note)
    return dict(ok=True)


def draw(body):
    ids = [i for i in body.get('ids', []) if i in objects_by_id()]
    if not ids: raise ValueError('기물이 없다')
    n = max(1, min(5, int(body.get('n') or 5))); note = str(body.get('note') or '')[:2000]; base = str(body.get('base') or '')
    if base and (len(ids) != 1 or not _exists(ids[0], base)): raise ValueError('출발 후보가 없다')
    if body.get('round') and len(ids) == 1:
        _record_rejects(ids[0], body['round'], body.get('rejects'))
        store.add_feedback(ids[0], 'redraw', body['round'], base, [], note)

    def work():
        with DRAW_LOCK:
            try: harness.draw(ids, n, note, base)
            except Exception as e: print('하네스 draw 실패:', repr(e), flush=True)
    threading.Thread(target=work, daemon=True).start()
    return dict(ok=True, ids=ids)


def handle(h, method, parts, body=None):
    """처리했으면 True. h = BaseHTTPRequestHandler(send·file 메서드가 있는 pick_server.H)."""
    if method == 'GET':
        if parts == ['harness']:
            h.file(os.path.join(HERE, 'web', 'index.html'), 'text/html; charset=utf-8'); return True
        if parts == ['api', 'harness', 'state']:
            h.send(200, json.dumps(state(), ensure_ascii=False)); return True
        if parts == ['api', 'harness', 'objects']:
            h.send(200, json.dumps(objects(), ensure_ascii=False)); return True
        if len(parts) == 4 and parts[:3] == ['api', 'harness', 'thumb'] and parts[3].endswith('.png'):
            b = thumb(parts[3][:-4])
            if b is None: h.send(404, '{}')
            else: h.send(200, b, 'image/png')
            return True
        return False
    if method == 'POST' and parts[:2] == ['api', 'harness']:
        try:
            if parts == ['api', 'harness', 'decide']: res = decide(body or {})
            elif parts == ['api', 'harness', 'draw']: res = draw(body or {})
            else: h.send(404, '{}'); return True
        except (KeyError, ValueError, TypeError) as e:
            h.send(400, json.dumps({'error': str(e)}, ensure_ascii=False)); return True
        h.send(200, json.dumps(res, ensure_ascii=False)); return True
    return False
