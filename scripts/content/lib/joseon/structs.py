"""바람의나라 연구에서 뽑은 구조물들 — 성문·성벽·누각·홍살문·등롱문·석탑·장터 차일·원두막·헛간.

모두 3/4 문법: 덩어리마다 윗면(밝음) + 앞면(왼쪽 밝음 → 오른쪽 어두움) + 땅 그림자. 빛은 왼쪽 위.
돌은 한 장씩 쌓은 줄(코스)로 그리고 줄마다 이음매를 어긋낸다(BARAM_STUDY: 어두운 막돌·밝은 각진 돌).
"""
import math
from tk import *
from build import outline
from trees import ground_shadow
from props4 import slab
import blocks as K
import thatch3d


def stone_courses(c, x0, y0, x1, y1, seed=0, ch=8, lit=1.0, lo=None, hi=None, round_top=False):
    """돌 쌓기 면: ch px 높이의 줄, 줄마다 이음을 어긋낸다. 왼쪽이 밝고 오른쪽이 어둡다(lit=1). lo/hi: 줄별 x 범위 함수."""
    S = RGB['stone']
    W = x1 - x0
    for y in range(y0, y1):
        row = (y - y0) // ch
        ry = (y - y0) % ch
        bw = 12 + (row * 5) % 7
        off = (row % 2) * (bw // 2) + (row * 3) % 5
        a = lo(y) if lo else x0
        b = hi(y) if hi else x1
        for x in range(a, b):
            f = (x - x0) / max(1, W - 1)
            tone = 5 if f < 0.10 else (4 if f < 0.62 else 3)
            if lit < 1: tone -= 1
            bx = (x - x0 + off) % bw
            q = rnd(x // bw + row * 7, row, seed + 3)
            if q > 0.8: tone += 1
            elif q < 0.2: tone -= 1
            if ry == 0: tone = min(6, tone + 1)                       # 돌 윗모서리 밝음
            elif ry == ch - 1: tone = max(1, tone - 2)                # 줄 사이 어두운 틈
            if bx == 0: tone = max(1, tone - 2)                       # 이음매
            if rnd(x, y, seed + 9) > 0.93: tone += 1
            c.put(x, y, S[max(1, min(6, tone))])


def merlons(c, x0, x1, ytop, step=13, w=8):
    """여장(성가퀴): 윗면 2줄 + 앞면 5줄, 사이 빈틈."""
    S = RGB['stone']
    x = x0
    while x + w <= x1:
        slab(c, x, ytop, w, 5, 2, S, (6, 5), (5, 4, 3, 2))
        x += step


def _arch(c, cx, yc, R, ybot, ring=4):
    """반원 아치 문: 둘레 쐐기돌 띠, 안은 어둡고 아래 길 바닥이 보인다. 열린 문짝은 양옆 널."""
    S = RGB['stone']; E = RGB['earth']; Wd = RGB['wood']
    for y in range(yc - R - ring, ybot):
        for x in range(cx - R - ring, cx + R + ring):
            dx = x - cx
            if y < yc:
                d = math.hypot(dx, y - yc)
            else:
                d = abs(dx)
            if d > R + ring or (y >= yc and abs(dx) > R + ring):
                continue
            if d <= R:
                t = (y - (yc - R)) / max(1, (ybot - (yc - R)))
                col = E[0] if t < 0.55 else (E[1] if t < 0.85 else E[2])
                if y >= ybot - 5: col = E[3] if (x // 4 + y // 2) % 2 else E[2]      # 길 바닥(돌)
                c.put(x, y, col)
            else:
                ang = math.atan2(y - yc, dx) if y < yc else (math.pi if dx < 0 else 0.0)
                seg = int((ang * 10) // 1) if y < yc else (y // 7)
                col = S[6] if seg % 2 else S[5]
                if dx > R * 0.25: col = S[4] if seg % 2 else S[3]
                if d > R + ring - 1: col = S[2]
                c.put(x, y, col)
    for side in (-1, 1):                                   # 열린 문짝
        for y in range(yc, ybot - 5):
            for k in range(4):
                xx = cx + side * (R - 1 - k)
                c.put(xx, y, Wd[3] if k < 3 else Wd[1])
                if (y - yc) % 7 == 3 and k == 1: c.put(xx, y, RGB['straw'][6])


def fort_gate():
    """성문 10×9칸: 돌 단(아래가 넓은 사다리꼴 + 반원 아치 문) 위에 단청 누각, 앞은 여장."""
    W, H = 10 * T, 9 * T
    c = Cv(W, H)
    S = RGB['stone']
    FY = 84                                                          # 앞면이 시작하는 y
    ground_shadow(c, W // 2 + 6, H - 3, W // 2 - 4, 3, 70)
    # 윗면(걷는 길)
    for y in range(66, FY):
        for x in range(6, W - 6):
            c.put(x, y, S[5] if (x // 6 + y) % 5 else S[4])
    c.hl(6, W - 6, 66, S[6])
    # 누각(벽 없는 정자 + 청록 지붕) — 아래 플린스 줄은 뺀다
    pav_rows = K.house('pv', 5, 'ooooo', 'kkkkk', rows=3, dan=False, steps=(), hip=True)[:-1]
    pav = K.assemble(pav_rows, K.library(), post=lambda cv: (K.roof_baram(cv, 3, 'dg', wing=24), K.pavilion_open(cv, 5)))
    c.paste(pav, (W - pav.w) // 2, 0)
    merlons(c, 6, W - 6, 77, step=14, w=10)
    # 앞면: 아래가 넓은 사다리꼴
    inset = 9
    lo = lambda y: int(round(inset * (1 - (y - FY) / (H - FY))))
    hi = lambda y: W - lo(y)
    stone_courses(c, 0, FY, W, H, seed=5, ch=8, lo=lo, hi=hi)
    for y in range(FY, FY + 2):                                      # 단 윗선 그늘 + 밝은 모서리
        for x in range(lo(y), hi(y)): c.put(x, y, S[6] if y == FY else S[2])
    _arch(c, W // 2, 118, 16, H, ring=5)
    # 편액(어두운 판 + 붉은 테)
    px0, px1 = W // 2 - 12, W // 2 + 12
    for y in range(FY + 3, FY + 9):
        for x in range(px0, px1):
            edge = y in (FY + 3, FY + 8) or x in (px0, px1 - 1)
            c.put(x, y, RGB['red'][3] if edge else RGB['wood'][2])
    for gx in range(px0 + 3, px1 - 3, 4):
        c.put(gx, FY + 5, RGB['straw'][5]); c.put(gx + 1, FY + 6, RGB['straw'][4])
    outline(c)
    return c


def fort_wall_h():
    """성벽 한 칸(16×32): 윗면(걷는 길) + 여장 + 앞 돌 쌓기. 이어 붙이면 성곽이 된다."""
    c = Cv(T, 2 * T)
    S = RGB['stone']
    for y in range(4, 11):
        for x in range(T):
            c.put(x, y, S[5] if y < 10 else S[4])
    c.hl(0, T, 4, S[6])
    slab(c, 3, 7, 10, 5, 2, S, (6, 5), (5, 4, 3, 2))                  # 여장(한 칸에 하나, 가운데)
    stone_courses(c, 0, 12, T, 2 * T - 2, seed=11, ch=6)
    for x in range(T): c.put(x, 2 * T - 2, S[2]); c.put(x, 2 * T - 1, SHADOW, 80)
    return c


def fort_wall_end(side='l'):
    """성벽 끝(성문 옆으로 붙는 쪽): 바깥 모서리가 안으로 기운다."""
    c = fort_wall_h()
    S = RGB['stone']
    for y in range(c.h):
        cut = max(0, 4 - (y - 12) // 5) if y >= 12 else 0
        for k in range(cut):
            x = k if side == 'l' else T - 1 - k
            c.a[y, x, 3] = 0
    return c


def stone_pagoda():
    """삼층 석탑 32×48: 기단 → 몸돌 + 옥개석(윗 경사면이 밝고 앞 처마가 어둡다)이 세 번 → 상륜."""
    c = Cv(2 * T, 3 * T)
    S = RGB['stone']
    ground_shadow(c, 18, 45, 14, 2.2, 70)
    slab(c, 2, 39, 28, 5, 3, S, (6, 5), (5, 4, 3, 2))               # 기단 아래층
    slab(c, 5, 34, 22, 3, 2, S, (6, 5), (5, 4, 3, 2))               # 기단 윗층
    y = 34
    widths = [(20, 7), (16, 6), (12, 5)]                             # (옥개 폭, 몸돌 높이)
    for tier, (ow, bh) in enumerate(widths):
        bw = ow - 8
        bx = 16 - bw // 2
        y -= bh
        for yy in range(y, y + bh):                                  # 몸돌: 왼쪽 밝음, 가운데 모서리 기둥선
            for x in range(bx, bx + bw):
                f = (x - bx) / max(1, bw - 1)
                c.put(x, yy, S[5] if f < 0.3 else (S[4] if f < 0.75 else S[3]))
            c.put(bx, yy, S[6]); c.put(bx + bw - 1, yy, S[2])
        # 옥개석: 윗 경사면 2줄(밝음) + 앞 처마 3줄(왼밝/오른어두움), 끝이 살짝 들린다
        oy = y - 5
        ox = 16 - ow // 2
        for k, (ins, tone) in enumerate(((4, 6), (2, 6), (0, 5))):
            for x in range(ox + ins, ox + ow - ins):
                c.put(x, oy + k, S[tone] if x < 16 else S[min(tone, 5)])
        for k in range(3):
            for x in range(ox, ox + ow):
                f = (x - ox) / max(1, ow - 1)
                c.put(x, oy + 3 + k, S[5 if f < 0.3 else (4 if f < 0.65 else 3)] if k < 2 else S[2])
        c.put(ox, oy + 2, S[6]); c.put(ox + ow - 1, oy + 2, S[5])    # 처마 끝 들림
        y = oy
    for yy in range(y - 6, y):                                       # 상륜: 찰주와 보주
        c.put(15, yy, S[5]); c.put(16, yy, S[4])
    for dx, dy in ((14, 3), (17, 3), (13, 2)): c.put(dx, y - 2 - dy + 3, S[5])
    c.put(15, y - 7, S[6]); c.put(16, y - 7, S[5])
    outline(c)
    return c


def hongsalmun():
    """홍살문 64×48: 붉은 기둥 둘, 위에 가로 보와 붉은 살(창끝) 줄, 가운데 태극. 정면에서 마주 보는 문이라 윗면은 보 윗줄뿐."""
    c = Cv(4 * T, 3 * T)
    R = RGB['red']; S = RGB['stone']; B = RGB['dblue']; Wd = RGB['wood']
    ground_shadow(c, 34, 45, 28, 2.2, 70)
    for px in (6, 50):
        slab(c, px - 3, 40, 12, 5, 2, S, (6, 5), (5, 4, 3, 2))        # 주춧돌
        for y in range(8, 40):
            for x in range(px, px + 6):
                f = (x - px) / 5
                c.put(x, y, R[4] if f < 0.2 else (R[3] if f < 0.6 else (R[2] if f < 0.9 else R[1])))
        c.hl(px, px + 6, 8, R[5]); c.hl(px - 1, px + 7, 9, R[5])
    for yb, hh in ((10, 4), (22, 3)):                                 # 위 보·아래 보: 윗면 1줄 + 앞면
        for x in range(4, 58): c.put(x, yb, R[5])
        for y in range(yb + 1, yb + 1 + hh):
            for x in range(4, 58): c.put(x, y, R[3] if x < 30 else R[2])
    for x in range(10, 52, 3):                                        # 살: 위가 뾰족한 붉은 창끝
        for y in range(2, 10):
            c.put(x, y, R[4]); c.put(x + 1, y, R[2])
        c.put(x, 1, R[5]); c.put(x, 0, R[5])
    for y in range(11, 22):                                           # 가운데 태극(위 홍·아래 청)
        for x in range(26, 38):
            d = math.hypot(x - 31.5, y - 16.5)
            if d <= 5.5:
                c.put(x, y, R[4] if y < 16.5 else B[5])
                if y == 16 or y == 17: c.put(x, y, R[2] if x < 31 else B[3])
    outline(c)
    return c


def deungrong_mun():
    """청사초롱 문 80×64: 청색 기둥 둘 머리에 흰 등, 가운데 가로대에 붉은 초롱이 줄지어 걸린다(바람의나라 마을 어귀)."""
    c = Cv(5 * T, 4 * T)
    B = RGB['dblue']; R = RGB['red']; P = RGB['plaster']; Wd = RGB['wood']; S = RGB['stone']
    ground_shadow(c, 42, 61, 34, 2.4, 70)
    for px in (6, 66):
        slab(c, px - 3, 54, 12, 6, 2, S, (6, 5), (5, 4, 3, 2))
        for y in range(14, 54):
            for x in range(px, px + 6):
                f = (x - px) / 5
                c.put(x, y, B[5] if f < 0.2 else (B[4] if f < 0.6 else (B[3] if f < 0.9 else B[2])))
        for x in range(px - 1, px + 7):                               # 기둥머리 윗면 + 앞띠
            c.put(x, 12, B[6]); c.put(x, 13, B[5]); c.put(x, 14, B[2])
        for y in range(1, 11):                                        # 등: 흰 종이 몸통 + 붉은 뚜껑·받침
            for x in range(px - 1, px + 7):
                f = (x - px + 1) / 7
                c.put(x, y, P[5] if f < 0.4 else (P[4] if f < 0.75 else P[3]))
        c.hl(px - 2, px + 8, 0, R[3]); c.hl(px - 2, px + 8, 1, R[4]); c.hl(px - 2, px + 8, 10, R[2])
        c.vl(px + 2, 3, 10, P[2])
    for x in range(4, 76): c.put(x, 18, Wd[6]); c.put(x, 19, Wd[5]); c.put(x, 20, Wd[3])   # 가로대
    for x in range(14, 68, 8):                                         # 붉은 초롱: 위 끈·몸통(왼밝)·아래 술
        c.vl(x + 3, 21, 24, Wd[2])
        for y in range(24, 34):
            for xx in range(x, x + 7):
                f = (xx - x) / 6
                c.put(xx, y, R[5] if f < 0.25 else (R[4] if f < 0.65 else R[3]))
        c.hl(x, x + 7, 24, R[2]); c.hl(x, x + 7, 33, R[2])
        c.put(x + 2, 28, RGB['straw'][5]); c.put(x + 4, 28, RGB['straw'][5])
        c.vl(x + 3, 34, 38, R[3])
    outline(c)
    return c


def market_stall(seed=0):
    """장터 차일 48×48: 윗면(뒤가 밝고 가로로 줄무늬 천) + 앞 늘어진 천(파란 단 가장자리 물결) + 앞 기둥 둘 + 물건 놓은 좌판."""
    c = Cv(3 * T, 3 * T)
    P = RGB['plaster']; B = RGB['dblue']; Wd = RGB['wood']; R = RGB['red']; S = RGB['straw']; G = RGB['leaf']; E = RGB['earth']
    ground_shadow(c, 26, 46, 22, 2.2, 70)
    for px in (5, 41):                                                # 앞 기둥(원통)
        for y in range(20, 44):
            c.put(px, y, Wd[5]); c.put(px + 1, y, Wd[4]); c.put(px + 2, y, Wd[2])
    # 좌판: 윗면(널) + 앞면
    slab(c, 7, 34, 34, 5, 4, Wd, (6, 5), (5, 4, 3, 2))
    for x in range(9, 39, 5): c.vl(x, 34, 38, Wd[4])
    # 좌판 위 물건: 붉은 감 더미, 푸른 채소, 독
    for (gx, gy, tone) in ((11, 31, 4), (14, 32, 5), (17, 31, 4), (13, 29, 5)):
        c.rect(gx, gy, gx + 3, gy + 3, R[tone]); c.put(gx, gy, R[6] if tone == 5 else R[5])
    for gx in range(22, 29, 2):
        for gy in range(30, 34): c.put(gx, gy, G[4]); c.put(gx + 1, gy, G[3])
    for dx in range(31, 38):
        for dy in range(28, 34):
            hw = 3.4 - abs(dy - 31) * 0.4
            if abs(dx - 34) <= hw: c.put(dx, dy, E[5] if dx < 34 else E[3])
    c.hl(32, 37, 27, E[2])
    # 차일: 윗면(사다리꼴) y 2..14, 앞 천 y 14..22
    for y in range(2, 15):
        t = (y - 2) / 12
        x0 = int(10 - 8 * t); x1 = int(38 + 8 * t)
        for x in range(x0, x1):
            f = (x - x0) / max(1, x1 - x0)
            stripe = ((x + 3) // 6) % 2
            tone = (5 if y < 6 else 4) if stripe == 0 else 3
            if f > 0.7: tone = max(2, tone - 1)
            c.put(x, y, P[tone])
        c.put(x0, y, P[2]); c.put(x1 - 1, y, P[2])
    for y in range(15, 22):
        for x in range(2, 46):
            stripe = ((x + 1) // 6) % 2
            f = (x - 2) / 43
            tone = (4 if f < 0.5 else 3) if stripe == 0 else (3 if f < 0.5 else 2)
            c.put(x, y, P[tone])
    for x in range(2, 46):                                            # 파란 단과 물결 가장자리
        c.put(x, 15, B[5]); c.put(x, 16, B[4])
        wave = 2 if (x // 3) % 2 == 0 else 1
        for y in range(22 - wave, 22):
            c.put(x, y, B[3] if x < 24 else B[2])
        if (x // 3) % 2 == 0:
            c.put(x, 22, B[2])
    outline(c)
    return c


def wondumak():
    """원두막 48×64: 네 기둥 위의 높은 마루 + 낮은 초가 지붕, 마루 앞 가는 난간, 오른쪽 사다리."""
    c = Cv(3 * T, 4 * T)
    Wd = RGB['wood']; E = RGB['earth']; S = RGB['straw']
    ground_shadow(c, 26, 61, 22, 2.4, 70)
    for px in (4, 42):                                                # 기둥(뒤 두 개는 마루 뒤로 숨는다)
        for y in range(26, 60):
            c.put(px, y, Wd[5]); c.put(px + 1, y, Wd[4]); c.put(px + 2, y, Wd[2])
    for px in (13, 33):
        for y in range(26, 44):
            c.put(px, y, Wd[3]); c.put(px + 1, y, Wd[2])
    # 마루: 윗면(널) y 40..46, 앞 널 y 46..50, 아래 보
    for y in range(40, 47):
        for x in range(2, 46):
            c.put(x, y, Wd[6] if y == 40 else (Wd[5] if (x // 5) % 2 else Wd[4]))
    for y in range(47, 51):
        for x in range(2, 46): c.put(x, y, Wd[4] if x < 20 else (Wd[3] if x < 36 else Wd[2]))
    for x in range(2, 46): c.put(x, 51, SHADOW, 80); c.put(x, 52, SHADOW, 50)
    # 뒤 난간(마루 뒤쪽 가로대)과 앞 낮은 가로대
    for x in range(3, 45): c.put(x, 36, Wd[5]); c.put(x, 37, Wd[3])
    for x in (3, 22, 43): c.vl(x, 36, 41, Wd[3])
    # 사다리(오른쪽 앞): 두 가로 기둥 + 가로대
    for y in range(47, 61):
        c.put(33, y, Wd[5]); c.put(34, y, Wd[3]); c.put(40, y, Wd[4]); c.put(41, y, Wd[2])
    for y in range(49, 60, 3): c.hl(34, 40, y, Wd[5])
    # 지붕: 낮고 넓은 초가 방석
    roof = thatch3d.dome2(48, 24, seed=3)
    c.paste(roof, 0, 6)
    for x in range(4, 44):                                            # 처마 밑 그늘
        for y in range(30, 36):
            if c.a[y, x, 3] == 0:
                c.put(x, y, E[0] if y < 33 else E[1], 255 if y < 33 else 140)
    outline(c)
    return c


def shed_fill(cv, x0=16, x1=None, floor_y=71):
    """헛간: 열린 마루칸에 짚더미를 쌓는다(초가 'o' 칸 위)."""
    S = RGB['straw']
    if x1 is None: x1 = cv.w - 16
    cx = (x0 + x1) // 2
    hw = (x1 - x0) // 2 - 4
    for y in range(floor_y - 14, floor_y):
        t = (y - (floor_y - 14)) / 14
        w = int(hw * (0.35 + 0.65 * t ** 0.7))
        for x in range(cx - w, cx + w):
            f = (x - (cx - w)) / max(1, 2 * w)
            tone = 5 if f < 0.3 else (4 if f < 0.7 else 3)
            if rnd(x, y, 5) > 0.82: tone += 1
            if (x + y) % 5 == 0: tone -= 1
            cv.put(x, y, S[max(1, min(6, tone))])
    return cv


def pagoda_on_podium():
    return stone_pagoda()


def nugak():
    """누각 128×128: 석축 높은 단 위에 단청 정자. 가운데 돌계단이 땅까지 내려온다."""
    W, H = 8 * T, 8 * T
    c = Cv(W, H)
    S = RGB['stone']
    ground_shadow(c, W // 2 + 4, H - 3, W // 2 - 4, 3, 70)
    FY = 100                                                          # 단 앞면 시작 y
    for y in range(86, FY):                                           # 단 윗면
        for x in range(2, W - 2):
            c.put(x, y, S[5] if (x // 6 + y) % 4 else S[4])
    c.hl(2, W - 2, 86, S[6])
    pav_rows = K.house('pv', 5, 'ooooo', 'kkkkk', rows=3, dan=False, steps=(), hip=True)[:-1]
    pav = K.assemble(pav_rows, K.library(), post=lambda cv: (K.roof_baram(cv, 3, 'dg', wing=24), K.pavilion_open(cv, 5)))
    c.paste(pav, (W - pav.w) // 2, 12)
    stone_courses(c, 0, FY, W, H - 4, seed=21, ch=8)
    for x in range(W): c.put(x, FY, S[6]); c.put(x, FY + 1, S[2])
    # 가운데 돌계단: 위 윗면 3줄 + 앞 단 3개
    sx0, sx1 = W // 2 - 20, W // 2 + 20
    for k in range(4):
        yy = H - 4 - (k + 1) * 6
        inset = (3 - k) * 3
        for y in range(yy, yy + 6):
            for x in range(sx0 + inset, sx1 - inset):
                top = y < yy + 2
                f = (x - sx0) / (sx1 - sx0)
                c.put(x, y, S[6] if top and y == yy else (S[5] if top else (S[4] if f < 0.6 else S[3])))
        c.hl(sx0 + inset, sx1 - inset, yy + 5, S[2])
    for x in range(W): c.put(x, H - 4, S[2]); c.put(x, H - 3, SHADOW, 90)
    for y in range(H - 2, H):
        for x in range(4, W - 4): c.put(x, y, SHADOW, 60)
    outline(c)
    return c
