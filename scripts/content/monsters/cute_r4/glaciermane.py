"""glaciermane 글레이팽 — final snow lynx (flurrykit → rimepelt → glaciermane).

Round 6 (사용자 5판 「낮고 뻣뻣한 장난감」, 4판 「이브이 닮음」 → 전면 재작성): a big, heavy snow lynx standing
square on four thick legs, side profile facing left (one eye). Rimepelt's own palette and fur rendering:
white-dominant fur, pale-blue and slate shading in jagged fur clumps (zigzag tone borders), tufted outline,
navy outline lightened to slate on lit inner seams. Lynx cues: tall ears with dark tufts, swept-back cheek
sideburns, a beard-like white chest that hangs down in points (no round collar), big toed paws. The tail is
long and bushy but hangs low behind the hind leg and curls forward at the tip (never up over the back).
Signature: a crown-and-cape of faceted lavender ice shards rising from the crown, nape and shoulders, taller
than the head; each shard has a light facet, mid facet, shadow facet and a few sparkles. Lavender is used only
on the ice.
"""
from __future__ import annotations

import math

import numpy as np

from .kit import (N, View, blob, capsule, chain, ellipse, eye, hexc, poly, sd_chain, sd_ellipse, shifted, stamp,
                  NEAR_EYE_6x8)

# rimepelt's own colours (exact hex from rimepelt/front.png)
W = "#fdfdfc"
P1 = "#d5e8fb"
P2 = "#aac7ea"
S = "#92afd9"
D = "#6f7cb5"
OL = "#091a56"
OL2 = "#162b6d"
# ice (blue-side lavender; I1 is rimepelt's lavender)
I0 = "#ebe4fb"
I1 = "#c7a6e6"
I2 = "#9a8edb"
I3 = "#6a6cbe"

FUR = (W, P1, S, D)  # lit, base, shade, deep
WHITE = (W, W, P1, S)
FAR = (P1, P2, S, D)


def tri(v: np.ndarray, period: float) -> np.ndarray:
    """Triangle wave in [0, 1]."""
    f = (v / period) % 1.0
    return np.abs(f * 2 - 1)


YY, XX = np.mgrid[0:N, 0:N]


def ddist(m: np.ndarray, ux: float, uy: float, kmax: int = 12) -> np.ndarray:
    """Steps from each pixel along (ux, uy) until leaving mask m."""
    d = np.full(m.shape, kmax, float)
    done = ~m
    d[done] = 0
    for k in range(1, kmax + 1):
        out = ~shifted(m, int(round(k * ux)), int(round(k * uy)))
        hit = out & ~done
        d[hit] = k
        done |= out
    return d


class Part:
    def __init__(self, name, mask, ramp, kind="fur", cuts=(2.0, 3.6, 99.0), flow=(0.55, 0.85), tooth=(4.0, 1.6), seam=True, line=None,
                 litband=2.6, seam_from=0.0):
        self.name, self.mask, self.ramp, self.kind = name, mask, ramp, kind
        self.litband, self.seam_from = litband, seam_from
        self.deep_edge = True
        self.cuts, self.flow, self.tooth, self.seam, self.line = cuts, flow, tooth, seam, line
        self.shard = None


