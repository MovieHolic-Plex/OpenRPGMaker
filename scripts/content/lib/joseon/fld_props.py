"""사냥터(fld_) 물체 조각 — 바위·들꽃·쓰러진 나무·표식·야영지·무덤·폐허·나무 변형.

기존 조각(props3 rocks, props5 ell/box/cyl, trees)과 같은 문법: 정면-위 3/4, 빛은 왼쪽 위(왼쪽 밝고 오른쪽 어둡다),
그림자는 오른쪽 아래, 안쪽 외곽선(build.outline), 색은 tk.RGB 램프(잠금 팔레트)만.
모든 조각은 16px 칸의 배수 크기이고 이름은 fld_ 로 시작한다(catalog.objects() 끝에 덧붙임, 기존 키는 그대로).
"""
import math
from tk import *
from build import outline
from props5 import ell, shadow_ell, box, cyl
from trees import ground_shadow
import trees as TR

ST, WD, ER, LF, PN = RGB['stone'], RGB['wood'], RGB['earth'], RGB['leaf'], RGB['pine']
SW, PL, PS, RD = RGB['straw'], RGB['plaster'], RGB['persimmon'], RGB['red']
DB, DG, GW = RGB['dblue'], RGB['dgreen'], RGB['giwa']


# ---------------------------------------------------------------- 도구
def boulder(c, cx, cy, rx, ry, seed=0, ramp=None, moss=0.0, sharp=0.2):
    """각진 바위 한 덩이. 윗면(밝음)과 앞면(어두움)이 갈리고, 왼쪽이 밝고 오른쪽이 어둡다. 외곽은 불규칙 다각형."""
    r = ramp or ST
    n = 10
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n + 0.3
        k = 1 + sharp * (rnd(i, seed, 71) * 2 - 1)
        pts.append((int(round(cx + math.cos(a) * rx * k)), int(round(cy + math.sin(a) * ry * k))))

    def fn(x, y):
        u = (x + 0.5 - cx) / rx
        v = (y + 0.5 - cy) / ry
        lit = -(0.55 * u + 0.85 * v)
        t = 4 + (1 if lit > 0.45 else (0 if lit > -0.1 else (-1 if lit > -0.55 else -2)))
        if v < -0.25 and lit > 0.0:
            t += 1                                              # 윗면(밝음)
        q = rnd(x // 3, y // 2, seed + 5)
        if q > 0.86: t += 1
        elif q < 0.14: t -= 1
        if rnd(x, y, seed + 9) < 0.05: t -= 1
        t = max(2, min(6 if (v < -0.4 and lit > 0.5) else 5, t))
        if moss and v < -0.1 and rnd(x // 2, y // 2, seed + 13) < moss:
            return PN[4] if rnd(x, y, seed + 3) > 0.4 else PN[3]
        return r[t]
    fillpoly(c, pts, fn)
    # 앞면 가운데 갈라진 틈(어두운 2~3px)
    fx = int(cx + (rnd(seed, 3, 5) - 0.5) * rx)
    fy = int(cy + ry * 0.1)
    for i in range(3):
        if 0 <= fx + (i // 2) < c.w and 0 <= fy + i < c.h and c.get(fx + (i // 2), fy + i)[3]:
            c.put(fx + (i // 2), fy + i, r[1])


def _clean(c):
    outline(c)
    return c


def rock_small(seed=0):
    """작은 돌 16×16: 큰 돌 하나 + 곁돌."""
    c = Cv(T, T)
    ground_shadow(c, 9, 14, 7, 1.6, 70)
    boulder(c, 8, 9, 5.6, 4.4, seed)
    boulder(c, 13, 12, 2.4, 2.0, seed + 4)
    if seed % 2: boulder(c, 3, 12, 2.2, 1.8, seed + 8)
    return _clean(c)


def rock_medium(seed=0, tall=False):
    """중간 바위: 2×1 (두 덩이) 또는 2×2 (tall: 큰 덩이 위에 작은 덩이)."""
    if not tall:
        c = Cv(2 * T, T)
        ground_shadow(c, 18, 14, 13, 1.8, 70)
        boulder(c, 20, 9, 8, 5.6, seed, moss=0.25)
        boulder(c, 8, 10, 6, 4.6, seed + 5)
        boulder(c, 28, 12, 3, 2.4, seed + 9)
    else:
        c = Cv(2 * T, 2 * T)
        ground_shadow(c, 18, 30, 13, 2.0, 70)
        boulder(c, 17, 21, 11, 9.5, seed, moss=0.35)
        boulder(c, 8, 26, 6, 5, seed + 5)
        boulder(c, 27, 27, 4.5, 4, seed + 9)
        boulder(c, 15, 11, 5, 4, seed + 13, sharp=0.3)
    return _clean(c)


def rock_large(seed=0):
    """큰 바위 무더기 48×32: 뒤에 우뚝한 바위 하나, 앞에 낮은 바위 둘, 틈에 풀."""
    c = Cv(3 * T, 2 * T)
    ground_shadow(c, 26, 30, 21, 2.2, 70)
    boulder(c, 26, 14, 13, 11, seed, moss=0.3, sharp=0.28)
    boulder(c, 12, 22, 9, 7, seed + 3)
    boulder(c, 36, 24, 9.5, 6.5, seed + 7, moss=0.2)
    boulder(c, 22, 26, 6, 4, seed + 11)
    for x, y in ((6, 29), (44, 28), (30, 30)):
        c.put(x, y, LF[4]); c.put(x, y - 1, LF[5]); c.put(x + 1, y, LF[3])
    return _clean(c)


def boulder_mass(seed=0):
    """큰 바위 덩이 64×48(4×3): 길을 막는 바위 언덕. 윗면에 이끼, 앞쪽으로 흘러내린 돌."""
    c = Cv(4 * T, 3 * T)
    ground_shadow(c, 34, 45, 28, 2.6, 70)
    boulder(c, 22, 20, 15, 14, seed, moss=0.3, sharp=0.3)
    boulder(c, 44, 18, 15, 13, seed + 3, moss=0.35, sharp=0.3)
    boulder(c, 33, 12, 12, 9, seed + 7, moss=0.45, sharp=0.25)
    boulder(c, 12, 34, 10, 8, seed + 11)
    boulder(c, 33, 36, 14, 9, seed + 13, moss=0.1)
    boulder(c, 53, 36, 9.5, 8, seed + 17)
    boulder(c, 22, 41, 6, 4, seed + 19)
    for x, y in ((3, 44), (60, 44), (40, 45), (28, 44)):
        c.put(x, y, LF[4]); c.put(x, y - 1, LF[5]); c.put(x + 1, y, LF[3]); c.put(x + 2, y - 1, LF[4])
    return _clean(c)


# ---------------------------------------------------------------- 들꽃·덤불
def _flower(c, x, y, head, stem_len=4, leafy=True):
    for k in range(stem_len):
        c.put(x, y + k, LF[3] if k % 2 else LF[4])
    if leafy:
        c.put(x - 1, y + stem_len - 2, LF[5]); c.put(x + 1, y + stem_len - 1, LF[3])
    c.put(x, y - 1, head[1]); c.put(x - 1, y, head[0]); c.put(x + 1, y, head[0]); c.put(x, y, head[2]); c.put(x, y + 1, head[0])


def flowers(kind=0):
    """들꽃 한 포기 16×16: 풀 위에 피어난 꽃 다섯 송이(2px 꽃머리). kind 0 흰·노랑 / 1 붉은 / 2 보라푸른."""
    c = Cv(T, T)
    heads = {0: [(PL[6], PL[5], PS[5]), (PS[6], PS[5], PS[3])],
             1: [(RD[5], RD[6], PS[4]), (PS[5], PS[6], RD[4])],
             2: [(DB[5], DB[6], PL[6]), (PL[5], PL[6], DB[4])]}[kind]
    ground_shadow(c, 9, 14, 6, 1.4, 55)
    for k, (x, y) in enumerate(((3, 6), (7, 4), (11, 7), (5, 9), (10, 10))):
        _flower(c, x, y, heads[k % 2], 4 if k < 3 else 3)
    for x in range(2, 14, 3):                                   # 밑 풀잎 덩이
        c.put(x, 14, LF[3]); c.put(x + 1, 13, LF[4]); c.put(x + 1, 14, LF[2]); c.put(x + 2, 14, LF[3])
    return c


def bush_flower(kind='l', seed=0, head=0):
    """꽃덤불: 기존 덤불 위에 꽃 점을 얹는다."""
    b = TR.bush_size(kind, seed)
    c = Cv(b.w, b.h)
    c.a = b.a.copy()
    cols = [(PL[6], PL[5]), (PS[6], PS[5]), (RD[6], RD[5])][head]
    n = 9 if kind == 'l' else 5
    k = 0
    tries = 0
    while k < n and tries < 200:
        tries += 1
        x, y = hsh(tries, seed, 31) % c.w, hsh(tries, seed, 32) % (c.h - 4)
        if c.a[y, x, 3] == 255 and c.a[y + 1, x, 3] == 255 and c.a[y, x + 1, 3] == 255:
            c.put(x, y, cols[0]); c.put(x + 1, y, cols[1]); c.put(x, y + 1, cols[1])
            k += 1
    return c


def bush_berry(seed=0):
    """열매덤불: 붉은 열매가 점점이 박힌 덤불."""
    b = TR.bush_size('l', seed + 2)
    c = Cv(b.w, b.h)
    c.a = b.a.copy()
    k = 0
    for tries in range(250):
        x, y = hsh(tries, seed, 41) % c.w, hsh(tries, seed, 42) % (c.h - 4)
        if c.a[y, x, 3] == 255 and c.a[y + 1, x, 3] == 255 and c.a[y, x + 1, 3] == 255:
            c.put(x, y, RD[5]); c.put(x + 1, y, RD[4]); c.put(x, y + 1, RD[3])
            k += 1
            if k >= 8: break
    return c


def fern():
    """고사리 덤불 16×16: 세 갈래로 퍼지는 잎."""
    c = Cv(T, T)
    ground_shadow(c, 9, 14, 6, 1.3, 55)
    for ang, ln in ((-0.9, 8), (-0.35, 10), (0.2, 11), (0.8, 8), (-1.3, 5)):
        for i in range(ln):
            x = 8 + math.sin(ang) * i * 0.9
            y = 14 - i * 0.95 + (i * i) * 0.02
            c.put(int(round(x)), int(round(y)), LF[5] if i > ln // 2 else LF[4])
            c.put(int(round(x)) + 1, int(round(y)), LF[3] if i < ln - 1 else LF[4])
            if i % 2 == 0 and 1 < i < ln - 1:
                c.put(int(round(x)) - 1, int(round(y)) + 1, LF[4]); c.put(int(round(x)) + 2, int(round(y)) + 1, LF[2])
    return _clean(c)


# ---------------------------------------------------------------- 나무 토막
def log_fallen(seed=0, long=True):
    """쓰러진 통나무: 가로로 누웠고 왼쪽 단면에 나이테, 윗면은 밝고 이끼, 앞면은 어둡다. long=48×16, 아니면 32×16."""
    wd = 48 if long else 32
    c = Cv(wd, T)
    ground_shadow(c, wd // 2 + 2, 14, wd // 2 - 3, 1.7, 70)
    top, bot = 4, 14
    for x in range(3, wd - 2):
        s = (x - 3) / (wd - 5)
        yb = bot - (1 if x > wd - 5 else 0)
        for y in range(top, yb):
            f = (y - top) / (yb - top)
            if f < 0.28: t = 6 if f < 0.1 else 5                 # 윗면(둥근 위쪽): 밝음
            elif f < 0.55: t = 4
            elif f < 0.8: t = 3
            else: t = 2
            if rnd(x // 3, y, seed + 7) < 0.17 and 2 < t < 6: t -= 1   # 세로 결
            c.put(x, y, WD[t])
        if rnd(x, 3, seed + 2) < 0.15:
            c.put(x, top + 1, LF[3]); c.put(x + 1, top, LF[4])  # 이끼
    for y in range(top, bot):                                    # 왼쪽 잘린 면(나이테)
        for x in range(1, 5):
            u, v = (x - 3.0) / 3.2, (y - (top + bot) / 2.0) / 5.2
            if u * u + v * v <= 1:
                rr = u * u + v * v
                c.put(x, y, SW[5] if rr < 0.2 else (SW[4] if rr < 0.55 else SW[3]))
    c.put(3, 8, SW[2])
    for bx in (wd // 3, wd * 2 // 3):                             # 가지 그루터기
        c.put(bx, 3, WD[3]); c.put(bx + 1, 3, WD[2]); c.put(bx, 2, WD[4])
    for x in range(wd - 4, wd - 1):                               # 부러진 오른쪽 끝
        c.put(x, top + 2 + (x % 2), WD[1])
    return _clean(c)


def stump(seed=0):
    """그루터기 16×16: 윗면 나이테 타원 + 어두운 통 + 뿌리."""
    c = Cv(T, T)
    ground_shadow(c, 9, 14, 7, 1.7, 70)
    cx = 8
    for x in range(3, 14):
        u = (x + 0.5 - cx) / 5.6
        yb = 12 + int(2.0 * math.sqrt(max(0.0, 1 - u * u)))
        for y in range(6, yb):
            t = 5 if u < -0.5 else (4 if u < 0.0 else (3 if u < 0.55 else 2))
            if rnd(x, y, seed + 5) < 0.18: t -= 1
            c.put(x, y, WD[max(1, t)])
    ell(c, cx, 6.5, 5.6, 3.0, lambda x, y, u, v: SW[6] if (u * u + v * v) < 0.12 else (SW[5] if (u * u + v * v) < 0.4 else (SW[4] if (u * u + v * v) < 0.75 else SW[3])))
    if seed % 2:
        c.put(8, 6, SW[2]); c.put(9, 6, SW[2])
    for (x, y) in ((3, 13), (2, 14), (13, 13), (14, 14)):
        c.put(x, y, WD[3] if x < 8 else WD[2])
    if seed == 1:
        c.put(5, 4, LF[4]); c.put(6, 3, LF[5]); c.put(5, 3, LF[3])  # 곁가지 새싹
    return _clean(c)


def objects():
    d = {}
    for i in range(3):
        d['fld_rock_s_' + 'abc'[i]] = rock_small(i * 3 + 1)
    d['fld_rock_m_a'] = rock_medium(2)
    d['fld_rock_m_b'] = rock_medium(5, tall=True)
    d['fld_rock_l_a'] = rock_large(4)
    d['fld_rock_l_b'] = rock_large(9)
    d['fld_boulder_mass'] = boulder_mass(6)
    d['fld_flowers_a'] = flowers(0)
    d['fld_flowers_b'] = flowers(1)
    d['fld_flowers_c'] = flowers(2)
    d['fld_bush_flower_a'] = bush_flower('l', 4, 0)
    d['fld_bush_flower_b'] = bush_flower('s', 5, 1)
    d['fld_bush_berry'] = bush_berry(3)
    d['fld_fern'] = fern()
    d['fld_log_a'] = log_fallen(1, True)
    d['fld_log_b'] = log_fallen(2, False)
    d['fld_stump_a'] = stump(0)
    d['fld_stump_b'] = stump(1)
    return d


def sheet(names, path, scale=4, bg=(88, 160, 53, 255)):
    """검수용: 조각들을 한 줄로(같은 배율)."""
    from PIL import Image
    o = objects()
    ims = [(n, o[n].img()) for n in names]
    W = sum(i.width * scale + 12 for _, i in ims) + 12
    H = max(i.height for _, i in ims) * scale + 24
    s = Image.new('RGBA', (W, H), bg)
    x = 12
    for n, i in ims:
        s.alpha_composite(i.resize((i.width * scale, i.height * scale), Image.NEAREST), (x, H - i.height * scale - 6))
        x += i.width * scale + 12
    s.convert('RGB').save(path)


if __name__ == '__main__':
    import sys
    names = sys.argv[2].split(',') if len(sys.argv) > 2 else list(objects())
    sheet(names, sys.argv[1], int(sys.argv[3]) if len(sys.argv) > 3 else 3)
    print('violations', len(VIOLATIONS))
