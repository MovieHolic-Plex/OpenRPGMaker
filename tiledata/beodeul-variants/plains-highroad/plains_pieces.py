# 초원 하이로드 새 조각들(손 도트, 버들항 팔레트). 모든 함수는 RGBA Image 를 돌려준다. 결정적.
from wl import *
from px2 import _hash, vnoise
import plains_auto as PA   # earth / flag 팔레트 등록

def F(c): return pz.fin(c)

def limb(c, pts, widths, mat='bark', seed=1):
    """가지: 점들을 따라 원판을 찍는다. 왼쪽 밝게·오른쪽 어둡게."""
    c.new()
    n = 24
    for (x0, y0), (x1, y1), w0, w1 in zip(pts, pts[1:], widths, widths[1:]):
        for i in range(n + 1):
            f = i / n; x = x0 + (x1 - x0) * f; y = y0 + (y1 - y0) * f; r = w0 + (w1 - w0) * f
            for yy in range(int(y - r) - 1, int(y + r) + 2):
                for xx in range(int(x - r) - 1, int(x + r) + 2):
                    d = math.hypot(xx + 0.5 - x, yy + 0.5 - y)
                    if d <= r:
                        dx = (xx + 0.5 - x) / max(r, 0.5)
                        t = 5 if dx < -0.35 else (3 if dx > 0.35 else 4)
                        if _hash(xx, yy, seed) > 0.9: t -= 1
                        c.tone(xx, yy, mat, t)

def leafblob(c, cx, cy, rx, ry, bias=0.0, bump=0.5, mat='leaf'):
    c.ellipsoid(cx, cy, rx, ry, mat, amb=0.2, bias=bias, bump=bump, bsc=3.0)

# ================================================================ 식생
def oak_old():
    c = C(48, 64, seed=401); c.shadow(24, 61.0, 19, 3.2, 90)
    c.group(1); c.new()
    # 줄기: 구불구불, 밑에서 뿌리가 퍼진다(밑변 폭 = 줄기 폭 + 뿌리)
    for y in range(34, 63):
        f = (y - 34) / 28.0
        cx = 24 + math.sin(y / 6.0) * 1.2 * (1 - f)
        hw = 3.6 + 1.4 * f + (2.4 * max(0, f - 0.8) / 0.2)
        for x in range(int(cx - hw), int(cx + hw) + 1):
            dx = (x + 0.5 - cx) / hw
            t = 5 if dx < -0.45 else (4 if dx < 0.1 else (3 if dx < 0.6 else 2))
            if _hash(x, y, 7) > 0.88: t -= 1
            if (y + x // 2) % 6 == 0 and _hash(x, y, 8) > 0.4: t -= 1
            c.tone(x, y, 'bark', max(1, t))
    for (x, y, t) in ((22, 50, 1), (23, 51, 1), (22, 44, 2), (25, 40, 1), (26, 46, 2)): c.tone(x, y, 'bark', t)   # 옹이·갈라짐
    limb(c, [(21, 46), (14, 40), (9, 33)], [2.0, 1.5, 1.0], 'bark', 5)                                      # 부러진 옛 가지
    limb(c, [(27, 44), (33, 38), (38, 33)], [2.0, 1.6, 1.0], 'bark', 6)
    # 수관
    c.group(2)
    for (cx, cy, rx, ry, b) in ((24, 22, 20, 13, -0.08), (11, 29, 11, 8, -0.12), (37, 29, 11, 8, -0.14), (24, 31, 15, 7, -0.2),
                                (16, 15, 11, 9, 0.02), (32, 14, 11, 8, 0.0), (24, 10, 9, 7, 0.06)):
        leafblob(c, cx, cy, rx, ry, b)
    # 잎 위 밝은 점, 아래 어두운 점
    for i in range(70):
        x = int(4 + _hash(i, 1, 41) * 40); y = int(3 + _hash(i, 2, 41) * 34)
        if c.m[y][x] == 'leaf':
            if y < 20 and x < 28: c.tone(x, y, 'leaf', 6) if _hash(i, 3, 41) > 0.5 else None
    return F(c)

def dead_tree():
    c = C(32, 48, seed=402); c.shadow(16, 45.4, 9, 2.0, 80)
    limb(c, [(16, 46), (16, 36), (15, 26), (14, 14), (13, 4)], [3.4, 2.6, 2.0, 1.4, 0.9], 'bark', 3)
    limb(c, [(15, 30), (9, 25), (5, 18), (3, 11)], [1.5, 1.2, 0.9, 0.6], 'bark', 4)
    limb(c, [(16, 24), (22, 19), (26, 12), (28, 6)], [1.4, 1.1, 0.8, 0.6], 'bark', 5)
    limb(c, [(14, 17), (10, 12), (9, 6)], [1.0, 0.8, 0.5], 'bark', 6)
    limb(c, [(5, 18), (9, 14)], [0.8, 0.5], 'bark', 7)
    limb(c, [(26, 12), (22, 9)], [0.7, 0.4], 'bark', 8)
    for (x, y) in ((15, 38), (16, 42), (17, 33)): c.tone(x, y, 'bark', 1)
    for (x, y) in ((13, 37), (14, 41)): c.tone(x, y, 'bark', 6)       # 껍질 벗겨진 밝은 자리
    c.new()
    for (x, y) in ((17, 44), (14, 44), (18, 45)): c.tone(x, y, 'leaf', 3)   # 밑동 풀
    return F(c)

def thorn_bush():
    c = C(16, 16, seed=403); c.shadow(8, 13.4, 6, 1.4, 70)
    c.new(); c.ellipsoid(8, 9, 6.5, 5.2, 'moss', amb=0.25, bump=0.55, bsc=2.2)
    c.new(); c.ellipsoid(6, 7.5, 3.6, 3, 'leaf', amb=0.3, bias=0.05, bump=0.6, bsc=2.0)
    for (x, y) in ((3, 5), (6, 3), (10, 4), (13, 8), (2, 9), (12, 5)): c.tone(x, y, 'bark', 3); c.tone(x + 1, y - 1, 'bark', 5)   # 가시
    for (x, y) in ((6, 9), (9, 7), (10, 11), (4, 10)): c.tone(x, y, 'red', 4); c.tone(x, y - 1, 'red', 5)                     # 열매
    return F(c)

def berry_bush():
    c = C(32, 16, seed=404); c.shadow(16, 13.5, 13, 1.5, 70)
    for (cx, cy, rx, ry, b) in ((9, 9, 8, 6, -0.04), (22, 9, 9, 6, -0.04), (16, 7, 7, 5.5, 0.05)):
        c.new(); c.ellipsoid(cx, cy, rx, ry, 'leaf', amb=0.2, bias=b, bump=0.55, bsc=2.4)
    for i in range(14):
        x = int(4 + _hash(i, 1, 44) * 24); y = int(4 + _hash(i, 2, 44) * 8)
        if c.m[y][x] == 'leaf': c.tone(x, y, 'shroom', 5); c.tone(x + 1, y, 'shroom', 3)     # 산딸기(보랏빛)
    for (x, y) in ((8, 6), (20, 5), (24, 9)): c.tone(x, y, 'red', 5)
    return F(c)

def _blades(c, specs, mat='leaf'):
    for (x, h, dx, t0) in specs:
        c.new()
        for k in range(h):
            xx = x + int(round(dx * k / max(1, h - 1))); yy = 15 - k
            c.tone(xx, yy, mat, t0 if k < h * 0.5 else min(5, t0 + 1) if k < h - 1 else 6)
            if k < h * 0.5: c.tone(xx + 1, yy, mat, 2 if k < 2 else max(2, t0 - 1))

def tallgrass_a():
    c = C(16, 16, seed=411)
    _blades(c, [(3, 11, -2, 3), (5, 13, 1, 4), (7, 9, -1, 3), (9, 14, 2, 4), (11, 10, 2, 3), (13, 8, 1, 3)])
    return c.img(False)

def tallgrass_b():
    c = C(32, 16, seed=412)
    _blades(c, [(2, 9, -1, 3), (5, 12, 1, 4), (8, 14, -2, 4), (11, 10, 2, 3), (14, 13, 1, 4), (17, 15, -1, 4), (20, 11, 2, 3), (23, 14, 1, 4), (26, 9, -1, 3), (29, 11, 1, 3)])
    return c.img(False)

def tallgrass_c():
    c = C(16, 16, seed=413)
    _blades(c, [(3, 12, -1, 3), (6, 14, 1, 3), (9, 11, 0, 4), (12, 13, 1, 3)])
    for (x, y) in ((2, 3), (7, 1), (10, 4), (13, 2)):          # 이삭
        c.tone(x, y, 'gold', 5); c.tone(x, y + 1, 'gold', 4); c.tone(x + 1, y + 1, 'gold', 3)
    return c.img(False)

def _flower(c, x, y, head, ctr, tall=4):
    for k in range(tall): c.tone(x, y + 1 + k, 'leaf', 3)
    c.tone(x - 1, y + 3, 'leaf', 4); c.tone(x + 1, y + 4, 'leaf', 4)
    c.tone(x, y, ctr[0], ctr[1])
    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)): c.tone(x + dx, y + dy, head[0], head[1])

