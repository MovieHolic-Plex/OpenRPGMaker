#!/usr/bin/env python3
"""prehistoric 바닥 — 한 칸(16px) 반복 바닥(무늬 16 주기, 이음새 없음)과 «꼭짓점 왕(Wang) 가장자리» 세트.

가장자리 세트: 재질 A(안)가 바탕 B(밖) 위에 덩이로 놓일 때의 14칸. 칸 이름 w-<쌍>-<NW NE SW SE> (1 = 그 꼭짓점이 A).
0000 = 바탕 B 한 칸, 1111 = A 한 칸이라 따로 두지 않는다. 구성기는 꼭짓점 격자(가로 W+1 × 세로 H+1)를 칠하고
칸마다 네 꼭짓점으로 조각을 고른다 — 그래서 늪·풀밭·용암 웅덩이 가장자리가 네모가 아니라 둥근 덩이가 된다.
경계는 꼭짓점 값의 쌍선형 보간 + 칸 안 위치에만 매인 잡음(16 주기)이라 이웃 칸과 이어진다.
솟은 재질(풀·고사리)은 남쪽 경계 밑 바탕에 그늘 한 줄, 꺼진 재질(물·늪·용암)은 북쪽 둑에 앞면(어두운 둑 벽) 두 줄이 생긴다.

  python3 terrain.py     # tiledata/prehistoric/terrain/_gate/*.png + 가장자리 조립 표본 + preview
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, h32, tex_cluster
from kit import Reg, contact, OUT

R = Reg('terrain')


_LAT = {}


def _lat(n, s):
    """씨앗 s 의 n×n 주기 난수 격자(파이썬 난수 — 해시 상관 줄무늬가 없다)."""
    k = (n, s)
    if k not in _LAT:
        import random
        r = random.Random(s * 7919 + n)
        _LAT[k] = [[r.random() for _ in range(n)] for _ in range(n)]
    return _LAT[k]


def vn(x, y, g, s, per=16):
    """16 주기 값 잡음(0~1)."""
    n = per // g; L = _lat(n, s)
    gx, gy = x // g, y // g; fx, fy = (x % g) / g, (y % g) / g
    a = L[gy % n][gx % n]; b = L[gy % n][(gx + 1) % n]; c = L[(gy + 1) % n][gx % n]; d = L[(gy + 1) % n][(gx + 1) % n]
    sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy


# ═══════════════════════ 재질 칠 함수 (lx, ly: 0~15) ═══════════════════════
def fbm(x, y, s):
    return 0.25 * vn(x, y, 8, s) + 0.5 * vn(x, y, 4, s + 1) + 0.25 * vn(x, y, 2, s + 2)


def vor(x, y, n, s):
    """16 주기 보로노이: (가장 가까운 씨앗 번호, 첫 거리, 둘째 거리). 씨앗 n 개(칸 안 고정)."""
    best = [(9e9, 0), (9e9, 0)]
    for k in range(n):
        px, py = rnd(k, 1, s) * 16, rnd(k, 2, s) * 16
        for ox in (-16, 0, 16):
            for oy in (-16, 0, 16):
                d = ((x + 0.5 - px - ox) ** 2 + (y + 0.5 - py - oy) ** 2) ** 0.5
                if d < best[0][0]: best = [(d, k), best[0]]
                elif d < best[1][0]: best[1] = (d, k)
    return best[0][1], best[0][0], best[1][0]


def sm(x, y, s):
    """잔 무늬 잡음(4px·2px 격자만). 8px 격자 덩이는 칸마다 같은 자리에 같은 얼룩을 찍어 바닥 전체가 바둑판처럼 보였다(QA 1차)."""
    return 0.6 * vn(x, y, 4, s) + 0.4 * vn(x, y, 2, s + 1)


def speck(lx, ly, s, p):
    """드문 낱점(위치 해시) — 칸 하나에 몇 점, 서로 다른 자리."""
    return rnd(lx, ly, s) < p


def p_dirt0(lx, ly, s=1):
    """1판 흙(실내 움집 바닥이 그대로 쓴다 — 바꾸면 실내 영수증이 풀린다)."""
    n = sm(lx, ly, s)
    t = 3 + (1 if n > 0.8 else 0) - (1 if n < 0.2 else 0)
    # 잔돌: 밝은 머리 + 오른쪽 아래 그늘
    if speck(lx, ly, s + 11, 0.018): return ('stone', 4)
    if speck(lx - 1, ly - 1, s + 11, 0.018): return ('dirt', 1)
    if speck(lx, ly, s + 3, 0.05): return ('dirt', t - 1)
    if speck(lx, ly, s + 5, 0.03): return ('dirt', min(5, t + 1))
    return ('dirt', t)


def p_path(lx, ly, s=2):
    """밟힌 흙길: 흙보다 한 단 밝고 매끈하다 — 무늬는 잔 점뿐(큰 얼룩이 칸마다 반복되면 길에 도장이 찍힌 것처럼 보였다)."""
    n = sm(lx, ly, s)
    t = 4 - (1 if n < 0.18 else 0)
    if speck(lx, ly, s + 5, 0.012): return ('stone', 4)
    if speck(lx - 1, ly - 1, s + 5, 0.012): return ('dirt', 2)
    if speck(lx, ly, s + 9, 0.035): return ('dirt', 3)
    if speck(lx, ly, s + 13, 0.03): return ('dirt', 5)
    return ('dirt', t)


def p_grass0(lx, ly, s=3):
    """1판 풀(바위 언덕 풀 덮개·흙 움집 뗏장이 그대로 쓴다)."""
    n = sm(lx, ly, s)
    t = 3 + (1 if n > 0.66 else 0) - (1 if n < 0.3 else 0)
    # 풀잎: 밝은 끝(위) + 밑 그늘(아래) 쌍
    if rnd(lx, ly, s + 7) < 0.09: return ('grass', min(5, t + 2))
    if rnd(lx, (ly - 1) % 16, s + 7) < 0.09: return ('grass', max(1, t - 1))
    if rnd(lx, ly, s + 21) < 0.004: return ('bloom', 2)
    return ('grass', t)


def p_fern(lx, ly, s=4):
    """고사리 바닥: 짙은 잎 덮개 위에 작은 깃꼴 잎(가운데 줄기 + 양옆 잎) 무늬."""
    n = fbm(lx, ly, s)
    t = 2 + (1 if n > 0.55 else 0)
    for (fx, fy, d) in ((3, 2, 1), (11, 5, -1), (7, 10, 1), (14, 12, -1), (1, 13, 1)):
        dx, dy = lx - fx, ly - fy
        if dx in (-2, -1, 0, 1, 2) and dy in (0, 1, 2):
            if dx == 0 and dy < 2: return ('fern', 5)
            if abs(dx) == 1 and dy == 0: return ('fern', 4 + (1 if dx < 0 else 0))
            if abs(dx) == 2 and dy == 1: return ('fern', 4)
            if abs(dx) == 1 and dy == 1: return ('fern', 3)
            if dy == 2 and abs(dx) <= 1: return ('fern', 1)
    if rnd(lx, ly, s + 5) < 0.05: return ('fern', 4)
    return ('fern', t)


def p_stone(lx, ly, s=5):
    """판판한 암반: 큰 판(보로노이 5) + 옅은 틈(한 단 어둡게만), 판 윗변만 한 단 밝게. 판 속은 잔 점."""
    k, d1, d2 = vor(lx, ly, 5, s)
    if d2 - d1 < 0.8: return ('stone', 3)
    ku, a1, a2 = vor(lx, ly - 1, 5, s)
    if a2 - a1 < 0.8: return ('stone', 5 if h32(k, 4, s) % 2 else 4)
    t = 4
    n = sm(lx, ly, s + 11)
    if n < 0.3: t = 3
    if n > 0.74: t = 5
    if speck(lx, ly, s + 3, 0.04): t -= 1
    return ('stone', max(2, min(6, t)))


def p_gravel(lx, ly, s=6):
    k, d1, d2 = vor(lx, ly, 22, s)
    if d2 - d1 < 0.8: return ('dirt', 2 if h32(k, 2, s) % 2 else 3)
    t = 3 + h32(k, 1, s) % 2
    kd, c1, c2 = vor(lx, ly + 1, 22, s)
    if c2 - c1 < 0.8: t -= 1
    ku, a1, a2 = vor(lx, ly - 1, 22, s)
    if a2 - a1 < 0.8: t += 1
    return ('stone', max(2, min(5, t)))


def p_ash(lx, ly, s=7):
    """화산재: 한 단 차이 잔 얼룩 + 드문 현무암 알갱이·밝은 재 점. 줄무늬·덩이 없음."""
    n = sm(lx, ly, s)
    t = 3 - (1 if n < 0.22 else 0)
    if speck(lx, ly, s + 9, 0.06): return ('ash', 2)
    if speck(lx, ly, s + 2, 0.022): return ('basalt', 2)
    if speck(lx - 1, ly, s + 2, 0.022): return ('ash', 1)
    if speck(lx, ly, s + 6, 0.025): return ('ash', 4)
    return ('ash', t)


def p_crust(lx, ly, s=8):
    """굳은 용암 판: 크고 작은 현무암 판(보로노이 6) 사이 가는 틈이 군데군데 붉게 빛난다(모든 틈이 빛나면 칸마다 같은 붉은 그물이 보였다)."""
    k, d1, d2 = vor(lx, ly, 6, s)
    if d2 - d1 < 0.8:
        return ('lava', 2) if h32(k, 3, s) % 3 == 0 else ('basalt', 1)
    t = 3 + (h32(k, 5, s) % 2)
    ku, a1, a2 = vor(lx, ly - 1, 6, s)
    if a2 - a1 < 0.8: t = 4
    if rnd(lx, ly, s + 1) < 0.06: t -= 1
    return ('basalt', t)


def p_mud(lx, ly, s=9):
    """진흙: 두 단 섞임 + 젖은 번들 낱점(아래 어두운 점과 짝) — 큰 검은 얼룩 없음."""
    n = sm(lx, ly, s)
    t = 3 - (1 if n < 0.22 else 0)
    if speck(lx, ly, s + 12, 0.06): return ('mud', 2)
    if speck(lx, ly, s + 4, 0.03): return ('mud', 5)
    if speck(lx, ly - 1, s + 4, 0.03): return ('mud', 1)
    if speck(lx, ly, s + 8, 0.05): return ('mud', 4 if t == 3 else 3)
    return ('mud', t)


def p_swamp(lx, ly, s=10, f=0):
    n = sm(lx, ly, s)
    t = 2 if n > 0.45 else 1
    for (ox, oy, ln) in ((3, 4, 3), (11, 11, 2)):
        xx = (lx - ox - f) % 16
        if ly == oy and xx < ln: return ('swamp', 3)
    # 개구리밥(작은 잎) 드문드문
    if (lx, ly) == (13, 3): return ('grass', 3)
    return ('swamp', t)


def p_water(lx, ly, s=11, f=0):
    t = 2 + (1 if fbm(lx, ly, s) > 0.66 else 0)
    for (ox, oy, ln) in ((1, 2, 4), (9, 6, 3), (4, 10, 5), (12, 13, 3)):
        xx = (lx - ox - f * 2) % 16
        if ly == oy and xx < ln: return ('water', 4 if xx in (1, 2) else 3)
        if ly == oy + 1 and 0 < xx < ln + 1: return ('water', 1)
    return ('water', t)


def p_lava(lx, ly, s=12, f=0):
    """용암: 밝은 줄기와 어두운 식은 줄이 비스듬히 흐른다(프레임마다 오른쪽 아래로). 검은 껍질 덩이는 두지 않는다(칸마다 같은 검은 점이 바둑판으로 보였다)."""
    x, y = (lx - f * 2) % 16, (ly - f) % 16
    n = sm(x, y, s)
    m = 0.5 * n + 0.5 * vn((x + y) % 16, y, 2, s + 7)      # 비스듬한 흐름 결
    if m < 0.2: return ('lava', 1)
    t = 3 - (1 if m < 0.42 else 0) + (1 if m > 0.66 else 0)
    if m > 0.8 and rnd(x, y, s + 3) < 0.3: return ('fire', 4)
    return ('lava', t)


# ─────────── 2판 흙·길·풀 (화풍 정렬 2026-10-14) ───────────
# 버들항 바닥은 몸 전체에 한 단 위·아래 낱점이 촘촘하고(화소의 3~4할), 잔돌(밝은 머리 + 오른쪽 아래 그늘)·짙은 흙점 덩이가 섞인다.
# 1판 흙은 낱점이 드물어 단색 갈색 몸으로 보였다. 무늬는 칸 안 고정 도장(감싸기)이라 이웃 칸과 이음새가 없다.
_STAMP_CACHE = {}


def _grid(key, build):
    if key not in _STAMP_CACHE: _STAMP_CACHE[key] = build()
    return _STAMP_CACHE[key]


def _stamp(g, x0, y0, rows, mat):
    """rows: 문자열 줄. 숫자 = 그 재질의 단, 's'/'S' = 잔돌 몸/머리, '.' = 그대로."""
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch == '.': continue
            x, y = (x0 + i) % 16, (y0 + j) % 16
            if ch == 's': g[y][x] = ('stone', 4)
            elif ch == 'S': g[y][x] = ('stone', 5)
            elif ch == 'k': g[y][x] = ('stone', 3)
            else: g[y][x] = (mat, int(ch))


PEBBLE = [['Ss.', 'sk1'], ['S1'], ['.S.', 'Ssk', '.11'], ['s1']]
CLOD = [['21', '12'], ['.2.', '212'], ['2.', '12', '.2'], ['12.', '.21']]     # 짙은 흙점 덩이(밟힌 흙 속 젖은 흙·씨앗 껍질)


def _dirt_grid(s):
    import random
    r = random.Random(4100 + s)
    g = [[None] * 16 for _ in range(16)]
    for y in range(16):
        for x in range(16):
            n = sm(x, y, s)
            t = 3 - (1 if n < 0.14 else 0)
            q = rnd(x, y, s + 41)
            if q < 0.19: t += 1                     # 밝은 낱알(촘촘히)
            elif q < 0.32: t -= 1                   # 어두운 낱알
            elif q < 0.335: t += 2
            g[y][x] = ('dirt', max(1, min(5, t)))
    for k in range(2): _stamp(g, r.randrange(16), r.randrange(16), CLOD[(k + s) % 4], 'dirt')
    # 잔돌은 변주 칸(dirt-b)에만 — 바탕 칸마다 같은 자리에 찍히면 16px 격자 점으로 보였다
    if s != 1: _stamp(g, r.randrange(16), r.randrange(16), PEBBLE[s % 4], 'dirt')
    return g


def p_dirt(lx, ly, s=1):
    """2판 다진 흙: 촘촘한 한 단 낱알 + 짙은 흙점 덩이 2 (+ 변주 칸 잔돌 1)(밝은 머리·그늘)."""
    return _grid(('dirt', s), lambda: _dirt_grid(s))[ly % 16][lx % 16]


FOOT = [['.3.', '343', '454', '.5.'], ['3.', '43', '45', '5.'], ['.3', '34', '54', '.5']]     # 발자국: 북쪽 벽 그늘·남쪽 테 빛


def _path_grid(s):
    import random
    r = random.Random(5200 + s)
    g = [[None] * 16 for _ in range(16)]
    for y in range(16):
        for x in range(16):
            n = sm(x, y, s)
            t = 5 - (1 if n < 0.2 else 0)                # 흙(3 둘레)보다 두 단 밝아야 길이 흙 바탕에서 읽힌다
            q = rnd(x, y, s + 43)
            if q < 0.12: t += 1
            elif q < 0.24: t -= 1
            g[y][x] = ('dirt', max(2, min(6, t)))
    pos = [(2, 3), (9, 1), (5, 10), (12, 9)]
    r.shuffle(pos)
    _stamp(g, pos[0][0], pos[0][1], FOOT[s % 3], 'dirt'); _stamp(g, pos[0][0] + 3, pos[0][1] + 2, FOOT[(s + 1) % 3], 'dirt')
    _stamp(g, pos[2][0], pos[2][1], PEBBLE[(s + 1) % 4], 'dirt'); _stamp(g, pos[3][0], pos[3][1], PEBBLE[(s + 3) % 4], 'dirt')
    _stamp(g, (pos[3][0] + 6) % 16, (pos[3][1] + 4) % 16, CLOD[s % 4], 'dirt')
    return g


def p_path(lx, ly, s=2):
    """2판 밟힌 흙길: 흙보다 한 단 밝은 몸 + 낱알 + 발자국 한 쌍·잔돌 둘·흙점."""
    return _grid(('path', s), lambda: _path_grid(s))[ly % 16][lx % 16]


GTUFT = [['.5.5.', '54545', '43434', '.212.'], ['5.5', '444', '323', '.1.'], ['.55', '545', '434', '21.']]   # 풀 포기: 잎끝 빛·밑동 그늘
GDARK = [['..222..', '.22222.', '2222122', '.22222.', '..2.2..'], ['.2222..', '2222222', '2212222', '.22222.', '...22..'],
         ['..22...', '.22222.', '2221222', '.22222.', '..222..']]              # 짙은 풀 덩이(그늘 고인 곳) — 3판: 크게(7×5)


def _grass_grid(s):
    import random
    r = random.Random(6300 + s)
    g = [[None] * 16 for _ in range(16)]
    for y in range(16):
        for x in range(16):
            # 3판: 1판 풀잎 쌍(9%)이 2배에서 시끄러웠다 — 잎 쌍을 5%로, 얼룩은 한 단만
            n = sm(x, y, s)
            t = 3 + (1 if n > 0.7 else 0) - (1 if n < 0.28 else 0)
            if rnd(x, y, s + 7) < 0.05: t = min(5, t + 2)
            elif rnd(x, (y - 1) % 16, s + 7) < 0.05: t = max(1, t - 1)
            g[y][x] = ('grass', t)
            if rnd(x, y, s + 21) < 0.004: g[y][x] = ('bloom', 2)
    gx, gy = r.randrange(16), r.randrange(16)
    _stamp(g, gx, gy, GDARK[s % 3], 'grass')
    for k in range(2): _stamp(g, (gx + 8 + 3 * k) % 16, (gy + 7 + 4 * k) % 16, GTUFT[(k + s) % 3], 'grass')
    return g


def p_grass(lx, ly, s=3):
    """2판 풀밭: 1판 풀잎 결 + 큰 짙은 풀 덩이 1 + 풀 포기 2(잎끝 빛 · 밑동 그늘)."""
    return _grid(('grass', s), lambda: _grass_grid(s))[ly % 16][lx % 16]



PAINT = dict(dirt=p_dirt, path=p_path, grass=p_grass, fern=p_fern, stone=p_stone, gravel=p_gravel, ash=p_ash, crust=p_crust,
             mud=p_mud, swamp=p_swamp, water=p_water, lava=p_lava)


def tile(c, fn, **kw):
    c.F(0, 0, 16, 16, lambda wx, wy, i, j: fn(i, j, **kw) if kw else fn(i, j))


# ═══════════════════════ 한 칸 바닥 ═══════════════════════
SINGLE = [
    ('dirt', '다진 흙(마을 바닥)', ['흙', '마을', '바닥'], '마을·빈터 바닥. 넓게 칠한다.', p_dirt, {}),
    ('dirt-b', '다진 흙(변주)', ['흙', '바닥'], '흙 사이에 덩이로 섞는다.', p_dirt, dict(s=13)),
    ('path', '밟힌 흙길', ['길', '흙길'], '움집 문 앞과 모닥불 광장을 잇는 길.', p_path, {}),
    ('grass', '원시 풀밭', ['풀', '들'], '마을 밖 들판. 흙과 맞닿는 곳은 w-grass 가장자리를 쓴다.', p_grass, {}),
    ('grass-b', '원시 풀밭(변주)', ['풀'], '풀밭 사이에 덩이로 섞는다.', p_grass, dict(s=17)),
    ('fern', '고사리 덮인 바닥', ['고사리', '정글', '숲'], '정글·숲 바닥. 흙과 맞닿으면 w-fern 가장자리.', p_fern, {}),
    ('stone', '평평한 암반', ['바위', '암반'], '동굴 앞·제단·바위 언덕 바닥.', p_stone, {}),
    ('gravel', '자갈밭', ['자갈'], '물가·화석 발굴터.', p_gravel, {}),
    ('ash', '화산재 바닥', ['화산', '재'], '화산 골짜기 바닥.', p_ash, {}),
    ('crust', '굳은 용암 판(빛나는 틈)', ['화산', '용암'], '용암 웅덩이 둘레. 걸을 수 있다.', p_crust, {}),
    ('mud', '진흙', ['늪', '진흙'], '늪 가장자리 바닥. 걸을 수 있다.', p_mud, {}),
    ('stone-b', '평평한 암반(변주)', ['바위', '암반'], '암반 사이에 덩이로 섞는다.', p_stone, dict(s=23)),
    ('path-b', '밟힌 흙길(변주)', ['길', '흙길'], '흙길 사이에 섞는다.', p_path, dict(s=25)),
    ('mud-b', '진흙(변주)', ['늪', '진흙'], '진흙 사이에 덩이로 섞는다.', p_mud, dict(s=19)),
    ('ash-b', '화산재 바닥(변주)', ['화산', '재'], '재 사이에 덩이로 섞는다.', p_ash, dict(s=21)),
]
for id_, nm, tg, rl, fn, kw in SINGLE:
    R.add(id_, nm, 1, 1, 'terrain', tags=tg, rules=rl)(lambda c, fn=fn, kw=kw: tile(c, fn, **kw))

# 움직이는 물(3프레임) — 첫 프레임 = 정지 그림
ANIM = []
for base, nm, fn, tg, rl in (('swamp', '늪 물', p_swamp, ['늪', '물'], '늪 웅덩이. 걸을 수 없다. 둑은 w-swamp 가장자리(진흙).'),
                             ('water', '맑은 물(강·웅덩이)', p_water, ['물', '강'], '강·웅덩이. 걸을 수 없다. 둑은 w-water 가장자리(흙).'),
                             ('lava', '용암', p_lava, ['용암', '화산'], '용암 웅덩이. 걸을 수 없다. 둑은 w-lava 가장자리(굳은 용암).')):
    ids = []
    for fr in range(3):
        i = base if fr == 0 else '%s-f%d' % (base, fr)
        R.add(i, nm + ('' if fr == 0 else ' (프레임 %d)' % (fr + 1)), 1, 1, 'terrain', tags=tg, rules=rl)(lambda c, fn=fn, fr=fr: tile(c, fn, f=fr))
        ids.append(i)
    ANIM.append((base, nm, ids, 3 if base != 'lava' else 2))


# ═══════════════════════ 꼭짓점 왕 가장자리 ═══════════════════════
# (쌍 이름, 안 재질, 밖 재질, 모양 raised|sunken|flat, 이름)
PAIRS = [
    ('grass', 'grass', 'dirt', 'raised', '풀밭 ↔ 흙'),
    ('fern', 'fern', 'dirt', 'raised', '고사리 ↔ 흙'),
    ('mud', 'mud', 'dirt', 'flat', '진흙 ↔ 흙'),
    ('ash', 'ash', 'dirt', 'flat', '화산재 ↔ 흙'),
    ('stone', 'stone', 'grass', 'raised', '암반 ↔ 풀'),
    ('swamp', 'swamp', 'mud', 'sunken', '늪 물 ↔ 진흙 둑'),
    ('water', 'water', 'dirt', 'sunken', '맑은 물 ↔ 흙 둑'),
    ('lava', 'lava', 'crust', 'sunken', '용암 ↔ 굳은 용암 둑'),
    ('crust', 'crust', 'ash', 'flat', '굳은 용암 판 ↔ 화산재'),
]
BANK = dict(swamp=('mud', 1, 2), water=('dirt', 1, 2), lava=('basalt', 0, 1))   # 꺼진 웅덩이 북쪽 둑 벽(재질, 아래 단, 위 단)
CORNER_KEYS = [k for k in ('%d%d%d%d' % (a, b, c, d) for a in (0, 1) for b in (0, 1) for c in (0, 1) for d in (0, 1)) if k not in ('0000', '1111')]


def wang_mask(key, s=0):
    """16×16 불리언(안 = True). key = NW NE SW SE."""
    nw, ne, sw, se = (int(ch) for ch in key)
    m = [[False] * 16 for _ in range(16)]
    for y in range(16):
        for x in range(16):
            u, v = (x + 0.5) / 16, (y + 0.5) / 16
            val = nw * (1 - u) * (1 - v) + ne * u * (1 - v) + sw * (1 - u) * v + se * u * v
            # 경계 잡음: 가장자리(0·15)에서 0 이 되게 줄여 이웃 칸과 이어 붙는다
            edge = min(x, 15 - x, y, 15 - y) / 4.0
            # 2판: 4px 잡음을 키우고 2px 잡음을 더해 경계가 곧은 곡선으로 끊기지 않게(화풍 정렬 — 「딱딱한 가장자리」)
            val += ((vn(x, y, 4, 77 + s) - 0.5) * 0.46 + (vn(x, y, 2, 79 + s) - 0.5) * 0.22) * min(1.0, edge)
            m[y][x] = val > 0.5
    return m


def wang(c, pair, key):
    pid, a, b, shape, _ = next(p for p in PAIRS if p[0] == pair)
    fa, fb = PAINT[a], PAINT[b]
    m = wang_mask(key)
    ins = lambda x, y: 0 <= x < 16 and 0 <= y < 16 and m[y][x]
    for y in range(16):
        for x in range(16):
            mat, t = fa(x, y) if m[y][x] else fb(x, y)
            c.P(x, y, mat, t)
    for y in range(16):
        for x in range(16):
            if shape == 'raised':
                # 솟은 덩이: 남쪽 경계 밖 바탕 1~2px 그늘, 경계 안 남쪽 끝 한 줄 어둡게, 북·서쪽 끝 밝게
                if not m[y][x] and y > 0 and m[y - 1][x]:
                    g = c.get(x, y); c.P(x, y, g[0], max(0, g[1] - 2))
                    if y + 1 < 16 and not m[y + 1][x]: g = c.get(x, y + 1); c.P(x, y + 1, g[0], max(0, g[1] - 1))
                elif m[y][x] and y < 15 and not m[y + 1][x]:
                    g = c.get(x, y); c.P(x, y, g[0], max(0, g[1] - 1))
                elif m[y][x] and ((y > 0 and not m[y - 1][x]) or (x > 0 and not m[y][x - 1])):
                    g = c.get(x, y); c.P(x, y, g[0], g[1] + 1)
                elif not m[y][x] and x > 0 and m[y][x - 1]:
                    g = c.get(x, y); c.P(x, y, g[0], max(0, g[1] - 1))
            elif shape == 'sunken':
                bm, lo, hi = BANK[pair]
                # 꺼진 웅덩이: 북쪽 둑 = 웅덩이 위 경계에서 웅덩이 안쪽 두 줄이 둑 벽(어두운 앞면), 그 아래 한 줄 물 그늘
                if m[y][x] and y > 0 and not m[y - 1][x]: c.P(x, y, bm, hi)
                elif m[y][x] and y > 1 and not m[y - 2][x] and m[y - 1][x]: c.P(x, y, bm, lo)
                elif m[y][x] and y > 2 and not m[y - 3][x]:
                    g = c.get(x, y); c.P(x, y, g[0], max(0, g[1] - 1))
                # 남쪽 둑: 웅덩이 아래 경계의 바탕 한 줄 밝은 둑머리
                elif not m[y][x] and y > 0 and m[y - 1][x]:
                    g = c.get(x, y); c.P(x, y, g[0], g[1] + 1)
                # 옆 둑: 웅덩이 왼·오른쪽 경계 안 한 칸 어둡게
                elif m[y][x] and ((x > 0 and not m[y][x - 1]) or (x < 15 and not m[y][x + 1])):
                    g = c.get(x, y); c.P(x, y, g[0], max(0, g[1] - 1))
                if pair == 'lava' and m[y][x] and not (y > 0 and not m[y - 1][x]) and not (y > 1 and not m[y - 2][x]):
                    # 둑 바로 옆 용암은 식어서 어둡다
                    if (x > 0 and not m[y][x - 1]) or (x < 15 and not m[y][x + 1]) or (y < 15 and not m[y + 1][x]): c.P(x, y, 'lava', 1)
            else:  # flat: 경계에 섞이는 점
                if m[y][x] and any(not ins(x + dx, y + dy) and 0 <= x + dx < 16 and 0 <= y + dy < 16 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    if rnd(x, y, 91) < 0.5:
                        mat, t = fb(x, y); c.P(x, y, mat, t)
                    elif y < 15 and not m[y + 1][x]:
                        g = c.get(x, y); c.P(x, y, g[0], max(0, g[1] - 1))
    if pid in ('grass', 'fern'):
        _blades(c, m, a)


def _blades(c, m, mat):
    """2판 풀 결(화풍 정렬): 풀 덩이 가장자리가 매끈한 곡선으로 끊기지 않게, 북·옆 경계 밖으로 잎끝이 삐져나오고
    남쪽 앞 테는 짙은 잎이 그늘 위로 늘어진다. 칸 맨 끝 줄·열에는 찍지 않는다(이웃 칸과 이음새)."""
    tip, mid, dark = (5, 4, 2) if mat == 'grass' else (5, 4, 2)
    ins = lambda x, y: 0 <= x < 16 and 0 <= y < 16 and m[y][x]
    for y in range(1, 15):
        for x in range(1, 15):
            if m[y][x]: continue
            q = rnd(x, y, 131)
            if ins(x, y + 1):                                   # 북쪽 경계 바로 위: 잎끝
                if q < 0.5:
                    c.P(x, y, mat, mid)
                    if q < 0.18 and y > 1 and not ins(x, y - 1): c.P(x, y - 1, mat, tip)
            elif ins(x - 1, y) or ins(x + 1, y):                # 옆 경계: 비스듬한 잎
                if q < 0.35: c.P(x, y, mat, mid - 1)
            elif ins(x, y - 1) and q < 0.45:                    # 남쪽 앞 테 밑: 늘어진 짙은 잎(그늘 위)
                c.P(x, y, mat, dark)


for pid, a, b, shape, nm in PAIRS:
    for key in CORNER_KEYS:
        R.add('w-%s-%s' % (pid, key), '%s 가장자리(%s)' % (nm, key), 1, 1, 'terrain', tags=['가장자리', a, b], rules='구성기가 꼭짓점 격자로 고른다(NW NE SW SE).',
              wang=pid)(lambda c, pid=pid, key=key: wang(c, pid, key))


# ═══════════════════════ 흙길 테(2판, lane-<N E S W>) ═══════════════════════
# 1판 흙길은 칸 경계에서 네모로 딱 끊겼다. 이어지지 않는 변은 칸 끝에서 2~4화소 안쪽에 손으로 흔든 테로 끝나고,
# 그 바깥은 다진 흙이다. 테의 양 끝(칸 모서리)은 늘 3화소라 같은 변을 가진 이웃 길 칸과 이어진다.
# 북쪽 테 = 둑 그늘(어두운 두 줄), 남쪽 테 = 빛 받는 둑머리(바깥 흙 한 줄 밝게), 동·서 테 = 한 단 어둡게.
LANE_KEYS = ['%d%d%d%d' % (n, e, s_, w) for n in (0, 1) for e in (0, 1) for s_ in (0, 1) for w in (0, 1) if (n, e, s_, w) != (1, 1, 1, 1)]


def _wob(u, side):
    import math
    base = math.sin(math.pi * u / 15.0)
    v = vn(u, side * 5, 4, 300 + side)
    return int(round(base * (v - 0.5) * 3.2))      # 양 끝 0, 가운데 -1~+1(+ = 길이 좁아짐)


def lane_mask(key):
    n, e, s_, w = (ch == '1' for ch in key)
    def inside(x, y):
        if not (0 <= x < 16 and 0 <= y < 16): return True
        if not n and y < 3 + _wob(x, 0): return False
        if not s_ and y > 12 - _wob(x, 2): return False
        if not w and x < 3 + _wob(y, 3): return False
        if not e and x > 12 - _wob(y, 1): return False
        return True
    return inside


def lane(c, key):
    ins = lane_mask(key)
    for y in range(16):
        for x in range(16):
            if ins(x, y):
                mat, t = p_path(x, y)
                up, dn, lf, rt = ins(x, y - 1), ins(x, y + 1), ins(x - 1, y), ins(x + 1, y)
                if not up: t = 2
                elif not ins(x, y - 2): t = min(t, 3)
                elif not lf: t = min(t, 4)
                c.P(x, y, mat, t)
            else:
                mat, t = p_dirt(x, y)
                if y > 0 and ins(x, y - 1) and mat == 'dirt': t = 5          # 남쪽 둑머리 빛
                c.P(x, y, mat, t)


for key in LANE_KEYS:
    R.add('lane-' + key, '흙길 테(이어진 변 %s)' % key, 1, 1, 'terrain', tags=['길', '흙길', '가장자리'],
          rules='구성기가 길 칸의 네 이웃(N E S W, 1 = 길로 이어짐)으로 고른다.', lane=key)(lambda c, key=key: lane(c, key))


# ═══════════════════════ 가장자리 조립 표본(관문용) ═══════════════════════
def swatch_grid():
    """모든 14 조합이 나오는 꼭짓점 격자(9×7) — 둥근 덩이 두 개 + 띠. 고정."""
    V = ['00000000000',
         '00111000000',
         '01111100110',
         '01111101111',
         '00111001111',
         '00010000110',
         '01000110010',
         '10001111001',
         '00000000000']
    return [[int(ch) for ch in row] for row in V]


def swatch(pid):
    """쌍 pid 의 가장자리 칸을 꼭짓점 격자대로 이어 붙인 지형 그림(10×8칸) + 칸 자리 목록."""
    pr = next(p for p in PAIRS if p[0] == pid)
    V = swatch_grid(); H, W = len(V) - 1, len(V[0]) - 1
    c = C(W * 16, H * 16); places = []
    full_in = R.render(R.by[pr[1]]); full_out = R.render(R.by[pr[2] if pr[2] in R.by else 'dirt'])
    for ty in range(H):
        for tx in range(W):
            key = '%d%d%d%d' % (V[ty][tx], V[ty][tx + 1], V[ty + 1][tx], V[ty + 1][tx + 1])
            if key == '0000': src = full_out
            elif key == '1111': src = full_in
            else:
                src = R.render(R.by['w-%s-%s' % (pid, key)]); places.append(dict(id='w-%s-%s' % (pid, key), x=tx * 16, y=ty * 16))
            c.paste(src, tx * 16, ty * 16)
    return c, places


LANE_GRID = ['0000000000000000000',
             '0111001110100010010',
             '0010001010110110110',
             '0000001110100000010',
             '0100000000000100000',
             '0000000000001110000',
             '0000000000000000000']


def lane_swatch():
    """흙길 테 15칸이 모두 나오는 길 그물(흙 바탕). 1 = 길."""
    G = LANE_GRID; H, W = len(G), len(G[0])
    on = lambda x, y: 0 <= y < H and 0 <= x < W and G[y][x] == '1'
    c = C(W * 16, H * 16); places = []
    for y in range(H):
        for x in range(W):
            if on(x, y):
                key = ''.join('1' if on(x + dx, y + dy) else '0' for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)))
                iid = 'path' if key == '1111' else 'lane-' + key
                if key != '1111': places.append(dict(id=iid, x=x * 16, y=y * 16))
            else: iid = 'dirt'
            c.paste(R.render(R.by[iid]), x * 16, y * 16)
    missing = set('lane-' + k for k in LANE_KEYS) - {p['id'] for p in places}
    assert not missing, ('길 표본에 빠진 조합', missing)
    return c, places


def export_swatches():
    d = os.path.join(OUT, 'terrain', '_gate_assembled'); os.makedirs(d, exist_ok=True)
    man, rows = {}, []
    from px import save
    for pid, a, b, shape, nm in PAIRS:
        c, places = swatch(pid)
        png = os.path.join(d, 'ph-swatch-%s.png' % pid); save(c, png)
        man[pid] = dict(png=os.path.relpath(png, os.path.join(OUT, '..', '..')), parts=places)
        rows.append(dict(png=os.path.basename(png), kind='terrain', name='%s ground edge transition patch' % nm, label='prehistoric/ph-swatch-' + pid))
        missing = set('w-%s-%s' % (pid, k) for k in CORNER_KEYS) - {p['id'] for p in places}
        assert not missing, ('표본에 빠진 조합', pid, missing)
    c, places = lane_swatch()
    png = os.path.join(d, 'ph-swatch-lane.png'); save(c, png)
    man['lane'] = dict(png=os.path.relpath(png, os.path.join(OUT, '..', '..')), parts=places)
    rows.append(dict(png=os.path.basename(png), kind='terrain', name='trodden dirt footpath network on packed earth ground', label='prehistoric/ph-swatch-lane'))
    json.dump(man, open(os.path.join(d, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
    with open(os.path.join(d, 'items.jsonl'), 'w') as f:
        for r in rows: f.write(json.dumps(r, ensure_ascii=False) + '\n')
    return man


if __name__ == '__main__':
    rows = R.export()
    # 낱칸 관문 목록에서 가장자리 칸은 뺀다(조립 표본이 덮는다)
    d = os.path.join(OUT, 'terrain', '_gate')
    with open(os.path.join(d, 'items.jsonl'), 'w') as f:
        for r in rows:
            if not r['png'].startswith(('ph-w-', 'ph-lane-')): f.write(json.dumps(r, ensure_ascii=False) + '\n')
    man = export_swatches()
    ims = []
    for it in R.items:
        if it['id'].startswith(('w-', 'lane-')): continue
        im = R.render(it).img()
        from PIL import Image
        t = Image.new('RGBA', (48, 48))
        for a in range(3):
            for b in range(3): t.paste(im, (a * 16, b * 16))
        ims.append((it['id'], t))
    for pid in man:
        ims.append(('swatch-' + pid, (lane_swatch() if pid == 'lane' else swatch(pid))[0].img()))
    contact(ims, os.path.join(OUT, 'terrain', 'preview.png'), z=3, W=1900)
    print(len(rows), 'terrain pieces,', len(man), 'swatches')
