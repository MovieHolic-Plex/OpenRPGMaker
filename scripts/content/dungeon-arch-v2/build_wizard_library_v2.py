#!/usr/bin/env python3
"""
Rebuild `fantasy_wizard_library` Map Architecture v2
- Stepped Octagonal Astral Library Rotunda + Thick Void/Stone Partitions
- Asymmetric Lower Wings (SW Cozy Timber-Plaster Hearth Study + SE Fire-Safe Stone Alchemy Lab & Storeroom)
- Protruding South Flagstone Entrance Vestibule
- True Derived RM2000 Walls & Ceiling Rims (`room2.py` method: ceiling cap + 3px inner stone rim,
  world-coord 32px wall faces, 3px wall-foot contact shadow, 6px west-wall cast shadow, window sunbeams)
- Quiet World-Coordinate Floors (5px staggered dark oak planks & 14x10 irregular slate/ashlar flagstones)
- Reuses all 20 Carbon Medium sprites + Beodeul 1x scale characters + custom tabletop goods,
  Gothic lancet windows, star-chart tapestry, 9-slice crimson rugs, and 3-wide north-wall stone staircase up.
- Automated BFS walkability, doorway clearance, use-cell reachability, and architectural rule verification.
"""

from __future__ import annotations
import json
import math
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Dict, List, Optional, Sequence, Tuple
from PIL import Image

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
CARBON_OBJ_DIR = ROOT / "tiledata/dungeon-dots/fantasy_wizard_library_carbon/objects"
CHAR_REF_4X = ROOT / "tiledata/dungeon-pilot/_dots_kit_refs/ref_beodeul_char_4x.png"
OUT_DIR = ROOT / "tiledata/dungeon-arch-v2/fantasy_wizard_library"


# ---------------------------------------------------------------------------
# Deterministic hash & colour helpers (matching v5/k.py & room2.py)
# ---------------------------------------------------------------------------
def hx(s: str) -> Tuple[int, int, int, int]:
    s = s.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), 255)


def hx3(s: str) -> Tuple[int, int, int]:
    s = s.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))


def mul(c: Sequence[int], k: float) -> Tuple[int, int, int]:
    return (
        max(0, min(255, int(c[0] * k))),
        max(0, min(255, int(c[1] * k))),
        max(0, min(255, int(c[2] * k))),
    )


def H(x: int, y: int, s: int = 0) -> float:
    n = (x * 374761393 + y * 668265263 + s * 1442695040888963407) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 65535.0


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


# ---------------------------------------------------------------------------
# Palettes (locked to Carbon Medium sprites & v5 RTP value contrast rules)
# ---------------------------------------------------------------------------
VOID = hx3("#141218")
# Keep outer ceiling checker nearly merged with pitch-dark void (like tower.png CE['dark'])
# so ONLY the crisp 3px carved-stone inner rim highlights every room & stepped octagon corner!
CEIL_CHECKER = (hx3("#1a1721"), hx3("#15131b"))
# Carved stone inner ceiling rim (dark outline -> shadow -> mid -> lit -> bright top lip)
RIM_STONE = [
    hx3("#25222e"),  # 0: outer edge / dark line
    hx3("#3a3646"),  # 1: deep bevel
    hx3("#504b5e"),  # 2: east/south step
    hx3("#686278"),  # 3: inner bevel
    hx3("#827c92"),  # 4: lit stone face
    hx3("#9e98ae"),  # 5: bright south inner lip
]

# Quiet world-coordinate floors (low contrast ~24 luma span so lighter oak desks & colourful books POP!)
OAK_FLOOR = [
    hx3("#2a1b11"),  # 0: darkest board joint
    hx3("#362317"),  # 1: seam / end joint
    hx3("#432c1e"),  # 2: dark board body
    hx3("#4d3423"),  # 3: mid board body
    hx3("#583c29"),  # 4: subtle top board edge
]

SLATE_FLOOR = [
    hx3("#201f28"),  # 0: mortar joint
    hx3("#2b2a35"),  # 1: deep slab
    hx3("#353441"),  # 2: dark slate body
    hx3("#3f3e4d"),  # 3: mid slate body
    hx3("#494858"),  # 4: subtle lit north slab edge
]

ALCHEMY_FLOOR = [
    hx3("#1d1b22"),  # 0: mortar joint
    hx3("#28262f"),  # 1: soot-darkened slab
    hx3("#32303a"),  # 2: ashlar slab body A
    hx3("#3b3844"),  # 3: ashlar slab body B
    hx3("#45424f"),  # 4: subtle top slab highlight
]

# World-coordinate 32px wall ramps
ASHLAR_WALL = [
    hx3("#1b1a22"),  # 0: deep mortar / plinth base
    hx3("#2d2c36"),  # 1: dark mortar / shadow block
    hx3("#42414d"),  # 2: shaded stone block
    hx3("#565664"),  # 3: mid dressed ashlar
    hx3("#6b6b7a"),  # 4: warm-cool dressed ashlar
    hx3("#828292"),  # 5: top course highlight
    hx3("#9898a8"),  # 6: carved string-course glint
]

TIMBER = [
    hx3("#1a1009"),  # 0: baseboard shadow
    hx3("#2d1c12"),  # 1: dark oak outline
    hx3("#442c19"),  # 2: deep oak shadow
    hx3("#5c3c24"),  # 3: mid wainscot oak
    hx3("#754d30"),  # 4: warm oak panel
    hx3("#8e5f3c"),  # 5: lit oak post / rail
    hx3("#aa744a"),  # 6: bright chair-rail highlight
]

PLASTER = [
    hx3("#6e604c"),  # 0: beam shadow line
    hx3("#8c7b62"),  # 1: shaded plaster
    hx3("#a49278"),  # 2: mid-dark warm plaster
    hx3("#b6a489"),  # 3: warm parchment plaster
    hx3("#c5b498"),  # 4: lit plaster
]


