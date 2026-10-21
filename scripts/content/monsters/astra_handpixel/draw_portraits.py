#!/usr/bin/env python3
"""Hand-pixelled dialogue busts for Astra Horizon.

Run:  python3 draw_portraits.py            -> writes <id>/bust-*.png (88x92, 2x of a 44x46 grid)
Every pixel is a letter in a row string below. No generated or traced art.
Grid 44x46 = runtime bust grid (src/player/bustPixelate.ts BUST_ART_WIDTH/HEIGHT); x2 = the 88x92 portrait box.
"""
import os
import sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pxlib import Part, compose, check_rows, pad, W, H

HERE = os.path.dirname(os.path.abspath(__file__))
SCALE = 2

# ---------------------------------------------------------------- shared faces
# 22 wide; cols 0-2 = ear on the near (viewer-left) side, face proper cols 2..21.
# Face looks slightly to the viewer's right: chin sits right of centre, far jaw short, near jaw long.
FACES = {
 # light from the upper left: far cheek / jaw (viewer-right) and the chin underside carry the shade ramp
 'young': [
    "......SSSSSSSSSSSS....",
    "....SSSSSSSSSSSSSSSS..",
    "...SSSSSSSSSSSSSSSSSS.",
    "...SSSSSSSSSSSSSSSSSSs",
    "..SSSSSSSSSSSSSSSSSSSs",
    "..SSSSSSSSSSSSSSSSSSSs",
    "..SSSSSSSSSSSSSSSSSSSs",
    "..SSSSSSSSSSSSSSSSSSSs",
    ".ssSSSSSSSSSSSSSSSSSSs",
    "sSsSSSSSSSSSSSSSSSSsss",
    "ssSSSSSSSSSSSSSSSSSsss",
    ".sSSSSSSSSSSSSSSSSSsss",
    "..SSSSSLLSSSSSSLSSsss.",
    "..SSSSSSSSSSSSSSSSsss.",
    "...SSSSSSSSSSSSSSsss..",
    "....SSSSSSSSSSSSSsss..",
    ".....SSSSSSSSSSSsss...",
    "......sSSSSSSSSsss....",
    "........ssSSSSss......",
    "..........ssss........",
 ],
 'adult': [
    "......SSSSSSSSSSSS....",
    "....SSSSSSSSSSSSSSSS..",
    "...SSSSSSSSSSSSSSSSSS.",
    "...SSSSSSSSSSSSSSSSSSs",
    "..SSSSSSSSSSSSSSSSSSSs",
    "..SSSSSSSSSSSSSSSSSSSs",
    "..SSSSSSSSSSSSSSSSSSSs",
    "..SSSSSSSSSSSSSSSSSSSs",
    "..SSSSSSSSSSSSSSSSSSSs",
    ".ssSSSSSSSSSSSSSSSSSSs",
    "sSsSSSSSSSSSSSSSSSSsss",
    "ssSSSSSSSSSSSSSSSSSsss",
    ".sSSSSSSSSSSSSSSSSSsss",
    "..sSSSSLLSSSSSSSSSsss.",
    "..sSSSSSSSSSSSSSSSsss.",
    "...sSSSSSSSSSSSSSSsss.",
    "....sSSSSSSSSSSSSSss..",
    ".....sSSSSSSSSSSSSss..",
    "......ssSSSSSSSSSsss..",
    ".......sssSSSSSSsss...",
    ".........ssssssss.....",
    "...........ssss.......",
 ],
}
NECKS = {
 'young': ["sssssss", "sssssss", "sssssss", "SssssSS", "SSsssSS", "SSSSSSS", "SSSSSSS"],
 'adult': [".ssssss", ".ssssss", ".ssssss", ".sssssS", ".SsssSS", ".SSSSSS", ".SSSSSS"],
}

# Eye / brow / mouth patches, coordinates relative to the face offset; drawn last (brows show through bangs).
# o = lash / line, Q = white, e = pupil (dark), E = iris, b = brow, M = mouth line, m = mouth inside / blush,
# n = nose shade, s = skin shade (soft mouth corners)
def feat(near, far, brow_n, brow_f, mouth, eye_y, brow_y, mouth_xy, near_x=7, far_x=15, nose=(14, 12), extra=()):
    p = [(near_x, eye_y, near), (far_x, eye_y, far),
         (near_x, brow_y, brow_n), (far_x, brow_y, brow_f),
         (mouth_xy[0], mouth_xy[1], mouth)]
    if nose:
        p.append((nose[0], nose[1], ["n"]))
    p += list(extra)
    return p


def expr_set(style):
    if style == 'young':
        ey, by, my, nz = 8, 6, 15, (14, 12)
    else:  # adult: a row lower on the longer face
        ey, by, my, nz = 9, 7, 17, (16, 13)
    return {
        # calm: open eyes, level brows, soft closed smile
        'base': feat(["oooo", "QeQo", "QEE.", ".EE."], ["ooo", "eQo", "EE.", "EE."],
                     ["bbbb"], ["bbb"], ["s..s", ".MM."], ey, by, (11, my - 1), nose=nz),
        # happy: closed ^ eyes, lifted brows, open laughing mouth, blush
        'happy': feat(["....", ".oo.", "o..o", "...."], ["...", ".o.", "o.o", "..."],
                      ["bbb."], [".bb"], ["MMMMM", ".MmmM", "..MM."], ey, by - 1, (10, my - 1), nose=nz,
                      extra=[(6, ey + 4, ["mm"]), (18, ey + 4, ["m"])]),
        # surprised: round wide eyes (thin rounded top, whites all round small pupils), brows lifted clear of the
        # eye, open dark O mouth
        'surprised': feat([".oo.", "oQQo", "QeEQ", "QQQQ", ".QQ."], [".o.", "oQo", "QeQ", "QQQ", ".Q."],
                          [".bb.", "b..b"], [".b.", "b.b"], [".MM.", "MooM", "MmmM", ".MM."], ey - 1, ey - 4, (11, my - 1), nose=nz),
        # angry: lids dropped, steep brows, shouting with teeth
        'angry': feat(["....", "oooo", "QeEo", ".EE."], ["...", "ooo", "eEo", "EE."],
                      ["b...", "bbb.", ".bbb"], ["..b", ".bb", "bb."], ["MMMMM", "MQQQM", ".MMM."], ey, by - 1, (10, my - 1), nose=nz),
    }


