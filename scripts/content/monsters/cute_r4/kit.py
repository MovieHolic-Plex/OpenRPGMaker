"""Shape-based hand-pixel kit for 64x64 monster battle sprites (2026-10-20, 눈 판정 불합격 14종 전면 재작성).

A species is written as an ordered list of parts. Each part is a boolean mask built from primitives
(ellipse, polygon, capsule chain) with a 3-4 tone ramp. `render` does, in order:
  1. flat fill per visible part, a lower-right shade band and an optional upper-left light spot
  2. internal separation lines: a part with `sep=True` puts a 1px line on the lower parts it overlaps
  3. a 1px outer outline (4-neighbour, so corners stay open like hand-drawn sprites)
Then the species code stamps faces (eyes, mouth) and small details pixel by pixel.

No image generation, no tracing, no bitmap scaling — every pixel comes from the shapes and stamps written here.
Back views reuse the same geometry through `View`: mirrored (the creature faces away, up-right) and scaled a
little about the bottom centre (backs are drawn bigger, BODY_SIZE back 50 vs front 46).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Iterable, Sequence

import numpy as np
from PIL import Image, ImageDraw

N = 64
_YY, _XX = np.mgrid[0:N, 0:N]
PX = _XX + 0.5
PY = _YY + 0.5

Rgb = tuple[int, int, int]


def hexc(s: str) -> Rgb:
    s = s.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))


class View:
    """front = as written (faces left). back = mirrored about x=32 and scaled by `scale` about (32, 64)."""

    def __init__(self, side: str, scale: float = 1.0, dx: float = 0.0, dy: float = 0.0):
        self.side = side
        self.back = side == "back"
        self.s = scale
        self.dx = dx
        self.dy = dy

    def x(self, x: float) -> float:
        x = 32 + (x - 32) * self.s
        return (64 - x if self.back else x) + self.dx

    def y(self, y: float) -> float:
        return 64 + (y - 64) * self.s + self.dy

    def p(self, x: float, y: float) -> tuple[float, float]:
        return (self.x(x), self.y(y))

    def r(self, v: float) -> float:
        return v * self.s

    def ix(self, x: float) -> int:
        """Pixel column for a stamp written in front-view coordinates (front only)."""
        return int(round(self.x(x)))

    def iy(self, y: float) -> int:
        return int(round(self.y(y)))

    def ang(self, a: float) -> float:
        """Rotation angle in degrees (mirror flips its sign)."""
        return -a if self.back else a


# ── primitives (all take already-transformed canvas coordinates) ─────────────

def ellipse(cx: float, cy: float, rx: float, ry: float, ang: float = 0.0) -> np.ndarray:
    a = math.radians(ang)
    dx, dy = PX - cx, PY - cy
    u = dx * math.cos(a) + dy * math.sin(a)
    v = -dx * math.sin(a) + dy * math.cos(a)
    return (u / max(rx, 0.1)) ** 2 + (v / max(ry, 0.1)) ** 2 <= 1.0


def poly(pts: Sequence[tuple[float, float]]) -> np.ndarray:
    """Polygon by pixel-centre test (supersampled 4x then majority) so thin shapes stay stable."""
    S = 4
    im = Image.new("L", (N * S, N * S), 0)
    ImageDraw.Draw(im).polygon([(x * S, y * S) for x, y in pts], fill=255)
    a = np.asarray(im, dtype=np.uint16).reshape(N, S, N, S).mean(axis=(1, 3))
    return a >= 128


def capsule(a: tuple[float, float], b: tuple[float, float], ra: float, rb: float) -> np.ndarray:
    ax, ay = a
    bx, by = b
    vx, vy = bx - ax, by - ay
    L2 = vx * vx + vy * vy
    if L2 == 0:
        return (PX - ax) ** 2 + (PY - ay) ** 2 <= ra * ra
    t = np.clip(((PX - ax) * vx + (PY - ay) * vy) / L2, 0, 1)
    qx, qy = ax + t * vx, ay + t * vy
    r = ra + (rb - ra) * t
    return (PX - qx) ** 2 + (PY - qy) ** 2 <= r * r


def chain(pts: Sequence[tuple[float, float]], radii: Sequence[float]) -> np.ndarray:
    m = np.zeros((N, N), bool)
    for i in range(len(pts) - 1):
        m |= capsule(pts[i], pts[i + 1], radii[i], radii[i + 1])
    return m


def bez(p0, p1, p2, n: int = 10) -> list[tuple[float, float]]:
    out = []
    for i in range(n + 1):
        t = i / n
        out.append(((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]))
    return out


def shifted(m: np.ndarray, dx: int, dy: int) -> np.ndarray:
    """out[y, x] = m[y + dy, x + dx] (False off canvas)."""
    out = np.zeros_like(m)
    ys = slice(max(0, -dy), min(N, N - dy))
    xs = slice(max(0, -dx), min(N, N - dx))
    yd = slice(max(0, dy), min(N, N + dy))
    xd = slice(max(0, dx), min(N, N + dx))
    out[ys, xs] = m[yd, xd]
    return out


def dilate4(m: np.ndarray) -> np.ndarray:
    return m | shifted(m, 1, 0) | shifted(m, -1, 0) | shifted(m, 0, 1) | shifted(m, 0, -1)


# ── parts and rendering ──────────────────────────────────────────────────────

@dataclass
class Part:
    name: str
    mask: np.ndarray
    ramp: Sequence[str]  # (light, base, shade[, deep]) hex
    sep: bool | str = True  # line on lower parts where this part overlaps them: True all sides, 'sides' left/right only, 'below' not above
    line: str | None = None  # line colour (default: sprite outline)
    shade: Sequence[tuple[int, int]] = ((2, 2), (0, 3))  # neighbour offsets; missing neighbour => shade
    deep: Sequence[tuple[int, int]] = ()  # second, darker band (needs ramp[3])
    spot: tuple[float, float, float, float] | None = None  # light spot ellipse (cx, cy, rx, ry)
    rim: bool = False  # 1px light rim on the upper-left inner edge
    outline: bool = True  # contributes to the outer outline
    cast: bool = False  # cast a 1px shadow on lower parts just below the separation line


def render(parts: Sequence[Part], outline: str) -> np.ndarray:
    idm = np.full((N, N), -1, int)
    for k, p in enumerate(parts):
        idm[p.mask] = k
    out = np.zeros((N, N, 4), np.uint8)
    shade_map = np.zeros((N, N, 3), np.uint8)
    for k, p in enumerate(parts):
        vis = idm == k
        if not vis.any():
            continue
        m = p.mask
        ramp = [hexc(c) for c in p.ramp]
        light, base, shade = ramp[0], ramp[1], ramp[2]
        sh = np.zeros_like(m)
        for dx, dy in p.shade:
            sh |= ~shifted(m, dx, dy)
        dp = np.zeros_like(m)
        if p.deep and len(ramp) > 3:
            for dx, dy in p.deep:
                dp |= ~shifted(m, dx, dy)
        li = np.zeros_like(m)
        if p.spot is not None:
            li |= ellipse(*p.spot)
        if p.rim:
            li |= ~shifted(m, -1, -1) & shifted(m, 1, 1)
        li &= m & ~sh
        col = np.zeros((N, N, 3), np.uint8)
        col[:] = base
        col[li] = light
        col[sh] = shade
        if p.deep and len(ramp) > 3:
            col[dp & sh] = ramp[3]
        out[vis, :3] = col[vis]
        out[vis, 3] = 255
        shade_map[vis] = shade
    lines = np.zeros((N, N), bool)
    for k, p in enumerate(parts):
        if not p.sep:
            continue
        vis = idm == k
        if p.sep == "sides":
            grow = vis | shifted(vis, 1, 0) | shifted(vis, -1, 0)
        elif p.sep == "below":
            grow = vis | shifted(vis, 1, 0) | shifted(vis, -1, 0) | shifted(vis, 0, -1)
        elif p.sep == "down":
            grow = vis | shifted(vis, 0, -1)
        else:
            grow = dilate4(vis)
        adj = grow & ~vis & (idm >= 0) & (idm < k)
        out[adj, :3] = hexc(p.line or outline)
        lines |= adj
        if p.cast:
            cast = (shifted(vis, 0, -2) | shifted(vis, 1, -2)) & ~vis & ~adj & (idm >= 0) & (idm < k) & ~lines
            out[cast, :3] = shade_map[cast]
    render.lines = lines
    render.idm = idm
    render.names = [p.name for p in parts]
    op = idm >= 0
    rim = dilate4(op) & ~op
    out[rim, :3] = hexc(outline)
    out[rim, 3] = 255
    return out


# ── stamps ───────────────────────────────────────────────────────────────────

def stamp(arr: np.ndarray, x0: int, y0: int, rows: Iterable[str], cmap: dict[str, str]) -> None:
    """Paint character rows at (x0, y0). '.' keeps the pixel, '_' clears it, other keys map to hex colours."""
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch == ".":
                continue
            x, y = x0 + dx, y0 + dy
            if not (0 <= x < N and 0 <= y < N):
                continue
            if ch == "_":
                arr[y, x] = 0
            else:
                arr[y, x, :3] = hexc(cmap[ch])
                arr[y, x, 3] = 255


def px(arr: np.ndarray, x: int, y: int, color: str) -> None:
    if 0 <= x < N and 0 <= y < N:
        arr[y, x, :3] = hexc(color)
        arr[y, x, 3] = 255


# Eye templates. D pupil/rim, W white catchlight, I iris, H iris light. Top-left pixel of the near box stays skin
# (round template, eyeTable V7), the box is fully inside the face (V1) and nothing dark touches it (V2/V5).
NEAR_EYE_5x7 = [
    ".DDD.",
    "DWWDD",
    "DWWDD",
    "DDDDD",
    "DIIDD",
    "DIHID",
    ".DDD.",
]
NEAR_EYE_5x6 = [
    ".DDD.",
    "DWWDD",
    "DWWDD",
    "DDIID",
    "DIHID",
    ".DDD.",
]
NEAR_EYE_6x7 = [
    ".DDDD.",
    "DWWDDD",
    "DWWDDD",
    "DDDDDD",
    "DDIIID",
    "DIIHID",
    ".DDDD.",
]
NEAR_EYE_6x8 = [
    ".DDDD.",
    "DWWPPD",
    "DWWPPD",
    "DPPPPD",
    "DIPPID",
    "DIIIID",
    "DIIHID",
    ".DDDD.",
]
NEAR_EYE_5x7B = [
    ".DDD.",
    "DWWPD",
    "DWWPD",
    "DPPPD",
    "DIPID",
    "DIHID",
    ".DDD.",
]
FAR_EYE_3x7 = [
    ".D.",
    "DWD",
    "DWD",
    "DPD",
    "DID",
    "DID",
    ".D.",
]
FAR_EYE_3x6B = [
    ".D.",
    "DWD",
    "DWD",
    "DPD",
    "DID",
    ".D.",
]
FAR_EYE_3x6 = [
    ".DD",
    "DWD",
    "DWD",
    "DDD",
    "DID",
    ".D.",
]
FAR_EYE_3x5 = [
    ".D.",
    "DWD",
    "DWD",
    "DID",
    ".D.",
]
FAR_EYE_2x5 = [
    "DD",
    "WD",
    "WD",
    "DI",
    "DD",
]


def eye(arr: np.ndarray, x0: int, y0: int, rows: Sequence[str], pupil: str, iris: str, iris_hi: str, white: str = "#fbfbfb", rim: str | None = None) -> list[int]:
    """D = rim (defaults to pupil), P = pupil, W = catchlight, I = iris, H = iris light."""
    stamp(arr, x0, y0, rows, {"D": rim or pupil, "P": pupil, "W": white, "I": iris, "H": iris_hi})
    return [x0, y0, len(rows[0]), len(rows)]


def mirror_rows(rows: Sequence[str]) -> list[str]:
    return [r[::-1] for r in rows]


def save(arr: np.ndarray, path) -> None:
    Image.fromarray(arr, "RGBA").save(path, optimize=True)


def colours(arr: np.ndarray) -> int:
    m = arr[:, :, 3] > 0
    return len({tuple(c) for c in arr[m][:, :3].tolist()})


def ink_box(arr: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.nonzero(arr[:, :, 3] > 0)
    return int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)


def bottom_align(arr: np.ndarray) -> np.ndarray:
    """Shift so the lowest ink row is y=63 and the ink is horizontally centred-ish (keeps x)."""
    ys, xs = np.nonzero(arr[:, :, 3] > 0)
    dy = 63 - int(ys.max())
    out = np.zeros_like(arr)
    if dy >= 0:
        out[dy:, :] = arr[: N - dy, :]
    else:
        out[: N + dy, :] = arr[-dy:, :]
    return out


def voronoi_cracks(mask: np.ndarray, seeds, width: float = 0.9) -> np.ndarray:
    """Crack lines between plates: pixels whose two nearest seeds are almost equally far (inside mask)."""
    d = np.stack([np.hypot(PX - sx, PY - sy) for sx, sy in seeds])
    d.sort(axis=0)
    return mask & ((d[1] - d[0]) < width)


def inner(mask: np.ndarray, k: int = 1) -> np.ndarray:
    """mask eroded by k (4-neighbour)."""
    m = mask.copy()
    for _ in range(k):
        m = m & shifted(m, 1, 0) & shifted(m, -1, 0) & shifted(m, 0, 1) & shifted(m, 0, -1)
    return m


def visible(name: str) -> np.ndarray:
    """Pixels where part `name` won the last render, minus separation lines drawn over it."""
    k = render.names.index(name)
    return (render.idm == k) & ~render.lines


def paint(arr: np.ndarray, mask: np.ndarray, color: str, on: Sequence[str]) -> None:
    """Paint `mask` restricted to the visible fill of parts `on` (never over outline or separation lines)."""
    vis = np.zeros(arr.shape[:2], bool)
    for n in on:
        vis |= visible(n)
    m = mask & vis
    arr[m, :3] = hexc(color)
    arr[m, 3] = 255


def band(p0, p1, w: float) -> np.ndarray:
    """A straight stripe of width w between two points (capsule with flat look)."""
    return capsule(p0, p1, w / 2, w / 2)


def leaf(base: tuple[float, float], tip: tuple[float, float], width: float, bend: float = 0.0, fat: float = 0.45, n: int = 14) -> np.ndarray:
    """Lens/leaf shape from base to tip. `bend` curves the midline sideways (fraction of length), `fat` = where it is widest (0..1)."""
    bx, by = base
    tx, ty = tip
    L = math.hypot(tx - bx, ty - by)
    ux, uy = (tx - bx) / L, (ty - by) / L
    nx, ny = -uy, ux
    left, right = [], []
    for i in range(n + 1):
        t = i / n
        # width profile: rises to max at `fat`, then tapers to a point
        w = width / 2 * (math.sin(math.pi * (t / fat) / 2) if t < fat else math.cos(math.pi * ((t - fat) / (1 - fat)) / 2))
        off = bend * L * math.sin(math.pi * t)
        cx, cy = bx + ux * L * t + nx * off, by + uy * L * t + ny * off
        left.append((cx + nx * w, cy + ny * w))
        right.append((cx - nx * w, cy - ny * w))
    return poly(left + right[::-1])


def midline(base: tuple[float, float], tip: tuple[float, float], bend: float = 0.0, t0: float = 0.1, t1: float = 0.85, n: int = 30) -> list[tuple[int, int]]:
    """Pixels along a leaf midline (for a vein)."""
    bx, by = base
    tx, ty = tip
    L = math.hypot(tx - bx, ty - by)
    ux, uy = (tx - bx) / L, (ty - by) / L
    nx, ny = -uy, ux
    out = []
    for i in range(n + 1):
        t = t0 + (t1 - t0) * i / n
        off = bend * L * math.sin(math.pi * t)
        p = (int(math.floor(bx + ux * L * t + nx * off)), int(math.floor(by + uy * L * t + ny * off)))
        if p not in out:
            out.append(p)
    return out


def paw(E, R, x: float, top: float, w: float, ground: float = 60.4, toe: float = -0.8):
    """Short sturdy leg (slightly tapered) ending in a rounded paw planted on the ground line; toe<0 points left (front view)."""
    return capsule(E(x, top), E(x + toe * 0.3, ground - 0.6), R(w / 2), R(w / 2 - 0.35)) | ellipse(*E(x + toe, ground + 0.6), R(w / 2 + 0.9), R(1.9))


def flame_shape(E, R, cx, base, h, w):
    """Teardrop flame with a curled tip leaning right."""
    return (ellipse(*E(cx, base - h * 0.32), R(w / 2), R(h * 0.34))
            | poly([E(cx - w / 2 + 0.3, base - h * 0.36), E(cx - w * 0.1, base - h * 0.8), E(cx + w * 0.18, base - h), E(cx + w * 0.2, base - h * 0.7), E(cx + w / 2 - 0.2, base - h * 0.4)]))


# ── signed-distance shapes (organic joins) ───────────────────────────────────

def sd_ellipse(cx: float, cy: float, rx: float, ry: float, ang: float = 0.0) -> np.ndarray:
    a = math.radians(ang)
    dx, dy = PX - cx, PY - cy
    u = dx * math.cos(a) + dy * math.sin(a)
    v = -dx * math.sin(a) + dy * math.cos(a)
    k = np.hypot(u / rx, v / ry)
    return (k - 1.0) * min(rx, ry)


def sd_capsule(a, b, ra: float, rb: float) -> np.ndarray:
    ax, ay = a
    bx, by = b
    vx, vy = bx - ax, by - ay
    L2 = max(vx * vx + vy * vy, 1e-6)
    t = np.clip(((PX - ax) * vx + (PY - ay) * vy) / L2, 0, 1)
    return np.hypot(PX - (ax + t * vx), PY - (ay + t * vy)) - (ra + (rb - ra) * t)


def sd_chain(pts, radii) -> np.ndarray:
    d = np.full((N, N), 1e9)
    for i in range(len(pts) - 1):
        d = np.minimum(d, sd_capsule(pts[i], pts[i + 1], radii[i], radii[i + 1]))
    return d


def sd_poly(pts) -> np.ndarray:
    inside = poly(pts)
    d = np.full((N, N), 1e9)
    n = len(pts)
    for i in range(n):
        d = np.minimum(d, sd_capsule(pts[i], pts[(i + 1) % n], 0, 0))
    return np.where(inside, -d, d)


def smin(a: np.ndarray, b: np.ndarray, k: float = 2.0) -> np.ndarray:
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)


def blob(*sds: np.ndarray, k: float = 2.0) -> np.ndarray:
    """Smooth union of signed-distance shapes -> mask (soft organic joins instead of hard circle seams)."""
    d = sds[0]
    for s in sds[1:]:
        d = smin(d, s, k)
    return d < 0


def leg2(E, R, top: tuple[float, float], knee: tuple[float, float], foot: tuple[float, float], w_top: float, w_low: float, paw_w: float, paw_h: float = 1.9, toe: float = -0.8) -> np.ndarray:
    """Tapered leg (hip/shoulder -> knee -> ankle) blended into a rounded paw; coordinates are front-view."""
    d = sd_chain([E(*top), E(*knee), E(*foot)], [R(w_top / 2), R(w_low / 2 + 0.2), R(w_low / 2)])
    d = smin(d, sd_ellipse(*E(foot[0] + toe, foot[1] + 0.8), R(paw_w / 2), R(paw_h)), 1.2)
    return d < 0


def visible_lines() -> np.ndarray:
    return render.lines


# sleepy eyes (dozemite line): a lilac lid row over the top, flat lash line, catchlight below it
NEAR_EYE_SLEEPY_6x7 = [
    ".LLLL.",
    "DDDDDD",
    "DWWPPD",
    "DWPPPD",
    "DIPPID",
    "DIIHID",
    ".DDDD.",
]
FAR_EYE_SLEEPY_3x6 = [
    ".L.",
    "DDD",
    "DWD",
    "DPD",
    "DID",
    ".D.",
]


def eye_lid(arr, x0, y0, rows, pupil, iris, iris_hi, lid, rim=None, white="#fbfbfb"):
    stamp(arr, x0, y0, rows, {"D": rim or pupil, "P": pupil, "W": white, "I": iris, "H": iris_hi, "L": lid})
    return [x0, y0, len(rows[0]), len(rows)]

NEAR_EYE_SLEEPY_7x8 = [
    ".LLLLL.",
    "LDDDDDL",
    "DWWPPPD",
    "DWPPPPD",
    "DPPPPPD",
    "DIPPPID",
    "DIIHIID",
    ".DDDDD.",
]
FAR_EYE_SLEEPY_3x7 = [
    ".L.",
    "DDD",
    "DWD",
    "DPD",
    "DPD",
    "DID",
    ".D.",
]


def sickle(E, R, elbow, tip, width, bend):
    """A curved mantis scythe: thick at the elbow, sweeping to a sharp point."""
    from .kit import leaf as _leaf
    return _leaf(E(*elbow), E(*tip), R(width), bend=bend, fat=0.28)


def despeckle(arr: np.ndarray) -> np.ndarray:
    """Remove stray single outline-colour pixels inside the body (no outline-colour pixel among the 8 neighbours).

    The outline colour is the most common colour on the silhouette edge. Mouth corners and eye rims always touch
    another dark pixel diagonally, so they stay."""
    a = arr.copy()
    op = a[:, :, 3] > 0
    edge = op & ~(shifted(op, 1, 0) & shifted(op, -1, 0) & shifted(op, 0, 1) & shifted(op, 0, -1))
    cols, counts = np.unique(a[edge][:, :3], axis=0, return_counts=True)
    ol = cols[counts.argmax()]
    is_ol = op & np.all(a[:, :, :3] == ol, axis=2)
    for y in range(1, N - 1):
        for x in range(1, N - 1):
            if not is_ol[y, x] or edge[y, x]:
                continue
            nb = is_ol[y - 1:y + 2, x - 1:x + 2].sum() - 1
            if nb:
                continue
            from collections import Counter
            c = Counter(tuple(a[y + dy, x + dx, :3]) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if op[y + dy, x + dx])
            a[y, x, :3] = c.most_common(1)[0][0]
    return a

# half-closed sleepy eyes: the upper rows are eyelid (skin), a lash line, then the lower half of the eye
NEAR_EYE_DROWSY_7x8 = [
    ".LLLLL.",
    "LLLLLLL",
    "DDDDDDD",
    "DWWPPPD",
    "DWPPPPD",
    "DIPPPID",
    "DIIHIID",
    ".DDDDD.",
]
FAR_EYE_DROWSY_3x7 = [
    ".L.",
    "LLL",
    "DDD",
    "DWD",
    "DPD",
    "DID",
    ".D.",
]
