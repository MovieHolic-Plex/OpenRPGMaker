#!/usr/bin/env python3
"""Long ramp: a packed-earth slope cut through a south-facing beodeul cliff that runs out onto the low ground, length = rise
(any rise >= 2). Code hand-pixel in the locked beodeul colours of ../../bbox-village/ramps/pieces.py (sampled from the chipset's
own cliff face, grass and sand track) — no new colour, no generated image.

Four 16-px-tall modules per width (2|3 cells), stacked top to bottom (rows = rise + length):
  top     the crest: grass lip on the cheeks, the lit brow where the plateau's grass gives way to the cut
  cut     one cliff-face row of the cut (repeats rise-1 times): full-height face soil cheeks, shaded left / lit right
  out<N>  one row of the ramp running out over the low ground, side walls N px (6/5/4/3); the compositor picks N by how far
          the row is from the cliff, so the walls taper like a wedge (repeat rows reuse a variant)
  toe     the last row: the slope meets the ground, ragged grass edges, the track's own tone
The surface texture is the track's cluster mix with chevron contours on an 8-px period, hashed on (x, y mod 16), so every
module tiles seamlessly with itself and its neighbours. A fade runs crest light -> toe shade over the whole piece at
compose time (cutPieces.ts uses the modules as drawn; the fade is in the modules: top lighter, toe darker).

  python3 pieces.py <out dir>   -> modules.json (keys "ramp:n:<w>:long-<module>") + sheet.png + composed previews
"""
import json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "../bbox-village/ramps"))
import pieces as base   # noqa: E402  (locked palette, hash noise, blob)

W0, W1, W2, W3, W4, W5 = base.W0, base.W1, base.W2, base.W3, base.W4, base.W5
G0, G1, G2, G3, G4 = base.G0, base.G1, base.G2, base.G3, base.G4
SEQ = base.SEQ
h = base.h

