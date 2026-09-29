"""monster2-6 오니 무사(붉은 오니 무사) 전투 도트 — 왼쪽(적 쪽)을 본다. 파티 motion: dash.

걷기 칩 Monster2 (2,1)의 붉은 오니 얼굴·연한 갈기·검고 보라 갑옷·두 자루 곡도를 64px 로 다시 찍었다.
쌍도를 늘어뜨리고 있다가 X자로 교차해 베는 물리 직업. 오른쪽 보기로 그린 뒤 pp_lib 가 좌우 반전한다.
"""
import math
from pp_lib_b4 import Pen, build, cap, put, limb, clean, leg_to

CELL = 64
PAL = dict(o='1c0c10', r='c8342c', R='ec644e', D='841c22', m='e6cea4', M='a88860', p='6a44a0', P='3c2864',
           k='2a2634', K='565068', y='f2c848', w='f6f2e2', S='d0d4e2', s='7c8098')


def sword(p, hand, tip, bulge=2, near=True):
    """Curved single-edged blade from hand to tip; the edge (light) faces the direction of travel."""
    (hx, hy), (tx, ty) = hand, tip
    L = math.hypot(tx - hx, ty - hy) or 1
    ux, uy = (tx - hx) / L, (ty - hy) / L
    nx, ny = -uy, ux
    mx, my = (hx + tx) / 2 + nx * bulge, (hy + ty) / 2 + ny * bulge
    gx, gy = hx + ux * 3, hy + uy * 3
    # grip + gold guard
    cap(p, [(hx - ux * 3, hy - uy * 3), (gx, gy)], 2, 'P', edge='o')
    p.line([(round(gx - nx * 2), round(gy - ny * 2)), (round(gx + nx * 2), round(gy + ny * 2))], 'y', 2)
    pts = [(gx + ux * 1, gy + uy * 1), (mx, my), (tx, ty)]
    cap(p, pts, 2, 'S' if near else 's', edge='o')
    if near:
        p.line([(round(pts[0][0] - nx), round(pts[0][1] - ny)), (round(mx - nx), round(my - ny)), (round(tx - nx * 0.6), round(ty - ny * 0.6))], 'w')


def head(p, hx, hy, mode='idle'):
    # mane streaming behind the head
    p.poly([(hx + 4, hy + 4), (hx - 1, hy + 1), (hx - 6, hy + 5), (hx - 4, hy + 10), (hx - 8, hy + 14), (hx - 2, hy + 16), (hx - 3, hy + 21), (hx + 3, hy + 15), (hx + 5, hy + 10)], 'm', 'o')
    for a, b in [((hx - 3, hy + 6), (hx + 2, hy + 8)), ((hx - 4, hy + 11), (hx + 1, hy + 12)), ((hx - 2, hy + 16), (hx + 2, hy + 14))]:
        p.line([a, b], 'M')
    # horns
    p.poly([(hx + 9, hy + 2), (hx + 8, hy - 4), (hx + 10, hy - 8), (hx + 11, hy - 4), (hx + 12, hy + 2)], 'w', 'o')
    p.poly([(hx + 4, hy + 3), (hx + 2, hy - 2), (hx + 3, hy - 5), (hx + 6, hy - 1), (hx + 6, hy + 3)], 'M', 'o')
    # face
    p.poly([(hx + 3, hy + 5), (hx + 7, hy + 1), (hx + 13, hy + 2), (hx + 16, hy + 5), (hx + 17, hy + 10), (hx + 14, hy + 14), (hx + 7, hy + 14), (hx + 3, hy + 11)], 'r', 'o')
    p.poly([(hx + 4, hy + 6), (hx + 7, hy + 2), (hx + 10, hy + 2), (hx + 6, hy + 7)], 'R')
    p.line([(hx + 8, hy + 5), (hx + 16, hy + 6)], 'D', 1)                       # scowling brow
    if mode == 'hit':
        p.line([(hx + 10, hy + 6), (hx + 13, hy + 8)], 'o'); p.line([(hx + 10, hy + 8), (hx + 13, hy + 6)], 'o')
    else:
        p.box((hx + 10, hy + 7, hx + 14, hy + 8), 'y'); p.box((hx + 13, hy + 7, hx + 13, hy + 8), 'o')
    p.box((hx + 17, hy + 8, hx + 17, hy + 9), 'D')                              # nose
    if mode in ('atk',):
        p.poly([(hx + 8, hy + 11), (hx + 16, hy + 11), (hx + 15, hy + 15), (hx + 9, hy + 15)], 'o')
        p.box((hx + 9, hy + 12, hx + 15, hy + 13), 'D')
        p.box((hx + 10, hy + 11, hx + 10, hy + 12), 'w'); p.box((hx + 15, hy + 10, hx + 15, hy + 12), 'w')
    else:
        p.line([(hx + 9, hy + 11), (hx + 15, hy + 11)], 'o')
        p.box((hx + 13, hy + 9, hx + 13, hy + 11), 'w'); p.box((hx + 10, hy + 10, hx + 10, hy + 11), 'w')
    p.line([(hx + 6, hy + 9), (hx + 7, hy + 12)], 'D')


