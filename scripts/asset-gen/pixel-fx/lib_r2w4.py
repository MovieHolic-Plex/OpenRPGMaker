"""retro2003 roster (r2w) skill FX toolkit — shared by the p4/p5 batches.

Coordinate-drawn pixel art only: no source images, resampling, blur or antialiasing.
Each <key>.py defines KEY, SIZE, FRAMES, ANCHOR, PAL and draw(c, f) then calls run(globals()).
KEY/SIZE/FRAMES/ANCHOR are compared with the layer rows of src/assets/retroRosterSkills/<batch>.ts
(p4.ts / p5.ts); a mismatch aborts before anything is written.

Cell conventions (src/assets/retroClassSkills.ts header is canonical):
  user/target/allTargets/allAllies  64px cell (feet on row 56, body centre 32,34) shown at 2x
  screen                            128px cell over the whole stage; run() rounds it into a dithered oval (fade_oval)
  projectile                        32px loop, head facing LEFT (allies stand right, enemies left)
Sheets stay within 16 colours, alpha 0/255. run() dithers away opaque pixels that touch the outermost
rows/columns of non-projectile cells so no straight cut line shows on stage.

'python3 lib_r2w4.py' rebuilds every p4/p5 sheet that has a script.
"""
import importlib
import math
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import lib_scout  # noqa: E402
from lib_scout import (BG, Cel, OUT, ROOT, WHITE, board, check, ease, lerp, pal, pick, pol, rgba, rng)  # noqa: E402
from fx_edge import fade_edges, fade_oval  # noqa: E402
from lib_monk import burst, converge, pow_burst, star, shade, flame_tongue  # noqa: E402,F401

BATCH_FILES = ['p4', 'p5']
REVIEW = ROOT / '.omo/r2w4'
CX, CY, FEET = 32, 34, 56          # 64px actor-anchored cells

# ---------------------------------------------------------------- shared ink families (a key always means one colour)
SPARKLE = dict(w='#ffffff')
CLEAN = dict(k0='#14101e')


def contract():
    layers = {}
    for b in BATCH_FILES:
        p = ROOT / f'src/assets/retroRosterSkills/{b}.ts'
        if not p.exists():
            continue
        for m in re.finditer(r'key: "(\w+)", anchor: "(\w+)", frame: (\d+), frames: (\d+)', p.read_text(encoding='utf8')):
            layers.setdefault(m.group(1), dict(batch=b, anchor=m.group(2), frame=int(m.group(3)), frames=int(m.group(4))))
    return layers


