"""monster2-5 용인(초록 용인) 전투 도트 — 왼쪽(적 쪽)을 본다. 파티 motion: breath.

걷기 칩 Monster2 (1,1)의 초록 비늘·회색 배·흰 등 가시·접힌 날개를 64px 로 다시 찍었다.
두 발로 선 용인이 제자리에서 몸을 젖혔다가 숨을 뿜고 꼬리·발톱으로 후려친다. 오른쪽 보기로 그린 뒤 pp_lib 가 좌우 반전한다.
"""
import math
from pp_lib_b4 import Pen, build, cap, put, limb, clean, leg_to

CELL = 64
PAL = dict(o='0c2210', s='1e4a22', b='3c8a3c', l='6cc060', h='b0e69a', d='2a6a30', g='868898', a='c8cad4',
           c='f2f0e0', y='f2d840', r='c83a3a', f='ff8a30', F='ffe070')

WING = [(0, 0), (10, -2), (15, -1), (22, 1), (18, 5), (20, 10), (14, 9), (13, 15), (8, 11), (1, 10)]
BONES = [[(10, -2), (22, 1)], [(10, -2), (20, 10)], [(10, -2), (13, 15)]]


def D(a, L): return (math.cos(math.radians(a)) * L, math.sin(math.radians(a)) * L)


def wing(p, sh, ang, spread=0, far=False, k=1.0):
    ux, uy = D(ang, 1)
    vx, vy = -uy, ux
    if vx * -0.2 + vy * 1 < 0: vx, vy = -vx, -vy

    def T(pts, sp=0):
        out = []
        for u, v in pts:
            if u > 10 and sp:
                r = math.radians(sp * (v + 2) / 17)
                du, dv = u - 10, v + 2
                u, v = 10 + du * math.cos(r) - dv * math.sin(r), -2 + du * math.sin(r) + dv * math.cos(r)
            out.append((round(sh[0] + (ux * u + vx * v) * k), round(sh[1] + (uy * u + vy * v) * k)))
        return out
    base, bone = ('s', 'o') if far else ('d', 's')
    p.poly(T(WING, spread), base, 'o')
    for b in BONES: p.line(T(b, spread), bone if far else 'l')
    arm = T([(0, 0), (10, -2)])
    cap(p, arm, 3, 's' if far else 'b', lit=None if far else 'h')


HEAD_OPEN = ('open', 'atk')


def head(p, hx, hy, mouth=False, hurt=False):
    p.poly([(hx, hy + 3), (hx + 3, hy), (hx + 9, hy), (hx + 13, hy + 3), (hx + 16, hy + 5), (hx + 16, hy + 8), (hx + 12, hy + 10), (hx + 5, hy + 10), (hx + 1, hy + 8)], 'b', 'o')
    p.poly([(hx + 2, hy + 5), (hx + 4, hy + 1), (hx + 9, hy + 1), (hx + 6, hy + 4)], 'l')
    p.line([(hx + 4, hy + 1), (hx + 8, hy + 1)], 'h')
    # lower jaw
    if mouth:
        p.poly([(hx + 5, hy + 8), (hx + 13, hy + 8), (hx + 17, hy + 14), (hx + 10, hy + 15), (hx + 6, hy + 11)], 'b', 'o')
        p.poly([(hx + 6, hy + 9), (hx + 13, hy + 9), (hx + 15, hy + 12), (hx + 9, hy + 13)], 'r')
        for tx in (10, 13): p.box((hx + tx, hy + 9, hx + tx, hy + 10), 'c')
        p.box((hx + 15, hy + 8, hx + 16, hy + 8), 'c')
    else:
        p.poly([(hx + 4, hy + 8), (hx + 13, hy + 8), (hx + 15, hy + 9), (hx + 12, hy + 12), (hx + 5, hy + 12)], 'd', 'o')
        p.line([(hx + 10, hy + 8), (hx + 15, hy + 8)], 'o'); p.box((hx + 12, hy + 8, hx + 12, hy + 9), 'c')
    # eye + brow + nostril
    if hurt:
        p.line([(hx + 8, hy + 3), (hx + 11, hy + 5)], 'o'); p.line([(hx + 8, hy + 5), (hx + 11, hy + 3)], 'o')
    else:
        p.box((hx + 8, hy + 4, hx + 11, hy + 5), 'y'); p.box((hx + 10, hy + 4, hx + 10, hy + 5), 'o')
        p.line([(hx + 7, hy + 3), (hx + 12, hy + 3)], 'o')
    p.box((hx + 15, hy + 5, hx + 15, hy + 5), 'o')
    # horns (white), swept back
    p.poly([(hx + 3, hy + 1), (hx - 2, hy - 3), (hx - 5, hy - 2), (hx, hy + 3)], 'c', 'o')
    p.poly([(hx + 7, hy), (hx + 4, hy - 5), (hx + 1, hy - 5), (hx + 4, hy)], 'a', 'o')
    # ear frill
    p.poly([(hx + 1, hy + 6), (hx - 3, hy + 7), (hx - 1, hy + 10), (hx + 2, hy + 9)], 'd', 'o')


