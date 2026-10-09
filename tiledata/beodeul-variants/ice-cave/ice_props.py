# 얼음 동굴 새 조각(손 도트, 버들항 팔레트 + 눈마을과 같은 얼음 7단). 모든 함수는 RGBA Image 를 돌려준다. 결정적.
from wl import *
from px2 import _hash, vnoise

def F(c): return pz.fin(c)

def prism(c, pts, base_t=4, seed=1, light=(-1, -1)):
    """다각형 결정 면: 왼쪽 위 면이 밝고 오른쪽 아래 면이 어둡다."""
    c.new()
    ys = [p[1] for p in pts]; xs = [p[0] for p in pts]
    cx = sum(xs) / len(xs)
    c.poly(pts, 'ice', lambda x, y: 0.55 + (0.28 if x < cx - 0.5 else (-0.12 if x > cx + 1 else 0.06)) - 0.04 * ((y - min(ys)) / max(1, max(ys) - min(ys))), grain=False)

def spike(c, cx, base_y, w, h, mat='ice', lean=0.0, seed=1):
    """뾰족한 얼음 기둥(석순/고드름 공용): 밑변 w, 높이 h, 윗면이 비스듬히 깎여 있다."""
    c.new()
    for k in range(h):
        f = k / max(1, h - 1)
        half = (w / 2.0) * (1 - f) ** 0.9 + 0.4
        x0 = cx + lean * k
        for x in range(int(round(x0 - half)), int(round(x0 + half)) + 1):
            dx = (x - x0) / max(half, 0.6)
            t = 5 if dx < -0.4 else (4 if dx < 0.3 else 2)
            if f > 0.82: t = min(6, t + 1)
            if _hash(x, k, seed) > 0.93: t = max(1, t - 1)
            c.tone(x, base_y - k, mat, t)

# ================================================================ 결정·고드름·얼음
def icicle_a():
    c = C(16, 16, seed=601)
    for (x, L, w) in ((2, 8, 2), (6, 12, 3), (10, 6, 2), (13, 9, 2)):
        c.new()
        for k in range(L):
            f = k / L; half = w * (1 - f) + 0.3
            for xx in range(int(round(x - half)), int(round(x + half)) + 1):
                c.tone(xx, k, 'ice', 6 if (xx <= x and k < 2) else (5 if xx < x else (3 if xx > x else 4)))
        c.tone(x, L, 'ice', 6)
    for xx in range(0, 16): c.tone(xx, 0, 'frost', 4)
    return F(c)

def icicle_b():
    c = C(32, 32, seed=602)
    for (x, L, w) in ((3, 10, 2), (8, 18, 3), (13, 9, 2), (18, 21, 3.4), (24, 12, 2), (28, 7, 2)):
        c.new()
        for k in range(L):
            f = k / L; half = w * (1 - f) ** 0.8 + 0.3
            for xx in range(int(round(x - half)), int(round(x + half)) + 1):
                dx = (xx - x) / max(half, 0.5)
                c.tone(xx, k, 'ice', 6 if (dx < -0.3 and k < 3) else (5 if dx < -0.3 else (3 if dx > 0.4 else 4)))
        c.tone(x, L, 'ice', 6)
    for xx in range(0, 32): c.tone(xx, 0, 'frost', 4); c.tone(xx, 1, 'frost', 3) if xx % 3 else None
    return F(c)

def stalagmite_ice():
    c = C(16, 24, seed=603); c.shadow(8, 21.5, 6, 1.6, 90)
    spike(c, 8, 21, 11, 19, 'ice', 0.0, 3)
    c.new(); c.ellipsoid(8, 20.5, 6, 2.2, 'snow', amb=0.3, bias=0.15)
    return F(c)

