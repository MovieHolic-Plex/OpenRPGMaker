# seat study 2 (사람 합격 2026-10-20) 그림 코드 사본 — 작업 폴더 /tmp/seats34/study2 경로를 그대로 둔다. 정본 그림은 tiledata/seats34/study2/art/, 판정은 human-verdicts.json.
"""seat study 2 — modern_city_interior seats (worker mc).
Colours: only colours already present in the origin/main modern_city sheet (every pixel is checked).
Outline = the chipset's dark navy (11,18,36). Light from upper-left. Backrests = front panels,
seats = bright top plane + 1-2 darker front rows, crease rows in material tone, open floor between legs."""
import sys, json, os
from PIL import Image
sys.path.insert(0, '/tmp/seats34/study2')
SHEET = Image.open('/tmp/seats34/mc-sheet-main.png').convert('RGBA')
PAL = {}
for p in SHEET.get_flattened_data():
    if p[3] == 255: PAL[p[:3]] = PAL.get(p[:3], 0) + 1
NAVY = (11, 18, 36)
R = {  # dark -> light, 6 steps, every entry exists in the sheet
 'wood':  [(112,78,38),(138,97,40),(166,122,55),(188,146,80),(203,167,108),(221,191,145)],
 'navy':  [(25,39,74),(38,52,86),(45,62,100),(72,96,144),(111,131,160),(131,151,179)],
 'dmet':  [(34,35,42),(42,44,52),(52,54,62),(74,76,86),(118,124,136),(160,166,178)],
 'steel': [(52,54,62),(82,86,98),(118,124,136),(160,166,178),(204,208,216),(244,246,248)],
 'rose':  [(74,43,41),(97,58,55),(122,73,69),(143,90,86),(173,147,141),(194,170,164)],
 'red':   [(96,30,40),(122,24,36),(168,32,48),(204,52,60),(224,80,96),(238,108,108)],
 'purple':[(60,20,70),(90,30,110),(120,40,140),(150,60,170),(200,120,220),(200,120,220)],
 'blue':  [(32,56,104),(40,70,130),(62,110,190),(78,134,224),(110,160,224),(150,200,236)],
 'teal':  [(38,83,89),(48,112,120),(60,140,150),(96,190,190),(120,210,206),(144,252,247)],
 'cwood': [(40,30,30),(83,48,32),(100,64,40),(130,84,50),(170,120,80),(184,132,84)],
 'gold':  [(168,120,40),(200,154,43),(226,180,72),(240,210,120),(250,244,224),(250,244,224)],
 'yel':   [(168,136,56),(178,144,59),(210,170,70),(240,200,70),(250,230,120),(255,235,134)],
 'zpur':  [(40,30,70),(85,54,124),(104,78,150),(120,90,160),(150,120,190),(180,150,220)],
 'zteal': [(38,83,89),(54,81,106),(60,110,120),(90,140,150),(122,174,196),(122,174,196)],
 'white': [(118,124,136),(160,166,178),(204,208,216),(221,224,231),(244,246,248),(255,255,255)],
}
for k, v in R.items():
    for c in v: assert c in PAL, (k, c)

class Cv:
    def __init__(s, w, h): s.im = Image.new('RGBA', (w, h)); s.w, s.h = w, h
    def p(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h: s.im.putpixel((x, y), (*c, 255))
    def r(s, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.p(x, y, c)
    def hl(s, x0, x1, y, c): s.r(x0, y, x1, y, c)
    def vl(s, x, y0, y1, c): s.r(x, y0, x, y1, c)
    def outline(s, c=NAVY):
        a = s.im.load(); S = {(x, y) for y in range(s.h) for x in range(s.w) if a[x, y][3]}
        for y in range(s.h):
            for x in range(s.w):
                if (x, y) in S: continue
                if any((x + dx, y + dy) in S for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))): s.p(x, y, c)
        return s.im

# ---------- role-letter templates (16 wide), O = outline ----------
def mat(frame, cushion=None, metal='dmet'):
    c = cushion or frame; sh = 0 if cushion else 1
    f = lambda t: (frame, t)
    return {'D': f(-2), 'd': f(-1), 'm': f(0), 'l': f(1), 'H': f(2), 'X': f(3),
            'n': (c, -2 + sh), 'C': (c, -1 + sh), 'c': (c, 0 + sh), 'e': (c, 1 + sh), 'E': (c, 2 + sh),
            'T': (metal, -1), 't': (metal, 0), 'M': (metal, 1), 'W': (metal, 2)}
def col(M, ch):
    if ch == 'O': return NAVY
    rp, t = M[ch]; return R[rp][max(0, min(5, t + 2))]
def tpl(rows, M, W=16, H=32, ox=0):
    im = Image.new('RGBA', (W, H)); oy = H - len(rows)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != '.': im.putpixel((ox + x, oy + y), (*col(M, ch), 255))
    return im
T = {
'chairS': ['................','....OO....OO....','...OHlO..OldO...','...OHHHHHHHmO...','...OlmmmmmmdO...','...OHm....ldO...','...OHmllllldO...','...OHmddddddO...','...OHm....ldO...','...OdddddddDO...','...OEEEEEEEeO...','...OeeeeeeecO...','...OCCCCCCCCO...','...OlO....OdO...','...OlO....OdO...','...OOO....OOO...'],
'chairN': ['................','................','....OO....OO....','...OHlO..OldO...','...OHHHHHHHmO...','...OdddddddDO...','...OHm....ldO...','...OHmllllldO...','...OHmddddddO...','...OHmeeeeldO...','...OHmDDDDldO...','...OHmmmmmldO...','...OlO....OdO...','...OlO....OdO...','...OOO....OOO...','................'],
'chairE': ['................','...OOOO.........','...OHmO.........','...OHmO.........','...OHdO.........','...OHmO.........','...OHdO.........','...OlmO.........','...OlmO.........','...OlmEEEEEeO...','...OlmEEEEeeO...','...OlmCCCCCCO...','...OlmmmmmmdO...','...OlO....OdO...','...OlO....OdO...','...OOO....OOO...'],
'chairW': ['................','.........OOOO...','.........OHmO...','.........OHmO...','.........OHdO...','.........OHmO...','.........OHdO...','.........OlmO...','.........OlmO...','...OEEEEECHmO...','...OEEEEeCHmO...','...OCCCCCClmO...','...OlmmmmmlmO...','...OlO....OdO...','...OlO....OdO...','...OOO....OOO...'],
# bistro chair: bent-wood hoop back, seen from the side
'cafeE': ['................','...OOOO.........','...OHmO.........','...OHOO.........','...OHO..........','...OHO..........','...OHO..........','...OlOO.........','...OlmO.........','...OlmEEEEEeO...','...OlmEEEEeeO...','...OlmCCCCCCO...','...OlOOOOOOlO...','...OlO....OdO...','...OlO....OdO...','...OOO....OOO...'],
'cafeW': ['................','.........OOOO...','.........OHmO...','.........OOHO...','..........OHO...','..........OHO...','..........OHO...','.........OOlO...','.........OHmO...','...OEEEEECHmO...','...OEEEEeCHmO...','...OCCCCCClmO...','...OlOOOOOOlO...','...OlO....OdO...','...OlO....OdO...','...OOO....OOO...'],
'officeN': ['................','.....OOOOOO.....','....OEEEEEeO....','....OeeeeecO....','....OcCCCCnO....','....OnnnnnnO....','....OcCCCCnO....','....OCCCCCnO....','..OeOCCCCCCOcO..','..OcOcCCCCnOCO..','..OOOOCCCCOOOO..','....OOOMtOOO....','.......Mt.......','....OOOMtOOO....','..OMMMMMtTTTTO..','..OO...OO...OO..'],
'officeE': ['................','..OOOO..........','..OEeO..........','..OecO..........','..OccO..........','..OcCO..........','..OcCO..........','..OCnOOOOOOO....','..OOOEEEEEEeO...','....OeeeeeecO...','....OCCCCCCCO...','.....OOMtOOO....','.......Mt.......','...OOOOMtOOOOO..','...OMMMMtTTTTO..','...OO...OO..OO..'],
'officeW': ['................','..........OOOO..','..........OEeO..','..........OecO..','..........OccO..','..........OcCO..','..........OcCO..','....OOOOOOOcnO..','...OEEEEEEeOOO..','...OEeeeeecO....','...OCCCCCCCO....','....OOOMtOO.....','.......Mt.......','..OOOOOMtOOOO...','..OMMMMMtTTTO...','..OO...OO..OO...'],
}

