# 화산 지대 필드 새 조각(손 도트, 버들항 팔레트·px2 볼륨 페인터·pz.fin 윤곽). 모든 함수는 RGBA Image 를 돌려준다. 결정적.
# 3/4 시점: 윗면 + 앞면, 옆면 없음, 빛 왼쪽 위.
import math
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from vf_base import C, PAL, P, RGB, F, put, hash2, smooth, LAV, _hash, vnoise
import vf_lava as VL


def blank(w, h): return Image.new('RGBA', (w, h), (0, 0, 0, 0))


# ================================================================ 현무암 기둥(육각 주상절리)
def hexcol(c, cx, ybot, r, h, mat='basalt', seed=1, crack=True, tbias=0.0):
    """육각 기둥 하나: 윗면(납작한 육각, 밝음) + 보이는 앞 세 면(왼앞 밝음 · 앞 중간 · 오른앞 어둠). ybot = 땅 닿는 줄."""
    c.new()
    d = max(1.5, r * 0.5)
    yc = ybot - h - d
    def fr(x):
        if x < cx - r / 2: return yc + d * (x - (cx - r)) / (r / 2)
        if x > cx + r / 2: return yc + d * ((cx + r) - x) / (r / 2)
        return yc + d
    for xi in range(int(cx - r), int(math.ceil(cx + r))):
        x = xi + 0.5
        if x < cx - r or x > cx + r: continue
        yf = fr(x); yb = 2 * yc - yf
        for yi in range(int(math.floor(yb)), int(math.ceil(yf + h)) + 1):
            y = yi + 0.5
            if y < yb: continue
            if y <= yf:            # 윗면
                v = 0.98 + tbias - 0.10 * (y - yb) / max(1, yf - yb) - 0.12 * (x - (cx - r)) / (2 * r)
                if y - yb < 1.2 and x < cx + r / 2: v += 0.12            # 뒤 모서리 빛
                c.setv(xi, yi, mat, v)
            elif y <= yf + h:      # 앞면
                k = (y - yf) / max(1, h)
                if x < cx - r / 2: v = 0.66
                elif x > cx + r / 2: v = 0.30
                else: v = 0.48
                v += tbias - 0.14 * k
                if abs(x - (cx - r / 2)) < 0.6 or abs(x - (cx + r / 2)) < 0.6: v -= 0.20     # 면 모서리
                if y - yf < 1.0: v += 0.10                                                     # 윗 모서리 밝게
                c.setv(xi, yi, mat, v)
    if crack:                       # 가로 마디(주상절리 금)
        for j in range(int(_hash(int(cx), ybot, seed) * 2) + (1 if h > 14 else 0)):
            yy = int(ybot - h * (0.3 + 0.4 * _hash(j, int(cx), seed + 1)))
            for xi in range(int(cx - r) + 1, int(cx + r)):
                if _hash(xi, yy, seed + 2) > 0.25: c.darken(xi, yy + int(fr(xi + 0.5) - (yc + d)), 2)


def basalt_columns():
    """현무암 주상절리 무리(2x3): 높이가 다른 육각 기둥 다섯."""
    c = C(32, 48, seed=601); c.shadow(16, 45.5, 15, 2.2, 90)
    for (cx, yb, r, h) in ((19, 40, 5.2, 30), (11, 41, 5.0, 24), (25, 43, 4.6, 17), (8, 46, 4.4, 11), (17, 46, 4.8, 8)):
        hexcol(c, cx, yb, r, h, seed=int(cx * 7 + h))
    c.new()
    for (x, y) in ((3, 46), (28, 46), (13, 47), (24, 47)): c.tone(x, y, 'basalt', 2); c.tone(x + 1, y, 'basalt', 4)
    for (x, y) in ((18, 7), (19, 8), (10, 15), (25, 24)): c.tone(x, y, 'vash', 5)          # 윗면에 앉은 재
    return F(c)


def basalt_columns_low():
    """낮은 주상절리 그루터기 무리(2x2): 무릎 높이 육각 기둥들 — 윗면은 밟을 수 없는 바위(막힘)."""
    c = C(32, 32, seed=602); c.shadow(16, 29.5, 15, 2.0, 80)
    for (cx, yb, r, h) in ((10, 24, 5.0, 9), (21, 23, 5.2, 12), (15, 29, 4.8, 6), (26, 30, 4.4, 4), (5, 30, 3.8, 4)):
        hexcol(c, cx, yb, r, h, seed=int(cx * 5 + h), crack=h > 8)
    for (x, y) in ((20, 7), (9, 12), (14, 20)): c.tone(x, y, 'vash', 5)
    return F(c)


