#!/usr/bin/env python3
"""k2 kit_shopfront 후보 찍기.  python3 work/k2_draw.py A|B|C  → ../k2-X.pxg
단을 손으로 놓는 사각형·선·도안뿐(보간·잡음 없음). 후보별 결: A 강남(현대 램프·같은 단), B 강한 명암·그림자, C 실루엣 재해석."""
import sys
from k2_lib import *
S = sys.argv[1]
assert S in 'ABC'
LEFT_LIT = True

# ───────── 기둥 ─────────
def pillar(left):
    p = P('pil_l' if left else 'pil_r'); front_frame(p)
    if S == 'A':
        p.rect(0, 2, 16, 27, k('mgran', 3))
        # 눌린 판: 윗·왼쪽 어둡고 아래·오른쪽 밝다
        p.rect(4, 6, 8, 19, k('mgran', 3)); p.h(4, 6, 8, k('mgran', 2)); p.v(4, 6, 19, k('mgran', 2))
        p.h(4, 24, 8, k('mgran', 4)); p.v(11, 7, 18, k('mgran', 4))
        p.rect(0, 26, 16, 3, k('mgran', 2)); p.h(0, 26, 16, k('mgran', 4))   # 걸레받이
        p.h(0, 4, 16, k('mgran', 4)); p.h(0, 5, 16, k('mgran', 2))          # 머리 줄
        if left:
            p.v(0, 2, 27, k('mgran', 6)); p.v(1, 2, 27, k('mgran', 5)); p.v(15, 2, 27, k('mgran', 2))
            p.v(14, 2, 27, k('mgran', 3))
        else:
            p.v(0, 2, 27, k('mgran', 4)); p.v(14, 2, 27, k('mgran', 1)); p.v(15, 2, 27, k('mgran', 0))
    elif S == 'B':
        p.rect(0, 2, 16, 27, k('mgran', 2))
        p.rect(0, 2, 16, 4, k('mgran', 1)); p.h(0, 6, 16, k('mgran', 1))     # 띠가 드리운 깊은 그늘
        p.rect(4, 8, 8, 17, k('mgran', 1)); p.h(4, 8, 8, k('mgran', 0)); p.v(4, 8, 17, k('mgran', 0))
        p.h(4, 24, 8, k('mgran', 3)); p.v(11, 9, 16, k('mgran', 3))
        p.rect(0, 25, 16, 4, k('mgran', 1)); p.h(0, 25, 16, k('mgran', 3))
        if left:
            p.v(0, 2, 27, k('mgran', 6)); p.v(1, 2, 27, k('mgran', 4)); p.v(2, 6, 19, k('mgran', 3))
            p.v(14, 2, 27, k('mgran', 1)); p.v(15, 2, 27, k('mgran', 0))
        else:
            p.v(0, 2, 27, k('mgran', 3)); p.v(13, 2, 27, k('mgran', 1)); p.v(14, 2, 27, k('mgran', 0)); p.v(15, 2, 27, k('mout', 0))
    else:
        # C: 옻 기둥 + 돌 받침 + 위 모두(끝 사다리꼴)
        p.rect(0, 2, 16, 27, k('lacq', 3))
        p.rect(0, 2, 16, 4, k('hinoki', 2)); p.h(0, 2, 16, k('hinoki', 1)); p.h(0, 5, 16, k('hinoki', 4))   # 얹은 보 머리
        p.h(0, 6, 16, k('lacq', 1))
        p.rect(2, 7, 12, 15, k('lacq', 3))
        for x in (5, 10): p.v(x, 7, 15, k('lacq', 4)); p.v(x + 1, 7, 15, k('lacq', 2))       # 결
        p.rect(0, 21, 16, 8, k('ishi', 3)); p.h(0, 21, 16, k('ishi', 5)); p.h(0, 22, 16, k('ishi', 4))
        p.h(0, 25, 16, k('ishi', 2)); p.h(0, 26, 16, k('ishi', 5)); p.rect(0, 27, 16, 2, k('ishi', 2))
        p.v(7, 22, 3, k('ishi', 2)); p.v(7, 26, 3, k('ishi', 1))
        if left:
            p.v(0, 7, 14, k('lacq', 6)); p.v(1, 7, 14, k('lacq', 5)); p.v(0, 21, 8, k('ishi', 6)); p.v(1, 21, 8, k('ishi', 5))
            p.v(0, 2, 4, k('hinoki', 6)); p.v(1, 2, 4, k('hinoki', 5))
            p.v(15, 7, 14, k('lacq', 2)); p.v(15, 21, 8, k('ishi', 2))
        else:
            p.v(0, 7, 14, k('lacq', 4)); p.v(0, 21, 8, k('ishi', 4))
            p.v(14, 7, 14, k('lacq', 1)); p.v(15, 7, 14, k('lacq', 0)); p.v(14, 21, 8, k('ishi', 1)); p.v(15, 21, 8, k('ishi', 0))
            p.v(14, 2, 4, k('hinoki', 1)); p.v(15, 2, 4, k('hinoki', 0))
pillar(True); pillar(False)

# ───────── 유리 창 ─────────
def frame_top_left(p, hi, lo, sill_hi, sill_lo):
    p.h(0, 2, 16, k('mmetal', hi)); p.h(0, 3, 16, k('mmetal', lo))
    p.h(0, 27, 16, k('mmetal', sill_hi)); p.h(0, 28, 16, k('mmetal', sill_lo))

p = P('win_glass'); front_frame(p)
if S == 'A':
    frame_top_left(p, 6, 3, 5, 2)
    p.rect(0, 4, 16, 23, k('mdglass', 2)); p.rect(0, 4, 16, 3, k('mdglass', 3)); p.h(0, 24, 16, k('mdglass', 1)); p.rect(0, 25, 16, 2, k('mdglass', 1))
    p.v(0, 4, 23, k('mmetal', 4)); p.v(1, 4, 23, k('mglass', 1))
    for y in (13, 19):                                    # 어둠 속 진열대 선
        p.h(2, y, 13, k('mdglass', 3)); p.h(2, y + 1, 13, k('mdglass', 1))
    for x, y, c in ((3, 11, 4), (6, 11, 3), (10, 10, 4), (13, 11, 3), (4, 17, 3), (8, 17, 4), (11, 17, 3)):
        p.rect(x, y, 2, 2, k('mdglass', c))
    for i in range(7): p.px(4 + i, 15 - i, k('mglass', 4)); p.px(5 + i, 15 - i, k('mglass', 3))
    for i in range(4): p.px(9 + i, 24 - i, k('mglass', 3))
