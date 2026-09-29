"""mon_roar_ring: 용의 포효 (자기 강화). The dragon draws breath (a gold glow gathers at its chest), roars: jagged sound
rings burst out of the centre, the ground dust kicks up, a fiery aura flares and settles as rising sparks."""
import math

from lib_monster_36_52 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_roar_ring', 64, 8, 'user'
PAL = pal(FIRE, pick(DUST, 'u1', 'u2', 'u3'), SHOCK, WHITE)
PEAK = 3


def jag(c, r, k, n=16, amp=2.2, rot=0.0, sq=0.8, w=1):
    pts = []
    for i in range(n * 2):
        a = rot + i * math.pi / n
        rr = r + (amp if i % 2 == 0 else -amp)
        pts.append(pol(UX, UY, rr, a, sq))
    pts.append(pts[0])
    c.line(pts, k, w)


def draw(c, f):
    if f == 0:
        converge(c, UX, UY, 0.6, 12, 1, ['e2', 'e4'], r0=26, r1=5)
        c.disc(UX, UY, 3, 'e3')
    elif f == 1:
        converge(c, UX, UY, 1.0, 12, 2, ['e3', 'h2'], r0=28, r1=4)
        c.disc(UX, UY, 5, 'e2')
        c.disc(UX, UY, 3, 'h2')
        c.spark(UX, UY, 6, 'w', 'h1', diag=True)
    elif f == 2:        # roar: first ring
        jag(c, 12, 'e3', 14, 2.5, 0.1, w=2)
        jag(c, 9, 'h2', 12, 1.5, 0.3)
        c.disc(UX, UY, 3, 'w')
        c.dring(UX, 56, 12, 'u2', squash=0.3)
    elif f == 3:        # PEAK
        jag(c, 26, 'e1', 18, 2.5, 0.0, w=2)
        jag(c, 20, 'e3', 16, 2.5, 0.2, w=2)
        jag(c, 14, 'h2', 14, 1.8, 0.1)
        pow_burst(c, UX, UY, 8, ['e2', 'e4', 'w'])
        for x in (8, 16, 48, 56):
            c.cloud(x, 55, 4, ['u1', 'u2', 'u3'], seed=x, lobes=5)
    elif f == 4:
        jag(c, 29, 'e0', 20, 2, 0.3)
        jag(c, 24, 'e2', 18, 2, 0.5, w=2)
        jag(c, 17, 'e3', 14, 1.5, 0.4)
        for x in (4, 14, 50, 60):
            c.cloud(x, 54, 5, ['u1', 'u2', 'u3'], seed=x + 1, lobes=5)
        c.disc(UX, UY, 3, 'e3')
    elif f == 5:        # aura flares around the body
        for i in range(7):
            a = math.pi + i * math.pi / 6
            x, y = pol(UX, UY + 6, 20, a, 0.8)
            c.flame(x, y + 6, 12 + (i % 2) * 5, 3, ['e1', 'e2', 'e3', 'e4'])
        c.dring(UX, UY, 28, 'e1', squash=0.8)
        c.ddisc(10, 55, 5, 'u1', squash=0.6)
        c.ddisc(54, 55, 5, 'u1', squash=0.6, parity=1)
    elif f == 6:
        for i in range(7):
            a = math.pi + i * math.pi / 6
            x, y = pol(UX, UY + 6, 21, a, 0.8)
            c.flame(x, y + 4, 7 + (i % 2) * 3, 2.2, ['e1', 'e2', 'e3'])
        embers(c, UX, UY - 6, 12, 6, 10, 22, ['e3', 'e4', 'h2'])
    else:
        embers(c, UX, UY - 14, 14, 7, 12, 24, ['e2', 'e3', 'h1'])
        c.dring(UX, UY, 22, 'e1', squash=0.8, parity=1)
    fade_edges(c, T=3, B=3, L=3, R=3)


if __name__ == '__main__':
    run(globals())

