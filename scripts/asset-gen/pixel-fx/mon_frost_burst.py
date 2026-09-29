"""mon_frost_burst: 얼음 구체 · 서리 폭풍 (착탄). Frost gathers on the ally, ice shards spear up from the ground
and around the body into a crown of crystals at the peak, then crack and shatter into flakes.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monster_18_35 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_frost_burst', 64, 8, 'target'
PAL = pal(ICE, WHITE)
PEAK = 3
# ground and flank shards: (base x, base y, angle, length, half-width)
SHARDS = [(CX - 14, FEET, -2.0, 18, 3), (CX - 6, FEET + 1, -1.75, 14, 2.5), (CX + 6, FEET + 1, -1.35, 16, 2.5),
          (CX + 14, FEET, -1.1, 19, 3), (CX - 18, CY - 2, -2.6, 10, 2), (CX + 18, CY - 4, -0.5, 11, 2),
          (CX - 2, FEET + 2, -1.57, 9, 2)]
K3 = ['i1', 'i2', 'i4']
K4 = ['i1', 'i2', 'i3', 'w']


def crystals(c, grow, keys=K4):
    for x, y, a, L, w in SHARDS:
        c.shard(x, y, a, L * grow, w * min(1, grow + 0.3), keys)


def draw(c, f):
    if f == 0:  # frost converges
        c.dring(CX, CY, 20, 'i2', squash=0.9)
        c.ring(CX, FEET, 16, 'i1', 1, squash=0.3)
        for i in range(6):
            a = i * math.pi / 3 + 0.3
            c.line([pol(CX, CY, 14, a), pol(CX, CY, 18, a)], 'i3')
    elif f == 1:
        c.ring(CX, FEET, 20, 'i1', 2, squash=0.3)
        c.ring(CX, FEET, 18, 'i3', 1, squash=0.3)
        crystals(c, 0.45, K3)
        c.flake(CX - 16, 28, 3, 'i3', 'w')
        c.flake(CX + 16, 30, 3, 'i3', 'w')
    elif f == 2:
        c.ring(CX, FEET, 22, 'i1', 2, squash=0.3)
        crystals(c, 0.8)
        c.spark(CX + 14, FEET - 18, 3, 'w', 'i3')
    elif f == 3:  # peak: full crown, cold flash ring
        c.dring(CX, CY, 25, 'i2', squash=0.95)
        c.ring(CX, FEET, 24, 'i2', 2, squash=0.3)
        crystals(c, 1.0)
        c.shard(CX, 18, -1.57, 7, 2.5, K4)
        c.shard(CX - 6, 20, -2.1, 6, 2, K4)
        c.shard(CX + 6, 20, -1.05, 6, 2, K4)
        c.spark(CX - 14, FEET - 18, 4, 'w', 'i3', diag=True)
        c.spark(CX + 14, FEET - 19, 5, 'w', 'i4', diag=True)
        c.spark(CX, 14, 3, 'w', 'i3')
    elif f == 4:  # cracks run through the ice
        crystals(c, 1.0, ['i0', 'i1', 'i2', 'i3'])
        for x, y, a, L, w in SHARDS[:4]:
            m = pol(x, y, L * 0.5, a)
            c.line([pol(m[0], m[1], 2, a + 1.5), pol(m[0], m[1], 2, a - 1.5)], 'w')
        c.ring(CX, FEET, 24, 'i1', 1, squash=0.3)
    elif f == 5:  # shatter: chunks thrown out
        r = rng(5)
        for x, y, a, L, w in SHARDS:
            for j in range(2):
                d = L * (0.4 + j * 0.4)
                p = pol(x, y, d, a)
                p = (p[0] + (p[0] - CX) * 0.35, p[1] - 3 + j * 2)
                c.shard(p[0], p[1], a + r.uniform(-1, 1), 5, 1.5, K3)
        c.spark(CX, CY, 6, 'w', 'i3', diag=True)
        motes(c, CX, CY, 8, 10, 22, 5, ['i3', 'i4'])
    elif f == 6:
        r = rng(6)
        for i in range(9):
            x, y = CX + r.uniform(-24, 24), r.uniform(20, FEET)
            c.shard(x, y, r.uniform(0, 6.3), 3, 1, ['i1', 'i3'])
        for i in range(4):
            c.flake(CX + r.uniform(-20, 20), r.uniform(18, 44), 2, 'i3', 'w')
        c.dring(CX, FEET, 22, 'i1', squash=0.3)
    else:
        r = rng(7)
        for i in range(6):
            c.flake(CX + r.uniform(-22, 22), r.uniform(24, FEET), 2, 'i2')
        motes(c, CX, FEET - 6, 8, 6, 22, 7, ['i2', 'i3'], sq=0.4)


if __name__ == '__main__':
    run(globals())
