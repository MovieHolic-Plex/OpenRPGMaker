"""줄 A — 2라운드: 가는 기둥류는 깊은 윗면 받침(plinth) 위에 세운다. 애니메이션은 통째 조립(윗면 지붕·갑판이 관문을 통과)."""
from __future__ import annotations
import math
from sky_a_lib import *


@piece('sky-a-bollard', '계류 기둥', 1, 1, 'column', 'A', solid=[(0, 0)], tags=['prop'])
def _(c):
    plinth(c, 1, 6, 14, 'iron', 6, 4, 1, 'plate', seed=14)
    face(c, 5, 4, 7, 5, 'iron', 1, 'plate', seed=15); slab(c, 4, 1, 9, 4, 'iron', 3, taper=.3, grain=False); c.HL(5, 7, 7, K('canvas', 2)); c.outline()


@piece('sky-a-signpost', '표지판', 1, 2, 'column', 'A', solid=[(0, 1)], tags=['prop'])
def _(c):
    plinth(c, 1, 19, 14, 'wood', 6, 6, 1, 'plank', seed=16)
    face(c, 7, 13, 3, 8, 'wood', 1, 'plank', seed=17); box(c, 2, 1, 13, 6, 6, 'wood', 2, 'plank', taper=.2, seed=18); c.R(4, 8, 9, 1, K('canvas', 3)); c.outline()


@piece('sky-a-chimney-stack', '굴뚝', 1, 2, 'column', 'A', solid=[(0, 1)], tags=['prop'])
def _(c):
    plinth(c, 1, 19, 14, 'soot', 6, 6, 1, 'brick', seed=20)
    face(c, 4, 10, 9, 11, 'soot', 1, 'brick', seed=21); slab(c, 3, 3, 11, 8, 'soot', 2, taper=.3, seed=22); c.HL(5, 5, 7, K('iron', -3)); c.R(6, 4, 5, 3, K('iron', -4)); c.outline()


@piece('sky-a-barrel', '통', 1, 1, 'round_body', 'A', solid=[(0, 0)], tags=['prop'])
def _(c):
    face(c, 2, 7, 12, 8, 'wood', 1, 'plank', seed=9); c.HL(2, 9, 12, K('iron', 2)); c.HL(2, 12, 12, K('iron', 1))
    c.ell(8, 6, 6.5, 4.2, K('wood', 3)); c.ell(8, 6, 4.6, 3, K('wood', -1)); c.ell(8, 5.6, 3.6, 2, K('wood', 1)); c.outline()


@piece('sky-a-telescope', '관측 망원경', 1, 1, 'other', 'A', solid=[(0, 0)], tags=['prop'])
def _(c):
    plinth(c, 1, 5, 14, 'iron', 6, 5, 1, 'plate', seed=33)
    c.line(5, 7, 12, 2, K('brass', 2)); c.line(5, 8, 12, 3, K('brass', 0)); c.R(11, 0, 3, 4, K('brass', 3)); c.outline()


@piece('sky-a-propeller-pod', '프로펠러 엔진 포드', 2, 2, 'box', 'A', solid=[], tags=['vehicle'])
def _(c):
    box(c, 2, 6, 24, 9, 10, 'brass', 1, 'plate', taper=.3, seed=36); c.R(26, 8, 4, 12, K('iron', 1)); c.VL(29, 3, 18, K('iron', 3)); c.outline()


@piece('sky-a-bridge', '구름 다리', 5, 3, 'structure', 'A', solid=[], tags=['bridge'])
def _(c):
    slab(c, 2, 12, 76, 18, 'wood', 1, taper=.12, seed=41)           # 넓은 상판 윗면
    for i in range(6, 76, 12): c.VL(i, 12, 18, K('wood', -1))        # 가로 판자 이음
    face(c, 3, 30, 74, 6, 'wood', -1, 'plank', seed=42)
    for i in range(6, 76, 14): c.R(i, 8, 3, 5, K('brass', 1)); c.P(i, 7, K('brass', 4))  # 뒤 난간 기둥
    c.HL(2, 8, 76, K('brass', 0)); c.HL(2, 9, 76, K('brass', -2))
    for i in range(0, 80, 4): c.P(i, 38, K('cloud', 2)); c.P(i + 2, 39, K('cloud', 0))
    c.outline()


