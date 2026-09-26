import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

import random, math
W, H = 32, 24
m = Map('m60_ufo_crash', 'UFO 불시착 황무지', W, H, 'exterior',
        '기복 있는 황무지에 UFO 가 빛기둥을 내리고, 모아이 석상이 분화구 둘레에 제각각 서 있고, SF 원통 장치와 원형 기단, 자갈·이끼 지면, 무너진 돌담과 맵 밖으로 이어지는 도랑(Ditch02).')
rnd = random.Random(60)
ground = auto('SA-GroundY01.png'); und = auto('SA-Undulation01.png'); moss = auto('SA-Moss01.png')
stone = auto('SA-Stone01.png'); ditch = auto('SA-Ditch02.png'); fence = auto('SA-StFence02.png')
m.fill(0, 0, W, H, ground)

def organic(cx, cy, rx, ry, amp=0.28, lobes=(3, 5), seed=0):
    """blob whose radius wobbles with angle (sum of low-frequency sines) -> no ellipse/rect outline"""
    r = random.Random(seed); ph = [r.uniform(0, 6.3) for _ in lobes]; am = [r.uniform(0.5, 1) * amp for _ in lobes]
    out = set()
    for y in range(H):
        for x in range(W):
            dx, dy = (x - cx) / rx, (y - cy) / ry; a = math.atan2(dy, dx)
            k = 1 + sum(A * math.sin(n * a + p) for A, n, p in zip(am, lobes, ph))
            if dx * dx + dy * dy <= k * k: out.add((x, y))
    return out
def clean(cells, keep=()):
    """drop autotile specks: repeatedly remove cells with < 2 same-set 4-neighbours (map edge counts as same),
    and fill 1-cell holes, so the autotile never shows an odd isolated block"""
    s = set(cells)
    def nb(x, y, t): return sum(1 for q in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)) if q in t or not (0 <= q[0] < W and 0 <= q[1] < H))
    for _ in range(8):
        drop = {c for c in s if c not in keep and nb(*c, s) < 2}
        add = {(x, y) for y in range(H) for x in range(W) if (x, y) not in s and nb(x, y, s) >= 3}
        if not drop and not add: break
        s = (s - drop) | add
    return s

# ditch: 2-wide channel entering from the west edge, bending down and leaving through the south edge (no end blocks)
dch = set()
for x in range(0, 11):
    y0 = 20 + (1 if x in (4, 5, 6) else 0)
    dch |= {(x, y0), (x, y0 + 1)}
for y in range(20, H):
    x0 = 10 + (1 if y >= 22 else 0)
    dch |= {(x0, y), (x0 + 1, y)}
dch = clean(dch)
# crater (scorched undulation) around the UFO: lobed outline, a spur of ejecta to the south-east
crater = organic(15, 13, 7.5, 5.2, seed=6) | organic(21, 17, 2.6, 1.8, seed=9)
crater = clean(crater - dch)
mossc = clean(organic(4, 4, 4.2, 3.2, amp=0.3, seed=2) | organic(8, 2, 2, 1.5, seed=3))
stonec = clean((organic(27, 19, 4.2, 3.0, amp=0.3, seed=4) | organic(30, 15, 1.8, 2.2, seed=5)) - crater)
# base-ground specks left between regions join the neighbouring soft terrain (never ditch/fence); repeat to a fixed point
for _ in range(6):
    changed = False
    for y in range(H):
        for x in range(W):
            if (x, y) in crater | stonec | mossc | dch: continue
            nbs = [q for q in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)) if 0 <= q[0] < W and 0 <= q[1] < H]
            free = [q for q in nbs if q not in crater | stonec | mossc | dch]
            if len(free) + (4 - len(nbs)) >= 2: continue
            t = max((crater, stonec, mossc), key=lambda t: sum(q in t for q in nbs)); t.add((x, y)); changed = True
    c2, s2, m2 = clean(crater), clean(stonec), clean(mossc)
    changed |= (c2, s2, m2) != (crater, stonec, mossc); crater, stonec, mossc = c2, s2 - c2, m2 - c2
    if not changed: break
m.cells(mossc, moss); m.cells(crater, und); m.cells(stonec, stone); m.cells(dch, ditch)
# broken stone bank along the ditch's north side: pieces of different length, stepped, with gaps (2 rows so ends join)
fc = set()
for x0, x1, y0 in ((0, 3, 18), (5, 7, 17), (9, 10, 18)):
    fc |= {(x, y) for x in range(x0, x1 + 1) for y in (y0, y0 + 1)}
fc = clean(fc - dch)
m.cells(fc, fence)

own = {}
def claim(tag, x, y, w, h):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            assert 0 <= xx < W and 0 <= yy < H, (tag, 'off map', xx, yy)
            assert (xx, yy) not in own, (tag, 'overlaps', own.get((xx, yy)), xx, yy)
            assert (xx, yy) not in dch and (xx, yy) not in fc, (tag, 'on ditch/fence', xx, yy)
            own[(xx, yy)] = tag
# UFO hovering over the crater (7x5) with its tractor beam (3x4) centred under it (both centre at x=463/464 px)
claim('ufo', 11, 6, 7, 5); m.chip('UFO01.png', 11, 6)
claim('beam', 13, 11, 3, 4); m.image('UFO-Light01.png', 13, 11, (0, 0, 96, 128))
# moai around the crater rim: mixed kinds (1-wide grey/red/blue, 2-wide pair statue), uneven spacing, varied facing
MOAI = [(0, 0, 1), (1, 0, 1), (2, 0, 2), (4, 0, 1), (5, 0, 1), (6, 0, 2), (0, 3, 1), (1, 3, 1), (2, 3, 2), (4, 3, 1), (5, 3, 1), (6, 3, 2)]
for (sx, sy, w), (x, y) in zip((MOAI[0], MOAI[8], MOAI[4], MOAI[7], MOAI[2], MOAI[10]),
                               ((6, 8), (23, 7), (5, 13), (24, 12), (12, 17), (19, 18))):
    claim(f'moai{sx},{sy}', x, y, w, 3); m.rect('moai.png', sx, sy, w, 3, x, y)
# alien machinery: whole cylinder (sf 3,0 3x4) standing behind its round base, a second base out on the west flat
claim('cyl', 26, 2, 3, 4); m.rect('sf.png', 3, 0, 3, 4, 26, 2)
claim('base1', 26, 6, 3, 2); m.rect('sf.png', 0, 4, 3, 2, 26, 6)
claim('base2', 2, 10, 3, 2); m.rect('sf.png', 0, 6, 3, 2, 2, 10)
# onlookers south of the crater, and an owl on the mossy patch
claim('kid', 18, 21, 1, 2); m.image('SC-CTsunagi01.png', 18, 21, (32, 96, 64, 144))
claim('girl', 16, 21, 1, 2); m.image('PikoC-Girl01.png', 16, 21, (32, 96, 64, 144))
claim('owl', 3, 3, 1, 2); m.image('SC-Owl01.png', 3, 3, (32, 0, 64, 48))
OWN = own
m.save()
