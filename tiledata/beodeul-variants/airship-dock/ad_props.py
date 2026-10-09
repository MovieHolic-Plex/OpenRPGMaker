# 비행선 정박 부두 — 작은 소품(톤 캔버스 TC 로 칠하고 pz.fin 색 윤곽). 3/4 시점(윗면 + 앞면), 빛 왼쪽 위, 1칸 = 16px.
# 장르 규격(genres/steampunk.md): 놋쇠 BRASS·구리 RUST 3~6·리벳 STEEL·버들항 WD·RD·ST, 빛은 호박빛 amber 만.
from ad_base import *

def out(tc, k=.62, sh=None):
    im = fin(tc, k)
    if sh: im = shadow(im, *sh)
    return pad16(im)

# ---------------------------------------------------------------- 공용 그리기
def crate(tc, x0, y0, w, h, top=5, seed=0, brace=True, mat='wood', base=4):
    """나무 화물 상자: 윗면 널(가로 결) + 앞면 테두리 각목·X자 버팀·널 줄. 빛 왼쪽 위."""
    x1, y1 = x0 + w, y0 + h
    box(tc, x0, y0, x1, y1, top, mat, base=base, seed=seed, grain=.06)
    for y in range(y0 + 1, y0 + top - 1, 2):                                       # 윗면 널 이음
        for x in range(x0 + 1, x1 - 1):
            if hash2(x, y, seed) < .85: tc.shift(x, y, -1)
    fy = y0 + top
    for x in range(x0, x1):                                                        # 앞면 위·아래 각목
        tc.px(x, fy, mat, base + 1); tc.px(x, y1 - 2, mat, base - 1)
    for y in range(fy, y1 - 1):
        tc.px(x0, y, mat, base + 1); tc.px(x0 + 1, y, mat, base); tc.px(x1 - 1, y, mat, base - 2); tc.px(x1 - 2, y, mat, base - 1)
    if brace and w >= 8:
        hh = y1 - 2 - fy
        for i in range(2, w - 2):
            yy = fy + 1 + int((i - 2) * (hh - 2) / max(1, w - 5))
            tc.px(x0 + i, yy, mat, base + 1); tc.px(x0 + i, yy + 1, mat, base - 1)
    for y in range(fy + 1, y1 - 2):                                               # 널 줄(세로)
        for x in range(x0 + 2, x1 - 2, 4):
            if tc.get(x, y) and tc.get(x, y)[1] == base: tc.px(x, y, mat, base - 1)
    tc.px(x0 + 1, fy + 1, 'steel', 5); tc.px(x1 - 3, fy + 1, 'steel', 4)            # 모서리 쇠 장식
    tc.px(x0 + 1, y1 - 3, 'steel', 4); tc.px(x1 - 3, y1 - 3, 'steel', 3)

def barrel(tc, x0, y0, w, h, top=4, mat='wood', hoop='steel', seed=0):
    cx = x0 + w / 2.0
    for y in range(y0 + top // 2, y0 + h):
        bulge = math.sin(math.pi * (y - y0) / h) * .9
        xa, xb = x0 - bulge, x0 + w + bulge
        for x in range(int(math.floor(xa + .5)), int(math.floor(xb + .5))):
            t = (x + .5 - xa) / (xb - xa); k = FM.cyl_k(t)
            if (x - x0) % 3 == 2: k -= 1
            if y in (y0 + top + 1, y0 + h - 3): tc.px(x, y, hoop, clamp(k)); continue
            if y == y0 + h - 1: k = 2
            tc.px(x, y, mat, clamp(k))
    tc.ell(cx, y0 + top / 2.0, w / 2.0, top / 2.0 + .4, mat, lambda x, y: 6 if (x < cx and y < y0 + top / 2.0) else 5)
    tc.ell(cx, y0 + top / 2.0, w / 2.0 - 1.4, top / 2.0 - .6, mat, 4)

def post(tc, x, y0, y1, mat='steel', w=2, base=4):
    for y in range(y0, y1):
        for i in range(w):
            k = base + 1 if i == 0 else (base - 1 if i == w - 1 else base)
            tc.px(x + i, y, mat, k)

def rope(tc, x0, y0, x1, y1, sag=0.0, k=3):
    n = int(max(abs(x1 - x0), abs(y1 - y0)) * 1.5) + 2; last = None
    for i in range(n + 1):
        t = i / n; x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)
        p = (int(round(x)), int(round(y)))
        if p == last: continue
        last = p; tc.px(p[0], p[1], 'rope', clamp(k + (1 if (p[0] + p[1]) % 3 == 0 else 0)))

