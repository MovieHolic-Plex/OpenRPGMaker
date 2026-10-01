"""마을 밀도용 소품: 싸리울타리, 낟가리."""
import math
from tk import *
from build import outline
from trees import ground_shadow


def fence_h():
    """싸리울타리 16×16: 2px 굵기 싸리 막대가 촘촘히, 위는 들쭉날쭉, 두 군데 가로 묶음."""
    c = Cv(T, T)
    W = RGB['wood']; S = RGB['straw']
    for k, x in enumerate(range(0, T, 3)):
        top = 3 + int(rnd(x, 1, 5) * 3)
        for y in range(top, 15):
            c.put(x, y, W[5] if y == top else W[4])
            c.put(x + 1, y, W[3] if y > top else W[4])
            if x + 2 < T and (x + 2) % 3 == 2: pass
    for y, col in ((7, S[3]), (12, S[3])):
        for x in range(T):
            c.put(x, y, col)
    for x in range(T):
        c.put(x, 15, SHADOW, 90)
    return c


def haystack():
    """낟가리 32×32: 원뿔형 짚단 더미, 새끼줄 묶음 두 줄, 꼭대기 매듭."""
    c = Cv(2 * T, 2 * T)
    S = RGB['straw']
    ground_shadow(c, 16, 29, 13, 2.5)
    for y in range(4, 29):
        half = 2.5 + (y - 4) * 0.5
        half = min(half, 12.5)
        for x in range(int(16 - half), int(16 + half) + 1):
            u = (x - 16) / max(1.0, half)
            tone = 5 if u < -0.45 else (4 if u < 0.1 else (3 if u < 0.55 else 2))
            if rnd(x, y, 7) < 0.14: tone = max(1, tone - 1)
            if (y - 4) % 7 == 6: tone = max(1, tone - 1)             # 단 묶음 사이 그늘
            c.put(x, y, S[tone])
    for y in (12, 20):
        half = 2.5 + (y - 4) * 0.5
        for x in range(int(16 - half), int(16 + half) + 1):
            c.put(x, y, RGB['wood'][3] if (x + y) % 2 else RGB['wood'][4])
    c.put(15, 3, S[5]); c.put(16, 3, S[4]); c.put(16, 2, S[5]); c.put(15, 2, S[6])
    outline(c)
    return c


def stone_bank(left=False, right=False):
    """석축 둑 16×32: 위는 풀 가장자리, 아래는 크기가 다른 막돌을 쌓은 앞면(왼쪽 밝음). 높은 땅의 앞면."""
    c = Cv(T, 2 * T)
    S = RGB['stone']; G = RGB['leaf']; E = RGB['earth']
    for x in range(T):
        c.put(x, 0, G[3]); c.put(x, 1, G[2])
    rows = [(2, 9), (9, 15), (15, 22), (22, 30)]
    for ri, (y0, y1) in enumerate(rows):
        x = -((ri * 5) % 7)
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


def reeds():
    """갈대 16×32: 가는 줄기 묶음과 갈색 이삭."""
    c = Cv(T, 2 * T)
    G = RGB['leaf']; S = RGB['straw']
    for i, x in enumerate(range(1, 15)):
        top = 4 + int(rnd(x, 3, 4) * 12)
        for y in range(top, 31):
            c.put(x, y, G[5] if (i % 3 == 0) else (G[4] if i % 2 else G[3]))
            if x + 1 < T and i % 2 == 0: c.put(x + 1, y, G[3])
        for k in range(5):
            c.put(x + (1 if i % 2 else -1) * (k > 2), top + k, S[4] if k < 3 else S[3])
    for x in range(2, 14): c.put(x, 31, SHADOW, 80)
    return c


def rocks():
    """돌무더기 16×16: 큰 돌 하나 + 작은 돌 둘."""
    c = Cv(T, T)
    S = RGB['stone']
    def rock(cx, cy, rx, ry):
        for y in range(int(cy - ry), int(cy + ry) + 1):
            for x in range(int(cx - rx), int(cx + rx) + 1):
                d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
                if d <= 1:
                    lit = -((x - cx) / rx * 0.6 + (y - cy) / ry * 0.8)
                    c.put(x, y, S[6 if lit > 0.5 else (5 if lit > 0.1 else (4 if lit > -0.35 else 3))])
    rock(7, 9, 5.5, 4.5); rock(13, 11, 2.5, 2.5); rock(3, 12, 2.5, 2)
    for x in range(1, 15): c.put(x, 15, SHADOW, 80)
    outline(c)
    return c


def laundry():
    """빨랫줄 32×32: 두 기둥과 줄, 흰 옷·푸른 옷·붉은 옷 세 벌."""
    c = Cv(2 * T, 2 * T)
    W = RGB['wood']; B = RGB['dblue']; R = RGB['red']
    for x in (3, 28):
        for y in range(8, 30):
            c.put(x, y, W[5]); c.put(x + 1, y, W[3])
    for x in range(4, 28):
        c.put(x, 9 + (1 if 10 < x < 21 else 0), W[2])
    St = RGB['stone']
    for x0, (lt, dk), hh in ((7, (St[6], St[5]), 11), (14, (B[5], B[4]), 9), (21, (R[4], R[3]), 10)):
        for y in range(11, 11 + hh):
            for x in range(x0, x0 + 5):
                c.put(x, y, lt if (x - x0) < 3 else dk)
    outline(c)
    for x in range(2, 30): c.put(x, 30, SHADOW, 80)
    return c


