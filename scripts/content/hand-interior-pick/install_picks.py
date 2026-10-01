#!/usr/bin/env python3
"""고르기 결과(picks.json)를 v5 가구 표(kit4.OBJ)에 끼워 넣는다 — build_tileset.py 가 시트를 구울 때 부른다.

  install()          rooms4 import **전**: 크기가 같은 선택을 넣는다 → 예제 맵·시트 모두 새 그림.
  install_resized()  rooms4 import **뒤**: 크기를 바꾼 선택(candidates/<slug>/resize.json)을 넣는다.
                     예제 맵은 v5 크기 그대로 둔다(정답 통행 격자가 v5 칸 점유로 적혀 있다). 시트·조립 사양은 새 크기.
  variant_meta(META) 「함께 쓰기」 변형(<원 id>#2 …)의 메타 항목을 META['objects'] 에 덧붙이고,
                     크기를 바꾼 기물의 이름·설명 속 옛 칸 수(「(2×2, …)」「1칸」)를 새 칸 수로 고친다.
  REPORT             넣은 것·건너뛴 것(이유) — build_tileset 이 pickedFrom 으로 남긴다.

정본 v5(tiledata/hand-interior/v5)는 읽기만 한다. 끄려면 HAND_INTERIOR_PICKS=0.
건너뛰는 것: 선택 없음·v5 유지, 후보 파일 없음, 그림 크기가 칸 자리(또는 resize.json 캔버스)와 다른 것(크기를 바꾸라는 메모 뒤
아직 새 크기 후보를 고르지 않은 경우), 크기를 바꾼 애니메이션 기물. 애니메이션 기물은 몸통만 고른 그림이고 움직이는 화소는 v5 프레임(_animated).
"""
import copy, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CAND, PICK, PXGRID, geom, objects_by_id, slug  # noqa: E402
from PIL import Image  # noqa: E402

REPORT = {'applied': [], 'resized': [], 'variants': [], 'skipped': []}
_PLAN = None


def _png(s, choice):
    base = os.path.join(CAND, s, choice)
    png = base + '.png'
    if not os.path.exists(png) or os.path.getmtime(png) < os.path.getmtime(base + '.pxg'):
        if PXGRID not in sys.path: sys.path.insert(0, PXGRID)
        import pxgrid
        pxgrid.render(base + '.pxg', png)
    return Image.open(png).convert('RGBA')


def _plan():
    global _PLAN
    if _PLAN is not None: return _PLAN
    path = os.path.join(PICK, 'picks.json')
    picks = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {}
    by = objects_by_id()
    same, resized, variants = {}, {}, []
    for i, p in sorted(picks.items()):
        ch = (p or {}).get('choice')
        skip = lambda why: REPORT['skipped'].append({'id': i, 'choice': ch, 'why': why})
        if i not in by: skip('v5 에 없는 기물'); continue
        if not ch or ch == 'v5': skip('v5 유지' if ch == 'v5' else '선택 없음'); continue
        o, s = by[i], slug(i)
        if not os.path.exists(os.path.join(CAND, s, ch + '.pxg')): skip('후보 파일 없음'); continue
        im, G = _png(s, ch), geom(o)
        if o['atlas']['frames'] > 1 and (G['resized'] or not os.path.exists(os.path.join(CAND, s, 'anim-mask.png'))):
            skip('애니메이션 기물(12프레임) — 크기를 바꿨거나 anim-mask.png 가 없다'); continue
        if list(im.size) != G['canvas']:
            skip(f"그림 {im.size[0]}×{im.size[1]} 이 " + ('resize.json 캔버스' if G['resized'] else '칸 자리') + f" {G['canvas'][0]}×{G['canvas'][1]} 와 다름"); continue
        if G['resized']:
            resized[i] = (im, G['footprint'], ch)
        else:
            same[i] = (im.crop((0, G['padTop'], im.width, im.height)), ch)
        for k, v in enumerate((p or {}).get('variants') or [], start=2):
            if not os.path.exists(os.path.join(CAND, s, v + '.pxg')):
                REPORT['skipped'].append({'id': f'{i}#{k}', 'choice': v, 'why': '변형 후보 파일 없음'}); continue
            vim = _png(s, v)
            if vim.size != im.size:
                REPORT['skipped'].append({'id': f'{i}#{k}', 'choice': v, 'why': '변형 크기가 주 선택과 다름'}); continue
            variants.append((i, k, v, vim, G))
    _PLAN = (same, resized, variants)
    return _PLAN


