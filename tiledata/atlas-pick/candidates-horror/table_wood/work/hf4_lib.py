"""hf4(호러 2판 기본 가구 작업자) 공용 도우미 — 색을 계산하지 않는다. 좌표를 손으로 정해 칸을 채우고 찍는 것뿐이다.
글자 하나 = (재료 글자, 단). 숫자 1~6 은 기본 재료(m=mahog)의 단, 나머지 글자는 범례로 정한다."""
import os
H = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

class Cv:
    def __init__(s, w, h, legend, mats):
        s.w, s.h, s.legend, s.mats = w, h, legend, mats
        s.g = [['.'] * w for _ in range(h)]
        s.ov = [['.'] * w for _ in range(h)]   # 겹침(%)
    def px(s, x, y, c):
        assert 0 <= x < s.w and 0 <= y < s.h, (x, y)
        s.g[y][x] = c
    def rect(s, x0, y0, x1, y1, c):           # 양 끝 포함
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.px(x, y, c)
    def row(s, y, x0, text):                   # y 줄의 x0 부터 text 를 깐다
        for i, c in enumerate(text): s.px(x0 + i, y, c)
    def hline(s, y, x0, x1, c): s.rect(x0, y, x1, y, c)
    def vline(s, x, y0, y1, c): s.rect(x, y0, x, y1, c)
    def glow(s, x, y, c='%'):
        assert 0 <= x < s.w and 0 <= y < s.h, (x, y)
        s.ov[y][x] = c
    def show(s): return '\n'.join(''.join(r) for r in s.g)
    def emit(s, slug, col, note, worker='hf4'):
        mrows, trows = [], []
        for r in s.g:
            m = t = ''
            for c in r:
                if c == '.': m += '.'; t += '.'
                else:
                    mat, tone = s.legend[c]; m += mat; t += str(tone)
            mrows.append(m); trows.append(t)
        L = [f'// {slug} {worker}-{col}', f'@size {s.w} {s.h}', '@cell 16', '@palette palette.pal', '@layer main']
        L += [f'@mat {k} {v} 0' for k, v in s.mats.items()]
        L += ['@mblock 0 0'] + mrows + ['@tblock 0 0'] + trows
        if any(c != '.' for r in s.ov for c in r):
            L += ['@layer shadow', '@block 0 0'] + [''.join(r) for r in s.ov]
        d = os.path.join(H, slug)
        open(os.path.join(d, f'{worker}-{col}.pxg'), 'w').write('\n'.join(L) + '\n')
        open(os.path.join(d, f'{worker}-{col}.note'), 'w').write(note + '\n')

def mahog_legend(extra=None):
    lg = {str(i): ('m', i) for i in range(0, 7)}
    if extra: lg.update(extra)
    return lg
