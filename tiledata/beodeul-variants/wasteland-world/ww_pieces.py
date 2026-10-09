# 황폐 필드 새 조각(손 도트, 버들항 팔레트·px2 볼륨 페인터·pz.fin 윤곽). 모든 함수는 RGBA Image 를 돌려준다. 결정적.
# 3/4 시점: 윗면 + 앞면, 옆면 없음, 빛 왼쪽 위. 바위·고목·풀·뼈·마른 호수·생존자 야영지·고철.
import math
import numpy as np
from PIL import Image
from ww_base import C, PAL, P, RGB, R7, F, put, hash2, smooth, _hash, vnoise, blank, FIRE, shear_down


# ================================================================ 공용 획
def limb(c, pts, widths, mat='deadw', seed=1, lit=4, mid=3, dark=2):
    """가지·줄기 획(그을린 나무 limb 와 같은 식): 원 붓을 이어 그린다, 왼쪽 밝고 오른쪽 어둡다, 껍질 점."""
    c.new()
    for (x0, y0), (x1, y1), w0, w1 in zip(pts, pts[1:], widths, widths[1:]):
        n = 24
        for i in range(n + 1):
            f = i / n; x = x0 + (x1 - x0) * f; y = y0 + (y1 - y0) * f; r = w0 + (w1 - w0) * f
            for yy in range(int(y - r) - 1, int(y + r) + 2):
                for xx in range(int(x - r) - 1, int(x + r) + 2):
                    if math.hypot(xx + 0.5 - x, yy + 0.5 - y) <= r:
                        dx = (xx + 0.5 - x) / max(r, 0.5)
                        t = lit if dx < -0.35 else (dark if dx > 0.35 else mid)
                        if _hash(xx, yy, seed) > 0.88: t -= 1
                        c.tone(xx, yy, mat, max(1, t))


def _dust_on_top(c, mat, seed=1, p=0.5, tones=(4, 5)):
    """윗면(위가 비어 있는 화소)에 재·먼지가 앉는다."""
    for y in range(1, c.h):
        for x in range(c.w):
            if c.m[y][x] == mat and c.m[y - 1][x] is None and _hash(x, y, seed) < p:
                c.tone(x, y, 'dust', tones[1] if _hash(x, y, seed + 1) > 0.4 else tones[0])


def tufts(px, W, H, x0, x1, ybase, seed, dens=0.5, hmax=4):
    """밑동 마른 풀잎(초원 하이로드 _tufts 와 같은 획, 바랜 풀빛)."""
    G = R7('drygr')
    for x in range(x0, x1):
        if _hash(x, seed, 0) > dens: continue
        hgt = 1 + int(_hash(x, seed, 1) * hmax)
        lean = -1 if _hash(x, seed, 2) < 0.3 else (1 if _hash(x, seed, 2) > 0.8 else 0)
        for j in range(hgt):
            xx = x + (lean if j >= hgt - 1 and hgt > 2 else 0)
            t = 5 if j >= hgt - 1 else (4 if j > 0 else 2)
            if _hash(x, seed, 3) < 0.25: t = min(6, t + 1)
            put(px, W, H, xx, ybase - j, G[t])


def chips(px, W, H, pts, mat='rrock'):
    """잔돌 조각: (x,y,w) 작은 돌 — 윗줄 밝게, 아랫줄 어둡게."""
    S = R7(mat)
    for (x, y, w) in pts:
        for i in range(w):
            put(px, W, H, x + i, y, S[6] if i < w - 1 else S[5])
            put(px, W, H, x + i, y + 1, S[4] if i < w - 1 else S[3])
        put(px, W, H, x - 1, y + 1, S[2]); put(px, W, H, x + w, y + 1, S[1])


# ================================================================ 바위
def red_boulder():
    """붉은 사암 큰 바위(2x2): 바람에 깎인 모난 덩이, 가로 결 층, 기슭에 잔돌."""
    c = C(32, 32, seed=801); c.shadow(16, 28.8, 14, 2.4, 90)
    c.group(1)
    c.ellipsoid(16, 19, 14, 10, 'rrock', amb=0.16, bump=0.75, bsc=4.5)
    c.ellipsoid(11, 14, 7.5, 5.5, 'rrock', amb=0.2, bias=0.06, bump=0.6, bsc=3.0)
    for y in (17, 22, 25):                                                  # 퇴적 결(가로 금)
        for x in range(4, 29):
            if c.m[y][x] == 'rrock' and _hash(x, y, 81) > 0.3: c.darken(x, y + int(1.5 * math.sin(x / 4.0)), 1)
    for (x0, y0, x1, y1) in ((19, 11, 23, 18), (8, 21, 12, 24)): c.line(x0, y0, x1, y1, 'rrock', 1)
    im = F(c); px = im.load()
    chips(px, 32, 32, ((2, 28, 2), (27, 29, 2)))
    return im


def ash_boulder():
    """재 쌓인 바위(2x2): 붉은 바위 윗면마다 회색 재가 두껍게 앉았다, 앞면 기슭으로 재가 흘러내린 자국."""
    c = C(32, 32, seed=802); c.shadow(16, 28.8, 14, 2.4, 90)
    c.group(1)
    c.ellipsoid(15, 20, 13, 9, 'rrock', amb=0.16, bump=0.8, bsc=4.0, bias=-0.04)
    c.ellipsoid(20, 15, 8, 6, 'rrock', amb=0.2, bias=0.03, bump=0.6, bsc=3.0)
    for y in range(1, 32):                                                  # 윗면 재(두께 2~3px)
        for x in range(32):
            if c.m[y][x] == 'rrock' and c.m[y - 1][x] is None:
                for k in range(2 + int(_hash(x, 1, 82) * 2)):
                    if y + k < 32 and c.m[y + k][x] == 'rrock': c.tone(x, y + k, 'dust', 6 if k == 0 else (5 if k == 1 else 4))
    for x in (8, 13, 22):                                                   # 흘러내린 재 줄
        for y in range(16, 24):
            if c.m[y][x] == 'rrock' and _hash(x, y, 83) > 0.35: c.tone(x, y, 'dust', 3)
    im = F(c); px = im.load()
    for (x, y) in ((3, 28), (4, 28), (5, 29), (26, 29), (27, 29), (28, 28)): put(px, 32, 32, x, y, RGB('dust', 4))
    return im


def rock_spire():
    """바람 깎인 바위 기둥(1x2): 위가 넓고 허리가 잘록한 붉은 바위, 층마다 색이 다르다. 밑동 1칸 막힘."""
    c = C(16, 32, seed=803); c.shadow(8, 29.6, 6.5, 1.6, 90)
    c.group(1)
    for (cy, rx, ry, b) in ((26, 6.4, 3.8, -0.06), (21, 4.4, 3.2, 0.0), (16, 3.6, 3.0, 0.02), (11, 5.4, 3.4, 0.06), (6.5, 6.0, 3.2, 0.12)):
        c.ellipsoid(8, cy, rx, ry, 'rrock', amb=0.2, bump=0.5, bsc=2.4, bias=b)
    for y in (9, 14, 19, 24):
        for x in range(1, 15):
            if c.m[y][x] == 'rrock' and _hash(x, y, 84) > 0.25: c.tone(x, y, 'rrock', 2 if x > 8 else 3)
    for y in range(4, 7):
        for x in range(3, 13):
            if c.m[y][x] == 'rrock' and (c.m[y - 1][x] is None or y == 4) and _hash(x, y, 85) > 0.3: c.tone(x, y, 'dust', 5)
    return F(c)


