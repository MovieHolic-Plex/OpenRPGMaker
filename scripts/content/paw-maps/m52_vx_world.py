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
    return {(x, y) for y in range(H) for x in range(W) if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 + 0.18 * rnd.random()}
N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
def ok(x, y): return 0 <= x < W and 0 <= y < H
def clean(cells, inside=None):
    """VX autotile cells with < 2 same-family 4-neighbours render as odd lone blocks: drop them, fill 1-cell holes,
    repeat to a fixed point. `inside` limits growth to a parent region."""
    s = set(cells) if inside is None else set(cells) & inside
    for _ in range(10):
        drop = {c for c in s if sum((c[0] + dx, c[1] + dy) in s for dx, dy in N4) < 2}
        add = {(x, y) for y in range(H) for x in range(W) if (x, y) not in s and (inside is None or (x, y) in inside)
               and sum((x + dx, y + dy) in s for dx, dy in N4) >= 3}
        if not drop and not add: break
        s = (s - drop) | add
    return s
def ring(cells, r=1):
    """cells within Chebyshev distance r of `cells`, excluding them (continuous shoal band)"""
    out = set()
    for x, y in cells:
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if ok(x + dx, y + dy): out.add((x + dx, y + dy))
    return out - set(cells)
m.fill(0, 0, W, H, sea)
land = clean(blob(18, 15, 14, 11))
isle = clean(blob(35, 7, 2.5, 2.5))
# shoal = unbroken band around every coast (1 cell, 2 on the exposed south/east shore)
shoal = clean(ring(land, 1) | {c for c in ring(land, 2) if c[0] > 22 or c[1] > 20} | ring(isle, 1))
m.cells(shoal, shoal_ref := vx('WorldMap-A1.png', 1, 0))
m.cells(land, grass); m.cells(isle, isle_grass)
lakec = clean(blob(19, 19, 2.2, 1.6), land)
inner = {c for c in land if all((c[0] + dx, c[1] + dy) in land for dx, dy in N4)}   # keep biomes off the coastline
sandc = clean(blob(27, 21, 5, 3) - lakec, inner)
snowc = clean(blob(11, 8, 5, 3) - lakec, inner)
m.cells(sandc, sand); m.cells(snowc, snow); m.cells(lakec, lake)
forestc = clean(blob(10, 18, 5, 4) - lakec - sandc - snowc, land)
mountc = clean(blob(21, 8, 6, 2.5) - lakec - forestc, land)
hillc = clean(blob(25, 14, 3, 2) - lakec - forestc - mountc - sandc, land)
isleforest = clean(blob(36, 8, 1.4, 1.2), isle)
m.cells(forestc, forest, 'up'); m.cells(mountc, mount, 'up'); m.cells(hillc, hills, 'up'); m.cells(isleforest, isle_forest, 'up')
over = forestc | mountc | hillc | isleforest
# place icons (single-cell world symbols) - each asserted to sit on open ground of the intended biome
def icon(x, y, t, biome):
    assert (x, y) in biome and (x, y) not in over and (x, y) not in lakec, ('icon off biome', x, y)
    m.put(x, y, t)
grassland = (land - sandc - snowc) | isle
icon(16, 14, tile('WorldMap-B.png', 1, 0), grassland)       # town on the central plain
icon(27, 21, tile('WorldMap-B.png', 3, 0), sandc)           # desert town
icon(14, 22, tile('WorldMap-B.png', 2, 0), grassland)       # village at the forest edge
icon(20, 11, tile('WorldMap-B.png', 5, 0), grassland)       # castle below the mountains
icon(11, 8, tile('WorldMap-B.png', 7, 0), snowc)            # snow shrine
icon(34, 6, tile('WorldMap-C.png', 2, 0), isle)             # island tower
icon(22, 16, tile('WorldMap-D.png', 1, 0), grassland)       # landmark
m.save()
