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


def p_dirt(lx, ly, s=1):
    n = fbm(lx, ly, s)
    t = 3 + (1 if n > 0.62 else 0) - (1 if n < 0.34 else 0)
    r = rnd(lx, ly, s + 11)
    # 자갈: 밝은 머리 + 오른쪽 아래 그늘
    if r < 0.02: return ('stone', 5)
    if rnd(lx - 1, ly - 1, s + 11) < 0.02: return ('dirt', 1)
    if r > 0.978: return ('dirt', 5)
    if rnd(lx, ly, s + 3) < 0.06: return ('dirt', t - 1)
    return ('dirt', t)


def p_path(lx, ly, s=2):
    n = fbm(lx, ly, s)
    t = 4 + (1 if n > 0.66 else 0) - (1 if n < 0.3 else 0)
    r = rnd(lx, ly, s + 5)
    if r < 0.014: return ('stone', 4)
    if rnd(lx - 1, ly - 1, s + 5) < 0.014: return ('dirt', 2)
    if r > 0.985: return ('dirt', 3)
    return ('dirt', t)


def p_grass(lx, ly, s=3):
    n = fbm(lx, ly, s)
    t = 3 + (1 if n > 0.62 else 0) - (1 if n < 0.32 else 0)
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
    """판판한 바위 바닥: 불규칙한 판(보로노이) + 틈, 판마다 왼쪽 위 빛."""
    k, d1, d2 = vor(lx, ly, 8, s)
    if d2 - d1 < 0.9: return ('stone', 2 if h32(k, 9, s) % 3 else 3)
    ku, a1, a2 = vor(lx, ly - 1, 8, s)
    if a2 - a1 < 0.9: return ('stone', 5)
    t = 4 + (h32(k, 7, s) % 2)
    kl, b1, b2 = vor(lx - 1, ly, 8, s)
    if b2 - b1 < 0.9: t += 1
    kd, c1, c2 = vor(lx, ly + 1, 8, s)
    if c2 - c1 < 0.9: t -= 1
    if fbm(lx, ly, s + 11) > 0.66: t -= 1
    if rnd(lx, ly, s + 3) < 0.05: t -= 1
    return ('stone', max(2, min(6, t)))


def p_gravel(lx, ly, s=6):
    k, d1, d2 = vor(lx, ly, 22, s)
    if d2 - d1 < 0.8: return ('dirt', 2)
    t = 3 + h32(k, 1, s) % 3
    kd, c1, c2 = vor(lx, ly + 1, 22, s)
    if c2 - c1 < 0.8: t -= 1
    ku, a1, a2 = vor(lx, ly - 1, 22, s)
    if a2 - a1 < 0.8: t += 1
    return ('stone', max(2, min(6, t)))


def p_ash(lx, ly, s=7):
    n = fbm(lx, ly, s)
    t = 2 + (1 if n > 0.58 else 0) - (1 if n < 0.3 else 0)
    r = rnd(lx, ly, s + 2)
    if r < 0.03: return ('basalt', 2)
    if rnd(lx - 1, ly, s + 2) < 0.03: return ('ash', 1)
    if r > 0.975: return ('ash', 4)
    return ('ash', t)


def p_crust(lx, ly, s=8):
    """굳은 용암 판: 현무암 판(보로노이) 사이 틈이 붉게 빛난다."""
    k, d1, d2 = vor(lx, ly, 3, s)
    if d2 - d1 < 0.7: return ('lava', 2 if rnd(lx, ly, s) < 0.7 else 3)
    if d2 - d1 < 1.6: return ('basalt', 1)
    t = 3 + (h32(k, 5, s) % 2)
    ku, a1, a2 = vor(lx, ly - 1, 3, s)
    if a2 - a1 < 1.6: t = 4
    if rnd(lx, ly, s + 1) < 0.06: t -= 1
    return ('basalt', t)


