"""monster2-2 흡혈귀(은발 흡혈귀) 전투 도트 — 왼쪽(적 쪽)을 본다. 파티 motion: float.

걷기 칩 Monster2 (2,0)의 색·디자인(은발·붉은 눈·검은 금장 코트·자주 바지)을 전투용 48px 로 다시 찍었다.
스르르 다가가 송곳니를 드러내고 손톱으로 할퀸다. 오른쪽 보기로 그린 뒤 pp_lib 가 좌우 반전한다.
"""
from pp_lib import Pen, build, cap, put, clean, leg_to, limb

CELL = 48
PAL = dict(o='1a1024', w='d0d4e2', g='8a90ac', k='f2dcd2', t='c49a9c', e='e02040', h='fafafa',
           j='2c2640', i='4c4466', y='e8b83c', v='8040a8', u='4c2662', b='3c2a3c', r='9a1e34')

HEAD = [
    "...oooooo.....",
    "..owwwwwwo....",
    ".owwwwwwwwoo..",
    "owwwgwwwwwwwo.",
    "owwgwwwgggwkko",
    "owwgwwwwwwokko",
    "owgwwwwwwokeko",
    ".ogwwwwwwokkko",
    ".owgwwwwwookho",
    ".owwgwwwo.otoo",
    "..owwwwo......",
    "...oooo.......",
]
HEAD_ATK = list(HEAD)
HEAD_ATK[7] = ".owwwwwwwokkho"; HEAD_ATK[8] = ".owgwwwwwoohhro"[:14]; HEAD_ATK[9] = ".owwgwwwo.orro"
HEAD_HIT = list(HEAD)
HEAD_HIT[6] = "owwgwwwwwokook"[:14]; HEAD_HIT[8] = ".owgwwwwwookoo"

# lean, bob, head dy, near hand (from shoulder), far hand, feet (near dx, far dx), coat swing
P = {
 'idle_a': dict(lx=0, bob=0, hand=(6, 11), far=(-5, 11), ft=(3, -3), sw=0),
 'idle_b': dict(lx=0, bob=1, hand=(6, 11), far=(-5, 11), ft=(3, -3), sw=1),
 'idle_c': dict(lx=0, bob=0, hand=(7, 10), far=(-6, 10), ft=(3, -3), sw=2),
 'windup': dict(lx=-2, bob=0, hand=(-7, -3), far=(3, -9), ft=(2, -5), sw=-2),
 'move':   dict(lx=2, bob=0, hand=(11, 5), far=(-7, 8), ft=(7, -6), sw=-3),
 'attack': dict(lx=3, bob=1, hand=(12, 5), far=(9, 11), ft=(6, -5), sw=-4),
 'recover':dict(lx=1, bob=2, hand=(7, 13), far=(-4, 13), ft=(4, -3), sw=1),
 'hit':    dict(lx=-3, bob=1, hand=(-3, 9), far=(-8, 7), ft=(0, -6), sw=3),
}


