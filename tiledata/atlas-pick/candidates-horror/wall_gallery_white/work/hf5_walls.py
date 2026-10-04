#!/usr/bin/env python3
"""미술관 벽면 두 장(흰·구역색) × A/B/C. 두 장은 같은 몰딩·걸레받이 높이(y0~3 · y28~31)를 쓴다."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from hf5_lib import Cv

# 공통 높이: 몰딩 y0~2, 몰딩 밑 그늘 y3, 넓은 면 y4~27, 걸레받이 y28~31 (윗줄 밝은 1px + 3px)
def wall(name_slug, tag, mats, molding, shade, face, baseboard, note, deco=None):
    c = Cv(32, 32)
    for y, (m, t) in enumerate(molding): c.hline(y, m, t)
    c.hline(3, *shade)
    for y in range(4, 28): c.hline(y, *face)
    for i, (m, t) in enumerate(baseboard): c.hline(28 + i, m, t)
    if deco: deco(c)
    c.emit(name_slug, tag, mats, note)
    return c

# ── 흰 벽 ──────────────────────────────────────────────
def white_A():
    def deco(c):
        # 이음: 오른쪽 x31 한 단 어둡게, 왼쪽 x0 한 단 밝게(이어 깔면 옅은 이음 한 줄)
        for y in range(4, 28): c.put(31, y, 'd', 4)
        for y in range(29, 32):
            c.put(31, y, 'g', {29: 2, 30: 1, 31: 0}[y])
        # 회벽 얼룩: 한 단 차 덩이 몇 점 (한 칸이 한 색이 되지 않게)
        for (x, y) in [(5, 7), (6, 7), (19, 6), (12, 14), (13, 14), (26, 12), (8, 22), (21, 20), (22, 20), (15, 25)]:
            c.put(x, y, 'd', 4)
        for (x, y) in [(3, 11), (4, 11), (16, 10), (24, 9), (10, 18), (28, 23), (18, 23)]:
            c.put(x, y, 'd', 6)
    return wall('wall_gallery_white', 'hf5-A', {'d': 'dust', 'g': 'grave'},
        [('d', 2), ('d', 6), ('d', 4)], ('d', 4), ('d', 5),
        [('g', 5), ('g', 3), ('g', 2), ('g', 1)],
        'A: v5 흰 벽 식구 — 얇은 몰딩(어둠·하이라이트·그늘) + 바랜 흰 칠 넓은 면(dust5) + 짙은 회 걸레받이 4px. 32px 마다 옅은 이음 한 줄, 회벽 얼룩은 한 단 차만.', deco)

def white_B():
    def deco(c):
        # 읽기: 굵은 몰딩 하이라이트, 걸레받이 윗줄 또렷. 무늬는 32px 이음 홈 하나(어두운 1px+밝은 1px)뿐.
        for y in range(4, 28): c.put(30, y, 'd', 4); c.put(31, y, 'd', 3); c.put(0, y, 'd', 6); 
        for y in range(29, 32):
            c.put(31, y, 'g', {29: 1, 30: 0, 31: 0}[y]); c.put(30, y, 'g', {29: 2, 30: 1, 31: 0}[y])
        for (x, y) in [(8, 9), (9, 9), (20, 15), (21, 15), (14, 21), (26, 8)]:
            c.put(x, y, 'd', 5)
        for (x, y) in [(6, 14), (7, 14), (23, 20), (24, 20), (17, 6)]:
            c.put(x, y, 'd', 6)
    return wall('wall_gallery_white', 'hf5-B', {'d': 'dust', 'g': 'grave', 'w': 'vmarble'},
        [('g', 2), ('w', 5), ('g', 3)], ('d', 3), ('d', 6),
        [('d', 3), ('g', 2), ('g', 1), ('g', 0)],
        'B: 어둠에서 읽히게 — 가장 밝은 넓은 면(dust6)과 어두운 걸레받이·몰딩의 명도 폭 최대. 몰딩 윗줄 흰 하이라이트, 걸레받이 윗줄 dust3 로 또렷한 선. 무늬는 32px 이음 홈 하나뿐.', deco)

def white_C():
    def deco(c):
        # 결: 회반죽 흙손 결(짧은 가로 획) + 몰딩 밑에서 흘러내린 물얼룩 몇 줄(한 단 어둡게), 세로 옅은 이음.
        for y in range(4, 28): c.put(31, y, 's', 3)
        strokes = [(3, 7, 3), (14, 9, 4), (22, 13, 3), (8, 15, 3), (27, 19, 3), (5, 22, 4), (16, 24, 3), (12, 18, 3)]
        for (x, y, n) in strokes:
            for i in range(n): c.wput(x + i, y, 's', 5 if (x + y) % 2 else 3)
        # 물얼룩: 몰딩 밑에서 아래로
        for (x, n) in [(9, 8), (10, 5), (22, 10), (23, 6), (27, 4)]:
            for i in range(n): c.put(x, 4 + i, 's', 3)
        for y in range(29, 32):
            c.put(31, y, 'g', {29: 2, 30: 1, 31: 0}[y])
        for (x, y) in [(14, 16), (15, 16), (30, 13), (4, 21), (21, 23)]:
            c.put(x, y, 's', 5)
    return wall('wall_gallery_white', 'hf5-C', {'s': 'sheet', 'g': 'grave', 'd': 'dust'},
        [('d', 2), ('d', 5), ('d', 3)], ('s', 2), ('s', 4),
        [('g', 5), ('g', 3), ('g', 2), ('g', 1)],
        'C: 재료 — sheet 램프 회반죽. 흙손 결(짧은 가로 획)과 몰딩 밑에서 흘러내린 물얼룩 다섯 줄(한 단 어둡게). 조용한 기본 벽이되 오래된 전시관 느낌.', deco)

# ── 구역색 벽 ───────────────────────────────────────────
def grey_A():
    def deco(c):
        for y in range(4, 28): c.put(31, y, 'g', 5)
        for y in range(29, 32): c.put(31, y, 'v', {29: 1, 30: 0, 31: 0}[y])
        for (x, y) in [(5, 7), (6, 7), (19, 6), (12, 14), (13, 14), (26, 12), (8, 22), (21, 20), (22, 20), (15, 25)]:
            c.put(x, y, 'g', 5)
        for (x, y) in [(3, 11), (4, 11), (16, 10), (24, 9), (10, 18), (28, 23), (18, 23)]:
            c.put(x, y, 'd', 4)   # 밝은 쪽 덩이(dust4 는 grave6 보다 한 칼 밝다)
    return wall('wall_gallery_grey', 'hf5-A', {'g': 'grave', 'v': 'void', 'd': 'dust'},
        [('g', 2), ('d', 3), ('g', 4)], ('g', 4), ('g', 6),
        [('g', 4), ('v', 3), ('v', 2), ('v', 1)],
        'A: 흰 벽과 같은 몰딩·걸레받이 높이, 넓은 면만 짙은 회청(grave6). 바닥(마루)보다 밝고 흰 벽(dust5)보다 어둡다. 걸레받이 void.', deco)

def grey_B():
    def deco(c):
        for y in range(4, 28): c.put(30, y, 'g', 5); c.put(31, y, 'g', 4); c.put(0, y, 'g', 6)
        for y in range(29, 32):
            c.put(31, y, 'v', 0); c.put(30, y, 'v', {29: 1, 30: 0, 31: 0}[y])
        for (x, y) in [(8, 9), (9, 9), (20, 15), (21, 15), (14, 21), (26, 8)]:
            c.put(x, y, 'g', 5)
    return wall('wall_gallery_grey', 'hf5-B', {'g': 'grave', 'v': 'void', 'd': 'dust', 'w': 'ward'},
        [('v', 2), ('d', 4), ('g', 2)], ('g', 3), ('w', 5),
        [('d', 2), ('v', 2), ('v', 1), ('v', 0)],
        'B: 어둠에서 읽히게 — 면 ward5(청록빛 회)로 가장 밝게, 몰딩 윗줄 dust4·걸레받이 윗줄 dust2 의 또렷한 선, 나머지 void 로 폭 최대.', deco)

def grey_C():
    def deco(c):
        # 결: 직물 세로 골 — 8px 주기(이음 없이 이어짐). 골 한 줄 한 단 어둡게 + 옆줄 한 단 밝게.
        for x in range(32):
            if x % 8 == 3:
                for y in range(4, 28): c.put(x, y, 'w', 3)
            elif x % 8 == 4:
                for y in range(4, 28): c.put(x, y, 'w', 5)
        for (x, y) in [(6, 10), (7, 10), (14, 17), (22, 8), (23, 8), (29, 21), (10, 23)]:
            c.put(x, y, 'w', 3)
        for y in range(29, 32): c.put(31, y, 'v', {29: 1, 30: 0, 31: 0}[y])
    return wall('wall_gallery_grey', 'hf5-C', {'w': 'ward', 'v': 'void', 'g': 'grave'},
        [('g', 2), ('g', 5), ('g', 3)], ('w', 2), ('w', 4),
        [('g', 4), ('v', 3), ('v', 2), ('v', 1)],
        'C: 재료 — ward 램프 직물(felt) 벽. 8px 주기 세로 결(한 단 어둡게)과 사이 짧은 세로 획으로 천 결. 무늬 없이 결만.', deco)

if __name__ == '__main__':
    which = sys.argv[1:] or ['wA', 'wB', 'wC', 'gA', 'gB', 'gC']
    fn = {'wA': white_A, 'wB': white_B, 'wC': white_C, 'gA': grey_A, 'gB': grey_B, 'gC': grey_C}
    for k in which: fn[k]()
