#!/usr/bin/env python3
"""생성 칩셋 조각 고르는 화면 서버 (표준 라이브러리 + PIL). 포트 18303, 0.0.0.0. 세트(현대·일본·월드맵·호러·학원 …)는 tiledata/atlas-pick/sets.json.
16px 실내 고르는 화면(scripts/content/hand-interior-pick, 18302)의 사본을 세트 단위로 일반화한 것 — 그 서버·데이터는 건드리지 않는다.

  python3 scripts/content/atlas-pick/pick_server.py [--port 18303]
  systemd --user 유닛: ~/.config/systemd/user/atlas-pick.service

GET  /                              고르는 화면 (web/index.html)
GET  /api/sets                      세트 목록 + 세트별 기물·후보·고름 수
GET  /api/state?set=<세트>           그 세트의 기물·후보·검사 요약·선택 (요청마다 후보 폴더를 다시 읽는다 → 새 후보는 새로고침만으로 보인다)
GET  /c/<세트>/<slug>/<파일.png>     기물 폴더의 그림 (v0.png · members.png · j1-A.png …)
GET  /ctx/<세트>/<slug>/<후보>.png   맥락 그림(1배). 후보 = v0 | j1-A …  (현대 = 강남 맵의 그 자리, 그 밖 = 보도·도로 둘레)
GET  /api/history?set=<세트>&id=<slug>   그 기물의 이력(새것 먼저)
POST /api/pick     {"set", "id", "choice": "v0"|"j1-A"|null, "note", "variants": [...], "client"} → SQLite 정본(picks_db.py)에
                   이벤트 추가 + current 갱신을 한 트랜잭션으로 커밋한 **뒤에만** 200. 그다음 picks-<세트>.json 을 내보내기로 다시 쓴다.
                   보내지 않은 키는 기존 값 유지. variants = 주 선택과 함께 쓸 추가 후보(있는 후보만).
조립형 킷(sets.json "kits", 일본): 킷 = 기물 한 개(kind='kit', 키 jp/<킷>), 후보 = 부품 시트 한 장. 후보마다 kit(조립 결과 요약)이 붙고
                   그림은 /c/<세트>/<킷>/<후보>.ctx-<예>.png · .walk-<예>.png · .parts.png · .seams.png (jp_kit_compose.py 가 굽는다).
                   킷이 대체한 옛 기물은 movedTo=<킷> — 선택·메모 기록은 그대로 두고 화면에서만 숨긴다.
POST /api/revert   {"event": 이벤트 id} → 그 이벤트 뒤의 상태를 새 이벤트로 다시 적용
정본은 ~/.local/share/oprn/atlas-pick/picks.sqlite (기물 키 "<세트>/<slug>"). picks-<세트>.json·addressed-<세트>.json 은 내보내기.
「메모 반영」 기록: python3 scripts/content/atlas-pick/picks_db.py address <세트> <slug> "<요약>"
"""
import argparse, datetime, glob, json, os, re, sys, threading, urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa
import picks_db

WEB = os.path.join(HERE, 'web')
CACHE = os.path.join(BASE, '.cache', 'ctx')
CTX_LOCK = threading.Lock()
SAFE = re.compile(r'^[A-Za-z0-9_]+$'); SAFE_FILE = re.compile(r'^[A-Za-z0-9_.\-]+$')

def kit_result(base, src_mtime):
    """조립형 킷 후보의 조립 결과(<후보>.kit.json, jp_kit_compose.py 가 쓴다). 시트(.pxg)보다 오래됐으면 stale."""
    kj = base + '.kit.json'
    r = read_json(kj, None)
    if r is None: return dict(stale=True, examples=[], hard=[], warn=[])
    return dict(stale=os.path.getmtime(kj) < src_mtime - 1, ok=r.get('ok'), hard=r.get('hard', []), warn=r.get('warn', []),
                borrowed=r.get('borrowed', {}), v=int(os.path.getmtime(kj)),
                examples=[dict(id=e['id'], name=e.get('name', ''), cells=e.get('cells'), ctxSize=e.get('ctxSize'), through=e.get('through'),
                               errs=len(e.get('errs', [])), doors=e.get('doors', 0)) for e in r.get('examples', [])],
                repeatBad=[x['slug'] + ' ' + x['axis'] for x in r.get('repeat', []) if x.get('bad')])

