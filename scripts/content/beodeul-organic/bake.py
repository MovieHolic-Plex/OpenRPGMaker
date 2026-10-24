"""Bake beodeul_organic: out/<id>.png -> one 16-column sheet + catalog the editor/assistant read.

  python3 scripts/content/beodeul-organic/bake.py           # bundle bake: every item must pass the object-gate exit (context bundle)
  python3 scripts/content/beodeul-organic/bake.py --draft   # local preview only, writes to /tmp/beodeul-organic-draft (never the bundle)

Outputs (bundle bake): public/assets/beodeul-organic/chipset.png, src/assets/beodeulOrganicCatalog.json.
Cells of an item that are fully transparent are -1 (not baked). Identical cells are shared.
Catalog per item: id, name, en, family, kind, width, height, layer (3 stands / 2 walk-over), rows (cell ids), block ([dx,dy]),
sha256 (object-gate pixel hash the exit checked).
"""
import hashlib, json, sys
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "src/harnesses/_core"))
spec = json.loads((HERE / "spec.json").read_text())["items"]
COLS = 16

def main(draft):
    from object_gate import require_all, pixel_sha256
    imgs = {it["id"]: Image.open(HERE / "out" / f"{it['id']}.png").convert("RGBA") for it in spec}
    if draft:
        hashes = {it["id"]: pixel_sha256(imgs[it["id"]]) for it in spec}
    else:
        got = require_all([(imgs[it["id"]], it["kind"], f"beodeul_organic/{it['id']}") for it in spec], context="bundle")
        hashes = {it["id"]: h for it, h in zip(spec, got)}
    cells, index, items = [], {}, []
    for it in spec:
        a = np.array(imgs[it["id"]])
        rows = []
        for cy in range(it["h"]):
            row = []
            for cx in range(it["w"]):
                c = a[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16]
                if not (c[..., 3] > 0).any(): row.append(-1); continue
                key = hashlib.sha256(c.tobytes()).hexdigest()
                if key not in index: index[key] = len(cells); cells.append(c)
                row.append(index[key])
            rows.append(row)
        items.append({k: it[k] for k in ("id", "name", "en", "family", "kind", "layer")} | {"width": it["w"], "height": it["h"], "rows": rows, "block": it.get("block", []), "sha256": hashes[it["id"]]})
    n = len(cells); H = (n + COLS - 1) // COLS
    sheet = np.zeros((H * 16, COLS * 16, 4), np.uint8)
    for i, c in enumerate(cells): sheet[(i // COLS) * 16:(i // COLS + 1) * 16, (i % COLS) * 16:(i % COLS + 1) * 16] = c
    cat = {"id": "beodeul_organic", "texture": "tex_beodeul_organic", "tileSize": 16, "tilesPerRow": COLS, "count": n,
           "source": "scripts/content/beodeul-organic (code pixel art, Beodeul locked palette)", "items": items}
    if draft:
        d = Path("/tmp/beodeul-organic-draft"); d.mkdir(exist_ok=True)
        Image.fromarray(sheet).save(d / "chipset.png"); (d / "catalog.json").write_text(json.dumps(cat, ensure_ascii=False, indent=1))
        print("draft", d, n, "cells")
        return
    (ROOT / "public/assets/beodeul-organic").mkdir(parents=True, exist_ok=True)
    Image.fromarray(sheet).save(ROOT / "public/assets/beodeul-organic/chipset.png")
    (ROOT / "src/assets/beodeulOrganicCatalog.json").write_text(json.dumps(cat, ensure_ascii=False, indent=1) + "\n")
    print("baked", n, "cells,", len(items), "items")

if __name__ == "__main__":
    main("--draft" in sys.argv)
