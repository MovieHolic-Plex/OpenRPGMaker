#!/usr/bin/env python3
"""
Author a dedicated RM2000/2003 288x256 flying bird CharSet:
  - public/assets/charsets/dawning-skybirds.png
  - src/project/flagship/dawningSkybirdsAsset.ts

Layout:
  288x256 px total = 4 cols x 2 rows of character blocks (72x128 each).
  Each character block = 3 pattern cols (0=wings up, 1=glide, 2=wings down)
                       x 4 direction rows (0=up, 1=right, 2=down, 3=left)
  Each cell = 24x32 px.

Bird slots:
  0: 여명갈매기 (Dawn Gull) — white & sky-blue wings, dark slate wingtips, golden beak
  1: 창공제비 (Azure Sky-Swallow) — cobalt blue & cream forked-tail swallow in flight
  2: 별빛방울새 (Starcrest Finch) — warm coral-gold & cream songbird in flight
  3: 새떼 편대 (Swallow Pair) — two small swallows gliding/flapping in formation
  4: 해안갈매기 편대 (Gull Pair) — two small coastal gulls in formation
  5: 실바나숲새 (Silvana Warbler) — emerald-mint & cream forest songbird in flight
  6: 황혼물총새 (Dawning Kingfisher) — cyan-azure & sunset-amber kingfisher in flight
  7: 아스트라별새 (Astra Starbird) — celestial indigo & starlight-gold bird in flight
"""
from __future__ import annotations

import base64
import io
from pathlib import Path
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[3]
OUT_PNG = REPO_ROOT / "public" / "assets" / "charsets" / "dawning-skybirds.png"
OUT_TS = REPO_ROOT / "src" / "project" / "flagship" / "dawningSkybirdsAsset.ts"

CELL_W = 24
CELL_H = 32
SHEET_W = 288
SHEET_H = 256

# Direction rows per EasyRPG / OPRN CHARSET_DIRECTIONS = ["up", "right", "down", "left"]
DIR_UP = 0
DIR_RIGHT = 1
DIR_DOWN = 2
DIR_LEFT = 3

RGBA = tuple[int, int, int, int]


def put_px(img: Image.Image, x: int, y: int, color: RGBA) -> None:
    if 0 <= x < img.width and 0 <= y < img.height and color[3] > 0:
        img.putpixel((x, y), color)


def draw_shadow(cell: Image.Image, cx: int, cy: int, rx: int, ry: int, alpha: int = 92) -> None:
    for dy in range(-ry, ry + 1):
        for dx in range(-rx, rx + 1):
            norm = (dx * dx) / max(1.0, rx * rx + 0.5) + (dy * dy) / max(1.0, ry * ry + 0.5)
            if norm <= 1.0:
                a = int(alpha * (1.0 - 0.35 * norm))
                put_px(cell, cx + dx, cy + dy, (18, 28, 46, a))


def paint_from_grid(
    cell: Image.Image,
    ox: int,
    oy: int,
    rows: list[str],
    palette: dict[str, RGBA],
    flip_x: bool = False,
) -> None:
    for r_idx, row in enumerate(rows):
        line = row[::-1] if flip_x else row
        for c_idx, ch in enumerate(line):
            if ch == "." or ch == " ":
                continue
            color = palette.get(ch)
            if color:
                put_px(cell, ox + c_idx, oy + r_idx, color)


def make_gull_palette(
    outline: RGBA = (26, 38, 58, 255),
    body_hi: RGBA = (252, 254, 255, 255),
    body_mid: RGBA = (224, 238, 250, 255),
    wing_sky: RGBA = (128, 196, 246, 255),
    wing_deep: RGBA = (72, 142, 206, 255),
    tip_dark: RGBA = (38, 56, 86, 255),
    beak: RGBA = (250, 192, 56, 255),
    eye: RGBA = (20, 26, 38, 255),
) -> dict[str, RGBA]:
    return {
        "O": outline,
        "W": body_hi,
        "m": body_mid,
        "S": wing_sky,
        "D": wing_deep,
        "T": tip_dark,
        "B": beak,
        "E": eye,
    }


