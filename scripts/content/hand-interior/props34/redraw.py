"""3/4 + quality redraw of atlas_biome_interior non-seat props (2026-10-20, audit interior-props-34-audit-1).

Keeps ids, footprints, cells and tile numbers: each fix edits the art that is already in the sheet (the committed
sheet at BASE_REF is the input, so re-running is idempotent) and rebake_inplace.py pastes it back over the same tiles.

  python3 scripts/content/hand-interior/props34/redraw.py      # writes tiledata/hand-interior/props34/<slug>.png (+ frames)
"""
import io, json, math, os, subprocess, sys
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
SHEET_PATH = 'public/assets/atlas-interior/interior-chipset.png'
BASE_REF = os.environ.get('PROPS34_BASE', 'f508f1755b')   # origin/main when this pass started
OUT = os.path.join(ROOT, 'tiledata/hand-interior/props34')
TPR = 48
SPEC = json.load(open(os.path.join(ROOT, 'src/assets/handInteriorSpec.json')))
TSET = json.load(open(os.path.join(ROOT, 'src/assets/atlasBiomeInteriorTileset.json')))
STRIPS = {a['baseTile']: a for a in TSET['animationStrips']}


def _base_sheet():
    b = subprocess.run(['git', '-C', ROOT, 'show', f'{BASE_REF}:{SHEET_PATH}'], capture_output=True, check=True).stdout
    return Image.open(io.BytesIO(b)).convert('RGBA')


SHEET = _base_sheet()


def tile(i):
    x, y = (i % TPR) * 16, (i // TPR) * 16
    return SHEET.crop((x, y, x + 16, y + 16))


def geom(oid):
    cells = SPEC['objects'][oid]['cells']
    x0 = min(c[0] for c in cells); y0 = min(c[1] for c in cells)
    W = (max(c[0] for c in cells) - x0 + 1) * 16; H = (max(c[1] for c in cells) - y0 + 1) * 16
    return cells, x0, y0, W, H


def frames(oid):
    """All frames of the object (1 if static, 12 if any cell is an animation strip base)."""
    cells, x0, y0, W, H = geom(oid)
    n = max(STRIPS[c[2]]['frames'] if c[2] in STRIPS else 1 for c in cells)
    out = []
    for k in range(n):
        im = Image.new('RGBA', (W, H))
        for c in cells:
            t = c[2] + (k if c[2] in STRIPS else 0)
            im.alpha_composite(tile(t), ((c[0] - x0) * 16, (c[1] - y0) * 16))
        out.append(im)
    return out


def hx(s):
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), 255)


def h2(x, y):
    """Small deterministic hash for grain."""
    v = (x * 374761393 + y * 668265263) & 0xffffffff
    v = (v ^ (v >> 13)) * 1274126177 & 0xffffffff
    return (v ^ (v >> 16)) & 0xff


# ---------------------------------------------------------------- cabinets (13 stock variants, one body)
CAB_IDS = [k for k in SPEC['objects'] if k.startswith('cabinet:')]


def cabinet(im):
    """Top plane rows 2-4 were the same mid-brown as the front posts (reads as a cornice band).
    Light the plane (lighter than any front face, grain streaks) and make row 5 the lit front lip."""
    im = im.copy(); px = im.load()
    BACK, PLANE, GRAIN, LIP = hx('7e4422'), hx('c07c4c'), hx('aa673d'), hx('d59147')
    for x in range(1, 15):
        px[x, 1] = BACK
        for y in (2, 3, 4):
            px[x, y] = GRAIN if (h2(x, y) % 7 == 0 or (y == 3 and x in (4, 5, 10))) else PLANE
        px[x, 5] = LIP
    # the pure-black side outline and the black slot under the top read as a sticker line (object-gate style): use the
    # wood's own darkest tones — outline 1a0e06, eave shadow under the lip 2a180b
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][3] and px[x, y][:3] == (0, 0, 0):
                px[x, y] = hx('1a0e06') if x in (0, im.width - 1) or y == im.height - 1 else hx('2a180b')
    return im