def amber_lamp(tc, cx, cy, big=False):
    """호박빛 등(유리 몸 + 놋쇠 갓·받침)."""
    tc.px(cx, cy - 3, 'brass', 5); tc.hline(cx - 1, cx + 2, cy - 2, 'brass', 4)
    for y in range(cy - 1, cy + (3 if big else 2)):
        tc.px(cx - 1, y, 'amber', 6); tc.px(cx, y, 'amber', 5); tc.px(cx + 1, y, 'amber', 3)
    tc.hline(cx - 1, cx + 2, cy + (3 if big else 2), 'brass', 3)

def gauge(tc, cx, cy, r=2.6):
    tc.ell(cx, cy, r + .9, r + .9, 'brass', lambda x, y: 6 if (x < cx and y < cy) else 3)
    tc.ell(cx, cy, r, r, 'plaster', lambda x, y: 6 if y < cy else 5)
    tc.px(cx, cy, 'steel', 1); tc.px(cx + 1, cy - 1, 'redl', 3); tc.px(int(cx + 1.6), int(cy - 1.6), 'redl', 3)

# ---------------------------------------------------------------- 1칸 소품
def bollard():
    tc = TC(16, 16, 11)
    for y in range(6, 14):
        for x in range(4, 12):
            tc.px(x, y, 'steel', FM.cyl_k((x - 4 + .5) / 8) - (1 if y > 11 else 0))
    for x in range(3, 13): tc.px(x, 8, 'steel', FM.cyl_k((x - 3 + .5) / 10) + 1)          # 버섯 머리 테
    tc.ell(8, 6, 4.2, 2.2, 'steel', lambda x, y: 6 if x < 8 else 4)
    tc.hline(4, 12, 14, 'steel', 1)
    rope(tc, 4, 10, 11, 11, 0, 3); rope(tc, 4, 11, 12, 12, 0, 4)                            # 감긴 밧줄
    return out(tc, sh=(8, 14, 6, 2))

def crate_single(seed=0):
    tc = TC(16, 16, 21 + seed); crate(tc, 1, 3, 14, 12, top=5, seed=seed); return out(tc)

def barrel_single():
    tc = TC(16, 16, 31); barrel(tc, 3, 1, 10, 14, top=4); tc.px(7, 3, 'wood', 2); return out(tc)

def rope_coil():
    tc = TC(16, 16, 41)
    for r, k in ((6.4, 3), (5.0, 5), (3.8, 3), (2.6, 4)):
        tc.ell(8, 10, r, r * .55, 'rope', lambda x, y, k=k: clamp(k + (1 if (x + y) % 3 == 0 else 0) + (1 if y < 10 else -1)))
    tc.ell(8, 10, 1.4, .8, 'rope', 1)
    rope(tc, 13, 10, 15, 14, 1.0, 3)
    return out(tc)

def coal_scatter():
    im = new(16, 16); p = im.load()
    for i in range(14):
        x = int(hash2(i, 1, 51) * 14) + 1; y = int(hash2(i, 2, 51) * 12) + 3
        p[x, y] = COAL[4 if i % 3 == 0 else 2] + (255,)
        if i % 2: p[min(15, x + 1), y] = COAL[1] + (255,)
    return im

def rock_small(seed=0):
    tc = TC(16, 16, 61 + seed)
    pts = [(2, 14), (3, 9), (6, 6), (11, 5), (14, 9), (14, 14)]
    tc.poly(pts, 'stone', lambda x, y: 5 if (x + y < 15) else (4 if x < 11 else 3))
    tc.line(4, 10, 9, 8, 'stone', 6); tc.line(9, 9, 12, 13, 'stone', 2)
    tc.hline(3, 14, 14, 'stone', 2)
    if seed: tc.px(5, 11, 'leaf', 3); tc.px(6, 12, 'leaf', 4)
    tc.grain(.06)
    return out(tc)

