"""3/4 소품 재작도 (2026-10-02, 사용자: 「항아리 같은 오브젝트와 담이 3/4 탑뷰를 만족하지 못한다」).

문법(버들항 기준 그림과 같은 규칙): 모든 덩어리 = 윗면(밝고, 앞가장자리에 하이라이트 한 줄) + 앞면(왼쪽 밝음 → 오른쪽 어두움)
+ 땅 그림자(오른쪽 아래). 원통·항아리는 입/윗면 타원이 반드시 보이고 밑바닥은 호(弧)로 둥글다. 정면 입면도 금지.
도구: box(직육면체), cyl(원통), jar(옹기), ell(타원 채움).
"""
import math
from tk import *
from build import outline


def ell(c, cx, cy, rx, ry, fn):
    """타원 안의 화소마다 fn(x, y, u, v) -> 색 또는 None. (u, v) = 중심 기준 정규화 좌표."""
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            u = (x + 0.5 - cx) / rx; v = (y + 0.5 - cy) / ry
            if u * u + v * v <= 1.0:
                col = fn(x, y, u, v)
                if col is not None: c.put(x, y, col)


def shadow_ell(c, cx, cy, rx, ry, al=70):
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1 and 0 <= x < c.w and 0 <= y < c.h and c.a[y, x, 3] == 0:
                c.put(x, y, SHADOW, al)


def box(c, x0, yf, w, depth, h, ramp, top=(6, 5), face=(5, 4, 3, 2)):
    """직육면체. yf = 앞면이 시작하는 y. 윗면은 그 위 depth 줄(앞가장자리 한 줄은 하이라이트), 앞면은 h 줄."""
    for r in range(depth):
        y = yf - depth + r
        for x in range(w):
            tone = top[0] if r == depth - 1 else top[1]
            if x == 0: tone = top[0]                              # 왼쪽 모서리 반사
            c.put(x0 + x, y, ramp[tone])
    for r in range(h):
        for x in range(w):
            f = x / max(1, w - 1)
            t = face[0] if f < 0.25 else (face[1] if f < 0.6 else (face[2] if f < 0.88 else face[3]))
            if r == 0: t = max(1, t - 1)                           # 윗면 바로 밑 모서리 그늘
            if r == h - 1: t = max(1, t - 1)
            c.put(x0 + x, yf + r, ramp[t])


def cyl(c, cx, yc, rx, h, ramp, top=(6, 5), body=(5, 4, 3, 2), open_ring=None):
    """원통: 윗면 타원 중심 (cx, yc), 높이 h, 밑은 호. open_ring=(안쪽 반경 비율, 위 색, 아래 색) 이면 윗면 가운데를 파낸다."""
    ry = max(2.0, rx * 0.46)
    for x in range(int(cx - rx), int(cx + rx) + 1):
        u = (x + 0.5 - cx) / rx
        if abs(u) > 1: continue
        yb = yc + h + ry * math.sqrt(max(0.0, 1 - u * u))
        for y in range(int(yc), int(yb) + 1):
            t = body[0] if u < -0.5 else (body[1] if u < 0.0 else (body[2] if u < 0.55 else body[3]))
            c.put(x, y, ramp[t])

    def topfn(x, y, u, v):
        if open_ring and (u * u + v * v) <= open_ring[0] ** 2:
            return open_ring[1] if v < 0.3 else open_ring[2]
        edge = u * u + v * v > 0.72
        return ramp[top[0]] if (edge and v < 0.2) or u < -0.6 else ramp[top[1]]
    ell(c, cx, yc, rx, ry, topfn)


