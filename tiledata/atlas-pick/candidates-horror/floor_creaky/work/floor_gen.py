import sys; sys.path.insert(0, '.')
from h3_lib import *

# 범례: 글자 → (램프, 단). 바닥 판자 rot 1-6, 틈 void, 먼지 dust, 눈 sheet/blood
LEG = {}
for t in range(7): LEG['0123456'[t]] = ('rot', t)          # 판자 (글자=단)
for t in range(4): LEG['abcd'[t]] = ('void', t)             # 틈
for t in range(7): LEG['sSTUVWX'[t]] = ('dust', t)           # 먼지 s0 S1 T2 U3 V4 W5 X6
for t in range(7): LEG['ghijklm'[t]] = ('sheet', t)          # 눈 흰자 g0..m6
for t in range(6): LEG['nopqrt'[t]] = ('blood', t)           # 붉은 홍채/피 n0..
for t in range(5): LEG['uvwxy'[t]] = ('hmoss', t)

def clamp(v): return max(1, min(6, v))

# 판자 8장(각 y=4i 가 틈 줄). 기본 단, 세로 이음 x 위치(32 둘레), 결(가로 대시: x,길이)
BASE = [3, 2, 3, 4, 2, 3, 2, 3]
SEAMS = [[5, 21], [12, 28], [2, 17], [9, 25], [14, 30], [4, 20], [10, 26], [1, 18]]
GRAIN = [[(8, 5), (24, 4)], [(1, 4), (16, 6)], [(10, 3), (26, 5)], [(4, 6), (19, 3)],
         [(20, 4), (7, 3)], [(12, 5), (29, 3)], [(0, 4), (15, 4)], [(22, 5), (6, 3)]]

def planks(off=None):
    g = G(32, 32)
    for i in range(8):
        y0 = 4 * i; b = BASE[i]
        for x in range(32):
            g.put(x, y0, 'b')                         # 틈 줄
            for r, d in ((1, +1), (2, 0), (3, -1)):
                o = off(x, y0 + r) if off else 0
                g.put(x, y0 + r, '0123456'[clamp(b + d + o)])
        for sx in SEAMS[i]:
            for r in (1, 2, 3): g.put(sx, y0 + r, 'b')
            g.put(sx, y0, 'a')                          # 이음 교차점은 더 깊게
            g.put(sx + 1, y0 + 1, '0123456'[clamp(b + 2 + (off(sx + 1, y0 + 1) if off else 0))], wrap=True)
        for gx, ln in GRAIN[i]:
            for k in range(ln): g.put(gx + k, y0 + 2, '0123456'[clamp(b - 1 + (off(gx + k, y0 + 2) if off else 0))], wrap=True)
    return g

def lift(g, cap_tone='6', hi=True):
    """3번 판자(y12..15) 오른쪽 끝(x23..29)이 들려 있다: 윗줄 밝게, 끝면 한 줄, 아래 판자 위에 그림자"""
    for x in range(23, 30):
        g.put(x, 12, '5' if x < 29 else 'b')
        for y in (13, 14): g.put(x, y, '4')
        g.put(x, 15, '3')
    g.put(23, 12, 'b')
    for y in (12, 13, 14, 15): g.put(29, y, cap_tone if y < 15 else '4')
    for y in (12, 13, 14, 15): g.put(30, y, 'a')
    for x in range(24, 32):
        g.put(x, 16, 'a')
    for x in range(24, 31): g.put(x, 17, 'b' if x > 25 else '1')
    for x in range(24, 30): g.put(x, 18, '1' if x > 27 else g.get(x, 18))
    g.put(31, 12, 'b'); g.put(31, 13, 'a'); g.put(31, 14, 'a'); g.put(31, 15, 'b')

def knot(g):
    g.pts('1', 17, 5, 18, 5, 16, 6, 19, 6, 17, 7, 18, 7)
    g.pts('0', 17, 6, 18, 6)

def dust(g, pts):
    for x, y in pts: g.put(x, y, 'S')

