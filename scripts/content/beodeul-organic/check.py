"""Mechanical checks for beodeul_organic drawings (necessary, not sufficient — visual QA decides).
  python3 scripts/content/beodeul-organic/check.py [out_dir]   (default scripts/content/beodeul-organic/out)
Per item: PNG exists, size = w*16 x h*16, opaque colours all in palette.json, translucent pixels only the
ground-shadow colour at alpha 42/90, art not empty, nothing touching the top edge row (no clipped crown),
and blocking cells (layer 3) actually contain art.
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
spec = json.loads((HERE / "spec.json").read_text())["items"]
pal = json.loads((HERE / "palette.json").read_text())
ALLOWED = {tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for g in pal["groups"].values() for h in g}
SH = tuple(pal["shadow"]["rgb"]); SHA = set(pal["shadow"]["alphas"])

def check(it, out):
    p = out / f"{it['id']}.png"
    if not p.exists(): return ["missing"]
    im = np.array(Image.open(p).convert("RGBA"))
    errs = []
    if im.shape[:2] != (it["h"] * 16, it["w"] * 16): errs.append(f"size {im.shape[1]}x{im.shape[0]} != {it['w']*16}x{it['h']*16}")
    a = im[..., 3]
    op = im[a == 255][:, :3]
    bad = {tuple(c) for c in op.tolist()} - ALLOWED
    if bad: errs.append(f"{len(bad)} off-palette colours e.g. " + ",".join("#%02x%02x%02x" % c for c in list(bad)[:4]))
    tr = im[(a > 0) & (a < 255)]
    badt = [t for t in tr.tolist() if tuple(t[:3]) != SH or t[3] not in SHA]
    if badt: errs.append(f"{len(badt)} translucent px not ground shadow")
    if (a == 255).sum() < 12: errs.append("almost empty")
    if (a[0] > 0).any() and it["h"] >= 1: errs.append("art touches the top edge (clipped?)")
    for dx, dy in it.get("block", []):
        if (a[dy * 16:(dy + 1) * 16, dx * 16:(dx + 1) * 16] == 255).sum() < 20: errs.append(f"block cell {dx},{dy} has little art")
    return errs

if __name__ == "__main__":
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "out"
    only = set(sys.argv[2].split(",")) if len(sys.argv) > 2 else None
    bad = 0
    for it in spec:
        if only and it["id"] not in only and it["family"] not in only: continue
        e = check(it, out)
        if e: bad += 1
        print(("FAIL " if e else "ok   ") + it["id"] + ("  " + "; ".join(e) if e else ""))
    sys.exit(1 if bad else 0)
