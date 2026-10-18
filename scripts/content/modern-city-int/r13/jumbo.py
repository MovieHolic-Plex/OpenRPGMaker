# R13 jumbo centerpieces: 3x3 .. 6x4 tile signature objects that anchor the 21 daily-routine venues.
# 2026-10-18 23:54 user: 「대형 오브젝트들이 별로 없네 . 흠 .... 이건 좀 아쉽네.」
# Same harness as r10/lib.py: lighter TOP surface over a darker FRONT face, 1px ink outline, 1px floor shadow;
# tall parts (lamps, canopies, marquees, chalkboards) rise into passable overhang rows above the footprint.
import math
from lib import *

WATER, WATER_D, WATER_L = (96, 176, 214), (60, 128, 178), (178, 226, 244)
HOT, HOT_D = (120, 172, 196), (84, 130, 160)
HINOKI, HINOKI_D, HINOKI_L = (226, 194, 146), (184, 146, 96), (244, 222, 184)
MARBLE, MARBLE_D, MARBLE_V = (236, 234, 230), (196, 192, 188), (214, 208, 204)
STONE, STONE_D = (168, 164, 158), (126, 122, 118)
NEON_P, NEON_C = (255, 90, 200), (90, 240, 255)
CHALK, CHALK_D = (52, 98, 74), (36, 72, 54)
WALNUT, WALNUT_D, WALNUT_L = (112, 72, 44), (80, 50, 30), (148, 100, 64)
MAT, MAT_D, MAT_L = (60, 110, 190), (40, 76, 140), (100, 150, 220)
FRP, FRP_D, FRP_L = (176, 184, 190), (132, 140, 148), (210, 216, 220)
EMBER, EMBER_L = (230, 90, 30), (255, 190, 80)
SALMON = (244, 140, 100)
TEAL, TEAL_D = (64, 150, 160), (40, 104, 116)


def ap(c, x, y, col, a):
    """Translucent pixel (steam, light cones) - real alpha in the sprite."""
    if 0 <= x < c.W and 0 <= y < c.H: c.d.point((x, y), fill=(*col, a))


def clear(c, x0, y0, x1, y1, ellipse=False):
    (c.d.ellipse if ellipse else c.d.rectangle)((x0, y0, x1, y1), fill=(0, 0, 0, 0))


def steam(c, xs, y0, y1, a0=150):
    """Rising S-curve wisps that fade toward the top."""
    for i, x in enumerate(xs):
        for y in range(y1, y0 - 1, -1):
            t = (y1 - y) / max(1, y1 - y0)
            ox = round(math.sin(y * 0.45 + i * 1.7) * 1.6)
            ap(c, x + ox, y, (244, 248, 252), int(a0 * (1 - t)))
            if y % 3 == 0: ap(c, x + ox + 1, y, (244, 248, 252), int(a0 * 0.6 * (1 - t)))


def fish(c, x, y, n, col, belly=None):
    """Whole fish lying on ice, head to the left: dark back, body, pale belly line, eye, forked tail."""
    belly = belly or lt(col, 1.35)
    c.e(x, y, x + n, y + 3, dk(col, 0.6)); c.e(x, y, x + n - 1, y + 2, col)
    c.r(x + 2, y + 2, x + n - 2, y + 2, belly); c.r(x + 2, y, x + n - 3, y, lt(col, 1.2))
    c.p(x + 1, y + 1, BLACK); c.p(x + 1, y, WHITE)
    c.p(x + n + 1, y, dk(col, 0.7)); c.p(x + n + 1, y + 3, dk(col, 0.7)); c.p(x + n, y + 1, dk(col, 0.8)); c.p(x + n, y + 2, dk(col, 0.8))


def plank_face(c, x0, y0, x1, y1, col, step=6):
    c.r(x0, y0, x1, y1, col)
    for x in range(x0 + step, x1, step): c.r(x, y0, x, y1, dk(col, 0.82))
    c.r(x0, y0, x1, y0, lt(col, 1.12))


def ellipse_ring_pts(cx, cy, rx, ry, n):
    return [(round(cx + rx * math.cos(2 * math.pi * k / n)), round(cy + ry * math.sin(2 * math.pi * k / n))) for k in range(n)]


# ================================================================== hospital
def hosp_mri_gantry():
    """4x3 MRI suite: tall white gantry housing with a deep cylindrical bore (stepped inner rings, blue LED halo),
    control readout on the cowl, and a long cushioned patient couch sliding into the bore on a steel pedestal."""
    c = C(64, 64)
    c.r(3, 59, 62, 60, SH)
    # gantry housing (rounded cowl)
    c.rbox(1, 3, 41, 56, (222, 228, 234))
    c.r(2, 4, 40, 12, WHITE); c.r(3, 4, 39, 4, (252, 253, 254)); c.r(2, 13, 40, 13, WHITE_D)
    c.r(2, 14, 3, 54, WHITE); c.r(39, 14, 40, 54, (186, 194, 204)); c.r(2, 52, 40, 55, (176, 184, 196))
    c.r(2, 47, 40, 48, BLUE); c.r(2, 49, 40, 49, BLUE_D)
    c.box(28, 6, 38, 11, (24, 34, 46)); c.r(29, 8, 33, 8, SCREEN); c.r(29, 10, 31, 10, (90, 230, 120)); c.p(36, 8, (255, 180, 60))
    c.r(4, 6, 12, 6, WHITE_D); c.r(4, 8, 9, 8, WHITE_D)
    # bore: outer trim, LED halo, stepped depth rings
    c.oval(5, 15, 37, 46, (198, 206, 216))
    c.eo(7, 17, 35, 44, (120, 210, 250))
    c.e(9, 19, 33, 42, (92, 104, 124)); c.e(12, 22, 30, 39, (66, 76, 96)); c.e(15, 25, 27, 36, (44, 52, 70)); c.e(18, 28, 24, 33, (28, 34, 50))
    c.l(10, 24, 13, 20, (150, 160, 178)); c.p(9, 28, (150, 160, 178))
    # couch pedestal + couch sliding into the bore
    c.block(34, 43, 58, 57, 3, STEEL_L, STEEL)
    c.r(36, 50, 56, 50, STEEL_D)
    c.rbox(16, 31, 62, 44, STEEL_L); c.r(17, 41, 61, 43, STEEL)
    c.cushion(18, 31, 61, 39, (200, 228, 246), (150, 200, 232), (108, 160, 200))
    c.cushion(52, 31, 61, 38, WHITE, (236, 240, 244), WHITE_D)
    c.r(30, 32, 30, 38, (108, 160, 200)); c.r(42, 32, 42, 38, (108, 160, 200))
    c.r(60, 28, 61, 34, STEEL_D)
    return c.done()


def hosp_surgical_rig():
    """3x3 operating theatre core: articulated twin-head LED surgical lamp on a ceiling boom over a draped
    operating table (blue drape folds, head ring, arm boards), instrument field and the column base."""
    c = C(48, 64)
    c.r(3, 60, 45, 61, SH)
    # ceiling boom + two articulated lamp heads (overhang)
    c.r(22, 0, 25, 3, STEEL_D); c.oval(19, 2, 28, 7, STEEL)
    c.l(23, 5, 9, 11, STEEL_D); c.l(24, 5, 10, 11, STEEL_L); c.l(24, 5, 37, 13, STEEL_D); c.l(25, 5, 38, 13, STEEL_L)
    for cx, cy in ((10, 15), (37, 17)):
        c.oval(cx - 9, cy - 5, cx + 9, cy + 5, (226, 232, 238))
        c.e(cx - 7, cy - 3, cx + 7, cy + 3, (200, 226, 246))
        for ox, oy in ((-4, -1), (0, -2), (4, -1), (-2, 1), (2, 1)): c.oval(cx + ox - 1, cy + oy - 1, cx + ox + 1, cy + oy + 1, (255, 252, 224), (170, 190, 210))
        c.p(cx, cy, WHITE)
    for y in range(22, 34):
        for x in range(10, 38):
            if (x + y) % 5 == 0: ap(c, x, y, (255, 250, 220), 70)
    # table column + base
    c.block(17, 46, 30, 58, 2, STEEL_L, STEEL)
    c.r(19, 52, 28, 52, STEEL_D)
    # table top with draped patient
    c.rbox(3, 28, 44, 47, (196, 204, 214)); c.r(4, 44, 43, 46, STEEL_D)
    c.r(4, 29, 43, 42, (84, 150, 178)); c.r(4, 29, 43, 29, (130, 190, 214))
    for x in (12, 20, 28, 36): c.l(x, 31, x - 2, 42, (60, 120, 150))
    c.r(4, 43, 43, 43, (60, 120, 150))
    c.oval(5, 31, 12, 38, (226, 230, 236)); c.oval(7, 32, 11, 37, SKIN)
    c.r(13, 29, 14, 42, (60, 200, 140))
    c.r(26, 33, 30, 36, (226, 210, 196)); c.r(26, 33, 30, 33, (246, 232, 220))
    c.box(0, 34, 4, 37, (196, 204, 214)); c.box(43, 34, 47, 37, (196, 204, 214))
    for x in (33, 35, 37, 39): c.r(x, 37, x, 40, STEEL_L); c.p(x, 36, WHITE)
    return c.done()