def rock_large():
    tc = TC(32, 32, 71)
    tc.poly([(1, 30), (2, 20), (7, 12), (15, 8), (24, 9), (30, 16), (31, 30)], 'stone',
            lambda x, y: 5 if y < 15 else (4 if x < 18 else 3))
    tc.poly([(7, 13), (15, 9), (23, 10), (19, 15), (10, 16)], 'stone', 6)                 # 윗면 빛
    tc.line(18, 15, 21, 29, 'stone', 2); tc.line(8, 18, 6, 28, 'stone', 3)
    tc.line(24, 18, 28, 24, 'stone', 2)
    for (x, y) in ((4, 26), (5, 27), (26, 27), (27, 28), (12, 28)): tc.px(x, y, 'leaf', 3)
    tc.hline(2, 31, 30, 'stone', 1); tc.grain(.07)
    return out(tc, sh=(16, 30, 14, 3))

def grass_tuft(seed=0):
    """풀포기 덩이(버들항 칩셋 작은 덤불 결): 잎 덩이 2~3개, 윗면 빛 점, 밑 그늘 한 줄, 바람 쪽(동)으로 잎 끝."""
    tc = TC(16, 16, 81 + seed)
    blobs = ((6, 10, 4.2, 3.2), (10, 11, 3.6, 2.8), (8, 8, 3.0, 2.4)) if seed == 0 else ((7, 11, 3.6, 2.8), (10, 10, 2.8, 2.2))
    for (cx, cy, rx, ry) in blobs:
        tc.ell(cx, cy, rx, ry, 'leaf', lambda x, y, cx=cx, cy=cy: 5 if (x < cx and y < cy) else (4 if y < cy + 1 else 3))
    for (x, y) in ((6, 7), (9, 9), (5, 9), (11, 10)): 
        if tc.get(x, y): tc.px(x, y, 'leaf', 6)
    tc.px(13, 9, 'leaf', 5); tc.px(14, 8, 'leaf', 4)
    for x in range(3, 14):
        if tc.get(x, 13) or tc.get(x, 12): tc.px(x, 14, 'leaf', 1)
    return fin(tc, .7)

# ---------------------------------------------------------------- 2칸 이상 소품
def crate_pair():
    tc = TC(32, 32, 91)
    crate(tc, 1, 12, 18, 19, top=6, seed=3)
    crate(tc, 15, 17, 16, 14, top=5, seed=5, base=4)
    crate(tc, 4, 1, 13, 12, top=5, seed=7, brace=False)
    tc.px(9, 8, 'paint', 4); tc.px(10, 8, 'paint', 3); tc.px(9, 9, 'paint', 3)            # 칠한 표시(글자 없음)
    return out(tc, sh=(16, 31, 14, 2))

def crate_stack():
    tc = TC(48, 48, 101)
    crate(tc, 1, 22, 22, 25, top=7, seed=1)
    crate(tc, 22, 26, 25, 21, top=7, seed=2)
    crate(tc, 5, 4, 18, 19, top=6, seed=4)
    crate(tc, 24, 12, 14, 15, top=5, seed=6, brace=False)
    tc.hline(27, 46, 26, 'rope', 4)                                                       # 묶은 밧줄
    for y in range(26, 46): tc.px(34, y, 'rope', 4 if y % 3 else 5)
    return out(tc, sh=(24, 47, 22, 2))

def cargo_net():
    tc = TC(32, 32, 111)
    tc.ell(16, 19, 13.5, 11, 'canvas', lambda x, y: 5 if (x < 14 and y < 17) else (4 if y < 24 else 3))
    crate(tc, 6, 14, 10, 10, top=4, seed=2, brace=False); barrel(tc, 16, 12, 9, 13, top=3)
    for d in range(-30, 40, 5):                                                           # 그물 눈(대각 두 결)
        for i in range(0, 28):
            x = 3 + i; y1 = 8 + i + d; y2 = 34 - i + d
            for yy in (y1, y2):
                if 9 <= yy <= 30 and ((x - 16) / 13.6) ** 2 + ((yy - 19) / 11.2) ** 2 <= 1: tc.px(x, yy, 'rope', 4 if yy < 19 else 3)
    rope(tc, 16, 0, 16, 8, 0, 5); tc.ell(16, 8, 2, 1.4, 'steel', 5)                       # 갈고리 고리
    tc.hline(5, 28, 30, 'canvas', 1)
    return out(tc, sh=(16, 31, 12, 2))

def barrel_pair():
    tc = TC(32, 32, 121)
    barrel(tc, 2, 9, 12, 21, top=5); barrel(tc, 15, 13, 12, 18, top=5, mat='paint')
    barrel(tc, 9, 1, 10, 14, top=4, mat='wood')
    return out(tc, sh=(16, 31, 14, 2))

