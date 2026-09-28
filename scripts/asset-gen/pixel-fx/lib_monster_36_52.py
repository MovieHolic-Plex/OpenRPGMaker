"""Monster skill FX sheets 36-52 (retro2003 side battle, monsters on the LEFT, allies on the RIGHT).

Coordinate-drawn pixel art only (python3 + Pillow): no source images, resampling, blur or antialiasing.
Covers RETRO_MONSTER_FX_SHEETS[36..52] of src/assets/retroMonsterSkills.ts (key order of first appearance).
Each mon_<key>.py defines KEY, SIZE, FRAMES, ANCHOR, PAL and draw(c, f), then calls run(globals()).
'python3 lib_monster_36_52.py' rebuilds all 17 sheets, the 4x previews and the stage board in .omo/mfx/.
SIZE / FRAMES / ANCHOR are checked against the contract before anything is written.

Direction (opposite of the class skills): projectile cells face RIGHT; slashes/thrusts/charges enter from the LEFT.
Cell conventions
  target/allTargets 64px  shown at 2x (128px box, bottom = ally feet + 16px) -> ally feet near row 53,
                          body roughly x 21..43, y 29..53. Effects centre on BX, BY and never hide the whole body.
  user 64px               round, centred on the casting monster.
  screen 128px            256px in the middle of the stage; always finished with fade_oval.
Colour identity (monster side): smoke olive-grey, steel + dark blood, gale mint + harpy feathers,
  rock/dust brown-orange, fire orange-red, rage blood-red, dark violet-black + crimson.
"""
import importlib
import math
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from lib_scout import pal, pick, lerp, ease, rng, pol, check, OUT, ROOT  # noqa: E402,F401
from lib_samurai import Ink  # noqa: E402
from lib_monk import burst, converge, star, pow_burst, shade  # noqa: E402,F401
from fx_edge import fade_edges, fade_oval  # noqa: E402,F401

CONTRACT = ROOT / 'src/assets/retroMonsterSkills.ts'
REVIEW = ROOT / '.omo/mfx'
FIRST, LAST = 36, 52

# Ink families. A key always means the same colour inside this set, so the layers of one skill stay continuous.
SOOT = dict(k0='#1e2018', k1='#3c4232', k2='#687058', k3='#9ca488', k4='#d4dac0')          # olive smoke
IRON = dict(i0='#141418', i1='#34343e', i2='#62646e')
STEEL = dict(s0='#2c3040', s1='#7a8298', s2='#c8ccd8', s3='#f4f6fa')
BLOOD = dict(r0='#3a0810', r1='#8a1422', r2='#d0303a', r3='#ff7a6a')
SHADE = dict(d0='#0c0810', d1='#2a2030')
WOOD = dict(t0='#3a2412', t1='#6e4624', t2='#a8743e')
SHOCK = dict(h1='#d8c060', h2='#fff0a8')
GALE = dict(g0='#1e3834', g1='#4a7e70', g2='#8cc4ac', g3='#d0f2e0')
FEATHER = dict(f0='#4a3020', f1='#8a6038', f2='#c89a60', f3='#ecd4a4')
ROCK = dict(o0='#221a14', o1='#4a3a2c', o2='#7a6450', o3='#a8927a', o4='#d8c8ae')
DUST = dict(u0='#5a3a1e', u1='#946232', u2='#c89250', u3='#ecc890')
FIRE = dict(e0='#4a0e10', e1='#a4221a', e2='#e8581c', e3='#ffa032', e4='#ffe07a')
DARK = dict(v0='#0a0610', v1='#23103a', v2='#4a2270', v3='#7a3eb0', v4='#b87ae8', v5='#ecd0ff')
CRIM = dict(c1='#7a0a2a', c2='#c81e44', c3='#ff5a6a')
WHITE = dict(w='#ffffff')

BX, BY, FEET = 32, 41, 53      # ally body centre / feet in a 64px target cell
UX, UY = 32, 34                # user cell centre

KEYS_FILE = HERE / 'lib_monster_36_52.py'


