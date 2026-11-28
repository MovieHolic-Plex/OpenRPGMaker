"""Palette loader and strict pixel-art Canvas helper locked to modern_palette_v3.json."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable, Tuple
from PIL import Image

REPO_ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
REFS_DIR = REPO_ROOT / "tiledata" / "dungeon-pilot" / "_dots_kit_refs"
PALETTE_JSON = REFS_DIR / "modern_palette_v3.json"
REF_CHAR_PATH = REFS_DIR / "ref_mod1_char.png"

OUT_ROOT = REPO_ROOT / "tiledata" / "dungeon-dots" / "modern_pcbang"
TILES_DIR = OUT_ROOT / "tiles"
OBJECTS_DIR = OUT_ROOT / "objects"

RGBA = Tuple[int, int, int, int]
TRANSPARENT: RGBA = (0, 0, 0, 0)


def hex_to_rgba(h: str, alpha: int = 255) -> RGBA:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha)


def load_palette():
    with open(PALETTE_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
    ramps_rgba = {
        name: [hex_to_rgba(c) for c in cols]
        for name, cols in data["ramps"].items()
    }
    valid_opaque = {hex_to_rgba(c) for c in data["all_colors"]}
    shadow_rgba = tuple(data["shadow_rgba"])  # (76, 85, 127, 85)
    return data, ramps_rgba, valid_opaque, shadow_rgba


PALETTE_DATA, RAMPS, VALID_OPAQUE, SHADOW = load_palette()

# Shorthand ramps (index 0 = darkest outline shade, higher = brighter)
R = RAMPS["crimson_red"]      # 0..6
O = RAMPS["rust_orange"]      # 0..6
A = RAMPS["amber_ochre"]      # 0..6
Y = RAMPS["gold_yellow"]      # 0..6
L = RAMPS["olive_lime"]       # 0..6
G = RAMPS["emerald_green"]    # 0..6
J = RAMPS["jade_mint"]        # 0..6
C = RAMPS["cyan_teal"]        # 0..6
K = RAMPS["sky_cerulean"]     # 0..6
B = RAMPS["cobalt_blue"]      # 0..6
I = RAMPS["indigo_violet"]    # 0..6
M = RAMPS["purple_magenta"]   # 0..6
P = RAMPS["rose_pink"]        # 0..6
S = RAMPS["cool_slate_gray"]  # 0..7
W = RAMPS["warm_skin_peach"]  # 0..4
DW = RAMPS["dark_wood_earth"] # 0..6
WT = RAMPS["warm_wood_tan"]   # 0..6


def lum(rgba: RGBA) -> float:
    return 0.299 * rgba[0] + 0.587 * rgba[1] + 0.114 * rgba[2]


class Canvas:
    """Strict RGBA pixel canvas enforcing 100% palette lock."""

    def __init__(self, w: int, h: int, fill: RGBA = TRANSPARENT):
        self.w = w
        self.h = h
        self.img = Image.new("RGBA", (w, h), TRANSPARENT)
        self.px = self.img.load()
        if fill != TRANSPARENT:
            self.fill_rect(0, 0, w, h, fill)

    def _validate(self, color: RGBA) -> None:
        if color == TRANSPARENT or color == SHADOW:
            return
        if color not in VALID_OPAQUE:
            raise ValueError(f"Off-palette color rejected: {color}")

    def p(self, x: int, y: int, color: RGBA) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            self._validate(color)
            self.px[x, y] = color

    def get(self, x: int, y: int) -> RGBA:
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.px[x, y]
        return TRANSPARENT

    def hline(self, x1: int, x2: int, y: int, color: RGBA) -> None:
        if x1 > x2:
            x1, x2 = x2, x1
        for x in range(x1, x2 + 1):
            self.p(x, y, color)

    def vline(self, x: int, y1: int, y2: int, color: RGBA) -> None:
        if y1 > y2:
            y1, y2 = y2, y1
        for y in range(y1, y2 + 1):
            self.p(x, y, color)

    def fill_rect(self, x: int, y: int, w: int, h: int, color: RGBA) -> None:
        self._validate(color)
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if 0 <= xx < self.w and 0 <= yy < self.h:
                    self.px[xx, yy] = color

    def rect(self, x: int, y: int, w: int, h: int, color: RGBA) -> None:
        if w <= 0 or h <= 0:
            return
        self.hline(x, x + w - 1, y, color)
        self.hline(x, x + w - 1, y + h - 1, color)
        self.vline(x, y, y + h - 1, color)
        self.vline(x + w - 1, y, y + h - 1, color)

    def box(self, x: int, y: int, w: int, h: int, fill: RGBA, outline: RGBA) -> None:
        self.fill_rect(x, y, w, h, fill)
        self.rect(x, y, w, h, outline)

    def add_ground_shadow(self, x1: int, x2: int, y: int) -> None:
        """Draw subtle ground shadow ONLY on transparent pixels."""
        for x in range(x1, x2 + 1):
            if 0 <= x < self.w and 0 <= y < self.h:
                if self.px[x, y][3] == 0:
                    self.px[x, y] = SHADOW

    def enforce_outer_outline(self, default_outline: RGBA = S[0]) -> None:
        """Safety check: ensure every opaque pixel touching non-opaque is dark (< lum 52)."""
        to_darken = []
        for y in range(self.h):
            for x in range(self.w):
                c = self.px[x, y]
                if c[3] != 255:
                    continue
                touches_empty = False
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if not (0 <= nx < self.w and 0 <= ny < self.h) or self.px[nx, ny][3] != 255:
                        touches_empty = True
                        break
                if touches_empty and lum(c) > 52:
                    to_darken.append((x, y))
        for x, y in to_darken:
            self.px[x, y] = default_outline

    def opaque_bbox(self) -> Tuple[int, int, int, int]:
        xs, ys = [], []
        for y in range(self.h):
            for x in range(self.w):
                if self.px[x, y][3] == 255:
                    xs.append(x)
                    ys.append(y)
        if not xs:
            return (0, 0, 0, 0)
        return (min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1)

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self.img.save(path)


def load_ref_char_1x() -> Image.Image:
    """Return 24x32 nearest-neighbor downscale of ref_mod1_char.png (72x96)."""
    src = Image.open(REF_CHAR_PATH).convert("RGBA")
    return src.resize((src.width // 3, src.height // 3), Image.Resampling.NEAREST)
