"""golem_pal_avalanche_hit: 산사태 명중. 커다란 바위가 위에서 쿵 내려앉아 흙무더기로 덮고 먼지가 솟는다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'golem_pal_avalanche_hit', 64, 8, 'allTargets'
PAL = pal(CLAY, pick(GOLD, 'y3'))


def draw(c, f):
    cx, gy = 32, 54
    if f <= 2:
        t = (f + 1) / 3
        y = lerp(0, gy - 12, t * t)
        rock(c, cx, y, 14, ['c0', 'c2', 'c3', 'c4'], 3, 10)
        for k in range(1, 4):
            c.line([(cx - 8 + k * 6, y - 18 - k * 3), (cx - 8 + k * 6, y - 14 - k * 5)], 'c1')
    if f >= 3:
        u = (f - 3) / 4
        rock(c, cx, gy - 11 + u * 4, 14 - u * 2, ['c0', 'c2', 'c3', 'c4'], 3, 10)
        # 흙무더기
        c.poly([(cx - 26, gy + 2), (cx - 16, gy - 8 - u * 2), (cx + 4, gy - 14), (cx + 18, gy - 8), (cx + 27, gy + 2)], 'c1')
        c.poly([(cx - 22, gy + 1), (cx - 14, gy - 7), (cx + 3, gy - 12), (cx - 6, gy - 5), (cx - 12, gy + 1)], 'c2')
        c.line([(cx - 14, gy - 7), (cx + 3, gy - 12)], 'c3')
    if f in (3, 4):
        c.spark(cx, gy - 4, 13 - (f - 3) * 4, 'y3', 'c4', diag=True)
    if f >= 3:
        for k in range(7):
            r = rng(11 + k)
            a = math.radians(190 + k * 26)
            d = r.uniform(12, 28) * ease((f - 2) / 5)
            rock(c, cx + math.cos(a) * d, gy - 6 + math.sin(a) * d + max(0, f - 4) * 2, 2.5, ['c0', 'c2', 'c3'], k, 5)
        dust(c, cx, gy + 2, 12 + (f - 3) * 3, 5, ['c1', 'c2', 'c3', 'c4'], fade=f >= 6)


if __name__ == '__main__':
    run(globals())
