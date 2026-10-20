"""jp_city 가로수 손 도트(코드) — 느티나무·벚나무 3×4(48×64). 2026-10-20 사용자 승인 시안
~/claude-viz/modern-tiles-proto/outline/src/tree.py 를 그대로 옮겼다(jp·sakura 램프만 남김, 생성 이미지 없음).

잎 덩이(손 배치) + 왼쪽 위 빛 테두리 + 잎 점묘 + 구멍 사이 가지 + 껍질 결 + 뿌리 퍼짐 + 뿌리 사이 흙 몇 점.
색은 modern3 보조 램프(ki·soil·…)와 jp_city 계약 색(pine_bamboo·machiya_timber·sakura_petal)뿐이다.
"""
import math, random
import numpy as np
from PIL import Image

RAMPS = {
    # outline, d0 (cavity), d1, mid, light, highlight
    'jp':  {'leaf': [(24, 51, 39), (37, 74, 50), (52, 99, 60), (73, 128, 76), (104, 158, 99), (145, 191, 131)],
            'bark': [(63, 42, 36), (84, 57, 46), (107, 76, 60), (135, 109, 84)],
            'soil': [(76, 48, 39), (105, 77, 56)], 'tuft': (104, 158, 99)},
    'sakura': {'leaf': [(76, 48, 39), (107, 67, 80), (149, 99, 115), (191, 140, 153), (221, 178, 184), (242, 214, 214)],
               'bark': [(63, 42, 36), (84, 57, 46), (107, 76, 60), (135, 109, 84)],
               'soil': [(76, 48, 39), (105, 77, 56)], 'tuft': (104, 158, 99)},
}
LX, LY = -0.6, -0.8   # light from top-left

def h2(x, y, s):
    v = math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453
    return v - math.floor(v)

def line_(p, q):
    n = int(max(abs(q[0] - p[0]), abs(q[1] - p[1])))
    if n == 0: return [p]
    return [(int(round(p[0] + (q[0] - p[0]) * i / n)), int(round(p[1] + (q[1] - p[1]) * i / n))) for i in range(n + 1)]

