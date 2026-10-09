"""vehicles-5 전차(tank) — 파티 전투 시트 64px, 왼쪽을 본다, motion shoot(제자리 포격, 포신 반동).
걷기 칩(초록 위장 차체·주황 바퀴와 포신 띠)을 전투용으로 키운 것: 궤도와 주황 전륜, 경사 장갑, 회전 포탑, 긴 주포.
"""
import math
from pv_lib import *

CHIP, CELL = 'vehicles-5', 64
PAL = dict(o='1a2418', g0='233a26', g1='3f6a3c', g2='6aa055', g3='a8d580', k='2c2c38', k2='565668',
           a='d0642a', a2='f6a04c', s1='7a869c', s2='c4cee0', fo='ee6a2c', fy='ffe680', f='fbfdff', d0='6a5238', d1='b08c5a')
G = CELL - 4


def treads(p, ph, y=0):
    p.solid([(6, 52 + y), (9, 49 + y), (55, 49 + y), (58, 52 + y), (58, 57 + y), (55, 60 + y), (9, 60 + y), (6, 57 + y)], 'k', 'k2', 'o')
    for x in range(8, 56, 4):
        xx = x + ph % 4
        p.px(xx, 50 + y, 'k2'); p.px(xx, 59 + y, 'k2')
    for x in (13, 22, 31, 40, 49):
        p.disc(x, 55 + y, 3, 'o'); p.disc(x, 55 + y, 2, 'a'); p.px(x - 1, 54 + y, 'a2'); p.px(x, 55 + y, 'k')
    p.disc(53, 54 + y, 4, 'o'); p.disc(53, 54 + y, 3, 'a'); p.px(52, 53 + y, 'a2'); p.px(53, 54 + y, 'k')


def hull(p, bob=0):
    p.solid([(8, 48), (16, 40), (50, 40), (57, 46), (56, 50), (9, 50)], 'g1', 'g2', 'g0')
    for (x, y) in ((22, 44), (23, 44), (24, 45), (33, 46), (34, 46), (44, 43), (45, 43), (46, 44), (18, 47), (19, 47)):
        p.px(x, y, 'g2')
    for (x, y) in ((28, 42), (29, 42), (38, 45), (39, 45), (40, 45), (14, 46), (50, 47), (51, 47)):
        p.px(x, y, 'g0')
    for x in range(17, 51, 5):
        p.px(x, 41, 'g3')
    p.rect(10, 47, 12, 48, 'fy'); p.px(10, 47, 'f')      # 전조등
    p.line([(50, 41), (56, 47)], 'g0')
    p.rect(54, 44, 57, 46, 'k2'); p.rect(58, 43, 60, 45, 'k')   # 배기 파이프


def turret(p, elev=0, rec=0, dead=False, dx=0, dy=0):
    tx, ty = dx, dy
    p.solid([(22 + tx, 29 + ty), (29 + tx, 25 + ty), (44 + tx, 25 + ty), (48 + tx, 30 + ty), (48 + tx, 40 + ty), (21 + tx, 40 + ty)], 'g1', 'g2', 'g0')
    for x, y in ((27, 33), (28, 33), (37, 30), (38, 31), (42, 35)):
        p.px(x + tx, y + ty, 'g0')
    for x, y in ((31, 28), (32, 28), (40, 28)):
        p.px(x + tx, y + ty, 'g3')
    p.rect(35 + tx, 22 + ty, 43 + tx, 25 + ty, 'o'); p.rect(36 + tx, 23 + ty, 42 + tx, 25 + ty, 's1'); p.line([(36 + tx, 23 + ty), (42 + tx, 23 + ty)], 's2')  # 해치
    p.rect(22 + tx, 30 + ty, 25 + tx, 38 + ty, 'g0'); p.line([(22 + tx, 30 + ty), (22 + tx, 38 + ty)], 'g1')  # 포방패
    p.line([(46 + tx, 24 + ty), (49 + tx, 9 + ty)], 'k2')
    p.px(49 + tx, 8 + ty, 'a2')
    # 주포
    L = 19
    px0, py0 = 22 + tx + rec, 34 + ty
    ang = math.radians(elev)
    ex, ey = px0 - math.cos(ang) * L, py0 - math.sin(ang) * L
    steps = int(L * 1.6)
    for s in range(steps + 1):
        t = s / steps
        x = px0 - math.cos(ang) * L * t
        y = py0 - math.sin(ang) * L * t
        p.rect(x, y - 1, x, y + 1, 'g1' if not dead else 'g0')
        p.px(x, y - 1, 'g2' if not dead else 'g1')
        p.px(x, y + 1, 'g0')
    for t in (0.35, 0.62):
        x = px0 - math.cos(ang) * L * t; y = py0 - math.sin(ang) * L * t
        p.rect(x - 1, y - 2, x, y + 2, 'a'); p.px(x - 1, y - 2, 'a2')
    p.rect(ex - 2, ey - 2, ex + 1, ey + 2, 's1'); p.line([(ex - 2, ey - 2), (ex + 1, ey - 2)], 's2')
    return (ex, ey)