def _flowers(seed, head, ctr):
    c = C(16, 16, seed=seed)
    for (x, y) in ((3, 4), (8, 2), (13, 4), (5, 8), (11, 8), (1, 10), (8, 11), (14, 11)):
        c.new(); _flower(c, x, y, head, ctr, 3)
    for (x, y) in ((6, 14), (9, 14), (3, 14), (12, 14)): c.tone(x, y, 'leaf', 3); c.tone(x, y - 1, 'leaf', 4)
    return c.img(False)
def flowers_red(): return _flowers(421, ('red', 5), ('gold', 5))
def flowers_yellow(): return _flowers(422, ('gold', 5), ('gold', 3))
def flowers_white(): return _flowers(423, ('cream', 6), ('gold', 4))
def flowers_blue(): return _flowers(424, ('shroom', 5), ('cream', 6))

def mushrooms():
    c = C(32, 16, seed=431); c.shadow(16, 14, 12, 1.4, 60)
    for (x, y, r) in ((8, 12, 4), (16, 13, 3), (23, 11, 4), (12, 14, 2)):
        c.new(); c.cylinder(x, y - 5, y, 1.3, 'cream', cap=False)
        c.new(); c.ellipsoid(x, y - 5, r, r * 0.7, 'red', amb=0.2, bump=0.1)
        for (dx, dy) in ((-1, -1), (1, 0), (0, -2)):
            if r >= 3: c.tone(x + dx, y - 5 + dy, 'cream', 6)
    return F(c)

def stump_s():
    c = C(16, 16, seed=432); c.shadow(8, 13.4, 6, 1.4, 70)
    c.new(); c.cylinder(8, 6, 13, 5.2, 'bark', cap=True, capry=2.8, amb=0.3)
    c.new()
    for y in range(3, 10):
        for x in range(3, 14):
            dx = (x + 0.5 - 8) / 5.2; dy = (y + 0.5 - 6.5) / 2.9; r = dx * dx + dy * dy
            if r <= 1: c.tone(x, y, 'cream', (4, 3, 4, 2)[min(3, int(math.sqrt(r) * 3.4))] if r < 0.8 else 2)
    for (x, y) in ((4, 12), (11, 12), (6, 13)): c.tone(x, y, 'bark', 2)
    return F(c)

def log_fallen():
    c = C(32, 16, seed=433); c.shadow(16, 13.6, 14, 1.6, 70)
    c.new(); c.hcyl(4, 28, 9, 4.6, 'bark', amb=0.25, endcap='L', capmat='cream')
    for (x, y) in ((10, 6), (18, 7), (23, 6), (14, 11)): c.tone(x, y, 'bark', 2)
    for (x, y) in ((12, 5), (13, 5), (20, 5), (21, 4), (26, 6)): c.tone(x, y, 'moss', 4)
    c.new(); c.tone(25, 3, 'bark', 4); c.tone(26, 2, 'bark', 5); c.tone(26, 3, 'bark', 3)       # 가지 그루터기
    return F(c)

