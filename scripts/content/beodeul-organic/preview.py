"""Side-by-side preview: new beodeul_organic drawings next to Beodeul reference kits, same zoom, on the Beodeul lawn.
  python3 scripts/content/beodeul-organic/preview.py <family|id,...> <out.png> [scale=6] [refs=id,id]
Default refs per family come from FAMILY_REFS. Also draws a 1x row under the zoomed row.
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
import refs as R

HERE = Path(__file__).resolve().parent
spec = json.loads((HERE / "spec.json").read_text())["items"]
FAMILY_REFS = {
    "rock": ["bd-pick-snowfield-rock", "bd-pick-mining-valley-slagrock", "bd-pick-deep-forest-path-stones-a", "bd-pick-deep-forest-path-cairn"],
    "mossy": ["bd-pick-mining-valley-slagrock", "bd-pick-deep-forest-path-cairn", "bd-mpart-bush-c"],
    "bush": ["bd-mpart-bush-c", "bd-mpart-bush-e", "bd-tree-f4f319", "bd-pick-deep-forest-path-heath-a"],
    "fern": ["bd-pick-deep-forest-path-fern-a", "bd-pick-deep-forest-path-wild-a", "bd-mpart-bush-c"],
    "wood": ["bd-pick-deep-forest-path-log-fallen", "bd-pick-swamp-stilt-moss-log", "bd-pick-deep-forest-path-stump"],
    "mushroom": ["bd-pick-deep-forest-path-toadstools-a", "bd-pick-deep-forest-path-toadstools-c", "bd-pick-deep-forest-path-stump"],
    "grass": ["bd-pick-deep-forest-path-wild-a", "bd-pick-deep-forest-path-fern-b", "bd-pick-deep-forest-path-heath-b"],
    "flower": ["bd-pick-deep-forest-path-wild-b", "bd-pick-deep-forest-path-wild-c", "bd-mpart-flower-patch"],
    "landmark": ["bd-tree-1a786c", "bd-pick-deep-forest-path-cairn", "bd-pick-deep-forest-path-stump"],
}

def load(it, out):
    p = out / f"{it['id']}.png"
    return np.array(Image.open(p).convert("RGBA")) if p.exists() else np.zeros((it["h"] * 16, it["w"] * 16, 4), np.uint8)

def row(ims, gap=4):
    ims = [R.over(i) for i in ims]
    H = max(i.shape[0] for i in ims); W = sum(i.shape[1] + gap for i in ims)
    c = R.over(np.zeros((H, W, 4), np.uint8))
    x = 0
    for i in ims:
        c[H - i.shape[0]:, x:x + i.shape[1]] = i; x += i.shape[1] + gap
    return c

def build(sel, scale=6, ref_ids=None, out=HERE / "out"):
    items = [it for it in spec if it["family"] in sel or it["id"] in sel]
    if ref_ids is None:
        ref_ids = []
        for f in dict.fromkeys(it["family"] for it in items): ref_ids += [r for r in FAMILY_REFS.get(f, []) if r not in ref_ids]
    ims = [R.kit_image(r) for r in ref_ids] + [np.zeros((16, 6, 4), np.uint8)] + [load(it, out) for it in items]
    big = row(ims)
    small = row(ims)
    z = Image.fromarray(big).resize((big.shape[1] * scale, big.shape[0] * scale), Image.NEAREST)
    canvas = Image.new("RGBA", (z.width, z.height + small.shape[0] + 8), (40, 40, 40, 255))
    canvas.paste(z, (0, 0)); canvas.paste(Image.fromarray(small), (0, z.height + 4))
    return canvas, ref_ids, [it["id"] for it in items]

if __name__ == "__main__":
    sel = set(sys.argv[1].split(","))
    scale = int(sys.argv[3]) if len(sys.argv) > 3 else 6
    rids = sys.argv[4].split(",") if len(sys.argv) > 4 else None
    img, r, n = build(sel, scale, rids)
    img.save(sys.argv[2]); print("refs:", r, "| new:", n)
