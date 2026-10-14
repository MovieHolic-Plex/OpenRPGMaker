#!/usr/bin/env python3
"""jp_city 시설 실내(학교 보강 sx- · 사무실 보강 ox- · 병원 hs-) 공용 틀 — 2026-10-14.

그림 엔진은 modern_campus 다시 그리기 엔진(`scripts/content/modern-campus/art/px.py`, modern3 램프 잠금, (램프, 단) 화소)을 읽기만 한다.
등록·굽기 계약은 jp_city 실내 틀 `ikit.Registry` 그대로다(바닥·벽면·가구·걸이·문). 블록 파일에서:

    from inst import Inst
    I = Inst('interior_hospital', '병원')
    @I.obj('hs-ward-bed', '병실 침대', w=1, h=2, up=8, gate='low_furniture', use=('sleep',), tags=(...), place='...', desc='...')
    def _(c): ...            # c = px.C(w*16, (U+h)*16), 칸 좌표, 빛 왼위
    @I.floor('hs-floor-sheet', '...', cols=4, rows=4, ...)
    def _(c): ...            # 주기 그림(세계 좌표 그대로)
    R = I.R                  # bake_jp 가 읽는 등록기

3/4 관문(object-gate): `I.export()` 가 tiledata/jp-city/blocks/<블록>/_gate/<id>.png(투명 배경) + items.jsonl(png·kind·name·label) 을 쓴다.
판정 종류(gate)는 정직하게 — 면제 종류(flat·wall_mounted·terrain·organic·debris)는 진짜 그런 물건에만. 바닥·벽면 주기 그림은 terrain.
문(door/sidedoor)은 혼자서는 윗면이 없는 부품이라 조립 방 그림 영수증(gate_rooms.py, kind structure)으로 덮는다.
"""
import json, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
JP = os.path.dirname(HERE)
ROOT = os.path.abspath(os.path.join(JP, '..', '..', '..'))
for p in (HERE, os.path.join(ROOT, 'scripts', 'content', 'modern-campus', 'art')):
    if p not in sys.path: sys.path.insert(0, p)
import numpy as np                                    # noqa: E402
from PIL import Image                                 # noqa: E402
from ikit import Registry, run_block, blit            # noqa: E402
import px                                             # noqa: E402
from px import C, rnd, h32, box3, NT, MI              # noqa: E402,F401

GATE_KINDS = ('tall_furniture', 'low_furniture', 'seat', 'frame', 'container', 'round_body', 'column', 'box', 'structure', 'figure',
              'organic', 'debris', 'flat', 'wall_mounted', 'terrain', 'other', 'part')
OUT_BASE = os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks')


def _paint(fn):
    def draw(cv, *a):
        o = C(cv.w, cv.h); fn(o, *a)
        a2 = o.rgba(); m = a2[..., 3] == 255
        cv.a[m] = a2[m]
    return draw