# lean, bob, near hand/tip, far hand/tip (relative offsets are absolute cell coords), feet
P_ = {
 'idle_a': dict(lx=0, bob=0, nh=(40, 38), nt=(46, 55), fh=(23, 37), ft=(18, 54), st=(3, -4), mo='idle'),
 'idle_b': dict(lx=0, bob=1, nh=(40, 39), nt=(46, 56), fh=(23, 38), ft=(18, 55), st=(3, -4), mo='idle'),
 'idle_c': dict(lx=0, bob=2, nh=(40, 40), nt=(45, 57), fh=(23, 39), ft=(17, 56), st=(3, -4), mo='idle'),
 'windup': dict(lx=-3, bob=1, nh=(33, 20), nt=(19, 6), fh=(24, 20), ft=(38, 5), st=(3, -6), mo='idle'),
 'move':   dict(lx=3, bob=1, nh=(37, 34), nt=(19, 28), fh=(27, 33), ft=(12, 41), st=(9, -8), mo='atk'),
 'attack': dict(lx=5, bob=2, nh=(42, 33), nt=(58, 46), fh=(38, 31), ft=(56, 22), st=(8, -6), mo='atk'),
 'recover':dict(lx=2, bob=2, nh=(40, 40), nt=(52, 55), fh=(30, 40), ft=(44, 57), st=(5, -4), mo='idle'),
 'hit':    dict(lx=-4, bob=1, nh=(32, 34), nt=(24, 50), fh=(24, 32), ft=(10, 42), st=(1, -7), mo='hit'),
}


