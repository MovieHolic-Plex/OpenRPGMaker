"""miner_blast: 다이너마이트: 심지 불똥이 화면을 가로질러 달리고 다이너마이트 묶음이 거대한 폭발과 낙반을 일으킨다"""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'miner_blast', 128, 12, 'screen'
PAL = pal(pick(EMBER, 'm0', 'm1', 'm2', 'm3', 'm4'), pick(STONE, 'r0', 'r1', 'r2', 'r3'), pick(EARTHB, 'd1', 'd2'), WHITE)
OX, OY = 64, 72


def tnt(c, x, y):
    for i in (-4, 0, 4):
        c.rect(x + i - 1, y - 8, x + i + 2, y + 8, 'm1')
        c.line([(x + i - 1, y - 8), (x + i - 1, y + 8)], 'm2')
    c.rect(x - 6, y - 2, x + 6, y, 'r2')


def draw(c, f):
    lvl = [.3, .5, .7, .8, 1, 1, 1, 1, 1, .8, .6, .3][f]
    shade(c, OX, OY, 50 * lvl + 12, 'r0', squash=.8, dense='r0')
    if f <= 3:
        tnt(c, OX, OY + 10)
        fx = 112 - f * 14
        c.line([(OX + 2, OY + 2), (fx, 40), (118, 34)], 'd1')
        c.spark(fx, 40 + (fx - OX) * 0, 3 + f % 2, 'w', 'm4')
        burst(c, fx, 40, .4, 5, f, ['m4', 'm3'], spd=(3, 7))
        c.line([(OX + 2, OY + 2), (fx, 40)], 'd2')
    if f == 4:
        c.disc(OX, OY, 30, 'm4')
        c.disc(OX, OY, 22, 'w')
    if f >= 5:
        k = f - 5
        r = 22 + k * 7
        fire = max(0, 1 - k / 4)
        if k >= 2:
            for j in range(5):
                a = j * 1.26 + k * .2
                c.puff(OX + math.cos(a) * r * .5, OY - 6 - k * 3 + math.sin(a) * r * .3, 9 + k, ['r0', 'r1', 'r2'], seed=j + k)
        if fire > 0:
            c.disc(OX, OY, r * fire, 'm1')
            c.disc(OX, OY - 2, r * .8 * fire, 'm2')
            c.disc(OX, OY - 4, r * .55 * fire, 'm3')
            if k < 3:
                c.disc(OX, OY - 6, r * .3, 'm4')
        c.ring(OX, OY + 20, r + 12, 'm3' if k < 4 else 'm1', squash=.3)
        debris(c, OX, OY, min(1, k / 6 + .1), 20, 11, ['r1', 'r2', 'r3', 'd2'], spd=(20, 58), grav=1.2, size=(1.5, 3))
        if k >= 5:
            dissolve(c, (k - 4) / 4)
        for i in range(4):
            x = 20 + i * 28 + (f * 3) % 6
            y = 8 + ((f - 5) * 12 + i * 9) % 60
            rock(c, x, y, 4, ('r0', 'r2', 'r3'), i + f)


if __name__ == '__main__':
    run(globals())

