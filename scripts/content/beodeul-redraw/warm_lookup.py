#!/usr/bin/env python3
"""Rewrite the warm (따뜻한 황록) lookup for the current oak leaf ramp.

The user approved the warm look (tree-palette-studies 'warm'). tree-palette-studies/warm-redrawn-lookup.json maps exact
leaf colours of the tree bodies to their warm colours. The oak entries are keyed by the oak ramp in palette.json, so a
ramp change must rewrite them. The approved look is its hue: each oak step takes the CIELAB hue the approved warm colour of
that step had, keeps the lightness offset from the oak step, and scales its chroma by the approved warm/oak chroma ratio
(measured on 2026-10-22 from the approved lookup). So darker ramps stay warm (olive) instead of drifting back to green. Non-oak entries (grass blades at the roots,
tree neck) are kept. Run before beodeul-tree-palette-studies.mjs.
  python3 scripts/content/beodeul-redraw/warm_lookup.py
"""
import json
from pathlib import Path
R = Path(__file__).resolve().parents[3]
PAL = json.loads((R / 'scripts/content/beodeul-redraw/palette.json').read_text())
LK = R / 'tiledata/beodeul-ground/tree-palette-studies/warm-redrawn-lookup.json'
# oak step -> (hue shift in turns, saturation x, value x), from the approved lookup on the 2026-10-22 oak ramp
# [(22,58,44)->(36,52,32), (36,88,50)->(55,82,32), (62,122,52)->(73,116,40), (110,160,58)->(116,154,44), (176,204,88)->(163,198,74)]
OLD = {1: ((22, 58, 44), (36, 52, 32)), 2: ((36, 88, 50), (55, 82, 32)), 3: ((62, 122, 52), (73, 116, 40)),
       4: ((110, 160, 58), (116, 154, 44)), 5: ((176, 204, 88), (163, 198, 74))}
from skimage.color import rgb2lab, lab2rgb
import numpy as np
def lch(c):
    L, A, B = rgb2lab(np.array([[c]], float) / 255)[0, 0]; return L, float(np.hypot(A, B)), float(np.arctan2(B, A))
def shift(c, step):
    (Lo, Co, _), (Lw, Cw, hw), (L, C, _) = lch(OLD[step][0]), lch(OLD[step][1]), lch(c)
    L2, C2 = L + (Lw - Lo), C * Cw / Co
    rgb = lab2rgb(np.array([[[L2, C2 * np.cos(hw), C2 * np.sin(hw)]]]))[0, 0]
    return [int(round(v * 255)) for v in np.clip(rgb, 0, 1)]
oak = [tuple(c) for c in PAL['leaf_ramps']['oak']]
old_keys = {tuple(a) for a, _ in OLD.values()}
prev = json.loads(LK.read_text()) if LK.exists() else []
keep = [e for e in prev if tuple(e['from'][:3]) not in old_keys and tuple(e['from'][:3]) not in oak]
new = [{'from': list(oak[s]) + [255], 'to': shift(oak[s], s) + [255]} for s in OLD]
LK.write_text(json.dumps(sorted(keep + new, key=lambda e: sum(e['from'][:3]))))
print(json.dumps(new))
