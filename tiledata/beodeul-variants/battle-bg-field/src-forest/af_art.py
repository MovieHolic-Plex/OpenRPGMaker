# 고대 숲 조각 — 버들항 파이프라인(city_v6) 재료로만 그린다. 다시 돌리면 같은 그림.
#   잎: roman.clumps (칩셋 참나무 잎 질감을 덩이마다 다시 명암) · 껍질: 칩셋 참나무 줄기 색 ·
#   돌: castle6.ash(창백한 마름돌) · roman.column/TRV(대리석 기둥) · px2.C 상자/원기둥(칩셋 돌 램프) · 이끼: 칩셋 잎 램프.
import os, sys, math, random
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(HERE, '..', '_lib-5'))
from bd5 import *                       # Scene, tree_look, terrain, ground, terrain7, pz, px2, palette(적용됨)
import roman, castle6
from px2 import C, _hash, vnoise
from roman import TRV, ST, mix, mul, clumps, LEAFR

def new(w, h): return Image.new('RGBA', (w, h), (0, 0, 0, 0))
def put(px, W, H, x, y, c):
    if 0 <= x < W and 0 <= y < H: px[x, y] = tuple(c[:3]) + (255,)

# ---------------------------------------------------------------- 색
BK = [(36, 22, 16), (61, 39, 26), (87, 57, 39), (115, 76, 54), (140, 94, 69), (168, 118, 84)]     # 칩셋 참나무 줄기
LF = LEAFR                                                                                         # 칩셋 잎 6단
MOSS = [(20, 58, 39), (32, 80, 48), (75, 130, 50), (88, 160, 53), (115, 184, 62)]                # 잎 램프 안쪽 — 껍질·돌 위 이끼
OLDST = [ST[0], ST[1], ST[2], ST[3], ST[4], ST[5], ST[6]]                                        # 칩셋 돌
def weather(c, k=0.5):
    """창백한 돌을 이끼 낀 오래된 돌로: 녹회색 쪽으로, 조금 어둡게."""
    g = (120, 132, 112)
    return mix(mul(c, 0.92), g, 0.22 * k)

