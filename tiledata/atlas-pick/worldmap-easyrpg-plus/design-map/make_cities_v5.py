#!/usr/bin/env python3
"""성곽 도시 3종을 그려 cities-v5/*.png 로 저장. city_v5 의 도구만 쓴다(손 도트)."""
import os, sys
import numpy as np
import scipy.ndimage as ndi
from PIL import Image
from city_v5 import *

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cities-v5')
os.makedirs(OUT, exist_ok=True)
ROOF_R = (RED, RED2)
ROOF_B = (WOOD2, WOOD)
ROOF_S = (C('#5a7aa8'), C('#34507a'))


def layered(w, h, poly, thick, H, split_y, cut=None):
    """바닥(잔디) 위에 성벽 고리를 뒤/앞 조각으로 나눠 돌려준다."""
    cv = Cv(w, h)
    foot = cv.pmask(poly)
    inner = ndi.binary_erosion(foot, iterations=thick)
    ring = foot & ~inner
    if cut is not None:
        ring = ring & ~cut(cv)
        inner = foot & ~ring
    ground(cv, inner | ring)
    wc = Cv(w, h)
    sil_d, front, sil = wall_ring(wc, ring, H, split_y)
    return cv, wc, sil, front, foot, inner


def paste(cv, wc, m):
    s = wc.solid() & m
    cv.a[s] = wc.a[s]


def build_capital():
    W = Hh = 96
    poly = [(20, 34), (76, 34), (91, 47), (91, 79), (76, 92), (20, 92), (5, 79), (5, 47)]
    cv, wc, sil, front, foot, inner = layered(W, Hh, poly, 4, 7, 66)
    road(cv, [(48, 95), (48, 58)], 7, cv.yy > 40)
    plaza(cv, 48, 74, 16, 6, inner)
    paste(cv, wc, ~front)
    # 안쪽 성벽 구역
    kfoot = cv.pmask([(32, 39), (64, 39), (64, 59), (32, 59)])
    kring = kfoot & ~ndi.binary_erosion(kfoot, iterations=2)
    for y, x in zip(*np.nonzero(kfoot)):
        cv.a[y, x] = S3 if (x + y) % 2 else S4
    kc_b = Cv(W, Hh)
    gate_cut = (cv.xx >= 45) & (cv.xx <= 51) & (cv.yy >= 55)
    _, kfront, _ = wall_ring(kc_b, kring & ~gate_cut, 4, 52)
    paste(cv, kc_b, ~kfront)
    # 본채: 중앙 큰 탑 + 좌우 작은 탑 + 앞 건물
    cv.rect(41, 46, 55, 53, S3)
    cv.rect(49, 46, 55, 53, S2)
    cv.rect(41, 51, 55, 53, S1)
    for xx in range(43, 55, 4):
        cv.rect(xx, 48, xx, 49, K)
    cv.poly([(39, 47), (48, 39), (57, 47)], RED)
    cv.poly([(48, 39), (57, 47), (48, 47)], RED2)
    cv.outline(cv.pmask([(41, 46), (55, 46), (55, 53), (41, 53)]))
    cv.outline(cv.pmask([(39, 47), (48, 39), (57, 47)]), BR0)
    tower(cv, 38, 54, 3, 10, roof=ROOF_R)
    tower(cv, 58, 54, 3, 10, roof=ROOF_R)
    tower(cv, 48, 48, 5, 18, roof=ROOF_R, flag=True)
    paste(cv, kc_b, kfront)
    houses = [(14, 56, 'g', 'red'), (25, 54, 'l', 'brown'), (13, 68, 'l', 'red'), (25, 70, 'g', 'brown'),
              (82, 56, 'l', 'red'), (71, 54, 'g', 'red'), (83, 68, 'g', 'brown'), (71, 70, 'l', 'red'),
              (13, 80, 'g', 'red'), (24, 82, 'l', 'red'), (83, 80, 'l', 'brown'), (72, 82, 'g', 'red'),
              (20, 44, 'l', 'red'), (76, 44, 'g', 'brown')]
    for cx, by, k, r in sorted(houses, key=lambda t: t[1]):
        house(cv, cx, by, k, r, 9)
    stall(cv, 37, 74, RED, PALE)
    stall(cv, 59, 74, C('#5a7aa8'), PALE)
    well(cv, 48, 76)
    for bx, by in [(31, 62), (65, 62), (9, 60), (88, 60)]:
        bush(cv, bx, by, 3)
    paste(cv, wc, front)
    arch(cv, 48, 92, 9, 9)
    for cx, by in [(20, 35), (76, 35), (6, 48), (90, 48)]:
        tower(cv, cx, by, 4, 12, roof=ROOF_B)
    for cx, by in [(6, 79), (90, 79)]:
        tower(cv, cx, by, 4, 12, roof=ROOF_R)
    tower(cv, 38, 92, 4, 13, roof=ROOF_R)
    tower(cv, 58, 92, 4, 13, roof=ROOF_R, flag=True)
    return finish(cv)


