"""밤 풀밭 세트 공용 — 풀 배치(32x32, 사방 이어 붙음)를 한 함수로 만들어 night_grass·night_path·grave_open 이 같은 풀을 쓴다."""
import os, sys, random
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'portrait_eyes', 'work'))
from h1_lib import Canvas
N = 32
SEEDS = {'A': 11, 'B': 23, 'C': 37}

def tufts_for(kind):
    r = random.Random(SEEDS[kind])
    centers = [(r.randrange(N), r.randrange(N)) for _ in range(6)]
    out = []
    for cx, cy in centers:
        for _ in range(r.choice([3, 4, 4, 5])):
            out.append(((cx + r.randint(-5, 5)) % N, (cy + r.randint(-4, 4)) % N))
    return out

def grass(kind):
    """32x32 키 배열 — 가장자리는 모듈러 이음."""
    g = [['night:2'] * N for _ in range(N)]
    r = random.Random(SEEDS[kind] + 100)
    def put(x, y, k): g[y % N][x % N] = k
    # 바탕 얼룩: 어두운 덩이(night:1)·이끼 덩이(hmoss:1)
    for _ in range(9):
        cx, cy = r.randrange(N), r.randrange(N); w, h = r.randint(3, 6), r.randint(2, 3)
        k = 'night:1' if r.random() < .65 else 'hmoss:1'
        for dy in range(h):
            for dx in range(w):
                if (dx, dy) in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)) and w > 3: continue
                put(cx + dx, cy + dy, k)
    for _ in range(5):  # 밝은 덩이 한 단
        cx, cy = r.randrange(N), r.randrange(N)
        for dx in range(r.randint(2, 4)): put(cx + dx, cy, 'night:3')
    # 풀 포기
    for (x, y) in tufts_for(kind):
        if kind == 'A':
            for dx, dy, k in [(0, 0, 'night:3'), (0, -1, 'night:3'), (-1, -2, 'night:4'), (1, -2, 'night:4'), (0, -2, 'night:2')]: put(x + dx, y + dy, k)
        elif kind == 'B':  # 왼쪽 위 빛 — 왼 잎 밝게, 오른 잎은 어둡게, 오른쪽 아래에 짙은 그늘
            for dx, dy, k in [(0, 0, 'night:2'), (0, -1, 'night:3'), (-1, -2, 'night:5'), (1, -2, 'night:3'), (-1, -1, 'night:4'), (1, 0, 'night:0'), (2, -1, 'night:0'), (1, -1, 'night:1')]: put(x + dx, y + dy, k)
        else:  # C: 전부 오른쪽으로 쏠려 누운 풀
            for dx, dy, k in [(0, 0, 'night:3'), (1, -1, 'night:4'), (2, -2, 'night:4'), (0, -1, 'night:3'), (1, -2, 'night:4'), (3, -2, 'night:3')]: put(x + dx, y + dy, k)
    # 드러난 흙
    spots = {'A': [(6, 22), (24, 8)], 'B': [(22, 24), (5, 8)], 'C': [(4, 26), (12, 5)]}[kind]
    for sx, sy in spots:
        for dx, dy, k in [(0, 0, 'soil:3'), (1, 0, 'soil:3'), (2, 0, 'soil:2'), (0, 1, 'soil:2'), (1, 1, 'soil:2'), (2, 1, 'soil:1'), (1, 2, 'soil:1')]:
            if kind == 'B' and k == 'soil:3' and dy == 0: k = 'soil:4'
            put(sx + dx, sy + dy, k)
    if kind == 'C':  # 어긋난 곳: 흙이 드러난 손바닥 자국 (손가락 넷)
        hand = ["...s.s....", ".s.s.s.s..", ".s.s.s.s..", ".sssssssss", ".sssssssss", "..sssssss.", "..sssssss.", "...sssss.."]
        ox, oy = 17, 14
        for j, row in enumerate(hand):
            for i, ch in enumerate(row):
                if ch != 's': continue
                edge = (j + 1 >= len(hand) or hand[j + 1][i] != 's') or (i + 1 >= len(row) or row[i + 1] != 's')
                put(ox + i, oy + j, 'soil:2' if edge else 'soil:3')
    return g
