"""mon_rampage_screen: 미궁의 광란 (보스 필살기 화면). The maze lord goes berserk: the stage floods blood-red,
burning eyes flash at the LEFT, two hoof stomps crack the floor, a red shock dome ripples LEFT -> RIGHT across the stage,
debris flies, then dust settles over the cracks."""
import math

from lib_monster_36_52 import *

KEY, SIZE, FRAMES, ANCHOR = 'mon_rampage_screen', 128, 10, 'screen'
PAL = pal(BLOOD, DUST, pick(ROCK, 'o0', 'o2', 'o4'), pick(SHADE, 'd0'), pick(SHOCK, 'h2'), WHITE)
PEAK = 5
FL = 96          # floor row
SX = 22          # stomp point (monster side)


def veil(c, strong=False):
    shade(c, 64, 64, 50, 'r0', dense='d0')
    if strong:
        for y in range(0, 128, 4):
            for x in range((y // 4) % 2 * 2, 128, 4):
                c.px(x, y, 'd0')


def cracks(c, x, y, reach, seed, k='o0', lit=None):
    r = rng(seed)
    for i in range(6):
        a = math.pi * (1.0 + 1.0 * (i + 0.5) / 6)
        pts = [(x, y)]
        px, py = x, y
        for j in range(4):
            px += math.cos(a) * reach / 4 * -1 + r.uniform(-2, 2)
            py += abs(math.sin(a)) * reach / 16 + r.uniform(-1, 1)
            pts.append((px, py))
        c.line(pts, k, 2 if i % 2 else 1)
        if lit:
            c.line(pts[:3], lit)
    for j in range(3):
        c.line([(x + j * reach / 3, y + j), (x + (j + 1) * reach / 3, y + (j + 1) * 0.5 + r.uniform(-1, 1))], k)


def eyes(c, x, y, s):
    for dx in (0, 9):
        c.poly([(x + dx - s, y), (x + dx + s, y - 1), (x + dx + s * 0.6, y + 2)], 'r3')
        c.px(x + dx, y, 'w')


def debris(c, t, n, seed, x0, y0):
    r = rng(seed)
    for i in range(n):
        a = r.uniform(-math.pi * 0.9, -math.pi * 0.15)
        v = r.uniform(14, 40)
        x = x0 + math.cos(a) * v * ease(t) + 20 * t
        y = y0 + math.sin(a) * v * ease(t) + 40 * t * t
        if y > FL + 4:
            continue
        chunk(c, x, y, r.uniform(1.4, 3), r.uniform(0, 6), ('o0', 'o2', 'o4'))


def shock(c, x, r, keys, w=2):
    for i, k in enumerate(keys):
        c.arc(x, FL, r - i * 3, 180, 360, k, w, squash=0.55)


def draw(c, f):
    if f == 0:
        shade(c, 64, 64, 46, 'r0')
        eyes(c, 14, 50, 3)
    elif f == 1:
        veil(c)
        eyes(c, 14, 50, 4)
        c.spark(18, 50, 6, 'w', 'r3', diag=True)
        for i in range(5):
            c.line([(6 + i * 5, 34 - i), (10 + i * 5, 24 - i * 2)], 'r2')
    elif f == 2:        # first stomp
        veil(c)
        cracks(c, SX, FL, 34, 1, 'o0', 'r2')
        shock(c, SX, 22, ['r1', 'r2', 'r3'])
        pow_burst(c, SX, FL - 2, 10, ['u1', 'u3', 'w'])
        debris(c, 0.2, 8, 2, SX, FL - 4)
    elif f == 3:
        veil(c)
        cracks(c, SX, FL, 50, 1, 'o0', 'r1')
        shock(c, SX + 10, 38, ['r1', 'r2'])
        debris(c, 0.5, 10, 2, SX, FL - 4)
        c.cloud(SX + 6, FL - 6, 9, ['u0', 'u1', 'u2', 'u3'], seed=3)
    elif f == 4:        # second stomp, heavier
        veil(c, True)
        cracks(c, SX + 16, FL + 2, 70, 4, 'o0', 'r2')
        shock(c, SX + 16, 30, ['r1', 'r2', 'r3', 'w'])
        pow_burst(c, SX + 16, FL - 2, 14, ['r1', 'u3', 'h2', 'w'], rot=0.3)
        c.cloud(SX - 4, FL - 5, 8, ['u0', 'u1', 'u2'], seed=5)
        debris(c, 0.3, 12, 6, SX + 16, FL - 4)
    elif f == 5:        # PEAK: shock dome rolls across to the allies
        veil(c, True)
        cracks(c, SX + 16, FL + 2, 96, 4, 'o0', 'r3')
        for i, (r, k) in enumerate(((82, 'r1'), (76, 'r2'), (70, 'r3'), (64, 'w'))):
            c.arc(SX + 16, FL, r, 200, 345, k, 3 if i == 3 else 2, squash=0.6)
        c.rays(SX + 16, FL, 12, 30, 58, 'r2', rot=math.pi, squash=0.6)
        debris(c, 0.6, 14, 6, SX + 16, FL - 4)
        for x in (44, 70, 96):
            c.cloud(x, FL - 5, 8, ['u0', 'u1', 'u2', 'u3'], seed=x)
        c.spark(104, 70, 9, 'w', 'h2', diag=True)
    elif f == 6:
        veil(c)
        cracks(c, SX + 16, FL + 2, 96, 4, 'o0', 'r1')
        for i, (r, k) in enumerate(((98, 'r1'), (93, 'r2'))):
            c.arc(SX + 16, FL, r, 205, 335, k, 2, squash=0.6)
        debris(c, 0.85, 14, 6, SX + 16, FL - 4)
        for x in (36, 62, 88, 110):
            c.cloud(x, FL - 7, 10, ['u0', 'u1', 'u2', 'u3'], seed=x + 1)
    elif f == 7:        # dust wall
        shade(c, 64, 64, 46, 'r0')
        cracks(c, SX + 16, FL + 2, 96, 4, 'o0')
        for x in (30, 52, 74, 96, 114):
            c.cloud(x, FL - 9, 11, ['u0', 'u1', 'u2'], seed=x + 2, parity=x % 2)
        debris(c, 1.0, 14, 6, SX + 16, FL - 4)
    elif f == 8:
        cracks(c, SX + 16, FL + 2, 96, 4, 'o0')
        for x in (40, 70, 100):
            c.ddisc(x, FL - 10, 12, 'u1', squash=0.6, parity=x % 2)
            c.ddisc(x - 4, FL - 16, 6, 'u2', squash=0.7)
    else:
        cracks(c, SX + 16, FL + 2, 96, 4, 'o0')
        for x in (50, 84):
            c.ddisc(x, FL - 6, 10, 'u0', squash=0.4)
    fade_oval(c, band=0.32)


if __name__ == '__main__':
    run(globals())