# ================================================================ 돌·길가 표지
def rockpile():
    c = C(32, 16, seed=441); c.shadow(16, 13.6, 14, 1.7, 80)
    for (cx, cy, rx, ry, b) in ((9, 10, 7, 4.6, -0.04), (22, 10, 8, 5, -0.04), (15, 7, 6.4, 4.4, 0.06), (28, 12, 3, 2.4, -0.05), (4, 12, 3, 2.2, -0.06)):
        c.new(); c.ellipsoid(cx, cy, rx, ry, 'stone', amb=0.2, bias=b, bump=0.5, bsc=3.0)
    for (x, y) in ((13, 6), (20, 9), (7, 9)): c.tone(x, y, 'moss', 4)
    return F(c)

def boulder():
    c = C(32, 32, seed=442); c.shadow(16, 28.6, 14, 2.4, 90)
    c.new(); c.ellipsoid(16, 19, 14.5, 10.4, 'stone', amb=0.18, bump=0.5, bsc=3.4)
    c.new(); c.ellipsoid(12, 14, 7, 5, 'stone', amb=0.2, bias=0.08, bump=0.45, bsc=3.0)
    for i in range(34):
        x = int(4 + _hash(i, 1, 45) * 24); y = int(8 + _hash(i, 2, 45) * 16)
        if c.m[y][x] == 'stone' and _hash(i, 3, 45) > 0.5 and (y > 15 or x < 12): c.tone(x, y, 'moss', 3 + (i % 3 == 0))
    for (x0, y0, x1, y1) in ((20, 12, 24, 17), (9, 22, 14, 24)): c.line(x0, y0, x1, y1, 'stone', 1)
    return F(c)

def rocks_small():
    c = C(16, 16, seed=443)
    for (cx, cy, rx, ry) in ((5, 11, 3.6, 2.6), (11, 12, 3.2, 2.4), (9, 8.5, 2.6, 2.0)):
        c.new(); c.ellipsoid(cx, cy, rx, ry, 'stone', amb=0.2, bump=0.4)
    return F(c)

def cairn():
    c = C(16, 24, seed=444); c.shadow(8, 21.4, 7, 1.6, 80)
    for (cx, cy, rx, ry) in ((8, 18, 6.4, 3.4), (8, 13.5, 5, 3), (8, 9.5, 3.8, 2.6), (8, 6, 2.4, 2.0)):
        c.new(); c.ellipsoid(cx, cy, rx, ry, 'stone', amb=0.2, bump=0.35, bsc=2.5)
    c.tone(8, 3, 'stone', 6); c.tone(7, 4, 'stone', 5)
    return F(c)

def menhir():
    c = C(16, 32, seed=445); c.shadow(8, 29.4, 6.5, 1.6, 90)
    c.new()
    pts = [(4, 28), (3, 18), (4, 9), (7, 3), (10, 2), (12, 7), (13, 17), (12, 28)]
    c.poly(pts, 'stone', lambda x, y: 0.62 + (0.22 if x < 7 else (-0.08 if x > 10 else 0.08)) - 0.1 * (y / 32.0), grain=True)
    for (x0, y0, x1, y1) in ((7, 8, 7, 13), (10, 12, 10, 19), (6, 17, 6, 24)): c.line(x0, y0, x1, y1, 'stone', 1)   # 새긴 홈
    for (x, y) in ((8, 8), (8, 16), (9, 20)): c.tone(x, y, 'stone', 2)
    for i in range(24):
        x = int(3 + _hash(i, 1, 46) * 10); y = int(14 + _hash(i, 2, 46) * 14)
        if c.m[y][x] == 'stone' and _hash(i, 3, 46) > 0.45: c.tone(x, y, 'moss', 3)
    c.new()
    for (x, y) in ((3, 29), (5, 30), (12, 29), (14, 28)): c.tone(x, y, 'leaf', 3)
    return F(c)

def waystone():
    c = C(16, 24, seed=446); c.shadow(8, 21.4, 6, 1.5, 80)
    c.new(); c.box(3, 6, 10, 3, 12, 'stone', top=0.95, front=0.6)
    c.new(); c.ellipsoid(8, 7, 5.4, 3.0, 'stone', amb=0.3, bias=0.1)
    for (x, y) in ((8, 12), (7, 13), (9, 13), (6, 14), (10, 14), (8, 13), (8, 14), (8, 15), (8, 16)): c.tone(x, y, 'stone', 2)     # 화살 새김
    for (x, y) in ((4, 14), (11, 17), (5, 18), (10, 11)): c.tone(x, y, 'moss', 4)
    c.new(); c.tone(3, 20, 'stone', 3); c.tone(4, 20, 'stone', 4); c.tone(12, 20, 'stone', 3); c.tone(11, 21, 'stone', 3)
    return F(c)

def signpost_fork():
    c = C(16, 32, seed=447); c.shadow(8, 29.4, 5, 1.3, 70)
    c.group(1); c.new()
    for y in range(6, 30): c.tone(7, y, 'bark', 5); c.tone(8, y, 'bark', 3)
    c.tone(7, 5, 'bark', 6); c.tone(8, 5, 'bark', 4)
    boards = [(3, -1, 13, 'wood'), (11, 1, 13, 'wood'), (19, -1, 11, 'wood')]
    for g, (y, d, w, mt) in enumerate(boards):
        c.group(2 + g); c.new()
        x0, x1 = (8 - w + 3, 11) if d < 0 else (5, 8 + w - 3)
        x0 = max(0, x0); x1 = min(16, x1)
        for yy in range(y, y + 5):
            for xx in range(x0, x1):
                tip = (xx == x0 and d < 0) or (xx == x1 - 1 and d > 0)
                if tip and yy in (y, y + 4): continue
                c.tone(xx, yy, mt, 5 if yy == y else (4 if yy < y + 3 else 2))
        for xx in range(x0 + 3, x1 - 2, 2): c.tone(xx, y + 2, 'wood', 2)
        c.tone(7, y + 2, 'iron', 3); c.tone(8, y + 2, 'iron', 3)
    c.group(9); c.new(); c.tone(6, 29, 'leaf', 4); c.tone(10, 29, 'leaf', 3); c.tone(5, 30, 'leaf', 3)
    return F(c)

