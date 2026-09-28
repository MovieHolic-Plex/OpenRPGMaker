"""Samurai / ninja retro2003 skill FX helpers.

Coordinate-drawn pixel art only: no source images, resampling, blur or antialiasing.
Each <key>.py defines KEY, SIZE, FRAMES, ANCHOR, PAL and draw(c, f), then calls run(globals()).
'python3 lib_samurai.py' rebuilds every samurai/ninja sheet plus the review boards in .omo/pixel-fx/.
SIZE / FRAMES / ANCHOR are checked against src/assets/retroClassSkills.ts before anything is written.

Colour identity
  samurai  indigo night + white steel + sakura pink (thunder adds gold, blood moon adds crimson)
  ninja    violet shadow + iron grey (fire / water / paralysis add their element ink)

Cell conventions (contract header is canonical):
  user/target/allTargets/allAllies  feet on row SIZE-8, body centre at the cell centre
  screen                            128px cell covering the whole stage
  projectile                        32px loop, head facing LEFT
"""
import importlib
import math
import re
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from lib_scout import (Cel, rgba, lerp, ease, rng, pol, pal, pick, check, board, gif,  # noqa: E402
                       class_sheet, composite, OUT, REVIEW, ROOT, BG)

CONTRACT = ROOT / 'src/assets/retroClassSkills.ts'

SAMURAI = ['samurai_iai_flash', 'samurai_sheath', 'samurai_moon', 'samurai_wind_wave', 'samurai_wind_hit',
           'samurai_mind_eye', 'samurai_cherry', 'samurai_petals', 'samurai_thunder_line', 'samurai_thunder_hit',
           'samurai_blood_moon', 'samurai_blood_hit', 'samurai_final_sky', 'samurai_final_slash']
NINJA = ['ninja_shuriken', 'ninja_shuriken_hit', 'ninja_kunai', 'ninja_kunai_hit', 'ninja_fire_breath',
         'ninja_log_puff', 'ninja_clone_smoke', 'ninja_clone_hit', 'ninja_water_dragon', 'ninja_splash',
         'ninja_needle', 'ninja_paralyze', 'ninja_thousand_sky', 'ninja_thousand_hit']

# Ink families: one key always means one colour so the layers of a skill stay continuous.
INDIGO = dict(n0='#0a0c26', n1='#1a2460', n2='#2e48a4', n3='#5c86e0', n4='#aac4ff')
SAKURA = dict(s0='#561436', s1='#b02e68', s2='#ec6a9e', s3='#ffb0cc', s4='#ffe4ee')
BOLT = dict(y0='#7a4c12', y1='#e0a424', y2='#ffe45c', y3='#fffac4')
BLOOD = dict(r0='#300612', r1='#7c0e26', r2='#cc2438', r3='#ff6c64', r4='#ffc0a8')
NIGHT = dict(v0='#120822', v1='#2e1654', v2='#5e30a0', v3='#9c62e6', v4='#dcc0ff')
IRON = dict(i0='#20242e', i1='#464e60', i2='#8690a6', i3='#c6cedc')
FLAME = dict(e0='#521018', e1='#aa2a1c', e2='#ec6420', e3='#ffb43c', e4='#fff29a')
WATER = dict(a0='#0a1a40', a1='#16489a', a2='#2a86de', a3='#68d2f4', a4='#c6f6ff')
SPARK = dict(g0='#26360e', g1='#62921a', g2='#b2dc2c', g3='#eeff8c')
SMOKEV = dict(q0='#241e36', q1='#484060', q2='#7a7090', q3='#b0a8c4', q4='#e4e0f0')
LOG = dict(t0='#3a220e', t1='#744a20', t2='#b27e3e', t3='#e0b87a')
WHITE = dict(w='#ffffff')

CX, CY, FEET = 32, 34, 56  # 64px actor-anchored cells