def stalagmite_big():
    c = C(32, 32, seed=604); c.shadow(16, 29.5, 13, 2.2, 90)
    spike(c, 9, 28, 11, 17, 'ice', -0.1, 4); spike(c, 22, 28, 12, 21, 'ice', 0.12, 5); spike(c, 16, 28, 14, 27, 'ice', 0.0, 6)
    c.new(); c.ellipsoid(16, 28, 13, 2.6, 'snow', amb=0.3, bias=0.15)
    return F(c)

def crystal_blue():
    c = C(16, 16, seed=605); c.shadow(8, 13.5, 5.5, 1.3, 90)
    prism(c, [(8, 1), (11, 4), (11, 12), (8, 14), (5, 12), (5, 4)], seed=1)
    c.tone(7, 3, 'ice', 6); c.tone(7, 4, 'ice', 6); c.tone(6, 6, 'ice', 6)
    for (x, y) in ((8, 6), (9, 8), (8, 10)): c.tone(x, y, 'deepice', 5)
    return F(c)

def crystal_cluster():
    c = C(32, 24, seed=606); c.shadow(16, 21.5, 12, 1.8, 90)
    prism(c, [(8, 6), (11, 9), (11, 20), (8, 22), (5, 20), (5, 9)])
    prism(c, [(20, 1), (24, 5), (24, 20), (20, 22), (16, 20), (16, 5)])
    prism(c, [(28, 10), (30, 13), (30, 20), (28, 21), (26, 20), (26, 13)])
    for (x, y) in ((19, 4), (19, 5), (18, 8), (7, 8), (7, 9), (6, 11)): c.tone(x, y, 'ice', 6)
    for (x, y) in ((20, 8), (21, 11), (20, 14), (8, 13), (8, 16)): c.tone(x, y, 'deepice', 5)
    return F(c)

def ice_pillar():
    c = C(16, 48, seed=607); c.shadow(8, 45.5, 7, 1.8, 90)
    c.new(); c.cylinder(8, 8, 40, 6.2, 'ice', cap=True, capry=2.6, amb=0.25)
    c.new(); c.cylinder(8, 38, 45, 7.2, 'cavestone', cap=True, capry=2.8, amb=0.28)
    for (x0, y0, x1, y1) in ((6, 14, 6, 30), (10, 12, 10, 22), (7, 32, 7, 37)): c.line(x0, y0, x1, y1, 'ice', 6)
    for (x, y) in ((10, 26), (9, 31), (11, 18)): c.tone(x, y, 'ice', 1)
    for (x, y) in ((5, 9), (6, 9), (4, 20), (11, 34)): c.tone(x, y, 'frost', 6)
    return F(c)

def ice_pillar_broken():
    c = C(16, 32, seed=608); c.shadow(8, 29.5, 7, 1.8, 90)
    c.new(); c.cylinder(8, 18, 28, 6.2, 'ice', cap=False, amb=0.25)
    c.new()
    for x in range(2, 15):            # 부러진 윗면: 비스듬한 톱니
        top = 14 + int(abs(x - 6) * 0.9) + (x % 3)
        for y in range(top, 19):
            c.tone(x, y, 'ice', 5 if x < 7 else (4 if x < 11 else 3))
        c.tone(x, top, 'ice', 6)
    c.new(); c.cylinder(8, 26, 29, 7.2, 'cavestone', cap=True, capry=2.8, amb=0.28)
    for (x, y) in ((4, 20), (10, 22), (7, 16)): c.tone(x, y, 'ice', 6)
    return F(c)

def ice_block():
    c = Cv(16, 16)
    for y in range(3, 8):
        for x in range(2, 14): c.set(x, y, 'ice', 6 if (y == 3 or x == 2) else 5)
    for y in range(8, 14):
        for x in range(2, 14):
            t = 4 if y < 11 else 3
            if x == 2: t = 5
            if x == 13: t = 2
            c.set(x, y, 'ice', t)
    for (x, y) in ((5, 10), (6, 9), (9, 11), (10, 10), (7, 12)): c.set(x, y, 'deepice', 5)       # 갇힌 기포
    for x in range(2, 14): c.set(x, 13, 'ice', 2)
    im = c.img()
    sh = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); p = sh.load()
    for y in range(13, 16):
        for x in range(1, 15): p[x, y] = (7, 21, 60, 80)
    sh.alpha_composite(im); return sh