def candidates(st, s, canvas=None, kit=False):
    out = []; sd = std_of(st, s)
    for f in sorted(glob.glob(os.path.join(cand_dir(st), s, '*.pxg'))):
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
                 v=int(os.path.getmtime(png)) if os.path.exists(png) else 0, src=int(os.path.getmtime(f)))
        if ck:
            lint = ck.get('lint', {})
            c.update(ok=ck.get('ok'), hard=ck.get('hard', []), warn=ck.get('warn', []), lintPass=lint.get('pass'),
                     lintFailed=lint.get('failed', []), refmapMax=ck.get('refmap', {}).get('max'), easyMax=ck.get('easyrpg', {}).get('max'),
                     colors=ck.get('colors'))
        if kit:
            c['kit'] = kit_result(base, os.path.getmtime(f))
        elif canvas and os.path.exists(png):   # 크기를 바꾼 기물: 캔버스가 다른 옛 후보는 「옛 크기」(지우지 않고 접어 보인다)
            try:
                from PIL import Image
                sdt = std_tag(st, s, name); want = list(sdt['canvas']) if sdt else list(canvas)   # 표준(실제 비율 §12) 태그 후보는 표준 캔버스로 견준다
                c['std'] = want != list(canvas)
                with Image.open(png) as im: c['old'] = list(im.size) != want
            except OSError: pass
        out.append(c)
    out.sort(key=lambda c: (c['dir'], c['worker'] != 'pilot', c['worker']))
    return out

def ts(x):
    try: return datetime.datetime.fromisoformat(x).timestamp()
    except (TypeError, ValueError): return 0

def state(st):
    conf = set_conf(st)
    picks_db.sync_addressed_file(st)
    picks = picks_db.current_all(None, st); addressed = picks_db.addressed_all(None, st)
    base = conf.get('baseline'); cd = cand_dir(st)
    items = []
    for o in items_fn(st):
        s = o['slug']; kit = o.get('kind') == 'kit'
        cands = candidates(st, s, o.get('canvas'), kit)
        it = dict(id=s, slug=s, name=o.get('name', s), category=o.get('scene', ''), layer=o.get('layer', ''), layer_ko=o.get('layer_ko', ''),
                  description=o.get('description', ''), hint=o.get('palette_hint', ''), canvas=o.get('canvas') or [o['cells'][0] * 16, o['cells'][1] * 16],
                  cells=o.get('cells'), worker=o.get('worker', '-'), members=o.get('members', []), candidates=cands, pick=picks.get(s),
                  hasBaseline=bool(base) and os.path.exists(os.path.join(cd, s, f'{base}.png')),
                  hasMembers=os.path.exists(os.path.join(cd, s, 'members.png')) and len(o.get('members', [])) > 1)
        # 참고 그림(고르지 않는다): 호러 v5_ref(원본 v5 조각) 등. info 의 v5_ref / refs = [{file, name_ko|name}]
        it['refs'] = [dict(file=r['file'], name=r.get('name_ko') or r.get('name') or r.get('id', ''))
                      for r in (o.get('v5_ref') or o.get('refs') or []) if isinstance(r, dict) and r.get('file') and SAFE_FILE.match(r['file'])
                      and os.path.exists(os.path.join(cd, s, r['file']))]
        pk = it['pick'] or {}
        it['hasNote'] = bool((pk.get('note') or '').strip())
        ad = addressed.get(s) or {}
        newest = max([c['src'] for c in cands] + [ts(ad.get('at'))] + [0])
        note_at = ts(pk.get('noteAt') or pk.get('at'))
        it['addressed'] = it['hasNote'] and newest > note_at + 1   # 메모 뒤에 새 후보 원본(.pxg) 또는 감독자 반영 기록이 생겼다
        it['review'] = it['addressed'] and ts(pk.get('at')) < newest   # 그 뒤로 사용자가 아직 안 봤다
        it['addressedSummary'] = ad.get('summary', '')
        it['kind'] = o.get('kind', 'item')
        if o.get('movedTo'): it['movedTo'] = o['movedTo']
        if o.get('resized'): it['resized'] = o['resized']
        if o.get('added'): it['added'] = o['added']
        if kit:
            it.update(replaces=o.get('replaces', []), contract=o.get('contract', []), nParts=len(o.get('parts', [])),
                      exampleNames=[dict(id=e['id'], name=e.get('name', '')) for e in o.get('examples', [])])
        items.append(it)
    jobs = read_json(os.path.join(BASE, conf['items']), {}) or {}
    return dict(set=st, name=conf['name'], about=conf.get('about', ''), baseline=base, items=items,
                ctxScale=conf.get('ctxScale', 2), ctxFirst=bool(conf.get('ctxFirst')),
                directions=(jobs.get('directions') if isinstance(jobs, dict) else None) or {'A': '결 따르기', 'B': '명암·그림자 강화', 'C': '실루엣 재해석'},
                workers=sorted({it['worker'] for it in items} | {c['worker'] for it in items for c in it['candidates']}),
                categories=list(dict.fromkeys(it['category'] for it in items if it['category'])),
                picked=sum(1 for it in items if it['pick'] and it['pick'].get('choice')))