class Ink(Cel):
    """Cel plus erase ('_' = transparent) and the samurai/ninja motifs."""

    def __init__(self, n, palette):
        super().__init__(n, palette)
        self.pal['_'] = (0, 0, 0, 0)

    def lens(self, p0, p1, th, keys, frac=1.0):
        """Straight tapered flash from p0 to p1, widest mid-way; keys dark -> light, lighter = thinner."""
        (x0, y0), (x1, y1) = p0, p1
        L = math.hypot(x1 - x0, y1 - y0) or 1
        nx, ny = -(y1 - y0) / L, (x1 - x0) / L
        steps = max(6, int(L / 2))
        n = len(keys)
        for i, k in enumerate(keys):
            t = th * (n - i) / n
            if t < 0.9:
                self.line([(x0, y0), (lerp(x0, x1, frac), lerp(y0, y1, frac))], k)
                continue
            top, bot = [], []
            for j in range(steps + 1):
                u = j / steps * frac
                w = t * math.sin(math.pi * u) ** 0.8
                x, y = lerp(x0, x1, u), lerp(y0, y1, u)
                top.append((x + nx * w, y + ny * w))
                bot.append((x - nx * w, y - ny * w))
            self.poly(top + bot[::-1], k)

    def crescent(self, x, y, r, keys, dx, dy, cut=None):
        """Moon: layered disc (lit away from the bite) with an erased bite at (x+dx, y+dy)."""
        for i, k in enumerate(keys):
            self.disc(x - dx * 0.1 * i, y - dy * 0.1 * i, max(0.5, r - i * 0.9), k)
        self.disc(x + dx, y + dy, cut if cut is not None else r * 0.92, '_')

    def petal(self, x, y, ang, L, body, hi=None, edge=None):
        """Sakura petal: teardrop with a notched outer tip."""
        if hi not in self.pal:
            hi = None
        if L < 3.5:
            ux, uy = math.cos(ang), math.sin(ang)
            self.px(x, y, body)
            self.px(x + ux, y + uy, hi or body)
            if L >= 2.5:
                self.px(x - uy, y + ux, body)
            return
        ux, uy = math.cos(ang), math.sin(ang)
        vx, vy = -uy, ux
        base = (x - ux * L / 2, y - uy * L / 2)
        tip = (x + ux * L / 2, y + uy * L / 2)
        mid = (x + ux * L * 0.1, y + uy * L * 0.1)
        pts = [base, (mid[0] + vx * L * 0.38, mid[1] + vy * L * 0.38), (tip[0] + vx * L * 0.2, tip[1] + vy * L * 0.2),
               (tip[0] - ux * L * 0.18, tip[1] - uy * L * 0.18), (tip[0] - vx * L * 0.2, tip[1] - vy * L * 0.2),
               (mid[0] - vx * L * 0.38, mid[1] - vy * L * 0.38)]
        self.poly(pts, body, outline=edge)
        if hi:
            self.line([(x - ux * L * 0.15 + vx, y - uy * L * 0.15 + vy), (x + ux * L * 0.2 + vx, y + uy * L * 0.2 + vy)], hi)

    def flower(self, x, y, r, rot, keys, core='w', dots=None):
        """Five-petal sakura; keys = (edge, body, inner)."""
        for layer, (k, s, d) in enumerate([(keys[0], 1.0, 0.52), (keys[1], 0.8, 0.5), (keys[2], 0.42, 0.3)]):
            for i in range(5):
                a = rot + i * 2 * math.pi / 5
                self.petal(x + math.cos(a) * r * d, y + math.sin(a) * r * d, a, r * s, k)
        self.disc(x, y, max(1, r * 0.16), core)
        if dots:
            for i in range(5):
                a = rot + math.pi / 5 + i * 2 * math.pi / 5
                self.px(*pol(x, y, r * 0.3, a), dots)

    def shuriken(self, x, y, r, rot, edge, body, hi, hole='_'):
        """Four-blade throwing star with hooked blades and a punched centre."""
        def star(rr, ri):
            pts = []
            for i in range(4):
                a = rot + i * math.pi / 2
                pts.append(pol(x, y, rr, a))
                pts.append(pol(x, y, ri, a + math.pi / 4 + 0.35))
            return pts
        self.poly(star(r + 1, r * 0.42 + 1), edge)
        self.poly(star(r, r * 0.42), body)
        for i in (0, 1):
            a = rot + i * math.pi / 2
            self.line([pol(x, y, r * 0.25, a), pol(x, y, r - 1, a)], hi)
        self.disc(x, y, max(0.5, r * 0.16), hole)

    def kunai(self, x, y, ang, L, edge, blade, hi, wrap, ring):
        """Kunai with its tip at (x, y) pointing along ang."""
        ux, uy = math.cos(ang), math.sin(ang)
        vx, vy = -uy, ux
        bl, bw = L * 0.45, max(1.5, L * 0.14)
        b = (x - ux * bl, y - uy * bl)
        m = (x - ux * bl * 0.62, y - uy * bl * 0.62)
        self.poly([(x + ux, y + uy), (m[0] + vx * (bw + 1), m[1] + vy * (bw + 1)), (b[0] - ux, b[1] - uy),
                   (m[0] - vx * (bw + 1), m[1] - vy * (bw + 1))], edge)
        self.poly([(x, y), (m[0] + vx * bw, m[1] + vy * bw), b, (m[0] - vx * bw, m[1] - vy * bw)], blade)
        self.line([(x - ux, y - uy), b], hi)
        e = (x - ux * L * 0.88, y - uy * L * 0.88)
        self.line([b, e], edge, 3)
        self.line([b, e], blade, 1)
        for j in range(int(L * 0.4)):
            if j % 2 == 0:
                t = bl + 1 + j
                self.px(x - ux * t + vx * 0.6, y - uy * t + vy * 0.6, wrap)
                self.px(x - ux * t, y - uy * t, wrap)
        self.ring(x - ux * L, y - uy * L, 1.5, ring)

    def flame(self, x, y, h, w, keys, lean=0.0):
        """Upward fire tongue with its base on row y; keys dark -> light, lighter layers shrink downward."""
        for i, k in enumerate(keys):
            s = 1 - i * 0.24
            ww, hh = max(0.8, w * s), h * s
            self.disc(x, y - ww, ww, k)
            self.poly([(x - ww, y - ww), (x + ww, y - ww), (x + lean * s, y - hh)], k)

    def brush(self, cx, cy, r, a0, a1, w0, w1, k, squash=1.0):
        """Brush-stroke arc in degrees (y down), width w0 -> w1."""
        steps = max(8, int(abs(a1 - a0) / 360 * 2 * math.pi * r / 1.2))
        for j in range(steps + 1):
            u = j / steps
            a = math.radians(lerp(a0, a1, u))
            self.disc(cx + math.cos(a) * r, cy + math.sin(a) * r * squash, lerp(w0, w1, u), k)

    def drect(self, x0, y0, x1, y1, k, parity=0):
        for yy in range(int(y0), int(y1) + 1):
            for xx in range(int(x0), int(x1) + 1):
                if (xx + yy + parity) % 2 == 0:
                    self.px(xx, yy, k)

    def dline(self, p0, p1, k, step=2, phase=0):
        (x0, y0), (x1, y1) = p0, p1
        n = int(max(abs(x1 - x0), abs(y1 - y0))) or 1
        for i in range(n + 1):
            if (i + phase) % step == 0:
                self.px(lerp(x0, x1, i / n), lerp(y0, y1, i / n), k)

    def ninja(self, x, feet, h, body, rim, eye, scarf=None):
        """Crouched ninja silhouette facing left (about h px tall)."""
        s = h / 26
        hy = feet - h + 4 * s
        self.line([(x - 2 * s, feet - 9 * s), (x - 6 * s, feet)], rim, 3)
        self.line([(x + 2 * s, feet - 9 * s), (x + 5 * s, feet)], rim, 3)
        self.poly([(x - 5 * s, hy + 3 * s), (x + 5 * s, hy + 3 * s), (x + 4 * s, feet - 8 * s), (x - 4 * s, feet - 8 * s)], rim)
        self.disc(x, hy, 4.5 * s, rim)
        self.line([(x - 2 * s, feet - 9 * s), (x - 5 * s, feet - 1)], body, 1)
        self.line([(x + 2 * s, feet - 9 * s), (x + 4 * s, feet - 1)], body, 1)
        self.poly([(x - 4 * s, hy + 4 * s), (x + 4 * s, hy + 4 * s), (x + 3 * s, feet - 9 * s), (x - 3 * s, feet - 9 * s)], body)
        self.disc(x, hy, 3.5 * s, body)
        self.line([(x - 5 * s, hy + 6 * s), (x - 11 * s, hy + 2 * s)], rim, 2)
        self.line([(x - 3 * s, hy - s), (x - 1 * s, hy - s)], eye)
        if scarf:
            self.line([(x + 3 * s, hy + 3 * s), (x + 8 * s, hy + 1 * s), (x + 12 * s, hy + 4 * s)], scarf, 1)


