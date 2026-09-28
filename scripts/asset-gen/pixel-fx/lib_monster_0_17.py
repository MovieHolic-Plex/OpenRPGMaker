"""Monster skill FX for retro2003 — sheets 0-17 of RETRO_MONSTER_FX_SHEETS (src/assets/retroMonsterSkills.ts).

Coordinate-drawn pixel art only (python3 + Pillow): no source images, resampling, blur or antialiasing.
Each <key>.py defines KEY, SIZE, FRAMES, ANCHOR, PAL and draw(c, f), then calls run(globals()).
'python3 lib_monster_0_17.py' rebuilds all 18 sheets plus the review images in .omo/mfx/;
'python3 lib_monster_0_17.py <key> ...' limits the run.

Direction is the mirror of the class sheets: monsters stand LEFT, allies RIGHT.
  projectile  32px loop flying left -> right, head facing RIGHT
  target      64px cell over one ally (shown 2x = 128px). Hits arrive from the left.
              feet on row 56, chest around (28, 43); the actor1 body fills about x 16-39, y 33-57
              (the fx cell is centred on the 48px actor cell and its row 56 sits on the actor's feet).
  allTargets  same cell over every ally       allAllies  same cell over every monster
  user        64px cell over the casting monster (48-96px cells): auras stay round around the cell centre

Colour identity (kept apart from the class skills): poison = acid yellow-green + violet, darkness = violet /
black / crimson, fire = orange-red on black, earth = brown dust, bone = ivory, web = silk grey.
Every cell ends with fx_edge.fade_edges so no layer shows a straight cut at its border.
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
from lib_samurai import Ink  # noqa: E402
from fx_edge import fade_edges, fade_oval  # noqa: E402,F401

CONTRACT = ROOT / 'src/assets/retroMonsterSkills.ts'
REVIEW = ROOT / '.omo/mfx'
STAGE = (0x40, 0x58, 0x38, 255)
BG = (0x20, 0x28, 0x40, 255)

MINE = ['mon_acid_blob', 'mon_acid_splash', 'mon_slam_hit', 'mon_drain', 'mon_screech_ring', 'mon_sting',
        'mon_web_ball', 'mon_web_net', 'mon_scythe_x', 'mon_howl_ring', 'mon_charge_dust', 'mon_tusk_hit',
        'mon_claw_rake', 'mon_fang_bite', 'mon_shell_barrier', 'mon_hellfire_bite', 'mon_curse_skull', 'mon_bone_arrow']

# Ink families. One key always means one colour.
ACID = dict(a0='#1c2608', a1='#46620e', a2='#8cae1a', a3='#cce436', a4='#f4ff9c')
TOXV = dict(u0='#240c34', u1='#4c1a66', u2='#8434a6', u3='#c276e2')
GORE = dict(r0='#240410', r1='#5e0a22', r2='#a8142e', r3='#e2384a', r4='#ff9a94')
DUSK = dict(v0='#140818', v1='#341244', v2='#5e2276', v3='#9446b4', v4='#d09aee')
DIRT = dict(d0='#34200e', d1='#643e1c', d2='#9c6634', d3='#cc9a5e', d4='#f0d6a4')
EMBER = dict(e0='#3a0808', e1='#8e1a0e', e2='#dc4a14', e3='#ff9a2a', e4='#ffe27a')
SOOT = dict(o0='#1a1010', o1='#3c2c2a', o2='#66524c')
BONE = dict(b0='#3e362a', b1='#8a7e62', b2='#cabe9c', b3='#f4ecd4')
SILK = dict(k0='#3a3a4c', k1='#7c7c94', k2='#bcbccc', k3='#eeeef4')
SHELL = dict(h0='#2e2410', h1='#6a5424', h2='#a88a3c', h3='#dcc06a', h4='#fff0b0')
SONIC = dict(m0='#2a0c30', m1='#6a1c6e', m2='#b03ca8', m3='#e880d6', m4='#ffd0f4')
IMPACT = dict(y2='#ffd24a', y3='#fff4b4')
WHITE = dict(w='#ffffff')

CX, CY, FEET = 28, 43, 56      # target cells: ally chest / feet (head around (27, 37))
UX, UY = 32, 34                # user / allAllies cells: monster body centre


# --------------------------------------------------------------------------- motifs

def teeth(c, p0, p1, n, h, up, keys):
    """Row of n triangular teeth along p0-p1, tips h px down (or up). keys = (body, lit edge)."""
    (x0, y0), (x1, y1) = p0, p1
    for i in range(n):
        a = (lerp(x0, x1, i / n), lerp(y0, y1, i / n))
        b = (lerp(x0, x1, (i + 1) / n), lerp(y0, y1, (i + 1) / n))
        m = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + (-h if up else h))
        c.poly([a, b, m], keys[0])
        c.line([a, m], keys[1])


def fang(c, x, y, L, w, down, body, hi, edge=None):
    """Curved canine with its root at (x, y), tip L px down (down=True) or up."""
    s = 1 if down else -1
    pts = [(x - w, y), (x + w, y), (x + w * 0.4 + 1, y + s * L * 0.6), (x + 1.5, y + s * L), (x - w * 0.5, y + s * L * 0.55)]
    if edge:
        c.poly([(px + (1 if px > x else -1), py) for px, py in pts], edge)
    c.poly(pts, body)
    c.line([(x - w + 1, y), (x - w * 0.3, y + s * L * 0.55)], hi)


def jaws(c, hx, cy, open_, length, tooth, gum, maw=None, n=5, big=None):
    """Side-on jaws hinged at (hx, cy) opening to the right (the biter comes from the left)."""
    top, bot = (hx + length, cy - open_), (hx + length, cy + open_)
    if maw:                                                 # checker-dithered maw: the target shows through
        for yy in range(int(top[1]), int(bot[1]) + 1):
            half = abs(yy - cy) / max(open_, 1)
            for xx in range(int(hx + length * half), int(top[0]) + 1):
                if (xx + yy) % 2 == 0:
                    c.px(xx, yy, maw)
    c.line([(hx, cy - 1), top], gum, 3)
    c.line([(hx, cy + 1), bot], gum, 3)
    teeth(c, (hx + 3, cy - 1), (top[0] - 3, top[1] + 1), n, 3, False, tooth)
    teeth(c, (hx + 3, cy + 1), (bot[0] - 3, bot[1] - 1), n, 3, True, tooth)
    if big:
        fang(c, top[0] - 2, top[1], 7, 2, True, big[0], big[1])
        fang(c, bot[0] - 2, bot[1], 7, 2, False, big[0], big[1])


def star(c, x, y, r_out, r_in, n, rot, k):
    pts = []
    for i in range(n * 2):
        pts.append(pol(x, y, r_out if i % 2 == 0 else r_in, rot + i * math.pi / n))
    c.poly(pts, k)


def hexagon(c, x, y, r, k, rot=math.pi / 6):
    pts = [pol(x, y, r, rot + i * math.pi / 3) for i in range(6)]
    c.line(pts + [pts[0]], k)
    return pts


def zee(c, x, y, s, k):
    c.line([(x, y), (x + s, y)], k)
    c.line([(x + s, y), (x, y + s)], k)
    c.line([(x, y + s), (x + s, y + s)], k)


def chevron(c, x, y, s, k, hi=None, down=False):
    d = -1 if down else 1
    c.line([(x - s, y + d * s), (x, y), (x + s, y + d * s)], k, 2)
    if hi:
        c.px(x, y - d, hi)
        c.px(x - 1, y, hi)


def skull(c, x, y, s, fill, hi, rim, hole, glow=None, jaw=0):
    """Front-facing skull: cranium centre (x, y), size factor s (s=1 -> about 13x15 px)."""
    c.disc(x, y, 6 * s + 1, rim)
    c.rect(x - 3.5 * s - 1, y + 3 * s, x + 3.5 * s + 1, y + 7 * s + 1 + jaw, rim)
    c.disc(x, y, 6 * s, fill)
    c.rect(x - 3.5 * s, y + 3 * s, x + 3.5 * s, y + 5 * s, fill)
    c.rect(x - 3 * s, y + 5 * s + jaw, x + 3 * s, y + 7 * s + jaw, fill)
    c.disc(x - 2.5 * s, y - 3 * s, 1.6 * s, hi)
    for sx in (-1, 1):
        c.disc(x + sx * 2.5 * s, y + 0.8 * s, 1.8 * s, hole)
        if glow:
            c.disc(x + sx * 2.5 * s, y + 0.8 * s, max(0.5, 0.7 * s), glow)
    c.poly([(x, y + 2.6 * s), (x - 1, y + 4.2 * s), (x + 1, y + 4.2 * s)], hole)
    for tx in (-2, 0, 2):
        c.line([(x + tx * s, y + 5 * s + jaw), (x + tx * s, y + 6.6 * s + jaw)], hole)
    if jaw:
        c.rect(x - 3 * s, y + 5 * s, x + 3 * s, y + 5 * s + jaw - 1, hole)


def drops(c, cx, cy, n, r0, r1, seed, body, hi, a0=0.0, a1=2 * math.pi, sq=1.0, fall=0.0, size=1.5):
    r = rng(seed)
    for _ in range(n):
        a = r.uniform(a0, a1)
        d = r.uniform(r0, r1)
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d * sq + fall * r.uniform(0.6, 1.3)
        s = size * r.uniform(0.7, 1.2)
        c.disc(x, y, s, body)
        if s >= 1.2:
            c.px(x - 1, y - 1, hi)


def dust(c, x, y, r, seed, keys=('d1', 'd2', 'd3', 'd4'), fade=False):
    """Soft dust cloud: checker-dithered dark rim, mid body squashed flat, light lobes up-left.
    fade=True keeps only a dithered ghost for the last frames."""
    rr = rng(seed)
    lobes = [(rr.uniform(-0.75, 0.75) * r, rr.uniform(-0.45, 0.1) * r, rr.uniform(0.35, 0.55) * r) for _ in range(5)]
    if fade:
        c.ddisc(x, y, r, keys[1], squash=0.6)
        for ox, oy, s in lobes[:3]:
            c.ddisc(x + ox, y + oy, s, keys[2], parity=1)
        return
    c.ddisc(x, y, r * 1.15, keys[0], squash=0.62)
    c.oval(x, y + r * 0.1, r * 0.85, r * 0.45, keys[1])
    for ox, oy, s in lobes:
        c.disc(x + ox, y + oy, s, keys[1])
    for ox, oy, s in lobes:
        if oy < -0.1 * r:
            c.disc(x + ox - 1, y + oy - 1, max(0.8, s - 1.2), keys[2])
    for ox, oy, s in lobes[:2]:
        c.disc(x + ox - 1.5, y + oy - 1.5, max(0.6, s * 0.4), keys[3])


def specks(c, cx, cy, n, r0, r1, seed, keys, sq=1.0):
    r = rng(seed)
    for i in range(n):
        a = r.uniform(0, 2 * math.pi)
        d = r.uniform(r0, r1)
        c.px(cx + math.cos(a) * d, cy + math.sin(a) * d * sq, keys[i % len(keys)])


def speed_lines(c, x0, x1, ys, k, phase=0):
    for i, y in enumerate(ys):
        off = ((i * 5 + phase * 3) % 7)
        c.line([(x0 + off, y), (x1 - off, y)], k)


# --------------------------------------------------------------------------- contract + output

def contract():
    """Ordered {key: (anchor, frame, frames)} straight from the contract's L(...) calls, first use wins."""
    out = {}
    for m in re.finditer(r'L\("(\w+)", "(\w+)", (\d+), (\d+)\)', CONTRACT.read_text(encoding='utf8')):
        out.setdefault(m.group(1), (m.group(2), int(m.group(3)), int(m.group(4))))
    return out