class Fx(Cel):
    """Cel with an erase ink ('_') and the shared motifs of the roster sheets."""

    def __init__(self, n, palette):
        super().__init__(n, palette)
        self.pal['_'] = (0, 0, 0, 0)

    # ---- light and volume
    def orb(self, x, y, r, keys, hi=None):
        """Layered sphere, keys dark -> light, each layer smaller and nudged up-left; hi = specular key."""
        m = len(keys)
        for i, k in enumerate(keys):
            rr = r * (1 - i * 0.62 / max(1, m))
            off = i * r * 0.14
            self.disc(x - off, y - off, max(0.5, rr), k)
        if hi and r >= 3:
            self.px(x - r * 0.35, y - r * 0.35, hi)

    def glowdisc(self, x, y, r, keys):
        """Soft flat glow: keys outer -> inner concentric discs."""
        n = len(keys)
        for i, k in enumerate(keys):
            self.disc(x, y, max(0.5, r * (1 - i / n)), k)

    def pillar(self, x, y0, y1, w, keys, parity=0):
        """Vertical light shaft: keys wide -> narrow; the widest layer is checker dithered."""
        n = len(keys)
        for i, k in enumerate(keys):
            ww = w * (1 - i / n)
            if i == 0:
                for yy in range(int(y0), int(y1) + 1):
                    for xx in range(int(x - ww), int(x + ww) + 1):
                        if (xx + yy + parity) % 2 == 0:
                            self.px(xx, yy, k)
            else:
                self.rect(x - ww, y0, x + ww, y1, k)

    def shadow(self, x, y, rx, ry, k, dither=False):
        if dither:
            self.ddisc(x, y, rx, k, squash=ry / max(rx, 1))
        else:
            self.oval(x, y, rx, ry, k)

    def sweep(self, cx, cy, r, a0, a1, th, keys, squash=1.0):
        """Tapered arc band between angles a0..a1 (degrees) centred on (cx, cy); keys dark -> light, lighter = thinner."""
        n = len(keys)
        steps = max(8, int(abs(a1 - a0) / 4))
        for i, k in enumerate(keys):
            t_th = th * (n - i) / n
            outer, inner = [], []
            for j in range(steps + 1):
                u = j / steps
                a = math.radians(a0 + (a1 - a0) * u)
                taper = math.sin(math.pi * u) ** 0.7
                outer.append(pol(cx, cy, r, a, squash))
                inner.append(pol(cx, cy, r - max(0.4, t_th * taper), a, squash))
            self.poly(outer + inner[::-1], k)

    def ribbon(self, pts, w, k, ol=None):
        if ol:
            self.line(pts, ol, w + 2)
        self.line(pts, k, w)

    def wave(self, x0, y0, x1, y1, amp, freq, phase, k, w=1, steps=None):
        L = math.hypot(x1 - x0, y1 - y0) or 1
        nx, ny = -(y1 - y0) / L, (x1 - x0) / L
        steps = steps or max(8, int(L / 2))
        pts = []
        for i in range(steps + 1):
            u = i / steps
            o = amp * math.sin(freq * u * 2 * math.pi + phase)
            pts.append((lerp(x0, x1, u) + nx * o, lerp(y0, y1, u) + ny * o))
        self.line(pts, k, w)
        return pts

    def dashes(self, p0, p1, k, on=2, off=2):
        (x0, y0), (x1, y1) = p0, p1
        L = math.hypot(x1 - x0, y1 - y0) or 1
        d = 0.0
        while d < L:
            e = min(L, d + on)
            self.line([(lerp(x0, x1, d / L), lerp(y0, y1, d / L)), (lerp(x0, x1, e / L), lerp(y0, y1, e / L))], k)
            d += on + off

    def shock(self, x, y, r, keys, squash=1.0, w=1):
        """Expanding impact ring: keys outer -> inner (dark, mid, light)."""
        for i, k in enumerate(keys):
            self.ring(x, y, r - i * w, k, w, squash=squash)

    def gear(self, x, y, r, teeth, rot, body, edge, hole='_'):
        pts = []
        for i in range(teeth * 4):
            a = rot + i * 2 * math.pi / (teeth * 4)
            rr = r if (i % 4) in (0, 1) else r * 0.72
            pts.append(pol(x, y, rr, a))
        self.poly([(px_ + (px_ - x) * 0.12, py_ + (py_ - y) * 0.12) for px_, py_ in pts], edge)
        self.poly(pts, body)
        self.disc(x, y, max(0.5, r * 0.32), hole)

    def cross(self, x, y, s, k, ol=None, long=1.4):
        """Latin cross centred at (x, y); s = arm half-width scale."""
        a, b = s * long, s
        if ol:
            self.rect(x - s * 0.34 - 1, y - a - 1, x + s * 0.34 + 1, y + a + 1, ol)
            self.rect(x - b - 1, y - a * 0.4 - 1 + s * 0.2, x + b + 1, y - a * 0.4 + s * 0.68 + 1, ol)
        self.rect(x - s * 0.34, y - a, x + s * 0.34, y + a, k)
        self.rect(x - b, y - a * 0.4 + s * 0.2, x + b, y - a * 0.4 + s * 0.68, k)

    def heartp(self, x, y, s, k, ol=None):
        if ol:
            self.heartp(x, y, s + 1, ol)
        self.disc(x - s * 0.5, y - s * 0.3, s * 0.55, k)
        self.disc(x + s * 0.5, y - s * 0.3, s * 0.55, k)
        self.poly([(x - s * 1.05, y - s * 0.15), (x + s * 1.05, y - s * 0.15), (x, y + s * 0.95)], k)

    def feather(self, x, y, ang, L, body, hi, ol=None):
        ux, uy = math.cos(ang), math.sin(ang)
        vx, vy = -uy, ux
        w = max(1.2, L * 0.24)
        tip = (x + ux * L / 2, y + uy * L / 2)
        tail = (x - ux * L / 2, y - uy * L / 2)
        pts = [tail, (x - ux * L * 0.1 + vx * w, y - uy * L * 0.1 + vy * w), tip, (x - ux * L * 0.1 - vx * w, y - uy * L * 0.1 - vy * w)]
        if ol:
            self.poly([(px_ + (px_ - x) * 0.18, py_ + (py_ - y) * 0.18) for px_, py_ in pts], ol)
        self.poly(pts, body)
        self.line([tail, tip], hi)

    def petalp(self, x, y, ang, L, body, hi=None):
        ux, uy = math.cos(ang), math.sin(ang)
        vx, vy = -uy, ux
        if L < 3:
            self.px(x, y, body)
            self.px(x + ux, y + uy, hi or body)
            return
        pts = [(x - ux * L / 2, y - uy * L / 2), (x + vx * L * 0.36, y + vy * L * 0.36), (x + ux * L / 2, y + uy * L / 2),
               (x - vx * L * 0.36, y - vy * L * 0.36)]
        self.poly(pts, body)
        if hi:
            self.line([(x - ux * L * 0.1, y - uy * L * 0.1), (x + ux * L * 0.28, y + uy * L * 0.28)], hi)

    def sparks_at(self, pts, core, arm=None, r=2):
        for x, y in pts:
            self.spark(x, y, r, core, arm)

    # ---- particle systems
    def rise(self, t, n, seed, keys, x0, x1, y0, y1, sway=2.0, size=1):
        """n motes climbing from y0 up to y1 over t (0..1), each with its own phase; keys light -> dark as they age."""
        r = rng(seed)
        for i in range(n):
            ph = r.uniform(0, 1)
            x = r.uniform(x0, x1)
            u = (t * 0.9 + ph) % 1.0
            y = lerp(y0, y1, u)
            xx = x + math.sin(u * 6.28 + i) * sway
            k = keys[min(len(keys) - 1, int(u * len(keys)))]
            if size >= 2 and u < 0.6:
                self.disc(xx, y, 1, k)
            else:
                self.px(xx, y, k)

    def fall(self, t, n, seed, keys, x0, x1, y0, y1, drift=0.0, size=1):
        r = rng(seed)
        for i in range(n):
            ph = r.uniform(0, 1)
            x = r.uniform(x0, x1)
            u = (t * 0.9 + ph) % 1.0
            self.px(x + drift * u, lerp(y0, y1, u), keys[i % len(keys)])
            if size >= 2:
                self.px(x + drift * u, lerp(y0, y1, u) - 1, keys[i % len(keys)])

    def twinkles(self, t, n, seed, core, arm, box, r=2):
        """n stationary twinkles that pop in and out (each lives ~1/3 of the strip)."""
        rr = rng(seed)
        x0, y0, x1, y1 = box
        for i in range(n):
            ph = rr.uniform(0, 1)
            x, y = rr.uniform(x0, x1), rr.uniform(y0, y1)
            u = (t + ph) % 1.0
            if u < 0.35:
                s = 1 + int(r * math.sin(u / 0.35 * math.pi))
                self.spark(x, y, s, core, arm)

    def orbit(self, cx, cy, rad, t, n, k, size=1, squash=0.6, rot=0.0, keyb=None):
        for i in range(n):
            a = rot + t * 2 * math.pi + i * 2 * math.pi / n
            x, y = pol(cx, cy, rad, a, squash)
            front = math.sin(a) > 0
            kk = k if front or not keyb else keyb
            if size >= 2:
                self.disc(x, y, size / 2, kk)
            else:
                self.px(x, y, kk)


