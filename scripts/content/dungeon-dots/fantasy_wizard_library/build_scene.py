#!/usr/bin/env python3
"""Build preview_2x_on_gray.png, 30x22 playable demo map (1x & 2x), manifest.json, notes.txt."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from build_objects import build_all_objects
from palette import OUT_DIR, REFS_DIR

TILES_DIR = OUT_DIR / "tiles"
OBJECTS_DIR = OUT_DIR / "objects"

GRAY_BG = (0x76, 0x76, 0x70, 255)


def load_beodeul_char_1x() -> Image.Image:
    """Downscale ref_beodeul_char_4x.png (88x100) by exact 4x nearest -> native 22x25 Beodeul character."""
    src = Image.open(REFS_DIR / "ref_beodeul_char_4x.png").convert("RGBA")
    w, h = src.size
    return src.resize((w // 4, h // 4), Image.Resampling.NEAREST)


def build_contact_sheet(obj_meta: list[dict]) -> Path:
    """Build blind contact sheet preview_2x_on_gray.png on #767670 gray.

    Header row: 2x & 1x Beodeul scale character (22x25 native).
    Grid: 5 columns x 4 rows showing EVERY object at enlarged 2x AND native 1x right beside it + code/name.
    """
    char_1x = load_beodeul_char_1x()
    char_2x = char_1x.resize((char_1x.width * 2, char_1x.height * 2), Image.Resampling.NEAREST)

    cols = 5
    rows = 4
    cell_w = 196
    cell_h = 112
    header_h = 78
    pad = 12
    sheet_w = pad * 2 + cols * cell_w
    sheet_h = pad * 2 + header_h + rows * cell_h

    sheet = Image.new("RGBA", (sheet_w, sheet_h), GRAY_BG)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    # Header band with scale character (2x and 1x right beside each other)
    draw.rectangle([pad, pad, sheet_w - pad - 1, pad + header_h - 6], fill=(0x66, 0x66, 0x60, 255), outline=(0x54, 0x54, 0x4E, 255))
    hx = pad + 14
    hy = pad + 10
    sheet.alpha_composite(char_2x, (hx, hy))
    sheet.alpha_composite(char_1x, (hx + char_2x.width + 10, hy + char_2x.height - char_1x.height))
    tx = hx + char_2x.width + char_1x.width + 26
    draw.text((tx, hy + 4), "BEODEUL SCALE REFERENCE: 170 cm = 22x25 px (2x left, native 1x right)", fill=(245, 245, 240, 255), font=font)
    draw.text((tx, hy + 20), "FANTASY WIZARD LIBRARY - 20 Objects Contact Sheet (each cell: 2x enlarged left + native 1x right)", fill=(225, 225, 215, 255), font=font)
    draw.text((tx, hy + 36), "BG #767670 | 16x16 RM2000 Tiles | Locked 70-color Beodeul Palette | Shadow #4c557f@85", fill=(205, 205, 195, 255), font=font)

    # Object cells
    for idx, meta in enumerate(obj_meta):
        r = idx // cols
        c = idx % cols
        x0 = pad + c * cell_w
        y0 = pad + header_h + r * cell_h
        # Subtle cell frame
        draw.rectangle([x0 + 2, y0 + 2, x0 + cell_w - 4, y0 + cell_h - 4], fill=GRAY_BG, outline=(0x64, 0x64, 0x5E, 255))

        code = f"#{idx + 1:02d} [{meta['camera']}] {meta['canvas']}"
        draw.text((x0 + 8, y0 + 6), code, fill=(240, 240, 232, 255), font=font)
        draw.text((x0 + 8, y0 + 18), meta["id"], fill=(215, 222, 210, 255), font=font)

        im_1x = Image.open(OUT_DIR / meta["file"]).convert("RGBA")
        im_2x = im_1x.resize((im_1x.width * 2, im_1x.height * 2), Image.Resampling.NEAREST)

        # Bottom-align both 2x and 1x on a common baseline inside the cell
        baseline_y = y0 + cell_h - 12
        gap = 12
        total_w = im_2x.width + gap + im_1x.width
        start_x = x0 + (cell_w - total_w) // 2
        # Subtle baseline guide
        draw.line([(x0 + 10, baseline_y), (x0 + cell_w - 12, baseline_y)], fill=(0x62, 0x62, 0x5C, 255))
        sheet.alpha_composite(im_2x, (start_x, baseline_y - im_2x.height))
        sheet.alpha_composite(im_1x, (start_x + im_2x.width + gap, baseline_y - im_1x.height))

    out_path = OUT_DIR / "preview_2x_on_gray.png"
    sheet.save(out_path)
    return out_path


def build_demo_map() -> tuple[Path, Path]:
    """Assemble cohesive 30x22 playable Wizard Tower & Grand Library map (480x352 1x + 960x704 2x).

    4 Zones with clear 2-tile walkways & 3 native 1x Beodeul characters for scale:
      - NW (cols 1..12, rows 3..10) : Grand Bookstack Gallery (warm weathered oak floor)
      - NE (cols 17..28, rows 3..10): Astral Orrery Sanctum (cool grey stone flagstones, rune rug, lancet windows)
      - SW (cols 1..12, rows 13..20): Cozy Hearth Reading Room (oak floor, lit stone fireplace, reading & round tables)
      - SE (cols 17..28, rows 13..20): Alchemy & Potion Workshop + Stone Tower Stairs (dark slate vault floor)
      - Center Cross-Axis (cols 13..16 & rows 11..12): Grand Nave w/ Crimson-Gold Runner Carpet & Stone Cross-Gallery
    """
    COLS, ROWS = 30, 22
    TW = 16
    img = Image.new("RGBA", (COLS * TW, ROWS * TW), (0x1C, 0x1C, 0x26, 255))

    tiles = {p.stem: Image.open(p).convert("RGBA") for p in TILES_DIR.glob("*.png")}
    objs = {p.stem: Image.open(p).convert("RGBA") for p in OBJECTS_DIR.glob("*.png")}

    def put_tile(tx: int, ty: int, name: str) -> None:
        img.alpha_composite(tiles[name], (tx * TW, ty * TW))

    def put_obj(tx: int, ty: int, name: str, dx: int = 0, dy: int = 0) -> None:
        """Place object whose top-left tile is (tx, ty)."""
        img.alpha_composite(objs[name], (tx * TW + dx, ty * TW + dy))

    # 1. Base floors per zone
    for ty in range(ROWS):
        for tx in range(COLS):
            checker = (tx + ty) % 2 == 0
            # NW & SW: warm weathered oak planks
            if 1 <= tx <= 12 and (3 <= ty <= 10 or 13 <= ty <= 20):
                put_tile(tx, ty, "floor_oak_plank_a" if checker else "floor_oak_plank_b")
            # SE: dark slate vault floor
            elif 17 <= tx <= 28 and 13 <= ty <= 20:
                put_tile(tx, ty, "floor_vault_slate_a" if checker else "floor_vault_slate_b")
            # NE Sanctum & Central Grand Nave & Cross-Gallery: cool dressed grey flagstones
            else:
                put_tile(tx, ty, "floor_stone_a" if checker else "floor_stone_b")

    # Stone border trim between oak wings and central stone nave
    for ty in range(3, 21):
        if ty not in (11, 12):
            put_tile(13, ty, "floor_stone_border")
            put_tile(16, ty, "floor_stone_border")

    # 2. Central Grand Nave Crimson-Gold Runner Carpet (cols 14..15, rows 4..20)
    for ty in range(4, 21):
        if ty == 4:
            put_tile(14, ty, "carpet_crimson_corner_nw")
            put_tile(15, ty, "carpet_crimson_corner_ne")
        elif ty == 20:
            put_tile(14, ty, "carpet_crimson_corner_sw")
            put_tile(15, ty, "carpet_crimson_corner_se")
        else:
            put_tile(14, ty, "carpet_crimson_edge_w")
            put_tile(15, ty, "carpet_crimson_edge_e")

    # Small cozy crimson hearth carpet in SW Reading Room (cols 5..8, rows 15..16)
    put_tile(5, 15, "carpet_crimson_corner_nw")
    put_tile(6, 15, "carpet_crimson_edge_n")
    put_tile(7, 15, "carpet_crimson_edge_n")
    put_tile(8, 15, "carpet_crimson_corner_ne")
    put_tile(5, 16, "carpet_crimson_corner_sw")
    put_tile(6, 16, "carpet_crimson_edge_s")
    put_tile(7, 16, "carpet_crimson_edge_s")
    put_tile(8, 16, "carpet_crimson_corner_se")

    # 3. Outer Perimeter Walls (RM2000 thick 3-row north wall: cap + upper + lower)
    for tx in range(COLS):
        put_tile(tx, 0, "wall_cap_top")
        put_tile(tx, ROWS - 1, "wall_cap_top")
    for ty in range(ROWS):
        put_tile(0, ty, "wall_cap_top")
        put_tile(COLS - 1, ty, "wall_cap_top")

    # North interior wall face (row 1 upper, row 2 lower)
    for tx in range(1, COLS - 1):
        if tx in (12, 13, 16, 17):
            put_tile(tx, 1, "wall_pillar_stone")
            put_tile(tx, 2, "wall_pillar_stone")
        elif tx in (19, 22, 25):
            # Symmetrical Gothic lancet windows in NE Astral Sanctum
            put_tile(tx, 1, "wall_lancet_window")
            put_tile(tx, 2, "wall_stone_lower")
        elif tx in (4, 8):
            # Lancet windows in NW Grand Bookstack Gallery
            put_tile(tx, 1, "wall_lancet_window")
            put_tile(tx, 2, "wall_stone_lower")
        elif 1 <= tx <= 11:
            put_tile(tx, 1, "wall_timber_upper")
            put_tile(tx, 2, "wall_stone_lower")
        else:
            put_tile(tx, 1, "wall_stone_upper")
            put_tile(tx, 2, "wall_stone_lower")

    # Grand Southern Entrance Archway opening in row 21 (cols 14..15)
    put_tile(14, 21, "carpet_crimson_edge_w")
    put_tile(15, 21, "carpet_crimson_edge_e")
    put_tile(13, 21, "wall_pillar_stone")
    put_tile(16, 21, "wall_pillar_stone")

    # 4. Interior Partition Walls (separating N and S wings, leaving wide 2-tile doorways & clear cross-walkways!)
    # West partition wall along row 11..12? Wait: keep rows 10..12 clean!
    # Let's place short stone divider piers at row 11 (upper) / row 12 (lower) ONLY on cols 1..4 and 9..11 (west),
    # leaving a grand 4-tile open passage at cols 5..8 AND full 2-tile central walkways!
    # Actually even cleaner for RM2000 flow: place the north wall of SW/SE rooms on rows 12 (cap) / 13 (upper) / 14 (lower)
    # Wait: let's check row budget (rows 0..21):
    #   North rooms: rows 3..9 (7 tiles tall! Plenty of room for 2x2 shelves + 2-tile walkway + mid-room props)
    #   Cross-walkway: rows 10..11 (2 full clear tiles wide!)
    #   Divider wall: row 12 (cap) & row 13 (stone wall face) with wide 3-tile arched openings!
    #   South rooms: rows 14..20 (7 tiles tall! Fireplace on row 13-14, reading tables & alchemy workshop!)
    # Let's repaint rows 10..11 across cols 1..28 as clean stone cross-gallery walkway!
    for tx in range(1, COLS - 1):
        if tx in (14, 15):
            continue  # keep central crimson runner carpet continuous!
        for ty in (10, 11):
            put_tile(tx, ty, "floor_stone_a" if (tx + ty) % 2 == 0 else "floor_stone_b")

    # Divider wall separating N & S wings at row 12 (stone upper) & row 13 (stone lower),
    # with wide 2-tile openings connecting each south room directly to the cross-gallery!
    # West divider: wall on cols 1..9 (fireplace sits centered at cols 5..6!), wide open doorway at cols 10..12!
    for tx in range(1, 10):
        put_tile(tx, 12, "wall_timber_upper" if tx not in (1, 9) else "wall_pillar_stone")
        put_tile(tx, 13, "wall_stone_lower" if tx not in (1, 9) else "wall_pillar_stone")
    # Arch doorway cap on col 10? Keep cols 10..12 completely open 3-tile stone threshold for effortless navigation!
    put_tile(10, 12, "floor_stone_border")
    put_tile(11, 12, "floor_stone_border")
    put_tile(12, 12, "floor_stone_border")

    # East divider: wide open 3-tile passage at cols 17..19, alchemy north wall at cols 20..28!
    put_tile(17, 12, "floor_stone_border")
    put_tile(18, 12, "floor_stone_border")
    put_tile(19, 12, "floor_stone_border")
    for tx in range(20, 29):
        put_tile(tx, 12, "wall_stone_upper" if tx not in (20, 28) else "wall_pillar_stone")
        put_tile(tx, 13, "wall_stone_lower" if tx not in (20, 28) else "wall_pillar_stone")

    # Arched northern grand sanctum doorway motif in the central nave wall (cols 14..15, rows 1..2)
    put_tile(14, 1, "wall_arch_door_top")
    put_tile(15, 1, "wall_arch_door_top")
    put_tile(14, 2, "wall_arch_door_bot")
    put_tile(15, 2, "wall_arch_door_bot")

    # Stone tower spiral stairwell in SE Alchemy wing alcove (cols 27..28, rows 14..15)
    put_tile(27, 14, "stairs_stone_up")
    put_tile(28, 14, "stairs_stone_down")

    # 5. Place Flat Floor Objects first (underneath standing objects)
    # NE Astral Sanctum: Arcane Rune Rug (3x2 tiles at cols 21..23, rows 6..7)
    put_obj(21, 6, "arcane_rune_rug")

    # 6. Place Standing / Furniture / Slender Objects in clean back-to-front Y order!
    # --- ROW 1..2 WALL DECOR (banners & north wall furniture) ---
    # NW Grand Bookstack Gallery (north wall)
    put_obj(1, 2, "bookshelf_tall_full")
    put_obj(3, 2, "bookshelf_scroll_rack")
    put_obj(5, 2, "grimoire_cabinet")
    put_obj(7, 1, "wall_banner_crimson")
    put_obj(9, 2, "bookshelf_tall_full")
    put_obj(11, 2, "brass_candelabra")

    # Central Nave flanking banners & candelabra
    put_obj(13, 1, "wall_banner_crimson")
    put_obj(16, 1, "wall_banner_crimson")

    # NE Astral Orrery Sanctum (north wall)
    put_obj(18, 2, "bookshelf_scroll_rack")
    put_obj(20, 2, "scrying_crystal_pedestal")
    put_obj(22, 2, "brass_candelabra")
    put_obj(24, 2, "scrying_crystal_pedestal")
    put_obj(26, 2, "grimoire_cabinet")
    put_obj(28, 2, "bookshelf_scroll_rack")

    # --- MID NORTH WINGS (rows 5..9, keeping >= 2-tile walkways!) ---
    # NW Bookstack Gallery: mid-gallery bookcase island + lectern + reading desk nook
    put_obj(2, 6, "bookshelf_tall_full")
    put_obj(5, 6, "gilded_lectern_tome")
    put_obj(7, 7, "wooden_stool")
    put_obj(9, 5, "oak_study_chair")
    put_obj(11, 5, "oak_study_chair")
    put_obj(9, 6, "reading_table_long")
    put_obj(10, 7, "oak_study_chair")

    # NE Astral Sanctum: Grand Brass Orrery centered atop the arcane rune rug + treasure chest in corner
    put_obj(21, 4, "brass_orrery_stand", dx=8)  # centered cleanly across cols 21..23!
    put_obj(18, 7, "brass_candelabra")
    put_obj(26, 7, "brass_candelabra")
    put_obj(27, 5, "treasure_chest_bound")

    # --- SOUTH DIVIDER WALL PROPS (rows 12..14) ---
    # SW Cozy Hearth Reading Room north wall
    put_obj(1, 13, "bookshelf_tall_full")
    put_obj(3, 12, "wall_banner_crimson")
    put_obj(5, 13, "stone_fireplace_lit")
    put_obj(7, 13, "bookshelf_tall_full")

    # SE Alchemy & Potion Workshop north wall
    put_obj(20, 13, "potion_alembic_shelf")
    put_obj(22, 13, "bookshelf_scroll_rack")
    put_obj(23, 13, "potion_alembic_shelf")
    put_obj(25, 13, "brass_candelabra")

    # --- SW COZY HEARTH READING ROOM INTERIOR (rows 16..20) ---
    put_obj(2, 18, "reading_table_long")
    put_obj(2, 17, "oak_study_chair")
    put_obj(4, 17, "oak_study_chair")
    put_obj(3, 19, "oak_study_chair")
    put_obj(9, 17, "study_table_round")
    put_obj(8, 18, "wooden_stool")
    put_obj(11, 18, "wooden_stool")
    put_obj(1, 16, "brass_candelabra")
    put_obj(12, 15, "gilded_lectern_tome")

    # --- SE ALCHEMY & POTION WORKSHOP INTERIOR (rows 16..20) ---
    put_obj(21, 16, "alchemy_cauldron_hearth")
    put_obj(18, 17, "alchemy_workbench")
    put_obj(18, 18, "wooden_stool")
    put_obj(24, 17, "alchemy_workbench")
    put_obj(24, 18, "wooden_stool")
    put_obj(26, 19, "wooden_crates_stack")
    put_obj(17, 19, "oak_barrel_hooped")
    put_obj(18, 19, "oak_barrel_hooped")
    put_obj(20, 19, "treasure_chest_bound")

    # --- CENTRAL GRAND NAVE FLANKING ACCENTS ---
    put_obj(13, 17, "brass_candelabra")
    put_obj(16, 17, "brass_candelabra")

    # 7. Place 3 Native 1x Beodeul Scale Characters (22x25) naturally on walkable tiles!
    char_1x = load_beodeul_char_1x()
    # Char 1: NW Grand Bookstack Gallery standing beside the gilded lectern (tile col 6, row 7)
    img.alpha_composite(char_1x, (6 * TW - 3, 7 * TW - 9))
    # Char 2: NE Astral Orrery Sanctum admiring the brass orrery from south edge of rune rug (col 22, row 8)
    img.alpha_composite(char_1x, (22 * TW - 3, 8 * TW - 9))
    # Char 3: SW Cozy Hearth Reading Room standing warmly before the fireplace (col 6, row 16)
    img.alpha_composite(char_1x, (6 * TW - 3, 16 * TW - 9))

    out_1x = OUT_DIR / "demo_fantasy_wizard_library.png"
    out_2x = OUT_DIR / "demo_fantasy_wizard_library_2x.png"
    img.save(out_1x)
    img.resize((img.width * 2, img.height * 2), Image.Resampling.NEAREST).save(out_2x)
    return out_1x, out_2x


def write_manifest_and_notes(obj_meta: list[dict], tile_count: int) -> tuple[Path, Path]:
    manifest_payload = {
        "pack_id": "fantasy_wizard_library",
        "title": "Beodeul Wizard Tower, Grand Library & Alchemy Workshop",
        "title_ko": "버들항 마법탑 · 대서고와 연금공방",
        "style": "Beodeul RM2000/2003 16x16px (0.13 px/cm, 170cm char = 22px)",
        "palette_file": "palette_beodeul_library.json",
        "tile_count": tile_count,
        "object_count": len(obj_meta),
        "demo_map": {
            "tiles": "30x22",
            "native_1x": "demo_fantasy_wizard_library.png",
            "preview_2x": "demo_fantasy_wizard_library_2x.png",
        },
        "contact_sheet": "preview_2x_on_gray.png",
        "objects": [
            {k: v for k, v in item.items() if k not in ("note", "score")}
            for item in obj_meta
        ],
    }
    manifest_path = OUT_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest_payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    note_lines = ["gemini-4-neon high"]
    for item in obj_meta:
        note_lines.append(
            f"{item['id']} ({item['canvas']}, opaque {item['opaque_size']}, {item['camera']}): "
            f"{item['note']} [self-score {item['score']}/10]"
        )
    notes_path = OUT_DIR / "notes.txt"
    notes_path.write_text("\n".join(note_lines) + "\n", encoding="utf-8")
    return manifest_path, notes_path


if __name__ == "__main__":
    obj_meta = build_all_objects()
    cs = build_contact_sheet(obj_meta)
    d1, d2 = build_demo_map()
    mf, nt = write_manifest_and_notes(obj_meta, len(list(TILES_DIR.glob("*.png"))))
    print(f"Contact sheet : {cs}")
    print(f"Demo 1x / 2x  : {d1} / {d2}")
    print(f"Manifest/Notes: {mf} / {nt}")
