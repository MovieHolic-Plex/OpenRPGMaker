"""Row-string pixel helper for beodeul_organic art modules (art/<family>.py).

Each art module defines ART = {item_id: (rows, keys)}:
  rows: list of strings, exactly h*16 rows of w*16 chars ('.' = transparent)
  keys: {char: "#rrggbb" from palette.json | "s" (ground shadow, alpha 42) | "S" (ground shadow, alpha 90)}
  python3 scripts/content/beodeul-organic/draw.py [module ...]   -> writes out/<id>.png, then run check.py
"""
import importlib, json, sys
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
pal = json.loads((HERE / "palette.json").read_text())
SH = tuple(pal["shadow"]["rgb"]); A1, A2 = pal["shadow"]["alphas"]

def render(rows, keys):
    h = len(rows); w = max(len(r) for r in rows)
    im = np.zeros((h, w, 4), np.uint8)
    for y, r in enumerate(rows):
        if len(r) != w: raise ValueError(f"row {y} is {len(r)} wide, expected {w}")
        for x, ch in enumerate(r):
            if ch in ". ": continue
            v = keys[ch]
            if v == "s": im[y, x] = (*SH, A1)
            elif v == "S": im[y, x] = (*SH, A2)
            else: im[y, x] = (int(v[1:3], 16), int(v[3:5], 16), int(v[5:7], 16), 255)
    return im

def run(mods):
    out = HERE / "out"; out.mkdir(exist_ok=True)
    for m in mods:
        mod = importlib.import_module(f"art.{m}")
        for iid, (rows, keys) in mod.ART.items():
            Image.fromarray(render(rows, keys)).save(out / f"{iid}.png")
            print("wrote", iid)

if __name__ == "__main__":
    mods = sys.argv[1:] or sorted(p.stem for p in (HERE / "art").glob("*.py") if not p.stem.startswith("_"))
    run(mods)