# lean, bob, wing (near ang, far ang, spread), head (dx, dy), arms hand target (near, far) from shoulder, foot dx, tail wave, mouth, fire
P = {
 'idle_a': dict(lx=0, bob=0, wn=(-120, 0), wf=(-108, 0), hd=(0, 0), hnd=((7, 9), (5, 11)), ft=2, tl=0, mo=0),
 'idle_b': dict(lx=0, bob=1, wn=(-150, 10), wf=(-140, 10), hd=(0, 1), hnd=((7, 9), (5, 11)), ft=2, tl=1, mo=0),
 'idle_c': dict(lx=0, bob=2, wn=(165, 20), wf=(172, 20), hd=(0, 2), hnd=((7, 10), (5, 12)), ft=2, tl=2, mo=0),
 'windup': dict(lx=-3, bob=0, wn=(-95, -10), wf=(-88, -10), hd=(-3, -5), hnd=((3, 5), (1, 7)), ft=3, tl=-1, mo=0),
 'move':   dict(lx=2, bob=1, wn=(-165, -15), wf=(-158, -15), hd=(3, 1), hnd=((10, 5), (7, 7)), ft=6, tl=-2, mo=0),
 'attack': dict(lx=0, bob=2, wn=(-135, 5), wf=(-125, 5), hd=(5, 3), hnd=((12, 8), (9, 11)), ft=4, tl=-3, mo=1),
 'recover':dict(lx=1, bob=1, wn=(175, 25), wf=(178, 25), hd=(1, 3), hnd=((6, 11), (4, 12)), ft=2, tl=1, mo=0),
 'hit':    dict(lx=-4, bob=1, wn=(-110, 25), wf=(-100, 25), hd=(-5, -1), hnd=((3, 11), (0, 9)), ft=0, tl=2, mo=0),
}


