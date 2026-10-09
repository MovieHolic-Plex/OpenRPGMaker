#!/usr/bin/env python3
"""w27 광석 더미 2x2 (32x32): 돌 무더기 + 청록 결정 + 금 알갱이 → .pxg. w3-C 결 유지."""
import os, math
HERE = os.path.dirname(os.path.abspath(__file__))
W = H = 32
def hsh(x, y, s):
    n = (x * 374761393 + y * 668265263 + s * 2147483647) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return ((n ^ (n >> 16)) & 0xffff) / 65535.0

def build(lumps, crystals, golds, seed, base=29):
    """lumps: (cx, rx, ry) 반타원 무더기 합. base: 맨 아래 돌 줄 (그 아래 30 이 외곽선)"""
    px = {}
    shape = set()
    for y in range(H):
        for x in range(W):
            for cx, rx, ry in lumps:
                dy = (base + 0.5 - y)
                if dy < 0: continue
                v = 1 - (dy / ry) ** 2
                if v < 0: continue
                hw = rx * math.sqrt(v)
                if abs(x + 0.5 - cx) <= hw:
                    shape.add((x, y)); break
    top = min(y for _, y in shape)
    xs = [x for x, _ in shape]; cx0 = (min(xs) + max(xs)) / 2; span = (max(xs) - min(xs)) / 2
    for (x, y) in shape:
        t = ((x - cx0) / span) * 0.55 + ((y - top) / (base - top + 1)) * 0.8
        # 2x2 덩이 잡음: 바위 결
        nz = (hsh(x // 2, y // 2, seed) - 0.5) * 1.5 + (hsh(x, y, seed + 7) - 0.5) * 0.5
        v = 5.2 - 3.0 * t + nz
        step = max(2, min(5, int(round(v))))
        px[(x, y)] = ('stone', step)
    # 외곽선
    for (x, y) in list(shape):
        below = (x, y + 1) not in shape
        right = (x + 1, y) not in shape
        left = (x - 1, y) not in shape
        up = (x, y - 1) not in shape
        if below or right: px[(x, y)] = ('stone', 1)
        elif left or up: px[(x, y)] = ('stone', 3 if px[(x, y)][1] > 3 else 2)
    # 맨 아래 접지 외곽선 + 바닥 그림자(작은 돌 조각)
    for x in range(W):
        if (x, base) in shape: px[(x, base + 1)] = ('stone', 1)
    # 돌 틈(어두운 금) : 무더기 안 몇 군데 선
    for (x, y, n) in [(0, 0, 0)][:0]: pass
    # 결정
    for (bx, by, w, h, lean) in crystals:
        for r in range(h + 1):
            y = by - r
            frac = r / h
            hw = w / 2.0 * (1.0 if frac < 0.55 else max(0.0, 1 - (frac - 0.55) / 0.45))
            c = bx + lean * frac
            x0 = int(math.floor(c - hw + 0.5)); x1 = int(math.ceil(c + hw - 0.5))
            if r == h: x0 = x1 = int(round(c))
            for x in range(x0, x1 + 1):
                if not (0 <= x < W and 0 <= y < H): continue
                mid = (x0 + x1) / 2.0
                if x == x1 and x1 > x0: col = ('teal', 2)
                elif x > mid: col = ('teal', 3)
                elif x == x0 and x1 > x0 + 1: col = ('teal', 4)
                else: col = ('teal', 5)
                if r == h or (r == h - 1 and x == x0): col = ('teal', 6)
                if x == x0 + 1 and x1 - x0 >= 2 and frac > 0.25 and frac < 0.85 and x < mid + 0.5: col = ('teal', 6) if hsh(x, y, seed) > 0.35 else ('teal', 5)
                px[(x, y)] = col
            # 외곽 어두움(왼쪽/오른쪽 바깥)
            for xo, st in ((x0 - 1, 1), (x1 + 1, 0)):
                pass
        # 결정 오른쪽/왼쪽 테두리(돌 위에서 분리)
        for r in range(h + 1):
            y = by - r
            row = [x for x in range(W) if px.get((x, y), (0, 0))[0] == 'teal' and (x, y) is not None]
    # 금 알갱이 (고광 1 + 본색 + 그늘)
    for (gx, gy, big) in golds:
        if big:
            for dx, dy, st in ((0, 0, 6), (1, 0, 5), (0, 1, 4), (1, 1, 3)):
                px[(gx + dx, gy + dy)] = ('gold', st)
        else:
            px[(gx, gy)] = ('gold', 5)
            px[(gx + 1, gy)] = ('gold', 3)
    return px

def emit(px, name, note):
    out = ['// ore_pile 후보 %s (w27, 2x2)' % name, '@size 32 32', '@cell 16', '@palette palette.pal']
    items = ['%d %d %s:%d' % (x, y, r, s) for (x, y), (r, s) in sorted(px.items(), key=lambda kv: (kv[0][1], kv[0][0])) if 0 <= x < W and 0 <= y < H]
    for i in range(0, len(items), 10): out.append('@px ' + ' '.join(items[i:i + 10]))
    open(os.path.join(HERE, '..', 'w27-%s.pxg' % name), 'w', encoding='utf-8').write('\n'.join(out) + '\n')
    open(os.path.join(HERE, '..', 'w27-%s.note' % name), 'w', encoding='utf-8').write(note + '\n')

# A: 높은 결정 다발 — 가운데 솟은 큰 결정 하나와 곁가지 둘
emit(build([(16, 15, 11), (9, 8, 6.5), (24, 8, 6)],
           [(15, 22, 6, 13, -1), (10, 23, 4, 8, -2), (21, 23, 5, 9, 2), (26, 25, 3, 4, 1)],
           [(6, 22, 0), (7, 25, 1), (24, 26, 0), (17, 26, 0), (12, 20, 0)], 11),
     'A', '높은 결정 다발 — w3-C 의 돌 무더기 위로 큰 청록 결정 한 줄기가 솟고 곁가지 결정 둘, 금 알갱이 흩뿌림. 2x2.')
# B: 낮고 넓은 더미 — 작은 결정 여럿, 금 덩이 둘
emit(build([(16, 15, 9), (7, 8, 6), (26, 8, 6), (17, 8, 8)],
           [(8, 22, 3, 5, -1), (13, 22, 4, 7, 1), (20, 24, 3, 5, 0), (25, 23, 3, 6, 1), (16, 26, 2, 3, 0)],
           [(4, 24, 1), (11, 26, 0), (22, 21, 1), (27, 26, 0), (18, 22, 0)], 23),
     'B', '넓고 낮은 더미 — 돌 무더기가 옆으로 퍼지고 작은 결정 다섯, 금 덩이 둘이 박혀 있다. 통로 옆 광석 야적 느낌. 2x2.')
# C: 금 위주 — 금 덩이 많고 청록은 한쪽
emit(build([(15, 14, 10), (23, 9, 7)],
           [(24, 24, 4, 8, 1), (28, 26, 2, 4, 0)],
           [(6, 25, 1), (9, 22, 1), (12, 26, 1), (15, 21, 1), (18, 25, 1), (13, 24, 0), (8, 27, 0), (20, 22, 0), (11, 20, 0), (4, 27, 0)], 37),
     'C', '금 위주 더미 — 흙빛 돌 무더기에 금 덩이가 촘촘히 박히고 오른쪽에만 청록 결정. 광산 분위기 다른 색. 2x2.')
# D: 쌍봉 — 두 무더기, 결정 둘이 마주 기울다
emit(build([(9, 8, 10), (23, 9, 8), (16, 8, 5)],
           [(8, 21, 4, 10, -1), (23, 23, 4, 8, 1), (15, 26, 3, 4, 0)],
           [(4, 26, 0), (13, 22, 1), (27, 26, 0), (19, 21, 0), (17, 27, 0)], 51),
     'D', '쌍봉 더미 — 무더기 둘이 나란히 봉우리를 만들고 결정이 하나씩 솟는다. 골이 진 실루엣. 2x2.')
