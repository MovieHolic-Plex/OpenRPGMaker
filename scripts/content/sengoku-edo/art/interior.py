#!/usr/bin/env python3
"""sengoku_edo 실내 — 다다미 방·장지/후스마·이로리·다실·성 알현실·여관 방·가게 안. id 머리 `se-`.

틀은 jp_city 실내 틀(`jp-city/interior/ikit.py` Registry)을 **읽기만** 한다(조립 규칙: 평면 '#' 막힘, 그 밑 두 줄 벽면, 천장 띠).
그림은 이 파일의 px.C(잠긴 sengoku 팔레트)로 그리고 RGBA 로 옮긴다. 3/4: 윗면 5행 이상(밝게, 뒤 가장자리 어두운 선) + 앞면 + sumi 윤곽.
gate = object-gate 종류(관문 판정용).

  python3 interior.py      # tiledata/sengoku-edo/interior/_gate/*.png + items.jsonl + preview
"""
import json, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'content', 'jp-city', 'interior'))
import numpy as np                                                         # noqa: E402
from PIL import Image                                                      # noqa: E402
from px import C, rnd, h32, NT, MI, RGB, save                              # noqa: E402
from arch import clamp, shoji, _tile_px                                    # noqa: E402
from props import cap, disc                                                # noqa: E402
from ikit import Registry                                                  # noqa: E402
from kit import contact                                                    # noqa: E402

OUT = os.path.join(ROOT, 'tiledata', 'sengoku-edo', 'interior')
R = Registry('interior_sengoku', '전국·에도 실내')
ART = {}
GATE = {}
CAT = {}          # id -> (분류 키, 한국어)


def paint(fn):
    def g(c, *a):
        o = C(c.w, c.h); fn(o, *a)
        a2 = o.rgba(); m = a2[..., 3] == 255
        c.a[m] = a2[m]
    return g


def obj(id_, ko, w=1, h=1, up=0, kind='floor', gate='low_furniture', cat=('wa', '방'), **kw):
    def deco(fn):
        ART[id_] = fn; GATE[id_] = gate; CAT[id_] = cat
        R.obj(id_, ko, w=w, h=h, up=up, kind=kind, **kw)(paint(fn))
        return fn
    return deco


def floor(id_, ko, cols, rows, **kw):
    def deco(fn):
        ART[id_] = fn
        R.floor(id_, ko, cols=cols, rows=rows, **kw)(paint(fn))
        return fn
    return deco


def wall(id_, ko, cols, **kw):
    def deco(fn):
        ART[id_] = fn
        R.wall(id_, ko, cols=cols, **kw)(paint(fn))
        return fn
    return deco