# ---------------------------------------------------------------- output

def render(mod):
    frames = []
    size, anchor = mod['SIZE'], mod['ANCHOR']
    for f in range(mod['FRAMES']):
        c = Fx(size, mod['PAL'])
        mod['draw'](c, f)
        if anchor == 'screen':
            fade_oval(c)
        elif anchor != 'projectile':
            fade_edges(c, T=3, B=3, L=3, R=3)
        frames.append(c.im)
    return frames


def edge_touch(frames, size, anchor):
    """Opaque pixels on the outermost ring after fading = a visible straight cut."""
    bad = 0
    for fr in frames:
        a = fr.getchannel('A').load()
        for i in range(size):
            for (x, y) in ((i, 0), (i, size - 1), (0, i), (size - 1, i)):
                if a[x, y]:
                    bad += 1
    return bad


def run(mod, quiet=False, batch=None):
    key, size, n, anchor = mod['KEY'], mod['SIZE'], mod['FRAMES'], mod['ANCHOR']
    spec = contract().get(key)
    got = dict(anchor=anchor, frame=size, frames=n)
    assert spec, f'{key}: not in retroRosterSkills/{{{",".join(BATCH_FILES)}}}.ts'
    want = {k: spec[k] for k in got}
    assert got == want, f'{key}: script {got} != contract {want}'
    frames = render(mod)
    sheet = Image.new('RGBA', (size * n, size), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        sheet.paste(fr, (i * size, 0))
    problems, total, counts, diffs = check(size, n, sheet, frames)
    if anchor == 'projectile':
        # a loop: last frame must differ from the first too
        if frames[0].tobytes() == frames[-1].tobytes():
            problems.append('loop ends equal to start')
    OUT.mkdir(parents=True, exist_ok=True)
    out_dir = REVIEW / spec['batch'] / 'fx'
    out_dir.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / f'{key}.png', optimize=True)
    back = Image.open(OUT / f'{key}.png').convert('RGBA')
    if back.tobytes() != sheet.tobytes():
        problems.append('png roundtrip changed pixels')
    scale = 4 if size == 32 else (3 if size == 64 else 2)
    b = board(frames, scale)
    b.save(out_dir / f'{key}-preview.png')
    status = 'OK ' if not problems else 'BAD'
    line = (f'{status} {key:<26} {anchor:<10} {size}px x{n} colours={total} minpx={min(counts)} mindiff={min(diffs) if diffs else "-"}')
    if problems:
        line += ' :: ' + '; '.join(problems)
    if not quiet:
        print(line)
    return line, frames, mod


def main(keys=None):
    bad = 0
    for key in contract():
        if keys and key not in keys:
            continue
        p = HERE / f'{key}.py'
        if not p.exists():
            print(f'--- {key} missing')
            continue
        mod = importlib.import_module(key)
        bad += run(vars(mod))[0].startswith('BAD')
    return bad


if __name__ == '__main__':
    sys.exit(1 if main(sys.argv[1:] or None) else 0)
