#!/usr/bin/env python3
"""
Build Non-Rectangular Architecture v2 Showcase Maps for `pyramid` & `otherworld` (28x22 tiles = 448x352 1x, 896x704 2x)

1. `map_pyramid_v2.png` (28x22 tiles = 448x352 1x, plus `_2x.png`):
   - Exact `room2.py` derived ceiling rims (3px carved-sandstone inner lips on all 4 directions, `#161214` desert rock void)
   - Non-rectangular Stepped Cruciform Royal Tomb Plan:
     * North Stepped Pharaoh Burial Sanctum (ziggurat/octagonal apse, raised golden-inlaid stone dais cradling
       `pharaoh-sarcophagus`, flanked by twin `jackal-statue`s & `obelisk`s, winged-sun cartouche relief, ceiling sunbeams)
     * Central Sunken Quicksand & Pillar Hall (thick `#` sandstone partitions with 32px carved lintel doorways,
       sunken swirling `sand-pit` basin encircled by irregular pale-limestone slab walkways, Hypostyle lotus pillars,
       wind-blown `sand-drift`s encroaching from cracked masonry)
     * Asymmetric West Canopic Relic Alcove & East Royal Treasury Vault (`gold-pile` hoards, carved sandstone offering
       tables WITH golden canopic jars, papyrus scrolls, ruby chalices & lotus censers ON TOP, glowing wall torches)
     * Protruding South Tomb Entrance Passage
   - 32px world-coord sandstone walls with carved golden & lapis hieroglyph frieze, quiet staggered world-coord floors
     (ZERO 16px grid!), 3px wall-foot + 6px west-wall cast shadows, and 100% BFS walkability verification.

2. `map_otherworld_v2.png` (28x22 tiles = 448x352 1x, plus `_2x.png`):
   - Deep cosmic starry purple-indigo abyssal void with distant nebula clouds, star glints & floating basalt shards
   - 4 Asymmetric Jagged Craggy Basalt Islands with sculpted 3D obsidian under-cliffs & glowing magenta/violet magma veins:
     1) North Demon-Lord Citadel Island (stepped jagged bastion, `portal-gate` at apex, `demon-throne` on crimson-rune
        obsidian dais, flanked by `bone-pillar`s & `void-brazier`s + East Ritual Altar WITH abyssal relics ON TOP)
     2) Central Rifted Nexus Island (irregular cracked dark-basalt world-coord slabs + glowing violet arcane rune circle)
     3) West Corrupt Crystal Outcrop Island (`corrupt-crystal-big` & `corrupt-crystal` clusters pulsing violet light)
     4) South Arrival Causeway Island
   - Linked by 3 arched dark-stone & bone rib bridges with 100% BFS-verified walkability from South Arrival to
     West Crystal Outcrop, Demon Throne, Ritual Wing, and Portal Gate.
"""

from __future__ import annotations
import json
import math
import os
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict, List, Optional, Sequence, Tuple
from PIL import Image

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
PYRAMID_DIR = ROOT / "tiledata/dungeon-themes-carbon/pyramid"
PYRAMID_OBJ_DIR = PYRAMID_DIR / "objects"
OTHERWORLD_DIR = ROOT / "tiledata/dungeon-themes-carbon/otherworld"
OTHERWORLD_OBJ_DIR = OTHERWORLD_DIR / "objects"
CHAR_REF_4X = ROOT / "tiledata/dungeon-pilot/_dots_kit_refs/ref_beodeul_char_4x.png"

MAP_TW, MAP_TH = 28, 22
W_PX, H_PX = MAP_TW * 16, MAP_TH * 16  # 448 x 352


# ===========================================================================
# Shared Deterministic Hash, Noise & Pixel Helpers
# ===========================================================================
def hx(s: str) -> Tuple[int, int, int, int]:
    s = s.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), 255)


def hx3(s: str) -> Tuple[int, int, int]:
    s = s.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))


def lerp_rgb(a: Tuple[int, int, int], b: Tuple[int, int, int], t: float) -> Tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return (
        int(round(a[0] + (b[0] - a[0]) * t)),
        int(round(a[1] + (b[1] - a[1]) * t)),
        int(round(a[2] + (b[2] - a[2]) * t)),
    )


def mul(c: Sequence[int], k: float) -> Tuple[int, int, int]:
    return (
        max(0, min(255, int(round(c[0] * k)))),
        max(0, min(255, int(round(c[1] * k)))),
        max(0, min(255, int(round(c[2] * k)))),
    )


def H(x: int, y: int, s: int = 0) -> float:
    n = (x * 374761393 + y * 668265263 + s * 1442695041) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 65535.0


def vnoise(x: float, y: float, scale: float, seed: int = 17) -> float:
    sx = x / scale
    sy = y / scale
    ix = math.floor(sx)
    iy = math.floor(sy)
    fx = sx - ix
    fy = sy - iy
    ux = fx * fx * (3.0 - 2.0 * fx)
    uy = fy * fy * (3.0 - 2.0 * fy)
    a = H(ix, iy, seed)
    b = H(ix + 1, iy, seed)
    c = H(ix, iy + 1, seed)
    d = H(ix + 1, iy + 1, seed)
    return (a * (1.0 - ux) + b * ux) * (1.0 - uy) + (c * (1.0 - ux) + d * ux) * uy


def fbm(x: float, y: float, seed: int = 31) -> float:
    return (
        0.55 * vnoise(x, y, 26.0, seed)
        + 0.30 * vnoise(x, y, 11.0, seed + 7)
        + 0.15 * vnoise(x, y, 5.0, seed + 19)
    )


class Pix:
    def __init__(self, w: int, h: int):
        self.w, self.h = w, h
        self.im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self.p = self.im.load()

    def set(self, x: int, y: int, c: Optional[Tuple[int, ...]]) -> None:
        if c is not None and 0 <= x < self.w and 0 <= y < self.h:
            self.p[x, y] = c if len(c) == 4 else (c[0], c[1], c[2], 255)

    def get(self, x: int, y: int) -> Tuple[int, int, int, int]:
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.p[x, y]
        return (0, 0, 0, 0)

    def lit(self, x0: int, y0: int, rows: Sequence[str], key: Dict[str, Tuple[int, ...]]) -> None:
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch not in (" ", "."):
                    self.set(x0 + i, y0 + j, key[ch])


