#!/usr/bin/env python3
"""k3-A: 강남 조각 결(mconc·mwhite·mmetal). 흰 콘크리트 처마·초록 띠·화강암 계단."""
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

# ── 처마 지붕판: 위 4 밝은 면 / 앞두께 7(한 단 어둡게) / 아랫줄 2 / 그늘 2 ──
def canopy(slug, end):
    p = P(sh, slug)
    p.stack([(1, W(4)), (3, W(3)), (1, C(5)), (7, W(2)), (1, C(4)), (1, C(3)), (1, C(1)), (1, C(0))])
    p.col(7, 5, 12, W(1)); p.col(8, 5, 12, W(3))       # 판 이음 (x 반복: 16칸에 한 줄)
    if end == 'l':
        p.col(0, 0, 4, W(5)); p.col(0, 4, 14, W(4)); p.col(1, 5, 12, W(3))
    if end == 'r':
        p.col(15, 0, 4, W(2)); p.col(15, 4, 14, C(3)); p.col(14, 5, 12, W(1)); p.col(15, 14, 16, C(0))
canopy('can_l', 'l'); canopy('can_m', None); canopy('can_r', 'r')

# ── 간판 띠: 0~1 초록 줄 / 2 윗테 / 3~12 판 / 13 아랫테 / 14~15 그늘 ──
def band(slug, end=None, board=W(3)):
    p = P(sh, slug)
    p.stack([(1, G(4)), (1, G(3)), (1, W(4)), (10, board), (1, W(1)), (1, C(2)), (1, C(1))])
    if end == 'l':
        p.col(0, 2, 14, C(4)); p.col(1, 3, 13, W(4))
    if end == 'r':
        p.col(15, 2, 14, C(2)); p.col(14, 3, 13, W(1)); p.col(15, 14, 16, C(0))
    return p
band('sign_l', 'l'); band('sign_r', 'r')
p = band('sign_m')
p.col(7, 3, 13, W(2)); p.px(3, 6, C(4)); p.px(3, 9, C(4)); p.px(11, 6, C(4)); p.px(11, 9, C(4))

# 駅: 2px 획 (7×5 단위 = 14×10)
EKI_L = ['XXX', 'X.X', 'XXX', 'X.X', 'X.X']
EKI_R = ['XXX', 'X..', 'XXX', 'X.X', 'X.X']
p = band('sign_eki')
p.bits(1, 3, EKI_L, N(1), 2); p.bits(9, 3, EKI_R, N(1), 2)

# 출구: 노랑 상자 + 숫자 2 (8행 6열, 2px 획)
p = band('sign_exit')
p.rect(1, 2, 14, 12, Y(3)); p.rect(1, 2, 14, 1, Y(4)); p.col(1, 2, 14, Y(4)); p.rect(1, 13, 14, 1, Y(1)); p.col(14, 3, 14, Y(2))
p.rect(1, 2, 1, 1, W(4))
DIGIT = ['.XXXX.', 'XX..XX', '....XX', '...XX.', '..XX..', '.XX...', 'XX....', 'XXXXXX']
p.bits(5, 4, DIGIT, N(0))

# ── 기둥 / 옆벽 (16×32): 0~1 그늘 / 2~28 벽 / 29~31 문턱 ──
def wall(p, x0=0, x1=16):
    p.stack([(1, C(1)), (1, C(2)), (27, W(2)), (1, C(4)), (1, C(3)), (1, C(2))], x0, x1)
    for y in (9, 17, 25): p.rect(x0, y, x1 - x0, 1, W(1))
p = P(sh, 'pil'); wall(p); p.col(7, 2, 29, W(1)); p.col(15, 2, 29, W(1)); p.col(6, 2, 29, W(3))
p = P(sh, 'side_l'); wall(p)
p.col(0, 2, 29, W(4)); p.col(1, 2, 29, W(3)); p.col(14, 2, 29, C(3)); p.col(15, 2, 32, C(1))
p = P(sh, 'side_r'); wall(p)
p.col(0, 2, 32, C(1)); p.col(1, 2, 29, C(3)); p.col(14, 2, 29, W(1)); p.col(15, 2, 32, C(3))

# ── 입구 안쪽 (16×16): 어두운 굴 입구, 천장등 하나 ──
p = P(sh, 'open_back')
p.stack([(2, K('mout', 0)), (10, D(2)), (1, D(3)), (3, D(1))])
p.rect(6, 2, 4, 1, W(4)); p.rect(6, 3, 4, 1, W(3)); p.col(5, 2, 4, D(5)); p.col(10, 2, 4, D(5))
p.rect(6, 4, 4, 1, D(4)); p.rect(7, 5, 2, 1, D(3))

