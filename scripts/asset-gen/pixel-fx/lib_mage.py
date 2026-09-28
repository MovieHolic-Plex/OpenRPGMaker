"""Shared pixel primitives + review tools for the retro2003 mage / cleric class FX sheets.

Everything is drawn on an index canvas ('L' mode, 0 = transparent) with integer coordinates,
then mapped through the sheet palette. No resampling, blur or antialiasing is applied to the
art itself; review images only use nearest-neighbour integer upscales.

    python3 scripts/asset-gen/pixel-fx/lib_mage.py                 # every mage/cleric sheet + review
    python3 scripts/asset-gen/pixel-fx/lib_mage.py mage_fire_burst # listed sheets only
    python3 scripts/asset-gen/pixel-fx/mage_fire_burst.py          # one sheet
"""
from pathlib import Path
from PIL import Image, ImageDraw
import importlib, math, random, sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = ROOT / 'public/assets/generated/pixel-fx'
REVIEW = ROOT / '.omo/pixel-fx'
BG = (0x20, 0x28, 0x40, 255)

CLASSES = {
    'class_mage': ['mage_fireball_orb', 'mage_fire_burst', 'mage_missile_orb', 'mage_missile_hit', 'mage_blizzard',
                   'mage_snow', 'mage_chain_bolt', 'mage_gravity', 'mage_mana_shield', 'mage_meteor_rock',
                   'mage_meteor_blast', 'mage_starfall_sky', 'mage_star_hit'],
    'class_cleric': ['cleric_heal', 'cleric_smite', 'cleric_purify', 'cleric_blessing', 'cleric_mass_heal', 'cleric_halo',
                     'cleric_sanctuary', 'cleric_revive', 'cleric_judgment_cross', 'cleric_judgment_hit'],
}

# ---- shared ramps (dark -> white). Linked layers of one skill pick from the same ramp. ----
FIRE = ['#3c1022', '#7c1f26', '#c5372a', '#f06a22', '#ffa63a', '#ffd970', '#fff6cc', '#ffffff']
SMOKE = ['#2e2632', '#4c4250', '#72666e']
ROCK = ['#2a1a1a', '#553628', '#8a5a3a']
ARCANE = ['#2a1856', '#4b2ea0', '#7b55e4', '#a98eff', '#d8ccff', '#ffffff', '#6ee8ff', '#ff8ae0']
ICE = ['#142646', '#1e4c88', '#3a88c8', '#6cc6ee', '#b6eeff', '#ffffff']
BOLT = ['#241c52', '#4e36a6', '#8c70f0', '#c2b4ff', '#ffe45a', '#fff7b0', '#ffffff']
VOID = ['#000000', '#140a22', '#2c1648', '#52247a', '#8a3cb0', '#c46ae0', '#f2b4ff', '#ffffff']
MANA = ['#0e2258', '#1a48a0', '#2c7ae2', '#5cb6ff', '#a4e2ff', '#ffffff', '#ffd85a', '#fff4b0']
NIGHT = ['#080a26', '#141a48', '#232e6e', '#3a4a9a']
STAR = ['#7a5a1a', '#d4a42c', '#ffe070', '#fff8d4', '#ffffff', '#7ee2ff', '#ff9ad4']
HOLY = ['#5e3e16', '#a8782a', '#e6b43e', '#ffe274', '#fff5bc', '#ffffff']
HEAL = ['#0c463a', '#1d864e', '#43c26a', '#8eec8a', '#d6ffca', '#ffffff']
AQUA = ['#15406a', '#2584b4', '#5ccbe8', '#aaf2ff']
FILTH = ['#2c1a3a', '#5a3470', '#8c5aa6']


def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


class Pal:
    """Named ramp registry -> palette index. Pal(F=FIRE).F[3] is the index of FIRE[3]."""
    def __init__(self, **ramps):
        self.colors = []
        for name, ramp in ramps.items():
            idx = []
            for h in ramp:
                self.colors.append(hexrgb(h))
                idx.append(len(self.colors))
            setattr(self, name, idx)
        assert len(self.colors) <= 16, f'{len(self.colors)} colours'


