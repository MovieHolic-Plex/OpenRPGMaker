#!/usr/bin/env python3
"""hf1 도우미 — 재료 글자·단 글자 격자를 손으로 놓고 .pxg 로 쓴다. 색을 계산하지 않는다(보간·난수 없음).
H = candidates-horror 폴더. 각 기물 스크립트는 같은 work/ 안의 hf1_*.py."""
import os
H = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
TONES = '0123456789abcde'

class C:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.m = [['.'] * w for _ in range(h)]; s.t = [['.'] * w for _ in range(h)]
    def put(s, x, y, mat, tone):
        if 0 <= x < s.w and 0 <= y < s.h:
            s.m[y][x] = mat; s.t[y][x] = TONES[tone] if isinstance(tone, int) else tone
    def clear(s, x, y):
        if 0 <= x < s.w and 0 <= y < s.h: s.m[y][x] = '.'; s.t[y][x] = '.'
    def rect(s, x0, y0, x1, y1, mat, tone):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.put(x, y, mat, tone)
    def hline(s, y, x0, x1, mat, tone):
        for x in range(x0, x1 + 1): s.put(x, y, mat, tone)
    def vline(s, x, y0, y1, mat, tone):
        for y in range(y0, y1 + 1): s.put(x, y, mat, tone)
    def rows(s):
        return [''.join(r) for r in s.m], [''.join(r) for r in s.t]

def emit(slug, cand, c, mats, note, tile=False):
    mrows, trows = c.rows()
    w, h = c.w, c.h
    used = {ch for r in mrows for ch in r if ch != '.'}
    L = [f'// {slug} {cand} (hf1)', f'@size {w} {h}', '@cell 16', '@palette palette.pal']
    if tile: L.append('@tile')
    L.append('@layer main')
    L += [f'@mat {k} {v} 0' for k, v in mats.items() if k in used]
    L += ['@mblock 0 0'] + mrows + ['@tblock 0 0'] + trows
    d = os.path.join(H, slug)
    open(os.path.join(d, f'{cand}.pxg'), 'w').write('\n'.join(L) + '\n')
    open(os.path.join(d, f'{cand}.note'), 'w').write(note + '\n')

def emit_raw(slug, cand, rows, note, tile=False):
    """팔레트 글자(^ " * & ? …)를 그대로 놓는 층. rows = 문자열 목록."""
    w, h = len(rows[0]), len(rows)
    assert all(len(r) == w for r in rows), slug
    L = [f'// {slug} {cand} (hf1)', f'@size {w} {h}', '@cell 16', '@palette palette.pal']
    if tile: L.append('@tile')
    L += ['@layer main', '@block 0 0'] + rows
    d = os.path.join(H, slug)
    open(os.path.join(d, f'{cand}.pxg'), 'w').write('\n'.join(L) + '\n')
    open(os.path.join(d, f'{cand}.note'), 'w').write(note + '\n')