def build(char, expr):
    c = char
    sk = c['skin']
    fo = c['face_off']
    no = c['neck_off']
    parts = []
    parts += c.get('behind', [])
    parts.append(Part(NECKS[c['face']], no, {'S': sk['S'], 's': sk['s']}, outline=sk['k'], group='skin', name='neck'))
    parts += c.get('body', [])
    face = Part(FACES[c['face']], fo, {'S': sk['S'], 's': sk['s'], 'L': sk['L']}, outline=sk['k'], group='skin', name='face')
    face.cast = ({'hair', 'cap'}, sk['s'])   # 1px shadow under fringe / brim
    parts.append(face)
    parts += c.get('under_feat', [])
    parts += c.get('hair', [])
    parts += c.get('top', [])
    fpal = {'o': c['line'], 'Q': c['white'], 'e': c['line'], 'E': c['iris'], 'b': c['brow'],
            'M': sk['k'], 'm': c['mouth'], 'n': sk['s'], 's': sk['s'], 'S': sk['S']}
    ex = (c.get('expr_override') or {}).get(expr) or expr_set(c['eyes'])[expr]
    if c.get('lashes'):
        ey = 9 if c['eyes'] == 'adult' else 8
        dy = 1 if expr == 'happy' else 0
        ex = ex + [(6, ey + dy, ["o"]), (18, ey + dy, ["o"])]
    for dx, dy, rows in ex:
        parts.append(Part(rows, (fo[0] + dx, fo[1] + dy), fpal, name=f'feat-{expr}'))
    parts += c.get('over_face', [])
    return compose(parts)


def fill_between(rows):
    """Back-of-head fill: span each hand row from its first to last painted pixel."""
    out = []
    for r in rows:
        t = r.rstrip('.')
        l = len(t) - len(t.lstrip('.'))
        out.append('.' * l + 'H' * (len(t) - l) + '.' * (len(r) - len(t)) if t else r)
    return out


# ---------------------------------------------------------------- characters
CHARS = {}