def surface(px, W, y0, rows, tone, x0, x1):
    """track-mix earth with soft chevron contours (8-px period), y hashed mod 16 so modules tile."""
    cx, hw = (x0 + x1 - 1) / 2, (x1 - x0) / 2
    for d in range(rows):
        Y = y0 + d; yy = d % 16
        for X in range(x0, x1):
            q = base.blob(X, yy)
            i = 6 if q < 0.25 else (4 if q > 0.85 else 5)
            sh = tone + (h(X, yy, 117) / 255 - 0.5) * 0.9
            i = max(1, min(6, i + (1 if sh > 0.5 else (-1 if sh < -0.5 else 0))))
            if h(X, yy, 101) > 248: i = 0 if h(X, yy, 103) & 1 else 2
            u = abs(X - cx) / max(1, hw)
            t = yy - round(0.35 * (x1 - x0) * (1 - u))
            if h(X, yy // 3, 113) < 215:
                if t % 8 == 0: i = max(1, i - 2)
                elif t % 8 == 7: i = min(6, i + 1)
            px[X, Y] = SEQ[i]

def face_cheeks(px, W, y0, rows, cw):
    """inside the cliff-face rows: the face's own soil, shaded left / lit right, ragged inner edge, a cobble now and then."""
    for d in range(rows):
        Y = y0 + d; yy = d % 16
        for left in (True, False):
            inner = cw - 1 - (1 if h(7 if left else 9, yy // 2, 3) < 90 else 0)
            for j in range(inner + 1):
                X = j if left else W - 1 - j
                n = h(X, yy, 3)
                c = (W1 if n < 60 else W2) if left else (W3 if n < 70 else (W4 if n < 200 else W2))
                if j == inner: c = W0 if left else W5
                px[X, Y] = c
            if h(1 if left else W - 3, yy, 21) < 40 and 2 < yy < 14:
                X = 1 if left else W - 3
                px[X, Y] = W3 if left else W5; px[X + 1, Y] = W2 if left else W4

def out_cheeks(px, W, y0, rows, wd_from, wd_to, grass_out):
    """the ramp's part over the low ground: its side walls seen edge-on, narrowing toward the toe; grass outside."""
    for d in range(rows):
        Y = y0 + d; yy = d % 16
        f = d / max(1, rows - 1)
        wd = round(wd_from + (wd_to - wd_from) * f)
        for left in (True, False):
            g = grass_out + (1 if h(3 if left else 5, yy, 31) < 100 else 0)
            for j in range(g):
                X = j if left else W - 1 - j
                px[X, Y] = (G1, G2, G3, G0)[h(X, yy, 33) & 3]
            for j in range(g, g + wd):
                X = j if left else W - 1 - j
                c = (W1 if h(X, yy, 3) < 90 else W2) if left else (W3 if h(X, yy, 3) < 90 else W4)
                if j == g + wd - 1: c = W0 if left else W5
                px[X, Y] = c

def module(name, w):
    W = w * 16
    im = Image.new("RGB", (W, 16)); px = im.load()
    if name == "top":
        surface(px, W, 0, 16, 1.0, 0, W)
        for X in range(W):                                   # the lit brow, broken
            for Y in range(2):
                if h(X, Y, 119) < 200: px[X, Y] = SEQ[6]
        face_cheeks(px, W, 0, 16, 5)
        for j in range(4):                                    # the plateau's grass lip curling over the cheeks
            for left in (True, False):
                X = j if left else W - 1 - j
                for Y in range(3 + (1 if h(X, 0, 5) < 110 else 0) - (1 if j == 3 else 0)): px[X, Y] = G1 if Y else G0
    elif name == "cut":
        surface(px, W, 0, 16, 0.3, 0, W); face_cheeks(px, W, 0, 16, 5)
    elif name.startswith("out"):
        wall = int(name[3:])
        surface(px, W, 0, 16, 0.4 - 0.15 * (6 - wall), 0, W); out_cheeks(px, W, 0, 16, wall, max(1, wall - 1), 2)
    else:  # toe
        surface(px, W, 0, 16, -0.6, 0, W); out_cheeks(px, W, 0, 16, 2, 0, 2)
        for X in range(W):                                    # the slope settles into the ground: ragged grass at the very end
            for Y in range(13 + (h(X, 0, 41) % 3), 16): px[X, Y] = (G1, G2, G3, G0)[h(X, Y, 43) & 3]
    return im

OUT_WALLS = (6, 5, 4, 3)

def outWall(k, n):
    """k-th of n rows over the low ground: the wall narrows from 6 px at the cliff to 3 px before the toe (same rule as cutPieces.ts)."""
    return OUT_WALLS[min(len(OUT_WALLS) - 1, (k * len(OUT_WALLS)) // max(1, n))]

def compose(mods, rise, length):
    W = mods["top"].width
    im = Image.new("RGB", (W, (rise + length) * 16))
    seq = ["top"] + ["cut"] * (rise - 1) + [f"out{outWall(k, length - 1)}" for k in range(length - 1)] + ["toe"]
    for k, m in enumerate(seq): im.paste(mods[m], (0, k * 16))
    return im

def main(out):
    os.makedirs(out, exist_ok=True)
    data, previews = {}, []
    for w in (2, 3):
        mods = {n: module(n, w) for n in ("top", "cut", *(f"out{v}" for v in OUT_WALLS), "toe")}
        for n, im in mods.items():
            base.check(im)
            data[f"ramp:n:{w}:long-{n}"] = {"w": im.width, "h": im.height, "rgba": [v for p in im.get_flattened_data() for v in (*p, 255)]}
            im.save(f"{out}/long-{n}-w{w}.png")
        for rise in (2, 4, 6, 8): previews.append(compose(mods, rise, 2))
    json.dump(data, open(f"{out}/modules.json", "w"))
    K, gap = 4, 8
    sheet = Image.new("RGB", (sum(p.width * K + gap for p in previews) + gap, max(p.height for p in previews) * K + 2 * gap), (24, 24, 30))
    x = gap
    for p in previews: sheet.paste(p.resize((p.width * K, p.height * K), Image.NEAREST), (x, gap)); x += p.width * K + gap
    sheet.save(f"{out}/sheet.png")
    print(len(data), "modules ->", out)

if __name__ == "__main__":
    main(sys.argv[1])