elif S == 'B':
    frame_top_left(p, 5, 2, 4, 1)
    p.rect(0, 4, 16, 23, k('mdglass', 1)); p.rect(0, 4, 16, 3, k('mdglass', 3)); p.rect(0, 22, 16, 5, k('mdglass', 0))
    p.h(0, 7, 16, k('mdglass', 2))
    p.v(0, 4, 23, k('mmetal', 4)); p.v(1, 4, 23, k('mglass', 0))
    # 안쪽 형광등 반사와 진열대
    p.h(3, 5, 10, k('mglass', 5)); p.h(3, 6, 10, k('mdglass', 4))
    for y in (14, 20): p.h(3, y, 12, k('mdglass', 4)); p.h(3, y + 1, 12, k('mdglass', 0))
    for x, y, c in ((4, 12, 5), (7, 11, 4), (11, 12, 5), (5, 18, 4), (9, 18, 5)): p.rect(x, y, 2, 2, k('mdglass', c))
    for i in range(9): p.px(3 + i, 17 - i, k('mglass', 6)); p.px(4 + i, 17 - i, k('mglass', 5)); p.px(5 + i, 17 - i, k('mglass', 3))
    for i in range(4): p.px(10 + i, 24 - i, k('mglass', 4))
else:
    # C: 아랫 사분 널판 + 위 유리 + 가로 살(가로 창틀)
    frame_top_left(p, 5, 3, 4, 2)
    p.rect(0, 4, 16, 23, k('mdglass', 2)); p.rect(0, 4, 16, 2, k('mdglass', 4))
    p.rect(0, 17, 16, 10, k('mwood', 2)); p.h(0, 17, 16, k('mwood', 4)); p.h(0, 18, 16, k('mwood', 1))    # 널판
    for x in (0, 8): p.v(x, 19, 8, k('mwood', 1)); p.v(x + 1, 19, 8, k('mwood', 3))
    p.h(0, 26, 16, k('mwood', 1))
    p.v(0, 4, 13, k('mmetal', 4)); p.v(1, 4, 13, k('mglass', 1))
    p.h(1, 10, 15, k('mmetal', 3)); p.h(1, 11, 15, k('mdglass', 1))
    for i in range(6): p.px(3 + i, 9 - i, k('mglass', 4)); p.px(4 + i, 9 - i, k('mglass', 3))
    for i in range(5): p.px(7 + i, 16 - i, k('mglass', 3))

# ───────── 진열창(밝은 가게 안) ─────────
p = P('win_shelf'); front_frame(p)
GOODS = {'a': 'kblue', 'b': 'akachin', 'c': 'kgreen', 'd': 'taxi', 'e': 'korange', 'f': 'mwhite', 'g': 'neon'}
def goods(p, x, y, kind, col, dark=False):
    c = GOODS.get(col, col)
    if kind == 'bottle':   # 2×5 병
        p.rect(x, y + 2, 2, 3, k(c, 3)); p.px(x, y + 2, k(c, 5)); p.px(x, y + 3, k(c, 4)); p.rect(x, y, 2, 2, k('mwhite', 3)); p.px(x, y + 1, k('mwhite', 5))
        p.px(x + 1, y + 4, k(c, 2))
    elif kind == 'box':    # 3×4 상자
        p.rect(x, y, 3, 4, k(c, 3)); p.h(x, y, 3, k(c, 5)); p.v(x, y, 4, k(c, 4)); p.v(x + 2, y + 1, 3, k(c, 2)); p.px(x + 1, y + 2, k('mwhite', 4))
    elif kind == 'can':    # 2×3 캔
        p.rect(x, y, 2, 3, k(c, 3)); p.px(x, y, k('mwhite', 5)); p.px(x, y + 1, k(c, 4)); p.px(x + 1, y + 2, k(c, 2)); p.px(x + 1, y, k('mwhite', 3))
    elif kind == 'mag':    # 4×5 잡지
        p.rect(x, y, 4, 5, k(c, 3)); p.h(x, y, 4, k(c, 5)); p.v(x, y, 5, k(c, 4)); p.v(x + 3, y + 1, 4, k(c, 2)); p.h(x + 1, y + 2, 2, k('mwhite', 4))
if S == 'A':
    frame_top_left(p, 6, 3, 5, 2)
    p.rect(0, 4, 16, 23, k('mwhite', 3)); p.rect(0, 4, 16, 2, k('mwhite', 5)); p.h(0, 6, 16, k('mwhite', 4)); p.h(0, 7, 16, k('mwhite', 2))
    p.v(0, 4, 23, k('mmetal', 4)); p.v(1, 4, 23, k('mwhite', 2))
    for i, (ry, gs) in enumerate(((12, (('bottle', 'a', 2), ('can', 'e', 5), ('bottle', 'c', 8), ('box', 'd', 11))),
                                  (19, (('box', 'b', 3), ('bottle', 'a', 7), ('can', 'c', 10), ('can', 'e', 13))),
                                  (26, (('can', 'a', 3), ('box', 'f', 6), ('bottle', 'b', 10), ('box', 'c', 12))))):
        p.h(2, ry, 14, k('mmetal', 4)); p.h(2, ry + 1, 14, k('mwhite', 1))
        for kind, col, x in gs:
            hh = {'bottle': 5, 'box': 4, 'can': 3, 'mag': 5}[kind]
            goods(p, x, ry - hh, kind, col)
    p.rect(0, 26, 16, 1, k('mmetal', 4))
elif S == 'B':
    frame_top_left(p, 5, 2, 4, 1)
    p.rect(0, 4, 16, 23, k('mwhite', 3)); p.rect(0, 4, 16, 3, k('taxi', 5)); p.h(0, 7, 16, k('taxi', 3)); p.h(0, 8, 16, k('mwhite', 2))
    p.v(0, 4, 23, k('mmetal', 5)); p.v(1, 4, 23, k('mmetal', 1))
    p.rect(11, 8, 5, 19, k('mwhite', 2))                       # 오른쪽은 그늘진 벽
    for ry, gs in ((13, (('bottle', 'a', 3), ('can', 'b', 6), ('bottle', 'c', 8), ('box', 'e', 11))),
                   (20, (('box', 'd', 3), ('bottle', 'b', 7), ('can', 'a', 10), ('bottle', 'g', 13))),
                   (26, (('can', 'c', 3), ('box', 'a', 6), ('bottle', 'e', 10), ('can', 'b', 13)))):
        p.h(2, ry, 14, k('mmetal', 5)); p.h(2, ry + 1, 14, k('mmetal', 1))
        for kind, col, x in gs:
            hh = {'bottle': 5, 'box': 4, 'can': 3, 'mag': 5}[kind]
            goods(p, x, ry - hh, kind, col)
    p.rect(0, 26, 16, 1, k('mmetal', 3))