def jar(c, cx, ybase, h, belly, lid=True, tone=(5, 4, 3, 2), ramp=None):
    """옹기: 어깨가 둥글고 입이 좁은 몸통(회전체), 위에 입 타원(열림=어두운 속 / 닫힘=헝겊 덮개 돔), 밑은 호."""
    ramp = ramp or RGB['wood']
    prof = [(0.0, 3.0), (0.10, 2.8), (0.22, 4.0), (0.42, belly), (0.70, belly * 0.9), (1.0, belly * 0.62)]

    def hw(t):
        for (a, wa), (b, wb) in zip(prof, prof[1:]):
            if a <= t <= b:
                k = (t - a) / (b - a); k = k * k * (3 - 2 * k)
                return wa + (wb - wa) * k
        return prof[-1][1]
    ytop = ybase - h
    for y in range(ytop, ybase):
        t = (y - ytop) / max(1, h - 1)
        w = hw(t)
        if y >= ybase - 3:                                         # 밑바닥 호(바닥 타원)
            w -= (2.4 if y == ybase - 1 else (1.2 if y == ybase - 2 else 0.5))
        for x in range(int(round(cx - w)), int(round(cx + w)) + 1):
            u = (x - cx) / max(1.0, w)
            ti = tone[0] if u < -0.45 else (tone[1] if u < 0.05 else (tone[2] if u < 0.6 else tone[3]))
            if ((x + y) % 5 == 0) and rnd(x, y, 3) > 0.7: ti = max(1, ti - 1)
            c.put(x, y, ramp[ti])
    for y in range(ytop + 4, ytop + 7):                            # 어깨 하이라이트(왼쪽 위)
        c.put(int(cx - hw((y - ytop) / h) * 0.55), y, ramp[6])
    rim = max(2.2, belly * 0.55)
    if lid:
        S = RGB['plaster']; St = RGB['straw']
        ell(c, cx, ytop, rim + 0.9, 1.8, lambda x, y, u, v: (S[5] if u < 0.1 else S[4]) if v < 0.4 else St[3])
        c.put(int(cx), int(ytop) - 1, St[4])                         # 덮개 매듭
        c.hl(int(cx - rim - 1), int(cx + rim + 2), int(ytop) + 1, St[2])   # 묶은 끈
    else:
        ell(c, cx, ytop, rim + 0.6, 1.8, lambda x, y, u, v: ramp[6] if (u * u + v * v > 0.55 and v < 0.3) else (ramp[1] if v > -0.2 else ramp[0]))
        ell(c, cx, ytop + 0.3, rim - 1.0, 1.0, lambda x, y, u, v: ramp[0])


def jars():
    """장독대 32×32: 옹기 셋 — 하나는 입이 열려 속이 보이고 둘은 헝겊 덮개. 입 타원은 같은 시점, 밑은 호, 항아리마다 오른쪽 아래 그림자."""
    c = Cv(2 * T, 2 * T)
    for cx, yb, rx in ((9, 29, 7.0), (19, 30, 6.4), (27, 29, 4.6)):
        shadow_ell(c, cx + 2.5, yb + 0.5, rx + 1.5, 1.8, 75)
    jar(c, 8, 28, 19, 7.4, lid=True)
    jar(c, 19, 29, 15, 6.6, lid=False)
    jar(c, 27, 28, 11, 4.6, lid=True)
    outline(c)
    return c