def rubble_ice():
    c = C(16, 16, seed=609); c.shadow(8, 13, 6, 1.5, 70)
    for (cx, cy, rx, ry, m) in ((5, 11, 3.6, 2.6, 'ice'), (11, 11, 3.2, 2.4, 'ice'), (8, 8, 2.8, 2.2, 'cavestone'), (3, 8, 2, 1.6, 'cavestone')):
        c.new(); c.ellipsoid(cx, cy, rx, ry, m, amb=0.3, bump=0.5, bsc=2.2)
    return F(c)

def frostbloom():
    c = C(16, 16, seed=610)
    for (x, h) in ((4, 7), (8, 10), (12, 6)):
        c.new()
        for k in range(h): c.tone(x, 14 - k, 'frost', 4)
        for (dx, dy) in ((-1, 0), (1, 0), (0, -1), (-1, -1), (1, -1)): c.tone(x + dx, 14 - h + dy, 'ice', 6 if dy < 0 else 5)
        c.tone(x, 14 - h, 'snow', 6)
    return c.img(False)

def frozen_puddle():
    c = C(32, 16, seed=611)
    im = Image.new('RGBA', (32, 16), (0, 0, 0, 0)); p = im.load()
    for y in range(16):
        for x in range(32):
            dx = (x + 0.5 - 16) / 13.5; dy = (y + 0.5 - 8) / 5.2
            r = dx * dx + dy * dy * (1 + 0.2 * vnoise(x, y, 3, 9));
            if r <= 1:
                t = 5 if r > 0.8 else (4 if r > 0.35 else 3)
                if (x + y * 2) % 11 == 0 and r < 0.8: t = 6
                p[x, y] = hx(PAL['ice'][t]) + (255,)
            elif r <= 1.18: p[x, y] = hx(PAL['frost'][2]) + (170,)
    return im

def snow_pile_s():
    c = C(16, 16, seed=612); c.shadow(8, 13, 6, 1.4, 60)
    c.new(); c.ellipsoid(8, 10, 6.4, 4.4, 'snow', amb=0.25, bias=0.12, bump=0.35, bsc=2.5)
    c.new(); c.ellipsoid(6, 8, 3, 2, 'snow', amb=0.3, bias=0.2)
    return F(c)

def snow_pile_m():
    c = C(32, 16, seed=613); c.shadow(16, 13.5, 13, 1.6, 60)
    for (cx, cy, rx, ry) in ((9, 10, 7.5, 4.6), (22, 10, 9, 5), (15, 8, 6.5, 4.4)):
        c.new(); c.ellipsoid(cx, cy, rx, ry, 'snow', amb=0.25, bias=0.12, bump=0.35, bsc=2.5)
    return F(c)

def snow_drift():
    c = C(32, 24, seed=614); c.shadow(16, 20.5, 14, 2.0, 60)
    for (cx, cy, rx, ry) in ((10, 15, 9, 6.2), (23, 15, 10, 6.6), (16, 11, 10, 7.4)):
        c.new(); c.ellipsoid(cx, cy, rx, ry, 'snow', amb=0.25, bias=0.1, bump=0.4, bsc=2.8)
    for (x, y) in ((13, 6), (14, 6), (20, 9)): c.tone(x, y, 'snow', 6)
    return F(c)

