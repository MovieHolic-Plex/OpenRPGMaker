"""Original demon lord (final boss) for retro2003 side battle, 96px cell, motion breath.

Design language (from the user's design brief, re-designed for a 96px grid; no reference pixels are read):
huge torn crimson cloak spread like wings behind a violet muscular giant with crossed arms, gold bull horns,
black spiky mane, pointed ears, red eyes, skull pauldrons, chest chain, black loincloth, studded thigh straps,
black shins, silver anklets, pointed red boots. Faces right (3/4 front, head/horns/attack turned right).

Every pixel comes from code on the final grid: part masks (polygons/ellipses/capped strokes) filled with a
top-left light rim and a 1px dark outline, plus hand-typed pixel grids.
"""
import sys, math
sys.dont_write_bytecode = True
from PIL import Image, ImageDraw
from pe_lib import Pen
from pe_rig import build, clean

CELL = 96
PAL = dict(o='140c1c', k='2a2232', q='4e4658', s='2c2868', b='4a46ac', l='7a76dc',
           r='5c1020', c='9c2430', C='d04a48', y='e8c048', g='8c6420', w='ece6d6', n='9894a0',
           e='ff3838', m='9a3cf0', v='dc98ff')

def R(q): return (int(round(q[0])), int(round(q[1])))

# ------------------------------------------------------------------ part masks
def part(p, draw, shade, edge='o', open_right=False):
    """Draw a mask with 'draw', then colour every mask pixel: outline on the boundary, 'shade' inside."""
    m = Image.new('L', (CELL, CELL), 0); draw(ImageDraw.Draw(m)); a = m.load()
    lim = CELL - 2
    def ins(x, y):
        if open_right and x > lim: return True
        return 0 <= x < CELL and 0 <= y < CELL and a[x, y] > 0
    for y in range(CELL):
        for x in range(CELL):
            if not a[x, y] or x > lim: continue
            if edge and not (ins(x+1, y) and ins(x-1, y) and ins(x, y+1) and ins(x, y-1)): c = edge
            else: c = shade(x, y, ins)
            if c: p.im.putpixel((x, y), p.pal[c])
    return ins

def rim(base, lit=None, dark=None, lw=1, dw=1):
    """Directional light: lit band on the top/left inside the outline, dark band on the bottom/right."""
    def f(x, y, ins):
        if dark and (any(not ins(x+k, y) for k in range(2, dw+2)) or any(not ins(x, y+k) for k in range(2, dw+2))): return dark
        if lit and (any(not ins(x-k, y) for k in range(2, lw+2)) or any(not ins(x, y-k) for k in range(2, lw+2))): return lit
        return base
    return f

def mline(d, pts, w, fill=255):
    pts = [R(q) for q in pts]
    if len(pts) > 1: d.line(pts, fill=fill, width=w)
    r = (w-1)/2
    for x, y in pts: d.ellipse((x-r, y-r, x+r, y+r), fill=fill)

def poly(pts): return lambda d: d.polygon([R(q) for q in pts], fill=255)
def ell(box): return lambda d: d.ellipse(box, fill=255)
def stroke(pts, w): return lambda d: mline(d, pts, w)
def both(*fs):
    def f(d):
        for g in fs: g(d)
    return f

SKIN = rim('b', 'l', 's')
BLACK = rim('k', 'q', None)
RED = rim('c', 'C', 'r')
GOLD = rim('y', None, 'g')
BONE = rim('w', None, 'n')

# ------------------------------------------------------------------ cloak
# Left wing outline (absolute, idle). t=1 marks a tattered tip that flutters.
LW = [(44,29,0),(36,26,0),(28,22,0),(20,19,0),(13,16,0),(8,13,0),(5,10,1),(7,15,0),(10,18,0),
      (7,22,0),(4,27,1),(8,28,0),(11,29,0),(8,35,0),(4,42,1),(8,42,0),(11,43,0),(9,49,0),(6,56,1),
      (10,55,0),(14,56,0),(13,63,0),(12,70,1),(16,67,0),(19,66,0),(20,72,0),(20,79,1),(23,75,0),
      (26,73,0),(27,79,0),(29,85,1),(31,81,0),(34,79,0),(35,82,0),(37,86,1),(39,81,0),(42,79,0),(45,84,1),(48,79,0)]
