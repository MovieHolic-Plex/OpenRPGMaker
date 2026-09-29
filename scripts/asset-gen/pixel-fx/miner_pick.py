"""miner_pick: 곡괭이 찍기: 곡괭이가 호를 그리며 내리꽂혀 돌 파편과 불똥이 튄다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'miner_pick', 64, 8, 'target'
PAL = pal(STONE, pick(EARTHB, 'd1', 'd2'), pick(EMBER, 'm2', 'm3', 'm4'), WHITE)
IX, IY = 30, 40


def pick_head(c, x, y, a):
    ux, uy = math.cos(a), math.sin(a)
    vx, vy = -uy, ux
    c.line([(x, y), (x + ux * 18, y + uy * 18)], 'd1', 3)
    c.line([(x, y), (x + ux * 18, y + uy * 18)], 'd2', 1)
    p1 = (x - vx * 9 + ux * 2, y - vy * 9 + uy * 2)
    p2 = (x + vx * 8 + ux * 3, y + vy * 8 + uy * 3)
    c.poly([p1, (x - ux * 1, y - uy * 1), p2, (x + ux * 3, y + uy * 3)], 'r2', outline='r0')
    c.line([p1, (x, y)], 'r3')


def draw(c, f):
    if f <= 2:
        a = [-2.2, -1.6, -1.0][f]
        x, y = IX + 8 + f * 1, IY - 26 + f * 12
        c.arc(IX + 18, IY - 4, 22, a - .8, a, 'r3', 1)
        pick_head(c, x, y, a + math.pi)
    if f == 2:
        c.arc(IX + 18, IY - 4, 22, -2.4, -1.0, 'w', 2)
    if f == 3:
        pow_burst(c, IX, IY, 11, ['r1', 'm3', 'm4', 'w'], rot=.3, n=8)
        pick_head(c, IX + 2, IY - 2, -.6 + math.pi)
    if f >= 3:
        t = (f - 3) / 4
        debris(c, IX, IY, t, 10, 5, ['r2', 'r1', 'r3'], spd=(8, 22))
        burst(c, IX, IY, t, 8, 6, ['w', 'm4', 'm3', 'm2'], spd=(6, 20), grav=.6)
    if f >= 4:
        crack(c, IX, IY + 4, .3, 4, 12, ('r0', 'd1'), 2, grow=min(1, (f - 3) / 2), squash=.4)
    if f >= 6:
        dust_puff(c, IX, IY + 6, 8, ['r1', 'r2'], f)


if __name__ == '__main__':
    run(globals())

