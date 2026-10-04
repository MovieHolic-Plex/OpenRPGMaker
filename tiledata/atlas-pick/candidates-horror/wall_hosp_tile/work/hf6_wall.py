#!/usr/bin/env python3
"""wall_hosp_tile hf6 A·B·C — 화소마다 (재료, 단)을 손으로 정한다. 32x32, 가로 32px 주기.
세로: y0~2 몰딩 · y3~11 칠 · y12~13 턱(위 밝은 줄+밑 그늘) · y14~20 타일 1단(+y21 줄눈) · y22~28 타일 2단 · y29~31 걸레받이."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from hf6_lib import C, emit
SLUG, W = 'wall_hosp_tile', 'hf6'
MATS = {'a': 'ward', 's': 'sheet', 'g': 'grave', 'r': 'rust', 'm': 'murk', 'd': 'dust'}

def molding_paint(c, m0, m1, m2, plane, shadow_row=None):
    c.row(0, 0, 31, 'a', m0); c.row(1, 0, 31, 'a', m1); c.row(2, 0, 31, 'a', m2)
    c.rect(3, 11, 0, 31, 'a', plane)

def skirting(c, top, mid, low):
    c.row(29, 0, 31, 'a', top); c.row(30, 0, 31, 'a', mid); c.row(31, 0, 31, 'a', low)

def tile_course(c, y0, y1, xoff, tones, face, joint_mat, joint_tone, bevel=True, hi=1, lo=1):
    """한 단: 타일 폭 7 + 줄눈 1 (피치 8). tones[i] = i번째 타일 바탕 단."""
    for i in range(4):
        base = tones[i]
        xs = xoff + 8 * i
        for y in range(y0, y1 + 1):
            for k in range(7):
                t = base
                if bevel:
                    if y == y0 or k == 0: t = base + hi
                    if y == y1 or k == 6: t = base - lo
                    if (y == y0 and k == 6) or (y == y1 and k == 0): t = base
                c.put(y, xs + k, face, t)
            c.put(y, xs + 7, joint_mat, joint_tone)

def build_A():
    c = C(32, 32, wrap=True)
    molding_paint(c, 5, 5, 3, 4)
    # 칠은 조용하게: 낡음 한 단만 (얼룩 몇 점)
    for (y, x) in [(6, 5), (7, 5), (7, 6), (9, 21), (10, 21), (10, 22), (5, 27)]: c.put(y, x, 'a', 3)
    for (y, x) in [(4, 13), (4, 14), (5, 13)]: c.put(y, x, 'a', 5)
    c.row(12, 0, 31, 's', 5); c.row(13, 0, 31, 'g', 2)          # 턱
    tile_course(c, 14, 20, 0, [4, 4, 3, 4], 's', 'g', 3)
    c.row(21, 0, 31, 'g', 3)
    tile_course(c, 22, 28, 0, [4, 3, 4, 4], 's', 'g', 3)
    skirting(c, 4, 1, 0)
    return c

def build_B():
    c = C(32, 32, wrap=True)
    molding_paint(c, 6, 5, 2, 5)
    c.row(12, 0, 31, 's', 6); c.row(13, 0, 31, 'g', 1)
    for (y0, y1) in [(14, 20), (22, 28)]:
        for i in range(4):
            xs = 8 * i
            for y in range(y0, y1 + 1):
                for k in range(7): c.put(y, xs + k, 's', 4 if y == y1 else 5)
                c.put(y, xs + 7, 'g', 1)
    c.row(21, 0, 31, 'g', 1)
    skirting(c, 4, 1, 0)
    return c

def build_C():
    c = C(32, 32, wrap=True)
    molding_paint(c, 5, 4, 2, 4)
    # 칠: 들뜬 조각(3단 + 밑에 회반죽 sheet 2) — 몇 군데만
    for (y, x) in [(4, 3), (4, 4), (5, 3), (5, 4), (5, 5), (6, 4)]: c.put(y, x, 'a', 3)
    c.put(6, 5, 's', 2); c.put(7, 4, 's', 2); c.put(7, 5, 's', 2); c.put(6, 3, 's', 2)
    for (y, x) in [(8, 19), (8, 20), (9, 19), (9, 20), (9, 21), (10, 20)]: c.put(y, x, 'a', 3)
    c.put(10, 21, 's', 2); c.put(10, 19, 's', 2)
    for (y, x) in [(3, 12), (4, 12), (5, 12), (6, 13), (7, 13), (8, 13), (9, 13), (10, 13), (11, 13)]: c.put(y, x, 'r', 2)   # 물 자국
    c.put(11, 12, 'r', 1); c.put(11, 14, 'r', 1)
    for (y, x) in [(6, 27), (7, 27), (7, 28), (8, 28), (9, 28), (5, 26)]: c.put(y, x, 'a', 5)
    c.row(12, 0, 31, 's', 4); c.row(13, 0, 31, 'g', 1)
    tile_course(c, 14, 20, 0, [4, 5, 3, 4], 's', 'g', 2, bevel=True, hi=1, lo=1)
    c.row(21, 0, 31, 'g', 2)
    tile_course(c, 22, 28, 4, [4, 3, 4, 5], 's', 'g', 2, bevel=True, hi=1, lo=1)   # 반 칸 엇갈림
    # 줄눈 얼룩(곰팡이 murk)
    for x in (7, 15): c.put(21, x, 'm', 2)
    for x in (4, 5, 6): c.put(21, x, 'm', 1)
    for y in (24, 25, 26, 27): c.put(y, 11, 'm', 1)
    # 깨진 타일 한 모서리(밑바탕 회반죽 sheet 2 → 그 밑 grave)
    for (y, x) in [(22, 20), (22, 21), (23, 20)]: c.put(y, x, 'g', 2)
    c.put(23, 21, 's', 2)
    # 걸레받이: 물때
    skirting(c, 4, 1, 0)
    for x in (2, 3, 4, 17, 18): c.put(29, x, 'a', 3)
    return c

NOTES = {
 'A': 'v5 결 기본: 칠(ward4)+흰 타일 7px+줄눈 grave3, 위=칠 아래=타일 2단, 타일마다 왼위 한 단 밝고 오른아래 한 단 어둡게; 낡음은 타일 두 장·칠 얼룩 한 단만',
 'B': '어둠에서 읽히게: 칠 ward5·타일 sheet5 큰 면 둘, 턱 sheet6 한 줄+밑 grave1, 줄눈 grave1 홑줄, 걸레받이 ward1/0 — 무늬는 줄눈뿐',
 'C': '재료 결: 타일마다 다른 단·2단은 반 칸 엇갈림, 줄눈 곰팡이(murk)·턱에서 흐른 녹물(rust)·들뜬 칠 밑 회반죽·깨진 모서리 한 곳',
}
for L, b in (('A', build_A), ('B', build_B), ('C', build_C)):
    emit(SLUG, W, L, b(), MATS, NOTES[L])
print('ok')