@piece('sky-a-airship-anim', '비공정(프로펠러 회전)', 6, 4, 'structure', 'A', frames=4, solid=[(2, 3), (3, 3)], tags=['anim', 'vehicle'])
def _(c, f):
    tex_ell(c, 46, 18, 38, 15, 'canvas', 0, seed=3)
    for i in range(14, 80, 10): c.line(i + 2, 6, i, 30, K('canvas', -2))
    slab(c, 20, 36, 54, 9, 'wood', 1, taper=.6, seed=9); face(c, 22, 45, 50, 11, 'wood', 0, 'plank', seed=9)
    for i in range(28, 68, 7): c.P(i, 50, K('brass', 3))
    c.R(42, 33, 8, 3, K('brass', 1)); c.R(76, 40, 6, 7, K('iron', 0))
    a = f * math.pi / 4
    for s in (-1, 1): c.line(86, 44, 86, round(44 + s * 8 * abs(math.cos(a)) + s), K('iron', 3))
    c.R(84, 42, 3, 4, K('brass', 2)); c.outline()


def pillar(c, cx, base_y, w, top, h, ramp='rock', t=2, kind='stone', seed=0):
    """굵은 기둥: 윗면 top줄 + 앞면 h줄. 기둥 윗면 위에 장식이 선다. 맨 아래 받침 판 포함."""
    plinth(c, max(0, cx - w // 2 - 1), base_y, w + 2, ramp, 5, 5, t, kind, seed)
    box(c, cx - w // 2, base_y - h - top + 2, w, top, h, ramp, t, kind, taper=.3, seed=seed + 1)


@piece('sky-a-windvane', '바람개비 석주', 1, 2, 'column', 'A', solid=[(0, 1)], tags=['prop'])
def _(c):
    pillar(c, 8, 22, 10, 5, 8, 'rock', 2, seed=1)
    c.VL(8, 4, 8, K('iron', 2)); c.R(4, 2, 9, 2, K('copper', 2)); c.HL(4, 2, 9, K('copper', 4)); c.R(12, 0, 3, 4, K('red', 1)); c.outline()


@piece('sky-a-hot-air-balloon', '소형 기구', 2, 3, 'structure', 'A', solid=[(0, 2), (1, 2)], tags=['vehicle'])
def _(c):
    tex_ell(c, 16, 9, 9, 8, 'red', 0, seed=34)
    for i in (11, 16, 21): c.line(i, 3, i, 15, K('red', -2))
    for x in (9, 23): c.line(x, 15, 10 if x < 16 else 22, 22, K('wood', -2))
    box(c, 1, 21, 30, 14, 11, 'wood', 1, 'plank', taper=.25, seed=35); c.outline()


@piece('sky-a-windmill-anim', '풍차 탑(날개 회전)', 4, 4, 'structure', 'A', frames=4, solid=[(1, 3), (2, 3)], tags=['anim', 'tower'])
def _(c, f):
    face(c, 18, 28, 28, 34, 'soot', 1, 'brick', seed=8); door(c, 29, 53, 6, 9)
    roof(c, 15, 12, 34, 16, 'copper', 1, seed=3)
    ang = f * math.pi / 8; cx, cy = 32, 44
    for q in range(4):
        a = ang + q * math.pi / 2; ex, ey = cx + 17 * math.cos(a), cy + 17 * math.sin(a) * .9
        c.line(cx, cy, round(ex), round(ey), K('wood', 1)); c.line(cx + 1, cy, round(ex) + 1, round(ey), K('wood', -2))
        mx, my = cx + 11 * math.cos(a), cy + 11 * math.sin(a) * .9; c.R(round(mx) - 2, round(my) - 2, 5, 4, K('canvas', 2))
    c.R(cx - 2, cy - 2, 5, 5, K('brass', 3)); c.outline()


@piece('sky-a-lighthouse', '하늘 등대 오두막', 3, 3, 'structure', 'A', solid=[(0, 2), (1, 2), (2, 2)], tags=['tower'])
def _(c):
    face(c, 5, 26, 38, 20, 'cloud', 1, 'stone', seed=61); door(c, 22, 36, 6, 10)
    c.R(5, 32, 38, 2, K('red', 1)); window(c, 11, 36, 4, 5); window(c, 33, 36, 4, 5)
    roof(c, 2, 12, 44, 14, 'red', 1, seed=2)
    box(c, 17, 1, 14, 7, 5, 'brass', 3, 'plate', taper=.3, seed=64); c.R(19, 4, 10, 4, K('brass', 4)); c.outline()


if __name__ == '__main__': run_cli('A')
