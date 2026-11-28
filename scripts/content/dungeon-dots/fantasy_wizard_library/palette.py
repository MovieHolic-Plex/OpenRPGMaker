#!/usr/bin/env python3
"""Curated & locked Beodeul Wizard Library palette + pixel drawing utilities.

Every hex color is sampled directly from the official Beodeul kit references:
  - ref_bd6_row_3x.png
  - ref_beodeul_props_best_4x.png
  - ref_beodeul_style_row_4x.png
  - ref_bd9_row_2x.png
Zero pure #000000, zero neon plastic, zero sepia/yellow wash.
Optional ground shadow is strictly #4c557f @ alpha 85/255.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

from PIL import Image

WORKTREE = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
REFS_DIR = WORKTREE / "tiledata/dungeon-pilot/_dots_kit_refs"
OUT_DIR = WORKTREE / "tiledata/dungeon-dots/fantasy_wizard_library"

SHADOW_HEX = "#4c557f"
SHADOW_RGBA = (0x4C, 0x55, 0x7F, 85)

# Curated 70-color Beodeul Wizard Library palette (all verified exact hexes from beodeul_palette_refs.json)
PALETTE_RAMPS: dict[str, dict[str, str]] = {
    "stone": {
        "out": "#27282f",
        "0": "#37383f",
        "1": "#53545a",
        "2": "#6c6e6d",
        "3": "#828382",
        "4": "#a6a8a5",
        "5": "#c4c6c3",
        "6": "#dadcd9",
    },
    "slate": {
        "out": "#1c1c26",
        "0": "#2b2e34",
        "1": "#404349",
        "2": "#5a5b62",
        "3": "#797a82",
        "4": "#a0a2ac",
    },
    "dark_oak": {
        "out": "#1f130b",
        "0": "#2d1c12",
        "1": "#442c19",
        "2": "#60402b",
        "3": "#805338",
        "4": "#a56846",
    },
    "oak": {
        "out": "#382315",
        "0": "#583a24",
        "1": "#774d2a",
        "2": "#9a6841",
        "3": "#bd9056",
        "4": "#d8aa73",
        "5": "#e9c28e",
    },
    "iron": {
        "out": "#141b2c",
        "0": "#28303c",
        "1": "#424956",
        "2": "#697782",
        "3": "#aebdca",
    },
    "brass": {
        "out": "#4e3d22",
        "0": "#72552b",
        "1": "#a6874c",
        "2": "#c9aa64",
        "3": "#efc97b",
        "4": "#fff0c0",
    },
    "parchment": {
        "out": "#5f5145",
        "0": "#8e8574",
        "1": "#beb6a1",
        "2": "#ded6bc",
        "3": "#f2e6cf",
    },
    "crimson": {
        "out": "#421b1d",
        "0": "#6b2c2b",
        "1": "#8c3938",
        "2": "#a44332",
        "3": "#c65340",
    },
    "flame": {
        "0": "#b8280e",
        "1": "#e0482a",
        "2": "#f08a10",
        "3": "#f2c74a",
        "4": "#fff2a5",
    },
    "teal": {
        "out": "#0c2222",
        "0": "#1a4640",
        "1": "#2a6f71",
        "2": "#3fa2ae",
        "3": "#84c8ce",
        "4": "#cff4f8",
    },
    "indigo": {
        "out": "#141231",
        "0": "#26305a",
        "1": "#3b4f88",
        "2": "#7899bf",
    },
    "moss": {
        "out": "#1d2d19",
        "0": "#355136",
        "1": "#518153",
        "2": "#76a86a",
        "3": "#a8ca5c",
    },
    "plum": {
        "0": "#492545",
        "1": "#772f49",
    },
}

# Flat lookup name -> hex
C: dict[str, str] = {}
for ramp_name, entries in PALETTE_RAMPS.items():
    for step, hx in entries.items():
        C[f"{ramp_name}_{step}"] = hx

# Short convenient aliases
ST_O, ST0, ST1, ST2, ST3, ST4, ST5, ST6 = (
    C["stone_out"], C["stone_0"], C["stone_1"], C["stone_2"],
    C["stone_3"], C["stone_4"], C["stone_5"], C["stone_6"],
)
SL_O, SL0, SL1, SL2, SL3, SL4 = (
    C["slate_out"], C["slate_0"], C["slate_1"], C["slate_2"], C["slate_3"], C["slate_4"],
)
DO_O, DO0, DO1, DO2, DO3, DO4 = (
    C["dark_oak_out"], C["dark_oak_0"], C["dark_oak_1"], C["dark_oak_2"], C["dark_oak_3"], C["dark_oak_4"],
)
OK_O, OK0, OK1, OK2, OK3, OK4, OK5 = (
    C["oak_out"], C["oak_0"], C["oak_1"], C["oak_2"], C["oak_3"], C["oak_4"], C["oak_5"],
)
IR_O, IR0, IR1, IR2, IR3 = (
    C["iron_out"], C["iron_0"], C["iron_1"], C["iron_2"], C["iron_3"],
)
GD_O, GD0, GD1, GD2, GD3, GD4 = (
    C["brass_out"], C["brass_0"], C["brass_1"], C["brass_2"], C["brass_3"], C["brass_4"],
)
PA_O, PA0, PA1, PA2, PA3 = (
    C["parchment_out"], C["parchment_0"], C["parchment_1"], C["parchment_2"], C["parchment_3"],
)
RD_O, RD0, RD1, RD2, RD3 = (
    C["crimson_out"], C["crimson_0"], C["crimson_1"], C["crimson_2"], C["crimson_3"],
)
FL0, FL1, FL2, FL3, FL4 = (
    C["flame_0"], C["flame_1"], C["flame_2"], C["flame_3"], C["flame_4"],
)
TL_O, TL0, TL1, TL2, TL3, TL4 = (
    C["teal_out"], C["teal_0"], C["teal_1"], C["teal_2"], C["teal_3"], C["teal_4"],
)
BL_O, BL0, BL1, BL2 = (
    C["indigo_out"], C["indigo_0"], C["indigo_1"], C["indigo_2"],
)
GR_O, GR0, GR1, GR2, GR3 = (
    C["moss_out"], C["moss_0"], C["moss_1"], C["moss_2"], C["moss_3"],
)
PL0, PL1 = C["plum_0"], C["plum_1"]


def hex_to_rgba(hx: str, alpha: int = 255) -> tuple[int, int, int, int]:
    hx = hx.lstrip("#")
    return (int(hx[0:2], 16), int(hx[2:4], 16), int(hx[4:6], 16), alpha)


ALLOWED_RGB: set[tuple[int, int, int]] = {hex_to_rgba(hx)[:3] for hx in C.values()}

# Map each palette RGB to its material's darkest outline color (for crisp 1px material-matched outlines)
MATERIAL_OUTLINE_FOR_HEX: dict[str, str] = {}
for ramp_name, entries in PALETTE_RAMPS.items():
    out_hx = entries.get("out")
    if out_hx is None:
        if ramp_name == "flame":
            out_hx = RD_O
        elif ramp_name == "plum":
            out_hx = BL_O
        else:
            out_hx = SL_O
    for hx in entries.values():
        MATERIAL_OUTLINE_FOR_HEX[hx.lower()] = out_hx


class PixelCanvas:
    """Strict palette-locked pixel-art canvas for RM2000 16px-grid sprites."""

    def __init__(self, width: int, height: int):
        self.w = width
        self.h = height
        self.img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        self.px = self.img.load()

    def set(self, x: int, y: int, hx: str | None) -> None:
        if not (0 <= x < self.w and 0 <= y < self.h):
            return
        if hx is None:
            self.px[x, y] = (0, 0, 0, 0)
            return
        rgba = hex_to_rgba(hx)
        assert rgba[:3] in ALLOWED_RGB, f"Color {hx} not in locked palette!"
        self.px[x, y] = rgba

    def get(self, x: int, y: int) -> tuple[int, int, int, int]:
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.px[x, y]
        return (0, 0, 0, 0)

    def set_shadow(self, x: int, y: int) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            if self.px[x, y][3] == 0:
                self.px[x, y] = SHADOW_RGBA

    def rect(self, x0: int, y0: int, x1: int, y1: int, hx: str | None) -> None:
        """Inclusive rectangle fill [x0..x1] x [y0..y1]."""
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, hx)

    def hline(self, x0: int, x1: int, y: int, hx: str | None) -> None:
        for x in range(x0, x1 + 1):
            self.set(x, y, hx)

    def vline(self, x: int, y0: int, y1: int, hx: str | None) -> None:
        for y in range(y0, y1 + 1):
            self.set(x, y, hx)

    def box_outline(self, x0: int, y0: int, x1: int, y1: int, hx: str) -> None:
        self.hline(x0, x1, y0, hx)
        self.hline(x0, x1, y1, hx)
        self.vline(x0, y0, y1, hx)
        self.vline(x1, y0, y1, hx)

    def ellipse(self, cx: float, cy: float, rx: float, ry: float, hx: str | None) -> None:
        for y in range(self.h):
            for x in range(self.w):
                dx = (x - cx) / rx if rx > 0 else 0.0
                dy = (y - cy) / ry if ry > 0 else 0.0
                if dx * dx + dy * dy <= 1.0:
                    self.set(x, y, hx)

    def add_shadow_ellipse(self, cx: float, cy: float, rx: float, ry: float) -> None:
        for y in range(self.h):
            for x in range(self.w):
                dx = (x - cx) / rx if rx > 0 else 0.0
                dy = (y - cy) / ry if ry > 0 else 0.0
                if dx * dx + dy * dy <= 1.0:
                    self.set_shadow(x, y)

    def add_shadow_bar(self, x0: int, x1: int, y: int) -> None:
        for x in range(x0, x1 + 1):
            self.set_shadow(x, y)

    def enforce_dark_outline(self, override_color: str | None = None, skip_coords: Iterable[tuple[int, int]] = ()) -> None:
        """Ensure every opaque pixel touching transparency (4-connected) is darkened to its material outline."""
        skip = set(skip_coords)
        to_outline: list[tuple[int, int, str]] = []
        for y in range(self.h):
            for x in range(self.w):
                if (x, y) in skip:
                    continue
                r, g, b, a = self.px[x, y]
                if a != 255:
                    continue
                touches_empty = False
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if not (0 <= nx < self.w and 0 <= ny < self.h) or self.px[nx, ny][3] != 255:
                        touches_empty = True
                        break
                if touches_empty:
                    luma = 0.299 * r + 0.587 * g + 0.114 * b
                    if luma > 78:
                        hx = f"#{r:02x}{g:02x}{b:02x}"
                        out_hx = override_color or MATERIAL_OUTLINE_FOR_HEX.get(hx, SL_O)
                        to_outline.append((x, y, out_hx))
        for x, y, out_hx in to_outline:
            self.set(x, y, out_hx)

    def add_outer_outline(self, default_color: str | None = None) -> None:
        """Grow a 1px dark outline into transparent pixels adjacent (4-connected) to opaque pixels."""
        add_list: list[tuple[int, int, str]] = []
        for y in range(self.h):
            for x in range(self.w):
                if self.px[x, y][3] == 255:
                    continue
                neighbor_hx = None
                for nx, ny in ((x, y - 1), (x - 1, y), (x + 1, y), (x, y + 1)):
                    if 0 <= nx < self.w and 0 <= ny < self.h and self.px[nx, ny][3] == 255:
                        r, g, b, _ = self.px[nx, ny]
                        neighbor_hx = f"#{r:02x}{g:02x}{b:02x}"
                        break
                if neighbor_hx is not None:
                    out_hx = default_color or MATERIAL_OUTLINE_FOR_HEX.get(neighbor_hx, SL_O)
                    add_list.append((x, y, out_hx))
        for x, y, out_hx in add_list:
            self.set(x, y, out_hx)

    def opaque_bbox(self) -> tuple[int, int, int, int] | None:
        xs, ys = [], []
        for y in range(self.h):
            for x in range(self.w):
                if self.px[x, y][3] == 255:
                    xs.append(x)
                    ys.append(y)
        if not xs:
            return None
        return (min(xs), min(ys), max(xs), max(ys))

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self.img.save(path)


def export_palette_json() -> Path:
    """Verify every color exists in official Beodeul refs and write palette_beodeul_library.json."""
    ref_path = REFS_DIR / "beodeul_palette_refs.json"
    ref_colors = {c.lower() for c in json.loads(ref_path.read_text())["colors"]}
    missing = [hx for hx in C.values() if hx.lower() not in ref_colors]
    if missing:
        raise ValueError(f"Palette colors not found in beodeul_palette_refs.json: {missing}")

    unique_colors = sorted({hx.lower() for hx in C.values()})
    payload = {
        "name": "beodeul_fantasy_wizard_library",
        "setting": "Beodeul (버들항) Wizard Tower, Grand Library & Alchemy Workshop",
        "scale": "16x16 px map tiles, 0.13 px/cm (170cm char = 22px)",
        "sources": [
            "ref_bd6_row_3x.png",
            "ref_beodeul_props_best_4x.png",
            "ref_beodeul_style_row_4x.png",
            "ref_bd9_row_2x.png",
        ],
        "shadow": {"hex": SHADOW_HEX, "alpha": 85},
        "color_count": len(unique_colors),
        "ramps": PALETTE_RAMPS,
        "colors": unique_colors,
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / "palette_beodeul_library.json"
    out_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return out_path


if __name__ == "__main__":
    p = export_palette_json()
    print(f"Exported locked Beodeul palette ({len(ALLOWED_RGB)} colors) -> {p}")
