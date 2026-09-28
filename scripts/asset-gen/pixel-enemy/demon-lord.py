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
WAVE = [1,0,1,1,0,1,0,1,1,0]

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
        s = math.sin(th*11 + ph)
        if s < -0.62: return 'r'
        if s > 0.72 and (x < 48+sw or s > 0.9) and y < 70: return 'C'
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
    hl = [H(45,21), H(40,19), H(37,15), H(37,10), H(39,6)]
    hr = [H(56,21), H(60,19), H(62,15), H(62,10), H(60,6)]
    if q.get('horn_back'):
        hl = [H(45,21), H(40,20), H(36,17), H(34,12), H(35,8)]; hr = [H(56,21), H(60,19), H(61,14), H(60,10), H(57,7)]
    for hs in (hl, hr):
        part(p, both(stroke(hs[:2], 5), stroke(hs[1:3], 4), stroke(hs[2:4], 3), stroke(hs[3:], 2)), GOLD)
    # mane behind the face
    part(p, poly([H(41,32), H(41,25), H(43,20), H(43,15), H(46,18), H(48,12), H(50,17), H(53,12), H(54,17), H(58,15),
                  H(57,20), H(60,25), H(59,32), H(56,34), H(54,31), H(47,31), H(44,34)]), BLACK)
    # pointed ears
    part(p, poly([H(45,22), H(38,19), H(44,26)]), SKIN)
    part(p, poly([H(56,22), H(62,19), H(56,26)]), SKIN)
    # face
    part(p, poly([H(45,19), H(56,19), H(57,26), H(55,30), H(51,32), H(47,31), H(45,27)]), rim('b', 'l', 's'))
    x, y = R(H(0, 0))
    g = lambda gx, gy, rows: p.grid(x+gx, y+gy, rows)
    g(45, 18, ["ooooooooooo", ".o.oo.oo.o.", "....o..o..."])                   # widow's-peak spikes
    if mood == 'hurt':
        g(46, 23, ["oo....oo", "..oo.o..", "........"])
        g(48, 27, [".o", "o."]); g(47, 28, ["ooooo", "owrwo", ".ooo."])
    else:
        eye = 'v' if mood == 'glow' else 'e'
        g(46, 22, ["o.....o.o.", ".oo..oo..."]); g(47, 24, [eye*2+"..."+eye*2])
        g(50, 26, ["s", "s"])
        if mood in ('glow', 'roar'):
            g(47, 28, ["oooooo", "owvvwo", ".ovvo."])
        else:
            g(47, 29, ["oooooo", ".w..w."])

# ------------------------------------------------------------------ magic
def flame(p, x0, y0, reach, h0, spread):
    def draw(d):
        top, bot = [], []
        for x in range(int(x0), int(x0+reach)+1):
            t = x - x0
            hh = h0 + t*spread + 1.6*math.sin(t*0.9) + (1.5 if t % 7 < 2 else 0)
            top.append((x, y0 - hh + 1.2*math.sin(t*0.5))); bot.append((x, y0 + hh*0.8 + 1.0*math.cos(t*0.6)))
        d.polygon([R(q) for q in top + bot[::-1]], fill=255)
    def shade(x, y, ins):
        t = max(1, x - x0); hh = h0 + t*spread
        u = abs(y - y0 + 0.5) / hh
        if u < 0.28 and x < x0 + reach - 3: return 'w'
        if u < 0.62: return 'v'
        return 'm'
    part(p, draw, shade, open_right=True)

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
 'idle_b': dict(by=-1, fl=1),
 'idle_c': dict(by=-1, fl=2, cl=1),
 'windup': dict(by=-2, cs=1.05, cl=6, fl=3, face='glow', arms='flex', ph=0.5),
 'move':   dict(by=-1, cs=1.02, cl=3, fl=1, face='glow', arms='gather', ph=0.9),
 'attack': dict(by=0, ox=2, hx=1, cs=1.0, kR=0.8, cl=2, fl=3, sw=-2, face='roar', arms='thrust', ph=1.4),
 'recover':dict(by=0, ox=1, cs=1.0, cl=1, fl=2, face='calm', arms='lower', ph=0.3),
 'hit':    dict(by=1, ox=-3, hx=-2, hy=1, cs=0.62, kR=0.9, cl=-2, fl=0, sw=-3, fold=4, face='hurt', arms='flail', horn_back=True, ph=2.0),
}

