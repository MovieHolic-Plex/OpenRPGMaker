import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *
import pawlib
from PIL import Image
# ---- map-local helpers (theme B copy; the shared engine is not edited) ----
class vx(auto):
    """VX A2 autotile block (64x96 at block bx,by) re-laid into XP 96x128 so pawlib's 8-neighbour join applies."""
    def __init__(self, name, bx, by=0):
        self.name, self.cx, self.cy = name, bx, by
        s = sheet(name).crop((bx * 64, by * 96, bx * 64 + 64, by * 96 + 96)); xp = Image.new('RGBA', (96, 128))
        xp.alpha_composite(s.crop((0, 0, 32, 32)), (0, 0)); xp.alpha_composite(s.crop((32, 0, 64, 32)), (64, 0))
        q = (0, 1, 2, 1, 2, 3)
        for r in range(6):
            for c in range(6): xp.alpha_composite(s.crop((q[c] * 16, 32 + q[r] * 16, q[c] * 16 + 16, 48 + q[r] * 16)), (c * 16, 32 + r * 16))
        self._xp = xp
    def image(self, mask): return pawlib._xp_piece(self._xp, mask)
def plan(m, rows, mats, ceil, wall_sheet, walls):
    """rows: '#' ceiling autotile, 'D' open doorway (no wall face), other chars -> mats[c] (lower layer).
    Wall faces (len(walls) rows) drop under every ceiling cell whose south cell is open; they stop at the next '#'."""
    m.grid, m.wallc, m.occ = rows, set(), {}
    for y, r in enumerate(rows):
        assert len(r) == m.w, ('row width', y, len(r))
        for x, c in enumerate(r):
            v = ceil if c == '#' else mats[mats.get('D') and c or ('.' if c == 'D' else c)]
            m.cells([(x, y)], v(x, y) if callable(v) else v)
    for x in range(m.w):
        for y in range(1, m.h):
            if rows[y][x] not in '#D' and rows[y - 1][x] == '#':
                k = 0; ws = walls(x) if callable(walls) else walls
                while k < len(ws) and y + k < m.h and rows[y + k][x] not in '#D':
                    wt = ws[k] if not isinstance(ws[k], int) else tile(wall_sheet(x) if callable(wall_sheet) else wall_sheet, ws[k])
                    m.cells([(x, y + k)], wt); m.wallc.add((x, y + k)); k += 1
def claim(m, x, y, w, h, wall, label):
    """checks: in bounds, no '#'/doorway cell, standing bottom row on floor, wall-mounted fully on wall face, no overlap per layer"""
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            assert 0 <= xx < m.w and 0 <= yy < m.h and m.grid[yy][xx] not in '#D', ('blocked cell', label, xx, yy)
            if wall: assert (xx, yy) in m.wallc, ('wall item off wall', label, xx, yy)
            k = (xx, yy, wall); assert k not in m.occ, ('overlap', label, xx, yy, m.occ[k]); m.occ[k] = label
    if not wall:
        for xx in range(x, x + w): assert (xx, y + h - 1) not in m.wallc, ('standing base on wall', label, xx)
def place(m, name, sx, sy, w, h, x, y, wall=False, label=''):
    claim(m, x, y, w, h, wall, label or name); m.rect(name, sx, sy, w, h, x, y)
