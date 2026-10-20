# seat study 2 (사람 합격 2026-10-20) 그림 코드 사본 — 작업 폴더 /tmp/seats34/study2 경로를 그대로 둔다. 정본 그림은 tiledata/seats34/study2/art/, 판정은 human-verdicts.json.
"""worker jpsp — seat redraw study 2 (jp_city_interior, modern3 ramps only).
Fill letters per item; outline is added automatically around the silhouette (sumi -1, 4-neighbour).
'_' = keep transparent and never outline. 'O' = explicit outline pixel."""
import sys, os, json
sys.path.insert(0, '/home/main/z-project/rpg-zzu-interior-seats-34/scripts/content/jp-city/lib_blocks_lines')
from core import K, rgb
from PIL import Image

OUT = '/tmp/seats34/study2/out/batch/'
OL = ('sumi', -1)


def M(prim=None, frame=None, metal='tekko', acc=None, acc2=None):
    m = {'O': OL, 'o': ('sumi', 0), 's': ('sumi', 1)}
    if prim:
        m.update({'X': (prim, 3), 'E': (prim, 2), 'e': (prim, 1), 'c': (prim, 0), 'C': (prim, -1), 'n': (prim, -2), 'N': (prim, -3)})
    if frame:
        m.update({'J': (frame, 3), 'H': (frame, 2), 'l': (frame, 1), 'm': (frame, 0), 'd': (frame, -1), 'D': (frame, -2), 'Q': (frame, -3)})
    if metal:
        m.update({'W': (metal, 3), 'L': (metal, 2), 'M': (metal, 1), 't': (metal, 0), 'T': (metal, -1), 'U': (metal, -2)})
    if acc:
        m.update({'A': (acc, 2), 'a': (acc, 1), 'b': (acc, 0), 'B': (acc, -1), 'g': (acc, -2)})
    if acc2:
        m.update({'Y': (acc2, 2), 'y': (acc2, 1), 'z': (acc2, 0), 'Z': (acc2, -1), 'k': (acc2, -2)})
    return m