else:
    frame_top_left(p, 5, 3, 4, 2)
    p.rect(0, 4, 16, 23, k('mwhite', 3)); p.rect(0, 4, 16, 2, k('mwhite', 5))
    p.v(0, 4, 23, k('mmetal', 4)); p.v(1, 4, 23, k('mwhite', 2))
    # 잡지·간식 진열대(비스듬한 선반)
    p.h(2, 14, 14, k('mmetal', 4)); p.h(2, 15, 14, k('mwhite', 1))
    for x, col in ((2, 'a'), (6, 'b'), (10, 'c'), (14, 'd')):
        if x == 14: p.rect(x, 9, 2, 5, k('taxi', 3)); p.px(x, 9, k('taxi', 5)); continue
        goods(p, x, 9, 'mag', col)
    p.h(2, 24, 14, k('mmetal', 4)); p.h(2, 25, 14, k('mwhite', 1))
    for x, col in ((2, 'e'), (6, 'f'), (10, 'a')):
        p.rect(x, 18, 3, 6, k(GOODS[col], 3)); p.h(x, 18, 3, k(GOODS[col], 5)); p.v(x, 18, 6, k(GOODS[col], 4)); p.v(x + 2, 19, 5, k(GOODS[col], 2))
        p.h(x, 20, 3, k('mwhite', 4))
    p.rect(14, 18, 2, 6, k('neon', 3)); p.px(14, 18, k('neon', 5))
    p.rect(0, 26, 16, 1, k('mmetal', 3))

# ───────── 격자창(코시) ─────────
p = P('win_koshi'); front_frame(p)
if S == 'A':
    p.h(0, 2, 16, k('sumi', 4)); p.h(0, 3, 16, k('sumi', 2))
    p.rect(0, 4, 16, 20, k('washi', 4)); p.rect(0, 4, 16, 3, k('washi', 5)); p.rect(0, 20, 16, 4, k('washi', 3))
    for x in (0, 4, 8, 12):
        p.v(x, 4, 20, k('sumi', 4)); p.v(x + 1, 4, 20, k('sumi', 2))
    p.h(0, 13, 16, k('sumi', 3)); p.h(0, 14, 16, k('sumi', 1))
    p.h(0, 24, 16, k('sumi', 4)); p.rect(0, 25, 16, 4, k('sumi', 2)); p.h(0, 25, 16, k('sumi', 4)); p.h(0, 28, 16, k('sumi', 1))
elif S == 'B':
    p.h(0, 2, 16, k('sumi', 5)); p.h(0, 3, 16, k('sumi', 1)); p.h(0, 4, 16, k('sumi', 0))
    p.rect(0, 5, 16, 19, k('washi', 4)); p.rect(0, 5, 16, 3, k('washi', 2)); p.rect(0, 8, 16, 3, k('washi', 3)); p.rect(0, 20, 16, 4, k('washi', 5))
    for x in (0, 4, 8, 12):
        p.v(x, 5, 19, k('sumi', 5)); p.v(x + 1, 5, 19, k('sumi', 2)); p.px(x + 2, 5, k('washi', 1)); p.px(x + 2, 6, k('washi', 1)); p.px(x + 2, 7, k('washi', 1))
    p.h(0, 13, 16, k('sumi', 4)); p.h(0, 14, 16, k('sumi', 0))
    p.h(0, 24, 16, k('sumi', 5)); p.rect(0, 25, 16, 4, k('sumi', 1)); p.h(0, 25, 16, k('sumi', 3)); p.h(0, 28, 16, k('sumi', 0))
else:
    # C: 가는 격자(2×)와 위 가로 살이 가로로 길다(가로 격자)
    p.h(0, 2, 16, k('hinoki', 5)); p.h(0, 3, 16, k('hinoki', 2))
    p.rect(0, 4, 16, 21, k('washi', 4)); p.rect(0, 4, 16, 2, k('washi', 5)); p.rect(0, 21, 16, 4, k('washi', 3))
    for y in (8, 12, 16, 20):
        p.h(0, y, 16, k('hinoki', 4)); p.h(0, y + 1, 16, k('hinoki', 2))
    for x in (0, 8): p.v(x, 4, 21, k('hinoki', 5)); p.v(x + 1, 4, 21, k('hinoki', 2))
    p.h(0, 25, 16, k('hinoki', 5)); p.rect(0, 26, 16, 3, k('hinoki', 2)); p.h(0, 26, 16, k('hinoki', 3)); p.h(0, 28, 16, k('hinoki', 1))

# ───────── 벽 ─────────
p = P('wall_plain'); front_frame(p)
if S == 'A':
    p.rect(0, 2, 16, 27, k('mconc', 5))
    for y0 in (2, 11, 20):                     # 큰 타일 9줄, 어긋나게 이음
        h = 8 if y0 < 20 else 8
        p.h(0, y0 + 8, 16, k('mconc', 3))
        p.h(0, y0, 16, k('mwhite', 1) if y0 > 2 else k('mconc', 4))
        off = 0 if y0 == 2 else 8 if y0 == 11 else 0
        p.v(off, y0 + 1, 7, k('mconc', 3)); p.v((off + 8) % 16, y0 + 1, 7, k('mconc', 3))
    p.rect(0, 26, 16, 3, k('mconc', 3)); p.h(0, 26, 16, k('mconc', 5))
elif S == 'B':
    p.rect(0, 2, 16, 27, k('mconc', 3))
    p.rect(0, 2, 16, 5, k('mconc', 2)); p.h(0, 7, 16, k('mconc', 2))
    for y0 in (7, 16):
        p.h(0, y0 + 8, 16, k('mconc', 1)); p.h(0, y0, 16, k('mconc', 5))
        off = 0 if y0 == 7 else 8
        p.v(off, y0 + 1, 7, k('mconc', 1)); p.v((off + 8) % 16, y0 + 1, 7, k('mconc', 1))
        p.v(off + 1, y0 + 1, 7, k('mconc', 4)); p.v((off + 9) % 16, y0 + 1, 7, k('mconc', 4))
    p.rect(0, 25, 16, 4, k('mconc', 1)); p.h(0, 25, 16, k('mconc', 4))
else:
    # C: 널판 세로 벽(가운데 기와 띠)
    p.rect(0, 2, 16, 27, k('hinoki', 3))
    for x in (0, 4, 8, 12):
        p.v(x, 2, 24, k('hinoki', 4)); p.v(x + 3, 2, 24, k('hinoki', 2))
    p.h(0, 13, 16, k('sumi', 3)); p.h(0, 14, 16, k('sumi', 1))
    p.rect(0, 22, 16, 7, k('ishi', 3)); p.h(0, 22, 16, k('ishi', 5)); p.h(0, 23, 16, k('ishi', 4)); p.h(0, 26, 16, k('ishi', 2)); p.h(0, 26, 16, k('ishi', 5)); p.v(7, 24, 5, k('ishi', 2)); p.v(15, 24, 5, k('ishi', 2)); p.v(0, 24, 2, k('ishi', 2))
    p.h(0, 2, 16, k('hinoki', 1)); p.h(0, 3, 16, k('hinoki', 2))

