"""animal-2 수탉 — 48 셀. 걷기 칩(분홍빛 몸·붉은 볏과 꼬리): 이족 새 리그(사족 리그를 쓰지 않는다). 왼쪽을 본다.
대기 = 모이 쪼기(a 머리 세움 → b 숙임 → c 땅 쪼기), windup = 몸을 젖혀 날개를 접고 노림, move = 날개를 펴고 도약,
attack = 부리 찍기 + 며느리발톱 걷어차기, recover = 털 고르기, hit = 깃털이 곤두서 젖혀짐, dead = 뒤집혀 다리를 뻗음."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp_lib import *  # noqa

CELL = 48
PAL = dict(o='4b120b', b='d2b0a4', l='fcd6d0', s='9f7d61', d='6e5040', r='c01e10', R='7a1a0e', y='eaa632', Y='a86a20', k='1a0c0c', w='ffffff')
G = CELL - 4
CX = 22

# 자세: 몸 (dx, dy, tilt) · 머리 (dx, dy) · 부리 열림 · 날개(0 접힘~1 펼침) · 꼬리 부채 · 다리 [(x, lift, kind)] near/far
P = {
    'idle_a':  dict(b=(0, 0, -30), h=(0, 1), beak=0, wing=0, tail=0, legs=[(-2, 0), (3, 0)]),
    'idle_b':  dict(b=(0, 1, -20), h=(2, 3), beak=0, wing=0, tail=1, legs=[(-2, 0), (3, 0)]),
    'idle_c':  dict(b=(1, 2, 6), h=(4, 9), beak=1, wing=0, tail=2, legs=[(-2, 0), (3, 0)]),
    'windup':  dict(b=(-3, 1, -44), h=(-2, 1), beak=0, wing=0.35, tail=3, legs=[(-4, 0), (2, 0)]),
    'move':    dict(b=(1, -6, -10), h=(3, 2), beak=1, wing=1.0, tail=2, legs=[(-8, 4), (6, 2)]),
    'attack':  dict(b=(1, -1, 12), h=(6, 7), beak=2, wing=0.8, tail=3, legs=[(8, 7), (-3, 0)]),
    'recover': dict(b=(-1, 0, -34), h=(0, 0), beak=0, wing=0.15, tail=1, legs=[(-3, 0), (2, 0)]),
    'hit':     dict(b=(-3, -1, -50), h=(-3, -2), beak=2, wing=0.9, tail=4, legs=[(-5, 1), (0, 2)], eye='c'),
}


def rr(v):
    return int(round(v))


def leg(p, hip, x, lift, far):
    fx, fy = hip[0] + x, G - lift - 1
    mid = (hip[0] + (fx - hip[0]) * 0.5 - 1.2, (hip[1] + fy) / 2 + 0.5)
    pts = [ipt(hip), ipt(mid), ipt((fx, fy))]
    p.line(pts, 'o', 3)
    p.line(pts, 'Y' if far else 'y', 1)
    for k, ang in enumerate((-32, 0, 26)):
        e = ax((fx, fy + 0.5), ang, 4.4 if k == 1 else 3.6)
        p.line([ipt((fx, fy + 0.5)), ipt(e)], 'o', 1)
    for k, ang in enumerate((-32, 0, 26)):
        e = ax((fx, fy + 0.5), ang, 3.4 if k == 1 else 2.6)
        p.line([ipt((fx, fy + 0.5)), ipt(e)], 'Y' if far else 'y')
    p.line([(rr(fx) - 2, rr(fy) + 1), (rr(fx) - 1, rr(fy))], 'o')


def draw_bird(n):
    pz = P[n]
    p = Pen(CELL, PAL)
    dx, dy, tilt = pz['b']
    bx, by = CX + dx, G - 13 + dy
    wing = pz['wing']
    # 꼬리 깃(뒤)
    t0 = ax((bx, by), tilt, -6.5, -1.5)
    spread = pz['tail']
    for i, base_ang in enumerate((-78, -58, -38, -18)):
        ang = 180 + 20 + base_ang * -0.0
        a = 200 + i * 14 + spread * 6 - tilt * 0.3
        tip = ax(t0, a, 9 + (i % 2) * 2, 0)
        mid = ax(t0, a + (12 if i % 2 else -10), 5, 0)
        pts = bez([(t0[0], t0[1], 2.0), (mid[0], mid[1], 2.4), (tip[0], tip[1], 0.8)], 14)
        tube(p, pts, 'r' if i % 2 == 0 else 'R', 'o', None)
    # 먼 다리 → 몸 → 가까운 다리
    hip_far = ax((bx, by), tilt, 1.5, 5.0)
    leg(p, (hip_far[0] + 1, hip_far[1]), pz['legs'][1][0], pz['legs'][1][1], True)
    blob(p, bx, by, 7.4, 5.8, tilt)
    # 배·가슴 밝게, 등 깃 결
    def det(t):
        c = ax((bx, by), tilt, 1, 3.2)
        blob(t, c[0], c[1], 6.0, 2.4, tilt, edge=None, fn=lambda u, v, r, L: 'l' if L > -.3 else 'b')
        for k in range(4):
            q = ax((bx, by), tilt, -4 + k * 2.2, -3.8)
            t.line([ipt(q), ipt(ax(q, tilt + 40, 3, 0))], 's')
    layer(p, det)
    # 날개
    wa = tilt + 16 - wing * 70
    wr = ax((bx, by), tilt, -1.2, 0.8)
    tip = ax(wr, wa + 160 * 0, -8 if wing < .5 else -4, 0)
    blob(p, wr[0], wr[1], 4.8, 3.0, wa + 8, keys={'l': 'l', 'b': 'b', 's': 's'})
    if wing > 0.4:
        for k in range(3):
            f0 = ax(wr, wa + 180 + k * 18 - 30, 0, 0)
            f1 = ax(f0, wa + 180 + k * 18 - 30, 8, 0)
            tube(p, bez([(f0[0], f0[1], 1.6), (f1[0], f1[1], 0.8)], 8), 's' if k % 2 else 'b', 'o', None)
    else:
        p.line([ipt(ax(wr, wa, -3, 0.6)), ipt(ax(wr, wa, 3, 1.2))], 's')
    hip_near = ax((bx, by), tilt, -1.0, 5.0)
    leg(p, (hip_near[0] - 1, hip_near[1]), pz['legs'][0][0], pz['legs'][0][1], False)
    # 목·머리
    nb = ax((bx, by), tilt, 4.6, -2.8)
    hx, hy = pz['h']
    hc = (nb[0] + 3.5 + hx, nb[1] - 6.5 + hy)
    tube(p, bez([(nb[0] - 1, nb[1] + 1, 3.6), ((nb[0] + hc[0]) / 2 + 1, (nb[1] + hc[1]) / 2 + 1, 3.0), (hc[0], hc[1], 2.5)], 12), 'b', 'o', 'l')
    blob(p, hc[0], hc[1], 3.6, 3.2, 0)
    # 볏
    for k, (ox, oy, rad) in enumerate(((-1.8, -3.6, 1.4), (0.2, -4.4, 1.6), (2.0, -3.6, 1.3))):
        p.d.ellipse((rr(hc[0] + ox - rad), rr(hc[1] + oy - rad), rr(hc[0] + ox + rad), rr(hc[1] + oy + rad)), fill=p.pal['r'], outline=p.pal['o'])
    p.d.ellipse((rr(hc[0] - 2.4), rr(hc[1] - 3.2), rr(hc[0] + 2.6), rr(hc[1] - 1.2)), fill=p.pal['r'])
    # 부리(앞=오른쪽)
    bk = pz['beak']
    bxp, byp = hc[0] + 3.2, hc[1] + 0.2
    if bk == 0:
        p.poly([(rr(bxp), rr(byp) - 1), (rr(bxp) + 4, rr(byp) + 1), (rr(bxp), rr(byp) + 2)], 'y', 'o')
    else:
        gap = 1 + bk
        p.poly([(rr(bxp), rr(byp) - 1), (rr(bxp) + 4, rr(byp) - 1 - (bk > 1)), (rr(bxp), rr(byp) + 0)], 'y', 'o')
        p.poly([(rr(bxp), rr(byp) + 1), (rr(bxp) + 3, rr(byp) + 1 + gap), (rr(bxp) - 1, rr(byp) + 2)], 'Y', 'o')
    # 턱볏
    p.d.ellipse((rr(bxp) - 3, rr(byp) + 2, rr(bxp) - 1, rr(byp) + 5), fill=p.pal['r'], outline=p.pal['o'])
    # 눈
    ex, ey = rr(hc[0] + 1.2), rr(hc[1] - 0.6)
    if pz.get('eye') == 'c':
        p.line([(ex - 1, ey), (ex + 1, ey + 1)], 'k')
    else:
        dot(p, ex, ey, 'k'); dot(p, ex - 1, ey - 1, 'w') if False else None
    return p


def draw_dead():
    p = Pen(CELL, PAL)
    # 뒤집혀 누운 몸: 다리 둘이 하늘로
    bx, by = 24, G - 6
    for k, (x0, x1, y1) in enumerate(((20, 16, G - 22), (26, 29, G - 21))):
        pts = bez([(x0, by - 2, 1.4), (x1, y1 + 5, 1.0), (x1 - 1 + k * 2, y1, 0.8)], 12)
        tube(p, pts, 'Y' if k == 0 else 'y', 'o', None)
        for ang in (-150, -110, -70):
            e = ax((x1 - 1 + k * 2, y1), ang, 3.4)
            p.line([ipt((x1 - 1 + k * 2, y1)), ipt(e)], 'y')
    blob(p, bx, by, 10.5, 5.2, 0)
    def det(t):
        blob(t, bx, by - 1, 8, 2.6, 0, edge=None, fn=lambda u, v, r, L: 'l')
    layer(p, det)
    # 꼬리: 옆으로 처져 늘어짐
    for i, a in enumerate((190, 205, 218)):
        tip = ax((bx - 9, by), a, 9)
        tube(p, bez([(bx - 9, by, 2.0), (tip[0], tip[1], 0.8)], 10), 'r' if i % 2 == 0 else 'R', 'o', None)
    # 머리: 바닥 왼쪽에 툭
    hc = (bx + 12, G - 4)
    tube(p, bez([(bx + 6, by, 3.4), (bx + 10, by + 1, 2.8), (hc[0], hc[1], 2.4)], 8), 'b', 'o', 'l')
    blob(p, hc[0], hc[1], 3.4, 3.0, 0)
    for ox, oy, rad in ((-1.6, -3.4, 1.3), (0.4, -4.1, 1.5), (2.0, -3.3, 1.2)):
        p.d.ellipse((rr(hc[0] + ox - rad), rr(hc[1] + oy - rad), rr(hc[0] + ox + rad), rr(hc[1] + oy + rad)), fill=p.pal['r'], outline=p.pal['o'])
    p.poly([(rr(hc[0]) + 3, rr(hc[1]) - 1), (rr(hc[0]) + 7, rr(hc[1]) + 1), (rr(hc[0]) + 3, rr(hc[1]) + 2)], 'y', 'o')
    eye_x(p, rr(hc[0]) + 1, rr(hc[1]) - 1, 'k')
    return p


def draw(n):
    return draw_dead() if n == 'dead' else draw_bird(n)


SPEC = dict(cell=CELL, draw=draw)

if __name__ == '__main__':
    run('animal-2', SPEC)