def contract():
    text = CONTRACT.read_text(encoding='utf8')
    layers = {}
    for m in re.finditer(r'L\("(\w+)", "(\w+)", (\d+), (\d+)\)', text):
        layers.setdefault(m.group(1), dict(anchor=m.group(2), frame=int(m.group(3)), frames=int(m.group(4))))
    return layers


def my_keys():
    return list(contract())[FIRST:LAST + 1]


# --------------------------------------------------------------------------- shared shapes

def rock(c, x, y, r, rot, keys, seed=0, cracks=True):
    """Faceted boulder lit from the upper left. keys = (outline, shadow, body, light, shine)."""
    rr = rng(seed)
    n = 9
    rad = [r * rr.uniform(0.82, 1.08) for _ in range(n)]
    pts = [pol(x, y, rad[i], rot + i * 2 * math.pi / n) for i in range(n)]
    ol, sh, body, lt, hi = keys
    c.poly([(px + (1 if px > x else -1) * 0.9, py + (1 if py > y else -1) * 0.9) for px, py in pts], ol)
    c.poly(pts, sh)
    c.poly([(lerp(x - r * 0.12, px, 0.86), lerp(y - r * 0.12, py, 0.86)) for px, py in pts], body)
    c.poly([(lerp(x - r * 0.35, px, 0.55), lerp(y - r * 0.38, py, 0.5)) for px, py in pts], lt)
    if r >= 3:
        c.px(x - r * 0.45, y - r * 0.5, hi)
        if r >= 6:
            c.line([(x - r * 0.55, y - r * 0.3), (x - r * 0.3, y - r * 0.6)], hi)
    if cracks and r >= 5:
        a = rot + 0.7
        p0 = pol(x, y, r * 0.1, a)
        p1 = pol(x, y, r * 0.75, a + 0.2)
        c.line([p0, p1], ol)
        c.line([p1, pol(x, y, r * 0.8, a + 0.8)], ol)


def chunk(c, x, y, s, rot, keys):
    """Small rock shard (3-5 px): outline, body, light."""
    ol, body, lt = keys
    if s < 1.6:
        c.px(x, y, body)
        c.px(x - 1, y - 1, lt)
        return
    pts = [pol(x, y, s * m, rot + i * 2 * math.pi / 5) for i, m in enumerate((1, .7, 1.1, .8, .9))]
    c.poly(pts, body, outline=ol)
    c.px(x - s * 0.3, y - s * 0.3, lt)


def cone(c, x0, y0, xf, t, keys, wob=0.0, spread=0.36, w0=4, lift=0.0, tail=None):
    """Horizontal breath cone from (x0, y0) to front xf (left -> right), rolling billow front.
    keys: outer -> core. t = animation phase (radians) for the licking edge. tail: x where the stream starts (for fade-out)."""
    xs = int(max(x0, tail if tail is not None else x0))
    n = len(keys)
    for x in range(xs, int(xf) + 1):
        d = x - x0
        hw = w0 + d * spread
        yc = y0 - d * lift + math.sin(d * 0.11 + t) * 3 * wob
        for i, k in enumerate(keys):
            s = 1 - i / (n + 0.3)
            e = hw * s + math.sin(d * 0.45 + t * 2 + i) * 1.8 + math.sin(d * 0.21 - t + i * 2) * 1.4
            if e < 0.5:
                continue
            c.line([(x, yc - e), (x, yc + e * 0.8)], k)
    # rolling front: a bulge of discs
    d = xf - x0
    hw = w0 + d * spread
    yc = y0 - d * lift + math.sin(d * 0.11 + t) * 3 * wob
    for i, k in enumerate(keys):
        s = 1 - i / (n + 0.3)
        c.disc(xf, yc - hw * 0.1, hw * s * 0.85, k)
    return yc


def tongue(c, x, base, h, w, keys, lean=0.0):
    """Upward fire tongue (Ink.flame) that tolerates tiny sizes."""
    if h < 2:
        c.px(x, base, keys[min(1, len(keys) - 1)])
        return
    c.flame(x, base, h, w, keys, lean)


