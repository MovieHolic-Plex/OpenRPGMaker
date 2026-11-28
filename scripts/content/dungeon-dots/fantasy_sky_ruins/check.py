"""Automated machine validator for `fantasy_sky_ruins` Beodeul Ancient Ruins pack.

Validates:
1. Exact 16px-multiple canvases for all tiles (16x16) and objects
2. 100% palette lock to `palette_beodeul_ruins.json` (except optional shadow #4c557f@85)
3. Strict alpha in {0, 255} except #4c557f@85
4. Opaque bounding box fill, horizontal centering & bottom alignment
5. Outer-edge outline darkness (no pure #000000; every outer opaque boundary pixel dark)
6. Calm floor/grass tile spike ratio <= 0.08
7. Manifest & notes.txt completeness + preview & 30x22 demo map dimensions
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple
from PIL import Image

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
OUT_DIR = ROOT / "tiledata/dungeon-dots/fantasy_sky_ruins"

SHADOW_RGB = (0x4C, 0x55, 0x7F)
SHADOW_ALPHA = 85

CALM_FLOOR_TILES = [
    "grass_meadow_a.png",
    "grass_meadow_b.png",
    "grass_moss_accent.png",
    "grass_wildflower.png",
    "flagstone_courtyard_a.png",
    "flagstone_courtyard_b.png",
    "flagstone_courtyard_cracked.png",
    "sanctum_floor_rune.png",
    "castle_terrace_top.png",
]


def luma(r: int, g: int, b: int) -> float:
    return 0.299 * r + 0.587 * g + 0.114 * b


def hex_to_rgb(h: str) -> Tuple[int, int, int]:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def compute_spike_ratio(img: Image.Image, threshold: float = 24.0) -> float:
    """Fraction of pixels whose luma jumps > threshold vs mean of 4 toroidal neighbors."""
    w, h = img.size
    px = img.load()
    spikes = 0
    total = w * h
    for y in range(h):
        for x in range(w):
            c = luma(*px[x, y][:3])
            nb = (
                luma(*px[(x - 1) % w, y][:3])
                + luma(*px[(x + 1) % w, y][:3])
                + luma(*px[x, (y - 1) % h][:3])
                + luma(*px[x, (y + 1) % h][:3])
            ) / 4.0
            if abs(c - nb) > threshold:
                spikes += 1
    return spikes / total


def main() -> int:
    errors: List[str] = []
    warnings: List[str] = []

    pal_path = OUT_DIR / "palette_beodeul_ruins.json"
    if not pal_path.exists():
        print("FAIL: palette_beodeul_ruins.json missing")
        return 1

    pal_data = json.loads(pal_path.read_text(encoding="utf-8"))
    allowed_rgb = {hex_to_rgb(h) for h in pal_data["colors"]}
    if (0, 0, 0) in allowed_rgb:
        errors.append("Palette contains forbidden pure #000000")
    if not (50 <= len(allowed_rgb) <= 80):
        errors.append(f"Palette size {len(allowed_rgb)} outside expected curated range 50..80")

    # Check tiles
    tiles_dir = OUT_DIR / "tiles"
    tile_files = sorted(tiles_dir.glob("*.png"))
    if len(tile_files) < 20:
        errors.append(f"Expected >= 20 tiles, found {len(tile_files)}")

    floor_spikes: Dict[str, float] = {}
    for tf in tile_files:
        img = Image.open(tf).convert("RGBA")
        if img.size != (16, 16):
            errors.append(f"Tile {tf.name}: expected 16x16, got {img.size}")
        px = img.load()
        for y in range(img.height):
            for x in range(img.width):
                r, g, b, a = px[x, y]
                if a != 255:
                    errors.append(f"Tile {tf.name} ({x},{y}): non-opaque alpha {a}")
                    break
                if (r, g, b) == (0, 0, 0):
                    errors.append(f"Tile {tf.name} ({x},{y}): pure #000000")
                    break
                if (r, g, b) not in allowed_rgb:
                    errors.append(f"Tile {tf.name} ({x},{y}): off-palette #{r:02x}{g:02x}{b:02x}")
                    break
        if tf.name in CALM_FLOOR_TILES:
            sr = compute_spike_ratio(img)
            floor_spikes[tf.name] = sr
            if sr > 0.08:
                errors.append(f"Calm floor tile {tf.name} spike ratio {sr:.4f} > 0.08")

    # Check objects
    objs_dir = OUT_DIR / "objects"
    obj_files = sorted(objs_dir.glob("*.png"))
    if len(obj_files) != 20:
        errors.append(f"Expected exactly 20 objects, found {len(obj_files)}")

    obj_metrics: List[Tuple[str, Tuple[int, int], Tuple[int, int], float, float]] = []
    for of in obj_files:
        img = Image.open(of).convert("RGBA")
        w, h = img.size
        if w % 16 != 0 or h % 16 != 0 or w == 0 or h == 0:
            errors.append(f"Object {of.name}: non-16px-multiple canvas {w}x{h}")
        px = img.load()

        opaque_xs: List[int] = []
        opaque_ys: List[int] = []
        bad_alpha = 0
        off_palette = 0
        pure_black = 0
        edge_total = 0
        edge_bright = 0

        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                if a == 255:
                    opaque_xs.append(x)
                    opaque_ys.append(y)
                    if (r, g, b) == (0, 0, 0):
                        pure_black += 1
                    if (r, g, b) not in allowed_rgb:
                        off_palette += 1
                    # Outer edge touching non-opaque pixel
                    touches = False
                    for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                        if not (0 <= nx < w and 0 <= ny < h) or px[nx, ny][3] != 255:
                            touches = True
                            break
                    if touches:
                        edge_total += 1
                        if luma(r, g, b) > 85.0:
                            edge_bright += 1
                else:
                    if not ((r, g, b) == SHADOW_RGB and a == SHADOW_ALPHA):
                        bad_alpha += 1

        if bad_alpha:
            errors.append(f"Object {of.name}: {bad_alpha} illegal semi-transparent pixels")
        if off_palette:
            errors.append(f"Object {of.name}: {off_palette} off-palette pixels")
        if pure_black:
            errors.append(f"Object {of.name}: {pure_black} pure #000000 pixels")
        if not opaque_xs:
            errors.append(f"Object {of.name}: empty image")
            continue

        ow = max(opaque_xs) - min(opaque_xs) + 1
        oh = max(opaque_ys) - min(opaque_ys) + 1
        fill_w = ow / w
        fill_h = oh / h
        if fill_w < 0.45 or fill_h < 0.65:
            errors.append(f"Object {of.name}: undersized bbox {ow}x{oh} in {w}x{h} ({fill_w:.2f}w, {fill_h:.2f}h)")
        # Bottom alignment check (within 2px of canvas bottom)
        bottom_gap = (h - 1) - max(opaque_ys)
        if bottom_gap > 2:
            errors.append(f"Object {of.name}: not bottom-aligned (bottom_gap={bottom_gap}px)")
        # Horizontal centering check (within 2px)
        left_gap = min(opaque_xs)
        right_gap = (w - 1) - max(opaque_xs)
        if abs(left_gap - right_gap) > 2:
            errors.append(f"Object {of.name}: not horizontally centered (left={left_gap}, right={right_gap})")
        # Outer-edge outline darkness check (allow 0 bright outer pixels)
        bright_ratio = edge_bright / max(1, edge_total)
        if edge_bright > 0:
            errors.append(f"Object {of.name}: {edge_bright}/{edge_total} outer-edge pixels have luma > 85")
        obj_metrics.append((of.name, (w, h), (ow, oh), fill_w, bright_ratio))

    # Check manifest.json & notes.txt
    man_path = OUT_DIR / "manifest.json"
    notes_path = OUT_DIR / "notes.txt"
    if not man_path.exists():
        errors.append("manifest.json missing")
    else:
        manifest = json.loads(man_path.read_text(encoding="utf-8"))
        if len(manifest) != 20:
            errors.append(f"manifest.json has {len(manifest)} entries, expected 20")
        man_files = {item["file"] for item in manifest}
        disk_files = {p.name for p in obj_files}
        if man_files != disk_files:
            errors.append(f"manifest files mismatch disk files: diff={man_files ^ disk_files}")
        req_keys = {"file", "id", "name_en", "name_ko", "description", "tags", "tiles", "facing", "camera"}
        for item in manifest:
            missing_k = req_keys - set(item.keys())
            if missing_k:
                errors.append(f"manifest {item.get('file')}: missing keys {missing_k}")

    if not notes_path.exists():
        errors.append("notes.txt missing")
    else:
        lines = [ln.strip() for ln in notes_path.read_text(encoding="utf-8").splitlines() if ln.strip()]
        if not lines or lines[0] != "gemini-4-neon high":
            errors.append(f"notes.txt line 1 must be 'gemini-4-neon high', got {lines[0] if lines else '<empty>'!r}")
        if len(lines) != 21:
            errors.append(f"notes.txt expected 21 lines (header + 20 objects), got {len(lines)}")

    # Check preview & demo maps
    preview_path = OUT_DIR / "preview_2x_on_gray.png"
    demo1_path = OUT_DIR / "demo_fantasy_sky_ruins.png"
    demo2_path = OUT_DIR / "demo_fantasy_sky_ruins_2x.png"
    if not preview_path.exists():
        errors.append("preview_2x_on_gray.png missing")
    if not demo1_path.exists():
        errors.append("demo_fantasy_sky_ruins.png missing")
    else:
        d1 = Image.open(demo1_path)
        if d1.size != (480, 352):
            errors.append(f"demo_fantasy_sky_ruins.png expected 480x352, got {d1.size}")
    if not demo2_path.exists():
        errors.append("demo_fantasy_sky_ruins_2x.png missing")
    else:
        d2 = Image.open(demo2_path)
        if d2.size != (960, 704):
            errors.append(f"demo_fantasy_sky_ruins_2x.png expected 960x704, got {d2.size}")

    print("=== FANTASY SKY RUINS (BEODEUL) MACHINE CHECK ===")
    print(f"Palette: {len(allowed_rgb)} locked colors (0 pure black)")
    print(f"Tiles:   {len(tile_files)} x 16x16")
    print("Calm floor spike ratios (limit <= 0.08):")
    for k, v in sorted(floor_spikes.items()):
        print(f"  {k:30s} {v:.4f}")
    print(f"Objects: {len(obj_files)}")
    for name, (w, h), (ow, oh), _fw, br in obj_metrics:
        print(f"  {name:30s} canvas={w:2d}x{h:2d}  opaque={ow:2d}x{oh:2d}  bright_edge={br:.3f}")
    if warnings:
        print("WARNINGS:")
        for wmsg in warnings:
            print(f"  - {wmsg}")
    if errors:
        print(f"\nFAIL ({len(errors)} errors):")
        for e in errors:
            print(f"  - {e}")
        return 1
    print("\nPASS: 100% ALL CHECKS PASSED!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
