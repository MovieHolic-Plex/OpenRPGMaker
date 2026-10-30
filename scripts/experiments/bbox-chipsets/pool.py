#!/usr/bin/env python3
"""bbox-chipsets round 2: merge the object pool (objpool/<chipset>/<id>.png + <id>.json, made by another agent's object-gen run)
into an experiment-local base project, so the catalog, the validator and the renderer see the new pieces like any chipset piece.
  python3 pool.py <round-1 base dir> <objpool dir> <out base dir>     → <out>/before.json (+ assets symlink), <out>/pool/{<ts>.png, spec.json}
How: each pool picture is cut into 16px tiles, packed on one pool sheet per chipset (uploaded asset, data URL) and grafted onto the
chipset after its last row (tileGrafts — the editor's own mechanism for adding tiles to a bundled sheet). Footprint rows are blocked,
art above the footprint is walk-behind (star). spec.json gives the HandInteriorSpec objects (merged by spec.mts via $BBOX_POOL_DIR).
Experiment-local only: nothing here is bundled or published (the pool pictures have not passed object-gate)."""
import base64, io, json, os, sys
from PIL import Image
src, pool, out = sys.argv[1:4]
os.makedirs(f"{out}/pool", exist_ok=True)
if not os.path.exists(f"{out}/assets"): os.symlink(os.path.abspath(f"{src}/assets"), f"{out}/assets")
P = json.load(open(f"{src}/before.json"))
T, SPR = 16, 16
KIND = {"floor": "floor", "wall": "wall", "hang": "hang", "tabletop": "floor", "flat": "flat"}
OPEN = {"up": True, "down": True, "left": True, "right": True}; SHUT = {"up": False, "down": False, "left": False, "right": False}
spec, summary = {}, {}
for ts in sorted(os.listdir(pool)):
    d = f"{pool}/{ts}"
    if ts.startswith("_") or not os.path.isdir(d) or ts not in P["tilesets"]: continue
    items = [json.load(open(f"{d}/{f}")) for f in sorted(os.listdir(d)) if f.endswith(".json") and os.path.exists(f"{d}/{f[:-5]}.png")]
    if not items: continue
    t = P["tilesets"][ts]; tpr = t["tilesPerRow"]; count0 = t["count"]
    first = -(-count0 // tpr) * tpr                      # row-aligned: grafted tiles start on a fresh row
    tiles, objs = [], {}
    for it in items:
        im = Image.open(f"{d}/{it['id']}.png").convert("RGBA")
        cols, rows = -(-im.width // T), -(-im.height // T)
        fw, fh = (int(v) for v in it["footprint"].split("x"))
        anchor = it.get("anchor", "floor"); kind = KIND.get(anchor, "floor")
        foot = 0 if anchor in ("hang", "tabletop", "flat") else min(fh, rows)
        top = 0 if kind in ("hang", "flat") else (rows - foot if foot else rows - 1)
        cells = []
        for r in range(rows):
            for c in range(cols):
                tile = im.crop((c * T, r * T, c * T + T, r * T + T))
                if tile.getbbox() is None: continue
                n = first + len(tiles); blocked = foot and r >= rows - foot
                tiles.append((tile, blocked, kind == "flat"))
                cells.append([c, r - top, n, 2 if kind == "flat" else 3])
        oid = it["id"] if it["id"] not in objs else it["id"] + "-2"
        objs[oid] = {"ko": it.get("name_en", oid), "category": it.get("category", "misc"), "category_ko": it.get("category", "misc").replace("_", " "),
                     "kind": kind, "w": fw if kind != "flat" else cols, "h": 0 if kind in ("hang",) or anchor == "tabletop" else (rows if kind == "flat" else foot),
                     "up": max(0, rows - foot) * T if foot else 0, "cells": cells, "desc": it.get("brief", "")[:200], "tags": [it.get("category", ""), "new"],
                     "place": it.get("placement", ""), "pair": [], "use": [], "pool": True}
    # pool sheet + grafts + per-tile passability/priority/meta
    sheet = Image.new("RGBA", (SPR * T, -(-len(tiles) // SPR) * T), (0, 0, 0, 0))
    for k, (tile, _, _) in enumerate(tiles): sheet.alpha_composite(tile, ((k % SPR) * T, (k // SPR) * T))
    sheet.save(f"{out}/pool/{ts}.png")
    buf = io.BytesIO(); sheet.save(buf, "PNG")
    aid = f"bbox_pool_{ts}"
    P["assets"]["uploaded"][aid] = {"id": aid, "name": f"bbox pool {ts}", "kind": "tileset", "dataUrl": "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()}
    t.setdefault("tileGrafts", [])
    t["tileGrafts"] = list(t["tileGrafts"]) + [{"targetTile": first + k, "sourceChipset": aid, "sourceTile": k, "sourceTileSize": T, "sourceTilesPerRow": SPR} for k in range(len(tiles))]
    newCount = -(-(first + len(tiles)) // tpr) * tpr
    for k in range(count0, newCount):
        j = k - first; real = 0 <= j < len(tiles)
        blocked = real and tiles[j][1]; flat = real and tiles[j][2]
        t["passability"].append(dict(SHUT if blocked else OPEN))
        t["priority"].append("lower" if (flat or not real) else "upper")
        t["terrain"].append(0)
        t["tileMeta"].append({"label": f"bbox pool {ts} {j}" if real else "", "role": "prop", "passage": "solid" if blocked else ("o" if flat or not real else "star"),
                              "defaultLayer": "lower" if flat or not real else "upper", "tags": ["bbox-pool"], "source": "bbox-pool"})
    t["count"] = newCount
    spec[ts] = {"first": first, "sheet": f"{out}/pool/{ts}.png", "objects": objs}
    summary[ts] = {"items": len(objs), "tiles": len(tiles), "first": first, "count": f"{count0}->{newCount}"}
json.dump(P, open(f"{out}/before.json", "w"))
json.dump(spec, open(f"{out}/pool/spec.json", "w"), indent=1)
print(json.dumps(summary))
