"""Shared primitives + review tools for the retro2003 druid / witch class FX sheets.

Builds on lib_mage (index canvas, Pal, Cel, checks). Adds the contract assertion (frame/frames/anchor are read
back from src/assets/retroClassSkills.ts and a mismatch aborts the build), class ramps, and plant / bat / sigil
primitives. All shapes are aliased integer-coordinate masks; fades use checker dither only.

Colour identity
    druid  LEAF green · BARK brown · MOON silver (+ BLOOM pink blossoms)
    witch  HEX violet · TOXIC poison green (+ BLOOD crimson for life drain, GLASS lilac-silver for the mirror)

    python3 scripts/asset-gen/pixel-fx/lib_druid.py              # every druid/witch sheet + review
    python3 scripts/asset-gen/pixel-fx/lib_druid.py witch_hex    # listed sheets only
    python3 scripts/asset-gen/pixel-fx/witch_hex.py              # one sheet
"""
from pathlib import Path
from PIL import Image
import importlib, math, random, re, sys

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path: sys.path.insert(0, str(HERE))
import lib_mage as LM
from lib_mage import Pal, Cel, jag, ease, lerp, orbit, hexrgb, OUT, REVIEW, BG, ROOT

CONTRACT = ROOT / 'src/assets/retroClassSkills.ts'
CLASSES = {
    'class_druid': ['druid_thorn', 'druid_regrowth', 'druid_swarm', 'druid_bark', 'druid_roots', 'druid_moonbeam',
                    'druid_bear_spirit', 'druid_claw', 'druid_world_tree', 'druid_tree_hit'],
    'class_witch': ['witch_hex', 'witch_frog_puff', 'witch_cauldron', 'witch_poison_hit', 'witch_drain_beam',
                    'witch_drain_orb', 'witch_bat_swarm', 'witch_mirror', 'witch_nightmare_sky', 'witch_nightmare_hit',
                    'witch_sabbath_sky', 'witch_sabbath_hit'],
}

# 64px cells: feet row 8px above the bottom, body centre above it.
GY, CX, CY = 56, 32, 40

# ---- ramps (dark -> white) ----
LEAF = ['#0c2616', '#17502a', '#2a8a3a', '#4fc24a', '#9ae86a', '#e2ffb8', '#ffffff']
BARK = ['#24140c', '#4e2e1a', '#80522e', '#b8824c']
MOON = ['#1e2648', '#4a5a8e', '#94a6d6', '#d6e2ff', '#ffffff']
BLOOM = ['#a8305e', '#f07aa8', '#ffd0e4']
AMBER = ['#c89a1e', '#ffe066']
HEX = ['#0e0618', '#261040', '#4a1c7a', '#7a34b8', '#b066f0', '#e2b8ff', '#ffffff']
TOXIC = ['#0e2a12', '#1c5e22', '#3aa02c', '#8ae43a', '#e0ff8c']
BLOOD = ['#4a0a22', '#a01c44', '#ff4c70', '#ffb0c0']
GLASS = ['#6a6aa0', '#b4b8e8', '#eef0ff']
IRON = ['#2a2a3a', '#50506a', '#8a8aa6']


def contract():
    text = CONTRACT.read_text(encoding='utf8')
    out = {}
    for m in re.finditer(r'key: "(\w+)", anchor: "(\w+)", frame: (\d+), frames: (\d+)', text):
        out.setdefault(m.group(1), {'anchor': m.group(2), 'frame': int(m.group(3)), 'frames': int(m.group(4))})
    return out


# ---------------- primitives ----------------

def rng(key, salt=0):
    return random.Random(f'{key}:{salt}')


def vine(c, pts, w0, w1, dark, mid, hi=None):
    """Tapered stroke: dark rim (w+2), mid body, 1px lit edge on the upper-left side."""
    n = max(1, len(pts) - 1)
    ws = [max(1, round(lerp(w0, w1, i / n))) for i in range(n)]
    for i in range(n): c.line([pts[i], pts[i + 1]], dark, ws[i] + 2)
    for i in range(n): c.line([pts[i], pts[i + 1]], mid, ws[i])
    if hi is None: return
    for i in range(n):
        if ws[i] < 3: continue
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        ln = math.hypot(x1 - x0, y1 - y0) or 1
        nx, ny = (y1 - y0) / ln, -(x1 - x0) / ln
        if nx + ny > 0: nx, ny = -nx, -ny
        c.line([(x0 + nx, y0 + ny), (x1 + nx, y1 + ny)], hi)


