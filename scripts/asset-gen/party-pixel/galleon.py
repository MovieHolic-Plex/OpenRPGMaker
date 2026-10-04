"""vehicles-1 범선(galleon) — 파티 전투 시트 64px, 왼쪽을 본다, motion shoot(제자리 함포).
걷기 칩(빨간 깃발 달린 갈색 범선)의 색·모양을 전투용으로 키운 것: 돛 셋, 뱃머리 포문, 뱃고물 선실, 금빛 테두리.
"""
import math
from pv_lib import *

CHIP, CELL = 'vehicles-1', 64
PAL = dict(o='2a1810', w0='5a3616', w1='8a5628', w2='b88240', y='e6b53a', fy='ffe680',
           c1='b9ae9c', c2='f2ecdf', r='b8282c', fo='ee6a2c', i='424c60', j='8c98ae',
           b1='2a5aa2', b2='52a4dc', f='eaf8ff')
G = CELL - 4
WL = 54  # 물마루 줄


def sail(p, pts, bulge, seam_y, band=None, shade_x=None):
    p.solid(pts, 'c2', 'f', 'c1', edge='o')
    if shade_x is not None:
        ys = [q[1] for q in pts]
        p.rect(shade_x, min(ys) + 2, max(q[0] for q in pts) - 1, max(ys) - 2, 'c1')
    for y in seam_y:
        xs = [q[0] for q in pts]
        p.line([(min(xs) + 1, y), (max(xs) - 1, y + (1 if bulge else 0))], 'c1')
    if band:
        (x0, x1, y0, y1) = band
        p.rect(x0, y0, x1, y1, 'r')
        p.line([(x0, y0), (x1, y0)], 'fo')


def ship(pose):
    p = Pen(CELL, PAL)
    bg = pose.get('bulge', 0)
    ph = pose.get('ph', 0)
    dead = pose.get('dead', False)
    # 돛대(뒤): 뒷돛대·앞돛대·주돛대
    def mast(x, top, bottom):
        p.rect(x - 1, top, x, bottom, 'w1'); p.line([(x + 1, top), (x + 1, bottom)], 'w0'); p.px(x - 1, top, 'w2')
    if not dead:
        mast(15, 16, 36); mast(31, 6, 38); mast(49, 14, 32)
        # 활대
        p.line([(9, 17), (22, 17)], 'w0'); p.line([(22, 30), (39, 30)], 'w0')
        # 앞돛(작음), 주돛(큼), 뒷돛(삼각)
        sail(p, [(10 - bg, 18), (21, 18), (22 + bg, 32), (9, 33)], bg, (24,), band=(11, 20, 25, 26), shade_x=19)
        sail(p, [(23 - bg, 8), (40, 8), (41 + bg, 29), (22, 30)], bg, (15, 22), band=(24, 39, 17, 19), shade_x=37)
        p.line([(22, 8), (40, 8)], 'w0')
        p.solid([(49, 15), (56 + bg, 30), (43, 30)], 'c2', 'f', 'c1', edge='o')
        p.line([(49, 18), (46, 29)], 'c1')
        # 삼각돛(뱃머리): 앞돛대 꼭대기 → 이물 기둥
        p.solid([(14, 17), (3, 33), (14, 33)], 'c2', 'f', 'c1', edge='o')
        p.line([(13, 22), (8, 31)], 'c1')
    else:
        mast(31, 24, 38)                       # 꺾인 주돛대 밑동
        p.line([(31, 24), (36, 21)], 'w0'); p.line([(31, 24), (36, 21)], 'w1')
        p.solid([(22, 25), (30, 26), (28, 34), (21, 33)], 'c1', 'c2', 'c1', edge='o')   # 찢어진 돛 조각
    # 깃발
    if not dead:
        for i in range(9):
            wob = (0, 1, 1, 0, -1, -1)[(i + ph) % 6]
            top, bot = 3 + wob, 6 + wob + (1 if i < 3 else 0)
            if i >= 6 and i % 2:
                bot -= 1
            p.line([(32 + i, top), (32 + i, bot)], 'r')
            if i < 6:
                p.px(32 + i, top, 'fo')
        p.px(31, 2, 'y')
    # 선체
    hull = [(6, 36), (9, 33), (17, 33), (19, 38), (40, 38), (41, 31), (57, 30), (58, 44), (54, 51), (46, 55), (20, 55), (12, 50), (8, 43)]
    p.solid(hull, 'w1', 'w2', 'w0')
    for y in (42, 46, 50):
        p.line([(10, y), (56, y)], 'w0')
    p.line([(18, 38), (40, 38)], 'y')            # 갑판 난간 금띠
    p.line([(9, 35), (17, 35)], 'y')
    p.line([(42, 32), (56, 31)], 'y')
    p.line([(9, 39), (57, 39)], 'w2')
    # 뱃고물 선실 창
    for x in (45, 51):
        p.rect(x, 34, x + 2, 36, 'o'); p.rect(x, 34, x + 1, 35, 'fy')
    p.rect(44, 41, 56, 41, 'y')
    # 뱃머리 기둥·이물
    p.line([(7, 37), (4, 33), (2, 31)], 'w0', 2)
    p.px(2, 31, 'y')
    # 포문
    open_ports = pose.get('ports', 0)
    for x in (15, 23, 31, 39, 48):
        if x == 15 and pose.get('bowgun'):
            pass
        p.rect(x, 43, x + 3, 45, 'o')
        if open_ports:
            p.rect(x, 43, x + 3, 44, 'i'); p.px(x + 1, 44, 'j')
            p.line([(x, 42), (x + 3, 42)], 'w0')
        else:
            p.line([(x, 43), (x + 3, 43)], 'w0'); p.rect(x, 44, x + 3, 45, 'w0'); p.line([(x, 44), (x + 3, 44)], 'w2')
    # 뱃머리 대포(윗갑판)
    bx = pose.get('bow', 0)
    if bx or open_ports:
        L = 2 + bx
        p.rect(9 - L, 36, 15, 38, 'i'); p.line([(9 - L, 36), (15, 36)], 'j'); p.rect(9 - L - 1, 35, 9 - L, 38, 'j')
    else:
        p.rect(10, 36, 15, 38, 'i'); p.line([(10, 36), (15, 36)], 'j'); p.rect(9, 35, 10, 38, 'j')
    return p


