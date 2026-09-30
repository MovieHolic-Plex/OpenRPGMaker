"""w6 작도 보조: 범례(글자 -> 램프:단 또는 P:팔레트글자)로 그린 격자를 pxgrid 문서로 옮긴다. 색은 만들지 않는다 — 단을 손으로 놓는 표기일 뿐."""
import os, sys
def emit(path, legend, rows, cell=16):
    W = len(rows[0]); H = len(rows)
    assert all(len(r) == W for r in rows), [ (i,len(r)) for i,r in enumerate(rows) if len(r)!=W]
    ramps = []
    for v in legend.values():
        if not v.startswith('P:') and v.split(':')[0] not in ramps: ramps.append(v.split(':')[0])
    letter = {r: chr(ord('a') + i) for i, r in enumerate(ramps)}
    pal, mat, tone = [], [], []
    for r in rows:
        p = m = t = ''
        for ch in r:
            if ch == '.': p += '.'; m += '.'; t += '.'; continue
            v = legend[ch]
            if v.startswith('P:'): p += v[2:]; m += '.'; t += '.'
            else:
                ra, to = v.split(':'); p += '.'; m += letter[ra]; t += to
        pal.append(p); mat.append(m); tone.append(t)
    out = [f'@size {W} {H}', f'@cell {cell}', '@palette palette.pal']
    for ra, l in letter.items(): out.append(f'@mat {l} {ra}')
    out += ['@block 0 0'] + pal + ['@mblock 0 0'] + mat + ['@tblock 0 0'] + tone
    open(path, 'w').write('\n'.join(out) + '\n')

class Cv:
    def __init__(s, w, h, top=0):
        s.w, s.h, s.top = w, h, top
        s.g = [['.'] * w for _ in range(h)]
    def px(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h: s.g[y][x] = c
    def rect(s, x, y, w, h, c):
        for j in range(h):
            for i in range(w): s.px(x + i, y + j, c)
    def hl(s, x, y, w, c): s.rect(x, y, w, 1, c)
    def vl(s, x, y, h, c): s.rect(x, y, 1, h, c)
    def put(s, x, y, rows, skip='.'):
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch != skip: s.px(x + i, y + j, ch)
    def rows(s):
        # top 패딩 행은 비운 채 내보낸다(좌표는 그림 기준이 아니라 캔버스 기준)
        return [''.join(r) for r in s.g]
    def show(s): print('\n'.join(''.join(r) for r in s.g))