def p_mud(lx, ly, s=9):
    n = fbm(lx, ly, s)
    t = 3 + (1 if n > 0.64 else 0) - (1 if n < 0.36 else 0)
    if n < 0.27: return ('mud', 1)
    if n < 0.30: return ('mud', 5 if rnd(lx, ly, s + 1) < 0.6 else 2)
    if rnd(lx, ly, s + 4) < 0.05: return ('mud', t + 1)
    if rnd(lx, ly, s + 8) < 0.05: return ('mud', t - 1)
    # 젖은 물기 번들: 잡음 높은 곳 위쪽 가장자리만 밝게(칸마다 같은 자리에 찍는 거품은 격자처럼 보였다)
    if n > 0.62 and fbm(lx, ly - 1, s) <= 0.62: return ('mud', 5)
    return ('mud', t)


def p_swamp(lx, ly, s=10, f=0):
    n = fbm(lx, ly, s)
    t = 2 if n > 0.38 else 1
    for (ox, oy, ln) in ((2, 3, 4), (10, 7, 3), (5, 12, 5)):
        xx = (lx - ox - f) % 16
        if ly == oy and xx < ln: return ('swamp', 4 if xx == 1 else 3)
    # 개구리밥(작은 잎 두 화소)
    for (px_, py_) in ((12, 2), (3, 8), (13, 13)):
        if ly == py_ and lx in (px_, px_ + 1): return ('grass', 4 if lx == px_ else 3)
    return ('swamp', t)


def p_water(lx, ly, s=11, f=0):
    t = 2 + (1 if fbm(lx, ly, s) > 0.66 else 0)
    for (ox, oy, ln) in ((1, 2, 4), (9, 6, 3), (4, 10, 5), (12, 13, 3)):
        xx = (lx - ox - f * 2) % 16
        if ly == oy and xx < ln: return ('water', 4 if xx in (1, 2) else 3)
        if ly == oy + 1 and 0 < xx < ln + 1: return ('water', 1)
    return ('water', t)


def p_lava(lx, ly, s=12, f=0):
    """용암: 흐르는 밝은 줄기 + 식은 검붉은 껍질 조각(프레임마다 오른쪽 아래로 흐른다)."""
    x, y = (lx - f * 2) % 16, (ly - f) % 16
    n = fbm(x, y, s)
    if n < 0.25: return ('basalt', 2 if n > 0.2 else 1)
    if n < 0.30: return ('lava', 1)
    t = 2 + (1 if n > 0.5 else 0) + (1 if n > 0.68 else 0)
    if n > 0.74 and rnd(x, y, s + 3) < 0.3: return ('fire', 4)
    return ('lava', t)


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
            val += (vn(x, y, 4, 77 + s) - 0.5) * 0.34 * min(1.0, edge)
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


for pid, a, b, shape, nm in PAIRS:
    for key in CORNER_KEYS:
        R.add('w-%s-%s' % (pid, key), '%s 가장자리(%s)' % (nm, key), 1, 1, 'terrain', tags=['가장자리', a, b], rules='구성기가 꼭짓점 격자로 고른다(NW NE SW SE).',
              wang=pid)(lambda c, pid=pid, key=key: wang(c, pid, key))


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
            if not r['png'].startswith('ph-w-'): f.write(json.dumps(r, ensure_ascii=False) + '\n')
    man = export_swatches()
    ims = []
    for it in R.items:
        if it['id'].startswith('w-'): continue
        im = R.render(it).img()
        from PIL import Image
        t = Image.new('RGBA', (48, 48))
        for a in range(3):
            for b in range(3): t.paste(im, (a * 16, b * 16))
        ims.append((it['id'], t))
    for pid in man:
        ims.append(('swatch-' + pid, swatch(pid)[0].img()))
    contact(ims, os.path.join(OUT, 'terrain', 'preview.png'), z=3, W=1900)
    print(len(rows), 'terrain pieces,', len(man), 'swatches')
