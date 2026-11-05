# 화산 지대 구조물: 화산 신전 입구 · 신전 화로 · 화염 수호 석상 · 화산 동굴 입구.
# 석재는 버들항 성 마름돌(castle6.ash: 돌마다 톤, 왼·위 밝은 모, 오른·아래 어두운 모, 1px 줄눈)을 현무암 램프로 옮겨 쓴다.
# 3/4: 윗면 + 앞면, 옆면 없음. 빛 왼쪽 위.
import math
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from vf_base import C, P, RGB, F, put, hash2, smooth, LAV, _hash
from castle6 import ash


def blank(w, h): return Image.new('RGBA', (w, h), (0, 0, 0, 0))


def bas(X, Y, bw=16, bh=8, seed=0, k=0.0, mat='basalt', lo=0.6):
    """마름돌 한 화소 → mat 램프 색. k = 톤 더하기(앞면 어둡게 등)."""
    c = ash(X, Y, 1.0, bw, bh, seed)
    l = 0.30 * c[0] + 0.59 * c[1] + 0.11 * c[2]
    t = int(np.clip(round(lo + (l - 70) / (225 - 70) * 5.0 + k), 1, 6))
    return RGB(mat, t)


def _rock_edge(px, W, H, x0, x1, ytop, ybot, seed, side):
    """신전 양옆을 산 바위에 잇는 거친 현무암 덩이(위 · 왼쪽 밝게)."""
    rng = np.random.default_rng(seed)
    for i in range(14):
        cx = rng.uniform(x0, x1); cy = rng.uniform(ytop, ybot); r = rng.uniform(3, 6.5)
        for y in range(int(cy - r) - 1, int(cy + r) + 2):
            for x in range(int(cx - r * 1.2) - 1, int(cx + r * 1.2) + 2):
                if not (x0 <= x < x1 and 0 <= y < H): continue
                dx = (x + 0.5 - cx) / (r * 1.2); dy = (y + 0.5 - cy) / r
                d = dx * dx + dy * dy
                if d <= 1:
                    t = 1 if d > 0.8 else (4 if dx < -0.2 and dy < 0 else (2 if dx > 0.35 or dy > 0.45 else 3))
                    put(px, W, H, x, y, RGB('basalt', t))