def save(pid, im, size):
    assert im.size == size, (pid, im.size, size)
    for p in im.get_flattened_data():
        if p[3]: assert p[3] == 255 and (p[:3] in PAL or p[:3] == NAVY), (pid, p)
    im.save(f'/tmp/seats34/study2/out/batch/{pid}.png')

# ---------- painters ----------
def armchair_s(c, ox, oy, rp, w=14, legs='wood', bk=3):
    r = R[rp]; x0, x1 = ox, ox + w - 1
    for y in range(oy, oy + bk + 4):
        t = 4 if y == oy else 3 if y == oy + 1 else 2
        c.hl(x0 + 1, x1 - 1, y, r[t]); c.p(x1 - 1, y, r[max(0, t - 1)])
    _armchair_s(c, ox, oy + bk, rp, w, legs)
def _armchair_s(c, ox, oy, rp, w=14, legs='wood'):
    r = R[rp]; x0, x1 = ox, ox + w - 1; ax = 3  # arm width
    # backrest (front panel): rim 2 lit rows, face darker
    c.r(x0 + 1, oy, x1 - 1, oy + 4, r[2]); c.vl(x1 - 1, oy, oy + 4, r[1])
    # arms: lit top plane 2 rows, front face below
    for y, t in ((oy + 4, (5, 4, 3)), (oy + 5, (4, 3, 2))):
        for i, tt in enumerate(t): c.p(x0 + i, y, r[tt])
        for i, tt in enumerate((t[1], t[0] - 1, t[2] - 1)): c.p(x1 - ax + 1 + i, y, r[tt])
    for y in range(oy + 6, oy + 11):
        for i, tt in enumerate((3, 2, 1)): c.p(x0 + i, y, r[tt])
        for i, tt in enumerate((2, 1, 0)): c.p(x1 - ax + 1 + i, y, r[tt])
    # crease (material tone), seat cushion top plane 3 rows, front face 2 rows
    c.hl(x0 + ax, x1 - ax, oy + 5, r[1])
    c.hl(x0 + ax, x1 - ax, oy + 6, r[5]); c.hl(x0 + ax, x1 - ax, oy + 7, r[5]); c.hl(x0 + ax, x1 - ax, oy + 8, r[4])
    c.p(x1 - ax, oy + 6, r[4]); c.p(x1 - ax, oy + 7, r[4]); c.p(x1 - ax, oy + 8, r[3])
    c.hl(x0 + ax, x1 - ax, oy + 9, r[2]); c.hl(x0 + ax, x1 - ax, oy + 10, r[1])
    # short legs
    L = R[legs]
    for lx, t in ((x0 + 1, 2), (x1 - 1, 1)): c.p(lx, oy + 11, L[t])
def armchair_n(c, ox, oy, rp, w=14, legs='wood'):
    r = R[rp]; x0, x1 = ox, ox + w - 1; ax = 3
    c.hl(x0 + 1, x1 - 1, oy, r[4]); c.hl(x0 + 1, x1 - 1, oy + 1, r[3])
    c.r(x0 + 1, oy + 2, x1 - 1, oy + 9, r[2]); c.vl(x1 - 1, oy + 2, oy + 9, r[1]); c.vl(x0 + 1, oy + 2, oy + 9, r[3])
    c.hl(x0 + 2, x1 - 2, oy + 7, r[1])           # one seam: the back cushion's lower edge
    for y, t in ((oy + 4, (5, 4)), (oy + 5, (4, 3))):
        c.p(x0, y, r[t[0]]); c.p(x1, y, r[t[1]])
    for y in range(oy + 6, oy + 11):
        c.p(x0, y, r[3]); c.p(x1, y, r[1])
    c.hl(x0 + 1, x1 - 1, oy + 10, r[1])
    L = R[legs]
    for lx, t in ((x0 + 1, 2), (x1 - 1, 1)): c.p(lx, oy + 11, L[t])
def armchair_e(c, ox, oy, rp, flip=False, legs='wood', bk=4):
    r = R[rp]; W = 13
    for y in range(oy, oy + bk + 1):
        for x, (a, b) in enumerate(((4, 3), (4, 2), (3, 1))):
            xx = (ox + W - 1 - x) if flip else (ox + x)
            c.p(xx, y, r[a if y < oy + 2 else b] if not flip else r[(a if y < oy + 2 else b)])
    if flip:
        for y in range(oy, oy + bk + 1):
            for x, (a, b) in enumerate(((3, 1), (4, 2), (4, 3))):
                c.p(ox + W - 3 + x, y, r[a if y < oy + 2 else b])
    oy += bk
    X = (lambda x: ox + W - 1 - x) if flip else (lambda x: ox + x)
    P = lambda x, y, t: c.p(X(x), y, r[t])
    for y in range(0, 11):                               # backrest post 3 wide, lit west col
        if not flip: P(0, oy + y, 3); P(1, oy + y, 2); P(2, oy + y, 1)
        else: P(2, oy + y, 3); P(1, oy + y, 2); P(0, oy + y, 1)
    for x in range(3, W):                                # far arm: lit top, face
        P(x, oy + 3, 4); P(x, oy + 4, 2)
    for x in range(3, W):                                # seat cushion top 2 rows
        P(x, oy + 5, 5); P(x, oy + 6, 5 if x < W - 1 else 4)
    for x in range(1, W):                                # near arm: lit top 2 rows, face 3 rows
        P(x, oy + 7, 5 if x < W - 1 else 4); P(x, oy + 8, 4)
        for y in (9, 10): P(x, oy + y, 2)
        P(x, oy + 11, 1)
    for x in (0,): P(x, oy + 11, 1)
    L = R[legs]
    for lx, t in ((1, 2), (W - 2, 1)): c.p(X(lx), oy + 12, L[t])

def sofa_n(c, ox, oy, rp, w, h=18, legs='wood'):
    r = R[rp]; x0, x1 = ox, ox + w - 1; ax = 4
    for x in range(x0 + 1, x1):                         # back: rim, face, one seam
        c.p(x, oy, r[4]); c.p(x, oy + 1, r[3])
        for y in range(oy + 2, oy + h - 4): c.p(x, y, r[2])
    c.hl(x0 + ax, x1 - ax, oy + h - 7, r[1])
    for y in range(oy + 2, oy + h - 4): c.p(x0 + 1, y, r[3]); c.p(x1 - 1, y, r[1])
    for i in range(ax):                                 # arms
        for y in range(oy + 5, oy + h - 2):
            tl = 5 if y == oy + 5 else 4 if y == oy + 6 else (3 if i < 2 else 2)
            tr = 4 if y == oy + 5 else 3 if y == oy + 6 else (1 if i >= 2 else 2)
            c.p(x0 + i, y, r[tl]); c.p(x1 - ax + 1 + i, y, r[tr])
    c.r(x0 + ax, oy + h - 4, x1 - ax, oy + h - 3, r[1])
    c.hl(x0, x1, oy + h - 2, r[0])
    L = R[legs]
    for lx, t in ((x0 + 1, 2), (x1 - 1, 1), (x0 + 2, 1), (x1 - 2, 1)):
        c.p(lx, oy + h - 1, L[t] if lx in (x0 + 1, x1 - 1) else L[t])

