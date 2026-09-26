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
W, H = 40, 30
m = Map('m52_vx_world', 'VX 대륙 월드맵', W, H, 'exterior',
        'VX Ace A1(바다)/A2(평원·숲·산 덧칠) 오토타일을 파일 안 vx() 로 해석. 마을/성/탑 아이콘은 WorldMap-B/C/D 한 칸짜리.')
rnd = random.Random(52)
sea = vx('WorldMap-A1.png', 0, 0); shoal = vx('WorldMap-A1.png', 1, 0)
lake = vx('WorldMap-A102.png', 0, 0)
grass = vx('WorldMap-A2.png', 0, 0); sand = vx('WorldMap-A2.png', 2, 0); snow = vx('WorldMap-A2.png', 1, 2)
forest = vx('WorldMap-A2.png', 5, 0); hills = vx('WorldMap-A2.png', 4, 0); mount = vx('WorldMap-A2.png', 4, 2)
isle_grass = vx('WorldMap-A202.png', 0, 0); isle_forest = vx('WorldMap-A202.png', 5, 0)
def blob(cx, cy, rx, ry):
    return [(x, y) for y in range(H) for x in range(W) if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 + 0.18 * rnd.random()]
m.fill(0, 0, W, H, sea)
land = blob(18, 15, 14, 11); L = set(land)
m.cells(blob(18, 15, 16, 13), shoal)
m.cells(land, grass)
m.cells(blob(27, 21, 5, 3), sand)
m.cells(blob(11, 8, 5, 3), snow)
m.cells(blob(19, 19, 2.2, 1.6), lake)
m.cells([c for c in blob(10, 18, 5, 4) if c in L], forest, 'up')
m.cells([c for c in blob(21, 8, 6, 2.5) if c in L], mount, 'up')
m.cells([c for c in blob(25, 14, 3, 2) if c in L], hills, 'up')
# eastern island (A202 variant greens)
m.cells(blob(35, 7, 3.2, 3.2), shoal); isle = blob(35, 7, 2.5, 2.5); m.cells(isle, isle_grass)
m.cells([c for c in blob(36, 8, 1.4, 1.2)], isle_forest, 'up')
# place icons (single-cell world symbols)
m.put(16, 14, tile('WorldMap-B.png', 1, 0))      # town
m.put(26, 20, tile('WorldMap-B.png', 3, 0))      # desert town
m.put(13, 22, tile('WorldMap-B.png', 2, 0))      # village in forest edge
m.put(20, 12, tile('WorldMap-B.png', 5, 0))      # castle below mountains
m.put(11, 7, tile('WorldMap-B.png', 7, 0))       # snow shrine
m.put(34, 6, tile('WorldMap-C.png', 2, 0))       # island tower
m.put(23, 16, tile('WorldMap-D.png', 1, 0))      # landmark
m.save()
