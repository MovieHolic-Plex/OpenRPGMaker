import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

CEIL = auto('SA-WallA01.png')
def door(m, name, x, y, fw=32, fh=64):
    """closed frame 0 of a PAW door sprite sheet at cell (x,y); bottom row sits on the wall base"""
    m.image(name, x, y, (0, 0, fw, fh))

# --- VX Ace helpers (A2 floor autotiles 64x96 blocks, A4 wall top 64x96 + wall face 64x64 blocks) ---
from PIL import Image as _I
_QX = (0, 1, 2, 1, 2, 3)          # XP 6-quarter index -> VX 4-quarter index (outer, mid, mid, mid, mid, outer)
def _vx_to_xp(src, ox, oy):
    """rebuild an XP 96x128 autotile from a VX 64x96 block at (ox,oy): inner corners + 3x3 frame"""
    out = _I.new('RGBA', (96, 128))
    out.alpha_composite(src.crop((ox, oy, ox + 32, oy + 32)), (0, 0))              # single/preview
    out.alpha_composite(src.crop((ox + 32, oy, ox + 64, oy + 32)), (64, 0))        # inner corners
    for qy in range(6):
        for qx in range(6):
            sx, sy = ox + _QX[qx] * 16, oy + 32 + _QX[qy] * 16
            out.alpha_composite(src.crop((sx, sy, sx + 16, sy + 16)), (qx * 16, 32 + qy * 16))
    return out
class vxauto(auto):
    """VX A2/A4 autotile block (col, row in 64px-wide blocks; A2 rows are 96 tall, A4 top rows start at y=0/160/320)"""
    def __init__(self, name, bx, by_px):
        self.name, self.cx, self.cy = name, bx, by_px
        self._xp = _vx_to_xp(sheet(name), bx * 64, by_px)
    def image(self, mask): return pawlib_xp(self._xp, mask)
def pawlib_xp(img, mask):
    import pawlib; return pawlib._xp_piece(img, mask)
class vxwall(auto):
    """one tile row (k=0 top, 1 bottom) of an A4 wall face block; horizontal ends close where the run stops"""
    def __init__(self, name, bx, face_y, k):
        self.name, self.cx, self.cy, self.k, self.ox, self.fy = name, bx, face_y + k, k, bx * 64, face_y; sheet(name)
    def image(self, mask):
        s = sheet(self.name); o = _I.new('RGBA', (32, 32))
        for half in (0, 1):
            qx = (1 if mask & 2 else 3) if half else (2 if mask & 8 else 0)
            for r in (0, 1):
                qy = 2 * self.k + r
                o.alpha_composite(s.crop((self.ox + qx * 16, self.fy + qy * 16, self.ox + qx * 16 + 16, self.fy + qy * 16 + 16)), (half * 16, r * 16))
        return o

A2, A4, A5 = 'A2I-Modern01.png', 'A4I-Modern01.png', 'A5I-Modern01.png'
F, B, SS = 'BI-ModernF01.png', 'BI-ModernB01.png', 'BI-ModernS01.png'
m = Map('m46_vx_apartment', '현대식 아파트 (VX Ace 샘플 타일)', 20, 14, 'interior', 'A2 마루·주방 타일, A4 벽, 서쪽 침실·중앙 거실·동쪽 주방; VX A2/A4 는 맵 안 변환기로 XP 규격화')
# bedroom (x1..3) behind a partition stub (x4, rows 5-7 open to the living room); living room with
# the TV wall; kitchen to the east under a lower wall (bathroom block in the NE), SW entry notch.
rows = ['####################',
        '#...........########',
        '#...........########',
        '#...#..............#',
        '#...#..............#',
        '#..................#',
        '#..................#',
        '#..................#',
        '#..................#',
        '#..................#',
        '#..................#',
        '#..................#',
        '##.................#',
        '#########DD#########']
WOOD, KTILE = vxauto(A2, 0, 0), vxauto(A2, 2, 96)
m.layout(rows, {'.': lambda x, y: KTILE if x >= 13 else WOOD}, vxauto(A4, 0, 0),
         [vxwall(A4, 0, 96, 0), vxwall(A4, 0, 96, 1)])
m.fill(5, 8, 5, 4, vxauto(A2, 4, 0))                      # living-room rug
# bedroom (west)
m.rect(F, 8, 0, 2, 3, 1, 2)                               # bed
m.rect(F, 0, 8, 1, 2, 3, 3)                               # wardrobe against the partition stub
m.rect(F, 6, 11, 1, 2, 1, 6)                              # floor lamp
# living room
m.rect(F, 0, 10, 6, 2, 5, 1)                              # wall shelves / tv sideboard strip
m.rect(F, 11, 9, 1, 2, 11, 3)                             # plant beside the TV strip
m.rect(B, 3, 9, 3, 3, 6, 8)                               # sofa
m.rect(F, 12, 14, 2, 2, 6, 11)                            # low table
# kitchen (east)
m.rect(B, 8, 3, 3, 2, 13, 4)                              # kitchen counter
m.rect(F, 12, 10, 2, 4, 17, 3)                            # fridge
m.rect(B, 8, 9, 3, 2, 14, 8)                              # dining table
m.rect(SS, 4, 4, 1, 2, 13, 8)
m.rect(SS, 5, 4, 1, 2, 17, 8)
m.fill(9, 12, 2, 1, tile(A5, 0, 14))                      # entrance mat (floor layer, walkable)
m.save()