HOLES = [(11,48,3,2),(21,63,2,2),(16,36,2,2)]
WAVE = [1,0.6,1,0.8,1,0.5,1,1,0.7,1]

def cloak_points(q):
    cs, cl, fl, sw, kR = q['cs'], q['cl'], q['fl'], q['sw'], q.get('kR', 0.96)
    fold = q.get('fold', 0)       # hit: tips swept up/inward like a folding wing
    left, right = [], []
    k = 0
    for x, y, t in LW:
        lift = cl*max(0, 48-x)/44 if y < 34 else cl*max(0, 48-x)/88
        dx = dy = 0
        if t:
            dy = fl*WAVE[k % len(WAVE)]; dx = fl*WAVE[(k+3) % len(WAVE)]; k += 1
        u = (48-x)
        yy = y - lift + dy + fold*u/44*max(0, y-30)/5
        left.append((48 - u*cs - dx + sw, yy))
        right.append((48 + u*cs*kR + dx*0.8 + sw, yy - (1 if t and fl == 1 else 0)))
    pts = left + right[::-1][1:]
    return [(min(94, max(1, x)), min(91, y)) for x, y in pts], left, right

def cloak(p, q):
    pts, left, right = cloak_points(q)
    cs, sw = q['cs'], q['sw']
    tips = [pt for pt, src in zip(left, LW) if src[2]] + [pt for pt, src in zip(right, LW) if src[2]]
    AL, AR = (38+sw, 29), (58+sw, 29)
    ph = q['fl']*0.22 + q.get('ph', 0)
    def draw(d):
        d.polygon([R(t) for t in pts], fill=255)
        for hx, hy, hw, hh in HOLES:
            for side in (-1, 1):
                u = (48-hx)*cs*(1 if side < 0 else 0.96)
                cx = 48 - u + sw if side < 0 else 48 + u + sw
                cy = hy + (1 if side > 0 else 0)
                d.ellipse((cx-hw/2, cy-hh/2, cx+hw/2, cy+hh/2), fill=0)
    def shade(x, y, ins):
        if not ins(x, y-2) or not ins(x, y-3): return 'k'           # black rim on every up-facing edge
        for tx, ty in tips:
            if (x-tx)**2 + (y-ty)**2 <= 13: return 'k'              # curled black tatter tips
        a = AL if x < 48+sw else AR
        dx, dy = x-a[0], y-a[1]
        r = math.hypot(dx, dy)
        if abs(x-48-sw) < 15 and y > 40: return 'r'                  # body shadow on the inner lining
        if r < 9: return 'r'
        th = math.atan2(dy, dx if x < 48+sw else -dx)
        s = math.sin(th*7.5 + 1.3*math.sin(th*2.3 + 0.7) + ph)
        if s < -0.8: return 'r'                                       # thin dark creases
        left = x < 48+sw
        if left and s > 0.55 and r < 40: return 'C'                   # lit folds on the light side
        if not left and s > 0.9 and r < 26: return 'C'
        if not left and s < -0.35 and r > 20: return 'r'              # far wing sits in shade
        return 'c'
    part(p, draw, shade)

# ------------------------------------------------------------------ body
SKULL = ["..oooooo..",
         ".owwwwwwo.",
         "owwwwwwnno",
         "owkkwwkkno",
         "owkkwnkkno",
         ".owwnnwwo.",
         "..onwnwno.",
         "..owowowo.",
         "...ooooo.."]

