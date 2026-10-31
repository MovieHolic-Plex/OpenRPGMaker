#!/usr/bin/env python3
"""Ramp and stair cuts through a SOUTH-facing relief cliff face (high ground north, the cut climbs north) for the four village/
dungeon relief styles sand-steps, snow-steps, peat-steps, cave-steps. Code hand pixels only (no generated images).

Same construction as the grass-steps reference that passed six adversarial VQA rounds (../../ramps/pieces.py, read its
docstrings for what reviewers rejected):
  piece = w*16 x (rise+1)*16 px; rows 0..rise*16-1 = the cut through the face (exactly the face height), last 16 rows = the foot:
  the style's native road as it renders on a straight run (sampled from the probe, sample()).
  ramp   = the style's own road material: lit brow at the crest fading to a shaded toe, chevron contours dipping toward the middle,
           wedge cheeks of the cliff's own face that are thin at the crest and full at the toe (the cut deepens as it descends).
  stairs = 8 px a step (two per face row) between straight cheeks; step material per style (sandstone slabs / snow-capped blue
           stone / log steps on a peat tread / rough-hewn cave stone).
Cheeks are not invented texture: they are the style's own face for that rise, copied from a cut-free render of the same cliff
(probe/<style>-nocut.png), then shaded a tone down on the left (shade side) and kept lit on the right, with a dark / lit cut
edge. So the strata, snow cap, peat grass rim and cave lip run straight into the cut without a seam in their row structure.
Every colour comes from that style's probe render or its RELIEF_STYLES spec hexes; check() fails on anything else.

  bun probe.mts <style> s probe/<style>-nocut.png   (with PROBE_NOCUT=1, run from the repo root; see run.sh)
  python3 pieces.py                                 -> pieces.json, <style>/<kind>-h<rise>-w<w>.png, <style>-sheet.png
"""
import json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CLIFF, PAD = 8, 64          # probe.mts: cliff row 8, render pad 64 px (4 levels) above the map
X = lambda s: tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))

# RELIEF_STYLES spec hexes (src/project/relief/styles.ts) — top, wall, accent
SPEC = {   # top, wall (accent of sand/peat is the generic MOSS green: not used by these pieces, so not allowed either)
    "sand-steps": (["#5b4d35", "#826e4c", "#ae9366", "#d9b87f", "#f5d090", "#ffefa5"], ["#5a3e22", "#7a5630", "#98703f", "#b58a50", "#cfa566", "#e8c282"], []),
    "snow-steps": (["#6a7f9e", "#93a9c6", "#b9cce0", "#d6e3ef", "#e9f1f8", "#ffffff"], ["#2a3040", "#3c4658", "#566479", "#71819a", "#93a3bb", "#b9c6d8"], []),
    "peat-steps": (["#373b1f", "#4e542c", "#68703b", "#828c4a", "#939e54", "#a9b660"], ["#1a1510", "#2a2118", "#3a2d1f", "#4a3a27", "#5b4930", "#6e5a3c"], []),
    "cave-steps": (["#30242a", "#463a3a", "#604e48", "#6c5c54", "#806a5d", "#8d7766"], ["#30242a", "#463a3a", "#604e48", "#6c5c54", "#806a5d", "#8d7766"],
                   ["#2b3934", "#3c4642", "#525a56", "#595b58", "#6f716e", "#929491"]),
}
WALL = {s: [X(c) for c in v[1]] for s, v in SPEC.items()}      # the face ramp dark -> light

def h(x, y, k=0):  # deterministic hash noise 0..255
    v = (x * 374761393 + y * 668265263 + k * 2147483647) & 0xFFFFFFFF
    v = ((v ^ (v >> 13)) * 1274126177) & 0xFFFFFFFF
    return (v ^ (v >> 16)) & 255

