"""oraclemantis 오라클온 — final noble dream mantis (dozemite → trancescythe → oraclemantis).

Signature: a big mint diamond crystal on the forehead and two wide leaf-shaped sheets of light (wings) behind the
shoulders. Keeps the line's round lilac head, cream cheeks, crescent scythe arms and calm half-lidded big eyes.
"""
from .kit import *  # noqa: F401,F403
from .kit import FAR_EYE_DROWSY_3x7, NEAR_EYE_DROWSY_7x8, inner, sickle, blob, eye_lid, leaf, midline, paint, sd_chain, sd_ellipse
from .trancescythe import crescent, crescent_inner


def draw(side: str):
    v = View(side, 0.94)
    OL = "#450a6f"
    LILAC = ("#f6dcfc", "#e7b2f0", "#bd8ad8", "#885cc0")
    VIOLET = ("#c08ce0", "#8e62c8", "#6e40a8")
    MINT = ("#e2ffe6", "#a8f3ac", "#6cd08a")
    SHEET = ("#f6ffff", "#d6f4f8", "#a8dce8")
    CREAM = ("#ffffee", "#fdfddc", "#e8dcb0")
    E, R = v.p, v.r
    flip = -1 if v.back else 1
    head = blob(sd_ellipse(*E(25.5, 22), R(9.8), R(8)), sd_ellipse(*E(18.5, 26.5), R(4.6), R(3.6)), k=4)
    cheek = (sd_ellipse(*E(16, 29), R(4.4), R(2.3)) < 0) & head
    crystal = poly([E(25, 8.5), E(28.8, 12.8), E(25, 17.2), E(21.2, 12.8)])
    torso = blob(sd_ellipse(*E(28, 39.5), R(7), R(8), v.ang(-8)), sd_ellipse(*E(27, 32.5), R(4.2), R(3)), k=2)
    chest = (sd_ellipse(*E(25.5, 40.5), R(3.8), R(6), v.ang(-8)) < 0) & torso
    abdomen = blob(sd_ellipse(*E(37.5, 48), R(9), R(6.4), v.ang(-24)), sd_ellipse(*E(31, 47.5), R(5), R(5)), k=2.5)
    # sheets of light: two big leaves fanning up-right from behind the shoulders
    sheet_hi = leaf(E(31, 34), E(57, 13), R(13), bend=0.12 * flip, fat=0.42)
    sheet_lo = leaf(E(32, 37), E(58.5, 31.5), R(10), bend=0.1 * flip, fat=0.42)
    sheet_far = leaf(E(24, 34), E(6.5, 14), R(11), bend=-0.1 * flip, fat=0.42) | leaf(E(24, 36), E(5.5, 30), R(8), bend=-0.1 * flip, fat=0.42)

    def antenna(base, mid, tip):
        return sd_chain([E(*base), E(*mid), E(*tip)], [R(0.8), R(0.75), R(0.7)]) < 0

    ant_far = antenna((26, 15), (28, 10), (32, 7.5))
    ant_near = antenna((29.5, 15.5), (33, 10.5), (38, 8.5))
    bub_far = (E(11, 9.5), 2.4)
    bub_near = (E(37.5, 8.5), 2.6)

    def leg(hip, knee, foot, w=1.6):
        return sd_chain([E(*hip), E(*knee), E(*foot)], [R(w), R(w * 0.85), R(w * 0.8)]) < 0

    arm_far = sd_chain([E(25, 38), E(16, 39)], [R(1.8), R(1.5)]) < 0
    arm_near = sd_chain([E(30.5, 39), E(39, 37)], [R(2.1), R(1.8)]) < 0
    blade_far = sickle(E, R, (16, 39), (7, 54), 9, 0.42 * (-1 if v.back else 1))
    blade_near = sickle(E, R, (39, 36.5), (49, 54), 10, -0.42 * (-1 if v.back else 1))
    mem_far, mem_near = inner(blade_far, 1), inner(blade_near, 1)
    parts = {
                "sheet_hi": Part("sheet_hi", sheet_hi, SHEET, shade=((1, 2),), rim=True),
        "sheet_lo": Part("sheet_lo", sheet_lo, SHEET, shade=((1, 2),)),
        "leg_fb": Part("leg_fb", leg((35, 53), (41.5, 51), (46, 60.4)), VIOLET, shade=((0, 1),)),
        "leg_ff": Part("leg_ff", leg((28, 53), (22, 51.5), (17, 60.4)), VIOLET, shade=((0, 1),)),
        "leg_nb": Part("leg_nb", leg((34, 55), (39.5, 54), (43, 62), 1.9), VIOLET, shade=((0, 1),)),
        "leg_nf": Part("leg_nf", leg((30, 55), (25, 54), (21.5, 62), 1.9), VIOLET, shade=((0, 1),)),
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
        "crystal": Part("crystal", crystal, MINT, shade=((2, 0), (1, 1))),
        "arm_near": Part("arm_near", arm_near, LILAC, shade=((0, 1),)),
        "blade_near": Part("blade_near", blade_near, LILAC, shade=((1, 1), (0, 1)), rim=True),
        "mem_near": Part("mem_near", mem_near, MINT, sep=False, shade=((1, 1),)),
    }
    if v.back:
        order = ["leg_ff", "leg_nf", "arm_far", "blade_far", "mem_far", "arm_near", "blade_near", "mem_near", "torso",
                 "abdomen", "leg_fb", "leg_nb", "sheet_lo", "sheet_hi", "crystal", "head", "ant_far", "ant_near"]
        parts["head"].sep = False
    else:
        order = ["sheet_lo", "sheet_hi", "leg_fb", "leg_ff", "arm_far", "blade_far", "mem_far", "ant_far",
                 "abdomen", "leg_nb", "leg_nf", "torso", "chest", "head", "crystal", "ant_near",
                 "arm_near", "blade_near", "mem_near"]
    arr = render([parts[n] for n in order], OL)
    for (b, t), name in (((E(31, 34), E(57, 13)), "sheet_hi"), ((E(32, 37), E(58.5, 31.5)), "sheet_lo")):
        vm = np.zeros((64, 64), bool)
        for x, y in midline(b, t, 0.1 * flip, 0.15, 0.85):
            if 0 <= x < 64 and 0 <= y < 64:
                vm[y, x] = True
        paint(arr, vm, SHEET[0], [name])
    # crystal facet glint
    cm = np.zeros((64, 64), bool)
    cx, cy = E(24, 11.5)
    cm[int(cy), int(cx)] = True
    cm[int(cy) + 1, int(cx)] = True
    paint(arr, cm, "#ffffff", ["crystal"])
    for x in (35, 39.5, 43.5):
        paint(arr, sd_chain([E(x, 42.5 + (43.5 - x) * 0.4), E(x - 1.6, 47.5), E(x - 1.2, 52)], [R(0.5)] * 3) < 0, VIOLET[2], ["abdomen"])
    eyes = None
    if not v.back:
        near = eye(arr, v.ix(18.5), v.iy(17.5), NEAR_EYE_6x8, "#2a0848", "#6a3aa8", "#a07ad8", rim=OL)
        stamp_at(arr, (sd_ellipse(*E(18.5, 26.5), R(4.6), R(3.6)) < 0), 2, -2, ["D..", ".DD"], {"D": OL})
        eyes = {"anatomy": "profile", "style": "round", "near": near, "far": None}
    return arr, eyes
