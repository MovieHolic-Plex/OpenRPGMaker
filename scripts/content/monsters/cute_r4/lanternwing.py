"""lanternwing 랜턴모스 — young lantern moth (stage 2 of wickworm → lanternwing → beaconmoth).

Signature: two big rounded paper-lantern wings (warm cream with a golden rim) each lit by an orange flame window,
plus feathery antennae. Keeps wickworm's butter-yellow body, brown bands and flame motif; beaconmoth (accepted)
is the grown-up four-winged form.
"""
import math

from .kit import *  # noqa: F401,F403
from .kit import blob, flame_shape, leaf, paint, sd_capsule, sd_chain, sd_ellipse


def draw(side: str):
    v = View(side, 0.97)
    OL = "#380805"
    BUTTER = ("#fff6a0", "#fce452", "#f9b40f", "#b85f14")
    BAND = ("#d08a2a", "#b85f14", "#8a3a0c")
    CREAM = ("#fffdf0", "#fdf4bd", "#ecd690")
    PAPER = ("#fffdf0", "#fdf4bd", "#f6d77a")
    FLAME = ("#fddf02", "#f54d01", "#c42a02")
    E, R = v.p, v.r
    flip = -1 if v.back else 1
    # wings: rounded lanterns hinged at the shoulder, fanning up and outward
    WN = ((44, 25), 11.5, 14, 28)   # centre, rx, ry, tilt
    WF = ((12.5, 26.5), 8.6, 11.5, -26)

    def lantern(w, hinge):
        (cx, cy), rx, ry, a = w
        return blob(sd_ellipse(*E(cx, cy), R(rx), R(ry), v.ang(a)), sd_capsule(E(*hinge), E(cx, cy), R(4), R(5)), k=2.5)

    near_wing = lantern(WN, (31, 41))
    far_wing = lantern(WF, (22, 38))
    head = blob(sd_ellipse(*E(21, 41.5), R(10.6), R(9.8)), sd_ellipse(*E(14, 45), R(4.5), R(3.6)), k=2.5)
    collar = blob(*[sd_ellipse(*E(x, y), R(2.6), R(2.4)) for x, y in ((22.5, 49.5), (25.5, 52), (29, 53), (32.5, 51.5), (34, 48), (31, 45.5), (27, 46.5))], k=0.5)
    abdomen = blob(sd_ellipse(*E(39.5, 52.5), R(9.5), R(6.6), v.ang(12)), sd_ellipse(*E(46, 55.5), R(5), R(4.5)), k=2.5)

    def feather_antenna(base, tip, bend):
        pts = [E(*base), E((base[0] + tip[0]) / 2 + bend, (base[1] + tip[1]) / 2), E(*tip)]
        m = sd_chain(pts, [R(0.75), R(0.65), R(0.6)]) < 0
        bx, by = base
        tx, ty = tip
        for f in (0.55, 0.85):  # pectinations: short ticks on both sides
            mx, my = bx + (tx - bx) * f + bend * (1 - abs(2 * f - 1)), by + (ty - by) * f
            dx, dy = tx - bx, ty - by
            L = math.hypot(dx, dy)
            nx, ny = -dy / L, dx / L
            for sgn in (-1, 1):
                m |= sd_chain([E(mx, my), E(mx + nx * sgn * 2 - dx / L * 1.2, my + ny * sgn * 1.8 - dy / L * 1.4)], [R(0.45), R(0.4)]) < 0
        return m

    ant_far = feather_antenna((18, 33.5), (20, 22.5), -1.2)
    ant_near = feather_antenna((24, 32.5), (29.5, 21.5), 1.2)

    def leg(x, dx):  # short sturdy moth leg with a round little paw
        return blob(sd_chain([E(x, 55.5), E(x + dx, 59.5)], [R(1.8), R(1.5)]), sd_ellipse(*E(x + dx - 0.5, 61), R(2.2), R(1.3)), k=1)

    legs = [leg(27, -1.5), leg(33.5, -0.5), leg(40, 0.8)]
    parts = {
        "far_wing": Part("far_wing", far_wing, PAPER, shade=((2, 2), (1, 3))),
        "ant_far": Part("ant_far", ant_far, BAND, shade=()),
        "leg0": Part("leg0", legs[0], BUTTER[1:], shade=((0, 1),)),
        "leg1": Part("leg1", legs[1], BUTTER[1:], shade=((0, 1),)),
        "leg2": Part("leg2", legs[2], BUTTER[1:], shade=((0, 1),)),
        "near_wing": Part("near_wing", near_wing, PAPER, shade=((2, 2), (1, 3)), rim=True),
        "abdomen": Part("abdomen", abdomen, BUTTER, shade=((2, 2), (0, 3)), rim=True, cast=True),
        "collar": Part("collar", collar, CREAM, shade=((1, 2), (2, 1)), cast=True),
        "head": Part("head", head, BUTTER, shade=((3, 3), (1, 4), (4, 1)), rim=True, cast=True),
        "ant_near": Part("ant_near", ant_near, BAND, shade=()),
    }
    if v.back:
        order = ["leg0", "leg1", "leg2", "abdomen", "collar", "far_wing", "near_wing", "head", "ant_far", "ant_near"]
        parts["head"].sep = False
    else:
        order = ["far_wing", "ant_far", "leg0", "leg1", "leg2", "near_wing", "abdomen", "collar", "head", "ant_near"]
    arr = render([parts[n] for n in order], OL)
    # golden rim inside each wing edge, then the flame window
    for name, ((cx, cy), rx, ry, a), sc in (("far_wing", WF, 0.78), ("near_wing", WN, 1.0)):
        whole = ellipse(*E(cx, cy), R(rx), R(ry), v.ang(a))
        inner_w = ellipse(*E(cx, cy), R(rx - 1.6), R(ry - 1.6), v.ang(a))
        paint(arr, whole & ~inner_w, PAPER[2], [name])
        for k in (-0.5, 0.5):  # two lantern ribs
            rib = ellipse(*E(cx, cy), R(rx * (1 - abs(k) * 0.5)), R(ry), v.ang(a)) & ~ellipse(*E(cx, cy), R(rx * (1 - abs(k) * 0.5) - 0.8), R(ry - 0.8), v.ang(a))
            paint(arr, rib & inner_w, PAPER[2], [name])
        X, Y = E(cx, cy)
        win = flame_shape(lambda x, y: (x, y), lambda r: r, X, Y + 8.5 * sc, 17.5 * sc, 12 * sc)
        core = flame_shape(lambda x, y: (x, y), lambda r: r, X, Y + 7.5 * sc, 9.5 * sc, 6 * sc)
        paint(arr, win, FLAME[1], [name])
        paint(arr, core, FLAME[0], [name])
    # curved bands wrapping the abdomen
    for x0 in (37.5, 42.5):
        paint(arr, sd_chain([E(x0 + 1, 46.5), E(x0 - 0.6, 52), E(x0 + 0.4, 58)], [R(1.1), R(1.1), R(0.9)]) < 0, BAND[1], ["abdomen"])
    eyes = None
    if not v.back:
        near = eye(arr, v.ix(21), v.iy(38), NEAR_EYE_6x8, "#2a0804", "#7a3a10", "#c07a2c", rim=OL)
        far = eye(arr, v.ix(14), v.iy(39), FAR_EYE_3x7, "#2a0804", "#7a3a10", "#c07a2c", rim=OL)
        stamp(arr, v.ix(15), v.iy(47), ["D..D", ".DD."], {"D": OL})
        eyes = {"anatomy": "threequarter", "style": "round", "near": near, "far": far}
    return arr, eyes
