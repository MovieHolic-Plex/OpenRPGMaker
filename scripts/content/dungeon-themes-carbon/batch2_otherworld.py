#!/usr/bin/env python3
"""
T3 Dungeon Theme Objects Batch 2/4 — `otherworld` (마계 · 이세계 · 심연 6종)
Model: gemini-4-carbon (medium)

Sprites:
  1. portal-gate.png          (48x48, standing, op ~44x45)
  2. demon-throne.png         (32x48, standing, op ~28x44)
  3. corrupt-crystal-big.png  (32x32, standing, op ~28x29)
  4. corrupt-crystal.png      (16x32, standing, op ~14x28)
  5. bone-pillar.png          (16x32, standing, op ~14x30)
  6. void-brazier.png         (16x32, standing, op ~14x29)

Hard Rules Enforced:
  - 100% locked to modern_palette_v3.json (118 colors, 0 off-palette, 0 #000000).
  - Optional ground shadow ONLY #4c557f @ alpha 85/255; all other pixels alpha 0 or 255.
  - Strict 1px dark material outer outline on every opaque pixel touching non-opaque (4-connected).
  - Orthographic RM2000 standing camera: front face + narrow 1/4-1/3 lit top band, ZERO side walls.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
PALETTE_PATH = ROOT / "tiledata/dungeon-pilot/_dots_kit_refs/modern_palette_v3.json"
CHAR_REF_4X = ROOT / "tiledata/dungeon-pilot/_dots_kit_refs/ref_beodeul_char_4x.png"
OUT_DIR = ROOT / "tiledata/dungeon-themes-carbon/otherworld/objects"
PREVIEW_PATH = ROOT / "tiledata/dungeon-themes-carbon/otherworld/preview_otherworld.png"

TRANSPARENT = (0, 0, 0, 0)
SHADOW_RGBA = (0x4C, 0x55, 0x7F, 85)  # #4c557f @ alpha 85/255

# 2-char tokens mapped 100% to modern_palette_v3.json
TOKENS: dict[str, str] = {
    # Obsidian / Iron / Cool Bleached Bone (cool_slate_gray)
    "s0": "#141622",  # dark obsidian/iron outline (luma 22.8)
    "s1": "#2e3040",  # deep obsidian/iron shadow
    "s2": "#4e5062",  # mid-dark obsidian/iron body
    "s3": "#707282",  # mid stone / iron bevel / bone shadow
    "s4": "#9698a4",  # lit obsidian top / iron rim / mid bone
    "s5": "#bec0c8",  # bright steel glint / bleached bone mid-lit
    "s6": "#e2e4e8",  # bleached bone lit
    "s7": "#fafaf8",  # pure white-ivory specular / skull highlight / vortex core
    # Indigo-Violet (indigo_violet)
    "v0": "#14112e",  # deep void indigo outline (luma 21.2)
    "v1": "#211850",  # abyssal portal deep
    "v2": "#2c1c72",  # dark indigo vortex
    "v3": "#361b94",  # royal indigo swirl
    "v4": "#4d29b6",  # vibrant violet
    "v5": "#7f5bd8",  # luminous violet rune/swirl
    "v6": "#b99afa",  # pale lilac glow
    # Purple-Magenta (purple_magenta)
    "p0": "#23112e",  # dark purple crystal/fire outline (luma 25.7)
    "p1": "#3c1850",  # deep plum shadow
    "p2": "#571c72",  # dark amethyst
    "p3": "#721b94",  # vivid purple
    "p4": "#9329b6",  # bright amethyst / fire mid
    "p5": "#bd5bd8",  # glowing orchid-magenta
    "p6": "#e89afa",  # dazzling lilac-pink core
    # Rose-Pink (rose_pink)
    "k0": "#2e1128",  # dark rose-magenta outline (luma 28.3)
    "k1": "#501840",  # deep wine crystal shadow
    "k2": "#721c53",  # dark magenta
    "k3": "#941b60",  # rich rose-crimson
    "k4": "#b6296e",  # vivid magenta-rose
    "k5": "#d85b8f",  # bright rose facet / coal glow
    "k6": "#fa9aba",  # dazzling pink specular
    # Crimson-Red (crimson_red)
    "r0": "#2e1119",  # dark crimson velvet/crystal outline (luma 26.6)
    "r1": "#501825",  # deep crimson velvet tuft shadow
    "r2": "#721c28",  # dark crimson velvet
    "r3": "#941b23",  # rich blood crimson
    "r4": "#b62b29",  # bright scarlet velvet lit
    "r5": "#d8665b",  # velvet highlight / crimson crystal edge
    "r6": "#faaa9a",  # pale crimson-pink specular
    # Amber-Ochre / Dark Gold / Horn (amber_ochre)
    "a0": "#2e1a11",  # dark horn / aged bone / bronze outline (luma 31.0)
    "a1": "#502f18",  # deep horn shadow
    "a2": "#72461c",  # dark bronze / horn mid-dark
    "a3": "#94601b",  # bronze mid
    "a4": "#b68429",  # lit dark-gold trim
    "a5": "#d8b55b",  # bright gold glint / warm horn light
    "a6": "#fae79a",  # pale ivory-gold highlight
    # Warm Bone / Earth accents
    "e0": "#0d0805",  # deepest abyssal crevice outline (luma 9.1)
    "e2": "#472f12",  # warm bone joint shadow
    "t2": "#a77950",  # aged warm bone / horn tan
    "w3": "#e6aa82",  # warm ivory-tan
    "w4": "#fad6b4",  # bleached warm bone highlight
}

# Strict dark material outer outlines (all luma <= 31.0)
DARK_OUTLINE_HEXES: set[str] = {
    TOKENS["s0"],  # #141622 obsidian / iron / skull
    TOKENS["v0"],  # #14112e void indigo
    TOKENS["p0"],  # #23112e purple crystal / eldritch fire
    TOKENS["k0"],  # #2e1128 magenta-rose crystal
    TOKENS["r0"],  # #2e1119 crimson velvet / blood shard
    TOKENS["a0"],  # #2e1a11 horn / aged bone / dark gold
    TOKENS["e0"],  # #0d0805 deep horn/bone crevice
}


def hex_to_rgba(hx: str) -> tuple[int, int, int, int]:
    hx = hx.lstrip("#")
    return (int(hx[0:2], 16), int(hx[2:4], 16), int(hx[4:6], 16), 255)


def luma(r: int, g: int, b: int) -> float:
    return 0.299 * r + 0.587 * g + 0.114 * b


def parse_grid(rows: list[str], w: int, h: int, name: str) -> Image.Image:
    assert len(rows) == h, f"{name}: expected {h} rows, got {len(rows)}"
    im = Image.new("RGBA", (w, h), TRANSPARENT)
    px = im.load()
    for y, row in enumerate(rows):
        cells = row.strip().split()
        assert len(cells) == w, f"{name} row {y}: expected {w} tokens, got {len(cells)}: {row}"
        for x, tok in enumerate(cells):
            if tok == "..":
                px[x, y] = TRANSPARENT
            elif tok == "sh":
                px[x, y] = SHADOW_RGBA
            else:
                assert tok in TOKENS, f"{name} ({x},{y}): unknown token {tok!r}"
                px[x, y] = hex_to_rgba(TOKENS[tok])
    return im


class GridCanvas:
    """2D token canvas with automatic material-matched 1px dark outer outline helper."""

    def __init__(self, w: int, h: int) -> None:
        self.w = w
        self.h = h
        self.grid: list[list[str]] = [[".." for _ in range(w)] for _ in range(h)]

    def set(self, x: int, y: int, tok: str) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            self.grid[y][x] = tok

    def get(self, x: int, y: int) -> str:
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.grid[y][x]
        return ".."

    def hline(self, x1: int, x2: int, y: int, tok: str) -> None:
        for x in range(min(x1, x2), max(x1, x2) + 1):
            self.set(x, y, tok)

    def vline(self, x: int, y1: int, y2: int, tok: str) -> None:
        for y in range(min(y1, y2), max(y1, y2) + 1):
            self.set(x, y, tok)

    def rect(self, x1: int, y1: int, x2: int, y2: int, tok: str) -> None:
        for y in range(min(y1, y2), max(y1, y2) + 1):
            for x in range(min(x1, x2), max(x1, x2) + 1):
                self.set(x, y, tok)

    def ashlar(
        self,
        x1: int,
        y1: int,
        x2: int,
        y2: int,
        hi: str = "s4",
        mid: str = "s2",
        lo: str = "s1",
        seam: str = "s0",
    ) -> None:
        """Volumetric top-left-lit obsidian ashlar block."""
        self.rect(x1, y1, x2, y2, mid)
        self.hline(x1, x2 - 1, y1, hi)
        self.vline(x1, y1, y2 - 1, hi)
        if x2 - x1 >= 2 and y2 - y1 >= 2:
            self.hline(x1 + 1, x2 - 1, y2 - 1, lo)
            self.vline(x2 - 1, y1 + 1, y2 - 1, lo)
        self.hline(x1, x2, y2, seam)
        self.vline(x2, y1, y2, seam)

    def stamp(self, ox: int, oy: int, rows: list[str]) -> None:
        for dy, r in enumerate(rows):
            for dx, tok in enumerate(r.strip().split()):
                if tok != "__":
                    self.set(ox + dx, oy + dy, tok)

    def enforce_dark_outer_outline(self) -> None:
        """Ensure every opaque pixel touching '..' or 'sh' or canvas edge is a dark material outline."""
        snapshot = [row[:] for row in self.grid]
        for y in range(self.h):
            for x in range(self.w):
                tok = snapshot[y][x]
                if tok in ("..", "sh"):
                    continue
                hx = TOKENS[tok]
                if hx in DARK_OUTLINE_HEXES:
                    continue
                touches_non_opaque = False
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if not (0 <= nx < self.w and 0 <= ny < self.h) or snapshot[ny][nx] in ("..", "sh"):
                        touches_non_opaque = True
                        break
                if touches_non_opaque:
                    prefix = tok[0]
                    if prefix == "p":
                        self.grid[y][x] = "p0"
                    elif prefix == "v":
                        self.grid[y][x] = "v0"
                    elif prefix == "k":
                        self.grid[y][x] = "k0"
                    elif prefix == "r":
                        self.grid[y][x] = "r0"
                    elif prefix in ("a", "t", "w", "e"):
                        self.grid[y][x] = "a0"
                    else:
                        self.grid[y][x] = "s0"

    def to_image(self, name: str) -> Image.Image:
        rows = [" ".join(row) for row in self.grid]
        return parse_grid(rows, self.w, self.h, name)


# ==============================================================================
# 4. corrupt-crystal.png (16x32, standing, op 14x28)
# Slender jagged pulsing purple-magenta crystal spire with floating shard & dark basalt base
# ==============================================================================
CORRUPT_CRYSTAL_ROWS = [
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 00
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 01
    ".. .. .. .. .. .. .. p0 p0 .. .. .. .. .. .. ..",  # 02 apex
    ".. .. .. .. .. .. p0 s7 p5 p0 .. .. .. .. .. ..",  # 03
    ".. .. .. .. .. p0 p0 s7 p6 p4 p0 .. p0 p0 .. ..",  # 04 + floating shard top
    ".. .. .. .. .. p0 s7 p6 p5 p3 p0 p0 s7 p5 p0 ..",  # 05
    ".. .. .. .. .. p0 p6 p5 p4 p2 p0 p0 p6 p4 p0 ..",  # 06
    ".. p0 p0 .. .. p0 p6 p5 p4 p2 p0 p0 p4 p0 p0 ..",  # 07 + left pulsing mote
    ".. p0 s7 p0 p0 p0 s7 p6 p4 p2 p1 p0 p0 .. .. ..",  # 08
    ".. p0 p5 p0 p0 s7 p6 p5 p3 p2 p1 p0 .. .. .. ..",  # 09
    ".. p0 p0 .. p0 p6 p5 k6 p4 p2 p1 p0 .. .. .. ..",  # 10 internal pink pulse
    ".. .. .. .. p0 p6 p5 s7 k5 p3 p1 p0 .. .. .. ..",  # 11 dazzling core glint
    ".. .. .. .. p0 p6 p5 k6 p4 p3 p2 p0 .. .. .. ..",  # 12
    ".. k0 k0 .. p0 p5 p5 k5 p4 p2 p1 p0 .. .. .. ..",  # 13 left rose-magenta spur
    ".. k0 s7 k0 p0 s7 p5 p4 p3 p2 p1 p0 k0 k0 .. ..",  # 14
    ".. k0 k6 k5 p2 p6 p5 p4 p3 p2 p1 k0 s7 k5 k0 ..",  # 15 right secondary shard
    ".. k0 k5 k4 p2 p6 p4 p4 p3 p2 k2 k6 k5 k3 k0 ..",  # 16 crisp translucent facet seam
    ".. k0 k0 k4 k3 p5 p4 p3 p2 p1 k2 k5 k4 k2 k0 ..",  # 17
    ".. .. k0 k4 k2 p5 p4 p3 p2 p1 k1 k4 k3 k0 k0 ..",  # 18
    ".. .. k0 k0 k2 p4 p3 p2 p1 p1 k1 k3 k2 k0 .. ..",  # 19
    ".. .. .. k0 k2 p4 p3 p2 p1 s0 k2 k2 k1 k0 .. ..",  # 20
    ".. .. s0 s0 s3 p5 p3 p2 s0 s3 s2 k1 s0 s0 .. ..",  # 21 dark basalt collar rim
    ".. s0 s0 s4 s3 p6 p4 p2 s3 s4 s3 s2 s1 s0 s0 ..",  # 22
    ".. s0 s4 s3 s2 p1 p5 p2 s3 s3 s2 s1 s1 s1 s0 ..",  # 23 3/4 lit dark basalt top
    ".. s0 s3 s2 s1 s1 p6 p3 s1 s2 s2 s1 s1 s1 s0 ..",  # 24 glowing corruption fissure
    ".. s0 s2 s1 s1 k2 k6 p4 s1 s1 s2 s1 v1 s1 s0 ..",  # 25
    ".. s0 s1 s2 s1 s0 k5 p4 s0 s1 s1 s1 s1 s0 s0 ..",  # 26
    ".. s0 s1 s1 s1 s1 s0 p3 s1 s1 s2 s1 s1 s0 .. ..",  # 27
    ".. s0 s0 s1 s1 s0 s1 s1 s0 s1 s1 s1 s0 s0 .. ..",  # 28
    ".. sh s0 s0 s0 s0 s0 s0 s0 s0 s0 s0 s0 sh .. ..",  # 29 bottom outline
    ".. .. sh sh sh sh sh sh sh sh sh sh sh sh .. ..",  # 30 ground shadow
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 31
]

# ==============================================================================
# 5. bone-pillar.png (16x32, standing, op 14x30)
# Ancient ossuary column carved from bleached giant vertebrae, horned skull capital, & dark iron bindings
# ==============================================================================
BONE_PILLAR_ROWS = [
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 00
    ".. .. s0 s0 s0 s0 s0 s0 s0 s0 s0 s0 s0 s0 .. ..",  # 01 obsidian abacus top outline
    ".. .. s0 s4 s4 s3 s3 s3 s3 s3 s2 s2 s1 s0 .. ..",  # 02 3/4 lit dark-obsidian abacus top
    ".. a0 s0 s2 s1 s1 s1 s1 s1 s1 s1 s1 s1 s0 a0 ..",  # 03 abacus front lip + horn tips
    ".. a0 w4 a0 s0 s6 s7 s7 s6 w4 s5 s0 a0 t2 a0 ..",  # 04 curved horns + bleached skull dome
    ".. a0 w3 t2 a0 s7 s7 s6 s6 w4 s5 a0 t2 a1 a0 ..",  # 05 horned demon skull capital
    ".. a0 t2 a1 s0 s6 s6 w4 s5 s5 s4 s0 a1 a1 a0 ..",  # 06
    ".. a0 a0 a0 s0 s6 v0 p6 s5 v0 p5 s4 s0 a0 a0 ..",  # 07 glowing violet skull eyes!
    ".. .. .. s0 s6 w4 v0 v0 s5 v0 v0 s4 s0 .. .. ..",  # 08 deep eye sockets + cheekbones
    ".. .. .. s0 w4 s6 s5 e0 e0 s5 s4 t2 s0 .. .. ..",  # 09 nasal cavity
    ".. .. .. s0 s0 s6 e0 s7 e0 s6 e0 s0 s0 .. .. ..",  # 10 grimacing bleached teeth
    ".. .. .. s0 s3 s4 s2 s2 s2 s4 s1 s1 s0 .. .. ..",  # 11 dark-iron binding collar #1 (cool dark iron vs warm bone!)
    ".. .. .. s0 s2 s5 s2 s1 s2 s4 s1 s1 s0 .. .. ..",  # 12 bright iron rivets on dark strap
    ".. .. s0 s0 s1 s1 s1 s0 s1 s1 s1 s1 s0 s0 .. ..",  # 13 collar shadow + vertebra wing flare
    ".. .. s0 s7 s7 s6 w4 s7 s6 w4 s5 t2 s3 s0 .. ..",  # 14 GIANT VERTEBRA #1 (12px wide winged bone!)
    ".. .. s0 s0 w4 s6 s5 s6 w4 s5 t2 s3 s0 s0 .. ..",  # 15 central neural spine ridge
    ".. .. .. s0 s0 e2 e2 s5 e2 e2 a1 s0 s0 .. .. ..",  # 16 deep intervertebral disc gap
    ".. .. s0 s0 s7 s6 w4 s7 s6 w4 s5 s3 s0 s0 .. ..",  # 17 GIANT VERTEBRA #2 (12px wide winged bone!)
    ".. .. s0 s7 s6 w4 s5 s6 w4 s5 t2 s3 s2 s0 .. ..",  # 18
    ".. .. s0 s0 s3 e2 s2 s4 s2 e2 a1 s1 s0 s0 .. ..",  # 19 joint into lower iron strap
    ".. .. .. s0 s3 s5 s2 s1 s2 s4 s1 s1 s0 .. .. ..",  # 20 dark-iron binding collar #2 + rivets
    ".. .. s0 s0 s1 s1 s1 s0 s1 s1 s1 s1 s0 s0 .. ..",  # 21
    ".. .. s0 s7 s7 s6 w4 s7 s6 w4 s5 t2 s3 s0 .. ..",  # 22 GIANT VERTEBRA #3 (12px wide winged bone!)
    ".. .. s0 s0 w4 s6 s5 s6 w4 s5 t2 s3 s0 s0 .. ..",  # 23
    ".. .. s0 s0 s3 e2 e2 s5 e2 e2 a1 s2 s0 s0 .. ..",  # 24 lower joint
    ".. s0 s0 s4 s4 s3 s3 s3 s3 s2 s2 s2 s1 s0 s0 ..",  # 25 3/4 lit black-obsidian plinth top
    ".. s0 s3 s3 s2 s2 s1 s1 s1 s1 s2 s2 s1 s1 s0 ..",  # 26
    ".. s0 s6 s7 s2 s6 s7 s1 s1 s6 w4 s1 s6 s4 s0 ..",  # 27 bleached ossuary skulls set in obsidian plinth!
    ".. s0 w4 t2 s1 w4 t2 s1 s1 t2 a2 s1 t2 s3 s0 ..",  # 28
    ".. s0 s2 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s0 ..",  # 29 obsidian plinth base
    ".. s0 s0 s0 s0 s0 s0 s0 s0 s0 s0 s0 s0 s0 s0 ..",  # 30 bottom outline
    ".. sh sh sh sh sh sh sh sh sh sh sh sh sh sh ..",  # 31 ground shadow
]

# ==============================================================================
# 6. void-brazier.png (16x32, standing, op 14x29)
# Spiked black-iron abyssal brazier on clawed tripod burning with roaring violet-magenta & pale-lilac fire
# ==============================================================================
VOID_BRAZIER_ROWS = [
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 00
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 01
    ".. .. .. .. .. .. p0 p0 .. .. .. p0 p0 .. .. ..",  # 02 roaring S-curve apex + floating void ember!
    ".. .. .. .. .. p0 p6 p4 p0 .. p0 s7 p5 p0 .. ..",  # 03
    ".. .. .. .. .. p0 s7 p5 p0 .. .. p0 p0 .. .. ..",  # 04
    ".. .. .. p0 p0 p0 p6 p5 p4 p0 .. .. .. .. .. ..",  # 05 licking side flame tongue
    ".. .. p0 p5 p4 p6 s7 p6 p5 p3 p0 p0 .. .. .. ..",  # 06
    ".. .. p0 p6 p5 p6 s7 p6 k6 p4 p5 p0 .. .. .. ..",  # 07 roaring violet-magenta tongues
    ".. .. p0 p4 p6 s7 s7 p6 k6 p5 p4 p2 p0 .. .. ..",  # 08
    ".. .. p0 p5 p6 s7 s7 s7 p6 k6 p5 p3 p0 p0 .. ..",  # 09 blazing white-lilac heart
    ".. .. p0 p4 p6 s7 s7 s7 p6 k6 k5 p4 p2 p0 .. ..",  # 10
    ".. .. p0 p3 p5 p6 s7 s7 s7 p6 k5 p4 p3 p0 .. ..",  # 11
    ".. .. s0 p0 p4 p6 s7 s7 s7 p6 k6 p4 p0 s0 .. ..",  # 12 back rim spikes
    ".. s0 s4 s0 p5 k6 p6 s7 s7 p6 k5 p4 s0 s3 s0 ..",  # 13 spiked iron rim + glowing void coals
    ".. s0 s5 s3 s2 k5 k6 p6 p6 k6 k5 s2 s2 s3 s0 ..",  # 14 3/4 elliptical iron rim back/sides + coals
    ".. s0 s0 s4 s5 s4 k5 k6 k6 k5 s4 s3 s2 s0 s0 ..",  # 15 3/4 lit front iron rim lip!
    ".. s0 s4 s3 s4 s4 s3 s3 s3 s3 s2 s2 s1 s2 s0 ..",  # 16 lower spiked flange
    ".. s0 s5 s2 s2 s1 p0 p6 p0 s1 s1 v1 s1 s3 s0 ..",  # 17 outward iron spikes + glowing violet rune!
    ".. s0 s0 s2 s2 s1 p0 p5 p0 s1 s1 s1 s1 s0 s0 ..",  # 18 dark black-iron cauldron belly
    ".. .. .. s0 s2 s2 s1 s1 s1 s1 v1 s1 s0 .. .. ..",  # 19
    ".. .. .. s0 s0 s2 s1 s1 s1 s1 s1 s0 s0 .. .. ..",  # 20 lower bowl taper
    ".. .. .. .. s0 s4 s3 s2 s2 s1 s0 s0 .. .. .. ..",  # 21 forged iron neck ring
    ".. .. .. s0 s0 s3 s2 s3 s2 s1 s1 s0 s0 .. .. ..",  # 22 tripod hub
    ".. .. .. s0 s3 s1 s0 s3 s1 s0 s2 s1 s0 .. .. ..",  # 23 3 splayed legs branch out
    ".. .. s0 s0 s3 s1 s0 s2 s1 s0 s2 s1 s0 s0 .. ..",  # 24
    ".. .. s0 s4 s3 s2 s3 s4 s3 s2 s2 s2 s1 s0 .. ..",  # 25 horizontal dark-iron brace ring
    ".. .. s0 s3 s1 s0 s0 s2 s1 s0 s0 s2 s1 s0 .. ..",  # 26 lower splayed legs
    ".. s0 s0 s3 s0 .. s0 s2 s1 s0 .. s0 s2 s0 s0 ..",  # 27 crisp tripod air gaps!
    ".. s0 s3 s1 s0 .. s0 s3 s1 s0 .. s0 s2 s1 s0 ..",  # 28 ankles
    ".. s0 s4 s2 s0 .. s0 s4 s2 s0 .. s0 s3 s1 s0 ..",  # 29 sharp iron talons gripping floor
    ".. s0 s0 s0 s0 sh s0 s0 s0 s0 sh s0 s0 s0 s0 ..",  # 30 bottom talon tips + shadow
    ".. sh sh sh sh sh sh sh sh sh sh sh sh sh sh ..",  # 31 ground shadow
]


# ==============================================================================
# 3. corrupt-crystal-big.png (32x32, standing, op 28x29)
# Massive erupting cluster of faceted violet-magenta & crimson corrupt crystals
# bursting from cracked obsidian rock with dazzling white-pink specular highlights
# ==============================================================================
CORRUPT_CRYSTAL_BIG_ROWS = [
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 00
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",  # 01
    ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. p0 p0 .. .. .. .. .. .. .. .. .. k0 k0 .. .. .. ..",  # 02 central apex + right floating shard
    ".. .. .. .. .. p0 p0 .. .. .. .. .. .. .. p0 s7 p5 p0 .. .. .. .. .. .. .. k0 s7 k5 k0 .. .. ..",  # 03 + left floating shard
    ".. .. .. .. p0 s7 p5 p0 .. .. .. .. .. p0 s7 p6 p5 p3 p0 .. .. .. .. .. .. k0 k6 k4 k0 .. .. ..",  # 04
    ".. .. .. .. p0 p6 p3 p0 .. .. .. .. .. p0 p6 p6 s7 p4 p2 p0 .. .. .. .. .. .. k0 k0 .. .. .. ..",  # 05
    ".. .. .. .. .. p0 p0 .. .. .. .. .. p0 s7 p6 p5 p6 p4 p2 p0 .. .. r0 r0 .. .. .. .. .. .. .. ..",  # 06 right crimson blade tip
    ".. .. .. .. .. .. .. .. .. .. .. .. p0 p6 p5 p5 p5 p3 p2 p1 p0 r0 r6 r4 r0 .. .. .. .. .. .. ..",  # 07
    ".. .. .. .. .. .. v0 v0 .. .. .. p0 s7 p6 p5 p4 p5 p3 p2 p1 p0 r0 s7 r5 r3 r0 .. .. .. .. .. ..",  # 08 left violet prism tip
    ".. .. .. .. .. v0 s7 v5 v0 .. .. p0 p6 p5 p5 p4 p4 p3 p2 p1 r0 r6 r5 r4 r3 r1 r0 .. .. .. .. ..",  # 09
    ".. .. .. .. v0 v6 v6 v5 v3 v0 .. p0 p6 p5 p4 s7 p4 p3 p2 p1 r0 r6 r5 r4 r3 r2 r1 r0 .. .. .. ..",  # 10
    ".. .. .. .. v0 s7 v5 v4 v3 v1 v0 p0 p5 p5 p4 p6 p4 p3 p2 r0 r6 r5 r4 r3 r2 r2 r1 r0 .. .. .. ..",  # 11
    ".. .. .. .. .. v0 v6 v5 v4 v2 v1 p0 p6 p5 p4 p5 p3 p2 p1 r0 r5 r4 r4 r3 r2 r1 r1 r0 .. .. .. ..",  # 12
    ".. .. .. .. .. v0 v5 v5 v4 v3 v1 p0 p5 p4 k0 k0 p3 p2 p1 r0 r5 r4 r3 r2 r2 k0 k0 .. .. .. .. ..",  # 13 foreground heart shard tip
    ".. .. .. .. .. .. v0 v6 v5 v3 v2 p0 p5 k0 s7 k5 k0 p2 r0 r5 r4 r3 r3 r2 k0 s7 k5 k0 .. .. .. ..",  # 14 + far-right rose spur
    ".. .. .. .. v0 v0 v0 v5 v4 v3 v2 p0 p4 k0 k6 k5 k3 k0 r0 r4 r3 r3 r2 k0 k6 k5 k4 k2 k0 .. .. ..",  # 15
    ".. .. .. v0 v6 v5 v0 v5 v4 v3 v1 p0 k0 s7 k6 k5 k4 k2 k0 r4 r3 r2 k0 k6 k5 k4 k3 k2 k1 k0 .. ..",  # 16
    ".. .. .. v0 v5 v4 v3 v4 v3 v2 v1 p0 k0 k6 k5 s7 k4 k3 k1 r3 r3 r2 k0 k5 k4 k3 k2 k1 k1 k0 .. ..",  # 17
    ".. .. .. .. v0 v5 v4 v3 v3 v2 v1 p4 k0 k6 k5 k6 k4 k3 k1 r3 r2 r1 k5 k4 k3 k2 k2 k1 k0 .. .. ..",  # 18
    ".. .. .. .. v0 v4 v3 v3 v2 v1 p0 p4 k0 k5 k5 k5 k3 k2 k1 r2 r2 r1 k4 k3 k2 k1 k1 k0 .. .. .. ..",  # 19
    ".. .. .. .. .. v0 v3 v2 v2 v1 p4 p3 k0 k5 k4 k4 k3 k2 k1 r2 r1 s0 k3 k2 k1 s0 s0 .. .. .. .. ..",  # 20
    ".. .. .. .. s0 s4 s0 v3 v2 s0 p5 p3 k0 k4 k4 k3 k2 k1 s0 r2 s0 s4 s3 k2 s0 s4 s3 s0 .. .. .. ..",  # 21 obsidian teeth gripping base
    ".. .. .. s0 s4 s5 s4 s0 v2 s4 s0 p4 k0 k4 k3 k3 k2 s0 s4 s3 s4 s5 s3 s0 s4 s4 s2 s1 s0 .. .. ..",  # 22 3/4 lit obsidian rock shelves
    ".. .. s0 s4 s5 s4 s3 s3 s0 s4 s3 s0 k0 k5 k3 k2 s0 s4 s5 s4 s3 s3 s2 s3 s3 s2 s2 s1 s1 s0 .. ..",  # 23
    ".. .. s0 s3 s3 s2 s2 p0 p6 p5 s3 s2 s0 k6 k4 k2 s3 s4 s3 s2 s2 r0 r5 r4 s2 s2 s1 s1 s1 s0 .. ..",  # 24 glowing magenta/crimson cracks!
    ".. .. s0 s2 s2 s1 s1 s0 p5 p6 p4 s2 s1 s0 k5 k3 s2 s2 s2 s1 r0 r5 r4 s1 s1 s2 s1 s1 s1 s0 .. ..",  # 25
    ".. .. s0 s2 s1 s2 s1 s1 s0 p5 p3 s1 s2 s1 s0 k4 s2 s1 s1 r0 r4 r3 s0 s1 s2 s1 s1 s0 s1 s0 .. ..",  # 26
    ".. .. s0 s1 s2 s3 s2 s1 s1 s0 p2 s1 s3 s2 s1 s0 s1 s2 s1 s0 r2 s1 s2 s2 s1 s1 s1 s1 s0 s0 .. ..",  # 27
    ".. .. .. s0 s1 s2 s1 s1 s1 s1 s1 s1 s2 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s0 s0 .. .. ..",  # 28
    ".. .. .. sh s0 s1 s1 s0 s1 s1 s0 s0 s1 s1 s1 s0 s1 s1 s0 s0 s1 s1 s1 s0 s1 s1 s0 s0 sh .. .. ..",  # 29
    ".. .. .. .. sh s0 s0 sh s0 s0 sh sh s0 s0 s0 sh s0 s0 sh sh s0 s0 s0 sh s0 s0 sh sh .. .. .. ..",  # 30 bottom outline + shadow
    ".. .. .. .. .. sh sh sh sh sh sh sh sh sh sh sh sh sh sh sh sh sh sh sh sh sh .. .. .. .. .. ..",  # 31 ground shadow
]


def build_demon_throne() -> Image.Image:
    """
    2. demon-throne.png (32x48, standing, op 28x44)
    Imposing Demon Lord's throne — spiked dark-iron & giant horn backrest,
    plush crimson velvet seat & armrests, glowing purple soul-gem crest &
    skull armrests on a stepped obsidian dais!
    """
    cv = GridCanvas(32, 48)

    # --- 1) Stepped Black-Obsidian Dais (y=36..45, x=2..29, dead-center at 15.5!) ---
    # Upper step (x=4..27, y=36..40)
    cv.rect(4, 36, 27, 37, "s3")  # 3/4 lit black-obsidian top tread
    cv.hline(5, 26, 36, "s4")     # crisp top-left highlight edge
    cv.hline(20, 26, 37, "s2")
    cv.rect(4, 38, 27, 40, "s1")  # dark obsidian front riser
    cv.hline(4, 14, 38, "s2")
    cv.hline(4, 27, 40, "s0")
    cv.vline(4, 36, 40, "s0")
    cv.vline(27, 36, 40, "s0")

    # Lower wider step (x=2..29, y=41..45 -> 28px wide!)
    cv.rect(2, 41, 29, 42, "s3")  # 3/4 lit black-obsidian top tread
    cv.hline(3, 28, 41, "s4")
    cv.hline(20, 28, 42, "s2")
    cv.rect(2, 43, 29, 44, "s1")  # dark obsidian front riser
    cv.hline(3, 13, 43, "s2")
    cv.hline(2, 29, 45, "s0")
    cv.vline(2, 41, 45, "s0")
    cv.vline(29, 41, 45, "s0")
    for jx in (7, 24):
        cv.vline(jx, 38, 39, "s0")
    for jx in (6, 25):
        cv.vline(jx, 43, 44, "s0")

    # Royal Crimson Carpet Runner cascading dead-center down dais (x=11..20, y=36..45)
    for y in (36, 37, 41, 42):  # horizontal lit treads
        cv.hline(11, 20, y, "a4")  # dark-gold border
        cv.set(11, y, "a5")
        cv.hline(12, 19, y, "r4")
        cv.hline(12, 16, y, "r5")
    for y in (38, 39, 43, 44):  # vertical shadow risers
        cv.set(11, y, "a3")
        cv.set(20, y, "a2")
        cv.hline(12, 19, y, "r2" if y in (38, 43) else "r1")
    cv.hline(11, 20, 40, "r0")
    cv.hline(11, 20, 45, "r0")

    # Ground shadow at y=46
    for sx in range(2, 30):
        cv.set(sx, 46, "sh")

    # --- 2) Perfectly Centered Spiked Dark-Iron & Giant Horn Backrest (x=2..29, y=2..27) ---
    backrest_rows = [
        # 28 cols (x=2..29), symmetry axis between col 13 (x=15) and col 14 (x=16)!
        "__ __ __ __ __ __ __ __ __ __ __ __ __ s0 s0 __ __ __ __ __ __ __ __ __ __ __ __ __",  # y=02 spire apex
        "__ a0 a0 __ __ __ __ __ __ __ __ __ s0 s5 s3 s0 __ __ __ __ __ __ __ __ __ a0 a0 __",  # y=03 giant horn tips + spire
        "a0 w4 w3 a0 __ __ __ __ __ __ s0 __ s0 s4 s2 s0 __ s0 __ __ __ __ __ __ a0 w3 t2 a0",  # y=04 sweeping colossal demon horns!
        "a0 s7 w4 t2 a0 __ __ __ __ s0 s4 s0 s3 s3 s2 s1 s0 s3 s0 __ __ __ __ a0 w4 t2 a1 a0",  # y=05
        "a0 w4 w3 t2 a1 a0 __ __ __ s0 s3 s2 a4 a5 a5 a4 s2 s2 s0 __ __ __ a0 w3 t2 a1 a1 a0",  # y=06 gold soul-gem bezel top
        "__ a0 w3 t2 a1 a1 a0 __ s0 s4 s3 a5 p0 p0 p0 p0 a3 s2 s2 s0 __ a0 a0 t2 a2 a1 a0 __",  # y=07 soul-gem crown!
        "__ a0 t2 a2 a1 a1 a0 s0 s4 s3 s2 a5 p0 s7 p6 p0 a3 s2 s1 s2 s0 a0 t2 a2 a1 e0 a0 __",  # y=08 blazing purple-white soul gem
        "__ __ a0 a2 a1 a2 s0 s3 s3 s2 a5 p0 s7 p6 p5 p4 p0 a3 s1 s1 s2 s0 a2 a1 a1 e0 a0 __",  # y=09
        "__ __ __ a0 a1 a2 s0 s3 s2 s1 a4 p0 p6 p5 p4 p3 p0 a2 s1 s1 s1 s0 a2 a1 e0 a0 __ __",  # y=10
        "__ __ __ __ a0 a0 s0 s4 s3 s2 s1 a4 p0 p4 p3 p0 a3 s1 s2 s2 s1 s0 a0 a0 __ __ __ __",  # y=11
        "__ __ __ __ __ __ s0 s4 s4 s3 s2 s1 a3 p0 p0 a2 s1 s2 s2 s3 s2 s0 __ __ __ __ __ __",  # y=12 3/4 lit dark-iron arch shoulder
        "__ __ __ __ __ s0 s4 s3 s2 r0 r0 r0 r0 r0 r0 r0 r0 r0 s2 s2 s2 s1 s0 __ __ __ __ __",  # y=13 velvet arch border
        "__ __ __ __ __ s0 s3 s2 r0 r4 r5 r5 r5 r4 r4 r3 r3 r2 r0 s2 s1 s1 s0 __ __ __ __ __",  # y=14 plush crimson velvet top
        "__ __ __ __ s0 s4 s2 s1 r0 r5 r5 r4 r1 r4 r4 r1 r3 r2 r0 s1 s2 s2 s1 s0 __ __ __ __",  # y=15 diamond-tufted velvet!
        "__ __ __ s0 s5 s3 s2 s1 r0 r5 r4 r1 r5 r4 r3 r4 r1 r2 r0 s1 s1 s2 s3 s2 s0 __ __ __",  # y=16 outward dark-iron spikes #1
        "__ __ __ __ s0 s3 s2 s1 r0 r4 r5 r4 r4 r1 r1 r3 r3 r2 r0 s1 s1 s1 s1 s0 __ __ __ __",  # y=17
        "__ __ __ __ __ s0 s2 s1 r0 r5 r4 r4 r3 r4 r3 r3 r2 r1 r0 s1 s1 s1 s0 __ __ __ __ __",  # y=18
        "__ __ __ __ s0 s5 s2 s1 r0 r4 r1 r5 r4 r3 r3 r2 r1 r2 r0 s1 s1 s2 s3 s0 __ __ __ __",  # y=19 outward dark-iron spikes #2
        "__ __ __ __ __ s0 s2 s1 r0 r4 r5 r4 r3 r1 r1 r3 r2 r1 r0 s1 s1 s1 s0 __ __ __ __ __",  # y=20
        "__ __ __ __ __ s0 s2 s1 r0 r4 r4 r3 r4 r3 r3 r2 r2 r1 r0 s1 s1 s1 s0 __ __ __ __ __",  # y=21
        "__ __ __ __ __ s0 s2 s1 r0 r3 r1 r4 r3 r3 r2 r2 r1 r1 r0 s1 s1 s1 s0 __ __ __ __ __",  # y=22
        "__ __ __ s0 s4 s3 s2 s1 r0 r4 r4 r3 r3 r2 r2 r2 r1 r1 r0 s1 s2 s3 s2 s1 s0 __ __ __",  # y=23 wide armrest rear posts
        "__ __ s0 s4 r5 r5 r4 r3 r0 r3 r3 r2 r2 r2 r2 r1 r1 r1 r0 r3 r4 r4 r3 r2 s1 s0 __ __",  # y=24 3/4 lit crimson armrest bolsters!
        "__ __ s0 r4 r5 r5 r4 r3 r2 r1 r1 r1 r1 r1 r1 r1 r1 r1 r2 r3 r4 r4 r3 r2 r1 s0 __ __",  # y=25
        "__ __ s0 r2 r4 r4 r3 r2 r1 a4 a5 a5 a4 a4 a4 a4 a3 a3 r1 r2 r3 r3 r2 r1 r0 s0 __ __",  # y=26 gold piping at seat crease
        "__ s0 s0 s6 s7 s7 s6 s5 s0 r5 r5 r5 r5 r4 r4 r4 r4 r3 s0 s6 s7 s6 s5 s4 s0 s0 __ __",  # y=27 skull craniums + 3/4 LIT SEAT TOP!
    ]
    cv.stamp(2, 2, backrest_rows)

    # --- 3) Symmetric Bleached Demon Skull Armrests + Plush Crimson Seat & Apron (y=28..35) ---
    seat_and_skulls = [
        # 28 cols (x=2..29), symmetric: left skull cols 1..7 (x=3..9), seat cols 9..18 (x=11..20), right skull cols 20..26 (x=22..28)
        "__ s0 w4 s7 s7 s6 s5 s4 s0 r5 r5 r5 r4 r4 r4 r4 r3 r3 s0 s6 s7 s6 s5 s4 s3 s0 __ __",  # y=28 bleached skull brows + lit seat
        "__ s0 s6 v0 p6 s5 v0 p5 s0 r5 r4 r4 r4 r4 r3 r3 r3 r2 s0 v0 p6 s5 v0 p5 s3 s0 __ __",  # y=29 glowing violet skull eyes!
        "__ s0 s5 v0 v0 s5 v0 v0 s0 r4 r4 r4 r3 r3 r3 r3 r2 r2 s0 v0 v0 s4 v0 v0 s2 s0 __ __",  # y=30 deep skull sockets + seat front
        "__ __ s0 s6 s5 e0 e0 s4 s0 a5 a5 a4 a4 a5 a4 a4 a3 a2 s0 s5 s5 e0 e0 s3 s0 __ __ __",  # y=31 skull nose + gold seat trim!
        "__ __ s0 s6 e0 s6 e0 s5 s0 r2 r2 r2 a4 p6 p4 a3 r1 r1 s0 s5 e0 s5 e0 s4 s0 __ __ __",  # y=32 skull teeth + gemmed front apron
        "__ __ s0 s3 s2 s2 s1 s1 s0 r2 r1 r1 r1 a4 a3 r1 r1 r1 s0 s2 s2 s1 s1 s1 s0 __ __ __",  # y=33 dark-iron skull pedestals
        "__ __ s0 s4 s3 s2 s1 s1 s2 r1 r1 r0 r1 r1 r1 r0 r1 r0 s2 s3 s2 s1 s1 s1 s0 __ __ __",  # y=34 clawed iron throne feet
        "__ __ s0 s2 s1 s1 s0 s0 s1 s0 s0 s0 s0 s0 s0 s0 s0 s0 s1 s2 s1 s1 s0 s0 s0 __ __ __",  # y=35 base contact onto dais
    ]
    cv.stamp(2, 28, seat_and_skulls)

    cv.enforce_dark_outer_outline()
    return cv.to_image("demon-throne.png")


def build_portal_gate() -> Image.Image:
    """
    1. portal-gate.png (48x48, standing, op ~44x45)
    Towering jagged black-obsidian & horned-arch dimensional gate framing a
    swirling luminous violet-magenta-white abyssal vortex & stepped rune threshold!
    """
    cv = GridCanvas(48, 48)

    # --- 1) Swirling Luminous Violet-Magenta-White Abyssal Vortex (x=12..35, y=12..39) ---
    cx_v, cy_v = 23.5, 25.5
    for y in range(12, 40):
        for x in range(12, 36):
            dx = (x - cx_v) / 11.5
            dy_arch = (y - 20.0) / 8.5 if y < 20 else 0.0
            if y < 20 and (dx * dx + dy_arch * dy_arch > 1.05):
                continue

            rx = (x - cx_v) / 10.8
            ry = (y - cy_v) / 13.2
            r = math.hypot(rx, ry)
            theta = math.atan2(ry, rx)

            if r > 0.96:
                tok = "v0"
            elif r > 0.84:
                sw = math.sin(2.0 * theta + 5.2 * r)
                tok = "v2" if sw > 0.35 else "v1"
            elif r < 0.13:
                tok = "s7"
            elif r < 0.24:
                tok = "p6" if (x + y) % 2 == 0 else "k6"
            else:
                phase = math.sin(2.0 * theta + 6.8 * r)
                phase2 = math.cos(2.0 * theta + 6.8 * r)
                val = (1.0 - r) * 0.62 + 0.38 * (0.5 * (phase + 1.0))
                if val > 0.76:
                    tok = "p6" if phase2 > 0 else "k6"
                elif val > 0.62:
                    tok = "p5" if phase2 > -0.2 else "k5"
                elif val > 0.48:
                    tok = "p4" if phase > 0 else "v5"
                elif val > 0.35:
                    tok = "p3" if phase2 > 0 else "v4"
                elif val > 0.23:
                    tok = "v3"
                else:
                    tok = "v2"
            cv.set(x, y, tok)

    # Crisp hand-placed singularity & star-motes inside vortex
    cv.rect(23, 25, 24, 26, "s7")
    cv.set(22, 25, "p6")
    cv.set(25, 26, "k6")
    cv.set(23, 24, "k6")
    cv.set(24, 27, "p6")
    for sx, sy, st in ((17, 19, "s7"), (30, 21, "p6"), (16, 32, "v6"), (31, 33, "k6"), (20, 16, "p6"), (28, 35, "s7")):
        cv.set(sx, sy, st)

    # --- 2) Twin Jagged Black-Obsidian Pillars (left x=4..12, right x=35..43, y=13..39) ---
    # Shifted 1 step darker so frame reads as true volcanic BLACK-OBSIDIAN against luminous vortex!
    cv.ashlar(5, 13, 12, 17, hi="s3", mid="s1", lo="v1", seam="s0")
    cv.ashlar(5, 20, 12, 24, hi="s3", mid="s1", lo="v1", seam="s0")
    cv.ashlar(5, 25, 12, 29, hi="s3", mid="s1", lo="v1", seam="s0")
    cv.ashlar(4, 32, 12, 35, hi="s3", mid="s1", lo="v1", seam="s0")
    cv.ashlar(4, 36, 12, 39, hi="s2", mid="s1", lo="s0", seam="s0")
    # Crisp 1px obsidian glass glints on top-left corners of left pier blocks
    for gy in (13, 20, 25, 32):
        cv.set(5 if gy < 32 else 4, gy, "s4")

    cv.ashlar(35, 13, 42, 17, hi="s3", mid="s1", lo="v1", seam="s0")
    cv.ashlar(35, 20, 42, 24, hi="s3", mid="s1", lo="v1", seam="s0")
    cv.ashlar(35, 25, 42, 29, hi="s3", mid="s1", lo="v1", seam="s0")
    cv.ashlar(35, 32, 43, 35, hi="s2", mid="s1", lo="s0", seam="s0")
    cv.ashlar(35, 36, 43, 39, hi="s2", mid="s1", lo="s0", seam="s0")

    # Spiked Dark-Iron Binding Collars on both pillars (y=18..19 and y=30..31)
    for cy_band in (18, 30):
        cv.set(3, cy_band, "s0")
        cv.set(4, cy_band, "s4")
        cv.hline(5, 12, cy_band, "s3")
        cv.set(6, cy_band, "s5")  # 1px steel rivet glint
        cv.set(10, cy_band, "s4")
        cv.hline(4, 12, cy_band + 1, "s1")
        cv.set(4, cy_band + 1, "s0")

        cv.hline(35, 42, cy_band, "s2")
        cv.set(37, cy_band, "s4")
        cv.set(41, cy_band, "s3")
        cv.set(43, cy_band, "s3")
        cv.set(44, cy_band, "s0")
        cv.hline(35, 43, cy_band + 1, "s1")
        cv.set(43, cy_band + 1, "s0")

    # Carved Glowing Dimensional Runes recessed into both black-obsidian piers
    for rx_base in (7, 38):
        cv.rect(rx_base, 21, rx_base + 2, 23, "v0")
        cv.set(rx_base + 1, 21, "p6")
        cv.set(rx_base, 22, "p5")
        cv.set(rx_base + 2, 22, "v5")
        cv.set(rx_base + 1, 23, "p4")

        cv.rect(rx_base, 26, rx_base + 2, 28, "v0")
        cv.set(rx_base, 26, "v5")
        cv.set(rx_base + 1, 27, "p6")
        cv.set(rx_base + 2, 26, "p5")
        cv.set(rx_base + 1, 28, "v5")

        cv.rect(rx_base, 33, rx_base + 2, 35, "v0")
        cv.set(rx_base + 1, 33, "k6")
        cv.set(rx_base, 34, "p5")
        cv.set(rx_base + 2, 34, "p5")
        cv.set(rx_base + 1, 35, "p4")

    # --- 3) Black-Obsidian Arch Voussoirs Framing Vortex Top (y=10..19) ---
    for y in range(10, 20):
        for x in range(11, 37):
            dx = (x - cx_v) / 11.2
            dy = (y - 20.0) / 8.2
            d = math.hypot(dx, dy)
            if 0.94 <= d <= 1.25:
                if d < 1.03:
                    cv.set(x, y, "p5" if (x + y) % 5 == 0 else "v0")
                elif x < 24:
                    cv.set(x, y, "s3" if y < 14 else "s2")
                else:
                    cv.set(x, y, "s2" if y < 14 else "s1")
    for y in range(19, 40):
        cv.set(12, y, "p5" if y % 4 == 1 else "v0")
        cv.set(35, y, "v5" if y % 4 == 1 else "v0")

    # --- 4) 3/4 Lit Black-Obsidian Lintel Top Band, Jagged Spikes & Giant Horns (y=2..13) ---
    cv.hline(9, 38, 6, "s0")
    cv.hline(8, 39, 7, "s4")  # crisp 3/4 lit obsidian top plane!
    cv.hline(25, 39, 7, "s3")
    cv.hline(8, 39, 8, "s3")
    cv.hline(26, 39, 8, "s2")
    cv.hline(8, 39, 9, "s2")
    cv.hline(7, 40, 10, "s0")  # deep cornice shadow
    cv.hline(6, 41, 11, "s1")  # dark obsidian frieze
    cv.hline(6, 41, 12, "v1")
    # Jagged obsidian spikes jutting along upper architrave (x=14..16 and x=31..33, y=4..6)
    for sx_sp, hi_sp in ((14, "s4"), (31, "s3")):
        cv.set(sx_sp + 1, 4, "s0")
        cv.set(sx_sp, 5, "s0")
        cv.set(sx_sp + 1, 5, hi_sp)
        cv.set(sx_sp + 2, 5, "s0")
        cv.set(sx_sp + 1, 6, "s2")

    # Giant Outward-Sweeping Abyssal Horns on Left & Right
    left_horn = [
        "__ a0 a0 __ __ __ __ __ __",  # y=02
        "a0 w4 t2 a0 __ __ __ __ __",  # y=03
        "a0 s7 w4 t2 a0 __ __ s0 __",  # y=04
        "a0 w4 t2 a2 a1 s0 s0 s4 s0",  # y=05
        "__ a0 t2 a2 a1 s3 s4 s3 s2",  # y=06
        "__ __ s0 a2 a1 s2 s3 s2 s1",  # y=07
        "__ __ s0 s2 a1 a1 s2 s1 s1",  # y=08
        "__ __ __ s0 s1 a1 a0 s1 s0",  # y=09
        "__ __ __ __ s0 s1 s1 s0 __",  # y=10
    ]
    cv.stamp(2, 2, left_horn)

    right_horn = [
        "__ __ __ __ __ __ a0 a0 __",  # y=02
        "__ __ __ __ __ a0 t2 a2 a0",  # y=03
        "__ s0 __ __ a0 w3 t2 a1 a0",  # y=04
        "s0 s3 s0 s0 t2 a2 a1 e0 a0",  # y=05
        "s2 s3 s2 s2 a2 a1 a1 a0 __",  # y=06
        "s1 s2 s2 s1 a2 a1 s0 __ __",  # y=07
        "s1 s1 s1 a1 a1 s1 s0 __ __",  # y=08
        "s0 s1 a0 a1 s1 s0 __ __ __",  # y=09
        "__ s0 s1 s1 s0 __ __ __ __",  # y=10
    ]
    cv.stamp(37, 2, right_horn)

    # Central Jagged Abyssal Keystone & Blazing Soul-Eye Crest (x=19..28, y=2..13)
    keystone = [
        "__ __ __ __ s0 s0 __ __ __ __",  # y=02
        "__ s0 __ s0 s4 s3 s0 __ s0 __",  # y=03
        "s0 s3 s0 s3 a5 a4 s2 s0 s2 s0",  # y=04
        "__ s0 s3 a5 p0 p0 a3 s2 s0 __",  # y=05
        "__ s0 a5 p0 s7 p6 p0 a3 s0 __",  # y=06
        "__ s0 a4 p0 p6 p5 p0 a2 s0 __",  # y=07
        "__ __ s0 a4 p0 p0 a3 s0 __ __",  # y=08
        "__ __ s0 s3 a5 a4 s1 s0 __ __",  # y=09
        "__ __ __ s0 s3 s1 s0 __ __ __",  # y=10
        "__ __ __ __ s0 s0 __ __ __ __",  # y=11
    ]
    cv.stamp(19, 2, keystone)

    # --- 5) Stepped Black-Obsidian Rune Threshold (x=2..45, y=40..46) ---
    # Upper threshold step (x=4..43, y=40..42)
    cv.hline(4, 43, 40, "s4")  # 3/4 lit obsidian top lip
    cv.hline(26, 43, 40, "s3")
    cv.hline(4, 43, 41, "s3")  # 2nd row of lit top tread
    cv.hline(26, 43, 41, "s2")
    # Glowing threshold runes inlaid along doorway top tread (x=13..34, y=40..41)
    cv.hline(13, 34, 40, "v5")
    for rx in (15, 19, 23, 24, 28, 32):
        cv.set(rx, 40, "p6")
        cv.set(rx, 41, "p5")
    for rx in (17, 21, 26, 30):
        cv.set(rx, 41, "v4")
    cv.hline(4, 43, 42, "s1")  # dark obsidian riser
    cv.vline(4, 40, 42, "s0")
    cv.vline(43, 40, 42, "s0")

    # Lower flared black-obsidian step (x=2..45, y=43..46 -> 44px wide!)
    cv.hline(2, 45, 43, "s4")  # 3/4 lit obsidian top lip
    cv.hline(26, 45, 43, "s3")
    cv.hline(2, 45, 44, "s3")
    cv.hline(26, 45, 44, "s2")
    cv.hline(16, 31, 43, "p5")
    cv.hline(21, 26, 43, "p6")
    cv.hline(2, 45, 45, "s1")  # dark obsidian front riser
    cv.hline(3, 15, 45, "s2")
    for jx in (9, 17, 30, 38):
        cv.set(jx, 45, "s0")
    cv.hline(2, 45, 46, "s0")
    cv.vline(2, 43, 46, "s0")
    cv.vline(45, 43, 46, "s0")

    # Ground shadow at y=46..47
    cv.set(1, 46, "sh")
    cv.set(46, 46, "sh")
    for sx in range(2, 46):
        cv.set(sx, 47, "sh")

    cv.enforce_dark_outer_outline()
    return cv.to_image("portal-gate.png")


def verify_sprite(
    im: Image.Image,
    name: str,
    allowed_hexes: set[str],
    target_w_range: tuple[int, int],
    target_h_range: tuple[int, int],
) -> dict:
    """Strict machine validator: palette, alpha, #000000, 1px dark outer outline, bbox, centering."""
    w, h = im.size
    px = im.load()

    off_palette: list[tuple[int, int, str]] = []
    bad_alpha: list[tuple[int, int, tuple[int, int, int, int]]] = []
    pure_black: list[tuple[int, int]] = []
    bad_outline: list[tuple[int, int, str, float]] = []

    opaque_colors: set[str] = set()
    shadow_count = 0
    xs: list[int] = []
    ys: list[int] = []

    for y in range(h):
        for x in range(w):
            rgba = px[x, y]
            r, g, b, a = rgba
            if a == 0:
                continue
            if rgba == SHADOW_RGBA:
                shadow_count += 1
                continue
            if a != 255:
                bad_alpha.append((x, y, rgba))
                continue
            if (r, g, b) == (0, 0, 0):
                pure_black.append((x, y))
            hx = f"#{r:02x}{g:02x}{b:02x}"
            if hx not in allowed_hexes:
                off_palette.append((x, y, hx))
            opaque_colors.add(hx)
            xs.append(x)
            ys.append(y)

            # Every 4-connected neighbor outside canvas or with a != 255 requires dark material outline
            touches_empty = False
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if not (0 <= nx < w and 0 <= ny < h) or px[nx, ny][3] != 255:
                    touches_empty = True
                    break
            if touches_empty and hx not in DARK_OUTLINE_HEXES:
                bad_outline.append((x, y, hx, round(luma(r, g, b), 1)))

    assert not pure_black, f"{name}: PURE BLACK #000000 PIXELS: {pure_black}"
    assert not off_palette, f"{name}: OFF-PALETTE PIXELS: {off_palette}"
    assert not bad_alpha, f"{name}: BAD ALPHA PIXELS: {bad_alpha}"
    assert not bad_outline, f"{name}: NON-DARK OUTER OUTLINE PIXELS: {bad_outline[:12]}"
    assert xs, f"{name}: empty sprite!"

    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    op_w = max_x - min_x + 1
    op_h = max_y - min_y + 1
    left_m = min_x
    right_m = w - 1 - max_x
    bot_m = h - 1 - max_y

    assert target_w_range[0] <= op_w <= target_w_range[1], f"{name}: op_w={op_w} not in {target_w_range}"
    assert target_h_range[0] <= op_h <= target_h_range[1], f"{name}: op_h={op_h} not in {target_h_range}"
    assert abs(left_m - right_m) <= 1, f"{name}: horizontal margin asymmetry ({left_m} vs {right_m})"
    assert 1 <= bot_m <= 2, f"{name}: bottom margin {bot_m} not in 1..2"

    return {
        "name": name,
        "canvas": f"{w}x{h}",
        "opaque_size": f"{op_w}x{op_h}",
        "margins_lrtb": (left_m, right_m, min_y, bot_m),
        "unique_colors": len(opaque_colors),
        "shadow_px": shadow_count,
    }