def seat_unit(c, x0, y0, w, rp, back_h, seat_h=3, face_h=2):
    """front panel back + crease + seat top + front face, inner width w."""
    r = R[rp]; x1 = x0 + w - 1; y = y0
    c.hl(x0, x1, y, r[5]); c.hl(x0, x1, y + 1, r[4]); y += 2
    for _ in range(back_h): c.hl(x0, x1, y, r[2]); c.p(x1, y, r[1]); c.p(x0, y, r[3]); y += 1
    c.hl(x0, x1, y, r[1]); y += 1                         # crease
    for i in range(seat_h):
        t = 5 if i < seat_h - 1 else 4; c.hl(x0, x1, y, r[t]); c.p(x1, y, r[t - 1]); y += 1
    c.hl(x0, x1, y, r[2]); y += 1
    if face_h > 1: c.hl(x0, x1, y, r[1]); y += 1
    return y

def cinema_row(w, h, rp, arm, back_h, seat_h, armtop):
    c = Cv(w, h); n = 3; aw = 3; sw = (w - 2 - aw * (n + 1)) // n
    x = 1; ys = []
    top = 1
    xs = []
    for i in range(n + 1):
        xs.append(x); x += aw + (sw if i < n else 0)
    # seats
    for i in range(n):
        sx = xs[i] + aw
        yb = seat_unit(c, sx, top, sw, rp, back_h, seat_h)
    seat_top_y = top + 2 + back_h + 1
    A = R[arm]; T = R[armtop]
    for i, ax in enumerate(xs):                           # arms/standards: lit cap, face, standard to floor
        cap = seat_top_y - 1
        for k in range(aw):
            c.p(ax + k, cap, T[5 if k == 0 else 4]); c.p(ax + k, cap + 1, T[4 if k == 0 else 3])
            for y in range(cap + 2, h - 1):
                c.p(ax + k, y, A[(3, 2, 1)[k]])
    return c

def wheelchair(c, ox, oy, fab='blue'):
    """front-facing wheelchair, 14 wide painted area, 17 rows."""
    F = R[fab]; S = R['steel']; D = R['dmet']
    for y in range(0, 14):                                # push-handle posts
        c.p(ox + 2, oy + y, S[3] if y > 0 else S[4]); c.p(ox + 11, oy + y, S[2] if y > 0 else S[3])
    c.hl(ox + 3, ox + 10, oy + 2, F[3]); c.hl(ox + 3, ox + 10, oy + 3, F[2])   # sling back rim
    c.r(ox + 3, oy + 4, ox + 10, oy + 7, F[1]); c.vl(ox + 10, oy + 4, oy + 7, F[0])
    c.hl(ox + 3, ox + 10, oy + 8, F[0])                                        # crease
    c.hl(ox + 3, ox + 10, oy + 9, F[4]); c.hl(ox + 3, ox + 10, oy + 10, F[4])  # seat top
    c.p(ox + 10, oy + 9, F[3]); c.p(ox + 10, oy + 10, F[3])
    c.hl(ox + 3, ox + 10, oy + 11, F[1])                                       # seat front
    for y in range(5, 15):                                # big wheels (front view: tall narrow ovals)
        c.p(ox + 0, oy + y, D[3]); c.p(ox + 1, oy + y, S[3])
        c.p(ox + 12, oy + y, S[1]); c.p(ox + 13, oy + y, D[1])
    for y in (5, 14): c.p(ox + 0, oy + y, D[3]); c.p(ox + 13, oy + y, D[1])
    c.hl(ox + 3, ox + 4, oy + 13, S[3]); c.hl(ox + 9, ox + 10, oy + 13, S[2])  # footrest struts
    c.hl(ox + 3, ox + 5, oy + 14, S[4]); c.hl(ox + 8, ox + 10, oy + 14, S[3])  # footplates (lit top)
    c.hl(ox + 3, ox + 5, oy + 15, S[2]); c.hl(ox + 8, ox + 10, oy + 15, S[1])

def karaoke(rp='purple'):
    c = Cv(48, 48); r = R[rp]
    for x in range(1, 47):                                # long back (south-facing front panel)
        c.p(x, 1, r[4]); c.p(x, 2, r[3])
        for y in range(3, 8): c.p(x, y, r[2])
        c.p(x, 8, r[1])
    for y in range(1, 40):                                # short back along the west wall
        for x, t in ((1, 4), (2, 3), (3, 2), (4, 2), (5, 1)):
            if y > 2: c.p(x, y, r[t])
    for y in range(9, 17):                                # seat cushions top plane, row of 3 + column of 2
        for x in range(6, 43): c.p(x, y, r[5] if y < 11 else r[4])
    for y in range(17, 40):
        for x in range(6, 15): c.p(x, y, r[5] if x < 8 else r[4])
    for y in (9, 10, 11, 12, 13, 14, 15, 16): c.p(24, y, r[3]); c.p(33, y, r[3])
    for x in range(6, 15): c.p(x, 28, r[3])
    for x in range(15, 43): c.p(x, 17, r[2]); c.p(x, 18, r[1])     # front face of the long seat
    for y in range(4, 20):                                # east arm
        for i, x in enumerate(range(43, 47)):
            t = (5, 5, 4, 4)[i] if y == 4 else (4, 4, 3, 3)[i] if y == 5 else (3, 2, 2, 1)[i]
            c.p(x, y, r[t])
    for y in range(40, 47):                               # south arm
        for x in range(1, 15):
            t = 5 if y == 40 else 4 if y == 41 else 2
            if x == 14 and t == 2: t = 1
            if y == 46: t = 1
            c.p(x, y, r[t])
    return c.outline()

def judge_bench():
    c = Cv(80, 48); W = R['cwood']; L = R['red']; G = R['gold']
    for cx in (14, 34, 54):                               # three high-back leather chairs behind the desk
        for y in range(2, 16):
            for x in range(cx, cx + 12):
                t = 3 if y == 2 else 2 if y == 3 else 1
                if x == cx + 11 and y > 2: t = 0
                if x == cx and y > 3: t = 2
                c.p(x, y, L[t])
        for x in range(cx + 1, cx + 11): c.p(x, 9, L[0])   # one seam: back cushion line
    for x in range(1, 79):                                # desk top plane
        c.p(x, 15, W[5]); c.p(x, 16, W[4]); c.p(x, 17, W[4]); c.p(x, 18, W[4]); c.p(x, 19, W[3])
        for y in range(20, 45): c.p(x, y, W[2])
        c.p(x, 45, W[1]); c.p(x, 46, W[0])
    for y in range(16, 19): c.p(78, y, W[3])
    for y in range(20, 45): c.p(78, y, W[1])
    for px in (1, 14, 27, 52, 65):                        # panel seams: lit left edge, shadow right edge
        for y in range(21, 44):
            c.p(px + 1, y, W[3]);
            if px + 12 < 78: c.p(px + 12, y, W[1])
        for x in range(px + 1, min(px + 13, 78)): c.p(x, 21, W[3]); c.p(x, 43, W[1])
    for y in range(21, 44): c.p(40, y, W[1]); c.p(39, y, W[1])
    import math                                           # gold seal centred on the front
    for y in range(24, 41):
        for x in range(31, 49):
            d = math.hypot(x - 39.5, y - 32)
            if d <= 7.2:
                t = 1 if d > 6.2 else 3 if (x - 39.5) + (y - 32) < -3 else 2
                c.p(x, y, G[t])
    for y in range(28, 37): c.p(39, y, G[0]); c.p(40, y, G[0])
    for x in range(36, 44): c.p(x, 28, G[0])
    return c.outline()

