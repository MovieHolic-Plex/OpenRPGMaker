"""Automated machine checker for modern_pcbang tileset, objects, manifest, and demo map."""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Dict, List, Tuple
from PIL import Image

from palette import (
    OUT_ROOT, TILES_DIR, OBJECTS_DIR, VALID_OPAQUE, SHADOW, lum,
)

REQUIRED_OBJECTS = [
    "pc_station_blue",
    "pc_station_red",
    "gaming_chair_red",
    "gaming_chair_blue",
    "arcade_cabinet_blue",
    "arcade_cabinet_red",
    "claw_crane_machine",
    "coin_changer",
    "vending_machine_drinks",
    "drink_fridge_glass",
    "ramen_cooker_counter",
    "snack_shelf_rack",
    "pos_counter_desk",
    "cafe_table_oak",
    "cafe_stool",
    "vip_sofa_navy",
    "storage_locker",
    "server_rack",
    "standing_floor_lamp",
    "trash_recycle_bin",
]

REQUIRED_MANIFEST_KEYS = {
    "file", "id", "name_en", "name_ko", "camera",
    "tiles", "canvas", "opaque_size", "facing", "description", "tags",
}


def check_image_palette_and_alpha(img: Image.Image) -> Tuple[int, int, int]:
    """Return (off_palette_opaque, bad_alpha, pure_black_count)."""
    px = img.load()
    w, h = img.size
    off_pal = 0
    bad_alpha = 0
    pure_black = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            elif a == 255:
                if (r, g, b) == (0, 0, 0):
                    pure_black += 1
                if (r, g, b, 255) not in VALID_OPAQUE:
                    off_pal += 1
            elif (r, g, b, a) == SHADOW:
                continue
            else:
                bad_alpha += 1
    return off_pal, bad_alpha, pure_black


def check_outer_outline(img: Image.Image) -> Tuple[float, float, int]:
    """Compare mean luminance of outer opaque contour vs interior opaque pixels,
    and count outer pixels that are bright (lum > 60)."""
    px = img.load()
    w, h = img.size
    outer_lums = []
    inner_lums = []
    bright_outer = 0
    for y in range(h):
        for x in range(w):
            c = px[x, y]
            if c[3] != 255:
                continue
            is_outer = False
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if not (0 <= nx < w and 0 <= ny < h) or px[nx, ny][3] != 255:
                    is_outer = True
                    break
            lv = lum(c)
            if is_outer:
                outer_lums.append(lv)
                if lv > 60:
                    bright_outer += 1
            else:
                inner_lums.append(lv)
    mean_outer = sum(outer_lums) / max(1, len(outer_lums))
    mean_inner = sum(inner_lums) / max(1, len(inner_lums))
    return mean_outer, mean_inner, bright_outer


def floor_spike_ratio(img: Image.Image, threshold: float = 45.0) -> float:
    """Fraction of adjacent pixel pairs with Euclidean RGB distance > threshold."""
    px = img.load()
    w, h = img.size
    spikes = 0
    total = 0
    for y in range(h):
        for x in range(w):
            c1 = px[x, y]
            if x + 1 < w:
                c2 = px[x + 1, y]
                d = math.dist(c1[:3], c2[:3])
                total += 1
                if d > threshold:
                    spikes += 1
            if y + 1 < h:
                c2 = px[x, y + 1]
                d = math.dist(c1[:3], c2[:3])
                total += 1
                if d > threshold:
                    spikes += 1
    return spikes / max(1, total)


def opaque_bbox(img: Image.Image) -> Tuple[int, int, int, int]:
    px = img.load()
    w, h = img.size
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] == 255:
                xs.append(x)
                ys.append(y)
    if not xs:
        return (0, 0, 0, 0)
    return (min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1)