def temple_gate():
    """화산 신전 입구(6x5): 산 밑동을 깎아 세운 현무암 신전 문. 윗면 보이는 들보(응회암 띠 + 불꽃 원반 새김),
    네모 기둥 둘(붉은 머리돌), 어둠 속 붉은 빛이 새는 깊은 문간, 앞 돌계단 세 단. 양옆은 거친 바위로 산에 이어진다."""
    W, H = 96, 80
    im = blank(W, H); px = im.load()
    # 양옆 산 바위(뒤에 깔고 그 위에 신전을 그린다)
    _rock_edge(px, W, H, 0, 12, 4, 66, 71, -1)
    _rock_edge(px, W, H, 84, 96, 4, 66, 72, 1)
    # 들보 윗면(y 4..9): 밝은 판석 + 재
    for y in range(4, 10):
        for x in range(6, 90):
            t = 5 if y < 6 else 4
            if (x + 3) % 16 == 0: t = 3
            if hash2(x, y, 3) > 0.92: t = 6
            put(px, W, H, x, y, RGB('basalt', t))
    for x in range(6, 90): put(px, W, H, x, 3, RGB('basalt', 1)); put(px, W, H, x, 10, RGB('basalt', 6))
    # 들보 앞면(y 11..23): 마름돌 + 가운데 응회암 띠(y 14..19)
    for y in range(11, 24):
        for x in range(6, 90):
            if 14 <= y <= 19: c = bas(x, y, 12, 6, 7, 0.0, 'tuff')
            else: c = bas(x, y + 2, 16, 8, 5, -0.6)
            if y == 23: c = RGB('basalt', 1)
            put(px, W, H, x, y, c)
    # 불꽃 원반 새김(가운데): 붉은 원 + 위로 솟은 세 갈래 불꽃 (글자 없음)
    cx = 48
    for y in range(11, 24):
        for x in range(cx - 8, cx + 9):
            d = math.hypot(x + 0.5 - cx, (y + 0.5 - 18) * 1.25)
            if d < 5.2: put(px, W, H, x, y, LAV[3] if d < 3.2 else LAV[1])
            elif d < 6.2: put(px, W, H, x, y, RGB('tuff', 5))
    for (fx, h) in ((cx - 3, 4), (cx, 6), (cx + 3, 4)):
        for k in range(h): put(px, W, H, fx, 13 - k + 2, LAV[4] if k < h - 1 else LAV[5])
    # 기둥 사이 안벽(어두운 마름돌), 문간
    for y in range(24, 64):
        for x in range(22, 74):
            put(px, W, H, x, y, bas(x, y, 16, 8, 9, -1.4))
    dx0, dx1, dtop = 33, 63, 30
    for y in range(dtop - 4, 64):
        for x in range(dx0 - 3, dx1 + 3):
            inner = dx0 <= x < dx1 and y >= dtop
            step = (y < dtop) and (dx0 + (dtop - y) * 2 <= x < dx1 - (dtop - y) * 2)     # 계단식 들임 윗부분
            if inner or step:
                f = (y - dtop + 4) / (64 - dtop + 4)
                if f < 0.45: c = RGB('basalt', 0)
                elif f < 0.7: c = (34, 10, 12)
                elif f < 0.86: c = (64, 14, 10)
                else: c = LAV[1]
                if y > 52 and (y - 52) % 4 == 0 and dx0 + 3 < x < dx1 - 3: c = LAV[2] if f > 0.9 else (90, 22, 12)   # 안쪽 계단 빛
                put(px, W, H, x, y, c)
            elif dx0 - 3 <= x < dx0 or dx1 <= x < dx1 + 3:                              # 문틀(왼 밝게)
                if y >= dtop - 4: put(px, W, H, x, y, RGB('basalt', 5 if x < dx0 else 2))
    # 문틀 윗돌
    for x in range(dx0 - 5, dx1 + 5):
        for y in (dtop - 6, dtop - 5):
            put(px, W, H, x, y, RGB('basalt', 5 if y == dtop - 6 else 3))
    # 기둥(앞면): 머리돌(응회암, 넓다) · 몸통(마름돌, 왼 밝고 오른 어둡다) · 받침
    for (x0, x1) in ((8, 22), (74, 88)):
        for y in range(24, 64):
            for x in range(x0 - 2, x1 + 2):
                cap = y < 29; base = y >= 59
                if not (cap or base) and not (x0 <= x < x1): continue
                if cap: c = bas(x, y, 8, 5, 11, 0.4, 'tuff') if y > 24 else RGB('tuff', 5)
                elif base: c = RGB('basalt', 4 if y == 59 else 3)
                else:
                    c = bas(x, y, 14, 7, 13 + x0, 0.2)
                    if x == x0: c = RGB('basalt', 5)
                    elif x == x0 + 1: c = RGB('basalt', 4)
                    elif x >= x1 - 2: c = RGB('basalt', 2)
                if (cap or base) and (x == x0 - 2 or x == x1 + 1): c = RGB('basalt', 1)
                put(px, W, H, x, y, c)
    # 기단 윗면(y 64..66) + 계단 세 단(y 67..79)
    for y in range(64, 67):
        for x in range(4, 92): put(px, W, H, x, y, RGB('basalt', 5 if y == 64 else 4))
    steps = [(67, 72, 20, 76), (72, 77, 16, 80), (77, 80, 12, 84)]
    for (ya, yb, xa, xb) in steps:
        for y in range(ya, yb):
            for x in range(xa, xb):
                tread = y < ya + 2
                t = (5 if x < xa + 2 else 4) if tread else (2 if y < yb - 1 else 1)
                put(px, W, H, x, y, RGB('basalt', t))
    for y in range(67, 80):                                                       # 계단 양옆 기단 앞면
        for x in list(range(4, 12)) + list(range(84, 92)):
            if px[x, y][3] == 0: put(px, W, H, x, y, bas(x, y, 8, 6, 15, -1.0) if y < 79 else RGB('basalt', 1))
    # 재가 앉은 자리 · 이음 금
    for i in range(70):
        x = int(6 + _hash(i, 1, 81) * 84); y = int(4 + _hash(i, 2, 81) * 6)
        put(px, W, H, x, y, RGB('vash', 5))
    for i in range(30):
        x = int(12 + _hash(i, 3, 81) * 72); y = int(64 + _hash(i, 4, 81) * 15)
        if px[x, y][3] and _hash(i, 5, 81) > 0.4: put(px, W, H, x, y, RGB('vash', 4))
    return F(im, 0.66)


