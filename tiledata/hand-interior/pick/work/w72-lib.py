# w72 보조: 격자 그리기 도우미. 사용: from w72_lib import *
BASE='/home/main/z-project/rpg-zzu-interior-v34b/tiledata/hand-interior/pick'
import os
class C:
    def __init__(s, slug, v, W, H, legend, note=''):
        s.slug, s.v, s.W, s.H, s.leg = slug, v, W, H, legend
        s.g = [['.']*W for _ in range(H)]; s.note = note
    def p(s, x, y, ch):
        if 0 <= x < s.W and 0 <= y < s.H: s.g[y][x] = ch
    def r(s, x0, y0, x1, y1, ch):
        for y in range(y0, y1+1):
            for x in range(x0, x1+1): s.p(x, y, ch)
    def box(s, x0, y0, x1, y1, ch):
        for x in range(x0, x1+1): s.p(x, y0, ch); s.p(x, y1, ch)
        for y in range(y0, y1+1): s.p(x0, y, ch); s.p(x1, y, ch)
    def row(s, x, y, text):
        for i, ch in enumerate(text):
            if ch != ' ': s.p(x+i, y, ch)
    def pat(s, x, y, rows):
        for j, t in enumerate(rows):
            for i, ch in enumerate(t):
                if ch != ' ': s.p(x+i, y+j, ch)
    def save(s):
        d = os.path.join(BASE, 'candidates', s.slug)
        out = [f'// w72-{s.v} {s.note}']
        for k, v in s.leg.items(): out.append(f'{k} {v}')
        out += [f'@size {s.W} {s.H}', '@grid'] + [''.join(r) for r in s.g]
        open(os.path.join(d, f'w72-{s.v}.src'), 'w').write('\n'.join(out) + '\n')
        os.system(f'cd {BASE} && python3 w72-gen.py {s.slug}/{s.v}')
        print('\n'.join(''.join(r) for r in s.g))
