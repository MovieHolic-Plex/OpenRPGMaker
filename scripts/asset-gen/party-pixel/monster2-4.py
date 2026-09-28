"""monster2-4 흙 골렘(돔 머리 점토 거인) 전투 도트 — 왼쪽(적 쪽)을 본다. 파티 motion: stomp.

걷기 칩 Monster2 (4,1)의 황토색 점토 근육·돔 머리·붉은 눈을 64px 로 다시 찍었다.
두 걸음 무겁게 다가가 두 주먹으로 내려찍는다. 오른쪽 보기로 그린 뒤 pp_lib 가 좌우 반전한다.
"""
from pp_lib import Pen, build, clean

CELL = 64
PAL = dict(o='3a2216', s='7c5638', b='b48a5e', l='d6b486', h='efdab2', m='5a3a24', e='e83030', r='f08a60', c='9a7048')


def clump(p, x, y, w, h, base='b', light='l', shade='s'):
    """Rounded clay chunk: outline, top-left light, bottom-right shade (Pen.stone with softer corners)."""
    p.poly([(x + 2, y), (x + w - 3, y), (x + w - 1, y + 2), (x + w - 1, y + h - 3), (x + w - 3, y + h - 1), (x + 2, y + h - 1), (x, y + h - 3), (x, y + 2)], base, 'o')
    p.poly([(x + 2, y + 1), (x + w - 4, y + 1), (x + w - 3, y + 3), (x + 3, y + 4), (x + 1, y + h - 4), (x + 1, y + 3)], light)
    p.line([(x + w - 2, y + 4), (x + w - 2, y + h - 3), (x + w - 4, y + h - 2), (x + 3, y + h - 2)], shade)


def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead':
        for x, y, w, h in [(10, 52, 14, 9), (24, 47, 16, 14), (39, 54, 12, 7), (46, 50, 9, 7)]:
            clump(p, x, y, w, h)
        p.line([(27, 51), (30, 53), (29, 57)], 'o')
        p.line([(42, 55), (44, 57)], 'o')
        # dome head rolled to the front, eye dull
        p.poly([(6, 60), (5, 55), (8, 51), (13, 50), (16, 53), (16, 60)], 'b', 'o')
        p.poly([(7, 52), (11, 51), (8, 56)], 'l'); p.box((11, 56, 13, 56), 's'); p.box((12, 55, 13, 55), 'm')
        return clean(p)
    lean = {'windup': -2, 'attack': 4, 'hit': -3, 'recover': 1}.get(n, 0)
    bob = {'idle_a': 0, 'idle_b': 1, 'idle_c': 2}.get(n, 0)
    # feet
    for x, y in [(19, 48), (36, 47 if n == 'move' else 48)]:
        clump(p, x, y, 12, 13 if y == 48 else 14)
        p.line([(x + 3, 58), (x + 8, 58)], 'h')
        p.line([(x + 8, y + 4), (x + 8, y + 9)], 's')
    x, y = 21 + lean, 31 + bob
    clump(p, x, y, 25, 23)                                    # torso
    p.poly([(x + 3, y + 3), (x + 12, y + 2), (x + 13, y + 9), (x + 3, y + 9)], 'l')      # pec plates
    p.poly([(x + 14, y + 3), (x + 21, y + 4), (x + 20, y + 10), (x + 14, y + 9)], 'c')
    p.line([(x + 13, y + 2), (x + 13, y + 10)], 's')
    p.line([(x + 4, y + 13), (x + 20, y + 13)], 's'); p.line([(x + 6, y + 17), (x + 18, y + 17)], 's')   # abs
    p.line([(x + 12, y + 13), (x + 12, y + 20)], 's')
    p.line([(x + 4, y + 4), (x + 8, y + 3)], 'h')
    p.line([(x + 5, y + 20), (x + 8, y + 19), (x + 6, y + 15)], 'o')           # crack
    # dome head
    hx, hy = 27 + lean + (1 if n == 'attack' else 0), 17 + bob + (1 if n == 'hit' else 0)
    p.poly([(hx + 1, hy + 14), (hx, hy + 8), (hx + 1, hy + 3), (hx + 5, hy), (hx + 11, hy), (hx + 15, hy + 3), (hx + 16, hy + 8), (hx + 15, hy + 14)], 'b', 'o')
    p.poly([(hx + 2, hy + 8), (hx + 3, hy + 3), (hx + 6, hy + 1), (hx + 10, hy + 1), (hx + 5, hy + 5), (hx + 4, hy + 10)], 'l')
    p.line([(hx + 5, hy + 1), (hx + 9, hy + 1)], 'h')
    p.line([(hx + 8, hy + 8), (hx + 15, hy + 8)], 's')      # brow shadow
    p.box((hx + 11, hy + 9, hx + 14, hy + 10), 'm'); p.box((hx + 12, hy + 9, hx + 14, hy + 9), 'e')
    p.line([(hx + 9, hy + 13), (hx + 14, hy + 13)], 's')
    if n in ('attack', 'windup'): p.box((hx + 12, hy + 10, hx + 14, hy + 10), 'r')
    # arms: dangling / raised / slam
    if n == 'windup': arms = [(11, 15, 13, 19), (40, 12, 13, 19)]
    elif n == 'attack': arms = [(33, 38, 13, 19), (45, 40, 14, 19)]
    elif n == 'move': arms = [(11, 34, 13, 18), (43, 30, 13, 19)]
    elif n == 'hit': arms = [(8, 33, 13, 18), (40, 38, 13, 18)]
    else: arms = [(10 + lean, 33 + bob, 13, 19), (43 + lean, 33 + bob, 13, 19)]
    for ax, ay, w, h in arms:
        clump(p, ax, ay, w, h)
        p.line([(ax + 3, ay + h - 6), (ax + w - 4, ay + h - 6)], 's')
        p.line([(ax + 4, ay + h - 5), (ax + 4, ay + h - 2)], 'o'); p.line([(ax + 8, ay + h - 5), (ax + 8, ay + h - 2)], 'o')
        p.line([(ax + 3, ay + 3), (ax + 6, ay + 2)], 'h')
        if n == 'attack': p.line([(ax + 3, ay + 1), (ax + 8, ay + 1)], 'h')
    if n == 'attack':                                          # dust at the slam point
        p.line([(52, 60), (59, 60)], 'c'); p.line([(55, 58), (58, 58)], 'l')
    return clean(p)


if __name__ == '__main__':
    build('monster2-4', CELL, PAL, draw)