def _animated(f, body):
    """애니메이션 기물: 몸통은 고른 그림, 12프레임 동안 바뀌는 화소(v5 프레임끼리 다른 화소 = anim-mask.png)만 v5 프레임에서 가져온다.
    작업자는 움직이는 자리를 v5 와 같은 좌표에 두고 그 바깥만 다시 그린다(WORKER-V34-REDO.md §2)."""
    import numpy as np
    A = np.stack([np.array(fr.convert('RGBA')) for fr in f.frames])
    diff = (A != A[0]).any(axis=(0, 3))
    B = np.array(body)
    out = []
    for t in range(len(f.frames)):
        fr = B.copy(); fr[diff] = A[t][diff]
        out.append(Image.fromarray(fr))
    return out


def _same_size(f, im):
    g = copy.copy(f)
    if im.size != f.im.size:   # 스크립트 그림과 아틀라스 칸 자리가 다른 드문 경우: 아래 맞춤
        c = Image.new('RGBA', f.im.size)
        c.alpha_composite(im.crop((0, max(0, im.height - f.im.height), min(im.width, f.im.width), im.height)), (0, max(0, f.im.height - im.height)))
        im = c
    if getattr(f, 'frames', None) and len(f.frames) > 1:
        g.frames = _animated(f, im); g.im = g.frames[0]
        return g
    g.im = im; g.frames = None
    return g


def _resize(f, im, fp):
    g = copy.copy(f)
    g.im = im; g.frames = None; g.cells = None
    g.fw = int(fp['w']); g.fh = int(fp['h'])
    g.up = 0 if f.kind in ('hang', 'flat') else max(0, im.height - g.fh * 16)
    if f.kind in ('floor', 'wall') and g.fh:   # 발밑 칸 중 그림이 없는 칸(계단 귀퉁이 등)은 막지 않는다 — 엔진도 빈 칸은 걷는다
        al = im.getchannel('A'); top = im.height - g.fh * 16
        full = [(a, b) for b in range(g.fh) for a in range(g.fw)]
        cells = [(a, b) for a, b in full if al.crop((a * 16, top + b * 16, a * 16 + 16, top + b * 16 + 16)).getbbox()]
        if len(cells) < len(full): g.cells = cells
    if getattr(f, 'surf', None):   # 탁상 물건 자리: 새 그림 비율로
        sx, sy = im.width / f.im.width, im.height / f.im.height
        x0, y0, x1, y1 = f.surf
        g.surf = (round(x0 * sx), round(y0 * sy), round(x1 * sx), round(y1 * sy))
    return g


def _wrap(kit4, i, make):
    cat, fn = kit4.OBJ[i]
    def nf(fn=fn, i=i):
        f = fn(); f.id = getattr(f, 'id', None) or i
        return make(f)
    kit4.OBJ[i] = (cat, nf)


def install():
    import kit4, kit5, anim4, props5, props6, chapel5, tiles5  # noqa: F401  (OBJ 등록을 모두 끝낸다)
    same, _, variants = _plan()
    for i, (im, ch) in same.items():
        if i not in kit4.OBJ: REPORT['skipped'].append({'id': i, 'choice': ch, 'why': 'kit4.OBJ 에 없음'}); continue
        _wrap(kit4, i, lambda f, im=im: _same_size(f, im))
        REPORT['applied'].append({'id': i, 'choice': ch})
    return REPORT