def basalt_step():
    """용암 위 현무암 징검돌(1칸): 용암에서 솟은 육각 기둥 머리, 밑동은 붉게 달아올랐다. 걷기."""
    c = C(16, 16, seed=603)
    hexcol(c, 8, 13, 6.6, 5, seed=11, crack=False, tbias=0.04)
    im = F(c)
    px = im.load()
    for x in range(1, 15):              # 밑동: 용암 반사 띠
        for y in (13, 14):
            if px[x, y][3]: put(px, 16, 16, x, y, LAV[3] if y == 13 else LAV[2])
    for (x, y) in ((1, 14), (14, 14), (2, 15), (13, 15), (7, 15)): put(px, 16, 16, x, y, LAV[4])
    return im


def basalt_boulder():
    """현무암 큰 바위(2x2): 모난 덩이, 기공 구멍, 윗면에 앉은 재."""
    c = C(32, 32, seed=604); c.shadow(16, 28.8, 14, 2.4, 90)
    c.group(1)
    c.ellipsoid(16, 19, 14, 10, 'basalt', amb=0.16, bump=0.75, bsc=4.5)
    c.ellipsoid(11, 14, 7.5, 5.5, 'basalt', amb=0.2, bias=0.06, bump=0.6, bsc=3.0)
    for (x0, y0, x1, y1) in ((19, 11, 23, 18), (8, 21, 13, 24), (24, 20, 26, 25)): c.line(x0, y0, x1, y1, 'basalt', 1)
    for i in range(16):
        x = int(5 + _hash(i, 1, 61) * 22); y = int(12 + _hash(i, 2, 61) * 14)
        if c.m[y][x] == 'basalt': c.tone(x, y, 'basalt', 1)
    for i in range(22):
        x = int(6 + _hash(i, 3, 61) * 18); y = int(8 + _hash(i, 4, 61) * 7)
        if c.m[y][x] == 'basalt' and _hash(i, 5, 61) > 0.4: c.tone(x, y, 'vash', 5 + (i % 3 == 0))
    return F(c)


def lava_bomb():
    """화산탄(1칸): 굴러 떨어진 둥근 바위, 갈라진 틈이 아직 붉다."""
    c = C(16, 16, seed=605); c.shadow(8, 13.6, 6.5, 1.5, 80)
    c.ellipsoid(8, 9, 6.6, 5.4, 'basalt', amb=0.18, bump=0.5, bsc=2.4)
    im = F(c); px = im.load()
    for (x0, y0, x1, y1) in ((4, 9, 8, 11), (8, 11, 12, 8), (7, 5, 9, 9)):
        n = max(abs(x1 - x0), abs(y1 - y0)) + 1
        for i in range(n):
            x = round(x0 + (x1 - x0) * i / max(1, n - 1)); y = round(y0 + (y1 - y0) * i / max(1, n - 1))
            put(px, 16, 16, x, y, LAV[3] if i % 2 else LAV[4])
    put(px, 16, 16, 9, 9, LAV[5])
    return im


def basalt_rocks():
    """잔 현무암 돌(1칸 장식, 걷기)."""
    c = C(16, 16, seed=606)
    for (cx, cy, rx, ry) in ((4, 11, 3.0, 2.2), (11, 12, 3.4, 2.4), (8, 8, 2.2, 1.7), (13, 7, 1.6, 1.3)):
        c.new(); c.ellipsoid(cx, cy, rx, ry, 'basalt', amb=0.22, bump=0.4)
    return F(c)


def pumice_scatter():
    """부석 조각(1칸 장식, 걷기): 밝고 구멍 숭숭한 가벼운 돌."""
    c = C(16, 16, seed=607)
    for (cx, cy, rx, ry) in ((5, 10, 2.6, 1.9), (11, 6, 2.2, 1.6), (10, 12, 1.8, 1.4), (3, 5, 1.4, 1.1)):
        c.new(); c.ellipsoid(cx, cy, rx, ry, 'vash', amb=0.4, bias=0.12, bump=0.3)
    im = F(c, 0.7); px = im.load()
    for (x, y) in ((5, 10), (11, 6), (4, 9)): put(px, 16, 16, x, y, RGB('vash', 3))
    return im


# ================================================================ 흑요석
def _shard(c, x0, ybot, w, h, lean=0.0, seed=1):
    """흑요석 뾰족돌: 가는 윗면(납작한 끝 2px) + 왼 면(밝음) · 오른 면(어둠), 왼 모서리 유리 빛."""
    c.new()
    top = ybot - h
    for yi in range(int(top), int(ybot) + 1):
        f = (yi - top) / max(1, h)
        half = 1.0 + (w / 2 - 1.0) * f ** 0.8
        cx = x0 + lean * (1 - f) * h * 0.25
        for xi in range(int(cx - half - 1), int(cx + half + 2)):
            x = xi + 0.5
            if abs(x - cx) > half: continue
            if yi <= top + 1: v = 0.95
            elif x < cx - 0.3: v = 0.62 - 0.10 * f
            else: v = 0.30 - 0.06 * f
            c.setv(xi, yi, 'obs', v)
        lx = int(round(cx - half * 0.55))
        if 0.08 < f < 0.85 and _hash(lx, yi, seed) > 0.25: c.tone(lx, yi, 'obs', 6 if f < 0.5 else 5)