def draw_single_bird_cell(
    palette: dict[str, RGBA],
    direction: int,
    pattern: int,
    forked_tail: bool = False,
    crest: bool = False,
) -> Image.Image:
    cell = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
    # Subtle ground shadow at bottom of 24x32 frame so bird reads as airborne
    shadow_rx = 5 if pattern == 0 else (6 if pattern == 1 else 7)
    shadow_alpha = 80 if pattern == 0 else (96 if pattern == 1 else 110)
    draw_shadow(cell, 12, 28, shadow_rx, 2, shadow_alpha)

    # Vertical flight bob
    bob_y = -2 if pattern == 0 else (0 if pattern == 1 else 2)

    if direction in (DIR_RIGHT, DIR_LEFT):
        flip = direction == DIR_LEFT
        # Side-view flying bird (facing right by default, flipped for left)
        if pattern == 0:  # Wings HIGH UP (3/4 top-down V-wings raised over back)
            grid = [
                "....OOO.........OOO.....",
                "...OTSTO.......OTSTO....",
                "...OTSSSTO....OTSSSTO...",
                "....OTSSSSTO.OTSSSSTO...",
                ".....OSSSSSTOOSSSSTO...." if not crest else ".....OSSSSSTOOSSSSTOO...",
                "......OSSSSSWWWWWWOO....",
                ".......ODDDWWWWWWWEBBBO.",
                "..OOOO.ODDDWWWWWWWWBBO..",
                ".OTDDDmmmmmmWWWWWWOO....",
                "OTTTDDmmmmmmmmWWWOO....." if not forked_tail else "OTTO.OOmmmmmmmWWWOO.....",
                ".OOOO..OOmmmmmmOO.......",
                ".........OOOOOO.........",
            ]
        elif pattern == 1:  # MID-FLAP / SOAR (3/4 outspread gull wings + protruding beak)
            grid = [
                "........................",
                "..OOOO...........OOOO...",
                ".OTTTTO.........OTTTTO..",
                ".OTSSSSTO......OTSSSSTO.",
                "..OTSSSSSTOOOOOTSSSSTO.." if not crest else "..OTSSSSSTOOOOTSSSSTOO..",
                "...OOSSSSSWWWWWWWSSOO...",
                ".....OODDDDWWWWWWWEBBBO.",
                "..OOOO.ODDDWWWWWWWWBBO..",
                ".OTDDDmmmmmmWWWWWWOO....",
                "OTTTDDmmmmmmmmWWWOO....." if not forked_tail else "OTTO.OOmmmmmmmWWWOO.....",
                ".OOOO..OOmmmmmmOO.......",
                ".........OOOOOO.........",
            ]
        else:  # Wings DOWN (sweeping down below belly)
            grid = [
                "........................",
                "........................",
                "............OOOOOO......" if not crest else "...........OOTSSOOO.....",
                "..........OOWWWWWWO.....",
                "....OOOO.OWWWWWWWWEBBBO.",
                "...OTDDDOOWWWWWWWWWBBO..",
                "..OTTTDDDmmOSSSSWWWWOO.." if not forked_tail else "..OTTO.ODmmOSSSSWWWWOO..",
                "...OOOO..mOSSSSSSWWOO...",
                ".........OTSSSSSSSTO....",
                "........OTSSSSSSSSSTO...",
                "........OTTTTSSSTTTTO...",
                ".........OOOOTTTTOOO....",
            ]
        paint_from_grid(cell, 0, 5 + bob_y, grid, palette, flip_x=flip)

    elif direction == DIR_DOWN:
        # Front-facing / soaring toward camera
        if pattern == 0:  # Wings UP (V-shape)
            grid = [
                ".OTTTO............OTTTO.",
                "OTSSSTO..........OTSSSTO",
                "OTSSSSTO........OTSSSSTO",
                ".OTSSSSTO......OTSSSSTO.",
                "..OTSSSWOO....OOWSSSTO..",
                "...OTSSWWOOOOOOWWSSTO...",
                "....OOWWWWWWWWWWWWOO....",
                ".....OWWmmWWWWmmWWO.....",
                ".....OWEWmmmmmmWEWO.....",
                "......OWWWBBBBWWWO......",
                ".......OOOBBBBOOO.......",
                ".........OOOOOO.........",
            ]
        elif pattern == 1:  # GLIDE (wide horizontal wingspan)
            grid = [
                "........................",
                "..........OOOO..........",
                ".........OWWWWO.........",
                ".OOTTTTOOWWWWWWOOTTTTOO.",
                "OTTTTSSSSWWWWWWSSSSTTTTO",
                "OTTTSSSSSWWWWWWSSSSSTTTO",
                ".OOSSSSmmWWWWWWmmSSSSOO.",
                "...OOOOOWEWmmWEWOOOOO...",
                "........OWBBBBWO........",
                ".........OOBBOO.........",
                "..........OOOO..........",
                "........................",
            ]
        else:  # Wings DOWN (arched M-shape)
            grid = [
                "........................",
                ".........OOOOOO.........",
                "........OWWWWWWO........",
                ".....OOOWWWWWWWWOOO.....",
                "...OOTSSWWWWWWWWSSThO...".replace("h", "T"),
                "..OTSSSSmmWWWWmmSSSSTh..".replace("h", "T"),
                ".OTSSSSSOOWEBWOOSSSSSTO.".replace("B", "E"),
                ".OTTTSSOO.OBBO.OOSSTTTO.",
                "..OTTTOO..OOOO..OOTTTO..",
                "...OOO............OOO...",
                "........................",
                "........................",
            ]
        paint_from_grid(cell, 0, 5 + bob_y, grid, palette, flip_x=False)

    else:  # DIR_UP (facing away / north)
        if pattern == 0:  # Wings UP
            grid = [
                ".OTTTO............OTTTO.",
                "OTSSSTO..........OTSSSTO",
                "OTSSSSTO........OTSSSSTO",
                ".OTSSSSTO......OTSSSSTO.",
                "..OTSSSWOO....OOWSSSTO..",
                "...OTSSWWOOOOOOWWSSTO...",
                "....OOWWWWWWWWWWWWOO....",
                ".....OWWSSSSSSSSWWO.....",
                "......OWWmmmmmmWWO......",
                ".......OODDDDDDOO.......",
                ".......OTTTTTTTTO......." if not forked_tail else "......OTTO....OTTO......",
                "........OOOOOOOO........" if not forked_tail else "......OOO......OOO......",
            ]
        elif pattern == 1:  # GLIDE
            grid = [
                "........................",
                "..........OOOO..........",
                ".........OWWWWO.........",
                ".OOTTTTOOWWWWWWOOTTTTOO.",
                "OTTTTSSSSWWWWWWSSSSTTTTO",
                "OTTTSSSSSWWWWWWSSSSSTTTO",
                ".OOSSSSSSmmmmmmSSSSSSOO.",
                "...OOOOOODDDDDDOOOOOO...",
                "........OTTTTTTO........" if not forked_tail else ".......OTTO..OTTO.......",
                ".........OOOOOO........." if not forked_tail else ".......OOO....OOO.......",
                "........................",
                "........................",
            ]
        else:  # Wings DOWN
            grid = [
                "........................",
                ".........OOOOOO.........",
                "........OWWWWWWO........",
                ".....OOOWWWWWWWWOOO.....",
                "...OOTSSWWWWWWWWSSSTO...",
                "..OTSSSSmmWWWWmmSSSSTO..",
                ".OTSSSSSOODDDDOOSSSSSTO.",
                ".OTTTSSOOOTTTTO.OOSSTTTO" if not forked_tail else ".OTTTSSOOOTOOOTO.OSSTTTO",
                "..OTTTOO..OOOO...OOTTTO.",
                "...OOO............OOO...",
                "........................",
                "........................",
            ]
        paint_from_grid(cell, 0, 5 + bob_y, grid, palette, flip_x=False)

    return cell