items_fn = items   # common.items(세트)

def sets_summary():
    out = []
    for m in list_sets():
        its = [i for i in items_fn(m['id']) if not i.get('movedTo')]; cur = picks_db.current_all(None, m['id'])
        n = sum(len(glob.glob(os.path.join(cand_dir(m['id']), i['slug'], '*.pxg'))) for i in its)
        out.append(dict(id=m['id'], name=m['name'], about=m.get('about', ''), items=len(its), candidates=n,
                        picked=sum(1 for i in its if (cur.get(i['slug']) or {}).get('choice'))))
    return out

def ctx_png(st, s, cand):
    from PIL import Image
    import context
    it = items_by_slug(st)[s]; d = os.path.join(cand_dir(st), s)
    if cand == 'v0':
        png = os.path.join(d, 'v0.png'); src = None if st == 'modern' else png; v = 'v0'
    else:
        png = os.path.join(d, cand + '.png')
        if not os.path.exists(png): return None   # 작업자가 아직 검사(굽기) 전 — 작업자 폴더에 대신 굽지 않는다
        src = png; v = str(int(os.path.getmtime(png)))
    cp = os.path.join(CACHE, st, s, f'{cand}-{v}.png')
    if not os.path.exists(cp):
        with CTX_LOCK:
            slot = Image.open(src).convert('RGBA') if src else None
            im = context.context_image(st, it, slot)
            if im is None: return None
            os.makedirs(os.path.dirname(cp), exist_ok=True)
            for old in glob.glob(os.path.join(CACHE, st, s, f'{cand}-*.png')): os.remove(old)
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

    def set_ok(self, st):
        return any(m['id'] == st for m in list_sets())

    def do_GET(self):
        u = urllib.parse.urlparse(self.path); p = u.path; q = urllib.parse.parse_qs(u.query)
        parts = [urllib.parse.unquote(x) for x in p.split('/') if x]
        try:
            if parts == ['favicon.ico']:
                self.send_response(204); self.end_headers(); return
            if not parts or parts == ['index.html']:
                return self.file(os.path.join(WEB, 'index.html'), 'text/html; charset=utf-8')
            if parts == ['api', 'sets']:
                return self.send(200, json.dumps(sets_summary(), ensure_ascii=False))
            if parts == ['api', 'state']:
                st = q.get('set', [''])[0]
                if not self.set_ok(st): return self.send(404, '{"error":"모르는 세트"}')
                return self.send(200, json.dumps(state(st), ensure_ascii=False))
            if parts == ['api', 'history']:
                st = q.get('set', [''])[0]; i = q.get('id', [''])[0]
                return self.send(200, json.dumps({'events': picks_db.history(picks_db.key(st, i))}, ensure_ascii=False))
            if parts[0] == 'c' and len(parts) == 4 and self.set_ok(parts[1]) and SAFE.match(parts[2]) and SAFE_FILE.match(parts[3]) and parts[3].endswith('.png'):
                return self.file(os.path.join(cand_dir(parts[1]), parts[2], parts[3]), 'image/png')
            if parts[0] == 'ctx' and len(parts) == 4 and self.set_ok(parts[1]) and SAFE.match(parts[2]) and parts[3].endswith('.png'):
                cand = parts[3][:-4]
                if cand != 'v0' and not WORKER_RE.match(cand + '.pxg'): return self.send(404, '{}')
                if parts[2] not in items_by_slug(parts[1]): return self.send(404, '{}')
                b = ctx_png(parts[1], parts[2], cand)
                return self.send(200, b, 'image/png') if b else self.send(404, '{}')
        except (Exception, SystemExit) as e:   # pxgrid 는 격자 오류에 SystemExit 을 던진다
            return self.send(500, json.dumps({'error': repr(e)[:300]}, ensure_ascii=False))
        self.send(404, '{"error":"없음"}')

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        if path not in ('/api/pick', '/api/revert'):
            return self.send(404, '{}')
        st = None
        try:
            n = int(self.headers.get('Content-Length', 0)); body = json.loads(self.rfile.read(n) or b'{}')
            if path == '/api/revert':
                k, (rec, eid) = picks_db.revert(int(body['event'])); st, i = picks_db.split(k)
            else:
                st = body['set']; i = body['id']
                if not self.set_ok(st): return self.send(400, '{"error":"모르는 세트"}')
                if i not in items_by_slug(st): return self.send(400, '{"error":"모르는 기물"}')
                base = set_conf(st).get('baseline')
                choice = body.get('choice')
                def exists(c):
                    return bool(WORKER_RE.match(str(c) + '.pxg')) and os.path.exists(os.path.join(cand_dir(st), i, str(c) + '.pxg'))
                if choice is not None and not (base and choice == base) and not exists(choice):
                    return self.send(400, '{"error":"없는 후보"}')
                if 'variants' in body:
                    vs = body['variants']
                    if not isinstance(vs, list) or any(not isinstance(v, str) or not exists(v) for v in vs):
                        return self.send(400, json.dumps({'error': '함께 쓰기(variants)에 없는 후보', 'variants': vs}, ensure_ascii=False))
                if 'note' in body and not isinstance(body['note'], str):
                    return self.send(400, '{"error":"메모는 글자"}')
                client = str(body.get('client') or 'web')[:20]
                rec, eid = picks_db.apply(picks_db.key(st, i), {k: body[k] for k in ('choice', 'note', 'variants', 'clear') if k in body}, client)
        except (KeyError, ValueError, TypeError) as e:
            return self.send(400, json.dumps({'error': repr(e)}, ensure_ascii=False))
        except Exception as e:   # DB 커밋 실패 = 저장 안 됨 → 200 을 주지 않는다
            return self.send(500, json.dumps({'error': '저장 실패: ' + repr(e)[:300]}, ensure_ascii=False))
        try:
            picks_db.export(st)   # 커밋은 끝났다. 내보내기 실패는 저장 실패가 아니다
        except Exception as e:
            print('내보내기 실패:', repr(e), flush=True)
        return self.send(200, json.dumps({'ok': True, 'set': st, 'id': i, 'event': eid, 'pick': rec}, ensure_ascii=False))

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--port', type=int, default=18303); ap.add_argument('--host', default='0.0.0.0'); a = ap.parse_args()
    picks_db.conn(); picks_db.verify(verbose=True); picks_db.export(); picks_db.backup_loop()
    ThreadingHTTPServer.daemon_threads = True
    srv = ThreadingHTTPServer((a.host, a.port), H)
    print(f'http://{a.host}:{a.port}/ — {BASE} · DB {picks_db.DB}', flush=True)
    srv.serve_forever()

if __name__ == '__main__':
    main()