def build_fort():
    W = Hh = 64
    poly = [(14, 22), (50, 22), (60, 31), (60, 50), (50, 60), (14, 60), (4, 50), (4, 31)]
    cv, wc, sil, front, foot, inner = layered(W, Hh, poly, 3, 6, 44)
    road(cv, [(32, 63), (32, 40)], 5, cv.yy > 26)
    plaza(cv, 32, 50, 9, 4, inner)
    paste(cv, wc, ~front)
    cv.rect(26, 28, 38, 33, S3)
    cv.rect(33, 28, 38, 33, S2)
    cv.rect(26, 31, 38, 33, S1)
    cv.outline(cv.pmask([(26, 28), (38, 28), (38, 33), (26, 33)]))
    cv.poly([(24, 29), (32, 22), (40, 29)], RED)
    cv.poly([(32, 22), (40, 29), (32, 29)], RED2)
    cv.outline(cv.pmask([(24, 29), (32, 22), (40, 29)]), BR0)
    tower(cv, 32, 36, 4, 12, roof=ROOF_R, flag=True)
    hs = [(12, 38, 'g', 'red'), (20, 44, 'l', 'brown'), (52, 38, 'l', 'red'), (44, 44, 'g', 'red'),
          (12, 52, 'l', 'red'), (52, 52, 'g', 'brown'), (22, 34, 'g', 'red')]
    for cx, by, k, r in sorted(hs, key=lambda t: t[1]):
        house(cv, cx, by, k, r, 7)
    well(cv, 32, 52)
    bush(cv, 8, 44, 2)
    bush(cv, 56, 44, 2)
    paste(cv, wc, front)
    arch(cv, 32, 60, 7, 7)
    for cx, by in [(14, 23), (50, 23), (5, 34), (59, 34)]:
        tower(cv, cx, by, 3, 10, roof=ROOF_B)
    for cx, by in [(5, 50), (59, 50)]:
        tower(cv, cx, by, 3, 10, roof=ROOF_R)
    tower(cv, 24, 60, 3, 11, roof=ROOF_R)
    tower(cv, 40, 60, 3, 11, roof=ROOF_R, flag=True)
    return finish(cv)


def build_harbor():
    W, Hh = 80, 64
    poly = [(14, 10), (66, 10), (77, 19), (77, 46), (3, 46), (3, 19)]
    cv, wc, sil, front, foot, inner = layered(W, Hh, poly, 3, 6, 34, cut=lambda c: (c.yy >= 41) & (c.xx >= 6) & (c.xx <= 74))
    # 남쪽 열린 쪽: 고리 마스크에서 남쪽 성벽(y>=43)을 뺀 것을 다시 그리기 위해, 바닥 전체를 부두 돌바닥으로 덮는다
    paste(cv, wc, ~front)
    # 부두 + 돌 방파 + 배
    for y in range(44, 52):
        for x in range(2, 78):
            cv.px(x, y, S3 if (x // 3 + y) % 2 else S2)
    cv.rect(2, 52, 77, 52, S0)
    cv.rect(2, 43, 77, 43, K)
    for px0 in (16, 38, 60):
        cv.rect(px0, 53, px0 + 1, 62, WOOD)
        cv.rect(px0, 53, px0, 62, WOOD2)
        cv.outline(cv.pmask([(px0, 53), (px0 + 1, 53), (px0 + 1, 62), (px0, 62)]), BR0)
    # 배 한 척(돛)
    cv.poly([(45, 58), (57, 58), (55, 62), (47, 62)], WOOD)
    cv.outline(cv.pmask([(45, 58), (57, 58), (55, 62), (47, 62)]), K)
    cv.rect(51, 48, 51, 58, BR0)
    cv.poly([(52, 49), (52, 57), (58, 57)], PALE)
    cv.poly([(50, 50), (50, 57), (46, 57)], C('#d8d8c8') if False else PALE)
    # 안쪽: 집, 시장, 작은 성채
    road(cv, [(40, 46), (40, 24)], 5, cv.yy > 14)
    cv.rect(33, 13, 47, 18, S3)
    cv.rect(41, 13, 47, 18, S2)
    cv.rect(33, 16, 47, 18, S1)
    cv.outline(cv.pmask([(33, 13), (47, 13), (47, 18), (33, 18)]))
    cv.poly([(31, 14), (40, 6), (49, 14)], RED)
    cv.poly([(40, 6), (49, 14), (40, 14)], RED2)
    cv.outline(cv.pmask([(31, 14), (40, 6), (49, 14)]), BR0)
    tower(cv, 40, 21, 4, 12, roof=ROOF_R, flag=True)
    hs = [(12, 24, 'g', 'red'), (24, 28, 'l', 'brown'), (56, 28, 'g', 'red'), (68, 24, 'l', 'red'),
          (12, 38, 'l', 'red'), (24, 40, 'g', 'brown'), (56, 40, 'l', 'brown'), (68, 38, 'g', 'red')]
    for cx, by, k, r in sorted(hs, key=lambda t: t[1]):
        house(cv, cx, by, k, r, 8)
    plaza(cv, 40, 38, 8, 3, inner)
    stall(cv, 34, 38, RED, PALE)
    stall(cv, 46, 38, C('#5a7aa8'), PALE)
    paste(cv, wc, front)
    for cx, by in [(14, 11), (66, 11), (4, 24), (76, 24)]:
        tower(cv, cx, by, 3, 10, roof=ROOF_B)
    tower(cv, 4, 45, 3, 10, roof=ROOF_R)
    tower(cv, 76, 45, 3, 10, roof=ROOF_R, flag=True)
    return finish(cv)


if __name__ == '__main__':
    for name, fn in (('capital-96', build_capital), ('fort-64', build_fort), ('harbor-80x64', build_harbor)):
        im = fn()
        im.save(os.path.join(OUT, name + '.png'))
        a = np.array(im)
        m = ~np.all(a == np.array(KEY), axis=2)
        bgn = np.zeros_like(a)
        bgn[:] = (60, 140, 70) if name != 'harbor-80x64' else (47, 106, 158)
        bgn[m] = a[m]
        Image.fromarray(bgn).resize((im.width * 6, im.height * 6), Image.NEAREST).save('/tmp/w5/%s.png' % name)