# ---- professor (ScarloxyPeople14 slot 1): brown spiky hair + tuft, glasses, white lab coat over navy shirt, gold star
PROF_HAIR = {'H': '874b36', 'h': '5c3022', 'I': 'a86b4a', 'g': 'd6dfed', 'G': 'b9b5ae'}
PROF_HAIR_OUT = '381c14'
PROF_HAIR_B = [  # offset (6,0): silhouette of the hair mass behind the head
    "................................",
    "................................",
    "................................",
    "................................",
    "..........HHHHHHHHHHHHH.........",
    "......HHHHHHHHHHHHHHHHHHHHH.....",
    ".....HHHHHHHHHHHHHHHHHHHHHHHH...",
    "...HHHHHHHHHHHHHHHHHHHHHHHHHHH..",
    "..HHHHHHHHHHHHHHHHHHHHHHHHHHHHH.",
    "..HHHHHHHHHHHHHHHHHHHHHHHHHHHHH.",
    ".HHHHHHHHHHHHHHHHHHHHHHHHHHHHHH.",
    ".HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH",
    ".HHHHHHHHHHHHHHHHHHHHHHHHHHHHHH.",
    "hHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH.",
    "hHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH",
    "hhHHHHHHHHHHHHHHHHHHHHHHHHHHHHh.",
    "hhHHHHHHHHHHHHHHHHHHHHHHHHHHHHh.",
    "hhhHHHHHHHHHHHHHHHHHHHHHHHHHHh..",
    ".hhHHHHHHHHHHHHHHHHHHHHHHHHHHh..",
    "hhhh.....................hhhh...",
    ".hhh......................hh....",
    "..hh............................",
    "...h............................",
]
PROF_HAIR_F = [  # offset (6,0): tuft, crown, spiky bangs, side locks (face shows through '.')
    "...............hh...............",
    "..............hHh...............",
    "..............hHh...............",
    "..........hhhhHHhhhhh...........",
    ".......hhhHHHHHHHHHHHhhh........",
    "......hhhHHHHHHHHHHHHHhHHh......",
    ".....hHHHHHHIIIHHHHHHHHHHHhh....",
    "...hhHHHHHIIIHHHHHHHHHHHHHHHh...",
    "..hHHHHHHIIHHHHHHHHHHHHHHHHHHh..",
    "...hHHHHHHHHHHHHHHHHHHHHHHHHHHh.",
    "..hHHHHHHHHHHHHHHHHHHHHHHHHHHHh.",
    "..hHHHHHHHHHHHHhHHHHHHHHHHHHHHHh",
    ".hHHHHHHHHHHHHh.hHHHHHHhHHHHHHh.",
    "hHHHHHHHHHHHh...hHHHHHh.hHHHHHh.",
    "hHHHHHHHHHHh.....hHHHh...hHHHHHh",
    "hHHHHHhHHHh.......hHh.....hHHHh.",
    "hHHHHhhHHh.........h......hHHHh.",
    "hHHHHh.hh..................hHh..",
    "hHHHh......................hHh..",
    ".hHHh......................hh...",
    ".hHh........................h...",
    "..hh............................",
    "..h.............................",
]
PROF_COAT = {'W': 'f2f6fc', 'w': 'd6dfed', 'x': 'b9b5ae', 'C': '2e3d6c', 'c': '2e3d6c', 'A': 'f2c84b'}
PROF_BODY = pad([  # offset (0,32): open white coat with wide flared collar over a navy shirt
    "..............wWWWw.......wWWWw",
    "...........wWWWWWWWw.....wWWWWWWWw",
    ".........wWWWWWWWxCCCCCCCCCxWWWWWWWw........",
    ".......wWWWWWWWWWxCCCCCCCCCxWWWWWWWWWw......",
    ".....wWWWWWWWWWWxCCCCCCCCCCCxWWWWWWWWWWw....",
    "....wWWWWWWWWWWWxCCCCCCCCCCCxWWWWWWWWWWWw...",
    "...wWWWWWWWWWWWWxCCCCCCCCCCCxWWWWWWWWWWWWw..",
    "..wWWWWWWWWWWWWWxCCCCCCCCCCCxWWWWWWWWWWWWWw.",
    "..wWWWWWWWWWWWWWxCCCCCCCCCCCxWWWWWWWWWWWWWw.",
    ".wWWWWWwWWWWWWWWxCCCCCCCCCCCxWWWWWWWwWWWWWWw",
    ".wWWWWwWWWWWWWWWxCCCCCCCCCCCxWWWWWWWwWWWWWWw",
    "wWWWWWwWWWWWWWWWxCCCCCCCCCCCxWWWWWWWwWWWWWWw",
    "wWWWWWwWWWWWWWWWxCCCCCCCCCCCxWWWWWWWwWWWWWWw",
    "wWWWWWwWWWWWWWWWxCCCCCCCCCCCxWWWWWWWwWWWWWWw",
], 44)
STAR7 = PROF_STAR = [  # five-point star (professor: gold on navy at (19,36); naru: pink at (19,37))
    "...A...",
    "..AAA..",
    "AAAAAAA",
    ".AAAAA.",
    ".AA.AA.",
    "AA...AA",
]
PROF_LAPELS = [  # offset (8,32): fold lines of the wide flared collar, turned out over the shoulders
    "......xx..............xx",
    ".....x..x............x..x",
    "....x....xx........xx....x",
    "...x.......x......x.......x",
    "..xwwwwwwwwx......xwwwwwwwwx",
    ".........x..........x",
    "........x............x",
    ".......x..............x",
]
PROF_GOGGLES = [  # offset (8,8): grey goggles pushed up on the hair, dark strap round the head
    "......xxxxx.....xxxxx......",
    ".....xGggGGx...xGggGGx.....",
    "xxxxxxGgGGGxxxxxGgGGGxxxxxx",
    ".....xGGGGGx...xGGGGGx.....",
    "......xxxxx.....xxxxx......",
]
PROF_GLASSES = [  # offset face + (2,8); thin light frames around the eyes, arm back to the ear
    "....xxxxxx..xxxxx",
    "xxxxx....xxxx...x",
    "....x....x..x...x",
    "....x....x..x...x",
    "....x....x..x...x",
    "....xxxxxx..xxxxx",
    ".....ssss....sss.",
]
check_rows('prof hairB', PROF_HAIR_B, 32); check_rows('prof hairF', PROF_HAIR_F, 32); 
CHARS['professor'] = {
    'face': 'adult', 'eyes': 'adult', 'face_off': (11, 10), 'neck_off': (19, 30),
    'skin': {'S': 'e4b387', 's': 'c38365', 'L': 'f5cca3', 'k': '7b382f'},
    'line': '23262e', 'white': 'f2f6fc', 'iris': '2c558c', 'brow': '381c14', 'mouth': 'a15d4a',
    'mouth_base': ["M..M", ".MM."],
    'behind': [Part(PROF_HAIR_B, (6, 0), PROF_HAIR, outline=PROF_HAIR_OUT, group='hair', name='hairB')],
    'body': [Part(PROF_BODY, (0, 32), PROF_COAT, outline='23262e', name='coat'),
             Part(PROF_STAR, (19, 36), {'A': 'f2c84b'}, name='star'),
             Part(PROF_LAPELS, (8, 32), {'x': 'b9b5ae', 'w': 'd6dfed'}, name='lapels')],
    'top': [Part(PROF_GOGGLES, (8, 8), {'x': '23262e', 'G': 'b9b5ae', 'g': 'f2f6fc'}, name='goggles')],
    'hair': [Part(PROF_HAIR_F, (6, 0), PROF_HAIR, outline=PROF_HAIR_OUT, group='hair', name='hairF')],
    'exprs': ['base', 'happy', 'surprised'],
}


