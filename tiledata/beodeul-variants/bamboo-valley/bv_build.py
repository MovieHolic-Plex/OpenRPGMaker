# 대나무 숲 계곡 — 건물·구조물(앵커): 은자의 초가, 헛간, 죽림 정자, 돌 아치 다리, 죽교, 작은 폭포, 사립문.
# 지붕 = ek_build.thatch_roof(초가, 칩셋 thatch 램프) / ek_base.jroof(회청 기와 KAWARA, 처마 끝 들림). 기둥 = SHU 주칠, 석재 = 버들항 돌.
import math
import numpy as np
from bv_base import *
from bv_base import _hash
import ek_build as B


def _sh(im, cx, cy, rx, ry, a=60): return shadow_under(im, cx, cy, rx, ry, a)


def _stone_face(tc, x0, y0, x1, y1, seed=0, base=4, hw=12, hh=7):
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            k = ishigaki_k(x - x0, y - y0, seed, base, hw=hw, hh=hh)
            if x >= x1 - 2: k -= 1
            tc.px(x, y, 'stone', clamp(k, 1, 6))


# ================================================================ 은자의 초가
def hermit_hut(seed=1):
    """은자의 초가 5x5칸: 두툼한 초가 지붕(짚 결 + 대 누름 막대) · 막돌 기단 · 왼쪽 = 세로 대나무 벽, 가운데 = 널문(반쯤 열림),
    오른쪽 = 흰 흙벽에 둥근 달 창(대 살 격자) · 나무 기둥 · 문 양옆 낮은 대 난간 툇마루. 아래 2줄 막힘, 문 칸 걷기."""
    W, H = 80, 80
    tc = TC(W, H, seed)
    wt, wb = 46, H - 5
    for y in range(wb, H):                                                   # 막돌 기단
        for x in range(2, W - 2):
            k = ishigaki_k(x, y, seed + 3, 4, hw=10, hh=4)
            if y == wb: k = 5
            if x >= W - 4: k -= 1
            tc.px(x, y, 'stone', clamp(k, 1, 6))
    for y in range(wt, wb):
        for x in range(4, W - 4):
            if x < 30:                                                       # 세로 대나무 벽
                lx = (x - 4) % 3
                k = (5, 4, 2)[lx] - (1 if y < wt + 3 else 0)
                if (y + (x // 3) * 4) % 10 == 0: k = 2
                tc.px(x, y, 'take', clamp(k, 1, 6))
            else:                                                            # 흰 흙벽
                k = 5 if x < W - 7 else 4
                if y < wt + 3: k = 3
                if _hash(x, y, seed + 4) < .05: k -= 1
                if y > wb - 6: k = 3 if _hash(x, y, seed + 5) < .5 else 4
                tc.px(x, y, 'plaster', k)
    for px_ in (4, 29, 46, W - 6):                                           # 기둥
        for y in range(wt - 2, wb): tc.px(px_, y, 'wood', 5); tc.px(px_ + 1, y, 'wood', 2)
    for x in range(4, W - 4): tc.px(x, wt + 1, 'wood', 4); tc.px(x, wt + 2, 'wood', 2)   # 인방
    for y in range(wt + 6, wb):                                              # 널문(반쯤 열림)
        for x in range(32, 45):
            if x < 38: k = 4 if (x - 32) % 3 else 2; tc.px(x, y, 'wood', k if y > wt + 6 else 5)
            else: tc.px(x, y, 'dark', 2 if y < wt + 12 else 1)
    tc.px(36, wt + 16, 'kuro', 4)
    cx, cy, r = 61, wt + 12, 7.5                                             # 둥근 달 창
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            d = math.hypot(x + .5 - cx, y + .5 - cy)
            if d <= r - 1:
                if (x - int(cx)) % 3 == 0 or (y - int(cy)) % 3 == 0: tc.px(x, y, 'take', 4)
                else: tc.px(x, y, 'dark', 2)
            elif d <= r + .6: tc.px(x, y, 'wood', 5 if (x < cx and y < cy) else 2)
    for (x0, x1) in ((6, 28), (48, W - 8)):                                  # 툇마루 대 난간
        for x in range(x0, x1):
            tc.px(x, wb - 7, 'take', 6); tc.px(x, wb - 6, 'take', 3)
            tc.px(x, wb - 1, 'wood', 5); tc.px(x, wb, 'wood', 3)
        for x in range(x0, x1, 7):
            for y in range(wb - 7, wb): tc.px(x, y, 'take', 4); tc.px(x + 1, y, 'take', 2)
    for x in range(10, 26, 3): tc.px(x, wb - 9, 'kare', 4)                    # 대 벽에 기댄 마른 대 줄
    B.thatch_roof(tc, 0, wt + 8 - 50, W, 50, seed=seed + 5, yb=.46)
    return _sh(tc.fin(.6), W // 2, H - 2, W // 2 - 2, 3, 60)


def hut_shed(seed=2):
    """초가 헛간 3x4칸: 외쪽 초가 지붕 + 대 기둥 셋 + 앞이 트인 속(어둠)에 쌓은 장작·대 다발. 아래 2줄 막힘."""
    W, H = 48, 64
    tc = TC(W, H, seed)
    wt, wb = 32, H - 3
    for y in range(wt, wb):
        for x in range(4, W - 4):
            tc.px(x, y, 'dark', 2 if y < wt + 6 else 1)
    for row in range(3):                                                     # 장작 마구리
        for i in range(5):
            cx = 9 + i * 6 + (3 if row % 2 else 0); cy = wb - 3 - row * 5
            if cx > W - 8: continue
            tc.ell(cx, cy, 2.6, 2.3, 'wood', lambda X, Y: 5 if X < cx else 3); tc.px(cx, cy, 'wood', 6)
    for x in range(6, W - 6):
        for y in range(wt + 4, wt + 9): tc.px(x, y, 'take', 4 if (x % 3) else 2)
    for px_ in (4, 22, W - 6):
        for y in range(wt - 2, wb): tc.px(px_, y, 'take', 5); tc.px(px_ + 1, y, 'take', 2)
    for x in range(2, W - 2): tc.px(x, wb, 'stone', 4); tc.px(x, wb + 1, 'stone', 3); tc.px(x, wb + 2, 'stone', 2)
    B.thatch_roof(tc, 0, wt + 6 - 36, W, 36, seed=seed + 5, yb=.3, ends=False)
    return _sh(tc.fin(.6), W // 2, H - 2, W // 2 - 2, 3, 60)


# ================================================================ 죽림 정자
def pavilion(seed=3):
    """죽림 정자 5x6칸: 막돌 기단(윗면 판석 + 앞면 막돌, 가운데 돌계단 셋) · 주칠 기둥 넷(앞 둘은 온전히, 뒤 둘은 지붕 밑으로) ·
    짙은 나무 낮은 난간(계단 자리 트임) · 마루 널 · 처마 끝이 들린 회청 기와 모임지붕(용마루 짧게, 양끝 작은 치미). 기단 아래 2줄 막힘, 계단 칸 걷기."""
    W, H = 80, 96
    tc = TC(W, H, seed)
    pt, pf, pb = 62, 72, H - 1                                               # 기단 윗면 시작 · 앞면 시작 · 밑
    for y in range(pt, pf):                                                  # 기단 윗면(판석 + 마루)
        for x in range(4, W - 4):
            if 10 <= x < W - 10 and y < pf - 3:
                ly = (y - pt) % 3; k = 5 if ly == 0 else (4 if ly == 1 else 3)
                if (x + (y // 3) * 7) % 19 == 0: k = 2
                tc.px(x, y, 'wood', k)
            else:
                k = ishigaki_k(x, y, seed + 2, 5, hw=14, hh=6)
                tc.px(x, y, 'stone', clamp(k + (1 if y == pt else 0), 1, 6))
    _stone_face(tc, 4, pf, W - 4, pb, seed + 4)
    for x in range(4, W - 4): tc.px(x, pf, 'stone', 6); tc.px(x, pb, 'stone', 1)
    for j in range(3):                                                       # 가운데 돌계단
        y0 = pf + j * 8
        for y in range(y0, min(pb + 1, y0 + 8)):
            for x in range(30 - j, 50 + j):
                ly = y - y0
                k = (6 if ly == 0 else 5) if ly < 5 else (2 if ly < 7 else 1)
                if x >= 47 + j and k > 2: k -= 1
                tc.px(x, y, 'stone', k)
    cols = [(14, 'back'), (W - 16, 'back'), (8, 'front'), (W - 10, 'front')]
    for (cx, kind) in cols:                                                  # 주칠 기둥 + 주춧돌
        top = 30
        bot = pt + 2 if kind == 'back' else pf - 1
        for y in range(top, bot):
            for i in range(3): tc.px(cx + i, y, 'shu', (5, 4, 2)[i] - (1 if kind == 'back' else 0))
            if y == top + 1: tc.px(cx, y, 'shu', 6)
        for i in range(-1, 4): tc.px(cx + i, bot, 'stone', 5); tc.px(cx + i, bot + 1, 'stone', 3)
    for (x0, x1) in ((11, 30), (50, W - 10)):                                # 앞 낮은 난간
        for x in range(x0, x1):
            tc.px(x, pf - 9, 'wood', 5); tc.px(x, pf - 8, 'wood', 2)
            tc.px(x, pf - 4, 'wood', 4); tc.px(x, pf - 3, 'wood', 2)
        for x in range(x0 + 2, x1, 5):
            for y in range(pf - 9, pf - 2): tc.px(x, y, 'wood', 3)
    for x in range(14, W - 14): tc.px(x, 40, 'wood', 3); tc.px(x, 41, 'wood', 1)   # 뒤 인방
    jroof(tc, 2, 0, W - 4, 40, kind='hip', yb=.40, sori=4, flare=2, ridge=True, oni=True, mat='kawara')
    for x in range(4, W - 4):                                                # 처마 밑 그늘 + 서까래 끝
        tc.px(x, 40, 'dark', 1)
        if x % 4 == 0: tc.px(x, 41, 'wood', 4)
    for (ex) in (6, W - 7):                                                  # 처마 끝 금 점(작게)
        tc.px(ex, 36, 'gold', 5)
    return _sh(tc.fin(.6), W // 2, H - 2, W // 2 - 2, 3, 60)


# ================================================================ 다리
def stone_bridge(w=6, seed=4):
    """돌 아치 다리(동서) w x 3칸: 가운데 줄 = 판석 다리 바닥(걷기), 위 줄 = 북쪽 돌 난간(갓돌 + 난간 기둥 머리),
    아래 줄 = 남쪽 돌 난간 + 반원 아치 앞면(쐐기돌 테, 아치 속 어둠과 물 비침). 양 끝 난간 기둥이 둑에 닿는다."""
    W, H = w * 16, 48
    tc = TC(W, H, seed)
    for y in range(12, 31):                                                  # 바닥 판석
        for x in range(0, W):
            k = ishigaki_k(x, y - 12, seed + 1, 5, hw=16, hh=9)
            if y == 12: k = 3
            tc.px(x, y, 'stone', clamp(k, 1, 6))
    def rail(y0, front):
        for x in range(2, W - 2):
            for y in range(y0, y0 + 6):
                ly = y - y0
                k = 6 if ly == 0 else (5 if ly == 1 else (4 if ly < 4 else (3 if front else 2)))
                if x % 16 in (0, 1) and ly > 1: k = 2
                tc.px(x, y, 'stone', k)
        for x in list(range(2, W - 2, 16)) + [W - 6]:                       # 난간 기둥 머리
            for y in range(y0 - 3, y0 + 1):
                for i in range(4): tc.px(x + i, y, 'stone', (6, 5, 4, 2)[i] if y > y0 - 3 else 5)
    rail(4, False)
    for y in range(31, H):                                                   # 아치 앞면
        for x in range(0, W):
            u = (x + .5 - W / 2) / (W / 2 - 10); v = (y + .5 - H) / 15.0
            dd = u * u + v * v
            if dd < 1:
                tc.px(x, y, 'dark' if dd < .8 else 'sei', 1 if dd < .55 else 2)
                if dd < .55 and y > H - 4 and (x + y) % 3 == 0: tc.px(x, y, 'mizu', 4)
            elif dd < 1.45:                                                  # 쐐기돌 테
                ang = math.atan2(v, u * 1.2)
                seg = int((ang + math.pi) / (math.pi / 9))
                k = 5 if seg % 2 else 4
                if abs((ang + math.pi) % (math.pi / 9)) < .06: k = 1
                if dd > 1.35: k = 2
                tc.px(x, y, 'stone', k)
            else:
                k = ishigaki_k(x, y, seed + 6, 4, hw=12, hh=6)
                if x >= W - 3: k -= 1
                tc.px(x, y, 'stone', clamp(k, 1, 6))
    rail(28, True)
    return _sh(tc.fin(.6), W // 2, H - 2, W // 2 - 4, 2, 50)


def bamboo_bridge(w=5, seed=5):
    """죽교(대나무 다리, 동서) w x 2칸: 아랫줄 = 남북으로 놓아 묶은 굵은 대 바닥(2px 대 마디 엇갈림 + 양 끝 새끼 묶음, 걷기),
    윗줄 = 북쪽 대 난간(기둥 + 가로대 둘, 뒤 물이 비친다). 바닥 남쪽 끝 = 대 마구리 줄 + 물 그늘."""
    W, H = w * 16, 32
    tc = TC(W, H, seed)
    for x in range(0, W):                                                    # 바닥 대
        lx = x % 3
        for y in range(16, 29):
            k = (5, 4, 2)[lx]
            if (y + (x // 3) * 5) % 13 == 0: k = 2
            if y == 16: k += 1
            tc.px(x, y, 'take', clamp(k, 1, 6))
        tc.px(x, 29, 'kare' if lx == 0 else 'take', 4 if lx == 0 else 2)       # 마구리
        tc.px(x, 30, 'dark', 1); tc.px(x, 31, 'dark', 1, 120)
    for yy in (18, 26):                                                      # 묶음 가로대(바닥 위)
        for x in range(W): tc.px(x, yy, 'take', 3 if x % 9 else 2)
    for x in range(2, W - 2):                                                # 북쪽 난간
        tc.px(x, 6, 'take', 6); tc.px(x, 7, 'take', 3)
        tc.px(x, 11, 'take', 5); tc.px(x, 12, 'take', 2)
    for x in list(range(3, W - 3, 13)) + [W - 5]:
        for y in range(4, 17): tc.px(x, y, 'take', 5); tc.px(x + 1, y, 'take', 3); tc.px(x + 2, y, 'take', 1)
        tc.px(x, 3, 'kare', 6); tc.px(x + 1, 3, 'kare', 4)
        for dx in range(-1, 4): tc.px(x + dx, 6, 'kare', 4); tc.px(x + dx, 11, 'kare', 4)
    return tc.fin(.6)


# ================================================================ 작은 폭포
def waterfall(seed=6):
    """작은 폭포 4x4칸: 이끼 낀 바위 벼랑(둥근 바위 덩이 앞면 + 윗면 이끼·풀) 가운데로 떨어지는 물줄기(세로 빛 줄, 흰 물살)
    + 밑 물보라(회청 단색 점). 칸 전부 막힘. 밑 줄 바로 남쪽에 개울 물 오토타일 웅덩이를 둔다."""
    W, H = 64, 64
    tc = TC(W, H, seed)
    for y in range(0, H - 4):                                                # 벼랑 바위
        for x in range(0, W):
            k = ishigaki_k(x, y, seed + 1, 4, hw=22, hh=14)
            if x >= W - 3: k -= 1
            if y < 8: k = 5 if _hash(x, y, seed) < .6 else 4
            m = 'stone'
            if y < 9 or (k >= 5 and _hash(x // 2, y // 2, seed + 2) < .45): m = 'koke'; k = clamp(k, 3, 5)
            tc.px(x, y, m, clamp(k, 1, 6))
    for y in range(0, 4):                                                    # 위 풀 테
        for x in range(W):
            if _hash(x, y, seed + 3) < .7 - y * .15: tc.px(x, y, 'leaf', 5 - y)
    x0, x1 = 22, 42
    for y in range(3, H - 6):                                                # 물줄기
        wob = int(round(math.sin(y * .25) * .6))
        for x in range(x0 + wob, x1 + wob):
            lx = x - x0 - wob
            k = 4
            if (lx * 7 + y * 3) % 11 < 3: k = 5
            if (lx + y // 3) % 5 == 0: k = 6
            if lx == 0 or lx == x1 - x0 - 1: k = 3
            tc.px(x, y, 'mizu', k)
    for y in range(H - 10, H):                                               # 물보라
        for x in range(x0 - 8, x1 + 8):
            if _hash(x, y, seed + 4) < .7 - abs(x - 32) / 40:
                tc.px(x, y, 'kasumi', 6 if (x + y) % 2 else 5)
    return tc.fin(.6)


def bamboo_gate(seed=7):
    """사립문 2x2칸: 대 기둥 둘(위 자른 마디) + 안으로 반쯤 열린 대 살문 한 짝 + 위 가로대. 기둥 칸 막힘, 문 칸 걷기."""
    W, H = 32, 32
    tc = TC(W, H, seed)
    for px_ in (2, 27):
        for y in range(2, 31): tc.px(px_, y, 'take', 6); tc.px(px_ + 1, y, 'take', 4); tc.px(px_ + 2, y, 'take', 2)
        tc.px(px_, 1, 'kare', 6); tc.px(px_ + 1, 1, 'kare', 4)
    for x in range(2, 30): tc.px(x, 5, 'take', 5); tc.px(x, 6, 'take', 2)
    for x in range(5, 15):                                                   # 반쯤 연 문짝(안쪽으로 비스듬히)
        for y in range(9 + (x - 5) // 3, 29 - (x - 5) // 4):
            if (x - 5) % 3 == 0 or y % 7 == 0: tc.px(x, y, 'take', 4 if (x - 5) % 3 == 0 else 3)
    return _sh(tc.fin(.6), 16, 30, 13, 2, 45)
