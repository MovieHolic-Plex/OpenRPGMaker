"""Round-2 redraw of four interior props (helmet shelf, orrery, control console, slot machine), drawn from scratch.

3/4 top-down like the globe / wardrobe / bread shelf anchors: every boxy piece shows a lit top plane (back edge, plane,
lit front lip) above a shorter, darker front face; each material is outlined in its own darkest tone and shaded with a
3-4 step ramp lit from the upper left. Animated pieces keep their 12-frame idea (orrery planets orbit, console lamps
blink + screen/gauge move, slot reels spin + lamps chase).

    build_misc() -> {object id: [RGBA frames]}   (palette snapping is the caller's job)
"""
import math
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import redraw as R  # noqa: E402

hx = R.hx
h2 = R.h2
T = (0, 0, 0, 0)


def C(d):
    return {k: (hx(v) if v else T) for k, v in d.items()}


def stamp(im, x0, y0, rows, cmap):
    px = im.load()
    for dy, r in enumerate(rows):
        for dx, ch in enumerate(r):
            if ch in ' .':
                continue
            x, y = x0 + dx, y0 + dy
            if 0 <= x < im.width and 0 <= y < im.height:
                px[x, y] = cmap[ch]


def fill(im, x0, y0, x1, y1, c):
    px = im.load()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if 0 <= x < im.width and 0 <= y < im.height:
                px[x, y] = c


def put(im, x, y, c):
    if 0 <= x < im.width and 0 <= y < im.height:
        im.load()[x, y] = c


# ---------------------------------------------------------------- shared ramps
W_OUT, W_D2, W_D1, W_M, W_L, W_HL, W_TOP = (hx(c) for c in ('411e05', '63310b', '6d3b15', '9a5435', 'b77246', 'd59147', 'f4b370'))
W_GR = hx('c07c4c')                  # grain on the lit plane
IN_D, IN_M, IN_L = hx('1a0e06'), hx('2a180b'), hx('3a2210')   # shelf interior

STEEL = C({'O': '1d2128', 'd': '49505d', 'm': '777d86', 'l': 'a4aebb', 'h': 'dfdfe7', 'v': '0e1216',
           'g': 'e0b030', 'G': '9e7e10', 'R': 'd73a42', 'r': 'a82830', 'q': '67030c', 'p': 'f06a64', 'Q': '3a0508',
           'H': 'efe8db', 'i': 'c4bcac', 'j': '8d8678', 'k': '52473a', 's': '2a180b'})

# great helm with a red plume (11 x 12)
GREAT_HELM = [
    "...QQQ.....",
    "..QpRRQQ...",
    "..QRRrrrQ..",
    ".OOQqqQrrQ.",
    "OhllmGmdQrQ",
    "OllmmGmmmdO",
    "OvvvvGvvvvO",
    "OlmmmGmvmdO",
    "OmmvmGmmvdO",
    "OmmmmGmmddO",
    ".OOOOOOOOO.",
]
# kettle hat: low dome, gold rivet band, wide brim whose top is seen from above (12 x 8)
KETTLE_HAT = [
    "....OOOO....",
    "...OhllmO...",
    "..OhllmmdO..",
    "..OlmmmmdO..",
    ".OgGgGgGgGO.",
    "OhllllmmmmdO",
    "OmlmmmmmmddO",
    ".OOOOOOOOOO.",
]
# horned helm: dome, nasal bar, cheek guards, ivory horns curling up (16 x 10)
HORNED_HELM = [
    "Hi............iH",
    "kHi...OOOO...iHk",
    ".kHiOOhllmOOiHk.",
    "..kjOhllmmmdOjk.",
    "...OlllmmmmddO..",
    "...OggggGGGGGO..",
    "...OlvvmGmvvdO..",
    "...OmOvmGmvOdO..",
    "...OdO.OGO.OdO..",
]
HORNED_HELM = [r[:16] for r in HORNED_HELM]