def draw_flock_pair_cell(
    palette_a: dict[str, RGBA],
    palette_b: dict[str, RGBA],
    direction: int,
    pattern: int,
) -> Image.Image:
    cell = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
    draw_shadow(cell, 8, 28, 3, 1, 78)
    draw_shadow(cell, 16, 29, 3, 1, 78)

    bob_a = -1 if pattern == 0 else (0 if pattern == 1 else 1)
    bob_b = 1 if pattern == 0 else (-1 if pattern == 1 else 0)

    def mini_bird_side(pose: int) -> list[str]:
        if pose == 0:
            return [
                ".OTO...OTO.",
                ".OSSO.OSSO.",
                "..OSSSSSO..",
                "OTOWWWWEBBO",
                ".OOmmmmBBO.",
                "...OOOO....",
            ]
        if pose == 1:
            return [
                "...........",
                "OTO.....OTO",
                "OSSO...OSSO",
                ".OOSSSSSOO.",
                "OTOWWWWEBBO",
                ".OOmmmmOO..",
            ]
        return [
            "...OOOO....",
            "OTOWWWWEBBO",
            ".OOSSSSBBO.",
            "..OTSSSTO..",
            "...OOOOO...",
            "...........",
        ]

    def mini_bird_front(pose: int, up: bool) -> list[str]:
        if pose == 0:
            return [
                "OTTO....OTTO",
                ".OTSO..OSTO.",
                "..OWWWWWWO..",
                "...OWBBWO..." if not up else "...OWTTWO...",
                "....OOOO....",
            ]
        if pose == 1:
            return [
                "....OOOO....",
                "OTTOWWWWOTTO",
                ".OOSSWWSSOO.",
                "...OWBBWO..." if not up else "...OWTTWO...",
                "....OOOO....",
            ]
        return [
            "....OOOO....",
            "..OOWWWWOO..",
            ".OTSSWWSSTh.".replace("h", "O"),
            "OTTO.BB.OTTO" if not up else "OTTO.TT.OTTO",
            ".....OO.....",
        ]

    if direction in (DIR_RIGHT, DIR_LEFT):
        flip = direction == DIR_LEFT
        g1 = mini_bird_side(pattern)
        g2 = mini_bird_side((pattern + 1) % 3)
        paint_from_grid(cell, 1 if flip else 10, 4 + bob_a, g1, palette_a, flip_x=flip)
        paint_from_grid(cell, 11 if flip else 1, 12 + bob_b, g2, palette_b, flip_x=flip)
    else:
        up = direction == DIR_UP
        g1 = mini_bird_front(pattern, up)
        g2 = mini_bird_front((pattern + 1) % 3, up)
        paint_from_grid(cell, 1, 4 + bob_a, g1, palette_a, flip_x=False)
        paint_from_grid(cell, 10, 12 + bob_b, g2, palette_b, flip_x=False)

    return cell