class Cel:
    """One frame: index canvas with pixel-art primitives. Colour arguments are palette indices."""
    def __init__(self, w, h=None):
        self.w, self.h = w, h or w
        self.im = Image.new('L', (self.w, self.h), 0)
        self.d = ImageDraw.Draw(self.im)

    def px(self, x, y, c):
        x, y = round(x), round(y)
        if 0 <= x < self.w and 0 <= y < self.h: self.im.putpixel((x, y), c)

    def get(self, x, y):
        x, y = round(x), round(y)
        return self.im.getpixel((x, y)) if 0 <= x < self.w and 0 <= y < self.h else 0

    def rect(self, x0, y0, x1, y1, c):
        x0, x1 = sorted((round(x0), round(x1))); y0, y1 = sorted((round(y0), round(y1)))
        self.d.rectangle((x0, y0, x1, y1), fill=c)

    def disc(self, x, y, r, c, ry=None):
        ry = r if ry is None else ry
        if r < 0.75 and ry < 0.75: return self.px(x, y, c)
        self.d.ellipse((round(x - r), round(y - ry), round(x + r), round(y + ry)), fill=c)

    def ring(self, x, y, r, c, w=1, ry=None):
        ry = r if ry is None else ry
        if r < 1: return self.px(x, y, c)
        self.d.ellipse((round(x - r), round(y - ry), round(x + r), round(y + ry)), outline=c, width=w)

    def arc(self, x, y, r, a0, a1, c, w=1, ry=None):
        ry = r if ry is None else ry
        if r < 1: return
        self.d.arc((round(x - r), round(y - ry), round(x + r), round(y + ry)), a0, a1, fill=c, width=w)

    def line(self, pts, c, w=1):
        pts = [(round(a), round(b)) for a, b in pts]
        if len(pts) == 1: return self.px(*pts[0], c)
        self.d.line(pts, fill=c, width=w)
        if w > 2:
            for a, b in pts: self.disc(a, b, (w - 1) / 2, c)

    def poly(self, pts, c, outline=None):
        self.d.polygon([(round(a), round(b)) for a, b in pts], fill=c, outline=outline)

    def glow(self, x, y, r, ramp, ry=None):
        """Concentric shaded blob: ramp[0] outer rim ... ramp[-1] hot core."""
        n = len(ramp)
        for i, c in enumerate(ramp):
            rr = r * (1 - i / n)
            ryy = None if ry is None else ry * (1 - i / n)
            self.disc(x, y, rr, c, ryy)

    def spark(self, x, y, r, c, core=None, diag=False):
        """Plus star; r>=3 gets a 3px heart, diag adds short X arms."""
        r = round(r)
        if r <= 0: return self.px(x, y, c)
        self.line([(x - r, y), (x + r, y)], c)
        self.line([(x, y - r), (x, y + r)], c)
        if diag and r >= 3:
            k = max(1, r // 2)
            self.line([(x - k, y - k), (x + k, y + k)], c)
            self.line([(x - k, y + k), (x + k, y - k)], c)
        if r >= 3: self.rect(x - 1, y - 1, x + 1, y + 1, c)
        if core is not None: self.px(x, y, core)

    def star5(self, x, y, r, c, rot=0.0, inner=0.45):
        pts = []
        for k in range(10):
            a = rot - math.pi / 2 + k * math.pi / 5
            rr = r if k % 2 == 0 else r * inner
            pts.append((x + math.cos(a) * rr, y + math.sin(a) * rr))
        self.poly(pts, c)

    def bolt(self, pts, layers):
        """Layered lightning polyline, layers = [(colour, width), ...] outer first."""
        for c, w in layers: self.line(pts, c, w)

    def dither(self, fn, phase=0):
        """Draw fn(tmp) but keep only checkerboard pixels — used for trailing afterglow edges only."""
        tmp = Cel(self.w, self.h); fn(tmp)
        src = tmp.im.load(); dst = self.im.load()
        for y in range(self.h):
            for x in range(self.w):
                if src[x, y] and (x + y + phase) % 2 == 0: dst[x, y] = src[x, y]

    def outline(self, c, only_over=None):
        """1px outline of existing ink in colour c (keeps silhouettes readable on dark backdrops)."""
        src = self.im.copy().load(); dst = self.im.load()
        for y in range(self.h):
            for x in range(self.w):
                if src[x, y]: continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < self.w and 0 <= yy < self.h and src[xx, yy] and (only_over is None or src[xx, yy] in only_over):
                        dst[x, y] = c; break


def jag(x0, y0, x1, y1, seg, amp, rng):
    """Jagged path between two points (lightning / cracks)."""
    pts = [(x0, y0)]
    nx, ny = -(y1 - y0), (x1 - x0)
    ln = math.hypot(nx, ny) or 1
    for i in range(1, seg):
        t = i / seg
        o = rng.uniform(-amp, amp)
        pts.append((x0 + (x1 - x0) * t + nx / ln * o, y0 + (y1 - y0) * t + ny / ln * o))
    pts.append((x1, y1))
    return pts


def ease(t):
    return 1 - (1 - t) ** 2


def lerp(a, b, t):
    return a + (b - a) * t


def orbit(cx, cy, r, a, ry=None):
    return cx + math.cos(a) * r, cy + math.sin(a) * (r if ry is None else ry)


def flame(c, x, y, h, w, ramp, lean=0.0):
    """Upward flame tongue with nested hotter cores; base centre at (x, y)."""
    n = len(ramp)
    for i, col in enumerate(ramp):
        s = 1 - i / (n + 0.6)
        hh, ww = h * s, w * s
        c.poly([(x - ww, y), (x - ww * 0.75, y - hh * 0.45), (x + lean * s, y - hh), (x + ww * 0.75, y - hh * 0.5), (x + ww, y),
                (x, y + ww * 0.45)], col)


def feather(c, x, y, ln, ang, col, edge):
    """Small falling feather: vane + quill."""
    dx, dy = math.cos(ang), math.sin(ang)
    nx, ny = -dy, dx
    c.poly([(x, y), (x + dx * ln * 0.35 + nx * 2.5, y + dy * ln * 0.35 + ny * 2.5), (x + dx * ln, y + dy * ln),
            (x + dx * ln * 0.35 - nx * 2.5, y + dy * ln * 0.35 - ny * 2.5)], col)
    c.line([(x, y), (x + dx * ln, y + dy * ln)], edge)


def cross(c, x, y, arm, top, bottom, thick, col):
    """Latin cross centred on the crossing at (x, y)."""
    h = thick // 2
    c.rect(x - h, y - top, x - h + thick - 1, y + bottom, col)
    c.rect(x - arm, y - h, x + arm, y - h + thick - 1, col)


# ---------------- building + checks ----------------

def build(key, frame, frames, pal, draw):
    sheet = Image.new('RGBA', (frame * frames, frame), (0, 0, 0, 0))
    lut = [(0, 0, 0, 0)] + [c + (255,) for c in pal.colors]
    for f in range(frames):
        cel = Cel(frame); draw(cel, f)
        cell = Image.new('RGBA', (frame, frame))
        cell.putdata([lut[v] if v < len(lut) else (255, 0, 255, 255) for v in cel.im.getdata()])
        sheet.paste(cell, (f * frame, 0))
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f'{key}.png'
    sheet.save(path, optimize=True)
    return path


def check(key, frame, frames):
    im = Image.open(OUT / f'{key}.png').convert('RGBA')
    errs = []
    if im.size != (frame * frames, frame): errs.append(f'size {im.size}')
    alpha = set(im.getchannel('A').getdata())
    if not alpha <= {0, 255}: errs.append(f'alpha {sorted(alpha)[:6]}')
    colors = {c for c in im.getdata() if c[3]}
    if len(colors) > 16: errs.append(f'{len(colors)} colours')
    if (255, 0, 255, 255) in colors: errs.append('palette index out of range')
    cells = [im.crop((i * frame, 0, (i + 1) * frame, frame)) for i in range(frames)]
    fill = [sum(1 for a in c.getchannel('A').getdata() if a) for c in cells]
    if min(fill) == 0: errs.append(f'empty cells {[i for i, n in enumerate(fill) if n == 0]}')
    diffs = []
    for i in range(frames - 1):
        a, b = list(cells[i].getdata()), list(cells[i + 1].getdata())
        diffs.append(sum(1 for p, q in zip(a, b) if p != q))
    if diffs and min(diffs) == 0: errs.append(f'identical neighbours {[i for i, n in enumerate(diffs) if n == 0]}')
    return {'key': key, 'ok': not errs, 'errors': errs, 'size': im.size, 'colours': len(colors),
            'minFill': min(fill), 'minDiff': min(diffs) if diffs else 0}


# ---------------- review images (.omo, session local) ----------------
_FONT = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
    '5': '111100111001111', '6': '111100111101111', '7': '111001001010010', '8': '111101111101111', '9': '111101111001111'}


