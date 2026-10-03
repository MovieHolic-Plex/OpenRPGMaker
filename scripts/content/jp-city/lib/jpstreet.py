"""일본 상가 거리 키트(jp_shopstreet16) 조립기 — 시트 PNG + catalog JSON 만으로 건물·거리를 조립한다. 그림은 그리지 않는다."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import jpenv
import numpy as np
from PIL import Image
import post

def shade_rect(im, x0, y0, x1, y1, dt):
    for y in range(max(y0, 0), min(y1, im.shape[0])):
        for x in range(max(x0, 0), min(x1, im.shape[1])):
            if im[y, x, 3]: im[y, x, :3] = post.step(im[y, x], dt)

class Kit:
    def __init__(self, catalog, sheet):
        self.cat = catalog; self.sheet = sheet; self.cols = catalog['sheet']['cols']
        self.names = catalog['names']; self.bands = catalog['bands']; self.decos = catalog['decos']
        self.props = catalog['props']; self.street = catalog['street']
    @staticmethod
    def load(d):
        cat = json.load(open(os.path.join(d, 'jp_shopstreet16.catalog.json')))
        sheet = np.array(Image.open(os.path.join(d, cat['sheet']['file'])).convert('RGBA'))
        return Kit(cat, sheet)

    def cell(self, name):
        if name is None: return np.zeros((16, 16, 4), np.uint8)
        i = self.names[name]
        if i is None: return np.zeros((16, 16, 4), np.uint8)
        r, c = divmod(i, self.cols); return self.sheet[r * 16:(r + 1) * 16, c * 16:(c + 1) * 16]

    def band_cells(self, bid, nb, vs=(0,)):
        rec = self.bands[bid]; rows = rec['rows']; mw = rec['modw']
        if nb < 3: raise ValueError(f'{bid}: 폭은 3칸 이상 (받은 {nb})')
        g = [[None] * nb for _ in range(rows)]; m = nb - 3; cnt = m // mw
        for r in range(rows):
            g[r][0] = rec['L'][r]; g[r][nb - 2] = rec['R'][0][r]; g[r][nb - 1] = rec['R'][1][r]
        for k in range(cnt):
            mods = rec['mods'][str(vs[k % len(vs)])]
            for j in range(mw):
                for r in range(rows): g[r][1 + k * mw + j] = mods[j][r]
        for c in range(1 + cnt * mw, nb - 2):
            for r in range(rows): g[r][c] = rec['F'][r]
        return g

    def pieces(self, spec):
        n = spec['n']; st = spec.get('setback'); u = st['upper'] if st else 0; ins = st['ins'] if st else 0; ub = n - 2 * ins
        p = [(spec['head'] or spec['roof'], ub if st else n, ins if st else 0, [0])]
        for i, f in enumerate(spec['floors']):
            if st and i == u: p.append(('terrace', n, 0, [0]))
            up = bool(st) and i < u
            p.append(((f['band'] if 'band' in f else f"fl.{f['kind']}.{f.get('wall') or 'kinari'}"), ub if up else n, ins if up else 0, f.get('vs', [0])))
        if spec.get('eave'): p.append((spec['eave'] if isinstance(spec['eave'], str) else 'eave', n, 0, [0]))
        p.append((spec['ground'], n, 0, spec.get('ground_vs', [0])))
        return p

    def with_door(self, spec):
        s = dict(spec); n = s['n']; t, col = s.get('door') or (self.cat['doorDefault'][s['ground']], None)
        w = self.decos[f'door.{t}']['w']
        if col is None: col = n - w
        assert 0 <= col <= n - w, (t, col, n)
        s['decos'] = list(s.get('decos', [])) + [dict(deco=f'door.{t}', col=col, floor='ground')]
        s['_door'] = (t, col, w); return s

    @staticmethod
    def deco_name(d, fl, nf):
        dn = d['deco']
        if dn == 'fe': dn = 'fe_end' if fl == nf - 1 else 'fe'
        if '{c}' in dn: dn = dn.format(c=d['cols'][fl % len(d['cols'])])
        return dn

    def assemble(self, spec):
        spec = self.with_door(spec); n = spec['n']; grid = []; meta = []
        for bid, nb, off, vs in self.pieces(spec):
            g = self.band_cells(bid, nb, vs); r0 = len(grid)
            for r in range(len(g)): grid.append([None] * off + g[r] + [None] * (n - off - nb))
            meta.append((r0, len(g), bid, off, nb))
        R = len(grid); floors = [m for m in meta if m[2].startswith('fl.')]; nf = len(floors); deco = []
        for d in spec.get('decos', []):
            fl = d['floor']; r0 = meta[0][0] if fl == 'head' else meta[-1][0] if fl == 'ground' else floors[fl][0]
            D = self.decos[self.deco_name(d, fl, nf)]
            for rr in range(D['h']):
                for cc in range(D['w']): deco.append((r0 + rr + d.get('row', 0), d['col'] + cc, D['cells'][rr][cc]))
        walk = [['C'] * n for _ in range(R)]; layer = [['up'] * n for _ in range(R)]; gr = meta[-1][0]
        for r in (gr + 1, gr + 2):
            for c in range(n): walk[r][c] = 'S'; layer[r][c] = 'lo'
        t_, c_, w_ = spec['_door']; dcols = list(range(c_, c_ + w_))
        for c in dcols: walk[gr + 2][c] = 'F'
        return {'cells': grid, 'deco': deco, 'walk': walk, 'layer': layer, 'rows': R, 'n': n, 'door_cols': dcols}

    def render(self, asm):
        n, R = asm['n'], asm['rows']; im = np.zeros((R * 16, n * 16, 4), np.uint8)
        def blit(r, c, nm):
            a = self.cell(nm); sub = im[r * 16:(r + 1) * 16, c * 16:(c + 1) * 16]; m = a[..., 3] > 0; sub[m] = a[m]
        for r in range(R):
            for c in range(n):
                if asm['cells'][r][c]: blit(r, c, asm['cells'][r][c])
        for r, c, nm in asm['deco']: blit(r, c, nm)
        if asm.get('shadow'): shade_rect(im, *asm['shadow'], -1)
        return im

    def prop_image(self, name):
        P = self.props[name]; im = np.zeros((P['h'] * 16, P['w'] * 16, 4), np.uint8)
        for r in range(P['h']):
            for c in range(P['w']):
                a = self.cell(P['cells'][r][c]); im[r * 16:(r + 1) * 16, c * 16:(c + 1) * 16] = a
        return im

    def assemble_L(self, spec):
        """L자(ㄱ) 건물: 뒤 본채 + 앞으로 튀어나온 별채(wing). 별채는 depth 칸만큼 앞(아래)에 서고, 본채 앞 남는 땅은 마당/주차장."""
        m = self.assemble(spec['main']); w = self.assemble(spec['wing']); n = m['n']; k = w['n']; d = spec.get('depth', 2)
        side = spec.get('side', 'L'); off = 0 if side == 'L' else n - k
        if side == 'R': assert n - k < n - 2, '본채 문이 별채에 가려짐'
        else: assert k <= n - 2, '별채가 본채 문 칸을 덮음'
        R = max(m['rows'] + d, w['rows']); r_m = R - d - m['rows']; r_w = R - w['rows']
        grid = [[None] * n for _ in range(R)]; walk = [['C'] * n for _ in range(R)]; layer = [['up'] * n for _ in range(R)]
        for r in range(m['rows']):
            for c in range(n): grid[r_m + r][c] = m['cells'][r][c]; walk[r_m + r][c] = m['walk'][r][c]; layer[r_m + r][c] = m['layer'][r][c]
        over = [(r_m + r, c, nm) for r, c, nm in m['deco']]
        for r in range(w['rows']):
            for c in range(k):
                nm = w['cells'][r][c]
                if nm: over.append((r_w + r, off + c, nm))
                walk[r_w + r][off + c] = w['walk'][r][c]; layer[r_w + r][off + c] = w['layer'][r][c]
        over += [(r_w + r, off + c, nm) for r, c, nm in w['deco']]
        yard = spec.get('yard', 'lot')
        for r in range(R - d, R):
            for c in range(n):
                if off <= c < off + k: continue
                if yard == 'lot': nm = ('lot_stop' if r == R - d else 'lot_line') if (c - (off + k if side == 'L' else 0)) % 3 == 0 else 'lot'
                else: nm = yard
                grid[r][c] = self.street[nm]; walk[r][c] = 'F'; layer[r][c] = 'lo'
        doors = [(r_m + m['rows'] - 1, c) for c in m['door_cols']] + [(r_w + w['rows'] - 1, off + c) for c in w['door_cols']]
        shadow = (k * 16, r_w * 16, k * 16 + 5, (r_m + m['rows']) * 16) if side == 'L' else None
        return {'cells': grid, 'deco': over, 'walk': walk, 'layer': layer, 'rows': R, 'n': n, 'door_cols': [], 'doors': doors, 'shadow': shadow}

    def cell_arr_deco(self, name):
        D = self.decos[name]; im = np.zeros((D['h'] * 16, D['w'] * 16, 4), np.uint8)
        for r in range(D['h']):
            for c in range(D['w']): im[r * 16:(r + 1) * 16, c * 16:(c + 1) * 16] = self.cell(D['cells'][r][c])
        return im