def install_resized():
    import kit4
    same, resized, variants = _plan()
    for i, (im, fp, ch) in resized.items():
        if i not in kit4.OBJ: REPORT['skipped'].append({'id': i, 'choice': ch, 'why': 'kit4.OBJ 에 없음'}); continue
        _wrap(kit4, i, lambda f, im=im, fp=fp: _resize(f, im, fp))
        REPORT['resized'].append({'id': i, 'choice': ch, 'footprint': [int(fp['w']), int(fp['h'])], 'canvas': list(im.size)})
    _replace_in_rooms(kit4, resized)
    for i, k, v, vim, G in variants:
        cat, fn = kit4.OBJ[i]
        def nf(fn=fn, i=i, k=k, vim=vim, G=G):
            f = fn(); f.id = f'{i}#{k}'
            return _resize(f, vim, G['footprint']) if G['resized'] else _same_size(f, vim.crop((0, G['padTop'], vim.width, vim.height)))
        kit4.OBJ[f'{i}#{k}'] = (cat, nf)
        REPORT['variants'].append({'id': f'{i}#{k}', 'variantOf': i, 'choice': v})
    return REPORT


ROOM_CHANGES = {}   # 예제 맵 key → 바뀐 rooms4 맵(META 의 items·grid 를 맞춘다)


def _opaque(f, x, y, room4):
    im = f.frames[0] if getattr(f, 'frames', None) else f.im
    X0, Y0, _, _ = room4.item_rect(f, x, y); al = im.getchannel('A').load()
    return {(X0 + lx, Y0 + ly) for ly in range(im.height) for lx in range(im.width) if al[lx, ly]}