# ================================================================ 야영·뼈·상자
def campfire_pit():
    c = C(32, 32, seed=620); c.shadow(16, 27, 12, 2.4, 100)
    c.new(); c.ellipsoid(16, 22, 12.5, 5.6, 'snow', amb=0.3, bias=0.1, bump=0.3)
    for i in range(9):
        a = i / 9 * 6.283; x = 16 + math.cos(a) * 9.5; y = 22 + math.sin(a) * 4.3
        c.new(); c.ellipsoid(x, y, 3.0, 2.5, 'stone', amb=0.2, bump=0.4)
    c.new(); c.ellipsoid(16, 22, 7, 2.8, 'dark', amb=0.3, bias=-0.1)
    for (x0, y0, x1, y1) in ((10, 25, 22, 20), (11, 20, 22, 25)):
        c.new()
        for k in range(3): c.line(x0, y0 + k, x1, y1 + k, 'bark', (4, 3, 1)[k])
        c.tone(x0 - 1, y0 + 1, 'bone', 5)
    im = F(c); px = im.load()
    rows = ["..4..", ".454.", "34543", ".343.", "..2.."]
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch == '.': continue
            px[14 + i, 15 + j] = hx(PAL['flame'][int(ch)]) + (255,)
    for (x, y) in ((12, 17), (20, 16), (17, 13)): px[x, y] = hx(PAL['flame'][5]) + (255,)
    return im

def bones_ribs():
    c = C(32, 16, seed=621); c.shadow(16, 13.5, 13, 1.4, 60)
    c.new()
    for k in range(6):
        x0 = 6 + k * 3
        for i in range(8):
            y = 3 + i * 1.0; x = x0 + int(round(math.sin(i / 7.0 * 3.14) * 1.5))
            c.tone(int(x), int(y) + 1, 'bone', 5 if i < 3 else 4)
            c.tone(int(x) + 1, int(y) + 1, 'bone', 2)
    c.new()
    for x in range(4, 27): c.tone(x, 11, 'bone', 4); c.tone(x, 12, 'bone', 2)       # 등뼈
    for (x, y) in ((3, 10), (3, 12), (27, 10), (27, 12), (28, 11)): c.tone(x, y, 'bone', 5)
    return F(c)

def bones_scatter():
    c = C(16, 16, seed=622); c.shadow(8, 13, 6, 1.3, 50)
    c.new()
    for k in range(9): c.tone(3 + k, 11 - k // 3, 'bone', 5 if k % 2 else 4); c.tone(3 + k, 12 - k // 3, 'bone', 2)
    c.new()
    for (x, y) in ((11, 8), (12, 9), (10, 10)): c.tone(x, y, 'bone', 5); c.tone(x + 1, y, 'bone', 3)
    c.tone(2, 10, 'bone', 6); c.tone(3, 9, 'bone', 5); c.tone(13, 12, 'bone', 4)
    return F(c)

def chest_frost():
    c = Cv(16, 16)
    for y in range(7, 13):                                                      # 몸통 앞면
        for x in range(2, 14):
            t = 4 if y < 10 else 3
            if x == 2: t = 5
            if x == 13: t = 2
            c.set(x, y, 'wood', t)
    for x in range(2, 14):                                                      # 뚜껑 앞쪽 띠
        c.set(x, 6, 'wood', 5)
    for y in range(3, 7):                                                       # 둥근 뚜껑 윗면
        for x in range(2 + (1 if y == 3 else 0), 14 - (1 if y == 3 else 0)): c.set(x, y, 'wood', 6 if y == 3 else 5)
    for x in (4, 11):
        for y in range(3, 13): c.set(x, y, 'iron', 4); c.set(x + 1, y, 'iron', 3)
    c.set(8, 8, 'gold', 5); c.set(8, 9, 'gold', 3); c.set(7, 8, 'gold', 4)         # 자물쇠
    for x in range(2, 14): c.set(x, 13, 'wood', 1)
    im = c.img()
    px = im.load()
    for (x, y) in ((3, 3), (4, 3), (5, 3), (9, 3), (10, 3), (3, 4), (11, 4), (12, 4)): px[x, y] = hx(PAL['snow'][6]) + (255,)          # 서리
    for (x, y) in ((2, 6), (13, 6), (6, 5), (10, 5)): px[x, y] = hx(PAL['snow'][5]) + (255,)
    sh = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); p = sh.load()
    for y in range(13, 16):
        for x in range(1, 15): p[x, y] = (7, 21, 60, 80)
    sh.alpha_composite(im); return sh