def tank(pose):
    p = Pen(CELL, PAL)
    treads(p, pose.get('tp', 0))
    hull(p)
    tip = turret(p, pose.get('elev', 0), pose.get('rec', 0))
    p.tip = tip
    return p


def dust(p, pts, keys=('d0', 'd1')):
    for i, (x, y, r) in enumerate(pts):
        puff(p, x, y, r, list(keys), seed=i + x)


def draw(n):
    p = Pen(CELL, PAL)
    if n.startswith('idle'):
        i = ['idle_a', 'idle_b', 'idle_c'].index(n)
        t = tank(dict(tp=i))
        p.paste(t, 0, 0)
        # 차체만 위아래로 흔들리는 대신 엔진 진동: 포탑/차체 한 칸 아래위
        if i == 1:
            pass
        puff(p, 59, 40 - i * 3, 1 + (i > 0), ['k2', 's1', 's2'], seed=i)
        if i:
            puff(p, 60, 35 - i * 2, 1 + i // 2, ['k2', 's1', 's2'], seed=i + 4)
    elif n == 'windup':
        t = tank(dict(tp=1, elev=9, rec=1))
        pitch(t, -0.02, cx=32)
        p.paste(t, 1, 0)
        puff(p, 59, 38, 2, ['k2', 's1', 's2'], seed=1); puff(p, 60, 32, 2, ['k2', 's1', 's2'], seed=2)
        for x, y in ((58, 60), (50, 60)):
            p.px(x, y, 'd1')
    elif n == 'move':
        t = tank(dict(tp=2, elev=0))
        pitch(t, 0.02, cx=32)
        p.paste(t, -1, 0)
        dust(p, ((57, 57, 3), (59, 53, 2), (53, 59, 2), (58, 48, 2)))
        p.line([(2, 62), (8, 62)], 'd0') if False else None
    elif n == 'attack':
        t = tank(dict(tp=3, elev=0, rec=5))
        p.paste(t, 1, 0)
        ex, ey = t.tip
        burst(p, ex + 2, ey + 3 + 1, 6, ['fo', 'fy', 'f'])
        puff(p, 5, 26, 3, ['k2', 's1', 's2'], seed=3); puff(p, 11, 22, 3, ['k2', 's1', 's2'], seed=4)
        dust(p, ((8, 58, 3), (58, 58, 3), (3, 55, 2)))
    elif n == 'recover':
        t = tank(dict(tp=0, elev=0, rec=3))
        p.paste(t, 1, 0)
        puff(p, 6, 30, 3, ['s1', 's2', 'f'], seed=5); puff(p, 12, 25, 2, ['s1', 's2', 'f'], seed=6); puff(p, 16, 20, 2, ['s1', 's2', 'f'], seed=7)
        dust(p, ((59, 58, 2),))
    elif n == 'hit':
        t = tank(dict(tp=1, elev=-4, rec=2))
        t.recolor(dict(g0='g1', g1='g2', g2='g3', g3='f', k='k2', a='a2', s1='s2', d0='d1', k2='s1'))
        pitch(t, 0.05, cx=32)
        p.paste(t, 3, -1)
        spark(p, 30, 34, 4, 'f', 'fy'); spark(p, 12, 36, 2, 'f', 'fy'); spark(p, 46, 46, 2, 'f', 'fy')
        for x, y in ((4, 26), (58, 24), (60, 30)):
            p.px(x, y, 'f')
    elif n == 'dead':
        t = Pen(CELL, PAL)
        treads(t, 0)
        hull(t)
        t.recolor(dict(g1='g0', g2='g1', g3='g2', a='k2', a2='s1', fy='k', k2='k'))
        p.paste(t, 0, 0)
        # 날아간 포탑: 차체 옆에 기울어 놓인다
        tt = Pen(CELL, PAL)
        turret(tt, elev=-25, rec=0, dead=True, dx=-8, dy=6)
        tt.recolor(dict(g1='g0', g2='g1', g3='g2', a='k2', a2='s1'))
        pitch(tt, -0.18, cx=32)
        p.paste(tt, 6, -3)
        burst(p, 46, 38, 5, ['fo', 'fy'])
        burst(p, 22, 39, 4, ['fo', 'fy'])
        puff(p, 50, 30, 3, ['k', 'k2', 's1'], seed=1); puff(p, 53, 23, 3, ['k', 'k2', 's1'], seed=2); puff(p, 55, 15, 2, ['k', 'k2', 's1'], seed=3)
        puff(p, 22, 32, 2, ['k', 'k2', 's1'], seed=4); puff(p, 24, 26, 2, ['k', 'k2', 's1'], seed=5)
    return settle(p, G)


if __name__ == '__main__':
    run(globals())