def bath_stool():
    c = Cv(16, 16); Y = R['yel']
    for x in range(2, 14):
        c.p(x, 5, Y[5]); c.p(x, 6, Y[4]); c.p(x, 7, Y[4]); c.p(x, 8, Y[2])
    c.p(13, 6, Y[3]); c.p(13, 7, Y[3])
    for y in range(9, 14):
        for x in range(2, 14):
            if 5 <= x <= 10 and y >= 11: continue
            c.p(x, y, Y[3] if x < 8 else Y[1])
    return c.outline()

def bar_stool():
    c = Cv(16, 32); r = R['rose']; S = R['steel']
    for x in range(4, 12): c.p(x, 16, r[5])
    for x in range(3, 13): c.p(x, 17, r[5]); c.p(x, 18, r[4]); c.p(x, 19, r[2])
    for x in range(4, 12): c.p(x, 20, r[1])
    c.p(12, 18, r[3])
    for y in range(21, 28): c.p(7, y, S[4]); c.p(8, y, S[2])
    for x in range(4, 12): c.p(x, 25, S[4] if x < 7 else S[3])
    for x in range(5, 11): c.p(x, 26, S[1])
    for x in range(4, 12): c.p(x, 28, S[4] if x < 8 else S[3]); c.p(x, 29, S[1])
    return c.outline()

def barber():
    c = Cv(16, 32); r = R['red']; S = R['steel']
    for x in range(5, 11): c.p(x, 7, r[4]); c.p(x, 8, r[3]); c.p(x, 9, r[2])   # headrest
    c.p(7, 10, S[3]); c.p(8, 10, S[2])
    for y in range(11, 17):                               # back panel
        for x in range(3, 13):
            t = 5 if y == 11 else 4 if y == 12 else 2
            if x == 12 and y > 11: t -= 1
            c.p(x, y, r[t])
    for x in range(3, 13): c.p(x, 17, r[1])               # crease
    for y in (18, 19, 20):
        for x in range(3, 13): c.p(x, y, r[5] if y < 20 else r[4])
        c.p(12, y, r[4])
    for x in range(3, 13): c.p(x, 21, r[2]); c.p(x, 22, r[1])
    for y in range(16, 22):                               # chrome arms
        for x, (a, b) in ((1, (5, 3)), (2, (4, 2)), (13, (4, 2)), (14, (3, 1))):
            c.p(x, y, S[a] if y < 18 else S[b])
    c.p(7, 23, S[3]); c.p(8, 23, S[2])
    for x in range(4, 12): c.p(x, 24, S[4] if x < 8 else S[3]); c.p(x, 25, S[1])   # footrest
    c.p(7, 26, S[2]); c.p(8, 26, S[1])
    for x in range(3, 13): c.p(x, 27, S[4] if x < 8 else S[3]); c.p(x, 28, S[1])   # base disc
    return c.outline()

def wheelchair_bay():
    c = Cv(32, 32); B = R['blue']; Wh = R['white']
    for y in range(1, 11):
        for x in range(11, 21):
            t = 3 if (y == 1 or x == 11) else 1 if (y == 10 or x == 20) else 2
            c.p(x, y, B[t])
    for x, y in ((14, 2), (15, 2), (14, 3), (15, 3), (15, 4), (15, 5), (15, 6), (16, 6), (17, 6), (17, 7), (18, 8),
                 (13, 5), (13, 6), (13, 7), (14, 8), (15, 8), (16, 8)):
        c.p(x, y, Wh[4])
    wheelchair(c, 1, 13); wheelchair(c, 17, 13)
    return c.outline()

def dental():
    c = Cv(32, 32); Tl = R['teal']; S = R['steel']; Wh = R['white']; G = R['gold']
    for x in range(26, 28):                               # lamp post and arm
        for y in range(5, 17): c.p(x, y, S[3] if x == 26 else S[1])
    for x in range(10, 26): c.p(x, 5, S[3]); c.p(x, 6, S[1])
    for y in range(2, 9):                                  # lamp head
        for x in range(3, 11):
            t = 4 if y == 2 else 3 if y < 6 else 1
            c.p(x, y, S[t])
    for x in range(4, 10): c.p(x, 6, G[3]); c.p(x, 7, G[2])
    for y in range(13, 18):                               # headrest
        for x in range(2, 7): c.p(x, y, Wh[4] if y < 15 else Wh[3] if y < 17 else Wh[1])
    for x in range(7, 24):                                # back + seat: top plane, crease, front face
        top = 13 if x < 17 else 14
        for y in range(top, 17): c.p(x, y, Tl[5] if y == top else Tl[4])
        c.p(x, 17, Tl[2]); c.p(x, 18, Tl[1])
    for y in range(14, 17): c.p(16, y, Tl[3])
    for x in range(24, 30):                               # leg rest, lower
        for y in range(16, 19): c.p(x, y, Tl[5] if y == 16 else Tl[4])
        c.p(x, 19, Tl[2]); c.p(x, 20, Tl[1])
    for y in range(19, 26): c.p(15, y, S[4]); c.p(16, y, S[3]); c.p(17, y, S[2]); c.p(18, y, S[1])
    for x in range(9, 25): c.p(x, 26, S[4] if x < 17 else S[3]); c.p(x, 27, S[2]); c.p(x, 28, S[1])
    return c.outline()

def zabuton():
    c = Cv(32, 16)
    for ox, rp in ((1, 'zpur'), (17, 'zteal')):
        r = R[rp]
        for y in range(3, 13):
            for x in range(ox, ox + 14):
                if (x in (ox, ox + 13)) and y in (3, 12): continue
                if y <= 11:
                    t = 3
                    if 5 <= y <= 9 and ox + 2 <= x <= ox + 11: t = 4
                    if y == 3 or x == ox: t = 4
                    if x == ox + 13: t = 2
                    if y == 3 and x <= ox + 6: t = 5
                else: t = 1
                c.p(x, y, r[t])
        for x in (ox, ox + 13):
            c.p(x, 3, (0, 0, 0, 0)) if False else None
    im = c.outline()
    return im

def build():
    O = '/tmp/seats34/study2/out/batch/'; os.makedirs(O, exist_ok=True)
    wood = mat('wood'); out = {}
    for pid, t in (('mci-chair-wood-s', 'chairS'), ('mci-chair-wood-n', 'chairN'), ('mci-chair-wood-e', 'chairE'), ('mci-chair-wood-w', 'chairW')):
        out[pid] = tpl(T[t], wood)
    cafe = mat('dmet', 'wood'); cafe.update({'H': ('steel', 1), 'm': ('dmet', 1), 'l': ('dmet', 2), 'd': ('dmet', 0)})
    out['mci-cafe-chair-e'] = tpl(T['cafeE'], cafe); out['mci-cafe-chair-w'] = tpl(T['cafeW'], cafe)
    off = mat('navy', 'navy', 'dmet'); off.update({'M': ('steel', 0), 't': ('dmet', 1), 'T': ('dmet', 0)})
    for pid, t in (('mci-chair-office-n', 'officeN'), ('mci-chair-office-e', 'officeE'), ('mci-chair-office-w', 'officeW')):
        out[pid] = tpl(T[t], off)
    # armchairs (rose, one family)
    c = Cv(16, 32); armchair_s(c, 1, 15, 'rose'); out['mci-armchair'] = c.outline()
    c = Cv(16, 32); armchair_n(c, 1, 18, 'rose'); out['mci-armchair-n'] = c.outline()
    c = Cv(16, 32); armchair_e(c, 1, 13, 'rose'); out['mci-armchair-e'] = c.outline()
    c = Cv(16, 32); armchair_e(c, 2, 13, 'rose', flip=True); out['mci-armchair-w'] = c.outline()
    c = Cv(48, 32); sofa_n(c, 1, 12, 'navy', 46, 18); out['mci-sofa-n'] = c.outline()
    out['cinema-seat-row'] = cinema_row(48, 16, 'red', 'dmet', 3, 2, 'dmet').outline()
    c = Cv(48, 32); cc = cinema_row(48, 22, 'red', 'dmet', 7, 3, 'wood'); c.im.alpha_composite(cc.outline(), (0, 10)); out['aud-seat-row'] = c.im
    c = Cv(16, 32); wheelchair(c, 1, 13); out['hospital-wheelchair'] = c.outline()
    out['karaoke-sofa'] = karaoke(); out['court-judge-bench'] = judge_bench(); out['home-bath-stool'] = bath_stool()
    out['mci-bar-stool'] = bar_stool(); out['svc-barber-chair'] = barber(); out['hosp-wheelchair-bay'] = wheelchair_bay()
    out['clinic-dental-chair'] = dental(); out['home-zabuton'] = zabuton()
    return out


