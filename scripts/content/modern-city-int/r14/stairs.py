# R14 stairs & escalators redrawn as real 3/4 top-view flights - 2026-10-19 user: 「백화점이랑 집안 내부에서 계단으로 쓰이는 건
# 다시만들어야할듯. 너무 .. 계단같지가않음. 그 백화점 계단을 참고해봐」.
# Every wall flight is a tunnel cut into the north wall: a lintel over a dark upper-floor void, side walls that widen as the
# flight recedes (stepped stringer edge = sawtooth), a diagonal handrail on each side and newel posts at the floor.
#   up   : each step shows its riser (front face, shadowed under the nosing) and its tread (lit, bright nosing row);
#          steps shrink and darken as they climb toward the upper floor.
#   down : only treads are visible (risers face away) - thin drop lines between treads that crowd and sink into darkness.
# Floor wells (stairs going down through the floor) show the pit's far wall, guard rails on three sides and treads
# descending north from the open south edge.
# Drawing kit: r10/lib.py (1px ink outline, lighter top surface above a darker front face, 1px floor shadow).
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'r10'))
from lib import C, OL, SH, lt, dk, GOLD, GOLD_D, YELLOW, YELLOW_D, BLACK, STEEL, STEEL_D, STEEL_L, WHITE

VOID = (22, 20, 30)

# tread, nose, riser, riser shadow, side wall (lit / shaded), stringer, rail (dark / light), post, header
MATS = {
    'wood': dict(tread=(206, 158, 96), nose=(240, 204, 146), riser=(142, 96, 52), riser_d=(96, 62, 32),
                 wall=(232, 220, 196), wall_d=(196, 182, 156), stringer=(150, 100, 52), rail=(104, 62, 28), rail_l=(184, 126, 66),
                 post=(150, 98, 48), post_l=(204, 148, 86), header=(132, 88, 46), header_l=(184, 132, 76)),
    'stone': dict(tread=(200, 202, 208), nose=(236, 238, 242), riser=(132, 136, 148), riser_d=(92, 96, 108),
                  wall=(214, 214, 218), wall_d=(176, 178, 186), stringer=(150, 154, 164), rail=(70, 76, 90), rail_l=(176, 184, 198),
                  post=(110, 116, 130), post_l=(190, 196, 208), header=(120, 124, 136), header_l=(170, 174, 186), strip=(66, 70, 80)),
    'grand': dict(tread=(236, 232, 224), nose=(255, 252, 244), riser=(180, 172, 162), riser_d=(136, 128, 120),
                  wall=(132, 88, 52), wall_d=(102, 66, 38), stringer=(214, 206, 194), rail=GOLD_D, rail_l=GOLD,
                  post=(96, 62, 34), post_l=(150, 104, 60), header=(96, 62, 34), header_l=(150, 104, 60),
                  carpet=(184, 38, 52), carpet_l=(220, 70, 80), carpet_d=(122, 22, 34)),
    'steel': dict(tread=(196, 200, 210), nose=YELLOW, riser=(118, 124, 136), riser_d=(70, 74, 86),
                  wall=(168, 206, 224), wall_d=(130, 176, 200), stringer=(60, 62, 72), rail=BLACK, rail_l=(84, 88, 100),
                  post=(60, 62, 72), post_l=(110, 114, 126), header=(44, 48, 58), header_l=(84, 90, 104), glass=True, escalator=True),
}


def lerp(a, b, t): return round(a + (b - a) * t)


