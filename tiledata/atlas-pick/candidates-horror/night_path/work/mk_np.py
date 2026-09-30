import os, sys, math, random
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'night_grass', 'work'))
from nightlib import *
NOTES = {
 'A': "A: night_grass A 와 같은 풀 위로 가운데 세로 흙길(폭 12칸 안팎, 3/4 칸) — 가장자리는 풀이 파고드는 들쭉날쭉 선, 길 위 작은 돌 세 점(grave). 위아래 32칸 주기라 이어 붙고 좌우 끝 풀은 night_grass A 와 같다.",
 'B': "B: 왼쪽 위 빛 — 길 왼쪽 가장자리가 밝고 오른쪽 가장자리엔 풀 그림자가 길에 드리운다(반투명 없이 soil 한 단 어둡게). 돌은 왼쪽 위가 밝고 오른쪽 아래 그늘. night_grass B 와 같은 풀.",
 'C': "C: 길 한가운데 어두운 끌린 자국 두 줄(끊긴 점선)이 길게 이어지고, 돌 하나에 검은 점이 박혀 눈처럼 보인다. 어긋난 곳은 끌린 자국과 눈 돌. 위아래 32칸 주기라 이어 붙는다.",
}
def edges(kind):
    r = random.Random(SEEDS[kind] + 500)
    L, R = [], []
    for y in range(N):
        w = 5 * math.sin(2 * math.pi * y / N) * 0 
        L.append(10 + round(1.6 * math.sin(2 * math.pi * y / N * 2 + 1) + r.choice([-1, 0, 0, 1])))
        R.append(21 + round(1.6 * math.sin(2 * math.pi * y / N * 3) + r.choice([-1, 0, 0, 1])))
    return L, R
for k in 'ABC':
    g = grass(k); L, R = edges(k)
    c = Canvas('night_path', 32, 32)
    for y in range(N):
        for x in range(N):
            key = g[y][x]
            if L[y] <= x <= R[y]:
                mid = (x - L[y]) / max(1, R[y] - L[y])
                s = 2 + (1 if (x * 7 + y * 3) % 9 == 0 else 0) - (1 if (x * 5 + y * 11) % 8 == 0 else 0)
                if k == 'B':
                    s += 1 if x - L[y] < 2 else 0; s -= 1 if R[y] - x < 2 else 0
                if k == 'C' and (abs(x - 14) == 0 or abs(x - 18) == 0) and (y % 6 != 0): s = 0
                key = f'soil:{max(0, min(5, s))}'
                if x == L[y] or x == R[y]: key = f'soil:{2 if k != "B" or x == R[y] else 4}'
            c.px(x, y, key)
    # 가장자리 풀이 파고드는 삐죽
    for y in range(0, N, 5):
        yy = (y + {'A': 1, 'B': 3, 'C': 2}[k]) % N
        c.px(L[yy] + 1, yy, 'night:3'); c.px(R[yy] - 1, (yy + 2) % N, 'night:3')
    # 돌 (grave)
    stones = {'A': [(14, 6), (19, 15), (13, 25)], 'B': [(15, 4), (12, 17), (18, 27)], 'C': [(16, 9), (14, 21), (18, 28)]}[k]
    for i, (sx, sy) in enumerate(stones):
        if k == 'C' and i == 0:  # 눈처럼 보이는 돌
            for dx, dy, kk in [(0, 0, 'grave:2'), (1, 0, 'grave:4'), (2, 0, 'grave:2'), (0, 1, 'grave:3'), (1, 1, 'void:0'), (2, 1, 'grave:3'), (1, 2, 'grave:1')]: c.px(sx + dx, sy + dy, kk)
            continue
        if k == 'B':
            for dx, dy, kk in [(0, 0, 'grave:5'), (1, 0, 'grave:4'), (0, 1, 'grave:3'), (1, 1, 'grave:2'), (2, 1, 'grave:1')]: c.px(sx + dx, sy + dy, kk)
        else:
            for dx, dy, kk in [(0, 0, 'grave:4'), (1, 0, 'grave:3'), (0, 1, 'grave:2'), (1, 1, 'grave:2'), (2, 1, 'grave:1')]: c.px(sx + dx, sy + dy, kk)
    c.save(f'h1-{k}', NOTES[k])
