#!/usr/bin/env python3
"""
Rebuild modern_pcbang Map Architecture v2
- Non-rectangular organic multi-room plan (~30x22 cells) inside #141622 void
- True derived RM2000 walls & ceiling rims (room2.py algorithm: 2-tone dark checker cap +
  3px beveled steel-slate inner rim on all 4 room-facing edges + 32px 2-row wall faces +
  3px north-wall foot contact shadow + 6px west-wall soft cast shadow)
- World-coordinate quiet floors (zero 16x16 grid banding) & 32px world-coord wall painters
- Reuses all 20 Carbon Medium object sprites + palette-locked miniature tabletop goods
- Automated BFS walkability, north-wall furniture rule, overlap, & doorway-clearance checks
"""

from __future__ import annotations

import json
import math
import os
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from PIL import Image

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
CARBON_DIR = ROOT / "tiledata/dungeon-dots/modern_pcbang_carbon"
OBJ_DIR = CARBON_DIR / "objects"
TILE_DIR = CARBON_DIR / "tiles"
PALETTE_PATH = ROOT / "tiledata/dungeon-pilot/_dots_kit_refs/modern_palette_v3.json"
CHAR_REF_PATH = ROOT / "tiledata/dungeon-pilot/_dots_kit_refs/ref_mod1_char.png"
OUT_DIR = ROOT / "tiledata/dungeon-arch-v2/modern_pcbang"


def hx(s: str) -> tuple[int, int, int]:
    s = s.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))


def mul(c: tuple[int, int, int], k: float) -> tuple[int, int, int]:
    return (
        max(0, min(255, int(round(c[0] * k)))),
        max(0, min(255, int(round(c[1] * k)))),
        max(0, min(255, int(round(c[2] * k)))),
    )


def H(x: int, y: int, seed: int = 0) -> float:
    h = (x * 374761393 + y * 668265263 + seed * 1442695041) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return (h & 0xFFFF) / 65535.0


# Load locked v3 palette & verify colors
PAL_DATA = json.loads(PALETTE_PATH.read_text())
PAL_SET = {hx(c) for c in PAL_DATA["all_colors"]}
SHADOW_RGBA = tuple(PAL_DATA["shadow_rgba"])  # (76, 85, 127, 85)


def P(hex_code: str) -> tuple[int, int, int]:
    c = hx(hex_code)
    assert c in PAL_SET, f"Color {hex_code} not in modern_palette_v3.json!"
    return c


VOID = P("#141622")
# Whisper-quiet 2-tone dark stone ceiling cap (matches scholar.png/pharmacy.png calm cap)
CEIL_PAIR = ((24, 26, 39), (29, 31, 46))
# Steel-slate beveled ceiling rim (cool_slate_gray ramp)
RIM_DARK = P("#141622")
RIM_SHAD = P("#4e5062")
RIM_MID = P("#707282")
RIM_LIT = P("#9698a4")
RIM_HI = P("#bec0c8")


# ---------------------------------------------------------------------------
# 1. World-Coordinate Quiet Floor Painters (4-5 low-contrast tones, zero 16px grid)
# ---------------------------------------------------------------------------
OAK_SEAM = P("#69311a")
OAK_DARK = P("#86472c")
OAK_A = P("#a77950")
OAK_B = P("#b77246")
OAK_HI = P("#ce805b")


