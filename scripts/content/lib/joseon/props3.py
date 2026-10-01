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