def obsidian_spire():
    c = C(16, 32, seed=611); c.shadow(8, 29.6, 6, 1.5, 90)
    _shard(c, 8, 29, 9, 26, lean=0.3, seed=3)
    _shard(c, 4, 30, 5, 10, lean=-0.3, seed=4)
    _shard(c, 12.5, 30, 5, 13, lean=0.2, seed=5)
    return F(c)


def obsidian_cluster():
    c = C(32, 32, seed=612); c.shadow(16, 29.6, 14, 2.0, 90)
    for (x, yb, w, h, ln, sd) in ((14, 27, 9, 22, 0.2, 1), (22, 28, 7, 15, -0.2, 2), (7, 29, 6, 11, 0.3, 3), (27, 30, 5, 8, -0.1, 4), (17, 30, 6, 7, 0.0, 5)):
        _shard(c, x, yb, w, h, ln, sd)
    return F(c)


# ================================================================ 그을린 나무
def limb(c, pts, widths, mat='char', seed=1):
    c.new()
    for (x0, y0), (x1, y1), w0, w1 in zip(pts, pts[1:], widths, widths[1:]):
        n = 24
        for i in range(n + 1):
            f = i / n; x = x0 + (x1 - x0) * f; y = y0 + (y1 - y0) * f; r = w0 + (w1 - w0) * f
            for yy in range(int(y - r) - 1, int(y + r) + 2):
                for xx in range(int(x - r) - 1, int(x + r) + 2):
                    if math.hypot(xx + 0.5 - x, yy + 0.5 - y) <= r:
                        dx = (xx + 0.5 - x) / max(r, 0.5)
                        t = 4 if dx < -0.35 else (2 if dx > 0.35 else 3)
                        if _hash(xx, yy, seed) > 0.88: t -= 1
                        c.tone(xx, yy, mat, max(1, t))


def _ash_on_top(c, mat='char', seed=1, p=0.55):
    """가지 윗면(위가 비어 있는 화소)에 재가 앉는다."""
    for y in range(1, c.h):
        for x in range(c.w):
            if c.m[y][x] == mat and c.m[y - 1][x] is None and _hash(x, y, seed) < p: c.tone(x, y, 'vash', 5 if _hash(x, y, seed + 1) > 0.4 else 4)


def _embers(c, pts):
    for (x, y) in pts: c.tone(x, y, 'lava', 4); c.tone(x, y + 1, 'lava', 2)


def charred_tree_a():
    """그을린 마른 나무(2x3): 잎 없이 타 버린 줄기와 꺾인 가지, 윗면에 재, 껍질 틈에 남은 불씨."""
    c = C(32, 48, seed=621); c.shadow(16, 45.6, 9, 2.0, 90)
    limb(c, [(16, 46), (16, 37), (15, 27), (16, 16), (14, 6)], [4.0, 3.2, 2.5, 1.8, 1.0], 'char', 3)
    limb(c, [(15, 31), (9, 26), (6, 19), (3, 14)], [2.0, 1.5, 1.1, 0.6], 'char', 4)
    limb(c, [(9, 26), (4, 25), (1, 21)], [1.0, 0.7, 0.5], 'char', 41)
    limb(c, [(22, 20), (28, 18), (30, 15)], [0.9, 0.6, 0.5], 'char', 42)
    limb(c, [(16, 24), (22, 20), (25, 13), (28, 9)], [1.9, 1.4, 0.9, 0.5], 'char', 5)
    limb(c, [(16, 15), (20, 11), (21, 5)], [1.0, 0.7, 0.5], 'char', 6)
    limb(c, [(6, 19), (9, 15)], [0.7, 0.4], 'char', 7)
    _ash_on_top(c, seed=9)
    _embers(c, [(15, 40), (17, 33), (16, 22)])
    c.new()
    for (x, y) in ((11, 45), (20, 45), (13, 46), (19, 46)): c.tone(x, y, 'vash', 5)          # 밑동 재 둔덕
    return F(c)


