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
    """cobble steps cut into the face, 8 px a step (two steps per face row): lit nosing, a tread in the paving's own cobble
    pattern lifted one tone, the riser in the same pattern dropped one tone with a staggered joint, a shadow line under it."""
    x0, x1 = CW, W - CW
    pave = FOOT["stairs"].load()
    up = {P0: P1, P1: P2, P2: P3, P3: P4}; down = {P3: P2, P2: P1, P1: P0, P0: P0}
    for k in range(rise * 2):
        y0 = k * 8
        joints = {x0 + 3 + ((k * 5 + j * 8) % max(1, x1 - x0 - 4)) for j in range(0, (x1 - x0) // 8 + 1)}
        for X in range(x0, x1):
            for d in range(8):
                Y = y0 + d; t = pave[X % 16, (Y * 3 + k) % 16]
                if d == 0: c = P5 if h(X, Y, 31) < 170 else P4
                elif d <= 3: c = up.get(t, t)
                elif d == 4: c = P3 if h(X, Y, 33) < 150 else P2
                elif d <= 6: c = P0 if X in joints else down.get(t, t)
                else: c = P0
                if X == x0 and d > 0: c = P1 if d <= 4 else P0
                if X == x1 - 1 and 0 < d <= 4: c = P4
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
