#!/usr/bin/env python3
"""wv7 작업 도구 — 손으로 그린 글자 격자(.art)를 pxgrid 재료·단 격자(.pxg)로 나눠 적는다. 색을 계산하지 않는다.
.art:  size W H / map 글자 램프 단 / grid 아래 줄들 / shadow 아래 줄들(~ - % 그대로) / 빈 줄로 구역을 끝낸다.
사용: wv7-build.py 입력.art 출력.pxg [제목]"""
import sys
src, out = sys.argv[1], sys.argv[2]
title = sys.argv[3] if len(sys.argv) > 3 else ''
auto = False; size = None; maps = {}; grid = []; shadow = []; mode = None
for raw in open(src, encoding='utf-8'):
    ln = raw.rstrip('\n')
    if ln.startswith('//'): continue
    if mode in ('grid', 'shadow'):
        if ln.strip() == 'shadow': mode = 'shadow'; continue
        if ln.strip() == '': mode = None; continue
        (grid if mode == 'grid' else shadow).append(ln); continue
    if not ln.strip(): continue
    t = ln.split()
    if t[0] == 'size': size = (int(t[1]), int(t[2]))
    elif t[0] == 'map': maps[t[1]] = (t[2], t[3])
    elif t[0] == 'autoshadow': auto = True
    elif t[0] in ('grid', 'shadow'): mode = t[0]
W, H = size
grid = [r.ljust(W, '.') for r in grid]; shadow = [r.ljust(W, '.') for r in shadow]
while shadow and len(shadow) < H: shadow.append('.' * W)
while len(grid) < H: grid.append('.' * W)
assert len(grid) == H, f'grid rows {len(grid)} != {H}'
for i, r in enumerate(grid): assert len(r) == W, f'row {i} width {len(r)} != {W}: {r!r}'
if shadow:
    assert len(shadow) == H
    for i, r in enumerate(shadow): assert len(r) == W, f'shadow row {i} width {len(r)}'
if auto and not shadow:
    bot = {}
    for c in range(W):
        rs = [r for r in range(H) if grid[r][c] != '.']
        if rs: bot[c] = max(rs)
    sh = [['.'] * W for _ in range(H)]
    for c in range(W):
        for src in (c, c - 1):
            if src in bot and bot[src] + 1 < H and grid[bot[src] + 1][c] == '.' and (bot[src] + 1 > bot.get(c, -1)):
                sh[bot[src] + 1][c] = '~'
        if (c - 1) in bot and bot[c - 1] + 2 < H and sh[bot[c - 1] + 2][c] == '.' and grid[bot[c - 1] + 2][c] == '.': sh[bot[c - 1] + 2][c] = '-'
    shadow = [''.join(r) for r in sh]
ramps = []
for g, (rp, st) in maps.items():
    if rp not in ramps: ramps.append(rp)
mchar = {rp: 'abcdefghijklmnopqrstuvwxyz'[i] for i, rp in enumerate(ramps)}
M = []; T = []
for r in grid:
    m = ''; t = ''
    for c in r:
        if c == '.': m += '.'; t += '.'
        else:
            rp, st = maps[c]; m += mchar[rp]; t += st
    M.append(m); T.append(t)
L = [f'// {title}', f'@size {W} {H}', '@cell 16', '@palette palette.pal']
if shadow: L += ['@layer shadow', '@block 0 0'] + shadow
L.append('@layer main')
for rp in ramps: L.append(f'@mat {mchar[rp]} {rp} 0')
L.append('@mblock 0 0'); L += M; L.append('@tblock 0 0'); L += T
open(out, 'w', encoding='utf-8').write('\n'.join(L) + '\n')
