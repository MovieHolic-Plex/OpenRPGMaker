#!/usr/bin/env python3
"""Automated machine checker for fantasy_wizard_library Beodeul tileset & objects.

Validates:
1. Exact 16px-multiple canvases for all tiles (16x16) and objects (expected WxH)
2. 100% palette lock to palette_beodeul_library.json (excluding exact ground shadow #4c557f@85)
3. Strict alpha in {0, 255}, except exact #4c557f @ alpha 85
4. No pure #000000 pixels anywhere
5. Opaque bounding box fill ratios & bottom-aligned / horizontally centered bounds
6. Outer-edge outline darkness on objects (edges touching transparency use dark material tones)
7. Calm floor spike ratio <= 0.08 on floor tiles
8. Manifest completeness & notes.txt header check
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

WORKTREE = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
OUT_DIR = WORKTREE / "tiledata/dungeon-dots/fantasy_wizard_library"

SHADOW_RGBA = (0x4C, 0x55, 0x7F, 85)

EXPECTED_OBJECTS: dict[str, tuple[int, int, str]] = {
    "bookshelf_tall_full": (32, 32, "standing"),
    "bookshelf_scroll_rack": (16, 32, "standing"),
    "grimoire_cabinet": (32, 32, "standing"),
    "reading_table_long": (48, 16, "topdown"),
    "study_table_round": (32, 32, "topdown"),
    "alchemy_workbench": (32, 16, "topdown"),
    "oak_study_chair": (16, 16, "chair"),
    "wooden_stool": (16, 16, "chair"),
    "stone_fireplace_lit": (32, 32, "standing"),
    "brass_orrery_stand": (32, 32, "standing"),
    "alchemy_cauldron_hearth": (32, 32, "standing"),
    "potion_alembic_shelf": (32, 32, "standing"),
    "gilded_lectern_tome": (16, 32, "standing"),
    "scrying_crystal_pedestal": (16, 32, "standing"),
    "treasure_chest_bound": (16, 16, "standing"),
    "wooden_crates_stack": (32, 32, "standing"),
    "oak_barrel_hooped": (16, 16, "standing"),
    "brass_candelabra": (16, 32, "slender"),
    "wall_banner_crimson": (16, 32, "standing"),
    "arcane_rune_rug": (48, 32, "topdown"),
}

CALM_FLOOR_TILES = {
    "floor_stone_a.png",
    "floor_stone_b.png",
    "floor_oak_plank_a.png",
    "floor_oak_plank_b.png",
    "floor_vault_slate_a.png",
    "floor_vault_slate_b.png",
    "carpet_crimson_center.png",
}


def hex_to_rgb(hx: str) -> tuple[int, int, int]:
    hx = hx.lstrip("#")
    return (int(hx[0:2], 16), int(hx[2:4], 16), int(hx[4:6], 16))


def luma(r: int, g: int, b: int) -> float:
    return 0.299 * r + 0.587 * g + 0.114 * b


def check_floor_spike_ratio(img: Image.Image, threshold: float = 48.0) -> float:
    """Fraction of pixels whose luma differs from 4-neighbor average by > threshold."""
    w, h = img.size
    px = img.load()
    spikes = 0
    total = w * h
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            cur = luma(r, g, b)
            nbrs = []
            for nx, ny in (((x - 1) % w, y), ((x + 1) % w, y), (x, (y - 1) % h), (x, (y + 1) % h)):
                nr, ng, nb, _ = px[nx, ny]
                nbrs.append(luma(nr, ng, nb))
            avg = sum(nbrs) / len(nbrs)
            if abs(cur - avg) > threshold:
                spikes += 1
    return spikes / total


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []

    pal_path = OUT_DIR / "palette_beodeul_library.json"
    if not pal_path.exists():
        print("FAIL: missing palette_beodeul_library.json")
        return 1
    pal = json.loads(pal_path.read_text(encoding="utf-8"))
    allowed_rgb = {hex_to_rgb(c) for c in pal["colors"]}
    if (0, 0, 0) in allowed_rgb:
        errors.append("Palette contains pure #000000!")

    # 1. Check tiles
    tiles_dir = OUT_DIR / "tiles"
    tile_files = sorted(tiles_dir.glob("*.png"))
    if len(tile_files) < 18:
        errors.append(f"Expected at least 18 tiles, found {len(tile_files)}")

    floor_spikes: dict[str, float] = {}
    for tf in tile_files:
        img = Image.open(tf).convert("RGBA")
        w, h = img.size
        if (w, h) != (16, 16):
            errors.append(f"Tile {tf.name}: expected 16x16, got {w}x{h}")
        px = img.load()
        bad_pal = set()
        bad_alpha = set()
        pure_black = 0
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a != 255:
                    bad_alpha.add(a)
                if (r, g, b) == (0, 0, 0):
                    pure_black += 1
                if (r, g, b) not in allowed_rgb:
                    bad_pal.add(f"#{r:02x}{g:02x}{b:02x}")
        if bad_alpha:
            errors.append(f"Tile {tf.name}: non-opaque alpha {bad_alpha}")
        if pure_black:
            errors.append(f"Tile {tf.name}: contains {pure_black} pure #000000 pixels")
        if bad_pal:
            errors.append(f"Tile {tf.name}: off-palette colors {sorted(bad_pal)[:5]}")
        if tf.name in CALM_FLOOR_TILES:
            sr = check_floor_spike_ratio(img)
            floor_spikes[tf.name] = sr
            if sr > 0.08:
                errors.append(f"Floor tile {tf.name}: calm spike ratio {sr:.4f} > 0.08")

    # 2. Check objects
    obj_dir = OUT_DIR / "objects"
    obj_metrics: dict[str, dict] = {}
    for name, (exp_w, exp_h, cam) in EXPECTED_OBJECTS.items():
        of = obj_dir / f"{name}.png"
        if not of.exists():
            errors.append(f"Missing required object: {name}.png")
            continue
        img = Image.open(of).convert("RGBA")
        w, h = img.size
        if (w, h) != (exp_w, exp_h) or w % 16 != 0 or h % 16 != 0:
            errors.append(f"Object {name}: expected {exp_w}x{exp_h}, got {w}x{h}")

        px = img.load()
        bad_pal = set()
        bad_alpha = set()
        pure_black = 0
        xs, ys = [], []
        outer_total = 0
        outer_light = 0
        shadow_count = 0

        for y in range(h):
            for x in range(w):
                rgba = px[x, y]
                r, g, b, a = rgba
                if a == 0:
                    continue
                if rgba == SHADOW_RGBA:
                    shadow_count += 1
                    continue
                if a != 255:
                    bad_alpha.add((x, y, rgba))
                    continue
                if (r, g, b) == (0, 0, 0):
                    pure_black += 1
                if (r, g, b) not in allowed_rgb:
                    bad_pal.add(f"#{r:02x}{g:02x}{b:02x}")
                xs.append(x)
                ys.append(y)
                # Check if outer edge touching transparency (or shadow)
                touches_empty = False
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if not (0 <= nx < w and 0 <= ny < h) or px[nx, ny][3] != 255:
                        touches_empty = True
                        break
                if touches_empty:
                    outer_total += 1
                    if luma(r, g, b) > 95:
                        outer_light += 1

        if bad_alpha:
            errors.append(f"Object {name}: invalid semi-transparent pixels ({len(bad_alpha)})")
        if pure_black:
            errors.append(f"Object {name}: contains {pure_black} pure #000000 pixels")
        if bad_pal:
            errors.append(f"Object {name}: off-palette colors {sorted(bad_pal)[:5]}")
        if not xs:
            errors.append(f"Object {name}: completely empty!")
            continue

        bw = max(xs) - min(xs) + 1
        bh = max(ys) - min(ys) + 1
        bottom_gap = (h - 1) - max(ys)
        center_err = abs(((min(xs) + max(xs)) / 2.0) - ((w - 1) / 2.0))
        light_edge_ratio = outer_light / max(1, outer_total)

        obj_metrics[name] = {
            "canvas": f"{w}x{h}",
            "opaque_bbox": f"{bw}x{bh}",
            "fill_w": round(bw / w, 2),
            "fill_h": round(bh / h, 2),
            "bottom_gap": bottom_gap,
            "center_err": round(center_err, 2),
            "light_edge_ratio": round(light_edge_ratio, 3),
            "shadow_px": shadow_count,
        }

        if bottom_gap > 2:
            errors.append(f"Object {name}: not bottom-aligned (bottom_gap={bottom_gap}px)")
        if center_err > 2.5:
            errors.append(f"Object {name}: not horizontally centered (center_err={center_err:.1f}px)")
        if bw / w < 0.60 and cam != "slender":
            errors.append(f"Object {name}: opaque width too narrow ({bw}/{w})")
        if bh / h < 0.68:
            errors.append(f"Object {name}: opaque height too short ({bh}/{h})")
        if light_edge_ratio > 0.08:
            errors.append(
                f"Object {name}: outer-edge outline too light ({outer_light}/{outer_total} = {light_edge_ratio:.1%})"
            )

    # 3. Check manifest.json & notes.txt & previews & demos
    manifest_path = OUT_DIR / "manifest.json"
    if not manifest_path.exists():
        errors.append("Missing manifest.json")
    else:
        mf = json.loads(manifest_path.read_text(encoding="utf-8"))
        mf_objs = mf.get("objects", mf) if isinstance(mf, dict) else mf
        mf_ids = {item["id"] for item in mf_objs}
        missing_mf = set(EXPECTED_OBJECTS.keys()) - mf_ids
        if missing_mf:
            errors.append(f"Manifest missing objects: {sorted(missing_mf)}")
        for item in mf_objs:
            for req_key in ("file", "id", "name_en", "name_ko", "camera", "tiles", "canvas", "opaque_size", "description", "tags"):
                if req_key not in item:
                    errors.append(f"Manifest entry {item.get('id')} missing key '{req_key}'")

    notes_path = OUT_DIR / "notes.txt"
    if not notes_path.exists():
        errors.append("Missing notes.txt")
    else:
        lines = [ln.strip() for ln in notes_path.read_text(encoding="utf-8").splitlines() if ln.strip()]
        if not lines or lines[0] != "gemini-4-neon high":
            errors.append(f"notes.txt line 1 must be 'gemini-4-neon high', got: {lines[0] if lines else '<empty>'}")
        if len(lines) < 1 + len(EXPECTED_OBJECTS):
            errors.append(f"notes.txt has {len(lines)} lines, expected at least {1 + len(EXPECTED_OBJECTS)}")

    for req_img, exp_size in (
        ("preview_2x_on_gray.png", None),
        ("demo_fantasy_wizard_library.png", (480, 352)),
        ("demo_fantasy_wizard_library_2x.png", (960, 704)),
    ):
        p = OUT_DIR / req_img
        if not p.exists():
            errors.append(f"Missing required deliverable image: {req_img}")
        else:
            im = Image.open(p)
            if exp_size and im.size != exp_size:
                errors.append(f"{req_img}: expected {exp_size}, got {im.size}")

    print("=== FANTASY WIZARD LIBRARY MACHINE CHECK ===")
    print(f"Palette colors : {len(allowed_rgb)}")
    print(f"Tiles checked  : {len(tile_files)}")
    print("Floor spike ratios:")
    for k, v in sorted(floor_spikes.items()):
        print(f"  {k:28s}: {v:.4f} (limit <= 0.08)")
    print(f"Objects checked: {len(obj_metrics)}/{len(EXPECTED_OBJECTS)}")
    for k, m in obj_metrics.items():
        print(
            f"  {k:26s} {m['canvas']:>5s} bbox={m['opaque_bbox']:>5s} "
            f"bot={m['bottom_gap']} ctr={m['center_err']} lightEdge={m['light_edge_ratio']:.3f} shd={m['shadow_px']}"
        )
    if warnings:
        print("\nWARNINGS:")
        for w_msg in warnings:
            print(f"  - {w_msg}")
    if errors:
        print(f"\nFAIL ({len(errors)} errors):")
        for e_msg in errors:
            print(f"  - {e_msg}")
        return 1
    print("\n100% PASS — All checks succeeded!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
