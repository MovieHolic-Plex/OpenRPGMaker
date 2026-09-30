import os, subprocess, sys
ROOT = '/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick'
CAND = ROOT + '/tiledata/atlas-pick/candidates-horror'
TONES = '0123456789abcde'
class Cv:
    def __init__(s, w, h, mats):
        s.w, s.h, s.mats = w, h, mats          # mats: {letter: ramp}
        s.m = [['.'] * w for _ in range(h)]
        s.t = [[0] * w for _ in range(h)]
    def p(s, x, y, m, t):
        if 0 <= x < s.w and 0 <= y < s.h:
            s.m[y][x] = m; s.t[y][x] = t
    def clr(s, x, y):
        if 0 <= x < s.w and 0 <= y < s.h: s.m[y][x] = '.'
    def R(s, x, y, w, h, m, t):
        for j in range(h):
            for i in range(w): s.p(x + i, y + j, m, t)
    def art(s, x, y, rows, leg):
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch == ' ' or ch == '.': continue
                m, t = leg[ch]; s.p(x + i, y + j, m, t)
    def save(s, slug, name='v34-A', note=''):
        d = f'{CAND}/{slug}'
        L = [f'// {slug} {name}', f'@size {s.w} {s.h}', '@cell 16', '@palette palette.pal', '@layer main']
        for k, v in s.mats.items(): L.append(f'@mat {k} {v} 0')
        L.append('@mblock 0 0'); L += [''.join(r) for r in s.m]
        L.append('@tblock 0 0'); L += [''.join(TONES[s.t[y][x]] if s.m[y][x] != '.' else '.' for x in range(s.w)) for y in range(s.h)]
        open(f'{d}/{name}.pxg', 'w').write('\n'.join(L) + '\n')
        if note: open(f'{d}/{name}.note', 'w').write(note + '\n')
        r = subprocess.run([sys.executable, ROOT + '/scripts/content/pixel-harness/pxgrid/pxgrid.py', 'render', f'{d}/{name}.pxg', '-o', f'{d}/{name}.png'], capture_output=True, text=True)
        if r.returncode: print(r.stdout, r.stderr)

def outline(c, t=1, mats=None, bt=None, keep=()):
    """실루엣 가장자리(4방향 이웃 중 투명이 있는 불투명 화소)를 재질의 어두운 단 t 로. bt = 아래쪽 가장자리 단(더 어둡게)."""
    W, H = c.w, c.h
    op = [[c.m[y][x] != '.' for x in range(W)] for y in range(H)]
    def o(x, y): return 0 <= x < W and 0 <= y < H and op[y][x]
    for y in range(H):
        for x in range(W):
            if not op[y][x] or (x, y) in keep: continue
            if not (o(x-1, y) and o(x+1, y) and o(x, y-1) and o(x, y+1)):
                bottom = not o(x, y+1)
                c.t[y][x] = (bt if (bt is not None and bottom) else t)
