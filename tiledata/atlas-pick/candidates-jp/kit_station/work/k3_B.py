#!/usr/bin/env python3
"""k3-B: 강한 명암·그림자. 어두운 화강암 처마 + 남색 간판판(흰 글자) + 짙은 계단."""
from k3lib import *
sh = Sheet()
def W(t): return K('mwhite', t)
def C(t): return K('mconc', t)
def M(t): return K('mmetal', t)
def G(t): return K('kgreen', t)
def Y(t): return K('myellow', t)
def N(t): return K('mnavy', t)
def D(t): return K('mdglass', t)
def GL(t): return K('mglass', t)
def GR(t): return K('mgran', t)
def PV(t): return K('mpave', t)
def O(t): return K('mout', t)

# 처마: 위 4 밝음 / 앞 7 한 단 어둡게 / 아랫줄 1 / 그늘 3 (깊은 그림자)
def canopy(slug, end):
    p = P(sh, slug)
    p.stack([(1, GR(6)), (3, GR(5)), (1, GR(3)), (7, GR(4)), (1, GR(3)), (1, GR(2)), (1, GR(1)), (1, GR(0))])
    p.col(7, 5, 12, GR(3)); p.col(8, 5, 12, GR(5))
    if end == 'l':
        p.col(0, 0, 4, W(2)); p.col(0, 4, 14, GR(5)); p.col(1, 5, 12, GR(5))
    if end == 'r':
        p.col(15, 0, 4, GR(3)); p.col(15, 4, 14, GR(2)); p.col(14, 5, 12, GR(3)); p.col(15, 14, 16, GR(0))
canopy('can_l', 'l'); canopy('can_m', None); canopy('can_r', 'r')

# 간판 띠: 0~1 초록 줄 / 2 윗테 / 3~12 남색판 / 13 아랫테 / 14~15 그늘
def band(slug, end=None):
    p = P(sh, slug)
    p.stack([(1, G(4)), (1, G(2)), (1, M(4)), (10, N(2)), (1, M(2)), (1, GR(1)), (1, GR(0))])
    if end == 'l':
        p.col(0, 2, 14, M(4)); p.col(1, 3, 13, N(4))
    if end == 'r':
        p.col(15, 2, 14, M(1)); p.col(14, 3, 13, N(1)); p.col(15, 14, 16, GR(0))
    return p
band('sign_l', 'l'); band('sign_r', 'r')
p = band('sign_m')
p.col(7, 3, 13, N(1)); p.col(8, 3, 13, N(3))
for xy in ((3, 6), (3, 9), (11, 6), (11, 9)): p.px(*xy, N(4))

EKI_L = ['XXX', 'X.X', 'XXX', 'X.X', 'X.X']
EKI_R = ['XXX', 'X..', 'XXX', 'X.X', 'X.X']
p = band('sign_eki')
p.bits(1, 3, EKI_L, W(5), 2); p.bits(9, 3, EKI_R, W(5), 2)

p = band('sign_exit')
p.rect(1, 2, 14, 12, Y(3)); p.rect(1, 2, 14, 1, Y(5)); p.col(1, 2, 14, Y(4)); p.rect(1, 13, 14, 1, Y(0)); p.col(14, 3, 14, Y(1))
DIGIT = ['.XXXX.', 'XX..XX', '....XX', '...XX.', '..XX..', '.XX...', 'XX....', 'XXXXXX']
p.bits(5, 4, DIGIT, N(0))

# 기둥·옆벽: 짙은 콘크리트 + 굵은 그늘
def wall(p, x0=0, x1=16):
    p.stack([(1, C(0)), (1, C(1)), (27, C(3)), (1, C(4)), (1, C(2)), (1, C(0))], x0, x1)
    for y in (9, 17, 25): p.rect(x0, y, x1 - x0, 1, C(2))
p = P(sh, 'pil'); wall(p); p.col(7, 2, 29, C(2)); p.col(15, 2, 29, C(2)); p.col(6, 2, 29, C(4)); p.col(8, 2, 29, C(4))
p = P(sh, 'side_l'); wall(p)
p.col(0, 2, 29, C(5)); p.col(1, 2, 29, C(4)); p.col(13, 2, 29, C(2)); p.col(14, 2, 29, C(1)); p.col(15, 2, 32, C(0))
p = P(sh, 'side_r'); wall(p)
p.col(0, 2, 32, C(0)); p.col(1, 2, 29, C(1)); p.col(2, 2, 29, C(2)); p.col(14, 2, 29, C(4)); p.col(15, 2, 32, C(2))

