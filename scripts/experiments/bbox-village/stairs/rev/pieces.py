#!/usr/bin/env python3
"""Reverse cliff cuts: code hand-pixel ramp and stair pieces for a NORTH-facing relief cliff (high ground south, low ground north).

Geometry (render.ts paintSlopePieces, cutPieces.ts reverseCutLength): a reverse cut of rise r is a slope r+2 cells long on the
low side. In the 3/4 view its whole fall is drawn as a 2-row (w*16 x 32 px) strip directly north of the terrace lip:
  piece row 31  = the crest: the terrace's own edge where the cut leaves it (lit, the lip is interrupted here),
  rows 1..30    = the flight / slope, descending AWAY from the viewer toward the top of the strip,
  row 0         = the foot: the low road just beyond the last step, in the steps' shadow; the low road continues above.
The surface faces away from the (south) light, so the whole cut is shaded and darkens toward the far, low end (top).

Stairs: 2 treads per level (rise 1..4 -> 2..8 treads in the same 30 px), so a higher cut has more, thinner treads. Seen from
above with the risers facing away, each tread is a band: its far edge = a lit nosing (top row of the band), the body, and at the
bottom of the band the dark shadow the next-higher step's riser casts on it. Thin stringers/curbs edge the flight on both sides.
Ramp: the road's own material, foreshortened contour grooves (2 per level, bowed toward the viewer where the middle is worn),
a lit brow at the crest, a dark toe crease at the foot, shading that deepens toward the far end; thin side edges.

Materials: grass ramp = beodeul sand track, grass stairs = beodeul paving; sand = sand road / sandstone; snow = snow road /
blue-grey stone with snow; peat = peat path / log steps; cave = cave floor / rough stone. Every colour is checked against the
style's probe renders (base/<style>-n.png, base/<style>-s.png) plus its RELIEF_STYLES spec hexes; check() fails otherwise.

  python3 pieces.py            -> pieces.json, <style>/<kind>-h<rise>-w<w>.png, sheet-<style>.png (8x)
"""
import json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
STYLES = ["grass-steps", "sand-steps", "snow-steps", "peat-steps", "cave-steps"]
MOSS = ["#223319", "#304726", "#415f32", "#56793f", "#6e944f", "#8db266"]
SNOW_WHITE = ["#6f8aa8", "#93aecb", "#b7cde3", "#d6e4f1", "#ecf3fa", "#ffffff"]
SPEC = {  # src/project/relief/styles.ts RELIEF_STYLES top / wall / accent
    "grass-steps": ["#1a4c22", "#276d2d", "#3d8d43", "#5fa84a", "#87c464", "#b4e08a", "#24170b", "#432c16", "#634223", "#825a30", "#a2753f", "#c29552", "#2e1a0a", "#4a2c12", "#6e4520", "#94632f", "#b98648", "#d8a866"],
    "snow-steps": ["#6a7f9e", "#93a9c6", "#b9cce0", "#d6e3ef", "#e9f1f8", "#ffffff", "#2a3040", "#3c4658", "#566479", "#71819a", "#93a3bb", "#b9c6d8", *SNOW_WHITE],
    "sand-steps": ["#5b4d35", "#826e4c", "#ae9366", "#d9b87f", "#f5d090", "#ffefa5", "#5a3e22", "#7a5630", "#98703f", "#b58a50", "#cfa566", "#e8c282", *MOSS],
    "cave-steps": ["#30242a", "#463a3a", "#604e48", "#6c5c54", "#806a5d", "#8d7766", "#2b3934", "#3c4642", "#525a56", "#595b58", "#6f716e", "#929491"],
    "peat-steps": ["#373b1f", "#4e542c", "#68703b", "#828c4a", "#939e54", "#a9b660", "#1a1510", "#2a2118", "#3a2d1f", "#4a3a27", "#5b4930", "#6e5a3c", *MOSS],
}
rgb = lambda s: tuple(int(s.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
R = lambda *hs: [rgb(h) for h in hs]

def allowed(style):
    ok = {rgb(h) for h in SPEC[style]}
    for f in ("n", "s"): ok |= set(Image.open(f"{HERE}/base/{style}-{f}.png").convert("RGB").get_flattened_data())
    return ok

BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
def bay(x, y): return (BAYER[y % 4][x % 4] + 0.5) / 16   # ordered dither 0..1 (smooth tone steps, no salt-and-pepper)

def h(x, y, k=0):  # deterministic hash noise 0..255
    v = (x * 374761393 + y * 668265263 + k * 2147483647) & 0xFFFFFFFF
    v = ((v ^ (v >> 13)) * 1274126177) & 0xFFFFFFFF
    return (v ^ (v >> 16)) & 255

# ---------------------------------------------------------------- materials (dark -> light), all from probe renders / spec
M = {
    "grass-steps": dict(
        shade=2.2,
        flank=R("#24170b", "#432c16", "#634223", "#a2753f"),
        road=R("#58493c", "#6e5b49", "#76634f", "#816a56", "#8a745c", "#9e8b64"), road_base=4, road_mix=(3, 5),
        crest=R("#9e8b64", "#9e8b64", "#9e8b64"),
        margin=R("#4e702f", "#618c3b", "#6e9943", "#7aa34b", "#84ab52"), track=(4, 28),   # grass beside the track (cols)
        stone=R("#2b3934", "#374243", "#5b6667", "#777579", "#90928f", "#c4c6c3", "#dee0dd"),
        curb=R("#2b3934", "#777579", "#90928f", "#c4c6c3"), curbw=3),
    "sand-steps": dict(
        shade=3.0,
        flank=R("#5a3e22", "#7a5630", "#98703f", "#cfa566"),
        road=R("#b58a50", "#cfa566", "#dcaf6c", "#e8c282", "#eccb86", "#f5d090"), road_base=4, road_mix=(2, 4),
        crest=R("#f5d090", "#ffefa5", "#fff9b4"),
        stone=R("#5a3e22", "#7a5630", "#98703f", "#b58a50", "#cfa566", "#e8c282", "#f5d090"),
        curb=R("#5a3e22", "#98703f", "#b58a50", "#e8c282"), curbw=3),
    "snow-steps": dict(
        shade=1.4,
        flank=R("#3c4658", "#566479", "#71819a", "#b9c6d8"),
        road=R("#71819a", "#93a3bb", "#b8c0c8", "#c0b0aa", "#c0b0aa", "#dccfca"), road_base=3, road_mix=(2, 5),
        crest=R("#dccfca", "#ecf3fa", "#ffffff"),
        stone=R("#2a3040", "#3c4658", "#566479", "#71819a", "#93a3bb", "#b9c6d8", "#d6e4f1"),
        snow=R("#93aecb", "#b7cde3", "#d6e4f1", "#ecf3fa", "#ffffff"),
        curb=R("#566479", "#93a3bb", "#b9c6d8", "#ffffff"), curbw=3),
    "peat-steps": dict(
        shade=2.4,
        flank=R("#1a1510", "#2a2118", "#3a2d1f", "#5b4930"),
        road=R("#5f5a2e", "#6b6534", "#77703a", "#887e44", "#978c4c", "#a69a54"), road_base=4, road_mix=(3, 5),
        crest=R("#a69a54", "#b5a85b", "#b5a85b"),
        wood=R("#1a1510", "#2a2118", "#3a2d1f", "#4a3a27", "#5b4930", "#6e5a3c"),
        curb=R("#1a1510", "#3a2d1f", "#4a3a27", "#5b4930"), curbw=0),   # log steps on a trail: no stringers, log ends show,
    "cave-steps": dict(
        shade=2.4,
        flank=R("#30242a", "#463a3a", "#604e48", "#806a5d"),
        road=R("#6c5c54", "#7a6a5b", "#817061", "#8d7766", "#988472", "#a7917d"), road_base=4, road_mix=(3, 5),
        crest=R("#a7917d", "#b69e89", "#b6a28c"),
        stone=R("#30242a", "#443b33", "#604e48", "#6c5c54", "#806a5d", "#8d7766", "#a7917d", "#b6a28c"),
        curb=R("#30242a", "#604e48", "#806a5d", "#a7917d"), curbw=3),
}

def bands(n):
    """n tread bands in rows 1..30, top band first: [(y0, y1, j)] with j = 0 the nearest (highest) tread at the bottom."""
    e = [round(1 + 30 * i / n) for i in range(n + 1)]
    return [(e[i], e[i + 1], n - 1 - i) for i in range(n)]

# ---------------------------------------------------------------- ramp
def ramp(style, w, rise):
    """road-material ramp. r1 VQA (self): a flat dark fill with a hard dark top row and a dark outline in the grass read as a box /
    a pit, and an orange crest row carried the lip straight across. Now: a dithered fade (near = road tone, far = two tones
    down), contour grooves 2 per level that bow toward the viewer, a pale broken brow at the crest in the road's own light tone
    (so the orange lip visibly stops at the cut), a soft dithered toe, side edges only inside the track (dark left, lit right)."""
    m = M[style]; W = w * 16; T = m["road"]; top = len(T) - 1
    im = Image.new("RGB", (W, 32)); px = im.load()
    x0, x1 = (m["track"][0], W - (32 - m["track"][1])) if "track" in m else (0, W)
    cx, hw = (x0 + x1 - 1) / 2, (x1 - x0) / 2
    n = 2 * rise
    ys = [round(3 + 25 * (i + 0.5) / n) for i in range(n)]       # contour rows (top..bottom), evenly foreshortened
    bow = 1 if rise >= 3 else 2
    for Y in range(32):
        f = 1 - Y / 31                                           # 0 crest (bottom) .. 1 foot (top, far, low)
        le = x0 - (1 if h(1, Y // 2, 5) < 80 else 0); re = x1 + (1 if h(2, Y // 2, 5) < 80 else 0)
        for X in range(W):
            if "margin" in m and (X < le or X >= re):            # the grass either side of the track: untouched grass mix
                G = m["margin"]; q = h(X, Y, 7)
                px[X, Y] = G[2] if q < 160 else (G[1] if q < 215 else G[3]); continue
            q = h(X, Y, 11)
            busy = "margin" in m                                      # the beodeul track is a busy cluster mix; the others are flat
            i = m["road_base"] if q < (170 if busy else 236) else (m["road_mix"][0] if q < (215 if busy else 246) else m["road_mix"][1])
            sh = m['shade'] * f                                                # faces away from the light: shade grows toward the far end
            i -= int(sh + (bay(X, Y) - 0.5) * 0.7)                      # banded, dithered only near each tone step
            u = abs(X - cx) / max(1, hw)
            off = round(bow * (1 - u * u))                             # worn middle: contour bows toward the viewer
            for k, cy in enumerate(ys):
                if Y == cy + off and h(X, k, 17) < 230: i -= 2         # contour groove
                elif Y == cy + off + 1 and h(X, k, 19) < 210: i += 1   # its lit near lip
            if Y == 0: i = 0 if h(X, 0, 21) < 150 else 1               # toe crease where the slope meets the flat road
            elif Y == 1 and h(X, 1, 21) < 110: i = min(i, 1)
            if Y >= 30:                                                 # crest brow: lit, broken, the road's own light tone
                C = m["crest"]
                i = None; c = (C[1] if h(X, 0, 29) < 90 else C[0]) if Y == 31 else (C[0] if h(X, Y, 27) < 150 else T[top])
                px[X, Y] = c
            if i is not None: px[X, Y] = T[max(0, min(top, i))]
            if X == le or X == x0:                                     # side edges of the cut, inside the track
                if Y < 30: px[X, Y] = T[0] if h(X, Y, 33) < 200 else T[1]
            elif X == re - 1 or X == x1 - 1:
                if Y < 30: px[X, Y] = T[top] if f < 0.5 else T[top - 1]
    if "margin" in m: flank(px, W, m, (x0, x1), 3)       # grass: the flank stands in the grass margin beside the track
    else: flank(px, W, m)
    return im

def flank(px, W, m, outside=None, maxw=3):
    """the cut's side flanks: the slope stands out of the low ground, so each side shows a sliver of its flank in the cliff's own
    material, widest where the cut leaves the terrace (bottom) and running out to nothing at the far foot (top) — the wedge is
    what says the height falls away from the viewer. Counted outward from the surface edge: lit/shade rim next to the surface,
    a dark outline outermost. outside=(x0, x1): grow out into the margin beside a track; None: eat inward from the piece edges.
    (self VQA r2: an outline that started at a fixed outer column stood apart from the track like fence posts.)"""
    Fc = m["flank"]
    for Y in range(32):
        fw = round(maxw * (Y - 2) / 29) if Y > 2 else 0
        for k in range(fw):
            if outside: L, Rr = outside[0] - 1 - k, outside[1] + k
            else: L, Rr = fw - 1 - k, W - fw + k
            if k == fw - 1: lc = rc = Fc[0]
            else:
                lc = Fc[1] if h(L, Y, 91) < 210 else Fc[0]
                rc = Fc[3] if k == 0 else (Fc[2] if h(Rr, Y, 93) < 200 else Fc[1])
            px[L, Y] = lc; px[Rr, Y] = rc

# ---------------------------------------------------------------- stairs
def curbs(px, W, m, f_of):
    """thin stringers on both sides of the flight; shaded left, lit right; darken toward the far end."""
    C, cw = m["curb"], m["curbw"]
    for Y in range(32):
        f = f_of(Y)
        for j in range(cw):
            L = j; Rr = W - 1 - j
            if j == 0: lc, rc = C[0], C[0]
            elif j == cw - 1: lc, rc = C[1], C[2] if f < 0.6 else C[1]
            else: lc, rc = (C[2] if f < 0.3 else C[1]), (C[3] if f < 0.35 else (C[2] if f < 0.8 else C[1]))
            if Y >= 30 and j > 0: lc, rc = C[2], C[3]                      # curb ends at the crest: lit caps
            if Y == 0 and j > 0: lc, rc = C[1], C[1]
            px[L, Y] = lc; px[Rr, Y] = rc

def stairs(style, w, rise):
    m = M[style]; W = w * 16
    im = Image.new("RGB", (W, 32)); px = im.load()
    n = 2 * rise; B = bands(n); cw = m["curbw"]
    x0, x1 = cw, W - cw
    painter = {"peat-steps": tread_log, "snow-steps": tread_snow}.get(style, tread_stone)
    for (y0, y1, j) in B:
        f = j / max(1, n - 1)                                           # 0 near tread (bottom) .. 1 far tread (top)
        painter(px, m, x0, x1, y0, y1, j, f, rise)
    # crest (row 31): the terrace edge where the flight starts — the lip, interrupted by the cut's lit nosing
    painter_crest(px, m, style, x0, x1)
    # foot (row 0): the low road just beyond the last riser, in its shadow
    # (self VQA r4: the darkest stone here closed the flight into a framed box; the shadow lies on the low ROAD, so road tones)
    F = m["stone"][1:3] if style == "grass-steps" else m["road"][0:2]
    for X in range(x0, x1): px[X, 0] = F[0] if h(X, 0, 31) < 200 else F[1]
    curbs(px, W, m, lambda Y: 1 - Y / 31)
    flank(px, W, m)
    return im

def painter_crest(px, m, style, x0, x1):
    S = m.get("stone") or m["wood"]
    for X in range(x0, x1):
        if style == "peat-steps": c = S[5] if h(X, 31, 3) < 170 else S[4]
        elif style == "snow-steps": c = m["snow"][4] if h(X, 31, 3) < 150 else m["snow"][3]
        else: c = S[-1] if h(X, 31, 3) < 160 else S[-2]
        px[X, 31] = c

def slab_edges(x0, x1, j, rise, k=41):
    step = (4, 6) if rise <= 2 else (5, 7)
    edges, x = [x0], x0 + 2 + (j * 3) % 4
    while x < x1 - 3: edges.append(x); x += step[0] + h(x, j, k) % (step[1] - step[0] + 1)
    edges.append(x1); return edges

def tread_stone(px, m, x0, x1, y0, y1, j, f, rise):
    """a tread of dressed stone slabs seen from above: lit nosing (top row = far edge), slab body, the next-higher riser's shadow
    (bottom row). r1 VQA (self): full-height two-tone-dark joints on 13 px deep treads read as a fence/grate and the far tread went
    near-black. Now joints are one tone down and stop short of nosing and shadow, deep treads are two courses of slabs with offset
    joints, and the far end is at most one tone deeper (plus a darker dither) so it stays stone, not a hole."""
    S = m["stone"]; top = len(S) - 1
    ht = y1 - y0
    rough = len(S) == 8                                                 # cave: rough stone, ragged nosing
    courses = [(y0 + 1, y1 - 1)] if ht < 10 else [(y0 + 1, y0 + 1 + (ht - 2) // 2), (y0 + 1 + (ht - 2) // 2, y1 - 1)]
    base = top - 2 if not rough else top - 3                            # body tone
    for X in range(x0, x1):
        jag = (1 if h(X // 2, j, 53) < 80 else 0) if rough and ht >= 4 else 0
        for Y in range(y0, y1):
            r = Y - y0
            dd = round(1.2 * f)                                                  # far treads a whole tone deeper (per tread: no checker)
            if r == jag:                                                 # nosing (far edge, lit)
                c = S[top - dd] if not (rough and h(X, Y, 57) < 60) else S[top - 1 - dd]
            elif r < jag: c = S[1]                                       # ragged nosing: a bite of shadow above it
            elif r == ht - 1 and ht >= 3: c = S[0] if h(X, Y, 59) < 210 else S[1]   # shadow of the riser below/in front
            else:
                ci = 0 if len(courses) == 1 or Y < courses[1][0] else 1
                edges = slab_edges(x0, x1, 2 * j + ci, rise)
                e = max(i for i in range(len(edges)) if edges[i] <= X); sx = edges[e]; ex = edges[min(e + 1, len(edges) - 1)]
                sv = 1 if h(sx, 2 * j + ci, 51) < 70 else 0
                b = base - dd - sv
                if r == jag + 1 or (ci == 1 and Y == courses[1][0]): b += 1     # bevel under the nosing / course edge
                if ci == 1 and Y == courses[1][0] - 1: b -= 1                   # course joint
                q = h(X, Y, 43)
                if q < (25 if not rough else 45): b -= 1
                elif q > 244: b += 1
                if X == sx and sx != x0 and r > jag + 1 and r < ht - 2: b -= 1   # slab joint, one tone, short of the edges
                if ht >= 6 and r == ht - 2: b -= 1                              # shade deepens toward the riser shadow
                c = S[max(1, min(top, b))]
            px[X, Y] = c
    for Y in range(y0, y1):                                               # crease against the stringers
        r = Y - y0
        if 0 < r < ht - 1: px[x0, Y] = S[1]

def tread_snow(px, m, x0, x1, y0, y1, j, f, rise):
    """blue-grey stone tread with snow lying on it: bare lit stone nosing, a clean drift filling the tread behind it with a gently
    scalloped edge, blue shadow at the riser foot. One snow tone per tread (far treads one tone bluer), no flecks (self VQA r3:
    random drift depths and flecks read as noise, not snow)."""
    tread_stone(px, m, x0, x1, y0, y1, j, f, rise)
    Sn = m["snow"]; ht = y1 - y0
    tone = 3 if f < 0.5 else 2
    for X in range(x0 + 1, x1 - 1):
        lip = (ht // 2 if ht >= 10 else 2) if ht >= 6 else 1             # bare stone under the nosing (deep treads: front half)
        if ht >= 6 and h(X // 4, j, 71) < 110: lip += 1                   # scalloped drift edge, 4 px scallops
        for Y in range(y0 + lip, y1 - 1):
            px[X, Y] = Sn[tone] if Y > y0 + lip or ht < 6 else Sn[tone - 1]
        St = m["stone"]
        px[X, y1 - 1] = St[2] if ht >= 3 else px[X, y1 - 1]               # cold shadow at the riser foot (stone shows through)
        if ht >= 6: px[X, y1 - 2] = Sn[tone - 1]
        if 2 <= lip < 4: px[X, y0 + 1] = St[4]                                # bare stone under the lit nosing

def tread_log(px, m, x0, x1, y0, y1, j, f, rise):
    """log step: a round log laid across the path (its top lit = the nosing), packed peat path behind it, the next log's shadow."""
    Wd, T = m["wood"], m["road"]; ht = y1 - y0
    d = 0 if f < 0.34 else (1 if f < 0.75 else 2)
    lg = 2 if ht <= 5 else (3 if ht < 12 else 4)                          # log thickness on screen
    for X in range(x0, x1):
        for Y in range(y0, y1):
            r = Y - y0
            if r < lg:                                                     # the log, seen from above: lit crown, darker flank
                c = Wd[5 - d] if r == 0 else (Wd[4 - d] if r == 1 and lg >= 3 else Wd[3 - d])
                if h(X, Y, 81) < 40: c = Wd[max(0, 3 - d)]                 # bark grain
                if r == lg - 1: c = Wd[2 - min(d, 1)]
            elif r == ht - 1: c = Wd[0] if h(X, Y, 83) < 210 else Wd[1]     # shadow under the higher log
            else:
                b = 4 - d - (1 if r == ht - 2 else 0)                          # packed path behind the log
                q = h(X, Y, 85)
                c = T[b] if q < 180 else T[max(0, b - 1)]
                if q > 245: c = T[min(5, b + 1)]
            px[X, Y] = c
    # log ends: end grain poking out over the sides of the path
    for Y in range(y0, min(y1, y0 + lg)):
        px[x0, Y] = Wd[4] if Y == y0 else Wd[2]
        px[x1 - 1, Y] = Wd[5] if Y == y0 else Wd[3]

# ---------------------------------------------------------------- output
def check(style, im, ok):
    bad = set(im.get_flattened_data()) - ok
    if bad: raise SystemExit(f"{style}: colour outside the style's probe/spec palette: {['#%02x%02x%02x' % c for c in sorted(bad)][:8]}")

def main(out=HERE):
    allp = {}
    for style in STYLES:
        ok = allowed(style); os.makedirs(f"{out}/{style}", exist_ok=True)
        pieces, ims = {}, []
        for kind in ("ramp", "stairs"):
            for rise in (1, 2, 3, 4):
                for w in (2, 3):
                    im = (ramp if kind == "ramp" else stairs)(style, w, rise); check(style, im, ok)
                    im.save(f"{out}/{style}/{kind}-h{rise}-w{w}.png"); ims.append(im)
                    pieces[f"{kind}:s:{w}x{rise + 2}:{rise}"] = {"w": im.width, "h": im.height, "rgba": [v for p in im.get_flattened_data() for v in (*p, 255)]}
        allp[style] = pieces
        K, gap = 8, 12
        Wt = sum(i.width * K + gap for i in ims[:8]) + gap
        sheet = Image.new("RGB", (Wt, 2 * (32 * K + gap) + gap), (24, 24, 30))
        for row in range(2):
            x = gap
            for i in ims[row * 8:(row + 1) * 8]:
                sheet.paste(i.resize((i.width * K, i.height * K), Image.NEAREST), (x, gap + row * (32 * K + gap))); x += i.width * K + gap
        sheet.save(f"{out}/sheet-{style}.png")
    json.dump(allp, open(f"{out}/pieces.json", "w"))
    print(sum(len(v) for v in allp.values()), "pieces ->", out)

if __name__ == "__main__":
    main(*sys.argv[1:])
