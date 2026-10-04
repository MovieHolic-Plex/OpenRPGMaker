"""w10 작업용: 글자 격자 → .pxg (@mat + @mblock 한 덩이). 범례 글자는 '램프:단'. ~ - 는 그림자."""
import os, subprocess, sys
ROOT = '/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-i16-pick'
CAND = ROOT + '/tiledata/hand-interior/pick/candidates'

class Cv:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.g = [['.'] * w for _ in range(h)]
    def blit(s, rows, x, y, flip=False, skip='.'):
        for j, r in enumerate(rows):
            if flip: r = r[::-1]
            for i, c in enumerate(r):
                if c == skip: continue
                X, Y = x + i, y + j
                if 0 <= X < s.w and 0 <= Y < s.h: s.g[Y][X] = c
    def put(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h: s.g[y][x] = c
    def rect(s, x, y, w, h, c):
        for j in range(h):
            for i in range(w): s.put(x + i, y + j, c)
    def hline(s, x, y, n, c):
        for i in range(n): s.put(x + i, y, c)
    def vline(s, x, y, n, c):
        for j in range(n): s.put(x, y + j, c)
    def rows(s): return [''.join(r) for r in s.g]

def emit(slug, name, legend, rows, w, h):
    assert len(rows) == h, (name, len(rows), h)
    for i, r in enumerate(rows): assert len(r) == w, (name, i, len(r), r)
    used = sorted({c for r in rows for c in r} - set('.~-'))
    out = [f'// w10 {name}', f'@size {w} {h}', '@cell 16', '@palette palette.pal']
    for c in used:
        ramp, t = legend[c].split(':')
        out.append(f'@mat {c} {ramp} {t}')
    out.append('@mblock 0 0'); out += rows
    p = f'{CAND}/{slug}/{name}.pxg'
    open(p, 'w').write('\n'.join(out) + '\n')
    return p

def check(p):
    r = subprocess.run(['python3', ROOT + '/scripts/content/hand-interior-pick/check_candidate.py', p], capture_output=True, text=True, cwd=ROOT)
    print(r.stdout[-1500:], r.stderr[-800:])
    r = subprocess.run(['python3', ROOT + '/scripts/content/hand-interior-pick/context.py', p], capture_output=True, text=True, cwd=ROOT)
    print(r.stdout[-300:], r.stderr[-500:])