def blob(x, y):
    """smooth value noise 0..1 (bilinear over a 2.5-px lattice + a pixel of jitter): round clusters, no streaks"""
    gx, gy = x / 2.5, y / 2.5; ix, iy = int(gx), int(gy); fx, fy = gx - ix, gy - iy
    v = lambda a, b: h(a, b, 107) / 255
    top = v(ix, iy) * (1 - fx) + v(ix + 1, iy) * fx; bot = v(ix, iy + 1) * (1 - fx) + v(ix + 1, iy + 1) * fx
    return min(1, max(0, (top * (1 - fy) + bot * fy) * 0.7 + h(x, y, 109) / 255 * 0.3))

# ---------------------------------------------------------------- sampling from the style's own render
CLEAN = {1: 2, 2: 12, 3: 22, 4: 34}    # first face cell well inside each rise's terrace (away from the terrace side walls)
ROAD_X = {2: 1, 3: 5}                   # probe road columns: ramp w2 at cell 1, stairs w3 at cell 5 (the kit centre tile, tiled)
class Style:
    def __init__(self, name):
        self.name = name
        self.im = Image.open(f"{HERE}/probe/{name}-nocut.png").convert("RGB")
        self.allowed = set(self.im.get_flattened_data()) | {X(c) for part in SPEC[name] for c in part}
        self.wall = WALL[name]
    def face(self, rise, w):
        y0 = PAD + CLIFF * 16 - rise * 16
        return self.im.crop((CLEAN[rise] * 16, y0, CLEAN[rise] * 16 + w * 16, y0 + rise * 16))
    def foot(self, w):
        y0 = PAD + 11 * 16      # a straight run of the road on the low ground
        return self.im.crop((ROAD_X[w] * 16, y0, ROAD_X[w] * 16 + w * 16, y0 + 16))
    def shift(self, c, d):
        if c in self.wall: return self.wall[max(0, min(5, self.wall.index(c) + d))]
        return c

# ---------------------------------------------------------------- per-style materials
# ramp tone sequence dark -> light by luminance; R = index of the road's dominant tone (crest and toe meet the road at it);
# LIT = share of the road's lighter speck (the road's own mix: peat has none lighter, so its sparse lit speck is the bog lawn tip)
RAMP = {
    "sand-steps": (["#7a5630", "#98703f", "#b58a50", "#cfa566", "#dcaf6c", "#eccb86", "#f8e2a4", "#fff6d0"], 5, 0.22, 6, 1.0),
    # compacted snow road (pinkish) shading into the blue-grey of snow in shadow (no #b9c6d8: same lightness as the road, it read
    # as hue noise), lit brow = trodden snow
    "snow-steps": (["#3c4658", "#566479", "#71819a", "#93a3bb", "#c0b0aa", "#dccfca", "#e6f0fa", "#ffffff"], 4, 0.18, 5, 0.8),
    # peat: the road has no lighter tone; the brow catches the bog lawn's own lit green (#939e54, spec top), sparsely
    "peat-steps": (["#3a2d1f", "#5f5a2e", "#655f31", "#6b6534", "#77703a", "#887e44", "#978c4c", "#939e54"], 6, 0.0, 7, 0.3),
    "cave-steps": (["#30242a", "#463a3a", "#604e48", "#6c5c54", "#806a5d", "#8d7766", "#988472", "#b6a28c"], 6, 0.10, 7, 0.6),
}

