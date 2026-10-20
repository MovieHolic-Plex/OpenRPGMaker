"""trancescythe 문사이드 — young dream mantis (dozemite → trancescythe → oraclemantis).

Signature: two huge curved scythe arms raised in a dancer's stance (one held up in front, one swept high behind),
each as long as the body, with a thin glowing mint membrane along the inner edge. Upright slim body, big rounded
triangle head, two curly antennae (no dream bubbles yet, no crystal or light sheets — those come with oraclemantis).
"""
from .kit import *  # noqa: F401,F403
from .kit import blob, inner, leaf, paint, sd_chain, sd_ellipse, sd_poly, shifted
import math


def crescent(E, R, c, rx, ry, ang, off):
    """Outer ellipse minus an inner ellipse pushed by `off` (front coords) — a moon-shaped blade (kept for importers)."""
    a = ellipse(*E(*c), R(rx), R(ry), ang)
    b = ellipse(*E(c[0] + off[0], c[1] + off[1]), R(rx * 0.8), R(ry * 0.8), ang)
    return a & ~b


def crescent_inner(E, R, c, rx, ry, ang, off):
    """The membrane band along the inner (concave) edge of the same crescent (kept for importers)."""
    return ellipse(*E(c[0] + off[0] * 0.55, c[1] + off[1] * 0.55), R(rx * 0.86), R(ry * 0.86), ang)


OL = "#44076e"
LILAC = ("#f6dcfc", "#e7b2f0", "#bd8ad8", "#885cc0")
VIOLET = ("#c08ce0", "#8e62c8", "#6e40a8")
MINT = ("#e2ffe6", "#a8f3ac", "#6cd08a")
CREAM = ("#fdfddc", "#fdfddc", "#e8dcb0")


def _blade(E, R, elbow, tip, width, bend):
    return leaf(E(*elbow), E(*tip), R(width), bend=bend, fat=0.3)


def _edge_band(mask, dx, dy, k=2):
    """Pixels of mask within k steps of its edge on the (dx, dy) side, kept off the outer outline."""
    core = inner(mask, 1)
    band = np.zeros_like(mask)
    for i in range(1, k + 1):
        band |= ~shifted(mask, dx * i, dy * i)
    return core & band


def _arc_blade(E, center, r, a0, a1, W, out=0.35, mem=(0.08, 0.86, 0.5), n=24):
    """A sickle along a circle arc (front coords, degrees, y down): thick heel at a0 tapering to a sharp tip at a1.
    The convex back edge sits at r + w*out, the concave cutting edge at r - w*(1-out). Returns (blade, membrane)."""
    cx, cy = center
    outer, inn, m_out, m_in = [], [], [], []
    for i in range(n + 1):
        t = i / n
        a = math.radians(a0 + (a1 - a0) * t)
        w = W * min(1.0, 0.72 + t * 1.4) * (1 - t) ** 0.65 + 0.35
        ca, sa = math.cos(a), math.sin(a)
        ro, ri = r + w * out, r - w * (1 - out)
        outer.append(E(cx + ca * ro, cy + sa * ro))
        inn.append(E(cx + ca * ri, cy + sa * ri))
        if mem[0] <= t <= mem[1]:
            rm = ri + w * mem[2]
            m_out.append(E(cx + ca * rm, cy + sa * rm))
            m_in.append(E(cx + ca * (ri - 0.6), cy + sa * (ri - 0.6)))
    blade = poly(outer + inn[::-1])
    membrane = poly(m_out + m_in[::-1]) & inner(blade, 1)
    return blade, membrane


def _I(x, y):
    return (x, y)


def _R(r):
    return r


def _antenna(pts):
    return sd_chain(list(pts), [0.75] * len(pts)) < 0


def _curl(cx, cy, r0, a0, turns, sgn):
    n = int(turns * 2 * math.pi / 0.5) + 1
    return [(cx + math.cos(a0 + sgn * t) * r0 * (1 - 0.55 * t / (turns * 2 * math.pi)),
             cy + math.sin(a0 + sgn * t) * r0 * (1 - 0.55 * t / (turns * 2 * math.pi))) for t in [k * 0.5 for k in range(n)]]


def _leg(hip, knee, foot, w=1.15):
    d = sd_chain([hip, knee, foot], [w, w * 0.95, w * 0.75])
    return (d < 0) | (sd_ellipse(foot[0], foot[1] + 0.4, 1.7, 1.0) < 0)


FAR_LEG = (VIOLET[1], VIOLET[2], VIOLET[2])