def legs(p, q):
    L = q.get('legs', dict(lh=(43,56), lk=(38,71), la=(37,83), rh=(55,56), rk=(59,71), ra=(61,83)))
    for h, k_, a in ((L['lh'], L['lk'], L['la']), (L['rh'], L['rk'], L['ra'])):
        part(p, stroke([k_, a], 8), BLACK)                                   # black shin
        part(p, stroke([h, k_], 11), SKIN)                                   # thigh
        sy = round((h[1]+k_[1])/2) + 1; sx = round((h[0]+k_[0])/2)
        part(p, poly([(sx-7, sy-1), (sx+6, sy-2), (sx+6, sy+1), (sx-7, sy+2)]), BLACK)
        for i in range(-5, 6, 3): p.im.putpixel((sx+i, sy), p.pal['w'])      # studs
        ax, ay = a
        part(p, poly([(ax-5, ay), (ax+5, ay), (ax+5, ay+2), (ax-5, ay+2)]), rim('n', 'w', None))
        # pointed red boot, toe curling up to the right
        part(p, poly([(ax-6, ay+3), (ax+4, ay+3), (ax+9, ay+5), (ax+13, ay+3), (ax+12, ay+7), (ax+8, 92), (ax-6, 92), (ax-7, ay+6)]),
             rim('c', 'C', 'r'))

def loin(p, U):
    part(p, poly([U(40,52), U(57,52), U(55,59), U(51,67), U(47,67), U(43,59)]), BLACK)
    x, y = R(U(48, 54)); p.grid(x-1, y-1, [".n.", "n.n", ".n."])

def torso(p, U):
    part(p, poly([U(35,33), U(62,33), U(61,44), U(57,53), U(40,53), U(36,44)]), SKIN)       # lats / waist
    x0, y0 = R(U(0, 0))
    for yy in (45, 48, 51): p.line([(x0+44, y0+yy), (x0+47, y0+yy)], 's'); p.line([(x0+50, y0+yy), (x0+53, y0+yy)], 's')
    p.line([(x0+48, y0+43), (x0+48, y0+52)], 's')
    part(p, poly([U(42,31), U(47,27), U(54,27), U(58,31), U(56,35), U(44,35)]), SKIN)        # traps / neck
    part(p, ell(box(U(35,31), U(49,42))), SKIN)                                             # pecs
    part(p, ell(box(U(48,31), U(61,41))), SKIN)
    x0, y0 = R(U(0, 0))
    p.line([(x0+48, y0+33), (x0+48, y0+40)], 's'); p.line([(x0+38, y0+33), (x0+44, y0+32)], 'l')

def box(a, b): return (a[0], a[1], b[0], b[1])

def shoulders(p, U, skulls=True):
    part(p, ell(box(U(27,30), U(40,42))), SKIN)                                             # deltoids
    part(p, ell(box(U(57,30), U(68,41))), SKIN)
    if skulls:
        x, y = R(U(27, 25)); p.grid(x, y, SKULL)
        x, y = R(U(58, 25)); p.grid(x, y, SKULL)

def chain(p, U, sag=3):
    x0, y0 = R(U(0, 0))
    for i, x in enumerate(range(37, 59)):
        t = (x-37)/21; y = y0 + 34 + round(sag*4*t*(1-t))
        xx = x0 + x
        p.im.putpixel((xx, y-1), p.pal['o']); p.im.putpixel((xx, y+2), p.pal['o'])
        if i % 3 == 2:
            p.im.putpixel((xx, y), p.pal['o']); p.im.putpixel((xx, y+1), p.pal['n'])
        else:
            p.im.putpixel((xx, y), p.pal['w']); p.im.putpixel((xx, y+1), p.pal['n'])

def fist(p, c, r=3.5):
    x, y = c
    part(p, ell((x-r, y-r, x+r, y+r)), SKIN)

def claw_hand(p, c):
    x, y = R(c)
    part(p, poly([(x-3, y-4), (x+3, y-5), (x+5, y+1), (x+2, y+4), (x-3, y+3)]), SKIN)
    for k in range(3):
        p.line([(x+5, y-4+k*3), (x+7, y-5+k*3)], 'w'); p.im.putpixel((x+8, y-5+k*3), p.pal['o'])

def arm(p, sh, el, hd, hand='fist'):
    part(p, stroke([sh, el], 9), SKIN)
    part(p, stroke([el, hd], 8), SKIN)
    if hand == 'fist': fist(p, hd, 4)
    elif hand == 'claw': claw_hand(p, hd)

def crossed(p, U):
    # back (viewer-right) forearm first, hand buried under the far bicep
    part(p, stroke([U(32,35), U(31,44)], 9), SKIN)
    part(p, stroke([U(63,35), U(64,43)], 8), SKIN)
    part(p, stroke([U(64,44), U(41,40)], 7), SKIN)
    part(p, stroke([U(31,45), U(57,40)], 8), SKIN)
    fist(p, U(59,39), 3.5)
    x0, y0 = R(U(0, 0))
    p.line([(x0+36, y0+42), (x0+46, y0+40)], 'l')                          # lit top of the front forearm

