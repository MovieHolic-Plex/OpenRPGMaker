#!/usr/bin/env python3
"""Sheer-terrain map backgrounds: the backdrop layers of the terrain target scenes, as seamless horizon panoramas.

  uv run --with pillow --with numpy python3 scripts/content/panoramas/bake_sheer_backdrops.py [--out public/assets/panoramas]

No new drawing. The pieces are the Fable terrain pieces as drawn (tiledata/sheer-terrain/pieces/backdrop, byte-identical
to assistant-fable-runs/terrain-pilot/pieces): small/mid/near cloud strips, four mountain silhouettes, two far-forest
textures. Colours come from tiledata/sheer-terrain/ramps.json. The layout follows the target scenes' compose3.py
(cloud_backdrop for the sky plateau, summit_backdrop for the summit), re-cut to the horizon panorama format:

- 640x240 per layer (two play screens wide), drawn with `fit: cover` so it shows 1:1 on the 320x240 play screen.
- Horizontally seamless: every wave is a whole number of periods over 640 px and every stamp wraps around x.
- Deterministic: same pieces -> same bytes. Set ids and layer ids must match src/assets/oprnPanoramas.ts.

Sets
- oprn-cloud-sea:      sky band + horizon haze + far cloud rows (base) / mid clouds / near clouds.
- oprn-far-mountains:  high sky + clouds (base) / two mountain ridges (far faded, near full) / far forest with haze.
- oprn-far-forest:     same sky base / far forest band reaching higher, no mountains.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
PIECES = ROOT / "tiledata/sheer-terrain/pieces/backdrop"
RAMPS = json.loads((ROOT / "tiledata/sheer-terrain/ramps.json").read_text())["ramps"]
W, H = 640, 240
TAU = 2 * math.pi


def hexes(name: str) -> list[tuple[int, int, int]]:
    return [tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in RAMPS[name]]  # type: ignore[misc]


def P(name: str) -> np.ndarray:
    return np.array(Image.open(PIECES / f"{name}.png").convert("RGBA"))


def h01(x: int, y: int, s: int = 0) -> float:
    n = (int(x) * 374761393 + int(y) * 668265263 + s * 2147483647) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return ((n ^ (n >> 16)) & 0xffff) / 65535.0


def wave(x: int, cycles: int, phase: float = 0.0) -> float:
    """sin with a whole number of periods across the panorama width, so the left and right edges meet."""
    return math.sin(TAU * cycles * x / W + phase)


def blank() -> np.ndarray:
    return np.zeros((H, W, 4), np.uint8)


def stamp(dst: np.ndarray, img: np.ndarray, x: int, y: int) -> None:
    """Paste opaque piece pixels (alpha > 127) at (x, y), wrapping around x so the layer tiles."""
    h, w = img.shape[:2]
    for ox in (x - W, x, x + W):
        x0, x1 = max(0, ox), min(W, ox + w)
        y0, y1 = max(0, y), min(H, y + h)
        if x1 <= x0 or y1 <= y0:
            continue
        sub = img[y0 - y:y1 - y, x0 - ox:x1 - ox]
        m = sub[:, :, 3] > 127
        dst[y0:y1, x0:x1][m] = sub[m]


def spots(n: int, box: tuple[int, int, int, int], seed: int) -> list[tuple[int, int]]:
    """n spots spread evenly across the full width (one per slot, jittered) so the wrap has no gap or pile-up."""
    _, y0, _, y1 = box
    return [(int((i + h01(i, 1, seed)) * W / n), int(y0 + h01(i, 2, seed) * (y1 - y0))) for i in range(n)]


def fade(im: np.ndarray, colour: tuple[int, int, int], k: float) -> np.ndarray:
    o = im.copy()
    o[:, :, :3] = (o[:, :, :3].astype(float) * (1 - k) + np.array(colour) * k).astype(np.uint8)
    return o


# ---------- cloud sea (sky plateau) ----------
def cloud_sea() -> dict[str, np.ndarray]:
    sky, snow = hexes("sky"), hexes("snow")
    small, mid, near = P("cloud-small"), P("cloud-mid"), P("cloud-near")
    base = blank(); base[:, :, 3] = 255
    for y in range(H):
        for x in range(W):
            t = (y + 5 * wave(x, 3) + 3 * wave(x, 8, 1)) / H
            base[y, x, :3] = sky[6] if t < 0.05 else sky[5] if t < 0.13 else sky[4] if t < 0.30 else sky[3] if t < 0.56 else sky[2]
    for x in range(W):  # horizon: one pale haze band with a wavy lower edge
        e = 9 + int(3 * wave(x, 4) + 2 * wave(x, 11, 2))
        for y in range(e):
            base[y, x, :3] = snow[5] if y < e - 3 else snow[4] if y < e - 1 else sky[6]
    for band, (y0, n) in enumerate(((12, 34), (26, 26), (42, 20))):  # far cloud rows: higher rows denser and paler
        for i, (x, y) in enumerate(spots(n, (0, y0, W, y0 + 10), 11 + band)):
            im = small[:, int(h01(i, band, 3) * 8) * 20:][:, :20].copy()
            if band == 0:
                im = fade(im, sky[5], 0.5)
            stamp(base, im, x - 10, y)
    mid_l = blank()
    for i, (x, y) in enumerate(sorted(spots(24, (0, 64, W, 132), 21), key=lambda q: q[1])):
        stamp(mid_l, mid[:, (i % 4) * 40:(i % 4) * 40 + 40], x - 20, y)
    near_l = blank()
    for i, (x, y) in enumerate(sorted(spots(9, (0, 118, W, 214), 31), key=lambda q: q[1])):
        stamp(near_l, near[:, (i % 3) * 80:(i % 3) * 80 + 80], x - 40, y)
    return {"oprn-pano-cloud-sea": base, "oprn-pano-cloud-sea-mid": mid_l, "oprn-pano-cloud-sea-near": near_l}


# ---------- far mountains / far forest (summit) ----------
def high_sky() -> np.ndarray:
    sky = hexes("sky")
    mid, small = P("cloud-mid"), P("cloud-small")
    base = blank(); base[:, :, 3] = 255
    for y in range(H):
        for x in range(W):
            t = (y + 4 * wave(x, 2) + 2 * wave(x, 7)) / 110.0
            base[y, x, :3] = sky[1] if t < 0.16 else sky[2] if t < 0.36 else sky[3] if t < 0.58 else sky[4] if t < 0.80 else sky[5]
    for i, (x, y) in enumerate(spots(11, (0, 10, W, 44), 41)):
        stamp(base, mid[:, (i % 4) * 40:(i % 4) * 40 + 40], x - 20, y)
    for i, (x, y) in enumerate(spots(16, (0, 40, W, 62), 43)):
        stamp(base, small[:, (i % 8) * 20:(i % 8) * 20 + 20], x - 10, y)
    return base


def ridges() -> np.ndarray:
    sky = hexes("sky")
    mts = [P(f"mountain-{c}") for c in "abcd"]
    out = blank()
    # far ridge (faded into the sky): heights and spacing vary
    for i in range(8):
        x = int((i + 0.35 * h01(i, 1, 51)) * W / 8) - 56
        y = 40 + int(h01(i, 2, 51) * 18)
        im = mts[int(h01(i, 3, 51) * 4)]
        stamp(out, fade(im[:, ::-1] if h01(i, 4, 51) < 0.5 else im, sky[5], 0.5), x, y)
    # near ridge (full colour) hides the far one
    for i in range(9):
        x = int((i + 0.35 * h01(i, 1, 53)) * W / 9) - 56
        y = 66 + int(h01(i, 2, 53) * 14)
        im = mts[int(h01(i, 3, 53) * 4)]
        stamp(out, im[:, ::-1] if h01(i, 4, 53) < 0.5 else im, x, y)
    return out


def forest(top: int) -> np.ndarray:
    """Far forest band from `top` down: a haze rim with a wavy edge, then the two forest textures meeting on a wavy seam."""
    haze = hexes("haze")
    f1, f2 = P("far-forest"), P("far-forest-fine")
    out = blank()
    for y in range(top, H):
        for x in range(W):
            t = (y - top) / (H - top)
            edge = 0.10 + 0.04 * wave(x, 3) + 0.025 * wave(x, 9)
            if t < edge:
                out[y, x] = (*haze[1 if (y + int(3 * wave(x, 11))) % 6 < 4 else 2], 255)
            else:
                mix = 0.5 + 0.10 * wave(x, 4) + 0.06 * math.sin(TAU * 14 * x / W + y / 9.0)
                px = (f2[y % 32, (x + (y // 32) * 13) % 32] if t < mix else f1[y % 64, (x + (y // 64) * 23) % 64]).copy()
                k = max(0.0, 0.5 - t * 1.2)
                px[:3] = (px[:3] * (1 - k) + np.array(haze[1]) * k).astype(np.uint8)
                out[y, x] = px
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "public/assets/panoramas"))
    out = Path(ap.parse_args().out)
    out.mkdir(parents=True, exist_ok=True)
    layers = {**cloud_sea(), "oprn-pano-far-mountains": high_sky(), "oprn-pano-far-mountains-ridges": ridges(),
              "oprn-pano-far-mountains-forest": forest(122), "oprn-pano-far-forest-trees": forest(96)}
    for name, arr in layers.items():
        assert arr.shape == (H, W, 4)
        Image.fromarray(arr, "RGBA").save(out / f"{name}.png", optimize=True)
        print(f"wrote {out / name}.png {W}x{H}")


if __name__ == "__main__":
    main()