def rock_ridge():
    """낮은 바위 등성이(3x2): 땅에서 비스듬히 솟은 붉은 지층 판 셋, 윗모에 재. 밑줄 3칸 막힘."""
    c = C(48, 32, seed=804); c.shadow(24, 29, 21, 2.4, 90)
    for (x0, x1, top, h, b) in ((3, 20, 10, 18, 0.0), (15, 34, 6, 22, 0.06), (30, 45, 13, 15, -0.04)):
        c.new()
        for x in range(x0, x1):
            f = (x - x0) / max(1, x1 - x0 - 1)
            yt = int(top + 6 * (f - 0.5) ** 2 * 4 - 3 * f) + int(_hash(x // 2, top, 86) * 2)
            for y in range(yt, top + h):
                if y < 0 or y > 30: continue
                if y < yt + 2: v = 0.98 + b
                else: v = 0.62 - 0.3 * f + b - 0.12 * (y - yt) / h
                c.setv(x, y, 'rrock', v)
        for y in range(top + 4, top + h, 4):
            for x in range(x0 + 1, x1 - 1):
                if c.m[y][x] == 'rrock' and _hash(x, y, 87) > 0.35: c.darken(x, y, 1)
    _dust_on_top(c, 'rrock', seed=88, p=0.6)
    im = F(c); px = im.load()
    chips(px, 48, 32, ((1, 29, 2), (44, 29, 2), (21, 30, 2)))
    return im


def rocks_small():
    """잔 붉은 돌(1칸 장식, 걷기)."""
    c = C(16, 16, seed=805)
    for (cx, cy, rx, ry) in ((4, 11, 3.0, 2.2), (11, 12, 3.4, 2.4), (8, 8, 2.2, 1.7), (13, 7, 1.6, 1.3)):
        c.new(); c.ellipsoid(cx, cy, rx, ry, 'rrock', amb=0.22, bump=0.4)
    return F(c)


def dust_mound():
    """재·먼지 둔덕(2x1 장식, 걷기): 바람에 쌓인 회색 재 더미, 바람 맞은 결."""
    c = C(32, 16, seed=806)
    c.group(1)
    c.ellipsoid(16, 11, 14, 4.4, 'dust', amb=0.30, bump=0.35, bsc=3.0, bias=0.06)
    c.ellipsoid(11, 9.5, 7, 3.0, 'dust', amb=0.34, bump=0.3, bias=0.12)
    for (x0, x1, y) in ((6, 12, 9), (16, 24, 10), (9, 15, 12)):
        for x in range(x0, x1):
            if c.m[y][x]: c.tone(x, y, 'dust', 3)
    return F(c, 0.78)


# ================================================================ 죽은 숲 (검붉은 고목)
def dead_tree_a():
    """잎 없는 검붉은 고목(2x3): 비틀린 줄기, 위로 갈라진 앙상한 가지, 가지 윗면에 재, 밑동에 바랜 풀."""
    c = C(32, 48, seed=821); c.shadow(16, 45.6, 9, 2.0, 90)
    limb(c, [(16, 47), (16, 38), (14, 28), (16, 18), (15, 8)], [3.8, 3.0, 2.4, 1.8, 1.0], 'deadw', 3)
    limb(c, [(15, 31), (9, 25), (5, 18), (3, 12)], [1.9, 1.4, 1.0, 0.6], 'deadw', 4)
    limb(c, [(9, 25), (4, 25), (1, 21)], [0.9, 0.7, 0.5], 'deadw', 41)
    limb(c, [(16, 24), (22, 19), (26, 12), (29, 7)], [1.8, 1.3, 0.9, 0.5], 'deadw', 5)
    limb(c, [(22, 19), (28, 18), (30, 15)], [0.9, 0.6, 0.5], 'deadw', 42)
    limb(c, [(16, 16), (20, 11), (21, 4)], [1.0, 0.7, 0.5], 'deadw', 6)
    limb(c, [(5, 18), (8, 13)], [0.7, 0.4], 'deadw', 7)
    limb(c, [(14, 46), (9, 47)], [1.4, 0.7], 'deadw', 8); limb(c, [(18, 46), (23, 47)], [1.4, 0.7], 'deadw', 9)
    for (x, y) in ((15, 36), (16, 37), (15, 37)): c.tone(x, y, 'abyss', 1)                    # 옹이 구멍
    c.tone(14, 36, 'deadw', 6)
    _dust_on_top(c, 'deadw', seed=9, p=0.45)
    im = F(c); px = im.load()
    tufts(px, 32, 48, 8, 25, 47, 21, 0.55, 4)
    return im


def dead_tree_big():
    """큰 검붉은 고목(3x4): 굵게 뒤틀린 줄기가 위에서 셋으로 갈라졌다, 드러난 뿌리, 줄기 갈라진 틈, 가지 끝은 부러졌다."""
    c = C(48, 64, seed=822); c.shadow(24, 61.5, 15, 2.8, 100)
    limb(c, [(24, 63), (23, 51), (25, 40), (24, 30), (22, 20)], [5.6, 4.4, 3.6, 3.0, 2.2], 'deadw', 3)
    limb(c, [(24, 37), (15, 31), (9, 22), (6, 14), (4, 8)], [2.6, 2.0, 1.5, 1.0, 0.6], 'deadw', 4)
    limb(c, [(25, 33), (33, 27), (39, 19), (43, 11)], [2.5, 1.9, 1.3, 0.8], 'deadw', 5)
    limb(c, [(22, 21), (18, 13), (18, 5)], [1.6, 1.1, 0.7], 'deadw', 6)
    limb(c, [(23, 23), (29, 15), (30, 7)], [1.3, 0.9, 0.6], 'deadw', 7)
    limb(c, [(9, 22), (15, 17)], [0.9, 0.5], 'deadw', 8)
    limb(c, [(39, 19), (35, 13)], [0.8, 0.5], 'deadw', 9)
    limb(c, [(6, 14), (2, 10)], [0.6, 0.4], 'deadw', 10)
    limb(c, [(21, 61), (14, 63)], [1.8, 0.8], 'deadw', 11); limb(c, [(27, 61), (35, 63)], [1.8, 0.8], 'deadw', 12)
    for y in range(44, 57): c.tone(24 + (y % 3 == 0), y, 'abyss', 1)            # 줄기 갈라진 틈
    for (x, y) in ((18, 5), (30, 7), (43, 11), (4, 8)): c.tone(x, y, 'deadw', 6)    # 부러진 끝 속살
    _dust_on_top(c, 'deadw', seed=13, p=0.45)
    im = F(c); px = im.load()
    tufts(px, 48, 64, 11, 37, 63, 22, 0.5, 5)
    return im


def dead_tree_lean():
    """기운 고목(2x3): 땅이 갈라지며 오른쪽으로 기운 줄기, 들린 뿌리, 꼭대기는 쪼개져 부러졌다."""
    c = C(32, 48, seed=823); c.shadow(16, 45.4, 10, 2.0, 80)
    limb(c, [(13, 47), (14, 38), (17, 29), (21, 20), (24, 13)], [3.4, 2.8, 2.3, 1.9, 1.6], 'deadw', 3)
    limb(c, [(17, 29), (11, 22), (8, 15), (7, 9)], [1.4, 1.1, 0.8, 0.5], 'deadw', 4)
    limb(c, [(21, 20), (27, 21), (31, 18)], [1.0, 0.7, 0.5], 'deadw', 5)
    limb(c, [(15, 35), (8, 33), (4, 29)], [1.1, 0.8, 0.5], 'deadw', 6)
    limb(c, [(11, 46), (5, 47)], [1.6, 0.8], 'deadw', 7); limb(c, [(10, 44), (6, 41), (4, 43)], [1.2, 0.8, 0.6], 'deadw', 8)   # 들린 뿌리
    for (x, y) in ((23, 12), (25, 12), (24, 11), (26, 13)): c.tone(x, y, 'deadw', 6)
    c.tone(24, 10, 'deadw', 5); c.tone(22, 11, 'deadw', 4)
    _dust_on_top(c, 'deadw', seed=14, p=0.45)
    im = F(c); px = im.load()
    for x in range(6, 22): put(px, 32, 48, x, 47, RGB('rdirt', 1) if 8 < x < 18 else RGB('rdirt', 2))   # 뿌리 밑 갈라진 흙
    tufts(px, 32, 48, 17, 28, 47, 23, 0.55, 3)
    return im


def dead_snag():
    """부러진 고목 줄기(1x2): 허리에서 꺾여 쪼개진 끝만 남았다."""
    c = C(16, 32, seed=824); c.shadow(8, 29.6, 5.5, 1.4, 80)
    limb(c, [(8, 30), (8, 22), (7, 13)], [3.4, 3.0, 2.6], 'deadw', 3)
    c.new()
    for (x, y) in ((5, 11), (6, 10), (7, 12), (8, 8), (9, 11), (10, 12)): c.tone(x, y, 'deadw', 4)
    for (x, y) in ((6, 12), (8, 10), (9, 12)): c.tone(x, y, 'deadw', 6)
    _dust_on_top(c, 'deadw', seed=15, p=0.4)
    limb(c, [(5, 29), (2, 31)], [1.2, 0.6], 'deadw', 16)
    im = F(c); px = im.load()
    tufts(px, 16, 32, 2, 14, 31, 24, 0.5, 3)
    return im


def dead_log():
    """쓰러진 고목 통나무(2x1): 껍질이 갈라진 검붉은 통나무, 잘린 끝 나이테가 바랬다, 윗면에 재."""
    c = C(32, 16, seed=825); c.shadow(16, 13.6, 14, 1.6, 70)
    c.new(); c.hcyl(4, 28, 9, 4.4, 'deadw', amb=0.25, endcap='L', capmat='oldwood')
    im = F(c); px = im.load()
    for (x, y) in ((10, 5), (16, 5), (22, 6), (13, 5), (25, 5)): put(px, 32, 16, x, y, RGB('dust', 5))
    for x in range(9, 27, 5): put(px, 32, 16, x, 9, RGB('deadw', 1)); put(px, 32, 16, x + 1, 10, RGB('deadw', 1))
    return im


def dead_stump():
    """고목 그루터기(1칸): 윗면 나이테가 바랜 그루터기, 껍질이 벗겨졌다."""
    c = C(16, 16, seed=826); c.shadow(8, 13.4, 6, 1.4, 70)
    c.new(); c.cylinder(8, 7, 13, 5.0, 'deadw', cap=True, capry=2.6, amb=0.3)
    im = F(c); px = im.load()
    for (x, y, t) in ((6, 7, 4), (8, 6, 5), (10, 7, 4), (8, 8, 3), (7, 7, 5), (9, 7, 5)): put(px, 16, 16, x, y, RGB('oldwood', t))
    put(px, 16, 16, 8, 7, RGB('oldwood', 2))
    return im


def dead_bramble():
    """마른 가시덤불(2x1): 잎 하나 없는 가시 가지가 얽힌 낮은 덩이. 1줄 막힘."""
    c = C(32, 16, seed=827); c.shadow(16, 14, 14, 1.6, 70)
    rng = np.random.default_rng(827)
    for i in range(16):
        x0 = 6 + rng.uniform(0, 20); y0 = 15
        a = math.pi * (0.15 + 0.7 * rng.uniform())
        L = rng.uniform(6, 12)
        pts = [(x0, y0)]
        for k in range(3):
            a += rng.uniform(-0.5, 0.5)
            pts.append((pts[-1][0] - math.cos(a) * L / 3, pts[-1][1] - math.sin(a) * L / 3))
        limb(c, pts, [0.9, 0.7, 0.5, 0.4], 'deadw', 30 + i, lit=4, mid=3, dark=2)
    _dust_on_top(c, 'deadw', seed=17, p=0.25)
    im = F(c, 0.7); px = im.load()
    for i in range(10):                                                     # 가시
        x = int(4 + _hash(i, 1, 87) * 24); y = int(4 + _hash(i, 2, 87) * 9)
        if px[x, y][3] and not px[x + 1, y][3]: put(px, 32, 16, x + 1, y, RGB('deadw', 5))
    return im


def bleached_grass():
    """바랜 마른 풀 포기(1칸 장식, 걷기)."""
    c = C(16, 16, seed=828)
    for (x, h, dx, t0) in ((3, 6, -1, 3), (5, 8, 1, 4), (7, 5, 0, 4), (10, 7, 1, 4), (12, 4, -1, 3), (13, 6, 1, 3), (8, 7, -1, 5)):
        c.new()
        for k in range(h):
            xx = x + int(round(dx * k / max(1, h - 1))); yy = 14 - k
            c.tone(xx, yy, 'drygr', t0 if k < h - 2 else min(6, t0 + 1))
    return c.img(False)


def drygrass_tall():
    """키 큰 마른 풀 덤불(1칸 장식, 걷기): 이삭 달린 마른 풀대가 바람에 한쪽으로 누웠다."""
    c = C(16, 16, seed=829)
    for (x, h, dx, t0) in ((2, 9, 2, 3), (4, 12, 3, 4), (6, 10, 2, 4), (8, 13, 3, 5), (10, 9, 2, 3), (12, 11, 2, 4), (14, 7, 1, 3)):
        c.new()
        for k in range(h):
            f = k / max(1, h - 1)
            xx = x + int(round(dx * f * f)); yy = 15 - k
            c.tone(xx, yy, 'drygr', t0 if k < h - 3 else min(6, t0 + 1))
        c.tone(x + dx, 15 - h, 'drygr', 6); c.tone(x + dx + 1, 15 - h + 1, 'drygr', 5)
    return c.img(False)


# ================================================================ 마른 호수
def fish_skeleton():
    """물고기 뼈(2x1 장식, 걷기): 마른 진흙 위 머리뼈·등뼈·가시·꼬리 지느러미뼈."""
    im = blank(32, 16); px = im.load()
    B = R7('bone')
    y0 = 9
    for x in range(8, 25): put(px, 32, 16, x, y0, B[5] if x % 2 else B[4]); put(px, 32, 16, x, y0 + 1, B[2])
    for i, x in enumerate(range(10, 24, 2)):                                # 가시(위·아래)
        h = 4 - abs(i - 3) // 2
        for k in range(1, h + 1):
            put(px, 32, 16, x - k // 2, y0 - k, B[5]); put(px, 32, 16, x - k // 2, y0 + 1 + k, B[3])
    for (x, y, t) in ((3, 8, 5), (4, 7, 6), (5, 7, 6), (6, 8, 5), (7, 8, 5), (3, 9, 4), (4, 10, 4), (5, 10, 3), (6, 10, 3), (7, 9, 4), (2, 9, 3)):
        put(px, 32, 16, x, y, B[t])
    put(px, 32, 16, 5, 8, (30, 20, 16)); put(px, 32, 16, 4, 9, B[2])               # 눈구멍
    for (x, y) in ((25, 9), (26, 8), (27, 7), (28, 6), (26, 10), (27, 11), (28, 12), (27, 9), (28, 9)):   # 꼬리
        put(px, 32, 16, x, y, B[5] if y < 10 else B[3])
    for x in range(3, 29):
        if px[x, y0 + 3][3] == 0 and 8 < x < 25: put(px, 32, 16, x, y0 + 3, (60, 40, 28), 70)
    return im


def big_fish_bones():
    """거대 물고기 뼈(4x2): 진흙에 반쯤 묻힌 큰 물고기 — 왼쪽에 벌어진 턱과 이빨, 휜 등뼈, 위로 솟은 갈비뼈, 오른쪽 꼬리 지느러미뼈.
    밑줄만 막힘(갈비 사이로는 지나갈 수 없다)."""
    c = C(64, 32, seed=831); c.shadow(32, 29, 28, 2.4, 80)
    spine = [(14 + i * 3.2, 24 - math.sin(i / 14 * math.pi) * 3) for i in range(15)]
    for (x, y) in spine: c.new(); c.ellipsoid(x, y, 1.9, 1.7, 'bone', amb=0.3, bump=0.2)
    for k, bx in enumerate(range(18, 52, 4)):                              # 갈비: 위로 솟아 꼬리 쪽으로 휜다
        c.new()
        base_y = 24 - math.sin((bx - 14) / 45 * math.pi) * 3
        hgt = 14 - abs(k - 3) * 1.4
        for i in range(22):
            f = i / 21
            x = bx + f * 4 + f * f * 2; y = base_y - f * hgt
            w = 1.2 - f * 0.6
            for yy in range(int(y - w), int(y + w) + 1):
                for xx in range(int(x - w), int(x + w) + 1):
                    if math.hypot(xx + 0.5 - x, yy + 0.5 - y) <= w + 0.25: c.tone(xx, yy, 'bone', 5 if xx + 0.5 < x else 3)
    c.group(2)                                                             # 머리뼈 + 벌어진 턱
    c.ellipsoid(9, 19, 7.5, 6.0, 'bone', amb=0.25, bump=0.3, bsc=3.0)
    c.new()
    for i in range(14):
        f = i / 13; x = 3 + f * 9; y = 27 - f * 3
        for yy in range(int(y) - 1, int(y) + 2): c.tone(int(x), yy, 'bone', 4 if yy < y else 2)
    c.group(3); c.new()                                                    # 꼬리 지느러미뼈
    for (dx, dy) in ((1, -1), (1.2, -0.6), (1.3, 0), (1.2, 0.6), (1, 1)):
        for i in range(9):
            x = 58 + dx * i * 0.7; y = 22 + dy * i * 0.9
            c.tone(int(x), int(y), 'bone', 5 if dy < 0 else 3)
    c.group(9)                                                             # 진흙에 묻힌 밑
    for (x, y, rx) in ((14, 28, 9), (34, 28.5, 12), (52, 28, 9)):
        c.ellipsoid(x, y, rx, 2.4, 'mud', amb=0.35, bias=0.05, bump=0.3)
    im = F(c); px = im.load()
    for (x, y) in ((7, 16), (8, 16), (7, 17), (8, 17)): put(px, 64, 32, x, y, (34, 22, 18))   # 눈구멍
    for x in range(4, 13, 2): put(px, 64, 32, x, 23, RGB('bone', 6)); put(px, 64, 32, x, 25, RGB('bone', 5))   # 이빨
    return im


def shipwreck():
    """난파선(5x3): 물이 말라 진흙에 박힌 옛 범선 선체 — 오른쪽(고물)이 가라앉아 기울었다. 윗면 갑판 널과 선창 구멍, 부러진 돛대 밑동,
    앞면 뱃전 널(휜 줄)과 녹슨 쇠테, 이물 쪽은 널이 떨어져 갈비(늑골)가 드러났다. 몸통 아래 2줄 막힘."""
    W, H = 80, 44
    im = blank(W, H); px = im.load()
    OW = R7('oldwood'); RU = R7('rust'); AB = R7('abyss')
    x0, x1 = 4, 76
    def half(x):                                       # 선체 반폭(가운데 넓고 양끝 뾰족)
        f = (x - x0) / (x1 - x0)
        return max(0.0, math.sin(min(1, max(0, f)) * math.pi) ** 0.55)
    deck_cy = 14; deck_ry = 8.5
    hull_h = 15
    for x in range(x0, x1 + 1):
        hw = half(x)
        if hw <= 0.02: continue
        yt = deck_cy - deck_ry * hw; yb = deck_cy + deck_ry * hw          # 갑판 윗선·앞 뱃전선
        for y in range(int(yt), int(yb) + 1):                              # 갑판(널은 가로, 결)
            ly = y - yt
            if ly < 1.0: t = 2                                             # 뒤 뱃전(어둡게)
            elif ly < 2.2: t = 5
            else:
                t = 4 if (y + int(x / 22)) % 3 else 3
                if (x + y * 7) % 23 == 0: t = 2
            if y > yb - 1.5: t = 6                                         # 앞 뱃전 윗모(빛)
            put(px, W, H, x, y, OW[t])
        fb = yb + hull_h * (0.45 + 0.55 * hw)                              # 앞면(뱃전 널, 아래로 둥글게)
        for y in range(int(yb) + 1, int(fb)):
            k = (y - yb) / max(1, fb - yb)
            t = 4 if k < 0.25 else (3 if k < 0.6 else 2)
            if int((y - yb) + 3 * (1 - hw)) % 4 == 0: t = max(1, t - 1)     # 널 이음(이물·고물 쪽으로 휜다)
            if (x // 9) % 2 == 0 and _hash(x // 9, y // 4, 3) > 0.9: t = max(1, t - 1)
            put(px, W, H, x, y, OW[t])
            if int(yb) + 3 <= y <= int(yb) + 4: put(px, W, H, x, y, RU[3] if y == int(yb) + 3 else RU[2])   # 쇠테
    # 선창 구멍 + 돛대 밑동
    for y in range(9, 16):
        for x in range(30, 44):
            if ((x + 0.5 - 37) / 7.0) ** 2 + ((y + 0.5 - 12.5) / 3.6) ** 2 <= 1: put(px, W, H, x, y, AB[1] if y > 10 else OW[1])
    for y in range(4, 12):                                                 # 부러진 돛대
        for x in range(51, 55): put(px, W, H, x, y, OW[5] if x == 51 else (OW[4] if x < 54 else OW[2]))
    for (x, y) in ((51, 3), (52, 2), (53, 4), (54, 3)): put(px, W, H, x, y, OW[6])
    for x in range(49, 57): put(px, W, H, x, 12, OW[1])
    # 이물(왼쪽) 널 떨어진 곳: 늑골 드러남
    for y in range(18, 31):
        for x in range(8, 22):
            if px[x, y][3] and ((x + 0.5 - 15) / 7.0) ** 2 + ((y + 0.5 - 24) / 6.0) ** 2 <= 1:
                put(px, W, H, x, y, OW[3] if (x - 8) % 4 == 0 else AB[2 if y < 24 else 1])
    im = F(im, 0.62)
    im = shear_down(im, 0.075)                                            # 고물(오른쪽)이 가라앉는다
    im2 = blank(W, H + 6); im2.alpha_composite(im, (0, 0))
    px = im2.load()
    MU = R7('mud')                                                        # 진흙이 밑을 덮는다(오른쪽이 더 깊이)
    for x in range(W):
        top = int(36 + 4 * (x / W) + 1.2 * math.sin(x / 5.0))
        if not any(px[x, y][3] for y in range(0, H + 6)): continue
        for y in range(top, H + 6):
            k = y - top
            put(px, W, H + 6, x, y, MU[5] if k == 0 else (MU[4] if k < 3 else MU[3]))
        put(px, W, H + 6, x, top - 1, MU[1])
    return im2


def rowboat_overturned():
    """뒤집힌 거룻배(3x2): 마른 바닥에 엎어진 작은 배, 둥근 배 밑 널(윗면)과 앞 뱃전, 용골 줄, 구멍 하나."""
    c = C(48, 32, seed=833); c.shadow(24, 28.5, 21, 2.4, 90)
    c.group(1)
    for x in range(4, 45):
        f = (x - 4) / 40
        hw = math.sin(f * math.pi) ** 0.6
        ry = 9 * hw
        for y in range(int(16 - ry), int(16 + ry * 0.5) + 1):
            d = (y + 0.5 - 16) / max(1, ry)
            v = 0.95 - 0.5 * max(0, d) + 0.2 * min(0, d) - 0.15 * f
            c.setv(x, y, 'oldwood', v)
        for y in range(int(16 + ry * 0.5) + 1, int(16 + ry * 0.5 + 8 * hw) + 1):
            c.setv(x, y, 'oldwood', 0.4 - 0.1 * f)
    for x in range(6, 43):                                               # 널 줄·용골
        for yy in (11, 14, 18):
            if c.m[yy][x]: c.darken(x, yy, 1)
        if c.m[8][x] and 8 < x < 40: c.tone(x, 9, 'oldwood', 6)
    for y in range(13, 17):
        for x in range(28, 33):
            if ((x + 0.5 - 30.5) / 2.6) ** 2 + ((y + 0.5 - 15) / 1.8) ** 2 <= 1: c.tone(x, y, 'abyss', 1)
    return F(c)


def pier_posts():
    """옛 부두 말뚝(1x2): 물 빠진 바닥에 남은 굵은 나무 말뚝 둘, 위가 썩어 뭉툭하다, 녹슨 고리. 밑동 1칸 막힘."""
    c = C(16, 32, seed=834); c.shadow(8, 29.5, 7, 1.6, 80)
    c.new(); c.cylinder(5, 8, 29, 3.2, 'oldwood', cap=True, capry=1.4, amb=0.25)
    c.new(); c.cylinder(11.5, 15, 30, 2.8, 'oldwood', cap=True, capry=1.2, amb=0.25)
    for y in range(9, 29, 3): c.darken(5, y, 1); c.darken(11, y + 1, 1)
    im = F(c); px = im.load()
    for (x, y) in ((7, 14), (8, 14), (8, 15), (7, 16)): put(px, 16, 32, x, y, RGB('rust', 4 if y < 15 else 2))
    for y in range(24, 30): put(px, 16, 32, 2, y, RGB('mud', 2)); put(px, 16, 32, 3, y, RGB('mud', 3))
    return im


def pier_broken():
    """끊긴 부두(3x2): 옛 물가에서 바닥 쪽으로 뻗다 끊긴 널 부두, 널이 빠진 틈, 말뚝 위에 얹혔다. 걷기(널 위)."""
    W, H = 48, 32
    im = blank(W, H); px = im.load()
    OW = R7('oldwood')
    for y in range(4, 22):                                                  # 널 바닥(세로 널 6px)
        for x in range(2, 46):
            k = (x - 2) // 6
            if k in (3,) and y > 9: continue                                # 빠진 널
            if k == 6 and y < 10: continue
            if x > 40 and y > 14 + (x - 40): continue                       # 끝 부러짐
            t = 5 if (x - 2) % 6 == 0 else (4 if (x - 2) % 6 < 4 else 3)
            if (x - 2) % 6 == 5: t = 2
            if _hash(k, y // 5, 7) > 0.85: t -= 1
            put(px, W, H, x, y, OW[t])
    for x in range(2, 46):                                                  # 앞 모(두께)
        if px[x, 21][3]:
            put(px, W, H, x, 22, OW[2]); put(px, W, H, x, 23, OW[1])
    for (x0, x1) in ((5, 8), (24, 27), (38, 41)):                           # 말뚝
        for y in range(22, 31):
            for x in range(x0, x1): put(px, W, H, x, y, OW[4] if x == x0 else (OW[3] if x < x1 - 1 else OW[1]))
    for x in range(20, 26):                                                 # 빠진 널 밑 그늘
        for y in range(10, 22):
            if px[x, y][3] == 0: put(px, W, H, x, y, (40, 26, 18), 110)
    return F(im, 0.66)


def anchor_rusted():
    """녹슨 닻(2x1): 진흙에 반쯤 박혀 비스듬히 누운 큰 닻과 끊긴 사슬. 밑줄 막힘."""
    W, H = 32, 16
    im = blank(W, H); px = im.load()
    RU = R7('rust')
    for i in range(18):                                                     # 자루(비스듬)
        x = 7 + i; y = 4 + int(i * 0.35)
        put(px, W, H, x, y, RU[5]); put(px, W, H, x, y + 1, RU[3]); put(px, W, H, x, y + 2, RU[1])
    for i in range(9):                                                      # 팔(호)
        a = math.pi * (0.1 + 0.8 * i / 8)
        x = 25 + int(math.cos(a) * 4.5 - 1); y = 10 + int(math.sin(a) * 3)
        put(px, W, H, x, y, RU[4]); put(px, W, H, x, y + 1, RU[2])
    for (x, y) in ((4, 3), (5, 2), (6, 3), (5, 4)): put(px, W, H, x, y, RU[4])                      # 고리
    for i, x in enumerate(range(0, 5)): put(px, W, H, x, 6 + (i % 2), RU[3 if i % 2 else 2])        # 사슬
    for x in range(18, 31): put(px, W, H, x, 14, RGB('mud', 5)); put(px, W, H, x, 15, RGB('mud', 3))
    return F(im, 0.66)


def dead_reeds():
    """말라 죽은 갈대(1칸 장식, 걷기): 옛 물가에 선 마른 갈대대, 꺾인 대 하나."""
    c = C(16, 16, seed=836)
    for (x, h, dx, t0) in ((3, 11, 0, 3), (5, 13, 1, 4), (7, 9, 0, 3), (9, 14, -1, 4), (11, 10, 1, 3), (13, 12, 0, 4)):
        c.new()
        for k in range(h):
            xx = x + int(round(dx * k / max(1, h - 1))); yy = 15 - k
            c.tone(xx, yy, 'drygr', t0 if k < h - 3 else t0 + 1)
        c.tone(x + dx, 15 - h, 'oldwood', 3); c.tone(x + dx, 14 - h, 'oldwood', 2)
    c.new()
    for k in range(6): c.tone(9 - k, 8 - k // 2, 'drygr', 3)
    return c.img(False)


def shells_scatter():
    """흩어진 조개껍데기(1칸 장식, 걷기): 마른 호수 바닥의 흰 조개·소라 껍데기."""
    im = blank(16, 16); px = im.load()
    B = R7('bone')
    for (x, y) in ((3, 4), (10, 3), (6, 10), (12, 11), (2, 12)):
        for (dx, dy, t) in ((0, 0, 6), (1, 0, 5), (-1, 1, 4), (0, 1, 5), (1, 1, 4), (2, 1, 3), (0, 2, 2), (1, 2, 2)):
            put(px, 16, 16, x + dx, y + dy, B[t])
    return im


# ================================================================ 생존자 야영지
def _rope(px, W, H, x0, y0, x1, y1, t=3):
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    for i in range(n):
        f = i / max(1, n - 1)
        put(px, W, H, int(round(x0 + (x1 - x0) * f)), int(round(y0 + (y1 - y0) * f)), RGB('rope', t))


def tent_lean():
    """기운 생존자 천막(3x3): 막대 두 개에 걸친 바랜 천 지붕, 한쪽 막대가 기울어 처졌다, 기운 천 조각(붉은 천·자루천)으로 기웠다,
    앞 삼각 입구는 들춰져 안이 어둡다, 당김줄과 말뚝. 몸통 아래 2줄 막힘, 맨 윗줄 걷기+가림."""
    W, H = 48, 48
    c = C(W, H, seed=841); c.shadow(24, 45, 21, 2.6, 100)
    ax, ay = 25, 15                     # 앞 꼭짓점(기운 막대 끝)
    bx, by = 21, 5                      # 뒤 꼭짓점
    fl, fr = (6, 44), (42, 44)          # 앞 밑변
    bl, br = (5, 31), (39, 30)          # 뒤 밑변(앞보다 위)
    c.group(1)
    c.poly([(bx, by), (ax, ay), fl, bl], 'canvas', lambda x, y: 0.92 - 0.10 * (y - by) / 40.0, grain=True)       # 왼 지붕(빛)
    c.poly([(bx, by), br, fr, (ax, ay)], 'canvas', lambda x, y: 0.50 - 0.08 * (y - by) / 40.0, grain=True)       # 오른 지붕(그늘)
    for k in range(5):                                                      # 처진 천 주름(왼 지붕)
        f = (k + 1) / 6
        x0 = bx + (bl[0] - bx) * f; y0 = by + (bl[1] - by) * f; x1 = ax + (fl[0] - ax) * f; y1 = ay + (fl[1] - ay) * f
        c.line(x0, y0, x1, y1, 'canvas', 4 if k % 2 else 5)
    c.group(2)
    c.poly([(ax, ay), fr, fl], 'canvas', lambda x, y: 0.68 - 0.12 * (y - ay) / 30.0, grain=True)                 # 앞 삼각
    c.new()
    c.poly([(ax + 1, ay + 7), (ax + 8, 44), (ax - 5, 44)], 'abyss', 0.3, grain=False)                                 # 입구 어둠
    c.new()
    c.poly([(ax + 1, ay + 7), (ax + 13, 44), (ax + 8, 44)], 'canvas', 0.46, grain=True)                               # 들춘 자락
    c.group(3); c.new()
    for (x0, y0, w, h, mat) in ((10, 26, 7, 6, 'red'), (30, 18, 6, 7, 'rope'), (14, 36, 6, 5, 'canvas')):        # 기운 천 조각
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                if c.m[y][x] in ('canvas',):
                    t = 3 if mat == 'red' else (4 if mat == 'rope' else 3)
                    if y == y0 or x == x0: t += 1
                    c.tone(x, y, mat, t)
        for x in range(x0, x0 + w, 2): c.tone(x, y0 - 1 if c.m[y0 - 1][x] else y0, 'rope', 2)   # 바늘땀
    c.new()                                                                 # 막대 끝
    for (x, y) in ((ax, ay - 1), (ax + 1, ay - 2), (bx, by - 1), (bx - 1, by - 2)): c.tone(x, y, 'oldwood', 4)
    c.line(bx, by, ax, ay, 'canvas', 6)
    im = F(c); px = im.load()
    _rope(px, W, H, 6, 44, 1, 47); _rope(px, W, H, 42, 44, 47, 47, 2); _rope(px, W, H, ax, ay, 46, 30, 2)
    for (x, y) in ((1, 46), (46, 46), (46, 29)): put(px, W, H, x, y, RGB('oldwood', 3)); put(px, W, H, x, y + 1, RGB('oldwood', 1))
    return im


def tarp_shelter():
    """고철 차양 움막(2x2): 녹슨 철판 두 장을 기대 세우고 천을 덮은 낮은 바람막이, 안에 깔개. 몸통 아래 1줄 막힘."""
    W, H = 32, 32
    c = C(W, H, seed=842); c.shadow(16, 29.4, 14, 2.2, 90)
    c.group(1)
    c.poly([(4, 10), (28, 7), (30, 22), (2, 24)], 'rust', lambda x, y: 0.85 - 0.03 * (y - 7) - 0.15 * (x / 32.0), grain=True)   # 철판 지붕(기울어 빛)
    for x in range(4, 29, 4):
        for y in range(8, 24):
            if c.m[y][x] == 'rust': c.darken(x, y, 1)
    c.group(2)
    c.poly([(2, 24), (30, 22), (29, 28), (3, 29)], 'rust', 0.42, grain=True)                                         # 앞 처마 판
    c.new()
    c.poly([(9, 24), (22, 23), (21, 29), (10, 29)], 'abyss', 0.3, grain=False)                                       # 안 어둠
    c.new()
    for y in range(26, 29):
        for x in range(11, 20): c.tone(x, y, 'cloth', 3 if (x + y) % 3 else 4)                                     # 깔개
    c.group(3)
    c.poly([(6, 9), (18, 7), (17, 15), (5, 17)], 'canvas', lambda x, y: 0.8 - 0.02 * (y - 7), grain=True)           # 덮은 천
    im = F(c); px = im.load()
    for (x, y) in ((5, 9), (12, 8), (27, 8), (8, 16), (16, 14)): put(px, W, H, x, y, RGB('iron', 5))                 # 대갈못
    for x in range(2, 31):
        if px[x, 24][3] and _hash(x, 24, 5) > 0.6:
            for k in range(1, 4): put(px, W, H, x, 24 + k, RGB('rust', 4))                                            # 녹물 줄
    return im


def campfire():
    """모닥불(1칸): 둥글게 놓은 돌 안에 엇걸린 장작, 타오르는 불꽃, 불티. 1칸 막힘."""
    c = C(16, 16, seed=843); c.shadow(8, 13.6, 7, 1.6, 70)
    for i in range(8):                                                      # 돌 고리
        a = math.pi * 2 * i / 8
        c.new(); c.ellipsoid(8 + math.cos(a) * 5.4, 11 + math.sin(a) * 2.6, 2.0, 1.6, 'rrock', amb=0.25, bump=0.3, bias=0.04 if math.sin(a) > 0 else -0.06)
    c.new()
    c.line(4, 12, 12, 9, 'deadw', 3); c.line(4, 9, 12, 12, 'deadw', 4)
    im = F(c, 0.7); px = im.load()
    rows = ["....6....", "...565...", "..56765..", "..45654..", ".3456543.", ".2345432."]
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch != '.': put(px, 16, 16, 4 + i, 3 + j, FIRE[int(ch) - 1])
    for (x, y) in ((3, 2), (12, 1), (9, 0)): put(px, 16, 16, x, y, FIRE[5])
    for (x, y) in ((6, 11), (9, 11), (8, 12)): put(px, 16, 16, x, y, FIRE[2])
    return im


def cook_tripod():
    """냄비 삼발이(1x2): 막대 셋을 묶어 세우고 사슬에 쇠냄비를 걸었다, 밑에 꺼져 가는 숯. 밑동 1칸 막힘, 위 칸 걷기+가림."""
    c = C(16, 32, seed=844); c.shadow(8, 29.4, 6.5, 1.5, 80)
    c.new()
    c.line(8, 3, 2, 30, 'oldwood', 4); c.line(8, 3, 14, 30, 'oldwood', 2); c.line(8, 3, 9, 27, 'oldwood', 3)
    c.new()
    for y in range(4, 16): c.tone(8, y, 'iron', 3 if y % 2 else 4)
    c.new(); c.cylinder(8, 17, 23, 4.6, 'iron', cap=True, capry=1.8, amb=0.3)
    c.new()
    for x in range(5, 12): c.tone(x, 17, 'abyss', 2)
    im = F(c); px = im.load()
    for (x, y) in ((6, 28), (8, 29), (10, 28), (7, 29), (9, 28)): put(px, 16, 32, x, y, FIRE[2] if (x + y) % 2 else RGB('dust', 2))
    for (x, y) in ((6, 15), (9, 14), (7, 12)): put(px, 16, 32, x, y, RGB('dust', 6), 160)                          # 김
    return im


def crates_stack():
    """궤짝 더미(2x2): 바랜 나무 궤짝 둘을 쌓고 하나는 옆에, 모서리 쇠붙이, 위 궤짝 뚜껑이 들렸다. 밑줄 2칸 막힘."""
    c = C(32, 32, seed=845); c.shadow(16, 29.5, 14, 2.2, 90)
    c.new(); c.box(2, 16, 16, 5, 9, 'oldwood', top=0.92, front=0.55)
    c.new(); c.box(17, 19, 13, 4, 7, 'oldwood', top=0.9, front=0.5, bias=-0.04)
    c.new(); c.box(5, 5, 12, 4, 7, 'oldwood', top=0.95, front=0.58, bias=0.03)
    for (x0, x1, y0, y1) in ((2, 18, 21, 30), (17, 30, 23, 30), (5, 17, 9, 16)):
        for x in range(x0, x1):
            if (x - x0) % 5 == 4:
                for y in range(y0, y1): c.darken(x, y, 1)
        for x in range(x0, x1): c.darken(x, (y0 + y1) // 2, 1)
    im = F(c); px = im.load()
    for (x, y) in ((3, 22), (16, 22), (3, 29), (16, 29), (6, 10), (15, 10), (18, 24), (28, 24)): put(px, 32, 32, x, y, RGB('rust', 4))
    for x in range(5, 17): put(px, 32, 32, x, 4, RGB('oldwood', 6) if x < 12 else RGB('oldwood', 5))              # 들린 뚜껑
    return im


def rusty_drum():
    """녹슨 쇠통(1칸): 테 두른 쇠통, 녹이 흘러내렸고 윗면에 빗물 자국, 찌그러진 옆구리. 1칸 막힘."""
    c = C(16, 16, seed=846); c.shadow(8, 14.6, 6.5, 1.4, 80)
    c.new(); c.cylinder(8, 4, 14, 5.6, 'rust', cap=True, capry=2.2, amb=0.28)
    for x in range(2, 15):
        c.darken(x, 7, 1); c.darken(x, 11, 1)
    im = F(c); px = im.load()
    for (x, y) in ((6, 3), (7, 3), (8, 4), (9, 3)): put(px, 16, 16, x, y, RGB('iron', 2))
    for (x, y) in ((11, 8), (12, 9), (11, 9)): put(px, 16, 16, x, y, RGB('rust', 1))
    return im


def rain_barrel():
    """빗물 받는 통(1x2): 나무 통 위에 천 깔때기를 매단 막대, 통 테는 녹슬었다. 밑동 1칸 막힘, 위 칸 걷기+가림."""
    c = C(16, 32, seed=847); c.shadow(8, 29.6, 6.5, 1.5, 80)
    c.new(); c.cylinder(8, 19, 29, 5.8, 'oldwood', cap=True, capry=2.3, amb=0.28)
    c.new()
    for y in range(19, 22):
        for x in range(4, 13):
            if ((x + 0.5 - 8) / 4.2) ** 2 + ((y + 0.5 - 19.5) / 1.4) ** 2 <= 1: c.tone(x, y, 'abyss', 3)
    c.new()
    for y in range(4, 19): c.tone(2, y, 'oldwood', 4); c.tone(13, y, 'oldwood', 2)
    c.new()
    c.poly([(1, 5), (15, 5), (10, 13), (6, 13)], 'canvas', lambda x, y: 0.8 - 0.05 * (y - 5), grain=True)
    im = F(c); px = im.load()
    for x in range(3, 14): put(px, 16, 32, x, 23, RGB('rust', 3)); put(px, 16, 32, x, 27, RGB('rust', 2))
    for y in range(14, 19): put(px, 16, 32, 8, y, RGB('canvas', 3))
    return im


def bedroll():
    """말아 둔 깔개(2x1 장식, 걷기): 끈으로 묶은 담요 두루마리와 펼친 자루천."""
    c = C(32, 16, seed=848)
    c.new()
    for y in range(8, 15):
        for x in range(2, 24): c.setv(x, y, 'canvas', 0.7 - 0.03 * (y - 8))
    c.new(); c.hcyl(18, 29, 9, 3.6, 'cloth', amb=0.3, endcap='R', capmat='cloth')
    im = F(c, 0.7); px = im.load()
    for x in (21, 26):
        for y in range(6, 13): put(px, 32, 16, x, y, RGB('rope', 3))
    return im


def signal_pole():
    """신호 장대(1x3): 높은 막대에 바랜 천 띠를 매달고 쇠 등을 걸었다 — 생존자 야영지 표지. 밑동 1칸 막힘, 위 칸 걷기+가림."""
    c = C(16, 48, seed=849); c.shadow(8, 45.6, 5, 1.4, 80)
    for (cx, cy, rx, ry) in ((8, 43, 5.5, 2.8), (8, 39.5, 3.8, 2.2)):
        c.new(); c.ellipsoid(cx, cy, rx, ry, 'rrock', amb=0.25, bump=0.4, bias=0.04)
    c.new()
    for y in range(2, 40): c.tone(7, y, 'oldwood', 5); c.tone(8, y, 'oldwood', 3)
    c.new()
    for y in range(4, 6):
        for x in range(9, 14): c.tone(x, y, 'oldwood', 3)
    c.new()
    for (x, y0, L) in ((10, 6, 12), (12, 6, 9), (14, 6, 7)):
        for k in range(L):
            c.tone(x + (k // 4) % 2, y0 + k, 'red' if x < 12 else 'canvas', 4 if k < 2 else 3)
    c.new(); c.cylinder(4, 9, 14, 2.4, 'iron', cap=True, capry=1.0, amb=0.3)
    im = F(c); px = im.load()
    for (x, y) in ((4, 11), (4, 12), (3, 12)): put(px, 16, 48, x, y, FIRE[4])
    for y in range(6, 9): put(px, 16, 48, 5, y, RGB('iron', 3))
    return im


# ---------------------------------------------------------------- 고철
def _plate(px, W, H, x0, y0, w, h, seed, mat='rust', ribs=True, lit=0):
    """녹슨 골함석 판 한 장(앞면): 세로 골(밝은 등·어두운 골), 위 모 밝게, 녹물 줄, 구멍."""
    R = R7(mat)
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            u = (x - x0) % 4
            t = (5 if u == 0 else (4 if u == 1 else (3 if u == 2 else 2))) if ribs else 4
            if y == y0: t = 6
            elif y == y0 + 1: t = min(6, t + 1)
            if y >= y0 + h - 1: t = 1
            t += lit
            if _hash(x // 4, y // 3, seed) > 0.86: t -= 1
            put(px, W, H, x, y, R[max(1, min(6, t))])
    for i in range(3):
        rx = x0 + int(_hash(i, 1, seed) * w); ry = y0 + 2 + int(_hash(i, 2, seed) * (h - 4))
        put(px, W, H, rx, ry, R7('iron')[5])


def scrap_fence_h():
    """고철 울타리(3x2): 막대 셋에 녹슨 골함석 판을 높이 제각각 못박았다, 판 하나는 기울었고 위에는 꼬인 철사. 아랫줄 3칸 막힘, 윗줄 걷기+가림.
    좌우로 이어 붙이면 담이 된다(끝에 scrap_fence_post)."""
    W, H = 48, 32
    im = blank(W, H); px = im.load()
    OW = R7('oldwood')
    for (x0, y0, w) in ((1, 9, 14), (15, 6, 13), (28, 11, 11), (39, 8, 9)):
        _plate(px, W, H, x0, y0, w, 27 - y0, 900 + x0, 'rust', True, 0 if x0 != 15 else 1)
    for x in (2, 23, 44):                                                   # 막대
        for y in range(4, 29): put(px, W, H, x, y, OW[4]); put(px, W, H, x + 1, y, OW[2])
        put(px, W, H, x, 3, OW[5]); put(px, W, H, x + 1, 3, OW[4])
    for x in range(0, 48):                                                  # 철사(늘어짐)
        y = 5 + int(1.6 * math.sin(x / 7.6 + 0.5) ** 2)
        put(px, W, H, x, y, R7('iron')[4 if x % 3 else 2])
        if x % 5 == 0: put(px, W, H, x, y - 1, R7('iron')[5]); put(px, W, H, x + 1, y + 1, R7('iron')[3])
    im = F(im, 0.66); px = im.load()
    for x in range(W):                                                      # 땅 그림자
        if px[x, 26][3]:
            for y in (28, 29):
                if px[x, y][3] == 0: put(px, W, H, x, y, (24, 10, 8), 80 if y == 28 else 45)
    tufts(px, W, H, 0, 48, 28, 911, 0.35, 3)
    return im


def scrap_fence_v():
    """고철 울타리 세로(1x3): 남북으로 이어지는 담 — 위에서 본 막대와 판 모서리(좁은 띠), 철사. 3칸 막힘."""
    W, H = 16, 48
    im = blank(W, H); px = im.load()
    R = R7('rust'); OW = R7('oldwood')
    for y in range(2, 46):
        for x in range(5, 11):
            t = 5 if x == 5 else (4 if x < 8 else (3 if x < 10 else 2))
            if (y // 11) % 2 and x > 6: t -= 1
            if _hash(x, y // 3, 921) > 0.88: t -= 1
            put(px, W, H, x, y, R[max(1, t)])
        if y % 11 == 0:
            for x in range(4, 12): put(px, W, H, x, y, R[1])
    for y in (4, 22, 40):
        for k in range(4): put(px, W, H, 6 + k, y + k - 3, OW[5 if k < 2 else 3])
    for y in range(44, 48):
        for x in range(5, 11): put(px, W, H, x, y, R[2] if y < 46 else R[1])
    return F(im, 0.66)


def scrap_fence_post():
    """고철 울타리 끝 기둥(1x2): 철사를 감은 굵은 막대와 기댄 판 조각 — 담 끝·문 옆. 1칸 막힘."""
    W, H = 16, 32
    im = blank(W, H); px = im.load()
    OW = R7('oldwood')
    _plate(px, W, H, 6, 14, 8, 13, 931, 'rust', True, 0)
    for y in range(3, 29):
        for x in range(4, 8): put(px, W, H, x, y, OW[5 if x == 4 else (4 if x < 6 else 2)])
    for y in range(6, 12, 2):
        for x in range(3, 9): put(px, W, H, x, y, R7('iron')[4 if x < 6 else 2])
    for x in range(4, 8): put(px, W, H, x, 2, OW[6])
    im = F(im, 0.66); px = im.load()
    tufts(px, W, H, 0, 16, 29, 932, 0.4, 3)
    return im


def scrap_heap():
    """고철 더미(3x2): 녹슨 판·휜 관·부서진 수레바퀴·쇠사슬이 엉켜 쌓였다, 꼭대기에 판 하나가 비스듬히 꽂혔다. 아랫줄 3칸 막힘."""
    W, H = 48, 32
    c = C(W, H, seed=851); c.shadow(24, 29, 22, 2.6, 90)
    c.group(1)
    c.ellipsoid(24, 24, 21, 7.5, 'rust', amb=0.22, bump=0.9, bsc=3.0, bias=-0.06)
    c.ellipsoid(20, 19, 12, 6.0, 'rust', amb=0.25, bump=0.8, bsc=2.6, bias=0.0)
    c.group(2); c.new()
    c.hcyl(6, 26, 16, 2.2, 'iron', amb=0.3, endcap='L', capmat='iron')        # 휜 관
    c.new()
    for i in range(60):                                                    # 수레바퀴(테+살)
        a = math.pi * 2 * i / 60
        x = 34 + math.cos(a) * 7; y = 20 + math.sin(a) * 6.4
        c.tone(int(x), int(y), 'oldwood', 4 if math.sin(a) < 0 else 2)
    for k in range(6):
        a = math.pi * 2 * k / 6
        c.line(34, 20, 34 + math.cos(a) * 6, 20 + math.sin(a) * 5.6, 'oldwood', 3)
    c.group(3); c.new()
    c.poly([(13, 4), (21, 6), (19, 18), (11, 16)], 'rust', lambda x, y: 0.82 - 0.02 * (y - 4), grain=True)         # 꽂힌 판
    im = F(c); px = im.load()
    for i in range(10):                                                    # 사슬 고리
        x = 8 + i * 2; y = 26 - (i % 2)
        put(px, W, H, x, y, RGB('iron', 4 if i % 2 else 2))
    for (x, y) in ((25, 22), (28, 23), (16, 25), (31, 26)): put(px, W, H, x, y, RGB('iron', 5))
    for i in range(14, 19): put(px, W, H, 17, i, RGB('rust', 2))
    return im


def scrap_small():
    """고철 조각 무더기(2x1): 땅에 버려진 녹슨 판 두 장과 관 토막, 대갈못. 1줄 막힘."""
    c = C(32, 16, seed=852); c.shadow(16, 14, 14, 1.6, 70)
    c.group(1)
    c.poly([(2, 8), (17, 6), (19, 13), (3, 14)], 'rust', lambda x, y: 0.85 - 0.04 * (y - 6), grain=True)
    c.poly([(13, 10), (29, 9), (30, 14), (14, 15)], 'rust', lambda x, y: 0.6 - 0.03 * (y - 9), grain=True)
    c.new(); c.hcyl(20, 28, 8, 1.8, 'iron', amb=0.3, endcap='R', capmat='iron')
    for x in range(3, 18, 4):
        for y in range(7, 14): c.darken(x, y, 1)
    return F(c)


def broken_wheel():
    """부서진 수레바퀴(1칸): 땅에 반쯤 박혀 기운 나무 바퀴, 살 두 개가 부러졌다. 1칸 막힘."""
    im = blank(16, 16); px = im.load()
    OW = R7('oldwood')
    for i in range(80):
        a = math.pi * 2 * i / 80
        x = 8 + math.cos(a) * 6.2; y = 8 + math.sin(a) * 5.4
        if y > 12.5: continue
        put(px, 16, 16, int(x), int(y), OW[5] if math.sin(a) < -0.2 else (OW[3] if math.cos(a) < 0 else OW[2]))
    for k in (0, 1, 3, 4):
        a = math.pi * 2 * k / 6 + 0.3
        for r in range(1, 6):
            x = 8 + math.cos(a) * r; y = 8 + math.sin(a) * r * 0.87
            if y <= 12.5: put(px, 16, 16, int(x), int(y), OW[4])
    for (x, y) in ((7, 7), (8, 7), (7, 8), (8, 8)): put(px, 16, 16, x, y, OW[3])
    for x in range(1, 16): put(px, 16, 16, x, 13, RGB('rdirt', 5)); put(px, 16, 16, x, 14, RGB('rdirt', 3))
    return F(im, 0.66)
