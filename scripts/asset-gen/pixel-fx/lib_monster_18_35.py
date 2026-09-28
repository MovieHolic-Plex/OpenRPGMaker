"""Monster skill retro2003 FX, RETRO_MONSTER_FX_SHEETS index 18-35 (2026-09-28).

Coordinate-drawn pixel art only: no source images, resampling, blur or antialiasing.
Each <key>.py defines KEY, SIZE, FRAMES, ANCHOR, PAL and draw(c, f), then calls run(globals()).
'python3 lib_monster_18_35.py' rebuilds all 18 sheets plus .omo/mfx/<key>-preview.png and .omo/mfx/board-18_35*.png.
SIZE / FRAMES / ANCHOR are checked against src/assets/retroMonsterSkills.ts before anything is written.

Direction: monsters stand LEFT, allies RIGHT. Projectiles fly left -> right with the head facing RIGHT;
slashes, lashes and gusts come in from the left.
Cell conventions (runtime placeOnBody: 64px cell at 2x, box bottom = battler bottom + 16px):
  target/allTargets  ally body centre ~(31, 40), feet on row 53, body ~23x24 cell px
  screen             128px cell, 256px box at stage centre, always rounded off with fade_oval
  projectile         32px loop, head facing RIGHT
Colour identity (kept apart from the class skills): poison yellow-green + violet, dark violet/black/crimson,
ice blue-white, fire orange/red, earth brown + orange dust.
"""
import importlib
import math
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from lib_scout import rgba, lerp, ease, rng, pol, pal, pick, check, OUT, ROOT  # noqa: E402,F401
from lib_samurai import Ink, specks  # noqa: E402,F401
from fx_edge import fade_edges, fade_oval  # noqa: E402,F401

CONTRACT = ROOT / 'src/assets/retroMonsterSkills.ts'
REVIEW = ROOT / '.omo/mfx'
STAGE = (0x40, 0x58, 0x38, 255)
FIRST, LAST = 18, 35

CX, CY, FEET = 29, 41, 53  # 64px ally-anchored cells (actor1 body spans x16..39, y29..53 in the cell)

# Ink families. One key always means one colour inside this module.
BONE = dict(b0='#382c24', b1='#7a6a52', b2='#c2b294', b3='#f2ead2')
GRAVE = dict(v0='#160a22', v1='#3e1c58', v2='#76389c', v3='#b27ae0')
TOXIC = dict(g0='#1c280c', g1='#4a6414', g2='#8aa822', g3='#c8dc48', g4='#f0f8a8')
PLAGUE = dict(p0='#260e2c', p1='#56225e', p2='#9446a4', p3='#cc88d8')
ICE = dict(i0='#142c5a', i1='#2c68b0', i2='#66b0ea', i3='#b6e4ff', i4='#effcff')
FIRE = dict(e0='#480c10', e1='#9e1e1a', e2='#e2561a', e3='#ffa632', e4='#fff08a')
SEA = dict(a0='#08243c', a1='#0e5674', a2='#1a90a6', a3='#58ccce', a4='#d4fff2')
LINEN = dict(l0='#3a281a', l1='#7a603e', l2='#b8a076', l3='#e6dab4')
VINE = dict(n0='#12220e', n1='#2a4818', n2='#4c7824', n3='#88b23a', n4='#c8e070')
SPORE = dict(s0='#2e1636', s1='#6a2a76', s2='#ae4eb6', s3='#ea8ed6', s4='#ffe0f2')
EARTH = dict(d0='#28160a', d1='#5a3616', d2='#945e28', d3='#cc8a42', d4='#f2c27a')
STEEL = dict(m0='#22262e', m1='#565e70', m2='#9ea6b8', m3='#e2e6ee')
CRIMSON = dict(c0='#3a0610', c1='#861020', c2='#cc2830', c3='#ff6c5c')
EYE = dict(q0='#18061e', q1='#48104c', q2='#8a1c7a', q3='#d03ca6', q4='#ff9ade')
GHOST = dict(h0='#161830', h1='#363c6c', h2='#7682b6', h3='#bac6ea', h4='#eef4ff')
HEX = dict(x0='#0a2412', x1='#146a32', x2='#26ae48', x3='#78ee7c', x4='#dcffce')
STONE = dict(o0='#2a2a2e', o1='#5c5a5e', o2='#98949a', o3='#d0ccd0')
WHITE = dict(w='#ffffff')


