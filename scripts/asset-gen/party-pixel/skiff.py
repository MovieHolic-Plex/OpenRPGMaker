"""vehicles-0 쪽배(skiff) — 파티 전투 시트 48px, 왼쪽을 본다, motion dash.
걷기 칩(초록 깃발 달린 나무 쪽배)의 색·모양을 전투용으로 키운 것: 뱃머리에 작살포, 초록 두건 뱃사공, 뱃고물 깃발.
"""
import sys
from pv_lib import *

CHIP, CELL = 'vehicles-0', 48
PAL = dict(o='2a1a10', w0='5c3a1a', w1='8c5a2a', w2='ba8240', w3='e0ae62', g1='2e6e3a', g2='5cb04e',
           b1='2a5aa2', b2='52a4dc', f='eaf8ff', i='9aa6ba', j='e4ecf8', s='f0c090', h='4a2a18')
G = CELL - 4  # 물 기준선(가장 아래 행)


def hull(p, dead=False):
    """뱃몸(왼쪽 뱃머리가 솟은 배). 뱃머리 끝 (6,30), 고물 (41,33)."""
    pts = [(6, 30), (10, 35), (36, 35), (41, 32), (40, 38), (35, 41), (13, 41), (8, 39), (6, 34)]
    p.solid(pts, 'w1', 'w2', 'w0')
    p.line([(11, 36), (36, 36)], 'w3')           # 뱃전 밝은 테
    for x in range(12, 36, 5):
        p.px(x, 39, 'w0')
        p.px(x + 1, 39, 'w0')
    p.line([(9, 38), (37, 38)], 'w0')             # 판자 이음
    p.px(7, 31, 'w3'); p.px(7, 32, 'w2')


def sailor(p, x, y, lean=0, arms='row', cap='g1'):
    """뱃사공: 발 y+10, 머리 위 y. lean>0 = 앞(왼쪽)으로 숙임."""
    lx = x - lean
    p.rect(lx - 2, y + 4, lx + 2, y + 10, 'g1')
    p.rect(lx - 2, y + 4, lx - 1, y + 9, 'g2')
    p.rect(lx - 2, y + 4, lx + 2, y + 4, 'g2')
    p.px(lx + 2, y + 10, 'w0')
    p.rect(lx - 2, y + 1, lx + 2, y + 3, 's')      # 얼굴
    p.px(lx - 2, y + 2, 'o')                        # 눈(왼쪽을 본다)
    p.rect(lx - 2, y - 1, lx + 2, y, 'g1')          # 두건
    p.line([(lx + 2, y - 1), (lx + 4, y + 1)], 'g1')
    p.px(lx - 1, y - 1, 'g2')
    return lx


def oar(p, ox, oy, tipx, tipy):
    p.line([(ox, oy), (tipx, tipy)], 'w3')
    p.line([(ox + 1, oy), (tipx + 1, tipy)], 'w2')
    p.rect(tipx - 1, tipy - 1, tipx + 1, tipy + 1, 'w2')


def harpoon(p, x0, y0, tipx, tipy, rope=False):
    p.line([(x0, y0), (tipx, tipy)], 'w2')
    p.poly([(tipx - 3, tipy - 1), (tipx + 1, tipy - 2), (tipx + 1, tipy + 1)], 'j')
    p.px(tipx - 3, tipy - 1, 'i'); p.px(tipx, tipy, 'i')
    if rope:
        p.line([(x0, y0), (x0 + 4, y0 + 4), (x0 + 9, y0 + 3)], 'w3')


def flag(p, x, y, ph, streaming=False):
    p.line([(x, y), (x, y - 11)], 'w0')
    p.px(x, y - 12, 'w3')
    L = 6 if not streaming else 7
    pts = []
    for i in range(L):
        wob = (0, 1, 1, 0, -1, -1)[(i + ph) % 6] if not streaming else (0, 0, 1, 0)[(i + ph) % 4]
        pts.append((x + 1 + i, y - 11 + wob))
    for (fx, fy) in pts:
        p.line([(fx, fy), (fx, fy + 3 - (1 if fx > x + L - 3 else 0))], 'g1')
    for (fx, fy) in pts[:-3]:
        p.px(fx, fy, 'g2')


def boat(pose):
    p = Pen(CELL, PAL)
    if pose['dead']:
        return p
    hull(p)
    lean = pose.get('lean', 0)
    hx = harpoon_tip = pose.get('tip', 3)
    harpoon(p, 14, 32, hx, pose.get('tipy', 27), pose.get('rope', False))
    p.rect(12, 32, 15, 34, 'w0'); p.rect(12, 32, 15, 32, 'w2')       # 작살포 받침
    sx = sailor(p, 24, 24 + pose.get('sy', 0), lean)
    oar(p, 20, 34, *pose.get('oar', (26, 42)))
    flag(p, 38, 32, pose.get('ph', 0), pose.get('stream', False))
    return p


