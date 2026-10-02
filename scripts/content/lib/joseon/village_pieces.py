"""소규모 마을(집 20채)용 새 조각 — 행랑채·주막·서당·대장간·연자방아·서낭당·굴뚝·사립문·토담.
모두 3/4 문법: 윗면(밝음) + 앞면(왼쪽 밝음 → 오른쪽 어둠) + 오른쪽 아래 땅 그림자. 건물은 blocks 의 조립 블록 위에 얹는다."""
import math
from tk import *
from build import outline
import blocks as K
from props5 import box, cyl, ell, shadow_ell, jar


def _lib():
    import catalog
    return catalog.lib()


def haengnang(w=7):
    """행랑채: 대문 곁에 길게 이어진 하인방·곳간 — 널문과 작은 창이 번갈아 줄지어 선 낮고 긴 기와집."""
    u = 'l' + ''.join('g' if i % 2 == 0 else 'w' for i in range(w - 2)) + 'r'
    b = 'l' + ''.join('g' if i % 2 == 0 else 'f' for i in range(w - 2)) + 'r'
    return K.assemble(K.house('jo', w, u, b, steps=tuple(range(1, w - 3, 2)), hip=True), _lib(), post=lambda cv: K.roof_baram(cv, 3, 'brown', wing=26))


def seodang():
    """서당: 갈색 기와에 처마 띠를 두른 학당 — 창이 넓은 사각 격자."""
    return K.assemble(K.house('jo', 4, 'lwwr', 'lffr', steps=(1,), hip=True), _lib(), post=lambda cv: K.roof_baram(cv, 3, 'giwa', wing=22, trim=True))


def jumak():
    """주막: 툇마루 초가 + 처마 밑 붉은 등롱 + 오른쪽에 높이 세운 술집 깃발(흰 천에 붉은 띠)."""
    base = K.assemble(K.house('jc', 5, 'lwoor', 'lfoor', steps=(2,), hip=True, chimi=False), _lib(), post=lambda cv: K.thatch_baram(cv, 3))
    c = Cv(base.w + T, base.h)
    c.paste(base, 0, 0)
    Wd = RGB['wood']; R = RGB['red']; P = RGB['plaster']; S = RGB['straw']
    px = base.w + 5
    for y in range(14, base.h - 14):                                   # 깃대: 굵은 장대
        c.put(px, y, Wd[5]); c.put(px + 1, y, Wd[5]); c.put(px + 2, y, Wd[4]); c.put(px + 3, y, Wd[2])
    c.put(px, 13, Wd[6]); c.put(px + 1, 13, Wd[5]); c.put(px + 2, 13, Wd[4])
    for y in range(16, 40):                                            # 깃발: 장대 왼쪽으로 늘어진 흰 천
        for x in range(px - 9, px):
            f = (px - x) / 9
            tone = 5 if f < 0.3 else (4 if f < 0.7 else 3)
            if y > 35: tone -= 1
            c.put(x, y, P[tone])
    for y in range(17, 20):                                            # 깃발 윗단 붉은 띠
        for x in range(px - 9, px): c.put(x, y, R[4] if x > px - 6 else R[3])
    ell(c, px - 4.5, 25, 1.9, 1.9, lambda x, y, u, v: R[5] if u < 0 else R[4])          # 술병(호리병): 작은 윗 원 + 큰 아랫 원
    ell(c, px - 4.5, 30, 3.4, 3.6, lambda x, y, u, v: R[5] if (u < -0.2 and v < 0) else (R[4] if u < 0.4 else R[3]))
    c.put(px - 5, 27, R[3]); c.put(px - 4, 27, R[3])
    c.hl(px - 9, px, 16, Wd[3])
    lx, ly = 22, 52                                                   # 처마 밑 붉은 등롱
    c.vl(lx, 49, 52, Wd[2])
    ell(c, lx, ly + 4, 3.4, 4.2, lambda x, y, u, v: R[5] if u < -0.2 else (R[4] if u < 0.4 else R[3]))
    c.hl(lx - 2, lx + 3, ly + 8, Wd[2])
    outline(c)
    return c


def smithy():
    """대장간: 열린 마루칸 초가 — 돌 화덕(불꽃 윗면)과 모루, 벽에 걸린 망치."""
    def post(cv):
        K.thatch_baram(cv, 3)
        S = RGB['stone']; E = RGB['earth']; Pn = RGB['persimmon']; G = RGB['giwa']; Wd = RGB['wood']
        box(cv, 36, 76, 14, 5, 6, S, (6, 5), (5, 4, 3, 2))               # 화덕
        ell(cv, 43, 70, 5.2, 2.2, lambda x, y, u, v: Pn[5] if (u * u + v * v) < 0.35 else (Pn[3] if v < 0.1 else Pn[2]))
        for dx in (-2, 1, 3): cv.put(43 + dx, 68, Pn[6])
        box(cv, 54, 77, 6, 3, 3, G, (5, 4), (4, 3, 2, 1))                # 모루 윗면 + 앞면
        cv.vl(56, 77, 80, G[2]); cv.put(52, 74, G[5])
        for y in range(52, 62):                                         # 벽에 걸린 집게·망치 자루
            cv.put(61, y, Wd[4])
        cv.hl(59, 63, 52, G[4])
    return K.assemble(K.house('jc', 4, 'loor', 'loor', steps=(), hip=True, chimi=False), _lib(), post=post)


