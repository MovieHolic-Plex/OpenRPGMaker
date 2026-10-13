#!/usr/bin/env python3
"""modern_campus 바닥·오토타일 조각(16px, 불투명 평면). kind=terrain. python3 terrain.py"""
from mc_core import *
R = Reg('terrain'); A = R.add


def fill(c, mat, t0=0, spec=0.0, s=0, tones=(0, 0, 1, -1)):
    for y in range(16):
        for x in range(16): c.P(x, y, K(mat, t0 + tones[hsh(x, y, s) % len(tones)]))


def tilebrick(c, ox, oy, s=0, mat='renga'):
    """붉은 벽돌 포석(8×4 엇갈림 + 변주)."""
    for j in range(4):
        for i in range(2):
            x0 = (i * 8 + (4 if j % 2 else 0)) % 16
            t = (hsh(i, j, s) % 3) - 1
            for k in range(8):
                for y in range(4):
                    c.P((x0 + k) % 16, j * 4 + y, K(mat, t + (1 if y == 0 else (-1 if y == 3 else 0)) if k < 7 else -2))


def A_(id_, name, fn, tags, w=1, h=1, rules=''):
    A(id_, name, w, h, 'terrain', tags=tags, rules=rules)(fn)


def soil(c):
    fill(c, 'soil', 0, s=1, tones=(0, 0, 0, 1, -1))
    for i in range(10): c.P(hsh(i, 1, 9) % 16, hsh(i, 2, 9) % 16, K('hodo', 2))
A_('ground-soil', '운동장 흙', soil, ['운동장', '흙'])


