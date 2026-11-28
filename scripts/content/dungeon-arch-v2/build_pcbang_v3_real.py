#!/usr/bin/env python3
"""
Authentic Korean PC Bang v3 (`modern_pcbang_v3`) — Hand-Coded Pixel Art Generator
=================================================================================
Addresses every critique of v2 ("pc 방이 어떻게 저렇게 생겼냐... 너무 어색한데 .."):
1. ONE unified dark-charcoal open-plan acoustic-carpet hall (#1b1f2a–#252a38) inside
   non-rectangular T/L stepped silhouette (#11131a void) — ZERO wood restaurants,
   ZERO Persian rugs, ZERO bright stone cobbles!
2. Continuous flush 5-pod (10-seat) Back-to-Back Partitioned Seat Islands:
   - North side: tucked gaming chairs facing SOUTH (`chair_s`) + curved dual-monitor
     BACK shells (`desk_back`) with rear cyan/crimson V-LED accents + PC tower.
   - Center: continuous dark partition spine with glowing seat-number tags & headset hooks.
   - South side: glowing curved dual monitors seen from FRONT (`desk_front`: LoL Rift,
     Valorant HUD, game launcher) + TKL RGB keyboard + long deskmat + tempered-glass RGB
     PC tower + high-back bucket gaming chairs seen from BACK (`chair_n`).
   - Three crisp zones:
     * Main Zone (Center-East): 2 parallel 5-pod B2B Cyan/Blue islands = 20 seats,
       separated by a clean 2-tile walkable aisle.
     * FPS 240Hz Pro Zone (North-Central): 1 5-pod B2B Crimson/Red island = 10 seats.
     * 5-Seat Team Room Booth (South-West): translucent glass-partitioned 5-stack squad
       booth with 5 contiguous `team_desk_blue` stations side-by-side = 5 seats.
3. Open L-Shaped Alba Counter & Food Prep Zone (North-West alcove):
   - Open dark L-counter (`counter_pos_dark` + L-return wing) + overhead `FOOD / DRINK`
     digital menu boards + 1 Alba staff sprite inside counter.
   - Back/adjacent wall: 3-door glass drink showcase fridge (`drink_fridge_triple`),
     cup-ramen & snack rack (`snack_ramen_rack`), self-serve Hangang ramen induction &
     water purifier bar (`ramen_water_bar`), and 3-bin recycle/tray return station
     (`tray_return_bin`) right where the counter meets the main aisle.
4. Stepped North-East Translucent Tempered-Glass Smoking Booth (`흡연부스`):
   - Dark-aluminium mullions + translucent blue-grey glass walls with diagonal sheen,
     sliding glass doorway with glowing `SMOKING` header, ceiling exhaust vent hood
     (`glass_booth_vent`), and 2 stainless standing ashtrays (`smoking_ashtray`).
5. Protruding South-Center Entrance Vestibule:
   - Automatic glass sliding door + dark entrance runner mat + 2 glowing blue touchscreen
     Prepay Kiosks (`prepay_kiosk`, 무인 선불결제기) right inside the entrance.
"""

from __future__ import annotations

import json
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from PIL import Image

ROOT = Path("/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a")
PALETTE_PATH = ROOT / "tiledata/dungeon-pilot/_dots_kit_refs/modern_palette_v3.json"
OUT_DIR = ROOT / "tiledata/dungeon-arch-v2/modern_pcbang_v3"
OBJ_OUT_DIR = OUT_DIR / "objects"

PAL_DATA = json.loads(PALETTE_PATH.read_text())
SHADOW_RGBA: tuple[int, int, int, int] = tuple(PAL_DATA["shadow_rgba"])  # (76, 85, 127, 85)


def hx(s: str) -> tuple[int, int, int]:
    s = s.lstrip("#")
    c = (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))
    assert c != (0, 0, 0), "Pure #000000 is strictly forbidden!"
    return c


def mul(c: tuple[int, int, int], k: float) -> tuple[int, int, int]:
    r = max(8, min(255, int(round(c[0] * k))))
    g = max(9, min(255, int(round(c[1] * k))))
    b = max(14, min(255, int(round(c[2] * k))))
    return (r, g, b)


