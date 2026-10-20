"""trancescythe 문사이드 — young dream mantis (dozemite → trancescythe → oraclemantis).

Signature: two huge crescent-moon scythe arms with mint membranes; curled antennae with small dream bulbs.
Taller and slimmer than dozemite, same round lilac head and sleepy-but-kind big eyes.
"""
from .kit import *  # noqa: F401,F403
from .kit import FAR_EYE_DROWSY_3x7, NEAR_EYE_DROWSY_7x8, inner, sickle, blob, eye_lid, paint, sd_chain, sd_ellipse


def crescent(E, R, c, rx, ry, ang, off):
    """Outer ellipse minus an inner ellipse pushed by `off` (front coords) — a moon-shaped blade."""
    a = ellipse(*E(*c), R(rx), R(ry), ang)
    b = ellipse(*E(c[0] + off[0], c[1] + off[1]), R(rx * 0.8), R(ry * 0.8), ang)
    return a & ~b


def crescent_inner(E, R, c, rx, ry, ang, off):
    """The membrane band along the inner (concave) edge of the same crescent."""
    return ellipse(*E(c[0] + off[0] * 0.55, c[1] + off[1] * 0.55), R(rx * 0.86), R(ry * 0.86), ang)


def draw(side: str):
    v = View(side, 0.98)
    OL = "#44076e"
    LILAC = ("#f6dcfc", "#e7b2f0", "#bd8ad8", "#885cc0")
    VIOLET = ("#c08ce0", "#8e62c8", "#6e40a8")
    MINT = ("#e2ffe6", "#aceeae", "#6cd08a")
    CREAM = ("#ffffee", "#fef7ce", "#e8dcb0")
    E, R = v.p, v.r
    head = blob(sd_ellipse(*E(24, 22.5), R(9.2), R(7.6)), sd_ellipse(*E(17.5, 26.5), R(4.4), R(3.4)), k=4)
    cheek = (sd_ellipse(*E(15, 29), R(4.2), R(2.2)) < 0) & head
    torso = blob(sd_ellipse(*E(25.5, 41), R(4.6), R(6.5), v.ang(-12)), sd_ellipse(*E(24, 35.5), R(2.8), R(3)), k=2) 
    abdomen = blob(sd_ellipse(*E(39, 46), R(10.5), R(5.8), v.ang(-28)), sd_ellipse(*E(29, 48), R(4.5), R(4.2)), k=2.5)
    chest = (sd_ellipse(*E(24, 42.5), R(2.6), R(5.2), v.ang(-12)) < 0) & torso

    def antenna(base, mid, tip):
        return sd_chain([E(*base), E(*mid), E(*tip)], [R(0.8), R(0.75), R(0.7)]) < 0

    ant_far = antenna((17.5, 16.8), (13.5, 13), (10, 12.5))
    ant_near = antenna((25.5, 16.5), (30, 12.5), (34.5, 12))
    bub_far = (E(8.5, 12.5), 2.6)
    bub_near = (E(36.5, 12), 3.0)

    # scythe arms: raised upper arm, then a big curved sickle blade sweeping down and outward to a sharp point
    arm_far = sd_chain([E(24.5, 36.5), E(16.5, 42.5)], [R(1.6), R(1.4)]) < 0
    arm_near = sd_chain([E(27.5, 38.5), E(20, 46)], [R(1.9), R(1.6)]) < 0
    blade_far = sickle(E, R, (16.5, 43), (10, 32.5), 7.5, -0.3 * (-1 if v.back else 1))
    blade_near = sickle(E, R, (20, 46.5), (12, 35.5), 9, -0.3 * (-1 if v.back else 1))
    mem_far = inner(blade_far, 1)
    mem_near = inner(blade_near, 1)

    def leg(hip, knee, foot, w=1.4):
        return sd_chain([E(*hip), E(*knee), E(*foot)], [R(w), R(w * 0.85), R(w * 0.75)]) < 0

    parts = {
        "leg_fb": Part("leg_fb", leg((35, 51), (40, 51.5), (42, 60.4)), VIOLET, shade=((0, 1),)),
        "leg_ff": Part("leg_ff", leg((28, 52), (25, 53.5), (23.5, 60.4)), VIOLET, shade=((0, 1),)),
        "leg_nb": Part("leg_nb", leg((34, 53.5), (38, 55), (39, 62), 1.7), VIOLET, shade=((0, 1),)),
        "leg_nf": Part("leg_nf", leg((30, 54), (27.5, 56), (27, 62), 1.7), VIOLET, shade=((0, 1),)),
        "ant_far": Part("ant_far", ant_far, VIOLET, shade=()),
        "ant_near": Part("ant_near", ant_near, VIOLET, shade=()),
        "bub_far": Part("bub_far", ellipse(*bub_far[0], R(bub_far[1]), R(bub_far[1])), MINT, shade=((1, 1),)),
        "bub_near": Part("bub_near", ellipse(*bub_near[0], R(bub_near[1]), R(bub_near[1])), MINT, shade=((1, 1),)),
        "arm_far": Part("arm_far", arm_far, VIOLET, shade=((0, 1),)),
        "blade_far": Part("blade_far", blade_far, LILAC[1:] + (LILAC[3],), shade=((1, 1),)),
        "mem_far": Part("mem_far", mem_far, MINT[1:] + (MINT[2],), sep=False, shade=((1, 1),)),
        "abdomen": Part("abdomen", abdomen, VIOLET, shade=((2, 2), (0, 2)), rim=True, cast=True),
        "torso": Part("torso", torso, LILAC, shade=((2, 1), (0, 2)), rim=True),
        "chest": Part("chest", chest, CREAM, sep=False, shade=((1, 1),)),
        "head": Part("head", head, LILAC, shade=((3, 3), (1, 3), (3, 1)), rim=True, sep="down", cast=True),
        "cheek": Part("cheek", cheek, CREAM, sep=False, shade=((0, 2),)),
        "arm_near": Part("arm_near", arm_near, LILAC, shade=((0, 1),)),
        "blade_near": Part("blade_near", blade_near, LILAC, shade=((1, 1), (0, 1)), rim=True),
        "mem_near": Part("mem_near", mem_near, MINT, sep=False, shade=((1, 1),)),
    }
    if v.back:
        order = ["leg_ff", "leg_nf", "arm_far", "blade_far", "mem_far", "arm_near", "blade_near", "mem_near",
                 "torso", "head", "ant_far", "ant_near", "bub_far", "bub_near", "abdomen", "leg_fb", "leg_nb"]
    else:
        order = ["leg_fb", "leg_ff", "arm_far", "blade_far", "mem_far", "ant_far", "bub_far", "abdomen", "leg_nb", "leg_nf",
                 "torso", "chest", "head", "ant_near", "bub_near", "arm_near", "blade_near", "mem_near"]
    arr = render([parts[n] for n in order], OL)
    for (c, r), name in ((bub_far, "bub_far"), (bub_near, "bub_near")):
        m = np.zeros((64, 64), bool)
        m[int(c[1] - r * 0.4), int(c[0] - r * 0.35)] = True
        paint(arr, m, "#ffffff", [name])
    # abdomen segment stripes (curved)
    for x in (35, 39.5, 43.5):
        paint(arr, sd_chain([E(x, 40.5 + (43.5 - x) * 0.5), E(x - 1.6, 46), E(x - 1.2, 50.5)], [R(0.5)] * 3) < 0, VIOLET[2], ["abdomen"])
    eyes = None
    if not v.back:
        near = eye(arr, v.ix(17), v.iy(17.5), NEAR_EYE_6x8, "#2a0848", "#6a3aa8", "#a07ad8", rim=OL)
        stamp_at(arr, (sd_ellipse(*E(17.5, 26.5), R(4.4), R(3.4)) < 0), 2, -2, ["D..", ".DD"], {"D": OL})
        eyes = {"anatomy": "profile", "style": "round", "near": near, "far": None}
    return arr, eyes