# ================================================================ 야영지
def campfire():
    c = C(32, 32, seed=451); c.shadow(16, 27, 12, 2.4, 100)
    for i in range(10):
        a = i / 10 * 6.283; x = 16 + math.cos(a) * 10.5; y = 22 + math.sin(a) * 4.8
        c.new(); c.ellipsoid(x, y, 3.2, 2.7, 'stone', amb=0.2, bump=0.4)
    c.new(); c.ellipsoid(16, 22, 8, 3.2, 'dark', amb=0.3, bias=-0.1)             # 재
    for (x0, y0, x1, y1, ex) in ((9, 25, 22, 19, 1), (10, 19, 23, 25, 1), (13, 22, 20, 22, 0)):
        c.new()
        for k in range(0, 3):
            c.line(x0, y0 + k, x1, y1 + k, 'bark', (5, 4, 2)[k])
        c.tone(x0 - 1, y0 + 1, 'cream', 5); c.tone(x0 - 1, y0, 'cream', 4)
    im = F(c); px = im.load()
    rows = ["......6......", ".....565.....", "....56765....", "...4567654...", "...3456543...", "..234565432..", "..234555432..", "...2344432..."]
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch == '.': continue
            x = 16 - 6 + i; y = 6 + j + 4
            px[x, y] = hx(PAL['flame'][int(ch) - 1]) + (255,)
    for (x, y) in ((11, 16), (21, 15), (14, 12), (19, 10)): px[x, y] = hx(PAL['flame'][5]) + (255,)   # 불똥
    return im

def tent_a():
    c = Cv(48, 48)
    ridge = (24, 7); apexF = (24, 22); LF = (7, 38); RF = (41, 38); LB = (7, 23); RB = (41, 23)
    def poly(pts, fn):
        ys = [p[1] for p in pts]
        for y in range(min(ys), max(ys) + 1):
            xs = []
            for i in range(len(pts)):
                (x1, y1), (x2, y2) = pts[i], pts[(i + 1) % len(pts)]
                if (y1 <= y + 0.5 < y2) or (y2 <= y + 0.5 < y1): xs.append(x1 + (y + 0.5 - y1) * (x2 - x1) / (y2 - y1))
            xs.sort()
            for a, b in zip(xs[::2], xs[1::2]):
                for x in range(int(round(a)), int(round(b))): fn(x, y)
    # 그림자
    # 왼 경사(밝음) / 오른 경사(어두움)
    poly([ridge, apexF, LF, LB], lambda x, y: c.set(x, y, 'plaster', 5 if (x + y) % 9 else 4))
    poly([ridge, RB, RF, apexF], lambda x, y: c.set(x, y, 'plaster', 3 if (x + y) % 9 else 2))
    # 이음 줄과 능선 붉은 띠
    for yy in range(8, 23):
        c.set(24, yy, 'red', 4); c.set(23, yy, 'red', 5); c.set(25, yy, 'red', 3)
    # 앞면(박공): 천막 입구
    poly([apexF, LF, RF], lambda x, y: c.set(x, y, 'plaster', 4 if x < 24 else 3))
    poly([(24, 27), (17, 38), (31, 38)], lambda x, y: c.set(x, y, 'dark', 1 if abs(x - 24) < 3 + (y - 27) * 0.2 else 2))
    # 입구 벌어진 천 자락(양쪽)
    for y in range(28, 38):
        c.set(int(24 - 1.0 - (y - 27) * 0.62), y, 'plaster', 6)
        c.set(int(24 + 0.5 + (y - 27) * 0.62), y, 'plaster', 4)
    # 아랫단 헝겊 띠
    for x in range(7, 42):
        if c.m[38][x]: c.set(x, 38, 'red', 3)
    # 능선 막대 끝, 말뚝, 줄
    c.rect(23, 5, 25, 7, 'bark', 4); c.set(24, 4, 'bark', 5)
    for (x, y) in ((6, 40), (42, 40), (3, 36), (45, 36)): c.rect(x, y, x + 1, y + 2, 'bark', 4)
    im = c.img()
    sh = Image.new('RGBA', (48, 48), (0, 0, 0, 0)); p = sh.load()
    for y in range(36, 46):
        for x in range(2, 47):
            if ((x - 25) / 22.0) ** 2 + ((y - 40) / 4.6) ** 2 < 1: p[x, y] = (14, 30, 8, 70)
    sh.alpha_composite(im); return sh

def bedroll():
    c = C(32, 16, seed=452); c.shadow(16, 13.4, 13, 1.8, 70)
    c.new(); c.hcyl(4, 26, 9, 4.2, 'cloth', amb=0.25, endcap='L', capmat='cloth')
    c.new(); c.hcyl(21, 28, 9, 4.4, 'cream', amb=0.3)
    for x in (9, 14):
        for y in range(5, 14): c.tone(x, y, 'bark', 3) if c.m[y][x] else None
    c.new()
    for x in range(5, 21): c.tone(x, 6, 'red', 3 + (x % 5 == 0)) if c.m[6][x] else None
    return F(c)

def log_seat():
    c = C(32, 16, seed=453); c.shadow(16, 13.6, 14, 1.6, 70)
    c.new(); c.hcyl(3, 29, 10, 3.6, 'bark', amb=0.25, endcap='R', capmat='cream')
    c.new(); c.hcyl(5, 27, 7, 3.0, 'bark', amb=0.2, bias=0.1)
    for (x, y) in ((10, 6), (17, 7), (22, 6)): c.tone(x, y, 'bark', 2)
    return F(c)