# ---- hero (ScarloxyPeople14 slot 2): teal cap (white/yellow badge, red brim to the right), brown hair, navy jacket, teal collar, yellow straps
HERO_OUT = '793122'
HERO_HAIR = {'H': '79504c', 'h': '55393b'}
HERO_HAIR_B = pad([  # offset (6,0)
    "", "", "", "", "", "", "", "",
    "..HHH",
    ".HHHHH",
    "HHHHHHH",
    "HHHHHHHH",
    "HHHHHHHHH",
    "hHHHHHHHHH",
    "hHHHHHHHHHH................HHH",
    "hHHHHHHHHHH................HHHH",
    "hhHHHHHHHHH................HHHH",
    "hhHHHHHHHH.................HHH",
    "hHHHHHHHHH.................HH",
    "hhHHHHHHHH.................H",
    "hHHHHHHHHH",
    ".hhHHHHHH",
    "hhhHHHHHH",
    ".hhHHHHH",
    "..hHHHHH",
    ".hhHHHH",
    "..hhHH",
    "...hh",
], 36)
HERO_HAIR_F = pad([  # offset (6,0): bangs under the brim + lock over the ear
    "", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
    ".....hHHHHHHHHHHHHHHHHHHHHHh",
    "....hHHHHHHHHHHHHHHHHHHHHHHHh",
    "....hHHHHHHhHHHHHhHHHHHHhHHh",
    "....hHHHHHh.hHHHh.hHHHh..hh",
    "....hHHHH...hHh...hHh....h",
    "....hHHH.....h.....h",
    "....hHHH",
    "....hHHh",
    "....hHh",
    ".....hh",
], 36)
HERO_CAP = pad([  # offset (6,0): crown, badge, brim pointing to the viewer's right
    "",
    "",
    "...........ccCCCCCCcc",
    "........cCCCCCCCCCCCCCc",
    "......cCCCCCCCCCClllCCCCc",
    ".....cCCCCCCCCCClllllCCCCc",
    "....cCCCCCCCCCCCwwwwYCCCCc",
    "...cCCCCCCCCCCCwwYYYwCCCCCc",
    "...cCCCCCCCCCCCwYYYwwCCCCCc",
    "..cCCCCCCCCCCCCCwwwwCCCCCCCc",
    "..cCCCCCCCCCCCCCCCCCCCCCCCCc",
    "..ccCCCCCCCCCCCCCCCCCCCCCCCcc",
    "...ccccccRRRRRRRRRRRRRRRRRRRRRRR",
    "........rRRRRRRRRRRRRRRRRRRRRRRRRRR",
    ".........rRRRRRRRRRRRRRRRRRRRRRRRRRR",
    "..........rrrrrrrrrrrrrrrrrrrrrrrrr",
], 36)
HERO_BODY = pad([  # offset (0,33)
    "...............cCCc......cCCc",
    "............jJJcCCCc....cCCCcJJj",
    "..........jJJJJJcCCCc..cCCCcJJJJJj",
    ".........jJJYJJJJcCCCccCCCcJJJJYJJj",
    ".......jJJJJYJJJJJcCCCCCCcJJJJJYJJJj",
    ".....jJJJJJJYJJJJJJcCCCCcJJJJJJJYJJJJj",
    "....jJJJJJJJYJJJJJJJcCCcJJJJJJJJYJJJJJj",
    "...jJJJJJJJJYJJJJJJJJCCJJJJJJJJJYJJJJJJj",
    "..jJJJJJJJJJYJJJJJJJJCCJJJJJJJJJYJJJJJJJj",
    "..jJJJjJJJJJYJJJJJJJJCCJJJJJJJJJYJJjJJJJj",
    ".jJJJJjJJJJJYJJJJJJJJCCJJJJJJJJJYJJjJJJJJj",
    ".jJJJJjJJJJJYJJJJJJJJCCJJJJJJJJJYJJjJJJJJj",
    "jJJJJJjJJJJJYJJJJJJJJCCJJJJJJJJJYJJjJJJJJJj",
], 44)
CHARS['hero'] = {
    'face': 'young', 'eyes': 'young', 'face_off': (11, 12), 'neck_off': (19, 30),
    'skin': {'S': 'feddb1', 's': 'e29f7f', 'L': 'feddb1', 'k': '7b3d3a'},
    'line': '141b33', 'white': 'f4fefa', 'iris': '2e3d6c', 'brow': '55393b', 'mouth': 'c72e25',
    'mouth_base': ["M..M", ".MM."],
    'behind': [Part(HERO_HAIR_B, (6, 0), HERO_HAIR, outline=HERO_OUT, group='hair', name='hairB')],
    'body': [Part(HERO_BODY, (0, 33), {'J': '2e3d6c', 'j': '1f2a4e', 'C': '03a897', 'c': '046f60', 'Y': 'f2d05c'}, outline='141b33', name='jacket')],
    'hair': [Part(HERO_HAIR_F, (6, 0), HERO_HAIR, outline=HERO_OUT, group='hair', name='hairF')],
    'top': [Part(HERO_CAP, (6, 0), {'C': '03a897', 'c': '046f60', 'l': '56cbb4', 'w': 'f4fefa', 'Y': 'f2d05c',
                                    'R': 'f05545', 'r': 'c72e25'}, outline='141b33', group='cap', name='cap')],
    'exprs': ['base', 'happy', 'surprised'],
}


SKIN_A = {'S': 'e4b387', 's': 'c38365', 'L': 'f5cca3', 'k': '7b382f'}   # chips' standard skin ramp

