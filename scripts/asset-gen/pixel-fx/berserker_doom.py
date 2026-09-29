"""berserker_doom: 학살의 폭풍: 화면이 핏빛으로 어두워지고 거대한 붉은 초승달들이 회오리치며 번개가 내리꽂힌다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'berserker_doom', 128, 12, 'screen'
PAL = pal(EMBER, WHITE)
OX, OY = 64, 68


def draw(c, f):
    lvl = [.3, .55, .8, 1, 1, 1, 1, 1, 1, 1, .7, .35][f]
    shade(c, OX, OY, 50 * lvl + 14, 'm0', squash=.75, dense='m0')
    if f <= 2:
        c.rays(OX, OY, 14, 8, 30 + f * 12, 'm1', rot=f * .1, jitter=[1, .6, .85, .7], squash=.7)
    if 2 <= f <= 10:
        rot = f * 47
        for k, (rx, ry, th, keys) in enumerate(((52, 32, 13, ['m1', 'm2', 'm4', 'w']), (36, 22, 9, ['m1', 'm3', 'm4']), (58, 36, 6, ['m0', 'm1']))):
            a = rot * (1 if k != 1 else -1.3) + k * 40
            band(c, OX, OY, rx, ry, a, a + 130, th, keys)
            band(c, OX, OY, rx, ry, a + 180, a + 300, th * .8, keys)
    if f in (3, 5, 7, 9):
        r = rng(f)
        for j in range(2):
            x = OX + r.uniform(-40, 40)
            bolt(c, (x, 6), (x + r.uniform(-8, 8), OY + r.uniform(-8, 14)), f * 10 + j, ['m1', 'm3', 'w'], segs=7, jitter=6)
            c.spark(x, OY + 6, 4, 'w', 'm4')
    for i in range(14):
        x = 20 + (i * 17 + f * 5) % 90
        y = 116 - ((f * 9 + i * 13) % 96)
        c.px(x, y, 'm4' if i % 2 else 'm3')
    if f >= 3:
        pow_burst(c, OX, OY + 4, 6 + (f % 3) * 2, ['m2', 'm4', 'w'], rot=f * .4, n=8)


if __name__ == '__main__':
    run(globals())
