"""Scout / ranger retro2003 skill FX helpers.

Coordinate-drawn pixel art only: no source images, resampling, blur or antialiasing.
Each <key>.py defines KEY, SIZE, FRAMES, ANCHOR, PAL and draw(c, f), then calls run(globals()).
'python3 lib_scout.py' regenerates every scout/ranger sheet plus the review boards in .omo/pixel-fx/.

Cell conventions (src/assets/retroClassSkills.ts header is canonical):
  user/target/allTargets/allAllies  feet on row SIZE-8, body centre at the cell centre
  screen                            128px cell covering the whole stage
  projectile                        32px loop, head facing LEFT (allies shoot right -> left)
"""
import importlib
import math
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = ROOT / 'public/assets/generated/pixel-fx'
REVIEW = ROOT / '.omo/pixel-fx'
BG = (0x20, 0x28, 0x40, 255)

SCOUT = ['scout_flurry', 'scout_venom', 'scout_shadow_puff', 'scout_backstab', 'scout_bomb', 'scout_smoke',
         'scout_steal', 'scout_afterimage', 'scout_knife', 'scout_knife_hit', 'scout_assassin_cut', 'scout_assassin_hit']
RANGER = ['ranger_arrow', 'ranger_power_hit', 'ranger_charge', 'ranger_arrow_hit', 'ranger_fire_arrow', 'ranger_fire_hit',
          'ranger_frost_arrow', 'ranger_frost_hit', 'ranger_arrow_rain', 'ranger_scope', 'ranger_leaves',
          'ranger_storm_charge', 'ranger_storm_bolt', 'ranger_storm_hit']

# Shared ink families. Sheets pick the keys they need; the same key always means the same colour,
# so layers of one skill (shadow puff -> backstab, storm charge -> bolt -> hit) stay continuous.
SHADOW = dict(k='#120a22', d='#2c1a4c', m='#54348a', v='#8c5cd4', l='#c8a8f6')
STEEL = dict(s0='#3a4864', s1='#8aa4c8', s2='#dcefff')
CRIMSON = dict(r0='#5c0c28', r1='#c82848', r2='#ff8c98')
VENOM = dict(g0='#173222', g1='#2f6e2e', g2='#5fb23c', g3='#aef062', g4='#eeffb8', p1='#7a3496', p2='#c070e0')
SMOKE = dict(q0='#262c3c', q1='#4a5268', q2='#7c86a0', q3='#b4bccf', q4='#e8edf6')
GOLD = dict(y0='#7a4a10', y1='#d8961e', y2='#ffd84a', y3='#fff6b8')
WOOD = dict(t0='#3c2410', t1='#7a4c22', t2='#b88040')
FIRE = dict(e0='#5a1418', e1='#b02c20', e2='#f06a20', e3='#ffb840', e4='#fff4a0')
FROST = dict(i0='#182e5c', i1='#2e64a8', i2='#5aaee0', i3='#a8e8fa', i4='#eaffff')
LEAF = dict(l0='#1e4028', l1='#3c7a34', l2='#78b83c', l3='#bce070', l4='#f0ffc0')
STORM = dict(z0='#241650', z1='#4c34a0', z2='#8a76e8', z3='#58c8ff', z4='#c8f4ff', zy='#fff08a')
WHITE = dict(w='#ffffff')


def pal(*families, **extra):
    out = {}
    for fam in families:
        out.update(fam)
    out.update(extra)
    return out


def pick(src, *keys):
    return {k: src[k] for k in keys}


