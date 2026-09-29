"""berserker_smash: 분노의 일격: 도끼가 위에서 내리꽂히며 세로로 쪼개고 균열과 파편이 퍼진다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'berserker_smash', 64, 8, 'target'
PAL = pal(EMBER, pick(STEELB, 'b0', 'b1', 'b2', 'b3'), pick(LEATHER, 'l1', 'l2'), WHITE)
IX, IY = 32, 47  # 착탄점


def draw(c, f):
    if f == 0:
        axe(c, 27, 16, math.radians(-62), L=26, hw=8, side=-1)
        for i, x in enumerate((20, 25, 38, 43)):
            c.line([(x, 4 + i % 2 * 3), (x, 12 + i % 2 * 3)], 'm3')
        c.dline((31, 24), (31, 40), 'm2', 3)
    elif f == 1:
        slash(c, (46, 2), (31, 27), 7, 8, ['m1', 'm2', 'm3', 'm4'])
        axe(c, 26, 30, math.radians(-42), L=24, hw=8, side=1)
        for i in range(4):
            c.px(24 + i * 5, 34 + i % 2 * 3, 'm3')
    elif f == 2:
        c.lens((32, 5), (32, 57), 5, ['m1', 'm3', 'm4', 'w'])
        axe(c, 24, 47, math.radians(-16), L=24, hw=8, side=1)
        pow_burst(c, IX, IY, 13, ['m1', 'm3', 'm4', 'w'], rot=0.3, n=9)
        c.rays(IX, IY, 10, 12, 22, 'm4', rot=0.1, jitter=[1, .7, .9, .6])
    elif f == 3:
        c.lens((32, 4), (32, 56), 3, ['m1', 'm3', 'm4'])
        c.line([(29, 8), (29, 56)], 'm0')
        c.line([(35, 8), (35, 56)], 'm0')
        axe(c, 24, 49, math.radians(-14), L=22, hw=8, side=1)
        crack(c, IX, 56, 0.0, 6, 26, ('m0', 'm3'), 3, grow=0.7, squash=0.3)
        shock(c, IX, 56, 14, 'm4', 2)
        debris(c, IX, 52, 0.15, 8, 4, ['b2', 'b1', 'l2'])
        c.spark(IX, IY, 6, 'w', 'm4')
    elif f == 4:
        c.line([(30, 10), (30, 54)], 'm2')
        c.line([(34, 10), (34, 54)], 'm2')
        axe(c, 24, 50, math.radians(-12), L=20, hw=8, side=1)
        crack(c, IX, 56, 0.0, 6, 26, ('m0', 'm3'), 3, grow=1.0, squash=0.3)
        shock(c, IX, 56, 22, 'm3', 1)
        shock(c, IX, 56, 16, 'm4', 1)
        debris(c, IX, 52, 0.4, 10, 4, ['b2', 'b1', 'l2'])
        drops(c, IX, IY, 0.3, 6, 9, ['m2', 'm3'])
    elif f == 5:
        c.dline((30, 14), (30, 52), 'm1')
        c.dline((34, 14), (34, 52), 'm1', phase=1)
        axe(c, 24, 51, math.radians(-10), L=18, hw=8, side=1)
        crack(c, IX, 56, 0.0, 6, 26, ('m0', 'm2'), 3, grow=1.0, squash=0.3)
        shock(c, IX, 56, 27, 'm2', 1)
        debris(c, IX, 52, 0.65, 10, 4, ['b2', 'b1', 'l2'])
        dust_puff(c, 18, 56, 8, ['l2', 'l1'], 1)
        dust_puff(c, 46, 56, 8, ['l2', 'l1'], 2)
    elif f == 6:
        crack(c, IX, 56, 0.0, 6, 26, ('m0', 'm1'), 3, grow=1.0, squash=0.3)
        shock(c, IX, 56, 30, 'm1', 1, dither=True)
        debris(c, IX, 52, 0.85, 8, 4, ['b1', 'l2'])
        dust_puff(c, 14, 55, 9, ['l1', 'l2'], 3)
        dust_puff(c, 50, 55, 9, ['l1', 'l2'], 4)
    else:
        crack(c, IX, 56, 0.0, 5, 22, ('m0', 'm1'), 3, grow=1.0, squash=0.3)
        dust_puff(c, 12, 54, 8, ['l1', 'l2'], 5)
        dust_puff(c, 52, 54, 8, ['l1', 'l2'], 6)
        debris(c, IX, 52, 1.0, 5, 4, ['b1'])


if __name__ == '__main__':
    run(globals())