# ---- mom (ScarloxyPeople14 slot 0): light-brown hair in a top bun, long side hair, golden cardigan over a white blouse
MOM_HAIR = {'H': 'a86b3e', 'h': '754526', 'I': 'cf9d5f'}
MOM_HAIR_F = pad([  # offset (6,0): top bun, parted side-swept bangs, long strand-lined hair over both shoulders
    "...........hhhhhh",
    "..........hHHHHHHh",
    "..........hHHIIHHh",
    "..........hHHHHHHh",
    "...........hhhhhh",
    "........hhhhhhhhhhhhhhh",
    "......hhHHHHHHIIIIHHHHHhh",
    ".....hHHHHHHIIIIHHHHHHHHHh",
    "....hHHHHHHIIHHHHHHHHHHHHHh",
    "...hHHHHHHHHHHHHHHHHHHHHHHHh",
    "..hHHHHHHHHHHHhHHHHHHHHHHHHHh",
    "..hHHHHHHHHHHhHHHHHHHHHHHHHHh",
    "..hHHHHHHHHHhHHHHHHHHHHHHHHHHh",
    "..hHHHHHHHHhHHHHHHHHHHHHHHHHHh",
    "..hHHHHHHHh.hhHHHHHHHHHHHHHHHh",
    "..hHHHHHHh....hhhHHHHHHHHHHHHh",
    ".hHHHhHHh........hhhhHHHHHHHHh",
    ".hHHHhHh.............hhHHHHHHh",
    ".hHHhHHh...............hHHHHHh",
    ".hHHhHh.................hHHHHh",
    "hHHHhHh..................hHHHh",
    "hHHHhHh..................hHhHh",
    "hHHhHHh..................hHhHh",
    "hHHhHHh..................hHhHHh",
    "hHHhHHHh.................hHhHHh",
    "hHHhHHHh................hHHhHHh",
    "hHHHhHHHh...............hHHhHHh",
    ".hHHhHHHh...............hHHhHHHh",
    ".hHHHhHHHh.............hHHHhHHh",
    "..hHHhHHHh.............hHHhHHHh",
    "..hHHHhHHHh...........hHHHhHHh",
    "...hHHhHHHh...........hHHhHHHh",
    "...hHHHhHHHh..........hHHHhHh",
    "....hHHhHHHh...........hHhHHh",
    "....hHHHhHHh...........hHHhh",
    ".....hHHhHHh............hhh",
    ".....hHHHhh",
    "......hhh",
], 34)
MOM_HAIR_B = fill_between(MOM_HAIR_F[:33])
MOM_BODY = pad([  # offset (0,33)
    "...............KKb.......bKK",
    "............kKKKKKbB...BbKKKKKk",
    "..........kKKKKKKKKbBBBbKKKKKKKKk",
    ".........kKKKKKKKKKbBBBBBbKKKKKKKKk",
    ".......kKKKKKKKKKKKbBBBBBBbKKKKKKKKKk",
    ".....kKKKKKKKKKKKKKbBBBBBBbKKKKKKKKKKKk",
    "....kKKKKKKKKKKKKKKKbBBBBBbKKKKKKKKKKKKk",
    "...kKKKKKKKKKKKKKKKKbBBBBBbKKKKKKKKKKKKKk",
    "..kKKKKKKKKKKKKKKKKKbBBBBBbKKKKKKKKKKKKKKk",
    "..kKKKkKKKKKKKKKKKKKbBBBBBbKKKKKKKKKkKKKKk",
    ".kKKKKkKKKKKKKKKKKKKbBBBBBbKKKKKKKKKkKKKKKk",
    ".kKKKKkKKKKKKKKKKKKKbBBBBBbKKKKKKKKKkKKKKKk",
    "kKKKKKkKKKKKKKKKKKKKbBBBBBbKKKKKKKKKkKKKKKKk",
], 44)
CHARS['mom'] = {
    'face': 'young', 'eyes': 'young', 'lashes': True, 'face_off': (11, 12), 'neck_off': (19, 30),
    'skin': SKIN_A, 'line': '3b2110', 'white': 'f0f4fa', 'iris': '2c558c', 'brow': '754526', 'mouth': 'a15d4a',
    'mouth_base': ["M..M", ".MM."],
    'behind': [Part(MOM_HAIR_B, (6, 0), MOM_HAIR, outline='3b2110', group='hair', name='hairB')],
    'body': [Part(MOM_BODY, (0, 33), {'K': 'b8843e', 'k': '9e713b', 'B': 'f0f4fa', 'b': 'aeb7c7'}, outline='3b2110', name='cardigan')],
    'hair': [Part(MOM_HAIR_F, (6, 0), MOM_HAIR, outline='3b2110', group='hair', name='hairF')],
    'exprs': ['base', 'happy', 'surprised'],
}

# ---- nurse (ScarloxyPeople14 slot 3): blue bob with blunt bangs, white coat, navy sailor collar, gold badge
NURSE_HAIR = {'H': '4a7a93', 'h': '3a5263', 'I': '548ca8'}
NURSE_HAIR_F = pad([  # offset (6,0): rounded bob, notched bangs, strand lines, ends curling in under the jaw
    "", "", "", "",
    "........hhhhhhhhhhh",
    "......hhHHHHHHHHHHHhh",
    ".....hHHHHHHHIIIIHHHHh",
    "....hHHHHHHIIIIHHHHHHHh",
    "...hHHHHHHHHHHHHHHHHHHHh",
    "..hHHHHHHHHHHHHHHHHHHHHHh",
    "..hHHHHHHHHHHHHHHHHHHHHHHh",
    ".hHHHHHHHHHHHHHHHHHHHHHHHHh",
    ".hHHHHHHHHHHHHHHHHHHHHHHHHHh",
    ".hHHHhHHHHHhHHHHHHhHHHHHhHHh",
    ".hHHhHHHHHhHHHHHHHhHHHHHhHHHh",
    ".hHHhHHHHhHHHHHHHHHhHHHHhHHHh",
    ".hHhHHHHHHHhHHHHHhHHHHhHHHHh",
    ".hHhHHHh..hHHHh..hHHh..hHhHh",
    ".hHhHh...................hHhh",
    "hHHhHh...................hHhh",
    "hHHhHh...................hHHh",
    "hHHhHh...................hHHh",
    "hHHhHh...................hHHh",
    "hHHhHHh..................hHHh",
    "hHHhHHh..................hHHh",
    "hHHHhHh.................hHhHh",
    ".hHHhHHh................hHhHh",
    ".hHHHhHHh..............hHHhHh",
    ".hHHHhHHh..............hHHhHh",
    ".hHHhHHHh..............hHHhHHh",
    ".hHHhHHHh.............hHHHhHHh",
    "..hHHhHHHh............hHHhHHh",
    "..hHHHhHHh............hHHhHHh",
    "...hHHhHHh.............hHhHh",
    "...hhHHHh..............hhhh",
    ".....hhh",
], 34)
NURSE_HAIR_B = fill_between(NURSE_HAIR_F)
NURSE_BODY = pad([  # offset (0,33)
    "...............nNNn.....nNNn",
    "............xnNNNNNn...nNNNNNnx",
    "..........xWWnNNNNNNnNnNNNNNNnWWx",
    ".........xWWWWnNNNNNNNNNNNNNnWWWWx",
    ".......xWWWWWWWnnNNNNNNNNNnnWWWWWWWx",
    ".....xWWWWWWWWWWWnnnNNNnnnWWWWWWWWWWx",
    "....xWWWWWWWWWWWWWWwnNnwWWWWWAAWWWWWWx",
    "...xWWWWWWWWWWWWWWWWwNwWWWWWAAAAWWWWWWx",
    "..xWWWWWWWWWWWWWWWWWwNwWWWWWWAAWWWWWWWWx",
    "..xWWWWwWWWWWWWWWWWWwNwWWWWWWWWWWWwWWWWx",
    ".xWWWWWwWWWWWWWWWWWWwNwWWWWWWWWWWWwWWWWWx",
    ".xWWWWWwWWWWWWWWWWWWwNwWWWWWWWWWWWwWWWWWx",
    "xWWWWWWwWWWWWWWWWWWWwNwWWWWWWWWWWWwWWWWWWx",
], 44)
CHARS['nurse'] = {
    'face': 'young', 'eyes': 'young', 'lashes': True, 'face_off': (11, 12), 'neck_off': (19, 30),
    'skin': SKIN_A, 'line': '1f2c55', 'white': 'f4f8f6', 'iris': '33447a', 'brow': '3a5263', 'mouth': 'a15d4a',
    'mouth_base': ["M..M", ".MM."],
    'behind': [Part(NURSE_HAIR_B, (6, 0), NURSE_HAIR, outline='2d4b5a', group='hair', name='hairB')],
    'body': [Part(NURSE_BODY, (0, 33), {'W': 'f4f8f6', 'w': 'cfe3dc', 'x': '94b8ae', 'N': '33447a', 'n': '1f2c55', 'A': 'f2c84b'}, outline='1f2c55', name='coat')],
    'hair': [Part(NURSE_HAIR_F, (6, 0), NURSE_HAIR, outline='2d4b5a', group='hair', name='hairF')],
    'exprs': ['base', 'happy', 'surprised'],
}

