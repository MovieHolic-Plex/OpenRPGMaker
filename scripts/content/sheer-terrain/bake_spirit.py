#!/usr/bin/env python3
"""Bake beodeul_spirit: tiledata/sheer-terrain/spirit/<id>.png -> one 16-column sheet + catalog (like beodeul-organic/bake.py).

  python3 scripts/content/sheer-terrain/bake_spirit.py           # bundle bake: every object must pass the object-gate exit (context bundle)
  python3 scripts/content/sheer-terrain/bake_spirit.py --draft   # same bytes, no gate check — local preview only, never commit a draft bake

Outputs: public/assets/beodeul-spirit/chipset.png, src/assets/beodeulSpiritCatalog.json.
Per item: id, name, en, family, kind, layer, width, height, rows (cell ids, -1 = empty), block ([dx,dy] shut cells),
under ([dx,dy] ground-shadow cells: walkable, drawn below the hero), sha256 (the pixel hash the exit checked).
A cell picture is shared only between cells of the same role (stand / block / under), so a role never leaks to another object.
"""
import hashlib, json, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "tiledata/sheer-terrain/spirit"
sys.path.insert(0, str(ROOT / "src/harnesses/_core"))
COLS = 16


def main(draft: bool) -> None:
    from object_gate import require_all, pixel_sha256
    spec = json.loads((SRC / "spec.json").read_text())["items"]
    imgs = {it["id"]: Image.open(SRC / f"{it['id']}.png").convert("RGBA") for it in spec}
    if draft:
        hashes = {it["id"]: pixel_sha256(imgs[it["id"]]) for it in spec}
    else:
        got = require_all([(imgs[it["id"]], it["kind"], f"beodeul_spirit/{it['id']}") for it in spec], context="bundle")
        hashes = {it["id"]: h for it, h in zip(spec, got)}
    cells, index, items, roles = [], {}, [], []
    for it in spec:
        a = np.array(imgs[it["id"]])
        block = {tuple(b) for b in it["block"]}; under = {tuple(u) for u in it["under"]}
        rows = []
        for cy in range(it["h"]):
            row = []
            for cx in range(it["w"]):
                c = a[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16]
                if not (c[..., 3] > 0).any():
                    row.append(-1); continue
                role = "walk" if it["layer"] != 3 else "block" if (cx, cy) in block else "under" if (cx, cy) in under else "stand"
                key = role + hashlib.sha256(c.tobytes()).hexdigest()
                if key not in index:
                    index[key] = len(cells); cells.append(c); roles.append(role)
                row.append(index[key])
            rows.append(row)
        items.append({k: it[k] for k in ("id", "name", "en", "family", "kind", "layer")} | {
            "width": it["w"], "height": it["h"], "rows": rows, "block": it["block"], "under": it["under"], "sha256": hashes[it["id"]]})
    n = len(cells); H = (n + COLS - 1) // COLS
    sheet = np.zeros((H * 16, COLS * 16, 4), np.uint8)
    for i, c in enumerate(cells):
        sheet[(i // COLS) * 16:(i // COLS + 1) * 16, (i % COLS) * 16:(i % COLS + 1) * 16] = c
    cat = {"id": "beodeul_spirit", "texture": "tex_beodeul_spirit", "tileSize": 16, "tilesPerRow": COLS, "count": n,
           "source": "scripts/content/sheer-terrain/compose_spirit.py (Fable terrain pieces + Beodeul crown kits, composed by code)",
           "roles": roles, "items": items}
    (ROOT / "public/assets/beodeul-spirit").mkdir(parents=True, exist_ok=True)
    Image.fromarray(sheet).save(ROOT / "public/assets/beodeul-spirit/chipset.png", optimize=True)
    (ROOT / "src/assets/beodeulSpiritCatalog.json").write_text(json.dumps(cat, ensure_ascii=False, indent=1) + "\n")
    print("DRAFT (no gate) " if draft else "", "baked", n, "cells,", len(items), "items")


if __name__ == "__main__":
    main("--draft" in sys.argv)
