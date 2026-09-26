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
    return [(x, y) for y in range(H) for x in range(W) if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 + j * rnd.random()]
m.fill(0, 0, W, H, plain)
m.cells([(x, y) for x in range(W) for y in range(H) if x + y * 0.4 > 36 + rnd.random() * 1.5], sea)
m.cells(blob(9, 6, 7, 5), dry)
m.cells(blob(24, 7, 7, 5), rock)
m.cells(blob(5, 21, 5, 4), snowf)
m.cells([c for c in blob(24, 7, 6, 4)], mount, 'up')
m.cells(blob(24, 7, 2.2, 1.6, 0), lava, 'up')
m.cells(blob(9, 5, 4, 2.5), mount2, 'up')
m.cells(blob(12, 16, 4, 3), autumn, 'up')
m.cells(blob(20, 19, 3, 2), yellow, 'up')
# river: continuous 2-wide channel from the crater foot south to the coast
path = []
for y in range(10, H):
    x = 17 + (y - 10) // 4
    path += [(x, y), (x + 1, y)]
m.cells(path, river, 'up')
m.cells([(x, 2) for x in range(0, 6)] + [(4, 3), (5, 3), (4, 4), (5, 4)], river2, 'up')
# road across the plain, crossing the river (river x=17,18 at y=13) on a horizontal bridge
road = auto('WorldMapRoad01.png')
rc = [(x, 13) for x in range(2, 17)] + [(x, 13) for x in range(19, 30)] + [(4, y) for y in range(9, 13)] + [(29, y) for y in range(14, 17)]
m.cells(rc, road, 'up')
m.image('WorldMapBridge.png', 17, 12, (96, 32, 160, 112))    # 2x2.5-cell plank bridge (source px box)
m.put(4, 8, tile('WorldMap-B.png', 1, 0))                   # town near dry mountains
m.put(29, 17, tile('WorldMap-B.png', 2, 0))                 # harbour village
m.put(2, 13, tile('WorldMap-B.png', 0, 1))                  # west gate
m.save()
