"""Monk / bard retro2003 skill FX helpers.

Coordinate-drawn pixel art only: no source images, resampling, blur or antialiasing.
Builds on the Cel primitives and checks in lib_scout.py; adds a contract assertion and the
shared monk (fist, palm, dragon, chi) and bard (notes, staff ribbons, Z glyphs) shapes.
Each <key>.py defines KEY, SIZE, FRAMES, ANCHOR, PAL and draw(c, f), then calls run(globals()).
'python3 lib_monk.py' regenerates every monk/bard sheet plus .omo/pixel-fx/{monk,bard}-{sheet,composite}.png.

Colour identity
  monk  gold / orange fire (MONK), earth browns for ground work (EARTH), blue only for chi (CHI)
  bard  rainbow notes (RAINBOW) on a dark plum outline; lullaby leans blue (DREAM), requiem violet (SOUL)

Cell conventions (src/assets/retroClassSkills.ts header is canonical):
  user/target/allTargets/allAllies  feet on row SIZE-8, body centre at the cell centre
  screen                            128px cell covering the whole stage
  projectile                        32px loop, head facing LEFT (allies stand right, enemies left)
"""
import importlib
import math
import re
import sys
from pathlib import Path

import lib_scout
from lib_scout import (BG, OUT, REVIEW, ROOT, Cel, board, class_sheet, composite, ease, lerp, pal, pick, pol, rgba, rng,
                       WHITE)

CONTRACT = ROOT / 'src/assets/retroClassSkills.ts'

MONK_KEYS = ['monk_fist_flurry', 'monk_rising_kick', 'monk_chi_orb', 'monk_chi_burst', 'monk_iron_body', 'monk_whirl_kick',
             'monk_meditate', 'monk_earth_palm', 'monk_dragon_aura', 'monk_dragon_hit']
BARD_KEYS = ['bard_notes_red', 'bard_notes_blue', 'bard_sonic_wave', 'bard_sonic_hit', 'bard_hymn', 'bard_discord',
             'bard_tempo', 'bard_requiem_sky', 'bard_requiem_hit', 'bard_finale_stage', 'bard_finale_hit']

# Ink families. The same key always means the same colour across a class.
MONK = dict(k='#2a1206', o0='#6a2208', o1='#c24a12', o2='#f0801e', y1='#ffb42a', y2='#ffe050', y3='#fff8c0')
EARTH = dict(t0='#3a2412', t1='#6e4a28', t2='#a8804c', t3='#d6b880')
CHI = dict(c0='#10306a', c1='#2468d0', c2='#58c0ff', c3='#c0f2ff')
RAINBOW = dict(n0='#241438', rr='#ee3a52', ro='#ff8e2a', ry='#ffe04a', rg='#4cd05c', rb='#3c8cff', rv='#a85ce8', rp='#ffa6d6')
DREAM = dict(b0='#141c48', b1='#27449a', b2='#5a8cf0', b3='#a8d4ff')
SOUL = dict(v0='#160a28', v1='#36205e', v2='#6a46ac', v3='#b49ce8', v4='#e6deff')
HUES = ['rr', 'ro', 'ry', 'rg', 'rb', 'rv']


# --------------------------------------------------------------------------- contract

def contract():
    text = CONTRACT.read_text(encoding='utf8')
    layers = {}
    for m in re.finditer(r'classId: "(\w+)".*?layers: \[(.*?)\] \}', text):
        for l in re.finditer(r'key: "(\w+)", anchor: "(\w+)", frame: (\d+), frames: (\d+)', m.group(2)):
            layers.setdefault(l.group(1), dict(cls=m.group(1), anchor=l.group(2), frame=int(l.group(3)), frames=int(l.group(4))))
    return layers


def run(mod, quiet=False):
    spec = contract().get(mod['KEY'])
    got = dict(anchor=mod['ANCHOR'], frame=mod['SIZE'], frames=mod['FRAMES'])
    assert spec, f"{mod['KEY']}: not in {CONTRACT.name}"
    want = {k: spec[k] for k in got}
    assert got == want, f"{mod['KEY']}: script {got} != contract {want}"
    return lib_scout.run(mod, quiet)


# --------------------------------------------------------------------------- shared shapes

def star(c, x, y, n, r0, r1, k, rot=0.0, squash=1.0):
    """n-point starburst polygon (comic 'pow'): alternating outer r0 / inner r1."""
    pts = []
    for i in range(n * 2):
        a = rot + i * math.pi / n
        r = r0 if i % 2 == 0 else r1
        pts.append((x + math.cos(a) * r, y + math.sin(a) * r * squash))
    c.poly(pts, k)


