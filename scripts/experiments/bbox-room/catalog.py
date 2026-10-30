#!/usr/bin/env python3
"""bbox-room-test: compact English tileset catalog for the layout model.
  python3 catalog.py <boss|inn> <refs dir> <out.txt>   (run from the repo root)
Pieces = the same chipset-bound list the img-room test used (<task>-pieces.txt, atlas_biome_interior v5)."""
import json, sys
task, refs, out = sys.argv[1:4]
S = json.load(open("src/assets/handInteriorSpec.json"))
ids = [l for l in open(f"{refs}/{task}-pieces.txt").read().split("\n") if l]
LANDMARK = {"fireplace", "throne", "demon throne", "indoor fountain", "magic circle", "dark altar", "altar", "statue", "demon statue",
            "long hearth 3", "long hearth 4", "long hearth 5", "long hearth 6", "crown pedestal", "dark orb pedestal", "war map table", "piano"}
RULE = {"floor": "floor (stands on floor, blocks walking)", "wall": "against-wall (first floor row right under a north wall face)",
        "hang": "wall-mounted (on the UPPER wall-face row, i.e. the region's top row y)", "flat": "floor decal (walkable, may lie under furniture)"}
rows = []
for i in ids:
    if i.startswith("floor:"): rows.append((i, i[6:] + " floor", "-", "floor", "region floor id (use the part after 'floor:')")); continue
    if i.startswith("wall:"): rows.append((i, i[5:] + " wall", "-", "wall", "region wall id (use the part after 'wall:')")); continue
    d = S["objects"][i]
    cat = "stairs" if d.get("stairs") else "landmark" if i in LANDMARK else "decor" if d["kind"] in ("hang", "flat") or d["category"] == "decor" else "furniture"
    rule = RULE[d["kind"]]
    if d.get("stairs") == "up": rule = "stairs up: against-wall at the north wall (first floor row), climbs into the wall"
    tall = f" (art {d['up']//16} row(s) taller, drawn upward)" if d.get("up") else ""
    fp = f"{d['w']}x1 on the wall face" if d["h"] == 0 else f"{d['w']}x{d['h']}{tall}"
    rows.append((i, i, fp, cat, rule))
L = [f"# Tileset catalog — {task} (chipset atlas_biome_interior v5, 16px cells). The attached sheet shows every piece, labelled with its exact id, on a 16px grid.",
     "id | footprint w x h cells | category | placement rule"]
for i, _, fp, cat, rule in rows: L.append(f"{i} | {fp} | {cat} | {rule}")
L.append("")
L.append("# Sized pieces (choose any size; put them in 'objects' with the size in the id, or in 'carpets'/'daises')")
if task == "inn":
    L += ["dining WxH | W x H | furniture | floor table, any size (e.g. 'dining 3x2'); chairs go beside it",
          "counter Wx1 | W x 1 | furniture | floor shop/reception counter, one row only (e.g. 'counter 4x1')",
          "kcounter Wx1 | W x 1 | furniture | floor kitchen worktop, one row only"]
    rugs = ["rug red", "rug green", "rug blue", "rug brown"]
else:
    L += ["dais stone / dais marble | any W x H | landmark | walkable raised platform (put in 'daises'); a throne can stand on it"]
    rugs = ["rug royal", "rug red", "rug purple"]
L.append(" / ".join(rugs) + " | any W x H rect | decor | walkable carpet in 'carpets' (e.g. a 2-wide runner from the entrance to the throne)")
open(out, "w").write("\n".join(L) + "\n")
print(len(rows), "pieces ->", out)
