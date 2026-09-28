"""mon_demon_aura: 마왕의 기운 (자기 강화). Black mist coils in around the demon lord, crimson runes circle, a violet
aura erupts upward in flame-like spikes with a crimson core pulse, then settles into a slow flickering glow."""
import math

from lib_monster_36_52 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_demon_aura', 64, 8, 'user'
PAL = pal(DARK, CRIM, pick(SHADE, 'd0'), WHITE)
PEAK = 3


def spikes(c, h, n, rot, keys, r=20, sq=0.85):
    for i in range(n):
        a = rot + i * 2 * math.pi / n
        x, y = pol(UX, UY + 4, r, a, sq)
        up = 0.5 + 0.5 * max(0.0, -math.sin(a))       # taller on the top half
        c.flame(x, y + 3, h * (0.55 + 0.6 * up), 2.6, keys, lean=math.cos(a) * 2)


def runes(c, r, rot, k, n=6, sq=0.5):
    for i in range(n):
        a = rot + i * 2 * math.pi / n
        x, y = pol(UX, UY + 14, r, a, sq)
        c.line([(x - 1, y - 2), (x + 1, y + 2)], k)
        c.line([(x + 1, y - 2), (x - 1, y)], k)


def draw(c, f):
    if f == 0:          # mist coils in
        for i in range(4):
            a0 = i * 90 + 20
            c.brush(UX, UY + 4, 26, a0, a0 + 70, 1.6, 0.4, 'v1' if i % 2 else 'v2', squash=0.8)
    elif f == 1:
        for i in range(4):
            a0 = i * 90 + 60
            c.brush(UX, UY + 4, 20, a0, a0 + 80, 2, 0.5, ['v1', 'v2', 'v3', 'v2'][i], squash=0.8)
        runes(c, 18, 0.2, 'c2')
        c.ring(UX, UY + 14, 18, 'c1', 1, squash=0.5)
    elif f == 2:
        spikes(c, 12, 10, 0.1, ['v1', 'v2', 'v3'])
        c.ring(UX, UY + 14, 20, 'c2', 1, squash=0.5)
        runes(c, 20, 0.7, 'c3')
        c.disc(UX, UY, 3, 'c2')
    elif f == 3:        # PEAK eruption
        spikes(c, 22, 12, 0.0, ['v0', 'v1', 'v2', 'v3', 'v5'], r=22)
        c.ring(UX, UY + 14, 23, 'c2', 2, squash=0.5)
        runes(c, 23, 1.2, 'c3', 8)
        c.ring(UX, UY, 7, 'c3', 1)
        c.spark(UX, UY, 6, 'w', 'v5', diag=True)
    elif f == 4:
        spikes(c, 18, 12, 0.26, ['v0', 'v1', 'c1', 'v3', 'v4'], r=23)
        c.ring(UX, UY + 14, 25, 'c1', 1, squash=0.5)
        runes(c, 25, 1.7, 'c2', 8)
        c.dring(UX, UY, 10, 'c2')
    elif f == 5:
        spikes(c, 13, 10, 0.5, ['v1', 'v2', 'v3', 'v4'], r=23)
        c.dring(UX, UY + 14, 24, 'c1', squash=0.5)
        embers(c, UX, UY - 14, 8, 5, 6, 20, ['v2', 'v4', 'c3'])
    elif f == 6:
        spikes(c, 10, 10, 0.2, ['v1', 'c1', 'v3'], r=22)
        embers(c, UX, UY - 18, 10, 6, 10, 22, ['v2', 'v4'])
    else:
        spikes(c, 8, 8, 0.6, ['v1', 'v2', 'v4'], r=21)
        c.dring(UX, UY + 4, 24, 'v2', squash=0.85, parity=1)
        embers(c, UX, UY - 22, 8, 7, 12, 22, ['v1', 'v3', 'c2'])
    fade_edges(c, T=3, B=3, L=3, R=3)


if __name__ == '__main__':
    run(globals())