def rgba(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def lerp(a, b, t):
    return a + (b - a) * t


def ease(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 2


def rng(seed):
    return random.Random(seed)


def pol(cx, cy, r, a, squash=1.0):
    return (cx + math.cos(a) * r, cy + math.sin(a) * r * squash)


class Cel:
    """One frame. Every fill is a palette key; ImageDraw with integer coords never antialiases."""

    def __init__(self, n, palette):
        self.n = n
        self.pal = {k: rgba(v) for k, v in palette.items()}
        self.im = Image.new('RGBA', (n, n), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)

    @staticmethod
    def _p(pts):
        return [(int(round(x)), int(round(y))) for x, y in pts]

    def px(self, x, y, k):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < self.n and 0 <= y < self.n:
            self.im.putpixel((x, y), self.pal[k])

    def line(self, pts, k, w=1):
        pts = self._p(pts)
        if len(pts) == 1 or all(p == pts[0] for p in pts):
            self.px(*pts[0], k)
            return
        self.d.line(pts, fill=self.pal[k], width=w)
        if w > 2:  # round joints so thick polylines don't notch
            for x, y in pts:
                self.disc(x, y, (w - 1) / 2, k)

    def disc(self, x, y, r, k):
        if r < 0.6:
            self.px(x, y, k)
            return
        self.d.ellipse((round(x - r), round(y - r), round(x + r), round(y + r)), fill=self.pal[k])

    def oval(self, x, y, rx, ry, k, w=0):
        box = (round(x - rx), round(y - ry), round(x + rx), round(y + ry))
        if box[2] <= box[0] or box[3] <= box[1]:
            self.px(x, y, k)
            return
        if w:
            self.d.ellipse(box, outline=self.pal[k], width=w)
        else:
            self.d.ellipse(box, fill=self.pal[k])

    def ring(self, x, y, r, k, w=1, squash=1.0):
        self.oval(x, y, r, r * squash, k, w)

    def arc(self, x, y, r, a0, a1, k, w=1, squash=1.0):
        """Degrees, clockwise from +x (PIL convention, y down)."""
        box = (round(x - r), round(y - r * squash), round(x + r), round(y + r * squash))
        if box[2] > box[0] and box[3] > box[1]:
            self.d.arc(box, a0, a1, fill=self.pal[k], width=w)

    def poly(self, pts, k, outline=None):
        self.d.polygon(self._p(pts), fill=self.pal[k], outline=self.pal[outline] if outline else None)

    def rect(self, x0, y0, x1, y1, k):
        if x1 < x0 or y1 < y0:
            return
        self.d.rectangle((round(x0), round(y0), round(x1), round(y1)), fill=self.pal[k])

    def spark(self, x, y, r, core, arm=None, diag=False):
        """Four-point twinkle; r is the arm length in pixels."""
        arm = arm or core
        r = int(round(r))
        if r <= 0:
            self.px(x, y, core)
            return
        self.line([(x - r, y), (x + r, y)], arm)
        self.line([(x, y - r), (x, y + r)], arm)
        if diag and r >= 3:
            q = max(1, r // 2)
            self.line([(x - q, y - q), (x + q, y + q)], arm)
            self.line([(x - q, y + q), (x + q, y - q)], arm)
        if r >= 3:
            q = max(1, r // 3)
            self.line([(x - q, y), (x + q, y)], core)
            self.line([(x, y - q), (x, y + q)], core)
            if r >= 6:
                self.disc(x, y, 1, core)
        self.px(x, y, core)

    def diamond(self, x, y, rx, ry, k):
        self.poly([(x, y - ry), (x + rx, y), (x, y + ry), (x - rx, y)], k)

    def rays(self, x, y, n, r0, r1, k, w=1, rot=0.0, jitter=None, squash=1.0):
        for i in range(n):
            a = rot + i * 2 * math.pi / n
            rr = r1 if not jitter else r1 * jitter[i % len(jitter)]
            self.line([pol(x, y, r0, a, squash), pol(x, y, rr, a, squash)], k, w)

    def dring(self, x, y, r, k, parity=0, squash=1.0):
        """1px ring on a checkerboard: regular dither only on fading edges."""
        steps = int(2 * math.pi * max(r, 1) * 2) + 8
        seen = set()
        for i in range(steps):
            a = i * 2 * math.pi / steps
            p = (int(round(x + math.cos(a) * r)), int(round(y + math.sin(a) * r * squash)))
            if p not in seen and (p[0] + p[1] + parity) % 2 == 0:
                seen.add(p)
                self.px(*p, k)

    def ddisc(self, x, y, r, k, parity=0, squash=1.0):
        ry = r * squash
        for yy in range(int(y - ry) - 1, int(y + ry) + 2):
            for xx in range(int(x - r) - 1, int(x + r) + 2):
                if ((xx - x) / max(r, .5)) ** 2 + ((yy - y) / max(ry, .5)) ** 2 <= 1 and (xx + yy + parity) % 2 == 0:
                    self.px(xx, yy, k)

    def outline(self, k):
        """Dark 1px rim around every inked pixel (4-neighbourhood)."""
        a = self.im.getchannel('A').load()
        n = self.n
        rim = []
        for y in range(n):
            for x in range(n):
                if a[x, y]:
                    continue
                if (x > 0 and a[x - 1, y]) or (x < n - 1 and a[x + 1, y]) or (y > 0 and a[x, y - 1]) or (y < n - 1 and a[x, y + 1]):
                    rim.append((x, y))
        for p in rim:
            self.im.putpixel(p, self.pal[k])

    def blade(self, p0, p1, bulge, th, keys, frac=1.0):
        """Crescent sweep from p0 toward p1 bowing out by 'bulge' px (sign picks the side).
        Layers run dark->white, each lighter one thinner and hugging the cutting edge.
        frac < 1 draws only the leading part of the sweep."""
        (x0, y0), (x1, y1) = p0, p1
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        L = math.hypot(x1 - x0, y1 - y0)
        nx, ny = -(y1 - y0) / L, (x1 - x0) / L
        s = abs(bulge)
        if bulge < 0:
            nx, ny = -nx, -ny
        s = min(max(s, 0.5), L / 2 - 0.5)
        r = (L * L / 4 + s * s) / (2 * s)
        cx, cy = mx - nx * (r - s), my - ny * (r - s)
        a0 = math.atan2(y0 - cy, x0 - cx)
        a1 = math.atan2(y1 - cy, x1 - cx)
        da = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
        steps = max(8, int(abs(da) * r / 1.5))
        n = len(keys)
        for i, k in enumerate(keys):
            t_th = th * (n - i) / n
            outer, inner = [], []
            for j in range(steps + 1):
                u = j / steps
                a = a0 + da * frac * u
                taper = math.sin(math.pi * u)
                outer.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
                ri = r - max(0.0, t_th * taper)
                inner.append((cx + math.cos(a) * ri, cy + math.sin(a) * ri))
            self.poly(outer + inner[::-1], k)

    def streak(self, p0, p1, layers):
        for k, w in layers:
            self.line([p0, p1], k, w)

    def bolt(self, p0, p1, seed, keys, segs=6, jitter=4.0, widths=None):
        """Jagged lightning polyline, layered wide-dark to thin-white. Returns the vertex list."""
        r = rng(seed)
        (x0, y0), (x1, y1) = p0, p1
        L = math.hypot(x1 - x0, y1 - y0) or 1
        nx, ny = -(y1 - y0) / L, (x1 - x0) / L
        pts = [p0]
        for i in range(1, segs):
            t = i / segs
            o = r.uniform(-jitter, jitter)
            pts.append((lerp(x0, x1, t) + nx * o, lerp(y0, y1, t) + ny * o))
        pts.append(p1)
        widths = widths or [max(1, 2 * (len(keys) - i) - 1) for i in range(len(keys))]
        for k, w in zip(keys, widths):
            self.line(pts, k, w)
        return pts

    def arrow(self, x, y, ang, length, shaft, head, fletch, hi=None, fletch2=None, head_len=5, head_w=2.5):
        """Arrow with its tip at (x, y) pointing along ang (radians)."""
        ux, uy = math.cos(ang), math.sin(ang)
        vx, vy = -uy, ux
        bx, by = x - ux * head_len, y - uy * head_len
        tx, ty = x - ux * length, y - uy * length
        self.line([(bx, by), (tx, ty)], shaft)
        for j in range(3):
            fx, fy = tx + ux * (1 + j * 1.6), ty + uy * (1 + j * 1.6)
            self.line([(fx, fy), (fx - ux * 2 + vx * 2, fy - uy * 2 + vy * 2)], fletch)
            self.line([(fx, fy), (fx - ux * 2 - vx * 2, fy - uy * 2 - vy * 2)], fletch2 or fletch)
        self.poly([(x, y), (bx + vx * head_w, by + vy * head_w), (bx + ux, by + uy), (bx - vx * head_w, by - vy * head_w)], head)
        if hi:
            self.line([(x, y), (x - ux * (head_len - 1), y - uy * (head_len - 1))], hi)

    def leaf(self, x, y, ang, L, body, vein, edge=None):
        ux, uy = math.cos(ang), math.sin(ang)
        vx, vy = -uy, ux
        w = max(1.2, L * 0.36)
        tip = (x + ux * L / 2, y + uy * L / 2)
        tail = (x - ux * L / 2, y - uy * L / 2)
        c = (x + vx * w * 0.2, y + vy * w * 0.2)
        self.poly([tip, (c[0] + vx * w, c[1] + vy * w), tail, (c[0] - vx * w * 0.7, c[1] - vy * w * 0.7)], body, outline=edge)
        self.line([tail, tip], vein)

    def puff(self, x, y, r, keys, seed=0, lobes=5):
        """Cartoon smoke/cloud blob: lobed discs, lighter layers offset up-left.
        Each lighter layer only keeps the upper lobes so the body reads as soft vapour, not stone."""
        rr = rng(seed)
        offs = [(rr.uniform(-1, 1) * r * 0.55, rr.uniform(-1, 1) * r * 0.35, rr.uniform(0.55, 0.8)) for _ in range(lobes)]
        for i, k in enumerate(keys):
            shrink = 1 - i * 0.22
            dx, dy = -i * r * 0.12, -i * r * 0.16
            for j, (ox, oy, s) in enumerate(offs):
                if i >= 2 and oy > 0 and j % 2:
                    continue
                self.disc(x + ox * shrink + dx, y + oy * shrink + dy, max(0.5, r * s * shrink), k)

    def cloud(self, x, y, r, keys, seed=0, lobes=9, parity=0):
        """Billowing cloud: bumpy rim of small lobes around a body, light caps on top lobes,
        and a dithered rim of the darkest ink so the edge dissolves instead of ending like rock."""
        rr = rng(seed)
        ring_lobes = [(a, rr.uniform(0.3, 0.45)) for a in [j * 2 * math.pi / lobes + rr.uniform(-.2, .2) for j in range(lobes)]]
        self.ddisc(x, y, r * 1.18, keys[0], parity=parity, squash=0.85)
        self.oval(x, y, r * 0.8, r * 0.62, keys[0])
        for a, s in ring_lobes:
            self.disc(x + math.cos(a) * r * 0.72, y + math.sin(a) * r * 0.55, r * s, keys[0])
        for a, s in ring_lobes:
            self.disc(x + math.cos(a) * r * 0.66 - 1, y + math.sin(a) * r * 0.5 - 1, r * s - 1.5, keys[1])
        self.oval(x - 1, y - 1, r * 0.66, r * 0.48, keys[1])
        if len(keys) > 2:
            for a, s in ring_lobes:
                if math.sin(a) < 0.2:
                    self.disc(x + math.cos(a) * r * 0.6 - 2, y + math.sin(a) * r * 0.46 - 2, r * s * 0.7 - 1, keys[2])
        if len(keys) > 3:
            for a, s in ring_lobes:
                if math.sin(a) < -0.4:
                    self.disc(x + math.cos(a) * r * 0.56 - 3, y + math.sin(a) * r * 0.44 - 3, max(1, r * s * 0.35), keys[3])


# --------------------------------------------------------------------------- output + checks

def render(mod):
    frames = []
    for f in range(mod['FRAMES']):
        c = Cel(mod['SIZE'], mod['PAL'])
        mod['draw'](c, f)
        frames.append(c.im)
    return frames


def check(size, nframes, sheet, frames):
    problems = []
    if sheet.size != (size * nframes, size):
        problems.append(f'size {sheet.size}')
    alpha = set(sheet.getchannel('A').tobytes())
    if not alpha <= {0, 255}:
        problems.append(f'alpha {sorted(alpha)[:6]}')
    colours = sheet.getcolors(1 << 20)
    inks = {c for _, c in colours if c[3]}
    total = len(inks) + (1 if any(c[3] == 0 for _, c in colours) else 0)
    if total > 16:
        problems.append(f'{total} colours > 16')
    counts = []
    for i, fr in enumerate(frames):
        n = sum(1 for a in fr.getchannel('A').tobytes() if a)
        counts.append(n)
        if n == 0:
            problems.append(f'frame {i} empty')
    diffs = []
    for i in range(1, len(frames)):
        a, b = frames[i - 1].tobytes(), frames[i].tobytes()
        dcount = sum(1 for j in range(0, len(a), 4) if a[j:j + 4] != b[j:j + 4])
        diffs.append(dcount)
        if dcount < max(8, size * size // 200):
            problems.append(f'frames {i-1}->{i} barely differ ({dcount}px)')
    return problems, total, counts, diffs


def board(frames, scale, label=True, bg=BG, gap=4):
    size = frames[0].size[0]
    cell = size * scale
    top = 14 if label else 0
    im = Image.new('RGBA', (len(frames) * (cell + gap) + gap, cell + top + gap * 2), bg)
    d = ImageDraw.Draw(im)
    font = ImageFont.load_default()
    for i, fr in enumerate(frames):
        x = gap + i * (cell + gap)
        d.rectangle((x - 1, top + gap - 1, x + cell, top + gap + cell), outline=(0x34, 0x40, 0x60, 255))
        im.alpha_composite(fr.resize((cell, cell), Image.NEAREST), (x, top + gap))
        if label:
            d.text((x + 2, 2), str(i), fill=(0xf0, 0xf0, 0xa0, 255), font=font)
    return im


def gif(key, frames):
    size = frames[0].size[0]
    out = []
    for fr in frames:
        base = Image.new('RGBA', (size * 2, size * 2), BG)
        base.alpha_composite(fr.resize((size * 2, size * 2), Image.NEAREST))
        out.append(base.convert('RGB').convert('P', palette=Image.ADAPTIVE, colors=32))
    out[0].save(REVIEW / f'{key}.gif', save_all=True, append_images=out[1:], duration=80, loop=0, disposal=1)


def run(mod, quiet=False):
    key, size, n = mod['KEY'], mod['SIZE'], mod['FRAMES']
    frames = render(mod)
    sheet = Image.new('RGBA', (size * n, size), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        sheet.paste(fr, (i * size, 0))
    problems, total, counts, diffs = check(size, n, sheet, frames)
    OUT.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / f'{key}.png', optimize=True)
    back = Image.open(OUT / f'{key}.png').convert('RGBA')
    if back.tobytes() != sheet.tobytes():
        problems.append('png roundtrip changed pixels')
    board(frames, 4).save(REVIEW / f'{key}-preview.png')
    gif(key, frames)
    status = 'OK ' if not problems else 'BAD'
    line = (f'{status} {key:<22} {mod["ANCHOR"]:<10} {size}px x{n} sheet={sheet.size[0]}x{sheet.size[1]} '
            f'colours={total} minpx={min(counts)} mindiff={min(diffs) if diffs else "-"}')
    if problems:
        line += ' :: ' + '; '.join(problems)
    if not quiet:
        print(line)
    return line, frames, mod


# --------------------------------------------------------------------------- review boards

def class_sheet(name, results):
    rows = []
    font = ImageFont.load_default()
    for line, frames, mod in results:
        scale = 128 // mod['SIZE']
        b = board(frames, scale)
        lab = Image.new('RGBA', (b.size[0], 14), BG)
        ImageDraw.Draw(lab).text((4, 1), f'{mod["KEY"]}  {mod["ANCHOR"]}  {mod["SIZE"]}px x{mod["FRAMES"]}', fill=(255, 255, 255, 255), font=font)
        rows += [lab, b]
    W = max(r.size[0] for r in rows)
    H = sum(r.size[1] for r in rows)
    out = Image.new('RGBA', (W, H), BG)
    y = 0
    for r in rows:
        out.alpha_composite(r, (0, y))
        y += r.size[1]
    out.save(REVIEW / f'{name}-sheet.png')


def _cell(path, size=48):
    return Image.open(path).convert('RGBA').crop((0, 0, size, size)).resize((size * 2, size * 2), Image.NEAREST)


def composite(name, results):
    """Stage mock-up in screen px (all art at 2x): slime left, actor right, FX anchored like the runtime."""
    actor = _cell(ROOT / 'public/assets/generated/charset-battlers/actor1-0.png')
    slime = _cell(ROOT / 'public/assets/generated/pixel-enemies/slime.png')
    PW, PH = 400, 260
    enemy_c, enemy_feet = 96, 220
    actor_c, actor_feet = 300, 212
    font = ImageFont.load_default()
    panels = []
    for line, frames, mod in results:
        n = mod['FRAMES']
        picks = sorted({1, n // 2, n - 2}) if mod['ANCHOR'] != 'projectile' else [0, 1, 2]
        row = []
        for fi in picks:
            p = Image.new('RGBA', (PW, PH), BG)
            d = ImageDraw.Draw(p)
            d.line((0, 222, PW, 222), fill=(0x2c, 0x36, 0x54, 255))
            p.alpha_composite(slime, (enemy_c - 48, enemy_feet - 88))
            p.alpha_composite(actor, (actor_c - 48, actor_feet - 90))
            s = mod['SIZE'] * 2
            fx = frames[fi].resize((s, s), Image.NEAREST)
            a = mod['ANCHOR']
            if a in ('target', 'allTargets'):
                pos = (enemy_c - s // 2, enemy_feet - (s - 16))
            elif a in ('user', 'allAllies'):
                pos = (actor_c - s // 2, actor_feet - (s - 16))
            elif a == 'screen':
                pos = (PW // 2 - s // 2, 150 - s // 2)
            else:
                pos = (PW // 2 - s // 2 + (1 - fi) * 40, actor_feet - 50 - s // 2)
            p.alpha_composite(fx, pos)
            d.text((4, 4), f'{mod["KEY"]} #{fi}', fill=(255, 255, 255, 255), font=font)
            row.append(p)
        panels.append(row)
    cols = 3
    out = Image.new('RGBA', (cols * (PW + 4), len(panels) * (PH + 4)), (0x10, 0x14, 0x20, 255))
    for r, row in enumerate(panels):
        for ci, p in enumerate(row):
            out.alpha_composite(p, (ci * (PW + 4), r * (PH + 4)))
    out.save(REVIEW / f'{name}-composite.png')


def main(keys=None):
    sys.path.insert(0, str(HERE))
    groups = {'class_scout': SCOUT, 'class_ranger': RANGER}
    bad = 0
    for cls, names in groups.items():
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
            class_sheet(cls, results)
            composite(cls, results)
    return bad


if __name__ == '__main__':
    sys.exit(1 if main(sys.argv[1:] or None) else 0)