def head(p, H, q):
    mood = q['face']
    # horns: out from the temples, then up
    hl = [H(46,20), H(40,18), H(36,14), H(35,9), H(37,4)]
    hr = [H(56,20), H(61,18), H(63,14), H(63,10), H(61,6)]
    if q.get('horn_back'):
        hl = [H(46,20), H(40,19), H(35,17), H(32,13), H(32,8)]; hr = [H(56,20), H(61,19), H(64,16), H(65,12), H(63,8)]
    for hs, w0 in ((hr, 5), (hl, 6)):
        part(p, both(stroke(hs[:2], w0), stroke(hs[1:3], w0-1), stroke(hs[2:4], w0-2), stroke(hs[3:], w0-3)), GOLD)
    # mane behind the face
    part(p, poly([H(40,32), H(40,25), H(42,20), H(43,14), H(46,18), H(48,11), H(51,16), H(54,11), H(55,16), H(59,14),
                  H(58,20), H(60,25), H(59,31), H(57,33), H(55,31), H(48,31), H(43,34)]), BLACK)
    # pointed ears
    part(p, poly([H(45,22), H(37,18), H(44,27)]), SKIN)
    part(p, poly([H(57,22), H(60,20), H(57,26)]), SKIN)
    # face turned right: jaw and nose pushed to the right side
    part(p, poly([H(46,19), H(58,19), H(59,23), H(60,25), H(59,29), H(55,32), H(50,31), H(47,27)]), rim('b', 'l', 's'))
    x, y = R(H(0, 0))
    g = lambda gx, gy, rows: p.grid(x+gx, y+gy, rows)
    g(46, 18, ["oooooooooooo", ".o.oo.oo.oo.", "....o..o...."])                   # widow's-peak spikes
    if mood == 'hurt':
        g(48, 22, ["oo....oo", "..oo.oo.", "........"])
        g(49, 27, [".o", "o."]); g(51, 28, ["ooooo", "owrwo", ".ooo."])
    else:
        eye = 'v' if mood == 'glow' else 'e'
        g(48, 22, ["o....ooo.", ".oo..oooo"]); g(49, 24, [eye*2+"..."+eye*3])
        g(49, 25, ["o....ooo"])
        g(54, 25, ["s.", "ss"])
        if mood in ('glow', 'roar'):
            g(50, 28, ["ooooooo", "owvvvwo", ".ovvvo.", "..ooo.."])
        else:
            g(51, 29, ["oooooo", ".w..w."])

# ------------------------------------------------------------------ magic
TONGUE = [0,2,4,5,3,1,0,1,3,6,4,2,0,2,5,3,1,0,2,4]

def flame(p, x0, y0, reach, h0, spread):
    """Dark flame widening to the right: ragged tongues on both edges, dark violet rim, wavy violet bands, white core."""
    def half(t, sign):
        return h0 + t*spread + TONGUE[(t + (7 if sign > 0 else 0)) % len(TONGUE)]*(0.4 + t/reach*0.6)
    def draw(d):
        top = [(x0 + t, y0 - half(t, -1)) for t in range(int(reach)+2)]
        bot = [(x0 + t, y0 + half(t, 1)*0.9) for t in range(int(reach)+2)]
        d.polygon([R(q) for q in [(x0-3, y0)] + top + bot[::-1]], fill=255)
    def shade(x, y, ins):
        t = max(0, x - x0); hh = h0 + t*spread
        u = abs(y - y0 + 0.3 + 1.2*math.sin(t*0.45)) / hh
        if u < 0.28 + 0.08*math.sin(t*0.8): return 'w'
        if u < 0.72 + 0.12*math.sin(t*0.6 + 1): return 'v'
        return 'm'
    part(p, draw, shade, edge='s', open_right=True)

