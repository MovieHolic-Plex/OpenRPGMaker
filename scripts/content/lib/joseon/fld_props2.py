"""사냥터(fld_) 물체 2: 표식(짐승 굴·뼈·광석·이정표)·야영지(모닥불·천막·건조대)·무덤·폐허 석탑·나무 변형."""
import math
from tk import *
from build import outline
from props5 import ell, shadow_ell, box, cyl
from trees import ground_shadow, trunk, bark_line
import trees as TR
from fld_props import boulder, _clean, ST, WD, ER, LF, PN, SW, PL, PS, RD, DB, DG, GW


# ---------------------------------------------------------------- 표식
def burrow():
    """짐승 굴 32×16: 흙무더기(윗면 밝고 앞면 어둡다) 한가운데 어두운 구멍, 둘레에 흩어진 흙과 발자국."""
    c = Cv(2 * T, T)
    ground_shadow(c, 18, 14, 13, 1.8, 65)
    ell(c, 16, 9.5, 13.5, 5.5, lambda x, y, u, v: ER[6] if (v < -0.3 and u < 0.2) else (ER[5] if (u < 0.3 and v < 0.35) else (ER[4] if u < 0.65 else ER[3])))
    ell(c, 15, 11, 6.6, 3.0, lambda x, y, u, v: ER[1] if v > -0.4 else ER[2])     # 구멍
    ell(c, 15, 11.8, 4.4, 1.7, lambda x, y, u, v: ER[0])
    for k in range(7):                                                                 # 파낸 흙 알갱이
        x, y = 3 + hsh(k, 2, 5) % 26, 3 + hsh(k, 3, 6) % 9
        c.put(x, y, ER[3] if k % 2 else ER[5])
    for x in (4, 7):
        c.put(x, 14, ER[2]); c.put(x + 1, 14, ER[2])                                   # 발자국
    return _clean(c)


def bones(kind=0):
    """뼈 16×16: 0 = 짐승 머리뼈, 1 = 갈비뼈."""
    c = Cv(T, T)
    ground_shadow(c, 9, 14, 6.5, 1.5, 60)
    if kind == 0:
        ell(c, 8, 8, 5.4, 4.2, lambda x, y, u, v: PL[6] if (v < -0.2 and u < 0.1) else (PL[5] if u < 0.45 else PL[4]))
        ell(c, 8, 12, 4.2, 2.0, lambda x, y, u, v: PL[4] if v < 0.1 else PL[3])        # 턱
        for ex in (5, 9):
            ell(c, ex + 0.5, 8, 1.6, 1.6, lambda x, y, u, v: PL[0])
        c.put(7, 11, PL[2]); c.put(8, 11, PL[2]); c.put(9, 11, PL[2])
        c.put(3, 13, PL[5]); c.put(4, 14, PL[4]); c.put(12, 13, PL[5]); c.put(13, 14, PL[3])   # 곁뼈
    else:                                                                              # 엇갈린 큰 뼈 둘
        for (xa, ya, xb, yb) in ((2, 12, 13, 7), (2, 7, 13, 12)):
            for i in range(12):
                x = xa + (xb - xa) * i / 11.0; y = ya + (yb - ya) * i / 11.0
                for dy in (0, 1, 2):
                    c.put(int(round(x)), int(round(y)) + dy, PL[6] if dy == 0 else (PL[5] if dy == 1 else PL[3]))
            for (ex, ey) in ((xa, ya), (xb, yb)):
                for dx, dy in ((-1, 0), (0, -1), (-1, 1), (0, 2), (1, 0), (1, 2)):
                    c.put(ex + dx, ey + dy, PL[5] if dy < 1 else PL[4])
    return _clean(c)


