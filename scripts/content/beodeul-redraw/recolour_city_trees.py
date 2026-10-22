#!/usr/bin/env python3
"""Recolour the placed redrawn trees in the beodeul_city sheet to the current oak leaf ramp, in place.

The redrawn trees were set into the city sheet at the cells in placements/city.json, as drawn (orig) or with one of two
tints (tint2 fresher, tint3 olive). restyle-beodeul-foliage.py relights the kits it knows; the other placed cells keep
the drawn colours, so a change of the oak ramp in palette.json has to reach them here. Each tint is a fixed per-step
Lab offset from the oak ramp (measured from the 2026-10-22 placement), so a recoloured tint2/tint3 tree keeps its
look relative to the plain one. Cells that restyle-beodeul-foliage.py owns are skipped (it relights them from
its own originals). Only pixels of the six-step palettes inside the placed cells change; shapes, cell
numbers, bark and anything else in the cell stay.
State: art/city_tree_palettes.json holds the palettes the sheet carries now; it is rewritten after a recolour so the
script can run again after the next ramp change.
  python3 scripts/content/beodeul-redraw/recolour_city_trees.py      (after restyle-beodeul-foliage.py)
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image
from skimage.color import rgb2lab, lab2rgb

HERE = Path(__file__).resolve().parent
R = HERE.parents[2]
SHEET = R / 'public/assets/beodeul-city/beodeul-city-chipset.png'
STATE = HERE / 'art/city_tree_palettes.json'
T, COLS = 16, 128
# per-step Lab offsets of the tints from the oak ramp, measured on the 2026-10-22 placement
# (oak [12,34,34]..[176,204,88] -> tint2 [13,34,36]..[175,218,94], tint3 [11,31,29]..[175,188,81])
FIRST = {'orig': [(12, 34, 34), (22, 58, 44), (36, 88, 50), (62, 122, 52), (110, 160, 58), (176, 204, 88)],
         'tint2': [(13, 34, 36), (24, 62, 51), (39, 94, 60), (58, 131, 56), (106, 171, 62), (175, 218, 94)],
         'tint3': [(11, 31, 29), (20, 53, 37), (33, 81, 40), (65, 112, 48), (112, 147, 53), (175, 188, 81)]}
lab = lambda cs: rgb2lab(np.array(cs, float)[None] / 255)[0]
rgb = lambda ls: [[int(round(v * 255)) for v in np.clip(c, 0, 1)] for c in lab2rgb(np.array(ls)[None])[0]]

def palettes(oak):
    base = lab(oak)
    out = {'orig': [list(c) for c in oak]}
    for t in ('tint2', 'tint3'):
        out[t] = rgb(base + (lab(FIRST[t]) - lab(FIRST['orig'])))
    return out

def main():
    oak = json.loads((HERE / 'palette.json').read_text())['leaf_ramps']['oak']
    cur = json.loads(STATE.read_text()) if STATE.exists() else FIRST
    new = palettes(oak)
    lut = {}
    for t in ('orig', 'tint2', 'tint3'):
        for a, b in zip(cur[t], new[t]):
            a, b = tuple(a), tuple(b)
            if a in lut and lut[a] != b: raise SystemExit(f'ambiguous colour {a}')
            lut[a] = b
    S = np.array(Image.open(SHEET).convert('RGBA'))
    # cells that restyle-beodeul-foliage.py relights are rebuilt by it from its originals (fingerprinted) — leave them
    owned = set(json.loads((R / 'scripts/content/beodeul-foliage/source-tiles.json').read_text())['tiles'])
    cells = sorted({e['cell'] for e in json.loads((HERE / 'placements/city.json').read_text())['trees']} - owned)
    key = lambda px: (px[..., 0].astype(np.int64) << 16) | (px[..., 1].astype(np.int64) << 8) | px[..., 2]
    src = np.array([(a[0] << 16) | (a[1] << 8) | a[2] for a in lut]); dst = np.array(list(lut.values()), np.uint8)
    changed = 0
    for n in cells:
        c = S[(n // COLS) * T:(n // COLS + 1) * T, (n % COLS) * T:(n % COLS + 1) * T]
        k = key(c); hit = np.isin(k, src) & (c[..., 3] > 0)
        if not hit.any(): continue
        idx = np.searchsorted(np.sort(src), k[hit]); order = np.argsort(src)
        c[hit, :3] = dst[order][idx]; changed += int(hit.sum())
    Image.fromarray(S, 'RGBA').save(SHEET, optimize=True)
    STATE.write_text(json.dumps(new) + '\n')
    print(json.dumps(dict(cells=len(cells), pixels=changed, palettes=new)))

if __name__ == '__main__':
    main()
