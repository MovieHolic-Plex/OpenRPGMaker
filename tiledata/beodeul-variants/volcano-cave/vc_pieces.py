# 화산 동굴 새 조각 — 버들항 칩셋 램프(ST 돌·WD 나무·RD 빨강·SR 짚)에서만 색을 고른 손 도트. 결정적.
import os, sys, math
HERE0 = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE0, '..', '_common-4'))
import numpy as np
from PIL import Image
import c4
from c4 import ST, WD, RD, SR, PL, rgb, pz, noise, hashgrid
BR = [rgb(c) for c in ('#372624', '#4a3c33', '#614026', '#6b4e2a', '#8b6a39')]     # 버들항 바위 갈색 (rocky 땅과 같은 색)

def sp(W, H):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); return im, im.load()
def px(p, W, H, x, y, c):
    if 0 <= x < W and 0 <= y < H: p[x, y] = tuple(c) + (255,)
def rect(p, W, H, x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): px(p, W, H, x, y, c)
def fin(im): return pz.fin(im)
def _h(x, y, s=0):
    return ((x * 73856093) ^ (y * 19349663) ^ (s * 83492791)) % 1000 / 1000.0

def _bricks(p, W, H, x0, y0, x1, y1, course=6, bw=10, lit=True, tones=None, seed=1):
    T = tones or (ST[2], ST[3], ST[3], ST[4])
    for y in range(y0, y1 + 1):
        r = (y - y0) // course
        for x in range(x0, x1 + 1):
            xo = (x - x0 + (r % 2) * (bw // 2)) % bw
            t = (x - x0) / max(1, (x1 - x0))
            c = T[1] if (t > .5 or not lit) else T[2]
            if lit and t < .28: c = T[3]
            if _h(x // bw + r * 5, r, seed) < .18: c = T[0] if t > .3 else T[1]
            if (y - y0) % course == course - 1: c = ST[1]
            elif xo == bw - 1: c = ST[1]
            elif (y - y0) % course == 0 and lit: c = T[3] if t < .7 else T[1]
            px(p, W, H, x, y, c)

def furnace():
    W, H = 48, 48; im, p = sp(W, H)
    rect(p, W, H, 4, 10, 43, 17, ST[4])                      # 윗면
    for x in range(4, 44):
        for y in range(10, 18):
            if _h(x, y, 5) < .2: px(p, W, H, x, y, ST[5])
            if _h(x, y, 6) < .1: px(p, W, H, x, y, ST[3])
    _bricks(p, W, H, 14, 0, 33, 9, 5, 8, seed=2)             # 연통(두건)
    rect(p, W, H, 14, 0, 33, 1, ST[5]); rect(p, W, H, 14, 2, 33, 2, ST[4])
    _bricks(p, W, H, 2, 18, 45, 47, 6, 10, seed=3)           # 앞면
    rect(p, W, H, 2, 18, 45, 19, ST[4])                      # 앞 윗 모서리 하이라이트
    rect(p, W, H, 2, 44, 45, 47, ST[2])                      # 받침
    rect(p, W, H, 2, 44, 45, 44, ST[4])
    # 아궁이 (틀 → 열린 곳)
    def arch(x0, x1, ytop, ybot, col_fn):
        cx = (x0 + x1) / 2.0; r = (x1 - x0 + 1) / 2.0
        for y in range(ytop, ybot + 1):
            for x in range(x0, x1 + 1):
                dy = ytop + r - y
                if dy > 0 and ((x + .5 - cx) ** 2 + dy * dy) > r * r: continue
                px(p, W, H, x, y, col_fn(x, y))
    arch(13, 34, 22, 43, lambda x, y: ST[4] if x < 16 or y < 26 else ST[3])
    def mouth(x, y):
        v = y
        if v < 28: c = RD[1]
        elif v < 32: c = RD[2]
        elif v < 36: c = RD[3]
        elif v < 39: c = RD[4]
        else: c = RD[5]
        if 21 <= x <= 26 and y >= 38: c = SR[5]
        if 22 <= x <= 25 and y >= 41: c = SR[6]
        if _h(x, y, 9) < .08 and 32 < y < 40: c = SR[4]
        return c
    arch(16, 31, 25, 43, mouth)
    for x in (16, 31): 
        for y in range(30, 44): px(p, W, H, x, y, RD[1] if y < 34 else RD[2])
    # 균열 · 그을음
    for x, y in ((6, 26), (7, 27), (8, 28), (38, 31), (39, 32), (40, 33), (9, 38), (40, 24)): px(p, W, H, x, y, ST[0])
    return fin(im)

def pillar_fallen():
    W, H = 32, 16; im, p = sp(W, H)
    for x in range(1, 26):
        for y in range(4, 13):
            t = (y - 4) / 8.0
            c = ST[5] if t < .15 else (ST[4] if t < .4 else (ST[3] if t < .7 else ST[2]))
            if x % 9 == 8: c = ST[1]
            px(p, W, H, x, y, c)
    for y in range(4, 13):                                    # 부러진 단면
        for x in range(26, 30 + (y % 3)):
            px(p, W, H, x, y, ST[4] if (x + y) % 3 else ST[5])
    for x, y in ((6, 12), (12, 13), (18, 12), (22, 13), (28, 12)): px(p, W, H, x, y, ST[1])
    return fin(im)

def bridge(cw=3, cl=7):
    """세로 돌다리 (3/4). cw×cl 칸. 위 끝 = 북. 윗면: 판석 깔린 다리 바닥 + 낮은 돌난간 윗면 + 난간 기둥 머리.
    아래(남) 끝 = 앞면(돌벽 + 둥근 아치 밑) 16px. 왼 위 빛 → 왼 난간 그림자가 바닥에 오른쪽으로 떨어진다."""
    W, H = cw * 16, cl * 16; im, p = sp(W, H)
    FH = 16                                                      # 앞면 높이
    top_end = H - FH
    for y in range(0, top_end):
        for x in range(0, W):
            rail_l = x < 5; rail_r = x >= W - 5
            if rail_l or rail_r:                                 # 난간 윗면 (폭 5): 왼 밝은 줄·오른 어두운 줄
                xi = x if rail_l else x - (W - 5)
                c = (ST[5], ST[5], ST[4], ST[4], ST[3])[xi]
                if _h(x, y // 4, 90) < .10: c = ST[3]
                if y % 16 == 0: c = ST[2]
            else:                                               # 판석 깔린 바닥
                row = y // 14
                c = ST[4] if _h(x // 4, y // 3, 91) < .62 else ST[3]             # 매끈한 큰 판석 — 덩어리 얼룩
                if _h(x, y, 92) < .04: c = ST[5]
                if y < 6 and 7 <= x < W - 7: c = ST[4]                          # 북쪽 끝 평평한 윗면
                if y % 14 == 13: c = ST[2]                                     # 가로 이음매만 길게
                elif x == 5 + 18 + (row % 2) * 10 and row % 3 != 1: c = ST[2]       # 세로 이음매는 드물게
                if 5 <= x <= 6: c = ST[2]                                      # 왼 난간 그림자
            px(p, W, H, x, y, c)
    for py_ in range(6, top_end, 32):                           # 난간 기둥: 윗면 6×4 + 앞면 4
        for xs in (-1, W - 7):
            for dx in range(7):
                for dy in range(4): px(p, W, H, xs + dx, py_ + dy, ST[6] if dy == 0 or dx == 0 else ST[5])
                for dy in range(4, 8): px(p, W, H, xs + dx, py_ + dy, ST[3] if dx < 4 else ST[2])
    # 앞면: 돌벽 16px + 가운데 둥근 아치(안쪽 어두움) — 용암 위 교각
    for y in range(top_end, H):
        for x in range(0, W):
            r = (y - top_end) // 5
            c = ST[3] if x < W // 2 else ST[2]
            if (y - top_end) % 5 == 4: c = ST[1]
            elif (x + (r % 2) * 6) % 12 == 11: c = ST[1]
            if y == top_end: c = ST[5]                          # 윗모서리 밝은 선
            if y >= H - 2: c = ST[1]
            px(p, W, H, x, y, c)
    for y in range(top_end + 3, H - 1):                         # 아치 밑(어둠)
        half = 8 - max(0, (top_end + 8 - y)) * 0.0
        for x in range(W // 2 - 8, W // 2 + 8):
            dx = x + .5 - W / 2
            if y < top_end + 8 and dx * dx + (y - (top_end + 8)) ** 2 > 64: continue
            px(p, W, H, x, y, ST[0] if y < top_end + 6 else ST[1])
    return fin(im)


# ---- 3/4 재작업 (윗면 T + 앞면 F, 위 왼쪽 빛). 아래 조각은 앞 정의를 덮어쓴다.
def _ell(p, W, H, cx, cy, rx, ry, fn):
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1.0: px(p, W, H, x, y, fn(x, y))

def bellows():
    """풀무 32x24 — 윗널(T 6) + 가죽 주머니 앞면 + 놋 부리."""
    W, H = 32, 24; im, p = sp(W, H)
    for x in range(0, 9):                                    # 부리(철관) — 앞면 쪽에 붙은 관
        rect(p, W, H, x, 14, x, 16, ST[4] if x < 2 else ST[3])
    rect(p, W, H, 0, 14, 8, 14, ST[5]); rect(p, W, H, 0, 17, 8, 17, ST[1])
    for y in range(2, 8):                                    # 윗널 (평평한 띠)
        for x in range(8, 28):
            c = WD[5]
            if y == 2: c = WD[6]
            if _h(x, y, 3) < .08: c = WD[4]
            px(p, W, H, x, y, c)
    for y in range(8, 22):                                   # 가죽 주머니 앞면 (앞은 한 칸 어둡다)
        for x in range(8, 28):
            t = (x - 8) / 19.0
            c = WD[3] if t < .45 else WD[2]
            if y >= 19: c = WD[2] if t < .45 else WD[1]
            px(p, W, H, x, y, c)
    for x in (12, 17, 22): rect(p, W, H, x, 9, x, 18, WD[1])   # 주름
    rect(p, W, H, 8, 8, 27, 8, WD[4])                          # 윗널 앞 모서리 하이라이트
    rect(p, W, H, 8, 20, 27, 21, WD[1])                        # 아래 널빤지 그림자
    rect(p, W, H, 28, 4, 29, 18, WD[1]); rect(p, W, H, 28, 3, 29, 3, WD[3])   # 오른쪽 옆 이음 (얇은 밑변 그림자)
    for y in range(3, 8): px(p, W, H, 24 + (y - 3) // 3, y, WD[6])             # 윗널 위에 누운 손잡이 (띠 위의 선)
    return fin(im)

def coal_pile():
    """숯더미 32x16 — 흙받이 테두리 안 숯 (윗면 5행, 앞면 8행)."""
    W, H = 32, 16; im, p = sp(W, H)
    for y in range(2, 14):
        t = (y - 2) / 11.0
        hw = 10 + 5 * t
        for x in range(int(16 - hw), int(16 + hw) + 1):
            r = _h(x, y, 11)
            if y <= 6:                                       # 윗면
                c = ST[3] if r < .55 else (ST[2] if r < .9 else ST[4])
            else:                                            # 앞면
                c = ST[1] if r < .55 else (ST[2] if r < .85 else ST[0])
                if x < 9 + (y - 7) and r > .5: c = ST[2]
            px(p, W, H, x, y, c)
    for x, y in ((12, 3), (20, 4), (16, 5)): px(p, W, H, x, y, RD[4])
    for x, y, c in ((13, 9, RD[4]), (19, 10, RD[3]), (22, 8, RD[4]), (10, 11, RD[3]), (23, 11, SR[5])): px(p, W, H, x, y, c)
    return fin(im)

def ingots():
    """주괴 더미 32x16 — 위 단 윗면 4행 + 앞면, 아래 단 돌출."""
    W, H = 32, 16; im, p = sp(W, H)
    def block(x0, x1, ytop, yfront, ybot, hot=False):
        hi, mid, dk = (RD[5], RD[4], RD[3]) if hot else (ST[5], ST[4], ST[3])
        for y in range(ytop, ybot + 1):
            for x in range(x0, x1 + 1):
                if y < yfront: c = hi if x > x0 else mid
                else:
                    c = mid if x == x0 else dk
                    if y == ybot: c = RD[2] if hot else ST[2]
                    if (x - x0) % 9 == 8: c = ST[1]             # 주괴 사이 이음
                px(p, W, H, x, y, c)
    block(9, 22, 0, 5, 7)
    block(2, 29, 8, 10, 15)                                   
    return fin(im)

def _cap_col(p, W, H, cx, top, bot, hw_top, hw_bot, cap_h, capc, lit, mid, dk, seed=0, taper=1.0):
    """윗면이 잘려 납작한 기둥 — 윗면(cap_h 행, 밝음) + 앞면(원기둥 음영: 왼쪽 밝고 오른쪽 어둡다)."""
    for y in range(top, bot + 1):
        t = (y - top) / max(1.0, bot - top)
        hw = hw_top + (hw_bot - hw_top) * (t ** taper)
        x0 = int(round(cx - hw)); x1 = int(round(cx + hw)) - 1
        for x in range(x0, x1 + 1):
            u = (x - x0) / max(1.0, x1 - x0)
            if y < top + cap_h: c = capc if (x > x0 + 0 or y > top) else lit
            else:
                c = lit if u < .25 else (mid if u < .65 else dk)
                if _h(x, y, 40 + seed) < .06: c = dk
            px(p, W, H, x, y, c)

def pillar_broken(v=0):
    """부러진 기둥 — 깨진 윗면(타원, 4행) + 원통 앞면 + 모난 받침."""
    W, H = 16, 32; im, p = sp(W, H)
    top = (8, 15)[v % 2]
    for y in range(top, 27):
        t = (y - top) / max(1.0, 26 - top)
        for x in range(2, 14):
            u = (x - 2) / 11.0
            if y < top + 4:                                   # 깨진 윗면
                edge = (y == top and (x < 4 or x > 11)) or (y == top + 3 and (x < 3 or x > 12))
                if edge: continue
                c = ST[5] if u < .6 else ST[4]
                if _h(x, y, 22 + v) < .15: c = ST[3]
            else:                                              # 앞면: 원통 음영
                c = ST[4] if u < .2 else (ST[3] if u < .55 else (ST[2] if u < .85 else ST[1]))
                if _h(x, y // 2, 21 + v) < .09: c = ST[1]
                if (y - top) % 9 == 8: c = ST[1]               # 조각 이음
            px(p, W, H, x, y, c)
    for y in range(top + 4, 27):                               # 세로 금
        if _h(7, y, 30 + v) < .25: px(p, W, H, 5 + (y % 3), y, ST[1])
    for x in range(0, 16):                                     # 받침 (윗면 1행 + 앞 5행)
        for y in range(26, 32):
            px(p, W, H, x, y, ST[5] if y == 26 else (ST[3] if x < 11 else ST[2]))
    rect(p, W, H, 0, 31, 15, 31, ST[1])
    return fin(im)

def spike(kind=0):
    """흑요석 각기둥. 끝을 비스듬히 자른 윗면(밝음) + 어두운 앞면 + 왼쪽 빛줄."""
    W, H = {0: (16, 32), 1: (32, 32), 2: (16, 16)}[kind]; im, p = sp(W, H)
    def prism(cx, base_y, top_y, hw, cap):
        for y in range(top_y, base_y + 1):
            t = (y - top_y) / max(1.0, base_y - top_y)
            w = max(2.0, hw * (0.45 + 0.55 * t))
            x0 = int(round(cx - w)); x1 = int(round(cx + w)) - 1
            for x in range(x0, x1 + 1):
                u = (x - x0) / max(1.0, x1 - x0)
                if y < top_y + cap:                           # 윗 쪽 잘린 면
                    if y == top_y and (x == x0 or x == x1): continue
                    c = ST[6] if (x - x0) < 2 else ST[5]
                    if u > .7: c = ST[4]
                else:
                    c = ST[2] if u < .22 else (ST[1] if u < .6 else ST[0])
                    if u < .08: c = ST[4]
                    if _h(x, y, 40 + cx) < .05 and u > .3: c = ST[2]
                px(p, W, H, x, y, c)
        for x in range(int(cx - hw) - 1, int(cx + hw) + 1): px(p, W, H, x, base_y, ST[0])
    if kind == 0: prism(8, 29, 1, 6, 6)
    elif kind == 1: prism(10, 29, 3, 5, 5); prism(23, 30, 13, 5, 4)
    else: prism(5, 14, 1, 4, 4); prism(12, 14, 4, 3, 4)
    return fin(im)

def fire_crystal():
    """불 수정 16x16 — 각기둥: 윗 면(밝은 오렌지), 앞 면(붉은), 바위 받침."""
    W, H = 16, 16; im, p = sp(W, H)
    _ell(p, W, H, 8, 13, 7, 2.2, lambda x, y: BR[1] if x > 5 else BR[3])
    for y in range(2, 13):
        for x in range(4, 12):
            u = (x - 4) / 7.0
            if y < 6:
                if y == 2 and (x < 6 or x > 9): continue
                c = SR[5] if u < .6 else SR[4]
            else:
                c = RD[4] if u < .3 else (RD[3] if u < .7 else RD[2])
            px(p, W, H, x, y, c)
    for x, y in ((5, 7), (5, 8), (5, 9), (6, 7)): px(p, W, H, x, y, SR[5])
    for x, y in ((9, 10), (10, 10)): px(p, W, H, x, y, RD[1])
    return fin(im)

def stalagmite():
    """석순 16x24 — 끝이 둥글게 닳은 윗면(5행) + 넓어지는 앞면."""
    W, H = 16, 24; im, p = sp(W, H)
    for y in range(3, 23):
        t = (y - 3) / 19.0; hw = 2.6 + 4.4 * t ** 1.1
        for x in range(int(round(8 - hw)), int(round(8 + hw))):
            u = (x - (8 - hw)) / max(1.0, 2 * hw)
            if y < 8:
                if y == 3 and (x < 6 or x > 9): continue
                c = BR[4] if u < .55 else BR[3]
            else:
                c = BR[3] if u < .22 else (BR[2] if u < .6 else BR[1])
                if _h(x, y, 50) < .08: c = BR[0]
            px(p, W, H, x, y, c)
    for x in range(1, 15): px(p, W, H, x, 22, BR[0])
    return fin(im)

def bones():
    """누운 뼈대 16x16 — 등뼈(윗면 3행) + 늑골(앞면)."""
    W, H = 16, 16; im, p = sp(W, H)
    rect(p, W, H, 1, 2, 13, 6, PL[6])
    rect(p, W, H, 2, 7, 12, 13, ST[1])                       # 늑골 사이 그늘
    for i in range(5):
        x = 2 + i * 2 + (0 if i < 5 else 0)
        for y in range(7, 12 - (i % 2)): px(p, W, H, x, y, PL[4]); px(p, W, H, x + 1 if i % 2 == 0 and False else x, y, PL[4])
        px(p, W, H, x, 12 - (i % 2), PL[3])
    rect(p, W, H, 1, 13, 13, 13, PL[3])
    for x, y in ((14, 8), (15, 8), (14, 9), (15, 9), (14, 10), (15, 10)): px(p, W, H, x, y, PL[5])   # 두개골 모서리
    px(p, W, H, 14, 9, ST[0])
    return fin(im)

def hanging_chain():
    """벽에 걸린 사슬 8x32 — 윗 쇠 걸이(윗면 4행) + 고리 사슬."""
    W, H = 8, 32; im, p = sp(W, H)
    for y in range(0, 5):
        for x in range(0, 8): px(p, W, H, x, y, ST[5])
    for x in range(0, 8): px(p, W, H, x, 5, ST[2]); px(p, W, H, x, 6, ST[1])
    for y in range(7, 30):
        if y % 4 in (0, 1): px(p, W, H, 3, y, ST[4]); px(p, W, H, 4, y, ST[3])
        else: px(p, W, H, 2, y, ST[3]); px(p, W, H, 5, y, ST[2])
    for x in range(1, 7):
        px(p, W, H, x, 30, ST[3]); px(p, W, H, x, 31, ST[2])
    rect(p, W, H, 2, 31, 5, 31, ST[4])
    return fin(im)

def steam_vent():
    """증기 구멍 16x16 — 돌 테두리(넓은 윗면 타원, 붉은 구멍) + 앞 턱 + 구멍 위 성긴 김."""
    W, H = 16, 16; im, p = sp(W, H)
    _ell(p, W, H, 8, 6, 7.5, 4.2, lambda x, y: BR[4] if y < 9 else BR[3])
    _ell(p, W, H, 8, 7.5, 4, 1.8, lambda x, y: RD[3] if y >= 7 else RD[1])
    for x in range(1, 15):                                   # 앞 턱
        for y in range(10, 14):
            if abs(x - 8) <= 7 - (y - 10) * .4: px(p, W, H, x, y, BR[1] if y < 12 else BR[0])
    for cx, cy, r in ((8, 6, 1.6), (9, 3, 1)):               # 김 — 체크무늬로 성기게(구멍 위)
        for y in range(int(cy - r), int(cy + r) + 2):
            for x in range(int(cx - r), int(cx + r) + 2):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 1 and (x + y) % 2 == 0: px(p, W, H, x, y, ST[6])
    return im

def ember_patch(v=0):
    """불씨 더미 16x16 — 재 둔덕: 달군 윗면 + 재 앞면. v1 은 작은 덩이 둘."""
    W, H = 16, 16; im, p = sp(W, H)
    def heap(cx, top, bot, hw):
        for y in range(top, bot + 1):
            t = (y - top) / max(1.0, bot - top); w = hw * (.6 + .4 * t)
            for x in range(int(round(cx - w)), int(round(cx + w))):
                r = _h(x, y, 61)
                if y < top + 5:
                    c = RD[4] if r < .95 else SR[5]
                else:
                    c = ST[1] if r < .94 else ST[0]
                    if (x + y) % 9 == 0 and r > .9: c = RD[2]
                px(p, W, H, x, y, c)
    if v == 0: heap(8, 1, 14, 6)
    else: heap(7, 1, 14, 6)
    if v: im = im.transpose(Image.FLIP_LEFT_RIGHT); p = im.load()
    return fin(im)

def altar():
    """흑요석 제단 64x48 — 윗면 타원 룬 고리 + 3단 계단(단마다 윗면/앞면) + 앞 끝 첨탑."""
    W, H = 64, 48; im, p = sp(W, H)
    # 첨탑: 끝 잘린 각기둥 (윗 잘린 면 6행)
    for y in range(0, 26):
        t = y / 25.0; hw = 4 + 3 * t if y > 0 else 3
        for x in range(int(32 - hw), int(32 + hw)):
            u = (x - (32 - hw)) / max(1.0, 2 * hw)
            if y < 7:
                c = ST[6]
            else:
                c = ST[2] if u < .3 else (ST[1] if u < .7 else ST[0])
                if u < .08: c = ST[4]
            px(p, W, H, x, y, c)
    def tier(x0, x1, ytop, yfront, ybot):
        for y in range(ytop, ybot + 1):
            for x in range(x0, x1):
                if y < yfront:
                    c = ST[4] if (x - x0) > 3 else ST[5]
                    if _h(x, y, 80) < .1: c = ST[3]
                else:
                    u = (x - x0) / float(x1 - x0)
                    c = ST[2] if u < .5 else ST[1]
                    if (y - yfront) % 4 == 3: c = ST[0]
                    if (x - x0) % 12 == 11: c = ST[0]
                    if y == yfront: c = ST[4]
                px(p, W, H, x, y, c)
    tier(0, 64, 38, 41, 47); tier(6, 58, 30, 34, 40); tier(13, 51, 22, 27, 32)
    for a in range(0, 360, 4):
        x = int(32 + 13 * math.cos(math.radians(a))); y = int(24.5 + 2.2 * math.sin(math.radians(a)))
        px(p, W, H, x, y, RD[4] if a % 40 else SR[5])
    for x, y in ((32, 23), (32, 24), (31, 24), (33, 24), (32, 25)): px(p, W, H, x, y, SR[5])
    return fin(im)