def charred_tree_b():
    """큰 그을린 고목(3x4): 굵은 줄기가 갈라진 채 서 있고, 뿌리가 재 위로 드러났다."""
    c = C(48, 64, seed=622); c.shadow(24, 61.5, 15, 2.8, 100)
    limb(c, [(24, 62), (24, 50), (23, 40), (24, 30), (22, 18)], [5.6, 4.6, 3.8, 3.0, 2.0], 'char', 3)
    limb(c, [(23, 41), (15, 35), (9, 27), (6, 18), (4, 12)], [2.8, 2.2, 1.6, 1.1, 0.6], 'char', 4)
    limb(c, [(24, 34), (32, 29), (38, 22), (42, 14)], [2.6, 2.0, 1.4, 0.8], 'char', 5)
    limb(c, [(22, 19), (18, 12), (17, 5)], [1.5, 1.0, 0.6], 'char', 6)
    limb(c, [(23, 22), (29, 15), (31, 8)], [1.3, 0.9, 0.6], 'char', 7)
    limb(c, [(9, 27), (14, 22)], [0.9, 0.5], 'char', 8)
    limb(c, [(38, 22), (34, 17)], [0.8, 0.5], 'char', 9)
    limb(c, [(21, 61), (15, 63)], [1.6, 0.8], 'char', 10)                 # 뿌리
    limb(c, [(27, 61), (34, 63)], [1.6, 0.8], 'char', 11)
    for y in range(44, 56):                                               # 줄기 갈라진 틈(불씨)
        c.tone(24 + (y % 3 == 0), y, 'char', 1)
    _ash_on_top(c, seed=12)
    _embers(c, [(24, 47), (25, 52), (23, 37), (16, 35), (33, 28)])
    return F(c)


def charred_snag():
    """부러진 그을린 줄기(1x2): 위가 꺾여 날카롭게 남은 밑동, 잘린 윗면에 불씨."""
    c = C(16, 32, seed=623); c.shadow(8, 29.6, 5.5, 1.4, 80)
    limb(c, [(8, 30), (8, 22), (7, 13)], [3.4, 3.0, 2.6], 'char', 3)
    c.new()
    for (x, y) in ((5, 11), (6, 10), (7, 12), (8, 9), (9, 11), (10, 12)): c.tone(x, y, 'char', 4)      # 꺾인 끝 뾰족
    _ash_on_top(c, seed=14)
    _embers(c, [(7, 12), (8, 18), (9, 25)])
    limb(c, [(5, 29), (2, 31)], [1.2, 0.6], 'char', 15)
    return F(c)


def charred_log():
    """쓰러진 그을린 통나무(2x1): 숯이 된 겉, 잘린 끝 나이테가 붉게 탄다."""
    c = C(32, 16, seed=624); c.shadow(16, 13.6, 14, 1.6, 70)
    c.new(); c.hcyl(4, 28, 9, 4.4, 'char', amb=0.25, endcap='L', capmat='char')
    im = F(c); px = im.load()
    for (x, y) in ((4, 8), (4, 9), (3, 9), (5, 10)): put(px, 32, 16, x, y, LAV[3])
    put(px, 32, 16, 4, 9, LAV[5])
    for (x, y) in ((10, 5), (16, 5), (22, 6)): put(px, 32, 16, x, y, RGB('vash', 5))
    for (x, y) in ((13, 9), (19, 10)): put(px, 32, 16, x, y, LAV[2])
    return im


def charred_stump():
    """그을린 그루터기(1칸)."""
    c = C(16, 16, seed=625); c.shadow(8, 13.4, 6, 1.4, 70)
    c.new(); c.cylinder(8, 7, 13, 5.0, 'char', cap=True, capry=2.6, amb=0.3)
    im = F(c); px = im.load()
    for (x, y) in ((6, 7), (8, 6), (10, 7), (8, 8)): put(px, 16, 16, x, y, LAV[2])
    put(px, 16, 16, 8, 7, LAV[4])
    return im


def burnt_grass():
    """타다 남은 마른 풀(1칸 장식, 걷기)."""
    c = C(16, 16, seed=626)
    for (x, h, dx, t0) in ((3, 6, -1, 3), (5, 8, 1, 4), (7, 5, 0, 3), (10, 7, 1, 4), (12, 4, -1, 3), (13, 6, 1, 3)):
        c.new()
        for k in range(h):
            xx = x + int(round(dx * k / max(1, h - 1))); yy = 14 - k
            c.tone(xx, yy, 'drygr', t0 if k < h - 2 else min(6, t0 + 1))
            if k == h - 1: c.tone(xx, yy, 'char', 2)
    return c.img(False)


# ================================================================ 유황·김
def sulfur_vent():
    """유황 구멍(1칸): 노란 유황 딱지가 둘린 땅 구멍, 안은 어둡고 김이 조금 샌다. 막힘."""
    c = C(16, 16, seed=631)
    c.group(1)
    c.ellipsoid(8, 10, 7.2, 4.4, 'sulf', amb=0.30, bump=0.6, bsc=2.0, bias=-0.06)
    im = c.img(False)
    px = im.load()
    for y in range(16):
        for x in range(16):
            dx = (x + 0.5 - 8) / 3.6; dy = (y + 0.5 - 9.2) / 2.0
            d = dx * dx + dy * dy
            if d <= 1: put(px, 16, 16, x, y, RGB('vash', 0) if d < 0.55 else RGB('vash', 1))
            elif d <= 1.6 and y < 10: put(px, 16, 16, x, y, RGB('sulf', 6 if x < 8 else 5))
            elif d <= 1.6: put(px, 16, 16, x, y, RGB('sulf', 2))
    for (x, y) in ((7, 4), (8, 3), (9, 5), (8, 1), (6, 2)): put(px, 16, 16, x, y, RGB('steam', 3 + (x + y) % 2), 200)
    return F(im)


