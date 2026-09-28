"""monster2-0 하피(초록 깃 하피) 전투 도트 — 왼쪽(적 쪽)을 본다. 파티 motion: swoop.

걷기 칩 Monster2 (0,0)의 색·디자인(초록 잎사귀 머리, 붉은 상의·갈색 하의, 흰 날개, 흰 발톱)을
전투용 48px 로 다시 찍었다. 날개짓으로 떠 있다가(대기 a·b·c = 올림·중간·내림) 급강하해 발톱으로 긁는다.
오른쪽 보기로 그린 뒤 pp_lib 가 칸마다 좌우 반전한다.
"""
import math
from pp_lib import Pen, build, cap, put, clean

CELL = 48
PAL = dict(o='16261a', s='2a5a34', b='4a9040', l='7cc25c', h='b4e48c', k='f4cea6', t='c8906c',
           f='4a2c22', r='d23a34', y='f0d060', c='f4f4ec', W='d4dad8', g='96a0a6', x='646e78', e='e83c34')

HEAD = [
    "...ooooo...",
    "..osbllbo..",
    ".osbbhlbbo.",
    "osbbllbbbbo",
    "obbbbbbkkko",
    "oslbbbkkyko",
    "osbbbbkkkko",
    "obsbbbktkeo",
    "osbsbbkkkko",
    ".o.osbkkko.",
    ".....oooo..",
]
HEAD_ATK = list(HEAD); HEAD_ATK[7] = "obsbbbkooeo"; HEAD_ATK[8] = "osbsbbkeeko"
HEAD_HIT = list(HEAD); HEAD_HIT[5] = "oslbbbkkoko"; HEAD_HIT[7] = "obsbbbkoo.o"


def D(a, L): return (math.cos(math.radians(a)) * L, math.sin(math.radians(a)) * L)


def wing(p, sh, arm, hand, fd, far=False, arm_len=8, hand_len=9):
    """Serrated wing polygon: shoulder -> wrist -> tip leading edge, five primaries trailing along fd."""
    sx, sy = sh
    wx, wy = sx + D(arm, arm_len)[0], sy + D(arm, arm_len)[1]
    tx, ty = wx + D(hand, hand_len)[0], wy + D(hand, hand_len)[1]
    bases = []
    for i in range(6):
        u = i / 5
        if u < 0.5: bx, by = tx + (wx - tx) * u * 2, ty + (wy - ty) * u * 2
        else: bx, by = wx + (sx - wx) * (u - 0.5) * 2, wy + (sy - wy) * (u - 0.5) * 2
        bases.append((bx, by, 11 - i * 1.4))
    pts = [(sx, sy), (wx, wy), (tx, ty)]
    for i, (bx, by, L) in enumerate(bases):
        ex, ey = bx + D(fd, L)[0], by + D(fd, L)[1]
        pts.append((ex, ey))
        if i < 5:
            nx, ny = bases[i + 1][0], bases[i + 1][1]
            m = ((bx + nx) / 2 + D(fd, L * 0.45)[0], (by + ny) / 2 + D(fd, L * 0.45)[1])
            pts.append(m)
    pts = [(round(x), round(y)) for x, y in pts]
    base, dark = ('g', 'x') if far else ('W', 'g')
    p.poly(pts, base, 'o')
    for bx, by, L in bases[1:5]:
        ex, ey = bx + D(fd, L - 1)[0], by + D(fd, L - 1)[1]
        p.line([(round(bx + D(fd, 2)[0]), round(by + D(fd, 2)[1])), (round(ex), round(ey))], dark)
    if not far:
        p.line([(round(sx), round(sy)), (round(wx), round(wy)), (round(tx), round(ty))], 'c')


def leg(p, hip, dx, dy, grab, near=True):
    hx, hy = hip
    knee = (hx + 2 + dx * 0.5, hy + 3)
    foot = (hx + dx, hy + dy)
    cap(p, [hip, knee], 3, 'f', lit=None)
    cap(p, [knee, foot], 1, 'c' if near else 'g', edge='o')
    fx, fy = round(foot[0]), round(foot[1])
    if grab:
        p.line([(fx, fy), (fx + 3, fy - 2)], 'c'); p.line([(fx, fy), (fx + 3, fy + 1)], 'c')
        p.im.putpixel((fx + 4, fy - 2), p.pal['c']); p.im.putpixel((fx + 4, fy + 1), p.pal['c'])
    else:
        p.grid(fx - 2, fy + 1, ["cccc", "c.c."])


