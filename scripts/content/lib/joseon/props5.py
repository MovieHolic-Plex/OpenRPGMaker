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
        if y >= ybase - 2:                                         # 밑바닥 호
            w -= (1.2 if y == ybase - 1 else 0.5)
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
    """장독대 32×32: 돌판(윗면+앞면) 위에 옹기 셋 — 하나는 입이 열려 속이 보이고 둘은 헝겊 덮개. 위 윗면 타원이 보인다."""
    c = Cv(2 * T, 2 * T)
    S = RGB['stone']
    box(c, 1, 27, 30, 5, 3, S, (6, 5), (5, 4, 3, 2))
    shadow_ell(c, 18, 31, 15, 1.2, 60)
    jar(c, 8, 27, 19, 7.4, lid=True)
    jar(c, 19, 28, 15, 6.6, lid=False)
    jar(c, 27, 27, 11, 4.6, lid=True)
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
    """평상 32×16: 깊은 널 윗면(널결이 가로로 이어짐) + 앞 띠 + 짧은 다리, 아래 그림자."""
    c = Cv(2 * T, T)
    Wd = RGB['wood']
    shadow_ell(c, 17, 15, 15, 1.2, 60)
    for y in range(1, 9):                                         # 윗면: 널 사이 어두운 줄
        for x in range(1, 31):
            tone = 6 if y == 8 else (5 if (y % 3) else 3)
            if x == 1: tone = 6
            c.put(x, y, Wd[tone])
    for x in range(1, 31):                                        # 앞 띠(장귀틀)
        c.put(x, 9, Wd[4] if x < 14 else Wd[3]); c.put(x, 10, Wd[3] if x < 20 else Wd[2]); c.put(x, 11, Wd[2])
    for lx in (2, 27):                                            # 앞다리
        for y in range(12, 15):
            c.put(lx, y, Wd[4]); c.put(lx + 1, y, Wd[3]); c.put(lx + 2, y, Wd[2])
    for lx in (6, 23):
        c.put(lx, 12, Wd[2]); c.put(lx + 1, 12, Wd[1])
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
            hw = rx * ((y - apex + 1) / (ybase - apex + 1)) ** 0.92
        else:
            hw = rx * math.sqrt(max(0.0, 1 - ((y - ybase) / ry) ** 2))
        for x in range(int(round(cx - hw)), int(round(cx + hw)) + 1):
            u = (x - cx) / max(1.0, hw)
            tone = 5 if u < -0.4 else (4 if u < 0.15 else (3 if u < 0.6 else 2))
            if rnd(x, y, 7) < 0.15: tone = max(1, tone - 1)
            c.put(x, y, S[tone])
    for yb in (10, 16, 22):                                       # 새끼줄: 원뿔을 도는 호
        hwb = rx * ((yb - apex + 1) / (ybase - apex + 1)) ** 0.92
        for x in range(int(round(cx - hwb)), int(round(cx + hwb)) + 1):
            u = (x - cx) / max(1.0, hwb)
            y = int(round(yb + 1.8 * (1 - u * u)))
            c.put(x, y, Wd[3] if u < 0.2 else Wd[2]); c.put(x, y + 1, S[1])
            if u < -0.1 and rnd(x, yb, 5) > 0.4: c.put(x, y - 1, S[6])
    for dx, dy, t in ((0, 3, 5), (1, 3, 4), (0, 2, 6), (-1, 3, 5), (1, 2, 4)):   # 꼭대기 매듭
        c.put(cx + dx, apex + dy - 2, S[t])
    outline(c)
    return c


def fence_h():
    """싸리·판자 울타리 16×16(가로로 이어붙임): 말뚝 윗면+앞면, 두 가로대는 윗면 한 줄 + 앞면 두 줄, 땅 그림자."""
    c = Cv(T, T)
    Wd = RGB['wood']; S = RGB['straw']
    for px in (1, 9):                                              # 말뚝(뒤에 선다): 끝이 뾰족, 윗면 밝은 점
        for y in range(4, 15):
            c.put(px, y, Wd[5]); c.put(px + 1, y, Wd[4]); c.put(px + 2, y, Wd[2])
        c.put(px, 3, Wd[6]); c.put(px + 1, 3, Wd[6]); c.put(px + 1, 2, Wd[6])
    for yt in (6, 11):                                             # 가로대(앞): 윗면 한 줄 + 앞면 두 줄
        for x in range(T):
            c.put(x, yt, S[6]); c.put(x, yt + 1, S[5] if x % 8 < 4 else S[4]); c.put(x, yt + 2, S[3])
    for x in range(T): c.put(x, 15, SHADOW, 90)
    return c


