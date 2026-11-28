#!/usr/bin/env python3
"""bbox-village ramps: code hand-pixel ramp and stair cuts through a south-facing beodeul cliff face.

One piece per (kind, width, rise): kind ramp (packed earth, for tracks) | stairs (cobble steps, for paved roads),
width 2|3 cells, rise 1|2|3|4 levels (= cliff face rows). Piece = w*16 x (rise+1)*16 px:
  rows 0 .. rise*16-1   the cut through the face (exactly the face height),
  last 16 rows          the foot: the low-level cell the climb starts from (native road tile, seamlessly joined).
Every colour is strictly from the locked beodeul palette (cliff face, grass, sand-track and paving tiles; check() fails
on any unlocked colour).

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

# Additional native colours already present in foot-ramp / foot-stairs (verified by check()):
G5 = (132, 171, 82)    # sunlit meadow grass tip in foot-ramp
GE = (135, 119, 86)    # olive earth-grass verge transition in foot-ramp
P00 = (43, 57, 52)     # deepest slate shadow in foot-stairs
S0B = (96, 79, 63)     # deep warm track earth in foot-sand
SEQ = [S0, S0B, S1, S2, S3, S4, S5]   # sand-track tones dark -> light

def h(x, y, k=0):  # deterministic hash noise 0..255
    v = (x * 374761393 + y * 668265263 + k * 2147483647) & 0xFFFFFFFF
    v = ((v ^ (v >> 13)) * 1274126177) & 0xFFFFFFFF
    return (v ^ (v >> 16)) & 255

def smooth_noise(X, Y, scale=3.0, seed=107, wx=0, wy=0):
    """Smooth bicubic-like value noise 0..1 with optional periodic wrapping (wx, wy) for seamless tiling."""
    gx, gy = X / scale, Y / scale
    ix, iy = int(gx) if gx >= 0 else int(gx) - 1, int(gy) if gy >= 0 else int(gy) - 1
    fx, fy = gx - ix, gy - iy
    ux, uy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    def v(a, b):
        aa = a % wx if wx else a
        bb = b % wy if wy else b
        return h(aa, bb, seed) / 255.0
    top = v(ix, iy) * (1 - ux) + v(ix + 1, iy) * ux
    bot = v(ix, iy + 1) * (1 - ux) + v(ix + 1, iy + 1) * ux
    return top * (1 - uy) + bot * uy

def blob(X, Y):
    """Clustered soil noise 0..1: rounded earth clods without directional streaks."""
    broad = smooth_noise(X, Y, 3.6, 107)
    fine = smooth_noise(X + 11, Y + 7, 2.0, 109)
    return min(1.0, max(0.0, broad * 0.68 + fine * 0.24 + (h(X, Y, 111) / 255.0) * 0.08))

CW = 4  # cheek width px for stone stairs

def ramp_surface(px, F, W, rise):
    """Natural 3/4 compacted-earth slope: sunlit rounded crest brow fading smoothly into mid-slope clod clusters and subtle
    wheel/foot wear, settling seamlessly into the native sand-track foot without artificial V-chevrons."""
    cx = (W - 1) * 0.5
    hw = max(1.0, W * 0.5 - 4.0)
    for Y in range(F):
        f = Y / max(1, F - 1)  # 0 at crest .. 1 at cliff base
        # Sunlit crest (+0.95) -> warm upper slope -> cool lower cut (-0.35), rising slightly at very bottom to match foot-sand
        if f < 0.82:
            fade = 0.92 - 1.45 * (f / 0.82)
        else:
            fade = -0.53 + 0.45 * ((f - 0.82) / 0.18)
        for X in range(W):
            q = blob(X, Y)
            clod = smooth_noise(X, Y * 1.35, 2.8, 131)
            # Subtle twin wheel/foot wear tracks slightly off-center
            u = abs(X - cx) / hw
            wear = 0.25 if 0.16 < u < 0.58 else (-0.18 if u > 0.82 else 0.0)
            # Match foot-sand's crisp golden-tan clod highlights (SEQ[6]) + rich mid/shaded earth (SEQ[2..5])
            base_i = 6 if q > 0.67 else (5 if q > 0.48 else (4 if q > 0.26 else 3))
            sh = fade * 1.15 + (clod - 0.5) * 1.3 + wear + ((h(X, Y, 133) / 255.0) - 0.5) * 0.45
            # Soft, irregular soil clod steps (short 3-5px organic clod lips, never V-stripes)
            if 2 <= Y < F - 2 and clod > 0.56 and u < 0.8:
                cy = (Y + int(smooth_noise(X, 0, 4.5, 137) * 3) - int((1.0 - u * u) * 1.5)) % 7
                if cy == 0 and h(X >> 1, Y, 139) < 145:
                    sh += 0.9
                elif cy == 1 and h(X >> 1, Y - 1, 139) < 145:
                    sh -= 0.95
            # Left cut casts a clear 3px ambient shadow; right side catches warm NW sunlight
            if X < 8:
                sh -= (8 - X) * 0.24
            elif X > W - 9:
                sh += (X - (W - 9)) * 0.14
            delta = 1 if sh > 0.52 else (-2 if sh < -1.15 else (-1 if sh < -0.45 else 0))
            i = max(1, min(6, base_i + delta))
            # Rounded sunlit brow at the very top of the cut
            if Y == 0:
                i = 6 if h(X, 0, 149) < 200 else 5
                if h(X, 0, 151) < 55:
                    px[X, Y] = GE
                    continue
            elif Y <= 2 and h(X, Y, 149) < (175 if Y == 1 else 115) and 5 < X < W - 6:
                i = 6
            # Occasional tiny 2px pebble (lit top-left + dark shadow right, matching foot-sand)
            p = h(X, Y, 157)
            if 2 < Y < F - 2 and 6 < X < W - 7:
                if p < 4:
                    i = 6
                elif h(X - 1, Y, 157) < 4:
                    i = 0 if (h(X, Y, 163) & 1) else 1
            px[X, Y] = SEQ[i]

def ramp_cheek(px, F, W, left):
    """Natural earthen cliff-cut embankment harmonized with foot-ramp's 4-5px grass margin: lush curving grass brow on top,
    carved soil bank with cobble clods (shaded left / sunlit right), and soft feathered verge blending into the track."""
    for Y in range(F):
        f = Y / max(1, F - 1)
        wave = int(round((smooth_noise(0, Y, 3.5, 173 if left else 179) - 0.5) * 1.8))
        wd = max(3, min(5, int(round(3.4 + 1.1 * f)) + wave))
        for j in range(wd + 1):
            X = j if left else W - 1 - j
            n = h(X, Y, 181)
            if j == wd:
                # Soft soil/grass verge transition into the path (no harsh black wire)
                if Y < 4:
                    px[X, Y] = G2 if n < 120 else GE
                elif Y > F - 4:
                    px[X, Y] = G3 if n < 110 else GE
                else:
                    px[X, Y] = (S1 if n < 130 else S2) if left else (GE if n < 110 else S4)
                continue
            # Outer column matches the adjacent cliff soil; inner bank reflects NW lighting
            if j == 0:
                c = (W1 if n < 120 else W2) if left else (W2 if n < 150 else W3)
            elif left:
                c = W1 if (j == wd - 1 or n < 105) else W2
                if j == wd - 1 and n < 55 and 4 < Y < F - 3:
                    c = W0
            else:
                c = W5 if (j == wd - 1 and n < 145) else (W4 if n < 175 else W3)
            # Bottom 3px of the cliff face transition into low-ground grass shoulder
            if Y >= F - 3 and j < wd - 1:
                if Y == F - 1 or (Y == F - 2 and j <= 2) or (Y == F - 3 and j == 0 and n < 120):
                    c = (G1, G2, G3, G4)[(n >> 2) & 3]
            px[X, Y] = c

    # Embedded small soil/stone clods in the cut bank
    for Y in range(5, F - 4, 6):
        X = 1 if left else W - 3
        if h(X, Y, 191) < 165:
            px[X, Y] = W3 if left else W5
            px[X + 1, Y] = W2 if left else W4
            px[X, Y + 1] = W1 if left else W3

    # Lush overhanging plateau grass brow curving naturally around the upper corners
    max_j = 6
    for j in range(max_j):
        X = j if left else W - 1 - j
        hang = max(0, int(round(4.6 - j * 0.68 + (h(X, 0, 197) % 3) * 0.5)))
        for Y in range(min(F, hang)):
            if Y == 0:
                px[X, Y] = G4 if (h(X, Y, 199) & 1) else G3
            elif Y == hang - 1:
                px[X, Y] = G0 if j < 3 else (GE if (h(X, Y, 211) & 1) else G2)
            elif Y == 1:
                px[X, Y] = G3 if h(X, Y, 223) < 150 else G4
            else:
                px[X, Y] = G2 if (h(X, Y, 227) & 1) else G1

def cheek(px, x_, y_, F, W, left, rich=False):
    """Dressed-stone & cliff-earth cut cheek for village cobble stairs: rugged earth outer blend, stepped stone kerb stringer
    on the inner edge (shaded left / sunlit right) with moss accents, and lush overhanging grass tufts at the crest."""
    for Y in range(F):
        course = Y // 8
        step_in = 1 if (Y >= F - 2) else 0  # flare 1px outward at bottom to meet foot-stairs stone curbs
        kerb_j = max(1, 2 - step_in)
        for j in range(CW):
            X = j if left else W - 1 - j
            n = h(X, Y, 3)
            if j < kerb_j:
                # Outer cliff-earth blend (no jarring pitch-black vertical rail)
                if Y == F - 1:
                    c = W0 if left else W1
                else:
                    c = (W1 if n < 110 else W2) if left else (W2 if n < 120 else W3)
            else:
                # Stepped stone kerb stringer along the stairs
                joint = (Y % 8 == 7) or (Y % 8 == 3 and j == kerb_j and (course & 1))
                if joint:
                    c = G0 if (n < 55 and Y > 4) else (P0 if left else P1)
                elif left:
                    c = P1 if (j == CW - 1 or n < 95) else P2
                else:
                    c = P4 if (j == CW - 1 and Y % 8 < 5) else (P3 if n < 170 else P4)
            px[X, Y] = c

    # Overhanging grass tufts draping over the top of the cut cheek and stone kerb
    for j in range(CW + 1):
        X = j if left else W - 1 - j
        lip = max(1, 4 - (j // 2) + (1 if h(X, 0, 5) < 100 else 0) - (1 if j == CW else 0))
        for Y in range(min(F, lip)):
            if Y == 0:
                px[X, Y] = G4 if j < 2 else G3
            elif Y == lip - 1:
                px[X, Y] = G0 if j < 3 else G1
            else:
                px[X, Y] = G2 if (h(X, Y, 7) & 1) else G3

def stair_surface(px, F, W, rise, rich=False):
    """Hand-crafted 3/4 cobble/dressed-stone steps (8px pitch):
      d=0    recessed back crease (or sunlit top kerb at k=0) with mossy outer corners
      d=1..2 bevelled dressed stone tread with varied slab widths & subtle weathering
      d=3    crisp sunlit stone nosing broken at mortar joints
      d=4    deep overhang shadow directly beneath the nosing
      d=5..6 recessed vertical stone riser with staggered mortar seams & damp moss specks
      d=7    riser base mortar crease."""
    x0, x1 = CW, W - CW
    L = [P0, P1, P2, P3, P4, P5]
    n = rise * 2
    for k in range(n):
        y0 = k * 8
        dk = 1 if (n >= 4 and k >= (n * 2) // 3) else 0
        # Staggered stone slab edges across this step
        edges, x = [x0], x0 + 4 + ((k * 3 + h(k, 0, 41)) % 4)
        while x < x1 - 4:
            edges.append(x)
            x += (4 + h(x, k, 41) % 3) if rich else (5 + h(x, k, 41) % 4)
        edges.append(x1)
        rj = {(edges[i] + edges[i + 1]) // 2 for i in range(len(edges) - 1)}

        for X in range(x0, x1):
            j = max(i for i in range(len(edges)) if edges[i] <= X)
            sx, ex = edges[j], edges[min(j + 1, len(edges) - 1)]
            first, last = (X == sx and X > x0), (X == ex - 1 and X < x1 - 1)
            sv = 1 if h(sx, k, 51) < 75 else 0
            edge_dist = min(X - x0, x1 - 1 - X)

            for d in range(8):
                Y = y0 + d
                q = h(X, Y, 43)
                if k == 0 and d == 0:
                    # Top crest kerb where plateau meets the first step
                    c = L[3] if first else (L[4] if q < 70 else L[5])
                    if edge_dist == 0 and q < 140:
                        c = G2
                elif d == 0:
                    # Back crease under upper riser, with tiny moss specks in damp outer corners
                    if edge_dist <= 1 and q < 95:
                        c = G0 if X - x0 <= 1 else G1
                    else:
                        c = L[1] if first else L[max(1, 2 - dk)]
                elif d in (1, 2):
                    # Dressed stone tread with top-left bevel highlight
                    ti = 3 - dk - sv
                    if d == 1 and not first and not last:
                        ti += 1
                    if last:
                        ti -= 1
                    if first:
                        c = L[1]
                    else:
                        if q < 38:
                            ti -= 1
                        elif q > 232 and d == 1:
                            ti += 1
                        c = L[max(1, min(5, ti))]
                elif d == 3:
                    # Crisp 1px sunlit front nosing (broken at joints so each stone block reads individually)
                    if first:
                        c = L[max(2, 3 - dk)]
                    elif last or q < 28:
                        c = L[4 - dk]
                    else:
                        c = L[5 - (1 if dk and q < 110 else 0)]
                elif d == 4:
                    # 1px deep contact shadow directly underneath the overhanging nosing
                    c = P00 if (X < x0 + (x1 - x0) // 2 and q < 160) else (P1 if X >= x1 - 3 and q < 120 else P0)
                elif d in (5, 6):
                    # Recessed vertical stone riser with offset mortar joints
                    if X in rj:
                        c = P0
                    elif edge_dist == 0 and d == 6 and q < 80:
                        c = G0
                    else:
                        ri = (2 if q < 165 else 3 - dk) if d == 5 else (1 if q < 150 else 2)
                        c = L[max(1, ri)]
                else:
                    # d == 7: riser base mortar line
                    c = P00 if (X in rj) else (P0 if q < 175 else P1)

                # Ambient cut shadow along left cheek; warm light along right cheek
                if X == x0 and d in (1, 2, 3) and c in (P4, P5):
                    c = P3 if c == P4 else P4
                elif X == x0 + 1 and d in (1, 2) and c == P4 and q < 140:
                    c = P3
                elif X == x1 - 1 and d in (1, 2) and not first:
                    c = P4
                px[X, Y] = c

def piece(kind, w, rise):
    global CW
    CW = 4
    W, F = w * 16, rise * 16
    im = Image.new("RGB", (W, F + 16)); px = im.load()
    rich = kind == "stairs" and rise == 1
    if kind == "ramp":
        ramp_surface(px, F, W, rise)
        ramp_cheek(px, F, W, True)
        ramp_cheek(px, F, W, False)
    else:
        stair_surface(px, F, W, rise, rich)
        cheek(px, 0, 0, F, W, True, rich)
        cheek(px, 0, 0, F, W, False, rich)

    seg = SEG[(kind, w)].load()
    for Y in range(16):
        for X in range(W):
            px[X, F + Y] = seg[X, Y]

    # Seamless transition across Y = F where the cut meets the native foot tile
    if kind == "ramp":
        for dy in range(3):
            Y = F + dy
            for X in range(5, W - 5):
                if h(X, Y, 241) < (150 - dy * 55):
                    px[X, Y] = S3 if (h(X, Y, 243) & 1) else S4
            for side_x in (3, 4, W - 5, W - 4):
                if dy < 2 and h(side_x, Y, 251) < 120:
                    px[side_x, Y] = GE if side_x in (4, W - 5) else G2
    else:
        # Ground the bottom stone riser onto the cobble road and tie kerbs into foot-stairs curbs
        for X in range(3, W - 3):
            px[X, F] = P0 if h(X, F, 253) < 175 else P1
            if 4 <= X < W - 4 and h(X, F + 1, 255) < 90:
                px[X, F + 1] = P1
        for Y in (F, F + 1):
            px[1, Y] = P2; px[2, Y] = P3
            px[W - 3, Y] = P4; px[W - 2, Y] = P3
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
