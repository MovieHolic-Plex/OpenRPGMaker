"""Shared pixel-FX primitives for the retro2003 hero / guardian class skill sheets.

Every sheet is drawn on a palette-index canvas (0 = transparent), so binary alpha and the
colour budget hold by construction. Shapes are aliased masks from PIL mode "1"; shading comes
from morphological rings (dilate = dark rim, erode = lighter inner steps), never from blur.
Run 'python3 lib_hero.py' to rebuild all 22 sheets and the review images in .omo/pixel-fx/,
or 'python3 <key>.py' for one sheet.
"""
from __future__ import annotations

import importlib
import math
import random
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = ROOT / "public/assets/generated/pixel-fx"
REVIEW = ROOT / ".omo/pixel-fx"
CONTRACT = ROOT / "src/assets/retroClassSkills.ts"
BG = (0x20, 0x28, 0x40, 255)

# ---- palettes (name -> hex). Same-skill layers share one palette. -------------------------
STEEL = {"k": "#0e1636", "d": "#22408a", "m": "#3a7ed6", "l": "#78ccff", "p": "#c6f2ff", "w": "#ffffff", "y": "#ffe468", "o": "#f09a2a"}
FIRE = {"k": "#3a0a1e", "r": "#8e1a26", "d": "#d23c28", "m": "#f47a24", "l": "#ffc03a", "p": "#fff08c", "w": "#ffffff"}
METEOR = {**FIRE, "s0": "#2a1c1c", "s1": "#5a3c30", "s2": "#8c6448"}
DUST = {"k": "#3a2a28", "d": "#6a4c3a", "m": "#9c7652", "l": "#cca77a", "p": "#f0dcb0", "w": "#fffaf0"}
WAR = {"k": "#4a1010", "d": "#a8301c", "m": "#ee7822", "l": "#ffc63e", "p": "#fff2a0", "w": "#ffffff"}
BRAVE = {"k": "#241c5c", "v": "#4a44b4", "c": "#3ea4f0", "l": "#9ceaff", "gd": "#b0701e", "g": "#f6c434", "p": "#fff4b0", "w": "#ffffff"}
SHIELD = {"k": "#161e36", "d": "#3e5078", "m": "#7c94bc", "l": "#c8d8ee", "w": "#ffffff", "o": "#e8902c", "y": "#ffe060", "p": "#fff6c0"}
CHARGE = {**SHIELD, "b0": "#4a3428", "b1": "#86644a", "b2": "#c09c70"}
TAUNT = {"k": "#34061a", "d": "#86122a", "m": "#d62c38", "l": "#ff7658", "p": "#ffc6a4", "w": "#ffffff", "y": "#ffe060"}
BARRIER = {"k": "#0e2850", "d": "#1c58a2", "m": "#36a0ea", "l": "#7ee0ff", "p": "#cefcff", "w": "#ffffff", "y": "#ffe070"}
COUNTER = {"k": "#141a30", "d": "#384a7a", "m": "#7894cc", "l": "#c6deff", "w": "#ffffff", "r0": "#5e0c20", "r": "#d02636", "rl": "#ff7050"}
HOLY = {"k": "#5a3816", "d": "#b0782a", "m": "#f0be3e", "l": "#fff08e", "w": "#ffffff", "gd": "#1e7a50", "g": "#4ed282", "gl": "#b4ffc4"}
EARTH = {"k": "#241814", "d": "#503628", "m": "#84603f", "l": "#bb9064", "p": "#e6cc9c", "r": "#b0401e", "o": "#f28a28", "y": "#ffd24a", "w": "#fff8e0"}
FORT = {"k": "#161a30", "d": "#363f64", "m": "#6674a0", "l": "#a6b6d8", "p": "#e0ecff", "gd": "#a0661a", "g": "#f0b42e", "y": "#fff08a", "w": "#ffffff",
        "b0": "#4a3428", "b1": "#86644a", "b2": "#c09c70"}


def rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def shift(m: np.ndarray, dx: int, dy: int) -> np.ndarray:
    out = np.zeros_like(m)
    h, w = m.shape
    out[max(dy, 0):h + min(dy, 0), max(dx, 0):w + min(dx, 0)] = m[max(-dy, 0):h + min(-dy, 0), max(-dx, 0):w + min(-dx, 0)]
    return out


