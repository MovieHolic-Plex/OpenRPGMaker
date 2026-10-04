"""vehicles-2 철갑선(gunboat) — 파티 전투 시트 64px, 왼쪽을 본다, motion stomp(무겁게 다가가 들이받는다).
걷기 칩(흰 상갑판·주황 띠·굴뚝 달린 회백색 증기 군함)을 전투용으로 키운 것: 리벳 철판, 앞 포탑 주포, 브리지와 굴뚝, 충각 뱃머리.
"""
from pv_lib import *

CHIP, CELL = 'vehicles-2', 64
PAL = dict(o='1e2432', s0='3c4658', s1='6d798e', s2='a9b5c8', s3='eaf0f8', a='cc5a28', a2='f29a4a',
           r='c02a30', fy='ffe680', fo='ee6a2c', b1='2a5aa2', b2='52a4dc', f='eaf8ff', k='2a2418')
G = CELL - 4
WL = 54


def funnel(p, x, top, smoke_ph):
    p.solid([(x, top), (x + 7, top), (x + 8, 30), (x - 1, 30)], 's1', 's2', 's0')
    p.rect(x, top, x + 7, top + 1, 'k'); p.line([(x, top + 1), (x + 7, top + 1)], 's0')
    p.rect(x, top + 6, x + 8, top + 7, 'a')  # 주황 띠
    p.line([(x, top + 6), (x + 8, top + 6)], 'a2')


def boat(pose):
    p = Pen(CELL, PAL)
    dead = pose.get('dead', False)
    rec = pose.get('rec', 0)
    # 굴뚝·브리지(뒤)
    if not dead:
        p.line([(46, 27), (46, 15)], 's0', 1); p.px(46, 14, 's2')
        p.solid([(47, 15), (54, 16), (52, 20), (47, 19)], 'r', 'fo', 'r', edge='o')
        funnel(p, 36, 19, pose.get('ph', 0))
        p.solid([(29, 27), (49, 27), (51, 42), (27, 42)], 's3', 's3', 's1')          # 브리지
        p.rect(29, 27, 49, 28, 's2')
        for x in (32, 38, 44):
            p.rect(x, 32, x + 3, 35, 'o'); p.rect(x, 32, x + 2, 34, 'b2'); p.px(x, 32, 'f')
        p.line([(28, 40), (50, 40)], 's2')
    else:
        p.solid([(29, 33), (43, 34), (46, 42), (27, 42)], 's1', 's2', 's0')          # 찌그러진 브리지
        p.rect(35, 24, 41, 33, 's0'); p.line([(35, 24), (41, 24)], 'k')             # 부러진 굴뚝
    # 선체
    hull = [(3, 47), (8, 42), (57, 42), (60, 46), (56, 54), (12, 54), (5, 51)]
    p.solid(hull, 's1', 's2', 's0')
    p.line([(9, 43), (56, 43)], 's3')
    p.rect(7, 50, 57, 52, 'a'); p.line([(7, 50), (57, 50)], 'a2')                   # 주황 장갑대
    for x in range(10, 56, 4):
        p.px(x, 45, 's0'); p.px(x + 2, 47, 's0'); p.px(x, 48, 's0')
    for x in (16, 28, 40, 51):
        p.rect(x, 45, x + 1, 46, 'b1'); p.px(x, 45, 'b2')
    p.line([(4, 47), (7, 44)], 's3')                                                # 충각
    p.rect(3, 47, 4, 51, 's0')
    # 후미 소포
    p.rect(52, 38, 57, 42, 's1'); p.rect(56, 36, 58, 37, 's0')
    p.line([(52, 38), (57, 38)], 's2')
    # 포탑(앞)
    p.solid([(11, 34), (24, 34), (27, 42), (9, 42)], 's1', 's2', 's0')
    p.rect(13, 35, 16, 36, 's3')
    p.rect(17, 38, 21, 40, 's0'); p.px(17, 38, 'a')
    # 주포: 왼쪽으로 뻗는다. rec 만큼 뒤로 물러남
    bx = 10 + rec
    p.rect(1 + rec, 37, bx + 3, 39, 's0')
    p.rect(2 + rec, 36, bx + 3, 37, 's2')
    p.rect(1 + rec, 36, 2 + rec, 40, 's1'); p.line([(1 + rec, 36), (1 + rec, 40)], 's3')
    p.line([(bx, 36), (bx, 40)], 'a')
    return p


