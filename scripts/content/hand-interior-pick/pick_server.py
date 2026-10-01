#!/usr/bin/env python3
"""16px 실내 기물 고르는 화면 서버 (표준 라이브러리 + PIL). 포트 18302, 0.0.0.0.

  python3 scripts/content/hand-interior-pick/pick_server.py [--port 18302]
  systemd --user 유닛: ~/.config/systemd/user/hand-interior-pick.service

GET  /                      고르는 화면 (web/index.html)
GET  /api/state             기물·후보·검사 요약·선택 (요청마다 candidates/ 를 다시 읽는다 → 새 후보는 새로고침만으로 보인다)
GET  /c/<slug>/<파일.png>    후보 폴더의 그림
GET  /ctx/<slug>/<후보>.png  방 안 맥락 그림(1배). 후보 = v5 | w1-A …
GET  /out/<경로>             apply_picks.py 산출물
POST /api/pick              {"id": 기물 id, "choice": "v5"|"w1-A"|null, "note": "…", "variants": ["w2-B", …]} → SQLite 정본(picks_db.py)에
                            이벤트 추가 + current 갱신을 한 트랜잭션으로 커밋한 **뒤에만** 200. 그다음 picks.json 을 내보내기로 다시 쓴다.
                            sendBeacon(창 닫기)도 같은 주소로 온다. "client" 키는 기록용(web|beacon|revert).
                            variants = 주 선택과 **함께 쓸** 추가 후보(있는 후보만, v5·주 선택 제외, 중복 제거). 빈 목록이면 키를 지운다.
                            보내지 않은 키(choice·note·variants)는 기존 값 유지 → 옛 기록과 호환.
GET  /api/history?id=<id>   그 기물의 events(새것 먼저)
POST /api/revert            {"event": 이벤트 id} → 그 이벤트 뒤의 상태를 새 이벤트로 다시 적용
정본은 ~/.local/share/oprn/hand-interior-pick/picks.sqlite. picks.json·addressed.json 은 내보내기(README.md).
"""
import argparse, datetime, glob, io, json, os, re, sys, threading, urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa
import picks_db

WEB = os.path.join(HERE, 'web')
PICKS = os.path.join(PICK, 'picks.json')
CACHE = os.path.join(PICK, '.cache', 'ctx')
OUT = os.path.join(PICK, 'out')
LOCK = threading.Lock(); CTX_LOCK = threading.Lock()
SAFE = re.compile(r'^[A-Za-z0-9_]+$'); SAFE_FILE = re.compile(r'^[A-Za-z0-9_.\-]+$')

def read_json(p, default):
    try:
        return json.load(open(p, encoding='utf-8'))
    except (OSError, ValueError):
        return default

SEEN = os.path.join(picks_db.DATA, 'seen.json')   # {"<slug>/<후보>": 처음 이 화면에 올라온 시각(초)} — 저장소 밖, 워크트리를 바꿔도 남는다
SEEN_LOCK = threading.Lock(); _seen = None

def first_seen(s, name):
    """후보가 고르는 화면에 처음 보인 시각. 파일 mtime 은 체크아웃·재렌더로 흔들리므로 쓰지 않는다
    (새 워크트리에서는 모든 후보가 「방금 생긴 것」이 된다)."""
    global _seen
    with SEEN_LOCK:
        if _seen is None: _seen = read_json(SEEN, {})
        k = f'{s}/{name}'
        if k not in _seen:
            _seen[k] = int(datetime.datetime.now().timestamp())
            tmp = SEEN + '.tmp'; json.dump(_seen, open(tmp, 'w'), indent=0); os.replace(tmp, SEEN)
        return _seen[k]

def candidates(s):
    out = []
    for f in sorted(glob.glob(os.path.join(CAND, s, '*.pxg'))):
        m = WORKER_RE.match(os.path.basename(f))
        if not m: continue
        base = f[:-4]; name = os.path.basename(base)
        ck = read_json(base + '.check.json', None)
        png = base + '.png'
        stale = not os.path.exists(png) or os.path.getmtime(png) < os.path.getmtime(f) - 1
        note = ''
        if os.path.exists(base + '.note'):
            note = open(base + '.note', encoding='utf-8').read().strip().split('\n')[0]
        c = dict(name=name, worker=m.group(1), dir=m.group(2), note=note, stale=stale or ck is None,
                 v=int(os.path.getmtime(png)) if os.path.exists(png) else 0, src=first_seen(s, name))
        if ck:
            lint = ck.get('lint', {})
            c.update(ok=ck.get('ok'), hard=ck.get('hard', []), warn=ck.get('warn', []), lintPass=lint.get('pass'),
                     lintFailed=lint.get('failed', []), refmapMax=ck.get('refmap', {}).get('max'), colors=ck.get('colors'))
        out.append(c)
    out.sort(key=lambda c: (c['dir'], c['worker'] != 'pilot', int(c['worker'][1:]) if c['worker'][1:].isdigit() else 0))
    return out