# ======================= round 2 =======================
def grow(im, c=NAVY):
    """add the navy outline outside every non-outline filled pixel (keeps existing outline pixels)."""
    W, H = im.size; a = im.load()
    S = {(x, y) for y in range(H) for x in range(W) if a[x, y][3]}
    for y in range(H):
        for x in range(W):
            if (x, y) in S: continue
            if any((x + dx, y + dy) in S and a[x + dx, y + dy][:3] != c for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))):
                im.putpixel((x, y), (*c, 255))
    return im
def dg(rows, ramps, W=16, H=32, ox=0, oy=None, im=None):
    """digit template: 0-5 = ramps[0][i], a-f = ramps[1][i], p-u = ramps[2][i]; '.' empty. Outline grown after."""
    im = im or Image.new('RGBA', (W, H)); oy = (H - 1 - len(rows)) if oy is None else oy
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == '.': continue
            if ch.isdigit(): c = R[ramps[0]][int(ch)]
            elif ch in 'abcdef': c = R[ramps[1]]['abcdef'.index(ch)]
            elif ch in 'pqrstu': c = R[ramps[2]]['pqrstu'.index(ch)]
            else: raise ValueError(ch)
            im.putpixel((ox + x, oy + y), (*c, 255))
    return im
def ck(rows, W=16):
    for r in rows: assert len(r) == W, (len(r), r)
    return rows
D2 = {
'armS': ck(['..444444444443..','..333333333332..','..222222222221..','..222222222221..','..222222222221..',
            '.54222222222143.','.43111111111132.','.32455555555421.','.32455555555421.','.32344444444321.',
            '.32222222222221.','.21111111111110.','.r............q.']),
'armN': ck(['..444444444443..','..333333333332..','..222222222221..','..222222222221..','..222222222221..',
            '.54122222222143.','.43122222222132.','.32122222222121.','.32122222222121.','.32111111111121.',
            '.32111111111121.','.21000000000010.','.r............q.']),
'armE': ck(['.443............','.432............','.321............','.321............','.321............',
            '.321444444443...','.321222222222...','.321555555554...','.321555555554...','.5555555555554..',
            '.4444444444443..','.2222222222221..','.1111111111110..','.r.........q....']),
'armW': ck(['............443.','............432.','............321.','............321.','............321.',
            '...444444443321.','...222222222321.','...555555554321.','...555555554321.','..5555555555554.',
            '..4444444444443.','..2222222222221.','..1111111111110.','....q.........r.']),
'offN': ck(['....44444443....','...3333333332...','...2222222221...','...2222222221...','...2222222221...',
            '...2222222221...','...1111111110...','.ed1111111110dc.','.dc3333333332cb.','.cb2222222221ba.',
            '....11111110....','.......dc.......','.......dc.......','..eeeeeedddddd..','..b....b.....b..']),
'offE': ck(['..443...........','..432...........','..321...........','..321...........','..321.eeeeed....',
            '..321....c......','..321....c......','..32555555554...','..21444444443...','...1222222221...',
            '.......dc.......','.......dc.......','..eeeeeedddddd..','..b....b.....b..']),
'offW': ck(['...........443..','...........432..','...........321..','...........321..','....eeeeed.321..',
            '......c....321..','......c....321..','...55555555421..','...44444444321..','...1222222221...',
            '.......dc.......','.......dc.......','..eeeeeedddddd..','..b....b.....b..']),
'bar': ck(['....55555554....','...5555555554...','...4444444443...','...2222222221...','....11111110....',
           '.......ed.......','.......ed.......','.....eeedcb.....','.......ed.......','.......ed.......',
           '....eeeedddd....','....bbbbbbbb....']),
'barber': ck(['.....444443.....','.....222221.....','.......dc.......','...5555555554...','...4444444443...',
              '...2222222221...','...2222222221...','.fe2222222221ed.','.dc1111111111cb.','.dc5555555554cb.',
              '.dc5555555554cb.','.cb4444444443ba.','...2222222221...','...1111111110...','.......dc.......',
              '....eeeedddd....','....bbbbbbbb....','.......cb.......','...eeeeeddddd...','...bbbbbbbbbb...']),
'bath': ck(['...5555555554...','...5555555554...','...3333333332...','...3222222221...','...32......21...','...32......21...']),
'wheel': ck(['...f........e...','...e........d...','...e33333333d...','...e22222222d...','..re11111111dq..',
             '.rde11111111dcq.','.rde11111111dcq.','.rde00000000dcq.','.rde44444444dcq.','.rde44444443dcq.',
             '.rde11111111dcq.','.rde........dcq.','.rdd........ccq.','..r.ee....dd.q..','....cc....bb....']),
}
def two(pid_rows, ramps, H=32, ox=0):
    return grow(dg(D2[pid_rows], ramps, H=H))

def cinema2(w, h, rp, back_h, armtop, arm='dmet', seat_rows=(4, 4, 3), oy=0):
    im = Image.new('RGBA', (w, h)); c = Cv(w, h); c.im = im
    r = R[rp]; A = R[arm]; T = R[armtop]
    n = 3; aw = 2; sw = (w - 2 - aw * (n + 1)) // n
    xs = []; x = 1
    for i in range(n + 1): xs.append(x); x += aw + (sw if i < n else 0)
    top = oy + 1
    for i in range(n):
        x0 = xs[i] + aw; x1 = x0 + sw - 1; y = top
        c.hl(x0, x1, y, r[4]); c.hl(x0, x1, y + 1, r[3]); y += 2
        for _ in range(back_h): c.hl(x0, x1, y, r[2]); c.p(x1, y, r[1]); y += 1
        c.hl(x0, x1, y, r[1]); y += 1; ys = y
        for t in seat_rows: c.hl(x0, x1, y, r[t]); c.p(x1, y, r[t - 1]); y += 1
        c.hl(x0, x1, y, r[1]); c.hl(x0, x1, y + 1, r[0]); yb = y + 2
    for ax in xs:                                         # arm pads at seat height, thin standard to the floor
        for k in range(aw):
            c.p(ax + k, ys - 1, T[5 if k == 0 else 4]); c.p(ax + k, ys, T[4 if k == 0 else 3])
            for y in range(ys + 1, ys + 4): c.p(ax + k, y, A[3 if k == 0 else 2])
        for y in range(ys + 4, h - 1): c.p(ax, y, A[3]); c.p(ax + 1, y, A[1])
    for i in range(n):                                    # dark under-seat rail between the standards
        x0 = xs[i] + aw; x1 = x0 + sw - 1
        c.hl(x0, x1, h - 3, A[1])
    return grow(im)