def flower_bed():
    """화단 32×16: 돌 두른 흙 위 붉은·노란·흰 꽃."""
    c = Cv(2 * T, T)
    E = RGB['earth']; S = RGB['stone']; G = RGB['leaf']; R = RGB['red']; Y = RGB['straw']
    for y in range(3, 14):
        for x in range(1, 31):
            c.put(x, y, E[3] if (x + y) % 3 else E[2])
    for x in range(1, 31):
        c.put(x, 3, S[6]); c.put(x, 13, S[3])
    for y in range(3, 14):
        c.put(1, y, S[5]); c.put(30, y, S[3])
    for k in range(14):
        x = 3 + int(rnd(k, 1, 51) * 25); y = 5 + int(rnd(k, 2, 52) * 6)
        c.put(x, y + 1, G[3]); c.put(x, y, [R[4], Y[5], hx('#f7fdff')][k % 3])
        c.put(x + 1, y, [R[3], Y[4], hx('#d8e4e8')][k % 3] if False else G[4])
    for x in range(1, 31): c.put(x, 14, SHADOW, 80)
    return c


def bank_stairs():
    """석축 둑을 가르는 돌계단 16×32: 단마다 윗면(밝음)+앞면(어두움), 양옆 난간돌."""
    c = Cv(T, 2 * T)
    S = RGB['stone']; G = RGB['leaf']; E = RGB['earth']
    for x in range(T):
        c.put(x, 0, G[3]); c.put(x, 1, G[2])
    for k in range(5):
        y0 = 2 + k * 5
        for y in range(y0, y0 + 5):
            for x in range(T):
                if y - y0 < 2: tone = 6 - (1 if k % 2 else 0)
                else: tone = 3 if y - y0 < 4 else 2
                if x in (0, 1): tone = max(2, tone - 1) if y - y0 >= 2 else 5
                if x in (14, 15): tone = max(2, tone - 1)
                c.put(x, y, S[tone])
    for x in range(T):
        c.put(x, 30, E[2]); c.put(x, 31, SHADOW, 90)
    return c


# ---- 바람의나라 연구형 담: 주황 갈색 기와·흙 덮개 + 어두운 막돌 ----
_CAP = [(61, 34, 12), (113, 66, 16), (136, 90, 38), (162, 110, 54), (194, 117, 54), (198, 146, 80), (220, 170, 76)]


def _rubble(c, x0, x1, y0, y1, seed):
    S = RGB['stone']
    rows = [(y0, y0 + 5), (y0 + 5, y1)]
    for ri, (a, b) in enumerate(rows):
        x = x0 - ((ri * 3 + seed) % 5)
        k = 0
        while x < x1:
            w = 6 + int(rnd(k, ri, 71 + seed) * 5)
            for yy in range(a, b):
                for xx in range(max(x0, x), min(x1, x + w)):
                    edge = xx == x or yy == b - 1
                    tone = 1 if edge else (5 if (yy - a) == 1 and xx < x + w - 2 else (4 if xx < x + int(w * 0.6) else 3))
                    if not edge and rnd(xx, yy, 73) < 0.15: tone = 3 if tone == 4 else 2
                    c.put(xx, yy, S[tone])
            x += w; k += 1


def clay_cap(c, x0, x1, y0, h=6, round_l=False, round_r=False):
    for y in range(y0, y0 + h):
        for x in range(x0, x1):
            t = y - y0
            col = _CAP[0] if t == 0 else (_CAP[5] if t == 1 else (_CAP[4] if t < h - 2 else (_CAP[2] if t == h - 2 else _CAP[1])))
            if (x - x0) % 4 == 3 and 0 < t < h - 1: col = _CAP[2]            # 기왓골 홈
            if round_l and x - x0 < 2 and (t < 2 - (x - x0) or t >= h - 1 + (x - x0) - 1): continue
            if round_r and x1 - 1 - x < 2 and (t < 2 - (x1 - 1 - x) or t >= h - 1 + (x1 - 1 - x) - 1): continue
            c.put(x, y, col)


def wall_h2(seed=0):
    c = Cv(T, T)
    _rubble(c, 0, T, 6, T, seed)
    clay_cap(c, 0, T, 0, 6)
    for x in range(T): c.put(x, 15, SHADOW, 70)
    return c


def wall_v2():
    """세로 담: 위에서 본 주황 덮개 띠(폭 8px), 양옆 짧은 막돌 그림자."""
    c = Cv(T, T)
    for y in range(T):
        for x in range(4, 12):
            col = _CAP[5] if x < 6 else (_CAP[4] if x < 9 else (_CAP[2] if x < 11 else _CAP[1]))
            if y % 4 == 3: col = _CAP[2] if x < 11 else _CAP[1]            # 가로 기와 마디
            c.put(x, y, col)
        c.put(3, y, _CAP[1]); c.put(12, y, _CAP[1])
    for y in range(T):
        c.put(13, y, SHADOW, 70); c.put(14, y, SHADOW, 40)
    return c


def wall_corner2(side):
    """모서리: 세로 띠가 내려오다 가로 덮개로 꺾이며 바깥 모서리가 둥글다. side L=왼쪽 아래, R=오른쪽 아래."""
    c = Cv(T, T)
    for y in range(0, 6):
        for x in range(4, 12):
            col = _CAP[5] if x < 6 else (_CAP[4] if x < 9 else (_CAP[2] if x < 11 else _CAP[1]))
            c.put(x, y, col)
        c.put(3, y, _CAP[0]); c.put(12, y, _CAP[0])
    if side == 'L':
        _rubble(c, 4, T, 6, T, 1)
        clay_cap(c, 3, T, 6 - 6 + 0, 6, round_l=True)
    else:
        _rubble(c, 0, 12, 6, T, 2)
        clay_cap(c, 0, 13, 0, 6, round_r=True)
    for x in range(T): c.put(x, 15, SHADOW, 70)
    return c