def draw_dead(p):
    # cloak collapsed into a torn pool on the floor behind the kneeling body
    q = dict(BASE, cs=1.0)
    def cdraw(d):
        pts = [(4,92),(6,86),(3,82),(9,80),(12,74),(16,78),(22,72),(28,75),(34,68),(40,72),(46,70),(52,74),(58,72),
               (62,78),(68,76),(72,82),(78,80),(80,86),(86,86),(84,92)]
        d.polygon(pts, fill=255)
        d.ellipse((17,84,20,86), fill=0); d.ellipse((66,85,68,87), fill=0)
    def cshade(x, y, ins):
        if not ins(x, y-2): return 'k'
        s = math.sin(x*0.55 + y*0.15)
        return 'r' if s < -0.5 or y > 89 else ('C' if s > 0.8 and y < 84 else 'c')
    part(p, cdraw, cshade)
    # folded legs: shin flat on the floor, boot tipped up behind
    part(p, stroke([(52,88), (34,88)], 7), BLACK)
    part(p, poly([(26,82), (30,84), (34,85), (34,91), (24,91), (23,86)]), RED)
    part(p, poly([(33,84), (36,84), (36,91), (33,91)]), rim('n', 'w', None))
    part(p, stroke([(40,74), (52,86)], 11), SKIN)
    part(p, poly([(34,70), (44,68), (48,78), (40,82), (34,78)]), BLACK)                      # loincloth
    # bowed torso, back up, skull pauldrons
    part(p, poly([(38,70), (46,60), (60,58), (70,64), (70,74), (58,80), (44,78)]), SKIN)
    part(p, ell((58,58,72,70)), SKIN)
    p.grid(50, 55, SKULL); p.grid(62, 57, SKULL)
    # arm hanging to the floor, claw flat
    part(p, stroke([(64,68), (68,80)], 9), SKIN)
    part(p, stroke([(68,80), (72,89)], 7), SKIN)
    part(p, poly([(68,88), (78,88), (80,92), (68,92)]), SKIN)
    # head hanging, horns forward onto the floor, eyes dark
    part(p, poly([(70,66), (76,64), (80,70), (78,78), (72,78)]), BLACK)
    part(p, both(stroke([(76,72), (82,74), (86,80)], 4), stroke([(86,80), (88,86)], 2)), GOLD)
    part(p, poly([(72,70), (79,70), (80,77), (76,81), (72,78)]), SKIN)
    p.grid(74, 74, ["oo.o", "...."]); p.grid(74, 78, ["ooo"])
    wisp(p, 20, 66); wisp(p, 44, 60); wisp(p, 82, 62)
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
    if A == 'flail':
        arm(p, U(32,35), U(24,40), U(19,33), 'claw')
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
        arm(p, U(63,35), U(72,36), U(80,35), 'claw')
    elif A == 'lower':
        shoulders(p, U, False)
        arm(p, U(32,35), U(30,44), U(40,46))
        arm(p, U(63,35), U(69,43), U(73,49), 'claw')
    elif A == 'flail':
        shoulders(p, U, False)
        arm(p, U(63,35), U(69,30), U(66,23), 'fist')
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
        flame(p, U(84,35)[0], U(84,35)[1], 14, 4, 0.75)
    if n == 'recover':
        wisp(p, *U(78,44)); wisp(p, *U(82,38))
    return clean(p)

if __name__ == '__main__': build('demon-lord', CELL, PAL, draw)

