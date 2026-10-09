
# ================================================================ ⑨ 숲 바닥: 대나무 잎 땅 · 이끼 덩이 · 풀 덧그림 · 땅 장식
LIT_NZ = smooth(W, H, 3, 811); MOSS_NZ = smooth(W, H, 3, 812)
def _floor_ok(x, y): return (x, y) not in OPEN and (x, y) not in s.fence and not (14 <= x < 30 and 7 <= y < 22)
STREAM_NEAR = {(x + dx, y + dy) for (x, y) in s.stream for dx in (-2, -1, 0, 1, 2) for dy in (-1, 0, 1)}
for y in range(H):
    for x in range(W):
        if not _floor_ok(x, y): continue
        under = any((x, y - j) in BASE or (x - i, y + j) in BASE for i in range(4) for j in range(0, 4))
        if (x, y) in STREAM_NEAR and MOSS_NZ[y, x] > .55: s.moss.add((x, y))
        elif under and LIT_NZ[y, x] > .42: s.litter.add((x, y))
        elif MOSS_NZ[y, x] > .7: s.moss.add((x, y))
        elif under: s.gz[(x, y)] = 'shade'
        elif _hash(x, y, 5) > .55: s.gz[(x, y)] = 'sprig' if _hash(x, y, 6) > .4 else 'litter'
for (x, y) in [(3, 23), (4, 23), (10, 23), (2, 26), (11, 25), (11, 26)]:                     # 감실 터 이끼
    if _floor_ok(x, y): s.moss.add((x, y)); s.litter.discard((x, y))
print('floor', len(s.litter), len(s.moss))
