"""mon_eye_ray: 마안 광선 (투사체). A magenta petrifying beam bolt flying left -> right: hot white-pink head on the
right, spiralling violet rings and a fading tail.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_18_35 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_eye_ray', 32, 4, 'projectile'
PAL = pal(EYE, WHITE)
HX, HY = 25, 16


def draw(c, f):
    c.rect(1, HY - 1, HX - 2, HY + 1, 'q1')
    c.rect(6, HY - 2, HX - 2, HY + 2, 'q2') if f % 2 else c.rect(8, HY - 2, HX - 2, HY + 2, 'q2')
    c.line([(4, HY), (HX, HY)], 'q3')
    c.line([(12, HY), (HX, HY)], 'q4')
    for i in range(3):
        x = 8 + ((i * 6 + f * 2) % 16)
        h = 3 + (i + f) % 2
        c.arc(x, HY, h, 90, 270, 'q3', 1, squash=1.4)
    c.disc(HX, HY, 4, 'q2')
    c.disc(HX, HY, 3, 'q3')
    c.disc(HX - 0.5, HY - 0.5, 2, 'q4')
    c.rect(HX - 1, HY - 1, HX, HY - 1, 'w')
    c.spark(HX + 3, HY, 3 + f % 2, 'w', 'q4')
    c.px(4 + f * 2, HY - 4 + f % 2, 'q3')
    c.px(5 + f * 2, HY - 4 + f % 2, 'q3')


if __name__ == '__main__':
    run(globals())