def temple_brazier():
    """신전 화로(1x2): 네모 받침 위 현무암 기둥과 쇠 대야, 활활 타는 불. 밑동 1칸 막힘, 위 칸 걷기+가림."""
    c = C(16, 32, seed=701); c.shadow(8, 29.6, 6.5, 1.6, 90)
    c.new(); c.box(2, 24, 12, 3, 5, 'basalt', top=0.95, front=0.5)
    c.new(); c.cylinder(8, 13, 24, 3.2, 'basalt', cap=False, amb=0.25)
    c.new(); c.cylinder(8, 10, 13, 6.2, 'iron', cap=True, capry=2.2, amb=0.3)
    c.new()
    for y in range(9, 12):
        for x in range(3, 14):
            if ((x + 0.5 - 8) / 5.0) ** 2 + ((y + 0.5 - 10) / 1.6) ** 2 <= 1: c.tone(x, y, 'char', 1)
    im = F(c); px = im.load()
    rows = ["....6....", "...565...", "..56765..", ".4567654.", ".3456543.", "234565432", "234555432"]
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch != '.': put(px, 16, 32, 4 + i, 2 + j, PALF[int(ch) - 1])
    for (x, y) in ((3, 0), (12, 1), (8, 0)): put(px, 16, 32, x, y, PALF[5])
    return im


PALF = [tuple(int(v) for v in RGB('lava', k)) for k in range(7)]


def fire_guardian():
    """화염 수호 석상(2x3): 마름돌 받침 위, 두건 깊이 쓴 사제상이 불 그릇을 가슴에 받쳐 든다(얼굴은 두건 그늘 속).
    받침 줄만 막힘, 위 칸 걷기+가림."""
    c = C(32, 48, seed=702); c.shadow(16, 45.6, 14, 2.2, 90)
    c.group(1); c.new()
    for y in range(36, 48):
        for x in range(4, 28):
            if y < 39: c.setv(x, y, 'basalt', 0.95 - 0.03 * (y - 36))
            else: c.setv(x, y, 'basalt', 0.5 - 0.1 * (y - 39) / 9)
    for x in range(4, 28):
        if (x - 4) % 8 == 7:
            for y in range(39, 48): c.tone(x, y, 'basalt', 1)
    for x in range(4, 28): c.tone(x, 43, 'basalt', 2)
    c.group(2)
    # 옷자락: 어깨에서 받침까지 넓어지는 사다리꼴, 세로 주름
    c.poly([(11, 14), (21, 14), (25, 36), (7, 36)], 'basalt', lambda x, y: 0.72 - 0.40 * (x - 7) / 18.0 - 0.06 * (y - 14) / 22, grain=True)
    for (x0, x1) in ((12, 10), (16, 16), (20, 22)):
        for y in range(22, 36):
            c.darken(int(round(x0 + (x1 - x0) * (y - 22) / 14)), y, 1)
    for x in range(7, 26): c.tone(x, 35, 'tuff', 3)                       # 옷단 붉은 띠
    for x in range(8, 25): c.tone(x, 34, 'tuff', 4)
    # 두건
    c.ellipsoid(16, 10, 6.2, 6.4, 'basalt', amb=0.22, bump=0.15, bias=0.05)
    c.new()
    for y in range(8, 16):
        for x in range(11, 22):
            if ((x + 0.5 - 16) / 3.2) ** 2 + ((y + 0.5 - 12.4) / 3.6) ** 2 <= 1: c.tone(x, y, 'basalt', 0)
    # 팔 + 불 그릇
    c.group(3)
    c.ellipsoid(11, 23, 3.0, 2.2, 'basalt', amb=0.25, bias=0.08)
    c.ellipsoid(21, 23, 3.0, 2.2, 'basalt', amb=0.25, bias=-0.04)
    c.new(); c.cylinder(16, 21, 24, 5.0, 'iron', cap=True, capry=1.8, amb=0.3)
    c.new()
    for x in range(12, 21): c.tone(x, 21, 'char', 1)
    im = F(c); px = im.load()
    rows = ["..6..", ".565.", "45654", "34543"]
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch != '.': put(px, 32, 48, 14 + i, 16 + j, PALF[int(ch) - 1])
    for (x, y) in ((12, 5), (14, 4), (18, 4), (11, 7)): put(px, 32, 48, x, y, RGB('vash', 5))
    return im


