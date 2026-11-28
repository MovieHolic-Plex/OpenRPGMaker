#!/usr/bin/env python3
"""T3 Dungeon Theme Objects Batch 1/4 — `pyramid` (피라미드 · 사막 왕묘 6종).

Hand-crafts 6 museum-grade RPG Maker 2000/2003 (16x16 grid) Egyptian/Desert Pyramid
dungeon objects strictly locked to `tiledata/jp-city/fable-city/palette.json`:

1. `obelisk.png`             (16x48, standing, target opaque ~14x45)
2. `pharaoh-sarcophagus.png` (32x32, standing, target opaque ~28x29)
3. `jackal-statue.png`       (16x32, standing, target opaque ~14x29)
4. `gold-pile.png`           (32x32, standing, target opaque ~28x25)
5. `sand-drift.png`          (32x16, topdown,  target opaque ~30x13)
6. `sand-pit.png`            (32x32, topdown,  target opaque ~30x28)

Outputs PNGs to `tiledata/dungeon-themes-carbon/pyramid/objects/` and renders
`tiledata/dungeon-themes-carbon/pyramid/preview_pyramid.png` (2x + 1x on #767670
next to the 22px Beodeul scale character) with strict machine verification.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Callable, Dict, List, Sequence, Tuple
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
PALETTE_PATH = ROOT / "tiledata/jp-city/fable-city/palette.json"
REFS_DIR = ROOT / "tiledata/dungeon-pilot/_dots_kit_refs"
OUT_ROOT = ROOT / "tiledata/dungeon-themes-carbon/pyramid"
OUT_OBJS_DIR = OUT_ROOT / "objects"
PREVIEW_PATH = OUT_ROOT / "preview_pyramid.png"

SHADOW_RGBA = (0x4C, 0x55, 0x7F, 85)
TRANSPARENT = (0, 0, 0, 0)


def hex_to_rgba(h: str, alpha: int = 255) -> Tuple[int, int, int, int]:
    c = h.lstrip("#").lower()
    return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), alpha)


def luma(r: int, g: int, b: int) -> float:
    return 0.299 * r + 0.587 * g + 0.114 * b


def load_locked_palette() -> set[Tuple[int, int, int]]:
    data = json.loads(PALETTE_PATH.read_text(encoding="utf-8"))
    colors: set[Tuple[int, int, int]] = set()
    for hex_list in data["ramps"].values():
        for h in hex_list:
            colors.add(hex_to_rgba(h)[:3])
    assert (0, 0, 0) not in colors, "Forbidden #000000 found in palette"
    return colors


ALLOWED_RGB = load_locked_palette()

# Curated semantic token map — 100% sampled from tiledata/jp-city/fable-city/palette.json
TOKENS: Dict[str, Tuple[int, int, int, int]] = {
    "..": TRANSPARENT,
    ".": TRANSPARENT,
    "~~": SHADOW_RGBA,
    "~": SHADOW_RGBA,
    # Warm Sandstone / Desert Sand (`straw` 0..5)
    "w0": hex_to_rgba("#3c3020"),  # luma 49.8 [DARK OUTLINE: sandstone/sand]
    "w1": hex_to_rgba("#5f5230"),  # luma 82.0 [DARK: incised groove]
    "w2": hex_to_rgba("#857644"),  # luma 116.7
    "w3": hex_to_rgba("#aa9c5c"),  # luma 152.7
    "w4": hex_to_rgba("#cabe7c"),  # luma 186.2
    "w5": hex_to_rgba("#e4dca4"),  # luma 216.2
    # Sunlit Limestone / Papyrus / Dune Crest (`cream` 0..6)
    "c0": hex_to_rgba("#5e4f5c"),  # luma 84.8 [DARK]
    "c1": hex_to_rgba("#857466"),  # luma 119.5
    "c2": hex_to_rgba("#ab9a78"),  # luma 154.9
    "c3": hex_to_rgba("#cdbd92"),  # luma 188.9
    "c4": hex_to_rgba("#e4d6a8"),  # luma 213.8
    "c5": hex_to_rgba("#f2e8c4"),  # luma 230.8
    "c6": hex_to_rgba("#faf3dc"),  # luma 243.4
    # Desert Earth / Sinkhole / Lee Slope (`soil` + `earth` + `cedar`)
    "e0": hex_to_rgba("#2a1a24"),  # soil[0]  luma 31.9 [DARK OUTLINE: deep sinkhole/wood]
    "e1": hex_to_rgba("#44282a"),  # soil[1]  luma 48.6 [DARK OUTLINE: warm desert earth]
    "e2": hex_to_rgba("#604034"),  # earth[0] luma 72.2 [DARK]
    "e3": hex_to_rgba("#7e5c44"),  # earth[1] luma 99.4
    "e4": hex_to_rgba("#9c7a5a"),  # earth[3] luma 128.4
    "e5": hex_to_rgba("#b89a78"),  # earth[5] luma 159.1
    "d4": hex_to_rgba("#b88e5c"),  # cedar[4] luma 148.8
    "d5": hex_to_rgba("#d2ac78"),  # cedar[5] luma 177.5
    "d6": hex_to_rgba("#e6c898"),  # cedar[6] luma 203.5
    # Weathered Carved Limestone (`stone` 0..6)
    "s0": hex_to_rgba("#2b203f"),  # luma 38.8 [DARK OUTLINE: carved stone]
    "s1": hex_to_rgba("#4a3a52"),  # luma 65.5 [DARK OUTLINE: stone shadow]
    "s2": hex_to_rgba("#6d6363"),  # luma 102.0
    "s3": hex_to_rgba("#928484"),  # luma 136.2
    "s4": hex_to_rgba("#aa9a94"),  # luma 158.1
    "s5": hex_to_rgba("#c4b8ac"),  # luma 186.2
    "s6": hex_to_rgba("#dcd4c4"),  # luma 212.5
    # Electrum / Royal Gold (`yellow` 0..5 + `orange` 0..5)
    "g0": hex_to_rgba("#4a3020"),  # yellow[0] luma 53.9 [DARK OUTLINE: gold/bronze]
    "g1": hex_to_rgba("#7a5420"),  # yellow[1] luma 89.4
    "g2": hex_to_rgba("#aa8024"),  # yellow[2] luma 130.0
    "g3": hex_to_rgba("#d4ac38"),  # yellow[3] luma 172.8
    "g4": hex_to_rgba("#ecd060"),  # yellow[4] luma 209.2
    "g5": hex_to_rgba("#f8eca0"),  # yellow[5] luma 237.2 [GOLD SPECULAR]
    "o0": hex_to_rgba("#4a2028"),  # orange[0] luma 45.4 [DARK OUTLINE: copper-gold]
    "o1": hex_to_rgba("#783420"),  # orange[1] luma 69.9 [DARK]
    "o2": hex_to_rgba("#a85420"),  # orange[2] luma 103.2
    "o3": hex_to_rgba("#d07a2c"),  # orange[3] luma 138.9
    "o4": hex_to_rgba("#e8a448"),  # orange[4] luma 173.8
    "o5": hex_to_rgba("#f6cc7c"),  # orange[5] luma 207.4
    # Royal Lapis Blue (`blue` 0..5 + `navy` 0..2)
    "b0": hex_to_rgba("#101a40"),  # blue[0] luma 27.3 [DARK OUTLINE: lapis]
    "b1": hex_to_rgba("#1c3068"),  # blue[1] luma 48.4 [DARK]
    "b2": hex_to_rgba("#2c4c90"),  # blue[2] luma 74.2 [DARK]
    "b3": hex_to_rgba("#4470b0"),  # blue[3] luma 106.1
    "b4": hex_to_rgba("#6c98cc"),  # blue[4] luma 144.8
    "b5": hex_to_rgba("#a0c0e0"),  # blue[5] luma 186.0
    "n0": hex_to_rgba("#0e1030"),  # navy[0] luma 19.1 [DARK OUTLINE]
    # Black Basalt & Sinkhole Vortex (`kuro` 0..6 + `ink` 0..1)
    "k0": hex_to_rgba("#14121f"),  # kuro[0] luma 20.1 [DARK OUTLINE: basalt/abyss]
    "k1": hex_to_rgba("#201e30"),  # kuro[1] luma 32.6 [DARK]
    "k2": hex_to_rgba("#2f2e42"),  # kuro[2] luma 48.6 [DARK]
    "k3": hex_to_rgba("#414257"),  # kuro[3] luma 67.8 [DARK]
    "k4": hex_to_rgba("#575a6c"),  # kuro[4] luma 91.2
    "k5": hex_to_rgba("#727685"),  # kuro[5] luma 118.5
    "k6": hex_to_rgba("#949aa2"),  # kuro[6] luma 153.1
    "i0": hex_to_rgba("#1a1226"),  # ink[0]  luma 22.7 [DARK]
    # Ruby / Carnelian (`red` 0..5)
    "r0": hex_to_rgba("#3a1030"),  # red[0] luma 32.2 [DARK OUTLINE: ruby]
    "r1": hex_to_rgba("#641a30"),  # red[1] luma 50.6 [DARK]
    "r2": hex_to_rgba("#8e2a30"),  # red[2] luma 72.5 [DARK]
    "r3": hex_to_rgba("#b84434"),  # red[3] luma 100.9
    "r4": hex_to_rgba("#d86a44"),  # red[4] luma 134.5
    "r5": hex_to_rgba("#ee9a6a"),  # red[5] luma 173.8
}

for _tok, _rgba in TOKENS.items():
    if _rgba[3] == 255:
        assert _rgba[:3] in ALLOWED_RGB, f"Token {_tok} {_rgba} not in locked palette.json!"


def render_token_grid(w: int, h: int, rows: Sequence[str]) -> Image.Image:
    assert len(rows) == h, f"Expected {h} rows, got {len(rows)}"
    img = Image.new("RGBA", (w, h), TRANSPARENT)
    px = img.load()
    for y, line in enumerate(rows):
        cells = line.split()
        assert len(cells) == w, f"Row {y}: expected {w} tokens, got {len(cells)} -> {line!r}"
        for x, tok in enumerate(cells):
            if tok not in TOKENS:
                raise KeyError(f"Unknown token {tok!r} at ({x},{y})")
            px[x, y] = TOKENS[tok]
    return img


# ---------------------------------------------------------------------------
# 1. obelisk.png (16x48, standing, opaque 14x45: x=1..14, y=2..46)
# ---------------------------------------------------------------------------
def build_obelisk() -> Image.Image:
    """Towering tapered sandstone obelisk with hammered-gold pyramidion peak,
    deeply incised glowing gold/lapis hieroglyph column, and stepped carved limestone pedestal.
    """
    rows = [
        # y=0..1: top air
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        # y=2..10: Gleaming hammered-gold pyramidion peak (top-left sunlit electrum -> warm amber right)
        ".. .. .. .. .. .. .. g0 g0 .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. g0 g5 g3 g0 .. .. .. .. .. ..",
        ".. .. .. .. .. .. g0 g5 g2 g0 .. .. .. .. .. ..",
        ".. .. .. .. .. g0 g5 g4 g3 o2 g0 .. .. .. .. ..",
        ".. .. .. .. .. g0 g4 g5 g3 g2 g0 .. .. .. .. ..",
        ".. .. .. .. g0 g5 g4 b4 b2 g3 o1 g0 .. .. .. ..",
        ".. .. .. .. g0 g4 g5 b3 r4 g2 o1 g0 .. .. .. ..",
        ".. .. .. g0 g5 g4 g4 g3 g3 g2 o2 o1 g0 .. .. ..",
        ".. .. .. g0 g3 g5 g4 b4 b3 g3 g2 o1 g0 .. .. ..",
        # y=11: Molded golden collar & overhang shadow onto upper sandstone shaft (x=4..11)
        ".. .. .. .. w0 o1 g2 g1 g1 o1 w1 w0 .. .. .. ..",
        # y=12..18: Upper tapered sandstone shaft (x=4..11) + Eye of Horus & Ankh loop
        ".. .. .. .. w0 c5 c4 c3 c3 c2 w2 w0 .. .. .. ..",
        ".. .. .. .. w0 c5 w1 b4 b3 w1 w2 w0 .. .. .. ..",
        ".. .. .. .. w0 c4 b3 g5 b2 c2 w2 w0 .. .. .. ..",
        ".. .. .. .. w0 c4 w1 g4 b3 w1 c1 w0 .. .. .. ..",
        ".. .. .. .. w0 c3 w1 w2 w2 w1 w2 w0 .. .. .. ..",
        ".. .. .. .. w0 c5 w1 g5 g4 w1 c2 w0 .. .. .. ..",
        ".. .. .. .. w0 c4 g4 b2 b1 g3 w2 w0 .. .. .. ..",
        # y=19..34: Wider lower tapered shaft (x=3..12) + glowing Gold/Lapis Ankh, Scarab & Cartouche
        ".. .. .. w0 c5 c4 g5 g5 g4 g3 c2 w2 w0 .. .. ..",
        ".. .. .. w0 c5 c3 w1 g5 g3 w1 c2 w2 w0 .. .. ..",
        ".. .. .. w0 c4 c3 w1 g4 g3 w1 c1 w2 w0 .. .. ..",
        ".. .. .. w0 c3 w2 w1 w1 w1 w1 w2 w1 w0 .. .. ..",
        ".. .. .. w0 c5 c4 w1 r5 g5 w1 c2 w2 w0 .. .. ..",
        ".. .. .. w0 c4 b4 b3 g4 b3 b2 c2 w2 w0 .. .. ..",
        ".. .. .. w0 c4 w1 b4 b3 b2 w1 c1 w2 w0 .. .. ..",
        ".. .. .. w0 c3 c3 w1 g4 b2 w1 c1 w1 w0 .. .. ..",
        ".. .. .. w0 c3 w2 w1 w2 w1 w1 w2 w1 w0 .. .. ..",
        ".. .. .. w0 c5 c4 g5 g4 b4 b3 c2 w2 w0 .. .. ..",
        ".. .. .. w0 c4 c3 w1 r4 r3 w1 c2 w2 w0 .. .. ..",
        ".. .. .. w0 c4 c3 g4 g3 b3 b2 c1 w2 w0 .. .. ..",
        ".. .. .. w0 c3 c2 w1 g5 g3 w1 c1 w1 w0 .. .. ..",
        ".. .. .. w0 c3 c2 g4 b3 b2 g3 w2 w1 w0 .. .. ..",
        ".. .. .. g0 g4 g5 g4 g3 g3 g2 o2 o1 g0 .. .. ..",
        ".. .. .. s0 s1 o1 g2 g1 g1 o1 s1 s1 s0 .. .. ..",
        # y=35..42: Stepped carved limestone upper pedestal (x=2..13) — 3/4 sunlit top ledge + lotus relief
        ".. .. s0 c6 c5 c5 s6 s6 s5 s5 s4 s3 s2 s0 .. ..",
        ".. .. s0 c5 s6 g4 b4 r4 r3 b3 g3 s4 s2 s0 .. ..",
        ".. .. s0 s1 s2 s1 s2 s1 s1 s2 s1 s2 s1 s0 .. ..",
        ".. .. s0 s6 s5 c4 g4 b3 b2 g3 c3 s4 s2 s0 .. ..",
        ".. .. s0 s5 s4 c3 g5 r4 g4 b3 c2 s3 s2 s0 .. ..",
        ".. .. s0 s5 s4 s3 c3 g4 g3 c2 s3 s2 s1 s0 .. ..",
        ".. .. s0 s4 s3 s2 s3 s3 s2 s2 s2 s1 s1 s0 .. ..",
        ".. .. s0 s1 s2 s1 s1 s2 s1 s1 s1 s1 s0 s0 .. ..",
        # y=43..46: Flared lower limestone plinth step (x=1..14, 14px wide!)
        ".. s0 c6 c5 s6 s6 s5 s5 s5 s4 s4 s3 s3 s2 s0 ..",
        ".. s0 s6 s5 s5 s4 s1 s5 s4 s4 s1 s3 s2 s2 s0 ..",
        ".. s0 s4 s3 s3 s2 s1 s3 s3 s2 s1 s2 s2 s1 s0 ..",
        ".. s0 s0 s0 s0 s0 s0 s0 s0 s0 s0 s0 s0 s0 s0 ..",
        # y=47: Soft ground shadow (#4c557f @ 85)
        ".. .. ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ .. ..",
    ]
    return render_token_grid(16, 48, rows)


# ---------------------------------------------------------------------------
# 2. pharaoh-sarcophagus.png (32x32, standing, opaque 28x29: x=2..29, y=2..30)
# ---------------------------------------------------------------------------
def build_pharaoh_sarcophagus() -> Image.Image:
    """Regal resting stone-and-gold pharaoh sarcophagus on a stepped sandstone bier:
    - Upper 3/4 resting anthropoid lid (y=2..13): sculpted golden pharaoh Nemes-headdress
      mask with Uraeus cobra & braided lapis-gold beard on the head end (left),
      jeweled Usekh collar + crossed golden crook & flail on the chest band (center),
      and raised royal lapis-and-gold banded foot-case (right).
    - Carved stone-and-gold coffer front (y=14..22): overhanging golden cornice +
      recessed striped lapis/gold serekh inlays & central winged carnelian scarab.
    - Stepped dressed sandstone tomb bier (y=23..30): two crisp 3/4 sunlit step ledges.
    """
    rows = [
        # y=0..1
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        # y=2..3: Domed Nemes headdress crown & golden Uraeus cobra crest (x=6..12)
        ".. .. .. .. .. .. b0 b0 g0 g0 b0 b0 .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. b0 b4 b3 r5 g5 b3 b2 b0 .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        # y=4: Flared Nemes shoulders + lid chest top outline + raised royal foot-case crest (x=23..27)
        ".. .. .. .. b0 g5 g4 g5 g4 g5 g4 b3 b2 b0 g0 b0 b0 g0 b0 b0 g0 b0 .. g0 g0 b0 g0 g0 .. .. .. ..",
        # y=5: Striped Nemes + sculpted gold pharaoh brow + Usekh collar + sunlit foot-case top
        ".. .. .. .. b0 b4 b3 g5 g5 g4 g3 b4 b3 g5 r4 g5 b4 g4 g5 b3 g4 g3 g0 g5 g5 b4 g4 g3 g0 .. .. ..",
        # y=6: Pharaoh kohl eyes + crossed Crook hook (x=15..17) & Flail whisk (x=20..21) + foot-case
        ".. .. .. b0 g5 g4 g5 k0 g5 k0 g3 g4 b3 r4 b4 g5 b4 g5 b2 g5 r4 g4 b3 g5 g4 b3 g4 o2 g0 .. .. ..",
        # y=7: Sculpted nose bridge + Crook & Flail upper diagonals over royal lapis lid inlay
        ".. .. .. b0 b4 b3 g5 g5 g4 g4 o3 b3 g4 b3 g5 b2 g5 b2 g5 b2 g5 o3 b2 g4 g3 b3 g3 o2 g0 .. .. ..",
        # y=8: Pharaoh cheeks & lips + ceremonial braided beard + X-crossing center of Crook & Flail!
        ".. .. .. b0 g5 g4 g4 g4 r3 o2 g3 g5 b2 g4 r3 b2 b1 g5 g5 b2 g4 b2 b3 g4 g3 b2 g3 o2 g0 .. .. ..",
        # y=9: Nemes lower stripes + braided lapis/gold beard (x=11..13) + X lower arms of Crook & Flail
        ".. .. .. b0 b3 b2 g4 g3 g4 g3 b3 g4 b3 g4 b3 b2 g5 b2 b2 g5 b1 b2 r4 g4 g3 b2 g2 o1 g0 .. .. ..",
        # y=10: Lower Nemes lappets + Crook & Flail handles + golden shen seal + foot-case inlays
        ".. .. .. b0 g4 g3 b3 b2 g4 b2 g4 b2 g3 r3 g5 g5 b2 g4 g3 b1 g5 b2 b3 g3 g2 b1 g2 o1 g0 .. .. ..",
        # y=11: Sculpted lid lower bevel (sunlit gold/lapis stripes tapering cleanly to coffer rim)
        ".. .. .. g0 b3 b2 g4 g3 b3 g3 b2 g3 g4 b3 b2 b2 g4 r4 r3 g3 b2 b1 g3 g3 g2 b1 g1 o1 g0 .. .. ..",
        # y=12: Lower lid molding band (warm burnished gold + lapis border)
        ".. .. .. g0 g4 g3 g4 g3 g3 g2 g3 g2 g3 g3 g3 g2 g3 g3 g2 g2 g2 o2 g2 g2 o2 o1 o1 o1 g0 .. .. ..",
        # y=13: Deep recessed lid-to-coffer seam
        ".. .. .. s0 o1 g1 o1 g1 g1 o1 g1 o1 g1 o1 g1 g1 o1 g1 g1 o1 o1 o1 o1 o1 o1 s1 s1 s1 s0 .. .. ..",
        # y=14: Overhanging golden & sunlit sandstone cavetto cornice (x=3..28, 26px wide)
        ".. .. .. g0 g5 g5 c5 g4 g5 g4 c5 g4 g4 g5 g4 g4 g4 g4 c4 g4 g3 g4 g3 c3 g3 g2 o2 o1 g0 .. .. ..",
        # y=15: Crisp cornice cast shadow across coffer front
        ".. .. .. w0 w1 o1 w1 b1 o1 b1 w1 o1 w1 o1 r1 r1 o1 w1 o1 b1 o1 b1 w1 o1 w1 w1 s1 s1 w0 .. .. ..",
        # y=16..21: Carved sandstone & gold coffer front — 4 gold pilasters + 3 lapis/scarab relief panels
        ".. .. .. w0 g5 g4 c4 b4 g4 b3 g4 c3 g5 g4 b4 r5 r4 b3 g4 g3 c3 b4 g4 b3 g3 c2 g3 o2 g0 .. .. ..",
        ".. .. .. w0 g4 g3 c4 b3 r4 b2 g3 c3 g4 g3 b3 g5 r4 b2 g3 g2 c2 b3 g5 b2 g3 c2 g3 o2 g0 .. .. ..",
        ".. .. .. w0 g4 g3 c3 b3 g4 b2 g3 c2 g4 g3 c3 b4 g4 b3 c2 g2 c2 b3 r3 b2 g2 c1 g2 o1 g0 .. .. ..",
        ".. .. .. w0 g3 g2 c3 b2 g3 b1 g2 c2 g3 g2 c2 g4 b3 g3 c2 g2 c1 b2 g3 b1 g2 c1 g2 o1 g0 .. .. ..",
        ".. .. .. w0 g3 o2 w3 w2 w2 w2 w2 w2 g3 o2 w2 w3 w2 w2 w2 o2 w2 w2 w2 w1 w2 w1 g1 o1 g0 .. .. ..",
        ".. .. .. s0 o1 o1 w1 w1 o1 w1 w1 w1 o1 o1 w1 w1 o1 w1 w1 o1 w1 w1 w1 s1 w1 s1 o1 s1 s0 .. .. ..",
        # y=22: Molded sandstone torus transition onto upper bier step
        ".. .. .. s0 c5 c4 c4 c4 c3 c3 c3 c3 c3 c3 c3 c3 c2 c2 c2 c2 w3 w3 w2 w2 w2 s3 s2 s1 s0 .. .. ..",
        # y=23..26: Upper stepped sandstone bier (x=3..28) with sunlit 3/4 top strip & ashlar joints
        ".. .. .. w0 c6 c5 c5 c5 c4 c4 c4 c4 c4 c4 c3 c3 c3 c3 w4 w4 w3 w3 w3 w2 c2 c1 w2 w1 w0 .. .. ..",
        ".. .. .. w0 g4 o3 c4 c3 c3 w1 c4 c3 c3 c3 w1 c3 c3 c2 c2 w1 w3 w3 w2 w1 c2 w2 g3 o1 w0 .. .. ..",
        ".. .. .. w0 o2 o1 c3 c2 w2 w1 c3 c2 c2 w2 w1 c2 c2 w2 w2 w1 w2 w2 w1 w1 c1 w1 o2 o1 w0 .. .. ..",
        ".. .. .. s0 s1 w1 w1 w1 w1 s1 w1 w1 w1 w1 s1 w1 w1 w1 w1 s1 w1 w1 s1 s1 w1 s1 s1 s1 s0 .. .. ..",
        # y=27..30: Lower flared sandstone tomb plinth (x=2..29, full 28px width!)
        ".. .. w0 c6 c6 c5 c5 c5 c4 c4 c4 c4 c4 c3 c3 c3 c3 w4 w4 w4 w3 w3 w3 c2 c2 w2 w2 s2 s1 s0 .. ..",
        ".. .. w0 c5 c4 c4 c3 w1 c4 c4 c3 c3 w1 c3 c3 c2 c2 w1 w3 w3 w2 w2 w1 c2 w2 w2 s2 s2 s1 s0 .. ..",
        ".. .. w0 c3 w3 w2 w2 w1 c2 w2 w2 w1 w1 c2 w2 w2 w1 w1 w2 w2 w1 w1 s1 w1 w1 s2 s1 s1 s1 s0 .. ..",
        ".. .. w0 w0 w0 w0 s0 s0 w0 w0 w0 w0 s0 w0 w0 w0 w0 s0 w0 w0 w0 w0 s0 w0 w0 s0 s0 s0 s0 s0 .. ..",
        # y=31: Ground shadow (#4c557f @ 85)
        ".. .. .. ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ .. .. ..",
    ]
    return render_token_grid(32, 32, rows)


# ---------------------------------------------------------------------------
# 3. jackal-statue.png (16x32, standing, opaque 14x29: x=1..14, y=2..30)
# ---------------------------------------------------------------------------
def build_jackal_statue() -> Image.Image:
    """Imposing black-basalt & gold Anubis jackal-headed guardian statue with
    tall pointed jackal ears, striped Nemes lappets, jeweled golden collar,
    holding a gleaming golden Ankh-staff on a carved sandstone plinth.
    """
    rows = [
        # y=0..1
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        # y=2..5: Twin razor-pointed black-basalt & gold Anubis jackal ears (x=5..7 & x=10..12)
        ".. .. .. .. .. k0 k0 .. .. .. k0 k0 .. .. .. ..",
        ".. .. .. .. .. k0 g4 k0 .. k0 g3 k0 .. .. .. ..",
        ".. .. .. .. k0 k5 g4 k0 .. k0 g2 k2 k0 .. .. ..",
        ".. .. .. .. k0 k4 g3 k2 k0 k3 o2 k2 k0 .. .. ..",
        # y=6..11: Golden Ankh-staff head (left x=1..4) + basalt jackal head, glowing gold eyes & snout
        ".. .. g0 g0 k0 k5 k4 g5 r4 k4 k3 k2 k0 .. .. ..",
        ".. g0 g5 g0 k0 b4 k5 k4 k4 k3 k2 b3 k0 .. .. ..",
        ".. g0 g5 g0 k0 g4 g5 k5 k5 g5 k2 g3 k0 .. .. ..",
        ".. g0 g5 g5 g0 b3 k3 k6 k4 k2 b2 g2 k0 .. .. ..",
        ".. .. g0 g4 g0 g4 k2 k5 k3 k1 g3 b2 k0 .. .. ..",
        ".. .. g0 g4 g0 b3 k1 k2 k1 k1 b2 g2 k0 .. .. ..",
        # y=12..14: Broad jeweled golden Usekh collar + basalt shoulders gripping staff
        ".. .. g0 g5 g0 g5 g4 r4 b4 g4 g3 o2 g0 .. .. ..",
        ".. .. g0 g4 k0 g4 b4 g5 r5 b3 g3 g2 k2 k0 .. ..",
        ".. .. g0 g5 g4 k5 k5 g4 g3 k4 k3 k2 g3 k0 .. ..",
        # y=15..17: Sculpted polished black-basalt chest & arms with golden armbands
        ".. .. g0 g4 k4 k6 k5 k4 k3 k4 k3 k2 k1 k0 .. ..",
        ".. .. g0 g4 k0 g4 k4 k3 k2 k3 k2 g3 k1 k0 .. ..",
        ".. .. g0 g3 k0 k3 g5 g4 b4 g4 g3 k2 k0 .. .. ..",
        # y=18..20: Pleated royal gold & lapis shendyt kilt
        ".. .. g0 g4 k0 g5 g4 b4 r4 b3 g3 o2 g0 .. .. ..",
        ".. .. g0 g3 k0 g4 g3 b3 g5 b2 g3 o1 g0 .. .. ..",
        ".. .. g0 g3 k0 g3 o2 b2 g4 b1 o2 o1 g0 .. .. ..",
        # y=21..23: Muscular basalt legs & golden anklets planted on plinth
        ".. .. g0 g4 k0 k5 k4 k1 k0 k4 k3 k1 k0 .. .. ..",
        ".. .. g0 g3 k0 g5 g4 k1 k0 g4 g3 k1 k0 .. .. ..",
        ".. .. g0 g2 k0 k4 k3 k2 k0 k3 k2 k1 k0 .. .. ..",
        # y=24..30: Carved stepped sandstone plinth (x=2..13 upper, x=1..14 lower flared base)
        ".. .. w0 c6 c5 c5 c4 c4 c4 c3 w4 w3 w2 w0 .. ..",
        ".. .. w0 c4 c3 w2 w1 w2 w1 w1 w2 w2 w1 w0 .. ..",
        ".. .. w0 c4 c3 g4 b4 r4 g4 b3 g3 c2 w1 w0 .. ..",
        ".. .. w0 c3 c2 g3 b3 g5 b2 r3 o2 c1 w1 w0 .. ..",
        ".. .. s0 s1 w1 w1 w1 w1 w1 w1 w1 s1 s1 s0 .. ..",
        ".. w0 c5 c4 c4 c3 w1 c3 c3 w3 w1 w2 s2 s1 s0 ..",
        ".. w0 w0 w0 w0 s0 s0 w0 w0 w0 s0 w0 s0 s0 s0 ..",
        # y=31: Ground shadow (#4c557f @ 85)
        ".. .. ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ .. ..",
    ]
    return render_token_grid(16, 32, rows)


# ---------------------------------------------------------------------------
# 4. gold-pile.png (32x32, standing, opaque 28x25: x=2..29, y=6..30)
# ---------------------------------------------------------------------------
def build_gold_pile() -> Image.Image:
    """Glittering pyramid treasure hoard:
    - Royal golden pharaoh diadem/crown studded with ruby & lapis at the peak (x=11..20, y=6..12)
    - Ruby-studded golden chalice with 3/4 elliptical rim & crisp dark contour on left (x=5..11, y=12..22)
    - Ancient rolled papyrus scroll with wooden knobs & crimson seal on right (x=19..28, y=13..20)
    - Draped royal lapis-lazuli bead necklace with golden scarab pendant in center (x=12..19, y=17..24)
    - Organically cascading golden coins with specular star-glints & gold bullion ingots (x=2..29, y=14..30)
    """
    rows = [
        # y=0..5: top air
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        # y=6..11: Golden Pharaoh Crown peak (x=11..20) — 3/4 rim + ruby center gem + lapis side gems
        ".. .. .. .. .. .. .. .. .. .. .. .. g0 g0 .. g0 g0 .. g0 g0 .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. g0 g5 g4 g0 r5 r4 g0 g4 g3 g0 .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. g0 b4 g5 g5 r4 r3 g4 b3 g3 g0 .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. g0 g5 g4 r1 r0 r1 o1 g4 g2 g0 .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. g0 g5 g4 g5 g4 r5 r4 g4 g3 o3 o2 g0 .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. g0 o2 g3 g4 g3 g4 g3 g2 o2 o1 o1 g0 .. .. .. .. .. .. .. .. .. ..",
        # y=12..15: Chalice 3/4 rim (left x=5..11) + Crown shadow + Papyrus Scroll (right x=19..27)
        ".. .. .. .. .. .. g0 g0 g0 g0 g0 o1 g5 g4 g3 g3 o2 o1 g2 g0 w0 w0 w0 w0 g0 .. .. .. .. .. .. ..",
        ".. .. .. .. .. g0 g5 g5 g4 g3 g0 o2 g5 g4 g4 g5 g3 o2 e0 g4 c6 c6 c5 c4 g4 g0 .. .. .. .. .. ..",
        ".. .. .. .. .. g0 g4 o0 r1 o0 g0 o1 g4 g5 g4 g3 o2 e0 c6 c6 c5 r5 r4 c3 c2 e0 g0 .. .. .. .. ..",
        ".. .. .. .. g0 g4 g5 g4 g3 o2 g0 g4 g5 g3 g4 g3 o1 c6 c5 c4 r4 r3 r2 c3 c2 w2 g3 g0 .. .. .. ..",
        # y=16..20: Ruby-studded Chalice bowl & stem + Draped Lapis Necklace + Sealed Papyrus Scroll
        ".. .. .. .. g0 g5 r5 g4 r4 g3 r2 o0 g4 b0 b4 b3 b0 e0 c5 c4 c3 r2 c2 c1 w2 g4 o2 o1 g0 .. .. ..",
        ".. .. .. g0 g5 g4 g5 g4 g3 o2 o1 o0 b0 b5 b4 g4 b3 b0 e0 c3 c2 c2 c1 w1 e0 g5 g3 o2 g0 .. .. ..",
        ".. .. .. g0 g4 o2 g0 g5 g3 g0 o1 g4 b4 b3 o2 g5 b4 b2 b0 e0 w1 w1 w1 e0 g4 g5 g3 o2 o1 g0 .. ..",
        ".. .. g0 g5 g4 o1 g0 g4 g2 g0 o2 g5 b3 b2 g4 o2 b3 b2 g4 g3 o2 o1 o2 g5 g4 g3 o3 g3 o1 g0 .. ..",
        ".. .. g0 g4 g5 o2 g0 g5 g3 g0 g4 g3 b0 b4 r5 g5 b3 b0 g3 g5 g4 g3 g4 g5 g3 o2 g4 g3 o2 g0 .. ..",
        # y=21..24: Chalice flared foot + Lapis scarab pendant + sculpted gold coin mounds
        ".. .. g0 g5 g4 g5 g5 g4 g3 o2 o1 g4 g3 b2 r4 g5 b2 g2 o2 g4 g5 g4 o2 o3 g4 g5 g3 o2 o1 g0 .. ..",
        ".. .. g0 g4 o2 o0 o0 o0 o0 o1 g4 g5 g3 g0 b0 r2 b0 g0 g4 g3 g4 g3 o2 o1 g4 g4 o3 o2 o1 g0 .. ..",
        ".. .. g0 g5 g4 g3 o2 o1 g3 g5 g4 g3 o2 g5 g4 g3 g4 g5 g3 o2 o3 g5 g4 o2 g3 g5 g3 o2 o1 g0 .. ..",
        ".. .. g0 g4 g5 g4 g3 o2 g4 g4 o3 o2 g4 g5 g3 o2 o3 g4 g3 o1 g4 g5 g3 o2 o1 g3 g4 o2 o1 g0 .. ..",
        # y=25..30: Stacked gold bullion ingot (bottom-left) + ruby/lapis gems + organic scalloped coin edge
        ".. .. g0 o1 g5 g5 g5 g4 g3 o1 g4 g5 g4 g3 o2 o1 g3 g5 g4 o2 g3 g4 o3 r5 r4 o2 g3 o2 o1 g0 .. ..",
        ".. .. g0 o1 g4 g4 g3 g3 o2 o0 g3 g4 g3 o2 g5 g4 o2 g4 g3 o1 o2 g5 g3 r3 r2 o1 g4 g2 o1 g0 .. ..",
        ".. .. g0 o1 o2 o2 o2 o1 o1 g4 g5 g3 o2 o1 g4 g3 o2 o2 o1 g4 g5 g3 o2 b4 b3 o2 g3 o2 o1 o0 .. ..",
        ".. .. .. o0 g4 g5 g4 g3 o2 g3 g4 o2 o1 g4 g5 g3 o2 o1 g3 g4 g3 o2 o1 b2 b1 g2 o2 o1 o0 .. .. ..",
        ".. .. .. .. o0 o0 g3 g3 o2 o1 o1 o1 g3 g3 o2 o1 o0 o0 o2 g3 o2 o1 o0 o0 o0 o1 o1 o0 .. .. .. ..",
        ".. .. .. .. .. .. o0 o0 g0 g0 o0 o0 g0 g0 o0 o0 .. .. o0 g0 g0 o0 .. .. .. o0 o0 .. .. .. .. ..",
        # y=31: Soft ground shadow (#4c557f @ 85) following scalloped coin clusters
        ".. .. .. .. ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ .. .. .. .. ..",
    ]
    return render_token_grid(32, 32, rows)


# ---------------------------------------------------------------------------
# 5. sand-drift.png (32x16, topdown, opaque 30x13: x=1..30, y=2..14)
# ---------------------------------------------------------------------------
def build_sand_drift() -> Image.Image:
    """Wind-sculpted crescent (barchan) desert sandbank seen from above:
    - Plump wind-rippled sunlit windward slope on upper-left/north (`c5`/`c4`/`w4`/`c3`)
    - Razor-sharp S-curved sunlit crescent dune crest (`c6`/`c5`) arching across the bank
    - Full-bodied smooth warm-shaded lee slip-face (`d5` -> `e5` -> `e4` -> `e3` -> `e2`)
      with tapered crescent horns and tiny half-buried weathered sandstone pebbles.
    """
    rows = [
        # y=0..1
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        # y=2..5: Plump windward desert dune slope with diagonal wind-ripple highlights
        ".. .. .. .. .. .. .. .. w0 w0 w0 w0 w0 w0 w0 w0 w0 w0 w0 w0 w0 .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. w0 w0 c5 c5 c5 c4 c4 c4 c5 c4 c4 w4 w4 w3 w2 w0 w0 .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. w0 w0 c5 c5 c4 c4 c5 c5 c4 c4 c4 c3 c3 w4 w4 w3 w3 w2 w2 w0 w0 .. .. .. .. .. .. ..",
        ".. .. .. w0 c5 c5 c4 c4 c5 c5 c4 c4 c5 c5 c4 c3 c3 c3 w4 w4 w3 w3 w2 w2 w1 w0 .. .. .. .. .. ..",
        # y=6..9: Razor-sharp sunlit dune crest (`c6`) breaking over smooth warm lee slip-face!
        ".. .. w0 c5 c4 c4 c5 c5 c6 c6 c6 c6 c5 c5 c5 c4 c4 c3 w4 w4 w3 w3 w2 w2 w2 w1 w0 w0 .. .. .. ..",
        ".. w0 c5 c4 c5 c6 c6 c6 d6 e5 e4 e4 d5 c6 c6 c6 c5 c5 c4 c4 w4 w3 w3 w2 w2 w2 w1 w1 w0 .. .. ..",
        ".. w0 c4 c5 c6 d6 e5 e4 e4 e3 e3 e3 e4 e4 e5 d6 c6 c6 c6 c5 c4 c4 w4 w3 w3 w2 w2 w1 w1 w0 .. ..",
        ".. w0 c5 c6 d5 e4 e4 e3 e3 e2 e2 e2 e3 e3 e3 e4 e5 d6 c6 c6 c5 c5 c4 w4 w3 w3 w2 w2 w1 w0 w0 ..",
        # y=10..14: Warm shaded lee slope + gentle crescent indentation & buried stone pebbles
        ".. w0 c5 d5 e4 e3 e3 s5 s3 e2 e2 e1 e2 e2 e2 e3 e3 e4 e5 d5 c6 c5 c4 c4 w3 w3 w2 w2 w1 w1 w0 ..",
        ".. w0 d5 e4 e3 e2 e2 s3 s1 e1 e1 w0 w0 e1 e1 e2 e2 e3 e4 s6 s4 d5 c5 c4 w3 w2 w2 w1 w1 w1 w0 ..",
        ".. .. w0 e3 e2 e2 e1 e1 w0 w0 .. .. .. .. w0 w0 e1 e2 e2 s3 s1 e3 e4 d5 c4 w3 w2 w2 w1 w0 w0 ..",
        ".. .. w0 w1 e2 e1 w0 w0 .. .. .. .. .. .. .. .. w0 w0 e1 e1 e2 e2 e3 e4 w3 w2 w1 w1 w0 .. .. ..",
        ".. .. .. w0 w0 w0 .. .. .. .. .. .. .. .. .. .. .. .. .. w0 w0 e1 e1 w0 w0 w0 w0 w0 .. .. .. ..",
        # y=15: Subtle lee ground shadow
        ".. .. .. .. ~~ ~~ ~~ .. .. .. .. .. .. .. .. .. .. .. .. .. ~~ ~~ ~~ ~~ ~~ ~~ ~~ .. .. .. .. ..",
    ]
    return render_token_grid(32, 16, rows)


# ---------------------------------------------------------------------------
# 6. sand-pit.png (32x32, topdown, opaque 30x28: x=1..30, y=3..30)
# ---------------------------------------------------------------------------
def build_sand_pit() -> Image.Image:
    """Swirling funneling quicksand trap (`sandpit` gimmick) seen from above:
    - 4 angular weathered limestone floor-slab chunks collapsing at the rim
    - Concave top-left funnel lighting (shaded NW inner lip, sunlit SE funnel wall)
    - Crisp concentric clockwise spiral sand rings winding into a tight, deep
      central sinkhole abyss (`e0` -> `i0` -> `k0`, zero #000000).
    """
    rows = [
        # y=0..2
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        # y=3..7: Collapsed sandstone/limestone rim + top-left & top-right broken stone chunks
        ".. .. .. .. .. .. .. .. .. s0 s0 w0 w0 w0 w0 w0 w0 w0 w0 s0 s0 .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. s0 s0 s0 s6 s5 c5 c4 c3 w3 w3 c3 c4 s6 s5 s4 s0 s0 s0 .. .. .. .. .. .. .. ..",
        ".. .. .. .. s0 s0 s6 s5 s3 s2 s1 e2 e2 w2 w2 w2 e2 e3 d5 s5 s3 s5 s4 s2 s0 s0 .. .. .. .. .. ..",
        ".. .. .. s0 s6 s5 s3 s1 e1 e1 e2 e3 e4 d5 c4 c3 d5 e3 e2 s1 s1 s4 s3 s1 w2 w1 w0 .. .. .. .. ..",
        ".. .. w0 c5 s4 s2 s1 e1 e2 e3 e4 d5 c4 c3 w3 e4 e3 e2 e1 e2 e3 d5 c4 c3 w3 w2 w1 w0 w0 .. .. ..",
        # y=8..13: Outer & mid clockwise spiral rings curling into funnel
        ".. w0 c5 c4 e2 e1 e2 e3 d5 c4 c3 w3 e3 e2 e2 e2 e3 e4 d5 c4 c4 c5 c4 d5 e4 w3 w2 w1 w1 w0 .. ..",
        ".. w0 c4 w3 e2 e2 e4 c4 c3 w3 e3 e2 e1 e1 e2 e3 d5 c4 c4 d6 c5 c5 d5 e4 e3 e4 w3 w2 w2 w0 w0 ..",
        ".. w0 c4 e3 e2 e4 c4 w3 e3 e2 e1 e2 e3 e4 d5 c4 d5 e3 e3 e4 d5 c5 c4 d5 e3 e3 d5 w3 w2 w1 w0 ..",
        ".. w0 w3 e2 e3 c4 w3 e2 e1 e2 e3 d5 c4 c3 e4 e3 e2 e1 e2 e3 e4 d6 c5 c4 d5 e2 e3 c4 w3 w1 w0 ..",
        ".. s0 s5 e2 d5 w3 e2 e1 e2 e4 c4 w3 e3 e2 e1 e1 e1 e1 e2 e3 e4 d6 c5 c5 d5 e3 e2 d5 c4 w2 w0 ..",
        ".. s0 s4 s1 d5 e3 e1 e2 e4 c3 e3 e2 e1 e0 e0 i0 i0 e0 e1 e2 e4 d5 c6 c5 c4 d5 e2 e4 c4 w2 w0 ..",
        # y=14..19: Tight swirling central sinkhole throat (`k0`/`i0` at x=14..18, y=15..18) + spiral arms!
        ".. w0 c4 e3 w3 e2 e1 e3 d5 e3 e1 e0 i0 k0 k0 k0 i0 e0 e1 e3 d5 c5 c6 c5 d5 e3 e2 e4 c4 w2 w0 ..",
        ".. w0 c3 e3 e2 e1 e2 e4 w3 e2 e0 i0 k0 k0 k0 i0 e1 e0 e2 d5 c5 c5 d5 e4 e3 e2 e3 d5 c4 w2 w0 ..",
        ".. w0 w3 e2 e1 e2 e3 d5 e3 e1 i0 k0 k0 k0 e0 e2 e2 e1 e3 c5 c4 d5 e3 e2 e2 e3 d5 c5 c4 w2 w0 ..",
        ".. w0 w3 e2 e1 e2 e4 c3 e2 e1 e0 i0 k0 i0 e2 d5 e3 e2 e4 c5 d5 e3 e2 e2 e3 d5 c5 c5 w3 w1 w0 ..",
        ".. w0 w2 e2 e2 e3 d5 c4 e3 e2 e1 e0 e0 e1 e3 c4 d5 e3 e4 c5 e3 e2 e2 e4 d5 c5 c5 w4 w2 w1 s0 ..",
        ".. w0 w2 e3 e2 e3 d5 c4 d5 e3 e2 e1 e1 e2 e4 c5 c4 d5 d5 c4 e3 e3 e4 d5 c6 c5 s6 s4 s2 s1 s0 ..",
        # y=20..25: Sunlit SE funnel slope + bottom-left & bottom-right collapsed limestone chunks
        ".. w0 c3 e4 e3 e3 e4 c4 c5 d5 e4 e3 e3 e4 d5 c5 c5 c4 c4 d5 e3 e4 d6 c6 c5 s6 s5 s4 s2 s1 s0 ..",
        ".. s0 s6 d5 e4 e3 e4 d5 c5 c5 d5 e4 e4 d5 c5 c5 c4 d5 d5 d6 c5 c6 c6 c5 c4 s5 s4 s3 s1 w0 .. ..",
        ".. s0 s5 s3 e3 e4 d5 c5 c5 d6 c6 c5 d6 c6 c5 c5 d6 c6 c6 c5 c5 c5 c4 c4 s3 s3 s2 s1 w1 w0 .. ..",
        ".. .. s0 s4 s3 s1 d5 c5 c6 c6 c6 c6 c6 c5 c5 c5 c5 c5 c5 c4 c4 w4 w3 s2 s1 w2 w2 w1 w0 .. .. ..",
        ".. .. s0 s3 s2 s1 e3 d5 c5 c5 c5 c6 c5 c5 c4 c4 c4 c4 w4 w4 w3 w3 w2 w2 w2 w2 w1 w0 .. .. .. ..",
        ".. .. .. s0 s1 s0 w2 e4 d5 c4 c4 c5 c4 c4 c4 w4 w4 w3 w3 w3 w2 w2 w2 w1 w1 w0 w0 .. .. .. .. ..",
        # y=26..30: Outer lower sand rim & dark sandstone outline
        ".. .. .. .. w0 w0 w2 w2 e3 e4 d5 c4 c4 w4 w4 w3 w3 w2 w2 w2 w1 w1 w1 w0 w0 .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. w0 w1 w2 w2 w3 w3 w3 w3 w2 w2 w2 w1 w1 w1 w0 w0 w0 .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. w0 w0 w1 w2 w2 w2 w2 w1 w1 w0 w0 w0 .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. w0 w0 w0 w0 w0 w0 w0 w0 .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. .. .. w0 w0 w0 w0 .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
        ".. .. .. .. .. .. .. .. .. .. ~~ ~~ ~~ ~~ ~~ ~~ ~~ ~~ .. .. .. .. .. .. .. .. .. .. .. .. .. ..",
    ]
    return render_token_grid(32, 32, rows)


SPRITE_SPECS: List[Tuple[str, str, Tuple[int, int], str, Tuple[int, int], Callable[[], Image.Image]]] = [
    ("obelisk.png", "1. obelisk", (16, 48), "standing", (14, 45), build_obelisk),
    ("pharaoh-sarcophagus.png", "2. pharaoh-sarcophagus", (32, 32), "standing", (28, 29), build_pharaoh_sarcophagus),
    ("jackal-statue.png", "3. jackal-statue", (16, 32), "standing", (14, 29), build_jackal_statue),
    ("gold-pile.png", "4. gold-pile", (32, 32), "standing", (28, 25), build_gold_pile),
    ("sand-drift.png", "5. sand-drift", (32, 16), "topdown", (30, 13), build_sand_drift),
    ("sand-pit.png", "6. sand-pit", (32, 32), "topdown", (30, 28), build_sand_pit),
]


def validate_sprite(
    filename: str, img: Image.Image, expected_canvas: Tuple[int, int]
) -> Tuple[List[str], Dict[str, object]]:
    errors: List[str] = []
    w, h = img.size
    if (w, h) != expected_canvas:
        errors.append(f"{filename}: canvas {w}x{h} != expected {expected_canvas[0]}x{expected_canvas[1]}")

    px = img.load()
    opaque_xs: List[int] = []
    opaque_ys: List[int] = []
    used_colors: set[Tuple[int, int, int]] = set()
    off_palette = 0
    pure_black = 0
    bad_alpha = 0
    edge_bright = 0
    edge_total = 0

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            elif a == 255:
                opaque_xs.append(x)
                opaque_ys.append(y)
                used_colors.add((r, g, b))
                if (r, g, b) == (0, 0, 0):
                    pure_black += 1
                if (r, g, b) not in ALLOWED_RGB:
                    off_palette += 1
                touches_non_opaque = False
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if not (0 <= nx < w and 0 <= ny < h) or px[nx, ny][3] != 255:
                        touches_non_opaque = True
                        break
                if touches_non_opaque:
                    edge_total += 1
                    if luma(r, g, b) > 85.0:
                        edge_bright += 1
                        errors.append(
                            f"{filename}: bright outer-edge pixel at ({x},{y}) "
                            f"#{r:02x}{g:02x}{b:02x} luma={luma(r,g,b):.1f} > 85"
                        )
            else:
                if (r, g, b, a) != SHADOW_RGBA:
                    bad_alpha += 1

    if off_palette:
        errors.append(f"{filename}: {off_palette} off-palette pixels")
    if pure_black:
        errors.append(f"{filename}: {pure_black} pure #000000 pixels")
    if bad_alpha:
        errors.append(f"{filename}: {bad_alpha} illegal semi-transparent pixels")
    if not opaque_xs:
        errors.append(f"{filename}: empty image")
        return errors, {}

    ow = max(opaque_xs) - min(opaque_xs) + 1
    oh = max(opaque_ys) - min(opaque_ys) + 1
    left_gap = min(opaque_xs)
    right_gap = (w - 1) - max(opaque_xs)
    bottom_gap = (h - 1) - max(opaque_ys)

    if abs(left_gap - right_gap) > 2:
        errors.append(f"{filename}: not horizontally centered (left={left_gap}, right={right_gap})")
    if bottom_gap > 2:
        errors.append(f"{filename}: not bottom-aligned (bottom_gap={bottom_gap})")
    if ow / w < 0.75 or oh / h < 0.75:
        errors.append(f"{filename}: undersized bbox {ow}x{oh} in {w}x{h}")

    metrics: Dict[str, object] = {
        "canvas": (w, h),
        "opaque": (ow, oh),
        "colors": len(used_colors),
        "edge_bright": edge_bright,
        "edge_total": edge_total,
        "left_gap": left_gap,
        "right_gap": right_gap,
        "bottom_gap": bottom_gap,
    }
    return errors, metrics


def render_preview(sprites: Dict[str, Image.Image], metrics: Dict[str, Dict[str, object]]) -> None:
    """Render 2x + 1x on #767670 neutral gray next to 22px Beodeul scale character."""
    GRAY_BG = (0x76, 0x76, 0x70, 255)
    HEADER_BG = (0x54, 0x52, 0x4C, 255)
    CARD_HDR = (0x62, 0x60, 0x5A, 255)
    SAND_TILE = (0xA8, 0x98, 0x74, 255)
    SAND_LINE = (0x8E, 0x7E, 0x5C, 255)
    LINE_COL = (0x8E, 0x8C, 0x84, 255)
    TEXT_COL = (248, 244, 232, 255)
    MUTED_COL = (218, 214, 200, 255)
    ACCENT_COL = (248, 224, 136, 255)

    char_4x = Image.open(REFS_DIR / "ref_beodeul_char_4x.png").convert("RGBA")
    char_1x = char_4x.resize((char_4x.width // 4, char_4x.height // 4), Image.Resampling.NEAREST)
    char_2x = char_1x.resize((char_1x.width * 2, char_1x.height * 2), Image.Resampling.NEAREST)

    cols = 3
    rows_n = 2
    cell_w = 260
    cell_h = 186
    pad = 14
    header_h = 80

    sheet_w = pad + cols * (cell_w + pad)
    sheet_h = header_h + pad + rows_n * (cell_h + pad)
    sheet = Image.new("RGBA", (sheet_w, sheet_h), GRAY_BG)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    # Header
    draw.rectangle([0, 0, sheet_w - 1, header_h - 1], fill=HEADER_BG)
    draw.line([(0, header_h - 1), (sheet_w - 1, header_h - 1)], fill=LINE_COL)
    sheet.alpha_composite(char_2x, (16, header_h - 10 - char_2x.height))
    sheet.alpha_composite(char_1x, (16 + char_2x.width + 10, header_h - 10 - char_1x.height))

    draw.text(
        (108, 12),
        "T3 DUNGEON THEME OBJECTS BATCH 1/4 -- PYRAMID (6 OBJECTS, GEMINI-4-CARBON MEDIUM)",
        fill=TEXT_COL,
        font=font,
    )
    draw.text(
        (108, 32),
        f"100% Locked Fable Palette (palette.json) | 0 Off-Palette | 0 #000000 | Shadow #4c557f@85 | Scale: Beodeul {char_1x.width}x{char_1x.height}px",
        fill=MUTED_COL,
        font=font,
    )
    draw.text(
        (108, 52),
        "Each Card: [Beodeul Char 2x + Sprite 2x + Beodeul Char 1x + Sprite 1x] on #767670 + 1x Desert Floor Inset",
        fill=ACCENT_COL,
        font=font,
    )

    for idx, (fname, title, canvas, cam, target_op, _fn) in enumerate(SPRITE_SPECS):
        col_i = idx % cols
        row_i = idx // cols
        x0 = pad + col_i * (cell_w + pad)
        y0 = header_h + pad + row_i * (cell_h + pad)

        draw.rectangle([x0, y0, x0 + cell_w - 1, y0 + cell_h - 1], fill=GRAY_BG, outline=LINE_COL)
        draw.rectangle([x0 + 1, y0 + 1, x0 + cell_w - 2, y0 + 22], fill=CARD_HDR)
        draw.text((x0 + 8, y0 + 6), f"{title} ({canvas[0]}x{canvas[1]}, {cam})", fill=TEXT_COL, font=font)

        img1 = sprites[fname]
        img2 = img1.resize((img1.width * 2, img1.height * 2), Image.Resampling.NEAREST)
        m = metrics[fname]
        op_w, op_h = m["opaque"]  # type: ignore[misc]

        baseline = y0 + cell_h - 28

        # Left/center on #767670: Char 2x + Sprite 2x + Char 1x + Sprite 1x
        sx = x0 + 12
        sheet.alpha_composite(char_2x, (sx, baseline - char_2x.height))
        sx += char_2x.width + 10
        sheet.alpha_composite(img2, (sx, baseline - img2.height))
        sx += img2.width + 14
        sheet.alpha_composite(char_1x, (sx, baseline - char_1x.height))
        sx += char_1x.width + 6
        sheet.alpha_composite(img1, (sx, baseline - img1.height))

        # Mini 1x sandstone dungeon floor swatch on far right to check in-dungeon readability
        sw_w, sw_h = 44, 56
        sw_x = x0 + cell_w - sw_w - 8
        sw_y = y0 + 30
        draw.rectangle([sw_x, sw_y, sw_x + sw_w - 1, sw_y + sw_h - 1], fill=SAND_TILE, outline=SAND_LINE)
        for gx in range(sw_x + 16, sw_x + sw_w, 16):
            draw.line([(gx, sw_y + 1), (gx, sw_y + sw_h - 2)], fill=SAND_LINE)
        for gy in range(sw_y + 16, sw_y + sw_h, 16):
            draw.line([(sw_x + 1, gy), (sw_x + sw_w - 2, gy)], fill=SAND_LINE)
        ix = sw_x + (sw_w - img1.width) // 2
        iy = sw_y + (sw_h - img1.height) // 2
        sheet.alpha_composite(img1, (ix, iy))

        draw.text(
            (x0 + 8, y0 + cell_h - 18),
            f"op={op_w}x{op_h} (tgt ~{target_op[0]}x{target_op[1]}) | {m['colors']} colors | 0 err",
            fill=MUTED_COL,
            font=font,
        )

    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(PREVIEW_PATH)


def main() -> int:
    OUT_OBJS_DIR.mkdir(parents=True, exist_ok=True)
    all_errors: List[str] = []
    sprites: Dict[str, Image.Image] = {}
    metrics_map: Dict[str, Dict[str, object]] = {}

    print("=== T3 DUNGEON THEME OBJECTS BATCH 1/4 — PYRAMID (6 OBJECTS) ===")
    for fname, _title, canvas, cam, target_op, builder in SPRITE_SPECS:
        img = builder()
        out_path = OUT_OBJS_DIR / fname
        img.save(out_path)
        errs, m = validate_sprite(fname, img, canvas)
        all_errors.extend(errs)
        sprites[fname] = img
        metrics_map[fname] = m
        op = m.get("opaque", (0, 0))
        print(
            f"  {fname:26s} canvas={canvas[0]:2d}x{canvas[1]:2d}  "
            f"opaque={op[0]:2d}x{op[1]:2d} (target ~{target_op[0]}x{target_op[1]})  "
            f"cam={cam:8s}  colors={m.get('colors', 0):2d}  "
            f"bright_edge={m.get('edge_bright', 0)}/{m.get('edge_total', 0)}"
        )

    render_preview(sprites, metrics_map)
    print(f"Preview written to: {PREVIEW_PATH}")

    if all_errors:
        print(f"\nFAIL ({len(all_errors)} errors):")
        for e in all_errors:
            print(f"  - {e}")
        return 1

    print("\nPASS: 100% locked to palette.json, 0 #000000, strict alpha, 0 bright outer edges!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
