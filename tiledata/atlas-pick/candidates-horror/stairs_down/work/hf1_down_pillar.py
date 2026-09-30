#!/usr/bin/env python3
"""hf1 내림 계단(16x16 decal) + 기둥 돌·대리석(16x48 object) A/B/C. 손으로 놓은 단 표만 쓴다.
재생성: python3 tiledata/atlas-pick/candidates-horror/stairs_down/work/hf1_down_pillar.py"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'ceil_black', 'work'))
from hf1_lib import C, emit
MATS = {'g': 'grave', 'r': 'rot', 'v': 'void', 's': 'vstone', 'm': 'vmarble', 't': 'tarn', 'd': 'dust'}

# ---------- 내림 계단: 안쪽 14x14 (1..14), 바깥 1px 투명 ----------
def down(mat, rows_spec, lip_t, void_from, edge_dark, dither=False):
    """rows_spec = 위→아래 (높이, 윗면단, 앞면단) 목록. 첫 줄은 바닥 입술(lip_t)."""
    c = C(16, 16)
    y = 1
    c.hline(y, 2, 13, mat, lip_t); c.put(1, y, mat, lip_t - 1); c.put(14, y, mat, lip_t - 2)
    y += 1
    for (h, tt) in rows_spec:
        for j in range(h):
            for x in range(1, 15):
                # 단 첫 줄 = 밝은 모서리(+1), 나머지 = 앞면
                c.put(x, y + j, mat, tt + 1 if j == 0 else max(tt - 1, 0))
        y += h
    while y <= 14:
        c.hline(y, 1, 14, 'v', 1 if y < 13 else 0); y += 1
    # 좌우 벽 안쪽 모서리 한 단 어둡게, 마지막 줄 void
    for yy in range(2, 15):
        c.put(1, yy, c.m[yy][1] if c.m[yy][1] != '.' else mat, 0)
        c.put(14, yy, c.m[yy][14] if c.m[yy][14] != '.' else mat, 0)
    if dither:
        for yy, xs in ((5, range(2, 14, 2)), (9, range(3, 13, 2))):
            for x in xs: c.put(x, yy, 'v', 1)
    # 모서리 투명(네 귀퉁이)
    for (x, y0) in ((1, 1), (14, 1), (1, 14), (14, 14)): c.clear(x, y0)
    return c
def dA(): return down('g', [(2, 4), (2, 3), (3, 2), (2, 1)], 6, 0, 0)
def dB():
    c = down('g', [(2, 5), (3, 3), (3, 1), (2, 0)], 6, 0, 0)
    return c
def dC():
    c = down('r', [(2, 4), (2, 3), (3, 2), (2, 1)], 5, 0, 0, dither=True)
    # 젖은 돌 얼룩
    for x, y in ((4, 3), (10, 4), (6, 7), (11, 8)): c.put(x, y, 'r', 1)
    return c

# ---------- 기둥 ----------
def pillar(mat, mid, cap_t, foot_t, body, band=None, groove=None, cracks=(), gold=None):
    """16x48. 몸통 x3..12 를 왼→오른 단 body(10개). 머리 y0..5, 몸 y6..34, 밑동 y35..47."""
    c = C(16, 48)
    # 머리(캐피털): 위판 y1..2 는 윗면이 보임
    for x in range(1, 15): c.put(x, 1, mat, cap_t[0])
    for x in range(1, 15): c.put(x, 2, mat, cap_t[1])
    for x in range(1, 15): c.put(x, 3, mat, cap_t[2])
    for x in range(2, 14): c.put(x, 4, mat, cap_t[3])
    for x in range(3, 13): c.put(x, 5, mat, cap_t[4])
    c.put(1, 1, mat, cap_t[0] - 1); c.put(14, 1, mat, cap_t[0] - 2)
    c.hline(0, 3, 12, mat, cap_t[0] - 1)
    c.put(14, 2, mat, cap_t[1] - 1); c.put(14, 3, mat, cap_t[2] - 1)
    # 몸통
    for y in range(6, 36):
        for i, x in enumerate(range(3, 13)):
            c.put(x, y, mat, body[i])
    if groove:
        for y in range(8, 34):
            for x in groove: c.put(x, y, mat, max(body[x - 3] - 1, 0))
    for (x, y) in cracks: c.put(x, y, mat, 0)
    # 밑동: 몸통 아래로 넓어지는 받침 + 윗면
    for x in range(2, 14): c.put(x, 36, mat, foot_t[4])
    for x in range(2, 14): c.put(x, 37, mat, foot_t[3])
    for x in range(1, 15): c.put(x, 38, mat, foot_t[2])
    for y in range(39, 45):
        for x in range(1, 15): c.put(x, y, mat, foot_t[1] if y < 44 else foot_t[0])
    for x in range(1, 15): c.put(x, 45, mat, foot_t[0])
    for x in range(1, 15): c.put(x, 46, mat, max(foot_t[0] - 1, 0))
    c.put(14, 39, mat, max(foot_t[1] - 1, 0))
    for y in range(39, 46): c.put(14, y, mat, max(foot_t[1] - 1, 0)); c.put(13, y, mat, max(foot_t[1] - 1, 0)) if y > 41 else None
    for y in range(39, 46): c.put(1, y, mat, foot_t[1] + 1)
    if band: band(c)
    return c

def sA():
    return pillar('s', 0, [5, 4, 3, 2, 1], [5, 4, 3, 2, 1], [1, 2, 3, 4, 5, 5, 4, 3, 2, 1] if False else [1, 3, 4, 5, 5, 4, 3, 2, 1, 0])
def sB():
    return pillar('s', 0, [6, 5, 3, 2, 1], [6, 4, 2, 1, 0], [1, 4, 5, 6, 5, 3, 2, 1, 0, 0], groove=None)
def sC():
    return pillar('s', 0, [5, 4, 3, 2, 1], [5, 4, 3, 2, 1], [1, 3, 4, 5, 5, 4, 3, 2, 1, 0],
                  groove=(7,), cracks=[(5, 12), (5, 13), (6, 14), (9, 22), (9, 23), (10, 24), (4, 28)])
def gold_band(c):
    for y in (10, 11):
        for x in range(3, 13): c.put(x, y, 't', 4 if y == 10 else 3)
    for y in (30, 31):
        for x in range(3, 13): c.put(x, y, 't', 3 if y == 30 else 2)
    for x in range(2, 14): c.put(x, 42, 't', 3)
def mA(): return pillar('m', 0, [6, 5, 4, 3, 2], [6, 5, 4, 3, 2], [2, 4, 5, 6, 6, 5, 4, 3, 2, 1], band=gold_band)
def mB(): return pillar('m', 0, [6, 6, 4, 2, 1], [6, 5, 3, 1, 0], [1, 5, 6, 6, 5, 3, 2, 1, 0, 0], band=gold_band)
def mC():
    c = pillar('m', 0, [6, 5, 4, 3, 2], [6, 5, 4, 3, 2], [2, 4, 5, 6, 6, 5, 4, 3, 2, 1], band=gold_band,
               groove=(7,), cracks=[(6, 16), (6, 17), (7, 18), (5, 24)])
    for y in range(14, 30):  # 대리석 결: 비스듬한 어두운 줄
        pass
    for k, (x, y) in enumerate(((5, 13), (6, 14), (8, 20), (9, 21), (10, 22), (4, 26), (5, 27))):
        c.put(x, y, 'm', 3)
    return c

NOTES = {
 ('stairs_down', 'A'): 'A(v5 기본): 위 1줄 밝은 바닥 입술 → 단 4개가 한 단계씩 어두워져 void 로 · 1px 투명 테두리 · 양옆 안쪽 모서리 한 단 어둡게 · grave',
 ('stairs_down', 'B'): 'B(어둠에서 읽힘): 입술 grave 6 대 첫 단 5 → 3 → 1 → 0 의 큰 폭 하강 · 단 높이 2-3-3-2 · 밝은 입술 한 줄이 어둠에서 입구를 알린다',
 ('stairs_down', 'C'): 'C(재질·무늬): rot(젖은 나무 판) 단 · void 로 스며드는 디더 · 물 얼룩 점 · 마녀의 집풍',
 ('pillar_stone', 'A'): 'A(v5 기본): 머리 판 · 통기둥 왼쪽 밝음(원통 명암) · 넓어지는 밑동과 윗면 · vstone',
 ('pillar_stone', 'B'): 'B(어둠에서 읽힘): 명암 폭 1~6 · 왼쪽 밝은 띠 2px · 머리 위판 vstone 6 · 굵은 큰 패턴',
 ('pillar_stone', 'C'): 'C(재질·무늬): 세로 홈 한 줄 + 균열 세 곳 · 오래된 돌 · 마녀의 집풍',
 ('pillar_marble', 'A'): 'A(v5 기본): 흰 vmarble 통기둥 · tarn(금) 띠 위/아래 2줄 + 밑동 1줄 · 원통 명암',
 ('pillar_marble', 'B'): 'B(어둠에서 읽힘): 명암 1~6 큰 폭 · 흰 띠가 어둠에서 남는다 · 금띠 3줄',
 ('pillar_marble', 'C'): 'C(재질·무늬): 세로 홈 + 대리석 결(어두운 비스듬 점·균열) · 금띠',
}
def main():
    for cand, f in (('A', dA), ('B', dB), ('C', dC)):
        emit('stairs_down', f'hf1-{cand}', f(), MATS, NOTES[('stairs_down', cand)])
    for cand, f in (('A', sA), ('B', sB), ('C', sC)):
        emit('pillar_stone', f'hf1-{cand}', f(), MATS, NOTES[('pillar_stone', cand)])
    for cand, f in (('A', mA), ('B', mB), ('C', mC)):
        emit('pillar_marble', f'hf1-{cand}', f(), MATS, NOTES[('pillar_marble', cand)])
main()
