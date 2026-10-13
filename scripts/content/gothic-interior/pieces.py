"""gothic_manor 실내 기물 도트 — id -> (Cv 그리는 함수, 크기, 판정 종류, 설명). 3/4: 윗면(깊은 5행+ 질감 슬랩, 뒤 가장자리 어둡게)+앞면."""
import os, sys, json
sys.path.insert(0, os.path.dirname(__file__))
from glib import *

W_, S_, RD, BR, GL, BO, BL, FL, GR, NT = (R_[k] for k in ('wood', 'stone', 'red', 'brass', 'glass', 'bone', 'blood', 'flame', 'green', 'night'))
P = {}
FR = 0  # 애니메이션 프레임(0..2)
def piece(id, w, h, kind, name):
    def d(fn): P[id] = (fn, w, h, kind, name); return fn
    return d

BOOKC = [RD[3], GR[2], BR[2], NT[3], BO[2], W_[4], RD[1], GR[4]]
@piece('bookshelf', 16, 32, 'tall_furniture', 'tall wooden bookshelf full of books, dark gothic study')
def _(c):
    box3(c, 0, 0, 16, 8, 24, 'wood', 'wood', 11)
    c.HL(0, 8, 16, W_[1]); c.R(2, 9, 12, 21, W_[0])
    for sy in (9, 16, 23):
        for x in range(2, 14):
            bh = 4 + hsh(x, sy, 4) % 3; col = BOOKC[hsh(x // 2, sy, 5) % 8]
            c.R(x, sy + 7 - bh + 0, 1, bh, col); c.P(x, sy + 7 - bh, tuple(min(255, v + 30) for v in col[:3]) + (255,))
        c.HL(2, sy + 7, 12, W_[4]); c.HL(2, sy + 8, 12, W_[1])
    c.VL(1, 9, 21, W_[4])

@piece('desk', 32, 16, 'low_furniture', 'heavy wooden writing desk with papers and an ink pot')
def _(c):
    box3(c, 0, 0, 32, 9, 7, 'wood', 'wood', 21)
    c.R(4, 2, 10, 6, BO[4]); c.HL(4, 2, 10, BO[5]); c.HL(5, 4, 7, BO[2]); c.HL(5, 6, 6, BO[2])
    c.R(20, 2, 5, 3, RD[2]); c.HL(20, 2, 5, RD[4]); c.R(26, 3, 3, 3, W_[0]); c.P(27, 2, BR[4])
    c.R(3, 10, 11, 4, W_[1]); c.HL(3, 10, 11, W_[4]); c.P(8, 12, BR[4]); c.R(18, 10, 11, 4, W_[1]); c.HL(18, 10, 11, W_[4]); c.P(23, 12, BR[4])
    c.R(0, 14, 3, 2, W_[0]); c.R(29, 14, 3, 2, W_[0])

@piece('rocker', 16, 16, 'seat', 'old wooden rocking chair with a worn red cushion')
def _(c):
    for x in (2, 4, 6, 8, 10, 12): c.VL(x, 0, 6, W_[3]); c.P(x, 0, W_[5])
    c.HL(1, 0, 13, W_[4]); c.HL(2, 5, 12, W_[1])
    c.R(1, 6, 14, 5, RD[3]); c.HL(1, 6, 14, RD[2]); c.HL(2, 7, 12, RD[4]); c.speck(1, 6, 14, 5, RD[2], 25, 7)
    c.R(1, 11, 14, 2, W_[3]); c.HL(1, 11, 14, W_[5]); c.HL(1, 12, 14, W_[1])
    c.VL(3, 13, 2, W_[1]); c.VL(12, 13, 2, W_[1])
    for i in range(0, 16): c.P(i, 14 + (1 if 3 < i < 12 else 0), W_[2])
    c.HL(4, 15, 8, W_[0])

@piece('piano', 32, 32, 'tall_furniture', 'old upright piano, dark wood with a worn keyboard')
def _(c):
    box3(c, 0, 0, 32, 8, 24, 'wood', 'wood', 31)
    c.R(3, 9, 26, 8, W_[1]); c.HL(3, 9, 26, W_[4]); c.R(8, 11, 16, 4, BO[3]); c.HL(9, 12, 14, BO[1]); c.HL(9, 14, 14, BO[1])
    c.R(2, 17, 28, 3, W_[4]); c.HL(2, 17, 28, W_[5])
    c.R(3, 20, 26, 5, BO[5]);
    for x in range(3, 29, 2): c.VL(x, 20, 5, BO[2])
    for x in range(4, 28, 4):
        if (x // 4) % 7 not in (2, 6): c.R(x + 1, 20, 2, 3, W_[0])
    c.HL(3, 25, 26, W_[0]); c.R(3, 26, 3, 6, W_[1]); c.R(26, 26, 3, 6, W_[1]); c.R(13, 27, 6, 3, BR[3]); c.HL(13, 27, 6, BR[5])

@piece('candelabra', 16, 32, 'other', 'standing brass candle stand with a wide round top dish holding three lit candles, round foot')
def _(c):
    c.ell(8, 14, 7, 4, BR[1]); c.ell(8, 14, 6, 3, BR[4]); c.ell(8, 14, 4, 2, BR[3]); c.HL(4, 12, 6, BR[5]); c.speck(2, 11, 12, 7, BR[2], 18, 3)
    for cx, cy in ((4, 12), (8, 11), (12, 12)):
        c.R(cx - 1, cy - 5, 3, 6, BO[4]); c.VL(cx - 1, cy - 5, 6, BO[3]); c.HL(cx - 1, cy - 5, 3, BO[5])
        fo = (FR + cx) % 3; c.R(cx - 1, cy - 9 + (fo == 2), 3, 4 - (fo == 2), FL[3]); c.P(cx + (fo - 1), cy - 10, FL[2]); c.P(cx, cy - 11 + (fo == 2), FL[1]) if fo != 0 else None; c.VL(cx, cy - 8, 3, FL[5])
    c.R(6, 18, 4, 8, BR[3]); c.VL(6, 18, 8, BR[4]); c.VL(9, 18, 8, BR[1]); c.HL(5, 22, 6, BR[5])
    c.ell(8, 27, 7, 3, BR[3]); c.ell(8, 26, 5, 2, BR[4]); c.HL(5, 25, 4, BR[5]); c.R(1, 28, 14, 3, BR[2]); c.HL(2, 30, 12, BR[0]); c.speck(1, 25, 14, 6, BR[1], 20, 4)

@piece('chandelier', 32, 32, 'round_body', 'iron chandelier ring with candles, seen from above at an angle')
def _(c):
    c.VL(15, 0, 7, S_[3]); c.VL(16, 0, 7, S_[2])
    for y in (1, 3, 5): c.P(14, y, S_[4]); c.P(17, y, S_[4])
    c.ell(16, 16, 14, 8, S_[2]); c.ell(16, 16, 11, 6, S_[0]); c.ell(16, 16, 9, 4, S_[1])
    for i in range(0, 32):
        pass
    c.R(2, 19, 28, 3, S_[1]); c.ell(16, 18, 14, 7, S_[3]); c.ell(16, 18, 11, 5, S_[0]); c.ell(16, 18, 9, 3, S_[1])
    c.HL(7, 15, 18, S_[5]); c.speck(2, 11, 28, 14, S_[4], 18, 9)
    for cx, cy in ((3, 17), (9, 24), (16, 26), (23, 24), (29, 17), (9, 10), (23, 10)):
        c.R(cx - 1, cy - 3, 3, 4, BO[4]); c.HL(cx - 1, cy - 3, 3, BO[5]); fo = (FR + cx) % 3; c.R(cx - 1, cy - 6, 3, 3, FL[3]); c.P(cx + fo - 1, cy - 7, FL[2]); c.VL(cx, cy - 6, 2, FL[5])
    c.HL(4, 27, 24, S_[0]); c.HL(6, 28, 20, S_[0])
    dx = 0
    if dx:
        body = c.a[5:].copy(); c.a[5:] = 0
        for y in range(body.shape[0]):
            for x in range(32):
                if body[y, x, 3] and 0 <= x + dx < 32: c.a[5 + y, x + dx] = body[y, x]

def _frame(c, w, h, art):
    c.R(0, 0, w, h, BR[2]); c.R(1, 1, w - 2, h - 2, BR[3]); c.HL(0, 0, w, BR[5]); c.VL(0, 0, h, BR[4]); c.HL(0, h - 1, w, BR[0]); c.VL(w - 1, 0, h, BR[1])
    c.R(2, 2, w - 4, h - 4, BR[0]); c.R(3, 3, w - 6, h - 6, NT[1]); art(c, 3, 3, w - 6, h - 6)
    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)): c.P(x, y, BR[5])
    for x in range(w):
        for y in (0, 1, h - 2, h - 1): c.speck(x, y, 1, 1, BR[4], 25, 5)
def _art_moon(c, x, y, w, h):
    c.R(x, y, w, h, NT[2]); c.R(x, y, w, h // 3, NT[1])
    c.ell(x + w * 3 // 4, y + 3, 2, 2, BO[5])
    for i in range(w):
        hy = y + h - 3 - int(2 * abs(((i * 7) % 11) - 5) / 5) - (2 if w > 10 and 3 < i < w - 4 else 0)
        c.R(x + i, hy, 1, y + h - hy, GR[0])
    c.speck(x, y, w, h // 2, NT[4], 10, 3)
def _art_manor(c, x, y, w, h):
    c.R(x, y, w, h, NT[2]); c.R(x, y, w, h // 4, NT[1]); c.R(x, y + h - 3, w, 3, GR[0]); c.ell(x + 4, y + 3, 2, 2, BO[4])
    mx = x + w // 2 - 4; c.R(mx, y + h - 9, 9, 7, NT[0]); c.R(mx + 3, y + h - 12, 3, 4, NT[0]); c.P(mx + 2, y + h - 7, FL[3]); c.P(mx + 6, y + h - 7, FL[3])
    for q in range(4): c.P(mx + q, y + h - 9 - 0, NT[0])
@piece('frame_s', 16, 16, 'wall_mounted', 'small gilded picture frame holding a dark moonlit landscape painting')
def _(c): _frame(c, 16, 16, _art_moon)
@piece('frame_m', 32, 32, 'wall_mounted', 'medium gilded picture frame holding a dark painting of a manor under a moon')
def _(c): _frame(c, 32, 32, _art_manor)
@piece('frame_l', 48, 32, 'wall_mounted', 'large gilded picture frame holding a dark moonlit landscape painting')
def _(c): _frame(c, 48, 32, _art_moon)

@piece('plinth', 16, 32, 'column', 'square stone pedestal with a thick flat top slab seen from above, empty')
def _(c):
    box3(c, 0, 4, 16, 10, 18, 'stone', 'stone', 41)
    c.R(0, 28, 16, 4, S_[1]); c.HL(0, 28, 16, S_[4]); c.HL(0, 31, 16, S_[0])
    c.R(3, 22, 10, 1, S_[1]); c.R(5, 20, 6, 1, S_[4]); c.R(3, 7, 10, 5, S_[3]); c.HL(3, 7, 10, S_[2]); c.HL(3, 11, 10, S_[5])

@piece('glass_case', 32, 32, 'box', 'museum glass display case on a wooden base, flat glass lid showing a relic on red cloth')
def _(c):
    box3(c, 0, 0, 32, 10, 22, 'wood', 'wood', 51)
    c.R(2, 1, 28, 8, GL[2]); c.HL(2, 1, 28, GL[4]); c.R(3, 2, 26, 6, GL[1])
    c.R(5, 3, 22, 5, RD[2]); c.HL(5, 3, 22, RD[1]); c.R(12, 3, 8, 3, BO[4]); c.R(13, 2, 6, 2, BO[5]); c.R(13, 6, 6, 1, BO[2])
    for i in range(6): c.P(5 + i * 2, 2, GL[5]); c.P(27 - i, 8, GL[3])
    c.R(2, 10, 28, 10, GL[1]); c.HL(2, 10, 28, GL[3]); c.R(2, 11, 28, 8, GL[0]); c.VL(2, 10, 10, W_[5]); c.VL(29, 10, 10, W_[3])
    for q in range(4): c.P(5 + q, 18 - q, GL[3]); c.P(16 + q, 17 - q, GL[2])
    c.R(12, 14, 8, 5, RD[1]); c.R(14, 11, 4, 4, BO[3]); c.P(15, 11, BO[5])
    c.R(2, 20, 28, 2, W_[4]); c.HL(2, 20, 28, W_[5])
    c.R(1, 22, 30, 8, W_[2]); c.HL(1, 22, 30, W_[4]); c.R(3, 24, 12, 4, W_[1]); c.R(17, 24, 12, 4, W_[1]); c.P(14, 26, BR[4]); c.P(18, 26, BR[4]); c.HL(1, 30, 30, W_[0]); c.R(0, 30, 32, 2, W_[0])

@piece('cobweb', 16, 16, 'wall_mounted', 'thin grey cobweb in a wall corner, flat overlay')
def _(c):
    col = BO[4]; dim = BO[2]
    for i in range(16): c.P(i, 0, col); c.P(0, i, col)
    for r in (4, 8, 12):
        for t in range(r + 1):
            x = int(r * (t / r)); c.P(x, r - t if r - t >= 0 else 0, dim if r != 8 else col)
    for d in range(12): c.P(d, d, col)
    for d in range(8): c.P(d * 2 if d * 2 < 16 else 15, d, dim); c.P(d, d * 2 if d * 2 < 16 else 15, dim)

@piece('bathtub', 32, 32, 'container', 'old clawfoot bathtub with its inside seen from above, filled with dark blood-red water')
def _(c):
    c.R(1, 2, 30, 20, BO[4]); c.R(0, 4, 32, 16, BO[4]); c.HL(2, 2, 28, BO[5]); c.HL(1, 3, 30, BO[5]); c.VL(0, 4, 16, BO[3]); c.VL(31, 4, 16, BO[2])
    c.R(4, 6, 24, 13, BO[1]); c.R(5, 7, 22, 11, BL[2]); c.R(5, 7, 22, 3, BO[0]); c.R(6, 11, 20, 6, BL[3]); c.speck(5, 10, 22, 8, BL[4], 18, 4); c.HL(8, 13, 6, BL[5]); c.HL(18, 15, 5, BL[5])
    c.R(0, 20, 32, 7, BO[3]); c.HL(0, 20, 32, BO[5]); c.R(0, 22, 32, 5, BO[2]); c.HL(0, 26, 32, BO[1]); c.speck(0, 22, 32, 5, BL[2], 8, 6)
    for x in (3, 25): c.R(x, 27, 4, 4, BR[3]); c.R(x - 1, 30, 6, 2, BR[2]); c.VL(x, 27, 4, BR[5]); c.P(x + 3, 28, BR[0])
    c.R(0, 5, 3, 3, BO[3])

@piece('wardrobe', 16, 32, 'tall_furniture', 'tall dark wooden wardrobe with two doors, one slightly ajar')
def _(c):
    box3(c, 0, 0, 16, 7, 25, 'wood', 'wood', 61)
    c.R(2, 7, 6, 21, W_[2]); c.R(8, 7, 6, 21, W_[3]); c.VL(8, 7, 21, W_[0]); c.VL(9, 8, 19, W_[0])
    c.R(3, 9, 4, 8, W_[3]); c.R(10, 9, 3, 8, W_[4]); c.R(3, 19, 4, 6, W_[3]); c.R(10, 19, 3, 6, W_[4])
    c.HL(3, 9, 4, W_[5]); c.HL(10, 9, 3, W_[5]); c.P(7, 17, BR[4]); c.P(10, 17, BR[4])
    c.R(0, 29, 16, 3, W_[1]); c.HL(0, 29, 16, W_[4]); c.R(0, 30, 3, 2, W_[0]); c.R(13, 30, 3, 2, W_[0])

@piece('bed', 32, 32, 'low_furniture', 'old bed with a worn red blanket and pillow, dark gap under the bed')
def _(c):
    c.R(0, 1, 32, 6, W_[3]); c.HL(0, 1, 32, W_[5]); c.R(0, 3, 32, 4, W_[2]); c.speck(0, 1, 32, 6, W_[4], 20, 8)
    c.R(0, 7, 32, 15, RD[3]); c.R(2, 7, 28, 4, BO[4]); c.R(2, 7, 28, 1, BO[5]); c.R(3, 10, 26, 1, BO[2])
    c.HL(0, 7, 32, W_[1]); c.speck(0, 11, 32, 10, RD[2], 22, 3); c.speck(0, 11, 32, 10, RD[4], 14, 5)
    for x in range(0, 32, 5): c.VL(x, 14, 7, RD[2])
    c.HL(0, 21, 32, RD[4]); c.R(0, 22, 32, 4, RD[2]); c.HL(0, 25, 32, RD[0]); c.VL(0, 7, 19, W_[3]); c.VL(31, 7, 19, W_[1])
    c.R(1, 26, 30, 4, W_[0]); c.R(0, 26, 3, 6, W_[2]); c.R(29, 26, 3, 6, W_[2]); c.HL(0, 26, 3, W_[4]); c.HL(29, 26, 3, W_[4])

@piece('barrel', 16, 24, 'round_body', 'wooden barrel with iron hoops, closed round lid seen from above')
def _(c):
    c.ell(8, 5, 7, 5, W_[1]); c.ell(8, 5, 6, 4, W_[4]); c.ell(8, 5, 4, 3, W_[5]); c.speck(2, 1, 12, 9, W_[3], 22, 2); c.HL(4, 3, 5, W_[5]); c.ell(8, 6, 1, 1, W_[2])
    c.R(0, 6, 16, 15, W_[2]); c.VL(0, 6, 15, W_[3]); c.VL(1, 6, 15, W_[3]); c.VL(14, 6, 15, W_[1]); c.VL(15, 6, 15, W_[1])
    for x in (4, 8, 11): c.VL(x, 9, 12, W_[1])
    for y in (10, 17): c.HL(0, y, 16, S_[3]); c.HL(0, y + 1, 16, S_[0])
    c.ell(8, 20, 7, 3, W_[1]); c.R(1, 20, 14, 1, W_[0]); c.HL(3, 23, 10, W_[0])
    c.R(0, 0, 16, 0, (0,0,0,0))

@piece('sarcophagus', 32, 16, 'box', 'stone sarcophagus with a thick carved lid, no figure')
def _(c):
    box3(c, 0, 0, 32, 9, 7, 'stone', 'stone', 71)
    c.R(3, 2, 26, 5, S_[4]); c.HL(3, 2, 26, S_[5]); c.HL(3, 6, 26, S_[2]); c.VL(3, 2, 5, S_[5]); c.VL(28, 2, 5, S_[2])
    c.R(14, 3, 4, 1, S_[2]); c.R(15, 2, 2, 3, S_[2]); c.speck(0, 0, 32, 9, S_[2], 18, 4)
    c.R(0, 14, 32, 2, S_[0])

@piece('rug_runner', 16, 32, 'flat', 'long dark red carpet runner with a gold border, lying flat on the floor')
def _(c):
    c.R(1, 0, 14, 32, RD[2]); c.VL(1, 0, 32, BR[3]); c.VL(14, 0, 32, BR[2]); c.VL(3, 0, 32, BR[2]); c.VL(12, 0, 32, BR[1])
    for y in range(2, 30, 6): c.R(6, y, 4, 4, RD[3]); c.P(7, y + 1, BR[4]); c.P(8, y + 2, BR[3])
    c.speck(1, 0, 14, 32, RD[1], 20, 5)
    for x in range(1, 15, 2): c.P(x, 0, BR[4]); c.P(x, 31, BR[4])

@piece('armchair', 16, 20, 'seat', 'worn red velvet armchair with wooden feet, thick cushion seen from above')
def _(c):
    c.R(1, 0, 14, 5, RD[1]); c.HL(1, 0, 14, RD[3]); c.R(2, 1, 12, 3, RD[2])
    c.R(0, 3, 3, 13, RD[3]); c.R(13, 3, 3, 13, RD[2]); c.HL(0, 3, 3, RD[5]); c.HL(13, 3, 3, RD[4])
    c.R(3, 5, 10, 8, RD[4]); c.HL(3, 5, 10, RD[2]); c.HL(3, 6, 10, RD[3]); c.speck(3, 7, 10, 5, RD[5], 25, 5); c.HL(3, 12, 10, RD[5]); c.speck(3, 6, 10, 6, RD[3], 14, 6)
    c.R(3, 13, 10, 4, RD[2]); c.HL(3, 16, 10, RD[0]); c.R(1, 17, 2, 3, W_[1]); c.R(13, 17, 2, 3, W_[1])

@piece('console_table', 32, 16, 'low_furniture', 'narrow wooden console table with a small bone-white vase and a candle')
def _(c):
    box3(c, 0, 0, 32, 8, 8, 'wood', 'wood', 91)
    c.R(6, 0, 4, 5, BO[4]); c.R(5, 2, 6, 2, BO[3]); c.HL(6, 0, 4, BO[5]); c.R(22, 2, 3, 3, BO[4]); c.R(22, 0, 3, 2, FL[3]); c.P(23, 0, FL[5])
    c.HL(2, 10, 28, W_[1]); c.R(0, 14, 3, 2, W_[0]); c.R(29, 14, 3, 2, W_[0]); c.R(3, 10, 26, 4, W_[1]); c.speck(3, 10, 26, 4, W_[3], 15, 3)

@piece('crate', 16, 16, 'box', 'wooden storage crate with planks and iron corners, lid seen from above')
def _(c):
    box3(c, 0, 0, 16, 8, 8, 'wood', 'wood', 101)
    for x in (5, 10): c.VL(x, 1, 6, W_[2])
    for x, y in ((0, 8), (13, 8), (0, 13), (13, 13)): c.R(x, y, 3, 3, S_[3])
    c.HL(3, 11, 10, W_[1])

@piece('wine_rack', 32, 32, 'tall_furniture', 'wooden wine rack with rows of dark green bottle ends')
def _(c):
    box3(c, 0, 0, 32, 8, 24, 'wood', 'wood', 111)
    c.R(2, 9, 28, 20, W_[0])
    for r in range(4):
        for k in range(7):
            x = 4 + k * 4; y = 10 + r * 5
            c.ell(x + 1, y + 1, 1, 1, GR[3]); c.P(x + 1, y, GR[5]); c.P(x + 2, y + 2, GR[0])
        c.HL(2, 14 + r * 5, 28, W_[3]) if r < 3 else None
    c.R(0, 29, 32, 3, W_[1]); c.HL(0, 29, 32, W_[4])

@piece('vanity_sink', 16, 16, 'container', 'bathroom vanity with a round white basin seen from above and tarnished brass tap')
def _(c):
    c.R(0, 0, 16, 9, BO[4]); c.HL(0, 0, 16, BO[5]); c.ell(8, 5, 5, 3, BO[2]); c.ell(8, 5, 4, 2, BO[0]); c.ell(8, 6, 2, 1, BL[2]); c.P(3, 5, BO[5])
    c.R(6, 0, 4, 2, BR[3]); c.P(7, 2, BR[4])
    c.R(0, 9, 16, 7, BO[2]); c.HL(0, 9, 16, BO[3]); c.R(2, 11, 12, 4, BO[1]); c.P(8, 12, BR[4]); c.HL(0, 15, 16, BO[0])

@piece('doll', 16, 24, 'low_furniture', 'wooden toy chest with a thick flat lid seen from above, a small porcelain doll lying on the lid')
def _(c):
    box3(c, 0, 4, 16, 9, 10, 'wood', 'wood', 121)
    c.R(0, 18, 16, 2, S_[2]); c.R(0, 4, 16, 1, W_[1])
    c.R(2, 7, 5, 4, BO[5]); c.HL(2, 7, 5, BO[5]); c.P(3, 9, S_[0]); c.P(5, 9, S_[0]); c.R(7, 8, 6, 3, RD[3]); c.HL(7, 8, 6, RD[4]); c.R(13, 9, 2, 2, BO[4])
    c.P(8, 13, BR[4]); c.P(7, 13, BR[4]); c.HL(6, 12, 4, BR[3])

@piece('blood_stain', 16, 16, 'flat', 'dark red blood stain splatter on the floor, lying flat')
def _(c):
    c.ell(7, 8, 5, 4, BL[2]); c.ell(8, 8, 3, 2, BL[3]); c.P(8, 7, BL[5]); c.P(7, 8, BL[4])
    for x, y, r in ((1, 3, 1), (13, 4, 1), (12, 12, 1), (3, 13, 1), (14, 8, 0), (2, 8, 0)): c.ell(x, y, r, r, BL[2])
    for i in range(7): c.P(8 + i, 10 + i // 3, BL[1])

@piece('cracked_mirror', 16, 32, 'wall_mounted', 'tall wall mirror with a dark wooden frame and spiderweb cracks, murky glass')
def _(c):
    c.R(0, 0, 16, 32, W_[2]); c.HL(0, 0, 16, W_[5]); c.VL(0, 0, 32, W_[4]); c.VL(15, 0, 32, W_[0]); c.R(2, 2, 12, 28, GL[1]); c.R(3, 3, 10, 26, GL[2]); c.R(3, 3, 10, 5, GL[3])
    for q in range(8): c.P(4 + q, 14 - q // 2, GL[5])
    for q in range(10): c.P(7 - q // 3, 8 + q, S_[0]); c.P(8 + q // 2, 12 + q, S_[0])
    for q in range(6): c.P(8 - q, 14 + q // 2, S_[0]); c.P(9 + q, 12 - q // 2, S_[0])
    c.speck(2, 2, 12, 28, GL[4], 8, 3); c.HL(0, 31, 16, W_[0])

@piece('wall_sconce', 16, 16, 'wall_mounted', 'iron wall sconce holding a lit candle, wall mounted')
def _(c):
    c.R(6, 11, 4, 3, S_[2]); c.HL(6, 11, 4, S_[4]); c.R(3, 9, 10, 2, S_[3]); c.HL(3, 9, 10, S_[5]); c.VL(7, 13, 3, S_[1])
    c.R(6, 4, 4, 5, BO[4]); c.VL(6, 4, 5, BO[3]); c.HL(6, 4, 4, BO[5]); c.R(6, 0 + (FR == 2), 4, 4 - (FR == 2), FL[3]); c.P(7 + (FR == 1), 0, FL[2]); c.VL(8, 1, 3, FL[5]); c.P(9, 3, FL[1])

@piece('night_window', 16, 32, 'wall_mounted', 'tall arched manor window with dark blue night glass and a stone sill, wall mounted')
def _(c):
    c.R(0, 0, 16, 32, S_[3]); c.HL(0, 0, 16, S_[5]); c.VL(0, 0, 32, S_[4]); c.VL(15, 0, 32, S_[1]); c.R(2, 3, 12, 25, W_[1]); c.R(3, 4, 10, 23, (NT[5], NT[4], NT[2])[FR] if FR < 2 else NT[2]); c.R(3, 4, 10, 6, (NT[5], NT[4], NT[1])[FR])
    c.VL(8, 4, 23, W_[2]); c.HL(3, 15, 10, W_[2]); c.ell(11, 8, 1, 1, BO[5]); c.speck(3, 4, 10, 23, NT[4], 6, 2)
    for q in range(4): c.P(4 + q, 24 - q, NT[4])
    c.R(0, 28, 16, 4, S_[4]); c.HL(0, 28, 16, S_[5]); c.HL(0, 31, 16, S_[0])

@piece('fog', 32, 16, 'flat', 'faint low grey fog bank drifting along the floor, flat translucent overlay')
def _(c):
    for y in range(16):
        for x in range(32):
            n = hsh((x + FR * 3) // 2 % 16, y // 2, 7 + FR) % 7 + (3 if 5 < y < 11 else 0) - abs(y - 8) // 2
            if n > 6: c.P(x, y, (150, 160, 175, 90 if n < 9 else 130))

@piece('floor_parquet', 16, 16, 'terrain', 'dark wooden parquet floor tile, flat')
def _(c):
    c.R(0, 0, 16, 16, W_[3])
    for i in range(0, 16, 4):
        for j in range(0, 16, 8):
            o = (j // 8 + i // 4) % 2; c.R(i, j + o * 4 - (4 if o and j == 0 else 0), 4, 8, W_[3 + o]) if False else None
    for y in range(0, 16, 4):
        for x in range(16): c.P(x, y, W_[1])
    for y in range(16):
        for x in range(0, 16, 8): c.P(x + (4 if (y // 4) % 2 else 0), y, W_[1])
    c.speck(0, 0, 16, 16, W_[4], 25, 5); c.speck(0, 0, 16, 16, W_[2], 20, 6)

@piece('floor_checker', 16, 16, 'terrain', 'cold black and grey marble checker floor tile, flat')
def _(c):
    for j in range(2):
        for i in range(2): c.R(i * 8, j * 8, 8, 8, S_[4] if (i + j) % 2 == 0 else S_[1])
    c.speck(0, 0, 16, 16, S_[5], 12, 3); c.speck(0, 0, 16, 16, S_[0], 14, 4); c.HL(0, 0, 16, S_[2]); c.VL(0, 0, 16, S_[2])

@piece('floor_cellar', 16, 16, 'terrain', 'rough dark flagstone cellar floor tile, flat')
def _(c):
    c.R(0, 0, 16, 16, S_[2])
    for x, y, w, h in ((0, 0, 9, 7), (9, 0, 7, 5), (0, 7, 6, 9), (6, 7, 10, 9), (9, 5, 7, 2)): c.R(x, y, w, h, S_[3]); c.HL(x, y, w, S_[4]); c.VL(x, y, h, S_[4]); c.HL(x, y + h - 1, w, S_[1]); c.VL(x + w - 1, y, h, S_[1])
    c.speck(0, 0, 16, 16, S_[1], 20, 3); c.speck(0, 0, 16, 16, GR[1], 6, 8)

@piece('floor_bath', 16, 16, 'terrain', 'old cracked white bathroom tile floor with grimy grout, flat')
def _(c):
    c.R(0, 0, 16, 16, BO[3])
    for k in (0, 8): c.HL(0, k, 16, BO[1]); c.VL(k, 0, 16, BO[1])
    c.R(1, 1, 7, 7, BO[4]); c.R(9, 9, 7, 7, BO[4]); c.speck(0, 0, 16, 16, BO[2], 25, 3); c.speck(0, 0, 16, 16, BO[5], 10, 4)
    for q in range(6): c.P(10 + q // 2, 2 + q, BO[0])
    c.P(3, 12, BL[2]); c.P(4, 12, BL[2])

@piece('wall_wallpaper', 16, 16, 'terrain', 'faded dark green damask wallpaper wall face with a wooden wainscot rail, flat')
def _(c):
    c.R(0, 0, 16, 11, GR[2]); 
    for x in range(0, 16, 8):
        c.R(x + 3, 1, 2, 7, GR[3]); c.R(x + 2, 3, 4, 3, GR[3]); c.P(x + 3, 0, GR[3]); c.P(x + 4, 8, GR[1]); c.P(x + 3, 3, GR[4])
    c.speck(0, 0, 16, 11, GR[1], 14, 3); c.R(0, 10, 16, 1, W_[4]); c.R(0, 11, 16, 5, W_[2]); c.HL(0, 11, 16, W_[1]); c.VL(5, 12, 4, W_[1]); c.VL(11, 12, 4, W_[1]); c.speck(0, 11, 16, 5, W_[3], 15, 4)

OUT = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'tiledata', 'gothic-interior', 'pieces')
def render(only=None):
    os.makedirs(OUT, exist_ok=True); rows = []
    for id, (fn, w, h, kind, name) in P.items():
        if only and id not in only: continue
        c = Cv(w, h); fn(c); c.outline(); p = os.path.join(OUT, id + '.png'); c.img().save(p)
        rows.append(dict(png=os.path.abspath(p), kind=kind, name=name, label='gothic_manor/' + id))
    return rows
ANIMS = {'candelabra': 'candle flame flicker', 'wall_sconce': 'sconce candle flame flicker', 'night_window': 'lightning flash in window', 'fog': 'fog drift'}
def render_anims():
    global FR
    from PIL import Image
    rows = []
    for id in ANIMS:
        fn, w, h, kind, name = P[id]; frames = []
        for FR in range(3):
            c = Cv(w, h); fn(c); c.outline(); frames.append(c.img())
            p = os.path.join(OUT, 'anim', f'{id}_f{FR}.png'); os.makedirs(os.path.dirname(p), exist_ok=True); frames[-1].save(p)
            if FR: rows.append(dict(png=os.path.abspath(p), kind=kind, name=name + ' (animation frame)', label=f'gothic_manor/{id}_f{FR}'))
        st = Image.new('RGBA', (w * 3, h), (0, 0, 0, 0))
        for i, f in enumerate(frames): st.paste(f, (i * w, 0))
        st.save(os.path.join(OUT, 'anim', f'{id}_strip.png'))
    FR = 0
    return rows
if __name__ == '__main__':
    rows = render(sys.argv[1:] or None)
    with open(os.path.join(OUT, '..', 'batch.jsonl'), 'w') as f:
        for r in rows: f.write(json.dumps(r) + '\n')
    if not sys.argv[1:]:
        ar = render_anims()
        with open(os.path.join(OUT, '..', 'anim-batch.jsonl'), 'w') as f:
            for r in ar: f.write(json.dumps(r) + '\n')
    print(len(rows), 'pieces')
