"""demon_knight_awaken: 마검 각성. 발밑 붉은 마법진에서 검은 불꽃이 기둥처럼 솟고 몸을 감싼 불길이 일렁인다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'demon_knight_awaken', 64, 8, 'user'
PAL = pal(DEMON, pick(GOLD, 'y2', 'y3'), pick(DARKV, 'u1', 'u2'))


def draw(c, f):
    cx, gy = 32, 54
    rr = 8 + f * 2 if f < 5 else 18
    c.oval(cx, gy, rr, rr * 0.28, 'd2', 1)
    c.oval(cx, gy, rr - 5, (rr - 5) * 0.28, 'd3', 1)
    if f >= 2:
        for k in range(6):
            a = k * math.pi / 3 + f * 0.4
            x, y = pol(cx, gy, rr - 2, a, 0.28)
            c.px(x, y, 'y3')
            c.line([(x, y), pol(cx, gy, rr - 8, a + 0.5, 0.28)], 'y2')
    for i, dx in enumerate((-13, -5, 3, 11)):
        h = [14, 22, 32, 40, 42, 38, 30, 20][f] - (i % 2) * 8
        flame(c, cx + dx + (i - 1.5) * 1.2, gy, 7, max(4, h), ['u1', 'd1', 'd2', 'd3', 'd4'], seed=i + f, sway=(f % 3 - 1) * 1.5, tongues=1)
    if f >= 3:
        for k in range(8):
            r = rng(3 + k)
            c.spark(cx + r.uniform(-14, 14), gy - ((f * 5 + k * 6) % 40), 2, 'y3', 'y2')
    if f in (3, 4):
        c.spark(cx, 30, 8, 'y3', 'd4', diag=True)


if __name__ == '__main__':
    run(globals())
