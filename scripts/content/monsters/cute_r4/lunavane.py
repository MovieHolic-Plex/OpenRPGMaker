"""lunavane 루나만타 — legendary moon manta ray gliding through the air (stage 3, standalone).

Round 5: back to the earlier gliding pose the reviewer preferred (two crescent wing fins swept up in a wide bow,
cream underside, little curled horn-fins, whip tail trailing behind with a crescent tip), now in a side-turned
glide toward the left so only the near eye shows. Signature: gigantic crescent wings with mint star spots.
"""
from .kit import *  # noqa: F401,F403
from .kit import blob, leaf, paint, sd_chain, sd_ellipse, shifted


def star(cx, cy, r):
    m = np.zeros((64, 64), bool)
    pts = [(0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)] + ([(-2, 0), (2, 0), (0, -2), (0, 2)] if r > 1 else [])
    for x, y in pts:
        if 0 <= int(cy) + y < 64 and 0 <= int(cx) + x < 64:
            m[int(cy) + y, int(cx) + x] = True
    return m


def draw(side: str):
    v = View(side, 0.95)
    OL = "#1a0869"
    BLUE = ("#d4d2fd", "#aeacfb", "#7474f9", "#4c4ad0")
    WING = ("#c4c2fd", "#9696fa", "#6464e8", "#4c4ad0")
    FARW = ("#aeacfb", "#8282f0", "#5a58d8")
    CREAM = ("#fffff0", "#fef8d4", "#e0d8b0")
    MINT = ("#e2ffee", "#a4fbc3", "#6cd8a0")
    E, R = v.p, v.r
    flip = -1 if v.back else 1
    # one wide crescent bow of wings (old gliding pose); the far (left) tip a little lower and shorter
    up = [(3.5, 26), (9, 29.5), (17, 33.5), (29, 35), (40, 32), (50, 25), (60.5, 14.5)]
    lo = [(58.5, 24), (52, 33.5), (43, 41.5), (32, 46.5), (20, 45.5), (12, 41), (5.5, 32.5)]
    mantle = poly([E(*p) for p in up + lo])
    under = mantle & ~shifted(mantle, 0, 3) & ~shifted(mantle, 0, 2)
    wing_far = mantle & poly([E(0, 0), E(25, 0), E(25, 64), E(0, 64)])
    wing_near = mantle & ~wing_far
    under_far = under & wing_far
    under_near = under & wing_near
    body = blob(sd_ellipse(*E(19.5, 44.5), R(10), R(8)), sd_ellipse(*E(31, 47), R(8.5), R(5.4)), k=3)
    belly = (sd_ellipse(*E(26, 51.5), R(11), R(2.6)) < 0) & body
    face = (sd_ellipse(*E(15, 48), R(6.8), R(5.2)) < 0) & body
    horn_far = ellipse(*E(13, 38), R(2), R(3), v.ang(-25))
    horn_near = sd_chain([E(19.5, 38), E(17.5, 34), E(19.5, 32.5)], [R(1.6), R(1.3), R(1)]) < 0
    gem = poly([E(18.5, 33), E(20.4, 35.2), E(18.5, 37.4), E(16.6, 35.2)])
    tail = sd_chain([E(38, 49), E(45, 53), E(51, 53), E(55, 49.5)], [R(1.8), R(1.4), R(1.1), R(0.9)]) < 0
    moon = ellipse(*E(57, 46.5), R(3.6), R(3.6)) & ~ellipse(*E(58.4, 45.2), R(3), R(3))
    parts = {
        "wing_far": Part("wing_far", wing_far, FARW, sep=False, shade=((1, 2),), rim=True),
        "under_far": Part("under_far", under_far, CREAM, sep=False, shade=((0, 1),)),
        "tail": Part("tail", tail, BLUE[1:] + (BLUE[3],), shade=((0, 1),)),
        "moon": Part("moon", moon, CREAM, shade=((1, 1),)),
        "horn_far": Part("horn_far", horn_far, BLUE, shade=((1, 1),)),
        "body": Part("body", body, WING, shade=((2, 3), (1, 3)), rim=True, cast=True),
        "belly": Part("belly", belly, CREAM, sep=False, shade=((0, 1),)),
        "face": Part("face", face, CREAM, sep=False, shade=((0, 2),)),
        "wing_near": Part("wing_near", wing_near, WING, sep=False, shade=((2, 2), (1, 3)), rim=True),
        "under_near": Part("under_near", under_near, CREAM, sep=False, shade=((0, 1),)),
        "horn_near": Part("horn_near", horn_near, BLUE, shade=((1, 1),)),
        "gem": Part("gem", gem, MINT, shade=((1, 1),)),
    }
    if v.back:
        order = ["tail", "moon", "wing_far", "wing_near", "horn_far", "body"]
    else:
        order = ["tail", "moon", "wing_far", "under_far", "wing_near", "under_near", "horn_far", "body", "belly", "face", "gem"]
    arr = render([parts[n] for n in order], OL)
    # wing ribs + mint star spots
    paint(arr, sd_chain([E(37, 39.5), E(47, 32), E(56, 22)], [R(0.5)] * 3) < 0, WING[2], ["wing_near"])
    paint(arr, sd_chain([E(17, 37.5), E(11, 33.5), E(6.5, 29.5)], [R(0.5)] * 3) < 0, FARW[2], ["wing_far"])
    for (x, y, r), name in (((44, 37, 2), "wing_near"), ((53.5, 27.5, 1), "wing_near"), ((10, 32.5, 1), "wing_far")):
        paint(arr, star(*E(x, y), r), MINT[1], [name])
        c = np.zeros((64, 64), bool)
        X, Y = E(x, y)
        c[int(Y), int(X)] = True
        paint(arr, c, "#ffffff", [name])
    if v.back:  # dorsal: pale stripe down the back and a gem seen from behind
        paint(arr, sd_chain([E(16, 44.5), E(26, 43), E(36, 45.5)], [R(0.9), R(1.3), R(0.8)]) < 0, BLUE[0], ["body"])
    eyes = None
    if not v.back:
        near = eye(arr, v.ix(12.5), v.iy(40), NEAR_EYE_6x8, "#0a0838", "#3a3ab0", "#8a8af0", rim=OL)
        stamp(arr, v.ix(9), v.iy(49), ["D..", ".DD"], {"D": OL})
        stamp(arr, v.ix(16.5), v.iy(48.5), ["PP"], {"P": "#f8b0c8"})
        eyes = {"anatomy": "profile", "style": "round", "near": near, "far": None}
    return arr, eyes
