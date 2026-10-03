"""사냥터 검수용 그림. python3 fa_preview.py terrain [out.png]  — 지형 모형(산 · 짐승길 · 키 큰 풀 · 숲 바닥 · 늪)"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'harness'))
from PIL import Image
from tk import hsh
import water_blob as WB


def sheet(tiles, cols, sc=3, bg=(88, 160, 53, 255)):
    rows = (len(tiles) + cols - 1) // cols
    im = Image.new('RGBA', (cols * 16 * sc, rows * 16 * sc), bg)
    for i, t in enumerate(tiles):
        im.alpha_composite(t.img().resize((16 * sc, 16 * sc), Image.NEAREST), ((i % cols) * 16 * sc, (i // cols) * 16 * sc))
    return im


def mask4(cs, x, y):
    return sum(bit for bit, (dx, dy) in ((1, (0, -1)), (2, (1, 0)), (4, (0, 1)), (8, (-1, 0))) if (x + dx, y + dy) in cs)


def mask8(cs, x, y):
    m = 0
    for bit, (dx, dy) in ((WB.N, (0, -1)), (WB.E, (1, 0)), (WB.S, (0, 1)), (WB.W, (-1, 0)), (WB.NE, (1, -1)), (WB.SE, (1, 1)), (WB.SW, (-1, 1)), (WB.NW, (-1, -1))):
        if (x + dx, y + dy) in cs: m |= bit
    return m


def terrain_demo(out, sc=3):
    import fa_ground as F, catalog
    tt = F.terrain_tiles(); base = catalog.terrain()
    Wd, Hd = 30, 18
    grass = base['grass']
    kind = {}
    def fill(k, x0, y0, x1, y1):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): kind[(x, y)] = k
    fill('rock', 2, 1, 9, 4); fill('rock', 4, 5, 7, 6)
    rock = {c for c, v in kind.items() if v == 'rock'}
    face = set()
    for (x, y) in rock:
        if (x, y + 1) not in rock:
            for d in (1, 2):
                if (x, y + d) not in rock: face.add((x, y + d))
    fill('trail', 11, 3, 11, 12); fill('trail', 11, 12, 20, 12); fill('trail', 20, 8, 20, 12)
    fill('tall', 13, 1, 18, 4); fill('tall', 15, 5, 17, 6)
    fill('forest', 22, 1, 28, 6)
    fill('bog', 2, 10, 8, 15)
    sets = {k: {c for c, v in kind.items() if v == k} for k in ('trail', 'tall', 'forest', 'bog')}
    cell = {}
    for y in range(Hd):
        for x in range(Wd):
            k = kind.get((x, y)); tile = grass[hsh(x, y, 3) % 4]
            if (x, y) in face: tile = None
            elif k == 'rock':
                tile = tt['fld_rock64'][(hsh(x, y, 5) % 4) * 16 + mask4(rock | face, x, y)]
            elif k in ('trail', 'tall', 'forest'):
                g = {'trail': 'fld_trail32', 'tall': 'fld_tall32', 'forest': 'fld_forest32'}[k]
                tile = tt[g][(hsh(x, y, 7) % 2) * 16 + mask4(sets[k], x, y)]
            elif k == 'bog':
                tile = tt['fld_bog94'][WB.index47(mask8(sets['bog'], x, y)) + 47 * ((x + y) % 2)]
            cell[(x, y)] = tile
    for (x, y) in face:
        row = 0 if (x, y - 1) in rock else 1
        we = (1 if (x - 1, y) in face else 0) | (2 if (x + 1, y) in face else 0)
        cell[(x, y)] = tt['fld_face16'][(hsh(x, 0, 13) % 2) * 8 + row * 4 + we]
    im = Image.new('RGBA', (Wd * 16 * sc, Hd * 16 * sc), (0, 0, 0, 255))
    for (x, y), t in cell.items():
        im.alpha_composite(t.img().resize((16 * sc, 16 * sc), Image.NEAREST), (x * 16 * sc, y * 16 * sc))
    im.convert('RGB').save(out)


if __name__ == '__main__' and len(sys.argv) > 1 and sys.argv[1] == 'terrain':
    terrain_demo(sys.argv[2] if len(sys.argv) > 2 else '/tmp/fa/terrain_demo.png')