def load_beodeul_char_1x() -> Image.Image:
    """Downscale ref_beodeul_char_4x.png (88x100) by exact 4x nearest -> native 22x25 Beodeul char."""
    src = Image.open(CHAR_REF_4X).convert("RGBA")
    w, h = src.size
    return src.resize((w // 4, h // 4), Image.Resampling.NEAREST)


def build_preview_sheet(sprites: list[tuple[str, str, Image.Image, dict]]) -> None:
    """Render preview_otherworld.png on #767670 with 3x Loupe + 2x + 1x next to 22px Beodeul char."""
    bg_gray = (0x76, 0x76, 0x70, 255)
    card_border = (0x5A, 0x5A, 0x54, 255)
    header_bg = (0x5E, 0x5E, 0x58, 255)
    sub_hdr_bg = (0x6A, 0x6A, 0x64, 255)

    card_widths = [232, 196, 188, 168, 168, 168]
    gap = 8
    pad = 12
    sheet_w = pad * 2 + sum(card_widths) + gap * (len(card_widths) - 1)
    sheet_h = 468

    sheet = Image.new("RGBA", (sheet_w, sheet_h), bg_gray)
    draw = ImageDraw.Draw(sheet)

    try:
        font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 13)
        font_sub = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11)
        font_tiny = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 10)
    except Exception:
        font_title = ImageFont.load_default()
        font_sub = ImageFont.load_default()
        font_tiny = ImageFont.load_default()

    # Header bar
    draw.rectangle([pad, 10, sheet_w - pad, 80], fill=header_bg, outline=card_border, width=1)
    draw.text(
        (78, 16),
        "T3 DUNGEON THEME OBJECTS BATCH 2/4 — `otherworld` (Demon Realm / Otherworld Abyss · 6 Objects)",
        fill=(250, 250, 246, 255),
        font=font_title,
    )
    draw.text(
        (78, 36),
        "Locked 118-Color modern_palette_v3.json (0 off-palette, 0 #000000) | Shadow #4c557f@85 | 1px Dark Outlines",
        fill=(228, 228, 222, 255),
        font=font_sub,
    )
    draw.text(
        (78, 54),
        "Camera: Orthographic RM2000 3/4 Standing (front + narrow lit top band, ZERO side walls) | Upper: 3x | Lower: 2x + 1x + Beodeul 22x25",
        fill=(206, 208, 200, 255),
        font=font_tiny,
    )

    char_1x = load_beodeul_char_1x()
    char_2x = char_1x.resize((char_1x.width * 2, char_1x.height * 2), Image.Resampling.NEAREST)
    sheet.alpha_composite(char_2x, (22, 20))

    cx = pad
    cy = 92
    card_h = 362

    for idx, ((fname, cam, im, stats), cw) in enumerate(zip(sprites, card_widths)):
        draw.rectangle([cx, cy, cx + cw, cy + card_h], fill=bg_gray, outline=card_border, width=1)
        draw.rectangle([cx + 1, cy + 1, cx + cw - 1, cy + 24], fill=sub_hdr_bg)
        label = fname.replace(".png", "")
        draw.text((cx + 7, cy + 6), f"0{idx + 1} {label}", fill=(250, 250, 246, 255), font=font_sub)

        # 1) Upper 3x Loupe for pixel/outline inspection
        im_3x = im.resize((im.width * 3, im.height * 3), Image.Resampling.NEAREST)
        loupe_floor_y = cy + 178
        draw.line([(cx + 10, loupe_floor_y + 1), (cx + cw - 10, loupe_floor_y + 1)], fill=(104, 104, 98, 255), width=1)
        sheet.alpha_composite(im_3x, (cx + (cw - im_3x.width) // 2, loupe_floor_y - im_3x.height))

        # 2) Lower 2x + 1x + Beodeul 22x25 char on #767670
        comp_floor_y = cy + 292
        draw.line([(cx + 10, comp_floor_y + 1), (cx + cw - 10, comp_floor_y + 1)], fill=(104, 104, 98, 255), width=1)
        im_2x = im.resize((im.width * 2, im.height * 2), Image.Resampling.NEAREST)
        row_w = im_2x.width + 10 + im.width + 8 + char_1x.width
        rx = cx + (cw - row_w) // 2
        sheet.alpha_composite(im_2x, (rx, comp_floor_y - im_2x.height))
        sheet.alpha_composite(im, (rx + im_2x.width + 10, comp_floor_y - im.height))
        sheet.alpha_composite(char_1x, (rx + im_2x.width + 10 + im.width + 8, comp_floor_y - char_1x.height))

        # Stats footer
        draw.text(
            (cx + 8, cy + 302),
            f"{stats['canvas']} {cam} | op {stats['opaque_size']}",
            fill=(238, 240, 234, 255),
            font=font_tiny,
        )
        draw.text(
            (cx + 8, cy + 320),
            f"margins L/R/T/B: {stats['margins_lrtb']}",
            fill=(206, 208, 202, 255),
            font=font_tiny,
        )
        draw.text(
            (cx + 8, cy + 338),
            f"{stats['unique_colors']} cols | sh {stats['shadow_px']}px | PASS",
            fill=(165, 250, 165, 255),
            font=font_sub,
        )
        cx += cw + gap

    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(PREVIEW_PATH)


def main() -> None:
    pal_data = json.loads(PALETTE_PATH.read_text(encoding="utf-8"))
    allowed_hexes = {c.lower() for c in pal_data["all_colors"]}
    assert len(allowed_hexes) == 118, f"Expected 118 palette colors, got {len(allowed_hexes)}"

    for tok, hx in TOKENS.items():
        assert hx.lower() in allowed_hexes, f"Token {tok}={hx} is NOT in modern_palette_v3.json!"

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    portal_im = build_portal_gate()
    throne_im = build_demon_throne()
    crys_big_im = parse_grid(CORRUPT_CRYSTAL_BIG_ROWS, 32, 32, "corrupt-crystal-big.png")
    crys_sm_im = parse_grid(CORRUPT_CRYSTAL_ROWS, 16, 32, "corrupt-crystal.png")
    bone_im = parse_grid(BONE_PILLAR_ROWS, 16, 32, "bone-pillar.png")
    brazier_im = parse_grid(VOID_BRAZIER_ROWS, 16, 32, "void-brazier.png")

    specs: list[tuple[str, str, Image.Image, tuple[int, int], tuple[int, int]]] = [
        ("portal-gate.png", "standing", portal_im, (43, 45), (44, 46)),
        ("demon-throne.png", "standing", throne_im, (27, 29), (43, 45)),
        ("corrupt-crystal-big.png", "standing", crys_big_im, (27, 29), (28, 30)),
        ("corrupt-crystal.png", "standing", crys_sm_im, (13, 15), (27, 29)),
        ("bone-pillar.png", "standing", bone_im, (13, 15), (29, 30)),
        ("void-brazier.png", "standing", brazier_im, (13, 15), (28, 30)),
    ]

    built: list[tuple[str, str, Image.Image, dict]] = []
    for fname, cam, im, w_rng, h_rng in specs:
        stats = verify_sprite(im, fname, allowed_hexes, w_rng, h_rng)
        im.save(OUT_DIR / fname)
        built.append((fname, cam, im, stats))
        print(
            f"[PASS] {fname:24s} | {cam:8s} | canvas={stats['canvas']:5s} | "
            f"opaque={stats['opaque_size']:5s} | colors={stats['unique_colors']:2d} | "
            f"margins={stats['margins_lrtb']} | shadow={stats['shadow_px']}px"
        )

    build_preview_sheet(built)
    print(f"[PREVIEW] Saved {PREVIEW_PATH}")


if __name__ == "__main__":
    main()
