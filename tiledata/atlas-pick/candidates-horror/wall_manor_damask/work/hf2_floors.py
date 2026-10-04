#!/usr/bin/env python3
"""hf2 바닥 아홉 장(마루·카펫·체크 × A·B·C). 32x32 @tile."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from hf2_lib import Cv

# ───────── 마루 ─────────
def plank_A():
    """v5 짙은 마루 결(파일럿 식구): 가로 널 4px 여덟, 판 단 3·4 번갈이, 틈 2, 이음 다섯 판, 결 한 단, 옹이 하나"""
    c = Cv(32, 32, ('w', 3))
    base = [4, 3, 4, 3, 4, 4, 3, 4]
    joints = {0: 21, 2: 7, 3: 28, 5: 14, 6: 2}
    grain = {0: (2, 3, 14), 1: (1, 20, 29), 3: (2, 5, 19), 4: (1, 12, 27), 6: (1, 16, 25), 7: (2, 22, 35)}
    for k, b in enumerate(base):
        for r in range(4):
            for x in range(32): c.put(x, k * 4 + r, 'w', b if r < 3 else 2)
        if k in grain:
            r, x0, x1 = grain[k]
            for x in range(x0, x1 + 1): c.put(x, k * 4 + r, 'w', b - 1)
        if k in joints:
            j = joints[k]
            for r in range(3): c.put(j, k * 4 + r, 'w', 2)
            c.put(j + 1, k * 4, 'w', b + 1); c.put(j + 2, k * 4, 'w', b + 1)
    for (x, y, tn) in ((26, 9, 3), (27, 9, 2), (26, 10, 2), (27, 10, 3)): c.put(x, y, 'w', tn)
    return c, {'w': 'vdwood'}, 'A(v5 식구): 가로 널 4px 여덟, 판 단 3·4 번갈이, 틈 한 단 어둡게, 이음 다섯 판, 결 여섯 줄 한 단, 옹이 하나'

def plank_B():
    """어둠에서 읽힘: 널 8px 넷 · 판 밝기 5/3 크게 번갈이 · 틈 한 줄 깊게(1) · 무늬 없음, 이음 두 곳만"""
    c = Cv(32, 32)
    base = [5, 3, 4, 3]
    for k, b in enumerate(base):
        for r in range(8):
            for x in range(32):
                c.put(x, k * 8 + r, 'w', b)
        for x in range(32):
            c.put(x, k * 8 + 7, 'w', 1)
            c.put(x, k * 8, 'w', min(b + 1, 6))
    for (k, j) in ((0, 13), (2, 27)):
        for r in range(1, 7): c.put(j, k * 8 + r, 'w', 1)
    return c, {'w': 'vdwood'}, 'B(어둠에서 읽힘): 널 8px 넷, 판마다 5·3·4·3 로 크게 갈리고 위 끝 한 줄 밝게·아래 틈 깊게. 무늬 없이 큰 면 + 이음 두 곳'

def plank_C():
    """재료·무늬: 헤링본 없이 바구니짜기 마루 — 8px 정사각 조각 가로/세로 널을 번갈아, 널마다 결·못"""
    c = Cv(32, 32)
    for by in range(4):
        for bx in range(4):
            horiz = (bx + by) % 2 == 0
            x0, y0 = bx * 8, by * 8
            for j in range(8):
                for i in range(8):
                    u, v = (j, i) if horiz else (i, j)       # u = 널 두께 방향(0..7), v = 널 길이 방향
                    pl = u // 4; r = u % 4
                    tone = (4 if pl == 0 else 3)
                    if r == 3: tone = 1
                    elif r == 0: tone = tone + 1
                    elif (v * 3 + r * 5 + bx * 7 + by * 2) % 6 == 0: tone = tone - 1     # 결 알갱이
                    if v == 7: tone = 2 if r != 3 else 1                                   # 조각 끝 틈
                    X, Y = (x0 + i, y0 + j)
                    c.put(X, Y, 'r', tone)
    for (x, y) in ((1, 1), (6, 6), (17, 9), (22, 14), (9, 22), (30, 27)):                # 못 머리
        c.put(x, y, 'r', 6)
    return c, {'r': 'rot'}, 'C(바구니짜기): 8px 조각을 가로·세로 널로 번갈이 깔아 4×4, 널 4px 마다 위 밝고 아래 틈, 알갱이 결, 못 머리 몇 개(rot)'

# ───────── 카펫 ─────────
def carpet_A():
    """짙은 자줏빛 회 바탕(damask 2) + 16px 반복 작은 마름모(3, 한 단 밝게)"""
    c = Cv(32, 32, ('d', 2))
    m = ['.....a.....', '....aba....', '...a.b.a...', '....aba....', '.....a.....']
    D = [(1, 1), (9, 1), (1, 9), (9, 9)]
    # 16px 반복: 한 주기 안에 마름모 하나(5x5) + 모서리 점
    dia = ['..a..', '.aba.', 'abcba', '.aba.', '..a..']
    for ox in (0, 16):
        for oy in (0, 16):
            c.stamp(dia, ox + 5, oy + 5, {'a': ('d', 3), 'b': ('d', 3), 'c': ('d', 2)})
            c.put(ox + 13, oy + 13, 'd', 3); c.put(ox + 13, oy + 5, 'd', 3) if False else None
            c.put(ox + 13, oy + 13, 'd', 3)
            c.put(ox + 0, oy + 0, 'd', 1); 
    return c, {'d': 'damask'}, 'A(v5 식구): 자줏빛 회 카펫(damask 2) + 16px 반복 작은 마름모 한 단 밝게(3) + 귀퉁이 점, 짙은 점 하나'

def carpet_B():
    """어둠에서 읽힘: 짙은 남청(vblue 1) 바탕 + 큰 마름모 격자 선(vblue 3 한 줄) — 16px 주기, 성긴 큰 무늬"""
    c = Cv(32, 32, ('b', 0))
    for y in range(32):
        for x in range(32):
            if (x + y) % 16 == 0 or (x - y) % 16 == 0: c.put(x, y, 'b', 1)
    for oy in (0, 16):
        for ox in (0, 16):
            c.put(ox, oy, 'b', 2); c.put(ox + 8, oy + 8, 'b', 2)
    return c, {'b': 'vblue'}, 'B(어둠에서 읽힘): 짙은 남청(vblue 1) 바탕(0)에 16px 마름모 격자 한 줄(1) + 교차·중심 점(2). 무늬가 성겨 어두운 판에서도 격자가 읽힘'

def carpet_C():
    """재료: 벨벳 결(깔림 방향 1화소 요철) 위 4잎 꽃 메달리온 16px 반복 — 자주(damask) 1~4"""
    c = Cv(32, 32, ('d', 2))
    for y in range(32):
        for x in range(32):
            if (x * 5 + y * 3) % 7 == 0: c.put(x, y, 'd', 3 if (x + y) % 2 == 0 else 1)   # 벨벳 결 알갱이
    flower = ['..a.a..', '.abaaba' if False else '.abcba.', 'abcdcba', '.abcba.', '..a.a..'][:0]
    fl = ['.a.a.', 'aabaa', '.bcb.', 'aabaa', '.a.a.']
    for ox in (0, 16):
        for oy in (0, 16):
            c.stamp(fl, ox + 5, oy + 5, {'a': ('d', 4), 'b': ('d', 3), 'c': ('d', 5)})
            for (x, y) in ((ox + 14, oy + 14), (ox + 14, oy + 1), (ox + 1, oy + 14)): c.put(x, y, 'd', 3)
    return c, {'d': 'damask'}, 'C(벨벳 결+메달리온): 자줏빛 벨벳 바탕에 결 알갱이(1·3), 16px 마다 4잎 꽃 메달리온(3·4·5), 모서리 점'

# ───────── 체크 ─────────
def checker(hi, lo, grout_hi, grout_lo, crack, extra=None):
    c = Cv(32, 32)
    for y in range(32):
        for x in range(32):
            light = ((x // 8) + (y // 8)) % 2 == 0
            mat, tn = hi if light else lo
            if x % 8 == 7 or y % 8 == 7: mat, tn = (grout_hi if light else grout_lo)
            c.put(x, y, mat, tn)
    if extra: extra(c)
    for (x, y, mat, tn) in crack: c.put(x, y, mat, tn)
    return c

def checker_A():
    def ex(c):
        for (x, y) in ((2, 3), (11, 4), (21, 3), (5, 12), (20, 13), (3, 20), (12, 21), (29, 21), (23, 28)):    # 한 단 얼룩
            mat, tn = c.get(x, y); tn = int(tn, 16); c.put(x, y, mat, tn + 1 if mat == 'd' and tn < 4 else tn - 1)
    crack = [(x, y, 'g', 0) for x, y in ((12, 10), (13, 11), (13, 12), (14, 13), (15, 13))]
    c = checker(('d', 3), ('g', 3), ('d', 2), ('g', 2), crack, ex)
    return c, {'d': 'dust', 'g': 'grave'}, 'A(v5 식구): 회백(dust 3)·짙은 회(grave 3) 8px 체크, 줄눈 1px 한 단 어둡게, 얼룩 한 단, 금 한 줄(대각 5화소)'

def checker_B():
    crack = [(x, y, 'g', 0) for x, y in ((19, 21), (19, 22), (20, 23), (20, 24))]
    c = checker(('d', 3), ('g', 0), ('d', 2), ('g', 0), crack)
    # 짙은 칸에 한 단 결(가장자리 위·왼 한 줄)
    for y in range(32):
        for x in range(32):
            if ((x // 8) + (y // 8)) % 2 == 1 and (x % 8 == 0 or y % 8 == 0): c.put(x, y, 'g', 1)
            if ((x // 8) + (y // 8)) % 2 == 0 and (x % 8 == 0 or y % 8 == 0): c.put(x, y, 'd', 4)
    return c, {'d': 'dust', 'g': 'grave'}, 'B(어둠에서 읽힘): 밝은 칸(dust 4)·거의 검은 칸(grave 0) 크게 갈라, 밝은 칸 위·왼 테 한 줄 더 밝게(5). 줄눈 2/0, 금 한 곳(네 화소)'

def checker_C():
    """재료: 대리석 결 — 칸마다 가는 맥, 칸이 하나씩 다른 단 살짝, 줄눈 한 단, 금 한 곳, 모서리 깨짐 하나"""
    veins = {(0, 0): [(1, 5), (2, 4), (3, 4), (4, 3), (5, 3), (6, 2)], (1, 1): [(9, 12), (10, 12), (11, 13), (12, 13), (13, 14), (14, 15)],
             (2, 0): [(17, 2), (18, 3), (19, 3), (20, 4), (21, 5)], (3, 1): [(26, 9), (27, 9), (28, 10), (29, 11), (30, 11)],
             (0, 2): [(2, 18), (3, 19), (4, 19), (5, 20), (6, 21)], (1, 3): [(9, 26), (10, 26), (11, 27), (12, 28), (13, 28)],
             (2, 2): [(18, 17), (19, 18), (20, 18), (21, 19), (22, 20)], (3, 3): [(25, 25), (26, 26), (27, 26), (28, 27), (29, 28)]}
    def ex(c):
        for (bx, by), pts in veins.items():
            light = (bx + by) % 2 == 0
            for (x, y) in pts: c.put(x, y, 'd', 2) if light else c.put(x, y, 'g', 4)
        for (x, y) in ((0, 0), (1, 0), (0, 1)): c.put(x, y, 'g', 1)                                # 모서리 깨짐(어둡게)
    crack = [(x, y, 'g', 0) for x, y in ((14, 17), (15, 18), (15, 19), (16, 20))]
    c = checker(('d', 3), ('g', 3), ('d', 2), ('g', 2), crack, ex)
    return c, {'d': 'dust', 'g': 'grave'}, 'C(대리석 결): 8px 체크 각 칸에 가는 맥(밝은 칸엔 어둡게 dust 2, 짙은 칸엔 밝게 grave 4), 줄눈 한 단, 금 한 곳, 모서리 깨짐 하나'

JOBS = {'floor_manor_plank': (plank_A, plank_B, plank_C),
        'floor_manor_carpet': (carpet_A, carpet_B, carpet_C),
        'floor_checker': (checker_A, checker_B, checker_C)}
if __name__ == '__main__':
    for slug, fs in JOBS.items():
        for v, f in zip('ABC', fs):
            c, mats, note = f()
            c.emit(slug, f'hf2-{v}', mats, note, tile=True)
    print('ok')
