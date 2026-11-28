"""Render blind contact sheet preview_2x_on_gray.png and 30x22 playable demo map."""
from __future__ import annotations

from typing import Dict, List, Tuple
from PIL import Image, ImageDraw, ImageFont

from palette import (
    Canvas, OUT_ROOT, TILES_DIR, OBJECTS_DIR, SHADOW,
    load_ref_char_1x,
)
from objects import OBJECT_SPECS

NEUTRAL_GRAY = (118, 118, 112, 255)  # #767670
HEADER_BG = (96, 96, 92, 255)
CARD_BORDER = (86, 86, 82, 255)
TEXT_LIGHT = (242, 242, 238, 255)
TEXT_DIM = (205, 205, 198, 255)


def render_preview_contact_sheet(objs: Dict[str, Canvas]) -> None:
    """Blind contact sheet on neutral gray #767670: every object at 2x + 1x beside it,
    plus 1x & 2x scale reference character in header row."""
    char_1x = load_ref_char_1x()  # 24x32
    char_2x = char_1x.resize((char_1x.width * 2, char_1x.height * 2), Image.Resampling.NEAREST)

    cols = 4
    rows = (len(OBJECT_SPECS) + cols - 1) // cols
    cell_w = 216
    cell_h = 108
    pad = 12
    header_h = 84

    sheet_w = pad * 2 + cols * cell_w + (cols - 1) * pad
    sheet_h = pad * 2 + header_h + pad + rows * cell_h + (rows - 1) * pad

    sheet = Image.new("RGBA", (sheet_w, sheet_h), NEUTRAL_GRAY)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    # Header bar with scale reference character (2x + 1x)
    draw.rectangle([pad, pad, sheet_w - pad - 1, pad + header_h - 1], fill=HEADER_BG, outline=CARD_BORDER)
    draw.text((pad + 12, pad + 10), "modern_pcbang - 20 Objects Blind Contact Sheet (2x + 1x) | Palette Locked (118 colors)", fill=TEXT_LIGHT, font=font)
    draw.text((pad + 12, pad + 26), "Scale Ref: ref_mod1_char (170cm = 22px @ 1x, 24x32 canvas) | Left: 2x, Right: native 1x", fill=TEXT_DIM, font=font)
    draw.text((pad + 12, pad + 44), "Zones: NW Ramen Cafe | NE POS Lobby | SW/Center PC Arena | SE Retro Arcade & VIP", fill=TEXT_DIM, font=font)

    # Paste 2x and 1x character right-aligned in header
    cx2 = sheet_w - pad - 140
    cy2 = pad + (header_h - char_2x.height) // 2
    sheet.alpha_composite(char_2x, (cx2, cy2))
    draw.text((cx2 + 12, pad + header_h - 14), "2x", fill=TEXT_DIM, font=font)

    cx1 = sheet_w - pad - 68
    cy1 = cy2 + char_2x.height - char_1x.height
    sheet.alpha_composite(char_1x, (cx1, cy1))
    draw.text((cx1 + 4, pad + header_h - 14), "1x", fill=TEXT_DIM, font=font)

    # Object grid cells
    y_start = pad + header_h + pad
    for idx, spec in enumerate(OBJECT_SPECS):
        r = idx // cols
        col = idx % cols
        x0 = pad + col * (cell_w + pad)
        y0 = y_start + r * (cell_h + pad)
        draw.rectangle([x0, y0, x0 + cell_w - 1, y0 + cell_h - 1], fill=NEUTRAL_GRAY, outline=CARD_BORDER)

        img_1x = objs[spec["id"]].img
        img_2x = img_1x.resize((img_1x.width * 2, img_1x.height * 2), Image.Resampling.NEAREST)

        # Bottom-align both 2x and 1x on a common baseline inside the cell
        baseline_y = y0 + 76
        x_2x = x0 + 16 + max(0, (96 - img_2x.width) // 2)
        y_2x = baseline_y - img_2x.height
        sheet.alpha_composite(img_2x, (x_2x, y_2x))

        x_1x = x0 + 132 + max(0, (48 - img_1x.width) // 2)
        y_1x = baseline_y - img_1x.height
        sheet.alpha_composite(img_1x, (x_1x, y_1x))

        # Subtle baseline tick
        draw.line([(x0 + 10, baseline_y + 1), (x0 + cell_w - 10, baseline_y + 1)], fill=CARD_BORDER)

        # Label: code name + camera + size
        label1 = f"{idx + 1:02d}. {spec['id']}"
        label2 = f"[{spec['camera']}] {spec['canvas'][0]}x{spec['canvas'][1]}"
        draw.text((x0 + 8, y0 + 80), label1, fill=TEXT_LIGHT, font=font)
        draw.text((x0 + 8, y0 + 93), label2, fill=TEXT_DIM, font=font)

    sheet.save(OUT_ROOT / "preview_2x_on_gray.png")


def render_demo_map(tiles: Dict[str, Canvas], objs: Dict[str, Canvas]) -> List[Tuple[int, int, int, int]]:
    """Render 30x22 tile (480x352 px) playable 4-zone Korean PC Bang map + 2x upscale.
    Returns list of pasted ref_mod1_char bounding boxes (x, y, w, h) for checker."""
    COLS, ROWS = 30, 22
    T = 16
    map_img = Image.new("RGBA", (COLS * T, ROWS * T), (0, 0, 0, 255))

    def put_tile(col: int, row: int, name: str) -> None:
        map_img.paste(tiles[name].img, (col * T, row * T))

    # 1. Fill zone floors first
    for row in range(ROWS):
        for col in range(COLS):
            # NW Ramen Cafe (x=1..12, y=3..8)
            if 1 <= col <= 12 and 3 <= row <= 8:
                put_tile(col, row, "floor_cafe_oak")
            # NE POS Lobby & Entrance (x=13..28, y=3..9)
            elif 13 <= col <= 28 and 3 <= row <= 9:
                put_tile(col, row, "floor_lobby_slate" if (col + row) % 2 == 0 else "floor_lobby_slate_alt")
            # SE Retro Arcade & VIP Alcove (x=20..28, y=10..20)
            elif 20 <= col <= 28 and 10 <= row <= 20:
                if 22 <= col <= 27 and 16 <= row <= 19:
                    put_tile(col, row, "floor_vip_carpet")
                else:
                    put_tile(col, row, "floor_arcade_teal")
            # SW / Center Main PC Gaming Arena (x=1..19, y=9..20)
            else:
                if row in (10, 11, 15, 16) or col in (10, 11, 18, 19):
                    put_tile(col, row, "floor_pc_carpet_trim")
                else:
                    put_tile(col, row, "floor_pc_carpet")

    # 2. Outer Perimeter Walls
    for col in range(COLS):
        put_tile(col, 0, "wall_cap_edge_s")
        put_tile(col, ROWS - 1, "wall_cap_dark")
    for row in range(ROWS):
        put_tile(0, row, "wall_cap_dark")
        put_tile(COLS - 1, row, "wall_cap_dark")

    # North Wall Face (y=1 upper, y=2 lower)
    for col in range(1, COLS - 1):
        if col <= 12:
            put_tile(col, 1, "wall_cafe_wood_upper")
            put_tile(col, 2, "wall_cafe_wood_lower")
        else:
            put_tile(col, 1, "wall_face_upper")
            put_tile(col, 2, "wall_face_lower")

    # North Wall Accents (Windows, AC, Neon Signs, Posters, Glass Entrance Door)
    for col in (3, 4, 9, 10):
        put_tile(col, 1, "wall_window_night")
    put_tile(6, 1, "wall_ac_unit")
    put_tile(15, 1, "wall_ac_unit")
    put_tile(17, 1, "wall_neon_sign")
    put_tile(18, 1, "wall_neon_sign")
    put_tile(21, 1, "wall_game_poster")
    put_tile(22, 1, "wall_window_night")
    put_tile(23, 1, "wall_window_night")

    # Automatic Glass Entrance Doorway at NE (x=25..26, y=1..2) + welcome mat at y=3
    put_tile(25, 1, "wall_door_top_left")
    put_tile(26, 1, "wall_door_top_right")
    put_tile(25, 2, "wall_door_arch_left")
    put_tile(26, 2, "wall_door_arch_right")
    put_tile(25, 3, "floor_entrance_mat")
    put_tile(26, 3, "floor_entrance_mat")

    # 3. Clean Interior Zone Dividers (keeping generous >= 2-tile walkable corridors!)
    # Vertical glass divider between NW Ramen Cafe & NE Lobby (x=13, y=3..5), open corridor y=6..8 (3 tiles!)
    for row in (3, 4, 5):
        put_tile(13, row, "wall_glass_divider_v")

    # Glass divider between NW Cafe & SW PC Arena (x=1..9, y=9), open corridor x=10..12 (3 tiles!)
    for col in range(1, 10):
        put_tile(col, 9, "wall_glass_divider")

    # Short Arcade feature wall separating NE Lobby & SE Arcade (x=21..28, y=9..10)
    # Wide 2-tile open walkway from Lobby to Arcade at x=19..20!
    for col in range(21, 29):
        put_tile(col, 9, "wall_cap_edge_s")
        put_tile(col, 10, "wall_face_lower")
    put_tile(22, 10, "wall_game_poster")
    put_tile(25, 10, "wall_neon_sign")
    put_tile(27, 10, "wall_game_poster")

    # Vertical glass divider between Center PC Arena & SE Arcade (x=19, y=12..14 and y=17..20)
    # Open 2-tile corridors at y=10..11 and y=15..16!
    for row in (12, 13, 14, 17, 18, 19, 20):
        put_tile(19, row, "wall_glass_divider_v")

    # 4. Subtle RM2000 3px drop shadow directly below north walls & dividers (using SHADOW #4c557f alpha 85)
    shadow_strip = Image.new("RGBA", (T, 3), SHADOW)
    for col in range(1, COLS - 1):
        if col not in (25, 26):
            map_img.alpha_composite(shadow_strip, (col * T, 3 * T))
    for col in range(1, 10):
        map_img.alpha_composite(shadow_strip, (col * T, 10 * T))
    for col in range(21, 29):
        map_img.alpha_composite(shadow_strip, (col * T, 11 * T))

    # 5. Place ALL 20 Objects in Y-sorted depth order (top-to-bottom by bottom pixel!)
    placements: List[Tuple[str, int, int]] = [
        # --- Zone 1: NW Ramen Cafe (x=1..12, y=2..8) ---
        ("drink_fridge_glass",     1,  2),
        ("ramen_cooker_counter",   2,  2),
        ("ramen_cooker_counter",   4,  2),
        ("snack_shelf_rack",       7,  2),
        ("vending_machine_drinks", 10, 2),
        ("trash_recycle_bin",      12, 3),
        ("standing_floor_lamp",    1,  6),
        ("cafe_table_oak",         2,  6),
        ("cafe_stool",             2,  7),
        ("cafe_stool",             3,  7),
        ("cafe_table_oak",         6,  6),
        ("cafe_stool",             6,  7),
        ("cafe_stool",             7,  7),

        # --- Zone 2: NE POS Lobby & Entrance (x=14..28, y=2..8) ---
        ("server_rack",            15, 2),
        ("snack_shelf_rack",       17, 2),
        ("drink_fridge_glass",     20, 2),
        ("standing_floor_lamp",    22, 3),
        ("pos_counter_desk",       16, 4),
        ("storage_locker",         28, 4),
        ("storage_locker",         28, 6),
        ("trash_recycle_bin",      28, 8),

        # --- Zone 3: SW & Center Main PC Gaming Arena (x=1..18, y=10..20) ---
        ("server_rack",            1,  11),
        ("trash_recycle_bin",      1,  15),
        # West PC Bank — Row 1 (Blue)
        ("pc_station_blue",        2,  12),
        ("pc_station_blue",        4,  12),
        ("pc_station_blue",        6,  12),
        ("pc_station_blue",        8,  12),
        ("gaming_chair_blue",      2,  14),
        ("gaming_chair_blue",      4,  14),
        ("gaming_chair_blue",      6,  14),
        ("gaming_chair_blue",      8,  14),
        # Center PC Bank — Row 1 (Blue)
        ("pc_station_blue",        12, 12),
        ("pc_station_blue",        14, 12),
        ("pc_station_blue",        16, 12),
        ("gaming_chair_blue",      12, 14),
        ("gaming_chair_blue",      14, 14),
        ("gaming_chair_blue",      16, 14),
        # West PC Bank — Row 2 (Red Dual-Monitor)
        ("pc_station_red",         2,  17),
        ("pc_station_red",         4,  17),
        ("pc_station_red",         6,  17),
        ("pc_station_red",         8,  17),
        ("gaming_chair_red",       2,  19),
        ("gaming_chair_red",       4,  19),
        ("gaming_chair_red",       6,  19),
        ("gaming_chair_red",       8,  19),
        # Center PC Bank — Row 2 (Red Dual-Monitor)
        ("pc_station_red",         12, 17),
        ("pc_station_red",         14, 17),
        ("pc_station_red",         16, 17),
        ("gaming_chair_red",       12, 19),
        ("gaming_chair_red",       14, 19),
        ("gaming_chair_red",       16, 19),

        # --- Zone 4: SE Retro Arcade & VIP Alcove (x=20..28, y=10..20) ---
        ("arcade_cabinet_blue",    21, 10),
        ("arcade_cabinet_red",     22, 10),
        ("arcade_cabinet_blue",    23, 10),
        ("claw_crane_machine",     24, 10),
        ("claw_crane_machine",     26, 10),
        ("coin_changer",           28, 10),
        ("arcade_cabinet_red",     28, 13),
        ("standing_floor_lamp",    22, 15),
        ("standing_floor_lamp",    27, 15),
        ("vip_sofa_navy",          23, 16),
        ("vip_sofa_navy",          25, 16),
        ("cafe_table_oak",         24, 18),
        ("trash_recycle_bin",      20, 19),
    ]

    # Sort by bottom y-coordinate for clean painter's algorithm overlap
    def bottom_y(item: Tuple[str, int, int]) -> int:
        obj_id, col, row = item
        return row * T + objs[obj_id].h

    for obj_id, col, row in sorted(placements, key=bottom_y):
        px_x = col * T
        # Center dual-monitor red gaming chairs directly in front of each 32px desk
        if obj_id == "gaming_chair_red":
            px_x += 8
        elif obj_id == "gaming_chair_blue":
            px_x += 4
        map_img.alpha_composite(objs[obj_id].img, (px_x, row * T))

    # 6. Place 3 ref_mod1_char.png (1x = 24x32) scale characters naturally in open corridors!
    char_1x = load_ref_char_1x()  # 24x32
    char_positions = [
        (24 * T - 4, 5 * T),   # Character 1: NE Lobby entering toward POS counter
        (10 * T + 4, 14 * T),  # Character 2: Central PC Arena corridor
        (23 * T + 4, 12 * T),  # Character 3: SE Retro Arcade in front of claw crane
    ]
    char_rects: List[Tuple[int, int, int, int]] = []
    for cx, cy in char_positions:
        map_img.alpha_composite(char_1x, (cx, cy))
        char_rects.append((cx, cy, char_1x.width, char_1x.height))

    map_img.save(OUT_ROOT / "demo_modern_pcbang.png")
    map_2x = map_img.resize((map_img.width * 2, map_img.height * 2), Image.Resampling.NEAREST)
    map_2x.save(OUT_ROOT / "demo_modern_pcbang_2x.png")
    return char_rects
