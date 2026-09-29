"""dancer_ribbon: 리본 채찍: 장밋빛 긴 리본이 물결치며 날아와 적을 나선으로 휘감아 조였다 흩어진다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'dancer_ribbon', 64, 8, 'target'
PAL = pal(ROSE, pick(GOLDY, 'y2', 'y3'), WHITE)


def path(u, R, rot, wob=0.0):
    a = rot + u * 3.3 * math.pi
    rr = R * (1 - u * .35)
    return (CX + math.cos(a) * rr, 32 + math.sin(a) * rr * .8 + u * 8 + math.sin(u * 9 + wob) * wob * 2)


def draw(c, f):
    if f <= 1:
        # 날아오는 리본: 오른쪽에서 사인 곡선
        L = [.5, .95][f]
        pts = [(64 - i * 3.2, 30 + math.sin(i * .6 + f) * 6 - i * .3) for i in range(int(L * 20))]
        ribbon(c, pts, ('p0', 'p1', 'p2'), 3)
        if pts:
            c.spark(pts[-1][0], pts[-1][1], 3, 'w', 'p3')
    elif f <= 4:
        prog = [.55, .85, 1, 1][f - 2]
        R = [22, 19, 15][f - 2] if f < 5 else 15
        pts = [path(i / 30 * prog, R, .4, wob=1) for i in range(int(30 * prog) + 1)]
        # 리본 꼬리 2줄
        ribbon(c, pts, ('p0', 'p1', 'p2'), 3)
        tail = pts[-1]
        ribbon(c, [tail, (tail[0] - 6, tail[1] - 5), (tail[0] - 3, tail[1] - 11)], ('p0', 'p1', 'p2'), 2)
        if f == 3:
            c.spark(CX, 34, 8, 'w', 'y3', diag=True)
            star(c, CX, 34, 8, 8, 4, 'p3', rot=.3)
            c.disc(CX, 34, 2, 'w')
        if f == 4:
            c.ring(CX, 34, 9, 'p3', 1, squash=1.3)
    else:
        k = f - 5
        pts = [path(i / 30, 15 + k * 5, .4 + k * .3, wob=2) for i in range(31)]
        ribbon(c, pts, ('p0', 'p1', 'p2'), 3 if k == 0 else 2)
        burst_petals(c, CX, 34, 6, 12 + k * 7, 5 + k, drop=k * 5, L=4, keys=('p1', 'p2', 'p3'), hi='p4')
        for i in range(4):
            c.spark(14 + (i * 13 + k * 5) % 40, 14 + (i * 9) % 30, 2, 'y3', 'y2') if i % 2 else None
        if k == 2:
            dissolve(c, .5)


if __name__ == '__main__':
    run(globals())
