"""harpy_pal_featherfall: 깃털 소나기. 하늘에서 초록·흰 깃털이 비스듬히 흩날려 내리고 바닥에서 잎 불꽃으로 터진다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'harpy_pal_featherfall', 64, 10, 'allTargets'
PAL = pal(LEAFG, pick(DOWN, 'f1', 'f2', 'f3'))


def draw(c, f):
    r = rng(3)
    cols = [(8 + i * 5.6, r.uniform(0, 1)) for i in range(11)]
    for i, (x0, ph) in enumerate(cols):
        t = (f / 9 * 1.1 + ph * 0.55) % 1.0
        y = -6 + t * 64
        x = x0 - t * 10 + math.sin(t * 9 + i) * 3
        ang = math.radians(100 + math.sin(t * 8 + i) * 35)
        body, vein, edge = (('g2', 'g3', 'g1') if i % 2 == 0 else ('f2', 'f1', 'f1'))
        if f >= 1 or ph > 0.5:
            feather(c, x, y, ang, 11 if i % 3 else 8, body, vein, edge)
        if 50 <= y <= 60 and i % 2 == 0:
            c.spark(x, 56, 3, 'g4', 'g3')
    if f >= 3:
        spark_burst(c, 32, 54, (f - 3) / 6, 10, 8, ['g4', 'g3', 'g2'], spd=(6, 24), squash=0.35, up=0.5)
    for k in range(3):
        c.line([(4 + k * 26 + f % 3, 2 + f), (10 + k * 26 + f % 3, 14 + f)], 'g1')


if __name__ == '__main__':
    run(globals())