def helmet_shelf():
    im = Image.new('RGBA', (32, 32))
    W = 32
    # ---- carcass outline and side posts
    fill(im, 1, 0, 30, 0, W_OUT)
    fill(im, 0, 1, 0, 31, W_OUT); fill(im, 31, 1, 31, 31, W_OUT)
    fill(im, 1, 31, 30, 31, W_OUT)
    # ---- top board seen from above: back edge, lit plane with grain, bright lip, short front face, eave shadow
    fill(im, 1, 1, 30, 1, W_M)
    for y in (2, 3, 4):
        for x in range(1, 31):
            v = h2(x // 3, y)
            put(im, x, y, W_GR if v % 5 == 0 else W_HL)
    fill(im, 1, 5, 30, 5, W_TOP)
    fill(im, 1, 6, 30, 6, W_L)
    # ---- two compartments (dark back wall with plank seams), each closed by a shelf board seen from above
    for (y0, y1) in ((7, 15), (20, 26)):
        for y in range(y0, y1 + 1):
            for x in range(3, 29):
                c = IN_M if y == y0 else (IN_D if x in (10, 19) else IN_L)
                if y == y0 + 1 and x not in (10, 19): c = IN_M
                put(im, x, y, c)
    for (ys, yl, yf) in ((16, 18, 19), (27, 29, 30)):  # surface rows ys, ys+1, lip, front
        fill(im, 3, ys, 28, ys, W_L)          # back of the shelf surface
        fill(im, 3, ys + 1, 28, ys + 1, W_HL)  # shelf surface
        fill(im, 1, yl, 30, yl, W_TOP)         # lit front lip
        fill(im, 1, yf, 30, yf, W_M if yf == 19 else W_D1)
    fill(im, 1, 30, 30, 30, W_D2)
    # side posts: lit left post, shaded right post
    for y in range(7, 31):
        if im.getpixel((3, y))[:3] in (IN_L[:3], IN_M[:3], IN_D[:3]) or y in (16, 17, 27, 28):
            put(im, 1, y, W_HL); put(im, 2, y, W_L)
            put(im, 29, y, W_M); put(im, 30, y, W_D1)
    for y in (7, 20):                          # post shadow inside each box
        put(im, 3, y + 1, IN_D)
    for y in range(7, 16): put(im, 28, y, IN_M)
    for y in range(20, 27): put(im, 28, y, IN_M)
    # ---- helmets, each with a soft contact shadow on the shelf surface
    def shadow(x0, x1, y):
        for x in range(x0, x1 + 1): put(im, x, y, W_L if x in (x0, x1) else W_M)
    shadow(5, 15, 17); stamp(im, 5, 7, GREAT_HELM, STEEL)
    shadow(17, 27, 17); stamp(im, 16, 9, KETTLE_HAT, STEEL)
    shadow(9, 22, 28); stamp(im, 8, 19, HORNED_HELM, STEEL)
    # horned helm back wall pixels around the horn tips should stay dark wall, not plane
    return R.grain(im, 18, 31, ramps=(R.WOOD,))


# ---------------------------------------------------------------- orrery (12 frames)
def orrery_frames(n=12):
    BR = C({'O': '5c4108', 'D': '7e5c10', 'm': 'bfa045', 'l': 'dfc872', 'h': 'fff0b0'})
    SUN = C({'o': 'a84d0a', 'r': 'ea8e3f', 'y': 'ffd040', 'h': 'fff8b0', 'g': 'e0b030'})
    BLUE = C({'o': '113461', 'd': '2a70b8', 'm': '5998cf', 'l': 'a8d8f0', 'g': '2e8a2a'})
    RED = C({'o': '510e15', 'd': 'a82830', 'm': 'd73a42', 'l': 'ffb0a0'})
    PLANET5 = [".ooo.", "olmmo", "omgdo", "omddo", ".ooo."]
    PLANET4 = [".oo.", "olmo", "omdo", ".oo."]
    SUNR = [".ooo.", "ohyyo", "oyygo", "oygro", ".ooo."]
    cx, cy, rx, ry = 7.5, 13.5, 7.0, 3.2
    ring = set()
    for t in range(720):
        a = t / 720 * 2 * math.pi
        ring.add((int(round(cx + rx * math.cos(a))), int(round(cy + ry * math.sin(a)))))
    out = []
    for k in range(n):
        im = Image.new('RGBA', (16, 32)); px = im.load()
        # round wooden plinth: oval top seen from above (back edge, lit plane, bright lip), front band, outline
        PL = {23: (5, 10), 24: (3, 12), 25: (2, 13), 26: (2, 13), 27: (2, 13), 28: (2, 13), 29: (2, 13), 30: (3, 12), 31: (5, 10)}
        for y, (a, b) in PL.items():
            for x in range(a, b + 1):
                edge = x in (a, b) or y in (23, 31)
                if edge: c = W_OUT
                elif y == 24: c = W_M
                elif y in (25, 26): c = W_GR if (x * 5 + y) % 7 == 0 else W_HL
                elif y == 27: c = W_TOP
                elif y == 28: c = W_L
                elif y == 29: c = W_D1
                else: c = W_D2
                px[x, y] = c
        for x in (3, 12): px[x, 24] = W_OUT
        # brass post with dark outline, standing in a small brass collar on the plinth
        for y in range(15, 26):
            px[6, y] = BR['O']; px[7, y] = BR['l']; px[8, y] = BR['m']; px[9, y] = BR['D']
        px[7, 18] = BR['h']
        stamp(im, 5, 24, ["OlmmDO", ".OOOO."], BR)
        stamp(im, 5, 14, ["OlmmDO"], BR)
        # orbit ring: 2 px band, back half darker, front half lit, dark outer edge
        back = [(x, y) for (x, y) in ring if y < cy]
        front = [(x, y) for (x, y) in ring if y >= cy]

        def ring_px(pts, inner, outer):
            for (x, y) in pts:
                if not (0 <= x < 16): continue
                px[x, y] = inner
                oy = y - 1 if y < cy else y + 1
                if 0 <= oy < 32 and (x, oy) not in ring: px[x, oy] = outer
        # planets: outer (blue, on the ring) goes round once; inner (red, small orbit) twice the other way
        a1 = 2 * math.pi * k / n + 0.4
        p1 = (int(round(cx + rx * math.cos(a1))), int(round(cy + ry * math.sin(a1))))
        a2 = -2 * math.pi * 2 * k / n + 2.0
        p2 = (int(round(cx + 4.4 * math.cos(a2))), int(round(cy + 2.0 * math.sin(a2))))

        def planet(p, shape, cmap, half):
            x = min(max(p[0] - half, 0), 16 - len(shape[0])); y = p[1] - half
            stamp(im, x, y, shape, cmap)
        ring_px(back, BR['m'], BR['O'])
        if p1[1] < cy: planet(p1, PLANET5, BLUE, 2)
        if p2[1] < cy: planet(p2, PLANET4, RED, 2)
        stamp(im, 5, 10, SUNR, SUN)
        for y in (15, 16): px[7, y] = BR['l']; px[8, y] = BR['m']
        ring_px(front, BR['l'], BR['D'])
        for (x, y) in front:
            if x <= 4 and y >= cy + 1 and 0 <= x < 16: px[x, y] = BR['h']
        if p2[1] >= cy: planet(p2, PLANET4, RED, 2)
        if p1[1] >= cy: planet(p1, PLANET5, BLUE, 2)
        out.append(im)
    return out


# ---------------------------------------------------------------- control console (12 frames)
G = C({'O': '2a3a44', 'a': '2f343e', 'b': '40454f', 'c': '596470', 'e': '777d86', 'f': '808996', 'g': 'a4aebb',
       'h': 'c3c3cf', 'w': 'dfdfe7', 'k': '1a2430'})


def console_frames(n=12):
    """Instrument hood (3-row top plane + face with screen and gauge) behind a big receding desk deck: light at the
    back, darker toward the front, every control casting a 1px shadow on the deck; no full-width bright bands."""
    out = []
    LED = {'r': ('f06a64', 'c30014', '7e1c21'), 'y': ('fff0a0', 'e0b030', '7c5a10'),
           'g': ('b8f080', '3a8a30', '174617'), 'b': ('a8d8f0', '4a90c0', '1f538e')}
    for k in range(n):
        im = Image.new('RGBA', (32, 32)); px = im.load()
        g = lambda ch: G[ch]
        # ---- hood: outline, top plane (back edge + 3 rows, light at the back), edge broken by seams, face
        fill(im, 3, 1, 28, 1, g('O'))
        fill(im, 2, 2, 29, 2, g('e'))
        fill(im, 2, 3, 29, 3, g('h'))
        fill(im, 2, 4, 29, 4, g('g'))
        fill(im, 2, 5, 29, 5, g('g'))
        for x in range(2, 30):
            px[x, 6] = g('e') if x in (9, 10, 20, 21) else g('f')
        for x in (9, 20): px[x, 3] = g('g'); px[x, 4] = g('f')
        fill(im, 2, 7, 29, 12, g('b'))
        fill(im, 2, 7, 29, 7, g('a'))
        for y in range(7, 13): px[2, y] = g('c'); px[29, y] = g('a')
        for y in range(2, 13): px[1, y] = g('O'); px[30, y] = g('O')
        px[2, 1] = T; px[29, 1] = T
        px[1, 2] = T; px[30, 2] = T
        px[2, 2] = g('O'); px[29, 2] = g('O')
        # screen with a moving trace
        fill(im, 4, 8, 13, 12, g('O'))
        fill(im, 5, 9, 12, 11, hx('0c2a10'))
        for x in range(5, 13):
            yy = 10 + int(round(1.1 * math.sin((x + k) * 2 * math.pi / 6)))
            px[x, min(max(yy, 9), 11)] = hx('98ce76')
        px[5, 9] = hx('2e5a2a'); px[6, 9] = hx('174617')
        # round gauge with a sweeping needle
        stamp(im, 16, 8, [".OOO.", "OwhhO", "OhhgO", ".OOO."], G)
        ang = math.pi * (0.2 + 0.6 * (0.5 - 0.5 * math.cos(2 * math.pi * k / n)))
        px[18 - int(round(math.cos(ang))), 9 + (0 if math.sin(ang) > 0.5 else 1)] = hx('c30014')
        px[18, 10] = g('O')
        # two small pilot lamps
        on = (k // 2) % 2 == 0
        stamp(im, 23, 9, ["OOOOO", "O.O.O", "OOOOO"], G)
        px[24, 10] = hx('f06a64') if on else hx('7e1c21'); px[26, 10] = hx('b8f080') if not on else hx('174617')
        # ---- deck: shadow under the hood, then a receding plane light at the back and darker toward the front
        fill(im, 1, 13, 30, 13, g('c'))
        ramp = {14: 'h', 15: 'g', 16: 'g', 17: 'g', 18: 'f', 19: 'f', 20: 'f', 21: 'e', 22: 'e'}
        for y, ch in ramp.items():
            fill(im, 1, y, 30, y, g(ch))
        for x in range(1, 31):                     # front edge: mid-light, broken by seams
            px[x, 23] = g('c') if x in (11, 21) else g('f')
        for y in range(13, 24):
            px[0, y] = g('O'); px[31, y] = g('O')
        # seams of the deck plates
        for y in range(14, 23): px[11, y] = g('e') if y < 18 else g('c'); px[21, y] = g('e') if y < 18 else g('c')
        # big rotary knob and a small one: round caps seen from above, shadow on the deck below/right
        stamp(im, 3, 15, [".OO.", "OwhO", "OheO", ".OO."], G)
        fill(im, 4, 19, 6, 19, g('c')); px[7, 18] = g('c')
        stamp(im, 8, 17, [".O.", "OwO", ".O."], G)
        px[9, 20] = g('c'); px[10, 19] = g('c')
        px[9, 17] = hx('c30014')
        # push buttons: little domes in different colours, each with a 1px shadow on the deck
        for i, (x, y, col) in enumerate([(13, 15, 'r'), (17, 15, 'y'), (14, 19, 'b'), (18, 19, 'g')]):
            lit = ((k + i * 5) % 7) < 4 if i % 2 == 0 else ((k * 3 + i) % 5) < 3
            hi, mid, lo = (hx(c) for c in LED[col])
            px[x, y] = hi if lit else mid; px[x + 1, y] = mid if lit else lo
            px[x, y + 1] = lo; px[x + 1, y + 1] = lo
            px[x, y + 2] = g('c'); px[x + 1, y + 2] = g('c'); px[x + 2, y + 2] = g('e')
        # two short throttle levers in deck slots: 2px shaft, small knob, different positions; the right one moves
        for j, x in enumerate((23, 26)):
            pos = 1 if j == 0 else (0, 1, 2, 2, 1, 0)[k // 2 % 6]
            # slot in the deck
            for y in range(16, 21): px[x, y] = g('O'); px[x + 1, y] = g('a')
            ky = 15 + pos
            px[x, ky + 1] = g('w'); px[x + 1, ky + 1] = g('e')
            px[x, ky + 2] = g('h'); px[x + 1, ky + 2] = g('e')
            kc = ('c30014', 'f06a64', '7e1c21') if j == 0 else ('e0b030', 'fff0a0', '7c5a10')
            px[x - 1, ky] = hx(kc[2]); px[x, ky] = hx(kc[1]); px[x + 1, ky] = hx(kc[0]); px[x + 2, ky] = hx(kc[2])
            px[x + 2, ky + 1] = g('c'); px[x + 2, ky + 2] = g('c')
        # key switch
        stamp(im, 28, 15, ["OO", "hO"], G); px[28, 17] = g('c'); px[29, 17] = g('c')
        # ---- short front face (darker than the deck): panels, seams, vents, kick plate
        for y in range(24, 31):
            for x in range(1, 31):
                c = g('b')
                if y == 24: c = g('a')
                elif x in (1, 2): c = g('c')
                elif x == 30: c = g('a')
                elif x in (11, 21): c = g('a')
                elif x in (12, 22): c = g('c')
                if y == 30: c = g('a')
                px[x, y] = c
            px[0, y] = g('O'); px[31, y] = g('O')
        for x0 in (4, 14, 24):
            for x in range(x0, x0 + 4):
                px[x, 26] = g('O'); px[x, 28] = g('O')
            px[x0, 25] = g('e')
        fill(im, 1, 31, 30, 31, g('O'))
        out.append(im)
    return out


# ---------------------------------------------------------------- slot machine (12 frames, 16 x 48)
# vintage fantasy-casino one-armed bandit: dark polished wood cabinet, cast-brass front, arched two-reel window,
# recessed brass payout cup, iron lever with a black ball. No crimson / pink.
S = C({'O': '2a180b', 'w': '411e05', 'x': '63310b', 'y': '6d3b15', 'z': '9a5435', 'Z': 'b77246', 'L': 'd59147', 'T': 'f4b370',
       'B': '5c4108', 'b': '7e5c10', 'm': 'bfa045', 'l': 'dfc872', 'h': 'fff0b0',
       'k': '1a0e06', 'q': '0e1216', 'i': '2f343e', 'j': '49505d', 'n': '777d86', 'N': 'a4aebb',
       'V': 'efe8db', 'v': 'c4bcac', 'u': '8d8678', 'r': 'c30014', 'R': '7e1c21', 'g': '2e8a2a', 'G': '174617',
       'Y': 'e0b030', 'X': '9e7e10'})
# 3 x 5 symbols on the ivory drum
SYMS = {
    'cherry': ["..G", ".g.", "hrr", "rrR", ".RR"],
    'bell': [".Y.", "YYX", "YYX", "YXX", ".X."],
    'bar': ["...", "qqq", "YYX", "qqq", "..."],
}
STRIPS = [['cherry', 'bar', 'bell'], ['bell', 'cherry', 'bar']]
FINAL = ['cherry', 'bell']


def slot_frames(n=12):
    """Frame 0 and 9-11 stopped (cherry | bell); lever pulled on 1-2; reels streak and stop at 6 and 9; crest lamps blink."""
    out = []
    for k in range(n):
        im = Image.new('RGBA', (16, 48)); px = im.load()
        s = lambda ch: S[ch]
        # ---- top plane of the cabinet: outline, dark back edge, lit polished plane with grain, bright front lip
        fill(im, 1, 6, 12, 6, s('O'))
        fill(im, 1, 7, 12, 7, s('y'))
        for y in (8, 9, 10):
            for x in range(1, 13):
                c = s('L') if x <= 3 else s('Z') if x <= 10 else s('z')
                if h2(x // 2, y) % 7 == 0 and 2 <= x <= 10: c = s('z') if c == s('Z') else s('Z')
                put(im, x, y, c)
        for x in range(1, 13): put(im, x, 11, s('T') if x <= 3 else s('L') if x <= 10 else s('Z'))
        for y in range(7, 12): put(im, 0, y, s('O')); put(im, 13, y, s('O'))
        # ---- wood front with vertical shading (lit left edge, mid face, dark right edge) and faint vertical grain
        for y in range(12, 47):
            put(im, 0, y, s('O')); put(im, 13, y, s('O'))
            for x in range(1, 13):
                c = s('z') if x == 1 else s('x') if x == 11 else s('w') if x == 12 else s('y')
                if 2 <= x <= 10 and h2(x, y // 3) % 9 == 0: c = s('x')
                put(im, x, y, c)
        fill(im, 1, 12, 12, 12, s('w'))                    # shade under the lip
        fill(im, 0, 47, 13, 47, s('O'))
        # ---- cast-brass crest with two lamps (blink)
        stamp(im, 3, 14, [".BBBBBB.", "BlhlmmbB", "BlYmmXbB", ".BBBBBB."], S)
        on = k % 4 < 2
        put(im, 5, 15, s('h') if on else s('m')); put(im, 8, 15, s('h') if not on else s('m'))
        put(im, 5, 16, s('Y') if on else s('b')); put(im, 8, 16, s('Y') if not on else s('b'))
        # ---- cast-brass reel plate with an arched window (outlined, lit top-left, dark bottom-right)
        # build plate procedurally: x 1..12, rows 19..34
        for y in range(19, 35):
            for x in range(1, 13):
                edge = x in (1, 12) or y in (19, 34)
                if (y == 19 and x in (1, 2, 11, 12)) or (y == 20 and x in (1, 12)):
                    continue                                   # rounded top corners
                if edge or (y == 20 and x in (2, 11)):
                    c = s('B')
                elif x <= 3 and y <= 30: c = s('l')
                elif x >= 10 or y >= 32: c = s('b')
                else: c = s('m')
                if y == 20 and 3 <= x <= 10: c = s('h') if x <= 7 else s('l')
                put(im, x, y, c)
        # window: arch over two 3px reels (x4..6, x8..10) with a divider at x7, dark inner rim
        WIN = {22: (6, 8), 23: (5, 9), 24: (4, 10), 25: (4, 10), 26: (4, 10), 27: (4, 10), 28: (4, 10), 29: (4, 10), 30: (4, 10)}
        for y, (a, b) in WIN.items():
            put(im, a - 1, y, s('B')); put(im, b + 1, y, s('l') if y >= 24 else s('B'))
        fill(im, 6, 21, 8, 21, s('B')); put(im, 5, 22, s('B')); put(im, 9, 22, s('B')); put(im, 4, 23, s('B')); put(im, 10, 23, s('B'))
        fill(im, 3, 31, 11, 31, s('l')); put(im, 3, 31, s('B')); put(im, 11, 31, s('B'))
        stops = (6, 9)
        for r, x0 in enumerate((4, 8)):
            spinning = 1 <= k < stops[r]
            strip = STRIPS[r]
            for y, (a, b) in WIN.items():
                for dx in range(3):
                    x = x0 + dx
                    if not (a <= x <= b): continue
                    yy = y - 24                                # symbol rows 25..29 centred in the window
                    c = s('V')
                    if spinning:
                        if dx != 1: c = [s('r'), s('V'), s('Y'), s('v'), s('g')][(dx + r + k * 2 + y // 3) % 5]
                    else:
                        sym = SYMS[FINAL[r]]
                        if 0 <= yy - 1 < 5 and sym[yy - 1][dx] != '.': c = s(sym[yy - 1][dx])
                    if c == s('V'):
                        if y in (22, 30) or (y == 23 and x in (5, 9)): c = s('u')
                        elif y in (23, 29) or dx == 2: c = s('v')
                    put(im, x, y, c)
        for y in range(22, 31): put(im, 7, y, s('k'))
        # coin slot cast into the plate
        put(im, 6, 33, s('k')); put(im, 7, 33, s('k')); put(im, 5, 33, s('b')); put(im, 8, 33, s('l'))
        # ---- recessed brass payout cup: back rim, dark inside with coins, lit front rim, outlined cup body
        stamp(im, 3, 38, ["..BBBBBB..",
                          ".BmbbbbmB.",
                          "BlkkYkXkmB",
                          "BhllllmmbB",
                          ".BmmmbbbB.",
                          "..BBBBBB.."][:6], S)
        fill(im, 4, 44, 11, 44, s('w'))                     # cup shadow on the wood
        # ---- plinth: brass kick strip and dark base
        fill(im, 1, 45, 12, 45, s('x')); fill(im, 1, 46, 12, 46, s('w')); put(im, 1, 45, s('y'))
        # ---- lever: brass pivot boss on the side, 2px iron arm lit left / dark right, 3x3 shaded black ball
        pulled = k in (1, 2)
        top = 21 if pulled else 14
        stamp(im, 13, 28, ["Bl", "lm", "bB"], S)
        for y in range(top + 3, 28):
            put(im, 14, y, s('N')); put(im, 15, y, s('j'))
        stamp(im, 13, top, ["nji", "jiq", "iqq"], S)
        put(im, 13, top, s('N'))
        out.append(im)
    return out


def build_misc():
    return {
        'helmet shelf': [helmet_shelf()],
        'orrery': orrery_frames(12),
        'control console': console_frames(12),
        'slot machine': slot_frames(12),
    }