class Cv:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.g = [['.'] * w for _ in range(h)]

    def put(s, rows, x0=0, y0=0):
        for y, r in enumerate(rows):
            for x, ch in enumerate(r):
                if ch == ' ':
                    continue
                X, Y = x0 + x, y0 + y
                if 0 <= X < s.w and 0 <= Y < s.h and ch != '.':
                    s.g[Y][X] = ch
        return s

    def P(s, x, y, ch):
        if 0 <= x < s.w and 0 <= y < s.h:
            s.g[y][x] = ch

    def R(s, x0, y0, x1, y1, ch):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                s.P(x, y, ch)

    def render(s, m, outline=True):
        g = [r[:] for r in s.g]
        filled = lambda x, y: 0 <= x < s.w and 0 <= y < s.h and g[y][x] not in '._'
        if outline:
            add = []
            for y in range(s.h):
                for x in range(s.w):
                    if g[y][x] == '.' and any(filled(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                        add.append((x, y))
            for x, y in add:
                g[y][x] = 'O'
        im = Image.new('RGBA', (s.w, s.h))
        for y in range(s.h):
            for x in range(s.w):
                ch = g[y][x]
                if ch in '._':
                    continue
                im.putpixel((x, y), (*rgb(K(*m[ch])), 255))
        return im


def mirror(rows):
    return [r[::-1] for r in rows]


ITEMS = {}


def item(pid, w, h):
    def deco(fn):
        ITEMS[pid] = (w, h, fn)
        return fn
    return deco


# ---------------------------------------------------------------- long train seats 48x16
def long_seat(col):
    c = Cv(48, 16)
    # metal end partitions (lit on left column)
    for x0 in (1, 45):
        c.R(x0, 1, x0 + 1, 14, 't')
        c.R(x0, 1, x0, 14, 'L' if x0 == 1 else 'M')
        c.P(x0, 1, 'W'); c.P(x0 + 1, 1, 'L' if x0 == 1 else 'M')
    # backrest: lit rim 2 rows, darker face, crease
    c.R(3, 1, 44, 1, 'E'); c.R(3, 2, 44, 2, 'e')
    c.R(3, 3, 44, 5, 'C'); c.R(3, 6, 44, 6, 'n')
    # seat: big bright plane 4 rows, front face 2 rows
    c.R(3, 7, 44, 8, 'E'); c.R(3, 9, 44, 10, 'e')
    c.R(3, 11, 44, 11, 'c'); c.R(3, 12, 44, 12, 'C')
    # heater skirt under seat
    c.R(3, 13, 44, 13, 'T'); c.R(3, 14, 44, 14, 'U')
    # right columns one step darker
    c.R(44, 1, 44, 2, 'e'); c.R(44, 7, 44, 10, 'c')
    # cushion seams (one texture idea): 6 places of 7px
    for sx in (10, 17, 24, 31, 38):
        c.R(sx, 3, sx, 5, 'n'); c.R(sx, 7, sx, 10, 'c'); c.R(sx, 11, sx, 12, 'n')
    return c.render(M(col))


@item('st-long-seat-s', 48, 16)
def _():
    return long_seat('kon')


@item('st-priority-seat-s', 48, 16)
def _():
    return long_seat('daidai')


# ---------------------------------------------------------------- sofas from behind (N)
def sofa_back(w, col, seats, legs_metal=True):
    c = Cv(w, 32)
    top = 12
    # arms (side blocks): lit top cap 3 rows, then side faces
    for ax, right in ((1, False), (w - 6, True)):
        c.R(ax, top + 4, ax + 4, top + 4, 'E')
        c.R(ax, top + 5, ax + 4, top + 6, 'e')
        c.R(ax, top + 7, ax + 4, top + 15, 'C' if right else 'c')
        c.R(ax, top + 7, ax, top + 15, 'n' if right else 'c')
        c.R(ax, top + 16, ax + 4, top + 16, 'n')
    # back: top plane 2 rows (lit) + rear face (darker) between arms and over them
    x0, x1 = 3, w - 4
    c.R(x0, top, x1, top, 'E'); c.R(x0, top + 1, x1, top + 2, 'e')
    c.R(x0, top + 3, x1, top + 3, 'c')
    c.R(6, top + 4, w - 7, top + 15, 'C')
    c.R(6, top + 4, w - 7, top + 4, 'c')
    c.R(6, top + 16, w - 7, top + 16, 'n')
    c.R(x1, top, x1, top + 2, 'c')
    # seams between back cushions (vertical, top + face)
    inner = (w - 12)
    for i in range(1, seats):
        sx = 6 + inner * i // seats
        c.R(sx, top, sx, top + 2, 'c'); c.R(sx, top + 4, sx, top + 15, 'n')
    # legs
    for lx in (3, w - 5):
        c.R(lx, top + 17, lx + 1, top + 18, 'M' if legs_metal else 'm')
        c.P(lx + 1, top + 17, 't'); c.P(lx + 1, top + 18, 't')
    return c


@item('of-lobby-sofa-n', 32, 32)
def _():
    return sofa_back(32, 'yoru', 2).render(M('yoru'))


@item('pb-waiting-sofa-n', 48, 32)
def _():
    return sofa_back(48, 'sora', 3).render(M('sora'))


# ---------------------------------------------------------------- karaoke wall sofa segment 16x16 (tiles vertically)
def kr_sofa_e():
    rows = [
        'OEecOEEEEEEEEeO.',
        'OEecOEEEEEEEEeO.',
        'OEecnEEEEEEEEeO.',
        'OEecnEEEEEEEEeO.',
        'OEecnEEEEEEEEeO.',
        'OEecnEEEEEEEEeO.',
        'OEecneeeeeeeecO.',
        'OEecneeeeeeeecO.',
        'OEecneeeeeeeecO.',
        'OEecneeeeeeeecO.',
        'OEecneeeeeeeecO.',
        'OEecnccccccccCO.',
        'OEecnccccccccCO.',
        'OEecnCCCCCCCCnO.',
        'OEecOnnnnnnnnnO.',
        'OEecOOOOOOOOOOO.',
    ]
    return rows


@item('kr-sofa-e', 16, 16)
def _():
    c = Cv(16, 16).put(kr_sofa_e())
    return c.render(M('aka'), outline=False)


@item('kr-sofa-w', 16, 16)
def _():
    # mirrored layout, but light still from the left: back on the east side
    rows = [
        '.OEEEEEEEEeOEecO',
        '.OEEEEEEEEeOEecO',
        '.OEEEEEEEEenEecO',
        '.OEEEEEEEEenEecO',
        '.OEEEEEEEEenEecO',
        '.OEEEEEEEEenEecO',
        '.OeeeeeeeecnEecO',
        '.OeeeeeeeecnEecO',
        '.OeeeeeeeecnEecO',
        '.OeeeeeeeecnEecO',
        '.OeeeeeeeecnEecO',
        '.OcccccccCCnEecO',
        '.OcccccccCCnEecO',
        '.OCCCCCCCCnnEecO',
        '.OnnnnnnnnnOEecO',
        '.OOOOOOOOOOOEecO',
    ]
    return Cv(16, 16).put(rows).render(M('aka'), outline=False)


# ---------------------------------------------------------------- barber chairs 16x32 (aka upholstery, conc chrome, yoru base)
def barber_s():
    c = Cv(16, 32)
    # headrest
    c.R(6, 4, 9, 4, 'E'); c.R(6, 5, 9, 5, 'e'); c.P(9, 4, 'e'); c.P(9, 5, 'c')
    c.R(7, 6, 8, 6, 'M'); c.P(8, 6, 't')
    # back panel: lit rim 2 rows, darker face
    c.R(4, 7, 11, 7, 'E'); c.R(4, 8, 11, 8, 'e'); c.P(11, 7, 'e'); c.P(11, 8, 'c')
    c.R(4, 9, 11, 14, 'C'); c.R(4, 9, 4, 14, 'c'); c.R(11, 9, 11, 14, 'n')
    c.R(5, 9, 10, 9, 'c')
    # chrome arms over the sides
    c.R(2, 14, 3, 14, 'L'); c.R(12, 14, 13, 14, 'M')
    c.R(2, 15, 3, 19, 'M'); c.R(12, 15, 13, 19, 'T')
    c.R(2, 15, 2, 19, 'L'); c.R(13, 15, 13, 19, 'U')
    # crease, seat (bright plane 3 rows), front face 2 rows
    c.R(4, 15, 11, 15, 'n')
    c.R(4, 16, 11, 17, 'E'); c.R(4, 18, 11, 18, 'e'); c.R(11, 16, 11, 18, 'e')
    c.R(4, 19, 11, 19, 'c'); c.R(4, 20, 11, 20, 'C')
    # hydraulic post + round base
    c.R(7, 21, 8, 24, 'M'); c.R(8, 21, 8, 24, 't')
    c.R(4, 25, 11, 25, 'L'); c.R(4, 25, 4, 25, 'W'); c.R(11, 25, 11, 25, 'M')
    c.R(3, 26, 12, 26, 'M'); c.R(12, 26, 12, 26, 't')
    c.R(3, 27, 12, 27, 'T')
    # footrest plate under the seat front
    c.R(5, 22, 10, 22, 'L'); c.R(10, 22, 10, 22, 'M')
    return c


@item('sh-barber-chair-s', 16, 32)
def _():
    return barber_s().render(M('aka', metal='conc'))


@item('sh-barber-chair-n', 16, 32)
def _():
    c = Cv(16, 32)
    c.R(6, 3, 9, 3, 'E'); c.R(6, 4, 9, 5, 'C'); c.P(9, 3, 'e'); c.R(9, 4, 9, 5, 'n')
    c.R(7, 6, 8, 6, 'M'); c.P(8, 6, 't')
    # back seen from behind: lit top rim, big darker rear face with a stitched seam
    c.R(4, 7, 11, 7, 'E'); c.R(4, 8, 11, 8, 'e'); c.P(11, 7, 'e'); c.P(11, 8, 'c')
    c.R(4, 9, 11, 19, 'C'); c.R(4, 9, 4, 19, 'c'); c.R(11, 9, 11, 19, 'n')
    c.R(4, 20, 11, 20, 'n')
    # chrome arms visible at the sides
    c.R(2, 15, 3, 15, 'L'); c.R(12, 15, 13, 15, 'M')
    c.R(2, 16, 3, 19, 'M'); c.R(12, 16, 13, 19, 'T')
    c.R(2, 16, 2, 19, 'L'); c.R(13, 16, 13, 19, 'U')
    c.R(7, 21, 8, 24, 'M'); c.R(8, 21, 8, 24, 't')
    c.R(4, 25, 11, 25, 'L'); c.P(4, 25, 'W'); c.P(11, 25, 'M')
    c.R(3, 26, 12, 26, 'M'); c.P(12, 26, 't')
    c.R(3, 27, 12, 27, 'T')
    return c.render(M('aka', metal='conc'))


def barber_e():
    c = Cv(16, 32)
    # headrest + back as a tall post on the west (seen from the side), lit west column
    c.R(3, 4, 5, 5, 'e'); c.R(3, 4, 3, 5, 'E'); c.R(5, 4, 5, 5, 'c')
    c.R(4, 6, 4, 6, 'M')
    c.R(3, 7, 6, 16, 'c'); c.R(3, 7, 3, 16, 'E'); c.R(4, 7, 4, 16, 'e'); c.R(6, 7, 6, 16, 'C')
    c.R(3, 7, 6, 7, 'E')
    # seat: top plane 3 rows, front (south) face 2 rows; leans toward east
    c.R(7, 14, 12, 14, 'c')
    c.R(7, 15, 12, 16, 'E'); c.R(7, 17, 12, 17, 'e'); c.P(12, 15, 'e'); c.P(12, 16, 'e')
    c.R(3, 17, 6, 17, 'e')
    c.R(3, 18, 12, 18, 'c'); c.R(3, 19, 12, 19, 'C')
    # chrome arm on the near side
    c.R(6, 13, 11, 13, 'L'); c.P(11, 13, 'M'); c.R(11, 14, 11, 14, 'M')
    # post, footrest out to the east, base
    c.R(7, 20, 8, 24, 'M'); c.R(8, 20, 8, 24, 't')
    c.R(12, 20, 12, 22, 'M'); c.R(12, 23, 14, 23, 'L'); c.P(14, 23, 'M')
    c.R(4, 25, 11, 25, 'L'); c.P(4, 25, 'W'); c.P(11, 25, 'M')
    c.R(3, 26, 12, 26, 'M'); c.P(12, 26, 't')
    c.R(3, 27, 12, 27, 'T')
    return c


@item('sh-barber-chair-e', 16, 32)
def _():
    return barber_e().render(M('aka', metal='conc'))


@item('sh-barber-chair-w', 16, 32)
def _():
    c = Cv(16, 32)
    c.R(10, 4, 12, 5, 'e'); c.R(10, 4, 10, 5, 'E'); c.R(12, 4, 12, 5, 'c')
    c.P(11, 6, 'M')
    c.R(9, 7, 12, 16, 'c'); c.R(9, 7, 9, 16, 'E'); c.R(10, 7, 10, 16, 'e'); c.R(12, 7, 12, 16, 'C')
    c.R(9, 7, 12, 7, 'E')
    c.R(3, 14, 8, 14, 'c')
    c.R(3, 15, 8, 16, 'E'); c.R(3, 17, 8, 17, 'e'); c.P(8, 15, 'e'); c.P(8, 16, 'e')
    c.R(9, 17, 12, 17, 'e')
    c.R(3, 18, 12, 18, 'c'); c.R(3, 19, 12, 19, 'C')
    c.R(4, 13, 9, 13, 'L'); c.P(4, 13, 'W'); c.P(4, 14, 'M')
    c.R(7, 20, 8, 24, 'M'); c.R(8, 20, 8, 24, 't')
    c.R(3, 20, 3, 22, 'M'); c.R(1, 23, 3, 23, 'L'); c.P(1, 23, 'W')
    c.R(4, 25, 11, 25, 'L'); c.P(4, 25, 'W'); c.P(11, 25, 'M')
    c.R(3, 26, 12, 26, 'M'); c.P(12, 26, 't')
    c.R(3, 27, 12, 27, 'T')
    return c.render(M('aka', metal='conc'))


# ---------------------------------------------------------------- reclining seat 16x32 (yoru), massage chair 16x32 (renga)
def recliner(c, base='metal'):
    # headrest
    c.R(5, 5, 10, 5, 'X'); c.R(5, 6, 10, 7, 'e'); c.P(10, 5, 'E'); c.R(10, 6, 10, 7, 'c')
    c.R(5, 8, 10, 8, 'n')
    # back: lit rim + darker face with one seam
    c.R(4, 9, 11, 9, 'E'); c.R(4, 10, 11, 15, 'c'); c.R(4, 10, 4, 15, 'e'); c.R(11, 9, 11, 15, 'C')
    c.R(5, 12, 10, 12, 'C')
    # arms
    for ax, right in ((2, False), (12, True)):
        c.R(ax, 13, ax + 1, 13, 'E' if not right else 'e')
        c.R(ax, 14, ax + 1, 14, 'e' if not right else 'c')
        c.R(ax, 15, ax + 1, 20, 'c' if not right else 'C')
        c.R(ax, 15, ax, 20, 'e' if not right else 'C'); c.R(ax + 1, 15, ax + 1, 20, 'c' if not right else 'n')
    # crease, seat plane 3 rows, front face 2 rows
    c.R(4, 16, 11, 16, 'n')
    c.R(4, 17, 11, 18, 'X'); c.R(4, 19, 11, 19, 'E'); c.R(11, 17, 11, 19, 'E')
    c.R(4, 20, 11, 20, 'c'); c.R(4, 21, 11, 21, 'C')
    c.R(2, 21, 3, 21, 'C'); c.R(12, 21, 13, 21, 'n')


@item('kr-reclining-seat', 16, 32)
def _():
    c = Cv(16, 32)
    recliner(c)
    c.R(7, 22, 8, 24, 'M'); c.P(8, 22, 't'); c.P(8, 23, 't'); c.P(8, 24, 't')
    c.R(4, 25, 11, 25, 'L'); c.P(11, 25, 'M')
    c.R(3, 26, 12, 26, 'T')
    return c.render(M('yoru'))


@item('pb-massage-chair', 16, 32)
def _():
    c = Cv(16, 32)
    recliner(c)
    # big padded arm enclosures already; leg rest (calf unit) in front, then plinth
    c.R(4, 22, 11, 22, 'e'); c.R(4, 23, 11, 24, 'c'); c.R(11, 22, 11, 24, 'C')
    c.R(4, 25, 11, 25, 'n')
    c.R(3, 26, 12, 26, 'M'); c.R(3, 27, 12, 27, 'T'); c.P(3, 26, 'L')
    return c.render(M('renga'))


# ---------------------------------------------------------------- wheelchairs 16x32 (S-facing)
def wheelchair(fab, pad=None):
    c = Cv(16, 32)
    # push handles + back canvas (front panel, lit rim)
    c.R(3, 6, 4, 6, 'L'); c.R(11, 6, 12, 6, 'M')
    c.R(4, 7, 4, 14, 'L'); c.R(11, 7, 11, 14, 'M')
    c.R(5, 7, 10, 7, 'E'); c.R(5, 8, 10, 8, 'e'); c.R(5, 9, 10, 14, 'C'); c.R(10, 9, 10, 14, 'n')
    c.R(5, 9, 10, 9, 'c')
    # big wheels seen nearly edge-on: tyre (dark) + lit hand-rim, both sides
    for wx, right in ((1, False), (13, True)):
        c.R(wx, 11, wx + 1, 24, 'U')
        c.R(wx + (1 if not right else 0), 12, wx + (1 if not right else 0), 23, 'L' if not right else 'M')
        c.P(wx, 11, '_' if False else 'U')
    # arm rests (pads) across the wheels
    p = 'a' if pad else 'L'
    c.R(2, 13, 4, 13, p); c.R(11, 13, 13, 13, 'b' if pad else 'M')
    # seat: crease + 3 bright rows + front edge
    c.R(5, 15, 10, 15, 'n')
    c.R(4, 16, 11, 17, 'E'); c.R(4, 18, 11, 18, 'e'); c.R(11, 16, 11, 18, 'e')
    c.R(4, 19, 11, 19, 'C')
    # frame under the seat and forks to the footrests
    c.R(4, 20, 4, 25, 'M'); c.R(11, 20, 11, 25, 'T')
    c.R(5, 20, 10, 20, 't')
    c.R(4, 26, 6, 26, 'L'); c.R(9, 26, 11, 26, 'M')
    # caster wheels at the very front
    c.R(4, 27, 4, 28, 'U'); c.R(11, 27, 11, 28, 'U')
    return c


@item('hs-wheelchair', 16, 32)
def _():
    return wheelchair('kon').render(M('kon'))


@item('hp-wheelchair', 16, 32)
def _():
    return wheelchair('kon', pad=True).render(M('kon', acc='soil'))


# ---------------------------------------------------------------- side-lying chairs 16x16 (profile seen from above)
def lying_profile(c, flip, cushion_letters=True):
    """chair fallen on its side; the side face is now the lit top. up -> west (flip: east), front -> south.
    back stile = long bar on the north running to the floor end; seat = bar running south; front leg = short bar.
    vertical bars: west column lit. cushions sit on the inner side of back and seat."""
    X = (lambda x: 15 - x) if flip else (lambda x: x)
    def H(x0, x1, y, ch):
        for x in range(x0, x1 + 1): c.P(X(x), y, ch)
    def V(x, y0, y1, ch):
        for y in range(y0, y1 + 1): c.P(X(x), y, ch)
    lit = lambda a, b: (b, a) if flip else (a, b)
    # back stile + rear leg (metal pipe, 2 rows: lit top, shaded south face)
    H(1, 14, 3, 'L'); H(1, 14, 4, 'T'); c.P(X(14), 3, 'M')
    # seat frame (vertical, 2 cols)
    l, r = lit('L', 'T')
    V(9, 4, 11, l); V(10, 4, 11, r)
    # front leg
    H(9, 14, 10, 'L'); H(9, 14, 11, 'T'); c.P(X(14), 10, 'M')
    V(9, 10, 10, l); V(10, 10, 10, 'L')
    # back cushion: lit plane + south face
    H(2, 8, 5, 'E'); H(2, 8, 6, 'e'); H(2, 8, 7, 'C')
    # seat cushion: 3 cols, west lit
    a, b2 = lit('E', 'c')
    V(6, 5, 9, a); V(7, 5, 9, 'e'); V(8, 5, 9, b2)
    H(6, 8, 10, 'C')
    c.P(X(8), 5, 'e'); c.P(X(8), 6, 'e')


@item('hp-chair-fallen', 16, 16)
def _():
    c = Cv(16, 16)
    lying_profile(c, False)
    return c.render(M('sora'))


@item('as-chair-toppled', 16, 16)
def _():
    c = Cv(16, 16)
    lying_profile(c, True)
    return c.render(M('yuka'))


# ---------------------------------------------------------------- pipe chair 16x32 (folding, tekko + ita)
@item('gy-pipe-chair', 16, 32)
def _():
    c = Cv(16, 32)
    # pipe stiles
    c.R(4, 13, 4, 27, 'L'); c.R(11, 13, 11, 27, 'M')
    # backrest panel (wood) on the stiles: lit rim + darker face
    c.R(5, 13, 10, 13, 'H'); c.R(5, 14, 10, 14, 'l'); c.R(5, 15, 10, 16, 'd'); c.P(10, 13, 'l'); c.P(10, 14, 'm')
    c.R(5, 17, 10, 18, '_')
    c.R(5, 17, 10, 17, 'm')  # crease row
    # seat: 3 bright rows + front lip
    c.R(4, 18, 11, 19, 'H'); c.R(4, 20, 11, 20, 'l'); c.R(11, 18, 11, 20, 'l')
    c.R(4, 21, 11, 21, 'd')
    # X-brace hint: crossbar under seat
    c.R(5, 25, 10, 25, 't')
    return c.render(M(frame='ita'))


# ---------------------------------------------------------------- kids chair 16x16 (ladder back, yuka)
@item('fr-kids-chair', 16, 16)
def _():
    c = Cv(16, 16)
    # stiles 2px
    c.R(4, 3, 5, 13, 'c'); c.R(4, 3, 4, 13, 'E'); c.R(10, 3, 11, 13, 'C'); c.R(10, 3, 10, 13, 'c')
    c.R(4, 2, 5, 2, 'E'); c.R(10, 2, 11, 2, 'c')
    # top rail + one mid rail
    c.R(6, 3, 9, 3, 'E'); c.R(6, 4, 9, 4, 'c'); c.P(9, 3, 'e')
    c.R(6, 6, 9, 6, 'e')
    # crease / seat
    c.R(6, 7, 9, 7, 'C')
    c.R(4, 8, 11, 9, 'E'); c.R(11, 8, 11, 9, 'e')
    c.R(4, 10, 11, 10, 'c'); c.R(11, 10, 11, 10, 'C')
    # legs, open floor
    c.R(6, 11, 9, 13, '_')
    c.R(4, 11, 5, 13, 'c'); c.R(4, 11, 4, 13, 'e'); c.R(10, 11, 11, 13, 'C')
    c.R(6, 5, 9, 5, '_')
    return c.render(M('yuka'))


# ---------------------------------------------------------------- zabuton 16x16 (kon + aka tuft)
@item('zabuton', 16, 16)
def _():
    c = Cv(16, 16)
    c.R(2, 4, 13, 11, 'c')
    c.R(2, 4, 13, 5, 'E'); c.R(2, 6, 13, 9, 'e'); c.R(2, 4, 2, 9, 'E')
    c.R(13, 4, 13, 9, 'c')
    c.R(2, 10, 13, 10, 'c'); c.R(2, 11, 13, 11, 'C'); c.P(13, 10, 'C'); c.P(13, 11, 'n')
    c.P(7, 7, 'a'); c.P(8, 7, 'b')  # single centre tuft (one idea)
    return c.render(M('kon', acc='aka'))


# ---------------------------------------------------------------- bath stool + basin 16x16
@item('pb-wash-stool', 16, 16)
def _():
    c = Cv(16, 16)
    # yellow stool (left): top plane 2 rows, skirt, legs with open gap
    c.R(1, 7, 7, 8, 'E'); c.R(7, 7, 7, 8, 'e')
    c.R(1, 9, 7, 9, 'c'); c.R(1, 10, 7, 10, 'C')
    c.R(1, 11, 2, 13, 'c'); c.R(6, 11, 7, 13, 'C'); c.R(3, 11, 5, 13, '_'); c.P(1, 11, 'e')
    # blue basin (right): rim ring, inner water/bowl, outer face
    c.R(9, 6, 14, 6, 'a'); c.R(8, 7, 14, 7, 'a')
    c.P(8, 7, 'A'); c.R(9, 7, 13, 7, 'B'); c.R(9, 8, 13, 8, 'g'); c.R(8, 8, 8, 8, 'a'); c.R(14, 7, 14, 8, 'b')
    c.R(8, 9, 14, 9, 'A'); c.P(14, 9, 'a')
    c.R(8, 10, 14, 11, 'b'); c.R(8, 10, 8, 11, 'a'); c.R(14, 10, 14, 11, 'B')
    c.R(9, 12, 13, 12, 'B')
    return c.render(M('kii', acc='sora'))


# ---------------------------------------------------------------- engawa set 32x32: two rattan chairs (S) + small table
def rattan_chair(c, x0):
    # 12 wide chair: rattan frame (mado), kinari cushion
    c.R(x0, 10, x0 + 11, 10, 'H'); c.R(x0, 11, x0 + 11, 11, 'l')
    c.R(x0, 12, x0 + 1, 24, 'l'); c.R(x0, 12, x0, 24, 'H'); c.R(x0 + 10, 12, x0 + 11, 24, 'd'); c.R(x0 + 10, 12, x0 + 10, 24, 'm')
    c.R(x0 + 2, 12, x0 + 9, 17, 'm')
    for y in (13, 15):
        c.R(x0 + 2, y, x0 + 9, y, 'd')  # woven back bands (one texture)
    c.R(x0 + 11, 10, x0 + 11, 11, 'm')
    # back cushion (kinari panel, darker than seat)
    c.R(x0 + 3, 16, x0 + 8, 17, 'b')
    c.R(x0 + 2, 18, x0 + 9, 18, 'B')
    # seat cushion: bright plane 3 rows + front face
    c.R(x0 + 2, 19, x0 + 9, 20, 'A'); c.R(x0 + 2, 21, x0 + 9, 21, 'a'); c.R(x0 + 9, 19, x0 + 9, 21, 'a')
    c.R(x0 + 2, 22, x0 + 9, 22, 'b')
    c.R(x0 + 2, 23, x0 + 9, 23, 'm'); c.R(x0 + 2, 24, x0 + 9, 24, 'd')
    # legs
    c.R(x0, 25, x0 + 1, 26, 'm'); c.R(x0 + 10, 25, x0 + 11, 26, 'd')
    c.R(x0 + 2, 25, x0 + 9, 26, '_')


@item('ht-engawa-chairs', 32, 32)
def _():
    c = Cv(32, 32)
    rattan_chair(c, 1)
    rattan_chair(c, 19)
    # small round table between
    c.R(14, 16, 17, 16, 'y'); c.R(13, 17, 18, 18, 'y'); c.R(13, 17, 13, 18, 'Y'); c.R(18, 17, 18, 18, 'z')
    c.R(14, 16, 14, 16, 'Y')
    c.R(13, 19, 18, 19, 'Z')
    c.R(15, 20, 16, 25, 'z'); c.R(16, 20, 16, 25, 'Z')
    c.R(14, 26, 17, 26, 'Z')
    c.P(15, 17, 'A')  # cup
    return c.render(M(frame='mado', acc='kinari', acc2='ita'))


# ================================================================ ROUND 2 (judge r1 notes): explicit grids
def G(w, h, rows, m, y0=0):
    c = Cv(w, h)
    for r in rows:
        assert len(r) == w, (len(r), r)
    c.put(rows, 0, y0)
    return c.render(m, outline=False)


BARBER_S2 = [
    '......OOOO......',
    '.....OEEEeO.....',
    '.....OecccO.....',
    '......OMtO......',
    '....OOOOOOOO....',
    '...OEEEEEEeeO...',
    '...OeccccccCO...',
    '...OcCCCCCCnO...',
    '...OcCCCCCCnO...',
    '...OcCCCCCCnO...',
    '.OOOcCCCCCCnOOO.',
    'OLLMonnnnnnnoMtO',
    'OMtToEEEEEEeotTO',
    'OMtToEEEEEEeotTO',
    'OTTUoeeeeeecoTUO',
    '.OOOOccccccCOOO.',
    '....OCCCCCCnO...',
    '.....OOOOOOO....',
    '......OLtO......',
    '......OLtO......',
    '....OOOLtOOO....',
    '...OWLLLLMMtO...',
    '...OMMMMMttTO...',
    '....OOOOOOOO....',
]
BARBER_N2 = [
    '......OOOO......',
    '.....OEEEeO.....',
    '.....OCCCnO.....',
    '......OMtO......',
    '....OOOOOOOO....',
    '...OEEEEEEeeO...',
    '...OeeeeeeecO...',
    '...OcCCCCCCnO...',
    '...OcCCCCCCnO...',
    '...OcnnnnnnnO...',
    '.OOOcCCCCCCnOOO.',
    'OLLMocCCCCCnoMtO',
    'OMtTocCCCCCnotTO',
    'OMtTocCCCCCnotTO',
    'OTTUocCCCCCnoTUO',
    '.OOOOnnnnnnnOOO.',
    '....OOOOOOOOO...',
    '......OLtO......',
    '......OLtO......',
    '......OLtO......',
    '....OOOLtOOO....',
    '...OWLLLLMMtO...',
    '...OMMMMMttTO...',
    '....OOOOOOOO....',
]
BARBER_E2 = [
    '..OOOO..........',
    '.OEEecO.........',
    '.OecccO.........',
    '..OOMO..........',
    '..OOOOO.........',
    '..OEecO.........',
    '..OEecO.........',
    '..OEecO.........',
    '..OEecO.........',
    '..OEecOOOOOO....',
    '..OEecOLLLMtO...',
    '..OEecOOOOMTO...',
    '..OEecCEEEEEeO..',
    '..OEecCEEEEEeO..',
    '..OEecCeeeeecO..',
    '..OccccccccccO..',
    '..OCCCCCCCCCnO..',
    '...OOOOOOOOOO...',
    '......OLtO..OMO.',
    '......OLtO..OMO.',
    '....OOOLtOOOLMMO',
    '...OWLLLLMMtOOO.',
    '...OMMMMMttTO...',
    '....OOOOOOOO....',
]
BARBER_W2 = [
    '..........OOOO..',
    '.........OEEecO.',
    '.........OecccO.',
    '..........OMOO..',
    '.........OOOOO..',
    '.........OEecO..',
    '.........OEecO..',
    '.........OEecO..',
    '.........OEecO..',
    '....OOOOOOEecO..',
    '...OLLLMtOEecO..',
    '...OMTOOOOEecO..',
    '..OEEEEEeCEecO..',
    '..OEEEEEeCEecO..',
    '..OeeeeecCEecO..',
    '..OccccccccccO..',
    '..OCCCCCCCCCnO..',
    '...OOOOOOOOOO...',
    '.OMO..OLtO......',
    '.OMO..OLtO......',
    'OLMMOOOLtOOO....',
    '.OOOOWLLLLMMtO..',
    '....OMMMMMttTO..',
    '.....OOOOOOOO...',
]


@item('sh-barber-chair-s', 16, 32)
def _():
    return G(16, 32, BARBER_S2, M('aka', metal='conc'), y0=3)


@item('sh-barber-chair-n', 16, 32)
def _():
    return G(16, 32, BARBER_N2, M('aka', metal='conc'), y0=3)


@item('sh-barber-chair-e', 16, 32)
def _():
    return G(16, 32, BARBER_E2, M('aka', metal='conc'), y0=3)


@item('sh-barber-chair-w', 16, 32)
def _():
    return G(16, 32, BARBER_W2, M('aka', metal='conc'), y0=3)


RECL_TOP = [
    '.....OOOOOO.....',
    '....OXXXXXEO....',
    '....OeccccCO....',
    '....OnnnnnnO....',
    '...OOOOOOOOOO...',
    '...OEEEEEEEeO...',
    '...OcccccccCO...',
    '...OCCCCCCCnO...',
    '...OcccccccCO...',
    '.OOOCCCCCCCnOOO.',
    'OEEeOcccccccOecO',
    'OeecOcccccccOccO',
    'OcccOnnnnnnnOCnO',
    'OcccOXXXXXXEOCnO',
    'OcccOXXXXXXEOCnO',
    'OcccOEEEEEEeOCnO',
    'OCCCOcccccccOnNO',
]


@item('kr-reclining-seat', 16, 32)
def _():
    rows = RECL_TOP + [
        'OOOOOCCCCCCnOOOO',
        '....OOOOOOOO....',
        '......OMtO......',
        '......OMtO......',
        '....OOOMtOOO....',
        '...OLLLLMMMtO...',
        '...OTTTTTTTUO...',
        '....OOOOOOOO....',
    ]
    return G(16, 32, rows, M('yoru'), y0=3)


@item('pb-massage-chair', 16, 32)
def _():
    rows = RECL_TOP + [
        'OOOOOnnnnnnnOOOO',
        '...OeEEEEEEeO...',
        '...OcccccccCO...',
        '...OCCCCCCCnO...',
        '...OCCCCCCCnO...',
        '..OOOOOOOOOOOO..',
        '..OLLLLLMMMMtO..',
        '..OTTTTTTTTTUO..',
        '...OOOOOOOOOO...',
    ]
    return G(16, 32, rows, M('renga'), y0=3)


def wheel_rows(pad):
    top8 = '.OOOLeeeeecMOOO.' if pad else '...OLeeeeecMO...'
    r9 = 'OabOLCCCCCnMObBO' if pad else '.OOOLCCCCCnMOOO.'
    return [
        '...OO......OO...',
        '..OLLO....OMtO..',
        '...OLOOOOOOMO...',
        '...OLEEEEEEMO...',
        top8,
        r9,
        'OULOLCCCCCnMOMUO',
        'OULOLCCCCCnMOMUO',
        'OULOLnnnnnnMOMUO',
        'OULOEEEEEEEeOMUO',
        'OULOEEEEEEEeOMUO',
        'OULOeeeeeeecOMUO',
        'OULOCCCCCCCnOMUO',
        'OULOOOOOOOOOOMUO',
        'OULOLO....OMOMUO',
        'OULOLO....OMOMUO',
        'OUTOLO....OMOTUO',
        '.OO.OLO..OMO.OO.',
        '....OLLOOMMO....',
        '....OTTOOTTO....',
        '.....OO..OO.....',
    ]


@item('hs-wheelchair', 16, 32)
def _():
    return G(16, 32, wheel_rows(False), M('kon'), y0=5)


@item('hp-wheelchair', 16, 32)
def _():
    return G(16, 32, wheel_rows(True), M('kon', acc='soil'), y0=5)


def lying2(flip):
    rows = [
        '................',
        '................',
        '.OOOOOOOOOOOOO..',
        'OLLLLLLLLLLLLMO.',
        'OTTTTTTTTLTTTUO.',
        'OEEEEEeeOLOOOO..',
        'OeeeeeecOLO.....',
        '.OCCCCOnOLO.....',
        '.....OEcOLO.....',
        '.....OEcOLO.....',
        '.....OecOLOOOO..',
        '.....OCCOLLLLMO.',
        '......OOOTTTTUO.',
        '.........OOOOO..',
        '................',
        '................',
    ]
    if flip:
        sw = {}
        rows = [r[::-1] for r in rows]
        # keep light from the left: swap lit/dark on the vertical parts
        out = []
        for r in rows:
            r = r.replace('cE', 'Ec').replace('ce', 'ec')
            out.append(r)
        rows = out
    return rows


@item('hp-chair-fallen', 16, 16)
def _():
    return G(16, 16, lying2(False), M('sora'))


@item('as-chair-toppled', 16, 16)
def _():
    return G(16, 16, lying2(True), M('yuka'))


@item('pb-wash-stool', 16, 16)
def _():
    rows = [
        '................',
        '................',
        '................',
        '................',
        '................',
        '.OOOOOOO........',
        'OEEEEEEeO.......',
        'OEEEEEEeO.OOOO..',
        'OcccccccO.OaaaO.',
        'OCCCCCCCOOaBgBbO',
        'OcOOOOOCOOAaaabO',
        'OcO...OCOObbbbBO',
        'OcO...OCO.OBBBO.',
        'OOO...OOO..OOO..',
        '................',
        '................',
    ]
    return G(16, 16, rows, M('kii', acc='sora'))


@item('kr-sofa-e', 16, 16)
def _():
    rows = [
        'OEecOEEEEEEEEeO.',
        'OEecCEEEEEEEEeO.',
        'OEecCEEEEEEEEeO.',
        'OEecCEEEEEEEEeO.',
        'OEecCEEEEEEEEeO.',
        'OEecCEEEEEEEEeO.',
        'OEecCeeeeeeeeeO.',
        'OEecCeeeeeeeeeO.',
        'OEecCeeeeeeeeeO.',
        'OEecCeeeeeeeeeO.',
        'OEecCeeeeeeeecO.',
        'OEecnnnnnnnnnnO.',
        'OcCnOcccccccccO.',
        'OCnnOCCCCCCCCnO.',
        'OnnnOnnnnnnnnnO.',
        'OOOOOOOOOOOOOOO.',
    ]
    return G(16, 16, rows, M('aka'))


@item('kr-sofa-w', 16, 16)
def _():
    rows = [
        '.OEEEEEEEEeOEecO',
        '.OEEEEEEEEeCEecO',
        '.OEEEEEEEEeCEecO',
        '.OEEEEEEEEeCEecO',
        '.OEEEEEEEEeCEecO',
        '.OEEEEEEEEeCEecO',
        '.OeeeeeeeeeCEecO',
        '.OeeeeeeeeeCEecO',
        '.OeeeeeeeeeCEecO',
        '.OeeeeeeeeeCEecO',
        '.OeeeeeeeecCEecO',
        '.OnnnnnnnnnnEecO',
        '.OcccccccccOcCnO',
        '.OCCCCCCCCnOCnnO',
        '.OnnnnnnnnnOnnnO',
        '.OOOOOOOOOOOOOOO',
    ]
    return G(16, 16, rows, M('aka'))


def sofa_back2(w, col, seats):
    c = sofa_back(w, col, seats)
    top = 12
    # brighter back rim, inner dark separation between arms and back face, same rear tone on both arms
    c.R(3, top, w - 4, top, 'X'); c.R(3, top + 1, w - 4, top + 1, 'E')
    for ax in (1, w - 6):
        c.R(ax, top + 7, ax + 4, top + 15, 'C'); c.R(ax, top + 7, ax, top + 15, 'c')
    c.R(5, top + 4, 5, top + 16, 'N'); c.R(w - 6, top + 4, w - 6, top + 16, 'N')
    c.R(6, top + 4, w - 7, top + 4, 'c')
    return c


@item('of-lobby-sofa-n', 32, 32)
def _():
    return sofa_back2(32, 'yoru', 2).render(M('yoru'))


@item('pb-waiting-sofa-n', 48, 32)
def _():
    return sofa_back2(48, 'sora', 3).render(M('sora'))


def rattan_chair2(c, x0):
    rattan_chair(c, x0)
    # inner dark separation between the arm frames and back/seat, legs outlined
    c.R(x0 + 2, 12, x0 + 2, 24, 'D'); c.R(x0 + 9, 12, x0 + 9, 24, 'D')
    c.R(x0 + 3, 19, x0 + 8, 20, 'A'); c.R(x0 + 3, 21, x0 + 8, 21, 'a'); c.R(x0 + 3, 22, x0 + 8, 22, 'b')
    c.R(x0 + 3, 23, x0 + 8, 23, 'm'); c.R(x0 + 3, 24, x0 + 8, 24, 'd')
    c.R(x0 + 3, 16, x0 + 8, 17, 'b'); c.R(x0 + 3, 18, x0 + 8, 18, 'B')
    c.R(x0 + 3, 12, x0 + 8, 15, 'm'); c.R(x0 + 3, 13, x0 + 8, 13, 'd'); c.R(x0 + 3, 15, x0 + 8, 15, 'd')
    c.R(x0 + 2, 25, x0 + 9, 25, '_'); c.R(x0 + 2, 26, x0 + 9, 26, '_')
    c.R(x0, 25, x0 + 1, 26, 'm'); c.R(x0 + 10, 25, x0 + 11, 26, 'd')


@item('ht-engawa-chairs', 32, 32)
def _():
    c = Cv(32, 32)
    rattan_chair2(c, 1)
    rattan_chair2(c, 19)
    c.R(14, 16, 17, 16, 'y'); c.R(13, 17, 18, 18, 'y'); c.R(13, 17, 13, 18, 'Y'); c.R(18, 17, 18, 18, 'z')
    c.R(14, 16, 14, 16, 'Y')
    c.R(13, 19, 18, 19, 'Z')
    c.R(15, 20, 16, 25, 'z'); c.R(16, 20, 16, 25, 'Z')
    c.R(14, 26, 17, 26, 'Z')
    c.P(15, 17, 'A')
    return c.render(M(frame='mado', acc='kinari', acc2='ita'))


# ================================================================ ROUND 3
def lying3(flip, legs):
    hi, lo, end, endlo = legs
    rows = [
        '................',
        '................',
        '.OOOOOOOOOOOOOO.',
        'OEEEEEEe' + hi * 5 + end * 2 + 'O',
        'Oeeeeeec' + lo * 6 + endlo + 'O',
        'OCCCCCnEcOOOOOO.',
        '.OOOOOEEcO......',
        '.....OEEcO......',
        '.....OEEcO......',
        '.....OEecO......',
        '.....OeecOOOOOO.',
        '.....OCCn' + hi * 4 + end * 2 + 'O',
        '.....Onnn' + lo * 5 + endlo + 'O',
        '......OOOOOOOOO.',
        '................',
        '................',
    ]
    if flip:
        rows = [r[::-1] for r in rows]
        rows = [r.replace('cEE', 'EEc').replace('cEe', 'eEc').replace('cee', 'eec').replace('nCC', 'CCn').replace('Een', 'nEe').replace('EcCC', 'CCEc') for r in rows]
    return rows


@item('hp-chair-fallen', 16, 16)
def _():
    return G(16, 16, lying3(False, 'LTMU'), M('sora'))


@item('as-chair-toppled', 16, 16)
def _():
    return G(16, 16, lying3(True, 'ldmD'), M('yuka', frame='ita'))


def rattan_chair3(c, x0):
    rattan_chair2(c, x0)
    # arm frames start 3 rows below the back top; backrest top stays full width only between the frames
    for x in (x0, x0 + 1, x0 + 10, x0 + 11):
        for y in (10, 11, 12):
            c.P(x, y, '.')
    c.R(x0 + 2, 10, x0 + 9, 10, 'H'); c.R(x0 + 2, 11, x0 + 9, 11, 'l'); c.P(x0 + 9, 10, 'l'); c.P(x0 + 9, 11, 'm')
    c.R(x0, 13, x0 + 1, 13, 'H'); c.R(x0 + 10, 13, x0 + 11, 13, 'l')


@item('ht-engawa-chairs', 32, 32)
def _():
    c = Cv(32, 32)
    rattan_chair3(c, 1)
    rattan_chair3(c, 19)
    c.R(14, 16, 17, 16, 'y'); c.R(13, 17, 18, 18, 'y'); c.R(13, 17, 13, 18, 'Y'); c.R(18, 17, 18, 18, 'z')
    c.R(14, 16, 14, 16, 'Y')
    c.R(13, 19, 18, 19, 'Z')
    c.R(15, 20, 16, 25, 'z'); c.R(16, 20, 16, 25, 'Z')
    c.R(14, 26, 17, 26, 'Z')
    c.P(15, 17, 'A')
    return c.render(M(frame='mado', acc='kinari', acc2='ita'))


def build(ids=None):
    os.makedirs(OUT, exist_ok=True)
    for pid, (w, h, fn) in ITEMS.items():
        if ids and pid not in ids:
            continue
        im = fn()
        assert im.size == (w, h), (pid, im.size)
        im.save(OUT + pid + '.png')
    return list(ITEMS)


if __name__ == '__main__':
    print(build(sys.argv[1:] or None))
