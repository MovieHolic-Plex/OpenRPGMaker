"""gunner_scope: 저격: 붉은 조준선이 좁혀 들며 한 점에 고정되고, 흰 탄도선이 꿰뚫은 뒤 파문이 번진다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'gunner_scope', 64, 10, 'target'
PAL = pal(pick(EMBER, 'm1', 'm2', 'm3', 'm4'), pick(STEELB, 'b0'), pick(GOLDY, 'y1', 'y2', 'y3'), WHITE)
IX, IY = 32, 32


def reticle(c, r, k, gap=4):
    c.ring(IX, IY, r, k, 1)
    c.line([(IX - r - 5, IY), (IX - gap, IY)], k)
    c.line([(IX + gap, IY), (IX + r + 5, IY)], k)
    c.line([(IX, IY - r - 5), (IX, IY - gap)], k)
    c.line([(IX, IY + gap), (IX, IY + r + 5)], k)


def draw(c, f):
    if f <= 4:
        r = [27, 22, 17, 12, 9][f]
        reticle(c, r, 'm2' if f < 4 else 'm3', gap=3)
        for k in range(4):
            a = math.pi / 4 + k * math.pi / 2
            x, y = pol(IX, IY, r + 2, a)
            c.px(x, y, 'm4')
        if f >= 3:
            c.disc(IX, IY, 1, 'm4' if f == 3 else 'w')
        if f == 4:
            c.ring(IX, IY, 3, 'm4', 1)
    elif f == 5:
        c.lens((62, IY), (2, IY), 4, ['y1', 'y3', 'w'])
        c.spark(IX, IY, 9, 'w', 'y3', diag=True)
        c.disc(IX, IY, 3, 'w')
        reticle(c, 9, 'm3', gap=3)
    elif f == 6:
        c.lens((62, IY), (2, IY), 2, ['y2', 'w'])
        star(c, IX, IY, 8, 12, 5, 'y2', rot=.2)
        star(c, IX, IY, 8, 7, 3, 'w', rot=.2)
        c.ring(IX, IY, 13, 'y2', 1)
        burst(c, IX, IY, .3, 8, 2, ['w', 'y3', 'y2'], spd=(12, 26))
    elif f == 7:
        c.dline((60, IY), (4, IY), 'y1', 3, phase=1)
        c.ring(IX, IY, 18, 'y1', 1)
        c.dring(IX, IY, 22, 'm3')
        burst(c, IX, IY, .6, 8, 2, ['y3', 'y2'], spd=(12, 26), grav=.3)
    elif f == 8:
        c.dring(IX, IY, 25, 'm2')
        c.dring(IX, IY, 20, 'y1', parity=1)
        c.disc(IX, IY, 2, 'b0')
        burst(c, IX, IY, .85, 5, 2, ['y2', 'm3'], spd=(12, 26), grav=.6)
    else:
        c.dring(IX, IY, 28, 'm1')
        c.disc(IX, IY, 1, 'b0')


if __name__ == '__main__':
    run(globals())
