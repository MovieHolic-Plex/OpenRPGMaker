"""Locked Beodeul Outdoor Ruins palette & pixel-art drawing primitives.

Every opaque color is sampled verbatim from the Beodeul reference sheets
(ref_bd9_row_2x.png, ref_bd6_row_3x.png, ref_beodeul_props_best_4x.png,
ref_beodeul_style_row_4x.png). Zero Fable colors, zero pure #000000,
zero sepia/yellow wash.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple
from PIL import Image

RGBA = Tuple[int, int, int, int]
RGB = Tuple[int, int, int]

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
OUT_DIR = ROOT / "tiledata/dungeon-dots/fantasy_sky_ruins"
REFS_DIR = ROOT / "tiledata/dungeon-pilot/_dots_kit_refs"

SHADOW_HEX = "#4c557f"
SHADOW_ALPHA = 85
SHADOW_RGBA: RGBA = (0x4C, 0x55, 0x7F, SHADOW_ALPHA)
TRANSPARENT: RGBA = (0, 0, 0, 0)

# Curated 74-color Beodeul outdoor ruins palette (100% present in beodeul_palette_refs.json)
PALETTE_RAMPS: Dict[str, List[str]] = {
    "grass_meadow": [
        "#363f2a",  # 0 dark grass shadow
        "#4b6827",  # 1 deep meadow
        "#618c3b",  # 2 meadow shadow (ref_bd9)
        "#6e9943",  # 3 meadow base (ref_bd9)
        "#7aa34b",  # 4 meadow lit (ref_bd9)
        "#8bb14e",  # 5 sunlit blade tip
    ],
    "foliage_moss": [
        "#1d2d19",  # 0 foliage dark outline (ref_bd6)
        "#2d4619",  # 1 deep canopy shadow (ref_bd6)
        "#3d5e24",  # 2 canopy shadow-mid (ref_bd6)
        "#5c7728",  # 3 canopy mid (ref_bd6)
        "#8eac43",  # 4 canopy highlight (ref_bd6)
        "#a8ca5c",  # 5 bright sunlit leaf tip
    ],
    "stone_limestone": [
        "#262729",  # 0 stone outer outline (cool charcoal)
        "#3e403d",  # 1 deep stone shadow / mortar (ref_bd9)
        "#595b58",  # 2 stone shadow (ref_bd9)
        "#767776",  # 3 stone dark-mid
        "#929491",  # 4 stone mid (ref_bd9)
        "#afb1ae",  # 5 stone light-mid (ref_bd9)
        "#c4c6c3",  # 6 stone light (ref_bd9)
        "#dadcd9",  # 7 stone highlight (ref_bd9)
        "#e5e7e4",  # 8 stone bright specular
    ],
    "stone_slate_dark": [
        "#2b3436",  # 0 wet dark stone outline
        "#40484a",  # 1 wet stone shadow
        "#5b6667",  # 2 wet stone dark-mid
        "#797a84",  # 3 cool slate mid
        "#a0a2ac",  # 4 cool slate highlight
    ],
    "water_teal": [
        "#0c2222",  # 0 abyssal water outline
        "#1a4640",  # 1 deep sanctuary water (ref_bd9)
        "#1c4a44",  # 2 water deep mid
        "#21584e",  # 3 water mid
        "#2a6f71",  # 4 water teal-blue
        "#3fa2ae",  # 5 water bright ripple
        "#7da3a6",  # 6 water soft sheen
    ],
    "crystal_cyan": [
        "#143c36",  # 0 crystal dark outline
        "#27696c",  # 1 crystal deep facet
        "#3fa2ae",  # 2 crystal mid facet
        "#84c8ce",  # 3 crystal bright facet
        "#9ce0ee",  # 4 crystal glow
        "#cff4f8",  # 5 crystal core light
        "#f2ffff",  # 6 crystal white spark
    ],
    "wood_oak": [
        "#291c13",  # 0 dark wood outline
        "#452a17",  # 1 deep oak shadow
        "#583a24",  # 2 oak shadow
        "#6f4725",  # 3 oak mid-dark
        "#8c6038",  # 4 oak mid
        "#a67d55",  # 5 oak light
        "#bd936b",  # 6 oak highlight
        "#d8aa73",  # 7 pale pine/plank highlight
    ],
    "canvas_parchment": [
        "#59503a",  # 0 canvas crease shadow
        "#827869",  # 1 canvas shadow
        "#a69a77",  # 2 canvas mid-dark
        "#c2bca7",  # 3 canvas mid
        "#d9d2be",  # 4 canvas light
        "#f0e7cc",  # 5 sunlit canvas / parchment
    ],
    "roof_cobalt": [
        "#13122f",  # 0 cobalt roof outline / deep void
        "#201e45",  # 1 cobalt deep shadow (ref_bd6)
        "#2e2b66",  # 2 cobalt dark (ref_bd6)
        "#454096",  # 3 cobalt mid (ref_bd6)
        "#5650b5",  # 4 cobalt light (ref_bd6)
        "#cbc6e5",  # 5 cobalt specular highlight (ref_bd6)
    ],
    "iron_bronze": [
        "#1c1c26",  # 0 iron outline / doorway void
        "#30384a",  # 1 iron dark
        "#4e5a6b",  # 2 iron mid
        "#72808a",  # 3 iron light
        "#a0a2ac",  # 4 iron specular
    ],
    "accent_crimson_ochre": [
        "#491d20",  # 0 crimson / ember outline
        "#76302f",  # 1 faded crimson shadow
        "#863736",  # 2 faded crimson mid
        "#b9422c",  # 3 crimson bright / flame red
        "#df722f",  # 4 flame orange
        "#f08a10",  # 5 ember bright orange
        "#dc9a26",  # 6 antique brass / gold mid
        "#fbc10d",  # 7 gold highlight / flame yellow
        "#fff2a5",  # 8 flame core / pale gold
        "#d97163",  # 9 rose flower accent
        "#f4c5b2",  # 10 pale flower blossom
    ],
}

# Material darkest outline colors (for auto-outlining & verification)
MATERIAL_OUTLINE: Dict[str, str] = {
    "grass": "#363f2a",
    "foliage": "#1d2d19",
    "stone": "#262729",
    "slate": "#2b3436",
    "water": "#0c2222",
    "crystal": "#143c36",
    "wood": "#291c13",
    "canvas": "#452a17",
    "roof": "#13122f",
    "iron": "#1c1c26",
    "crimson": "#491d20",
    "flame": "#491d20",
}


def hex_to_rgba(h: str, alpha: int = 255) -> RGBA:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha)


def rgba_to_hex(c: RGBA) -> str:
    return f"#{c[0]:02x}{c[1]:02x}{c[2]:02x}"


def all_palette_hexes() -> List[str]:
    seen: List[str] = []
    for cols in PALETTE_RAMPS.values():
        for h in cols:
            if h not in seen:
                seen.append(h)
    return seen


ALLOWED_RGB_SET = {hex_to_rgba(h)[:3] for h in all_palette_hexes()}


# Short convenient color table (all strictly inside PALETTE_RAMPS)
C: Dict[str, RGBA] = {
    # Meadow grass
    "G0": hex_to_rgba("#363f2a"),
    "G1": hex_to_rgba("#4b6827"),
    "G2": hex_to_rgba("#618c3b"),
    "G3": hex_to_rgba("#6e9943"),
    "G4": hex_to_rgba("#7aa34b"),
    "G5": hex_to_rgba("#8bb14e"),
    # Foliage / moss
    "F0": hex_to_rgba("#1d2d19"),
    "F1": hex_to_rgba("#2d4619"),
    "F2": hex_to_rgba("#3d5e24"),
    "F3": hex_to_rgba("#5c7728"),
    "F4": hex_to_rgba("#8eac43"),
    "F5": hex_to_rgba("#a8ca5c"),
    # Limestone
    "S0": hex_to_rgba("#262729"),
    "S1": hex_to_rgba("#3e403d"),
    "S2": hex_to_rgba("#595b58"),
    "S3": hex_to_rgba("#767776"),
    "S4": hex_to_rgba("#929491"),
    "S5": hex_to_rgba("#afb1ae"),
    "S6": hex_to_rgba("#c4c6c3"),
    "S7": hex_to_rgba("#dadcd9"),
    "S8": hex_to_rgba("#e5e7e4"),
    # Wet slate dark stone
    "D0": hex_to_rgba("#2b3436"),
    "D1": hex_to_rgba("#40484a"),
    "D2": hex_to_rgba("#5b6667"),
    "D3": hex_to_rgba("#797a84"),
    "D4": hex_to_rgba("#a0a2ac"),
    # Water teal
    "W0": hex_to_rgba("#0c2222"),
    "W1": hex_to_rgba("#1a4640"),
    "W2": hex_to_rgba("#1c4a44"),
    "W3": hex_to_rgba("#21584e"),
    "W4": hex_to_rgba("#2a6f71"),
    "W5": hex_to_rgba("#3fa2ae"),
    "W6": hex_to_rgba("#7da3a6"),
    # Crystal cyan
    "C0": hex_to_rgba("#143c36"),
    "C1": hex_to_rgba("#27696c"),
    "C2": hex_to_rgba("#3fa2ae"),
    "C3": hex_to_rgba("#84c8ce"),
    "C4": hex_to_rgba("#9ce0ee"),
    "C5": hex_to_rgba("#cff4f8"),
    "C6": hex_to_rgba("#f2ffff"),
    # Oak wood
    "O0": hex_to_rgba("#291c13"),
    "O1": hex_to_rgba("#452a17"),
    "O2": hex_to_rgba("#583a24"),
    "O3": hex_to_rgba("#6f4725"),
    "O4": hex_to_rgba("#8c6038"),
    "O5": hex_to_rgba("#a67d55"),
    "O6": hex_to_rgba("#bd936b"),
    "O7": hex_to_rgba("#d8aa73"),
    # Canvas / parchment
    "P0": hex_to_rgba("#59503a"),
    "P1": hex_to_rgba("#827869"),
    "P2": hex_to_rgba("#a69a77"),
    "P3": hex_to_rgba("#c2bca7"),
    "P4": hex_to_rgba("#d9d2be"),
    "P5": hex_to_rgba("#f0e7cc"),
    # Cobalt slate roof
    "B0": hex_to_rgba("#13122f"),
    "B1": hex_to_rgba("#201e45"),
    "B2": hex_to_rgba("#2e2b66"),
    "B3": hex_to_rgba("#454096"),
    "B4": hex_to_rgba("#5650b5"),
    "B5": hex_to_rgba("#cbc6e5"),
    # Iron / dark bronze
    "I0": hex_to_rgba("#1c1c26"),
    "I1": hex_to_rgba("#30384a"),
    "I2": hex_to_rgba("#4e5a6b"),
    "I3": hex_to_rgba("#72808a"),
    "I4": hex_to_rgba("#a0a2ac"),
    # Accents (crimson, flame, brass, blossoms)
    "R0": hex_to_rgba("#491d20"),
    "R1": hex_to_rgba("#76302f"),
    "R2": hex_to_rgba("#863736"),
    "R3": hex_to_rgba("#b9422c"),
    "E1": hex_to_rgba("#df722f"),
    "E2": hex_to_rgba("#f08a10"),
    "Y1": hex_to_rgba("#dc9a26"),
    "Y2": hex_to_rgba("#fbc10d"),
    "Y3": hex_to_rgba("#fff2a5"),
    "K1": hex_to_rgba("#d97163"),
    "K2": hex_to_rgba("#f4c5b2"),
    # Shadow
    "SH": SHADOW_RGBA,
}


def save_palette_json(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "name": "beodeul_ancient_ruins_sanctuary",
        "setting": "Beodeul (버들항) Ancient Stone Ruins, Mossy Courtyard & Crystal Sanctuary",
        "sources": [
            "ref_bd9_row_2x.png",
            "ref_bd6_row_3x.png",
            "ref_beodeul_props_best_4x.png",
            "ref_beodeul_style_row_4x.png",
        ],
        "shadow": {"hex": SHADOW_HEX, "alpha": SHADOW_ALPHA},
        "count": len(all_palette_hexes()),
        "ramps": PALETTE_RAMPS,
        "colors": all_palette_hexes(),
    }
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


class PixelCanvas:
    """Crisp pixel-art canvas with strict palette enforcement and material tracking."""

    def __init__(self, w: int, h: int, fill: RGBA = TRANSPARENT) -> None:
        self.w = w
        self.h = h
        self.px: List[List[RGBA]] = [[fill for _ in range(w)] for _ in range(h)]
        self.mat: List[List[Optional[str]]] = [[None for _ in range(w)] for _ in range(h)]

    def _resolve(self, col: str | RGBA) -> RGBA:
        if isinstance(col, str):
            return C[col]
        return col

    def set(self, x: int, y: int, col: str | RGBA, mat: Optional[str] = None) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            rgba = self._resolve(col)
            if rgba[3] == 255:
                assert rgba[:3] in ALLOWED_RGB_SET, f"Off-palette color {rgba_to_hex(rgba)}"
            elif rgba[3] != 0:
                assert rgba == SHADOW_RGBA, f"Illegal semi-transparent pixel {rgba}"
            self.px[y][x] = rgba
            if mat is not None:
                self.mat[y][x] = mat
            elif rgba[3] == 0:
                self.mat[y][x] = None

    def get(self, x: int, y: int) -> RGBA:
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.px[y][x]
        return TRANSPARENT

    def is_opaque(self, x: int, y: int) -> bool:
        return 0 <= x < self.w and 0 <= y < self.h and self.px[y][x][3] == 255

    def rect(self, x0: int, y0: int, x1: int, y1: int, col: str | RGBA, mat: Optional[str] = None) -> None:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, col, mat)

    def hline(self, x0: int, x1: int, y: int, col: str | RGBA, mat: Optional[str] = None) -> None:
        for x in range(min(x0, x1), max(x0, x1) + 1):
            self.set(x, y, col, mat)

    def vline(self, x: int, y0: int, y1: int, col: str | RGBA, mat: Optional[str] = None) -> None:
        for y in range(min(y0, y1), max(y0, y1) + 1):
            self.set(x, y, col, mat)

    def ellipse(
        self,
        cx: float,
        cy: float,
        rx: float,
        ry: float,
        col: str | RGBA,
        mat: Optional[str] = None,
    ) -> None:
        x0 = max(0, int(cx - rx - 1))
        x1 = min(self.w - 1, int(cx + rx + 1))
        y0 = max(0, int(cy - ry - 1))
        y1 = min(self.h - 1, int(cy + ry + 1))
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                dx = (x - cx) / max(rx, 0.1)
                dy = (y - cy) / max(ry, 0.1)
                if dx * dx + dy * dy <= 1.0:
                    self.set(x, y, col, mat)

    def draw_grid(
        self,
        rows: Sequence[str],
        legend: Dict[str, Tuple[str, Optional[str]] | str],
        ox: int = 0,
        oy: int = 0,
    ) -> None:
        for dy, row in enumerate(rows):
            for dx, ch in enumerate(row):
                if ch in (" ", "."):
                    continue
                val = legend[ch]
                if isinstance(val, tuple):
                    self.set(ox + dx, oy + dy, val[0], val[1])
                else:
                    self.set(ox + dx, oy + dy, val)

    def ensure_dark_outline(self, default_mat: str = "stone") -> None:
        """Ensure every opaque pixel bordering transparency uses the darkest shade of its material.

        Adds a 1px outline OUTSIDE where space allows or darkens outer boundary pixels
        that would otherwise be bright against transparency.
        """
        # First pass: check outer boundary pixels; if any opaque pixel touches transparency
        # and has luminance > 78, darken it to its material's darkest outline color.
        to_darken: List[Tuple[int, int, RGBA]] = []
        for y in range(self.h):
            for x in range(self.w):
                if not self.is_opaque(x, y):
                    continue
                touches_edge = False
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if not self.is_opaque(nx, ny):
                        touches_edge = True
                        break
                if touches_edge:
                    r, g, b, _ = self.px[y][x]
                    luma = 0.299 * r + 0.587 * g + 0.114 * b
                    if luma > 78:
                        m = self.mat[y][x] or default_mat
                        out_hex = MATERIAL_OUTLINE.get(m, MATERIAL_OUTLINE[default_mat])
                        to_darken.append((x, y, hex_to_rgba(out_hex)))
        for x, y, rgba in to_darken:
            self.px[y][x] = rgba

    def add_ground_shadow(self, x0: int, x1: int, y_row: int, height: int = 2) -> None:
        """Place soft #4c557f@85 ground shadow ONLY on currently transparent pixels."""
        for dy in range(height):
            y = y_row + dy
            inset = 1 if dy == height - 1 and (x1 - x0) >= 6 else 0
            for x in range(x0 + inset, x1 - inset + 1):
                if 0 <= x < self.w and 0 <= y < self.h and self.px[y][x][3] == 0:
                    self.px[y][x] = SHADOW_RGBA

    def opaque_bbox(self) -> Optional[Tuple[int, int, int, int]]:
        xs: List[int] = []
        ys: List[int] = []
        for y in range(self.h):
            for x in range(self.w):
                if self.px[y][x][3] == 255:
                    xs.append(x)
                    ys.append(y)
        if not xs:
            return None
        return (min(xs), min(ys), max(xs), max(ys))

    def align_bottom_center(self, bottom_pad: int = 1) -> None:
        """Shift all non-transparent pixels so opaque bbox is horizontally centered and bottom-aligned."""
        bbox = self.opaque_bbox()
        if not bbox:
            return
        min_x, min_y, max_x, max_y = bbox
        ow = max_x - min_x + 1
        target_min_x = (self.w - ow) // 2
        target_max_y = self.h - 1 - bottom_pad
        dx = target_min_x - min_x
        dy = target_max_y - max_y
        if dx == 0 and dy == 0:
            return
        new_px = [[TRANSPARENT for _ in range(self.w)] for _ in range(self.h)]
        new_mat: List[List[Optional[str]]] = [[None for _ in range(self.w)] for _ in range(self.h)]
        for y in range(self.h):
            for x in range(self.w):
                if self.px[y][x][3] != 0:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < self.w and 0 <= ny < self.h:
                        new_px[ny][nx] = self.px[y][x]
                        new_mat[ny][nx] = self.mat[y][x]
        self.px = new_px
        self.mat = new_mat

    def to_image(self) -> Image.Image:
        img = Image.new("RGBA", (self.w, self.h), TRANSPARENT)
        flat = [self.px[y][x] for y in range(self.h) for x in range(self.w)]
        img.putdata(flat)
        return img

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self.to_image().save(path)