def tripod_pot():
    c = C(32, 32, seed=454); c.shadow(16, 28, 10, 2.0, 90)
    c.group(0); c.new(); c.ellipsoid(16, 25, 8, 2.8, 'dark', amb=0.3, bias=-0.1)
    for (x0, y0, t) in ((5, 29, 5), (27, 29, 3), (16, 31, 4)):
        c.group(1); c.new()
        for k in range(0, 27):
            f = k / 26.0; x = 16 + (x0 - 16) * f; y = 4 + (y0 - 4) * f
            c.tone(int(round(x)), int(round(y)), 'bark', t); c.tone(int(round(x)) + 1, int(round(y)), 'bark', 2)
    c.group(2); c.new()
    for y in range(4, 12): c.tone(16, y, 'iron', 4); c.tone(17, y, 'iron', 2)
    c.group(3); c.new()
    for y in range(12, 22):
        for x in range(9, 24):
            dx = (x + 0.5 - 16.2) / 7.4; dy = (y + 0.5 - 17.2) / 5.6; r = dx * dx + dy * dy
            if r <= 1: c.tone(x, y, 'iron', 5 if (dx < -0.35 and dy < 0.2) else (3 if dx > 0.4 else 4))
    for x in range(10, 23): c.tone(x, 12, 'iron', 5 if x < 16 else 4); c.tone(x, 13, 'gold', 3) if 11 < x < 21 else None   # 끓는 국물
    c.group(4); c.new()
    for (x, y) in ((11, 14), (12, 14), (20, 14)): c.tone(x, y, 'iron', 6)
    im = F(c); px = im.load()
    for (x, y, t) in ((13, 25, 3), (14, 24, 4), (14, 25, 5), (15, 23, 5), (15, 24, 6), (16, 23, 5), (16, 24, 6), (17, 24, 5), (18, 25, 4), (17, 23, 3), (19, 25, 3)):
        px[x, y] = hx(PAL['flame'][t]) + (255,)
    return im

# ================================================================ 농가·길 소품
def haystack_cone():
    c = C(32, 32, seed=461); c.shadow(16, 29.4, 14, 2.0, 80)
    c.group(1)
    def v(x, y):
        yy = (y - 6) / 22.0; half = 2 + 12 * yy
        dx = (x - 16.0) / max(half, 1)
        return 0.82 - 0.4 * (dx + 1) / 2 - 0.1 * yy
    c.poly([(14, 4), (18, 4), (31, 28), (1, 28)], 'rope', v, grain=True)
    c.new(); c.ellipsoid(16, 27, 15, 3.8, 'rope', amb=0.3, bias=-0.12, bump=0.5)
    for i in range(80):
        x = int(3 + _hash(i, 1, 462) * 26); y = int(6 + _hash(i, 2, 462) * 21)
        if c.m[y][x] == 'rope' and c.m[min(31, y + 2)][x] == 'rope':
            t = 5 if x < 14 else (4 if x < 20 else 3)
            c.tone(x, y, 'rope', t); c.tone(x, y + 1, 'rope', max(1, t - 1))
    for (y, a) in ((12, 5), (19, 8)):                      # 묶음 띠
        for x in range(16 - a - 2, 16 + a + 3):
            if c.m[y][x]: c.tone(x, y, 'bark', 3)
    c.group(2); c.new(); c.tone(15, 1, 'bark', 5); c.tone(16, 1, 'bark', 3); c.tone(15, 2, 'bark', 4); c.tone(16, 2, 'bark', 3); c.tone(15, 3, 'bark', 4); c.tone(16, 3, 'bark', 2)
    return F(c)

def haybale():
    c = C(32, 24, seed=463); c.shadow(16, 21.4, 14, 2.0, 80)
    def bale(x0, y0):
        c.new(); c.box(x0, y0, 14, 4, 8, 'rope', top=0.92, front=0.62)
        for x in (x0 + 4, x0 + 9):
            for y in range(y0, y0 + 12): c.tone(x, y, 'bark', 3) if c.m[y][x] else None
        for i in range(30):
            x = x0 + int(_hash(i, 1, 464 + x0) * 14); y = y0 + 4 + int(_hash(i, 2, 464 + y0) * 8)
            if c.m[y][x]: c.tone(x, y, 'rope', 5 if i % 2 else 3)
    bale(2, 10); bale(17, 11); bale(9, 4)
    return F(c)

def scarecrow_b():
    c = C(16, 32, seed=465); c.shadow(8, 29.6, 4.4, 1.2, 70)
    c.group(1); c.new()
    for y in range(9, 30): c.tone(7, y, 'bark', 5); c.tone(8, y, 'bark', 3)
    c.group(2); c.new()
    for x in range(1, 15): c.tone(x, 13, 'bark', 5); c.tone(x, 14, 'bark', 3)
    c.group(3); c.box(4, 12, 8, 0, 10, 'cryst', front=0.55)
    for (x, y) in ((5, 22), (10, 20), (6, 24)): c.tone(x, y, 'cream', 4)                 # 헝겊 덧댐
    for x in range(3, 13): c.tone(x, 22, 'cryst', 2) if c.m[22][x] else None
    for (x, y) in ((0, 15), (0, 17), (15, 15), (15, 18), (1, 16), (14, 17)): c.tone(x, y, 'gold', 5)   # 짚 삐져나옴
    c.group(4); c.ellipsoid(8, 8, 3.2, 3.4, 'cream', amb=0.4, bias=0.05)
    c.tone(7, 8, 'dark', 1); c.tone(9, 8, 'dark', 1); c.tone(8, 10, 'dark', 1)
    c.group(5); c.poly([(8, -1), (4, 5), (12, 5)], 'bark', 0.55)                         # 고깔 모자
    for x in range(3, 13): c.tone(x, 5, 'bark', 3)
    c.group(6); c.new(); c.ellipsoid(13, 11, 2.2, 1.6, 'dark', amb=0.3, bias=-0.1); c.tone(15, 11, 'gold', 5); c.tone(12, 10, 'cream', 4)   # 어깨 위 까마귀
    return F(c)

