"""theme-floors-r6 — 마계 바닥 other.ground 여섯째 판(묶음 theme_arcane).

r5 반려(독립 Sonnet, ~/claude-viz/dungeon-themes-3-raw/og-r5-sonnet.txt):
  모든 변형이 같은 둘레 고리 + 고정 자리 건넘 홈 → 16px 마다 줄눈 격자, 납작한 보라 쐐기 덩이, 변형마다 같은 사선 금.
r6 는 짜임을 바꾼다 — **칸 둘레에는 아무 특징도 없다**:
  ① 바탕 = 화소마다 해시로 고른 잔결(ostone 2·3·4 를 비율 3:5:2) — 둘레도 같은 분포라 어느 변형이 맞닿아도 이음매가 없다.
  ② 칸 안쪽(둘레 3px 안)에만 낮은 주파 밝기 덩이(판의 볼록·오목, 한 단) — 가장자리로 갈수록 0 으로 풀린다.
  ③ 금은 칸 안에서 시작해 칸 안에서 끝난다(둘레 2px 에 닿지 않음). 금 = ostone 0, 금 위·왼 = 그늘 ostone 1, 금 아래·오른 = 빛 턱 ostone 5.
     변형마다 금 모양이 다르다(손으로 적은 꺾은선 표). 몇 금에는 1~3화소 보라 빛(arcane 2·3).
  ④ 5×5 평면 없음, 명암 6단(ostone 0·1·2·3·4·5) + 빛 2단.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
import theme_arcane_r1 as R1  # noqa: E402
import theme_floors_r1 as F1  # noqa: E402
from cave_r1 import autotile_cv, poly, variants_sheet  # noqa: E402
from dot import Cv, grid  # noqa: E402
from theme_arcane_r1 import L, put_actor  # noqa: E402

WAVE = 'theme_arcane'
LEG6 = L('k:ostone0 s:ostone1 a:ostone2 b:ostone3 c:ostone4 l:ostone5 g:arcane2 G:arcane3')


def _h(*a):
    v = 2166136261
    for x in a:
        v = ((v ^ (x & 0xffffffff)) * 16777619) & 0xffffffff
    return v


# 칸 안 꺾은선 금(꼭짓점 목록). 모두 2..13 안. 둘째 값 = 빛 화소 수.
CRACKS = [
    ([[(2, 4), (6, 6), (8, 6), (12, 10)], [(8, 6), (9, 2)]], 3),
    ([[(2, 10), (5, 9), (7, 11), (10, 11), (13, 8)]], 2),
    ([[(5, 2), (6, 5), (5, 8), (7, 12)], [(6, 5), (10, 6)]], 3),
    ([[(3, 6), (7, 7)], [(9, 10), (12, 12)]], 0),
    ([[(4, 12), (7, 9), (8, 5), (12, 3)]], 1),
    ([[(2, 3), (5, 5)], [(10, 4), (12, 7), (11, 11), (8, 13)]], 2),
    ([[(4, 7), (8, 8), (12, 7)], [(8, 8), (7, 12)]], 0),
    ([[(3, 11), (6, 12)]], 0),
    ([[(6, 3), (9, 5), (13, 5)], [(3, 9), (5, 12)]], 2),
    ([[(2, 6), (4, 8), (4, 11)], [(9, 9), (13, 11)]], 1),
    ([], 0),
    ([[(5, 5), (8, 4)], [(7, 10), (10, 12), (13, 11)]], 0),
]
# 낮은 주파 밝기 덩이(중심, 반지름, +1 밝음 / -1 어둠) — 칸 안쪽에만
BUMPS = [[(5, 10, 3, 1), (11, 4, 2, -1)], [(9, 5, 3, 1)], [(10, 10, 3, -1), (4, 4, 2, 1)], [(7, 7, 4, 1)],
         [(4, 5, 3, -1), (11, 11, 3, 1)], [(7, 9, 3, 1)], [(4, 4, 2, 1), (11, 12, 2, 1)], [(9, 6, 4, 1), (4, 11, 2, -1)],
         [(10, 10, 3, 1)], [(7, 4, 3, 1), (11, 9, 2, -1)], [(8, 8, 4, 1), (4, 12, 2, -1)], [(11, 7, 3, 1)]]
NBODY = len(CRACKS)


def body(i):
    tone = [[0] * 16 for _ in range(16)]
    for y in range(16):
        for x in range(16):
            # 2×2 덩이 잔결(줄마다 반 칸 어긋남) — 화소 하나씩 뒤섞으면 천 짜임처럼 보였다
            ox = (y // 2) % 2
            r = _h((x + ox) // 2, y // 2, i, 7) % 12
            tone[y][x] = 2 if r < 3 else 3 if r < 10 else 4
            if _h(x, y, i, 8) % 9 == 0:
                tone[y][x] = max(2, min(4, tone[y][x] + (1 if _h(x, y, i, 5) % 2 else -1)))
            # 바로 옆과 같은 단이 길게 늘어서지 않게(5×5 평면 방지) — 해시가 이미 섞는다
    for cx, cy, rad, sgn in BUMPS[i]:
        for y in range(16):
            for x in range(16):
                if min(x, y, 15 - x, 15 - y) < 3:
                    continue
                d2 = (x - cx) ** 2 + (y - cy) ** 2
                if d2 <= rad * rad and (_h(x, y, i, 9) % 4) != 0:
                    tone[y][x] = max(2, min(5, tone[y][x] + sgn))
    ch = {1: 's', 2: 'a', 3: 'b', 4: 'c', 5: 'l'}
    g = [[ch[tone[y][x]] for x in range(16)] for y in range(16)]
    lines, glow = CRACKS[i]
    P = []
    for ln in lines:
        for a, b in zip(ln, ln[1:]):
            for p in poly(a, b):
                if p not in P:
                    P.append(p)
    S = set(P)
    for x, y in P:
        assert 2 <= x <= 13 and 2 <= y <= 13, ('금이 둘레에 닿았다', i, x, y)
        g[y][x] = 'k'
    for x, y in P:
        for dx, dy, c in ((-1, 0, 's'), (0, -1, 's'), (1, 0, 'l'), (0, 1, 'l')):
            X, Y = x + dx, y + dy
            if (X, Y) not in S and g[Y][X] != 'k':
                if c == 'l' and (_h(X, Y, i, 3) % 3 == 0):
                    continue   # 빛 턱을 군데군데 끊는다
                g[Y][X] = c
    # 금 속 보라 빛: 금 화소 중 가운데쯤 연속 glow 개
    if glow:
        mid = len(P) // 2
        for j, (x, y) in enumerate(P[mid:mid + glow]):
            g[y][x] = 'G' if j == glow // 2 else 'g'
    rows = [''.join(r) for r in g]
    for y in range(12):
        for x in range(12):
            blk = {rows[y + dy][x + dx] for dy in range(5) for dx in range(5)}
            assert len(blk) > 1, ('5×5 평면', i, x, y)
    return rows


def ground_at():
    bs = [grid(body(i), LEG6) for i in range(NBODY)]
    return autotile_cv(bs[0], grid(F1.A1_FRAME, F1.FRAME_LEG, 32, 32), grid(R1.GROUND_INNER, F1.FRAME_LEG, 16, 16), bs[1:])


def c_ground():
    def fn():
        at = ground_at()
        v = dot.render_cave(R1.TOWER_ROOM, R1.CR.part('C', 1, 'ceil'), R1.SR.brick_face(), at)
        put_actor(v, 4, 5)
        # 4×3 바닥 조각(몸통 12 변형을 섞어 깐 땅) — 64×16 띠는 판정자가 「바닥이 아닌 가는 띠」로 읽었다(r6 첫 영수증)
        img = Cv(64, 48)
        order = [0, 5, 2, 9, 7, 1, 10, 4, 3, 11, 6, 8]
        for j, i in enumerate(order):
            img.paste(at.bodies[i % len(at.bodies)], (j % 4) * 16, (j // 4) * 16)
        return img, {'kind': 'autotile', 'autotiles': {'ground': at}, 'vignette': v,
                     'note': '둘레 무특징 잔결 + 칸 안 금(빛 턱·그늘)·보라 빛 1~3화소 · 낮은 주파 판 볼록 · 변형 12',
                     'extras': [('몸통 8×8(변형 섞음, 2배)', dot.mosaic(at, 8, 8), 2), ('47 변형(벽·문턱 쪽 가장자리)', variants_sheet(at), 2)]}
    return fn


CANDIDATES = {'other.ground': {'A1': c_ground()}}


def line_scenes():
    return {}
