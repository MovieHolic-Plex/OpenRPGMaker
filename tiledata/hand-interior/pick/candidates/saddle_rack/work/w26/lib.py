# w26 helper: (재료 램프, 단) 캔버스 -> @mat/@mblock/@tblock .pxg 출력
import math
LET = {}  # ramp -> letter
class Cv:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.g = [[None]*w for _ in range(h)]
    def put(s, x, y, ramp, step):
        if 0 <= x < s.w and 0 <= y < s.h:
            s.g[y][x] = (ramp, step)
    def get(s, x, y):
        return s.g[y][x] if 0 <= x < s.w and 0 <= y < s.h else None
    def fill(s, pred, ramp, lo, hi, box=None, bands=None):
        """pred(x,y)->bool. 왼위 빛: 단 lo(밝음 hi)."""
        pts = [(x, y) for y in range(s.h) for x in range(s.w) if pred(x, y)]
        if not pts: return
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        w = max(1, x1-x0); h = max(1, y1-y0)
        for x, y in pts:
            t = 0.45*(x-x0)/w + 0.55*(y-y0)/h  # 0 밝음 .. 1 어두움
            n = hi-lo+1
            st = hi - min(n-1, int(t*n))
            s.put(x, y, ramp, st)
    def rect(s, x0, y0, x1, y1, ramp, lo, hi):
        s.fill(lambda x, y: x0 <= x <= x1 and y0 <= y <= y1, ramp, lo, hi)
    def ell(s, cx, cy, rx, ry, ramp, lo, hi):
        s.fill(lambda x, y: ((x-cx)/rx)**2+((y-cy)/ry)**2 <= 1.0, ramp, lo, hi)
    def poly(s, pts, ramp, lo, hi):
        def inside(x, y):
            px, py = x+.5, y+.5; c = False
            for i in range(len(pts)):
                ax, ay = pts[i]; bx, by = pts[(i+1) % len(pts)]
                if (ay > py) != (by > py) and px < (bx-ax)*(py-ay)/(by-ay)+ax: c = not c
            return c
        s.fill(inside, ramp, lo, hi)
    def outline(s, dark=0, side=1, skip=()):
        """투명에 닿은 칸을 자기 램프의 어두운 단으로. 오른쪽/아래는 한 단 더 어둡게."""
        out = []
        for y in range(s.h):
            for x in range(s.w):
                c = s.g[y][x]
                if not c or c[0] in skip: continue
                edges = [(dx, dy) for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)) if not s.get(x+dx, y+dy)]
                if edges:
                    rd = any(e in ((1,0),(0,1)) for e in edges)
                    out.append((x, y, c[0], dark if rd else dark+side))
        for x, y, r, st in out: s.g[y][x] = (r, st)
    def shadow(s, cells):
        pass
    def dump(s, path_head, hdr_size, palette='palette.pal', extra=''):
        ramps = []
        for row in s.g:
            for c in row:
                if c and c[0] not in ramps: ramps.append(c[0])
        letters = 'mnopqrstuvwxyz'
        mp = {r: letters[i] for i, r in enumerate(ramps)}
        L = [f'@size {s.w} {s.h}', '@cell 16', f'@palette {palette}']
        for r in ramps: L.append(f'@mat {mp[r]} {r} 3')
        L.append('@mblock 0 0')
        for row in s.g: L.append(''.join(mp[c[0]] if c else '.' for c in row))
        L.append('@tblock 0 0')
        for row in s.g: L.append(''.join('0123456789abcde'[c[1]] if c else '.' for c in row))
        return '\n'.join(L)+'\n'