def orb(p, c, r):
    x, y = c
    def shade(px, py, ins):
        d = math.hypot(px-x, py-y)
        return 'w' if d < r*0.35 else ('v' if d < r*0.7 else 'm')
    part(p, ell((x-r, y-r, x+r, y+r)), shade)

def wisp(p, x, y, big=False):
    rows = [".v.", "vmv", ".m."] if not big else ["..v..", ".vmv.", "vmwmv", ".mvm.", "..m.."]
    p.grid(int(x), int(y), rows)

# ------------------------------------------------------------------ poses
BASE = dict(by=0, ox=0, hx=0, hy=0, cs=1.0, cl=0, fl=0, sw=0, face='calm', arms='cross', chain=3)
P = {
 'idle_a': dict(),
 'idle_b': dict(by=-1, fl=2, cl=1),
 'idle_c': dict(by=-1, fl=3, cl=2, ph=0.35),
 'windup': dict(by=-2, cs=1.08, cl=9, fl=3, face='glow', arms='flex', ph=0.5),
 'move':   dict(by=-1, cs=1.02, cl=3, fl=1, face='glow', arms='gather', ph=0.9),
 'attack': dict(by=0, ox=-4, hx=2, cs=1.0, kR=0.8, cl=2, fl=3, sw=-2, face='roar', arms='thrust', ph=1.4),
 'recover':dict(by=0, ox=1, cs=1.0, cl=1, fl=2, face='calm', arms='lower', ph=0.3),
 'hit':    dict(by=1, ox=-3, hx=-4, hy=2, cs=0.62, kR=0.9, cl=-2, fl=0, sw=-3, fold=4, face='hurt', arms='flail', horn_back=True, ph=2.0),
}

def draw_dead(p):
    """Collapsed: knelt, bowed forward to the right, horns on the floor, cloak slumped over the back."""
    def cdraw(d):   # torn cloak pooled on the floor behind
        d.polygon([(4,92),(3,86),(8,84),(6,78),(12,80),(16,74),(20,78),(26,72),(30,76),(36,70),(44,74),(50,72),
                   (56,78),(62,80),(64,86),(70,88),(72,92)], fill=255)
        d.ellipse((13,85,16,87), fill=0); d.ellipse((58,86,60,88), fill=0)
    def cshade(x, y, ins):
        if not ins(x, y-2): return 'k'
        s = math.sin(x*0.5 + y*0.2)
        return 'r' if s < -0.55 or y > 89 else ('C' if s > 0.75 and x < 40 else 'c')
    part(p, cdraw, cshade)
    # back leg: shin flat on the floor, boot sole up behind
    part(p, stroke([(40,88), (24,88)], 7), BLACK)
    part(p, poly([(15,83), (21,84), (24,85), (24,91), (13,91), (12,87)]), RED)
    part(p, poly([(24,84), (27,84), (27,91), (24,91)]), rim('n', 'w', None))
    # thigh from hip down to the knee on the floor
    part(p, stroke([(34,72), (44,86)], 12), SKIN)
    part(p, poly([(38,78), (50,80), (50,83), (38,82)]), BLACK)
    for i in (40, 43, 46, 49): p.im.putpixel((i, 81), p.pal['w'])
    part(p, poly([(26,64), (36,62), (40,76), (32,80), (26,74)]), BLACK)            # loincloth
    # bowed torso, back up
    part(p, poly([(28,66), (36,54), (52,50), (64,56), (66,68), (56,74), (38,74)]), SKIN)
    part(p, ell((50,50,68,66)), SKIN)
    p.line([(38,58), (52,54)], 'l'); p.line([(40,70), (56,70)], 's')
    # cloak slumped over the back, torn hem hanging down the left
    def ddraw(d):
        d.polygon([(22,62),(30,52),(42,46),(54,46),(62,50),(52,54),(40,58),(32,66),(30,74),(26,70),(24,78),(20,72),(18,76),(18,66)], fill=255)
    part(p, ddraw, lambda x, y, ins: 'k' if not ins(x, y-2) else ('C' if (x+y) % 9 == 0 and y < 58 else ('r' if x < 26 else 'c')))
    # arm propped on the floor
    part(p, stroke([(62,62), (68,76)], 9), SKIN)
    part(p, stroke([(68,76), (70,86)], 7), SKIN)
    part(p, poly([(66,86), (74,85), (78,88), (78,92), (65,92)]), SKIN)
    p.grid(77, 86, ["ow", ".o"]); p.grid(78, 89, ["ow", ".o"])
    p.grid(56, 45, SKULL)
    chain_pts = [(46,56),(50,60),(54,62),(58,63)]
    for i, (x, y) in enumerate(chain_pts): p.grid(x, y, ["ow", "on"] if i % 2 else ["wo", "no"])
    # hanging head: mane, horns forward, face down and dark
    part(p, poly([(61,60), (64,55), (67,58), (70,54), (72,59), (76,60), (75,68), (68,70), (62,67)]), BLACK)
    part(p, both(stroke([(74,62), (80,63), (85,67)], 5), stroke([(85,67), (88,72)], 3), stroke([(88,72), (88,75)], 2)), GOLD)
    part(p, both(stroke([(66,66), (64,74)], 4), stroke([(64,74), (62,78)], 2)), GOLD)
    part(p, poly([(66,64), (74,64), (76,72), (72,78), (67,76), (65,70)]), rim('b', 'l', 's'))
    p.grid(67, 69, ["oo.oo", "....."]); p.grid(68, 74, ["ooo"])
    wisp(p, 14, 62); wisp(p, 44, 38); wisp(p, 84, 48); wisp(p, 30, 42)
    return clean(p)

