"""Hand-pixel redraw of the atlas_biome_interior stair kits (2026-10-22, user: 「계단들이 다 씹창」).

Same ids, footprints, cells and tile numbers as the shipped kits — rebake.py pastes these over the tiles they already own.
Colours come only from the shared interior palette v6 ramps (iplib.K); light from the upper left.

Reading rules (tiledata/stairs/overrides.json + openwiki/stair-entrance-contract.md):
  UP   (올라가는 계단)  — stands against the north wall, covers the two wall-face rows. Seen from the south you see each
         step's RISER (vertical face, darker band) under its TREAD (light band, brightest nosing row at the front edge).
         Treads climb north toward a dark opening in the ceiling; the run narrows a little toward the top (perspective)
         and darkens as it goes up into the shade of the upper floor. Side cheeks / handrails frame it.
  DOWN (내려가는 계단)  — a hole in the floor. The south edge is floor level (the walker steps in from the south);
         risers face away from the viewer and are hidden, so each tread shows a lit lip on its NORTH edge and a dark
         shadow band at its SOUTH end (under the lip of the step above). Each lower tread is darker and narrower, the far
         (north) end is near-black. A guard rail runs along the west, north and east sides; newel posts at the south
         corners mark the entry.

  python3 scripts/content/hand-interior/stairs/draw.py [outdir]   # writes <id>.png per kit (default tiledata/hand-interior/stairs/)
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'content', 'interior-plus'))
from iplib import Cv, K  # noqa: E402

OUT = os.path.join(ROOT, 'tiledata', 'hand-interior', 'stairs')


def hx(h):
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# Material ramps taken from the colours the rooms already use (all are palette v6 colours, dark → light):
# warm purple-grey dungeon/cellar stone (hand-dungeon floor 766e74/68656a/5b5960/524c51) and the manor plank floor (s7).
DST = [hx(h) for h in ('110f12', '1e1c1a', '2e2630', '433f46', '524c51', '5b5960', '68656a', '766e74', '86848e', 'a4a2aa', 'ccc6ca')]
WDF = [hx(h) for h in ('1a0e06', '2a180b', '371f10', '452a17', '57391c', '614428', '78522e', '885e35', 'a96948', 'c49e6d', 'e0c89c')]
MOSS = hx('2e5a2a')


# dark slate tones of palette v6 (blue-tinted) — the stone pieces' silhouette ring uses these, so the outline is a dark
# tone of the cool stone and not a colourless black line (object-gate style rule: tinted outlines, not near-black).
SLATE = [hx(h) for h in ('1a2430', '2f343e', '333942', '40454f', '4a4a58', '585866', '6c5c66')]


def tint_edges(img):
    """Recolour near-neutral dark pixels on the silhouette ring (bottom contact row excluded) to the nearest slate tone."""
    px = img.load(); W, H = img.size
    a = lambda x, y: 0 <= x < W and 0 <= y < H and px[x, y][3] >= 128
    hits = []
    for y in range(H):
        for x in range(W):
            if not a(x, y) or (a(x - 1, y) and a(x + 1, y) and a(x, y - 1) and a(x, y + 1)): continue
            if a(x - 1, y) and a(x + 1, y) and a(x, y - 1) and not a(x, y + 1): continue
            r, g, b, al = px[x, y]
            if max(r, g, b) >= 110 or max(r, g, b) - min(r, g, b) > 12: continue
            hits.append((x, y, max(r, g, b), al))
    for x, y, v, al in hits:
        t = min(SLATE, key=lambda c: abs(max(c) - max(v, 48)))
        px[x, y] = t + (al,)
    return img


def S(r, i):
    return r[max(0, min(len(r) - 1, i))]


# ───────────────────────────── UP: straight flight into the north wall (3 cells wide, 3 rows: 2 wall + 1 floor)
def stairs_up(mat):
    W, H = 48, 48
    c = Cv(W, H)
    M = DST if mat == 'stone' else WDF
    # (tread rows, riser rows) bottom → top; parallel 3/4 — no taper. Treads 4 rows (3 plane + nosing) over 2-row risers.
    top, steps = 15, [(5, 2), (4, 2), (4, 2), (3, 2), (3, 2), (2, 2)]   # treads foreshorten as the flight rises away
    assert sum(a + b for a, b in steps) == H - top
    XL, XR = 8, 39                             # the run (constant width)
    # cheeks / stringers (outside the rails)
    for y in range(H):
        for x in list(range(0, 6)) + list(range(42, 48)):
            if mat == 'stone':
                course = y // 6
                joint = (y % 6 == 5) or ((x + (3 if course % 2 else 0)) % 6 == 0 and 0 < x < 47)
                col = S(M, 2) if joint else S(M, 4 if x < 24 else 3)
                if x == 5: col = S(M, 7)
                if x == 42: col = S(M, 5)
                if x in (0, 47): col = S(M, 1)
            else:
                plank = (x % 3 == 0)
                col = S(M, 4) if plank else S(M, (6 if x < 24 else 5) + (1 if (x * 7 + y // 5 * 3) % 11 == 0 else 0) - (1 if (x * 3 + y // 4 * 5) % 13 == 0 else 0))
                if x in (1, 43): col = S(M, 8)                        # lit west edge of each stringer panel
                if x in (4, 46): col = S(M, 3)
                if x in (0, 47): col = S(M, 1)
            if y >= 32:                                           # floor row: the cheek's own block, capped, plain face
                col = S(M, 8 if mat == 'stone' else 4) if y == 32 else S(M, 5 if x < 24 else 4) if y < 36 else S(M, 4 if x < 24 else 3) if y < H - 1 else S(M, 1)
                if mat == 'wood' and 32 < y < H - 1: col = S(M, 4 if x % 3 else 3)
                if mat == 'stone' and 32 < y < H - 1 and ((y - 33) % 5 == 4 or (x + (3 if (y - 33) // 5 % 2 else 0)) % 6 == 0): col = S(M, 3)
                if mat == 'stone' and 32 < y < H - 1 and (x * 3 + y * 5) % 17 == 0: col = S(M, 6)
            c.p(x, y, col)
    # opening into the upper floor: near-black, arch (stone) or lintel beam (wood) on top, the next step dimly inside
    for y in range(0, top):   # the dark stairwell above: near-black with a faint cool dither (the upper landing in shadow)
        for x in range(6, 42): c.p(x, y, (SLATE[0] if mat == 'stone' else S(M, 0)) if y > 4 and (top - 1 - y) % 4 == 2 else K('black', 0))   # faint step edges of the flight going on up in the dark
    for x in range(XL, XR + 1):
        c.p(x, top - 3, S(M, 1)); c.p(x, top - 2, S(M, 2)); c.p(x, top - 1, S(M, 2))
    if mat == 'stone':
        for x in range(6, 42):
            d = min(x - 6, 41 - x)
            h = max(0, 7 - d // 2)
            for y in range(3, h):
                c.p(x, y, S(M, 4) if y < h - 1 else S(M, 7))     # arch voussoirs with a lit soffit edge
        for x in range(0, 48):   # coping stone over the opening: 2-row top plane (speckled), lit front-edge line, shadow
            sp = (x * 5) % 9 == 0
            c.p(x, 0, S(M, 7) if sp else S(M, 8)); c.p(x, 1, S(M, 8) if sp else S(M, 9)); c.p(x, 2, S(M, 10))
            c.p(x, 3, S(M, 3))
        c.p(0, 0, S(M, 3)); c.p(47, 0, S(M, 3))
    else:
        for x in range(0, 48):   # lintel beam: 2-row top plane (grain), lit front-edge line, face, eave shadow
            g = (x * 5) % 7 == 0
            c.p(x, 0, S(M, 7) if g else S(M, 8)); c.p(x, 1, S(M, 8) if g else S(M, 9)); c.p(x, 2, S(M, 10))
            c.p(x, 3, S(M, 5) if 0 < x < 47 else S(M, 2)); c.p(x, 4, S(M, 2) if x < 6 or x > 41 else K('black', 0))
        c.p(0, 0, S(M, 3)); c.p(47, 0, S(M, 3))
    # steps: tread (2 plane rows + brightest nosing row at its front/south edge), riser (shadow row under the nosing + face)
    y = H
    n = len(steps)
    for i, (t, r) in enumerate(steps):
        y0 = y - (t + r); y = y0
        dark = 0 if i < 3 else 1 if i < n - 2 or mat == 'stone' else 2   # higher steps sink into the shade of the upper floor
        if mat == 'stone':   # values fall off as the flight climbs into the dark; no bright nosing on the top two
            TP, TN = S(M, [8, 8, 7, 7, 6, 5][i]), S(M, [10, 9, 9, 8, 7, 6][i])
            RS, RF = S(M, 2 if i < 4 else 1), S(M, [5, 5, 4, 3, 2, 2][i])
        else:   # brown ramp only (no salmon): plane 885e35/78522e, nosing c49e6d/885e35, riser 452a17/371f10
            TP = [S(M, 7), S(M, 7), S(M, 6), S(M, 6), S(M, 5), S(M, 4)][i]
            TN = [S(M, 9), S(M, 9), hx('9a6a38'), S(M, 7), S(M, 6), S(M, 5)][i]
            RS, RF = S(M, 0), [S(M, 2), S(M, 2), S(M, 2), S(M, 1), S(M, 1), S(M, 1)][i]
        for yy in range(y0, y0 + t + r):
            k = yy - y0
            if k < t: col = TN if k == t - 1 else TP                    # tread plane; brightest row = front nosing
            else: col = RS if k == t else RF                            # shadow row under the nosing, then the riser face
            ins = [0, 0, 1, 1, 2, 2][i]                                 # upper treads tuck in a little: the flight recedes
            for x in range(6, 42):
                cc = col
                if x in (6, 7, 40, 41): cc = S(M, 3)
                elif x < XL + ins: cc = S(M, 2)
                elif x > XR - ins: cc = S(M, 4)
                c.p(x, yy, cc)
    for x in range(6, 42): c.p(x, H - 1, S(M, 2))                     # contact with the floor
    # handrails: straight vertical 2 px (west lit, east shaded), from the newels to the opening
    for yy in range(top - 2, H - 7):
        c.p(6, yy, S(M, 9)); c.p(7, yy, S(M, 4))
        c.p(40, yy, S(M, 2)); c.p(41, yy, S(M, 5))

    # newel posts at the foot: 3 wide, light cap, lit west face, dark south foot
    for (x0, lit) in ((5, True), (40, False)):
        for yy in range(H - 7, H):
            c.p(x0, yy, S(M, 9 if lit else 6)); c.p(x0 + 1, yy, S(M, 7 if lit else 5)); c.p(x0 + 2, yy, S(M, 4 if lit else 3))
        for x in range(x0, x0 + 3): c.p(x, H - 8, S(M, 9 if mat == 'stone' else 8)); c.p(x, H - 1, S(M, 1))
        c.p(x0 - 1 if x0 > 5 else x0 + 3, H - 8, S(M, 1))
    return c.img()


# ───────────────────────────── DOWN: a hole in the floor, entered from the south
def stairs_hole(w_cells, mat):
    W, H = w_cells * 16, 32
    c = Cv(W, H)
    M = DST if mat == 'stone' else WDF
    RAIL = M
    hx0, hx1 = 4, W - 5            # pit columns
    # rows: 0..2 cap rail, 3..5 balusters, 6..8 north floor lip, 9..27 the pit, 28..31 the south floor lip (entry, flush
    # with the floor). Inside the pit, north → south: the lit face of the north pit wall, a solid black void, then the
    # flight rising toward the viewer — the far tread almost black, the near tread mid-tone (never floor-light).
    PIT0, PIT1 = 9, H - 1           # the first tread runs to the south edge: flush with the floor, open to the walker
    FLOOR, FLOOR_D, LIT = (S(M, 7), S(M, 6), S(M, 9)) if mat == 'stone' else (S(M, 5), S(M, 4), S(M, 8))
    # north floor lip
    for x in range(hx0 - 1, hx1 + 2):
        c.p(x, 6, FLOOR_D if mat == 'stone' else FLOOR); c.p(x, 7, FLOOR if mat == 'stone' else FLOOR_D); c.p(x, 8, LIT)
    # the pit: the flight descends north. Seen from above only the tread tops show (risers face north, away); the near
    # tread is at floor value, each tread further north is one step darker and shorter, a 1px shadow line where each
    # tread drops to the next, the pit funnels 1px per side per tread, and the far end sinks to near-black. Row 9 is
    # the north lip's cast shadow on the void.
    treads = [6, 4, 3, 3, 2]       # south → north
    if mat == 'stone':
        PLANE = [S(M, 6), S(M, 5), S(M, 4), S(M, 3), S(M, 1)]
        LINE = [S(M, 2), S(M, 1), S(M, 0), K('black', 0)]
    else:
        # lit treads inside a dark well (the manor 2F floor itself is mid-dark plank, so the treads must be lighter)
        PLANE = [hx('9a6a38'), hx('6c4c2a'), S(M, 4), S(M, 3), S(M, 0)]
        LINE = [S(M, 2), S(M, 1), S(M, 0), K('black', 0)]
    band = {}
    y = PIT1 + 1
    NOSE = [S(M, 9), S(M, 7), S(M, 6), S(M, 5)] if mat == 'wood' else []
    for i, th in enumerate(treads):
        for k in range(th):
            y -= 1; band[y] = (NOSE[i] if k == th - 1 and i < len(NOSE) else PLANE[i], i)
        if i < len(LINE):
            y -= 1; band[y] = (LINE[i], i + 1)
    for yy in range(PIT0, y): band[yy] = (K('black', 0), len(treads))
    for yy in range(PIT0, PIT1 + 1):
        col, i = band[yy]
        cw = 1 + i + (1 if mat == 'wood' else 0)                     # funnel: side pit walls widen going north
        WD = (S(M, 1), S(M, 2), S(M, 3)) if mat == 'stone' else (K('black', 0), S(M, 0), S(M, 1))   # wood: near-black well
        for x in range(hx0, hx1 + 1):
            if x < hx0 + cw: cc = (WD[0] if yy % 4 else WD[1]) if x < hx0 + cw - 1 or i == 0 else WD[1]   # well-wall boards
            elif x > hx1 - cw: cc = WD[1] if x > hx1 - cw + 1 or i == 0 else WD[2]
            else:
                cc = col
                if i <= 1 and col == PLANE[i]:                         # grain on the near treads (no flat slabs)
                    if mat == 'stone' and (x * 3 + yy * 5) % 11 == 0: cc = S(M, 5 + (x + yy) % 2 * 2 - i)
                    if mat == 'wood' and (x - hx0 + (yy // 2) * 5) % 8 == 0: cc = S(M, 6 - 2 * i)
            c.p(x, yy, cc)
    # W/E floor lips along the pit
    for yy in range(PIT0, PIT1 + 1):
        c.p(hx0 - 1, yy, S(M, 8 if mat == 'stone' else 6)); c.p(hx1 + 1, yy, S(M, 5 if mat == 'stone' else 4))
    # guard rail: cap rail (lit top, dark under) on 1px balusters (north); side rails W/E; newel posts at the south corners
    RT, RP, RD = (S(RAIL, 2), S(RAIL, 6), S(RAIL, 1)) if mat == 'stone' else (S(RAIL, 3), S(RAIL, 8), S(RAIL, 1))
    if mat == 'stone':   # low iron-grey guard: thin mid-grey cap over 1px balusters, the room floor shows between them
        for x in range(hx0 - 2, hx1 + 3): c.p(x, 0, S(RAIL, 5)); c.p(x, 1, S(RAIL, 2))
        for x in list(range(hx0 - 2, hx1 + 3, 6)) + [hx1 + 2]:
            for yy in range(2, 6): c.p(x, yy, S(RAIL, 4) if x < W // 2 else S(RAIL, 3))
    else:
        for x in range(hx0 - 2, hx1 + 3): c.p(x, 0, RP); c.p(x, 1, RT); c.p(x, 2, RD)
        for x in list(range(hx0 - 2, hx1 + 3, 6)) + [hx1 + 2]:
            for yy in range(3, 6): c.p(x, yy, RP if x < W // 3 else S(RAIL, 7) if x < 2 * W // 3 else S(RAIL, 5))
    end = PIT1 - 4
    for (x0, side) in ((hx0 - 2, -1), (hx1 + 2, 1)):
        for yy in range(0, end): c.p(x0, yy, RP if side < 0 else S(RAIL, 4))
        xi = x0 + (1 if side < 0 else -1)
        for yy in range(end, PIT1 + 1):                                 # 2px newel post: lit west face, dark east face
            c.p(x0, yy, RP if side < 0 else S(RAIL, 4)); c.p(xi, yy, S(RAIL, 4) if side < 0 else RD)
        c.p(x0, end - 1, S(RAIL, 8)); c.p(xi, end - 1, S(RAIL, 7))
        for yy in range(4, end - 2, 6): c.p(xi, yy, S(RAIL, 3 if mat == 'stone' else 5))   # side-rail posts
    return c.img()


# ───────────────────────────── UP: spiral stair (2x2 floor + 32 px rising), entered at the bottom-left tread from the south
def spiral_stair():
    import math
    W, H = 32, 64
    c = Cv(W, H)
    cx, cy, R, r0, sq = 15.5, 52.0, 15.2, 1.0, 0.62
    N, A0, DA, DZ = 8, 95.0, 45.0, 5.0
    SR = DST
    def wedge(i):
        a0, z = A0 + i * DA, round(i * DZ)
        out = {}
        for y in range(-10, H + 10):
            for x in range(W):
                dy = (y - cy) / sq
                rr = math.hypot(x - cx, dy)
                if not (r0 <= rr <= R + .3): continue
                a = (math.degrees(math.atan2(dy, x - cx)) + 360) % 360
                u = (a - a0) % 360
                if u < DA - 4: out[(x, y - z)] = (rr, u, a)
        return out
    def post():
        for y in range(2, int(cy) + 2):
            for k, x in enumerate(range(14, 18)):
                c.p(x, y, S(SR, [8, 7, 5, 3][k]))
        for x in range(13, 19): c.p(x, 1, S(SR, 10)); c.p(x, 2, S(SR, 8))
        for x in range(13, 19): c.p(x, int(cy) + 2, S(SR, 1))
    mids = [math.sin(math.radians(A0 + i * DA + DA / 2)) for i in range(N)]
    order = sorted(range(N), key=lambda i: (mids[i], i))
    done = False
    for i in order:
        if mids[i] > 0 and not done: post(); done = True
        P = wedge(i)
        a_mid = A0 + i * DA + DA / 2
        lit = 0.5 + 0.5 * math.cos(math.radians(a_mid - 225))
        base = 9 if i == 0 else (8 if lit > 0.5 else 7)
        for (x, y), (rr, u, a) in P.items():                 # 2 px slab edge below the top (front face, dark)
            for d in (1, 2, 3):
                if (x, y + d) not in P:
                    c.p(x, y + d, S(SR, (5 if d < 3 else 2) if math.sin(math.radians(a)) > 0 else 2))
        for (x, y), (rr, u, a) in P.items():
            edge = any((x + dx, y + dy) not in P for dx, dy in ((1, 0), (-1, 0), (0, -1)))
            col = S(SR, base)
            if rr > R - 1.2: col = S(SR, base - 3)       # outline the wedge so it separates from the wall
            if u < 2.0: col = S(SR, 10)                          # leading front edge of the tread
            c.p(x, y, col)
    if not done: post()
    # outer rail along the near treads' outer tips, continuous, 1px light over 1px dark
    pts = []
    for i in range(N):
        a = math.radians(A0 + i * DA + DA / 2)
        if math.sin(a) < -0.35: pts.append(None); continue
        pts.append((round(cx + (R - 1) * math.cos(a)), round(cy + (R - 1) * math.sin(a) * sq) - round(i * DZ) - 8))
    for i in range(N):
        if not pts[i]: continue
        x, y = pts[i]
        for yy in range(y, y + 8): c.p(x, yy, S(SR, 3))       # baluster
        if i + 1 < N and pts[i + 1]:
            (x1, y1) = pts[i + 1]; n = max(abs(x1 - x), abs(y1 - y), 1)
            for k in range(n + 1):
                px, py = round(x + (x1 - x) * k / n), round(y + (y1 - y) * k / n)
                c.p(px, py, K('iron', 5)); c.p(px, py + 1, K('iron', 1))
    return c.img()


KITS = {
    'stairs up stone': lambda: tint_edges(stairs_up('stone')),
    'stairs up wood': lambda: stairs_up('wood'),
    'stairs down': lambda: tint_edges(stairs_hole(2, 'stone')),
    'stairwell down': lambda: stairs_hole(3, 'wood'),
    # 'spiral stair' keeps its shipped art (procedural helix did not read at 16px; see openwiki)
}


def build():
    return {k: f() for k, f in KITS.items()}


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else OUT
    os.makedirs(out, exist_ok=True)
    for k, im in build().items():
        p = os.path.join(out, k.replace(' ', '_') + '.png'); im.save(p); print(p, im.size)
