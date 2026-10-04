"""h4 작도 도우미 — 격자에 도형·글자 행을 찍고 pxgrid .pxg 로 옮겨 적는다. 색은 (램프,단) 또는 반투명 한 글자."""
import os, random
PAL = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'palette.pal')
RAMPLEN = {}
for ln in open(PAL, encoding='utf-8'):
    if ln.startswith('@rampc'):
        p = ln.split('//')[0].split(); RAMPLEN[p[1]] = len(p) - 2
SINGLE = set('~-%?^"*&+!$')
MATL = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
TONES = '0123456789abcde'

def P(r, t):
    return (r, max(0, min(RAMPLEN[r] - 1, t)))

class Cv:
    def __init__(s, w, h):
        s.w, s.h = w, h; s.p = {}
    def set(s, x, y, v):
        if 0 <= x < s.w and 0 <= y < s.h:
            if v is None: s.p.pop((x, y), None)
            else: s.p[(x, y)] = v
    def get(s, x, y): return s.p.get((x, y))
    def rect(s, x0, y0, x1, y1, v):  # 포함 끝
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.set(x, y, v)
    def hl(s, x0, x1, y, v):
        for x in range(x0, x1 + 1): s.set(x, y, v)
    def vl(s, x, y0, y1, v):
        for y in range(y0, y1 + 1): s.set(x, y, v)
    def line(s, x0, y0, x1, y1, v):
        dx, dy = abs(x1 - x0), -abs(y1 - y0); sx = 1 if x0 < x1 else -1; sy = 1 if y0 < y1 else -1; e = dx + dy
        while True:
            s.set(x0, y0, v)
            if x0 == x1 and y0 == y1: break
            e2 = 2 * e
            if e2 >= dy: e += dy; x0 += sx
            if e2 <= dx: e += dx; y0 += sy
    def ell(s, cx, cy, rx, ry, v, ring=None):  # 채운 타원(중심 실수 가능)
        for y in range(s.h):
            for x in range(s.w):
                d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
                if d <= 1: s.set(x, y, v)
    def ring(s, cx, cy, rx, ry, v, th=1.0):
        for y in range(s.h):
            for x in range(s.w):
                d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
                d2 = ((x + .5 - cx) / (rx - th)) ** 2 + ((y + .5 - cy) / (ry - th)) ** 2
                if d <= 1 and d2 > 1: s.set(x, y, v)
    def paint(s, x0, y0, rows, lg):
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch == '.': continue
                if ch == ' ': continue
                v = lg[ch]
                s.set(x0 + i, y0 + j, v)
    def mask(s): return {k for k in s.p}
    def outline(s, fn, mask=None, sides='udlr'):
        """실루엣 바깥 한 줄 테두리: fn(이웃색)->색. 이미 그려진 칸엔 안 씀."""
        m = mask if mask is not None else s.mask(); add = {}
        for (x, y) in m:
            for dx, dy, c in ((1,0,'r'),(-1,0,'l'),(0,1,'d'),(0,-1,'u')):
                if c in sides and (x+dx, y+dy) not in s.p and 0 <= x+dx < s.w and 0 <= y+dy < s.h:
                    add[(x+dx, y+dy)] = fn(s.p[(x, y)], c)
        for k, v in add.items(): s.p[k] = v
    def rows(s):
        return [''.join('#' if (x, y) in s.p else '.' for x in range(s.w)) for y in range(s.h)]
    def emit(s, path, title):
        cols = {v for v in s.p.values() if isinstance(v, tuple)}
        ramps = sorted({v[0] for v in cols}); mat = {r: MATL[i] for i, r in enumerate(ramps)}
        out = [f'// {title}', f'@size {s.w} {s.h}', '@cell 16', '@palette palette.pal', '@layer main']
        sing = [[s.p.get((x, y)) if isinstance(s.p.get((x, y)), str) else None for x in range(s.w)] for y in range(s.h)]
        if ramps:
            out += [f'@mat {mat[r]} {r} 0' for r in ramps]
            mb, tb = [], []
            for y in range(s.h):
                m = t = ''
                for x in range(s.w):
                    v = s.p.get((x, y))
                    if isinstance(v, tuple): m += mat[v[0]]; t += TONES[v[1]]
                    else: m += '.'; t += '.'
                mb.append(m); tb.append(t)
            out += ['@mblock 0 0'] + mb + ['@tblock 0 0'] + tb
        if any(c for r in sing for c in r):
            if ramps: out.append('@layer shadow')
            out += ['@block 0 0'] + [''.join(c or '.' for c in r) for r in sing]
        open(path, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