def sack_pile():
    tc = TC(32, 16, 131)
    for (cx, cy, rx, ry) in ((8, 11, 7.5, 4.5), (22, 11, 8, 4.5), (15, 6, 7, 4)):
        tc.ell(cx, cy, rx, ry, 'canvas', lambda x, y, cx=cx, cy=cy: 5 if (x < cx and y < cy) else (4 if y < cy + 2 else 3))
        tc.px(int(cx + rx - 2), int(cy - 1), 'rope', 4); tc.px(int(cx + rx - 1), int(cy - 1), 'rope', 3)
    tc.hline(2, 30, 15, 'canvas', 1)
    return out(tc)

def sandbag_ballast():
    tc = TC(32, 16, 141)
    for i, (cx, cy) in enumerate(((7, 12), (16, 12), (25, 12), (11, 7), (21, 7))):
        tc.ell(cx, cy, 5.2, 3.2, 'ochre', lambda x, y, cx=cx, cy=cy: 5 if (x < cx and y < cy) else (4 if y < cy + 1 else 3))
        tc.px(cx, cy - 2, 'ochre', 6); tc.px(cx + 3, cy, 'rope', 3)
    tc.hline(2, 30, 15, 'ochre', 1)
    return out(tc)

def pallet():
    tc = TC(32, 16, 151)
    for y in range(7, 13):
        for x in range(1, 31):
            if y in (12,): k = 2
            elif (y - 7) % 2 == 1: k = 3
            else: k = 5 if x < 4 else 4
            tc.px(x, y, 'plank', k)
    for x in (2, 15, 28):
        for y in (13, 14): tc.px(x, y, 'plank', 2); tc.px(x + 1, y, 'plank', 1)
    return out(tc)

def hand_truck():
    tc = TC(16, 32, 161)
    for y in range(3, 26): tc.px(4, y, 'steel', 5); tc.px(5, y, 'steel', 3); tc.px(11, y, 'steel', 4); tc.px(12, y, 'steel', 2)
    for y in (8, 14, 20): tc.hline(5, 11, y, 'steel', 3)
    tc.hline(3, 14, 2, 'steel', 5); tc.hline(3, 14, 26, 'steel', 4); tc.hline(2, 15, 27, 'steel', 2)
    crate(tc, 4, 15, 9, 10, top=3, seed=4, brace=False)
    for cx in (4, 12):
        tc.ell(cx, 28, 2.6, 2.6, 'cable', lambda x, y: 3 if y < 28 else 1); tc.px(cx, 28, 'brass', 5)
    return out(tc)

def gas_lamp():
    tc = TC(16, 48, 171)
    tc.rect(5, 42, 11, 46, 'steel', 3); tc.hline(4, 12, 41, 'steel', 5); tc.hline(4, 12, 46, 'steel', 1)
    post(tc, 7, 12, 42, 'steel', 2, 4)
    tc.hline(6, 10, 30, 'brass', 5); tc.hline(6, 10, 22, 'brass', 4)                       # 놋쇠 고리
    tc.hline(4, 12, 12, 'steel', 4)                                                       # 사다리 걸이
    for y in range(3, 11):                                                                # 등(유리 상자)
        for x in range(4, 12):
            k = 6 if x < 7 else (5 if x < 10 else 3)
            if y in (3, 10) or x in (4, 11): tc.px(x, y, 'brass', 4 if x < 8 else 3); continue
            tc.px(x, y, 'amber', k)
    tc.poly([(3, 3), (8, 0), (13, 3)], 'steel', lambda x, y: 5 if x < 8 else 3)
    tc.px(8, 0, 'brass', 6)
    return out(tc)

def signal_lamp():
    tc = TC(16, 48, 181)
    tc.rect(4, 41, 12, 46, 'stone', 4); tc.hline(4, 12, 41, 'stone', 6); tc.hline(4, 12, 46, 'stone', 2)
    for y in range(14, 41): tc.px(6, y, 'steel', 5); tc.px(7, y, 'steel', 4); tc.px(8, y, 'steel', 3); tc.px(9, y, 'steel', 2)
    for y in range(18, 40, 4): tc.hline(6, 10, y, 'steel', 1)                           # 발판 쇠
    tc.ell(8, 9, 5.5, 5.5, 'brass', lambda x, y: 6 if (x < 7 and y < 8) else (4 if x < 10 else 3))   # 등 몸
    tc.ell(8, 9, 3.6, 3.6, 'amber', lambda x, y: 6 if (x < 8 and y < 9) else (5 if x < 10 else 4))
    tc.px(7, 7, 'amber', 6); tc.hline(4, 13, 14, 'brass', 3); tc.poly([(4, 4), (8, 1), (12, 4)], 'brass', 4)
    return out(tc)

