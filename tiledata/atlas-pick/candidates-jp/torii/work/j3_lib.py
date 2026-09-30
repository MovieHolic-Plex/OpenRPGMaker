"""j3 작도 도우미. Grid 위에 (램프, 단) 을 직접 놓고 pxgrid 로 내보낸다. 색을 계산하지 않는다."""
import os
TONES = '0123456789abcde'
RAW = '~-%'
class Grid:
    def __init__(s, w, h): s.w, s.h = w, h; s.g = [[None]*w for _ in range(h)]
    def px(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h: s.g[y][x] = c
    def get(s, x, y): return s.g[y][x] if 0 <= x < s.w and 0 <= y < s.h else None
    def rect(s, x, y, w, h, c):
        for yy in range(y, y+h):
            for xx in range(x, x+w): s.px(xx, yy, c)
    def hl(s, x, y, w, c): s.rect(x, y, w, 1, c)
    def vl(s, x, y, h, c): s.rect(x, y, 1, h, c)
    def art(s, x, y, rows, leg):
        """rows: 문자열 목록, leg: 글자->색. '.' = 건너뜀(덮지 않음)."""
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch != '.': s.px(x+i, y+j, leg[ch])
    def frame(s, x, y, w, h, c):
        s.hl(x, y, w, c); s.hl(x, y+h-1, w, c); s.vl(x, y, h, c); s.vl(x+w-1, y, h, c)
    def emit(s, path, note, header=''):
        cells = {c for r in s.g for c in r if isinstance(c, tuple)}
        ramps = []
        for c in sorted(cells, key=lambda t: (t[0], t[1])):
            if c[0] not in ramps: ramps.append(c[0])
        letter = {rp: 'abcdefghijklmnopqrstuvwxyz'[i] for i, rp in enumerate(ramps)}
        out = [f'// {header}', f'@size {s.w} {s.h}', '@cell 16', '@palette palette.pal', '@layer main']
        for rp in ramps: out.append(f'@mat {letter[rp]} {rp} 3')
        mg = [''.join('.' if c is None else (letter[c[0]] if isinstance(c, tuple) else c) for c in r) for r in s.g]
        tg = [''.join(TONES[c[1]] if isinstance(c, tuple) else '.' for c in r) for r in s.g]
        out += ['@mblock 0 0'] + mg + ['@tblock 0 0'] + tg
        open(path, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
        open(os.path.splitext(path)[0] + '.note', 'w', encoding='utf-8').write(note + '\n')
def C(ramp, step): return (ramp, step)

RAMPLEN = dict(masph=6, mconc=7, mpave=8, mgran=7, mbrick=6, mtile=6, mglass=8, mdglass=8, mmetal=8, mwhite=6, myellow=6, mred=6, mgreen=6, mblue=6, mteal=5, mwood=6, morange=6, mpurple=6, mnavy=6, msoil=4,
    shu=7, akachin=7, ai=7, kawara=7, hinoki=7, sumi=6, washi=6, sakura=6, matsu=6, moss=5, ishi=7, lacq=7, taxi=6, neon=6, neonc=6, kgreen=6, korange=6, kblue=6, pole=6, kasa=5)
def sh(c, d, n=None):
    n = RAMPLEN.get(c[0], 7) if n is None else min(n, RAMPLEN.get(c[0], 7))
    return (c[0], max(0, min(n-1, c[1]+d)))
def outline(g, O, OD=None, only=None):
    """빈 칸 중 그림 칸(튜플)에 4방향으로 닿는 곳에 윤곽. 그림의 오른쪽·아래에 닿는 곳은 OD(한 단 어둡게)."""
    OD = OD or O; put = []
    for y in range(g.h):
        for x in range(g.w):
            if g.g[y][x] is not None: continue
            l, r, u, d = g.get(x-1, y), g.get(x+1, y), g.get(x, y-1), g.get(x, y+1)
            isf = lambda c: isinstance(c, tuple) and (only is None or c[0] in only)
            if isf(l) or isf(u): put.append((x, y, OD))
            elif isf(r) or isf(d): put.append((x, y, O))
    for x, y, c in put: g.px(x, y, c)