def embers(c, cx, cy, n, seed, rise, spread, keys, drift=0.0):
    """Rising embers: each is a 2px spark (bright head over a dark tail) so no lone pixel is left behind."""
    r = rng(seed)
    for i in range(n):
        x = cx + r.uniform(-spread, spread) + drift * r.uniform(0.5, 1.2)
        y = cy - rise * r.uniform(0.5, 1.3) - r.uniform(0, 6)
        c.px(x, y, keys[(i + 1) % len(keys)] if i % 3 else keys[-1])
        c.px(x, y + 1, keys[0])


def ground(c, x, y, r, k, w=1, sq=0.3):
    c.ring(x, y, r, k, w, squash=sq)


# --------------------------------------------------------------------------- build + review

def despeckle(c):
    """Clear inked pixels with no other ink within 2 px (dither rims from fade_edges / fade_oval leave a few)."""
    import numpy as np
    a = np.array(c.im)
    ink = a[:, :, 3] > 0
    p = np.pad(ink, 2)
    n = sum(p[2 + dy:2 + dy + ink.shape[0], 2 + dx:2 + dx + ink.shape[1]]
            for dy in range(-2, 3) for dx in range(-2, 3) if dx or dy)
    a[ink & (n == 0)] = 0
    c.im.paste(Image.fromarray(a, 'RGBA'))


def render(mod):
    frames = []
    for f in range(mod['FRAMES']):
        c = Ink(mod['SIZE'], mod['PAL'])
        mod['draw'](c, f)
        despeckle(c)
        frames.append(c.im)
    return frames


BG = (0x40, 0x58, 0x38, 255)   # review stage green (#405838)