def state():
    jobs = read_json(os.path.join(PICK, 'jobs.json'), {'rounds': [], 'queue': []})
    picks_db.sync_addressed_file()
    by = objects_by_id(); picks = picks_db.current_all()
    order = []; owner = {}
    for r in jobs.get('rounds', []):
        for w in (['pilot'] if r.get('pilot') else []) + list(r['workers']):
            lst = r.get('pilot', []) if w == 'pilot' else r['workers'][w]
            for i in lst:
                if i not in owner: order.append(i); owner[i] = dict(worker=w, round=r['round'])
    for d in sorted(os.listdir(CAND)) if os.path.isdir(CAND) else []:   # 배정 밖에서 들어온 후보도 보인다
        o = objects_by_slug().get(d)
        if o and o['id'] not in owner and candidates(d):
            order.append(o['id']); owner[o['id']] = dict(worker='?', round=0)
    addressed = picks_db.addressed_all()   # 감독자가 「메모 반영」을 적는 곳 {id: {at, summary}} — picks_db.py address
    def ts(x):
        try: return datetime.datetime.fromisoformat(x).timestamp()
        except (TypeError, ValueError): return 0
    items = []
    for i in order:
        o = by.get(i)
        if not o: continue
        s = slug(i); G = geom(o)
        items.append(dict(id=i, slug=s, name=o['name_ko'], category=o['category_ko'], kind=o['kind'], kind_ko=o['kind_ko'],
                          description=o['description'], tags=o.get('tags', []), canvas=G['canvas'],
                          padTop=G['padTop'], footprint=G['footprint'], resized=G['resized'], **owner[i],
                          candidates=candidates(s), pick=picks.get(i)))
        it = items[-1]; pk = it['pick'] or {}
        it['hasNote'] = bool((pk.get('note') or '').strip())
        ad = addressed.get(i) or {}
        newest = max([c['src'] for c in it['candidates']] + [ts(ad.get('at'))] + [0])
        note_at = ts(pk.get('noteAt') or pk.get('at'))
        it['addressed'] = it['hasNote'] and newest > note_at + 1     # 메모 뒤에 새 후보 원본(.pxg — 재검사로 PNG 가 다시 구워져도 안 흔들린다) 또는 감독자 반영 기록이 생겼다
        it['review'] = it['addressed'] and ts(pk.get('at')) < newest  # 그 뒤로 사용자가 아직 안 봤다(고르기·메모 저장 안 함)
        it['addressedSummary'] = ad.get('summary', '')
        seen_at = ts(pk.get('at'))   # 사용자가 이 기물에서 마지막으로 고르거나 메모를 저장한 때
        for c in it['candidates']: c['fresh'] = c['src'] > seen_at + 1
        it['fresh'] = any(c['fresh'] for c in it['candidates'])   # 마지막으로 본 뒤 새 후보가 들어왔다
    return dict(items=items, directions=jobs.get('directions', {}),
                workers=sorted({it['worker'] for it in items} | {c['worker'] for it in items for c in it['candidates']},
                               key=lambda w: (w[0] != 'p', len(w), w)),
                fresh=sum(1 for it in items if it['fresh']),
                categories=sorted({it['category'] for it in items}),
                picked=sum(1 for it in items if it['pick'] and it['pick'].get('choice')),
                out=sorted(os.path.relpath(p, OUT) for p in glob.glob(os.path.join(OUT, 'rooms', '*.png'))))

def ctx_png(s, cand):
    from PIL import Image
    import context
    o = objects_by_slug()[s]
    if cand == 'v5':
        src, v = None, 'v5'
    else:
        base = os.path.join(CAND, s, cand)
        png = base + '.png'
        if not os.path.exists(png):
            sys.path.insert(0, PXGRID); import pxgrid
            pxgrid.render(base + '.pxg', png)
        src = png; v = str(int(os.path.getmtime(png)))
    cp = os.path.join(CACHE, s, f'{cand}-{v}.png')
    if not os.path.exists(cp):
        with CTX_LOCK:   # v5 방 조립은 모듈 전역(room2.CEIL)을 쓴다 → 한 번에 하나
            slot = Image.open(src).convert('RGBA') if src else None
            im, _ = context.context_image(o, slot)
        os.makedirs(os.path.dirname(cp), exist_ok=True)
        for old in glob.glob(os.path.join(CACHE, s, f'{cand}-*.png')): os.remove(old)
        tmp = cp + '.tmp'; im.save(tmp, format='PNG'); os.replace(tmp, cp)
    return open(cp, 'rb').read()

