#!/usr/bin/env python3
"""Beodeul (버들항) 16px chipset - two new broadleaf trees, code hand-pixel art.

    python3 draw_trees_a.py   ->  oakA.png (64x80), oakB.png (48x64)

Design method (no tracing, no generated images):
  * A crown is a list of hand-placed leaf clumps (ellipses with scalloped,
    leafy edges).  Clumps are painted back (top) to front (bottom).
  * Behind the clumps sits a dark "crown body"; wherever no clump covers it,
    it shows as a deep gap and a few branches are drawn across it.
  * Each clump is lit from the upper left: light top-left, dark bottom-right,
    with a dark seam where a front clump overlaps the clump behind it.
  * Leaf texture = fixed 2-3 px dabs that nudge the tone band up or down.
  * Silhouette edges: deep shade on the bottom/right, a one-step darker rim on
    the top/left, a few bright dabs on the upper-left clumps.
  * Trunk: 4 bark tones (light left -> dark right), 2 px shadow under the
    crown, root flare with the root tone and a little moss at the base.
All leaves use the oak ramp by index (0 = darkest .. 5 = brightest), so
variants can be made later by swapping the ramp.
"""
import json
import math
import os
import random

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PAL = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'palette.json')))
LEAF = [tuple(c) for c in PAL['leaf_ramps']['oak']]      # dark -> light
BARK = [tuple(c) for c in PAL['trunk']]                   # light -> dark
ROOT = tuple(PAL['root'])
MOSS = [tuple(c) for c in PAL['moss']]                    # light, dark
DEEP = tuple(PAL['deep_shade'])

LX, LY = -0.62, -0.78       # light direction (upper left), normalised-ish


