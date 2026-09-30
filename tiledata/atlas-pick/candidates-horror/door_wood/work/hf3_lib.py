#!/usr/bin/env python3
"""hf3 작업자 공용 — 칸마다 (램프, 단)을 손으로 정해 pxg 로 굽는다. 색을 계산하지 않는다(사각형·줄 긋기·붙이기만)."""
import os, re
H = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PAL = os.path.join(H, 'door_wood', 'palette.pal')
RAMPLEN = {}
for ln in open(PAL, encoding='utf-8'):
    m = re.match(r'@rampc\s+(\w+)\s+(.*)', ln)
    if m: RAMPLEN[m.group(1)] = len(m.group(2).split('//')[0].split())
LET = 'abcdefghijklmnopqrstuvwxyz'

class Cv:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.c = [[None] * w for _ in range(h)]
    def px(self, x, y, r, t):
        if 0 <= x < self.w and 0 <= y < self.h:
            assert t < RAMPLEN[r], (r, t, x, y)
            self.c[y][x] = (r, t)
    def get(self, x, y): return self.c[y][x]
    def rect(self, x0, y0, x1, y1, r, t):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): self.px(x, y, r, t)
    def hl(self, y, x0, x1, r, t): self.rect(x0, y, x1, y, r, t)
    def vl(self, x, y0, y1, r, t): self.rect(x, y0, x, y1, r, t)
    def bevel(self, x0, y0, x1, y1, r, hi, lo):
        """위·왼 테는 hi, 아래·오른 테는 lo (1px)."""
        self.hl(y0, x0, x1, r, hi); self.vl(x0, y0, y1, r, hi)
        self.hl(y1, x0, x1, r, lo); self.vl(x1, y0, y1, r, lo)
    def shift(self, x, y, dt):
        r, t = self.c[y][x]; self.px(x, y, r, t + dt)
    def stamp(self, rows, x0, y0, cmap):
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch in cmap and cmap[ch] is not None: self.px(x0 + i, y0 + j, *cmap[ch])
    def emit(self, slug, name, note):
        mats = {}
        for row in self.c:
            for e in row:
                if e and e[0] not in mats: mats[e[0]] = LET[len(mats)]
        L = [f'// {slug} {name} (hf3)', f'@size {self.w} {self.h}', '@cell 16', '@palette palette.pal', '@layer main']
        L += [f'@mat {v} {k} 0' for k, v in mats.items()]
        L += ['@mblock 0 0'] + [''.join(mats[e[0]] if e else '.' for e in row) for row in self.c]
        L += ['@tblock 0 0'] + [''.join(str(e[1]) if e else '.' for e in row) for row in self.c]
        d = os.path.join(H, slug)
        open(os.path.join(d, name + '.pxg'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
        open(os.path.join(d, name + '.note'), 'w', encoding='utf-8').write(note + '\n')
    def dump(self):
        for row in self.c: print(''.join(str(e[1]) if e else '.' for e in row))

def rows_to(cv, rows, x0, y0, main, cmap=None):
    """글자열로 손 도트: 숫자 = main 램프의 단, '.' = 건드리지 않음, 그 밖의 글자 = cmap[글자] = (램프, 단)."""
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch == '.' or ch == ' ': continue
            if ch.isdigit(): cv.px(x0 + i, y0 + j, main, int(ch))
            else: cv.px(x0 + i, y0 + j, *cmap[ch])

def door_skeleton(cv, r, leaf, L=(1, 5, 4, 2), R=(4, 4, 3, 1), T=(1, 5, 4, 2), sill=1, under=None):
    """16x32 문 뼈대(모든 문 킷 같은 틀): 위 2px 비움, 문틀 4px, 문짝 x4..11, 밑줄 y31.
    L=(윤곽,밝은 테,몸,안쪽) 왼, R=(안쪽,몸,그늘,윤곽) 오른, T=(윤곽,밝은 테,몸,안쪽) 인방."""
    for y in range(2, 32):
        for i, t in enumerate(L): cv.px(i, y, r, t)
        for i, t in enumerate(R): cv.px(12 + i, y, r, t)
    cv.hl(2, 0, 15, r, T[0])
    cv.hl(3, 1, 14, r, T[1]); cv.hl(4, 1, 14, r, T[2]); cv.hl(5, 3, 12, r, T[3])
    cv.px(14, 3, r, max(T[1] - 1, 0)); cv.px(14, 4, r, max(T[2] - 1, 0))
    cv.px(0, 3, r, T[0]); cv.px(0, 4, r, T[0])
    cv.px(15, 3, r, T[0]); cv.px(15, 4, r, T[0])
    cv.rect(4, 6, 11, 30, r, leaf)
    cv.hl(31, 0, 15, r, sill)
