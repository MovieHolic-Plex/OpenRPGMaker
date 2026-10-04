import sys, os; sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'wall_stone_block', 'work'))
from hf7_lib import *

def slabs(g, mat, bands, mort, hi_cap, lo_min=1):
    """bands: [(y0, h, xs, [(w, base)...])] 각 띠 아래 한 줄이 가로 줄눈."""
    for y0, h, xs, bl in bands:
        g.hline(0, y0 + h, 32, mat, mort)
        x = xs
        for w, base in bl:
            g.rect(x + w - 1, y0, 1, h, mat, mort)
            hi = min(base + 1, hi_cap); lo = max(base - 1, lo_min)
            g.rect(x, y0, w - 1, h, mat, base)
            g.hline(x, y0, w - 1, mat, hi); g.vline(x, y0, h, mat, hi)
            g.hline(x + 1, y0 + h - 1, w - 2, mat, lo)
            x += w

def A():
    g = G(32, 32, True, True)
    slabs(g, 's', [(0, 9, 0, [(16, 2), (8, 3), (8, 2)]), (10, 10, 6, [(12, 3), (12, 2), (8, 3)]), (21, 10, 12, [(8, 2), (16, 3), (8, 2)])], 1, 3)
    # 금 하나(둘째 띠 큰 돌 위): 어두운 대각선 6px
    g.pts('s', [(20, 12, 1), (21, 13, 1), (21, 14, 1), (22, 15, 1), (22, 16, 1), (23, 17, 1)])
    return g, {'s': 'vstone'}

def B():
    g = G(32, 32, True, True)
    slabs(g, 's', [(0, 15, 0, [(16, 3), (16, 2)]), (16, 15, 8, [(16, 2), (16, 3)])], 0, 4)
    g.pts('s', [(6, 8, 1), (7, 8, 1), (7, 9, 1), (8, 10, 1), (24, 22, 1), (25, 23, 1)])
    return g, {'s': 'grave'}

def C():
    g = G(32, 32, True, True)
    slabs(g, 's', [(0, 9, 0, [(9, 2), (13, 3), (10, 2)]), (10, 10, 5, [(14, 3), (10, 2), (8, 3)]), (21, 10, 11, [(11, 2), (9, 3), (12, 2)])], 1, 3)
    g.pts('s', [(3, 3, 1), (4, 4, 1), (4, 5, 1), (5, 6, 1), (18, 13, 1), (19, 14, 1), (19, 15, 1), (20, 16, 1), (20, 17, 1),
                (25, 24, 1), (26, 25, 1), (11, 5, 3), (12, 5, 3), (8, 27, 1), (30, 3, 1)])
    g.pts('m', [(13, 9, 2), (14, 9, 2), (15, 9, 1), (4, 20, 2), (5, 20, 2), (5, 19, 2), (19, 31, 2), (20, 31, 2), (27, 20, 2)])
    return g, {'s': 'grave', 'm': 'hmoss'}

NOTES = {
 'A': 'A(v5 식구·깨끗): 크기 다른 판석(16·12·8) 세 띠, 판석 톤 2/3 + 줄눈 1, 금 하나. 사방 이어짐. 벽 4~5보다 두 단 어둡게',
 'B': 'B(어둠에서 읽힘): 큰 판석 16×15만, 톤 2/3 두 가지 + 검정 줄눈 0으로 어두워도 칸이 보임. 금 하나',
 'C': 'C(재질·무늬): 제각각 크기 판석 + 금 두 개 + 줄눈 이끼 셋 + 얽은 자국. grave/hmoss',
}
if __name__ == '__main__':
    for c, f in (('A', A), ('B', B), ('C', C)):
        g, mats = f(); emit('floor_stone', c, 32, 32, mats, g, NOTES[c], tile=True)
