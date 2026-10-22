#!/usr/bin/env python3
"""Beodeul (버들항) 16px chipset - three bushes (round 3), hand-placed code pixel art.

Run: python3 draw_trees_b.py -> bushC.png (32x32), bushD.png (48x48), bushE.png (32x32)

Each bush is a leafy mound on the ground, no trunk. The silhouette is the union of
hand-placed lobes (cx, cy, rx, ry). Inside, the mound is broken into leaf clusters
(about 4-5 px) on a jittered hand grid; each cluster is lit on its top-left and falls
off to its bottom-right, and the whole mound is lit from the upper left too, so the
luminance rank (which the relight keeps) is coherent: big light side top-left, shade
bottom-right. Clusters are separated by a darker leaf tone (ramp 1-2), never by the
near-black tone; the darkest tone (0) only rims the silhouette on the shade side
(bottom/right) and the ground contact row. Palette = oak leaf ramp (0 dark .. 5 light).
"""
import json, os
from PIL import Image

OAK = [tuple(c) for c in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'palette.json')))['leaf_ramps']['oak']]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'art')
LX, LY = -0.62, -0.78


def hsh(x, y, s):
    v = (x * 73856093) ^ (y * 19349663) ^ (s * 83492791)
    v = (v ^ (v >> 13)) * 1274126177
    return (v ^ (v >> 16)) & 0xFFFF


def breakruns(S, W, H, maxrun=3):
    """No straight outline longer than maxrun on any side. Lit sides (top/left) get a small
    2px bump outward, shade sides (bottom/right) get a 2px notch; at the canvas border we notch."""
    D = {'u': (0, -1), 'd': (0, 1), 'l': (-1, 0), 'r': (1, 0)}
    for _ in range(40):
        changed = False
        for k, (ax, ay) in D.items():
            E = sorted(p for p in S if (p[0] + ax, p[1] + ay) not in S)
            horiz = k in 'ud'
            groups = {}
            for p in E:
                groups.setdefault(p[1] if horiz else p[0], []).append(p[0] if horiz else p[1])
            for line, vals in groups.items():
                vals.sort()
                runs, cur = [], [vals[0]]
                for v in vals[1:]:
                    if v == cur[-1] + 1: cur.append(v)
                    else: runs.append(cur); cur = [v]
                runs.append(cur)
                for run in runs:
                    L = len(run)
                    if L <= maxrun: continue
                    off = (hsh(line, run[0], 3) % 2)
                    for i, v in enumerate(run):
                        if 0 < i < L - 1 and (i + off) % 5 in (2, 3):
                            p = (v, line) if horiz else (line, v)
                            q = (p[0] + ax, p[1] + ay)
                            if k in 'ul' and 0 <= q[0] < W and 0 <= q[1] < H:
                                S.add(q)
                            else:
                                S.discard(p)
                            changed = True
        if not changed:
            break
    return S


