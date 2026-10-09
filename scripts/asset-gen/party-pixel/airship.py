"""vehicles-6 비공정(airship) — 파티 전투 시트 64px, 왼쪽을 본다, motion swoop(날개를 젖혔다 급강하 기총·폭격).
걷기 칩(주황 비늘 몸통에 청록 지느러미를 단 용 모양 비행선)을 전투용으로 키운 것: 용머리 이물, 돛 날개, 배 밑 기총과 폭탄창.
"""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'pixel-enemy'))
from pv_lib import *
from beast_lib import tube, bez  # 타원 튜브(윤곽·명암) 재사용 — 그림 원본은 읽지 않는다

CHIP, CELL = 'vehicles-6', 64
PAL = dict(o='2a1424', a0='7a2a1c', a='d0602c', a2='f6a44e', c0='1c5a68', c='2e9aa8', c2='86dcdc', y='f4e0a0',
           k='2c2432', i='8a96ac', fo='ee6a2c', fy='ffe680', f='fbfdff', sh='1c2234')
G = CELL - 4


def dragon(p, pose):
    hd = pose.get('head', 0)          # 머리 숙임(+아래)
    tw = pose.get('tail', 0)
    # 꼬리
    tube(p, bez([(57, 19 + tw, 1.4), (52, 28 + tw // 2, 3), (44, 34, 5.4)]), 'a', 'o', 'a0', 'a2')
    # 뒷지느러미(꼬리 끝)
    p.poly([(56, 14 + tw), (61, 16 + tw), (58, 21 + tw)], 'c'); p.line([(56, 14 + tw), (60, 16 + tw)], 'c2')
    # 몸통
    tube(p, bez([(44, 34, 5.4), (34, 37, 8), (24, 36, 8), (17, 32, 6.5)]), 'a', 'o', 'a0', 'a2')
    # 목·머리
    tube(p, bez([(17, 32, 6.5), (13, 27 + hd // 2, 5), (10, 23 + hd, 4.6)]), 'a', 'o', 'a0', 'a2')
    hx, hy = 8, 22 + hd
    p.oval(hx, hy, 6, 4, 'o'); p.oval(hx, hy, 5, 3, 'a'); p.oval(hx - 1, hy - 1, 4, 2, 'a2')
    # 주둥이·턱
    p.poly([(hx - 3, hy + 1), (hx - 7, hy + 2), (hx - 6, hy + 4 + pose.get('jaw', 0)), (hx + 2, hy + 4 + pose.get('jaw', 0))], 'a0')
    p.line([(hx - 6, hy + 1), (hx - 7, hy + 3)], 'y')
    p.px(hx - 4, hy + 2, 'y'); p.px(hx - 2, hy + 2, 'y')
    p.rect(hx - 6, hy - 2, hx - 4, hy, 'a'); p.px(hx - 6, hy - 2, 'a2')
    p.px(hx - 2, hy - 1, 'f'); p.px(hx - 2, hy, 'o')            # 눈
    # 뿔
    p.line([(hx + 3, hy - 3), (hx + 7, hy - 8 + hd // 3)], 'c0', 2); p.line([(hx + 3, hy - 3), (hx + 7, hy - 8 + hd // 3)], 'c')
    p.px(hx + 7, hy - 9 + hd // 3, 'c2')
    # 등지느러미
    for k, (x, y) in enumerate(((21, 27), (27, 28), (33, 29), (39, 29), (45, 28), (50, 26))):
        yy = y + (0 if x > 30 else hd // 4)
        p.poly([(x - 2, yy + 1), (x + 1, yy - 5), (x + 3, yy + 1)], 'c'); p.line([(x, yy), (x + 1, yy - 4)], 'c2')
    # 배 비늘띠
    for x in range(22, 44, 3):
        p.px(x, 42 if 26 < x < 40 else 41, 'y'); p.px(x + 1, 42 if 26 < x < 40 else 41, 'y')
    # 박쥐 날개(등 위 청록 막): 앞살 끝 tip, 뒷가장자리는 세 번 파인 물결
    tx, ty = pose.get('tip', (38, 8))
    P = [(30, 30), (tx, ty), (tx + 11, ty + 6), (tx + 7, ty + 9), (tx + 10, ty + 14), (tx + 5, ty + 16), (46, 31)]
    p.solid(P, 'c', 'c2', 'c0')
    for q in (P[2], P[4], P[5]):
        p.line([(tx, ty), q], 'c0')
    p.line([(30, 30), (tx, ty)], 'c2', 1)
    p.line([(tx - 1, ty), (tx + 2, ty - 3)], 'a2')
    p.px(tx + 2, ty - 3, 'y')
    # 배 밑 기총·폭탄창
    p.rect(30, 44, 41, 46, 'k'); p.rect(31, 44, 40, 44, 'i')
    p.line([(30, 45), (30 - pose.get('gun', 0), 45)], 'i')
    p.rect(16, 42, 22, 43, 'i'); p.rect(14, 42, 15, 43, 'k') if False else None
    p.line([(14, 43), (22, 43)], 'i'); p.line([(14, 42), (22, 42)], 'k')
    return p


def wings_prop(p, ph):
    # 꼬리 끝 작은 프로펠러(옆에서 본 회전날개)
    p.rect(58, 23, 59, 24, 'k')
    if ph % 2:
        p.line([(59, 20), (59, 27)], 'i')
    else:
        p.line([(57, 21), (60, 26)], 'i')


def shadow(p, w):
    for x in range(32 - w, 32 + w + 1):
        if x % 2 == 0:
            p.px(x, G, 'sh')
    for x in range(32 - w + 3, 32 + w - 2):
        if x % 2 == 1:
            p.px(x, G - 1, 'sh')


def draw(n):
    p = Pen(CELL, PAL)
    if n.startswith('idle'):
        i = ['idle_a', 'idle_b', 'idle_c'].index(n)
        d = Pen(CELL, PAL)
        dragon(d, dict(tip=((38, 8), (40, 16), (39, 12))[i], head=(0, 1, 0)[i], tail=(0, -2, 1)[i], jaw=(0, 0, 1)[i]))
        wings_prop(d, i)
        p.paste(d, 0, (0, -1, 1)[i] + 4)
        shadow(p, (13, 12, 14)[i])
    elif n == 'windup':
        d = Pen(CELL, PAL)
        dragon(d, dict(tip=(34, 3), head=-3, tail=-3, jaw=2))
        wings_prop(d, 1)
        pitch(d, -0.13, cx=32)
        p.paste(d, 2, 5)
        shadow(p, 11)
        p.px(3, 26, 'fy'); p.px(5, 22, 'fy')
    elif n == 'move':
        d = Pen(CELL, PAL)
        dragon(d, dict(tip=(48, 22), head=4, tail=3, jaw=0))
        wings_prop(d, 0)
        pitch(d, 0.16, cx=32)
        p.paste(d, -1, 5)
        shadow(p, 13)
        for y in (12, 18, 24):
            p.line([(52, y), (61, y)], 'f') if False else None
        p.line([(50, 10), (58, 10)], 'f'); p.line([(54, 18), (61, 18)], 'f'); p.line([(52, 26), (60, 26)], 'f')
    elif n == 'attack':
        d = Pen(CELL, PAL)
        dragon(d, dict(tip=(44, 14), head=4, tail=2, jaw=3, gun=4))
        wings_prop(d, 1)
        pitch(d, 0.10, cx=32)
        p.paste(d, 0, 5)
        # 기총 예광탄과 주둥이 화염
        burst(p, 4, 35, 4, ['fo', 'fy', 'f'])
        for k, (x0, y0) in enumerate(((10, 40), (13, 43), (7, 44))):
            p.line([(x0, y0), (x0 - 4, y0 + 3)], 'fy')
        # 폭탄창에서 떨어지는 폭탄
        p.disc(35, 52, 2, 'o'); p.disc(35, 52, 1, 'i'); p.px(35, 49, 'fy'); p.px(35, 47, 'f')
        p.disc(41, 55, 2, 'o'); p.disc(41, 55, 1, 'i'); p.px(41, 52, 'fy')
        shadow(p, 12)
    elif n == 'recover':
        d = Pen(CELL, PAL)
        dragon(d, dict(tip=(37, 8), head=1, tail=-1, jaw=1))
        wings_prop(d, 0)
        pitch(d, -0.05, cx=32)
        p.paste(d, 1, 5)
        shadow(p, 12)
        puff(p, 8, 43, 2, ['k', 'i', 'f'], seed=2); puff(p, 12, 47, 2, ['k', 'i', 'f'], seed=3)
    elif n == 'hit':
        d = Pen(CELL, PAL)
        dragon(d, dict(tip=(42, 18), head=-2, tail=2, jaw=3))
        d.recolor(dict(a0='a', a='a2', a2='y', c0='c', c='c2', c2='f', o='a0', k='i'))
        pitch(d, -0.12, cx=32)
        p.paste(d, 3, 4)
        spark(p, 14, 26, 3, 'f', 'fy'); spark(p, 44, 32, 3, 'f', 'fy')
        for x, y in ((3, 18), (58, 12), (60, 40)):
            p.px(x, y, 'f')
        shadow(p, 10)
    elif n == 'dead':
        d = Pen(CELL, PAL)
        dragon(d, dict(tip=(44, 26), head=10, tail=6, jaw=0))
        pitch(d, 0.14, cx=32)
        p.paste(d, 0, 12)
        burst(p, 22, 44, 5, ['fo', 'fy']); burst(p, 44, 48, 3, ['fo', 'fy'])
        for (x, y, r) in ((36, 40, 3), (40, 32, 3), (44, 25, 2), (47, 19, 2)):
            puff(p, x, y, r, ['k', 'sh', 'i'], seed=x)
        p.ddots(6, 59, 58, 60, 'sh')
    return settle(p, G)


if __name__ == '__main__':
    run(globals())