# ---- naru (scarloxy-charset-people1 slot 3): long violet hair, teal-green eyes, indigo top with a pink cross
NARU_HAIR = {'H': 'b675d2', 'h': '8346ab', 'I': 'dd9ff0'}
NARU_HAIR_B = pad([  # offset (6,0)
    "", "", "",
    "..........hhhhhhhhhhh",
    ".......hhHHHHHHHHHHHHhh",
    ".....hHHHHHHHHHHHHHHHHHHh",
    "....hHHHHHHHHHHHHHHHHHHHHh",
    "...hHHHHHHHHHHHHHHHHHHHHHHh",
    "..hHHHHHHHHHHHHHHHHHHHHHHHHh",
    "..HHHHHHHHHHHHHHHHHHHHHHHHHHH",
] + [".HHHHHHHHHHHHHHHHHHHHHHHHHHHHHH"] * 22 + [
    "HHHHHHHHH............HHHHHHHHHH",
], 34)
NARU_HAIR_F = pad([  # offset (6,0)
    "", "", "", "",
    "........hhhhhhhhhhh",
    "......hhHHHHHHHHHHHhh",
    ".....hHHHHHIIIHHHHHHHHh",
    "....hHHHHIIIHHHHHHHHHHHh",
    "...hHHHHIIHHHHHHHHHHHHHHh",
    "..hHHHHHHHHHHHHHHHHHHHHHHh",
    "..hHHHHHHHHHHHHHHHHHHHHHHHh",
    ".hHHHHHHHHHHHHHHHHHHHHHHHHHh",
    ".hHHHHHHHHHHHHHHHHHHHHHHHHHHh",
    ".hHHHHHHHHHHHHHHHHHHHHHHHHHHh",
    ".hHHHHHHhHHHHHHhHHHHHHHhHHHHHh",
    ".hHHHHHh.hHHHHh.hHHHHHh.hHHHHh",
    ".hHHHHh...hHHh...hHHHh...hHHHh",
    "hHHHHh.....hh.....hHh.....hHHh",
    "hHHHh..............h.......hHh",
    "hHHHh......................hHh",
    "hHHHh......................hHHh",
    "hHHHh......................hHHh",
    "hHHHh......................hHHh",
    "hHHHHh.....................hHHh",
    "hHHHHh.....................hHHh",
    "hHHHHh....................hHHHh",
    "hHHHHh....................hHHHh",
    "hHHHHHh...................hHHHh",
    "hHHHHHh..................hHHHHh",
    ".hHHHHh..................hHHHHh",
    ".hHHHHHh.................hHHHh",
    "hHHHHHh..................hHHHHh",
    ".hHHHHHh.................hHHHHh",
    ".hHHHHh..................hHHHHh",
    "..hHHHHh.................hHHHHh",
    "..hHHHHh................hHHHHHh",
    "...hHHHh................hHHHHh",
    "...hHHHHh...............hHHHh",
    "....hHHHh................hHHh",
    "....hHHh.................hHh",
    ".....hh...................h",
], 34)
NARU_BODY = pad([  # offset (0,33)
    "...............tTT.......TTt",
    "............tTTTTTt.....tTTTTTt",
    "..........tTTTTTTTTt...tTTTTTTTTt",
    ".........tTTTTTTTTTTtttTTTTTTTTTTTt",
    ".......tTTTTTTTTTTTTTTTTTTTTTTTTTTTTt",
    ".....tTTTTTTTTTTTTTTTtTTtTTTTTTTTTTTTTt",
    "....tTTTTTTTTTTTTTTTTtTTtTTTTTTTTTTTTTTt",
    "...tTTTTTTTTTTTTTtTTTTTTTTtTTTTTTTTTTTTTt",
    "..tTTTTTTTTTTTTTTtTTTTTTTTtTTTTTTTTTTTTTTt",
    "..tTTTTtTTTTTTTTTTTTtTTtTTTTTTTTTTtTTTTTTt",
    ".tTTTTTtTTTTTTTTTTTTtTTtTTTTTTTTTTtTTTTTTTt",
    ".tTTTTTtTTTTTTTTTTTTtTTtTTTTTTTTTTtTTTTTTTt",
    "tTTTTTTtTTTTTTTTTTTTtTTtTTTTTTTTTTtTTTTTTTTt",
], 44)
CHARS['naru'] = {
    'face': 'young', 'eyes': 'young', 'lashes': True, 'face_off': (11, 12), 'neck_off': (19, 30),
    'skin': SKIN_A, 'line': '251c43', 'white': 'ffffff', 'iris': '198263', 'brow': '552181', 'mouth': 'b6649a',
    'mouth_base': ["...M", "MMM."],
    'behind': [Part(NARU_HAIR_B, (6, 0), NARU_HAIR, outline='552181', group='hair', name='hairB')],
    'body': [Part(NARU_BODY, (0, 33), {'T': '606297', 't': '3d356a'}, outline='251c43', name='top'),
             Part(STAR7, (19, 37), {'A': 'ffc0c7'}, name='star')],
    'hair': [Part(NARU_HAIR_F, (6, 0), NARU_HAIR, outline='552181', group='hair', name='hairF')],
    'exprs': ['base', 'happy', 'surprised', 'angry'],
}