# 입구 안쪽: 매우 어둡고 천장등 하나, 빛 원뿔
p = P(sh, 'open_back')
p.stack([(3, O(0)), (9, D(1)), (1, D(2)), (3, O(0))])
p.rect(5, 3, 6, 1, W(4)); p.rect(6, 4, 4, 1, W(3)); p.col(4, 3, 5, D(5)); p.col(11, 3, 5, D(5))
p.rect(5, 5, 6, 1, D(4)); p.rect(6, 6, 4, 1, D(3)); p.rect(7, 7, 2, 1, D(2))

# 계단: 앞코 밝고 챌판 아주 어둡게, 안쪽(위)일수록 어둡게
p = P(sh, 'stairs')
NOSE = [4, 5, 5, 6]; TREAD = [2, 3, 3, 4]; RISE = [0, 0, 1, 1]
for t in range(4):
    p.rect(0, t * 4, 16, 1, GR(NOSE[t])); p.rect(0, t * 4 + 1, 16, 2, GR(TREAD[t])); p.rect(0, t * 4 + 3, 16, 1, GR(RISE[t]))

p = P(sh, 'stairs_lip')
p.stack([(1, GR(6)), (1, Y(4)), (1, Y(2)), (1, PV(1)), (3, PV(4)), (4, PV(6)), (1, PV(3)), (4, PV(6))])

# 낮은 벽 (y 반복 16)
p = P(sh, 'rail_l')
cols = [C(2), W(1), W(0), W(0), W(0), W(0), W(0), C(5), C(4), M(5), M(2), C(4), C(3), C(2), C(1), C(0)]
cols = [C(3), C(5), C(4), C(4), C(4), C(4), C(4), C(4), C(3), M(6), M(3), C(3), C(2), C(1), C(0), O(0)]
for cx, c in enumerate(cols): p.col(cx, 0, 32, c)
for y0 in (7, 23):
    p.rect(7, y0, 5, 1, M(6)); p.rect(7, y0 + 1, 5, 2, M(3)); p.rect(7, y0 + 3, 5, 1, M(0))
for y0 in (0, 16): p.rect(1, y0, 7, 1, C(2))
p = P(sh, 'rail_r')
cols = [O(0), C(0), C(1), C(2), C(4), C(4), C(4), C(4), C(4), C(4), C(4), C(4), C(5), C(5), C(3), C(2)]
for cx, c in enumerate(cols): p.col(cx, 0, 32, c)
for y0 in (0, 16): p.rect(4, y0, 8, 1, C(2))

# 유리벽: 어두운 유리 + 강한 반사
p = P(sh, 'glass_wall')
p.stack([(1, M(1)), (1, M(2)), (1, M(4)), (1, M(2)), (2, GL(2)), (21, D(4)), (1, M(3)), (1, M(1)), (1, C(2)), (1, C(1)), (1, C(0))])
p.col(7, 4, 27, M(3)); p.col(8, 4, 27, M(1))
for i in range(6): p.px(2 + i, 14 - i, GL(5)); p.px(3 + i, 14 - i, GL(6))
for i in range(4): p.px(9 + i, 21 - i, GL(4))
for x in (3, 4, 5, 10, 11, 12): p.px(x, 21, GL(6)); p.px(x, 22, GL(4))
p.col(0, 4, 27, D(3)); p.col(15, 4, 27, D(2))

def door(slug, L):
    p = P(sh, slug)
    p.stack([(1, M(1)), (1, M(2)), (1, M(4)), (1, M(2)), (3, GL(2)), (20, D(4)), (1, M(3)), (1, M(1)), (1, C(2)), (1, C(1)), (1, C(0))])
    if L:
        p.col(0, 2, 29, M(5)); p.col(1, 2, 29, M(2)); p.col(14, 2, 29, M(2)); p.col(15, 2, 29, M(3))
    else:
        p.col(0, 2, 29, M(3)); p.col(1, 2, 29, M(2)); p.col(14, 2, 29, M(2)); p.col(15, 2, 29, M(1))
    for i in range(5): p.px((3 if L else 5) + i, 15 - i, GL(5)); p.px((4 if L else 6) + i, 15 - i, GL(6))
    hx = 12 if L else 3
    p.col(hx, 13, 21, M(6)); p.col(hx + 1, 13, 21, M(1))
    p.rect(2, 26, 12, 1, D(2)); p.rect(2, 27, 12, 1, M(3))
door('door_l', True); door('door_r', False)

export(sh, 'k3-B.pxg', 'kit_station k3-B (강한 명암: 어두운 화강암 처마·남색 간판판·짙은 계단)')
