"""Edge-defect probe the blind judges keep naming: comb-like 1px legs/notches/spikes on the silhouette, lone pixels, long flat runs.
  python3 qa/edges.py [id,...]
For each piece (opaque art = alpha>200; the soft shadow is ignored):
  spikes  = 1px-wide columns whose bottom sticks down past both neighbours, or 1px notches up (bottom edge); same for left/right edges by row
  lone    = pixels whose 4 neighbours all differ in colour (salt-and-pepper)
  flat    = longest run of equal bottom row across columns (ruler-straight bottom)
Not an acceptance test (only the blind judges decide); it points the artist at likely causes.
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
HERE = Path(__file__).resolve().parents[1]
ids = sys.argv[1].split(",") if len(sys.argv) > 1 else [i["id"] for i in json.loads((HERE / "spec.json").read_text())["items"]]
def prof(op, axis_rev):
    # bottom profile per column (axis_rev False) using op as [rows, cols]
    return [int(np.where(op[:, x])[0].max()) if op[:, x].any() else -1 for x in range(op.shape[1])]
def spikes(p):
    out = []
    for i in range(1, len(p) - 1):
        a, b, c = p[i - 1], p[i], p[i + 1]
        if min(a, b, c) < 0: continue
        if b > a and b > c: out.append(f"leg@{i}")
        if b < a and b < c: out.append(f"notch@{i}")
    return out
for i in ids:
    a = np.array(Image.open(HERE / "out" / f"{i}.png").convert("RGBA"))
    op = a[..., 3] > 200
    bot = prof(op, False)
    left = [int(np.where(op[y])[0].min()) if op[y].any() else -1 for y in range(op.shape[0])]
    right = [int(np.where(op[y])[0].max()) if op[y].any() else -1 for y in range(op.shape[0])]
    sb = spikes(bot); sl = spikes([-v if v >= 0 else -1 for v in left]); sr = spikes(right)
    rgb = a[..., :3].astype(int); lone = 0
    H, W = op.shape
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            if not op[y, x]: continue
            c = rgb[y, x]
            if all(not op[y + dy, x + dx] or (rgb[y + dy, x + dx] != c).any() for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) and \
               sum(op[y + dy, x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) == 4: lone += 1
    run = best = 1
    for k in range(1, W):
        run = run + 1 if bot[k] == bot[k - 1] >= 0 else 1; best = max(best, run)
    print(f"{i:18} bottom-spikes {len(sb):2} {' '.join(sb)[:60]:60} side-spikes {len(sl) + len(sr):2} lone {lone:3} flat {best}")
