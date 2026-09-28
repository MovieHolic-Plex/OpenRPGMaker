"""vehicles-4 굴착기(drill) — 파티 전투 시트 48px, 왼쪽을 본다, motion dash(드릴을 돌리며 곧장 파고든다).
걷기 칩(리벳 박힌 흰 강철 통, 초록 깃발 잠망경)을 전투용으로 키운 것: 앞머리에 나선 드릴, 궤도, 지붕 잠망경.
"""
import math
from pv_lib import *

CHIP, CELL = 'vehicles-4', 48
PAL = dict(o='1c2230', s0='3e485c', s1='7885a0', s2='b8c3d6', s3='eef3fa', k='2a2c38', g1='2e7a44', g2='62c060',
           a='c85a26', a2='f29a4a', fy='ffe680', fo='ee6a2c', d0='5a3a26', d1='a4703f', f='fbfdff')
G = CELL - 4


def cone(p, tipx, tipy, basex, half, phase, blur=False):
    """왼쪽을 향한 나선 드릴. 뿌리(basex)에서 반높이 half, 끝(tipx,tipy)."""
    pts = {}
    for x in range(tipx, basex + 1):
        t = (x - tipx) / max(1, basex - tipx)
        h = half * t
        for y in range(int(round(tipy - h)), int(round(tipy + h)) + 1):
            pts[(x, y)] = (t, (y - tipy) / max(h, 0.5))
    for (x, y), (t, v) in pts.items():
        edge = any((x + dx, y + dy) not in pts for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if not (dx == 1 and x == basex))
        if edge and x < basex:
            p.px(x, y, 'o')
            continue
        band = ((x * 2 + y * 3 + phase * 3) // 5) % 2
        if blur:
            k = 'a2' if (x + y + phase) % 2 == 0 else 'a'
        else:
            k = 'a2' if band else 'a'
        if v < -0.5 and not blur:
            k = 'fy' if band else 'a2'
        elif v > 0.5:
            k = 'fo' if False else ('a' if band else 'k')
        if t < 0.22:
            k = 's3' if v < 0 else 's2'
        elif t > 0.9:
            k = 's1' if v > -0.4 else 's2'
        p.px(x, y, k)


def body(pose):
    p = Pen(CELL, PAL)
    dx = pose.get('dx', 0)
    # 궤도
    p.solid([(15, 37), (44, 37), (45, 42), (14, 42)], 'k', 's0', 'o')
    for x in range(16, 44, 3):
        p.px(x, 40, 's1')
    for x in (18, 27, 36):
        p.disc(x, 40, 2, 's0'); p.px(x - 1, 39, 's1')
    # 몸통
    p.solid([(15, 20), (42, 20), (45, 25), (45, 37), (15, 37)], 's2', 's3', 's1')
    p.rect(16, 30, 44, 31, 's1')
    for x in range(18, 44, 4):
        p.px(x, 28, 's0'); p.px(x, 34, 's0')
    p.rect(18, 22, 25, 27, 'o'); p.rect(19, 23, 24, 26, 'g1'); p.px(19, 23, 'g2'); p.px(20, 23, 'g2')  # 관측창
    p.rect(30, 22, 41, 24, 's1'); p.line([(30, 22), (41, 22)], 's3')
    p.rect(30, 26, 32, 28, 'a'); p.px(30, 26, 'a2')                                                  # 주황 경고등
    p.rect(35, 26, 37, 28, 'a'); p.px(35, 26, 'a2')
    # 잠망경 + 초록 깃발
    p.line([(38, 19), (38, 10)], 's0'); p.line([(37, 10), (39, 10)], 's2')
    ph = pose.get('ph', 0)
    for i in range(5):
        wob = (0, 1, 1, 0)[(i + ph) % 4]
        p.line([(39 + i, 11 + wob), (39 + i, 14 + wob - (1 if i == 4 else 0))], 'g1')
        p.px(39 + i, 11 + wob, 'g2')
    # 배기구
    p.rect(44, 25, 46, 28, 's0'); p.line([(44, 25), (46, 25)], 's2')
    squeeze(p, 26, 29)
    return p


def draw(n):
    p = Pen(CELL, PAL)
    if n.startswith('idle'):
        i = ['idle_a', 'idle_b', 'idle_c'].index(n)
        b = body(dict(ph=i * 2))
        p.paste(b, 0, (0, -1, 0)[i])
        cone(p, 3, 29 + (0, -1, 0)[i], 15, 9, i)
        p.rect(14, 22 + (0, -1, 0)[i], 15, 36 + (0, -1, 0)[i], 's0')
        for x, y in ((44 + i % 2, 22), ):
            p.px(x, y, 's2')
        puff(p, 47, 22 - i, 1, ['s0', 's1'], seed=i)
        p.ddots(14, 43, 45, 44, 'd0', parity=i)
    elif n == 'windup':
        b = body(dict(ph=1))
        pitch(b, -0.06, cx=30)
        p.paste(b, 1, 0)
        cone(p, 4, 29, 17, 9, 1, blur=True)
        p.rect(16, 22, 17, 36, 's0')
        for x, y in ((2, 25), (3, 34), (5, 22), (1, 30)):
            p.px(x, y, 'fy')
        for x, y in ((44, 44), (40, 43), (46, 42)):
            p.px(x, y, 'd1')
        p.ddots(15, 43, 46, 44, 'd0', parity=1)
    elif n == 'move':
        b = body(dict(ph=2))
        pitch(b, 0.03, cx=30)
        p.paste(b, -2, 0)
        cone(p, 2, 30, 13, 9, 2, blur=True)
        p.rect(12, 22, 13, 37, 's0')
        for x, y in ((45, 40), (46, 37), (44, 43), (42, 41), (47, 34)):
            p.disc(x, y, 1, 'd1')
        p.line([(40, 44), (47, 44)], 'd0')
        p.line([(3, 20), (0 + 1, 20)], 'f')
    elif n == 'attack':
        b = body(dict(ph=3))
        p.paste(b, -3, 0)
        cone(p, 1, 30, 12, 9, 0, blur=True)
        p.rect(11, 22, 12, 37, 's0')
        # 드릴 끝 불꽃과 튀는 흙
        spark(p, 3, 26, 2, 'f', 'fy'); spark(p, 4, 35, 2, 'fy', 'fo'); spark(p, 2, 30, 1, 'f')
        for x, y in ((6, 20), (10, 18), (4, 23), (2, 38), (7, 40)):
            p.disc(x, y, 1, 'd1'); p.px(x + 1, y + 1, 'd0')
        for x, y in ((43, 41), (46, 38), (45, 43)):
            p.disc(x, y, 1, 'd1')
    elif n == 'recover':
        b = body(dict(ph=0))
        p.paste(b, 0, 0)
        cone(p, 3, 29, 15, 9, 3, blur=False)
        p.rect(14, 22, 15, 36, 's0')
        for x, y in ((7, 41), (10, 40), (4, 42)):
            p.px(x, y, 'd1')
        puff(p, 47, 20, 2, ['s0', 's1', 's2'], seed=3)
        p.ddots(14, 43, 45, 44, 'd0')
    elif n == 'hit':
        b = body(dict(ph=1))
        b.recolor(dict(s0='s1', s1='s2', s2='s3', s3='f', k='s0', a='a2', g1='g2', d0='d1'))
        pitch(b, -0.08, cx=30)
        p.paste(b, 3, 0)
        cone(p, 6, 29, 18, 9, 2)
        p.rect(17, 22, 18, 36, 's1')
        for x, y in ((4, 18), (1, 24), (46, 16), (45, 30)):
            p.px(x, y, 'f')
        spark(p, 10, 22, 3, 'f', 'fy'); spark(p, 36, 30, 2, 'f', 'fy')
    elif n == 'dead':
        b = body(dict(ph=1))
        pitch(b, 0.10, cx=30)
        # 잘려나간 드릴
        p.paste(b, 2, 3)
        cone(p, 1, 42, 12, 4, 0)
        p.rect(20, 36, 24, 39, 'o')                              # 열린 해치
        puff(p, 30, 14, 3, ['k', 's0', 's1'], seed=5); puff(p, 34, 8, 2, ['k', 's0', 's1'], seed=6); puff(p, 37, 3, 2, ['k', 's0', 's1'], seed=8)
        burst(p, 26, 30, 4, ['fo', 'fy'])
        p.ddots(2, 43, 46, 44, 'd0')
    shift(p, {'move': 2, 'attack': 2}.get(n, 1), 0)
    return settle(p, G)


if __name__ == '__main__':
    run(globals())
