"""s1 작업자 보조: 사각형·점을 글자 격자에 놓고 .pxg 로 쓴다(글자 하나 = 색 하나 @mat). 색을 계산하지 않는다."""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class G:
    def __init__(s, w, h, mats, comment=''):
        s.w, s.h, s.mats, s.comment = w, h, mats, comment
        s.g = [['.'] * w for _ in range(h)]
    def px(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h: s.g[y][x] = c
    def rect(s, x, y, w, h, c):
        for j in range(y, y + h):
            for i in range(x, x + w): s.px(i, j, c)
    def hl(s, x, y, w, c): s.rect(x, y, w, 1, c)
    def vl(s, x, y, h, c): s.rect(x, y, 1, h, c)
    def pts(s, c, *xy):
        for i in range(0, len(xy), 2): s.px(xy[i], xy[i + 1], c)
    def rows(s, x, y, lines):
        for j, ln in enumerate(lines):
            for i, c in enumerate(ln):
                if c != ' ': s.px(x + i, y + j, c)
    def write(s, slug, name, note):
        d = f'{ROOT}/candidates-school/{slug}'
        out = [f'@size {s.w} {s.h}', '@cell 16', '@palette palette.pal']
        if s.comment: out.append('// ' + s.comment)
        for c, (r, st) in s.mats.items(): out.append(f'@mat {c} {r} {st}')
        out.append('@mblock 0 0')
        out += [''.join(r) for r in s.g]
        open(f'{d}/{name}.pxg', 'w').write('\n'.join(out) + '\n')
        open(f'{d}/{name}.note', 'w').write(note + '\n')
