"""Woodland context scene for QA: Beodeul B1 broadleaf trees (original kits) on the Beodeul lawn and dark grass,
with the new beodeul_organic props placed between them. Not a game map (the real map render is
scripts/content/beodeul-organic/sample-map.mts); this is the quick side-by-side check.
  python3 scripts/content/beodeul-organic/scene.py <out.png> [scale=2] [ids=all]
"""
import json, random, sys
from pathlib import Path
import numpy as np
from PIL import Image
import refs as R

HERE = Path(__file__).resolve().parent
spec = {it["id"]: it for it in json.loads((HERE / "spec.json").read_text())["items"]}
TREES = ["bd-tree-d43edd", "bd-tree-5844f6", "bd-tree-b1d104", "bd-tree-1a786c", "bd-tree-d61d7e", "bd-tree-bdd36e", "bd-tree-37f48b", "bd-tree-f4f319"]

def paste(c, im, x, y):
    h, w = im.shape[:2]
    if x < 0 or y < 0 or y + h > c.shape[0] or x + w > c.shape[1]: return
    a = im[..., 3:4] / 255.0
    c[y:y + h, x:x + w, :3] = (im[..., :3] * a + c[y:y + h, x:x + w, :3] * (1 - a)).astype(np.uint8)

def build(ids, seed=7, W=40, H=26):
    rnd = random.Random(seed)
    c = R.over(np.zeros((H * 16, W * 16, 4), np.uint8))
    sprites = []
    for row, y0 in ((0, -1), (1, 2), (2, H - 9), (3, H - 6)):
        x = rnd.randint(-2, 1)
        while x < W:
            t = rnd.choice(TREES[:6] if row in (0, 2) else TREES)
            im = R.kit_image(t); sprites.append((y0 * 16 + im.shape[0], x * 16, y0 * 16, im)); x += im.shape[1] // 16 - rnd.randint(0, 1) + 1
    # props in the clearing band and at the forest edges
    slots = []
    for i, iid in enumerate(ids):
        it = spec[iid]
        for _ in range(60):
            gx = rnd.randint(1, W - it["w"] - 1); gy = rnd.randint(5, H - 5 - it["h"])
            box = (gx - 1, gy - 1, gx + it["w"] + 1, gy + it["h"] + 1)
            if all(box[2] <= s[0] or box[0] >= s[2] or box[3] <= s[1] or box[1] >= s[3] for s in slots):
                slots.append(box); im = np.array(Image.open(HERE / "out" / f"{iid}.png").convert("RGBA"))
                sprites.append((gy * 16 + im.shape[0] if it["layer"] == 3 else -1, gx * 16, gy * 16, im)); break
    for _, x, y, im in sorted(sprites, key=lambda s: s[0]): paste(c, im, x, y)
    return c

if __name__ == "__main__":
    out = sys.argv[1]; scale = int(sys.argv[2]) if len(sys.argv) > 2 else 2
    ids = sys.argv[3].split(",") if len(sys.argv) > 3 else list(spec)
    c = build(ids)
    Image.fromarray(c).resize((c.shape[1] * scale, c.shape[0] * scale), Image.NEAREST).save(out)
    print(out, c.shape)