def _fit(m, j, g, room4, room2):
    """방 m 의 j 번째 항목을 새 크기 g 로 바꿔 놓을 자리. 원래 자리(커진 만큼 가운데 맞춤)부터 가까운 순으로(±8칸·±4줄, 걸이는 같은 줄),
    방 검사(room4.check — 겹침·바닥·통로·닿음) 이슈가 늘지 않고 방 밖 공허에 그림이 새지 않고 다른 기물 그림과 더 겹치지 않는(8화소까지 봐줌) 첫 자리.
    반환 (x, y) 또는 None."""
    f, x, y = m['items'][j][:3]
    W, H, gg, face, top, inn = room2.analyse(m['plan'])
    floor = lambda X, Y: 0 <= X < W and 0 <= Y < H and gg[Y][X] and not face[Y][X]
    inside = lambda X, Y: 0 <= Y < H and 0 <= X < len(m['plan'][Y]) and m['plan'][Y][X] != '#'
    base = room4.check(m); old_issues = set(base['issues'])
    others = [_opaque(it[0], it[1], it[2], room4) for k, it in enumerate(m['items']) if k != j and it[0].kind != 'flat']
    other_px = set().union(*others) if others else set()
    old_px = _opaque(f, x, y, room4)
    old_out = sum(1 for (X, Y) in old_px if not inside(X // 16, Y // 16)); old_hit = len(old_px & other_px)
    cx, cy = x - (g.fw - f.fw) / 2, y - max(0, g.fh - f.fh)
    dys = [0] if g.kind == 'hang' else range(-4, 5)
    cand = sorted(((x + dx, y + dy) for dx in range(-8, 9) for dy in dys), key=lambda p: (abs(p[0] - cx) + abs(p[1] - cy), abs(p[1] - y), p))
    for nx, ny in cand:
        if nx < 0 or ny < 0: continue
        if g.kind == 'flat' and not all(floor(X, Y) for X, Y in room4.cells_of(g, nx, ny)): continue
        px = _opaque(g, nx, ny, room4)
        if sum(1 for (X, Y) in px if not inside(X // 16, Y // 16)) > old_out: continue
        if len(px & other_px) > old_hit + 8: continue   # 가장자리 몇 화소 닿는 것은 봐준다
        n = dict(m); n['items'] = list(m['items']); n['items'][j] = (g, nx, ny) + tuple(m['items'][j][3:])
        try: r = room4.check(n)
        except IndexError: continue   # 걸이가 평면 밖 줄을 짚음
        if set(r['issues']) <= old_issues and (r['ok'] or not base['ok']): return nx, ny
    return None


def _replace_in_rooms(kit4, resized):
    """예제 방(rooms4.B)의 크기 바꾼 기물을 새 크기로 다시 놓는다. 자리가 없으면 그 방에서 뺀다(REPORT roomDrops)."""
    import rooms4, room4, room2
    REPORT.setdefault('roomMoves', []); REPORT.setdefault('roomDrops', [])
    for key, b, m in rooms4.all_maps():
        changed = False; drops = []
        for j in range(len(m['items'])):
            it = m['items'][j]; i = getattr(it[0], 'id', None)
            if i not in resized or getattr(it[0], 'line', None): continue
            g = kit4.OBJ[i][1](); g.id = i
            at = _fit(m, j, g, room4, room2)
            if at is None:
                REPORT['roomDrops'].append({'room': m['key'], 'id': i, 'at': [it[1], it[2]]})
                drops.append(j)   # 끝에서 뺀다(그때까지는 옛 크기로 남아 다른 기물 자리 검사에 쓰인다)
            else:
                m['items'][j] = (g,) + at + tuple(it[3:])
                REPORT['roomMoves'].append({'room': m['key'], 'id': i, 'from': [it[1], it[2]], 'to': list(at)})
            changed = True
        if changed:
            m['items'][:] = [it for k, it in enumerate(m['items']) if k not in drops]
            ROOM_CHANGES[m['key']] = (drops, m, room4.check(m))


def _meta_rooms(meta):
    """META buildings 의 예제 맵 items·grid 를 바뀐 rooms4 맵에 맞춘다(items 는 순서가 1:1)."""
    for b in meta['buildings']:
        for mm in b['maps']:
            ch = ROOM_CHANGES.get(mm['id'])
            if not ch: continue
            drops, m, r = ch
            items = [x for k, x in enumerate(mm['items']) if k not in drops]
            assert len(items) == len(m['items']), mm['id']
            for x, it in zip(items, m['items']):
                f = it[0]
                if getattr(f, 'id', None) and x.get('id') == f.id:
                    x['x'], x['y'], x['w'], x['h'] = it[1], it[2], f.fw, f.fh
            mm['items'] = items; mm['grid'] = r['grid']; mm['mustClear'] = [list(c) for c in r['mustClear']]


def _resize_text(t, w, h):
    if not t: return t
    size = f'{w}×{h}' if h else f'{w}칸 폭'
    t = re.sub(r'\(\d+×\d+[^)]*\)', f'({size})', t)
    return re.sub(r'(?<![\d×])1칸', f'{size}칸' if h else '1칸', t)


def variant_meta(meta):
    """변형 id 의 메타(이름·설명·태그)를 원 기물에서 만들어 덧붙인다. 크기를 바꾼 기물은 옛 칸 수 문구를 고친다."""
    by = {o['id']: o for o in meta['objects']}
    _meta_rooms(meta)
    for r in REPORT['resized']:
        o = by.get(r['id'])
        if not o: continue
        w, h = r['footprint']
        for k in ('name_ko', 'summary', 'description'):
            if o.get(k): o[k] = _resize_text(o[k], w, h)
    for v in REPORT['variants']:
        o = by.get(v['variantOf'])
        if not o or v['id'] in by: continue
        n = copy.deepcopy(o); k = v['id'].rsplit('#', 1)[1]
        n['id'] = v['id']; n['variantOf'] = o['id']
        if n.get('name_ko'): n['name_ko'] = f"{n['name_ko']} 변형 {k}"
        if n.get('name_en'): n['name_en'] = f"{n['name_en']} variant {k}"
        n['description'] = f"{o.get('description', '')} (변형 {k} — 원 기물과 함께 쓴다)"
        if n.get('summary'): n['summary'] = f"{n['summary']} (변형 {k})"
        n['tags'] = list(o.get('tags', [])) + ['variant']
        meta['objects'].append(n); by[n['id']] = n
    return meta
