"""theme-floors-r3 — 마계 바닥 other.ground 셋째 판(묶음 theme_arcane, 2026-10-25). r2 A1 에서 출발.

r2 A1 블라인드 반려(Argon, Sonnet 일부):
  ① 칸 경계에서 금·빛 변이 끊긴다 ② 변형 4 의 곧은 직교 금·ㄱ자 빛이 격자를 그린다
  ③ 판마다 1화소 밝은 테 → 솟은 미로·회로판 ④ 외톨이 올리브 막대.
고친 점:
  ① 둘레 2화소 띠는 **모든 몸통이 같은 계약**이다: 금은 정해진 건넘 자리(위 x=5·12 ↔ 아래 x=4·11, 오른 y=6 ↔ 왼 y=7)에서만
     대각으로 칸을 넘고, 띠 안 금·그늘·빛은 공유 그루터기(STUBS)에서만 나온다. 몸통마다 다른 금은 띠 밖(3화소 안쪽)에서만 돈다.
  ② 몸통 금은 대각 위주 걸음(곧은 걸음 3번이면 반드시 꺾임) — 곧은 줄 4화소 넘지 않음.
  ③ 테 없음: 틈 = ostone0, 틈 바로 위·왼 = 그늘(ostone1), 빛(arcane1)은 일부 돌의 위 변에만, 2화소 이상 줄.
  ④ 벽 회녹(brick3)은 일부 빛 변 1~2화소 탁한 물만(몸통마다 자리 다름), 따로 선 막대 없음.
  A1 = 보라 돌(바탕 arcane0, 결 ostone2) · A2 = 슬레이트 돌(바탕 vrock1, 결 brick2).
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

LEG3 = {'A1': L('d:ostone0 k:ostone0 s:ostone1 b:arcane0 c:ostone2 l:arcane1 g:brick3 n:vrock0'),
        'A2': L('d:ostone0 k:ostone0 s:ostone1 b:vrock1 c:brick2 l:vrock2 g:brick3 n:vrock0')}
NBODY = 12
BAND = 2
# 공유 그루터기: 칸 경계를 대각으로 건너는 금 끝(모든 몸통 같음). 끝점 = 몸통 금이 이어 붙는 자리(띠 바로 안).
STUBS = [
    [(5, 0), (6, 1), (7, 2)],          # 위 x=5  ← 아래 x=4 에서 이어짐
    [(2, 13), (3, 14), (4, 15)],       # 아래 x=4
    [(12, 0), (12, 1), (13, 2)],       # 위 x=12 ← 아래 x=11
    [(10, 13), (11, 14), (11, 15)],    # 아래 x=11
    [(13, 4), (14, 5), (15, 6)],       # 오른 y=6 → 왼 y=7
    [(0, 7), (1, 8), (2, 9)],          # 왼 y=7
]


def _h(*v):
    x = 0x9E3779B1
    for n in v:
        x = ((x ^ (n & 0xffffffff)) * 0x85EBCA6B) & 0xffffffff
        x ^= x >> 13
    return x


def _walk(a, b, salt):
    """a→b 대각 위주 걸음. 곧은 걸음은 3번 넘게 잇지 않는다. 띠(BAND) 안으로는 들어가지 않는다."""
    (x, y), (tx, ty) = a, b
    pts, run, last = [(x, y)], 0, None
    k = 0
    while (x, y) != (tx, ty) and k < 60:
        dx = (tx > x) - (tx < x)
        dy = (ty > y) - (ty < y)
        r = _h(salt, k) % 4
        if dx and dy:
            step = (dx, dy) if r else ((dx, 0) if abs(tx - x) > abs(ty - y) else (0, dy))
        elif dx:
            step = (dx, (1 if r % 2 else -1)) if run >= 2 or r == 0 else (dx, 0)
        else:
            step = ((1 if r % 2 else -1), dy) if run >= 2 or r == 0 else (0, dy)
        nx, ny = x + step[0], y + step[1]
        if min(nx, ny, 15 - nx, 15 - ny) < BAND:
            step = (dx, dy) if dx and dy else (dx or 0, dy or 0)
            nx, ny = x + step[0], y + step[1]
        straight = step[0] == 0 or step[1] == 0
        run = run + 1 if straight and step == last else (1 if straight else 0)
        last = step
        x, y = nx, ny
        pts.append((x, y))
        k += 1
    return pts


def cracks(i):
    G = {p for s in STUBS for p in s}
    j1 = (5 + _h(i, 1) % 4, 4 + _h(i, 2) % 4)
    j2 = (8 + _h(i, 3) % 4, 8 + _h(i, 4) % 4)
    ends = [s[-1] if s[0][1] == 0 or s[0][0] == 0 else s[0] for s in STUBS]
    # 그루터기 안쪽 끝: 위·왼에서 들어오는 건 마지막 점, 아래·오른으로 나가는 건 첫 점
    for n, e in enumerate(ends):
        j = j1 if n in (0, 2, 5) else j2
        G |= set(_walk(e, j, i * 31 + n))
    if _h(i, 9) % 2:
        G |= set(_walk(j1, j2, i * 31 + 17))
    shared = {p for s_ in STUBS for p in s_}
    for _ in range(6):                               # 곧은 줄 4화소 넘으면 가운데 화소를 대각으로 비킨다
        fixed = False
        for horiz in (True, False):
            for a in range(16):
                run = []
                for b_ in range(17):
                    p = (b_, a) if horiz else (a, b_)
                    if b_ < 16 and p in G:
                        run.append(p)
                        continue
                    if len(run) > 4:
                        x, y = run[len(run) // 2]
                        if (x, y) not in shared:
                            G.discard((x, y))
                            G.add((x, y + 1) if horiz else (x + 1, y))
                            fixed = True
                    run = []
        if not fixed:
            break
    return G


def _shade(G, src, x, y):
    inG = lambda X, Y: (X % 16, Y % 16) in G   # noqa: E731
    if (x, y) in G:
        return 'd'
    if inG(x, y + 1) or inG(x + 1, y):
        return 's'                                   # 틈 위·왼 = 그늘
    if inG(x, y - 1) and _h(src, x // 3, y // 3) % 3 == 0:
        return 'l'                                   # 일부 돌 위 변만 빛
    if inG(x, y + 2) or inG(x + 2, y):
        return 'n'                                   # 그늘 앞 한 단(돌 아래 몸통 어둡게)
    return 'b'


def body(key, i):
    G = cracks(i)
    shared = {p for s in STUBS for p in s}
    ring = lambda x, y: min(x, y, 15 - x, 15 - y) < BAND   # noqa: E731
    # 띠 = 공유 그루터기만 보고 몸통 0 해시로 칠한다 → 모든 몸통 같은 화소(어느 변형끼리 붙어도 이어짐)
    g = [[_shade(shared, 0, x, y) if ring(x, y) else _shade(G, i, x, y) for x in range(16)] for y in range(16)]
    inner = lambda x, y: not ring(x, y)              # noqa: E731
    # 몸통 속 결: 2~3화소 덩이, 한 단 위(c) 또는 한 단 아래(s), 약 12%
    for k in range(14):
        x, y = 2 + _h(i, k, 21) % 11, 2 + _h(i, k, 22) % 11
        cells = [(x, y), (x + 1, y)] + ([(x, y + 1)] if k % 3 == 0 else [])
        if all(inner(X, Y) and g[Y][X] == 'b' for X, Y in cells):
            t = 'c' if k % 2 else 's'
            for X, Y in cells:
                g[Y][X] = t
    for y in range(16):                              # 외톨이 빛 1화소 → 바탕(띠 밖만)
        for x in range(16):
            if inner(x, y) and g[y][x] == 'l' and g[y][x - 1] != 'l' and g[y][x + 1] != 'l':
                g[y][x] = 'b'
    lits = [(x, y) for y in range(16) for x in range(16) if inner(x, y) and g[y][x] == 'l']
    if lits:                                         # 벽 회녹 물: 띠 밖 빛 변 1~2화소, 몸통마다 자리 다름
        x, y = lits[_h(i, 77) % len(lits)]
        g[y][x] = 'g'
        if inner(x + 1, y) and g[y][x + 1] == 'l' and _h(i, 78) % 2:
            g[y][x + 1] = 'g'
    return [''.join(r) for r in g]


def ground_at(key):
    bs = [grid(body(key, i), LEG3[key]) for i in range(NBODY)]
    return autotile_cv(bs[0], grid(F1.A1_FRAME, F1.FRAME_LEG, 32, 32), grid(R1.GROUND_INNER, F1.FRAME_LEG, 16, 16), bs[1:])


def random_scene(at, n=4, seed=7):
    out = Cv(n * 16, n * 16)
    for j in range(n):
        for i in range(n):
            b = at.bodies[_h(seed, i, j) % len(at.bodies)]
            out.a[j * 16:(j + 1) * 16, i * 16:(i + 1) * 16] = b.a
    return out


def c_ground(key):
    def fn():
        at = ground_at(key)
        v = dot.render_cave(R1.TOWER_ROOM, R1.CR.part('C', 1, 'ceil'), R1.SR.brick_face(), at)
        put_actor(v, 4, 5)
        img = Cv(64, 16)
        for i, b in enumerate(at.bodies[:4]):
            img.paste(b, i * 16, 0)
        return img, {'kind': 'autotile', 'autotiles': {'ground': at}, 'vignette': v,
                     'extras': [('몸통 4×4 아무 변형', random_scene(at), 4), ('몸통 8×8(변형 섞음, 2배)', dot.mosaic(at, 8, 8), 2),
                                ('47 변형(벽·문턱 쪽 가장자리)', variants_sheet(at), 2)]}
    return fn


ITEM_FNS = {'other.ground': c_ground}
NOTES = {
    ('other.ground', 'A1'): '보라 돌(arcane0), 대각으로 굽는 틈 ostone0 + 위·왼 그늘, 빛 arcane1 은 일부 돌 위 변만, 둘레 2화소 공유 계약, 회녹 물 1~2화소',
    ('other.ground', 'A2'): '슬레이트 돌(vrock1) 같은 짜임, 빛 vrock2, 결 brick2',
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
