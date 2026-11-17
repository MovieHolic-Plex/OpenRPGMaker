#!/usr/bin/env python3
"""Spirit-forest objects for beodeul_spirit, composed by code from drawn pieces — no new drawing, no retouching.

  uv run --with pillow --with numpy python3 scripts/content/sheer-terrain/compose_spirit.py

Inputs (as drawn, byte-identical to assistant-fable-runs/terrain-pilot/pieces/extra):
  tiledata/sheer-terrain/pieces/spirit/{big-tree-trunk,elder-tree-wood,front-trunks,spirit-flowers,spirit-mushrooms}.png (vines-pair is not used — the vine climb piece already draws it)
  Beodeul broadleaf crown kits (CROWN_IDS) rendered from public/assets/beodeul-city/beodeul-city-chipset.png.
Method (the target scene's compose3.py `tree` / `scene_t`): a trunk, then crowns stacked back to front; each crown keeps its own
pixels and only shifts brightness steps inside the crown colour line (relight), plus a sparse spirit-light speckle from ramps.json
`aura`. Variants differ by crown count, arrangement, lean and mirrored trunk.
Outputs:
  tiledata/sheer-terrain/spirit/<id>.png      one composed object per file (what the object gate hashes)
  tiledata/sheer-terrain/spirit/spec.json     cells, layer, block / under cells (bake_spirit.py reads it)
  tiledata/sheer-terrain/waive-manifest-spirit.json   the list the coordinator records as an owner waiver batch
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
PIECES = ROOT / "tiledata/sheer-terrain/pieces/spirit"
OUT = ROOT / "tiledata/sheer-terrain/spirit"
RAMPS = json.loads((ROOT / "tiledata/sheer-terrain/ramps.json").read_text())["ramps"]
TS = json.loads((ROOT / "src/assets/beodeulCityTileset.json").read_text())
SHEET = Image.open(ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png").convert("RGBA")
KITS = {k["id"]: k for k in TS["structureKits"]}
TPR = TS["tilesPerRow"]
CROWN_IDS = ["bd-tree-f4f319", "bd-tree-e9d9b3", "bd-tree-37f48b", "bd-tree-47e17a", "bd-tree-d105b2", "bd-tree-0f7ed1",
             "bd-tree-cc0fcb", "bd-tree-132848", "bd-tree-03a8f7", "bd-tree-3e8732", "bd-tree-a80c85", "bd-tree-7ecdb8"]


def hexes(name: str) -> list[tuple[int, int, int]]:
    return [tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in RAMPS[name]]  # type: ignore[misc]


def P(name: str) -> np.ndarray:
    return np.array(Image.open(PIECES / f"{name}.png").convert("RGBA"))


def render_kit(kid: str) -> np.ndarray:
    k = KITS[kid]
    im = Image.new("RGBA", (k["width"] * 16, k["height"] * 16), (0, 0, 0, 0))
    for y, row in enumerate(k["rows"]):
        for key in ("tiles", "upperTiles"):
            for x, n in enumerate(row.get(key) or []):
                if n is not None and n >= 0:
                    t = SHEET.crop(((n % TPR) * 16, (n // TPR) * 16, (n % TPR) * 16 + 16, (n // TPR) * 16 + 16))
                    im.paste(t, (x * 16, y * 16), t)
    return np.array(im)


def h01(x: int, y: int, s: int = 0) -> float:
    n = (int(x) * 374761393 + int(y) * 668265263 + s * 2147483647) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return ((n ^ (n >> 16)) & 0xffff) / 65535.0


def lum(p) -> float:
    return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]


CROWNS = [render_kit(i) for i in CROWN_IDS]
PAL = sorted({tuple(int(v) for v in p[:3]) for im in CROWNS for p in im.reshape(-1, 4) if p[3] > 127}, key=lum)
PIDX = {c: i for i, c in enumerate(PAL)}
AURA = hexes("aura")


def relight(im: np.ndarray, k: int, seed: int, aura: float = 0.04) -> np.ndarray:
    """Crown pixels stay the crown's own colours; only the brightness step moves by k inside the crown colour line. A few bright leaf tips get spirit light."""
    o = im.copy(); h, w = o.shape[:2]; step = max(1, len(PAL) // 9)
    for y in range(h):
        for x in range(w):
            if o[y, x, 3] > 127:
                c = tuple(int(v) for v in o[y, x, :3]); i = PIDX.get(c)
                if i is not None:
                    o[y, x, :3] = PAL[max(0, min(len(PAL) - 1, i + k * step))]
                if aura and lum(o[y, x]) > 105 and h01((x + seed * 7) // 4, (y + seed * 3) // 3, seed) < aura * 3:
                    o[y, x, :3] = AURA[min(6, max(2, int(lum(o[y, x]) / 28)))]
    return o


class Canvas:
    def __init__(self, w: int = 256, h: int = 256):
        self.c = np.zeros((h, w, 4), np.uint8); self.ox, self.oy = 96, 96

    def stamp(self, img: np.ndarray, x: int, y: int) -> None:
        h, w = img.shape[:2]; x += self.ox; y += self.oy
        sub = self.c[y:y + h, x:x + w]; m = img[:, :, 3] > 127; sub[m] = img[m]


def finish(cv: Canvas, base_y: int, feet: tuple[int, int, int, int] | None, under_rows: int = 0):
    """Crop to the drawing, pad so the drawing's ground line (base_y) sits on the bottom of a cell and the width is whole cells.
    Returns (rgba, w_cells, h_cells, block cells, under cells)."""
    a = cv.c; ys, xs = np.nonzero(a[:, :, 3] > 127)
    x0, x1 = xs.min(), xs.max() + 1; y0 = ys.min(); y1 = base_y + cv.oy
    assert ys.max() < y1, "drawing below the ground line"
    wc = math.ceil((x1 - x0) / 16); hc = math.ceil((y1 - y0) / 16)
    left = x0 - ((wc * 16 - (x1 - x0)) // 2); top = y1 - hc * 16
    out = a[top:y1, left:left + wc * 16].copy()
    block, under = [], []
    if feet:
        fx, fy, fw, fh = feet; fx += cv.ox - left; fy += cv.oy - top
        for cy in range(hc):
            for cx in range(wc):
                ix = max(0, min(fx + fw, cx * 16 + 16) - max(fx, cx * 16)); iy = max(0, min(fy + fh, cy * 16 + 16) - max(fy, cy * 16))
                if ix * iy >= 64: block.append([cx, cy])
    for cy in range(hc - under_rows, hc):
        for cx in range(wc):
            if [cx, cy] not in block and (out[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16, 3] > 0).any(): under.append([cx, cy])
    return out, wc, hc, block, under


BIG_A = [(2, 26, -1), (46, 28, -2), (22, 34, -2), (-6, 8, 1), (52, 10, -1), (20, 14, 0), (6, -8, 2), (38, -6, 1), (22, -16, 2)]


def big_tree(spots, seed: int, mirror: bool, lean: float):
    """Big broadleaf: the drawn big trunk (mirrored or not) + crowns. lean shifts crowns sideways by height (px per px above the trunk top)."""
    cv = Canvas(); trunk = P("big-tree-trunk")
    if mirror:
        trunk = trunk[:, ::-1]; spots = [(52 - dx, dy, k) for dx, dy, k in spots]
    cv.stamp(trunk, 8, 46)
    for n, (dx, dy, k) in enumerate(sorted(spots, key=lambda q: q[1])):
        crown = CROWNS[int(h01(dx * 3 + seed, dy + 40, seed) * len(CROWNS))]
        cv.stamp(relight(crown, k, seed + n), dx + int(round(lean * (40 - dy))), dy)
    return finish(cv, 46 + 64, (8 + (20 if mirror else 22), 46 + 40, 22, 14), under_rows=1)


def medium_tree(trunk_col: int, seed: int, mirror: bool):
    cv = Canvas(); tr = P("front-trunks")[:, trunk_col * 32:trunk_col * 32 + 32]
    spots = [(0, 14, -1), (26, 16, -2), (-4, 0, 1), (22, 2, 0), (10, -10, 2)]
    if mirror:
        tr = tr[:, ::-1]; spots = [(28 - dx, dy, k) for dx, dy, k in spots]
    cv.stamp(tr, 10, 34)
    for n, (dx, dy, k) in enumerate(sorted(spots, key=lambda q: q[1])):
        cv.stamp(relight(CROWNS[int(h01(dx * 3 + seed, dy + 40, seed) * 8)], k, seed + n), dx, dy)   # 2x2 crowns only
    return finish(cv, 34 + 32, (10 + 10, 34 + 18, 12, 10), under_rows=1)


def elder_tree():
    cv = Canvas(320, 320); cv.ox, cv.oy = 120, 120
    cv.stamp(P("elder-tree-wood"), 0, 0)
    spots = [(-22, -20, 1), (4, -34, 2), (30, -24, 1), (56, -36, 1), (84, -22, 0), (108, -30, -1), (-10, 4, 0), (20, -6, 1), (48, -10, 0),
             (76, 0, -1), (104, -4, -2), (126, 8, -2), (-30, 22, -1), (2, 22, 0), (92, 22, -2), (118, 30, -2), (40, 8, -1), (64, 14, -2)]
    for n, (dx, dy, k) in enumerate(sorted(spots, key=lambda q: q[1])):
        cv.stamp(relight(CROWNS[(n * 7) % len(CROWNS)], k, 50 + n), dx, dy)
    return finish(cv, 112, (30, 70, 70, 34), under_rows=1)


def plain(img: np.ndarray, feet=None, under_rows: int = 0):
    cv = Canvas(); cv.stamp(img, 0, 0)
    return finish(cv, img.shape[0], feet, under_rows)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sh, fl = P("spirit-mushrooms"), P("spirit-flowers")
    # (id, name, en, family, layer, result)
    BIG_B = [(0, 30, -1), (44, 30, -2), (22, 38, -2), (-10, 12, 0), (54, 14, -1), (16, 16, 0), (36, 18, -1), (2, -6, 2), (30, -10, 1), (14, -22, 2), (44, -2, 1), (22, 4, 0), (22, -10, 1)]
    BIG_C = [(4, 28, -1), (40, 30, -2), (22, 36, -2), (0, 10, 1), (40, 12, -1), (20, 0, 1), (10, -14, 2), (30, -16, 1), (18, 16, -1), (4, -2, 1)]
    BIG_D = [(-4, 30, -1), (24, 34, -2), (50, 26, -2), (-8, 10, 1), (20, 14, 0), (48, 6, -1), (6, -8, 2), (34, -10, 1), (60, -6, 0), (20, -22, 2), (34, 16, -1), (34, 0, 0)]
    items = [
        ("tree-big-a", "정령 숲 큰 활엽수 가", "big spirit broadleaf a", "tree", 3, big_tree(BIG_A, 33, False, 0.0)),
        ("tree-big-b", "정령 숲 큰 활엽수 나", "big spirit broadleaf b (wide, 11 crowns)", "tree", 3, big_tree(BIG_B, 41, True, 0.0)),
        ("tree-big-c", "정령 숲 큰 활엽수 다", "big spirit broadleaf c (tall, leans east)", "tree", 3, big_tree(BIG_C, 57, False, 0.18)),
        ("tree-big-d", "정령 숲 큰 활엽수 라", "big spirit broadleaf d (broad, leans west)", "tree", 3, big_tree(BIG_D, 63, True, -0.14)),
        ("tree-mid-a", "정령 숲 중간 활엽수 가", "medium spirit broadleaf a", "tree", 3, medium_tree(0, 71, False)),
        ("tree-mid-b", "정령 숲 중간 활엽수 나", "medium spirit broadleaf b", "tree", 3, medium_tree(2, 77, True)),
        ("tree-elder", "정령 숲 고목(빛나는 구멍)", "elder spirit tree with a glowing hollow", "tree", 3, elder_tree()),
        ("mushroom-tall", "정령 버섯 무리(큰 것)", "tall glowing mushroom cluster", "mushroom", 3, plain(sh[:, 32:], (6, 50, 36, 12), 1)),
        ("mushroom-small", "정령 버섯 무리(작은 것)", "small glowing mushroom cluster", "mushroom", 3, plain(sh[32:, :32], (4, 22, 24, 8), 1)),
        ("flower-violet", "정령 꽃(보라 방울)", "violet spirit bellflowers", "flower", 2, plain(fl[:, 0:24])),
        ("flower-star", "정령 꽃(빛나는 별꽃)", "glowing star flower", "flower", 2, plain(fl[:, 24:48])),
        ("flower-gold", "정령 꽃(노란 종)", "golden spirit bells", "flower", 2, plain(fl[:, 48:72])),
    ]
    spec, manifest = [], []
    for iid, name, en, fam, layer, (img, wc, hc, block, under) in items:
        Image.fromarray(img, "RGBA").save(OUT / f"{iid}.png", optimize=True)
        spec.append({"id": iid, "name": name, "en": en, "family": fam, "kind": "organic", "layer": layer, "w": wc, "h": hc,
                     "block": block if layer == 3 else [], "under": under if layer == 3 else []})
        manifest.append({"png": f"tiledata/sheer-terrain/spirit/{iid}.png", "kind": "organic", "label": f"beodeul_spirit/{iid}", "chipset": "beodeul_spirit"})
        print(iid, f"{wc}x{hc}", "block", block, "under", len(under))
    (OUT / "spec.json").write_text(json.dumps({"note": "beodeul_spirit — composed by scripts/content/sheer-terrain/compose_spirit.py. w/h in 16px cells. layer 3 stands (upper; block = shut cells; under = ground-shadow cells drawn below the hero and walkable), layer 2 walk-over. kind = object-gate kind.", "items": spec}, ensure_ascii=False, indent=1) + "\n")
    (ROOT / "tiledata/sheer-terrain/waive-manifest-spirit.json").write_text(json.dumps({"items": manifest}, ensure_ascii=False, indent=0) + "\n")


if __name__ == "__main__":
    sys.exit(main())