def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        p.poly([(6, 60), (8, 55), (20, 52), (34, 53), (44, 56), (46, 60)], 'k', 'o')
        p.poly([(20, 53), (32, 53), (34, 58), (20, 58)], 'p', 'o'); p.line([(22, 55), (31, 55)], 'P')
        p.poly([(41, 53), (54, 53), (56, 60), (41, 60)], 'k', 'o')
        head(p, 42, 39, mode='hit')
        p.line([(6, 58), (28, 58)], 'S'); p.line([(6, 59), (28, 59)], 'o'); p.line([(14, 60), (34, 60)], 's')
        return clean(p)
    q = P_[n]
    lx, bob = q['lx'], q['bob']
    hip = (30 + lx // 2, 39 + bob)
    sh = (31 + lx, 27 + bob)
    sole = 60
    # far sword + arm (behind the body)
    sword(p, q['fh'], q['ft'], bulge=-2, near=False)
    limb(p, (sh[0] - 2, sh[1] + 2), q['fh'], 8, 8, 4, 'P')
    # back cape/hakama fluttering
    p.poly([(sh[0] - 5, sh[1] + 3), (hip[0] - 2, hip[1] + 4), (hip[0] - 12 - lx, hip[1] + 10), (hip[0] - 14 - lx, hip[1] + 2)], 'P', 'o')
    # far leg
    leg_to(p, (hip[0] - 2, hip[1]), (hip[0] + q['st'][1], sole), 9, 9, 6, 'P', bw=7, bh=3, bcol='k')
    # torso: black cuirass, purple sash, gold trim
    p.poly([(sh[0] - 8, sh[1] - 1), (sh[0] + 6, sh[1] - 2), (sh[0] + 9, sh[1] + 5), (hip[0] + 8, hip[1] + 2), (hip[0] - 8, hip[1] + 2), (sh[0] - 9, sh[1] + 6)], 'k', 'o')
    p.poly([(sh[0] - 7, sh[1]), (sh[0] - 1, sh[1] - 1), (sh[0] - 3, sh[1] + 6), (sh[0] - 8, sh[1] + 6)], 'K')
    p.line([(sh[0] - 4, sh[1] + 1), (sh[0] + 5, sh[1] + 1)], 'y')
    p.poly([(sh[0] - 8, sh[1] + 8), (sh[0] + 8, sh[1] + 5), (hip[0] + 8, hip[1] - 1), (hip[0] - 8, hip[1] + 1)], 'p', 'o')
    p.line([(sh[0] - 7, sh[1] + 9), (sh[0] + 7, sh[1] + 6)], 'P')
    p.box((hip[0] - 1, hip[1] - 3, hip[0] + 2, hip[1] - 1), 'y')
    # tassets
    p.poly([(hip[0] - 8, hip[1] + 2), (hip[0] + 8, hip[1] + 2), (hip[0] + 10, hip[1] + 8), (hip[0] - 9, hip[1] + 8)], 'p', 'o')
    p.line([(hip[0] - 6, hip[1] + 4), (hip[0] + 7, hip[1] + 4)], 'P'); p.line([(hip[0] - 7, hip[1] + 7), (hip[0] + 8, hip[1] + 7)], 'y')
    # near leg
    leg_to(p, (hip[0] + 2, hip[1]), (hip[0] + q['st'][0] + 3, sole), 9, 9, 7, 'p', dark='P', lit=None, bw=8, bh=3, bcol='k')
    p.line([(hip[0] + q['st'][0] + 4, sole - 4), (hip[0] + q['st'][0] + 9, sole - 4)], 'K') if False else None
    # head (behind the near shoulder)
    hx, hy = sh[0] - 8 + (1 if n in ('attack',) else 0) - (2 if n == 'hit' else 0), sh[1] - 17 + (2 if n in ('recover', 'hit') else 0)
    head(p, hx, hy, q['mo'])
    # neck guard + pauldrons (spiked)
    p.poly([(sh[0] - 9, sh[1] - 3), (sh[0] - 3, sh[1] - 5), (sh[0] - 1, sh[1] + 4), (sh[0] - 9, sh[1] + 4)], 'K', 'o')
    p.poly([(sh[0] + 2, sh[1] - 4), (sh[0] + 9, sh[1] - 1), (sh[0] + 9, sh[1] + 5), (sh[0] + 2, sh[1] + 4)], 'K', 'o')
    p.line([(sh[0] - 8, sh[1] - 2), (sh[0] - 4, sh[1] - 3)], 'S'); p.line([(sh[0] + 3, sh[1] - 3), (sh[0] + 7, sh[1] - 1)], 'S')
    p.poly([(sh[0] - 9, sh[1] - 2), (sh[0] - 13, sh[1] - 6), (sh[0] - 7, sh[1] - 4)], 'y', 'o')
    p.poly([(sh[0] + 8, sh[1] - 1), (sh[0] + 12, sh[1] - 4), (sh[0] + 9, sh[1] + 2)], 'y', 'o')
    # near arm + sword
    sword(p, q['nh'], q['nt'], bulge=2, near=True)
    limb(p, (sh[0] + 3, sh[1] + 2), q['nh'], 8, 8, 5, 'p', dark='P', lit=None, bend=-1)
    hd = q['nh']
    p.box((hd[0] - 2, hd[1] - 2, hd[0] + 2, hd[1] + 2), 'o'); p.box((hd[0] - 1, hd[1] - 1, hd[0] + 1, hd[1] + 1), 'r')
    return clean(p)


if __name__ == '__main__':
    build('monster2-6', CELL, PAL, draw)