def load_beodeul_char_1x() -> Image.Image:
    ch4 = Image.open(CHAR_REF_4X).convert("RGBA")
    ch1 = ch4.resize((ch4.width // 4, ch4.height // 4), Image.Resampling.NEAREST)
    cpx = ch1.load()
    for yy in range(ch1.height):
        for xx in range(ch1.width):
            if cpx[xx, yy][3] < 128:
                cpx[xx, yy] = (0, 0, 0, 0)
    return ch1


def make_char_desert_variant(ch1: Image.Image) -> Image.Image:
    """Warm desert-gold & lapis scholar-adventurer palette variant."""
    out = ch1.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            if b > r + 14 and b > g:
                nr = min(255, int(b * 1.05 + 18))
                ng = min(255, int(b * 0.84 + 8))
                nb = min(255, int(r * 0.65 + 10))
                px[x, y] = (nr, ng, nb, a)
    return out


def make_char_void_variant(ch1: Image.Image) -> Image.Image:
    """Crimson-and-amethyst void-hunter palette variant."""
    out = ch1.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            if b > r + 14 and b > g:
                nr = min(255, int(b * 0.96 + 24))
                ng = min(255, int(g * 0.52))
                nb = min(255, int(b * 0.88 + 16))
                px[x, y] = (nr, ng, nb, a)
    return out


# ===========================================================================
# PART 1 — MAP 1: `map_pyramid_v2.png` (28x22 = 448x352)
# ===========================================================================
PYR_VOID = hx3("#161214")
PYR_CEIL_CHECKER = (hx3("#1f191a"), hx3("#191416"))

# 3px carved sandstone inner ceiling rim (dark outline -> warm ochre bevel -> sunlit sandstone lip)
PYR_RIM_SAND = [
    hx3("#2b1e16"),  # 0: crisp dark outer mortar line
    hx3("#4a3423"),  # 1: deep carved bevel
    hx3("#694c32"),  # 2: east/south step
    hx3("#8b6743"),  # 3: inner bevel
    hx3("#af8658"),  # 4: lit carved sandstone face
    hx3("#d2aa74"),  # 5: bright south inner ceiling lip
]

# Quiet warm-ochre staggered world-coord sandstone floor slabs (kept below #ecd060 gold & #e4d6a8 sand-drifts!)
PYR_SAND_FLOOR = [
    hx3("#332317"),  # 0: mortar joint
    hx3("#422e1f"),  # 1: shaded ochre slab
    hx3("#4f3826"),  # 2: main warm-ochre body A
    hx3("#5b412c"),  # 3: main warm-ochre body B
    hx3("#694c34"),  # 4: subtle north slab bevel
]

# Royal Sanctum & Treasury polished sandstone floor (slightly richer warm amber-ochre)
PYR_SANCTUM_FLOOR = [
    hx3("#382619"),  # 0: mortar joint
    hx3("#483221"),  # 1: deep slab
    hx3("#563d29"),  # 2: polished ochre A
    hx3("#644831"),  # 3: polished ochre B
    hx3("#74553b"),  # 4: top edge highlight
]

# Sunken Central Hall floor vs Safe Curved Pale-Limestone Walkways around `sand-pit`
PYR_SUNKEN_FLOOR = [
    hx3("#2b1d14"),  # 0: deep joint
    hx3("#38261a"),  # 1: sunken shadow
    hx3("#443021"),  # 2: sunken ochre A
    hx3("#4f3827"),  # 3: sunken ochre B
    hx3("#5b422e"),  # 4: subtle bevel
]

PYR_WALKWAY_LIMESTONE = [
    hx3("#3c2b1c"),  # 0: limestone mortar
    hx3("#59422c"),  # 1: shaded limestone
    hx3("#6b5137"),  # 2: warm limestone A
    hx3("#795d40"),  # 3: warm limestone B
    hx3("#8a6c4c"),  # 4: lit limestone slab lip
]

# 32px world-coordinate dressed Egyptian sandstone wall ramp + golden/lapis hieroglyphs
PYR_WALL = [
    hx3("#241912"),  # 0: deep mortar / plinth base
    hx3("#3c2b1d"),  # 1: dark mortar / shadow block
    hx3("#563f2a"),  # 2: shaded sandstone block
    hx3("#6f5338"),  # 3: mid dressed sandstone
    hx3("#886746"),  # 4: warm ochre sandstone
    hx3("#a47f57"),  # 5: top course highlight
    hx3("#c29b6c"),  # 6: carved cornice glint
]

HIERO_GOLD_HI = hx3("#ecd060")
HIERO_GOLD_MID = hx3("#d4ac38")
HIERO_GOLD_LO = hx3("#967428")
HIERO_LAPIS = hx3("#2c4c90")
HIERO_CARNELIAN = hx3("#a85420")


def pyr_floor_sandstone(x: int, y: int, ramp: Sequence[Tuple[int, int, int]] = PYR_SAND_FLOOR, seed: int = 23) -> Tuple[int, int, int]:
    """Staggered non-16px world-coord sandstone slabs (heights 9,11,10,12; widths 15,19,14,18,17)."""
    row_hs = (9, 11, 10, 12, 9, 11)
    cyc_h = sum(row_hs)  # 62px (coprime-like to 16)
    yc = y % cyc_h
    yr = (y // cyc_h) * 6
    acc_y = 0
    ly = 0
    sh = 10
    for idx, h_i in enumerate(row_hs):
        if yc < acc_y + h_i:
            yr += idx
            ly = yc - acc_y
            sh = h_i
            break
        acc_y += h_i

    widths = (15, 19, 14, 18, 17, 13, 20)
    cyc_w = sum(widths)  # 116px
    shift = (yr * 29 + int(H(yr, 2, seed) * 37)) % cyc_w
    xx = x + shift
    xc_id = (xx // cyc_w) * 7
    rem_x = xx % cyc_w
    acc_x = 0
    lx = 0
    sw = 15
    for idx, w_i in enumerate(widths):
        if rem_x < acc_x + w_i:
            xc_id += idx
            lx = rem_x - acc_x
            sw = w_i
            break
        acc_x += w_i

    if ly == sh - 1 or lx == sw - 1:
        return ramp[0]
    base = 3 if H(xc_id, yr, seed + 5) < 0.48 else 2
    if H(xc_id, yr, seed + 9) < 0.14:
        base = 1
    t = base + 1 if (ly == 0 and 1 <= lx <= sw - 3 and H(xc_id, yr, seed + 13) < 0.62) else base
    # Subtle eroded sand grain near slab corner only (quiet center!)
    if (ly == sh - 2 or lx == sw - 2) and H(x // 2, y // 2, seed + 17) < 0.16:
        t = max(1, t - 1)
    return ramp[max(1, min(4, t))]


def pyr_floor_sanctum(x: int, y: int) -> Tuple[int, int, int]:
    """North Pharaoh Sanctum floor with stepped Hammered-Gold & Lapis-Inlaid Stone Dais!"""
    cx, cy = 224.0, 73.0
    dx, dy = abs(x - cx), abs(y - cy)
    in_outer = (dx <= 47 and dy <= 21 and (dx + dy * 1.4) <= 65)
    in_step = (dx <= 43 and dy <= 17 and (dx + dy * 1.4) <= 59)
    in_inner = (dx <= 38 and dy <= 13 and (dx + dy * 1.4) <= 53)

    if in_outer:
        if not in_step:
            # 3D stepped carved sandstone riser + south/east contact shadow
            if y > cy + 15 or x > cx + 41:
                return hx3("#261a12")
            if y < cy - 15 or x < cx - 41:
                return hx3("#c49d6c")
            return hx3("#967249")
        if not in_inner:
            # Regal hammered-gold rail inlaid with spaced lapis-lazuli & carnelian gems (no diagonal stripes!)
            gem_slot = ((x + 2) % 8 in (0, 1)) and ((y + 2) % 6 in (0, 1))
            if gem_slot:
                return HIERO_CARNELIAN if ((x // 8 + y // 6) % 3 == 0) else HIERO_LAPIS
            if y < cy - 12 or x < cx - 37:
                return HIERO_GOLD_HI
            return HIERO_GOLD_MID if (x + y) % 4 != 0 else HIERO_GOLD_LO
        c = pyr_floor_sandstone(x, y, PYR_WALKWAY_LIMESTONE, seed=61)
        if abs(dx - 23) == 0 and dy <= 9:
            return HIERO_GOLD_MID if (y % 4 != 0) else HIERO_LAPIS
        return c

    # Royal processional limestone walkway leading south from dais through Sanctum portal (x=208..240)
    if abs(x - 224.0) <= 16.5 and y >= 88:
        return pyr_floor_sandstone(x, y, PYR_WALKWAY_LIMESTONE, seed=43)

    return pyr_floor_sandstone(x, y, PYR_SANCTUM_FLOOR, seed=29)


def pyr_floor_world_unified(x: int, y: int) -> Tuple[int, int, int]:
    """
    Unified world-coordinate Pyramid floor (ZERO hard zone seams at doorway columns!):
    - North Sanctum (`y < 112`): `pyr_floor_sanctum`
    - Central Sunken Quicksand Basin around `(224, 208)` (`sand-pit` seamlessly embedded!)
    - Irregular frayed pale-limestone slab walkways curving around the quicksand pit and feathering
      organically through the N/S/E/W portals!
    """
    if y < 112:
        return pyr_floor_sanctum(x, y)

    cx, cy = 224.0, 208.0
    wob = (vnoise(x, y, 6.5, 141) - 0.5) * 4.5
    r_pit = math.hypot((x - cx) / 29.0, (y - cy) / 23.0) + wob * 0.035

    # Sculpted sunken sand-vortex basin seamlessly matching `sand-pit.png` (`x=208..240, y=192..224`)!
    if r_pit < 1.04:
        if r_pit > 0.91:
            # 3px carved sunken sandstone pit rim (shaded north/west inner drop, lit south/east lip)
            return hx3("#261911") if (y < cy + 2 and x < cx + 6) else hx3("#846444")
        ang = math.atan2(y - cy, x - cx)
        swirl = math.sin(r_pit * 15.0 - ang * 2.0)
        if r_pit > 0.72:
            return hx3("#e4d6a8") if swirl > 0.25 else (hx3("#d2ac78") if swirl > -0.25 else hx3("#9c7a5a"))
        return hx3("#d2ac78") if swirl > 0.2 else (hx3("#7e5c44") if swirl > -0.3 else hx3("#604034"))

    # Per-slab frayed limestone walkway strength across Central Hall, Doorways & South Vestibule!
    ring_s = max(0.0, 1.0 - abs(r_pit - 1.45) / 0.48)
    ns_s = max(0.0, 1.08 - abs(x - 224.0) / 23.0)
    ew_s = max(0.0, 1.04 - abs(y - 216.0) / 16.5) if (92 <= x <= 356) else 0.0
    walkway_s = max(ring_s, ns_s, ew_s)

    if walkway_s > 0.35:
        slab_keep = H((x + 11) // 16, (y + 7) // 11, 157)
        if walkway_s > 0.68 or slab_keep < (walkway_s - 0.35) / 0.33:
            return pyr_floor_sandstone(x, y, PYR_WALKWAY_LIMESTONE, seed=43)

    # Rich polished royal ochre in East Treasury (`x >= 336`), sunken ochre in Central Hall (`128 <= x < 320`)
    if x >= 332:
        return pyr_floor_sandstone(x, y, PYR_SANCTUM_FLOOR, seed=71)
    if 128 <= x <= 316 and 128 <= y <= 272:
        return pyr_floor_sandstone(x, y, PYR_SUNKEN_FLOOR, seed=37)
    return pyr_floor_sandstone(x, y, PYR_SAND_FLOOR, seed=23)


def pyr_wall_sandstone(X: int, fy: int) -> Tuple[int, int, int]:
    """
    32px World-Coord Egyptian Dressed Sandstone Wall with Carved Golden & Lapis Hieroglyph Frieze!
    - fy = 0..10: Upper dressed sandstone courses (non-16px block widths)
    - fy = 11..16: Recessed carved Golden & Lapis-Lazuli Hieroglyph Band (non-16px cartouche rhythm!)
    - fy = 17..28: Shaded lower sandstone dado
    - fy = 29..31: Heavy carved tomb plinth base
    """
    if fy >= 29:
        return PYR_WALL[3] if fy == 29 else (PYR_WALL[1] if fy == 30 else PYR_WALL[0])

    # Carved Golden & Lapis Hieroglyph Frieze Band (fy = 11..16)
    if 11 <= fy <= 16:
        if fy == 11:
            return PYR_WALL[0]
        if fy == 16:
            return PYR_WALL[5]
        # Inside frieze (fy = 12..15, height = 4px)
        hy = fy - 12  # 0..3
        # Non-16px cartouche & glyph module (period = 22px!)
        gx = (X + 5) % 22
        glyph_id = int(H((X + 5) // 22, 7, 191) * 4) % 4
        if gx == 0:
            return PYR_WALL[1]  # vertical cartouche divider
        if gx in (1, 21) and hy in (0, 3):
            return HIERO_GOLD_LO
        # Miniature Egyptian glyphs (ankh, eye-of-horus, scarab/sun-disc, reed-water)
        is_gold = False
        is_lapis = False
        is_red = False
        if glyph_id == 0:
            # Ankh + Djed pillar + Sun disc
            if gx in (4, 5) and hy in (0, 1):
                is_gold = True
            elif gx in (3, 4, 5, 6) and hy == 2:
                is_gold = True
            elif gx in (4, 5) and hy == 3:
                is_gold = True
            elif gx in (10, 11) and hy in (0, 1, 2, 3):
                is_lapis = (hy in (1, 2))
                is_gold = not is_lapis
            elif gx in (15, 16, 17) and hy in (1, 2):
                is_red = (gx == 16 and hy == 1)
                is_gold = not is_red
        elif glyph_id == 1:
            # Royal Oval Cartouche + Feather of Ma'at
            if 3 <= gx <= 12:
                if hy in (0, 3) and 4 <= gx <= 11:
                    is_gold = True
                elif gx in (3, 12) and hy in (1, 2):
                    is_gold = True
                elif gx in (6, 9) and hy in (1, 2):
                    is_lapis = True
                elif gx == 7 and hy == 1:
                    is_red = True
            elif gx in (16, 17, 18) and (hy == 3 - (gx - 16) or hy == 2):
                is_gold = True
        elif glyph_id == 2:
            # Winged Scarab / Eye of Horus motif
            if gx in (4, 5, 6, 7, 8) and hy == 0:
                is_lapis = True
            elif gx in (5, 6, 7) and hy in (1, 2):
                is_gold = (gx != 6 or hy != 1)
                is_red = (gx == 6 and hy == 1)
            elif gx in (12, 14, 16, 18) and hy in (1, 3):
                is_gold = True
        else:
            # Nile wave zigzags + Pyramidion + Gold reeds
            if 3 <= gx <= 9 and ((gx + hy) % 2 == 0) and hy in (1, 2):
                is_lapis = True
            elif 12 <= gx <= 16 and abs(gx - 14) <= (hy - 0):
                is_gold = True
            elif gx == 19 and hy in (0, 1, 2, 3):
                is_gold = True

        if is_red:
            return HIERO_CARNELIAN
        if is_lapis:
            return HIERO_LAPIS
        if is_gold:
            return HIERO_GOLD_HI if hy <= 1 else HIERO_GOLD_MID
        return PYR_WALL[2] if hy in (0, 3) else PYR_WALL[3]

    courses = [0, 5, 11, 17, 23, 29]
    r = max(i for i, v in enumerate(courses[:-1]) if v <= fy)
    y0, y1 = courses[r], courses[r + 1]
    ly = fy - y0
    hgt = y1 - y0

    L = [17, 14, 19, 15, 18][r % 5]
    off = (r * 11 + int(H(r, 4, 211) * 13)) % L
    lx = (X + off) % L
    blk = (X + off) // L

    if ly == hgt - 1 or lx == L - 1:
        c = PYR_WALL[1] if lx == L - 1 and ly < hgt - 1 else PYR_WALL[0]
    else:
        tone = 4 if H(blk, r, 223) < 0.58 else 3
        if ly == 0 and lx < L - 2:
            tone = min(5, tone + 1)
        elif lx == 0 and ly > 0:
            tone = min(5, tone + 1)
        if H(X // 2, fy // 2, 229) < 0.08:
            tone = max(2, tone - 1)
        c = PYR_WALL[tone]

    if fy >= 17:
        c = mul(c, 0.84)
    return c


PYR_FLOOR_FNS: Dict[str, Callable[[int, int], Tuple[int, int, int]]] = {
    "sandstone": pyr_floor_world_unified,
    "sanctum_dais": pyr_floor_world_unified,
    "central_quicksand": pyr_floor_world_unified,
    "treasury_stone": pyr_floor_world_unified,
}

PYR_WALL_FNS: Dict[str, Callable[[int, int], Tuple[int, int, int]]] = {
    "egypt_sandstone": pyr_wall_sandstone,
}


# ---------------------------------------------------------------------------
# Exact `room2.py` Derived Ceiling Rim & 32px Wall Engine
# ---------------------------------------------------------------------------
def analyse_plan(plan: Sequence[str]):
    Hh = len(plan)
    W = max(len(r) for r in plan)
    g = [[(plan[y][x] if x < len(plan[y]) else "#") != "#" for x in range(W)] for y in range(Hh)]

    def inn(x: int, y: int) -> bool:
        return 0 <= x < W and 0 <= y < Hh and g[y][x]

    face = [[0] * W for _ in range(Hh)]
    for y in range(Hh):
        for x in range(W):
            if not g[y][x]:
                continue
            if not inn(x, y - 1):
                face[y][x] = 1
            elif face[y - 1][x] == 1:
                face[y][x] = 2

    top = [
        [(not g[y][x]) and any(inn(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)) for x in range(W)]
        for y in range(Hh)
    ]
    return W, Hh, g, face, top, inn


def render_pyramid_structure(
    plan: Sequence[str],
    default_floor: str = "sandstone",
    default_wall: str = "egypt_sandstone",
    zones: Sequence[Tuple[int, int, int, int, Optional[str], Optional[str]]] = (),
) -> Image.Image:
    W, Hh, g, face, top, inn = analyse_plan(plan)

    def mat(cx: int, cy: int) -> Tuple[str, str]:
        f, w = default_floor, default_wall
        for x0, y0, x1, y1, ff, ww in zones:
            if x0 <= cx <= x1 and y0 <= cy <= y1:
                f = ff or f
                w = ww or w
        return f, w

    im = Image.new("RGBA", (W * 16, Hh * 16), PYR_VOID + (255,))
    px = im.load()

    for cy in range(Hh):
        for cx in range(W):
            f_name, w_name = mat(cx, cy)
            for ly in range(16):
                for lx in range(16):
                    X, Y = cx * 16 + lx, cy * 16 + ly
                    if g[cy][cx] and face[cy][cx]:
                        fy = ly + (face[cy][cx] - 1) * 16
                        c = PYR_WALL_FNS[w_name](X, fy)
                        if not inn(cx - 1, cy) and lx == 0:
                            c = mul(c, 0.76)
                        elif not inn(cx + 1, cy) and lx == 15:
                            c = mul(c, 0.76)
                        if fy < 4:
                            c = mul(c, 0.62 + 0.08 * fy)
                        px[X, Y] = c + (255,)
                    elif g[cy][cx]:
                        c = PYR_FLOOR_FNS[f_name](X, Y)
                        # 3px wall-foot contact shadow (`room2.py` rule)
                        if (face[cy - 1][cx] if cy > 0 else 0) and ly < 3:
                            c = mul(c, 0.58 + 0.13 * ly)
                        px[X, Y] = c + (255,)
                    elif top[cy][cx]:
                        c = PYR_CEIL_CHECKER[(X + Y) % 2]
                        s_in = inn(cx, cy + 1)
                        n_in = inn(cx, cy - 1)
                        w_in = inn(cx - 1, cy)
                        e_in = inn(cx + 1, cy)

                        notch_x = (X % 13 == 0)
                        notch_y = (Y % 13 == 0)
                        # Crisp 3px carved-sandstone inner ceiling lips on all 4 directions!
                        if s_in and ly >= 12:
                            if ly == 12:
                                c = PYR_RIM_SAND[4] if notch_x else PYR_RIM_SAND[5]
                            elif ly == 13:
                                c = PYR_RIM_SAND[3] if notch_x else PYR_RIM_SAND[4]
                            elif ly == 14:
                                c = PYR_RIM_SAND[2]
                            else:
                                c = PYR_RIM_SAND[0]
                        if n_in and ly <= 2:
                            if ly == 0:
                                c = PYR_RIM_SAND[0]
                            elif ly == 1:
                                c = PYR_RIM_SAND[3] if notch_x else PYR_RIM_SAND[4]
                            else:
                                c = PYR_RIM_SAND[2]
                        if w_in and lx <= 2:
                            if lx == 0:
                                c = PYR_RIM_SAND[0]
                            elif lx == 1:
                                c = PYR_RIM_SAND[3] if notch_y else PYR_RIM_SAND[4]
                            else:
                                c = PYR_RIM_SAND[2]
                        if e_in and lx >= 13:
                            if lx == 15:
                                c = PYR_RIM_SAND[0]
                            elif lx == 14:
                                c = PYR_RIM_SAND[2] if not notch_y else PYR_RIM_SAND[1]
                            else:
                                c = PYR_RIM_SAND[3]

                        if (not inn(cx, cy - 1) and not top[cy - 1][cx]) if cy > 0 else True:
                            if ly == 0:
                                c = PYR_VOID
                        if (not inn(cx, cy + 1) and not top[cy + 1][cx]) if cy + 1 < Hh else True:
                            if ly == 15 and not s_in:
                                c = PYR_VOID
                        px[X, Y] = c + (255,)
                    else:
                        px[X, Y] = PYR_VOID + (255,)

    # 6px west-wall soft cast shadow on both wall face & floor (`room2.py` rule)
    for cy in range(Hh):
        for cx in range(W):
            if g[cy][cx] and not inn(cx - 1, cy):
                for ly in range(16):
                    for lx in range(6):
                        X, Y = cx * 16 + lx, cy * 16 + ly
                        r, gg, b, a = px[X, Y]
                        px[X, Y] = mul((r, gg, b), 0.62 + 0.06 * lx) + (a,)

    return im


# ---------------------------------------------------------------------------
# Pyramid Custom Architectural Pieces & Tabletop Relics
# ---------------------------------------------------------------------------
@dataclass
class Piece:
    id: str
    im: Image.Image
    fw: int
    fh: int
    up: int = 0
    kind: str = "floor"  # 'floor', 'wall', 'hang', 'flat', 'char', 'hazard'
    surf: Optional[Tuple[int, int, int, int]] = None
    px_offset: Tuple[int, int] = (0, 0)


def build_pyramid_tabletop_relics() -> Dict[str, Image.Image]:
    """Hand-pixelled Egyptian relics composited ON TOP OF carved sandstone offering tables."""
    out: Dict[str, Image.Image] = {}

    # 1. Golden Anubis/Jackal Canopic Jar (7x11)
    p = Pix(7, 11)
    k = {
        "o": hx("#24160e"),
        "g": hx("#ecd060"),
        "G": hx("#d4ac38"),
        "d": hx("#8f6820"),
        "b": hx("#2c4c90"),
        "s": hx("#e4d6a8"),
        "S": hx("#aa9468"),
    }
    p.lit(
        0,
        0,
        [
            " o   o ",
            " ogogo ",
            " oggGo ",
            " obgGo ",
            "  oGo  ",
            " obbbo ",
            "osggGSo",
            "osGbGSo",
            "osSSdSo",
            " odddo ",
            "  ooo  ",
        ],
        k,
    )
    out["canopic_jar_jackal"] = p.im

    # 2. Lapis-Crowned Falcon Canopic Jar (7x10)
    p = Pix(7, 10)
    p.lit(
        0,
        0,
        [
            "  ooo  ",
            " obgbo ",
            " oggGo ",
            "  oGo  ",
            " ogggo ",
            "osbbGSo",
            "osggGSo",
            "osSSdSo",
            " odddo ",
            "  ooo  ",
        ],
        k,
    )
    out["canopic_jar_falcon"] = p.im

    # 3. Jewelled Pharaoh Ruby Chalice (7x9)
    p = Pix(7, 9)
    kr = {
        "o": hx("#24160e"),
        "w": hx("#fff8c8"),
        "g": hx("#ecd060"),
        "G": hx("#c8982c"),
        "r": hx("#e03c3c"),
        "R": hx("#981c24"),
    }
    p.lit(
        0,
        0,
        [
            " ooooo ",
            "owggGGo",
            "ogrrGGo",
            " oGRGo ",
            "  oGo  ",
            "  oGo  ",
            " ogGgo ",
            "owgGGGo",
            " ooooo ",
        ],
        kr,
    )
    out["ruby_chalice"] = p.im

    # 4. Tied Royal Papyrus Scrolls with Scarab Seal (10x6)
    p = Pix(10, 6)
    kp = {
        "o": hx("#2b1c12"),
        "P": hx("#f6ecd0"),
        "p": hx("#decda2"),
        "s": hx("#b39d72"),
        "b": hx("#2c4c90"),
        "g": hx("#ecd060"),
    }
    p.lit(
        0,
        0,
        [
            " oooooooo ",
            "oPPPbgPPPo",
            "opppgbpppo",
            "osssbbssso",
            " oooooooo ",
            "          ",
        ],
        kp,
    )
    out["papyrus_scrolls"] = p.im

    # 5. Smoking Golden Lotus Incense Burner (8x9)
    p = Pix(8, 9)
    kl = {
        "m": hx("#e8e4dc"),
        "s": hx("#b8b2a8"),
        "e": hx("#ff9428"),
        "g": hx("#ecd060"),
        "G": hx("#c8982c"),
        "r": hx("#a85420"),
        "o": hx("#24160e"),
    }
    p.lit(
        0,
        0,
        [
            "   m    ",
            "  s m   ",
            "   s    ",
            " oeeeo  ",
            "ogggggo ",
            "oGrGrGo ",
            " oGGGo  ",
            " ogGgo  ",
            " ooooo  ",
        ],
        kl,
    )
    out["lotus_censer"] = p.im

    # 6. Golden Scarab Ceremonial Casket (9x7)
    p = Pix(9, 7)
    p.lit(
        0,
        0,
        [
            "  ooooo  ",
            " oggbggo ",
            "ogGbbbGgo",
            "ooooooooo",
            "ogGGbGGgo",
            "odddgdddo",
            " ooooooo ",
        ],
        k,
    )
    out["scarab_casket"] = p.im

    return out


def make_sandstone_offering_table(wc: int = 2) -> Piece:
    """Carved Egyptian sandstone & gold-trimmed offering altar table (32x18, fw=2, fh=1)."""
    W = wc * 16
    p = Pix(W, 18)
    for y in range(2, 17):
        for x in range(1, W - 1):
            if y == 2:
                c = hx("#241912")
            elif y == 3:
                c = hx("#241912") if x in (1, W - 2) else hx("#e4c88c")
            elif y in (4, 5, 6, 7):
                if x in (1, W - 2):
                    c = hx("#241912")
                elif x == 2 or y == 4:
                    c = hx("#d2aa74")
                else:
                    c = hx("#ba915d") if (x + y) % 5 else hx("#a67e4d")
            elif y == 8:
                # Gold & lapis cavetto cornice under tabletop!
                if x in (1, W - 2):
                    c = hx("#241912")
                else:
                    c = hx("#ecd060") if (x % 4 < 2) else hx("#2c4c90")
            elif y == 9:
                c = hx("#3c2b1d")
            else:
                # Twin carved sandstone pedestal legs with recessed center arch
                in_leg = (3 <= x <= 9) or (W - 10 <= x <= W - 4)
                if not in_leg:
                    if y <= 11 and 9 < x < W - 10:
                        c = hx("#3c2b1d") if y == 10 else hx("#241912")
                    else:
                        continue
                else:
                    if x in (3, 9, W - 10, W - 4) or y == 16:
                        c = hx("#241912")
                    elif x in (4, W - 9):
                        c = hx("#a47f57")
                    elif y == 13:
                        c = hx("#d4ac38")
                    else:
                        c = hx("#7c5d3f") if y < 14 else hx("#563f2a")
            p.set(x, y, c)
    # Soft contact shadow
    for x in range(2, W - 2):
        if p.get(x, 16)[3] == 0:
            p.set(x, 16, (20, 14, 10, 110))
        p.set(x, 17, (20, 14, 10, 120))
    return Piece(
        f"sandstone_table_{wc}w",
        p.im,
        wc,
        1,
        2,
        "floor",
        surf=(4, 3, W - 4, 8),
    )


def make_hypostyle_lotus_pillar() -> Piece:
    """16x32 carved Egyptian sandstone column with painted gold/lapis lotus capital."""
    p = Pix(16, 32)
    for y in range(1, 31):
        for x in range(2, 14):
            # Lotus capital flare at y=1..7, shaft at y=8..26, stepped base at y=27..30
            if y <= 2:
                hw = 6
            elif y <= 6:
                hw = 5
            elif y <= 26:
                hw = 4
            else:
                hw = 6 if y >= 28 else 5
            dx = x - 7.5
            if abs(dx) > hw:
                continue
            if abs(dx) >= hw - 0.9 or y in (1, 30):
                c = hx("#241912")
            elif y <= 2:
                c = hx("#d2aa74") if dx < 0 else hx("#886746")
            elif 3 <= y <= 6:
                # Painted lotus petals (gold, lapis, carnelian)
                if y == 5 and int(abs(dx)) % 2 == 0:
                    c = hx("#2c4c90")
                elif y == 4 and int(abs(dx)) == 1:
                    c = hx("#a85420")
                else:
                    c = hx("#ecd060") if dx < 0 else hx("#b88c28")
            elif y == 7:
                c = hx("#3c2b1d")
            elif y in (14, 15, 21, 22):
                # Gold & lapis shaft rings
                c = hx("#ecd060") if (dx < 0 and y in (14, 21)) else (hx("#2c4c90") if y in (15, 22) else hx("#b88c28"))
            elif y >= 27:
                c = hx("#c29b6c") if (y == 27 and dx < 1) else (hx("#886746") if dx < 0 else hx("#563f2a"))
            else:
                c = hx("#c29b6c") if dx < -1.6 else (hx("#9e7a53") if dx < 0.6 else (hx("#6f5338") if dx < 2.2 else hx("#4a3523")))
            p.set(x, y, c)
    for x in range(2, 14):
        p.set(x, 31, (20, 14, 10, 130))
    return Piece("lotus_pillar", p.im, 1, 1, 16, "floor")


def make_egypt_wall_torch() -> Piece:
    """16x15 bronze & gold ankh-bracket wall torch with roaring amber flame."""
    p = Pix(16, 15)
    k = {
        "w": hx("#fffce0"),
        "y": hx("#ffe066"),
        "f": hx("#f59018"),
        "r": hx("#c84418"),
        "g": hx("#ecd060"),
        "G": hx("#b88a28"),
        "b": hx("#2c4c90"),
        "o": hx("#22150e"),
    }
    p.lit(
        4,
        0,
        [
            "   w    ",
            "  ywy   ",
            " yfwfy  ",
            "  fyf   ",
            "  rrr   ",
            " ogggo  ",
            " ogbgo  ",
            "  oGo   ",
            " ooGoo  ",
            "  oGo   ",
            "  oGo   ",
            "   o    ",
        ],
        k,
    )
    return Piece("egypt_wall_torch", p.im, 1, 0, 0, "hang")


def make_winged_sun_relief() -> Piece:
    """32x18 Carved Royal Winged Sun-Disc & Cobra Wall Relief for the North Sanctum Apse."""
    p = Pix(32, 18)
    for y in range(1, 16):
        for x in range(1, 31):
            if x in (1, 30) or y in (1, 15):
                p.set(x, y, hx("#241912"))
            elif x in (2, 29) or y in (2, 14):
                p.set(x, y, hx("#c29b6c") if (x == 2 or y == 2) else hx("#563f2a"))
            else:
                p.set(x, y, hx("#3c2b1d") if (x + y) % 3 == 0 else hx("#4a3523"))
    # Outstretched falcon wings of Horus (lapis, turquoise, gold feathers)
    for y in range(5, 12):
        span = 12 - (y - 5) * 1.3
        for side in (-1, 1):
            for d in range(3, int(span) + 1):
                xx = int(15.5 + side * d)
                if y in (5, 6):
                    col = hx("#ecd060")
                elif y in (7, 8):
                    col = hx("#2c4c90") if d % 2 == 0 else hx("#4ca6b8")
                else:
                    col = hx("#d4ac38") if d % 2 == 0 else hx("#a85420")
                p.set(xx, y, col)
    # Central crimson/gold solar disc + twin golden uraeus cobras
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            dist = dx * dx + dy * dy
            if dist <= 6:
                p.set(15 + dx, 8 + dy, hx("#e04828") if dist <= 2 else hx("#ecd060"))
                p.set(16 + dx, 8 + dy, hx("#e04828") if dist <= 2 else hx("#d4ac38"))
    for cx_u in (11, 20):
        p.set(cx_u, 9, hx("#ecd060"))
        p.set(cx_u, 10, hx("#ecd060"))
        p.set(cx_u, 11, hx("#d4ac38"))
    return Piece("winged_sun_relief", p.im, 2, 0, 0, "hang")


def make_ceiling_light_crack() -> Piece:
    """16x11 Egyptian Temple Clerestory Sun-Slit Window recessed under the ceiling cornice!"""
    p = Pix(16, 11)
    k = {
        "o": hx("#241912"),
        "d": hx("#4a3523"),
        "m": hx("#6f5338"),
        "s": hx("#c29b6c"),
        "g": hx("#ecd060"),
        "y": hx("#ffe888"),
        "w": hx("#fffbe4"),
    }
    p.lit(
        2,
        0,
        [
            "oooooooooooo",
            "odwwodwodwdo",
            "odwwodwodwdo",
            "odyyodyodydo",
            "odyyodyodydo",
            "odggodgodgdo",
            "osssssssssso",
            "ommmmmmmmmmo",
            "oooooooooooo",
        ],
        k,
    )
    return Piece("ceiling_light_crack", p.im, 1, 0, 0, "hang", px_offset=(0, -2))


def make_wall_sand_fissure() -> Piece:
    """16x16 jagged dark masonry crack in lower wall dado trickling fine sand onto `sand-drift`."""
    p = Pix(16, 16)
    k = {
        "o": hx("#1c120c"),
        "d": hx("#3c2b1d"),
        "s": hx("#c49e6c"),
        "S": hx("#e4d6a8"),
    }
    p.lit(
        4,
        1,
        [
            "   oo   ",
            "   odo  ",
            "  oodo  ",
            "  ooSo  ",
            "  osSo  ",
            "  oSSoo ",
            "  sSSso ",
            " osSSSso",
        ],
        k,
    )
    return Piece("wall_sand_fissure", p.im, 1, 0, 0, "hang")


def make_pharaoh_chest() -> Piece:
    """16x16 gilded lapis-and-gold royal sarcophagus chest."""
    p = Pix(16, 16)
    k = {
        "o": hx("#22150e"),
        "g": hx("#ecd060"),
        "G": hx("#c8982c"),
        "d": hx("#8a641c"),
        "b": hx("#2c4c90"),
        "B": hx("#1c3264"),
        "r": hx("#d83c34"),
    }
    p.lit(
        1,
        2,
        [
            " oooooooooooo ",
            "oggggggggggggo",
            "ogbbbbggbbbbgo",
            "ogBBBBgrBBBBgo",
            "oooooooooooooo",
            "oGGGGggroGGGGgo"[:14],
            "ogbbbbggbbbbgo",
            "ogBBBBggBBBBgo",
            "oddddddddddddo",
            " oooooooooooo ",
        ],
        k,
    )
    for x in range(2, 14):
        p.set(x, 12, (20, 14, 10, 120))
    return Piece("pharaoh_chest", p.im, 1, 1, 0, "floor")


# ---------------------------------------------------------------------------
# Stepped Cruciform Royal Tomb Plan (`28x22` = `448x352` px)
# ---------------------------------------------------------------------------
PYRAMID_PLAN: List[str] = [
    # 0123456789012345678901234567
    "############################",  # 00: Desert rock void + ceiling cap
    "#########..........#########",  # 01: North Pharaoh Sanctum Apse (x=9..18, face=1)
    "######................######",  # 02: Stepped Ziggurat Setback 1 (x=6..21)
    "####....................####",  # 03: Octagonal Sanctum Setback 2 (x=4..23; x=9..18 floor starts!)
    "####....................####",  # 04: Sanctum (x=6..21 floor; x=4..5,22..23 face=2)
    "####....................####",  # 05: Full Sanctum width walkable floor (x=4..23)
    "######................######",  # 06: Sanctum south taper (x=6..21 floor; 4..5,22..23 '#' inner sandstone rim)
    "############....############",  # 07: Thick '#' sandstone partition + 4-wide Royal Portal (x=12..15)
    "#########..........###....##",  # 08: Central Hall north step (x=9..18) | East Vault north apse (x=22..25, face=1)
    "##....##............#......#",  # 09: West Canopic Alcove apse (x=2..5, face=1) | Central (x=8..19) | East Vault (x=21..26)
    "#......#............#......#",  # 10: West Alcove widens (x=1..6) | Central Hall (x=9..18 floor) | East Vault (x=22..25 floor)
    "#..........................#",  # 11: Doorways open at x=7 & x=20 (face=1 lintel)!
    "#..........................#",  # 12: Doorways x=7 & x=20 (face=2 carved hieroglyph lintel)!
    "#..........................#",  # 13: Walkable East-West tomb axis through BOTH carved doorways (x=1..26)!
    "#..........................#",  # 14: Walkable East-West tomb axis row 2 (generous 2-tile doorway height!)
    "#......#............#......#",  # 15: Partitions close at x=7 & x=20; all 3 chambers continue
    "###...###..........##......#",  # 16: West Alcove south taper (x=3..5) | Central south taper (x=9..18) | East Vault (x=21..26)
    "############....#####.....##",  # 17: South Portal Passage (x=12..15) | Asymmetric East Vault deep hoard nook (x=21..25)!
    "##########........##########",  # 18: Protruding South Tomb Entrance Vestibule opens (x=10..17)
    "##########........##########",  # 19: South Vestibule lower wall face on x=10..11, 16..17
    "##########........##########",  # 20: South Vestibule walkable hall (x=10..17)
    "############....############",  # 21: Protruding South Tomb Entrance Threshold (x=12..15) flanked by '#' pylons!
]


def load_pyramid_catalog() -> Dict[str, Piece]:
    def ld(name: str) -> Image.Image:
        return Image.open(PYRAMID_OBJ_DIR / f"{name}.png").convert("RGBA")

    ch1 = load_beodeul_char_1x()
    ch_desert = make_char_desert_variant(ch1)

    cat: Dict[str, Piece] = {
        # 6 Mandatory Carbon `pyramid` sprites:
        "pharaoh-sarcophagus": Piece("pharaoh-sarcophagus", ld("pharaoh-sarcophagus"), 2, 1, 16, "floor"),
        "jackal-statue": Piece("jackal-statue", ld("jackal-statue"), 1, 1, 16, "floor"),
        "obelisk": Piece("obelisk", ld("obelisk"), 1, 1, 32, "floor"),
        "gold-pile": Piece("gold-pile", ld("gold-pile"), 2, 1, 16, "floor"),
        "sand-pit": Piece("sand-pit", ld("sand-pit"), 2, 2, 0, "hazard"),
        # `sand-drift` (32x16) is soft encroaching wind-blown sand on floor edges (`flat`)
        "sand-drift": Piece("sand-drift", ld("sand-drift"), 2, 1, 0, "flat"),
        # Custom Egyptian architectural pieces & dressed offering tables:
        "sandstone_table_2w": make_sandstone_offering_table(2),
        "lotus_pillar": make_hypostyle_lotus_pillar(),
        "egypt_wall_torch": make_egypt_wall_torch(),
        "winged_sun_relief": make_winged_sun_relief(),
        "ceiling_light_crack": make_ceiling_light_crack(),
        "wall_sand_fissure": make_wall_sand_fissure(),
        "pharaoh_chest": make_pharaoh_chest(),
        # Scale characters:
        "char_knight": Piece("char_knight", ch1, 1, 1, 9, "char", px_offset=(-3, 0)),
        "char_scholar": Piece("char_scholar", ch_desert, 1, 1, 9, "char", px_offset=(-3, 0)),
    }
    return cat


def build_pyramid_spec(cat: Dict[str, Piece]) -> dict:
    assert len(PYRAMID_PLAN) == MAP_TH and all(len(r) == MAP_TW for r in PYRAMID_PLAN)

    zones = [
        # North Stepped Pharaoh Burial Sanctum (golden-inlaid dais + polished ochre slabs)
        (4, 1, 23, 6, "sanctum_dais", "egypt_sandstone"),
        # Central Sunken Quicksand & Pillar Hall (sunken sand vortex + curved pale-limestone walkways)
        (8, 8, 19, 16, "central_quicksand", "egypt_sandstone"),
        # East Royal Treasury Vault (polished royal sandstone)
        (21, 8, 26, 17, "treasury_stone", "egypt_sandstone"),
    ]

    # Slanted golden desert sunbeams streaming from ceiling shaft cracks:
    # (origin_px_x, origin_px_y, width_px, length_px, slope_dx_per_dy, strength)
    sunbeams = [
        (10 * 16 + 8, 3 * 16 - 2, 16, 62, 0.36, 0.30),   # West Sanctum sun-shaft onto dais & sarcophagus!
        (17 * 16 + 6, 3 * 16 - 2, 16, 60, 0.34, 0.28),   # East Sanctum sun-shaft onto dais!
        (9 * 16 + 8, 10 * 16 - 2, 14, 54, 0.35, 0.24),   # Central Pillar Hall NW sun-shaft
        (23 * 16 + 8, 10 * 16 - 2, 15, 58, 0.32, 0.28),  # East Treasury Vault sun-shaft gleaming on gold hoards!
    ]

    # Warm amber wall-torch / brazier floor glows: (cx_px, cy_px, radius_px, strength)
    glows = [
        (11 * 16 + 8, 3 * 16 + 8, 30, 0.20),
        (16 * 16 + 8, 3 * 16 + 8, 30, 0.20),
        (3 * 16 + 8, 11 * 16 + 8, 32, 0.24),
        (22 * 16 + 8, 10 * 16 + 8, 32, 0.22),
        (25 * 16 + 8, 10 * 16 + 8, 32, 0.22),
        (11 * 16 + 8, 20 * 16 + 6, 28, 0.20),
        (16 * 16 + 8, 20 * 16 + 6, 28, 0.20),
    ]

    items = [
        # ===================================================================
        # 0. WIND-BLOWN SAND DRIFTS (`sand-drift.png`, walkable soft sand edges)
        # ===================================================================
        (cat["sand-drift"], 8, 11, ()),    # Central Hall NW stepped-wall crack drift (clear of lotus_pillar at 10,11!)
        (cat["sand-drift"], 16, 16, ()),   # Central Hall SE corner drift
        (cat["sand-drift"], 3, 16, ()),    # West Canopic Alcove tapered south drift
        (cat["sand-drift"], 15, 20, ()),   # South Tomb Entrance wind-blown desert sand

        # ===================================================================
        # 1. NORTH STEPPED PHARAOH BURIAL SANCTUM (y=1..6, x=4..23)
        # ===================================================================
        # North Apse Wall Hangings (`face == 1` at y=1, x=9..18)
        (cat["ceiling_light_crack"], 10, 1, ()),
        (cat["egypt_wall_torch"], 11, 1, ()),
        (cat["winged_sun_relief"], 13, 1, ()),
        (cat["egypt_wall_torch"], 16, 1, ()),
        (cat["ceiling_light_crack"], 17, 1, ()),
        # Outer Octagonal Step Wall Torches (`face == 1` at y=3, x=4..5 & x=22..23)
        (cat["egypt_wall_torch"], 4, 3, ()),
        (cat["egypt_wall_torch"], 23, 3, ()),

        # Raised Golden Dais Centerpiece: `pharaoh-sarcophagus` flanked by twin `jackal-statue`s & `obelisk`s!
        (cat["pharaoh-sarcophagus"], 13, 4, ()),
        (cat["jackal-statue"], 11, 4, ()),
        (cat["jackal-statue"], 16, 4, ()),
        (cat["obelisk"], 7, 4, ()),
        (cat["obelisk"], 20, 4, ()),

        # Outer Sanctum Ziggurat Wing Offerings
        (cat["gold-pile"], 4, 5, ()),
        (
            cat["sandstone_table_2w"],
            22,
            5,
            [
                ("canopic_jar_falcon", 0.22, 0.78),
                ("lotus_censer", 0.56, 0.72),
                ("ruby_chalice", 0.84, 0.80),
            ],
        ),

        # Portal Jamb Lotus Pillars at y=7 (`x=12` and `x=15`, leaving `x=13..14` wide open!)
        (cat["lotus_pillar"], 12, 7, ()),
        (cat["lotus_pillar"], 15, 7, ()),

        # ===================================================================
        # 2. CENTRAL SUNKEN QUICKSAND & PILLAR HALL (x=8..19, y=8..16)
        # ===================================================================
        # North partition wall hangings (`face == 1` at y=8 on x=9..11 & x=16..18)
        (cat["ceiling_light_crack"], 9, 8, ()),
        (cat["egypt_wall_torch"], 11, 8, ()),
        (cat["egypt_wall_torch"], 16, 8, ()),
        # Wall sand fissure feeding the NW `sand-drift` at (8, 11) (`face == 1` at x=8, y=9 -> lower wall at y=10)
        (cat["wall_sand_fissure"], 8, 9, (), (2, 20)),

        # Swirling `sand-pit` hazard in the center of the sunken basin (`x=13..14, y=12..13`)
        # Safe curved limestone walkways run around x=9..12 and x=15..18!
        (cat["sand-pit"], 13, 12, ()),

        # 4 Hypostyle Carved Sandstone Lotus Columns framing the curved walkways
        (cat["lotus_pillar"], 10, 11, ()),
        (cat["lotus_pillar"], 17, 11, ()),
        (cat["lotus_pillar"], 10, 15, ()),
        (cat["lotus_pillar"], 17, 15, ()),

        # ===================================================================
        # 3. WEST CANOPIC RELIC ALCOVE (x=1..6, y=9..16)
        # ===================================================================
        # North apse wall torches (`face == 1` at y=9 on x=2..5)
        (cat["egypt_wall_torch"], 3, 9, ()),
        (cat["egypt_wall_torch"], 5, 9, ()),

        # Sacred Canopic Offering Tables WITH Golden Canopic Jars, Scrolls, Ruby Chalice & Censer ON TOP!
        (
            cat["sandstone_table_2w"],
            2,
            11,
            [
                ("canopic_jar_jackal", 0.20, 0.80),
                ("canopic_jar_falcon", 0.50, 0.82),
                ("papyrus_scrolls", 0.82, 0.78),
            ],
        ),
        (cat["jackal-statue"], 5, 11, ()),
        (cat["obelisk"], 1, 12, ()),
        (
            cat["sandstone_table_2w"],
            1,
            14,
            [
                ("lotus_censer", 0.28, 0.78),
                ("ruby_chalice", 0.72, 0.82),
            ],
        ),
        (cat["pharaoh_chest"], 1, 15, ()),
        (cat["gold-pile"], 4, 15, ()),

        # ===================================================================
        # 4. EAST ROYAL TREASURY VAULT (x=21..26, y=8..17)
        # ===================================================================
        # North vault apse wall (`face == 1` at y=8 on x=22..25)
        (cat["egypt_wall_torch"], 22, 8, ()),
        (cat["ceiling_light_crack"], 23, 8, ()),
        (cat["egypt_wall_torch"], 25, 8, ()),

        # Overflowing Pharaoh Hoards (`gold-pile` x3 + Treasury Relic Table + Royal Chests + Guardian!)
        (cat["gold-pile"], 22, 10, ()),
        (cat["pharaoh_chest"], 25, 10, ()),
        (cat["jackal-statue"], 21, 11, ()),
        (
            cat["sandstone_table_2w"],
            24,
            12,
            [
                ("scarab_casket", 0.28, 0.80),
                ("ruby_chalice", 0.62, 0.76),
                ("canopic_jar_jackal", 0.86, 0.82),
            ],
        ),
        (cat["gold-pile"], 24, 15, ()),
        (cat["pharaoh_chest"], 26, 16, ()),
        # Deep southern secret hoard nook (`y=17, x=21..25`)
        (cat["gold-pile"], 22, 17, ()),

        # ===================================================================
        # 5. PROTRUDING SOUTH TOMB ENTRANCE PASSAGE (x=10..17, y=17..21)
        # ===================================================================
        (cat["lotus_pillar"], 12, 17, ()),
        (cat["lotus_pillar"], 15, 17, ()),
        (cat["egypt_wall_torch"], 10, 18, ()),
        (cat["egypt_wall_torch"], 17, 18, ()),
        (cat["jackal-statue"], 10, 20, ()),
        (cat["jackal-statue"], 17, 20, ()),

        # ===================================================================
        # 6. BEODEUL 1X SCALE CHARACTERS (22x25)
        # ===================================================================
        (cat["char_knight"], 12, 5, ()),    # Approaching Pharaoh's Sarcophagus in North Sanctum
        (cat["char_scholar"], 16, 13, ()),  # Navigating the curved walkway past the Swirling Sand-Pit
    ]

    rooms = [
        ("North Stepped Pharaoh Burial Sanctum", 13, 5),
        ("Central Sunken Quicksand & Pillar Hall (West Walkway)", 11, 13),
        ("Central Sunken Quicksand & Pillar Hall (East Walkway)", 16, 13),
        ("West Canopic Relic Alcove", 4, 13),
        ("East Royal Treasury Vault", 23, 14),
        ("East Treasury Southern Hoard Nook", 24, 17),
        ("South Tomb Entrance Passage", 13, 20),
    ]

    return {
        "plan": PYRAMID_PLAN,
        "floor": "sandstone",
        "wall": "egypt_sandstone",
        "zones": zones,
        "sunbeams": sunbeams,
        "glows": glows,
        "items": items,
        "rooms": rooms,
        "start": [(13, 21), (14, 21)],
    }


def item_draw_rect(f: Piece, x: int, y: int, px_shift: Tuple[int, int] = (0, 0)) -> Tuple[int, int, int, int]:
    dx, dy = f.px_offset[0] + px_shift[0], f.px_offset[1] + px_shift[1]
    if f.kind == "hang":
        X0, Y0 = x * 16 + dx, y * 16 + 2 + dy
    elif f.kind in ("flat", "hazard"):
        X0, Y0 = x * 16 + dx, y * 16 + dy
    else:
        X0, Y0 = x * 16 + dx, y * 16 - f.up + dy
    return (X0, Y0, X0 + f.im.width, Y0 + f.im.height)


def compose_pyramid_scene(spec: dict, relics_lib: Dict[str, Image.Image]) -> Image.Image:
    base = render_pyramid_structure(spec["plan"], spec["floor"], spec["wall"], spec["zones"])
    W_p, H_p = base.size
    W_c, H_c, g, face, top, inn = analyse_plan(spec["plan"])

    draw_flat = []
    draw_main = []
    HEADROOM = 12

    for it in spec["items"]:
        f, x, y = it[0], it[1], it[2]
        on = it[3] if len(it) > 3 else ()
        px_shift = it[4] if len(it) > 4 else (0, 0)
        X0, Y0, _, _ = item_draw_rect(f, x, y, px_shift)

        if f.kind in ("flat", "hazard"):
            draw_flat.append((0 if f.kind == "hazard" else 1, f.im, X0, Y0))
            continue

        if on and f.surf is not None:
            layer = Image.new("RGBA", (f.im.width, f.im.height + HEADROOM), (0, 0, 0, 0))
            layer.alpha_composite(f.im, (0, HEADROOM))
            sx0, sy0, sx1, sy1 = f.surf
            for g_name, fx, fy in sorted(on, key=lambda item: item[2]):
                gi = relics_lib[g_name]
                gx = int(round(sx0 + fx * (sx1 - sx0) - gi.width / 2.0))
                gy = int(round(HEADROOM + sy0 + fy * (sy1 - sy0) - gi.height + 1))
                gx = max(0, min(layer.width - gi.width, gx))
                gy = max(0, min(layer.height - gi.height, gy))
                layer.alpha_composite(gi, (gx, gy))
            im_to_draw = layer
            Y_draw = Y0 - HEADROOM
        else:
            im_to_draw = f.im
            Y_draw = Y0

        if f.kind == "hang":
            z_key = y * 16
        elif f.kind == "char":
            z_key = (y + f.fh) * 16 + 2
        else:
            z_key = (y + f.fh) * 16
        draw_main.append((z_key, im_to_draw, X0, Y_draw))

    for _, im_f, X, Y in sorted(draw_flat, key=lambda d: d[0]):
        base.alpha_composite(im_f, (X, Y))

    # Warm torchlight pools on sandstone floor
    px = base.load()
    for gx, gy, rad, strength in spec.get("glows", ()):
        for Y in range(max(0, gy - rad), min(H_p, gy + rad)):
            for X in range(max(0, gx - rad), min(W_p, gx + rad)):
                cx, cy = X // 16, Y // 16
                if g[cy][cx] and not face[cy][cx]:
                    dist = math.hypot(X - gx, (Y - gy) * 1.2)
                    if dist < rad:
                        k = ((1.0 - dist / rad) ** 1.7) * strength
                        r, gg, b, a = px[X, Y]
                        px[X, Y] = (
                            min(255, int(r + 82 * k)),
                            min(255, int(gg + 50 * k)),
                            min(255, int(b + 12 * k)),
                            a,
                        )

    # Composite 3D furniture, statues, obelisks, sarcophagus, gold hoards & characters
    for _, im_m, X, Y in sorted(draw_main, key=lambda d: d[0]):
        base.alpha_composite(im_m, (X, Y))

    # Slanted Golden Desert Sunbeams + Floating Golden Dust Motes (drawn softly over floor & tomb relics!)
    px = base.load()
    for ox, oy, bw, blen, slope, strength in spec.get("sunbeams", ()):
        for dy in range(-10, blen):
            Y = oy + dy
            if not (0 <= Y < H_p):
                continue
            fade_y = 1.0 - max(0.0, dy) / float(blen)
            if dy < 0:
                fade_y = 1.0 - abs(dy) / 12.0
            cx_beam = ox + dy * slope
            hw = bw * (0.42 + 0.25 * max(0.0, dy / float(blen)))
            for X in range(max(0, int(cx_beam - hw - 2)), min(W_p, int(cx_beam + hw + 3))):
                cx_cell, cy_cell = X // 16, Y // 16
                if not g[cy_cell][cx_cell]:
                    continue
                dx_b = abs(X - cx_beam)
                if dx_b <= hw:
                    edge_f = 1.0 - (dx_b / max(1.0, hw)) ** 2
                    k = fade_y * edge_f * strength
                    r, gg, b, a = px[X, Y]
                    nr = min(255, int(r * (1.0 + 0.22 * k) + 64 * k))
                    ng = min(255, int(gg * (1.0 + 0.18 * k) + 48 * k))
                    nb = min(255, int(b * (1.0 + 0.06 * k) + 14 * k))
                    # Sparse floating golden dust motes sparkling inside the sunbeam!
                    if dy > 4 and dx_b < hw * 0.72 and H(X, Y, 991) < 0.012:
                        nr, ng, nb = 255, 240, 172
                    px[X, Y] = (nr, ng, nb, a)

    return base


def verify_pyramid_architecture(spec: dict) -> dict:
    plan = spec["plan"]
    W, Hh, g, face, top, inn = analyse_plan(plan)
    floor = [[g[y][x] and not face[y][x] for x in range(W)] for y in range(Hh)]

    def fl(x: int, y: int) -> bool:
        return 0 <= x < W and 0 <= y < Hh and floor[y][x]

    occ: Dict[Tuple[int, int], str] = {}
    issues: List[str] = []

    for it in spec["items"]:
        f, x, y = it[0], it[1], it[2]
        if f.kind in ("floor", "wall", "hazard"):
            for yy in range(y, y + f.fh):
                for xx in range(x, x + f.fw):
                    if not fl(xx, yy):
                        issues.append(f"{f.id} @({x},{y}) cell ({xx},{yy}) is not walkable floor")
                    if (xx, yy) in occ:
                        issues.append(f"{f.id} @({x},{y}) overlaps {occ[(xx, yy)]} at ({xx},{yy})")
                    occ[(xx, yy)] = f.id
        elif f.kind == "flat":
            for yy in range(y, y + f.fh):
                for xx in range(x, x + f.fw):
                    if not fl(xx, yy):
                        issues.append(f"Flat {f.id} @({x},{y}) cell ({xx},{yy}) is not floor")

    walk = [[fl(x, y) and (x, y) not in occ for x in range(W)] for y in range(Hh)]
    starts = [tuple(s) for s in spec.get("start", ()) if walk[s[1]][s[0]]]
    if not starts:
        issues.append("No walkable start cells!")
    seen = set(starts)
    q = deque(starts)
    while q:
        cx, cy = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < W and 0 <= ny < Hh and walk[ny][nx] and (nx, ny) not in seen:
                seen.add((nx, ny))
                q.append((nx, ny))

    trapped = [(x, y) for y in range(Hh) for x in range(W) if walk[y][x] and (x, y) not in seen]
    if trapped:
        issues.append(f"Trapped unreachable floor cells ({len(trapped)}): {trapped[:10]}")

    # Check characters on reachable walkable cells
    for it in spec["items"]:
        f, x, y = it[0], it[1], it[2]
        if f.kind == "char" and (x, y) not in seen:
            issues.append(f"Character {f.id} @({x},{y}) not reachable")

    # Named room reachability
    room_reports = []
    for r_name, rx, ry in spec.get("rooms", ()):
        reached = (rx, ry) in seen
        room_reports.append({"room": r_name, "anchor": [rx, ry], "reached": reached})
        if not reached:
            issues.append(f"Room '{r_name}' anchor ({rx},{ry}) not reached by BFS")

    # Every solid/hazard piece has at least one reachable adjacent floor cell
    uses_ok = 0
    uses_total = 0
    for it in spec["items"]:
        f, x, y = it[0], it[1], it[2]
        if f.kind in ("hang", "flat", "char"):
            continue
        uses_total += 1
        fp = [(xx, yy) for yy in range(y, y + f.fh) for xx in range(x, x + f.fw)]
        around = [
            (ax + dx, ay + dy)
            for ax, ay in fp
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
            if (ax + dx, ay + dy) not in fp
        ]
        if any(c in seen for c in around):
            uses_ok += 1
        else:
            issues.append(f"{f.id} @({x},{y}) has no reachable adjacent cell")

    # Verify all 6 Carbon pyramid sprites are used
    carbon_6 = {p.stem for p in PYRAMID_OBJ_DIR.glob("*.png")}
    used_ids = {it[0].id for it in spec["items"]}
    missing = sorted(carbon_6 - used_ids)
    if missing:
        issues.append(f"Missing Carbon pyramid sprites: {missing}")

    total_floor = sum(sum(1 for c in row if c) for row in floor)
    return {
        "ok": len(issues) == 0,
        "issues": issues,
        "grid_size": [W, Hh],
        "pixel_size_1x": [W * 16, Hh * 16],
        "pixel_size_2x": [W * 32, Hh * 32],
        "floor_cells_total": total_floor,
        "occupied_cells": len(occ),
        "reachable_walk_cells": len(seen),
        "uses_reachable": f"{uses_ok}/{uses_total}",
        "carbon_sprites_used": f"{len(carbon_6 - set(missing))}/{len(carbon_6)}",
        "tabletop_relics_placed": sum(len(it[3]) for it in spec["items"] if len(it) > 3),
        "rooms": room_reports,
    }


# ===========================================================================
# PART 2 — MAP 2: `map_otherworld_v2.png` (28x22 = 448x352)
# ===========================================================================
OW_VOID_TOP = hx3("#0a0815")
OW_VOID_MID = hx3("#120d26")
OW_VOID_BOT = hx3("#1a1034")
OW_NEBULA_A = hx3("#33185c")
OW_NEBULA_B = hx3("#541d6e")

# Basalt & Obsidian world-coordinate floor ramps (dark slate-indigo so pale bone & bright crystals POP!)
OW_BASALT_MORTAR = hx3("#141521")
OW_BASALT_SLABS = [
    hx3("#1f2130"),
    hx3("#26283a"),
    hx3("#2d3044"),
    hx3("#35384e"),
    hx3("#40445c"),
]

OW_CITADEL_SLABS = [
    hx3("#222334"),
    hx3("#2a2c3f"),
    hx3("#32354a"),
    hx3("#3b3e56"),
    hx3("#474b65"),
]

# Obsidian wall & 3D jagged under-cliff ramps + glowing magenta/violet magma veins
OW_STONE_OUT = hx3("#0f101a")
OW_STONE_D2 = hx3("#1d1f2d")
OW_STONE_D1 = hx3("#2e3040")
OW_STONE_MID = hx3("#46485c")
OW_STONE_L1 = hx3("#62657a")
OW_STONE_RIM = hx3("#85889e")
OW_STONE_GLINT = hx3("#a8abbf")

OW_MAGMA_DEEP = hx3("#43165c")
OW_MAGMA_MID = hx3("#8824ad")
OW_MAGMA_LIT = hx3("#cb5ef0")
OW_MAGMA_CORE = hx3("#f8b8ff")

OW_CRIMSON_DARK = hx3("#38111c")
OW_CRIMSON_MID = hx3("#721c28")
OW_CRIMSON_LIT = hx3("#b62b29")
OW_CRIMSON_GLOW = hx3("#f04e4c")

OW_BONE_RAMP = [
    hx3("#141622"),
    hx3("#4e5062"),
    hx3("#888a9a"),
    hx3("#bec0c8"),
    hx3("#e2e4e8"),
    hx3("#fad6b4"),
]

CITADEL_AXIS_X = 256  # gx = 15..16 (x = 240..272)


# ---------------------------------------------------------------------------
# 4 Asymmetric Jagged Basalt Islands + 3 Arched Dark-Stone & Bone Bridges
# ---------------------------------------------------------------------------
def citadel_crown_step_top(x: int) -> Optional[int]:
    """Stepped jagged northern bastion of Island 1 (North Demon-Lord Citadel)."""
    dx = x - CITADEL_AXIS_X
    adx = abs(dx)
    if dx < -132 or dx > 168:
        return None
    if adx <= 28:
        return 6   # Apex Portal Gate Bastion
    elif adx <= 56:
        return 14  # Setback 1 (Bone-Pillar & Brazier guard bays)
    elif adx <= 86:
        return 22  # Setback 2 (Inner Citadel wings)
    elif adx <= 128:
        return 30  # Setback 3 (West & East jagged obsidian wings)
    else:
        return 38  # Setback 4 (Asymmetric East Ritual Altar Terrace!)


def in_island_1_citadel(x: int, y: int) -> bool:
    """Island 1: North Demon-Lord Citadel Island (x ~ 122..426, y ~ 6..124)."""
    if x < 118 or x > 430 or y < 4 or y > 130:
        return False
    rc = citadel_crown_step_top(x)
    if rc is None:
        return False
    yn = float(rc)
    dx = x - CITADEL_AXIS_X
    # Asymmetric craggy southern cliff lip: juts south to y=124 at bridgehead, steps & jags on wings
    ys = (
        118.0
        + 5.5 * math.exp(-((dx / 34.0) ** 2))
        + 4.5 * math.sin(x * 0.055 + 0.6)
        + 3.2 * math.cos(x * 0.13)
        + (vnoise(x, 115, 5.5, 401) - 0.5) * 6.5
    )
    if dx < -82:
        ys -= ((-dx - 82) ** 1.25) * 0.36
    elif dx > 122:
        ys -= ((dx - 122) ** 1.25) * 0.34

    xw = 124.0 + 4.5 * math.sin(y * 0.09) + (vnoise(124, y, 5.0, 407) - 0.5) * 5.0
    xe = 424.0 - 4.5 * math.cos(y * 0.085) + (vnoise(424, y, 5.0, 413) - 0.5) * 5.0
    if y > 92:
        xw += (y - 92) * 0.42
        xe -= (y - 92) * 0.38
    return (y >= yn) and (y <= ys) and (x >= xw) and (x <= xe)


def in_island_2_nexus(x: int, y: int) -> bool:
    """Island 2: Central Rifted Nexus Island (x ~ 182..374, y ~ 158..238)."""
    cx, cy = 266.0, 199.0
    dx = x - cx
    dy = y - cy
    if abs(dx) > 120 or abs(dy) > 52:
        return False
    rx = 104.0 if dx > 0 else 82.0  # Asymmetric eastern basalt spur!
    ry = 39.5
    ang = math.atan2(dy, dx)
    jag = (
        1.0
        + 0.08 * math.cos(5.0 * ang + 0.4)
        + 0.06 * math.sin(9.0 * ang - 0.7)
        + (vnoise(x, y, 7.5, 421) - 0.5) * 0.14
    )
    # Bridgehead landings at North (x=256, y=158), South (x=256, y=238), and West (x=184, y=206)
    r = math.hypot(dx / rx, dy / ry)
    if abs(x - CITADEL_AXIS_X) <= 20 and 156 <= y <= 240:
        return True
    if 182 <= x <= 210 and abs(y - 206) <= 18:
        return True
    return r <= jag


def in_island_3_crystal(x: int, y: int) -> bool:
    """Island 3: West Corrupt Crystal Outcrop Island (x ~ 14..148, y ~ 138..260)."""
    cx, cy = 80.0, 199.0
    dx = x - cx
    dy = y - cy
    if abs(dx) > 76 or abs(dy) > 68:
        return False
    rx = 66.0 if dx < 0 else 64.0
    ry = 59.0 if dy < 0 else 59.5
    ang = math.atan2(dy, dx)
    jag = (
        1.0
        + 0.08 * math.cos(6.0 * ang + 1.1)
        + 0.05 * math.sin(10.0 * ang + 0.3)
        + (vnoise(x, y, 7.0, 431) - 0.5) * 0.12
    )
    if 126 <= x <= 146 and abs(y - 206) <= 18:
        return True
    return math.hypot(dx / rx, dy / ry) <= jag


def in_island_4_arrival(x: int, y: int) -> bool:
    """Island 4: South Arrival Causeway Island (x ~ 170..350, y ~ 276..334 + arrival causeway to y=351)."""
    # Southern Arrival Causeway extending cleanly to y=351
    if y >= 324 and abs(x - CITADEL_AXIS_X) <= 24.5 - 1.0 * math.sin((y - 324) * 0.09):
        return True
    cx, cy = 260.0, 305.0
    dx = x - cx
    dy = y - cy
    if abs(dx) > 98 or abs(dy) > 38:
        return False
    rx = 88.0 if dx > 0 else 84.0
    ry = 29.5
    ang = math.atan2(dy, dx)
    jag = (
        1.0
        + 0.08 * math.cos(5.0 * ang - 0.5)
        + 0.05 * math.sin(8.0 * ang + 0.9)
        + (vnoise(x, y, 6.5, 443) - 0.5) * 0.14
    )
    if abs(x - CITADEL_AXIS_X) <= 20 and 275 <= y <= 310:
        return True
    return math.hypot(dx / rx, dy / ry) <= jag


def island_id_at(x: int, y: int) -> int:
    if in_island_1_citadel(x, y):
        return 1
    if in_island_2_nexus(x, y):
        return 2
    if in_island_3_crystal(x, y):
        return 3
    if in_island_4_arrival(x, y):
        return 4
    return 0


def in_bridge_north(x: int, y: int) -> bool:
    """Bridge A: Arched Obsidian & Bone-Rib Bridge linking Nexus (Island 2) -> Citadel (Island 1)."""
    return (238 <= x <= 274) and (118 <= y <= 162)


def in_bridge_south(x: int, y: int) -> bool:
    """Bridge C: Arched Obsidian & Bone-Rib Bridge linking Arrival (Island 4) -> Nexus (Island 2)."""
    return (238 <= x <= 274) and (234 <= y <= 280)


def in_bridge_west(x: int, y: int) -> bool:
    """Bridge B: Arched Obsidian & Bone-Rib Bridge linking West Crystal Island (3) <-> Central Nexus (2)."""
    return (138 <= x <= 190) and (190 <= y <= 224)


def in_any_bridge_walkable(x: int, y: int) -> bool:
    if (242 <= x <= 270) and ((118 <= y <= 162) or (234 <= y <= 280)):
        return True
    if (138 <= x <= 190) and (194 <= y <= 220):
        return True
    return False


# ---------------------------------------------------------------------------
# World-Coordinate Basalt Floor, Crimson Dais, Violet Rune Circle & Abyssal Void
# ---------------------------------------------------------------------------
OW_COURSE_HS = [10, 12, 9, 11, 13, 9, 11, 10]
OW_SLAB_WS = [15, 20, 14, 19, 17, 13, 21, 16]  # sum = 135px (coprime-like to 16)

OW_Y_COURSE: List[Tuple[int, int, int]] = []
_oy = 0
_oi = 0
while len(OW_Y_COURSE) < H_PX + 16:
    ch = OW_COURSE_HS[_oi % len(OW_COURSE_HS)]
    for _ly in range(ch):
        OW_Y_COURSE.append((_oi, _ly, ch))
    _oy += ch
    _oi += 1


def basalt_slab_color(x: int, y: int, isl: int) -> Tuple[int, int, int]:
    ci, ly, sh = OW_Y_COURSE[y]
    shift = int(H(ci, 5, 503) * 53)
    xx = x + shift
    cyc_w = 135
    cyc = xx // cyc_w
    rem = xx % cyc_w
    acc = 0
    si_l = 0
    sw = OW_SLAB_WS[0]
    for k, w in enumerate(OW_SLAB_WS):
        if rem < acc + w:
            si_l = k
            sw = w
            break
        acc += w
    lx = rem - acc
    sid = cyc * 12 + si_l

    ramp = OW_CITADEL_SLABS if isl == 1 else OW_BASALT_SLABS

    # Island 1: Stepped Crimson-Rune Obsidian Dais in front of Portal Gate & Demon Throne!
    if isl == 1:
        dx = abs(x - CITADEL_AXIS_X)
        in_dais_outer = (dx <= 52 and 42 <= y <= 116 and (dx + max(0, y - 96) * 1.25) <= 66)
        in_dais_inner = (dx <= 48 and 45 <= y <= 112 and (dx + max(0, y - 94) * 1.25) <= 61)
        if in_dais_outer and not in_dais_inner:
            if y >= 111 or x > CITADEL_AXIS_X + 46:
                return OW_STONE_OUT
            return OW_STONE_RIM if (y <= 46 or x < CITADEL_AXIS_X - 46) else OW_STONE_MID
        if in_dais_inner:
            # Crimson royal runner + glowing blood-rune ring nested cleanly inside dais!
            d_throne = math.hypot(x - CITADEL_AXIS_X, (y - 88.0) * 1.18)
            if 18.5 <= d_throne <= 21.0:
                pulse = 0.5 + 0.5 * math.sin(math.atan2(y - 88.0, x - CITADEL_AXIS_X) * 8.0)
                return lerp_rgb(OW_CRIMSON_MID, OW_CRIMSON_GLOW, 0.35 + 0.55 * pulse)
            if dx <= 11 and 46 <= y <= 111:
                if dx == 11:
                    return hx3("#c99848") if (x + y) % 2 == 0 else OW_CRIMSON_DARK
                if dx == 10:
                    return OW_CRIMSON_DARK
                return OW_CRIMSON_LIT if (dx <= 6 and (x + y) % 7 != 0) else OW_CRIMSON_MID

    # Island 3 (West Corrupt Crystal Outcrop): organic fractured obsidian crag rock on outer outcrop,
    # transitioning per-slab into frayed basalt paving around the central chest & bridgehead!
    if isl == 3:
        d_pave = math.hypot((x - 96.0) / 48.0, (y - 198.0) / 28.0)
        slab_keep = H(ci, sid, 511)
        if d_pave > 1.15 or (d_pave > 0.72 and slab_keep > (1.15 - d_pave) / 0.43):
            fn = fbm(x, y, 517)
            vein = abs(math.sin(x * 0.16 + y * 0.11 + fn * 3.8))
            if vein < 0.075 and fn > 0.46:
                return OW_MAGMA_LIT if fn > 0.62 else OW_MAGMA_MID
            if fn < 0.34:
                return hx3("#1a1828")
            elif fn < 0.58:
                return hx3("#232036")
            elif fn < 0.78:
                return hx3("#2d2944")
            return hx3("#383254")

    # Island 2: Glowing Violet Arcane Rune Circle on Central Rifted Nexus (center 264, 198)!
    if isl == 2:
        rx_c, ry_c = 264.0, 198.0
        d_rune = math.hypot(x - rx_c, (y - ry_c) * 1.15)
        ang = math.atan2((y - ry_c) * 1.15, x - rx_c)
        if 24.5 <= d_rune <= 27.2 or 14.0 <= d_rune <= 16.2:
            sigil = 0.5 + 0.5 * math.cos(ang * 8.0)
            return lerp_rgb(OW_MAGMA_MID, OW_MAGMA_CORE, 0.35 + 0.55 * sigil)
        # 8-pointed arcane star spokes inside circle
        if 6.0 <= d_rune < 24.5 and abs(math.sin(ang * 4.0)) < 0.085:
            return OW_MAGMA_LIT if d_rune < 15.0 else OW_MAGMA_MID
        if d_rune < 4.2:
            return OW_MAGMA_CORE if d_rune < 2.0 else OW_MAGMA_LIT

    # Island 4: Small violet arrival sigil ring at (256, 304)
    if isl == 4:
        d_arr = math.hypot(x - CITADEL_AXIS_X, (y - 304.0) * 1.18)
        if 15.0 <= d_arr <= 17.0:
            return OW_MAGMA_LIT if (x + y) % 3 != 0 else OW_MAGMA_MID

    is_joint = (lx == sw - 1) or (ly == sh - 1)
    if is_joint:
        # Glowing violet/magenta rift fissures in cracked basalt mortar near Nexus & Crystal Island!
        rift_v = vnoise(x, y, 10.0, 521)
        if (isl == 3 and rift_v > 0.64) or (isl == 2 and rift_v > 0.69):
            return OW_MAGMA_LIT if rift_v > 0.76 else OW_MAGMA_DEEP
        return OW_BASALT_MORTAR

    # Diagonal fracture crack across 22% of basalt slabs
    if H(ci, sid, 541) < 0.22:
        crack_x = int(sw * 0.42) + (ly // 2)
        if lx == crack_x and 1 <= ly <= sh - 2:
            return OW_MAGMA_DEEP if (isl in (2, 3) and H(x, y, 547) < 0.35) else OW_BASALT_MORTAR

    tone = [0, 1, 1, 2, 2, 3][int(H(ci, sid, 557) * 6) % 6]
    if ly == 0 and 1 <= lx <= sw - 3 and H(ci, sid, 563) < 0.58:
        tone = min(4, tone + 1)
    elif lx == 0 and 1 <= ly <= sh - 3 and H(ci, sid, 569) < 0.38:
        tone = min(4, tone + 1)
    return ramp[tone]


def obsidian_bastion_wall_color(x: int, y: int, top_y: int, bot_y: int, is_corner: bool) -> Tuple[int, int, int]:
    """Stepped jagged obsidian bastion wall at northern crown of Island 1."""
    fy = y - top_y
    total_h = max(6, bot_y - top_y)
    in_crenel = ((x + 3) % 12 in (0, 1, 2)) and abs(x - CITADEL_AXIS_X) > 26 and not is_corner

    if fy == 0:
        return OW_STONE_OUT
    if fy == 1:
        return OW_STONE_MID if in_crenel else OW_STONE_GLINT
    if fy == 2:
        return OW_STONE_D1 if in_crenel else OW_STONE_RIM
    if fy == 3:
        return OW_STONE_D2
    if fy >= total_h - 2:
        return OW_STONE_OUT if fy == total_h - 1 else OW_STONE_D2

    if is_corner:
        return OW_STONE_RIM if (y % 6 == 0) else OW_STONE_L1

    # Glowing violet/crimson rune arrow-slit every 29px!
    if 7 <= fy <= 11 and ((x + 9) % 29 == 0) and abs(x - CITADEL_AXIS_X) > 32:
        return OW_MAGMA_CORE if fy == 9 else OW_MAGMA_MID

    ci, ly, sh = OW_Y_COURSE[y]
    bw = [17, 21, 15, 19][ci % 4]
    off = int(H(ci, 9, 577) * 29)
    lx = (x + off) % bw
    if ly == sh - 1 or lx == bw - 1:
        return OW_STONE_D2
    c = OW_STONE_L1 if H((x + off) // bw, ci, 587) < 0.45 else OW_STONE_MID
    if ly == 0 and lx < bw - 2:
        c = lerp_rgb(c, OW_STONE_RIM, 0.35)
    if fy >= total_h // 2:
        c = mul(c, 0.84)
    return c


def paint_cosmic_abyss(img: Image.Image) -> None:
    """Deep starry purple-indigo abyssal void + distant nebula wisps + floating jagged basalt shards."""
    px = img.load()
    for y in range(H_PX):
        t = y / float(H_PX - 1)
        base = lerp_rgb(OW_VOID_TOP, OW_VOID_MID, t / 0.55) if t < 0.55 else lerp_rgb(OW_VOID_MID, OW_VOID_BOT, (t - 0.55) / 0.45)
        for x in range(W_PX):
            # Soft diagonal cosmic nebula ribbons
            neb1 = vnoise(x + y * 0.45, y - x * 0.25, 48.0, 601)
            neb2 = vnoise(x * 1.2, y * 1.2, 22.0, 607)
            neb = max(0.0, (neb1 * 0.68 + neb2 * 0.32) - 0.46) * 1.85
            c = lerp_rgb(base, OW_NEBULA_A, min(0.75, neb))
            if neb > 0.42:
                c = lerp_rgb(c, OW_NEBULA_B, min(0.55, (neb - 0.42) * 1.3))
            px[x, y] = (*c, 255)

    # Distant starfield + 4-point cosmic diamond glints
    for y in range(2, H_PX - 2):
        for x in range(2, W_PX - 2):
            s = H(x, y, 613)
            if s < 0.0022:
                px[x, y] = (*hx3("#fafaf8"), 255)
                if s < 0.00045:
                    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                        r0, g0, b0, _ = px[x + dx, y + dy]
                        px[x + dx, y + dy] = (*lerp_rgb((r0, g0, b0), hx3("#e89afa"), 0.65), 255)
            elif s < 0.0052:
                col = hx3("#bd5bd8") if H(x, y, 619) < 0.45 else hx3("#6d68b8")
                r0, g0, b0, _ = px[x, y]
                px[x, y] = (*lerp_rgb((r0, g0, b0), col, 0.72), 255)

    # Detached Floating Craggy Basalt Islets in open void corners (organic lumpy crags, ZERO flat triangle tops!)
    shards = [
        (46, 54, 24, 15, 1),
        (88, 92, 16, 11, 2),
        (408, 150, 20, 13, 3),
        (414, 286, 26, 16, 4),
        (56, 314, 22, 14, 5),
        (134, 326, 14, 10, 6),
    ]
    for sx, sy, sw, sh, sd in shards:
        for dx in range(-sw // 2 - 2, sw // 2 + 3):
            xx = sx + dx
            if not (0 <= xx < W_PX):
                continue
            u_x = abs(dx) / float(max(1.0, sw * 0.52))
            if u_x > 1.08:
                continue
            # Curved stepped craggy top ridge & jagged stalactite bottom!
            top_dy = -int(round((1.0 - u_x * u_x) * 3.5 + (vnoise(xx, sy, 3.0, 620 + sd) - 0.5) * 3.0))
            bot_dy = int(round((1.0 - u_x ** 1.35) * sh + (vnoise(xx, sy + 9, 2.6, 640 + sd) - 0.5) * 4.5))
            for dy in range(top_dy, bot_dy + 1):
                yy = sy + dy
                if not (0 <= yy < H_PX):
                    continue
                if dy <= top_dy + 1:
                    c = OW_STONE_RIM if dx < 0 else OW_STONE_L1
                elif dy <= top_dy + 4:
                    c = OW_STONE_L1 if dx < 0 else OW_STONE_MID
                elif dy == bot_dy:
                    c = OW_STONE_OUT
                else:
                    c = OW_STONE_D1 if dx < -1 else OW_STONE_D2
                    if abs(dx - 1) <= 1 and (top_dy + 3) < dy < (bot_dy - 1) and sd % 2 == 1:
                        c = OW_MAGMA_LIT if dy % 3 == 0 else OW_MAGMA_MID
                px[xx, yy] = (*c, 255)
        # Tiny glowing corrupt crystal spire perched on floating rock!
        if sd in (1, 4, 5):
            for cy_off, chx in [(-6, "#f8b8ff"), (-5, "#cb5ef0"), (-4, "#8824ad"), (-3, "#43165c")]:
                px[sx - 1, sy + cy_off] = (*hx3(chx), 255)
                if cy_off >= -5:
                    px[sx, sy + cy_off] = (*hx3("#8824ad"), 255)


def paint_otherworld_islands_and_bridges(img: Image.Image) -> None:
    px = img.load()
    isl_map = [[island_id_at(x, y) for y in range(H_PX)] for x in range(W_PX)]

    # 1. Sculpted Jagged 3D Obsidian Under-Cliffs with Glowing Magenta/Violet Magma Veins!
    for x in range(W_PX):
        # Scan every bottom transition from island -> void in column `x` so ALL 4 islands get 3D under-cliffs!
        y = 0
        while y < H_PX:
            if isl_map[x][y] != 0:
                isl_id = isl_map[x][y]
                y_start = y
                while y < H_PX and isl_map[x][y] == isl_id:
                    y += 1
                y_bot = y - 1
                span = y_bot - y_start
                if span < 5 or (isl_id == 4 and y_bot >= H_PX - 2):
                    continue
                taper = min(1.0, span / 26.0)
                base_depth = 28.0 if isl_id in (1, 2) else 32.0
                cliff_depth = int(
                    taper
                    * (
                        base_depth
                        + 6.5 * math.sin(x * 0.08 + isl_id)
                        + 4.5 * math.cos(x * 0.21)
                        + (vnoise(x, y_bot, 4.0, 701 + isl_id * 13) - 0.5) * 9.0
                    )
                )
                for dy in range(1, cliff_depth + 1):
                    yy = y_bot + dy
                    if yy >= H_PX or isl_map[x][yy] != 0:
                        break
                    depth_t = dy / float(max(1, cliff_depth))
                    # Branching vertical/diagonal glowing magenta-violet magma veins!
                    vein_wave = math.sin(x * 0.24 + vnoise(x, yy, 7.5, 733) * 3.4)
                    is_vein_core = abs(vein_wave) < 0.075 and 0.12 < depth_t < 0.82
                    is_vein_aura = abs(vein_wave) < 0.165 and 0.08 < depth_t < 0.88

                    if dy == cliff_depth:
                        c = OW_STONE_OUT
                    elif is_vein_core:
                        c = OW_MAGMA_CORE if depth_t < 0.45 else OW_MAGMA_LIT
                    elif is_vein_aura:
                        c = OW_MAGMA_MID if depth_t < 0.60 else OW_MAGMA_DEEP
                    else:
                        strata = vnoise(x * 0.7, yy * 1.3, 5.5, 751)
                        if dy <= 2:
                            c = OW_STONE_OUT
                        elif strata > 0.62 and depth_t < 0.58:
                            c = OW_STONE_L1 if x % 19 < 10 else OW_STONE_MID
                        elif strata > 0.38:
                            c = OW_STONE_MID if depth_t < 0.48 else OW_STONE_D1
                        else:
                            c = OW_STONE_D1 if depth_t < 0.52 else OW_STONE_D2
                    px[x, yy] = (*c, 255)
            else:
                y += 1

    # Arched Stone Side-Buttresses on South Arrival Causeway (`y=328..351`)
    for y in range(328, H_PX):
        for side in (-1, 1):
            for w_off in range(24, 30):
                xx = CITADEL_AXIS_X + side * w_off
                if 0 <= xx < W_PX and isl_map[xx][y] == 0:
                    arch = (y - 330) % 18
                    if w_off >= 28 and 5 <= arch <= 13:
                        continue
                    px[xx, y] = (*(OW_STONE_OUT if w_off == 29 else OW_STONE_D1), 255)

    # 2. Top Surfaces of All 4 Jagged Basalt Islands + Citadel Crown Bastion
    for x in range(W_PX):
        rc_top = citadel_crown_step_top(x)
        rc_prev = citadel_crown_step_top(x - 1)
        rc_next = citadel_crown_step_top(x + 1)
        is_rc_corner = (rc_top is not None) and ((rc_prev != rc_top) or (rc_next != rc_top))
        rc_bot = (rc_top + 16) if rc_top is not None else None

        for y in range(H_PX):
            isl = isl_map[x][y]
            if isl == 0:
                continue

            # Island 1 North Stepped Obsidian Bastion Wall
            if isl == 1 and rc_top is not None and rc_bot is not None and y <= rc_bot:
                c = obsidian_bastion_wall_color(x, y, rc_top, rc_bot + 1, is_rc_corner)
                px[x, y] = (*c, 255)
                continue

            # South Arrival Causeway Side Parapets (`y >= 326`)
            if isl == 4 and y >= 326 and abs(x - CITADEL_AXIS_X) > 19:
                dc = abs(x - CITADEL_AXIS_X)
                if dc >= 23:
                    c = OW_STONE_OUT
                elif dc >= 21:
                    c = OW_BONE_RAMP[4] if (y % 8 in (0, 1)) else OW_STONE_RIM
                else:
                    c = OW_STONE_D1
                px[x, y] = (*c, 255)
                continue

            c = basalt_slab_color(x, y, isl)

            # Wall-foot shadow south of Island 1's northern crown bastion
            if isl == 1 and rc_bot is not None and rc_bot < y <= rc_bot + 4:
                c = mul(c, 0.60 + 0.09 * (y - rc_bot))

            # Crisp bevelled craggy obsidian rim around every island's cliff edge!
            n_void = (y == 0) or (isl_map[x][y - 1] == 0)
            w_void = (x == 0) or (isl_map[x - 1][y] == 0)
            s_void = (y == H_PX - 1) or (isl_map[x][y + 1] == 0)
            e_void = (x == W_PX - 1) or (isl_map[x + 1][y] == 0)
            if n_void or w_void:
                c = lerp_rgb(c, OW_STONE_RIM, 0.45)
            elif s_void or e_void:
                c = lerp_rgb(c, OW_STONE_L1, 0.25) if (x + y) % 5 == 0 else mul(c, 0.78)

            px[x, y] = (*c, 255)

    # 3. Paint the 3 Arched Dark-Stone & Bone-Rib Bridges!
    paint_ns_bone_bridge(img, x_center=CITADEL_AXIS_X, y0=118, y1=162)  # Bridge A: Nexus -> Citadel
    paint_ns_bone_bridge(img, x_center=CITADEL_AXIS_X, y0=234, y1=280)  # Bridge C: Arrival -> Nexus
    paint_ew_bone_bridge(img, x0=138, x1=190, y_center=207)             # Bridge B: West Crystal <-> Nexus


def paint_ns_bone_bridge(img: Image.Image, x_center: int, y0: int, y1: int) -> None:
    """Vertical (N-S) arched obsidian bridge with curved pale spine-bone rib parapets & under-arch."""
    px = img.load()
    span = max(1, y1 - y0)
    for y in range(y0, y1 + 1):
        u = (y - y0) / float(span)
        squeeze = int(round(1.5 * math.sin(u * math.pi)))
        hw = 17 - squeeze  # ~32px wide (2 full 16px tiles!)
        rib = ((y - y0) % 7 in (1, 2))
        tread_joint = ((y - y0) % 6 == 0)

        # Under-arch stone vault skirts on east & west sides over the void
        for side in (-1, 1):
            for off in range(hw + 1, hw + 5):
                xx = x_center + side * off
                if 0 <= xx < W_PX and 0.14 < u < 0.86:
                    arch_open = (0.30 < u < 0.70) and (off >= hw + 3)
                    if not arch_open:
                        px[xx, y] = (*(OW_STONE_OUT if off == hw + 4 else OW_STONE_D2), 255)

        for dx in range(-hw, hw + 1):
            xx = x_center + dx
            adx = abs(dx)
            if adx == hw:
                c = OW_BONE_RAMP[0]
            elif adx in (hw - 1, hw - 2):
                # Curved pale bone rib-parapets matching `bone-pillar.png`!
                if rib:
                    c = OW_BONE_RAMP[5] if adx == hw - 2 else OW_BONE_RAMP[4]
                else:
                    c = OW_STONE_RIM if adx == hw - 2 else OW_STONE_MID
            elif adx == hw - 3:
                c = OW_STONE_D2
            else:
                # Arched dark-obsidian stone bridge treads + glowing violet center rune seam
                if tread_joint:
                    c = OW_BASALT_MORTAR
                elif adx <= 1 and ((y - y0) % 6 in (2, 3)):
                    c = OW_MAGMA_MID if adx == 0 else OW_MAGMA_DEEP
                else:
                    lit_arch = 0.25 < u < 0.75
                    c = OW_CITADEL_SLABS[3 if lit_arch else 2] if (xx + y) % 5 else OW_CITADEL_SLABS[1]
            px[xx, y] = (*c, 255)

    # 4 Corner Bone-Horn Bridge Pylons at bridgeheads!
    for py_b in (y0 + 1, y1 - 5):
        for side in (-1, 1):
            bx = x_center + side * 15 - 2
            for dy in range(5):
                for dx in range(5):
                    xx, yy = bx + dx, py_b + dy
                    if 0 <= xx < W_PX and 0 <= yy < H_PX:
                        if dx in (0, 4) or dy in (0, 4):
                            c = OW_BONE_RAMP[0]
                        elif dy == 1:
                            c = OW_BONE_RAMP[5]
                        else:
                            c = OW_BONE_RAMP[4 if dx == 1 else 2]
                        px[xx, yy] = (*c, 255)


def paint_ew_bone_bridge(img: Image.Image, x0: int, x1: int, y_center: int) -> None:
    """Horizontal (E-W) arched dark-stone & bone bridge with sculpted under-arch vault over the abyss!"""
    px = img.load()
    span = max(1, x1 - x0)
    for x in range(x0, x1 + 1):
        u = (x - x0) / float(span)
        arch_lift = int(round(3.2 * math.sin(u * math.pi)))
        top_y = (y_center - 14) - arch_lift
        bot_y = (y_center + 14) - arch_lift
        rib = ((x - x0) % 7 in (1, 2))
        plank_joint = ((x - x0) % 6 == 0)

        # Sculpted dark obsidian & bone under-arch below `bot_y`!
        arch_thickness = int(round(9.0 - 5.2 * math.sin(u * math.pi)))
        for dy_a in range(1, max(2, arch_thickness) + 1):
            yy = bot_y + dy_a
            if 0 <= yy < H_PX:
                if dy_a == arch_thickness:
                    c = OW_MAGMA_MID if (0.42 <= u <= 0.58) else OW_STONE_OUT
                elif dy_a == 1:
                    c = OW_STONE_OUT
                else:
                    c = OW_STONE_MID if rib else OW_STONE_D1
                px[x, yy] = (*c, 255)

        for y in range(top_y, bot_y + 1):
            if y == top_y or y == bot_y:
                c = OW_BONE_RAMP[0]
            elif y in (top_y + 1, top_y + 2, bot_y - 2, bot_y - 1):
                if rib:
                    c = OW_BONE_RAMP[5] if y in (top_y + 1, bot_y - 2) else OW_BONE_RAMP[4]
                else:
                    c = OW_STONE_RIM if y in (top_y + 1, bot_y - 2) else OW_STONE_MID
            elif y == top_y + 3 or y == bot_y - 3:
                c = OW_STONE_D2
            else:
                cy_deck = (top_y + bot_y) // 2
                if plank_joint:
                    c = OW_BASALT_MORTAR
                elif abs(y - cy_deck) <= 1 and ((x - x0) % 6 in (2, 3)):
                    c = OW_MAGMA_MID if y == cy_deck else OW_MAGMA_DEEP
                else:
                    c = OW_CITADEL_SLABS[3 if 0.25 < u < 0.75 else 2]
            px[x, y] = (*c, 255)


# ---------------------------------------------------------------------------
# Custom Abyssal Relic Altar Table & Void Chest for Map 2
# ---------------------------------------------------------------------------
def build_obsidian_ritual_altar() -> Image.Image:
    """32x22 Carved Obsidian & Bone Ritual Table WITH Skull Chalice, Shadow Tome, Soul Shard & Blood Scroll ON TOP!"""
    p = Pix(32, 22)
    # Base obsidian & bone-trimmed altar table (y=6..21)
    for y in range(6, 21):
        for x in range(1, 31):
            if y == 6:
                c = hx("#0f101a")
            elif y in (7, 8, 9, 10, 11):
                if x in (1, 30):
                    c = hx("#0f101a")
                elif x == 2 or y == 7:
                    c = hx("#85889e")
                else:
                    c = hx("#3b3e56") if (x + y) % 4 else hx("#2e3040")
            elif y == 12:
                if x in (1, 30):
                    c = hx("#0f101a")
                else:
                    c = hx("#e2e4e8") if x % 4 < 2 else hx("#b62b29")
            elif y == 13:
                c = hx("#1d1f2d")
            else:
                in_leg = (3 <= x <= 9) or (22 <= x <= 28)
                if not in_leg:
                    if y <= 15 and 9 < x < 22:
                        c = hx("#1d1f2d") if y == 14 else hx("#0f101a")
                    else:
                        continue
                else:
                    if x in (3, 9, 22, 28) or y == 20:
                        c = hx("#0f101a")
                    elif x in (4, 23):
                        c = hx("#707282")
                    elif y == 17:
                        c = hx("#bd5bd8")
                    else:
                        c = hx("#46485c") if y < 18 else hx("#2e3040")
            p.set(x, y, c)
    for x in range(2, 30):
        p.set(x, 21, (10, 8, 18, 130))

    # 1. Open Forbidden Crimson Grimoire (left, x=4..12, y=4..9)
    p.lit(
        4,
        4,
        [
            " ooo ooo ",
            "oPPPoPPPo",
            "oPrPoPvPo",
            "osssossso",
            "rrrrrrrrr",
        ],
        {
            "o": hx("#141622"),
            "P": hx("#f0e4d0"),
            "s": hx("#b8a890"),
            "r": hx("#b62b29"),
            "v": hx("#9329b6"),
        },
    )
    # 2. Bone Skull Chalice with Crimson Elixir (center, x=14..18, y=1..8)
    p.lit(
        13,
        1,
        [
            " ooooo ",
            "obrrrbo",
            "oBWBWBo",
            " oBBBo ",
            "  obo  ",
            " obBbo ",
            " ooooo ",
        ],
        {
            "o": hx("#141622"),
            "b": hx("#bec0c8"),
            "B": hx("#e2e4e8"),
            "W": hx("#9329b6"),
            "r": hx("#e03838"),
        },
    )
    # 3. Glowing Violet Soul-Crystal Cluster & Scroll (right, x=21..28, y=1..9)
    p.lit(
        21,
        1,
        [
            "   o    ",
            "  owo   ",
            " owVvo  ",
            "owVVvdo ",
            "oVvvddo ",
            " odddo  ",
            "  ooo   ",
        ],
        {
            "o": hx("#141622"),
            "w": hx("#fafaf8"),
            "V": hx("#e89afa"),
            "v": hx("#bd5bd8"),
            "d": hx("#571c72"),
        },
    )
    return p.im


def build_obsidian_void_chest() -> Image.Image:
    """16x16 dark-iron & bone chest with glowing violet crystal lock for West Crystal Island."""
    p = Pix(16, 16)
    k = {
        "o": hx("#0f101a"),
        "b": hx("#bec0c8"),
        "s": hx("#62657a"),
        "d": hx("#2e3040"),
        "D": hx("#1d1f2d"),
        "v": hx("#e89afa"),
        "V": hx("#9329b6"),
    }
    p.lit(
        1,
        2,
        [
            " oooooooooooo ",
            "obssssssssssbo",
            "obsddddddddsbo",
            "obsddDVvDddsbo",
            "oooooooooooooo",
            "obsddVvvVddsbo",
            "obsddddddddsbo",
            "obDDDDDDDDDDbo",
            " oooooooooooo ",
        ],
        k,
    )
    for x in range(2, 14):
        p.set(x, 11, (10, 8, 18, 130))
    return p.im


def load_otherworld_sprites() -> Dict[str, Image.Image]:
    names = [
        "portal-gate",
        "demon-throne",
        "corrupt-crystal-big",
        "corrupt-crystal",
        "bone-pillar",
        "void-brazier",
    ]
    sprites = {n: Image.open(OTHERWORLD_OBJ_DIR / f"{n}.png").convert("RGBA") for n in names}
    assert len(sprites) == 6
    sprites["obsidian_ritual_altar"] = build_obsidian_ritual_altar()
    sprites["obsidian_void_chest"] = build_obsidian_void_chest()
    ch1 = load_beodeul_char_1x()
    sprites["char_knight"] = ch1
    sprites["char_void_hunter"] = make_char_void_variant(ch1)
    return sprites


def get_otherworld_placements() -> List[Tuple[str, int, int, List[Tuple[int, int]]]]:
    """
    (sprite_key, px_x, px_y, blocked_grid_cells[(gx, gy)])
    Grid = 28 x 22 (448 x 352). Central bridge/citadel axis is gx = 15..16 (x = 240..272).
    """
    return [
        # ===================================================================
        # ISLAND 1: NORTH DEMON-LORD CITADEL ISLAND (gx=8..26, gy=0..7)
        # ===================================================================
        # Apex `portal-gate` (48x48 at x=232, y=4 -> spans y=4..52; walkable portal threshold at (15, 3)!)
        ("portal-gate", 232, 4, [(14, 2), (15, 2), (16, 2)]),
        # `demon-throne` on raised crimson-rune dais (32x48 at x=240, y=62 -> spans y=62..110;
        # walkable behind throne at gy=3..4, sides at gx=14 & gx=17, front at (15, 7) & (16, 7)!)
        ("demon-throne", 240, 62, [(15, 5), (16, 5), (15, 6), (16, 6)]),

        # Flanking `bone-pillar`s & `void-brazier`s framing Portal Gate & Demon Throne Dais
        ("bone-pillar", 196, 24, [(12, 3)]),
        ("bone-pillar", 300, 24, [(18, 3), (19, 3)]),
        ("void-brazier", 212, 40, [(13, 4)]),
        ("void-brazier", 284, 40, [(17, 4), (18, 4)]),
        ("bone-pillar", 196, 72, [(12, 6)]),
        ("bone-pillar", 300, 72, [(18, 6), (19, 6)]),
        ("void-brazier", 214, 86, [(13, 7)]),
        ("void-brazier", 282, 86, [(17, 7), (18, 7)]),

        # West Citadel Bastion Wing
        ("corrupt-crystal", 148, 44, [(9, 4)]),
        ("void-brazier", 168, 44, [(10, 4)]),

        # East Citadel Ritual Altar Terrace (dressed Obsidian Altar Table + crystals + brazier!)
        ("obsidian_ritual_altar", 344, 66, [(21, 5), (22, 5)]),
        ("void-brazier", 324, 48, [(20, 4)]),
        ("corrupt-crystal", 392, 50, [(24, 4)]),
        ("bone-pillar", 384, 78, [(24, 6)]),

        # ===================================================================
        # ISLAND 2: CENTRAL RIFTED NEXUS ISLAND (gx=12..23, gy=10..14)
        # ===================================================================
        ("bone-pillar", 212, 160, [(13, 11)]),
        ("bone-pillar", 300, 160, [(19, 11)]),
        ("void-brazier", 324, 180, [(20, 12)]),
        ("corrupt-crystal", 346, 168, [(22, 11)]),

        # ===================================================================
        # ISLAND 3: WEST CORRUPT CRYSTAL OUTCROP ISLAND (gx=1..9, gy=9..15)
        # ===================================================================
        ("corrupt-crystal-big", 40, 144, [(2, 10), (3, 10)]),
        ("corrupt-crystal", 82, 144, [(5, 10)]),
        ("corrupt-crystal", 110, 158, [(7, 11)]),
        ("corrupt-crystal", 24, 178, [(1, 12)]),
        ("obsidian_void_chest", 64, 176, [(4, 11)]),
        ("corrupt-crystal-big", 82, 208, [(5, 14), (6, 14)]),
        ("corrupt-crystal", 46, 214, [(3, 14)]),
        ("void-brazier", 114, 212, [(7, 14)]),

        # ===================================================================
        # ISLAND 4: SOUTH ARRIVAL CAUSEWAY ISLAND (gx=11..21, gy=17..21)
        # ===================================================================
        ("bone-pillar", 212, 278, [(13, 18)]),
        ("bone-pillar", 284, 278, [(18, 18)]),
        ("void-brazier", 224, 298, [(14, 20)]),
        ("void-brazier", 272, 298, [(17, 20)]),
        ("corrupt-crystal-big", 184, 274, [(11, 18), (12, 18)]),
        ("corrupt-crystal", 330, 286, [(21, 19)]),

        # ===================================================================
        # BEODEUL 1X SCALE CHARACTERS (22x25, non-blocking)
        # ===================================================================
        ("char_knight", 253, 184, []),      # Standing at the Glowing Violet Rune Circle on Central Nexus
        ("char_void_hunter", 94, 182, []),  # Exploring the pulsing Corrupt Crystal Outcrop on West Island
    ]


def apply_island_glow(img: Image.Image, cx: int, cy: int, radius: int, col_hex: str, strength: float) -> None:
    px = img.load()
    gc = hx3(col_hex)
    for y in range(max(0, cy - radius), min(H_PX, cy + radius + 1)):
        for x in range(max(0, cx - radius), min(W_PX, cx + radius + 1)):
            if island_id_at(x, y) == 0 and not in_any_bridge_walkable(x, y):
                continue
            d = math.hypot(x - cx, (y - cy) * 1.22)
            if d < radius:
                falloff = ((1.0 - d / radius) ** 1.75) * strength
                r, g, b, a = px[x, y]
                px[x, y] = (*lerp_rgb((r, g, b), gc, falloff), a)


def render_otherworld_vignettes(img: Image.Image, sprites: Dict[str, Image.Image], placements: list) -> None:
    # Radial violet/magenta & crimson light pools cast onto basalt slabs BEFORE compositing sprites!
    apply_island_glow(img, 256, 48, 38, "#bd5bd8", 0.30)   # Portal Gate galaxy glow
    apply_island_glow(img, 256, 94, 30, "#d93238", 0.22)   # Demon Throne crimson rune glow
    apply_island_glow(img, 264, 198, 34, "#bd5bd8", 0.26)  # Central Nexus violet rune circle glow

    for key, x, y, _ in placements:
        if key == "void-brazier":
            apply_island_glow(img, x + 8, y + 24, 28, "#e89afa", 0.30)
        elif key == "corrupt-crystal-big":
            apply_island_glow(img, x + 16, y + 26, 34, "#cb5ef0", 0.34)
        elif key == "corrupt-crystal":
            apply_island_glow(img, x + 8, y + 26, 22, "#bd5bd8", 0.26)
        elif key == "obsidian_ritual_altar":
            apply_island_glow(img, x + 16, y + 16, 24, "#bd5bd8", 0.22)

    sorted_items = sorted(placements, key=lambda it: (it[2] + sprites[it[0]].size[1], it[1]))
    for key, x, y, _ in sorted_items:
        img.alpha_composite(sprites[key], (x, y))


def verify_otherworld_bfs(placements: list) -> dict:
    walk = [[False for _ in range(MAP_TW)] for _ in range(MAP_TH)]
    reasons = [["void" for _ in range(MAP_TW)] for _ in range(MAP_TH)]

    for gy in range(MAP_TH):
        for gx in range(MAP_TW):
            cx = gx * 16 + 8
            cy = gy * 16 + 8
            pts = [(cx, cy), (cx - 3, cy - 3), (cx + 3, cy - 3), (cx - 3, cy + 3), (cx + 3, cy + 3)]
            on_surf = all((island_id_at(px_, py_) != 0 or in_any_bridge_walkable(px_, py_)) for px_, py_ in pts)
            if not on_surf:
                continue

            # Exclude Northern Citadel Crown Parapet Wall
            rc = citadel_crown_step_top(cx)
            if island_id_at(cx, cy) == 1 and rc is not None and cy <= rc + 16:
                reasons[gy][gx] = "citadel_crown_wall"
                continue

            # Exclude South Causeway side parapets
            if cy >= 326 and abs(cx - CITADEL_AXIS_X) > 19:
                reasons[gy][gx] = "causeway_parapet"
                continue

            walk[gy][gx] = True
            reasons[gy][gx] = ""

    for key, _, _, cells in placements:
        for gx, gy in cells:
            if 0 <= gx < MAP_TW and 0 <= gy < MAP_TH:
                walk[gy][gx] = False
                reasons[gy][gx] = f"obj:{key}"

    start = (15, 21)
    if not walk[start[1]][start[0]]:
        raise AssertionError(f"Otherworld start {start} blocked by {reasons[start[1]][start[0]]}")

    visited = {start: None}
    q = deque([start])
    while q:
        ux, uy = q.popleft()
        for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):
            nx, ny = ux + dx, uy + dy
            if 0 <= nx < MAP_TW and 0 <= ny < MAP_TH and walk[ny][nx] and (nx, ny) not in visited:
                visited[(nx, ny)] = (ux, uy)
                q.append((nx, ny))

    targets = {
        "south_arrival_causeway": (15, 21),
        "south_arrival_plaza": (15, 19),
        "south_bone_bridge": (15, 16),
        "central_rifted_nexus_circle": (16, 12),
        "west_bone_bridge": (10, 12),
        "west_crystal_outcrop_plaza": (6, 12),
        "west_void_chest_front": (4, 12),
        "north_bone_bridge": (15, 9),
        "demon_throne_front": (15, 7),
        "citadel_west_bastion": (11, 5),
        "citadel_east_ritual_altar": (22, 6),
        "portal_gate_threshold": (15, 3),
    }

    target_reports = {}
    for name, cell in targets.items():
        ok = cell in visited
        steps = 0
        cur = cell
        while ok and cur is not None and cur != start:
            cur = visited[cur]
            steps += 1
        target_reports[name] = {
            "cell": list(cell),
            "reachable": ok,
            "steps": steps if ok else -1,
            "reason_if_blocked": reasons[cell[1]][cell[0]],
        }

    # Verify all 6 Carbon otherworld sprites are used
    carbon_6 = {p.stem for p in OTHERWORLD_OBJ_DIR.glob("*.png")}
    used = {k for k, _, _, _ in placements if k in carbon_6}
    missing = sorted(carbon_6 - used)

    trapped = [(gx, gy) for gy in range(MAP_TH) for gx in range(MAP_TW) if walk[gy][gx] and (gx, gy) not in visited]

    return {
        "ok": all(v["reachable"] for v in target_reports.values()) and len(missing) == 0 and len(trapped) == 0,
        "reachable_cells": len(visited),
        "total_walkable_cells": sum(1 for gy in range(MAP_TH) for gx in range(MAP_TW) if walk[gy][gx]),
        "trapped_cells": trapped,
        "carbon_sprites_used": f"{len(used)}/{len(carbon_6)}",
        "missing_sprites": missing,
        "targets": target_reports,
    }


def build_otherworld_map() -> Tuple[Image.Image, dict]:
    img = Image.new("RGBA", (W_PX, H_PX), (0, 0, 0, 255))
    paint_cosmic_abyss(img)
    paint_otherworld_islands_and_bridges(img)
    sprites = load_otherworld_sprites()
    placements = get_otherworld_placements()
    render_otherworld_vignettes(img, sprites, placements)
    report = verify_otherworld_bfs(placements)
    return img, report


# ===========================================================================
# Main Entrypoint
# ===========================================================================
def main() -> None:
    PYRAMID_DIR.mkdir(parents=True, exist_ok=True)
    OTHERWORLD_DIR.mkdir(parents=True, exist_ok=True)

    # --- 1. Build & Verify `map_pyramid_v2.png` ---
    pyr_relics = build_pyramid_tabletop_relics()
    pyr_cat = load_pyramid_catalog()
    pyr_spec = build_pyramid_spec(pyr_cat)
    pyr_report = verify_pyramid_architecture(pyr_spec)
    print("=== PYRAMID V2 VERIFICATION ===")
    print(json.dumps(pyr_report, indent=2, ensure_ascii=False))
    if not pyr_report["ok"]:
        raise SystemExit(f"Pyramid v2 verification FAILED: {pyr_report['issues']}")

    pyr_1x = compose_pyramid_scene(pyr_spec, pyr_relics)
    pyr_out_1x = PYRAMID_DIR / "map_pyramid_v2.png"
    pyr_out_2x = PYRAMID_DIR / "map_pyramid_v2_2x.png"
    pyr_1x.save(pyr_out_1x)
    pyr_1x.resize((W_PX * 2, H_PX * 2), Image.Resampling.NEAREST).save(pyr_out_2x)
    print(f"Saved: {pyr_out_1x} ({pyr_1x.size})")
    print(f"Saved: {pyr_out_2x} ({W_PX * 2}x{H_PX * 2})")

    # --- 2. Build & Verify `map_otherworld_v2.png` ---
    ow_1x, ow_report = build_otherworld_map()
    print("=== OTHERWORLD V2 VERIFICATION ===")
    print(json.dumps(ow_report, indent=2, ensure_ascii=False))
    if not ow_report["ok"]:
        raise SystemExit(f"Otherworld v2 verification FAILED: {ow_report}")

    ow_out_1x = OTHERWORLD_DIR / "map_otherworld_v2.png"
    ow_out_2x = OTHERWORLD_DIR / "map_otherworld_v2_2x.png"
    ow_1x.save(ow_out_1x)
    ow_1x.resize((W_PX * 2, H_PX * 2), Image.Resampling.NEAREST).save(ow_out_2x)
    print(f"Saved: {ow_out_1x} ({ow_1x.size})")
    print(f"Saved: {ow_out_2x} ({W_PX * 2}x{H_PX * 2})")


if __name__ == "__main__":
    main()