def draw(n):
    p = Pen(CELL, PAL)
    ph = 0
    if n.startswith('idle'):
        ph = {'idle_a': 0, 'idle_b': 2, 'idle_c': 4}[n]
        bob = {'idle_a': 0, 'idle_b': -1, 'idle_c': 0}[n]
        b = ship(dict(ph=ph, bulge={'idle_a': 0, 'idle_b': 1, 'idle_c': 2}[n]))
        pitch(b, {'idle_a': 0, 'idle_b': -0.02, 'idle_c': 0.02}[n], cx=32)
        p.paste(b, 0, bob)
        waves(p, WL, 3, 60, ph, depth=7, gap=(8, 56), taper=(0, 1, 3, 5, 7, 9, 12))
        for x in (14, 28, 44):
            p.px(x + ph % 3, WL, 'f')
    elif n == 'windup':
        b = ship(dict(ph=1, bulge=0, ports=1, bow=2))
        pitch(b, -0.04, cx=32)
        p.paste(b, 1, -1)
        waves(p, WL, 3, 60, 1, depth=7, gap=(8, 56), taper=(0, 1, 3, 5, 7, 9, 12))
    elif n == 'move':
        b = ship(dict(ph=0, bulge=3, ports=0))
        pitch(b, 0.03, cx=32)
        p.paste(b, -1, 0)
        waves(p, WL, 3, 60, 0, depth=7, gap=(8, 56), taper=(0, 1, 3, 5, 7, 9, 12))
        for x, y in ((59, 52), (58, 49), (60, 50), (57, 54)):
            p.px(x, y, 'f')
        p.line([(52, 54), (59, 54)], 'f')
    elif n == 'attack':
        b = ship(dict(ph=3, bulge=1, ports=1, bow=4))
        pitch(b, -0.03, cx=32)
        p.paste(b, 1, 0)
        # 포구 화염(뱃머리 포·측면 포문)
        burst(p, 5, 39, 6, ['fo', 'fy', 'f'])
        for x in (17, 25, 33, 41, 50):
            burst(p, x + 2, 44, 3, ['fo', 'fy'])
        # 연기
        for (x, y, r) in ((3, 33, 4), (9, 29, 3), (27, 50, 3), (40, 50, 4), (54, 50, 3)):
            puff(p, x, y, r, ['i', 'j', 'c1'], seed=x)
        waves(p, WL, 3, 60, 2, depth=7, gap=(10, 58), taper=(0, 1, 3, 5, 7, 9, 12))
        p.line([(55, 54), (60, 54)], 'f')
    elif n == 'recover':
        b = ship(dict(ph=2, bulge=0, ports=1, bow=1))
        pitch(b, 0.02, cx=32)
        p.paste(b, 1, 0)
        for (x, y, r) in ((6, 30, 3), (14, 24, 2), (34, 47, 2), (52, 48, 3)):
            puff(p, x, y, r, ['j', 'c1', 'c2'], seed=x + 1)
        waves(p, WL, 3, 60, 3, depth=7, gap=(8, 58), taper=(0, 1, 3, 5, 7, 9, 12))
    elif n == 'hit':
        b = ship(dict(ph=5, bulge=0, ports=0))
        b.recolor(dict(w0='w1', w1='w2', w2='y', i='j', c1='c2', b1='b2', r='fo'))
        pitch(b, -0.09, cx=32)
        p.paste(b, 3, -1)
        waves(p, WL, 3, 60, 1, depth=7, gap=(10, 58), taper=(0, 1, 3, 5, 7, 9, 12))
        for x, y in ((5, 30), (8, 27), (58, 26), (60, 33), (3, 41)):
            p.px(x, y, 'f')
        spark(p, 10, 34, 3, 'f', 'fy'); spark(p, 46, 38, 2, 'f', 'fy')
    elif n == 'dead':
        b = ship(dict(dead=True, ph=0, bulge=0, ports=0))
        pitch(b, -0.30, cx=32)
        p.paste(b, 0, 2)
        waves(p, 42, 3, 60, 0, depth=19, taper=(0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13))
        # 침몰 물거품과 파편
        for x, y in ((50, 46), (44, 44), (56, 44), (38, 48), (27, 52), (12, 56), (20, 47), (34, 45)):
            p.px(x, y, 'f'); p.px(x + 1, y, 'b2')
        p.line([(4, 40), (10, 42)], 'w1'); p.line([(4, 41), (10, 43)], 'w0')
        for x, y in ((30, 50), (35, 53), (47, 51)):
            p.px(x, y, 'b2')
    return settle(p, G)


if __name__ == '__main__':
    run(globals())
