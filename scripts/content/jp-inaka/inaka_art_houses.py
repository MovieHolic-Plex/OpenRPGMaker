#!/usr/bin/env python3
# noqa: SIZE_OK — self-contained 3/4 rural architecture pixel-art primitives and kits 1..10 for jp-inaka
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow"]
# ///
# ─── How to run ───
# python3 scripts/content/jp-inaka/bake_inaka.py
"""Japanese Countryside (jp-inaka) 3/4 top-view pixel-art primitives and kits 1..10."""
from __future__ import annotations

import json
import math
import os
import sys
from typing import Final

HERE: Final[str] = os.path.dirname(os.path.abspath(__file__))
ROOT: Final[str] = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
JP_CITY_DIR: Final[str] = os.path.join(ROOT, 'scripts', 'content', 'jp-city')
for _p in (os.path.join(JP_CITY_DIR, 'houses'), os.path.join(JP_CITY_DIR, 'blocks'), JP_CITY_DIR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from house_kit import Cv, K, OL  # noqa: E402
from shitamachi_pack import H, disc, line  # noqa: E402

with open(os.path.join(ROOT, 'tiledata', 'jp-city', 'palette-contract.json'), encoding='utf-8') as _f:
    _CONTRACT = json.load(_f)
_RAMP: Final[dict[str, list[int]]] = {
    m['id']: [int(h[1:], 16) for h in m['steps']]
    for f in _CONTRACT['families']
    for m in f['materials']
}
SUMI1: Final[int] = K('sumi', 1)
SUMI0: Final[int] = K('sumi', 0)


def J(mat: str, s: int) -> int:
    """Return 24-bit RGB integer for material `mat` at step `s` (0..4)."""
    r = _RAMP[mat]
    return r[max(0, min(4, s))]


def add_outline(c: Cv, x0: int = 0, y0: int = 0, x1: int | None = None, y1: int | None = None, skip_bottom: bool = False) -> None:
    """Wrap opaque pixels in region with a 1px dark sumi contour (OL)."""
    ex1 = c.w if x1 is None else x1
    ey1 = c.h if y1 is None else y1
    al = c.a[y0:ey1, x0:ex1, 3] > 0
    h, w = al.shape
    for j in range(h):
        for i in range(w):
            if al[j, i]:
                continue
            if skip_bottom and j == h - 1:
                continue
            nb = False
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nj, ni = j + dy, i + dx
                if 0 <= nj < h and 0 <= ni < w and al[nj, ni]:
                    nb = True
                    break
            if nb:
                c.P(x0 + i, y0 + j, OL)


def rect_3d(c: Cv, x: int, y: int, w: int, h: int, top_h: int, mat: str, top_t: int = 3, front_t: int = 2) -> None:
    """Draw a 3/4 box showing both its top face (`top_h` px) and front elevation (`h - top_h` px) with 1px OL."""
    c.R(x, y, w, h, OL)
    if top_h > 0:
        c.R(x + 1, y + 1, w - 2, top_h, J(mat, top_t))
        c.HL(x + 1, y + 1, w - 2, J(mat, min(4, top_t + 1)))
        c.HL(x + 1, y + top_h, w - 2, J(mat, max(0, top_t - 1)))
    fy = y + 1 + top_h
    fh = h - 2 - top_h
    if fh > 0:
        c.R(x + 1, fy, w - 2, fh, J(mat, front_t))
        c.VL(x + 1, fy, fh, J(mat, min(4, front_t + 1)))
        c.VL(x + w - 2, fy, fh, J(mat, max(0, front_t - 1)))
        c.HL(x + 1, y + h - 2, w - 2, J(mat, max(0, front_t - 2)))


def plinth_34(c: Cv, x: int, y: int, w: int, h: int = 9, top_h: int = 3, mat: str = 'shrine_flagstone') -> None:
    """Draw a 3/4 stone foundation plinth with top slab surface, front masonry joints, and dark ground contact."""
    c.R(x, y, w, h, OL)
    c.R(x + 1, y + 1, w - 2, top_h, J(mat, 3))
    c.HL(x + 1, y + 1, w - 2, J(mat, 4))
    for sx in range(x + 9, x + w - 4, 11):
        c.VL(sx, y + 1, top_h, J(mat, 2))
    fy = y + 1 + top_h
    fh = h - 2 - top_h
    if fh > 0:
        c.R(x + 1, fy, w - 2, fh, J(mat, 2))
        c.VL(x + 1, fy, fh, J(mat, 3))
        c.VL(x + w - 2, fy, fh, J(mat, 1))
        c.HL(x + 1, y + h - 2, w - 2, J(mat, 0))
        for sx in range(x + 7, x + w - 4, 11):
            c.VL(sx, fy, fh, J(mat, 1))


def engawa_34(c: Cv, x: int, y: int, w: int, h: int = 9, top_h: int = 5) -> None:
    """Draw a 3/4 open wooden veranda (engawa) with floorboards on top, front beam, support posts, and step stone."""
    c.R(x, y, w, h, OL)
    c.R(x + 1, y + 1, w - 2, top_h, J('aged_cedar', 3))
    c.HL(x + 1, y + 1, w - 2, J('aged_cedar', 4))
    for px in range(x + 4, x + w - 2, 4):
        c.VL(px, y + 1, top_h, J('aged_cedar', 2))
    c.HL(x + 1, y + top_h, w - 2, J('aged_cedar', 4))
    fy = y + 1 + top_h
    fh = h - 2 - top_h
    if fh > 0:
        c.R(x + 1, fy, w - 2, fh, J('machiya_timber', 1))
        c.HL(x + 1, fy, w - 2, J('aged_cedar', 2))
        for px in range(x + 4, x + w - 3, 14):
            c.R(px, fy, 3, fh, J('machiya_timber', 3))
    # Kutsunugi-ishi stepping stone in front
    sx = x + w // 2 - 5
    c.R(sx, y + h - 3, 10, 3, OL)
    c.R(sx + 1, y + h - 2, 8, 1, J('shrine_flagstone', 3))


def shoji_panel(c: Cv, x: int, y: int, w: int, h: int, open_w: int = 0) -> None:
    """Draw wooden-framed paper shoji sliding doors, optionally half-open revealing tatami room inside."""
    c.R(x, y, w, h, OL)
    c.R(x + 1, y + 1, w - 2, h - 2, J('cream_stucco', 4))
    # Wood frame border and muntin grid
    for gx in range(x + 4, x + w - 2, 4):
        c.VL(gx, y + 1, h - 2, J('aged_cedar', 2))
    for gy in range(y + 4, y + h - 4, 4):
        c.HL(x + 1, gy, w - 2, J('aged_cedar', 2))
    # Lower wooden kickboard (koshita)
    c.R(x + 1, y + h - 5, w - 2, 4, J('aged_cedar', 2))
    c.HL(x + 1, y + h - 5, w - 2, J('aged_cedar', 3))
    if open_w > 0:
        ox = x + w // 2 - open_w // 2
        c.R(ox, y + 1, open_w, h - 2, J('machiya_timber', 0))
        c.R(ox + 1, y + h - 6, open_w - 2, 5, J('tatami_straw', 2))
        c.HL(ox + 1, y + h - 6, open_w - 2, J('tatami_straw', 3))


def thatch_roof_34(c: Cv, x0: int, x1: int, y0: int, y1: int) -> None:
    """Draw a thick, multi-layered 3/4 kayabuki thatched roof with timber ridge ties, smoke vent, and deep eaves."""
    hgt = y1 - y0
    taper = max(6, int(hgt * 0.36))
    # Main sloped thatch body
    for j in range(5, hgt - 4):
        y = y0 + j
        f = (j - 5) / max(1, hgt - 9)
        ins = max(0, round((1.0 - f) * taper))
        xs, xe = x0 + ins, x1 - ins
        c.P(xs - 1, y, OL)
        c.P(xe, y, OL)
        for x in range(xs, xe):
            # Layered reed bundle texture + top-left sun lighting
            side_bias = 1 if (x - xs) < (xe - xs) * 0.38 else (-1 if (x - xs) > (xe - xs) * 0.78 else 0)
            step_band = (j // 5) % 2
            reed = ((x * 3 + j * 7) % 11 == 0)
            lv = (3 if f < 0.45 else 2) + side_bias
            if j % 5 == 4:
                lv -= 1
            elif j % 5 == 0 and (x + step_band * 2) % 3 != 0:
                lv += 1
            if reed:
                c.P(x, y, J('aged_cedar', max(1, min(3, lv))))
            else:
                c.P(x, y, J('tatami_straw', max(0, min(4, lv))))
        # Gable triangular recessed dark timber vents on upper left/right hips
        if 8 <= j <= 18 and xe - xs > 24:
            c.P(xs + 2, y, J('machiya_timber', 1))
            c.P(xe - 3, y, J('machiya_timber', 0))
    # Thick stepped thatch eave cut-face (3/4 underside thickness: bright reed lip + brown cut layer + deep shadow)
    ew = x1 - x0
    c.HL(x0, y1 - 4, ew, J('tatami_straw', 3))
    c.HL(x0, y1 - 3, ew, J('aged_cedar', 2))
    c.HL(x0, y1 - 2, ew, J('machiya_timber', 0))
    c.HL(x0, y1 - 1, ew, OL)
    c.VL(x0 - 1, y1 - 4, 4, OL)
    c.VL(x1, y1 - 4, 4, OL)
    # Heavy bamboo & cedar ridge beam (구시/오사에보코) with X-crossed katsuogi ties
    rx0, rx1 = x0 + taper - 2, x1 - taper + 2
    rw = max(8, rx1 - rx0)
    c.R(rx0 - 1, y0, rw + 2, 6, OL)
    c.HL(rx0, y0 + 1, rw, J('tatami_straw', 4))
    c.HL(rx0, y0 + 2, rw, J('aged_cedar', 3))
    c.HL(rx0, y0 + 3, rw, J('machiya_timber', 2))
    c.HL(rx0, y0 + 4, rw, J('machiya_timber', 0))
    for kx in range(rx0 + 4, rx1 - 3, 7):
        c.R(kx, y0 - 1, 3, 6, OL)
        c.VL(kx + 1, y0, 5, J('tatami_straw', 4))
    # Small center smoke-vent gable (kemuridashi)
    mx = (rx0 + rx1) // 2 - 5
    c.R(mx, y0 + 4, 10, 6, OL)
    c.R(mx + 1, y0 + 5, 8, 2, J('aged_cedar', 3))
    c.R(mx + 2, y0 + 7, 6, 2, J('machiya_timber', 0))


def kawara_roof_34(c: Cv, x0: int, x1: int, y0: int, y1: int, flare: int = 3, mat: str = 'kawara_dark_tile', blue_glaze: bool = False) -> None:
    """Draw a 3/4 traditional ceramic tile roof with ridge course, tile ribs, and eave drip line."""
    hgt = y1 - y0
    taper = max(3, int(hgt * 0.38))
    for j in range(3, hgt - 2):
        y = y0 + j
        f = (j - 3) / max(1, hgt - 6)
        ins = max(0, round((1.0 - f) * taper))
        fl = max(0, j - (hgt - 3 - flare))
        xs, xe = x0 + ins - fl, x1 - ins + fl
        c.P(xs - 1, y, OL)
        c.P(xe, y, OL)
        for x in range(xs, xe):
            k = (x - xs) % 3
            base_t = 3 if f < 0.48 else 2
            tt = base_t + (1 if k == 0 else (-1 if k == 2 else 0))
            if j % 4 == 3:
                tt -= 1
            if x - xs < 2:
                tt = min(4, tt + 1)
            elif xe - x <= 2:
                tt = max(0, tt - 1)
            if blue_glaze and k == 0 and j % 4 < 2:
                c.P(x, y, J('noren_indigo', max(1, min(3, tt))))
            else:
                c.P(x, y, J(mat, tt))
    rx0, rx1 = x0 + taper - 1, x1 - taper + 1
    rw = max(4, rx1 - rx0)
    c.HL(rx0, y0, rw, OL)
    c.HL(rx0, y0 + 1, rw, J('vending_cool_white', 2) if blue_glaze else J(mat, 4))
    c.HL(rx0, y0 + 2, rw, J(mat, 2))
    c.HL(rx0, y0 + 3, rw, J(mat, 0))
    c.VL(rx0 - 1, y0, 4, OL)
    c.VL(rx1, y0, 4, OL)
    # Onigawara ridge end caps
    for ox in (rx0, rx1 - 2):
        c.R(ox, y0 - 1, 2, 3, J(mat, 4))
    ex0, ex1 = x0 - flare, x1 + flare
    ew = ex1 - ex0
    c.HL(ex0, y1 - 3, ew, J(mat, 3))
    for x in range(ex0 + 1, ex1 - 1, 3):
        c.P(x, y1 - 3, J('vending_cool_white', 2) if blue_glaze else J(mat, 4))
    c.HL(ex0, y1 - 2, ew, J(mat, 1))
    c.HL(ex0, y1 - 1, ew, OL)
    c.VL(ex0 - 1, y1 - 3, 3, OL)
    c.VL(ex1, y1 - 3, 3, OL)


def corrugated_roof_34(c: Cv, x0: int, y0: int, w: int, h: int, mat: str = 'arcade_skylight_slate', rust_ratio: float = 0.22) -> None:
    """Draw a 3/4 pitched corrugated sheet-metal roof with visible ridge, seam ribs, and rust patches."""
    taper = max(2, h // 4)
    for j in range(3, h - 2):
        y = y0 + j
        ins = max(0, round((1.0 - (j - 3) / max(1, h - 6)) * taper))
        xs, xe = x0 + ins, x0 + w - ins
        c.P(xs - 1, y, OL)
        c.P(xe, y, OL)
        for x in range(xs, xe):
            k = (x - x0) % 3
            tt = 3 if j < h // 2 else 2
            if k == 0:
                tt = min(4, tt + 1)
            elif k == 2:
                tt = max(0, tt - 1)
            is_rust = H(x // 3, j // 3, 41) < rust_ratio
            c.P(x, y, J('noren_rust' if is_rust else mat, tt))
    rx0, rx1 = x0 + taper, x0 + w - taper
    c.HL(rx0 - 1, y0, rx1 - rx0 + 2, OL)
    c.HL(rx0, y0 + 1, rx1 - rx0, J(mat, 4))
    c.HL(rx0, y0 + 2, rx1 - rx0, J('noren_rust' if rust_ratio > 0.1 else mat, 2))
    c.VL(rx0 - 1, y0 + 1, 2, OL)
    c.VL(rx1, y0 + 1, 2, OL)
    c.HL(x0, y0 + h - 2, w, J(mat, 3))
    c.HL(x0, y0 + h - 1, w, OL)
    c.VL(x0 - 1, y0 + h - 2, 2, OL)
    c.VL(x0 + w, y0 + h - 2, 2, OL)


def boards_wall(c: Cv, x0: int, y0: int, w: int, h: int, mat: str = 'aged_cedar', t: int = 2, bw: int = 4) -> None:
    """Draw vertical weathered timber boards with plank seams and under-eave shadow."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            k = (x - x0) % bw
            lv = t + (1 if k == 0 else (-1 if k == bw - 1 else 0))
            if y <= y0 + 1:
                lv = max(0, lv - 1)
            elif (y - y0) % 9 == 0:
                lv = max(0, lv - 1)
            c.P(x, y, J(mat, lv))
    c.VL(x0 - 1, y0, h, OL)
    c.VL(x0 + w, y0, h, OL)


def plaster_wall(c: Cv, x0: int, y0: int, w: int, h: int, seed: int = 0) -> None:
    """Draw traditional white/cream lime plaster wall with subtle texture and top eave shadow."""
    c.HL(x0, y0, w, J('cream_stucco', 1))
    for y in range(y0 + 1, y0 + h):
        for x in range(x0, x0 + w):
            lv = 3 + (1 if x <= x0 + 2 else 0) - (1 if x >= x0 + w - 2 else 0) - (1 if H(x // 2, y // 2, seed) > 0.9 else 0)
            c.P(x, y, J('cream_stucco', lv))
    c.VL(x0 - 1, y0, h, OL)
    c.VL(x0 + w, y0, h, OL)


def canopy_clusters(c: Cv, blobs: list[tuple[float, float, float, float]], mat: str) -> None:
    """Draw 5-step clustered foliage blobs with top-left light and 1px sumi outline."""
    t = Cv(c.w, c.h)
    for bx, by, rx, ry in blobs:
        disc(t, bx + 1.4, by + 1.8, rx, J(mat, 0), ry=ry)
    for bx, by, rx, ry in blobs:
        disc(t, bx, by, rx, J(mat, 1), ry=ry)
    for bx, by, rx, ry in blobs:
        disc(t, bx - 0.7, by - 0.7, max(1.8, rx - 1.3), J(mat, 2), ry=max(1.8, ry - 1.1))
    for bx, by, rx, ry in blobs:
        disc(t, bx - rx * 0.22 - 0.7, by - ry * 0.22 - 0.7, max(1.5, rx * 0.6), J(mat, 3), ry=max(1.5, ry * 0.6))
    for bx, by, rx, ry in blobs:
        disc(t, bx - rx * 0.34 - 0.9, by - ry * 0.34 - 0.9, max(1.1, rx * 0.32), J(mat, 4), ry=max(1.1, ry * 0.32))
    add_outline(t)
    for y in range(c.h):
        for x in range(c.w):
            if t.a[y, x, 3]:
                c.P(x, y, (int(t.a[y, x, 0]) << 16) | (int(t.a[y, x, 1]) << 8) | int(t.a[y, x, 2]))


KITS: list[dict] = []


def kit(
    id_: str,
    name: str,
    w: int,
    h: int,
    kind: str,
    solid: list[tuple[int, int]] | tuple[tuple[int, int], ...] = (),
    other: str = 'star',
    tags: list[str] | tuple[str, ...] = (),
    rules: str = '',
    role: str = 'prop',
    doors: list[tuple[int, int, int]] | None = None,
):
    """Register an inaka kit definition."""
    def deco(fn):
        KITS.append(
            dict(
                id=id_,
                name=name,
                w=w,
                h=h,
                kind=kind,
                draw=fn,
                solid=set(solid),
                other=other,
                tags=list(tags),
                rules=rules,
                role=role,
                doors=list(doors or []),
            )
        )
        return fn
    return deco


def rows(w: int, ys: list[int] | range) -> list[tuple[int, int]]:
    """Return all `(x, y)` cell coordinates for width `w` across rows `ys`."""
    return [(x, y) for y in ys for x in range(w)]


# ─────────────────────────── 1. inaka-kominka-thatched (6×5) ───────────────────────────
@kit(
    'inaka-kominka-thatched',
    '초가 고민가(茅葺き古民家) — 두꺼운 이엉 지붕·툇마루(수박 쟁반·모기향 돼지)·장지문(6×5)',
    6, 5, 'building',
    solid=rows(6, [3, 4]),
    tags=['inaka', '고민가', '초가집', '툇마루', '여름방학', '농가'],
    rules='시골 마을 흙길·자갈 마당 북쪽에 세운다. 남쪽 툇마루·현관 앞 한 줄은 걸을 수 있는 마당이어야 한다.',
    role='building',
    doors=[(1, 4, 1)],
)
def draw_kominka_thatched(c: Cv, base: Cv) -> None:
    """Draw 6x5 thatched-roof kominka farmhouse with engawa veranda, watermelon tray, and kayaributa."""
    # 1. Stone foundation plinth across bottom (y=70..79)
    plinth_34(c, 3, 70, 90, 9, top_h=3, mat='shrine_flagstone')
    # 2. Front wall & timber frame (y=44..71)
    c.R(5, 44, 86, 27, OL)
    plaster_wall(c, 6, 44, 84, 26, seed=1)
    boards_wall(c, 6, 56, 84, 14, mat='aged_cedar', t=2, bw=4)
    # Dark timber structural pillars
    for px in (6, 26, 54, 74, 87):
        c.R(px, 44, 3, 27, J('machiya_timber', 1))
        c.VL(px, 44, 27, J('machiya_timber', 3))
    # 3. Left genkan entrance with traditional dark lattice sliding door (x=10..25, y=47..71)
    c.R(10, 47, 15, 24, OL)
    c.R(11, 48, 13, 22, J('machiya_timber', 2))
    for gx in range(13, 23, 3):
        c.VL(gx, 48, 22, J('aged_cedar', 3))
    for gy in range(52, 68, 5):
        c.HL(11, gy, 13, J('aged_cedar', 2))
    # Warm lantern beside genkan
    c.R(7, 49, 3, 5, OL)
    c.R(8, 50, 1, 3, J('lantern_amber', 4))
    # 4. Wide shoji sliding doors along engawa (x=29..73, y=46..65), half-open in middle showing tatami & low chabudai
    shoji_panel(c, 29, 46, 44, 20, open_w=14)
    # Right wooden shutter storage box (tobukuro) + window
    boards_wall(c, 77, 47, 9, 20, mat='machiya_timber', t=2, bw=3)
    # 5. Open wooden engawa veranda on south front (x=27..86, y=64..74)
    engawa_34(c, 27, 64, 59, 9, top_h=4)
    # Watermelon slice on round lacquer tray on engawa (x=42..50, y=63..68)
    disc(c, 46, 66, 4.0, OL, ry=2.2)
    disc(c, 46, 66, 3.0, J('machiya_timber', 2), ry=1.5)
    c.R(44, 64, 5, 2, J('torii_vermilion', 3))
    c.P(45, 63, J('torii_vermilion', 4))
    c.HL(44, 66, 5, J('pine_bamboo', 3))
    # White ceramic mosquito-coil pig (kayaributa) with wisp of smoke (x=62..68, y=62..68)
    c.R(62, 63, 6, 5, OL)
    c.R(63, 64, 4, 3, J('vending_cool_white', 3))
    c.P(64, 64, J('vending_cool_white', 4))
    c.P(63, 65, J('machiya_timber', 1))
    c.P(64, 61, J('vending_cool_white', 3))
    c.P(65, 59, J('vending_cool_white', 4))
    # 6. Massive 3/4 kayabuki thatched roof (y=2..45)
    thatch_roof_34(c, 2, 94, 2, 45)


# ─────────────────────────── 2. inaka-kawara-farmhouse (6×5) ───────────────────────────
@kit(
    'inaka-kawara-farmhouse',
    '시골 기와 농가 — 이부시·청기와 지붕·박공 회벽·툇마루 풍경(風鈴)·장작더미(6×5)',
    6, 5, 'building',
    solid=rows(6, [3, 4]),
    tags=['inaka', '기와집', '농가', '툇마루', '풍경', '여름'],
    rules='시골 마을 골목이나 농가 마당 북쪽에 세운다. 현관과 툇마루 앞은 비워 둔다.',
    role='building',
    doors=[(1, 4, 1)],
)
def draw_kawara_farmhouse(c: Cv, base: Cv) -> None:
    """Draw 6x5 rural kawara-tile farmhouse with white gable, engawa, glass furin wind chime, and firewood stack."""
    plinth_34(c, 3, 70, 90, 9, top_h=3, mat='shrine_flagstone')
    c.R(5, 40, 86, 31, OL)
    plaster_wall(c, 6, 40, 84, 14, seed=2)
    boards_wall(c, 6, 54, 84, 16, mat='aged_cedar', t=2, bw=4)
    for px in (6, 27, 56, 78, 88):
        c.R(px, 40, 3, 30, J('machiya_timber', 1))
    # Main upper irimoya kawara roof (y=3..32) + decorative white plaster gable on left-center
    kawara_roof_34(c, 4, 92, 3, 32, flare=4, mat='kawara_dark_tile', blue_glaze=True)
    # White plaster triangular gable (chidorihafu) over genkan (x=10..32, y=14..32)
    for j in range(14):
        hw = j + 2
        gx0, gx1 = 21 - hw, 21 + hw
        c.HL(gx0 - 1, 17 + j, hw * 2 + 2, OL)
        c.HL(gx0, 17 + j, hw * 2, J('cream_stucco', 4 if j > 4 else 3))
        c.P(gx0, 17 + j, J('kawara_dark_tile', 3))
        c.P(gx1 - 1, 17 + j, J('kawara_dark_tile', 1))
    c.R(19, 23, 4, 5, J('machiya_timber', 1))
    # Lower shimoya porch eave roof (y=35..43)
    kawara_roof_34(c, 3, 93, 34, 43, flare=2, mat='kawara_dark_tile', blue_glaze=True)
    # Genkan sliding lattice door on left (x=10..25, y=45..70)
    c.R(10, 45, 16, 25, OL)
    c.R(11, 46, 14, 23, J('machiya_timber', 2))
    for gx in range(13, 24, 3):
        c.VL(gx, 46, 23, J('aged_cedar', 3))
    c.R(12, 47, 12, 5, J('noren_indigo', 2))
    c.HL(13, 49, 10, J('vending_cool_white', 4))
    # Wide shoji + glass doors along engawa (x=30..75, y=45..64)
    shoji_panel(c, 30, 45, 45, 19, open_w=12)
    engawa_34(c, 28, 63, 50, 10, top_h=4)
    # Hanging glass wind chime (furin) under eave at x=54, y=43..50
    c.VL(54, 43, 2, OL)
    disc(c, 54, 46, 2.0, OL)
    disc(c, 54, 46, 1.3, J('arcade_skylight_slate', 4))
    c.R(54, 48, 2, 4, J('vending_cool_white', 4))
    c.P(54, 50, J('torii_vermilion', 3))
    # Side firewood stack & folded blue tarp under right eave (x=78..91, y=56..72)
    rect_3d(c, 78, 56, 13, 15, 4, 'noren_indigo', top_t=3, front_t=2)
    for ly in range(62, 70, 3):
        for lx in range(79, 90, 3):
            c.R(lx, ly, 2, 2, J('aged_cedar', 3))
            c.P(lx + 1, ly + 1, J('machiya_timber', 1))


# ─────────────────────────── 3. inaka-kura-storehouse (4×4) ───────────────────────────
@kit(
    'inaka-kura-storehouse',
    '시골 토장 창고(土蔵) — 흰 회벽·해삼벽(なまこ壁)·철장 쌍여닫이문(4×4)',
    4, 4, 'building',
    solid=rows(4, [2, 3]),
    tags=['inaka', '토장', '창고', '해삼벽', '농가'],
    rules='고민가·기와 농가 옆 마당에 부속 창고로 세운다.',
    role='building',
    doors=[(1, 3, 2)],
)
def draw_kura_storehouse(c: Cv, base: Cv) -> None:
    """Draw 4x4 white-plaster & namako-kabe rural storehouse with heavy tiled roof and iron-strapped doors."""
    plinth_34(c, 4, 54, 56, 9, top_h=3, mat='shrine_flagstone')
    # Heavy 3/4 kawara roof (y=2..24)
    kawara_roof_34(c, 3, 61, 2, 24, flare=3, mat='kawara_dark_tile')
    # Upper white lime plaster wall (y=24..38)
    c.R(6, 24, 52, 31, OL)
    plaster_wall(c, 7, 24, 50, 15, seed=5)
    # Two small barred kura windows on upper wall
    for wx in (13, 43):
        c.R(wx, 27, 8, 7, OL)
        c.R(wx + 1, 28, 6, 5, J('kawara_dark_tile', 0))
        c.VL(wx + 3, 28, 5, J('aged_cedar', 3))
        c.VL(wx + 5, 28, 5, J('aged_cedar', 3))
        c.HL(wx, 34, 8, J('cream_stucco', 4))
    # Lower namako-kabe wall (diagonal white mortar grid over dark slate tiles, y=39..54)
    c.HL(7, 38, 50, J('kawara_dark_tile', 2))
    for y in range(39, 54):
        for x in range(7, 57):
            dx, dy = (x - 7) % 6, (y - 39) % 6
            is_joint = (dx + dy == 5) or (dx == dy)
            c.P(x, y, J('cream_stucco', 4) if is_joint else J('kawara_dark_tile', 1 if (x + y) % 2 == 0 else 2))
    # Heavy iron-strapped double doors in center (x=23..41, y=35..55)
    c.R(22, 34, 20, 21, OL)
    c.R(23, 35, 18, 20, J('kawara_dark_tile', 1))
    c.VL(32, 35, 20, OL)
    c.HL(23, 35, 18, J('cream_stucco', 4))
    for sy in (38, 43, 48, 52):
        c.HL(24, sy, 7, J('kawara_dark_tile', 3))
        c.HL(33, sy, 7, J('kawara_dark_tile', 3))
    c.R(29, 44, 2, 3, J('lantern_amber', 3))
    c.R(33, 44, 2, 3, J('lantern_amber', 3))
    # Stone front steps
    rect_3d(c, 22, 55, 20, 8, 3, 'shrine_flagstone', top_t=4, front_t=2)


# ─────────────────────────── 4. inaka-dagashiya (5×4) ───────────────────────────
@kit(
    'inaka-dagashiya',
    '시골 막과자 가게(駄菓子屋) — 홍백 함석 차양·유리 과자병 진열대·가챠 캡슐기·아이스크림 냉동고(5×4)',
    5, 4, 'building',
    solid=rows(5, [2, 3]),
    tags=['inaka', '다가시야', '막과자', '구멍가게', '상점', '여름방학'],
    rules='시골 삼거리나 버스 정류장 근처 길가에 세운다.',
    role='building',
    doors=[(2, 3, 1)],
)
def draw_dagashiya(c: Cv, base: Cv) -> None:
    """Draw 5x4 nostalgic country dagashiya candy shop with striped awning, candy jars, gacha, and ice cream chest."""
    plinth_34(c, 2, 54, 76, 9, top_h=3, mat='paving_stone')
    # Upper weathered wooden hip roof (y=2..20)
    kawara_roof_34(c, 4, 76, 2, 20, flare=2, mat='kawara_dark_tile')
    # Wooden clapboard upper fascia + retro round tin sign on left (no readable text)
    boards_wall(c, 5, 20, 70, 7, mat='aged_cedar', t=2, bw=4)
    disc(c, 13, 23, 4.0, OL)
    disc(c, 13, 23, 3.0, J('torii_vermilion', 3))
    c.HL(11, 23, 5, J('vending_cool_white', 4))
    # 3/4 Striped weathered corrugated tin awning (red-rust & cream stripes, y=26..36)
    for j in range(10):
        y = 26 + j
        c.P(3, y, OL)
        c.P(76, y, OL)
        for x in range(4, 76):
            stripe = ((x - 4) // 5) % 2 == 0
            mat = 'noren_rust' if stripe else 'cream_stucco'
            lv = (3 if stripe else 4) if j < 6 else (2 if stripe else 3)
            if j == 8:
                lv = max(0, lv - 1)
            c.P(x, y, J(mat, lv))
    c.HL(3, 26, 74, OL)
    c.HL(3, 35, 74, OL)
    # Storefront walls & open counter interior (y=36..55)
    boards_wall(c, 5, 36, 70, 19, mat='aged_cedar', t=2, bw=4)
    # Open shop interior bay (x=18..56, y=36..54)
    c.R(18, 36, 38, 19, OL)
    c.R(19, 37, 36, 10, J('machiya_timber', 0))
    # Tiered wooden counter with colorful glass candy jars (y=41..54)
    rect_3d(c, 19, 45, 26, 10, 3, 'aged_cedar', top_t=4, front_t=2)
    jar_mats = ['torii_vermilion', 'lantern_amber', 'onsen_mineral_teal', 'sakura_petal', 'pine_bamboo', 'noren_rust']
    for k, jm in enumerate(jar_mats):
        jx = 21 + k * 4
        c.R(jx, 41, 3, 5, OL)
        c.R(jx + 1, 42, 2, 3, J('vending_cool_white', 4))
        c.P(jx + 1, 43, J(jm, 3))
        c.P(jx + 2, 43, J(jm, 4))
        c.HL(jx + 1, 41, 2, J('torii_vermilion' if k % 2 == 0 else 'noren_indigo', 3))
    # Open doorway slot at x=46..55
    c.R(46, 37, 9, 18, J('machiya_timber', 0))
    c.R(47, 37, 7, 5, J('noren_rust', 3))
    c.HL(48, 39, 5, J('vending_cool_white', 4))
    # Left side: 2 stacked red/yellow gacha capsule machines (x=7..17, y=40..56)
    for gx in (7, 12):
        rect_3d(c, gx, 46, 5, 10, 2, 'torii_vermilion', top_t=3, front_t=2)
        c.R(gx, 40, 5, 7, OL)
        c.R(gx + 1, 41, 3, 5, J('vending_cool_white', 4))
        c.P(gx + 1, 43, J('lantern_amber', 4))
        c.P(gx + 2, 44, J('noren_indigo', 3))
        c.P(gx + 2, 50, J('vending_cool_white', 4))
    # Right side: blue chest ice-cream freezer (x=57..73, y=44..56)
    rect_3d(c, 57, 44, 16, 12, 4, 'noren_indigo', top_t=3, front_t=2)
    c.R(59, 45, 12, 3, J('arcade_skylight_slate', 4))
    c.VL(65, 45, 3, OL)
    c.HL(59, 50, 12, J('vending_cool_white', 4))
    # Retro wooden bench in front left (x=20..38, y=54..61)
    rect_3d(c, 20, 54, 18, 7, 3, 'aged_cedar', top_t=4, front_t=2)


# ─────────────────────────── 5. inaka-bus-stop-shelter (3×3) ───────────────────────────
@kit(
    'inaka-bus-stop-shelter',
    '시골 버스 정류장 — 낡은 목조·함석 대합실·나무 벤치·둥근 정류장 표지판·수국(3×3)',
    3, 3, 'structure',
    solid=[(0, 2), (1, 2), (2, 2)],
    tags=['inaka', '버스정류장', '대합실', '수국', '토토로감성', '시골길'],
    rules='시골 자갈길이나 삼거리 길가에 세운다.',
    role='building',
)
def draw_bus_stop_shelter(c: Cv, base: Cv) -> None:
    """Draw 3x3 weathered wooden bus shelter with tin roof, interior bench, round sign pole, and hydrangeas."""
    # Concrete base slab (y=38..46)
    plinth_34(c, 2, 38, 33, 8, top_h=3, mat='paving_stone')
    # 3/4 pitched rusted corrugated tin roof (x=2..34, y=6..19)
    corrugated_roof_34(c, 2, 6, 32, 13, mat='arcade_skylight_slate', rust_ratio=0.3)
    # Weathered cedar walls + open front waiting bay (x=3..33, y=19..39)
    c.R(3, 19, 30, 20, OL)
    boards_wall(c, 4, 19, 28, 19, mat='aged_cedar', t=2, bw=4)
    # Open interior recess
    c.R(7, 21, 22, 17, OL)
    c.R(8, 22, 20, 11, J('machiya_timber', 1))
    c.R(8, 33, 20, 4, J('aged_cedar', 2))
    # Route map & timetable board on back wall
    c.R(10, 24, 7, 6, OL)
    c.R(11, 25, 5, 4, J('vending_cool_white', 4))
    c.HL(12, 26, 3, J('noren_indigo', 3))
    c.R(19, 24, 7, 6, OL)
    c.R(20, 25, 5, 4, J('cream_stucco', 3))
    # Wooden waiting bench inside (3/4 top seat + legs)
    rect_3d(c, 9, 31, 18, 6, 2, 'aged_cedar', top_t=4, front_t=2)
    # Hydrangea bush & rusted round bus-stop pole on the right (x=34..46)
    canopy_clusters(c, [(40, 36, 5.5, 4.5), (43, 39, 4.5, 4.0)], 'pine_bamboo')
    for hx, hy, hm in ((38, 34, 'noren_indigo'), (42, 35, 'arcade_skylight_slate'), (40, 38, 'sakura_petal'), (44, 38, 'noren_indigo')):
        disc(c, hx, hy, 1.8, J(hm, 3))
        c.P(hx - 1, hy - 1, J(hm, 4))
    # Round bus-stop sign pole (x=36..43, y=8..44)
    rect_3d(c, 37, 39, 6, 6, 2, 'concrete_grey', top_t=3, front_t=2)
    c.R(39, 16, 3, 24, OL)
    c.VL(40, 16, 24, J('vending_cool_white', 3))
    # Timetable plate on pole
    c.R(37, 23, 7, 6, OL)
    c.R(38, 24, 5, 4, J('vending_cool_white', 4))
    c.HL(38, 25, 5, J('torii_vermilion', 3))
    # Round head disc
    disc(c, 40, 12, 4.5, OL)
    disc(c, 40, 12, 3.4, J('vending_cool_white', 4))
    c.R(38, 11, 5, 3, J('noren_indigo', 3))
    c.HL(38, 10, 5, J('torii_vermilion', 3))


# ─────────────────────────── 6. inaka-unmanned-veg-stand (2×2) ───────────────────────────
@kit(
    'inaka-unmanned-veg-stand',
    '무인 채소 판매대(無人販売所) — 나무 지붕·토마토·오이·가지·수박 상자·양철 요금통(2×2)',
    2, 2, 'structure',
    solid=[(0, 1), (1, 1)],
    tags=['inaka', '무인판매대', '채소가판대', '수박', '토마토', '시골길'],
    rules='시골 흙길·자갈길 옆이나 농가 담장 앞에 둔다.',
    role='prop',
)
def draw_unmanned_veg_stand(c: Cv, base: Cv) -> None:
    """Draw 2x2 unmanned roadside vegetable stand with rooflet, produce crates, watermelon, and coin box."""
    # Ground shadow & support legs (y=14..30)
    c.R(3, 28, 26, 3, OL)
    for lx in (5, 25):
        c.R(lx, 12, 3, 18, OL)
        c.VL(lx + 1, 12, 17, J('aged_cedar', 3))
    # 3/4 Wooden shingle rooflet (x=2..30, y=2..13)
    corrugated_roof_34(c, 2, 2, 28, 11, mat='aged_cedar', rust_ratio=0.0)
    # Hanging price plaque under eave (no readable text)
    c.R(11, 12, 10, 4, OL)
    c.R(12, 13, 8, 2, J('cream_stucco', 4))
    c.P(13, 13, J('torii_vermilion', 3))
    c.P(16, 13, OL)
    c.P(18, 13, OL)
    # Upper display shelf with 3 wooden produce crates (tomatoes, cucumbers, eggplants)
    rect_3d(c, 4, 16, 22, 8, 4, 'aged_cedar', top_t=4, front_t=2)
    # Left crate: red tomatoes
    for tx, ty in ((6, 17), (8, 17), (7, 18), (9, 18)):
        c.R(tx, ty, 2, 2, J('torii_vermilion', 3))
        c.P(tx, ty, J('torii_vermilion', 4))
    # Middle crate: green cucumbers
    for cx_ in range(12, 17):
        c.VL(cx_, 17, 3, J('pine_bamboo', 3 if cx_ % 2 == 0 else 2))
    # Right crate: dark purple eggplants
    for ex in (19, 21, 23):
        c.R(ex, 17, 2, 3, J('asphalt', 1))
        c.P(ex, 17, J('sakura_petal', 1))
    # Lower shelf + striped round summer watermelon
    rect_3d(c, 6, 24, 18, 6, 2, 'aged_cedar', top_t=3, front_t=1)
    disc(c, 13, 25, 3.0, OL)
    disc(c, 13, 25, 2.2, J('pine_bamboo', 3))
    c.VL(13, 23, 4, J('pine_bamboo', 0))
    c.P(12, 24, J('moss', 4))
    # Tin coin box on right post (x=25..30, y=18..25)
    rect_3d(c, 25, 18, 5, 7, 2, 'vending_cool_white', top_t=4, front_t=3)
    c.HL(26, 19, 3, OL)
    c.HL(26, 22, 3, J('torii_vermilion', 3))


# ─────────────────────────── 7. inaka-wooden-station (7×4) ───────────────────────────
@kit(
    'inaka-wooden-station',
    '시골 목조 간이역(木造駅舎) — 민트·크림 비늘판벽·역 시계 박공·목조 개찰구·승강장(7×4)',
    7, 4, 'building',
    solid=rows(7, [2, 3]),
    tags=['inaka', '간이역', '목조역', '기차역', '철도', '여름방학'],
    rules='단선 철길 바로 옆에 승강장과 나란히 세운다.',
    role='building',
    doors=[(3, 3, 2)],
)
def draw_wooden_station(c: Cv, base: Cv) -> None:
    """Draw 7x4 nostalgic wooden country train station with mint/cream clapboard, clock gable, and wicket gate."""
    # 1. Full-width 3/4 stone & concrete station platform apron (x=1..111, y=50..63)
    plinth_34(c, 1, 50, 110, 13, top_h=6, mat='paving_stone')
    for x in range(4, 108):
        c.P(x, 54, J('lantern_amber', 4 if x % 2 == 0 else 3))
    # 2. Main station building on left/center (x=4..82)
    # 3/4 Gabled roof (y=4..26)
    kawara_roof_34(c, 3, 83, 4, 26, flare=3, mat='noren_rust')
    # Central entrance gable dormer with round station clock (x=32..56, y=8..26)
    for j in range(15):
        hw = j + 2
        c.HL(44 - hw - 1, 10 + j, hw * 2 + 2, OL)
        c.HL(44 - hw, 10 + j, hw * 2, J('cream_stucco', 4 if j > 4 else 3))
    disc(c, 44, 18, 4.2, OL)
    disc(c, 44, 18, 3.2, J('vending_cool_white', 4))
    c.P(44, 17, OL)
    c.P(44, 18, OL)
    c.P(45, 18, OL)
    # Pale mint & cream horizontal clapboard walls (x=5..81, y=26..51)
    c.R(5, 26, 76, 25, OL)
    for y in range(27, 50):
        is_dado = y >= 42
        mat = 'onsen_mineral_teal' if is_dado else 'cream_stucco'
        base_lv = 3 if is_dado else 4
        if (y - 27) % 3 == 2:
            base_lv -= 1
        c.HL(6, y, 74, J(mat, base_lv))
    # Timber corner & window posts
    for px in (6, 28, 58, 78):
        c.VL(px, 26, 24, J('onsen_mineral_teal', 2))
    # Double-hung wooden station windows on left (x=10..25, y=30..41)
    for wx in (10, 19):
        c.R(wx, 30, 7, 11, OL)
        c.R(wx + 1, 31, 5, 9, J('arcade_skylight_slate', 2))
        c.P(wx + 1, 31, J('arcade_skylight_slate', 4))
        c.HL(wx + 1, 35, 5, J('cream_stucco', 4))
    # Open wooden wicket gate (개찰구, x=32..56, y=28..51)
    c.R(32, 28, 24, 23, OL)
    c.R(33, 29, 22, 16, J('machiya_timber', 0))
    c.R(33, 45, 22, 5, J('paving_stone', 2))
    # Wooden wicket latch posts on either side of gate passage
    for gx in (34, 42, 50):
        rect_3d(c, gx, 41, 4, 10, 3, 'aged_cedar', top_t=4, front_t=2)
    # Waiting bench on right wall (x=60..76, y=42..50) + timetable poster
    c.R(62, 30, 12, 9, OL)
    c.R(63, 31, 10, 7, J('vending_cool_white', 4))
    c.HL(64, 32, 8, J('torii_vermilion', 3))
    c.HL(64, 35, 8, J('noren_indigo', 2))
    rect_3d(c, 60, 43, 16, 8, 3, 'aged_cedar', top_t=4, front_t=2)
    # 3. Right platform: standing vintage station nameboard (駅名標, x=85..108, y=22..51)
    for px in (89, 103):
        c.R(px, 36, 3, 15, OL)
        c.VL(px + 1, 36, 14, J('aged_cedar', 3))
    rect_3d(c, 85, 22, 23, 15, 3, 'vending_cool_white', top_t=4, front_t=4)
    c.R(86, 32, 21, 3, J('noren_indigo', 2))
    c.HL(87, 33, 19, J('torii_vermilion', 3))
    for k in range(4):
        c.R(88 + k * 4, 27, 2, 3, OL)


# ─────────────────────────── 9. inaka-red-iron-bridge (6×3) ───────────────────────────
@kit(
    'inaka-red-iron-bridge',
    '시골 붉은 철교(赤い鉄교) — 리벳 워런 트러스 강철 거더·석조 교대·목조 상판(6×3)',
    6, 3, 'structure',
    solid=rows(6, [0]),
    other='floor',
    tags=['inaka', '철교', '붉은다리', '다리', '강', '개울'],
    rules='시골 개울이나 강을 가로질러 놓는다. 가운데·아랫줄 상판은 걸어 건널 수 있다.',
    role='terrain',
)
def draw_red_iron_bridge(c: Cv, base: Cv) -> None:
    """Draw 6x3 iconic red steel Warren-truss bridge with stone abutments and walkable 3/4 deck."""
    # 1. Walkable 3/4 bridge deck on `base` layer (y=18..42) so characters walk over the deck cleanly
    rect_3d(base, 0, 18, 96, 24, 16, 'paving_stone', top_t=3, front_t=1)
    for x in range(2, 94, 4):
        base.VL(x, 19, 15, J('paving_stone', 2))
    # Wooden/concrete sleeper ties & truss shadows on deck
    for x in range(8, 88, 12):
        base.R(x, 19, 3, 15, J('paving_stone', 1))
    # 2. Left & right stone masonry abutments (x=0..10 and x=86..96, y=14..47)
    for ax in (0, 86):
        plinth_34(c, ax, 14, 10, 33, top_h=6, mat='shrine_flagstone')
    # 3. Upper red steel Warren truss frame (y=2..22) on `c` (upper layer)
    # Top horizontal chord (3/4 top face + front flange)
    rect_3d(c, 6, 2, 84, 5, 2, 'torii_vermilion', top_t=4, front_t=2)
    # Bottom horizontal chord of north truss (y=17..21)
    rect_3d(c, 6, 17, 84, 4, 1, 'torii_vermilion', top_t=3, front_t=2)
    # Vertical posts & diagonal Warren truss web members
    for px in range(8, 89, 16):
        c.R(px, 6, 3, 12, OL)
        c.VL(px + 1, 6, 12, J('torii_vermilion', 3))
        if px + 16 <= 88:
            mid = px + 8
            for t in range(-1, 2):
                line(c, px + 1 + t, 6, mid + t, 17, OL if abs(t) == 1 else J('torii_vermilion', 3))
                line(c, mid + t, 17, px + 16 + t, 6, OL if abs(t) == 1 else J('torii_vermilion', 2))
            # Riveted gusset plates
            c.R(px, 6, 4, 3, J('torii_vermilion', 4))
            c.R(mid - 1, 15, 4, 3, J('torii_vermilion', 3))
    # 4. South low safety parapet rail along bottom edge of deck (y=36..44)
    rect_3d(c, 6, 36, 84, 6, 2, 'torii_vermilion', top_t=4, front_t=2)
    for px in range(10, 86, 8):
        c.R(px, 41, 2, 4, J('torii_vermilion', 1))


# ─────────────────────────── 10. inaka-stepping-stones (4×2) ───────────────────────────
@kit(
    'inaka-stepping-stones',
    '개울 징검다리(飛び石) — 납작한 자연석 디딤돌 6개·하얀 물보라 파문(4×2)',
    4, 2, 'terrain',
    solid=[],
    other='floor',
    tags=['inaka', '징검다리', '개울', '다리', '시냇물'],
    rules='시골 맑은 개울(inaka-river-shallow) 위에 놓아 개울을 건너는 징검다리를 만든다.',
    role='terrain',
)
def draw_stepping_stones(c: Cv, base: Cv) -> None:
    """Draw 4x2 natural flat river stepping stones on shallow water with white water ripples."""
    # Tile the exact _river_shallow 16x16 pattern across the 4x2 base so water edges are 100% seamless
    pebbles = [
        (2, 3, 'shrine_flagstone', 3),
        (7, 2, 'aged_cedar', 3),
        (12, 5, 'wet_cobble', 3),
        (4, 9, 'wet_cobble', 2),
        (10, 10, 'shrine_flagstone', 3),
        (13, 13, 'aged_cedar', 2),
        (2, 14, 'shrine_flagstone', 2),
    ]
    for ty in range(2):
        for tx in range(4):
            ox, oy = tx * 16, ty * 16
            for ly in range(16):
                for lx in range(16):
                    h = H(lx, ly, 67)
                    base.P(ox + lx, oy + ly, J('onsen_mineral_teal', 3 if h < 0.55 else (2 if h < 0.88 else 4)))
            for px, py, pm, pt in pebbles:
                base.P(ox + px, oy + py, J(pm, pt))
                base.P(ox + px + 1, oy + py, J(pm, max(1, pt - 1)))
            for sx, sy in ((5, 5), (6, 5), (11, 8), (12, 8), (3, 12)):
                base.P(ox + sx, oy + sy, J('vending_cool_white', 4))
    stones_pos = [(7, 15, 5.2, 3.6), (18, 19, 4.8, 3.4), (28, 14, 5.5, 3.8), (38, 18, 4.6, 3.3), (48, 14, 5.2, 3.6), (57, 17, 4.5, 3.2)]
    for sx, sy, rx, ry in stones_pos:
        # Outer white water ripple ring
        disc(base, sx, sy + 1, rx + 2.2, J('vending_cool_white', 4), ry=ry + 1.4)
        disc(base, sx, sy + 1, rx + 1.2, J('onsen_mineral_teal', 4), ry=ry + 0.7)
        # 3/4 Flat stone: dark wet side face + bright flat top face
        disc(base, sx, sy + 1, rx, OL, ry=ry)
        disc(base, sx, sy + 0.8, rx - 0.8, J('shrine_flagstone', 1), ry=ry - 0.5)
        disc(base, sx, sy - 0.6, rx - 1.0, J('shrine_flagstone', 3), ry=ry - 0.8)
        disc(base, sx - 1.0, sy - 1.2, rx * 0.55, J('shrine_flagstone', 4), ry=ry * 0.5)
        # Touch of moss on stone edge
        base.P(int(sx + rx * 0.4), int(sy - ry * 0.3), J('moss', 3))