# ───────── 자동문 ─────────
def auto_door(left):
    p = P('door_auto_l' if left else 'door_auto_r'); front_frame(p)
    if S == 'A':
        p.rect(0, 2, 16, 3, k('mmetal', 3)); p.h(0, 2, 16, k('mmetal', 5)); p.h(0, 4, 16, k('mmetal', 2))
        p.px(7 if left else 8, 3, k('kgreen', 4))
        p.rect(0, 5, 16, 22, k('mglass', 5)); p.rect(0, 5, 16, 2, k('mglass', 6))
        p.rect(0, 20, 16, 7, k('mglass', 4)); p.h(0, 26, 16, k('mglass', 3))
        p.h(0, 14, 16, k('mwhite', 4)); p.h(0, 15, 16, k('mwhite', 2))                       # 유리 안전 띠
        p.rect(0, 27, 16, 2, k('mmetal', 3)); p.h(0, 27, 16, k('mmetal', 5)); p.h(0, 28, 16, k('mmetal', 2))
        for i in range(5): p.px((2 if left else 6) + i, 12 - i, k('mglass', 7))
        if left:
            p.v(0, 5, 22, k('mmetal', 5)); p.v(15, 5, 22, k('lacq', 1)); p.v(14, 5, 22, k('mmetal', 3))
            p.rect(12, 17, 1, 7, k('mmetal', 6)); p.rect(13, 17, 1, 7, k('mmetal', 3))
        else:
            p.v(0, 5, 22, k('lacq', 1)); p.v(1, 5, 22, k('mmetal', 5)); p.v(15, 5, 22, k('mmetal', 2))
            p.rect(3, 17, 1, 7, k('mmetal', 6)); p.rect(2, 17, 1, 7, k('mmetal', 3))
    elif S == 'B':
        p.rect(0, 2, 16, 3, k('mmetal', 2)); p.h(0, 2, 16, k('mmetal', 5)); p.h(0, 4, 16, k('mmetal', 0))
        p.px(7 if left else 8, 3, k('kgreen', 5))
        p.rect(0, 5, 16, 22, k('mglass', 4)); p.rect(0, 5, 16, 3, k('mglass', 2)); p.rect(0, 8, 16, 2, k('mglass', 3))
        p.rect(0, 20, 16, 7, k('mdglass', 5)); p.h(0, 20, 16, k('mglass', 5))
        p.h(0, 14, 16, k('mwhite', 5)); p.h(0, 15, 16, k('mwhite', 1))
        p.rect(0, 27, 16, 2, k('mmetal', 2)); p.h(0, 27, 16, k('mmetal', 6)); p.h(0, 28, 16, k('mmetal', 0))
        for i in range(8): p.px((1 if left else 5) + i, 13 - i, k('mglass', 7)); p.px((2 if left else 6) + i, 13 - i, k('mglass', 5))
        if left:
            p.v(0, 5, 22, k('mmetal', 6)); p.v(1, 5, 22, k('mmetal', 3)); p.v(15, 5, 22, k('lacq', 0)); p.v(14, 5, 22, k('mmetal', 1))
            p.rect(12, 16, 1, 8, k('mmetal', 6)); p.rect(13, 16, 1, 8, k('mmetal', 1))
        else:
            p.v(0, 5, 22, k('lacq', 0)); p.v(1, 5, 22, k('mmetal', 6)); p.v(2, 5, 22, k('mmetal', 3)); p.v(15, 5, 22, k('mmetal', 0)); p.v(14, 5, 22, k('mmetal', 1))
            p.rect(3, 16, 1, 8, k('mmetal', 6)); p.rect(4, 16, 1, 8, k('mmetal', 1))
    else:
        # C: 위 가로 문틀 넓게 + 아래 발판 널(황동)
        p.rect(0, 2, 16, 4, k('hinoki', 3)); p.h(0, 2, 16, k('hinoki', 5)); p.h(0, 5, 16, k('hinoki', 1))
        p.px(7 if left else 8, 3, k('kgreen', 4))
        p.rect(0, 6, 16, 19, k('mglass', 5)); p.rect(0, 6, 16, 2, k('mglass', 6))
        p.rect(0, 18, 16, 7, k('mglass', 4))
        p.h(0, 13, 16, k('mwhite', 4)); p.h(0, 14, 16, k('mwhite', 2))
        p.rect(0, 25, 16, 4, k('hinoki', 2)); p.h(0, 25, 16, k('hinoki', 5)); p.h(0, 28, 16, k('hinoki', 1)); p.h(0, 26, 16, k('hinoki', 3))
        for i in range(5): p.px((2 if left else 6) + i, 12 - i, k('mglass', 7))
        if left:
            p.v(0, 6, 19, k('hinoki', 5)); p.v(15, 6, 19, k('lacq', 1)); p.v(14, 6, 19, k('hinoki', 2))
            p.rect(12, 14, 1, 7, k('taxi', 5)); p.rect(13, 14, 1, 7, k('taxi', 3))
        else:
            p.v(0, 6, 19, k('lacq', 1)); p.v(1, 6, 19, k('hinoki', 4)); p.v(15, 6, 19, k('hinoki', 1))
            p.rect(3, 14, 1, 7, k('taxi', 5)); p.rect(4, 14, 1, 7, k('taxi', 3))
auto_door(True); auto_door(False)

