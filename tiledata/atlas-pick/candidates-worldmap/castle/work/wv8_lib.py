"""wv8 월드맵 2판 아이콘 그리기 도우미 — pxgrid 격자(.pxg)를 만든다. 색은 palette.pal 램프만."""
import os, sys, random
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))  # candidates-worldmap
LETTERS = 'abcdefghijklmnopqrstuvwxyz'
STEP = '0123456789abcde'
RAMPLEN = {'mgran': 7, 'mwhite': 6, 'mpurple': 6, 'mout': 3, 'mred': 6, 'mbrick': 6, 'mmetal': 8, 'wstone': 7,
           'wroofr': 5, 'wroofb': 5, 'wgold': 5, 'wrock': 7, 'wlava': 6, 'wswamp': 6, 'wmead': 6, 'wdirt': 5,
           'wgrass': 6, 'wbark': 4, 'mdglass': 8, 'myellow': 6, 'mglass': 8, 'wpoison': 6, 'wash': 6, 'wsnow': 7,
           'wleaf': 6, 'whill': 6, 'wsand': 6, 'wdune': 4, 'wsea': 6, 'wfoam': 3, 'mblue': 6, 'mnavy': 6, 'mwood': 6}


class Cv:
    def __init__(s, slug, w, h):
        s.slug, s.w, s.h = slug, w, h
        s.m = [[None] * w for _ in range(h)]
        s.t = [[0] * w for _ in range(h)]
        s.sh = [['.'] * w for _ in range(h)]
        s.gl = [['.'] * w for _ in range(h)]

    # ── 화소 ──
    def put(s, x, y, ramp, step):
        if 0 <= x < s.w and 0 <= y < s.h:
            n = RAMPLEN[ramp]
            s.m[y][x] = ramp
            s.t[y][x] = max(0, min(n - 1, step))

    def get(s, x, y):
        if 0 <= x < s.w and 0 <= y < s.h:
            return s.m[y][x]
        return None

    def rect(s, x0, y0, x1, y1, ramp, step):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                s.put(x, y, ramp, step)

    def erase(s, x, y):
        if 0 <= x < s.w and 0 <= y < s.h:
            s.m[y][x] = None

    def adj(s, x, y, d):
        if s.get(x, y):
            s.t[y][x] = max(0, min(RAMPLEN[s.m[y][x]] - 1, s.t[y][x] + d))

    # ── 모양 ──
    def shape(s, pts, ramp, shade, outline=True, lit=(2, 1)):
        """pts: {(x,y)} ; shade(x,y,info)->step. 바깥선: 왼·위 = 1단, 오른·아래 = 0단(가장 어둡게)."""
        pts = set(pts)
        n = RAMPLEN[ramp]
        for (x, y) in pts:
            edge_r = (x + 1, y) not in pts
            edge_b = (x, y + 1) not in pts
            edge_l = (x - 1, y) not in pts
            edge_t = (x, y - 1) not in pts
            if outline and (edge_r or edge_b):
                s.put(x, y, ramp, 0)
            elif outline and (edge_l or edge_t):
                s.put(x, y, ramp, 1)
            else:
                s.put(x, y, ramp, shade(x, y))
        return pts

    def body(s, x0, x1, y0, y1, ramp, hi=None, lo=None, cyl=True, outline=True):
        """직사각(원통) 몸통. 가로로 왼 밝음 → 오른 어두움."""
        n = RAMPLEN[ramp]
        hi = n - 2 if hi is None else hi
        lo = max(2, round(hi * .45)) if lo is None else lo
        W = x1 - x0

        def sh(x, y):
            u = (x - x0) / max(1, W)
            if not cyl:
                v = hi if u < .5 else hi - 1
            else:
                v = round(hi - (hi - lo) * min(1, u / .85))
                if u < .22: v = hi
            if y <= y0 + 1: v += 1
            return v
        pts = {(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)}
        s.shape(pts, ramp, sh, outline)
        return pts

    def cone(s, xc, ytop, ybase, half, ramp, hi=None, lo=None, eave=0):
        """뾰족 지붕: 꼭대기 ytop(1폭) → 밑 ybase(2*half+1 폭). 왼 밝음."""
        n = RAMPLEN[ramp]
        hi = n - 2 if hi is None else hi
        lo = max(1, hi - 2) if lo is None else lo
        pts = set()
        H = ybase - ytop
        for y in range(ytop, ybase + 1):
            hw = round(half * (y - ytop) / max(1, H))
            for x in range(xc - hw, xc + hw + 1):
                pts.add((x, y))

        def sh(x, y):
            u = (x - xc)
            return hi if u < -0 else (lo if u > 0 else (hi + lo) // 2 + 0)
        s.shape(pts, ramp, sh)
        return pts

    def spans(s, rows, ramp, shade=None, hi=None, lo=None):
        """rows: {y:(xl,xr)}"""
        n = RAMPLEN[ramp]
        hi = n - 2 if hi is None else hi
        lo = max(1, hi - 2) if lo is None else lo
        pts = {(x, y) for y, (a, b) in rows.items() for x in range(a, b + 1)}
        xs = [x for x, _ in pts]
        xm = (min(xs) + max(xs)) / 2

        def sh(x, y):
            return hi if x < xm - .5 else (lo if x > xm + .5 else (hi + lo) // 2)
        s.shape(pts, ramp, shade or sh)
        return pts

    def crenel(s, x0, x1, ybase, ramp, hi=None, period=3, mw=2, h=2):
        """ybase 바로 위로 톱니(merlon)를 세운다. ybase = 몸통 맨 윗줄."""
        n = RAMPLEN[ramp]
        hi = n - 2 if hi is None else hi
        pts = set()
        for x in range(x0, x1 + 1):
            if (x - x0) % period < mw:
                for k in range(1, h + 1):
                    pts.add((x, ybase - k))
        W = x1 - x0

        def sh(x, y):
            return hi if (x - x0) < W * .5 else max(2, hi - 2)
        s.shape(pts, ramp, sh)
        # 톱니 사이 골 = 몸통 윗줄은 그대로. 톱니 밑 이음 지움 방지
        return pts

    def door(s, x0, x1, y0, y1, dark=('mout', 0), arch=True, frame=None):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if arch and y == y0 and (x == x0 or x == x1):
                    continue
                s.put(x, y, *dark)

    def texture(s, pts, courses=4, seed=0, dark=1, joint=True):
        """돌 결: 가로 줄(course) 몇 줄을 한 단 어둡게, 세로 이음을 엇갈려 두어 개. 바깥선 안쪽에만."""
        rnd = random.Random(seed)
        ys = sorted({y for _, y in pts})
        if not ys:
            return
        y0 = ys[0]
        for (x, y) in pts:
            if (x + 1, y) not in pts or (x, y + 1) not in pts or (x - 1, y) not in pts or (x, y - 1) not in pts:
                continue
            if (y - y0) % courses == courses - 1:
                s.adj(x, y, -dark)
            elif joint and (y - y0) % courses == courses // 2 and (x + ((y - y0) // courses) * 2) % 5 == 0:
                s.adj(x, y, -dark)

    # ── 그림자·불빛 ──
    def shadow(s, dx=2, dy=2, rows=3):
        """오브젝트 밑 rows 줄을 (dx,dy) 밀어 오른쪽 아래에 반투명 그림자('~'), 한 칸 더 밀어 번짐('-')."""
        ys = [y for y in range(s.h) for x in range(s.w) if s.m[y][x]]
        ymax = max(ys)
        for (ddx, ddy, ch) in ((dx + 1, dy + 1, '-'), (dx, dy, '~')):
            for y in range(s.h):
                for x in range(s.w):
                    if s.m[y][x] and y > ymax - rows:
                        tx, ty = x + ddx, y + ddy
                        if 0 <= tx < s.w and 0 <= ty < s.h and not s.m[ty][tx]:
                            s.sh[ty][tx] = ch

    def glow(s, x, y, ch='%'):
        if 0 <= x < s.w and 0 <= y < s.h:
            s.gl[y][x] = ch

    # ── 내보내기 ──
    def emit(s, name, note, hdr=''):
        ramps = []
        for row in s.m:
            for r in row:
                if r and r not in ramps:
                    ramps.append(r)
        L = {r: LETTERS[i] for i, r in enumerate(ramps)}
        out = [f'// {s.slug} {name} {hdr}'.rstrip(), f'@size {s.w} {s.h}', '@cell 16', '@palette palette.pal']
        if any(c != '.' for row in s.sh for c in row):
            out += ['@layer shadow', '@block 0 0'] + [''.join(r) for r in s.sh]
        out.append('@layer main')
        for r in ramps:
            out.append(f'@mat {L[r]} {r} 0')
        out.append('@mblock 0 0')
        out += [''.join(L[c] if c else '.' for c in row) for row in s.m]
        out.append('@tblock 0 0')
        out += [''.join(STEP[s.t[y][x]] if s.m[y][x] else '.' for x in range(s.w)) for y in range(s.h)]
        if any(c != '.' for row in s.gl for c in row):
            out += ['@layer glow', '@block 0 0'] + [''.join(r) for r in s.gl]
        d = os.path.join(ROOT, s.slug)
        os.makedirs(os.path.join(d, 'work'), exist_ok=True)
        open(os.path.join(d, f'{name}.pxg'), 'w').write('\n'.join(out) + '\n')
        open(os.path.join(d, f'{name}.note'), 'w').write(note + '\n')
        # 단계 파일: 1 실루엣 / 2 평면색
        sil = [f'// {s.slug} {name} 1단계 실루엣', f'@size {s.w} {s.h}', '@cell 16', '@palette palette.pal', '@layer main', '@block 0 0']
        sil += [''.join('#' if s.m[y][x] else '.' for x in range(s.w)) for y in range(s.h)]
        open(os.path.join(d, 'work', f'{name}-1.pxg'), 'w').write('\n'.join(sil) + '\n')
        flat = list(out[:4]) + ['@layer main'] + [o for o in out if o.startswith('@mat ')] + ['@mblock 0 0']
        flat += [''.join(L[c] if c else '.' for c in row) for row in s.m]
        open(os.path.join(d, 'work', f'{name}-2.pxg'), 'w').write('\n'.join(flat) + '\n')

    def ascii(s):
        return '\n'.join(''.join((s.m[y][x] or '.')[1] if s.m[y][x] else '.' for x in range(s.w)) for y in range(s.h))