def windsock():
    tc = TC(32, 64, 191)
    tc.rect(1, 58, 9, 63, 'stone', 4); tc.hline(1, 9, 58, 'stone', 6); tc.hline(1, 9, 63, 'stone', 2)
    post(tc, 4, 6, 58, 'steel', 2, 4)
    tc.px(4, 5, 'brass', 6); tc.px(5, 5, 'brass', 4)
    tc.ell(7, 9, 2.4, 4.2, 'brass', lambda x, y: 5 if y < 9 else 3)                        # 고리
    for i in range(18):                                                                   # 바람 자루(동쪽으로 부푼 원뿔, 붉은·흰 띠)
        x = 8 + i; r = 4.2 - i * .17; cy = 9 + i * .18 + math.sin(i * .5) * .6
        band = (i // 4) % 2
        for y in range(int(cy - r), int(cy + r) + 1):
            t = (y - (cy - r)) / max(1, 2 * r)
            k = 6 if t < .3 else (5 if t < .55 else (4 if t < .8 else 3))
            tc.px(x, y, 'redl' if band == 0 else 'plaster', k - (1 if band == 0 else 0))
    return out(tc)

def flag_pole(kind=0):
    tc = TC(32, 64, 201 + kind)
    tc.rect(1, 58, 9, 63, 'stone', 4); tc.hline(1, 9, 58, 'stone', 6); tc.hline(1, 9, 63, 'stone', 2)
    post(tc, 4, 3, 58, 'wood', 2, 4)
    tc.ell(5, 2, 1.6, 1.6, 'brass', 6)
    mat = 'paint' if kind == 0 else 'drab'
    for x in range(6, 28):                                                                # 바람에 날리는 깃발(물결)
        u = (x - 6) / 22.0
        wave = math.sin(u * 7.0 + kind) * (1.2 + u * 1.6)
        y0 = 5 + wave + u * 1.5; y1 = 17 + wave - u * 3.0 + (0 if x < 24 else (x - 24) * .8)
        for y in range(int(y0), int(y1)):
            k = 5 + (1 if math.cos(u * 7.0 + kind) > .3 else 0) - (1 if math.cos(u * 7.0 + kind) < -.4 else 0)
            if y == int(y1) - 1: k -= 2
            if kind == 0 and int(y0) + 4 <= y < int(y0) + 7: tc.px(x, y, 'plaster', clamp(k)); continue   # 흰 가운데 띠
            if kind == 1 and x < 13 and y < int(y0) + 6: tc.px(x, y, 'brass', clamp(k)); continue      # 놋쇠빛 모서리 칸
            tc.px(x, y, mat, clamp(k))
    return out(tc)

def pennant_line():
    tc = TC(64, 16, 211)
    rope(tc, 0, 2, 63, 2, 4.0, 3)
    for i, x in enumerate(range(3, 62, 6)):
        y = 2 + int(4.0 * 4 * (x / 63) * (1 - x / 63)) + 1
        mat = ('paint', 'brass', 'plaster', 'drab')[i % 4]
        for j in range(5):
            for xx in range(x + j // 2, x + 5 - j // 2): tc.px(xx + j // 2, y + j, mat, 5 if j < 2 else 4)
    return out(tc)

def pressure_post():
    tc = TC(16, 32, 221)
    tc.rect(4, 27, 12, 31, 'steel', 3); tc.hline(4, 12, 27, 'steel', 5)
    pipe_v(tc, 8, 12, 27, 4, 'rust', flange=False)
    gauge(tc, 8, 8, 4.2)
    tc.hline(3, 13, 22, 'brass', 5); tc.hline(3, 13, 23, 'brass', 3)
    tc.ell(12, 18, 2.5, 1.6, 'redl', lambda x, y: 4 if x < 12 else 2)                    # 붉은 밸브 손잡이
    return out(tc)

def valve_stand():
    tc = TC(16, 32, 231)
    pipe_v(tc, 8, 6, 30, 6, 'rust', step=12)
    tc.rect(3, 28, 13, 31, 'steel', 3); tc.hline(3, 13, 28, 'steel', 5)
    for a in range(16):
        ang = a / 16 * 2 * math.pi; tc.px(round(8 + math.cos(ang) * 5.5), round(7 + math.sin(ang) * 3), 'redl', 4 if math.sin(ang) < 0 else 2)
    tc.line(3, 7, 13, 7, 'redl', 3); tc.line(8, 4, 8, 10, 'redl', 3); tc.px(8, 7, 'brass', 6)
    return out(tc)

def steam_pipe_h():
    tc = TC(48, 16, 241)
    pipe_h(tc, 0, 48, 6, 6, 'rust', step=16)
    for x in (6, 30):
        for y in (10, 11, 12, 13): tc.px(x, y, 'steel', 4); tc.px(x + 1, y, 'steel', 2)
        tc.hline(x - 2, x + 4, 14, 'steel', 3)
    tc.px(44, 2, 'plaster', 6, 160); tc.px(45, 1, 'plaster', 6, 120); tc.px(43, 0, 'plaster', 5, 100)   # 이음에서 새는 김
    return out(tc)

def bench_iron():
    tc = TC(32, 32, 251)
    for x in range(3, 29):                                                                 # 등받이 널 둘
        for y in (8, 9, 12, 13): tc.px(x, y, 'wood', 5 if y in (8, 12) else 3)
    for y in range(17, 22):
        for x in range(2, 30): tc.px(x, y, 'wood', 5 if y < 19 else (4 if y < 21 else 2))
    for x0 in (3, 26):
        for y in range(6, 28): tc.px(x0, y, 'steel', 3); tc.px(x0 + 1, y, 'steel', 1)
        tc.px(x0 - 1, 20, 'steel', 4); tc.px(x0 + 2, 21, 'steel', 2)
        tc.px(x0, 6, 'brass', 6)
    return out(tc)

def telescope():
    tc = TC(16, 32, 261)
    for (a, b) in ((8, 3), (8, 13), (8, 8)):
        tc.line(8, 16, b, 30, 'wood', 4 if b < 8 else 3)
    for i in range(12):                                                                    # 비스듬히 하늘을 향한 놋쇠 통
        x = 2 + i; y = 14 - i * .7
        r = 2.0 if i > 3 else 2.6
        for d in range(-int(r), int(r) + 1): tc.px(x, round(y + d), 'brass', 6 if d < 0 else (4 if d == 0 else 3))
    tc.px(14, 5, 'glass', 6); tc.px(13, 5, 'steel', 2)
    return out(tc)

def propeller_spare():
    tc = TC(48, 32, 271)
    tc.rect(2, 22, 46, 30, 'plank', 4); tc.hline(2, 46, 22, 'plank', 6); tc.hline(2, 46, 29, 'plank', 1)   # 받침 나무틀
    for x in (4, 42): tc.rect(x, 22, x + 2, 31, 'plank', 2)
    for i in range(40):                                                                    # 눕힌 나무 프로펠러 날(가운데 놋쇠 축)
        x = 4 + i; u = abs(i - 20) / 20.0
        w = 3.2 - u * 1.6
        cy = 16 + (i - 20) * .12
        for d in range(-int(w), int(w) + 1):
            tc.px(x, round(cy + d), 'wood', 6 if d < 0 else (5 if d == 0 else 3))
    tc.ell(24, 16, 4, 3.4, 'brass', lambda x, y: 6 if (x < 24 and y < 16) else 3); tc.px(24, 16, 'steel', 1)
    return out(tc)

def tool_rack():
    tc = TC(32, 32, 281)
    box(tc, 2, 2, 30, 28, 3, 'wood', base=3, seed=4)
    for x in range(4, 28):
        for y in range(6, 26): tc.px(x, y, 'wood', 2 if (x + y) % 7 else 1)              # 구멍판(어두운 판)
    for (x, l, mat) in ((7, 14, 'steel'), (12, 10, 'brass'), (17, 16, 'steel'), (23, 12, 'rust')):
        tc.vline(x, 8, 8 + l, mat, 5); tc.vline(x + 1, 8, 8 + l, mat, 3)
        tc.hline(x - 1, x + 3, 8, mat, 6)
    gauge(tc, 24, 22, 2.2)
    tc.hline(2, 30, 28, 'wood', 1)
    return out(tc)

def gear_spare():
    tc = TC(32, 32, 291)
    cx, cy, R0 = 16, 18, 11
    for y in range(32):
        for x in range(32):
            dx, dy = (x + .5 - cx) / 1.0, (y + .5 - cy) / .62
            r = math.hypot(dx, dy); ang = math.atan2(dy, dx)
            teeth = R0 + (1.8 if math.cos(ang * 12) > .2 else 0)
            if r <= teeth and r > 3.2:
                spoke = any(abs(((ang - s) + math.pi) % (2 * math.pi) - math.pi) < .22 for s in (0, 2.09, 4.19))
                if r < R0 - 3 and not spoke: continue
                k = 6 if (dx < -2 and dy < 0) else (5 if dy < 2 else 3)
                if r > R0 - .5: k -= 1
                tc.px(x, y, 'brass', k)
    for y in range(int(cy) + 1, int(cy) + 5):                                              # 톱니 두께(앞면)
        for x in range(cx - R0 + 1, cx + R0):
            if tc.get(x, y) is None and tc.get(x, y - 1) and tc.get(x, y - 1)[0] == 'brass' and y < cy + 10: tc.px(x, y, 'brass', 2)
    tc.ell(cx, cy, 2.4, 1.6, 'steel', 2)
    return out(tc)

def coal_heap():
    tc = TC(32, 32, 301)
    tc.ell(16, 23, 15, 8.5, 'coal', lambda x, y: 4 if (x < 14 and y < 21) else (3 if y < 26 else 2))
    tc.ell(14, 19, 9, 6, 'coal', lambda x, y: 5 if (x < 12 and y < 17) else 3)
    for i in range(40):                                                                    # 덩이 석탄(윗면 빛 한 점)
        x = int(hash2(i, 1, 303) * 28) + 2; y = int(hash2(i, 2, 303) * 16) + 14
        if tc.get(x, y): tc.px(x, y, 'coal', 6 if y < 22 else 5); tc.px(x + 1, y + 1, 'coal', 1)
    tc.hline(2, 30, 31, 'coal', 1)
    return out(tc)

def coal_cart():
    tc = TC(32, 32, 311)
    box(tc, 3, 9, 29, 25, 4, 'steel', base=3, seed=6)
    tc.ell(16, 10, 11, 3, 'coal', lambda x, y: 5 if x < 14 else 3)                         # 실은 석탄
    for i in range(10):
        x = 7 + int(hash2(i, 1, 313) * 18); tc.px(x, 9 + (i % 2), 'coal', 6)
    for x in (5, 27): tc.vline(x, 13, 24, 'steel', 5)
    tc.hline(3, 29, 18, 'rust', 4)
    for cx in (9, 23):
        tc.ell(cx, 26, 4, 4, 'steel', lambda x, y, cx=cx: 4 if (x < cx and y < 26) else 2)
        tc.ell(cx, 26, 1.6, 1.6, 'brass', 5)
    tc.line(29, 12, 31, 7, 'wood', 4)
    return out(tc, sh=(16, 31, 13, 2))

def gas_bottles():
    tc = TC(32, 32, 321)
    tc.rect(1, 26, 31, 30, 'steel', 3); tc.hline(1, 31, 26, 'steel', 5); tc.hline(1, 31, 30, 'steel', 1)
    for i, x0 in enumerate((3, 10, 17, 24)):
        y0 = 6 + (i % 2) * 2
        for y in range(y0, 27):
            for x in range(x0, x0 + 6):
                k = FM.cyl_k((x - x0 + .5) / 6)
                tc.px(x, y, 'drab' if i % 2 else 'paint', k)
        tc.ell(x0 + 3, y0, 3, 1.4, 'drab' if i % 2 else 'paint', 6)
        tc.rect(x0 + 2, y0 - 3, x0 + 4, y0, 'brass', 5); tc.px(x0 + 2, y0 - 3, 'brass', 6)
    tc.hline(2, 30, 15, 'steel', 4); tc.hline(2, 30, 16, 'steel', 2)                         # 묶음 띠
    return out(tc)

def hose_reel():
    tc = TC(16, 32, 331)
    tc.rect(2, 26, 14, 30, 'steel', 3); tc.hline(2, 14, 26, 'steel', 5)
    for x in (3, 12): tc.vline(x, 8, 26, 'steel', 4); tc.vline(x + 1, 8, 26, 'steel', 2)
    tc.ell(8, 16, 5.5, 7, 'cable', lambda x, y: 4 if (x + y) % 3 == 0 else 2)
    tc.ell(8, 16, 2, 2.6, 'brass', 5)
    tc.line(3, 20, 0, 29, 'cable', 3)
    return out(tc)

def searchlight():
    tc = TC(32, 32, 341)
    for (b,) in ((6,), (16,), (26,)): tc.line(16, 18, b, 30, 'steel', 3)
    tc.ell(16, 12, 9, 8, 'brass', lambda x, y: 6 if (x < 14 and y < 10) else (4 if x < 20 else 3))
    tc.ell(19, 12, 5.6, 6, 'glass', lambda x, y: 6 if (x < 18 and y < 10) else 4)        # 앞 렌즈(동쪽 위를 향함)
    tc.ell(19, 12, 2.4, 2.6, 'amber', 6)
    for y in range(5, 20, 3): tc.px(9, y, 'steel', 2)
    return out(tc, sh=(16, 30, 11, 2))

def shrub_windswept(seed=0):
    tc = TC(32, 32, 351 + seed)
    for (cx, cy, rx, ry) in ((12, 20, 10, 8), (20, 18, 9, 7), (24, 23, 7, 5), (8, 24, 6, 4)):
        tc.ell(cx, cy, rx, ry, 'leaf', lambda x, y, cx=cx, cy=cy: 5 if (x < cx - 1 and y < cy - 1) else (4 if y < cy + 2 else 3))
    for i in range(30):
        x = int(hash2(i, 1, 353 + seed) * 26) + 3; y = int(hash2(i, 2, 353 + seed) * 16) + 11
        if tc.get(x, y): tc.px(x, y, 'leaf', 6 if y < 19 else 2); tc.px(x + 1, y, 'leaf', 5 if y < 19 else 2)
    tc.rect(13, 27, 16, 31, 'wood', 3); tc.px(13, 27, 'wood', 5)
    return out(tc, sh=(16, 30, 11, 2))

def cloud_puff(w, h, seed):
    """낭떠러지 하늘 칸에 띄우는 덩이 구름(위층 덧그림) — sky-city 구름과 같은 덩이 찍기(CL 램프)."""
    Wp, Hp = w * 16, h * 16
    cover = lambda X, Y: max(0.0, 1 - (((X - Wp / 2) / (Wp * .48)) ** 2 + ((Y - Hp * .6) / (Hp * .44)) ** 2))
    puffs = SKM._puffs(Wp, Hp, cover, seed, step=7, rmin=4, rmax=9)
    tone, pid = SKM.paint_puffs(Wp, Hp, puffs, CL)
    a = np.zeros((Hp, Wp, 4), np.uint8); m = tone >= 0
    a[m, :3] = np.array(CL, np.uint8)[np.clip(tone[m], 0, 6)]; a[m, 3] = 255
    return Image.fromarray(a, 'RGBA')

def mooring_winch():
    """계류 권양기: 리벳 강철 받침 위 밧줄 감은 가로 북, 양옆 톱니바퀴 틀, 손잡이(2x2)."""
    tc = TC(32, 32, 361)
    box(tc, 1, 20, 31, 31, 4, 'steel', base=3, seed=2)
    for x in (4, 25):                                                      # 양옆 틀
        tc.rect(x, 8, x + 3, 22, 'steel', 4); tc.vline(x, 8, 22, 'steel', 5); tc.vline(x + 2, 8, 22, 'steel', 2)
    for y in range(11, 21):                                                # 밧줄 감은 북
        t = (y - 11 + .5) / 10
        for x in range(7, 25):
            k = FM.cyl_k(t)
            band = (x - 7) % 6 in (2, 3)
            tc.px(x, y, 'rope' if band else 'steel', clamp(k + (1 if band and (x + y) % 3 == 0 else 0) - (0 if band else 1)))
    for (cx, cy, r) in ((5.5, 9, 4.2), (26.5, 9, 3.2)):                     # 톱니
        for a in range(24):
            ang = a / 24 * 2 * math.pi; rr = r + (1 if a % 2 else 0)
            tc.px(round(cx + math.cos(ang) * rr), round(cy + math.sin(ang) * rr * .8), 'brass', 6 if math.sin(ang) < 0 else 3)
        tc.ell(cx, cy, r - .8, (r - .8) * .8, 'brass', 4); tc.px(round(cx), round(cy), 'steel', 1)
    tc.line(28, 9, 31, 3, 'steel', 4); tc.hline(29, 32, 3, 'redl', 4)       # 손잡이
    rope(tc, 8, 18, 0, 27, 2, 3)
    return out(tc, sh=(16, 31, 14, 2))
