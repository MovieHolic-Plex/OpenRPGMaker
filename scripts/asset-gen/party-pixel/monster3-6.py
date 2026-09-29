"""monster3-6 업화(파티원) — 48 셀. 걷기 칩: 붉은 불꽃 덩어리, 검은 얼굴 구멍에 붉은 눈. 떠서 일렁인다(float).
대기 = 불꽃 혀가 칸마다 다르게 일렁, windup = 작게 움츠러들며 속이 하얘짐, attack = 앞으로 크게 부풀어 불꽃을 내뻗음, dead = 잿더미와 불씨. 왼쪽을 본다."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from mon_lib import *  # noqa

CELL = 48
PAL = dict(o='330000', s='6b0000', b='a50000', l='d30000', L='f45858', f='ff9a2a', F='ffe070', W='fff6d0', k='151617', e='ff3040', a='5a4a4a', A='8a7a7a')


def flame_mass(p, cx, cy, r, ph, grow=1.0, lean=0):
    tongues = []
    for k in range(7):
        a = math.radians(-90 + (k - 3) * 26)
        ln = r * (1.0 + .35 * math.sin(ph * 1.7 + k * 2.1)) * grow
        tongues.append((cx + math.cos(a) * r * .5 + lean * (k - 3) * .2, cy + math.sin(a) * r * .4, cx + math.cos(a) * ln + lean, cy + math.sin(a) * ln - ln * .6))
    for i, (col, sc) in enumerate((('o', 1.0), ('b', .86), ('l', .7), ('f', .5), ('F', .3))):
        p.d.ellipse((cx - r * sc, cy - r * sc * .9, cx + r * sc, cy + r * sc * .9), fill=p.pal[col])
        for (bx, by, tx, ty) in tongues:
            mx, my = cx + (tx - cx) * sc, cy + (ty - cy) * sc
            w = r * .32 * sc
            p.poly([(bx - w, by), (mx, my), (bx + w, by)], col)


SH = {'idle_a': (0, 0, 1.0, 0), 'idle_b': (1, 1, 1.03, 1), 'idle_c': (2, 0, 1.06, -1), 'windup': (3, -2, .82, 0), 'move': (4, 2, 1.0, 3),
      'attack': (5, 4, 1.08, 4), 'recover': (6, 1, 1.05, 1), 'hit': (7, -3, .9, -3)}


def draw(p, n):
    G = CELL - 4
    if n == 'dead':
        p.d.ellipse((12, G - 5, 36, G), fill=p.pal['a']); p.d.ellipse((15, G - 6, 30, G - 2), fill=p.pal['A'])
        for x, y in ((18, G - 7), (25, G - 8), (31, G - 5)):
            p.box((x, y, x + 1, y + 1), 'f'); dot(p, x, y - 1, 'F')
        p.line([(12, G), (36, G)], 'o')
        return
    ph, dx, grow, lean = SH[n]
    cx, cy = 22 + dx, 28 - (1 if ph % 2 else 0) + (2 if n == 'attack' else 0)
    flame_mass(p, cx, cy, 11, ph, grow, lean)
    if n == 'windup':
        p.d.ellipse((cx - 4, cy - 3, cx + 4, cy + 4), fill=p.pal['W'])
    if n == 'attack':
        for k in range(3):
            y = cy - 3 + k * 3
            p.poly([(cx + 8, y - 1), (cx + 20 - k * 2, y + (k - 1)), (cx + 8, y + 2)], 'f' if k != 1 else 'F', 'b')
    # 얼굴 구멍(앞쪽)
    fx, fy = cx + 4, cy - 1
    p.d.ellipse((fx - 5, fy - 4, fx + 4, fy + 5), fill=p.pal['k'])
    if n == 'hit':
        eyes(p, fx - 2, fy, 'x'); eyes(p, fx + 2, fy, 'x')
    else:
        for x in (fx - 3, fx + 1):
            p.box((x, fy - 1, x + 1, fy), 'e')
    p.line([(fx - 2, fy + 3), (fx + 2, fy + 3)], 'e' if n in ('attack', 'move') else 's')
    # 떠다니는 불씨
    for k in range(3):
        x = cx - 9 + k * 8 + (ph + k) % 3
        y = cy - 16 - ((ph * 3 + k * 5) % 6)
        dot(p, x, y, 'F' if k % 2 else 'f')


if __name__ == '__main__':
    build('monster3-6', 'b5', CELL, PAL, draw, ground=False)