def mix(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return (
        max(8, min(255, int(round(a[0] * (1.0 - t) + b[0] * t)))),
        max(9, min(255, int(round(a[1] * (1.0 - t) + b[1] * t)))),
        max(14, min(255, int(round(a[2] * (1.0 - t) + b[2] * t)))),
    )


def H(x: int, y: int, seed: int = 0) -> float:
    h = (x * 374761393 + y * 668265263 + seed * 1442695041) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return (h & 0xFFFF) / 65535.0


# ---------------------------------------------------------------------------
# Cohesive Dark Korean Cybercafe Palette (harmonized with modern_palette_v3)
# ---------------------------------------------------------------------------
VOID = hx("#11131a")
CEIL_PAIR = (hx("#171a24"), hx("#1b1f2b"))

# Crisp 3px metallic ceiling rim lips
RIM_DARK = hx("#141622")
RIM_SHAD = hx("#343b4e")
RIM_MID = hx("#525a70")
RIM_LIT = hx("#7c859e")
RIM_HI = hx("#aeb6cc")

# Charcoal / Slate Ramps (walls, desks, chairs, frames)
INK = hx("#141622")         # crisp dark outline (zero #000000)
SLATE_0 = hx("#1b1f2a")
SLATE_1 = hx("#202533")
SLATE_2 = hx("#252a38")
SLATE_3 = hx("#2d3344")
SLATE_4 = hx("#363d52")
SLATE_5 = hx("#3d4559")
SLATE_6 = hx("#525a70")
STEEL_1 = hx("#707282")
STEEL_2 = hx("#9698a4")
STEEL_3 = hx("#bec0c8")
STEEL_4 = hx("#e2e4e8")
WHITE_HI = hx("#fafaf8")

# Cyan / Blue Esports Accent (modern_palette_v3 ramps)
CYAN_0 = hx("#11272e")
CYAN_1 = hx("#184150")
CYAN_2 = hx("#1c726c")
CYAN_3 = hx("#1b9490")
CYAN_4 = hx("#29b6b6")
CYAN_5 = hx("#5bd4d8")
CYAN_6 = hx("#9af4fa")

BLUE_0 = hx("#111c2e")
BLUE_1 = hx("#182c50")
BLUE_2 = hx("#1c3772")
BLUE_3 = hx("#294db6")
BLUE_4 = hx("#5b76d8")
BLUE_5 = hx("#9aacfa")

# Crimson / Red 240Hz FPS Accent (modern_palette_v3 ramps)
RED_0 = hx("#2e1119")
RED_1 = hx("#501825")
RED_2 = hx("#721c28")
RED_3 = hx("#941b23")
RED_4 = hx("#b62b29")
RED_5 = hx("#d8665b")
RED_6 = hx("#faaa9a")

# Game HUD / Beverage / Food Accents (modern_palette_v3)
GRN_1 = hx("#18502f")
GRN_2 = hx("#1b9454")
GRN_3 = hx("#29b670")
GRN_4 = hx("#61d85b")
GRN_5 = hx("#9afad0")

AMB_1 = hx("#72461c")
AMB_2 = hx("#b68429")
AMB_3 = hx("#d8b55b")
AMB_4 = hx("#fae79a")

ORG_2 = hx("#b65529")
ORG_3 = hx("#d88c5b")

PUR_2 = hx("#571c72")
PUR_3 = hx("#9329b6")
PUR_4 = hx("#bd5bd8")
PNK_3 = hx("#d85b8f")

SKIN_0 = hx("#5c3428")
SKIN_1 = hx("#be7c5c")
SKIN_2 = hx("#e6aa82")
SKIN_3 = hx("#fad6b4")
HAIR_0 = hx("#181622")
HAIR_1 = hx("#2d2634")
HAIR_2 = hx("#473946")


# ---------------------------------------------------------------------------
# Pixel Drawing Primitives
# ---------------------------------------------------------------------------
def pset(px, w: int, h: int, x: int, y: int, c: tuple[int, int, int], a: int = 255):
    if 0 <= x < w and 0 <= y < h:
        px[x, y] = (c[0], c[1], c[2], a)


def fill_rect(px, w: int, h: int, x0: int, y0: int, x1: int, y1: int, c: tuple[int, int, int], a: int = 255):
    for yy in range(max(0, y0), min(h, y1 + 1)):
        for xx in range(max(0, x0), min(w, x1 + 1)):
            px[xx, yy] = (c[0], c[1], c[2], a)


def stroke_rect(px, w: int, h: int, x0: int, y0: int, x1: int, y1: int, c: tuple[int, int, int], a: int = 255):
    for xx in range(x0, x1 + 1):
        pset(px, w, h, xx, y0, c, a)
        pset(px, w, h, xx, y1, c, a)
    for yy in range(y0, y1 + 1):
        pset(px, w, h, x0, yy, c, a)
        pset(px, w, h, x1, yy, c, a)


def add_contact_shadow(im: Image.Image, foot_rows: int = 3) -> Image.Image:
    """Crisp locked shadow_rgba=(76,85,127,85) 1px below bottom silhouette."""
    out = Image.new("RGBA", (im.width, im.height + 1), (0, 0, 0, 0))
    px = im.load()
    opx = out.load()
    for y in range(max(0, im.height - foot_rows), im.height):
        for x in range(im.width):
            if px[x, y][3] == 255 and opx[x, y + 1][3] == 0:
                opx[x, y + 1] = SHADOW_RGBA
    out.alpha_composite(im, (0, 0))
    return out


# ---------------------------------------------------------------------------
# 1. World-Coordinate Unified Dark Carpet & Industrial Slate Wall Painters
# ---------------------------------------------------------------------------
def floor_pcbang_carpet(X: int, Y: int) -> tuple[int, int, int]:
    """
    Subtle dark-charcoal commercial acoustic carpet tiles (#1b1f2a-#252a38)
    painted in world coordinates (20x20 staggered quarter-turn carpet squares,
    never aligned to 16x16 tile boundaries).
    """
    tx = X // 20
    ty = Y // 20
    lx = X % 20
    ly = Y % 20
    quarter_turn = (tx + ty) % 2 == 0

    # Whisper-quiet carpet tile seam
    if lx == 0 or ly == 0:
        if (X + Y) % 2 == 0:
            return hx("#191d28")
        return SLATE_0

    if quarter_turn:
        weave = (X + Y // 2) % 3
        base = SLATE_1 if weave == 0 else SLATE_0 if weave == 1 else hx("#1e2230")
    else:
        weave = (X // 2 + Y) % 3
        base = SLATE_2 if weave == 0 else SLATE_1 if weave == 1 else hx("#1d222e")

    if H(X, Y, 17) < 0.045:
        return hx("#272d3d")
    return base


def floor_food_zone(X: int, Y: int) -> tuple[int, int, int]:
    """Dark matte porcelain tile in counter/ramen zone — stays in exact same dark family."""
    sy = Y // 14
    off = 11 if (sy % 2) else 0
    lx = (X + off) % 22
    ly = Y % 14
    if lx == 0 or ly == 0:
        return hx("#181c26")
    if ly == 1 and lx < 20 and H(X // 22, sy, 31) < 0.5:
        return hx("#2a3042")
    return hx("#232838") if ((X // 3 + Y // 3) % 2 == 0) else hx("#202534")


def floor_smoking_booth(X: int, Y: int) -> tuple[int, int, int]:
    """Dark metallic-slate anti-ash floor inside smoking booth."""
    lx = X % 12
    ly = Y % 12
    if lx == 0 or ly == 0:
        return hx("#151822")
    if (lx + ly) % 4 == 0 and H(X, Y, 53) < 0.35:
        return hx("#283040")
    return hx("#1d2230")


FLOORFN: dict[str, Callable[[int, int], tuple[int, int, int]]] = {
    "carpet": floor_pcbang_carpet,
    "food_slate": floor_food_zone,
    "smoking_slate": floor_smoking_booth,
}


def wall_dark_cyber(X: int, fy: int, accent: str = "cyan") -> tuple[int, int, int]:
    """
    32px tall dark industrial charcoal-slate PC bang wall (#2d3344-#3d4559)
    with recessed horizontal LED cove line & dark acoustic lower dado.
    """
    if fy >= 29:
        return SLATE_4 if fy == 29 else INK
    # Recessed LED cove strip at fy 18..20
    if fy == 18:
        return INK
    if fy == 19:
        if accent == "red":
            return RED_4 if (X % 20 != 0) else RED_2
        if accent == "amber":
            return AMB_3 if (X % 20 != 0) else AMB_1
        return CYAN_4 if (X % 20 != 0) else CYAN_2
    if fy == 20:
        return RED_1 if accent == "red" else AMB_1 if accent == "amber" else CYAN_1

    # Upper architectural slate panels (fy 0..17, 30px wide non-16-aligned seams)
    if fy < 18:
        lx = (X + 9) % 30
        if lx == 0:
            return hx("#1d212e")
        if lx == 1:
            return SLATE_5
        if fy == 17:
            return SLATE_3
        return SLATE_4 if H(X // 4, fy // 3, 91) < 0.62 else SLATE_3

    # Lower vertical ribbed acoustic charcoal dado (fy 21..28)
    rx = X % 6
    if rx == 0:
        return hx("#181c27")
    if rx == 1:
        return SLATE_3
    return SLATE_2 if fy < 26 else SLATE_1


FACEFN: dict[str, Callable[[int, int], tuple[int, int, int]]] = {
    "wall_cyan": lambda X, fy: wall_dark_cyber(X, fy, "cyan"),
    "wall_red": lambda X, fy: wall_dark_cyber(X, fy, "red"),
    "wall_amber": lambda X, fy: wall_dark_cyber(X, fy, "amber"),
}


# ---------------------------------------------------------------------------
# 2. Architectural Plan (32x22 Non-Rectangular Stepped T/L Open Hall)
# ---------------------------------------------------------------------------
# Grid size: 32 cols (x=0..31) x 22 rows (y=0..21) -> 512x352 px (1x), 1024x704 px (2x)
# Outer stepped silhouette features:
# - NW Food/Counter wing (x=1..9) recessed 1 row on North (y=0 is pure void)
# - North-Central FPS 240Hz Pro Bay (x=10..23) juts North to y=0!
# - NE Glass Smoking Booth (x=24..29) recessed on North (y=0 void) AND East (x=31 void on y=0..6)
# - East Main Zone Hall (x=19..30) steps out East to x=30 (cap at x=31) on y=7..20, recessed on y=21
# - SW 5-Seat Team Room Wing (x=1..11) recessed 4 rows at South (y=18..21 is pure void!)
# - South-Center Entrance Vestibule (x=13..17, cap 12..18) protrudes South all the way to y=21!
PLAN: list[str] = [
    # 0         1         2         3
    # 01234567890123456789012345678901
    "################################",  # 00: North cap over FPS Bay(9..24); NW(0..8) & NE(25..31) are VOID!
    "##########..............########",  # 01: FPS Bay(10..23) face1 | NW cap(0..9) | NE Smoking cap(24..30)
    "#............................###",  # 02: NW(1..9) face1 | FPS(10..23) face2 | Smoking(24..28->wait 24..29!)
]

PLAN = [
    # 0         1         2         3
    # 01234567890123456789012345678901
    "################################",  # 00: Cap over North-Central FPS Bay (9..24); NW & NE outer void
    "##########..............########",  # 01: FPS Bay (10..23) face1; NW cap (0..9); NE Smoking cap (24..30)
    "#.............................##",  # 02: NW (1..9) face1 | FPS (10..23) face2 | Smoking (24..29) face1
    "#.............................##",  # 03: NW (1..9) face2 | FPS north aisle (10..23) | Smoking (24..29) face2
    "#.............................##",  # 04: NW back bar (1..8) | FPS Red Island r0 | Smoking floor (25..29)
    "#.............................##",  # 05: NW staff/water floor | FPS Red Island r1 | Smoking floor (25..29)
    "#.............................##",  # 06: NW Alba L-counter r0 | FPS Red Island r2 | Smoking glass S-wall
    "#..............................#",  # 07: NW Alba L-counter r1 | FPS Red Island r3 | East step face1 (30)
    "#..............................#",  # 08: Grand E-W LED Promenade Aisle r0 | East step face2 (30)
    "#..............................#",  # 09: Grand Promenade r1 | Main Blue Island 1 r0 (20..29) | E aisle (30)
    "#..............................#",  # 10: West Foyer | Main Blue Island 1 r1 (20..29)
    "#..............................#",  # 11: Team Room N-glass wall (1..11) | Central Foyer | Main 1 r2
    "#..............................#",  # 12: Team Room 5-desks r0 (1..10) + E-glass(11) | Foyer | Main 1 r3
    "#..............................#",  # 13: Team Room 5-desks r1 | Central Foyer | Main 2-tile Aisle r0
    "#..............................#",  # 14: Team Room 5-chairs r2 | Central Foyer | Main 2-tile Aisle r1
    "#..............................#",  # 15: Team Room aisle r0 + door(11) | Foyer | Main Blue Island 2 r0
    "#..............................#",  # 16: Team Room aisle r1 + door(11) | Foyer | Main Blue Island 2 r1
    "#############..................#",  # 17: SW Team Room South Cap (0..12) | Foyer (13..19) | Main 2 r2
    "#############..................#",  # 18: SW outer VOID (0..11) | Vestibule/Kiosks (13..19) | Main 2 r3
    "#############..................#",  # 19: SW outer VOID | Entrance Vestibule | Main 2 South Aisle (19..30)
    "#############.....##############",  # 20: Protruding Entrance Vestibule (13..17) | East Wing South Cap (18..31)
    "##############...###############",  # 21: Protruding Glass Sliding Entrance Doorway (14..16)!
]

assert len(PLAN) == 22 and all(len(r) == 32 for r in PLAN), "PLAN must be strictly 32x22!"


def analyse(plan: list[str]):
    Hh = len(plan)
    W = len(plan[0])
    g = [[plan[y][x] != "#" for x in range(W)] for y in range(Hh)]

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
    zones: list[tuple[int, int, int, int, str | None, str | None]],
) -> Image.Image:
    W, Hh, g, face, top, inn = analyse(plan)

    def mat(cx: int, cy: int) -> tuple[str, str]:
        f, w = "carpet", "wall_cyan"
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
                        left_open = inn(cx - 1, cy) and face[cy][cx - 1] == 0
                        right_open = inn(cx + 1, cy) and face[cy][cx + 1] == 0
                        if left_open and lx < 2:
                            c = RIM_DARK if lx == 0 else RIM_LIT
                        elif right_open and lx >= 14:
                            c = RIM_DARK if lx == 15 else RIM_SHAD
                        if fy < 4:
                            c = mul(c, 0.65 + 0.08 * fy)
                        px[X, Y] = c + (255,)
                    elif g[cy][cx]:
                        c = FLOORFN[f_name](X, Y)
                        if (face[cy - 1][cx] if cy > 0 else 0) and ly < 3:
                            c = mul(c, 0.62 + 0.12 * ly)
                        px[X, Y] = c + (255,)
                    elif top[cy][cx]:
                        c = CEIL_PAIR[(X + Y) % 2]
                        s_in = inn(cx, cy + 1)
                        n_in = inn(cx, cy - 1)
                        w_in = inn(cx - 1, cy)
                        e_in = inn(cx + 1, cy)

                        # Crisp 3px metallic beveled ceiling rim lips on all room-facing edges
                        if s_in and ly >= 12:
                            c = RIM_HI if ly == 12 else RIM_LIT if ly == 13 else RIM_SHAD if ly == 14 else RIM_DARK
                        if n_in and ly <= 2:
                            c = RIM_DARK if ly == 0 else RIM_HI if ly == 1 else RIM_SHAD
                        if w_in and lx <= 2:
                            c = RIM_DARK if lx == 0 else RIM_HI if lx == 1 else RIM_MID
                        if e_in and lx >= 13:
                            c = RIM_DARK if lx == 15 else RIM_SHAD if lx == 14 else RIM_LIT

                        # Clean outer void border
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

    # Soft 5px west-wall interior contact shade
    for cy in range(Hh):
        for cx in range(W):
            if g[cy][cx] and not inn(cx - 1, cy):
                for ly in range(16):
                    for lx in range(5):
                        X, Y = cx * 16 + lx, cy * 16 + ly
                        r, gg, b, a = px[X, Y]
                        px[X, Y] = mul((r, gg, b), 0.68 + 0.06 * lx) + (a,)

    return im


def paint_floor_led_guides_and_door(im: Image.Image) -> None:
    """
    Paint recessed muted Cyan / Crimson LED aisle guide strips directly into the
    open-hall carpet + automatic glass sliding entrance door threshold on y=21.
    """
    px = im.load()

    def h_led(x0_px: int, x1_px: int, y_px: int, core: tuple[int, int, int], glow: tuple[int, int, int]):
        for x in range(x0_px, x1_px + 1):
            px[x, y_px - 1] = mix(px[x, y_px - 1][:3], glow, 0.35) + (255,)
            px[x, y_px] = (core if x % 8 != 0 else glow) + (255,)
            px[x, y_px + 1] = mix(px[x, y_px + 1][:3], glow, 0.35) + (255,)

    def v_led(x_px: int, y0_px: int, y1_px: int, core: tuple[int, int, int], glow: tuple[int, int, int]):
        for y in range(y0_px, y1_px + 1):
            px[x_px - 1, y] = mix(px[x_px - 1, y][:3], glow, 0.35) + (255,)
            px[x_px, y] = (core if y % 8 != 0 else glow) + (255,)
            px[x_px + 1, y] = mix(px[x_px + 1, y][:3], glow, 0.35) + (255,)

    # 1) Main N-S Corridor Spine from Entrance Vestibule (x=15, y=18) up to Main Promenade (y=8)
    v_led(15 * 16 + 7, 8 * 16 + 8, 18 * 16 + 10, CYAN_3, CYAN_1)
    # 2) Secondary N-S Spine along East Main Zone West Aisle (x=18, y=9..18)
    v_led(18 * 16 + 8, 9 * 16 + 4, 18 * 16 + 12, CYAN_3, CYAN_1)
    # 3) Main E-W Promenade Guide Line (y=8, from NW Counter x=7 across to Smoking Booth x=26)
    h_led(7 * 16 + 8, 26 * 16 + 8, 8 * 16 + 8, CYAN_3, CYAN_1)
    # 4) Main Zone Central 2-Tile Aisle LED Strip (between Island 1 & Island 2, y=14, x=18..28)
    h_led(18 * 16 + 8, 28 * 16 + 14, 14 * 16, CYAN_2, CYAN_1)
    # 5) Crimson 240Hz Pro Zone Accent Perimeter Line along y=8 under FPS Island (x=10..19)
    h_led(10 * 16 + 2, 19 * 16 + 13, 8 * 16 + 2, RED_3, RED_1)
    # 6) Warm Amber Guide Branch toward Alba Counter pickup zone (x=3..7, y=8)
    h_led(3 * 16 + 4, 7 * 16 + 4, 8 * 16 + 8, AMB_2, AMB_1)

    # 7) Protruding South Entrance Automatic Glass Sliding Door (`자동문` at x=14..16, y=21)
    dx0, dx1 = 14 * 16, 17 * 16 - 1
    dy0 = 21 * 16
    # Brushed steel threshold track across full 3-tile doorway
    for x in range(dx0, dx1 + 1):
        px[x, dy0 + 10] = INK + (255,)
        px[x, dy0 + 11] = STEEL_2 + (255,)
        px[x, dy0 + 12] = SLATE_3 + (255,)
        px[x, dy0 + 13] = STEEL_1 + (255,)
        px[x, dy0 + 14] = INK + (255,)
    # Retracted left & right tempered-glass sliding door leaves (8px each side, 32px open center!)
    for side_x0, side_x1 in ((dx0, dx0 + 8), (dx1 - 8, dx1)):
        fill_rect(px, im.width, im.height, side_x0, dy0 + 2, side_x1, dy0 + 14, CYAN_1)
        stroke_rect(px, im.width, im.height, side_x0, dy0 + 2, side_x1, dy0 + 14, SLATE_6)
        pset(px, im.width, im.height, side_x0 + 2, dy0 + 5, CYAN_5)
        pset(px, im.width, im.height, side_x0 + 3, dy0 + 6, CYAN_6)
        pset(px, im.width, im.height, side_x0 + 4, dy0 + 7, CYAN_5)
    # Glowing cyan entrance floor welcome strip just inside automatic door
    h_led(dx0 + 6, dx1 - 6, dy0 + 1, CYAN_4, CYAN_2)


# ---------------------------------------------------------------------------
# 3. Reusable 16x16-Aligned Modular Sprites (`objects/*.png`)
# ---------------------------------------------------------------------------
def _draw_screen_art(px, w: int, h: int, x0: int, y0: int, x1: int, y1: int, mode: str):
    """Crisp miniature game HUD inside a monitor bezel."""
    fill_rect(px, w, h, x0, y0, x1, y1, BLUE_0)
    sw = x1 - x0 + 1
    sh = y1 - y0 + 1
    if mode == "lol":
        # Summoner's Rift green/teal river & diagonal mid-lane + bottom-right minimap
        for yy in range(sh):
            for xx in range(sw):
                if abs((sw - 1 - xx) - yy * 1.2) <= 1.2:
                    c = AMB_3 if yy % 2 == 0 else GRN_3
                elif xx + yy < sh:
                    c = GRN_1
                else:
                    c = CYAN_1 if (xx + yy) % 3 == 0 else GRN_2
                pset(px, w, h, x0 + xx, y0 + yy, c)
        # Tiny champion HP bars & bottom HUD + minimap box
        pset(px, w, h, x0 + 3, y0 + 2, CYAN_6)
        pset(px, w, h, x0 + 4, y0 + 2, CYAN_5)
        pset(px, w, h, x0 + 6, y0 + 3, RED_5)
        fill_rect(px, w, h, x0 + 2, y1, x1 - 3, y1, SLATE_1)
        pset(px, w, h, x0 + 3, y1, GRN_4)
        pset(px, w, h, x0 + 5, y1, BLUE_4)
        fill_rect(px, w, h, x1 - 2, y1 - 2, x1, y1, CYAN_2)
        pset(px, w, h, x1 - 1, y1 - 1, WHITE_HI)
    elif mode == "fps":
        # Valorant / CS2 high-contrast arena corridor + crisp crosshair + ammo HUD
        for yy in range(sh):
            for xx in range(sw):
                if yy < 2:
                    c = SLATE_3
                elif xx in (0, sw - 1):
                    c = RED_2 if yy < 4 else SLATE_2
                elif yy >= sh - 2:
                    c = SLATE_1
                else:
                    c = mix(SLATE_4, AMB_2, 0.35) if 2 <= xx <= sw - 3 else SLATE_3
                pset(px, w, h, x0 + xx, y0 + yy, c)
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        pset(px, w, h, cx, cy, GRN_5)
        pset(px, w, h, cx - 2, cy, RED_5)
        pset(px, w, h, cx + 2, cy, RED_5)
        pset(px, w, h, x0 + 1, y1, CYAN_5)
        pset(px, w, h, x1 - 1, y1, RED_5)
    elif mode == "sub_chat":
        # Discord / OP.GG dark secondary monitor
        fill_rect(px, w, h, x0, y0, x1, y1, hx("#181d2c"))
        fill_rect(px, w, h, x0, y0, x0 + 1, y1, hx("#121622"))
        for yy in range(y0 + 1, y1, 2):
            pset(px, w, h, x0 + 3, yy, CYAN_5 if yy % 4 == 1 else STEEL_2)
            pset(px, w, h, x0 + 4, yy, BLUE_4 if yy % 4 == 1 else SLATE_6)
            if x0 + 6 <= x1:
                pset(px, w, h, x0 + 6, yy, PUR_4 if yy == y0 + 1 else SLATE_5)
    elif mode == "launcher":
        # Korean PC bang launcher screen ("피카/게토 요금제" blue wallpaper + game icons)
        fill_rect(px, w, h, x0, y0, x1, y1, BLUE_1)
        fill_rect(px, w, h, x1 - 3, y0, x1, y0 + 2, CYAN_3)
        for gx in range(x0 + 1, x1 - 3, 2):
            pset(px, w, h, gx, y0 + 2, AMB_3 if gx % 4 == 1 else CYAN_5)
            pset(px, w, h, gx, y0 + 4, RED_5 if gx % 4 == 1 else GRN_4)


def _draw_chair_north_facing_south(px, w: int, h: int, cx: int, y_top: int, accent: tuple[int, int, int], accent_hi: tuple[int, int, int]):
    """
    `chair_s` (customer sits on North side of spine, faces SOUTH):
    Seen from 3/4 front-top, neatly tucked under the north desk!
    cx is center x (~13), occupies roughly x=5..21, y=y_top..y_top+15.
    """
    # Outer dark outline of high-back bucket headrest & shoulders
    fill_rect(px, w, h, cx - 5, y_top, cx + 5, y_top + 3, INK)
    fill_rect(px, w, h, cx - 7, y_top + 3, cx + 7, y_top + 13, INK)
    # Headrest shell + neck pillow
    fill_rect(px, w, h, cx - 4, y_top + 1, cx + 4, y_top + 3, SLATE_4)
    pset(px, w, h, cx - 4, y_top + 1, accent_hi)
    pset(px, w, h, cx + 4, y_top + 1, accent)
    fill_rect(px, w, h, cx - 2, y_top + 2, cx + 2, y_top + 3, INK)  # neck pillow
    # Contoured bucket backrest front cushion + colored wing stripes
    fill_rect(px, w, h, cx - 6, y_top + 4, cx + 6, y_top + 11, SLATE_3)
    fill_rect(px, w, h, cx - 4, y_top + 4, cx + 4, y_top + 11, SLATE_2)
    for yy in range(y_top + 4, y_top + 11):
        pset(px, w, h, cx - 5, yy, accent_hi if yy < y_top + 7 else accent)
        pset(px, w, h, cx + 5, yy, accent)
    # Subtle diamond stitch on inner backrest
    pset(px, w, h, cx - 2, y_top + 6, SLATE_4)
    pset(px, w, h, cx + 2, y_top + 6, SLATE_4)
    pset(px, w, h, cx, y_top + 8, SLATE_4)
    # Armrests & seat cushion front tucked into north desk
    fill_rect(px, w, h, cx - 8, y_top + 8, cx - 7, y_top + 13, INK)
    fill_rect(px, w, h, cx + 7, y_top + 8, cx + 8, y_top + 13, INK)
    pset(px, w, h, cx - 7, y_top + 8, SLATE_6)
    pset(px, w, h, cx + 7, y_top + 8, SLATE_6)
    fill_rect(px, w, h, cx - 5, y_top + 11, cx + 5, y_top + 13, SLATE_4)
    fill_rect(px, w, h, cx - 4, y_top + 12, cx + 4, y_top + 13, SLATE_2)


def _draw_chair_south_facing_north(px, w: int, h: int, cx: int, y_top: int, accent: tuple[int, int, int], accent_hi: tuple[int, int, int]):
    """
    `chair_n` (customer sits on South side of spine, faces NORTH):
    Iconic Korean PC bang high-back racing chair seen from the BACK!
    cx is center x (~13), occupies y_top..y_top+17 (18px tall).
    """
    # Armrests peeking on left & right of desk edge
    fill_rect(px, w, h, cx - 8, y_top + 4, cx - 7, y_top + 10, INK)
    fill_rect(px, w, h, cx + 7, y_top + 4, cx + 8, y_top + 10, INK)
    pset(px, w, h, cx - 7, y_top + 4, SLATE_5)
    pset(px, w, h, cx + 7, y_top + 4, SLATE_5)

    # Molded racing headrest + angled shoulder wings (back view)
    fill_rect(px, w, h, cx - 5, y_top, cx + 5, y_top + 3, INK)
    fill_rect(px, w, h, cx - 7, y_top + 3, cx + 7, y_top + 13, INK)
    fill_rect(px, w, h, cx - 4, y_top + 1, cx + 4, y_top + 2, SLATE_5)
    # Accent racing trim along top & shoulder bolsters
    pset(px, w, h, cx - 4, y_top + 1, accent_hi)
    pset(px, w, h, cx + 4, y_top + 1, accent)
    for yy in range(y_top + 3, y_top + 12):
        pset(px, w, h, cx - 6, yy, accent_hi if yy < y_top + 7 else accent)
        pset(px, w, h, cx + 6, yy, accent)
    # Matte charcoal rear polymer/leather back shell + central spine rib & harness grommets
    fill_rect(px, w, h, cx - 5, y_top + 3, cx + 5, y_top + 12, SLATE_3)
    fill_rect(px, w, h, cx - 3, y_top + 4, cx + 3, y_top + 12, SLATE_2)
    pset(px, w, h, cx - 2, y_top + 3, INK)  # left harness slot
    pset(px, w, h, cx + 2, y_top + 3, INK)  # right harness slot
    pset(px, w, h, cx, y_top + 4, accent_hi)  # tiny esports logo dot on back!
    for yy in range(y_top + 6, y_top + 12):
        pset(px, w, h, cx, yy, SLATE_4)
    # Bottom seat pan bevel
    fill_rect(px, w, h, cx - 5, y_top + 12, cx + 5, y_top + 13, INK)
    # 5-star gas-lift pedestal & dual caster wheels
    fill_rect(px, w, h, cx - 1, y_top + 13, cx + 1, y_top + 15, INK)
    pset(px, w, h, cx, y_top + 14, SLATE_5)
    # 5-star legs
    for dx in range(-6, 7):
        pset(px, w, h, cx + dx, y_top + 15, SLATE_4 if abs(dx) < 5 else INK)
    for wx in (cx - 6, cx - 3, cx, cx + 3, cx + 6):
        pset(px, w, h, wx, y_top + 16, INK)
        pset(px, w, h, wx, y_top + 17, SLATE_5 if wx == cx else INK)


def make_b2b_pod(theme: str = "blue", screen_main: str | None = None, seat_tag_lit: bool = True) -> Image.Image:
    """
    `b2b_pod_blue.png` / `b2b_pod_red.png` (32x64 px = 2x4 tiles):
    Repeatable 2-tile-wide Back-to-Back Korean PC Bang Pair!
    - y=0..15:  North gaming chair (`chair_s`, tucked, facing SOUTH)
    - y=13..26: North desk + curved dual monitors seen from BACK (`desk_back`) + rear V-LED + PC tower
    - y=26..30: Continuous full-width dark partition spine (`x=0..31`) + glowing seat tag + headset hook
    - y=30..47: South desk + glowing curved dual monitors seen from FRONT (`desk_front`) + RGB TKL keyboard + RGB tower
    - y=45..62: South high-back bucket gaming chair seen from BACK (`chair_n`)
    """
    w, h = 32, 64
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()

    if theme == "red":
        acc, acc_hi, acc_dk = RED_4, RED_6, RED_2
        s_mode = screen_main or "fps"
    else:
        acc, acc_hi, acc_dk = CYAN_4, CYAN_6, CYAN_2
        s_mode = screen_main or "lol"

    # 1) North Chair (`chair_s`, customer sits on north facing south)
    _draw_chair_north_facing_south(px, w, h, cx=12, y_top=1, accent=acc, accent_hi=acc_hi)

    # 2) North Desk Slab (`x=0..31, y=18..26` — continuous edge-to-edge!)
    fill_rect(px, w, h, 0, 18, 31, 26, SLATE_1)
    fill_rect(px, w, h, 0, 18, 31, 18, INK)
    fill_rect(px, w, h, 0, 19, 30, 19, SLATE_4)  # north desk top lip
    fill_rect(px, w, h, 31, 19, 31, 26, INK)      # subtle 1px station divider seam

    # North Curved Dual Monitors Seen From The BACK (`desk_back`)
    # Primary wide curved monitor back (x=2..14, y=13..23) + secondary monitor back (x=15..23, y=14..23)
    fill_rect(px, w, h, 2, 13, 14, 22, INK)
    fill_rect(px, w, h, 3, 14, 13, 21, SLATE_3)
    fill_rect(px, w, h, 3, 14, 13, 14, SLATE_5)  # top bezel bevel
    # Signature rear V-LED wing glow on monitor back!
    pset(px, w, h, 5, 16, acc_hi)
    pset(px, w, h, 6, 17, acc)
    pset(px, w, h, 7, 18, acc)
    pset(px, w, h, 9, 18, acc)
    pset(px, w, h, 10, 17, acc)
    pset(px, w, h, 11, 16, acc_hi)
    # Monitor stand arm clamping to desk
    fill_rect(px, w, h, 7, 20, 9, 24, INK)
    pset(px, w, h, 8, 21, SLATE_5)

    # Secondary monitor back (x=15..23, y=14..22)
    fill_rect(px, w, h, 15, 14, 23, 22, INK)
    fill_rect(px, w, h, 16, 15, 22, 21, SLATE_2)
    fill_rect(px, w, h, 16, 15, 22, 15, SLATE_4)
    pset(px, w, h, 18, 18, acc)
    pset(px, w, h, 19, 18, acc_hi)
    pset(px, w, h, 20, 18, acc)
    fill_rect(px, w, h, 18, 21, 20, 24, INK)

    # North PC Mid-Tower Case (x=25..30, y=14..24)
    fill_rect(px, w, h, 25, 14, 30, 24, INK)
    fill_rect(px, w, h, 26, 15, 29, 23, SLATE_3)
    fill_rect(px, w, h, 26, 15, 29, 15, SLATE_5)
    pset(px, w, h, 27, 17, acc_hi)
    pset(px, w, h, 28, 17, acc)
    pset(px, w, h, 27, 20, acc_dk)
    pset(px, w, h, 28, 20, acc_dk)

    # 3) Central Low Dark Partition Spine (`x=0..31, y=26..30` — continuous flush spine!)
    fill_rect(px, w, h, 0, 26, 31, 30, INK)
    fill_rect(px, w, h, 0, 27, 31, 27, STEEL_1)  # brushed metallic spine rail cap
    fill_rect(px, w, h, 0, 28, 31, 29, SLATE_3)
    # Glowing Seat-Number Badge on partition spine (x=1..6, y=27..29)
    fill_rect(px, w, h, 1, 27, 6, 29, INK)
    if seat_tag_lit:
        pset(px, w, h, 2, 28, acc_hi)
        pset(px, w, h, 3, 28, acc)
        pset(px, w, h, 5, 28, WHITE_HI)
    # Metallic Headset Hook on spine right side (x=23..24, y=26..29)
    pset(px, w, h, 23, 26, STEEL_3)
    pset(px, w, h, 23, 27, STEEL_2)
    pset(px, w, h, 24, 28, SLATE_5)

    # 4) South Desk-Front (`desk_front`, customer faces NORTH — glowing screens + RGB setup!)
    # South desktop surface (`x=0..31, y=40..47` — continuous flush desk!)
    fill_rect(px, w, h, 0, 40, 31, 47, SLATE_2)
    fill_rect(px, w, h, 0, 40, 31, 40, INK)
    fill_rect(px, w, h, 0, 45, 30, 45, SLATE_5)  # crisp front desk edge bevel
    fill_rect(px, w, h, 0, 46, 31, 47, INK)      # under-desk shadow apron
    fill_rect(px, w, h, 31, 40, 31, 46, INK)     # subtle 1px bay divider

    # Glowing Curved Dual Monitors Seen From FRONT (x=2..14 main 27" screen, x=15..23 secondary screen)
    fill_rect(px, w, h, 2, 30, 14, 39, INK)
    _draw_screen_art(px, w, h, 3, 31, 13, 38, s_mode)
    pset(px, w, h, 8, 39, acc_hi)  # monitor power LED
    fill_rect(px, w, h, 7, 39, 9, 40, SLATE_4)

    fill_rect(px, w, h, 15, 31, 23, 39, INK)
    _draw_screen_art(px, w, h, 16, 32, 22, 38, "sub_chat")
    fill_rect(px, w, h, 18, 39, 20, 40, SLATE_4)

    # Tempered-Glass RGB Gaming PC Tower on South Desk right side (x=25..30, y=31..43)
    fill_rect(px, w, h, 25, 31, 30, 43, INK)
    fill_rect(px, w, h, 26, 32, 29, 42, hx("#192030"))
    fill_rect(px, w, h, 26, 32, 29, 32, SLATE_5)
    # Visible internal RGB AIO cooler ring + GPU light bar + front fans!
    pset(px, w, h, 27, 34, acc_hi)
    pset(px, w, h, 28, 34, acc)
    pset(px, w, h, 27, 35, acc)
    pset(px, w, h, 28, 35, PUR_4 if theme == "blue" else AMB_4)
    fill_rect(px, w, h, 26, 37, 28, 37, acc_hi)  # RGB GPU backplate strip
    pset(px, w, h, 29, 34, acc_hi)
    pset(px, w, h, 29, 37, acc)
    pset(px, w, h, 29, 40, acc_hi)

    # Extended Dark Gaming Mousepad (x=3..22, y=41..44) + RGB TKL Keyboard + Gaming Mouse
    fill_rect(px, w, h, 3, 41, 22, 44, hx("#161a26"))
    stroke_rect(px, w, h, 3, 41, 22, 44, acc_dk)
    # Tenkeyless RGB mechanical keyboard (x=5..14, y=42..43)
    fill_rect(px, w, h, 5, 42, 14, 43, INK)
    rgb_keys = [acc_hi, PUR_4, GRN_4, acc, AMB_4, acc_hi, PNK_3, acc]
    for kx in range(6, 14):
        pset(px, w, h, kx, 42, rgb_keys[(kx - 6) % len(rgb_keys)])
    # Ultralight wireless mouse (x=18..19, y=42..43)
    pset(px, w, h, 18, 42, STEEL_3)
    pset(px, w, h, 19, 42, acc_hi)
    pset(px, w, h, 18, 43, SLATE_4)
    pset(px, w, h, 19, 43, INK)

    # 5) South High-Back Bucket Gaming Chair Seen From BACK (`chair_n`)
    _draw_chair_south_facing_north(px, w, h, cx=12, y_top=45, accent=acc, accent_hi=acc_hi)

    return im


def make_team_desk_blue() -> Image.Image:
    """
    `team_desk_blue.png` (32x48 px = 2x3 tiles):
    Single-sided 1-desk + 1-chair contiguous team booth unit (customer sits on south, faces north).
    5 of these side-by-side create the 5-Seat Team Room squad bench!
    """
    w, h = 32, 48
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()

    # Low acoustic partition & cyan LED header along back (y=3..9)
    fill_rect(px, w, h, 0, 4, 31, 9, INK)
    fill_rect(px, w, h, 0, 5, 31, 5, STEEL_1)
    fill_rect(px, w, h, 0, 6, 31, 6, CYAN_4)
    fill_rect(px, w, h, 0, 7, 31, 8, SLATE_3)
    # Seat number badge
    fill_rect(px, w, h, 1, 5, 6, 8, INK)
    pset(px, w, h, 2, 6, CYAN_6)
    pset(px, w, h, 4, 6, WHITE_HI)

    # Continuous Desk Surface (x=0..31, y=19..26)
    fill_rect(px, w, h, 0, 19, 31, 26, SLATE_2)
    fill_rect(px, w, h, 0, 19, 31, 19, INK)
    fill_rect(px, w, h, 0, 24, 30, 24, SLATE_5)
    fill_rect(px, w, h, 0, 25, 31, 26, INK)
    fill_rect(px, w, h, 31, 19, 31, 25, INK)

    # Dual Curved Monitors Seen From FRONT (y=8..18)
    fill_rect(px, w, h, 2, 8, 14, 18, INK)
    _draw_screen_art(px, w, h, 3, 9, 13, 17, "lol")
    pset(px, w, h, 8, 18, CYAN_6)
    fill_rect(px, w, h, 7, 18, 9, 19, SLATE_4)

    fill_rect(px, w, h, 15, 9, 23, 18, INK)
    _draw_screen_art(px, w, h, 16, 10, 22, 17, "sub_chat")
    fill_rect(px, w, h, 18, 18, 20, 19, SLATE_4)

    # Tempered-glass RGB PC Tower (x=25..30, y=9..22)
    fill_rect(px, w, h, 25, 9, 30, 22, INK)
    fill_rect(px, w, h, 26, 10, 29, 21, hx("#192030"))
    fill_rect(px, w, h, 26, 10, 29, 10, SLATE_5)
    pset(px, w, h, 27, 12, CYAN_6)
    pset(px, w, h, 28, 12, CYAN_4)
    pset(px, w, h, 27, 13, CYAN_4)
    pset(px, w, h, 28, 13, PUR_4)
    fill_rect(px, w, h, 26, 16, 28, 16, CYAN_6)
    pset(px, w, h, 29, 12, CYAN_6)
    pset(px, w, h, 29, 16, CYAN_4)
    pset(px, w, h, 29, 19, CYAN_6)

    # Deskpad + TKL RGB Keyboard + Mouse (y=20..23)
    fill_rect(px, w, h, 3, 20, 22, 23, hx("#161a26"))
    stroke_rect(px, w, h, 3, 20, 22, 23, CYAN_2)
    fill_rect(px, w, h, 5, 21, 14, 22, INK)
    for kx in range(6, 14):
        pset(px, w, h, kx, 21, [CYAN_6, PUR_4, GRN_4, CYAN_4][(kx - 6) % 4])
    pset(px, w, h, 18, 21, STEEL_3)
    pset(px, w, h, 19, 21, CYAN_6)

    # South High-Back Bucket Gaming Chair Seen From BACK (y=25..42 -> shifted to y=28..45)
    _draw_chair_south_facing_north(px, w, h, cx=12, y_top=28, accent=CYAN_4, accent_hi=CYAN_6)
    return im


def make_prepay_kiosk() -> Image.Image:
    """`prepay_kiosk.png` (16x32): Korean PC Bang Prepay Kiosk (무인 선불결제기 — 게토/피카)."""
    w, h = 16, 32
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()

    # Main tall dark steel kiosk cabinet (x=2..13, y=1..29)
    fill_rect(px, w, h, 2, 1, 13, 29, INK)
    # 3/4 top bevel cap
    fill_rect(px, w, h, 3, 2, 12, 3, SLATE_5)
    fill_rect(px, w, h, 3, 2, 12, 2, STEEL_2)
    # Glowing cyan top sign ("PC PAY")
    fill_rect(px, w, h, 3, 4, 12, 5, CYAN_2)
    for sx in (4, 6, 9, 11):
        pset(px, w, h, sx, 4, CYAN_6)
    # Cabinet front frame
    fill_rect(px, w, h, 3, 6, 12, 27, SLATE_3)
    fill_rect(px, w, h, 3, 6, 3, 27, SLATE_4)
    # Bright glowing blue touchscreen (x=4..11, y=7..16) with fee-plan grid buttons!
    fill_rect(px, w, h, 3, 6, 12, 17, INK)
    fill_rect(px, w, h, 4, 7, 11, 16, BLUE_2)
    fill_rect(px, w, h, 4, 7, 11, 8, CYAN_4)  # top banner
    # 2x3 touch plan cards (1,000 / 2,000 / 5,000 / 회원)
    for by in (10, 13):
        fill_rect(px, w, h, 5, by, 7, by + 1, CYAN_5)
        fill_rect(px, w, h, 8, by, 10, by + 1, AMB_3 if by == 13 else BLUE_5)
    pset(px, w, h, 5, 15, WHITE_HI)
    pset(px, w, h, 6, 15, CYAN_6)
    # Card / QR / Cash insertion bay (y=18..23)
    fill_rect(px, w, h, 4, 18, 11, 23, SLATE_1)
    # Cash bill acceptor with green LED
    fill_rect(px, w, h, 5, 19, 7, 19, GRN_4)
    fill_rect(px, w, h, 5, 20, 7, 20, INK)
    # Credit/Samsung Pay yellow/cyan reader
    fill_rect(px, w, h, 9, 19, 10, 21, AMB_3)
    pset(px, w, h, 9, 20, INK)
    # Receipt slot
    fill_rect(px, w, h, 5, 22, 9, 22, STEEL_3)
    # Lower access panel + flared heavy steel baseplate
    stroke_rect(px, w, h, 4, 24, 11, 27, SLATE_2)
    fill_rect(px, w, h, 1, 28, 14, 30, INK)
    fill_rect(px, w, h, 2, 29, 13, 29, SLATE_5)
    return im


def make_counter_pos_dark() -> Image.Image:
    """`counter_pos_dark.png` (48x32): Open dark-slate PC Bang Alba POS & Food Pickup Counter."""
    w, h = 48, 32
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()

    # Main counter body (x=0..47, y=10..30)
    fill_rect(px, w, h, 0, 10, 47, 30, INK)
    # Polished dark quartz 3/4 countertop (y=10..15)
    fill_rect(px, w, h, 1, 11, 46, 15, SLATE_4)
    fill_rect(px, w, h, 1, 11, 46, 11, STEEL_2)  # crisp top-left light edge
    fill_rect(px, w, h, 1, 15, 46, 15, STEEL_1)  # front counter bullnose lip
    # Recessed cyan LED under-counter strip at y=17!
    fill_rect(px, w, h, 1, 16, 46, 16, INK)
    for x in range(2, 46):
        pset(px, w, h, x, 17, CYAN_4 if x % 12 != 0 else CYAN_2)
    # Architectural vertical slatted dark-charcoal front panels (y=18..29)
    for x in range(1, 47):
        rx = x % 4
        c = INK if rx == 0 else SLATE_3 if rx == 1 else SLATE_2 if rx == 2 else SLATE_1
        for y in range(18, 29):
            pset(px, w, h, x, y, c)
    # Brushed steel kickplate (y=29)
    fill_rect(px, w, h, 1, 29, 46, 29, SLATE_5)

    # Dual POS Monitor Terminal + Barcode Scanner on left half (x=4..22, y=2..13)
    fill_rect(px, w, h, 4, 2, 14, 10, INK)
    fill_rect(px, w, h, 5, 3, 13, 9, SLATE_3)
    fill_rect(px, w, h, 5, 3, 13, 3, STEEL_2)
    pset(px, w, h, 9, 6, CYAN_5)  # rear brand LED on POS screen
    fill_rect(px, w, h, 8, 10, 10, 12, INK)

    # Customer-facing small fee/order display screen (x=16..22, y=5..11)
    fill_rect(px, w, h, 16, 5, 22, 11, INK)
    fill_rect(px, w, h, 17, 6, 21, 10, BLUE_2)
    pset(px, w, h, 18, 7, CYAN_6)
    pset(px, w, h, 19, 7, WHITE_HI)
    pset(px, w, h, 18, 9, GRN_4)
    # Barcode scanner on stand (x=24..26, y=7..12)
    fill_rect(px, w, h, 24, 7, 26, 9, INK)
    pset(px, w, h, 25, 8, RED_5)
    pset(px, w, h, 25, 10, INK)
    pset(px, w, h, 25, 11, SLATE_5)

    # Food Pickup Tray on right half (x=30..43, y=8..14): dark tray + steaming ramen bowl + iced coffee!
    fill_rect(px, w, h, 30, 11, 43, 14, INK)
    fill_rect(px, w, h, 31, 12, 42, 13, SLATE_2)
    # Ramen bowl on tray
    fill_rect(px, w, h, 32, 9, 37, 12, RED_4)
    fill_rect(px, w, h, 33, 9, 36, 10, AMB_4)
    pset(px, w, h, 34, 7, WHITE_HI)  # steam wisp
    pset(px, w, h, 36, 6, STEEL_3)
    # Iced Americano with green straw on tray
    pset(px, w, h, 40, 7, GRN_4)
    fill_rect(px, w, h, 39, 8, 41, 12, hx("#411e06"))
    fill_rect(px, w, h, 39, 8, 41, 9, WHITE_HI)
    return im


def make_counter_l_wing() -> Image.Image:
    """
    Matching 16x48 (fw=1, fh=2, up=16) N-S L-return bar so `counter_pos_dark` (48x32)
    fuses at x=0 with ZERO seam into a true continuous ㄱ-shaped dark quartz counter!
    Placed at (5, 6) with up=16 -> spans Y=80..127, aligning its bottom (y=26..46)
    pixel-for-pixel with `counter_pos_dark` at (2..4, 7) (Y=96..127, y=10..30)!
    """
    w, h = 16, 48
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    # Vertical return wing (x=0..14, y=6..46) — x=0 is open on y=26..46 to fuse seamlessly!
    fill_rect(px, w, h, 0, 6, 14, 46, INK)
    # N-S dark quartz countertop slab (y=7..31)
    fill_rect(px, w, h, 1, 7, 13, 31, SLATE_4)
    fill_rect(px, w, h, 1, 7, 13, 7, STEEL_2)
    fill_rect(px, w, h, 1, 7, 1, 26, STEEL_2)
    fill_rect(px, w, h, 13, 7, 13, 31, STEEL_1)
    # Seamless fusion with counter_pos_dark right edge on y=27..31 (x=0)
    fill_rect(px, w, h, 0, 27, 12, 31, SLATE_4)
    pset(px, w, h, 0, 27, STEEL_2)
    pset(px, w, h, 0, 31, STEEL_1)
    fill_rect(px, w, h, 0, 31, 13, 31, STEEL_1)

    # Napkin dispenser, straw cup & order bell on N-S bar top
    fill_rect(px, w, h, 4, 11, 10, 15, INK)
    fill_rect(px, w, h, 5, 12, 9, 14, STEEL_3)
    fill_rect(px, w, h, 5, 18, 9, 23, INK)
    pset(px, w, h, 6, 17, GRN_4)
    pset(px, w, h, 8, 17, AMB_3)
    fill_rect(px, w, h, 6, 19, 8, 22, SLATE_5)

    # Front face (y=32..45) continues counter_pos_dark's exact cyan LED & vertical slats!
    fill_rect(px, w, h, 0, 32, 13, 32, INK)
    for x in range(0, 14):
        pset(px, w, h, x, 33, CYAN_4 if x != 8 else CYAN_2)
    for x in range(0, 14):
        rx = x % 4
        c = INK if rx == 0 else SLATE_3 if rx == 1 else SLATE_2 if rx == 2 else SLATE_1
        for y in range(34, 45):
            pset(px, w, h, x, y, c)
    fill_rect(px, w, h, 0, 45, 13, 45, SLATE_5)
    return im


def make_ramen_water_bar() -> Image.Image:
    """
    `ramen_water_bar.png` (48x32):
    Self-serve Hangang Ramen automatic induction bar (left 32px) + commercial Ice/Water Purifier `정수기` (right 16px).
    """
    w, h = 48, 32
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()

    # Left 32px (x=0..31): Stainless & Dark-Slate Hangang Ramen Station
    fill_rect(px, w, h, 0, 6, 31, 30, INK)
    # Upper backsplash shelf with instruction header ("한강라면 조리기")
    fill_rect(px, w, h, 1, 7, 30, 11, SLATE_3)
    fill_rect(px, w, h, 2, 8, 29, 9, RED_3)
    for tx in range(4, 27, 3):
        pset(px, w, h, tx, 8, WHITE_HI)
    # Stainless steel countertop (y=12..17)
    fill_rect(px, w, h, 1, 12, 30, 17, STEEL_2)
    fill_rect(px, w, h, 1, 12, 30, 12, STEEL_4)
    # Induction Cooker #1 (x=3..13, simmering square foil ramen bowl!)
    fill_rect(px, w, h, 3, 10, 13, 16, INK)
    fill_rect(px, w, h, 4, 11, 12, 15, STEEL_3)
    fill_rect(px, w, h, 5, 11, 11, 13, ORG_3)  # boiling spicy ramen broth!
    pset(px, w, h, 7, 12, AMB_4)
    pset(px, w, h, 9, 12, GRN_4)
    pset(px, w, h, 7, 8, WHITE_HI)  # steam
    pset(px, w, h, 9, 7, STEEL_4)
    pset(px, w, h, 5, 15, RED_5)    # timer LED

    # Induction Cooker #2 (x=17..27, ready black induction glass circle + barcode scanner)
    fill_rect(px, w, h, 17, 11, 27, 16, INK)
    fill_rect(px, w, h, 18, 12, 26, 15, SLATE_1)
    stroke_rect(px, w, h, 20, 13, 24, 14, RED_4)
    pset(px, w, h, 25, 15, GRN_4)

    # Lower cabinet with stacked white foil bowls & wood chopsticks cubby (y=18..29)
    fill_rect(px, w, h, 1, 18, 30, 29, SLATE_2)
    fill_rect(px, w, h, 3, 20, 14, 27, INK)
    # Neat stacks of white foil ramen bowls
    for sx in (5, 10):
        fill_rect(px, w, h, sx, 22, sx + 3, 26, STEEL_4)
        fill_rect(px, w, h, sx, 23, sx + 3, 23, STEEL_1)
        fill_rect(px, w, h, sx, 25, sx + 3, 25, STEEL_1)
    # Right cabinet door
    stroke_rect(px, w, h, 16, 20, 28, 27, SLATE_4)
    pset(px, w, h, 18, 23, STEEL_3)

    # Right 16px (x=32..47): Tall Commercial Ice & Water Purifier (`정수기`)
    fill_rect(px, w, h, 33, 1, 46, 30, INK)
    fill_rect(px, w, h, 34, 2, 45, 3, STEEL_3)   # top cap
    fill_rect(px, w, h, 34, 4, 45, 29, SLATE_4)  # brushed dark-silver body
    fill_rect(px, w, h, 34, 4, 35, 29, STEEL_2)  # left highlight
    # Status panel + Hot(Red) / Cold(Cyan) / Ice(White) tap LEDs!
    fill_rect(px, w, h, 36, 6, 43, 8, INK)
    pset(px, w, h, 37, 7, RED_5)    # 온수 (Hot)
    pset(px, w, h, 39, 7, WHITE_HI) # 얼음 (Ice)
    pset(px, w, h, 41, 7, CYAN_5)   # 냉수 (Cold)
    # Recessed dark dispensing alcove + drip grille (y=10..18)
    fill_rect(px, w, h, 36, 10, 43, 18, INK)
    fill_rect(px, w, h, 37, 11, 42, 16, SLATE_1)
    pset(px, w, h, 38, 11, RED_4)
    pset(px, w, h, 41, 11, CYAN_4)
    fill_rect(px, w, h, 37, 17, 42, 17, STEEL_2)  # chrome drip tray
    # Lower purifier front + side paper-cup tube
    stroke_rect(px, w, h, 36, 20, 43, 28, SLATE_3)
    fill_rect(px, w, h, 45, 8, 46, 19, STEEL_4)   # paper cup dispenser cylinder
    stroke_rect(px, w, h, 45, 8, 46, 19, INK)
    return im


def make_drink_fridge_triple() -> Image.Image:
    """
    `drink_fridge_triple.png` (48x32):
    3 glass-door commercial beverage showcase fridges side-by-side packed with colorful cans!
    """
    w, h = 48, 32
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()

    shelf_palettes = [
        # Fridge 0: Energy drinks & sodas (Monster green, Hot6 blue/orange, Cola red)
        [(GRN_4, INK), (CYAN_5, BLUE_2), (ORG_3, BLUE_1), (RED_4, WHITE_HI)],
        # Fridge 1: Canned coffees, Iced Tea, Chilsung Cider, Pocari
        [(AMB_1, AMB_3), (AMB_3, ORG_2), (GRN_3, WHITE_HI), (BLUE_4, WHITE_HI)],
        # Fridge 2: Bottled ades, grape/peach drinks, sparkling water
        [(PNK_3, WHITE_HI), (PUR_4, PUR_2), (AMB_4, ORG_3), (CYAN_6, CYAN_2)],
    ]

    for idx in range(3):
        x0 = idx * 16
        fill_rect(px, w, h, x0, 1, x0 + 15, 30, INK)
        # Top bevel + glowing cool-white header bar
        fill_rect(px, w, h, x0 + 1, 2, x0 + 14, 2, SLATE_5)
        fill_rect(px, w, h, x0 + 2, 3, x0 + 13, 4, CYAN_6 if idx == 1 else STEEL_4)
        # Glass door frame (x0+1..x0+14, y=5..25)
        fill_rect(px, w, h, x0 + 1, 5, x0 + 14, 25, SLATE_4)
        fill_rect(px, w, h, x0 + 2, 6, x0 + 13, 24, hx("#142230"))  # cool backlit interior

        # 4 illuminated shelves of colorful beverage cans!
        rows_y = [7, 11, 15, 19]
        for s_i, sy in enumerate(rows_y):
            c_main, c_sub = shelf_palettes[idx][s_i]
            for cx in range(x0 + 3, x0 + 13, 2):
                pset(px, w, h, cx, sy, c_main)
                pset(px, w, h, cx, sy + 1, c_sub)
                pset(px, w, h, cx, sy + 2, c_main)
            # Crisp white shelf wire
            fill_rect(px, w, h, x0 + 2, sy + 3, x0 + 13, sy + 3, STEEL_2)

        # Diagonal tempered-glass sheen + vertical silver door handle
        pset(px, w, h, x0 + 3, 8, CYAN_6)
        pset(px, w, h, x0 + 4, 9, CYAN_5)
        pset(px, w, h, x0 + 5, 10, CYAN_6)
        fill_rect(px, w, h, x0 + 13, 12, x0 + 13, 18, STEEL_4)

        # Bottom black compressor louver grille (y=26..29)
        fill_rect(px, w, h, x0 + 1, 26, x0 + 14, 29, SLATE_2)
        for gy in (27, 29):
            fill_rect(px, w, h, x0 + 3, gy, x0 + 12, gy, INK)
        pset(px, w, h, x0 + 12, 28, GRN_4)  # temp OK LED
    return im


def make_snack_ramen_rack() -> Image.Image:
    """`snack_ramen_rack.png` (32x32): 4-tier matte-dark wire rack packed with cup ramen & PC-bang snacks."""
    w, h = 32, 32
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()

    # Outer dark steel upright posts & top sign header
    fill_rect(px, w, h, 1, 2, 30, 30, INK)
    fill_rect(px, w, h, 2, 3, 29, 5, AMB_2)
    for sx in range(5, 27, 3):
        pset(px, w, h, sx, 4, WHITE_HI)

    fill_rect(px, w, h, 2, 6, 29, 29, SLATE_1)
    # 4 shelves at y=10, 16, 22, 28
    # Tier 1 (y=7..9): Shin Ramyun red cup boxes & Jin Ramen yellow/blue cups
    for x in range(3, 15, 3):
        fill_rect(px, w, h, x, 7, x + 1, 9, RED_4)
        pset(px, w, h, x, 7, WHITE_HI)
    for x in range(16, 28, 3):
        fill_rect(px, w, h, x, 7, x + 1, 9, AMB_3)
        pset(px, w, h, x + 1, 8, BLUE_4)
    fill_rect(px, w, h, 2, 10, 29, 10, STEEL_2)

    # Tier 2 (y=12..15): Buldak black/pink bowls + Chapagetti green/amber packs
    for x in range(3, 15, 3):
        fill_rect(px, w, h, x, 12, x + 1, 15, PNK_3 if x % 2 == 0 else SLATE_4)
        pset(px, w, h, x, 13, RED_5)
    for x in range(16, 28, 3):
        fill_rect(px, w, h, x, 12, x + 1, 15, ORG_3)
        pset(px, w, h, x + 1, 12, GRN_4)
    fill_rect(px, w, h, 2, 16, 29, 16, STEEL_2)

    # Tier 3 (y=18..21): Puffy chip bags (Honey Butter yellow, Shrimp Cracker red, Onion green)
    bag_cols = [AMB_4, RED_5, GRN_4, CYAN_5, PUR_4, ORG_3]
    for i, x in enumerate(range(3, 27, 4)):
        fill_rect(px, w, h, x, 18, x + 2, 21, bag_cols[i % len(bag_cols)])
        pset(px, w, h, x + 1, 19, WHITE_HI)
    fill_rect(px, w, h, 2, 22, 29, 22, STEEL_2)

    # Tier 4 (y=24..27): Bulk brown ramen cardboard cartons at bottom!
    fill_rect(px, w, h, 3, 24, 14, 27, hx("#86472c"))
    fill_rect(px, w, h, 4, 25, 13, 25, RED_4)
    fill_rect(px, w, h, 16, 24, 28, 27, hx("#a77950"))
    fill_rect(px, w, h, 17, 25, 27, 25, BLUE_3)
    fill_rect(px, w, h, 2, 28, 29, 29, SLATE_5)
    return im


def make_tray_return_bin() -> Image.Image:
    """
    `tray_return_bin.png` (32x32):
    Korean PC Bang 3-bin Recycle & Food Tray Return Station (`퇴식구 · 분리수거함`).
    """
    w, h = 32, 32
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()

    # Main stainless-framed dark cabinet (x=1..30, y=4..30)
    fill_rect(px, w, h, 1, 4, 30, 30, INK)
    # Top tray-return rack (`퇴식구`, y=5..12)
    fill_rect(px, w, h, 2, 5, 29, 12, SLATE_4)
    fill_rect(px, w, h, 2, 5, 29, 5, STEEL_3)
    # Stacked dark return trays on left + used cup/bowl on right
    fill_rect(px, w, h, 4, 7, 15, 11, INK)
    fill_rect(px, w, h, 5, 8, 14, 8, SLATE_6)
    fill_rect(px, w, h, 5, 10, 14, 10, SLATE_5)
    fill_rect(px, w, h, 18, 8, 22, 11, RED_4)     # returned ramen cup
    fill_rect(px, w, h, 24, 7, 27, 11, STEEL_4)   # tissue/napkin box

    # Middle 3-chute color-coded waste & liquid drop holes (y=13..20)
    fill_rect(px, w, h, 2, 13, 29, 20, SLATE_3)
    chutes = [
        (3, 10, CYAN_4),   # 캔/플라스틱 (Cans/Plastic)
        (12, 19, AMB_3),   # 일반쓰레기 (General)
        (21, 28, GRN_4),   # 남은음식/국물 (Food/Broth)
    ]
    for cx0, cx1, badge_c in chutes:
        fill_rect(px, w, h, cx0, 14, cx1, 14, badge_c)
        fill_rect(px, w, h, cx0, 15, cx1, 19, INK)
        fill_rect(px, w, h, cx0 + 1, 16, cx1 - 1, 18, SLATE_1)

    # Lower 3-door steel bin cabinet (y=21..29)
    fill_rect(px, w, h, 2, 21, 29, 29, SLATE_2)
    for dx0, dx1 in ((3, 10), (12, 19), (21, 28)):
        stroke_rect(px, w, h, dx0, 22, dx1, 28, SLATE_4)
        pset(px, w, h, dx0 + 3, 24, STEEL_3)
    return im


def make_smoking_ashtray() -> Image.Image:
    """`smoking_ashtray.png` (16x32): Brushed stainless cylindrical standing ashtray with glowing ember."""
    w, h = 16, 32
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()

    # Subtle smoke wisp pixels above ashtray
    pset(px, w, h, 8, 3, STEEL_2)
    pset(px, w, h, 7, 5, STEEL_3)
    # Cylindrical stainless column (x=5..10, y=7..28) + weighted round base (x=3..12, y=27..30)
    fill_rect(px, w, h, 5, 7, 10, 28, INK)
    fill_rect(px, w, h, 3, 27, 12, 30, INK)
    # Top recessed ash basin + glowing orange cigarette ember
    fill_rect(px, w, h, 6, 8, 9, 9, SLATE_1)
    pset(px, w, h, 6, 7, STEEL_4)
    pset(px, w, h, 9, 7, STEEL_2)
    pset(px, w, h, 8, 8, ORG_3)
    pset(px, w, h, 7, 8, AMB_4)
    # Vertical cylindrical metallic shading (left highlight, mid steel, right shadow)
    for y in range(10, 27):
        pset(px, w, h, 6, y, STEEL_4 if y < 18 else STEEL_3)
        pset(px, w, h, 7, y, STEEL_2)
        pset(px, w, h, 8, y, STEEL_1)
        pset(px, w, h, 9, y, SLATE_4)
    # Side disposal aperture (y=13..15)
    fill_rect(px, w, h, 7, 13, 8, 15, INK)
    # Chrome base ring highlight
    fill_rect(px, w, h, 4, 28, 11, 29, STEEL_2)
    fill_rect(px, w, h, 5, 28, 8, 28, STEEL_4)
    return im


def make_glass_booth_vent() -> Image.Image:
    """`glass_booth_vent.png` (32x32): Ceiling/upper-wall smoke extraction exhaust hood + `SMOKING` indicator."""
    w, h = 32, 32
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()

    # Upper exhaust duct riser into ceiling (x=9..22, y=0..7)
    fill_rect(px, w, h, 9, 0, 22, 8, INK)
    fill_rect(px, w, h, 10, 0, 21, 7, SLATE_4)
    fill_rect(px, w, h, 11, 0, 13, 7, STEEL_2)
    # Flared industrial smoke extraction canopy hood (x=2..29, y=8..22)
    fill_rect(px, w, h, 2, 8, 29, 22, INK)
    fill_rect(px, w, h, 3, 9, 28, 11, STEEL_2)
    fill_rect(px, w, h, 3, 9, 28, 9, STEEL_4)
    fill_rect(px, w, h, 3, 12, 28, 21, SLATE_3)
    # Twin dark suction louver filter grilles
    for gx0, gx1 in ((5, 14), (17, 26)):
        fill_rect(px, w, h, gx0, 13, gx1, 18, INK)
        for ly in (14, 16, 18):
            fill_rect(px, w, h, gx0 + 1, ly, gx1 - 1, ly, SLATE_5)
    # Active blue plasma-ionizer status strip + cigarette/vent badge (y=19..20)
    fill_rect(px, w, h, 5, 20, 12, 20, CYAN_5)
    pset(px, w, h, 24, 20, GRN_4)
    pset(px, w, h, 26, 20, CYAN_6)
    return im


# ---------------------------------------------------------------------------
# 4. Translucent Tempered-Glass Partitions, Overhead Signage & Korean Gamers
# ---------------------------------------------------------------------------
def draw_translucent_glass_booth_h(
    base: Image.Image,
    x0_cell: int,
    x1_cell: int,
    y_cell: int,
    door_cells: tuple[int, int] | None = None,
    badge_text: str = "SMOKING",
    accent: tuple[int, int, int] = CYAN_5,
):
    """
    Renders a sleek 28px-tall dark-aluminium & translucent blue-grey tempered-glass
    partition wall along cell row `y_cell` (`x0_cell..x1_cell`), leaving `door_cells`
    open as a sliding glass doorway under a continuous overhead transom rail!
    """
    px = base.load()
    bw, bh = base.size
    x0 = x0_cell * 16
    x1 = (x1_cell + 1) * 16 - 1
    y_bot = (y_cell + 1) * 16 - 3
    y_top = y_bot - 26

    # Continuous top dark-aluminium transom header across full span (even over doorway!)
    fill_rect(px, bw, bh, x0, y_top, x1, y_top + 4, INK)
    fill_rect(px, bw, bh, x0 + 1, y_top + 1, x1 - 1, y_top + 1, STEEL_2)
    fill_rect(px, bw, bh, x0 + 1, y_top + 2, x1 - 1, y_top + 3, SLATE_3)

    # Illuminated sign plaque centered above doorway (or center of wall)
    if door_cells:
        sx0 = door_cells[0] * 16 + 2
        sx1 = (door_cells[1] + 1) * 16 - 3
    else:
        mid = (x0 + x1) // 2
        sx0, sx1 = mid - 14, mid + 14
    fill_rect(px, bw, bh, sx0, y_top - 2, sx1, y_top + 3, INK)
    fill_rect(px, bw, bh, sx0 + 1, y_top - 1, sx1 - 1, y_top + 2, CYAN_1 if accent == CYAN_5 else BLUE_1)
    for tx in range(sx0 + 3, sx1 - 2, 2):
        pset(px, bw, bh, tx, y_top, WHITE_HI if tx % 4 == 0 else accent)
        pset(px, bw, bh, tx, y_top + 1, accent)

    # Render each cell pane
    for cx in range(x0_cell, x1_cell + 1):
        cx0, cx1 = cx * 16, cx * 16 + 15
        if door_cells and door_cells[0] <= cx <= door_cells[1]:
            # Open sliding doorway: subtle brushed steel floor track + retracted sliding glass jambs!
            for xx in range(cx0, cx1 + 1):
                px[xx, y_bot] = mix(px[xx, y_bot][:3], STEEL_2, 0.55) + (255,)
            if cx == door_cells[0]:
                # Left retracted sliding door edge + vertical stainless pull handle
                for yy in range(y_top + 5, y_bot):
                    px[cx0, yy] = SLATE_6 + (255,)
                    px[cx0 + 1, yy] = mix(px[cx0 + 1, yy][:3], CYAN_5, 0.45) + (255,)
                fill_rect(px, bw, bh, cx0 + 2, y_top + 11, cx0 + 2, y_top + 16, WHITE_HI)
            if cx == door_cells[1]:
                # Right retracted sliding door edge + vertical stainless pull handle
                for yy in range(y_top + 5, y_bot):
                    px[cx1, yy] = SLATE_6 + (255,)
                    px[cx1 - 1, yy] = mix(px[cx1 - 1, yy][:3], CYAN_5, 0.45) + (255,)
                fill_rect(px, bw, bh, cx1 - 2, y_top + 11, cx1 - 2, y_top + 16, WHITE_HI)
            continue

        # Vertical aluminium mullions at pane edges
        fill_rect(px, bw, bh, cx0, y_top + 4, cx0 + 1, y_bot, INK)
        pset(px, bw, bh, cx0 + 1, y_top + 5, SLATE_6)
        fill_rect(px, bw, bh, cx1, y_top + 4, cx1, y_bot, INK)

        # Translucent blue-grey tempered glass tint over existing floor/objects behind it!
        for yy in range(y_top + 5, y_bot - 2):
            for xx in range(cx0 + 2, cx1):
                bg = px[xx, yy][:3]
                tinted = mix(bg, hx("#4e7c9e"), 0.34)
                diag = (xx - cx0) + (yy - y_top)
                if diag in (10, 11, 19):
                    tinted = mix(tinted, CYAN_6, 0.50 if diag == 10 else 0.28)
                px[xx, yy] = tinted + (255,)

        # Bottom dark aluminium kick rail
        fill_rect(px, bw, bh, cx0, y_bot - 2, cx1, y_bot, INK)
        fill_rect(px, bw, bh, cx0 + 1, y_bot - 1, cx1 - 1, y_bot - 1, SLATE_5)


def draw_translucent_glass_booth_v(
    base: Image.Image,
    x_cell: int,
    y_px_start: int,
    y_px_end: int,
    door_px_range: tuple[int, int] | None = None,
    align_left: bool = False,
):
    """
    Renders a sleek N-S dark-aluminium & translucent glass side partition along column `x_cell`
    from exact pixel `y_px_start` to `y_px_end`, so L-corners join with zero overhang or gap!
    """
    px = base.load()
    bw, bh = base.size
    gx0 = x_cell * 16 if align_left else x_cell * 16 + 8
    gx1 = gx0 + 7

    for yy in range(y_px_start, y_px_end + 1):
        if door_px_range and door_px_range[0] <= yy <= door_px_range[1]:
            px[gx0 + 3, yy] = mix(px[gx0 + 3, yy][:3], STEEL_2, 0.50) + (255,)
            px[gx0 + 4, yy] = mix(px[gx0 + 4, yy][:3], SLATE_4, 0.45) + (255,)
            if yy in (door_px_range[0], door_px_range[0] + 1):
                fill_rect(px, bw, bh, gx0, yy, gx1, yy, SLATE_6)
            elif yy in (door_px_range[0] + 2, door_px_range[0] + 3):
                pset(px, bw, bh, gx0 + 3, yy, WHITE_HI)  # sliding door handle highlight
            continue

        if (yy - y_px_start) % 16 == 0 or yy == y_px_end:
            fill_rect(px, bw, bh, gx0, yy, gx1, yy, SLATE_5 if yy != y_px_end else INK)
            continue

        px[gx0, yy] = INK + (255,)
        px[gx0 + 1, yy] = STEEL_2 + (255,)
        for xx in range(gx0 + 2, gx1 - 1):
            bg = px[xx, yy][:3]
            t = mix(bg, hx("#4e7c9e"), 0.38)
            if (xx + yy) % 11 in (0, 1):
                t = mix(t, CYAN_6, 0.40)
            px[xx, yy] = t + (255,)
        px[gx1 - 1, yy] = SLATE_4 + (255,)
        px[gx1, yy] = INK + (255,)


def make_wall_menu_board(kind: str = "food") -> Image.Image:
    """48x16 overhead glowing digital PC bang menu board (`FOOD` / `DRINK & CAFE`)."""
    w, h = 48, 16
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    fill_rect(px, w, h, 1, 1, 46, 14, INK)
    stroke_rect(px, w, h, 2, 2, 45, 13, SLATE_5)
    fill_rect(px, w, h, 3, 3, 44, 12, hx("#161c2b"))
    if kind == "food":
        # 3 food promo cards (Ramen, Hotdog/Tteokbokki, Fried Rice) + price bars
        fill_rect(px, w, h, 4, 4, 14, 11, hx("#241820"))
        fill_rect(px, w, h, 6, 6, 11, 9, RED_4)
        fill_rect(px, w, h, 7, 6, 10, 7, AMB_4)
        pset(px, w, h, 12, 10, WHITE_HI)

        fill_rect(px, w, h, 16, 4, 29, 11, hx("#1e2434"))
        fill_rect(px, w, h, 18, 6, 23, 8, ORG_3)
        fill_rect(px, w, h, 18, 10, 27, 10, AMB_3)

        fill_rect(px, w, h, 31, 4, 43, 11, hx("#1e2434"))
        for ly in (5, 7, 9, 11):
            fill_rect(px, w, h, 32, ly, 39, ly, STEEL_3 if ly == 5 else SLATE_6)
            pset(px, w, h, 41, ly, CYAN_5)
    else:
        # DRINK & ADE menu board (Iced Americano, Peach Iced Tea, Ade)
        fill_rect(px, w, h, 4, 4, 15, 11, CYAN_1)
        fill_rect(px, w, h, 7, 6, 9, 10, hx("#411e06"))
        pset(px, w, h, 8, 5, GRN_4)
        fill_rect(px, w, h, 11, 7, 13, 10, ORG_3)

        fill_rect(px, w, h, 17, 4, 43, 11, hx("#182032"))
        fill_rect(px, w, h, 19, 5, 30, 5, CYAN_5)
        for ly in (7, 9, 11):
            fill_rect(px, w, h, 19, ly, 36, ly, STEEL_2)
            fill_rect(px, w, h, 38, ly, 41, ly, AMB_4)
    return im


def make_fps_zone_banner() -> Image.Image:
    """48x16 `240Hz FPS PRO ZONE` glowing crimson signage on North-Central wall."""
    w, h = 48, 16
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    fill_rect(px, w, h, 1, 2, 46, 13, INK)
    stroke_rect(px, w, h, 2, 3, 45, 12, RED_3)
    fill_rect(px, w, h, 3, 4, 44, 11, hx("#22121a"))
    # Stylised pixel "240Hz FPS" glowing text blocks
    glyph_cols = [5, 6, 7, 9, 10, 11, 13, 14, 15, 17, 19, 23, 24, 27, 28, 31, 32]
    for gx in glyph_cols:
        fill_rect(px, w, h, gx, 6, gx, 9, RED_6 if gx < 20 else WHITE_HI)
    fill_rect(px, w, h, 36, 6, 42, 9, RED_4)
    pset(px, w, h, 39, 7, AMB_4)
    return im


def make_wall_poster(theme: str = "cyan") -> Image.Image:
    """16x16 dark-framed esports character poster."""
    w, h = 16, 16
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    fill_rect(px, w, h, 2, 1, 13, 14, INK)
    fill_rect(px, w, h, 3, 2, 12, 13, BLUE_1 if theme == "cyan" else RED_1)
    c_hi = CYAN_5 if theme == "cyan" else RED_5
    c_mid = BLUE_4 if theme == "cyan" else ORG_3
    fill_rect(px, w, h, 6, 4, 9, 7, c_hi)
    fill_rect(px, w, h, 5, 8, 10, 11, c_mid)
    fill_rect(px, w, h, 4, 12, 11, 12, WHITE_HI)
    return im


def make_wall_ac_dark() -> Image.Image:
    """32x16 sleek dark charcoal commercial wall AC unit."""
    w, h = 32, 16
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    fill_rect(px, w, h, 1, 3, 30, 13, INK)
    fill_rect(px, w, h, 2, 4, 29, 12, SLATE_4)
    fill_rect(px, w, h, 2, 4, 29, 5, STEEL_2)
    fill_rect(px, w, h, 3, 10, 28, 11, INK)
    pset(px, w, h, 26, 7, CYAN_5)
    pset(px, w, h, 27, 7, GRN_4)
    return im


def make_alba_clerk() -> Image.Image:
    """16x26 pixel-art Korean PC Bang Alba part-timer (dark hair, black hoodie/apron, cyan badge)."""
    w, h = 16, 26
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    # Hair & head (x=4..11, y=1..10)
    fill_rect(px, w, h, 5, 1, 10, 3, HAIR_0)
    fill_rect(px, w, h, 4, 3, 11, 7, HAIR_0)
    fill_rect(px, w, h, 5, 2, 9, 4, HAIR_1)
    fill_rect(px, w, h, 5, 6, 10, 10, SKIN_3)
    pset(px, w, h, 6, 8, HAIR_0)   # left eye
    pset(px, w, h, 9, 8, HAIR_0)   # right eye
    pset(px, w, h, 5, 5, HAIR_1)   # Korean bangs
    pset(px, w, h, 8, 5, HAIR_0)
    # Black hoodie + dark apron + cyan staff name tag (y=11..19)
    fill_rect(px, w, h, 3, 11, 12, 19, INK)
    fill_rect(px, w, h, 4, 12, 11, 18, SLATE_2)
    fill_rect(px, w, h, 5, 13, 10, 18, SLATE_1)
    pset(px, w, h, 9, 13, CYAN_5)  # staff badge
    pset(px, w, h, 10, 13, WHITE_HI)
    pset(px, w, h, 3, 16, SKIN_3)  # hands
    pset(px, w, h, 12, 16, SKIN_3)
    # Dark pants & sneakers (y=20..25)
    fill_rect(px, w, h, 5, 20, 7, 24, SLATE_3)
    fill_rect(px, w, h, 8, 20, 10, 24, SLATE_2)
    fill_rect(px, w, h, 4, 24, 7, 25, INK)
    fill_rect(px, w, h, 8, 24, 11, 25, INK)
    return im


def draw_seated_gamer_south(
    base: Image.Image,
    desk_x_cell: int,
    chair_y_cell: int,
    hoodie: tuple[int, int, int],
    headset: tuple[int, int, int],
    drink: str = "iced_coffee",
):
    """
    Overlays a Korean gamer seated IN a south-side chair (`chair_n`, facing NORTH toward screen):
    - Hoodie shoulders + hood fold + dark Korean hair + glowing over-ear RGB headset peeking
      naturally above/inside the high-back chair, plus an iced coffee / energy can on desk corner!
    """
    px = base.load()
    bw, bh = base.size
    cx = desk_x_cell * 16 + 12
    cy = chair_y_cell * 16 - 5  # head sits right at top of south chair backrest!

    # Hoodie shoulders tucked inside chair wings
    fill_rect(px, bw, bh, cx - 5, cy + 7, cx + 5, cy + 12, INK)
    fill_rect(px, bw, bh, cx - 4, cy + 8, cx + 4, cy + 11, hoodie)
    fill_rect(px, bw, bh, cx - 2, cy + 8, cx + 2, cy + 9, mul(hoodie, 1.22))  # hood fold!

    # Back of Korean haircut + over-ear gaming headset band & glowing earcups!
    fill_rect(px, bw, bh, cx - 4, cy, cx + 4, cy + 7, HAIR_0)
    fill_rect(px, bw, bh, cx - 3, cy + 1, cx + 3, cy + 5, HAIR_1)
    pset(px, bw, bh, cx - 1, cy + 2, HAIR_2)
    # Headset headband + left/right RGB earcups
    fill_rect(px, bw, bh, cx - 4, cy + 1, cx + 4, cy + 1, STEEL_2)
    fill_rect(px, bw, bh, cx - 5, cy + 3, cx - 4, cy + 5, INK)
    fill_rect(px, bw, bh, cx + 4, cy + 3, cx + 5, cy + 5, INK)
    pset(px, bw, bh, cx - 5, cy + 4, headset)
    pset(px, bw, bh, cx + 5, cy + 4, headset)

    # Tiny drink cup on desk left corner (`desk_x_cell * 16 + 1..3`, just left of monitor!)
    dx = desk_x_cell * 16 + 1
    dy = chair_y_cell * 16 - 9
    if drink == "iced_coffee":
        pset(px, bw, bh, dx + 1, dy - 2, GRN_4)  # straw
        fill_rect(px, bw, bh, dx, dy - 1, dx + 2, dy + 2, hx("#411e06"))
        fill_rect(px, bw, bh, dx, dy - 1, dx + 2, dy - 1, WHITE_HI)
    else:
        fill_rect(px, bw, bh, dx, dy - 1, dx + 2, dy + 2, CYAN_4 if drink == "energy" else RED_4)
        pset(px, bw, bh, dx + 1, dy, WHITE_HI)


def draw_seated_gamer_north(
    base: Image.Image,
    desk_x_cell: int,
    chair_y_cell: int,
    hoodie: tuple[int, int, int],
    headset: tuple[int, int, int],
):
    """
    Overlays a Korean gamer seated IN a north-side chair (`chair_s`, facing SOUTH toward screen):
    3/4 top-down crown of dark Korean hair, RGB gaming headset band & earcups, subtle screen-lit
    brow, and hoodie shoulders tucked cleanly behind the monitor backs!
    """
    px = base.load()
    bw, bh = base.size
    cx = desk_x_cell * 16 + 12
    cy = chair_y_cell * 16 + 2

    # Hoodie shoulders settled inside chair_s bolsters
    fill_rect(px, bw, bh, cx - 5, cy + 7, cx + 5, cy + 10, INK)
    fill_rect(px, bw, bh, cx - 4, cy + 8, cx + 4, cy + 10, hoodie)
    # Rounded Korean hair crown + bangs (mostly hair in 3/4 top-down view, subtle 1px brow!)
    fill_rect(px, bw, bh, cx - 3, cy, cx + 3, cy + 1, HAIR_0)
    fill_rect(px, bw, bh, cx - 4, cy + 1, cx + 4, cy + 6, HAIR_0)
    fill_rect(px, bw, bh, cx - 3, cy + 2, cx + 3, cy + 4, HAIR_1)
    pset(px, bw, bh, cx - 1, cy + 2, HAIR_2)
    # Subtle screen-lit lower bangs/brow peeking above monitor top bezel
    fill_rect(px, bw, bh, cx - 2, cy + 6, cx + 2, cy + 6, SKIN_2)
    pset(px, bw, bh, cx, cy + 5, HAIR_0)
    # Over-ear RGB headset band & glowing earcups
    fill_rect(px, bw, bh, cx - 4, cy + 1, cx + 4, cy + 1, STEEL_2)
    fill_rect(px, bw, bh, cx - 5, cy + 3, cx - 4, cy + 5, INK)
    fill_rect(px, bw, bh, cx + 4, cy + 3, cx + 5, cy + 5, INK)
    pset(px, bw, bh, cx - 5, cy + 4, headset)
    pset(px, bw, bh, cx + 5, cy + 4, headset)


def make_entrance_mat(w_cells: int, h_cells: int) -> Image.Image:
    """Dark charcoal-ribbed commercial PC bang entrance mat with subtle cyan border."""
    w, h = w_cells * 16, h_cells * 16
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    fill_rect(px, w, h, 2, 2, w - 3, h - 3, INK)
    stroke_rect(px, w, h, 3, 3, w - 4, h - 4, CYAN_2)
    for y in range(4, h - 4):
        c = SLATE_2 if y % 2 == 0 else hx("#171b26")
        for x in range(4, w - 4):
            pset(px, w, h, x, y, c)
    return im


# ---------------------------------------------------------------------------
# 5. Scene Assembly & Verification Engine
# ---------------------------------------------------------------------------
@dataclass
class Piece:
    id: str
    kind: str  # 'wall', 'floor', 'hang', 'flat', 'char', 'glass'
    im: Image.Image
    fw: int
    fh: int
    up: int = 0
    dx: int = 0
    dy: int = 0


@dataclass
class PlacedItem:
    piece: Piece
    x: int
    y: int
    dx: int = 0
    dy: int = 0
    screen_override: str | None = None


def export_modular_sprites() -> dict[str, Image.Image]:
    """Generate and save all 11 required reusable 16x16-aligned modular PNGs."""
    OBJ_OUT_DIR.mkdir(parents=True, exist_ok=True)
    sprites = {
        "b2b_pod_blue": make_b2b_pod("blue", "lol"),
        "b2b_pod_red": make_b2b_pod("red", "fps"),
        "team_desk_blue": make_team_desk_blue(),
        "prepay_kiosk": make_prepay_kiosk(),
        "counter_pos_dark": make_counter_pos_dark(),
        "ramen_water_bar": make_ramen_water_bar(),
        "drink_fridge_triple": make_drink_fridge_triple(),
        "snack_ramen_rack": make_snack_ramen_rack(),
        "tray_return_bin": make_tray_return_bin(),
        "smoking_ashtray": make_smoking_ashtray(),
        "glass_booth_vent": make_glass_booth_vent(),
    }
    expected_sizes = {
        "b2b_pod_blue": (32, 64),
        "b2b_pod_red": (32, 64),
        "team_desk_blue": (32, 48),
        "prepay_kiosk": (16, 32),
        "counter_pos_dark": (48, 32),
        "ramen_water_bar": (48, 32),
        "drink_fridge_triple": (48, 32),
        "snack_ramen_rack": (32, 32),
        "tray_return_bin": (32, 32),
        "smoking_ashtray": (16, 32),
        "glass_booth_vent": (32, 32),
    }
    for name, im in sprites.items():
        assert im.size == expected_sizes[name], f"{name} size {im.size} != {expected_sizes[name]}"
        # Verify zero #000000 and strict binary/shadow alpha
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, a = px[x, y]
                assert a in (0, 85, 255), f"{name} has non-crisp alpha {a} at ({x},{y})"
                if a > 0:
                    assert (r, g, b) != (0, 0, 0), f"{name} has #000000 at ({x},{y})"
        im.save(OBJ_OUT_DIR / f"{name}.png")
    return sprites


def build_scene(sprites: dict[str, Image.Image]):
    zones = [
        (1, 2, 9, 7, "food_slate", "wall_amber"),       # NW Open Alba Counter & Food Prep Alcove
        (10, 1, 23, 7, "carpet", "wall_red"),           # North-Central FPS 240Hz Pro Zone
        (24, 2, 29, 6, "smoking_slate", "wall_cyan"),   # NE Stepped Glass Smoking Booth
        (1, 8, 30, 21, "carpet", "wall_cyan"),          # Unified Open-Plan Dark Acoustic Carpet Hall
    ]

    pieces = {
        "b2b_pod_blue": Piece("b2b_pod_blue", "floor", sprites["b2b_pod_blue"], 2, 4, up=0),
        "b2b_pod_blue_launcher": Piece("b2b_pod_blue", "floor", make_b2b_pod("blue", "launcher"), 2, 4, up=0),
        "b2b_pod_blue_fps": Piece("b2b_pod_blue", "floor", make_b2b_pod("blue", "fps"), 2, 4, up=0),
        "b2b_pod_red": Piece("b2b_pod_red", "floor", sprites["b2b_pod_red"], 2, 4, up=0),
        "b2b_pod_red_launcher": Piece("b2b_pod_red", "floor", make_b2b_pod("red", "launcher"), 2, 4, up=0),
        "team_desk_blue": Piece("team_desk_blue", "floor", sprites["team_desk_blue"], 2, 3, up=0),
        "prepay_kiosk": Piece("prepay_kiosk", "floor", sprites["prepay_kiosk"], 1, 1, up=16),
        "counter_pos_dark": Piece("counter_pos_dark", "floor", sprites["counter_pos_dark"], 3, 1, up=16),
        "counter_l_wing": Piece("counter_l_wing", "floor", make_counter_l_wing(), 1, 2, up=16),
        "ramen_water_bar": Piece("ramen_water_bar", "wall", sprites["ramen_water_bar"], 3, 1, up=16),
        "drink_fridge_triple": Piece("drink_fridge_triple", "wall", sprites["drink_fridge_triple"], 3, 1, up=16),
        "snack_ramen_rack": Piece("snack_ramen_rack", "wall", sprites["snack_ramen_rack"], 2, 1, up=16),
        "tray_return_bin": Piece("tray_return_bin", "floor", sprites["tray_return_bin"], 2, 1, up=16),
        "smoking_ashtray": Piece("smoking_ashtray", "floor", sprites["smoking_ashtray"], 1, 1, up=16),
        "glass_booth_vent": Piece("glass_booth_vent", "hang", sprites["glass_booth_vent"], 2, 2, up=0),
        "menu_food": Piece("menu_food", "hang", make_wall_menu_board("food"), 3, 1),
        "menu_drink": Piece("menu_drink", "hang", make_wall_menu_board("drink"), 3, 1),
        "fps_banner": Piece("fps_banner", "hang", make_fps_zone_banner(), 3, 1),
        "poster_cyan": Piece("poster_cyan", "hang", make_wall_poster("cyan"), 1, 1),
        "poster_red": Piece("poster_red", "hang", make_wall_poster("red"), 1, 1),
        "ac_dark": Piece("ac_dark", "hang", make_wall_ac_dark(), 2, 1),
        "alba_clerk": Piece("alba_clerk", "char", make_alba_clerk(), 1, 1, up=12),
        "entrance_mat": Piece("entrance_mat", "flat", make_entrance_mat(3, 2), 3, 2),
    }

    items: list[PlacedItem] = []

    def add(pid: str, x: int, y: int, dx: int = 0, dy: int = 0):
        items.append(PlacedItem(pieces[pid], x, y, dx=dx, dy=dy))

    # --- Entrance Vestibule & 2 Prepay Kiosks (`무인 선불결제기`) ---
    add("entrance_mat", 14, 19)
    add("prepay_kiosk", 16, 18)
    add("prepay_kiosk", 17, 18)

    # --- Overhead Wall Signage & AC Units (`face == 1`) ---
    add("menu_food", 1, 2)
    add("menu_drink", 4, 2)
    add("ac_dark", 7, 2)

    add("poster_red", 11, 1)
    add("fps_banner", 13, 1)
    add("poster_red", 18, 1)
    add("ac_dark", 20, 1)
    add("poster_cyan", 23, 1)

    # Smoking Booth ceiling/upper-wall exhaust hood on stepped back wall (face 1..2 at y=2..3)
    add("glass_booth_vent", 26, 2)

    # --- Zone 1: NW Open L-Shaped Alba Counter & Food Prep Zone ---
    # Back-wall row (y=4, flush against NW north wall face==2 at y=3):
    add("drink_fridge_triple", 1, 4)   # (1..3, 4)
    add("snack_ramen_rack", 4, 4)      # (4..5, 4)
    add("ramen_water_bar", 6, 4)       # (6..8, 4) — customer self-serve Hangang ramen + 정수기!
    # Open L-shaped counter (x=1, y=5..7 stays open staff pass-through!)
    add("alba_clerk", 3, 6)            # Alba worker right behind POS monitor & pickup counter!
    add("counter_pos_dark", 2, 7)      # (2..4, 7)
    add("counter_l_wing", 5, 6)        # (5, 6..7) — seamless ㄱ corner return!
    add("tray_return_bin", 6, 7)       # (6..7, 7) — 퇴식구·분리수거함 right where counter meets aisle!

    # --- Zone 2: North-Central FPS 240Hz Pro Zone (1 Back-to-Back 5-pod Red Island = 10 seats) ---
    fps_pods = ["b2b_pod_red", "b2b_pod_red_launcher", "b2b_pod_red", "b2b_pod_red", "b2b_pod_red_launcher"]
    for i, px_col in enumerate((10, 12, 14, 16, 18)):
        add(fps_pods[i], px_col, 4)    # occupies x=10..19, y=4..7 (north aisle y=3, south aisle y=8!)

    # --- Zone 3: Center-East Main Zone (2 parallel Back-to-Back 5-pod Cyan Islands = 20 seats) ---
    # Separated by clean 2-tile walkable aisle at y=13..14!
    main1_pods = ["b2b_pod_blue", "b2b_pod_blue_launcher", "b2b_pod_blue", "b2b_pod_blue_fps", "b2b_pod_blue"]
    for i, px_col in enumerate((19, 21, 23, 25, 27)):
        add(main1_pods[i], px_col, 9)  # occupies x=19..28, y=9..12

    main2_pods = ["b2b_pod_blue_launcher", "b2b_pod_blue", "b2b_pod_blue", "b2b_pod_blue_launcher", "b2b_pod_blue_fps"]
    for i, px_col in enumerate((19, 21, 23, 25, 27)):
        add(main2_pods[i], px_col, 15) # occupies x=19..28, y=15..18 (south aisle y=19!)

    # --- Zone 4: SW Glass-Partitioned 5-Seat Team Room (`5인 다인큐 팀룸`) ---
    # 5 contiguous `team_desk_blue` units side-by-side at x=2..11, y=12..14!
    for px_col in (2, 4, 6, 8, 10):
        add("team_desk_blue", px_col, 12)

    # --- Zone 5: NE Stepped Translucent Glass Smoking Booth (`흡연부스`) ---
    add("smoking_ashtray", 25, 4)
    add("smoking_ashtray", 29, 4)

    # Record glass partition wall cells for collision/BFS truth!
    glass_blocked_cells: dict[tuple[int, int], str] = {}
    # NE Smoking Booth glass walls: West wall x=24, y=4..6; South wall y=6, x=24..25 & 28..29 (doorway at 26..27, 6!)
    for gy in (4, 5, 6):
        glass_blocked_cells[(24, gy)] = "smoking_glass_wall_w"
    for gx in (24, 25, 28, 29):
        glass_blocked_cells[(gx, 6)] = "smoking_glass_wall_s"

    # SW 5-Seat Team Room glass walls: North wall y=11, x=1..12; East wall x=12, y=11..14 (doorway at 12, 15..16!)
    for gx in range(1, 13):
        glass_blocked_cells[(gx, 11)] = "team_room_glass_wall_n"
    for gy in (11, 12, 13, 14):
        glass_blocked_cells[(12, gy)] = "team_room_glass_wall_e"

    return zones, items, glass_blocked_cells


def compose_scene(zones, items: list[PlacedItem]) -> Image.Image:
    base = render_structure(PLAN, zones)
    paint_floor_led_guides_and_door(base)

    # Subtle colored screen-glow pools on carpet in front of south-facing monitor stations & prepay kiosks
    px = base.load()
    for sx_list, sy_row, tint in (
        ((10, 12, 14, 16, 18), 6, RED_4),
        ((19, 21, 23, 25, 27), 11, CYAN_4),
        ((19, 21, 23, 25, 27), 17, CYAN_4),
        ((2, 4, 6, 8, 10), 13, CYAN_4),
    ):
        for sx in sx_list:
            for yy in range(sy_row * 16 + 10, (sy_row + 1) * 16 + 14):
                for xx in range(sx * 16 + 2, sx * 16 + 24):
                    if 0 <= xx < base.width and 0 <= yy < base.height:
                        px[xx, yy] = mix(px[xx, yy][:3], tint, 0.08) + (255,)

    # Blue touchscreen floor glow in front of the 2 Prepay Kiosks (x=16..17, y=19)
    for yy in range(18 * 16 + 14, 19 * 16 + 12):
        for xx in range(16 * 16 + 1, 18 * 16 - 1):
            px[xx, yy] = mix(px[xx, yy][:3], CYAN_5, 0.11) + (255,)

    # Sort and composite modular furniture & wall hangings by depth Z
    draw_list: list[tuple[int, Image.Image, int, int]] = []
    for it in items:
        p = it.piece
        X = it.x * 16 + p.dx + it.dx
        if p.kind == "hang":
            Y = it.y * 16 + it.dy
            draw_list.append((it.y * 16, p.im, X, Y))
        elif p.kind == "flat":
            Y = it.y * 16 + it.dy
            draw_list.append((-10, p.im, X, Y))
        else:
            Y = it.y * 16 - p.up + p.dy + it.dy
            z = (it.y + p.fh) * 16 + it.dy
            layer = add_contact_shadow(p.im) if p.kind in ("wall", "floor") else p.im
            draw_list.append((z, layer, X, Y))

    for _, lim, X, Y in sorted(draw_list, key=lambda d: d[0]):
        base.alpha_composite(lim, (X, Y))

    # Overlay 5 seated Korean gamers (hoodies + glowing headsets + desk drinks) across zones!
    # 1) FPS 240Hz Pro Zone: Crimson pro gamer at x=14, south chair y=7
    draw_seated_gamer_south(base, desk_x_cell=14, chair_y_cell=7, hoodie=RED_2, headset=RED_5, drink="energy")
    # 2) Main Zone Island 1: North-seated gamer at x=21, y=9 + South-seated gamer at x=25, y=12
    draw_seated_gamer_north(base, desk_x_cell=21, chair_y_cell=9, hoodie=BLUE_2, headset=CYAN_5)
    draw_seated_gamer_south(base, desk_x_cell=25, chair_y_cell=12, hoodie=SLATE_4, headset=CYAN_6, drink="iced_coffee")
    # 3) Main Zone Island 2: South-seated gamer at x=19, y=18
    draw_seated_gamer_south(base, desk_x_cell=19, chair_y_cell=18, hoodie=hx("#3c4a64"), headset=GRN_4, drink="iced_coffee")
    # 4) SW 5-Seat Team Room: Squad shotcaller at x=6, south chair y=14 (plus drink on adjacent teammate desk!)
    draw_seated_gamer_south(base, desk_x_cell=6, chair_y_cell=14, hoodie=BLUE_1, headset=CYAN_5, drink="energy")

    # Composite Translucent Tempered-Glass Booth Walls AFTER interior props so glass tints them realistically!
    # 1) SW 5-Seat Team Room: North Glass Wall (y=11, x=1..12; y_bot = 12*16-3 = 189)
    #    + East Glass Wall (x=12, aligned right edge of pane x=12 -> gx=12*16+8..15, starting cleanly at y=190 down to 17*16-1=271, doorway at y=15*16..17*16-1!)
    draw_translucent_glass_booth_h(base, x0_cell=1, x1_cell=12, y_cell=11, door_cells=None, badge_text="TEAM 5P", accent=CYAN_5)
    draw_translucent_glass_booth_v(
        base,
        x_cell=12,
        y_px_start=12 * 16 - 2,
        y_px_end=17 * 16 - 1,
        door_px_range=(15 * 16, 17 * 16 - 2),
        align_left=False,
    )

    # 2) NE Smoking Booth: West Glass Wall (x=24, aligned left edge gx=24*16..24*16+7, from north wall dado y=3*16+4 down to south glass transom y=6*16-14!)
    #    + South Glass Wall (y=6, x=24..29, doorway at x=26..27) -> meets West wall in a zero-overhang L-corner!
    draw_translucent_glass_booth_v(
        base,
        x_cell=24,
        y_px_start=3 * 16 + 4,
        y_px_end=6 * 16 - 14,
        door_px_range=None,
        align_left=True,
    )
    draw_translucent_glass_booth_h(base, x0_cell=24, x1_cell=29, y_cell=6, door_cells=(26, 27), badge_text="SMOKING", accent=CYAN_6)

    return base


def verify_scene(
    items: list[PlacedItem],
    glass_blocked_cells: dict[tuple[int, int], str],
    map_im: Image.Image,
) -> dict:
    W, Hh, g, face, top, inn = analyse(PLAN)
    floor = [[g[y][x] and face[y][x] == 0 for x in range(W)] for y in range(Hh)]

    def fl(x: int, y: int) -> bool:
        return 0 <= x < W and 0 <= y < Hh and floor[y][x]

    issues: list[str] = []
    occ: dict[tuple[int, int], str] = dict(glass_blocked_cells)

    for it in items:
        p = it.piece
        if p.kind == "hang":
            if not (0 <= it.x < W and 0 <= it.y < Hh and face[it.y][it.x] == 1):
                issues.append(f"Hanging {p.id} @({it.x},{it.y}) not on face==1!")
            continue
        if p.kind == "flat":
            continue

        for yy in range(it.y, it.y + p.fh):
            for xx in range(it.x, it.x + p.fw):
                if not fl(xx, yy):
                    issues.append(f"{p.id} @({it.x},{it.y}) cell ({xx},{yy}) is NOT walkable floor!")
                if (xx, yy) in occ:
                    issues.append(f"{p.id} @({it.x},{it.y}) overlaps {occ[(xx, yy)]} at ({xx},{yy})!")
                occ[(xx, yy)] = p.id

        if p.kind == "wall":
            for xx in range(it.x, it.x + p.fw):
                if not (it.y > 0 and face[it.y - 1][xx] == 2):
                    issues.append(f"Wall prop {p.id} @({it.x},{it.y}) col {xx} lacks north face==2!")

    # BFS Walkability starting from protruding South Entrance doorway (x=14..16, y=21)
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

    # Key PC Bang functional landmarks that MUST be 100% reachable from Entrance
    key_targets = {
        "entrance_vestibule": (15, 20),
        "prepay_kiosks_front": (16, 19),
        "alba_counter_customer_front": (3, 8),
        "alba_counter_staff_interior": (2, 5),
        "drink_fridges_and_snack_rack": (4, 5),
        "hangang_ramen_and_water_bar": (7, 5),
        "tray_return_station_front": (7, 8),
        "fps_pro_zone_north_aisle": (15, 3),
        "fps_pro_zone_south_aisle": (15, 8),
        "main_zone_island1_north_aisle": (24, 8),
        "main_zone_central_2tile_aisle": (24, 13),
        "main_zone_island2_south_aisle": (24, 19),
        "sw_5seat_team_room_interior": (5, 15),
        "ne_glass_smoking_booth_interior": (27, 5),
    }
    landmark_reach: dict[str, bool] = {}
    for kname, coord in key_targets.items():
        ok = coord in seen
        landmark_reach[kname] = ok
        if not ok:
            issues.append(f"Landmark '{kname}' at {coord} is NOT reachable from entrance!")

    # Verify every placed furniture station/machine/ashtray touches at least 1 reachable tile
    station_total = 0
    station_ok = 0
    for it in items:
        p = it.piece
        if p.kind in ("hang", "flat", "char"):
            continue
        station_total += 1
        fp = [(xx, yy) for yy in range(it.y, it.y + p.fh) for xx in range(it.x, it.x + p.fw)]
        adj = [
            (ax + dx, ay + dy)
            for ax, ay in fp
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
            if (ax + dx, ay + dy) not in fp
        ]
        if any(c in seen for c in adj):
            station_ok += 1
        else:
            issues.append(f"Prop {p.id} @({it.x},{it.y}) has NO adjacent walkable tile!")

    # Count #000000 pixels on final map & all exported objects
    mpx = map_im.load()
    black_map_px = sum(
        1
        for y in range(map_im.height)
        for x in range(map_im.width)
        if mpx[x, y][3] > 0 and mpx[x, y][:3] == (0, 0, 0)
    )
    if black_map_px > 0:
        issues.append(f"Map contains {black_map_px} forbidden #000000 pixels!")

    black_obj_px = 0
    exported_files = sorted(p.name for p in OBJ_OUT_DIR.glob("*.png"))
    for fname in exported_files:
        oim = Image.open(OBJ_OUT_DIR / fname).convert("RGBA")
        opx = oim.load()
        for y in range(oim.height):
            for x in range(oim.width):
                if opx[x, y][3] > 0 and opx[x, y][:3] == (0, 0, 0):
                    black_obj_px += 1
    if black_obj_px > 0:
        issues.append(f"Exported objects contain {black_obj_px} forbidden #000000 pixels!")

    total_floor = sum(1 for y in range(Hh) for x in range(W) if fl(x, y))
    walkable_open = sum(1 for y in range(Hh) for x in range(W) if fl(x, y) and (x, y) not in occ)

    return {
        "version": "modern_pcbang_v3",
        "grid_size": f"{W}x{Hh}",
        "pixel_size_1x": f"{map_im.width}x{map_im.height}",
        "pixel_size_2x": f"{map_im.width * 2}x{map_im.height * 2}",
        "total_pc_seats": 35,
        "seat_breakdown": {
            "main_zone_cyan_b2b_2_islands": 20,
            "fps_240hz_pro_zone_red_b2b_island": 10,
            "sw_glass_team_room_contiguous": 5,
        },
        "seated_gamers_count": 5,
        "alba_staff_count": 1,
        "exported_modular_objects": exported_files,
        "exported_modular_objects_count": len(exported_files),
        "total_floor_cells": total_floor,
        "walkable_open_cells": walkable_open,
        "bfs_reached_cells": len(seen),
        "bfs_coverage_pct": round(100.0 * len(seen) / max(1, walkable_open), 1),
        "landmarks_reachable": landmark_reach,
        "props_adjacent_reachable": f"{station_ok}/{station_total}",
        "black_000000_pixels_map": black_map_px,
        "black_000000_pixels_objects": black_obj_px,
        "issues": issues,
        "bfs_pass": len(issues) == 0 and len(seen) == walkable_open,
    }


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sprites = export_modular_sprites()
    zones, items, glass_blocked = build_scene(sprites)
    im1x = compose_scene(zones, items)
    im2x = im1x.resize((im1x.width * 2, im1x.height * 2), Image.NEAREST)

    report = verify_scene(items, glass_blocked, im1x)

    out1x = OUT_DIR / "map_pcbang_v3.png"
    out2x = OUT_DIR / "map_pcbang_v3_2x.png"
    out_metrics = OUT_DIR / "metrics_v3.json"

    im1x.save(out1x)
    im2x.save(out2x)
    out_metrics.write_text(json.dumps(report, indent=2, ensure_ascii=False))

    print(json.dumps(report, indent=2, ensure_ascii=False))
    if not report["bfs_pass"]:
        raise SystemExit(f"PC Bang v3 verification FAILED: {report['issues']}")


if __name__ == "__main__":
    main()
