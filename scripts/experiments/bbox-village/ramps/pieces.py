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
# the foot row: the native road/track segment as it renders on a straight run, side edges included (sample_foot.py)
SEG = {(k, w): Image.open(f"{HERE}/foot-{k}-w{w}.png").convert("RGB") for k in ("ramp", "stairs") for w in (2, 3)}
LOCKED = {W0, W1, W2, W3, W4, W5, G0, G1, G2, G3, G4, S0, S1, S2, S3, S4, S5, P0, P1, P2, P3, P4, P5}
for im in [*FOOT.values(), *SEG.values()]: LOCKED |= set(im.get_flattened_data())

def h(x, y, k=0):  # deterministic hash noise 0..255
    v = (x * 374761393 + y * 668265263 + k * 2147483647) & 0xFFFFFFFF
    v = ((v ^ (v >> 13)) * 1274126177) & 0xFFFFFFFF
    return (v ^ (v >> 16)) & 255

CW = 4  # cheek width px

def cheek(px, x_, y_, F, W, left, rich=False):
    """the cut's side: the cliff face's own soil running into the cut. Base like the face (shade side darker), a cobble or two,
    an inner edge that wanders a pixel (no straight post), dark on the shaded left, a lit rim on the right; grass lip on top."""
    for Y in range(F):
        inner = CW - 1 - (1 if h(7 if left else 9, Y // 2, 3) < 90 else 0)       # ragged inner edge
        for j in range(CW):
            X = j if left else W - 1 - j
            n = h(X, Y, 3)
            if j > inner: px[X, Y] = px[X + 1, Y] if left else px[X - 1, Y]; continue   # the climb widens by a pixel here
            if left: c = W1 if n < 60 else W2
            else: c = W3 if n < 70 else (W4 if n < 200 else W2)
            if j == inner: c = W0 if left else W5                                # cut edge: shadow / lit rim
            px[X, Y] = c
        if h(1 if left else W - 3, Y, 21) < 40 and 2 < Y < F - 2:               # a cobble like the face
            X = 1 if left else W - 3
            px[X, Y] = W3 if left else W5; px[X + 1, Y] = W2 if left else W4
    for j in range(CW):
        X = j if left else W - 1 - j
        lip = 2 + (1 if h(X, 0, 5) < 110 else 0)
        for Y in range(lip): px[X, Y] = G1 if Y < lip - 1 else G0
        px[X, F - 1] = W0 if left else W1

SEQ = [S0, (96, 79, 63), S1, S2, S3, S4, S5]   # sand-track tones dark -> light (the foot tile uses all of them)

def blob(X, Y):
    """smooth value noise 0..1 (bilinear over a 3-px lattice, then a pixel of jitter): round clusters, no streaks"""
    gx, gy = X / 2.5, Y / 2.5; ix, iy = int(gx), int(gy); fx, fy = gx - ix, gy - iy
    v = lambda a, b: h(a, b, 107) / 255
    top = v(ix, iy) * (1 - fx) + v(ix + 1, iy) * fx; bot = v(ix, iy + 1) * (1 - fx) + v(ix + 1, iy + 1) * fx
    return min(1, max(0, (top * (1 - fy) + bot * fy) * 0.7 + h(X, Y, 109) / 255 * 0.3))

def ramp_surface(px, F, W, rise):
    """packed-earth ramp (r6, after three adversarial VQA rounds: r1 horizontal dark dashes = "stone courses", r3 flat fill =
    "a notch, no slope"). Slope cues, in the RTP cut's way but our colours: chevron contours that dip deep toward the middle
    (soft: a lit lip over a one-tone-darker line, broken), a light-to-shade fade down the climb that starts at the track's own
    tone at the crest (no pale band), and wedge-shaped cheeks (ramp_cheek) that are thin at the crest and full at the toe, so the
    cut deepens as it descends. The texture is the track's own cluster mix (blob), so crest and toe meet the road without a seam."""
    x0, x1 = 2, W - 2
    cx, hw = (x0 + x1 - 1) / 2, (x1 - x0) / 2
    for Y in range(F):
        f = Y / max(1, F - 1)                                     # 0 crest .. 1 toe
        # r7 (r5 VQA: "reads as a level track"): a clear fade from a lit brow to a shaded toe, dithered so no row is a hard line
        g = 1.0 - 2.2 * f                                          # +1 .. -1.2 tone shift down the climb
        for X in range(x0, x1):
            q = blob(X, Y)
            base = 6 if q < 0.25 else (4 if q > 0.85 else 5)       # the track's own mix
            sh = g + (h(X, Y, 117) / 255 - 0.5) * 0.9              # ordered-ish dither of the shift
            i = max(1, min(6, base + (1 if sh > 0.5 else (-1 if sh < -0.5 else 0)) + (-1 if sh < -1.2 else 0)))
            if Y < 2 and h(X, Y, 119) < 200: i = 6                 # lit brow, broken
            if h(X, Y, 101) > 248: i = 0 if h(X, Y, 103) & 1 else 2
            u = abs(X - cx) / max(1, hw)
            t = Y - round(0.45 * (x1 - x0) * (1 - u) * (0.6 + 0.4 * f)) # chevron, dipping deeper lower down (it comes nearer)
            if Y >= 3 and Y < F - 1 and h(X, Y // 3, 113) < 215:
                if t % 6 == 0: i = max(1, i - 2)                     # contour, two tones down
                elif t % 6 == 5: i = min(6, i + 1)                   # its lit lip
            px[X, Y] = SEQ[i]

def ramp_cheek(px, F, W, left):
    """wedge cheek of a ramp cut: the cliff face's soil, thin at the crest and widening to full at the toe; cut edge dark on the
    shaded left, lit on the right; a couple of cobble lumps like the face; grass lip on top."""
    for Y in range(F):
        f = Y / max(1, F - 1)
        wd = 2 + round(6 * f) + (1 if h(3 if left else 5, Y // 2, 3) < 70 else 0)
        for j in range(wd):
            X = j if left else W - 1 - j
            n = h(X, Y, 3)
            c = (W1 if n < 70 else W2) if left else (W3 if n < 80 else W4)
            if j == wd - 1: c = W0 if left else W5
            elif j == wd - 2 and not left: c = W4
            px[X, Y] = c
    for j in range(3):
        X = j if left else W - 1 - j
        for Y in range(2 + (1 if h(X, 0, 5) < 110 else 0)): px[X, Y] = G1 if Y else G0
    for Y in range(4, F - 3, 6):                                              # cobble lumps
        X = 1 if left else W - 3
        if h(X, Y, 21) < 170:
            px[X, Y] = W3 if left else W5; px[X + 1, Y] = W2 if left else W4; px[X, Y + 1] = W1 if left else W3

def stair_surface(px, F, W, rise, rich=False):
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
        while x < x1 - 3: edges.append(x); x += (3 + h(x, k, 41) % 3) if rich else (5 + h(x, k, 41) % 4)   # short flight: smaller stones
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
                    if rich and 1 <= d <= 3 and not first:                                    # short flight: dressed-stone grain on every tread
                        q = h(X, Y, 61)
                        if q < 45: c = L[max(0, 2 - dk - sv)]
                        elif q < 70 and d == 2: c = L[1]

                elif d == 4: c = L[2 - dk] if not first else L[1]                             # tread back edge
                elif d <= 6:                                                                     # riser front
                    q = h(X, Y, 47)
                    c = L[0] if X in rj else ((L[2] if q < 150 else L[3 - dk]) if d == 5 else (L[1] if q < 170 else L[2]))
                    if rich and X not in rj:                                                  # riser: chisel marks, lit top lip
                        if d == 6 and q < 40: c = L[0]
                else: c = L[0]                                                                # shadow
                if X == x0 and d > 0: c = L[1] if d <= 4 else L[0]                            # left end, cheek shade
                if X == x1 - 1 and 0 < d <= 3: c = L[4]                                       # right end, lit
                px[X, Y] = c
    for X in range(x0, x1): px[X, F - 1] = P0

def piece(kind, w, rise):
    global CW
    CW = 6 if kind == "ramp" else 4   # ramp cheeks as wide as the track's ragged grass edge, so the climb is the track's own width
    W, F = w * 16, rise * 16
    im = Image.new("RGB", (W, F + 16)); px = im.load()
    rich = kind == "stairs" and rise == 1
    if kind == "ramp": ramp_surface(px, F, W, rise); ramp_cheek(px, F, W, True); ramp_cheek(px, F, W, False)
    else: stair_surface(px, F, W, rise, rich); cheek(px, 0, 0, F, W, True, rich); cheek(px, 0, 0, F, W, False, rich)
    seg = SEG[(kind, w)].load()
    for Y in range(16):
        for X in range(W): px[X, F + Y] = seg[X, Y]
    # the climb spills a little onto the foot: one row of the ramp/stair colour at the very top, cheek shadow corners
    return im

def check(im):
    bad = {c for c in im.get_flattened_data()} - LOCKED
    if bad: raise SystemExit(f"colour outside the locked beodeul palette: {sorted(bad)[:6]}")

def main(out):
    os.makedirs(out, exist_ok=True)
    pieces, ims = {}, []
    for kind in ("ramp", "stairs"):
        for rise in (1, 2, 3, 4):
            for w in (2, 3):
                im = piece(kind, w, rise); check(im)
                name = f"{kind}-h{rise}-w{w}"; im.save(f"{out}/{name}.png")
                pieces[f"{kind}:n:{w}x1:{rise}"] = {"w": im.width, "h": im.height, "rgba": [v for p in im.get_flattened_data() for v in (*p, 255)]}
                ims.append((name, im))
    json.dump(pieces, open(f"{out}/pieces.json", "w"))
    K, gap = 8, 12
    Wt = sum(i.width * K + gap for _, i in ims[:8]) + gap
    sheet = Image.new("RGB", (Wt, 2 * (5 * 16 * K + gap) + gap), (24, 24, 30))
    for row in range(2):
        x = gap
        for name, i in ims[row * 8:(row + 1) * 8]:
            sheet.paste(i.resize((i.width * K, i.height * K), Image.NEAREST), (x, gap + row * (5 * 16 * K + gap))); x += i.width * K + gap
    sheet.save(f"{out}/sheet.png")
    print(len(pieces), "pieces ->", out)

if __name__ == "__main__":
    main(sys.argv[1])
