"""투명 구멍·땅 홈 찾기: 행·열 양쪽으로 그림에 갇힌 '.' 와 맨 아래 줄의 그림 사이 '.'."""
import sys
for bid in sys.argv[1:]:
    rows = open(__import__('os').path.abspath(__file__).rsplit('/scripts/content/building-kit/', 1)[0] + f'/harness-data/building-kit/massing/art/{bid}.txt').read().split()
    H, W = len(rows), len(rows[0])
    holes = []
    for y in range(H):
        xs = [x for x in range(W) if rows[y][x] != '.']
        if not xs:
            continue
        for x in range(xs[0], xs[-1] + 1):
            if rows[y][x] == '.':
                up = any(rows[j][x] != '.' for j in range(0, y))
                dn = any(rows[j][x] != '.' for j in range(y + 1, H))
                if (up and dn) or y >= H - 4:
                    holes.append((x, y))
    print(bid, 'holes', len(holes), holes[:30])