def build_sheet() -> Image.Image:
    sheet = Image.new("RGBA", (SHEET_W, SHEET_H), (0, 0, 0, 0))

    # Slot 0: 여명갈매기 (Dawn Gull)
    pal_dawn_gull = make_gull_palette(
        outline=(24, 38, 62, 255),
        body_hi=(252, 254, 255, 255),
        body_mid=(220, 236, 250, 255),
        wing_sky=(122, 196, 248, 255),
        wing_deep=(64, 138, 206, 255),
        tip_dark=(34, 52, 84, 255),
        beak=(252, 196, 52, 255),
    )

    # Slot 1: 창공제비 (Azure Sky-Swallow)
    pal_azure_swallow = make_gull_palette(
        outline=(20, 30, 56, 255),
        body_hi=(248, 244, 232, 255),
        body_mid=(224, 218, 204, 255),
        wing_sky=(68, 132, 236, 255),
        wing_deep=(38, 86, 184, 255),
        tip_dark=(24, 48, 118, 255),
        beak=(236, 112, 72, 255),
    )

    # Slot 2: 별빛방울새 (Starcrest Finch)
    pal_star_finch = make_gull_palette(
        outline=(54, 32, 28, 255),
        body_hi=(255, 248, 224, 255),
        body_mid=(248, 222, 168, 255),
        wing_sky=(250, 146, 92, 255),
        wing_deep=(218, 92, 58, 255),
        tip_dark=(138, 48, 38, 255),
        beak=(255, 214, 64, 255),
    )

    # Slot 5: 실바나숲새 (Silvana Warbler)
    pal_silvana_bird = make_gull_palette(
        outline=(22, 48, 36, 255),
        body_hi=(244, 252, 232, 255),
        body_mid=(208, 238, 188, 255),
        wing_sky=(86, 204, 132, 255),
        wing_deep=(44, 152, 92, 255),
        tip_dark=(28, 96, 60, 255),
        beak=(248, 198, 62, 255),
    )

    # Slot 6: 황혼물총새 (Dawning Kingfisher)
    pal_kingfisher = make_gull_palette(
        outline=(22, 40, 58, 255),
        body_hi=(255, 232, 196, 255),
        body_mid=(244, 176, 108, 255),
        wing_sky=(56, 202, 228, 255),
        wing_deep=(28, 142, 182, 255),
        tip_dark=(20, 88, 128, 255),
        beak=(252, 142, 48, 255),
    )

    # Slot 7: 아스트라별새 (Astra Starbird)
    pal_astra_bird = make_gull_palette(
        outline=(26, 22, 56, 255),
        body_hi=(248, 250, 255, 255),
        body_mid=(222, 226, 250, 255),
        wing_sky=(124, 134, 252, 255),
        wing_deep=(72, 78, 204, 255),
        tip_dark=(44, 48, 136, 255),
        beak=(255, 214, 68, 255),
    )

    slot_configs = [
        ("single", pal_dawn_gull, False, False),
        ("single", pal_azure_swallow, True, False),
        ("single", pal_star_finch, False, True),
        ("flock", pal_azure_swallow, pal_star_finch, False),
        ("flock", pal_dawn_gull, pal_dawn_gull, False),
        ("single", pal_silvana_bird, False, True),
        ("single", pal_kingfisher, True, False),
        ("single", pal_astra_bird, True, True),
    ]

    for slot_idx, cfg in enumerate(slot_configs):
        slot_col = slot_idx % 4
        slot_row = slot_idx // 4
        base_x = slot_col * (3 * CELL_W)
        base_y = slot_row * (4 * CELL_H)

        for d_row in range(4):
            for p_col in range(3):
                if cfg[0] == "single":
                    _, pal, forked, crest = cfg
                    cell = draw_single_bird_cell(pal, d_row, p_col, forked_tail=forked, crest=crest)
                else:
                    _, pal_a, pal_b, _ = cfg
                    cell = draw_flock_pair_cell(pal_a, pal_b, d_row, p_col)
                sheet.paste(cell, (base_x + p_col * CELL_W, base_y + d_row * CELL_H))

    return sheet


