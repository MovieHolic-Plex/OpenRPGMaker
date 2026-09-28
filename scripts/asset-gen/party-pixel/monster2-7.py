"""monster2-7 마족 공작(보라 마족 귀족) 전투 도트 — 왼쪽(적 쪽)을 본다. 파티 motion: shoot.

걷기 칩 Monster2 (3,1)의 보라 피부·검은 머리·붉은 뿔·금장 검은 갑옷·초록 망토를 64px 로 다시 찍었다.
제자리에서 손끝에 암흑 구체를 키워 쏘아 보내는 마법 직업. 오른쪽 보기로 그린 뒤 pp_lib 가 좌우 반전한다.
"""
import math
from pp_lib import Pen, build, cap, put, limb, clean, leg_to

CELL = 64
PAL = dict(o='140c1c', v='7c58b8', V='b096e0', U='48327e', h='26222e', H='4c4a64', r='d42a34', R='f47a60',
           g='3a7040', G='6ea458', N='1e3a24', k='302c3c', K='5c586e', y='f2c440', w='faf4ea', e='ffe266')


def orb(p, x, y, r, glow=True):
    """Dark magic orb: ring, violet core, white highlight, orbiting sparks."""
    p.d.ellipse((x - r - 1, y - r - 1, x + r + 1, y + r + 1), fill=p.pal['o'])
    p.d.ellipse((x - r, y - r, x + r, y + r), fill=p.pal['U'])
    if r >= 3:
        p.d.ellipse((x - r + 2, y - r + 2, x + r - 2, y + r - 2), fill=p.pal['v'])
    p.d.point((x - r // 2, y - r // 2), fill=p.pal['w'])
    if r >= 4:
        p.d.point((x - r // 2 + 1, y - r // 2), fill=p.pal['V']); p.d.point((x - r // 2, y - r // 2 + 1), fill=p.pal['V'])
        p.d.point((x + r // 2, y + r // 2), fill=p.pal['o'])


def head(p, hx, hy, mode='idle'):
    # black hair swept back
    p.poly([(hx + 4, hy + 3), (hx + 1, hy + 1), (hx - 4, hy + 4), (hx - 3, hy + 10), (hx - 6, hy + 15), (hx, hy + 14), (hx + 3, hy + 10), (hx + 5, hy + 8)], 'h', 'o')
    p.line([(hx - 2, hy + 5), (hx + 2, hy + 6)], 'H'); p.line([(hx - 3, hy + 10), (hx + 1, hy + 10)], 'H')
    # horns: red, curved forward
    p.poly([(hx + 6, hy + 2), (hx + 5, hy - 4), (hx + 8, hy - 8), (hx + 12, hy - 7), (hx + 9, hy - 5), (hx + 9, hy + 2)], 'r', 'o')
    p.line([(hx + 6, hy - 1), (hx + 7, hy - 5)], 'R')
    # face
    p.poly([(hx + 3, hy + 4), (hx + 7, hy + 1), (hx + 12, hy + 2), (hx + 15, hy + 5), (hx + 16, hy + 9), (hx + 14, hy + 13), (hx + 7, hy + 14), (hx + 3, hy + 10)], 'v', 'o')
    p.poly([(hx + 4, hy + 5), (hx + 7, hy + 2), (hx + 10, hy + 2), (hx + 6, hy + 6)], 'V')
    p.poly([(hx + 4, hy + 6), (hx + 1, hy + 8), (hx + 4, hy + 9)], 'v', 'o')               # pointed ear
    p.line([(hx + 9, hy + 5), (hx + 15, hy + 5)], 'h')                                     # brow / fringe
    if mode == 'hit':
        p.line([(hx + 10, hy + 6), (hx + 13, hy + 8)], 'o'); p.line([(hx + 10, hy + 8), (hx + 13, hy + 6)], 'o')
    else:
        p.box((hx + 10, hy + 6, hx + 14, hy + 7), 'e'); p.box((hx + 13, hy + 6, hx + 13, hy + 7), 'o')
    p.box((hx + 16, hy + 8, hx + 16, hy + 9), 'U')
    if mode == 'atk':
        p.box((hx + 9, hy + 10, hx + 14, hy + 12), 'o'); p.box((hx + 10, hy + 10, hx + 10, hy + 10), 'w'); p.box((hx + 13, hy + 10, hx + 13, hy + 10), 'w')
    else:
        p.line([(hx + 9, hy + 11), (hx + 13, hy + 11)], 'o')
    p.line([(hx + 7, hy + 9), (hx + 7, hy + 12)], 'U')
    # gold circlet + ear jewel
    p.line([(hx + 6, hy + 3), (hx + 12, hy + 3)], 'y'); p.box((hx + 4, hy + 9, hx + 4, hy + 10), 'y')


# lean, bob, near hand (absolute), far hand, orb (x, y, r), feet dx, cloak flare, mouth
P_ = {
 'idle_a': dict(lx=0, bob=0, nh=(41, 37), fh=(20, 38), ob=(46, 32, 3), st=(3, -4), cl=0, mo='idle'),
 'idle_b': dict(lx=0, bob=1, nh=(41, 38), fh=(20, 39), ob=(46, 32, 4), st=(3, -4), cl=1, mo='idle'),
 'idle_c': dict(lx=0, bob=2, nh=(41, 39), fh=(20, 40), ob=(46, 33, 3), st=(3, -4), cl=2, mo='idle'),
 'windup': dict(lx=-3, bob=1, nh=(38, 17), fh=(22, 18), ob=(32, 9, 6), st=(3, -6), cl=-2, mo='idle'),
 'move':   dict(lx=2, bob=1, nh=(44, 32), fh=(24, 34), ob=(50, 31, 5), st=(4, -5), cl=-3, mo='atk'),
 'attack': dict(lx=3, bob=2, nh=(47, 34), fh=(40, 36), ob=(56, 33, 5), st=(5, -6), cl=-4, mo='atk'),
 'recover':dict(lx=1, bob=2, nh=(40, 39), fh=(22, 40), ob=(0, 0, 0), st=(3, -4), cl=1, mo='idle'),
 'hit':    dict(lx=-4, bob=1, nh=(30, 33), fh=(20, 31), ob=(0, 0, 0), st=(1, -5), cl=3, mo='hit'),
}


def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        p.poly([(6, 60), (10, 52), (24, 49), (40, 51), (46, 57), (46, 60)], 'g', 'o')
        p.line([(12, 53), (36, 52)], 'G'); p.line([(9, 58), (40, 58)], 'N')
        p.poly([(24, 50), (40, 50), (46, 56), (46, 60), (26, 60)], 'k', 'o')
        p.line([(28, 54), (42, 54)], 'y')
        head(p, 44, 40, mode='hit')
        p.poly([(52, 56), (58, 54), (60, 60), (52, 60)], 'v', 'o'); p.box((55, 57, 57, 58), 'y')
        return clean(p)
    q = P_[n]
    lx, bob = q['lx'], q['bob']
    hip = (30 + lx // 2, 40 + bob)
    sh = (31 + lx, 27 + bob)
    sole = 60
    cl = q['cl']
    # long green cloak behind: from shoulders down to the ankles, flaring
    p.poly([(sh[0] - 4, sh[1] - 1), (sh[0] + 3, sh[1]), (hip[0] + 2, hip[1] + 10), (hip[0] - 6 + cl, sole - 1), (hip[0] - 15 + cl * 2, sole - 3), (hip[0] - 13 + cl * 2, hip[1] + 6), (sh[0] - 10, sh[1] + 8)], 'g', 'o')
    p.poly([(sh[0] - 3, sh[1] + 1), (sh[0] + 1, sh[1] + 2), (hip[0], hip[1] + 8), (hip[0] - 5 + cl, sole - 3), (hip[0] - 10 + cl * 2, hip[1] + 9)], 'N')
    p.line([(sh[0] - 6, sh[1] + 5), (hip[0] - 10 + cl, hip[1] + 14)], 'G')
    # far arm
    limb(p, (sh[0] - 2, sh[1] + 2), q['fh'], 8, 8, 4, 'U')
    fx, fy = q['fh']; p.box((fx - 1, fy - 1, fx + 1, fy + 1), 'v')
    # legs (black trousers, gold-trimmed boots)
    leg_to(p, (hip[0] - 2, hip[1]), (hip[0] + q['st'][1], sole), 9, 9, 5, 'k', bw=7, bh=4, bcol='k')
    # torso: black armour, gold trim, purple undershirt
    p.poly([(sh[0] - 7, sh[1] - 1), (sh[0] + 6, sh[1] - 2), (sh[0] + 8, sh[1] + 5), (hip[0] + 7, hip[1] + 2), (hip[0] - 7, hip[1] + 2), (sh[0] - 8, sh[1] + 6)], 'k', 'o')
    p.poly([(sh[0] - 6, sh[1]), (sh[0], sh[1] - 1), (sh[0] - 2, sh[1] + 6), (sh[0] - 7, sh[1] + 6)], 'K')
    p.line([(sh[0] - 5, sh[1] + 1), (sh[0] + 5, sh[1] + 1)], 'y'); p.line([(sh[0] + 1, sh[1] + 2), (sh[0] + 3, hip[1])], 'y')
    p.line([(hip[0] - 7, hip[1]), (hip[0] + 7, hip[1])], 'y')
    p.box((hip[0], hip[1] - 1, hip[0] + 2, hip[1] + 1), 'r')
    p.poly([(hip[0] - 7, hip[1] + 2), (hip[0] + 7, hip[1] + 2), (hip[0] + 9, hip[1] + 8), (hip[0] - 8, hip[1] + 8)], 'k', 'o')
    p.line([(hip[0] - 5, hip[1] + 5), (hip[0] + 6, hip[1] + 5)], 'K')
    leg_to(p, (hip[0] + 2, hip[1]), (hip[0] + q['st'][0] + 3, sole), 9, 9, 6, 'k', dark=None, lit='K', bw=8, bh=4, bcol='k')
    p.line([(hip[0] + q['st'][0] + 1, sole - 3), (hip[0] + q['st'][0] + 7, sole - 3)], 'y')
    # head + pauldrons
    hx, hy = sh[0] - 8 + (1 if n == 'attack' else 0) - (2 if n == 'hit' else 0), sh[1] - 17 + (2 if n in ('recover', 'hit') else 0)
    head(p, hx, hy, q['mo'])
    p.poly([(sh[0] - 9, sh[1] - 3), (sh[0] - 2, sh[1] - 5), (sh[0] - 1, sh[1] + 4), (sh[0] - 9, sh[1] + 4)], 'K', 'o')
    p.poly([(sh[0] + 2, sh[1] - 4), (sh[0] + 9, sh[1] - 1), (sh[0] + 9, sh[1] + 5), (sh[0] + 2, sh[1] + 4)], 'K', 'o')
    p.line([(sh[0] - 8, sh[1] - 2), (sh[0] - 4, sh[1] - 3)], 'w'); p.line([(sh[0] + 3, sh[1] - 3), (sh[0] + 7, sh[1] - 1)], 'w')
    p.poly([(sh[0] - 9, sh[1] - 2), (sh[0] - 12, sh[1] - 6), (sh[0] - 6, sh[1] - 4)], 'y', 'o')
    # magic orb + near arm
    ox, oy, r = q['ob']
    if r:
        if n == 'attack':                                     # trailing motes behind the fired orb
            for k, (dx, dy) in enumerate([(-9, 3), (-12, -3), (-6, -6)]):
                p.d.point((ox + dx, oy + dy), fill=p.pal['V'] if k % 2 else p.pal['v'])
        orb(p, ox, oy, r)
    limb(p, (sh[0] + 3, sh[1] + 2), q['nh'], 8, 8, 4, 'v', dark='U', lit='V', bend=-1)
    hd = q['nh']
    p.box((hd[0] - 2, hd[1] - 2, hd[0] + 2, hd[1] + 2), 'o'); p.box((hd[0] - 1, hd[1] - 1, hd[0] + 1, hd[1] + 1), 'v')
    p.line([(sh[0] + 5, sh[1] + 6), (sh[0] + 7, sh[1] + 8)], 'y')
    return clean(p)


if __name__ == '__main__':
    build('monster2-7', CELL, PAL, draw)
