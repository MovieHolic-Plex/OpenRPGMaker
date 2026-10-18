"""modern_city vehicles - one generator draws right/left/up/down natively at 1x.

Every direction comes from the same per-vehicle spec, the same 6-step body ramp (colours read off the
chipset's own mc-veh-* kits), the same glass ramp, the same 1px ink silhouette pass and the same anatomy
(trunk -> rear glass -> roof -> windshield -> hood -> face), so the side and the front/back views share
one pixel density and one shading rule. Light comes from the top-left.

Sizes (L = footprint length in tiles): right/left = L*16 x 32, up/down = 32 x L*16, bottom-aligned.
Sheet per vehicle (runtime contract): rows right, left, up, down; columns
base, _0, _1, _2, _3, _brake, _sigL, _sigR (+ _open for the bus on right/left rows).

    python3 gen4.py <outdir> [--board board.png]
"""
import functools, json, os, sys
import numpy as np
from PIL import Image

INK, INK2 = '#0b1224', '#19274a'
G = ['#19274a', '#2d436e', '#3d578a', '#4a6ba1', '#5e80b2', '#c1cfcc']          # glass dark -> sky glint
GT = ['#0e1720', '#17373c', '#265359', '#326c72', '#3f858a', '#c1cfcc']          # taxi/ambulance teal glass
TIRE, TIRE2 = '#091125', '#1f3052'
RIM, RIM2, HUB = '#676a77', '#9496a1', '#c1cfcc'
CHR = ['#676a77', '#9496a1', '#c1cfcc']
HEAD = ['#c1cfcc', '#e4e9e8']
TAIL = {False: ['#5e0a24', '#881438'], True: ['#c8404a', '#ff8a7a']}
AMB = {False: ['#8a6a20', '#c89a2b'], True: ['#ffb94a', '#ffe6a8']}
GOLD = ['#8a6a20', '#c89a2b', '#d2a54c', '#e4cfae']
WINE = ['#2d010f', '#5e0a24', '#881438']
PLATE = ['#a1a3ac', '#e4e9e8']
SHADOW = (11, 18, 36, 90)

R = dict(  # 6-step body ramps: 0 dark .. 5 brightest (top-plane glint)
    silver=['#676a77', '#757886', '#848794', '#9496a1', '#a1a3ac', '#afb1b8'],
    white=['#a8acba', '#b8bcc8', '#c6cad4', '#d2d5dd', '#dde0e7', '#e8eaef'],
    black=['#1a1b21', '#22232a', '#2a2c34', '#34363e', '#3e404a', '#4a4c56'],
    navy=['#1a223a', '#202b48', '#263456', '#2d3e64', '#354972', '#3e5480'],
    red=['#601e28', '#742630', '#983840', '#a8444a', '#b65256', '#c46264'],
    beige=['#86765e', '#98886e', '#a8987e', '#b6a68c', '#c4b49a', '#d0c2a8'],
    green=['#172e25', '#1c392d', '#224538', '#285041', '#2e5c4a', '#3a6c59'],
    taxi=['#0e1720', '#192737', '#283d53', '#36516a', '#516268', '#738a90'],
    pwhite=['#757886', '#848794', '#a1a3ac', '#afb1b8', '#bcbdc3', '#e4e9e8'],
    pblack=['#0e1720', '#192737', '#192737', '#283d53', '#36516a', '#516268'],
    truck=['#757886', '#848794', '#a1a3ac', '#afb1b8', '#bcbdc3', '#e4e9e8'],
    bus=['#757886', '#848794', '#9496a1', '#afb1b8', '#bcbdc3', '#e4e9e8'],
    fire=['#2d010f', '#5e0a24', '#741030', '#881438', '#9c2448', '#b03a5a'],
)
BOB = [0, 0, 1, 0]          # body lift per wheel phase (tyres stay planted)


@functools.lru_cache(None)
def hx(s):
    s = s.lstrip('#')
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), 255)


def lerp(a, b, f):
    return int(round(a + (b - a) * f))


