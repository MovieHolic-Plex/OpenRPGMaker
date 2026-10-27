"""theme-floors-r7 — 마계 바닥 other.ground 일곱째 판(묶음 theme_arcane).

r6 반려(독립 Sonnet, og-r6-sonnet.txt): 몸통 칸마다 왼위에 같은 짧은 사선 금 + 보라 점 → 16px 격자, 판석이 아니라 자주 잔점 카펫,
큰 명암 구조 없음, 버들항 화산보다 채도 높고 평평.

r7 은 짜임을 바꾼다 — 몸통 16칸을 **한 장의 64×64 판석 밭**(가로·세로 감김, 이음 없음)에서 잘라 낸다:
  ① 판석 = 64×64 위 손으로 고른 씨앗 22개의 보로노이 판(감김). 판 하나는 10~22px — 칸 경계를 넘나든다.
  ② 판마다 다른 바탕 단(ostone 1·2·3, 채도 낮은 vrock 2 섞음), 판 안에서 위·왼(빛) → 아래·오른(그늘)로 한 단 기울기 → 판이 도드라져 보인다.
  ③ 판 사이 줄눈 = vrock 0(거의 검정), 줄눈 위·왼 쪽 판 가장자리 = 그늘(vrock 1), 아래·오른 쪽 = 빛 턱(ostone 4).
  ④ 보라 빛은 줄눈 몇 군데에만 3~6화소 이어진 줄기(arcane 1→2→3, 가운데만 3) — 점이 아니라 갈라진 틈에서 새는 빛.
  ⑤ 판 몇 개는 금이 간 판(판 안 짧은 금 vrock 0 + 빛 턱).
엔진은 몸통 변형을 칸 해시로 섞으므로(이웃 칸이 밭의 이웃 조각이 아니다) 판이 칸 경계에서 끊길 수 있다 —
그래서 밭의 칸 경계(16 배수 줄)에는 줄눈을 일부러 많이 둔다: 판 씨앗을 칸 경계 근처에 배치해 칸 경계 대부분이 줄눈 또는 판 가장자리 그늘이 되게 하고,
경계 화소 단을 모든 몸통에서 같은 분포로 맞춘다(16칸 서로의 이음 차이는 관문 S 로 잰다).
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
N = 64
LEG7 = L('x:vrock0 k:vrock1 v:vrock2 a:ostone1 b:ostone2 c:ostone3 l:ostone4 g:arcane1 G:arcane2 H:arcane3')


def _h(*a):
    v = 2166136261
    for x in a:
        v = ((v ^ (x & 0xffffffff)) * 16777619) & 0xffffffff
    return v


# 판 씨앗(x, y, 바탕 단 0..2, 금 여부) — 손으로 고른 자리. 크고 작은 판이 섞이게.
SEEDS = [(5, 6, 1, 0), (19, 3, 2, 0), (33, 8, 0, 1), (49, 4, 1, 0), (60, 13, 2, 0),
         (10, 20, 2, 1), (26, 18, 1, 0), (41, 22, 2, 0), (55, 26, 0, 0),
         (3, 33, 0, 0), (17, 37, 1, 0), (31, 31, 2, 0), (46, 38, 1, 1), (60, 41, 2, 0),
         (9, 49, 1, 0), (23, 52, 0, 1), (37, 47, 1, 0), (52, 55, 2, 0),
         (2, 60, 2, 0), (30, 61, 1, 0), (44, 59, 0, 0), (59, 62, 1, 0)]
# 빛 새는 틈: 줄눈 위 씨앗 점 근처에서 줄눈을 따라 n 화소
GLOWS = [(29, 13, 9), (45, 30, 7), (13, 43, 10), (50, 49, 6), (21, 26, 6), (38, 56, 8)]
# 금 간 판의 금(판 안, 꼭짓점)
from cave_r1 import poly  # noqa: E402
CRACKS = [[(30, 6), (33, 9), (36, 9)], [(8, 18), (11, 21)], [(44, 36), (47, 39), (47, 42)], [(21, 50), (24, 53)]]


def field():
    def d2(x, y, s):
        dx = min(abs(x - s[0]), N - abs(x - s[0]))
        dy = min(abs(y - s[1]), N - abs(y - s[1]))
        return dx * dx + 1.25 * dy * dy + (_h(x, y, 3) % 5) * 0.6
    lab = [[min(range(len(SEEDS)), key=lambda i: d2(x, y, SEEDS[i])) for x in range(N)] for y in range(N)]
    L_ = lambda x, y: lab[y % N][x % N]  # noqa: E731
    grout = set()
    for y in range(N):
        for x in range(N):
            if L_(x + 1, y) != L_(x, y) or L_(x, y + 1) != L_(x, y):
                grout.add((x, y))
    g = [[''] * N for _ in range(N)]
    TONES = ['abc', 'bbc', 'abv']
    for y in range(N):
        for x in range(N):
            if (x, y) in grout:
                g[y][x] = 'x'
                continue
            s = SEEDS[lab[y][x]]
            # 판 안 기울기: 씨앗 기준 위·왼은 밝게, 아래·오른은 어둡게(감김 거리)
            dx = ((x - s[0] + N // 2) % N) - N // 2
            dy = ((y - s[1] + N // 2) % N) - N // 2
            t = dx + dy
            base = 'abc'[s[2]]
            if t < -6:
                ch = {'a': 'b', 'b': 'c', 'c': 'c'}[base]
            elif t > 6:
                ch = {'a': 'a', 'b': 'a', 'c': 'b'}[base]
            else:
                ch = base
            r = _h(x, y, 11) % 13
            if r == 0:
                ch = {'a': 'b', 'b': 'c', 'c': 'b'}[ch]
            elif r == 1:
                ch = {'a': 'v', 'b': 'a', 'c': 'b'}[ch]
            g[y][x] = ch
    # 줄눈 곁: 위·왼 판 끝 = 그늘 k, 아래·오른 판 끝 = 빛 턱 l
    out = [r[:] for r in g]
    for y in range(N):
        for x in range(N):
            if g[y][x] == 'x':
                continue
            if g[(y + 1) % N][x] == 'x' or g[y][(x + 1) % N] == 'x':
                out[y][x] = 'k'
            elif g[(y - 1) % N][x] == 'x' or g[y][(x - 1) % N] == 'x':
                out[y][x] = 'l' if _h(x, y, 5) % 4 else 'c'
    g = out
    for ln in CRACKS:
        P = poly(*ln)
        for x, y in P:
            g[y % N][x % N] = 'x'
        for x, y in P:
            X, Y = (x + 1) % N, (y + 1) % N
            if g[Y][X] not in 'x':
                g[Y][X] = 'l'
    for x0, y0, n in GLOWS:
        # 가장 가까운 줄눈 화소에서 시작해 줄눈을 따라 걷는다
        best = min(((x, y) for (x, y) in grout), key=lambda p: (p[0] - x0) ** 2 + (p[1] - y0) ** 2)
        path, cur, seen = [best], best, {best}
        while len(path) < n:
            nxt = [((cur[0] + dx) % N, (cur[1] + dy) % N) for dx, dy in ((1, 0), (0, 1), (1, 1), (1, -1), (-1, 1), (-1, 0), (0, -1), (-1, -1))]
            nxt = [p for p in nxt if p in grout and p not in seen]
            if not nxt:
                break
            cur = nxt[0]
            seen.add(cur)
            path.append(cur)
        mid = len(path) // 2
        for j, (x, y) in enumerate(path):
            d = abs(j - mid)
            g[y][x] = 'H' if d <= 1 else 'G' if d <= len(path) // 3 else 'g'
        # 빛 번짐: 빛 줄기 가운데 셋 둘레 판 가장자리 화소 한 단(ostone 4 → arcane 1)
        for x, y in path[max(0, mid - 1):mid + 2]:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                X, Y = (x + dx) % N, (y + dy) % N
                if g[Y][X] in 'klc':
                    g[Y][X] = 'g'
    return [''.join(r) for r in g]


FIELD = field()


def bodies():
    out = []
    for ty in range(4):
        for tx in range(4):
            out.append([FIELD[ty * 16 + y][tx * 16:tx * 16 + 16] for y in range(16)])
    return out


def body_order():
    quiet = min(range(16), key=lambda i: sum(r.count('G') + r.count('H') + r.count('g') for r in bodies()[i]) * 10 + i)
    return [quiet] + [i for i in range(16) if i != quiet]


def ground_at():
    bs = [grid(b, LEG7) for b in bodies()]
    # 본몸통(가장자리 47 변형이 쓰는 칸) = 빛 줄기 없는 가장 조용한 조각
    bs = [bs[i] for i in body_order()]
    return autotile_cv(bs[0], grid(F1.A1_FRAME, F1.FRAME_LEG, 32, 32), grid(R1.GROUND_INNER, F1.FRAME_LEG, 16, 16), bs[1:])


def tiled(nx=12, ny=8):
    """시공기 배치 그대로: 칸 (x, y) = 밭 조각 (x%4, y%4)."""
    f = grid(FIELD, LEG7)
    cv = Cv(nx * 16, ny * 16)
    for y in range(ny):
        for x in range(nx):
            cv.a[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16] = f.a[(y % 4) * 16:(y % 4 + 1) * 16, (x % 4) * 16:(x % 4 + 1) * 16]
    return cv


def c_ground():
    def fn():
        at = ground_at()
        v = dot.render_cave(R1.TOWER_ROOM, R1.CR.part('C', 1, 'ceil'), R1.SR.brick_face(), at)
        put_actor(v, 4, 5)
        img = grid(FIELD, LEG7)   # 판석 밭 64×64 통째(4×4 칸)
        return img, {'kind': 'autotile', 'autotiles': {'ground': at}, 'vignette': v, 'fieldOrder': body_order(),
                     'note': '64×64 감김 판석 밭(보로노이 판 22, 판마다 기울기·단, 검은 줄눈, 줄눈에서 새는 보라 빛 6줄기)을 16칸으로 잘라 몸통 변형',
                     'extras': [('밭 3×2 감아 깐 바닥(시공기 배치, 2배)', tiled(), 2), ('47 변형(벽·문턱 쪽 가장자리)', variants_sheet(at), 2)]}
    return fn


CANDIDATES = {'other.ground': {'A1': c_ground()}}


def line_scenes():
    return {}
