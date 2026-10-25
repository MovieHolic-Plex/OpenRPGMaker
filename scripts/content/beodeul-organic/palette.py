"""Locked palette for beodeul_organic: every opaque colour already used by the Beodeul reference kits
(refs.REF_IDS) plus the Beodeul ground flower overlays. Translucent pixels may only use the Beodeul
ground-shadow colour (14,30,8) at alpha 42 or 90.
  python3 scripts/content/beodeul-organic/palette.py   -> writes palette.json (grouped, dark->light)
"""
import json, colorsys
from collections import Counter
from pathlib import Path
import numpy as np
from PIL import Image
import refs

HERE = Path(__file__).resolve().parent
SHADOW_RGB = (14, 30, 8)
SHADOW_ALPHAS = (42, 90)

def collect():
    cnt = Counter()
    for kid in refs.REF_IDS:
        im = refs.kit_image(kid)
        cnt.update(map(tuple, im[im[..., 3] == 255][:, :3].tolist()))
    for f in ("flowers-blue", "flowers-pink", "flowers-white", "stones", "roots"):
        im = np.array(Image.open(refs.ROOT / f"public/assets/beodeul-ground/{f}.png").convert("RGBA"))
        cnt.update(map(tuple, im[im[..., 3] == 255][:, :3].tolist()))
    return cnt

def family(c):
    r, g, b = [v / 255 for v in c]
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    if s < 0.12 or max(c) - min(c) < 18: return "grey"
    h *= 360
    if 70 <= h < 170: return "green"
    if 170 <= h < 260: return "blue"
    if 260 <= h < 330: return "violet"
    if h < 20 or h >= 330: return "red"
    if l > 0.55 and s > 0.4: return "yellow"
    return "brown"

def lum(c): return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]

if __name__ == "__main__":
    cnt = collect()
    groups = {}
    for c in cnt:
        groups.setdefault(family(c), []).append(c)
    out = {"note": __doc__.strip().splitlines()[0], "shadow": {"rgb": SHADOW_RGB, "alphas": SHADOW_ALPHAS},
           "groups": {k: ["#%02x%02x%02x" % c for c in sorted(v, key=lum)] for k, v in sorted(groups.items())}}
    (HERE / "palette.json").write_text(json.dumps(out, indent=1))
    print({k: len(v) for k, v in out["groups"].items()}, sum(len(v) for v in out["groups"].values()))