class Cv:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.a = np.zeros((h, w, 4), np.uint8)
        s.oy = 0

    def P(s, x, y, c):
        y += s.oy
        if c is not None and 0 <= x < s.w and 0 <= y < s.h:
            s.a[y, x] = hx(c)

    def R(s, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                s.P(xx, yy, c)

    def HL(s, x, y, w, c): s.R(x, y, w, 1, c)
    def VL(s, x, y, h, c): s.R(x, y, 1, h, c)

    def X(s, x, y):
        y += s.oy
        if 0 <= x < s.w and 0 <= y < s.h:
            s.a[y, x] = 0

    def get(s, x, y):
        y += s.oy
        if 0 <= x < s.w and 0 <= y < s.h and s.a[y, x, 3]:
            return '#%02x%02x%02x' % tuple(s.a[y, x, :3])
        return None

    def remap(s, x0, y0, x1, y1, src, dst):
        """recolour src ramp -> dst ramp inside [x0,x1]x[y0,y1] (body-only two-tone, e.g. police)"""
        m = {hx(a)[:3]: hx(b) for a, b in zip(src, dst)}
        for y in range(max(0, y0 + s.oy), min(s.h, y1 + 1 + s.oy)):
            for x in range(max(0, x0), min(s.w, x1 + 1)):
                k = tuple(int(v) for v in s.a[y, x, :3])
                if s.a[y, x, 3] and k in m:
                    s.a[y, x] = m[k]

    def finish(s, shadow):
        """1px ink silhouette (4-neighbour) + translucent ground shadow rows."""
        m = s.a[:, :, 3] == 255
        n = np.zeros_like(m)
        n[1:] |= m[:-1]; n[:-1] |= m[1:]; n[:, 1:] |= m[:, :-1]; n[:, :-1] |= m[:, 1:]
        s.a[n & ~m] = hx(INK)
        x0, x1, y0, y1 = shadow
        blk = s.a[y0:y1 + 1, x0:x1 + 1]
        blk[blk[:, :, 3] == 0] = SHADOW
        return Image.fromarray(s.a, 'RGBA')


# ------------------------------------------------------------------ shared parts
def side_wheel(c, cx, cy, ph, r=4):
    for dy in range(-r - 1, r + 2):
        for dx in range(-r - 1, r + 2):
            d = dx * dx + dy * dy
            if d <= r * r + 2:
                c.P(cx + dx, cy + dy, TIRE2 if (dx + dy < -r and d > 6) else TIRE)
            if d <= 5:
                c.P(cx + dx, cy + dy, RIM if dx + dy > 0 else RIM2)
    c.P(cx, cy, HUB)
    sx, sy = [(0, -2), (2, 0), (0, 2), (-2, 0)][ph]
    c.P(cx + sx, cy + sy, HUB)


def side_arch(c, cx, cy, r=5):
    for dy in range(-r - 1, 2):
        for dx in range(-r - 1, r + 2):
            if dx * dx + dy * dy <= r * r + 1:
                c.P(cx + dx, cy + dy, INK)


def tyres(c, y, h, x0, x1, ph, w=3):
    for x in (x0, x1 - w + 1):
        c.R(x, y, w, h, TIRE)
        c.HL(x, y + 1 + (ph % 2), w, TIRE2)
        c.HL(x, y + 3 + (ph % 2), w, TIRE2)


def plate(c, x, y, w=6):
    c.R(x, y, w, 2, PLATE[1]); c.HL(x, y + 1, w, PLATE[0])


def glass_band(c, y, x0, x1, j, h, gl=G):
    """one windshield row facing the viewer: sky rows on top, dark at the cowl"""
    col = gl[4] if j == 0 else gl[3] if j == 1 else gl[1] if j >= h - 2 else gl[2]
    c.HL(x0, y, x1 - x0 + 1, col)


def diag_glare(c, x0, y, h, gl=G, step=1):
    """3-band diagonal reflection: bright, mid, thin"""
    for j in range(1, h - 1):
        c.P(x0 + j * step, y + j, gl[5]); c.P(x0 + 1 + j * step, y + j, gl[4]); c.P(x0 + 4 + j * step, y + j, gl[4])


def deck(c, x0, x1, y0, y1, T, far=True):
    """top plane (hood / trunk / roof seen from above): base T[3], far edge T[4], left wedge glint."""
    c.R(x0, y0, x1 - x0 + 1, y1 - y0 + 1, T[3])
    if far: c.HL(x0 + 1, y0, x1 - x0 - 1, T[4])
    for j in range(y1 - y0 + 1):
        c.HL(x0 + 1, y0 + j, max(0, (x1 - x0) // 3 - 2 * j), T[4])
    c.VL(x0, y0, y1 - y0 + 1, T[4]); c.VL(x1, y0, y1 - y0 + 1, T[2])


# ------------------------------------------------------------------ sedans (sedan-a, car2-c sport, police, taxi)
def car_side(sp, ph=0, brake=False, sig=None, open_=False):
    W = 48; c = Cv(W, 32); T = R[sp['ramp']]; sport = sp.get('sport')
    RY = 8 if sport else 6; RF = RY + 3
    DY, DF, BY0, BY1 = 13, 16, 17, 25
    bx0, bx1 = 2, W - 3
    xt, xr0, xr1, xh = (8, 18, 28, 37) if sport else (9, 15, 29, 36)
    gl = GT if sp.get('teal') else G
    c.oy = -BOB[ph]
    # lower body side (light from above: crease bright, waist darker, sill dark)
    c.R(bx0, BY0, bx1 - bx0 + 1, BY1 - BY0 + 1, T[2])
    c.HL(bx0, BY0, bx1 - bx0 + 1, T[4]); c.R(bx0, BY0 + 1, bx1 - bx0 + 1, 3, T[3])
    c.HL(bx0, BY0 + 5, bx1 - bx0 + 1, T[1]); c.R(bx0, BY0 + 6, bx1 - bx0 + 1, BY1 - BY0 - 6, T[2])
    c.HL(bx0, BY1, bx1 - bx0 + 1, T[0])
    c.VL(bx0, BY0 + 1, BY1 - BY0, T[4]); c.VL(bx1, BY0 + 1, BY1 - BY0, T[1])
    door = (xr0 + xr1) // 2
    for x in (door, xh - 1): c.VL(x, BY0 + 1, BY1 - BY0 - 1, T[1])
    for x in (door - 4, xh - 5): c.HL(x, BY0 + 2, 2, T[1])
    if sp.get('stripe'): c.HL(bx0 + 1, BY0 + 4, bx1 - bx0 - 1, sp['stripe'])
    # near-side greenhouse: dark frame, glass rows, B-pillar
    for y in range(RF + 1, DF + 1):
        f = (y - RF) / (DF - RF)
        xl, xr = lerp(xr0, xt + 2, f), lerp(xr1, xh - 1, f)
        c.HL(xl, y, xr - xl + 1, INK2)
        if RF + 2 <= y <= DF - 1:
            j = y - RF - 2
            c.HL(xl + 1, y, xr - xl - 1, gl[3] if j == 0 else gl[2] if j < 2 else gl[1])
    c.R(door, RF + 1, 2, DF - RF, INK2)
    for x0 in (xr0 + 1, door + 3):
        for k in range(3): c.P(x0 + k, RF + 2 + k, gl[5]); c.P(x0 + k + 1, RF + 2 + k, gl[4])
    # rear glass and windshield: sloped planes from roof edge down to the decks
    for x in range(xt, xr0):
        s = (xr0 - x) / max(1, xr0 - xt); yf, yn = lerp(RY, DY, s), lerp(RF, DF, s)
        for y in range(yf, yn + 1):
            k = y - yf
            c.P(x, y, INK2 if y == yn else gl[3] if k == 0 else gl[2] if k == 1 else gl[1])
    for x in range(xr1 + 1, xh + 1):
        s = (x - xr1) / max(1, xh - xr1); yf, yn = lerp(RY, DY, s), lerp(RF, DF, s)
        for y in range(yf, yn + 1):
            k = y - yf
            c.P(x, y, INK2 if y == yn else gl[4] if k == 0 else gl[5] if k == 1 and s < .7 else gl[3] if k == 2 else gl[2])
    # decks
    deck(c, bx0, xt - 1, DY, DF - 1, T); c.X(bx0, DY)
    deck(c, xh + 1, bx1, DY, DF - 1, T); c.X(bx1, DY)
    c.HL(bx0, DF, xt - bx0, T[1]); c.HL(xh + 1, DF, bx1 - xh, T[1])
    # roof plane
    c.R(xr0, RY, xr1 - xr0 + 1, RF - RY, T[4]); c.HL(xr0 + 1, RY, xr1 - xr0 - 1, T[5])
    c.HL(xr0 + 1, RY + 1, (xr1 - xr0) // 2, T[5]); c.HL(xr0, RF, xr1 - xr0 + 1, T[2])
    c.X(xr0, RY); c.X(xr1, RY)
    if sport:   # lip spoiler on the trunk end
        c.HL(bx0, DY - 1, 4, T[1]); c.P(bx0, DY - 1, T[2])
    c.P(xh, DY - 1, T[2]); c.P(xh - 1, DY - 1, T[1])                  # mirror
    # lamps: head at the front end, tail at the rear end, amber corners
    c.R(bx1 - 1, BY0 + 1, 2, 2, HEAD[1]); c.P(bx1 - 1, BY0 + 2, HEAD[0])
    tl = TAIL[brake]
    c.R(bx0, BY0 + 1, 2, 2, tl[0]); c.P(bx0, BY0 + 1, tl[1])
    near, far = AMB[sig == 'R'], AMB[sig == 'L']
    c.P(bx1, BY0 + 3, near[0] if sig != 'R' else near[1]); c.P(bx0, BY0 + 3, near[0] if sig != 'R' else near[1])
    if sig == 'L': c.P(bx1 - 1, DY, far[1]); c.P(bx0 + 1, DY, far[1])
    c.R(bx1 - 2, BY1 - 2, 3, 2, T[1]); c.R(bx0, BY1 - 2, 3, 2, T[1])  # bumpers
    if sp.get('police'):
        c.remap(bx0, 0, door - 7, 31, R['pwhite'], R['pblack']); c.remap(xh - 1, 0, bx1, 31, R['pwhite'], R['pblack'])
        c.P(door + 4, BY0 + 2, GOLD[2]); c.P(door + 4, BY0 + 3, GOLD[1])
        lit = ph % 2
        c.R(door - 4, RY - 2, 4, 2, '#c8404a' if lit else '#5e0a24'); c.R(door, RY - 2, 4, 2, '#5e80b2' if not lit else '#2d436e')
        c.HL(door - 4, RY - 2, 8, None)
        c.P(door - 3 if lit else door + 2, RY - 2, '#ffd0c8' if lit else '#c1cfcc')
        c.R(bx1, BY0 + 4, 1, 3, CHR[1])                                 # push bar
    if sp.get('taxi'):
        c.R(door - 3, RY - 3, 6, 3, GOLD[2]); c.HL(door - 3, RY - 3, 6, GOLD[3]); c.HL(door - 2, RY - 1, 4, GOLD[0])
    c.oy = 0
    for x in (11, W - 12): side_arch(c, x, 26)
    for x in (11, W - 12): side_wheel(c, x, 26, ph)
    return c.finish((bx0 + 2, bx1 - 2, 31, 31))


def _car_rows(sp, view):
    sport = sp.get('sport')
    if view == 'down':
        return (dict(trunk=(2, 8), rg=(9, 11), roof=(12, 20), wind=(21, 31), hood=(32, 37), face=(38, 43)) if sport else
                dict(trunk=(2, 7), rg=(8, 10), roof=(11, 22), wind=(23, 31), hood=(32, 37), face=(38, 43)))
    return (dict(hood=(2, 8), wind=(9, 11), roof=(12, 20), rg=(21, 31), trunk=(32, 37), face=(38, 43)) if sport else
            dict(hood=(2, 7), wind=(8, 10), roof=(11, 22), rg=(23, 31), trunk=(32, 37), face=(38, 43)))


def corner_tyres(c, y, h, ph, x0=0, x1=31, w=4):
    """tread of a front/rear axle pair seen from above: drawn before the body so only the outer 2px poke out
    past the flanks (and the full width under the bumper). Lit outer edge on the left, rolling tread lines."""
    for x in (x0, x1 - w + 1):
        c.R(x, y, w, h, TIRE)
        for k in range((ph % 2) + 1, h - 1, 2): c.HL(x, y + k, w, TIRE2)
    c.VL(x0, y + 1, h - 2, TIRE2)

def flank_axles(c, ys, ph):
    """far/mid axles of a long body seen from above: 2px of tread poke past both flanks (drawn under the body)."""
    for ty in ys:
        corner_tyres(c, ty, 6, ph, 0, 31, 3)
        for x in (1, 30): c.VL(x, ty + 2, 2, RIM2)


def flank_glass(c, y0, y1, pillars, bx0=2, bx1=29, gl=G):
    """side windows seen at a grazing angle: 1px lit glass on the left flank, shaded on the right, split by pillars."""
    for y in range(y0, y1 + 1):
        if y in pillars: continue
        c.P(bx0 + 1, y, gl[3] if (y - y0) % 7 else gl[5]); c.P(bx1 - 1, y, gl[1])



def car_ns(sp, view, ph=0, brake=False, sig=None, open_=False):
    W, H = 32, 48; c = Cv(W, H); T = R[sp['ramp']]; sport = sp.get('sport')
    gl = GT if sp.get('teal') else G
    S = _car_rows(sp, view)
    bx0, bx1 = 2, 29
    cx0, cx1 = (8, 23) if sport else (7, 24)          # roof cap narrower than the body, like the side view's greenhouse
    down = view == 'down'
    near_glass, far_glass = ('wind', 'rg') if down else ('rg', 'wind')
    near_deck, far_deck = ('hood', 'trunk') if down else ('trunk', 'hood')
    for ty in (S[far_deck][0] + 2, S['face'][0] - 2):
        corner_tyres(c, ty, 6, ph, 0, 31, 3)
        for x in (1, 30): c.VL(x, ty + 2, 2, RIM2)                      # hub glint between the tread lines
    for x in (4, 23): c.R(x, 44, 5, 2, TIRE); c.HL(x + 1, 44 + ph % 2, 3, TIRE2)   # treads under the near bumper
    c.oy = -BOB[ph]
    # top planes of both ends
    y0, y1 = S[far_deck][0], S[near_deck][1]
    c.R(bx0, y0, bx1 - bx0 + 1, y1 - y0 + 1, T[3])
    c.VL(bx0, y0, y1 - y0 + 1, T[4]); c.VL(bx1, y0, y1 - y0 + 1, T[2])
    for k in (far_deck, near_deck):
        a, b = S[k]; deck(c, bx0, bx1, a, b, T, far=(k == far_deck))
    a, b = S[near_deck]; c.HL(bx0 + 1, b, bx1 - bx0 - 1, T[5]); c.HL(bx0 + 1, a, bx1 - bx0 - 1, T[2])
    for j in range(1, b - a):                                            # hood / trunk-lid creases converge on the glass
        t = (b - a - j) / max(1, b - a - 1)
        c.P(lerp(9, 8, 1 - t), a + j, T[4]); c.P(lerp(22, 23, 1 - t), a + j, T[2])
    a, b = S[far_deck]; c.HL(bx0, b, bx1 - bx0 + 1, T[2])
    for k in range(2): c.X(bx0 + k, y0); c.X(bx1 - k, y0)
    c.X(bx0, y0 + 1); c.X(bx1, y0 + 1)
    # far glass (seen at a grazing angle): dark, tapering from the deck edge in to the roof cap
    a, b = S[far_glass]; h = b - a + 1
    for j in range(h):
        t = j / max(1, h - 1)
        xl, xr = lerp(bx0 + 3, cx0, t), lerp(bx1 - 3, cx1, t)
        c.P(xl, a + j, INK2); c.P(xr, a + j, INK2)
        c.HL(xl + 1, a + j, xr - xl - 1, gl[2] if j == 0 else gl[1] if j % 2 else gl[0])
    # greenhouse sides: shoulder in body colour, side glass (lit left, shaded right), B-pillar
    a, b = S['roof']; rm = (a + b) // 2
    for y in range(a, b + 1):
        c.HL(bx0 + 2, y, cx0 - bx0 - 2, gl[2]); c.P(cx0 - 1, y, gl[3])
        c.HL(cx1 + 1, y, bx1 - cx1 - 2, gl[1]); c.P(cx1 + 1, y, gl[0]); c.P(bx1 - 1, y, INK2)
    for k in range(3): c.P(bx0 + 2 + k % 2, a + 2 + k, gl[5])
    c.R(bx0 + 2, rm, cx0 - bx0 - 2, 2, T[3]); c.R(cx1 + 1, rm, bx1 - cx1 - 1, 2, T[1])
    # roof cap: lit far edge and left side, shaded right side and near edge, top-left specular wedge
    c.R(cx0, a, cx1 - cx0 + 1, b - a + 1, T[4])
    c.HL(cx0 + 1, a, cx1 - cx0 - 1, T[5]); c.HL(cx0 + 1, b, cx1 - cx0 - 1, T[3])
    c.VL(cx0, a + 1, b - a - 1, T[5]); c.VL(cx1, a + 1, b - a - 1, T[2]); c.VL(cx1 - 1, a + 2, b - a - 3, T[3])
    for j in range(1, 4): c.HL(cx0 + 1, a + j, 8 - 2 * j, T[5])
    # near glass: sky rows at the roof, widening to the deck, A/C-pillars, 3-band diagonal glare
    a, b = S[near_glass]; h = b - a + 1
    for j in range(h):
        f = j / max(1, h - 1)
        xl, xr = lerp(cx0, bx0 + 1, f), lerp(cx1, bx1 - 1, f)
        c.P(xl, a + j, INK2); c.P(xr, a + j, INK2)
        glass_band(c, a + j, xl + 1, xr - 1, j, h, gl)
    diag_glare(c, cx0 + 3, a, h, gl)
    c.HL(bx0 + 1, b, bx1 - bx0 - 1, INK2)                               # cowl / rear seal
    my = S['wind'][1] - 2 if down else S['wind'][1] + 1
    c.R(1, my, 1, 2, T[3]); c.R(30, my, 1, 2, T[2])                   # mirrors (behind the front tyres)
    # face
    a, b = S['face']
    c.R(bx0, a, bx1 - bx0 + 1, b - a + 1, T[2])
    c.VL(bx0, a, b - a, T[3]); c.VL(bx1, a, b - a, T[1])
    c.HL(bx0, a + 3, bx1 - bx0 + 1, T[1]); c.R(bx0, a + 4, bx1 - bx0 + 1, 2, T[2]); c.HL(bx0, a + 4, bx1 - bx0 + 1, T[3])
    c.HL(bx0 + 1, b, bx1 - bx0 - 1, T[0])
    left_on, right_on = (sig == 'R', sig == 'L') if down else (sig == 'L', sig == 'R')
    if down:
        hw = 4 if sport else 5
        for x in (bx0 + 1, bx1 - hw):
            c.R(x, a, hw, 2, HEAD[1]); c.HL(x, a + 1, hw, HEAD[0]); c.P(x + 1, a, '#ffffff' if False else HEAD[1])
        c.P(bx0 + 1, a + 2, AMB[left_on][left_on]); c.P(bx0 + 2, a + 2, AMB[left_on][0])
        c.P(bx1 - 1, a + 2, AMB[right_on][right_on]); c.P(bx1 - 2, a + 2, AMB[right_on][0])
        if sport:
            c.R(11, a + 1, 10, 2, INK2)
            for x in (5, 22): c.R(x, a + 4, 5, 2, INK2); c.HL(x + 1, a + 5, 3, G[0])
            plate(c, 13, a + 4)
        else:
            gx0, gx1 = 9, 22
            c.R(gx0, a, gx1 - gx0 + 1, 3, INK2)
            for x in range(gx0 + 1, gx1, 2): c.VL(x, a, 3, CHR[1] if sp.get('chrome') else T[1])
            if sp.get('chrome'): c.HL(gx0, a, gx1 - gx0 + 1, CHR[2])
            plate(c, 13, a + 4)
            if sp.get('fog'):
                for x in (bx0 + 2, bx1 - 3): c.R(x, a + 4, 2, 1, AMB[True][0])
    else:
        tl = TAIL[brake]
        if sport:
            c.HL(bx0 + 1, a + 1, bx1 - bx0 - 1, tl[0]); c.HL(bx0 + 1, a, bx1 - bx0 - 1, T[1])
            c.R(bx0 + 1, a, 4, 2, tl[1] if brake else tl[0]); c.R(bx1 - 4, a, 4, 2, tl[1] if brake else tl[0])
        else:
            for x in (bx0 + 1, bx1 - 5):
                c.R(x, a, 5, 2, tl[0]); c.HL(x, a, 5, tl[1])
            c.HL(bx0 + 7, a + 1, bx1 - bx0 - 13, T[1])                 # trunk lid shut line
        c.P(bx0 + 1, a + 2, AMB[left_on][left_on]); c.P(bx0 + 2, a + 2, AMB[left_on][0])
        c.P(bx1 - 1, a + 2, AMB[right_on][right_on]); c.P(bx1 - 2, a + 2, AMB[right_on][0])
        plate(c, 13, a + 4)
        if sport: c.HL(bx0 + 2, S['trunk'][1] - 1, bx1 - bx0 - 3, T[1]); c.HL(bx0 + 2, S['trunk'][1] - 2, bx1 - bx0 - 3, T[5])
    if sport and down:                                                    # lip spoiler at the far trunk edge
        c.HL(bx0 + 2, S['trunk'][0] + 1, bx1 - bx0 - 3, T[1]); c.HL(bx0 + 2, S['trunk'][0] + 2, bx1 - bx0 - 3, T[5])
    if sp.get('police'):
        pr = R['pwhite'], R['pblack']
        c.remap(0, S[far_deck][0], 31, S[far_deck][1], *pr); c.remap(0, S[near_deck][0], 31, b, *pr)
        if down:
            c.P(15, S['hood'][0] + 3, GOLD[2]); c.P(16, S['hood'][0] + 3, GOLD[2]); c.P(15, S['hood'][0] + 4, GOLD[1]); c.P(16, S['hood'][0] + 4, GOLD[1])
            c.HL(bx0 + 3, b - 1, bx1 - bx0 - 5, CHR[1]); c.VL(bx0 + 5, a + 3, 4, CHR[0]); c.VL(bx1 - 5, a + 3, 4, CHR[0])
        lit = ph % 2; ly = S['roof'][0] + 4
        c.R(9, ly, 7, 3, '#c8404a' if lit else '#5e0a24'); c.R(16, ly, 7, 3, '#5e80b2' if not lit else '#2d436e')
        c.HL(9, ly + 2, 14, INK2)
        c.R(10 if lit else 19, ly, 2, 1, '#ffd0c8' if lit else '#c1cfcc')
    if sp.get('taxi'):
        ly = S['roof'][0] + 4
        c.R(12, ly, 8, 4, GOLD[2]); c.HL(12, ly, 8, GOLD[3]); c.HL(12, ly + 3, 8, GOLD[0]); c.HL(13, ly + 1, 6, GOLD[3])
        c.VL(bx0, S['trunk'][0] + 2, S['hood'][1] - S['trunk'][0] - 3, GOLD[1]) if False else None
    c.oy = 0
    return c.finish((bx0 + 2, bx1 - 2, 46, 47))


# ------------------------------------------------------------------ van (cab-over one-box, L=3)
def van_side(sp, ph=0, brake=False, sig=None, open_=False):
    W = 48; c = Cv(W, 32); T = R[sp['ramp']]
    bx0, bx1, RY, RF, BY1 = 2, 45, 3, 7, 25
    c.oy = -BOB[ph]
    c.R(bx0, RF, 41 - bx0, BY1 - RF + 1, T[3])
    c.R(bx0, 17, bx1 - bx0 + 1, BY1 - 16, T[2]); c.HL(bx0, 16, bx1 - bx0 + 1, T[4])
    c.R(bx0, 21, bx1 - bx0 + 1, 2, '#3d578a'); c.HL(bx0, 21, bx1 - bx0 + 1, '#4a6ba1')
    c.HL(bx0, BY1, bx1 - bx0 + 1, T[0]); c.VL(bx0, RF, BY1 - RF, T[4]); c.VL(bx1, 17, BY1 - 17, T[1])
    for x0, x1 in ((4, 13), (16, 29), (32, 38)):                         # side windows
        c.R(x0, 9, x1 - x0 + 1, 6, INK2); c.R(x0 + 1, 10, x1 - x0 - 1, 4, G[2]); c.HL(x0 + 1, 10, x1 - x0 - 1, G[3])
        c.HL(x0 + 1, 13, x1 - x0 - 1, G[1])
        for k in range(3): c.P(x0 + 2 + k, 10 + k, G[5]); c.P(x0 + 3 + k, 10 + k, G[4])
    c.VL(30, 16, 8, T[1]); c.VL(14, 16, 8, T[1]); c.HL(26, 18, 2, T[1])
    for x in range(37, 44):                                              # raked windshield
        s = (x - 36) / 7; yf, yn = lerp(RY, 12, s), lerp(RF, 15, s)
        for y in range(yf, yn + 1):
            k = y - yf
            c.P(x, y, INK2 if y == yn else G[4] if k == 0 else G[5] if k == 1 and s < .7 else G[3] if k == 2 else G[2])
    deck(c, 41, bx1, 12, 15, T); c.X(bx1, 12)
    c.R(3, RY, 34, RF - RY, T[4]); c.HL(4, RY, 32, T[5]); c.HL(4, RY + 1, 16, T[5]); c.HL(3, RF - 1, 34, T[3])
    c.X(3, RY); c.X(36, RY)
    c.R(bx1 - 1, 17, 2, 2, HEAD[1]); c.P(bx1, 19, AMB[sig == 'R'][sig == 'R'])
    tl = TAIL[brake]; c.R(bx0, 17, 2, 3, tl[0]); c.P(bx0, 17, tl[1]); c.P(bx0, 20, AMB[sig == 'R'][sig == 'R'])
    if sig == 'L': c.P(bx1 - 1, 12, AMB[True][1]); c.P(3, RY + 1, AMB[True][1])
    c.R(bx1 - 2, 23, 3, 2, T[1]); c.R(bx0, 23, 3, 2, T[1])
    c.P(39, 11, T[2]); c.P(39, 12, T[1])                                 # mirror
    c.oy = 0
    for x in (10, 37): side_arch(c, x, 26)
    for x in (10, 37): side_wheel(c, x, 26, ph)
    return c.finish((4, 43, 31, 31))


def van_ns(sp, view, ph=0, brake=False, sig=None, open_=False):
    c = Cv(32, 48); T = R[sp['ramp']]; bx0, bx1 = 2, 29; down = view == 'down'
    tyres(c, 41, 5, bx0, bx1, ph); flank_axles(c, (7,), ph)
    c.oy = -BOB[ph]
    left_on, right_on = (sig == 'R', sig == 'L') if down else (sig == 'L', sig == 'R')
    if down:
        roof, wind, hood, face = (2, 26), (27, 34), (35, 37), (38, 43)
    else:
        roof, face = (4, 29), (30, 43)
    a, b = roof
    c.R(bx0, a, bx1 - bx0 + 1, b - a + 1, T[4])
    c.HL(bx0 + 1, a, bx1 - bx0 - 1, T[5])
    for j in range(1, 6): c.HL(bx0 + 1, a + j, 12 - 2 * j, T[5])
    c.VL(bx0, a + 1, b - a, T[5]); c.VL(bx1, a + 1, b - a, T[3]); c.VL(bx1 - 1, a + 1, b - a, T[3])
    flank_glass(c, a + 3, b - 2, {a + 3 + 8, a + 3 + 16} if down else {a + 7, a + 15})
    c.HL(bx0, b, bx1 - bx0 + 1, T[3])
    for k in range(2): c.X(bx0 + k, a); c.X(bx1 - k, a)
    if down:
        c.X(bx0, a + 1); c.X(bx1, a + 1)
        a, b = wind; h = b - a + 1
        c.R(bx0, a, bx1 - bx0 + 1, h, T[2]); c.VL(bx0, a, h, T[3])
        for j in range(h): glass_band(c, a + j, bx0 + 2, bx1 - 2, j, h)
        diag_glare(c, bx0 + 3, a, h); c.HL(bx0 + 1, b, bx1 - bx0 - 1, INK2)
        c.R(1, a + 2, 1, 3, T[3]); c.R(30, a + 2, 1, 3, T[2])
        a, b = hood; c.R(bx0, a, bx1 - bx0 + 1, 3, T[3]); c.HL(bx0 + 1, b, bx1 - bx0 - 1, T[5]); c.VL(bx0, a, 3, T[4])
        a, b = face
        c.R(bx0, a, bx1 - bx0 + 1, b - a + 1, T[2]); c.VL(bx0, a, b - a, T[3]); c.VL(bx1, a, b - a, T[1])
        for x in (bx0 + 1, bx1 - 4): c.R(x, a, 4, 2, HEAD[1]); c.HL(x, a + 1, 4, HEAD[0])
        c.R(10, a, 12, 2, INK2)
        for x in range(11, 21, 2): c.P(x, a, T[1])
        c.P(bx0 + 1, a + 2, AMB[left_on][left_on]); c.P(bx1 - 1, a + 2, AMB[right_on][right_on])
        c.HL(bx0, a + 3, bx1 - bx0 + 1, T[1]); plate(c, 13, a + 4); c.HL(bx0 + 1, b, bx1 - bx0 - 1, T[0])
    else:
        c.HL(bx0 + 2, 2, bx1 - bx0 - 3, T[3]); c.HL(bx0 + 2, 3, bx1 - bx0 - 3, G[0])   # hood + windshield sliver
        c.R(1, 5, 1, 2, T[3]); c.R(30, 5, 1, 2, T[2])
        a, b = face
        c.R(bx0, a, bx1 - bx0 + 1, b - a + 1, T[2]); c.HL(bx0, a, bx1 - bx0 + 1, T[3])
        c.VL(bx0, a, b - a, T[3]); c.VL(bx1, a, b - a, T[1])
        for x0, x1 in ((5, 14), (17, 26)):                                  # rear door windows
            c.R(x0, a + 1, x1 - x0 + 1, 5, INK2); c.R(x0 + 1, a + 2, x1 - x0 - 1, 3, G[1])
            c.HL(x0 + 1, a + 2, x1 - x0 - 1, G[3]); c.P(x0 + 2, a + 3, G[4]); c.P(x0 + 3, a + 3, G[3])
        c.VL(15, a + 1, 10, INK2); c.VL(16, a + 1, 10, T[3])                # barn-door seam
        for x in (13, 18): c.R(x, a + 7, 1, 2, CHR[1])
        for x in (bx0 + 1, bx1 - 1):                                       # vertical lamp stacks
            c.VL(x, a + 1, 4, TAIL[brake][1] if brake else TAIL[False][1]); c.VL(x, a + 5, 2, AMB[left_on if x < 16 else right_on][1 if (left_on if x < 16 else right_on) else 0])
            c.P(x, a + 7, HEAD[0])
        for x in (bx0 + 1, bx1 - 1): c.P(x + (1 if x < 16 else -1), a + 1, CHR[1])
        c.HL(bx0, a + 10, bx1 - bx0 + 1, T[1]); plate(c, 13, a + 8)
        c.R(bx0, a + 11, bx1 - bx0 + 1, 2, INK2); c.HL(bx0 + 1, a + 11, bx1 - bx0 - 1, CHR[0])
    c.oy = 0
    return c.finish((4, 27, 46, 47))


# ------------------------------------------------------------------ box trucks (truck / ambulance / firetruck, L=4)
def box_side(sp, ph=0, brake=False, sig=None, open_=False):
    W = 64; c = Cv(W, 32); T = R[sp['ramp']]; kind = sp['kind']
    bx0, bx1, BY1 = 2, 61, 24
    box1 = 43 if kind == 'ambulance' else 41
    BRY = 3 if kind != 'fire' else 8
    c.oy = -BOB[ph]
    # cargo body
    c.R(bx0, BRY, box1 - bx0 + 1, 3, T[4]); c.HL(bx0 + 1, BRY, box1 - bx0 - 1, T[5]); c.HL(bx0 + 1, BRY + 1, 14, T[5])
    c.X(bx0, BRY); c.X(box1, BRY)
    c.R(bx0, BRY + 3, box1 - bx0 + 1, BY1 - BRY - 2, T[3]); c.HL(bx0, BRY + 3, box1 - bx0 + 1, T[2])
    c.VL(bx0, BRY + 4, BY1 - BRY - 4, T[4]); c.HL(bx0, BY1 - 1, box1 - bx0 + 1, T[1])
    if kind == 'truck':
        for x in range(9, box1 - 2, 8): c.VL(x, BRY + 4, BY1 - BRY - 6, T[2]); c.VL(x + 1, BRY + 4, BY1 - BRY - 6, T[4])
    if kind == 'ambulance':
        c.R(bx0, 18, bx1 - bx0 + 1, 2, WINE[2]); c.HL(bx0, 19, bx1 - bx0 + 1, WINE[1])
        c.R(20, 9, 6, 2, WINE[2]); c.R(22, 7, 2, 6, WINE[2]); c.P(22, 7, '#c8404a')
    if kind == 'fire':                                                   # ladder + compartment doors + stripe
        c.HL(4, 4, 40, CHR[2]); c.HL(4, 7, 40, CHR[1])
        for x in range(5, 44, 4): c.R(x, 5, 1, 2, CHR[2])
        c.R(3, 8, 2, 1, CHR[0]); c.R(42, 8, 2, 1, CHR[0])
        for x0, x1 in ((4, 15), (17, 29), (31, 42)):
            c.R(x0, 12, x1 - x0 + 1, 7, CHR[1]); c.HL(x0, 12, x1 - x0 + 1, CHR[2])
            for y in (14, 16): c.HL(x0, y, x1 - x0 + 1, CHR[0])
        c.R(bx0, 20, bx1 - bx0 + 1, 2, '#e4e9e8'); c.HL(bx0, 21, bx1 - bx0 + 1, CHR[2])
    c.VL(box1 + 1, BRY + 2, BY1 - BRY - 1, INK2)
    # cab
    k0 = box1 + 2; CRY = 8 if kind == 'truck' else 7 if kind == 'fire' else 8
    ws0 = bx1 - 4 if kind == 'truck' else bx1 - 7
    c.R(k0, CRY + 3, bx1 - k0 + 1, BY1 - CRY - 2, T[3])
    c.R(k0, 17, bx1 - k0 + 1, BY1 - 16, T[2]); c.HL(k0, 16, bx1 - k0 + 1, T[4])
    if kind == 'ambulance': c.R(k0, 18, bx1 - k0 + 1, 2, WINE[2]); c.HL(k0, 19, bx1 - k0 + 1, WINE[1])
    if kind == 'fire': c.R(k0, 20, bx1 - k0 + 1, 2, '#e4e9e8'); c.HL(k0, 21, bx1 - k0 + 1, CHR[2])
    c.R(k0, CRY, ws0 - k0, 3, T[4]); c.HL(k0 + 1, CRY, ws0 - k0 - 2, T[5]); c.X(k0, CRY)
    gl = GT if kind == 'ambulance' else G
    c.R(k0 + 2, CRY + 4, ws0 - k0 - 4, 5, INK2); c.R(k0 + 3, CRY + 5, ws0 - k0 - 6, 3, gl[2]); c.HL(k0 + 3, CRY + 5, ws0 - k0 - 6, gl[3])
    for k in range(3): c.P(k0 + 4 + k, CRY + 5 + k, gl[5])
    hood_y = 13 if kind == 'ambulance' else 16
    for x in range(ws0, bx1 + 1):
        s = (x - ws0 + 1) / (bx1 - ws0 + 1); yf, yn = lerp(CRY, hood_y, s), lerp(CRY + 3, hood_y + 3, s)
        for y in range(yf, yn + 1):
            k = y - yf
            c.P(x, y, INK2 if y == yn else gl[4] if k == 0 else gl[5] if k == 1 else gl[3] if k == 2 else gl[2])
    if kind == 'ambulance': deck(c, ws0 + 3, bx1, hood_y, hood_y + 2, T); c.X(bx1, hood_y)
    c.VL(ws0 - 2, CRY + 4, BY1 - CRY - 5, T[1]); c.HL(ws0 - 5, CRY + 10, 2, T[1])
    c.P(ws0 - 1, CRY + 6, T[2]); c.P(ws0 - 1, CRY + 7, T[1])          # mirror
    c.R(bx1 - 1, 17, 2, 2, HEAD[1]); c.P(bx1, 19, AMB[sig == 'R'][sig == 'R'])
    tl = TAIL[brake]; c.R(bx0, BY1 - 6, 2, 3, tl[0]); c.P(bx0, BY1 - 6, tl[1]); c.P(bx0, BY1 - 3, AMB[sig == 'R'][sig == 'R'])
    if sig == 'L': c.P(bx1 - 1, CRY + 1, AMB[True][1]); c.P(bx0 + 1, BRY + 1, AMB[True][1])
    if kind in ('ambulance', 'fire'):
        lit = ph % 2; ly = CRY - 2
        c.R(k0 + 2, ly, 3, 2, '#c8404a' if lit else WINE[1]); c.R(k0 + 6, ly, 3, 2, '#e4e9e8' if not lit else CHR[0])
        c.R(k0 + 10, ly, 3, 2, '#c8404a' if not lit else WINE[1])
    c.R(bx0, BY1, bx1 - bx0 + 1, 2, INK2); c.HL(bx0 + 1, BY1, bx1 - bx0 - 1, CHR[0])
    c.oy = 0
    wx = (12, 23, 52) if kind == 'fire' else (13, 52)
    for x in wx: side_arch(c, x, 26)
    for x in wx: side_wheel(c, x, 26, ph)
    return c.finish((4, bx1 - 2, 31, 31))


def box_ns(sp, view, ph=0, brake=False, sig=None, open_=False):
    H = 64; c = Cv(32, H); T = R[sp['ramp']]; kind = sp['kind']; down = view == 'down'
    bx0, bx1, kx0, kx1 = 2, 29, 4, 27
    tyres(c, 57, 5, bx0, bx1, ph); flank_axles(c, (7,) if kind != 'fire' else (7, 15), ph)
    c.oy = -BOB[ph]
    left_on, right_on = (sig == 'R', sig == 'L') if down else (sig == 'L', sig == 'R')
    gl = GT if kind == 'ambulance' else G
    lit = ph % 2

    def roof(a, b, far_top=True):
        c.R(bx0, a, bx1 - bx0 + 1, b - a + 1, T[4])
        c.HL(bx0 + 1, a if far_top else b, bx1 - bx0 - 1, T[5])
        for j in range(1, 6): c.HL(bx0 + 1, a + j, 12 - 2 * j, T[5])
        c.VL(bx0, a, b - a + 1, T[5]); c.VL(bx1, a, b - a + 1, T[3]); c.VL(bx1 - 1, a, b - a + 1, T[3])
        if kind == 'truck':
            for y in range(a + 6, b - 2, 7): c.HL(bx0 + 1, y, bx1 - bx0 - 1, T[3])
        if kind == 'ambulance':
            m = (a + b) // 2; c.R(13, m - 1, 6, 2, WINE[2]); c.R(15, m - 3, 2, 6, WINE[2])
        if kind == 'fire':
            c.R(bx0 + 1, a, bx1 - bx0 - 1, b - a + 1, T[3]); c.VL(bx0, a, b - a + 1, T[4])
            c.R(8, a + 1, 16, b - a - 1, T[1])
            for x in (9, 22): c.VL(x, a + 1, b - a - 1, CHR[2]); c.VL(x + 1, a + 1, b - a - 1, CHR[1])
            for y in range(a + 2, b - 1, 3): c.HL(11, y, 11, CHR[2])
        for k in range(2): c.X(bx0 + k, a); c.X(bx1 - k, a)

    if down:
        rb = 36 if kind != 'fire' else 38
        roof(2, rb)
        a = rb + 1
        if kind == 'fire':                                                # cab directly ahead, light bar
            c.R(kx0, a, kx1 - kx0 + 1, 2, T[2])
            c.R(kx0 + 2, a, 6, 2, '#c8404a' if lit else WINE[1]); c.R(kx0 + 9, a, 6, 2, '#e4e9e8' if not lit else CHR[0])
            c.R(kx0 + 16, a, 6, 2, '#c8404a' if not lit else WINE[1])
            cr = (a + 2, a + 6)
        else:
            c.R(bx0, a, bx1 - bx0 + 1, 5, T[2]); c.HL(bx0, a, bx1 - bx0 + 1, T[3]); c.HL(bx0, a + 4, bx1 - bx0 + 1, T[1])
            c.VL(bx0, a, 5, T[3])
            for x in (bx0 + 1, bx1 - 2): c.R(x, a + 1, 2, 1, AMB[True][0])
            if kind == 'ambulance':
                c.R(12, a + 1, 3, 2, '#c8404a' if lit else WINE[1]); c.R(17, a + 1, 3, 2, '#c8404a' if not lit else WINE[1])
            cr = (a + 5, a + 9)
        a, b = cr
        c.R(kx0, a, kx1 - kx0 + 1, b - a + 1, T[4]); c.HL(kx0, a, kx1 - kx0 + 1, T[3]); c.HL(kx0 + 1, b, kx1 - kx0 - 1, T[5])
        c.VL(kx0, a, b - a + 1, T[5]); c.VL(kx1, a, b - a + 1, T[3])
        wy = b + 1; wh = 7
        c.R(kx0, wy, kx1 - kx0 + 1, wh, T[2]); c.VL(kx0, wy, wh, T[3])
        for j in range(wh): glass_band(c, wy + j, kx0 + 1, kx1 - 1, j, wh, gl)
        diag_glare(c, kx0 + 2, wy, wh, gl); c.HL(kx0, wy + wh - 1, kx1 - kx0 + 1, INK2)
        c.R(1, wy + 1, 2, 4, CHR[0]); c.R(29, wy + 1, 2, 4, CHR[0]); c.VL(1, wy + 1, 4, CHR[1])
        a = wy + wh
        if kind == 'ambulance':
            c.R(kx0, a, kx1 - kx0 + 1, 2, T[3]); c.HL(kx0 + 1, a + 1, kx1 - kx0 - 1, T[5]); a += 2
        b = 55
        c.R(kx0, a, kx1 - kx0 + 1, b - a + 1, T[2]); c.VL(kx0, a, b - a, T[3]); c.VL(kx1, a, b - a, T[1])
        if kind == 'ambulance': c.R(kx0, a + 2, kx1 - kx0 + 1, 1, WINE[2])
        if kind == 'fire': c.HL(kx0, a + 3, kx1 - kx0 + 1, '#e4e9e8')
        for x in (kx0 + 1, kx1 - 4): c.R(x, a, 4, 2, HEAD[1]); c.HL(x, a + 1, 4, HEAD[0])
        c.R(11, a, 10, 3, INK2)
        for x in range(12, 20, 2): c.VL(x, a, 3, CHR[1] if kind == 'fire' else T[1])
        c.P(kx0 + 1, a + 2, AMB[left_on][left_on]); c.P(kx1 - 1, a + 2, AMB[right_on][right_on])
        c.R(bx0, b - 2, bx1 - bx0 + 1, 3, INK2); c.HL(bx0 + 1, b - 2, bx1 - bx0 - 1, CHR[0]); plate(c, 13, b - 4)
    else:
        if kind == 'fire':
            c.R(kx0, 2, kx1 - kx0 + 1, 3, T[3]); c.HL(kx0 + 1, 2, kx1 - kx0 - 1, T[4])
            c.R(kx0 + 2, 3, 6, 2, '#c8404a' if lit else WINE[1]); c.R(kx1 - 7, 3, 6, 2, '#c8404a' if not lit else WINE[1])
            roof(5, 44)
        else:
            c.R(kx0, 2, kx1 - kx0 + 1, 6, T[4]); c.HL(kx0 + 1, 2, kx1 - kx0 - 1, T[5]); c.VL(kx0, 2, 6, T[5]); c.VL(kx1, 2, 6, T[3])
            c.X(kx0, 2); c.X(kx1, 2)
            if kind == 'ambulance': c.R(kx0 + 2, 3, 4, 2, '#c8404a' if lit else WINE[1]); c.R(kx1 - 5, 3, 4, 2, '#c8404a' if not lit else WINE[1])
            c.R(1, 5, 1, 3, CHR[1]); c.R(30, 5, 1, 3, CHR[0])
            roof(8, 42)
        a = 43 if kind != 'fire' else 45; b = 55
        c.R(bx0, a, bx1 - bx0 + 1, b - a + 1, T[2]); c.HL(bx0, a, bx1 - bx0 + 1, T[3]); c.VL(bx0, a, b - a, T[3]); c.VL(bx1, a, b - a, T[1])
        if kind == 'fire':
            c.R(5, a + 1, 22, 6, CHR[1]); c.HL(5, a + 1, 22, CHR[2])
            for y in (a + 3, a + 5): c.HL(5, y, 22, CHR[0])
            c.HL(bx0, a + 8, bx1 - bx0 + 1, '#e4e9e8')
        else:
            c.VL(15, a + 1, b - a - 3, INK2); c.VL(16, a + 1, b - a - 3, T[3])     # barn doors
            for x in (8, 23): c.VL(x, a + 2, b - a - 5, CHR[1]); c.VL(x + 1, a + 2, b - a - 5, CHR[2])
            for x in (13, 18): c.R(x, a + 6, 1, 2, CHR[0])
            if kind == 'ambulance':
                c.HL(bx0, a + 7, bx1 - bx0 + 1, WINE[2])
                c.R(5, a + 2, 3, 3, GT[2]); c.HL(5, a + 2, 3, GT[4]); c.R(24, a + 2, 3, 3, GT[2]); c.HL(24, a + 2, 3, GT[4])
        tl = TAIL[brake]
        for x, on in ((bx0 + 1, left_on), (bx1 - 1, right_on)):
            c.VL(x, a + 1, 4, tl[1] if brake else tl[0]); c.P(x, a + 1, tl[1]); c.VL(x, a + 5, 2, AMB[on][1 if on else 0]); c.P(x, a + 7, HEAD[0])
        c.R(bx0, b - 2, bx1 - bx0 + 1, 3, INK2); c.HL(bx0 + 1, b - 2, bx1 - bx0 - 1, CHR[0]); plate(c, 13, b - 4)
    c.oy = 0
    return c.finish((4, 27, 62, 63))


# ------------------------------------------------------------------ city bus (L=5)
def bus_side(sp, ph=0, brake=False, sig=None, open_=False):
    W = 80; c = Cv(W, 32); T = R['bus']
    bx0, bx1, BY1 = 2, 77, 25
    c.oy = -BOB[ph]
    c.R(bx0, 2, 74 - bx0, 5, T[4]); c.HL(bx0 + 1, 2, 72 - bx0, T[5]); c.HL(bx0 + 1, 3, 30, T[5]); c.X(bx0, 2)
    for x0 in (14, 46):                                                  # rounded roof AC pods
        c.R(x0, 2, 16, 3, '#e4e9e8'); c.HL(x0 + 1, 1, 14, '#e4e9e8'); c.HL(x0, 4, 16, CHR[2]); c.HL(x0 + 1, 5, 14, CHR[1])
        c.X(x0, 2); c.X(x0 + 15, 2)
    c.R(bx0, 7, 74 - bx0, BY1 - 6, T[3]); c.HL(bx0, 7, 74 - bx0, T[2])
    c.R(bx0, 17, bx1 - bx0 + 1, BY1 - 16, T[2])
    c.HL(bx0, 17, bx1 - bx0 + 1, '#e4cfae'); c.HL(bx0, 18, bx1 - bx0 + 1, '#d6b073'); c.HL(bx0, 19, bx1 - bx0 + 1, '#d2a54c')
    c.R(bx0, 20, bx1 - bx0 + 1, 2, WINE[1]); c.HL(bx0, 21, bx1 - bx0 + 1, WINE[2])
    c.HL(bx0, BY1, bx1 - bx0 + 1, T[0]); c.VL(bx0, 3, BY1 - 3, T[4])
    for x0, x1 in ((5, 14), (17, 26), (29, 38), (54, 61), (63, 69)):      # windows
        c.R(x0, 8, x1 - x0 + 1, 8, INK2); c.R(x0 + 1, 9, x1 - x0 - 1, 6, G[2]); c.HL(x0 + 1, 9, x1 - x0 - 1, G[3])
        c.HL(x0 + 1, 14, x1 - x0 - 1, G[1])
        for k in range(4): c.P(x0 + 2 + k, 9 + k, G[5]); c.P(x0 + 3 + k, 9 + k, G[4])
    for x0, x1 in ((42, 51), (70, 75)):                                  # doors
        c.R(x0, 8, x1 - x0 + 1, 17, INK2)
        if open_:
            c.R(x0 + 1, 9, x1 - x0 - 1, 15, INK); c.VL(x0 + 2, 10, 13, CHR[1]); c.HL(x0 + 1, 23, x1 - x0 - 1, CHR[1])
        else:
            c.R(x0 + 1, 9, x1 - x0 - 1, 14, G[2]); c.HL(x0 + 1, 9, x1 - x0 - 1, G[3])
            c.VL((x0 + x1) // 2, 9, 14, INK2); c.HL(x0 + 1, 23, x1 - x0 - 1, CHR[2])
            for k in range(3): c.P(x0 + 1 + k, 10 + k, G[5])
    for y in range(2, 25):                                               # near-vertical front glass
        x = 74 + min(3, (y - 2) // 4)
        for xx in range(x, bx1 + 1): c.P(xx, y, T[2])
        if y < 16:
            for xx in range(74 + min(3, (y - 2) // 4), bx1): c.P(xx, y, G[4] if y < 4 else G[3] if y < 7 else G[2])
    c.R(bx1 - 1, 20, 2, 2, HEAD[1]); c.P(bx1, 22, AMB[sig == 'R'][sig == 'R'])
    tl = TAIL[brake]; c.R(bx0, 18, 2, 3, tl[0]); c.P(bx0, 18, tl[1]); c.P(bx0, 21, AMB[sig == 'R'][sig == 'R'])
    if sig == 'L': c.P(bx1 - 2, 2, AMB[True][1]); c.P(bx0 + 1, 2, AMB[True][1])
    c.R(bx1 - 2, 23, 3, 2, INK2); c.R(bx0, 23, 3, 2, INK2)
    c.oy = 0
    for x in (16, 62): side_arch(c, x, 26)
    for x in (16, 62): side_wheel(c, x, 26, ph)
    return c.finish((4, bx1 - 2, 31, 31))


def bus_ns(sp, view, ph=0, brake=False, sig=None, open_=False):
    H = 80; c = Cv(32, H); T = R['bus']; bx0, bx1 = 2, 29; down = view == 'down'
    tyres(c, 73, 5, bx0, bx1, ph); flank_axles(c, (9,), ph)
    c.oy = -BOB[ph]
    left_on, right_on = (sig == 'R', sig == 'L') if down else (sig == 'L', sig == 'R')
    a, b = (2, 57) if down else (2, 59)
    c.R(bx0, a, bx1 - bx0 + 1, b - a + 1, T[4]); c.HL(bx0 + 1, a, bx1 - bx0 - 1, T[5])
    for j in range(1, 6): c.HL(bx0 + 1, a + j, 12 - 2 * j, T[5])
    c.VL(bx0, a, b - a + 1, T[5]); c.VL(bx1, a, b - a + 1, T[3]); c.VL(bx1 - 1, a, b - a + 1, T[3])
    c.HL(bx0, b, bx1 - bx0 + 1, T[3])
    flank_glass(c, a + 4, b - 2, set(range(a + 4, b, 9)))
    for k in range(2): c.X(bx0 + k, a); c.X(bx1 - k, a)
    for p0 in ((8, 34) if down else (12, 38)):                            # two rounded AC pods
        c.R(7, p0, 18, 12, '#e4e9e8'); c.HL(8, p0 - 1, 16, '#e4e9e8')
        c.VL(24, p0, 12, CHR[2]); c.HL(7, p0 + 11, 18, CHR[2]); c.HL(8, p0 + 12, 16, CHR[1])
        c.VL(7, p0 + 1, 10, '#e4e9e8'); c.P(7, p0, None)
        c.HL(9, p0 + 1, 6, T[5]) if False else None
        c.X(7, p0); c.X(24, p0); c.X(7, p0 + 11); c.X(24, p0 + 11)
        c.R(10, p0 + 3, 12, 6, CHR[2]); c.HL(10, p0 + 3, 12, '#e4e9e8')
    c.R(13, 25 if down else 27, 6, 4, T[3]); c.HL(13, 25 if down else 27, 6, T[2])  # roof hatch
    if down:
        a = 58
        c.R(bx0, a, bx1 - bx0 + 1, 3, INK2)                                # LED destination board
        for x in range(6, 26, 2): c.P(x, a + 1, '#ffb94a')
        c.HL(6, a + 1, 6, '#ffb94a'); c.P(bx0 + 1, a + 1, '#4a6ba1')
        wy, wh = 61, 9
        c.R(bx0, wy, bx1 - bx0 + 1, wh, T[2])
        for x0, x1 in ((bx0 + 1, 15), (16, bx1 - 1)):
            for j in range(wh): glass_band(c, wy + j, x0, x1, j, wh)
            diag_glare(c, x0 + 1, wy, wh)
        c.VL(15, wy, wh, INK2); c.VL(16, wy, wh, T[2])
        for k in range(5): c.P(5 + k, wy + wh - 2 - k // 2, INK2); c.P(19 + k, wy + wh - 2 - k // 2, INK2)   # wipers
        c.R(0, wy - 2, 2, 5, CHR[0]); c.VL(1, wy - 2, 5, CHR[1]); c.R(30, wy - 2, 2, 5, CHR[0])           # transit mirrors
        a, b = wy + wh, 71
        c.R(bx0, a, bx1 - bx0 + 1, b - a + 1, T[2]); c.VL(bx0, a, b - a, T[3]); c.VL(bx1, a, b - a, T[1])
        c.HL(bx0, a, bx1 - bx0 + 1, T[3])
        for x in (bx0 + 1, bx1 - 4): c.R(x, a + 1, 4, 2, HEAD[1]); c.HL(x, a + 2, 4, HEAD[0])
        c.P(bx0 + 1, a, AMB[left_on][left_on]); c.P(bx1 - 1, a, AMB[right_on][right_on])
        c.R(bx0, b - 1, bx1 - bx0 + 1, 2, INK2); c.HL(bx0 + 1, b - 1, bx1 - bx0 - 1, CHR[0]); plate(c, 13, a + 1)
    else:
        a, b = 60, 71
        c.R(bx0, a, bx1 - bx0 + 1, b - a + 1, T[2]); c.HL(bx0, a, bx1 - bx0 + 1, T[3])
        c.VL(bx0, a, b - a, T[3]); c.VL(bx1, a, b - a, T[1])
        c.R(6, a + 1, 20, 4, INK2); c.R(7, a + 1, 18, 3, G[1]); c.HL(7, a + 1, 18, G[2]); c.P(8, a + 2, G[3]); c.P(9, a + 2, G[2])
        for y in range(a + 6, a + 10, 2): c.HL(8, y, 16, T[0]); c.HL(8, y + 1, 16, T[4])   # engine louvers
        tl = TAIL[brake]
        for x, on in ((bx0 + 1, left_on), (bx1 - 2, right_on)):
            c.R(x, a + 1, 2, 4, tl[0]); c.HL(x, a + 1, 2, tl[1]) if not brake else c.R(x, a + 1, 2, 4, tl[1])
            c.R(x, a + 5, 2, 2, AMB[on][1 if on else 0]); c.R(x, a + 7, 2, 1, HEAD[0])
        plate(c, 13, a + 9)
        c.R(bx0, b - 1, bx1 - bx0 + 1, 2, INK2); c.HL(bx0 + 1, b - 1, bx1 - bx0 - 1, CHR[0])
    c.oy = 0
    return c.finish((4, 27, 78, 79))


# ------------------------------------------------------------------ catalogue
SEDAN, SPORT = dict(fn='car'), dict(fn='car', sport=True)
VEH = {
    'mc-veh-police-a': dict(SEDAN, ramp='pwhite', police=True, L=3),
    'mc-veh-taxi-b': dict(SEDAN, ramp='taxi', taxi=True, teal=True, chrome=True, fog=True, stripe=GOLD[1], L=3),
    'mc-veh-car2-c-red': dict(SPORT, ramp='red', L=3),
    'mc-veh-car2-c-beige': dict(SPORT, ramp='beige', L=3),
    'mc-veh-car2-c-green': dict(SPORT, ramp='green', L=3),
    'mc-veh-sedan-a-navy': dict(SEDAN, ramp='navy', chrome=True, L=3),
    'mc-veh-sedan-a-white': dict(SEDAN, ramp='white', L=3),
    'mc-veh-sedan-a-black': dict(SEDAN, ramp='black', chrome=True, L=3),
    'mc-veh-sedan-a': dict(SEDAN, ramp='silver', L=3),
    'mc-veh-van-a': dict(fn='van', ramp='truck', L=3),
    'mc-veh-truck-a': dict(fn='box', kind='truck', ramp='truck', L=4),
    'mc-veh-ambulance-a': dict(fn='box', kind='ambulance', ramp='truck', L=4),
    'mc-veh-firetruck-b': dict(fn='box', kind='fire', ramp='fire', L=4),
    'mc-veh-bus-a': dict(fn='bus', L=5),
}
SIDE = dict(car=car_side, van=van_side, box=box_side, bus=bus_side)
NS = dict(car=car_ns, van=van_ns, box=box_ns, bus=bus_ns)


def frame(vid, view, ph=0, brake=False, sig=None, open_=False):
    sp = VEH[vid]
    if view == 'right':
        return SIDE[sp['fn']](sp, ph, brake, sig, open_)
    if view == 'left':   # mirror of the right view; the near side is now the vehicle's left
        sw = {'L': 'R', 'R': 'L'}.get(sig)
        return SIDE[sp['fn']](sp, ph, brake, sw, open_).transpose(Image.FLIP_LEFT_RIGHT)
    return NS[sp['fn']](sp, view, ph, brake, sig, open_)


COLS = [('base', {}), ('_0', dict(ph=0)), ('_1', dict(ph=1)), ('_2', dict(ph=2)), ('_3', dict(ph=3)),
        ('_brake', dict(brake=True)), ('_sigL', dict(sig='L')), ('_sigR', dict(sig='R'))]


def sheet(vid):
    L = VEH[vid]['L']; ew = L * 16; bus = vid == 'mc-veh-bus-a'
    W = max(ew * (len(COLS) + bus), 32 * len(COLS)); H = 64 + 2 * L * 16
    im = Image.new('RGBA', (W, H))
    y = 0
    for view, cw, ch in (('right', ew, 32), ('left', ew, 32), ('up', 32, L * 16), ('down', 32, L * 16)):
        cols = COLS + ([('_open', dict(open_=True))] if bus and view in ('right', 'left') else [])
        for i, (_, kw) in enumerate(cols):
            f = frame(vid, view, **kw)
            assert f.size == (cw, ch), (vid, view, f.size)
            im.alpha_composite(f, (i * cw, y))
        y += ch
    return im


def board(path, z=3):
    """QA board: every vehicle's 4 base views side by side on a 16px grid."""
    rows = []
    for vid in VEH:
        ims = [frame(vid, v) for v in ('right', 'left', 'down', 'up')]
        rows.append(ims)
    pad = 8
    W = max(sum(i.width for i in r) + pad * 5 for r in rows)
    H = sum(max(i.height for i in r) + pad for r in rows) + pad
    b = Image.new('RGBA', (W, H), (52, 56, 66, 255))
    from PIL import ImageDraw
    d = ImageDraw.Draw(b)
    for x in range(0, W, 16): d.line([(x, 0), (x, H)], fill=(60, 64, 76, 255))
    for y in range(0, H, 16): d.line([(0, y), (W, y)], fill=(60, 64, 76, 255))
    y = pad
    for r in rows:
        h = max(i.height for i in r); x = pad
        for i in r:
            b.alpha_composite(i, (x, y + h - i.height)); x += i.width + pad
        y += h + pad
    b.resize((W * z, H * z), Image.NEAREST).save(path)
    return b


if __name__ == '__main__':
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    man = {}
    for vid, sp in VEH.items():
        im = sheet(vid); im.save(os.path.join(out, vid + '.png'))
        man[vid] = dict(L=sp['L'], size=im.size, ew=[sp['L'] * 16, 32], ns=[32, sp['L'] * 16],
                        rows=['right', 'left', 'up', 'down'], cols=[n for n, _ in COLS] + (['_open'] if vid == 'mc-veh-bus-a' else []))
    json.dump(man, open(os.path.join(out, 'manifest.json'), 'w'), indent=1)
    if '--board' in sys.argv:
        board(sys.argv[sys.argv.index('--board') + 1])
    print('wrote', len(man), 'sheets to', out)
