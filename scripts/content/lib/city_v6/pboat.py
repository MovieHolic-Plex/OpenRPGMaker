# boats that sit IN the water + chimney smoke, drawn to the jungle chipset (16px, front-above view).
# Geometry: every hull is one plan outline w(u) seen from the front-above. Deck/hollow = the outline foreshortened
# (far edge cy-D*w, near edge cy+D*w); the side face hangs from the near edge down to the WATERLINE, which is the same
# outline shifted down by the freeboard F. Below the waterline the hull is not drawn in wood: it is re-toned with the
# water ramp (a darker submerged shape broken by ripple dashes), a dark band hugs it, a light ripple ring runs round
# the waterline and small rings spread at bow / stern / oar blades. Only the water pass changes between frames.
import sys, os, math; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import px2, palette
from px2 import C, _hash
palette.apply()
for _m in list(px2.PAL):                      # outline = the material's own darkest ramp tone, not the near-black OUT
    if len(px2.PAL[_m]) == 7: px2.PAL[_m] = [px2.PAL[_m][1]] + px2.PAL[_m][1:]

def hx(s): return tuple(int(s[i:i+2], 16) for i in (1, 3, 5))
WR = [hx(c) for c in palette.RAMPS_CHIP['water']]      # 0 #143a27 1 #1c4a44 2 #21584e(=water) 3 #3fa2ae 4 #7d98a2 5 #a7d4db
ST = [hx(c) for c in palette.RAMPS_CHIP['stone']]
WD = [hx(c) for c in palette.RAMPS_CHIP['wood']]

BOATS = {'rowboat': (2, 1), 'fishing': (3, 3), 'ship': (10, 7), 'barge': (3, 2)}

# ---------------------------------------------------------------- hull
def hull(c, cx, L, cy, D, F, w, sheer=0.0, raise_=None, deck='deck', seed=0):
    """draw deck/hollow + side face; return {x: waterline_y}, {x: (far, near)}"""
    wl = {}; edge = {}
    c.group(1); c.new()
    for x in range(c.w):
        u = (x + 0.5 - cx) / L
        if abs(u) > 1: continue
        ww = w(u); r = raise_(x) if raise_ else 0
        s = sheer * u ** 4 + r
        far = cy - s - D * ww; near = cy - s + D * ww
        uw = u / 0.97
        wwl = w(uw) * 0.9 if abs(uw) <= 1 else 0
        wly = int(round(cy + F + D * wwl)); wl[x] = wly
        fy, ny = int(round(far)), int(round(near)); edge[x] = (fy, ny)
        endshade = -0.18 * max(0, u - 0.6) / 0.4 + 0.08 * max(0, -u - 0.7) / 0.3
        for y in range(fy, ny + 1):                      # top: deck planks or the hollow
            t = (y - fy) / max(1, ny - fy)
            if deck == 'hollow':
                k = y - fy
                c.tone(x, y, 'wood', 3 if k <= 1 else ((1 if k % 2 == 0 else 2) if y < ny - 1 else 2))
                continue
            else:
                v = 0.86 - 0.1 * t
                if (y - fy) % 2 == 1 and 0 < y - fy < ny - fy - 1: v -= 0.13     # plank seams
            c.setv(x, y, 'wood', v + endshade)
        for y in range(ny + 1, wly + 1):                  # side face, strakes
            k = y - ny
            if deck == 'hollow':
                c.tone(x, y, 'wood', max(1, (4 if k == 1 else 3 if k == 2 else 2) - (1 if u > 0.7 else 0))); continue
            v = 0.55 - 0.03 * k + endshade
            if k % 3 == 0: v -= 0.16
            c.setv(x, y, 'wood', v)
        if deck != 'hollow' and ny - fy >= 4: c.tone(x, fy + 1, 'wood', 3)    # far bulwark inner face
        c.tone(x, fy, 'wood', 5 if u < 0.3 else 4)                             # lit rims
        c.tone(x, ny, 'wood', 6 if u < 0.2 else 5)
    return wl, edge