def floor_cafe_oak(x: int, y: int) -> tuple[int, int, int]:
    """Staggered 5px-high warm oak boards; joints every 38px (never aligned to 16px)."""
    row = y // 5
    ly = y % 5
    if ly == 4:
        return OAK_SEAM
    off = int(H(row, 3, 63) * 38)
    if (x + off) % 38 == 0:
        return OAK_SEAM
    seg = (x + off) // 38
    base = OAK_A if H(row, seg, 64) < 0.52 else OAK_B
    if ly == 0:
        return OAK_HI if base == OAK_B else OAK_B
    if H(x // 4, y, 65) < 0.05:
        return OAK_DARK
    return base


SLATE_GROUT = P("#707282")
SLATE_BASE = P("#9698a4")
SLATE_ALT = P("#bec0c8")


def floor_lobby_terrazzo(x: int, y: int) -> tuple[int, int, int]:
    """Large-format 24x14 staggered cool-slate terrazzo slabs with subtle 1-step grout."""
    sy = y // 14
    off = 12 if (sy % 2) else 0
    lx = (x + off) % 24
    ly = y % 14
    if ly == 13 or lx == 23:
        return SLATE_GROUT
    sx = (x + off) // 24
    if ly == 0 and lx < 22 and H(sx, sy, 71) < 0.65:
        return SLATE_ALT
    f = H(x, y, 72)
    if f < 0.022:
        return SLATE_ALT
    if f > 0.982:
        return SLATE_GROUT
    return SLATE_BASE


CARP_0 = P("#141622")
CARP_1 = P("#111c2e")
CARP_2 = P("#182c50")
CARP_ACC = P("#1c3772")


def floor_pc_carpet(x: int, y: int) -> tuple[int, int, int]:
    """Deep quiet charcoal-navy woven acoustic carpet so glowing monitors & chairs pop."""
    sy = y // 12
    off = 6 if (sy % 2) else 0
    lx = (x + off) % 12
    ly = y % 12
    if ly == 6 and lx in (5, 6):
        return CARP_ACC
    if (lx == 0 or ly == 0) and (x + y) % 2 == 0:
        return CARP_0
    weave = (x // 2 + y // 2) % 2
    return CARP_2 if weave == 0 else CARP_1


ARC_0 = P("#112e2a")
ARC_1 = P("#11272e")
ARC_2 = P("#184150")
ARC_ACC = P("#18504a")


def floor_arcade_teal(x: int, y: int) -> tuple[int, int, int]:
    """Rich dark teal geometric lounge floor (14x14 world diamond motif, quiet)."""
    lx = x % 14
    ly = y % 14
    d = abs(lx - 6.5) + abs(ly - 6.5)
    if 3.8 <= d <= 4.8 and (x + y) % 2 == 0:
        return ARC_ACC
    if d < 1.6:
        return ARC_2
    return ARC_1 if ((x // 2 + y // 2) % 2 == 0) else ARC_0


FLOORFN: dict[str, Callable[[int, int], tuple[int, int, int]]] = {
    "cafe_oak": floor_cafe_oak,
    "lobby_terrazzo": floor_lobby_terrazzo,
    "pc_carpet": floor_pc_carpet,
    "arcade_teal": floor_arcade_teal,
}


# ---------------------------------------------------------------------------
# 2. World-Coordinate 32px Wall Painters (X, fy in 0..31; zero 16px seams)
# ---------------------------------------------------------------------------
def wall_cafe_wood(X: int, fy: int) -> tuple[int, int, int]:
    """Upper warm cream plaster with timber posts every 44px + lower vertical oak slats."""
    if fy >= 29:
        return P("#411e06") if fy == 29 else P("#2e1a11") if fy == 30 else P("#141622")
    if fy in (14, 15):
        return P("#d99350") if fy == 14 else P("#69311a")
    if fy < 14:
        # Timber post every 44px (world X)
        px_mod = (X + 10) % 44
        if px_mod in (0, 1, 2):
            return [P("#69311a"), P("#b77246"), P("#411e06")][px_mod]
        t = P("#fad6b4") if H(X // 3, fy // 2, 101) < 0.72 else P("#e6aa82")
        if fy == 13:
            t = P("#be7c5c")
        return t
    # Lower vertical oak slats (5px period in world X)
    sx = X % 5
    if sx == 0:
        c = P("#69311a")
    elif sx == 1:
        c = P("#ce805b") if fy < 22 else P("#b77246")
    elif sx in (2, 3):
        c = P("#b77246") if H(X // 5, fy // 4, 102) < 0.65 else P("#a77950")
    else:
        c = P("#86472c")
    return mul(c, 0.88) if fy >= 24 else c


def wall_pc_slate(X: int, fy: int) -> tuple[int, int, int]:
    """Architectural dark-cool slate panels (28px wide) + recessed cyan LED trim + dark dado."""
    if fy >= 29:
        return P("#4e5062") if fy == 29 else P("#141622")
    if fy in (17, 18, 19):
        if fy == 17:
            return P("#141622")
        if fy == 18:
            return P("#29b6b6") if (X % 18 != 0) else P("#1c726c")
        return P("#184150")
    if fy < 17:
        lx = (X + 7) % 28
        if lx == 0:
            return P("#2e3040")
        if lx == 1:
            return P("#9698a4")
        c = P("#707282") if H(X // 4, fy // 3, 111) < 0.78 else P("#4e5062")
        return c
    # Lower acoustic dark slate dado (fy 20..28)
    lx = X % 8
    if lx == 0:
        return P("#141622")
    return P("#2e3040") if lx < 6 else P("#4e5062")


def wall_foyer_slate(X: int, fy: int) -> tuple[int, int, int]:
    """Brighter architectural concrete panels in reception foyer + brushed steel dado rail."""
    if fy >= 29:
        return P("#4e5062") if fy == 29 else P("#141622")
    if fy in (17, 18):
        return P("#e2e4e8") if fy == 17 else P("#4e5062")
    if fy < 17:
        lx = (X + 5) % 26
        if lx == 0:
            return P("#4e5062")
        if lx == 1:
            return P("#bec0c8")
        return P("#9698a4") if H(X // 4, fy // 3, 121) < 0.75 else P("#707282")
    lx = (X + 5) % 13
    if lx == 0:
        return P("#2e3040")
    return P("#4e5062") if fy < 26 else P("#2e3040")


def wall_arcade_neon(X: int, fy: int) -> tuple[int, int, int]:
    """Cool slate upper panels + neon magenta accent line + deep indigo lower dado."""
    if fy >= 29:
        return P("#2e3040") if fy == 29 else P("#141622")
    if fy in (17, 18, 19):
        if fy == 17:
            return P("#141622")
        if fy == 18:
            return P("#d85b8f") if (X % 16 != 0) else P("#9329b6")
        return P("#501840")
    if fy < 17:
        lx = (X + 3) % 24
        if lx == 0:
            return P("#2e3040")
        if lx == 1:
            return P("#707282")
        return P("#4e5062") if H(X // 4, fy // 3, 131) < 0.8 else P("#2e3040")
    lx = X % 6
    return P("#141622") if lx == 0 else P("#211850") if lx < 4 else P("#2e3040")


def wall_vip_lounge(X: int, fy: int) -> tuple[int, int, int]:
    """Plush VIP lounge wall: warm slate upper + brushed brass rail + deep navy wainscoting."""
    if fy >= 29:
        return P("#2e3040") if fy == 29 else P("#141622")
    if fy in (16, 17):
        return P("#d8b55b") if fy == 16 else P("#72461c")
    if fy < 16:
        lx = (X + 4) % 22
        if lx == 0:
            return P("#2e3040")
        if lx == 1:
            return P("#9698a4")
        return P("#707282") if H(X // 3, fy // 3, 141) < 0.72 else P("#4e5062")
    lx = X % 10
    if lx in (0, 9):
        return P("#111c2e")
    if lx == 1 or fy == 18:
        return P("#1c3772")
    return P("#182c50")


FACEFN: dict[str, Callable[[int, int], tuple[int, int, int]]] = {
    "cafe_wood": wall_cafe_wood,
    "pc_slate": wall_pc_slate,
    "foyer_slate": wall_foyer_slate,
    "arcade_neon": wall_arcade_neon,
    "vip_lounge": wall_vip_lounge,
}


# ---------------------------------------------------------------------------
# 3. Derived Structure Engine (room2.py exact logic + beveled steel-slate rim)
# ---------------------------------------------------------------------------
def analyse(plan: list[str]):
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
        [
            (not g[y][x])
            and any(inn(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1))
            for x in range(W)
        ]
        for y in range(Hh)
    ]
    return W, Hh, g, face, top, inn


def render_structure(
    plan: list[str],
    default_floor: str,
    default_wall: str,
    zones: list[tuple[int, int, int, int, str | None, str | None]],
) -> Image.Image:
    W, Hh, g, face, top, inn = analyse(plan)

    def mat(cx: int, cy: int) -> tuple[str, str]:
        f, w = default_floor, default_wall
        for x0, y0, x1, y1, ff, ww in zones:
            if x0 <= cx <= x1 and y0 <= cy <= y1:
                if ff:
                    f = ff
                if ww:
                    w = ww
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
                        fy = ly + (face[cy][cx] - 1) * 16
                        c = FACEFN[w_name](X, fy)
                        # Crisp vertical end-post when a wall face borders an open doorway floor cell
                        left_open = inn(cx - 1, cy) and face[cy][cx - 1] == 0
                        right_open = inn(cx + 1, cy) and face[cy][cx + 1] == 0
                        if left_open and lx < 2:
                            c = RIM_DARK if lx == 0 else RIM_LIT
                        elif right_open and lx >= 14:
                            c = RIM_DARK if lx == 15 else RIM_SHAD
                        # Shade under ceiling band (room2.py: fy < 4)
                        if fy < 4:
                            c = mul(c, 0.62 + 0.08 * fy)
                        px[X, Y] = c + (255,)
                    elif g[cy][cx]:
                        c = FLOORFN[f_name](X, Y)
                        # 3px contact shadow at the north wall foot (room2.py exact)
                        if (face[cy - 1][cx] if cy > 0 else 0) and ly < 3:
                            c = mul(c, 0.60 + 0.12 * ly)
                        px[X, Y] = c + (255,)
                    elif top[cy][cx]:
                        # Quiet dark 2-tone checker ceiling cap
                        c = CEIL_PAIR[(X + Y) % 2]
                        s_in = inn(cx, cy + 1)
                        n_in = inn(cx, cy - 1)
                        w_in = inn(cx - 1, cy)
                        e_in = inn(cx + 1, cy)

                        # 3px beveled steel-slate inner rim along all 4 room-facing edges
                        if s_in and ly >= 12:
                            c = (
                                RIM_HI
                                if ly == 12
                                else RIM_LIT
                                if ly == 13
                                else RIM_SHAD
                                if ly == 14
                                else RIM_DARK
                            )
                        if n_in and ly <= 2:
                            c = RIM_DARK if ly == 0 else RIM_HI if ly == 1 else RIM_SHAD
                        if w_in and lx <= 2:
                            c = RIM_DARK if lx == 0 else RIM_HI if lx == 1 else RIM_MID
                        if e_in and lx >= 13:
                            c = RIM_DARK if lx == 15 else RIM_SHAD if lx == 14 else RIM_LIT

                        # Clean outer void boundary on exterior edges
                        if (not inn(cx, cy - 1) and not (top[cy - 1][cx] if cy > 0 else False)) and ly == 0 and not n_in:
                            c = VOID
                        if (not inn(cx, cy + 1) and not (top[cy + 1][cx] if cy + 1 < Hh else False)) and ly == 15 and not s_in:
                            c = VOID
                        if (not inn(cx - 1, cy) and not (top[cy][cx - 1] if cx > 0 else False)) and lx == 0 and not w_in:
                            c = VOID
                        if (not inn(cx + 1, cy) and not (top[cy][cx + 1] if cx + 1 < W else False)) and lx == 15 and not e_in:
                            c = VOID

                        px[X, Y] = c + (255,)
                    else:
                        px[X, Y] = VOID + (255,)

    # 6px soft west-wall cast shadow along east side of every solid west mass (room2.py exact)
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
# 4. Sprite Loader, Hanging Extractors, Flat Rugs/Thresholds & Tabletop Goods
# ---------------------------------------------------------------------------
@dataclass
class Piece:
    id: str
    kind: str  # 'wall', 'floor', 'seat', 'hang', 'flat', 'char'
    im: Image.Image
    fw: int
    fh: int
    up: int = 0
    dx: int = 0
    dy: int = 0
    surf: tuple[int, int, int, int] | None = None
    role: str = "prop"


def add_ground_shadow(im: Image.Image) -> Image.Image:
    """Subtle 1px contact shadow using locked #4c557f@85 under standing/floor furniture."""
    out = Image.new("RGBA", (im.width, im.height + 1), (0, 0, 0, 0))
    px = im.load()
    opx = out.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][3] > 128 and y >= im.height - 4:
                if y + 1 < out.height and opx[x, y + 1][3] == 0:
                    opx[x, y + 1] = SHADOW_RGBA
    out.alpha_composite(im, (0, 0))
    return out


def load_carbon_objects() -> dict[str, Piece]:
    objs: dict[str, Piece] = {}
    specs = {
        # Wall furniture (MUST sit at north wall foot: face[y-1][x] == 2)
        "arcade_cabinet_blue": ("wall", 1, 1, 16, None),
        "arcade_cabinet_red": ("wall", 1, 1, 16, None),
        "claw_crane_machine": ("wall", 2, 1, 16, None),
        "coin_changer": ("wall", 1, 1, 16, None),
        "vending_machine_drinks": ("wall", 2, 1, 16, None),
        "drink_fridge_glass": ("wall", 1, 1, 16, None),
        "ramen_cooker_counter": ("wall", 2, 1, 16, None),
        "snack_shelf_rack": ("wall", 2, 1, 16, None),
        "storage_locker": ("wall", 1, 1, 16, None),
        "server_rack": ("wall", 1, 1, 16, None),
        # Floor & seating furniture
        "pc_station_blue": ("floor", 2, 1, 16, None),
        "pc_station_red": ("floor", 2, 1, 16, None),
        "gaming_chair_blue": ("seat", 1, 1, 0, None),
        "gaming_chair_red": ("seat", 1, 1, 0, None),
        "pos_counter_desk": ("floor", 3, 1, 16, (25, 11, 45, 15)),
        "cafe_table_oak": ("floor", 2, 1, 0, (2, 2, 30, 10)),
        "cafe_stool": ("seat", 1, 1, 0, None),
        "vip_sofa_navy": ("seat", 2, 1, 0, None),
        "standing_floor_lamp": ("floor", 1, 1, 16, None),
        "trash_recycle_bin": ("floor", 1, 1, 0, None),
    }
    for name, (kind, fw, fh, up, surf) in specs.items():
        raw = Image.open(OBJ_DIR / f"{name}.png").convert("RGBA")
        objs[name] = Piece(id=name, kind=kind, im=raw, fw=fw, fh=fh, up=up, surf=surf)
    assert len(objs) == 20, f"Expected all 20 Carbon objects, got {len(objs)}"
    return objs


def load_hangings() -> dict[str, Piece]:
    """Extract clean framed hangings from Carbon tiles by stripping wall_face_upper background."""
    w_up = Image.open(TILE_DIR / "wall_face_upper.png").convert("RGBA")
    hangs: dict[str, Piece] = {}
    for key, fname, x_pad in [
        ("window_night", "wall_window_night.png", 1),
        ("neon_sign", "wall_neon_sign.png", 1),
        ("ac_unit", "wall_ac_unit.png", 1),
        ("game_poster", "wall_game_poster.png", 2),
    ]:
        src = Image.open(TILE_DIR / fname).convert("RGBA")
        clean = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        spx, wpx, cpx = src.load(), w_up.load(), clean.load()
        for y in range(16):
            for x in range(x_pad, 16 - x_pad):
                if spx[x, y] != wpx[x, y]:
                    cpx[x, y] = spx[x, y]
        hangs[key] = Piece(id=key, kind="hang", im=clean, fw=1, fh=1)
    return hangs


def make_vip_rug(w_cells: int, h_cells: int) -> Piece:
    """Plush framed burgundy/indigo VIP lounge rug (locked to modern_palette_v3.json)."""
    W, Hh = w_cells * 16, h_cells * 16
    im = Image.new("RGBA", (W, Hh), (0, 0, 0, 0))
    px = im.load()
    c_out = P("#14112e")
    c_gold = P("#d8b55b")
    c_gold_d = P("#94601b")
    c_body0 = P("#2e1128")
    c_body1 = P("#501840")
    c_loz = P("#721c53")
    for y in range(Hh):
        for x in range(W):
            if x in (0, W - 1) or y in (0, Hh - 1):
                c = c_out
            elif x in (1, W - 2) or y in (1, Hh - 2):
                c = c_gold if (x + y) % 2 == 0 else c_gold_d
            elif x in (3, W - 4) or y in (3, Hh - 4):
                c = c_gold_d
            else:
                lx, ly = (x - 4) % 12, (y - 4) % 12
                d = abs(lx - 5.5) + abs(ly - 5.5)
                if 2.5 <= d <= 3.6:
                    c = c_loz
                elif d < 1.2:
                    c = c_gold_d
                else:
                    c = c_body1 if ((x // 2 + y // 2) % 2 == 0) else c_body0
            px[x, y] = c + (255,)
    return Piece(id="vip_rug", kind="flat", im=im, fw=w_cells, fh=h_cells)


def make_entrance_mat(w_cells: int, h_cells: int) -> Piece:
    """Ribbed crimson-slate commercial entrance runner mat."""
    W, Hh = w_cells * 16, h_cells * 16
    im = Image.new("RGBA", (W, Hh), (0, 0, 0, 0))
    px = im.load()
    c_out = P("#141622")
    c_frm = P("#2e3040")
    c_rib0 = P("#501825")
    c_rib1 = P("#721c28")
    c_rib_hi = P("#941b23")
    for y in range(2, Hh - 2):
        for x in range(2, W - 2):
            if x in (2, W - 3) or y in (2, Hh - 3):
                c = c_out
            elif x in (3, W - 4) or y in (3, Hh - 4):
                c = c_frm
            else:
                ry = y % 3
                c = c_rib0 if ry == 0 else (c_rib_hi if ry == 1 and x % 4 != 0 else c_rib1)
            px[x, y] = c + (255,)
    return Piece(id="entrance_mat", kind="flat", im=im, fw=w_cells, fh=h_cells)


def make_threshold_h(w_cells: int, warm: bool = False) -> Piece:
    """Horizontal doorway threshold strip where two floor zones meet."""
    W = w_cells * 16
    im = Image.new("RGBA", (W, 16), (0, 0, 0, 0))
    px = im.load()
    c0 = P("#411e06") if warm else P("#2e3040")
    c1 = P("#d99350") if warm else P("#bec0c8")
    c2 = P("#94461b") if warm else P("#707282")
    for x in range(W):
        px[x, 0] = c0 + (255,)
        px[x, 1] = (c1 if x % 8 != 0 else c2) + (255,)
        px[x, 2] = c2 + (255,)
        px[x, 3] = c0 + (255,)
    return Piece(id="threshold_h", kind="flat", im=im, fw=w_cells, fh=1)


def make_threshold_v(h_cells: int) -> Piece:
    """Vertical doorway threshold strip in N-S partition passages."""
    Hh = h_cells * 16
    im = Image.new("RGBA", (16, Hh), (0, 0, 0, 0))
    px = im.load()
    c0, c1, c2 = P("#2e3040"), P("#bec0c8"), P("#707282")
    for y in range(Hh):
        px[6, y] = c0 + (255,)
        px[7, y] = (c1 if y % 8 != 0 else c2) + (255,)
        px[8, y] = c2 + (255,)
        px[9, y] = c0 + (255,)
    return Piece(id="threshold_v", kind="flat", im=im, fw=1, fh=h_cells)


# Miniature tabletop goods (100% locked to modern_palette_v3.json)
def _grid_sprite(rows: list[str], cmap: dict[str, str]) -> Image.Image:
    h = len(rows)
    w = max(len(r) for r in rows)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != ".":
                px[x, y] = P(cmap[ch]) + (255,)
    return im


GOODS: dict[str, Image.Image] = {
    # Steaming spicy ramen bowl + chopsticks resting across
    "ramen_bowl": _grid_sprite(
        [
            "..s..s....",
            ".s....s...",
            ".cccccccc.",
            ".rwwwwwwr.",
            "rooyggyoor",
            ".rrrrrrrr.",
            "..dddddd..",
        ],
        {
            "s": "#e2e4e8",
            "c": "#d99350",
            "r": "#b62b29",
            "w": "#fafaf8",
            "o": "#d88c5b",
            "y": "#fae79a",
            "g": "#61d85b",
            "d": "#2e1119",
        },
    ),
    # Iced Americano cup with straw
    "iced_coffee": _grid_sprite(
        [
            "...g.",
            "..gg.",
            ".wwww",
            ".wccw",
            ".mkcm",
            ".mkkm",
            "..dd.",
        ],
        {
            "g": "#61d85b",
            "w": "#e2e4e8",
            "c": "#fad6b4",
            "m": "#86472c",
            "k": "#411e06",
            "d": "#141622",
        },
    ),
    # Crimson cola can
    "cola_can": _grid_sprite(
        [
            ".ss.",
            "rrrr",
            "rwwr",
            "rrrr",
            "dddd",
        ],
        {"s": "#e2e4e8", "r": "#b62b29", "w": "#fafaf8", "d": "#2e1119"},
    ),
    # Cyan energy drink can
    "energy_can": _grid_sprite(
        [
            ".ss.",
            "cccc",
            "caac",
            "cccc",
            "dddd",
        ],
        {"s": "#e2e4e8", "c": "#1b9490", "a": "#9af4fa", "d": "#112e2a"},
    ),
    # Golden fried snack / takoyaki tray
    "snack_tray": _grid_sprite(
        [
            ".yy.yy..",
            "tooyyoot",
            "tttttttt",
            ".dddddd.",
        ],
        {"y": "#fae79a", "o": "#d88c5b", "t": "#4e5062", "d": "#141622"},
    ),
    # Cup ramen
    "cup_ramen": _grid_sprite(
        [
            ".yyyy.",
            ".wwww.",
            ".rrrr.",
            ".wwww.",
            "..dd..",
        ],
        {"y": "#d8b55b", "w": "#fafaf8", "r": "#b62b29", "d": "#707282"},
    ),
}


def load_characters() -> dict[str, Piece]:
    """Downscale ref_mod1_char.png 3x -> 1x (24x32) + subtle palette-locked hair/jacket swaps."""
    src = Image.open(CHAR_REF_PATH).convert("RGBA")
    ch1x = src.resize((24, 32), Image.NEAREST)

    def recolor_char(im: Image.Image, mode: str) -> Image.Image:
        out = im.copy()
        px = out.load()
        for y in range(out.height):
            for x in range(out.width):
                r, g, b, a = px[x, y]
                if a < 128:
                    continue
                if mode == "clerk":
                    # Crisp teal-cyan staff vest accent on tie/jacket
                    if r > 130 and g < 60 and b < 60:
                        px[x, y] = P("#29b6b6") + (255,)
                elif mode == "arcade":
                    # Warm crimson varsity jacket swap on navy blazer pixels
                    if b > r + 18 and y >= 19 and y <= 26:
                        px[x, y] = (P("#941b23") if b > 65 else P("#501825")) + (255,)
                elif mode == "vip":
                    # Indigo-gold jacket accent
                    if r > 130 and g < 60 and b < 60:
                        px[x, y] = P("#d8b55b") + (255,)
        return out

    chars = {}
    for k in ("student", "clerk", "arcade", "vip"):
        cim = ch1x if k == "student" else recolor_char(ch1x, k)
        # 24px wide centered on a 16px cell -> dx = -4, up = 16 (feet in cell y)
        chars[k] = Piece(id=f"char_{k}", kind="char", im=cim, fw=1, fh=1, up=16, dx=-4, dy=0)
    return chars


# ---------------------------------------------------------------------------
# 5. Architectural Plan (30x22 Non-Rectangular Multi-Wing Plan) & Choreography
# ---------------------------------------------------------------------------
PLAN: list[str] = [
    # 012345678901234567890123456789
    "##############################",  # 00: stepped outer void + north caps for Cafe(5..13) & Arcade(17..25)
    "#####.........###.........####",  # 01: Kitchenette(5..13) face1 | VoidSlot(14..16) | Arcade(17..25) face1
    "##............###...........##",  # 02: CafeNook(2..4) face1 | ArcadeNook(26..27) face1
    "##............###...........##",  # 03: Kitchenette(5..13) wall foot | Arcade(17..25) wall foot
    "##............###...........##",  # 04: CafeNook(2..4) wall foot | ArcadeNook(26..27) wall foot
    "##............###...........##",  # 05: Cafe tables row | Arcade floor
    "##............###...........##",  # 06: Cafe stools row | Arcade high-top row
    "##............###...........##",  # 07: Cafe south promenade | Arcade south promenade
    "#####..############..#########",  # 08: Thick E-W partition! Doors at (5..6, 8) & (19..20, 8)
    "#...#.........#......#.....###",  # 09: ServerNook(1..3) | Pier(4) | PCHall(7..13) | Foyer(15..18) | VIP(22..27)->wait: let's check x=22..27!
]

# Wait: let's make sure VIP Lounge is x=22..27 (6 cells wide) on rows 09..15, while Arcade above goes to x=28!
PLAN = [
    # 0         1         2
    # 012345678901234567890123456789
    "##############################",  # 00: North caps at 5..13 & 17..25; void slot at 15!
    "#####.........###.........####",  # 01: NW Kitchenette(5..13) | Void(15) | NE Arcade(17..25)
    "##............###............#",  # 02: NW Cafe Nook(2..4) | NE Arcade East Bay(26..28) -> juts to x=28!
    "##............###............#",  # 03: Kitchenette wall-furn row(5..13) | Arcade wall-furn row(17..25)
    "##............###............#",  # 04: Cafe Nook floor(2..4) | Arcade East Bay floor(26..28)
    "##............###............#",  # 05: Cafe dining tables | Arcade play zone
    "##............###............#",  # 06: Cafe stools | Arcade lounge bench & snack table
    "##............###............#",  # 07: Cafe promenade | Arcade promenade
    "#####..############..#########",  # 08: Thick E-W partition (doors at 5..6 & 19..20; NE steps in 28->27)
    "#.............#......#......##",  # 09: Server&Tech Bay(1..4) juts W! PCHall(7..13) | Foyer(15..18) | VIP(22..27)
    "#.............#......#......##",  # 10: face2 row across ServerBay(1..4), PCHall(7..13), Foyer(15..18), VIP(22..27)
    "#............. ...... ......##",  # 11: Wall-furn foot row! N-S door lintels start at (14,11..14) & (21,11..14)
    "#...........................##",  # 12: N-S door lintel face2 at x=14 & x=21
    "#...........................##",  # 13: Grand E-W Cross-Axis Walkable Corridor through (14,13..14) & (21,13..14)!
    "#...........................##",  # 14: Grand E-W Cross-Axis Walkable Corridor row 2
    "#.............#......#......##",  # 15: Partition resumes at x=14 & x=21; VIP south rug row(22..27)
    "#.............#......#########",  # 16: VIP south wall cap (# at 21..29)! PC Red row(6..13) | POS Counter(15..17)
    "####..........#......#########",  # 17: SW corner steps IN (# at 1..3)! PC Red chairs(6..13) | Foyer(15..20)
    "####..........#......#########",  # 18: PC south aisle(4..13) | Foyer front floor(15..20)
    "#################...##########",  # 19: PC Hall south wall cap! Protruding South Entrance Vestibule(17..19)!
    "#################...##########",  # 20: Entrance Vestibule mat row
    "#################...##########",  # 21: Street doorway threshold open to bottom edge!
]
# Replace spaces used for readability in rows 11 only -> '.'
PLAN = [r.replace(" ", ".") for r in PLAN]


@dataclass
class PlacedItem:
    piece: Piece
    x: int
    y: int
    on: list[tuple[str, float, float]] = field(default_factory=list)
    dx: int = 0
    dy: int = 0


def build_scene():
    objs = load_carbon_objects()
    hangs = load_hangings()
    chars = load_characters()

    # Room zones: (x0, y0, x1, y1, floor, wall)
    zones = [
        (2, 1, 13, 8, "cafe_oak", "cafe_wood"),          # NW Ramen Cafe & Kitchenette
        (17, 1, 28, 8, "arcade_teal", "arcade_neon"),    # NE Retro Arcade Room
        (1, 9, 13, 18, "pc_carpet", "pc_slate"),         # SW/Main Esports PC Hall + Server Alcove
        (14, 9, 21, 21, "lobby_terrazzo", "foyer_slate"),# Central POS Foyer + N-S Lintels + Vestibule
        (22, 9, 27, 15, "arcade_teal", "vip_lounge"),    # SE Tucked-In VIP Lounge
    ]

    # Slanted neon/moonlight floor light pools below night windows (wx, wy on face==1)
    lights = [
        (2, 2), (3, 2),       # Cafe West Window Dining Nook (open floor at 2..3, 4)
        (26, 2),              # Arcade East Window Bay (open floor at 26, 4..5)
        (4, 9), (11, 9),      # Esports PC Hall North Windows (open floor at 4, 11..12)
        (23, 9), (26, 9),     # VIP Lounge North Windows
    ]

    items: list[PlacedItem] = []

    def add(p: Piece, x: int, y: int, on=None, dx: int = 0, dy: int = 0):
        items.append(PlacedItem(piece=p, x=x, y=y, on=on or [], dx=dx, dy=dy))

    # --- Flat architectural mats, thresholds & VIP rug ---
    add(make_vip_rug(6, 4), 22, 12)             # Framed burgundy-gold rug in VIP Lounge (22..27, 12..15)
    add(make_entrance_mat(3, 2), 17, 19)        # Ribbed entrance welcome mat in Vestibule (17..19, 19..20)
    add(make_threshold_h(2, warm=True), 5, 8)   # Cafe <-> PC Hall oak/steel threshold
    add(make_threshold_h(2, warm=False), 19, 8) # Arcade <-> Foyer steel threshold
    add(make_threshold_v(2), 14, 13)            # PC Hall <-> Foyer threshold
    add(make_threshold_v(2), 21, 13)            # Foyer <-> VIP Lounge threshold

    # --- Wall Hangings (strictly on face == 1) ---
    # 1) NW Ramen Cafe & Kitchenette
    add(hangs["window_night"], 2, 2)
    add(hangs["window_night"], 3, 2)
    add(hangs["ac_unit"], 7, 1)
    add(hangs["game_poster"], 10, 1)
    add(hangs["neon_sign"], 12, 1)

    # 2) NE Retro Arcade
    add(hangs["ac_unit"], 17, 1)
    add(hangs["neon_sign"], 19, 1)
    add(hangs["game_poster"], 21, 1)
    add(hangs["neon_sign"], 23, 1)
    add(hangs["game_poster"], 25, 1)
    add(hangs["window_night"], 26, 2)
    add(hangs["neon_sign"], 28, 2)

    # 3) Main Esports PC Hall + Server Nook
    add(hangs["ac_unit"], 1, 9)                 # Server bank cooling AC
    add(hangs["window_night"], 4, 9)            # Casts cool night pool onto (4, 11..12)!
    add(hangs["neon_sign"], 8, 9)
    add(hangs["neon_sign"], 9, 9)
    add(hangs["window_night"], 11, 9)
    add(hangs["game_poster"], 13, 9)

    # 4) POS Foyer
    add(hangs["ac_unit"], 15, 9)
    add(hangs["neon_sign"], 17, 9)

    # 5) SE VIP Lounge
    add(hangs["window_night"], 23, 9)
    add(hangs["game_poster"], 24, 9)
    add(hangs["game_poster"], 25, 9)
    add(hangs["window_night"], 26, 9)

    # --- Room 1: NW Ramen Cafe & Kitchenette ---
    # North kitchenette counter wall (y=3, flush against face==2 at y=2)
    add(objs["drink_fridge_glass"], 5, 3)
    add(objs["ramen_cooker_counter"], 6, 3)
    add(objs["ramen_cooker_counter"], 8, 3)
    add(objs["snack_shelf_rack"], 10, 3)
    add(objs["vending_machine_drinks"], 12, 3)
    # West window nook lamp (at x=4 so x=2..3 catches window light & stays walkable!)
    add(objs["standing_floor_lamp"], 4, 4)
    add(
        objs["cafe_table_oak"], 3, 5,
        on=[("ramen_bowl", 0.30, 0.92), ("cola_can", 0.78, 0.85)],
    )
    add(objs["cafe_stool"], 3, 6, dy=-3)
    add(objs["cafe_stool"], 4, 6, dy=-3)

    add(
        objs["cafe_table_oak"], 7, 5,
        on=[("ramen_bowl", 0.28, 0.92), ("snack_tray", 0.72, 0.90)],
    )
    add(objs["cafe_stool"], 7, 6, dy=-3)
    add(objs["cafe_stool"], 8, 6, dy=-3)

    add(
        objs["cafe_table_oak"], 11, 5,
        on=[("iced_coffee", 0.25, 0.90), ("cup_ramen", 0.56, 0.90), ("energy_can", 0.82, 0.85)],
    )
    add(objs["cafe_stool"], 11, 6, dy=-3)
    add(objs["cafe_stool"], 12, 6, dy=-3)

    add(objs["trash_recycle_bin"], 13, 7)       # Tray return & recycle bin at SE cafe corner
    add(chars["student"], 10, 6)                # Diner enjoying cafe area

    # --- Room 2: NE Retro Arcade Room ---
    # North arcade machine line (y=3, flush against face==2 at y=2)
    add(objs["arcade_cabinet_blue"], 17, 3)
    add(objs["arcade_cabinet_red"], 18, 3)
    add(objs["arcade_cabinet_blue"], 19, 3)
    add(objs["arcade_cabinet_red"], 20, 3)
    add(objs["claw_crane_machine"], 21, 3)
    add(objs["claw_crane_machine"], 23, 3)
    add(objs["coin_changer"], 25, 3)
    # Stepped East Arcade Window Bay (y=4..7, x=26..28; x=26 open for window light pool!)
    add(objs["vending_machine_drinks"], 27, 4)  # Flush against stepped north wall face==2 at (27..28, 3)!
    add(objs["vip_sofa_navy"], 22, 6)           # Spectator waiting bench facing claw cranes
    add(
        objs["cafe_table_oak"], 26, 6,
        on=[("energy_can", 0.28, 0.88), ("snack_tray", 0.68, 0.90)],
    )
    add(objs["cafe_stool"], 26, 7, dy=-3)
    add(objs["cafe_stool"], 27, 7, dy=-3)
    add(objs["standing_floor_lamp"], 28, 7)
    add(objs["trash_recycle_bin"], 17, 7)
    add(chars["arcade"], 21, 4)                 # Player at claw crane & fighting cabinets

    # --- Room 3: Main Esports PC Hall + West Server Alcove ---
    # West Server Bank (x=1..3, y=11, flush against north wall face==2 at y=10)
    add(objs["server_rack"], 1, 11)
    add(objs["server_rack"], 2, 11)
    add(objs["standing_floor_lamp"], 3, 11)

    # North Pro Blue Row (x=7..13, y=11, flush against north wall face==2 at y=10)
    add(objs["drink_fridge_glass"], 7, 11)
    for bx in (8, 10, 12):
        add(objs["pc_station_blue"], bx, 11)
        add(objs["gaming_chair_blue"], bx, 12, dx=2, dy=-3)

    # West Blue Duo Pod (x=1..4, y=14)
    for bx in (1, 3):
        add(objs["pc_station_blue"], bx, 14)
        add(objs["gaming_chair_blue"], bx, 15, dx=2, dy=-3)

    # South Dual-Monitor Red Arena Row (x=6..13, y=16)
    for rx in (6, 8, 10, 12):
        add(objs["pc_station_red"], rx, 16)
        add(objs["gaming_chair_red"], rx, 17, dx=4, dy=-3)

    add(objs["trash_recycle_bin"], 4, 18)
    add(chars["student"], 7, 13)                # Esports gamer in central hall aisle

    # --- Room 4: POS Counter & Coin-Locker Foyer + South Entrance Vestibule ---
    # North Foyer Wall (x=15..18, y=11, flush against face==2 at y=10)
    add(objs["storage_locker"], 15, 11)
    add(objs["storage_locker"], 16, 11)
    add(objs["snack_shelf_rack"], 17, 11)
    # POS Counter facing the protruding South Entrance Vestibule + clerk behind it
    add(
        objs["pos_counter_desk"], 15, 16,
        on=[("iced_coffee", 0.35, 0.90), ("cup_ramen", 0.72, 0.92)],
    )
    add(chars["clerk"], 16, 15)                 # Clerk behind POS counter
    add(objs["standing_floor_lamp"], 20, 16)
    add(objs["trash_recycle_bin"], 15, 18)

    # --- Room 5: Tucked-In SE VIP Lounge ---
    # North VIP Wall (x=22..27, y=11, flush against face==2 at y=10)
    add(objs["standing_floor_lamp"], 22, 11)
    add(objs["vip_sofa_navy"], 23, 11)
    add(objs["vip_sofa_navy"], 25, 11)
    add(objs["drink_fridge_glass"], 27, 11)
    # VIP Lounge Table & Stools on plush framed rug
    add(
        objs["cafe_table_oak"], 24, 13,
        on=[("ramen_bowl", 0.25, 0.92), ("iced_coffee", 0.58, 0.88), ("cola_can", 0.84, 0.85)],
    )
    add(objs["cafe_stool"], 24, 14, dy=-3)
    add(objs["cafe_stool"], 25, 14, dy=-3)
    add(chars["vip"], 26, 14)

    return PLAN, zones, lights, items


# ---------------------------------------------------------------------------
# 6. Compose + Automated Architectural & BFS Walkability Checks
# ---------------------------------------------------------------------------
def compose_scene(plan, zones, lights, items: list[PlacedItem]) -> Image.Image:
    base = render_structure(plan, "pc_carpet", "pc_slate", zones)
    px = base.load()

    # Slanted window light pools (cool moonlight/city neon tint on floor below windows)
    for wx, wy in lights:
        for Y in range((wy + 2) * 16, (wy + 4) * 16):
            if Y >= base.height:
                continue
            sh = (Y - (wy + 2) * 16) // 3
            fade = 1.0 - (Y - (wy + 2) * 16) / 36.0
            for X in range(wx * 16 + 2 + sh, wx * 16 + 14 + sh):
                if 0 <= X < base.width:
                    r, g, b, a = px[X, Y]
                    nr = min(255, int(r + 16 * fade))
                    ng = min(255, int(g + 22 * fade))
                    nb = min(255, int(b + 30 * fade))
                    px[X, Y] = (nr, ng, nb, a)

    draw_list: list[tuple[int, Image.Image, int, int]] = []
    for it in items:
        f = it.piece
        X = it.x * 16 + f.dx + it.dx
        if f.kind == "hang":
            Y = it.y * 16 + 1 + it.dy
            z = it.y * 16
            draw_list.append((z, f.im, X, Y))
        elif f.kind == "flat":
            Y = it.y * 16 + it.dy
            draw_list.append((-10, f.im, X, Y))
        else:
            Y = it.y * 16 - f.up + f.dy + it.dy
            z = (it.y + f.fh) * 16 + it.dy
            layer = add_ground_shadow(f.im) if f.kind in ("wall", "floor", "seat") else f.im.copy()
            if it.on and f.surf:
                x0, y0, x1, y1 = f.surf
                for gname, fx, fy in it.on:
                    gi = GOODS[gname]
                    gx = int(x0 + fx * (x1 - x0) - gi.width / 2)
                    gy = int(y0 + fy * (y1 - y0) - gi.height + 1)
                    gx = max(0, min(layer.width - gi.width, gx))
                    gy = max(0, min(layer.height - gi.height, gy))
                    layer.alpha_composite(gi, (gx, gy))
            draw_list.append((z, layer, X, Y))

    for _, lim, X, Y in sorted(draw_list, key=lambda d: d[0]):
        base.alpha_composite(lim, (X, Y))
    return base


def verify_scene(plan: list[str], items: list[PlacedItem]) -> dict:
    W, Hh, g, face, top, inn = analyse(plan)
    floor = [[g[y][x] and face[y][x] == 0 for x in range(W)] for y in range(Hh)]

    def fl(x: int, y: int) -> bool:
        return 0 <= x < W and 0 <= y < Hh and floor[y][x]

    issues: list[str] = []
    occ: dict[tuple[int, int], str] = {}
    used_carbon_ids: set[str] = set()

    for it in items:
        f = it.piece
        if f.kind in ("wall", "floor", "seat"):
            used_carbon_ids.add(f.id)
        if f.kind == "hang":
            if not (0 <= it.x < W and 0 <= it.y < Hh and face[it.y][it.x] == 1):
                issues.append(f"Hanging {f.id} @({it.x},{it.y}) not on upper wall row (face==1)!")
            continue
        if f.kind == "flat":
            continue

        for yy in range(it.y, it.y + f.fh):
            for xx in range(it.x, it.x + f.fw):
                if not fl(xx, yy):
                    issues.append(f"{f.id} @({it.x},{it.y}) cell ({xx},{yy}) is NOT walkable floor!")
                if (xx, yy) in occ:
                    issues.append(f"{f.id} @({it.x},{it.y}) overlaps {occ[(xx, yy)]} at ({xx},{yy})!")
                occ[(xx, yy)] = f.id

        # Hard rule: EVERY wall-furniture item sits flush against a north wall face (face == 2 just above)
        if f.kind == "wall":
            for xx in range(it.x, it.x + f.fw):
                if not (it.y > 0 and face[it.y - 1][xx] == 2):
                    issues.append(
                        f"Wall furniture {f.id} @({it.x},{it.y}) col {xx} lacks north wall face==2 above it!"
                    )

    # Doorways must be 100% unobstructed (including adjacent entry cells)
    doorway_cells = [
        # Cafe <-> PC Hall E-W doorway
        (5, 8), (6, 8), (5, 7), (6, 7), (5, 9), (6, 9),
        # Arcade <-> Foyer E-W doorway
        (19, 8), (20, 8), (19, 7), (20, 7), (19, 9), (20, 9),
        # PC Hall <-> Foyer N-S doorway walkable rows
        (14, 13), (14, 14), (13, 13), (13, 14), (15, 13), (15, 14),
        # Foyer <-> VIP Lounge N-S doorway walkable rows
        (21, 13), (21, 14), (20, 13), (20, 14), (22, 13), (22, 14),
        # Protruding South Entrance Vestibule
        (17, 21), (18, 21), (19, 21), (17, 20), (18, 20), (19, 20),
    ]
    for dc in doorway_cells:
        if not fl(*dc):
            issues.append(f"Doorway clearance cell {dc} is not floor!")
        if dc in occ:
            issues.append(f"Doorway clearance cell {dc} blocked by {occ[dc]}!")

    # BFS from South Entrance Vestibule bottom row
    starts = [(x, Hh - 1) for x in range(W) if fl(x, Hh - 1) and (x, Hh - 1) not in occ]
    seen = set(starts)
    q = deque(starts)
    while q:
        cx, cy = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = cx + dx, cy + dy
            if fl(nx, ny) and (nx, ny) not in occ and (nx, ny) not in seen:
                seen.add((nx, ny))
                q.append((nx, ny))

    named_rooms = {
        "South Entrance & POS Foyer": (18, 18),
        "NW Ramen Cafe & Kitchenette": (6, 4),
        "NE Retro Arcade": (20, 5),
        "Main Esports PC Hall": (7, 14),
        "Server Nook": (2, 12),
        "SE VIP Lounge": (23, 13),
    }
    room_reach = {}
    for rname, rc in named_rooms.items():
        ok = rc in seen
        room_reach[rname] = ok
        if not ok:
            issues.append(f"Room '{rname}' at {rc} NOT reachable from entrance!")

    # Every interactive station, machine, table, counter, locker, rack must have an adjacent reachable tile
    station_checks = 0
    station_passed = 0
    for it in items:
        f = it.piece
        if f.kind in ("hang", "flat", "char"):
            continue
        station_checks += 1
        fp = [(xx, yy) for yy in range(it.y, it.y + f.fh) for xx in range(it.x, it.x + f.fw)]
        adj = [
            (ax + dx, ay + dy)
            for ax, ay in fp
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
            if (ax + dx, ay + dy) not in fp
        ]
        # Allow reaching a desk via its tucked chair if the chair itself is adjacent to a reachable tile
        ok = any(c in seen for c in adj)
        if not ok:
            # Check 2-step through adjacent seat
            for c in adj:
                if c in occ and ("chair" in occ[c] or "stool" in occ[c]):
                    if any((c[0] + dx, c[1] + dy) in seen for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                        ok = True
                        break
        if ok:
            station_passed += 1
        else:
            issues.append(f"Prop {f.id} @({it.x},{it.y}) has NO reachable interaction tile!")

    total_floor = sum(1 for y in range(Hh) for x in range(W) if fl(x, y))
    walkable_free = sum(1 for y in range(Hh) for x in range(W) if fl(x, y) and (x, y) not in occ)

    return {
        "grid_size": f"{W}x{Hh}",
        "pixel_size_1x": f"{W * 16}x{Hh * 16}",
        "pixel_size_2x": f"{W * 32}x{Hh * 32}",
        "unique_carbon_objects_used": f"{len(used_carbon_ids)}/20",
        "total_placed_props": sum(1 for it in items if it.piece.kind in ("wall", "floor", "seat")),
        "tabletop_goods_count": sum(len(it.on) for it in items),
        "hangings_count": sum(1 for it in items if it.piece.kind == "hang"),
        "characters_count": sum(1 for it in items if it.piece.kind == "char"),
        "total_floor_cells": total_floor,
        "walkable_open_cells": walkable_free,
        "bfs_reached_cells": len(seen),
        "bfs_coverage_pct": round(100.0 * len(seen) / max(1, walkable_free), 1),
        "rooms_reached": room_reach,
        "stations_reachable": f"{station_passed}/{station_checks}",
        "issues": issues,
        "bfs_pass": len(issues) == 0 and len(seen) == walkable_free,
    }


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    plan, zones, lights, items = build_scene()
    report = verify_scene(plan, items)
    im1x = compose_scene(plan, zones, lights, items)
    im2x = im1x.resize((im1x.width * 2, im1x.height * 2), Image.NEAREST)

    out1x = OUT_DIR / "map_pcbang_v2.png"
    out2x = OUT_DIR / "map_pcbang_v2_2x.png"
    out_json = OUT_DIR / "metrics_v2.json"

    im1x.save(out1x)
    im2x.save(out2x)
    out_json.write_text(json.dumps(report, indent=2, ensure_ascii=False))

    print(json.dumps(report, indent=2, ensure_ascii=False))
    if not report["bfs_pass"]:
        raise SystemExit(f"Verification FAILED: {report['issues']}")


if __name__ == "__main__":
    main()
