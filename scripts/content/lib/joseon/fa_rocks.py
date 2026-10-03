"""사냥터 바위류 조각: 바위 3~5종·큰 바위 덩이·광석·돌탑·폐허 석탑·무덤·동굴 입구·동굴 소품. 코드 도트, tk.RGB 램프만.

3/4 시점 문법(기존 props3.rocks · gungnae 굴 입구와 같다): 윗면은 밝고(왼쪽 위 빛), 앞면은 왼쪽 밝음 → 오른쪽 어두움, 윤곽은 안쪽(outline),
땅 그림자는 오른쪽 아래. 바위는 둥근 타원이 아니라 깎인 덩어리(모서리 면)로 그린다.
"""
import math
from tk import *
from build import outline
from props5 import shadow_ell, ell
from trees import ground_shadow

ST = RGB['stone']; EA = RGB['earth']; GR = RGB['leaf']; WD = RGB['wood']; PL = RGB['plaster']
STR = RGB['straw']; DB = RGB['dblue']; RD = RGB['red']; PE = RGB['persimmon']; GI = RGB['giwa']


def boulder(c, cx, cy, rx, ry, seed=0, tone='f', moss=0.0, flat=0.0, crack=True, tint=None):
    """깎인 덩어리 바위. 윤곽은 반지름이 각도에 따라 출렁이고, 윗면(위쪽 36%)은 밝은 면, 앞면은 왼쪽→오른쪽 4단 명암,
    면과 면 사이에 어두운 모서리 선 한두 개. tone 'f' 밝은 회색, 'd' 어두운 회색(동굴), 'w' 따뜻한(황토 섞인) 회색, 'o' 광석(황·청 점은 호출자가)."""
    s1, s2 = rnd(seed, 1, 5) * 6.28, rnd(seed, 2, 5) * 6.28
    pal = {'f': (ST[2], ST[3], ST[4], ST[5], ST[6]), 'd': (ST[1], ST[2], ST[3], ST[4], ST[5]),
           'w': (EA[2], EA[3], ST[3], ST[4], ST[5])}[tone]
    pts = []
    for y in range(int(cy - ry) - 2, int(cy + ry) + 3):
        for x in range(int(cx - rx) - 2, int(cx + rx) + 3):
            u = (x + 0.5 - cx) / rx; v = (y + 0.5 - cy) / ry
            th = math.atan2(v, u)
            lim = 1.0 + 0.13 * math.sin(3 * th + s1) + 0.08 * math.sin(5 * th + s2)
            if v > 0.45: lim = min(lim, 1.0 - (v - 0.45) * 0.5 * (1 + flat))     # 밑이 납작
            if u * u + v * v > lim * lim: continue
            top = v < -0.18 + 0.12 * math.sin(2.0 * u + s1)
            lit = -(u * 0.55 + v * 0.55)
            if top:
                t = 3 if u < 0.15 else 2
                if lit > 0.7: t = 4
            else:
                t = 2 if u < -0.25 else (1 if u < 0.45 else 0)
                t = t + (1 if u < -0.7 else 0)
            q = rnd(x, y, seed + 41)
            if q > 0.96 and t < 4: t += 1
            elif q < 0.06 and t > 0: t -= 1
            c.put(x, y, pal[max(0, min(4, t))])
            pts.append((x, y, u, v, top))
    if crack:                                                              # 면 사이 어두운 모서리 선: 윗면과 앞면의 경계 + 앞면 세로 균열 하나
        yb = {}
        for (x, y, u, v, top) in pts:
            if top: yb[x] = max(yb.get(x, -99), y)
        for x, y0 in yb.items():
            if (x * 3 + seed) % 7 not in (0, 1) and c.a[y0 + 1, x, 3]:
                c.put(x, y0 + 1, pal[0])
        cxk = int(cx + (rnd(seed, 3, 7) - 0.4) * rx * 0.8)
        for y in range(int(cy + ry * 0.0), int(cy + ry * 0.7)):
            if 0 <= cxk + (y // 3) % 2 < c.w and c.a[y, cxk + (y // 3) % 2, 3] and y % 5 != 0:
                c.put(cxk + (y // 3) % 2, y, pal[0])
    if moss > 0:                                                           # 윗면 이끼
        for (x, y, u, v, top) in pts:
            if top and rnd(x // 2, y // 2, seed + 51) < moss and v < -0.3:
                c.put(x, y, GR[3] if rnd(x, y, 3) > 0.35 else GR[4])
    return pts


def _g(c, cx, cy, rx, ry, al=70):
    shadow_ell(c, cx, cy, rx, ry, al)


# ------------------------------------------------------------------ 바위 3~5종
def rock_s(k=0):
    """작은 바위 16×16: 돌 하나(k0) · 큰 돌 + 잔돌 둘(k1) · 이끼 낀 돌(k2)."""
    c = Cv(T, T)
    if k == 0:
        _g(c, 9.5, 14, 6.5, 1.8)
        boulder(c, 7.5, 9.5, 6.2, 4.8, seed=11)
    elif k == 1:
        _g(c, 9.5, 14.2, 7, 1.8)
        boulder(c, 6.5, 8.5, 5.4, 4.4, seed=12)
        boulder(c, 12.5, 11.5, 2.8, 2.4, seed=13, crack=False)
        boulder(c, 2.8, 12, 2.4, 2.0, seed=14, crack=False)
    else:
        _g(c, 9.5, 14.2, 6.8, 1.8)
        boulder(c, 8, 9, 6.4, 5.0, seed=15, moss=0.5)
    outline(c)
    return c


def rock_m(k=0):
    """중간 바위 32×16(2×1): 바위 둘이 붙은 덩이(k0) · 납작한 큰 돌 + 작은 돌(k1)."""
    c = Cv(2 * T, T)
    if k == 0:
        _g(c, 19, 14.5, 13, 1.8)
        boulder(c, 10, 9, 8.2, 5.8, seed=21)
        boulder(c, 22, 10.5, 6.5, 4.6, seed=22, moss=0.3)
        boulder(c, 28.5, 12.8, 2.6, 2.2, seed=23, crack=False)
    else:
        _g(c, 17, 14.5, 12.5, 1.8)
        boulder(c, 15, 10, 12.4, 5.2, seed=24, flat=0.5)
        boulder(c, 5, 12.4, 3.4, 2.8, seed=25, crack=False)
        boulder(c, 27.5, 12.6, 3.0, 2.6, seed=26, crack=False)
    outline(c)
    return c


def rock_l(k=0):
    """큰 바위 48×32(3×2): 우뚝한 바위 하나 + 곁바위 둘."""
    c = Cv(3 * T, 2 * T)
    if k == 0:
        _g(c, 26, 29.5, 20, 2.4)
        boulder(c, 23, 16, 14.5, 12.5, seed=31, moss=0.35)
        boulder(c, 9.5, 24, 7.2, 5.6, seed=32)
        boulder(c, 38.5, 25, 6.4, 5.2, seed=33, crack=False)
    else:
        _g(c, 25, 29.5, 20, 2.4)
        boulder(c, 17, 17, 11.5, 10.5, seed=34)
        boulder(c, 30, 20, 13, 10, seed=35, moss=0.25)
        boulder(c, 41, 27, 4.8, 3.6, seed=36, crack=False)
    outline(c)
    return c


def boulder_mass():
    """큰 바위 덩이 64×48(4×3): 뒤에 큰 바위 둘, 앞에 낮은 바위 셋이 겹쳐 쌓인 무더기. 뒤쪽일수록 어둡다(겹침 깊이)."""
    c = Cv(4 * T, 3 * T)
    _g(c, 33, 45, 28, 2.8, 75)
    boulder(c, 22, 15, 14, 11.5, seed=41, tone='f')
    boulder(c, 43, 17, 13, 12.5, seed=42, tone='f', moss=0.3)
    for (x, y) in ((6, 38), (23, 40), (42, 40), (56, 38)):
        pass
    boulder(c, 12, 33, 11, 8.5, seed=43, moss=0.2)
    boulder(c, 31, 33, 12.5, 9.5, seed=44)
    boulder(c, 51, 34, 10.5, 8.5, seed=45, crack=False)
    boulder(c, 22, 43, 8, 4.6, seed=46, crack=False)
    boulder(c, 44, 44, 7, 4.2, seed=47, crack=False)
    outline(c)
    return c


# ------------------------------------------------------------------ 광석
def ore(k=0):
    """광석 노두: 바위 틈에 박힌 광물. k0 푸른 수정(청 5·6), k1 붉은 철광(붉은 갈색 맥), k2 황토 구리맥."""
    c = Cv(T, T) if k != 1 else Cv(2 * T, T)
    W_ = c.w
    _g(c, W_ * 0.58, 14.2, W_ * 0.42, 1.8)
    boulder(c, W_ * 0.46, 9.5, W_ * 0.38, 5.2, seed=60 + k, tone='d' if k == 0 else 'f')
    if k == 0:
        for (x, y, h) in ((5, 8, 5), (8, 6, 7), (11, 8, 5)):
            for yy in range(h):
                c.put(x, y - yy, DB[5] if yy > 1 else DB[4]); c.put(x + 1, y - yy, DB[4] if yy > 1 else DB[3])
            c.put(x, y - h, DB[6])
    elif k == 1:
        for (x, y) in ((8, 8), (12, 6), (17, 9), (22, 7), (14, 11), (24, 11)):
            c.put(x, y, RD[4]); c.put(x + 1, y, RD[3]); c.put(x, y + 1, RD[3]); c.put(x + 1, y + 1, RD[2])
    else:
        for (x, y) in ((4, 7), (8, 5), (10, 9), (6, 11)):
            c.put(x, y, PE[5]); c.put(x + 1, y, PE[4]); c.put(x, y + 1, PE[3])
    outline(c)
    return c


# ------------------------------------------------------------------ 돌탑 · 폐허 석탑
def _flat_stone(c, cx, yb, w, h, seed):
    """납작한 돌 하나: 윗면 타원(밝음) + 앞면 띠(왼쪽 밝고 오른쪽 어둡다). yb = 앞면 맨 아랫줄."""
    for y in range(yb - h + 1, yb + 1):
        t = (y - (yb - h + 1)) / float(max(1, h - 1))
        for x in range(int(cx - w / 2), int(cx + w / 2) + 1):
            u = (x - cx) / (w / 2.0)
            if abs(u) > 1.0 - (0.22 if (t < 0.15 or t > 0.9) else 0.0): continue
            if t < 0.38:
                col = ST[6] if (u < 0.1 and t < 0.2) else ST[5]
            else:
                col = ST[4] if u < -0.35 else (ST[3] if u < 0.35 else ST[2])
            if rnd(x, y, seed) > 0.95: col = ST[max(2, [ST[2], ST[3], ST[4], ST[5], ST[6]].index(col) + 1)] if col in ST[2:7] else col
            c.put(x, y, col)


def cairn():
    """돌탑 16×32(1×2): 납작한 돌을 위로 갈수록 작게, 가운데를 조금씩 어긋나게 쌓은 탑. 돌마다 윗면(밝음)과 앞면(어두움)이 보인다."""
    c = Cv(T, 2 * T)
    _g(c, 9, 30, 6.5, 1.6)
    for (cx, cy, rx, ry, sd) in ((8, 26.5, 6.4, 3.4, 71), (9, 22, 5.4, 3.0, 72), (7.5, 18, 4.4, 2.7, 73), (8.5, 14.5, 3.4, 2.3, 74), (8, 11.5, 2.5, 1.9, 75), (8, 9, 1.6, 1.4, 76)):
        boulder(c, cx, cy, rx, ry, seed=sd, crack=False, flat=0.8)
    outline(c)
    return c


def ruin_pagoda():
    """폐허 석탑 32×48(2×3): 기존 석탑(structs.stone_pagoda)에서 위 두 층이 부러져 나가고(들쭉날쭉한 단면), 곁에 무너진 돌덩이와 이끼.
    그림은 석탑 그대로 가져와 화풍·톤이 기존 조각과 같다."""
    import structs as _ST
    base = _ST.stone_pagoda()
    c = Cv(2 * T, 3 * T)
    cut = [12 + (3 if x % 7 in (2, 3) else (1 if x % 5 == 0 else 0)) + max(0, (x - 14) // 3) for x in range(2 * T)]
    for y in range(base.h):
        for x in range(base.w):
            if y >= cut[x] and base.a[y, x, 3]:
                c.a[y, x] = base.a[y, x]
    for x in range(2 * T):                                           # 부러진 단면 윗줄은 밝은 돌 + 아래 한 줄 그늘
        y = cut[x]
        if c.a[y, x, 3]:
            c.put(x, y, ST[6]); 
            if c.a[y + 1, x, 3]: c.put(x, y + 1, ST[5])
    boulder(c, 6, 43, 3.6, 2.8, seed=81, crack=False)
    boulder(c, 26.5, 44, 3.4, 2.6, seed=82, crack=False)
    boulder(c, 22, 45, 2.4, 1.8, seed=83, crack=False)
    for (x, y) in ((9, 41), (10, 40), (21, 43), (22, 43)):
        c.put(x, y, GR[3]); c.put(x + 1, y, GR[4])
    outline(c)
    return c


# ------------------------------------------------------------------ 무덤
def _mound(c, cx, cy, rx, ry, seed=0):
    """봉분: 둥근 흙 무덤을 풀이 덮었다. 윗면 밝은 풀(왼쪽 위 빛), 아래는 어두운 풀, 밑에 흙띠."""
    for y in range(int(cy - ry) - 1, int(cy + ry * 0.55) + 3):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            u = (x + 0.5 - cx) / rx; v = (y + 0.5 - cy) / ry
            if v > 0.5: lim = 1.02 - (v - 0.5) * 0.4
            else: lim = 1.0
            if u * u + v * v > lim * lim or v > 0.78: continue
            lit = -(u * 0.55 + v * 0.8)
            if v > 0.45:
                col = EA[3] if rnd(x, y, 3) > 0.35 else EA[2]               # 흙 밑동
            else:
                t = 6 if lit > 0.75 else (5 if lit > 0.35 else (4 if lit > -0.1 else (3 if lit > -0.5 else 2)))
                col = GR[t]
                if rnd(x, y, seed + 9) > 0.9: col = GR[max(2, t - 1)]
            c.put(x, y, col)


def _stele_small(c, x0, y0, w=6, h=11):
    """작은 묘비: 윗머리 둥근 비석 + 받침. 앞면 왼쪽 밝음."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if y < y0 + 2 and (x in (x0, x0 + w - 1)): continue
            f = (x - x0) / max(1, w - 1)
            c.put(x, y, ST[6] if f < 0.2 else (ST[5] if f < 0.55 else (ST[4] if f < 0.85 else ST[3])))
    for x in range(x0 - 1, x0 + w + 1):
        c.put(x, y0 + h, ST[5]); c.put(x, y0 + h + 1, ST[3])
    for y in range(y0 + 3, y0 + h - 2, 3):
        c.put(x0 + 2, y, ST[3]); c.put(x0 + 3, y, ST[3])


def grave(k=0):
    """무덤 32×32(2×2): 낮은 봉분(풀이 덮은 둥근 흙무덤, 왼쪽 위가 밝고 오른쪽 아래가 어둡다) 앞에 밟힌 흙 마당, 묘비(k0) / 상석(제사상 돌판)과 묘비(k1)."""
    c = Cv(2 * T, 2 * T)
    _g(c, 17, 30, 14, 1.8, 60)
    ell(c, 16, 26.5, 12.5, 3.2, lambda x, y, u, v: EA[4] if rnd(x, y, 5 + k) > 0.2 else EA[3])      # 밟힌 흙
    cx, cy, rx, ry = 16.5, 19.0, 13.5, 5.6
    for y in range(int(cy - ry) - 1, 25):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            u = (x + 0.5 - cx) / rx; v = (y + 0.5 - cy) / ry
            if u * u + v * v > 1.0: continue
            lit = -(u * 0.55 + v * 0.8)
            t = 6 if lit > 0.8 else (5 if lit > 0.3 else (4 if lit > -0.2 else 3))
            col = GR[t]
            if rnd(x, y, k + 9) > 0.88: col = EA[4] if t > 3 else GR[max(2, t - 1)]
            c.put(x, y, col)
    for i in range(10):                                                  # 호석 + 풀 밑동
        x = 3 + i * 3 + (1 if i % 2 else 0)
        c.put(x, 23, ST[5]); c.put(x + 1, 23, ST[4]); c.put(x, 24, ST[3]); c.put(x + 1, 24, ST[2])
    if k == 0:
        _stele_small(c, 12, 16, 7, 12)
    else:
        _stele_small(c, 3, 16, 6, 11)
        for r_ in range(3):                                              # 상석
            for x in range(15, 28):
                c.put(x, 24 + r_, ST[6] if r_ == 2 or x == 15 else ST[5])
        for r_ in range(2):
            for x in range(15, 28):
                f = (x - 15) / 12.0
                c.put(x, 27 + r_, ST[4] if f < 0.3 else (ST[3] if f < 0.8 else ST[2]))
        for r_ in range(1):
            for x in (16, 17, 26, 27):
                c.put(x, 29 + r_, ST[3] if x < 20 else ST[2])
    outline(c)
    return c


def tombstone():
    """묘비 하나 16×32(1×2): 낮은 3단 받침 위 선 비석. 왼쪽 위가 살짝 이지러졌다."""
    c = Cv(T, 2 * T)
    _g(c, 9, 30.4, 6.5, 1.5)
    for r, (x0, w) in enumerate(((2, 12), (3, 10))):
        for x in range(w):
            c.put(x0 + x, 28 + r, ST[5] if x < 3 else (ST[4] if x < 8 else ST[3]))
            c.put(x0 + x, 28 + r + 2 - r, ST[5] if x < 3 else ST[3]) if False else None
    for x in range(1, 15):
        c.put(x, 30, ST[3] if x < 9 else ST[2]); c.put(x, 29, ST[4] if x < 5 else ST[3])
    for y in range(4, 28):
        for x in range(4, 12):
            if y < 8 and ((x - 7.5) ** 2 / 16.0 + (y - 8) ** 2 / 16.0 > 1): continue
            if y < 6 and x < 6: continue
            f = (x - 4) / 7.0
            c.put(x, y, ST[6] if f < 0.15 else (ST[5] if f < 0.5 else (ST[4] if f < 0.85 else ST[3])))
    for y in range(10, 24, 3):
        c.put(6, y, ST[3]); c.put(7, y, ST[3]); c.put(9, y, ST[3])
    outline(c)
    return c


# ------------------------------------------------------------------ 동굴 입구(절벽 안, 전면 3/4)
def _dark_hole(c, cx, ytop, ybot, rx, arch=True):
    """어두운 구멍: 위가 반원, 아래로 갈수록 한 단 밝다(바닥에 새어 든 빛). 안쪽 윗면은 가장 어둡다."""
    ry = rx * 0.9
    yspring = ytop + int(ry)
    for y in range(ytop, ybot):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            dx = x + 0.5 - cx
            if y < yspring:
                d = (dx / rx) ** 2 + ((y + 0.5 - yspring) / ry) ** 2
            else:
                d = abs(dx) / rx
            if d <= 1.0:
                tt = (y - ytop) / float(max(1, ybot - ytop))
                c.put(x, y, GI[0] if tt < 0.45 else (ST[1] if tt < 0.75 else ST[2]))
                if y >= ybot - 2: c.put(x, y, EA[1])


def _cliff_base(c, ncols, v=0, cave=False):
    """piece 의 아래 두 줄(1·2행)에 절벽 앞면 타일(윗줄 · 아랫줄)을 그대로 깔고, 양 끝에 균열 한 줄을 둔다."""
    import fa_ground as FG
    for i in range(ncols):
        for r in range(2):
            t = FG.face_tile(r, 3, (v + i) % 2, cave)
            for y in range(T):
                for x in range(T):
                    c.a[(r + 1) * T + y, i * T + x] = t.a[y, x]
    for y in range(T, 3 * T):
        c.put(0, y, ST[1]); c.put(c.w - 1, y, ST[1])


def _wedge_arch(c, cx, ytop, ybot, rx, th=4):
    """돌 홍예: 구멍 둘레를 쐐기돌 한 겹(번갈아 밝고 어두운 조각)이 반원으로 두른다."""
    ry = rx * 0.9
    ysp = ytop + int(ry)
    for y in range(ytop - th, ybot):
        for x in range(int(cx - rx) - th - 1, int(cx + rx) + th + 2):
            dx = x + 0.5 - cx
            if y < ysp:
                d = ((dx / rx) ** 2 + ((y + 0.5 - ysp) / ry) ** 2) ** 0.5
                ang = math.atan2(ysp - (y + 0.5), dx)
                seg = int(ang / 0.42) % 2
            else:
                d = abs(dx) / rx
                seg = ((y - ysp) // 6) % 2
            if 1.0 < d <= 1.0 + th / rx:
                t = (d - 1.0) * rx / th
                col = (ST[6] if seg else ST[5]) if t < 0.5 else (ST[4] if seg else ST[3])
                if t > 0.88: col = ST[2]
                c.put(x, y, col)


def cave_cliff(k=0):
    """절벽에 뚫린 동굴 입구(전면 3/4). 아래 두 줄은 절벽 앞면 타일 그대로 위에 구멍을 뚫고, 맨 위 한 줄은 윗면 바위 위로 솟은 쐐기돌 더미.
    k0 5×3: 돌 홍예(쐐기돌 아치) · k1 5×3: 통나무 갱목 틀(광산) · k2 4×3: 낮고 거친 짐승 굴.
    구멍 안은 위가 가장 어둡고 바닥 쪽 한 단 밝다(새어 든 빛), 문턱은 밟힌 흙."""
    nc = 4 if k == 2 else 5
    c = Cv(nc * T, 3 * T)
    W_, H_ = c.w, c.h
    cx = W_ // 2
    _cliff_base(c, nc, v=k)
    ybot = H_ - 3
    if k == 0:
        rx, ytop = 13, 22
        _wedge_arch(c, cx, ytop, ybot, rx)
        _dark_hole(c, cx, ytop, ybot, rx)
        boulder(c, cx, 13, 11.5, 6.5, seed=93, moss=0.35)                          # 이마 큰 돌
        boulder(c, cx - 20, 17, 7, 5.2, seed=94, crack=False)
        boulder(c, cx + 20, 16, 6.5, 5.0, seed=95, moss=0.2, crack=False)
        boulder(c, cx - 33, 20, 3.6, 3.0, seed=96, crack=False)
    elif k == 1:
        rx, ytop = 11, 24
        _dark_hole(c, cx, ytop, ybot, rx - 1, arch=False)
        for px in (cx - rx - 3, cx + rx - 1):                                          # 갱목 기둥
            for y in range(ytop - 3, ybot + 2):
                for i in range(4):
                    c.put(px + i, y, WD[5] if i == 0 else (WD[4] if i == 1 else (WD[3] if i == 2 else WD[2])))
        for y in range(ytop - 7, ytop - 2):                                              # 들보
            for x in range(cx - rx - 7, cx + rx + 7):
                k_ = y - (ytop - 7)
                c.put(x, y, WD[6] if k_ == 0 else (WD[5] if k_ == 1 else (WD[4] if k_ == 2 else (WD[3] if k_ == 3 else WD[2]))))
        for y in range(ytop - 7, ytop - 2):                                               # 들보 끝 마구리
            c.put(cx - rx - 7, y, WD[6] if y < ytop - 5 else WD[4]); c.put(cx + rx + 6, y, WD[3] if y < ytop - 5 else WD[2])
        for i in range(3):                                                               # 걸린 등롱
            c.put(cx + rx - 5, ytop - 2 + i, WD[2])
        c.put(cx + rx - 6, ytop + 1, PE[5]); c.put(cx + rx - 5, ytop + 1, PE[6]); c.put(cx + rx - 6, ytop + 2, PE[4]); c.put(cx + rx - 5, ytop + 2, PE[5])
        boulder(c, cx - 16, 14, 9, 6.5, seed=98, tone='w', crack=False)
        boulder(c, cx + 14, 14, 9.5, 6.8, seed=99, tone='w', moss=0.2)
        boulder(c, cx, 9, 8, 4.6, seed=100, tone='w', crack=False)
    else:
        rx, ytop = 9, 28
        # 거친 구멍: 위쪽이 울퉁불퉁하게 짓눌린 모양
        for y in range(ytop, ybot):
            tt = (y - ytop) / float(ybot - ytop)
            hw = rx * (0.55 + 0.45 * min(1.0, tt * 2.2)) + (hsh(y, k, 3) % 3 - 1) * 0.6
            for x in range(int(cx - hw), int(cx + hw) + 1):
                c.put(x, y, GI[0] if tt < 0.45 else (ST[1] if tt < 0.75 else ST[2]))
        for y in range(ytop - 2, ybot):                                                   # 구멍 둘레 어두운 테
            tt = (y - ytop) / float(ybot - ytop)
            hw = rx * (0.55 + 0.45 * min(1.0, max(0, tt) * 2.2))
            c.put(int(cx - hw) - 1, y, ST[2]); c.put(int(cx + hw) + 1, y, ST[1])
        boulder(c, cx - 14, 15, 8, 6, seed=103, crack=False)
        boulder(c, cx + 13, 14, 8.5, 6.5, seed=104, moss=0.25)
        boulder(c, cx - 2, 10, 7, 5, seed=105, crack=False)
        boulder(c, cx - 15, H_ - 8, 5, 4, seed=106, crack=False)
        boulder(c, cx + 15, H_ - 7, 4, 3.4, seed=107, crack=False)
    c.hl(cx - rx + 1, cx + rx - 1, ybot, EA[3]); c.hl(cx - rx + 1, cx + rx - 1, ybot + 1, EA[2])
    outline(c)
    return c


# ------------------------------------------------------------------ 동굴 소품
def stalag(k=0):
    """석순 16×32(1×2): 바닥에서 솟은 뾰족한 돌기둥(어두운 동굴 암석), 왼쪽이 밝다. 밑에 작은 돌 부스러기."""
    c = Cv(T, 2 * T)
    _g(c, 9, 30, 6.5, 1.6)
    for (bx, by, hgt, bw) in ((7 + (k % 2), 29, 24 - 4 * (k % 2), 6.0), (12, 29, 12, 3.4)) if k != 2 else ((8, 29, 26, 6.5),):
        for y in range(by - hgt, by):
            t = (y - (by - hgt)) / float(hgt)
            w = max(1.0, bw * (t ** 0.8))
            for x in range(int(bx - w), int(bx + w) + 1):
                u = (x - bx) / max(1.0, w)
                col = ST[4] if u < -0.45 else (ST[3] if u < 0.1 else (ST[2] if u < 0.6 else ST[1]))
                if t < 0.12: col = ST[5] if u < 0 else ST[4]
                c.put(x, y, col)
    outline(c)
    return c


def cave_rock(k=0):
    """동굴 바위 16×16: 어두운 돌 하나(k0) · 돌무더기(k1)."""
    c = Cv(T, T)
    _g(c, 9.5, 14, 6.2, 1.7)
    if k == 0:
        boulder(c, 8, 9.5, 6.2, 4.8, seed=111, tone='d')
    else:
        boulder(c, 6, 9, 5, 4.2, seed=112, tone='d')
        boulder(c, 12, 11.5, 3.4, 3, seed=113, tone='d', crack=False)
        boulder(c, 3, 13, 2.2, 1.8, seed=114, tone='d', crack=False)
    outline(c)
    return c


def cave_rubble():
    """무너진 돌 더미 32×16(2×1)."""
    c = Cv(2 * T, T)
    _g(c, 18, 14.2, 13, 1.8)
    boulder(c, 9, 10.5, 6.5, 4.4, seed=121, tone='d')
    boulder(c, 19, 9.5, 6.8, 5.2, seed=122, tone='d')
    boulder(c, 27, 12.5, 3.6, 2.8, seed=123, tone='d', crack=False)
    boulder(c, 3.5, 13.5, 2.4, 1.8, seed=124, tone='d', crack=False)
    outline(c)
    return c


def cave_pillar():
    """자연 기둥 32×32(2×2)? 아니고 16×32: 천장에서 바닥까지 이어진 굵은 석주, 위 아래가 나팔처럼 퍼진다."""
    c = Cv(2 * T, 2 * T)
    _g(c, 18, 30, 12.5, 2.0)
    for y in range(2, 31):
        t = y / 30.0
        w = 7.0 + 5.5 * (abs(t - 0.5) * 2) ** 3 + (1 if t > 0.9 else 0)
        for x in range(int(16 - w), int(16 + w) + 1):
            u = (x - 16) / max(1.0, w)
            col = ST[5] if u < -0.55 else (ST[4] if u < -0.1 else (ST[3] if u < 0.4 else (ST[2] if u < 0.8 else ST[1])))
            if rnd(x, y, 3) > 0.94: col = ST[max(1, [ST[1], ST[2], ST[3], ST[4], ST[5]].index(col) if col in (ST[1], ST[2], ST[3], ST[4], ST[5]) else 3)]
            c.put(x, y, col)
    for x in range(12, 14):
        for y in range(8, 24):
            if y % 5: c.put(x, y, ST[2])
    outline(c)
    return c


def cave_crystal(k=0):
    """푸른 수정 무리 16×16: 바위 틈에서 솟은 세 개의 결정(6·5·4 톤, 각 윗면 밝음) + 바닥 은은한 빛."""
    c = Cv(T, T)
    _g(c, 9, 14.3, 6.5, 1.6)
    boulder(c, 8, 12, 6.5, 3.2, seed=131, tone='d', crack=False)
    for (bx, by, hgt) in ((5, 10, 7), (8, 9, 10), (11, 10, 6)) if k == 0 else ((6, 10, 6), (9, 9, 8), (12, 11, 5)):
        for yy in range(hgt):
            w = 2 if yy < hgt - 2 else 1
            c.put(bx, by - yy, DB[6] if yy >= hgt - 3 else DB[5]); c.put(bx + 1, by - yy, DB[5] if yy >= hgt - 3 else DB[4])
            if w == 2 and yy < hgt - 3: c.put(bx + 2, by - yy, DB[3])
        c.put(bx, by - hgt, DB[6])
    outline(c)
    return c


def brazier():
    """화로(횃불 받침) 16×32(1×2): 철제 삼발이 위 불꽃. 윗면에 잉걸불, 불꽃은 주황→노랑."""
    c = Cv(T, 2 * T)
    _g(c, 9, 30.2, 6, 1.5)
    for y in range(18, 30):                                   # 다리
        for (x, t) in ((4, 5), (11, 3)):
            c.put(x + (y - 18) // 6, y, ST[t])
    for y in range(26, 30):
        c.put(4 - (y - 26) // 2, y, ST[4]); c.put(11 + (y - 26) // 2, y, ST[2])
    for x in range(2, 14):                                      # 화덕 그릇
        c.put(x, 18, ST[5] if x < 6 else (ST[4] if x < 10 else ST[3]))
        c.put(x, 19, ST[3] if x < 8 else ST[2])
    for (x, y, h, col) in ((5, 17, 5, PE[4]), (8, 17, 9, PE[5]), (11, 17, 6, PE[4]), (7, 17, 6, PE[6]), (9, 17, 4, PE[6])):
        for yy in range(h):
            c.put(x, y - yy, col if yy < h - 1 else PE[6]); c.put(x + 1, y - yy, PE[4] if col != PE[6] else PE[5])
    for x in range(4, 12): c.put(x, 17, EA[5] if x % 2 else PE[3])
    outline(c)
    return c


def cave_chest():
    """보물 상자 16×16: 나무 몸통 + 쇠띠 + 둥근 뚜껑 윗면(밝음). 앞면 자물쇠."""
    c = Cv(T, T)
    _g(c, 9, 14, 7, 1.7)
    for y in range(3, 7):                                       # 뚜껑 윗면(둥글게)
        w = 6 - abs(y - 5) * 0
        for x in range(2 + (y == 3), 14 - (y == 3)):
            c.put(x, y, WD[6] if y == 3 else (WD[5] if x < 6 else WD[4]))
    for y in range(7, 13):
        for x in range(2, 14):
            c.put(x, y, WD[5] if x < 5 else (WD[4] if x < 9 else (WD[3] if x < 12 else WD[2])))
    for x in (2, 3, 12, 13):
        for y in range(3, 13): c.put(x, y, ST[4] if x < 6 else ST[3])
    for y in range(7, 9): c.put(7, y, PE[5]); c.put(8, y, PE[4])
    c.put(7, 9, PE[6]); c.put(8, 9, PE[5])
    outline(c)
    return c


def cave_bones():
    """뼈 무더기 16×16: 해골 하나와 갈비뼈·정강이뼈. 연한 상아색(plaster 4~6)과 눈구멍."""
    c = Cv(T, T)
    _g(c, 9, 14.2, 6.8, 1.6)
    for (cx, cy, rx, ry) in ((5.5, 8.5, 3.8, 3.2),):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                u = (x + 0.5 - cx) / rx; v = (y + 0.5 - cy) / ry
                if u * u + v * v <= 1: c.put(x, y, PL[6] if (u < 0 and v < 0) else (PL[5] if u < 0.4 else PL[4]))
    c.put(4, 8, ST[1]); c.put(5, 8, ST[1]); c.put(7, 8, ST[1]); c.put(8, 8, ST[1]); c.put(5, 10, PL[3]); c.put(7, 10, PL[3])
    for k in range(3):                                           # 갈비뼈 호
        c.hl(9 + k, 14 + (k == 2), 7 + k * 2, PL[5]); c.hl(9 + k, 14, 8 + k * 2, PL[3])
    for x in range(1, 12):                                       # 긴 뼈
        c.put(x, 13, PL[5] if x > 1 else PL[6]); c.put(x, 14, PL[3])
    c.put(0, 12, PL[6]); c.put(0, 14, PL[5]); c.put(12, 12, PL[6]); c.put(12, 14, PL[4])
    outline(c)
    return c


def cave_mushroom(k=0):
    """동굴 버섯 16×16: 갓이 둥근 버섯 둘~셋(윗면 밝음, 갓 밑 그늘 주름), 자루."""
    c = Cv(T, T)
    _g(c, 9, 14.2, 6.5, 1.5)
    cols = (PL, RD) if k == 0 else (PE, PL)
    for (cx, cy, rx, ry, cap) in ((5, 8, 4.2, 2.6, cols[0]), (11, 9, 3.4, 2.2, cols[1]), (8, 12, 2.4, 1.6, cols[0])):
        for y in range(int(cy + ry) + 1, int(cy + ry) + 4):
            c.put(int(cx), y, PL[4]); c.put(int(cx) + 1, y, PL[2])
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                u = (x + 0.5 - cx) / rx; v = (y + 0.5 - cy) / ry
                if u * u + v * v <= 1:
                    c.put(x, y, cap[6] if (u < -0.2 and v < -0.2) else (cap[5] if v < 0.3 else cap[3]))
    outline(c)
    return c


def objects():
    d = {}
    for k in range(3): d['fld_rock_s_' + 'abc'[k]] = rock_s(k)
    for k in range(2): d['fld_rock_m_' + 'ab'[k]] = rock_m(k)
    for k in range(2): d['fld_rock_l_' + 'ab'[k]] = rock_l(k)
    d['fld_boulder_mass'] = boulder_mass()
    d['fld_ore_a'] = ore(0); d['fld_ore_b'] = ore(1); d['fld_ore_c'] = ore(2)
    d['fld_cairn'] = cairn()
    d['fld_ruin_pagoda'] = ruin_pagoda()
    d['fld_grave_a'] = grave(0); d['fld_grave_b'] = grave(1)
    d['fld_tombstone'] = tombstone()
    for k in range(3): d['fld_cave_' + 'abc'[k]] = cave_cliff(k)
    d['cav_stalag_a'] = stalag(0); d['cav_stalag_b'] = stalag(1); d['cav_stalag_c'] = stalag(2)
    d['cav_rock_a'] = cave_rock(0); d['cav_rock_b'] = cave_rock(1)
    d['cav_rubble'] = cave_rubble()
    d['cav_pillar'] = cave_pillar()
    d['cav_crystal_a'] = cave_crystal(0); d['cav_crystal_b'] = cave_crystal(1)
    d['cav_brazier'] = brazier()
    d['cav_chest'] = cave_chest()
    d['cav_bones'] = cave_bones()
    d['cav_mushroom_a'] = cave_mushroom(0); d['cav_mushroom_b'] = cave_mushroom(1)
    return d
