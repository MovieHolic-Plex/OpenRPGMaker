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
