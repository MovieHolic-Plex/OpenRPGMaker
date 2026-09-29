"""mon_wail_sky: 통곡 (화면). The stage dims to a cold ghost-blue, a pale screaming face swells on the left, its wail
pours to the right as bending sound rings and ghost wisps, then the rings shatter into hush marks and silence.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_18_35 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_wail_sky', 128, 8, 'screen'
PAL = pal(GHOST, pick(GRAVE, 'v0', 'v1', 'v2', 'v3'), WHITE)
PEAK = 4
FX, FY = 30, 60  # face centre (left third: the monster side)


def face(c, s, mouth, keys=('h2', 'h3', 'h4')):
    """Stretched banshee face: long skull, hollow eyes, gaping mouth; s = size scale."""
    c.oval(FX, FY, 13 * s, 18 * s, keys[0])
    c.oval(FX - 1, FY - 2, 11 * s, 16 * s, keys[1])
    c.oval(FX - 3, FY - 6 * s, 6 * s, 7 * s, keys[2])
    for dx in (-5, 5):
        c.oval(FX + dx * s, FY - 5 * s, 3 * s, 4.5 * s, 'v0')
        c.px(FX + dx * s - 1, FY - 6 * s, 'h4')
    c.oval(FX, FY + 7 * s, 4 * s * (0.6 + mouth * 0.4), 7 * s * mouth + 1, 'v0')
    c.oval(FX, FY + 8 * s, 2 * s * (0.6 + mouth * 0.4), 4 * s * mouth, 'v1')
    # hair tails streaming right
    for i, dy in enumerate((-14, -6, 4)):
        c.brush(FX + 4, FY + dy * s, 14 * s, -30 + i * 10, 40 + i * 10, 1.5 * s, 0.5, 'h1')


def wave(c, r, keys, gap=0, w=2):
    """Sound ring arc opening to the right, centred on the mouth."""
    mx, my = FX + 2, FY + 8
    for i, k in enumerate(keys):
        c.arc(mx, my, r - i * 3, -55, 55, k, w if i == 0 else 1, squash=1.1)


def wisps(c, x0, n, seed, keys=('h2', 'h3')):
    r = rng(seed)
    for i in range(n):
        x, y = x0 + r.uniform(0, 70), r.uniform(30, 96)
        L = r.uniform(8, 16)
        c.line([(x, y), (x - L, y + r.uniform(-3, 3))], keys[i % 2])
        c.disc(x, y, 1.5, keys[1])


def dim(c, parity=0, full=True):
    """Checker veil only: battlers stay visible through it."""
    c.drect(0, 0, 127, 127, 'h0', parity)


def draw(c, f):
    if f == 0:
        dim(c, full=False)
        c.ddisc(FX, FY, 12, 'h1')
    elif f == 1:
        dim(c)
        face(c, 0.7, 0.2, ('h1', 'h2', 'h3'))
        wave(c, 24, ['h1'])
    elif f == 2:
        dim(c)
        face(c, 0.9, 0.6)
        wave(c, 28, ['h2', 'h1'])
        wave(c, 44, ['h1'])
        wisps(c, 40, 5, 2)
    elif f == 3:
        dim(c)
        face(c, 1.0, 1.0)
        wave(c, 26, ['h3', 'h2'], w=3)
        wave(c, 44, ['h2', 'h1'])
        wave(c, 64, ['h1'])
        wisps(c, 50, 7, 3)
    elif f == 4:  # peak scream: face at full size, rings fill the stage, white crest
        dim(c)
        c.rays(FX + 2, FY + 8, 18, 20, 120, 'v1', rot=-0.8, jitter=[1, 0.7, 0.9])
        face(c, 1.1, 1.0, ('h3', 'h4', 'w'))
        wave(c, 30, ['w', 'h4', 'h3'], w=3)
        wave(c, 48, ['h4', 'h3'], w=2)
        wave(c, 68, ['h3', 'h2'], w=2)
        wave(c, 88, ['h2', 'h1'])
        wisps(c, 56, 9, 4, ('h3', 'h4'))
    elif f == 5:
        dim(c)
        face(c, 1.0, 0.7, ('h2', 'h3', 'h4'))
        wave(c, 56, ['h3', 'h2'])
        wave(c, 78, ['h2', 'h1'])
        wave(c, 98, ['h1'])
        wisps(c, 64, 8, 5)
    elif f == 6:  # rings break into hush marks (silence debuff)
        dim(c, 1)
        c.ddisc(FX, FY, 13, 'h1')
        r = rng(6)
        for i in range(7):
            x, y = r.uniform(56, 108), r.uniform(34, 94)
            c.line([(x - 4, y - 4), (x + 4, y + 4)], 'v3', 2)
            c.line([(x - 4, y + 4), (x + 4, y - 4)], 'v3', 2)
            c.line([(x - 3, y - 3), (x + 3, y + 3)], 'h4')
        wave(c, 90, ['h1'])
    else:
        c.drect(0, 0, 127, 127, 'h0', 1)
        r = rng(7)
        for i in range(6):
            x, y = r.uniform(60, 112), r.uniform(30, 98)
            c.line([(x - 3, y - 3), (x + 3, y + 3)], 'v2')
            c.line([(x - 3, y + 3), (x + 3, y - 3)], 'v2')
        wisps(c, 70, 4, 7, ('h1', 'h2'))


if __name__ == '__main__':
    run(globals())