# ── 계단 (ground xy): 4칸 × 마루 4행 [뒷코 / 발판 2 / 챌판], 안쪽일수록 어둡게 ──
p = P(sh, 'stairs')
NOSE = [3, 4, 4, 5]; TREAD = [2, 3, 3, 4]; RISE = [1, 1, 1, 2]
for t in range(4):
    p.rect(0, t * 4, 16, 1, GR(NOSE[t])); p.rect(0, t * 4 + 1, 16, 2, GR(TREAD[t])); p.rect(0, t * 4 + 3, 16, 1, GR(RISE[t]))

# ── 계단 턱: 미끄럼 방지 노랑 줄 → 보도 색 ──
p = P(sh, 'stairs_lip')
p.stack([(1, GR(5)), (1, Y(3)), (1, Y(2)), (1, PV(2)), (3, PV(5)), (4, PV(6)), (1, PV(3)), (4, PV(6))])

# ── 낮은 벽 (16×32, y 반복 16) ──
p = P(sh, 'rail_l')
p.rect(0, 0, 16, 32, C(4))
for cx, t in ((0, 2), (1, 5), (2, 4), (3, 4), (4, 4), (5, 4), (6, 4), (7, 4), (8, 3), (11, 3), (12, 3), (13, 2), (14, 1), (15, 0)):
    p.col(cx, 0, 32, C(t) if t else C(1))
p.col(0, 0, 32, C(2)); p.col(1, 0, 32, W(4)); p.col(2, 0, 32, W(3))
for cx in (3, 4, 5, 6, 7): p.col(cx, 0, 32, W(2))
p.col(8, 0, 32, W(1)); p.col(9, 0, 32, M(5)); p.col(10, 0, 32, M(3)); p.col(11, 0, 32, W(1)); p.col(12, 0, 32, C(4)); p.col(13, 0, 32, C(3)); p.col(14, 0, 32, C(2)); p.col(15, 0, 32, C(1))
for y0 in (7, 23):  # 난간 기둥 (16칸 주기)
    p.rect(7, y0, 5, 1, M(5)); p.rect(7, y0 + 1, 5, 2, M(3)); p.rect(7, y0 + 3, 5, 1, M(1))
for y0 in (0, 16): p.rect(1, y0, 7, 1, W(1))     # 이음
p = P(sh, 'rail_r')
for cx, c in enumerate([C(1), C(2), C(3), C(4), W(3), W(3), W(3), W(3), W(3), W(3), W(3), W(3), W(2), W(1), C(3), C(2)]):
    p.col(cx, 0, 32, c)
for y0 in (0, 16): p.rect(4, y0, 8, 1, W(1))

# ── 유리벽 (16×32) ──
p = P(sh, 'glass_wall')
p.stack([(1, C(1)), (1, C(2)), (1, M(5)), (1, M(3)), (2, GL(3)), (21, GL(2)), (1, M(4)), (1, M(3)), (1, C(4)), (1, C(3)), (1, C(2))])
p.col(7, 4, 27, M(4)); p.col(8, 4, 27, M(2))
for i in range(6): p.px(2 + i, 14 - i, GL(4)); p.px(3 + i, 14 - i, GL(5))
for i in range(4): p.px(9 + i, 21 - i, GL(4))
for x in (3, 4, 5, 10, 11, 12): p.px(x, 21, GL(6)); p.px(x, 22, GL(4))         # 개찰구 불빛(희미)
p.col(0, 4, 27, GL(2)); p.col(15, 4, 27, GL(2))

# ── 자동문 (16×32) ──
def door(slug, L):
    p = P(sh, slug)
    p.stack([(1, C(1)), (1, C(2)), (1, M(5)), (1, M(3)), (3, GL(3)), (20, GL(2)), (1, M(4)), (1, M(3)), (1, C(4)), (1, C(3)), (1, C(2))])
    # 세로 틀
    if L:
        p.col(0, 2, 29, M(5)); p.col(1, 2, 29, M(3)); p.col(14, 2, 29, M(3)); p.col(15, 2, 29, M(4))
    else:
        p.col(0, 2, 29, M(4)); p.col(1, 2, 29, M(3)); p.col(14, 2, 29, M(3)); p.col(15, 2, 29, M(2))
    for i in range(5): p.px((3 if L else 5) + i, 15 - i, GL(4)); p.px((4 if L else 6) + i, 15 - i, GL(5))
    hx = 12 if L else 3
    p.col(hx, 13, 21, M(5)); p.col(hx + 1, 13, 21, M(2))
    p.rect(2, 26, 12, 1, GL(1)); p.rect(2, 27, 12, 1, M(4))
door('door_l', True); door('door_r', False)

export(sh, 'k3-A.pxg', 'kit_station k3-A (강남 조각 결: 흰 콘크리트 처마·초록 띠·화강암 계단)')
