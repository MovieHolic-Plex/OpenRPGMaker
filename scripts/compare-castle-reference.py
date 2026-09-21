#!/usr/bin/env python3
"""Compare a saved castle map against the supplied image in 16 equal (4×4) regions.

The editor uses 16px cells. This verifier renders lower+upper layers from the
selected bundled atlas, normalizes the result to the 2240px reference canvas,
and reports a similarity for every region plus the complete image.
"""
from __future__ import annotations
import argparse, json
from pathlib import Path
from PIL import Image, ImageChops
import numpy as np

REFERENCE_DEFAULT = "public/assets/opengameart-castle-reference-composite.png"
ATLAS_DEFAULT = "public/assets/opengameart-castle-reference-composite.png"

def render_map(project: dict, map_id: str, root: Path) -> Image.Image:
    game_map = project["maps"][map_id]
    tileset = project["tilesets"][game_map["tilesetId"]]
    image_id = tileset["image"]["id"]
    atlas_path = root / ATLAS_DEFAULT if image_id == "tex_opengameart_castle_reference" else root / "public/assets/opengameart-castle-tiles.png"
    atlas = Image.open(atlas_path).convert("RGBA")
    tile_size = int(tileset.get("tileSize", 16))
    columns = int(tileset.get("tilesPerRow", 16))
    out = Image.new("RGBA", (game_map["width"] * tile_size, game_map["height"] * tile_size), (0, 0, 0, 0))
    lower = game_map["lowerTiles"]
    upper = game_map["upperTiles"]
    for layer in (lower, upper):
        for index, tile in enumerate(layer):
            if tile is None or tile < 0: continue
            x = (index % game_map["width"]) * tile_size
            y = (index // game_map["width"]) * tile_size
            sx = (tile % columns) * tile_size
            sy = (tile // columns) * tile_size
            if sx + tile_size > atlas.width or sy + tile_size > atlas.height: continue
            cell = atlas.crop((sx, sy, sx + tile_size, sy + tile_size))
            out.alpha_composite(cell, (x, y))
    return out.convert("RGB")

def compare(reference: Image.Image, candidate: Image.Image) -> dict:
    target = Image.new("RGB", (2240, 2240))
    target.paste(reference.convert("RGB"), (0, 0))
    # The supplied screenshot is 2239×2235. Match the committed reference
    # atlas convention: preserve every source pixel and extend only the last
    # row/column, never resample the target before scoring.
    if reference.width < 2240:
        target.paste(reference.crop((reference.width - 1, 0, reference.width, reference.height)).resize((2240 - reference.width, reference.height), Image.Resampling.NEAREST), (reference.width, 0))
    if reference.height < 2240:
        target.paste(target.crop((0, reference.height - 1, 2240, reference.height)).resize((2240, 2240 - reference.height), Image.Resampling.NEAREST), (0, reference.height))
    actual = candidate.convert("RGB").resize((2240, 2240), Image.Resampling.NEAREST)
    a = np.asarray(target, dtype=np.int16)
    b = np.asarray(actual, dtype=np.int16)
    error = np.abs(a - b)
    regions = []
    for row in range(4):
        for col in range(4):
            y0, y1 = row * 560, (row + 1) * 560
            x0, x1 = col * 560, (col + 1) * 560
            e = error[y0:y1, x0:x1]
            regions.append({
                "row": row, "col": col,
                "mae": round(float(e.mean()), 4),
                "similarity": round(float(max(0.0, 1.0 - e.mean() / 255.0)), 6),
                "exactPixelRatio": round(float(np.all(e == 0, axis=2).mean()), 6),
            })
    mae = float(error.mean())
    return {
        "similarity": round(float(max(0.0, 1.0 - mae / 255.0)), 6),
        "mae": round(mae, 4),
        "exactPixelRatio": round(float(np.all(error == 0, axis=2).mean()), 6),
        "regions": regions,
    }

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True, help="project JSON export or LegacyDb response JSON")
    parser.add_argument("--map", dest="map_id", required=True)
    parser.add_argument("--reference", default=REFERENCE_DEFAULT)
    parser.add_argument("--out", default="")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    raw = json.loads(Path(args.project).read_text())
    project = raw[0]["current_json"] if isinstance(raw, list) else raw.get("current_json", raw)
    reference_path = Path(args.reference)
    if not reference_path.is_absolute(): reference_path = root / reference_path
    reference = Image.open(reference_path).convert("RGB")
    rendered = render_map(project, args.map_id, root)
    report = {"mapId": args.map_id, "mapSize": [project["maps"][args.map_id]["width"], project["maps"][args.map_id]["height"]], "renderSize": list(rendered.size), "referenceSize": list(reference.size), "comparison": compare(reference, rendered)}
    text = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.out: Path(args.out).write_text(text)
    print(text, end="")

if __name__ == "__main__": main()
