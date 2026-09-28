"""mon_charge_dust: 돌진 (시전자). The monster digs in and bolts right: dirt kicks up behind its feet, speed lines stream left and a dust wake trails away.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_0_17 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_charge_dust', 64, 6, 'user'
PAL = pal(DIRT, pick(SOOT, 'o1', 'o2'), pick(IMPACT, 'y3'), WHITE)
GY = 54                                     # ground under the monster


def clod(c, x, y, s=1):
    c.rect(x, y, x + s, y + s, 'd1')
    c.px(x, y, 'd3')


def draw(c, f):
    if f == 0:                                             # paw scrape: small dust at the feet
        c.puff(UX + 4, GY - 2, 4, ['d1', 'd2', 'd3'], seed=1)
        for x in (UX - 2, UX + 8):
            c.line([(x, GY + 1), (x - 5, GY + 1)], 'd2')
        clod(c, UX - 6, GY - 6)
    elif f == 1:                                           # second scrape, snort puffs
        c.puff(UX + 2, GY - 3, 6, ['d1', 'd2', 'd3', 'd4'], seed=2)
        c.puff(UX + 18, UY - 6, 3, ['o1', 'o2'], seed=3)
        clod(c, UX - 10, GY - 10)
        clod(c, UX - 4, GY - 13)
    elif f == 2:                                           # launch: dust bursts behind
        c.puff(UX - 8, GY - 5, 9, ['d1', 'd2', 'd3', 'd4'], seed=4)
        c.puff(UX + 6, GY - 3, 5, ['d1', 'd2', 'd3'], seed=5)
        for i, (x, y) in enumerate(((UX - 18, GY - 18), (UX - 12, GY - 22), (UX - 22, GY - 10), (UX - 2, GY - 16))):
            clod(c, x, y, 1 + i % 2)
        speed_lines(c, 4, UX + 10, (UY - 10, UY - 2, UY + 6), 'd4', 0)
        c.spark(UX + 22, UY, 3, 'w', 'y3')
    elif f == 3:                                           # full sprint: long speed lines, wake
        c.puff(UX - 14, GY - 6, 10, ['d1', 'd2', 'd3', 'd4'], seed=6)
        c.puff(UX - 26, GY - 3, 6, ['d1', 'd2', 'd3'], seed=7)
        speed_lines(c, 2, UX + 20, (UY - 14, UY - 6, UY + 2, UY + 10), 'd4', 1)
        speed_lines(c, 8, UX + 12, (UY - 10, UY + 6), 'w', 2)
        for x, y in ((UX - 28, GY - 20), (UX - 20, GY - 26), (UX - 32, GY - 12)):
            clod(c, x, y)
    elif f == 4:
        c.puff(UX - 20, GY - 7, 9, ['d1', 'd2', 'd3'], seed=8)
        c.ddisc(UX - 6, GY - 3, 6, 'd2', squash=0.6)
        speed_lines(c, 2, UX + 8, (UY - 8, UY + 4), 'd3', 3)
        clod(c, UX - 30, GY - 16)
    else:
        c.ddisc(UX - 22, GY - 8, 9, 'd2', squash=0.7)
        c.ddisc(UX - 23, GY - 10, 5, 'd3', parity=1, squash=0.7)
        specks(c, UX - 16, GY - 8, 8, 6, 20, 9, ['d1', 'd3'], sq=0.5)


if __name__ == '__main__':
    run(globals())