class H(BaseHTTPRequestHandler):
    def log_message(self, fmt, *a):
        pass

    def send(self, code, body, ctype='application/json; charset=utf-8'):
        if isinstance(body, str): body = body.encode('utf-8')
        self.send_response(code); self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store' if 'json' in ctype or 'html' in ctype else 'max-age=5')
        self.end_headers(); self.wfile.write(body)

    def file(self, path, ctype):
        if not os.path.isfile(path): return self.send(404, '{"error":"없음"}')
        self.send(200, open(path, 'rb').read(), ctype)

    def do_GET(self):
        p = urllib.parse.urlparse(self.path).path; parts = [urllib.parse.unquote(x) for x in p.split('/') if x]
        try:
            if parts == ['favicon.ico']:
                self.send_response(204); self.end_headers(); return
            if not parts or parts == ['index.html']:
                return self.file(os.path.join(WEB, 'index.html'), 'text/html; charset=utf-8')
            if parts == ['api', 'state']:
                return self.send(200, json.dumps(state(), ensure_ascii=False))
            if parts == ['api', 'history']:
                q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
                return self.send(200, json.dumps({'events': picks_db.history(q.get('id', [''])[0])}, ensure_ascii=False))
            if parts[0] == 'c' and len(parts) == 3 and SAFE.match(parts[1]) and SAFE_FILE.match(parts[2]) and parts[2].endswith('.png'):
                return self.file(os.path.join(CAND, parts[1], parts[2]), 'image/png')
            if parts[0] == 'ctx' and len(parts) == 3 and SAFE.match(parts[1]) and parts[2].endswith('.png'):
                cand = parts[2][:-4]
                if cand != 'v5' and not WORKER_RE.match(cand + '.pxg'): return self.send(404, '{}')
                if parts[1] not in objects_by_slug(): return self.send(404, '{}')
                return self.send(200, ctx_png(parts[1], cand), 'image/png')
            if parts[0] == 'out' and len(parts) >= 2 and all(SAFE_FILE.match(x) for x in parts[1:]):
                return self.file(os.path.join(OUT, *parts[1:]), 'image/png' if parts[-1].endswith('.png') else 'application/json')
        except Exception as e:
            return self.send(500, json.dumps({'error': repr(e)[:300]}, ensure_ascii=False))
        self.send(404, '{"error":"없음"}')

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        if path not in ('/api/pick', '/api/revert'):
            return self.send(404, '{}')
        try:
            n = int(self.headers.get('Content-Length', 0)); body = json.loads(self.rfile.read(n) or b'{}')
            if path == '/api/revert':
                i, (rec, eid) = picks_db.revert(int(body['event']))
            else:
                i = body['id']; by = objects_by_id()
                if i not in by: return self.send(400, '{"error":"모르는 기물"}')
                choice = body.get('choice')
                def exists(c):
                    return bool(WORKER_RE.match(str(c) + '.pxg')) and os.path.exists(os.path.join(CAND, slug(i), str(c) + '.pxg'))
                if choice not in (None, 'v5') and not exists(choice):
                    return self.send(400, '{"error":"없는 후보"}')
                if 'variants' in body:
                    vs = body['variants']
                    if not isinstance(vs, list) or any(not isinstance(v, str) or not exists(v) for v in vs):
                        return self.send(400, json.dumps({'error': '함께 쓰기(variants)에 없는 후보', 'variants': vs}, ensure_ascii=False))
                if 'note' in body and not isinstance(body['note'], str):
                    return self.send(400, '{"error":"메모는 글자"}')
                client = str(body.get('client') or 'web')[:20]
                rec, eid = picks_db.apply(i, {k: body[k] for k in ('choice', 'note', 'variants', 'clear') if k in body}, client)
        except (KeyError, ValueError, TypeError) as e:
            return self.send(400, json.dumps({'error': repr(e)}, ensure_ascii=False))
        except Exception as e:   # DB 커밋 실패 = 저장 안 됨 → 200 을 주지 않는다
            return self.send(500, json.dumps({'error': '저장 실패: ' + repr(e)[:300]}, ensure_ascii=False))
        try:
            picks_db.export()   # 커밋은 끝났다. 내보내기 실패는 저장 실패가 아니다(다음 쓰기·시작 때 다시 쓴다)
        except Exception as e:
            print('picks.json 내보내기 실패:', repr(e), flush=True)
        return self.send(200, json.dumps({'ok': True, 'id': i, 'event': eid, 'pick': rec}, ensure_ascii=False))

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--port', type=int, default=18302); ap.add_argument('--host', default='0.0.0.0'); a = ap.parse_args()
    picks_db.conn(); picks_db.ensure_imported()   # 빈 DB 면 picks.json·addressed.json 을 import 이벤트로
    picks_db.verify(verbose=True)
    picks_db.export()
    picks_db.backup_loop()
    ThreadingHTTPServer.daemon_threads = True
    srv = ThreadingHTTPServer((a.host, a.port), H)
    print(f'http://{a.host}:{a.port}/ — {PICK}', flush=True)
    srv.serve_forever()

if __name__ == '__main__':
    main()
