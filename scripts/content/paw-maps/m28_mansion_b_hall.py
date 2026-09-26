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
def wl(name, ids):
    """wall-face rows (top->bottom) as tiles of one sheet, for m.layout(walls=...)"""
    return [tile(name, t) for t in ids]
def claim(m, x, y, w, h, wall, label):
    """checks on m.cls (set by m.layout): in bounds, never on ceiling 'C' or doorway 'D', wall-mounted fully on wall face 'W',
    standing base row on floor 'F', no overlap per layer"""
    occ = m.__dict__.setdefault('occ', {})
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            assert 0 <= xx < m.w and 0 <= yy < m.h, ('out of map', label, xx, yy)
            c = m.cls[yy][xx]
            assert c not in 'CD', ('on ceiling/doorway', label, xx, yy, c)
            if wall: assert c == 'W', ('wall item off wall face', label, xx, yy)
            k = (xx, yy, wall); assert k not in occ, ('overlap', label, xx, yy, occ[k]); occ[k] = label
    if not wall:
        for xx in range(x, x + w): assert m.cls[y + h - 1][xx] == 'F', ('standing base not on floor', label, xx, y + h - 1)
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
def finish(m):
    """every doorway and every free floor cell must be reachable on foot (floor/door cells not under standing furniture)"""
    occ = m.__dict__.get('occ', {})
    free = {(x, y) for y in range(m.h) for x in range(m.w) if m.cls[y][x] in 'FD' and (x, y, False) not in occ}
    doors = sorted(p for p in free if m.cls[p[1]][p[0]] == 'D')
    assert doors, ('no doorway', m.id)
    seen, st = {doors[0]}, [doors[0]]
    while st:
        a, b = st.pop()
        for q in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
            if q in free and q not in seen: seen.add(q); st.append(q)
    rest, big = free - seen, []
    while rest:                                    # 1-2 cell pockets beside chairs/tables are natural; larger dead floor is not
        comp, st = set(), [rest.pop()]
        while st:
            p = st.pop(); comp.add(p)
            for q in ((p[0] + 1, p[1]), (p[0] - 1, p[1]), (p[0], p[1] + 1), (p[0], p[1] - 1)):
                if q in rest: rest.discard(q); st.append(q)
        if len(comp) > 2 or any(m.cls[y][x] == 'D' for x, y in comp): big += sorted(comp)
    assert not big, ('unreachable floor/doorway', m.id, big[:10])
    m.save()

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

S = 'ST-MsionB-I01.png'
m = Map('m28_mansion_b_hall', '저택 B 대응접실과 손님 침실', 18, 14, 'interior', 'B 청색 저택: 서쪽 홀(벽난로 벽감·응접석·피아노), 동쪽 ㄱ자 손님 침실, 칸막이 북단 통로 (12,5), 남문 x6')
# Hall: the fireplace sits in a chimney-breast recess (north wall one row deeper at x4-8); the SW corner is notched.
# The hall/guest partition (x12) rises from the south wall to row 6; the passage is (12,5).
# Guest room is L-shaped: its SW corner (x13-14, rows 11-12) is a dressing-closet mass.
rows = ['##################',
        '####.....#########',
        '#................#',
        '#................#',
        '#................#',
        '#............bbbb#',
        '#...rrrrr...#bbbb#',
        '#...rrrrr...#bbbb#',
        '#...rrrrr...#bbbb#',
        '#...rrrrr...#bbbb#',
        '#...rrrrr...#bbbb#',
        '##..........###bb#',
        '##..........###bb#',
        '######D###########']
m.layout(rows, {'.': tile(S, 0), 'r': auto('SA-Carpet08.png'), 'b': auto('SA-Carpet15.png')}, auto('SA-Wall01.png'), wl(S, [17, 17, 25]))
R(m, S, 'msion-b-arched-window', 1, 2); R(m, S, 'msion-b-fireplace', 5, 2); R(m, S, 'msion-b-arched-window', 9, 2)
R(m, S, 'msion-b-grand-clock', 4, 2)
R(m, S, 'msion-b-grand-piano', 1, 6)
R(m, S, 'msion-b-sofa-front', 5, 6); R(m, S, 'msion-b-coffee-table', 5, 8); R(m, S, 'msion-b-sofa-back', 5, 9)
R(m, S, 'msion-b-harp', 10, 6); R(m, S, 'msion-b-doll', 11, 6); R(m, S, 'msion-b-glass-cabinet', 10, 9)
R(m, S, 'msion-b-vase-pedestal', 2, 11); R(m, S, 'msion-b-writing-desk', 9, 11)
R(m, S, 'msion-b-blue-curtain-window', 13, 2); R(m, S, 'msion-b-canopy-bed', 15, 2)
R(m, S, 'msion-b-vanity', 16, 6)
R(m, S, 'msion-b-plant', 16, 10); R(m, S, 'msion-b-dresser', 13, 9)
finish(m)
