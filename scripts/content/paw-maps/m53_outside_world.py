import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

from PIL import Image
class vx(auto):
    """VX/Ace A1/A2 autotile block: 64x96 unit = 32px preview + inner-corner quad (top-right) + 64x64 edge block.
    bx,by = block index in 64x96 units. Same sheet+block cells in one layer join (identity via cx/cy like tile)."""
    def __init__(self, name, bx, by):
        self.name = name; self.cx, self.cy = bx, by; self.ox, self.oy = bx * 64, by * 96; sheet(name)
    def image(self, mask):
        s = sheet(self.name); o = Image.new('RGBA', (32, 32))
        n, e, so, w = mask & 1, mask & 2, mask & 4, mask & 8
        for q in range(4):
            right, bottom = q % 2, q // 2
            v = so if bottom else n; h = e if right else w
            dg = mask & ((32 if right else 64) if bottom else (16 if right else 128))
            if v and h and not dg: sx, sy = 32 + right * 16, bottom * 16
            else:
                col = (1 if h else 3) if right else (2 if h else 0)
                row = (1 if v else 3) if bottom else (2 if v else 0)
                sx, sy = col * 16, 32 + row * 16
            o.alpha_composite(s.crop((self.ox + sx, self.oy + sy, self.ox + sx + 16, self.oy + sy + 16)), (right * 16, bottom * 16))
        return o

import random
W, H = 36, 26
m = Map('m53_outside_world', '화산 협곡 월드맵', W, H, 'exterior',
        'mod_outside1 Autotile-WorldMap* 는 XP(96x128)가 아닌 VX 64x96 블록 배열이라 파일 안 vx() 로 해석. 길(WorldMapRoad01)은 auto(), 다리는 픽셀 상자.')
rnd = random.Random(53)
S = 'Autotile-WorldMapSimple.png'
sea = vx(S, 0, 0); plain = vx(S, 3, 0); dry = vx(S, 4, 0); rock = vx(S, 3, 1); snowf = vx(S, 4, 2)
mount = vx('Autotile-WorldMapMontain01.png', 0, 0); mount2 = vx('Autotile-WorldMapMontain01.png', 1, 0)
autumn = vx('Autotile-WorldMapTree01.png', 0, 0); yellow = vx('Autotile-WorldMapTree01.png', 1, 0)
river = vx('Autotile-WorldMapRiver01.png', 0, 0); river2 = vx('Autotile-WorldMapRiver02.png', 0, 0)
lava = vx('Autotile-WorldMapLava.png', 0, 0)
def blob(cx, cy, rx, ry, j=0.2):
    return {(x, y) for y in range(H) for x in range(W) if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 + j * rnd.random()}
N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
def clean(cells, inside=None, keep=()):
    """autotile cells with < 2 same-family 4-neighbours (map edge counts) render as lone odd blocks: drop them,
    fill 1-cell holes, repeat to a fixed point"""
    s = set(cells) if inside is None else set(cells) & set(inside)
    def nb(x, y): return sum(1 for dx, dy in N4 if (x + dx, y + dy) in s or not (0 <= x + dx < W and 0 <= y + dy < H))
    for _ in range(10):
        drop = {c for c in s if c not in keep and nb(*c) < 2}
        add = {(x, y) for y in range(H) for x in range(W) if (x, y) not in s and (inside is None or (x, y) in inside) and nb(x, y) >= 3}
        if not drop and not add: break
        s = (s - drop) | add
    return s
ALL = {(x, y) for y in range(H) for x in range(W)}
seac = clean({(x, y) for x, y in ALL if x + y * 0.4 > 36 + rnd.random() * 1.5})
land = ALL - seac
dryc = clean(blob(9, 6, 7, 5) & land); rockc = clean(blob(24, 7, 7, 5) & land - dryc)
snowc = clean(blob(4, 22, 4, 3) & land - dryc)
for _ in range(6):   # plain-ground specks squeezed between regions join the neighbouring region
    plainc = land - dryc - rockc - snowc; moved = False
    for x, y in sorted(plainc):
        nbs = [(x + dx, y + dy) for dx, dy in N4]
        if sum(1 for q in nbs if q in plainc or not (0 <= q[0] < W and 0 <= q[1] < H)) >= 2: continue
        t = max((dryc, rockc, snowc), key=lambda t: sum(q in t for q in nbs)); t.add((x, y)); moved = True
    if not moved: break