def yeonja_mill():
    """연자방아 32×32: 둥근 돌 받침 위에 맷돌 돌을 얹고, 가운데 기둥에서 소를 매는 긴 채를 낸다."""
    c = Cv(2 * T, 2 * T)
    S = RGB['stone']; Wd = RGB['wood']
    shadow_ell(c, 18, 28, 14, 2.4, 70)
    cyl(c, 15, 17, 12.5, 5, S, (6, 5), (5, 4, 3, 2))
    cyl(c, 15, 12, 8.5, 5, S, (6, 5), (6, 5, 4, 3))
    for y in range(3, 12): c.put(15, y, Wd[5]); c.put(16, y, Wd[3])
    for k in range(0, 15):                                               # 채: 가운데에서 오른쪽 아래로
        c.put(16 + k, 9 + k // 3, Wd[5]); c.put(16 + k, 10 + k // 3, Wd[3])
    outline(c)
    return c


def seonangdang():
    """서낭당 32×48: 마을 어귀 돌무더기 + 색 헝겊을 매단 긴 장대(오방색)."""
    c = Cv(2 * T, 3 * T)
    S = RGB['stone']; Wd = RGB['wood']; R = RGB['red']; B = RGB['dblue']; P = RGB['plaster']; St = RGB['straw']
    shadow_ell(c, 19, 44, 14, 2.6, 70)
    for y in range(2, 38):
        c.put(15, y, Wd[5]); c.put(16, y, Wd[4]); c.put(17, y, Wd[2])
    c.put(15, 1, Wd[6]); c.put(16, 1, Wd[5])
    for k, (x, col, ln) in enumerate(((13, R[4], 10), (18, B[5], 12), (11, P[5], 9), (20, St[5], 8))):
        y0 = 6 + k * 3
        for y in range(y0, y0 + ln):
            c.put(x, y, col); c.put(x + (1 if x < 15 else -1), y, col)
        c.hl(min(x, 15), max(x, 15) + 1, y0, Wd[3])
    for (cx, cy, rx, ry) in ((9, 40, 6, 3.4), (22, 40, 6.5, 3.6), (15, 38, 7.5, 4), (12, 33, 5.5, 3.4), (19, 33, 5.5, 3.4), (15, 29, 4.6, 3.0)):
        ell(c, cx, cy, rx, ry, lambda x, y, u, v: S[6] if (v < -0.3 and u < 0.1) else (S[5] if v < 0.2 else (S[4] if u < 0.4 else S[3])))
    for (cx, cy) in ((8, 41), (21, 42), (14, 36), (18, 31)):
        c.put(cx, cy, S[2]); c.put(cx + 1, cy, S[2])
    outline(c)
    return c


def chimney():
    """굴뚝 16×32: 흙·막돌로 쌓은 낮은 굴뚝에 기와 모자를 씌웠다(꽃담 굴뚝의 소박한 형태)."""
    c = Cv(T, 2 * T)
    S = RGB['stone']; E = RGB['earth']; G = RGB['giwa']
    shadow_ell(c, 10, 29, 7, 1.8, 70)
    box(c, 4, 29, 9, 3, 15, E, (6, 5), (5, 4, 3, 2))
    for y in range(18, 28, 3):
        for x in range(4, 13): c.put(x, y, E[2])
    box(c, 3, 13, 11, 3, 3, G, (6, 5), (5, 4, 3, 2))              # 기와 모자
    box(c, 5, 10, 7, 2, 2, G, (6, 5), (5, 4, 3, 2))
    outline(c)
    return c


def sarip():
    """사립문 32×16: 두 기둥 사이 가는 가지를 엮은 반쯤 열린 문짝."""
    c = Cv(2 * T, T)
    Wd = RGB['wood']; S = RGB['straw']
    shadow_ell(c, 18, 14, 14, 1.6, 60)
    for px in (2, 27):
        box(c, px, 12, 3, 2, 12, Wd, (6, 5), (5, 4, 3, 2))
    for x in range(6, 25):                                              # 가지 엮은 문짝(한쪽이 올라간 기울기)
        top = 4 + (x - 6) // 7
        for y in range(top, 13):
            c.put(x, y, S[5] if x % 2 else S[3])
    for x in range(6, 25): c.put(x, 7 + (x - 6) // 9, Wd[3])
    outline(c)
    return c


def toldam():
    """토담 16×16: 황토를 쌓은 낮은 담에 짚 이엉 모자를 얹었다. 이어 붙여도 이음이 없다."""
    c = Cv(T, T)
    E = RGB['earth']; S = RGB['straw']
    shadow_ell(c, 9, 15, 9, 1.4, 60)
    for y in range(5, 14):                                              # 황토 몸체
        for x in range(T):
            f = 0.0
            tone = 5 if y < 8 else (4 if y < 11 else 3)
            if rnd(x, y, 31) > 0.9: tone -= 1
            c.put(x, y, E[tone])
    for x in range(T): c.put(x, 13, E[2])
    for y in range(1, 6):                                               # 짚 이엉 모자(앞으로 처진 윗면)
        for x in range(T):
            tone = 6 if y < 3 else (5 if y < 4 else 3)
            if (x + y) % 4 == 0: tone -= 1
            c.put(x, y, S[max(1, tone)])
    outline(c)
    return c
