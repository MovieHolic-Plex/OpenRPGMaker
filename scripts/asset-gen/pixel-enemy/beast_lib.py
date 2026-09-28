"""Shared helpers for the beasts batch (bat-vampire ... plant-carnivore).

Every pixel is decided on the final 1:1 grid by Pillow primitives or per-pixel formulas.
No source sprite is read, scaled or traced. run() = pe_lib.build() (sheet, asserts,
preview.png, scale.png, validation.json) + the 2x cycle.gif this batch reviews:
idle x2 -> windup -> move -> attack -> recover -> hit -> dead on #202840.
"""
import math
import sys
sys.dont_write_bytecode = True
from PIL import Image, ImageDraw
from pe_lib import Pen, build, NAMES, BG, ROOT


def dot(p, x, y, c):
    x, y = int(round(x)), int(round(y))
    if 0 <= x < p.im.width and 0 <= y < p.im.height:
        p.im.putpixel((x, y), p.pal[c])


def polar(x, y, deg, length):
    """Screen point at angle deg (0 = right, 90 = up) and length from (x, y)."""
    r = math.radians(deg)
    return (x + math.cos(r) * length, y - math.sin(r) * length)


def ipt(pt):
    return (int(round(pt[0])), int(round(pt[1])))


def bez(ctrl, n=None):
    """Bezier through control tuples (x, y, r...). Samples about 1.5 per pixel."""
    def at(t):
        pts = [list(c) for c in ctrl]
        while len(pts) > 1:
            pts = [[a + (b - a) * t for a, b in zip(p0, p1)] for p0, p1 in zip(pts, pts[1:])]
        return tuple(pts[0])
    if n is None:
        length = sum(math.dist(a[:2], b[:2]) for a, b in zip(ctrl, ctrl[1:]))
        n = max(2, int(length * 1.5))
    return [at(i / (n - 1)) for i in range(n)]


def light(dx, dy, size):
    """+ toward the upper-left light, - toward lower-right shadow."""
    return -(dx * 0.62 + dy * 0.78) / max(size, 1)


def shade3(u, v, r, L):
    if r > 0.97:
        return None  # let the outline pass decide
    if L > 0.42 and r < 0.86:
        return 'l'
    if L < -0.38:
        return 's'
    return 'b'


def blob(p, cx, cy, a, b, ang=0.0, fn=shade3, edge='o', keys=None):
    """Rotated ellipse painted per pixel: fn(u, v, r, L) -> palette key (None = base).
    keys renames the default l/b/s so one helper serves every material."""
    keys = keys or {}
    ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    inside = {}
    R = int(max(a, b)) + 2
    for y in range(int(cy) - R, int(cy) + R + 1):
        for x in range(int(cx) - R, int(cx) + R + 1):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            u = (dx * ca + dy * sa) / a
            v = (-dx * sa + dy * ca) / b
            r = math.hypot(u, v)
            if r <= 1.0:
                inside[(x, y)] = (u, v, r, light(dx, dy, max(a, b)))
    for (x, y), (u, v, r, L) in inside.items():
        edge_px = any((x + ox, y + oy) not in inside for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if edge_px and edge:
            c = edge
        else:
            c = fn(u, v, r, L) or 'b'
            c = keys.get(c, c)
        dot(p, x, y, c)
    return inside


def mass(p, parts, fn=shade3, edge='o', keys=None, light_c=None, light_r=None):
    """Union of rotated ellipses [(cx, cy, a, b, ang)...] shaded as ONE form with a
    single outline. Lighting is measured from light_c (default: first part centre)."""
    keys = keys or {}
    lc = light_c or parts[0][:2]
    lr = light_r or max(max(q[2], q[3]) for q in parts)
    inside = {}
    for cx, cy, a, b, ang in parts:
        ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
        R = int(max(a, b)) + 2
        for y in range(int(cy) - R, int(cy) + R + 1):
            for x in range(int(cx) - R, int(cx) + R + 1):
                dx, dy = x + 0.5 - cx, y + 0.5 - cy
                u = (dx * ca + dy * sa) / a
                v = (-dx * sa + dy * ca) / b
                r = math.hypot(u, v)
                if r <= 1.0:
                    prev = inside.get((x, y))
                    if prev is None or r < prev[2]:
                        inside[(x, y)] = (u, v, r)
    for (x, y), (u, v, r) in inside.items():
        edge_px = any((x + ox, y + oy) not in inside for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if edge_px and edge:
            c = edge
        else:
            L = light(x + 0.5 - lc[0], y + 0.5 - lc[1], lr)
            c = fn(u, v, min(r, 0.9), L) or 'b'
            c = keys.get(c, c)
        dot(p, x, y, c)
    return inside


def tube(p, pts, base, edge='o', shade=None, hi=None):
    """Outlined round tube along (x, y, r) samples.
    shade fills the whole cross-section first, base is offset toward the light."""
    def circ(x, y, r, c):
        r = max(0.0, r)
        x0, y0, x1, y1 = round(x - r), round(y - r), round(x + r), round(y + r)
        if r < 0.75:
            dot(p, x, y, c)
        else:
            p.d.ellipse((x0, y0, x1, y1), fill=p.pal[c])
    if edge:
        for x, y, r, *_ in pts:
            circ(x, y, r + 1, edge)
    for x, y, r, *_ in pts:
        circ(x, y, r, shade or base)
    if shade:
        for x, y, r, *_ in pts:
            if r >= 1.5:
                circ(x - 0.5, y - 0.6, r - 1, base)
    if hi:
        for x, y, r, *_ in pts:
            if r >= 2.5:
                circ(x - 1.1, y - 1.2, r - 2.3, hi)


def tint_poly(p, pts, fill, tint, edge=None):
    """Translucent membrane with alpha kept 0/255: pixels already painted are
    swapped through tint (base key -> seen-through key), empty pixels get fill."""
    m = Image.new('L', p.im.size)
    ImageDraw.Draw(m).polygon([ipt(q) for q in pts], fill=255, outline=255)
    rev = {v: k for k, v in p.pal.items()}
    w, h = p.im.size
    px = p.im.load()
    mp = m.load()
    for y in range(h):
        for x in range(w):
            if not mp[x, y]:
                continue
            border = edge and any(not (0 <= x + ox < w and 0 <= y + oy < h) or not mp[x + ox, y + oy]
                                  for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if border:
                px[x, y] = p.pal[edge]
                continue
            cur = px[x, y]
            if cur[3] == 0:
                px[x, y] = p.pal[fill]
            else:
                k = rev.get(cur)
                px[x, y] = p.pal[tint.get(k, fill)]


def run(name, cell, pal, draw):
    build(name, cell, pal, draw)
    frames = [draw(n).im for n in NAMES]
    qa = ROOT / f'.omo/pixel-enemy-{name}'
    seq = [0, 1, 2, 1, 0, 1, 2, 1, 3, 4, 5, 6, 7, 8]
    durations = [180] * 8 + [340, 260, 440, 320, 420, 1200]
    gif = []
    for i in seq:
        im = Image.new('RGBA', (cell, cell), BG)
        im.alpha_composite(frames[i])
        gif.append(im.convert('RGB').resize((cell * 2, cell * 2), Image.Resampling.NEAREST))
    gif[0].save(qa / 'cycle.gif', save_all=True, append_images=gif[1:], duration=durations,
                loop=0, disposal=2, optimize=False)
