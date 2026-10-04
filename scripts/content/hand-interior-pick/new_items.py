#!/usr/bin/env python3
"""새 기물 길(new/items.json)의 공통 도우미 — v5 381개 밖의 기물.
  new_f(o, im)            가짜 객체 o + 후보 그림 → 방 조립·시트용 F (kind·칸 수·up 은 items.json 그대로)
  place(m, f, ...)        방 m 에서 f 를 놓을 자리(종류별) — 방 검사(room4.check) 이슈가 늘지 않는 첫 자리
  context(o, slot)        contextRoom 에 임시로 한 번 놓은 맥락 그림 (정본 rooms4.B 는 건드리지 않는다)
  register(kit4, o, im)   kit4.OBJ 에 등록(굽기 때). 선택된 새 기물만 부른다.
  meta_entry(o, f)        interior-meta.json 의 objects 항목(v5 와 같은 모양)
"""
import copy, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa
from PIL import Image


def new_f(o, im):
    """F(그림, 폭 칸, 발밑 칸, 솟는 px, 종류) + id. 그림 크기는 items.json 캔버스와 같아야 한다."""
    import kit4
    a = o['atlas']
    if im.size != (a['w'], a['h']): raise ValueError(f"{o['id']}: 그림 {im.size} != 캔버스 {(a['w'], a['h'])}")
    fp = o['footprint']
    f = kit4.F(im, int(fp['w']), int(fp['h']), int(o['overhang_px']), o['kind'])
    f.id = o['id']
    return f


def register(kit4, o, im, frames=None, ms=None):
    def make():
        f = new_f(o, im)
        if frames:
            f.frames = frames
            f.frame_ms = ms
        return f
    kit4.OBJ[o['id']] = (o['category'], make)


def meta_entry(o):
    """v5 meta_for 와 같은 모양의 항목. 가짜 객체에서 new·contextRoom·atlas 같은 하네스 전용 키를 뺀다."""
    drop = {'atlas', 'new', 'contextRoom', 'since', 'summary', 'where'}
    m = {k: copy.deepcopy(v) for k, v in o.items() if k not in drop}
    m['name_en'] = o.get('name_en') or o['id']
    return m


def _opaque(f, x, y, room4):
    im = f.frames[0] if getattr(f, 'frames', None) else f.im
    X0, Y0, _, _ = room4.item_rect(f, x, y); al = im.getchannel('A').load()
    return {(X0 + lx, Y0 + ly) for ly in range(im.height) for lx in range(im.width) if al[lx, ly]}


def place(m, f, room4, room2, limit=80):
    """방 m 에 f 를 놓을 자리 (x, y) 또는 None.
    wall: 발밑 첫 줄 = 북쪽 벽면 둘째 줄(face==2) 바로 아래 / hang: 벽면 첫 줄(face==1) / floor·flat: 빈 바닥.
    방 가운데에 가까운 순. 방 검사(겹침·통로·닿음·걸이·벽 가구) 이슈가 늘지 않고, 다른 기물 그림과 8화소 넘게 겹치지 않는 자리 중 겹침이 가장 적은 것."""
    W, H, g, face, top, inn = room2.analyse(m['plan'])
    floor = lambda X, Y: 0 <= X < W and 0 <= Y < H and g[Y][X] and not face[Y][X]
    base = room4.check(m); old = set(base['issues'])
    others = [_opaque(it[0], it[1], it[2], room4) for it in m['items'] if it[0].kind != 'flat']
    other_px = set().union(*others) if others else set()
    cells = []
    for y in range(H):
        for x in range(0, W - f.fw + 1):
            xs = range(x, x + f.fw)
            if f.kind == 'hang': ok = all(0 <= y < H and g[y][xx] and face[y][xx] == 1 for xx in xs)
            elif f.kind == 'wall': ok = y > 0 and all(face[y - 1][xx] == 2 for xx in xs) and all(floor(xx, y + dy) for xx in xs for dy in range(max(1, f.fh)))
            else: ok = all(floor(xx, y + dy) for xx in xs for dy in range(max(1, f.fh)))
            if ok and f.kind in ('floor', 'wall', 'flat'):   # 1칸 통로·복도를 막는 자리는 뺀다(양옆이 다 벽/빈 곳, 또는 위아래가 다 벽)
                hy = range(y, y + max(1, f.fh))
                side = all(not floor(x - 1, yy) for yy in hy) and all(not floor(x + f.fw, yy) for yy in hy)
                vert = f.kind == 'floor' and not floor(x, y - 1) and not floor(x, y + max(1, f.fh)) and not (y > 0 and face[y - 1][x] == 2)
                if side or vert: ok = False
            if ok: cells.append((x, y))
    cx, cy = W / 2 - f.fw / 2, H / 2
    cells.sort(key=lambda p: (abs(p[0] - cx) + abs(p[1] - cy) * (0.3 if f.kind in ('wall', 'hang') else 1), p))
    best = None
    for x, y in cells[:limit]:
        px = _opaque(f, x, y, room4)
        hit = len(px & other_px)
        if hit > 8: continue
        n = dict(m); n['items'] = list(m['items']) + [(f, x, y)]
        try: r = room4.check(n)
        except IndexError: continue
        if not set(r['issues']) <= old: continue
        if best is None or hit < best[0]: best = (hit, x, y)
        if hit == 0: break
    return None if best is None else (best[1], best[2])


def context(o, slot, margin=(3, 3)):
    """새 기물 o 를 contextRoom 의 첫 자리에 놓은 1배 맥락 그림과 방 이름. 정본 rooms4.B 는 복사본에만 항목을 더한다."""
    import room2
    rooms4, room4 = v5_modules()
    key = o.get('contextRoom')
    if key not in rooms4.B: raise SystemExit(f"{o['id']}: contextRoom {key!r} 가 rooms4.B 에 없다")
    f = new_f(o, slot.convert('RGBA'))
    for m in rooms4.B[key]['maps']:
        at = place(m, f, room4, room2)
        if at is None: continue
        n = dict(m); n['items'] = list(m['items']) + [(f, at[0], at[1])]
        full = room4.compose(n)
        X0, Y0, X1, Y1 = room4.item_rect(f, *at); mx, my = margin[0] * 16, margin[1] * 16
        box = (max(0, X0 - mx), max(0, Y0 - my), min(full.width, X1 + mx), min(full.height, Y1 + my))
        return full.crop(box), (m.get('name') or m['key']) + ' (임시로 놓음)'
    raise SystemExit(f"{o['id']}: contextRoom {key!r} 에 놓을 자리가 없다")