# ---- yurim (scarloxy-charset-people2 slot 1): leafy green spiky hair, green eyes, mottled leaf-green jacket with light collar
YURIM_HAIR = {'H': '50982d', 'h': '247132', 'I': '80af23'}
YURIM_HAIR_F = pad([  # offset (6,0): leaf-point crown, leafy bangs, side tufts (I = leaf-vein highlight strokes)
    "..........h.....h......h",
    ".........hH....hHh....hH..h",
    "....h...hHHh..hHHh...hHHhhH",
    "....hh.hHIHHhhHIHHhhhHIHHHh",
    ".....hhHHIHHHHHIHHHHHHIHHHh..h",
    "..hh.hHHHHIHHHHHIHHHHHHIHHhhHh",
    "...hhHHHHHHHHHHHHHHHHHHHHHHHHh",
    "....hHHIHHHHHHIHHHHHHHIHHHHHh",
    "hhhhHHHHIHHHHHHIHHHHHHHIHHHHHhhh",
    ".hHHHHHHHHHHHHHHHHHHHHHHHHHHHHHh",
    "..hHHHHIHHHhHHHHHHhHHHHHHHHIHHh",
    "...hHHHHHHhIhHHHHhIhHHHHHHHHIHhh",
    "..hHHHHHHhHIHhHHhHIHhHHHHHHHHHHHh",
    ".hHHHHHHhHHHHHhhHHHHHhHHHHHHHHHh",
    "hhHHHHHhHHHHHHhHHHHHHHhHHHHHHhhh",
    "..hHHHh.hHHHh..hHHHHh..hHHHHHh",
    ".hHHHh...hHh....hHHh....hHHHHh",
    "hHHHHh....h......hh......hHHHh",
    "..hHHh...................hHHh",
    ".hHHh.....................hHHh",
    "hHHHh.....................hHh",
    ".hHh......................hh",
    "hHh",
    ".h",
], 34)
YURIM_BODY = pad([  # offset (0,33): leaf-green jacket, light layered collar, centre seam
    "..............lLL.........LLl",
    "............jlLLLl.......lLLLlj",
    "..........jJJlLLLLl...lLLLLlJJj",
    ".........jJJJJlLLLLlJlLLLLlJJJJj",
    ".......jJJJJJJJlLLLlJJlLLLlJJJJJJj",
    ".....jJJJJJJJJJJlLlJJJJlLlJJJJJJJJJj",
    "....jJJJJJJJJJJJJJJJJjJJJJJJJJJJJJJJj",
    "...jJJJJJJJJJJJJJJJJJjJJJJJJJJJJJJJJJj",
    "..jJJJJJJJJJJJJJJJJJJjJJJJJJJJJJJJJJJJj",
    "..jJJJJjJJJJJJJJJJJJJjJJJJJJJJJJjJJJJJj",
    ".jJJJJJjJJJJJJJJJJJJJjJJJJJJJJJJjJJJJJJj",
    ".jJJJJJjJJJJJJJJJJJJJjJJJJJJJJJJjJJJJJJj",
    "jJJJJJJjJJJJJJJJJJJJJjJJJJJJJJJJjJJJJJJJj",
], 44)
YURIM_HAIR_B = fill_between(YURIM_HAIR_F[:18])
YURIM_SHIRT = [  # offset (18,36): pale vertically striped shirt in the open jacket
    "..StS..",
    ".StStS.",
    ".StStS.",
    "StStStS",
    "StStStS",
    "StStStS",
    "StStStS",
    "StStStS",
    "StStStS",
    "StStStS",
]
CHARS['yurim'] = {
    'face': 'young', 'eyes': 'young', 'face_off': (11, 12), 'neck_off': (19, 30),
    'skin': {'S': 'feddb1', 's': 'e29f7f', 'L': 'feddb1', 'k': '7b3d3a'},
    'line': '115345', 'white': 'fef7d7', 'iris': '38886d', 'brow': '247132', 'mouth': 'b56d5d',
    'mouth_base': ["M..M", ".MM."],
    'behind': [Part(YURIM_HAIR_B, (6, 0), YURIM_HAIR, outline='13491c', group='hair', name='hairB')],
    'body': [Part(YURIM_BODY, (0, 33), {'J': '68a97a', 'j': '2e7353', 'L': 'ebdba7', 'l': '999c70'}, outline='115345', name='jacket'),
             Part(YURIM_SHIRT, (18, 36), {'S': 'fef7d7', 't': '999c70'}, name='shirt')],
    'hair': [Part(YURIM_HAIR_F, (6, 0), YURIM_HAIR, outline='13491c', group='hair', name='hairF')],
    'exprs': ['base', 'happy', 'surprised', 'angry'],
}

