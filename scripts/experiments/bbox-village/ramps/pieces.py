#!/usr/bin/env python3
"""bbox-village ramps: code hand-pixel ramp and stair cuts through a south-facing beodeul cliff face.

One piece per (kind, width, rise): kind ramp (packed earth, for tracks) | stairs (cobble steps, for paved roads),
width 2|3 cells, rise 1|2|3 levels (= cliff face rows). Piece = w*16 x (rise+1)*16 px:
  rows 0 .. rise*16-1   the cut through the face (exactly the face height),
  last 16 rows          the foot: the low-level cell the climb starts from (native road tile, flat).
Shape study only from the RTP dungeon cut (cheek walls either side, lit right / shaded left, contour lines that sag in the
middle); no RTP pixels. Every colour is a beodeul colour: the relief face ramp of the village style, the beodeul grass,
sand-track and paving tiles (LOCKED below; check() fails on any other colour). Foot rows are the native interior tiles.

  python3 pieces.py <out dir>     -> pieces.json (keys "<ramp|stairs>:n:<w>x1:<rise>") + sheet.png (8x) + one PNG per piece
"""
import json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
# ---- locked palette (sampled from the beodeul_city render of the village style) ----
W0, W1, W2, W3, W4, W5 = (36, 23, 11), (67, 44, 22), (99, 66, 35), (130, 90, 48), (162, 117, 63), (194, 149, 82)   # cliff face
G0, G1, G2, G3, G4 = (88, 122, 54), (94, 130, 57), (99, 138, 60), (110, 153, 67), (122, 163, 75)                  # grass
S0, S1, S2, S3, S4, S5 = (88, 73, 60), (110, 91, 73), (118, 99, 79), (129, 106, 86), (138, 116, 92), (158, 139, 100)  # sand track
P0, P1, P2, P3, P4, P5 = (55, 66, 67), (91, 102, 103), (119, 117, 121), (144, 146, 143), (196, 198, 195), (222, 224, 221)  # paving / stone
FOOT = {"ramp": Image.open(f"{HERE}/foot-sand.png").convert("RGB"), "stairs": Image.open(f"{HERE}/foot-paving.png").convert("RGB")}
LOCKED = {W0, W1, W2, W3, W4, W5, G0, G1, G2, G3, G4, S0, S1, S2, S3, S4, S5, P0, P1, P2, P3, P4, P5}
for im in FOOT.values(): LOCKED |= set(im.get_flattened_data())

def h(x, y, k=0):  # deterministic hash noise 0..255
    v = (x * 374761393 + y * 668265263 + k * 2147483647) & 0xFFFFFFFF
    v = ((v ^ (v >> 13)) * 1274126177) & 0xFFFFFFFF
    return (v ^ (v >> 16)) & 255

CW = 4  # cheek width px

def cheek(px, x_, y_, F, W, left):
    """the cut's side wall in the face's own soil: left one faces east (shade), right one faces west (lit).
    i = 0 outer edge (meets the face), CW-1 inner edge (meets the climb). Grass lip on top, dark foot line."""
    for j in range(CW):
        X = j if left else W - 1 - j
        for Y in range(F):
            n = h(X, Y, 3)
            if left: c = W1 if j == 0 else (W2 if n > 50 else W1)
            else:
                c = W2 if j == 0 else (W5 if j == CW - 1 else (W4 if n > 45 else W3))
            px[X, Y] = c
        lip = 2 + (1 if h(X, 0, 5) < 110 else 0) + (1 if j == 0 else 0)
        for Y in range(lip): px[X, Y] = G1 if Y < lip - 1 else G0
        px[X, F - 1] = W0 if (left or j == 0) else W1
    # a pebble or two in the wall like the face
    for Y in range(5, F - 3, 7):
        X = 1 if left else W - 3
        if h(X, Y, 21) < 150:
            px[X, Y] = W3 if left else W5; px[X + 1, Y] = W2 if left else W4; px[X, Y + 1] = W1 if left else W3

def ramp_surface(px, F, W, rise):
    """packed-earth ramp: lit at the crest, darker toward the toe (it faces up the climb), broken contour dashes that sag
    in the middle (RTP rhythm, our colours), two worn wheel/foot ruts, cheek shade on the left, light on the right."""
    x0, x1 = CW, W - CW
    c, hw = (x0 + x1 - 1) / 2, (x1 - x0) / 2
    ramp = [S5, S4, S3, S2, S1]                        # crest -> toe
    rut = {round(x0 + (x1 - x0) * 0.3), round(x0 + (x1 - x0) * 0.7) - 1}
    for Y in range(F):
        f = Y / max(1, F - 1)
        for X in range(x0, x1):
            n = h(X, Y, 7)
            # dithered gradient between two neighbouring tones
            k = f * 3.0 + 0.2
            i = int(k); fr = k - i
            col = ramp[min(4, i + (1 if (n / 255) < fr else 0))]
            u = (X - c) / hw
            sag = round(3 * (1 - u * u))
            t = Y - sag
            if t > 1 and t % 5 == 4 and n < 175 and 1 < Y < F - 2: col = S0 if f > .5 else S1          # contour dash
            elif t > 1 and t % 5 == 3 and n < 120 and 1 < Y < F - 2: col = S5                          # its lit lip
            if X in rut and 1 < Y < F - 1 and n < 200: col = S2 if f < .4 else S1                       # worn rut
            if n > 249 and 2 < Y < F - 3: col = S0                                                      # pebble
            px[X, Y] = col
        px[x0, Y] = S1 if Y > 1 else S3; px[x0 + 1, Y] = S2 if h(x0 + 1, Y, 9) < 170 and Y > 1 else px[x0 + 1, Y]
        px[x1 - 1, Y] = S5 if Y % 3 else S4
    for X in range(x0, x1):
        px[X, 0] = S5; px[X, 1] = S5 if h(X, 1, 4) < 128 else S4    # crest
        px[X, F - 1] = S1 if h(X, F - 1, 11) < 128 else S2           # toe shadow