def sofa_n2(c, ox, oy, rp, w, h=18, legs='wood'):
    r = R[rp]; x0, x1 = ox, ox + w - 1; ax = 4
    for x in range(x0 + 1, x1):
        c.p(x, oy, r[4]); c.p(x, oy + 1, r[3])
        for y in range(oy + 2, oy + h - 4): c.p(x, y, r[2])
    for y in range(oy + 2, oy + h - 4): c.p(x0 + 1, y, r[3]); c.p(x1 - 1, y, r[1])
    third = (w - 2 * ax) // 3
    for k in (1, 2):                                      # two vertical seams split the back in three
        sx = x0 + ax + k * third
        for y in range(oy + 2, oy + h - 4): c.p(sx, y, r[1]); c.p(sx + 1, y, r[3])
    for i in range(ax):
        for y in range(oy + 5, oy + h - 2):
            tl = 5 if y == oy + 5 else 4 if y == oy + 6 else (3 if i < 2 else 2)
            tr = 4 if y == oy + 5 else 3 if y == oy + 6 else (1 if i >= 2 else 2)
            c.p(x0 + i, y, r[tl]); c.p(x1 - ax + 1 + i, y, r[tr])
    c.r(x0 + ax, oy + h - 4, x1 - ax, oy + h - 3, r[1])
    c.hl(x0, x1, oy + h - 2, r[0])
    L = R[legs]
    for lx in (x0 + 1, x1 - 2):
        c.p(lx, oy + h - 1, L[3]); c.p(lx + 1, oy + h - 1, L[1])

def karaoke2(rp='purple'):
    c = Cv(48, 48); r = R[rp]
    for x in range(1, 47):                                # long back panel with seams over the cushions
        c.p(x, 1, r[4]); c.p(x, 2, r[3])
        for y in range(3, 8): c.p(x, y, r[2])
        c.p(x, 8, r[1])
    for sx in (24, 33):
        for y in range(3, 8): c.p(sx, y, r[1])
    for y in range(3, 41):                                # short back along the west wall
        for x, t in ((1, 3), (2, 2), (3, 2), (4, 2), (5, 1)): c.p(x, y, r[t])
    for y in range(9, 14):                                # long seat: top plane
        for x in range(6, 43): c.p(x, y, r[5] if y < 11 else r[4])
    for y in (9, 10, 11, 12, 13): c.p(24, y, r[3]); c.p(33, y, r[3])
    for x in range(15, 43): c.p(x, 14, r[2]); c.p(x, 15, r[1]); c.p(x, 16, r[1]); c.p(x, 17, r[0])  # front apron + kick
    for y in range(14, 40):                               # short wing seat top
        for x in range(6, 13): c.p(x, y, r[5] if x < 8 else r[4])
        c.p(13, y, r[2]); c.p(14, y, r[1])                 # its inner edge rolls down
    for x in range(6, 13): c.p(x, 27, r[3])
    for y in range(4, 18):                                # east arm
        for i, x in enumerate(range(43, 47)):
            t = (5, 5, 4, 4)[i] if y == 4 else (4, 4, 3, 3)[i] if y == 5 else (3, 2, 2, 1)[i]
            if y == 17: t = 0
            c.p(x, y, r[t])
    for y in range(40, 47):                               # south arm
        for x in range(1, 15):
            t = 5 if y == 40 else 4 if y == 41 else 2
            if x == 14 and t == 2: t = 1
            if y == 46: t = 0
            c.p(x, y, r[t])
    return c.outline()

def judge_bench2():
    c = Cv(80, 48); W = R['cwood']; L = R['red']; G = R['gold']
    for cx in (14, 34, 54):                               # three padded high backs in a wood frame
        for y in range(2, 16):
            for x in range(cx, cx + 12):
                if y == 2: t = ('w', 4)
                elif x == cx: t = ('w', 3)
                elif x == cx + 11: t = ('w', 1)
                elif x in (cx + 1, cx + 10): t = ('l', 1)          # side bolsters
                else: t = ('l', 3 if y == 3 else 2)
                c.p(x, y, (W if t[0] == 'w' else L)[t[1]])
    for x in range(1, 79):                                # desk top plane
        c.p(x, 15, W[5]); c.p(x, 16, W[4]); c.p(x, 17, W[4]); c.p(x, 18, W[4]); c.p(x, 19, W[3])
        for y in range(20, 45): c.p(x, y, W[2])
        c.p(x, 45, W[1]); c.p(x, 46, W[0])
    for y in range(16, 19): c.p(78, y, W[3])
    for y in range(20, 45): c.p(78, y, W[1])
    for px in (1, 14, 27, 52, 65):                        # recessed panels
        for y in range(21, 44):
            c.p(px + 1, y, W[3])
            if px + 12 < 78: c.p(px + 12, y, W[1])
        for x in range(px + 1, min(px + 13, 78)): c.p(x, 21, W[3]); c.p(x, 43, W[1])
    import math
    for y in range(24, 41):                               # gold seal with scales of justice
        for x in range(31, 49):
            d = math.hypot(x - 39.5, y - 32)
            if d <= 7.2:
                t = 1 if d > 6.2 else 3 if (x - 39.5) + (y - 32) < -3 else 2
                c.p(x, y, G[t])
    for y in range(27, 38): c.p(39, y, G[0]); c.p(40, y, G[0])          # pillar
    for x in range(35, 45): c.p(x, 28, G[0])                            # beam
    for x in range(34, 38): c.p(x, 32, G[0])                            # left pan
    for x in range(42, 46): c.p(x, 32, G[0])                            # right pan
    for x, y in ((35, 29), (35, 30), (35, 31), (44, 29), (44, 30), (44, 31)): c.p(x, y, G[1])
    for x in range(37, 43): c.p(x, 37, G[0])                            # foot
    return c.outline()

def wheelchair_bay2():
    im = Image.new('RGBA', (32, 32)); c = Cv(32, 32); c.im = im; B = R['blue']; Wh = R['white']
    for y in range(1, 9):
        for x in range(12, 20):
            t = 3 if (y == 1 or x == 12) else 1 if (y == 8 or x == 19) else 2
            c.p(x, y, B[t])
    for x, y in ((15, 2), (15, 3), (15, 4), (16, 4), (17, 4), (17, 5), (18, 6), (13, 4), (13, 5), (14, 6), (15, 6), (16, 6)):
        c.p(x, y, Wh[4])
    dg(D2['wheel'], ('blue', 'steel', 'dmet'), W=32, H=32, ox=0, im=im)
    dg(D2['wheel'], ('blue', 'steel', 'dmet'), W=32, H=32, ox=15, im=im)
    return grow(im)

def dental2():
    c = Cv(32, 32); Tl = R['teal']; S = R['steel']; Wh = R['white']; G = R['gold']
    for x in range(8, 25): c.p(x, 5, S[3])               # thin lamp rod
    for y in range(5, 15): c.p(24, y, S[3]); c.p(25, y, S[1])
    for y in range(4, 7):                                 # compact lamp head
        for x in range(4, 8): c.p(x, y, S[4] if y == 4 else S[2])
    for x in range(4, 8): c.p(x, 7, G[3])
    for y in range(12, 15):                               # headrest (white)
        for x in range(2, 6): c.p(x, y, Wh[4] if y == 12 else Wh[3] if y == 13 else Wh[1])
    for x in range(6, 14):                                # raised back
        c.p(x, 11, Tl[5]); c.p(x, 12, Tl[4]); c.p(x, 13, Tl[4]); c.p(x, 14, Tl[2]); c.p(x, 15, Tl[1])
    for x in range(14, 21):                               # lower seat pan
        c.p(x, 13, Tl[5]); c.p(x, 14, Tl[4]); c.p(x, 15, Tl[4]); c.p(x, 16, Tl[2]); c.p(x, 17, Tl[1])
    for x in range(14, 21): c.p(x, 12, Tl[1]) if x == 14 else None
    for x in range(21, 29):                               # sloped leg rest
        y0 = 15 if x < 25 else 16
        c.p(x, y0, Tl[5]); c.p(x, y0 + 1, Tl[4]); c.p(x, y0 + 2, Tl[2]); c.p(x, y0 + 3, Tl[1])
        if x >= 25: pass
    for y in range(18, 25): c.p(15, y, S[4]); c.p(16, y, S[3]); c.p(17, y, S[2]); c.p(18, y, S[1])
    for x in range(10, 24): c.p(x, 25, S[4] if x < 17 else S[3]); c.p(x, 26, S[2]); c.p(x, 27, S[1])
    return c.outline()