def hosp_nurse_command():
    """5x3 central nurse station: curved command desk (arc counter with a raised walnut transaction ledge),
    twin monitors, chart racks, phone, call-light board, and a hanging NURSE STATION sign."""
    c = C(80, 64)
    # hanging sign (overhang)
    c.r(22, 0, 22, 3, STEEL_D); c.r(57, 0, 57, 3, STEEL_D)
    c.box(14, 3, 65, 11, (40, 120, 140)); c.r(15, 4, 64, 4, (90, 170, 186))
    for i, x in enumerate(range(19, 61, 4)): c.r(x, 6, x + 2, 8, WHITE) if i % 3 != 2 else c.r(x, 7, x + 2, 7, WHITE)
    c.r(16, 6, 17, 8, (255, 120, 120)); c.r(15, 7, 18, 7, (255, 120, 120))
    # arc desk: outer shell, front face, inner cut-out (nurses' side, open north)
    c.r(4, 61, 76, 62, SH)
    c.oval(0, 20, 79, 60, (150, 196, 200))
    c.oval(0, 14, 79, 54, WHITE)
    c.e(2, 16, 77, 52, (240, 244, 246))
    c.e(5, 19, 74, 49, WALNUT); c.e(6, 20, 73, 48, WALNUT_L); c.e(7, 22, 72, 47, WALNUT)
    c.e(12, 24, 67, 44, (240, 244, 246))
    clear(c, 14, 14, 65, 40, ellipse=True)
    clear(c, 16, 14, 63, 27)
    c.e(14, 12, 65, 38, OL); c.e(15, 12, 64, 37, (210, 214, 220))
    clear(c, 16, 12, 63, 30)
    # inner work surface reads through the opening
    c.r(18, 18, 61, 30, (226, 230, 236)); c.r(18, 18, 61, 18, WHITE)
    for x, col in ((22, SCREEN), (40, (90, 200, 140)), (52, SCREEN)):
        c.box(x, 12, x + 8, 19, (30, 38, 48)); c.r(x + 1, 13, x + 7, 17, col); c.r(x + 1, 13, x + 7, 13, lt(col, 1.3)); c.r(x + 3, 20, x + 5, 21, STEEL_D)
    c.box(33, 22, 37, 25, BLACK); c.p(34, 23, (90, 230, 120))
    # face bands + call-light board + chart racks
    c.r(6, 52, 73, 53, (110, 160, 166))
    for x in range(10, 70, 6): c.r(x, 54, x, 57, (120, 174, 180))
    c.box(33, 46, 46, 51, (24, 34, 46))
    for i, x in enumerate(range(35, 45, 2)): c.p(x, 48, [(255, 80, 60), (90, 230, 120), (255, 200, 60)][i % 3]); c.p(x, 50, (90, 230, 120))
    for x0 in (8, 60):
        c.box(x0, 40, x0 + 10, 47, (140, 150, 160))
        for k in range(4): c.r(x0 + 1 + k * 2, 41, x0 + 2 + k * 2, 46, [BLUE, RED, YELLOW, GREEN][k])
    for x in (24, 30): c.r(x, 28, x + 3, 29, WHITE); c.r(x, 30, x + 3, 30, WHITE_D)
    return c.done()


# ================================================================== sento
def sento_grand_bath():
    """6x4 tiled public hot bath (온탕 + 열탕): hinoki rim with grain and plank face, blue mosaic tile under the water,
    submerged step seat, wooden spout pouring into the bath, a slat divider to the hotter tub, and steam."""
    c = C(96, 80)
    c.r(2, 78, 94, 79, SH)
    c.rbox(0, 12, 95, 77, HINOKI_D)
    c.r(1, 13, 94, 19, HINOKI); c.r(2, 13, 93, 13, HINOKI_L)
    c.r(1, 20, 6, 66, HINOKI); c.r(89, 20, 94, 66, HINOKI); c.r(1, 20, 1, 66, HINOKI_L)
    c.r(1, 62, 94, 67, HINOKI); c.r(1, 62, 94, 62, HINOKI_L)
    for x in range(8, 92, 9): c.r(x, 14, x + 3, 14, HINOKI_D); c.p(x + 5, 17, HINOKI_D)
    for y in range(24, 62, 7): c.r(3, y, 4, y, HINOKI_D); c.r(91, y, 92, y, HINOKI_D)
    plank_face(c, 1, 68, 94, 76, (170, 128, 80), 8)
    c.r(1, 76, 94, 76, (130, 94, 56))
    # water: warm bath (west) and hot bath (east)
    c.r(7, 20, 66, 61, WATER); c.r(71, 20, 88, 61, HOT)
    for x0, x1, col in ((7, 66, WATER), (71, 88, HOT)):
        for x in range(x0, x1 + 1, 6): c.r(x, 20, x, 61, dk(col, 0.92))
        for y in range(23, 62, 6): c.r(x0, y, x1, y, dk(col, 0.92))
        c.r(x0, 20, x1, 22, dk(col, 0.78)); c.r(x0, 23, x1, 23, dk(col, 0.88))
    c.r(8, 52, 30, 61, (130, 200, 228)); c.r(8, 52, 30, 52, WATER_L)
    for x in range(8, 31, 6): c.r(x, 53, x, 61, (110, 186, 218))
    for (x, y) in ((16, 30), (40, 36), (54, 28), (28, 44), (48, 50), (76, 34), (82, 48)):
        c.r(x, y, x + 3, y, WATER_L); c.p(x + 4, y + 1, WATER_L); c.p(x - 1, y + 1, WATER_L)
    # slat divider between baths
    c.r(67, 14, 70, 66, HINOKI); c.r(67, 14, 67, 66, HINOKI_L); c.r(70, 14, 70, 66, HINOKI_D)
    for y in range(22, 62, 5): c.r(67, y, 70, y, HINOKI_D)
    c.box(72, 4, 87, 12, (250, 246, 236)); c.r(75, 6, 77, 9, RED); c.r(80, 6, 84, 7, RED); c.r(80, 9, 84, 10, RED)
    # wooden spout pouring into the warm bath
    c.box(34, 6, 43, 16, HINOKI_D); c.r(35, 7, 42, 9, HINOKI_L); c.r(37, 14, 40, 20, HINOKI_D)
    c.r(38, 21, 39, 30, WATER_L); c.p(37, 30, WHITE); c.p(40, 30, WHITE)
    c.eo(31, 28, 46, 34, WATER_L)
    # stacked wooden pails on the rim
    for x in (8, 15):
        c.oval(x, 9, x + 6, 15, (196, 156, 100)); c.e(x + 1, 10, x + 5, 12, HINOKI_L); c.r(x, 13, x + 6, 13, STEEL_D)
    steam(c, [14, 26, 48, 58, 76, 84], 0, 30, 120)
    return c.done()


