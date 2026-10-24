"""Beodeul reference crops for the organic-objects set (beodeul_organic).

Renders the Beodeul city kits that natural props must match, at 1x and 6x, over the Beodeul lawn (tile 737).
  python3 scripts/content/beodeul-organic/refs.py [out_dir]   (default /tmp/beodeul-organic-refs)
Also exposes kit_image(id) / sheet_tile(n) / LAWN for the bake and preview scripts.
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
T = 16
_sheet = None
_kits = None

def sheet():
    global _sheet
    if _sheet is None:
        _sheet = np.array(Image.open(ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png").convert("RGBA"))
    return _sheet

def kits():
    global _kits
    if _kits is None:
        ts = json.loads((ROOT / "src/assets/beodeulCityTileset.json").read_text())
        _kits = {k["id"]: k for k in ts["structureKits"]}
    return _kits

def sheet_tile(n):
    s = sheet(); c = s.shape[1] // T
    return s[(n // c) * T:(n // c + 1) * T, (n % c) * T:(n % c + 1) * T].copy()

def kit_image(kid):
    k = kits()[kid]
    im = np.zeros((k["height"] * T, k["width"] * T, 4), np.uint8)
    for y, r in enumerate(k["rows"]):
        for key in ("tiles", "lowerOverlayTiles", "upperTiles"):
            for x, n in enumerate(r.get(key) or []):
                if n is None or n < 0: continue
                t = sheet_tile(n); a = t[..., 3:4] > 0
                sl = im[y * T:(y + 1) * T, x * T:(x + 1) * T]; sl[:] = np.where(a, t, sl)
    return im

LAWN = 737

def over(img, bg_tile=LAWN):
    h, w = img.shape[:2]
    g = sheet_tile(bg_tile)
    out = np.zeros((h, w, 4), np.uint8)
    for y in range(0, h, T):
        for x in range(0, w, T):
            t = g[:min(T, h - y), :min(T, w - x)]; out[y:y + t.shape[0], x:x + t.shape[1]] = t
    a = img[..., 3:4] / 255.0
    out[..., :3] = (img[..., :3] * a + out[..., :3] * (1 - a)).astype(np.uint8)
    out[..., 3] = 255
    return out

REF_IDS = [
    # rocks
    "bd-pick-snowfield-rock", "bd-pick-mining-valley-slagrock", "bd-pick-desert-oasis-rock",
    "bd-pick-deep-forest-path-stones-a", "bd-pick-deep-forest-path-cairn",
    # bushes / plants
    "bd-mpart-bush-c", "bd-mpart-bush-e", "bd-tree-f4f319", "bd-tree-e9d9b3",
    "bd-pick-deep-forest-path-fern-a", "bd-pick-deep-forest-path-heath-a", "bd-pick-deep-forest-path-wild-a",
    "bd-pick-deep-forest-path-wild-b",
    # wood
    "bd-pick-deep-forest-path-log-fallen", "bd-pick-swamp-stilt-moss-log", "bd-pick-deep-forest-path-stump",
    "bd-pick-deep-forest-path-chopping-block",
    # mushrooms
    "bd-pick-deep-forest-path-toadstools-a", "bd-pick-deep-forest-path-toadstools-c",
    # B1 woodland trees the props must sit between
    "bd-tree-1a786c", "bd-tree-d43edd",
]

def strip(ids, scale, gap=4):
    ims = [over(kit_image(i)) for i in ids]
    H = max(i.shape[0] for i in ims); W = sum(i.shape[1] + gap for i in ims)
    c = over(np.zeros((H, W, 4), np.uint8))
    x = 0
    for i in ims:
        c[H - i.shape[0]:, x:x + i.shape[1]] = i; x += i.shape[1] + gap
    return Image.fromarray(c).resize((W * scale, H * scale), Image.NEAREST)

if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/beodeul-organic-refs"); out.mkdir(parents=True, exist_ok=True)
    groups = {"rocks": REF_IDS[0:5], "plants": REF_IDS[5:13], "wood": REF_IDS[13:17], "shrooms": REF_IDS[17:19], "trees": REF_IDS[19:21]}
    for g, ids in groups.items():
        strip(ids, 6).save(out / f"{g}-6x.png")
    strip(REF_IDS, 1).save(out / "all-1x.png")
    strip(REF_IDS, 2).save(out / "all-2x.png")
    for kid in REF_IDS:
        Image.fromarray(kit_image(kid)).save(out / f"{kid}.png")
    print(out)