def chest_open():
    c = Cv(16, 16)
    for y in range(8, 13):
        for x in range(2, 14):
            t = 4 if y < 11 else 3
            if x == 2: t = 5
            if x == 13: t = 2
            c.set(x, y, 'wood', t)
    for x in range(3, 13):                                                      # 안쪽(어두움)과 금화
        c.set(x, 6, 'dark', 1); c.set(x, 7, 'gold', 4 if x % 3 else 5)
    for x in range(2, 14): c.set(x, 5, 'wood', 3)
    for y in range(0, 5):                                                       # 열린 뚜껑(뒤로 젖힘)
        for x in range(3, 13): c.set(x, y, 'wood', 3 if y > 0 else 4)
    for x in (4, 11):
        for y in range(8, 13): c.set(x, y, 'iron', 4); c.set(x + 1, y, 'iron', 3)
    for x in range(2, 14): c.set(x, 13, 'wood', 1)
    im = c.img()
    sh = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); p = sh.load()
    for y in range(13, 16):
        for x in range(1, 15): p[x, y] = (7, 21, 60, 80)
    sh.alpha_composite(im); return sh

def crate_frost():
    c = Cv(16, 16)
    for y in range(5, 13):
        for x in range(2, 14):
            t = 4 if y > 6 else 5
            if x == 2: t = 5
            if x == 13: t = 2
            c.set(x, y, 'wood', t)
    for x in range(2, 14): c.set(x, 5, 'wood', 6)
    for k in range(0, 8): c.set(3 + k, 12 - k, 'wood', 2)
    for y in range(6, 13): c.set(2, y, 'wood', 2); c.set(13, y, 'wood', 2)
    for x in range(2, 14): c.set(x, 12, 'wood', 2)
    im = c.img(); px = im.load()
    for (x, y) in ((3, 5), (4, 5), (5, 5), (7, 5), (11, 5), (12, 5), (4, 6)): px[x, y] = hx(PAL['snow'][6]) + (255,)
    sh = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); p = sh.load()
    for y in range(13, 16):
        for x in range(1, 15): p[x, y] = (7, 21, 60, 80)
    sh.alpha_composite(im); return sh

def barrel_frost():
    c = C(16, 16, seed=623); c.shadow(8, 13.4, 5.5, 1.4, 70)
    c.new(); c.cylinder(8, 4, 12, 5.2, 'wood', cap=True, capry=2.4, amb=0.25)
    for y in (6, 11):
        for x in range(3, 14): c.tone(x, y, 'iron', 4) if c.m[y][x] else None
    c.new()
    for x in range(4, 13):
        if c.m[3][x]: c.tone(x, 3, 'snow', 6)
    for (x, y) in ((5, 2), (8, 2), (10, 3), (4, 4)): c.tone(x, y, 'snow', 5)
    return F(c)