def thorn(c, x, y, ang, ln, col, tip=None):
    dx, dy = math.cos(ang), math.sin(ang)
    nx, ny = -dy, dx
    c.poly([(x + nx * 1.4, y + ny * 1.4), (x + dx * ln, y + dy * ln), (x - nx * 1.4, y - ny * 1.4)], col)
    if tip is not None: c.px(x + dx * ln, y + dy * ln, tip)


def leaf(c, x, y, ang, ln, col, vein=None):
    dx, dy = math.cos(ang), math.sin(ang)
    nx, ny = -dy, dx
    wd = max(1.0, ln * .36)
    c.poly([(x, y), (x + dx * ln * .4 + nx * wd, y + dy * ln * .4 + ny * wd), (x + dx * ln, y + dy * ln),
            (x + dx * ln * .4 - nx * wd, y + dy * ln * .4 - ny * wd)], col)
    if vein is not None and ln >= 4: c.line([(x, y), (x + dx * ln * .75, y + dy * ln * .75)], vein)


def petal5(c, x, y, r, col, core, rot=0.0):
    for k in range(5):
        px_, py_ = orbit(x, y, r * .6, rot + k * math.tau / 5)
        c.disc(px_, py_, max(1, r * .45), col)
    c.px(x, y, core)


def bat(c, x, y, s, phase, body, eye=None, rim=None):
    """Bat silhouette; phase 0 wings up, 1 level, 2 down. s = scale (1 = 15px span)."""
    tip = [-5, -1, 3][phase % 3] * s
    for sg in (-1, 1):
        pts = [(x + sg * 1 * s, y - 1 * s), (x + sg * 4 * s, y + tip * .55 - 1 * s), (x + sg * 7.5 * s, y + tip),
               (x + sg * 6 * s, y + tip * .35 + 1.5 * s), (x + sg * 4.5 * s, y + 1.2 * s), (x + sg * 3 * s, y + 2 * s),
               (x + sg * 1.5 * s, y + 1.5 * s)]
        c.poly(pts, body, outline=rim)
    c.disc(x, y, 1.6 * s, body, 2.2 * s)
    c.px(x - 1, y - 2.5 * s, body); c.px(x + 1, y - 2.5 * s, body)
    if eye is not None:
        c.px(x - 1, y - 1, eye); c.px(x + 1, y - 1, eye)


def pentagram(c, cx, cy, r, col, ry=None, rot=-math.pi / 2, ring=True, w=1, upto=1.0):
    ry = r if ry is None else ry
    pts = [(cx + math.cos(rot + k * math.tau / 5) * r, cy + math.sin(rot + k * math.tau / 5) * ry) for k in range(5)]
    order = [0, 2, 4, 1, 3, 0]
    segs = [(pts[order[i]], pts[order[i + 1]]) for i in range(5)]
    total = upto * 5
    for i, (a, b) in enumerate(segs):
        u = max(0.0, min(1.0, total - i))
        if u <= 0: break
        c.line([a, (lerp(a[0], b[0], u), lerp(a[1], b[1], u))], col, w)
    if ring:
        if upto >= 1: c.ring(cx, cy, r + 2, col, w, ry + 2 * ry / r)
        else: c.arc(cx, cy, r + 2, -90, -90 + 360 * upto, col, w, ry + 2 * ry / r)
    return pts


def skull(c, x, y, s, col, hole, rim=None):
    if rim is not None: c.disc(x, y, 3.2 * s + 1, rim, 2.8 * s + 1); c.rect(x - 2 * s - 1, y + 1.5 * s, x + 2 * s + 1, y + 4 * s + 1, rim)
    c.disc(x, y, 3.2 * s, col, 2.8 * s)
    c.rect(x - 2 * s, y + 1.5 * s, x + 2 * s, y + 4 * s, col)
    c.rect(x - 2 * s + (s > 1), y - .5 * s, x - .8 * s, y + .8 * s, hole)
    c.rect(x + .8 * s, y - .5 * s, x + 2 * s - (s > 1), y + .8 * s, hole)
    c.px(x, y + 1.8 * s, hole)
    if s >= 2:
        for k in (-1, 1): c.px(x + k * s, y + 3.6 * s, hole)