def draw_tree(W, H, ramp, seed=1, canopy_top=2, canopy_bot=None, trunk_w=4, clumps=None, spread=1.0, shape='round', limbs=None):
    R = RAMPS[ramp]; rnd = random.Random(seed)
    leaf, bark = R['leaf'], R['bark']
    img = np.zeros((H, W, 4), np.uint8)
    lvl = -np.ones((H, W), int)          # canopy level grid
    cx = W / 2
    base = H - 4                         # ground line of trunk
    if canopy_bot is None: canopy_bot = int(H * 0.68)
    # ---- canopy mass: big ellipse; clumps on a jittered grid inside + bumps on the rim
    mcx, mcy = cx, (canopy_top + canopy_bot) / 2
    mrx, mry = (W / 2 - 2.5) * spread, (canopy_bot - canopy_top) / 2
    mrx = min(mrx, W / 2 - 3)
    PROF = {
        'round': lambda t: math.sqrt(max(0.0, 1 - (2 * t - 1) ** 2)),
        'vase': lambda t: (0.55 + 0.45 * math.sin(math.pi * min(1, t / 0.7) * 0.5) ** 0.7) * (1 if t < 0.72 else max(0.0, 1 - (t - 0.72) / 0.28) ** 0.6 * 0.85 + 0.15) if t > 0.02 else 0.4,
        'umbrella': lambda t: (min(1.0, (t / 0.42)) ** 0.45) * (1 if t < 0.8 else max(0.0, 1 - (t - 0.8) / 0.2) ** 0.5 * 0.7 + 0.3),
    }
    prof = PROF[shape]
    def hw(y):
        t = (y - canopy_top) / max(1, canopy_bot - canopy_top)
        return 0 if t < 0 or t > 1 else mrx * prof(t)
    if clumps is not None:   # hand-placed clumps (x, y, r) -> (x, y, rx, ry, depth)
        clumps = [(x, y, r * 1.06, r * 0.82, (y - canopy_top) / max(1, canopy_bot - canopy_top)) for (x, y, r) in clumps]
    if clumps is None:
        clumps = []
        sp = 7.0 if W <= 32 else 8.6
        y = canopy_top + 4.5; row = 0
        while y < canopy_bot - 3:
            w = max(0.0, hw(y) - 4.5)
            x = mcx - w + (sp / 2 if row % 2 else 0)
            while x <= mcx + w + 0.5:
                jx, jy = rnd.uniform(-1.4, 1.4), rnd.uniform(-1.2, 1.2)
                r = rnd.uniform(4.6, 5.8) * (1.0 if W <= 32 else 1.18)
                clumps.append((x + jx, y + jy, r, r * 0.86, (y - canopy_top) / max(1, canopy_bot - canopy_top)))
                x += sp
            y += sp * 0.78; row += 1
        # rim lobes along the profile edge: lobed silhouette, not an oval
        yy = canopy_top + 3.5
        while yy < canopy_bot - 2:
            for side in (-1, 1):
                rr = rnd.uniform(3.8, 5.0) * (1.0 if W <= 32 else 1.12)
                x = mcx + side * max(0.0, hw(yy) - rr * 0.45)
                clumps.append((x + rnd.uniform(-0.8, 0.8), yy, rr, rr * 0.86, (yy - canopy_top) / max(1, canopy_bot - canopy_top)))
            yy += rnd.uniform(7.0, 8.5) if W > 32 else rnd.uniform(6.0, 7.0)
        nt = 3 if W > 32 else 2
        for k in range(nt):     # crown top lobes
            x = mcx - hw(canopy_top + 6) * 0.55 + k * (hw(canopy_top + 6) * 1.1 / (nt - 1))
            rr = rnd.uniform(4.2, 5.2) * (1.0 if W <= 32 else 1.12)
            clumps.append((x + rnd.uniform(-1, 1), canopy_top + rr * 0.9 + rnd.uniform(0, 1.5), rr, rr * 0.86, 0.0))
        nsk = 3 if W > 32 else 2
        for k in range(nsk):                    # lower skirt lobes
            w = hw(canopy_bot - 5)
            x = mcx - w * 0.7 + k * (w * 1.4 / max(1, nsk - 1))
            rr = rnd.uniform(4.2, 5.2) * (1.0 if W <= 32 else 1.1)
            clumps.append((x + rnd.uniform(-1, 1), canopy_bot - rr * 0.8, rr, rr * 0.8, 0.95))
    # ---- trunk + roots
    tw = trunk_w
    ttop = canopy_bot - 6
    def put(x, y, c, grid=None):
        if 0 <= x < W and 0 <= y < H:
            img[y, x, :3] = c; img[y, x, 3] = 255
    for y in range(ttop, base + 1):
        k = max(0.0, (y - (base - 7)) / 7.0)
        w = tw + int(round(k * k * 7))                      # continuous flare into the roots
        x0 = int(round(cx - w / 2))
        for x in range(x0, x0 + w):
            j = (x - x0) / max(1, w - 1)
            c = bark[3] if j < 0.2 else bark[2] if j < 0.62 else bark[1]
            # bark ridges: broken vertical dark lines, light flecks on the lit side
            if 0 < x - x0 < w - 1 and (x - x0) % 3 == 2 and h2(x, y // 2, seed) > 0.35: c = bark[1] if j < 0.62 else bark[0]
            if j < 0.35 and h2(x, y, seed + 3) > 0.86: c = bark[3]
            put(x, y, c)
        put(x0 - 1, y, bark[0]); put(x0 + w, y, bark[0])
    tw0 = tw
    def half_at(y):
        k = max(0.0, (y - (base - 7)) / 7.0); return (tw0 + int(round(k * k * 7))) / 2
    # roots: tapered polylines spreading down-outward (hand-specified, mirrored with variation)
    ROOTS = [([(0, -3), (2, -2), (4, -1), (6, 0), (8, 1), (9, 1)], 2),
             ([(0, 0), (1, 1), (3, 2), (5, 2)], 1),
             ([(0, -1), (1, 0), (2, 1)], 1)]
    for side in (-1, 1):
        for k, (pts, th) in enumerate(ROOTS):
            y0r = base + pts[0][1]
            xr = int(round(cx + half_at(min(y0r, base)))) - 1 if side > 0 else int(round(cx - half_at(min(y0r, base))))
            sc = 1.0 if side > 0 else 0.8 + 0.3 * rnd.random()
            pts2 = [(xr + side * int(round(px * sc)), base + py) for px, py in pts]
            n = 0
            for (p0, p1) in zip(pts2, pts2[1:]):
                for (x, y) in line_(p0, p1):
                    t = th if n < 4 else 1
                    for q in range(t):
                        put(x, y - q, bark[3] if q == t - 1 and n % 3 == 0 else bark[2] if q == t - 1 else bark[1])
                    if y + 1 < H and img[y + 1, x, 3] == 0 and (n % 2 == 0 or n > 4): put(x, y + 1, bark[0])
                    n += 1
    # a few trodden-soil pixels between the roots (no plate)
    for x in range(int(cx - tw), int(cx + tw) + 1):
        if 0 <= x < W and img[base + 1, x, 3] == 0 and h2(x, 2, seed) > 0.35:
            put(x, base + 1, R['soil'][0])
    # ---- branches (drawn before canopy, re-revealed in cavities)
    fork = (cx, ttop + 1)
    branches = []
    for (x, y, rx, ry, depth) in clumps:
        if 0.35 < depth < 0.85 and rnd.random() < 0.45:
            branches.append((fork, (x + rnd.uniform(-1, 1), y + ry * 0.2)))
    def line(p, q):
        n = int(max(abs(q[0] - p[0]), abs(q[1] - p[1]))) + 1
        return [(int(round(p[0] + (q[0] - p[0]) * i / n)), int(round(p[1] + (q[1] - p[1]) * i / n))) for i in range(n + 1)]
    branch_px = set()
    for p, q in branches:
        for k, (x, y) in enumerate(line(p, q)):
            branch_px.add((x, y))
            if k < 6: branch_px.add((x + 1, y))
    # visible limbs (hand-placed polylines from the trunk top), canopy paints over their upper part
    for pts in (limbs or []):
        n = 0
        for (p0, p1) in zip(pts, pts[1:]):
            for (x, y) in line_(p0, p1):
                t = 2 if n < 5 else 1
                for q in range(t):
                    put(x + q, y, bark[2] if q == 0 else bark[1])
                if x - 1 >= 0 and img[y, x - 1, 3] == 0: put(x - 1, y, bark[0])
                if x + t < W and img[y, x + t, 3] == 0: put(x + t, y, bark[0])
                n += 1
    # ---- canopy clumps: every pixel belongs to the front-most (lowest) clump that covers it
    owner = -np.ones((H, W), int)
    order = sorted(range(len(clumps)), key=lambda i: clumps[i][1])
    for i in order:
        x0, y0, rx, ry, depth = clumps[i]
        for y in range(int(y0 - ry - 2), int(y0 + ry + 3)):
            for x in range(int(x0 - rx - 2), int(x0 + rx + 3)):
                if not (0 <= x < W and 0 <= y < H): continue
                u, v = (x + 0.5 - x0) / rx, (y + 0.5 - y0) / ry
                if u * u + v * v <= 1.0 + (h2(x, y, seed + i) - 0.5) * 0.8 + (h2(x // 2, y // 2, seed + 2 * i) - 0.5) * 0.4:
                    owner[y, x] = i
    for y in range(H):
        for x in range(W):
            i = owner[y, x]
            if i < 0: continue
            x0, y0, rx, ry, depth = clumps[i]
            u, v = (x + 0.5 - x0) / rx, (y + 0.5 - y0) / ry
            d2 = min(u * u + v * v, 1.0)
            nz = math.sqrt(1 - d2)
            cdot = (u * LX + v * LY) * 0.75 + nz * 0.15            # clump's own roundness (kept soft: not a ball)
            mu, mv = (x + 0.5 - mcx) / mrx, (y + 0.5 - mcy) / mry
            mdot = (mu * LX + mv * LY)                              # whole-crown light
            val = 0.42 + 0.50 * cdot + 0.30 * mdot
            val += (h2(x // 2 + (y // 2) % 2, y // 2, seed * 3 + i) - 0.5) * 0.14 + (h2(x, y, seed * 7) - 0.5) * 0.06
            L = 0 if val < 0.12 else 1 if val < 0.28 else 2 if val < 0.44 else 3 if val < 0.60 else 4
            if v > 0.55 and d2 > 0.6: L = min(L, 1 if mdot > 0.2 else 0)   # clump underside -> crease
            lvl[y, x] = L
    # rim light on the top-left edge of each clump where it overlaps a clump behind / sky
    for y in range(1, H):
        for x in range(1, W):
            i = owner[y, x]
            if i < 0: continue
            x0, y0, rx, ry, depth = clumps[i]
            u, v = (x + 0.5 - x0) / rx, (y + 0.5 - y0) / ry
            if (u * LX + v * LY) > 0.35 and (owner[y - 1, x] != i or owner[y, x - 1] != i):
                mu, mv = (x + 0.5 - mcx) / mrx, (y + 0.5 - mcy) / mry
                if (mu * LX + mv * LY) > -0.35:
                    lvl[y, x] = 5 if (mu * LX + mv * LY) > 0.25 and h2(x, y, seed + 11) > 0.3 else 4
    # crunchy leaf texture (beodeul-like speckle): single / paired pixels one step lighter on the
    # lit side, one step darker on the shade side
    base_l = lvl.copy()
    for y in range(H):
        for x in range(W):
            L = base_l[y, x]
            if L < 1 or L > 4: continue
            mu, mv = (x + 0.5 - mcx) / mrx, (y + 0.5 - mcy) / mry
            md = mu * LX + mv * LY
            r = h2(x, y, seed * 13)
            if r < 0.24 + 0.12 * md and L < 4:
                lvl[y, x] = L + 1
                if h2(x, y, seed * 17) > 0.5 and x + 1 < W and base_l[y, x + 1] == L: lvl[y, x + 1] = L + 1
            elif r > 0.82 - 0.08 * md:
                lvl[y, x] = L - 1
    # cavities: a few dark pockets in the lower half where a branch shows
    pockets = [c for c in clumps if 0.45 < c[4] < 0.85]
    rnd.shuffle(pockets)
    chosen = []
    for c in pockets:
        if all(abs(c[1] - d[1]) > 5 and abs(c[0] - d[0]) > 6 for d in chosen): chosen.append(c)
    for (x0, y0, rx, ry, depth) in chosen[:3 if W > 32 else 1]:
        px, py = int(x0 + rx * 0.1), int(y0 + ry * 0.75)
        for dy in range(-1, 2):
            for dx in range(-2, 2):
                xx, yy = px + dx, py + dy
                if 0 <= xx < W and 0 <= yy < H and lvl[yy, xx] >= 0 and abs(dx + 0.5) + abs(dy) < 2.6:
                    lvl[yy, xx] = 0
        branches.append(((px - 1, py + 1), (px + rnd.choice([-1, 1]), py - 1)))
    branch_px = set()
    for p, q in branches:
        for k, (x, y) in enumerate(line(p, q)):
            branch_px.add((x, y))
            if k < 6: branch_px.add((x + 1, y))
    # cavities: branch pixels visible where canopy is dark
    for (x, y) in branch_px:
        if 0 <= x < W and 0 <= y < H and 0 <= lvl[y, x] <= 1 and y > canopy_top + 6:
            lvl[y, x] = -2
            for dx in (-1, 1):
                if 0 <= x + dx < W and lvl[y, x + dx] >= 1 and h2(x, y, seed) > 0.5: lvl[y, x + dx] = 0
    # ---- paint canopy
    for y in range(H):
        for x in range(W):
            L = lvl[y, x]
            if L == -2:
                put(x, y, bark[2] if h2(x, y, 5) > 0.5 else bark[1]); continue
            if L < 0: continue
            put(x, y, leaf[L if L == 5 else L + 0] if L < 5 else leaf[5])
    # level index: 0->leaf[0] would be outline colour; shift: 0 cavity uses leaf[1]
    for y in range(H):
        for x in range(W):
            L = lvl[y, x]
            if L >= 0:
                put(x, y, [leaf[1], leaf[1], leaf[2], leaf[3], leaf[4], leaf[5]][L] if L > 0 else leaf[1])
    # cavity darkest: lvl 0 -> leaf[1] already; make deep cavities (0 surrounded) the outline colour
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            if lvl[y, x] == 0 and all(lvl[y + dy, x + dx] in (0, -2) or lvl[y + dy, x + dx] == 1 for dx, dy in ((0, 1), (1, 0))) and h2(x, y, 9) > 0.45:
                put(x, y, leaf[0])
    # ---- canopy silhouette outline (sel-out: lit edge lighter)
    can = lvl != -1
    out = np.zeros_like(can)
    for y in range(H):
        for x in range(W):
            if can[y, x]:
                continue
            nb = [(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            if any(0 <= a < W and 0 <= b < H and can[b, a] for a, b in nb):
                out[y, x] = True
    for y in range(H):
        for x in range(W):
            if out[y, x] and img[y, x, 3] == 0:
                lit = (x + 1 < W and can[y, x + 1]) or (y + 1 < H and can[y + 1, x])
                lit = lit and x < cx + 2 and y < canopy_top + (canopy_bot - canopy_top) * 0.55
                put(x, y, leaf[0] if not lit else leaf[1])
    # tufts at the root
    for x in range(int(cx - W * 0.33), int(cx + W * 0.33)):
        if h2(x, 0, seed) > 0.78 and img[base + 1, x, 3] and abs(x - cx) > tw:
            put(x, base, R['tuft']); put(x, base - 1, R['tuft']) if h2(x, 1, seed) > 0.5 and img[base - 1, x, 3] == 0 else None
    return Image.fromarray(img, 'RGBA')


KEYAKI = [(9, 12, 5.5), (19, 8, 6.5), (31, 7, 6.5), (41, 12, 5.5), (6, 21, 5), (15, 18, 6), (26, 17, 6.5), (37, 19, 6), (44, 22, 4),
          (12, 28, 5), (22, 27, 6), (33, 28, 5.5), (18, 35, 4.5), (28, 35, 4.5)]
KEYAKI_LIMBS = [[(23, 47), (20, 40), (14, 31)], [(24, 47), (23, 38), (20, 30)], [(25, 47), (27, 39), (30, 31)], [(26, 47), (30, 40), (36, 32)]]
SAKURA = [(13, 13, 5.5), (24, 10, 6.5), (35, 13, 5.5), (6, 21, 5), (16, 19, 6.5), (28, 18, 6.5), (39, 21, 5.5), (44, 25, 3.5),
          (9, 29, 5.5), (20, 28, 6), (31, 28, 6), (41, 30, 5), (15, 35, 4.5), (27, 35, 5), (37, 36, 4)]
SAKURA_LIMBS = [[(23, 47), (18, 41), (10, 36)], [(24, 47), (24, 40), (22, 34)], [(25, 47), (31, 41), (39, 37)]]


def keyaki():
    """느티나무 3×4 (시안 run_tree.py 의 jp-keyaki-3x4 와 같은 인자)."""
    return draw_tree(48, 64, 'jp', seed=7, canopy_top=2, canopy_bot=41, trunk_w=5, clumps=KEYAKI, limbs=KEYAKI_LIMBS)


def sakura():
    """벚나무 3×4 (시안 run_tree.py 의 jp-sakura-3x4 와 같은 인자)."""
    return draw_tree(48, 64, 'sakura', seed=11, canopy_top=5, canopy_bot=41, trunk_w=5, clumps=SAKURA, limbs=SAKURA_LIMBS)
