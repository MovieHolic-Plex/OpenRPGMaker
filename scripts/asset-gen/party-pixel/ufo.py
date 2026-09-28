"""vehicles-7 미확인 비행체(ufo) — 파티 전투 시트 48px, 왼쪽을 본다, motion float(둥실 떠서 광선을 쏜다).
걷기 칩(갈색 접시, 초록 추진 원뿔, 파란 불빛)을 전투용으로 키운 것: 유리 돔 속 꼬마 외계인, 테두리 신호등, 배 밑 광선 발사구.
"""
import math
from pv_lib import *

CHIP, CELL = 'vehicles-7', 48
PAL = dict(o='241a2c', b0='5a3c34', b1='96684c', b2='d8a26c', g0='3a8cb6', g='7edaec', f='fbfdff', l='7ed84e',
           u='2f9cff', u2='b0e4ff', n0='1e7a3a', n1='62e052', fy='ffe680', fo='ee6a2c', sh='1c2234')
G = CELL - 4


def saucer(p, lights=0, glow=2, off=False, alien=True, crack=False):
    cx = 24
    # 추진 원뿔(배 밑)
    for k, x in enumerate((13, 24, 35)):
        p.poly([(x - 3, 29), (x + 3, 29), (x + 1, 33), (x - 1, 33)], 'o')
        p.poly([(x - 2, 29), (x + 2, 29), (x + 1, 32), (x - 1, 32)], 'n0')
        if not off:
            gl = glow + (1 if (k + lights) % 2 else 0)
            p.rect(x - 1, 33, x + 1, 33 + gl - 1, 'n1'); p.px(x, 33 + gl, 'n0')
            p.px(x, 33, 'f')
    # 접시 몸통
    p.solid([(5, 24), (9, 19), (39, 19), (43, 24), (39, 30), (9, 30)], 'b1', 'b2', 'b0')
    p.line([(9, 20), (39, 20)], 'b2')
    p.line([(6, 24), (42, 24)], 'b0')
    # 테두리 신호등
    for k, x in enumerate(range(11, 38, 5)):
        on = (k + lights) % 2 == 0 and not off
        p.rect(x, 22, x + 1, 23, 'u2' if on else 'u') if not off else p.rect(x, 22, x + 1, 23, 'b0')
    # 배 발사구
    p.rect(19, 28, 29, 30, 'b0'); p.line([(19, 28), (29, 28)], 'o')
    p.rect(22, 29, 26, 30, 'g0' if not off else 'o')
    # 돔
    p.solid([(14, 19), (16, 12), (21, 9), (27, 9), (32, 12), (34, 19)], 'g', 'f', 'g0')
    p.rect(17, 12, 18, 13, 'f')
    if alien:
        p.rect(21, 13, 27, 18, 'l'); p.rect(22, 13, 24, 14, 'l')
        p.rect(21, 15, 22, 16, 'o'); p.rect(25, 15, 26, 16, 'o')    # 눈 (왼쪽 큰 눈)
        p.px(21, 15, 'f')
        p.line([(22, 11), (21, 9)], 'l') if False else None
    if crack:
        p.line([(23, 10), (26, 14), (24, 17)], 'o')
    # 안테나
    p.line([(24, 8), (24, 4)], 'b0'); p.px(24, 3, 'fo')
    return p


def shadow(p, w):
    for x in range(24 - w, 24 + w + 1):
        if x % 2 == 0:
            p.px(x, G, 'sh')
    for x in range(24 - w + 3, 24 + w - 2):
        if x % 2 == 1:
            p.px(x, G - 1, 'sh')


def draw(n):
    p = Pen(CELL, PAL)
    if n.startswith('idle'):
        i = ['idle_a', 'idle_b', 'idle_c'].index(n)
        s = saucer(Pen(CELL, PAL), lights=i, glow=(2, 3, 2)[i])
        pitch(s, (0, 0.02, -0.02)[i], cx=24)
        p.paste(s, 0, (0, -1, 1)[i] + 2)
        shadow(p, (10, 9, 11)[i])
    elif n == 'windup':
        s = saucer(Pen(CELL, PAL), lights=1, glow=4)
        p.paste(s, 0, 4)
        # 발사구에 모이는 빛
        p.disc(24, 35, 3, 'fy'); p.disc(24, 35, 1, 'f')
        for x, y in ((18, 33), (30, 33), (24, 41), (16, 38), (32, 38)):
            p.px(x, y, 'fy')
        shadow(p, 8)
    elif n == 'move':
        s = saucer(Pen(CELL, PAL), lights=0, glow=4)
        pitch(s, 0.08, cx=24)
        p.paste(s, -1, 2)
        shadow(p, 11)
        p.line([(38, 14), (45, 14)], 'f'); p.line([(41, 22), (45, 22)], 'f'); p.line([(40, 30), (45, 30)], 'f')
    elif n == 'attack':
        s = saucer(Pen(CELL, PAL), lights=1, glow=1)
        p.paste(s, 0, 0)
        # 왼쪽 아래로 내리꽂는 광선
        outer = [(22, 31), (26, 31), (12, 44), (1, 44)]
        p.ddots(0, 30, 27, 44, 'fy', only_empty=True) if False else None
        m = p._mask(outer)
        mp = m.load()
        for y in range(30, 45):
            for x in range(0, 28):
                if mp[x, y] and p.get(x, y)[3] == 0 and (x + y) % 2 == 0:
                    p.px(x, y, 'fy')
        core = [(23, 32), (25, 32), (8, 44), (4, 44)]
        m2 = p._mask(core)
        mp2 = m2.load()
        for y in range(30, 45):
            for x in range(0, 28):
                if mp2[x, y] and p.get(x, y)[3] == 0:
                    p.px(x, y, 'fy' if (x + y) % 3 else 'f')
        burst(p, 4, 42, 4, ['fo', 'fy', 'f'])
        p.disc(24, 31, 3, 'f'); p.disc(24, 31, 2, 'fy')
    elif n == 'recover':
        s = saucer(Pen(CELL, PAL), lights=0, glow=2)
        pitch(s, -0.03, cx=24)
        p.paste(s, 1, 1)
        shadow(p, 10)
        for x, y in ((9, 38), (6, 41), (12, 41)):
            p.px(x, y, 'fy')
    elif n == 'hit':
        s = saucer(Pen(CELL, PAL), lights=1, glow=1, off=True)
        s.recolor(dict(b0='b1', b1='b2', b2='f', g0='g', g='f', n0='n1', o='b0', l='n1'))
        pitch(s, -0.12, cx=24)
        p.paste(s, 3, 2)
        spark(p, 12, 20, 3, 'f', 'fy'); spark(p, 38, 26, 2, 'f', 'fy')
        for x, y in ((3, 10), (44, 8), (45, 36)):
            p.px(x, y, 'f')
        shadow(p, 9)
    elif n == 'dead':
        s = saucer(Pen(CELL, PAL), lights=0, glow=0, off=True, crack=True)
        pitch(s, 0.14, cx=24)
        p.paste(s, 0, 8)
        for (x, y, r) in ((30, 22, 3), (34, 16, 3), (37, 10, 2), (39, 5, 2)):
            puff(p, x, y, r, ['sh', 'o', 'b0'], seed=x)
        burst(p, 12, 37, 4, ['fo', 'fy'])
        p.ddots(2, 42, 46, 43, 'sh')
    return settle(p, G)


if __name__ == '__main__':
    run(globals())
