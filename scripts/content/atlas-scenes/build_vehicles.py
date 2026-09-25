"""Build public/assets/atlas-scenes/vehicles.png + tiledata/atlas-scenes/vehicles.json.

Pieces (ships, boats, airship, carts, scene props) are painted at pixel level (vehicle_art / rig_art / ship_parts /
scene_art) on tile-aligned canvases, sliced into 16px tiles and de-duplicated into one 30-column sheet.

Per cell a piece has a lower and an upper tile (-1 = leave the map cell as it is):
  - pure deck/floor cells → lower = the plank tile (passable), upper = rig slice if any (★ above the walker)
  - hull / wall / prop cells → lower = -1 (the water or ground stays), upper = the slice (blocked)
  - rig-only cells over water → upper = rig slice (★)
The sheet slot passage is 'O' (walkable, drawn under walkers), 'X' (blocked, y-sorted) or 'star' (walkable, above).

Usage: python3 scripts/content/atlas-scenes/build_vehicles.py
"""
from __future__ import annotations

import json
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from vehicle_art import Canvas, texture_tile, sheet_tile  # noqa: E402
import pieces_ships  # noqa: E402
import pieces_scenes  # noqa: E402

T = 16
COLS = 30
OUT_PNG = "public/assets/atlas-scenes/vehicles.png"
OUT_JSON = "tiledata/atlas-scenes/vehicles.json"


class Sheet:
    def __init__(self):
        self.slots = []        # [{name, pass}]
        self.images = []       # [Image]
        self.index = {}        # (bytes, pass) -> slot

    def add(self, img: Image.Image, passage: str, name: str) -> int:
        if img.getbbox() is None:
            return -1
        key = (img.tobytes(), passage)
        if key in self.index:
            return self.index[key]
        n = len(self.images)
        self.images.append(img)
        self.slots.append({"name": name, "pass": passage})
        self.index[key] = n
        return n


def slice_piece(sheet: Sheet, piece: dict) -> dict:
    """piece: {name, w, h (tiles), hull: Canvas, rig: Canvas|None, deck: set of deck texture bytes,
    walk: set[(x,y)] cells forced walkable (doors, gangways), block: set[(x,y)] cells forced blocked (mast base…),
    under: set[(x,y)] hull cells whose slice is a floor (piers, raft logs) → lower walkable}"""
    w, h = piece["w"], piece["h"]
    hull, rig = piece["hull"], piece.get("rig")
    deck_keys = piece.get("deck", set())
    walk, block, floor = piece.get("walk", set()), piece.get("block", set()), piece.get("floor", set())
    lower_block = piece.get("lowerBlock", set())
    lower, upper = [], []
    for y in range(h):
        for x in range(w):
            box = (x * T, y * T, x * T + T, y * T + T)
            hs = hull.im.crop(box)
            rs = rig.im.crop(box) if rig else Image.new("RGBA", (T, T))
            has_h, has_r = hs.getbbox() is not None, rs.getbbox() is not None
            name = f"{piece.get('label', piece['name'])} ({x},{y})"
            lo, up = -1, -1
            if has_h and not (hs.tobytes() in deck_keys or (x, y) in floor) and ((x, y) in lower_block or piece.get("skyBacked")):
                # opaque blocked ground (sky, rock, a hull baked on the sky) on the lower layer; rig above
                comp_passage = "O" if (x, y) in walk else "X"
                lo = sheet.add(hs, comp_passage, name)
                if has_r:
                    up = sheet.add(rs, "X" if (x, y) in block else "star", name + " 돛")
            elif has_h and (hs.tobytes() in deck_keys or (x, y) in floor):
                # walkable floor on the lower layer; rig above it
                lo = sheet.add(hs, "O", piece.get("deck_name", "갑판 판자") if hs.tobytes() in deck_keys else name)
                if has_r:
                    up = sheet.add(rs, "X" if (x, y) in block else "star", name + " 돛")
            elif has_h:
                comp = hs.copy()
                if has_r:
                    comp.alpha_composite(rs)
                passage = "O" if (x, y) in walk else "X"
                up = sheet.add(comp, passage, name)
            elif has_r:
                up = sheet.add(rs, "X" if (x, y) in block else "star", name + " 돛")
            lower.append(lo)
            upper.append(up)
    out = {"w": w, "h": h, "lower": lower, "upper": upper}
    for k in ("doors", "entry", "deckRect", "kind", "label", "anchor", "walkCells", "meta", "skyBacked"):
        if k in piece:
            out[k] = piece[k]
    return out


def main():
    sheet = Sheet()
    pieces = {}
    for module in (pieces_ships, pieces_scenes):
        for piece in module.pieces():
            assert piece["name"] not in pieces, piece["name"]
            pieces[piece["name"]] = slice_piece(sheet, piece)
    rows = (len(sheet.images) + COLS - 1) // COLS
    png = Image.new("RGBA", (COLS * T, rows * T), (0, 0, 0, 0))
    for n, img in enumerate(sheet.images):
        png.paste(img, ((n % COLS) * T, (n // COLS) * T))
    os.makedirs(os.path.dirname(OUT_PNG), exist_ok=True)
    png.save(OUT_PNG, optimize=True)
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w") as f:
        json.dump({"source": "scripts/content/atlas-scenes/build_vehicles.py", "tileSize": T, "tilesPerRow": COLS,
                   "count": rows * COLS, "used": len(sheet.images), "slots": sheet.slots, "pieces": pieces}, f,
                  ensure_ascii=False, separators=(",", ":"))
    print(f"{len(sheet.images)} tiles ({rows} rows), {len(pieces)} pieces")


if __name__ == "__main__":
    main()
