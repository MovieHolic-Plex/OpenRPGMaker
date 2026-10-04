#!/usr/bin/env python3
"""k5-B 강한 명암 — 어두운 윤곽·높은 대비 기둥, 지면 반투명 그림자, 켜진 등 번짐. → ../k5-B.pxg"""
from k5_lib import *
POLE = 'mmetal'
COL = {6: 0, 7: 6, 8: 4, 9: 2, 10: 0}      # 기둥 x=6..10 왼 윤곽·왼 밝음·오른 어두움
ARM = {3: 0, 4: 6, 5: 3, 6: 0}             # 팔 y=3..6 위 윤곽·밝음·아래 어두움

def pole_rows(p, y0, y1):
    for y in range(y0, y1 + 1):
        for x, t in COL.items(): p.px(x, y, k(POLE, t))
        p.px(11, y, '-'); p.px(12, y, '~') if False else None
def arm_rows(p, x0, x1):
    for y, t in ARM.items(): p.rect(x0, y, x1 - x0 + 1, 1, k(POLE, t))
def clamp(p):
    for x, t in zip(range(5, 12), (0, 6, 6, 4, 2, 0, 0)): p.px(x, 7, k(POLE, t))
def cap_top(p):
    p.rect(7, 2, 3, 1, k(POLE, 6)); p.px(6, 2, k(POLE, 2)); p.px(10, 2, k(POLE, 1))

# 기둥 / 단추 / 밑동
pole_rows(P('pole'), 0, 15)
p = P('pole_btn'); pole_rows(p, 0, 15)
p.rect(11, 5, 4, 6, k('lacq', 0)); p.rect(12, 6, 2, 2, k('taxi', 4)); p.px(12, 6, k('taxi', 5)); p.px(13, 7, k('taxi', 3))
p.rect(12, 8, 2, 1, k('lacq', 5)); p.rect(12, 9, 2, 1, k('lacq', 2)); p.px(11, 6, k('lacq', 4)); p.px(11, 7, k('lacq', 3))
p = P('pole_base'); pole_rows(p, 0, 10)
for x, t in zip(range(5, 12), (0, 5, 6, 3, 2, 1, 0)): p.px(x, 11, k(POLE, t))
for x, t in zip(range(4, 13), (0, 6, 6, 4, 3, 2, 2, 1, 0)): p.px(x, 12, k(POLE, t))
for x, t in zip(range(4, 13), (0, 3, 3, 2, 1, 1, 1, 0, 0)): p.px(x, 13, k(POLE, t))
p.rect(4, 14, 9, 1, k(POLE, 0))
p.rect(13, 11, 3, 3, '-'); p.rect(13, 14, 3, 1, '~'); p.rect(4, 15, 12, 1, '~'); p.rect(2, 15, 2, 1, '-'); p.px(15, 10, '-')

def arm_shadow(p, x0, x1):
    for x in range(x0, x1 + 1): p.px(x, 7, '-')
# 이음쇠
p = P('joint_r'); cap_top(p); pole_rows(p, 3, 6); arm_rows(p, 11, 15); clamp(p); arm_shadow(p, 11, 15); pole_rows(p, 8, 15)
p = P('joint_l'); cap_top(p); pole_rows(p, 3, 6); arm_rows(p, 0, 5); clamp(p); arm_shadow(p, 0, 5); pole_rows(p, 8, 15)
p = P('joint_lr'); cap_top(p); pole_rows(p, 3, 6); arm_rows(p, 11, 15); arm_rows(p, 0, 5); clamp(p); arm_shadow(p, 11, 15); arm_shadow(p, 0, 5); arm_shadow(p, 0, 5); pole_rows(p, 8, 15)

# 팔
p = P('arm'); arm_rows(p, 0, 15); arm_shadow(p, 0, 15)
p = P('arm_end_r'); arm_rows(p, 0, 12)
for y, t in ARM.items(): p.px(13, y, k(POLE, {3: 0, 4: 6, 5: 3, 6: 0}[y]))
p.px(14, 4, k(POLE, 0)); p.px(14, 5, k(POLE, 0)); arm_shadow(p, 0, 13)
p = P('arm_end_l'); arm_rows(p, 3, 15)
for y in ARM: p.px(2, y, k(POLE, {3: 0, 4: 6, 5: 3, 6: 0}[y]))
p.px(1, 4, k(POLE, 0)); p.px(1, 5, k(POLE, 0)); arm_shadow(p, 3, 15)

# 등 머리
LAMP = ['.XXXX.', 'XXXXXX', 'XXXXXX', 'XXXXXX', 'XXXXXX', '.XXXX.']
def lamp(p, x0, y0, ramp, on, hi):
    for j, r in enumerate(LAMP):
        for i, c in enumerate(r):
            if c == '.': continue
            if on:
                kk = k(ramp, 4)
                if i + j >= 8: kk = k(ramp, 3)
                if (i, j) in ((2, 2), (3, 2), (2, 3), (3, 3)): kk = k(ramp, 5)
                if (i, j) in ((1, 1), (2, 1)): kk = hi
            else:
                kk = k(ramp, 1)
                if i + j >= 8: kk = k(ramp, 0)
                if (i, j) == (1, 1): kk = k(ramp, 2)
            p.px(x0 + i, y0 + j, kk)
