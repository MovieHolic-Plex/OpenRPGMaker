"""줄 A — 3라운드 신규 소품(상자형 몸통 + 깊은 윗면) + 지붕 깃발 애니메이션."""
from __future__ import annotations
import math
from sky_a_lib import *


@piece('sky-a-boiler', '증기 보일러', 2, 2, 'round_body', 'A', solid=[(0, 1), (1, 1)], tags=['prop'])
def _(c):
    face(c, 3, 12, 26, 15, 'copper', 1, 'plate', seed=72); c.HL(3, 16, 26, K('brass', 2)); c.HL(3, 22, 26, K('brass', 1))
    c.ell(16, 11, 13, 6.5, K('copper', 3)); c.ell(16, 11, 10, 4.5, K('copper', 2)); c.ell(16, 10, 5, 2, K('iron', 1))
    c.R(5, 25, 4, 5, K('iron', -1)); c.R(23, 25, 4, 5, K('iron', -1)); c.R(14, 3, 4, 4, K('brass', 2)); c.outline()


@piece('sky-a-market-stall', '장터 가판', 2, 2, 'structure', 'A', solid=[(0, 1), (1, 1)], tags=['prop'])
def _(c):
    box(c, 3, 18, 26, 6, 8, 'wood', 1, 'plank', seed=73); c.R(6, 15, 4, 4, K('red', 2)); c.R(13, 15, 5, 3, K('brass', 3)); c.R(21, 15, 4, 4, K('grass', 2))
    roof(c, 1, 1, 30, 13, 'canvas', 1, seed=74); c.R(2, 11, 28, 2, K('red', 1)); c.outline()


@piece('sky-a-well', '빗물 우물', 1, 1, 'container', 'A', solid=[(0, 0)], tags=['prop'])
def _(c):
    face(c, 2, 7, 12, 8, 'rock', 1, 'stone', seed=75); c.ell(8, 6, 6.5, 4.4, K('rock', 3)); c.ell(8, 6.3, 4.6, 3, K('rock', -3)); c.ell(8, 6.8, 3.6, 2, K('sky', 1)); c.outline()


@piece('sky-a-bench', '벤치', 1, 1, 'low_furniture', 'A', solid=[(0, 0)], tags=['prop'])
def _(c):
    box(c, 1, 4, 14, 6, 4, 'wood', 2, 'plank', taper=.15, seed=76); c.R(2, 12, 2, 3, K('wood', -3)); c.R(12, 12, 2, 3, K('wood', -3)); c.outline()


@piece('sky-a-planter', '화단 상자', 1, 1, 'container', 'A', solid=[(0, 0)], tags=['prop'])
def _(c):
    face(c, 1, 8, 14, 7, 'wood', 1, 'plank', seed=79); c.ell(8, 7, 7.2, 4.4, K('wood', 3)); c.ell(8, 7, 6, 3.4, K('earth', 0))
    for x, col in ((4, 'red'), (8, 'brass'), (11, 'cloud')): c.P(x, 5, K(col, 3)); c.P(x, 6, K('grass', 1))
    c.outline()


@piece('sky-a-hut-flag-anim', '감시 오두막 + 지붕 깃발(펄럭)', 2, 3, 'structure', 'A', frames=4, solid=[(0, 2), (1, 2)], tags=['anim'])
def _(c, f):
    face(c, 4, 31, 24, 15, 'wood', 1, 'plank', seed=37); window(c, 8, 35, 4, 5, True); door(c, 18, 37, 5, 9)
    roof(c, 1, 19, 30, 12, 'red', 1, seed=38)
    c.VL(16, 3, 17, K('brass', 2)); c.VL(17, 3, 17, K('brass', -1))
    for x in range(6):
        dy = int(round(1.2 * math.sin((x + f * 1.6) * .9)))
        for y in range(4, 11): c.P(17 + x, y + dy, K('red', 2 if y < 7 else 1 if y < 9 else -1))
    c.outline()


@piece('sky-a-sack-stack', '곡물 자루 더미', 2, 2, 'box', 'A', solid=[(0, 1), (1, 1)], tags=['prop'])
def _(c):
    box(c, 2, 8, 28, 10, 10, 'canvas', 1, 'plain', taper=.2, seed=70)
    for i in (9, 16, 23): c.VL(i, 18, 10, K('canvas', -2))
    c.HL(2, 22, 28, K('wood', 0)); c.outline()


@piece('sky-a-cannon-box', '신호 대포 상자', 1, 1, 'box', 'A', solid=[(0, 0)], tags=['prop'])
def _(c):
    box(c, 1, 2, 14, 8, 6, 'iron', 1, 'plate', taper=.2, seed=77); c.R(6, 4, 5, 3, K('brass', 0)); c.HL(6, 4, 5, K('brass', 2)); c.outline()


@piece('sky-a-stone-wall', '섬 돌담', 2, 1, 'box', 'A', solid=[(0, 0), (1, 0)], tags=['prop'])
def _(c):
    box(c, 1, 1, 30, 8, 6, 'rock', 2, 'stone', taper=.2, seed=78); c.outline()


@piece('sky-a-steam-cloud', '증기 구름', 2, 1, 'organic', 'A', solid=[], tags=['prop', 'overlay'])
def _(c):
    for k, (x, y, r) in enumerate([(7, 10, 6), (15, 7, 7), (24, 10, 6), (14, 11, 6)]): tex_ell(c, x, y, r + 2, r - 1, 'cloud', 1, seed=80 + k, light=(-.2, -.8))


if __name__ == '__main__': run_cli('A')