def cave_mouth():
    """화산 동굴 입구(3x3, 절벽 앞면 세 줄 자리): 앞면에 뚫린 거친 아치 굴, 안은 어둡고 바닥에서 붉은 열기가 샌다,
    둘레는 모난 현무암 덩이(왼·위 밝게). 바깥은 투명이라 절벽 앞면이 그대로 보인다. 아랫줄 가운데 칸이 들어가는 칸(걷기)."""
    W, H = 48, 48
    im = blank(W, H); px = im.load()
    cx, top, hw = 24, 9, 13.0
    def inside(x, y, grow=0.0):
        yy = y + 0.5; xx = x + 0.5
        w = hw + grow
        if yy >= top + w * 0.6: return abs(xx - cx) <= w - (0.4 if yy > H - 4 else 0)
        dy = (top + w * 0.6 - yy) / (w * 0.6 + grow * 0.3 + 0.01)
        return abs(xx - cx) <= w * math.sqrt(max(0, 1 - dy * dy)) and yy >= top - grow * 0.5
    rng = np.random.default_rng(73)
    # 둘레 바위 덩이
    for i in range(26):
        a = math.pi * (1.0 + i / 25.0)
        rx = cx + math.cos(a) * (hw + 3); ry = top + hw * 0.6 + math.sin(a) * (hw * 0.6 + 4)
        if i in (0, 25): ry = H - 6
        r = rng.uniform(3.0, 5.2)
        for y in range(int(ry - r) - 1, int(ry + r) + 2):
            for x in range(int(rx - r) - 1, int(rx + r) + 2):
                d = ((x + 0.5 - rx) / r) ** 2 + ((y + 0.5 - ry) / (r * 0.85)) ** 2
                if d <= 1 and 0 <= x < W and 0 <= y < H:
                    ddx = (x + 0.5 - rx) / r; ddy = (y + 0.5 - ry) / r
                    t = 1 if d > 0.78 else (5 if ddx < -0.2 and ddy < -0.1 else (2 if ddx > 0.35 or ddy > 0.4 else 3))
                    put(px, W, H, x, y, RGB('basalt', t))
    for (bx, by, r) in ((7, 44, 4.5), (41, 43, 5.0), (4, 38, 3.5), (44, 36, 3.2)):   # 발치 바위
        for y in range(int(by - r) - 1, int(by + r) + 2):
            for x in range(int(bx - r * 1.2) - 1, int(bx + r * 1.2) + 2):
                d = ((x + 0.5 - bx) / (r * 1.2)) ** 2 + ((y + 0.5 - by) / r) ** 2
                if d <= 1 and 0 <= x < W and 0 <= y < H:
                    t = 1 if d > 0.78 else (5 if x < bx - 1 and y < by else (2 if x > bx + 1 else 3))
                    put(px, W, H, x, y, RGB('basalt', t))
    # 굴 안
    for y in range(H):
        for x in range(W):
            if inside(x, y):
                f = (y - top) / (H - top)
                if f < 0.5: c = RGB('basalt', 0)
                elif f < 0.72: c = (30, 10, 12)
                elif f < 0.88: c = (62, 16, 12)
                else: c = LAV[1] if hash2(x, y, 7) > 0.3 else (62, 16, 12)
                if f > 0.8 and abs(x + 0.5 - cx) < 5 and hash2(x, y, 8) > 0.55: c = RGB('vash', 2)
                put(px, W, H, x, y, c)
            elif inside(x, y, 1.0) and px[x, y][3]:
                put(px, W, H, x, y, RGB('basalt', 1))
    # 굴 테두리 안쪽 아래: 열기 빛
    for y in range(H - 14, H):
        for x in range(W):
            if px[x, y][3] and not inside(x, y) and inside(x, y, 3.0) and hash2(x, y, 9) < 0.5:
                r, g, b, a = px[x, y]; px[x, y] = (min(255, r + 60), g + 8, b, a)
    return F(im, 0.66)