P = {
 'idle_a': dict(n=(27,18), wn=(-140, -105, 170), wf=(-125, -95, 175), lg=(2, 7, 0), hair=(0, 4)),
 'idle_b': dict(n=(27,19), wn=(-175, -170, 115), wf=(-165, -160, 110), lg=(2, 7, 0), hair=(0, 5)),
 'idle_c': dict(n=(27,20), wn=(155, 120, 185), wf=(160, 125, 180), lg=(1, 7, 0), hair=(0, 3)),
 'windup': dict(n=(25,18), wn=(-115, -80, 190), wf=(-105, -75, 190), lg=(4, 5, 0), hair=(-1, 6)),
 'move':   dict(n=(29,20), wn=(-165, -150, 150), wf=(-160, -145, 150), lg=(6, 6, 1), hair=(-3, 1)),
 'attack': dict(n=(28,22), wn=(-135, -100, 160), wf=(-120, -90, 165), lg=(11, 5, 1), hair=(-4, 2)),
 'recover':dict(n=(27,16), wn=(170, 140, 110), wf=(175, 145, 105), lg=(1, 7, 0), hair=(0, 4)),
 'hit':    dict(n=(24,19), wn=(-120, -150, 120), wf=(-110, -140, 115), lg=(-3, 7, 0), hair=(2, 5)),
}


def hair(p, head, flow):
    hx, hy = head; fx, fy = flow
    cap(p, [(hx + 1, hy + 3), (hx - 2 + fx, hy + 5 + fy // 2), (hx - 3 + fx, hy + 8 + fy)], 3, 'b', edge='o', lit='l')
    cap(p, [(hx + 2, hy + 1), (hx - 2 + fx, hy + 2 + fy // 3)], 1, 'h', edge='o')


def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        wing(p, (22, 39), 180, 185, 250, arm_len=8, hand_len=7)
        p.poly([(21, 38), (29, 38), (30, 44), (20, 44)], 'k', 'o'); p.line([(22, 39), (28, 39)], 'r')
        p.poly([(20, 41), (28, 41), (28, 44), (20, 44)], 'f', 'o')
        put(p, 29, 34, ["...ooooo...", "..osbllbo..", ".osbbhlbbo.", "osbbkkkkbbo", "obbkkkokkko", "osbkkkkeokk"[:11], ".osbsbkkoo.", "..ooooooo.."])
        cap(p, [(27, 43), (31, 43)], 1, 'c', edge='o')
        return p
    q = P[n]; nx, ny = q['n'][0] + 2, q['n'][1] + 2
    head = (nx - 5, ny - 10)
    wing(p, (nx - 2, ny + 1), *q['wf'], far=True)
    hair(p, head, q['hair'])
    hip = (nx - 1, ny + 9)
    dx, dy, grab = q['lg']
    leg(p, (hip[0] - 1, hip[1]), dx - 2, dy, grab, near=False)
    # feather-tail tufts
    for a, col in ((165, 'g'), (150, 'W')):
        cap(p, [(hip[0] - 2, hip[1] - 1), (hip[0] - 2 + D(a, 6)[0], hip[1] + D(a, 6)[1])], 2, col, edge='o')
    # chest (bare, red wrap) and brown shorts
    p.poly([(nx - 3, ny), (nx + 3, ny), (nx + 3, ny + 4), (nx - 3, ny + 4)], 'k', 'o')
    p.line([(nx - 2, ny + 1), (nx + 2, ny + 1)], 't'); p.line([(nx - 2, ny + 3), (nx + 2, ny + 3)], 'r')
    p.poly([(nx - 4, ny + 4), (nx + 4, ny + 4), (hip[0] + 3, hip[1] + 1), (hip[0] - 3, hip[1] + 1)], 'r', 'o')
    p.line([(nx - 3, ny + 5), (nx + 3, ny + 5)], 'e')
    p.poly([(hip[0] - 3, hip[1] - 2), (hip[0] + 3, hip[1] - 2), (hip[0] + 3, hip[1] + 2), (hip[0] - 3, hip[1] + 2)], 'f', 'o')
    leg(p, (hip[0] + 1, hip[1]), dx, dy, grab)
    put(p, *head, HEAD_ATK if n in ('attack', 'move') else HEAD_HIT if n == 'hit' else HEAD)
    wing(p, (nx, ny + 1), *q['wn'])
    return clean(p)


if __name__ == '__main__':
    build('monster2-0', CELL, PAL, draw, flying=True)