def _front():
    """Front 3/4 view in canvas coordinates (faces left, feet on y~62)."""
    # big friendly head: a broad round crown with a soft oval cheek at the front-bottom
    crown = sd_ellipse(27, 22, 9.8, 6.8, -6)
    cheek = sd_ellipse(23.5, 26.6, 7, 3.9, -8)
    head = blob(crown, cheek, k=4)
    # slim upright prothorax/thorax, segmented abdomen held up-right behind
    thorax = blob(sd_chain([(29.5, 31), (31, 40), (33.5, 48)], [2.6, 2.4, 3.4]), sd_ellipse(34.5, 48.5, 3.8, 3.2), k=2)
    chest = (sd_chain([(29, 38), (31.5, 47)], [1.1, 1.5]) < 0) & thorax
    abdomen = blob(sd_ellipse(44.5, 46, 9.5, 5, -22), sd_ellipse(37.5, 49.5, 3.6, 3.4), k=2.5)
    ant_far = _antenna([(25, 18), (24, 14.5), (22, 12)] + _curl(19.7, 12.6, 2.4, -0.75, 0.8, -1))
    ant_near = _antenna([(30, 18), (31.5, 14.5), (34, 12)] + _curl(36.4, 13, 2.4, math.pi + 0.75, 0.8, 1))
    # raptorial arms: upper arm rises from the chest to a high elbow under the cheek, then the curved blade
    # (mint membrane on its inner edge, facing the body) sweeps forward and down to a sharp tip
    # coxa knob on the chest -> femur angled up-forward to an elbow knob clear of the chin -> short curved blade
    coxa_near = sd_ellipse(30, 40.5, 2.6, 2.4) < 0
    arm_near = (sd_chain([(30, 40.5), (22, 38.6), (13, 35.5)], [1.9, 1.7, 1.6]) < 0) | (sd_ellipse(13, 35.5, 2.2, 2.1) < 0) | coxa_near
    arm_far = (sd_chain([(31, 38.5), (24, 36.5), (17, 34)], [1.6, 1.5, 1.4]) < 0) | (sd_ellipse(17, 34, 1.9, 1.8) < 0)
    blade_near, mem_near = _arc_blade(_I, (18.5, 46.5), 12.3, 243, 178, 8.5, mem=(0.06, 0.86, 0.55))
    blade_far, mem_far = _arc_blade(_I, (22, 45), 12, 246, 182, 7, mem=(0.06, 0.86, 0.55))
    parts = {
        "leg_ff": Part("leg_ff", _leg((34, 49), (29, 44.5), (25.5, 61)), FAR_LEG, shade=((0, 1),)),
        "leg_fb": Part("leg_fb", _leg((38, 49), (43.5, 44.5), (47.5, 61)), FAR_LEG, shade=((0, 1),)),
        "leg_nf": Part("leg_nf", _leg((34, 51), (26, 45.5), (20, 62), 1.4), VIOLET, shade=((0, 1),)),
        "leg_nb": Part("leg_nb", _leg((38.5, 51.5), (47.5, 45.5), (52.5, 62), 1.4), VIOLET, shade=((0, 1),)),
        "ant_far": Part("ant_far", ant_far, VIOLET, shade=()),
        "ant_near": Part("ant_near", ant_near, VIOLET, shade=()),
        "arm_far": Part("arm_far", arm_far, VIOLET, shade=((0, 1),)),
        "blade_far": Part("blade_far", blade_far, LILAC[1:], shade=((1, 1),)),
        "mem_far": Part("mem_far", mem_far, MINT[1:] + (MINT[2],), sep=False, shade=((1, 1),)),
        "abdomen": Part("abdomen", abdomen, VIOLET, shade=((2, 2), (0, 2)), rim=True, cast=True),
        "thorax": Part("thorax", thorax, LILAC, shade=((2, 1), (0, 2)), rim=True),
        "chest": Part("chest", chest, CREAM, sep=False, shade=((1, 1),)),
        "head": Part("head", head, LILAC, shade=((3, 3), (1, 3), (3, 1)), rim=True, sep="down", cast=True),
        "arm_near": Part("arm_near", arm_near, LILAC, shade=((0, 1),)),
        "blade_near": Part("blade_near", blade_near, LILAC, shade=((1, 1), (0, 1)), rim=True),
        "mem_near": Part("mem_near", mem_near, MINT, sep=False, shade=((1, 1),)),
    }
    order = ["leg_fb", "leg_ff", "ant_far", "arm_far", "blade_far", "mem_far", "abdomen", "leg_nb", "leg_nf",
             "thorax", "chest", "ant_near", "head", "arm_near", "blade_near", "mem_near"]
    arr = render([parts[n] for n in order], OL)
    for x in (40.5, 44.5, 48.5):
        paint(arr, sd_chain([(x + 1.5, 41 + (48.5 - x) * 0.35), (x - 0.5, 45.5), (x - 1, 50.5)], [0.5] * 3) < 0, VIOLET[2], ["abdomen"])
    for name, m in (("mem_near", mem_near), ("mem_far", mem_far)):
        paint(arr, m & ~shifted(m, 0, -1) & shifted(m, 0, 1), MINT[0], [name])
    near = eye(arr, 22, 19, NEAR_EYE_6x8, "#2a0848", "#6a3aa8", "#a07ad8", rim=OL)
    stamp(arr, 18, 28, ["D...", ".DDD"], {"D": OL})  # small smile at the front-bottom of the cheek
    return arr, {"anatomy": "profile", "style": "round", "near": near, "far": None}


