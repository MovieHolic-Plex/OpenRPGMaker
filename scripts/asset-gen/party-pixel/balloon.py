"""vehicles-3 열기구(balloon) — 파티 전투 시트 48px, 왼쪽을 본다, motion float(둥실 떠서 폭탄 투하).
걷기 칩(붉은·흰 세로줄 기구와 갈색 바구니)을 전투용으로 키운 것: 일곱 폭의 천, 바구니 옆에 폭탄, 버너 불꽃, 바닥에 뜬 높이를 알리는 그림자.
"""
import math
from pv_lib import *

CHIP, CELL = 'vehicles-3', 48
PAL = dict(o='2a1820', r0='7c1a24', r1='c42c34', r2='ee6650', c0='c9b896', c1='f6ecd2', w0='5c3a1a', w1='8c5a2a',
           w2='c08a48', y='e6b53a', fo='ee6a2c', fy='ffe680', f='eef8ff', sh='1c2234', i='434a60')
G = CELL - 4


def envelope(p, cx, cy, rx, ry, neck_y, squash=1.0, shade_bias=0):
    """물방울꼴 기구 천: 위쪽 반타원 + 아래로 좁아지는 목. 세로 일곱 폭을 붉은/흰 번갈아, 왼쪽 위 밝음."""
    def half(y):
        if y <= cy:
            t = (y - (cy - ry)) / ry
            t = max(0.0, min(1.0, t))
            return rx * math.sqrt(max(0.0, 1 - (1 - t) ** 2))
        t = (y - cy) / (neck_y - cy)
        return rx * (1 - t) * 0.86 + 3.4 * t if t <= 1 else 0
    pts = {}
    for y in range(int(cy - ry), int(neck_y) + 1):
        h = half(y + 0.5)
        if h <= 0.4:
            continue
        for x in range(int(cx - h - 1), int(cx + h + 2)):
            u = (x + 0.5 - cx) / h
            if -1 <= u <= 1:
                pts[(x, y)] = u
    for (x, y), u in pts.items():
        edge = any((x + dx, y + dy) not in pts for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if edge:
            p.px(x, y, 'o')
            continue
        gore = int((u + 1) / 2 * 7 - 0.0001)
        red = gore % 2 == 0
        if red:
            k = 'r2' if u < -0.45 + shade_bias * .1 else ('r0' if u > 0.5 else 'r1')
        else:
            k = 'c1' if u < 0.3 else 'c0'
        p.px(x, y, k)
    # 폭 이음선(그림자 톤)
    for g in range(1, 7):
        u = -1 + g * 2 / 7
        for y in range(int(cy - ry) + 2, int(neck_y)):
            h = half(y + 0.5)
            x = int(round(cx + u * h))
            if (x, y) in pts and (y % 3 != 0):
                p.px(x, y, 'r0' if g % 2 else 'c0')
    # 위쪽 하이라이트
    for x, y in ((int(cx - rx * .45), int(cy - ry * .72)), (int(cx - rx * .45) + 1, int(cy - ry * .72) + 1)):
        p.px(x, y, 'f')
    p.px(cx, int(cy - ry) + 1, 'y')


def basket(p, cx, y, tilt=0):
    p.solid([(cx - 6, y), (cx + 6, y), (cx + 5, y + 6), (cx - 5, y + 6)], 'w1', 'w2', 'w0')
    for yy in range(y + 1, y + 6):
        for x in range(cx - 5 + (yy % 2), cx + 5, 2):
            p.px(x, yy, 'w0' if yy % 2 else 'w2')
    p.line([(cx - 6, y), (cx + 6, y)], 'y')
    p.line([(cx - 6, y + 1), (cx + 6, y + 1)], 'w2')


def bomb(p, x, y, lit=True):
    p.disc(x, y, 3, 'o')
    p.disc(x, y, 2, 'i')
    p.px(x - 1, y - 1, 'f')
    p.line([(x + 2, y - 3), (x + 3, y - 5)], 'w2')
    if lit:
        p.px(x + 3, y - 6, 'fy'); p.px(x + 4, y - 6, 'fo'); p.px(x + 3, y - 7, 'fo')


def flame(p, x, y, h):
    for k in range(h):
        w = 2 if k < h - 2 else 1
        col = 'fy' if k < h // 2 else 'fo'
        p.rect(x - w + 1, y - k, x + w - 1, y - k, col)
    p.px(x, y - h, 'fo')


def craft(pose):
    p = Pen(CELL, PAL)
    cx, ry = 24, 16
    envelope(p, cx, 17, 15 + pose.get('sq', 0), ry, 33, shade_bias=pose.get('sb', 0))
    by = 38
    # 로프
    for (x0, y0, x1, y1) in ((13, 27, 19, by), (35, 27, 29, by), (20, 32, 21, by), (28, 32, 27, by)):
        p.line([(x0, y0), (x1 + pose.get('sw', 0), y1)], 'w2')
    p.rect(21, 33, 27, 34, 'y'); p.line([(21, 33), (27, 33)], 'w2')  # 목 고리
    flame(p, 24, 36, pose.get('fl', 3))
    basket(p, 24 + pose.get('sw', 0), by)
    if pose.get('bomb'):
        bomb(p, 17 + pose['bomb'][0], 42 + pose['bomb'][1], True)
    return p


def shadow(p, w):
    for x in range(24 - w, 24 + w + 1):
        if (x + 0) % 2 == 0:
            p.px(x, G, 'sh')
    for x in range(24 - w + 2, 24 + w - 1):
        if x % 2 == 1:
            p.px(x, G - 1, 'sh')


def draw(n):
    p = Pen(CELL, PAL)
    if n.startswith('idle'):
        i = ['idle_a', 'idle_b', 'idle_c'].index(n)
        c = craft(dict(fl=(3, 4, 2)[i], sq=(0, 1, 0)[i], sw=(0, 1, -1)[i], bomb=(0, 0)))
        pitch(c, (0, -0.015, 0.015)[i], cx=24)
        p.paste(c, 0, (0, -1, 0)[i] + 1)
        shadow(p, (11, 10, 11)[i])
    elif n == 'windup':
        c = craft(dict(fl=7, sq=-1, sw=2, bomb=(-1, -1)))
        pitch(c, -0.05, cx=24)
        p.paste(c, 1, -1)
        shadow(p, 9)
        for x, y in ((22, 30), (26, 31)):
            p.px(x, y, 'fy')
    elif n == 'move':
        c = craft(dict(fl=4, sq=-1, sw=-2, bomb=(1, 0)))
        pitch(c, 0.07, cx=24)
        p.paste(c, -1, 0)
        shadow(p, 12)
        p.line([(38, 14), (46, 14)], 'f'); p.line([(40, 22), (46, 22)], 'f'); p.line([(41, 30), (46, 30)], 'f')
    elif n == 'attack':
        c = craft(dict(fl=3, sq=1, sw=-1))
        pitch(c, 0.03, cx=24)
        p.paste(c, 0, -2)
        bomb(p, 17, 43, True)
        p.line([(17, 37), (17, 39)], 'f'); p.line([(15, 38), (15, 40)], 'f'); p.line([(19, 38), (19, 40)], 'f')
        shadow(p, 8)
        for x, y in ((15, 44), (19, 44)):
            p.px(x, y, 'f')
    elif n == 'recover':
        c = craft(dict(fl=2, sq=0, sw=1, bomb=(0, 1)))
        pitch(c, 0.02, cx=24)
        p.paste(c, 0, 1)
        shadow(p, 10)
    elif n == 'hit':
        c = craft(dict(fl=1, sq=-1, sw=3, bomb=(0, 0)))
        c.recolor(dict(r0='r1', r1='r2', r2='f', c0='c1', c1='f', w0='w1', w1='w2', w2='y', i='f'))
        pitch(c, -0.10, cx=24)
        p.paste(c, 2, 0)
        for x, y in ((6, 10), (4, 14), (43, 12), (44, 18)):
            p.px(x, y, 'f')
        spark(p, 10, 8, 2, 'f', 'fy')
        shadow(p, 9)
    elif n == 'dead':
        # 바람 빠진 기구 천이 바닥에 무너지고 바구니가 옆으로 쓰러진다
        p.solid([(6, 41), (9, 33), (17, 29), (26, 30), (35, 33), (41, 41)], 'r1', 'r2', 'r0')
        for x in range(10, 40, 6):
            p.line([(x, 34 + (x % 5)), (x + 2, 40)], 'c1', 1)
        for x in range(13, 38, 6):
            p.line([(x, 33), (x - 2, 39)], 'r0')
        p.solid([(22, 33), (30, 32), (33, 38), (24, 39)], 'c1', 'f', 'c0')
        p.solid([(34, 36), (44, 39), (43, 43), (33, 42)], 'w1', 'w2', 'w0')
        p.line([(35, 39), (42, 41)], 'w0')
        p.line([(30, 36), (34, 38)], 'w2')
        for x, y, r in ((12, 27, 2), (16, 22, 2), (14, 17, 1)):
            puff(p, x, y, r, ['sh', 'i', 'c0'], seed=x)
        p.rect(4, 42, 42, 43, 'r0')
    return settle(p, G)


if __name__ == '__main__':
    run(globals())