def zabuton2():
    c = Cv(32, 16)
    for ox, rp in ((1, 'zpur'), (17, 'zteal')):
        r = R[rp]
        for y in range(3, 13):
            for x in range(ox, ox + 14):
                if x in (ox, ox + 13) and y in (3, 12): continue
                if y == 12: t = 1
                elif y == 3: t = 5 if x < ox + 9 else 4
                elif y <= 5: t = 4
                else: t = 3
                if x == ox + 13 and y < 12: t = 2
                if x == ox and 3 < y < 12: t = min(5, t + 1)
                c.p(x, y, r[t])
    return c.outline()

def build2():
    out = {}
    wood = mat('wood')
    for pid, t in (('mci-chair-wood-s', 'chairS'), ('mci-chair-wood-n', 'chairN'), ('mci-chair-wood-e', 'chairE'), ('mci-chair-wood-w', 'chairW')):
        out[pid] = grow(tpl(T[t], wood))
    cafe = mat('dmet', 'wood'); cafe.update({'H': ('steel', 1), 'm': ('dmet', 1), 'l': ('dmet', 2), 'd': ('dmet', 0)})
    out['mci-cafe-chair-e'] = grow(tpl(T['cafeE'], cafe)); out['mci-cafe-chair-w'] = grow(tpl(T['cafeW'], cafe))
    nav = ('navy', 'dmet', 'steel')
    out['mci-chair-office-n'] = two('offN', nav); out['mci-chair-office-e'] = two('offE', nav); out['mci-chair-office-w'] = two('offW', nav)
    ro = ('rose', 'steel', 'wood')
    out['mci-armchair'] = two('armS', ro); out['mci-armchair-n'] = two('armN', ro)
    out['mci-armchair-e'] = two('armE', ro); out['mci-armchair-w'] = two('armW', ro)
    out['mci-bar-stool'] = two('bar', ('rose', 'steel', 'wood'))
    out['svc-barber-chair'] = two('barber', ('red', 'steel', 'dmet'))
    out['home-bath-stool'] = grow(dg(D2['bath'], ('yel', 'yel', 'yel'), H=16))
    out['hospital-wheelchair'] = two('wheel', ('blue', 'steel', 'dmet'))
    out['hosp-wheelchair-bay'] = wheelchair_bay2()
    out['clinic-dental-chair'] = dental2(); out['home-zabuton'] = zabuton2()
    out['cinema-seat-row'] = cinema2(48, 16, 'red', 3, 'dmet')
    a = Image.new('RGBA', (48, 32)); a.alpha_composite(cinema2(48, 22, 'red', 6, 'wood'), (0, 10)); out['aud-seat-row'] = a
    c = Cv(48, 32); sofa_n2(c, 1, 12, 'navy', 46, 18); out['mci-sofa-n'] = c.outline()
    out['karaoke-sofa'] = karaoke2(); out['court-judge-bench'] = judge_bench2()
    return out

# ======================= round 3 =======================
def grow2(im, c=NAVY):
    """outline only the exterior: enclosed holes (ladder gaps, armrest windows) stay open floor."""
    W, H = im.size; a = im.load()
    F = {(x, y) for y in range(H) for x in range(W) if a[x, y][3]}
    ext = set(); st = [(x, y) for x in range(-1, W + 1) for y in (-1, H)] + [(x, y) for y in range(H) for x in (-1, W)]
    while st:
        p = st.pop()
        if p in ext or p in F: continue
        x, y = p
        if x < -1 or y < -1 or x > W or y > H: continue
        ext.add(p); st += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    for (x, y) in ext:
        if 0 <= x < W and 0 <= y < H and any((x + dx, y + dy) in F for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))):
            im.putpixel((x, y), (*c, 255))
    return im
def open_under(im, y):
    """remove the outline directly under row y where nothing hangs below it (bench-beam style edge)."""
    W, H = im.size; a = im.load()
    for x in range(W):
        if a[x, y][3] and a[x, y][:3] != NAVY and y + 1 < H and a[x, y + 1][:3] == NAVY and a[x, y + 1][3] and (y + 2 >= H or not a[x, y + 2][3]):
            if not (x > 0 and a[x - 1, y + 1][3] and a[x - 1, y + 1][:3] != NAVY) and not (x + 1 < W and a[x + 1, y + 1][3] and a[x + 1, y + 1][:3] != NAVY):
                im.putpixel((x, y + 1), (0, 0, 0, 0))
    return im
D3 = {
'woodS': ck(['...43......32...','...5555555543...','...4444444432...','...43......21...','...4333333321...','...4322222221...',
             '...43......21...','...2111111110...','...5555555554...','...5555555554...','...4444444443...','...2222222221...',
             '...32......10...','...32......10...']),
'woodN': ck(['...5555555543...','...4444444432...','...43......21...','...4333333321...','...43......21...','...4322222221...',
             '...32......21...','...3244444421...','...2111111110...','...21......10...','...21......10...','...21......10...']),
'woodE': ck(['...54...........','...43...........','...42...........','...32...........','...42...........','...32...........',
             '...4215555554...','...4214444443...','...4222222221...','...42......21...','...42......21...','...42......21...']),
'woodW': ck(['...........54...','...........43...','...........42...','...........32...','...........42...','...........32...',
             '...5555554142...','...4444443142...','...2222221142...','...21......42...','...21......42...','...21......42...']),
'cafeE': ck(['...eed..........','...ec.c.........','...ec.c.........','...eccc.........','...ec...........','...ec...........',
             '...ec5555554....','...ec4444443....','...ec2222221....','...ec.....dc....','...ec.....dc....','...dc.....cb....']),
'cafeW': ck(['.........eeed...','.........c.ec...','.........c.ec...','.........ccec...','...........ec...','...........ec...',
             '....5555554ec...','....4444443ec...','....2222221ec...','....dc.....ec...','....dc.....ec...','....cb.....dc...']),
'offE': ck(['..443...........','..432...........','..321...........','..321...........','..321eeeeed.....','..321.....c.....',
            '..321.....c.....','..32555555554...','..21444444443...','...1222222221...','.......dc.......','.......dc.......',
            '..eeeeeedddddd..','..b....b.....b..']),
'offW': ck(['...........443..','...........432..','...........321..','...........321..','.....eeeeed321..','.....c.....321..',
            '.....c.....321..','...55555555421..','...44444444321..','...1222222221...','.......dc.......','.......dc.......',
            '..eeeeeedddddd..','..b....b.....b..']),
'armE': ck(['.443............','.432............','.321............','.321............','.321............','.321555555554...',
            '.321555555554...','.4444444444443..','.3333333333332..','.2222222222221..','.2222222222221..','.1111111111110..',
            '.r.........q....']),
'armW': ck(['............443.','............432.','............321.','............321.','............321.','...555555554321.',
            '...555555554321.','..4444444444443.','..3333333333332.','..2222222222221.','..2222222222221.','..1111111111110.',
            '....q.........r.']),
'bar': ck(['....55555554....','...5555555554...','...4444444443...','...2222222221...','....11111110....',
           '.......ed.......','.......ed.......','......eedc......','.......ed.......','.......ed.......',
           '....eeeedddd....','....bbbbbbbb....']),
'bath': ck(['...5555555554...','...4444444443...','...1111111110...','...3222222221...','...32......10...','...21......10...']),
'wheel': ck(['...f........e...','...e........d...','...e33333333d...','...e22222222d...','..dp11111111pc..',
             '.sdp11111111pcq.','.sdp11111111pcq.','.sdp00000000pcq.','.sdp44444444pcq.','.sdp44444443pcq.',
             '.rbp11111111pbq.','.rbp........pbq.','.rbp........pbq.','..b.ee....dd.b..','....cc....bb....']),
}
def g3(key, ramps, H=32, under=()):
    rows = D3[key]; im = grow2(dg(rows, ramps, H=H)); oy = H - 1 - len(rows)
    for u in under: open_under(im, oy + u)
    return im