def stair_surface(px, F, W, rise):
    """cut-stone steps, 8 px a step (two per face row). Each step = a row of dressed slabs (5-8 px, joints staggered step to
    step): lit nosing, tread with a bevel highlight top-left and shade bottom-right, a few weathering pits; the riser below is
    the slab's front in darker stone with its own joints offset half a slab; a shadow line under the next nosing.
    Per-step light: the upper steps catch more light, the lower ones sit deeper in the cut (one tone darker)."""
    x0, x1 = CW, W - CW
    L = [P0, P1, P2, P3, P4, P5]
    n = rise * 2
    for k in range(n):
        y0 = k * 8
        dk = 1 if k >= (n + 1) // 2 else 0                     # lower half of the flight one tone darker
        # slab edges for this step
        edges, x = [x0], x0 + (k * 3) % 5 + 3
        while x < x1 - 3: edges.append(x); x += 5 + h(x, k, 41) % 4
        edges.append(x1)
        rj = {(edges[i] + edges[i + 1]) // 2 for i in range(len(edges) - 1)}   # riser joints: half a slab over
        for X in range(x0, x1):
            j = max(i for i in range(len(edges)) if edges[i] <= X)
            sx, ex = edges[j], edges[min(j + 1, len(edges) - 1)]
            first, last = X == sx, X == ex - 1
            for d in range(8):
                Y = y0 + d
                if d == 0: c = L[5 - dk] if not first else L[4 - dk]                         # nosing
                elif d <= 3:
                    sv = 1 if h(sx, k, 51) < 90 else 0                                        # every slab its own stone: some a tone darker
                    c = L[3 - dk - sv]                                                        # tread body
                    if d == 1 and not last: c = L[4 - dk - sv]                                # bevel highlight
                    if last or d == 3: c = L[max(0, 2 - dk - sv)]                             # bevel shade
                    if first: c = L[1]                                                        # joint
                    if 1 < d < 3 and not first and not last:
                        q = h(X, Y, 43)
                        if q < 60: c = L[2 - dk]                                            # pit / grain
                        elif q > 225: c = L[4 - dk]                                         # fleck
                elif d == 4: c = L[2 - dk] if not first else L[1]                             # tread back edge
                elif d <= 6:                                                                     # riser front
                    q = h(X, Y, 47)
                    c = L[0] if X in rj else ((L[2] if q < 150 else L[3 - dk]) if d == 5 else (L[1] if q < 170 else L[2]))
                else: c = L[0]                                                                # shadow
                if X == x0 and d > 0: c = L[1] if d <= 4 else L[0]                            # left end, cheek shade
                if X == x1 - 1 and 0 < d <= 3: c = L[4]                                       # right end, lit
                px[X, Y] = c
    for X in range(x0, x1): px[X, F - 1] = P0

def piece(kind, w, rise):
    W, F = w * 16, rise * 16
    im = Image.new("RGB", (W, F + 16)); px = im.load()
    (ramp_surface if kind == "ramp" else stair_surface)(px, F, W, rise)
    cheek(px, 0, 0, F, W, True); cheek(px, 0, 0, F, W, False)
    foot = FOOT[kind].load()
    for Y in range(16):
        for X in range(W): px[X, F + Y] = foot[X % 16, Y]
    # the climb spills a little onto the foot: one row of the ramp/stair colour at the very top, cheek shadow corners
    for X in range(CW, W - CW):
        if kind == "ramp" and h(X, F, 17) < 150: px[X, F] = S3
    return im

def check(im):
    bad = {c for c in im.get_flattened_data()} - LOCKED
    if bad: raise SystemExit(f"colour outside the locked beodeul palette: {sorted(bad)[:6]}")

def main(out):
    os.makedirs(out, exist_ok=True)
    pieces, ims = {}, []
    for kind in ("ramp", "stairs"):
        for rise in (1, 2, 3):
            for w in (2, 3):
                im = piece(kind, w, rise); check(im)
                name = f"{kind}-h{rise}-w{w}"; im.save(f"{out}/{name}.png")
                pieces[f"{kind}:n:{w}x1:{rise}"] = {"w": im.width, "h": im.height, "rgba": [v for p in im.get_flattened_data() for v in (*p, 255)]}
                ims.append((name, im))
    json.dump(pieces, open(f"{out}/pieces.json", "w"))
    K, gap = 8, 12
    Wt = sum(i.width * K + gap for _, i in ims[:6]) + gap
    sheet = Image.new("RGB", (Wt, 2 * (4 * 16 * K + gap) + gap), (24, 24, 30))
    for row in range(2):
        x = gap
        for name, i in ims[row * 6:(row + 1) * 6]:
            sheet.paste(i.resize((i.width * K, i.height * K), Image.NEAREST), (x, gap + row * (4 * 16 * K + gap))); x += i.width * K + gap
    sheet.save(f"{out}/sheet.png")
    print(len(pieces), "pieces ->", out)

if __name__ == "__main__":
    main(sys.argv[1])