def main() -> int:
    failures: List[str] = []

    # 1. Check tiles/
    tile_files = sorted(TILES_DIR.glob("*.png"))
    if len(tile_files) < 18:
        failures.append(f"Expected >= 18 tiles, found {len(tile_files)}")

    floor_metrics: Dict[str, float] = {}
    tile_off_pal_total = 0
    for tf in tile_files:
        img = Image.open(tf).convert("RGBA")
        if img.size != (16, 16):
            failures.append(f"Tile {tf.name}: expected 16x16, got {img.size}")
        off_pal, bad_a, pure_blk = check_image_palette_and_alpha(img)
        tile_off_pal_total += off_pal
        if off_pal or bad_a or pure_blk:
            failures.append(
                f"Tile {tf.name}: off_pal={off_pal}, bad_alpha={bad_a}, pure_black={pure_blk}"
            )
        if tf.name.startswith("floor_") and tf.name != "floor_entrance_mat.png":
            ratio = floor_spike_ratio(img)
            floor_metrics[tf.name] = ratio
            if ratio > 0.08:
                failures.append(f"Floor {tf.name}: adjacent diff spike ratio {ratio:.4f} > 0.08")

    # 2. Check objects/
    obj_files = sorted(OBJECTS_DIR.glob("*.png"))
    found_ids = {p.stem for p in obj_files}
    missing = [oid for oid in REQUIRED_OBJECTS if oid not in found_ids]
    if missing:
        failures.append(f"Missing required objects: {missing}")

    obj_metrics = []
    obj_off_pal_total = 0
    for of in obj_files:
        img = Image.open(of).convert("RGBA")
        w, h = img.size
        if w % 16 != 0 or h % 16 != 0 or w == 0 or h == 0:
            failures.append(f"Object {of.name}: canvas {w}x{h} not a positive 16px multiple")
        off_pal, bad_a, pure_blk = check_image_palette_and_alpha(img)
        obj_off_pal_total += off_pal
        if off_pal or bad_a or pure_blk:
            failures.append(
                f"Object {of.name}: off_pal={off_pal}, bad_alpha={bad_a}, pure_black={pure_blk}"
            )
        bx, by, bw, bh = opaque_bbox(img)
        bbox_ratio = (bw * bh) / (w * h)
        if bbox_ratio < 0.65:
            failures.append(
                f"Object {of.name}: opaque bbox {bw}x{bh} fills {bbox_ratio*100:.1f}% < 65% of {w}x{h}"
            )
        mean_outer, mean_inner, bright_outer = check_outer_outline(img)
        if bright_outer > 0:
            failures.append(
                f"Object {of.name}: {bright_outer} outer-edge pixels have luminance > 60 (missing dark outline)"
            )
        if mean_outer >= mean_inner:
            failures.append(
                f"Object {of.name}: outer contour lum {mean_outer:.1f} >= interior lum {mean_inner:.1f}"
            )
        obj_metrics.append((of.stem, f"{w}x{h}", f"{bw}x{bh}", bbox_ratio, mean_outer, mean_inner))

    # 3. Check manifest.json
    manifest_path = OUT_ROOT / "manifest.json"
    if not manifest_path.exists():
        failures.append("Missing manifest.json")
    else:
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        if len(manifest) != 20:
            failures.append(f"manifest.json: expected 20 entries, got {len(manifest)}")
        manifest_ids = set()
        for entry in manifest:
            missing_keys = REQUIRED_MANIFEST_KEYS - set(entry.keys())
            if missing_keys:
                failures.append(f"manifest entry {entry.get('id')}: missing keys {missing_keys}")
            manifest_ids.add(entry.get("id"))
            fp = OUT_ROOT / entry["file"]
            if not fp.exists():
                failures.append(f"manifest file missing: {entry['file']}")
            else:
                im = Image.open(fp).convert("RGBA")
                _, _, bw, bh = opaque_bbox(im)
                if entry["canvas"] != [im.width, im.height]:
                    failures.append(f"manifest {entry['id']}: canvas mismatch")
                if entry["opaque_size"] != [bw, bh]:
                    failures.append(f"manifest {entry['id']}: opaque_size mismatch ({entry['opaque_size']} vs {[bw, bh]})")
        if set(REQUIRED_OBJECTS) - manifest_ids:
            failures.append(f"manifest missing IDs: {set(REQUIRED_OBJECTS) - manifest_ids}")

    # 4. Check notes.txt, preview, demo maps
    notes_path = OUT_ROOT / "notes.txt"
    if not notes_path.exists():
        failures.append("Missing notes.txt")
    else:
        lines = [ln.strip() for ln in notes_path.read_text(encoding="utf-8").splitlines() if ln.strip()]
        if not lines or lines[0] != "gemini-4-neon high":
            failures.append(f"notes.txt line 1 must be 'gemini-4-neon high', got: {lines[:1]}")
        if len(lines) < 21:
            failures.append(f"notes.txt expected 21 lines (header + 20 objects), got {len(lines)}")

    for fname, expected_size in [
        ("preview_2x_on_gray.png", None),
        ("demo_modern_pcbang.png", (480, 352)),
        ("demo_modern_pcbang_2x.png", (960, 704)),
    ]:
        p = OUT_ROOT / fname
        if not p.exists():
            failures.append(f"Missing {fname}")
        elif expected_size is not None:
            im = Image.open(p)
            if im.size != expected_size:
                failures.append(f"{fname}: expected {expected_size}, got {im.size}")

    # Print detailed summary
    print("=== modern_pcbang Automated Checker ===")
    print(f"Tiles checked:   {len(tile_files)} (off-palette opaque pixels: {tile_off_pal_total})")
    print("Floor calmness (spike ratio <= 0.08):")
    for fn, ratio in sorted(floor_metrics.items()):
        print(f"  - {fn:<26s}: {ratio:.4f} ({'OK' if ratio <= 0.08 else 'FAIL'})")
    print(f"Objects checked: {len(obj_files)} (off-palette opaque pixels: {obj_off_pal_total})")
    for oid, canv, obb, br, mo, mi in obj_metrics:
        print(f"  - {oid:<24s} canvas={canv:<5s} opaque={obb:<5s} ({br*100:5.1f}%)  outline_lum={mo:4.1f} < inner={mi:5.1f}")

    if failures:
        print("\nFAILURES:")
        for err in failures:
            print(f"  [FAIL] {err}")
        return 1

    print("\nRESULT: 100% PASS (0 failures)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