# ───────── 미닫이·노렌 ─────────
def slide_door(p):
    front_frame(p)
    if S == 'A':
        p.rect(0, 2, 16, 27, k('hinoki', 3)); p.v(0, 2, 27, k('hinoki', 5)); p.v(1, 2, 27, k('hinoki', 4)); p.v(15, 2, 27, k('hinoki', 1)); p.v(14, 2, 27, k('hinoki', 2))
        p.h(0, 2, 16, k('hinoki', 1)); p.h(0, 3, 16, k('hinoki', 5))
        for x in (3, 9):
            for y in (5, 11):
                p.rect(x, y, 4, 5, k('mglass', 4)); p.h(x, y, 4, k('mglass', 5)); p.px(x, y + 1, k('mglass', 5))
        p.v(7, 4, 13, k('hinoki', 2)); p.v(8, 4, 13, k('hinoki', 5))
        p.h(2, 10, 12, k('hinoki', 2)); p.h(2, 16, 12, k('hinoki', 2))
        p.h(1, 17, 14, k('hinoki', 2)); p.rect(3, 19, 10, 8, k('hinoki', 2)); p.h(3, 19, 10, k('hinoki', 4)); p.v(3, 19, 8, k('hinoki', 4)); p.v(12, 20, 7, k('hinoki', 1)); p.h(3, 26, 10, k('hinoki', 1))
        p.rect(11, 12, 2, 4, k('sumi', 3)); p.px(11, 12, k('sumi', 5))     # 손잡이 홈
    elif S == 'B':
        p.rect(0, 2, 16, 27, k('hinoki', 2)); p.v(0, 2, 27, k('hinoki', 6)); p.v(1, 2, 27, k('hinoki', 4)); p.v(15, 2, 27, k('hinoki', 0)); p.v(14, 2, 27, k('hinoki', 1))
        p.rect(0, 2, 16, 3, k('hinoki', 1)); p.h(0, 4, 16, k('hinoki', 0))
        for x in (3, 9):
            for y in (6, 12):
                p.rect(x, y, 4, 5, k('mglass', 3)); p.h(x, y, 4, k('mglass', 6)); p.v(x, y, 5, k('mglass', 5)); p.h(x, y + 4, 4, k('mglass', 1)); p.v(x + 3, y + 1, 4, k('mglass', 1))
        p.v(7, 5, 13, k('hinoki', 0)); p.v(8, 5, 13, k('hinoki', 4))
        p.h(2, 11, 12, k('hinoki', 0)); p.h(2, 17, 12, k('hinoki', 0)); p.h(2, 12, 0, k('hinoki', 0))
        p.h(1, 18, 14, k('hinoki', 0)); p.rect(3, 20, 10, 7, k('hinoki', 1)); p.h(3, 20, 10, k('hinoki', 5)); p.v(3, 20, 7, k('hinoki', 4)); p.v(12, 21, 6, k('hinoki', 0)); p.h(3, 26, 10, k('hinoki', 0))
        p.rect(11, 12, 2, 4, k('sumi', 1)); p.px(11, 12, k('sumi', 4))
    else:
        # C: 판문(세로 널) + 가운데 작은 격자 유리, 위로 갈수록 좁아지는 지붕 모양 문미
        p.rect(0, 2, 16, 27, k('sumi', 3)); p.h(0, 2, 16, k('sumi', 1)); p.h(0, 3, 16, k('sumi', 4))
        for x in (0, 4, 8, 12):
            p.v(x, 4, 25, k('sumi', 4)); p.v(x + 3, 4, 25, k('sumi', 2))
        p.rect(3, 6, 10, 10, k('washi', 4)); p.h(3, 6, 10, k('washi', 2)); p.v(3, 6, 10, k('washi', 3))
        for x in (5, 8, 11): p.v(x, 6, 10, k('sumi', 2))
        p.h(3, 10, 10, k('sumi', 2)); p.h(3, 13, 10, k('sumi', 2))
        p.rect(2, 5, 12, 1, k('hinoki', 5)); p.rect(2, 16, 12, 1, k('hinoki', 2)); p.v(2, 5, 12, k('hinoki', 4)); p.v(13, 6, 11, k('hinoki', 1))
        p.rect(11, 20, 2, 4, k('taxi', 4)); p.px(11, 20, k('taxi', 5))
        p.h(0, 26, 16, k('sumi', 5)); p.h(0, 27, 16, k('sumi', 1))
p = P('door_slide'); slide_door(p)
p = P('door_noren'); slide_door(p)
# 노렌: 셋으로 가른 천 (윗칸 대부분을 덮는다)
if S == 'A':
    p.h(0, 2, 16, k('hinoki', 6)); p.h(0, 3, 16, k('hinoki', 3)); p.rect(1, 3, 14, 1, k('sumi', 2))     # 봉
    for x in (2, 6, 11): p.px(x, 4, k('mmetal', 5))
    p.rect(1, 4, 14, 12, k('ai', 3)); p.rect(1, 4, 14, 1, k('ai', 2))
    p.v(1, 4, 12, k('ai', 4)); p.v(2, 4, 12, k('ai', 4)); p.v(14, 4, 12, k('ai', 2))
    for x in (5, 10): p.v(x, 6, 10, k('ai', 1)); p.v(x + 1, 6, 10, k('ai', 4))
    p.h(1, 15, 14, k('washi', 4)); p.h(1, 16, 14, k('ai', 1))
    for x in (6, 7): p.px(x, 9, k('washi', 4)); p.px(x, 10, k('washi', 4))                          # 가운데 폭에 흰 문양 점
    p.rect(7, 8, 2, 4, k('washi', 4)); p.h(6, 9, 4, k('washi', 4)); p.px(9, 8, k('washi', 3))
elif S == 'B':
    p.h(0, 2, 16, k('hinoki', 6)); p.h(0, 3, 16, k('hinoki', 2)); p.rect(1, 3, 14, 1, k('sumi', 0))
    p.rect(1, 4, 14, 12, k('ai', 2)); p.rect(1, 4, 14, 3, k('ai', 1))
    p.v(1, 4, 12, k('ai', 5)); p.v(2, 4, 12, k('ai', 3)); p.v(13, 4, 12, k('ai', 1)); p.v(14, 4, 12, k('ai', 0))
    for x in (5, 10): p.v(x, 5, 11, k('ai', 0)); p.v(x + 1, 5, 11, k('ai', 4))
    p.h(1, 15, 14, k('washi', 5)); p.h(1, 16, 14, k('ai', 0))
    p.rect(7, 8, 2, 4, k('washi', 5)); p.h(6, 9, 4, k('washi', 5)); p.px(9, 11, k('washi', 2)); p.px(8, 11, k('washi', 2))
    p.h(1, 17, 14, k('sumi', 0))                                                                   # 천이 문에 드리운 그림자
else:
    p.h(0, 2, 16, k('hinoki', 5)); p.h(0, 3, 16, k('sumi', 1))
    p.rect(1, 3, 14, 13, k('shu', 3)); p.rect(1, 3, 14, 1, k('shu', 2))
    p.v(1, 3, 13, k('shu', 5)); p.v(2, 3, 13, k('shu', 4)); p.v(14, 3, 13, k('shu', 1))
    for x in (5, 10): p.v(x, 5, 11, k('shu', 1)); p.v(x + 1, 5, 11, k('shu', 4))
    p.h(1, 15, 14, k('washi', 4)); p.h(1, 16, 14, k('shu', 1))
    p.rect(7, 7, 2, 5, k('washi', 4)); p.h(6, 8, 4, k('washi', 4)); p.h(6, 10, 4, k('washi', 3))

# ───────── 셔터 ─────────
p = P('shutter'); front_frame(p)
if S == 'A':
    p.rect(0, 2, 16, 4, k('mmetal', 3)); p.h(0, 2, 16, k('mmetal', 5)); p.h(0, 5, 16, k('mmetal', 1))
    for y in range(6, 26):
        p.h(0, y, 16, k('mmetal', (5, 4, 3, 3)[(y - 6) % 4]))
    p.rect(0, 26, 16, 3, k('mmetal', 2)); p.h(0, 26, 16, k('mmetal', 5)); p.h(0, 28, 16, k('mmetal', 1))
elif S == 'B':
    p.rect(0, 2, 16, 4, k('mmetal', 2)); p.h(0, 2, 16, k('mmetal', 5)); p.h(0, 5, 16, k('mmetal', 0))
    p.rect(0, 6, 16, 4, k('mmetal', 1))     # 상자 그림자
    for y in range(10, 26):
        p.h(0, y, 16, k('mmetal', (6, 4, 3, 2)[(y - 10) % 4]))
    p.rect(0, 26, 16, 3, k('mmetal', 1)); p.h(0, 26, 16, k('mmetal', 6)); p.h(0, 28, 16, k('mmetal', 0))
else:
    # C: 세로 골(물결 함석): 가로 반복 주기 4
    p.rect(0, 2, 16, 27, k('mmetal', 3))
    p.h(0, 2, 16, k('mmetal', 5))
    for x in range(16):
        p.v(x, 3, 24, k('mmetal', (5, 4, 3, 2)[x % 4]))
    p.rect(0, 25, 16, 4, k('mmetal', 2)); p.h(0, 25, 16, k('mmetal', 5)); p.h(0, 28, 16, k('mmetal', 1))
    p.h(0, 3, 16, k('mmetal', 1))