def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # sprawled on its side: tail out, folded wing, head on the floor
        p.poly([(6, 60), (4, 57), (12, 55), (20, 56), (18, 60)], 'b', 'o')
        cap(p, [(14, 56), (7, 54), (3, 50)], 3, 'b')
        p.poly([(18, 60), (18, 52), (30, 46), (44, 49), (46, 60)], 'b', 'o')
        p.poly([(21, 58), (21, 53), (30, 49), (38, 51), (36, 58)], 'g', 'o'); p.line([(24, 54), (36, 54)], 'a')
        p.poly([(24, 47), (30, 37), (40, 45), (36, 50)], 'd', 'o'); p.line([(30, 38), (37, 47)], 'l')
        head(p, 44, 47, hurt=True)
        for x in (24, 30, 36): p.poly([(x, 47), (x + 1, 43), (x + 3, 47)], 'c', 'o')
        return clean(p)
    q = P[n]
    lx, bob = q['lx'], q['bob']
    hip = (26 + lx // 2, 45 + bob)
    sh = (32 + lx, 30 + bob)
    sole = 60
    wing(p, (sh[0] - 3, sh[1] + 1), q['wf'][0], q['wf'][1], far=True, k=0.92)
    # tail: thick, tapering, curling up at the tip, white ridge spikes
    t = q['tl']
    tail = [(hip[0] - 2, hip[1] + 1), (hip[0] - 8, hip[1] + 3), (hip[0] - 14, hip[1] + 4 + t), (hip[0] - 18, hip[1] + t)]
    cap(p, tail[:3], 6, 'b', lit='l', dark='s')
    cap(p, tail[2:], 3, 'd')
    tx, ty = tail[-1]
    p.poly([(tx - 2, ty - 1), (tx, ty - 5), (tx + 2, ty - 1)], 'c', 'o')
    # far leg + arm
    ffar = hip[0] - 3
    leg_to(p, (hip[0] - 1, hip[1]), (ffar, sole), 9, 9, 6, 's', bw=7, bh=3, bcol='s')
    fh = (sh[0] + q['hnd'][1][0], sh[1] + q['hnd'][1][1])
    limb(p, (sh[0] - 1, sh[1] + 2), fh, 5, 5, 3, 's')
    wing(p, (sh[0] - 2, sh[1] + 1), q['wn'][0], q['wn'][1], k=1.0)
    # torso
    p.poly([(sh[0] - 7, sh[1] - 1), (sh[0] + 4, sh[1] - 3), (sh[0] + 7, sh[1] + 5), (hip[0] + 7, hip[1] + 2), (hip[0] - 6, hip[1] + 3), (sh[0] - 9, sh[1] + 8)], 'b', 'o')
    p.poly([(sh[0] - 6, sh[1]), (sh[0] - 1, sh[1] - 1), (sh[0] - 3, sh[1] + 6), (hip[0] - 4, hip[1] - 2), (sh[0] - 7, sh[1] + 7)], 'l')
    # belly plates (grey) down the front
    p.poly([(sh[0] + 1, sh[1] - 1), (sh[0] + 6, sh[1] + 4), (hip[0] + 6, hip[1] + 1), (hip[0] + 1, hip[1] + 1)], 'g', 'o')
    for k in range(4): p.line([(sh[0] + 1 + k // 2, sh[1] + 2 + k * 3), (sh[0] + 6 + k // 3, sh[1] + 4 + k * 3)], 'a')
    # back spikes
    for k, (dx, dy) in enumerate([(-7, 0), (-8, 5), (-8, 10)]):
        px, py = sh[0] + dx, sh[1] + dy
        p.poly([(px + 1, py), (px - 3, py + 1), (px + 1, py + 4)], 'c', 'o')
    # near leg (digitigrade)
    fnear = hip[0] + q['ft']
    leg_to(p, (hip[0] + 2, hip[1]), (fnear, sole), 9, 9, 7, 'b', dark='s', lit='l', bw=8, bh=3, bcol='b')
    p.line([(fnear + 5, sole), (fnear + 8, sole)], 'c')
    # neck+head
    nk0 = (sh[0] + 2, sh[1] - 1)
    hd = (sh[0] + 1 + q['hd'][0] - 3, sh[1] - 15 + q['hd'][1])
    cap(p, [nk0, (nk0[0] + 1 + q['hd'][0] // 2, nk0[1] - 5)], 6, 'b', lit='l', dark='s')
    head(p, hd[0] + 1, hd[1], mouth=bool(q['mo']), hurt=(n == 'hit'))
    # near arm with claws
    nh = (sh[0] + q['hnd'][0][0], sh[1] + q['hnd'][0][1])
    limb(p, (sh[0] + 3, sh[1] + 3), nh, 5, 5, 3, 'b', dark='s', lit='l')
    p.poly([(nh[0] - 1, nh[1] - 2), (nh[0] + 2, nh[1] - 2), (nh[0] + 2, nh[1] + 2), (nh[0] - 1, nh[1] + 2)], 'b', 'o')
    p.line([(nh[0] + 3, nh[1] - 2), (nh[0] + 5, nh[1] - 1)], 'c'); p.line([(nh[0] + 3, nh[1] + 1), (nh[0] + 5, nh[1] + 2)], 'c')
    if n == 'attack':                                         # short flame licking out of the open jaw
        fx, fy = hd[0] + 18, hd[1] + 12
        p.poly([(fx, fy - 2), (fx + 4, fy - 4), (fx + 6, fy - 1), (fx + 4, fy + 3), (fx, fy + 3)], 'f', 'o')
        p.poly([(fx + 1, fy - 1), (fx + 3, fy - 2), (fx + 5, fy), (fx + 3, fy + 2), (fx + 1, fy + 2)], 'F')
    return clean(p)


if __name__ == '__main__':
    build('monster2-5', CELL, PAL, draw)
