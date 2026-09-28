"""monk_dragon_hit: 용권 멸살 착탄. The golden dragon's head crashes down onto the target,
a white-core gold explosion with a flame ring, a rising pillar of fire, then embers and smoke.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_monk import *

KEY, SIZE, FRAMES, ANCHOR = 'monk_dragon_hit', 128, 10, 'target'
PAL = pal(MONK, WHITE, q0='#1a0c0a', q1='#48180c', q2='#6e3a2a')
CX, CY, FEET = 64, 76, 120
KEYS = ('k', 'o2', 'y2', 'w')


def head_path(t):
    return (lerp(150, CX + 4, t), lerp(-30, CY - 6, t))


def flame_ring(c, t, seed, keys):
    r = rng(seed)
    n = 11
    for i in range(n):
        a = math.pi + (i + 0.5) * math.pi / n
        d = lerp(12, 46, ease(t))
        x = CX + math.cos(a) * d
        h = r.uniform(10, 22) * (1 - 0.6 * t) * (1 - abs(math.cos(a)) * 0.4)
        flame_tongue(c, x, FEET, h, 3.5, keys, seed=i + seed, lean=math.cos(a) * 0.4)


def smoke(c, t, seed):
    r = rng(seed)
    for i in range(6):
        x = CX + r.uniform(-34, 34)
        y = lerp(FEET - 16, 30, t) + r.uniform(-8, 8)
        rr = r.uniform(7, 11) * (0.7 + 0.5 * t)
        c.cloud(x, y, rr, ['q0', 'q1', 'q2'], seed=i + seed, lobes=7, parity=i)


def draw(c, f):
    if f == 0:
        for j in range(-3, 4):
            c.line([(150 + j * 6, -30), (CX + 34 + j * 6, CY - 42)], 'o2' if j % 2 else 'y2')
        x, y = head_path(0.55)
        dragon_head(c, x, y, math.atan2(CY + 30, CX - 150), 9, KEYS, eye='k', whisker='y3')
        c.spark(CX, CY, 4, 'w', 'y2')
    elif f == 1:
        for j in range(-3, 4):
            c.line([(128 + j * 5, -8), (CX + 18 + j * 5, CY - 24)], 'o2' if j % 2 else 'y2')
        x, y = head_path(0.9)
        dragon_head(c, x, y, math.atan2(CY + 30, CX - 150), 12, KEYS, eye='k', whisker='y3')
        c.oval(CX, FEET, 30, 4, 'o1')
    elif f == 2:
        c.rays(CX, CY, 24, 20, 70, 'y2', rot=0.05, jitter=[1, 0.72, 0.9, 0.6, 0.95])
        pow_burst(c, CX, CY, 38, ['o0', 'o1', 'o2', 'y2', 'y3', 'w'], rot=0.1, n=12)
        c.disc(CX, CY, 12, 'w')
    elif f == 3:
        for i, (k, r) in enumerate((('o0', 40), ('o1', 34), ('o2', 28), ('y2', 20), ('y3', 13), ('w', 7))):
            c.disc(CX - i * 0.8, CY - i, r, k)
        c.ring(CX, CY, 46, 'y2', 2)
        flame_ring(c, 0.1, 3, ['o0', 'o1', 'o2', 'y2'])
        burst(c, CX, CY, 0.25, 26, 3, ['w', 'y3', 'y2', 'o2'], spd=(30, 60), size=(1, 3))
    elif f == 4:
        c.poly([(CX - 22, FEET), (CX - 12, 4), (CX + 12, 4), (CX + 22, FEET)], 'o1')
        c.poly([(CX - 14, FEET), (CX - 7, 0), (CX + 7, 0), (CX + 14, FEET)], 'y2')
        c.poly([(CX - 6, FEET), (CX - 2, 0), (CX + 2, 0), (CX + 6, FEET)], 'w')
        for i, (k, r) in enumerate((('o0', 34), ('o1', 28), ('o2', 22), ('y2', 14))):
            c.ring(CX, CY, r + 16, k, 2)
        flame_ring(c, 0.35, 3, ['o0', 'o1', 'o2', 'y2', 'y3'])
        burst(c, CX, CY, 0.45, 26, 3, ['w', 'y3', 'y2', 'o2', 'o1'], spd=(30, 60), size=(1, 3))
    elif f == 5:
        c.poly([(CX - 18, FEET), (CX - 10, 8), (CX + 10, 8), (CX + 18, FEET)], 'o1')
        c.poly([(CX - 10, FEET), (CX - 5, 4), (CX + 5, 4), (CX + 10, FEET)], 'y2')
        c.line([(CX, 4), (CX, FEET)], 'y3', 3)
        # dragon silhouette spiralling up the pillar
        for i in range(5):
            y = FEET - 12 - i * 20
            c.arc(CX, y, 20 - i, 190, 350, 'y3', 2, squash=0.35)
            c.arc(CX, y + 10, 18 - i, 10, 170, 'o2', 2, squash=0.35)
        dragon_head(c, CX + 10, 16, -0.6, 8, KEYS, eye='k', whisker='y3')
        c.dring(CX, CY, 56, 'o1')
        flame_ring(c, 0.6, 3, ['o0', 'o1', 'o2', 'y2'])
        burst(c, CX, CY, 0.65, 26, 3, ['y3', 'y2', 'o2', 'o1'], spd=(30, 60), size=(1, 3))
    elif f == 6:
        smoke(c, 0.1, 6)
        c.poly([(CX - 10, FEET), (CX - 5, 20), (CX + 5, 20), (CX + 10, FEET)], 'o1')
        c.line([(CX, 20), (CX, FEET)], 'y2', 3)
        flame_ring(c, 0.8, 3, ['o0', 'o1', 'o2'])
        burst(c, CX, CY, 0.8, 26, 3, ['y2', 'o2', 'o1', 'o0'], spd=(30, 60), size=(1, 3), grav=0.4)
    elif f == 7:
        smoke(c, 0.35, 6)
        for y in range(30, FEET, 4):
            c.px(CX + (y // 4) % 3 - 1, y, 'o2')
        flame_ring(c, 1.0, 3, ['o0', 'o1'])
        burst(c, CX, 50, 0.6, 18, 7, ['y2', 'o2', 'o1'], spd=(10, 40), up=0.8)
    elif f == 8:
        smoke(c, 0.6, 6)
        c.dring(CX, FEET, 44, 'q1', squash=0.15)
        burst(c, CX, 50, 0.85, 18, 7, ['y2', 'o2', 'o1', 'o0'], spd=(10, 40), up=0.8)
    elif f == 9:
        for i in range(6):
            r = rng(i)
            c.ddisc(CX + r.uniform(-36, 36), lerp(FEET - 16, 20, 0.85) + r.uniform(-8, 8), 7, 'q1', parity=i)
        burst(c, CX, 50, 1.0, 18, 7, ['o2', 'o1', 'o0'], spd=(10, 40), up=0.9)


if __name__ == '__main__':
    run(globals())