# ───────── 간판 띠 ─────────
def frame_for_band(p):
    if S == 'A': band_frame(p, ('mmetal', 5), ('mmetal', 3))
    elif S == 'B': band_frame(p, ('mmetal', 6), ('mmetal', 1))
    else: band_frame(p, ('hinoki', 5), ('hinoki', 2))

def band_body(p, ramp, tone_map):
    p.rect(0, 2, 16, 11, k(ramp, 3))
    for y, t in tone_map.items(): p.h(0, y, 16, k(ramp, t))

p = P('band_l'); frame_for_band(p)
if S == 'C':
    p.rect(0, 2, 16, 11, k('hinoki', 3)); p.rect(0, 1, 3, 13, k('hinoki', 6)); p.v(3, 2, 11, k('hinoki', 4))
else:
    ramp = 'mwhite'; p.rect(0, 2, 16, 11, k(ramp, 3)); p.rect(0, 1, 2, 13, k(ramp, 5 if S != 'B' else 5)); p.v(2, 2, 11, k(ramp, 4))
    if S == 'B': p.rect(0, 2, 16, 3, k(ramp, 2)); p.v(0, 1, 13, k('mwhite', 5)); p.v(1, 1, 13, k('mwhite', 4)); p.rect(0, 10, 16, 3, k(ramp, 2))
p = P('band_r'); frame_for_band(p)
if S == 'C':
    p.rect(0, 2, 16, 11, k('hinoki', 3)); p.v(13, 2, 11, k('hinoki', 2)); p.v(14, 1, 13, k('hinoki', 1)); p.v(15, 1, 13, k('hinoki', 0))
else:
    ramp = 'mwhite'; p.rect(0, 2, 16, 11, k(ramp, 3)); p.v(13, 2, 11, k(ramp, 2)); p.v(14, 1, 13, k(ramp, 1)); p.v(15, 1, 13, k(ramp, 0))
    if S == 'B': p.rect(0, 2, 16, 3, k(ramp, 2)); p.rect(0, 10, 16, 3, k(ramp, 2)); p.v(13, 2, 11, k(ramp, 1)); p.v(14, 1, 13, k(ramp, 0)); p.v(15, 1, 13, k('mgran', 0))

p = P('band_cvs'); frame_for_band(p)
p.rect(0, 2, 16, 11, k('mwhite', 3)); p.h(0, 2, 16, k('mwhite', 5)); p.h(0, 12, 16, k('mwhite', 2))
stripes = (('kgreen', 3), ('korange', 6), ('kblue', 9))
for c, y in stripes:
    if S == 'A':
        p.rect(0, y, 16, 2, k(c, 3)); p.h(0, y, 16, k(c, 4)); p.h(0, y + 2, 16, k(c, 1))
    elif S == 'B':
        p.rect(0, y, 16, 2, k(c, 3)); p.h(0, y, 16, k(c, 5)); p.h(0, y + 2, 16, k(c, 0))
    else:
        p.rect(0, y, 16, 3, k(c, 3)); p.h(0, y, 16, k(c, 4))
        for x in range(0, 16, 8): p.rect(x, y, 4, 3, k(c, 4)); p.h(x, y, 4, k(c, 5))     # 어긋난 격자무늬
if S == 'B': p.rect(0, 2, 16, 1, k('mwhite', 2)); p.h(0, 12, 16, k('mwhite', 1))

p = P('band_izakaya'); frame_for_band(p)
if S == 'A':
    p.rect(0, 2, 16, 11, k('sumi', 2))
    p.rect(0, 2, 16, 3, k('kawara', 3)); p.h(0, 2, 16, k('kawara', 5)); p.h(0, 4, 16, k('kawara', 1))
    for x in (0, 4, 8, 12): p.v(x + 3, 3, 2, k('kawara', 2)); p.px(x, 3, k('kawara', 4))              # 기와 암막새 주기 4
    p.h(0, 5, 16, k('sumi', 0))
    for x in (0, 8): p.v(x, 6, 7, k('sumi', 1)); p.v(x + 1, 6, 7, k('sumi', 3))                         # 널 이음
    for (x, y, w) in ((3, 8, 3), (10, 9, 4), (2, 11, 2), (12, 7, 2)): p.h(x, y, w, k('sumi', 3))         # 나뭇결
    p.h(0, 12, 16, k('sumi', 1))
elif S == 'B':
    p.rect(0, 2, 16, 11, k('sumi', 1))
    p.rect(0, 2, 16, 3, k('kawara', 3)); p.h(0, 2, 16, k('kawara', 6)); p.h(0, 3, 16, k('kawara', 4)); p.h(0, 4, 16, k('kawara', 0))
    for x in (0, 4, 8, 12): p.v(x + 3, 3, 2, k('kawara', 1)); p.px(x, 3, k('kawara', 5)); p.px(x + 1, 3, k('kawara', 5))
    p.rect(0, 5, 16, 2, k('sumi', 0))           # 처마 밑 그늘
    for x in (0, 8): p.v(x, 7, 6, k('sumi', 0)); p.v(x + 1, 7, 6, k('sumi', 3))
    for (x, y, w) in ((3, 8, 3), (10, 10, 4), (2, 11, 2), (12, 8, 2)): p.h(x, y, w, k('sumi', 2))
    p.h(0, 12, 16, k('sumi', 0))
else:
    p.rect(0, 2, 16, 11, k('shu', 2))
    p.rect(0, 2, 16, 2, k('sumi', 1)); p.h(0, 3, 16, k('sumi', 3))
    for x in range(0, 16, 4): p.rect(x, 4, 2, 5, k('shu', 3)); p.rect(x + 2, 4, 2, 5, k('shu', 1)); p.h(x, 4, 2, k('shu', 5))     # 다이아몬드 줄무늬 세로 단
    p.h(0, 9, 16, k('sumi', 1)); p.h(0, 10, 16, k('sumi', 3)); p.rect(0, 11, 16, 2, k('shu', 1))
    for x in range(0, 16, 8): p.rect(x + 2, 11, 4, 1, k('taxi', 3))