m.fill(0, 0, W, H, plain); m.cells(seac, sea); m.cells(dryc, dry); m.cells(rockc, rock); m.cells(snowc, snowf)

# river (1 cell wide, 4-connected): springs under the NW range, meanders east through the plain, runs a straight
# east-west reach at x=20..22 (bridge), then winds south-east into the sea. Its source end is hidden under mountains.
RP = [(11, y) for y in range(6, 11)] + [(12, 10), (12, 11), (13, 11), (14, 11), (14, 12), (15, 12), (16, 12), (17, 12),
      (17, 13), (18, 13), (19, 13), (20, 13), (21, 13), (22, 13), (23, 13), (23, 14), (24, 14), (25, 14), (25, 15),
      (26, 15), (27, 15), (27, 16), (28, 16), (28, 17), (29, 17), (30, 17), (31, 17), (32, 17), (33, 17)]
k = next(i for i, c in enumerate(RP) if c in seac)
riverc = RP[:k + 1]                        # stop one cell into the sea: the mouth opens onto sea water
assert all(c in land for c in riverc[:-1]), 'river must stay on land until its mouth'
m.cells(riverc, river, 'up')
stream = [(x, 2) for x in range(0, 6)] + [(5, 3), (6, 3), (6, 4)]   # west-edge stream flowing out of the NW range
m.cells(stream, river2, 'up')
# mountains / lava / forests over the ground (painted after the rivers so the springs start under the peaks)
wet = set(riverc) | set(stream)
mountc = clean(blob(24, 7, 6, 4) & rockc)
m.cells(mountc, mount, 'up'); m.cells(clean(blob(24, 7, 2.2, 1.6, 0) & mountc), lava, 'up')
m2c = clean(blob(9, 5, 4, 2.5) & dryc); m.cells(m2c, mount2, 'up')
assert (11, 6) in m2c and (6, 4) in m2c, 'river/stream springs must sit under mountains'
autc = clean(blob(10, 14, 3.2, 2.2) & land - wet - snowc); m.cells(autc, autumn, 'up')
yelc = clean(blob(16, 21, 3, 2) & land - wet - snowc); m.cells(yelc, yellow, 'up')
# road: west gate -> east along y=18 -> north along x=21 over the bridge to the volcano-foot village;
# branch north to the town; branch east to the harbour village on the coast
road = auto('WorldMapRoad01.png')
rc = [(x, 18) for x in range(2, 30)] + [(21, y) for y in range(14, 18)] + [(4, y) for y in range(8, 18)]   # ends run under the icons / bridge
blocked = wet | mountc | m2c | autc | yelc | seac
assert not [c for c in rc if c in blocked], ('road on water/mountain/forest', [c for c in rc if c in blocked])
m.cells(rc, road, 'up')
# WorldMapBridge.png vertical plank bridge: planks x28-68 (centre 48) y28-108, railed deck y50-88.
# box (0,22,96,118) at cell (20,12): bridge centred on column 21, deck on row 13 (river reach 20..22,13).
assert all((x, 13) in riverc for x in (20, 21, 22))
m.image('WorldMapBridge.png', 20, 12, (0, 22, 96, 118))
for (x, y), t in (((4, 8), tile('WorldMap-B.png', 1, 0)),     # town under the dry mountains
                  ((29, 18), tile('WorldMap-B.png', 2, 0)),    # harbour village on the coast
                  ((21, 11), tile('WorldMap-B.png', 2, 0)),    # village at the volcano foot
                  ((2, 18), tile('WorldMap-B.png', 0, 1))):    # west gate
    assert (x, y) in land and (x, y) not in blocked, ('icon off land', x, y)
    assert (x, y) in rc or (x, y) == (21, 11), ('icon not on the road', x, y)   # (21,11) sits at the bridge's north end
    m.put(x, y, t)
m.save()
