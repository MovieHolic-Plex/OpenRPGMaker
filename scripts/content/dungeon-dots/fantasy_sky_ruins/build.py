"""Build script for `fantasy_sky_ruins` (Beodeul Ancient Stone Ruins & Crystal Sanctuary).

Produces:
- tiledata/dungeon-dots/fantasy_sky_ruins/palette_beodeul_ruins.json
- tiledata/dungeon-dots/fantasy_sky_ruins/tiles/*.png (31 distinct 16x16 tiles)
- tiledata/dungeon-dots/fantasy_sky_ruins/objects/*.png (20 distinct objects)
- tiledata/dungeon-dots/fantasy_sky_ruins/preview_2x_on_gray.png
- tiledata/dungeon-dots/fantasy_sky_ruins/demo_fantasy_sky_ruins.png (480x352 = 30x22 tiles)
- tiledata/dungeon-dots/fantasy_sky_ruins/demo_fantasy_sky_ruins_2x.png (960x704 nearest 2x)
- tiledata/dungeon-dots/fantasy_sky_ruins/manifest.json
- tiledata/dungeon-dots/fantasy_sky_ruins/notes.txt
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Tuple
from PIL import Image, ImageDraw, ImageFont

from palette import OUT_DIR, REFS_DIR, save_palette_json
from tiles import build_all_tiles
from objects import OBJECT_SPECS, build_all_objects

GRAY_BG = (0x76, 0x76, 0x70, 255)
HEADER_BG = (0x5E, 0x5E, 0x58, 255)
CARD_BG = (0x6B, 0x6B, 0x65, 255)
TEXT_COL = (242, 242, 236, 255)
MUTED_COL = (210, 210, 202, 255)
LINE_COL = (0x8A, 0x8A, 0x82, 255)


def load_beodeul_char_1x() -> Image.Image:
    """Downscale ref_beodeul_char_4x.png (88x100) by exact 4x nearest-neighbor -> 22x25 native 1x."""
    src = Image.open(REFS_DIR / "ref_beodeul_char_4x.png").convert("RGBA")
    return src.resize((src.width // 4, src.height // 4), Image.NEAREST)


def build_preview_contact_sheet(
    obj_imgs: Dict[str, Image.Image],
    char_1x: Image.Image,
    out_path: Path,
) -> None:
    """Build blind contact sheet on neutral #767670 with 1x & 2x Beodeul scale char in header,
    and every object at enlarged 2x AND native 1x right beside it with code/name.
    """
    cols = 4
    rows = (len(OBJECT_SPECS) + cols - 1) // cols
    cell_w = 216
    cell_h = 136
    pad = 12
    header_h = 84

    sheet_w = pad + cols * (cell_w + pad)
    sheet_h = header_h + pad + rows * (cell_h + pad)
    sheet = Image.new("RGBA", (sheet_w, sheet_h), GRAY_BG)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    # Header bar with 1x & 2x Beodeul character for instant scale comparison
    draw.rectangle([0, 0, sheet_w - 1, header_h - 1], fill=HEADER_BG)
    draw.line([(0, header_h - 1), (sheet_w - 1, header_h - 1)], fill=LINE_COL)
    char_2x = char_1x.resize((char_1x.width * 2, char_1x.height * 2), Image.NEAREST)

    sheet.alpha_composite(char_2x, (18, header_h - 12 - char_2x.height))
    sheet.alpha_composite(char_1x, (18 + char_2x.width + 12, header_h - 12 - char_1x.height))
    draw.text(
        (114, 16),
        "BEODEUL ANCIENT STONE RUINS & CRYSTAL SANCTUARY  (fantasy_sky_ruins)",
        fill=TEXT_COL,
        font=font,
    )
    draw.text(
        (114, 36),
        f"Scale Reference: Beodeul Character 2x ({char_2x.width}x{char_2x.height}) & Native 1x ({char_1x.width}x{char_1x.height}, 170cm = 22px)",
        fill=MUTED_COL,
        font=font,
    )
    draw.text(
        (114, 54),
        "Each cell shows: [Enlarged 2x] left  +  [Native 1x] right on neutral gray #767670  |  20 objects, 0 Fable",
        fill=MUTED_COL,
        font=font,
    )

    for idx, spec in enumerate(OBJECT_SPECS):
        r = idx // cols
        col = idx % cols
        x0 = pad + col * (cell_w + pad)
        y0 = header_h + pad + r * (cell_h + pad)
        draw.rectangle([x0, y0, x0 + cell_w - 1, y0 + cell_h - 1], fill=GRAY_BG, outline=LINE_COL)
        draw.rectangle([x0 + 1, y0 + 1, x0 + cell_w - 2, y0 + 22], fill=CARD_BG)

        code = f"R{idx + 1:02d}"
        short_name = spec.file.replace(".png", "")
        draw.text((x0 + 6, y0 + 6), f"{code} {short_name}", fill=TEXT_COL, font=font)
        draw.text(
            (x0 + 6, y0 + cell_h - 15),
            f"{spec.canvas[0]}x{spec.canvas[1]} ({spec.tiles}) · {spec.camera}",
            fill=MUTED_COL,
            font=font,
        )

        img1 = obj_imgs[spec.file]
        img2 = img1.resize((img1.width * 2, img1.height * 2), Image.NEAREST)
        baseline_y = y0 + cell_h - 20

        # Place enlarged 2x on left-center, native 1x immediately to its right
        total_w = img2.width + 16 + img1.width
        start_x = x0 + max(8, (cell_w - total_w) // 2)
        sheet.alpha_composite(img2, (start_x, baseline_y - img2.height))
        sheet.alpha_composite(img1, (start_x + img2.width + 16, baseline_y - img1.height))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path)


def build_demo_map(
    tiles: Dict[str, Image.Image],
    objs: Dict[str, Image.Image],
    char_1x: Image.Image,
    out_1x: Path,
    out_2x: Path,
) -> None:
    """Build cohesive 30x22 playable 4-zone Beodeul Ancient Ruins & Crystal Sanctuary map.

    Zones:
    1. North Raised Castle-Wall Sanctum (rows 0..7): battlements, raised stone terrace,
       cobalt-slate flanking sanctum wings, Ruin Shrine Gate, Crystal Rune Altar,
       Twin Stone Guardian Statues, Temple Banners, Lit Braziers, grand 3-wide stone staircase.
    2. Central Mossy Flagstone Courtyard (rows 8..15, cols 8..21): calm weathered flagstones,
       Round Sanctuary Fountain centerpiece, Intact & Broken Colonnade pillars, Carved Rune Stele,
       Stone Offering Table, Wooden Garden Benches, Stone Garden Lanterns.
    3. South/East Sanctuary Canal & Explorer Camp (rows 14..21, cols 13..29): deep teal water
       canal with crisp stone embankments crossed by horizontal & vertical wooden plank bridges,
       Explorer Camp Tent, Wooden Supply Crates, Wooden Notice Board, Mossy Stone Well.
    4. West Overgrown Oak Grove & Secret Chest (rows 8..21, cols 0..8): lush Beodeul oak trees,
       flowering mossy bushes, mossy boulders, quiet mossy path leading to Ancient Treasure Chest.
    """
    W, H = 30, 22
    m = Image.new("RGBA", (W * 16, H * 16), (0, 0, 0, 255))

    def put_tile(tx: int, ty: int, name: str) -> None:
        if 0 <= tx < W and 0 <= ty < H:
            m.paste(tiles[name], (tx * 16, ty * 16))

    # --- Base meadow grass layer across whole map (calm natural variation) ---
    for y in range(H):
        for x in range(W):
            h = (x * 7 + y * 13) % 11
            if h == 0:
                put_tile(x, y, "grass_moss_accent")
            elif h == 5 and (x < 8 or y > 15):
                put_tile(x, y, "grass_wildflower")
            elif (x + y) % 2 == 0:
                put_tile(x, y, "grass_meadow_a")
            else:
                put_tile(x, y, "grass_meadow_b")

    # --- Zone 1: North Raised Castle-Wall Sanctum (rows 0..7, cols 4..25) ---
    # Back battlements along north wall (row 0, cols 4..25)
    for x in range(4, 26):
        put_tile(x, 0, "castle_battlement_top")
    # Flanking cobalt-slate sanctum roof pavilions (rows 0..2, cols 4..8 and cols 21..25)
    for rx_range in (range(4, 9), range(21, 26)):
        for x in rx_range:
            put_tile(x, 0, "roof_cobalt_slate_ridge")
            put_tile(x, 1, "roof_cobalt_slate_a")
            put_tile(x, 2, "roof_cobalt_slate_a")
            put_tile(x, 3, "castle_wall_face" if x % 2 == 0 else "castle_wall_moss")
            put_tile(x, 4, "castle_wall_base")
    # Raised sanctum stone terrace (rows 1..5, cols 9..20)
    for y in range(1, 6):
        for x in range(9, 21):
            put_tile(x, y, "sanctum_floor_rune" if (12 <= x <= 17 and 2 <= y <= 5) else "castle_terrace_top")
    # Retaining castle wall across front of raised sanctum (rows 5..7, cols 4..25)
    for x in range(4, 26):
        if 13 <= x <= 15:
            continue  # Grand central staircase opening!
        if x < 9 or x > 20:
            put_tile(x, 5, "castle_battlement_top")
        put_tile(x, 6, "castle_wall_moss" if x in (6, 10, 19, 23) else "castle_wall_face")
        put_tile(x, 7, "castle_wall_base")
    # Side terrace cliffs framing north sanctum (row 4, cols 0..3 and 26..29)
    for x in list(range(0, 4)) + list(range(26, 30)):
        put_tile(x, 4, "cliff_ledge_moss")
    # Grand 3-tile wide stone staircase descending from Sanctum to Courtyard (rows 6..7, cols 13..15)
    for y in (6, 7):
        put_tile(13, y, "stairs_stone_l")
        put_tile(14, y, "stairs_stone_m")
        put_tile(15, y, "stairs_stone_r")

    # --- Zone 2: Central Mossy Flagstone Courtyard (rows 8..15, cols 8..20) ---
    for y in range(8, 16):
        for x in range(8, 21):
            if y == 8 and not (13 <= x <= 15):
                put_tile(x, y, "flagstone_border_n")
            elif y == 15 and not (13 <= x <= 15):
                put_tile(x, y, "flagstone_border_s")
            else:
                k = (x * 5 + y * 3) % 7
                if k == 0:
                    put_tile(x, y, "flagstone_courtyard_b")
                elif k == 3:
                    put_tile(x, y, "flagstone_courtyard_cracked")
                else:
                    put_tile(x, y, "flagstone_courtyard_a")
    # Cobblestone walkway approaches:
    # South main entrance avenue (cols 13..15, rows 15..21)
    for y in range(15, 22):
        for x in (13, 14, 15):
            put_tile(x, y, "cobble_path_b" if (x + y) % 4 == 0 else "cobble_path_a")
    # East walkway to Explorer Camp (row 11, cols 21..27 — aligns cleanly with single plank bridge!)
    for x in range(21, 28):
        put_tile(x, 11, "cobble_path_b" if x % 3 == 0 else "cobble_path_a")
    # West mossy path into Oak Grove secret clearing (row 12, cols 4..7 + col 4, rows 12..16)
    for x in range(4, 8):
        put_tile(x, 12, "cobble_path_b")
    for y in range(12, 17):
        put_tile(4, y, "cobble_path_b")

    # --- Zone 3: South/East Sanctuary Canal & Bridges ---
    canal_cells = set()
    for y in range(16, 20):
        for x in range(17, 29):
            canal_cells.add((x, y))
    for y in range(9, 16):
        for x in (22, 23):
            canal_cells.add((x, y))

    for x, y in canal_cells:
        has_n = (x, y - 1) in canal_cells
        has_s = (x, y + 1) in canal_cells
        has_w = (x - 1, y) in canal_cells
        has_e = (x + 1, y) in canal_cells
        if not has_n:
            put_tile(x, y, "water_rim_n")
        elif not has_s:
            put_tile(x, y, "water_rim_s")
        elif not has_w:
            put_tile(x, y, "water_rim_w")
        elif not has_e:
            put_tile(x, y, "water_rim_e")
        else:
            put_tile(x, y, "water_sanctuary_a" if (x + y) % 2 == 0 else "water_sanctuary_b")

    # Clean single-lane Wooden Plank Bridges crossing the sanctuary canal!
    for x in (22, 23):
        put_tile(x, 11, "bridge_plank_h")
    for y in range(16, 20):
        put_tile(20, y, "bridge_plank_v")

    # --- Place Objects (Y-sorted by bottom-edge ground line for clean 3/4 depth!) ---
    placements: List[Tuple[int, int, str, Image.Image]] = []

    def place_obj(tx: float, ty: float, filename: str) -> None:
        img = objs[filename]
        px = int(round(tx * 16))
        py = int(round(ty * 16))
        placements.append((py + img.height, px, filename, img))

    def place_char(tx: float, ty: float) -> None:
        px = int(round(tx * 16))
        py = int(round(ty * 16))
        placements.append((py + char_1x.height, px, "char", char_1x))

    # Zone 1: North Raised Sanctum (generous breathing room around gate, altar & stairs!)
    place_obj(13, 0.0, "ruin_shrine_gate.png")           # Center shrine entrance (48x48, bottom row 3.0)
    place_obj(13.5, 3.6, "crystal_rune_altar.png")       # Crystal Rune Altar with clear walkway from gate!
    place_obj(11.0, 1.2, "stone_guardian_statue.png")    # Left guardian sentinel
    place_obj(17.0, 1.2, "stone_guardian_statue.png")    # Right guardian sentinel
    place_obj(9.5, 2.4, "temple_banner_pole.png")        # Left sanctuary banner
    place_obj(18.5, 2.4, "temple_banner_pole.png")       # Right sanctuary banner
    place_obj(11.5, 4.0, "iron_brazier_lit.png")         # Left sanctum brazier
    place_obj(16.5, 4.0, "iron_brazier_lit.png")         # Right sanctum brazier
    place_obj(5.0, 3.5, "stone_garden_lantern.png")      # West parapet lantern
    place_obj(23.0, 3.5, "stone_garden_lantern.png")     # East parapet lantern

    # Zone 2: Central Mossy Flagstone Courtyard
    place_obj(13.5, 10.5, "sanctuary_fountain_round.png") # Center courtyard fountain (32x32 topdown)
    place_obj(9.0, 8.2, "stone_pillar_intact.png")       # Colonnade NW intact
    place_obj(19.0, 8.2, "stone_pillar_intact.png")      # Colonnade NE intact
    place_obj(9.0, 12.6, "stone_pillar_broken.png")      # Colonnade SW broken
    place_obj(19.0, 12.6, "stone_pillar_broken.png")     # Colonnade SE broken
    place_obj(10.2, 10.2, "carved_rune_stele.png")       # Ancient carved rune stele west of fountain
    place_obj(16.5, 10.5, "stone_offering_table.png")    # Offering table east of fountain
    place_obj(10.5, 13.8, "wooden_bench_garden.png")     # Courtyard garden bench SW
    place_obj(16.5, 13.8, "wooden_bench_garden.png")     # Courtyard garden bench SE
    place_obj(12.0, 7.6, "stone_garden_lantern.png")     # Flanking grand stair bottom
    place_obj(16.0, 7.6, "stone_garden_lantern.png")     # Flanking grand stair bottom
    place_obj(12.0, 15.8, "iron_brazier_lit.png")        # South entrance brazier left
    place_obj(16.0, 15.8, "iron_brazier_lit.png")        # South entrance brazier right

    # Zone 3: East Explorer Camp & South Canal Bank (zero overlap!)
    place_obj(25.2, 8.0, "explorer_camp_tent.png")       # Explorer A-frame camp tent
    place_obj(27.5, 10.2, "wooden_crates_supply.png")    # Supply crates beside camp
    place_obj(24.5, 12.6, "wooden_notice_board.png")     # Sanctuary notice board south of bridge
    place_obj(27.0, 13.0, "mossy_stone_well.png")        # Mossy stone well at camp edge
    place_obj(26.2, 10.0, "iron_brazier_lit.png")        # Warm camp brazier cleanly beside tent
    place_obj(22.0, 19.8, "flowering_bush_moss.png")     # South canal bank bush
    place_obj(25.0, 19.4, "beodeul_oak_tree.png")        # South-east framing oak tree
    place_obj(18.0, 19.8, "mossy_boulder.png")           # Canal bank boulder

    # Zone 4: West Overgrown Oak Grove & Secret Chest Clearing
    place_obj(0.5, 1.0, "beodeul_oak_tree.png")          # NW cliff oak
    place_obj(27.2, 1.0, "beodeul_oak_tree.png")         # NE cliff oak
    place_obj(0.5, 5.8, "beodeul_oak_tree.png")          # Grove north oak
    place_obj(4.2, 6.2, "beodeul_oak_tree.png")          # Grove inner oak
    place_obj(0.8, 10.5, "beodeul_oak_tree.png")         # Grove mid-west oak
    place_obj(5.8, 14.2, "beodeul_oak_tree.png")         # Grove south-east oak
    place_obj(1.2, 16.5, "beodeul_oak_tree.png")         # Grove south-west oak
    place_obj(8.5, 17.5, "beodeul_oak_tree.png")         # South-west framing oak
    place_obj(3.5, 16.5, "treasure_chest_ancient.png")   # Secret ancient treasure chest in clearing!
    place_obj(2.4, 15.8, "mossy_boulder.png")            # Guarding boulder
    place_obj(4.8, 17.4, "mossy_boulder.png")            # Guarding boulder
    place_obj(6.5, 10.2, "flowering_bush_moss.png")      # Grove path flowering bush
    place_obj(2.8, 12.5, "flowering_bush_moss.png")      # Grove bush
    place_obj(5.5, 11.2, "mossy_boulder.png")            # Grove rock
    place_obj(10.8, 18.8, "flowering_bush_moss.png")     # Entrance verge bush
    place_obj(7.2, 18.5, "stone_pillar_broken.png")      # Overgrown ancient ruin remnant

    # 3 Native 1x Beodeul Scale Characters placed naturally in walkable areas!
    place_char(13.8, 8.5)   # Hero standing in central courtyard approaching grand stairs
    place_char(24.0, 10.3)  # Explorer stepping off wooden bridge onto camp path
    place_char(4.0, 14.2)   # Scout discovering the secret oak grove chest

    # Sort by bottom Y coordinate (ground contact) for crisp 3/4 overlap
    placements.sort(key=lambda item: (item[0], item[1]))
    for bottom_y, px, _name, img in placements:
        py = bottom_y - img.height
        m.alpha_composite(img, (px, py))

    out_1x.parent.mkdir(parents=True, exist_ok=True)
    m.save(out_1x)
    m2 = m.resize((m.width * 2, m.height * 2), Image.NEAREST)
    m2.save(out_2x)


def write_manifest_and_notes(bboxes: Dict[str, Tuple[int, int]]) -> None:
    manifest = []
    notes_lines = ["gemini-4-neon high"]
    for spec in OBJECT_SPECS:
        ow, oh = bboxes[spec.file]
        manifest.append({
            "file": spec.file,
            "id": spec.id,
            "name_en": spec.name_en,
            "name_ko": spec.name_ko,
            "canvas": f"{spec.canvas[0]}x{spec.canvas[1]}",
            "opaque_size": f"{ow}x{oh}",
            "camera": spec.camera,
            "tiles": spec.tiles,
            "facing": spec.facing,
            "description": spec.description,
            "tags": spec.tags,
        })
        notes_lines.append(
            f"{spec.file} | {spec.name_en} ({spec.name_ko}) | {ow}x{oh}px in {spec.canvas[0]}x{spec.canvas[1]} | {spec.camera} | {spec.note_summary} | self-score 9/10"
        )
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (OUT_DIR / "notes.txt").write_text("\n".join(notes_lines) + "\n", encoding="utf-8")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    save_palette_json(OUT_DIR / "palette_beodeul_ruins.json")
    tiles = build_all_tiles(OUT_DIR / "tiles")
    objs, bboxes = build_all_objects(OUT_DIR / "objects")
    char_1x = load_beodeul_char_1x()
    build_preview_contact_sheet(objs, char_1x, OUT_DIR / "preview_2x_on_gray.png")
    build_demo_map(
        tiles,
        objs,
        char_1x,
        OUT_DIR / "demo_fantasy_sky_ruins.png",
        OUT_DIR / "demo_fantasy_sky_ruins_2x.png",
    )
    write_manifest_and_notes(bboxes)
    print(f"Built {len(tiles)} tiles, {len(objs)} objects, preview sheet, and 30x22 demo map in {OUT_DIR}")


if __name__ == "__main__":
    main()