def sulfur_vent_big():
    """큰 분기공(2x2): 유황이 굳어 생긴 낮은 둔덕 꼭대기 구멍에서 김이 뿜어 오른다. 둔덕 줄만 막힘."""
    c = C(32, 32, seed=632); c.shadow(16, 29.6, 14.5, 2.2, 90)
    c.group(1)
    c.ellipsoid(16, 24, 14.5, 6.5, 'sulf', amb=0.22, bump=0.7, bsc=2.4, bias=-0.04)
    c.ellipsoid(16, 21, 9.5, 5.0, 'sulf', amb=0.25, bump=0.5, bsc=2.0, bias=0.04)
    for i in range(18):                        # 둔덕 밑자락: 재와 섞인 거친 결
        x = int(3 + _hash(i, 1, 63) * 26); y = int(25 + _hash(i, 2, 63) * 5)
        if c.m[y][x] == 'sulf': c.tone(x, y, 'vash', 3 + (i % 2))
    c.group(2); c.new()
    for y in range(17, 23):
        for x in range(10, 23):
            dx = (x + 0.5 - 16) / 4.4; dy = (y + 0.5 - 19.6) / 2.0
            if dx * dx + dy * dy <= 1: c.tone(x, y, 'vash', 0 if dx * dx + dy * dy < 0.5 else 1)
    # 김 뭉치(위로)
    c.group(3)
    for (x, y, r) in ((15, 15, 3.6), (17, 11, 4.0), (14, 7, 4.4), (18, 4, 3.4)):
        c.ellipsoid(x, y, r, r * 0.8, 'steam', amb=0.5, bump=0.5, bsc=2.0, bias=0.02)
    im = F(c, 0.78)
    px = im.load()
    for (x, y) in ((8, 20), (24, 21), (12, 24), (21, 25)): put(px, 32, 32, x, y, RGB('sulf', 6))
    return im


def steam_wisp():
    """피어오르는 김(1x2 위층 장식): 땅 틈·분기공 위에 얹는 가는 김 뭉치. 걷기+가림."""
    c = C(16, 32, seed=633)
    c.group(1)
    for (x, y, r) in ((8, 27, 2.0), (7, 23, 2.8), (9, 18, 3.4), (7, 12, 3.8), (9, 6, 3.4)):
        c.ellipsoid(x, y, r, r * 0.85, 'steam', amb=0.5, bump=0.5, bsc=1.8)
    im = F(c, 0.82)
    a = np.array(im)
    a[..., 3] = np.where(a[..., 3] > 0, np.where(np.arange(32)[:, None] < 10, 150, 205), 0).astype(np.uint8)
    return Image.fromarray(a, 'RGBA')


