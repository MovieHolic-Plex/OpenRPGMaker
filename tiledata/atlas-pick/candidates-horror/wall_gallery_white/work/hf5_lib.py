#!/usr/bin/env python3
"""hf5(미술관 한 벌) 공용 — 줄마다 (재료 글자, 단 글자)를 손으로 정해 pxg 로 굽는다. 색을 계산하지 않는다(반복·붙이기·줄 긋기만)."""
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
        if 0 <= y < self.h and 0 <= x < self.w:
            self.m[y][x] = mat; self.t[y][x] = TONES[tone] if isinstance(tone, int) else tone
    def wput(self, x, y, mat, tone):            # x 를 감아서(가로 이음 조각)
        self.put(x % self.w, y, mat, tone)
    def rect(self, x0, y0, x1, y1, mat, tone):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): self.put(x, y, mat, tone)
    def hline(self, y, mat, tone, x0=0, x1=None):
        self.rect(x0, y, self.w - 1 if x1 is None else x1, y, mat, tone)
    def vline(self, x, mat, tone, y0=0, y1=None):
        self.rect(x, y0, x, self.h - 1 if y1 is None else y1, mat, tone)
    def stamp(self, rows, x0, y0, cmap, wrap=False):
        for j, row in enumerate(rows):
            for i, c in enumerate(row):
                if c in cmap and cmap[c] is not None:
                    (self.wput if wrap else self.put)(x0 + i, y0 + j, *cmap[c])
    def emit(self, slug, name, mats, note, tile=False):
        if tile:
            for r in range(self.h): assert all(ch != '.' for ch in self.m[r]), (slug, name, r)
        for r in range(self.h):
            assert len(self.m[r]) == self.w
        L = [f'// {slug} {name} (hf5)', f'@size {self.w} {self.h}', '@cell 16', '@palette palette.pal']
        if tile: L.append('@tile')
        L.append('@layer main')
        L += [f'@mat {k} {v} 0' for k, v in mats.items()]
        L += ['@mblock 0 0'] + [''.join(r) for r in self.m] + ['@tblock 0 0'] + [''.join(r) for r in self.t]
        d = os.path.join(H, slug)
        open(os.path.join(d, name + '.pxg'), 'w').write('\n'.join(L) + '\n')
        open(os.path.join(d, name + '.note'), 'w').write(note + '\n')
