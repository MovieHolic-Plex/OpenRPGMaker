"""바람의나라 연구에서 뽑은 구조물들 — 성문·성벽·누각·홍살문·등롱문·석탑·장터 차일·원두막·헛간.

모두 3/4 문법: 덩어리마다 윗면(밝음) + 앞면(왼쪽 밝음 → 오른쪽 어두움) + 땅 그림자. 빛은 왼쪽 위.
돌은 한 장씩 쌓은 줄(코스)로 그리고 줄마다 이음매를 어긋낸다(BARAM_STUDY: 어두운 막돌·밝은 각진 돌).
"""
import math
from tk import *
from build import outline
from trees import ground_shadow
from props4 import slab
from props5 import box
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
            if q > 0.85: tone += 1
            elif q < 0.12 and tone > 3: tone -= 1
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
        for x in range(0, W):
            c.put(x, y, S[5] if (x // 6 + y) % 5 else S[4])
    c.hl(0, W, 66, S[6])
    for y in range(70, 78):                                            # 누상 바닥(밝은 윗면) — 기둥발이 여기에 붙는다
        for x in range(10, W - 10):
            c.put(x, y, S[6] if y == 70 else S[5])
    # 누각(벽 없는 정자 + 청록 지붕) — 아래 플린스 줄은 뺀다
    pav_rows = K.house('pv', 5, 'ooooo', 'kkkkk', rows=3, dan=False, steps=(), hip=True)[:-1]
    pav = K.assemble(pav_rows, K.library(), post=lambda cv: (K.roof_baram(cv, 3, 'giwa', wing=24), K.pavilion_open(cv, 5)), finish=False)
    c.paste(pav, (W - pav.w) // 2, 0)
    merlons(c, 3, W - 3, 77, step=16, w=10)
    # 앞면: 아래가 넓은 사다리꼴
    inset = 0
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


def fort_wall_h(var=0):
    """성벽 한 칸(16×80): 문루 받침과 같은 높이로 이어 붙는다 — 걷는 길 윗면(앞쪽 밝음) + 여장 직육면체 + 앞 돌 쌓기. 변형(var) 셋을 번갈아 쓴다.
    좌표는 fort_gate 의 (y-64)와 같다: 윗면 2..19, 여장 윗면 11..12·앞면 13..19, 앞 돌면 20..79."""
    c = Cv(T, 5 * T)
    S = RGB['stone']
    for y in range(2, 20):
        for x in range(T):
            c.put(x, y, S[5] if ((x + 16 * var) // 6 + y) % 5 else S[4])
    c.hl(0, T, 2, S[6])
    slab(c, 3, 13, 10, 5, 2, S, (6, 5), (5, 4, 3, 2))
    for y in range(20, 22):
        for x in range(T): c.put(x, y, S[6] if y == 20 else S[2])
    stone_courses(c, 0, 20, T, 5 * T, seed=5 + 3 * var, ch=8)
    for x in range(T): c.put(x, 5 * T - 1, SHADOW, 90)
    return c


def fort_wall_end(side='l'):
    """성벽 끝(개울·성문 옆에서 끊기는 쪽): 앞 돌면이 아래로 갈수록 바깥으로 벌어진 비탈."""
    c = fort_wall_h(0)
    for y in range(c.h):
        cut = 4 if y < 20 else max(0, 4 - (y - 20) // 12)
        for k in range(cut):
            x = k if side == 'l' else T - 1 - k
            c.a[y, x, 3] = 0
    return c


def fort_wall_sluice():
    """수문 성벽 64×80(4칸): 개울이 지나는 홍예 구멍(투명, 아래 물이 비친다)을 낸 성벽. 윗면·여장·앞 돌 쌓기는 fort_wall_h 와 같은 높이."""
    c = Cv(4 * T, 5 * T)
    for i in range(4):
        c.paste(fort_wall_h(i % 3), i * T, 0)
    S = RGB['stone']
    cx, R, yc, ybase = 31.5, 22, 52, 5 * T
    ring_w = 4
    for y in range(30, ybase):
        for x in range(4 * T):
            dx = x - cx; yy = y - yc
            d2 = dx * dx + yy * yy
            inside = (d2 <= R * R) if yy < 0 else (abs(dx) <= R)
            ring = (d2 <= (R + ring_w) ** 2) if yy < 0 else (abs(dx) <= R + ring_w)
            if inside:
                c.a[y, x, 3] = 0
            elif ring and not (yy >= 0 and False):
                seg = int(math.atan2(yy, dx) * 9) if yy < 0 else y // 7
                col = S[6] if seg % 2 else S[5]
                if dx > R * 0.3 and yy >= -R * 0.5: col = S[4] if seg % 2 else S[3]
                if (yy < 0 and d2 > (R + ring_w - 1) ** 2) or (yy >= 0 and abs(dx) > R + ring_w - 1): col = S[2]
                c.put(x, y, col)
    for x in range(4 * T):
        if c.a[ybase - 1, x, 3]: c.put(x, ybase - 1, S[2])
    return c


def stone_pagoda():
    """삼층 석탑 32×48: 이중 기단(하대·상대, 모서리 우주) 위에 탑신+옥개석이 1:0.83:0.67 로 줄어들며 세 번, 상륜은 노반·복발·보주."""
    c = Cv(2 * T, 3 * T)
    S = RGB['stone']
    ground_shadow(c, 18, 46, 14, 2.0, 70)
    def block(x0, ytop, w, top, face):
        slab(c, x0, ytop, w, face, top, S, (6, 5), (5, 4, 3, 2))
        c.vl(x0, ytop + top, ytop + top + face, S[6])              # 모서리 우주(밝은 왼쪽 모서리 줄)
        c.vl(x0 + w - 1, ytop + top, ytop + top + face, S[2])
    block(2, 38, 28, 3, 4)          # 하대 (y 38..44)
    block(5, 33, 22, 2, 3)          # 상대 (y 33..37)
    y = 33
    for roof_w, body_h in ((24, 5), (20, 4), (16, 4)):
        body_w = roof_w - 10
        bx = 16 - body_w // 2
        y -= body_h
        for yy in range(y, y + body_h):                              # 탑신: 왼쪽 밝음, 모서리 우주
            for x in range(bx, bx + body_w):
                f = (x - bx) / max(1, body_w - 1)
                c.put(x, yy, S[5] if f < 0.3 else (S[4] if f < 0.75 else S[3]))
            c.put(bx, yy, S[6]); c.put(bx + body_w - 1, yy, S[2])
        oy = y - 5                                                   # 옥개석: 윗사면 2줄 + 앞 처마 3줄(양끝 1px 반전)
        ox = 16 - roof_w // 2
        for k, ins in enumerate((4, 1)):
            for x in range(ox + ins, ox + roof_w - ins):
                f = (x - ox) / max(1, roof_w - 1)
                c.put(x, oy + k, S[6] if f < 0.55 else S[5])
        for k in range(3):
            for x in range(ox, ox + roof_w):
                f = (x - ox) / max(1, roof_w - 1)
                tone = 5 if f < 0.3 else (4 if f < 0.65 else 3)
                c.put(x, oy + 2 + k, S[tone] if k < 2 else S[2])
        for k, ins in enumerate((2, 4)):                                   # 층급받침: 처마 밑 계단식 두 단
            for x in range(ox + ins, ox + roof_w - ins):
                if c.a[oy + 5 + k, x, 3] == 0: c.put(x, oy + 5 + k, S[3] if k == 0 else S[2])
        c.put(ox, oy + 1, S[6]); c.put(ox + roof_w - 1, oy + 1, S[5])     # 처마 끝 반전
        y = oy
    # 상륜: 노반(사각) → 복발(반구) → 보주
    for x in range(13, 19): c.put(x, y - 1, S[5] if x < 16 else S[3])
    for k, (a, b) in enumerate(((14, 18), (13, 19))):
        for x in range(a, b): c.put(x, y - 3 + k, S[6] if x < 16 else S[4])
    c.vl(15, y - 6, y - 3, S[5]); c.vl(16, y - 6, y - 3, S[3])
    c.put(15, y - 8, S[6]); c.put(16, y - 8, S[5]); c.put(15, y - 7, S[5]); c.put(16, y - 7, S[4])
    outline(c)
    return c


def hongsalmun():
    """홍살문 64×48: 가는 붉은 기둥 둘, 가는 인방 두 줄, 인방 위를 덮는 붉은 홍살(창살 대), 가운데 태극. 정면 문이라 윗면은 인방 윗줄뿐."""
    c = Cv(5 * T, 3 * T)
    R = RGB['red']; S = RGB['stone']; B = RGB['dblue']
    ground_shadow(c, 42, 45, 28, 2.2, 70)
    for px in (14, 60):
        slab(c, px - 3, 40, 10, 5, 2, S, (6, 5), (5, 4, 3, 2))        # 주춧돌
        for y in range(10, 40):
            for x in range(px, px + 4):
                f = (x - px) / 3
                c.put(x, y, R[4] if f < 0.3 else (R[3] if f < 0.7 else R[2]))
        c.hl(px, px + 4, 10, R[5])
    for yb in (12, 24):                                                # 인방: 윗면 1줄 + 앞 2줄
        for x in range(14, 64): c.put(x, yb, R[5]); c.put(x, yb + 1, R[3] if x < 38 else R[2]); c.put(x, yb + 2, R[2])
    for x in range(16, 62, 3):                                          # 홍살: 위 인방 위로 솟은 뾰족한 살
        for y in range(3, 12):
            c.put(x, y, R[4]); c.put(x + 1, y, R[2])
        c.put(x, 2, R[5]); c.put(x, 1, R[5])
    for y in range(14, 24):                                            # 인방 사이 가는 살
        for x in range(16, 62, 6): c.put(x, y, R[3])
    cx, cy, rr = 40.0, 19.0, 5.0                                       # 태극: 위 홍·아래 청, 왼 작은 원 홍·오른 작은 원 청 → S 곡선
    for y in range(int(cy - rr) - 1, int(cy + rr) + 2):
        for x in range(int(cx - rr) - 1, int(cx + rr) + 2):
            px, py = x + 0.5, y + 0.5
            d = math.hypot(px - cx, py - cy)
            if d > rr: continue
            col = R[4] if py < cy else B[5]
            if math.hypot(px - (cx - rr / 2), py - cy) <= rr / 2: col = R[4]
            if math.hypot(px - (cx + rr / 2), py - cy) <= rr / 2: col = B[5]
            if d > rr - 1.0: col = R[2]
            c.put(x, y, col)
    outline(c)
    return c


def deungrong_mun():
    """청사초롱 문(잔치·장터 어귀) 80×64: 납작한 주두(네모 갓)를 얹은 청색 기둥 둘, 가로대에 청사초롱 다섯. 정면 문."""
    c = Cv(4 * T, 4 * T)
    B = RGB['dblue']; R = RGB['red']; Wd = RGB['wood']; S = RGB['stone']; St = RGB['straw']
    ground_shadow(c, 36, 61, 28, 2.4, 70)
    for px in (6, 52):
        slab(c, px - 3, 54, 12, 6, 2, S, (6, 5), (5, 4, 3, 2))
        for y in range(14, 54):
            for x in range(px, px + 6):
                f = (x - px) / 5
                c.put(x, y, B[5] if f < 0.2 else (B[4] if f < 0.6 else (B[3] if f < 0.9 else B[2])))
        slab(c, px - 3, 8, 12, 4, 3, Wd, (6, 5), (5, 4, 3, 2))          # 주두: 납작한 네모 갓(윗면+앞면)
    for x in range(4, 60): c.put(x, 17, Wd[6]); c.put(x, 18, Wd[5]); c.put(x, 19, Wd[3])   # 가로대
    for x in range(14, 48, 8):                                          # 청사초롱: 길쭉한 원통 — 위아래 청 띠 + 홍색 몸통 + 손잡이 고리
        c.vl(x + 2, 20, 23, Wd[2])
        c.hl(x, x + 5, 23, B[4]); c.hl(x, x + 5, 24, B[3])
        for y in range(25, 38):
            for xx in range(x, x + 5):
                f = (xx - x) / 4
                c.put(xx, y, R[5] if f < 0.25 else (R[4] if f < 0.65 else R[3]))
        c.vl(x + 2, 29, 33, R[2])                                       # 글자 한 획
        c.hl(x, x + 5, 38, B[3]); c.hl(x, x + 5, 39, B[2])
        c.vl(x + 2, 40, 43, B[4])
    outline(c)
    return c


def market_stall(thatch=False, ware=0):
    """장터 가판 48×48: 흰 광목 차일(윗면 밝음 + 앞 늘어진 천, 줄무늬·술 없음) 또는 초가 덮개, 대나무 장대, 좌판에 감·채소·독."""
    c = Cv(3 * T, 3 * T)
    P = RGB['plaster']; Wd = RGB['wood']; R = RGB['red']; S = RGB['straw']; G = RGB['leaf']; E = RGB['earth']
    ground_shadow(c, 26, 46, 22, 2.2, 70)
    for px in (5, 41):                                                # 대나무 장대 기둥(마디)
        for y in range(15, 44):
            c.put(px, y, S[5]); c.put(px + 1, y, S[4]); c.put(px + 2, y, S[2])
            if y % 7 == 3: c.hl(px, px + 3, y, S[1])
    slab(c, 7, 36, 34, 4, 4, Wd, (6, 5), (5, 4, 3, 2))
    for x in range(9, 39, 5): c.vl(x, 36, 40, Wd[4])
    if ware == 0:                                                     # 감·채소·독
        for (gx, gy, tone) in ((11, 31, 4), (14, 32, 5), (17, 31, 4), (13, 29, 5)):
            c.rect(gx, gy, gx + 3, gy + 3, R[tone]); c.put(gx, gy, R[6] if tone == 5 else R[5])
        for gx in range(22, 29, 2):
            for gy in range(30, 34): c.put(gx, gy, G[4]); c.put(gx + 1, gy, G[3])
        for dx in range(31, 38):
            for dy in range(28, 34):
                hw = 3.4 - abs(dy - 31) * 0.4
                if abs(dx - 34) <= hw: c.put(dx, dy, E[5] if dx < 34 else E[3])
        c.hl(32, 37, 27, E[2])
    elif ware == 1:                                                   # 포목: 접어 쌓은 천 세 더미 + 걸린 천
        for k, (col, wd) in enumerate(((R, 8), (RGB['dblue'], 9), (P, 8))):
            x0 = 10 + k * 11
            for yy in range(31 - k % 2, 36):
                for xx in range(x0, x0 + wd):
                    t = 6 if yy == 31 - k % 2 else (5 if xx < x0 + wd // 2 else 4)
                    c.put(xx, yy, col[min(len(col) - 1, t)])
                if yy in (33, 35): c.hl(x0, x0 + wd, yy, col[2])
    else:                                                             # 옹기·곡식 자루
        for k in range(3):
            cx0 = 12 + k * 6
            for yy in range(29, 36):
                w = 3 - abs(yy - 32) // 2
                for xx in range(cx0 - w, cx0 + w + 1):
                    c.put(xx, yy, E[5] if xx < cx0 else E[3])
            c.hl(cx0 - 2, cx0 + 3, 29, E[2])
        for k in range(3):
            x0 = 30 + k * 5
            for yy in range(30, 36):
                for xx in range(x0, x0 + 4):
                    c.put(xx, yy, S[6] if xx == x0 else (S[5] if xx < x0 + 3 else S[3]))
            c.hl(x0, x0 + 4, 30, S[2])
    if thatch:
        c.paste(thatch3d.dome3(48, 20, seed=5), 0, 2)
    else:
        for y in range(2, 11):                                            # 차일 윗면: 뒤가 좁고 앞이 넓은 사다리꼴, 가장 밝고 이음 한 줄
            t = (y - 2) / 8
            x0 = int(9 - 7 * t); x1 = int(39 + 7 * t)
            for x in range(x0, x1):
                c.put(x, y, P[6] if y < 5 else P[5])
            c.put(x0, y, P[4]); c.put(x1 - 1, y, P[3])
            if y == 6: c.hl(x0 + 1, x1 - 1, y, P[4])
        for y in range(11, 21):
            for x in range(2, 46):
                f = (x - 2) / 43
                tone = 4 if f < 0.45 else (3 if f < 0.8 else 2)
                if y == 11: tone = 5
                if y >= 19: tone = max(1, tone - 1)
                c.put(x, y, P[tone])
        for x in range(5, 44, 12):                                    # 새끼줄 묶음 매듭
            c.vl(x, 11, 21, S[2]); c.vl(x + 1, 11, 21, S[3])
    outline(c)
    return c


def wondumak():
    """원두막 48×64: 굵기 같은 기둥 넷, 사방이 트인 높은 마루(윗면이 넓게 보임), 마루 뒤 어두운 칸막이 없이 배경이 비침, 낮은 초가 지붕, 사다리."""
    c = Cv(3 * T, 4 * T)
    Wd = RGB['wood']; E = RGB['earth']; S = RGB['straw']
    from props5 import shadow_ell
    shadow_ell(c, 28, 60.5, 21, 2.2, 70)
    for px in (4, 18, 28, 42):
        back = px in (18, 28)
        for y in range(30, 60 if not back else 52):
            c.put(px, y, Wd[4 if back else 5]); c.put(px + 1, y, Wd[3 if back else 4]); c.put(px + 2, y, Wd[1 if back else 2])
    for x in range(3, 45): c.put(x, 56, Wd[3])                       # 아래 가로 도리
    for y in range(36, 47):                                           # 마루 윗면: 11줄(뒤쪽 어둡고 앞쪽 밝다)
        for x in range(2, 46):
            tone = 6 if y >= 45 else (5 if (x // 5) % 2 else 4)
            if y < 39: tone = 3 if (x // 5) % 2 else 2
            c.put(x, y, Wd[tone])
    for y in range(47, 50):                                           # 앞 두께면
        for x in range(2, 46): c.put(x, y, Wd[4] if x < 20 else (Wd[3] if x < 34 else Wd[2]))
    for x in range(2, 46): c.put(x, 50, SHADOW, 90)
    for x in (3, 44):                                                 # 앞 난간 동자기둥(양끝만, 사이는 트임)
        for y in range(38, 47): c.put(x, y, Wd[5]); c.put(x + 1, y, Wd[3])
        c.put(x, 37, Wd[6]); c.put(x + 1, 37, Wd[5])
    for x in range(3, 45): c.put(x, 37, Wd[5]) if 3 < x < 44 else None
    for y in range(47, 61):                                           # 사다리
        c.put(33, y, Wd[5]); c.put(34, y, Wd[3]); c.put(40, y, Wd[4]); c.put(41, y, Wd[2])
    for y in range(49, 60, 3): c.hl(34, 40, y, Wd[5])
    c.paste(thatch3d.dome3(48, 26, seed=3), 0, 4)
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
    """누각 128×128: 석축 단 위에 높은 마루를 얹은 2층 누각 — 마루 밑에 누하주(굵은 붉은 기둥)가 보이고 난간을 두르며, 가운데 돌계단이 땅까지 내려온다."""
    W, H = 8 * T, 8 * T
    c = Cv(W, H)
    S = RGB['stone']; R = RGB['red']; Wd = RGB['wood']; E = RGB['earth']
    ground_shadow(c, W // 2 + 4, H - 3, W // 2 - 4, 3, 70)
    FY = 100
    for y in range(92, FY):                                           # 단 윗면
        for x in range(2, W - 2):
            c.put(x, y, S[5] if (x // 6 + y) % 4 else S[4])
    c.hl(2, W - 2, 92, S[6])
    pav_rows = K.house('pv', 5, 'ooooo', 'kkkkk', rows=3, dan=False, steps=(), hip=True)[:-1]
    pav = K.assemble(pav_rows, K.library(), post=lambda cv: (K.roof_baram(cv, 3, 'giwa', wing=24), K.pavilion_open(cv, 5)), finish=False)
    c.paste(pav, (W - pav.w) // 2, 6)
    for y in range(76, 90):                                          # 계단 위 난간 개구부: 가운데 두 기둥 사이를 비워 출입구로
        for x in range(W // 2 - 10, W // 2 + 10):
            if c.a[y, x, 3] and tuple(c.a[y, x, :3]) in {RGB['wood'][5], RGB['wood'][3], RGB['wood'][4]}: c.a[y, x, :3] = RGB['earth'][0]
    # 누하주: 마루 밑(정자 마루 y≈86 아래)부터 단까지 굵은 붉은 기둥 여섯 + 사이 어두운 그늘
    x0 = (W - pav.w) // 2 + 16
    for y in range(82, 94):
        for x in range(x0, x0 + 80): c.put(x, y, E[0])
    for i in range(6):
        px = x0 + i * 16 - 2
        for y in range(80, 93):
            for dx in range(5):
                c.put(px + dx, y, R[4] if dx == 1 else (R[3] if dx < 3 else R[2]))
    for x in range(x0 - 6, x0 + 86): c.put(x, 80, Wd[6]); c.put(x, 81, Wd[5]); c.put(x, 82, Wd[3])      # 마루판 앞 가장자리와 밑 보
    stone_courses(c, 0, FY, W, H - 4, seed=21, ch=8)
    for x in range(W): c.put(x, FY, S[6]); c.put(x, FY + 1, S[2])
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
    outline(c)
    return c