def mound(W, H, lobes, seed, step=4, cr=2.6, cut=(0.62, 0.22, -0.18, -0.55), spots=3, spotgap=7.0):
    owner = {}
    for k, (cx, cy, rx, ry) in enumerate(lobes):
        for y in range(H):
            for x in range(W):
                dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
                wob = 0.05 * ((hsh(x // 2, y // 2, seed + k) % 3) - 1)
                if dx * dx + dy * dy <= 1.0 + wob:
                    owner.setdefault((x, y), k)
    from scipy import ndimage
    import numpy as np

    def clean(S):
        for _ in range(3):
            for p in list(S):
                if sum((p[0] + a, p[1] + b) in S for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))) <= 1:
                    S.discard(p)
            m = np.zeros((H, W), bool)
            for (x, y) in S: m[y, x] = True
            m = ndimage.binary_fill_holes(m)
            S |= {(int(x), int(y)) for y, x in zip(*np.nonzero(m))}
        return S
    S = clean(set(owner))
    S = clean(breakruns(S, W, H))
    S = breakruns(S, W, H)
    for p in S:
        if p not in owner:
            owner[p] = min(range(len(lobes)), key=lambda k: ((p[0] + .5 - lobes[k][0]) / lobes[k][2]) ** 2 + ((p[1] + .5 - lobes[k][1]) / lobes[k][3]) ** 2)
    xs = [p[0] for p in S]; ys = [p[1] for p in S]
    gx0, gx1, gy0, gy1 = min(xs), max(xs) + 1, min(ys), max(ys) + 1
    gcx, gcy = (gx0 + gx1) / 2, (gy0 + gy1) / 2

    cl = []
    r = 0
    for cy in range(gy0 - 1, gy1 + 2, step):
        off = (step // 2) if r % 2 else 0
        for cx in range(gx0 - 1 + off, gx1 + 2, step):
            jx = ((hsh(cx, cy, seed + 7) % 5) - 2) * 0.75
            jy = ((hsh(cx, cy, seed + 8) % 5) - 2) * 0.6
            px, py = cx + jx + 0.5, cy + jy + 0.5
            if any((int(px) + a, int(py) + b) in S for a in (-1, 0, 1) for b in (-1, 0, 1)):
                rr = cr + 0.4 * ((hsh(cx, cy, seed + 9) % 3) - 1)
                cl.append((px, py, rr * 1.1, rr))
        r += 1
    cl.sort(key=lambda c: (c[1], c[0]))

    sub = {}
    for p in S:
        best = None
        for i, (cx, cy, rx, ry) in enumerate(cl):
            dx, dy = (p[0] + 0.5 - cx) / rx, (p[1] + 0.5 - cy) / ry
            d2 = dx * dx + dy * dy
            if d2 <= 1.0:
                best = (i, dx, dy, d2)
        if best is None:
            i = min(range(len(cl)), key=lambda i: (p[0] + 0.5 - cl[i][0]) ** 2 + (p[1] + 0.5 - cl[i][1]) ** 2)
            cx, cy, rx, ry = cl[i]
            best = (i, (p[0] + 0.5 - cx) / rx, (p[1] + 0.5 - cy) / ry, 1.0)
        sub[p] = best

    tone = {}
    for p, (i, dx, dy, d2) in sub.items():
        x, y = p
        lcx, lcy, lrx, lry = lobes[owner[p]]
        big = ((x + 0.5 - lcx) / lrx * LX + (y + 0.5 - lcy) / lry * LY)
        glob = ((x + 0.5 - gcx) / (gx1 - gx0) * 2 * LX + (y + 0.5 - gcy) / (gy1 - gy0) * 2 * LY)
        small = (dx * LX + dy * LY) + 0.3 * (1 - min(d2, 1))
        s = 0.30 * big + 0.42 * glob + 0.42 * small
        tone[p] = 5 if s > cut[0] else 4 if s > cut[1] else 3 if s > cut[2] else 2 if s > cut[3] else 1
    for p, (i, dx, dy, d2) in sub.items():
        x, y = p
        for q in ((x, y + 1), (x + 1, y)):
            if q in sub and sub[q][0] != i and cl[sub[q][0]][1] >= cl[i][1] and dy > 0.15 and dx > -0.45:
                tone[p] = max(1, tone[p] - 1)
                break
    # brightest tone only in a few small, spread-out spots (clusters) on the lit side
    cand = {}
    for p, t in tone.items():
        if t >= 4:
            cand[sub[p][0]] = cand.get(sub[p][0], 0) + 1
    def inner(i):
        cx, cy = int(cl[i][0]), int(cl[i][1])
        return all((cx + a, cy + b) in S for a in range(-3, 3) for b in range(-3, 3))
    order = sorted((i for i in cand if inner(i)), key=lambda i: -(cl[i][0] * LX + cl[i][1] * LY))
    keep = []
    for i in order:
        if len(keep) >= spots: break
        if all((cl[i][0] - cl[j][0]) ** 2 + (cl[i][1] - cl[j][1]) ** 2 >= spotgap ** 2 for j in keep):
            keep.append(i)
    for p in tone:
        i, dx, dy, d2 = sub[p]
        if tone[p] == 5 and i not in keep:
            tone[p] = 4
        elif i in keep and tone[p] >= 3 and (dx * LX + dy * LY) > 0.05 and d2 < 0.8:
            tone[p] = 5          # small sunny cap on the chosen clusters
    # lit sides (top/left): never dark, the relight puts its own sunny rim there
    def outside(q): return q not in S
    for (x, y) in S:
        lit_edge = outside((x, y - 1)) or outside((x - 1, y))
        lit_in = outside((x, y - 2)) or outside((x - 2, y)) or outside((x - 1, y - 1))
        dn = outside((x, y + 1)); rt = outside((x + 1, y))
        if dn or (rt and y > gy0 + (gy1 - gy0) * 0.35 and not outside((x, y - 1))):
            tone[(x, y)] = 0 if (dn and (x > gx0 + (gx1 - gx0) * 0.25 or y > gy1 - 4)) or rt else 1
        elif rt:
            tone[(x, y)] = min(max(tone[(x, y)], 2), 3)
        elif lit_edge:
            tone[(x, y)] = max(tone[(x, y)], 3)
        elif lit_in:
            tone[(x, y)] = max(tone[(x, y)], 3 if y > gcy else 2)
    return tone


def save(tone, W, H, name, ground=True):
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = img.load()
    for (x, y), t in tone.items():
        px[x, y] = OAK[t] + (255,)
    img.save(os.path.join(OUT, name))


# bushC: broadleaf garden shrub. Low, wide, asymmetric double hump (taller rounded hump
# on the left, a lower broader one on the right, a soft saddle between), sitting on a
# scalloped footing. Clearly wider than tall; no point, no tiers.
def bush_c():
    W = H = 32
    lobes = [
        (10.5, 16.5, 6.8, 6.0),   # left hump (tallest)
        (21.5, 19.0, 7.2, 5.4),   # right hump (lower, broader)
        (16.0, 19.5, 4.0, 3.8),   # saddle
        (16.0, 24.0, 13.0, 6.4),  # body
        (6.5, 25.5, 4.4, 4.3),    # left flank
        (25.5, 26.0, 4.4, 4.0),   # right flank
        (11.5, 29.0, 5.4, 3.0),   # front left
        (20.5, 29.2, 5.8, 2.9),   # front right
    ]
    tone = mound(W, H, lobes, 11, step=4, cr=2.6, spots=3, spotgap=6.5)
    save(tone, W, H, 'bushC.png')


# bushD: big rounded mound for a 48px cell, inset on all sides, gently lobed top,
# scalloped footing.
def bush_d():
    W = H = 48
    lobes = [
        (16.5, 18.3, 7.0, 7.0),   # upper left lobe
        (24.9, 14.8, 7.5, 6.2),   # crown
        (32.8, 18.3, 7.0, 6.6),   # upper right lobe
        (10.4, 27.1, 5.7, 7.0),    # left flank
        (37.6, 27.5, 5.3, 7.0),   # right flank
        (24.0, 30.2, 16.3, 10.6), # body
        (12.1, 39.4, 6.2, 5.3),   # front left
        (24.0, 41.2, 8.4, 4.9),   # front middle
        (35.9, 39.4, 6.2, 5.3),   # front right
    ]
    tone = mound(W, H, lobes, 23, step=5, cr=3.2, spots=4, spotgap=9.0)
    save(tone, W, H, 'bushD.png')


# bushE: the canopy filler. Low, wide, roughly symmetric dome made of several small lobes
# (so tiled/flipped copies interlock), brightest light spread over small spots.
def bush_e():
    W = H = 32
    lobes = [
        (6.5, 18.0, 5.0, 4.5),    # left top lobe
        (12.5, 14.0, 4.8, 4.2),   # upper left lobe
        (19.0, 13.5, 4.8, 4.2),   # upper right lobe
        (25.0, 17.5, 5.0, 4.5),   # right top lobe
        (16.0, 22.0, 14.5, 7.0),  # body
        (5.0, 25.5, 4.2, 4.0),    # left foot
        (12.0, 28.0, 4.6, 3.2),   # front left
        (19.5, 28.3, 4.6, 3.0),   # front right
        (26.5, 25.5, 4.2, 4.0),   # right foot
    ]
    tone = mound(W, H, lobes, 5, step=4, cr=2.4, spots=3, spotgap=6.0)
    save(tone, W, H, 'bushE.png')


if __name__ == '__main__':
    bush_c(); bush_d(); bush_e()
    print('wrote bushC/D/E in', OUT)