def preview(frames, scale=4, gap=4, maxw=1880):
    """4x cells with a visible frame border and index, wrapped into rows so no side passes maxw."""
    size = frames[0].size[0]
    cell = size * scale
    cols = max(1, min(len(frames), (maxw - gap) // (cell + gap)))
    rows = math.ceil(len(frames) / cols)
    top = 14
    W = cols * (cell + gap) + gap
    H = rows * (cell + gap + top) + gap
    im = Image.new('RGBA', (W, H), BG)
    d = ImageDraw.Draw(im)
    font = ImageFont.load_default()
    for i, fr in enumerate(frames):
        r, q = divmod(i, cols)
        x = gap + q * (cell + gap)
        y = gap + r * (cell + gap + top) + top
        d.rectangle((x - 1, y - 1, x + cell, y + cell), outline=(0xff, 0x40, 0xa0, 255))
        im.alpha_composite(fr.resize((cell, cell), Image.NEAREST), (x, y))
        d.text((x + 2, y - 13), str(i), fill=(0xff, 0xff, 0xa0, 255), font=font)
    return im


def run(mod, quiet=False):
    key, size, n, anchor = mod['KEY'], mod['SIZE'], mod['FRAMES'], mod['ANCHOR']
    spec = contract().get(key)
    if not spec or (spec['frame'], spec['frames'], spec['anchor']) != (size, n, anchor):
        raise SystemExit(f'{key}: script {anchor} {size}px x{n} != contract {spec}')
    if key not in my_keys():
        raise SystemExit(f'{key}: not in RETRO_MONSTER_FX_SHEETS[{FIRST}..{LAST}]')
    if len(mod['PAL']) > 15:
        raise SystemExit(f'{key}: palette has {len(mod["PAL"])} inks (+transparent > 16)')
    frames = render(mod)
    sheet = Image.new('RGBA', (size * n, size), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        sheet.paste(fr, (i * size, 0))
    problems, total, counts, diffs = check(size, n, sheet, frames)
    # stray pixels: an inked pixel with no other ink within 2 px (dotted dither lines keep a neighbour at 2 px)
    for i, fr in enumerate(frames):
        a = fr.getchannel('A').load()
        lone = 0
        for y in range(size):
            for x in range(size):
                if a[x, y] and not any(a[x + dx, y + dy] for dx in range(-2, 3) for dy in range(-2, 3)
                                       if (dx or dy) and 0 <= x + dx < size and 0 <= y + dy < size):
                    lone += 1
        if lone > 4:
            problems.append(f'frame {i}: {lone} lone px')
    OUT.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / f'{key}.png', optimize=True)
    if Image.open(OUT / f'{key}.png').convert('RGBA').tobytes() != sheet.tobytes():
        problems.append('png roundtrip changed pixels')
    preview(frames).save(REVIEW / f'{key}-preview.png')
    status = 'OK ' if not problems else 'BAD'
    line = (f'{status} {key:<20} {anchor:<10} {size}px x{n} sheet={sheet.size[0]}x{sheet.size[1]} '
            f'colours={total} minpx={min(counts)} mindiff={min(diffs) if diffs else "-"}')
    if problems:
        line += ' :: ' + '; '.join(problems)
    if not quiet:
        print(line)
    return line, frames, mod


# --------------------------------------------------------------------------- stage board

PW, PH = 440, 264
MON_C, ACT_C, FLOOR = 100, 340, 212


def _actor():
    im = Image.open(ROOT / 'public/assets/generated/charset-battlers/actor1-0.png').convert('RGBA').crop((0, 0, 48, 48))
    return im.resize((96, 96), Image.NEAREST)


def stage_panel(frames, mod, fi, label):
    p = Image.new('RGBA', (PW, PH), BG)
    d = ImageDraw.Draw(p)
    d.line((0, FLOOR + 1, PW, FLOOR + 1), fill=(0x30, 0x44, 0x2a, 255))
    # monster stand-in: 96px square (48px cell at 2x), feet on the floor
    d.rectangle((MON_C - 44, FLOOR - 88, MON_C + 44, FLOOR), fill=(0x6a, 0x40, 0x50, 255), outline=(0x20, 0x10, 0x18, 255))
    d.text((MON_C - 16, FLOOR - 50), 'MON', fill=(0xf0, 0xd0, 0xd8, 255))
    actor = _actor()
    atop = FLOOR - 90                   # actor bbox bottom row 45 of 48 -> feet at atop + 90
    p.alpha_composite(actor, (ACT_C - 48, atop))
    a, size = mod['ANCHOR'], mod['SIZE']
    box = size * 2
    fx = frames[fi].resize((box, box), Image.NEAREST)
    if a in ('target', 'allTargets'):
        pos = (ACT_C - box // 2, atop + 96 + 16 - box)
    elif a in ('user', 'allAllies'):
        pos = (MON_C - box // 2, FLOOR + 8 - box)
    elif a == 'screen':
        pos = (PW // 2 - box // 2, PH // 2 - box // 2)
    else:
        u = (0.2, 0.5, 0.8)[fi % 3]
        sx, sy = MON_C + 30, FLOOR - 50
        ex, ey = ACT_C, atop + 58
        pos = (round(lerp(sx, ex, u)) - box // 2, round(lerp(sy, ey, u) - 24 * 4 * u * (1 - u)) - box // 2)
    p.alpha_composite(fx, pos)
    d.text((4, 4), label, fill=(255, 255, 255, 255))
    return p


def board(results):
    rows = []
    for line, frames, mod in results:
        n = mod['FRAMES']
        if mod['ANCHOR'] == 'projectile':
            picks = [0, 1, 2]
        else:
            peak = mod.get('PEAK', n // 2)
            picks = [max(1, peak - 2), peak, min(n - 2, peak + 2)]
        rows.append([stage_panel(frames, mod, fi, f'{mod["KEY"]} #{fi} {mod["ANCHOR"]}') for fi in picks])
    out = Image.new('RGBA', (3 * (PW + 4), len(rows) * (PH + 4)), (0x10, 0x14, 0x10, 255))
    for r, row in enumerate(rows):
        for ci, p in enumerate(row):
            out.alpha_composite(p, (ci * (PW + 4), r * (PH + 4)))
    out.save(REVIEW / 'board-36_52.png')
    # viewing slices (<= 1900 px each side) for image review
    per = 1900 // (PH + 4)
    for i in range(0, len(rows), per):
        out.crop((0, i * (PH + 4), out.size[0], min(out.size[1], (i + per) * (PH + 4)))).save(REVIEW / f'board-36_52-part{i // per + 1}.png')


def main(only=None):
    keys = my_keys()
    bad = 0
    results = []
    for key in keys:
        if only and key not in only:
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
    if results and not only:
        board(results)
    return bad


if __name__ == '__main__':
    sys.exit(1 if main(sys.argv[1:] or None) else 0)