def _assert_share():
    keys = list(contract())[:18]
    if keys != MINE:
        raise SystemExit(f'contract order changed: sheets 0-17 are now {keys}')


def render(mod):
    frames = []
    edge = mod.get('EDGE', dict(T=4, B=3, L=4, R=4) if mod['SIZE'] == 64 else dict(L=3))
    for f in range(mod['FRAMES']):
        c = Ink(mod['SIZE'], mod['PAL'])
        mod['draw'](c, f)
        if edge:
            fade_edges(c, **edge)
        frames.append(c.im)
    return frames


def preview(frames, scale=4, cols=6, gap=4):
    """Scaled frames with cell borders, wrapped so a row stays under 1900px."""
    size = frames[0].size[0]
    cell = size * scale
    cols = min(cols, len(frames))
    rows = (len(frames) + cols - 1) // cols
    top = 14
    im = Image.new('RGBA', (cols * (cell + gap) + gap, rows * (cell + gap + top) + gap), BG)
    d = ImageDraw.Draw(im)
    font = ImageFont.load_default()
    for i, fr in enumerate(frames):
        x = gap + (i % cols) * (cell + gap)
        y = gap + (i // cols) * (cell + gap + top) + top
        d.rectangle((x - 1, y - 1, x + cell, y + cell), outline=(0x5a, 0x66, 0x88, 255))
        im.alpha_composite(fr.resize((cell, cell), Image.NEAREST), (x, y))
        d.text((x + 2, y - 13), str(i), fill=(0xf0, 0xf0, 0xa0, 255), font=font)
    return im


def run(mod, quiet=False):
    key, size, n, anchor = mod['KEY'], mod['SIZE'], mod['FRAMES'], mod['ANCHOR']
    spec = contract().get(key)
    if spec != (anchor, size, n):
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
    preview(frames, 4 if size <= 64 else 2).save(REVIEW / f'{key}-preview.png')
    status = 'OK ' if not problems else 'BAD'
    line = (f'{status} {key:<18} {anchor:<10} {size}px x{n} sheet={sheet.size[0]}x{sheet.size[1]} '
            f'colours={total} minpx={min(counts)} mindiff={min(diffs) if diffs else "-"}')
    if problems:
        line += ' :: ' + '; '.join(problems)
    if not quiet:
        print(line)
    return line, frames, mod


# --------------------------------------------------------------------------- review boards

PW, PH, GROUND = 400, 210, 178
MX, AX = 80, 310


def _actor():
    im = Image.open(ROOT / 'public/assets/generated/charset-battlers/actor1-0.png').convert('RGBA').crop((0, 0, 48, 48))
    return im.resize((96, 96), Image.NEAREST)


def _panel(actor, mod, frames, fi, slot, nslot):
    p = Image.new('RGBA', (PW, PH), STAGE)
    d = ImageDraw.Draw(p)
    d.line((0, GROUND + 1, PW, GROUND + 1), fill=(0x2e, 0x42, 0x28, 255))
    d.rectangle((MX - 32, GROUND - 64, MX + 32, GROUND), fill=(0x70, 0x40, 0x60, 255), outline=(0x1c, 0x10, 0x1c, 255))
    p.alpha_composite(actor, (AX - 48, GROUND - 88))      # actor feet = row 44 of the 48px cell
    s = mod['SIZE'] * 2
    fx = frames[fi].resize((s, s), Image.NEAREST)
    a = mod['ANCHOR']
    if a in ('target', 'allTargets'):
        pos = (AX - s // 2, GROUND - 112)                   # fx row 56 on the feet
    elif a in ('user', 'allAllies'):
        pos = (MX - s // 2, GROUND - 112)
    elif a == 'screen':
        pos = (PW // 2 - s // 2, PH // 2 - s // 2)
    else:
        t = (slot + 0.5) / nslot
        pos = (int(lerp(MX + 30, AX - 40, t)) - s // 2, GROUND - 50 - s // 2)
    p.alpha_composite(fx, pos)
    d.text((4, 4), f'{mod["KEY"]} #{fi}', fill=(255, 255, 255, 255), font=ImageFont.load_default())
    return p


def boards(results):
    actor = _actor()
    rows = []
    for _, frames, mod in results:
        n = mod['FRAMES']
        picks = list(range(4)) if mod['ANCHOR'] == 'projectile' else sorted({1, round(n * 0.35), n // 2, n - 2})
        rows.append([_panel(actor, mod, frames, fi, i, len(picks)) for i, fi in enumerate(picks)])
    W = 4 * (PW + 4)
    full = Image.new('RGBA', (W, len(rows) * (PH + 4)), (0x10, 0x14, 0x20, 255))
    for r, row in enumerate(rows):
        for ci, p in enumerate(row):
            full.alpha_composite(p, (ci * (PW + 4), r * (PH + 4)))
    full.save(REVIEW / 'board-0_17.png')
    per = 6
    for part in range(0, len(rows), per):
        full.crop((0, part * (PH + 4), W, min(len(rows), part + per) * (PH + 4))).save(REVIEW / f'board-0_17-part{part // per + 1}.png')
    # contact sheet of every frame (2x, 4x for projectiles), split so each image stays under 1900px
    strips = []
    font = ImageFont.load_default()
    for _, frames, mod in results:
        sc = 4 if mod['SIZE'] == 32 else 2
        cell = mod['SIZE'] * sc
        im = Image.new('RGBA', (len(frames) * (cell + 4) + 4, cell + 20), BG)
        dd = ImageDraw.Draw(im)
        dd.text((4, 2), f'{mod["KEY"]} {mod["ANCHOR"]} {mod["SIZE"]}px x{mod["FRAMES"]}', fill=(255, 255, 255, 255), font=font)
        for i, fr in enumerate(frames):
            x = 4 + i * (cell + 4)
            dd.rectangle((x - 1, 15, x + cell, 16 + cell), outline=(0x5a, 0x66, 0x88, 255))
            im.alpha_composite(fr.resize((cell, cell), Image.NEAREST), (x, 16))
        strips.append(im)
    for part in range(0, len(strips), 9):
        group = strips[part:part + 9]
        out = Image.new('RGBA', (max(s.size[0] for s in group), sum(s.size[1] for s in group)), BG)
        y = 0
        for s in group:
            out.alpha_composite(s, (0, y))
            y += s.size[1]
        out.save(REVIEW / f'frames-0_17-part{part // 9 + 1}.png')


def main(keys=None):
    _assert_share()
    bad, results = 0, []
    for key in MINE:
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
        boards(results)
    return bad


if __name__ == '__main__':
    sys.exit(1 if main(sys.argv[1:] or None) else 0)

