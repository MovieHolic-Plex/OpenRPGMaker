"""h5 작도 도우미 — 글자 격자를 손으로 놓는 표기 보조(보간·난수 없음). 산출은 pxg_emit.emit 으로 .pxg."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'scripts', 'content', 'atlas-pick'))
from pxg_emit import emit

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'candidates-horror')

class C:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.g = [['.'] * w for _ in range(h)]
    def px(s, x, y, ch):
        if 0 <= x < s.w and 0 <= y < s.h: s.g[y][x] = ch
    def rect(s, x, y, w, h, ch):
        for j in range(y, y + h):
            for i in range(x, x + w): s.px(i, j, ch)
    def row(s, x, y, txt):
        for i, ch in enumerate(txt):
            if ch != ' ' and ch != '`': s.px(x + i, y, ch)   # ' ' / '`' = 건드리지 않음
    def stamp(s, x, y, rows):
        for j, r in enumerate(rows): s.row(x, y + j, r)
    def hl(s, x, y, n, ch): s.rect(x, y, n, 1, ch)
    def vl(s, x, y, n, ch): s.rect(x, y, 1, n, ch)
    def rows(s): return [''.join(r) for r in s.g]

def save(slug, name, c, legend, note):
    d = os.path.join(ROOT, slug)
    open(os.path.join(d, name + '.pxg'), 'w').write(emit(c.rows(), legend, title=slug + ' ' + name))
    open(os.path.join(d, name + '.note'), 'w').write(note + '\n')
    print(name, 'saved')