def _label(img, x, y, s, scale=2, col=(255, 230, 120, 255)):
    for i, ch in enumerate(s):
        bits = _FONT.get(ch)
        if not bits: continue
        for k, b in enumerate(bits):
            if b == '1':
                px, py = x + (i * 4 + k % 3) * scale, y + (k // 3) * scale
                img.paste(col, (px, py, px + scale, py + scale))


def cells_of(key, frame):
    im = Image.open(OUT / f'{key}.png').convert('RGBA')
    return [im.crop((i * frame, 0, (i + 1) * frame, frame)) for i in range(im.width // frame)]


def preview(key, frame, scale=4, per_row=None):
    cells = cells_of(key, frame)
    per_row = per_row or (4 if frame == 128 else 6 if frame == 64 else 4)
    s = frame * scale; gap = 4
    rows = math.ceil(len(cells) / per_row); cols = min(per_row, len(cells))
    img = Image.new('RGBA', (cols * (s + gap) + gap, rows * (s + gap + 14) + gap), (12, 14, 24, 255))
    for i, c in enumerate(cells):
        x = gap + (i % per_row) * (s + gap); y = gap + (i // per_row) * (s + gap + 14)
        img.paste(Image.new('RGBA', (s, s), BG), (x, y + 14))
        img.alpha_composite(c.resize((s, s), Image.NEAREST), (x, y + 14))
        _label(img, x, y + 2, str(i))
    REVIEW.mkdir(parents=True, exist_ok=True)
    path = REVIEW / f'{key}-preview.png'; img.save(path); return path


def gif(key, frame):
    cells = cells_of(key, frame); s = frame * 2
    frames = []
    for c in cells:
        bg = Image.new('RGBA', (s, s), BG); bg.alpha_composite(c.resize((s, s), Image.NEAREST))
        frames.append(bg.convert('RGB').quantize(colors=32, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
    path = REVIEW / f'{key}.gif'
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=80, loop=0, disposal=2)
    return path


def class_sheet(cls, specs):
    """Every sheet of a class stacked; 32px at 4x, 64px at 2x, 128px at 1x so rows stay comparable."""
    rows = []
    for key in CLASSES[cls]:
        fr, n = specs[key]
        sc = 1 if fr == 128 else (4 if fr == 32 else 2)
        cells = cells_of(key, fr); s = fr * sc
        row = Image.new('RGBA', (n * (s + 2) + 2, s + 16), (12, 14, 24, 255))
        _label(row, 2, 2, str(CLASSES[cls].index(key)), 2, (140, 220, 255, 255))
        for i, c in enumerate(cells):
            row.paste(Image.new('RGBA', (s, s), BG), (2 + i * (s + 2), 14))
            row.alpha_composite(c.resize((s, s), Image.NEAREST), (2 + i * (s + 2), 14))
        rows.append(row)
    w = max(r.width for r in rows); h = sum(r.height for r in rows)
    img = Image.new('RGBA', (w, h), (12, 14, 24, 255)); y = 0
    for r in rows: img.paste(r, (0, y)); y += r.height
    path = REVIEW / f'{cls.split("_")[1]}-sheet.png'; img.save(path); return path


def composite(cls, specs, anchors, pick, sides=None):
    """Stage panels 320x180 (stage px), battlers and FX at 2x: slime on the left, hero on the right."""
    actor = Image.open(ROOT / 'public/assets/generated/charset-battlers/actor1-0.png').convert('RGBA').crop((0, 0, 48, 48)).resize((96, 96), Image.NEAREST)
    slime = Image.open(ROOT / 'public/assets/generated/pixel-enemies/slime.png').convert('RGBA').crop((0, 0, 48, 48)).resize((96, 96), Image.NEAREST)
    W, H = 320, 180
    enemy_feet, ally_feet = (78, 150), (244, 132)   # cell bottom row 44 -> feet (2x)
    panels = []
    for key in CLASSES[cls]:
        fr, n = specs[key]; anchor = anchors[key]
        for f in pick(key, n):
            p = Image.new('RGBA', (W, H), BG)
            p.alpha_composite(Image.new('RGBA', (W, 34), (0x2a, 0x34, 0x52, 255)), (0, 146))
            p.alpha_composite(slime, (enemy_feet[0] - 48, enemy_feet[1] - 88))
            p.alpha_composite(actor, (ally_feet[0] - 48, ally_feet[1] - 88))
            cell = cells_of(key, fr)[f].resize((fr * 2, fr * 2), Image.NEAREST)
            if anchor == 'target' and (sides or {}).get(key) == 'ally':
                p.alpha_composite(cell, (ally_feet[0] - fr, ally_feet[1] - (fr - 8) * 2))
            elif anchor in ('target', 'allTargets'):
                p.alpha_composite(cell, (enemy_feet[0] - fr, enemy_feet[1] - (fr - 8) * 2))
            elif anchor in ('user', 'allAllies'):
                p.alpha_composite(cell, (ally_feet[0] - fr, ally_feet[1] - (fr - 8) * 2))
            elif anchor == 'screen':
                p.alpha_composite(cell, (W // 2 - fr, H // 2 - fr))
            else:
                p.alpha_composite(cell, (160 - fr, 100 - fr))
            _label(p, 4, 4, f'{CLASSES[cls].index(key)}', 2, (140, 220, 255, 255)); _label(p, 30, 4, str(f), 2)
            panels.append(p)
    cols = 4; rows = math.ceil(len(panels) / cols)
    img = Image.new('RGBA', (cols * (W + 4), rows * (H + 4)), (8, 8, 12, 255))
    for i, p in enumerate(panels): img.paste(p, ((i % cols) * (W + 4), (i // cols) * (H + 4)))
    path = REVIEW / f'{cls.split("_")[1]}-composite.png'; img.save(path); return path


def load(key):
    if str(HERE) not in sys.path: sys.path.insert(0, str(HERE))
    return importlib.import_module(key)


def make(key, review=True):
    m = load(key)
    build(key, m.FRAME, m.FRAMES, m.PAL, m.draw)
    r = check(key, m.FRAME, m.FRAMES)
    if review: preview(key, m.FRAME); gif(key, m.FRAME)
    print(('OK  ' if r['ok'] else 'FAIL'), key, r['size'], 'colours', r['colours'], 'minFill', r['minFill'],
          'minDiff', r['minDiff'], *r['errors'])
    return r


def run(keys=None, review=True):
    keys = keys or [k for ks in CLASSES.values() for k in ks]
    results = [make(k, review) for k in keys]
    if review:
        for cls, ks in CLASSES.items():
            if not set(ks) & set(keys): continue
            if not all((OUT / f'{k}.png').exists() and (HERE / f'{k}.py').exists() for k in ks): continue
            mods = {k: load(k) for k in ks}
            specs = {k: (m.FRAME, m.FRAMES) for k, m in mods.items()}
            anchors = {k: m.ANCHOR for k, m in mods.items()}
            peak = {k: getattr(m, 'PEAK', None) for k, m in mods.items()}
            print(class_sheet(cls, specs))
            sides = {k: getattr(m, 'SIDE', 'enemy') for k, m in mods.items()}
            print(composite(cls, specs, anchors, lambda k, n: peak[k] or [n // 3, n // 2], sides))
    return results


if __name__ == '__main__':
    res = run(sys.argv[1:] or None)
    sys.exit(0 if all(r['ok'] for r in res) else 1)