def shade_fur(p: Part) -> np.ndarray:
    """Volume shading: relative position between the lit (upper-left) and shadow (lower-right) edges along the
    part's light axis -> 4 clean tone bands; then hand-style fur clumps: every few pixels the lighter band pokes a
    2px pointed tooth into the darker band below / behind it. cuts = (white<, base<, shade<) on that 0..1 scale."""
    m = p.mask
    ramp = [hexc(c) for c in p.ramp]
    ux, uy = p.flow
    L = math.hypot(ux, uy)
    ux, uy = ux / L, uy / L
    dlr = ddist(m, ux, uy, 20)
    dul = ddist(m, -ux, -uy, 20)
    u = dul / np.maximum(dul + dlr, 1)
    c0, c1, c2 = p.cuts
    T = np.full((N, N), 3, int)
    T[u < c2] = 2
    T[u < c1] = 1
    T[u < c0] = 0
    T[(dlr <= 1) & (u >= c1)] = 3 if p.deep_edge else 2
    per = int(p.tooth[0])
    if per > 0:
        T0 = T.copy()
        vert = abs(uy) >= abs(ux)
        for y in range(1, N - 2):
            for x in range(1, N - 2):
                if not m[y, x]:
                    continue
                a = T0[y, x]
                if vert:
                    if (x * 2 + y) % per == 0 and m[y + 1, x] and T0[y + 1, x] > a:
                        b = T0[y + 1, x]
                        T[y + 1, x] = a
                        if m[y + 1, x + 1] and T0[y + 1, x + 1] == b:
                            T[y + 1, x + 1] = a  # 2-wide tuft, not a lone pixel
                        if m[y + 2, x] and T0[y + 2, x] == b and (x + y) % 2 == 0:
                            T[y + 2, x] = a
                else:
                    if (y * 2 + x) % per == 0 and m[y, x + 1] and T0[y, x + 1] > a:
                        T[y, x + 1] = a
    # clean single-pixel dither: a tone pixel with no same-tone 4-neighbour joins its neighbours' majority
    for _ in range(2):
        T1 = T.copy()
        for y in range(1, N - 1):
            for x in range(1, N - 1):
                if not m[y, x]:
                    continue
                nb = [T1[y + dy, x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if m[y + dy, x + dx]]
                if nb and T1[y, x] not in nb:
                    T[y, x] = max(set(nb), key=nb.count)
    out = np.zeros((N, N, 3), np.uint8)
    for i in range(4):
        out[T == i] = ramp[i]
    return out


def shard_poly(a, b, tip, bulge=0.28):
    """Angular ice shard: the two shoulders sit at different heights so the crystal breaks into uneven facets."""
    (ax, ay), (bx, by), (tx, ty) = a, b, tip
    mx, my = (ax + bx) / 2, (ay + by) / 2
    wx, wy = (bx - ax), (by - ay)
    s1x, s1y = mx + (tx - mx) * 0.3, my + (ty - my) * 0.3
    s2x, s2y = mx + (tx - mx) * 0.55, my + (ty - my) * 0.55
    pa = (s1x - wx * bulge, s1y - wy * bulge)
    pb = (s2x + wx * bulge * 0.8, s2y + wy * bulge * 0.8)
    return [a, pa, tip, pb, b]


def shade_shard(p: Part, E) -> np.ndarray:
    (a, b, tip, ridge_t) = p.shard
    m = p.mask
    mx, my = E((a[0] + b[0]) / 2 + (b[0] - a[0]) * ridge_t, (a[1] + b[1]) / 2 + (b[1] - a[1]) * ridge_t)
    tx, ty = E(*tip)
    # side of the ridge (base mid -> tip)
    cross = (tx - mx) * ((YY + 0.5) - my) - (ty - my) * ((XX + 0.5) - mx)
    ax_, ay_ = E(*a)
    sa = (tx - mx) * (ay_ - my) - (ty - my) * (ax_ - mx)
    left = np.sign(cross) == np.sign(sa)  # same side as base point a (the lit side in the front view)
    out = np.zeros((N, N, 3), np.uint8)
    out[:] = hexc(I1)
    out[~left] = hexc(I2)
    # lit rim along the outer lit edge, deep band along the shadow edge and the root
    rim = m & ~shifted(m, -1, 0) | m & ~shifted(m, 0, -1)
    out[left & rim] = hexc(I0)
    dsh = m & (~shifted(m, 1, 0) | ~shifted(m, 1, 1))
    out[~left & dsh] = hexc(I3)
    # ridge highlight just on the lit side of the ridge, upper part
    L = math.hypot(tx - mx, ty - my)
    dist_ridge = np.abs(cross) / max(L, 1e-6)
    along = ((XX + 0.5 - mx) * (tx - mx) + (YY + 0.5 - my) * (ty - my)) / max(L * L, 1e-6)
    out[left & (dist_ridge < 1.0) & (along > 0.25) & (along < 0.92)] = hexc(I0)
    out[(~left) & (dist_ridge < 0.9) & (along > 0.3) & (along < 0.85)] = hexc(I1)
    return out


def spike(base_a, base_b, tip):
    return poly([base_a, tip, base_b])


def tufts(E, pts):
    """Hand-placed fur tufts: list of (base_a, base_b, tip) in front-view coords."""
    m = np.zeros((N, N), bool)
    for a, b, t in pts:
        m |= spike(E(*a), E(*b), E(*t))
    return m


def auto_tufts(m: np.ndarray, flow=(0.5, 0.8), spacing=4.0, length=2.4, width=2.6, allow=None, seed=0) -> np.ndarray:
    """Pointed fur tufts along the silhouette of m, leaning with the fur flow (down/back)."""
    f = m.astype(float)
    k = np.ones(5) / 5
    for ax in (0, 1):
        f = np.apply_along_axis(lambda r: np.convolve(r, k, mode="same"), ax, f)
    gy, gx = np.gradient(f)
    edge = m & ~(shifted(m, 1, 0) & shifted(m, -1, 0) & shifted(m, 0, 1) & shifted(m, 0, -1))
    ys, xs = np.nonzero(edge)
    order = np.argsort((ys * 31 + xs * 17 + seed * 7) % 97)
    picked = []
    out = np.zeros_like(m)
    for i in order:
        x, y = xs[i], ys[i]
        if any((x - a) ** 2 + (y - b) ** 2 < spacing * spacing for a, b in picked):
            continue
        nx, ny = -gx[y, x], -gy[y, x]
        L = math.hypot(nx, ny)
        if L < 1e-3:
            continue
        nx, ny = nx / L, ny / L
        if allow is not None and not allow(x, y, nx, ny):
            continue
        picked.append((x, y))
        dx, dy = nx + flow[0] * 0.7, ny + flow[1] * 0.7
        L = math.hypot(dx, dy)
        dx, dy = dx / L, dy / L
        cx, cy = x + 0.5 - nx * 0.8, y + 0.5 - ny * 0.8
        tx, ty = -ny, nx
        out |= poly([(cx + tx * width / 2, cy + ty * width / 2), (cx + dx * (length + 0.8), cy + dy * (length + 0.8)),
                     (cx - tx * width / 2, cy - ty * width / 2)])
    return out



# ── hand-pixelled heads. O navy, o dark navy, W white, p pale, q light-mid, s slate, d deep.
# Front: faces left, round lynx skull, short round muzzle with nose + small smile, cheek ruffs swept out behind the
# eye. The 6x8 placeholder eye goes at (8, 15) of this block; x 6..15, y 13..24 stay plain face fur.
HEAD_FRONT = [
    '.....................O........',
    '......O.............OpO.......',
    '.....OqO...........OppO.......',
    '.....OqqO.........OpWpO.......',
    '.....OqqqO........OWWspO......',
    '.....OqsqqO......OpWsspO......',
    '.....OqsqqO......OWWsdppO.....',
    '.....OqdsqqOOOOOOpWWsdspO.....',
    '....OqsdsqqOWWWWpWWsdddppO....',
    '....OqsddOOWWWWWWWWsdddspO....',
    '....OqsOOWWWWWWWWWssdddsppO...',
    '....OqOWWWWWppppppppsdddspO...',
    '....OOWWWWppppppppppppWsspO...',
    '....OWWWppppppppppppppppWsO...',
    '...OWWWpppppppppppppppppqqO...',
    '...OWWppppppppppppppppppqWWOOO',
    '..OWWWppppppppppppppppppqWWWWW',
    '..OWWpppppppppppppppqqqqpqWWWO',
    '.OOWWpppppppppppppppqWWWqqWWO.',
    'OooWWWWWpppppppppppqqWWWWWWO..',
    'OoWWWWWWWppppppppppqWWWWWWWWOO',
    'OWWWWWWWWpppppppppqqWWWWWWWWWW',
    'OoWWoWWWWWWppppppqqWWWWWWWWsOO',
    '.OooWWWWWWWppppqqqWWWWWWWWWWO.',
    '..OOqqqqqqpppppqWWWWWWWWWWWO..',
    '....OOOOpppppppqWWWWWWWWsssO..',
    '........OOOpppqqWWWWWWWWWsssO.',
    '...........OOOOsssWsssWOOOOO..',
    '..............OssOOOssO.......',
    '..............OsO..OssO.......',
    '...............O....OO........',
    '..............................',
]
# Rear 3/4: back of the skull, both ear backs, the ruff ringing the jaw (no snout).
HEAD_BACK = [
    '..............................',
    '......O................O......',
    '.....OqO..............OpO.....',
    '.....OqqO............OppO.....',
    '.....OpqqO..........OpppO.....',
    '.....OpqqO..........OpqpO.....',
    '....OqpqqqO........OppqppO....',
    '....OqpqqqqOOOOOOOOWppqqpO....',
    '....OqppqqqOWWWWWWWWppqqpO....',
    '....OqppqOOWWWWWWWWpppqqpO....',
    '....OqpOOWWWWWWWWWWpppqqqO....',
    '....OqOWWWWWpppppppppppqqpO...',
    '...OqOWWWWpppppppppppppppqO...',
    '...OqWWWppppppppppppppppppO...',
    '...OWWWppppppppppppppppppWO...',
    '...OWWppppppppppppppppppppsO..',
    '..OWWWppppppppppppppppppppsO..',
    '..OWWqqqqqpppppppppqqqppppsO..',
    '..OqqqWWWWqqpppppqqqWWqpppsO..',
    '..OWWWWWWWWWqpppqqWWWWWqpqqO..',
    '.OWWWWWWWWWWWqppqWWWWWWWqqWO..',
    'OWWWWWWWWWWWWqppqWWWWWWWWWWWO.',
    '.OsssWWWWWWWWWqpqWWWWWWWWWWWO.',
    '..OWWsWWWWWWWqqqqWWWWWWWWWWWO.',
    '..OssssWWWWWWWWWWWWWWWWWWWsO..',
    '.OsssssWsWWWWWWWWWWWWWWWssssO.',
    '..OOOOOWsssWWWWWWWWWWWWWOOOO..',
    '.......OssWWWWssWWWWsssO......',
    '......OssOOOOOssOOOOOssO......',
    '.......OO.....OsO....OO.......',
    '...............O..............',
    '..............................',
]
_HEAD_W = 30
assert all(len(r) == _HEAD_W for r in HEAD_FRONT + HEAD_BACK)
_HC = {"O": OL, "o": OL2, "W": W, "p": P1, "q": P2, "s": S, "d": D}

# rimepelt / flurrykit family mark: a 4-point star tuft on each ear tip
STAR = [
    "...O...",
    "..OWO..",
    ".OOWOO.",
    "OWWbWWO",
    ".OOWOO.",
    "..OWO..",
    "...O...",
]


def stamp_part(name, rows, x0, y0):
    m = np.zeros((N, N), bool)
    col = np.zeros((N, N, 3), np.uint8)
    for dy, r in enumerate(rows):
        for dx, ch in enumerate(r):
            if ch == ".":
                continue
            x, y = x0 + dx, y0 + dy
            if 0 <= x < N and 0 <= y < N:
                m[y, x] = True
                col[y, x] = hexc(_HC[ch])
    p = Part(name, m, None, kind="stamp", seam=False)
    p.colors = col
    return p


def _leg(E, R, pts, ws, foot, pw, ph=2.5):
    m = sd_chain([E(*q) for q in pts], [R(w / 2) for w in ws]) < 0
    return m | ellipse(*E(*foot), R(pw / 2), R(ph))


def _shard_part(E, name, a, b, t, rt, bulge):
    p = Part(name, poly([E(*q) for q in shard_poly(a, b, t, bulge)]), None, kind="ice")
    p.shard = (a, b, t, rt)
    return p


def _render(plist, E, head_name):
    idm = np.full((N, N), -1, int)
    for k, p in enumerate(plist):
        idm[p.mask] = k
    arr = np.zeros((N, N, 4), np.uint8)
    for k, p in enumerate(plist):
        vis = idm == k
        if not vis.any():
            continue
        col = p.colors if p.kind == "stamp" else (shade_shard(p, E) if p.kind == "ice" else shade_fur(p))
        arr[vis, :3] = col[vis]
        arr[vis, 3] = 255
    # seams: a part over lower parts gets a 1px line on them (below `seam_from` of its height); top third slate
    for k, p in enumerate(plist):
        if not p.seam:
            continue
        vis = idm == k
        ys = np.nonzero(p.mask)[0]
        y0 = ys.min() + (ys.max() - ys.min()) * p.seam_from
        if p.seam == "sides":
            grow = vis | shifted(vis, 1, 0) | shifted(vis, -1, 0)
        else:
            grow = vis | shifted(vis, 1, 0) | shifted(vis, -1, 0) | shifted(vis, 0, 1) | shifted(vis, 0, -1)
        adj = grow & ~vis & (idm >= 0) & (idm < k) & (YY >= y0)
        arr[adj, :3] = hexc(OL if p.kind == "ice" else (p.line or OL))
        if p.kind != "ice" and p.line != S:
            ymid = ys.min() + (ys.max() - ys.min()) * 0.3
            arr[adj & (YY < ymid), :3] = hexc(D)
    op = idm >= 0
    hk = [i for i, p in enumerate(plist) if p.name == head_name][0]
    src = op & ~(idm == hk)  # the hand-pixelled head carries its own outline
    rim = (src | shifted(src, 1, 0) | shifted(src, -1, 0) | shifted(src, 0, 1) | shifted(src, 0, -1)) & ~op
    arr[rim, :3] = hexc(OL)
    arr[rim, 3] = 255
    # selective outline: on a sunlit white fur top edge the outline softens to slate
    isW = np.all(arr[:, :, :3] == np.array(hexc(W), np.uint8), axis=2) & op
    fur = np.zeros((N, N), bool)
    for k, p in enumerate(plist):
        if p.kind == "fur":
            fur |= idm == k
    soft = rim & shifted(isW & fur, 0, 1) & (YY < 52)
    soft &= ~(shifted(rim, 0, 1) & shifted(rim, 0, -1))
    arr[soft, :3] = hexc(D)
    return arr, idm


def _sparkle(arr, x, y):
    for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
        X, Y = x + dx, y + dy
        if 0 <= X < N and 0 <= Y < N and arr[Y, X, 3]:
            arr[Y, X, :3] = hexc(W if (dx, dy) == (0, 0) else I0)


def _star(arr, cx, cy):
    stamp(arr, cx - 3, cy - 3, STAR, {"O": OL, "W": W, "b": I1})


def _toes(arr, xs, y):
    for x in xs:
        for yy in (y, y + 1):
            if arr[yy, x, 3] and tuple(arr[yy, x, :3]) in {hexc(W), hexc(P1)}:
                arr[yy, x, :3] = hexc(S)


FUR2 = (W, P1, S, S)      # one base, one highlight, one shade
FAR2 = (P1, P2, S, S)
WHITE2 = (W, W, P1, P1)
TIP = (D, OL2, OL2, OL2)


def _fur(name, mask, ramp=FUR2, cuts=(0.3, 0.7, 2.0), flow=(0.55, 0.85), **kw):
    p = Part(name, mask, ramp, cuts=cuts, flow=flow, tooth=(0, 0), **kw)
    p.deep_edge = False
    return p


def draw_front():
    v = View("front", 1.0)
    E, R = v.p, v.r
    fl = (0.5, 0.8)
    HX, HY = 4, 12
    # long, low torso slung between bent feline shoulders and hocks, clear belly gap
    torso = blob(sd_ellipse(*E(37.5, 48.5), R(14.5), R(5.8)), sd_ellipse(*E(25.5, 47.5), R(7.2), R(7)),
                 sd_ellipse(*E(47, 48.5), R(7), R(6.4)), k=3)
    torso |= auto_tufts(torso, flow=fl, spacing=4.6, length=1.6, allow=lambda x, y, nx, ny: ny > 0.6 and 31 < x < 43, seed=1)
    chest = (sd_ellipse(*E(22.5, 47.5), R(6.4), R(7)) < 0) | tufts(E, [((18, 50), (22, 51), (19.5, 56)), ((21.5, 51.5), (25.5, 51), (24.5, 55.5))])
    haunch = sd_ellipse(*E(47.5, 49.5), R(7), R(6.6)) < 0
    # forelegs: shoulder -> elbow tucked back -> wrist -> paw; hind: hip -> knee forward -> hock back -> paw
    leg_ff = _leg(E, R, [(28.5, 51), (30.5, 55), (29.4, 58.5), (29.6, 60)], [6.6, 5.6, 5.2, 5.2], (29, 61.4), 8)
    leg_nf = _leg(E, R, [(22.5, 50), (24, 54.5), (19.5, 58.4), (17.4, 59.8)], [8.2, 6.8, 6.2, 6.2], (16.4, 61.4), 9.8)
    leg_fb = _leg(E, R, [(43, 52), (40.4, 55.6), (42.6, 58.4), (42, 60)], [6.6, 5.6, 5.2, 5.2], (41.2, 61.4), 8)
    leg_nb = _leg(E, R, [(48.5, 52.5), (46, 55.6), (52, 58.2), (52.6, 60)], [8.4, 6.8, 6.2, 6.2], (52, 61.4), 9.4)
    bob = (sd_ellipse(*E(53.5, 44), R(3.6), R(3.2), -35) < 0) | tufts(E, [((52, 46), (55, 46.5), (54.5, 49))])
    bob_tip = (sd_ellipse(*E(56, 42), R(2.4), R(2.4)) < 0)
    bob |= bob_tip
    parts = [
        _shard_part(E, "r_up", (20, 23.5), (27.5, 26), (24.5, 8.6), 0.05, 0.6),
        _shard_part(E, "r_head", (23.5, 25.5), (32, 29.5), (35, 9.8), 0.1, 0.62),
        _shard_part(E, "r_nape", (27, 29), (36.5, 35), (45, 15), 0.05, 0.62),
        _shard_part(E, "r_sh", (32.5, 35), (40.5, 40.5), (51.5, 28.5), 0.05, 0.58),
        _shard_part(E, "r_crown", (15, 24.5), (21.5, 23), (11, 10.5), -0.05, 0.6),
        _fur("leg_ff", leg_ff, FAR2, flow=(1, 0.3)),
        _fur("leg_fb", leg_fb, FAR2, flow=(1, 0.3)),
        _fur("torso", torso, cuts=(0.25, 0.68, 2.0), flow=(0.3, 0.95)),
        _fur("bob", bob, cuts=(0.35, 0.7, 2.0)),
        Part("bob_tip", bob_tip, TIP, cuts=(0.3, 0.9, 1.1), seam=False, tooth=(0, 0)),
        _shard_part(E, "r_fill1", (26, 28.5), (32, 31.5), (30.5, 17), 0.0, 0.55),
        _shard_part(E, "r_fill2", (30, 32), (36.5, 36), (41.5, 22.5), 0.0, 0.55),
        _fur("haunch", haunch, cuts=(0.3, 0.7, 2.0), seam=False),
        _fur("leg_nb", leg_nb, flow=(1, 0.3), seam="sides", seam_from=0.4),
        _fur("leg_nf", leg_nf, flow=(1, 0.3), seam="sides", seam_from=0.4),
        _fur("chest", chest, WHITE2, cuts=(0.5, 0.8, 2.0), line=S, seam_from=0.5),
        stamp_part("head", HEAD_FRONT, HX, HY),
    ]
    arr, idm = _render(parts, E, "head")
    hm = idm == len(parts) - 1
    ck = [i for i, p in enumerate(parts) if p.name in ("chest", "leg_nf")]
    under = np.zeros((N, N), bool)
    for c in ck:
        cm = idm == c
        under |= shifted(cm, 0, 1) | shifted(cm, 1, 0) | shifted(cm, -1, 0)
    navy = np.all(arr[:, :, :3] == np.array(hexc(OL), np.uint8), axis=2)
    arr[hm & navy & under & (YY >= HY + 26), :3] = hexc(S)
    for x, y in ((25, 13), (32, 15), (40, 20), (47, 31)):
        _sparkle(arr, x, y)
    _star(arr, HX + 21, HY + 1)
    _star(arr, HX + 6, HY + 2)
    _toes(arr, (14, 17, 51, 54), 62)
    near = eye(arr, HX + 8, HY + 15, NEAR_EYE_6x8, OL, D, P2, white=W, rim=OL)
    return arr, {"anatomy": "profile", "style": "round", "near": near, "far": None}


def draw_back():
    """True rear 3/4: walking away up-right. Haunches and the bobtail in the lower-left foreground, the crystal
    ridge on the nape/shoulders leaning out at jagged angles, the backs of both star-tufted ears, no snout."""
    v = View("front", 1.0)
    E, R = v.p, v.r
    fl = (0.5, 0.8)
    HX, HY = 31, 10
    rump = sd_ellipse(*E(20.5, 49.5), R(11.5), R(8.4)) < 0
    rump |= auto_tufts(rump, flow=fl, spacing=4.4, length=1.8, allow=lambda x, y, nx, ny: ny > 0.5, seed=7)
    torso = blob(sd_ellipse(*E(31, 45), R(11.5), R(6.4), -24), sd_ellipse(*E(41, 40), R(6.5), R(5.6)), k=3)
    leg_nb = _leg(E, R, [(14.5, 54), (12, 57.5), (13.6, 60.2)], [8.4, 7, 6.8], (13.2, 61.4), 10)
    leg_fb = _leg(E, R, [(27.5, 54.5), (30, 57.6), (29, 60.2)], [7.2, 6.2, 6], (29.4, 61.4), 8.6)
    # far forelegs: shoulder -> elbow back -> wrist forward, with paws (seen past the body)
    leg_ff = _leg(E, R, [(37, 46), (38.8, 51.5), (37.4, 55.8), (38, 57.6)], [6.4, 5.4, 5, 5], (38.6, 59.2), 7.4, 2.2)
    leg_nf = _leg(E, R, [(44, 43), (46.4, 48.5), (44.8, 52.6), (45.6, 54.4)], [6, 5, 4.6, 4.6], (46.2, 56), 6.8, 2.0)
    bob = (sd_ellipse(*E(15.5, 42), R(4.8), R(4.4)) < 0) | tufts(E, [((12, 44.5), (15, 45.5), (11, 48)), ((16, 45.5), (19.5, 44.5), (19.5, 48))])
    bob_tip = sd_ellipse(*E(13.6, 38.8), R(2.6), R(2.0)) < 0
    bob |= bob_tip
    parts = [
        _shard_part(E, "r_behind", (35, 34.5), (41, 30.5), (30, 13.5), 0.0, 0.6),
        _fur("leg_nf", leg_nf, FAR2, flow=(1, 0.3)),
        _fur("leg_ff", leg_ff, FAR2, flow=(1, 0.3)),
        _fur("torso", torso, cuts=(0.3, 0.7, 2.0), flow=(0.4, 0.9), seam=False),
        stamp_part("head", HEAD_BACK, HX, HY),
        _shard_part(E, "r_crown", (43.5, 22), (49, 21.5), (47.5, 10.5), 0.0, 0.42),
        _shard_part(E, "r_nape", (35, 37), (43, 33.5), (26, 19), 0.0, 0.6),
        _shard_part(E, "r_sh", (30.5, 40), (37.5, 37), (18.5, 29.5), 0.0, 0.58),
        _shard_part(E, "r_nape2", (39.5, 34), (45.5, 31.5), (37.5, 22), 0.0, 0.55),
        _fur("leg_fb", leg_fb, FAR2, flow=(1, 0.3)),
        _fur("rump", rump, cuts=(0.3, 0.68, 2.0), flow=(0.5, 0.85), seam="sides", seam_from=0.6),
        _fur("leg_nb", leg_nb, flow=(1, 0.3), seam="sides", seam_from=0.35),
        _fur("bob", bob, cuts=(0.35, 0.7, 2.0)),
        Part("bob_tip", bob_tip, TIP, cuts=(0.3, 0.9, 1.1), seam=False, tooth=(0, 0)),
    ]
    arr, _ = _render(parts, E, "head")
    for x, y in ((47, 15), (29, 24), (23, 32)):
        _sparkle(arr, x, y)
    _star(arr, HX + 6, HY + 2)
    _star(arr, HX + 23, HY + 2)
    _toes(arr, (11, 14), 62)
    return arr, None


def draw(side: str):
    return draw_front() if side == "front" else draw_back()
