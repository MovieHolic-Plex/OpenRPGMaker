#!/usr/bin/env python3
"""k5-C 실루엣 재해석 — 가는 4px 기둥+격자 팔, 모서리 둥근 키 큰 등 상자와 차양, 아치 보행등, 화살 이름판, 나팔 밑동. → ../k5-C.pxg"""
from k5_lib import *
POLE = 'kawara'
COL = {7: 1, 8: 5, 9: 3, 10: 0}                 # 4px 기둥 x=7..10
ARM = {3: 1, 4: 5, 5: 3, 6: 0}
def pole_rows(p, y0, y1):
    for y in range(y0, y1 + 1):
        for x, t in COL.items(): p.px(x, y, k(POLE, t))
def arm_rows(p, x0, x1, truss=True):
    for y, t in ARM.items(): p.rect(x0, y, x1 - x0 + 1, 1, k(POLE, t))
    if truss:                                    # 주기 4 격자: 4의 배수 칸마다 어두운 점 + 그 사이 밝은 점(16 을 나눈다)
        for x in range(x0, x1 + 1):
            if x % 4 == 0: p.px(x, 4, k(POLE, 2)); p.px(x, 5, k(POLE, 1))
            if x % 4 == 2: p.px(x, 4, k(POLE, 6)); 
def cap_top(p): p.rect(8, 2, 2, 1, k(POLE, 5)); p.px(7, 2, k(POLE, 1)); p.px(10, 2, k(POLE, 0))
def clamp(p):
    for x, t in zip(range(6, 12), (1, 5, 4, 3, 1, 0)): p.px(x, 7, k(POLE, t))
    for x, t in zip(range(6, 12), (1, 4, 3, 2, 1, 0)): p.px(x, 8, k(POLE, t)) if False else None

pole_rows(P('pole'), 0, 15)
p = P('pole_btn'); pole_rows(p, 0, 15)
p.rect(11, 6, 3, 6, k('lacq', 1)); p.rect(12, 7, 1, 2, k('korange', 4)); p.px(12, 7, k('korange', 5)); p.px(12, 8, k('korange', 3))
p.px(12, 10, k('lacq', 4)); p.px(11, 5, k('lacq', 1)); p.rect(11, 6, 1, 5, k('lacq', 3)); p.px(13, 6, k('lacq', 0))
p = P('pole_base'); pole_rows(p, 0, 7)
for y, (x0, x1) in zip(range(8, 15), ((6, 11), (5, 12), (5, 12), (4, 13), (4, 13), (3, 14), (3, 14))):
    for x in range(x0, x1 + 1):
        t = 5 if x == x0 + 1 else 1 if x >= x1 - 1 else 3
        if x == x0 or (x == x1 and y > 9): t = 0 if x == x1 else 1
        p.px(x, y, k(POLE, min(t, 6)))
p.rect(3, 14, 12, 1, k(POLE, 0))
p.rect(15, 12, 1, 3, '-'); p.rect(4, 15, 12, 1, '~'); p.rect(15, 15, 1, 1, '-')

p = P('joint_r'); cap_top(p); pole_rows(p, 3, 6); arm_rows(p, 11, 15); clamp(p); pole_rows(p, 8, 15)
p = P('joint_l'); cap_top(p); pole_rows(p, 3, 6); arm_rows(p, 0, 6); clamp(p); pole_rows(p, 8, 15)
p = P('joint_lr'); cap_top(p); pole_rows(p, 3, 6); arm_rows(p, 11, 15); arm_rows(p, 0, 6); clamp(p); pole_rows(p, 8, 15)
arm_rows(P('arm'), 0, 15)
p = P('arm_end_r'); arm_rows(p, 0, 11)
for y, t in ARM.items(): p.px(12, y, k(POLE, {3: 0, 4: 3, 5: 1, 6: 0}[y]))
p.px(13, 4, k(POLE, 0)); p.px(13, 5, k(POLE, 0)); p.px(14, 3, k(POLE, 0)); p.px(14, 6, k(POLE, 0))
p = P('arm_end_l'); arm_rows(p, 4, 15)
for y in ARM: p.px(3, y, k(POLE, {3: 1, 4: 5, 5: 3, 6: 0}[y]))
p.px(2, 4, k(POLE, 1)); p.px(2, 5, k(POLE, 0))

# 등: 세로로 키 큰 둥근 상자 + 각 등 위 차양
LAMP = ['..XX..', '.XXXX.', 'XXXXXX', 'XXXXXX', '.XXXX.', '..XX..']
def lamp(p, x0, y0, ramp, on, hi):
    for j, r in enumerate(LAMP):
        for i, c in enumerate(r):
            if c == '.': continue
            if on:
                kk = k(ramp, 4)
                if i + j >= 7: kk = k(ramp, 3)
                if (i, j) in ((2, 2), (3, 2)): kk = k(ramp, 5)
                if (i, j) == (1, 2) or (i, j) == (2, 1): kk = hi
            else:
                kk = k(ramp, 1) if i + j < 7 else k(ramp, 0)
            p.px(x0 + i, y0 + j, kk)
