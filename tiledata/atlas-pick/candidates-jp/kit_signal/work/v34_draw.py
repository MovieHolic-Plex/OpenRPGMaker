#!/usr/bin/env python3
"""v34-A 3/4 재작도 — k5-A 와 같은 캔버스·팔레트·조각 배치. 등 상자·보행등·기둥 머리·밑동에 밝은 윗면 판 + 앞 모서리 + 앞면을 준다.
python3 v34_draw.py → ../v34-A.pxg"""
from k5_lib import *
POLE = 'pole'
COL = {6: 2, 7: 5, 8: 4, 9: 3, 10: 1}      # 기둥 x=6..10 왼 윤곽·왼 밝음·오른 어두움
ARM = {3: 2, 4: 5, 5: 3, 6: 1}             # 팔 y=3..6 위 윤곽·밝음·아래 어두움

def pole_rows(p, y0, y1):
    for y in range(y0, y1 + 1):
        for x, t in COL.items(): p.px(x, y, k(POLE, t))
def arm_rows(p, x0, x1):
    for y, t in ARM.items(): p.rect(x0, y, x1 - x0 + 1, 1, k(POLE, t))
def clamp(p):
    for x, t in zip(range(5, 12), (2, 5, 5, 4, 3, 1, 1)): p.px(x, 7, k(POLE, t))
def cap_top(p):
    # 3/4: 기둥 머리 윗면 판(y1~2 가장 밝음) + 뒤 끝선 y0, 오른쪽 1px 어두움
    p.rect(7, 0, 3, 1, k(POLE, 2))
    for y in (1, 2):
        p.rect(6, y, 4, 1, k(POLE, 5)); p.px(10, y, k(POLE, 3))

# 기둥 / 단추 / 밑동
pole_rows(P('pole'), 0, 15)
p = P('pole_btn'); pole_rows(p, 0, 15)
p.rect(11, 5, 4, 6, k('lacq', 0)); p.rect(12, 6, 2, 2, k('taxi', 4)); p.px(12, 6, k('taxi', 5)); p.px(13, 7, k('taxi', 3))
p.rect(11, 5, 4, 1, k('lacq', 6)); p.px(14, 5, k('lacq', 4))
p.rect(12, 8, 2, 1, k('lacq', 5)); p.rect(12, 9, 2, 1, k('lacq', 2)); p.px(11, 6, k('lacq', 4)); p.px(11, 7, k('lacq', 3))
p = P('pole_base'); pole_rows(p, 0, 8)
# 3/4: 받침 윗면 판(y9~10 가장 밝음) → 앞 모서리 y11 → 앞면 y12~14 → 밑선 y15(앞면 아래에 맞춤) + 바닥 그림자
for x in range(5, 12): p.px(x, 8, k(POLE, 2))
for y in (9, 10):
    for x in range(4, 13): p.px(x, y, k(POLE, 5 if x < 11 else 4))
for x in range(3, 13): p.px(x, 11, k(POLE, 5 if x < 12 else 4))
for y in (12, 13):
    for x in range(3, 13): p.px(x, y, k(POLE, 3 if x < 6 else 2 if x < 12 else 1))
p.rect(3, 14, 10, 1, k(POLE, 1)); p.rect(3, 15, 10, 1, k(POLE, 0))
for x, y in ((13, 14), (14, 14), (13, 15), (14, 15), (15, 15)): p.px(x, y, '~')

# 이음쇠
p = P('joint_r'); cap_top(p); pole_rows(p, 3, 6); arm_rows(p, 11, 15); clamp(p); pole_rows(p, 8, 15)
p = P('joint_l'); cap_top(p); pole_rows(p, 3, 6); arm_rows(p, 0, 5); clamp(p); pole_rows(p, 8, 15)
p = P('joint_lr'); cap_top(p); pole_rows(p, 3, 6); arm_rows(p, 11, 15); arm_rows(p, 0, 5); clamp(p); pole_rows(p, 8, 15)

# 팔
arm_rows(P('arm'), 0, 15)
p = P('arm_end_r'); arm_rows(p, 0, 12)
for y, t in ARM.items(): p.px(13, y, k(POLE, {3: 2, 4: 4, 5: 2, 6: 1}[y]))
p.px(14, 4, k(POLE, 1)); p.px(14, 5, k(POLE, 1))
p = P('arm_end_l'); arm_rows(p, 3, 15)
for y in ARM: p.px(2, y, k(POLE, {3: 2, 4: 5, 5: 3, 6: 1}[y]))
p.px(1, 4, k(POLE, 2)); p.px(1, 5, k(POLE, 1))