def ore(kind=0):
    """광석 노두. 0 = 구리빛 맥이 든 바위 16×16, 1 = 푸른 결정 32×16."""
    if kind == 0:
        c = Cv(T, T)
        ground_shadow(c, 9, 14, 7, 1.6, 70)
        boulder(c, 8, 9, 6.2, 5, 3, sharp=0.22)
        for (x, y) in ((5, 7), (9, 6), (7, 11), (11, 10)):
            c.put(x, y, PS[5]); c.put(x + 1, y, PS[4]); c.put(x, y + 1, PS[3]); c.put(x + 1, y + 1, PS[2])
        c.put(5, 6, PS[6]); c.put(9, 5, PS[6])
        return _clean(c)
    c = Cv(2 * T, T)
    ground_shadow(c, 18, 14, 13, 1.7, 70)
    boulder(c, 16, 11, 9.5, 4.6, 7, sharp=0.2)
    for (cx, base, h, w) in ((9, 11, 9, 3), (16, 10, 12, 4), (23, 11, 8, 3)):
        for k in range(h):
            half = max(0.6, (w / 2.0) * (1 - k / (h * 1.15)))
            for x in range(int(cx - half), int(cx + half) + 1):
                u = (x - cx) / max(half, 0.5)
                c.put(x, base - k, DB[6] if (u < -0.3 and k > h // 3) else (DB[5] if u < 0.4 else DB[3]))
        c.put(cx, base - h, DB[6])
    return _clean(c)


def signpost():
    """이정표 16×32: 말뚝 하나에 화살 모양 널 둘(위는 오른쪽, 아래는 왼쪽), 글줄 자국, 밑에 괴인 돌."""
    c = Cv(T, 2 * T)
    ground_shadow(c, 9, 30, 7, 1.6, 70)
    for y in range(6, 30):
        c.put(7, y, WD[5]); c.put(8, y, WD[4]); c.put(9, y, WD[2])
    for (y0, right) in ((7, True), (15, False)):
        for y in range(y0, y0 + 6):
            for x in range(2, 15):
                tip = (x >= 12 and right and abs(y - (y0 + 2.5)) > (15 - x) * 1.2 + 0.4) or (x <= 4 and not right and abs(y - (y0 + 2.5)) > (x - 1) * 1.2 + 0.4)
                if tip: continue
                t = WD[6] if y == y0 else (WD[5] if y < y0 + 3 else (WD[4] if y < y0 + 5 else WD[2]))
                c.put(x, y, t)
        for x in (5, 8, 11):
            c.put(x, y0 + 2, ER[1]); c.put(x + 1, y0 + 2, ER[1])
    for (x, y) in ((4, 29), (11, 29)):
        boulder(c, x, y - 1, 2.6, 1.8, x)
    return _clean(c)


# ---------------------------------------------------------------- 야영지
def campfire():
    """모닥불 16×16: 돌 고리 안에 엇갈린 장작, 위로 타오르는 불꽃(붉은 밑·주황·노란 끝)."""
    c = Cv(T, T)
    ground_shadow(c, 9, 14, 7, 1.7, 70)
    for ang in range(8):
        a = ang * math.pi / 4 + 0.2
        x, y = 8 + math.cos(a) * 6.0, 11 + math.sin(a) * 3.0
        boulder(c, x, y, 2.4, 1.9, ang, sharp=0.2)
    for (x0, y0, x1, y1) in ((4, 11, 12, 10), (4, 10, 12, 12)):
        for i in range(9):
            xx = int(round(x0 + (x1 - x0) * i / 8.0)); yy = int(round(y0 + (y1 - y0) * i / 8.0))
            c.put(xx, yy, WD[4] if i < 5 else WD[2]); c.put(xx, yy + 1, WD[2])
    flame = [(8, 2, PS[6]), (7, 3, PS[6]), (8, 3, PS[5]), (9, 3, PS[5]), (6, 4, PS[5]), (7, 4, PS[5]), (8, 4, PS[4]), (9, 4, PS[4]), (10, 4, PS[5]),
             (6, 5, PS[4]), (7, 5, PS[3]), (8, 5, PS[4]), (9, 5, PS[3]), (10, 5, PS[4]), (5, 6, PS[3]), (6, 6, RD[5]), (7, 6, PS[3]), (8, 6, PS[3]), (9, 6, RD[5]), (10, 6, PS[3]), (11, 6, RD[4]),
             (6, 7, RD[5]), (7, 7, RD[4]), (8, 7, PS[3]), (9, 7, RD[4]), (10, 7, RD[5]), (6, 8, RD[3]), (7, 8, RD[4]), (8, 8, RD[4]), (9, 8, RD[3]), (10, 8, RD[3])]
    for x, y, col in flame:
        c.put(x, y, col)
    for x, y in ((4, 9), (12, 9), (8, 1)):
        c.put(x, y, PS[6])
    return _clean(c)


def tent(w=3, h=2, seed=0, flag=False):
    """천막: 정면-위 3/4, 좌우 대칭 뿔 모양(왼쪽 면 밝고 오른쪽 면 어둡다), 가운데 어두운 출입구, 밧줄·말뚝, 꼭대기 깃대."""
    W, H = w * T, h * T
    c = Cv(W, H)
    ground_shadow(c, W // 2 + 4, H - 2, W // 2 - 4, 2.6, 70)
    ax, ay, base = W // 2, 4 if flag else 3, H - 4
    for y in range(ay, base + 1):
        half = (y - ay) / float(base - ay) * (W / 2 - 3)
        for x in range(int(round(ax - half)), int(round(ax + half)) + 1):
            u = (x - ax) / max(half, 1.0)
            seam = ((x - ax) + (y - ay) // 3 * 2) % 7 == 0
            if x < ax: t = ER[6] if u > -0.5 else ER[5]
            else: t = ER[4] if u < 0.5 else ER[3]
            if seam and abs(x - ax) > 1: t = (ER[5] if x < ax else ER[3])
            if rnd(x, y, seed + 3) < 0.07: t = ER[4] if x < ax else ER[2]
            c.put(x, y, t)
        c.put(ax, y, ER[2])                                       # 가운데 이음
    for y in range(base - 11, base + 1):                          # 출입구: 위로 좁아지는 어둠
        hw = 1 + (y - (base - 11)) * 0.38
        for x in range(int(ax - hw), int(ax + hw) + 1):
            c.put(x, y, ER[0] if y > base - 8 else ER[1])
    for x in range(3, W - 3):                                     # 밑단 어두운 띠
        c.put(x, base, ER[2]) if abs(x - ax) > 6 and c.a[base, x, 3] else None
    for y in range(max(0, ay - (7 if flag else 3)), ay):          # 꼭대기 기둥
        c.put(ax, y, WD[5]); c.put(ax + 1, y, WD[3])
    if flag:
        for k in range(5):
            c.put(ax + 2 + k, 1 + (k // 2), RD[5] if k < 3 else RD[3]); c.put(ax + 2 + k, 2 + (k // 2), RD[4])
    for (x0, side) in ((3, -1), (W - 4, 1)):                      # 말뚝과 밧줄
        c.put(x0 + side * 3, base + 2, WD[3]); c.put(x0 + side * 3, base + 1, WD[5])
        c.put(x0 + side * 1, base, SW[3]); c.put(x0 + side * 2, base + 1, SW[3])
    return _clean(c)


def drying_rack():
    """가죽 건조대 32×32: 두 기둥 사이 가로대에 짐승 가죽 셋이 걸려 있다."""
    c = Cv(2 * T, 2 * T)
    ground_shadow(c, 18, 30, 14, 1.9, 70)
    for x in (5, 25):
        for y in range(5, 30):
            c.put(x, y, WD[5]); c.put(x + 1, y, WD[4]); c.put(x + 2, y, WD[2])
    for x in range(3, 30):
        c.put(x, 6, WD[6]); c.put(x, 7, WD[4]); c.put(x, 8, WD[2])
    for (x0, wd_, ln, col) in ((8, 5, 14, ER), (14, 5, 17, SW), (20, 4, 12, ER)):
        for y in range(9, 9 + ln):
            k = (y - 9) / float(ln)
            half = wd_ / 2.0 * (1 - 0.35 * k * k) + (0.8 if (y % 5 == 0) else 0)
            for x in range(int(x0 + wd_ / 2.0 - half), int(x0 + wd_ / 2.0 + half) + 1):
                u = (x - (x0 + wd_ / 2.0)) / max(half, 1)
                if col is SW:
                    t = SW[5] if u < -0.2 else (SW[4] if u < 0.4 else SW[3])
                else:
                    t = ER[5] if u < -0.2 else (ER[4] if u < 0.4 else ER[3])
                if rnd(x, y, 7) < 0.12: t = ER[2] if col is ER else SW[2]
                c.put(x, y, t)
    return _clean(c)


# ---------------------------------------------------------------- 무덤·폐허
def grave(kind=0):
    """무덤 32×32: 봉분(윗면 풀·앞 가장자리 흙) 뒤에 비석이나 나무 표지. 0 = 돌 비석, 1 = 나무 표지."""
    c = Cv(2 * T, 2 * T)
    ground_shadow(c, 18, 30, 14, 2.0, 70)
    # 뒤 표지
    if kind == 0:
        for y in range(6, 20):
            for x in range(11, 21):
                if y < 9 and ((x - 15.5) ** 2 / 25.0 + (y - 9) ** 2 / 9.0 > 1): continue
                f = (x - 11) / 9.0
                c.put(x, y, ST[6] if f < 0.15 else (ST[5] if f < 0.5 else (ST[4] if f < 0.85 else ST[3])))
        for y in (11, 13, 15):
            c.put(14, y, ST[2]); c.put(15, y, ST[2]); c.put(16, y, ST[2]); c.put(17, y, ST[3])
        c.put(12, 10, LF[4]); c.put(12, 11, LF[3])
    else:
        for y in range(7, 21):
            c.put(15, y, WD[5]); c.put(16, y, WD[4]); c.put(17, y, WD[2])
        for x in range(11, 22):
            c.put(x, 11, WD[6]); c.put(x, 12, WD[4]); c.put(x, 13, WD[2])
        c.put(15, 7, WD[6]); c.put(16, 7, WD[5])
    for y in range(15, 27):                                       # 봉분: 위가 둥글고 밑은 평평한 돔
        t = (y - 15) / 11.0
        hw = 13.0 * math.sqrt(max(0.0, 1 - (1 - t) ** 2.4)) if t < 1 else 13.0
        for x in range(int(16 - hw), int(16 + hw) + 1):
            u = (x - 16) / max(hw, 1.0)
            if y >= 24:
                col = ER[4] if u < 0.1 else ER[3]
                if y == 26: col = ER[2]
            else:
                col = (LF[6] if (u < -0.35 and y < 19) else (LF[5] if u < 0.15 else LF[4])) if u < 0.55 else LF[3]
            c.put(x, y, col)
    for k in range(10):
        x, y = 6 + hsh(k, 3, 3) % 20, 17 + hsh(k, 4, 3) % 6
        if c.a[y, x, 3] and c.a[y, x, 1] > 100: c.put(x, y, LF[3] if k % 2 else LF[6])
    return _clean(c)


def tombstone():
    """묘비 16×32: 3단 받침돌 위에 기울지 않은 좁은 비석, 이끼 낀 윗머리, 앞면에 지워진 글줄."""
    c = Cv(T, 2 * T)
    ground_shadow(c, 9, 30, 7, 1.5, 70)
    box(c, 2, 29, 12, 3, 3, ST, (6, 5), (4, 3, 2, 1))
    box(c, 3, 26, 10, 2, 2, ST, (6, 5), (5, 4, 3, 2))
    for y in range(6, 24):
        for x in range(4, 12):
            if y < 9 and ((x - 7.5) ** 2 / 16.0 + (y - 9) ** 2 / 9.0 > 1): continue
            f = (x - 4) / 7.0
            c.put(x, y, ST[6] if f < 0.15 else (ST[5] if f < 0.5 else (ST[4] if f < 0.85 else ST[3])))
    for y in range(11, 22, 3):
        c.put(6, y, ST[2]); c.put(7, y, ST[3]); c.put(9, y, ST[2])
    for x, y in ((4, 8), (5, 7), (6, 6), (5, 9)):
        if c.a[y, x, 3]: c.put(x, y, PN[4] if (x + y) % 2 else PN[3])
    return _clean(c)


def ruin_pagoda():
    """폐허 석탑 32×48: 기단과 아랫 두 층만 남고 윗층은 부서졌다. 떨어진 돌조각이 곁에 놓이고 이끼가 꼈다."""
    c = Cv(2 * T, 3 * T)
    ground_shadow(c, 18, 46, 14, 2.2, 70)
    box(c, 3, 44, 26, 4, 3, ST, (6, 5), (4, 3, 2, 1))             # 기단(아래)
    box(c, 7, 41, 18, 3, 3, ST, (6, 5), (5, 4, 3, 2))             # 기단(위)
    box(c, 10, 33, 12, 3, 8, ST, (6, 5), (5, 4, 3, 2))            # 1층 몸돌
    box(c, 5, 30, 22, 4, 3, ST, (6, 5), (5, 4, 3, 2))             # 1층 옥개석
    box(c, 11, 24, 10, 3, 6, ST, (6, 5), (5, 4, 3, 2))            # 2층 몸돌
    for y in range(17, 22):                                       # 윗부분: 비스듬히 부서진 옥개석 조각
        for x in range(8, 25):
            if (x - 8) * 0.55 + (y - 17) * 1.0 < 4.2 + 0.0:
                pass
    box(c, 8, 20, 8, 3, 3, ST, (6, 5), (5, 4, 3, 2))              # 2층 옥개석(왼쪽 반만 남음)
    for x, y in ((9, 15), (10, 14), (12, 14), (13, 15), (15, 16)):
        c.put(x, y, ST[5]); c.put(x, y + 1, ST[3])
    boulder(c, 26, 44, 3.4, 2.4, 3)                               # 떨어진 돌조각
    boulder(c, 5, 45, 2.6, 1.9, 5)
    boulder(c, 23, 38, 3.0, 2.2, 8)
    for x, y in ((6, 31), (7, 31), (10, 32), (22, 33), (12, 40), (13, 40), (24, 42), (11, 25), (10, 21)):
        c.put(x, y, PN[4]); c.put(x + 1, y, PN[3])
    return _clean(c)


def cairn():
    """돌탑 16×16: 크기가 줄어드는 납작한 돌 넷을 쌓았다(사냥꾼 표식)."""
    c = Cv(T, T)
    ground_shadow(c, 9, 14, 6, 1.5, 70)
    for (cx, cy, rx, ry, sd) in ((8, 12, 6, 2.6, 1), (8, 9, 4.6, 2.3, 2), (8, 6.5, 3.4, 2, 3), (8, 4, 2.2, 1.6, 4)):
        boulder(c, cx, cy, rx, ry, sd, sharp=0.12)
    return _clean(c)


# ---------------------------------------------------------------- 나무 변형
def dead_tree(seed=0):
    """고목 48×64: 잎이 다 진 굵은 줄기가 갈라지고 곁가지·잔가지가 얽힌다. 가지 끝에 몇 장 남은 잎."""
    W, H = 48, 64
    c = Cv(W, H)
    ground_shadow(c, 24, 60, 15, 2.8, 70)
    trunk(c, 24, 26, 61, 10, flare=6, lean=0.02, seed=seed + 20)
    g = 1 if seed % 2 == 0 else -1
    X = lambda dx: 24 + dx * g
    bark_line(c, [(X(-3), 30), (X(-9), 20), (X(-15), 12), (X(-17), 3)], 7, 2, seed)
    bark_line(c, [(X(3), 30), (X(9), 22), (X(16), 15), (X(19), 8)], 6, 2, seed)
    bark_line(c, [(X(0), 28), (X(1), 17), (X(-1), 6)], 5, 2, seed)
    bark_line(c, [(X(-9), 20), (X(-5), 12), (X(-6), 4)], 4, 1.5, seed)
    bark_line(c, [(X(-14), 12), (X(-21), 9)], 3, 1.5, seed)
    bark_line(c, [(X(9), 22), (X(12), 11), (X(11), 4)], 4, 1.5, seed)
    bark_line(c, [(X(15), 16), (X(21), 20)], 3, 1.5, seed)
    for (x, y) in ((X(-17), 4), (X(19), 9), (X(-6), 5), (X(-21), 10)):
        for dx, dy in ((0, 0), (1, 0), (0, 1), (-1, 1)):
            c.put(x + dx, y + dy, LF[2] if (dx + dy) else LF[3])
    return _clean(c)


def _paste_safe(dst, src, x, y):
    """불투명 화소만 덮고, 반투명(그림자) 화소는 아래가 비었을 때만 둔다(알파 섞임이 허용 밖 색을 만들지 않게)."""
    for yy in range(src.h):
        for xx in range(src.w):
            p = src.a[yy, xx]
            X, Y = x + xx, y + yy
            if p[3] == 0 or not (0 <= X < dst.w and 0 <= Y < dst.h):
                continue
            if p[3] == 255 or dst.a[Y, X, 3] == 0:
                dst.a[Y, X] = p


def groves():
    """군락: 큰 나무 둘이 겹쳐 선 덩어리. 활엽(느티+감) 6×5, 침엽(소나무 둘) 6×5."""
    a = Cv(6 * T, 5 * T)
    t1, t2, t3 = TR.zelkova(11, 0, 2), TR.persimmon_tree(7, 1), TR.zelkova(12, 1, 0)
    _paste_safe(a, t1, 0, 0); _paste_safe(a, t2, 52, 14); _paste_safe(a, t3, 24, 0)
    b = Cv(6 * T, 5 * T)
    p1, p2 = TR.pine(7, 0, 0), TR.pine(14, 1, 0)
    _paste_safe(b, p1, 0, 0); _paste_safe(b, p2, 30, 0)
    s = TR.small_tree('p', 1)
    _paste_safe(b, s, 66, 32)
    return a, b


def objects():
    d = {}
    d['fld_burrow'] = burrow()
    d['fld_bones_a'] = bones(0)
    d['fld_bones_b'] = bones(1)
    d['fld_ore_a'] = ore(0)
    d['fld_ore_b'] = ore(1)
    d['fld_signpost'] = signpost()
    d['fld_campfire'] = campfire()
    d['fld_tent_a'] = tent(3, 2, 1)
    d['fld_tent_b'] = tent(4, 3, 2, flag=True)
    d['fld_rack'] = drying_rack()
    d['fld_grave_a'] = grave(0)
    d['fld_grave_b'] = grave(1)
    d['fld_tombstone'] = tombstone()
    d['fld_ruin_pagoda'] = ruin_pagoda()
    d['fld_cairn'] = cairn()
    for i, (sd, sh, shp) in enumerate(((10, 0, 0), (11, 1, 1), (12, -1, 2), (13, 0, 3))):
        d['fld_zelkova_' + 'abcd'[i]] = TR.zelkova(sd, sh, shp)
    for i, (sd, sh, shp) in enumerate(((7, 0, 0), (11, 0, 1), (12, 0, 1), (14, 0, 0))):
        d['fld_pine_' + 'abcd'[i]] = TR.pine(sd, sh, shp)
    d['fld_dead_a'] = dead_tree(0)
    d['fld_dead_b'] = dead_tree(1)
    ga, gb = groves()
    d['fld_grove_broad'] = ga
    d['fld_grove_pine'] = gb
    return d


if __name__ == '__main__':
    import sys
    from fld_props import sheet as _s
    import fld_props
    o = objects()
    fld_props.objects = lambda: o
    names = sys.argv[2].split(',') if len(sys.argv) > 2 else list(o)
    _s(names, sys.argv[1], int(sys.argv[3]) if len(sys.argv) > 3 else 3)
    print('violations', len(VIOLATIONS))