# ---- 담(토석담): 기와 덮개를 얹은 낮은 돌담. 윗면(뒤 사면·용마루) + 앞 사면(기왓골) + 처마 끝 + 돌쌓기 앞면 ----
def _cap_rows(c, x0, x1, y0=0, round_l=False, round_r=False):
    """덮개 8줄: 0~1 뒤 사면(밝음) · 2 용마루(가장 밝음) · 3~6 앞 사면(기왓골 세로줄) · 7 처마 끝(어두운 그늘 + 둥근 막새)."""
    P = RGB['persimmon']; Wd = RGB['wood']; S = RGB['straw']
    for r in range(8):
        for x in range(x0, x1):
            lx = x - x0
            if r < 2: col = P[5] if r == 1 else P[4]
            elif r == 2: col = S[6]
            elif r < 7:
                col = P[4] if lx % 4 in (0, 1) else (P[3] if lx % 4 == 2 else P[2])
                if r >= 5: col = P[3] if lx % 4 in (0, 1) else P[2]
            else:
                col = Wd[3] if lx % 4 in (0, 1) else Wd[1]
            if round_l and lx < 2 and r in (0, 7): continue
            if round_r and x1 - 1 - x < 2 and r in (0, 7): continue
            c.put(x, y0 + r, col)


_RUB = [[(0, 6), (6, 11), (11, 16)], [(0, 4), (4, 10), (10, 16)]]       # 이음이 타일 경계에서 이어지는 돌 폭(합 16)


def _rubble(c, x0, x1, y0, y1):
    S = RGB['stone']
    rows = [(y0, y0 + 4), (y0 + 4, y1)]
    for ri, (a, b) in enumerate(rows):
        for (bx0, bx1) in _RUB[ri]:
            for yy in range(a, b):
                for xx in range(max(x0, bx0), min(x1, bx1)):
                    edge = xx == bx0 or yy == b - 1
                    if edge: tone = 1
                    elif yy == a: tone = 5 if xx < bx0 + (bx1 - bx0) * 0.7 else 4         # 돌 윗면 반사
                    else: tone = 4 if xx < bx0 + (bx1 - bx0) * 0.55 else 3
                    if not edge and rnd(xx, yy, 73) < 0.14: tone = max(2, tone - 1)
                    c.put(xx, yy, S[tone])


def wall_h2(seed=0):
    """가로 담 16×16: 덮개 8줄 + 돌쌓기 7줄(덮개 밑은 그늘) + 땅 그림자. 이어 붙이면 이음 없이 이어진다."""
    c = Cv(T, T)
    _rubble(c, 0, T, 8, 15)
    for x in range(T): c.put(x, 8, RGB['stone'][1])                # 처마 밑 그늘
    _cap_rows(c, 0, T)
    for x in range(T): c.put(x, 15, SHADOW, 80)
    return c


def wall_v2():
    """세로 담 16×16: 위에서 본 덮개 띠(10px) — 가운데 용마루, 왼쪽 사면 밝음·오른쪽 사면 어둠, 기왓골은 사면을 가로지르는 줄."""
    c = Cv(T, T)
    P = RGB['persimmon']; Wd = RGB['wood']; S = RGB['straw']
    for y in range(T):
        for x in range(3, 13):
            if x == 3: col = Wd[4]
            elif x == 12: col = Wd[3]
            elif x == 7: col = S[6]                                # 용마루
            elif x < 7: col = P[5] if x < 5 else P[4]
            else: col = P[3] if x < 10 else P[2]
            if y % 4 == 3 and x not in (3, 12, 7): col = P[2] if x < 7 else P[1]    # 기왓골 줄
            c.put(x, y, col)
    for y in range(T):
        c.put(13, y, SHADOW, 70); c.put(14, y, SHADOW, 35)
    return c


def wall_corner2(side):
    """모서리: 위 칸에서 내려온 덮개 띠가 가로 덮개로 꺾인다. L = 왼쪽 끝(오른쪽으로 이어짐), R = 오른쪽 끝(왼쪽으로 이어짐)."""
    c = Cv(T, T)
    if side == 'L':
        _rubble(c, 3, T, 8, 15)
        for x in range(3, T): c.put(x, 8, RGB['stone'][1])
        _cap_rows(c, 3, T, round_l=True)
    else:
        _rubble(c, 0, 13, 8, 15)
        for x in range(0, 13): c.put(x, 8, RGB['stone'][1])
        _cap_rows(c, 0, 13, round_r=True)
    for x in range(T): c.put(x, 15, SHADOW, 80)
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
    c.hl(1, 31, 2, S[6]); c.vl(1, 2, 12, S[5]); c.vl(30, 2, 12, S[2])
    for x in range(1, 31): c.put(x, 12, S[2]); c.put(x, 13, S[1])                           # 앞 가장자리 두께
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
