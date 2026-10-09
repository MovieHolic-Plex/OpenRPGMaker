#!/usr/bin/env python3
"""미술관 바닥 두 장(마루·돌판) × A/B/C. 2×2(32×32) @tile — 사방 이어짐. 널·판 배치는 표로 손으로 정한다."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from hf5_lib import Cv

# ── 마루 A: 4px 긴 널 8줄. 줄마다 (몸통 단, 이음 x 들, 결 획) 를 손으로 ────────────────────
# 줄: y=4k 갭(단1), y=4k+1 윗줄 하이라이트(몸통+1), y=4k+2~3 몸통
PLANK_A = [
    # (몸통단, [(이음x, 이음 뒤 몸통단)...], [결 (x,len,y오프셋 2|3)])
    (3, [(6, 2), (22, 3)], [(10, 5, 2), (26, 4, 3)]),
    (2, [(14, 3)],         [(2, 4, 3), (20, 5, 2)]),
    (3, [(26, 2)],         [(8, 6, 3), (15, 3, 2)]),
    (2, [(2, 3), (18, 2)], [(11, 4, 2), (25, 5, 3)]),
    (3, [(10, 2)],         [(1, 5, 2), (18, 4, 3)]),
    (2, [(30, 3), (16, 3)],[(5, 5, 3), (22, 4, 2)]),
    (3, [(21, 2)],         [(12, 5, 2), (27, 3, 3)]),
    (2, [(8, 3), (28, 2)], [(16, 5, 3), (2, 3, 2)]),
]
def wood_A():
    c = Cv(32, 32)
    for k, (tone, joints, grain) in enumerate(PLANK_A):
        y0 = 4 * k
        # 이음 위치로 구간 나누기: 첫 구간 몸통단=tone, 이음마다 다음 구간 단
        segs = []; xs = [j[0] for j in joints]; tones = [tone] + [j[1] for j in joints]
        # 구간 i : [xs[i-1], xs[i]) , 첫 구간은 마지막 이음에서 감아 이어짐
        order = sorted(range(len(joints)), key=lambda i: xs[i])
        bx = [xs[i] for i in order]; bt = [tone] + [joints[i][1] for i in order]
        # 감김: 마지막 이음 뒤 구간 단이 bt[-1], 첫 이음 앞(x<bx[0])도 같은 널 → bt[-1]
        def tone_at(x):
            t = bt[-1]
            for i, b in enumerate(bx):
                if x >= b: t = bt[i + 1]
            return t
        for x in range(32):
            t = tone_at(x)
            c.put(x, y0, 'w', 1)
            c.put(x, y0 + 1, 'w', t + 1)
            c.put(x, y0 + 2, 'w', t); c.put(x, y0 + 3, 'w', t)
        for b in bx:                       # 이음: 세로 1px 갭 (윗줄 하이라이트 포함 3줄)
            for dy in (1, 2, 3): c.put(b, y0 + dy, 'w', 1)
            c.put((b + 1) % 32, y0 + 1, 'w', tone_at(b) + 1)   # 이음 오른쪽 밝은 모서리
        for (gx, ln, oy) in grain:
            for i in range(ln): c.wput(gx + i, y0 + oy, 'w', tone_at((gx + i) % 32) - 1)
    # 옹이 하나(널 3, x=12): 어두운 2×2 점 + 밝은 한 점
    for (x, y, t) in [(12, 14, 1), (13, 14, 1), (12, 15, 1), (11, 14, 2), (13, 15, 2)]: c.put(x, y, 'w', t)
    # 광택 한 줄(왼위 빛): 널 5 (y=16..19) 윗줄에 dust 아닌 vpine4 로 짧게
    for x in range(2, 9): c.put(x, 17, 'w', 4)
    c.emit('floor_gallery_wood', 'hf5-A', {'w': 'vpine'},
           'A: v5 밝은 널마루 식구 — 4px 널 8줄, 줄마다 갭(단1)·윗줄 하이라이트·몸통(2/3 교대), 이음 드물게(줄당 1~2), 결 획·옹이 하나·광택 한 줄. 사방 이어짐.', tile=True)

# ── 마루 B: 8px 큰 널 4줄, 널마다 단이 크게 달라 어둠에서도 줄이 읽힌다 ───────────────────
PLANK_B = [(3, 6), (2, 20), (4, 12), (3, 28)]  # (몸통단, 이음 x) — 널마다 하나
def wood_B():
    c = Cv(32, 32)
    for k, (tone, jx) in enumerate(PLANK_B):
        y0 = 8 * k
        other = {3: 2, 2: 4, 4: 3}[tone]
        for x in range(32):
            t = tone if ((x - jx) % 32) < 20 else other      # 이음 뒤 20px 는 tone, 나머지 other
            c.put(x, y0, 'w', 0)
            c.put(x, y0 + 1, 'w', min(t + 1, 5))
            for dy in range(2, 8): c.put(x, y0 + dy, 'w', t)
            c.put(x, y0 + 7, 'w', max(t - 1, 1))            # 아래 모서리 한 단 어둡게
        for dy in range(0, 8): c.put(jx, y0 + dy, 'w', 0)
        for dy in range(1, 7): c.put((jx + 1) % 32, y0 + dy, 'w', min(tone + 1, 5))
    for (x, y) in [(15, 4), (16, 4), (17, 4), (24, 12), (25, 12), (5, 21), (6, 21), (7, 21), (9, 29), (10, 29)]:
        c.put(x, y, 'w', 1)     # 결 짧게 몇 획
    c.emit('floor_gallery_wood', 'hf5-B', {'w': 'vpine'},
           'B: 어둠에서 읽히게 — 8px 큰 널 4줄, 널마다 단이 달라(3/2/4/3) 줄이 또렷, 갭은 최암(단0)+윗줄 하이라이트. 이음은 널당 하나, 결은 몇 획만.', tile=True)

# ── 마루 C: 바구니 짜기 쪽모이 — 8px 블록, 2px 살, 가로·세로 교대 ─────────────────────────
def wood_C():
    c = Cv(32, 32)
    for by in range(4):
        for bx in range(4):
            horiz = (bx + by) % 2 == 0
            base = 3 if horiz else 2
            x0, y0 = bx * 8, by * 8
            for s in range(4):                 # 2px 살 4개
                for a in range(8):
                    for b in range(2):
                        if horiz: x, y, lit = x0 + a, y0 + 2 * s + b, (b == 0)
                        else:     x, y, lit = x0 + 2 * s + b, y0 + a, (b == 0)
                        c.put(x, y, 'w', base + 1 if lit else base - 1)
            # 블록 끝(가로는 오른쪽 끝, 세로는 아래 끝)에 짧은 갭 한 줄
            if horiz:
                for dy in range(8): c.put(x0 + 7, y0 + dy, 'w', 1)
            else:
                for dx in range(8): c.put(x0 + dx, y0 + 7, 'w', 1)
    c.emit('floor_gallery_wood', 'hf5-C', {'w': 'vpine'},
           'C: 재료·무늬 — 바구니 짜기 쪽모이. 8px 블록마다 2px 살 4개, 가로 블록(단3)·세로 블록(단2)이 체크로 교대. 살은 윗줄/왼줄 밝게, 블록 끝에 갭.', tile=True)

# ── 돌판 A: 16px 판 4장 (한 단씩 다른), 줄눈 1px, 결 한두 줄 ────────────────────────────────
def stone_A():
    c = Cv(32, 32)
    slab = {(0, 0): 2, (1, 0): 1, (0, 1): 1, (1, 1): 2}
    for (sx, sy), t in slab.items():
        c.rect(sx * 16, sy * 16, sx * 16 + 15, sy * 16 + 15, 'm', t)
        for i in range(16):
            c.put(sx * 16 + i, sy * 16, 'm', 0)       # 위 줄눈 (단0)
            c.put(sx * 16, sy * 16 + i, 'm', 0)       # 왼 줄눈
        for i in range(1, 16):
            c.put(sx * 16 + i, sy * 16 + 1, 'm', t + 1)   # 안쪽 윗줄 하이라이트
            c.put(sx * 16 + 1, sy * 16 + i, 'm', t + 1)   # 안쪽 왼줄
        c.put(sx * 16 + 1, sy * 16 + 1, 'm', t + 1)
    # 결(가는 줄): 판 (0,0) 에 사선 짧게 하나, 판 (1,1) 에 하나
    for (x, y) in [(5, 9), (6, 8), (7, 8), (8, 7), (9, 6), (10, 6)]: c.put(x, y, 'm', 1)
    for (x, y) in [(20, 25), (21, 25), (22, 24), (23, 23), (24, 23), (25, 22)]: c.put(x, y, 'm', 3)
    for (x, y) in [(22, 6), (23, 6), (10, 20), (11, 20), (12, 21)]: c.put(x, y, 'm', 2)
    c.emit('floor_gallery_stone', 'hf5-A', {'m': 'vmarble'},
           'A: v5 대리석 식구 — 16px 판 4장(단 2/1/1/2), 줄눈 1px(단0)+판 안쪽 윗·왼줄 하이라이트, 결 사선 한두 줄. 벽 흰 칠보다 두세 단 어둡다.', tile=True)

# ── 돌판 B: 큰 판 체크(단 차 크게) + 밝은 줄눈으로 어둠에서도 판이 읽힌다 ────────────────────
def stone_B():
    c = Cv(32, 32)
    for by in range(2):
        for bx in range(2):
            t = 2 if (bx + by) % 2 == 0 else 1
            c.rect(bx * 16, by * 16, bx * 16 + 15, by * 16 + 15, 'm', t)
            for i in range(16):
                c.put(bx * 16 + i, by * 16, 'm', 0)
                c.put(bx * 16, by * 16 + i, 'm', 0)
                c.put(bx * 16 + i, by * 16 + 1, 'm', 3 if t == 2 else 2)   # 밝은 안쪽 윗줄(2px 줄눈 띠)
                c.put(bx * 16 + 1, by * 16 + i, 'm', 3 if t == 2 else 2)
            c.put(bx * 16, by * 16, 'm', 0)
    for (x, y) in [(6, 7), (7, 7), (8, 8), (24, 24), (25, 24), (26, 25)]: c.put(x, y, 'm', 0)
    c.emit('floor_gallery_stone', 'hf5-B', {'m': 'vmarble'},
           'B: 어둠에서 읽히게 — 16px 큰 판 체크(단 2/1), 줄눈 최암+안쪽 밝은 띠로 판 모서리가 또렷. 결은 짧은 점선 두 곳만.', tile=True)

# ── 돌판 C: 불규칙 판석(슬레이트) + 줄눈에 이끼 ─────────────────────────────────────────
# 판 배치: 32×32 를 손으로 나눈 판 번호 지도(글자 = 판, 같은 글자 = 한 장)
SLABS_C = [
"aaaaaaaaaaaabbbbbbbbbbbbbbbbcccc",
"aaaaaaaaaaaabbbbbbbbbbbbbbbbcccc",
"aaaaaaaaaaaabbbbbbbbbbbbbbbbcccc",
"aaaaaaaaaaaabbbbbbbbbbbbbbbbcccc",
"aaaaaaaaaaaabbbbbbbbbbbbbbbbcccc",
"aaaaaaaaaaaabbbbbbbbbbbbbbbbcccc",
"aaaaaaaaaaaabbbbbbbbbbbbbbbbcccc",
"eeeeeeeeeeeebbbbbbbbbbbbbbbbcccc",
"eeeeeeeeeeeeffffffffffffgggggggg",
"eeeeeeeeeeeeffffffffffffgggggggg",
"eeeeeeeeeeeeffffffffffffgggggggg",
"eeeeeeeeeeeeffffffffffffgggggggg",
"eeeeeeeeeeeeffffffffffffgggggggg",
"eeeeeeeeeeeeffffffffffffgggggggg",
"eeeeeeeeeeeeffffffffffffgggggggg",
"eeeeeeeeeeeeffffffffffffgggggggg",
"hhhhhhhhhhhhhhhhiiiiiiiiiiiiiiii",
"hhhhhhhhhhhhhhhhiiiiiiiiiiiiiiii",
"hhhhhhhhhhhhhhhhiiiiiiiiiiiiiiii",
"hhhhhhhhhhhhhhhhiiiiiiiiiiiiiiii",
"hhhhhhhhhhhhhhhhiiiiiiiiiiiiiiii",
"hhhhhhhhhhhhhhhhiiiiiiiiiiiiiiii",
"hhhhhhhhhhhhhhhhiiiiiiiiiiiiiiii",
"hhhhhhhhhhhhhhhhiiiiiiiiiiiiiiii",
"jjjjjjkkkkkkkkkkkkkkllllllllllll",
"jjjjjjkkkkkkkkkkkkkkllllllllllll",
"jjjjjjkkkkkkkkkkkkkkllllllllllll",
"jjjjjjkkkkkkkkkkkkkkllllllllllll",
"jjjjjjkkkkkkkkkkkkkkllllllllllll",
"jjjjjjkkkkkkkkkkkkkkllllllllllll",
"jjjjjjkkkkkkkkkkkkkkllllllllllll",
"jjjjjjkkkkkkkkkkkkkkllllllllllll",
]
SLAB_TONE = dict(a=2, b=1, c=2, d=1, e=1, f=2, g=1, h=2, i=1, j=1, k=2, l=1)
def stone_C():
    c = Cv(32, 32)
    def L(x, y): return SLABS_C[y % 32][x % 32]
    for y in range(32):
        for x in range(32):
            ch = L(x, y); t = SLAB_TONE[ch]
            if L(x - 1, y) != ch or L(x, y - 1) != ch:
                c.put(x, y, 'm', 0)                       # 줄눈
            elif L(x - 2, y) != ch or L(x, y - 2) != ch:
                c.put(x, y, 'm', t + 1)                   # 안쪽 밝은 띠
            else:
                c.put(x, y, 'm', t)
    # 줄눈에 이끼(물기): 몇 군데만 hmoss 어두운 단
    for (x, y) in [(12, 3), (12, 4), (13, 8), (14, 8), (0, 18), (0, 19), (16, 20), (16, 21), (6, 27), (7, 24)]:
        c.put(x, y, 'g', 3)
    # 판 한가운데 잔금 두 곳
    for (x, y) in [(4, 3), (5, 3), (5, 4), (6, 5)]: c.put(x, y, 'm', 1)
    for (x, y) in [(26, 27), (27, 27), (27, 28)]: c.put(x, y, 'm', 1)
    c.emit('floor_gallery_stone', 'hf5-C', {'m': 'vmarble', 'g': 'hmoss'},
           'C: 재료·무늬 — 크기가 다른 불규칙 판석 12장(단 1/2), 줄눈은 판 경계를 지도에서 자동 검출(단0)+안쪽 밝은 띠, 줄눈 몇 곳에 이끼(hmoss1), 잔금 두 곳. 미술관에서 가장 세월 탄 쪽.', tile=True)

if __name__ == '__main__':
    fs = dict(wA=wood_A, wB=wood_B, wC=wood_C, sA=stone_A, sB=stone_B, sC=stone_C)
    for k in (sys.argv[1:] or fs): fs[k]()
