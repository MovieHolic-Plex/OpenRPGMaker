"""astralhart 아스트록 — legendary spirit stag (grass/ghost, stage 3, standalone).

Signature: gigantic branching antlers like a little starry tree, each tip lit with a pale-yellow star; a pale-green
fawn body with dark-green leaf markings, cream face and chest, slender sturdy legs with neat hooves.
"""
import math

from .kit import *  # noqa: F401,F403
from .kit import blob, leaf, leg2, paint, sd_chain, sd_ellipse


def draw(side: str):
    v = View(side, 0.84)  # body drawn smaller so the antler crown can be gigantic
    va = View(side, 1.0)
    EA = va.p
    SC = 0.84
    hb = lambda x, y: (32 + (x - 32) * SC, 64 + (y - 64) * SC)  # body-space point -> unscaled canvas point
    OL = "#0d3422"
    GREEN = ("#e2f2b8", "#bed885", "#8bb75e", "#5e9440")
    FAR = ("#bed885", "#8bb75e", "#5e9440")
    DARK = ("#2e8a4c", "#0f5d2c", "#0b4420")
    CREAM = ("#fffaf0", "#fef3d5", "#e0d0a8")
    HOOF = ("#4e7a40", "#2e5a2c", "#1e3a1c")
    E, R = v.p, v.r
    head = blob(sd_ellipse(*E(19, 29), R(8.6), R(7.8)), sd_ellipse(*E(12.5, 33), R(4.8), R(4.2)), k=3)
    muzzle = (sd_ellipse(*E(13.5, 34), R(5.4), R(3.4)) < 0) & head
    ear_far = leaf(E(14, 25.5), E(6, 21.5), R(4.2), bend=0.1, fat=0.5)
    ear_near = leaf(E(24, 24.5), E(31.5, 20.5), R(4.6), bend=-0.1, fat=0.5)
    neck = sd_chain([E(20.5, 33), E(25, 43)], [R(4), R(4.8)]) < 0
    body = blob(sd_ellipse(*E(34, 45), R(11.5), R(6.5)), sd_ellipse(*E(26, 45), R(5.5), R(5.5)), k=3)
    chest = (sd_ellipse(*E(23.5, 45), R(4.5), R(5.5)) < 0) & (body | neck)
    tail = leaf(E(45, 41.5), E(51.5, 36), R(4), bend=0.15, fat=0.55)
    # antlers: a little tree per side. Each branch = (from, to); tips get stars.
    def tree(base, flip, L0=6.8, spread=0.5):
        segs, tips = [], []
        def br(x, y, ang, length, depth):
            x2, y2 = x + math.cos(ang) * length, y + math.sin(ang) * length
            segs.append(((x, y), (x2, y2), 1.15 if depth == 0 else (0.9 if depth == 1 else 0.7)))
            if depth >= 2:
                tips.append((x2, y2))
                return
            br(x2, y2, ang - 0.62 * flip, length * 0.82, depth + 1)
            br(x2, y2, ang + 0.5 * flip, length * 0.74, depth + 1)
        br(base[0], base[1], -math.pi / 2 - spread * flip, L0, 0)
        return segs, tips
    far_segs, far_tips = tree(hb(15.5, 22.5), 1, 7.6, 0.6)     # far antler: smaller (foreshortened)
    near_segs, near_tips = tree(hb(22.5, 22), -1, 9.0, 0.62)   # near antler: bigger

    def segs_mask(segs):
        m = np.zeros((64, 64), bool)
        for a, b, w in segs:
            m |= sd_chain([EA(*a), EA(*b)], [w * 1.1, w * 0.95]) < 0
        return m

    legs = {
        "leg_ff": leg2(E, R, (24, 47), (23, 54), (22.5, 60.4), 3.2, 2.2, 2.8),
        "leg_fb": leg2(E, R, (41.5, 46), (43.5, 53), (42, 60.4), 3.6, 2.2, 2.8),
        "leg_nf": leg2(E, R, (28.5, 48), (28, 55.5), (27.5, 62), 3.6, 2.5, 3.2),
        "leg_nb": leg2(E, R, (38, 47), (40.5, 55), (38.5, 62), 4.4, 2.5, 3.2),
    }
    parts = {
        "ant_far": Part("ant_far", segs_mask(far_segs), DARK, shade=()),
        "leg_ff": Part("leg_ff", legs["leg_ff"], FAR, shade=((0, 1),)),
        "leg_fb": Part("leg_fb", legs["leg_fb"], FAR, shade=((0, 1),)),
        "tail": Part("tail", tail, CREAM, shade=((1, 1),)),
        "ear_far": Part("ear_far", ear_far, GREEN, shade=((1, 1),)),
        "body": Part("body", body | neck, GREEN, shade=((3, 3), (1, 3), (3, 1)), rim=True, cast=True),
        "chest": Part("chest", chest, CREAM, sep=False, shade=((0, 2),)),
        "leg_nb": Part("leg_nb", legs["leg_nb"], GREEN, sep="sides", shade=((1, 1), (0, 1))),
        "leg_nf": Part("leg_nf", legs["leg_nf"], GREEN, sep="sides", shade=((1, 1), (0, 1))),
        "head": Part("head", head, GREEN, shade=((3, 3), (1, 3)), rim=True, sep="below", cast=True),
        "muzzle": Part("muzzle", muzzle, CREAM, sep=False, shade=((0, 2),)),
        "ant_near": Part("ant_near", segs_mask(near_segs), DARK, shade=()),
        "ear_near": Part("ear_near", ear_near, GREEN, shade=((1, 1),)),
    }
    if v.back:
        order = ["leg_ff", "leg_nf", "body", "leg_fb", "leg_nb", "tail", "ear_far", "head", "ear_near", "ant_far", "ant_near"]
        parts["head"].sep = False
    else:
        order = ["ant_far", "leg_ff", "leg_fb", "tail", "ear_far", "body", "chest", "leg_nb", "leg_nf", "head", "muzzle", "ant_near", "ear_near"]
    arr = render([parts[n] for n in order], OL)
    # dark-green leaf markings on the flank and haunch
    for b, t in (((30, 43), (35, 40)), ((36, 44), (41, 41)), ((33, 48), (38, 46.5)), ((41, 47), (44.5, 44))):
        paint(arr, leaf(E(*b), E(*t), R(2.6), fat=0.5), DARK[1], ["body"])
    # inner ears + hooves
    if not v.back:
        paint(arr, leaf(E(15, 25.5), E(8, 22.5), R(2), fat=0.5), CREAM[2], ["ear_far"])
        paint(arr, leaf(E(24.5, 24.5), E(30, 21.5), R(2.2), fat=0.5), CREAM[2], ["ear_near"])
    for name, x, y in (("leg_ff", 22.5, 60), ("leg_fb", 42, 60), ("leg_nf", 27.5, 61.5), ("leg_nb", 38.5, 61.5)):
        paint(arr, ellipse(*E(x - 0.6, y + 0.4), R(2), R(1.2)), HOOF[1], [name])
    # star lights on the antler tips (drawn over the outline so they glow)
    for tx, ty in far_tips + near_tips:
        cx, cy = EA(tx, ty)
        ix, iy = int(cx), int(cy)
        for dx, dy in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)):
            if 0 <= ix + dx < 64 and 0 <= iy + dy < 64:
                arr[iy + dy, ix + dx] = (*hexc("#fdf88c"), 255) if (dx, dy) != (0, 0) else (255, 255, 240, 255)
    eyes = None
    if not v.back:
        near = eye(arr, v.ix(17.5), v.iy(26), NEAR_EYE_6x8, "#1a0c04", "#7a4214", "#d09040", rim=OL)
        stamp(arr, v.ix(8.2), v.iy(31.6), ["NN", "N."], {"N": OL})
        stamp_at(arr, muzzle, 2, -2, ["D..", ".DD"], {"D": OL})
        eyes = {"anatomy": "profile", "style": "round", "near": near, "far": None}
    return arr, eyes
