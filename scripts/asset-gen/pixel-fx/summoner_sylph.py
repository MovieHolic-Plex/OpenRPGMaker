"""summoner_sylph: 바람 요정: 잠자리 날개의 요정 셋이 아군 둘레를 나선으로 날며 연둣빛 바람 띠와 치유 반짝임을 남긴다
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from lib_r2w2 import *

KEY, SIZE, FRAMES, ANCHOR = 'summoner_sylph', 64, 10, 'allAllies'
PAL = pal(pick(LEAFG, 'g1', 'g2', 'g3'), pick(TEAL, 't3'), pick(ICEB, 'i4'), pick(GOLDY, 'y3'), WHITE)


def fairy(c, x, y, f):
    up = f % 2
    for sd in (-1, 1):
        c.oval(x + sd * 5, y - 4 - up, 4, 2.2 + up, 'i4')
        c.oval(x + sd * 4, y - 1, 3, 1.5, 't3')
    c.rect(x - 1, y - 1, x + 1, y + 4, 'g2')
    c.rect(x - 1, y + 4, x, y + 6, 'g1')
    c.disc(x, y - 3, 2.2, 'y3')
    c.px(x - 1, y - 4, 'w')


def draw(c, f):
    lvl = [.4, .7, 1, 1, 1, 1, 1, 1, .7, .4][f]
    for k in range(3):
        pts = []
        for i in range(26):
            u = i / 25
            a = f * .55 + k * 2.09 + u * 5.5
            r = (8 + u * 16) * lvl
            pts.append((CX + math.cos(a) * r, 34 + math.sin(a) * r * .55 - u * 10 + 8))
        ribbon(c, pts[:max(2, int(26 * lvl))], ('g1', 'g2', 'g3'), 1)
        fx, fy = pts[max(1, int(26 * lvl)) - 1]
        fairy(c, fx, fy, f + k)
    for i in range(8):
        c.spark(10 + (i * 8 + f * 3) % 44, 54 - ((f * 6 + i * 9) % 46), 2 if i % 2 else 1, 'w', 'y3') if (i + f) % 2 == 0 else c.px(10 + (i * 8) % 44, 46 - ((f * 5 + i * 7) % 40), 't3')
    c.dring(CX, 56, 12 + lvl * 5, 'g2', squash=.3, parity=f)


if __name__ == '__main__':
    run(globals())