def well():
    """우물 32×32: 둥근 돌 우물돌(윗면 고리 + 안쪽 물 타원 + 앞면 돌쌓기), 두 기둥에 가로보를 건 두레박틀, 두레박."""
    c = Cv(2 * T, 2 * T)
    S = RGB['stone']; Wd = RGB['wood']; Wt = RGB['water']
    cx, yc, rx = 16, 19, 11
    shadow_ell(c, 18, 28.5, 13, 2.2, 70)
    for px in (5, 25):                                           # 기둥(우물돌 뒤에 서서 위로)
        for y in range(4, yc + 2):
            c.put(px, y, Wd[5]); c.put(px + 1, y, Wd[4]); c.put(px + 2, y, Wd[2])
        c.put(px, 3, Wd[6]); c.put(px + 1, 3, Wd[5]); c.put(px + 2, 3, Wd[4])
    for x in range(4, 29): c.put(x, 5, Wd[6]); c.put(x, 6, Wd[5]); c.put(x, 7, Wd[3])      # 가로보(윗면 + 앞면)
    cyl(c, cx, yc, rx, 7, S, (6, 5), (5, 4, 3, 2), open_ring=(0.72, Wt[3], Wt[2]))
    ell(c, cx - 1, yc + 0.5, 5.2, 2.2, lambda x, y, u, v: Wt[5] if (v < -0.2 and u < 0.1) else None)
    for x in range(int(cx - rx), int(cx + rx) + 1):                # 앞면 돌 줄눈
        u = (x + 0.5 - cx) / rx
        if abs(u) <= 1 and (x - 5) % 6 == 0:
            yb = int(yc + 3 + 0.46 * rx * math.sqrt(max(0.0, 1 - u * u)))
            for y in range(yb - 2, yb + 5): c.put(x, y, S[2])
    for y in range(8, yc): c.put(16, y, Wd[2])                   # 줄
    for yy in range(yc - 2, yc + 2):                              # 두레박(우물돌 윗면에 걸쳐 둠)
        for xx in range(19, 25): c.put(xx, yy, Wd[4] if xx < 22 else Wd[3])
    c.hl(19, 25, yc - 3, Wd[6]); c.hl(19, 25, yc - 2, Wd[2])
    outline(c)
    return c


def bench():
    """평상 32×16: 윗면(밝고 널 이음은 은은) 8줄 + 어두운 앞 띠 3줄 + 앞다리·뒷다리, 오른쪽 아래 그림자."""
    c = Cv(2 * T, T)
    Wd = RGB['wood']
    shadow_ell(c, 19, 14.6, 15, 1.3, 70)
    for lx in (5, 24):                                            # 뒷다리(윗면 뒤로 살짝 보임, 어둡게)
        c.put(lx, 9, Wd[1]); c.put(lx + 1, 9, Wd[1])
    for y in range(1, 9):                                         # 윗면: 거의 한 톤, 널 이음은 4줄마다 한 톤만 어둡게
        for x in range(1, 31):
            tone = 6 if (y == 8 or x == 1) else (5 if y % 4 else 4)
            if y == 1: tone = 5
            c.put(x, y, Wd[tone])
    for x in range(1, 31): c.put(x, 8, Wd[6])                      # 윗면 앞가장자리 하이라이트
    for x in range(1, 31):                                        # 앞 띠(장귀틀) 4줄: 왼쪽 밝음 → 오른쪽 어두움
        f = (x - 1) / 29
        t = 4 if f < 0.3 else (3 if f < 0.7 else 2)
        c.put(x, 9, Wd[t]); c.put(x, 10, Wd[t]); c.put(x, 11, Wd[max(1, t - 1)]); c.put(x, 12, Wd[1])
    for lx in (2, 27):                                            # 앞다리
        for y in range(13, 15):
            c.put(lx, y, Wd[4]); c.put(lx + 1, y, Wd[3]); c.put(lx + 2, y, Wd[2])
    outline(c)
    return c