# 등 머리
LAMP = ['.XXXX.', 'XXXXXX', 'XXXXXX', 'XXXXXX', 'XXXXXX', '.XXXX.']  # 등 6x6, 앞면에서 y4 recess 안 y5부터
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
    # 3/4: 윗면 판 y0~2(뒤 끝선 y0, 밝은 판 y1~2) → 앞 모서리 y3 → 앞면 y4~11(등 셋: recess y5~10) → 밑선 y12 → 번짐 y13~14
    p.rect(3, 0, 26, 1, k('lacq', 1))
    p.rect(2, 1, 27, 2, k('lacq', 6)); p.rect(29, 1, 1, 2, k('lacq', 4))
    p.rect(2, 3, 28, 1, k('lacq', 5)); p.px(29, 3, k('lacq', 3))
    p.rect(2, 4, 28, 8, k('lacq', 2))
    p.rect(2, 4, 1, 8, k('lacq', 0)); p.rect(29, 4, 1, 8, k('lacq', 0)); p.rect(2, 12, 28, 1, k('lacq', 0))
    p.rect(3, 4, 1, 7, k('lacq', 3)); p.rect(28, 4, 1, 7, k('lacq', 1)); p.rect(3, 4, 26, 1, k('lacq', 4)); p.rect(3, 11, 26, 1, k('lacq', 1))
    for n, x in enumerate(LX):
        p.rect(x - 1, 5, 8, 6, k('lacq', 0))
        lamp(p, x, 5, LAMPS[n][0], n == lit, LAMPS[n][1])
    x = LX[lit]; p.rect(x + 1, 13, 4, 1, '%'); p.rect(x + 2, 14, 2, 1, '%')
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
    # 3/4: 윗면 판 y1~3(뒤 끝선 y1, 밝은 판 y2, 앞 모서리 y3) → 앞면 y4~14, 등 둘(y5~8, y10~13)
    p.rect(4, 1, 9, 1, k('lacq', 1))
    p.rect(3, 2, 11, 1, k('lacq', 6)); p.px(13, 2, k('lacq', 4))
    p.rect(3, 3, 11, 1, k('lacq', 5)); p.px(13, 3, k('lacq', 3))
    p.rect(3, 4, 11, 11, k('lacq', 2))
    p.rect(3, 4, 1, 11, k('lacq', 0)); p.rect(13, 4, 1, 11, k('lacq', 0)); p.rect(3, 14, 11, 1, k('lacq', 0))
    p.rect(4, 4, 1, 10, k('lacq', 3)); p.rect(12, 4, 1, 10, k('lacq', 1)); p.rect(4, 13, 9, 1, k('lacq', 1))
    p.rect(4, 9, 8, 1, k('lacq', 1))
    figure(p, 5, 5, FIG['stand'], 'akachin', red_on)
    figure(p, 5, 10, FIG['walk'], 'kgreen', not red_on)
    if red_on: p.rect(2, 6, 1, 2, '%'); p.rect(14, 6, 1, 2, '%')
    else: p.rect(2, 11, 1, 2, '%'); p.rect(14, 11, 1, 2, '%')
ped('ped_r', True); ped('ped_g', False)

# 이름판
p = P('plate')
p.px(4, 0, k(POLE, 3)); p.px(11, 0, k(POLE, 3)); p.px(4, 1, k(POLE, 2)); p.px(11, 1, k(POLE, 1))
p.rect(2, 2, 12, 8, k('kblue', 2))
p.rect(2, 2, 12, 1, k('kblue', 0)); p.rect(2, 9, 12, 1, k('kblue', 0)); p.rect(2, 2, 1, 8, k('kblue', 0)); p.rect(13, 2, 1, 8, k('kblue', 0))
p.rect(3, 3, 10, 1, k('kblue', 5)); p.rect(3, 8, 10, 1, k('kblue', 1)); p.rect(3, 3, 1, 6, k('kblue', 3)); p.rect(12, 3, 1, 6, k('kblue', 1))
for x in (4, 6, 7, 9, 11): p.px(x, 5, k('mwhite', 4))
for x in (5, 6, 8, 10): p.px(x, 7, k('mwhite', 3))

export('v34-A', 'kit_signal v34-A')