def sulfur_crystals():
    """유황 결정(1칸 장식, 걷기): 노란 바늘 결정 무리."""
    c = C(16, 16, seed=634)
    for (x, yb, h) in ((4, 13, 4), (6, 12, 6), (9, 13, 5), (11, 12, 3), (7, 14, 3), (12, 14, 4)):
        c.new()
        for k in range(h):
            c.tone(x, yb - k, 'sulf', 6 if k == h - 1 else (5 if k > h // 2 else 4))
            c.tone(x + 1, yb - k, 'sulf', 3 if k < h - 1 else 4)
    return F(c, 0.7)


def fumarole_crack():
    """달아오른 땅 틈(1칸 장식, 걷기): 재 땅이 갈라져 붉은 빛이 비친다."""
    im = blank(16, 16); px = im.load()
    pts = [(1, 9), (4, 8), (6, 10), (9, 9), (11, 6), (14, 7)]
    br = [(6, 10), (7, 13), (6, 15)]
    for seg in (pts, br):
        for (x0, y0), (x1, y1) in zip(seg, seg[1:]):
            n = max(abs(x1 - x0), abs(y1 - y0)) + 1
            for i in range(n):
                x = round(x0 + (x1 - x0) * i / max(1, n - 1)); y = round(y0 + (y1 - y0) * i / max(1, n - 1))
                put(px, 16, 16, x, y - 1, RGB('vash', 1)); put(px, 16, 16, x, y, LAV[3] if (x + y) % 3 else LAV[4])
                put(px, 16, 16, x, y + 1, LAV[1])
    put(px, 16, 16, 9, 9, LAV[5])
    return im


def ember_scatter():
    """흩어진 불씨(1칸 장식, 걷기): 재 위 붉은 숯 알갱이."""
    im = blank(16, 16); px = im.load()
    for (x, y, k) in ((3, 4, 4), (9, 3, 3), (12, 8, 5), (5, 10, 3), (10, 12, 4), (2, 13, 2), (14, 13, 3), (7, 7, 2)):
        put(px, 16, 16, x, y, LAV[k]); put(px, 16, 16, x + 1, y, LAV[max(1, k - 2)]); put(px, 16, 16, x, y + 1, RGB('vash', 1))
    return im


def cooled_lava():
    """식은 용암 껍질(2x2 장식, 걷기): 물가에 굳은 작은 아아 용암 혀 — ground-lavafield 와 같은 모난 덩이 결, 남쪽 앞 끝은 어두운 2px."""
    from vf_base import flow_layer
    W, H = 32, 32
    Y, X = np.mgrid[0:H, 0:W]
    d = np.sqrt(((X + 0.5 - 16) / 14.0) ** 2 + ((Y + 0.5 - 14) / 11.5) ** 2) * (1 + (smooth(W, H, 5, 81) - 0.5) * 0.5)
    m = d < 1.0
    return flow_layer(m, seed=85, glow_px=np.full((H, W), 0.5))


def ash_mound():
    """재 둔덕(2x1): 바람에 쌓인 고운 재 더미, 윗면 밝고 바람 맞은 결이 있다. 걷기(낮다)."""
    c = C(32, 16, seed=641)
    c.group(1)
    c.ellipsoid(16, 11, 14, 4.6, 'vash', amb=0.30, bump=0.35, bsc=3.0, bias=0.06)
    c.ellipsoid(11, 9.5, 7, 3.2, 'vash', amb=0.34, bump=0.3, bias=0.12)
    for (x0, x1, y) in ((6, 12, 9), (16, 24, 10), (9, 15, 12)):
        for x in range(x0, x1):
            if c.m[y][x]: c.tone(x, y, 'vash', 3)
    return F(c, 0.78)


# ================================================================ 뼈·순례 표지
def beast_ribs():
    """거대한 짐승 뼈(4x3): 재에 반쯤 묻힌 등뼈와 하늘로 휜 갈비뼈들. 갈비 밑동 줄만 막힘."""
    c = C(64, 48, seed=651); c.shadow(32, 44.5, 28, 2.6, 80)
    # 등뼈: 땅 위로 낮게 휜 줄(마디)
    spine = [(4 + i * 4.0, 42 - math.sin(i / 14 * math.pi) * 4) for i in range(15)]
    for i, (x, y) in enumerate(spine):
        c.new(); c.ellipsoid(x, y, 2.4, 2.0, 'bone', amb=0.3, bump=0.2)
    # 갈비: 등뼈에서 위로 솟아 안쪽으로 휜 호(앞쪽 것 밝게, 뒤쪽 것 어둡게)
    for k, (bx, hgt, side) in enumerate(((14, 26, -1), (22, 31, -1), (30, 33, -1), (38, 31, -1), (46, 26, -1), (18, 22, 1), (27, 27, 1), (36, 26, 1), (44, 21, 1))):
        c.new()
        base_y = 42 - math.sin((bx - 4) / 56 * math.pi) * 4
        for i in range(30):
            f = i / 29
            x = bx + side * math.sin(f * math.pi * 0.9) * 7 + (f ** 2) * 3 * side
            y = base_y - f * hgt
            w = 1.6 - f * 0.8
            for yy in range(int(y - w), int(y + w) + 1):
                for xx in range(int(x - w), int(x + w) + 1):
                    if math.hypot(xx + 0.5 - x, yy + 0.5 - y) <= w + 0.2:
                        t = 5 if xx + 0.5 < x else 3
                        if side > 0: t -= 1
                        c.tone(xx, yy, 'bone', max(1, t))
    # 재 둔덕이 밑을 덮는다
    c.group(9)
    for (x, y, rx) in ((10, 44, 8), (26, 45, 9), (44, 44, 10), (57, 45, 6)):
        c.ellipsoid(x, y, rx, 2.6, 'vash', amb=0.35, bias=0.05, bump=0.3)
    return F(c)


def beast_skull():
    """큰 짐승 머리뼈(2x2): 재 위에 옆으로 누운 긴 머리뼈 — 왼쪽은 이빨 난 긴 주둥이, 오른쪽 뒤통수에서 뿔 하나가 뒤로 휜다.
    눈구멍·콧구멍은 어둡다. 밑줄만 막힘."""
    c = C(32, 32, seed=652); c.shadow(16, 28.8, 14, 2.0, 80)
    c.group(1)
    c.ellipsoid(21, 20, 7.5, 5.6, 'bone', amb=0.25, bump=0.25, bsc=3.0)            # 뒤통수
    c.poly([(4, 21), (6, 17), (16, 15), (18, 25), (6, 26)], 'bone', lambda x, y: 0.82 - 0.02 * (y - 15) - (0.25 if y > 22 else 0), grain=True)   # 주둥이
    c.ellipsoid(17, 25, 5.5, 2.2, 'bone', amb=0.2, bias=-0.12)                     # 턱
    c.group(2); c.new()
    for i in range(26):                                                            # 뿔: 뒤통수 위에서 뒤(오른쪽)로 휘어 끝이 위로
        f = i / 25
        x = 22 + f * 8 - f ** 2 * 1.5; y = 15 - f * 4 - math.sin(f * 3.0) * 4 + f ** 3 * 2
        w = 2.4 - f * 1.9
        for yy in range(int(y - w) - 1, int(y + w) + 2):
            for xx in range(int(x - w) - 1, int(x + w) + 2):
                if math.hypot(xx + 0.5 - x, yy + 0.5 - y) <= w + 0.15: c.tone(xx, yy, 'bone', 5 if yy + 0.5 < y else 3)
    im = F(c); px = im.load()
    for (x, y) in ((17, 18), (18, 18), (17, 19), (18, 19), (19, 19)): put(px, 32, 32, x, y, RGB('vash', 0))     # 눈구멍
    for (x, y) in ((6, 19), (7, 19)): put(px, 32, 32, x, y, RGB('vash', 1))                                     # 콧구멍
    for x in range(6, 16, 2): put(px, 32, 32, x, 23, RGB('bone', 6)); put(px, 32, 32, x + 1, 23, RGB('bone', 2))  # 이빨
    for (x, y) in ((9, 26), (14, 27), (24, 26), (27, 25)): put(px, 32, 32, x, y, RGB('vash', 4))
    return im


def pilgrim_cairn():
    """순례 돌무더기(1x2): 현무암 돌을 쌓고 붉은 천을 맨 막대를 꽂은 길 표지. 밑동 1칸 막힘."""
    c = C(16, 32, seed=661); c.shadow(8, 29.5, 7, 1.6, 80)
    for (cx, cy, rx, ry) in ((8, 26, 6.6, 3.4), (8, 21.5, 5.0, 3.0), (8, 17.5, 3.8, 2.6)):
        c.new(); c.ellipsoid(cx, cy, rx, ry, 'basalt', amb=0.24, bump=0.4, bsc=2.5, bias=0.06)
    c.new()
    for y in range(3, 16): c.tone(9, y, 'char', 4); c.tone(10, y, 'char', 2)
    c.new()
    for (x, y, t) in ((11, 4, 5), (12, 4, 5), (13, 5, 4), (11, 5, 4), (12, 5, 4), (13, 6, 3), (14, 7, 3), (12, 6, 3), (13, 8, 2), (14, 9, 3)):
        c.tone(x, y, 'red', t)
    for (x, y) in ((6, 15), (10, 20), (5, 24)): c.tone(x, y, 'vash', 5)
    return F(c)


# ================================================================ 용암 웅덩이·폭포
def lava_pool():
    """작은 용암 웅덩이(3x2): 현무암 물가 안에서 끓는 용암(거품·껍질). 칸 전체 막힘."""
    W, H = 48, 32
    Y, X = np.mgrid[0:H, 0:W]
    d = np.sqrt(((X + 0.5 - 24) / 22.5) ** 2 + ((Y + 0.5 - 16.5) / 14.0) ** 2) * (1 + (smooth(W, H, 6, 91) - 0.5) * 0.30)
    m = d < 1.0
    a = VL.paint(m, X + 900, Y + 400, per=None, seed=91)
    return Image.fromarray(a, 'RGBA')


def lava_fall():
    """용암 폭포(2x3, 절벽 앞면 위): 앞면 꼭대기 틈에서 둥글게 넘친 용암이 세 줄 높이로 떨어진다. 양옆은 붉게 비친 현무암 뺨,
    몸통은 기둥마다 빠르기 다른 밝은 띠와 식은 껍질 줄, 발치는 튀는 거품과 불티. 막힘."""
    W, H = 32, 48
    im = blank(W, H); px = im.load()
    for y in range(H):
        f = y / (H - 1)
        lw = 3.5 + 1.8 * _hash(y // 3, 1, 33) - (1.6 if y > H - 9 else 0) + (1.2 if y < 3 else 0)
        rw = 3.5 + 1.8 * _hash(y // 3, 2, 33) - (1.6 if y > H - 9 else 0) + (1.2 if y < 3 else 0)
        for x in range(W):
            if x < lw or x > W - 1 - rw:                                     # 바위 뺨
                inner = (x >= lw - 1.2) if x < lw else (x <= W - rw)
                if x < 1 or x > W - 2: t = 0
                else: t = 4 if (x < lw and _hash(x, y // 2, 34) > 0.5) else 2
                c = RGB('basalt', t)
                if inner: c = (110, 34, 18) if x < lw else (150, 52, 22)
                if y > H - 6 and _hash(x, y, 35) > 0.5: c = RGB('basalt', 1)
                put(px, W, H, x, y, c)
                continue
            ph = int(_hash(x, 1, 31) * 40); L = 10 + int(_hash(x, 2, 31) * 12); n = int(_hash(x, 3, 31) * 3)
            v = (y + ph) % L
            t = 2 + n // 2
            if v < 3: t = 5 if n else 4
            elif v < 6: t = 4 if n else 3
            edge = min(x - lw, W - 1 - rw - x)
            if edge < 2: t = max(1, t - 2)
            c = LAV[min(5, t)]
            if _hash(x // 2, (y + ph) // 5, 36) > 0.86 and 6 < y < H - 10: c = (64, 20, 14) if _hash(x, y, 37) > 0.4 else LAV[0]   # 식은 껍질 줄
            if y < 2: c = LAV[5]
            elif y < 4: c = LAV[4]
            if y >= H - 9:
                k = y - (H - 9)
                c = LAV[5] if (x * 3 + k * 5) % 9 < 3 + k // 3 else (LAV[4] if (x + k) % 2 else LAV[3])
            put(px, W, H, x, y, c)
    for (x, y) in ((2, 36), (29, 30), (6, 41), (26, 40), (1, 44), (30, 43)): put(px, W, H, x, y, LAV[4])
    return im


# ================================================================ 다리·계단
def _bas_ash(X, Y, bw=16, bh=8, seed=0):
    """버들항 성 마름돌(castle6.ash) 무늬를 현무암 램프로: 돌마다 톤, 왼쪽·위 밝은 모, 1px 줄눈."""
    from castle6 import ash
    c = ash(X, Y, 1.0, bw, bh, seed)
    l = 0.30 * c[0] + 0.59 * c[1] + 0.11 * c[2]
    t = int(np.clip(round(0.6 + (l - 70) / (225 - 70) * 5.0), 1, 6))
    return RGB('basalt', t)


def basalt_bridge():
    """현무암 다리(세로, 3x6): 마름돌 판석 바닥, 양옆 낮은 난간 돌, 용암에 박힌 육각 교각 머리, 동쪽에 비친 그림자. 걷기."""
    W, H = 48, 96
    im = blank(W, H); px = im.load()
    x0, x1 = 5, 43
    for y in range(H):
        for x in range(x0, x1):
            if x < x0 + 4 or x >= x1 - 4:            # 난간: 윗면(밝게) + 바깥 1px 윤곽
                e = (x - x0) if x < x0 + 4 else (x1 - 1 - x)
                t = 1 if e == 0 else (5 if e == 1 else (4 if e == 2 else 2))
                if (y // 12) % 2 == 0 and y % 12 == 11: t = 1                        # 난간 돌 이음
                if y % 12 == 0 and e > 0: t = min(6, t + 1)
                put(px, W, H, x, y, RGB('basalt', t))
            else:
                c = _bas_ash(x - x0 - 4 + 3, y + 5, 15, 10, seed=4)
                l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11
                t = max(1, min(5, int(round(0.4 + (l - 30) / 120 * 4.6)) - (1 if hash2(x // 6, y // 5, 72) < 0.3 else 0)))
                put(px, W, H, x, y, RGB('basalt', t))
    # 바닥 판석에 재·잔돌, 가운데 닳은 길
    for i in range(40):
        x = int(x0 + 5 + _hash(i, 1, 71) * (x1 - x0 - 10)); y = int(_hash(i, 2, 71) * H)
        put(px, W, H, x, y, RGB('vash', 4 + (i % 3 == 0)))
    # 교각 머리(용암 줄 y 20..76 사이 양옆)
    for (yy, side) in ((30, 0), (58, 0), (30, 1), (58, 1)):
        bx = 0 if side == 0 else x1
        for y in range(yy - 4, yy + 6):
            for x in range(bx, bx + 5):
                if not (0 <= x < W): continue
                top = y < yy
                t = 5 if top and x < bx + 3 else (4 if top else (3 if side == 0 else 2))
                if y == yy + 5: t = 1
                put(px, W, H, x, y, RGB('basalt', t))
        for x in range(bx, bx + 5): put(px, W, H, x, yy + 6, LAV[4] if (x + yy) % 2 else LAV[3])
    # 동쪽 그림자(반투명, 용암 위)
    for y in range(4, H - 4):
        for x in range(x1, min(W, x1 + 3)):
            if px[x, y][3] == 0: px[x, y] = (8, 4, 8, 110 if x == x1 else 70)
    # 남·북 끝: 땅에 닿는 턱(어두운 1px + 밝은 1px)
    for x in range(x0, x1):
        put(px, W, H, x, H - 1, RGB('basalt', 1)); put(px, W, H, x, 0, RGB('basalt', 2))
    return im


def stairs_basalt():
    """절벽 앞면을 깎은 현무암 돌계단(3x3, 절벽 앞면 세 줄 자리): terrain.stair 그대로 + 현무암 램프. 걷기."""
    from vf_base import cliff_render
    lev = [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]]
    im, _ = cliff_render(lev, stairs=[(1, 1, 3)], seed=5)
    a = np.array(im)
    out = a[13:13 + 51, 16:64].copy()
    return Image.fromarray(out, 'RGBA').crop((0, 3, 48, 51))