class Inst:
    def __init__(self, block, name):
        self.block = block
        self.R = Registry(block, name)
        self.gate = {}

    def obj(self, id_, ko, gate, w=1, h=1, up=0, kind='floor', **kw):
        assert gate in GATE_KINDS, (id_, gate)
        def deco(fn):
            self.R.obj(id_, ko, w=w, h=h, up=up, kind=kind, **kw)(_paint(fn))
            self.gate[id_] = 'part' if kind in ('door', 'sidedoor') else gate
            return fn
        return deco

    def hold(self):
        """gate_hold.HOLD 의 조각(3/4 관문 불합격)을 이 블록의 굽기에서 뺀다 — 그림 함수는 남는다."""
        from gate_hold import HOLD
        for i in [i for i in self.R.objs if i in HOLD]:
            self.R.objs.pop(i); self.gate.pop(i, None)

    def floor(self, id_, ko, cols=4, rows=4, **kw):
        def deco(fn):
            self.R.floor(id_, ko, cols=cols, rows=rows, **kw)(_paint(fn)); self.gate[id_] = 'terrain'; return fn
        return deco

    def wall(self, id_, ko, cols=2, **kw):
        def deco(fn):
            self.R.wall(id_, ko, cols=cols, **kw)(_paint(fn)); self.gate[id_] = 'terrain'; return fn
        return deco

    def table(self, id_, ko, **kw):
        def deco(fn):
            def draw(cv, w, h):
                o = C(cv.w, cv.h); fn(o, w, h)
                a2 = o.rgba(); m = a2[..., 3] == 255; cv.a[m] = a2[m]
            self.R.table(id_, ko, **kw)(draw); self.gate[id_] = 'low_furniture'; return fn
        return deco

    def good(self, id_, ko, **kw):
        def deco(fn):
            self.R.good(id_, ko, **kw)(_paint(fn)); return fn
        return deco

    # ── 관문용 그림 ──
    def images(self):
        """{id: (RGBA, gate kind, 한국어)} — 바닥·벽면은 한 주기 그림, 탁자는 3×2 조립."""
        R = self.R; out = {}
        for id_, f in R.floors.items(): out[id_] = (R._canvas(f['draw'], f['cols'] * 16, f['rows'] * 16), 'terrain', f['ko'])
        for id_, wd in R.walls.items(): out[id_] = (R._canvas(wd['draw'], wd['cols'] * 16, 32), 'terrain', wd['ko'])
        for id_, o in R.objs.items(): out[id_] = (R.obj_image(id_)[0], self.gate[id_], o['ko'])
        for id_, td in R.tables.items(): out[id_] = (R._canvas(td['draw'], 48, 32, 3, 2), 'low_furniture', td['ko'])
        return out

    def export(self, only=None):
        """_gate/<id>.png + items.jsonl(문 부품 제외 — 조립 방 영수증이 덮는다). 돌려주는 값 = 실패 목록(ikit selftest)."""
        bad = run_block(self.R, os.path.join(OUT_BASE, self.block))
        gd = os.path.join(OUT_BASE, self.block, '_gate'); os.makedirs(gd, exist_ok=True)
        lines = []
        for id_, (a, kind, ko) in self.images().items():
            if only and id_ not in only: continue
            # 투명 여백을 잘라 낸 그림(영수증 해시는 정규화가 자르지만 판정자 확대 그림을 키우려고)
            ys, xs = np.nonzero(a[..., 3])
            if not len(ys): bad.append('%s 빈 그림' % id_); continue
            p = os.path.join(gd, id_ + '.png'); Image.fromarray(a, 'RGBA').save(p)
            if kind == 'part': continue
            lines.append(dict(png=p, kind=kind, name=ko, label='jp_city/%s/%s' % (self.block, id_)))
        with open(os.path.join(gd, 'items.jsonl' if not only else 'items-only.jsonl'), 'w', encoding='utf-8') as f:
            for m in lines: f.write(json.dumps(m, ensure_ascii=False) + '\n')
        json.dump({k: v[1] for k, v in self.images().items()}, open(os.path.join(gd, 'kinds.json'), 'w'), ensure_ascii=False, indent=0)
        return bad


def main(I, argv):
    only = set(argv[argv.index('--only') + 1:]) if '--only' in argv else None
    bad = I.export(only)
    return 1 if bad else 0


