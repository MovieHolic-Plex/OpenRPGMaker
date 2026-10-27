"""theme-floors-r5 — 마계 바닥 other.ground 다섯째 판(묶음 theme_arcane, 2026-10-25).

r2 A1 짜임(object gate PASS·Sonnet PASS)에서 시작. r1~r4 반려 사유:
  object-gate 화풍 = 평면 채움·명암 3단<4·칸 정보량 부족 (ostone 경사가 luma 24~80 으로 눌림).
  Argon-high(b3ground-argonhigh.txt) = 좌우 변 화소가 변형마다 달라 이음매·변형1 올리브 막대(x=7,y=2..5)·
  16px 마다 맞는 홈 쌍 격자·외톨이 올리브 점.
고친 점 (팔레트 무수정, 기존 색만):
  ① 값 띠를 vrock 전 단(26·43·66·99·126) + arcane2(84) 바탕 섞음으로 넓힌다 = 6띠, luma 26~126.
     arcane3·4 는 금 곁 작은 빛 결에만.
  ② 둘레 1화소 고리는 모든 변형이 같은 고정 판(빛·그늘 칠 뒤에 다시 덮음) → 위·아래·왼·오른 변 모두 동일.
  ③ brick3(올리브) 미사용 — 막대·외톨이 점 제거. 결은 2화소 덩이를 금 곁에만.
  ④ 건넘 홈의 안쪽 깊이(둘레 다음 화소)를 변형마다 해시로 달리해 16px 홈 쌍 정렬을 깬다(둘레 화소는 공유).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
import theme_arcane_r1 as R1  # noqa: E402
import theme_floors_r1 as F1  # noqa: E402
import theme_floors_r2 as F2  # noqa: E402
from cave_r1 import autotile_cv, variants_sheet  # noqa: E402
from dot import Cv, grid  # noqa: E402
from theme_arcane_r1 import L, put_actor  # noqa: E402

WAVE = 'theme_arcane'
_h = F2._h
# d 틈 vrock0 · s 그늘 vrock1 · 바탕 a vrock2 / b arcane2 · 빛 변 l vrock3 · 꼭대기 빛 h vrock4 · 결 m arcane3
LEG5 = L('d:vrock0 s:vrock1 a:vrock2 b:arcane2 l:vrock3 h:vrock4 m:arcane3')
CROSS_X, CROSS_Y, NBODY = F2.CROSS_X, F2.CROSS_Y, 12


def ring():
    """모든 변형이 공유하는 둘레 1화소 고리."""
    r = {}
    for t in range(16):
        for p in ((t, 0), (t, 15), (0, t), (15, t)):
            r[p] = 'a'
    for x in CROSS_X:
        r[(x, 0)] = r[(x, 15)] = 'd'
        r[(x + 1, 0)] = 'l'          # 홈 오른쪽 빛(위 변)
        r[(x - 1, 15)] = 's'
    for y in CROSS_Y:
        r[(0, y)] = r[(15, y)] = 'd'
        r[(0, y + 1)] = 'l'
        r[(15, y - 1)] = 's'
    return r


RING = ring()


def body(key, i):
    ss = F2._seeds(i)
    lab = [[min(range(len(ss)), key=lambda n: (x - ss[n][0]) ** 2 + 1.6 * (y - ss[n][1]) ** 2 + (_h(x, y, n, i) % 3) * 0.2)
            for x in range(16)] for y in range(16)]
    G = set()
    for y in range(16):
        for x in range(16):
            if (x + 1 < 16 and lab[y][x + 1] != lab[y][x]) or (y + 1 < 16 and lab[y + 1][x] != lab[y][x]):
                G.add((x, y))
    for p in RING:
        G.discard(p)
    # 홈 안쪽 깊이: 변형마다 1~2화소
    for j, x in enumerate(CROSS_X):
        for side, yy in ((0, 1), (1, 14)):
            G.add((x, yy))
            if _h(i, j, side, 21) % 2:
                G.add((x, 2 if side == 0 else 13))
    for j, y in enumerate(CROSS_Y):
        for side, xx in ((0, 1), (1, 14)):
            G.add((xx, y))
            if _h(i, j, side, 22) % 2:
                G.add((2 if side == 0 else 13, y))
    g = [['d' if (x, y) in G else 'ab'[(lab[y][x] + i) % 2] for x in range(16)] for y in range(16)]
    ing = lambda x, y: (x, y) in G or RING.get((x, y)) == 'd'   # noqa: E731
    B = [r[:] for r in g]
    for y in range(16):
        for x in range(16):
            if B[y][x] == 'd':
                continue
            up, lf = ing(x, y - 1), ing(x - 1, y)
            if up and lf:
                g[y][x] = 'h'
            elif up or lf:
                g[y][x] = 'l'
            elif ing(x, y + 1) or ing(x + 1, y):
                g[y][x] = 's'
    # 금 곁 결 2덩이 (arcane3) — 바탕 자리만
    placed = 0
    for k in range(80):
        if placed >= 2:
            break
        x, y = 2 + _h(i, k, 11) % 11, 2 + _h(i, k, 12) % 11
        cells = [(x, y), (x + 1, y)]
        if all(g[Y][X] == B[Y][X] and B[Y][X] in 'ab' for X, Y in cells) and any(ing(X, y + 1) for X, _ in cells):
            for X, Y in cells:
                g[Y][X] = 'm'
            placed += 1
    for (x, y), c in RING.items():
        g[y][x] = c
    return [''.join(r) for r in g]


def ground_at(key):
    bs = [grid(body(key, i), LEG5) for i in range(NBODY)]
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


NOTES = {('other.ground', 'A1'): 'r2 A1 짜임 + vrock 전 단·arcane2 바탕(6띠 luma 26~126), 고정 둘레 고리, 올리브 없음, 홈 깊이 변형별'}
CANDIDATES = {'other.ground': {'A1': F2._noted(c_ground('A1'), NOTES[('other.ground', 'A1')])}}


def line_scenes():
    return {}
