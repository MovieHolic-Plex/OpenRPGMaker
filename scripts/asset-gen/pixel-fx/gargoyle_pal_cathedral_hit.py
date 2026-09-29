"""gargoyle_pal_cathedral_hit: 성당 붕괴 명중. 부서진 첨탑 끝이 위에서 꽂혀 돌 파편과 금빛 색유리 조각이 튀고 먼지가 인다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'gargoyle_pal_cathedral_hit', 64, 8, 'allTargets'
PAL = pal(STONE, pick(SAND, 'n1', 'n2', 'n3'), pick(GOLD, 'y2', 'y3'), pick(BLOOD, 'b3'), pick(ICE, 'i2'))


def draw(c, f):
    cx, gy = 32, 54
    if f <= 3:
        t = (f + 1) / 4
        y = lerp(-6, gy - 16, t * t)
        # 첨탑 끝(뾰족한 각뿔) 떨어진다
        c.poly([(cx - 6, y - 26), (cx + 6, y - 26), (cx + 5, y), (cx, y + 14), (cx - 5, y)], 's1')
        c.poly([(cx - 3, y - 24), (cx + 1, y - 24), (cx + 1, y + 4), (cx - 3, y)], 's3')
        c.line([(cx + 6, y - 26), (cx + 5, y), (cx, y + 14)], 's0', 2)
        c.line([(cx - 5, y - 12), (cx + 5, y - 12)], 's0')
    if f >= 3:
        t = (f - 3) / 4
        c.spark(cx, gy - 4, max(3, 13 - (f - 3) * 4), 's4', 'y3', diag=True)
        c.oval(cx, gy, 6 + t * 24, 2 + t * 5, 's3', 1)
        if f <= 5:
            c.poly([(cx - 5, gy), (cx - 3, gy - 20), (cx + 1, gy - 26), (cx + 4, gy - 18), (cx + 5, gy)], 's2')
            c.line([(cx - 3, gy - 20), (cx + 1, gy - 26), (cx + 4, gy - 18)], 's4')
        r = rng(14)
        for k in range(8):
            a = math.radians(200 + k * 17)
            d = r.uniform(10, 28) * ease(t)
            rock(c, cx + math.cos(a) * d, gy - 4 + math.sin(a) * d + t * t * 14, 2.6 - t, ['s0', 's2', 's3'], k, 5)
        for k in range(10):
            a = r.uniform(0, 6.28)
            d = r.uniform(6, 26) * ease(t)
            x, y = cx + math.cos(a) * d, gy - 10 + math.sin(a) * d * 0.7 + t * t * 10
            c.poly([(x, y - 1.6), (x + 1.6, y), (x, y + 1.6), (x - 1, y)], ['y2', 'b3', 'i2', 'y3'][k % 4])
        dust(c, cx, gy + 1, 9 + t * 14, 4, ['n1', 'n2', 'n3'], fade=f >= 6)


if __name__ == '__main__':
    run(globals())
