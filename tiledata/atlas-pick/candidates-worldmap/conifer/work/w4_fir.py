import sys, os
HERE0 = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE0, '..', '..', 'forest', 'work'))
import w4lib
from w4lib import *
import copy

NARROW = {'tiers': [[1], [3, 3], [3, 5], [5, 5]], 'trunk': 2}     # C: 폭 5 뾰족 첨탑 4단
SNOW_T = lambda c, ri, half: 6 if c < 0 else (5 if c == 0 else 4)
SNOW_T_B = lambda c, ri, half: (6 if c < 0 else (5 if c == 0 else 3)) if ri == 0 else (5 if c < 0 else 4)

def A_st(snow=False):
    d = dict(ramp='wpine', top=4, edge_l=2, lit=3, mid=3, shade=2, edge_r=1, floor=1, under=1, tierhi=1, rim_lit=3, rim_mid=2, rim_dark=1)
    if snow: d.update(snow=1, snow_tone=SNOW_T, snow_reach=1)
    return d
def B_st(snow=False):
    d = dict(ramp='wpine', top=5, edge_l=3, lit=4, mid=3, shade=1, edge_r=0, floor=0, under=1, tierhi=1, apex=True, rim_lit=4, rim_mid=2, rim_dark=0)
    if snow: d.update(snow=2, snow_tone=SNOW_T_B, snow_reach=1)
    return d
def C_st(snow=False):
    d = dict(ramp='wpine', top=4, edge_l=2, lit=3, mid=3, shade=2, edge_r=0, floor=1, under=1, tierhi=1, trunk2=False, rim_lit=3, rim_mid=2, rim_dark=0)
    if snow: d.update(snow=1, snow_tone=SNOW_T, snow_reach=0)
    return d

def make_draw(shape):
    def draw(cv, cx, by, t, st): fir_tree(cv, cx, by, st, shape)
    return draw

def shadow_fn(cv):
    for y in range(cv.h):
        for x in range(cv.w):
            v = cv.a[y][x]
            if v and not isinstance(v, str) and v[0] == 'wbark' and v[1] == 1:
                below = cv.get(x, y + 1)
                if below is None: foot_shadow(cv, [(x + 1, y + 1, 3), (x - 1, y + 1, 1)])

def build(name, title, trees, st, shape, ground, iso_fn, lat, alt_kw, snow_ground=None):
    w4lib.LAT = lat
    roles, cv = bundle(trees, make_draw(shape), st, ground, [lambda c, s_: (iso_fn(c, s_), shadow_fn(c))], [], alt_st=dict(st, **alt_kw), shadow_fn=shadow_fn, title=title)
    return roles

def write(out, roles, title):
    open(out, 'w').write(to_pxg(assemble(roles), title))