def pow_burst(c, x, y, r, keys, rot=0.0, n=8):
    """Layered impact star: keys dark->white, each layer smaller."""
    m = len(keys)
    for i, k in enumerate(keys):
        s = 1 - i / (m + 0.4)
        star(c, x, y, n, r * s, r * s * 0.46, k, rot + i * 0.12)
    c.disc(x, y, max(1, r * 0.16), keys[-1])


def burst(c, cx, cy, t, n, seed, keys, spd=(8, 22), grav=0.0, squash=1.0, size=(1, 2), up=0.0, spread=None):
    """Radial particles at normalised time t (0..1). Hot keys first, cooling as t rises; they shrink as they fly."""
    r = rng(seed)
    for i in range(n):
        a = r.uniform(0, 2 * math.pi) if spread is None else r.uniform(*spread)
        v = r.uniform(*spd)
        s = r.uniform(*size)
        d = v * ease(t)
        x = cx + math.cos(a) * d
        y = cy + math.sin(a) * d * squash + grav * t * t * 20 - up * t * 20
        life = r.uniform(0.75, 1.1)
        if t > life:
            continue
        ki = min(len(keys) - 1, int(t / life * len(keys) + (i % 2) * 0.5))
        rr = s * (1 - 0.6 * t / life)
        if rr >= 1.4:
            c.spark(x, y, rr + 0.6, keys[ki], keys[min(len(keys) - 1, ki + 1)])
        elif rr >= 0.9:
            c.disc(x, y, 1, keys[ki])
        else:
            c.px(x, y, keys[ki])


def converge(c, cx, cy, t, n, seed, keys, r0=26, r1=4, squash=1.0, trail=3):
    """Motes streaking inward to (cx, cy) at time t (0..1) with short tails."""
    r = rng(seed)
    for i in range(n):
        a = r.uniform(0, 2 * math.pi)
        d0 = r0 * r.uniform(0.75, 1.15)
        d = lerp(d0, r1, ease(t))
        x, y = pol(cx, cy, d, a, squash)
        tx, ty = pol(cx, cy, d + trail + 2 * (1 - t), a, squash)
        c.line([(tx, ty), (x, y)], keys[0])
        c.px(x, y, keys[-1] if i % 2 else keys[min(1, len(keys) - 1)])


def fist(c, x, y, s, keys, streak=10):
    """Fist punching LEFT with its knuckles at x. keys = (outline, body, light, shine)."""
    ol, body, lt, sh = keys
    w, h = 5 * s, 4 * s
    for k, g in ((ol, 1), (body, 0)):
        c.rect(x - g, y - h / 2 - g, x + w + g, y + h / 2 + g, k)
        c.rect(x + w - 1 - g, y - h / 2 + s - g, x + w + 2 * s + g, y + h / 2 - s + g, k)  # wrist
    c.rect(x, y - h / 2, x + w - 1, y - h / 2 + s - 1, lt)                                # top light
    for j in range(1, 4):                                                               # finger creases
        yy = y - h / 2 + j * h / 4
        c.line([(x, yy), (x + s, yy)], ol)
    c.line([(x + s + 1, y + h / 2 - 1), (x + w - 1, y + h / 2 - 1)], ol)                  # thumb line
    c.px(x + 1, y - h / 2 + 1, sh)
    for j in range(3):                                                                  # speed streaks
        yy = y - h / 2 + 1 + j * (h - 2) / 2
        c.line([(x + w + 2 * s + 2, yy), (x + w + 2 * s + streak - j * 3, yy)], lt if j == 1 else body)


def palm(c, x, y, s, k, grow=0):
    """Open palm facing the viewer, fingers up, heel at (x, y). Hand width about 10*s.
    grow > 0 fattens for an outline pass, grow < 0 shrinks for inner light."""
    g = grow
    c.rect(x - 4 * s - g, y - 8 * s - g, x + 4 * s + g, y + g, k)                          # palm
    for dx, L in ((-3.3, 5.5), (-1.1, 7), (1.1, 6.5), (3.3, 5)):                          # fingers, 1*s gaps
        cx0 = x + dx * s
        c.rect(cx0 - 0.6 * s - g, y - (8 + L) * s - g, cx0 + 0.6 * s + g, y - 7 * s + g, k)
        c.disc(cx0, y - (8 + L) * s, 0.6 * s + g, k)
    c.poly([(x + 4 * s + g, y - 3 * s + g), (x + 7.5 * s + g, y - 7.5 * s - g), (x + 8.5 * s + g, y - 6.5 * s),
            (x + 4 * s + g, y - 0.5 * s + g)], k)                                          # thumb