# 라멘 띠 — text_ramen 은 같은 바탕을 32px 로
def ramen_bg(p, w):
    if S == 'A':
        p.rect(0, 2, w, 11, k('akachin', 3)); p.rect(0, 1, w, 1, k('taxi', 4)); p.rect(0, 13, w, 1, k('taxi', 2))
        p.rect(0, 2, w, 1, k('akachin', 4)); p.rect(0, 12, w, 1, k('akachin', 2))
    elif S == 'B':
        p.rect(0, 2, w, 11, k('akachin', 3)); p.rect(0, 1, w, 1, k('taxi', 5)); p.rect(0, 13, w, 1, k('taxi', 1))
        p.rect(0, 2, w, 2, k('akachin', 2)); p.rect(0, 10, w, 3, k('akachin', 2)); p.rect(0, 12, w, 1, k('akachin', 1))
    else:
        p.rect(0, 2, w, 11, k('sumi', 1)); p.rect(0, 1, w, 1, k('hinoki', 5)); p.rect(0, 13, w, 1, k('hinoki', 2))
        p.rect(0, 2, w, 1, k('taxi', 3))
        for x in range(0, w, 4): p.rect(x, 3, 2, 8, k('akachin', 3)); p.rect(x + 2, 3, 2, 8, k('akachin', 2)); p.h(x, 3, 2, k('akachin', 5))
        p.rect(0, 11, w, 1, k('taxi', 3)); p.rect(0, 12, w, 1, k('sumi', 0))
p = P('band_ramen'); frame_for_band(p); ramen_bg(p, 16)
p = P('band_plain'); frame_for_band(p)
if S == 'C': p.rect(0, 2, 16, 11, k('hinoki', 3)); p.h(0, 2, 16, k('hinoki', 5)); p.h(0, 12, 16, k('hinoki', 2))
else: p.rect(0, 2, 16, 11, k('mwhite', 3)); p.h(0, 2, 16, k('mwhite', 5)); p.h(0, 12, 16, k('mwhite', 2))

# 글자 도안
RA = ['.####.', '.####.', '......', '######', '######', '..##..', '.##...', '##....']
BO = ['......', '......', '......', '######', '######', '......', '......', '......']
ME = ['....##', '...##.', '##.##.', '.###..', '.###..', '##.##.', '#..###', '....##']
NN = ['##....', '.##...', '....##', '....##', '...##.', '..##..', '.##...', '##....']
p = P('text_ramen')
for q in (0, 16):
    p.ox = AT['text_ramen'][0] + q; frame_for_band(p)
p.ox = AT['text_ramen'][0]
ramen_bg(p, 32)
fg = {'A': k('taxi', 5), 'B': k('taxi', 5), 'C': k('washi', 5)}[S]
sh = {'A': k('akachin', 1), 'B': k('akachin', 0), 'C': k('sumi', 0)}[S]
gx = 1
for gi, g in enumerate((RA, BO, ME, NN)):
    for pas in (0, 1):
        for j, row in enumerate(g):
            for a, c in enumerate(row):
                if c != '#': continue
                if pas == 0: p.px(gx + gi * 8 + a + 1, 3 + j + 1, sh)
                else: p.px(gx + gi * 8 + a, 3 + j, fg)
        if S == 'B' and pas == 1:      # 윗 획 하이라이트
            for a, c in enumerate(g[0]):
                if c == '#': p.px(gx + gi * 8 + a, 3, k('washi', 5))

SAKE = ['.#..#######.',
        '..#.#.....#.',
        '..#.#######.',
        '.#..#.....#.',
        '.#..#######.',
        '#...#.....#.',
        '#...#.....#.',
        '....#.....#.',
        '....#######.']
p = P('text_sake'); frame_for_band(p)
if S == 'C': p.rect(0, 2, 16, 11, k('shu', 2)); p.h(0, 2, 16, k('sumi', 3)); p.h(0, 12, 16, k('sumi', 1))
elif S == 'B': p.rect(0, 2, 16, 11, k('sumi', 1)); p.rect(0, 2, 16, 3, k('kawara', 3)); p.h(0, 2, 16, k('kawara', 6)); p.h(0, 3, 16, k('kawara', 4)); p.h(0, 4, 16, k('kawara', 0)); p.rect(0, 5, 16, 2, k('sumi', 0)); p.h(0, 12, 16, k('sumi', 0))
else:
    p.rect(0, 2, 16, 11, k('sumi', 2)); p.rect(0, 2, 16, 3, k('kawara', 3)); p.h(0, 2, 16, k('kawara', 5)); p.h(0, 4, 16, k('kawara', 1)); p.h(0, 5, 16, k('sumi', 0)); p.h(0, 12, 16, k('sumi', 1))
    for x in (0, 4, 8, 12): p.v(x + 3, 3, 2, k('kawara', 2)); p.px(x, 3, k('kawara', 4))
fg = k('washi', 5); sh = {'A': k('sumi', 0), 'B': k('sumi', 0), 'C': k('sumi', 0)}[S]
oy = 5 if S != 'C' else 3
for pas in (0, 1):
    for j, row in enumerate(SAKE):
        for a, c in enumerate(row):
            if c != '#': continue
            if pas == 0: p.px(2 + a + 1, oy + j + 1 - (1 if S != 'C' else 0), sh) if oy + j + 1 - (1 if S != 'C' else 0) < 13 else None
            else: p.px(2 + a, oy + j - (0 if S == 'C' else 0), fg)

# ───────── 차양(over) ─────────
def awn_cols():
    return {'A': ('akachin', 'mwhite'), 'B': ('ai', 'washi'), 'C': ('kgreen', 'washi')}[S]
def awning(p, x0, x1, xg):
    a, b = awn_cols()
    per = 8 if S != 'C' else 16
    for x in range(x0, x1):
        gx = xg + x
        first = (gx % per) < per // 2
        col, rmp = (a, 0) if first else (b, 1)
        for y in range(0, 8):
            if S == 'A':
                t = (4, 4, 3, 3, 3, 3, 2, 2)[y]
            elif S == 'B':
                t = (5, 4, 3, 3, 2, 2, 1, 1)[y]
            else:
                t = (4, 4, 4, 3, 3, 3, 2, 2)[y]
            if first: p.px(x, y, k(a, t))
            else: p.px(x, y, k(b, min(t, 5 if b == 'washi' else 3)))
        # 아랫단 (물결)
        ph = gx % 4
        if S == 'C':
            wave = (8, 9, 9, 8)[ph]
        else:
            wave = (8, 8, 9, 9)[ph] if False else (9, 9, 8, 8)[ph]
        for y in range(8, wave + 1):
            p.px(x, y, k(a, 2) if first else k(b, 2 if b != 'washi' else 3))
        # 그림자(반투명, 천 아래)
        sy = wave + 1
        p.px(x, sy, '-')
        if S == 'B':
            p.px(x, sy, '~'); p.px(x, sy + 1, '-'); p.px(x, sy + 2, '-')
        elif S == 'A':
            if ph in (0, 1): p.px(x, sy + 1, '-')
        else:
            p.px(x, sy, '~')
    # 윗 가장자리 어두운 줄은 1줄만
    for x in range(x0, x1):
        pass