def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        # lying on its back on the floor, coat spread like a cape
        p.poly([(6, 44), (8, 41), (30, 40), (40, 42), (42, 44)], 'j', 'o')
        p.line([(10, 42), (36, 42)], 'i')
        p.poly([(29, 40), (40, 39), (43, 43), (30, 43)], 'v', 'o'); p.line([(31, 41), (41, 41)], 'u')
        p.poly([(39, 41), (44, 41), (44, 44), (39, 44)], 'b', 'o')
        put(p, 6, 33, ["..oooooo..", ".owwwwwwo.", "owwgwwwwwo", "owwwkkkkko", "owwkkeeekko"[:10], "oowwktkkoo."[:10], ".ooooooooo"])
        p.box((17, 41, 19, 42), 'y')
        return clean(p)
    q = P[n]
    lx, bob = q['lx'], q['bob']
    sh = (23 + lx, 19 + bob)                    # shoulder
    hip = (22 + lx // 2, 29 + bob)
    sole = 44
    fnear, ffar = hip[0] + q['ft'][0], hip[0] + q['ft'][1]
    # far arm + far leg (behind)
    fh = (sh[0] + q['far'][0], sh[1] + q['far'][1])
    limb(p, (sh[0] - 2, sh[1] + 1), fh, 6, 6, 3, 'u' if False else 'j', dark=None, lit=None, bend=1)
    p.box((fh[0] - 1, fh[1] - 1, fh[0], fh[1]), 'k')
    leg_to(p, (hip[0] - 1, hip[1]), (ffar, sole), 6.4, 6.4, 4, 'u', dark=None, lit=None, bw=5, bh=3, bcol='b')
    # coat tails flaring behind
    sw = q['sw']
    p.poly([(sh[0] - 4, sh[1] + 4), (sh[0] + 3, sh[1] + 4), (hip[0] + 3, hip[1] + 3), (hip[0] - 5 + sw, hip[1] + 10 - abs(sw) // 2), (hip[0] - 9 + sw, hip[1] + 6)], 'j', 'o')
    p.line([(hip[0] - 4 + sw, hip[1] + 10), (hip[0] - 2, hip[1] + 4)], 'i')
    # torso: coat with gold buttons and high collar
    p.poly([(sh[0] - 5, sh[1]), (sh[0] + 4, sh[1]), (sh[0] + 5, sh[1] + 6), (hip[0] + 4, hip[1] + 1), (hip[0] - 4, hip[1] + 1), (sh[0] - 6, sh[1] + 6)], 'j', 'o')
    p.line([(sh[0] - 4, sh[1] + 1), (sh[0] + 3, sh[1] + 1)], 'i')
    p.line([(sh[0] + 2, sh[1] + 2), (hip[0] + 2, hip[1])], 'y')       # front trim
    for k in range(3): p.px = None if False else None; p.box((sh[0] + 1, sh[1] + 4 + k * 3, sh[0] + 1, sh[1] + 4 + k * 3), 'y')
    p.line([(hip[0] - 4, hip[1] - 1), (hip[0] + 3, hip[1] - 1)], 'y')  # belt
    p.poly([(sh[0] - 2, sh[1] - 2), (sh[0] + 4, sh[1] - 2), (sh[0] + 5, sh[1] + 2), (sh[0] - 3, sh[1] + 1)], 'i', 'o')   # collar
    p.line([(sh[0] - 1, sh[1] - 1), (sh[0] + 3, sh[1] - 1)], 'y')
    # near leg
    leg_to(p, (hip[0] + 1, hip[1]), (fnear, sole), 6.4, 6.4, 4, 'v', dark='u', lit=None, bw=5, bh=3, bcol='b')
    # head
    hx, hy = sh[0] - 9 + (1 if n == 'attack' else 0) - (1 if n == 'hit' else 0), sh[1] - 12 + (1 if n in ('hit', 'recover') else 0)
    put(p, hx, hy, HEAD_ATK if n == 'attack' else HEAD_HIT if n == 'hit' else HEAD)
    # near arm (claws when attacking)
    hd = (sh[0] + q['hand'][0], sh[1] + q['hand'][1])
    limb(p, (sh[0] + 1, sh[1] + 1), hd, 6, 6, 3, 'j', dark=None, lit='i', bend=-1)
    p.box((hd[0] - 1, hd[1] - 1, hd[0] + 1, hd[1] + 1), 'k')
    if n in ('attack', 'move'):
        for dy in (-1, 1):
            p.line([(hd[0] + 2, hd[1] + dy), (hd[0] + 4, hd[1] + dy + (1 if dy > 0 else -1))], 'h')
    if n == 'attack':
        p.line([(hd[0] + 6, hd[1] - 4), (hd[0] + 4, hd[1] + 1)], 'r')
    return clean(p)


if __name__ == '__main__':
    build('monster2-2', CELL, PAL, draw)