def flight(c, m, x0, x1, yb, steps, conv, up):
    """Steps from the floor line yb upward. Returns per-row inner bounds {y: (a, b)} and the top row of the flight."""
    n = len(steps); y = yb; bounds = {}
    for k, (r, t) in enumerate(steps):
        u = k / max(1, n - 1)
        inset = round(conv * u)
        a, b = x0 + inset, x1 - inset
        f = (1.0 - 0.42 * u) if up else (0.92 - 0.6 * u)
        carpet = m.get('carpet')
        cw = (b - a + 1) * 2 // 5; ca, cb = (a + b + 1) // 2 - cw // 2, (a + b + 1) // 2 + cw // 2 - 1
        if up:
            # riser: front face, darkest under the nosing, lit toward the floor
            c.r(a, y - r + 1, b, y, dk(m['riser'], f))
            c.r(a, y - r + 1, b, y - r + 1, dk(m['riser_d'], f))
            if m.get('escalator'):
                for gx in range(a + 1, b, 2): c.r(gx, y - r + 2, gx, y, dk(m['riser_d'], f))
            if carpet:
                c.r(ca, y - r + 1, cb, y, dk(m['carpet_d'], f * 1.05)); c.r(ca, y, cb, y, dk(GOLD, f))
            for yy in range(y - r + 1, y + 1): bounds[yy] = (a, b)
            y -= r
        else:
            c.r(a, y, b, y, dk(VOID, 1.0)); bounds[y] = (a, b); y -= 1
        # tread: lit surface, bright nosing on its front (bottom) row
        c.r(a, y - t + 1, b, y, dk(m['tread'], f))
        c.r(a, y, b, y, dk(m['nose'], f))
        if m.get('strip'): c.r(a + 1, y - 1, b - 1, y - 1, dk(m['strip'], f)) if t >= 3 else None
        if m.get('escalator'):
            for gx in range(a + 2, b - 1, 2): c.r(gx, y - t + 1, gx, y - 1, dk(STEEL_D, f))
            c.r(a, y - t + 1, a, y, dk(YELLOW_D, f)); c.r(b, y - t + 1, b, y, dk(YELLOW_D, f))
        if carpet:
            c.r(ca, y - t + 1, cb, y, dk(m['carpet'], f)); c.r(ca, y, cb, y, dk(m['carpet_l'], f))
            c.r(ca - 1, y - t + 1, ca - 1, y, dk(GOLD_D, f)); c.r(cb + 1, y - t + 1, cb + 1, y, dk(GOLD_D, f))
        for yy in range(y - t + 1, y + 1): bounds[yy] = (a, b)
        y -= t
    return bounds, y + 1