def dilate(m: np.ndarray, n: int = 1) -> np.ndarray:
    for _ in range(n):
        m = m | shift(m, 1, 0) | shift(m, -1, 0) | shift(m, 0, 1) | shift(m, 0, -1)
    return m


def erode(m: np.ndarray, n: int = 1) -> np.ndarray:
    return ~dilate(~m, n)


def bez(p0, p1, bend, u):
    """Quadratic curve whose apex sits 'bend' px off the chord (sign = side)."""
    (x0, y0), (x1, y1) = p0, p1
    L = math.hypot(x1 - x0, y1 - y0) or 1
    nx, ny = -(y1 - y0) / L, (x1 - x0) / L
    mx, my = (x0 + x1) / 2 + nx * bend * 2, (y0 + y1) / 2 + ny * bend * 2
    bx = (1 - u) ** 2 * x0 + 2 * (1 - u) * u * mx + u * u * x1
    by = (1 - u) ** 2 * y0 + 2 * (1 - u) * u * my + u * u * y1
    tx = 2 * (1 - u) * (mx - x0) + 2 * u * (x1 - mx)
    ty = 2 * (1 - u) * (my - y0) + 2 * u * (y1 - my)
    return bx, by, tx, ty


class Cell:
    """One square frame of palette indices."""

    def __init__(self, size: int, pal: dict[str, str]):
        self.n = size
        self.names = list(pal)
        self.idx = {k: i + 1 for i, k in enumerate(self.names)}
        cols = [rgb(pal[k]) for k in self.names]
        self.rgba = np.array([(0, 0, 0, 0)] + [c + (255,) for c in cols], np.uint8)
        self.lum = np.array([-1.0] + [0.299 * r + 0.587 * g + 0.114 * b for r, g, b in cols])
        self.a = np.zeros((size, size), np.uint8)
        yy, xx = np.mgrid[0:size, 0:size]
        self.checker = ((xx + yy) % 2 == 0)
        self.yy, self.xx = yy, xx

    # ---- mask builders ------------------------------------------------------------------
    def _draw(self, fn) -> np.ndarray:
        img = Image.new("1", (self.n, self.n), 0)
        fn(ImageDraw.Draw(img))
        return np.array(img, dtype=bool)

    def empty(self) -> np.ndarray:
        return np.zeros((self.n, self.n), bool)

    def poly(self, pts) -> np.ndarray:
        pts = [(float(x), float(y)) for x, y in pts]
        return self._draw(lambda d: d.polygon(pts, fill=1))

    def line(self, pts, w: int = 1) -> np.ndarray:
        pts = [(round(x), round(y)) for x, y in pts]
        return self._draw(lambda d: d.line(pts, fill=1, width=w))

    def ellipse(self, cx, cy, rx, ry) -> np.ndarray:
        return self._draw(lambda d: d.ellipse((round(cx - rx), round(cy - ry), round(cx + rx), round(cy + ry)), fill=1))

    def disc(self, cx, cy, r) -> np.ndarray:
        return self.ellipse(cx, cy, r, r)

    def ring(self, cx, cy, rx, ry, w: int = 1) -> np.ndarray:
        if rx < 1 or ry < 1:
            return self.disc(cx, cy, max(rx, ry, 1))
        return self._draw(lambda d: d.ellipse((round(cx - rx), round(cy - ry), round(cx + rx), round(cy + ry)), outline=1, width=w))

    def rect(self, x0, y0, x1, y1) -> np.ndarray:
        return self._draw(lambda d: d.rectangle((round(x0), round(y0), round(x1), round(y1)), fill=1))

    def stroke(self, p0, p1, bend=0.0, w=4.0, t0=0.0, t1=1.0, inner=0.3, steps=28) -> np.ndarray:
        """Tapered crescent (sword arc) drawn from t0 to t1; thickness follows sin(pi*u) over the full stroke."""
        s = 1 if bend >= 0 else -1
        outer, inn = [], []
        for i in range(steps + 1):
            u = t0 + (t1 - t0) * i / steps
            bx, by, tx, ty = bez(p0, p1, bend, u)
            tl = math.hypot(tx, ty) or 1
            qx, qy = -ty / tl * s, tx / tl * s
            th = w * max(0.0, math.sin(math.pi * u)) ** 0.8
            outer.append((bx + qx * th * (1 - inner), by + qy * th * (1 - inner)))
            inn.append((bx - qx * th * inner, by - qy * th * inner))
        return self.poly(outer + inn[::-1])

    def ray(self, cx, cy, ang, r0, r1, w) -> np.ndarray:
        """Triangle spike: base (width w) at radius r0, point at r1. Angle in degrees."""
        a = math.radians(ang)
        ca, sa = math.cos(a), math.sin(a)
        bx, by = cx + ca * r0, cy + sa * r0
        return self.poly([(bx - sa * w / 2, by + ca * w / 2), (cx + ca * r1, cy + sa * r1), (bx + sa * w / 2, by - ca * w / 2)])

    def burst(self, cx, cy, ro, ri, n, rot=0.0, sy=1.0) -> np.ndarray:
        pts = []
        for i in range(n * 2):
            a = math.radians(rot + i * 180 / n)
            r = ro if i % 2 == 0 else ri
            pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r * sy))
        return self.poly(pts)

    def arcband(self, cx, cy, rx, ry, a0, a1, w, full=None, steps=24, head=False) -> np.ndarray:
        """Band along an ellipse from a0 to a1 (deg), tapered over 'full' (defaults to a0..a1).
        head=True keeps the a1 end thick (a comet-like sweep: thin tail -> fat blade head)."""
        A0, A1 = full or (a0, a1)
        outer, inn = [], []
        for i in range(steps + 1):
            a = a0 + (a1 - a0) * i / steps
            u = (a - A0) / ((A1 - A0) or 1)
            u = min(max(u, 0), 1)
            th = w * (u ** 0.8 if head else max(0.0, math.sin(math.pi * u)) ** 0.7)
            r = math.radians(a)
            ca, sa = math.cos(r), math.sin(r)
            outer.append((cx + (rx + th / 2) * ca, cy + (ry + th / 2) * sa))
            inn.append((cx + (rx - th / 2) * ca, cy + (ry - th / 2) * sa))
        return self.poly(outer + inn[::-1])

    def heater(self, cx, cy, w, h) -> np.ndarray:
        """Heater shield silhouette, point down."""
        hw, top = w / 2, cy - h / 2
        return self.poly([(cx - hw, top), (cx + hw, top), (cx + hw, top + h * 0.45), (cx + hw * 0.55, top + h * 0.8),
                          (cx, top + h), (cx - hw * 0.55, top + h * 0.8), (cx - hw, top + h * 0.45)])

    def star5(self, cx, cy, r) -> np.ndarray:
        return self.burst(cx, cy, r, r * 0.45, 5, rot=-90)

    def flame(self, cx, base, h, w, lean=0.0) -> np.ndarray:
        """Flame tongue: wide round base, pointed tip leaning by 'lean' px."""
        if h < 2:
            return self.empty()
        return self.poly([(cx - w, base), (cx - w * 1.0, base - h * 0.25), (cx - w * 0.6, base - h * 0.55), (cx + lean, base - h),
                          (cx + w * 0.55, base - h * 0.5), (cx + w, base - h * 0.2), (cx + w * 0.8, base)])

    def chevron(self, cx, cy, s=5, w=2) -> np.ndarray:
        return self.line([(cx - s, cy + s * 0.8), (cx, cy - s * 0.2), (cx + s, cy + s * 0.8)], w)

    def hexgrid(self, r, ox=0, oy=0) -> np.ndarray:
        def fn(d):
            for row in range(-2, self.n // int(r * 1.5) + 3):
                for col in range(-2, self.n // int(r * 1.8) + 3):
                    cx = ox + col * r * math.sqrt(3) + (row % 2) * r * math.sqrt(3) / 2
                    cy = oy + row * r * 1.5
                    pts = [(cx + r * math.cos(math.radians(60 * k + 30)), cy + r * math.sin(math.radians(60 * k + 30))) for k in range(7)]
                    d.line([(round(x), round(y)) for x, y in pts], fill=1, width=1)
        return self._draw(fn)

    def dith(self, m: np.ndarray, phase: int = 0) -> np.ndarray:
        return m & (self.checker if phase % 2 == 0 else ~self.checker)

    # ---- painting -----------------------------------------------------------------------
    def put(self, m: np.ndarray, color: str, mode: str = "max") -> None:
        """'max' only brightens (additive light look); 'over' overwrites (solid matter)."""
        i = self.idx[color]
        if mode == "over":
            self.a[m] = i
        else:
            sel = m & (self.lum[self.a] < self.lum[i])
            self.a[sel] = i

    def ramp(self, m: np.ndarray, colors, mode: str = "max", rim: bool = True) -> None:
        """Paint colours from outside in: rim on dilate(m), then m, then successive erosions."""
        layer = dilate(m) if rim else m
        for col in colors:
            if not layer.any():
                break
            self.put(layer, col, mode)
            layer = erode(layer)

    def erase(self, m: np.ndarray) -> None:
        self.a[m] = 0

    def thin(self, phase: int = 0, m: np.ndarray | None = None) -> None:
        """Checker-erase (dither fade) everything, or only inside m."""
        sel = (self.checker if phase % 2 else ~self.checker)
        if m is not None:
            sel = sel & m
        self.a[sel] = 0

    def spark(self, x, y, r, cols=("m", "l", "w"), mode="max") -> None:
        """Four-point twinkle. r=0 is a lone pixel of the core colour."""
        x, y = round(x), round(y)
        if r <= 0:
            self.put(self.rect(x, y, x, y), cols[-1], mode)
            return
        arms = self.line([(x - r, y), (x + r, y)]) | self.line([(x, y - r), (x, y + r)])
        self.put(arms, cols[0], mode)
        h = max(1, r // 2)
        self.put(self.line([(x - h, y), (x + h, y)]) | self.line([(x, y - h), (x, y + h)]), cols[1], mode)
        core = self.rect(x - 1, y, x + 1, y) | self.rect(x, y - 1, x, y + 1) if r >= 3 else self.rect(x, y, x, y)
        self.put(core, cols[-1], mode)

    def puff(self, cx, cy, r, cols=("d", "m", "l", "p"), mode="over") -> None:
        """Dust / smoke ball lit from the upper left."""
        if r < 1:
            return
        self.put(dilate(self.disc(cx, cy, r)), cols[0], mode)
        self.put(self.disc(cx, cy, r), cols[1], mode)
        if r >= 2:
            self.put(self.disc(cx - r * 0.3, cy - r * 0.3, r * 0.6), cols[2], mode)
        if r >= 4 and len(cols) > 3:
            self.put(self.disc(cx - r * 0.45, cy - r * 0.45, r * 0.25), cols[3], mode)

    def cloud(self, cx, cy, r, seed, cols=("d", "m", "l", "p"), floor=None, mode="over") -> None:
        """Lumpy dust cloud: one shared dark rim around 4-6 overlapping lobes, lit from the upper left,
        flattened against an optional floor row so it hugs the ground instead of floating as a ball."""
        if r < 1:
            return
        rr = random.Random(seed)
        lobes = [(cx, cy, r)] + [(cx + rr.uniform(-1.3, 1.3) * r, cy + rr.uniform(-0.7, 0.3) * r, r * rr.uniform(0.45, 0.8)) for _ in range(rr.randint(3, 5))]
        body = self.empty()
        for x, y, s in lobes:
            body |= self.ellipse(x, y, s * 1.15, s * 0.85)
        if floor is not None:
            body &= self.rect(0, 0, self.n - 1, floor)
        self.put(dilate(body), cols[0], mode)
        self.put(body, cols[1], mode)
        lit = self.empty()
        for x, y, s in lobes:
            lit |= self.ellipse(x - s * 0.3, y - s * 0.35, s * 0.7, s * 0.5)
        self.put(lit & body, cols[2], mode)
        if len(cols) > 3 and r >= 4:
            hi = self.empty()
            for x, y, s in lobes[:3]:
                hi |= self.ellipse(x - s * 0.5, y - s * 0.55, s * 0.28, s * 0.2)
            self.put(hi & body, cols[3], mode)

    def rock(self, cx, cy, r, rot, cols=("s0", "s1", "s2"), mode="over") -> None:
        pts = [(cx + math.cos(math.radians(rot + k * 90 + (k % 2) * 20)) * r, cy + math.sin(math.radians(rot + k * 90 + (k % 2) * 20)) * r * 0.9) for k in range(4)]
        m = self.poly(pts) | self.rect(round(cx), round(cy), round(cx), round(cy))
        self.put(dilate(m), cols[0], mode)
        self.put(m, cols[1], mode)
        self.put(m & ~shift(m, 1, 1), cols[2], mode)


def rng(key: str) -> random.Random:
    return random.Random(key)


# ---- contract ----------------------------------------------------------------------------
def contract() -> dict[str, dict]:
    """Layer specs parsed from the (read-only) contract file, keyed by sheet key; first class wins."""
    text = CONTRACT.read_text(encoding="utf8")
    layers: dict[str, dict] = {}
    for m in re.finditer(r'classId: "(\w+)".*?layers: \[(.*?)\] \}', text):
        for l in re.finditer(r'key: "(\w+)", anchor: "(\w+)", frame: (\d+), frames: (\d+)', m.group(2)):
            layers.setdefault(l.group(1), {"cls": m.group(1), "anchor": l.group(2), "frame": int(l.group(3)), "frames": int(l.group(4))})
    return layers


# ---- build + verification ------------------------------------------------------------------
def verify(path: Path, size: int, frames: int) -> dict:
    img = Image.open(path)
    img.load()
    img = img.convert("RGBA")
    a = np.array(img)
    report = {"size": img.size, "ok_size": img.size == (size * frames, size)}
    alpha = set(np.unique(a[..., 3]).tolist())
    report["alpha"] = sorted(alpha)
    report["ok_alpha"] = alpha <= {0, 255}
    colors = {tuple(p) for p in a.reshape(-1, 4) if p[3] == 255}
    report["colors"] = len(colors)
    report["ok_colors"] = len(colors) <= 16
    cells = [a[:, f * size:(f + 1) * size] for f in range(frames)]
    ink = [int((c[..., 3] == 255).sum()) for c in cells]
    report["ink"] = ink
    report["ok_nonempty"] = all(i > 0 for i in ink)
    diffs = [int((cells[f] != cells[f + 1]).any(axis=2).sum()) for f in range(frames - 1)]
    report["diff"] = diffs
    report["ok_motion"] = all(d >= max(8, 0.05 * min(ink[f], ink[f + 1])) for f, d in enumerate(diffs))
    report["ok"] = all(v for k, v in report.items() if k.startswith("ok_"))
    return report


def build(key: str, size: int, frames: int, pal: dict[str, str], draw) -> Path:
    spec = contract().get(key)
    assert spec and spec["frame"] == size and spec["frames"] == frames, f"{key}: script {size}x{frames} != contract {spec}"
    assert len(pal) <= 16, f"{key}: palette has {len(pal)} colours"
    sheet = np.zeros((size, size * frames, 4), np.uint8)
    for f in range(frames):
        c = Cell(size, pal)
        draw(c, f)
        sheet[:, f * size:(f + 1) * size] = c.rgba[c.a]
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / f"{key}.png"
    Image.fromarray(sheet, "RGBA").save(out, optimize=True)
    rep = verify(out, size, frames)
    status = "OK  " if rep["ok"] else "FAIL"
    print(f"{status} {key:22s} {rep['size'][0]}x{rep['size'][1]} alpha={rep['alpha']} colors={rep['colors']} ink={rep['ink']} diff={rep['diff']}")
    if not rep["ok"]:
        raise SystemExit(f"{key}: verification failed {rep}")
    return out


# ---- review images -----------------------------------------------------------------------
FONT = ImageFont.load_default()


def frames_of(key: str) -> tuple[list[Image.Image], int]:
    img = Image.open(OUT / f"{key}.png").convert("RGBA")
    size = img.height
    return [img.crop((f * size, 0, (f + 1) * size, size)) for f in range(img.width // size)], size


def preview(key: str) -> Path:
    cells, size = frames_of(key)
    z = 4
    per_row = max(1, 2600 // (size * z + 6))
    rows = math.ceil(len(cells) / per_row)
    pad, lab = 6, 12
    W = min(per_row, len(cells)) * (size * z + pad) + pad
    H = rows * (size * z + pad + lab) + pad
    im = Image.new("RGBA", (W, H), (12, 14, 24, 255))
    d = ImageDraw.Draw(im)
    for i, c in enumerate(cells):
        x = pad + (i % per_row) * (size * z + pad)
        y = pad + (i // per_row) * (size * z + pad + lab)
        d.text((x, y), f"{key} #{i}", fill=(220, 220, 240, 255), font=FONT)
        tile = Image.new("RGBA", (size * z, size * z), BG)
        tile.alpha_composite(c.resize((size * z, size * z), Image.NEAREST))
        im.alpha_composite(tile, (x, y + lab))
    out = REVIEW / f"{key}-preview.png"
    im.save(out)
    return out


def gif(key: str) -> Path:
    cells, size = frames_of(key)
    frames = []
    for c in cells:
        t = Image.new("RGBA", (size * 2, size * 2), BG)
        t.alpha_composite(c.resize((size * 2, size * 2), Image.NEAREST))
        frames.append(t.convert("RGB").quantize(colors=32, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
    out = REVIEW / f"{key}.gif"
    frames[0].save(out, save_all=True, append_images=frames[1:], duration=80, loop=0, disposal=1)
    return out


def class_sheet(cls: str, keys: list[str]) -> Path:
    rows = []
    for k in keys:
        cells, size = frames_of(k)
        z = 2 if size < 128 else 1
        row = Image.new("RGBA", (len(cells) * (size * z + 4) + 4, size * z + 18), (12, 14, 24, 255))
        ImageDraw.Draw(row).text((4, 2), f"{k}  {size}px x {len(cells)}", fill=(230, 230, 240, 255), font=FONT)
        for i, c in enumerate(cells):
            t = Image.new("RGBA", (size * z, size * z), BG)
            t.alpha_composite(c.resize((size * z, size * z), Image.NEAREST))
            row.alpha_composite(t, (4 + i * (size * z + 4), 14))
        rows.append(row)
    W = max(r.width for r in rows)
    im = Image.new("RGBA", (W, sum(r.height for r in rows)), (12, 14, 24, 255))
    y = 0
    for r in rows:
        im.alpha_composite(r, (0, y))
        y += r.height
    out = REVIEW / f"{cls}-sheet.png"
    im.save(out)
    return out


def _battler(path: str) -> Image.Image:
    return Image.open(ROOT / path).convert("RGBA").crop((0, 0, 48, 48))


def composite(cls: str, keys: list[str], spec: dict) -> Path:
    """Logical-pixel stage (slime left, actor right, feet on one line), 4 frames per sheet, then 2x."""
    actor = _battler("public/assets/generated/charset-battlers/actor1-0.png")   # feet at row 45
    slime = _battler("public/assets/generated/pixel-enemies/slime.png")        # feet at row 45
    PW, PH, FEET = 232, 150, 132
    EX, AX = 64, 172
    rows = []
    for k in keys:
        cells, size = frames_of(k)
        anchor = spec[k]["anchor"]
        n = len(cells)
        picks = sorted({round(i * (n - 1) / 3) for i in range(4)}) if anchor != "projectile" else [0, 1, 2, 3]
        row = Image.new("RGBA", (PW * 4, PH), (12, 14, 24, 255))
        for j, f in enumerate(picks):
            p = Image.new("RGBA", (PW, PH), BG)
            p.alpha_composite(slime, (EX - 24, FEET - 45))
            p.alpha_composite(actor, (AX - 24, FEET - 45))
            c = cells[f]
            if anchor in ("target", "allTargets"):
                p.alpha_composite(c, (EX - size // 2, FEET + 8 - size))
            elif anchor in ("user", "allAllies"):
                p.alpha_composite(c, (AX - size // 2, FEET + 8 - size))
            elif anchor == "screen":
                p.alpha_composite(c, (PW // 2 - size // 2, PH // 2 - size // 2))
            else:  # projectile travelling from the actor's hand to the slime
                u = (j + 0.5) / 4
                x = round((AX - 14) * (1 - u) + (EX + 6) * u)
                y = round((FEET - 26) * (1 - u) + (FEET - 12) * u)
                p.alpha_composite(c, (x - size // 2, y - size // 2))
            ImageDraw.Draw(p).text((3, 2), f"{k} #{f}", fill=(200, 205, 230, 255), font=FONT)
            row.alpha_composite(p, (j * PW, 0))
        rows.append(row)
    im = Image.new("RGBA", (PW * 4, PH * len(rows)), (0, 0, 0, 255))
    for i, r in enumerate(rows):
        im.alpha_composite(r, (0, i * PH))
    im = im.resize((im.width * 2, im.height * 2), Image.NEAREST)
    out = REVIEW / f"{cls}-composite.png"
    im.save(out)
    return out


def radial(c, cx, cy, r, n, rot=0.0, size=2, cols=("m", "l", "w"), sy=1.0, mode="max") -> None:
    """n twinkles evenly spaced on a (flattened) circle."""
    for k in range(n):
        a = math.radians(rot + k * 360 / n)
        c.spark(cx + math.cos(a) * r, cy + math.sin(a) * r * sy, size, cols, mode)


def rays(c, cx, cy, n, r0, r1, w, rot=0.0, cols=("m", "l", "w"), dither=None) -> None:
    """n light spikes pointing outward, shaded rim -> core."""
    m = c.empty()
    for k in range(n):
        m |= c.ray(cx, cy, rot + k * 360 / n, r0, r1, w)
    if dither is not None:
        m = c.dith(m, dither)
    c.ramp(m, cols)


def shock(c, cx, cy, rx, ry, w, cols, dither=None) -> None:
    """Expanding shock ring; dither=phase breaks it into a checker for the fading act."""
    m = c.ring(cx, cy, rx, ry, w)
    if dither is not None:
        m = c.dith(dilate(m), dither)
        c.put(m, cols[min(1, len(cols) - 1)])
        return
    c.ramp(m, cols)


def debris(c, seed, n, cx, cy, t, speed=(10, 24), ang=(0, 360), grav=0.0, size=1, cols=("m", "l", "w"), mode="max", rock=False, drag=0.9) -> None:
    """Deterministic particles (same seed -> same particle every frame).
    Travel = v*t/(1+drag*t) so sparks decelerate and linger in the cell; gravity adds grav*t^2."""
    r = random.Random(seed)
    s_t = t / (1 + drag * t)
    for _ in range(n):
        a = math.radians(r.uniform(*ang))
        v = r.uniform(*speed)
        s = size if r.random() < 0.6 else max(0, size - 1)
        rot = r.uniform(0, 90)
        x = cx + math.cos(a) * v * s_t
        y = cy + math.sin(a) * v * s_t + grav * t * t
        if rock:
            c.rock(x, y, s + 1, rot + t * 120, cols, mode)
        else:
            c.spark(x, y, s, cols, mode)


HERO = ["hero_cross", "hero_pierce", "hero_dust", "hero_rising", "hero_flame_aura", "hero_flame_slash", "hero_whirl",
        "hero_warcry", "hero_meteor_trail", "hero_meteor_impact", "hero_brave_sword", "hero_brave_burst"]
GUARDIAN = ["guard_bash", "guard_taunt", "guard_barrier", "guard_counter", "guard_charge", "guard_holy_shield", "guard_quake",
            "guard_quake_ring", "guard_fortress_wall", "guard_fortress_slam"]
HERE_KEYS = HERO + GUARDIAN


def run(keys) -> None:
    """Build + review the given sheet keys, then refresh the class sheet/composite they belong to."""
    sys.path.insert(0, str(HERE))
    REVIEW.mkdir(parents=True, exist_ok=True)
    spec = contract()
    keys = [k for k in HERE_KEYS if k in set(keys)]
    for key in keys:
        mod = importlib.import_module(key)
        build(key, mod.SIZE, mod.FRAMES, mod.PAL, mod.draw)
        preview(key)
        gif(key)
    for cls, group in (("class_hero", HERO), ("class_guardian", GUARDIAN)):
        if set(keys) & set(group) and all((OUT / f"{k}.png").exists() for k in group):
            class_sheet(cls, group)
            composite(cls, group, spec)


if __name__ == "__main__":
    run(sys.argv[1:] or HERE_KEYS)

