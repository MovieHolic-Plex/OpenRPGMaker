"""theme-floors-r1 — 마계 바닥 other.ground 다시 그리기(묶음 theme_arcane, 2026-10-25).

r1 A2 몸통이 「분홍·붉은 잔점이 칸마다」「붉은 사선 금」「3배에서 어지럽다」로 반려됐다.
새 바닥 = 차분한 보라 검은 돌: 낮은 주파수(16 주기) 물결로 큰 부드러운 판, 이웃 화소는 한 단씩만 바뀌고(외톨이 점 없음),
금은 몸통 소수에만·바탕보다 어둡게, 빛 핏줄은 보라(arcane) 희미한 것 하나뿐(붉은 색 없음).
둘레 3화소 띠는 모든 변형이 같은 잡음이라 어떤 순서로 붙어도 이음이 없다. 가장자리 틀(GROUND_FRAME/INNER)은 r1 그대로.
  A1 = 더 차분: 판 얼룩 두 단 + 드문 홈, 금 몸통 열둘 중 셋, 빛 핏줄 하나.
  A2 = 판 짜임 조금 더: 판 사이 어두운 이음 홈(바탕보다 한 단 어둡게) + 판 윗변 한 단 빛, 금 넷, 빛 핏줄 하나.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
import theme_arcane_r1 as R1  # noqa: E402
from cave_r1 import autotile_cv, poly, variants_sheet  # noqa: E402
from dot import Cv, grid  # noqa: E402
from theme_arcane_r1 import L, put_actor  # noqa: E402

WAVE = 'theme_arcane'

# 글자: e 가장 깊은 홈(ostone0) · d 홈/이음(ostone0) · b 바탕(ostone1) · c 판 빛(ostone2) · m 판 윗변 빛(ostone3, 드묾)
#       k 금·가장자리 그늘(ostone0) · v 빛 핏줄(arcane1) · V 핏줄 심(arcane2)
LEG = {'A1': L('b:ostone1 c:ostone2 m:ostone3 d:ostone0 e:ostone0 k:ostone0 v:arcane1 V:arcane2'),
       'A2': L('b:ostone1 c:ostone2 m:ostone3 d:ostone0 e:ostone0 k:ostone0 v:arcane1 V:arcane2')}

# 가장자리 틀: 빛 쪽(북·서 d) = 밝은 턱 ostone2, 그늘 쪽(동·남 k) = ostone0 — 먹 윤곽 대신 재질 명암
FRAME_LEG = L('d:ostone2 k:ostone0 c:ostone1')
# A1: 북변 둘째 줄을 그늘 대신 바탕 한 단(빛 쪽에 0단이 몰리지 않게)
A1_FRAME = [R1.GROUND_FRAME[0], 'd' + 'c' * 31] + list(R1.GROUND_FRAME[2:])

FREQS = [(1, 0), (0, 1), (1, 1), (1, -1), (2, 1), (1, 2)]
AMPS = [1.0, 1.0, 0.8, 0.8, 0.45, 0.45]


def _phase(i):
    return tuple(((i * 11 + j * 5) % 13) * 0.53 + i * 2.1 for j in range(6))


def _wave(x, y, ph):
    t = 2 * math.pi / 16
    return sum(a * math.cos(t * (fx * x + fy * y) + p) for (fx, fy), a, p in zip(FREQS, AMPS, ph))


def _field(i, key='A2'):
    """둘레 3화소는 변형 0 의 잡음, 가운데로 갈수록 변형 i 잡음으로 섞는다."""
    out = []
    for y in range(16):
        row = []
        for x in range(16):
            dist = min(x, y, 15 - x, 15 - y)
            w = 0.0 if dist < 2 else min(1.0, (dist - 1) / 3.0)
            if key == 'A1':
                w = 0.0 if dist < 3 else min(1.0, (dist - 2) / 2.0)
                row.append(w * 1.25 * _wave(x, y, _phase(i + 3)))
                continue
            row.append(w * _wave(x, y, _phase(i)) + (1 - w) * 0.3 * _wave(x, y, _phase(0)))
        out.append(row)
    return out


def _clean(g, n=3):
    for _ in range(n):
        h = [r[:] for r in g]
        for y in range(16):
            for x in range(16):
                nb = [g[(y + dy) % 16][(x + dx) % 16] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
                if nb.count(g[y][x]) < 2:
                    h[y][x] = max(sorted(set(nb)), key=nb.count)
        g = h
    return g


def plate(key, i):
    f = _field(i, key)
    g = [['c' if f[y][x] > 1.1 else ('d' if f[y][x] < -2.0 else 'b') for x in range(16)] for y in range(16)]
    g = _clean(g, 5 if key == 'A1' else 3)
    if key == 'A1':
        g = [['b' if c == 'd' else c for c in r] for r in g]
    if key == 'A2':
        # 판 이음 홈: 잡음 값이 특정 띠(0 근처를 지나는 등고선)인 곳 = 판 경계, 바탕보다 한 단 어둡게
        for y in range(16):
            for x in range(16):
                if g[y][x] == 'b' and -0.95 < f[y][x] < -0.55 and (x * 3 + y * 5 + i) % 4:
                    g[y][x] = 'd'
        g = _clean(g, 2)
        for y in range(16):                         # 밝은 판 윗변 한 단 빛(드문드문, 2화소 이상)
            for x in range(16):
                if g[y][x] == 'c' and g[(y - 1) % 16][x] == 'b' and g[y][(x + 1) % 16] == 'c' and (x + y) % 3 == 0:
                    g[y][x] = 'c'
    return [''.join(r) for r in g]


# 칸 안에서 끝나는 짧은 금(둘레 띠에 닿지 않음)
CRACKS = [
    [((4, 6), (7, 7), (9, 10), (11, 10))],
    [((10, 4), (9, 7), (6, 9), (5, 12))],
    [((4, 10), (7, 8), (11, 9))],
    [((6, 4), (8, 6), (8, 9), (11, 11))],
]
GLOW = [((5, 9), (7, 8), (9, 8), (11, 6))]


def body(key, i, crack=None, glow=False):
    if key == 'A1':
        return a1_body(i)
    g = [list(r) for r in plate(key, i)]
    if crack is not None:
        for x, y in {p for seg in CRACKS[crack] for p in poly(*seg)}:
            g[y][x] = 'k'
    if glow:
        pts = [p for seg in GLOW for p in poly(*seg)]
        for x, y in pts:
            g[y][x] = 'v'
        x, y = pts[len(pts) // 2]
        g[y][x] = 'V'
    return [''.join(r) for r in g]


# ---------------------------------------------------------------- A1 = 판석(2026-10-25 다시): 큰 불규칙 판 + 판마다 위·왼 빛 1화소, 홈 ostone0.
# 홈은 칸 경계를 네 곳(위·아래 x=4, 왼·오른 y=9)에서만 건너고 칸 안 길은 몸통마다 달라 판이 칸을 넘어 이어진다.
A1_LAYOUTS = [
    [((4, 0), (5, 4), (9, 6), (15, 9)), ((0, 9), (3, 11), (4, 15))],
    [((4, 0), (3, 5), (0, 9)), ((15, 9), (11, 10), (6, 13), (4, 15)), ((11, 10), (12, 4), (10, 1))],
    [((4, 0), (4, 15)), ((0, 9), (4, 9)), ((4, 6), (10, 5), (12, 9), (15, 9))],
    [((4, 0), (7, 3), (8, 9), (4, 15)), ((0, 9), (8, 9)), ((8, 9), (15, 9))],
    [((4, 0), (2, 6), (0, 9)), ((2, 6), (9, 8), (15, 9)), ((9, 8), (7, 13), (4, 15))],
    [((4, 0), (6, 6), (4, 15)), ((0, 9), (2, 9)), ((15, 9), (13, 6), (6, 6))],
    [((4, 0), (8, 2), (13, 3)), ((0, 9), (5, 8), (4, 15)), ((5, 8), (11, 11), (15, 9))],
    [((4, 0), (4, 4), (0, 9)), ((15, 9), (10, 12), (4, 15)), ((4, 4), (11, 5), (10, 12))],
]
A1_CRACKS = {2: [((9, 11), (11, 13))], 5: [((9, 9), (12, 12))], 7: [((6, 9), (8, 11))]}
A1_VEIN = {3: [((10, 3), (12, 5), (13, 7))]}


def a1_body(i):
    f = [[_wave(x, y, _phase(0)) * (1 - min(1.0, max(0, min(x, y, 15 - x, 15 - y) - 1) / 3.0))
          + _wave(x, y, _phase(i + 5)) * min(1.0, max(0, min(x, y, 15 - x, 15 - y) - 1) / 3.0)
          for x in range(16)] for y in range(16)]
    g = [['c' if f[y][x] > 0.6 else 'b' for x in range(16)] for y in range(16)]
    g = _clean(g, 6)
    G = {p for seg in A1_LAYOUTS[i] for p in poly(*seg)}
    for x, y in G:
        g[y][x] = 'd'
    for x, y in G:                                   # 판 위·왼 모서리 빛(홈 아래·오른)
        X, Y = x, (y + 1) % 16
        if (X, Y) not in G:
            g[Y][X] = 'c'
    for seg in A1_CRACKS.get(i, []):
        for x, y in poly(*seg):
            g[y][x] = 'k'
    pts = [p for seg in A1_VEIN.get(i, []) for p in poly(*seg)]
    for x, y in pts:
        g[y][x] = 'v'
    if pts:
        x, y = pts[len(pts) // 2]
        g[y][x] = 'V'
    return [''.join(r) for r in g]


# (변형, 금, 핏줄)
LIST = {'A1': [(i, None, 0) for i in range(8)],
        'A2': [(6, None, 0), (7, None, 0), (2, None, 0), (6, None, 0), (7, None, 0), (0, None, 0), (1, 3, 0), (2, None, 0), (3, None, 0), (4, 0, 0), (5, None, 0),
               (1, None, 0), (2, 2, 0), (3, None, 1), (4, None, 0), (5, 1, 0), (0, None, 0)]}


def ground_at(key):
    leg = LEG[key]
    bs = [grid(body(key, m, c, bool(gl)), leg) for m, c, gl in LIST[key]]
    return autotile_cv(bs[0], grid(A1_FRAME if key == 'A1' else R1.GROUND_FRAME, FRAME_LEG, 32, 32), grid(R1.GROUND_INNER, FRAME_LEG, 16, 16), bs[1:])


def c_ground(key):
    def fn():
        at = ground_at(key)
        v = dot.render_cave(R1.TOWER_ROOM, R1.CR.part('C', 1, 'ceil'), R1.SR.brick_face(), at)
        put_actor(v, 4, 5)
        img = Cv(64, 16)
        for i, b in enumerate(at.bodies[:4]):
            img.paste(b, i * 16, 0)
        return img, {'kind': 'autotile', 'autotiles': {'ground': at}, 'vignette': v,
                     'extras': [('몸통 8×8(변형 섞음, 2배)', dot.mosaic(at, 8, 8), 2), ('47 변형(벽·문턱 쪽 가장자리)', variants_sheet(at), 2)]}
    return fn


ITEM_FNS = {'other.ground': c_ground}
NOTES = {
    ('other.ground', 'A1'): '차분한 보라 검은 큰 판(두 단 낮은 대비 얼룩, 드문 홈), 어두운 짧은 금 몸통 열둘 중 셋, 희미한 보라 핏줄 하나',
    ('other.ground', 'A2'): '같은 판 + 판 사이 어두운 이음 홈·판 윗변 한 단 빛, 어두운 금 넷, 희미한 보라 핏줄 하나',
}


def _noted(fn, note):
    def g_():
        cv, meta = fn()
        meta['note'] = note
        return cv, meta
    return g_


CANDIDATES = {item: {k: _noted(mk(k), NOTES[(item, k)]) for k in ('A1', 'A2')} for item, mk in ITEM_FNS.items()}


def line_scenes():
    return {}
