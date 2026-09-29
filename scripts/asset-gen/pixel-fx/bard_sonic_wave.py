"""bard_sonic_wave: 소닉 붐 탄. Three nested sound-wave crescents opening to the LEFT (flight direction)
with a pink core note and a rippling tail.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monk import *

KEY, SIZE, FRAMES, ANCHOR = 'bard_sonic_wave', 32, 4, 'projectile'
PAL = pal(pick(RAINBOW, 'n0', 'rv', 'rp', 'rb'), pick(SOUL, 'v2', 'v3'), WHITE)
Y = 16


def draw(c, f):
    for i in range(4):
        x = 5 + i * 6 + (f % 2)
        r = 12 - i * 2.5 + (f + i) % 2
        k = ['w', 'rp', 'rv', 'v2'][i]
        c.arc(x + r, Y, r, 140, 220, 'n0', 4)
        c.arc(x + r, Y, r, 140, 220, k, 2)
    c.disc(10, Y, 3, 'n0')
    note(c, 10, Y + 2, 'rp', 4, s=0.8, ol='n0')
    for j in range(3):
        x = 22 + ((f * 3 + j * 4) % 9)
        c.px(x, Y - 6 + j * 6 + (f % 2), 'v3')


if __name__ == '__main__':
    run(globals())

