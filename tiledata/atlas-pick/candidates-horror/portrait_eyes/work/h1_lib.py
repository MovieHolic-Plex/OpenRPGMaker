"""h1 작업자 도우미 — 글자 그림·도형을 「램프:단」 열쇠 픽셀로 놓아 pxg 를 쓴다(보간·난수 없음, 손으로 놓는 것과 같다)."""
import os, re, sys
TRANS = set('~-%?^"*&+!$')
HERE = os.path.dirname(os.path.abspath(__file__))
CAND = os.path.abspath(os.path.join(HERE, '..', '..'))

def pal_ramps(path):
    r = {}
    for l in open(path, encoding='utf-8'):
        if l.startswith('@rampc'):
            p = l.split('//')[0].split(); r[p[1]] = len(p) - 2
    return r

class Canvas:
    def __init__(self, slug, W, H):
        self.slug, self.W, self.H = slug, W, H
        self.dir = os.path.join(CAND, slug)
        self.ramps = pal_ramps(os.path.join(self.dir, 'palette.pal'))
        self.L = {}
        self.order = []
    def layer(self, n):
        if n not in self.L:
            self.L[n] = [[None] * self.W for _ in range(self.H)]; self.order.append(n)
        return self.L[n]
    def key(self, k):
        if k in TRANS: return k
        if ':' in k:
            r, s = k.split(':'); s = int(s)
            n = self.ramps[r]; s = max(0, min(n - 1, s)); return f'{r}:{"0123456789abcde"[s]}'
        raise ValueError(k)
    def px(self, x, y, k, layer='b'):
        if not (0 <= x < self.W and 0 <= y < self.H): return
        g = self.layer(layer)
        g[y][x] = None if k in ('.', None) else self.key(k)
    def get(self, x, y, layer='b'):
        if not (0 <= x < self.W and 0 <= y < self.H): return None
        return self.layer(layer)[y][x]
    def rect(self, x0, y0, x1, y1, k, layer='b'):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): self.px(x, y, k, layer)
    def hline(self, x0, x1, y, k, layer='b'): self.rect(x0, y, x1, y, k, layer)
    def vline(self, x, y0, y1, k, layer='b'): self.rect(x, y0, x, y1, k, layer)
    def ell(self, cx, cy, rx, ry, k, layer='b', pred=None):
        for y in range(self.H):
            for x in range(self.W):
                dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry
                if dx * dx + dy * dy <= 1.0 and (pred is None or pred(x, y)): self.px(x, y, k, layer)
    def line(self, x0, y0, x1, y1, k, layer='b'):
        dx, dy = abs(x1 - x0), abs(y1 - y0); sx = 1 if x0 < x1 else -1; sy = 1 if y0 < y1 else -1
        err = dx - dy
        while True:
            self.px(x0, y0, k, layer)
            if x0 == x1 and y0 == y1: break
            e2 = 2 * err
            if e2 > -dy: err -= dy; x0 += sx
            if e2 < dx: err += dx; y0 += sy
    def art(self, ox, oy, rows, legend, layer='b'):
        """rows: 글자 줄. '.' 는 건드리지 않음, '_' 는 지움. legend: 글자→열쇠."""
        for j, row in enumerate(rows):
            for i, c in enumerate(row):
                if c == '.': continue
                if c == '_': self.px(ox + i, oy + j, None, layer); continue
                if c in TRANS and c not in legend: self.px(ox + i, oy + j, c, layer); continue
                self.px(ox + i, oy + j, legend[c], layer)
    def outline(self, layer='b', dtl=3, dbr=4, mins=None, keep=None, bottom_open=False):
        """안쪽 윤곽: 빈칸(또는 캔버스 밖 — bottom_open 이면 아래는 제외)과 맞닿은 칸을 같은 램프의 어두운 단으로.
        위·왼쪽은 dtl 단, 아래·오른쪽은 dbr 단 내린다. mins: 램프별 하한."""
        g = self.layer(layer); mins = mins or {}; keep = keep or set()
        H, W = self.H, self.W
        def emp(x, y):
            if 0 <= x < W and 0 <= y < H: return g[y][x] is None
            return not (bottom_open and y >= H)
        out = []
        for y in range(H):
            for x in range(W):
                k = g[y][x]
                if k is None or k in TRANS or k in keep: continue
                r, s = k.split(':'); s = '0123456789abcde'.index(s)
                br = emp(x, y + 1) or emp(x + 1, y); tl = emp(x, y - 1) or emp(x - 1, y)
                if br: ns = s - dbr
                elif tl: ns = s - dtl
                else: continue
                ns = max(mins.get(r, 0), ns)
                if ns < s: out.append((x, y, f'{r}:{"0123456789abcde"[ns]}'))
        for x, y, k in out: g[y][x] = k
    def flat(self):
        f = [[None] * self.W for _ in range(self.H)]
        for n in self.order:
            for y in range(self.H):
                for x in range(self.W):
                    if self.L[n][y][x] is not None: f[y][x] = self.L[n][y][x]
        return f
    def _write(self, path, layers, keyfn=lambda k: k):
        out = [f'// {os.path.basename(path)} — h1 작업자(손으로 놓은 픽셀). 램프:단 열쇠 / 반투명은 팔레트 글자',
               f'@size {self.W} {self.H}', '@cell 16', '@palette palette.pal']
        for n in layers:
            g = self.L[n]; out.append(f'@layer {n}')
            for y in range(self.H):
                items = [f'{x} {y} {keyfn(g[y][x])}' for x in range(self.W) if g[y][x] is not None]
                for i in range(0, len(items), 8): out.append('@px ' + ' '.join(items[i:i + 8]))
        open(path, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
    def save(self, name, note, stage=True):
        """name 예: 'h1-A'. 최종 pxg + 실루엣 단계(work/) + .note"""
        self._write(os.path.join(self.dir, name + '.pxg'), self.order)
        if stage:
            wd = os.path.join(self.dir, 'work'); os.makedirs(wd, exist_ok=True)
            # 실루엣 단계: 모든 층의 불투명 칸을 한 색 # 로
            sil = Canvas.__new__(Canvas); sil.__dict__.update(self.__dict__)
            sil.L = {'b': [[('#' if (self.flat()[y][x] is not None and self.flat()[y][x] not in TRANS) else None) for x in range(self.W)] for y in range(self.H)]}
            sil.order = ['b']
            sp = os.path.join(wd, name + '-1sil.pxg')
            sil._write(sp, ['b'])
            # palette 상대 경로 보정
            t = open(sp, encoding='utf-8').read().replace('@palette palette.pal', '@palette ../palette.pal')
            open(sp, 'w', encoding='utf-8').write(t)
        open(os.path.join(self.dir, name + '.note'), 'w', encoding='utf-8').write(note.strip() + '\n')