def sento_mural_grand():
    """6x2 bathhouse tile mural: Mt. Fuji over a pine shore and curling Hokusai waves, painted across a tile grid."""
    c = C(96, 32)
    c.box(0, 0, 95, 31, (60, 96, 140))
    sky = [(150, 200, 236), (168, 212, 240), (188, 224, 244), (208, 234, 248)]
    for i, col in enumerate(sky): c.r(1, 1 + i * 4, 94, 4 + i * 4, col)
    c.oval(70, 3, 79, 12, (240, 120, 90), (220, 90, 70))
    for x0, y0 in ((8, 5), (52, 3)): c.r(x0, y0, x0 + 14, y0 + 2, WHITE); c.r(x0 + 3, y0 - 1, x0 + 10, y0 - 1, WHITE)
    for y in range(6, 25):
        hw = (y - 6) * 2 + 3
        c.r(47 - hw, y, 47 + hw, y, (70, 110, 170))
        c.r(47 - hw, y, 47 - hw + max(1, hw // 3), y, (96, 140, 196))
    for y in range(6, 12):
        hw = (y - 6) * 2 + 3
        c.r(47 - hw, y, 47 + hw, y, WHITE)
    for x in range(36, 60, 4): c.r(x, 12, x + 1, 13, WHITE)
    c.r(1, 21, 94, 30, (40, 90, 160))
    for x0 in range(-4, 96, 16):
        for k, (dx, dy) in enumerate(((0, 4), (1, 3), (2, 2), (4, 1), (6, 1), (8, 2), (9, 3), (8, 4))):
            x, y = x0 + dx, 20 + dy
            if 1 <= x <= 94: c.p(x, y, WHITE); c.p(x, y + 1, (130, 180, 230))
        for x in range(max(1, x0), min(95, x0 + 14)): c.p(x, 27, (90, 150, 210))
    c.r(1, 20, 18, 30, (90, 80, 60)); c.r(1, 20, 18, 20, (120, 110, 80))
    c.l(6, 20, 9, 9, (90, 60, 40)); c.l(7, 20, 10, 9, (110, 74, 48))
    for x0, y0 in ((2, 9), (8, 6), (12, 11)): c.e(x0, y0, x0 + 9, y0 + 4, (40, 104, 62)); c.r(x0 + 2, y0, x0 + 6, y0, (70, 140, 84))
    for x in range(16, 95, 16):
        for y in range(1, 31):
            r, g, b, a = c.im.getpixel((x, y)); c.p(x, y, dk((r, g, b), 0.86))
    for y in (11, 21):
        for x in range(1, 95):
            r, g, b, a = c.im.getpixel((x, y)); c.p(x, y, dk((r, g, b), 0.9))
    return c.done()


# ================================================================== department store
def dept_perfume_rotunda():
    """4x4 grand cosmetics rotunda: round marble counter ring with a pink lacquer face and gold trim, tester trays
    and perfume flacons all around, a staff well, and a central lit glass perfume tower crowned in gold."""
    c = C(64, 80)
    c.r(4, 76, 60, 77, SH)
    c.oval(1, 32, 62, 75, PINK_D)
    for x in range(6, 60, 5): c.r(x, 62, x, 72, dk(PINK_D, 0.86))
    c.oval(1, 28, 62, 66, GOLD_D)
    c.oval(2, 29, 61, 65, MARBLE); c.e(4, 31, 59, 62, MARBLE)
    c.e(8, 30, 30, 36, (250, 250, 248))
    c.oval(15, 38, 48, 56, OL); c.e(16, 39, 47, 55, (214, 196, 206)); c.r(16, 52, 47, 55, (196, 176, 188))
    # tower
    c.r(25, 50, 38, 52, SH)
    c.rbox(24, 8, 39, 51, GOLD_D)
    c.r(25, 9, 38, 50, (250, 236, 240)); c.r(25, 9, 26, 50, WHITE); c.r(37, 9, 38, 50, (220, 196, 204))
    for k, y in enumerate((14, 24, 34, 44)):
        c.r(25, y + 5, 38, y + 5, GOLD); c.r(25, y + 6, 38, y + 6, GOLD_D)
        for j, x in enumerate(range(27, 37, 3)):
            col = [(240, 150, 180), (180, 140, 220), (250, 200, 120), (140, 200, 230)][(j + k) % 4]
            c.r(x, y + 1, x + 1, y + 4, col); c.p(x, y + 1, WHITE); c.p(x, y, GOLD)
    c.oval(21, 2, 42, 11, GOLD); c.e(23, 3, 40, 7, (252, 230, 150)); c.r(30, 0, 33, 3, GOLD_D); c.p(31, 0, WHITE)
    # flacons + tester trays around the ring
    for i, (x, y) in enumerate(ellipse_ring_pts(31, 46, 25, 13, 14)):
        if 20 < x < 42 and y < 42: continue
        col = [(240, 150, 180), (180, 140, 220), (250, 200, 120), (140, 200, 230), RED][i % 5]
        if i % 3 == 0:
            c.box(x - 2, y - 1, x + 2, y + 1, WHITE)
            c.p(x - 1, y, RED); c.p(x, y, PINK); c.p(x + 1, y, (200, 150, 110))
        else:
            c.r(x, y - 3, x + 1, y, col); c.p(x, y - 3, WHITE); c.p(x, y - 4, GOLD)
    c.box(26, 66, 37, 71, GOLD); c.r(28, 68, 35, 69, (250, 236, 240))
    return c.done()


def dept_fountain_grand():
    """3x3 atrium fountain: octagonal-feel marble basin with rippled water, a two-tier stone bowl column and
    arcing jets falling back into the basin; coins glint on the floor of the pool."""
    c = C(48, 64)
    c.r(3, 61, 45, 62, SH)
    c.oval(1, 36, 46, 60, STONE_D); c.r(4, 50, 43, 56, STONE)
    for x in range(8, 42, 6): c.r(x, 52, x, 57, STONE_D)
    c.oval(1, 30, 46, 56, MARBLE); c.e(2, 31, 45, 55, MARBLE_V)
    c.e(5, 33, 42, 52, WATER_D); c.e(6, 34, 41, 51, WATER)
    for r in (6, 11, 15):
        c.eo(24 - r, 42 - r // 2, 23 + r, 43 + r // 2, WATER_L)
    for x, y in ((12, 46), (32, 47), (18, 49)): c.p(x, y, GOLD)
    c.r(20, 18, 27, 44, STONE); c.r(20, 18, 21, 44, MARBLE); c.r(26, 18, 27, 44, STONE_D); c.box(19, 40, 28, 45, STONE)
    c.oval(11, 20, 36, 30, STONE_D); c.oval(11, 18, 36, 27, MARBLE); c.e(14, 20, 33, 25, WATER)
    c.r(22, 6, 25, 19, STONE); c.oval(18, 8, 29, 13, MARBLE); c.e(20, 9, 27, 11, WATER)
    c.oval(21, 1, 26, 6, GOLD); c.p(22, 2, WHITE)
    for sgn in (-1, 1):
        for t in range(0, 15):
            x = 24 + sgn * (4 + t); y = 12 + (t * t) // 8
            ap(c, x, y, WATER_L, 230); ap(c, x, y + 1, (226, 244, 250), 140)
        for t in range(0, 12):
            x = 24 + sgn * (12 + t); y = 24 + (t * t) // 6
            if y < 46: ap(c, x, y, WATER_L, 220)
    for x in (9, 38, 23): c.p(x, 42, WHITE); c.p(x + 1, 43, WHITE)
    return c.done()


# ================================================================== supermarket
def mart_seafood_island():
    """5x3 fresh-fish island: stainless counter with a curved sneeze-guard glass hood, crushed-ice bed of whole
    fish (mackerel, sea bream, salmon), salmon steaks, red crab, clams and an octopus; red banner sign and
    blue LED kick strip; two pendant lamps."""
    c = C(80, 64)
    c.r(3, 61, 77, 62, SH)
    for x in (20, 60):
        c.r(x, 0, x, 5, STEEL_D); c.oval(x - 5, 5, x + 5, 10, (60, 70, 80)); c.r(x - 3, 10, x + 3, 10, (255, 236, 170))
    c.rbox(1, 18, 78, 59, STEEL_D)
    c.r(2, 19, 77, 42, ICE); c.dither(2, 19, 77, 42, WHITE, 0); c.dither(2, 20, 77, 42, ICE_D, 1)
    c.r(2, 19, 77, 19, STEEL_L); c.r(2, 41, 77, 42, ICE_D)
    for i, (x, y) in enumerate(((5, 22), (15, 21), (25, 23), (5, 29), (16, 30))):
        fish(c, x, y, 8, [(84, 110, 150), (230, 120, 110), (84, 110, 150), (230, 120, 110), (130, 140, 160)][i])
    for x in range(34, 46, 4):
        for y in (22, 28):
            c.oval(x, y, x + 4, y + 4, SALMON, (190, 90, 60)); c.l(x + 1, y + 1, x + 3, y + 3, WHITE)
    c.oval(48, 22, 60, 31, (200, 60, 50), (140, 30, 30)); c.e(51, 24, 57, 28, (236, 100, 80))
    for dx, dy in ((-2, 0), (-1, 4), (13, 1), (14, 5), (2, -1), (10, -1)): c.p(48 + dx + (1 if dx > 6 else 0), 25 + dy, (180, 40, 40))
    for x in range(62, 76, 4):
        for y in (22, 27, 32): c.oval(x, y, x + 3, y + 3, (110, 100, 96)); c.p(x + 1, y + 1, (200, 190, 180))
    c.oval(30, 33, 42, 40, (190, 110, 140)); c.r(32, 34, 40, 34, (230, 160, 180))
    for k in range(5): c.l(31 + k * 2, 39, 29 + k * 3, 41, (170, 90, 120))
    for x in range(48, 60, 3): c.r(x, 35, x + 1, 39, (240, 236, 230)); c.p(x, 35, GREEN)
    # curved glass hood
    c.r(2, 10, 77, 11, STEEL_L); c.r(2, 12, 77, 12, STEEL_D)
    for y in range(13, 22):
        a = 120 - (y - 13) * 10
        for x in range(2, 78): ap(c, x, y, GLASS_L, a)
    c.l(6, 20, 14, 12, WHITE); c.l(9, 20, 16, 13, GLASS_L); c.l(50, 20, 58, 12, WHITE)
    for x in (2, 77): c.r(x, 10, x, 22, STEEL)
    # front face
    c.r(2, 43, 77, 44, STEEL_L); c.r(2, 45, 77, 56, STEEL)
    for x in range(10, 76, 12): c.r(x, 45, x, 55, STEEL_D)
    c.box(28, 46, 51, 53, RED); c.r(29, 47, 50, 47, RED_L)
    for x in range(31, 49, 4): c.r(x, 49, x + 2, 51, WHITE)
    for x in (4, 13, 22, 54, 63):
        c.box(x, 47, x + 4, 50, YELLOW)
    c.r(2, 57, 77, 58, (60, 140, 240)); c.r(2, 57, 77, 57, (120, 190, 255))
    return c.done()


def mart_promo_pyramid():
    """3x3 promotional island: three-tier round wooden stage stacked with a can pyramid and boxed packs,
    a red SALE starburst sign on a chrome pole."""
    c = C(48, 64)
    c.r(3, 61, 45, 62, SH)
    for k, (x0, y0, x1, y1) in enumerate(((1, 40, 46, 60), (6, 32, 41, 50), (11, 25, 36, 42))):
        c.oval(x0, y0 + 4, x1, y1, WOOD_D); c.oval(x0, y0, x1, y1 - 4, WOOD)
        c.e(x0 + 2, y0 + 1, x1 - 2, y0 + 4, WOOD_L)
    for i, (x, y) in enumerate(ellipse_ring_pts(24, 50, 19, 6, 12)):
        if y < 49: continue
        c.can(x - 1, y - 3, [RED, (60, 140, 220), YELLOW, GREEN][i % 4])
    for i, (x, y) in enumerate(ellipse_ring_pts(24, 41, 14, 5, 10)):
        if y < 40: continue
        c.pack(x - 2, y - 4, 4, 5, [(240, 150, 50), (150, 92, 190), (60, 140, 84)][i % 3])
    for row, n in enumerate((5, 4, 3, 2, 1)):
        y = 34 - row * 4; x0 = 24 - n * 2
        for k in range(n): c.can(x0 + k * 4, y, RED if (row + k) % 2 == 0 else (240, 240, 240))
    c.r(36, 4, 36, 30, STEEL_L); c.r(37, 4, 37, 30, STEEL_D)
    pts = ellipse_ring_pts(37, 9, 10, 8, 16)
    for i in range(16):
        x, y = pts[i]; r = 10 if i % 2 == 0 else 7
        c.l(37, 9, 37 + round((x - 37) * r / 10), 9 + round((y - 9) * r / 10), RED)
    c.e(29, 3, 45, 15, RED); c.e(30, 4, 44, 14, (236, 60, 60))
    c.r(32, 7, 42, 7, WHITE); c.r(33, 9, 41, 10, YELLOW); c.r(32, 12, 42, 12, WHITE)
    return c.done()


# ================================================================== game center
def arcade_dance_stage():
    """4x3 twin rhythm-dance cabinet: tall black cabinet with two widescreens, stacked speakers, a pink/cyan neon
    marquee; in front a raised steel stage with two lit 4-arrow pads and a chrome safety bar."""
    c = C(64, 80)
    c.r(2, 77, 62, 78, SH)
    c.rbox(2, 0, 61, 12, (40, 30, 60)); c.r(4, 2, 59, 10, (24, 16, 40))
    for x in range(6, 58, 2): ap(c, x, 3, NEON_P, 255) if x < 32 else ap(c, x, 3, NEON_C, 255)
    for x in range(8, 56, 6): c.r(x, 5, x + 3, 8, [NEON_P, YELLOW, NEON_C][x // 6 % 3])
    c.r(4, 10, 59, 10, NEON_P)
    c.rbox(4, 12, 59, 44, (34, 36, 48)); c.r(5, 13, 58, 14, (60, 62, 80))
    for x0, col in ((7, NEON_P), (34, NEON_C)):
        c.box(x0, 16, x0 + 22, 31, BLACK); c.r(x0 + 1, 17, x0 + 21, 30, (30, 20, 70))
        for k in range(4): c.r(x0 + 3 + k * 5, 18, x0 + 5 + k * 5, 19, WHITE_D)
        for k, (dx, dy) in enumerate(((3, 24), (8, 27), (13, 22), (18, 26))): c.r(x0 + dx, dy, x0 + dx + 2, dy + 1, [NEON_P, NEON_C, YELLOW, GREEN_L][k])
        c.r(x0 + 1, 30, x0 + 21, 30, col)
    for x0 in (4, 53):
        c.box(x0, 32, x0 + 6, 43, (20, 20, 28)); c.oval(x0 + 1, 33, x0 + 5, 37, (70, 70, 84)); c.oval(x0 + 1, 38, x0 + 5, 42, (70, 70, 84))
    c.box(18, 34, 45, 42, (50, 52, 66)); c.r(20, 36, 43, 36, NEON_C); c.r(20, 39, 43, 39, NEON_P)
    # safety bar
    c.r(3, 46, 4, 66, STEEL_D); c.r(59, 46, 60, 66, STEEL_D); c.r(3, 46, 60, 47, STEEL_L); c.r(31, 47, 32, 66, STEEL_D)
    # stage + pads
    c.block(1, 50, 62, 75, 18, (120, 126, 140), (70, 74, 88))
    for x0 in (5, 35):
        c.box(x0, 52, x0 + 22, 68, (52, 54, 66))
        for gx in range(3):
            for gy in range(3):
                bx, by = x0 + 1 + gx * 7, 53 + gy * 5
                arrow = (gx, gy) in ((1, 0), (0, 1), (2, 1), (1, 2))
                col = [(255, 80, 120), (80, 160, 255), (80, 160, 255), (255, 80, 120)][((1, 0), (0, 1), (2, 1), (1, 2)).index((gx, gy))] if arrow else (86, 90, 104)
                c.box(bx, by, bx + 6, by + 4, col)
                if arrow: c.p(bx + 3, by + 2, WHITE); c.r(bx + 2, by + 1, bx + 4, by + 1, lt(col, 1.3))
    return c.done()


def arcade_airhockey():
    """4x3 four-player air hockey: white air-hole field with blue lines and centre circle, red bumper rails,
    a goal slot on every side, puck and four mallets, LED score columns at the corners."""
    c = C(64, 64)
    c.r(3, 61, 61, 62, SH)
    c.r(8, 0, 9, 10, STEEL_D); c.r(54, 0, 55, 10, STEEL_D)
    c.box(6, 2, 57, 11, BLACK); c.r(7, 3, 56, 3, (60, 60, 70))
    for x, col in ((11, (255, 80, 60)), (24, (90, 230, 120)), (37, (80, 160, 255)), (50, YELLOW)): c.r(x, 5, x + 3, 9, col); c.r(x + 1, 6, x + 2, 8, BLACK)
    c.rbox(1, 14, 62, 58, RED_D)
    c.r(2, 46, 61, 56, (60, 60, 80)); c.r(2, 46, 61, 46, (90, 90, 110))
    for x in range(6, 60, 8): c.r(x, 48, x + 3, 54, (40, 40, 56))
    c.rbox(3, 15, 60, 46, RED); c.r(4, 15, 59, 15, RED_L)
    c.r(6, 18, 57, 43, (238, 244, 250))
    for y in range(20, 43, 3):
        for x in range(8 + (y % 2), 57, 4): c.p(x, y, (200, 210, 224))
    c.r(6, 30, 57, 30, (80, 140, 230)); c.r(31, 18, 32, 43, (80, 140, 230))
    c.eo(24, 24, 39, 37, (80, 140, 230))
    c.r(23, 18, 40, 19, BLACK); c.r(23, 42, 40, 43, BLACK); c.r(6, 26, 7, 35, BLACK); c.r(56, 26, 57, 35, BLACK)
    for x, y, col in ((14, 22, BLUE), (48, 22, (90, 200, 120)), (14, 37, YELLOW), (48, 37, (255, 120, 60))):
        c.oval(x - 3, y - 3, x + 3, y + 3, col); c.oval(x - 1, y - 2, x + 1, y, lt(col, 1.3))
    c.oval(34, 27, 38, 30, BLACK); c.p(35, 27, (120, 120, 140))
    for x in (2, 60): c.r(x, 16, x + 1, 44, RED_L)
    return c.done()


def arcade_racing_twin():
    """4x2 twin racing simulator: two curved 3-screen cockpits under a shared chequered RACE marquee, red bucket seats,
    steering wheels and pedal boxes, linked by a centre coin/start pod."""
    c = C(64, 64)
    c.r(2, 61, 62, 62, SH)
    c.rbox(2, 0, 61, 9, BLACK)
    for x in range(4, 60, 4):
        for y in (2, 5): c.r(x, y, x + 1, y + 1, WHITE if (x // 4 + y // 3) % 2 == 0 else (60, 60, 70))
    c.box(22, 1, 41, 8, RED); c.r(25, 3, 38, 6, YELLOW); c.r(26, 4, 37, 5, RED_D)
    for x0 in (2, 33):
        c.rbox(x0, 10, x0 + 28, 34, (44, 46, 60)); c.r(x0 + 1, 11, x0 + 27, 12, (70, 72, 90))
        c.box(x0 + 2, 13, x0 + 9, 25, BLACK); c.box(x0 + 9, 12, x0 + 19, 26, BLACK); c.box(x0 + 19, 13, x0 + 26, 25, BLACK)
        for sx0, sx1 in ((x0 + 3, x0 + 8), (x0 + 10, x0 + 18), (x0 + 20, x0 + 25)):
            c.r(sx0, 14, sx1, 18, (90, 160, 230)); c.r(sx0, 19, sx1, 24, (80, 80, 90))
        c.l(x0 + 14, 24, x0 + 12, 19, WHITE); c.l(x0 + 14, 24, x0 + 16, 19, WHITE)
        c.r(x0 + 10, 21, x0 + 18, 21, (200, 60, 60))
        c.rbox(x0 + 4, 28, x0 + 24, 36, (60, 62, 76))
        c.oval(x0 + 9, 28, x0 + 19, 35, (30, 30, 36)); c.e(x0 + 11, 30, x0 + 17, 33, (60, 62, 76)); c.r(x0 + 13, 31, x0 + 15, 32, (30, 30, 36))
        c.rbox(x0 + 3, 38, x0 + 25, 59, (40, 42, 54))
        c.cushion(x0 + 7, 38, x0 + 21, 52, RED_L, RED, RED_D); c.r(x0 + 9, 42, x0 + 19, 42, RED_D)
        c.r(x0 + 12, 38, x0 + 16, 39, (40, 40, 48))
        c.r(x0 + 4, 54, x0 + 24, 57, (60, 62, 76))
    c.box(29, 40, 34, 58, (70, 72, 90)); c.r(30, 42, 33, 44, YELLOW); c.oval(30, 47, 33, 50, (90, 230, 120))
    return c.done()


# ================================================================== food
def bakery_deck_oven():
    """4x2 stone-clad three-deck bakery oven against the wall: stainless hood with vent slots, three glass doors
    glowing with baking loaves, temperature dials, a brick plinth and a wooden peel leaning on the side."""
    c = C(64, 64)
    c.r(2, 61, 62, 62, SH)
    c.rbox(4, 0, 59, 10, STEEL); c.r(5, 1, 58, 2, STEEL_L); c.r(5, 9, 58, 9, STEEL_D)
    for x in range(9, 56, 5): c.r(x, 5, x + 2, 6, STEEL_D)
    c.r(29, 0, 34, 0, STEEL_D)
    c.rbox(2, 10, 61, 58, (150, 120, 100))
    for y in range(12, 58, 4):
        off = 0 if (y // 4) % 2 else 5
        for x in range(3 + off, 61, 10): c.r(x, y, x, y + 3, (120, 92, 76))
        c.r(3, y, 60, y, (176, 146, 124))
    for k, y in enumerate((14, 28, 42)):
        c.box(8, y, 47, y + 11, (60, 62, 70))
        c.r(10, y + 2, 45, y + 8, (90, 40, 20)); c.r(10, y + 2, 45, y + 3, EMBER)
        for x in range(12, 44, 8):
            c.oval(x, y + 4, x + 6, y + 8, (200, 130, 60), (140, 80, 30)); c.r(x + 2, y + 5, x + 4, y + 5, (240, 190, 110))
        ap(c, 12, y + 2, (255, 230, 160), 200); c.l(36, y + 8, 41, y + 3, (255, 210, 150))
        c.r(10, y + 10, 45, y + 10, STEEL_L)
        c.oval(50, y + 2, 56, y + 8, STEEL_L); c.p(53, y + 3, RED); c.p(53, y + 5, BLACK)
    c.r(3, 55, 60, 57, (120, 60, 50)); c.r(3, 55, 60, 55, (160, 90, 70))
    c.l(58, 22, 62, 58, WOOD_D); c.l(59, 22, 63, 58, WOOD); c.oval(56, 16, 63, 24, WOOD_L, WOOD_D)
    return c.done()


def izakaya_u_bar():
    """5x3 U-shaped yakitori counter: hinoki counter wrapping a charcoal grill pit (glowing binchotan, skewers,
    smoke), steel prep shelf with tare pot, and plates, sake, beer mugs set at the seats; smoke hood above."""
    c = C(80, 64)
    c.r(2, 61, 78, 62, SH)
    c.rbox(10, 0, 69, 9, STEEL); c.r(11, 1, 68, 2, STEEL_L); c.r(11, 8, 68, 8, STEEL_D)
    for x in (14, 66): c.oval(x - 3, 9, x + 3, 16, RED, RED_D); c.r(x - 2, 11, x + 2, 11, (250, 160, 120)); c.r(x - 1, 9, x + 1, 9, BLACK)
    # U counter: west arm, east arm, front bar
    for x0, x1 in ((1, 14), (65, 78)):
        c.rbox(x0, 14, x1, 58, (150, 104, 60)); c.r(x0 + 1, 15, x1 - 1, 46, HINOKI); c.r(x0 + 1, 15, x1 - 1, 15, HINOKI_L)
    c.rbox(1, 40, 78, 58, (150, 104, 60)); c.r(2, 41, 77, 48, HINOKI); c.r(2, 41, 77, 41, HINOKI_L)
    c.r(2, 49, 77, 49, HINOKI_D); plank_face(c, 2, 50, 77, 57, (130, 88, 50), 7)
    for x0, x1 in ((2, 13), (66, 77)): c.r(x0, 47, x1, 48, HINOKI)
    # grill pit
    c.box(16, 14, 63, 38, (90, 92, 100))
    c.r(17, 15, 62, 16, STEEL_L)
    c.box(20, 18, 59, 31, (30, 28, 30))
    c.dither(21, 19, 58, 30, EMBER, 0); c.dither(22, 20, 57, 29, EMBER_L, 1)
    for x in range(22, 58, 4):
        c.l(x, 17, x + 1, 32, (220, 200, 160)); c.r(x - 1, 22, x + 2, 24, (170, 90, 50)); c.r(x - 1, 26, x + 2, 27, (220, 160, 110))
    c.box(18, 33, 61, 38, STEEL_L); c.oval(22, 33, 29, 38, (60, 30, 20)); c.e(23, 34, 28, 36, (110, 50, 30))
    for x in (36, 44, 52): c.box(x, 34, x + 5, 37, WHITE); c.p(x + 2, 35, GREEN)
    steam(c, [24, 34, 46, 56], 6, 20, 140)
    # seat settings
    for x in range(6, 76, 10):
        c.oval(x, 42, x + 6, 46, WHITE, (170, 170, 176)); c.r(x + 2, 43, x + 4, 44, (190, 120, 70))
        if x % 20 == 6: c.r(x + 7, 41, x + 9, 45, (250, 210, 90)); c.r(x + 7, 41, x + 9, 41, WHITE)
        else: c.r(x + 7, 42, x + 8, 45, (236, 236, 230)); c.p(x + 7, 41, (60, 90, 160))
    for y in (20, 30):
        c.oval(4, y, 10, y + 4, WHITE, (170, 170, 176)); c.oval(69, y, 75, y + 4, WHITE, (170, 170, 176))
        c.r(6, y + 1, 8, y + 2, (190, 120, 70)); c.r(71, y + 1, 73, y + 2, (190, 120, 70))
    return c.done()


def rest_banquet_round():
    """3x3 round banquet table: white tablecloth draping to the floor with folds, glass lazy susan with shared
    dishes, eight place settings (plate, napkin, glass) and a tall flower centrepiece."""
    c = C(48, 64)
    c.r(3, 61, 45, 62, SH)
    c.oval(1, 28, 46, 60, (210, 212, 220))
    for x in range(6, 44, 6): c.l(x, 50, x + (1 if x > 24 else -1), 58, (180, 182, 194))
    c.oval(1, 22, 46, 52, WHITE); c.e(3, 24, 44, 49, (248, 248, 250))
    c.oval(12, 29, 35, 45, (190, 210, 220)); c.e(14, 31, 33, 43, (220, 236, 242))
    for x, y, col in ((16, 35, (220, 140, 60)), (25, 32, (200, 70, 60)), (27, 39, GREEN)):
        c.oval(x - 3, y - 2, x + 3, y + 2, WHITE, (170, 170, 176)); c.e(x - 2, y - 1, x + 2, y + 1, col)
    for i, (x, y) in enumerate(ellipse_ring_pts(24, 37, 18, 11, 8)):
        c.oval(x - 3, y - 2, x + 3, y + 2, WHITE, (180, 182, 194)); c.p(x, y, (230, 230, 236))
        c.p(x + 4, y - 2, GLASS_L); c.p(x + 4, y - 1, GLASS)
    c.r(22, 14, 25, 32, (120, 170, 200)); c.r(22, 14, 22, 32, GLASS_L)
    for x, y, col in ((18, 8, PINK), (24, 5, WHITE), (30, 9, (240, 200, 80)), (21, 12, RED_L), (28, 13, PINK)):
        c.l(24, 15, x, y, LEAF_D); c.oval(x - 2, y - 2, x + 2, y + 2, col, dk(col, 0.7)); c.p(x - 1, y - 1, WHITE)
    for x, y in ((16, 14), (32, 15)): c.e(x - 2, y - 1, x + 2, y + 1, LEAF)
    return c.done()


# ================================================================== campus / office
def school_stage_board():
    """6x2 lecture stage: panoramic 3-panel green chalkboard in an oak frame (chalk diagram, notes, date column)
    over a raised oak stage with a front step nosing and a central lectern."""
    c = C(96, 64)
    c.box(1, 0, 94, 26, WOOD_D)
    c.r(2, 1, 93, 1, WOOD_L)
    for x0, x1 in ((3, 30), (32, 63), (65, 92)):
        c.r(x0, 3, x1, 23, CHALK); c.r(x0, 3, x1, 3, CHALK_D)
    c.r(31, 2, 31, 24, WOOD_D); c.r(64, 2, 64, 24, WOOD_D)
    for k, y in enumerate(range(6, 22, 3)): c.r(5, y, 5 + 10 + (k * 5) % 13, y, (230, 236, 230))
    c.r(5, 6, 6, 6, YELLOW)
    c.eo(38, 6, 56, 20, (230, 236, 230)); c.l(47, 6, 47, 20, (230, 236, 230)); c.l(38, 13, 56, 13, (230, 236, 230))
    c.l(40, 18, 54, 8, (240, 200, 90)); c.p(51, 10, (240, 120, 120))
    for y in range(6, 22, 4): c.r(68, y, 72, y, (230, 236, 230)); c.r(75, y, 75 + (y % 7) + 4, y, (200, 220, 240))
    c.r(2, 24, 93, 25, WOOD); c.r(2, 24, 93, 24, WOOD_L)
    for x, col in ((10, WHITE), (13, YELLOW), (16, (240, 120, 140)), (80, WHITE), (84, (120, 180, 240))): c.r(x, 23, x + 1, 23, col)
    c.box(44, 23, 51, 25, (60, 62, 70))
    c.r(1, 27, 94, 28, SH)
    c.block(0, 30, 95, 61, 22, (206, 166, 104), (150, 108, 52))
    for x in range(8, 95, 12): c.r(x, 31, x, 52, (190, 150, 92))
    c.r(1, 53, 94, 54, (230, 196, 140))
    c.rbox(40, 34, 55, 52, WOOD_D); c.r(41, 35, 54, 38, WOOD_L); c.r(41, 39, 54, 51, WOOD); c.box(44, 42, 51, 47, GOLD_D)
    c.r(46, 31, 46, 35, BLACK); c.p(46, 30, (90, 90, 100))
    c.r(42, 35, 47, 37, WHITE)
    return c.done()


def _oval_table(c, x0, y0, x1, y1, top, top_l, face, inlay):
    c.oval(x0, y0 + 6, x1, y1, dk(face, 0.85))
    c.oval(x0, y0, x1, y1 - 6, face)
    c.oval(x0, y0, x1, y1 - 8, top)
    c.e(x0 + 3, y0 + 2, x1 - 3, y0 + 8, top_l)
    w = (x1 - x0); h = (y1 - 8 - y0)
    c.oval(x0 + w // 5, y0 + h // 3, x1 - w // 5, y1 - 8 - h // 3, inlay)


def council_oval_table():
    """5x3 student-council oval table: light oak top with a green leather inlay, name plates, document stacks,
    gooseneck mics, water bottles and an open laptop; deep apron with a pedestal base."""
    c = C(80, 64)
    c.r(4, 61, 76, 62, SH)
    c.r(20, 50, 59, 58, WOOD_D); c.r(20, 50, 59, 50, WOOD)
    _oval_table(c, 1, 18, 78, 58, WOOD_L, (236, 212, 170), WOOD, (60, 120, 84))
    c.r(18, 34, 61, 34, (90, 150, 110))
    for x in range(10, 74, 12):
        for y, flip in ((24, 0), (42, 1)):
            c.r(x, y, x + 5, y + 2, WHITE); c.r(x, y + 3, x + 5, y + 3, WHITE_D); c.p(x + 1, y + 1, BLACK)
    for x in (20, 44, 62): c.r(x, 22, x + 3, 25, (150, 200, 230)); c.p(x + 1, 21, (60, 120, 200))
    for x in (30, 52): c.l(x, 44, x + 2, 39, BLACK); c.p(x + 2, 38, (90, 90, 100)); c.r(x - 1, 44, x + 1, 45, (40, 40, 48))
    c.box(36, 37, 45, 43, (60, 62, 70)); c.r(37, 37, 44, 39, SCREEN)
    c.box(14, 36, 21, 40, (196, 160, 90)); c.r(15, 37, 20, 37, WHITE)
    return c.done()


def office_boardroom_table():
    """5x3 executive boardroom table: racetrack dark walnut top with a smoked glass centre, conference speaker
    phone, laptops, leather portfolios and coffee cups; brushed-steel plinth."""
    c = C(80, 64)
    c.r(3, 61, 77, 62, SH)
    c.r(18, 50, 61, 58, STEEL_D); c.r(18, 50, 61, 50, STEEL_L)
    c.rbox(1, 24, 78, 56, WALNUT_D)
    c.e(1, 18, 26, 50, WALNUT_D); c.e(53, 18, 78, 50, WALNUT_D); c.r(13, 18, 66, 50, WALNUT_D)
    c.e(2, 19, 25, 48, WALNUT); c.e(54, 19, 77, 48, WALNUT); c.r(13, 19, 66, 48, WALNUT)
    c.r(13, 19, 66, 20, WALNUT_L); c.e(4, 20, 14, 24, WALNUT_L); c.e(65, 20, 75, 24, WALNUT_L)
    c.r(2, 49, 77, 55, WALNUT_D); c.r(2, 49, 77, 49, dk(WALNUT_D, 0.8))
    c.rbox(18, 28, 61, 39, (60, 66, 76)); c.r(19, 29, 60, 29, (110, 120, 136)); c.l(22, 38, 30, 29, (130, 140, 156))
    c.oval(35, 30, 44, 37, (30, 32, 38)); c.e(37, 32, 42, 35, (60, 62, 70)); c.p(39, 33, (90, 230, 120))
    for x in (8, 24, 48, 64):
        c.box(x, 21, x + 7, 26, (190, 196, 206)); c.r(x + 1, 22, x + 6, 24, SCREEN)
    for x in (12, 32, 56):
        c.r(x, 41, x + 7, 46, (60, 34, 24)); c.r(x, 41, x + 7, 41, (100, 64, 44)); c.r(x + 3, 43, x + 4, 43, GOLD)
    for x, y in ((22, 43), (46, 43), (68, 40), (5, 34)):
        c.oval(x, y, x + 3, y + 3, WHITE, (170, 170, 176)); c.p(x + 1, y + 1, (110, 64, 34))
    return c.done()


def gym_apparatus_zone():
    """4x3 gymnastics corner: overlapping blue landing mats, a wooden vaulting box (跳び箱) with white leather top,
    a springboard, and a suede balance beam on steel trestles."""
    c = C(64, 64)
    c.r(2, 61, 62, 62, SH)
    c.block(1, 30, 62, 60, 26, MAT, MAT_D)
    for x in range(16, 62, 15): c.r(x, 31, x, 56, MAT_D); c.r(x + 1, 31, x + 1, 56, MAT_L)
    c.r(2, 43, 61, 43, MAT_D)
    # balance beam on trestles (rises over the back mats)
    for x in (8, 54): c.r(x, 18, x + 1, 36, STEEL_D); c.r(x - 3, 36, x + 4, 37, STEEL)
    c.rbox(3, 12, 60, 19, (214, 188, 140)); c.r(4, 13, 59, 14, (236, 214, 170)); c.r(4, 18, 59, 18, (170, 140, 96))
    # vaulting box
    c.rbox(18, 30, 45, 36, (250, 248, 240)); c.r(19, 31, 44, 31, WHITE); c.r(19, 35, 44, 35, WHITE_D)
    for k, y in enumerate((37, 42, 47)):
        c.box(18 - k, y, 45 + k, y + 4, WOOD); c.r(19 - k, y + 1, 44 + k, y + 1, WOOD_L); c.r(29, y + 2, 34, y + 3, WOOD_DD)
    c.r(15, 52, 48, 52, SH)
    # springboard
    c.rbox(24, 53, 40, 59, (200, 60, 60)); c.r(25, 54, 39, 55, (240, 110, 100)); c.r(25, 58, 39, 58, (120, 30, 30))
    return c.done()


# ================================================================== rooftop
def roof_cooling_tower():
    """4x3 rooftop cooling tower: grey FRP casing with deep louvre slats, cylindrical fan stack with a visible fan
    on top, side ladder with safety cage, and insulated supply/return pipes into the plinth."""
    c = C(64, 80)
    c.r(2, 77, 62, 78, SH)
    c.oval(14, 0, 49, 12, FRP_D); c.e(16, 1, 47, 10, (50, 54, 60))
    for k in range(5):
        a = k * 2 * math.pi / 5
        c.l(31, 5, 31 + round(13 * math.cos(a)), 5 + round(4 * math.sin(a)), (150, 156, 164))
    c.oval(28, 4, 34, 7, FRP_L)
    c.r(14, 6, 49, 18, FRP); c.r(14, 6, 15, 18, FRP_L); c.r(48, 6, 49, 18, FRP_D); c.r(14, 6, 14, 18, OL); c.r(49, 6, 49, 18, OL)
    c.rbox(2, 18, 61, 70, FRP_D)
    c.r(3, 19, 60, 26, FRP_L); c.r(3, 19, 60, 19, WHITE_D)
    for y in range(28, 66, 3): c.r(4, y, 59, y, (100, 106, 114)); c.r(4, y + 1, 59, y + 1, FRP)
    c.r(3, 66, 60, 69, (120, 126, 134))
    c.box(18, 30, 45, 36, (230, 232, 236)); c.r(20, 32, 30, 33, BLUE); c.r(33, 32, 43, 33, (120, 120, 130))
    for x in (55, 59):
        c.r(x, 8, x, 70, STEEL_D)
    for y in range(10, 70, 4): c.r(55, y, 59, y, STEEL)
    for y in range(12, 60, 8): c.eo(52, y, 62, y + 6, STEEL_D)
    for x, col in ((6, (90, 140, 200)), (12, (200, 90, 80))):
        c.r(x, 66, x + 4, 76, col); c.r(x, 66, x, 76, lt(col, 1.3)); c.r(x - 1, 72, x + 5, 73, STEEL_D)
    c.r(2, 74, 61, 76, (140, 140, 140)); c.r(2, 74, 61, 74, (170, 170, 170))
    return c.done()


def roof_water_tower():
    """3x3 elevated rooftop water tank: banded steel cylinder with a conical lid and vent on four braced legs,
    caged ladder, float gauge and a fenced concrete plinth."""
    c = C(48, 80)
    c.r(2, 77, 46, 78, SH)
    c.oval(6, 0, 41, 10, STEEL_D); c.oval(7, 0, 40, 8, (150, 160, 170)); c.r(21, 0, 26, 2, STEEL_D)
    c.r(6, 5, 41, 38, (122, 140, 156)); c.r(6, 5, 6, 38, OL); c.r(41, 5, 41, 38, OL)
    c.r(7, 5, 12, 38, (160, 176, 190)); c.r(36, 5, 40, 38, (96, 110, 124))
    for y in (12, 22, 32): c.r(7, y, 40, y, (90, 104, 118)); c.r(7, y + 1, 40, y + 1, (170, 184, 196))
    c.e(6, 34, 41, 42, (96, 110, 124)); c.eo(6, 34, 41, 42, OL)
    c.r(16, 16, 31, 20, WHITE); c.r(18, 17, 29, 19, (60, 120, 200))
    for x in (9, 20, 27, 38):
        c.r(x, 40, x + 1, 68, STEEL_D)
    c.l(10, 44, 38, 64, STEEL); c.l(38, 44, 10, 64, STEEL); c.r(9, 54, 39, 54, STEEL)
    for y in range(8, 68, 4): c.r(43, y, 46, y, STEEL_L)
    c.r(43, 8, 43, 68, STEEL_D); c.r(46, 8, 46, 68, STEEL_D)
    c.block(2, 64, 45, 75, 4, (190, 186, 178), (150, 146, 140))
    for x in range(4, 44, 5): c.r(x, 60, x, 66, (200, 200, 60))
    c.r(3, 60, 44, 60, (230, 210, 70))
    return c.done()


# ================================================================== station / parking
def station_ticket_office():
    """5x3 staffed ticket office island: green-roofed glass booth with a lit 매표소 sign, three service windows with
    clerks, speaking grilles and a ledge, a fare chart and two touch-screen ticket machines at the ends."""
    c = C(80, 80)
    c.r(2, 77, 78, 78, SH)
    c.rbox(0, 0, 79, 18, (40, 120, 80)); c.r(1, 1, 78, 3, (80, 170, 120)); c.r(1, 16, 78, 17, (30, 90, 60))
    c.box(18, 5, 61, 14, (250, 250, 240)); c.r(19, 6, 60, 6, WHITE)
    for x in range(22, 58, 6): c.r(x, 8, x + 3, 11, (40, 120, 80)); c.r(x + 1, 9, x + 2, 9, (250, 250, 240))
    c.rbox(2, 18, 77, 74, (170, 176, 186))
    c.r(3, 19, 76, 22, (210, 214, 222))
    for k, x0 in enumerate((14, 33, 52)):
        c.glass(x0, 24, x0 + 15, 46)
        c.oval(x0 + 4, 30, x0 + 11, 38, (40, 60, 110)); c.oval(x0 + 5, 28, x0 + 10, 33, SKIN); c.r(x0 + 5, 28, x0 + 10, 29, (50, 40, 36))
        c.r(x0 + 3, 39, x0 + 12, 46, (40, 60, 110)); c.r(x0 + 7, 39, x0 + 8, 43, WHITE)
        c.glare(x0 + 1, 25, x0 + 6, 30)
        c.oval(x0 + 5, 40, x0 + 10, 44, STEEL_L); c.p(x0 + 7, 42, STEEL_D); c.p(x0 + 8, 41, STEEL_D)
        c.r(x0 - 1, 23, x0 + 16, 23, STEEL_D); c.r(x0 - 1, 24, x0 - 1, 46, STEEL_D)
    c.r(3, 47, 76, 50, STEEL_L); c.r(3, 51, 76, 51, STEEL_D)
    for x in range(12, 70, 4): c.r(x, 54, x + 2, 58, (196, 200, 208))
    c.box(12, 53, 70, 60, (250, 250, 244))
    for y in (55, 57):
        for x in range(14, 68, 6): c.r(x, y, x + 3, y, [(40, 120, 80), (200, 60, 60), (60, 110, 190)][(x // 6 + y) % 3])
    c.r(3, 64, 76, 72, (130, 136, 146)); c.r(3, 64, 76, 64, (190, 196, 206))
    for x0 in (2, 68):
        c.rbox(x0, 24, x0 + 9, 70, (230, 234, 240)); c.r(x0 + 1, 26, x0 + 8, 36, SCREEN); c.r(x0 + 1, 26, x0 + 8, 27, lt(SCREEN, 1.3))
        c.r(x0 + 2, 40, x0 + 7, 41, BLACK); c.r(x0 + 2, 46, x0 + 7, 49, (60, 62, 70)); c.p(x0 + 4, 52, (90, 230, 120))
    return c.done()


def park_box_truck_e():
    """5x2 delivery box truck facing east: tall white cargo box with a blue livery stripe and logo, roller shutter
    at the rear, cab with tinted windshield, mirror and headlight, dual rear wheels."""
    c = C(80, 64)
    c.r(3, 61, 78, 62, SH)
    c.rbox(0, 2, 56, 52, (210, 214, 222))
    c.r(1, 3, 55, 10, WHITE); c.r(1, 3, 55, 3, (252, 253, 254)); c.r(1, 11, 55, 11, WHITE_D)
    c.r(1, 12, 55, 51, (236, 238, 242))
    c.r(1, 30, 55, 36, (60, 110, 190)); c.r(1, 30, 55, 30, (110, 160, 224))
    c.oval(20, 15, 34, 27, (60, 110, 190)); c.e(23, 18, 31, 24, WHITE); c.r(26, 19, 28, 23, (240, 150, 50))
    c.r(38, 19, 52, 20, (60, 110, 190)); c.r(38, 23, 48, 24, (120, 130, 150))
    c.r(1, 12, 3, 51, (180, 184, 194))
    for y in range(14, 50, 3): c.r(1, y, 3, y, (150, 156, 166))
    c.r(1, 45, 55, 51, (180, 184, 194))
    c.rbox(54, 16, 79, 54, (224, 228, 236))
    c.r(55, 17, 78, 22, WHITE)
    c.r(57, 23, 77, 34, (60, 80, 110)); c.l(60, 33, 66, 24, (130, 160, 200)); c.r(57, 23, 77, 23, (100, 120, 150))
    c.r(55, 36, 78, 48, (214, 218, 226)); c.r(66, 38, 67, 46, (160, 166, 178))
    c.r(76, 40, 78, 43, (255, 240, 170)); c.r(76, 46, 78, 47, (240, 140, 40))
    c.box(52, 24, 55, 30, BLACK)
    c.r(0, 49, 79, 54, (60, 62, 70))
    for x in (8, 20, 62):
        c.oval(x, 46, x + 11, 61, BLACK); c.e(x + 3, 50, x + 8, 57, (150, 156, 166)); c.p(x + 5, 53, (90, 96, 106))
    return c.done()


# ================================================================== home / lobby
def home_sectional_set():
    """4x3 living-room centrepiece: woven kilim-pattern rug, L-shaped fabric sectional (north run + west chaise) with
    plump back and seat cushions and throw pillows, a round oak coffee table with mugs, a magazine and a remote."""
    c = C(64, 64)
    c.r(2, 61, 62, 62, SH)
    c.r(1, 24, 62, 60, (170, 80, 64)); c.r(1, 24, 62, 24, OL); c.r(1, 60, 62, 60, OL); c.r(1, 24, 1, 60, OL); c.r(62, 24, 62, 60, OL)
    c.r(3, 26, 60, 58, (200, 120, 90)); c.r(6, 29, 57, 55, (230, 200, 160)); c.r(9, 32, 54, 52, (60, 110, 120))
    for y in range(34, 51, 4):
        for x in range(12, 52, 8):
            c.p(x + 2, y, (230, 200, 160)); c.r(x + 1, y + 1, x + 3, y + 1, (230, 200, 160)); c.p(x + 2, y + 2, (230, 200, 160))
    for x in range(3, 61, 3): c.p(x, 61, (230, 200, 160))
    SOFA, SOFA_L, SOFA_D = (120, 140, 160), (160, 180, 196), (84, 100, 120)
    c.rbox(2, 0, 61, 16, SOFA_D)
    for x0 in (4, 23, 42): c.cushion(x0, 1, x0 + 17, 14, SOFA_L, SOFA, SOFA_D)
    c.rbox(2, 12, 61, 26, SOFA_D)
    for x0 in (14, 30, 46): c.cushion(x0, 13, x0 + 15, 24, SOFA_L, SOFA, SOFA_D)
    c.rbox(0, 0, 14, 56, SOFA_D); c.cushion(1, 1, 13, 12, SOFA_L, SOFA, SOFA_D); c.cushion(2, 13, 13, 54, SOFA_L, SOFA, SOFA_D)
    c.r(3, 30, 11, 30, SOFA_D)
    c.rbox(60, 4, 63, 26, SOFA_D); c.r(61, 5, 62, 6, SOFA_L)
    c.cushion(16, 4, 23, 11, (240, 200, 90), YELLOW, YELLOW_D); c.cushion(44, 4, 51, 11, (236, 130, 120), RED_L, RED)
    c.cushion(3, 15, 10, 22, (236, 236, 230), CREAM, CREAM_D)
    c.oval(24, 34, 51, 52, WOOD_D); c.oval(24, 32, 51, 49, WOOD); c.e(26, 33, 49, 38, WOOD_L)
    c.oval(28, 38, 32, 42, WHITE, (170, 170, 176)); c.p(30, 40, (110, 64, 34))
    c.oval(42, 37, 46, 41, (240, 120, 100), RED_D); c.p(44, 39, (110, 64, 34))
    c.r(34, 40, 41, 45, (60, 140, 200)); c.r(34, 40, 41, 40, (120, 190, 240)); c.r(35, 42, 40, 42, WHITE)
    c.r(36, 36, 40, 37, BLACK)
    return c.done()


def lobby_tree_bench():
    """3x3 lobby centrepiece: round oak slat bench ring around a stone planter with an olive tree whose canopy
    rises above the footprint; uplights in the soil."""
    c = C(48, 80)
    c.r(3, 77, 45, 78, SH)
    c.oval(1, 50, 46, 76, WOOD_D)
    for x in range(5, 44, 4): c.r(x, 64, x, 74, dk(WOOD_D, 0.8))
    c.oval(1, 44, 46, 70, WOOD); c.e(3, 46, 44, 66, WOOD_L)
    for k in range(1, 4): c.eo(1 + k * 2, 44 + k, 46 - k * 2, 70 - k, WOOD)
    c.oval(10, 47, 37, 64, STONE_D); c.oval(11, 47, 36, 61, STONE); c.e(13, 49, 34, 59, (90, 66, 46))
    c.dither(14, 50, 33, 58, (110, 82, 58))
    for x in (16, 31): c.p(x, 55, (255, 236, 170)); ap(c, x, 54, (255, 236, 170), 120)
    c.r(22, 26, 25, 56, (110, 80, 56)); c.r(22, 26, 22, 56, (150, 112, 80)); c.l(24, 36, 31, 28, (110, 80, 56)); c.l(23, 34, 15, 27, (110, 80, 56))
    for x0, y0, x1, y1 in ((4, 10, 26, 30), (20, 4, 44, 26), (10, 0, 36, 18), (2, 18, 18, 34), (30, 16, 46, 32)):
        c.oval(x0, y0, x1, y1, LEAF_D); c.e(x0 + 2, y0 + 1, x1 - 4, y1 - 5, LEAF)
    for x, y in ((12, 14), (22, 6), (32, 12), (8, 22), (38, 22), (28, 20)): c.r(x, y, x + 2, y, (150, 200, 110)); c.p(x + 1, y - 1, (190, 220, 140))
    for x, y in ((16, 20), (30, 26), (24, 12)): c.p(x, y, (60, 50, 90))
    return c.done()


# ================================================================== R13b: konbini / lecture hall / officetel
def konbini_hot_food_island():
    """4x3 konbini hot-food island: hanging price strip, steel oden pot with daikon/egg/konnyaku/fishcake in
    broth, glass nikuman steamer with fogged panes, heated fried-chicken warmer under amber lamps, self-serve
    coffee machine; white counter body with the store's green-orange-blue stripe band."""
    c = C(64, 64)
    # hanging price strip (overhang)
    c.r(14, 0, 14, 3, STEEL_D); c.r(49, 0, 49, 3, STEEL_D)
    c.box(6, 3, 57, 10, WHITE)
    for x, col in ((8, RED), (21, ORANGE), (34, YELLOW_D), (47, RED)):
        c.r(x, 5, x + 9, 8, col); c.r(x + 1, 6, x + 4, 6, WHITE); c.r(x + 6, 7, x + 8, 7, WHITE)
    c.r(1, 61, 62, 62, SH)
    # counter body: 3/4 top + front face + stripe band
    c.block(0, 26, 63, 59, 14, (236, 238, 240), WHITE)
    c.r(1, 44, 62, 45, (60, 150, 90)); c.r(1, 46, 62, 47, ORANGE); c.r(1, 48, 62, 49, BLUE)
    for x in range(6, 60, 10): c.r(x, 51, x + 5, 56, (232, 234, 238)); c.r(x, 51, x + 5, 51, WHITE_D)
    # oden pot (west): steel rim, 4 compartments of broth with simmering pieces
    c.box(2, 20, 25, 37, STEEL_D); c.r(3, 21, 24, 21, STEEL_L)
    c.r(3, 22, 24, 36, (200, 160, 90)); c.r(13, 22, 14, 36, STEEL); c.r(3, 29, 24, 29, STEEL)
    for x, y in ((5, 24), (16, 24)): c.oval(x, y, x + 5, y + 3, (246, 240, 220), (200, 180, 140))
    for x, y in ((9, 25), (20, 31)): c.oval(x, y, x + 3, y + 3, WHITE, (210, 200, 170)); c.p(x + 1, y + 1, YELLOW)
    for x, y in ((5, 31), (16, 31)): c.l(x, y + 4, x + 3, y, (90, 84, 88)); c.l(x + 1, y + 4, x + 4, y, (110, 104, 108)); c.l(x, y + 4, x + 4, y + 4, (90, 84, 88))
    c.r(9, 32, 12, 34, (220, 200, 170)); c.r(9, 32, 12, 32, (240, 226, 200))
    for x in (6, 12, 19, 23): ap(c, x, 18, (244, 248, 252), 140); ap(c, x + 1, 16, (244, 248, 252), 90); ap(c, x, 14, (244, 248, 252), 50)
    # nikuman steamer (middle): glass box, fogged panes, buns on a rack
    c.box(27, 12, 42, 37, STEEL_D)
    c.glass(28, 13, 41, 36, (214, 230, 236))
    for y in (18, 27):
        c.r(28, y + 6, 41, y + 6, STEEL)
        for x in (29, 35):
            c.oval(x, y, x + 5, y + 5, (250, 246, 236), (206, 196, 176)); c.p(x + 2, y + 1, WHITE); c.p(x + 3, y + 2, (220, 150, 90))
    c.dither(28, 13, 41, 15, (250, 252, 252)); c.r(28, 13, 41, 13, WHITE)
    # fried-chicken warmer (east): amber heat lamps over karaage and croquettes
    c.box(44, 16, 61, 37, (60, 62, 70))
    c.r(45, 17, 60, 19, (255, 190, 80)); c.r(45, 17, 60, 17, (255, 230, 150))
    c.glass(45, 20, 60, 36, (250, 214, 150))
    for x, y in ((46, 24), (51, 23), (56, 25), (47, 30), (53, 30)):
        c.oval(x, y, x + 4, y + 3, (200, 120, 40), (140, 76, 24)); c.p(x + 1, y + 1, (240, 180, 90))
    c.r(45, 34, 60, 34, (226, 160, 70))
    for y in range(20, 36, 3): ap(c, 44 + (y % 5), y, (255, 220, 140), 60)
    # tongs + napkins + price cards on the top surface
    c.l(28, 40, 40, 38, STEEL_L); c.l(28, 41, 40, 39, STEEL_D)
    c.r(47, 39, 52, 41, WHITE); c.r(47, 42, 52, 42, WHITE_D)
    for x, col in ((4, RED), (16, ORANGE), (55, YELLOW)): c.r(x, 39, x + 5, 41, col); c.r(x + 1, 40, x + 3, 40, WHITE)
    return c.done()


def lecture_tiered_desk():
    """4x3 raked lecture-hall section: two stepped tiers of continuous oak writing desks with modesty panels,
    blue flip-up seats behind each desk, a carpeted riser step with a bright nosing between the tiers, oak end
    panels, and notebooks / laptops / pens on the desks."""
    c = C(64, 64)
    SEAT, SEAT_L, SEAT_D = (70, 110, 180), (110, 150, 214), (44, 72, 128)
    RISER, RISER_L = (110, 92, 96), (150, 130, 132)
    c.r(1, 61, 62, 62, SH)
    # carpeted rake under everything (back tier drawn higher), lit stair nosing between tiers
    c.box(0, 4, 63, 59, RISER)
    c.r(1, 31, 62, 34, dk(RISER, 0.85)); c.r(1, 31, 62, 31, RISER_L); c.r(1, 30, 62, 30, (240, 214, 120))
    for x in range(4, 62, 6): c.p(x, 33, dk(RISER, 0.7))

    def tier(y):
        # oak desk: lit top, front modesty panel, toe shadow
        c.box(3, y, 60, y + 11, WOOD_D)
        c.r(4, y + 1, 59, y + 5, WOOD_L); c.r(4, y + 1, 59, y + 1, (240, 218, 180))
        c.r(4, y + 6, 59, y + 10, WOOD); c.r(4, y + 10, 59, y + 10, WOOD_D)
        for x in (18, 32, 46): c.r(x, y + 6, x, y + 10, WOOD_D)
        # desk-top kit per seat
        c.r(7, y + 2, 12, y + 4, WHITE); c.r(7, y + 4, 12, y + 4, WHITE_D); c.l(9, y + 2, 11, y + 4, BLUE)
        c.box(21, y + 1, 28, y + 4, (60, 62, 70)); c.r(22, y + 2, 27, y + 2, SCREEN)
        c.r(35, y + 2, 41, y + 4, (240, 200, 90)); c.r(36, y + 3, 40, y + 3, WHITE)
        c.box(49, y + 1, 56, y + 4, (190, 196, 206)); c.r(50, y + 2, 55, y + 2, SCREEN_D)
        # flip-up seats (backs toward the viewer, students face north)
        for x0 in (4, 18, 32, 46):
            c.cushion(x0 + 1, y + 12, x0 + 12, y + 17, SEAT_L, SEAT, SEAT_D)
            c.r(x0 + 3, y + 18, x0 + 4, y + 20, STEEL_D); c.r(x0 + 9, y + 18, x0 + 10, y + 20, STEEL_D)

    tier(6)
    tier(36)
    # oak end panels with seat-row number plates
    for x0 in (0, 60):
        c.box(x0, 4, x0 + 3, 58, WOOD_D); c.r(x0 + 1, 5, x0 + 2, 5, WOOD_L)
        for y in (12, 42): c.r(x0 + 1, y, x0 + 2, y + 2, GOLD)
    return c.done()


def officetel_studio_bed_desk():
    """4x3 officetel studio module: black steel loft bed (mattress, rumpled duvet, pillow, guard rail) over a
    built-in oak desk with monitor, lamp and mug; ladder on the east post and a tall bookcase with books and a plant."""
    c = C(64, 64)
    FRAME, FRAME_L = (48, 50, 58), (90, 94, 106)
    DUVET, DUVET_L, DUVET_D = (150, 186, 220), (196, 220, 240), (100, 134, 176)
    c.r(1, 61, 62, 62, SH)
    # under-loft desk zone (drawn first, the bed covers its back)
    c.r(3, 26, 45, 56, (214, 200, 176)); c.r(3, 26, 45, 30, (186, 170, 146))
    c.box(6, 27, 20, 37, (40, 42, 50)); c.r(7, 28, 19, 35, SCREEN); c.r(7, 28, 19, 28, lt(SCREEN, 1.3)); c.r(9, 31, 15, 31, WHITE)
    c.r(12, 38, 14, 40, FRAME)
    c.l(36, 30, 40, 26, FRAME); c.oval(37, 24, 43, 28, YELLOW, YELLOW_D); ap(c, 39, 30, (255, 240, 180), 120)
    c.block(3, 40, 45, 55, 6, WOOD_L, WOOD)
    c.r(6, 42, 15, 44, (60, 62, 70)); c.r(7, 42, 14, 42, (110, 114, 126))
    c.oval(31, 41, 35, 45, WHITE, (170, 170, 176)); c.p(33, 43, (110, 64, 34))
    c.r(20, 42, 26, 45, (240, 236, 220)); c.r(20, 45, 26, 45, (200, 194, 180))
    for x in (10, 30): c.r(x, 48, x + 6, 48, WOOD_D); c.p(x + 3, 50, GOLD)
    # loft bed platform: mattress top, duvet, pillow, under-face
    c.box(0, 2, 48, 25, FRAME)
    c.r(1, 3, 47, 17, (240, 240, 236))
    c.cushion(2, 4, 13, 12, WHITE, (236, 238, 242), WHITE_D)
    c.cushion(14, 4, 46, 17, DUVET_L, DUVET, DUVET_D)
    for x0 in (20, 30, 38): c.r(x0, 8, x0 + 4, 8, DUVET_D); c.r(x0 + 1, 9, x0 + 5, 9, DUVET_L); c.r(x0 - 2, 13, x0 + 2, 13, DUVET_D)
    c.r(1, 18, 47, 21, FRAME_L); c.r(1, 18, 47, 18, (150, 154, 166))
    for x in range(6, 46, 6): c.r(x, 19, x, 21, FRAME)
    c.r(1, 22, 47, 24, (30, 32, 38))
    # posts down to the floor
    for x in (0, 46): c.r(x, 25, x + 2, 58, FRAME); c.r(x, 25, x, 58, FRAME_L)
    # ladder (east)
    c.r(47, 4, 47, 58, FRAME); c.r(52, 4, 52, 58, FRAME)
    for y in range(9, 58, 7): c.r(48, y, 51, y, FRAME_L)
    # tall bookcase
    c.box(54, 6, 63, 58, WOOD_D); c.r(55, 7, 62, 8, WOOD_L)
    for y in (16, 28, 40, 52): c.r(55, y, 62, y + 1, WOOD)
    for i, y in enumerate((10, 22, 34, 46)):
        for k, x in enumerate(range(55, 62, 2)):
            col = [RED, BLUE, GREEN, YELLOW_D, PURPLE, ORANGE][(i + k) % 6]
            c.r(x, y + (k % 2), x + 1, y + 5, col); c.p(x, y + (k % 2), lt(col, 1.4))
    c.oval(56, 1, 62, 7, LEAF_D); c.e(57, 2, 61, 5, LEAF)
    return c.done()