def obj(m, name, box, x, y, wall=False, label=''):
    """whole object by pixel box (odd-sized chip art): occupies ceil(w/32) x ceil(h/32) cells, centred, bottom-aligned"""
    x0, y0, x1, y1 = box; w, h = -(-(x1 - x0) // 32), -(-(y1 - y0) // 32)
    claim(m, x, y, w, h, wall, label or name)
    m.over.append((x * 32 + (w * 32 - (x1 - x0)) // 2, y * 32 + h * 32 - (y1 - y0), sheet(name).crop(box))); m.used.add(name)
def R(m, name, rid, x, y):
    r = CATALOG['recipes'][name][rid]; q = r['rect']
    place(m, name, q['x'], q['y'], q['width'], q['height'], x, y, r['kind'] == 'wall-mounted', rid)
def door(m, name, x, y, col=0):
    """first (closed) frame of a 4x4-frame door sheet (32 x 64 per frame) on two wall-face rows"""
    fw = sheet(name).width // 4; fh = sheet(name).height // 4
    claim(m, x, y, 1, 2, True, name)
    m.image(name, x, y, (col * fw, 0, col * fw + fw, fh))

def stamp(name, sx, sy, w, h):
    """repeating lower-layer pattern of a w x h block of sheet tiles (e.g. tatami 2x3): returns f(x,y)->tile"""
    return lambda x, y: tile(name, sx + x % w, sy + y % h)
class cut(tile):
    """a 32px cell cut at an arbitrary pixel origin (VX A4 wall-face middle strips)"""
    def __init__(self, name, px, py):
        self.name, self.px, self.py = name, px, py; self.cx, self.cy = ('c', px), py; sheet(name)
    def image(self, *_): return sheet(self.name).crop((self.px, self.py, self.px + 32, self.py + 32))
def a4(name, bx, band):
    """VX A4 wall block bx (0-7) in band 0-2: returns (ceiling autotile, [upper face, lower face])"""
    top = (0, 160, 320)[band]
    c = vx.__new__(vx); c.name, c.cx, c.cy = name, bx, band
    s = sheet(name).crop((bx * 64, top, bx * 64 + 64, top + 96)); xp = Image.new('RGBA', (96, 128))
    xp.alpha_composite(s.crop((0, 0, 32, 32)), (0, 0)); xp.alpha_composite(s.crop((32, 0, 64, 32)), (64, 0)); q = (0, 1, 2, 1, 2, 3)
    for r in range(6):
        for cc in range(6): xp.alpha_composite(s.crop((q[cc] * 16, 32 + q[r] * 16, q[cc] * 16 + 16, 48 + q[r] * 16)), (cc * 16, 32 + r * 16))
    c._xp = xp
    return c, [cut(name, bx * 64 + 16, top + 96), cut(name, bx * 64 + 16, top + 128)]

S = 'ST-Room-I01.png'
m = Map('m21_kids_bedroom', '아이 방', 14, 11, 'interior', '이층침대·옷장·책상, 가운데 놀이 러그와 장난감, 남문 x6')
rows = ['##############'] + ['#' + 'f' * 12 + '#'] * 5 + ['#ff' + 'r' * 7 + 'fff#'] * 3 + ['#' + 'f' * 12 + '#', '######D#######']
plan(m, rows, {'.': tile(S, 1), 'f': tile(S, 1), 'r': auto('SA-Carpet12.png')}, auto('SA-Wall03.png'), S, [17, 25, 33])
obj(m, 'nidanbed.png', (0, 1, 59, 109), 1, 1, label='bunk')
R(m, S, 'personal-m-wardrobe', 3, 2); R(m, S, 'personal-m-window', 5, 1); R(m, S, 'personal-m-drawers', 7, 3)
R(m, S, 'personal-m-clock', 8, 1); R(m, S, 'personal-m-desk', 9, 3); R(m, S, 'personal-m-chair-back', 10, 5)
obj(m, 'wmap.png', (6, 3, 58, 38), 11, 1, wall=True, label='worldmap')
obj(m, 'toy.png', (72, 40, 125, 82), 4, 6, label='toy-a'); obj(m, 'toy.png', (0, 0, 33, 33), 7, 7, label='toy-b')
obj(m, 'toy.png', (4, 34, 31, 72), 9, 6, label='toy-c'); obj(m, 'doll.png', (36, 13, 59, 49), 1, 7, label='doll')
obj(m, 'bear.png', (19, 18, 80, 95), 11, 6, label='bear')
m.save()
