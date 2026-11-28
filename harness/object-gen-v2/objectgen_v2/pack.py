"""Compile verified 16px-grid sprites into an OpenRPGMaker oprn-store-pack/1 folder."""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from . import __version__
from .palette import TILE_SIZE, load_palette, verify_sprite

STORE_PACK_SCHEMA = "oprn-store-pack/1"
SOLID = {"up": False, "down": False, "left": False, "right": False}
PASS = {"up": True, "down": True, "left": True, "right": True}


def _sha256_bytes(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def _solid_cells(item: dict[str, Any], w: int, h: int) -> set[tuple[int, int]]:
    if "block" in item:
        return {(int(c[0]), int(c[1])) for c in item["block"]}
    if item.get("place") in ("decal", "roof"):
        return set()
    return {(x, h - 1) for x in range(w)}


def build_store_pack(
    spec_path: str | Path,
    out_dir: str | Path,
    *,
    tiles_per_row: int = 16,
    palette_override: str | Path | None = None,
) -> Path:
    """Compile a batch spec.json + pieces/<id>.png into an oprn-store-pack/1 folder."""
    sp_path = Path(spec_path).resolve()
    base_dir = sp_path.parent
    spec = json.loads(sp_path.read_text(encoding="utf-8"))

    pal_path = palette_override or spec.get("palette")
    allowed = load_palette(base_dir / pal_path if pal_path and not Path(pal_path).is_absolute() else pal_path) if pal_path else None

    items = spec.get("items") or []
    if not items:
        raise ValueError("spec.json has no items")

    pieces_dir = base_dir / spec.get("piecesDir", "pieces")
    loaded: list[tuple[dict[str, Any], Image.Image]] = []
    total_cells = 0

    for item in items:
        pid = item["id"]
        png_path = pieces_dir / f"{pid}.png"
        rep = verify_sprite(png_path, allowed)
        if not rep.ok:
            raise ValueError(f"{pid} failed verification: {', '.join(rep.errors)}")
        im = Image.open(png_path).convert("RGBA")
        w, h = im.width // TILE_SIZE, im.height // TILE_SIZE
        if "w" in item and int(item["w"]) != w:
            raise ValueError(f"{pid}: width {w} != declared {item['w']}")
        if "h" in item and int(item["h"]) != h:
            raise ValueError(f"{pid}: height {h} != declared {item['h']}")
        loaded.append((item, im))
        total_cells += w * h

    tpr = max(1, int(tiles_per_row))
    rows_n = max(1, math.ceil(total_cells / tpr))
    sheet = Image.new("RGBA", (tpr * TILE_SIZE, rows_n * TILE_SIZE), (0, 0, 0, 0))

    passability: list[dict[str, bool]] = []
    priority: list[str] = []
    terrain: list[int] = []
    tile_meta: list[dict[str, Any]] = []
    structure_kits: list[dict[str, Any]] = []

    next_tid = 0
    for item, im in loaded:
        pid = item["id"]
        name = item.get("name", pid)
        w, h = im.width // TILE_SIZE, im.height // TILE_SIZE
        decal = item.get("place") == "decal"
        solid = _solid_cells(item, w, h)
        kit_rows: list[dict[str, list[int]]] = []

        for y in range(h):
            row_upper: list[int] = []
            for x in range(w):
                cell = im.crop((x * TILE_SIZE, y * TILE_SIZE, (x + 1) * TILE_SIZE, (y + 1) * TILE_SIZE))
                if not np.asarray(cell)[:, :, 3].any():
                    row_upper.append(-1)
                    continue
                tid = next_tid
                next_tid += 1
                sx, sy = (tid % tpr) * TILE_SIZE, (tid // tpr) * TILE_SIZE
                sheet.paste(cell, (sx, sy))
                is_solid = (x, y) in solid
                if decal:
                    prio, pass_flag, passage, home = "lower", PASS, "walkable", "lower"
                elif is_solid:
                    prio, pass_flag, passage, home = "lower", SOLID, "blocked", "upper"
                else:
                    prio, pass_flag, passage, home = "upper", PASS, "overhead", "upper"
                passability.append(dict(pass_flag))
                priority.append(prio)
                terrain.append(0)
                tile_meta.append(
                    {
                        "label": f"{name} ({x + 1},{y + 1})",
                        "description": f"Part of kit {pid}. Stamp as a whole kit.",
                        "role": "building" if item.get("type") == "building" else "prop",
                        "passage": passage,
                        "defaultLayer": home,
                        "tags": list(item.get("tags", [])),
                        "source": "authored",
                        "confidence": "high",
                    }
                )
                row_upper.append(tid)
            kit_rows.append({"tiles": [-1] * w, "upperTiles": row_upper})

        structure_kits.append(
            {
                "id": pid,
                "kind": "section",
                "name": name,
                "width": w,
                "height": h,
                "tileSize": TILE_SIZE,
                "rows": kit_rows,
                "learnedFrom": "pack-preset",
                "ai": {
                    "description": item.get("description") or f"{name} — generated with object-gen-v2 (Carbon Medium 1-pass).",
                    "placementRules": item.get("rule", ""),
                    "tags": list(dict.fromkeys(list(item.get("tags", [])) + list(item.get("words", [])))),
                    "role": "building" if item.get("type") == "building" else "prop",
                    "repeatability": "fixed",
                    "layerHome": "lower" if decal else "upper",
                    "origin": "ai",
                    "confidence": "high",
                    "snap": "floor",
                    "anchor": {"dx": w // 2, "dy": h - 1},
                },
            }
        )

    # Crop sheet height to actual used tiles
    actual_rows = max(1, math.ceil(next_tid / tpr))
    sheet = sheet.crop((0, 0, tpr * TILE_SIZE, actual_rows * TILE_SIZE))

    out = Path(out_dir)
    blobs_dir = out / "blobs"
    blobs_dir.mkdir(parents=True, exist_ok=True)

    # Write tileset PNG blob
    sheet_tmp = out / "_sheet.png"
    sheet.save(sheet_tmp, format="PNG")
    sheet_bytes = sheet_tmp.read_bytes()
    sheet_tmp.unlink()
    sheet_sha = _sha256_bytes(sheet_bytes)
    (blobs_dir / f"{sheet_sha}.png").write_bytes(sheet_bytes)

    # Build a crisp 2x preview blob
    preview_im = sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST)
    prev_tmp = out / "_preview.png"
    preview_im.save(prev_tmp, format="PNG")
    prev_bytes = prev_tmp.read_bytes()
    prev_tmp.unlink()
    prev_sha = _sha256_bytes(prev_bytes)
    (blobs_dir / f"{prev_sha}.png").write_bytes(prev_bytes)

    pack_id = spec.get("packId") or sp_path.parent.name
    asset_id = f"tex_{pack_id}"
    tileset_id = f"ts_{pack_id}"
    model_name = spec.get("model", "gemini-4-carbon (thought_level: medium)")

    blobs_list = [{"sha256": sheet_sha, "mime": "image/png", "bytes": len(sheet_bytes)}]
    if prev_sha != sheet_sha:
        blobs_list.append({"sha256": prev_sha, "mime": "image/png", "bytes": len(prev_bytes)})

    manifest: dict[str, Any] = {
        "schema": STORE_PACK_SCHEMA,
        "title": str(spec.get("title") or pack_id)[:80],
        "summary": str(spec.get("summary") or f"{len(loaded)} 3/4 pixel-art objects generated via object-gen-v2")[:160],
        "description": str(spec.get("description") or f"Generated with object-gen-v2 {__version__} ({model_name}).")[:8000],
        "tags": [str(t)[:24] for t in (spec.get("tags") or ["objects", "3/4", "object-gen-v2"])[:12]],
        "kind": "tileset",
        "license": spec.get("license", "CC0"),
        "aiGenerated": True,
        "credits": str(spec.get("credits") or f"object-gen-v2 ({model_name})")[:400],
        "content": {
            "assets": {
                asset_id: {
                    "id": asset_id,
                    "name": f"{pack_id}.png",
                    "kind": "tileset",
                    "blob": sheet_sha,
                    "mime": "image/png",
                    "meta": {
                        "width": sheet.width,
                        "height": sheet.height,
                        "tileSize": TILE_SIZE,
                        "tilesPerRow": tpr,
                        "frameCount": next_tid,
                    },
                    "generation": {
                        "method": "generative-model",
                        "engine": f"object-gen-v2 {__version__}",
                        "model": model_name,
                    },
                }
            },
            "tilesets": {
                tileset_id: {
                    "id": tileset_id,
                    "name": str(spec.get("title") or pack_id),
                    "image": {"type": "uploaded", "id": asset_id},
                    "kind": "custom",
                    "tileSize": TILE_SIZE,
                    "tilesPerRow": tpr,
                    "count": next_tid,
                    "passability": passability,
                    "priority": priority,
                    "terrain": terrain,
                    "tileMeta": tile_meta,
                    "tileGroups": [],
                    "autotileGroups": [],
                    "structureKits": structure_kits,
                }
            },
        },
        "previews": [prev_sha],
        "blobs": blobs_list,
    }

    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return out