def rays(c, cx, cy, n, r0, r1, col, rot=0.0, w=1, ry=1.0, alt=None):
    for k in range(n):
        a = rot + k * math.tau / n
        rr = r1 if (alt is None or k % 2 == 0) else alt
        c.line([(cx + math.cos(a) * r0, cy + math.sin(a) * r0 * ry), (cx + math.cos(a) * rr, cy + math.sin(a) * rr * ry)], col, w)


def wedge(c, cx, cy, a, r0, r1, w, col, ry=1.0):
    x0, y0 = cx + math.cos(a) * r0, cy + math.sin(a) * r0 * ry
    x1, y1 = cx + math.cos(a) * r1, cy + math.sin(a) * r1 * ry
    nx, ny = -math.sin(a) * w, math.cos(a) * w
    c.poly([(x0 + nx, y0 + ny), (x1, y1), (x0 - nx, y0 - ny)], col)


def puff(c, x, y, r, cols):
    c.disc(x, y, r, cols[0])
    if len(cols) > 1: c.disc(x - r * .2, y - r * .2, r * .72, cols[1])
    if len(cols) > 2: c.disc(x - r * .38, y - r * .38, r * .38, cols[2])


def bubble(c, x, y, r, rim, hi):
    c.ring(x, y, r, rim)
    c.px(x - max(1, r * .5), y - max(1, r * .5), hi)


def plus(c, x, y, r, col, core=None):
    c.rect(x - r, y - 1, x + r, y, col); c.rect(x - 1, y - r, x, y + r, col)
    if core is not None: c.px(x, y - 1, core); c.px(x - 1, y, core)


def arrow_down(c, x, y, h, col, rim):
    c.rect(x - 2, y - h, x + 1, y - 3, rim); c.poly([(x - 5, y - 4), (x + 4, y - 4), (x, y + 1), (x - 1, y + 1)], rim)
    c.rect(x - 1, y - h + 1, x, y - 4, col); c.poly([(x - 3, y - 3), (x + 2, y - 3), (x, y - 1), (x - 1, y - 1)], col)


def converge(c, cx, cy, streaks, t, col, head, ry=1.0, tail=4):
    """Streaks flying inward: streaks = [(angle, start radius)], t 0->1."""
    for a, r0 in streaks:
        r = r0 * (1 - t) + 2
        x, y = cx + math.cos(a) * r, cy + math.sin(a) * r * ry
        x2, y2 = cx + math.cos(a) * (r + tail), cy + math.sin(a) * (r + tail) * ry
        c.line([(x, y), (x2, y2)], col); c.px(x, y, head)


def fade(c, on, fn, phase=0):
    """Draw fn solid, or checker-dithered when on is true (trailing afterglow)."""
    c.dither(fn, phase) if on else fn(c)


# ---------------- build + checks ----------------

def check(key, frame, frames):
    r = LM.check(key, frame, frames)
    im = Image.open(OUT / f'{key}.png').convert('RGBA')
    cells = [im.crop((i * frame, 0, (i + 1) * frame, frame)) for i in range(frames)]
    ink = [sum(1 for a in cl.getchannel('A').getdata() if a) for cl in cells]
    diffs = [sum(1 for p, q in zip(cells[i].getdata(), cells[i + 1].getdata()) if p != q) for i in range(frames - 1)]
    weak = [i for i, d in enumerate(diffs) if d < max(8, .05 * min(ink[i], ink[i + 1]))]
    if weak: r['errors'].append(f'low motion after {weak}'); r['ok'] = False
    r['ink'] = ink; r['diffs'] = diffs
    return r


def load(key):
    return importlib.import_module(key)


def make(key, review=True):
    m = load(key)
    spec = contract().get(key)
    assert spec, f'{key} missing from contract'
    assert (spec['frame'], spec['frames'], spec['anchor']) == (m.FRAME, m.FRAMES, m.ANCHOR), \
        f'{key}: script {m.FRAME}x{m.FRAMES} {m.ANCHOR} != contract {spec}'
    assert len(m.PAL.colors) <= 16
    LM.build(key, m.FRAME, m.FRAMES, m.PAL, m.draw)
    r = check(key, m.FRAME, m.FRAMES)
    if review: LM.preview(key, m.FRAME); LM.gif(key, m.FRAME)
    print(('OK  ' if r['ok'] else 'FAIL'), key, r['size'], 'colours', r['colours'], 'minFill', r['minFill'],
          'minDiff', r['minDiff'], *r['errors'])
    return r