def cart_broken():
    c = Cv(48, 32)
    # 바닥 그림자(반투명은 아래에서 따로)
    # 짐칸: 안쪽 바닥(어두움) + 뒤·옆 테두리 + 앞면
    for y in range(7, 15):
        for x in range(11, 35): c.set(x, y, 'wood', 2 if (x + y // 3) % 5 else 1)
    for x in range(10, 36): c.set(x, 5, 'wood', 5); c.set(x, 6, 'wood', 4)                 # 뒤 테두리
    for y in range(5, 16): c.set(10, y, 'wood', 5); c.set(11, y, 'wood', 4); c.set(34, y, 'wood', 3); c.set(35, y, 'wood', 2)
    for x in range(10, 36): c.set(x, 15, 'wood', 6 if x < 20 else 5)                          # 앞 테두리 윗면
    for y in range(16, 24):                                                                   # 앞판(널 세로 줄)
        for x in range(10, 36):
            t = 4 if y < 18 else 3
            if (x - 10) % 6 == 5: t = 1
            if hash2(x, y, 8) > 0.93: t -= 1
            c.set(x, y, 'wood', t)
    for y in range(16, 24):                                                                   # 부서져 빠진 널 하나
        for x in range(23, 28): c.set(x, y, None, 0) if False else None
    for y in range(16, 24):
        for x in range(23, 27):
            c.m[y][x] = ('dark', 1 if y > 17 else 2)
    for x in range(10, 36): c.set(x, 24, 'wood', 1)
    # 채(부러진)
    for k in range(0, 9): c.set(9 - k, 11 + k, 'wood', 5); c.set(8 - k, 11 + k, 'wood', 3)
    c.set(0, 20, 'wood', 6); c.set(1, 20, 'wood', 5)
    # 온전한 바퀴(앞면 쪽, 살이 둘 빠짐)
    cx, cy, r = 21.5, 24.5, 6.6
    for y in range(16, 32):
        for x in range(13, 31):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if r - 1.9 < d <= r: c.set(x, y, 'bark', 5 if (x + 0.5 < cx and y + 0.5 < cy) else (3 if x + 0.5 > cx else 4))
            elif d <= 1.9: c.set(x, y, 'iron', 4)
    for (dx, dy) in ((0, -1), (0, 1), (-1, 0), (1, 0)):
        if (dx, dy) in ((0, -1), (1, 0)):
            for k in range(2, int(r - 1.5)): c.set(int(cx - 0.5 + dx * k), int(cy - 0.5 + dy * k), 'bark', 4)
    # 떨어져 나뒹구는 바퀴(눕혀짐: 납작한 타원 고리)
    for y in range(24, 31):
        for x in range(34, 48):
            dx = (x + 0.5 - 41) / 6.8; dy = (y + 0.5 - 27.5) / 3.2; rr = dx * dx + dy * dy
            if 0.45 < rr <= 1.0: c.set(x, y, 'bark', 5 if dy < 0 else 3)
            elif rr <= 0.45 and abs(dx) < 0.12 or (rr <= 0.45 and abs(dy) < 0.12): c.set(x, y, 'bark', 3)
    im = c.img()
    sh = Image.new('RGBA', (48, 32), (0, 0, 0, 0)); p = sh.load()
    for y in range(26, 32):
        for x in range(4, 46):
            if ((x - 24) / 21.0) ** 2 + ((y - 29) / 2.6) ** 2 < 1: p[x, y] = (14, 30, 8, 70)
    sh.alpha_composite(im); return sh

def hsh(k): return _hash(int(k), 1, 477)

# ================================================================ 물·다리
def pond_s():
    Wp, Hp = 64, 48
    Y, X = np.mgrid[0:Hp, 0:Wp].astype(float)
    cx, cy, rx, ry = 31.5, 25.0, 27.0, 17.5
    nz = vnoise_arr(X, Y, 6.0, 51) * 0.5 + vnoise_arr(X, Y, 2.5, 52) * 0.5
    rr = np.hypot((X + 0.5 - cx) / rx, (Y + 0.5 - cy) / ry) * (1 + (nz - 0.5) * 0.30)
    inside = rr <= 1.0
    water = rr <= 0.93
    from scipy import ndimage as ndi
    dist = ndi.distance_transform_edt(inside)
    wd = ndi.distance_transform_edt(water)
    t = 3.0 + (vnoise_arr(X, Y * 2.2, 8.0, 53) - 0.5) * 2.0 - (wd > 7) * 0.8 + (wd <= 2) * 0.9
    streak = (hash2(X, Y // 3, 54) > 0.93) & (hash2(X // 2, Y // 6, 55) > 0.35)
    t = np.where(streak, t + 2, t)
    t = np.clip(np.rint(t + (hash2(X, Y, 56) - 0.5) * 0.5), 2, 6).astype(int)
    rgb = P('teal')[t]
    # 뭍 가장자리: 젖은 흙 띠 + 풀 끝
    bank = inside & ~water
    rgb = np.where(bank[..., None], P('earth')[np.where(hash2(X, Y, 57) > 0.55, 3, 2)], rgb)
    rim = water & (wd <= 1.0)
    rgb = np.where(rim[..., None], P('teal')[np.where(hash2(X, Y, 58) > 0.4, 6, 5)], rgb)
    a = np.where(inside, 255, 0).astype(np.uint8)
    # 바깥 풀 잔털
    tuft = ~inside & (dist == 0) & (ndi.distance_transform_edt(~inside) < 1.9) & (hash2(X, Y, 59) > 0.55)
    tcol = np.array(PA.LAWN)[(hash2(X, Y, 60) * 6).astype(int).clip(0, 5)]
    rgb = np.where(tuft[..., None], tcol, rgb); a = np.where(tuft, 255, a)
    # 가장 바깥 윤곽
    im = Image.fromarray(np.dstack([rgb.astype(np.uint8), a]), 'RGBA').copy()
    px = im.load()
    for y in range(Hp):
        for x in range(Wp):
            if inside[y, x] and not water[y, x]:
                # 가장 바깥 한 줄을 어두운 흙 윤곽으로
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < Wp and 0 <= yy < Hp and not inside[yy, xx] and not tuft[yy, xx]: px[x, y] = hx(PAL['earth'][1]) + (255,); break
    # 갈대·수련
    c = C(64, 48, seed=468)
    for (x, y, h) in ((6, 36, 12), (9, 38, 15), (12, 37, 10), (55, 34, 13), (52, 36, 10), (58, 36, 11), (46, 40, 9), (20, 41, 9)):
        c.new()
        for k in range(h): c.tone(x + (k // 6), y - k, 'leaf', 4 if k < h - 3 else 5); c.tone(x + 1 + (k // 6), y - k, 'leaf', 3)
        c.tone(x + (h // 6), y - h, 'bark', 4); c.tone(x + (h // 6), y - h - 1, 'bark', 5)         # 부들 이삭
    for (x, y) in ((24, 24), (36, 29), (30, 20)):
        c.new(); c.ellipsoid(x, y, 3.6, 2.0, 'lily', amb=0.3, bump=0.1)
    c.tone(36, 28, 'red', 5); c.tone(37, 28, 'cream', 6)
    im.alpha_composite(c.img(False))
    return im

def vnoise_arr(X, Y, sc, seed):
    from px2 import vnoise as vn
    f = np.vectorize(lambda x, y: vn(x, y, sc, seed)); return f(X, Y)

def hash2(X, Y, s):
    import wl; return wl.hash2(X, Y, s)

def ford_stones():
    c = C(48, 16, seed=469)
    for (x, y, rx) in ((8, 8, 5.8), (24, 9, 6.4), (40, 8, 5.6)):
        c.new(); c.cylinder(x, y - 2, y + 2, rx, 'stone', cap=True, capry=3.0, amb=0.28)
        c.tone(int(x - 2), y - 4, 'stone', 6); c.tone(int(x - 3), y - 3, 'stone', 6)
        c.tone(int(x + 1), y - 3, 'moss', 4)
    c.new()
    for (x, y) in ((15, 12), (16, 12), (32, 13), (31, 13), (3, 13)): c.tone(x, y, 'teal', 6)           # 물튐
    return F(c)

def _plank_band(c, x0, x1, y0, y1, vertical):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            k = (x - x0) // 4 if vertical else (y - y0) // 4
            u = (x - x0) % 4 if vertical else (y - y0) % 4
            t = 6 if u == 0 else (5 if u in (1, 2) else 3)
            if u == 3: t = 2
            seam = ((y - y0 if vertical else x - x0) + k * 7) % 13 == 0
            if seam and u != 3: t = 3
            if hash2(x, y, 71) > 0.95: t -= 1
            c.set(x, y, 'wood', max(1, t))

def bridge_h():
    c = Cv(64, 32)
    _plank_band(c, 0, 63, 9, 27, True)
    for x in range(0, 64): c.set(x, 28, 'wood', 4); c.set(x, 29, 'wood', 3); c.set(x, 30, 'wood', 2)        # 앞 보 옆면
    for x in range(3, 64, 8): c.set(x, 28, 'iron', 3)
    for ry in (3, 6):                                                                                       # 뒤 난간 가로대
        for x in range(0, 64): c.set(x, ry, 'wood', 4); c.set(x, ry + 1, 'wood', 3)
    for px_ in (0, 20, 41, 61):                                                                             # 뒤 난간 기둥
        for y in range(0, 10):
            c.set(px_, y, 'wood', 5); c.set(px_ + 1, y, 'wood', 4); c.set(px_ + 2, y, 'wood', 3)
    for px_ in (0, 61):                                                                                      # 앞 모서리 기둥
        for y in range(20, 31): c.set(px_, y, 'wood', 5); c.set(px_ + 1, y, 'wood', 4); c.set(px_ + 2, y, 'wood', 3)
        c.rect(px_, 19, px_ + 2, 19, 'wood', 6)
    im = c.img(True)
    sh = Image.new('RGBA', (64, 32), (0, 0, 0, 0)); p = sh.load()
    for y in range(30, 32):
        for x in range(2, 62): p[x, y] = (7, 21, 40, 90)
    sh.alpha_composite(im); return sh

def bridge_v():
    c = Cv(32, 64)
    _plank_band(c, 7, 24, 5, 59, False)
    for y in range(5, 60): c.set(6, y, 'wood', 3); c.set(25, y, 'wood', 2)                                      # 옆 보
    for x in range(6, 26): c.set(x, 60, 'wood', 4); c.set(x, 61, 'wood', 3); c.set(x, 62, 'wood', 2)              # 남쪽 끝 단면
    for ry in (12, 28, 44):                                                                                      # 난간 가로대(왼·오른)
        pass
    for side in (3, 26):
        for y in range(4, 61):
            c.set(side + 1, y, 'wood', 4); c.set(side + 2, y, 'wood', 3)
        for py in (4, 20, 36, 52):
            for y in range(py, py + 9):
                for x in range(side, side + 4): c.set(x, y, 'wood', 5 if x == side else (4 if x < side + 3 else 3))
            for x in range(side, side + 4): c.set(x, py - 1, 'wood', 6 if x == side else 5)
    im = c.img(True)
    sh = Image.new('RGBA', (32, 64), (0, 0, 0, 0)); p = sh.load()
    for y in range(62, 64):
        for x in range(5, 27): p[x, y] = (7, 21, 40, 90)
    sh.alpha_composite(im); return sh

def gate_wood():
    c = Cv(32, 24)
    for px0 in (1, 27):
        for x in range(px0, px0 + 4):
            c.set(x, 2, 'wood', 6 if x == px0 else 5); c.set(x, 3, 'wood', 5)
            for y in range(4, 22): c.set(x, y, 'wood', 5 if x == px0 else (4 if x < px0 + 3 else 3))
            c.set(x, 22, 'wood', 2); c.set(x, 23, 'wood', 1)
    for ry in (6, 14):
        for x in range(5, 27):
            c.set(x, ry, 'wood', 5); c.set(x, ry + 1, 'wood', 4); c.set(x, ry + 2, 'wood', 3)
    for k in range(0, 21):                       # 대각 버팀대
        x = 5 + k; y = 17 - int(k * 0.55)
        c.set(x, y, 'wood', 4); c.set(x, y + 1, 'wood', 2)
    for (x, y) in ((7, 7), (24, 7), (7, 15), (24, 15)): c.set(x, y, 'iron', 3)
    c.set(25, 11, 'iron', 4); c.set(25, 12, 'iron', 3)                    # 빗장
    return c.img()

# ================================================================ 바닥 표본 3x3칸(48x48), 이어 붙여도 이음새 없음
def ground_meadow():
    S = 48; X, Y = np.meshgrid(np.arange(S), np.arange(S))
    base = np.array([hx(c) for c in ('#569e35', '#579f35', '#58a035', '#549d34', '#5aa236', '#509933')])
    n = tnoise(S, S, 12, 81) * 0.6 + tnoise(S, S, 6, 82) * 0.4
    rgb = base[(n * 6).astype(int).clip(0, 5)].astype(int)
    clov = tnoise(S, S, 8, 83) > 0.62
    rgb = np.where(clov[..., None] & (hash2(X, Y, 84)[..., None] > 0.45), np.array(hx('#73b83e')), rgb)
    rgb = np.where((hash2(X, Y, 85) > 0.965)[..., None], np.array(hx('#3f7a2c')), rgb)
    rgb = np.where((hash2(X, Y, 86) > 0.975)[..., None], np.array(hx('#8fd24a')), rgb)
    for (seed, col) in ((90, '#ecdb95'), (91, '#f7fdff'), (92, '#e0482a')):          # 들꽃 점
        f = (hash2(X // 1, Y // 1, seed) > 0.992) & (tnoise(S, S, 8, seed) > 0.4)
        rgb = np.where(f[..., None], np.array(hx(col)), rgb)
        rgb = np.where(np.roll(f, 1, 0)[..., None], np.array(hx('#4b8232')), rgb)
    return Image.fromarray(rgb.astype(np.uint8), 'RGB').convert('RGBA')

def ground_dirt():
    S = 48; X, Y = np.meshgrid(np.arange(S), np.arange(S))
    n = tnoise(S, S, 12, 101) * 0.5 + tnoise(S, S, 6, 102) * 0.3 + tnoise(S, S, 3, 103) * 0.2
    T = np.rint(2.0 + n * 3.0 + (hash2(X, Y, 104) - 0.5) * 0.8).astype(int).clip(2, 5)
    T = np.where(hash2(X, Y, 105) > 0.975, 6, T); T = np.where(hash2(X, Y, 106) < 0.03, 1, T)
    # 균열: 2~4 화소 짧은 가로 획이 드문드문(고리 모양 금지)
    cr = (hash2(X // 3, Y // 2, 108) > 0.93) & (hash2(X, Y // 2, 109) > 0.35)
    T = np.where(cr, 1, T)
    peb = (hash2(X // 2, Y // 2, 110) > 0.965) & ((X + Y) % 2 == 0)
    T = np.where(peb, 6, T)
    return tone_img(T, 'earth')

def ground_gravel():
    S = 48; X, Y = np.meshgrid(np.arange(S), np.arange(S))
    n = tnoise(S, S, 8, 111) * 0.6 + tnoise(S, S, 4, 112) * 0.4
    T = np.rint(2.0 + n * 2.0).astype(int)
    peb = hash2(X // 2, Y // 2, 113) > 0.55
    sh = hash2(X // 2, Y // 2, 114)
    T2 = np.where(peb, np.where(sh > 0.7, 5, np.where(sh > 0.35, 4, 3)), T)
    hi = peb & (X % 2 == 0) & (Y % 2 == 0); T2 = np.where(hi, np.minimum(T2 + 1, 6), T2)
    lo = peb & (X % 2 == 1) & (Y % 2 == 1); T2 = np.where(lo, np.maximum(T2 - 2, 1), T2)
    rgb = np.where((T2 >= 3)[..., None] & peb[..., None], P('flag')[np.clip(T2, 0, 6)], P('earth')[np.clip(T2, 0, 6)])
    return Image.fromarray(rgb.astype(np.uint8), 'RGB').convert('RGBA')

def ground_flagstone():
    S = 48; X, Y = np.meshgrid(np.arange(S), np.arange(S))
    row = Y // 8; xo = (X + (row % 3) * 5) % 48; col = xo // 12
    lx = xo % 12; ly = Y % 8
    hb = hash2(col, row, 121)
    T = 3 + np.rint((hb - 0.5) * 2.0).astype(int) + np.rint((hash2(X, Y, 122) - 0.5) * 0.7).astype(int)
    T = np.where((lx == 0) | (ly == 7), 2, T)
    T = np.where((lx == 1) & (ly < 7), np.minimum(T + 1, 5), T); T = np.where((ly == 0) & (lx > 0), np.minimum(T + 1, 5), T)
    crack = (hash2(col, row + 9, 123) > 0.86) & (ly == 3) & (lx > 2) & (lx < 10); T = np.where(crack, 1, T)
    rgb = P('flag')[np.clip(T, 0, 6)]
    moss = ((lx == 0) | (ly == 7)) & (hash2(X, Y, 124) > 0.8)
    rgb = np.where(moss[..., None], np.array(PA.LAWN[1]), rgb)
    return Image.fromarray(rgb.astype(np.uint8), 'RGB').convert('RGBA')

# ================================================================ 폐허(무너진 망루·성벽 잔해) — plains_ruin.py
from plains_ruin import watchtower_ruin, ruin_wall_w, ruin_wall_e, rubble_heap, rubble_small, fallen_block, ruin_chips, ruin_steps  # noqa: E402,F401
