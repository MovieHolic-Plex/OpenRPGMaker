"""alchemist_stimulant: 촉진제: 붉은 거품이 보글보글 솟아 터지고 열기 물결과 화살표가 몸을 달군다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'alchemist_stimulant', 64, 8, 'user'
PAL = pal(EMBER, pick(ROSE, 'p3', 'p4'), WHITE)


def draw(c, f):
    lvl = [.4, .7, 1, 1, 1, 1, .7, .4][f]
    for i in range(12):
        seed = i * 37
        x = 14 + (seed * 7) % 36
        y = 56 - ((f * 7 + i * 11) % 50)
        r = 2 + (i % 3)
        if y < 8:
            continue
        if y < 16:
            # 터지는 거품: 작은 별
            c.spark(x, y, 2, 'm4', 'w')
        else:
            bubble(c, x, y, r, 'm3' if i % 2 else 'm2', hi='w')
    # 열기 물결(사인 윤곽)
    for k in range(2):
        pts = [(CX + (-15 if k == 0 else 15) + math.sin(y * .5 + f * 1.2 + k * 2) * 3, y) for y in range(14, 56, 2)]
        c.line(pts, 'm1' if k else 'm2', 1)
    for j in range(2):
        chevron(c, CX - 6 + j * 12, 34 - f * 3 - j * 6, 4, 'm4', ol='m0', up=True)
    c.dring(CX, 56, 14 + lvl * 4, 'm2', parity=f, squash=.3)
    if f in (2, 3):
        c.spark(CX - 3, 22, 4, 'w', 'p3')


if __name__ == '__main__':
    run(globals())