# ---------------------------------------------------------------------------
# World-Coordinate Floor & 32px Wall Painters (ZERO 16x16 tile seams!)
# ---------------------------------------------------------------------------
def floor_oak_plank(x: int, y: int, seed: int = 19) -> Tuple[int, int, int]:
    """Staggered 5px dark weathered oak planks; joints never align vertically."""
    row = y // 5
    ly = y % 5
    if ly == 4:
        return OAK_FLOOR[0] if H(x // 2, row, seed) < 0.35 else OAK_FLOOR[1]
    off = (row * 17 + int(H(row, 0, seed + 1) * 19)) % 38
    L = 34 + (int(H(row, 3, seed + 2) * 3) * 4)  # 34, 38, or 42 px board length
    k = (x + off) // L
    lx = (x + off) % L
    if lx == 0:
        return OAK_FLOOR[1]
    base = 3 if H(row, k, seed + 5) < 0.52 else 2
    t = base + 1 if (ly == 0 and lx > 1) else base
    # Very sparse long grain streak near board rim (RTP rule: quiet centre)
    if ly == 2 and H((x + off) // 6, row, seed + 9) < 0.10:
        t = max(2, base - 1)
    return OAK_FLOOR[max(1, min(4, t))]


def floor_slate_flag(x: int, y: int, seed: int = 31) -> Tuple[int, int, int]:
    """Irregular 14x10 world-coord dark slate flagstones for Vestibule & Corridor."""
    sy = y // 10
    off = (sy * 9 + int(H(sy, 1, seed) * 5)) % 14
    W_slab = 14 if sy % 2 == 0 else 16
    lx = (x + off) % W_slab
    ly = y % 10
    slab_x = (x + off) // W_slab
    if ly == 9 or lx == W_slab - 1:
        return SLATE_FLOOR[0]
    base = [2, 2, 3, 3][int(H(slab_x, sy, seed + 2) * 4)]
    t = base + 1 if (ly == 0 and 1 <= lx <= W_slab - 3 and (slab_x + sy) % 2 == 0) else base
    if H(x // 3, y // 3, seed + 4) < 0.08:
        t = max(1, t - 1)
    return SLATE_FLOOR[max(1, min(4, t))]


def floor_alchemy_stone(x: int, y: int, seed: int = 47) -> Tuple[int, int, int]:
    """Irregular 14x10 fire-safe dark ashlar stone slabs with subtle soot patches."""
    sy = y // 10
    off = (sy * 7 + int(H(sy, 2, seed) * 6)) % 14
    W_slab = 15 if sy % 3 == 1 else 14
    lx = (x + off) % W_slab
    ly = y % 10
    slab_x = (x + off) // W_slab
    if ly == 9 or lx == W_slab - 1:
        return ALCHEMY_FLOOR[0]
    base = [2, 2, 3, 3][int(H(slab_x, sy, seed + 3) * 4)]
    t = base + 1 if (ly == 0 and 1 <= lx <= W_slab - 3 and H(slab_x, sy, seed + 8) < 0.55) else base
    # Subtle soot mottle
    if H(x // 5, y // 4, seed + 6) < 0.18:
        t = max(1, t - 1)
    return ALCHEMY_FLOOR[max(1, min(4, t))]


def wall_ashlar_stone(X: int, fy: int) -> Tuple[int, int, int]:
    """
    World-coord 32px dressed medieval ashlar stone wall:
    - Staggered 14-18px wide blocks across irregular course heights (ZERO 16px tiling!)
    - Subtle carved string-course cornice at fy=15..16
    - Darker lower dado (fy >= 17) + heavy plinth skirting (fy = 29..31)
    """
    if fy >= 29:
        return ASHLAR_WALL[2] if fy == 29 else (ASHLAR_WALL[1] if fy == 30 else ASHLAR_WALL[0])
    if fy == 15:
        return ASHLAR_WALL[5]
    if fy == 16:
        return ASHLAR_WALL[1]

    courses = [0, 5, 10, 15, 17, 23, 29]
    r = max(i for i, v in enumerate(courses[:-1]) if v <= fy)
    y0, y1 = courses[r], courses[r + 1]
    ly = fy - y0
    hgt = y1 - y0

    L = [15, 17, 14, 16, 18, 15][r % 6]
    off = (r * 9 + int(H(r, 4, 73) * 11)) % L
    lx = (X + off) % L
    blk = (X + off) // L

    if ly == hgt - 1 or lx == L - 1:
        c = ASHLAR_WALL[1] if lx == L - 1 and ly < hgt - 1 else ASHLAR_WALL[0]
    else:
        tone = 4 if H(blk, r, 79) < 0.62 else 3
        if ly == 0 and lx < L - 2:
            tone = min(5, tone + 1)
        elif lx == 0 and ly > 0:
            tone = min(5, tone + 1)
        if H(X // 2, fy // 2, 83) < 0.08:
            tone = max(2, tone - 1)
        c = ASHLAR_WALL[tone]

    # Lower dado one step darker (RTP & tiles5.py rule)
    if fy >= 17:
        c = mul(c, 0.84)
    return c


def wall_study_plaster(X: int, fy: int) -> Tuple[int, int, int]:
    """
    World-coord 32px warm timber-and-plaster Tudor wall for Hearth Study:
    - Top dark oak cornice beam (fy 0..2)
    - Warm cream-parchment plaster upper half with non-16px oak studs every 44px
    - Moulded oak chair-rail (fy 14..16)
    - Rich recessed oak wainscot paneling below (fy 17..28) + skirting (fy 29..31)
    """
    if fy < 3:
        return [TIMBER[1], TIMBER[4], TIMBER[2]][fy]
    if fy == 3:
        return PLASTER[0]
    if fy < 14:
        stud = (X + 10) % 44
        if stud in (0, 1, 2):
            return [TIMBER[2], TIMBER[4], TIMBER[1]][stud]
        t = 3 if fy > 5 else 2
        if H(X // 3, fy // 2, 91) < 0.16:
            t -= 1
        elif H(X // 2, fy, 97) < 0.08:
            t += 1
        return PLASTER[max(1, min(4, t))]
    if fy == 14:
        return TIMBER[6]
    if fy == 15:
        return TIMBER[3]
    if fy == 16:
        return TIMBER[1]
    if fy >= 29:
        return TIMBER[4] if fy == 29 else (TIMBER[2] if fy == 30 else TIMBER[0])

    # Lower oak wainscot vertical tongue-and-groove / recessed stile rhythm (period 11px, non-16px!)
    bx = (X + 3) % 11
    if bx == 0:
        return TIMBER[4]
    if bx == 10:
        return TIMBER[1]
    if fy in (17, 28):
        return TIMBER[3] if fy == 17 else TIMBER[1]
    if bx in (2, 8) or fy in (18, 27):
        return TIMBER[2] if (bx == 8 or fy == 27) else TIMBER[4]
    return TIMBER[3] if (X + fy) % 7 else TIMBER[2]


FLOOR_FNS: Dict[str, Callable[[int, int], Tuple[int, int, int]]] = {
    "dplank_oak": floor_oak_plank,
    "slate_flag": floor_slate_flag,
    "alchemy_stone": floor_alchemy_stone,
}

WALL_FNS: Dict[str, Callable[[int, int], Tuple[int, int, int]]] = {
    "ashlar_stone": wall_ashlar_stone,
    "study_plaster": wall_study_plaster,
}


# ---------------------------------------------------------------------------
# Derived RM2000 Room Structure Engine (exact `room2.py` algorithm)
# ---------------------------------------------------------------------------
def analyse(plan: Sequence[str]):
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


def render_structure(
    plan: Sequence[str],
    default_floor: str = "dplank_oak",
    default_wall: str = "ashlar_stone",
    zones: Sequence[Tuple[int, int, int, int, Optional[str], Optional[str]]] = (),
) -> Image.Image:
    W, Hh, g, face, top, inn = analyse(plan)

    def mat(cx: int, cy: int) -> Tuple[str, str]:
        f, w = default_floor, default_wall
        for x0, y0, x1, y1, ff, ww in zones:
            if x0 <= cx <= x1 and y0 <= cy <= y1:
                f = ff or f
                w = ww or w
        return f, w

    im = Image.new("RGBA", (W * 16, Hh * 16), VOID + (255,))
    px = im.load()

    for cy in range(Hh):
        for cx in range(W):
            f_name, w_name = mat(cx, cy)
            for ly in range(16):
                for lx in range(16):
                    X, Y = cx * 16 + lx, cy * 16 + ly
                    if g[cy][cx] and face[cy][cx]:
                        fy = ly + (face[cy][cx] - 1) * 16  # 0..31 down the 2-row wall face
                        c = WALL_FNS[w_name](X, fy)
                        # End-column subtle stone/wood pilaster shadow next to solid corner
                        if not inn(cx - 1, cy) and lx == 0:
                            c = mul(c, 0.78)
                        elif not inn(cx + 1, cy) and lx == 15:
                            c = mul(c, 0.78)
                        # Shade under ceiling band overhang (exact room2.py rule)
                        if fy < 4:
                            c = mul(c, 0.62 + 0.08 * fy)
                        px[X, Y] = c + (255,)
                    elif g[cy][cx]:
                        c = FLOOR_FNS[f_name](X, Y)
                        # 3px wall-foot contact shadow (exact room2.py rule)
                        if (face[cy - 1][cx] if cy > 0 else 0) and ly < 3:
                            c = mul(c, 0.60 + 0.12 * ly)
                        px[X, Y] = c + (255,)
                    elif top[cy][cx]:
                        # Ceiling band: quiet dark stone checker + crisp 3px inner carved stone rim on ALL 4 inner sides
                        c = CEIL_CHECKER[(X + Y) % 2]
                        s_in = inn(cx, cy + 1)
                        n_in = inn(cx, cy - 1)
                        w_in = inn(cx - 1, cy)
                        e_in = inn(cx + 1, cy)

                        notch_x = (X % 12 == 0)
                        notch_y = (Y % 12 == 0)
                        if s_in and ly >= 12:
                            if ly == 12:
                                c = RIM_STONE[4] if notch_x else RIM_STONE[5]
                            elif ly == 13:
                                c = RIM_STONE[3] if notch_x else RIM_STONE[4]
                            elif ly == 14:
                                c = RIM_STONE[2]
                            else:
                                c = RIM_STONE[0]
                        if n_in and ly <= 2:
                            if ly == 0:
                                c = RIM_STONE[0]
                            elif ly == 1:
                                c = RIM_STONE[3] if notch_x else RIM_STONE[4]
                            else:
                                c = RIM_STONE[2]
                        if w_in and lx <= 2:
                            if lx == 0:
                                c = RIM_STONE[0]
                            elif lx == 1:
                                c = RIM_STONE[3] if notch_y else RIM_STONE[4]
                            else:
                                c = RIM_STONE[2]
                        if e_in and lx >= 13:
                            if lx == 15:
                                c = RIM_STONE[0]
                            elif lx == 14:
                                c = RIM_STONE[2] if not notch_y else RIM_STONE[1]
                            else:
                                c = RIM_STONE[3]

                        # Outer crisp void edge
                        if (not inn(cx, cy - 1) and not top[cy - 1][cx]) if cy > 0 else True:
                            if ly == 0:
                                c = VOID
                        if (not inn(cx, cy + 1) and not top[cy + 1][cx]) if cy + 1 < Hh else True:
                            if ly == 15 and not s_in:
                                c = VOID
                        px[X, Y] = c + (255,)
                    else:
                        px[X, Y] = VOID + (255,)

    # 6px west-wall soft cast shadow on both face and floor (exact room2.py rule)
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
# Custom Pixel Art Kit: Tabletop Goods, Windows, Tapestry, Carpets & Stairs Up
# ---------------------------------------------------------------------------
GOODS: Dict[str, Image.Image] = {}


def build_tabletop_goods() -> Dict[str, Image.Image]:
    """Crisp miniature tabletop goods designed to composite ON TOP OF Carbon tables."""
    out: Dict[str, Image.Image] = {}

    # 1. Open Illuminated Tome (11x7) - cream parchment pages, gold leaf initial, red/ink rubric lines
    p = Pix(11, 7)
    k = {
        "o": hx("#2d1c12"),
        "r": hx("#8c3938"),
        "R": hx("#b6493e"),
        "p": hx("#e8dcc2"),
        "P": hx("#f7efe0"),
        "s": hx("#c6b496"),
        "g": hx("#efc97b"),
        "i": hx("#56483e"),
        "b": hx("#3fa2ae"),
    }
    p.lit(
        0,
        0,
        [
            " oooo oooo ",
            "oPPPPoPPPPo",
            "oPgbPoPiPio",
            "oPiiPoPiiPo",
            "oPiPPoPrrPo",
            "ossssosssso",
            "rrrrrorrrrr",
        ],
        k,
    )
    out["illuminated_tome"] = p.im

    # 2. Stacked Leather Grimoires (8x7) - sapphire & crimson bound books with gold spine bands
    p = Pix(8, 7)
    k = {
        "o": hx("#1f130b"),
        "b": hx("#264c78"),
        "B": hx("#3f72a8"),
        "r": hx("#7a2828"),
        "R": hx("#a44332"),
        "g": hx("#efc97b"),
        "p": hx("#e4d6b8"),
    }
    p.lit(
        0,
        0,
        [
            " oooooo ",
            "oBBgBBBo",
            "obpppppo",
            "ooooooo ",
            "oRRgRRRo",
            "orpppppo",
            "oooooooo",
        ],
        k,
    )
    out["book_stack"] = p.im

    # 3. Flickering Wax Candlestick (7x10) - brass saucer, ivory wax pillar, bright flame
    p = Pix(7, 10)
    k = {
        "w": hx("#fffbe0"),
        "y": hx("#ffd452"),
        "f": hx("#f08a10"),
        "c": hx("#f0e6d2"),
        "C": hx("#cfc0a6"),
        "g": hx("#efc97b"),
        "G": hx("#bd9056"),
        "d": hx("#60402b"),
        "o": hx("#1f130b"),
    }
    p.lit(
        0,
        0,
        [
            "   w   ",
            "  ywy  ",
            "   f   ",
            "  cCc  ",
            "  cCc  ",
            "  cCc  ",
            "   g   ",
            " ogggo ",
            "oGGGGdo",
            " ooooo ",
        ],
        k,
    )
    out["wax_candle"] = p.im

    # 4. Miniature Brass Celestial Globe / Astrolabe (10x12)
    p = Pix(10, 12)
    for yy in range(1, 8):
        for xx in range(2, 9):
            d = ((xx - 5.0) / 3.2) ** 2 + ((yy - 4.0) / 3.2) ** 2
            if d <= 1.0:
                land = (xx + yy * 2) % 5 in (0, 1)
                if xx <= 4 and yy <= 3:
                    col = hx("#8ee0a0") if land else hx("#84c8ce")
                elif d < 0.65:
                    col = hx("#4e9e60") if land else hx("#3fa2ae")
                else:
                    col = hx("#285838") if land else hx("#24526a")
                p.set(xx, yy, col)
    # Brass meridian arc + finial + turned dark-oak base
    for xx, yy in [(5, 0), (7, 1), (8, 2), (9, 4), (8, 6), (7, 7), (5, 8), (3, 7)]:
        p.set(xx, yy, hx("#efc97b") if yy < 5 else hx("#bd9056"))
    p.set(5, 9, hx("#c9aa64"))
    p.lit(2, 10, ["oGGGGGo", "ooooooo"], {"o": hx("#1f130b"), "G": hx("#805338")})
    out["brass_globe"] = p.im

    # 5. Faceted Inkwell & White Feather Quill (8x8)
    p = Pix(8, 8)
    k = {
        "q": hx("#ffffff"),
        "Q": hx("#d2d8e0"),
        "s": hx("#bd9056"),
        "o": hx("#14121c"),
        "g": hx("#4a586e"),
        "G": hx("#84a0bc"),
        "i": hx("#1e2436"),
    }
    p.lit(
        0,
        0,
        [
            "      qq",
            "     qQ ",
            "    qQ  ",
            "   sQ   ",
            " ogooo  ",
            "oGiiigo ",
            "oiiiiio ",
            " ooooo  ",
        ],
        k,
    )
    out["ink_quill"] = p.im

    # 6. Rolled Parchment Scrolls with Crimson Seal (9x5)
    p = Pix(9, 5)
    k = {
        "o": hx("#2d1c12"),
        "P": hx("#f4ead4"),
        "p": hx("#d8c8a8"),
        "s": hx("#b09c7c"),
        "r": hx("#b63b34"),
        "g": hx("#efc97b"),
    }
    p.lit(
        0,
        0,
        [
            " ooooooo ",
            "oPPPrPPPo",
            "opppgpppo",
            "osssrssso",
            " ooooooo ",
        ],
        k,
    )
    out["scroll_roll"] = p.im

    # 7. Bubbling Emerald Alchemy Flask (7x9)
    p = Pix(7, 9)
    k = {
        "b": hx("#a8ff9e"),
        "B": hx("#5ad86c"),
        "g": hx("#2a9c4a"),
        "d": hx("#16522a"),
        "w": hx("#e0f8ff"),
        "c": hx("#bd9056"),
        "o": hx("#182028"),
    }
    p.lit(
        0,
        0,
        [
            "   b   ",
            "  b B  ",
            "  oco  ",
            "  owo  ",
            " owBgo ",
            "owBBBdo",
            "oBgggdo",
            " odddo ",
            "  ooo  ",
        ],
        k,
    )
    out["bubbling_flask_green"] = p.im

    # 8. Faceted Ruby Elixir Phial (6x8)
    p = Pix(6, 8)
    k = {
        "g": hx("#efc97b"),
        "w": hx("#ffdce0"),
        "R": hx("#e24848"),
        "r": hx("#a4242c"),
        "d": hx("#5e1218"),
        "o": hx("#1c1418"),
    }
    p.lit(
        0,
        0,
        [
            "  gg  ",
            " oggo ",
            "  oo  ",
            " owRo ",
            "owRRro",
            "oRrrdo",
            " oddo ",
            "  oo  ",
        ],
        k,
    )
    out["potion_flask_ruby"] = p.im

    # 9. Copper & Glass Alembic Retort (11x9)
    p = Pix(11, 9)
    k = {
        "o": hx("#1c1822"),
        "c": hx("#d88a48"),
        "C": hx("#f4b870"),
        "d": hx("#8a4e24"),
        "a": hx("#84c8ce"),
        "A": hx("#d4f8fc"),
        "f": hx("#ffd452"),
        "b": hx("#53545a"),
    }
    p.lit(
        0,
        0,
        [
            "  oooo     ",
            " oCCcco    ",
            "oCAaaccoo  ",
            "oCaaadccco ",
            " oddddo cco",
            " obffbo  ao",
            " obffbo oAo",
            " ooooo  ooo",
            "           ",
        ],
        k,
    )
    out["alembic_retort"] = p.im

    # 10. Granite Mortar & Pestle with Glowing Herbs (7x6)
    p = Pix(7, 6)
    k = {
        "w": hx("#d8aa73"),
        "W": hx("#805338"),
        "h": hx("#6cd868"),
        "s": hx("#a6a8a5"),
        "m": hx("#6c6e6d"),
        "d": hx("#37383f"),
        "o": hx("#1c1c26"),
    }
    p.lit(
        0,
        0,
        [
            "     w ",
            "    wW ",
            " oshho ",
            "osmmmmo",
            " odddo ",
            "  ooo  ",
        ],
        k,
    )
    out["mortar_pestle"] = p.im

    return out


@dataclass
class Piece:
    id: str
    im: Image.Image
    fw: int
    fh: int
    up: int = 0
    kind: str = "floor"  # 'floor', 'wall', 'hang', 'flat', 'char'
    surf: Optional[Tuple[int, int, int, int]] = None
    stairs_up: bool = False
    use: Optional[str] = None
    px_offset: Tuple[int, int] = (0, 0)


def make_gothic_lancet_window() -> Piece:
    """16x22 pointed-arch Gothic leaded stained/moonlit window for stone tower walls."""
    p = Pix(16, 22)
    cx = 7.5
    for y in range(1, 19):
        for x in range(2, 14):
            # Pointed Gothic lancet arch profile
            if y < 8:
                half_w = 5.6 - (8 - y) * 0.58
                if abs(x - cx) > half_w:
                    continue
                is_arch_border = abs(x - cx) > half_w - 1.25
            else:
                is_arch_border = x in (2, 13)

            if is_arch_border:
                col = hx("#27282f") if (x > cx and y > 3) else hx("#828292")
                if abs(x - cx) > 4.6 and x in (2, 13):
                    col = hx("#1b1a22")
                p.set(x, y, col)
            else:
                # Leaded diamond/cross tracery + luminous astral blue & warm gold glass
                if x in (7, 8) and y >= 5:
                    p.set(x, y, hx("#27282f") if x == 8 else hx("#404349"))
                elif y in (9, 14):
                    p.set(x, y, hx("#27282f"))
                else:
                    # Warm golden rose/diamond medallion in upper lancet
                    if 4 <= y <= 7 and 6 <= x <= 9:
                        p.set(x, y, hx("#fff2b2") if y <= 5 else hx("#efc97b"))
                    else:
                        glint = (x + y) % 5 == 0
                        if y < 10:
                            p.set(x, y, hx("#c8f0ff") if glint else hx("#68aed4"))
                        elif y < 14:
                            p.set(x, y, hx("#84c8ce") if glint else hx("#4682ad"))
                        else:
                            p.set(x, y, hx("#4682ad") if glint else hx("#2d587e"))
    # Protruding carved stone sill at y=19..21
    for x in range(1, 15):
        p.set(x, 19, hx("#b8b8c6") if 1 < x < 14 else hx("#27282f"))
        p.set(x, 20, hx("#6b6b7a") if 1 < x < 14 else hx("#1b1a22"))
        p.set(x, 21, hx("#1b1a22"))
    return Piece("gothic_lancet_window", p.im, 1, 0, 0, "hang")


def make_study_mullion_window() -> Piece:
    """16x13 warm oak-framed leaded window that fits cleanly inside `face == 1` above bookshelves."""
    p = Pix(16, 13)
    for y in range(0, 10):
        for x in range(2, 14):
            if x in (2, 13) or y == 0:
                p.set(x, y, hx("#2d1c12"))
            elif x == 3 or y == 1:
                p.set(x, y, hx("#bd9056"))
            elif x == 12 or y == 9:
                p.set(x, y, hx("#60402b"))
            elif x in (7, 8) or y == 5:
                p.set(x, y, hx("#805338") if x == 7 else hx("#442c19"))
            else:
                glint = (x - y) in (1, 2)
                p.set(x, y, hx("#fff4cc") if glint else (hx("#8cc8e8") if y < 5 else hx("#5896bd")))
    # Oak sill (y=10..12)
    for x in range(1, 15):
        p.set(x, 10, hx("#efc97b") if 1 < x < 14 else hx("#2d1c12"))
        p.set(x, 11, hx("#805338") if 1 < x < 14 else hx("#1f130b"))
        p.set(x, 12, hx("#1f130b"))
    return Piece("study_mullion_window", p.im, 1, 0, 0, "hang")


def make_star_chart_tapestry() -> Piece:
    """32x22 framed celestial star-chart tapestry for the North Astral Apse."""
    p = Pix(32, 22)
    # Brass hanging rod with finials
    for x in range(1, 31):
        p.set(x, 0, hx("#efc97b") if x in (1, 2, 29, 30) or x % 6 == 0 else hx("#bd9056"))
    for y in range(1, 20):
        for x in range(2, 30):
            if x in (2, 29) or y in (1, 19):
                c = hx("#1f130b")
            elif x in (3, 28) or y in (2, 18):
                c = hx("#c9aa64") if (x == 3 or y == 2) else hx("#805338")
            else:
                # Deep midnight indigo astral field
                d = math.hypot((x - 15.5) / 10.5, (y - 10.0) / 7.2)
                if abs(d - 0.78) < 0.09:
                    c = hx("#a6874c")  # golden ecliptic circle
                elif d < 0.78:
                    c = hx("#18244a") if (x + y) % 3 else hx("#131d3d")
                else:
                    c = hx("#101730")
            p.set(x, y, c)
    # Constellation lines
    pts = [(7, 6), (11, 5), (15, 8), (19, 6), (23, 9), (20, 13), (14, 14), (9, 12)]
    for (x0, y0), (x1, y1) in [(pts[0], pts[1]), (pts[1], pts[2]), (pts[2], pts[3]), (pts[3], pts[4]), (pts[2], pts[6]), (pts[6], pts[7])]:
        for s in range(1, 8):
            xx = int(round(x0 + (x1 - x0) * s / 8.0))
            yy = int(round(y0 + (y1 - y0) * s / 8.0))
            p.set(xx, yy, hx("#4f7cb6"))
    for xx, yy in pts:
        p.set(xx, yy, hx("#fff6c4"))
    # Crescent moon in upper-right quadrant
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            if dx * dx + dy * dy <= 4 and (dx + 1) ** 2 + dy * dy > 2:
                p.set(24 + dx, 5 + dy, hx("#efc97b"))
    # Crimson & gold bottom tassels
    for x in range(3, 29):
        p.set(x, 20, hx("#c9aa64") if x % 2 == 0 else hx("#8c3938"))
        if x % 4 == 1:
            p.set(x, 21, hx("#efc97b"))
    return Piece("star_chart_tapestry", p.im, 2, 0, 0, "hang")


def make_wall_potion_rack() -> Piece:
    """16x13 hanging oak reagent shelf for Alchemy Lab `face == 1`."""
    p = Pix(16, 13)
    for x in range(1, 15):
        p.set(x, 9, hx("#bd9056"))
        p.set(x, 10, hx("#60402b"))
        p.set(x, 11, hx("#1f130b"))
    p.set(3, 12, hx("#442c19"))
    p.set(12, 12, hx("#442c19"))
    bottles = [
        (2, hx("#5ad86c"), hx("#1e7836")),
        (6, hx("#e24848"), hx("#8c1d24")),
        (9, hx("#efc97b"), hx("#9a6e20")),
        (12, hx("#68c4e8"), hx("#28668c")),
    ]
    for bx, hi, lo in bottles:
        top_y = 3 if bx in (6, 12) else 4
        p.set(bx, top_y, hx("#d8aa73"))
        for yy in range(top_y + 1, 9):
            p.set(bx, yy, hi if yy <= top_y + 2 else lo)
            p.set(bx + 1, yy, lo)
    return Piece("wall_potion_rack", p.im, 1, 0, 0, "hang")


def make_chimney_overmantel() -> Piece:
    """32x14 carved stone chimney breast with a gilded framed portrait/crest for `face == 1` above stone_fireplace_lit."""
    p = Pix(32, 14)
    for y in range(0, 14):
        for x in range(3, 29):
            if x in (3, 28):
                c = hx("#27282f")
            elif x in (4, 27):
                c = hx("#828382") if x == 4 else hx("#404349")
            else:
                ly = y % 5
                lx = (x + (4 if (y // 5) % 2 else 0)) % 8
                if ly == 4 or lx == 7:
                    c = hx("#37383f")
                else:
                    c = hx("#828382") if ly == 0 else hx("#6c6e6d")
            p.set(x, y, c)
    # Small gilded arcane crest / miniature frame in the centre of the chimney breast
    for y in range(2, 11):
        for x in range(10, 22):
            if x in (10, 21) or y in (2, 10):
                p.set(x, y, hx("#2d1c12"))
            elif x in (11, 20) or y in (3, 9):
                p.set(x, y, hx("#efc97b") if (x == 11 or y == 3) else hx("#a6874c"))
            else:
                p.set(x, y, hx("#6b2c2b") if (x + y) % 2 else hx("#421b1d"))
    p.set(15, 6, hx("#efc97b"))
    p.set(16, 6, hx("#84c8ce"))
    return Piece("chimney_overmantel", p.im, 2, 0, 0, "hang")


def make_wall_sconce() -> Piece:
    """16x14 wrought-iron wall torch sconce with warm amber flame."""
    p = Pix(16, 14)
    k = {
        "w": hx("#fffbe0"),
        "y": hx("#ffd452"),
        "f": hx("#f08a10"),
        "r": hx("#c84420"),
        "i": hx("#828382"),
        "I": hx("#404349"),
        "o": hx("#1c1c26"),
    }
    p.lit(
        4,
        1,
        [
            "   w    ",
            "  ywy   ",
            "  fyf   ",
            "   r    ",
            " oiiio  ",
            "  oIo   ",
            "  oIo   ",
            " ooIoo  ",
            "  oIo   ",
            "   o    ",
        ],
        k,
    )
    return Piece("wall_sconce", p.im, 1, 0, 0, "hang")


def make_stairs_up_stone(wc: int = 3) -> Piece:
    """
    SKILL.md hard rule:
    Stairs up: against a NORTH wall, 3 wide (48x48), covering the first floor row + both face rows,
    climbing into the wall (treads lit, risers shaded, stone side rails, dark vaulted landing at top).
    """
    W = wc * 16
    Hh = 48
    p = Pix(W, Hh)
    step_ramp = [
        hx("#181620"),  # 0: deep shadow
        hx("#282634"),  # 1: dark riser
        hx("#3a3848"),  # 2: mid-dark riser
        hx("#4e4d5e"),  # 3: shaded tread
        hx("#666578"),  # 4: mid tread
        hx("#807f92"),  # 5: lit tread
        hx("#9c9bae"),  # 6: bright front tread lip
    ]
    for y in range(Hh):
        for x in range(W):
            # Stone side balustrades / cheeks (5px wide each side)
            if x < 5 or x >= W - 5:
                lx = x if x < 5 else (W - 1 - x)
                if lx == 0:
                    c = hx("#1b1a22")
                elif lx == 4:
                    c = hx("#9c9bae") if x < 5 else hx("#3a3848")
                elif lx == 1:
                    c = hx("#807f92") if x < 5 else hx("#4e4d5e")
                else:
                    c = hx("#666578")
                if y % 8 == 7:
                    c = hx("#282634")  # masonry joint on cheek
                if y < 3:
                    c = hx("#282634") if y > 0 else hx("#181620")
                p.set(x, y, c)
                continue

            # Dark vaulted upper landing recessed into the north wall (y=0..8)
            if y < 9:
                arch_dx = abs(x - (W - 1) / 2.0)
                if y < 3 and arch_dx > (W / 2 - 7):
                    p.set(x, y, hx("#282634"))
                else:
                    p.set(x, y, hx("#141218") if y < 7 else step_ramp[1])
                continue

            # 4px steps: 2px lit tread + 2px shaded riser, progressively darkening northward
            k = (y - 9) % 4
            step_idx = (y - 9) // 4  # 0 at top (north) .. 9 at bottom (south)
            depth_shade = max(0, 3 - step_idx // 3)
            if k == 0:
                t = 6
            elif k == 1:
                t = 5 if (x + y) % 7 else 4
            elif k == 2:
                t = 2 if (x + y) % 2 == 0 else 3
            else:
                t = 1
            t = max(1, t - depth_shade)
            # Contact shadow right beside the stone cheeks
            if x in (5, 6, W - 6):
                t = max(1, t - (2 if x in (5, W - 6) else 1))
            # Subtle block joint along wide treads
            if k in (0, 1) and (x + step_idx * 7) % 15 == 0:
                t = max(1, t - 1)
            p.set(x, y, step_ramp[t])

    return Piece("stairs_up_stone", p.im, wc, 1, 32, "wall", stairs_up=True)


def make_crimson_rug(wc: int, hc: int, runner: bool = False, green_study: bool = False) -> Piece:
    """
    9-slice style woven bordered carpet (matching Carbon's arcane_rune_rug palette,
    following SKILL.md 0b rule 6: crisp border ramp + quiet lit centre, zero noisy full-surface dither!).
    For `runner=True`, leaves a 4px slate-flagstone reveal on left & right so the corridor stones breathe!
    """
    W, Hh = wc * 16, hc * 16
    p = Pix(W, Hh)
    margin_x = 4 if runner else 2
    margin_y_top = 4 if runner else 2
    margin_y_bot = 0 if runner else 2
    x0, y0, x1, y1 = margin_x, margin_y_top, W - 1 - margin_x, Hh - 1 - margin_y_bot

    if green_study:
        c_out = hx("#14241b")
        c_dark = hx("#1f3d2d")
        c_mid = hx("#2b5640")
        c_lit = hx("#35684e")
    else:
        c_out = hx("#2a1114")
        c_dark = hx("#521f22")
        c_mid = hx("#782e2f")
        c_lit = hx("#923a36")
    c_gold_hi = hx("#efc97b")
    c_gold_mid = hx("#c9aa64")
    c_gold_lo = hx("#8f733e")

    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            ex = min(x - x0, x1 - x)
            e = min(ex, y - y0) if runner else min(ex, min(y - y0, y1 - y))

            if e == 0:
                col = c_out
            elif e == 1:
                col = c_gold_hi if (x + y) % 2 == 0 else c_gold_mid
            elif e == 2:
                col = c_dark
            elif e == 3:
                col = c_gold_lo if (x + y) % 2 == 0 else c_mid
            else:
                col = c_lit
                # Subtle woven diamond medallion every 16px along centreline
                if runner:
                    ly = y % 16
                    d = abs(x - (W - 1) / 2.0) + abs(ly - 7.5)
                    if 2.4 <= d <= 3.6:
                        col = c_gold_mid
                    elif d < 1.4:
                        col = c_dark
                else:
                    cx, cy = (W - 1) / 2.0, (Hh - 1) / 2.0
                    d = abs(x - cx) / max(1.0, (cx - 5)) + abs(y - cy) / max(1.0, (cy - 5))
                    if 0.62 <= d <= 0.72:
                        col = c_gold_mid
                    elif d < 0.25:
                        col = c_gold_hi if abs(x - cx) + abs(y - cy) < 2.2 else c_dark
            p.set(x, y, col)

    # Subtle gold fringe on north end of runner and north/south ends of area rugs
    for x in range(x0 + 2, x1 - 1, 2):
        p.set(x, y0 - 1, c_gold_mid)
        if not runner:
            p.set(x, y1 + 1, c_gold_lo)

    rid = "crimson_runner" if runner else ("emerald_reading_rug" if green_study else "crimson_hearth_rug")
    return Piece(rid, p.im, wc, hc, 0, "flat")


def load_carbon_catalog() -> Dict[str, Piece]:
    """Loads all 20 Carbon Medium sprites with exact RM2000 footprint/up/surface definitions."""
    def ld(name: str) -> Image.Image:
        return Image.open(CARBON_OBJ_DIR / f"{name}.png").convert("RGBA")

    cat: Dict[str, Piece] = {
        # Wall pieces (stand on first floor row `y`, overlap `face == 2` by 16px)
        "bookshelf_tall_full": Piece("bookshelf_tall_full", ld("bookshelf_tall_full"), 2, 1, 16, "wall"),
        "grimoire_cabinet": Piece("grimoire_cabinet", ld("grimoire_cabinet"), 2, 1, 16, "wall"),
        "bookshelf_scroll_rack": Piece("bookshelf_scroll_rack", ld("bookshelf_scroll_rack"), 1, 1, 16, "wall"),
        "potion_alembic_shelf": Piece("potion_alembic_shelf", ld("potion_alembic_shelf"), 2, 1, 16, "wall"),
        "stone_fireplace_lit": Piece("stone_fireplace_lit", ld("stone_fireplace_lit"), 2, 1, 16, "wall"),
        # Wall hanging (spans 2-row wall face)
        "wall_banner_crimson": Piece("wall_banner_crimson", ld("wall_banner_crimson"), 1, 0, 0, "hang"),
        # Tables with calibrated surface rects (x0, y0, x1, y1) for tabletop goods!
        "reading_table_long": Piece("reading_table_long", ld("reading_table_long"), 3, 1, 0, "floor", surf=(4, 2, 44, 9)),
        "study_table_round": Piece("study_table_round", ld("study_table_round"), 2, 2, 0, "floor", surf=(6, 6, 26, 19)),
        "alchemy_workbench": Piece("alchemy_workbench", ld("alchemy_workbench"), 2, 1, 0, "floor", surf=(3, 2, 29, 8)),
        # Seating
        "oak_study_chair": Piece("oak_study_chair", ld("oak_study_chair"), 1, 1, 0, "floor"),
        "wooden_stool": Piece("wooden_stool", ld("wooden_stool"), 1, 1, 0, "floor"),
        # Centerpieces, lighting, pedestals & storage
        "brass_orrery_stand": Piece("brass_orrery_stand", ld("brass_orrery_stand"), 2, 1, 16, "floor"),
        "alchemy_cauldron_hearth": Piece("alchemy_cauldron_hearth", ld("alchemy_cauldron_hearth"), 2, 1, 16, "floor"),
        "wooden_crates_stack": Piece("wooden_crates_stack", ld("wooden_crates_stack"), 2, 1, 16, "floor"),
        "gilded_lectern_tome": Piece("gilded_lectern_tome", ld("gilded_lectern_tome"), 1, 1, 16, "floor"),
        "scrying_crystal_pedestal": Piece("scrying_crystal_pedestal", ld("scrying_crystal_pedestal"), 1, 1, 16, "floor"),
        "brass_candelabra": Piece("brass_candelabra", ld("brass_candelabra"), 1, 1, 16, "floor"),
        "oak_barrel_hooped": Piece("oak_barrel_hooped", ld("oak_barrel_hooped"), 1, 1, 0, "floor"),
        "treasure_chest_bound": Piece("treasure_chest_bound", ld("treasure_chest_bound"), 1, 1, 0, "floor"),
        # Flat rug
        "arcane_rune_rug": Piece("arcane_rune_rug", ld("arcane_rune_rug"), 3, 2, 0, "flat"),
    }

    # Custom architectural hangings, rugs, and north-wall stone staircase
    cat["gothic_lancet_window"] = make_gothic_lancet_window()
    cat["study_mullion_window"] = make_study_mullion_window()
    cat["chimney_overmantel"] = make_chimney_overmantel()
    cat["star_chart_tapestry"] = make_star_chart_tapestry()
    cat["wall_potion_rack"] = make_wall_potion_rack()
    cat["wall_sconce"] = make_wall_sconce()
    cat["stairs_up_stone"] = make_stairs_up_stone(3)
    cat["crimson_hearth_rug"] = make_crimson_rug(4, 2, runner=False)
    cat["emerald_reading_rug"] = make_crimson_rug(5, 3, runner=False, green_study=True)
    cat["crimson_runner"] = make_crimson_rug(2, 14, runner=True)

    # Beodeul 1x scale character (88x100 -> 22x25 via NEAREST)
    ch4 = Image.open(CHAR_REF_4X).convert("RGBA")
    ch1 = ch4.resize((ch4.width // 4, ch4.height // 4), Image.NEAREST)
    cpx = ch1.load()
    for yy in range(ch1.height):
        for xx in range(ch1.width):
            if cpx[xx, yy][3] < 128:
                cpx[xx, yy] = (0, 0, 0, 0)
    cat["beodeul_char"] = Piece("beodeul_char", ch1, 1, 1, 9, "char", px_offset=(-3, 0))

    return cat


# ---------------------------------------------------------------------------
# Stepped Octagonal Tower + Asymmetric Lower Wings + South Vestibule Plan
# ---------------------------------------------------------------------------
# Grid: 28 cols (x=0..27) x 24 rows (y=0..23) = 448x384 px (1x), 896x768 px (2x)
PLAN: List[str] = [
    # 0123456789012345678901234567
    "############################",  # 00: North void / apse ceiling cap
    "#########..........#########",  # 01: Central Astral Apse (x=9..18, face=1)
    "######................######",  # 02: Octagon step 1 (x=6..21)
    "####....................####",  # 03: Octagon step 2 (x=4..23; apse floor starts x=9..18)
    "###......................###",  # 04: Octagon step 3 (x=3..24)
    "###......................###",  # 05: Octagon upper belly
    "###......................###",  # 06: Octagon main hall
    "###......................###",  # 07: Octagon main hall
    "####....................####",  # 08: Octagon lower taper 1 (x=3,24 '#' inner stone rim!)
    "######................######",  # 09: Octagon lower taper 2 (x=4..5,22..23 '#' inner stone rim!)
    "#############..#############",  # 10: Thick '#' stone partition + 2-wide Grand Archway (x=13..14)
    "####........#..#.........###",  # 11: SW Hearth Study (x=4..11, face=1) | Corridor | SE Alchemy+Stairs (x=16..24, face=1)
    "##..........#..#.........###",  # 12: SW stepped nook (x=2..3, face=1) | Corridor | SE (x=16..24, face=2)
    "##.............#..........##",  # 13: Doorways open x=12 & x=15 (face=1 lintel); SE Storeroom steps out x=25..26 (face=1)
    "##........................##",  # 14: Doorways x=12 & x=15 (face=2 lintel); SE Storeroom x=25..26 (face=2)
    "##........................##",  # 15: Walkable cross-axis through both arched side doorways (y=15..16)!
    "##........................##",  # 16: Walkable cross-axis + full room interiors
    "####........#..#..........##",  # 17: SW stepped nook closes x=2..3; doorways close x=12,15; SE runs x=16..25
    "#############..###........##",  # 18: SW Study south wall '#'; Corridor continues x=13..14; SE steps in to x=18..25
    "###########......#####....##",  # 19: Protruding South Vestibule opens x=11..16 (face=1); SE Storeroom nook x=22..25
    "###########......###########",  # 20: South Vestibule (face=2 on 11..12, 15..16); SE Storeroom south wall '#'
    "###########......###########",  # 21: South Vestibule walkable hall row 1 (x=11..16)
    "###########......###########",  # 22: South Vestibule walkable hall row 2 (x=11..16)
    "#############..#############",  # 23: Grand Entrance Threshold (x=13..14) flanked by '#' stone caps
]


def build_scene_spec(cat: Dict[str, Piece]):
    # Zone overrides: (x0, y0, x1, y1, floor_or_None, wall_or_None)
    zones = [
        # Central Vaulted Corridor & Protruding South Entrance Vestibule: irregular slate flagstones + ashlar stone
        (11, 10, 16, 23, "slate_flag", "ashlar_stone"),
        # Doorway thresholds at x=12 and x=15: slate flagstones + ashlar stone lintel
        (12, 13, 12, 16, "slate_flag", "ashlar_stone"),
        (15, 13, 15, 16, "slate_flag", "ashlar_stone"),
        # South-West Cozy Hearth Study (strictly behind x=12 partition!): dark weathered oak planks + timber-plaster walls
        (2, 11, 11, 17, "dplank_oak", "study_plaster"),
        # South-East Fire-Safe Alchemy Lab & Storeroom (SKILL.md 0e rule: stone floor + stone walls around cauldron fire!)
        (16, 11, 26, 19, "alchemy_stone", "ashlar_stone"),
    ]

    # Window coordinates (wx, wy) where `wy` is the `face == 1` cell -> casts slanted warm sunbeam on floor below
    lights = [
        (11, 1),  # West Gothic lancet window in Astral Apse
        (16, 1),  # East Gothic lancet window in Astral Apse
        (4, 3),   # Far-west stepped octagon window
        (23, 3),  # Far-east stepped octagon window
        (4, 11),  # Hearth Study west mullion window
        (9, 11),  # Hearth Study east mullion window
    ]

    # Warm hearth/fire floor glow sources: (center_px_x, center_px_y, radius_px, strength)
    glows = [
        (7 * 16, 13 * 16 + 14, 40, 0.28),   # Roaring stone fireplace in SW Hearth Study
        (19 * 16, 15 * 16 + 12, 30, 0.16),  # Firebox under bubbling cauldron in SE Alchemy Lab
    ]

    # Items list: (Piece, cell_x, cell_y, optional_tabletop_goods_list[(good_name, fx, fy)], optional_px_shift)
    items = [
        # ===================================================================
        # 0. FLAT WOVEN CARPETS (walkable, drawn directly over floor)
        # ===================================================================
        # Half-tile centered (+8px) arcane rune rug framing the 2-wide Brass Orrery in the Astral Apse!
        (cat["arcane_rune_rug"], 12, 5, (), (8, 0)),
        # 5x3 woven emerald & gold scholar rug anchoring the West Reading Bay (like scholar.png!)
        (cat["emerald_reading_rug"], 5, 6, ()),
        # Continuous 2-wide crimson & gold corridor runner with 4px slate reveal on each side (y=10..23)
        (cat["crimson_runner"], 13, 10, ()),
        # 4x2 woven crimson & gold hearth rug in front of the roaring fireplace in SW Study
        (cat["crimson_hearth_rug"], 5, 14, ()),

        # ===================================================================
        # 1. UPPER STEPPED OCTAGONAL ASTRAL LIBRARY ROTUNDA (y=1..9)
        # ===================================================================
        # Central Astral Apse north wall hangings (y=1, x=9..18)
        (cat["wall_banner_crimson"], 9, 1, ()),
        (cat["gothic_lancet_window"], 11, 1, ()),
        (cat["star_chart_tapestry"], 13, 1, ()),
        (cat["gothic_lancet_window"], 16, 1, ()),
        (cat["wall_banner_crimson"], 18, 1, ()),

        # Central Apse focal point: Brass Orrery on plinth + flanking Scrying Crystal Pedestals
        (cat["brass_orrery_stand"], 13, 4, ()),
        (cat["scrying_crystal_pedestal"], 10, 4, ()),
        (cat["scrying_crystal_pedestal"], 17, 4, ()),

        # Stepped Octagon Alcove Bookshelves & Grimoire Cabinets (flush against `face == 2`!)
        # Step 1 alcoves (floor row y=4, x=6..8 & x=19..21)
        (cat["bookshelf_tall_full"], 6, 4, ()),
        (cat["bookshelf_scroll_rack"], 8, 4, ()),
        (cat["bookshelf_scroll_rack"], 19, 4, ()),
        (cat["grimoire_cabinet"], 20, 4, ()),

        # Step 2 alcoves (y=3 `face==1` lancet windows + y=5 floor row)
        (cat["gothic_lancet_window"], 4, 3, ()),
        (cat["gothic_lancet_window"], 23, 3, ()),
        (cat["bookshelf_scroll_rack"], 5, 5, ()),
        (cat["bookshelf_scroll_rack"], 22, 5, ()),

        # Step 3 outer cheeks (floor row y=6 at x=3 & x=24)
        (cat["brass_candelabra"], 3, 6, ()),
        (cat["brass_candelabra"], 24, 6, ()),

        # West Reading Bay (x=5..10, y=6..8): Long Reading Table WITH Open Illuminated Tome, Stack, Quill & Candle!
        (cat["oak_study_chair"], 6, 6, ()),
        (cat["oak_study_chair"], 8, 6, ()),
        (
            cat["reading_table_long"],
            6,
            7,
            [
                ("book_stack", 0.16, 0.72),
                ("illuminated_tome", 0.48, 0.85),
                ("ink_quill", 0.72, 0.65),
                ("wax_candle", 0.88, 0.62),
            ],
        ),
        (cat["wooden_stool"], 7, 8, ()),
        (cat["gilded_lectern_tome"], 10, 7, ()),

        # East Astral Cartography Bay (x=17..22, y=6..9): Round Study Table WITH Brass Globe, Scrolls & Candle!
        (
            cat["study_table_round"],
            19,
            7,
            [
                ("brass_globe", 0.34, 0.62),
                ("scroll_roll", 0.70, 0.82),
                ("wax_candle", 0.68, 0.38),
            ],
        ),
        (cat["wooden_stool"], 18, 7, ()),
        (cat["wooden_stool"], 21, 7, ()),
        (cat["gilded_lectern_tome"], 17, 7, ()),

        # Archway flanking brass candelabra & rare-tome chest along south tapered walls
        (cat["brass_candelabra"], 11, 9, ()),
        (cat["brass_candelabra"], 16, 9, ()),
        (cat["treasure_chest_bound"], 9, 9, ()),
        (cat["treasure_chest_bound"], 21, 9, ()),

        # ===================================================================
        # 2. SOUTH-WEST COZY TIMBER-AND-PLASTER HEARTH STUDY (x=2..11, y=11..17)
        # ===================================================================
        # North wall (`face==1` at y=11 on x=4..11, `face==2` at y=12, first floor row y=13)
        (cat["study_mullion_window"], 4, 11, ()),
        (cat["chimney_overmantel"], 6, 11, ()),
        (cat["study_mullion_window"], 9, 11, ()),
        (cat["bookshelf_tall_full"], 4, 13, ()),
        (cat["stone_fireplace_lit"], 6, 13, ()),
        (cat["bookshelf_tall_full"], 8, 13, ()),
        (cat["bookshelf_scroll_rack"], 11, 13, ()),
        # Stepped NW Reading Alcove (`face==1` at y=12 on x=2..3, `face==2` at y=13, first floor row y=14)
        (cat["wall_sconce"], 2, 12, ()),
        (cat["grimoire_cabinet"], 2, 14, ()),

        # Cozy Hearth Study Tables & Chairs (tucked close, rich tabletop goods!)
        (cat["oak_study_chair"], 5, 15, ()),
        (
            cat["reading_table_long"],
            4,
            16,
            [
                ("brass_globe", 0.18, 0.68),
                ("illuminated_tome", 0.52, 0.86),
                ("wax_candle", 0.84, 0.60),
            ],
        ),
        (cat["wooden_stool"], 4, 17, ()),
        # Fireside Round Study Table next to Hearth Rug
        (
            cat["study_table_round"],
            8,
            15,
            [
                ("illuminated_tome", 0.38, 0.72),
                ("ink_quill", 0.72, 0.58),
            ],
        ),
        (cat["wooden_stool"], 10, 16, ()),
        (cat["brass_candelabra"], 11, 17, ()),

        # ===================================================================
        # 3. SOUTH-EAST FIRE-SAFE STONE ALCHEMY LAB & STOREROOM (x=16..26, y=11..19)
        # ===================================================================
        # North wall (`face==1` at y=11 on x=16..24, first floor row y=13):
        # Symmetric wall sconces + reagent rack + alembic shelves + 3-WIDE NORTH-WALL STONE STAIRCASE UP!
        (cat["wall_sconce"], 16, 11, ()),
        (cat["wall_potion_rack"], 18, 11, ()),
        (cat["wall_sconce"], 21, 11, ()),
        (cat["potion_alembic_shelf"], 16, 13, ()),
        (cat["bookshelf_scroll_rack"], 18, 13, ()),
        (cat["potion_alembic_shelf"], 19, 13, ()),
        (cat["stairs_up_stone"], 22, 13, ()),  # Covers x=22..24, y=11..13 (both face rows + 1st floor row)!

        # Central Bubbling Cauldron Hearth (fire-safe stone floor & walls!)
        (cat["alchemy_cauldron_hearth"], 18, 15, ()),

        # Twin Stone-Slab Alchemy Workbenches WITH Flasks, Retort, Mortar & Scrolls ON TOP!
        (
            cat["alchemy_workbench"],
            16,
            17,
            [
                ("bubbling_flask_green", 0.22, 0.72),
                ("potion_flask_ruby", 0.50, 0.78),
                ("mortar_pestle", 0.80, 0.84),
            ],
        ),
        (cat["wooden_stool"], 18, 17, ()),
        (
            cat["alchemy_workbench"],
            20,
            17,
            [
                ("alembic_retort", 0.34, 0.82),
                ("scroll_roll", 0.78, 0.80),
            ],
        ),
        (cat["wooden_stool"], 20, 18, ()),

        # Stepped SE Corner Storeroom Nook (`face==1` at y=13 on x=25..26, floor y=15..19)
        (cat["wall_sconce"], 25, 13, ()),
        (cat["wooden_crates_stack"], 24, 15, ()),
        (cat["oak_barrel_hooped"], 25, 17, ()),
        (cat["oak_barrel_hooped"], 25, 18, ()),
        (cat["treasure_chest_bound"], 23, 19, ()),
        (cat["oak_barrel_hooped"], 25, 19, ()),

        # ===================================================================
        # 4. PROTRUDING SOUTH ENTRANCE VESTIBULE (x=11..16, y=19..23)
        # ===================================================================
        (cat["wall_sconce"], 11, 19, ()),
        (cat["wall_banner_crimson"], 12, 19, ()),
        (cat["wall_banner_crimson"], 15, 19, ()),
        (cat["wall_sconce"], 16, 19, ()),
        (cat["brass_candelabra"], 11, 22, ()),
        (cat["brass_candelabra"], 16, 22, ()),

        # ===================================================================
        # 5. BEODEUL SCALE CHARACTERS (22x25 1x scale reference)
        # ===================================================================
        (cat["beodeul_char"], 11, 6, ()),   # Astral Library Rotunda by Lectern & Orrery
        (cat["beodeul_char"], 6, 15, ()),   # Cozy Hearth Study warming by the fire
        (cat["beodeul_char"], 19, 16, ()),  # Alchemy Lab tending the bubbling cauldron
    ]

    rooms = [
        ("Astral Library Rotunda", 13, 7),
        ("Cozy Hearth Study", 6, 14),
        ("Fire-Safe Alchemy Lab & Storeroom", 22, 15),
        ("South Entrance Vestibule & Corridor", 13, 21),
    ]

    return {
        "plan": PLAN,
        "floor": "dplank_oak",
        "wall": "ashlar_stone",
        "zones": zones,
        "lights": lights,
        "glows": glows,
        "items": items,
        "rooms": rooms,
        "start": [(13, 23), (14, 23)],
    }


# ---------------------------------------------------------------------------
# Scene Compositor (with headroom for tall tabletop goods + sunbeams + hearth glow)
# ---------------------------------------------------------------------------
def item_draw_rect(f: Piece, x: int, y: int, px_shift: Tuple[int, int] = (0, 0)) -> Tuple[int, int, int, int]:
    dx, dy = f.px_offset[0] + px_shift[0], f.px_offset[1] + px_shift[1]
    if f.kind == "hang":
        X0, Y0 = x * 16 + dx, y * 16 + 2 + dy
    elif f.kind == "flat":
        X0, Y0 = x * 16 + dx, y * 16 + dy
    else:
        X0, Y0 = x * 16 + dx, y * 16 - f.up + dy
    return (X0, Y0, X0 + f.im.width, Y0 + f.im.height)


def compose_scene(spec: dict, goods_lib: Dict[str, Image.Image]) -> Image.Image:
    base = render_structure(spec["plan"], spec["floor"], spec["wall"], spec["zones"])
    W_px, H_px = base.size
    px = base.load()
    W_c, H_c, g, face, top, inn = analyse(spec["plan"])

    # 1. Slanted warm window sunlight shafts on the floor below each window (`room2.py` / `room4.py`)
    for wx, wy in spec.get("lights", ()):
        y_start = (wy + 2) * 16
        y_end = (wy + 4) * 16 + 6
        for Y in range(y_start, min(H_px, y_end)):
            dy = Y - y_start
            sh = dy // 3
            fade = max(0.0, 1.0 - dy / 42.0)
            for X in range(wx * 16 + 2 + sh, wx * 16 + 14 + sh):
                if 0 <= X < W_px:
                    cx, cy = X // 16, Y // 16
                    if g[cy][cx] and not face[cy][cx]:
                        r, gg, b, a = px[X, Y]
                        px[X, Y] = (
                            min(255, int(r * (1.0 + 0.22 * fade) + 12 * fade)),
                            min(255, int(gg * (1.0 + 0.19 * fade) + 10 * fade)),
                            min(255, int(b * (1.0 + 0.10 * fade) + 5 * fade)),
                            a,
                        )

    # 2. Draw flat carpets first, then apply warm fireplace/cauldron floor glow over floor + rug!
    draw_flat = []
    draw_main = []
    HEADROOM = 12  # Extra top pixels so tall candlesticks & globes on 16px tables never clip!

    for it in spec["items"]:
        f, x, y = it[0], it[1], it[2]
        on = it[3] if len(it) > 3 else ()
        px_shift = it[4] if len(it) > 4 else (0, 0)
        X0, Y0, _, _ = item_draw_rect(f, x, y, px_shift)

        if f.kind == "flat":
            draw_flat.append((0, f.im, X0, Y0))
            continue

        if on and f.surf is not None:
            layer = Image.new("RGBA", (f.im.width, f.im.height + HEADROOM), (0, 0, 0, 0))
            layer.alpha_composite(f.im, (0, HEADROOM))
            sx0, sy0, sx1, sy1 = f.surf
            # Sort tabletop goods back-to-front by fy
            for g_name, fx, fy in sorted(on, key=lambda item: item[2]):
                gi = goods_lib[g_name]
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

    for _, im_f, X, Y in draw_flat:
        base.alpha_composite(im_f, (X, Y))

    # Subtle warm hearth glow on floor & rug in front of fireplace and cauldron
    px = base.load()
    for gx, gy, rad, strength in spec.get("glows", ()):
        for Y in range(max(0, gy - rad), min(H_px, gy + rad)):
            for X in range(max(0, gx - rad), min(W_px, gx + rad)):
                cx, cy = X // 16, Y // 16
                if g[cy][cx] and not face[cy][cx]:
                    dist = math.hypot(X - gx, (Y - gy) * 1.25)
                    if dist < rad:
                        k = ((1.0 - dist / rad) ** 1.6) * strength
                        r, gg, b, a = px[X, Y]
                        px[X, Y] = (
                            min(255, int(r + 75 * k)),
                            min(255, int(gg + 38 * k)),
                            min(255, int(b + 8 * k)),
                            a,
                        )

    for _, im_m, X, Y in sorted(draw_main, key=lambda d: d[0]):
        base.alpha_composite(im_m, (X, Y))

    return base


# ---------------------------------------------------------------------------
# Automated Architectural & Walkability Verification (modeled on `room4.py`)
# ---------------------------------------------------------------------------
def verify_architecture(spec: dict) -> dict:
    plan = spec["plan"]
    W, Hh, g, face, top, inn = analyse(plan)
    floor = [[g[y][x] and not face[y][x] for x in range(W)] for y in range(Hh)]

    def fl(x: int, y: int) -> bool:
        return 0 <= x < W and 0 <= y < Hh and floor[y][x]

    occ: Dict[Tuple[int, int], str] = {}
    issues: List[str] = []

    # 1. Footprint validity & non-overlap
    for it in spec["items"]:
        f, x, y = it[0], it[1], it[2]
        if f.kind in ("floor", "wall"):
            for yy in range(y, y + f.fh):
                for xx in range(x, x + f.fw):
                    if not fl(xx, yy) and not f.stairs_up:
                        issues.append(f"{f.id} @({x},{y}) footprint cell ({xx},{yy}) is not walkable floor")
                    if (xx, yy) in occ:
                        issues.append(f"{f.id} @({x},{y}) overlaps {occ[(xx, yy)]} at ({xx},{yy})")
                    occ[(xx, yy)] = f.id
            if f.stairs_up:
                # Stairs up must cover face==1 (y-2), face==2 (y-1), and first floor row (y)
                for xx in range(x, x + f.fw):
                    if not (y >= 2 and face[y - 2][xx] == 1 and face[y - 1][xx] == 2 and fl(xx, y)):
                        issues.append(f"stairs_up {f.id} @({x},{y}) col {xx} not against north 2-row wall + floor")

    # 2. BFS walkability from entrance
    walk = [[fl(x, y) and (x, y) not in occ for x in range(W)] for y in range(Hh)]
    starts = [tuple(s) for s in spec.get("start", ()) if walk[s[1]][s[0]]]
    seen = set(starts)
    q = list(starts)
    while q:
        cx, cy = q.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < W and 0 <= ny < Hh and walk[ny][nx] and (nx, ny) not in seen:
                seen.add((nx, ny))
                q.append((nx, ny))

    # Every non-occupied floor cell MUST be reachable (0 trapped pockets!)
    trapped = []
    for y in range(Hh):
        for x in range(W):
            if walk[y][x] and (x, y) not in seen:
                trapped.append((x, y))
    if trapped:
        issues.append(f"Trapped unreachable floor cells ({len(trapped)}): {trapped[:8]}")

    # Check Beodeul characters stand on reachable walkable cells
    for it in spec["items"]:
        f, x, y = it[0], it[1], it[2]
        if f.kind == "char" and (x, y) not in seen:
            issues.append(f"Character {f.id} @({x},{y}) is not on a reachable walkable cell")

    # 3. Doorway & narrow passage clearance check
    def ins(x: int, y: int) -> bool:
        return 0 <= y < Hh and 0 <= x < len(plan[y]) and plan[y][x] != "#"

    passages = set()
    # E-W partition doorway gaps (<= 2 cols wide)
    for y in range(1, Hh):
        x = 0
        while x < W:
            if ins(x, y) and not ins(x - 1, y):
                x0 = x
                while x < W and ins(x, y):
                    x += 1
                if x - x0 <= 2 and not ins(x, y) and all(ins(xx, y - 1) and (y == Hh - 1 or ins(xx, y + 1)) for xx in range(x0, x)):
                    for xx in range(x0, x):
                        for yy in range(y, min(Hh, y + 3)):
                            if fl(xx, yy) and not (fl(x0 - 1, yy) or fl(x, yy)):
                                passages.add((xx, yy))
            else:
                x += 1
    # N-S partition doorway gaps (<= 4 rows tall through a solid '#' column separating two rooms)
    for x in range(1, W - 1):
        y = 0
        while y < Hh:
            if ins(x, y) and not ins(x, y - 1):
                y0 = y
                while y < Hh and ins(x, y):
                    y += 1
                if (
                    y - y0 <= 4
                    and not ins(x, y)
                    and not ins(x, y0 - 1)
                    and ins(x - 1, y0 - 1)
                    and ins(x + 1, y0 - 1)
                    and any(fl(x - 1, yy) and fl(x + 1, yy) for yy in range(y0, y))
                ):
                    for yy in range(y0, y):
                        if fl(x, yy):
                            passages.add((x, yy))
            else:
                y += 1

    must_clear = set(passages) | set(starts)
    for px_c, py_c in list(passages):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if fl(px_c + dx, py_c + dy):
                must_clear.add((px_c + dx, py_c + dy))
    for c in sorted(must_clear):
        if c in occ:
            issues.append(f"Doorway/corridor clearance cell {c} blocked by {occ[c]}")

    # 4. Named room reachability
    room_reports = []
    for r_name, rx, ry in spec.get("rooms", ()):
        reached = (rx, ry) in seen
        room_reports.append({"room": r_name, "anchor": [rx, ry], "reached": reached})
        if not reached:
            issues.append(f"Room '{r_name}' anchor ({rx},{ry}) not reached by BFS")

    # 5. Every interactive/furniture piece has a reachable use-cell!
    uses_ok = 0
    uses_total = 0
    for it in spec["items"]:
        f, x, y = it[0], it[1], it[2]
        if f.kind in ("hang", "flat", "char"):
            continue
        uses_total += 1
        fp = [(xx, yy) for yy in range(y, y + f.fh) for xx in range(x, x + f.fw)]
        south = [(xx, y + f.fh) for xx in range(x, x + f.fw)]
        around = [
            (ax + dx, ay + dy)
            for ax, ay in fp
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
            if (ax + dx, ay + dy) not in fp
        ]
        target = south if (f.kind == "wall" or f.stairs_up) else around
        # Also allow reaching via an adjacent chair/stool next to a table
        ok = any(c in seen for c in target) or any(
            c in occ
            and occ[c] in ("oak_study_chair", "wooden_stool")
            and any((c[0] + dx, c[1] + dy) in seen for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            for c in target
        )
        if ok:
            uses_ok += 1
        else:
            issues.append(f"{f.id} @({x},{y}) has no reachable adjacent use-cell")

    # 6. Wall backing, hanging placement on `face == 1`, and bbox non-overlap
    hang_boxes = []
    tall_boxes = []
    for it in spec["items"]:
        f, x, y = it[0], it[1], it[2]
        px_shift = it[4] if len(it) > 4 else (0, 0)
        X0, Y0, X1, Y1 = item_draw_rect(f, x, y, px_shift)
        bb = f.im.getbbox() or (0, 0, f.im.width, f.im.height)
        box = (X0 + bb[0], Y0 + bb[1], X0 + bb[2], Y0 + bb[3])
        if f.kind == "hang":
            for xx in range(x, x + f.fw):
                if not (0 <= y < Hh and g[y][xx] and face[y][xx] == 1):
                    issues.append(f"Hanging {f.id} @({x},{y}) col {xx} is not on upper wall face (face==1)")
            hang_boxes.append((f"{f.id}@({x},{y})", box))
        elif f.kind == "wall":
            if not f.stairs_up:
                for xx in range(x, x + f.fw):
                    if not (y > 0 and face[y - 1][xx] == 2):
                        issues.append(f"Wall furniture {f.id} @({x},{y}) col {xx} is not flush against north wall (face==2)")
            tall_boxes.append((f"{f.id}@({x},{y})", box))
        elif f.up > 0:
            tall_boxes.append((f"{f.id}@({x},{y})", box))

    def overlaps(a, b) -> bool:
        return a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]

    for i, (na, ba) in enumerate(hang_boxes):
        for nb, bb in hang_boxes[i + 1 :]:
            if overlaps(ba, bb):
                issues.append(f"Hangings overlap: {na} vs {nb}")
        for nb, bb in tall_boxes:
            if overlaps(ba, bb):
                issues.append(f"Hanging {na} occluded by tall piece {nb}")

    # 7. Continuous wall single-material rule (SKILL.md 0e)
    def wmat(cx: int, cy: int) -> str:
        w = spec["wall"]
        for x0, y0, x1, y1, _, ww in spec.get("zones", ()):
            if x0 <= cx <= x1 and y0 <= cy <= y1 and ww:
                w = ww
        return w

    for y in range(Hh):
        x = 0
        while x < W:
            if g[y][x] and face[y][x] == 1:
                x0 = x
                mats = set()
                while x < W and g[y][x] and face[y][x] == 1:
                    mats.add(wmat(x, y))
                    x += 1
                if len(mats) > 1:
                    issues.append(f"Mixed wall materials along continuous wall ({x0}..{x-1}, {y}): {sorted(mats)}")
            else:
                x += 1

    # 8. Verify all 20 Carbon Medium sprites are used
    carbon_20 = {p.stem for p in CARBON_OBJ_DIR.glob("*.png")}
    used_ids = {it[0].id for it in spec["items"]}
    missing_carbon = sorted(carbon_20 - used_ids)
    if missing_carbon:
        issues.append(f"Unused Carbon Medium sprites: {missing_carbon}")

    total_floor = sum(sum(1 for c in row if c) for row in floor)
    occupied_cells = len(occ)

    return {
        "ok": len(issues) == 0,
        "issues": issues,
        "grid_size_cells": [W, Hh],
        "pixel_size_1x": [W * 16, Hh * 16],
        "pixel_size_2x": [W * 32, Hh * 32],
        "floor_cells_total": total_floor,
        "occupied_floor_cells": occupied_cells,
        "reachable_walk_cells": len(seen),
        "furniture_uses": f"{uses_ok}/{uses_total}",
        "carbon_sprites_used": f"{len(carbon_20 - set(missing_carbon))}/{len(carbon_20)}",
        "tabletop_goods_placed": sum(len(it[3]) for it in spec["items"] if len(it) > 3),
        "doorway_clear_cells_checked": len(must_clear),
        "rooms": room_reports,
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    goods_lib = build_tabletop_goods()
    cat = load_carbon_catalog()
    spec = build_scene_spec(cat)

    report = verify_architecture(spec)
    print(json.dumps(report, indent=2, ensure_ascii=False))
    if not report["ok"]:
        raise SystemExit(f"Architecture verification FAILED with {len(report['issues'])} issues!")

    im_1x = compose_scene(spec, goods_lib)
    out_1x = OUT_DIR / "map_wizard_library_v2.png"
    out_2x = OUT_DIR / "map_wizard_library_v2_2x.png"
    out_report = OUT_DIR / "verification_report.json"

    im_1x.save(out_1x)
    im_2x = im_1x.resize((im_1x.width * 2, im_1x.height * 2), Image.NEAREST)
    im_2x.save(out_2x)
    out_report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Saved: {out_1x} ({im_1x.size[0]}x{im_1x.size[1]})")
    print(f"Saved: {out_2x} ({im_2x.size[0]}x{im_2x.size[1]})")


if __name__ == "__main__":
    main()