def haystack():
    """낟가리 32×32: 원뿔형 짚단 더미 — 밑은 타원 호, 새끼줄 띠는 원뿔을 도는 곡선(앞으로 처짐), 꼭대기 매듭."""
    c = Cv(2 * T, 2 * T)
    S = RGB['straw']; Wd = RGB['wood']
    cx, apex, ybase, rx, ry = 16, 4, 25, 12.5, 3.6
    shadow_ell(c, 18, 28.4, 14, 2.4, 70)
    for y in range(apex, int(ybase + ry) + 1):
        if y <= ybase:
            hw = rx * ((y - apex + 1) / (ybase - apex + 1)) ** 0.9
        else:
            hw = rx * math.sqrt(max(0.0, 1 - ((y - ybase) / ry) ** 2))
        for x in range(int(round(cx - hw)), int(round(cx + hw)) + 1):
            u = (x - cx) / max(1.0, hw)
            tone = 5 if u < -0.45 else (4 if u < 0.0 else (3 if u < 0.35 else 2))
            if u > 0.55: tone = 1
            if y < apex + 4 and u < 0.2: tone = min(6, tone + 1)           # 둥근 봉우리 윗면 하이라이트
            if rnd(x, y, 7) < 0.15: tone = max(1, tone - 1)
            c.put(x, y, S[tone])
    for yb in (10, 16, 22):                                       # 새끼줄: 원뿔을 도는 호
        hwb = rx * ((yb - apex + 1) / (ybase - apex + 1)) ** 0.9
        for x in range(int(round(cx - hwb)), int(round(cx + hwb)) + 1):
            u = (x - cx) / max(1.0, hwb)
            y = int(round(yb + 3.2 * (1 - u * u)))
            c.put(x, y, Wd[3] if u < 0.2 else Wd[2]); c.put(x, y + 1, S[1])
            if u < -0.1 and rnd(x, yb, 5) > 0.4: c.put(x, y - 1, S[6])
    for dx, dy, t in ((0, 3, 5), (1, 3, 4), (0, 2, 6), (-1, 3, 5), (1, 2, 4)):   # 꼭대기 매듭
        c.put(cx + dx, apex + dy - 2, S[t])
    outline(c)
    return c


def fence_h():
    """싸리·판자 울타리 16×16(가로로 이어붙임): 말뚝 둘은 직육면체(윗면+앞면), 가로대 둘은 앞으로 튀어나온 직육면체(윗면 2줄 + 앞면 2줄), 오른쪽 아래 그림자."""
    c = Cv(T, T)
    Wd = RGB['wood']; S = RGB['straw']
    for x in range(T): c.put(x, 15, SHADOW, 85); c.put(x, 14, SHADOW, 45)
    for px in (1, 10):                                             # 말뚝: 윗면 2줄 + 앞면 10줄, 오른쪽 옆면 1px
        box(c, px, 6, 4, 2, 8, Wd, (6, 5), (5, 4, 3, 2))
        c.put(px + 1, 3, Wd[6]); c.put(px + 2, 3, Wd[5]); c.put(px + 1, 4, Wd[6]); c.put(px + 2, 4, Wd[5])   # 뾰족한 끝
    for yf in (7, 11):                                             # 가로대: 말뚝 앞에 걸친 직육면체
        box(c, 0, yf, T, 2, 2, S, (6, 5), (5, 4, 3, 2))
    return c


# ---- 담(토석담): 기와 덮개를 얹은 낮은 돌담. 윗면(뒤 사면·용마루) + 앞 사면(기왓골) + 처마 끝 + 돌쌓기 앞면 ----
def _cap_rows(c, x0, x1, y0=0, round_l=False, round_r=False, groove=4):
    """덮개 8줄: 0~2 윗면(줄무늬 없이 가장 밝다, 왼쪽 모서리 반사) · 3 용마루 아래 어두운 이음선 · 4~6 앞 기왓면(세로 기왓골) · 7 처마 끝."""
    Wd = RGB['wood']
    for r in range(8):
        for x in range(x0, x1):
            lx = x - x0
            if r < 3: col = Wd[6] if (r < 2 or lx < 3) else Wd[5]
            elif r == 3: col = Wd[3]
            elif r < 7:
                col = Wd[5] if lx % groove in (0, 1) else (Wd[4] if lx % groove == 2 else Wd[3])
                if r == 6: col = Wd[4] if lx % groove in (0, 1) else Wd[3]
            else:
                col = Wd[3] if lx % 4 in (0, 1) else Wd[1]
            if round_l and lx < 2 and r in (0, 7): continue
            if round_r and x1 - 1 - x < 2 and r in (0, 7): continue
            c.put(x, y0 + r, col)