def snow_ramp_surface(px, F, W):
    """VQA r2: the snow ramp's lower half shaded into the cliff's blue-grey stone and read as an ice chute with a blue/beige seam
    at the foot. The walking surface now stays in the snow road's own tones top to toe. The road has only two (#dccfca lit,
    #c0b0aa body) and no darker tone anywhere in the render, so the slope reads by the light fading out: a lit brow, lit tone
    thinning down the climb to the plain road body at the toe (= the foot, no seam), chevron ridges in the lit tone, grey grit
    (#686c70, the render's own grey) a little thicker toward the toe, and a few snow-white flecks at the sides."""
    LIT, BODY, GRIT, SNOW = X("#dccfca"), X("#c0b0aa"), X("#686c70"), X("#ffffff")
    x0, x1 = 2, W - 2
    cx, hw = (x0 + x1 - 1) / 2, (x1 - x0) / 2
    for Y in range(F):
        f = Y / max(1, F - 1)
        for Xp in range(x0, x1):
            q = blob(Xp, Y)
            lit = (0.85 - 1.05 * f) + (h(Xp, Y, 117) / 255 - 0.5) * 0.5 + (0.25 if q < 0.25 else 0)
            c = LIT if lit > 0.3 else BODY
            if Y < 2 and h(Xp, Y, 119) < 200: c = LIT                              # lit brow, broken
            u = abs(Xp - cx) / max(1, hw)
            t = Y - round(0.45 * (x1 - x0) * (1 - u) * (0.6 + 0.4 * f))
            if 3 <= Y < F - 1 and h(Xp, Y // 3, 113) < 215:
                if t % 6 == 5: c = LIT                                             # chevron ridge, lit
                elif t % 6 == 0 and f < 0.55: c = BODY                             # its shaded side, upper climb
            if h(Xp, Y, 101) > 252 - round(6 * f): c = GRIT                        # grit, thicker toward the toe
            if u > 0.75 and h(Xp, Y, 131) < 14: c = SNOW                           # snow fleck at the side
            px[Xp, Y] = c

def ramp_surface(px, F, W, st, cw):
    if st.name == "snow-steps": return snow_ramp_surface(px, F, W)
    """the road material climbing the cut: the road's own cluster mix (blob) so crest and toe meet the road without a seam,
    a clear fade from a lit brow to a shaded toe (dithered so no row is a hard line), chevron contours that dip deeper toward the
    middle lower down (soft: a lit lip over a two-tone-darker line, broken)."""
    seq, R, lit, BROW, G0 = RAMP[st.name]; seq = [X(c) for c in seq]; top = BROW
    x0, x1 = 2, W - 2
    cx, hw = (x0 + x1 - 1) / 2, (x1 - x0) / 2
    for Y in range(F):
        f = Y / max(1, F - 1)
        g = G0 - (G0 + 1.5) * f                                     # lit at the brow .. -1.5 at the toe
        for Xp in range(x0, x1):
            q = blob(Xp, Y)
            base = R + 1 if q < lit else (R - 1 if q > 0.86 else R)
            sh = g + (h(Xp, Y, 117) / 255 - 0.5) * 0.9
            i = base + (1 if sh > 0.5 else (-1 if sh < -0.5 else 0)) + (-1 if sh < -1.3 else 0)
            i = max(1, min(top, i))
            if Y < 2 and h(Xp, Y, 119) < (200 if BROW <= R + 1 and G0 > 0.5 else 70): i = BROW   # lit brow, broken (sparse where the brow tone is not the road's own)
            if h(Xp, Y, 101) > 248: i = 1 if h(Xp, Y, 103) & 1 else 2  # a pebble / pit
            u = abs(Xp - cx) / max(1, hw)
            t = Y - round(0.45 * (x1 - x0) * (1 - u) * (0.6 + 0.4 * f))   # chevron, dipping deeper lower down
            if 3 <= Y < F - 1 and h(Xp, Y // 3, 113) < 215:
                if t % 6 == 0: i = max(1, i - 2)                     # contour, two tones down
                elif t % 6 == 5: i = min(top, i + 1)                 # its lit lip
            px[Xp, Y] = seq[i]

def cheek_wedge(px, F, W, st, face, left, crease=None):
    """ramp cheek: the face itself, thin at the crest and widening to full at the toe; shade side a tone down, cut edge
    darkest on the left. VQA r1: on tall 3-wide ramps the lit right cheek melted into the ramp's own toe tones (same browns), so
    the right cheek is now at least 3 px, its face lifted a tone, the face's dark knots kept out of it (a stray dark notch), and
    the ramp gets a one-pixel crease in its own shade tone where it meets the lit rim. VQA r2: the peat wall's lightest tone
    (#6e5a3c) is darker than the bog road, so its lit rim dissolved at 1x; the peat rim is the render's own lit olive #a69a54."""
    fp = face.load()
    for Y in range(F):
        f = Y / max(1, F - 1)
        wd = 2 + round(6 * f) + (1 if h(3 if left else 5, Y // 2, 3) < 70 else 0)
        if not left: wd = max(3, wd)
        for j in range(wd):
            Xp = j if left else W - 1 - j
            c = st.shift(fp[Xp, Y], -1 if left else 1)
            if not left and Y < F - 1 and c in st.wall and st.wall.index(c) < 3: c = st.wall[3]
            if j == wd - 1: c = st.wall[0] if left else (X("#a69a54") if st.name == "peat-steps" else st.wall[5])
            elif j == wd - 2 and not left and c in st.wall: c = st.wall[4] if st.name != "peat-steps" else st.wall[5]
            px[Xp, Y] = c
        if not left and crease and 2 <= Y < F - 1: px[W - 1 - wd, Y] = crease

def cheek_straight(px, F, W, st, face, left, cw=4):
    """stair cheek: the face, inner edge wandering a pixel; shade side a tone down, cut edge dark left / lit right."""
    fp = face.load()
    for Y in range(F):
        inner = cw - 1 - (1 if h(7 if left else 9, Y // 2, 3) < 90 else 0)
        for j in range(cw):
            Xp = j if left else W - 1 - j
            if j > inner: continue                                     # the steps run a pixel wider here
            c = st.shift(fp[Xp, Y], -1 if left else 0)
            if j == inner: c = st.wall[0] if left else st.wall[5]
            px[Xp, Y] = c

def slab_edges(x0, x1, k, lo=5, span=4):
    edges, x = [x0], x0 + (k * 3) % 5 + 3
    while x < x1 - 3: edges.append(x); x += lo + h(x, k, 41) % span
    edges.append(x1)
    return edges

def stairs_slab(px, F, W, rise, L, nose, snow=None, rough=False):
    """stone steps, 8 px a step, top to bottom as the eye meets them: tread back (in the riser-above's shade), tread (bevel
    highlight, grain, slab joints staggered step to step), the lit nosing at the tread's front edge, the riser below it (its own
    joints half a slab over) and the riser's dark foot. L = stone ramp dark -> light (6); the lower half of the flight a tone
    darker (deeper in the cut). The top step's tread is level with the crest (no shade at its back).
    snow: (lip, lit, body, shade) — snow lies on every tread, heaped toward the cheeks, trodden thin in the middle where stone
    shows; the nosing is a snow lip with a drip or two hanging over the riser, like the face's own snow cap.
    rough: rough-hewn cave steps — the nosing wavers a pixel, the joints are cracks, risers chipped."""
    x0, x1 = 4, W - 4
    n = rise * 2
    mid = (x0 + x1 - 1) / 2
    for k in range(n):
        y0 = k * 8
        dk = 1 if k >= (n + 1) // 2 else 0
        edges = slab_edges(x0, x1, k, 4 if rough else 5, 4)
        rj = {(edges[i] + edges[i + 1]) // 2 for i in range(len(edges) - 1)}
        for Xp in range(x0, x1):
            j = max(i for i in range(len(edges)) if edges[i] <= Xp)
            sx, ex = edges[j], edges[min(j + 1, len(edges) - 1)]
            first, last = Xp == sx, Xp == ex - 1
            wob = (1 if h(Xp // 4 + k * 5, k, 71) < 90 else 0) if rough else 0   # rough nosing sits a pixel lower for a run
            sv = 1 if h(sx, k, 51) < 90 else 0                                      # every slab its own stone
            u = abs(Xp - mid) / max(1, (x1 - x0) / 2)
            for d in range(8):
                Y = y0 + d
                N = 4 + wob                                                           # nosing row
                if d == 0 and k: c = L[2 - dk]                                        # tread back, under the riser above
                elif d < N:
                    c = L[5 - dk - sv] if d == 1 and not last else L[4 - dk - sv]   # treads face the sky: a tone over the riser
                    if last: c = L[max(0, 3 - dk - sv)]
                    if first: c = L[2 - dk]
                    if not first and not last and 1 < d < N - 1:
                        q = h(Xp, Y, 43)
                        if q < 22: c = L[max(0, 3 - dk - sv)]                         # a pit
                        elif q > 240: c = L[min(5, 5 - dk)]                           # a fleck
                elif d == N: c = nose[1] if not first else nose[0]                    # lit nosing
                elif d < 7:
                    q = h(Xp, Y, 47)
                    c = L[1] if Xp in rj else (L[3 - dk] if d == N + 1 else L[2 - dk])
                    if rough and q < 20 and Xp not in rj: c = L[1]                    # chip
                else: c = L[1]                                                        # riser foot
                if Xp == x0 and d > 0: c = L[max(0, 1 - dk + (1 if d < N else 0))]     # left end, in the cheek's shade
                if Xp == x1 - 1 and 0 < d < N: c = L[5 - dk]                          # right end, lit
                if snow and d <= N:
                    # VQA r1: grey stone showing through read as garbled lettering. Now the tread is clean soft snow: drifted shade
                    # against the riser above, lit snow, a white lip over the nosing, and only sparse isolated flecks of stone.
                    lip, lit, body, shade = snow
                    if d == N: c = lip
                    elif d == 0 and k: c = shade
                    else:
                        c = lit if d == 1 else body
                        if 1 < d < N - 1 and Xp % 4 == (k * 3) % 4 and h(Xp, Y, 86) < 26 and 0 < Xp - x0 < x1 - x0 - 1: c = L[5]   # a lone fleck
                if snow and d == N + 1 and h(Xp, k, 89) < 40 and 0 < Xp - x0 < x1 - x0 - 1: c = snow[2]   # a drip over the riser
                px[Xp, Y] = c

def stairs_log(px, F, W, rise, st):
    """log steps for a peat bank: each step a peat tread (the bog path's own tones, trodden lighter in the middle) held by a log
    laid across as the riser — lit bark top, bark body with grain, dark underside — with sawn log ends at the cheeks (rings) and
    a stake in front of each end. Lower half one tone darker."""
    W6 = st.wall                                  # #1a1510 #2a2118 #3a2d1f #4a3a27 #5b4930 #6e5a3c
    T = [X(c) for c in ("#5f5a2e", "#655f31", "#6b6534", "#77703a", "#79703d", "#887e44", "#978c4c")]
    x0, x1 = 4, W - 4
    n = rise * 2
    mid = (x0 + x1 - 1) / 2
    for k in range(n):
        y0 = k * 8
        dk = 1 if k >= (n + 1) // 2 else 0
        for Xp in range(x0, x1):
            u = abs(Xp - mid) / max(1, (x1 - x0) / 2)
            for d in range(8):
                Y = y0 + d
                if d <= 3:                                                     # peat tread behind the log
                    q = blob(Xp, Y + 31)
                    i = 3 if q < 0.6 else (2 if q < 0.85 else 1)
                    if u < 0.5 and h(Xp, Y, 91) < 140: i += 1                   # trodden lighter in the middle
                    if d == 0: i = max(0, i - 2)                                # shade under the log above
                    i = max(0, min(6, i - dk))
                    c = T[i]
                    if h(Xp, Y, 93) > 247: c = W6[2]                            # a root crumb
                elif d == 4: c = W6[5 - dk] if h(Xp, k, 95) < 200 else W6[4 - dk]   # lit bark top
                elif d <= 6:
                    q = h(Xp // 2 + k * 7, d, 97)                               # bark grain runs along the log
                    c = W6[4 - dk] if (d == 5 and q < 120) else (W6[3 - dk] if q < 200 else W6[2])
                    if h(Xp, Y, 99) < 18: c = W6[1]                             # a knot / crack
                else: c = W6[0]                                                # underside shadow
                if Xp in (x0, x1 - 1) and 4 <= d <= 6:                          # sawn log end: rings
                    c = W6[5] if d == 5 else W6[3]
                if Xp in (x0 + 1, x1 - 2) and d == 5: c = W6[4]
                px[Xp, Y] = c
        for sx in (x0 + 1, x1 - 2):                                            # stake in front of the log end
            if y0 + 7 < F: px[sx, y0 + 7] = W6[3]
    for Xp in range(x0, x1): px[Xp, F - 1] = W6[0]

def stairs_surface(px, F, W, rise, st):
    s, C = st.name, lambda *v: [X(c) for c in v]
    if s == "sand-steps":    # sandstone slabs in the strata/sand tones, sand-pale nosing
        stairs_slab(px, F, W, rise, C("#7a5630", "#98703f", "#b58a50", "#cfa566", "#e8c282", "#f8e2a4"), C("#eccb86", "#fff6d0"))
    elif s == "snow-steps":  # blue-grey stone (the face's own) with snow on the treads
        stairs_slab(px, F, W, rise, C("#2a3040", "#3c4658", "#566479", "#71819a", "#93a3bb", "#b9c6d8"), C("#b9c6d8", "#d6e4f1"),
                    snow=C("#ffffff", "#ecf3fa", "#e6f0fa", "#d6e4f1"))
    elif s == "peat-steps":
        stairs_log(px, F, W, rise, st)
    else:                    # rough-hewn cave stone: floor-lit nosing, face-dark risers, cracks for joints
        stairs_slab(px, F, W, rise, C("#30242a", "#463a3a", "#604e48", "#7a6a5b", "#8d7766", "#988472"), C("#988472", "#b6a28c"), rough=True)

def piece(st, kind, w, rise):
    W, F = w * 16, rise * 16
    im = Image.new("RGB", (W, F + 16)); px = im.load()
    face = st.face(rise, w)
    im.paste(face, (0, 0))
    s_ = st.name
    if kind == "ramp":
        ramp_surface(px, F, W, st, 6)
        cheek_wedge(px, F, W, st, face, True); cheek_wedge(px, F, W, st, face, False, X(RAMP[s_][0][2]))
    else:
        stairs_surface(px, F, W, rise, st)
        cheek_straight(px, F, W, st, face, True); cheek_straight(px, F, W, st, face, False)
    im.paste(st.foot(w), (0, F))
    return im

def check(st, im, name):
    bad = set(im.get_flattened_data()) - st.allowed
    if bad: raise SystemExit(f"{st.name} {name}: colour outside the style's probe render / spec hexes: {['#%02x%02x%02x' % c for c in sorted(bad)][:8]}")

STYLES = ["sand-steps", "snow-steps", "peat-steps", "cave-steps"]

def main(out=HERE):
    pieces = {}
    for s in STYLES:
        st = Style(s); os.makedirs(f"{out}/{s}", exist_ok=True)
        pieces[s], ims = {}, []
        for kind in ("ramp", "stairs"):
            for rise in (1, 2, 3, 4):
                for w in (2, 3):
                    im = piece(st, kind, w, rise); name = f"{kind}-h{rise}-w{w}"; check(st, im, name)
                    im.save(f"{out}/{s}/{name}.png")
                    pieces[s][f"{kind}:n:{w}x1:{rise}"] = {"w": im.width, "h": im.height, "rgba": [v for p in im.get_flattened_data() for v in (*p, 255)]}
                    ims.append(im)
        K, gap = 8, 12
        Wt = sum(i.width * K + gap for i in ims[:8]) + gap
        sheet = Image.new("RGB", (Wt, 2 * (5 * 16 * K + gap) + gap), (24, 24, 30))
        for row in range(2):
            x = gap
            for i in ims[row * 8:(row + 1) * 8]:
                sheet.paste(i.resize((i.width * K, i.height * K), Image.NEAREST), (x, gap + row * (5 * 16 * K + gap))); x += i.width * K + gap
        sheet.save(f"{out}/{s}-sheet.png")
    json.dump(pieces, open(f"{out}/pieces.json", "w"))
    print(sum(len(v) for v in pieces.values()), "pieces ->", out)

if __name__ == "__main__":
    main(*sys.argv[1:])
