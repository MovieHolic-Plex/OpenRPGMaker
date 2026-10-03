"""도쿄 지구 부품 2: 사찰·담·점포·간판·소품. modern3 램프만 사용."""
import math
import random
from parts_tokyo import *

def _roof_tiles(c, x0, y0, w, h, ramp='tairu', slope=True):
    for j in range(h):
        for i in range(w):
            t = 0 if (i // 3 + j // 2) % 2 else -1
            if j < 2: t += 2
            elif j == h - 1: t -= 2
            c.P(x0 + i, y0 + j, K(ramp, t))
def _pillar(c, x, y, h, w=4):
    c.R(x, y, w, h, K('aka', 0)); c.VL(x, y, h, K('aka', 2)); c.VL(x + w - 1, y, h, K('aka', -2))
def _chochin(c, cx, y, w, h, txt=None):
    for j in range(h):
        k = abs(j - h / 2) / (h / 2); ww = int(w / 2 * (1 - .25 * k * k)) + 1
        for i in range(-ww, ww + 1):
            t = 1 if i < -ww // 3 else (-1 if i > ww // 2 else 0)
            c.P(cx + i, y + j, K('aka', 1 + t if j % 4 else t))
    c.HL(cx - w // 3, y, w * 2 // 3, K('tekko', -1)); c.HL(cx - w // 3, y + h - 1, w * 2 // 3, K('tekko', -1))
    if txt:
        for k, ch in enumerate(txt): gl(c, cx - 8 + 0, y + 6 + k * 14, ch, K('sumi', 1), bold=False) if False else None

def kaminarimon():
    """가미나리몬: 12칸 x 9칸. 맞배 본와 지붕 + 주홍 문 몸체 + 가운데 큰 초롱. 아래 가운데 3칸은 통로."""
    W = 16 * 12; H = 16 * 9; c = Cv(W, H)
    # 지붕 (사다리꼴 맞배)
    for j in range(40):
        inset = int((40 - j) * 0.55) if j < 40 else 0
        inset = max(0, 12 - j // 3)
        c.HL(inset, j + 4, W - 2 * inset, K('tairu', 0))
    _roof_tiles(c, 0, 0, 0, 0)
    for j in range(44):
        inset = max(0, 14 - j // 3)
        for i in range(inset, W - inset):
            t = 0 if ((i + (j // 3) * 2) // 4) % 2 else -1
            if j < 3: t += 2
            elif j >= 40: t -= 2
            elif i < inset + 3: t += 1
            c.P(i, 6 + j, K('tairu', t))
    c.HL(10, 4, W - 20, K('tairu', 3)); c.R(8, 2, W - 16, 3, K('tairu', 2)); c.HL(8, 2, W - 16, K('tairu', 3))
    for x in (8, W - 12): c.R(x, 0, 4, 4, K('kii', 1))                       # 치미
    # 처마 밑 + 몸체
    c.R(8, 50, W - 16, 6, K('aka', -1)); c.HL(8, 50, W - 16, K('aka', 1))
    for x in range(10, W - 10, 8): c.R(x, 51, 5, 4, K('shiro', 2) if (x // 8) % 2 else K('kii', 1))
    c.R(12, 56, W - 24, 70, K('aka', 0)); c.VL(12, 56, 70, K('aka', 2)); c.VL(W - 13, 56, 70, K('aka', -2))
    for x in (14, 44, 76, W - 78, W - 46, W - 18):
        _pillar(c, x, 56, 76, 5)
    c.R(24, 128, W - 48, 3, K('aka', -2))
    # 좌우 감실(풍신·뇌신) 어둡게
    for x0 in (24, W - 24 - 36):
        c.R(x0, 70, 36, 50, K('tekko', -2)); c.HL(x0, 70, 36, K('kii', 1)); c.R(x0 + 8, 82, 20, 26, K('aka', 1)); c.R(x0 + 12, 78, 12, 8, K('daidai', 2)); c.R(x0 + 14, 80, 8, 4, K('sumi', 1))
    # 대초롱
    _chochin(c, W // 2, 70, 44, 66)
    c.R(W // 2 - 18, 62, 36, 5, K('tekko', 1)); 
    for k, ch in enumerate('雷門'): gl(c, W // 2 - 8, 80 + k * 18, ch, K('sumi', 1), bold=True)
    # 기단
    c.R(0, H - 12, W, 12, K('conc', 3)); c.HL(0, H - 12, W, K('shiro', 3)); c.HL(0, H - 11, W, K('conc', 4)); c.HL(0, H - 1, W, K('conc', -1))
    for x in range(0, W, 16): c.VL(x, H - 11, 10, K('conc', 1))
    return ink(c)

def hozomon():
    """호조몬: 14칸 x 10칸. 입모야 2층 지붕, 양쪽 인왕 감실, 가운데 큰 초롱."""
    W = 16 * 14; H = 16 * 10; c = Cv(W, H)
    for j in range(38):
        inset = max(0, 24 - j * 24 // 38)
        for i in range(inset, W - inset):
            t = 0 if ((i + (j // 3) * 2) // 4) % 2 else -1
            if j < 3: t += 2
            elif j >= 35: t -= 2
            c.P(i, 2 + j, K('tairu', t))
    c.R(14, 40, W - 28, 5, K('aka', -1)); c.HL(14, 40, W - 28, K('aka', 1))
    c.R(18, 45, W - 36, 16, K('aka', 0))
    for x in range(22, W - 22, 12): c.R(x, 48, 6, 10, K('tekko', -2)); c.HL(x, 48, 6, K('kii', 1))
    for j in range(22):                    # 하층 지붕
        inset = max(0, 6 - j // 4)
        for i in range(inset, W - inset):
            t = 0 if ((i + (j // 3) * 2) // 4) % 2 else -1
            if j < 2: t += 2
            elif j >= 20: t -= 2
            c.P(i, 62 + j, K('tairu', t))
    c.R(10, 84, W - 20, 62, K('aka', 0)); c.VL(10, 84, 62, K('aka', 2)); c.VL(W - 11, 84, 62, K('aka', -2))
    for x in (12, 46, 66, 80, 94, 108, W - 72, W - 50, W - 16): _pillar(c, x, 84, 66, 4)
    for x0 in (14, W - 14 - 38):           # 인왕 감실
        c.R(x0, 92, 38, 52, K('tekko', -2)); c.HL(x0, 92, 38, K('kii', 1))
        c.R(x0 + 14, 98, 10, 8, K('daidai', 2)); c.R(x0 + 10, 108, 18, 28, K('aka', 1)); c.R(x0 + 12, 98, 14, 3, K('sumi', 1))
        for y in range(94, 144, 4): c.HL(x0 + 1, y, 36, K('tekko', 3))
    _chochin(c, W // 2, 94, 40, 54)
    c.R(W // 2 - 16, 88, 32, 5, K('tekko', 1))
    c.R(0, H - 10, W, 10, K('conc', 3)); c.HL(0, H - 10, W, K('shiro', 3)); c.HL(0, H - 1, W, K('conc', -1))
    return ink(c)

def pagoda():
    """오층탑 5층: 6칸 x 14칸."""
    W = 96; H = 224; c = Cv(W, H)
    c.R(44, 0, 8, 22, K('kii', 1)); c.VL(44, 0, 22, K('kii', 3));
    for k in range(4): c.R(40, 6 + k * 4, 16, 2, K('kii', 2))
    y = 24
    for k in range(5):
        w = 64 - k * 0 - (4 - k) * 0; ww = 30 + k * 7
        x0 = 48 - ww
        for j in range(12):
            inset = max(0, 6 - j // 2)
            for i in range(x0 + inset, 96 - x0 - inset):
                t = 0 if ((i + (j // 2) * 2) // 4) % 2 else -1
                if j < 2: t += 2
                elif j >= 10: t -= 2
                c.P(i, y + j, K('tairu', t))
        c.R(x0 + 10, y + 12, 2 * (48 - x0 - 10), 22, K('aka', 0)); c.VL(x0 + 10, y + 12, 22, K('aka', 2)); c.VL(95 - x0 - 10, y + 12, 22, K('aka', -2))
        for xx in range(x0 + 14, 96 - x0 - 14, 14): c.R(xx, y + 16, 7, 14, K('tekko', -2)); c.HL(xx, y + 16, 7, K('kii', 1))
        c.R(x0 + 8, y + 34, 2 * (48 - x0 - 8), 3, K('aka', -2))
        y += 38 if k < 4 else 0
    c.R(6, 206, 84, 16, K('conc', 3)); c.HL(6, 206, 84, K('shiro', 3)); c.HL(6, 221, 84, K('conc', -1))
    return ink(c)

def honden(w=18):
    """본당: w칸 x 11칸. 입모야 급경사 대지붕 + 향배 + 정면 계단 + 큰 초롱."""
    W = 16 * w; H = 176; c = Cv(W, H)
    for j in range(72):
        inset = max(0, 30 - j * 30 // 72)
        for i in range(inset, W - inset):
            t = 0 if ((i + (j // 3) * 2) // 4) % 2 else -1
            if j < 3: t += 2
            elif j >= 68: t -= 2
            if j % 18 == 0 and j: t -= 1
            c.P(i, 2 + j, K('tairu', t))
    c.R(20, 74, W - 40, 6, K('aka', -1)); c.HL(20, 74, W - 40, K('aka', 1))
    for x in range(24, W - 24, 8): c.R(x, 75, 4, 4, K('shiro', 2) if (x // 8) % 2 else K('kii', 1))
    c.R(22, 80, W - 44, 64, K('aka', 0)); c.VL(22, 80, 64, K('aka', 2)); c.VL(W - 23, 80, 64, K('aka', -2))
    for x in range(24, W - 24, 26): _pillar(c, x, 80, 68, 5)
    c.R(W // 2 - 40, 96, 80, 48, K('tekko', -2)); c.HL(W // 2 - 40, 96, 80, K('kii', 1))
    _chochin(c, W // 2, 100, 40, 60)
    for j in range(20):                    # 향배(앞 지붕)
        inset = 8 + j // 2
        for i in range(W // 2 - 56 + (0), W // 2 + 56):
            t = 0 if ((i + (j // 3) * 2) // 4) % 2 else -1
            if j < 2: t += 2
            elif j >= 18: t -= 2
            c.P(i, 120 + j, K('tairu', t))
    for k in range(6): c.R(W // 2 - 44 - k * 2, 144 + k * 4, 88 + k * 4, 4, K('conc', 3 - k % 2)); c.HL(W // 2 - 44 - k * 2, 144 + k * 4, 88 + k * 4, K('shiro', 3))
    return ink(c)

def nakamise_stall(v=0):
    """나카미세 점포 한 칸: 5칸 x 6칸. 구리 지붕 + 전식 간판 + 주홍 정면 + 셔터(그림). v: 간판색/셔터 변형."""
    W = 80; H = 96; c = Cv(W, H)
    cu = ('kawara', 'kawara', 'ki')[v % 3]; ct = (0, -1, 0)[v % 3]
    for j in range(22):
        for i in range(W):
            t = ct + (1 if j < 2 else -1 if j >= 20 else 0) + (0 if (i // 5 + j // 3) % 2 else -1)
            c.P(i, 2 + j, K(cu, t))
    c.R(0, 24, W, 6, K('aka', -1)); c.HL(0, 24, W, K('aka', 1))
    c.R(2, 30, W - 4, 14, K('shiro', 3)); c.HL(2, 30, W - 4, K('shiro', 4)); c.HL(2, 43, W - 4, K('shiro', -1))
    col = ('sora', 'midori', 'kii', 'daidai')[v % 4]
    for x in range(6, W - 8, 14): c.R(x, 34, 10, 6, K(col, 1)); c.HL(x, 34, 10, K(col, 3))
    c.R(0, 44, W, 44, K('aka', 0)); c.VL(0, 44, 44, K('aka', 2)); c.VL(W - 1, 44, 44, K('aka', -2))
    c.R(6, 50, W - 12, 34, K('hodo', 2))                                   # 셔터
    for y in range(50, 84, 2): c.HL(6, y, W - 12, K('hodo', 3 if (y // 2) % 2 else 1))
    pc = [('sora', 'kii', 'midori'), ('aka', 'shiro', 'kii'), ('midori', 'kii', 'sora'), ('daidai', 'sora', 'shiro')][v % 4]   # 셔터 그림(추상 풍경)
    c.R(10, 58, W - 20, 18, K(pc[0], 0)); c.R(14, 64, 14, 10, K(pc[1], 1)); c.R(38, 62, 20, 12, K(pc[2], 1)); c.HL(10, 76, W - 20, K('hodo', 0))
    c.R(0, 88, W, 6, K('conc', 3)); c.HL(0, 88, W, K('shiro', 3)); c.HL(0, 93, W, K('conc', -1))
    return ink(c)

def censer():
    c = Cv(48, 64)
    c.R(14, 8, 20, 6, K('tairu', 1)); c.HL(14, 8, 20, K('tairu', 3)); c.R(8, 14, 32, 4, K('tairu', 0)); c.R(10, 18, 28, 22, K('tekko', 1)); c.VL(10, 18, 22, K('tekko', 3)); c.VL(37, 18, 22, K('tekko', -1)); c.R(16, 24, 16, 10, K('tekko', -2))
    c.R(8, 40, 32, 5, K('conc', 3)); c.HL(8, 40, 32, K('shiro', 3)); c.R(5, 45, 38, 7, K('conc', 2)); c.HL(5, 51, 38, K('conc', -1))
    c.R(22, 2, 4, 4, K('kii', 2))
    return ink(c)
def smoke(frame=0):
    c = Cv(32, 48)
    for k in range(7):
        r = 5 + k // 2; cx = 16 + int(5 * math.sin(k * .9 + frame)); cy = 40 - k * 6
        for yy in range(-r, r + 1):
            for xx in range(-r, r + 1):
                if xx * xx + yy * yy <= r * r: c.P(cx + xx, cy + yy, K('conc', 3 if (xx + yy) % 3 else 4))
    return c
def ricksha():
    c = Cv(48, 32)
    for x in (10, 36):
        for yy in range(-6, 7):
            for xx in range(-6, 7):
                d = xx * xx + yy * yy
                if 25 <= d <= 38: c.P(x + xx, 24 + yy, K('tekko', -1))
    c.R(12, 8, 24, 12, K('sumi', 1)); c.R(14, 10, 20, 8, K('aka', 0)); c.R(12, 6, 24, 3, K('sumi', 2)); c.HL(12, 6, 24, K('tekko', 2))
    c.R(2, 18, 12, 2, K('ki' if False else 'ita', 0)); c.R(34, 18, 12, 2, K('ita', 0))
    c.R(40, 6, 4, 6, K('aka', 2)); c.R(41, 3, 3, 3, K('daidai', 2)); c.R(40, 12, 3, 8, K('sora', 0))
    return ink(c)
def stone_lantern():
    c = Cv(16, 32)
    c.R(6, 24, 4, 6, K('conc', 2)); c.VL(6, 24, 6, K('conc', 4)); c.R(4, 20, 8, 5, K('conc', 3)); c.R(5, 14, 6, 6, K('tekko', 2)); c.R(7, 16, 2, 3, K('kii', 3)); c.R(3, 10, 10, 4, K('conc', 3)); c.HL(3, 10, 10, K('shiro', 3)); c.R(6, 7, 4, 3, K('conc', 2)); c.R(4, 29, 8, 2, K('conc', 0))
    return ink(c)
def chozuya():
    c = Cv(96, 64)
    for j in range(20):
        inset = max(0, 14 - j)
        for i in range(inset, 96 - inset): c.P(i, 4 + j, K('kawara', (0 if (i // 4 + j // 2) % 2 else -1) + (1 if j < 2 else 0)))
    for x in (8, 84): c.R(x, 24, 5, 28, K('aka', 0)); c.VL(x, 24, 28, K('aka', 2)); c.VL(x + 4, 24, 28, K('aka', -2))
    c.R(26, 40, 44, 14, K('conc', 3)); c.HL(26, 40, 44, K('shiro', 4)); c.R(30, 42, 36, 4, K('garasu', 1)); c.HL(26, 53, 44, K('conc', -1))
    c.R(4, 54, 88, 7, K('conc', 3)); c.HL(4, 54, 88, K('shiro', 3)); c.HL(4, 60, 88, K('conc', -1))
    return ink(c)
def lantern_post(kind=0):
    c = Cv(16, 48)
    c.R(7, 8, 2, 38, K('tekko', 1)); c.VL(7, 8, 38, K('tekko', 3)); c.R(5, 44, 6, 3, K('hodo', 3))
    c.R(2, 4, 12, 3, K('tekko', 2)); _chochin(c, 8, 8, 12, 18)
    return ink(c)
def string_lanterns(n=8):
    """가로 줄 초롱 (n칸 x 1칸)."""
    c = Cv(16 * n, 16)
    for i in range(0, 16 * n, 16):
        c.HL(i, 1, 16, K('tekko', 2)); _chochin(c, i + 8, 3, 9, 12)
    return ink(c)

def nakamise_back(v=0):
    """나카미세 점포 뒷면(남쪽 열을 북쪽에서 본 모습): 구리 지붕 + 주홍 뒷벽 + 환기·배관."""
    W = 80; H = 96; c = Cv(W, H)
    cu = ('kawara', 'kawara', 'ki')[v % 3]; ct = (0, -1, 0)[v % 3]
    for j in range(30):
        for i in range(W):
            t = ct + (1 if j < 2 else -1 if j >= 28 else 0) + (0 if (i // 5 + j // 3) % 2 else -1)
            c.P(i, 2 + j, K(cu, t))
    c.R(0, 32, W, 8, K('aka', -1)); c.HL(0, 32, W, K('aka', 1))
    c.R(0, 40, W, 48, K('aka', 0)); c.VL(0, 40, 48, K('aka', 2)); c.VL(W - 1, 40, 48, K('aka', -2))
    for x in (12, 44): c.R(x, 50, 10, 8, K('tekko', 0)); c.HL(x, 50, 10, K('hodo', 2)); [c.VL(x + i, 51, 6, K('tekko', 2)) for i in range(2, 10, 3)]
    c.R(62, 46, 4, 38, K('hodo', 2)); c.VL(62, 46, 38, K('hodo', 4)); c.R(58, 44, 12, 3, K('hodo', 3))
    c.R(22, 62, 22, 22, K('hodo', 1)); c.HL(22, 62, 22, K('hodo', 3)); c.VL(33, 62, 22, K('hodo', 0))
    c.R(0, 88, W, 6, K('conc', 3)); c.HL(0, 88, W, K('shiro', 3)); c.HL(0, 93, W, K('conc', -1))
    return ink(c)