LAMPS = [('kgreen', k('kgreen', 5)), ('korange', k('korange', 5)), ('shu', k('shu', 6))]
LX = (5, 13, 21)
def head(slug, lit):
    p = P(slug)
    arm_rows(p, 0, 1, False); arm_rows(p, 30, 31, False)
    # 몸통 2..29 x 0..12, 네 모서리 둥글게
    for y in range(0, 13):
        for x in range(2, 30):
            if (x in (2, 29) and y in (0, 12)): continue
            p.px(x, y, k('kawara', 2))
    p.rect(3, 0, 26, 1, k('kawara', 0)); p.rect(3, 12, 26, 1, k('kawara', 0)); p.rect(2, 1, 1, 11, k('kawara', 0)); p.rect(29, 1, 1, 11, k('kawara', 0))
    p.rect(3, 1, 26, 1, k('kawara', 5)); p.rect(3, 11, 26, 1, k('kawara', 1)); p.rect(3, 2, 1, 9, k('kawara', 4)); p.rect(28, 2, 1, 9, k('kawara', 1))
    for n, x in enumerate(LX):
        p.rect(x - 1, 3, 8, 8, k('lacq', 1)); p.rect(x - 1, 2, 8, 1, k('lacq', 0))     # 차양 선
        p.rect(x - 1, 3, 8, 1, k('lacq', 0))
        lamp(p, x, 4, LAMPS[n][0], n == lit, LAMPS[n][1])
    x = LX[lit]; p.rect(x, 13, 6, 1, '%'); p.rect(x + 1, 14, 4, 1, '%')
head('head_g', 0); head('head_y', 1); head('head_r', 2)

# 보행등: 아치 머리
def ped(slug, red_on):
    p = P(slug); pole_rows(p, 0, 0); pole_rows(p, 15, 15)
    for y in range(1, 15):
        for x in range(3, 14):
            if y == 1 and x not in range(5, 12): continue
            if y == 2 and x in (3, 13): continue
            p.px(x, y, k('kawara', 2))
    for x in range(5, 12): p.px(x, 1, k('kawara', 0))
    p.px(4, 2, k('kawara', 0)); p.px(12, 2, k('kawara', 0)); p.rect(3, 3, 1, 11, k('kawara', 0)); p.rect(13, 3, 1, 11, k('kawara', 0)); p.rect(4, 14, 9, 1, k('kawara', 0))
    p.rect(5, 2, 7, 1, k('kawara', 5)); p.rect(4, 3, 1, 10, k('kawara', 4)); p.rect(12, 3, 1, 10, k('kawara', 1)); p.rect(5, 13, 7, 1, k('kawara', 1))
    for (y0, ramp, on, fig) in ((3, 'shu', red_on, ('..XXX..', '...X...', '..XXX..', '..X.X..')), (9, 'kgreen', not red_on, ('..XX...', '.XXXX..', '..XXX..', '.X..X..'))):
        p.rect(5, y0, 7, 5, k('lacq', 1))
        for j, r in enumerate(fig):
            for i, c in enumerate(r):
                if c == 'X': p.px(5 + i, y0 + j, k(ramp, 4 if on else 1))
        if on: p.px(7, y0, k(ramp, 5)); p.px(8, y0 + 1, k(ramp, 5))
    yy = 4 if red_on else 10
    p.rect(2, yy, 1, 2, '%'); p.rect(14, yy, 1, 2, '%')
ped('ped_r', True); ped('ped_g', False)

# 이름판: 오른쪽이 뾰족한 화살 모양
p = P('plate')
p.px(4, 0, k(POLE, 3)); p.px(4, 1, k(POLE, 1)); p.px(10, 0, k(POLE, 3)); p.px(10, 1, k(POLE, 1))
W_ = (11, 12, 13, 14, 13, 12, 11)
rows = [(2, 2, 12), (3, 2, 13), (4, 2, 14), (5, 2, 14), (6, 2, 14), (7, 2, 13), (8, 2, 12)]
for y, x0, x1 in rows:
    for x in range(x0, x1 + 1): p.px(x, y, k('kblue', 2))
for y, x0, x1 in rows:
    p.px(x0, y, k('kblue', 0)); p.px(x1, y, k('kblue', 0))
for x in range(2, 13): p.px(x, 2, k('kblue', 0)); p.px(x, 8, k('kblue', 0))
for x in range(3, 12): p.px(x, 3, k('kblue', 4)); p.px(x, 7, k('kblue', 1))
for y in range(4, 7): p.px(3, y, k('kblue', 3))
for x in (4, 6, 7, 9): p.px(x, 5, k('mwhite', 4))
for x in (5, 8, 10): p.px(x, 6, k('mwhite', 3))
p.px(13, 5, k('mwhite', 3))
export('k5-C', 'kit_signal k5-C (실루엣: 가는 격자 팔, 둥근 키 큰 등 상자와 차양, 아치 보행등, 화살 이름판)')
