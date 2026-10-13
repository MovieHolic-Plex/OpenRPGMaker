"""줄 A 하늘섬 — 소품(서 있는 것은 윗면 판 3~5줄 + 앞면). 구름·안개는 organic(면제), 구름 바다는 terrain."""
from __future__ import annotations
from sky_a_lib import *


def post_top(c, x, y, w, ramp, t=2):
    slab(c, x, y, w, 4, ramp, t, taper=.3, grain=False)


@piece('sky-a-rope-crate', '밧줄 상자', 1, 1, 'box', 'A', solid=[(0, 0)], tags=['prop'])
def _(c):
    box(c, 1, 3, 14, 6, 7, 'wood', 1, 'plank', seed=3)
    c.HL(2, 5, 12, K('canvas', 3)); c.R(5, 4, 6, 3, K('canvas', 2)); c.HL(5, 4, 6, K('canvas', 4)); c.VL(8, 10, 3, K('brass', 3)); c.outline()


@piece('sky-a-crate-stack', '화물 상자 더미', 2, 2, 'box', 'A', solid=[(0, 1), (1, 1)], tags=['prop'])
def _(c):
    box(c, 2, 14, 18, 6, 10, 'wood', 1, 'plank', seed=4); box(c, 18, 12, 12, 6, 12, 'canvas', 1, 'plank', seed=5)
    box(c, 5, 3, 14, 6, 6, 'wood', 2, 'plank', seed=6); c.HL(6, 21, 12, K('brass', 3)); c.outline()


@piece('sky-a-gas-tank', '증기 가스 탱크', 2, 2, 'round_body', 'A', solid=[(0, 1), (1, 1)], tags=['prop'])
def _(c):
    face(c, 4, 12, 24, 17, 'copper', 1, 'plate', seed=10); c.HL(4, 17, 24, K('brass', 2)); c.HL(4, 24, 24, K('brass', 1))
    c.ell(16, 11, 12, 6, K('copper', 3)); c.ell(16, 11, 9, 4, K('copper', 2)); c.ell(16, 10, 4, 1.8, K('brass', 3)); c.R(15, 3, 3, 4, K('iron', 1)); c.outline()


@piece('sky-a-anchor-box', '닻 보관함', 1, 1, 'box', 'A', solid=[(0, 0)], tags=['prop'])
def _(c):
    box(c, 1, 2, 14, 6, 7, 'iron', 1, 'plate', seed=15); c.line(5, 11, 11, 11, K('brass', 3)); c.line(8, 9, 8, 13, K('brass', 3)); c.outline()


@piece('sky-a-water-tank', '지붕 물탱크', 2, 2, 'round_body', 'A', solid=[(0, 1), (1, 1)], tags=['prop'])
def _(c):
    face(c, 6, 14, 20, 12, 'wood', 1, 'plank', seed=19); c.HL(6, 17, 20, K('iron', 2)); c.HL(6, 22, 20, K('iron', 1))
    c.ell(16, 12, 10, 5, K('wood', 3)); c.ell(16, 12, 7, 3, K('sky', 1)); c.VL(7, 26, 5, K('iron', 0)); c.VL(24, 26, 5, K('iron', 0)); c.outline()


@piece('sky-a-cargo-net', '화물 그물 더미', 1, 1, 'box', 'A', solid=[(0, 0)], tags=['prop'])
def _(c):
    box(c, 1, 3, 14, 6, 7, 'canvas', 1, 'plain', seed=21)
    for i in range(3, 14, 3): c.VL(i, 9, 7, K('wood', -2))
    for j in (11, 14): c.HL(2, j, 12, K('wood', -2))
    c.outline()


@piece('sky-a-tree-sky', '섬 나무', 2, 3, 'organic', 'A', solid=[(0, 2), (1, 2)], tags=['prop'])
def _(c):
    c.R(14, 28, 5, 18, K('wood', 0)); c.VL(14, 28, 18, K('wood', 2)); c.VL(18, 28, 18, K('wood', -2))
    tex_ell(c, 16, 18, 14, 14, 'grass', 0, seed=22); tex_ell(c, 10, 22, 8, 8, 'grass', 0, seed=23); c.outline()


@piece('sky-a-bush', '덤불', 1, 1, 'organic', 'A', solid=[(0, 0)], tags=['prop'])
def _(c): tex_ell(c, 8, 9, 7, 5, 'grass', 0, seed=24); c.outline()


@piece('sky-a-flowers', '들꽃', 1, 1, 'organic', 'A', solid=[], tags=['prop'])
def _(c):
    for i, (x, y, col) in enumerate([(3, 10, 'red'), (7, 7, 'brass'), (11, 11, 'cloud'), (5, 13, 'cloud'), (12, 6, 'red')]):
        c.VL(x, y + 1, 4, K('grass', -1)); c.P(x, y, K(col, 3)); c.P(x - 1, y, K(col, 1)); c.P(x + 1, y, K(col, 1)); c.P(x, y - 1, K(col, 2))
    c.outline()


@piece('sky-a-cloud-puff', '구름 덩이', 2, 1, 'organic', 'A', solid=[], tags=['prop', 'overlay'])
def _(c):
    tex_ell(c, 11, 9, 10, 5, 'cloud', 1, seed=25, light=(-.2, -.8)); tex_ell(c, 21, 8, 8, 5, 'cloud', 1, seed=26, light=(-.2, -.8))
    tex_ell(c, 16, 6, 8, 4, 'cloud', 2, seed=27, light=(-.2, -.8))


@piece('sky-a-cloud-mist', '구름 안개', 2, 1, 'organic', 'A', solid=[], tags=['prop', 'overlay'])
def _(c):
    for k in range(5): tex_ell(c, 5 + k * 5, 9 - (k % 2) * 2, 5, 3, 'cloud', 0 + (k % 2), seed=28 + k, light=(-.1, -.9))


@piece('sky-a-pulley-crane', '도르래 기중기', 2, 2, 'frame', 'A', solid=[(0, 1)], tags=['prop'])
def _(c):
    box(c, 3, 22, 10, 5, 5, 'iron', 1, 'plate', seed=29); face(c, 6, 8, 4, 16, 'iron', 1, 'plate', seed=30)
    box(c, 5, 4, 26, 4, 3, 'brass', 1, 'plate', taper=.2, seed=31); c.VL(28, 11, 12, K('iron', 1)); box(c, 25, 22, 8, 4, 4, 'wood', 1, 'plank', seed=32); c.outline()


@piece('sky-a-watch-hut', '감시 오두막', 2, 2, 'structure', 'A', solid=[(0, 1), (1, 1)], tags=['house'])
def _(c):
    face(c, 4, 15, 24, 15, 'wood', 1, 'plank', seed=37); window(c, 8, 19, 4, 5, True); door(c, 18, 21, 5, 9)
    roof(c, 1, 3, 30, 12, 'red', 1, seed=38); c.outline()


if __name__ == '__main__': run_cli('A')