def main() -> None:
    OUT_PNG.parent.mkdir(parents=True, exist_ok=True)
    sheet = build_sheet()
    assert sheet.size == (288, 256), f"Unexpected size: {sheet.size}"
    sheet.save(OUT_PNG, format="PNG", optimize=True)

    buf = io.BytesIO()
    sheet.save(buf, format="PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    data_url = f"data:image/png;base64,{b64}"

    ts_content = f'''// Auto-generated by scripts/content/monsters/build_skybird_charset.py
// RM2000 288x256 CharSet (8 slots x 3 frames x 4 directions, 24x32px per cell)
import type {{ UploadedAsset }} from "@/project/types";

export const DAWNING_SKYBIRDS_CHARSET_ID = "oprn-charset-dawning-skybirds" as const;

export const DAWNING_SKYBIRDS_DATA_URL = "{data_url}";

export const DAWNING_SKYBIRDS_UPLOADED_ASSET: UploadedAsset = {{
  id: DAWNING_SKYBIRDS_CHARSET_ID,
  name: "다우닝 시티 · 여명의 날개 새 캐릭터셋 (여명갈매기·창공제비·별빛방울새·새떼)",
  kind: "charset",
  dataUrl: DAWNING_SKYBIRDS_DATA_URL,
  meta: {{
    width: 288,
    height: 256,
    frameWidth: 24,
    frameHeight: 32,
  }},
}};
'''
    OUT_TS.write_text(ts_content, encoding="utf-8")
    print(f"Wrote {OUT_PNG} ({sheet.size[0]}x{sheet.size[1]}) and {OUT_TS} ({len(data_url)} chars)")


if __name__ == "__main__":
    main()
