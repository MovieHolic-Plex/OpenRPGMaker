#!/usr/bin/env python3
"""Long ramp: a natural packed-earth slope carved through a south-facing beodeul cliff that tapers organically onto the
low meadow/ground (any rise >= 2). Code hand-pixel strictly in the locked beodeul colours of ../../bbox-village/ramps/pieces.py.

Modules per width (2|3 cells), each 16 px tall, stacked top to bottom:
  top     rounded sunlit brow with plateau grass tufts curving naturally around the upper corners into the earthen cut
  cut     cliff-face row of the cut (repeats rise-1 times): natural carved soil embankments (shaded west / sunlit east)
  out<N>  runout over low ground (N = 6/5/4/3): cliff embankment tapers smoothly away into feathered meadow grass shoulders
  toe     foot of the slope: compacted earth fanning softly and settling into the grass with tufts and tiny pebbles

No V-chevron zebra stripes and no blocky cardboard side walls. Soil clusters wrap mod 16 in Y (and mod 16 in X across the
middle cell of w=3 so cutPieces.ts widening for w >= 4 is seamless).

  python3 pieces.py <out dir>   -> modules.json (keys "ramp:n:<w>:long-<module>") + sheet.png + composed previews
"""
import json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "../bbox-village/ramps"))
import pieces as base  # noqa: E402  (locked palette, noise, check)

W0, W1, W2, W3, W4, W5 = base.W0, base.W1, base.W2, base.W3, base.W4, base.W5
G0, G1, G2, G3, G4, G5, GE = base.G0, base.G1, base.G2, base.G3, base.G4, base.G5, base.GE
S0, S1, S2, S3, S4, S5 = base.S0, base.S1, base.S2, base.S3, base.S4, base.S5
SEQ = base.SEQ
h = base.h

def tile_blob(X, Y):
    """16x16-tileable multi-scale soil cluster noise 0..1 so module seams (Y mod 16) and w>=4 middle-cell repeats (X mod 16) join seamlessly."""
    broad = base.smooth_noise(X, Y, 4.0, 307, wx=4, wy=4)
    med = base.smooth_noise(X + 5, Y + 3, 2.0, 311, wx=8, wy=8)
    jit = h(X & 15, Y & 15, 313) / 255.0
    return min(1.0, max(0.0, broad * 0.62 + med * 0.28 + jit * 0.10))

def meadow_px(w, X, Y):
    """Native beodeul grass shoulder colour matching foot-ramp's outer meadow palette so runout edges vanish into the lawn."""
    seg = base.SEG[("ramp", w)].load()
    sx = X if X < 4 else (w * 16 - 1 - (w * 16 - 1 - X) if X >= w * 16 - 4 else -1)
    if sx != -1:
        c = seg[sx, Y & 15]
        if c in (G0, G1, G2, G3, G4, G5, (97, 140, 59)):
            return c
    q = base.smooth_noise(X, Y, 2.5, 317, wx=8, wy=8)
    if q > 0.74:
        return G5
    if q > 0.52:
        return G4
    if q > 0.28:
        return G3
    return G2 if (h(X & 15, Y & 15, 319) & 1) else (97, 140, 59)

def paint_earth(px, W, tone_top, tone_bot, in_cut=False):
    """Compacted-earth path surface matching foot-sand's crisp clod contrast (SEQ[2..6] + tiny SEQ[0..1] pebbles),
    with sunlit crest fade, subtle foot/wheel wear, and organic soil clod terraces (zero V-chevron stripes)."""
    cx = (W - 1) * 0.5
    hw = max(1.0, W * 0.5 - 5.0)
    for Y in range(16):
        f = Y / 15.0
        tone = tone_top + (tone_bot - tone_top) * f
        for X in range(W):
            q = tile_blob(X, Y)
            clod = base.smooth_noise(X + 3, Y, 4.0, 331, wx=4, wy=4)
            u = abs(X - cx) / hw
            wear = 0.20 if 0.18 < u < 0.60 else (-0.15 if u > 0.84 else 0.0)
            base_i = 6 if q > 0.66 else (5 if q > 0.46 else (4 if q > 0.24 else 3))
            sh = tone + (clod - 0.5) * 1.25 + wear + ((h(X & 15, Y, 335) / 255.0) - 0.5) * 0.4
            # Organic 3-5px soil clod terraces (irregular broken lips, never zebra bars or V-chevrons)
            if clod > 0.55 and u < 0.82:
                cy = (Y + int(base.smooth_noise(X, 0, 4.0, 337, wx=4, wy=4) * 3)) & 7
                if cy == 2 and h((X >> 1) & 7, Y, 339) < 140:
                    sh += 0.85
                elif cy == 3 and h((X >> 1) & 7, Y - 1, 339) < 140:
                    sh -= 0.90
            if in_cut:
                if X < 9:
                    sh -= (9 - X) * 0.22
                elif X > W - 10:
                    sh += (X - (W - 10)) * 0.12
            delta = 1 if sh > 0.50 else (-2 if sh < -1.15 else (-1 if sh < -0.45 else 0))
            i = max(1, min(6, base_i + delta))
            # Sparse 2px pebbles (kept away from Y=0/15 and X=0/15 tile seams)
            if 2 <= Y <= 13 and (X & 15) not in (0, 15) and 6 < X < W - 7:
                p = h(X & 15, Y, 347)
                if p < 4:
                    i = 6
                elif h((X - 1) & 15, Y, 347) < 4:
                    i = 0 if (h(X & 15, Y, 349) & 1) else 1
            px[X, Y] = SEQ[i]

