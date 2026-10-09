"""summoner_ward: 수호령: 빛의 수호령이 커다란 깃털 날개를 펼쳐 아군을 감싸고 후광과 빛 알갱이가 떠오른다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'summoner_ward', 64, 10, 'allAllies'
PAL = pal(pick(GOLDY, 'y1', 'y2', 'y3'), pick(ICEB, 'i1', 'i2', 'i3', 'i4'), WHITE)


def wing(c, side, lvl, f):
    """side -1 왼쪽, +1 오른쪽: 어깨에서 깃털 여섯 장이 부채꼴로 뻗는다(안쪽은 흰색, 바깥은 금 테)."""
    sx, sy = CX + side * 5, 28
    spread = lvl
    for j in range(6):
        ang = math.radians(-95 + j * 22 * spread) if side > 0 else math.radians(-85 - j * 22 * spread)
        L = (24 - j * 1.8) * (.5 + .5 * lvl)
        ex, ey = sx + math.cos(ang) * L, sy + math.sin(ang) * L * 1.05
        c.lens((sx, sy), (ex, ey), 4.2 - j * .25, ['y1', 'i3', 'w'] if j % 2 == 0 else ['i1', 'i2', 'i4'])
    c.disc(sx, sy, 2, 'y2')


def draw(c, f):
    lvl = [.3, .55, .8, 1, 1, 1, 1, .85, .6, .35][f]
    wing(c, -1, lvl, f)
    wing(c, 1, lvl, f)
    c.ring(CX, 10 + (f % 2), 8, 'y2', 1, squash=.4)
    c.ring(CX, 10 + (f % 2), 6, 'y3', 1, squash=.4)
    for i in range(12):
        a = math.pi + i * math.pi / 11
        x, y = pol(CX, 50, 24 * lvl, a, 1.25)
        if (i + f) % 2 == 0:
            c.px(x, y, 'i3')
    c.dring(CX, 56, 16 + lvl * 4, 'y2', squash=.3, parity=f)
    for i in range(7):
        c.spark(12 + (i * 9 + f * 2) % 42, 52 - ((f * 5 + i * 11) % 44), 2 if i % 2 else 1, 'w', 'y3')


if __name__ == '__main__':
    run(globals())
