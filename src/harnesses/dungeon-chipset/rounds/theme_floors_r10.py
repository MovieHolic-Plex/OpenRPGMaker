"""theme-floors-r10 (r9 를 고친 판). r9 반려(og-r9-sonnet.txt): 넓은 20×15 바닥에서 112/80 반복이 빛 점·밝은 판 덩이로 벽지처럼 보임.
고친 점: 밝은 판(ostone 2) 을 드물고 고르게(판 셋 중 하나 → 다섯 중 하나, 이웃 씨앗끼리 같은 단 피함) — 눈에 띄는 큰 덩이가 없게.
빛 줄기 셋(짧게, 밭 안 고르게). 시공기는 방마다 밭 시작 자리를 해시로 어긋낸다(compose.ts field).

r9 설명:

theme-floors-r9 (r8 을 고친 판). r8 반려(og-r8-sonnet.txt): 가장자리 47 변형이 판석 없는 남색 띠라 방 둘레가 다른 재질로 보였고 몸통이 「붙인 판」, 128/96 반복이 2×2 로 보임.
고친 점: 가장자리 47 변형을 쓰지 않는다 — 바닥 칸은 모두 밭 조각(칸 위치), 벽 바로 밑 줄만 같은 열의 밭 조각에 4px 벽 그림자를 얹은 「그늘 줄」 조각.
밭 112×80(칸 7×5) — 시트 꼬리 여유(47칸) 안: 밭 35 + 그늘 줄 7 = 42. 그늘 줄은 밭 맨 윗줄 7칸만 쓴다(벽 밑 칸 = 그 열의 밭 윗줄 조각 + 그림자).
빛 줄기는 밭 감김이 드러나지 않게 셋만, 판 크기를 크게(씨앗 격자 18px).

r8 설명:

theme-floors-r8 (r7 를 고친 판). r7 반려(og-r7-sonnet.txt): 64px 밭 반복이 빛 점 격자로 보임 · 판 속 평면 · 가장자리 그늘 없음 · 절반이 적갈색 · 빛이 굵은 막대.
고친 점: 밭 128×96(칸 8×6, 반복 128/96px) · 씨앗 손 배치 대신 지터 격자 64개 · 판마다 3단 베벨(위·왼 빛 → 몸 → 아래·오른 그늘) + 판 안 잔결 ·
바탕은 보라 검정(ostone 0·1·2 + void 2), 적갈 ostone 3 은 빛 모서리에만 · 줄눈 void 0 · 빛은 줄눈 속 1px arcane 1·2(가운데 한 화소만 3), 줄기 몇 개만 ·
가장자리 47 변형: 북변 3px 그늘 사다리, 서·동 2px, 남 1px(앞면이 아니라 문턱).

이하 r7 설명.

theme-floors-r7 — 마계 바닥 other.ground 일곱째 판(묶음 theme_arcane).

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
NX, NY = 112, 80
N = NX  # 옛 이름(가로)
LEG7 = L('x:void0 k:void2 v:ostone0 a:ostone1 b:ostone2 c:ostone3 l:ostone4 g:arcane1 G:arcane2 H:arcane3')


def _h(*a):
    v = 2166136261
    for x in a:
        v = ((v ^ (x & 0xffffffff)) * 16777619) & 0xffffffff
    return v


def _seeds():
    """지터 격자 8×6 → 판 씨앗 48 + 작은 판 16. (x, y, 바탕 단 0..2, 금 여부)."""
    out = []
    for gy in range(5):
        for gx in range(7):
            jx, jy = _h(gx, gy, 1) % 11 - 5, _h(gx, gy, 2) % 11 - 5
            # 바탕 단: 0 = ostone1(보통) · 1 = ostone2(밝음, 드물게) · 2 = ostone0(어둠). 체크 무늬처럼 번갈아 이웃끼리 같은 단을 피한다.
            t = 2 if (gx + 2 * gy) % 3 == 2 else 0   # 밝은 판(ostone2) 없음 — 하나만 있어도 밭마다 같은 자리에 「밝은 덩이」 표지가 섰다
            out.append(((gx * 16 + 8 + jx) % NX, (gy * 16 + 8 + jy) % NY, t, 1 if _h(gx, gy, 4) % 7 == 0 else 0))
    for k in range(14):
        out.append((_h(k, 5) % NX, _h(k, 6) % NY, 0 if k % 2 else 2, 0))
    return out


SEEDS = _seeds()
# 빛 새는 틈(시작 근처 좌표, 길이) — 밭 128×96 에 일곱, 고르지 않게
GLOWS = [(31, 15, 4), (86, 44, 3), (52, 66, 4)]
from cave_r1 import poly  # noqa: E402
CRACKS = [[(30, 36), (33, 39), (36, 39)], [(90, 10), (93, 13)], [(56, 50), (59, 53)], [(100, 66), (103, 68)]]


def field():
    def d2(x, y, s):
        dx = min(abs(x - s[0]), NX - abs(x - s[0]))
        dy = min(abs(y - s[1]), NY - abs(y - s[1]))
        return dx * dx + 1.25 * dy * dy + (_h(x, y, 3) % 5) * 0.6
    lab = [[min(range(len(SEEDS)), key=lambda i: d2(x, y, SEEDS[i])) for x in range(NX)] for y in range(NY)]
    L_ = lambda x, y: lab[y % NY][x % NX]  # noqa: E731
    grout = set()
    for y in range(NY):
        for x in range(NX):
            if L_(x + 1, y) != L_(x, y) or L_(x, y + 1) != L_(x, y):
                grout.add((x, y))
    # 판까지 거리(줄눈에서 몇 화소 안쪽인가)와 어느 쪽 줄눈에 가까운가로 3단 베벨
    g = [[''] * NX for _ in range(NY)]
    BASE = ['a', 'b', 'v']           # 판 몸 단(ostone 1 · 2 · 0)
    LIT = {'a': 'b', 'b': 'c', 'v': 'a'}
    LIT2 = {'a': 'c', 'b': 'l', 'v': 'b'}
    SH = {'a': 'v', 'b': 'a', 'v': 'k'}
    for y in range(NY):
        for x in range(NX):
            if (x, y) in grout:
                g[y][x] = 'x'
                continue
            body = BASE[SEEDS[lab[y][x]][2]]
            # 위·왼 1·2 화소 안에 줄눈 → 빛 모서리 / 아래·오른 1·2 화소 안에 줄눈 → 그늘
            up1 = (x, (y - 1) % NY) in grout or (( x - 1) % NX, y) in grout
            up2 = (x, (y - 2) % NY) in grout or ((x - 2) % NX, y) in grout
            dn1 = (x, (y + 1) % NY) in grout or ((x + 1) % NX, y) in grout
            dn2 = (x, (y + 2) % NY) in grout or ((x + 2) % NX, y) in grout
            if up1:
                ch = LIT2[body] if _h(x, y, 5) % 2 else LIT[body]
            elif dn1:
                ch = SH[body]
            elif up2:
                ch = LIT[body]
            elif dn2:
                ch = SH[body] if _h(x, y, 6) % 2 else body
            else:
                ch = body
                # 판 안 잔결: 2화소 가로 덩이(줄마다 어긋남)로 한 단 위·아래 — 평면 판이 되지 않게
                r = _h((x + (y % 2)) // 2, y, 11) % 9
                if r == 0:
                    ch = LIT[body]
                elif r in (1, 2):
                    ch = SH[body]
            g[y][x] = ch
    for ln in CRACKS:
        P = poly(*ln)
        for x, y in P:
            g[y % NY][x % NX] = 'x'
        for x, y in P:
            X, Y = (x + 1) % NX, (y + 1) % NY
            if g[Y][X] not in 'x':
                g[Y][X] = 'l'
    for x0, y0, n in GLOWS:
        # 가장 가까운 줄눈 화소에서 시작해 줄눈을 따라 걷는다
        best = min(((x, y) for (x, y) in grout), key=lambda p: (p[0] - x0) ** 2 + (p[1] - y0) ** 2)
        path, cur, seen = [best], best, {best}
        while len(path) < n:
            nxt = [((cur[0] + dx) % NX, (cur[1] + dy) % NY) for dx, dy in ((1, 0), (0, 1), (1, 1), (1, -1), (-1, 1), (-1, 0), (0, -1), (-1, -1))]
            nxt = [p for p in nxt if p in grout and p not in seen]
            if not nxt:
                break
            cur = nxt[0]
            seen.add(cur)
            path.append(cur)
        mid = len(path) // 2
        for j, (x, y) in enumerate(path):
            d = abs(j - mid)
            g[y][x] = 'H' if d == 0 else 'G' if d <= 1 else 'g'
    return [''.join(r) for r in g]


FIELD = field()


def bodies():
    out = []
    for ty in range(NY // 16):
        for tx in range(NX // 16):
            out.append([FIELD[ty * 16 + y][tx * 16:tx * 16 + 16] for y in range(16)])
    return out


def body_order():
    n = (NX // 16) * (NY // 16)
    quiet = min(range(n), key=lambda i: sum(r.count('G') + r.count('H') + r.count('g') for r in bodies()[i]) * 10 + i)
    return [quiet] + [i for i in range(n) if i != quiet]


# 가장자리 틀(32×32 + 안 모서리 16×16): '.' = 몸통 비침. 북 3줄·서 2열·동 2열 그늘 사다리, 남 1줄.
EDGE_LEG = L('x:ostone0 k:void2 s:ostone1 v:ostone0 m:ostone2 n:ostone3')
def _frame():
    """가장자리 띠: 먹 대신 재질 그늘 — 맨 바깥 = 판 그늘 ostone 0, 안으로 ostone 0 / 1 잔결이 몸통으로 풀린다. 북(벽 쪽) 3줄, 서·동 2열, 남 1줄."""
    g = [['.'] * 32 for _ in range(32)]
    for x in range(32):
        g[0][x] = 'x' if x % 5 in (0, 2, 3) else 'm'   # 벽 그림자(벽이 드리운 그늘) — 한 줄만 짙게
        g[1][x] = 's' if x % 3 == 0 else 'm'
        g[2][x] = 'm' if x % 4 == 1 else '.'
        g[31][x] = 'x' if x % 4 else 's'
    for y in range(32):
        if y > 0:
            g[y][0] = 'n' if y % 3 else 'm'          # 빛 쪽(서): 재질 밝은 단 입술
            if g[y][1] == '.':
                g[y][1] = 'm' if y % 2 else '.'
            g[y][31] = 'x'
            if g[y][30] == '.':
                g[y][30] = 's' if y % 2 else '.'
    return [''.join(r) for r in g]


def _inner():
    g = [['.'] * 16 for _ in range(16)]
    # 안 모서리: 해당 사분면 귀퉁이 2×2 그늘
    for (x0, y0) in ((0, 0), (14, 0), (0, 14), (14, 14)):
        for dy in range(2):
            for dx in range(2):
                g[y0 + dy][x0 + dx] = 'x' if (dx == (0 if x0 == 0 else 1) and dy == (0 if y0 == 0 else 1)) else 's'
    return [''.join(r) for r in g]


EDGE_FRAME, EDGE_INNER = _frame(), _inner()


def quiet_body():
    """가장자리 47 변형이 쓰는 본몸통 — 줄눈 없는 판 속(16 주기 잔결)이라 저 혼자 감아 깔아도 이음이 없다(시공기는 이 오토타일을 쓰지 않는다)."""
    rows = []
    for y in range(16):
        r = ''
        for x in range(16):
            v = _h((x + (y % 2)) // 2 % 8, y, 31) % 9
            r += 'c' if v == 0 else 'a' if v in (1, 2) else 'b'
        rows.append(r)
    return rows


SH_STEP = {'l': 'c', 'c': 'b', 'b': 'a', 'a': 'v', 'v': 'k', 'k': 'x', 'x': 'x', 'g': 'g', 'G': 'g', 'H': 'G'}


def shade_rows(rows, depth=(2, 2, 1, 1)):
    """벽 밑 칸: 맨 위 줄부터 depth[i] 단 어둡게(4px), 그 아래는 그대로 — 벽이 바닥에 드리운 그늘(먹 띠가 아니라 판석이 비치는 그늘)."""
    out = []
    for y, r in enumerate(rows):
        k = depth[y] if y < len(depth) else 0
        if y == len(depth) and True:
            # 그늘 끝 화소 줄은 칸마다 들쭉날쭉(직선 띠가 되지 않게)
            r = ''.join(SH_STEP[c] if _h(x, y, 41) % 3 == 0 else c for x, c in enumerate(r))
        for _ in range(k):
            r = ''.join(SH_STEP[c] for c in r)
        out.append(r)
    return out


def _shade_row():
    return [grid(shade_rows([FIELD[y][fx * 16:fx * 16 + 16] for y in range(16)]), LEG7) for fx in range(NX // 16)]


SHADE_ROW = _shade_row()


class FieldAutotile(dot.Autotile):
    """가장자리 변형도 그 칸 자리의 밭 조각 위에 그늘을 얹는다(r8 첫 판 반려: 가장자리가 판석 없는 납작한 남색 띠라 몸통이 「붙인 판」으로 보였다).
    tile_at(mask, x, y) = 밭 조각 (x % 8, y % 6) 위에 틀·안 모서리. tile(mask) = 밭 조각 0 위(굽기·시트용)."""

    def piece(s, x, y):
        fx, fy = x % (NX // 16), y % (NY // 16)
        cv = Cv(16, 16)
        cv.a[:] = s.field.a[fy * 16:(fy + 1) * 16, fx * 16:(fx + 1) * 16]
        return cv

    def tile_at(s, mask, x, y):
        keep = s.body
        s.body = s.piece(x, y)
        try:
            return s.tile(dot.canon(mask))
        finally:
            s.body = keep


def ground_at():
    bs = [grid(quiet_body(), LEG7)] + [grid(b, LEG7) for b in bodies()]
    base = autotile_cv(bs[0], grid(EDGE_FRAME, EDGE_LEG, 32, 32), grid(EDGE_INNER, EDGE_LEG, 16, 16), bs[1:])
    at = FieldAutotile(base.body, base.edge, base.outer, base.inner, base.bodies[1:])
    at.field = grid(FIELD, LEG7)   # 관문: 시공기 배치(칸 위치로 감아 깖) 그대로 이음을 잰다
    return at


def tiled(nx=16, ny=12, wall_rows=()):
    """시공기 배치 그대로: 칸 (x, y) = 밭 조각 (x%4, y%4)."""
    f = grid(FIELD, LEG7)
    cv = Cv(nx * 16, ny * 16)
    for y in range(ny):
        for x in range(nx):
            fx, fy = x % (NX // 16), y % (NY // 16)
            if y in wall_rows:
                cv.a[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16] = SHADE_ROW[fx].a
            else:
                cv.a[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16] = f.a[fy * 16:(fy + 1) * 16, fx * 16:(fx + 1) * 16]
    return cv


def _row_cv():
    cv = Cv(16 * len(SHADE_ROW), 16)
    for i, t in enumerate(SHADE_ROW):
        cv.paste(t, i * 16, 0)
    return cv


def c_ground():
    def fn():
        at = ground_at()
        v = dot.render_cave(R1.TOWER_ROOM, R1.CR.part('C', 1, 'ceil'), R1.SR.brick_face(), at)
        # 시공기 배치 그대로: 바닥 칸 = 밭 조각(칸 위치), 북쪽이 벽인 칸 = 그 열의 그늘 줄 조각
        g = R1.TOWER_ROOM
        f = grid(FIELD, LEG7)
        for y, row in enumerate(g):
            for x, ch in enumerate(row):
                if ch == '#':
                    continue
                fx, fy = x % (NX // 16), y % (NY // 16)
                if y > 0 and g[y - 1][x] == '#':
                    v.a[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16] = SHADE_ROW[fx].a
                else:
                    v.a[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16] = f.a[fy * 16:(fy + 1) * 16, fx * 16:(fx + 1) * 16]
        put_actor(v, 4, 5)
        img = grid(FIELD, LEG7)   # 판석 밭 128×96 통째(8×6 칸)
        return img, {'kind': 'autotile', 'autotiles': {'ground': at}, 'vignette': v, 'fieldCols': NX // 16,
                     'note': '112×80 감김 판석 밭 + 벽 밑 그늘 줄 7칸(가장자리 47 변형 없음). r8: 128×96 감김 판석 밭(지터 격자 판 64, 3단 베벨, 보라 검정, 줄눈 속 1px 빛 일곱 줄기) — r7 기술: 64×64(보로노이 판 22, 판마다 기울기·단, 검은 줄눈, 줄눈에서 새는 보라 빛 6줄기)을 16칸으로 잘라 몸통 변형',
                     'shadeRow': SHADE_ROW, 'field': grid(FIELD, LEG7),
                     'extras': [('밭 감아 깐 16×12 바닥(시공기 배치, 맨 윗줄 = 벽 밑 그늘 줄, 2배)', tiled(16, 12, wall_rows=(0,)), 2),
                                ('벽 밑 그늘 줄 7칸', _row_cv(), 4)]}
    return fn


CANDIDATES = {'other.ground': {'A1': c_ground()}}


def line_scenes():
    return {}
