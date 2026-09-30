#!/usr/bin/env python3
"""hf6 공용 도우미 — 색을 계산하지 않는다. 화소마다 (재료 글자, 단)을 손으로 정하고 이 파일은 그것을 pxg 로 옮겨 적기만 한다.
쓰는 곳: 같은 폴더의 hf6_wall.py hf6_floor.py hf6_cabinet.py hf6_chair.py hf6_sink.py"""
import os
H = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))   # candidates-horror

class C:
    def __init__(s, w, h, wrap=False):
        s.w, s.h, s.wrap = w, h, wrap
        s.m = [['.'] * w for _ in range(h)]; s.t = [['.'] * w for _ in range(h)]
    def put(s, y, x, mat, tone):
        if s.wrap: x %= s.w; y %= s.h
        assert 0 <= y < s.h and 0 <= x < s.w, (y, x)
        s.m[y][x] = mat; s.t[y][x] = str(tone) if isinstance(tone, int) else tone
    def rect(s, y0, y1, x0, x1, mat, tone):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.put(y, x, mat, tone)
    def row(s, y, x0, x1, mat, tone): s.rect(y, y, x0, x1, mat, tone)
    def col(s, x, y0, y1, mat, tone): s.rect(y0, y1, x, x, mat, tone)
    def paint(s, y0, x0, rows, mapping):
        """rows: 문자열 줄들. mapping: 글자 -> (재료, 단). '.' 은 건드리지 않는다."""
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch != '.': s.put(y0 + j, x0 + i, *mapping[ch])
    def get(s, y, x): return s.m[y][x], s.t[y][x]
    def outline(s, ol):
        """실루엣 가장자리(4방향 이웃이 비었거나 캔버스 밖) 화소를 그 재료의 어두운 단으로. ol: 재료 -> 단"""
        edge = []
        for y in range(s.h):
            for x in range(s.w):
                if s.m[y][x] == '.': continue
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    yy, xx = y + dy, x + dx
                    if not (0 <= yy < s.h and 0 <= xx < s.w) or s.m[yy][xx] == '.': edge.append((y, x)); break
        for y, x in edge: s.t[y][x] = str(ol[s.m[y][x]])
    def dump(s): return [''.join(r) for r in s.m], [''.join(r) for r in s.t]

def emit(slug, worker, letter, c, mats, note, layer='main', tile=False):
    mrows, trows = c.dump()
    assert len(mrows) == c.h and len(trows) == c.h
    for r in mrows + trows: assert len(r) == c.w, (slug, r, len(r))
    L = [f'// {slug} {worker}-{letter}', f'@size {c.w} {c.h}', '@cell 16', '@palette palette.pal']
    if tile: L.append('@tile')
    L.append('@layer main')
    used = sorted({ch for r in mrows for ch in r} - {'.'})
    L += [f'@mat {k} {mats[k]} 0' for k in used]
    L += ['@mblock 0 0'] + mrows + ['@tblock 0 0'] + trows
    d = os.path.join(H, slug)
    open(os.path.join(d, f'{worker}-{letter}.pxg'), 'w').write('\n'.join(L) + '\n')
    open(os.path.join(d, f'{worker}-{letter}.note'), 'w').write(note + '\n')