class Mon(Ink):
    """Ink plus the monster motifs."""

    def bone_arrow(self, x, y, ang, L, head='b3', shaft='b2', dark='b1', fl='v2'):
        """Bone arrow with its tip at (x, y) pointing along ang: bone head, knuckled shaft, ragged fletch."""
        ux, uy = math.cos(ang), math.sin(ang)
        vx, vy = -uy, ux
        hb = (x - ux * 5, y - uy * 5)
        tail = (x - ux * L, y - uy * L)
        self.line([hb, tail], dark, 2)
        self.line([(hb[0] - vx * 0.5, hb[1] - vy * 0.5), (tail[0] - vx * 0.5, tail[1] - vy * 0.5)], shaft)
        for t in (0.45, 0.75):
            k = (lerp(hb[0], tail[0], t), lerp(hb[1], tail[1], t))
            self.px(k[0] + vx, k[1] + vy, shaft)
            self.px(k[0] - vx, k[1] - vy, dark)
        self.poly([(x + ux, y + uy), (hb[0] + vx * 2.6, hb[1] + vy * 2.6), (hb[0] + ux * 1.5, hb[1] + uy * 1.5),
                   (hb[0] - vx * 2.6, hb[1] - vy * 2.6)], dark)
        self.poly([(x, y), (hb[0] + vx * 1.6, hb[1] + vy * 1.6), (hb[0] + ux * 1.5, hb[1] + uy * 1.5),
                   (hb[0] - vx * 1.6, hb[1] - vy * 1.6)], head)
        for j in range(3):
            f = (tail[0] + ux * (1 + j * 1.8), tail[1] + uy * (1 + j * 1.8))
            self.line([f, (f[0] - ux * 2 + vx * 2.2, f[1] - uy * 2 + vy * 2.2)], fl)
            self.line([f, (f[0] - ux * 2 - vx * 2.2, f[1] - uy * 2 - vy * 2.2)], fl if j % 2 else dark)

    def shard(self, x, y, ang, L, w, keys):
        """Crystal spike from base (x, y) toward ang; keys dark -> light, lit on the upper-left facet."""
        ux, uy = math.cos(ang), math.sin(ang)
        vx, vy = -uy, ux
        tip = (x + ux * L, y + uy * L)
        a = (x + vx * w, y + vy * w)
        b = (x - vx * w, y - vy * w)
        self.poly([a, tip, b], keys[0])
        lit = a if (vx + vy) < 0 else b  # facet facing the upper-left light
        if len(keys) > 1:
            self.poly([lit, (tip[0] - ux, tip[1] - uy), (x, y)], keys[1])
        if len(keys) > 2:
            self.line([(lerp(lit[0], x, 0.5), lerp(lit[1], y, 0.5)), (tip[0] - ux * 1.5, tip[1] - uy * 1.5)], keys[2])
        if len(keys) > 3:
            self.px(tip[0] - ux, tip[1] - uy, keys[3])

    def rock(self, x, y, r, keys, seed=0, sides=6):
        """Faceted boulder chunk: dark body, lit top-left facet, light nick."""
        rr = rng(seed)
        pts = [pol(x, y, r * rr.uniform(0.75, 1.1), i * 2 * math.pi / sides + rr.uniform(-.25, .25)) for i in range(sides)]
        self.poly(pts, keys[0])
        if r >= 2.5 and len(keys) > 1:
            self.poly([(px_ - (px_ - x) * 0.3 - r * 0.2, py_ - (py_ - y) * 0.3 - r * 0.2) for px_, py_ in pts], keys[1])
        if r >= 3 and len(keys) > 2:
            self.line([(x - r * 0.55, y - r * 0.1), (x - r * 0.15, y - r * 0.55)], keys[2])

    def crack(self, x0, y0, x1, y1, seed, k, segs=6, jit=2.0, w=1):
        r = rng(seed)
        pts = [(x0, y0)]
        for i in range(1, segs):
            t = i / segs
            pts.append((lerp(x0, x1, t) + r.uniform(-jit, jit) * 0.4, lerp(y0, y1, t) + r.uniform(-jit, jit)))
        pts.append((x1, y1))
        self.line(pts, k, w)
        return pts

    def eye(self, x, y, rx, ry, open_, lid, white, iris, pupil, glint='w'):
        """Almond eye; open_ 0..1 scales the lid gap; iris = (dark, light); slit pupil."""
        h = max(0.6, ry * open_)
        n = 16
        top = [(x - rx * math.cos(math.pi * i / n), y - h * math.sin(math.pi * i / n)) for i in range(n + 1)]
        bot = [(x + rx * math.cos(math.pi * i / n), y + h * math.sin(math.pi * i / n)) for i in range(n + 1)]
        self.poly([(p[0] + (-1 if i == 0 else 1 if i == n else 0), p[1] - 1) for i, p in enumerate(top)]
                  + [(p[0], p[1] + 1) for p in bot], lid)
        if open_ < 0.15:
            self.line([(x - rx, y), (x + rx, y)], white)
            return
        self.poly(top + bot, white)
        ir = min(h, rx * 0.5)
        self.disc(x, y, ir, iris[0])
        if len(iris) > 1 and ir > 2:
            self.disc(x - ir * 0.12, y - ir * 0.12, ir * 0.7, iris[1])
        self.oval(x, y, max(0.6, ir * 0.22), max(0.8, ir * 0.85), pupil)
        if ir > 2.5:
            self.rect(x - ir * 0.5, y - ir * 0.5, x - ir * 0.5 + 1, y - ir * 0.5, glint)

    def zee(self, x, y, s, k):
        """Sleep 'Z' glyph, s px wide."""
        s = int(round(s))
        self.line([(x, y), (x + s, y), (x, y + s), (x + s, y + s)], k)

    def mote(self, x, y, k, k2=None):
        """2px mote so specks never read as loose single pixels."""
        self.px(x, y, k)
        self.px(x + 1, y, k2 or k)

    def dring(self, x, y, r, k, parity=0, squash=1.0):
        """Dashed 1px ring: 2px on, 2px off along the rim, so a fading ring never scatters single pixels."""
        steps = int(2 * math.pi * max(r, 1) * 2) + 8
        pts = []
        for i in range(steps):
            a = i * 2 * math.pi / steps
            p = (int(round(x + math.cos(a) * r)), int(round(y + math.sin(a) * r * squash)))
            if not pts or p != pts[-1]:
                pts.append(p)
        for j, p in enumerate(pts):
            if (j + parity * 2) % 4 < 2:
                self.px(*p, k)

    def skull(self, x, y, r, body, hole, hi=None):
        """Small skull face: round cranium, cheek jaw, two sockets and a nose notch."""
        self.disc(x, y, r, body)
        self.rect(x - r * 0.55, y + r * 0.4, x + r * 0.55, y + r * 1.15, body)
        if hi:
            self.disc(x - r * 0.3, y - r * 0.35, max(0.6, r * 0.35), hi)
        self.disc(x - r * 0.42, y + r * 0.05, max(0.6, r * 0.28), hole)
        self.disc(x + r * 0.42, y + r * 0.05, max(0.6, r * 0.28), hole)
        self.px(x, y + r * 0.5, hole)
        if r >= 4:
            for i in (-1, 0, 1):
                self.px(x + i * r * 0.3, y + r * 1.1, hole)

    def flake(self, x, y, r, k, core=None):
        """Six-arm snowflake."""
        for i in range(3):
            a = i * math.pi / 3 + math.pi / 2
            self.line([pol(x, y, r, a), pol(x, y, r, a + math.pi)], k)
        if core:
            self.px(x, y, core)

    def vine(self, pts, keys, thorn=None, w=3, every=5, seed=0, taper=True):
        """Thick vine along a polyline; keys (dark, mid, light). Thorns every 'every' px on alternating sides."""
        n = len(pts)
        for i in range(n - 1):
            ww = w if not taper else max(1, round(w * (1 - 0.55 * i / max(1, n - 2))))
            self.line([pts[i], pts[i + 1]], keys[0], ww + 1 if ww > 1 else 1)
        for i in range(n - 1):
            ww = w if not taper else max(1, round(w * (1 - 0.55 * i / max(1, n - 2))))
            if ww > 1:
                self.line([pts[i], pts[i + 1]], keys[1], ww - 1)
        self.line([(x - 0.5, y - 1) for x, y in pts[: max(2, n * 2 // 3)]], keys[2])
        if thorn:
            acc = 0.0
            side = 1
            for i in range(n - 1):
                (x0, y0), (x1, y1) = pts[i], pts[i + 1]
                seg = math.hypot(x1 - x0, y1 - y0) or 1
                acc += seg
                if acc >= every:
                    acc = 0.0
                    side = -side
                    nx, ny = -(y1 - y0) / seg * side, (x1 - x0) / seg * side
                    bx, by = x1, y1
                    self.poly([(bx - (x1 - x0) / seg, by - (y1 - y0) / seg), (bx + nx * 3.5, by + ny * 3.5),
                               (bx + (x1 - x0) / seg * 1.5, by + (y1 - y0) / seg * 1.5)], thorn)


def bez(pts, n=24):
    """Points along a Bezier curve through control points pts."""
    out = []
    for j in range(n + 1):
        t = j / n
        q = list(pts)
        while len(q) > 1:
            q = [(lerp(a[0], b[0], t), lerp(a[1], b[1], t)) for a, b in zip(q, q[1:])]
        out.append(q[0])
    return out


def motes(c, cx, cy, n, r0, r1, seed, keys, sq=1.0, dy=0.0, spark_every=0, core='w'):
    """2px motes scattered in a ring r0..r1 around (cx, cy); every spark_every-th one is a twinkle."""
    r = rng(seed)
    for i in range(n):
        a = r.uniform(0, 2 * math.pi)
        d = r.uniform(r0, r1)
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d * sq + dy * r.uniform(0.5, 1.2)
        if spark_every and i % spark_every == 0:
            c.spark(x, y, 2, core, keys[0])
        else:
            c.mote(x, y, keys[i % len(keys)])


# --------------------------------------------------------------------------- contract + output

def contract():
    text = CONTRACT.read_text(encoding='utf8')
    layers = {}
    for m in re.finditer(r'L\("(\w+)", "(\w+)", (\d+), (\d+)\)', text):
        layers.setdefault(m.group(1), dict(anchor=m.group(2), frame=int(m.group(3)), frames=int(m.group(4))))
    return layers


def mine():
    """Keys 18..35 of RETRO_MONSTER_FX_SHEETS (contract order, duplicates removed)."""
    return list(contract())[FIRST:LAST + 1]


def render(mod):
    frames = []
    raw = []
    for f in range(mod['FRAMES']):
        c = Mon(mod['SIZE'], mod['PAL'])
        mod['draw'](c, f)
        raw.append(c.im.copy())
        finish(c, mod)
        frames.append(c.im)
    return frames, raw


def finish(c, mod):
    """Edge treatment every sheet gets: screen layers round off into a dithered oval (no square on stage),
    body layers thin out toward all four borders so nothing ends on a straight cut line."""
    if mod['ANCHOR'] == 'screen':
        fade_oval(c, band=mod.get('OVAL', 0.3))
    else:
        band = mod.get('EDGE', 3 if mod['ANCHOR'] == 'projectile' else 6)
        fade_edges(c, T=band, B=band, L=band, R=band)


def preview(frames, scale=4, gap=4, limit=1900):
    """4x frames with red cell borders on a checker, wrapped so the board stays inside 'limit' px."""
    size = frames[0].size[0]
    cell = size * scale
    per = max(1, min(len(frames), (limit - gap) // (cell + gap)))
    rows = (len(frames) + per - 1) // per
    top = 14
    im = Image.new('RGBA', (per * (cell + gap) + gap, rows * (cell + top + gap) + gap), (0x20, 0x28, 0x40, 255))
    d = ImageDraw.Draw(im)
    font = ImageFont.load_default()
    for i, fr in enumerate(frames):
        x = gap + (i % per) * (cell + gap)
        y = gap + (i // per) * (cell + top + gap)
        d.text((x + 2, y), str(i), fill=(0xf0, 0xf0, 0xa0, 255), font=font)
        d.rectangle((x - 1, y + top - 1, x + cell, y + top + cell), outline=(0xff, 0x50, 0x50, 255))
        for yy in range(0, cell, 16):
            for xx in range(0, cell, 16):
                if (xx // 16 + yy // 16) % 2:
                    d.rectangle((x + xx, y + top + yy, x + xx + 15, y + top + yy + 15), fill=(0x28, 0x32, 0x4e, 255))
        im.alpha_composite(fr.resize((cell, cell), Image.NEAREST), (x, y + top))
    return im


def strays(frames):
    """Inked pixels with no inked 8-neighbour (loose noise). Checker dither touches diagonally, so it passes."""
    total = 0
    for fr in frames:
        a = fr.getchannel('A').load()
        w, h = fr.size
        for y in range(h):
            for x in range(w):
                if a[x, y] and not any(0 <= x + dx < w and 0 <= y + dy < h and a[x + dx, y + dy]
                                       for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy):
                    total += 1
    return total


def run(mod, quiet=False):
    key, size, n, anchor = mod['KEY'], mod['SIZE'], mod['FRAMES'], mod['ANCHOR']
    spec = contract().get(key)
    if not spec or (spec['frame'], spec['frames'], spec['anchor']) != (size, n, anchor):
        raise SystemExit(f'{key}: script {anchor} {size}px x{n} != contract {spec}')
    if len(mod['PAL']) > 15:
        raise SystemExit(f'{key}: palette has {len(mod["PAL"])} inks (+transparent > 16)')
    frames, raw = render(mod)
    sheet = Image.new('RGBA', (size * n, size), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        sheet.paste(fr, (i * size, 0))
    problems, total, counts, diffs = check(size, n, sheet, frames)
    lonely = strays(raw)  # counted before the sanctioned edge dither
    if lonely > n * 6:
        problems.append(f'{lonely} isolated pixels')
    OUT.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / f'{key}.png', optimize=True)
    if Image.open(OUT / f'{key}.png').convert('RGBA').tobytes() != sheet.tobytes():
        problems.append('png roundtrip changed pixels')
    preview(frames).save(REVIEW / f'{key}-preview.png')
    status = 'OK ' if not problems else 'BAD'
    line = (f'{status} {key:<18} {anchor:<10} {size}px x{n} sheet={sheet.size[0]}x{sheet.size[1]} '
            f'alpha=0/255 colours={total} minpx={min(counts)} mindiff={min(diffs) if diffs else "-"} strays={lonely}')
    if problems:
        line += ' :: ' + '; '.join(problems)
    if not quiet:
        print(line)
    return line, frames, mod


# --------------------------------------------------------------------------- stage board

PW, PH = 440, 290
MON = (40, 150, 116, 226)           # monster stand-in square (left)
ACT_CX, ACT_BOTTOM = 330, 232       # ally battler image (96px = 48px cell at 2x)


def _actor():
    return Image.open(ROOT / 'public/assets/generated/charset-battlers/actor1-0.png').convert('RGBA').crop((0, 0, 48, 48)).resize((96, 96), Image.NEAREST)


def panel(frames, mod, picks):
    actor = _actor()
    p = Image.new('RGBA', (PW, PH), STAGE)
    d = ImageDraw.Draw(p)
    d.line((0, 234, PW, 234), fill=(0x34, 0x48, 0x2e, 255))
    d.rectangle(MON, fill=(0x6a, 0x30, 0x3a, 255), outline=(0x20, 0x10, 0x14, 255))
    p.alpha_composite(actor, (ACT_CX - 48, ACT_BOTTOM - 96))
    a, s = mod['ANCHOR'], mod['SIZE']
    box = s * 2
    for j, fi in enumerate(picks):
        fx = frames[fi].resize((box, box), Image.NEAREST)
        if a in ('target', 'allTargets'):
            p.alpha_composite(fx, (ACT_CX - box // 2, ACT_BOTTOM + 16 - box))
        elif a == 'screen':
            p.alpha_composite(fx, (PW // 2 - box // 2, 145 - box // 2))
        elif a == 'projectile':
            sx, sy = MON[2] + 4, 178
            ex, ey = ACT_CX, ACT_BOTTOM - 96 + int(96 * 0.6)
            u = (j + 0.5) / len(picks)
            x, y = lerp(sx, ex, u), lerp(sy, ey, u)
            p.alpha_composite(fx, (int(x - box / 2), int(y - box / 2)))
    font = ImageFont.load_default()
    d.text((4, 4), f'{mod["KEY"]} {a} #{",".join(map(str, picks))}', fill=(255, 255, 255, 255), font=font)
    return p


def stage_board(results, name='board-18_35', per_part=6):
    rows = []
    for line, frames, mod in results:
        n = mod['FRAMES']
        if mod['ANCHOR'] == 'projectile':
            picks_list = [list(range(n)), [0], [1], [3]]
        else:
            peak = mod.get('PEAK', n // 2 - 1)
            picks_list = [[p] for p in sorted({1, peak, min(n - 1, peak + 2), n - 2})]
            while len(picks_list) < 4:
                picks_list.append([n - 1])
            picks_list = picks_list[:4]
        rows.append([panel(frames, mod, pk) for pk in picks_list])

    def paste(rs):
        out = Image.new('RGBA', (4 * (PW + 4), len(rs) * (PH + 4)), (0x10, 0x14, 0x20, 255))
        for r, row in enumerate(rs):
            for ci, p in enumerate(row):
                out.alpha_composite(p, (ci * (PW + 4), r * (PH + 4)))
        return out
    paste(rows).save(REVIEW / f'{name}.png')
    for i in range(0, len(rows), per_part):
        paste(rows[i:i + per_part]).save(REVIEW / f'{name}-part{i // per_part + 1}.png')


def main(keys=None):
    bad = 0
    results = []
    for key in mine():
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
    if results:
        stage_board(results, 'board-18_35' if not keys else 'board-18_35-partial')
    return bad


if __name__ == '__main__':
    sys.exit(1 if main(sys.argv[1:] or None) else 0)