def _back():
    """Rear 3/4 view in canvas coordinates, facing away up-right: the round back of the head on a clean neck,
    the dorsal thorax, the big abdomen in the foreground, four legs rooted at the thorax-abdomen junction, and
    both scythes reaching out to the right on visible upper arms from behind the thorax."""
    head = blob(sd_ellipse(39, 19.5, 8.8, 7.2, 8), sd_ellipse(36.5, 24.5, 5.5, 3.8, 10), k=3.5)
    neck = sd_chain([(36.5, 26), (35.5, 31)], [1.9, 2.1]) < 0
    thorax = blob(sd_chain([(35.5, 31), (35, 38), (34, 45)], [2.5, 2.7, 3.6]), sd_ellipse(34, 45.5, 4.2, 3.4), k=2)
    ridge = (sd_chain([(35, 33), (34.3, 43)], [0.5, 0.5]) < 0) & thorax
    abdomen = blob(sd_ellipse(21.5, 45, 10.5, 6, 20), sd_ellipse(29, 47, 4, 3.6), k=2.5)
    ant_l = _antenna([(36.5, 15.5), (35, 13.5), (32.5, 12)] + _curl(30.2, 12.8, 2.4, -0.75, 0.8, -1))
    ant_r = _antenna([(41.5, 15), (44, 13.5), (46.5, 12)] + _curl(48.8, 12.8, 2.4, math.pi + 0.75, 0.8, 1))
    # upper arms come out from behind the right side of the thorax, then the blades curve forward-down
    arm_a = (sd_chain([(36, 35.5), (42.5, 36), (48, 35)], [1.9, 1.8, 1.7]) < 0) | (sd_ellipse(48, 35, 2.2, 2.1) < 0)
    arm_b = (sd_chain([(36.5, 33), (41.5, 32), (45.5, 30.5)], [1.5, 1.4, 1.4]) < 0) | (sd_ellipse(45.5, 30.5, 1.8, 1.8) < 0)
    blade_a, mem_a = _arc_blade(_I, (45, 46.5), 11.5, 285, 360, 8, mem=(0.06, 0.86, 0.55))
    blade_b, mem_b = _arc_blade(_I, (43, 41.5), 11, 283, 356, 6.5, mem=(0.06, 0.86, 0.55))
    parts = {
        "leg_fl": Part("leg_fl", _leg((34, 46), (28.5, 49), (27, 60.5)), FAR_LEG, shade=((0, 1),)),
        "leg_fr": Part("leg_fr", _leg((37.5, 46), (42, 43.5), (43.5, 60.5)), FAR_LEG, shade=((0, 1),)),
        "leg_nl": Part("leg_nl", _leg((33.5, 47.5), (25, 52), (19.5, 62), 1.4), VIOLET, shade=((0, 1),)),
        "leg_nr": Part("leg_nr", _leg((37, 47.5), (46, 45), (50, 62), 1.4), VIOLET, shade=((0, 1),)),
        "arm_b": Part("arm_b", arm_b, VIOLET, shade=((0, 1),)),
        "blade_b": Part("blade_b", blade_b, LILAC[1:], shade=((1, 1),)),
        "mem_b": Part("mem_b", mem_b, MINT[1:] + (MINT[2],), sep=False, shade=((1, 1),)),
        "arm_a": Part("arm_a", arm_a, LILAC, shade=((0, 1),)),
        "blade_a": Part("blade_a", blade_a, LILAC, shade=((1, 1), (0, 1)), rim=True),
        "mem_a": Part("mem_a", mem_a, MINT, sep=False, shade=((1, 1),)),
        "ant_l": Part("ant_l", ant_l, VIOLET, shade=()),
        "ant_r": Part("ant_r", ant_r, VIOLET, shade=()),
        "neck": Part("neck", neck, LILAC, shade=((-1, 1),)),
        "thorax": Part("thorax", thorax, LILAC, shade=((-2, 1), (0, 2)), rim=True),
        "head": Part("head", head, LILAC, shade=((-3, 3), (-1, 3), (-3, 1)), rim=True, sep="down", cast=True),
        "abdomen": Part("abdomen", abdomen, VIOLET, shade=((-2, 2), (0, 2)), rim=True, cast=True),
    }
    order = ["leg_fr", "leg_fl", "arm_b", "blade_b", "mem_b", "arm_a", "blade_a", "mem_a", "thorax", "neck",
             "ant_l", "ant_r", "head", "abdomen", "leg_nl", "leg_nr"]
    arr = render([parts[n] for n in order], OL)
    paint(arr, ridge, LILAC[2], ["thorax"])
    for x in (14, 18.5, 23):
        paint(arr, sd_chain([(x - 1.5, 40 + (x - 14) * 0.35), (x + 0.5, 45), (x + 1, 50)], [0.5] * 3) < 0, VIOLET[2], ["abdomen"])
    for name, m in (("mem_a", mem_a), ("mem_b", mem_b)):
        paint(arr, m & ~shifted(m, 0, -1) & shifted(m, 0, 1), MINT[0], [name])
    return arr


def draw(side: str):
    if side == "back":
        return despeckle(_back()), None
    arr, eyes = _front()
    return despeckle(arr), eyes
