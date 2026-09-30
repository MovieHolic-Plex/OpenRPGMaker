#!/usr/bin/env python3
"""k3-C: 붉은 벽돌 유산 결. 벽돌 처마(이빨 장식)·크림 간판판·벽돌 줄눈 벽·따뜻한 돌계단(3단)."""
from k3lib import *
sh = Sheet()
def B(t): return K('mbrick', t)
def T(t): return K('mtile', t)
def M(t): return K('mmetal', t)
def G(t): return K('kgreen', t)
def Y(t): return K('myellow', t)
def GL(t): return K('mglass', t)
def PV(t): return K('mpave', t)
def O(t): return K('mout', t)
def W(t): return K('mwhite', t)

# 처마: 위 4 크림 돌 / 앞 7 벽돌(이빨 장식) / 아랫줄 / 그늘 2
def canopy(slug, end):
    p = P(sh, slug)
    p.stack([(1, T(5)), (3, T(4)), (1, T(2)), (7, B(3)), (1, B(2)), (1, B(1)), (2, B(0))])
    for x in range(0, 16, 4): p.rect(x, 5, 2, 1, B(4)) ; p.rect(x + 2, 5, 2, 1, B(2))   # 이빨 장식 (주기 4)
    if end == 'l':
        p.col(0, 0, 5, T(5)); p.col(0, 5, 14, B(4)); p.col(1, 6, 12, B(3))
    if end == 'r':
        p.col(15, 0, 5, T(2)); p.col(15, 5, 14, B(1)); p.col(14, 6, 12, B(2)); p.col(15, 14, 16, B(0))
canopy('can_l', 'l'); canopy('can_m', None); canopy('can_r', 'r')

# 간판 띠: 초록 줄 2 / 윗테 / 크림 판 10 / 아랫테 / 그늘 2
def band(slug, end=None):
    p = P(sh, slug)
    p.stack([(1, G(4)), (1, G(3)), (1, T(5)), (10, T(4)), (1, T(1)), (1, B(2)), (1, B(1))])
    if end == 'l':
        p.col(0, 2, 14, B(4)); p.col(1, 3, 13, T(5))
    if end == 'r':
        p.col(15, 2, 14, B(1)); p.col(14, 3, 13, T(2)); p.col(15, 14, 16, B(0))
    return p
band('sign_l', 'l'); band('sign_r', 'r')
p = band('sign_m')
p.col(7, 3, 13, T(3)); p.col(8, 3, 13, T(5))
for xy in ((3, 6), (3, 9), (11, 6), (11, 9)): p.px(*xy, B(3))

EKI_L = ['XXX', 'X.X', 'XXX', 'X.X', 'X.X']
EKI_R = ['XXX', 'X..', 'XXX', 'X.X', 'X.X']
p = band('sign_eki')
p.bits(1, 3, EKI_L, B(1), 2); p.bits(9, 3, EKI_R, B(1), 2)
p = band('sign_exit')
p.rect(1, 2, 14, 12, Y(3)); p.rect(1, 2, 14, 1, Y(4)); p.col(1, 2, 14, Y(4)); p.rect(1, 13, 14, 1, Y(1)); p.col(14, 3, 14, Y(2))
DIGIT = ['.XXXX.', 'XX..XX', '....XX', '...XX.', '..XX..', '.XX...', 'XX....', 'XXXXXX']
p.bits(5, 4, DIGIT, B(0))