def draw(n):
    p = Pen(CELL, PAL)
    W = dict(depth=7, taper=(0, 1, 3, 5, 7, 9, 12))
    if n.startswith('idle'):
        i = ['idle_a', 'idle_b', 'idle_c'].index(n)
        b = boat(dict(ph=i, rec=0))
        pitch(b, (0, -0.015, 0.015)[i], cx=32)
        p.paste(b, 0, (0, -1, 0)[i])
        waves(p, WL, 2, 61, i * 2, gap=(6, 58), **W)
        # 굴뚝 연기(두 덩이, 위로 올라가며 커진다)
        for k, (x, y, r) in enumerate(((41 + i, 13 - i, 2 + (i == 2)), (43 + i * 2, 8 - i, 2), (46 + i, 4, 1 + (i == 1)))):
            puff(p, x, y, r, ['s1', 's2', 's3'], seed=i * 3 + k)
    elif n == 'windup':
        b = boat(dict(ph=1, rec=3))
        pitch(b, 0.04, cx=32)
        p.paste(b, 3, 0)
        waves(p, WL, 2, 61, 1, gap=(8, 60), **W)
        for x, y, r in ((44, 12, 2), (48, 8, 2), (52, 5, 1)):
            puff(p, x, y, r, ['s1', 's2', 's3'], seed=x)
        p.line([(4, 53), (0 + 2, 52)], 'f')
    elif n == 'move':
        b = boat(dict(ph=2, rec=0))
        pitch(b, -0.03, cx=32)
        p.paste(b, -2, -1)
        waves(p, WL, 2, 61, 2, gap=(4, 58), **W)
        for x, y in ((60, 51), (58, 49), (61, 47), (56, 52), (2, 51), (4, 49)):
            p.px(x, y, 'f')
        p.line([(52, 53), (60, 53)], 'f'); p.line([(2, 53), (6, 53)], 'f')
        for x, y, r in ((47, 11, 2), (52, 8, 2), (57, 6, 2)):
            puff(p, x, y, r, ['s1', 's2', 's3'], seed=x + 7)
    elif n == 'attack':
        b = boat(dict(ph=0, rec=0))
        pitch(b, -0.04, cx=32)
        p.paste(b, 0, 1)
        burst(p, 6, 39, 5, ['fo', 'fy', 'f'])
        for x, y, r in ((7, 30, 3), (12, 25, 3), (3, 33, 2)):
            puff(p, x, y, r, ['s0', 's1', 's2'], seed=x)
        waves(p, WL + 1, 2, 60, 3, gap=(8, 58), depth=6, taper=(0, 2, 4, 6, 8, 11))
    elif n == 'recover':
        b = boat(dict(ph=1, rec=2))
        p.paste(b, 1, 0)
        waves(p, WL, 2, 61, 3, gap=(6, 58), **W)
        for x, y, r in ((6, 32, 3), (11, 27, 2), (16, 23, 2), (44, 12, 2), (48, 7, 2)):
            puff(p, x, y, r, ['s1', 's2', 's3'], seed=x + 2)
    elif n == 'hit':
        b = boat(dict(ph=1, rec=1))
        b.recolor(dict(s0='s1', s1='s2', s2='s3', a='a2', b1='b2', r='fo'))
        pitch(b, 0.07, cx=32)
        p.paste(b, 3, -1)
        waves(p, WL, 2, 61, 1, gap=(8, 60), **W)
        for x, y in ((6, 32), (4, 36), (58, 34), (60, 38), (12, 30)):
            p.px(x, y, 'f')
        spark(p, 30, 33, 3, 'f', 'fy'); spark(p, 12, 38, 2, 'f', 'fy')
    elif n == 'dead':
        b = boat(dict(dead=True, rec=6))
        pitch(b, 0.16, cx=32)
        p.paste(b, 0, 3)
        waves(p, 48, 2, 61, 0, depth=13, taper=(0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11))
        # 불타는 잔해
        burst(p, 40, 35, 6, ['fo', 'fy'])
        for x, y, r in ((44, 28, 3), (48, 22, 3), (53, 16, 2)):
            puff(p, x, y, r, ['k', 's0', 's1'], seed=x)
        for x, y in ((14, 51), (24, 54), (36, 52), (50, 55)):
            p.px(x, y, 'f')
    return settle(p, G)


if __name__ == '__main__':
    run(globals())