# ---------------------------------------------------------------- 나무 껍질
def bark_px(x, y, x0, x1, seed):
    """줄기 한 픽셀: 원통 명암(왼쪽 밝음) + 세로 결 + 갈라진 홈."""
    w = max(1, x1 - x0); u = (x - x0 + 0.5) / w
    t = 4.2 - u * 3.6                                     # 왼쪽 4 → 오른쪽 1
    col = int((x - x0) / 2.6 + _hash(int((x - x0) / 2.6), 0, seed) * 0.8)
    t += (_hash(col, y // 5, seed + 1) - 0.5) * 1.1
    if _hash(x, y // 3, seed + 2) < 0.12: t -= 1.2           # 홈
    if (x - x0) % 5 == 0 and _hash(col, y // 7, seed + 3) < 0.55: t -= 1
    return BK[max(0, min(5, int(round(t))))]

def trunk(px, W, H, cx, top, bot, half_top, half_bot, seed, moss=True):
    for y in range(top, bot + 1):
        f = (y - top) / max(1, bot - top)
        hw = half_top + (half_bot - half_top) * (f ** 2.2)
        x0 = int(round(cx - hw)); x1 = int(round(cx + hw))
        for x in range(x0, x1 + 1):
            c = bark_px(x, y, x0, x1, seed)
            if moss:                                          # 이끼: 북서(밝은 쪽) 껍질에 세로 덩이
                m = vnoise(x, y * 0.5, 3.0, seed + 9)
                if x < cx - hw * 0.15 and m > 0.62 and y > top + 4:
                    c = MOSS[2 if m < 0.72 else (3 if (x + y) % 3 else 4)]
            put(px, W, H, x, y, c)
        put(px, W, H, x0 - 1, y, BK[0]); put(px, W, H, x1 + 1, y, BK[0])

def root(px, W, H, x0, y0, dx, dy, length, thick, seed):
    """줄기 밑에서 뻗는 뿌리: 위 가장자리 밝음, 아래 그늘, 끝으로 가늘어진다."""
    for i in range(length):
        f = i / max(1, length - 1)
        x = x0 + dx * i; y = y0 + dy * i + (f ** 2) * 3.5 + math.sin(i * 0.5 + seed) * 0.6
        th = max(1.0, thick * (1 - f * 0.85))
        for k in range(-1, int(th) + 2):
            yy = int(round(y + k - th / 2)); xx = int(round(x))
            if k == -1: c = BK[0]
            elif k == int(th) + 1: c = BK[0]
            elif k == 0: c = BK[4]
            elif k < th * 0.5: c = BK[3]
            else: c = BK[2]
            if 0 <= xx < W and 0 <= yy < H and (k in (-1, int(th) + 1)) and px[xx, yy][3]: continue
            put(px, W, H, xx, yy, c)

def branch(px, W, H, x0, y0, x1, y1, th, seed):
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    for i in range(n):
        f = i / max(1, n - 1); x = x0 + (x1 - x0) * f; y = y0 + (y1 - y0) * f
        t = max(1.0, th * (1 - f * 0.6))
        for k in range(int(-t / 2) - 1, int(t / 2) + 2):
            c = BK[0] if k in (int(-t / 2) - 1, int(t / 2) + 1) else (BK[3] if k <= 0 else BK[2])
            put(px, W, H, int(round(x + k)), int(round(y)), c)

def ivy(px, W, H, x, y0, y1, seed):
    """줄기를 타고 내려오는 덩굴: 한 줄 + 잎 점."""
    xx = x
    for y in range(y0, y1):
        xx += (1 if _hash(y, 1, seed) < 0.18 else (-1 if _hash(y, 2, seed) < 0.18 else 0))
        put(px, W, H, xx, y, LF[1])
        if _hash(y, 3, seed) < 0.42:
            s = 1 if _hash(y, 4, seed) < 0.5 else -1
            put(px, W, H, xx + s, y, LF[3]); put(px, W, H, xx + s, y - 1, LF[4])

# ---------------------------------------------------------------- 거목
def giant_tree(seed=1, wc=6, hc=8, lean=0.0):
    """거목: 칩셋 참나무 잎 덩이(clumps)로 된 넓은 수관 + 굵은 이끼 줄기 + 판근(뿌리). 밑동(아랫줄 2칸)만 막힌다."""
    W, H = wc * 16, hc * 16; im = new(W, H); px = im.load(); cx = W / 2 + lean
    tb = H - 9; tt = int(H * 0.42)
    # 가지(수관 아래로 보이는 V 자)
    for (sx, ex, ey) in ((-2, -W * 0.30, tt - 16), (2, W * 0.28, tt - 18), (0, -W * 0.08, tt - 26)):
        branch(px, W, H, cx + sx, tt + 10, cx + ex, ey, 5, seed)
    trunk(px, W, H, cx, tt, tb, 9.5, 12.5, seed)
    for (dx, dy, L, th) in ((-1.0, 0.18, 17, 5), (-0.7, 0.32, 12, 4), (1.0, 0.16, 16, 5), (0.6, 0.34, 11, 4), (-0.2, 0.5, 6, 4), (0.25, 0.45, 7, 3)):
        root(px, W, H, cx + (dx * 9), tb - 4, dx, dy, L, th, seed)
    ivy(px, W, H, int(cx - 3), tt + 2, tb - 6, seed + 5)
    ivy(px, W, H, int(cx + 6), tt + 8, tb - 10, seed + 6)
    # 수관: 아랫면(납작)·몸통·위 둥근 지붕 — 덩이 rx 6~9 (참나무와 같은 덩이 크기)
    r = random.Random(seed); cl = []
    cw = W * 0.47; base = H * 0.40
    for k in range(10):
        u = -1 + 2 * k / 9; cl.append((W / 2 + u * cw * 0.92, base + (r.random() - 0.5) * 4, 8.5, 6.5))
    for k in range(9):
        u = -0.9 + 1.8 * k / 8; cl.append((W / 2 + u * cw * 0.85, base - 12 - 10 * math.sqrt(max(0, 1 - u * u)) + (r.random() - 0.5) * 4, 9, 7.5))
    for k in range(7):
        u = -0.75 + 1.5 * k / 6; cl.append((W / 2 + u * cw * 0.7, base - 26 - 12 * math.sqrt(max(0, 1 - u * u)) + (r.random() - 0.5) * 4, 8.5, 7))
    for k in range(4):
        u = -0.5 + k / 3; cl.append((W / 2 + u * cw * 0.5, base - 40 - 6 * math.sqrt(max(0, 1 - u * u)) + (r.random() - 0.5) * 3, 7.5, 6))
    cl = [(x, y, rx, ry) for (x, y, rx, ry) in cl if y - ry > 1]
    clumps(px, W, H, cl, dark=0, seed=seed)
    # 수관 사이로 다시 보이는 가지 몇 개
    for (bx, by) in ((cx - 14, base - 8), (cx + 12, base - 14), (cx - 2, base - 24)):
        for i in range(5):
            put(px, W, H, int(bx + i * (1 if bx > cx else -1) * 0.6), int(by + i), BK[2]); put(px, W, H, int(bx + i * (1 if bx > cx else -1) * 0.6) + 1, int(by + i), BK[1])
    # 늘어진 덩굴(오래된 나무)
    for k, vx in enumerate((cx - 26, cx - 9, cx + 15, cx + 30)):
        top = int(base + 4); L = 10 + int(_hash(k, 0, seed) * 14)
        for y in range(top, top + L):
            if 0 <= int(vx) < W and px[int(vx), y][3] and y < base + 6: continue
            put(px, W, H, int(vx), y, LF[1] if y % 3 else LF[3])
            if y % 4 == 1: put(px, W, H, int(vx) + 1, y, LF[4])
    return pz.fin(im)

def oak_ancient(kind='oakA', look=0, seed=3):
    """칩셋 참나무에 이끼·덩굴을 얹은 고목(질감은 원본 그대로)."""
    im = tree_look(kind, look).copy(); px = im.load(); W, H = im.size
    # 줄기 칸(아래 두 줄) 안 껍질 픽셀 중 밝은 쪽 일부를 이끼로
    for y in range(H - 34, H - 4):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a and r > g + 10 and x < W / 2 + 2 and vnoise(x, y * 0.5, 3, seed) > 0.6:
                px[x, y] = MOSS[2 + (x + y) % 2] + (255,)
    for k, vx in enumerate((W // 2 - 10, W // 2 + 9)):
        top = H - 50; L = 8 + int(_hash(k, 1, seed) * 8)
        for y in range(top, top + L):
            if y % 3 == 0: continue
            put(px, W, H, vx, y, LF[1])
            if y % 4 == 1: put(px, W, H, vx + 1, y, LF[4])
    return im

def tree_arch(seed=11):
    """입구의 고목 아치: 두 줄기가 휘어 맞붙고 그 위를 잎 덩이가 덮는다. 가운데 2칸은 지나가는 길(아랫줄 비움)."""
    W, H = 6 * 16, 7 * 16; im = new(W, H); px = im.load()
    # 두 기둥 줄기(왼쪽 x 6..22, 오른쪽 x 74..90) — 위로 갈수록 안쪽으로 휘어 만난다
    for side in (-1, 1):
        for y in range(28, H - 6):
            f = (H - 6 - y) / (H - 34)
            c0 = (14 if side < 0 else W - 14) - side * (f ** 2.4) * 30
            hw = 7.0 - f * 2.5
            x0 = int(round(c0 - hw)); x1 = int(round(c0 + hw))
            for x in range(x0, x1 + 1):
                c = bark_px(x, y, x0, x1, seed + side)
                if x < c0 - hw * 0.1 and vnoise(x, y * 0.5, 3, seed) > 0.62: c = MOSS[2 + (x + y) % 2]
                put(px, W, H, x, y, c)
            put(px, W, H, x0 - 1, y, BK[0]); put(px, W, H, x1 + 1, y, BK[0])
        bx = 14 if side < 0 else W - 14
        for (dx, dy, L, th) in ((-1.0 * side * -1, 0.2, 9, 4), (0.8 * side, 0.3, 8, 3), (-0.4 * side, 0.45, 5, 3)):
            root(px, W, H, bx + dx * 5, H - 9, dx if side < 0 else -dx, dy, L, th, seed + side)
        ivy(px, W, H, bx - 3, 40, H - 12, seed + 7 + side)
    r = random.Random(seed); cl = []
    for k in range(9):
        u = -1 + 2 * k / 8; cl.append((W / 2 + u * 40, 34 - 14 * math.sqrt(max(0, 1 - u * u * 0.7)) + (r.random() - 0.5) * 4, 8.5, 6.5))
    for k in range(6):
        u = -0.8 + 1.6 * k / 5; cl.append((W / 2 + u * 32, 18 - 6 * math.sqrt(max(0, 1 - u * u)) + (r.random() - 0.5) * 3, 8, 6.5))
    for k in range(3):
        u = -0.5 + k * 0.5; cl.append((W / 2 + u * 20, 10, 7, 5.5))
    for (x, y) in ((8, 44), (W - 9, 46), (12, 56), (W - 12, 58)):  # 기둥에 붙은 작은 잎 덩이
        cl.append((x, y, 5.5, 4.5))
    clumps(px, W, H, cl, dark=0, seed=seed)
    for vx in (W // 2 - 14, W // 2 - 3, W // 2 + 9):              # 아치 아래로 늘어진 덩굴
        for y in range(38, 38 + 8 + int(_hash(vx, 0, seed) * 10)):
            if y % 4 == 0: continue
            put(px, W, H, vx, y, LF[1]);
            if y % 3 == 1: put(px, W, H, vx + 1, y, LF[4])
    # 가운데 아랫줄은 비운다(길): 그림 확인용으로 지운다
    for y in range(H - 16, H):
        for x in range(32, 64): px[x, y] = (0, 0, 0, 0)
    return pz.fin(im)