def turf(c):
    for y in range(16):
        for x in range(16): c.P(x, y, K('midori', (0 if (x // 4) % 2 else -1) + (hsh(x, y, 2) % 2)))
    for i in range(8): c.P(hsh(i, 3, 4) % 16, hsh(i, 4, 4) % 16, K('lino', 2))
A_('ground-turf', '인조잔디 운동장(줄무늬)', turf, ['운동장', '인조잔디'])


def paving(c): tilebrick(c, 0, 0, 1)
A_('pave-brick', '붉은 벽돌 포석', paving, ['포석', '교정'])


def paving2(c): tilebrick(c, 0, 0, 5, 'kawara')
A_('pave-brick-dark', '어두운 벽돌 포석', paving2, ['포석'])


def slab(c):
    fill(c, 'hodo', 1, s=3, tones=(0, 0, 1))
    c.HL(0, 0, 16, K('hodo', 3)); c.HL(0, 7, 16, K('hodo', -1)); c.HL(0, 8, 16, K('hodo', 3)); c.HL(0, 15, 16, K('hodo', -1))
    c.VL(0, 0, 8, K('hodo', 3)); c.VL(7, 0, 8, K('hodo', -1)); c.VL(8, 8, 8, K('hodo', 3)); c.VL(15, 8, 8, K('hodo', -1))
A_('pave-slab', '교정 화강암 판석(4분할)', slab, ['포석', '광장'])


def lawn(c):
    fill(c, 'midori', 0, s=7, tones=(0, 0, 1, 1, -1))
    for i in range(12):
        x = hsh(i, 8, 3) % 15; y = hsh(i, 9, 3) % 14; c.P(x, y, K('midori', 2)); c.P(x, y + 1, K('midori', -1))
A_('lawn', '캠퍼스 잔디', lawn, ['잔디'])


def lawn_flower(c):
    lawn(c)
    for x, y, col in ((3, 4, 'shiro'), (11, 9, 'kii'), (6, 12, 'pinku'), (13, 3, 'shiro')): c.P(x, y, K(col, 2)); c.P(x + 1, y, K(col, 1))
A_('lawn-flower', '잔디 + 들꽃', lawn_flower, ['잔디', '꽃'])


def asphalt(c): fill(c, 'yoru', -1, s=11, tones=(0, 0, 0, 1, -1)); [c.P(hsh(i, 5, 6) % 16, hsh(i, 6, 6) % 16, K('hodo', -1)) for i in range(7)]
A_('road-asphalt', '아스팔트', asphalt, ['도로'])


def road_kr(c):
    asphalt(c); c.R(0, 5, 16, 1, K('kii', 1)); c.R(0, 9, 16, 1, K('kii', 1))
A_('road-kr-center', '도로 한국식(황색 중앙 겹선)', road_kr, ['도로', '한국'])


def road_w(c):
    asphalt(c)
    c.R(1, 7, 8, 2, K('shiro', 2))
A_('road-w-dash', '도로 서양식(흰 점선 중앙)', road_w, ['도로', '서양'])


def crossing(c):
    asphalt(c)
    for x in range(1, 16, 5): c.R(x, 0, 3, 16, K('shiro', 2)); c.VL(x, 0, 16, K('shiro', 3))
A_('road-crosswalk', '횡단보도', crossing, ['도로', '횡단보도'])


def sidewalk(c):
    fill(c, 'hodo', 2, s=2, tones=(0, 0, 1))
    c.HL(0, 7, 16, K('hodo', 0)); c.HL(0, 15, 16, K('hodo', 0)); c.VL(7, 0, 8, K('hodo', 0)); c.VL(15, 8, 8, K('hodo', 0))
A_('sidewalk', '보도블록', sidewalk, ['보도'])


def tactile(c):
    fill(c, 'kii', 0, s=4, tones=(0, 0, 1))
    for y in (3, 11):
        for x in (3, 11): c.R(x - 1, y - 1, 3, 3, K('kii', -1)); c.P(x - 1, y - 1, K('kii', 2)); c.P(x, y - 1, K('kii', 2))
    for x in (3, 11): c.R(x - 1, 7, 3, 2, K('kii', -1))
    c.P(2, 7, K('kii', 2)); c.P(10, 7, K('kii', 2))
A_('tactile', '점자블록(황색)', tactile, ['보도', '점자'])


def curb(c):
    sidewalk(c); c.R(0, 12, 16, 4, K('conc', 1)); c.HL(0, 12, 16, K('conc', 3)); c.HL(0, 13, 16, K('conc', 2)); c.HL(0, 15, 16, K('conc', -2))
A_('curb-s', '연석(남쪽 도로 가장자리)', curb, ['보도', '연석'])


def edge_lawn_soil(c):
    soil(c)
    for x in range(16):
        h = 5 + (hsh(x, 1, 8) % 3)
        for y in range(h): c.P(x, y, K('midori', (1 if y < h - 2 else 0) + (hsh(x, y, 1) % 2) - 1 if y < h - 1 else -2))
A_('edge-lawn-soil', '잔디→흙 가장자리(위 잔디·아래 흙)', edge_lawn_soil, ['오토타일', '잔디', '흙'])


def edge_lawn_pave(c):
    paving(c)
    for x in range(16):
        h = 4 + (hsh(x, 2, 8) % 3)
        for y in range(h): c.P(x, y, K('midori', (hsh(x, y, 1) % 2) - (1 if y == h - 1 else 0)))
A_('edge-lawn-pave', '잔디→포석 가장자리', edge_lawn_pave, ['오토타일'])


def line_soil_h(c): soil(c); c.HL(0, 7, 16, K('shiro', 3)); c.HL(0, 8, 16, K('shiro', 2))
A_('soil-line-h', '운동장 흙 + 흰 선', line_soil_h, ['운동장', '선'])


def bed_edge(c):
    lawn(c); c.R(0, 10, 16, 6, K('soil', -1)); c.HL(0, 10, 16, K('conc', 3)); c.HL(0, 11, 16, K('conc', 1)); c.HL(0, 9, 16, K('conc', -1))
    for x in (3, 8, 13): c.P(x, 13, K('pinku', 1)); c.P(x, 12, K('midori', 1))
A_('bed-edge', '화단 가장자리(잔디 위 흙 띠)', bed_edge, ['화단', '오토타일'])


if __name__ == '__main__':
    metas, ims = R.export(); sheet(ims, os.path.join(OUT, R.group, 'preview.png'), W=300, z=4); print(len(metas), 'terrain')
