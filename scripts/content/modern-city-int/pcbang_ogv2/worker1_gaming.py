#!/usr/bin/env python3
"""Worker 1 — Korean PC Bang Gaming Seats & Multi-Seat Islands (object-gen-v2 Carbon Medium 1-Pass).

Generates 3 base sprites and 4 horizontal multi-seat composite islands in strict
3/4 top-down perspective using 100% locked `fable-city.json` colors, binary alpha
(0 or 255), zero pure black (#000000), rich 5-7 shade ramp shading, organic curved
chair/monitor silhouettes, and solid ink[0] contact shadows.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

OGV2_ROOT = Path("/home/main/object-gen-v2")
if str(OGV2_ROOT) not in sys.path:
    sys.path.insert(0, str(OGV2_ROOT))

from objectgen_v2.palette import load_palette, verify_sprite  # noqa: E402

PALETTE_PATH = OGV2_ROOT / "palettes" / "fable-city.json"
OUT_DIR = Path(
    "/home/main/.t3/worktrees/OpenRPGMaker/art-beodeul-objects-tie-4a066dd020f46d0a"
    "/tiledata/modern-city/pcbang-ogv2/pieces"
)

RGB = tuple[int, int, int]
RGBA = tuple[int, int, int, int]


def load_ramps(path: Path) -> dict[str, list[RGB]]:
    raw = json.loads(path.read_text(encoding="utf-8"))["ramps"]
    ramps: dict[str, list[RGB]] = {}
    for name, hex_list in raw.items():
        ramps[name] = [
            (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)) for h in hex_list
        ]
    return ramps


class Canvas:
    """Strict binary-alpha RGBA pixel canvas locked to fable-city ramps."""

    def __init__(self, w: int, h: int) -> None:
        self.w = w
        self.h = h
        self.im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self.px_access = self.im.load()

    def px(self, x: int, y: int, c: RGB) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px_access[x, y] = (c[0], c[1], c[2], 255)

    def hline(self, x0: int, x1: int, y: int, c: RGB) -> None:
        if not (0 <= y < self.h):
            return
        xa = max(0, min(x0, x1))
        xb = min(self.w - 1, max(x0, x1))
        for x in range(xa, xb + 1):
            self.px_access[x, y] = (c[0], c[1], c[2], 255)

    def vline(self, x: int, y0: int, y1: int, c: RGB) -> None:
        if not (0 <= x < self.w):
            return
        ya = max(0, min(y0, y1))
        yb = min(self.h - 1, max(y0, y1))
        for y in range(ya, yb + 1):
            self.px_access[x, y] = (c[0], c[1], c[2], 255)

    def rect(self, x0: int, y0: int, x1: int, y1: int, c: RGB) -> None:
        for y in range(min(y0, y1), max(y0, y1) + 1):
            self.hline(x0, x1, y, c)


# ---------------------------------------------------------------------------
# Shared Sub-Component Renderers (Chairs, Caster Bases, Screens, Headsets, Drinks)
# ---------------------------------------------------------------------------


def draw_caster_base_3q(
    cv: Canvas,
    R: dict[str, list[RGB]],
    ox: int,
    top_y: int,
    hub_accent: RGB,
) -> None:
    """Draw a 3/4 perspective 5-star chair base + solid ink[0] floor contact shadow.

    Spans rows top_y .. top_y + 5 (6 px tall, x = ox+8 .. ox+21).
    """
    ink = R["ink"]
    asph = R["asphalt"]
    kuro = R["kuro"]
    steel = R["steel"]

    # 1. Tucked solid elliptical contact shadow on floor (zero semi-transparency!)
    cv.hline(ox + 9, ox + 20, top_y + 3, ink[0])
    cv.hline(ox + 8, ox + 21, top_y + 4, ink[0])
    cv.px(ox + 8, top_y + 3, asph[0])
    cv.px(ox + 21, top_y + 3, asph[0])
    cv.hline(ox + 10, ox + 19, top_y + 5, ink[0])
    cv.px(ox + 9, top_y + 5, asph[0])
    cv.px(ox + 20, top_y + 5, asph[0])

    # 2. Central pneumatic gas-lift column
    for dy in range(0, 4):
        cv.px(ox + 14, top_y + dy, steel[3] if dy < 2 else steel[2])
        cv.px(ox + 15, top_y + dy, kuro[1] if dy < 2 else kuro[0])

    # 3. Rear-left & rear-right star legs (receding slightly upward in 3/4)
    cv.hline(ox + 10, ox + 13, top_y + 1, steel[2])
    cv.px(ox + 9, top_y + 2, steel[3])
    cv.hline(ox + 16, ox + 19, top_y + 1, steel[1])
    cv.px(ox + 20, top_y + 2, steel[2])

    # 4. Foreground-left, foreground-right & front-center splayed legs (top-lit)
    cv.hline(ox + 11, ox + 13, top_y + 2, steel[4])
    cv.px(ox + 10, top_y + 3, steel[3])
    cv.hline(ox + 16, ox + 18, top_y + 2, steel[3])
    cv.px(ox + 19, top_y + 3, steel[2])
    cv.px(ox + 14, top_y + 3, steel[4])
    cv.px(ox + 15, top_y + 3, steel[2])

    # 5. Twin caster wheels + subtle color hub glints
    wheel_coords = [
        (ox + 8, top_y + 2),
        (ox + 20, top_y + 2),
        (ox + 9, top_y + 3),
        (ox + 19, top_y + 3),
        (ox + 14, top_y + 4),
    ]
    for wx, wy in wheel_coords:
        cv.px(wx, wy, kuro[2])
        cv.px(wx + 1, wy, kuro[0])
        cv.px(wx, wy + 1, kuro[0])
        cv.px(wx + 1, wy + 1, ink[0])
    # Hub accents on foreground wheels
    cv.px(ox + 10, top_y + 3, hub_accent)
    cv.px(ox + 19, top_y + 3, hub_accent)


def draw_south_bucket_chair(
    cv: Canvas,
    R: dict[str, list[RGB]],
    ox: int,
    top_y: int,
    edition: str,
) -> None:
    """Draw sculpted high-back ergonomic gaming chair seen from the BACK (3/4 top-down).

    Spans top_y .. top_y + 20 (21 rows total: e.g. y=42..62 on 64px, or y=26..46 on 48px).
    Overlaps the desk kneehole naturally like mc-c-campus-carrel.png.
    """
    kuro = R["kuro"]
    kaw = R["kawara"]
    steel = R["steel"]
    ink = R["ink"]

    if edition == "red":
        acc_hi = R["red"][5]
        acc_bright = R["red"][4]
        acc_mid = R["red"][3]
        acc_dark = R["maple"][2]
        acc_deep = R["maple"][1]
        crest_a = R["yellow"][4]
        crest_b = R["orange"][4]
        contour = R["maple"][0]
    else:
        acc_hi = R["glass"][6]
        acc_bright = R["teal"][5]
        acc_mid = R["teal"][4]
        acc_dark = R["teal"][3]
        acc_deep = R["teal"][2]
        crest_a = R["glass"][6]
        crest_b = R["teal"][4]
        contour = R["navy"][0]

    # Row +0: Rounded/chamfered headrest crown (x=11..18)
    if edition == "red":
        # Aggressive Viper chamfered pro headrest
        cv.px(ox + 11, top_y, contour)
        cv.hline(ox + 12, ox + 14, top_y, kaw[4])
        cv.hline(ox + 15, ox + 17, top_y, kuro[3])
        cv.px(ox + 18, top_y, kuro[0])
    else:
        cv.px(ox + 11, top_y, contour)
        cv.hline(ox + 12, ox + 14, top_y, kaw[5])
        cv.hline(ox + 15, ox + 16, top_y, kaw[4])
        cv.px(ox + 17, top_y, kuro[3])
        cv.px(ox + 18, top_y, kuro[0])

    # Row +1: Headrest upper curve (x=10..19)
    cv.px(ox + 10, top_y + 1, contour)
    cv.px(ox + 11, top_y + 1, acc_bright)
    cv.hline(ox + 12, ox + 15, top_y + 1, kaw[4] if edition != "red" else kuro[4])
    cv.hline(ox + 16, ox + 17, top_y + 1, kuro[3])
    cv.px(ox + 18, top_y + 1, acc_mid)
    cv.px(ox + 19, top_y + 1, kuro[0])

    # Row +2: Headrest pillow & embroidered team crest (x=9..20)
    cv.px(ox + 9, top_y + 2, contour)
    cv.px(ox + 10, top_y + 2, acc_bright)
    cv.hline(ox + 11, ox + 13, top_y + 2, kuro[4])
    cv.px(ox + 14, top_y + 2, crest_a)
    cv.px(ox + 15, top_y + 2, crest_b)
    cv.hline(ox + 16, ox + 18, top_y + 2, kuro[2])
    cv.px(ox + 19, top_y + 2, acc_dark)
    cv.px(ox + 20, top_y + 2, kuro[0])

    # Row +3: Neck curve + racing harness grommet top rims (x=8..21)
    cv.px(ox + 8, top_y + 3, contour)
    cv.px(ox + 9, top_y + 3, acc_bright)
    cv.px(ox + 10, top_y + 3, kuro[3])
    cv.px(ox + 11, top_y + 3, acc_hi)
    cv.px(ox + 12, top_y + 3, acc_mid)
    cv.hline(ox + 13, ox + 16, top_y + 3, kuro[2])
    cv.px(ox + 17, top_y + 3, acc_mid)
    cv.px(ox + 18, top_y + 3, acc_dark)
    cv.px(ox + 19, top_y + 3, kuro[1])
    cv.px(ox + 20, top_y + 3, acc_dark)
    cv.px(ox + 21, top_y + 3, kuro[0])

    # Row +4: Harness pass-through grommet holes + flaring shoulder wings (x=7..22)
    cv.px(ox + 7, top_y + 4, contour)
    cv.px(ox + 8, top_y + 4, acc_bright)
    cv.px(ox + 9, top_y + 4, acc_mid)
    cv.px(ox + 10, top_y + 4, kuro[3])
    cv.px(ox + 11, top_y + 4, ink[0])  # left grommet hole
    cv.px(ox + 12, top_y + 4, ink[0])
    cv.px(ox + 13, top_y + 4, kuro[3])
    cv.px(ox + 14, top_y + 4, steel[3])
    cv.px(ox + 15, top_y + 4, kuro[1])
    cv.px(ox + 16, top_y + 4, kuro[2])
    cv.px(ox + 17, top_y + 4, ink[0])  # right grommet hole
    cv.px(ox + 18, top_y + 4, ink[0])
    cv.px(ox + 19, top_y + 4, kuro[1])
    cv.px(ox + 20, top_y + 4, acc_dark)
    cv.px(ox + 21, top_y + 4, acc_deep)
    cv.px(ox + 22, top_y + 4, kuro[0])

    # Rows +5..+8: Full winged bucket shoulders (x=7..22) + molded rear exo-spine
    for dy in range(5, 9):
        y = top_y + dy
        cv.px(ox + 7, y, contour)
        cv.px(ox + 8, y, acc_bright if dy < 7 else acc_mid)
        cv.px(ox + 9, y, acc_mid if dy < 8 else acc_dark)
        cv.px(ox + 10, y, kaw[3] if dy == 5 else kuro[4])

        # Molded center rear shell with diagonal top-left sheen & spine ridge
        cv.px(ox + 11, y, kuro[3] if dy < 7 else kuro[2])
        cv.px(ox + 12, y, kuro[3] if dy == 5 else kuro[2])
        cv.px(ox + 13, y, kuro[2])
        cv.px(ox + 14, y, kaw[4] if dy == 5 else steel[3])  # spine highlight
        cv.px(ox + 15, y, kuro[1])  # spine shadow
        cv.px(ox + 16, y, kuro[2] if dy == 5 else kuro[1])
        cv.px(ox + 17, y, kuro[1])
        cv.px(ox + 18, y, kuro[1])

        # Rear chevron LED / diamond accent on back shell
        if dy == 6:
            cv.px(ox + 12, y, acc_hi)
            cv.px(ox + 17, y, acc_mid)
        elif dy == 7:
            cv.px(ox + 13, y, acc_bright)
            cv.px(ox + 14, y, crest_a)
            cv.px(ox + 15, y, acc_mid)
            cv.px(ox + 16, y, acc_dark)

        cv.px(ox + 19, y, kuro[2] if dy == 5 else kuro[1])
        cv.px(ox + 20, y, acc_dark)
        cv.px(ox + 21, y, acc_deep)
        cv.px(ox + 22, y, kuro[0])

    # Sculpted 4D Armrests (x=5..6 and x=23..24 at rows +7..+11)
    cv.px(ox + 5, top_y + 7, steel[4])
    cv.px(ox + 6, top_y + 7, kaw[4])
    cv.px(ox + 23, top_y + 7, steel[3])
    cv.px(ox + 24, top_y + 7, kuro[3])
    for dy in range(8, 11):
        cv.px(ox + 5, top_y + dy, kuro[0])
        cv.px(ox + 6, top_y + dy, kuro[2])
        cv.px(ox + 23, top_y + dy, kuro[1])
        cv.px(ox + 24, top_y + dy, kuro[0])
    cv.px(ox + 6, top_y + 11, kuro[1])
    cv.px(ox + 7, top_y + 11, kuro[2])
    cv.px(ox + 22, top_y + 11, kuro[1])
    cv.px(ox + 23, top_y + 11, kuro[0])

    # Rows +9..+11: Bucket waist taper (x=8..21)
    for dy in range(9, 12):
        y = top_y + dy
        cv.px(ox + 8, y, contour)
        cv.px(ox + 9, y, acc_mid if dy == 9 else acc_dark)
        cv.px(ox + 10, y, kuro[3])
        if edition == "red" and dy in (9, 10):
            # Subtle diamond-quilt lumbar highlight on Crimson Pro seat
            cv.px(ox + 11, y, kuro[2])
            cv.px(ox + 12, y, kuro[3] if dy == 9 else kuro[1])
            cv.px(ox + 13, y, kuro[2])
        else:
            cv.hline(ox + 11, ox + 13, y, kuro[2])
        cv.px(ox + 14, y, steel[2])
        cv.px(ox + 15, y, kuro[1])
        cv.hline(ox + 16, ox + 18, y, kuro[1])
        cv.px(ox + 19, y, kuro[1])
        cv.px(ox + 20, y, acc_deep)
        cv.px(ox + 21, y, kuro[0])

    # Rows +12..+13: Cushioned seat pan & rounded lower bolster (x=8..21 -> x=9..20)
    cv.px(ox + 8, top_y + 12, kuro[0])
    cv.px(ox + 9, top_y + 12, acc_dark)
    cv.hline(ox + 10, ox + 13, top_y + 12, kuro[3])
    cv.hline(ox + 14, ox + 18, top_y + 12, kuro[2])
    cv.px(ox + 19, top_y + 12, acc_deep)
    cv.px(ox + 20, top_y + 12, kuro[1])
    cv.px(ox + 21, top_y + 12, kuro[0])

    cv.px(ox + 9, top_y + 13, kuro[0])
    cv.hline(ox + 10, ox + 14, top_y + 13, kuro[1])
    cv.hline(ox + 15, ox + 19, top_y + 13, kuro[0])
    cv.px(ox + 20, top_y + 13, kuro[0])

    # Row +14: Under-seat steel tilt housing (x=11..18)
    cv.px(ox + 11, top_y + 14, kuro[0])
    cv.hline(ox + 12, ox + 14, top_y + 14, steel[2])
    cv.hline(ox + 15, ox + 17, top_y + 14, kuro[1])
    cv.px(ox + 18, top_y + 14, kuro[0])

    # Rows +15..+20: Pneumatic cylinder + 5-star caster base + ink[0] floor shadow
    draw_caster_base_3q(cv, R, ox, top_y + 15, acc_mid)


def draw_north_bucket_chair(
    cv: Canvas,
    R: dict[str, list[RGB]],
    ox: int,
    edition: str,
) -> None:
    """Draw the NORTH bucket gaming chair facing SOUTH (y=1..14, x=5..22).

    Transparent corners at x=0..4 and x=23..31! Shows rounded top crown,
    quilted inner cushion, neck pillow, and angled racing bolsters peeking
    above the north desk and dual monitors.
    """
    kuro = R["kuro"]
    kaw = R["kawara"]
    steel = R["steel"]

    if edition == "red":
        acc_hi = R["red"][5]
        acc_bright = R["red"][4]
        acc_mid = R["red"][3]
        acc_dark = R["maple"][2]
        crest = R["yellow"][4]
        contour = R["maple"][0]
    else:
        acc_hi = R["glass"][6]
        acc_bright = R["teal"][5]
        acc_mid = R["teal"][4]
        acc_dark = R["teal"][3]
        crest = R["glass"][6]
        contour = R["navy"][0]

    # y=1: Rounded headrest top crown (x=10..17)
    cv.px(ox + 10, 1, contour)
    cv.hline(ox + 11, ox + 14, 1, kaw[5] if edition != "red" else kaw[4])
    cv.hline(ox + 15, ox + 16, 1, kuro[3])
    cv.px(ox + 17, 1, kuro[0])

    # y=2: Headrest upper bolsters (x=9..18)
    cv.px(ox + 9, 2, contour)
    cv.px(ox + 10, 2, acc_bright)
    cv.hline(ox + 11, ox + 14, 2, kuro[4])
    cv.hline(ox + 15, ox + 16, 2, kuro[3])
    cv.px(ox + 17, 2, acc_mid)
    cv.px(ox + 18, 2, kuro[0])

    # y=3..4: Plush neck pillow + embroidered logo facing South (x=8..19)
    for y in (3, 4):
        cv.px(ox + 8, y, contour)
        cv.px(ox + 9, y, acc_bright if y == 3 else acc_mid)
        cv.px(ox + 10, y, kuro[3])
        cv.hline(ox + 11, ox + 16, y, kuro[2] if y == 4 else kuro[3])
        cv.px(ox + 17, y, kuro[1])
        cv.px(ox + 18, y, acc_dark)
        cv.px(ox + 19, y, kuro[0])
    cv.px(ox + 13, 3, crest)
    cv.px(ox + 14, 3, acc_hi)

    # y=5: Shoulder harness grommets (x=7..20)
    cv.px(ox + 7, 5, contour)
    cv.px(ox + 8, 5, acc_bright)
    cv.px(ox + 9, 5, kuro[3])
    cv.px(ox + 10, 5, R["ink"][0])
    cv.px(ox + 11, 5, acc_mid)
    cv.hline(ox + 12, ox + 15, 5, kuro[2])
    cv.px(ox + 16, 5, acc_dark)
    cv.px(ox + 17, 5, R["ink"][0])
    cv.px(ox + 18, 5, kuro[1])
    cv.px(ox + 19, 5, acc_dark)
    cv.px(ox + 20, 5, kuro[0])

    # y=6..11: Flared winged bucket shoulders & quilted front backrest (x=6..21)
    for y in range(6, 12):
        cv.px(ox + 6, y, contour)
        cv.px(ox + 7, y, acc_bright if y < 9 else acc_mid)
        cv.px(ox + 8, y, acc_mid if y < 10 else acc_dark)
        cv.px(ox + 9, y, kuro[3])
        # Quilted inner backrest cushion with top-left light falloff
        for x in range(10, 18):
            if (x + y) % 3 == 0 and y < 10:
                cv.px(ox + x, y, kuro[3] if x < 14 else kuro[2])
            else:
                cv.px(ox + x, y, kuro[2] if x < 14 else kuro[1])
        cv.px(ox + 18, y, kuro[1])
        cv.px(ox + 19, y, acc_dark)
        cv.px(ox + 20, y, acc_dark if y < 8 else R["maple"][1] if edition == "red" else R["teal"][2])
        cv.px(ox + 21, y, kuro[0])

    # Peeking 3/4 armrests at x=5 and x=22 (y=8..11) — still keeping x=0..4 & x=23..31 transparent!
    cv.px(ox + 5, 8, steel[4])
    cv.px(ox + 22, 8, steel[3])
    for y in range(9, 12):
        cv.px(ox + 5, y, kuro[1])
        cv.px(ox + 22, y, kuro[0])

    # y=12..14: Lower seat cushion & bolsters disappearing behind north desk
    for y in range(12, 15):
        cv.px(ox + 7, y, kuro[0])
        cv.px(ox + 8, y, acc_dark)
        cv.hline(ox + 9, ox + 18, y, kuro[1])
        cv.px(ox + 19, y, acc_dark)
        cv.px(ox + 20, y, kuro[0])


def draw_hanging_headset(
    cv: Canvas,
    R: dict[str, list[RGB]],
    x0: int,
    y0: int,
    edition: str,
) -> None:
    """Draw a sculpted pro gaming headset hanging on a partition hook (5x7 px)."""
    kuro = R["kuro"]
    steel = R["steel"]
    ink = R["ink"]
    ring_hi = R["red"][5] if edition == "red" else R["glass"][6]
    ring_mid = R["orange"][4] if edition == "red" else R["teal"][4]

    # Brushed steel hook on top rail
    cv.px(x0 + 2, y0, steel[6])
    cv.px(x0 + 2, y0 + 1, steel[4])

    # Padded arched headband
    cv.hline(x0 + 1, x0 + 3, y0 + 1, kuro[4])
    cv.px(x0 + 2, y0 + 1, ring_mid)  # inner headband cushion accent
    cv.px(x0, y0 + 2, kuro[3])
    cv.px(x0 + 4, y0 + 2, kuro[2])

    # Dual sculpted oval earcups + glowing RGB rings
    for dy in (3, 4, 5):
        cv.px(x0, y0 + dy, kuro[3] if dy == 3 else kuro[2])
        cv.px(x0 + 1, y0 + dy, ring_hi if dy == 4 else kuro[1])
        cv.px(x0 + 3, y0 + dy, ring_mid if dy == 4 else kuro[1])
        cv.px(x0 + 4, y0 + dy, kuro[2] if dy == 3 else kuro[0])
    # Drop shadow on partition felt
    cv.px(x0 + 1, y0 + 6, ink[0])
    cv.px(x0 + 3, y0 + 6, ink[0])
    if edition == "red":
        # Tiny boom-mic tip extending down-left
        cv.px(x0, y0 + 6, kuro[2])
        cv.px(x0 + 1, y0 + 6, R["red"][4])


def draw_moba_screen(
    cv: Canvas,
    R: dict[str, list[RGB]],
    sx: int,
    sy: int,
    variant: int,
) -> None:
    """Render a crisp 13x8 glowing game scene inside (sx..sx+12, sy..sy+7)."""
    fol = R["foliage"]
    mid = R["midori"]
    teal = R["teal"]
    glass = R["glass"]
    blue = R["blue"]
    navy = R["navy"]
    red = R["red"]
    org = R["orange"]
    yel = R["yellow"]
    pink = R["pink"]
    cw = R["coolwhite"]
    straw = R["straw"]

    v = variant % 5
    if v == 0:
        # Classic Summoner's Rift diagonal mid-lane + river clash
        for dy in range(7):
            for dx in range(13):
                lane_d = (dx - (10 - dy * 1.4))
                if abs(lane_d) < 1.3:
                    c = straw[3] if (dx + dy) % 2 == 0 else straw[2]
                elif abs(dx - dy - 2) <= 1 and 1 <= dy <= 5:
                    c = glass[5] if dx == dy + 2 else teal[3]
                elif dx + dy < 9:
                    c = fol[2] if (dx + dy) % 2 == 0 else mid[2]
                else:
                    c = fol[3] if (dx * 2 + dy) % 3 == 0 else fol[1]
                cv.px(sx + dx, sy + dy, c)
        # Turrets, hero spell VFX & HP bars
        cv.px(sx + 3, sy + 5, blue[5])
        cv.px(sx + 4, sy + 4, glass[6])
        cv.px(sx + 6, sy + 3, yel[5])
        cv.px(sx + 7, sy + 2, org[5])
        cv.px(sx + 8, sy + 2, red[4])
        cv.px(sx + 2, sy + 1, glass[5])  # top-left score/buff
        cv.px(sx + 3, sy + 1, teal[4])
    elif v == 1:
        # Void/Baron Pit purple-pink crystal boss fight!
        for dy in range(7):
            for dx in range(13):
                dist = abs(dx - 6) + abs(dy - 3)
                if dist <= 2:
                    c = pink[5] if dist == 0 else pink[3]
                elif dist <= 4:
                    c = navy[2] if (dx + dy) % 2 == 0 else teal[2]
                else:
                    c = mid[1] if dx < 6 else fol[1]
                cv.px(sx + dx, sy + dy, c)
        cv.px(sx + 6, sy + 2, cw[5])
        cv.px(sx + 5, sy + 3, glass[6])
        cv.px(sx + 7, sy + 3, yel[5])
        cv.hline(sx + 3, sx + 9, sy + 1, red[4])  # Boss HP bar
        cv.hline(sx + 3, sx + 7, sy + 1, org[4])
    elif v == 2:
        # Hero Shooter Sci-Fi Payload Arena (Overwatch cyber street)
        cv.rect(sx, sy, sx + 12, sy + 2, blue[3])
        cv.hline(sx + 2, sx + 10, sy + 1, glass[5])
        cv.rect(sx, sy + 3, sx + 12, sy + 6, R["kawara"][2])
        # Glowing payload & shield barrier
        cv.rect(sx + 3, sy + 2, sx + 6, sy + 5, glass[5])
        cv.rect(sx + 4, sy + 3, sx + 5, sy + 4, glass[6])
        cv.px(sx + 8, sy + 3, org[5])
        cv.px(sx + 9, sy + 4, red[4])
        cv.px(sx + 6, sy + 3, cw[5])
    elif v == 3:
        # Isometric ARPG Raid Boss / Golden Loot Beam
        cv.rect(sx, sy, sx + 12, sy + 6, R["kuro"][1])
        for dy in range(1, 6):
            cv.hline(sx + 2, sx + 10, sy + dy, R["stone"][1] if dy % 2 else R["kawara"][1])
        # Glowing magic circle & loot beam
        cv.hline(sx + 4, sx + 8, sy + 4, teal[4])
        cv.hline(sx + 5, sx + 7, sy + 3, glass[6])
        cv.vline(sx + 6, sy + 1, sy + 4, yel[5])
        cv.px(sx + 5, sy + 2, org[4])
        cv.px(sx + 9, sy + 3, red[4])
    else:
        # RTS / StarCraft Mineral Line & Cyber Base
        cv.rect(sx, sy, sx + 12, sy + 6, R["earth"][0])
        cv.hline(sx + 1, sx + 4, sy + 1, glass[6])  # crystal minerals
        cv.hline(sx + 1, sx + 3, sy + 2, teal[4])
        cv.rect(sx + 5, sy + 2, sx + 8, sy + 4, R["steel"][4])  # Nexus/CC
        cv.px(sx + 6, sy + 3, glass[6])
        cv.px(sx + 10, sy + 4, R["green"][4])
        cv.px(sx + 11, sy + 5, yel[4])

    # Bottom HUD bar (sy+7) + Minimap (sx+10..12, sy+5..7)
    cv.hline(sx, sx + 12, sy + 7, navy[0])
    cv.hline(sx + 2, sx + 4, sy + 7, R["green"][4])
    cv.hline(sx + 5, sx + 7, sy + 7, blue[4])
    cv.px(sx + 8, sy + 7, yel[4])
    cv.rect(sx + 10, sy + 5, sx + 12, sy + 7, mid[1])
    cv.px(sx + 11, sy + 6, glass[6])
    cv.px(sx + 12, sy + 5, red[4] if v % 2 == 0 else yel[5])


def draw_fps_screen(
    cv: Canvas,
    R: dict[str, list[RGB]],
    sx: int,
    sy: int,
    variant: int,
) -> None:
    """Render an intense 14x8 240Hz Tactical FPS scene inside (sx..sx+13, sy..sy+7)."""
    kuro = R["kuro"]
    maple = R["maple"]
    red = R["red"]
    org = R["orange"]
    yel = R["yellow"]
    cream = R["cream"]
    cedar = R["cedar"]
    cw = R["coolwhite"]
    green = R["green"]
    navy = R["navy"]

    v = variant % 4
    if v == 0:
        # Dust / Mirage Sandstone Bombsite A + Muzzle Flash
        cv.rect(sx, sy, sx + 13, sy + 1, R["glass"][4])  # sky strip
        cv.rect(sx, sy + 1, sx + 3, sy + 5, cedar[3])  # left sandstone wall
        cv.rect(sx + 4, sy + 2, sx + 9, sy + 5, cream[3])  # sunlit mid wall
        cv.rect(sx + 10, sy + 1, sx + 13, sy + 5, cedar[2])  # right pillar
        cv.rect(sx + 5, sy + 3, sx + 7, sy + 5, maple[0])  # dark doorway peek
        cv.rect(sx, sy + 6, sx + 13, sy + 6, cedar[4])  # sandy floor
        # Enemy peek + bright muzzle flash + crosshair
        cv.px(sx + 6, sy + 4, red[4])
        cv.px(sx + 6, sy + 3, green[5])  # crisp FPS crosshair
        cv.px(sx + 9, sy + 4, yel[5])  # muzzle flash
        cv.px(sx + 8, sy + 4, org[5])
    elif v == 1:
        # AWP / Operator Sniper Scope Zoomed Reticle!
        cv.rect(sx, sy, sx + 13, sy + 6, kuro[0])
        cv.rect(sx + 3, sy + 1, sx + 10, sy + 5, cream[2])
        cv.rect(sx + 5, sy + 2, sx + 8, sy + 4, cream[4])
        # Scope crosshairs & center red dot
        cv.hline(sx + 3, sx + 10, sy + 3, kuro[1])
        cv.vline(sx + 6, sy + 1, sy + 5, kuro[1])
        cv.px(sx + 6, sy + 3, red[5])
        cv.px(sx + 7, sy + 2, maple[2])
    elif v == 2:
        # Cyber-Reactor Night Map (Bind / Haven night site)
        cv.rect(sx, sy, sx + 13, sy + 5, navy[1])
        cv.rect(sx + 2, sy + 1, sx + 4, sy + 5, R["kawara"][2])
        cv.rect(sx + 5, sy + 2, sx + 8, sy + 5, org[4])  # glowing radianite crate!
        cv.rect(sx + 6, sy + 2, sx + 7, sy + 4, yel[5])
        cv.rect(sx, sy + 6, sx + 13, sy + 6, R["asphalt"][2])
        cv.px(sx + 7, sy + 3, red[5])  # crosshair on target
    else:
        # Tactical Buy Menu / Scoreboard Loadout Overlay
        cv.rect(sx, sy, sx + 13, sy + 6, maple[0])
        cv.rect(sx + 1, sy + 1, sx + 12, sy + 5, kuro[1])
        for ry, col in ((2, red[4]), (3, yel[4]), (4, cw[4])):
            cv.hline(sx + 2, sx + 5, sy + ry, col)
            cv.hline(sx + 7, sx + 11, sy + ry, R["steel"][4])

    # First-person angled Crimson Vandal/AK rifle barrel in bottom-right (variants 0, 2)
    if v in (0, 2):
        cv.hline(sx + 9, sx + 12, sy + 5, kuro[1])
        cv.px(sx + 10, sy + 5, red[4])
        cv.hline(sx + 10, sx + 13, sy + 6, kuro[0])
        cv.px(sx + 11, sy + 6, red[5])
        cv.px(sx + 12, sy + 6, org[4])

    # Top round timer pip & Bottom FPS HUD (HP + Ammo in yellow/red)
    cv.px(sx + 6, sy, cw[5])
    cv.px(sx + 4, sy, red[4])
    cv.px(sx + 8, sy, R["glass"][5])
    cv.hline(sx, sx + 13, sy + 7, kuro[0])
    cv.hline(sx + 1, sx + 3, sy + 7, cw[4])  # 100 HP
    cv.px(sx + 4, sy + 7, red[4])
    cv.hline(sx + 10, sx + 12, sy + 7, yel[4])  # 30/90 Ammo


def draw_seat_badge_dots(
    cv: Canvas,
    x0: int,
    y0: int,
    seat_idx: int,
    hi: RGB,
    mid: RGB,
) -> None:
    """Draw distinct glowing micro-digit patterns inside a 4x2 badge window."""
    patterns = [
        [(0, 0), (0, 1), (2, 0), (3, 1)],          # 01
        [(0, 0), (1, 1), (2, 0), (3, 0), (2, 1)],  # 02
        [(0, 0), (1, 0), (1, 1), (3, 0), (3, 1)],  # 03
        [(0, 0), (0, 1), (1, 1), (2, 0), (2, 1)],  # 04
        [(0, 0), (1, 0), (0, 1), (2, 1), (3, 0)],  # 05
    ]
    pts = patterns[seat_idx % len(patterns)]
    for i, (dx, dy) in enumerate(pts):
        cv.px(x0 + dx, y0 + dy, hi if i % 2 == 0 else mid)


def draw_desk_drink(
    cv: Canvas,
    R: dict[str, list[RGB]],
    x0: int,
    y0: int,
    kind: int,
) -> None:
    """Draw a 3x5 beverage prop (energy can, iced coffee, berry can, citrus bottle)."""
    kuro = R["kuro"]
    steel = R["steel"]
    cw = R["coolwhite"]

    k = kind % 4
    if k == 0:
        # Monster-style dark green claw energy can
        cv.hline(x0, x0 + 2, y0, steel[5])
        cv.px(x0 + 1, y0, cw[5])
        for dy in (1, 2, 3):
            cv.px(x0, y0 + dy, kuro[2])
            cv.px(x0 + 1, y0 + dy, R["green"][4] if dy in (1, 2) else kuro[1])
            cv.px(x0 + 2, y0 + dy, kuro[0])
        cv.hline(x0, x0 + 2, y0 + 4, R["ink"][0])
    elif k == 1:
        # Korean PC Bang Iced Americano cup with dome lid & cyan straw!
        cv.px(x0 + 2, y0 - 1, R["teal"][4])  # angled straw!
        cv.hline(x0, x0 + 2, y0, cw[4])  # dome lid
        cv.px(x0 + 1, y0, cw[5])
        for dy in (1, 2, 3):
            cv.px(x0, y0 + dy, R["cha"][3] if dy == 1 else R["cha"][2])
            cv.px(x0 + 1, y0 + dy, R["cha"][1])
            cv.px(x0 + 2, y0 + dy, R["cha"][0])
        cv.hline(x0, x0 + 2, y0 + 4, R["ink"][0])
    elif k == 2:
        # Crimson Berry / RedBull sleek silver-red can
        cv.hline(x0, x0 + 2, y0, steel[6])
        cv.hline(x0, x0 + 2, y0 + 1, R["red"][4])
        cv.px(x0, y0 + 2, steel[4])
        cv.px(x0 + 1, y0 + 2, R["blue"][3])
        cv.px(x0 + 2, y0 + 2, steel[2])
        cv.hline(x0, x0 + 2, y0 + 3, R["red"][3])
        cv.hline(x0, x0 + 2, y0 + 4, R["ink"][0])
    else:
        # Golden Citrus Vitamin Drink
        cv.px(x0 + 1, y0, R["orange"][4])  # bottle cap
        for dy in (1, 2, 3):
            cv.px(x0, y0 + dy, R["yellow"][5] if dy == 1 else R["yellow"][4])
            cv.px(x0 + 1, y0 + dy, R["orange"][4] if dy == 2 else R["yellow"][3])
            cv.px(x0 + 2, y0 + dy, R["orange"][2])
        cv.hline(x0, x0 + 2, y0 + 4, R["ink"][0])


# ---------------------------------------------------------------------------
# 1. pcb3-b2b-blue-1 (32x64) & Multi-Seat Composites (blue-4, blue-5)
# ---------------------------------------------------------------------------


def render_b2b_blue_pod(
    cv: Canvas,
    R: dict[str, list[RGB]],
    ox: int,
    seat_idx: int = 0,
    vary_props: bool = False,
) -> None:
    """Render one 32x64 Cyan/Teal Pro Back-to-Back 2-Seat Gaming Pod at x=ox..ox+31."""
    kuro = R["kuro"]
    kaw = R["kawara"]
    steel = R["steel"]
    navy = R["navy"]
    glass = R["glass"]
    teal = R["teal"]
    pink = R["pink"]
    cw = R["coolwhite"]
    ink = R["ink"]

    # --- A. NORTH BUCKET GAMING CHAIR (y=1..14, x=5..22, transparent corners!) ---
    draw_north_bucket_chair(cv, R, ox, edition="blue")

    # --- B. NORTH DESK SURFACE (y=14..21, x=0..31 flush) ---
    cv.hline(ox, ox + 31, 14, kaw[3])
    cv.hline(ox + 7, ox + 20, 14, kuro[1])  # chair overlap occlusion
    for y in range(15, 22):
        base = kaw[2] if y < 18 else kaw[1]
        cv.hline(ox, ox + 31, y, base)
        # Subtle diagonal surface sheen on open left/right edges
        cv.px(ox + 1, y, kaw[3] if y < 17 else kaw[2])
        cv.px(ox + 24, y, kaw[1])
    # Subtle north deskmat peeking around monitors
    cv.hline(ox + 4, ox + 22, 15, teal[2])
    cv.hline(ox + 4, ox + 22, 16, navy[1])

    # --- C. NORTH DUAL CURVED MONITOR BACKS + NORTH RGB TOWER (y=11..21) ---
    # Primary 27" Curved Monitor Rear Shell (x=3..16, y=11..20)
    cv.hline(ox + 5, ox + 14, 11, kaw[4])  # curved sunlit top bezel
    cv.px(ox + 4, 11, kuro[0])
    cv.px(ox + 15, 11, kuro[0])
    cv.px(ox + 3, 12, kuro[0])
    cv.hline(ox + 4, ox + 10, 12, kaw[3])
    cv.hline(ox + 11, ox + 15, 12, kuro[3])
    cv.px(ox + 16, 12, kuro[0])

    for y in range(13, 19):
        cv.px(ox + 3, y, kuro[0])
        for dx in range(4, 16):
            shade = kuro[3] if dx + y < 22 else (kuro[2] if dx < 12 else kuro[1])
            cv.px(ox + dx, y, shade)
        cv.px(ox + 16, y, kuro[0])
    cv.hline(ox + 4, ox + 15, 19, kuro[0])

    # Glowing V-Wing Cyan RGB Accents on North Monitor Rear!
    for step, (lx, rx, ry) in enumerate([(5, 14, 14), (6, 13, 15), (7, 12, 16)]):
        c_wing = glass[6] if step == 0 else (glass[5] if step == 1 else teal[4])
        cv.px(ox + lx, ry, c_wing)
        cv.px(ox + rx, ry, c_wing)
        cv.px(ox + lx + 1, ry, teal[3])
        cv.px(ox + rx - 1, ry, teal[2])

    # Cast-aluminum monitor arm & base on north desk
    for y in range(16, 20):
        cv.px(ox + 9, y, steel[3])
        cv.px(ox + 10, y, steel[1])
    cv.hline(ox + 7, ox + 12, 20, steel[2])
    cv.hline(ox + 7, ox + 12, 21, ink[0])

    # Secondary Angled North Monitor Rear (x=17..23, y=12..20)
    cv.hline(ox + 18, ox + 22, 12, kaw[3])
    cv.px(ox + 17, 12, kuro[0])
    cv.px(ox + 23, 13, kuro[0])
    for y in range(13, 19):
        cv.px(ox + 17, y, kuro[0])
        cv.hline(ox + 18, ox + 22, y, kuro[2] if y < 16 else kuro[1])
        cv.px(ox + 23, y, kuro[0])
    cv.hline(ox + 19, ox + 21, 15, glass[5])  # cyan LED bar
    cv.px(ox + 20, 15, glass[6])
    cv.hline(ox + 18, ox + 22, 19, kuro[0])
    cv.px(ox + 20, 19, steel[2])
    cv.hline(ox + 19, ox + 21, 20, ink[0])

    # North Compact Dark RGB PC Tower (x=25..30, y=13..21 — keeps y=1..12 at x=27..31 transparent!)
    cv.px(ox + 25, 13, kuro[0])
    cv.hline(ox + 26, ox + 29, 13, kaw[3])
    cv.px(ox + 30, 13, kuro[0])
    cv.px(ox + 25, 14, kuro[2])
    cv.hline(ox + 26, ox + 29, 14, kuro[3])
    cv.px(ox + 26, 14, glass[6])  # top power LED
    cv.px(ox + 30, 14, kuro[0])
    for y in range(15, 21):
        cv.px(ox + 25, y, kuro[2])
        cv.px(ox + 26, y, kuro[1])
        cv.px(ox + 27, y, glass[5] if y in (16, 17) else teal[4] if y in (15, 18) else kuro[1])
        cv.px(ox + 28, y, kuro[1])
        cv.px(ox + 29, y, kuro[0])
        cv.px(ox + 30, y, kuro[0])
    cv.hline(ox + 25, ox + 30, 21, ink[0])

    # --- D. CONTINUOUS 3/4 CENTRAL ACOUSTIC PARTITION SPINE (y=22..29, x=0..31 flush) ---
    cv.hline(ox, ox + 31, 22, navy[0])
    # Sunlit 3/4 brushed-steel top rail (y=23..24)
    cv.hline(ox, ox + 31, 23, steel[5])
    cv.px(ox, 23, steel[3])  # subtle modular post joint
    cv.px(ox + 31, 23, steel[3])
    cv.hline(ox, ox + 31, 24, kaw[4])
    cv.hline(ox + 7, ox + 23, 24, teal[4])  # recessed cyan fiber-optic trim
    cv.hline(ox + 10, ox + 16, 24, glass[5])

    # Recessed dark felt acoustic face (y=25..28)
    for y in range(25, 29):
        cv.hline(ox, ox + 31, y, navy[1] if y < 27 else navy[0])
        for x in range(1, 31, 4):
            cv.px(ox + x + (y % 2), y, kaw[1] if y < 27 else kuro[1])
    cv.px(ox, 25, steel[2])
    cv.px(ox + 31, 25, steel[1])

    # Glowing Mini Seat-Number Plaque (x=25..30, y=24..27)
    cv.rect(ox + 25, 24, ox + 30, 27, kuro[0])
    cv.rect(ox + 26, 25, ox + 29, 26, navy[1])
    draw_seat_badge_dots(cv, ox + 26, 25, seat_idx, glass[6], teal[5])

    # Sculpted Gaming Headset on Partition Hook (x=2..6, y=23..29)
    draw_hanging_headset(cv, R, ox + 2, 23, edition="blue")

    # --- E. SOUTH DEEP 3/4 GAMING DESK (y=29..49, x=0..31 flush — ZERO gaps!) ---
    # Solid dark acoustic backing behind monitors (y=29..37)
    for y in range(29, 38):
        cv.hline(ox, ox + 31, y, kuro[1] if y < 34 else kaw[1])
        cv.px(ox, y, kaw[2] if y >= 35 else kuro[1])
        cv.px(ox + 31, y, kuro[0])

    # Deep 3/4 Slate Desktop Plane (y=38..44, x=0..31 flush)
    for y in range(38, 45):
        c_desk = kaw[3] if y in (43, 44) else kaw[2]
        cv.hline(ox, ox + 31, y, c_desk)
        cv.hline(ox, ox + 2, y, kaw[3])  # top-left daylight on left desk wing
        cv.hline(ox + 24, ox + 31, y, kaw[1])  # tower shadow side

    # Front Beveled Desk Bullnose & Apron (y=45..46, x=0..31 flush)
    cv.hline(ox, ox + 31, 45, kaw[4])
    cv.hline(ox + 4, ox + 27, 45, teal[3])  # sleek cyan edge inlay
    cv.hline(ox + 8, ox + 19, 45, teal[4])
    cv.hline(ox, ox + 31, 46, kuro[0])

    # Recessed Kneehole Shadow + Side Stanchion Legs (y=47..50)
    cv.hline(ox + 3, ox + 28, 47, ink[0])
    cv.hline(ox + 5, ox + 26, 48, ink[0])
    for y in range(47, 50):
        cv.px(ox, y, steel[2])
        cv.px(ox + 1, y, kuro[1])
        cv.px(ox + 2, y, kuro[0])
        cv.px(ox + 29, y, kuro[0])
        cv.px(ox + 30, y, kuro[1])
        cv.px(ox + 31, y, kuro[0])
    cv.hline(ox, ox + 2, 50, ink[0])
    cv.hline(ox + 29, ox + 31, 50, ink[0])

    # South Primary 27" Curved Monitor (x=3..17, y=29..39)
    cv.hline(ox + 4, ox + 16, 29, kaw[4])  # curved top bezel catchlight
    cv.px(ox + 3, 30, kuro[0])
    cv.px(ox + 17, 30, kuro[0])
    for y in range(30, 38):
        cv.px(ox + 3, y, kuro[1] if y < 34 else kuro[0])
        cv.px(ox + 17, y, kuro[0])
    cv.hline(ox + 3, ox + 17, 38, kuro[1])
    cv.px(ox + 10, 38, glass[6])  # monitor power LED
    # Monitor stand neck & low-profile base
    cv.hline(ox + 9, ox + 11, 38, steel[3])
    cv.hline(ox + 7, ox + 13, 39, steel[2])
    # MOBA / Multi-genre screen (x=4..16, y=30..37)
    draw_moba_screen(cv, R, ox + 4, 30, seat_idx if vary_props else 0)

    # South Angled Secondary Discord / Chat Monitor (x=18..24, y=30..38)
    cv.hline(ox + 18, ox + 21, 30, kaw[3])
    cv.hline(ox + 22, ox + 24, 31, kaw[2])  # 1px step-down shows inward 3/4 angle!
    for y in range(31, 38):
        cv.px(ox + 18, y, kuro[0])
        cv.hline(ox + 19, ox + 23, y, navy[0])
        cv.px(ox + 24, y, kuro[0])
    # Discord voice avatars + chat lines (varied per seat)
    av_cols = [teal[4], pink[4], R["green"][4], R["yellow"][4]]
    for row_i, sy in enumerate((32, 34, 36)):
        ac = av_cols[(row_i + seat_idx) % len(av_cols)]
        cv.px(ox + 19, sy, ac)
        cv.hline(ox + 21, ox + 22, sy, cw[3] if row_i != 1 else R["blue"][4])
    cv.px(ox + 20, 32 + (seat_idx % 2) * 2, R["green"][5])  # active mic dot
    cv.hline(ox + 18, ox + 21, 38, kuro[1])
    cv.hline(ox + 22, ox + 24, 38, kuro[0])
    cv.hline(ox + 20, ox + 21, 39, steel[2])

    # Tempered-Glass RGB PC Tower (x=25..30, y=30..43)
    # 3/4 Top plane (y=30..32)
    cv.hline(ox + 25, ox + 30, 30, kaw[4])
    cv.px(ox + 30, 30, kuro[1])
    cv.hline(ox + 25, ox + 29, 31, kuro[3])
    cv.px(ox + 27, 31, steel[2])
    cv.px(ox + 28, 31, steel[2])
    cv.px(ox + 30, 31, kuro[1])
    cv.hline(ox + 25, ox + 29, 32, kuro[2])
    cv.px(ox + 29, 32, glass[6])  # top I/O power LED
    cv.px(ox + 30, 32, kuro[0])

    # Left Tempered-Glass Side Panel (x=25..28) + Front Mesh Bezel (x=29..30)
    for y in range(33, 43):
        # Glass interior
        cv.px(ox + 25, y, kuro[1] if y in (33, 42) else glass[1])
        cv.px(ox + 26, y, glass[0])
        cv.px(ox + 27, y, glass[0])
        cv.px(ox + 28, y, kuro[1])
        # Front mesh + RGB intake fans
        cv.px(ox + 29, y, glass[5] if y in (34, 35, 38, 39) else kuro[2])
        cv.px(ox + 30, y, kuro[0])

    # Glowing Internal RGB Fan Ring + Pink/Cyan GPU Lightbar!
    cv.px(ox + 26, 34, glass[6])
    cv.px(ox + 27, 34, pink[4])
    cv.px(ox + 26, 35, pink[5])
    cv.px(ox + 27, 35, glass[5])
    cv.px(ox + 25, 36, glass[3])  # diagonal glass specular glint
    cv.hline(ox + 25, ox + 27, 38, teal[5])  # GPU RGB strip
    cv.px(ox + 26, 38, glass[6])
    cv.hline(ox + 25, ox + 28, 41, kuro[1])  # PSU shroud
    cv.px(ox + 27, 41, teal[4])
    cv.hline(ox + 25, ox + 30, 43, ink[0])  # tower contact shadow on desk

    # Extended Stitched Gaming Deskmat (x=4..23, y=39..44)
    cv.rect(ox + 4, 39, ox + 23, 44, navy[0])
    cv.hline(ox + 4, ox + 23, 39, teal[3])
    cv.hline(ox + 4, ox + 23, 44, teal[2])
    cv.vline(ox + 4, 39, 44, teal[4])
    cv.vline(ox + 23, 39, 44, teal[2])

    # TKL Mechanical RGB Keyboard (x=6..15, y=40..43)
    cv.rect(ox + 6, 40, ox + 15, 43, kuro[0])
    rgb_row1 = [glass[6], teal[4], R["green"][4], R["yellow"][4], pink[4], R["blue"][4], glass[5], cw[4]]
    for i, kc in enumerate(rgb_row1):
        cv.px(ox + 7 + i, 41, kc)
    cv.px(ox + 7, 42, teal[5])  # WASD highlight
    cv.px(ox + 8, 42, glass[6])
    cv.hline(ox + 9, ox + 12, 42, cw[4])  # spacebar
    cv.px(ox + 13, 42, pink[4])
    cv.px(ox + 14, 42, teal[4])

    # Wireless Pro Gaming Mouse (x=18..20, y=41..43)
    cv.px(ox + 19, 41, glass[6])
    cv.px(ox + 18, 41, cw[4])
    cv.px(ox + 18, 42, cw[5])
    cv.px(ox + 19, 42, cw[3])
    cv.px(ox + 20, 42, kuro[0])
    cv.hline(ox + 18, ox + 19, 43, teal[4])

    # Subtle per-seat beverage variation on multi-seat composites
    if vary_props and seat_idx in (1, 3):
        draw_desk_drink(cv, R, ox + 1, 39, kind=seat_idx)

    # --- F. SOUTH SCULPTED HIGH-BACK GAMING CHAIR (y=42..62, overlapping kneehole!) ---
    draw_south_bucket_chair(cv, R, ox, 42, edition="blue")


# ---------------------------------------------------------------------------
# 2. pcb3-b2b-red-1 (32x64) & Multi-Seat Composite (pcb3-b2b-red-4)
# ---------------------------------------------------------------------------


def render_b2b_red_pod(
    cv: Canvas,
    R: dict[str, list[RGB]],
    ox: int,
    seat_idx: int = 0,
    vary_props: bool = False,
) -> None:
    """Render one 32x64 240Hz FPS Pro Crimson Edition Back-to-Back 2-Seat Pod."""
    kuro = R["kuro"]
    asph = R["asphalt"]
    steel = R["steel"]
    maple = R["maple"]
    red = R["red"]
    org = R["orange"]
    yel = R["yellow"]
    cw = R["coolwhite"]
    ink = R["ink"]

    # --- A. NORTH VIPER PRO GAMING CHAIR (y=1..14, transparent corners!) ---
    draw_north_bucket_chair(cv, R, ox, edition="red")

    # --- B. NORTH OBSIDIAN CARBON DESK (y=14..21, x=0..31 flush) ---
    cv.hline(ox, ox + 31, 14, asph[4])
    cv.hline(ox + 7, ox + 20, 14, kuro[0])
    for y in range(15, 22):
        cv.hline(ox, ox + 31, y, asph[2] if y < 18 else asph[1])
        cv.px(ox + 1, y, asph[3] if y < 17 else asph[2])
    cv.hline(ox + 4, ox + 22, 15, red[2])
    cv.hline(ox + 4, ox + 22, 16, maple[0])

    # --- C. NORTH 240Hz MONITOR REAR WITH HOOD SHIELDS + LIQUID TOWER (y=11..21) ---
    # Primary Esports Monitor Rear + Side Hood Blinders (x=3..18, y=11..20)
    cv.hline(ox + 5, ox + 16, 11, asph[4])
    cv.px(ox + 4, 11, maple[0])
    cv.px(ox + 17, 11, kuro[0])
    for y in range(12, 19):
        # Angled rear anti-glare hood wings at x=3..4 and x=17..18!
        cv.px(ox + 3, y, asph[3] if y < 15 else kuro[1])
        cv.px(ox + 4, y, maple[2] if y in (13, 14) else kuro[2])
        for dx in range(5, 17):
            cv.px(ox + dx, y, kuro[3] if dx + y < 22 else kuro[1])
        cv.px(ox + 17, y, maple[1] if y in (13, 14) else kuro[1])
        cv.px(ox + 18, y, kuro[0])
    cv.hline(ox + 4, ox + 17, 19, kuro[0])

    # Crimson Slash / V-LED on North Monitor Back
    for step, (lx, rx, ry) in enumerate([(6, 15, 13), (7, 14, 14), (8, 13, 15)]):
        c_led = red[5] if step == 0 else (org[4] if step == 1 else red[3])
        cv.px(ox + lx, ry, c_led)
        cv.px(ox + rx, ry, c_led)
        cv.px(ox + lx + 1, ry, maple[2])

    for y in range(16, 20):
        cv.px(ox + 10, y, steel[3])
        cv.px(ox + 11, y, kuro[0])
    cv.hline(ox + 8, ox + 13, 20, asph[3])
    cv.hline(ox + 8, ox + 13, 21, ink[0])

    # North Vertical Stat Monitor Rear (x=19..23, y=12..20)
    cv.hline(ox + 19, ox + 22, 12, asph[4])
    for y in range(13, 19):
        cv.px(ox + 19, y, kuro[0])
        cv.hline(ox + 20, ox + 22, y, kuro[2] if y < 16 else kuro[1])
        cv.px(ox + 23, y, kuro[0])
    cv.vline(ox + 21, 14, 16, red[4])
    cv.hline(ox + 19, ox + 23, 19, kuro[0])
    cv.hline(ox + 20, ox + 22, 20, ink[0])

    # North Crimson Liquid-Cooled Tower (x=25..30, y=13..21)
    cv.hline(ox + 25, ox + 29, 13, asph[4])
    cv.px(ox + 30, 13, kuro[0])
    cv.hline(ox + 25, ox + 29, 14, kuro[2])
    cv.px(ox + 26, 14, red[5])
    cv.px(ox + 27, 14, org[4])
    cv.px(ox + 30, 14, kuro[0])
    for y in range(15, 21):
        cv.px(ox + 25, y, kuro[2])
        cv.px(ox + 26, y, maple[1])
        cv.px(ox + 27, y, red[4] if y in (16, 17, 18) else org[4] if y == 15 else kuro[1])
        cv.px(ox + 28, y, kuro[1])
        cv.px(ox + 29, y, kuro[0])
        cv.px(ox + 30, y, kuro[0])
    cv.hline(ox + 25, ox + 30, 21, ink[0])

    # --- D. GUNMETAL PARTITION SPINE WITH "240Hz" BADGE (y=22..29, x=0..31 flush) ---
    cv.hline(ox, ox + 31, 22, maple[0])
    cv.hline(ox, ox + 31, 23, asph[5])
    cv.px(ox, 23, asph[3])
    cv.px(ox + 31, 23, asph[3])
    cv.hline(ox, ox + 31, 24, asph[3])
    cv.hline(ox + 7, ox + 21, 24, red[4])  # glowing crimson competition LED strip
    cv.hline(ox + 10, ox + 16, 24, org[4])

    for y in range(25, 29):
        cv.hline(ox, ox + 31, y, asph[1] if y < 27 else asph[0])
        for x in range(2, 30, 4):
            cv.px(ox + x, y, maple[1] if y == 25 else kuro[1])

    # "240Hz" Crimson/Amber Esports Plaque (x=22..30, y=24..27)
    cv.rect(ox + 22, 24, ox + 30, 27, kuro[0])
    cv.rect(ox + 23, 25, ox + 29, 26, maple[0])
    # Crisp 2px micro-glyph for "240" + seat pip
    cv.px(ox + 23, 25, yel[5])
    cv.px(ox + 24, 26, yel[4])
    cv.px(ox + 25, 25, org[5])
    cv.px(ox + 25, 26, org[4])
    cv.px(ox + 27, 25, red[5])
    cv.px(ox + 27, 26, red[4])
    cv.px(ox + 29, 25 + (seat_idx % 2), cw[5] if seat_idx % 2 == 0 else yel[5])

    # Boom-Mic Esports Headset on Hook (x=2..6, y=23..29)
    draw_hanging_headset(cv, R, ox + 2, 23, edition="red")

    # --- E. SOUTH 240Hz FPS PRO DESK (y=29..49, x=0..31 flush) ---
    for y in range(29, 38):
        cv.hline(ox, ox + 31, y, asph[0] if y < 34 else asph[1])
        cv.px(ox + 31, y, kuro[0])
    for y in range(38, 45):
        cv.hline(ox, ox + 31, y, asph[2] if y < 43 else asph[3])
        cv.hline(ox, ox + 2, y, asph[3])
        cv.hline(ox + 24, ox + 31, y, asph[1])

    # Front Carbon Bullnose + Crimson Underglow Trim (y=45..46)
    cv.hline(ox, ox + 31, 45, asph[4])
    cv.hline(ox + 3, ox + 28, 45, red[3])
    cv.hline(ox + 8, ox + 20, 45, red[4])
    cv.hline(ox, ox + 31, 46, kuro[0])

    # Recessed Kneehole + Side Stanchion Legs (y=47..50)
    cv.hline(ox + 3, ox + 28, 47, ink[0])
    cv.hline(ox + 5, ox + 26, 48, ink[0])
    for y in range(47, 50):
        cv.px(ox, y, asph[3])
        cv.px(ox + 1, y, kuro[1])
        cv.px(ox + 2, y, kuro[0])
        cv.px(ox + 29, y, kuro[0])
        cv.px(ox + 30, y, kuro[1])
        cv.px(ox + 31, y, kuro[0])
    cv.hline(ox, ox + 2, 50, ink[0])
    cv.hline(ox + 29, ox + 31, 50, ink[0])

    # Pro 240Hz FPS Monitor WITH Angled Side Anti-Glare Hood Shields (x=3..20, y=29..39)
    cv.hline(ox + 5, ox + 18, 29, asph[5])  # top sun-hood visor lip
    # Left angled anti-glare shield (x=3..4, y=29..38)
    cv.px(ox + 3, 29, asph[4])
    cv.px(ox + 4, 29, asph[3])
    for y in range(30, 38):
        cv.px(ox + 3, y, kuro[3] if y < 34 else kuro[2])
        cv.px(ox + 4, y, maple[2] if y in (32, 33, 34) else kuro[0])  # warm screen bounce on inner hood!
    cv.px(ox + 3, 38, kuro[1])
    cv.px(ox + 4, 38, kuro[0])

    # Right angled anti-glare shield (x=19..20, y=29..38)
    cv.px(ox + 19, 29, asph[3])
    cv.px(ox + 20, 29, kuro[1])
    for y in range(30, 38):
        cv.px(ox + 19, y, maple[2] if y in (32, 33, 34) else kuro[0])
        cv.px(ox + 20, y, kuro[1] if y < 34 else kuro[0])
    cv.px(ox + 19, 38, kuro[0])
    cv.px(ox + 20, 38, kuro[0])

    # Monitor bottom bezel + esports angled tournament base + red S-Switch puck
    cv.hline(ox + 5, ox + 18, 38, kuro[1])
    cv.px(ox + 11, 38, red[5])
    cv.hline(ox + 9, ox + 14, 39, steel[2])
    cv.px(ox + 7, 39, red[4])  # BenQ Zowie red S-Switch profile puck!

    # Intense FPS Tactical Shooter Screen (x=5..18, y=30..37)
    draw_fps_screen(cv, R, ox + 5, 30, seat_idx if vary_props else 0)

    # Compact Vertical Killfeed / Comms Mini-Screen (x=21..23, y=31..38)
    cv.hline(ox + 21, ox + 23, 31, asph[4])
    for y in range(32, 38):
        cv.px(ox + 21, y, maple[0])
        cv.px(ox + 22, y, red[4] if y in (33, 35) else cw[3] if y == 34 else kuro[1])
        cv.px(ox + 23, y, kuro[0])
    cv.hline(ox + 21, ox + 23, 38, kuro[0])

    # Liquid-Cooled Crimson/Amber RGB PC Tower (x=24..30, y=30..43)
    cv.hline(ox + 24, ox + 30, 30, asph[4])
    cv.hline(ox + 24, ox + 29, 31, kuro[3])
    cv.px(ox + 26, 31, red[4])  # top radiator crimson glow
    cv.px(ox + 27, 31, org[4])
    cv.px(ox + 30, 31, kuro[1])
    cv.hline(ox + 24, ox + 29, 32, kuro[2])
    cv.px(ox + 29, 32, red[5])
    cv.px(ox + 30, 32, kuro[0])

    for y in range(33, 43):
        cv.px(ox + 24, y, kuro[1] if y in (33, 42) else maple[0])
        cv.px(ox + 25, y, maple[0])
        cv.px(ox + 26, y, maple[1] if y < 39 else kuro[1])
        cv.px(ox + 27, y, maple[0])
        cv.px(ox + 28, y, kuro[1])
        # Front triple crimson RGB mesh fans
        cv.px(ox + 29, y, red[5] if y in (34, 37, 40) else org[4] if y in (35, 38) else kuro[1])
        cv.px(ox + 30, y, kuro[0])

    # Glowing Liquid AIO Pump Block + Amber Coolant Tubes + Red GPU
    cv.px(ox + 25, 34, yel[5])
    cv.px(ox + 26, 34, org[5])
    cv.px(ox + 25, 35, org[4])
    cv.px(ox + 26, 35, red[5])
    cv.px(ox + 27, 35, red[4])  # coolant tube arc
    cv.px(ox + 27, 36, org[4])
    cv.hline(ox + 25, ox + 27, 38, red[5])  # crimson GPU lightbar
    cv.px(ox + 26, 38, yel[4])
    cv.hline(ox + 24, ox + 30, 43, ink[0])

    # XL Red-Stitched Pro FPS Mousepad (x=2..23, y=39..44)
    cv.rect(ox + 2, 39, ox + 23, 44, maple[0])
    cv.rect(ox + 3, 40, ox + 22, 43, kuro[1])
    cv.hline(ox + 2, ox + 23, 39, red[4])
    cv.hline(ox + 2, ox + 23, 44, red[2])
    cv.vline(ox + 2, 39, 44, red[4])
    cv.vline(ox + 23, 39, 44, red[3])

    # Compact 60% Esports FPS Keyboard (x=4..12, y=40..43) + Coiled Red Cable
    cv.hline(ox + 8, ox + 10, 39, red[3])  # coiled aviator cable!
    cv.rect(ox + 4, 40, ox + 12, 43, kuro[0])
    cv.px(ox + 5, 41, red[5])  # WASD crimson cluster
    cv.px(ox + 6, 41, red[4])
    cv.px(ox + 7, 41, org[4])
    cv.hline(ox + 8, ox + 11, 41, cw[4])
    cv.px(ox + 5, 42, red[4])
    cv.hline(ox + 6, ox + 9, 42, yel[4])  # pro yellow spacebar!
    cv.hline(ox + 10, ox + 11, 42, red[4])

    # Mouse Bungee (x=18, y=39..40) + Ultralight Red/White Pro Mouse (x=17..19, y=41..43)
    cv.px(ox + 18, 39, red[4])
    cv.px(ox + 18, 40, kuro[2])
    cv.px(ox + 17, 41, cw[5])
    cv.px(ox + 18, 41, red[5])
    cv.px(ox + 17, 42, red[4])
    cv.px(ox + 18, 42, cw[4])
    cv.px(ox + 19, 42, kuro[0])
    cv.hline(ox + 17, ox + 18, 43, maple[2])

    if vary_props and seat_idx in (1, 2):
        draw_desk_drink(cv, R, ox + 20, 39, kind=2 if seat_idx == 1 else 3)

    # --- F. SOUTH CRIMSON-BOLSTERED PRO GAMING CHAIR (y=42..62) ---
    draw_south_bucket_chair(cv, R, ox, 42, edition="red")


# ---------------------------------------------------------------------------
# 3. pcb3-team-desk-1 (32x48) & Squad Row Composite (pcb3-team-row-4)
# ---------------------------------------------------------------------------


def render_team_desk_pod(
    cv: Canvas,
    R: dict[str, list[RGB]],
    ox: int,
    seat_idx: int = 0,
    vary_props: bool = False,
) -> None:
    """Render one 32x48 Team Room Single-Sided Squad Gaming Station (facing North wall)."""
    kuro = R["kuro"]
    kaw = R["kawara"]
    steel = R["steel"]
    navy = R["navy"]
    glass = R["glass"]
    teal = R["teal"]
    pink = R["pink"]
    cw = R["coolwhite"]
    ink = R["ink"]

    # --- A. RAISED 3/4 REAR MONITOR SHELF & LED AMBIENT LIGHT BAR (y=4..10, x=0..31 flush) ---
    cv.hline(ox, ox + 31, 4, navy[0])
    cv.hline(ox, ox + 31, 5, kaw[5])  # sunlit 3/4 top surface of rear shelf
    cv.px(ox, 5, steel[3])
    cv.px(ox + 31, 5, steel[3])
    cv.hline(ox, ox + 31, 6, kaw[3])
    # Mini Squad Seat Plaque on left of raised shelf (x=2..6, y=5..6)
    cv.rect(ox + 2, 5, ox + 6, 6, navy[1])
    cv.px(ox + 3 + (seat_idx % 3), 5, glass[6])
    cv.px(ox + 4, 6, teal[4])

    # Continuous Cyan/Ice-Blue Ambient LED Light Bar under shelf (y=7..8, x=0..31 flush!)
    cv.hline(ox, ox + 31, 7, glass[6])
    cv.px(ox, 7, glass[5])
    cv.px(ox + 31, 7, glass[5])
    cv.hline(ox, ox + 31, 8, teal[4])
    cv.hline(ox + 6, ox + 25, 8, glass[5])

    # Recessed acoustic wall/cable backplate bathed in LED bias light (y=9..20, x=0..31 solid!)
    for y in range(9, 21):
        bg = glass[1] if y == 9 else (navy[1] if y < 13 else navy[0])
        cv.hline(ox, ox + 31, y, bg)
        cv.px(ox + 31, y, kuro[0])

    # --- B. DUAL CURVED MONITORS + COMPACT RGB MID-TOWER (y=8..22) ---
    # Left Main 27" Curved Tactical Monitor (x=2..16, y=8..20)
    cv.hline(ox + 3, ox + 15, 8, kaw[4])  # curved top bezel catching LED bar light
    for y in range(9, 18):
        cv.px(ox + 2, y, kuro[1] if y < 13 else kuro[0])
        cv.px(ox + 16, y, kuro[0])
    cv.hline(ox + 2, ox + 16, 18, kuro[1])
    cv.px(ox + 9, 18, glass[6])
    # Stand neck & base
    cv.hline(ox + 8, ox + 10, 19, steel[3])
    cv.hline(ox + 6, ox + 12, 20, steel[2])
    # Tactical 5v5 screen (x=3..15, y=9..16 -> 13x8 screen!)
    draw_moba_screen(cv, R, ox + 3, 9, seat_idx if vary_props else 0)
    # Extra bottom status strip at y=17
    cv.hline(ox + 3, ox + 15, 17, kuro[1])
    cv.hline(ox + 4, ox + 7, 17, teal[4])
    cv.hline(ox + 9, ox + 12, 17, R["yellow"][4])

    # Right Squad Voice-Chat Portraits Monitor (x=17..23, y=10..20)
    cv.hline(ox + 17, ox + 21, 10, kaw[3])
    cv.hline(ox + 22, ox + 23, 11, kaw[2])
    for y in range(11, 19):
        cv.px(ox + 17, y, kuro[0])
        cv.hline(ox + 18, ox + 22, y, kuro[1])
        cv.px(ox + 23, y, kuro[0])
    # 4 Squad Voice-Chat Portrait Tiles (2x2 grid of facecams + active green mic ring!)
    cam_cols = [glass[5], pink[4], R["yellow"][4], teal[4]]
    coords = [(18, 12), (21, 12), (18, 15), (21, 15)]
    for idx, (cx, cy) in enumerate(coords):
        cc = cam_cols[(idx + seat_idx) % 4]
        cv.px(ox + cx, cy, cc)
        cv.px(ox + cx + 1, cy, cw[4])
        active = idx == (seat_idx % 4)
        cv.hline(ox + cx, ox + cx + 1, cy + 1, R["green"][5] if active else navy[2])
    cv.hline(ox + 17, ox + 23, 19, kuro[0])
    cv.hline(ox + 19, ox + 21, 20, steel[2])

    # Compact RGB Mid-Tower on Right (x=24..30, y=9..22)
    cv.hline(ox + 24, ox + 30, 9, kaw[4])
    cv.hline(ox + 24, ox + 29, 10, kuro[3])
    cv.px(ox + 26, 10, steel[2])
    cv.px(ox + 27, 10, steel[2])
    cv.px(ox + 30, 10, kuro[1])
    cv.hline(ox + 24, ox + 29, 11, kuro[2])
    cv.px(ox + 29, 11, glass[6])
    cv.px(ox + 30, 11, kuro[0])

    for y in range(12, 22):
        cv.px(ox + 24, y, kuro[1] if y in (12, 21) else glass[1])
        cv.px(ox + 25, y, glass[0])
        cv.px(ox + 26, y, glass[0])
        cv.px(ox + 27, y, glass[1] if y < 17 else kuro[1])
        cv.px(ox + 28, y, kuro[1])
        cv.px(ox + 29, y, glass[5] if y in (13, 14, 17, 18) else teal[4] if y == 15 else kuro[2])
        cv.px(ox + 30, y, kuro[0])
    # Internal glowing RGB AIO + GPU
    cv.px(ox + 25, 13, glass[6])
    cv.px(ox + 26, 13, teal[5])
    cv.px(ox + 25, 14, pink[4])
    cv.px(ox + 26, 14, glass[5])
    cv.hline(ox + 25, ox + 27, 17, glass[6])
    cv.px(ox + 26, 17, pink[5])
    cv.hline(ox + 24, ox + 30, 22, ink[0])

    # --- C. DEEP 3/4 DARK-SLATE DESKTOP (y=21..30, x=0..31 flush for x4 squad row!) ---
    for y in range(21, 29):
        c_desk = kaw[3] if y >= 26 else kaw[2]
        cv.hline(ox, ox + 31, y, c_desk)
        cv.hline(ox, ox + 3, y, kaw[3] if y < 27 else kaw[4])
        cv.hline(ox + 24, ox + 31, y, kaw[1])
    cv.hline(ox + 24, ox + 30, 22, ink[0])  # preserve tower base shadow

    # Squad Stitched Deskmat (x=5..22, y=22..27)
    cv.rect(ox + 5, 22, ox + 22, 27, navy[0])
    cv.hline(ox + 5, ox + 22, 22, teal[3])
    cv.hline(ox + 5, ox + 22, 27, teal[2])
    cv.vline(ox + 5, 22, 27, teal[4])
    cv.vline(ox + 22, 22, 27, teal[2])

    # RGB TKL Keyboard (x=7..15, y=23..26)
    cv.rect(ox + 7, 23, ox + 15, 26, kuro[0])
    for i, kc in enumerate([glass[6], teal[4], R["green"][4], R["yellow"][4], pink[4], R["blue"][4], glass[5]]):
        cv.px(ox + 8 + i, 24, kc)
    cv.px(ox + 8, 25, teal[5])
    cv.hline(ox + 9, ox + 12, 25, cw[4])
    cv.px(ox + 13, 25, pink[4])
    cv.px(ox + 14, 25, glass[5])

    # Wireless Mouse (x=18..20, y=24..26)
    cv.px(ox + 18, 24, cw[4])
    cv.px(ox + 19, 24, glass[6])
    cv.px(ox + 18, 25, cw[5])
    cv.px(ox + 19, 25, cw[3])
    cv.px(ox + 20, 25, kuro[0])
    cv.hline(ox + 18, ox + 19, 26, teal[4])

    # Energy Drink Can / Squad Beverage on Left (x=1..3, y=22..26)
    draw_desk_drink(cv, R, ox + 1, 22, kind=seat_idx if vary_props else 0)

    # Front Beveled Desk Edge + Kneehole Recess (y=29..34, x=0..31 flush)
    cv.hline(ox, ox + 31, 29, kaw[4])
    cv.hline(ox + 4, ox + 27, 29, teal[3])
    cv.hline(ox + 8, ox + 20, 29, glass[5])
    cv.hline(ox, ox + 31, 30, kuro[0])

    cv.hline(ox + 3, ox + 28, 31, ink[0])
    cv.hline(ox + 5, ox + 26, 32, ink[0])
    for y in range(31, 34):
        cv.px(ox, y, steel[2])
        cv.px(ox + 1, y, kuro[1])
        cv.px(ox + 2, y, kuro[0])
        cv.px(ox + 29, y, kuro[0])
        cv.px(ox + 30, y, kuro[1])
        cv.px(ox + 31, y, kuro[0])
    cv.hline(ox, ox + 2, 34, ink[0])
    cv.hline(ox + 29, ox + 31, 34, ink[0])

    # --- D. SCULPTED CYAN-TRIMMED HIGH-BACK GAMING CHAIR (y=26..46, tucked in kneehole!) ---
    draw_south_bucket_chair(cv, R, ox, 26, edition="blue")


# ---------------------------------------------------------------------------
# Save + 4x Preview + Strict Palette/Alpha Verification
# ---------------------------------------------------------------------------


def save_and_verify(
    name: str,
    cv: Canvas,
    allowed_rgb: set[RGB],
) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_1x = OUT_DIR / f"{name}.png"
    out_4x = OUT_DIR / f"{name}-x4.png"
    cv.im.save(out_1x, format="PNG")
    im_4x = cv.im.resize((cv.w * 4, cv.h * 4), resample=Image.Resampling.NEAREST)
    im_4x.save(out_4x, format="PNG")

    rep = verify_sprite(out_1x, allowed_rgb, forbid_pure_black=True)
    status = "PASS" if rep.ok else "FAIL"
    print(
        f"[{status}] {out_1x.name:24s} {rep.width:3d}x{rep.height:<3d} "
        f"opaque={rep.opaque_pixels:5d} colors={rep.unique_colors:2d} "
        f"pv={rep.palette_violations} av={rep.alpha_violations} "
        f"pure_black={rep.pure_black_pixels} sha={rep.pixel_sha256[:12]}"
    )
    if not rep.ok:
        raise RuntimeError(f"Verification failed for {out_1x}: {rep.errors}")


def main() -> int:
    ramps = load_ramps(PALETTE_PATH)
    allowed_rgb = load_palette(PALETTE_PATH)

    # 1. Base: pcb3-b2b-blue-1 (32x64)
    c_blue1 = Canvas(32, 64)
    render_b2b_blue_pod(c_blue1, ramps, 0, seat_idx=0, vary_props=False)
    save_and_verify("pcb3-b2b-blue-1", c_blue1, allowed_rgb)

    # 2. Base: pcb3-b2b-red-1 (32x64)
    c_red1 = Canvas(32, 64)
    render_b2b_red_pod(c_red1, ramps, 0, seat_idx=0, vary_props=False)
    save_and_verify("pcb3-b2b-red-1", c_red1, allowed_rgb)

    # 3. Base: pcb3-team-desk-1 (32x48)
    c_team1 = Canvas(32, 48)
    render_team_desk_pod(c_team1, ramps, 0, seat_idx=0, vary_props=False)
    save_and_verify("pcb3-team-desk-1", c_team1, allowed_rgb)

    # 4. Composite: pcb3-b2b-blue-4 (128x64)
    c_blue4 = Canvas(128, 64)
    for i in range(4):
        render_b2b_blue_pod(c_blue4, ramps, i * 32, seat_idx=i, vary_props=True)
    save_and_verify("pcb3-b2b-blue-4", c_blue4, allowed_rgb)

    # 5. Composite: pcb3-b2b-blue-5 (160x64)
    c_blue5 = Canvas(160, 64)
    for i in range(5):
        render_b2b_blue_pod(c_blue5, ramps, i * 32, seat_idx=i, vary_props=True)
    save_and_verify("pcb3-b2b-blue-5", c_blue5, allowed_rgb)

    # 6. Composite: pcb3-b2b-red-4 (128x64)
    c_red4 = Canvas(128, 64)
    for i in range(4):
        render_b2b_red_pod(c_red4, ramps, i * 32, seat_idx=i, vary_props=True)
    save_and_verify("pcb3-b2b-red-4", c_red4, allowed_rgb)

    # 7. Composite: pcb3-team-row-4 (128x48)
    c_team4 = Canvas(128, 48)
    for i in range(4):
        render_team_desk_pod(c_team4, ramps, i * 32, seat_idx=i, vary_props=True)
    save_and_verify("pcb3-team-row-4", c_team4, allowed_rgb)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