def wall_flight(w, h, mat, up=True, sign=None, header=5, newel=True):
    """3/4 flight into a north-wall opening on a w x h canvas whose bottom 16px row is the solid floor footprint."""
    m = MATS[mat]; c = C(w, h)
    yb = h - 5 if h >= 48 else h - 1
    x0, x1 = (8, w - 9) if w >= 48 else (5, w - 6)
    conv = 5 if w >= 48 else 3
    steps = ([(4, 3), (4, 3), (3, 3), (3, 2), (3, 2), (2, 2)] if h >= 48 else [(3, 2), (3, 2), (3, 2), (2, 2), (2, 2), (2, 1)]) if up \
        else ([(1, 5), (1, 4), (1, 4), (1, 3), (1, 3), (1, 3), (1, 2), (1, 2)] if h >= 48 else [(1, 4), (1, 3), (1, 3), (1, 3), (1, 2), (1, 2), (1, 2)])
    # dark void of the upper (or lower) floor behind the flight
    c.r(1, header, w - 2, yb, VOID)
    bounds, top = flight(c, m, x0, x1, yb, steps, conv, up)
    for yy in range(header + 1, top):
        bounds[yy] = bounds[top]
        f = 0.35 + 0.25 * (yy - header) / max(1, top - header)
        c.r(bounds[top][0], yy, bounds[top][1], yy, dk(m['riser_d'] if up else VOID, f))
    # side walls (or glass balustrades): widen toward the top, stepped stringer on the inner edge
    glass = m.get('glass')
    for yy in range(header + 1, yb + 1):
        a, b = bounds[yy]
        sh = 0.7 + 0.3 * (yy - header) / max(1, yb - header)
        c.r(1, yy, a - 2, yy, dk(m['wall'], sh)); c.r(b + 2, yy, w - 2, yy, dk(m['wall_d'], sh))
        c.p(a - 1, yy, dk(m['stringer'], sh)); c.p(b + 1, yy, dk(dk(m['stringer'], 0.85), sh))
    # straight slope line from the foot of the flight to the lintel - handrail and glare follow it, not the sawtooth
    a_bot, b_bot = bounds[yb]; a_top, b_top = bounds[top]

    def slope(yy, side):
        u = (yb - yy) / max(1, yb - header)
        return lerp(a_bot, a_top, u) - 3 if side == 0 else lerp(b_bot, b_top, u) + 3
    if glass:
        # two parallel glare streaks on each glass panel, and a lit skirt light along the steps (escalator)
        for side in (0, 1):
            for off in (3, 5):
                for yy in range(header + 3, yb - 4):
                    if (yy // 3) % 3 == 0: continue
                    x = slope(yy, side) + (-off if side == 0 else off)
                    if 1 <= x <= w - 2: c.p(x, yy, lt(m['wall'], 1.18))
            if m.get('escalator'):
                for yy in range(header + 2, yb + 1):
                    a, b = bounds[yy]
                    c.p(a - 1 if side == 0 else b + 1, yy, (250, 182, 64))
    # handrails: diagonal lines parallel to the flight, rising from the newel posts into the lintel
    for side in (0, 1):
        pts = [(slope(yy, side), yy) for yy in range(header + 1, yb - 3)]
        for x, yy in pts:
            c.p(x, yy, m['rail']); c.p(x + (1 if side == 0 else -1), yy, m['rail_l'])
            if m.get('escalator'): c.p(x - (1 if side == 0 else -1), yy, m['rail'])
        # balusters under the rail every few rows (not on glass)
        if not glass:
            for x, yy in pts[2::5]:
                xi = x + (1 if side == 0 else -1)
                for d in range(1, 4): c.p(xi, yy + d, dk(m['rail'], 1.1))
    # outline of the opening + lintel
    c.r(0, header, 0, yb, OL); c.r(w - 1, header, w - 1, yb, OL)
    c.box(0, 0, w - 1, header, m['header']); c.r(1, 1, w - 2, 1, m['header_l'])
    c.r(1, header + 1, w - 2, header + 1, dk(VOID, 0.8))
    if sign:
        col = (70, 210, 110) if sign == 'up' else (246, 150, 50)
        sx = w // 2
        c.box(sx - 6, 0, sx + 5, header, BLACK); c.r(sx - 5, 1, sx + 4, header - 1, (18, 20, 26))
        for i in range(min(3, header - 1)):
            if sign == 'up': c.r(sx - 1 - i, 1 + i, sx + i, 1 + i, col)
            else: c.r(sx - 1 - i, header - 1 - i, sx + i, header - 1 - i, col)
    # newel posts at the foot of the flight (3/4 box: cap on top, front face)
    if newel and h >= 48:
        for px in (1, w - 7):
            if m.get('escalator'):
                c.rbox(px + 1, yb - 6, px + 5, yb + 1, BLACK); c.p(px + 2, yb - 5, (80, 82, 94))
                continue
            c.box(px, yb - 9, px + 5, yb + 2, m['post'])
            c.r(px + 1, yb - 8, px + 4, yb - 7, m['post_l']); c.r(px + 1, yb + 1, px + 4, yb + 1, dk(m['post'], 0.75))
            if mat in ('marble', 'grand'):
                c.oval(px + 1, yb - 13, px + 4, yb - 10, GOLD); c.p(px + 2, yb - 12, (255, 240, 180))
            else:
                c.box(px - 1, yb - 11, px + 6, yb - 8, m['post_l']); c.r(px, yb - 10, px + 5, yb - 10, lt(m['post_l'], 1.12))
            c.r(px + 1, yb + 3, px + 6, yb + 3, SH)
    # floor apron below the first step
    if h >= 48:
        if m.get('escalator'):
            c.r(x0, yb + 1, x1, yb + 1, YELLOW)
            c.box(x0 - 2, yb + 1, x1 + 2, h - 1, STEEL); c.dither(x0 - 1, yb + 2, x1 + 1, h - 2, STEEL_L)
            col = (70, 210, 110) if up else (246, 150, 50)
            cx = (x0 + x1 + 1) // 2
            for i in range(2):
                if up: c.r(cx - 1 - i, yb + 2 + i, cx + i, yb + 2 + i, col)
                else: c.r(cx - 1 - i, yb + 3 - i, cx + i, yb + 3 - i, col)
        else:
            c.r(x0, yb + 1, x1, yb + 1, dk(m['riser_d'], 0.8))
    return c.done()


def floor_well(w, h, mat):
    """Stairs going down through the floor: rim, far pit wall, guard rails on west/north/east, treads descending north."""
    m = MATS[mat]; c = C(w, h)
    big = w >= 48
    rim = 3 if big else 2
    x0, x1 = rim + 1, w - rim - 2
    ytop = rim + (6 if big else 4)            # far (north) pit wall face seen from the south
    c.r(0, 0, w - 1, h - 1, dk(m['riser_d'], 0.6))
    # far wall face
    c.r(x0, rim, x1, ytop, dk(m['wall_d'], 0.55)); c.r(x0, rim, x1, rim, dk(m['wall_d'], 0.35))
    # treads from the south (floor level) going north and down
    bands = [5, 4, 4, 3, 3, 3, 2, 2] if big else [4, 3, 3, 3, 2, 2]
    y = h - 2
    for k, t in enumerate(bands):
        u = k / (len(bands) - 1)
        f = 0.95 - 0.6 * u
        if y - t < ytop: break
        c.r(x0, y - t + 1, x1, y, dk(m['tread'], f)); c.r(x0, y, x1, y, dk(m['nose'], f))
        if m.get('carpet'):
            cw = (x1 - x0) * 2 // 5; cx = (x0 + x1) // 2
            c.r(cx - cw // 2, y - t + 1, cx + cw // 2, y, dk(m['carpet'], f))
        c.r(x0, y - t, x1, y - t, dk(VOID, 1.0))
        y -= t + 1
    c.r(x0, ytop + 1, x1, max(ytop + 1, y), VOID)
    # rim (floor edge) around the well
    c.r(0, 0, w - 1, rim - 1, m['stringer']); c.r(0, 0, rim - 1, h - 1, m['stringer']); c.r(w - rim, 0, w - 1, h - 1, dk(m['stringer'], 0.85))
    c.r(0, 0, w - 1, 0, OL); c.r(0, 0, 0, h - 1, OL); c.r(w - 1, 0, w - 1, h - 1, OL)
    # guard rails: posts with 3/4 height, top rail offset upward; north rail is a front-facing balustrade
    ph = 4 if big else 3
    for px in (1, w - 3):
        for py in (rim + ph + 1, h // 2 + ph, h - 3):
            c.r(px, py - ph, px + 1, py, m['post']); c.p(px, py - ph, m['post_l'])
        c.r(px, rim + 1, px + 1, h - 3 - ph, m['rail']); c.r(px, rim + 1, px, h - 3 - ph, m['rail_l'])
    c.r(1, rim + 1, w - 2, rim + 1, m['rail_l']); c.r(1, rim + 2, w - 2, rim + 2, m['rail'])
    for bx in range(4, w - 4, 3 if big else 4): c.r(bx, rim + 3, bx, rim + 2 + ph, m['post'])
    c.r(1, rim + 3 + ph, w - 2, rim + 3 + ph, SH)
    return c.done()


# -- registered pieces ---------------------------------------------------------------------------------------------
def escalator_up(): return wall_flight(48, 48, 'steel', True, sign='up')
def escalator_down(): return wall_flight(48, 48, 'steel', False, sign='down')
def stone_pair_up(): return wall_flight(48, 48, 'stone', True, sign='up')
def stone_pair_down(): return wall_flight(48, 48, 'stone', False, sign='down')
def wall_wood_up(): return wall_flight(48, 48, 'wood', True)
def wall_stone_up(): return wall_flight(48, 48, 'stone', True)
def grand_up(): return wall_flight(48, 48, 'grand', True)
def mci_up(): return wall_flight(32, 32, 'stone', True, header=3, newel=False)
def mci_down(): return floor_well(32, 32, 'stone')