def class_sheet(cls):
    rows = []
    for i, key in enumerate(CLASSES[cls]):
        m = load(key); fr = m.FRAME
        sc = 1 if fr == 128 else (4 if fr == 32 else 2)
        cells = LM.cells_of(key, fr); s = fr * sc
        row = Image.new('RGBA', (len(cells) * (s + 2) + 2, s + 16), (12, 14, 24, 255))
        LM._label(row, 2, 2, str(i), 2, (140, 220, 255, 255))
        for j, cl in enumerate(cells):
            row.paste(Image.new('RGBA', (s, s), BG), (2 + j * (s + 2), 14))
            row.alpha_composite(cl.resize((s, s), Image.NEAREST), (2 + j * (s + 2), 14))
        rows.append(row)
    w = max(r.width for r in rows); h = sum(r.height for r in rows)
    img = Image.new('RGBA', (w, h), (12, 14, 24, 255)); y = 0
    for r in rows: img.paste(r, (0, y)); y += r.height
    path = REVIEW / f'{cls.split("_")[1]}-sheet.png'; img.save(path); return path


def composite(cls):
    """Stage panels 320x180 on #202840: slime (enemy, left) and actor1-0 (ally, right) at 2x, FX at 2x."""
    actor = Image.open(ROOT / 'public/assets/generated/charset-battlers/actor1-0.png').convert('RGBA').crop((0, 0, 48, 48)).resize((96, 96), Image.NEAREST)
    slime = Image.open(ROOT / 'public/assets/generated/pixel-enemies/slime.png').convert('RGBA').crop((0, 0, 48, 48)).resize((96, 96), Image.NEAREST)
    W, H = 320, 180
    enemy_feet, ally_feet = (78, 150), (244, 132)
    panels = []
    for i, key in enumerate(CLASSES[cls]):
        m = load(key); fr, n, anchor = m.FRAME, m.FRAMES, m.ANCHOR
        side = getattr(m, 'SIDE', 'enemy')
        for f in (getattr(m, 'PEAK', None) or [n // 3, n // 2, n - 2]):
            p = Image.new('RGBA', (W, H), BG)
            p.alpha_composite(Image.new('RGBA', (W, 34), (0x2a, 0x34, 0x52, 255)), (0, 146))
            p.alpha_composite(slime, (enemy_feet[0] - 48, enemy_feet[1] - 88))
            p.alpha_composite(actor, (ally_feet[0] - 48, ally_feet[1] - 88))
            cell = LM.cells_of(key, fr)[f].resize((fr * 2, fr * 2), Image.NEAREST)
            if anchor in ('user', 'allAllies') or (anchor == 'target' and side == 'ally'):
                p.alpha_composite(cell, (ally_feet[0] - fr, ally_feet[1] - (fr - 8) * 2))
            elif anchor in ('target', 'allTargets'):
                p.alpha_composite(cell, (enemy_feet[0] - fr, enemy_feet[1] - (fr - 8) * 2))
            elif anchor == 'screen':
                p.alpha_composite(cell, (W // 2 - fr, H // 2 - fr))
            else:   # projectile: three positions along the flight from ally hand to enemy
                for k, u in enumerate((.2, .5, .8)):
                    x = int(lerp(ally_feet[0] - 30, enemy_feet[0] + 30, u)); y = int(lerp(100, 110, u))
                    p.alpha_composite(LM.cells_of(key, fr)[(f + k) % n].resize((fr * 2, fr * 2), Image.NEAREST), (x - fr, y - fr))
            LM._label(p, 4, 4, str(i), 2, (140, 220, 255, 255)); LM._label(p, 30, 4, str(f), 2)
            panels.append(p)
    cols = 6; rows = math.ceil(len(panels) / cols)
    img = Image.new('RGBA', (cols * (W + 4), rows * (H + 4)), (8, 8, 12, 255))
    for i, p in enumerate(panels): img.paste(p, ((i % cols) * (W + 4), (i // cols) * (H + 4)))
    path = REVIEW / f'{cls.split("_")[1]}-composite.png'; img.save(path); return path


def run(keys=None, review=True):
    keys = keys or [k for ks in CLASSES.values() for k in ks]
    results = [make(k, review) for k in keys]
    if review:
        for cls, ks in CLASSES.items():
            if not set(ks) & set(keys): continue
            if not all((OUT / f'{k}.png').exists() and (HERE / f'{k}.py').exists() for k in ks): continue
            print(class_sheet(cls)); print(composite(cls))
    return results


if __name__ == '__main__':
    res = run(sys.argv[1:] or None)
    sys.exit(0 if all(r['ok'] for r in res) else 1)