# ---------------------------------------------------------------- helmet shelf
def helmet_shelf(im):
    """Top board showed 1 lit row. Use the empty row 0 for the back rim and give the board a 4-row lit top (back, plane, lit lip)."""
    im = im.copy(); px = im.load(); W = im.width
    RIM, BACK, PLANE, GRAIN, LIP = hx('63310b'), hx('b77246'), hx('d59147'), hx('c07c4c'), hx('e8aa63')
    old4_right = px[W - 1, 4]
    for x in range(0, W):
        px[x, 0] = RIM
    for x in range(1, W - 1):
        px[x, 1] = BACK
        for y in (2, 3):
            px[x, y] = GRAIN if h2(x, y) % 6 == 0 else PLANE
        px[x, 4] = LIP
    for y in range(1, 5):
        px[0, y] = RIM
        px[W - 1, y] = RIM if y < 4 else old4_right
    for x in range(1, W - 1):                         # eave shadow under the lip
        if px[x, 5][:3] == hx('3a2210')[:3]: px[x, 5] = hx('2a180b')
    return im


# ---------------------------------------------------------------- orrery (12 frames)
def orrery_frames(n=12):
    """Was a flat side arc floating over a 1px post. Now a brass orbit ring seen from above (hand-set ellipse:
    back half dark, front half lit), the sun on the post, planets going round it, round wooden plinth."""
    WOOD_L, WOOD, WOOD_D, OUTL = hx('d59147'), hx('b77246'), hx('6d3b15'), hx('411e05')
    BR_HI, BR_L, BR, BR_D = hx('efdd7d'), hx('dfc872'), hx('bfa045'), hx('7e5c10')
    SUN, SUN2, SUNR = hx('fff8b0'), hx('efdd7d'), hx('f4b370')
    BLUE, PINK = hx('8abae4'), hx('eb7571')
    RING = {12: [(5, 10)], 13: [(2, 4), (11, 13)], 14: [(1, 1), (14, 14)], 15: [(1, 1), (14, 14)],
            16: [(2, 4), (11, 13)], 17: [(5, 10)]}
    pts = [(x, y) for y, spans in RING.items() for a0, a1 in spans for x in range(a0, a1 + 1)]
    cx, cy = 7.5, 14.5
    pts.sort(key=lambda p: math.atan2((p[1] - cy) * 2.3, p[0] - cx))
    inner = [(int(round(cx + 4 * math.cos(t / 16 * 2 * math.pi))), int(round(cy + 1.4 * math.sin(t / 16 * 2 * math.pi)))) for t in range(16)]
    out = []
    for k in range(n):
        im = Image.new('RGBA', (16, 32)); px = im.load()

        def put(x, y, c):
            if 0 <= x < 16 and 0 <= y < 32: px[x, y] = c
        def blob(p, c):
            x = min(max(p[0], 0), 14)
            for dx in (0, 1):
                for dy in (-1, 0): put(x + dx, p[1] + dy, c)
        # round wooden plinth: top seen from above (rows 25-28, back darker, lit front lip), front band, tinted outline
        PLATE = {24: (4, 11), 25: (3, 12), 26: (2, 13), 27: (2, 13), 28: (2, 13), 29: (2, 13), 30: (3, 12), 31: (4, 11)}
        for y, (a, b) in PLATE.items():
            for x in range(a, b + 1):
                if y in (24, 31) or x in (a, b): c = OUTL
                elif y == 25: c = WOOD
                elif y in (26, 27): c = WOOD_L
                elif y == 28: c = hx('f4b370')
                elif y == 29: c = WOOD
                else: c = WOOD_D
                put(x, y, c)
        for y in range(15, 27):
            put(7, y, BR_L); put(8, y, BR_D)
        for x in (6, 9): put(x, 27, BR_D)
        put(7, 27, BR); put(8, 27, BR_D)
        p1 = pts[(k * len(pts)) // n]
        p2 = inner[(-2 * k * len(inner) // n) % len(inner)]
        back1, back2 = p1[1] <= 14, p2[1] <= 14
        for x, y in pts:
            if y <= 14: put(x, y, BR_D if y == 12 else BR)
        if back2: blob(p2, PINK)
        if back1: blob(p1, BLUE)
        for x in (7, 8): put(x, 11, SUNR)
        put(6, 12, SUNR); put(7, 12, SUN); put(8, 12, SUN); put(9, 12, SUNR)
        put(6, 13, SUNR); put(7, 13, SUN); put(8, 13, SUN2); put(9, 13, SUNR)
        for x in (7, 8): put(x, 14, SUNR)
        for x, y in pts:
            if y >= 15: put(x, y, BR_HI if (y == 17 and x < 8) else BR_L)
        if not back2: blob(p2, PINK)
        if not back1: blob(p1, BLUE)
        out.append(im)
    return out


# ---------------------------------------------------------------- animated bodies: edit static pixels only
def static_edit(fr, fn):
    """Apply fn to frame 0 and copy the change to every frame, but never touch pixels that animate."""
    W, H = fr[0].size
    anim = {(x, y) for f in fr[1:] for y in range(H) for x in range(W) if f.getpixel((x, y)) != fr[0].getpixel((x, y))}
    e = fn(fr[0].copy())
    out = []
    for f in fr:
        g = f.copy(); gp = g.load(); ep = e.load()
        for y in range(H):
            for x in range(W):
                if (x, y) not in anim: gp[x, y] = ep[x, y]
        out.append(g)
    return out


def console_body(im):
    """Front face was one flat slate fill: three door panels with seams, lit left edge, top-of-front shade, vents, kick plate."""
    px = im.load()
    FACE, LIT, SEAM, DARK, VENT = hx('40454f'), hx('596470'), hx('2a2e36'), hx('22262e'), hx('808996')
    OUTL = hx('1f2433')
    # deck = the console's top, seen from above: back edge darker, plane lighter than the front face, lit front lip (row 20)
    for x in range(1, 31):
        if px[x, 15][:3] == hx('596470')[:3]: px[x, 15] = hx('4a5463')
        for y in (16, 18): 
            if px[x, y][:3] == hx('596470')[:3]: px[x, y] = hx('6c7787')
        if px[x, 17][:3] == hx('596470')[:3]: px[x, 17] = hx('6c7787')
        if px[x, 19][:3] == hx('596470')[:3]: px[x, 19] = hx('7f8a99')
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][3] and px[x, y][:3] == hx('110f12')[:3]: px[x, y] = OUTL
    for y in range(21, 31):
        for x in range(1, 31):
            c = FACE
            if y == 21: c = DARK                      # shade under the deck lip
            if x in (1, 2): c = LIT if y > 21 else c
            if x == 30: c = SEAM
            if x in (10, 20) and y > 21: c = SEAM
            if x in (11, 21) and y > 21: c = LIT
            if y >= 29: c = DARK                      # kick plate
            px[x, y] = c
    for x0 in (3, 12, 22):                            # vents on each door
        for vy in (24, 26):
            for x in range(x0 + 1, x0 + 6): px[x, vy] = SEAM
            px[x0 + 1, vy - 1] = VENT
    return im


def slot_body(im):
    """Body was one flat crimson fill: lit left edge, shaded right, gold trim round the reels, coin tray, panel seam."""
    px = im.load()
    BODY, LIT, SHD, GOLD, GOLDD, TRAY = hx('952136'), hx('c43c4e'), hx('6b1426'), hx('d5b152'), hx('66480a'), hx('1e1e24')
    for y in range(23, 43):
        if px[3, y][:3] == BODY[:3]: px[3, y] = LIT
        if px[12, y][:3] == BODY[:3]: px[12, y] = SHD
    for x in range(4, 12):
        px[x, 26] = GOLD; px[x, 34] = GOLDD
    px[3, 26] = GOLD; px[12, 26] = GOLDD
    for x in range(4, 12): px[x, 37] = SHD                 # panel seam under the reels
    for x in range(5, 11):                                 # coin tray
        px[x, 39] = GOLD; px[x, 40] = TRAY; px[x, 41] = GOLDD
    return im


def confessional(im):
    """Cornice had no roof plane (cross on a mid-brown front band). Light the roof as a 3-row plane with a lit lip;
    the gold cross moves to the cornice front."""
    px = im.load(); W = im.width
    xs = [x for x in range(W) if px[x, 9][:3] == hx('744e2c')[:3] or px[x, 9][:3] == hx('c09020')[:3]]
    a, b = min(xs), max(xs)
    for x in range(a, b + 1):
        px[x, 9] = hx('9e684b')
        px[x, 10] = hx('b77246') if h2(x, 10) % 6 else hx('9e684b')
        px[x, 11] = hx('b77246') if h2(x, 11) % 7 else hx('c07c4c')
        px[x, 12] = hx('d59147')
        px[x, 13] = hx('744e2c')
    cx = 22
    for x in (cx - 1, cx, cx + 1): px[x, 13] = hx('c09020')
    px[cx, 14] = hx('c09020')
    return im


def slug(s):
    return ''.join(ch if ch.isalnum() else '_' for ch in s).strip('_')


def build():
    """{object id: [frames]} for every redrawn prop."""
    res = {}
    for oid in CAB_IDS:
        res[oid] = [cabinet(f) for f in frames(oid)]
    res['helmet shelf'] = [helmet_shelf(f) for f in frames('helmet shelf')]
    res['orrery'] = orrery_frames(len(frames('orrery')))
    res['control console'] = static_edit(frames('control console'), console_body)
    res['slot machine'] = static_edit(frames('slot machine'), slot_body)
    res['confessional'] = [confessional(f) for f in frames('confessional')]
    # interior-plus pieces: the fix lives in scripts/content/interior-plus/pieces/*.py (source of truth); paste the same
    # render here so the sheet matches the source without re-running the whole plus bake
    sys.path.insert(0, os.path.join(ROOT, 'scripts/content/interior-plus'))
    import loader, iplib
    reg = loader.load()
    for pid in PLUS:
        res[pid] = [iplib.render(reg.pieces[pid])]
    # same final step as build_tileset.py: snap to the shared interior palette v6
    sys.path.insert(0, os.path.join(ROOT, 'scripts/content/hand-interior-pick'))
    import palette_snap
    return {k: [palette_snap.snap(f)[0] for f in v] for k, v in res.items()}


PLUS = ['relic cabinet', 'wide cabinet', 'ship bunk']
KIND = {'helmet shelf': 'tall_furniture', 'confessional': 'tall_furniture', 'slot machine': 'tall_furniture',
        'control console': 'low_furniture', 'orrery': 'other'}


def gate_rows():
    """object-gate batch rows (frame 0 = the drawing as placed)."""
    rows = []
    for oid in sorted(build()):
        if oid in PLUS: continue   # judged as atlas_biome_interior/plus/<id> by scripts/content/interior-plus/gate_export.py
        rows.append(dict(png=os.path.join(OUT, slug(oid) + '.png'), kind=KIND.get(oid, 'tall_furniture'),
                         name=f"{SPEC['objects'][oid].get('ko', oid)} ({oid})", label=f'atlas_biome_interior/props34/{oid}'))
    return rows


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    res = build()
    for oid, fr in res.items():
        fr[0].save(os.path.join(OUT, slug(oid) + '.png'))
        if len(fr) > 1:
            strip = Image.new('RGBA', (fr[0].width * len(fr), fr[0].height))
            for k, f in enumerate(fr): strip.alpha_composite(f, (k * f.width, 0))
            strip.save(os.path.join(OUT, slug(oid) + '.frames.png'))
    with open(os.path.join(OUT, 'gate-items.jsonl'), 'w') as f:
        for r in gate_rows(): f.write(json.dumps(r, ensure_ascii=False) + '\n')
    print(len(res), 'props →', OUT)