def paint_cliff_banks(px, W, is_top=False):
    """Natural carved cliff-earth banks for 'top' and 'cut' rows: shaded west bank, sunlit east bank, soft soil/moss verge."""
    for Y in range(16):
        for left in (True, False):
            wave = int(round((base.smooth_noise(0, Y, 4.0, 353 if left else 359, wx=4, wy=4) - 0.5) * 1.6))
            bw = max(3, min(5, 4 + wave))
            for j in range(bw + 2):
                X = j if left else W - 1 - j
                n = h(X, Y, 367)
                if j == bw + 1:
                    # Gentle ambient shadow on left / sunlit earth kiss on right
                    if left and n < 135:
                        cur = px[X, Y]
                        if cur in (SEQ[5], SEQ[6]):
                            px[X, Y] = SEQ[4]
                        elif cur == SEQ[4]:
                            px[X, Y] = SEQ[3]
                    elif not left and n < 110 and px[X, Y] == SEQ[4]:
                        px[X, Y] = SEQ[5]
                    continue
                if j == bw:
                    # Feathered verge where earthen bank meets the path (no black outline wire!)
                    if n < 45 and Y > 3:
                        px[X, Y] = G0 if left else G2
                    else:
                        px[X, Y] = (SEQ[2] if n < 140 else SEQ[3]) if left else (GE if n < 115 else SEQ[5])
                    continue
                if j == 0:
                    c = (W1 if n < 115 else W2) if left else (W2 if n < 155 else W3)
                elif left:
                    c = W1 if (j == bw - 1 or n < 110) else W2
                    if j == bw - 1 and n < 50 and 2 <= Y <= 13:
                        c = W0
                else:
                    c = W5 if (j == bw - 1 and n < 145) else (W4 if n < 175 else W3)
                px[X, Y] = c

            # Embedded small cobble clod in the cut face
            if Y in (5, 11) and h(1 if left else 2, Y, 373) < 150:
                X = 1 if left else W - 3
                px[X, Y] = W3 if left else W5
                px[X + 1, Y] = W2 if left else W4
                if Y + 1 < 16:
                    px[X, Y + 1] = W1 if left else W3

    if is_top:
        # Sunlit rounded brow across the crest + plateau grass lip curving smoothly into the cut corners
        for X in range(5, W - 5):
            if h(X, 0, 379) < 70:
                px[X, 0] = GE if h(X, 0, 383) < 170 else G3
            else:
                px[X, 0] = SEQ[6] if h(X, 0, 389) < 190 else SEQ[5]
            if h(X, 1, 389) < 155:
                px[X, 1] = SEQ[6]
            elif h(X, 2, 389) < 95:
                px[X, 2] = SEQ[6]
        for left in (True, False):
            for j in range(7):
                X = j if left else W - 1 - j
                hang = max(0, int(round(5.2 - j * 0.72 + (h(X, 0, 397) % 3) * 0.45)))
                for Y in range(min(16, hang)):
                    if Y == 0:
                        px[X, Y] = G4 if (h(X, Y, 401) & 1) else G3
                    elif Y == hang - 1:
                        px[X, Y] = G0 if j < 4 else (GE if (h(X, Y, 409) & 1) else G2)
                    elif Y == 1:
                        px[X, Y] = G4 if h(X, Y, 419) < 130 else G3
                    else:
                        px[X, Y] = G2 if (h(X, Y, 421) & 1) else G1

