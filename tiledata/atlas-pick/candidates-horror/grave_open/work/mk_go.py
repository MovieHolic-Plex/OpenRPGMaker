import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'night_grass', 'work'))
from nightlib import *
NOTES = {
 'A': "A: night_grass A 와 같은 풀 위에 파헤친 무덤 — 위쪽에 흙더미, 그 아래 세로로 긴 구덩이(속은 void, 윗벽만 흙빛으로 보임), 둘레 흙 테두리는 왼쪽 위가 밝다. 바깥 풀은 night_grass A 와 같은 풀.",
 'B': "B: 왼쪽 위 빛 — 흙더미 왼쪽이 밝고 오른쪽 아래가 짙으며, 구덩이 안은 왼쪽 벽 한 줄만 빛을 받고 나머지는 깊은 어둠. 테두리 오른쪽·아래는 그늘 한 단.",
 'C': "C: 구덩이 바닥 쪽 가장자리를 창백한 손가락 다섯이 움켜쥔 모양(bisque) — 안에서 기어 나오는 손(작게 보면 이빨 줄로도 읽힘). 어긋난 곳은 그 손. 흙더미에 꽂힌 삽 자루는 없다(손이 주역).",
}
def build(k):
    g = grass(k)
    c = Canvas('grave_open', 16, 32)
    for y in range(32):
        for x in range(16): c.px(x, y, g[y][x])
    # 흙더미 (y 1..10) — 타원
    cx, cy, rx, ry = 8, 6.5, 6.5, 4.6
    for y in range(0, 12):
        for x in range(16):
            dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry
            d = dx * dx + dy * dy
            if d <= 1:
                s = 3
                lit = (-dx - dy) * .6
                s = 3 + (1 if lit > .35 else 0) + (1 if lit > .7 and k == 'B' else 0) - (1 if lit < -.35 else 0) - (1 if lit < -.7 else 0)
                if (x * 5 + y * 3) % 7 == 0: s -= 1
                c.px(x, y, f'soil:{max(0, min(5, s))}')
    # 구덩이 테두리 + 속
    X0, X1, Y0, Y1 = 3, 12, 11, 28
    for y in range(Y0 - 1, Y1 + 2):
        for x in range(X0 - 1, X1 + 2):
            edge = x in (X0 - 1, X1 + 1) or y in (Y0 - 1, Y1 + 1)
            if edge:
                s = 4 if (x <= X0 or y <= Y0) else 1
                if k == 'B': s = 5 if (x <= X0 and y < Y1) else s
                if (x == X1 + 1 or y == Y1 + 1): s = 1
                c.px(x, y, f'soil:{s}')
    for y in range(Y0, Y1 + 1):
        for x in range(X0, X1 + 1):
            if y <= Y0 + 2: key = f'soil:{1 if y == Y0 else 0}'      # 윗벽
            elif x == X0 and k == 'B': key = 'soil:1'
            else: key = 'void:0' if (y > Y0 + 6 or x in (X0 + 1, X1 - 1)) else 'void:1'
            if y == Y0 + 3 and X0 < x < X1: key = 'void:2'
            c.px(x, y, key)
    # 흙 뒤섞임: 흙 덩이 몇 개가 테두리 밖으로 튄 자국
    for (x, y, s) in [(1, 14, 3), (14, 20, 2), (2, 26, 3), (13, 12, 3)]: c.px(x, y, f'soil:{s}')
    if k == 'C':  # 창백한 손가락 다섯이 아래 테두리를 움켜쥠
        fing = [(4, 27), (6, 26), (8, 26), (10, 26), (12, 27)]
        for i, (fx, top) in enumerate(fing):
            for y in range(top, 29 + 2 if i == 0 or i == 4 else 29 + 1):
                c.px(fx - 1 if i == 4 else fx, y, 'bisque:5' if i < 2 else 'bisque:4')
            c.px(fx - 1 if i == 4 else fx, top, 'bisque:6')
            c.px(fx + (0 if i == 4 else 1) - (1 if i == 4 else 0), 29, 'bisque:2')
        for x in range(4, 12): c.px(x, 28, 'bisque:3' if 5 < x < 11 else 'bisque:4')
        for x in range(4, 12): c.px(x, 29, 'bisque:2')
    return c
for k in 'ABC': build(k).save(f'h1-{k}', NOTES[k])
