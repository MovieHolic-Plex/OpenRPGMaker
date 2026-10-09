# 산중 무림 문파 — 건물·구조물(앵커). 톤 캔버스(TC) 위에 재질 + 톤으로 칠한 뒤 pz.fin 윤곽. 3/4 시점(윗면 + 앞면), 빛 왼쪽 위.
# 장르 규격(genres/wuxia.md): 지붕 = KAWARA 회청 기와(처마 끝 위로 들림 sori 5~7 · 양 끝 치미 작은 꼬리), 기둥·난간·문 = SHU 주칠,
# 벽 = 버들항 회벽, 기단·계단·난간 = 버들항 돌(stone), 편액 = INK 바탕 + GOLD 테(글자 없음), 금은 용마루 끝 점만.
# eastern-castle(일본 성)의 천수각·도리이·흙벽 어휘는 쓰지 않는다 — 여기는 중국식 산문(三門)·대전(重檐)·종각·장경각·정자·석탑·잔도.
import math
import numpy as np
from PIL import Image
from ws_base import *
from ws_base import _hash


# ================================================================ 공용 도우미
def pillar(tc, x, y0, y1, w=4, base=True):
    """붉은 칠 둥근 기둥(왼쪽 빛 → 오른쪽 그늘 원통 음영), 위 끝 두 줄 짙은 그늘(처마 밑), 밑 돌 주춧돌(2px, 기둥보다 2px 넓다)."""
    ks = {3: (5, 4, 2), 4: (6, 5, 3, 2), 5: (6, 5, 4, 3, 2)}[w]
    for y in range(int(y0), int(y1)):
        for i in range(w):
            k = ks[i]
            if y < y0 + 2: k = max(1, k - 2)
            tc.px(x + i, y, 'shu', k)
    if base:
        for i in range(-1, w + 1):
            tc.px(x + i, y1, 'stone', 6 if i < w // 2 else 4); tc.px(x + i, y1 + 1, 'stone', 3)


def lattice_door(tc, x0, y0, w, h, open_=False):
    """격자문(꽃살문 간략형): 붉은 칠 테 2px + 안쪽 나무 살 마름모 격자(3px 간격) + 창호지(washi). open_ = 가운데 두 짝이 열려 속 어둠."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            lx, ly = x - x0, y - y0
            if lx < 1 or ly < 1 or lx >= w - 1 or ly >= h - 1:
                tc.px(x, y, 'shu', 5 if (lx < 1 or ly < 1) else 2); continue
            if open_: tc.px(x, y, 'dark', 2 if ly > 2 else 1); continue
            if ly >= h - 5:                                                  # 아래 궁창판(나무 판)
                tc.px(x, y, 'shu', 3 if ly == h - 5 else 4); continue
            if (lx + ly) % 4 == 0 or (lx - ly) % 4 == 0: tc.px(x, y, 'shu', 3)
            else: tc.px(x, y, 'washi', 5 if ly < h // 2 else 4)


def plaque(tc, cx, y0, w=14, h=6):
    """편액(글자 없음): 먹빛 판 + 금 테 1px + 가운데 짙은 띠(글자 자리는 비운다)."""
    x0 = int(cx - w / 2)
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            edge = x in (x0, x0 + w - 1) or y in (y0, y0 + h - 1)
            tc.px(x, y, 'gold' if edge else 'ink', (5 if (x == x0 or y == y0) else 3) if edge else (2 if y in (y0 + 2, y0 + 3) else 3))


def platform(tc, x0, x1, y0, y1, stair=None, mat='stone', rail=True):
    """돌 기단(앞면 + 윗면 끝): 윗면 끝 2px 빛 갓돌, 앞면 = 큰 마름돌 줄쌓기(12x5, 엇갈림), 오른쪽 2px 그늘, 맨 아래 1px 어둠.
    stair = (sx0, sx1): 가운데 돌계단 자리(단마다 윗면 빛 · 챌면 그늘, 양옆 소맷돌). rail = 기단 위 낮은 돌 난간 줄."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            ly = y - y0; lx = x - x0
            if ly < 2: tc.px(x, y, mat, 6 if ly == 0 else 5); continue
            row = (ly - 2) // 5; rl = (ly - 2) % 5
            off = (row % 2) * 6; cl = (lx + off) % 12
            k = 4 + (1 if _hash((lx + off) // 12, row, 5) > .7 else 0) - (1 if _hash((lx + off) // 12, row, 6) < .15 else 0)
            if rl == 4 or cl == 11: k = 2
            elif rl == 0 or cl == 0: k += 1
            if x >= x1 - 2: k -= 1
            if y == y1 - 1: k = 1
            tc.px(x, y, mat, clamp(k, 1, 6))
    if stair:
        sx0, sx1 = stair
        nst = max(1, (y1 - y0) // 4)
        for x in range(sx0 - 2, sx1 + 2):                                     # 소맷돌(양옆 경사 돌)
            for y in range(y0 - 2, y1):
                if x < sx0 or x >= sx1:
                    side = x < sx0
                    tc.px(x, y, mat, (5 if side else 3) if y > y0 - 2 else 6)
        for x in range(sx0, sx1):
            for y in range(y0, y1):
                s = (y - y0) % 4
                tc.px(x, y, mat, 6 if s == 0 else (5 if s == 1 else (3 if s == 2 else 2)))
    if rail:
        for x in range(x0 + 1, x1 - 1):
            if stair and stair[0] - 2 <= x < stair[1] + 2: continue
            post = (x - x0) % 10 in (0, 1)
            top = y0 - (5 if post else 3)
            for y in range(top, y0):
                k = 6 if y == top else (5 if x % 10 == 0 else 4)
                if not post and y > top + 1 and (x - x0) % 10 in (4, 5, 6): k = 3          # 난간 판 구멍(그늘)
                tc.px(x, y, mat, k)


def eave_shadow(tc, x0, x1, y, rows=3):
    for x in range(x0, x1):
        for j in range(rows): tc.px(x, y + j, 'dark', 2 if j == 0 else 3)


# ================================================================ ① 대전(大殿, 이중 처마)
def main_hall(seed=1):
    """대전 10x7칸(160x112): 3단 돌 기단(가운데 계단 + 난간) 위에 붉은 기둥 여섯 + 격자문 다섯(가운데 열림),
    아래 처마(차양 지붕) + 위 팔작지붕(처마 끝 위로 크게 들림, 양 끝 치미, 용마루 금 점), 처마 사이 회벽 띠·편액."""
    W, H = 160, 112
    tc = TC(W, H, seed)
    pb = H - 18                                                                   # 기단 위
    platform(tc, 4, W - 4, pb, H, stair=(68, 92))
    # 벽·기둥
    wt = pb - 30
    for y in range(wt, pb):
        for x in range(14, W - 14): tc.px(x, y, 'dark', 2 if y < wt + 3 else 3)
    xs = [16 + i * 25 for i in range(6)]
    for i in range(5):
        lattice_door(tc, xs[i] + 5, wt + 4, 20, pb - wt - 4, open_=(i == 2))
    for px_ in xs: pillar(tc, px_, wt, pb - 2, w=5)
    # 아래 처마(차양) — 앞쪽으로 내민 짧은 기와 띠
    jroof(tc, 6, wt - 14, W - 12, 16, kind='hip', yb=.15, e=12, sori=4, flare=3, ridge=False, oni=False)
    # 처마 사이 회벽 띠 + 편액
    for y in range(wt - 26, wt - 13):
        for x in range(24, W - 24):
            k = 5 if y > wt - 24 else 3
            if x >= W - 26: k -= 1
            tc.px(x, y, 'plaster', k)
    for x in range(24, W - 24, 12):
        for y in range(wt - 26, wt - 13): tc.px(x, y, 'shu', 3)
    plaque(tc, W // 2, wt - 24, 22, 8)
    # 위 팔작지붕
    jroof(tc, 12, 0, W - 24, wt - 22, kind='hip', yb=.40, e=30, sori=7, flare=4, ridge=True, oni=True, gold=False)
    for x in (W // 2 - 1, W // 2):                                                 # 용마루 가운데 금 보주
        for y in range(int((wt - 22) * .40) - 6, int((wt - 22) * .40) - 2): tc.px(x, y, 'gold', 5 if x < W // 2 else 3)
    tc.grain(.02, mats=('stone', 'plaster'))
    return tc.fin(.6)


# ================================================================ ② 산문(山門)
def sanmen(seed=2):
    """산문 7x6칸(112x96): 세 칸 문(가운데 높은 지붕 + 양옆 낮은 지붕), 붉은 기둥 넷, 가운데 문길 3칸 폭(안으로 열린 붉은 문짝 + 속 어둠),
    양옆 칸은 회벽 + 둥근 창(먹빛 살), 낮은 돌 기단 + 문길 앞 계단. 가운데 편액(글자 없음)."""
    W, H = 112, 96
    tc = TC(W, H, seed)
    pb = H - 8
    platform(tc, 2, W - 2, pb, H, stair=(34, 78), rail=False)
    wt = pb - 34
    for (x0, x1) in ((8, 30), (82, 104)):
        plaster_wall(tc, x0, wt + 10, x1, pb, seed=x0, posts=0, beam=True)
        cx, cy = (x0 + x1) / 2, wt + 22
        for y in range(int(cy - 7), int(cy + 8)):
            for x in range(int(cx - 7), int(cx + 8)):
                d = math.hypot(x + .5 - cx, y + .5 - cy)
                if d <= 6.5:
                    if d > 5.4: tc.px(x, y, 'shu', 5 if x < cx else 2)
                    else: tc.px(x, y, 'ink' if (x + y) % 3 else 'shu', 2 if (x + y) % 3 else 4)
    for y in range(wt, pb):
        for x in range(30, 82):
            if x < 34: tc.px(x, y, 'shu', 4 if x < 32 else 3)
            elif x >= 78: tc.px(x, y, 'shu', 3 if x < 80 else 2)
            else: tc.px(x, y, 'dark', 1 if y < wt + 6 else 2)
    for x in range(34, 78):
        tc.px(x, pb - 2, 'wood', 5); tc.px(x, pb - 1, 'wood', 2)
    for px_ in (4, 28, 80, 104): pillar(tc, px_, wt - 2, pb - 2, w=4)
    jroof(tc, 0, wt - 14, 34, 18, kind='hip', yb=.38, e=12, sori=4, flare=3, ends='L', ridge=True, oni=True)
    jroof(tc, W - 34, wt - 14, 34, 18, kind='hip', yb=.38, e=12, sori=4, flare=3, ends='R', ridge=True, oni=True)
    for y in range(wt - 16, wt):
        for x in range(26, 86): tc.px(x, y, 'shu' if y > wt - 4 else 'dark', 3 if y > wt - 4 else 2)
    plaque(tc, W // 2, wt - 13, 20, 8)
    jroof(tc, 18, 0, 76, wt - 14, kind='hip', yb=.42, e=22, sori=7, flare=4, ridge=True, oni=True)
    return tc.fin(.6)


# ================================================================ ③ 종각(鐘閣)
def bell(tc, cx, y0, h=20, w=14):
    """청동 범종: 위 고리(용뉴) + 종 몸(아래로 넓어지는 곡선, 왼 빛 → 오른 그늘), 띠 둘, 당좌(둥근 무늬), 아래 입 테."""
    for j in range(3): tc.px(cx - 1 + j, y0, 'bronze', 4); tc.px(cx - 1, y0 + 1, 'bronze', 5); tc.px(cx + 1, y0 + 1, 'bronze', 3)
    for y in range(y0 + 2, y0 + h):
        f = (y - y0 - 2) / max(1, h - 3)
        hw = w / 2.0 * (.62 + .38 * f ** 1.6)
        for x in range(int(cx - hw), int(cx + hw) + 1):
            u = (x + .5 - (cx - hw)) / (2 * hw)
            k = 6 if u < .18 else (5 if u < .4 else (4 if u < .65 else (3 if u < .85 else 2)))
            if y in (y0 + 5, y0 + h - 5): k = max(1, k - 2)
            if y == y0 + h - 1: k = 2
            tc.px(x, y, 'bronze', k)
    tc.px(cx - 2, y0 + h - 8, 'bronze', 6); tc.px(cx - 1, y0 + h - 8, 'bronze', 5); tc.px(cx - 2, y0 + h - 7, 'bronze', 5)


def bell_pavilion(seed=3):
    """종각 5x6칸(80x96): 돌 기단 + 네 귀 붉은 기둥(앞 둘 보이고 뒤 둘은 어두운 속에 가늘게) 사이에 범종이 들보에 매달림,
    당목(종 치는 통나무)이 줄에 걸려 있다. 위 모임 팔작지붕(처마 끝 들림, 꼭대기 금 보주)."""
    W, H = 80, 96
    tc = TC(W, H, seed)
    pb = H - 10
    platform(tc, 4, W - 4, pb, H, stair=(30, 50), rail=False)
    wt = pb - 40
    for y in range(wt, pb - 1):                                                     # 속 어둠(뒤 벽 없음 — 기둥 사이로 너머가 어둡다)
        for x in range(14, W - 14): tc.px(x, y, 'dark', 3 if y > pb - 8 else 2)
    for px_ in (20, W - 23): pillar(tc, px_, wt, pb - 2, w=3, base=False)          # 뒤 기둥(가늘고 어둡게)
    for y in range(wt + 2, wt + 5):                                                  # 들보
        for x in range(12, W - 12): tc.px(x, y, 'shu', 4 if y == wt + 2 else 2)
    for y in range(wt + 5, wt + 9): tc.px(W // 2, y, 'kuro', 3)
    bell(tc, W // 2, wt + 9, h=24, w=18)
    for x in range(W // 2 + 10, W - 14):                                             # 당목
        tc.px(x, wt + 22, 'wood', 5); tc.px(x, wt + 23, 'wood', 4); tc.px(x, wt + 24, 'wood', 2)
    for (x, y0) in ((W // 2 + 12, wt + 5), (W - 16, wt + 5)):
        for y in range(y0, wt + 22): tc.px(x, y, 'washi', 3)
    for px_ in (8, W - 13): pillar(tc, px_, wt - 2, pb - 2, w=5)
    jroof(tc, 0, 2, W, wt + 4 - 2, kind='hip', yb=.30, e=34, sori=6, flare=4, ridge=True, oni=True)
    for y in range(0, 6): tc.px(W // 2, y, 'gold', 6 - y // 2); tc.px(W // 2 - 1, y + 1, 'gold', 4)
    return tc.fin(.6)


# ================================================================ ④ 수련생 숙소(요사채)
def dormitory(w=7, seed=4, door=3):
    """숙소 w칸 x 5줄: 회벽 + 붉은 기둥 칸막이, 격자창 줄, 붉은 격자문 하나(열림), 낮은 툇마루, 맞배지붕(양 끝 박공 널 · 처마 끝 들림)."""
    W, H = w * 16, 72
    tc = TC(W, H, seed)
    pb = H - 4
    for x in range(2, W - 2):                                                        # 툇마루 + 받침돌
        tc.px(x, pb - 3, 'wood', 6); tc.px(x, pb - 2, 'wood', 4)
        for y in range(pb - 1, H): tc.px(x, y, 'stone', 3 if y < H - 1 else 1)
    wt = pb - 32
    plaster_wall(tc, 6, wt, W - 6, pb - 3, seed=seed, posts=0, beam=True)
    cols = list(range(6, W - 6, 16)) + [W - 10]
    for px_ in cols: pillar(tc, px_, wt, pb - 4, w=4, base=False)
    dx = door * 16 + 4
    lattice_door(tc, dx, wt + 8, 16 - 2, pb - 3 - wt - 8, open_=True)
    for c in range(len(cols) - 1):
        x0 = cols[c] + 6
        if abs(x0 - dx) < 10: continue
        if x0 + 8 > W - 10: continue
        lattice_window(tc, x0, wt + 10, 8, 8, kind='bars')
    jroof(tc, 0, 2, W, wt + 6 - 2, kind='gable', yb=.40, sori=5, flare=3, ridge=True, oni=True)
    return tc.fin(.6)


# ================================================================ ⑤ 폭포 옆 정자(亭子)
def pavilion(seed=5):
    """육모정 느낌의 정자 4x5칸(64x80): 낮은 돌 기단 + 기둥 넷(앞 둘 · 뒤 둘), 기둥 사이 낮은 붉은 난간(앉는 턱),
    속 마루(나무), 뾰족한 모임지붕(처마 끝 크게 들림) + 금 보주 꼭지."""
    W, H = 64, 96
    tc = TC(W, H, seed)
    pb = H - 6
    platform(tc, 3, W - 3, pb, H, rail=False)
    wt = pb - 30
    for y in range(wt + 4, pb):                                                       # 마루 + 속
        for x in range(10, W - 10):
            tc.px(x, y, 'wood' if y > pb - 10 else 'dark', (4 if (y % 3) else 3) if y > pb - 10 else 2)
    for px_ in (16, W - 19): pillar(tc, px_, wt + 2, pb - 10, w=3, base=False)
    for y in range(pb - 10, pb - 4):                                                  # 앞 낮은 난간
        for x in range(10, W - 10):
            k = 5 if y == pb - 10 else (4 if (x % 6) in (0, 1) else 2)
            tc.px(x, y, 'shu', k)
    for px_ in (6, W - 11): pillar(tc, px_, wt, pb - 2, w=5)
    jroof(tc, 0, 8, W, wt + 6 - 8, kind='hip', yb=.04, e=32, sori=7, flare=4, ridge=False, oni=False)
    for y in range(0, 10): tc.px(W // 2, y, 'gold', 6 if y < 3 else 4); tc.px(W // 2 - 1, y + 2, 'gold', 5)
    return tc.fin(.6)


# ================================================================ ⑥ 장경각(藏經閣, 2층 누각)
def scripture_tower(seed=6):
    """장경각 6x8칸(96x128): 돌 기단 → 1층(회벽 + 붉은 기둥 + 격자문) → 1층 처마 → 2층 난간 회랑(붉은 난간) + 격자창 →
    위 팔작지붕. 서책을 보관하는 높은 누각(글자 없음)."""
    W, H = 96, 128
    tc = TC(W, H, seed)
    pb = H - 8
    platform(tc, 4, W - 4, pb, H, stair=(36, 60), rail=False)
    w1 = pb - 30
    plaster_wall(tc, 12, w1, W - 12, pb - 1, seed=seed, posts=0, beam=False)
    lattice_door(tc, 38, w1 + 6, 20, pb - 1 - w1 - 6)
    for (x0) in (18, 66): lattice_window(tc, x0, w1 + 8, 10, 10)
    for px_ in (10, 32, 60, W - 14): pillar(tc, px_, w1, pb - 2, w=4)
    jroof(tc, 4, w1 - 12, W - 8, 14, kind='hip', yb=.12, e=10, sori=4, flare=3, ridge=False, oni=False)
    w2t = w1 - 40
    plaster_wall(tc, 18, w2t, W - 18, w1 - 12, seed=seed + 1, posts=0, beam=False)
    for (x0) in (24, 44, 64): lattice_window(tc, x0, w2t + 6, 8, 12)
    for y in range(w1 - 20, w1 - 12):                                                  # 2층 회랑 난간
        for x in range(12, W - 12):
            k = 6 if y == w1 - 20 else (5 if (x % 8) in (0, 1) else (3 if y < w1 - 14 else 2))
            tc.px(x, y, 'shu', k)
    for px_ in (16, W - 20): pillar(tc, px_, w2t, w1 - 20, w=4, base=False)
    jroof(tc, 6, 0, W - 12, w2t + 6, kind='hip', yb=.40, e=24, sori=6, flare=4, ridge=True, oni=True)
    return tc.fin(.6)


# ================================================================ ⑦ 석탑(石塔)
def stone_pagoda(seed=7, tiers=5):
    """회색 화강암 다층 석탑 2x5칸(32x80): 두 단 기단 → 몸돌(작은 감실 어둠) + 얇은 옥개석(끝이 살짝 들림) 을 tiers 번 줄여 쌓고 꼭대기 상륜."""
    W, H = 32, 80
    tc = TC(W, H, seed)
    y = H - 1
    for (hw, hh) in ((14, 5), (11, 4)):                                                # 기단
        for yy in range(y - hh + 1, y + 1):
            for x in range(16 - hw, 16 + hw):
                k = 6 if yy == y - hh + 1 else (4 if x < 16 + hw - 2 else 3)
                if yy == y: k = 2
                tc.px(x, yy, 'gran', k)
        y -= hh
    for t in range(tiers):
        bw = 7 - t * .9; bh = 6 - t * .6
        for yy in range(int(y - bh) + 1, y + 1):                                       # 몸돌
            for x in range(int(16 - bw), int(16 + bw)):
                k = 5 if x < 14 else (4 if x < 16 + bw - 2 else 3)
                tc.px(x, yy, 'gran', k)
        if t < 2:
            for yy in range(int(y - bh) + 2, y): tc.px(15, yy, 'dark', 2); tc.px(16, yy, 'dark', 2)
        y = int(y - bh)
        rw = bw + 5 - t * .4
        for j in range(3):                                                               # 옥개석
            for x in range(int(16 - rw), int(16 + rw) + 1):
                u = abs(x + .5 - 16) / rw
                lift = 1 if u > .85 and j == 2 else 0
                k = (6, 5, 2)[j]
                if x > 16 + rw * .5 and j < 2: k -= 1
                tc.px(x, y - j - lift + (1 if j == 2 else 0) - 1, 'gran', k)
        y -= 3
        if _hash(t, 1, seed) < .5:
            for x in range(int(16 - rw) + 1, int(16 - rw) + 4): tc.px(x, y + 1, 'koke', 4)
    for yy in range(y - 9, y + 1):                                                       # 상륜
        tc.px(15, yy, 'gran', 5); tc.px(16, yy, 'gran', 3)
        if (yy - y) % 3 == 0: tc.px(14, yy, 'gran', 5); tc.px(17, yy, 'gran', 3)
    return shadow_under(tc.fin(.6), 16, H - 2, 13, 2, 55)


# ================================================================ ⑧ 비무대(比武臺)
def sparring_stage(w=6, seed=14):
    """비무대 w x 3칸: 무릎 높이 돌 단(윗면 = 큰 판석 · 앞면 = 마름돌 줄쌓기, 가운데 앞 계단), 네 귀 붉은 칠 낮은 기둥 + 금 꼭지,
    윗면 가운데 먹빛 원(겨루기 금, 글자 없음)."""
    W, H = w * 16, 48
    tc = TC(W, H, seed)
    top0, top1 = 6, 34
    for y in range(top0, top1):                                                  # 윗면 판석
        for x in range(2, W - 2):
            lx = (x - 2) % 16; ly = (y - top0) % 14
            k = 5 if _hash((x - 2) // 16, (y - top0) // 14, seed) > .4 else 4
            if lx == 15 or ly == 13: k = 3
            elif lx == 0 or ly == 0: k = 6
            tc.px(x, y, 'stone', k)
    cx, cy = W / 2.0, (top0 + top1) / 2.0
    for y in range(top0, top1):
        for x in range(2, W - 2):
            d = math.hypot((x + .5 - cx) / 1.0, (y + .5 - cy) * 1.7)
            if 9.5 < d < 11.0: tc.px(x, y, 'ink', 3)
    platform(tc, 2, W - 2, top1, H, stair=(int(cx) - 8, int(cx) + 8), rail=False)
    for (px_, py_) in ((3, top0 - 2), (W - 7, top0 - 2), (3, top1 - 8), (W - 7, top1 - 8)):
        for y in range(py_, py_ + 9):
            for i in range(4): tc.px(px_ + i, y, 'shu', (6, 5, 3, 2)[i])
        tc.px(px_ + 1, py_ - 1, 'gold', 6); tc.px(px_ + 2, py_ - 1, 'gold', 4)
    return tc.fin(.6)


if __name__ == '__main__':
    import os
    os.makedirs(os.path.join(HERE, '_qa'), exist_ok=True)
    ims = [main_hall(), sanmen(), bell_pavilion(), dormitory(), pavilion(), scripture_tower(), stone_pagoda(), sparring_stage()]
    W = sum(i.width for i in ims) + 16 * (len(ims) + 1); H = max(i.height for i in ims) + 32
    o = Image.new('RGBA', (W, H), (70, 120, 60, 255)); x = 16
    for im in ims: o.alpha_composite(im, (x, H - 16 - im.height)); x += im.width + 16
    o.resize((W * 3, H * 3), Image.NEAREST).save(os.path.join(HERE, '_qa', 'build.png')); print('ok')
