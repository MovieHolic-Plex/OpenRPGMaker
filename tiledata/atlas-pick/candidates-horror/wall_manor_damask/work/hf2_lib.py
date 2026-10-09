#!/usr/bin/env python3
"""hf2 작업자 공용 — 줄마다 (재료 글자, 단 글자)를 손으로 정해 pxg 로 굽는다. 색을 계산하지 않는다(반복·붙이기·줄 긋기만)."""
import os
H = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
TONES = '0123456789abcde'

class Cv:
    def __init__(self, w, h, base=None):
        self.w, self.h = w, h
        self.m = [['.'] * w for _ in range(h)]
        self.t = [['.'] * w for _ in range(h)]
        if base: self.rect(0, 0, w - 1, h - 1, *base)
    def put(self, x, y, mat, tone):
        if 0 <= y < self.h:
            self.m[y][x % self.w] = mat; self.t[y][x % self.w] = TONES[tone] if isinstance(tone, int) else tone
    def get(self, x, y): return self.m[y][x % self.w], self.t[y][x % self.w]
    def rect(self, x0, y0, x1, y1, mat, tone):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): self.put(x, y, mat, tone)
    def hline(self, y, mat, tone, x0=0, x1=None):
        self.rect(x0, y, self.w - 1 if x1 is None else x1, y, mat, tone)
    def stamp(self, rows, x0, y0, cmap):
        for j, row in enumerate(rows):
            for i, c in enumerate(row):
                if c in cmap and cmap[c] is not None: self.put(x0 + i, y0 + j, *cmap[c])
    def emit(self, slug, name, mats, note, tile=False):
        for r in range(self.h):
            assert all(ch != '.' for ch in self.m[r]) or not tile and True, (name, r)
        L = [f'// {slug} {name} (hf2)', f'@size {self.w} {self.h}', '@cell 16', '@palette palette.pal']
        if tile: L.append('@tile')
        L.append('@layer main')
        L += [f'@mat {k} {v} 0' for k, v in mats.items()]
        L += ['@mblock 0 0'] + [''.join(r) for r in self.m] + ['@tblock 0 0'] + [''.join(r) for r in self.t]
        d = os.path.join(H, slug)
        open(os.path.join(d, name + '.pxg'), 'w').write('\n'.join(L) + '\n')
        open(os.path.join(d, name + '.note'), 'w').write(note + '\n')