def w_boat(u): return max(0.0, 1 - abs(u) ** 2.2) ** 0.6
def w_ship(u):
    if u > 0.45: return max(0.0, 1 - ((u - 0.45) / 0.55) ** 2) ** 0.55
    if u < -0.9: return max(0.0, 1 - ((-u - 0.9) / 0.1) ** 2) ** 0.5 * 0.35 + 0.65
    return 1.0
def w_barge(u):
    a = abs(u)
    return 1.0 if a < 0.78 else max(0.0, 1 - (a - 0.78) / 0.22 * 0.3)

# ---------------------------------------------------------------- water pass
def water_pass(im, wl, frame, sub=2, rings=(), ring_pad=(3, 3), bob=(0, 0, 1, 0), extra_sub=()):
    """im: RGBA hull; wl: {x: waterline}. Returns a new RGBA with the submerged look + water effects."""
    W, H = im.size; px = im.load()
    b = bob[frame % 4]
    out = Image.new('RGBA', (W, H)); o = out.load()
    for y in range(H):
        for x in range(W): o[x, y] = px[x, y]
    xs = sorted(wl); xa, xb = xs[0], xs[-1]
    hullmask = set()
    # 1. submerged hull: rows below the waterline, tapering, in the water ramp; ripple dashes cross it
    for x in xs:
        wy = wl[x] - b
        taper = min(x - xa, xb - x)
        depth = min(sub, taper // 2 + 1)
        for y in range(wy + 1, min(H, wy + 1 + depth)):
            d = y - wy
            col = WR[0] if d == 1 else (WR[0] if (x + y) % 2 else WR[1])
            if d == 1 and (x * 3 + frame) % 4 == 0: col = WD[0]            # a hint of wood just under the surface
            if (x + 2 * frame + d * 3) % 7 == 0: col = WR[2]                 # ripple breaks the hull
            o[x, y] = col + (255,); hullmask.add((x, y))
        for y in range(0, wy + 1):
            if px[x, y][3]: hullmask.add((x, y))
        # waterline: light dashes lapping on the hull face
        if px[x, wy][3] and (x + frame) % 5 in (0, 1, 2) and 1 < x - xa and xb - x > 1:
            o[x, wy] = WR[3] + (255,)
    for (x, y) in extra_sub: hullmask.add((x, y))
    # 2. dark band hugging the submerged outline (heavier to the lower right = shadow side)
    def near_hull(x, y, r):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if abs(dx) + abs(dy) <= r and (x + dx, y + dy) in hullmask: return True
        return False
    base = {x: wl[x] - b for x in xs}
    def below_line(x, y):
        xx = min(max(x, xa), xb); return y >= base[xx] - 1
    for y in range(H):
        for x in range(W):
            if o[x, y][3] or not below_line(x, y): continue
            if near_hull(x, y, 1): o[x, y] = WR[0] + (255,)
            elif near_hull(x - 1, y - 1, 2) and (x + y + frame) % 2 == 0: o[x, y] = WR[1] + (255,)
    # 3. light ripple ring round the waterline (hidden behind the hull), dashed, phase moves
    cx = (xa + xb) / 2; rx = (xb - xa) / 2 + ring_pad[0]
    cyr = max(wl.values()) - b + sub // 2
    for ph, (rrx, rry, colset) in enumerate(((rx, ring_pad[1] + sub // 2, (3, 3, 4)), (rx + 3, ring_pad[1] + sub // 2 + 2, (4, 1, 1)))):
        n = int(rrx * 7)
        for i in range(n):
            a = 2 * math.pi * i / n
            x = int(round(cx + rrx * math.cos(a))); y = int(round(cyr + rry * math.sin(a)))
            if not (0 <= x < W and 0 <= y < H) or o[x, y][3]: continue
            if y < base[min(max(x, xa), xb)] - 1: continue
            k = (i + frame * 2 + ph * 3) % 9
            if k < 5: o[x, y] = WR[colset[0] if k < 3 else colset[2]] + (255,)
    # 4. small spreading rings (bow, stern, oar blades): grow each frame, thin out
    for (rx0, ry0) in rings:
        rr = 1.2 + frame * 0.9; ry = max(1, rr * 0.4)
        n = int(rr * 8) + 4
        for i in range(n):
            a = 2 * math.pi * i / n
            x = int(round(rx0 + rr * math.cos(a))); y = int(round(ry0 + ry * math.sin(a)))
            if not (0 <= x < W and 0 <= y < H) or o[x, y][3]: continue
            if frame >= 2 and i % 2: continue
            o[x, y] = WR[5 if frame == 0 else 3 if frame < 3 else 4] + (255,)
    return out

# ---------------------------------------------------------------- 1. rowboat 2x1
def w_row(u): return max(0.0, 1 - abs(u) ** 1.8) ** 0.75
def _rowboat():
    c = C(32, 16, seed=11)
    wl, edge = hull(c, 16, 14.5, 7, 3.6, 2, w_row, sheer=2.6, deck='hollow')
    for x0 in (9, 20):                                     # thwarts: lit plank + its shadow on the floor
        f, n = edge[x0]; c.group(2 + x0); c.new()
        for y in range(f + 2, n):
            c.tone(x0, y, 'wood', 5); c.tone(x0 + 1, y, 'wood', 4); c.tone(x0 + 2, y, 'wood', 1)
    # a pair of oars shipped in the boat, lying fore-and-aft over the thwarts, blades toward the stern
    for i, (yy, t) in enumerate(((edge[16][0] + 3, 5), (edge[16][0] + 5, 4))):
        c.group(30 + i); c.line(9, yy, 22, yy - 1, 'rope', t if t == 5 else 3)
        c.group(32 + i)
        for x in range(22, 26): c.tone(x, yy - 1, 'rope', 5); c.tone(x, yy, 'rope', 3)
    im = c.img()
    return im, wl, [(2, 11), (30, 11)]

# ---------------------------------------------------------------- 2. fishing boat 3x3
def _fishing():
    c = C(48, 48, seed=12)
    wl, edge = hull(c, 24, 21, 34, 4, 4, w_boat, sheer=3.0, deck='deck')
    # small wheel-house at the stern (left)
    c.group(3); c.box(8, 27, 9, 3, 6, 'wood', bias=0.05)
    for y in range(24, 27):
        for x in range(7, 18): c.tone(x, y, 'clay', 4 if y == 24 else 3)             # roof: chipset roof red
    c.tone(10, 32, 'cryst', 3); c.tone(11, 32, 'cryst', 4); c.tone(14, 32, 'cryst', 3); c.tone(15, 32, 'cryst', 4)
    # mast + gaff sail aft of it, jib forward
    MX = 28
    c.group(10); c.new()
    for y in range(3, 35): c.tone(MX, y, 'wood', 5); c.tone(MX + 1, y, 'wood', 3)
    def sailv(x, y, x0, x1):
        t = (x - x0) / max(1, x1 - x0)
        v = 0.95 - 0.35 * abs(t - 0.35)
        if (x - x0) % 5 == 4: v -= 0.18                 # seams
        return v
    c.group(11); c.poly([(MX, 7), (19, 4), (18, 29), (MX, 29)], 'cream', lambda x, y: sailv(x, y, 18, MX))
    c.group(12); c.line(19, 4, MX, 7, 'wood', 4); c.line(17, 30, MX, 30, 'wood', 4)       # gaff + boom
    c.group(13); c.poly([(MX + 2, 6), (45, 28), (MX + 2, 29)], 'cream', lambda x, y: 0.72 - 0.2 * (x - MX) / 16)
    c.group(14); c.line(MX + 2, 4, 46, 28, 'rope', 2)                                   # forestay to the stem
    c.group(15)
    for (x, y, t) in ((MX + 2, 2, 4), (MX + 3, 2, 3), (MX + 4, 3, 3), (MX + 2, 3, 3)): c.tone(x, y, 'red', t)   # pennant
    # nets heaped at the bow + a basket
    c.group(16); c.ellipsoid(36, 33, 4, 1.8, 'rope', bias=0.1, bump=0.5)
    c.group(17); c.cylinder(22, 32, 34, 2.2, 'rope', bias=0.05)
    im = c.img()
    return im, wl, [(3, 41), (46, 42)]

# ---------------------------------------------------------------- 3. two-masted ship 10x7, broadside
def _ship():
    c = C(160, 112, seed=13)
    CX, L, CY, D, F = 80, 73, 78, 7, 15
    def rz(x):                                    # poop deck (stern, left) and forecastle (bow, right) raised
        if x < 40: return 8
        if x < 42: return 5
        if x > 128: return 4
        return 0
    wl, edge = hull(c, CX, L, CY, D, F, w_ship, sheer=5.0, raise_=rz, deck='deck')
    fx = lambda x: edge[x][0]; nx = lambda x: edge[x][1]
    # hull face details: wale bands, gunports with open red lids, stern windows, bow anchor
    c.group(40)
    for x in sorted(wl):
        n = nx(x)
        for y in (n + 3, n + 4):
            if y < wl[x] - 1: c.tone(x, y, 'gold', 3 if y == n + 3 else 2)
        y = n + 11
        if y < wl[x] - 1: c.tone(x, y, 'gold', 2)
    for gx in range(50, 126, 11):
        n = nx(gx); c.group(100 + gx); c.new()
        for y in range(n + 6, n + 9):
            for x in range(gx, gx + 4): c.tone(x, y, 'dark', 1 if y > n + 6 else 3)
        c.tone(gx + 1, n + 7, 'stone', 3); c.tone(gx + 2, n + 7, 'stone', 2)            # cannon muzzle
        c.group(200 + gx); c.new()
        for x in range(gx, gx + 4): c.tone(x, n + 5, 'red', 3)                           # lid swung up
    for wx in range(14, 38, 6):                                                           # stern cabin windows
        n = nx(wx); c.group(300 + wx); c.new()
        for y in range(n + 6, n + 10):
            for x in range(wx, wx + 3): c.tone(x, y, 'cryst', 4 if (y == n + 6 or x == wx) else 3)
        for x in range(wx - 1, wx + 4): c.tone(x, n + 5, 'gold', 4)
    c.group(350)
    for x in range(10, 40): c.tone(x, nx(x) + 12, 'gold', 4 if x % 2 else 3)             # gilded stern band
    # anchor on the bow face
    c.group(360); ax, ay = 136, nx(136) + 5
    c.line(ax, ay, ax, ay + 6, 'stone', 3); c.line(ax - 2, ay + 1, ax + 2, ay + 1, 'stone', 4)
    c.line(ax - 2, ay + 5, ax, ay + 7, 'stone', 2); c.line(ax + 2, ay + 5, ax, ay + 7, 'stone', 2)
    # deck furniture: hatch grating, capstan, barrels, the poop's front rail + ship's wheel
    c.group(400); c.box(84, CY - 3, 12, 3, 2, 'wood', bias=-0.05)
    for x in range(85, 95, 2): c.tone(x, CY - 2, 'wood', 1)
    c.group(401); c.cylinder(118, CY - 5, CY - 1, 2.5, 'wood', bias=0.1)
    for bx in (56, 60):
        c.group(402 + bx); c.cylinder(bx, CY - 3, CY + 1, 1.8, 'wood', bias=0.05)
    c.group(410)
    for y in range(fx(41) - 1, nx(41) + 1): c.tone(40, y, 'wood', 5); c.tone(41, y, 'wood', 3)
    c.group(411); c.ellipsoid(30, CY - 12, 3, 2.2, 'wood', bias=0.1); c.tone(30, CY - 12, 'gold', 4)
    # masts, tops, gaff sails (fore-and-aft rig: the sails lie along the hull, so they face us broadside)
    MAIN, FORE = 64, 104
    for mx, top in ((MAIN, 6), (FORE, 10)):
        c.group(500 + mx); c.new()
        base = CY - rz(mx)
        for y in range(top, base + 1):
            c.tone(mx, y, 'wood', 5); c.tone(mx + 1, y, 'wood', 4); c.tone(mx + 2, y, 'wood', 2)
        c.group(520 + mx); c.box(mx - 3, top + 14, 9, 2, 2, 'wood', bias=0.1)           # fighting top
        c.group(540 + mx)
        for (x, y, t) in ((mx + 3, top - 2, 4), (mx + 4, top - 2, 4), (mx + 5, top - 1, 3), (mx + 6, top - 1, 3),
                          (mx + 3, top - 1, 3), (mx + 4, top - 1, 3), (mx + 7, top, 3)):
            c.tone(x, y, 'red', t)                                                        # long pennants
        c.tone(mx, top - 1, 'wood', 5); c.tone(mx + 1, top - 1, 'wood', 4); c.tone(mx, top - 2, 'wood', 4)
    def sail(pts, g, x0, x1):
        c.group(g)
        def v(x, y):
            t = (x - x0) / max(1, x1 - x0)
            val = 0.98 - 0.42 * abs(t - 0.3) ** 1.2
            if (x - x0) % 6 == 5: val -= 0.16
            return val
        c.poly(pts, 'cream', v, grain=False)
    sail([(MAIN - 1, 24), (36, 16), (33, 60), (MAIN - 1, 62)], 600, 33, MAIN)             # mainsail
    c.group(601); c.line(36, 16, MAIN - 1, 24, 'wood', 4); c.line(36, 15, MAIN - 1, 23, 'wood', 3)
    c.line(31, 62, MAIN - 1, 63, 'wood', 4); c.line(31, 63, MAIN - 1, 64, 'wood', 2)
    sail([(MAIN - 1, 8), (MAIN - 1, 20), (40, 14)], 602, 40, MAIN)                        # gaff topsail
    sail([(FORE - 1, 28), (74, 21), (72, 68), (FORE - 1, 70)], 610, 72, FORE)             # foresail
    c.group(611); c.line(74, 21, FORE - 1, 28, 'wood', 4); c.line(74, 20, FORE - 1, 27, 'wood', 3)
    c.line(70, 69, FORE - 1, 70, 'wood', 4); c.line(70, 70, FORE - 1, 71, 'wood', 2)
    sail([(FORE - 1, 12), (FORE - 1, 24), (78, 19)], 612, 78, FORE)
    # bowsprit + figurehead, then jibs on the stays
    c.group(700); c.new()
    for i in range(0, 22):
        x = 146 + i; y = int(round(68 - i * 0.55))
        if x < 160: c.tone(x, y, 'wood', 5); c.tone(x, y + 1, 'wood', 3)
    c.group(701); c.ellipsoid(151, 71, 2.2, 2.6, 'gold', bias=0.1)                         # gilt figurehead
    c.tone(152, 70, 'gold', 5); c.tone(150, 73, 'gold', 2)
    sail([(FORE + 3, 14), (157, 57), (120, 66)], 710, FORE + 3, 157)                       # outer jib
    sail([(FORE + 3, 26), (140, 62), (112, 68)], 711, FORE + 3, 140)                       # staysail
    # rigging: near-side shrouds from the tops to the rail, stays fore and aft
    c.group(800)
    for mx, top in ((MAIN, 6), (FORE, 10)):
        for dx in (-6, 6):
            x1 = mx + dx; c.line(mx + (1 if dx > 0 else 0), top + 16, x1, nx(x1) - 1, 'rope', 3)
    c.line(MAIN, 7, 12, fx(12) + 1, 'rope', 1)                                           # backstay
    c.line(MAIN + 2, 8, FORE, 11, 'rope', 1)                                              # main-to-fore stay
    # stern lantern
    c.group(810); c.box(9, fx(9) - 5, 3, 1, 3, 'gold', bias=0.15)
    im = c.img()
    return im, wl, [(5, 99), (156, 97), (100, 104)]

# ---------------------------------------------------------------- 4. river barge 3x2
def _barge():
    c = C(48, 32, seed=14)
    wl, edge = hull(c, 24, 21.5, 14, 5, 4, w_barge, sheer=0.6, deck='deck')
    # cargo: two crates, sacks, a barrel; steering sweep at the stern; punt pole along the deck
    c.group(3); c.box(15, 5, 7, 3, 6, 'wood', bias=0.08)
    for x in (15, 21): c.tone(x, 9, 'wood', 2)
    c.group(4); c.box(21, 8, 6, 3, 5, 'wood', bias=0.0)
    c.group(5); c.ellipsoid(31, 12, 3.5, 2.6, 'rope', bias=0.12)
    c.group(6); c.ellipsoid(35, 13, 3.2, 2.4, 'rope', bias=0.02)
    c.group(7); c.cylinder(10, 8, 13, 2.6, 'wood', bias=0.08)
    for x in range(8, 13): c.tone(x, 11, 'stone', 3)
    c.group(8); c.line(40, 8, 40, 15, 'wood', 4); c.line(41, 8, 41, 15, 'wood', 2)      # mooring post at the bow
    c.group(9); c.line(2, 17, 7, 13, 'wood', 4); c.line(1, 18, 3, 17, 'wood', 3)         # stern sweep, blade in water
    c.line(0, 19, 2, 18, 'wood', 3)
    c.group(10); c.line(9, 18, 38, 17, 'wood', 5)                                          # pole lying on the near rail
    im = c.img()
    return im, wl, [(1, 21), (46, 22)]

_CACHE = {}
def _base(kind):
    if kind not in _CACHE: _CACHE[kind] = {'rowboat': _rowboat, 'fishing': _fishing, 'ship': _ship, 'barge': _barge}[kind]()
    return _CACHE[kind]

def boat(kind, frame):
    im, wl, rings = _base(kind)
    sub = {'rowboat': 2, 'fishing': 3, 'ship': 5, 'barge': 3}[kind]
    pad = {'rowboat': (2, 1), 'fishing': (3, 1), 'ship': (4, 2), 'barge': (2, 1)}[kind]
    return water_pass(im, wl, frame % 4, sub=sub, rings=rings, ring_pad=pad)

# ---------------------------------------------------------------- chimney smoke 16x32, 6 frames
SM = [hx(c) for c in palette.RAMPS_CHIP['stone']]       # '#2b3934' '#3e403d' '#595b58' '#929491' '#c4c6c3' '#dee0dd'
def smoke(frame):
    W, H = 16, 32; im = Image.new('RGBA', (W, H)); px = im.load()
    puffs = []
    for k in range(6):
        a = ((frame + k) % 6) / 6.0 + 0.04                   # age; one new puff per frame
        sz = (1.0, 0.8, 1.15, 0.9, 1.05, 0.85)[k]
        y = 29.5 - a * 24; x = 4.5 + a * 6.5 + (0.6 if k % 2 else -0.4) * a * 2
        r = (1.8 + a * 3.0) * sz
        alpha = int(235 * (1 - a) ** 0.7)
        puffs.append((a, x, y, r, alpha))
    for a, x0, y0, r, alpha in sorted(puffs, key=lambda p: -p[0]):   # older (higher, fainter) first
        for y in range(int(y0 - r) - 1, int(y0 + r) + 2):
            for x in range(int(x0 - r) - 1, int(x0 + r) + 2):
                dx = (x + 0.5 - x0) / r; dy = (y + 0.5 - y0) / (r * 0.85)
                d = dx * dx + dy * dy
                if d > 1 or not (0 <= x < W and 0 <= y < H): continue
                lit = -dx * 0.55 - dy * 0.65
                t = 5 if lit > 0.25 else 4 if lit > -0.35 else 3
                if a < 0.2 and t > 3: t -= 1                           # fresh smoke is darker
                if d > 0.75 and t > 3: t -= 1
                if a > 0.62 and (x + y) % 2: continue                  # old puffs dissolve into a dither
                px[x, y] = SM[t] + (alpha,)
    return im

if __name__ == '__main__':
    for k in BOATS:
        for f in range(4): boat(k, f)
    print('ok')
