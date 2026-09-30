#!/usr/bin/env python3
"""hf1 오름 계단(나무·돌) A/B/C — 48x48 object. 단 표는 손으로 놓는다(계산·난수 없음).
위 = 0 단, 아래 = 첫 바닥 줄. 단 윗면 밝게·앞면 어둡게, 위로 갈수록 한 단씩 어두워져 검정(void)으로 사라진다.
재생성: python3 tiledata/atlas-pick/candidates-horror/stairs_up_wood/work/hf1_stairs.py"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'ceil_black', 'work'))
from hf1_lib import C, emit

def void(c, x0, x1, rows_end, tones):
    for y in range(rows_end):
        c.hline(y, x0, x1, 'v', tones[min(y * len(tones) // rows_end, len(tones) - 1)])

def steps(c, x0, x1, top_y, n, th, fh, top_mat, top_t, front_mat, front_t, hi=None, lastline=None):
    """n 단, 단 하나 = 윗면 th 줄 + 앞면 fh 줄. top_t/front_t = 위→아래 단별 단 번호."""
    y = top_y
    for k in range(n):
        for j in range(th):
            c.hline(y + j, x0, x1, top_mat, top_t[k])
        if hi is not None:  # 윗면 첫 줄 밝은 모서리
            c.hline(y, x0, x1, top_mat, hi[k])
        for j in range(fh):
            c.hline(y + th + j, x0, x1, front_mat, front_t[k])
        y += th + fh

def post(c, x0, w, y0, mat, tones, cap_tone, cap_h=2):
    """세로 기둥: tones = 왼→오른 단(밝은 왼쪽, 어두운 오른쪽 끝)."""
    for i in range(w):
        c.vline(x0 + i, y0, 47, mat, tones[i])
    c.hline(y0, x0, x0 + w - 1, mat, cap_tone)
    if cap_h > 1: c.hline(y0 + 1, x0, x0 + w - 1, mat, cap_tone - 1)

W = {'r': 'rot', 'm': 'mahog', 'd': 'dust', 'v': 'void', 'g': 'grave', 's': 'vstone', 'w': 'vwood'}

# ---------------- 나무 ----------------
def wood_A():
    c = C(48, 48)
    void(c, 4, 43, 8, [0, 0, 1, 2])
    n = 8
    steps(c, 4, 43, 8, n, 2, 3, 'r', [1, 1, 2, 2, 3, 3, 4, 4], 'm', [0, 0, 1, 1, 1, 2, 2, 3], hi=[1, 2, 2, 3, 3, 4, 5, 5])
    # 가장 윗단 끝 먼지 한 줄
    c.hline(10, 6, 41, 'd', 1)
    for x in (0, 44):
        post(c, x, 4, 4, 'r', [4, 3, 3, 1] if x == 0 else [4, 3, 2, 1], 5)
    c.vline(4, 6, 47, 'm', 0); c.vline(43, 6, 47, 'm', 0)
    return c
def wood_B():
    c = C(48, 48)
    void(c, 4, 43, 6, [0, 0, 1])
    n = 6
    steps(c, 4, 43, 6, n, 3, 4, 'r', [3, 3, 4, 4, 5, 5], 'm', [0, 0, 0, 0, 0, 1], hi=[4, 4, 5, 5, 6, 6])
    c.hline(9, 8, 39, 'd', 2)
    for x in (0, 44):
        post(c, x, 4, 3, 'r', [5, 4, 3, 1] if x == 0 else [5, 4, 2, 0], 6)
    c.vline(4, 5, 47, 'r', 0); c.vline(43, 5, 47, 'r', 0)
    return c
def wood_C():
    c = C(48, 48)
    void(c, 5, 42, 7, [0, 0, 1, 2])
    n = 7
    steps(c, 5, 42, 7, n, 2, 4, 'r', [1, 2, 2, 3, 3, 4, 5], 'm', [1, 1, 2, 2, 2, 3, 3], hi=[2, 3, 3, 4, 4, 5, 6])
    # 널 이음(앞면에 세로 홈 두 줄씩, 단마다 엇갈림)
    y = 7
    for k in range(n):
        for x in range((9 if k % 2 == 0 else 18), 42, 16):
            c.vline(x, y + 2, y + 5, 'r', 0)
            c.put(x, y + 1 + 1, 'r', 0)
        # 못 머리
        for x in (8 + (k % 2) * 4, 30 + (k % 2) * 4):
            c.put(x, y, 'r', 6)
        y += 6
    # 난간 기둥: 볼록 마디
    for x0 in (0, 44):
        for y in range(3, 48):
            bulge = (y - 3) % 12 in (4, 5, 6)
            xs = range(x0, x0 + 4)
            for i, x in enumerate(xs):
                t = [4, 3, 2, 1][i] if x0 == 0 else [4, 3, 2, 1][i]
                if bulge: t += 1
                c.put(x, y, 'r', min(t, 6))
        c.hline(3, x0, x0 + 3, 'r', 6); c.hline(4, x0, x0 + 3, 'r', 5)
    c.vline(4, 5, 47, 'm', 0); c.vline(43, 5, 47, 'm', 0)
    return c

# ---------------- 돌 ----------------
def cheeks(c, xs, top, tones_l, tones_r, cap):
    for x0, tt in xs:
        for i in range(3):
            c.vline(x0 + i, top, 47, 's', tt[i])
        c.hline(top, x0, x0 + 2, 's', cap)
def stone_A():
    c = C(48, 48)
    void(c, 3, 44, 8, [0, 0, 1, 2])
    steps(c, 3, 44, 8, 8, 2, 3, 'g', [2, 2, 3, 3, 3, 4, 4, 5], 'g', [0, 0, 1, 1, 1, 1, 2, 2], hi=[3, 3, 4, 4, 4, 5, 5, 6])
    c.hline(10, 6, 41, 'd', 1)
    for x0, tt in ((0, [3, 2, 1]), (45, [3, 2, 0])):
        for i in range(3): c.vline(x0 + i, 5, 47, 's', tt[i])
        c.hline(5, x0, x0 + 2, 's', 5)
    return c
def stone_B():
    c = C(48, 48)
    void(c, 3, 44, 6, [0, 0, 1])
    steps(c, 3, 44, 6, 6, 3, 4, 'g', [3, 3, 4, 4, 5, 5], 's', [0, 0, 0, 0, 0, 1], hi=[5, 5, 5, 5, 6, 6])
    c.hline(9, 8, 39, 'd', 2)
    for x0, tt in ((0, [4, 2, 0]), (45, [4, 2, 0])):
        for i in range(3): c.vline(x0 + i, 4, 47, 's', tt[i])
        c.hline(4, x0, x0 + 2, 's', 6)
    return c
def stone_C():
    c = C(48, 48)
    void(c, 3, 44, 7, [0, 0, 1, 2])
    n = 7
    steps(c, 3, 44, 7, n, 2, 4, 'g', [2, 3, 3, 4, 4, 5, 5], 'g', [1, 1, 2, 2, 2, 3, 3], hi=[3, 4, 4, 5, 5, 6, 6])
    y = 7
    for k in range(n):  # 블록 이음, 단마다 엇갈림
        for x in range(8 + (k % 2) * 8, 44, 16):
            c.vline(x, y + 2, y + 5, 'g', 0)
        # 깨진 모서리
        c.put(3 + (k * 7) % 30 + 4, y + 2, 'g', 0); c.put(3 + (k * 11) % 30 + 6, y + 3, 'g', 0)
        y += 6
    for x0, tt in ((0, [3, 2, 1]), (45, [3, 2, 0])):
        for i in range(3): c.vline(x0 + i, 5, 47, 's', tt[i])
        c.hline(5, x0, x0 + 2, 's', 5)
        for yy in range(9, 47, 8):  # 쌓은 이음
            c.hline(yy, x0, x0 + 2, 's', 0)
    return c

NOTES = {
 ('stairs_up_wood', 'A'): 'A(v5 기본): 나무 단 8개 · 윗면 rot 밝게/앞면 mahog 어둡게 · 위로 갈수록 한 단계씩 어두워져 void 로 · 양옆 4px 난간 기둥(왼쪽 밝음) · 끝단에 dust 한 줄',
 ('stairs_up_wood', 'B'): 'B(어둠에서 읽힘): 6단 · 윗면 rot 4~6 대 앞면 mahog 0 의 큰 명암 · 단 앞 모서리 1px 밝은 줄 · 기둥 머리 rot 6 · 어둠판에서도 단 윤곽이 산다',
 ('stairs_up_wood', 'C'): 'C(재질·무늬): 7단 · 앞면 널 이음(엇갈림)+못 머리 · 난간 기둥은 볼록 마디 · 마녀의 집풍 나무 결',
 ('stairs_up_stone', 'A'): 'A(v5 기본): 돌 단 8개 · 윗면 grave 밝게/앞면 어둡게 · 난간 없음, 양옆 3px 돌 볼(vstone, 위가 밝은 뚜껑) · 끝단 dust 한 줄',
 ('stairs_up_stone', 'B'): 'B(어둠에서 읽힘): 6단 · 윗면 grave 3~5 + 모서리 vstone 5~6 대 앞면 vstone 0 · 볼 뚜껑 vstone 6 · 큰 명암',
 ('stairs_up_stone', 'C'): 'C(재질·무늬): 7단 · 앞면 블록 이음(엇갈림)+깨진 모서리 · 볼에 쌓은 이음 · 닳은 돌',
}
def main():
    mats = {'r': 'rot', 'm': 'mahog', 'd': 'dust', 'v': 'void', 'g': 'grave', 's': 'vstone'}
    for cand, f in (('A', wood_A), ('B', wood_B), ('C', wood_C)):
        emit('stairs_up_wood', f'hf1-{cand}', f(), mats, NOTES[('stairs_up_wood', cand)])
    for cand, f in (('A', stone_A), ('B', stone_B), ('C', stone_C)):
        emit('stairs_up_stone', f'hf1-{cand}', f(), mats, NOTES[('stairs_up_stone', cand)])
main()