_RUBS = [  # 줄마다 돌 폭 분할(합 16) — 3가지 변형, 줄이 어긋나 이음이 타일 경계에서 이어진다
    [[(0, 6), (6, 11), (11, 16)], [(0, 4), (4, 10), (10, 16)], [(0, 8), (8, 16)], [(0, 5), (5, 11), (11, 16)], [(0, 3), (3, 9), (9, 16)]],
    [[(0, 5), (5, 12), (12, 16)], [(0, 7), (7, 11), (11, 16)], [(0, 4), (4, 9), (9, 16)], [(0, 9), (9, 16)], [(0, 6), (6, 12), (12, 16)]],
    [[(0, 8), (8, 16)], [(0, 3), (3, 9), (9, 16)], [(0, 6), (6, 12), (12, 16)], [(0, 4), (4, 11), (11, 16)], [(0, 7), (7, 16)]],
]


def _rubble(c, x0, x1, y0, y1, var=0):
    """막돌 쌓기: 줄 높이 4~5px, 돌마다 윗면 반사(왼쪽 밝음)와 줄눈, 오른쪽이 어둡다."""
    S = RGB['stone']
    n = len(_RUBS[var % 3])
    bounds = [y0 + (y1 - y0) * i // n for i in range(n + 1)]
    for ri in range(n):
        a, b = bounds[ri], bounds[ri + 1]
        for (bx0, bx1) in _RUBS[var % 3][ri]:
            for yy in range(a, b):
                for xx in range(max(x0, bx0), min(x1, bx1)):
                    edge = xx == bx0 or yy == b - 1
                    if edge: tone = 2
                    elif yy == a: tone = 6 if xx < bx0 + (bx1 - bx0) * 0.7 else 5         # 돌 윗면 반사
                    else: tone = 5 if xx < bx0 + (bx1 - bx0) * 0.55 else 4
                    if xx > 11: tone = max(2, tone - 1)                                   # 오른쪽 어둡게
                    if not edge and rnd(xx, yy, 73 + var) < 0.14: tone = max(2, tone - 1)
                    c.put(xx, yy, S[tone])


def wall_h2(seed=0):  # seed 0~2 = 돌 배열 변형
    """가로 담 16×32: 덮개 8줄 + 처마 밑 그늘 + 막돌 쌓기 22줄 + 땅 그림자. 사람 키만큼 높다. 이어 붙이면 이음 없이 이어진다."""
    c = Cv(T, 2 * T)
    _rubble(c, 0, T, 9, 30, seed)
    for x in range(T): c.put(x, 8, RGB['stone'][1]); c.put(x, 9, RGB['stone'][1])      # 처마 밑 그늘 2줄
    _cap_rows(c, 0, T, groove=(3, 8, 11)[seed % 3])
    for x in range(T): c.put(x, 30, RGB['stone'][1]); c.put(x, 31, SHADOW, 80)
    return c


_BX0, _BX1 = 2, 14          # 세로 담이 차지하는 칸 안 x 범위(2..13): 덮개 6px + 돌 옆면 6px


def _vband(c, y0, y1, east=False, face=True):
    """세로로 달리는 담: 덮개(위에서 본 기와 사면) 6px + 돌 옆면 6px(막돌 줄눈). 서쪽 담은 덮개가 바깥(왼쪽), 동쪽 담은 덮개가 바깥(오른쪽)이라
    돌 면은 언제나 마당 안쪽을 본다. 가로 담과 같은 재료·같은 덮개 색."""
    Wd = RGB['wood']; S = RGB['stone']
    cap = (Wd[6], Wd[6], Wd[6], Wd[5], Wd[5], Wd[4])
    cx0, sx0 = (_BX1 - 6, _BX0) if east else (_BX0, _BX0 + 6)
    for y in range(y0, y1):
        for lx in range(6):
            col = cap[lx]
            if y % 4 == 3 and lx in (3, 4): col = Wd[2]
            c.put(cx0 + lx, y, col)
        if face:
            for lx in range(6):
                row = y // 5; ry = y % 5
                bx = (lx + (row % 2) * 3) % 6
                tone = 4 if lx < 3 else 3
                if ry == 0: tone += 1
                if ry == 4: tone = 1
                if bx == 0: tone = max(1, tone - 2)
                c.put(sx0 + lx, y, S[tone])


def wall_v2(east=False):
    """세로 담 16×16: 덮개 + 돌 옆면 + 바깥쪽 땅 그림자. 위아래로 이음 없이 이어진다."""
    c = Cv(T, T)
    _vband(c, 0, T, east)
    sx = _BX1 if east else _BX0 - 1
    for y in range(T):
        if east: c.put(_BX1, y, SHADOW, 70); c.put(_BX1 + 1, y, SHADOW, 45)
        else: c.put(_BX0 - 1, y, SHADOW, 55)
    return c


def wall_corner4(kind):
    """담 모서리 16×32. NW/NE = 북쪽 모서리(가로 담이 한쪽으로, 세로 담이 아래로 이어진다), SW/SE = 남쪽 모서리.
    세로 담 띠(x 2..13)가 가로 담 덮개 줄과 이어져 한 덩어리로 보이고, 돌 면은 마당 안쪽을 본다."""
    c = Cv(T, 2 * T)
    S = RGB['stone']
    west = kind[1] == 'W'            # NW·SW: 세로 담이 왼쪽, 가로 담이 오른쪽(동)으로 뻗는다
    hx0, hx1 = (_BX0, T) if west else (0, _BX1)
    _rubble(c, hx0, hx1, 9, 30, 1 if west else 2)
    for x in range(hx0, hx1): c.put(x, 8, S[1]); c.put(x, 9, S[1])
    _cap_rows(c, hx0, hx1)
    if kind[0] == 'N':
        _vband(c, 8, 2 * T, east=not west)
        for y in range(8, 2 * T):
            if not west: c.put(_BX1, y, SHADOW, 60); c.put(_BX1 + 1, y, SHADOW, 40)
    else:
        _vband(c, 0, 9, east=not west, face=False)
    for x in range(hx0, hx1): c.put(x, 30, S[1]); c.put(x, 31, SHADOW, 80)
    return c


def flower_bed():
    """화단 32×16: 돌 두른 흙 상자 — 흙 윗면(깊이 8줄) + 돌 앞면 3줄 + 땅 그림자, 흙 위에 붉은·노란·흰 꽃."""
    c = Cv(2 * T, T)
    E = RGB['earth']; S = RGB['stone']; G = RGB['leaf']; R = RGB['red']; Y = RGB['straw']; P = RGB['plaster']
    for y in range(2, 10):
        for x in range(1, 31):
            c.put(x, y, E[3] if (x + y) % 3 else E[2])
    for x in range(1, 31): c.put(x, 2, S[5]); c.put(x, 9, S[6] if x < 16 else S[5])        # 뒤·앞 돌 윗면
    for y in range(2, 10): c.put(1, y, S[6]); c.put(30, y, S[4])                            # 좌·우 돌 윗면
    for a, b in ((10, 12), (12, 14)):                                                       # 앞면: 돌 두 줄
        for x in range(1, 31):
            f = (x - 1) / 29
            t = 5 if f < 0.25 else (4 if f < 0.65 else 3)
            if (x + a * 2) % 8 == 0: t = 1
            if a == 12: t = max(1, t - 1)
            for y in range(a, b): c.put(x, y, S[t])
    for k in range(13):
        x = 3 + int(rnd(k, 1, 51) * 25); y = 3 + int(rnd(k, 2, 52) * 5)
        c.put(x, y + 1, G[3]); c.put(x, y, [R[4], Y[5], P[6]][k % 3])
    shadow_ell(c, 17, 14.8, 15, 1.0, 70)
    return c


def mat_peppers():
    """멍석 32×16: 바닥에 펼친 짚 멍석(윗면, 앞쪽이 조금 두껍게 보임) 위에 붉은 고추가 줄지어 널린다."""
    c = Cv(2 * T, T)
    S = RGB['straw']; R = RGB['red']
    for y in range(2, 12):
        for x in range(1, 31):
            c.put(x, y, S[4] if ((x // 2) + (y // 2)) % 2 else S[3])
    c.hl(1, 31, 2, S[5]); c.vl(1, 2, 12, S[5]); c.vl(30, 2, 12, S[3])
    for x in range(1, 31):                                                                   # 앞 가장자리 두께 3줄(왼쪽 밝음 → 오른쪽 어두움)
        t = 4 if x < 10 else (3 if x < 22 else 2)
        c.put(x, 12, S[t]); c.put(x, 13, S[max(1, t - 1)]); c.put(x, 14, S[1])
    for row, y in enumerate((3, 6, 9)):
        for k in range(5):
            x = 3 + k * 5 + (2 if row % 2 else 0)
            for i in range(5):
                yy = y + (1 if i >= 3 else 0)
                c.put(x + i, yy, R[3] if i else R[2]); c.put(x + i, yy + 1, R[2] if i % 2 else R[1])
            c.put(x + 1, y, R[5]); c.put(x + 2, y, R[4])
            c.put(x - 1, y, RGB['leaf'][3])
    shadow_ell(c, 17, 14.8, 15, 1.0, 60)
    outline(c)
    return c


def bridge():
    """나무다리 80×64: 윗면(널이 강을 가로질러 놓임, 밝고 이음은 은은) + 뒤 난간(윗면+가로대+동자기둥) + 낮은 앞 난간 + 앞 보 두께면 + 양쪽 막돌 교대(윗면 보임)."""
    W, H = 5 * T, 4 * T
    c = Cv(W, H)
    Wd = RGB['wood']; S = RGB['stone']
    top, bot = 18, 40
    for y in range(top, bot):                                      # 갑판 윗면
        for x in range(4, W - 4):
            k = (x - 4) % 6
            tone = 6 if y < top + 2 else (5 if k < 5 else 4)
            if (x // 6 + y // 9) % 3 == 0 and y % 9 == 8: tone = 4            # 널 끝 이음(엇갈림)
            c.put(x, y, Wd[tone])
    for x in range(4, W - 4):                                      # 앞 보 두께면
        c.put(x, bot, Wd[3]); c.put(x, bot + 1, Wd[2]); c.put(x, bot + 2, Wd[1])
    # 뒤 난간: 윗면 1줄 + 앞면 2줄 + 아래 가로대, 동자기둥은 갑판 뒤끝까지
    for yy, tone in ((9, 6), (10, 4), (11, 3)): c.hl(4, W - 4, yy, Wd[tone])
    c.hl(4, W - 4, 15, Wd[3]); c.hl(4, W - 4, 16, Wd[1])
    for x in range(10, W - 10, 14):
        for y in range(11, top):
            c.put(x, y, Wd[4]); c.put(x + 1, y, Wd[3]); c.put(x + 2, y, Wd[1])
    # 앞 난간: 낮게(윗면 + 앞면 2줄), 갑판 앞쪽에서 올라온다
    for yy, tone in ((33, 6), (34, 5), (35, 4), (36, 3)): c.hl(4, W - 4, yy, Wd[tone])
    for x in range(10, W - 10, 14):
        for y in range(33, bot + 2):
            c.put(x, y, Wd[5] if y < 36 else Wd[4]); c.put(x + 1, y, Wd[4] if y < 36 else Wd[3]); c.put(x + 2, y, Wd[2])
        c.put(x, 32, Wd[6]); c.put(x + 1, 32, Wd[5])
    # 막돌 교대: 윗면(밝음) + 앞면
    for (a, b2) in ((0, 7), (W - 7, W)):
        for y in range(top - 2, bot + 4):
            for x in range(a, b2):
                f = (x - a) / 6
                tone = 5 if y < top + 1 else (4 if (x * 3 + y) % 5 else 3)
                c.put(x, y, S[tone])
        for (sy, sh) in ((top + 4, 5), (top + 10, 5), (top + 16, 5)):
            for xx in range(a, b2): c.put(xx, sy + sh - 1, S[2])
    outline(c)
    for x in range(8, W - 8):                                      # 물에 비친 그림자
        for j in range(2):
            if c.a[bot + 4 + j, x, 3] == 0: c.put(x, bot + 4 + j, SHADOW, 90 - j * 40)
    return c


def bank_stairs():
    """석축 둑을 가르는 돌계단 16×32: 디딤면(밝음 3줄) 넓고 챌면(어두움 2줄) 좁다. 양옆 둑 윗돌은 계단 경사를 따라 사선으로 낮아진다."""
    c = Cv(T, 2 * T)
    S = RGB['stone']; G = RGB['leaf']; E = RGB['earth']
    for x in range(T): c.put(x, 0, G[3]); c.put(x, 1, G[2])
    for k in range(5):
        y0 = 2 + k * 5
        for y in range(y0, y0 + 5):
            for x in range(2, 14):
                if y - y0 < 3: tone = 6 if y == y0 + 2 else 5                  # 디딤면: 앞가장자리 하이라이트
                else: tone = 3 if y == y0 + 3 else 2                           # 챌면
                if x < 4 and y - y0 >= 3: tone = tone + 1
                c.put(x, y, S[tone])
        for x in (0, 1):                                                       # 왼쪽 둑 돌: 윗면 밝음 + 앞면
            c.put(x, y0, S[6]); c.put(x, y0 + 1, S[5])
            for y in range(y0 + 2, y0 + 5): c.put(x, y, S[4])
        for x in (14, 15):
            c.put(x, y0, S[5]); c.put(x, y0 + 1, S[4])
            for y in range(y0 + 2, y0 + 5): c.put(x, y, S[2])
    for x in range(T): c.put(x, 30, E[2]); c.put(x, 31, SHADOW, 90)
    return c


def stone_bank(left=False, right=False):
    """석축 둑 16×32: 위는 풀 가장자리, 가장 윗 돌 줄은 밝은 윗면(갓돌) 2줄, 그 아래 앞면은 크기가 다른 막돌(왼쪽 밝음). 줄눈 위치는 칸마다 어긋난다."""
    c = Cv(T, 2 * T)
    S = RGB['stone']; G = RGB['leaf']; E = RGB['earth']
    for x in range(T):
        c.put(x, 0, G[3]); c.put(x, 1, G[2])
    for x in range(T):                                                          # 갓돌 윗면
        c.put(x, 2, S[6]); c.put(x, 3, S[5] if (x // 5) % 2 else S[6])
    rows = [(4, 10), (10, 16), (16, 23), (23, 30)]
    for ri, (y0, y1) in enumerate(rows):
        x = -((ri * 5 + 3) % 7)
        k = 0
        while x < T:
            w = 5 + int(rnd(k, ri, 31) * 6)
            for yy in range(y0, y1):
                for xx in range(max(0, x), min(T, x + w)):
                    edge = xx in (x, x + w - 1) or yy in (y0, y1 - 1)
                    lit = (yy - y0) < 2 and xx > x
                    tone = 2 if edge and (xx > x or yy == y1 - 1) else (6 if lit else (5 if xx < x + w // 2 else 4))
                    if tone >= 4 and rnd(xx, yy, 33) < 0.15: tone -= 1
                    c.put(xx, yy, S[tone])
            x += w; k += 1
    for x in range(T):
        c.put(x, 30, E[2]); c.put(x, 31, SHADOW, 90)
    return c
