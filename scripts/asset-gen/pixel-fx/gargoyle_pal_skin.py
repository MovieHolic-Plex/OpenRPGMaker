"""gargoyle_pal_skin: 석화 피부. 몸 둘레에 각진 돌판이 하나씩 굳어 붙고 금이 가며 돌빛이 번쩍한다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'gargoyle_pal_skin', 64, 8, 'user'
PAL = pal(STONE, pick(SAND, 'n1', 'n2', 'n3'))


def plate(c, x, y, w, h, ang, keys):
    pts = [(-w, -h * 0.6), (w * 0.4, -h), (w, -h * 0.2), (w * 0.7, h), (-w * 0.6, h * 0.8)]
    ca, sa = math.cos(ang), math.sin(ang)
    P = [(x + px * ca - py * sa, y + px * sa + py * ca) for px, py in pts]
    c.poly(P, keys[0])
    P2 = [(x + (px * 0.72) * ca - (py * 0.72) * sa - 0.6, y + (px * 0.72) * sa + (py * 0.72) * ca - 0.6) for px, py in pts]
    c.poly(P2, keys[1])
    c.line([P2[0], P2[1], P2[2]], keys[2])


def draw(c, f):
    cx, cy = 32, 36
    n = 12
    for i in range(n):
        a = i * 2 * math.pi / n + 0.3
        st = (i * 5) % 6 * 0.6
        if f < st:
            continue
        gr = min(1.0, (f - st + 1) / 2.5)
        x = cx + math.cos(a) * 14 * gr * (1 + (1 - gr) * 0.5)
        y = cy + math.sin(a) * 19 * gr * (1 + (1 - gr) * 0.4)
        plate(c, x, y, 4.5, 5.5, a + 1.2, ['s0', 's2', 's4'] if math.sin(a) < 0.3 else ['s0', 's1', 's3'])
    if f >= 5:
        for k in range(4):
            crack(c, cx - 8 + k * 6, cy - 12 + (k % 2) * 8, 1.6 + k, 7, 5 + k, 's0', 1.0, branch=1)
    if f == 5:
        c.spark(cx, cy - 6, 8, 's4', 's3', diag=True)
    if f >= 6:
        for k in range(6):
            r = rng(30 + k + (f - 6) * 7)
            c.spark(cx + r.uniform(-16, 16), cy + r.uniform(-20, 18), 2 if f == 6 else 1, 's4', 's3')
    if f <= 3:
        for k in range(6):
            r = rng(50 + k)
            c.px(cx + r.uniform(-16, 16), 54 - (f * 3 + k * 4) % 14, 'n3')
    if f in (2, 3, 4):
        dust(c, cx, 55, 12 + f, 2, ['n1', 'n2', 'n3'])


if __name__ == '__main__':
    run(globals())