p = P('awn_m'); awning(p, 0, 16, 0)
p = P('awn_l'); awning(p, 2, 16, 0)
a_, b_ = awn_cols()
p.v(1, 1, 8, k(a_, 5) if S != 'B' else k(a_, 5)); p.v(0, 2, 6, k(a_, 4)); p.px(1, 9, k(a_, 2)); p.px(0, 8, k(a_, 2))
p = P('awn_r'); awning(p, 0, 14, 0)
for y in range(1, 9): p.px(14, y, k(a_, 1))
for y in range(2, 8): p.px(15, y, k(a_, 0))
p.px(14, 9, k(a_, 1)); p.px(15, 8, k(a_, 0))
# 오른쪽(그늘)쪽으로 한 단 어둡게: 마지막 14~15 열 덧그림
for x in range(11, 14):
    for y in range(0, 8):
        cur = p.get(x, y)
        if isinstance(cur, tuple):
            r, t = cur; p.px(x, y, k(r, max(0, t - 1)))

# ───────── 초롱(over) ─────────
p = P('lantern')
if S == 'A':
    p.rect(6, 0, 4, 1, k('sumi', 1))                                 # 걸이
    p.rect(4, 1, 8, 1, k('lacq', 3)); p.h(4, 1, 8, k('lacq', 4))
    p.rect(3, 2, 10, 8, k('akachin', 3)); p.v(3, 3, 6, k('akachin', 4)); p.v(4, 2, 8, k('akachin', 5)); p.v(12, 3, 6, k('akachin', 2)); p.v(11, 2, 8, k('akachin', 2))
    for y in (4, 6, 8): p.h(4, y, 8, k('akachin', 2))               # 가로 살
    p.rect(7, 3, 2, 6, k('taxi', 5)); p.h(7, 5, 2, k('taxi', 3))     # 한 글자 자리(빈 무늬)
    p.rect(4, 10, 8, 1, k('lacq', 3)); p.h(4, 10, 8, k('lacq', 4)); p.rect(7, 11, 2, 2, k('taxi', 4)); p.px(7, 13, k('taxi', 3)); p.px(8, 13, k('taxi', 2))
    for x, y in ((2, 4), (13, 4), (2, 8), (13, 8), (1, 6), (14, 6)): p.px(x, y, '%')
    for x in range(3, 13): p.px(x, 14, '%') if x in (5, 6, 9, 10) else None
elif S == 'B':
    p.rect(6, 0, 4, 1, k('sumi', 0))
    p.rect(4, 1, 8, 1, k('lacq', 2)); p.h(4, 1, 8, k('lacq', 5))
    p.rect(3, 2, 10, 8, k('akachin', 3)); p.rect(3, 2, 10, 2, k('akachin', 4)); p.v(3, 3, 6, k('akachin', 6)); p.v(4, 2, 8, k('akachin', 5))
    p.v(11, 2, 8, k('akachin', 1)); p.v(12, 3, 6, k('akachin', 0)); p.rect(9, 2, 2, 8, k('akachin', 2))
    for y in (4, 6, 8): p.h(4, y, 8, k('akachin', 1))
    p.rect(6, 3, 2, 6, k('taxi', 5)); p.h(6, 5, 2, k('taxi', 3))
    p.rect(4, 10, 8, 1, k('lacq', 1)); p.h(4, 10, 8, k('lacq', 4)); p.rect(7, 11, 2, 3, k('taxi', 4)); p.px(7, 13, k('taxi', 2)); p.px(8, 13, k('taxi', 1))
    for x, y in ((2, 3), (13, 3), (2, 5), (13, 5), (2, 7), (13, 7), (2, 9), (13, 9), (1, 6), (14, 6)): p.px(x, y, '%')
    for x in (5, 6, 7, 8, 9, 10): p.px(x, 15, '%')
else:
    # C: 세로로 긴 나가초친 (좁고 김)
    p.rect(7, 0, 2, 1, k('sumi', 1))
    p.rect(5, 1, 6, 1, k('lacq', 3)); p.h(5, 1, 6, k('lacq', 4))
    p.rect(4, 2, 8, 11, k('shu', 3)); p.v(4, 3, 9, k('shu', 4)); p.v(5, 2, 11, k('shu', 5)); p.v(11, 3, 9, k('shu', 1)); p.v(10, 2, 11, k('shu', 2))
    for y in (4, 6, 8, 10): p.h(5, y, 6, k('shu', 2))
    p.rect(7, 4, 2, 7, k('washi', 4)); p.h(7, 7, 2, k('washi', 2))
    p.rect(5, 13, 6, 1, k('lacq', 3)); p.h(5, 13, 6, k('lacq', 4)); p.rect(7, 14, 2, 2, k('taxi', 4)); p.px(8, 15, k('taxi', 2))
    for x, y in ((3, 4), (12, 4), (3, 8), (12, 8), (3, 11), (12, 11)): p.px(x, y, '%')

# ───────── 문 앞 매트(ground, 불투명) ─────────
p = P('entry_mat')
if S == 'A':
    p.rect(0, 0, 16, 16, k('mpave', 3))
    p.h(0, 0, 16, k('mpave', 2)); p.v(0, 0, 16, k('mpave', 2)); p.v(8, 0, 4, k('mpave', 2)); p.v(8, 12, 4, k('mpave', 2)); p.h(0, 15, 16, k('mpave', 2))
    p.rect(0, 3, 16, 10, k('mgran', 1)); p.h(0, 3, 16, k('mgran', 3)); p.h(0, 4, 16, k('mgran', 2)); p.h(0, 12, 16, k('mpave', 1))
    for x in range(0, 16, 4): p.v(x, 5, 6, k('mgran', 0)); p.v(x + 1, 5, 6, k('mgran', 2))
elif S == 'B':
    p.rect(0, 0, 16, 16, k('mpave', 2))
    p.h(0, 0, 16, k('mpave', 1)); p.v(0, 0, 16, k('mpave', 1)); p.v(8, 0, 4, k('mpave', 1)); p.v(8, 12, 4, k('mpave', 1)); p.h(0, 15, 16, k('mpave', 1))
    p.rect(0, 2, 16, 11, k('mgran', 0)); p.h(0, 2, 16, k('mgran', 4)); p.h(0, 3, 16, k('mgran', 2)); p.rect(0, 13, 16, 2, k('mpave', 0)); p.h(0, 13, 16, k('mpave', 0))
    for x in range(0, 16, 4): p.v(x, 4, 8, k('mgran', 1)); p.v(x + 1, 4, 8, k('mgran', 3))
    p.rect(0, 12, 16, 1, k('mgran', 0)); p.rect(0, 13, 16, 1, k('mpave', 1))
else:
    p.rect(0, 0, 16, 16, k('ishi', 4))
    p.h(0, 0, 16, k('ishi', 5)); p.h(0, 15, 16, k('ishi', 3)); p.v(0, 0, 16, k('ishi', 5)); p.v(7, 0, 16, k('ishi', 3)); p.v(8, 0, 16, k('ishi', 5))
    p.rect(0, 4, 16, 8, k('hinoki', 3))      # 나무 발판(스노���)
    p.h(0, 4, 16, k('hinoki', 5)); p.h(0, 11, 16, k('hinoki', 1))
    for x in range(0, 16, 4): p.v(x + 3, 5, 6, k('hinoki', 2))

export('k2-%s.pxg' % S, 'k2-%s kit_shopfront' % S)
