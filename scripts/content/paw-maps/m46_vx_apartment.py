import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

CEIL = auto('SA-WallA01.png')
def room(m, sheet, walls, floor, doors=()):
    """XP ceiling ring, north wall face rows (walls = tile ids top->bottom), floor, south door gap columns."""
    m.fill(0, 0, m.w, m.h, CEIL)
    for i, t in enumerate(walls): m.fill(1, 1 + i, m.w - 2, 1, tile(sheet, t))
    top = 1 + len(walls)
    m.fill(1, top, m.w - 2, m.h - top - 1, floor)
    for x in doors: m.fill(x, m.h - 1, 1, 1, floor)
    return top
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
def vx_wall_face(m, name, bx, face_y, x, y, w):
    """A4 wall face (64x64 block = 2 tiles tall) spread over w tiles: end quarters on the ends, middles repeated"""
    s = sheet(name); ox = bx * 64
    for i in range(w):
        for half in (0, 1):
            q = 2 * i + half
            qx = 0 if q == 0 else (3 if q == 2 * w - 1 else 1 + (q + 1) % 2)
            for qy in range(4):
                m.over.append(((x + i) * 32 + half * 16, y * 32 + qy * 16, s.crop((ox + qx * 16, face_y + qy * 16, ox + qx * 16 + 16, face_y + qy * 16 + 16))))
    m.used.add(name)

A2, A4, A5 = 'A2I-Modern01.png', 'A4I-Modern01.png', 'A5I-Modern01.png'
F, B, SS = 'BI-ModernF01.png', 'BI-ModernB01.png', 'BI-ModernS01.png'
m = Map('m46_vx_apartment', '현대식 아파트 (VX Ace 샘플 타일)', 20, 14, 'interior', 'A2 마루·주방 타일, A4 벽, 서쪽 침실·중앙 거실·동쪽 주방; VX A2/A4 는 맵 안 변환기로 XP 규격화')
m.fill(0, 0, 20, 14, vxauto(A4, 0, 0))                    # ceiling
m.fill(1, 3, 18, 10, vxauto(A2, 0, 0))                    # wood floor
m.fill(13, 3, 6, 10, vxauto(A2, 2, 96))                   # kitchen tiles
m.fill(9, 13, 2, 1, vxauto(A2, 0, 0))                     # front door gap
m.fill(4, 8, 5, 4, vxauto(A2, 4, 0))                      # living-room rug
vx_wall_face(m, A4, 0, 96, 1, 1, 18)
# bedroom (west)
m.rect(F, 8, 0, 2, 3, 1, 2)                               # bed
m.rect(F, 0, 8, 1, 2, 3, 2)                               # wardrobe
m.rect(F, 6, 11, 1, 2, 1, 6)                              # floor lamp
# living room
m.rect(F, 0, 10, 6, 2, 4, 1)                              # wall shelves / tv sideboard strip
m.rect(B, 3, 9, 3, 3, 5, 8)                               # sofa
m.rect(F, 12, 14, 2, 2, 5, 11)                            # low table
m.rect(F, 11, 9, 1, 2, 10, 2)                             # plant
# kitchen (east)
m.rect(B, 8, 3, 3, 2, 13, 2)                              # kitchen counter
m.rect(F, 12, 10, 2, 4, 17, 2)                            # fridge
m.rect(B, 8, 9, 3, 2, 14, 8)                              # dining table
m.rect(SS, 4, 4, 1, 2, 13, 8)
m.rect(SS, 5, 4, 1, 2, 17, 8)
m.rect(A5, 0, 14, 1, 1, 9, 12)
m.save()