def hole(g, deep=2, eyes=False, rim='5'):
    M = ["....####........", "..##########....", ".#############..", ".##############.", "################", "################",
         "################", ".###############", ".##############.", "..#############.", "..###########...", "...##########...",
         "....########....", ".....######.....", "......####......"]
    ys = 9
    cols = {}
    for j, row in enumerate(M):
        for i, c in enumerate(row):
            if c == '#': cols.setdefault(8 + i, []).append(ys + j)
    for x, yl in cols.items():
        y_top = yl[0]; y_bot = yl[-1]
        for y in yl:
            d = y - y_top
            if d == 0: c = rim
            elif d == 1: c = '3'
            elif d == 2: c = '1'
            else: c = 'b' if y < y_bot - 1 else 'a'
            if deep == 3 and d >= 3: c = 'a' if (x + y) % 3 else 'b'
            g.put(x, y, c)
    # 왼쪽에서 부러져 매달린 판자 조각(3번 판자와 같은 높이 y13..15), 끝이 들쭉날쭉
    for y, ln in ((13, 5), (14, 4), (15, 5)):
        for k in range(ln):
            g.put(8 + k, y, '5' if y == 13 else ('3' if y == 14 else '2'))
    g.put(13, 13, '4'); g.put(12, 16, '2'); g.put(11, 16, '1'); g.pts('6', 9, 13, 10, 13)
    # 오른쪽 아래 부러진 조각 끝
    g.pts('4', 21, 17, 22, 17); g.pts('2', 21, 18, 22, 18, 20, 18)
    dust(g, [(15, 22), (17, 21), (13, 20)])
    if eyes:
        g.pts('l', 14, 18, 18, 18); g.pts('p', 14, 19)
        g.pts('l', 18, 19); g.pts('a', 14, 19, 18, 19)
        g.pts('q', 14, 18, 18, 18)
        g.pts('l', 13, 18, 17, 18)

if __name__ == '__main__':
    SLUG = 'floor_creaky'
    # ---------- A ----------
    def offA(x, y): return -1 if (5 <= x <= 13 and 21 <= y <= 27 and not ((x in (5, 13)) and y in (21, 27))) else 0
    a = planks(offA); lift(a); knot(a)
    dust(a, [(3, 4), (14, 8), (26, 8), (7, 20), (20, 24), (29, 28), (11, 0), (22, 16), (1, 12)])
    a.pts('4', 9, 21, 11, 21)   # 얼룩 위쪽 테가 마른 자리(밝은 흔적)
    fA = a
    # ---------- B ----------
    B_OFF = None
    b = G(32, 32)
    for i in range(8):
        y0 = 4 * i; base = BASE[i]
        for x in range(32):
            b.put(x, y0, 'a')
            for r, d in ((1, +2), (2, 0), (3, -2)):
                b.put(x, y0 + r, '0123456'[clamp(base + d)])
        for sx in SEAMS[i]:
            for r in (1, 2, 3): b.put(sx, y0 + r, 'a')
            b.put(sx + 1, y0 + 1, '0123456'[clamp(base + 3)])
        for gx, ln in GRAIN[i]:
            for k in range(ln): b.put(gx + k, y0 + 2, '0123456'[clamp(base - 1)], wrap=True)
    lift(b, cap_tone='6'); knot(b)
    for x in range(24, 31): b.put(x, 19, '0')    # 들린 끝의 그림자를 한 줄 더 길게
    dust(b, [(3, 4), (26, 8), (20, 24), (29, 28)])
    fB = b
    # ---------- C ----------
    c = planks(); lift(c); knot(c)
    # 틈 속 눈: 3번째 판자 위쪽 틈(y8)을 넓혀 눈을 심는다
    for x in range(11, 21):
        for y in (8, 9, 10): c.put(x, y, 'b')
    for x in range(13, 19): c.put(x, 9, 'a')
    c.pts('l', 14, 9, 15, 9, 16, 9); c.pts('q', 15, 9); c.pts('m', 14, 8)
    dust(c, [(3, 4), (26, 8), (7, 20)])
    # 긁힌 자국 셋(오른쪽 아래로 비스듬히)
    for k in range(6): c.put(3 + k, 21 + k, '0'); 
    for k in range(6): c.put(6 + k, 21 + k, '0')
    fC = c
    LG = LEG
    notes = {
      'A': ('낡은 마룻바닥: v5 판자를 몇십 년 묵힌 것 — 판 8장·이음 엇갈림, 옹이 하나, 물얼룩(왼아래), 들린 판 끝 하나, 틈에 먼지', fA),
      'B': ('빛 대비 강화: 판 윗줄 두 단 밝게·아랫줄 두 단 어둡게, 틈은 void 최암, 들린 판 밑 그림자를 길게', fB),
      'C': ('틈 속의 눈: 두 번째 틈이 벌어져 그 안에서 눈 하나(흰자·붉은 홍채)가 올려다본다 + 손톱 긁힌 자국 두 줄', fC),
    }
    for d, (n, g) in notes.items():
        save(SLUG, d, g, LG, n)
    # 부서진 바닥
    for d, (n, g) in notes.items():
        bg = g.copy()
        if d == 'C': hole(bg, deep=3, eyes=True)
        elif d == 'B': hole(bg, deep=3, rim='6')
        else: hole(bg)
        nn = {'A': '뚫린 바닥(A): 바닥 A 그대로 가운데만 무너졌다 — 위 가장자리에 판 두께 선, 매달린 부러진 판, 아래는 어둠',
              'B': '뚫린 바닥(B): 바닥 B 와 같은 대비 — 판 두께 밝은 테, 구멍 속은 더 깊은 void',
              'C': '뚫린 바닥(C): 구멍 속 어둠에서 눈 한 쌍이 올려다본다'}[d]
        save('floor_creaky_broken', d, bg, LG, nn)