LAMPS = [('kgreen', k('mteal', 4)), ('taxi', k('taxi', 5)), ('akachin', k('akachin', 6))]
LX = (5, 13, 21)
def head(slug, lit):
    p = P(slug)
    arm_rows(p, 0, 1); arm_rows(p, 30, 31)
    p.rect(2, 0, 28, 10, k('lacq', 1))
    p.rect(2, 0, 28, 1, k('lacq', 0)); p.rect(2, 9, 28, 1, k('lacq', 0)); p.rect(2, 0, 1, 10, k('lacq', 0)); p.rect(29, 0, 1, 10, k('lacq', 0))
    p.rect(3, 1, 26, 1, k('lacq', 5)); p.rect(3, 8, 26, 1, k('lacq', 0)); p.rect(3, 1, 1, 8, k('lacq', 4)); p.rect(28, 1, 1, 8, k('lacq', 0))
    for n, x in enumerate(LX):
        p.rect(x - 1, 2, 8, 6, k('lacq', 0))
        lamp(p, x, 2, LAMPS[n][0], n == lit, LAMPS[n][1])
    x = LX[lit]; p.rect(x, 10, 6, 1, '%'); p.rect(x + 1, 11, 4, 1, '%'); p.rect(x + 2, 12, 2, 1, '%')
    for xx in range(2, 30): p.px(xx, 10, p_get(p, xx, 10) if False else G[p.oy + 10][p.ox + xx] or '-') if not (x <= xx < x + 6) else None
def p_get(*a): return None
head('head_g', 0); head('head_y', 1); head('head_r', 2)

# 보행등
FIG = {'stand': ['..XXX..', '.XXXXX.', '...X...', '..X.X..'], 'walk': ['...XX..', '..XXXX.', '.X.XX..', '..XX.X..'[:7]]}
def figure(p, x0, y0, art, ramp, on):
    p.rect(x0, y0, 7, 4, k('lacq', 0))
    for j, r in enumerate(art):
        for i, c in enumerate(r):
            if c == 'X': p.px(x0 + i, y0 + j, k(ramp, 4 if on else 1))
    if on: p.px(x0 + 2, y0, k(ramp, 5)); p.px(x0 + 3, y0 + 1, k(ramp, 5))
def ped(slug, red_on):
    p = P(slug); pole_rows(p, 0, 0); pole_rows(p, 15, 15)
    p.rect(3, 1, 11, 14, k('lacq', 2))
    p.rect(3, 1, 11, 1, k('lacq', 0)); p.rect(3, 14, 11, 1, k('lacq', 0)); p.rect(3, 1, 1, 14, k('lacq', 0)); p.rect(13, 1, 1, 14, k('lacq', 0))
    p.rect(4, 2, 9, 1, k('lacq', 4)); p.rect(4, 13, 9, 1, k('lacq', 1)); p.rect(4, 2, 1, 12, k('lacq', 3)); p.rect(12, 2, 1, 12, k('lacq', 1))
    p.rect(4, 7, 8, 2, k('lacq', 1))
    figure(p, 5, 3, FIG['stand'], 'akachin', red_on)
    figure(p, 5, 9, FIG['walk'], 'kgreen', not red_on)
    if red_on: p.rect(2, 4, 1, 2, '%'); p.rect(14, 4, 1, 2, '%')
    else: p.rect(2, 10, 1, 2, '%'); p.rect(14, 10, 1, 2, '%')
ped('ped_r', True); ped('ped_g', False)

# 이름판
p = P('plate')
p.px(4, 0, k(POLE, 4)); p.px(11, 0, k(POLE, 4)); p.px(4, 1, k(POLE, 3)); p.px(11, 1, k(POLE, 1))
p.rect(2, 2, 12, 8, k('kblue', 2))
p.rect(2, 2, 12, 1, k('kblue', 0)); p.rect(2, 9, 12, 1, k('kblue', 0)); p.rect(2, 2, 1, 8, k('kblue', 0)); p.rect(13, 2, 1, 8, k('kblue', 0))
p.rect(3, 3, 10, 1, k('kblue', 4)); p.rect(3, 8, 10, 1, k('kblue', 1)); p.rect(3, 3, 1, 6, k('kblue', 3)); p.rect(12, 3, 1, 6, k('kblue', 1))
for x in (4, 6, 7, 9, 11): p.px(x, 5, k('mwhite', 4))
for x in (5, 6, 8, 10): p.px(x, 7, k('mwhite', 3))

export('k5-B', 'kit_signal k5-B (강한 명암: 진한 윤곽, 그림자, 빛 번짐)')