def wheelchair_bay3():
    im = Image.new('RGBA', (32, 32)); c = Cv(32, 32); c.im = im; B = R['blue']; Wh = R['white']
    for y in range(1, 9):
        for x in range(12, 20):
            t = 3 if (y == 1 or x == 12) else 1 if (y == 8 or x == 19) else 2
            c.p(x, y, B[t])
    for x, y in ((15, 2), (15, 3), (15, 4), (16, 4), (17, 4), (17, 5), (18, 6), (13, 4), (13, 5), (14, 6), (15, 6), (16, 6)):
        c.p(x, y, Wh[4])
    narrow = [r[:8] + r[9:] for r in D3['wheel']]        # one cushion column fewer -> 15 wide, leaves a floor gap
    dg(narrow, ('blue', 'steel', 'dmet'), W=32, H=32, ox=0, im=im)
    dg(narrow, ('blue', 'steel', 'dmet'), W=32, H=32, ox=16, im=im)
    return grow2(im)
def zabuton3():
    c = Cv(32, 16)
    for ox, rp in ((1, 'zpur'), (17, 'zteal')):
        r = R[rp]
        for y in range(3, 13):
            for x in range(ox, ox + 14):
                if x in (ox, ox + 13) and y in (3, 12): continue
                if y == 12: t = 1
                elif y == 3: t = 5 if x < ox + 9 else 4
                elif y <= 5: t = 4
                else: t = 3
                if x >= ox + 12 and y < 12: t = 2
                if x == ox and 3 < y < 12: t = min(5, t + 1)
                c.p(x, y, r[t])
        c.p(ox + 6, 7, r[1]); c.p(ox + 7, 7, r[1]); c.p(ox + 6, 6, r[5])   # centre tuft: 2x1 stitch + lit pixel
    return c.outline()
def sofa_n3(c, ox, oy, rp, w, h=18, legs='wood'):
    r = R[rp]; x0, x1 = ox, ox + w - 1; ax = 4
    for x in range(x0 + 1, x1):
        c.p(x, oy, r[5]); c.p(x, oy + 1, r[4]); c.p(x, oy + 2, r[3])
        for y in range(oy + 3, oy + h - 4): c.p(x, y, r[2])
    for y in range(oy + 3, oy + h - 4): c.p(x0 + 1, y, r[3]); c.p(x1 - 1, y, r[1])
    third = (w - 2 * ax) // 3
    for k in (1, 2):
        sx = x0 + ax + k * third
        for y in range(oy + 3, oy + h - 4): c.p(sx, y, r[1])
    for i in range(ax):
        for y in range(oy + 5, oy + h - 2):
            tl = 5 if y == oy + 5 else 4 if y == oy + 6 else (3 if i < 2 else 2)
            tr = 4 if y == oy + 5 else 3 if y == oy + 6 else (1 if i >= 2 else 2)
            c.p(x0 + i, y, r[tl]); c.p(x1 - ax + 1 + i, y, r[tr])
    c.r(x0 + ax, oy + h - 4, x1 - ax, oy + h - 3, r[1])
    c.hl(x0, x1, oy + h - 2, r[0])
    L = R[legs]
    for lx in (x0 + 1, x1 - 2):
        c.p(lx, oy + h - 1, L[3]); c.p(lx + 1, oy + h - 1, L[1])
def karaoke3(rp='purple'):
    c = Cv(48, 48); r = R[rp]
    for x in range(1, 47):
        c.p(x, 1, r[4]); c.p(x, 2, r[3])
        for y in range(3, 8): c.p(x, y, r[2])
        c.p(x, 8, r[1])
    for sx in (24, 33):
        for y in range(3, 8): c.p(sx, y, r[1])
    for y in range(3, 41):
        for x, t in ((1, 3), (2, 2), (3, 2), (4, 2), (5, 1)): c.p(x, y, r[t])
    for y in range(9, 14):                                # long seat top plane
        for x in range(6, 43): c.p(x, y, r[5] if y < 11 else r[4])
    for y in (9, 10, 11, 12, 13): c.p(24, y, r[3]); c.p(33, y, r[3])
    for y in range(14, 18):                               # corner: seat top continues into the wing (one L plane)
        for x in range(6, 15): c.p(x, y, r[5] if x < 8 else r[4])
    for x in range(15, 43): c.p(x, 14, r[2]); c.p(x, 15, r[1]); c.p(x, 16, r[1]); c.p(x, 17, r[0])
    for y in range(18, 40):
        for x in range(6, 13): c.p(x, y, r[5] if x < 8 else r[4])
        c.p(13, y, r[2]); c.p(14, y, r[1])                 # wing's east apron starts under the long apron
    for x in range(6, 13): c.p(x, 27, r[3])
    for y in range(4, 18):
        for i, x in enumerate(range(43, 47)):
            t = (5, 5, 4, 4)[i] if y == 4 else (4, 4, 3, 3)[i] if y == 5 else (3, 2, 2, 1)[i]
            if y == 17: t = 0
            c.p(x, y, r[t])
    for y in range(40, 47):
        for x in range(1, 15):
            t = 5 if y == 40 else 4 if y == 41 else 2
            if x == 14 and t == 2: t = 1
            if y == 46: t = 0
            c.p(x, y, r[t])
    return c.outline()
# items that the round-2 judge accepted keep their exact round-2 pixels
KEEP2 = {'mci-armchair', 'mci-armchair-n', 'svc-barber-chair', 'clinic-dental-chair', 'cinema-seat-row', 'aud-seat-row', 'court-judge-bench'}
def build3():
    out = build2()
    wd = ('wood', 'dmet', 'wood'); nav = ('navy', 'dmet', 'steel'); ro = ('rose', 'steel', 'wood')
    out['mci-chair-wood-s'] = g3('woodS', wd); out['mci-chair-wood-n'] = g3('woodN', wd)
    out['mci-chair-wood-e'] = g3('woodE', wd); out['mci-chair-wood-w'] = g3('woodW', wd)
    out['mci-cafe-chair-e'] = g3('cafeE', wd); out['mci-cafe-chair-w'] = g3('cafeW', wd)
    out['mci-chair-office-e'] = g3('offE', nav, under=(12,)); out['mci-chair-office-w'] = g3('offW', nav, under=(12,))
    o = grow2(dg(D2['offN'], nav)); open_under(o, 31 - len(D2['offN']) + 13); out['mci-chair-office-n'] = o
    out['mci-armchair-e'] = g3('armE', ro); out['mci-armchair-w'] = g3('armW', ro)
    out['mci-bar-stool'] = g3('bar', ro)
    out['home-bath-stool'] = g3('bath', ('yel', 'yel', 'yel'), H=16)
    out['hospital-wheelchair'] = g3('wheel', ('blue', 'steel', 'dmet'))
    out['hosp-wheelchair-bay'] = wheelchair_bay3(); out['home-zabuton'] = zabuton3()
    c = Cv(48, 32); sofa_n3(c, 1, 12, 'navy', 46, 18); out['mci-sofa-n'] = c.outline()
    out['karaoke-sofa'] = karaoke3()
    return out

SIZES = {}
if __name__ == '__main__':
    sys.path.insert(0, '/tmp/seats34'); import extract
    mspec = json.load(open('/tmp/seats34/mc-spec-main.json')); extract.S['mc_main'] = (mspec, SHEET)
    out = build3()
    for pid, im in out.items():
        save(pid, im, extract.render('mc_main', pid).size)
    print('ok', len(out), sorted(out))
