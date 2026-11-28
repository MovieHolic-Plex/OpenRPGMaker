#!/usr/bin/env python3
"""Assemble modern_pcbang_carbon contact sheet, 30x22 playable demo map,
Before-vs-After 20-object comparison sheet, and run strict full-set validation."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Tuple
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
REFS = ROOT / "tiledata/dungeon-pilot/_dots_kit_refs"
OUT = ROOT / "tiledata/dungeon-dots/modern_pcbang_carbon"
OLD_OUT = ROOT / "tiledata/dungeon-dots/modern_pcbang"
TILES_DIR = OUT / "tiles"
OBJS_DIR = OUT / "objects"

SHADOW = (76, 85, 127, 85)  # #4c557f @ 85/255
NEUTRAL_GRAY = (118, 118, 112, 255)  # #767670
HEADER_BG = (88, 88, 84, 255)
CARD_BORDER = (78, 78, 74, 255)
TEXT_LIGHT = (244, 244, 240, 255)
TEXT_DIM = (208, 208, 200, 255)

OBJECT_SPECS = [
    {"id": "pc_station_blue", "camera": "standing", "canvas": (32, 32), "ko": "블루 게이밍 PC석"},
    {"id": "pc_station_red", "camera": "standing", "canvas": (32, 32), "ko": "레드 듀얼모니터 PC석"},
    {"id": "gaming_chair_red", "camera": "chair", "canvas": (16, 16), "ko": "레드 게이밍 체어"},
    {"id": "gaming_chair_blue", "camera": "chair", "canvas": (16, 16), "ko": "블루 게이밍 체어"},
    {"id": "arcade_cabinet_blue", "camera": "standing", "canvas": (16, 32), "ko": "블루 오락기"},
    {"id": "arcade_cabinet_red", "camera": "standing", "canvas": (16, 32), "ko": "레드 격투 오락기"},
    {"id": "claw_crane_machine", "camera": "standing", "canvas": (32, 32), "ko": "인형뽑기 기계"},
    {"id": "coin_changer", "camera": "standing", "canvas": (16, 32), "ko": "동전교환기"},
    {"id": "vending_machine_drinks", "camera": "standing", "canvas": (32, 32), "ko": "음료 자판기"},
    {"id": "drink_fridge_glass", "camera": "standing", "canvas": (16, 32), "ko": "음료 쇼케이스 냉장고"},
    {"id": "ramen_cooker_counter", "camera": "standing", "canvas": (32, 32), "ko": "즉석 라면 조리기"},
    {"id": "snack_shelf_rack", "camera": "standing", "canvas": (32, 32), "ko": "과자·컵라면 진열대"},
    {"id": "pos_counter_desk", "camera": "standing", "canvas": (48, 32), "ko": "포스 카운터 데스크"},
    {"id": "cafe_table_oak", "camera": "topdown", "canvas": (32, 16), "ko": "오크 카페 테이블"},
    {"id": "cafe_stool", "camera": "chair", "canvas": (16, 16), "ko": "카페 의자"},
    {"id": "vip_sofa_navy", "camera": "topdown", "canvas": (32, 16), "ko": "VIP 네이비 가죽소파"},
    {"id": "storage_locker", "camera": "standing", "canvas": (16, 32), "ko": "코인 사물함"},
    {"id": "server_rack", "camera": "standing", "canvas": (16, 32), "ko": "서버 랙"},
    {"id": "standing_floor_lamp", "camera": "slender", "canvas": (16, 32), "ko": "스탠딩 플로어 램프"},
    {"id": "trash_recycle_bin", "camera": "standing", "canvas": (16, 16), "ko": "분리수거함"},
]

REQUIRED_TILES = [
    "floor_cafe_oak", "floor_lobby_slate", "floor_lobby_slate_alt",
    "floor_pc_carpet", "floor_pc_carpet_trim", "floor_arcade_teal",
    "floor_vip_carpet", "floor_entrance_mat",
    "wall_cap_dark", "wall_cap_edge_s", "wall_face_upper", "wall_face_lower",
    "wall_cafe_wood_upper", "wall_cafe_wood_lower",
    "wall_glass_divider", "wall_glass_divider_v",
    "wall_door_top_left", "wall_door_top_right",
    "wall_door_arch_left", "wall_door_arch_right",
    "wall_window_night", "wall_ac_unit", "wall_neon_sign", "wall_game_poster",
]


def load_ref_char_1x() -> Image.Image:
    raw = Image.open(REFS / "ref_mod1_char.png").convert("RGBA")
    return raw.resize((raw.width // 3, raw.height // 3), Image.Resampling.NEAREST)


def load_palette() -> set[Tuple[int, int, int]]:
    data = json.loads((REFS / "modern_palette_v3.json").read_text())
    cols = set()
    for hx in data["all_colors"]:
        h = hx.lstrip("#")
        cols.add((int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)))
    return cols


def lum(rgb: Tuple[int, int, int]) -> float:
    return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]


def floor_spike_ratio(im: Image.Image) -> float:
    px = im.load()
    w, h = im.size
    diffs = 0
    total = 0
    for y in range(h):
        for x in range(w):
            r1, g1, b1, _ = px[x, y]
            for dx, dy in ((1, 0), (0, 1)):
                nx, ny = x + dx, y + dy
                if nx < w and ny < h:
                    r2, g2, b2, _ = px[nx, ny]
                    d = abs(r1 - r2) + abs(g1 - g2) + abs(b1 - b2)
                    if d > 95:
                        diffs += 1
                    total += 1
    return diffs / total if total else 0.0


def validate_all(tiles: Dict[str, Image.Image], objs: Dict[str, Image.Image]) -> bool:
    allowed = load_palette()
    failures: List[str] = []

    print("=== modern_pcbang_carbon FULL-SET MACHINE CHECK ===")
    # 1. Tiles
    for name in REQUIRED_TILES:
        im = tiles[name]
        if im.size != (16, 16):
            failures.append(f"Tile {name} bad size {im.size}")
        px = list(im.get_flattened_data()) if hasattr(im, "get_flattened_data") else list(im.getdata())
        off = sum(1 for r, g, b, a in px if a == 255 and (r, g, b) not in allowed)
        bad_a = sum(1 for r, g, b, a in px if a != 255)
        blk = sum(1 for r, g, b, a in px if a == 255 and (r, g, b) == (0, 0, 0))
        if off or bad_a or blk:
            failures.append(f"Tile {name}: off={off} bad_a={bad_a} pure_black={blk}")
        if name.startswith("floor_") and name != "floor_entrance_mat":
            sr = floor_spike_ratio(im)
            print(f"  tile {name:24s} spike={sr:.4f} {'OK' if sr <= 0.06 else 'FAIL'}")
            if sr > 0.06:
                failures.append(f"Tile {name} spike {sr:.4f} > 0.06")

    # 2. Objects
    manifest_rows = []
    notes_lines = ["gemini-4-carbon medium (5 parallel batches: 4x5 objects + 1x24 tiles)"]
    for spec in OBJECT_SPECS:
        oid = spec["id"]
        im = objs[oid]
        cw, ch = spec["canvas"]
        if im.size != (cw, ch):
            failures.append(f"Obj {oid} size {im.size} != {(cw, ch)}")
        pix = im.load()
        off = 0
        bad_a = 0
        blk = 0
        xs, ys = [], []
        outer_lums, inner_lums = [], []
        colors_used = set()
        for y in range(ch):
            for x in range(cw):
                r, g, b, a = pix[x, y]
                if a == 0:
                    continue
                elif (r, g, b, a) == SHADOW:
                    continue
                elif a == 255:
                    colors_used.add((r, g, b))
                    if (r, g, b) not in allowed:
                        off += 1
                    if (r, g, b) == (0, 0, 0):
                        blk += 1
                    xs.append(x)
                    ys.append(y)
                    # Check if touching non-opaque
                    is_edge = False
                    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                        nx, ny = x + dx, y + dy
                        if nx < 0 or ny < 0 or nx >= cw or ny >= ch or pix[nx, ny][3] != 255:
                            is_edge = True
                            break
                    if is_edge:
                        outer_lums.append(lum((r, g, b)))
                    else:
                        inner_lums.append(lum((r, g, b)))
                else:
                    bad_a += 1

        ow = (max(xs) - min(xs) + 1) if xs else 0
        oh = (max(ys) - min(ys) + 1) if ys else 0
        ol = sum(outer_lums) / len(outer_lums) if outer_lums else 0.0
        il = sum(inner_lums) / len(inner_lums) if inner_lums else 0.0
        if off or bad_a or blk:
            failures.append(f"Obj {oid}: off={off} bad_a={bad_a} pure_black={blk}")
        if ol >= il:
            failures.append(f"Obj {oid}: outer_lum {ol:.1f} >= inner_lum {il:.1f}")
        print(f"  obj  {oid:24s} {cw:2d}x{ch:2d} op={ow:2d}x{oh:2d} cols={len(colors_used):2d} outL={ol:4.1f} < inL={il:5.1f} off={off}")
        manifest_rows.append({
            "file": f"objects/{oid}.png",
            "id": oid,
            "name_ko": spec["ko"],
            "camera": spec["camera"],
            "canvas": f"{cw}x{ch}",
            "opaque_size": f"{ow}x{oh}",
            "colors": len(colors_used),
            "facing": "down",
        })
        notes_lines.append(f"{oid}: {ow}x{oh} on {cw}x{ch} [{spec['camera']}], {len(colors_used)} colors, outL={ol:.1f} < inL={il:.1f}")

    (OUT / "manifest.json").write_text(json.dumps(manifest_rows, ensure_ascii=False, indent=2) + "\n")
    (OUT / "notes.txt").write_text("\n".join(notes_lines) + "\n")

    if failures:
        print("FAILURES:")
        for f in failures:
            print("  -", f)
        return False
    print("RESULT: 100% PASS (24 tiles + 20 objects, 0 failures)")
    return True


def render_contact_sheet(objs: Dict[str, Image.Image]) -> None:
    char_1x = load_ref_char_1x()
    char_2x = char_1x.resize((char_1x.width * 2, char_1x.height * 2), Image.Resampling.NEAREST)

    cols = 4
    rows = (len(OBJECT_SPECS) + cols - 1) // cols
    cell_w, cell_h = 220, 110
    pad, header_h = 12, 84
    sw = pad * 2 + cols * cell_w + (cols - 1) * pad
    sh = pad * 2 + header_h + pad + rows * cell_h + (rows - 1) * pad

    sheet = Image.new("RGBA", (sw, sh), NEUTRAL_GRAY)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    draw.rectangle([pad, pad, sw - pad - 1, pad + header_h - 1], fill=HEADER_BG, outline=CARD_BORDER)
    draw.text((pad + 12, pad + 10), "modern_pcbang_carbon (Gemini 4 Carbon Medium) - 20 Objects Blind Contact Sheet", fill=TEXT_LIGHT, font=font)
    draw.text((pad + 12, pad + 28), "Palette: 118-color modern_palette_v3.json LOCKED | Shadow: #4c557f@85 | 1px dark material outlines", fill=TEXT_DIM, font=font)
    draw.text((pad + 12, pad + 46), "Each cell: Left 2x enlarged, Right native 1x | Scale ref right: ref_mod1_char (22px @ 1x)", fill=TEXT_DIM, font=font)

    cx2 = sw - pad - 140
    cy2 = pad + (header_h - char_2x.height) // 2
    sheet.alpha_composite(char_2x, (cx2, cy2))
    draw.text((cx2 + 16, pad + header_h - 14), "2x", fill=TEXT_DIM, font=font)
    cx1 = sw - pad - 64
    cy1 = cy2 + char_2x.height - char_1x.height
    sheet.alpha_composite(char_1x, (cx1, cy1))
    draw.text((cx1 + 6, pad + header_h - 14), "1x", fill=TEXT_DIM, font=font)

    y_start = pad + header_h + pad
    for idx, spec in enumerate(OBJECT_SPECS):
        r, c = divmod(idx, cols)
        x0 = pad + c * (cell_w + pad)
        y0 = y_start + r * (cell_h + pad)
        draw.rectangle([x0, y0, x0 + cell_w - 1, y0 + cell_h - 1], fill=NEUTRAL_GRAY, outline=CARD_BORDER)

        im1 = objs[spec["id"]]
        im2 = im1.resize((im1.width * 2, im1.height * 2), Image.Resampling.NEAREST)
        base_y = y0 + 76
        sheet.alpha_composite(im2, (x0 + 16 + max(0, (96 - im2.width) // 2), base_y - im2.height))
        sheet.alpha_composite(im1, (x0 + 134 + max(0, (52 - im1.width) // 2), base_y - im1.height))
        draw.line([(x0 + 10, base_y + 1), (x0 + cell_w - 10, base_y + 1)], fill=CARD_BORDER)
        draw.text((x0 + 8, y0 + 81), f"{idx + 1:02d}. {spec['id']}", fill=TEXT_LIGHT, font=font)
        draw.text((x0 + 8, y0 + 94), f"[{spec['camera']}] {spec['canvas'][0]}x{spec['canvas'][1]}", fill=TEXT_DIM, font=font)

    sheet.save(OUT / "preview_2x_on_gray.png")


def render_before_after_objects(objs: Dict[str, Image.Image]) -> None:
    """Side-by-side 2x comparison of ALL 20 objects: Left = Neon High, Right = Carbon Medium."""
    cols = 4
    rows = (len(OBJECT_SPECS) + cols - 1) // cols
    cell_w, cell_h = 248, 108
    pad, header_h = 10, 56
    sw = pad * 2 + cols * cell_w + (cols - 1) * pad
    sh = pad * 2 + header_h + pad + rows * cell_h + (rows - 1) * pad

    sheet = Image.new("RGBA", (sw, sh), NEUTRAL_GRAY)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    draw.rectangle([pad, pad, sw - pad - 1, pad + header_h - 1], fill=HEADER_BG, outline=CARD_BORDER)
    draw.text((pad + 12, pad + 10), "BEFORE vs AFTER (2x) - All 20 PC Bang Objects on #767670 Gray", fill=TEXT_LIGHT, font=font)
    draw.text((pad + 12, pad + 28), "Each cell: LEFT = previous neon high (1-shot 44 assets)   ->   RIGHT = new gemini-4-carbon medium (focused 5/batch)", fill=TEXT_DIM, font=font)

    y_start = pad + header_h + pad
    for idx, spec in enumerate(OBJECT_SPECS):
        r, c = divmod(idx, cols)
        x0 = pad + c * (cell_w + pad)
        y0 = y_start + r * (cell_h + pad)
        draw.rectangle([x0, y0, x0 + cell_w - 1, y0 + cell_h - 1], fill=NEUTRAL_GRAY, outline=CARD_BORDER)

        old_im = Image.open(OLD_OUT / "objects" / f"{spec['id']}.png").convert("RGBA")
        new_im = objs[spec["id"]]
        old_2x = old_im.resize((old_im.width * 2, old_im.height * 2), Image.Resampling.NEAREST)
        new_2x = new_im.resize((new_im.width * 2, new_im.height * 2), Image.Resampling.NEAREST)

        base_y = y0 + 76
        # Left half: old
        lx = x0 + 8 + max(0, (104 - old_2x.width) // 2)
        sheet.alpha_composite(old_2x, (lx, base_y - old_2x.height))
        # Arrow
        draw.text((x0 + 118, y0 + 42), "->", fill=TEXT_DIM, font=font)
        # Right half: new
        rx = x0 + 136 + max(0, (104 - new_2x.width) // 2)
        sheet.alpha_composite(new_2x, (rx, base_y - new_2x.height))

        draw.line([(x0 + 8, base_y + 1), (x0 + cell_w - 8, base_y + 1)], fill=CARD_BORDER)
        draw.text((x0 + 8, y0 + 80), f"{idx + 1:02d}. {spec['id']} ({spec['canvas'][0]}x{spec['canvas'][1]})", fill=TEXT_LIGHT, font=font)
        draw.text((x0 + 16, y0 + 93), "neon high", fill=TEXT_DIM, font=font)
        draw.text((x0 + 148, y0 + 93), "carbon med", fill=(160, 245, 195, 255), font=font)

    sheet.save(OUT / "compare_20_objects_2x.png")


def render_demo_map(tiles: Dict[str, Image.Image], objs: Dict[str, Image.Image]) -> None:
    COLS, ROWS, T = 30, 22, 16
    map_img = Image.new("RGBA", (COLS * T, ROWS * T), (20, 22, 34, 255))

    def put_tile(col: int, row: int, name: str) -> None:
        map_img.paste(tiles[name], (col * T, row * T))

    # 1. Zone floors
    for row in range(ROWS):
        for col in range(COLS):
            if 1 <= col <= 12 and 3 <= row <= 8:
                put_tile(col, row, "floor_cafe_oak")
            elif 13 <= col <= 28 and 3 <= row <= 9:
                put_tile(col, row, "floor_lobby_slate" if (col + row) % 2 == 0 else "floor_lobby_slate_alt")
            elif 20 <= col <= 28 and 10 <= row <= 20:
                if 22 <= col <= 27 and 16 <= row <= 19:
                    put_tile(col, row, "floor_vip_carpet")
                else:
                    put_tile(col, row, "floor_arcade_teal")
            else:
                if row in (10, 11, 15, 16) or col in (10, 11, 18, 19):
                    put_tile(col, row, "floor_pc_carpet_trim")
                else:
                    put_tile(col, row, "floor_pc_carpet")

    # 2. Outer walls
    for col in range(COLS):
        put_tile(col, 0, "wall_cap_edge_s")
        put_tile(col, ROWS - 1, "wall_cap_dark")
    for row in range(ROWS):
        put_tile(0, row, "wall_cap_dark")
        put_tile(COLS - 1, row, "wall_cap_dark")

    for col in range(1, COLS - 1):
        if col <= 12:
            put_tile(col, 1, "wall_cafe_wood_upper")
            put_tile(col, 2, "wall_cafe_wood_lower")
        else:
            put_tile(col, 1, "wall_face_upper")
            put_tile(col, 2, "wall_face_lower")

    for col in (3, 4, 9, 10):
        put_tile(col, 1, "wall_window_night")
    put_tile(6, 1, "wall_ac_unit")
    put_tile(15, 1, "wall_ac_unit")
    put_tile(17, 1, "wall_neon_sign")
    put_tile(18, 1, "wall_neon_sign")
    put_tile(21, 1, "wall_game_poster")
    put_tile(22, 1, "wall_window_night")
    put_tile(23, 1, "wall_window_night")

    put_tile(25, 1, "wall_door_top_left")
    put_tile(26, 1, "wall_door_top_right")
    put_tile(25, 2, "wall_door_arch_left")
    put_tile(26, 2, "wall_door_arch_right")
    put_tile(25, 3, "floor_entrance_mat")
    put_tile(26, 3, "floor_entrance_mat")

    # 3. Interior dividers
    for row in (3, 4, 5):
        put_tile(13, row, "wall_glass_divider_v")
    for col in range(1, 10):
        put_tile(col, 9, "wall_glass_divider")
    for col in range(21, 29):
        put_tile(col, 9, "wall_cap_edge_s")
        put_tile(col, 10, "wall_face_lower")
    put_tile(22, 10, "wall_game_poster")
    put_tile(25, 10, "wall_neon_sign")
    put_tile(27, 10, "wall_game_poster")
    for row in (12, 13, 14, 17, 18, 19, 20):
        put_tile(19, row, "wall_glass_divider_v")

    # 4. Subtle drop shadow below walls
    shadow_strip = Image.new("RGBA", (T, 3), SHADOW)
    for col in range(1, COLS - 1):
        if col not in (25, 26):
            map_img.alpha_composite(shadow_strip, (col * T, 3 * T))
    for col in range(1, 10):
        map_img.alpha_composite(shadow_strip, (col * T, 10 * T))
    for col in range(21, 29):
        map_img.alpha_composite(shadow_strip, (col * T, 11 * T))

    # 5. Placements
    placements: List[Tuple[str, int, int]] = [
        ("drink_fridge_glass", 1, 2),
        ("ramen_cooker_counter", 2, 2),
        ("ramen_cooker_counter", 4, 2),
        ("snack_shelf_rack", 7, 2),
        ("vending_machine_drinks", 10, 2),
        ("trash_recycle_bin", 12, 3),
        ("standing_floor_lamp", 1, 6),
        ("cafe_table_oak", 2, 6),
        ("cafe_stool", 2, 7),
        ("cafe_stool", 3, 7),
        ("cafe_table_oak", 6, 6),
        ("cafe_stool", 6, 7),
        ("cafe_stool", 7, 7),
        ("server_rack", 15, 2),
        ("snack_shelf_rack", 17, 2),
        ("drink_fridge_glass", 20, 2),
        ("standing_floor_lamp", 22, 3),
        ("pos_counter_desk", 16, 4),
        ("storage_locker", 28, 4),
        ("storage_locker", 28, 6),
        ("trash_recycle_bin", 28, 8),
        ("server_rack", 1, 11),
        ("trash_recycle_bin", 1, 15),
        ("pc_station_blue", 2, 12), ("pc_station_blue", 4, 12),
        ("pc_station_blue", 6, 12), ("pc_station_blue", 8, 12),
        ("gaming_chair_blue", 2, 14), ("gaming_chair_blue", 4, 14),
        ("gaming_chair_blue", 6, 14), ("gaming_chair_blue", 8, 14),
        ("pc_station_blue", 12, 12), ("pc_station_blue", 14, 12), ("pc_station_blue", 16, 12),
        ("gaming_chair_blue", 12, 14), ("gaming_chair_blue", 14, 14), ("gaming_chair_blue", 16, 14),
        ("pc_station_red", 2, 17), ("pc_station_red", 4, 17),
        ("pc_station_red", 6, 17), ("pc_station_red", 8, 17),
        ("gaming_chair_red", 2, 19), ("gaming_chair_red", 4, 19),
        ("gaming_chair_red", 6, 19), ("gaming_chair_red", 8, 19),
        ("pc_station_red", 12, 17), ("pc_station_red", 14, 17), ("pc_station_red", 16, 17),
        ("gaming_chair_red", 12, 19), ("gaming_chair_red", 14, 19), ("gaming_chair_red", 16, 19),
        ("arcade_cabinet_blue", 21, 10), ("arcade_cabinet_red", 22, 10),
        ("arcade_cabinet_blue", 23, 10), ("claw_crane_machine", 24, 10),
        ("claw_crane_machine", 26, 10), ("coin_changer", 28, 10),
        ("arcade_cabinet_red", 28, 13),
        ("standing_floor_lamp", 22, 15), ("standing_floor_lamp", 27, 15),
        ("vip_sofa_navy", 23, 16), ("vip_sofa_navy", 25, 16),
        ("cafe_table_oak", 24, 18), ("trash_recycle_bin", 20, 19),
    ]

    for obj_id, col, row in sorted(placements, key=lambda it: it[2] * T + objs[it[0]].height):
        px_x = col * T
        if obj_id == "gaming_chair_red":
            px_x += 8
        elif obj_id == "gaming_chair_blue":
            px_x += 4
        map_img.alpha_composite(objs[obj_id], (px_x, row * T))

    # 6. Scale reference characters
    char_1x = load_ref_char_1x()
    for cx, cy in [(24 * T - 4, 5 * T), (10 * T + 4, 14 * T), (23 * T + 4, 12 * T)]:
        map_img.alpha_composite(char_1x, (cx, cy))

    map_img.save(OUT / "demo_modern_pcbang_carbon.png")
    map_img.resize((map_img.width * 2, map_img.height * 2), Image.Resampling.NEAREST).save(OUT / "demo_modern_pcbang_carbon_2x.png")


def main() -> int:
    tiles = {name: Image.open(TILES_DIR / f"{name}.png").convert("RGBA") for name in REQUIRED_TILES}
    objs = {spec["id"]: Image.open(OBJS_DIR / f"{spec['id']}.png").convert("RGBA") for spec in OBJECT_SPECS}
    ok = validate_all(tiles, objs)
    render_contact_sheet(objs)
    render_before_after_objects(objs)
    render_demo_map(tiles, objs)
    print("Saved preview_2x_on_gray.png, compare_20_objects_2x.png, demo_modern_pcbang_carbon.png & _2x.png")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