def draw(n):
    p = Pen(CELL, PAL)
    if n == 'dead': return draw_dead(p)
    q = dict(BASE, **P[n])
    ox, oy = q['ox'], q['by']
    U = lambda x, y: (x+ox, y+oy)
    H = lambda x, y: (x+ox+q['hx'], y+oy+q['hy'])
    cloak(p, q)
    A = q['arms']
    # side arms that sit behind the torso edge
    legs(p, q)
    loin(p, U)
    torso(p, U)
    if A == 'cross':
        shoulders(p, U, skulls=False); crossed(p, U)
    elif A == 'flex':
        shoulders(p, U, False)
        arm(p, U(32,35), U(24,43), U(27,52)); arm(p, U(63,35), U(71,43), U(68,52))
    elif A == 'gather':
        shoulders(p, U, False)
        arm(p, U(32,35), U(27,44), U(33,51))
        arm(p, U(63,35), U(71,38), U(78,35), 'claw')
    elif A == 'thrust':
        shoulders(p, U, False)
        arm(p, U(32,35), U(26,43), U(30,51))
        arm(p, U(63,35), U(69,33), U(72,31), 'claw')
    elif A == 'lower':
        shoulders(p, U, False)
        arm(p, U(32,35), U(30,44), U(40,46))
        arm(p, U(63,35), U(70,42), U(73,49), 'fist')
    elif A == 'flail':
        shoulders(p, U, False)
        x, y = R(U(27, 25)); p.grid(x, y, SKULL)
        x, y = R(U(58, 25)); p.grid(x, y, SKULL)
        arm(p, U(32,36), U(33,46), U(45,40), 'fist')            # near arm clutched across the belly
        arm(p, U(64,36), U(69,44), U(64,33), 'claw')            # far arm raised, guarding the jaw
    if A != 'flail':
        x, y = R(U(27, 25)); p.grid(x, y, SKULL)
        x, y = R(U(58, 25)); p.grid(x, y, SKULL)
    chain(p, U, q['chain'])
    head(p, H, q)
    # magic
    if n == 'windup':
        wisp(p, *U(25,53)); wisp(p, *U(67,53)); wisp(p, *U(22,45)); wisp(p, *U(72,45))
    if n == 'move':
        orb(p, U(84,34), 5); wisp(p, *U(88,24)); wisp(p, *U(78,24)); wisp(p, *U(90,42))
    if n == 'attack':
        x0, y0 = U(78,30)
        flame(p, x0, y0, 94-x0, 3, 0.62)
        wisp(p, 89, 6, True); wisp(p, 70, 13)
    if n == 'recover':
        wisp(p, *U(80,40)); wisp(p, *U(84,33)); wisp(p, *U(78,48))
    return clean(p)

if __name__ == '__main__': build('demon-lord', CELL, PAL, draw)