def pickaxe_stuck():
    c = C(16, 16, seed=624); c.shadow(8, 13, 5, 1.2, 60)
    c.new(); c.ellipsoid(8, 12, 6.5, 2.6, 'ice', amb=0.3, bump=0.3)
    c.new()
    for k in range(10): c.tone(8 + k // 4, 11 - k, 'wood', 5); c.tone(9 + k // 4, 11 - k, 'wood', 3)
    for dx in range(-4, 5):
        y = 1 + abs(dx) // 3; c.tone(9 + dx, y, 'iron', 5 if dx < 0 else 4); c.tone(9 + dx, y + 1, 'iron', 3)
    c.tone(5, 3, 'iron', 6); c.tone(13, 3, 'iron', 6)
    return F(c)

# ================================================================ 불·표지
def brazier_ice():
    c = C(16, 24, seed=625); c.shadow(8, 21.4, 6, 1.5, 80)
    c.new()
    for (x0, y0, x1, y1) in ((4, 21, 7, 11), (12, 21, 9, 11), (8, 21, 8, 11)):
        c.line(x0, y0, x1, y1, 'iron', 4); c.line(x0 + 1, y0, x1 + 1, y1, 'iron', 2)
    c.new(); c.cylinder(8, 8, 12, 5.6, 'iron', cap=True, capry=2.2, amb=0.2)
    im = F(c); px = im.load()
    rows = ["..5..", ".565.", "45654", "34543", ".343."]          # 푸른 불꽃(얼음 톤)
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch == '.': continue
            px[6 + i, 3 + j] = hx(PAL['ice'][int(ch)]) + (255,)
    px[8, 2] = hx(PAL['ice'][6]) + (255,); px[8, 3] = hx(PAL['ice'][6]) + (255,)
    return im

def torch_wall():
    c = Cv(16, 32)
    for y in range(10, 26): c.set(7, y, 'iron', 4); c.set(8, y, 'iron', 2)
    for x in range(5, 11): c.set(x, 10, 'iron', 5); c.set(x, 11, 'iron', 3)
    for (x, y) in ((5, 9), (10, 9)): c.set(x, y, 'iron', 4)
    for (x, y) in ((7, 26), (8, 26), (6, 25), (9, 25)): c.set(x, y, 'iron', 3)
    for (x, y, t) in ((8, 3, 5), (7, 4, 4), (8, 4, 6), (9, 4, 4), (7, 5, 3), (8, 5, 5), (9, 5, 3), (7, 6, 3), (8, 6, 4), (9, 6, 3), (8, 7, 2)):
        c.set(x, y, 'ice', t)
    return c.img()

def tool_sconce(): return torch_wall()

# ================================================================ 문·계단·폭포(벽 앞면에 얹는 조각)
def door_ice():
    c = Cv(32, 32)
    for y in range(2, 32):                                                       # 돌 문틀
        for x in range(2, 6): c.set(x, y, 'cavestone', 5 if x == 2 else (4 if x < 5 else 3))
        for x in range(26, 30): c.set(x, y, 'cavestone', 4 if x < 28 else 2)
    for y in range(2, 8):                                                        # 아치 윗부분
        for x in range(2, 30):
            dx = (x + 0.5 - 16) / 14.0; dy = (y + 0.5 - 8) / 6.0
            if dx * dx + dy * dy <= 1.0 and not (dx * dx * 0.55 + (dy + 0.1) ** 2 * 0.55 < 0.5 and y > 4):
                c.set(x, y, 'cavestone', 5 if (x < 14 and y < 5) else 4)
    for y in range(8, 32):                                                       # 얼음 문짝 둘
        for x in range(6, 26):
            if (x == 15 or x == 16): c.set(x, y, 'iron', 2 if x == 15 else 3); continue
            t = 4 if x < 15 else 3
            if x in (6, 16 + 1): t += 1
            c.set(x, y, 'ice', min(6, t))
    for yy in (12, 18, 25):                                                      # 쇠띠
        for x in range(6, 26): c.set(x, yy, 'iron', 4); c.set(x, yy + 1, 'iron', 2)
    for (x, y) in ((8, 15), (12, 22), (19, 16), (22, 23), (9, 28)): c.set(x, y, 'ice', 6)
    for (x, y) in ((14, 20), (17, 20)): c.set(x, y, 'iron', 5)
    for x in range(6, 26):                                                       # 서리 쌓인 윗선 + 고드름
        c.set(x, 8, 'snow', 6)
    for (x, L) in ((8, 4), (12, 6), (19, 5), (23, 3)):
        for k in range(L): c.set(x, 9 + k, 'ice', 6 if k < 2 else 5)
    for x in range(2, 30): c.set(x, 31, 'cavestone', 1)
    return c.img()

def stairs_up_face():
    c = Cv(32, 32)
    for y in range(0, 32):                                                       # 돌 틀
        for x in range(0, 32):
            if x < 4 or x >= 28 or y < 5:
                c.set(x, y, 'cavestone', 5 if (x < 4 or y < 2) else 3)
    for y in range(5, 32):                                                       # 안쪽: 위로 올라가는 계단(위쪽일수록 어둡다)
        for x in range(4, 28):
            step = (y - 5) // 5
            t = 1 + (5 - step) * 0.0
            tone = [1, 1, 2, 3, 4, 5, 5][min(6, step)]
            if (y - 5) % 5 == 0: tone = min(6, tone + 1)
            if (y - 5) % 5 == 4: tone = max(0, tone - 2)
            c.set(x, y, 'cavestone', tone)
    for x in range(4, 28): c.set(x, 5, 'dark', 1); c.set(x, 6, 'dark', 1)
    for x in range(0, 32): c.set(x, 31, 'cavestone', 1)
    for (x, y) in ((6, 3), (12, 3), (20, 3)): c.set(x, y, 'frost', 5)
    im = c.img(); px = im.load()
    for (x, L) in ((6, 3), (14, 5), (22, 4)):
        for k in range(L): px[x, 5 + k] = hx(PAL['ice'][6 if k < 2 else 5]) + (255,)
    return im

def stairs_down():
    c = Cv(32, 16)
    for y in range(0, 16):
        for x in range(0, 32):
            if x < 2 or x >= 30 or y < 2: c.set(x, y, 'cavestone', 5 if (y < 2 or x < 2) else 3)
    for y in range(2, 16):
        step = (y - 2) // 3
        for x in range(2, 30):
            tone = [5, 4, 3, 2, 1][min(4, step)]
            if (y - 2) % 3 == 0: tone = min(6, tone + 1)
            c.set(x, y, 'cavestone', tone)
    return c.img()

def frozen_waterfall():
    c = Cv(32, 48)
    for y in range(0, 48):
        for x in range(2, 30):
            n = 0.0
            wob = int(round(math.sin(y / 5.0 + x / 3.0) * 1.0))
            k = (x + wob) // 4
            base = 3 + (0 if k % 2 == 0 else 1)
            t = base + (1 if x % 4 == 0 else (-1 if x % 4 == 3 else 0))
            if hash2(x, y // 2, 8) > 0.93: t += 1
            if y < 2: t = 6
            c.set(x, y, 'ice', max(1, min(6, t)))
    for x in range(2, 30):                                                       # 끝이 들쭉날쭉한 윗 가장자리
        pass
    for y in range(40, 48):                                                      # 바닥 쌓인 얼음 무더기
        for x in range(0, 32):
            dx = (x + 0.5 - 16) / 16.5; dy = (y + 0.5 - 46) / 7.0
            if dx * dx + dy * dy <= 1.0: c.set(x, y, 'ice', 6 if dy < -0.4 else (5 if dx < 0 else 3))
    for (x, y) in ((9, 8), (10, 18), (20, 12), (17, 28), (7, 33), (22, 36)): c.set(x, y, 'frost', 6)
    for yy in (14, 30):
        for x in range(2, 30):
            if hash2(x, yy, 9) > 0.35: c.set(x, yy, 'ice', 1)
    return c.img()

def snow_cap_wall():
    """벽 앞면 윗선에 얹는 눈 띠(32x16, 투명)."""
    c = Cv(32, 16)
    for x in range(0, 32):
        L = 2 + int(hash2(x // 2, 3, 5) * 3)
        for y in range(0, L): c.set(x, y, 'snow', 6 if y == 0 else (5 if y == 1 else 4))
    return c.img(False)