def paint_runout_shoulders(px, w, W, wall_level):
    """Feathered grassy shoulders over low ground (out6..out3): right below the cliff (out6 upper rows) the earth bank
    tapers quickly away into lush grass blades and clover tufts hugging the compacted-earth path."""
    for Y in range(16):
        f = Y / 15.0
        for left in (True, False):
            wave = (base.smooth_noise(0, Y, 4.0, 431 if left else 433, wx=4, wy=4) - 0.5) * 2.0
            # Grass shoulder width matches foot-ramp (3.5..5.5 px), slightly thinner at top of out6 where cliff toe meets ground
            if wall_level == 6:
                gw = int(round(2.3 + 2.2 * f + wave * 0.8))
                berm = max(0, int(round(2.4 * (1.0 - f * 1.25))))
            elif wall_level == 5:
                gw = int(round(3.8 + 0.6 * f + wave))
                berm = 1 if (Y < 6 and h(1 if left else 2, Y, 439) < 120) else 0
            else:
                gw = int(round(4.3 + wave))
                berm = 0
            gw = max(2, min(6, gw))

            # Outer meadow grass (blends directly into the low ground lawn)
            for j in range(gw):
                X = j if left else W - 1 - j
                c = meadow_px(w, X, Y)
                if j == gw - 1 and berm == 0:
                    # Inner grass tuft edge encroaching onto dirt
                    n = h(X, Y, 443)
                    c = G4 if (not left and n < 95) else (G2 if (left and n < 120) else G3)
                px[X, Y] = c

            # Short tapering earth berm just below the cliff face (only upper rows of out6/out5, never a boxy wall)
            for b in range(berm):
                X = (gw + b) if left else W - 1 - (gw + b)
                n = h(X, Y, 449)
                if left:
                    px[X, Y] = W2 if (b == 0 and n < 150) else S1
                else:
                    px[X, Y] = W4 if (b == 0 and n < 150) else S5

            # Soft olive earth-grass verge pixel between grass shoulder and dirt track
            vx = (gw + berm) if left else W - 1 - (gw + berm)
            if 0 <= vx < W:
                n = h(vx, Y, 457)
                if n < 135:
                    px[vx, Y] = GE if n < 85 else (SEQ[3] if left else SEQ[4])
                elif n < 175 and berm == 0:
                    px[vx, Y] = G3 if not left else G2

def paint_toe(px, w, W):
    """Foot of the long ramp: feathered grass shoulders curve gently inward and blend the compacted-earth trail organically
    into the lower meadow with scattered grass tufts and tiny pebbles."""
    cx = (W - 1) * 0.5
    for Y in range(16):
        f = Y / 15.0
        for left in (True, False):
            wave = (base.smooth_noise(0, Y, 4.0, 431 if left else 433, wx=4, wy=4) - 0.5) * 2.0
            extra = (max(0.0, f - 0.45) / 0.55) ** 1.4 * (W * 0.24)
            gw = max(3, min(W // 2, int(round(4.3 + wave + extra))))
            for j in range(gw):
                X = j if left else W - 1 - j
                px[X, Y] = meadow_px(w, X, Y)
                if j == gw - 1 and Y < 13:
                    n = h(X, Y, 461)
                    px[X, Y] = GE if n < 90 else (G2 if left else G3)
            vx = gw if left else W - 1 - gw
            if 0 <= vx < W and h(vx, Y, 463) < 130:
                px[vx, Y] = GE if (h(vx, Y, 467) & 1) else SEQ[3]

        # Organic grass tufts & soft fade across the very tip (Y = 11..15) so no straight horizontal edge remains
        if Y >= 11:
            for X in range(W):
                dist = abs(X - cx) / max(1.0, W * 0.5 - 4.0)
                thresh = (Y - 10) * 44 + int(dist * 75)
                n = h(X, Y, 479)
                if n < thresh:
                    px[X, Y] = meadow_px(w, X, Y)
                elif n < thresh + 38:
                    px[X, Y] = GE

def module(name, w):
    W = w * 16
    im = Image.new("RGB", (W, 16)); px = im.load()
    if name == "top":
        paint_earth(px, W, 0.78, 0.22, in_cut=True)
        paint_cliff_banks(px, W, is_top=True)
    elif name == "cut":
        paint_earth(px, W, 0.18, -0.05, in_cut=True)
        paint_cliff_banks(px, W, is_top=False)
    elif name.startswith("out"):
        wall = int(name[3:])
        t0 = 0.08 - (6 - wall) * 0.07
        paint_earth(px, W, t0, t0 - 0.10, in_cut=False)
        paint_runout_shoulders(px, w, W, wall)
    else:  # toe
        paint_earth(px, W, -0.08, -0.35, in_cut=False)
        paint_toe(px, w, W)
    return im

OUT_WALLS = (6, 5, 4, 3)

def outWall(k, n):
    """k-th of n rows over the low ground: the wall narrows from 6 at the cliff to 3 before the toe (same rule as cutPieces.ts)."""
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