# ═══════════════ 도우미 ═══════════════
def furn(c, x, y, w, h, top, mat, tt=None, grain=False):
    """상자 가구: (x,y) 왼위, 폭 w, 높이 h, 윗면 top 행(밝게·뒤 어두운 선·앞 모서리 반사) + 앞면(왼 빛·오른 그늘) + sumi 윤곽."""
    n = NT[MI[mat]]
    tt = n - 2 if tt is None else tt
    ft = max(1, tt - 2)
    c.R(x, y, w, top, mat, tt)
    if grain:
        for j in range(1, top - 1):
            for i in range(1, w - 1):
                r = rnd(x + i, (y + j) // 2 + i // 5, 4)
                if r < 0.16: c.P(x + i, y + j, mat, tt - 1)
    c.HL(x, y + 1, w, mat, tt - 2)
    c.HL(x, y + top - 1, w, mat, min(n - 1, tt + 1))
    c.R(x, y + top, w, h - top, mat, ft)
    c.HL(x, y + top, w, mat, ft - 1)
    c.VL(x + 1, y + top, h - top, mat, min(n - 1, ft + 1)); c.VL(x + w - 2, y + top, h - top, mat, ft - 1)
    c.HL(x, y, w, 'sumi', 1); c.HL(x, y + h - 1, w, 'sumi', 1); c.VL(x, y, h, 'sumi', 1); c.VL(x + w - 1, y, h, 'sumi', 1)
    return y + top


def drawer(c, x, y, w, h, mat='ki', t=3):
    c.R(x, y, w, h, mat, t); c.HL(x, y, w, mat, t + 1); c.HL(x, y + h - 1, w, mat, t - 2)
    c.R(x + w // 2 - 1, y + h // 2 - 1, 3, 2, 'kuro', 1); c.P(x + w // 2, y + h // 2 - 1, 'kin', 3)


def outline(c):
    m0 = c.m.copy()
    for y in range(c.h):
        for x in range(c.w):
            if m0[y, x] < 0: continue
            if any(not (0 <= a < c.w and 0 <= b < c.h) or m0[b, a] < 0 for a, b in ((x, y - 1), (x, y + 1), (x - 1, y), (x + 1, y))):
                c.P(x, y, 'sumi', 1)


def top_plane(c, x, y, w, top, mat, inset=2, tt=None, grain=5):
    """위에서 내려다본 윗면: 뒤 가장자리가 양쪽 inset px 좁은 사다리꼴(원근), 결은 깊이 방향(세로) 줄, 뒤 어두운 선·앞 밝은 모서리."""
    n = NT[MI[mat]]
    tt = n - 1 if tt is None else tt
    for j in range(top):
        k = (top - 1 - j) / max(1, top - 1)
        d = int(round(inset * k))
        for i in range(d, w - d):
            t = tt if i < w * 0.6 else tt - 1
            if grain and (i - d) % grain == grain - 1 and 0 < j < top - 1: t -= 1
            if j == 0: t = tt - 3
            if j == top - 1: t = tt
            c.P(x + i, y + j, mat, clamp(mat, t))
        c.P(x + d - 1, y + j, 'sumi', 1); c.P(x + w - d, y + j, 'sumi', 1)
    c.HL(x + inset, y - 1, w - 2 * inset, 'sumi', 1)
    return y + top


def shelf_case(c, x, y, w, h, top, rows, mat='ki'):
    """키 큰 선반: 원근 윗면 top 행 + 앞 테(어둡게) + 칸마다 선반 판 윗면 2행(밝게) + 칸 안 그늘. 돌려주는 값: 칸마다 (바닥 y, 높이)."""
    y1 = top_plane(c, x, y, w, top, mat)
    c.HL(x, y1, w, mat, 2); c.HL(x, y1 + 1, w, mat, 3)
    c.R(x, y1 + 2, w, h - top - 2, mat, 3)
    c.VL(x + 1, y1 + 2, h - top - 2, mat, 4); c.VL(x + w - 2, y1 + 2, h - top - 2, mat, 2)
    inner_y = y1 + 2; inner_h = h - top - 4
    ch = inner_h // rows
    out = []
    for r in range(rows):
        cy = inner_y + r * ch
        c.R(x + 3, cy, w - 6, ch - 3, mat, 1)                  # 칸 안 그늘
        c.HL(x + 3, cy, w - 6, mat, 0)
        c.HL(x + 3, cy + ch - 3, w - 6, mat, 5); c.HL(x + 3, cy + ch - 2, w - 6, mat, 6)   # 선반 판 윗면 2행
        c.HL(x + 3, cy + ch - 1, w - 6, mat, 2)
        out.append((cy + ch - 3, ch - 3))
    c.VL(x - 1, y, h, 'sumi', 1); c.VL(x + w, y, h, 'sumi', 1); c.HL(x, y + h, w, 'sumi', 1)
    return out


def goods_box(c, x, floor_y, w, h, m, t):
    """선반 위 상자·피륙: 윗면 2행(밝게) + 앞면."""
    y0 = floor_y - h
    c.R(x, y0, w, 2, m, clamp(m, t + 2)); c.R(x, y0 + 2, w, h - 2, m, t); c.VL(x + w - 1, y0 + 2, h - 2, m, clamp(m, t - 1))
    c.HL(x, y0 - 1, w, 'sumi', 1)


# ═══════════════ 바닥 ═══════════════
def tatami(c, heri='kuro', heri_t=1, gold=False):
    """다다미 4×4 칸 주기: 2×2 칸 덩이마다 가로 두 장 / 세로 두 장 번갈아. 한 장 = 16×32 또는 32×16.
    겉: 가로 짜임 결(한 줄 밝게·한 줄 중간), 긴 변은 헤리(천 테) 2px, 짧은 변은 어두운 1px."""
    for by in range(2):
        for bx in range(2):
            horiz = (bx + by) % 2 == 0
            for k in range(2):
                if horiz: x0, y0, w, h = bx * 32, by * 32 + k * 16, 32, 16
                else: x0, y0, w, h = bx * 32 + k * 16, by * 32, 16, 32
                for j in range(h):
                    for i in range(w):
                        if horiz:
                            long_edge = j in (0, h - 1); short = i in (0, w - 1); grain = (i // 1) % 2
                        else:
                            long_edge = i in (0, w - 1); short = j in (0, h - 1); grain = j % 2
                        if long_edge:
                            if gold: c.P(x0 + i, y0 + j, 'kin', 2 if (j if horiz else i) else 3)
                            else: c.P(x0 + i, y0 + j, heri, heri_t + (1 if (j == 0 if horiz else i == 0) else 0))
                            continue
                        if short: c.P(x0 + i, y0 + j, 'tatami', 1); continue
                        t = 4 if grain else 3
                        if rnd(x0 + i, y0 + j, 7) < 0.04: t -= 1
                        c.P(x0 + i, y0 + j, 'tatami', t)


@floor('se-floor-tatami', '다다미(검은 테)', 4, 4, tags=('다다미', '방', '여관', '민가'),
       desc='다다미 — 2×2 칸마다 가로·세로 두 장을 번갈아 깐 연두빛 돗자리, 긴 변에 검은 천 테. 방·여관·다실 바닥.')
def _(c): tatami(c)


@floor('se-floor-tatami-gold', '다다미(금빛 테, 성 알현실)', 4, 4, tags=('다다미', '성', '알현실', '무가'),
       desc='금빛 무늬 천 테를 두른 다다미 — 성 알현실·무가 큰방.')
def _(c): tatami(c, gold=True)


@floor('se-floor-wood', '나무 마루(윤 나는 판자)', 4, 1, tags=('마루', '도장', '복도', '가게'), lay='rowShift',
       desc='가로로 긴 판자 마루 — 4px 판 줄, 줄마다 이음 자리가 다르다. 도장·복도·가게 마루.')
def _(c):
    for y in range(16):
        for x in range(64):
            row = y // 4; ly = y % 4
            seam = (x + h32(row, 0, 5) % 64) % 32 == 0
            if ly == 3: c.P(x, y, 'ki', 2); continue
            t = 5 if ly == 0 else 4
            if seam: t = 2
            elif rnd(x // 3, y, 9) < 0.07: t -= 1
            c.P(x, y, 'ki', t)


@floor('se-floor-doma', '흙바닥(도마, 다진 흙)', 2, 2, tags=('흙바닥', '부엌', '가게', '대장간', '농가'),
       desc='다진 흙바닥 — 부엌·가게 앞칸·대장간·농가 들머리.')
def _(c):
    for y in range(32):
        for x in range(32):
            t = 3
            r = rnd(x, y, 11)
            if r < 0.1: t = 2
            elif r > 0.92: t = 4
            if rnd(x // 3, y // 3, 13) < 0.15: t = 2
            c.P(x, y, 'michi', t)


# ═══════════════ 벽면(2줄 32px) ═══════════════
def nageshi(c, w):
    """위 인방(나게시): 0~4행 짙은 나무 + 밑 그늘."""
    for x in range(w):
        c.P(x, 0, 'ki', 2); c.P(x, 1, 'ki', 4); c.P(x, 2, 'ki', 3); c.P(x, 3, 'ki', 2); c.P(x, 4, 'ki', 1)


def pillar(c, x, h=32, mat='ki'):
    for j in range(h):
        c.P(x, j, mat, 5); c.P(x + 1, j, mat, 4); c.P(x + 2, j, mat, 2)


@wall('se-wall-shoji', '장지 벽(밝은 종이 칸 + 나무 기둥)', 2, tags=('장지', '방', '여관', '다실'),
      desc='위 인방 아래 흰 종이 장지가 늘어선 벽 — 32px 마다 나무 기둥, 아래 판자 허리. 방·여관 남향 벽.')
def _(c):
    nageshi(c, 32)
    for x0 in (0, 16): shoji(c, x0, 5, 16, 27, lit=True)
    pillar(c, 0)


@wall('se-wall-fusuma', '후스마 벽(소나무 그림 미닫이 + 둥근 손잡이)', 2, tags=('후스마', '방', '무가', '여관'),
      desc='연한 종이에 먹빛 산과 소나무를 그린 미닫이 두 짝 — 짙은 테, 둥근 손잡이. 방 사이 벽.')
def _(c):
    nageshi(c, 32)
    fusuma(c, False)


@wall('se-wall-fusuma-gold', '금박 후스마 벽(성 알현실, 금 바탕 소나무)', 2, tags=('후스마', '성', '알현실', '금박'),
      desc='금박 바탕에 큰 소나무 가지를 그린 미닫이 — 성 알현실·영주 방 북벽.')
def _(c):
    nageshi(c, 32)
    fusuma(c, True)


def fusuma(c, gold):
    bg = 'kin' if gold else 'washi'
    for x in range(32):
        for y in range(5, 30):
            t = (3 if gold else 3) - (1 if y > 26 else 0)
            if gold and (x // 4 + y // 4) % 2 == 0 and y < 27: t = 4 if (x + y) % 3 else 3
            c.P(x, y, bg, t)
    # 먼 산(연한 먹빛) + 소나무 가지(짙은 초록 덩이)
    if not gold:
        for x in range(32):
            top = 16 + int(round(4 * math.sin(x / 5.0)))
            for y in range(top, 23): c.P(x, y, 'shikkui', 2 if y > top else 1)
    for cx, cy, rx, ry in ((9, 12, 6, 2.5), (22, 9, 7, 3), (27, 17, 5, 2)):
        c.ell(cx, cy, rx, ry, lambda X, Y, dx, dy, d: ('matsu', 4 if dy < -0.3 else 3 if d < 0.7 else 2))
    c.line(4, 26, 12, 14, 'ki', 2); c.line(12, 14, 22, 10, 'ki', 2)
    for x0 in (0, 16):
        c.VL(x0, 5, 25, 'kuro', 2); c.VL(x0 + 1, 5, 25, 'kuro', 4); c.VL(x0 + 15, 5, 25, 'kuro', 1)
        c.HL(x0, 5, 16, 'kuro', 3); c.HL(x0, 29, 16, 'kuro', 1)
        hx = x0 + (12 if x0 == 0 else 3)
        c.R(hx, 16, 2, 3, 'kuro', 0); c.P(hx, 16, 'kin', 3)
    c.HL(0, 30, 32, 'ki', 3); c.HL(0, 31, 32, 'ki', 1)


@wall('se-wall-plaster', '흙벽(신카베, 황토 회벽 + 기둥 + 인방)', 2, tags=('흙벽', '방', '다실', '농가', '부엌'),
      desc='황토빛 흙 회벽 — 기둥이 드러나고 허리에 가는 띠. 다실·농가·부엌 벽.')
def _(c):
    nageshi(c, 32)
    for x in range(32):
        for y in range(5, 32):
            t = 4 if rnd(x, y, 3) > 0.06 else 3
            if y >= 29: t = 2
            c.P(x, y, 'tsuchi', t)
    c.HL(0, 20, 32, 'ki', 3); c.HL(0, 21, 32, 'ki', 1)
    pillar(c, 0)


@wall('se-wall-board', '판자벽(도장·가게, 가로 판 + 누름대)', 2, tags=('판자벽', '도장', '가게', '대장간'),
      desc='짙은 나무 가로 판자 벽 — 4px 판, 16px 마다 세로 누름대. 도장·가게·대장간 벽.')
def _(c):
    nageshi(c, 32)
    for x in range(32):
        for y in range(5, 32):
            k = y % 4
            t = 4 if k == 1 else 3 if k == 2 else 2 if k == 3 else 3
            if x % 16 in (7, 8): t = 4 if x % 16 == 7 else 1
            c.P(x, y, 'ki', t)


@R.ceiling('se-ceil', '격자 천장 띠(짙은 나무)')
def _(c, bits):
    S, N, Wb, E, NV = bits & 1, bits & 2, bits & 4, bits & 8, bits & 16
    o = C(16, 16)
    for y in range(16):
        for x in range(16):
            t = 1 if (x % 8 == 0 or y % 8 == 0) else 2
            m = ('kuro', t)
            if S and y >= 12: m = (('ki', 4), ('ki', 3), ('ki', 2), ('sumi', 0))[y - 12]
            if N and y <= 1: m = (('sumi', 0), ('ki', 2))[y]
            if Wb and x <= 2: m = (('sumi', 0), ('ki', 3), ('ki', 2))[x]
            if E and x >= 13: m = (('ki', 2), ('ki', 1), ('sumi', 0))[x - 13]
            if NV and y == 0: m = ('sumi', 0)
            o.P(x, y, *m)
    a = o.rgba(); c.a[:] = a


# ═══════════════ 가구 — 방·민가 ═══════════════
@obj('se-irori', '이로리(바닥 화로, 숯불 + 걸린 무쇠 주전자)', w=2, h=2, up=12, kind='floor', gate='container', cat=('wa', '방·민가'),
     use=('light', 'sit'), tags=('이로리', '화로', '민가', '농가'), place='방·농가 큰방 가운데. 네 둘레 1칸에 방석(se-zabuton).',
     desc='마루에 파인 네모 화로 — 짙은 나무 테(윗면 밝게), 안은 재와 숯불, 위에서 내려온 갈고리에 무쇠 주전자.')
def _(c):
    y0 = 12
    furn(c, 1, y0 + 6, 30, 26, 5, 'ki', 5)
    c.R(5, y0 + 11, 22, 14, 'shikkui', 1); c.R(6, y0 + 12, 20, 12, 'suna', 2)
    for k in range(8):
        x = 9 + h32(k, 0, 4) % 14; y = y0 + 15 + h32(k, 1, 4) % 6
        c.P(x, y, 'hi', 2 + k % 2); c.P(x + 1, y, 'hi', 1)
    c.R(12, y0 + 15, 8, 4, 'kuro', 1)
    # 자재 갈고리 + 주전자
    c.VL(16, 0, y0 + 6, 'kuro', 3); c.VL(15, 0, y0 + 6, 'kuro', 1)
    c.ell(16, y0 + 10, 5, 4, lambda X, Y, dx, dy, d: ('kuro', 3 if dx < -0.2 and dy < 0 else 2 if d < 0.7 else 1))
    c.R(11, y0 + 6, 10, 2, 'kuro', 3)


@obj('se-zabuton', '방석(자부톤, 쪽빛)', w=1, h=1, kind='flat', gate='flat', cat=('wa', '방·민가'), use=('sit',),
     tags=('방석', '방', '여관', '다실'), place='낮은 상·이로리 둘레·다다미 위.', desc='납작한 네모 방석 — 쪽빛 천, 가운데 술 장식. 밟고 앉는다.')
def _(c):
    for y in range(3, 14):
        for x in range(2, 14):
            t = 4 if y < 5 or x < 4 else 3
            if y > 11 or x > 11: t = 2
            c.P(x, y, 'ai', t)
    c.P(7, 8, 'kin', 3); c.P(8, 8, 'kin', 2)
    c.HL(2, 14, 12, 'ai', 0)


@obj('se-chabudai', '둥근 밥상(차부다이)', w=1, h=1, up=4, gate='low_furniture', cat=('wa', '방·민가'), use=('sit',),
     tags=('상', '밥상', '방', '민가'), place='방 가운데, 방석 둘레.', desc='낮은 둥근 나무 상 — 위에서 보이는 둥근 판(밝게), 앞 테두리, 짧은 다리.')
def _(c):
    c.ell(8, 9, 7.5, 5, lambda X, Y, dx, dy, d: ('ki', 6 if dx < -0.3 and dy < 0 else 5 if d < 0.75 else 4))
    for x in range(1, 15):
        c.P(x, 13, 'ki', 2); c.P(x, 14, 'ki', 1)
    c.R(3, 15, 2, 4, 'ki', 2); c.R(11, 15, 2, 4, 'ki', 1)
    c.ell(6, 8, 1.5, 1, lambda *a: ('shikkui', 5)); c.ell(10, 9, 1.5, 1, lambda *a: ('shikkui', 4))
    outline(c)


@obj('se-zataku', '긴 좌탁(검은 옻칠)', w=2, h=1, up=4, gate='low_furniture', cat=('wa', '방·민가'), use=('sit',),
     tags=('상', '좌탁', '방', '여관', '무가'), place='방·여관 손님방 가운데. 양옆 방석.', desc='검게 옻칠한 낮은 긴 상 — 윤 나는 윗면, 짧은 다리.')
def _(c):
    furn(c, 1, 4, 30, 12, 7, 'kuro', 4)
    c.HL(3, 6, 10, 'kuro', 5)
    c.R(4, 16, 3, 4, 'kuro', 1); c.R(25, 16, 3, 4, 'kuro', 1)


@obj('se-tansu', '장롱(탄스, 서랍 + 쇠 장식)', w=2, h=1, up=16, kind='wall', gate='tall_furniture', cat=('wa', '방·민가'), use=('search',),
     tags=('장롱', '서랍', '방', '무가', '가게'), place='방 북쪽 벽 앞.', desc='느티나무 서랍장 — 윗면 판, 서랍 여섯, 검은 쇠 손잡이 장식.')
def _(c):
    y = furn(c, 1, 2, 30, 30, 6, 'ki', 5, grain=True)
    for row in range(3):
        for col in range(2):
            drawer(c, 3 + col * 13, y + 1 + row * 8, 12, 7, 'ki', 4)


@obj('se-futon', '깔아 둔 이불(후톤)', w=1, h=2, kind='floor', gate='flat', cat=('wa', '방·민가'), use=('sleep',),
     tags=('이불', '침구', '방', '여관'), place='방 다다미 위, 벽에서 1칸 띄워.', desc='다다미에 편 이불 — 흰 요 위 쪽빛 꽃무늬 덮이불, 베개.',
     walk=((0, 0), (0, 1)))
def _(c):
    for y in range(2, 30):
        for x in range(1, 15):
            c.P(x, y, 'shikkui', 5 if x < 3 else 4)
    c.R(3, 3, 10, 5, 'shikkui', 5); c.HL(3, 7, 10, 'shikkui', 2)
    for y in range(10, 29):
        for x in range(2, 14):
            t = 3 if (x + y) % 6 else 4
            if y == 10: t = 4
            c.P(x, y, 'ai', t)
    for k in range(5): c.P(4 + (k * 3) % 9, 13 + k * 3, 'sakura', 4)
    outline(c)


@obj('se-futon-stack', '갠 이불 더미', w=1, h=1, up=6, kind='wall', gate='box', cat=('wa', '방·민가'),
     tags=('이불', '방', '여관'), place='방 구석 벽 앞.', desc='개어 쌓은 이불 세 채 — 쪽빛·흰·감물빛 층, 윗면 밝게.')
def _(c):
    for k, (m, t) in enumerate((('kaki', 3), ('shikkui', 4), ('ai', 3))):
        y = 12 - k * 4
        c.R(1, y + 2, 14, 4, m, t); c.VL(1, y + 2, 4, m, t + 1); c.HL(1, y + 5, 14, m, t - 1)
        c.VL(0, y + 2, 4, 'sumi', 1); c.VL(15, y + 2, 4, 'sumi', 1)
    cap(c, 8, 1, 13, 14, 6, 0, 'ai', 4)                # 맨 위 이불: 위에서 본 윗면 6행
    c.HL(3, 3, 10, 'ai', 3); c.P(5, 4, 'sakura', 4); c.P(10, 5, 'sakura', 4)
    c.HL(1, 16, 14, 'sumi', 1)



@obj('se-andon', '안돈(종이 등잔)', w=1, h=1, up=12, gate='column', cat=('wa', '방·민가'), use=('light',),
     tags=('등잔', '안돈', '방', '여관'), place='방 구석·이불 머리맡.', desc='나무 틀에 종이를 바른 네모 등잔 — 안에서 불빛, 윗면 틀, 받침.')
def _(c):
    # 위에서 내려다본 열린 네모 틀(윗면 5행, 안쪽으로 불빛이 보인다)
    c.R(3, 2, 10, 6, 'ki', 5); c.HL(3, 2, 10, 'ki', 2); c.HL(3, 7, 10, 'ki', 6)
    c.R(5, 3, 6, 3, 'hi', 3); c.R(6, 4, 3, 1, 'hi', 2)
    c.VL(2, 2, 6, 'sumi', 1); c.VL(13, 2, 6, 'sumi', 1); c.HL(3, 1, 10, 'sumi', 1)
    c.R(3, 8, 10, 13, 'washi', 3); c.R(4, 9, 5, 11, 'hi', 3); c.R(9, 9, 3, 11, 'washi', 2)
    c.VL(3, 8, 13, 'ki', 3); c.VL(12, 8, 13, 'ki', 1); c.HL(3, 14, 10, 'ki', 3)
    c.VL(2, 8, 13, 'sumi', 1); c.VL(13, 8, 13, 'sumi', 1)
    cap(c, 8, 21, 11, 12, 3, 3, 'ki', 6)



@obj('se-byobu', '병풍(여섯 폭, 금 바탕 구름)', w=2, h=1, up=16, gate='tall_furniture', cat=('wa', '방·민가'),
     tags=('병풍', '방', '성', '무가'), place='방 북쪽·알현실 단 뒤.', desc='지그재그로 선 여섯 폭 병풍 — 금 바탕에 흰 구름 띠, 검은 테.')
def _(c):
    # 위에서 내려다본 지그재그 병풍: 윗테가 평면에서 W 꼴(앞뒤로 접힘)로 보이고, 테 윗면 3행이 밝다. 앞으로 나온 폭은 더 아래에 선다.
    for k in range(6):
        x0 = 1 + k * 5
        off = 0 if k % 2 == 0 else 4
        y0 = 3 + off
        for j in range(3):
            for i in range(5):
                lift = (i if k % 2 == 0 else 4 - i) if False else 0
                c.P(x0 + i, y0 + j, 'kuro', 5 if j < 2 else 3)
        c.HL(x0, y0 - 1, 5, 'sumi', 1)
        for y in range(y0 + 3, 27 + off):
            for i in range(5):
                t = 4 if k % 2 == 0 else 3
                if y0 + 8 < y < y0 + 12: t = 2 if k % 2 else 3
                c.P(x0 + i, y, 'kin', t)
        c.R(x0 + 1, y0 + 9, 3, 2, 'shikkui', 5)
        c.VL(x0, y0, 27 + off - y0, 'kuro', 2)
        c.HL(x0, 27 + off, 5, 'kuro', 1)
        # 접힌 모서리 사이 바닥 그림자(앞뒤 깊이)
        if k % 2 == 1: c.R(x0, y0 - 4, 5, 3, 'tatami', 2)
    outline(c)



@obj('se-tokonoma', '도코노마(족자 + 꽃병 단)', w=2, h=1, up=24, kind='wall', gate='tall_furniture', cat=('wa', '방·민가'), use=('read',),
     tags=('도코노마', '방', '무가', '다실', '여관'), place='큰방 북쪽 벽 앞 가운데·다실.', desc='한 단 높인 마루 단 — 위에 산수화 족자(글자 없음)가 걸리고 꽃병 하나.')
def _(c):
    c.R(1, 0, 30, 30, 'tsuchi', 4); c.VL(1, 0, 30, 'ki', 4); c.VL(30, 0, 30, 'ki', 2)
    # 족자(뒷벽)
    c.R(10, 1, 12, 16, 'washi', 3); c.HL(10, 1, 12, 'ki', 2); c.HL(10, 16, 12, 'ki', 2)
    for x in range(11, 21):
        top = 8 + int(round(3 * math.sin(x / 1.6)))
        for y in range(top, 14): c.P(x, y, 'shikkui', 1 if y == top else 2)
    # 도코노마 단: 위에서 본 마루 윗면 10행(뒤 그늘 → 앞 밝게) + 검은 옻칠 턱 3행
    for y in range(19, 29):
        for x in range(2, 30):
            t = 4 if y == 19 else 6 if y > 26 else 5
            if (x + y * 3) % 17 == 0: t -= 1
            c.P(x, y, 'ki', t)
    c.HL(2, 29, 28, 'kuro', 4); c.HL(2, 30, 28, 'kuro', 3); c.HL(2, 31, 28, 'kuro', 1)
    # 꽃병(단 위)
    c.R(23, 19, 4, 6, 'dou', 3); c.VL(23, 19, 6, 'dou', 4); c.ell(25, 19, 2, 1, lambda *a: ('dou', 5))
    c.P(24, 16, 'momiji', 4); c.P(25, 15, 'momiji', 3); c.P(23, 17, 'kusa', 4); c.P(26, 17, 'kusa', 3)
    c.R(6, 22, 6, 3, 'kuro', 3); c.HL(6, 22, 6, 'kuro', 5)  # 향 받침
    outline(c)



@obj('se-scroll', '족자(산수화, 글자 없음)', w=1, kind='hang', hrows=2, gate='wall_mounted', cat=('wa', '방·민가'),
     tags=('족자', '방', '다실'), place='벽면 윗줄.', desc='세로로 긴 족자 — 흰 종이에 먹빛 산과 물, 위아래 나무 축.')
def _(c):
    c.R(3, 4, 10, 24, 'washi', 3); c.HL(2, 4, 12, 'ki', 2); c.HL(2, 27, 12, 'ki', 2)
    for x in range(4, 12):
        top = 14 + int(round(3 * math.sin(x / 1.3)))
        for y in range(top, 21): c.P(x, y, 'shikkui', 1 if y == top else 2)
    c.HL(4, 23, 8, 'mizu', 4); c.VL(7, 1, 3, 'kuro', 2)


@obj('se-kamidana', '가미다나(집 신단, 선반 + 작은 사당)', w=2, kind='hang', hrows=2, gate='wall_mounted', cat=('wa', '방·민가'),
     tags=('신단', '가미다나', '방', '가게', '도장'), place='벽면 윗줄(북벽 높이).', desc='벽 높이 단 선반 위 작은 나무 사당과 비쭈기 나무 화병 둘, 금줄.')
def _(c):
    c.R(1, 1, 30, 18, 'ki', 2); c.HL(1, 1, 30, 'ki', 3); c.VL(1, 1, 18, 'ki', 3)        # 벽에 댄 뒤판
    for x in (5, 25):                                                                   # 까치발
        c.R(x, 23, 2, 5, 'ki', 3); c.line(x + 1, 27, x + (4 if x < 16 else -3), 23, 'ki', 3)
    y1 = top_plane(c, 1, 16, 30, 5, 'ki', inset=2)                                      # 선반: 원근 윗면 5행
    c.HL(1, y1, 30, 'ki', 3); c.HL(1, y1 + 1, 30, 'ki', 2); c.HL(1, y1 + 2, 30, 'sumi', 1)
    c.R(11, 8, 10, 10, 'ki', 4); c.R(14, 11, 4, 7, 'ki', 2); c.VL(10, 8, 10, 'sumi', 1); c.VL(21, 8, 10, 'sumi', 1)
    cap(c, 16, 3, 8, 14, 4, 1, 'kawara')                                               # 사당 지붕 윗면
    for x in (5, 25): disc(c, x + 0.5, 15, 1.8, 1, 3, 'shikkui', 5, inner=('matsu', 4))  # 비쭈기 화병(둥근 입)
    for i in range(3, 29): c.P(i, 25, 'kaya', 4)



@obj('se-hibachi', '히바치(둥근 도자기 화로)', w=1, h=1, up=6, gate='container', cat=('wa', '방·민가'), use=('light',),
     tags=('화로', '방', '여관'), place='방석 옆.', desc='둥근 도자기 화로 — 위에서 보이는 재와 숯불, 쪽빛 무늬 몸통.')
def _(c):
    for y in range(9, 21):
        hw = 6 if y < 18 else 5
        for x in range(8 - hw, 8 + hw):
            c.P(x, y, 'shikkui', 4 if x < 6 else 3)
            if y == 15 and x % 3 == 0: c.P(x, y, 'ai', 3)
    # 아가리: 위에서 본 둥근 테 + 재·숯불(7행)
    c.ell(8, 8, 6.5, 3.6, lambda X, Y, dx, dy, d: ('shikkui', 5) if d > 0.65 else ('suna', 2 if dy < 0 else 3))
    c.P(7, 8, 'hi', 3); c.P(9, 9, 'hi', 2); c.P(6, 9, 'kuro', 1)
    outline(c)



@obj('se-tea-kettle', '차 가마(풍로 위 무쇠 솥)', w=1, h=1, up=8, gate='round_body', cat=('cha', '다실'),
     tags=('다도', '다실', '차'), place='다실 다다미 한쪽(손님 자리 앞).', desc='화로(풍로) 위 둥근 무쇠 차솥 — 뚜껑 윗면, 김.')
def _(c):
    disc(c, 8, 18, 6, 2.4, 6, 'tsuchi', 4, inner=('kuro', 1))     # 풍로: 둥근 윗면 + 옆 띠
    c.R(6, 22, 4, 2, 'hi', 2)
    disc(c, 8, 9, 5.5, 3, 6, 'kuro', 5)                         # 무쇠 솥: 위에서 본 둥근 뚜껑 + 몸통 띠
    c.ell(8, 9, 1.6, 1, lambda *a: ('kin', 3))
    c.P(8, 2, 'washi', 2); c.P(9, 1, 'washi', 1)



@obj('se-tea-set', '다도 도구(검은 쟁반 + 찻사발·물병)', w=1, h=1, kind='floor', gate='low_furniture', cat=('cha', '다실'),
     tags=('다도', '다실', '차'), place='차 가마 옆.', desc='검은 옻칠 쟁반 위 찻사발·차통·물병.')
def _(c):
    furn(c, 1, 3, 14, 11, 8, 'kuro', 4)
    c.ell(5, 6, 2.4, 1.8, lambda *a: ('tsuchi', 4)); c.P(5, 6, 'kusa', 5)
    c.R(9, 4, 3, 4, 'kuro', 2); c.HL(9, 4, 3, 'kuro', 5); c.R(12, 6, 2, 3, 'dou', 4)



# ═══════════════ 무가·성 ═══════════════
@obj('se-dais', '상단(영주 자리, 한 단 높인 다다미 단)', w=3, h=2, up=4, gate='low_furniture', cat=('castle', '성·무가'), use=('sit',),
     tags=('알현실', '성', '영주', '무가'), place='알현실 북쪽 가운데(병풍 앞). 앞 2줄은 비워 신하 자리.',
     desc='한 단 높인 금빛 테 다다미 단 — 윗면 다다미 결, 앞면 검은 옻칠 턱. 위에 영주 방석과 팔걸이.', walk=((0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (2, 1)))
def _(c):
    y0 = 4
    for y in range(y0 + 1, y0 + 26):
        for x in range(1, 47):
            t = 4 if y % 2 else 3
            if y in (y0 + 1, y0 + 2): t = 2
            c.P(x, y, 'tatami', t)
    for x in range(1, 47): c.P(x, y0 + 1, 'kin', 3); c.P(x, y0 + 25, 'kin', 4)
    for y in range(y0 + 26, y0 + 32): c.HL(1, y, 46, 'kuro', 4 if y == y0 + 26 else 2)
    c.HL(1, y0 + 31, 46, 'kuro', 1)
    c.R(19, y0 + 9, 10, 9, 'shu', 3); c.HL(19, y0 + 9, 10, 'shu', 4)
    c.R(30, y0 + 9, 6, 3, 'kuro', 4); c.R(31, y0 + 12, 1, 4, 'kuro', 2); c.R(34, y0 + 12, 1, 4, 'kuro', 2)
    outline(c)


@obj('se-armor', '갑옷 진열(투구 + 갑옷, 궤 위)', w=1, h=1, up=24, gate='figure', cat=('castle', '성·무가'),
     tags=('갑옷', '무가', '성', '도장'), place='알현실·무가 큰방 구석.', desc='검은 궤 위에 앉힌 붉은 실 갑옷 — 금 장식 투구, 어깨 판.')
def _(c):
    furn(c, 1, 30, 14, 10, 4, 'kuro', 4)
    c.R(4, 15, 8, 14, 'kuro', 3)
    for y in range(16, 28, 3): c.HL(4, y, 8, 'shu', 3)
    c.R(2, 14, 4, 5, 'kuro', 4); c.R(10, 14, 4, 5, 'kuro', 2)
    c.ell(8, 9, 4, 4, lambda X, Y, dx, dy, d: ('kuro', 4 if dx < 0 else 2))
    c.R(4, 2, 2, 5, 'kin', 4); c.R(10, 2, 2, 5, 'kin', 3); c.HL(5, 11, 6, 'kin', 3)
    outline(c)


@obj('se-sword-rack', '칼걸이(긴칼·짧은칼 두 자루)', w=1, h=1, up=8, gate='frame', cat=('castle', '성·무가'),
     tags=('칼', '무가', '도장', '성'), place='무가 방 도코노마 옆·영주 자리 옆.', desc='검은 옻칠 받침에 가로로 얹은 칼 두 자루 — 칼집 윗면, 금 코등이.')
def _(c):
    y1 = top_plane(c, 1, 16, 14, 5, 'kuro', inset=2)            # 받침대: 원근 윗면 5행
    c.R(1, y1, 14, 3, 'kuro', 2); c.HL(1, y1, 14, 'kuro', 3); c.VL(0, y1, 3, 'sumi', 1); c.VL(15, y1, 3, 'sumi', 1); c.HL(1, y1 + 3, 14, 'sumi', 1)
    for x in (3, 11):
        c.R(x, 6, 2, 11, 'kuro', 3); c.VL(x, 6, 11, 'kuro', 4)
        c.ell(x + 1, 6, 1.5, 1, lambda *a: ('kuro', 5))
    for y, x0, x1 in ((5, 0, 16), (10, 1, 15)):
        c.HL(x0, y, x1 - x0, 'kuro', 5); c.HL(x0, y + 1, x1 - x0, 'kuro', 4); c.HL(x0, y + 2, x1 - x0, 'kuro', 2)
        c.R(x0 + 4, y, 1, 3, 'kin', 3)
        c.HL(x0, y - 1, x1 - x0, 'sumi', 1); c.HL(x0, y + 3, x1 - x0, 'sumi', 1)



@obj('se-weapon-rack', '목검·창 걸이(도장 벽)', w=2, h=1, up=16, kind='wall', gate='frame', cat=('dojo', '도장'),
     tags=('도장', '목검', '창', '무술'), place='도장 북쪽 벽 앞.', desc='벽 앞 나무 틀에 세운 목검 여섯과 창 하나 — 받침 윗면, 가로대.')
def _(c):
    furn(c, 1, 24, 30, 8, 4, 'ki', 5)
    c.R(1, 4, 30, 3, 'ki', 4); c.HL(1, 4, 30, 'ki', 5); c.HL(1, 7, 30, 'sumi', 1)
    for k in range(6):
        x = 3 + k * 4
        c.VL(x, 2, 24, 'ki', 5); c.VL(x + 1, 2, 24, 'ki', 3)
    c.VL(28, 0, 26, 'kuro', 3); c.P(28, 0, 'ishi', 6); c.P(28, 1, 'ishi', 4)
    c.VL(0, 4, 26, 'sumi', 1); c.VL(31, 4, 26, 'sumi', 1)


@obj('se-taiko', '북(타이코, 받침 위)', w=1, h=1, up=10, gate='round_body', cat=('dojo', '도장'),
     tags=('북', '도장', '절', '축제'), place='도장·절 마루 구석.', desc='나무 받침 위 큰 북 — 위에서 보이는 둥근 가죽면, 쇠못 줄, 붉은 몸통.')
def _(c):
    c.R(2, 22, 12, 4, 'ki', 3); c.HL(2, 22, 12, 'ki', 5)
    for y in range(8, 22):
        for x in range(2, 14):
            c.P(x, y, 'shu', 4 if x < 6 else 3 if x < 10 else 2)
    c.ell(8, 8, 6, 3, lambda X, Y, dx, dy, d: ('washi', 3 if d < 0.6 else 2))
    for x in range(3, 14, 2): c.P(x, 11, 'kin', 4); c.P(x, 19, 'kin', 3)
    outline(c)


# ═══════════════ 가게·부엌·목욕 ═══════════════
@obj('se-shop-counter', '가게 장부 자리(초바, 낮은 책상 + 격자 가림)', w=2, h=1, up=8, gate='low_furniture', cat=('shop', '가게'), use=('counter',),
     tags=('가게', '계산대', '장부', '상가'), place='가게 마루 앞쪽, 흙바닥(도마)과 마루 경계.', desc='낮은 장부 책상과 앞에 세운 격자 가림 — 윗면에 주판·장부(글자 없음).')
def _(c):
    furn(c, 1, 6, 30, 18, 7, 'ki', 5)
    c.R(4, 8, 8, 3, 'washi', 3); c.R(16, 8, 9, 3, 'kuro', 3)
    for x in range(17, 25, 2): c.P(x, 9, 'ki', 6)
    for x in range(3, 30, 3): c.VL(x, 14, 9, 'ki', 2)


@obj('se-goods-shelf', '물건 선반(피륙·상자, 벽 앞)', w=2, h=1, up=24, kind='wall', gate='tall_furniture', cat=('shop', '가게'), use=('search',),
     tags=('가게', '선반', '포목', '상가'), place='가게 북쪽 벽 앞.', desc='세 단 나무 선반 — 피륙 두루마리·상자·쌀자루가 빛깔별 덩이로.')
def _(c):
    rows = shelf_case(c, 1, 2, 30, 37, 8, 3)
    c.R(5, 4, 8, 3, 'kaki', 4); c.R(5, 7, 8, 1, 'kaki', 2); c.ell(23, 6, 3.5, 1.6, lambda X, Y, dx, dy, d: ('kaya', 6 if dy < 0 else 4))
    cols = [('ai', 3), ('kaki', 3), ('shu', 3), ('shikkui', 3), ('kaya', 4), ('matsu', 3)]
    for r, (fy, hh) in enumerate(rows):
        for k in range(5):
            m, t = cols[(r * 5 + k) % len(cols)]
            goods_box(c, 5 + k * 5, fy, 4, min(hh - 1, 6), m, t)



@obj('se-cash-box', '돈궤(쇠 장식 작은 궤)', w=1, h=1, up=4, gate='box', cat=('shop', '가게'), use=('open',),
     tags=('돈궤', '가게', '여관'), place='장부 자리 옆.', desc='쇠 모서리 장식을 단 검은 작은 궤 — 뚜껑 윗면, 자물쇠.')
def _(c):
    furn(c, 2, 6, 12, 14, 6, 'kuro', 4)
    c.R(2, 6, 2, 2, 'kin', 3); c.R(12, 6, 2, 2, 'kin', 3); c.R(7, 13, 2, 3, 'kin', 3)


@obj('se-kimono-rack', '옷걸이 틀(이코, 걸린 기모노)', w=2, h=1, up=20, gate='frame', cat=('shop', '가게'),
     tags=('기모노', '포목', '가게', '방'), place='포목점 마루·무가 방 구석.', desc='검은 옻칠 가로대 틀에 소매를 편 기모노 — 쪽빛 바탕 흰 무늬.')
def _(c):
    for y in range(10, 29):
        w = 26 if y < 17 else 14
        x0 = 16 - w // 2
        for x in range(x0, x0 + w):
            t = 3 if x < 16 else 2
            if (x + y) % 7 == 0: c.P(x, y, 'shikkui', 4); continue
            c.P(x, y, 'ai', t)
    c.R(14, 10, 4, 7, 'shikkui', 4)
    for x in (2, 28): c.R(x, 6, 2, 22, 'kuro', 3); c.VL(x, 6, 22, 'kuro', 4)
    y1 = top_plane(c, 0, 2, 32, 4, 'kuro', inset=2)            # 가로대: 원근 윗면 4행 + 앞면 2행
    c.R(0, y1, 32, 2, 'kuro', 2); c.HL(0, y1 + 2, 32, 'sumi', 1)
    for cx in (3, 29): disc(c, cx, 28, 3, 1.5, 2, 'kuro', 5)     # 발 받침: 둥근 윗면
    outline(c)



@obj('se-kamado', '부뚜막(가마도, 솥 둘)', w=2, h=1, up=12, gate='box', cat=('kitchen', '부엌'), use=('open',),
     tags=('부엌', '부뚜막', '민가', '여관'), place='부엌 흙바닥(도마) 북쪽 벽 앞.', desc='흰 회벽 부뚜막 — 윗면에 무쇠 솥 둘(나무 뚜껑), 앞면 아궁이 불빛.')
def _(c):
    y = furn(c, 1, 6, 30, 22, 9, 'shikkui', 4)
    for cx in (9, 23):
        c.ell(cx, 10, 5.5, 3.2, lambda X, Y, dx, dy, d: ('kuro', 2 if d > 0.6 else 3))
        c.ell(cx, 9, 3.6, 1.8, lambda X, Y, dx, dy, d: ('ki', 5 if dx < 0 else 4))
        c.R(cx - 3, y + 4, 6, 5, 'sumi', 0); c.R(cx - 2, y + 6, 4, 3, 'hi', 2); c.P(cx - 1, y + 6, 'hi', 3)


@obj('se-water-jar', '물독(큰 질항아리 + 나무 뚜껑)', w=1, h=1, up=8, gate='container', cat=('kitchen', '부엌'),
     tags=('물독', '부엌', '농가'), place='부엌 부뚜막 옆.', desc='큰 갈색 질항아리 — 반쯤 덮은 나무 뚜껑 사이로 물, 국자.')
def _(c):
    for y in range(8, 24):
        k = (y - 8) / 16
        hw = 5.5 + 1.5 * math.sin(k * math.pi)
        for x in range(int(8 - hw), int(8 + hw) + 1):
            dx = (x - 8) / hw
            c.P(x, y, 'tsuchi', 4 if dx < -0.4 else 3 if dx < 0.3 else 2)
    c.ell(8, 8, 6, 2.6, lambda X, Y, dx, dy, d: ('mizu', 3) if d < 0.6 else ('tsuchi', 5))
    c.R(3, 6, 6, 3, 'ki', 5); c.HL(3, 6, 6, 'ki', 6)
    c.line(10, 7, 14, 2, 'ki', 3)
    outline(c)


@obj('se-meal-tray', '밥상 소반(오젠, 밥그릇·국그릇)', w=1, h=1, up=2, gate='low_furniture', cat=('kitchen', '부엌'), use=('sit',),
     tags=('밥상', '여관', '방'), place='여관 방석 앞·연회 방에 줄지어.', desc='검붉은 옻칠 작은 소반 — 윗면에 밥그릇·국그릇·반찬 접시.')
def _(c):
    furn(c, 1, 4, 14, 12, 7, 'shu', 2)
    c.ell(5, 6, 2.2, 1.6, lambda *a: ('shikkui', 5)); c.ell(10, 6, 2.2, 1.6, lambda *a: ('kuro', 3)); c.P(10, 6, 'tsuchi', 5)
    c.R(6, 8, 4, 2, 'shikkui', 4); c.P(7, 8, 'momiji', 4)
    c.R(2, 16, 2, 2, 'shu', 1); c.R(12, 16, 2, 2, 'shu', 1)


@obj('se-bathtub', '노송나무 욕조(김 오르는 물)', w=2, h=2, up=6, gate='container', cat=('bath', '목욕'), use=('heal',),
     tags=('목욕', '온천', '욕조', '여관'), place='목욕탕·여관 욕실 가운데, 둘레 1칸 비움.', desc='밝은 노송나무 네모 욕조 — 테두리 윗면, 안에 하늘빛 물, 김.')
def _(c):
    furn(c, 1, 6, 30, 32, 26, 'ki', 6)
    c.R(4, 9, 24, 19, 'mizu', 4); c.HL(4, 9, 24, 'mizu', 2); c.HL(6, 14, 8, 'mizu', 6); c.HL(15, 20, 9, 'mizu', 5)
    for x, y in ((9, 4), (10, 2), (20, 5), (21, 3)): c.P(x, y, 'washi', 2)
    for x in range(2, 30, 4): c.VL(x, 33, 4, 'ki', 3)


@obj('se-buckets', '나무 들통 더미(목욕·물)', w=1, h=1, up=4, gate='round_body', cat=('bath', '목욕'),
     tags=('목욕', '들통', '온천'), place='욕조 옆·우물가.', desc='작은 나무 들통 셋 — 위에서 보이는 둥근 테, 대나무 테 띠.')
def _(c):
    for cx, cy in ((8, 3.5), (4, 9.5), (12, 10)):
        disc(c, cx, cy, 3.6, 2, 3, 'ki', 6, inner=('mizu', 4))



# ═══════════════ 공부·놀이·문 ═══════════════
@obj('se-writing-desk', '앉은뱅이 책상(붓·벼루)', w=1, h=1, up=6, gate='low_furniture', cat=('wa', '방·민가'), use=('read',),
     tags=('책상', '서당', '무가', '여관'), place='방 장지 창 앞.', desc='낮은 나무 책상 — 윗면에 펼친 종이·벼루·붓.')
def _(c):
    furn(c, 1, 6, 14, 12, 7, 'ki', 5)
    c.R(3, 7, 6, 4, 'washi', 3); c.R(10, 8, 3, 3, 'kuro', 2); c.line(4, 12, 9, 8, 'kuro', 3)


@obj('se-scroll-shelf', '두루마리 서가(벽 앞)', w=2, h=1, up=24, kind='wall', gate='tall_furniture', cat=('wa', '방·민가'), use=('read',),
     tags=('서가', '두루마리', '무가', '절', '서당'), place='서재·절 북쪽 벽 앞.', desc='세 단 나무 서가 — 끈 묶은 두루마리와 접은 책 묶음(글자 없음).')
def _(c):
    rows = shelf_case(c, 1, 2, 30, 37, 8, 3)
    c.R(6, 4, 8, 3, 'washi', 2); c.HL(6, 4, 8, 'washi', 3); c.ell(21, 6, 4, 1.4, lambda X, Y, dx, dy, d: ('washi', 3 if dy < 0 else 1))
    for r, (fy, hh) in enumerate(rows):
        for k in range(6):
            x = 5 + k * 4
            if (r + k) % 3 == 0: goods_box(c, x, fy, 3, min(hh - 1, 5), 'washi', 1)
            else:
                c.ell(x + 1.5, fy - 2, 1.8, 1.8, lambda X, Y, dx, dy, d: ('washi', 3 if d < 0.5 else 2)); c.P(x + 1, fy - 2, 'shu', 3)
                c.ell(x + 1.5, fy - 5, 1.8, 1.8, lambda X, Y, dx, dy, d: ('washi', 3 if d < 0.5 else 1))



@obj('se-go-board', '바둑판(다리 달린 두꺼운 판)', w=1, h=1, up=6, gate='low_furniture', cat=('wa', '방·민가'), use=('sit',),
     tags=('바둑', '무가', '여관', '절'), place='방 툇마루 가까이. 양옆 방석.', desc='두꺼운 비자나무 바둑판 — 윗면 격자, 흰·검은 돌 몇, 짧은 다리.')
def _(c):
    furn(c, 1, 5, 14, 15, 9, 'ki', 6)
    for i in range(3, 14, 3): c.VL(i, 6, 7, 'ki', 3); c.HL(2, 4 + i // 3 * 2 + 1, 12, 'ki', 3)
    c.P(5, 8, 'shikkui', 5); c.P(9, 10, 'kuro', 1); c.P(11, 7, 'shikkui', 5)


@obj('se-lantern-hang', '걸린 초롱(붉은)', w=1, kind='hang', hrows=2, gate='wall_mounted', cat=('wa', '방·민가'), use=('light',),
     tags=('초롱', '여관', '가게', '찻집'), place='벽면 윗줄.', desc='붉은 종이 초롱 — 위아래 검은 테, 안 불빛. 글자 없음.')
def _(c):
    # 벽에 박은 쇠 걸이(벽 판 + 팔)에 매단 붉은 초롱
    c.R(1, 1, 5, 8, 'ki', 3); c.VL(1, 1, 8, 'ki', 4); c.HL(1, 1, 5, 'ki', 5); c.VL(0, 1, 8, 'sumi', 1); c.VL(6, 1, 8, 'sumi', 1)
    c.HL(5, 3, 6, 'kuro', 3); c.HL(5, 4, 6, 'kuro', 1); c.VL(10, 4, 3, 'kuro', 2)
    c.R(7, 7, 6, 2, 'kuro', 3)
    for y in range(9, 23):
        hw = 5 if 11 < y < 21 else 4
        for x in range(10 - hw, 10 + hw):
            c.P(x, y, 'shu', 5 if x < 9 else 4 if x < 12 else 3)
        if y % 3 == 0: c.HL(10 - hw, y, 2 * hw, 'shu', 2)
    c.R(7, 23, 6, 2, 'kuro', 2)



@obj('se-window-shoji', '장지 창(벽면, 밝은 종이 + 대 살)', w=2, kind='hang', hrows=2, gate='wall_mounted', cat=('wa', '방·민가'), use=('light',),
     tags=('창', '장지', '방', '여관'), place='벽면 윗줄, 두 칸씩.', desc='벽면에 낸 장지 창 — 나무 틀 안 흰 종이 칸, 아래 창턱.')
def _(c):
    c.R(2, 6, 28, 18, 'ki', 3)
    shoji(c, 3, 7, 26, 16, lit=True)
    c.HL(1, 24, 30, 'ki', 5); c.HL(1, 25, 30, 'ki', 2)


@obj('se-door-fusuma', '방 사이 미닫이(열린 후스마 틈)', w=1, kind='door', gate='wall_mounted', cat=('door', '문'),
     tags=('문', '후스마', '방'), place='가로 칸막이 1칸 틈.', desc='반쯤 열린 후스마 — 문틀과 밀려 난 문짝, 아래 문지방.')
def _(c):
    c.R(0, 0, 3, 32, 'ki', 3); c.VL(0, 0, 32, 'ki', 5)
    c.R(13, 0, 3, 32, 'ki', 2); c.VL(15, 0, 32, 'ki', 1)
    for y in range(0, 30):
        for x in range(10, 13): c.P(x, y, 'washi', 3 if x < 12 else 2)
    c.VL(10, 0, 30, 'kuro', 2)
    c.HL(0, 30, 16, 'ki', 4); c.HL(0, 31, 16, 'ki', 2)


@obj('se-door-noren', '노렌 드리운 문 틈(가게 안쪽·부엌)', w=1, kind='door', gate='wall_mounted', cat=('door', '문'),
     tags=('문', '노렌', '가게', '부엌'), place='가로 칸막이 1칸 틈(가게 앞칸↔안채, 부엌).', desc='문틀 위에서 드리운 쪽빛 노렌 두 폭 — 아래로 지나간다.')
def _(c):
    c.R(0, 0, 2, 32, 'ki', 3); c.R(14, 0, 2, 32, 'ki', 2)
    for y in range(0, 14):
        for x in range(2, 14):
            if x == 8: continue
            c.P(x, y, 'ai', 4 if y < 2 else 3 if x < 8 else 2)
    c.HL(2, 13, 12, 'ai', 1)
    c.HL(0, 30, 16, 'ki', 4); c.HL(0, 31, 16, 'ki', 2)


# ── 분류표(campus _Cats 와 같은 방식: ikit.Registry.build 가 읽는다) ──
class _Cats:
    BY_ID = {}

    @staticmethod
    def check(obj_ids, complete=False):
        miss = sorted(set(obj_ids) - set(_Cats.BY_ID))
        assert not miss, ('분류 없음', miss)


import ikit as _ikit       # noqa: E402
_ikit.CATS = _Cats
for _id, (_k, _ko) in CAT.items(): _Cats.BY_ID[_id] = ('sengoku-' + _k, _ko)


def gate_image(id_):
    """관문용 그림(투명 배경, 가구 그대로). 바닥·벽면은 주기 그림 한 장."""
    if id_ in R.objs:
        a, U = R.obj_image(id_); return Image.fromarray(a, 'RGBA')
    if id_ in R.floors:
        f = R.floors[id_]; return Image.fromarray(R._canvas(f['draw'], f['cols'] * 16, f['rows'] * 16), 'RGBA')
    w = R.walls[id_]; return Image.fromarray(R._canvas(w['draw'], w['cols'] * 16, 32), 'RGBA')


def export():
    d = os.path.join(OUT, '_gate'); os.makedirs(d, exist_ok=True)
    rows = []
    for id_ in list(R.floors) + list(R.walls) + list(R.objs):
        im = gate_image(id_)
        p = os.path.join(d, id_ + '.png'); im.save(p)
        kind = GATE.get(id_, 'terrain')
        ko = (R.objs.get(id_) or R.floors.get(id_) or R.walls.get(id_))['ko']
        rows.append(dict(png=os.path.basename(p), kind=kind, name=ko, label='sengoku-edo/' + id_))
    with open(os.path.join(d, 'items.jsonl'), 'w') as f:
        for r in rows: f.write(json.dumps(r, ensure_ascii=False) + '\n')
    return rows


if __name__ == '__main__':
    rows = export()
    items = [(r['label'].split('/')[-1], Image.open(os.path.join(OUT, '_gate', r['png']))) for r in rows]
    contact(items, os.path.join(OUT, 'preview.png'), z=3, W=2100)
    print(len(R.floors), 'floors', len(R.walls), 'walls', len(R.objs), 'objects')