# 벽돌 줄눈: 4행 주기(3행 벽돌+1행 줄눈), 8칸 벽돌, 줄마다 4칸 엇갈림 (x·y 주기 모두 16의 약수)
def brick(y, x):
    if y % 4 == 3: return T(1)
    off = 0 if (y // 4) % 2 == 0 else 4
    if (x - off) % 8 == 0: return T(1)
    return B(4) if y % 4 == 0 else B(3)
def wall(p, x0=0, x1=16):
    for y in range(32):
        for x in range(x0, x1): p.px(x, y, brick(y, x))
    p.rect(x0, 0, x1 - x0, 1, B(1)); p.rect(x0, 1, x1 - x0, 1, B(2))         # 처마 밑 그늘
    p.rect(x0, 29, x1 - x0, 1, T(4)); p.rect(x0, 30, x1 - x0, 1, T(3)); p.rect(x0, 31, x1 - x0, 1, T(1))  # 돌 밑동
p = P(sh, 'pil'); wall(p)
p = P(sh, 'side_l'); wall(p)
p.col(0, 2, 29, T(4)); p.col(1, 2, 29, T(3)); p.col(14, 2, 29, B(2)); p.col(15, 2, 32, B(1))
p = P(sh, 'side_r'); wall(p)
p.col(0, 2, 32, B(1)); p.col(1, 2, 29, B(2)); p.col(14, 2, 29, T(3)); p.col(15, 2, 32, T(1))

# 입구 안쪽: 어두운 벽돌 굴, 따뜻한 등 하나
p = P(sh, 'open_back')
p.stack([(2, O(0)), (10, B(0)), (1, B(1)), (3, O(0))])
p.rect(6, 2, 4, 1, T(5)); p.rect(6, 3, 4, 1, T(4)); p.col(5, 2, 4, B(2)); p.col(10, 2, 4, B(2))
p.rect(6, 4, 4, 1, B(2)); p.rect(7, 5, 2, 1, B(1))

# 계단: 따뜻한 돌계단 3단 (5·5·6행), 안쪽(위)일수록 어둡게
p = P(sh, 'stairs')
NOSE = [3, 4, 5]; TREAD = [1, 3, 4]; RISE = [0, 1, 2]; ROWS = [5, 5, 6]
y = 0
for t in range(3):
    n = ROWS[t]
    p.rect(0, y, 16, 1, T(NOSE[t])); p.rect(0, y + 1, 16, n - 2, T(TREAD[t])); p.rect(0, y + n - 1, 16, 1, T(RISE[t])); y += n

p = P(sh, 'stairs_lip')
p.stack([(1, T(5)), (1, Y(3)), (1, Y(2)), (1, PV(2)), (3, PV(5)), (4, PV(6)), (1, PV(3)), (4, PV(6))])

# 낮은 벽: 벽돌 몸 + 돌 갓돌 (y 반복 16)
p = P(sh, 'rail_l')
for x in range(16):
    for y in range(32): p.px(x, y, brick(y, x))
for cx, c in enumerate([B(1), T(5), T(4), T(3)]): p.col(cx, 0, 32, c)
p.col(9, 0, 32, M(5)); p.col(10, 0, 32, M(3)); p.col(11, 0, 32, B(2))
for cx, c in ((12, B(2)), (13, B(1)), (14, B(0)), (15, O(0))): p.col(cx, 0, 32, c)
for y0 in (7, 23):
    p.rect(7, y0, 5, 1, M(5)); p.rect(7, y0 + 1, 5, 2, M(3)); p.rect(7, y0 + 3, 5, 1, M(1))
p = P(sh, 'rail_r')
for x in range(16):
    for y in range(32): p.px(x, y, brick(y, x))
for cx, c in ((0, B(0)), (1, B(1)), (2, B(2)), (12, T(3)), (13, T(5)), (14, T(4)), (15, T(1))): p.col(cx, 0, 32, c)

# 유리벽: 벽돌빛 틀 + 가로살
p = P(sh, 'glass_wall')
p.stack([(1, B(1)), (1, B(2)), (1, T(3)), (1, T(1)), (2, GL(3)), (21, GL(2)), (1, T(1)), (1, B(2)), (1, B(1)), (1, B(0)), (1, B(0))])
p.col(7, 4, 27, B(2)); p.col(8, 4, 27, B(1)); p.rect(0, 13, 16, 1, B(2)); p.rect(0, 14, 16, 1, B(1))
for i in range(5): p.px(2 + i, 11 - i, GL(4)); p.px(3 + i, 11 - i, GL(5))
for i in range(4): p.px(10 + i, 21 - i, GL(4))
for x in (3, 4, 5, 10, 11, 12): p.px(x, 22, GL(6)); p.px(x, 23, GL(4))
p.col(0, 4, 27, B(2)); p.col(15, 4, 27, B(2))

def door(slug, L):
    p = P(sh, slug)
    p.stack([(1, B(1)), (1, B(2)), (1, T(3)), (1, T(1)), (3, GL(3)), (20, GL(2)), (1, T(1)), (1, B(2)), (1, B(1)), (1, B(0)), (1, B(0))])
    if L:
        p.col(0, 2, 29, B(4)); p.col(1, 2, 29, B(2)); p.col(14, 2, 29, B(2)); p.col(15, 2, 29, B(1))
    else:
        p.col(0, 2, 29, B(1)); p.col(1, 2, 29, B(2)); p.col(14, 2, 29, B(2)); p.col(15, 2, 29, B(0))
    p.rect(2, 18, 12, 1, B(2)); p.rect(2, 19, 12, 1, B(1))                          # 가로살
    for i in range(5): p.px((3 if L else 5) + i, 15 - i, GL(4)); p.px((4 if L else 6) + i, 15 - i, GL(5))
    hx = 12 if L else 3
    p.col(hx, 21, 27, M(5)); p.col(hx + 1, 21, 27, M(2))
door('door_l', True); door('door_r', False)

export(sh, 'k3-C.pxg', 'kit_station k3-C (붉은 벽돌 유산 결: 벽돌 처마·크림 간판판·벽돌 줄눈 벽·따뜻한 돌계단)')