# ═══════════════ 공용 그리기 도우미(campus interior_art 와 같은 결) ═══════════════
def furn(c, x, y, w, h, top, mat, tt=None, ft=None, grain=None, back=True, ol=('sumi', 1)):
    """3/4 상자 가구. (x,y) 왼위, 폭 w, 전체 높이 h, 윗면 top 행. 윗면(밝게, 뒤 가장자리 어둡게·앞 모서리 반사) + 앞면(두 단 어둡게, 왼 빛·오른 그늘) + 윤곽."""
    n = NT[MI[mat]]
    tt = n - 2 if tt is None else tt
    ft = tt - 2 if ft is None else ft
    c.R(x, y, w, top, mat, tt)
    if grain == 'wood':
        for j in range(1, top - 1):
            for i in range(1, w - 1):
                r = rnd(x + i, (y + j) // 2 + (i // 5), 4)
                if r < 0.18: c.P(x + i, y + j, mat, tt - 1)
                elif r > 0.93: c.P(x + i, y + j, mat, tt + 1)
    elif grain == 'steel':
        for j in range(2, top - 1, 2): c.HL(x + 1, y + j, w - 2, mat, tt - 1)
    if back: c.HL(x, y + 1, w, mat, tt + 1)
    c.HL(x, y + top - 1, w, mat, tt + 1)
    c.R(x, y + top, w, h - top, mat, ft)
    c.HL(x, y + top, w, mat, ft - 1)
    c.VL(x + 1, y + top, h - top, mat, ft + 1); c.VL(x + w - 2, y + top, h - top, mat, ft - 1)
    if ol:
        c.HL(x, y, w, *ol); c.HL(x, y + h - 1, w, *ol); c.VL(x, y, h, *ol); c.VL(x + w - 1, y, h, *ol)
    return y + top


def drawer(c, x, y, w, h, mat, t, handle=('tekko', 5)):
    c.R(x, y, w, h, mat, t); c.HL(x, y, w, mat, t + 1); c.HL(x, y + h - 1, w, mat, t - 2); c.VL(x + w - 1, y, h, mat, t - 1)
    hx = x + w // 2 - 1
    c.HL(hx, y + h // 2, 3 if w > 6 else 2, *handle); c.HL(hx, y + h // 2 + 1, 3 if w > 6 else 2, handle[0], handle[1] - 3)


def glass(c, x, y, w, h, t=3, mat='garasu'):
    for j in range(h):
        for i in range(w):
            tt = t + (1 if j < 2 else 0)
            if (i + j) % 7 in (0, 1) and j < h - 1: tt = t + 2
            c.P(x + i, y + j, mat, tt)


def legs(c, x, y, n, mat='tekko', t=3, gap=None):
    """다리 한 쌍(바닥 접지 sumi 점)."""
    c.VL(x, y, n, mat, t); c.P(x, y + n, 'sumi', 1)


def shadow(c, x, y, w, h=1):
    """가구 밑 접지 그늘(sumi 0) — 바닥 위에 깔리는 짧은 띠."""
    c.R(x, y, w, h, 'sumi', 0)


def paper(c, x, y, w=4, h=3, t=4):
    c.R(x, y, w, h, 'shiro', t); c.HL(x, y + h - 1, w, 'shiro', t - 2)
    if w > 3: c.HL(x + 1, y + 1, w - 2, 'conc', 3)


def books(c, x, y, w, h, s=0):
    cols = ('aka', 'sora', 'midori', 'kii', 'kon', 'daidai', 'murasaki', 'shiro', 'lino')
    i = 0; k = 0
    while i < w:
        bw = 2 if h32(k, 1, s) % 3 else 1
        bh = h - (h32(k, 2, s) % 3)
        m = cols[h32(k, 3, s) % len(cols)]
        for q in range(bw):
            if i + q < w:
                c.VL(x + i + q, y + h - bh, bh, m, 3 if q == 0 else 2)
                c.P(x + i + q, y + h - bh, m, 4)
        i += bw; k += 1
        if h32(k, 4, s) % 7 == 0 and i < w: i += 1


def ell_fill(c, cx, cy, rx, ry, mat, t, rim=None):
    def f(x, y, dx, dy, d):
        if rim and d > 0.62: return rim
        return (mat, t)
    c.ell(cx, cy, rx, ry, f)


def wip_sheet(items, path, scale=3, W=720, label=True):
    """[(id, RGBA)] → 눈 확인 시트 PNG(배경 어두운 회색, 칸 격자 없음)."""
    x = y = 6; rowh = 0; place = []
    for id_, a in items:
        h, w = a.shape[:2]
        if x + w + 6 > W: x, y, rowh = 6, y + rowh + 10, 0
        place.append((x, y, a, id_)); x += w + 10; rowh = max(rowh, h)
    sheet = np.zeros((y + rowh + 6, W, 4), np.uint8); sheet[:, :, :3] = (58, 56, 66); sheet[:, :, 3] = 255
    for (x0, y0, a, _) in place: blit(sheet, a, x0, y0)
    im = Image.fromarray(sheet, 'RGBA').resize((W * scale, (y + rowh + 6) * scale), Image.NEAREST)
    im.save(path)
    return [(i, x0 * scale, y0 * scale, a.shape[1] * scale, a.shape[0] * scale) for (x0, y0, a, i) in place]


def box34(c, x, y, w, h, top, tm, tt, fm, ft, edge=('shiro', 4), lid=True, ov=1):
    """3/4 탑뷰 상자(관문 통과형, 2026-10-14): 위에서 본 윗판이 앞면과 «다른 밝기·결»로 읽히게.
    - 윗판은 몸통보다 양옆 ov 칸 넓은 상판(앞으로 내민 판 — 위에서 본 슬래브라는 가장 센 표지). 캔버스 밖이면 줄인다.
    - 뒤 모서리 두 귀를 깎아 둥글린 sumi 윤곽, 뒤 가장자리는 판 색 한 단 아래.
    - 윗판 top 행: tm tt 바탕 + (lid) 안쪽 뚜껑 테.
    - 앞 모서리: edge 밝은 반사 1행 → 바로 밑 앞면 위로 떨어지는 그늘 1행(fm 두 단 아래).
    - 앞면 fm ft: 왼 빛·오른 그늘·바닥 접지. 앞면 첫 행 y+top+1 을 돌려준다."""
    nt = NT[MI[tm]]; nf = NT[MI[fm]]
    ov = max(0, min(ov, x, c.w - (x + w)))
    tx, tw = x - ov, w + 2 * ov
    # 몸통(앞면)
    c.R(x, y + top, w, h - top, fm, ft)
    c.HL(x, y + top, w, fm, max(0, ft - 2))                                           # 판 밑 그늘
    c.VL(x + 1, y + top + 1, h - top - 3, fm, min(nf - 1, ft + 1)); c.VL(x + w - 2, y + top + 1, h - top - 3, fm, max(0, ft - 1))
    c.HL(x, y + h - 2, w, fm, max(0, ft - 1))
    c.HL(x, y + h - 1, w, 'sumi', 0); c.VL(x, y + top, h - top, 'sumi', 1); c.VL(x + w - 1, y + top, h - top, 'sumi', 1)
    # 상판
    c.R(tx, y, tw, top, tm, tt)
    c.HL(tx + 1, y + 1, tw - 2, tm, max(0, tt - 1))
    c.VL(tx + 1, y + 2, top - 3, tm, min(nt - 1, tt + 1))
    if lid and tw >= 8 and top >= 6:
        c.HL(tx + 3, y + 3, tw - 6, tm, max(0, tt - 1)); c.VL(tx + 3, y + 3, top - 5, tm, max(0, tt - 1))
        c.HL(tx + 3, y + top - 3, tw - 6, tm, min(nt - 1, tt + 1)); c.VL(tx + tw - 4, y + 3, top - 5, tm, min(nt - 1, tt + 1))
    c.HL(tx + 1, y + top - 1, tw - 2, *edge)                                          # 앞 모서리 반사
    c.HL(tx + 1, y, tw - 2, 'sumi', 1); c.VL(tx, y + 1, top, 'sumi', 1); c.VL(tx + tw - 1, y + 1, top, 'sumi', 1)
    if ov: c.HL(tx, y + top, ov, 'sumi', 1); c.HL(x + w, y + top, ov, 'sumi', 1)     # 내민 판 밑면
    c.P(tx, y, None, 0); c.P(tx + tw - 1, y, None, 0)                                 # 뒤 귀 둥글림
    return y + top + 1


def slab34(c, x, y, w, n, mat, t, edge=('shiro', 4), under=('yoru', 1)):
    """위에서 본 상판만(box34 의 윗판 부분): 뒤 귀 둥글린 윤곽, 뒤 가장자리 한 단 아래, 왼 빛, 앞 모서리 반사, 판 밑 그늘 1행(y+n).
    몸통은 호출자가 그 아래(보통 양옆 1칸 안쪽)에 그린다."""
    nt = NT[MI[mat]]
    c.R(x, y, w, n, mat, t)
    c.HL(x + 1, y + 1, w - 2, mat, max(0, t - 1))
    c.VL(x + 1, y + 2, n - 3, mat, min(nt - 1, t + 1))
    c.HL(x + 1, y + n - 1, w - 2, *edge)
    c.HL(x + 1, y, w - 2, 'sumi', 1); c.VL(x, y + 1, n, 'sumi', 1); c.VL(x + w - 1, y + 1, n, 'sumi', 1)
    c.HL(x + 1, y + n, w - 2, *under)
    c.P(x, y, None, 0); c.P(x + w - 1, y, None, 0)
    return y + n + 1