def clear(c, fn, *args):
    """Run a shape helper with fully transparent ink (ImageDraw writes RGBA straight, no blending)."""
    c.pal['_'] = (0, 0, 0, 0)
    fn(c, *args)


def dragon(c, path, head_t, tail_t, rad, keys, scale_k, head_s=1.0, eye='w', whisker=None):
    """Sinuous dragon along path(t)->(x, y). Body spans tail_t..head_t; rad(u) gives radius for u in 0..1 (tail->head).
    keys = (rim, body, light, belly-shine). Draws a head at the front facing along the path."""
    rim, body, lt, hi = keys
    if head_t <= tail_t:
        return
    steps = max(10, int((head_t - tail_t) * 160))
    pts = [path(lerp(tail_t, head_t, i / steps)) for i in range(steps + 1)]
    rs = [rad(i / steps) for i in range(steps + 1)]
    for layer, k, dr, off in ((0, rim, 1.2, 0), (1, body, 0, 0), (2, lt, -1.6, -1)):
        for (x, y), r in zip(pts, rs):
            if r + dr > 0.5:
                c.disc(x + off * 0.4, y + off, r + dr, k)
    for i in range(0, len(pts), 3):                                                     # scale ticks + spine fins
        (x, y), r = pts[i], rs[i]
        if r > 2.2:
            c.px(x, y + r * 0.35, hi if (i // 3) % 2 else scale_k)
        if r > 3 and (i // 3) % 2 == 0 and i + 1 < len(pts):
            nx, ny = pts[i + 1][0] - x, pts[i + 1][1] - y
            L = math.hypot(nx, ny) or 1
            px_, py_ = ny / L, -nx / L
            if py_ > 0:
                px_, py_ = -px_, -py_
            c.line([(x + px_ * r, y + py_ * r), (x + px_ * (r + 2.5) - nx / L * 2, y + py_ * (r + 2.5) - ny / L * 2)], lt)
    hx, hy = pts[-1]
    bx, by = pts[-2]
    ang = math.atan2(hy - by, hx - bx)
    dragon_head(c, hx, hy, ang, rad(1.0) * head_s, keys, eye, whisker)


def dragon_head(c, x, y, ang, r, keys, eye='w', whisker=None):
    """Eastern dragon head at (x, y) facing along ang: long snout, open jaw with fangs,
    swept-back horns and a flame mane. r is the skull radius in px."""
    rim, body, lt, hi = keys
    ux, uy = math.cos(ang), math.sin(ang)
    vx, vy = -uy, ux
    if vy > 0:  # keep the crown on the upper side of the head
        vx, vy = -vx, -vy

    def P(a, b):  # a along the snout, b toward the crown
        return (x + ux * a * r + vx * b * r, y + uy * a * r + vy * b * r)

    mane = [[P(-0.6, 0.9), P(-2.0, 0.9), P(-1.0, 0.3)], [P(-0.7, 0.2), P(-2.3, -0.1), P(-0.9, -0.4)],
            [P(-0.5, -0.5), P(-1.8, -1.2), P(-0.4, -0.9)]]
    horns = [[P(-0.2, 0.8), P(-2.4, 2.0), P(-2.1, 1.6), P(0.1, 0.5)], [P(0.4, 0.85), P(-1.3, 2.1), P(-1.1, 1.7), P(0.6, 0.6)]]
    upper = [P(-0.6, 0.9), P(0.9, 0.95), P(2.9, 0.55), P(3.1, 0.2), P(2.9, 0.0), P(0.6, 0.05)]
    lower = [P(0.3, -0.05), P(2.5, -0.55), P(2.4, -0.85), P(0.2, -0.75), P(-0.5, -0.4)]
    skull = [P(-0.9, 0.7), P(0.4, 1.0), P(1.0, 0.3), P(0.4, -0.6), P(-0.8, -0.6)]

    def grow(poly_, g):
        cx_ = sum(p[0] for p in poly_) / len(poly_)
        cy_ = sum(p[1] for p in poly_) / len(poly_)
        out = []
        for px_, py_ in poly_:
            dx, dy = px_ - cx_, py_ - cy_
            L = math.hypot(dx, dy) or 1
            out.append((px_ + dx / L * g, py_ + dy / L * g))
        return out

    for poly_ in mane:
        c.poly(grow(poly_, 1), rim)
        c.poly(poly_, lt)
    for poly_ in horns:
        c.poly(grow(poly_, 1), rim)
        c.poly(poly_, hi)
    for poly_ in (skull, upper, lower):
        c.poly(grow(poly_, 1.2), rim)
    c.poly(lower, body)
    c.poly(skull, body)
    c.poly(upper, body)
    c.poly([P(-0.5, 0.85), P(0.9, 0.9), P(2.8, 0.5), P(1.0, 0.55)], lt)          # snout light
    c.line([P(0.6, 0.02), P(2.9, 0.02)], rim)                                    # mouth line
    for a_ in (1.2, 1.9, 2.6):                                                    # fangs
        c.px(*P(a_, -0.15), hi)
    c.px(*P(2.95, 0.4), rim)                                                     # nostril
    ex, ey = P(0.35, 0.55)
    c.line([P(-0.1, 0.85), P(0.8, 0.75)], rim, 2)                                # brow
    c.disc(ex, ey, max(1, r * 0.18), hi)
    c.px(ex, ey, eye)
    if whisker:
        c.line([P(2.8, 0.45), P(3.6, 1.2), P(4.2, 1.1), P(4.8, 1.7)], whisker)
        c.line([P(2.3, -0.7), P(3.0, -1.4), P(3.7, -1.3), P(4.2, -2.0)], whisker)


def flame_tongue(c, x, y, h, w, keys, seed=0, lean=0.0):
    """Upward flame lick with base centred at (x, y). keys dark->white, each inner layer shorter and thinner."""
    r = rng(seed)
    wob = r.uniform(-1, 1)
    for i, k in enumerate(keys):
        s = 1 - i * 0.24
        hh, ww = h * s, w * s
        tip = (x + lean * hh + wob, y - hh)
        c.poly([(x - ww, y), (x - ww * 0.8 + lean * hh * 0.3, y - hh * 0.45), tip,
                (x + ww * 0.8 + lean * hh * 0.4, y - hh * 0.5), (x + ww, y)], k)
        c.oval(x, y - 0.5, ww, max(1, ww * 0.5), k)


def shade(c, cx, cy, r, k, squash=1.0, dense=None):
    """Stage dimming for screen sheets: 50% checker inside r, 25% in a 12px rim, nothing beyond.
    Never a solid fill, so battlers under the sheet stay readable and the 128px cell edge never shows."""
    dense = dense or k
    for y in range(c.n):
        for x in range(c.n):
            d = math.hypot(x - cx, (y - cy) / squash)
            if d <= r:
                if (x + y) % 2 == 0:
                    c.px(x, y, k)
            elif d <= r + 12 and (x + y) % 2 == 0 and y % 2 == 0:
                c.px(x, y, dense)


# --------------------------------------------------------------------------- bard shapes

def _note_parts(x, y, kind, s):
    """Primitive list for one note glyph with its head centred at (x, y)."""
    hx, hy = x, y
    stem_x = hx + 1.6 * s
    top = hy - 7 * s
    parts = [('oval', hx, hy, 2.2 * s, 1.6 * s), ('rect', stem_x - 0.5 * s, top, stem_x + 0.5 * s, hy - 0.4 * s)]
    if kind == 8:
        parts.append(('line', [(stem_x, top), (stem_x + 2.6 * s, top + 2.4 * s), (stem_x + 2.4 * s, top + 4.6 * s)], max(1, int(s))))
    elif kind == 16:
        parts.append(('line', [(stem_x, top), (stem_x + 2.6 * s, top + 2.2 * s), (stem_x + 2.4 * s, top + 3.8 * s)], max(1, int(s))))
        parts.append(('line', [(stem_x, top + 2.2 * s), (stem_x + 2.6 * s, top + 4.4 * s), (stem_x + 2.4 * s, top + 6 * s)], max(1, int(s))))
    elif kind == 2:  # beamed pair
        x2, y2 = hx + 5.5 * s, hy - 1 * s
        s2 = x2 + 1.6 * s
        parts += [('oval', x2, y2, 2.2 * s, 1.6 * s), ('rect', s2 - 0.5 * s, top - s, s2 + 0.5 * s, y2 - 0.4 * s),
                  ('beam', [(stem_x - 0.5 * s, top), (s2 + 0.5 * s, top - s), (s2 + 0.5 * s, top + 0.6 * s * 2), (stem_x - 0.5 * s, top + 1.2 * s * 2)])]
    return parts


def note(c, x, y, k, kind=8, s=1.0, ol='n0', hi='w'):
    """Musical note glyph (kind 4 quarter, 8 eighth, 16 sixteenth, 2 beamed pair) with a 1px dark outline."""
    parts = _note_parts(x, y, kind, s)
    for pass_, col in ((1, ol), (0, k)):
        for p in parts:
            if p[0] == 'oval':
                _, px_, py_, rx, ry = p
                c.oval(px_, py_, rx + pass_, ry + pass_, col)
            elif p[0] == 'rect':
                _, x0, y0, x1, y1 = p
                c.rect(x0 - pass_, y0 - pass_, x1 + pass_, y1 + pass_, col)
            elif p[0] == 'line':
                c.line(p[1], col, p[2] + 2 * pass_)
            elif p[0] == 'beam':
                pts = p[1]
                if pass_:
                    pts = [(pts[0][0] - 1, pts[0][1] - 1), (pts[1][0] + 1, pts[1][1] - 1), (pts[2][0] + 1, pts[2][1] + 1), (pts[3][0] - 1, pts[3][1] + 1)]
                c.poly(pts, col)
    if hi and s >= 1:
        c.px(x - 1 * s, y - 0.6 * s, hi)


def clef(c, x, y, k, s=1.0, ol='n0'):
    """Stylised treble clef, centre of the curl at (x, y)."""
    pts = [(x + 0.5 * s, y + 9 * s), (x - 0.5 * s, y + 10 * s), (x - 1.5 * s, y + 9 * s), (x, y + 7.5 * s), (x + 1 * s, y + 3 * s),
           (x + 1.2 * s, y - 4 * s), (x + 2.8 * s, y - 8 * s), (x + 2.2 * s, y - 10 * s), (x + 0.5 * s, y - 8 * s), (x - 0.5 * s, y - 3 * s),
           (x - 3 * s, y + 0.5 * s), (x - 2.5 * s, y + 3.5 * s), (x + 0.5 * s, y + 4.5 * s), (x + 3 * s, y + 3 * s), (x + 2.5 * s, y),
           (x + 0.2 * s, y - 0.5 * s), (x - 0.8 * s, y + 1.5 * s)]
    c.line(pts, ol, max(1, int(s)) + 2)
    c.line(pts, k, max(1, int(s)))


def staff(c, x0, x1, yc, gap, amp, freq, phase, keys, lines=5, step=1, clip=None):
    """Wavy staff ribbon: 'lines' parallel sine lines. keys cycle per line. clip(x)->bool hides columns."""
    for i in range(lines):
        k = keys[i % len(keys)]
        pts = []
        x = x0
        while x <= x1:
            if clip and not clip(x):
                if len(pts) > 1:
                    c.line(pts, k)
                pts = []
            else:
                pts.append((x, yc + (i - (lines - 1) / 2) * gap + amp * math.sin(freq * x + phase)))
            x += step
        if len(pts) > 1:
            c.line(pts, k)


def zglyph(c, x, y, s, k, ol='n0'):
    pts = [(x - s, y - s), (x + s, y - s), (x - s, y + s), (x + s, y + s)]
    c.line(pts, ol, 3)
    c.line(pts, k, 1)


def heart(c, x, y, s, k, ol=None):
    if ol:
        heart(c, x, y, s + 1, ol)
    c.disc(x - s * 0.5, y - s * 0.3, s * 0.55, k)
    c.disc(x + s * 0.5, y - s * 0.3, s * 0.55, k)
    c.poly([(x - s * 1.05, y - s * 0.15), (x + s * 1.05, y - s * 0.15), (x, y + s * 0.95)], k)


def chevron(c, x, y, s, k, ol=None, up=True):
    d = -1 if up else 1
    pts = [(x - s, y - d * s * 0.2), (x, y + d * s * 0.8), (x + s, y - d * s * 0.2)]
    pts = [(px_, py_ - d * s) for px_, py_ in pts]
    if ol:
        c.line(pts, ol, 4)
    c.line(pts, k, 2)


# --------------------------------------------------------------------------- batch

def main(keys=None):
    sys.path.insert(0, str(lib_scout.HERE))
    groups = {'monk': MONK_KEYS, 'bard': BARD_KEYS}
    bad = 0
    for cls, names in groups.items():
        results = []
        for key in names:
            if keys and key not in keys and cls not in keys:
                continue
            try:
                mod = importlib.import_module(key)
            except ModuleNotFoundError as err:
                if err.name == key:
                    print(f'--- {key} missing')
                    continue
                raise
            res = run(vars(mod))
            bad += res[0].startswith('BAD')
            results.append(res)
        if results and len(results) == len(names):
            class_sheet(cls, results)
            composite(cls, results)
    return bad


if __name__ == '__main__':
    sys.exit(1 if main(sys.argv[1:] or None) else 0)

