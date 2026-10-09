# s3 도우미 v2 — 램프·단을 글자로 자동 배정한다. k(램프,단) → 글자. put(x,y,rows,램프): 숫자=단, 공백=건드리지 않음, '.'=지움
import os
AL = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
class C:
    def __init__(s, W, H):
        s.W, s.H = W, H
        s.g = [['.'] * W for _ in range(H)]
        s.m = {}   # (ramp,stage)->char
    def k(s, r, st):
        key = (r, st)
        if key not in s.m: s.m[key] = AL[len(s.m)]
        return s.m[key]
    def _c(s, c):
        return s.k(*c) if isinstance(c, tuple) else c
    def px(s, x, y, c):
        if 0 <= x < s.W and 0 <= y < s.H: s.g[y][x] = s._c(c)
    def get(s, x, y): return s.g[y][x]
    def rect(s, x, y, w, h, c):
        for j in range(y, y + h):
            for i in range(x, x + w): s.px(i, j, c)
    def hl(s, x, y, n, c):
        for i in range(n): s.px(x + i, y, c)
    def vl(s, x, y, n, c):
        for j in range(n): s.px(x, y + j, c)
    def box(s, x, y, w, h, fill, tl, br):
        s.rect(x, y, w, h, fill)
        s.hl(x, y, w, tl); s.vl(x, y, h, tl)
        s.hl(x, y + h - 1, w, br); s.vl(x + w - 1, y, h, br)
    def put(s, x, y, rows, ramp=None):
        for j, r in enumerate(rows.strip('\n').split('\n')):
            for i, ch in enumerate(r):
                if ch == ' ': continue
                if ch == '.': s.px(x + i, y + j, '.'); continue
                if ramp and ch.isdigit(): s.px(x + i, y + j, (ramp, int(ch)))
                elif ramp and ch in 'abcdef' : s.px(x + i, y + j, (ramp, 10 + ord(ch) - 97))
                else: s.px(x + i, y + j, ch)
    def shadow(s, x, y, w, h=2, only_empty=True):
        for j in range(h):
            for i in range(w):
                if 0 <= x+i < s.W and 0 <= y+j < s.H and s.g[y + j][x + i] == '.':
                    s.px(x + i, y + j, '~' if j == 0 else '-')
    def fliph(s):
        s.g = [r[::-1] for r in s.g]
    def save(s, path, note, cell=16):
        used = {ch for r in s.g for ch in r}
        head = ['@size %d %d' % (s.W, s.H), '@cell %d' % cell, '@palette palette.pal']
        for (r, st), ch in s.m.items():
            if ch in used: head.append('@mat %s %s %d' % (ch, r, st))
        head.append('@mblock 0 0')
        open(path, 'w').write('\n'.join(head + [''.join(r) for r in s.g]) + '\n')
        open(path.replace('.pxg', '.note'), 'w').write(note + '\n')
