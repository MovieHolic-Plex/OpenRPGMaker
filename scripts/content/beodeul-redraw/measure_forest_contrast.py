#!/usr/bin/env python3
"""Measure how well the Beodeul forest canopy, tree kits and woodland groups separate from the grass (CIELAB).

  python3 scripts/content/beodeul-redraw/measure_forest_contrast.py [--root DIR] [--json]

--root points at another checkout or a folder holding the same relative paths (used to compare before/after a recolour).
Reports per group: mean L*, hue angle, chroma of the opaque pixels, the share of pixels whose L* is within 8 of the grass,
city_placed_trees = green pixels of every cell the redraw placed (placements/city.json).
And mean-to-mean dL* and dE76 against the grass cell 737 (beodeul_city bright lawn).
"""
import json, sys, re
from pathlib import Path
import numpy as np
from PIL import Image
from skimage.color import rgb2lab

R = Path(__file__).resolve().parents[3]
root = Path(sys.argv[sys.argv.index('--root') + 1]) if '--root' in sys.argv else R
T = 16

def load(rel): return np.array(Image.open(root / rel).convert('RGBA'))
def cell(sheet, n, per): return sheet[(n // per) * T:(n // per + 1) * T, (n % per) * T:(n % per + 1) * T]

def stats(px):
    lab = rgb2lab(px[None, :, :3].astype(np.float64) / 255)[0]
    L, a, b = lab[:, 0], lab[:, 1], lab[:, 2]
    return lab, dict(n=int(len(L)), L=round(float(L.mean()), 1), hue=round(float(np.degrees(np.arctan2(b.mean(), a.mean()))), 1),
                     chroma=round(float(np.hypot(a.mean(), b.mean())), 1), Lp10=round(float(np.percentile(L, 10)), 1), Lp90=round(float(np.percentile(L, 90)), 1))

city = load('public/assets/beodeul-city/beodeul-city-chipset.png')
g = cell(city, 737, 128).reshape(-1, 4)
glab, gs = stats(g)
gmean = glab.mean(0)

def group(px):
    px = px.reshape(-1, 4); px = px[px[:, 3] > 0]
    lab, s = stats(px)
    m = lab.mean(0)
    s['dL'] = round(float(m[0] - gmean[0]), 1)
    s['dE76'] = round(float(np.linalg.norm(m - gmean)), 1)
    s['nearGrassL'] = round(float((np.abs(lab[:, 0] - gmean[0]) < 8).mean()), 3)   # share of pixels with |L* - grass| < 8
    s['nearGrassE'] = round(float((np.linalg.norm(lab - gmean, axis=1) < 12).mean()), 3)  # share within dE 12 of the grass
    return s

out = {'grass737': gs}
nat_cat = json.loads((R / 'src/assets/beodeulNatureCatalog.json').read_text())
nat = load('public/assets/beodeul-nature/chipset.png')
cells = sorted({n for ph in nat_cat['forestCanopy']['leaf'] for n in ph if n >= 0})
out['canopy_leaf'] = group(np.concatenate([cell(nat, n, 16).reshape(-1, 4) for n in cells]))
tsj = json.loads((R / 'src/assets/beodeulCityTileset.json').read_text())
kits = [k for k in tsj['structureKits'] if re.match(r'^bd-(tree-|mpart-bush-[ce]$)', k['id'])]
broad = {'03a8f7','d43edd','5844f6','3e8732','f4f319','e9d9b3','37f48b','1a786c','47e17a','d105b2','0f7ed1','d61d7e','a80c85','7ecdb8','cc0fcb','132848','1e09f0','bdd36e','b1d104'}
kp = []
for k in kits:
    if k['id'].startswith('bd-tree-') and k['id'][8:] not in broad: continue
    for r in k['rows']:
        for layer in (r.get('tiles') or [], r.get('upperTiles') or []):
            for n in layer:
                if n is not None and n >= 0: kp.append(cell(city, n, 128).reshape(-1, 4))
out['city_tree_kits'] = group(np.concatenate(kp))
pl = json.loads((R / 'scripts/content/beodeul-redraw/placements/city.json').read_text())['trees']
own = set(json.loads((R / 'scripts/content/beodeul-foliage/source-tiles.json').read_text())['tiles'])
def leafy(px):
    px = px.reshape(-1, 4); px = px[px[:, 3] > 0]; c = px[:, :3].astype(int)
    return px[(c[:, 1] > c[:, 0]) & (c[:, 1] >= c[:, 2])]          # green-dominant pixels (leaves), not bark/stone
out['city_placed_trees'] = group(np.concatenate([leafy(cell(city, e['cell'], 128)) for e in pl]))
out['woodland_groups'] = group(np.concatenate([load(f'public/assets/beodeul-ground/woodland-{k}.png').reshape(-1, 4) for k in ('north', 'north-open', 'west', 'east')]))
out['warm_groves'] = group(np.concatenate([load(f'public/assets/beodeul-warm-trees/grove-{k}.png').reshape(-1, 4) for k in ('north', 'north-open', 'west', 'east')]))
if '--json' in sys.argv: print(json.dumps(out))
else:
    for k, v in out.items(): print(f'{k:16s}', v)