# --------------------------------------------------------------------------- contract + output

def burst_petals(c, cx, cy, n, dist, seed, drop=0.0, L=4, keys=('s1', 's2', 's3'), hi='s4', sq=1.0, a0=0.0, a1=2 * math.pi):
    """Petals thrown out from (cx, cy): random angle in [a0, a1), distance ~dist, then 'drop' px of fall."""
    r = rng(seed)
    keys = [k for k in keys if k in c.pal] or list(keys)
    for i in range(n):
        a = r.uniform(a0, a1)
        d = dist * r.uniform(0.55, 1.05)
        x = cx + math.cos(a) * d
        y = cy + math.sin(a) * d * sq + drop * r.uniform(0.5, 1.2)
        ll = L * r.uniform(0.75, 1.15)
        c.petal(x, y, r.uniform(0, 2 * math.pi), ll, keys[i % len(keys)], hi if ll >= 4 else None)


def line_petals(c, p0, p1, n, off, seed, drop=0.0, L=4, keys=('s1', 's2', 's3'), hi='s4'):
    """Petals peeling off both sides of the segment p0-p1, 'off' px away from it."""
    r = rng(seed)
    keys = [k for k in keys if k in c.pal] or list(keys)
    (x0, y0), (x1, y1) = p0, p1
    ln = math.hypot(x1 - x0, y1 - y0) or 1
    nx, ny = -(y1 - y0) / ln, (x1 - x0) / ln
    for i in range(n):
        t = r.uniform(0.05, 0.95)
        o = (1 if i % 2 else -1) * off * r.uniform(0.4, 1.1)
        x = lerp(x0, x1, t) + nx * o
        y = lerp(y0, y1, t) + ny * o + drop * r.uniform(0.5, 1.2)
        ll = L * r.uniform(0.75, 1.15)
        c.petal(x, y, r.uniform(0, 2 * math.pi), ll, keys[i % len(keys)], hi if ll >= 4 else None)


