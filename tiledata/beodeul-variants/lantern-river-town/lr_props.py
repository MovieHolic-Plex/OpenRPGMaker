# 등불 수향 마을 — 장터 노점·천막·염색 천 말림대·배·버드나무·소품. 3/4(윗면 + 앞면), 빛 왼쪽 위, 톤 캔버스 + pz.fin 윤곽.
# 잎 결 = 버들항 덤불 그림의 밝기 순위(leaf_tex), 버들잎은 yana 램프. 사람·글자·상표 없음.
import math
import numpy as np
from lr_base import *
from lr_base import _hash
import ek_props as EP


# ================================================================ 천 차양·노점
def awning(tc, x0, y0, w, h, mat='ai', stripes=None, scallop=True):
    """천 차양(위에서 비스듬히 본 경사 천): 위쪽 빛 → 아래 그늘, 세로 주름 줄(4px), 아래 끝 물결 술(scallop).
    stripes = (재질2, 폭) 이면 줄무늬 천."""
    for y in range(y0, y0 + h):
        f = (y - y0) / max(1, h - 1)
        for x in range(x0, x0 + w):
            lx = x - x0
            m = mat
            if stripes and (lx // stripes[1]) % 2 == 1: m = stripes[0]
            k = 5 if f < .3 else (4 if f < .75 else 3)
            if lx % 4 == 3: k -= 1
            if x >= x0 + w - 2: k -= 1
            tc.px(x, y, m, clamp(k, 1, 6))
    if scallop:
        for x in range(x0, x0 + w):
            lx = x - x0; m = mat
            if stripes and (lx // stripes[1]) % 2 == 1: m = stripes[0]
            d = 2 - abs((lx % 6) - 2.5) // 1.3
            for j in range(int(d)): tc.px(x, y0 + h + j, m, 3 if j == 0 else 2)


def counter(tc, x0, y0, w, h=12, top=4):
    """노점 판대: 윗면(나무 빛 top px) + 앞면 널(그늘)."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if y < y0 + top: k = 6 if y == y0 else 5
            else:
                k = 3 + (1 if (x - x0) % 6 == 0 else 0)
                if y == y0 + h - 1: k = 1
            if x >= x0 + w - 2: k -= 1
            tc.px(x, y, 'wood', clamp(k, 1, 6))


def cloth_bolt(tc, x, y, mat, w=6, h=4):
    """눕힌 천 필(둥근 끝이 앞을 본다): 윗면 빛 + 둥근 끝 그늘 원."""
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            k = 5 if yy == y else (4 if yy < y + h - 1 else 2)
            if xx == x + w - 1: k -= 1
            tc.px(xx, yy, mat, k)
    tc.px(x, y + 1, mat, 6); tc.px(x, y + 2, mat, 3)


def cloth_stall(seed=0):
    """포목점 천막 노점 4x3칸: 대나무 기둥 넷 + 쪽빛·찻빛 줄무늬 차양, 판대 위 천 필 더미(쪽빛·주칠·찻빛·흰 무명),
    옆 막대에 걸어 늘어뜨린 천 두 폭. 발자국: 판대 줄(아래 1줄) 막힘, 차양 칸 걷기 + 위층."""
    W, H = 64, 48
    tc = TC(W, H, seed)
    for px_ in (3, W - 6):
        for y in range(6, H - 1): tc.px(px_, y, 'take', 5); tc.px(px_ + 1, y, 'take', 4); tc.px(px_ + 2, y, 'take', 2)
    for x in range(8, W - 8):                                                 # 늘어뜨린 천(뒤 막대)
        pass
    for (x0, mat) in ((10, 'ai'), (46, 'shu')):
        for y in range(14, 34):
            for x in range(x0, x0 + 8):
                k = 4 + (1 if (x - x0) % 3 == 0 else 0) - (1 if y > 30 else 0)
                if mat == 'ai' and (y // 4 + x // 3) % 5 == 0: m, k2 = 'washi', 5          # 쪽빛 천의 흰 무늬 점(홀치기)
                else: m, k2 = mat, k
                tc.px(x, y, m, clamp(k2, 1, 6))
    awning(tc, 0, 2, W, 12, mat='ai', stripes=('cha', 8))
    counter(tc, 6, H - 15, W - 12, 14)
    piles = [('ai', 10, H - 22), ('shu', 17, H - 22), ('cha', 24, H - 22), ('washi', 31, H - 22), ('jade', 38, H - 22), ('ai', 45, H - 22),
             ('cha', 13, H - 26), ('washi', 20, H - 26), ('shu', 27, H - 26), ('ai', 34, H - 26), ('momo', 41, H - 26), ('ai', 22, H - 30), ('shu', 30, H - 30)]
    for (m, x, y) in piles: cloth_bolt(tc, x, y, m, 7, 4)
    return soft(tc.fin(.6), W // 2, H - 2, W // 2 - 4, 2)


def food_stall(seed=1):
    """찐빵·만두 노점 3x3칸: 찻빛 천 차양 + 판대 위 대나무 찜기 석 단(김 두 줄) + 그릇, 앞 나무 의자 하나. 판대 줄만 막힘."""
    W, H = 48, 48
    tc = TC(W, H, seed)
    for px_ in (2, W - 5):
        for y in range(6, H - 1): tc.px(px_, y, 'wood', 5); tc.px(px_ + 1, y, 'wood', 3); tc.px(px_ + 2, y, 'wood', 2)
    awning(tc, 0, 2, W, 11, mat='cha')
    counter(tc, 4, H - 16, W - 8, 15)
    for j in range(3):                                                        # 찜기 석 단
        y = H - 21 - j * 5
        for x in range(9, 25):
            k = 5 if x < 13 else (4 if x < 21 else 3)
            if (x - 9) % 3 == 0: k -= 1
            tc.px(x, y, 'take', k); tc.px(x, y + 1, 'take', k); tc.px(x, y + 2, 'take', k - 1); tc.px(x, y + 3, 'take', 2)
            tc.px(x, y + 4, 'take', 1)
    tc.ell(17, H - 32, 8, 2.2, 'take', lambda X, Y: 6 if X < 15 else 4)
    for i, (sx, sy) in enumerate(((13, H - 36), (19, H - 38))):               # 김
        for j in range(5): tc.px(sx + (j % 2), sy - j, 'washi', 6 - j // 3, 200)
    for (bx, by) in ((30, H - 19), (36, H - 19)):                            # 그릇
        tc.ell(bx, by, 3.2, 1.4, 'washi', lambda X, Y: 6 if Y < by else 4); tc.px(bx, by + 1, 'washi', 3)
    return soft(tc.fin(.6), W // 2, H - 2, W // 2 - 3, 2)


def lantern_stall(seed=2):
    """등 노점 3x3칸: 주칠 차양 + 가로 장대에 매단 등 다섯(붉은·노란 종이 등, 크기 섞음) + 판대 위 접은 등 더미. 판대 줄만 막힘."""
    W, H = 48, 48
    tc = TC(W, H, seed)
    for px_ in (2, W - 5):
        for y in range(4, H - 1): tc.px(px_, y, 'wood', 5); tc.px(px_ + 1, y, 'wood', 3); tc.px(px_ + 2, y, 'wood', 2)
    awning(tc, 0, 1, W, 9, mat='shu')
    for x in range(3, W - 3): tc.px(x, 13, 'wood', 4); tc.px(x, 14, 'wood', 2)
    for i, (cx, h, w, mat) in enumerate(((9, 9, 7, 'redl'), (17, 7, 6, 'amber'), (24, 10, 8, 'redl'), (32, 7, 6, 'amber'), (39, 9, 7, 'redl'))):
        tc.px(cx, 15, 'kuro', 3)
        red_lantern(tc, cx, 16, h=h, w=w, mat=mat)
    counter(tc, 4, H - 14, W - 8, 13)
    for i in range(5):                                                        # 접은 등(납작 원통)
        x = 8 + i * 7
        for y in range(H - 18, H - 14):
            for xx in range(x, x + 6): tc.px(xx, y, 'redl' if i % 2 == 0 else 'amber', 5 if y == H - 18 else 4)
    return soft(tc.fin(.6), W // 2, H - 2, W // 2 - 3, 2)


def tea_stall(seed=3):
    """찻물 노점 2x2칸: 숯 화로 위 무쇠 주전자(김) + 옆 찻잔 쟁반 놓인 낮은 판대 + 작은 쪽빛 차양. 몸통 줄 막힘."""
    W, H = 32, 32
    tc = TC(W, H, seed)
    awning(tc, 2, 1, W - 4, 7, mat='ai', scallop=True)
    for px_ in (3, W - 5):
        for y in range(6, H - 1): tc.px(px_, y, 'take', 5); tc.px(px_ + 1, y, 'take', 2)
    counter(tc, 2, H - 11, W - 4, 10)
    for y in range(H - 17, H - 11):                                           # 화로
        for x in range(6, 15):
            k = 4 if x < 12 else 3
            if y == H - 17: k = 5
            tc.px(x, y, 'qing', k)
    tc.px(9, H - 15, 'amber', 6); tc.px(10, H - 15, 'redl', 5); tc.px(11, H - 15, 'amber', 5)
    tc.ell(10.5, H - 20, 4, 3, 'kuro', lambda X, Y: 5 if X < 10 and Y < H - 21 else 3)
    tc.px(15, H - 21, 'kuro', 3); tc.px(16, H - 22, 'kuro', 3)
    for j in range(4): tc.px(10 + (j % 2), H - 24 - j, 'washi', 6, 190)
    for (cx_, cy_) in ((20, H - 13), (24, H - 13), (22, H - 15)):
        tc.px(cx_, cy_, 'jade', 5); tc.px(cx_ + 1, cy_, 'jade', 4); tc.px(cx_, cy_ + 1, 'jade', 3); tc.px(cx_ + 1, cy_ + 1, 'jade', 2)
    return soft(tc.fin(.6), W // 2, H - 2, W // 2 - 2, 2)


def dye_rack(seed=4):
    """앵커 ⑤: 염색 천 말림대 4x5칸: 높은 대나무 틀(기둥 셋 + 가로대 둘) + 길게 늘어뜨린 천 여섯 폭(쪽빛 진하고 옅음·흰 무명·찻빛,
    바람에 끝이 살짝 휜다, 쪽빛 천에 흰 꽃무늬 점), 밑에 물 받는 나무 함지. 발자국: 기둥 밑동 칸만 막힘 — 천 사이는 지나갈 수 없게 아랫줄 전부 막는다."""
    W, H = 64, 80
    tc = TC(W, H, seed)
    for px_ in (2, 31, W - 5):
        for y in range(3, H - 1): tc.px(px_, y, 'take', 5); tc.px(px_ + 1, y, 'take', 4); tc.px(px_ + 2, y, 'take', 2)
        tc.px(px_ + 1, 2, 'take', 5)
    for yb in (5, 9):
        for x in range(1, W - 1):
            tc.px(x, yb, 'take', 5); tc.px(x, yb + 1, 'take', 2)
            if x % 9 == 0: tc.px(x, yb, 'take', 2)
    cloths = [(6, 'ai', 3, True), (15, 'ai', 4, False), (23, 'washi', 4, False), (36, 'ai', 2, True), (45, 'cha', 4, False), (53, 'ai', 5, False)]
    for i, (x0, mat, base, pat) in enumerate(cloths):
        L = 54 + int(_hash(i, 1, seed) * 14)
        bend = (_hash(i, 2, seed) - .5) * 4
        for y in range(10, 10 + L):
            f = (y - 10) / L
            ox = int(round(bend * f * f))
            for j in range(7):
                x = x0 + j + ox
                k = base + (1 if j < 2 else 0) - (1 if j >= 5 else 0)
                if y > 10 + L - 6: k -= 1
                m = mat
                if pat and ((y // 5 + (j // 3)) % 3 == 0) and 1 <= j <= 5 and (y % 5 in (1, 2)): m, k = 'washi', 5
                tc.px(x, y, m, clamp(k, 1, 6))
            if y == 10 + L - 1:
                for j in range(7): tc.px(x0 + j + ox, y + 1, mat, 1)
    for y in range(H - 8, H - 1):                                             # 함지
        for x in range(8, W - 8):
            k = 5 if y == H - 8 else (4 if x < W - 12 else 3)
            if y == H - 2: k = 2
            tc.px(x, y, 'wood', k)
    for x in range(10, W - 10): tc.px(x, H - 7, 'ai', 2)
    return soft(tc.fin(.6), W // 2, H - 2, W // 2 - 4, 3)


# ================================================================ 배
def _hull(tc, x0, y0, w, h, cover=None, seed=0):
    """나룻배 몸(위에서 비스듬히, 동서로 누운 배): 뱃전(빛 테) 안쪽 바닥 널 + 가로 칸막이, 이물·고물이 위로 휘어 뾰족.
    cover = (재질, x0, x1): 대나무 거적 지붕(반원통, 가로 결)."""
    cx = x0 + w / 2.0
    for x in range(x0, x0 + w):
        u = abs(x + .5 - cx) / (w / 2.0)
        lift = int(round(3 * u ** 3))
        half = (h / 2.0) * (1 - u ** 4) ** .5
        yc = y0 + h / 2.0 - lift
        for y in range(int(yc - half), int(yc + half) + 3):
            if y > yc + half:                                                   # 뱃몸 옆(앞을 보는 쪽, 그늘)
                tc.px(x, y, 'wood', 2 if y < yc + half + 2 else 1); continue
            edge = y < yc - half + 1.5 or y > yc + half - 1.5
            if edge: tc.px(x, y, 'wood', 5 if y < yc else 3); continue
            k = 3 if (x - x0) % 9 == 0 else 4
            if (y - int(yc - half)) % 3 == 0: k -= 1
            tc.px(x, y, 'wood', k)
    if cover:
        m, c0, c1 = cover
        for x in range(c0, c1):
            for y in range(int(y0 - 2), int(y0 + h * .78)):
                f = (y - (y0 - 2)) / (h * .78 + 2)
                k = 5 if f < .25 else (4 if f < .6 else 3)
                if (x - c0) % 3 == 0: k -= 1
                if x in (c0, c1 - 1): k = 2
                tc.px(x, y, m, clamp(k, 1, 6))


def sampan(seed=0, flip_=False):
    """오봉선(검은 거적 지붕 나룻배) 4x2칸, 동서로 누운 배: 가운데 검은 대나무 거적 반원통 지붕, 고물에 노(긴 장대) 하나. 물 칸 위에 둔다."""
    W, H = 64, 32
    tc = TC(W, H, seed)
    _hull(tc, 1, 12, W - 2, 13, cover=('kuro', 22, 44), seed=seed)
    for i in range(18):                                                       # 노
        tc.px(46 + i, 9 + i // 3, 'wood', 4); tc.px(46 + i, 10 + i // 3, 'wood', 2)
    im = tc.fin(.6)
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip_ else im


def skiff(seed=1, flip_=False):
    """작은 거룻배 3x2칸(지붕 없음): 바닥 널 + 칸막이 둘, 안에 대 바구니 하나·장대. 물 칸 위."""
    W, H = 48, 32
    tc = TC(W, H, seed)
    _hull(tc, 1, 13, W - 2, 11, seed=seed)
    for y in range(15, 20):
        for x in range(26, 33): tc.px(x, y, 'take', 5 if y == 15 else (4 if x < 31 else 3))
    for i in range(30): tc.px(6 + i, 11 + (i > 20), 'take', 4 if i % 2 else 5)
    im = tc.fin(.6)
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip_ else im


def boat_ns(seed=2):
    """남북으로 누운 나룻배 2x4칸(남북 운하용): 이물(위)이 뾰족, 가운데 찻빛 거적 지붕, 뱃전 빛 테 + 오른쪽 뱃몸 그늘. 물 칸 위."""
    W, H = 32, 64
    tc = TC(W, H, seed)
    cy = H / 2.0
    for y in range(2, H - 2):
        u = abs(y + .5 - cy) / (H / 2.0 - 2)
        half = 11 * (1 - u ** 4) ** .5
        for x in range(int(16 - half), int(16 + half) + 2):
            if x > 16 + half - 1: tc.px(x, y, 'wood', 2); continue
            edge = x < 16 - half + 1.5 or x > 16 + half - 2.5
            if edge: tc.px(x, y, 'wood', 5 if x < 16 else 3); continue
            k = 4 if (y % 9) else 3
            if (x % 3) == 0: k -= 1
            tc.px(x, y, 'wood', k)
    for y in range(22, 42):
        for x in range(7, 26):
            k = 5 if x < 12 else (4 if x < 20 else 3)
            if (y - 22) % 3 == 0: k -= 1
            tc.px(x, y, 'cha', k)
    return tc.fin(.6)


# ================================================================ 나무
def willow(seed=0, w=3, h=5, flip_=False):
    """버드나무 w x h칸: 굵고 굽은 줄기(나무 램프, 왼 빛), 위 수관 덩이(버들잎 램프) 둘~셋 + 아래로 길게 늘어진 가지 줄 십여 가닥
    (1px 가지 + 잎 점, 끝이 바람에 살짝 휜다). 맨 아랫줄(줄기 밑동)만 막히고 위 칸은 걷기 + 위층."""
    W, H = w * 16, h * 16
    tc = TC(W, H, seed)
    cx = W / 2.0 + (_hash(seed, 1, 1) - .5) * 6
    bend = (_hash(seed, 2, 1) - .5) * 10
    for y in range(int(H * .45), H - 1):                                       # 줄기(위로 갈수록 가늘고 굽는다)
        f = (H - y) / (H * .55)
        x_c = cx + bend * f * f
        tw = 6 - int(3 * f)
        for i in range(tw):
            k = (5, 4, 4, 3, 2, 2)[min(5, int(i * 6 / tw))]
            if (y + i * 3) % 7 == 0: k -= 1
            tc.px(x_c - tw / 2 + i, y, 'wood', clamp(k, 1, 6))
    for i in range(-3, 4): tc.px(cx + i, H - 1, 'wood', 2 if abs(i) < 3 else 1)
    LT = leaf_tex()
    tops = [(cx + bend * .9, H * .22, W * .34, H * .15), (cx + bend * .6 - W * .2, H * .32, W * .22, H * .1), (cx + bend * .6 + W * .22, H * .3, W * .22, H * .1)]
    strands = []
    for (fx, fy, rx, ry) in tops:
        for y in range(int(fy - ry - 1), int(fy + ry + 2)):
            for x in range(int(fx - rx - 1), int(fx + rx + 2)):
                d = ((x + .5 - fx) / rx) ** 2 + ((y + .5 - fy) / ry) ** 2
                if d > .9 + .25 * _hash(x // 2, y // 2, seed + 4): continue
                t = LT[y % 32, x % 32] or 3
                k = int(t) + (1 if (y < fy and x < fx) else 0) - (1 if y > fy + ry * .3 else 0)
                tc.px(x, y, 'yana', clamp(k, 1, 6))
        for s in range(9):
            sx = fx + (s / 8.0 - .5) * rx * 1.9 + (_hash(s, int(fx), seed) - .5) * 3
            strands.append((sx, fy + ry * .3, 18 + _hash(s, int(fy), seed + 1) * (H * .42)))
    for i, (sx, sy, L) in enumerate(strands):                                  # 늘어진 가지(앞쪽이 밝다)
        sway = (_hash(i, 5, seed) - .3) * 3
        for j in range(int(L)):
            x = sx + sway * (j / L) ** 2; y = sy + j
            if y >= H - 3: break
            k = 4 if j % 3 else 5
            if j > L - 4: k = 3
            tc.px(x, y, 'yana', k)
            if j % 3 == 1: tc.px(x + (1 if (i + j) % 2 else -1), y, 'yana', k - 1)
    im = tc.fin(.6)
    im = soft(im, int(cx), H - 2, W // 2 - 4, 3, 60)
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip_ else im


def plum_tree(seed=0):
    """매화·복사나무 2x3칸: 비틀린 검은 가지 + 분홍 꽃 덩이(꽃잎 점, 빛 쪽 흰 분홍). 밑동만 막힘."""
    W, H = 32, 48
    tc = TC(W, H, seed)
    pts = [(16, H - 1), (15, 34), (12, 26), (9, 18), (6, 12)]
    br = [((14, 30), (22, 20), (26, 14)), ((12, 24), (18, 16), (20, 9)), ((10, 20), (5, 15))]
    def seg(a, b, w):
        n = int(max(abs(b[0] - a[0]), abs(b[1] - a[1]))) + 1
        for i in range(n):
            f = i / max(1, n - 1); x = a[0] + (b[0] - a[0]) * f; y = a[1] + (b[1] - a[1]) * f
            for j in range(w): tc.px(x + j, y, 'kuro', 5 if j == 0 else 3)
    for a, b in zip(pts, pts[1:]): seg(a, b, 3)
    for path in br:
        for a, b in zip(path, path[1:]): seg(a, b, 2)
    for (fx, fy, r) in ((8, 12, 6), (20, 10, 6), (25, 15, 5), (14, 18, 5), (6, 18, 4), (19, 22, 4)):
        for y in range(int(fy - r), int(fy + r) + 1):
            for x in range(int(fx - r), int(fx + r) + 1):
                if (x - fx) ** 2 + ((y - fy) * 1.2) ** 2 > r * r: continue
                h = _hash(x, y, seed + 3)
                if h < .35: continue
                k = 6 if (x < fx and y < fy) else (5 if h > .6 else 4)
                if y > fy + r * .5: k = 3
                tc.px(x, y, 'momo', k)
    return soft(tc.fin(.6), 16, H - 2, 6, 2, 55)


# ================================================================ 등·깃발
def lantern_post(seed=0, h=3):
    """홍등 기둥 1 x h칸: 나무 기둥(돌 받침) + 위 구부린 쇠 팔에 매단 둥근 붉은 등 하나(금 술). 밑동만 막힘, 위 칸 걷기 + 위층."""
    W, H = 16, h * 16
    tc = TC(W, H, seed)
    for y in range(6, H - 3): tc.px(4, y, 'wood', 5); tc.px(5, y, 'wood', 3); tc.px(6, y, 'wood', 2)
    for y in range(H - 4, H):
        for x in range(2, 9): tc.px(x, y, 'gran', 5 if y == H - 4 else (4 if x < 7 else 3))
    for x in range(4, 13): tc.px(x, 6, 'kuro', 4); tc.px(x, 7, 'kuro', 2)
    tc.px(12, 8, 'kuro', 3)
    red_lantern(tc, 12, 9, h=10, w=8)
    tc.px(4, 4, 'wood', 5); tc.px(5, 5, 'wood', 4)
    return soft(tc.fin(.6), 5, H - 2, 4, 1, 50)


def lantern_string(w=4, seed=0, n=None):
    """홍등 줄 w x 1칸(위층, 걷기): 두 끝 사이에 처진 줄 + 매단 작은 붉은 등 w~w+1 개. 길 위 공중 — 기둥·처마 끝 둘 사이에 둔다.
    지도에서는 lantern_post·건물 처마 높이에 맞춰 위층으로 덮어 그린다(밑을 지나간다)."""
    W, H = w * 16, 16
    tc = TC(W, H, seed)
    n = n or (w + 1)
    sag = lambda x: 1 + int(round(4 * (1 - ((x + .5 - W / 2.0) / (W / 2.0)) ** 2)))
    for x in range(W): tc.px(x, sag(x), 'kuro', 3)
    for i in range(n):
        cx = (i + .5) * W / n
        y = sag(int(cx)) + 1
        red_lantern(tc, cx, y, h=7, w=6, tassel=(i % 2 == 0))
    return tc.fin(.6)


def wine_flag(seed=0):
    """술집 깃발(주기) 1x3칸: 대나무 장대 + 위 가로대에 매단 긴 천(흰 바탕 + 붉은 테 + 아래 톱니 끝, 글자 없음, 바람에 살짝 휜다). 밑동만 막힘."""
    W, H = 16, 48
    tc = TC(W, H, seed)
    for y in range(2, H - 1): tc.px(2, y, 'take', 5); tc.px(3, y, 'take', 2)
    for x in range(2, 15): tc.px(x, 3, 'take', 4)
    for y in range(4, 30):
        f = (y - 4) / 26.0; ox = int(round(2 * f * f))
        for x in range(5, 14):
            lx = x - 5
            m, k = 'washi', 5 if lx < 6 else 4
            if lx in (0, 8) or y in (4, 5): m, k = 'shu', 4
            if y > 26 and (lx % 3 == 1) and y > 26 + (lx % 2): continue
            tc.px(x + ox, y, m, k)
    return soft(tc.fin(.6), 3, H - 2, 3, 1, 45)


# ================================================================ 소품
def water_jar(seed=0, lid=True):
    """큰 물독 1x2칸(갈색 유약 + 위 나무 뚜껑): 둥근 배 원통 음영, 어깨 빛 띠, 아래 받침 그늘. 몸통 줄 막힘."""
    W, H = 16, 24
    tc = TC(W, H, seed)
    for y in range(5, H - 1):
        f = (y - 5) / (H - 6.0)
        hw = 6.5 * math.sin(.35 + f * 2.5) + .5
        for x in range(int(8 - hw), int(8 + hw) + 1):
            u = (x + .5 - (8 - hw)) / (2 * hw + .01)
            k = cyl_k(u)
            if y in (8, 9): k += 1
            tc.px(x, y, 'wood' if seed % 2 else 'jade', clamp(k, 1, 6))
    if lid:
        tc.ell(8, 5, 5.2, 2, 'wood', lambda X, Y: 5 if Y < 5 else 4)
        tc.px(8, 3, 'wood', 5); tc.px(8, 4, 'wood', 4)
    else:
        tc.ell(8, 5, 5.2, 2, 'mizu', lambda X, Y: 4 if X < 7 else 2)
    return soft(tc.fin(.6), 8, H - 2, 6, 2, 55)


def wine_jars(seed=0):
    """술독 무더기 2x1칸: 붉은 천 덮개를 끈으로 묶은 작은 독 셋(옥빛·갈색 유약 섞임). 칸 막힘."""
    W, H = 32, 16
    tc = TC(W, H, seed)
    for i, (cx, mat) in enumerate(((7, 'jade'), (16, 'wood'), (25, 'jade'))):
        for y in range(5, 15):
            f = (y - 5) / 10.0; hw = 4.2 * math.sin(.4 + f * 2.4) + .3
            for x in range(int(cx - hw), int(cx + hw) + 1):
                u = (x + .5 - (cx - hw)) / (2 * hw + .01); tc.px(x, y, mat, clamp(cyl_k(u), 1, 6))
        tc.ell(cx, 4.5, 3.4, 2, 'shu', lambda X, Y: 5 if X < cx else 3)
        tc.px(cx - 2, 6, 'kaya', 4); tc.px(cx + 2, 6, 'kaya', 3)
    return soft(tc.fin(.6), 16, 14, 13, 1, 50)


def tea_table(seed=0):
    """찻상과 걸상 2x2칸(물가·찻집 마당): 둥근 나무 탁자(윗면 빛 원 + 테 그늘 + 굵은 다리) 위 옥빛 찻주전자·흰 잔 셋,
    앞뒤로 북 모양 돌 걸상 둘. 탁자 칸만 막힘."""
    W, H = 32, 32
    tc = TC(W, H, seed)
    def stool(sx, sy):
        for y in range(sy - 6, sy + 1):
            for x in range(sx - 4, sx + 4):
                k = 4 if x < sx + 1 else 3
                if y == sy: k = 2
                tc.px(x, y, 'gran', k)
        tc.ell(sx, sy - 6, 4.2, 1.8, 'gran', lambda X, Y: 6 if X < sx else 5)
    stool(16, 9)                                                                # 뒤 걸상(탁자에 반쯤 가린다)
    for y in range(18, 29):
        for x in range(13, 19): tc.px(x, y, 'wood', 4 if x < 15 else (3 if x < 17 else 2))
    for x in range(9, 23): tc.px(x, 28, 'wood', 3); tc.px(x, 29, 'wood', 2)
    tc.ell(16, 16, 12, 5.2, 'wood', lambda X, Y: 2)
    tc.ell(16, 15, 12, 5, 'wood', lambda X, Y: 6 if X < 12 and Y < 14 else (5 if Y < 16 else 4))
    tc.ell(12, 13, 2.8, 2.2, 'jade', lambda X, Y: 6 if X < 12 else 4); tc.px(15, 13, 'jade', 4); tc.px(16, 12, 'jade', 3); tc.px(12, 10, 'jade', 5)
    for (cx, cy) in ((19, 14), (22, 16), (18, 17)):
        tc.px(cx, cy, 'washi', 6); tc.px(cx + 1, cy, 'washi', 5); tc.px(cx, cy + 1, 'washi', 3); tc.px(cx + 1, cy + 1, 'washi', 3)
    stool(5, 30); stool(27, 30)
    return soft(tc.fin(.6), 16, 30, 13, 2, 55)


def bench(seed=0):
    """나무 긴 의자 2x1칸(물가·다리 끝): 앉는 판 윗면 + 다리 둘. 칸 막힘."""
    W, H = 32, 16
    tc = TC(W, H, seed)
    for y in range(5, 9):
        for x in range(2, 30): tc.px(x, y, 'wood', 6 if y == 5 else (5 if y < 8 else 3))
    for y in range(9, 11):
        for x in range(2, 30): tc.px(x, y, 'wood', 2)
    for px_ in (4, 25):
        for y in range(11, 15): tc.px(px_, y, 'wood', 4); tc.px(px_ + 1, y, 'wood', 3); tc.px(px_ + 2, y, 'wood', 2)
    return soft(tc.fin(.6), 16, 14, 13, 1, 50)


def steamer_baskets(seed=0):
    """대나무 소쿠리·찜기 무더기 1x1칸: 쌓은 납작 찜기 셋 + 기댄 둥근 소쿠리. 칸 막힘."""
    tc = TC(16, 16, seed)
    for j in range(3):
        y = 11 - j * 3
        for x in range(1, 10):
            k = 5 if x < 4 else (4 if x < 8 else 3)
            tc.px(x, y, 'take', k); tc.px(x, y + 1, 'take', k - 1); tc.px(x, y + 2, 'take', 2)
    tc.ell(5, 4, 4.4, 1.6, 'take', lambda X, Y: 6 if X < 4 else 4)
    tc.ell(12, 9, 3.4, 5, 'take', lambda X, Y: 5 if X < 11 else 3)
    tc.ell(12, 9, 1.8, 3.2, 'take', lambda X, Y: 2)
    return soft(tc.fin(.6), 8, 14, 6, 1, 50)


def cloth_sacks(seed=0):
    """곡식 자루 무더기 2x1칸(무명 자루 넷, 묶은 목). 칸 막힘."""
    W, H = 32, 16
    tc = TC(W, H, seed)
    for i, (cx, cy, r) in enumerate(((7, 10, 5.5), (17, 10, 5.5), (26, 11, 4.6), (12, 5, 4.4))):
        tc.ell(cx, cy, r, r * .8, 'cha', lambda X, Y, cx=cx, cy=cy: 6 if X < cx - 1 and Y < cy - 1 else (5 if Y < cy + 1 else 4))
        tc.px(cx, cy - r * .8 - 1, 'kaya', 4); tc.px(cx, cy - r * .8, 'kaya', 3)
    return soft(tc.fin(.6), 16, 14, 13, 1, 50)


def crates(seed=0):
    """나무 짐 상자 둘(쌓음) 1x2칸: 윗면 빛 + 앞면 널 + 띠 쇠. 아랫줄 막힘."""
    W, H = 16, 28
    tc = TC(W, H, seed)
    for (y0, y1, x0, x1) in ((14, 27, 1, 15), (3, 14, 3, 14)):
        for y in range(y0, y1):
            for x in range(x0, x1):
                top = y < y0 + 4
                k = (6 if y == y0 else 5) if top else (4 if (x - x0) % 4 else 3)
                if x >= x1 - 2 and not top: k -= 1
                if not top and y == y1 - 1: k = 1
                tc.px(x, y, 'wood', clamp(k, 1, 6))
        for x in range(x0, x1): tc.px(x, y0 + 7, 'kuro', 3)
    return soft(tc.fin(.6), 8, 26, 7, 1, 50)


def umbrella_stand(seed=0):
    """기름종이 우산 가게 앞 진열 2x2칸: 활짝 편 우산 둘(주칠·쪽빛, 살 줄 + 꼭지) + 접은 우산 꽂은 대 통. 아랫줄 막힘."""
    W, H = 32, 32
    tc = TC(W, H, seed)
    for (cx, cy, r, mat) in ((10, 12, 9, 'shu'), (23, 16, 8, 'ai')):
        for y in range(int(cy - r * .7), int(cy + 2)):
            for x in range(int(cx - r), int(cx + r) + 1):
                d = ((x + .5 - cx) / r) ** 2 + ((y + .5 - cy) / (r * .7)) ** 2
                if d > 1: continue
                ang = math.atan2(y + .5 - cy, x + .5 - cx)
                rib = abs(((ang * 8 / math.pi) % 2) - 1) < .18
                k = 5 if x < cx else 4
                if y > cy - 1: k -= 1
                if rib: k -= 1
                tc.px(x, y, mat, clamp(k, 1, 6))
        tc.px(cx, cy - r * .7 - 1, 'wood', 4)
        for y in range(int(cy + 1), H - 3): tc.px(cx, y, 'wood', 3)
    for y in range(H - 9, H - 1):                                              # 대 통 + 접은 우산
        for x in range(13, 20): tc.px(x, y, 'take', 5 if x < 15 else (4 if x < 18 else 3))
    for (x, m) in ((14, 'shu'), (16, 'cha'), (18, 'ai')):
        for y in range(H - 18, H - 9): tc.px(x, y, m, 4 if y > H - 16 else 5)
    return soft(tc.fin(.6), 16, H - 2, 12, 2, 50)


def well_cn(seed=0):
    """돌 우물 2x2칸: 팔각 화강암 우물 테(윗면 빛 + 앞면 장대석) + 나무 도르래 틀(기둥 둘 + 가로대 + 매단 두레박), 속 물 어둠. 아래 1줄 막힘."""
    W, H = 32, 32
    tc = TC(W, H, seed)
    for y in range(18, 30):
        for x in range(4, 28):
            k = 4 if x < 24 else 3
            if (y - 18) % 5 == 4 or (x - 4) % 8 == 7: k = 2
            tc.px(x, y, 'gran', k)
    tc.ell(16, 18, 12, 4.5, 'gran', lambda X, Y: 6 if Y < 17 else 5)
    tc.ell(16, 18, 8.5, 2.8, 'mizu', lambda X, Y: 1 if Y < 18 else 2)
    for px_ in (5, 25):
        for y in range(2, 18): tc.px(px_, y, 'wood', 5); tc.px(px_ + 1, y, 'wood', 2)
    for x in range(5, 27): tc.px(x, 3, 'wood', 5); tc.px(x, 4, 'wood', 2)
    tc.ell(16, 4, 2.4, 2.4, 'wood', lambda X, Y: 6 if X < 16 else 3)
    for y in range(6, 12): tc.px(16, y, 'kaya', 3)
    for y in range(12, 16):
        for x in range(14, 19): tc.px(x, y, 'wood', 5 if y == 12 else (4 if x < 17 else 3))
    return soft(tc.fin(.6), 16, 30, 13, 2, 55)


def stone_lion(seed=0, flip_=False):
    """돌사자(문 지킴, 일반형) 1x2칸: 네모 받침 위에 앉은 사자 — 둥근 갈기 덩이(곱슬 점), 앞발 하나에 공. 받침 칸 막힘."""
    W, H = 16, 32
    tc = TC(W, H, seed)
    for y in range(22, 32):
        for x in range(1, 15): tc.px(x, y, 'gran', 6 if y == 22 else (2 if y == 31 else (4 if x < 12 else 3)))
    tc.ell(8, 17, 5.5, 5.2, 'gran', lambda X, Y: 5 if X < 7 else (4 if X < 11 else 3))      # 몸
    tc.ell(8, 9, 5.8, 5.4, 'gran', lambda X, Y: 5 if X < 7 and Y < 9 else (4 if X < 11 else 3))  # 머리·갈기
    for (x, y) in ((4, 6), (7, 4), (10, 5), (12, 8), (4, 11), (12, 12), (6, 13)): tc.px(x, y, 'gran', 2); tc.px(x + 1, y, 'gran', 6)
    tc.px(6, 9, 'dark', 2); tc.px(10, 9, 'dark', 2); tc.px(8, 11, 'gran', 2)
    tc.ell(11, 20, 2.2, 2, 'gran', lambda X, Y: 6 if X < 11 else 4)                         # 공
    im = soft(tc.fin(.6), 8, 30, 7, 1, 55)
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip_ else im


def mooring_post(seed=0):
    """계선 말뚝 1x1칸(물가 둑): 굵은 나무 말뚝(쇠 머리) + 감긴 밧줄. 칸 막힘."""
    tc = TC(16, 16, seed)
    for y in range(4, 15):
        for i in range(6): tc.px(5 + i, y, 'wood', (5, 5, 4, 4, 3, 2)[i])
    tc.ell(8, 4, 3.4, 1.6, 'wood', lambda X, Y: 6 if X < 8 else 4)
    for y in (8, 10):
        for x in range(4, 12): tc.px(x, y, 'kaya', 5 if x < 8 else 3)
    return soft(tc.fin(.6), 8, 14, 5, 1, 50)


def reed_clump(seed=0):
    """갈대 포기 1x2칸(물가 둑·얕은 물): 가는 잎 열 줄기(빛 끝) + 누런 이삭 셋. 밑동만 막힘(물가에 두면 물 칸이라 원래 막힘)."""
    W, H = 16, 32
    tc = TC(W, H, seed)
    for i in range(10):
        x0 = 3 + _hash(i, 1, seed) * 10; L = 12 + _hash(i, 2, seed) * 16; lean = (_hash(i, 3, seed) - .5) * 6
        for j in range(int(L)):
            f = j / L
            x = x0 + lean * f * f; y = H - 2 - j
            tc.px(x, y, 'leaf', 5 if f > .6 else (4 if f > .25 else 3))
        if i % 3 == 0:
            for j in range(4): tc.px(x0 + lean, H - 2 - L - j, 'gold', 4 - j // 2)
    return soft(tc.fin(.6), 8, H - 2, 6, 1, 45)


def lotus_basin(seed=0):
    """연꽃 독(마당 큰 돌 수반) 2x2칸: 화강암 둥근 수반(윗면 테 빛 + 앞면) + 물 + 연잎 셋 + 분홍 꽃 하나. 아래 1줄 막힘."""
    W, H = 32, 32
    tc = TC(W, H, seed)
    for y in range(16, 30):
        f = (y - 16) / 14.0; hw = 13 - 4 * f * f
        for x in range(int(16 - hw), int(16 + hw)):
            u = (x + .5 - (16 - hw)) / (2 * hw); tc.px(x, y, 'gran', clamp(cyl_k(u) - (1 if y > 27 else 0), 1, 6))
    tc.ell(16, 16, 13, 4.5, 'gran', lambda X, Y: 6 if Y < 15 else 5)
    tc.ell(16, 16, 10.5, 3.2, 'mizu', lambda X, Y: 3)
    for (cx, cy, r) in ((11, 15, 3.2), (19, 17, 2.8), (22, 14, 2.4)):
        tc.ell(cx, cy, r, r * .7, 'hasu', lambda X, Y, cx=cx: 5 if X < cx else 4)
    for (dx, dy, k) in ((0, -2, 6), (-1, -1, 5), (1, -1, 4), (0, -1, 6), (0, 0, 4)): tc.px(15 + dx, 12 + dy, 'momo', k)
    for y in range(4, 12): tc.px(15, y + 2, 'hasu', 3) if y > 8 else None
    return soft(tc.fin(.6), 16, 30, 13, 2, 55)


def incense_burner(seed=0):
    """청동 향로(정, 마을 사당·패루 앞) 2x2칸: 세 다리 + 둥근 배 + 두 귀 + 위로 오르는 향 연기 두 줄. 아래 1줄 막힘."""
    W, H = 32, 32
    tc = TC(W, H, seed)
    for (x0, x1) in ((8, 11), (15, 18), (22, 25)):
        for y in range(24, 31):
            for x in range(x0, x1): tc.px(x, y, 'jade', 4 if x == x0 else 2)
    for y in range(13, 25):
        f = (y - 13) / 12.0; hw = 11 - 4 * f * f
        for x in range(int(16 - hw), int(16 + hw)):
            u = (x + .5 - (16 - hw)) / (2 * hw); k = cyl_k(u)
            if y in (16, 17): k += 1
            if y == 15 and x % 3 == 0: m = 'gold'
            else: m = 'jade'
            tc.px(x, y, m, clamp(k, 1, 6))
    tc.ell(16, 13, 11, 3, 'jade', lambda X, Y: 5 if Y < 13 else 3)
    tc.ell(16, 13, 8, 1.8, 'dark', lambda X, Y: 2)
    for (ex, d) in ((5, -1), (27, 1)):
        for y in range(8, 14): tc.px(ex, y, 'jade', 4); tc.px(ex + d, y, 'jade', 2)
        tc.px(ex, 8, 'jade', 5); tc.px(ex - d, 8, 'jade', 4)
    for (sx, s) in ((14, 0), (18, 1)):
        for j in range(9): tc.px(sx + int(round(math.sin(j * .8 + s) * 1.2)), 11 - j, 'washi', 5 if j < 5 else 4, 170)
    return soft(tc.fin(.6), 16, 30, 12, 2, 55)


def hand_cart(seed=0):
    """나무 손수레 2x2칸(장터): 바퀴 하나(살 + 테) + 짐칸(윗면 널) + 손잡이 둘, 짐칸에 자루·찻빛 천 짐. 아래 1줄 막힘."""
    W, H = 32, 32
    tc = TC(W, H, seed)
    for i in range(14): tc.px(18 + i, 14 + i // 3, 'wood', 4); tc.px(18 + i, 15 + i // 3, 'wood', 2)
    for y in range(10, 20):
        for x in range(2, 24):
            k = (6 if y == 10 else 5) if y < 14 else (4 if (x % 5) else 3)
            if y == 19: k = 1
            tc.px(x, y, 'wood', k)
    tc.ell(9, 8, 4.5, 3, 'washi', lambda X, Y: 5 if X < 8 else 4)
    tc.ell(16, 8, 4, 2.6, 'cha', lambda X, Y: 5 if X < 15 else 3)
    tc.ell(12, 24, 6.2, 6.2, 'wood', lambda X, Y: 4)
    tc.ell(12, 24, 4.4, 4.4, 'dark', lambda X, Y: 2)
    for a in range(6):
        ang = a * math.pi / 3
        for r in range(5): tc.px(12 + math.cos(ang) * r, 24 + math.sin(ang) * r, 'wood', 3)
    tc.ell(12, 24, 1.2, 1.2, 'wood', lambda X, Y: 5)
    return soft(tc.fin(.6), 14, 30, 10, 2, 55)


def laundry_pole(seed=0):
    """빨래 장대 3x2칸: 대나무 버팀 둘 + 가로 장대에 넌 옷가지·천(흰·쪽빛·찻빛, 소매 모양 하나). 버팀 밑동만 막힘."""
    W, H = 48, 32
    tc = TC(W, H, seed)
    for px_ in (3, W - 6):
        for y in range(4, H - 1): tc.px(px_, y, 'take', 5); tc.px(px_ + 1, y, 'take', 3); tc.px(px_ + 2, y, 'take', 2)
    for x in range(2, W - 2): tc.px(x, 5, 'take', 5); tc.px(x, 6, 'take', 2)
    for (x0, w, L, m) in ((8, 8, 12, 'washi'), (18, 12, 9, 'ai'), (32, 7, 14, 'cha')):
        for y in range(7, 7 + L):
            for x in range(x0, x0 + w):
                k = 5 if x < x0 + 2 else (4 if x < x0 + w - 2 else 3)
                if m == 'ai' and (y > 7 + 3) and (x0 + 3 <= x < x0 + w - 3): continue          # 윗옷 소매(가운데 아래 비움)
                tc.px(x, y, m, k)
    return soft(tc.fin(.6), 24, H - 2, 20, 1, 45)


def potted_pine(seed=0):
    """분재 화분 1x1칸(객잔·찻집 앞): 회청 네모 화분 + 구부린 줄기 + 납작한 잎 덩이 둘. 칸 막힘."""
    tc = TC(16, 16, seed)
    for y in range(10, 15):
        for x in range(2, 14): tc.px(x, y, 'qing', 5 if y == 10 else (4 if x < 11 else 3))
    for (x, y) in ((8, 9), (7, 8), (7, 7), (8, 6), (9, 5)): tc.px(x, y, 'wood', 3)
    EP.foliage(tc, 6, 5, 4, 2, seed, flat=True)
    EP.foliage(tc, 11, 3, 3.2, 1.8, seed + 1, flat=True)
    return soft(tc.fin(.6), 8, 14, 6, 1, 50)


def bamboo_clump(seed=0):
    """대나무 덤불 2x4칸(집 뒤·물가 모퉁이) — eastern-castle 대나무 그림 함수를 이 팩용 크기로. 밑동만 막힘."""
    return EP.bamboo(seed=seed + 40, n=4, w=2, h=4)


def bush_round(seed=0):
    """둥근 회양목 덤불 1x1칸(버들항 덤불 잎 결): 길가·담 밑 덩이. 칸 막힘."""
    tc = TC(16, 16, seed)
    EP.foliage(tc, 8, 8.5, 6.8, 5.6, seed + 7)
    return soft(tc.fin(.6), 8, 14, 6, 1, 55)


def firewood(seed=0):
    """장작 더미 2x1칸 — eastern-castle 장작 그림 함수. 칸 막힘."""
    return EP.firewood(seed=seed)


if __name__ == '__main__':
    import os
    ims = [cloth_stall(), food_stall(), lantern_stall(), tea_stall(), dye_rack(), sampan(), skiff(), boat_ns(), willow(), willow(3, flip_=True), plum_tree(),
           lantern_post(), lantern_string(), wine_flag(), water_jar(), water_jar(1), wine_jars(), tea_table(), bench(), steamer_baskets(), cloth_sacks(), crates(),
           umbrella_stand(), well_cn(), stone_lion(), stone_lion(flip_=True), mooring_post(), reed_clump(), lotus_basin(), incense_burner(), hand_cart(), laundry_pole(),
           potted_pine(), bamboo_clump(), bush_round(), firewood()]
    rows = [ims[:12], ims[12:24], ims[24:]]
    Wt = max(sum(i.width + 8 for i in r) for r in rows) + 8; Ht = sum(max(i.height for i in r) + 10 for r in rows) + 10
    o = Image.new('RGBA', (Wt, Ht), (92, 150, 70, 255)); y = 6
    for r in rows:
        h = max(i.height for i in r); x = 8
        for i in r: o.alpha_composite(i, (x, y + h - i.height)); x += i.width + 8
        y += h + 10
    o.resize((o.width * 2, o.height * 2), Image.NEAREST).save(os.path.join(HERE, '_qa', 'props1.png')); print('ok')
