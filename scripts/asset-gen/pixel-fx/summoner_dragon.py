"""summoner_dragon: 용신 강림: 하늘의 문이 열려 푸른 금빛 용신이 무대를 가로질러 내려오고 빛의 숨결이 화면을 삼킨다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'summoner_dragon', 128, 12, 'screen'
PAL = pal(pick(ICEB, 'i1', 'i2', 'i3', 'i4'), pick(GOLDY, 'y2', 'y3'), pick(PURP, 'v0', 'v1', 'v2'), WHITE)
KEYS = ('i1', 'i2', 'i3', 'i4')


def path(t):
    return (lerp(122, 14, t), lerp(14, 92, t) + math.sin(t * 8.5) * 13)


def draw(c, f):
    lvl = [.3, .55, .8, 1, 1, 1, 1, 1, 1, 1, .7, .4][f]
    shade(c, 64, 66, 50 * lvl + 14, 'v0', squash=.8)
    # 하늘의 문
    gx, gy = 104, 24
    if f <= 8:
        r = min(26, 8 + f * 5)
        c.ring(gx, gy, r, 'y2', 2, squash=.9)
        c.ring(gx, gy, r * .7, 'i3', 1, squash=.9)
        c.rays(gx, gy, 16, r * .7, r * 1.3, 'y3', rot=f * .1, jitter=[1, .6, .85])
        c.dring(gx, gy, r * 1.3, 'v2')
    # 용
    if f >= 2:
        ht = min(1.0, (f - 1) * .11)
        body = 0.5
        dragon(c, path, ht, max(0.0, ht - body), lambda u: 2.5 + u * 6.5, KEYS, 'y3', head_s=1.5, eye='w', whisker='y3')
    # 숨결
    if f >= 8:
        hx, hy = path(min(1.0, (8 - 1) * .11 + .1))
        beam(c, 30, 70, 6, 92, 5 + (f - 8) * 4, 16 + (f - 8) * 8, 'y3', 'i3', phase=f * 3)
        c.spark(20, 80, 8 + (f - 8) * 3, 'w', 'y3', diag=True)
    for i in range(12):
        c.spark(16 + (i * 21 + f * 7) % 100, 8 + (i * 17) % 100, 2 if i % 2 else 1, 'w', 'y3') if (i + f) % 2 == 0 else None


if __name__ == '__main__':
    run(globals())
