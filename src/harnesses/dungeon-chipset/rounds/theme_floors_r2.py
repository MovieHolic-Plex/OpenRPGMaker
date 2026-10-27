"""theme-floors-r2 — 마계 바닥 other.ground 둘째 판(묶음 theme_arcane, 2026-10-25).

r1 A2 블라인드 반려(Sonnet): ① 16px 반복이 같은 자갈 세로 줄로 보임 ② 1화소 청록·회색 점이 고른 디더 잡음
③ 돌과 틈 대비가 같음 ④ 벽(회녹 벽돌)과 색이 안 이어짐.
고친 점:
  ① 둘레 공유 띠를 1화소로 줄이고(칸 경계 건넘 자리만 공유), 몸통마다 속 씨앗 3~4개를 해시 자리에 둔다 — 몸통 12개.
     씨앗 거리를 가로 늘린(1.0 : 1.6) 엇갈린 돌이라 줄눈이 칸마다 어긋난다.
  ② 결 점을 몸통당 2덩이(2화소)로 줄이고 줄눈 바로 옆에만 둔다.
  ③ 돌 = 거의 한 색 바탕 + 위·왼 빛 변 1 + 아래·오른 그늘 변 1, 틈 = ostone0(가장 어두움). 값 띠 4(틈·그늘·바탕·빛).
  ④ 벽 brick 계열 중간 톤(brick3 #4c534f)을 빛 변 일부와 줄눈 곁 결에 쓴다.
  A1 = 보라 돌(arcane0·ostone2 바탕), 빛 변 arcane1 / 일부 brick3.
  A2 = 슬레이트 돌(vrock1·brick2 바탕), 빛 변 vrock2 / 일부 brick3.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
import theme_arcane_r1 as R1  # noqa: E402
import theme_floors_r1 as F1  # noqa: E402
from cave_r1 import autotile_cv, variants_sheet  # noqa: E402
from dot import Cv, grid  # noqa: E402
from theme_arcane_r1 import L, put_actor  # noqa: E402

WAVE = 'theme_arcane'

# d 틈 ostone0 · s 그늘 변 ostone1 · 바탕 a arcane0 / b ostone2 / q vrock1 / w brick2 · 빛 변 l arcane1 / Q vrock2 / g brick3
LEG2 = L('d:ostone0 k:ostone0 s:ostone1 a:arcane0 b:ostone2 q:vrock1 w:brick2 l:arcane1 Q:vrock2 g:brick3')
BASES = {'A1': 'ab', 'A2': 'qw'}
LIT = {'a': 'l', 'b': 'l', 'q': 'Q', 'w': 'Q'}
EDGE_BASE = {'A1': 'a', 'A2': 'q'}
# 칸 둘레에서 판이 나뉘는 자리(모든 몸통 공유): 위·아래 변 x, 왼·오른 변 y
CROSS_X = (3, 10)
CROSS_Y = (5, 12)
NBODY = 12


def _h(*v):
    x = 0x9E3779B1
    for n in v:
        x = ((x ^ (n & 0xffffffff)) * 0x85EBCA6B) & 0xffffffff
        x ^= x >> 13
    return x


def _seeds(i):
    ss = []
    k = 0
    while len(ss) < 4 and k < 40:
        x, y = 3 + _h(i, k, 1) % 10, 3 + _h(i, k, 2) % 10
        if all(abs(x - a) + abs(y - b) >= 5 for a, b in ss):
            ss.append((x, y))
        k += 1
    return ss


def body(key, i):
    ss = _seeds(i)
    lab = [[0] * 16 for _ in range(16)]
    for y in range(16):
        for x in range(16):
            lab[y][x] = min(range(len(ss)), key=lambda n: (x - ss[n][0]) ** 2 + 1.6 * (y - ss[n][1]) ** 2 + (_h(x, y, n, i) % 3) * 0.2)
    G = set()
    for y in range(16):
        for x in range(16):
            if (x + 1 < 16 and lab[y][x + 1] != lab[y][x]) or (y + 1 < 16 and lab[y + 1][x] != lab[y][x]):
                G.add((x, y))
    # 둘레 1화소: 경계 판 하나(EDGE) — 건넘 자리에만 틈. 둘레 바로 안쪽 판과는 틈으로 끊는다.
    for t in range(16):
        for p in ((t, 0), (t, 15), (0, t), (15, t)):
            G.discard(p)
    for x in CROSS_X:
        G |= {(x, 0), (x, 1), (x, 15), (x, 14)}
    for y in CROSS_Y:
        G |= {(0, y), (1, y), (15, y), (14, y)}
    edge = {(x, y) for y in range(16) for x in range(16) if min(x, y, 15 - x, 15 - y) == 0}
    bases = BASES[key]
    g = [['d' if (x, y) in G else ((EDGE_BASE[key]) if (x, y) in edge else bases[(lab[y][x] + i) % 2]) for x in range(16)] for y in range(16)]
    B = [r[:] for r in g]
    ing = lambda x, y: (x, y) in G   # noqa: E731
    use_g = {n for n in range(len(ss)) if _h(i, n, 7) % 3 == 0}     # 판 셋 중 하나쯤 빛 변 = 벽 회녹(brick3)
    for y in range(16):
        for x in range(16):
            b = B[y][x]
            if b == 'd':
                continue
            if ing(x, y - 1) or ing(x - 1, y):
                g[y][x] = 'g' if (lab[y][x] in use_g and (x, y) not in edge) else LIT[b]
            elif ing(x, y + 1) or ing(x + 1, y):
                g[y][x] = 's'
    # 줄눈 곁 결 2덩이(2화소, brick3/vrock2) — 몸통 속 바탕 자리만
    placed = 0
    for k in range(60):
        if placed >= 2:
            break
        x, y = 2 + _h(i, k, 11) % 11, 2 + _h(i, k, 12) % 11
        cells = [(x, y), (x + 1, y)]
        if all(g[Y][X] == B[Y][X] and B[Y][X] != 'd' for X, Y in cells) and any(ing(X, Y + 1) or ing(X + 1, Y) or ing(X, Y - 1) for X, Y in [(x, y + 1), (x + 1, y + 1), (x, y - 1)] if 0 <= Y < 16):
            for X, Y in cells:
                g[Y][X] = 'g' if key == 'A1' else 'Q'
            placed += 1
    return [''.join(r) for r in g]


def ground_at(key):
    bs = [grid(body(key, i), LEG2) for i in range(NBODY)]
    return autotile_cv(bs[0], grid(F1.A1_FRAME, F1.FRAME_LEG, 32, 32), grid(R1.GROUND_INNER, F1.FRAME_LEG, 16, 16), bs[1:])


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
    ('other.ground', 'A1'): '보라 엇갈린 돌(arcane0·ostone2 바탕, 빛 변 arcane1·일부 벽 회녹 brick3), 틈 ostone0, 결 2덩이는 줄눈 곁만, 몸통 12',
    ('other.ground', 'A2'): '슬레이트 엇갈린 돌(vrock1·brick2 바탕, 빛 변 vrock2·일부 brick3), 틈 ostone0, 결 2덩이는 줄눈 곁만, 몸통 12',
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