# ---- muyeong (scarloxy-charset-people2 slot 0): swept-up red hair, heavy dark brows + beard, red eyes, red coat with gold epaulettes
MUY_HAIR = {'H': 'db3838', 'h': 'a82931', 'I': 'ec6e52'}
MUY_HAIR_F = pad([  # offset (6,0)
    "...........h.......h",
    "..........hH......hHh....h",
    "......h...hHh....hHHh...hH",
    ".....hHh.hHHHh..hHHHh..hHh",
    ".....hHHhHHIHHhhHHIHHhhHHh",
    "......hHHHHIHHHHHHIHHHHHHh",
    "....hhHHHHHHHHHHHHHHHHHHHHhh",
    "...hHHHHHHHHHHHHHHHHHHHHHHHHh",
    "..hHHHHHHHHHHHHHHHHHHHHHHHHHHh",
    "..hHHHHHHHHHHHHHHHHHHHHHHHHHHh",
    ".hHHHHHHHHHHHHHHHHHHHHHHHHHHh",
    ".hHHHHHHHHHHHhHHHHHHhHHHHHHHh",
    "hHHHHHHHHHHhh.hHHHhh.hHHHHHHh",
    "hHHHHHHHHh.....hhh....hHHHHh",
    "hHHHHHh..............hHHHh",
    ".hHHHh................hHh",
    "..hHh.................hh",
    "...h",
], 34)
MUY_BEARD = pad([  # offset face + (0,11): sideburn, jaw beard, moustache (mouth row 17 kept clear)
    "..B",
    "..BB",
    "..BBb",
    "...BBb",
    "...BBBb.....bBBBb",
    "....BBBb...bBBBBBb",
    "....BBBBb..........B",
    ".....BBBBBb......bBB",
    "......BBBBBBBBBBBBB",
    ".........BBBBBBBB",
    "...........BBBBB",
], 22)
MUY_BODY = pad([  # offset (0,32)
    "",
    "...............rRRr.......rRRr",
    "............rrrRRRRr.bbb.rRRRRrrr",
    "..........rRRRRRRRRRrbbbbrRRRRRRRRRr",
    "......GGGGGrRRRRRRRRRrbbrRRRRRRRRRRGGGGG",
    "....GGgGgGgGRRRRRRRRRrbbrRRRRRRRRRGgGgGgGG",
    "...GgGgGgGgGRRRRRRRRRRrrRRRRRRRRRRGgGgGgGgG",
    "...rgggggggrRRRRRRRRRRRRRRRRRRRRRRrgggggggr",
    "..rRRRRRRRRRRRRRRRRRRGRRRRRRRRRRRRRRRRRRRRRr",
    "..rRRRRRRRRRRRRRRRRRRrRRRRRRRRRRRRRRRRRRRRRr",
    ".rRRRRrRRRRRRRRRRRRRRGRRRRRRRRRRRRrRRRRRRRRr",
    ".rRRRRrRRRRRRRRRRRRRRrRRRRRRRRRRRRrRRRRRRRRr",
    "rRRRRRrRRRRRRRRRRRRRRGRRRRRRRRRRRRrRRRRRRRRr",
    "rRRRRRrRRRRRRRRRRRRRRrRRRRRRRRRRRRrRRRRRRRRr",
], 44)
_ey, _by, _my, _nz = 9, 7, 17, (16, 13)
MUY_EXPR = {
    # neutral-stern: level heavy brows, plain eyes, flat mouth
    'base': feat(["....", "oooo", "QeEo", ".ss."], ["...", "ooo", "eEo", "ss."], ["bbbb"], ["bbb"], ["MMMM"], _ey, _by, (11, _my), nose=_nz),
    # smug grin: lifted brows, eyes squeezed shut, toothy upturned grin through the beard
    'happy': feat(["....", ".oo.", "o..o", "...."], ["...", ".o.", "o.o", "..."], ["bbbb"], ["bbb"], ["M.....M", "MQQQQQM", "MQQQQQM", ".MMMMM."], _ey, _by - 2, (9, _my - 1), nose=_nz),
    'surprised': feat([".oo.", "oQQo", "QeEQ", "QQQQ", ".QQ."], [".o.", "oQo", "QeQ", "QQQ", ".Q."], [".bb.", "b..b"], [".b.", "b.b"], [".MM.", "MooM", "MmmM", ".MM."], _ey - 1, _ey - 4, (11, _my - 1), nose=_nz),
    # furious: deep V brows, lids crushed down, shouting mouth with teeth
    'angry': feat(["....", "....", "oooo", "QeEo"], ["...", "...", "ooo", "eEo"], ["bb..", "bbbb", "..bb"], ["..b", ".bb", "bbb"], ["MMMMMM", "MQQQQM", "MooooM", ".MMMM."], _ey, _by - 1, (10, _my - 1), nose=_nz),
}
CHARS['muyeong'] = {
    'face': 'adult', 'eyes': 'adult', 'face_off': (11, 10), 'neck_off': (19, 30),
    'skin': {'S': 'c8885c', 's': 'a2654a', 'L': 'eba06e', 'k': '8c4b36'},
    'line': '1d3340', 'white': 'ffffff', 'iris': '7b1c2c', 'brow': '1d3340', 'mouth': '7b1c2c',
    'expr_override': MUY_EXPR,
    'under_feat': [Part(MUY_BEARD, (11, 21), {'B': '2f424a', 'b': '4b5b5a'}, outline='1d3340', group='skin', name='beard')],
    'body': [Part(MUY_BODY, (0, 32), {'R': 'a82931', 'r': '7b1c2c', 'G': 'ecc552', 'g': 'db9138', 'b': '1d3340'}, outline='4b1418', name='coat')],
    'hair': [Part(MUY_HAIR_F, (6, 0), MUY_HAIR, outline='7b1c2c', group='hair', name='hairF')],
    'exprs': ['base', 'happy', 'surprised', 'angry'],
}


def save(img, path):
    img.resize((img.width * SCALE, img.height * SCALE), Image.NEAREST).save(path)


def main(only=None):
    for cid, c in CHARS.items():
        if only and cid not in only:
            continue
        os.makedirs(os.path.join(HERE, cid), exist_ok=True)
        for e in c['exprs']:
            img = build(c, e)
            save(img, os.path.join(HERE, cid, f'bust-{e}.png'))
            cols = {px for px in img.getdata() if px[3]}
            print(cid, e, 'colours', len(cols))


if __name__ == '__main__':
    main(sys.argv[1:] or None)