def specks(c, cx, cy, n, r0, r1, seed, keys, sq=1.0, spark_every=0, core='w'):
    r = rng(seed)
    for i in range(n):
        a = r.uniform(0, 2 * math.pi)
        d = r.uniform(r0, r1)
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d * sq
        if spark_every and i % spark_every == 0:
            c.spark(x, y, 2, core, keys[0])
        else:
            c.px(x, y, keys[i % len(keys)])


def contract():
    text = CONTRACT.read_text(encoding='utf8')
    layers = {}
    for m in re.finditer(r'key: "(\w+)", anchor: "(\w+)", frame: (\d+), frames: (\d+)', text):
        layers.setdefault(m.group(1), dict(anchor=m.group(2), frame=int(m.group(3)), frames=int(m.group(4))))
    return layers


def render(mod):
    frames = []
    for f in range(mod['FRAMES']):
        c = Ink(mod['SIZE'], mod['PAL'])
        mod['draw'](c, f)
        frames.append(c.im)
    return frames


def run(mod, quiet=False):
    key, size, n, anchor = mod['KEY'], mod['SIZE'], mod['FRAMES'], mod['ANCHOR']
    spec = contract().get(key)
    if not spec or (spec['frame'], spec['frames'], spec['anchor']) != (size, n, anchor):
        raise SystemExit(f'{key}: script {anchor} {size}px x{n} != contract {spec}')
    if len(mod['PAL']) > 15:
        raise SystemExit(f'{key}: palette has {len(mod["PAL"])} inks (+transparent > 16)')
    frames = render(mod)
    sheet = Image.new('RGBA', (size * n, size), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        sheet.paste(fr, (i * size, 0))
    problems, total, counts, diffs = check(size, n, sheet, frames)
    OUT.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / f'{key}.png', optimize=True)
    if Image.open(OUT / f'{key}.png').convert('RGBA').tobytes() != sheet.tobytes():
        problems.append('png roundtrip changed pixels')
    board(frames, 4).save(REVIEW / f'{key}-preview.png')
    gif(key, frames)
    status = 'OK ' if not problems else 'BAD'
    line = (f'{status} {key:<22} {anchor:<10} {size}px x{n} sheet={sheet.size[0]}x{sheet.size[1]} '
            f'colours={total} minpx={min(counts)} mindiff={min(diffs) if diffs else "-"}')
    if problems:
        line += ' :: ' + '; '.join(problems)
    if not quiet:
        print(line)
    return line, frames, mod


def main(keys=None):
    bad = 0
    for name, names in {'samurai': SAMURAI, 'ninja': NINJA}.items():
        results = []
        for key in names:
            if keys and key not in keys:
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
        if results and not keys:
            class_sheet(name, results)
            composite(name, results)
    return bad


if __name__ == '__main__':
    sys.exit(1 if main(sys.argv[1:] or None) else 0)