class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = [[None] * w for _ in range(h)]

    def put(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = c

    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.px[y][x]
        return None

    def save(self, path):
        a = np.zeros((self.h, self.w, 4), np.uint8)
        for y in range(self.h):
            for x in range(self.w):
                c = self.px[y][x]
                if c is not None:
                    a[y, x] = (*c, 255)
        Image.fromarray(a, 'RGBA').save(path)


# ---------------------------------------------------------------- trunk ----
def draw_trunk(cv, top, base_y, cx, half_top, half_base, lean=0.0, seed=0):
    """Tapered trunk from y=top to y=base_y, flaring into roots at the base."""
    rnd = random.Random(seed)
    streaks = {rnd.randrange(-3, 4) for _ in range(3)}
    for y in range(top, base_y + 1):
        t = (y - top) / max(1, base_y - top)
        flare = max(0.0, (t - 0.72) / 0.28) ** 2
        half = half_top + (half_base - half_top) * flare
        mid = cx + lean * (base_y - y)
        x0, x1 = int(round(mid - half)), int(round(mid + half))
        w = max(1, x1 - x0)
        for x in range(x0, x1 + 1):
            u = (x - x0) / w                          # 0 left .. 1 right
            k = 0 if u < 0.2 else 1 if u < 0.5 else 2 if u < 0.8 else 3
            if x == x1:
                k = 3
            # vertical bark grooves
            if (x - int(round(mid))) in streaks and 0 < u < 0.85 and (y * 7 + x) % 11:
                k = min(3, k + 1)
            cv.put(x, y, BARK[k])
        # root flare: outer pixels of the base rows use the root tone
        if flare > 0.25:
            cv.put(x0, y, ROOT)
            cv.put(x1, y, BARK[3])
            if flare > 0.6:
                cv.put(x0 + 1, y, ROOT if (y % 2) else BARK[1])


def draw_root(cv, x, y, dx, length, tone=ROOT):
    """A surface root running sideways from the trunk base, 1-2 px thick."""
    for i in range(length):
        xx = x + dx * i
        yy = y + (1 if i > length * 0.55 else 0)
        cv.put(xx, yy, tone)
        if i < length - 2:
            cv.put(xx, yy - 1, BARK[1] if dx < 0 else BARK[2])
    cv.put(x + dx * length, y + 1, BARK[3])


def moss(cv, pts):
    for (x, y, k) in pts:
        cv.put(x, y, MOSS[k])


def branch(cv, pts, tone_hi=1, tone_lo=2):
    """Poly-line branch, 1 px with a darker underside pixel."""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            x = round(x0 + (x1 - x0) * i / n)
            y = round(y0 + (y1 - y0) * i / n)
            cv.put(x, y, BARK[tone_hi])
            cv.put(x, y + 1, BARK[tone_lo + 1])


# ---------------------------------------------------------------- crown ----
class Clump:
    def __init__(self, cx, cy, rx, ry, lobes=None, phase=0.0, amp=None,
                 top=False, bias=0.0, group=None):
        self.cx, self.cy, self.rx, self.ry = cx, cy, rx, ry
        r = (rx + ry) / 2
        # one leaf tuft roughly every 5 px of edge, bumps about 1.5 px deep
        self.lobes = lobes or max(5, int(round(2 * math.pi * r / 5)))
        self.amp = amp if amp is not None else min(0.28, 1.5 / r)
        self.phase, self.top, self.bias = phase, top, bias
        self.group = group      # clumps of one group are lit as a single mass

    def inside(self, x, y):
        u = (x + 0.5 - self.cx) / self.rx
        v = (y + 0.5 - self.cy) / self.ry
        th = math.atan2(v, u)
        r = 1.0 + self.amp * math.sin(self.lobes * th + self.phase)
        return u * u + v * v <= r * r

    def light(self, x, y):
        u = (x + 0.5 - self.cx) / self.rx
        v = (y + 0.5 - self.cy) / self.ry
        d = min(1.0, u * u + v * v)
        z = math.sqrt(1.0 - d)
        return 0.48 + 0.52 * (LX * u + LY * v) + 0.12 * z + self.bias


def dab_field(w, h, seed):
    """Small 2-3 px leaf dabs: each dab shifts the tone by +/- one band step."""
    rnd = random.Random(seed)
    f = np.zeros((h, w))
    shapes = [[(0, 0), (1, 0)], [(0, 0), (1, 0), (0, 1)], [(0, 0), (1, 0), (1, 1)],
              [(0, 0), (0, 1), (1, 1)], [(0, 0), (1, 0), (2, 0), (1, 1)]]
    for gy in range(0, h, 3):
        for gx in range((gy // 3) % 2 * 2, w, 4):
            x, y = gx + rnd.randrange(0, 2), gy + rnd.randrange(0, 2)
            s = rnd.choice((-1, 1, 1))
            for (dx, dy) in rnd.choice(shapes):
                if 0 <= x + dx < w and 0 <= y + dy < h:
                    f[y + dy, x + dx] = s * 0.21
    return f


def paint_crown(cv, clumps, body, seed, hilite_max=10, holes=()):
    w, h = cv.w, cv.h
    owner = -np.ones((h, w), int)
    for i, c in enumerate(clumps):
        x0, x1 = int(c.cx - c.rx * 1.3) - 1, int(c.cx + c.rx * 1.3) + 2
        y0, y1 = int(c.cy - c.ry * 1.3) - 1, int(c.cy + c.ry * 1.3) + 2
        for y in range(max(0, y0), min(h, y1)):
            for x in range(max(0, x0), min(w, x1)):
                if c.inside(x, y):
                    owner[y, x] = i
    # dark crown body behind the clumps (shows as gaps)
    bodym = np.zeros((h, w), bool)
    for (cx, cy, rx, ry) in body:
        for y in range(h):
            for x in range(w):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1:
                    bodym[y, x] = True
    # see-through holes: open sky between the boughs
    for (cx, cy, rx, ry) in holes:
        for y in range(h):
            for x in range(w):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1:
                    owner[y, x] = -1
                    bodym[y, x] = False
    # drop lone leaf pixels (no 4-neighbour in the same clump) - no noise
    for _ in range(2):
        for y in range(h):
            for x in range(w):
                i = owner[y, x]
                if i < 0:
                    continue
                n = sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                        if 0 <= x + dx < w and 0 <= y + dy < h and owner[y + dy, x + dx] >= 0)
                if n <= 1 and not bodym[y, x]:
                    owner[y, x] = -1
    gaps = bodym & (owner < 0)
    for y, x in zip(*np.nonzero(gaps)):
        if cv.get(x, y) in BARK:          # branch already drawn there: keep it
            continue
        cv.put(x, y, DEEP if (x + y) % 3 else LEAF[0])

    # clumps sharing a group are lit as one mass (its bounding ellipse)
    gid = [c.group if c.group is not None else ('c', i) for i, c in enumerate(clumps)]
    light_of = list(clumps)
    for g in set(gid):
        mem = [c for c, k in zip(clumps, gid) if k == g]
        if len(mem) > 1:
            x0 = min(c.cx - c.rx for c in mem); x1 = max(c.cx + c.rx for c in mem)
            y0 = min(c.cy - c.ry for c in mem); y1 = max(c.cy + c.ry for c in mem)
            m = Clump((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2,
                      bias=sum(c.bias for c in mem) / len(mem))
            for i, k in enumerate(gid):
                if k == g:
                    light_of[i] = m
    dab = dab_field(w, h, seed)
    tone = -np.ones((h, w), int)
    for y in range(h):
        for x in range(w):
            i = owner[y, x]
            if i < 0:
                continue
            t = light_of[i].light(x, y) + dab[y, x]
            k = 1 if t < 0.24 else 2 if t < 0.46 else 3 if t < 0.70 else 4
            # seam: this clump is overlapped just below/right by a front clump
            for (dx, dy) in ((0, 1), (1, 1), (0, 2)):
                j = owner[y + dy, x + dx] if 0 <= y + dy < h and 0 <= x + dx < w else -1
                if j > i and gid[j] != gid[i]:
                    k = (0 if dx == 0 else 1) if dy == 1 else min(k, 2)
                    break
                if j > i and dy == 1 and dx == 0:
                    k = max(1, k - 1)     # softer seam inside one mass
                    break
            tone[y, x] = k
    # silhouette rim
    solid = (owner >= 0) | bodym
    for y in range(h):
        for x in range(w):
            if tone[y, x] < 0:
                continue
            def out(dx, dy):
                xx, yy = x + dx, y + dy
                return not (0 <= xx < w and 0 <= yy < h) or not solid[yy, xx]
            if out(1, 0) or out(0, 1) or out(1, 1):
                tone[y, x] = 0
            elif out(-1, 0) or out(0, -1):
                tone[y, x] = max(1, min(tone[y, x], 3) - 1)
    # highlight dabs on the upper-left of the top clumps
    rnd = random.Random(seed + 7)
    placed = 0
    for i, c in enumerate(clumps):
        if not c.top:
            continue
        for _ in range(4):
            if placed >= hilite_max:
                break
            ang = rnd.uniform(3.4, 4.3)
            x = int(c.cx + math.cos(ang) * c.rx * rnd.uniform(0.25, 0.55))
            y = int(c.cy + math.sin(ang) * c.ry * rnd.uniform(0.25, 0.55))
            pts = [(x, y), (x + 1, y)] + ([(x, y + 1)] if rnd.random() < 0.5 else [])
            if all(0 <= px < w and 0 <= py < h and owner[py, px] == i and tone[py, px] >= 3
                   for px, py in pts):
                for px, py in pts:
                    tone[py, px] = 5
                placed += 1
    for y in range(h):
        for x in range(w):
            if tone[y, x] >= 0:
                cv.put(x, y, LEAF[tone[y, x]])
    return owner, bodym


def trunk_shadow(cv, solid, x0, x1, rows=2):
    """2 px shadow on the trunk right under the crown's lower edge."""
    for x in range(x0, x1 + 1):
        ys = [y for y in range(cv.h) if solid[y, x]]
        if not ys:
            continue
        yb = max(ys)
        for d in range(1, rows + 1):
            c = cv.get(x, yb + d)
            if c in BARK or c == ROOT:
                cv.put(x, yb + d, BARK[3] if d == 1 else BARK[2])



# ------------------------------------------------- closed crown mass (v2) ----
def bump(x, y, cx, cy, r, lobes, phase, amp=0.0):
    u, v = x + 0.5 - cx, y + 0.5 - cy
    d = math.hypot(u, v)
    th = math.atan2(v, u)
    return d <= r * (1.0 + amp * math.sin(lobes * th + phase))


def scallop(m, limit=3):
    """Break every straight outline run longer than `limit` px: bite a
    1 px deep, 2 px long notch out of the middle of the run so each side
    reads as leaf scallops, never a ruled edge."""
    m = m.copy()
    h, w = m.shape
    for _ in range(12):
        changed = False
        for side in ('left', 'right', 'top', 'bottom'):
            mm = m if side in ('left', 'right') else m.T
            lines = [i for i in range(mm.shape[0]) if mm[i].any()]
            prof = [(np.nonzero(mm[i])[0].min() if side in ('left', 'top')
                     else np.nonzero(mm[i])[0].max()) for i in lines]
            j = 0
            while j < len(prof):
                k = j
                while k + 1 < len(prof) and prof[k + 1] == prof[j] and lines[k + 1] == lines[k] + 1:
                    k += 1
                n = k - j + 1
                if n > limit:
                    mid = j + n // 2 - (1 if n >= 5 else 0)
                    for t in ([mid, mid + 1] if n >= 5 else [mid]):
                        i, p = lines[t], prof[t]
                        if (mm[i] .sum()) > 2:
                            mm[i, p] = False
                    changed = True
                j = k + 1
        if not changed:
            break
    return m


def paint_mass(cv, clumps, core, seed, hilite=10, under=3):
    """One closed crown.  `core` = list of filled ellipses (cx,cy,rx,ry) that
    make the solid body; `clumps` = (cx,cy,r) leaf clusters, back to front.
    The silhouette is the union of both, holes filled, 1px spikes removed.
    Shading: whole-mass light from the upper left + per-clump dome, soft
    seams (one darker leaf tone) where a front clump overlaps a back one,
    an underside shadow band, darkest rim only on the bottom-right edge."""
    from scipy import ndimage
    w, h = cv.w, cv.h
    m = np.zeros((h, w), bool)
    owner = -np.ones((h, w), int)
    for (cx, cy, rx, ry) in core:
        for y in range(h):
            for x in range(w):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1:
                    m[y, x] = True
    rnd = random.Random(seed)
    phases = [rnd.uniform(0, 6.28) for _ in clumps]
    for i, (cx, cy, r) in enumerate(clumps):
        lobes = max(5, int(round(2 * math.pi * r / 5.5)))
        for y in range(h):
            for x in range(w):
                if bump(x, y, cx, cy, r, lobes, phases[i], min(0.2, 1.2 / r)):
                    m[y, x] = True
                    owner[y, x] = i
    m = ndimage.binary_fill_holes(m)
    # clean the outline: no 1px spikes, no 1px notches
    for _ in range(3):
        nb = ndimage.convolve(m.astype(int), np.array([[0, 1, 0], [1, 0, 1], [0, 1, 0]]), mode='constant')
        m = (m & (nb >= 2)) | (~m & (nb >= 3))
    m = ndimage.binary_fill_holes(m)
    m = scallop(m)
    # unowned interior -> nearest clump centre
    cs = np.array([(c[0], c[1]) for c in clumps])
    for y, x in zip(*np.nonzero(m & (owner < 0))):
        owner[y, x] = int(np.argmin((cs[:, 0] - x) ** 2 + (cs[:, 1] - y) ** 2))
    owner[~m] = -1
    ys, xs = np.nonzero(m)
    gx0, gx1, gy0, gy1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    gcx, gcy, grx, gry = (gx0 + gx1) / 2, (gy0 + gy1) / 2, (gx1 - gx0) / 2, (gy1 - gy0) / 2
    bottom = np.full(w, -1)
    for x in range(w):
        col = np.nonzero(m[:, x])[0]
        if len(col):
            bottom[x] = col.max()
    dab = dab_field(w, h, seed + 1)
    tone = -np.ones((h, w), int)
    for y, x in zip(ys, xs):
        i = owner[y, x]
        cx, cy, r = clumps[i]
        gu, gv = (x + .5 - gcx) / grx, (y + .5 - gcy) / gry
        lu, lv = (x + .5 - cx) / r, (y + .5 - cy) / r
        ld = min(1.0, lu * lu + lv * lv)
        t = (0.50 + 0.30 * (LX * gu + LY * gv)
             + 0.26 * (LX * lu + LY * lv) + 0.14 * math.sqrt(1 - ld) - 0.10
             + dab[y, x])
        k = 1 if t < 0.22 else 2 if t < 0.44 else 3 if t < 0.68 else 4
        # soft seam: a front clump starts just below / right of this pixel
        for dx, dy in ((0, 1), (1, 1), (0, 2)):
            yy, xx = y + dy, x + dx
            if yy < h and xx < w and owner[yy, xx] > i:
                k = max(1, min(k, 2) - (1 if dy == 1 and dx == 0 else 0))
                break
        # underside of the dome: shadow band along the lower edge
        if bottom[x] >= 0 and bottom[x] - y < under:
            k = min(k, 1 if bottom[x] - y < under - 1 else 2)
        tone[y, x] = k
    # rim: darkest tone only on the shadow side (bottom / right)
    for y, x in zip(ys, xs):
        def out(dx, dy):
            xx, yy = x + dx, y + dy
            return not (0 <= xx < w and 0 <= yy < h) or not m[yy, xx]
        gu, gv = (x + .5 - gcx) / grx, (y + .5 - gcy) / gry
        shadow_side = (0.6 * gu + 0.8 * gv) > 0.05
        # lit (top / left) edge: no outline at all - the relight adds the rim
        if not shadow_side:
            continue
        if out(1, 0) or out(0, 1) or out(1, 1):
            tone[y, x] = 0
        elif out(-1, 0) or out(0, -1):
            tone[y, x] = min(tone[y, x], 2)
    # sparkle: small bright dabs on the lit (upper-left) clump tops
    rnd = random.Random(seed + 7)
    placed = 0
    order = sorted(range(len(clumps)), key=lambda i: clumps[i][1] + 0.6 * clumps[i][0])
    for i in order:
        if placed >= hilite:
            break
        cx, cy, r = clumps[i]
        for _ in range(3):
            ang = rnd.uniform(3.5, 4.4)
            x = int(cx + math.cos(ang) * r * rnd.uniform(0.3, 0.55))
            y = int(cy + math.sin(ang) * r * rnd.uniform(0.3, 0.55))
            pts = [(x, y), (x + 1, y)] + ([(x, y + 1)] if rnd.random() < 0.5 else [])
            if all(0 <= px < w and 0 <= py < h and owner[py, px] == i and tone[py, px] >= 3
                   for px, py in pts):
                for px, py in pts:
                    tone[py, px] = 5
                placed += 1
                break
    for y, x in zip(ys, xs):
        cv.put(x, y, LEAF[tone[y, x]])
    return m




# ------------------------------------------------------- round 4 lobes ----
# Round 3 crowns were one dome built of many equal small clumps: in a forest
# row the same tree every 48 px gave a level crown top and one zigzag light
# band at the same height on every crown.  Round 4 builds each crown from a
# few BIG lobes at clearly different heights (notches between them), lights
# each lobe on its own, and adds a handful of explicit lit leaf clumps of
# different sizes plus small dark gaps with branch glimpses inside the crown.

def lobe_mask(w, h, cx, cy, rx, ry, phase, amp_px=1.1, per=5.0):
    r = (rx + ry) / 2
    n = max(5, int(round(2 * math.pi * r / per)))
    amp = min(0.22, amp_px / r)
    m = np.zeros((h, w), bool)
    for y in range(h):
        for x in range(w):
            u, v = (x + .5 - cx) / rx, (y + .5 - cy) / ry
            th = math.atan2(v, u)
            rr = 1.0 + amp * math.sin(n * th + phase) + 0.3 * amp * math.sin((n // 2 + 1) * th + 2 * phase)
            m[y, x] = u * u + v * v <= rr * rr
    return m


def paint_lobes(cv, lobes, lit, gaps, seed, branches=()):
    """lobes: (cx, cy, rx, ry, bias) back -> front.
    lit:   (cx, cy, r) lit leaf clumps (upper-left lit), any size.
    gaps:  (cx, cy, rx, ry) small dark holes inside the crown."""
    from scipy import ndimage
    w, h = cv.w, cv.h
    rnd = random.Random(seed)
    owner = -np.ones((h, w), int)
    for i, (cx, cy, rx, ry, _b) in enumerate(lobes):
        owner[lobe_mask(w, h, cx, cy, rx, ry, rnd.uniform(0, 6.28))] = i
    m = owner >= 0
    m = ndimage.binary_fill_holes(m)
    for _ in range(3):
        nb = ndimage.convolve(m.astype(int), np.array([[0, 1, 0], [1, 0, 1], [0, 1, 0]]), mode='constant')
        m = (m & (nb >= 2)) | (~m & (nb >= 3))
    m = ndimage.binary_fill_holes(m)
    m = scallop(m)
    cs = np.array([(l[0], l[1]) for l in lobes])
    for y, x in zip(*np.nonzero(m & (owner < 0))):
        owner[y, x] = int(np.argmin((cs[:, 0] - x) ** 2 + (cs[:, 1] - y) ** 2))
    owner[~m] = -1
    ys, xs = np.nonzero(m)
    gy0, gy1 = ys.min(), ys.max()
    dab = dab_field(w, h, seed + 1)
    tone = -np.ones((h, w), int)
    for y, x in zip(ys, xs):
        i = owner[y, x]
        cx, cy, rx, ry, bias = lobes[i]
        u, v = (x + .5 - cx) / rx, (y + .5 - cy) / ry
        d = min(1.0, u * u + v * v)
        t = (0.37 + 0.36 * (LX * u + LY * v) + 0.12 * math.sqrt(1 - d)
             + 0.10 * (1 - (y - gy0) / max(1, gy1 - gy0)) + bias + dab[y, x])
        k = 1 if t < 0.24 else 2 if t < 0.46 else 3 if t < 0.68 else 4
        if v > 0.62:                       # lobe underside
            k = min(k, 2)
        # shadow cast on this lobe by a front lobe just below / right
        for dx, dy, kk in ((0, 1, 1), (1, 1, 1), (0, 2, 2), (-1, 1, 2)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w and owner[yy, xx] > i:
                # broken seam: leaf dabs poke through so it never rules a line
                k = min(k, kk + (1 if dab[y, x] > 0 else 0))
                break
        tone[y, x] = k
    # explicit lit leaf clumps
    for j, (cx, cy, r) in enumerate(lit):
        lm = lobe_mask(w, h, cx, cy, r, r * 0.85, rnd.uniform(0, 6.28), amp_px=0.9, per=4.0)
        for y, x in zip(*np.nonzero(lm & m)):
            u, v = (x + .5 - cx) / r, (y + .5 - cy) / (r * 0.85)
            s = LX * u + LY * v
            if s > 0.3 and u * u + v * v < 0.4 and dab[y, x] >= 0 and (x + 2 * y) % 5:
                tone[y, x] = 5
            elif s > -0.15 and u * u + v * v < 0.65:
                tone[y, x] = max(tone[y, x], 4 if dab[y, x] >= 0 else 3)
            elif v > 0.45:
                tone[y, x] = min(tone[y, x], 2)
            else:
                tone[y, x] = max(tone[y, x], 3)
    # dark gaps inside the crown (deep shade, a branch glimpse drawn later)
    gapm = np.zeros((h, w), bool)
    for (cx, cy, rx, ry) in gaps:
        gm = lobe_mask(w, h, cx, cy, rx, ry, rnd.uniform(0, 6.28), amp_px=0.7, per=3.0)
        gapm |= gm & m
    er = ndimage.binary_erosion(m, iterations=2)
    gapm &= er
    for y, x in zip(*np.nonzero(gapm)):
        tone[y, x] = -2
    # gap rim: leaves just below a gap are in its shade
    for y, x in zip(*np.nonzero(gapm)):
        for dy in (1,):
            if y + dy < h and tone[y + dy, x] >= 0:
                tone[y + dy, x] = min(tone[y + dy, x], 1)
    # silhouette rim: dark only on the shadow (bottom / right) side
    gx0, gx1 = xs.min(), xs.max()
    gcx, gcy = (gx0 + gx1) / 2, (gy0 + gy1) / 2
    for y, x in zip(ys, xs):
        if tone[y, x] < 0:
            continue
        def out(dx, dy):
            xx, yy = x + dx, y + dy
            return not (0 <= xx < w and 0 <= yy < h) or not m[yy, xx]
        gu, gv = (x - gcx) / max(1, gx1 - gx0), (y - gcy) / max(1, gy1 - gy0)
        if 0.6 * gu + 0.8 * gv <= 0.02:
            continue
        if out(1, 0) or out(0, 1) or out(1, 1):
            tone[y, x] = 0
        elif out(-1, 0) or out(0, -1):
            tone[y, x] = min(tone[y, x], 2)
    for y, x in zip(ys, xs):
        if tone[y, x] == -2:
            cv.put(x, y, DEEP if (x * 3 + y) % 4 else LEAF[0])
        else:
            cv.put(x, y, LEAF[tone[y, x]])
    for pts in branches:
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            n = max(abs(x1 - x0), abs(y1 - y0), 1)
            for q in range(n + 1):
                x = round(x0 + (x1 - x0) * q / n)
                y = round(y0 + (y1 - y0) * q / n)
                if 0 <= x < w and 0 <= y < h and gapm[y, x]:
                    cv.put(x, y, BARK[1] if q < n * 0.6 else BARK[2])
                    if y + 1 < h and gapm[y + 1, x]:
                        cv.put(x, y + 1, BARK[3])
    return m


# ------------------------------------------------- round 5: leaf clusters ----
# Round 4 crowns were a few BIG lobes with long shadow seams: the shipped
# relight keeps the brightness rank, so those seams came out as horizontal
# zigzag tiers and the tall lobe stack read as a conifer.  Round 5: a broad,
# round macro outline (3-4 soft top bumps), filled with MANY small irregular
# leaf clumps (r 1.6-3 px) each with its own tiny lit top-left / dark
# bottom-right, so the rank map is a fine cluster texture over a whole-crown
# upper-left gradient.  Seams are only as long as one small clump.

def ell_mask(w, h, ells):
    m = np.zeros((h, w), bool)
    Y, X = np.mgrid[0:h, 0:w]
    for (cx, cy, rx, ry) in ells:
        m |= ((X + .5 - cx) / rx) ** 2 + ((Y + .5 - cy) / ry) ** 2 <= 1
    return m


def paint_clusters(cv, macro, seed, gaps=(), branches=(), spacing=3.3,
                   rmin=1.7, rmax=3.0, hilite=14, under=2, med_r=(4.5, 6.5)):
    """macro: list of (cx, cy, rx, ry) ellipses whose union is the crown shape.
    gaps: (cx, cy, rx, ry) small dark holes; branches: poly-lines drawn in gaps."""
    from scipy import ndimage
    w, h = cv.w, cv.h
    rnd = random.Random(seed)
    M = ell_mask(w, h, macro)
    Mi = ndimage.binary_erosion(M, iterations=1)
    ys, xs = np.nonzero(M)
    gx0, gx1, gy0, gy1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    gcx, gcy = (gx0 + gx1) / 2, (gy0 + gy1) / 2
    grx, gry = (gx1 - gx0) / 2, (gy1 - gy0) / 2

    def macro_light(x, y):
        gu, gv = (x - gcx) / grx, (y - gcy) / gry
        d = min(1.0, gu * gu + gv * gv)
        return 0.50 + 0.30 * (LX * gu + LY * gv) + 0.12 * math.sqrt(1 - d)

    # medium leaf clusters (r 4.5-6.5): they make the bumpy silhouette and the
    # mid-scale light (lit top-left cap, dark underside) of the old art
    D = ndimage.distance_transform_edt(M)
    meds = []
    yy = gy0 + 3.0
    row = 0
    while yy < gy1:
        xx = gx0 + 1.0 + (row % 2) * 3.8
        while xx < gx1:
            cx, cy = xx + rnd.uniform(-1.5, 1.5), yy + rnd.uniform(-1.5, 1.5)
            ix, iy = int(cx), int(cy)
            r = rnd.uniform(med_r[0], med_r[1])
            if 0 <= ix < w and 0 <= iy < h:
                r = min(r, D[iy, ix] / 0.75)
            if 0 <= ix < w and 0 <= iy < h and r >= 3.0:
                meds.append((cx, cy, r * rnd.uniform(1.0, 1.15), r * rnd.uniform(0.85, 1.0),
                             cy + 0.3 * cx + rnd.uniform(-2, 2), rnd.uniform(-0.08, 0.08)))
            xx += 7.6 * rnd.uniform(0.85, 1.15)
        yy += 6.6
        row += 1
    meds.sort(key=lambda m: m[4])
    mown = -np.ones((h, w), int)
    Y, X = np.mgrid[0:h, 0:w]
    for i, (cx, cy, rx, ry, _k, _b) in enumerate(meds):
        u = (X + .5 - cx) / rx; v = (Y + .5 - cy) / ry
        th = np.arctan2(v, u)
        rr = 1.0 + 0.12 * np.sin(5 * th + i * 1.7)
        mown[u * u + v * v <= rr * rr] = i
    shape = (mown >= 0) | ndimage.binary_erosion(M, iterations=4)
    Mi = ndimage.binary_erosion(shape, iterations=1)

    def med_light(x, y):
        ix, iy = int(x), int(y)
        if not (0 <= ix < w and 0 <= iy < h) or mown[iy, ix] < 0:
            return -0.1
        cx, cy, rx, ry, _k, b = meds[mown[iy, ix]]
        u, v = (x - cx) / rx, (y - cy) / ry
        return LX * u + LY * v + b - (0.6 if v > 0.55 else 0.0) * (v - 0.55) * 2

    # jittered grid of small clumps inside the crown shape
    clumps = []
    yy = gy0 - 3.0
    row = 0
    while yy < gy1 + 3:
        xx = gx0 - 3.0 + (row % 2) * spacing / 2
        while xx < gx1 + 3:
            cx = xx + rnd.uniform(-1.1, 1.1)
            cy = yy + rnd.uniform(-1.0, 1.0)
            ix, iy = int(cx), int(cy)
            if 0 <= ix < w and 0 <= iy < h and Mi[iy, ix]:
                r = rnd.uniform(rmin, rmax)
                clumps.append(dict(cx=cx, cy=cy, rx=r * rnd.uniform(1.0, 1.25),
                                   ry=r * rnd.uniform(0.8, 1.0),
                                   base=macro_light(cx, cy) + 0.3 * med_light(cx, cy) + rnd.uniform(-0.08, 0.08),
                                   key=cy + 0.35 * cx + rnd.uniform(-1.5, 1.5)))
            xx += spacing * rnd.uniform(0.85, 1.15)
        yy += spacing * 0.86
        row += 1
    clumps.sort(key=lambda c: c['key'])          # back (top-left) -> front
    owner = -np.ones((h, w), int)
    Y, X = np.mgrid[0:h, 0:w]
    for i, c in enumerate(clumps):
        u = (X + .5 - c['cx']) / c['rx']
        v = (Y + .5 - c['cy']) / c['ry']
        cm = u * u + v * v <= 1.0
        # nibble one corner pixel off some clumps so they are not perfect discs
        owner[cm] = i
    leaf = owner >= 0
    # keep the silhouette inside a slightly grown macro shape
    leaf &= shape
    leaf = ndimage.binary_fill_holes(leaf | ndimage.binary_erosion(shape, iterations=1))
    for _ in range(3):
        nb = ndimage.convolve(leaf.astype(int), np.array([[0, 1, 0], [1, 0, 1], [0, 1, 0]]), mode='constant')
        leaf = (leaf & (nb >= 2)) | (~leaf & (nb >= 3))
    leaf = ndimage.binary_fill_holes(leaf)
    leaf = scallop(leaf)
    cs = np.array([(c['cx'], c['cy']) for c in clumps])
    for y, x in zip(*np.nonzero(leaf & (owner < 0))):
        owner[y, x] = int(np.argmin((cs[:, 0] - x) ** 2 + (cs[:, 1] - y) ** 2))
    owner[~leaf] = -1
    ys, xs = np.nonzero(leaf)
    bottom = np.full(w, -1)
    for x in range(w):
        col = np.nonzero(leaf[:, x])[0]
        if len(col):
            bottom[x] = col.max()
    val = np.full((h, w), np.nan)
    litcap = np.zeros((h, w), bool)
    for y, x in zip(ys, xs):
        c = clumps[owner[y, x]]
        u, v = (x + .5 - c['cx']) / c['rx'], (y + .5 - c['cy']) / c['ry']
        s = LX * u + LY * v                       # +1 lit side .. -1 shadow side
        t = c['base'] + 0.15 * s + 0.1 * min(0.0, med_light(x + .5, y + .5) + 0.3)
        # short seam: a front clump begins right below / below-right
        for dx, dy in ((0, 1), (1, 1)):
            j = owner[y + dy, x + dx] if y + dy < h and x + dx < w else -1
            if j > owner[y, x]:
                t -= 0.16 if (x * 5 + y * 3) % 7 else 0.05
                break
        if bottom[x] - y < under:                 # crown underside
            t -= 0.16 if bottom[x] - y < under - 1 else 0.08
        val[y, x] = t
        litcap[y, x] = s > 0.45 and bottom[x] - y >= under
    tone = -np.ones((h, w), int)
    for y, x in zip(ys, xs):
        t = val[y, x]
        tone[y, x] = 1 if t < 0.27 else 2 if t < 0.44 else 3 if t < 0.61 else 4
        if litcap[y, x]:                      # every small clump keeps a lit cap,
            tone[y, x] = max(tone[y, x], 2)   # even deep in the shade side
    # bright clump tops (upper-left clumps only)
    placed = 0
    order = sorted(range(len(clumps)), key=lambda i: -clumps[i]['base'])
    for i in order:
        if placed >= hilite:
            break
        c = clumps[i]
        x, y = int(c['cx'] - 0.4 * c['rx']), int(c['cy'] - 0.5 * c['ry'])
        pts = [(x, y), (x + 1, y)] + ([(x, y + 1)] if (i % 2) else [])
        if all(0 <= px < w and 0 <= py < h and owner[py, px] == i and tone[py, px] >= 3 for px, py in pts):
            for px, py in pts:
                tone[py, px] = 5
            placed += 1
    # small dark gaps with a branch glimpse
    gapm = np.zeros((h, w), bool)
    for (cx, cy, rx, ry) in gaps:
        gapm |= ell_mask(w, h, [(cx, cy, rx, ry)])
    gapm &= ndimage.binary_erosion(leaf, iterations=3)
    for y, x in zip(*np.nonzero(gapm)):
        tone[y, x] = -2
    for y, x in zip(*np.nonzero(gapm)):
        if y + 1 < h and tone[y + 1, x] >= 0:
            tone[y + 1, x] = min(tone[y + 1, x], 1)
    # break long dark interior runs (they would relight into a tier line)
    inner = ndimage.binary_erosion(leaf, iterations=2)
    for y in range(h):
        x = 0
        while x < w:
            if inner[y, x] and 0 <= tone[y, x] <= 1:
                x1 = x
                while x1 + 1 < w and inner[y, x1 + 1] and 0 <= tone[y, x1 + 1] <= 1:
                    x1 += 1
                n = x1 - x + 1
                for q in range(x + 2, x1 - 1, 3):
                    tone[y, q] = 2
                    if (q + y) % 2 and q + 1 <= x1:
                        tone[y, q + 1] = 2
                x = x1 + 1
            else:
                x += 1
    # silhouette rim: darkest only on the shadow (bottom / right) side
    for y, x in zip(ys, xs):
        if tone[y, x] < 0:
            continue
        def out(dx, dy):
            xx, yy2 = x + dx, y + dy
            return not (0 <= xx < w and 0 <= yy2 < h) or not leaf[yy2, xx]
        gu, gv = (x - gcx) / grx, (y - gcy) / gry
        if 0.6 * gu + 0.8 * gv <= 0.05:
            continue
        if out(1, 0) or out(0, 1) or out(1, 1):
            tone[y, x] = 0
        elif out(-1, 0) or out(0, -1):
            tone[y, x] = min(tone[y, x], 2)
    for y, x in zip(ys, xs):
        if tone[y, x] == -2:
            cv.put(x, y, DEEP if (x * 3 + y) % 4 else LEAF[0])
        else:
            cv.put(x, y, LEAF[tone[y, x]])
    for pts in branches:
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            n = max(abs(x1 - x0), abs(y1 - y0), 1)
            for q in range(n + 1):
                x = round(x0 + (x1 - x0) * q / n)
                y = round(y0 + (y1 - y0) * q / n)
                if 0 <= x < w and 0 <= y < h and gapm[y, x]:
                    cv.put(x, y, BARK[1] if q < n * 0.6 else BARK[2])
                    if y + 1 < h and gapm[y + 1, x]:
                        cv.put(x, y + 1, BARK[3])
    return leaf


def tree_a():
    """Broad round oak: full 64 px wide, four soft top bumps (left-centre
    highest, right a little lower, low shoulders), belly hanging low over a
    short flared trunk."""
    cv = Canvas(64, 80)
    draw_trunk(cv, 58, 77, 32.0, 3.6, 8.0, lean=0.0, seed=3)
    draw_root(cv, 24, 77, -1, 8)
    draw_root(cv, 40, 77, 1, 9, tone=BARK[3])
    draw_root(cv, 28, 78, -1, 3)
    draw_root(cv, 36, 78, 1, 4, tone=BARK[2])
    moss(cv, [(26, 75, 0), (27, 74, 0), (26, 76, 1), (25, 77, 1), (38, 77, 1),
              (14, 79, 1), (15, 78, 0), (51, 79, 1), (50, 78, 0)])
    macro = [
        (32, 38, 31, 23),        # broad body, full width
        (23, 17, 13, 12),          # top bump left-centre (highest)
        (42, 18, 11, 11),          # top bump right, a little lower
        (10, 27, 9, 9),            # left shoulder bump
        (54, 26, 9, 9.5),          # right shoulder bump
        (14, 53, 13, 10),           # lower left belly
        (48, 54, 14, 10),           # lower right belly
        (31, 62, 17, 8.5),         # front, hangs low over the trunk
    ]
    gaps = [(36, 24, 2, 1.4), (20, 40, 1.8, 1.3), (43, 47, 2.2, 1.4), (12, 33, 1.4, 1.2),
            (52, 36, 1.5, 1.2), (28, 52, 1.6, 1.2), (26, 30, 1.3, 1.1), (45, 30, 1.4, 1.1),
            (14, 49, 1.4, 1.1), (54, 50, 1.3, 1.1), (36, 60, 1.5, 1.1), (30, 16, 1.2, 1.0)]
    branches = [[(34, 25), (36, 23), (38, 24)], [(19, 41), (21, 39)],
                [(41, 48), (43, 46), (45, 47)], [(27, 53), (29, 52)]]
    paint_clusters(cv, macro, seed=31, gaps=gaps, branches=branches)
    solid = np.array([[cv.get(x, y) in LEAF or cv.get(x, y) == DEEP for x in range(64)] for y in range(80)])
    trunk_shadow(cv, solid, 22, 42)
    return cv


def tree_b():
    """Rounder, fuller oak, a bit taller than wide, crown leaning right of a
    slightly left-leaning trunk: two top bumps (right one higher), a low left
    shoulder, round belly."""
    cv = Canvas(48, 64)
    draw_trunk(cv, 44, 61, 18.0, 2.6, 5.6, lean=-0.03, seed=5)
    draw_root(cv, 13, 61, -1, 6)
    draw_root(cv, 24, 61, 1, 7, tone=BARK[3])
    draw_root(cv, 15, 62, -1, 3)
    moss(cv, [(14, 59, 0), (15, 58, 0), (14, 60, 1), (22, 61, 1),
              (6, 63, 1), (7, 62, 0), (32, 63, 1), (31, 62, 0)])
    macro = [
        (24, 29, 21, 17),          # round body
        (29, 13, 11, 10),          # top bump right (highest)
        (14, 17, 10, 9),           # top bump left, lower
        (7, 29, 7, 8),             # low left shoulder
        (40, 25, 7, 8),            # right shoulder
        (13, 41, 9, 7),            # lower left
        (25, 45, 14, 7.5),         # belly, rounds off low over the trunk
    ]
    gaps = [(28, 20, 1.8, 1.3), (14, 31, 1.6, 1.2), (31, 37, 2, 1.3), (37, 27, 1.3, 1.2),
            (21, 28, 1.3, 1.0), (10, 39, 1.2, 1.0), (24, 42, 1.4, 1.0)]
    branches = [[(26, 21), (28, 19), (30, 20)], [(13, 32), (15, 30)], [(29, 38), (31, 36), (33, 37)]]
    paint_clusters(cv, macro, seed=47, gaps=gaps, branches=branches, hilite=10)
    solid = np.array([[cv.get(x, y) in LEAF or cv.get(x, y) == DEEP for x in range(48)] for y in range(64)])
    trunk_shadow(cv, solid, 12, 25)
    return cv


def straight_runs(a, limit=3):
    """Longest straight outline run on each side (left/right per row,
    top/bottom per column) - only counted along the crown silhouette."""
    h, w = a.shape
    res = {}
    rows = [y for y in range(h) if a[y].any()]
    cols = [x for x in range(w) if a[:, x].any()]
    L = [np.nonzero(a[y])[0].min() for y in rows]
    R = [np.nonzero(a[y])[0].max() for y in rows]
    T = [np.nonzero(a[:, x])[0].min() for x in cols]
    B = [np.nonzero(a[:, x])[0].max() for x in cols]
    for name, prof in (('left', L), ('right', R), ('top', T), ('bottom', B)):
        best, run = 1, 1
        for p, q in zip(prof, prof[1:]):
            run = run + 1 if p == q else 1
            best = max(best, run)
        res[name] = best
    return res


# ------------------------------------------------------------ variants ----
# Round 6: each colour tint ships its own drawing so neighbouring trees of the
# same design read as different trees (different lobe rhythm, lean, crown
# height, trunk length, clump/branch layout).  oakA / oakB are unchanged.
def _finish(cv, x0, x1):
    solid = np.array([[cv.get(x, y) in LEAF or cv.get(x, y) == DEEP for x in range(cv.w)] for y in range(cv.h)])
    trunk_shadow(cv, solid, x0, x1)
    return cv


def _stretch(macro, gaps, branches, a, b):
    """Vertical remap y -> a + b*y (sets crown top / underside heights)."""
    macro = [(cx, a + b * cy, rx, ry * b) for cx, cy, rx, ry in macro]
    gaps = [(cx, a + b * cy, rx, ry) for cx, cy, rx, ry in gaps]
    branches = [[(x, int(round(a + b * y))) for x, y in pts] for pts in branches]
    return macro, gaps, branches


def tree_a2():
    """Taller oak leaning left: highest bump far left, a lower middle bump,
    a long sloping right shoulder; the belly hangs low (short trunk)."""
    cv = Canvas(64, 80)
    draw_trunk(cv, 64, 77, 32.0, 3.4, 7.6, lean=-0.06, seed=11)
    draw_root(cv, 25, 77, -1, 7)
    draw_root(cv, 39, 77, 1, 10, tone=BARK[3])
    draw_root(cv, 29, 78, -1, 4)
    draw_root(cv, 35, 78, 1, 3, tone=BARK[2])
    moss(cv, [(27, 76, 0), (26, 77, 1), (37, 76, 1), (38, 77, 0),
              (17, 79, 1), (18, 78, 0), (48, 79, 1)])
    macro = [
        (29, 40, 28, 23),       # body, leaning left of the trunk
        (17, 15, 12, 13),       # far-left bump (highest)
        (35, 17, 9, 9),         # middle bump, lower
        (48, 25, 10, 10),       # right shoulder, sloping down
        (7, 31, 7, 10),         # left edge
        (57, 39, 6, 10),        # right flank
        (13, 56, 12, 10),       # lower left
        (45, 58, 13, 9),        # lower right
        (28, 63, 16, 8),        # front, hangs low
    ]
    gaps = [(24, 21, 1.8, 1.3), (40, 26, 1.6, 1.2), (14, 36, 1.5, 1.2), (31, 39, 2.2, 1.4),
            (50, 43, 1.5, 1.2), (19, 51, 1.4, 1.1), (39, 56, 1.8, 1.2), (9, 25, 1.2, 1.0),
            (27, 60, 1.4, 1.0), (46, 32, 1.2, 1.0)]
    branches = [[(22, 22), (24, 20), (26, 21)], [(29, 40), (31, 38), (33, 39)],
                [(37, 57), (39, 55), (41, 56)], [(13, 37), (15, 35)]]
    macro, gaps, branches = _stretch(macro, gaps, branches, -3.0, 1.07)
    paint_clusters(cv, macro, seed=73, gaps=gaps, branches=branches)
    return _finish(cv, 22, 42)


def tree_a3():
    """Shorter crown leaning right on a longer trunk: one dominant bump right
    of centre, a small low left bump, flat-ish left shoulder."""
    cv = Canvas(64, 80)
    draw_trunk(cv, 58, 77, 32.0, 3.4, 7.8, lean=0.07, seed=17)
    draw_root(cv, 24, 77, -1, 9)
    draw_root(cv, 40, 77, 1, 6, tone=BARK[3])
    draw_root(cv, 28, 78, -1, 5)
    moss(cv, [(25, 76, 0), (24, 77, 1), (39, 76, 1),
              (12, 79, 1), (13, 78, 0), (47, 79, 1), (46, 78, 0)])
    macro = [
        (35, 38, 27, 20),       # body, leaning right of the trunk
        (40, 19, 13, 11),       # dominant bump right of centre
        (22, 23, 9, 8),         # small left bump, lower
        (55, 27, 8, 9),         # right shoulder
        (11, 34, 8, 8),         # low left shoulder
        (18, 50, 11, 8),        # lower left
        (48, 51, 13, 8),        # lower right
        (34, 57, 15, 7),        # front belly
    ]
    gaps = [(44, 22, 1.8, 1.3), (25, 31, 1.6, 1.2), (52, 36, 2.0, 1.3), (15, 39, 1.3, 1.1),
            (36, 43, 2.2, 1.4), (22, 49, 1.5, 1.1), (47, 50, 1.5, 1.1), (33, 27, 1.2, 1.0),
            (32, 55, 1.4, 1.0)]
    branches = [[(42, 23), (44, 21), (46, 22)], [(34, 44), (36, 42), (38, 43)],
                [(50, 37), (52, 35)], [(21, 50), (23, 48)]]
    macro, gaps, branches = _stretch(macro, gaps, branches, 0.86, 1.02)
    paint_clusters(cv, macro, seed=59, gaps=gaps, branches=branches)
    return _finish(cv, 22, 42)


def tree_b2():
    """Taller oakB leaning left: high left bump, smaller middle bump, low
    right shoulder; belly hangs lower."""
    cv = Canvas(48, 64)
    draw_trunk(cv, 50, 61, 18.0, 2.6, 5.6, lean=-0.05, seed=23)
    draw_root(cv, 13, 61, -1, 5)
    draw_root(cv, 23, 61, 1, 8, tone=BARK[3])
    draw_root(cv, 21, 62, 1, 3, tone=BARK[2])
    moss(cv, [(14, 60, 0), (13, 61, 1), (22, 60, 1),
              (8, 63, 1), (9, 62, 0), (34, 63, 1)])
    macro = [
        (22, 31, 20, 18),       # body
        (13, 13, 10, 11),       # high left bump
        (27, 14, 8, 8),         # middle bump
        (37, 22, 8, 8),         # right shoulder, lower
        (5, 29, 5, 8),          # left edge
        (41, 33, 5, 8),         # right flank
        (12, 44, 9, 7),         # lower left
        (30, 45, 11, 7),        # lower right
        (21, 47, 12, 5.5),      # front belly
    ]
    gaps = [(18, 18, 1.6, 1.2), (31, 22, 1.5, 1.2), (10, 30, 1.4, 1.1), (24, 32, 2.0, 1.3),
            (36, 34, 1.3, 1.1), (16, 41, 1.4, 1.0), (28, 44, 1.4, 1.0)]
    branches = [[(16, 19), (18, 17), (20, 18)], [(22, 33), (24, 31), (26, 32)], [(9, 31), (11, 29)]]
    macro, gaps, branches = _stretch(macro, gaps, branches, -4.93, 1.186)
    paint_clusters(cv, macro, seed=83, gaps=gaps, branches=branches, hilite=10)
    return _finish(cv, 12, 25)


def tree_b3():
    """Short wide oakB leaning right on a longer trunk: one big bump right
    of centre, small low left bump."""
    cv = Canvas(48, 64)
    draw_trunk(cv, 44, 61, 18.0, 2.6, 5.8, lean=0.08, seed=29)
    draw_root(cv, 12, 61, -1, 7)
    draw_root(cv, 24, 61, 1, 5, tone=BARK[3])
    draw_root(cv, 15, 62, -1, 4)
    moss(cv, [(13, 60, 0), (12, 61, 1), (23, 60, 1),
              (4, 63, 1), (5, 62, 0), (29, 63, 1)])
    macro = [
        (26, 29, 19, 15),       # body, right of the trunk
        (28, 17, 11, 10),       # big bump right of centre
        (14, 21, 7, 7),         # small left bump, lower
        (40, 23, 6, 7),         # right shoulder
        (9, 31, 6, 7),          # low left
        (16, 39, 9, 6.5),       # lower left
        (34, 39, 11, 6.5),      # lower right
        (23, 41, 11, 5),        # front belly
    ]
    gaps = [(31, 19, 1.6, 1.2), (17, 27, 1.4, 1.1), (37, 30, 1.6, 1.2), (25, 33, 1.8, 1.2),
            (12, 35, 1.2, 1.0), (30, 40, 1.4, 1.0)]
    branches = [[(29, 20), (31, 18), (33, 19)], [(23, 34), (25, 32), (27, 33)], [(35, 31), (37, 29)]]
    macro, gaps, branches = _stretch(macro, gaps, branches, 0.62, 1.054)
    paint_clusters(cv, macro, seed=91, gaps=gaps, branches=branches, hilite=10)
    return _finish(cv, 12, 25)


ALL = (('oakA', 32), ('oakA_v2', 32), ('oakA_v3', 32), ('oakB', 18), ('oakB_v2', 18), ('oakB_v3', 18))


def check_all():
    for k, cx in ALL:
        im = np.array(Image.open(os.path.join(HERE, 'art', k + '.png')))
        a = im[..., 3] > 0
        h, w = a.shape
        leaf = np.zeros_like(a)
        for c in LEAF:
            leaf |= (im[..., :3] == c).all(-1) & a
        crown = leaf.copy()
        for c in (DEEP,):
            crown |= (im[..., :3] == c).all(-1) & a
        ys, xs = np.nonzero(crown)
        lb = np.nonzero(leaf[:, cx])[0].max()
        base_y = 77 if h == 80 else 61
        bark = np.zeros_like(a)
        for c in BARK + [ROOT]:
            bark |= (im[..., :3] == c).all(-1) & a
        brow = np.nonzero(bark[base_y])[0]
        print('%-8s %dx%d binary %s lowest row %d trunk base cols %d-%d (col %d bark %s) '
              'crown top %d under %d height %d width %d (x %d-%d, centre %.1f) trunk visible %d px runs %s' % (
                  k, w, h, set(np.unique(im[..., 3])) <= {0, 255}, np.nonzero(a.any(1))[0].max(),
                  brow.min(), brow.max(), cx, bark[base_y, cx], ys.min(), lb, lb - ys.min() + 1,
                  xs.max() - xs.min() + 1, xs.min(), xs.max(), xs.mean(), base_y - lb, straight_runs(leaf)))


if __name__ == '__main__':
    for name, fn in (('oakA', tree_a), ('oakB', tree_b), ('oakA_v2', tree_a2), ('oakA_v3', tree_a3), ('oakB_v2', tree_b2), ('oakB_v3', tree_b3)):
        fn().save(os.path.join(HERE, 'art', name + '.png'))
    print('wrote oakA, oakB and their _v2/_v3 shape variants (one per colour tint)')
    check_all()