WX0, WX1 = 3, 44


def water(p, ph, gap=(9, 37), y=41):
    waves(p, y, WX0, WX1, ph, gap=gap, depth=4)


BRIGHT = dict(w0='w2', w1='w3', w2='w3', g1='g2', g2='f', s='f', h='w2', i='j', b1='b2')


def draw(n):
    p = Pen(CELL, PAL)
    if n.startswith('idle'):
        ph = {'idle_a': 0, 'idle_b': 2, 'idle_c': 4}[n]
        bob = {'idle_a': 0, 'idle_b': -1, 'idle_c': 0}[n]
        oarp = {'idle_a': (25, 43), 'idle_b': (28, 39), 'idle_c': (27, 42)}[n]
        b = boat(dict(ph=ph, oar=oarp, dead=False, tip=3, tipy=27))
        pitch(b, {'idle_a': 0, 'idle_b': -0.03, 'idle_c': 0.03}[n], cx=24)
        p.paste(b, 0, bob)
        water(p, ph)
        for x in (9, 20, 33):
            p.px(x + ph % 3, 41, 'f')
    elif n == 'windup':
        b = boat(dict(ph=1, oar=(30, 38), tip=8, tipy=29, lean=-2, dead=False))
        pitch(b, -0.07, cx=24)
        p.paste(b, 2, -1)
        water(p, 1, gap=(12, 39))
        for x, y in ((41, 39), (43, 37), (44, 40)):
            p.px(x, y, 'f')
    elif n == 'move':
        b = boat(dict(ph=0, oar=(31, 37), tip=2, tipy=26, lean=2, stream=True, dead=False))
        pitch(b, -0.05, cx=24)
        p.paste(b, -1, -1)
        water(p, 0, gap=(14, 36))
        for x, y in ((38, 40), (41, 38), (43, 41), (44, 37), (40, 42), (36, 42)):
            p.px(x, y, 'f')
        p.line([(37, 41), (44, 41)], 'f')
    elif n == 'attack':
        b = boat(dict(ph=3, oar=(30, 41), tip=2, tipy=30, lean=4, rope=True, stream=True, dead=False))
        pitch(b, 0.06, cx=24)
        p.paste(b, -2, 1)
        water(p, 2, gap=(10, 38), y=42)
        for x, y in ((3, 39), (5, 37), (2, 41), (7, 40), (1, 37)):
            p.px(x, y, 'f')
        p.line([(2, 36), (1, 34)], 'f'); p.line([(6, 38), (5, 35)], 'f')
        spark(p, 1, 27, 1, 'f')
    elif n == 'recover':
        b = boat(dict(ph=2, oar=(26, 41), tip=5, tipy=28, lean=-1, dead=False))
        pitch(b, 0.02, cx=24)
        p.paste(b, 1, 0)
        water(p, 2, gap=(10, 38))
        p.line([(3, 42), (8, 42)], 'f'); p.line([(38, 42), (43, 42)], 'f')
    elif n == 'hit':
        b = boat(dict(ph=5, oar=(29, 38), tip=6, tipy=29, lean=-3, sy=1, dead=False))
        b.recolor(BRIGHT)
        pitch(b, -0.10, cx=24)
        p.paste(b, 3, -1)
        water(p, 3, gap=(12, 40))
        for x, y in ((6, 33), (4, 36), (43, 34), (42, 31), (44, 36)):
            p.px(x, y, 'f')
        spark(p, 7, 30, 2, 'f', 'j')
    elif n == 'dead':
        pts = [(9, 34), (13, 31), (35, 31), (40, 33), (38, 38), (32, 39), (14, 39), (9, 37)]
        p.solid(pts, 'w0', 'w1', 'o')
        p.line([(12, 33), (37, 33)], 'w1'); p.line([(13, 35), (36, 35)], 'w0')
        p.line([(10, 36), (38, 36)], 'w1')
        p.px(10, 33, 'w3'); p.px(11, 32, 'w3')
        p.line([(3, 41), (13, 43)], 'w2'); p.rect(2, 40, 3, 42, 'w3')
        p.rect(40, 34, 44, 35, 'g1'); p.px(41, 34, 'g2')
        waves(p, 38, WX0, WX1, 0, depth=6, taper=(0, 1, 3, 5, 7, 9))
        for x, y in ((14, 36), (20, 37), (29, 36)):
            p.px(x, y, 'f')
        for x, y in ((43, 31), (44, 27), (42, 24)):
            p.disc(x, y, 1, 'f')
    return settle(p, G)


if __name__ == '__main__':
    run(globals())
