"""lunavane 루나만타 — legendary moon manta ray gliding toward the viewer (stage 3, standalone, frontal face).

Signature: two gigantic swept wing fins with four mint star spots, a cream crescent-moon face, a little crest gem,
curled cephalic horn-fins and a long whip tail ending in a crescent.
"""
from .kit import *  # noqa: F401,F403
from .kit import blob, leaf, paint, sd_chain, sd_ellipse, sd_poly


def star(cx, cy, r):
    m = np.zeros((64, 64), bool)
    for x, y in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)):
        m[int(cy) + y, int(cx) + x] = True
    if r > 1:
        for x, y in ((-2, 0), (2, 0), (0, -2), (0, 2)):
            m[int(cy) + y, int(cx) + x] = True
    return m


def draw(side: str):
    v = View(side, 0.96)
    OL = "#1a0869"
    BLUE = ("#d4d2fd", "#aeacfb", "#7474f9", "#4c4ad0")
    WING = ("#c4c2fd", "#9696fa", "#6464e8", "#4c4ad0")
    CREAM = ("#fffff0", "#fef8d4", "#e0d8b0")
    MINT = ("#e2ffee", "#a4fbc3", "#6cd8a0")
    E, R = v.p, v.r
    back = v.back
    # one broad manta mantle: the wing fins and the body are a single smooth disc (no seam), wing tips raised
    mantle = blob(sd_poly([E(4.5, 20.5), E(13, 25), E(23, 28.5), E(32, 29.5), E(41, 28.5), E(51, 25), E(59.5, 20.5),
                           E(56, 28), E(49, 37), E(40, 46), E(32, 50.5), E(24, 46), E(15, 37), E(8, 28)]),
                  sd_ellipse(*E(32, 40), R(11.5), R(10.5)), k=3)
    body = mantle
    face = (sd_ellipse(*E(32, 42), R(9), R(7)) < 0) & mantle
    wing_l = np.zeros((64, 64), bool)
    wing_r = np.zeros((64, 64), bool)
    horn_l = sd_chain([E(27, 31.5), E(24, 26.5), E(26.5, 23)], [R(1.6), R(1.3), R(1.1)]) < 0
    horn_r = sd_chain([E(37, 31.5), E(40, 26.5), E(37.5, 23)], [R(1.6), R(1.3), R(1.1)]) < 0
    gem = poly([E(32, 28), E(34.5, 31), E(32, 34), E(29.5, 31)])
    tail = sd_chain([E(32, 50), E(33.5, 56.5), E(39, 60.5), E(46, 59)], [R(1.6), R(1.3), R(1.1), R(0.9)]) < 0
    moon = ellipse(*E(48.5, 56.5), R(3.6), R(3.6)) & ~ellipse(*E(47, 55.2), R(3), R(3))
    parts = {
        "tail": Part("tail", tail, BLUE[1:] + (BLUE[3],), shade=((0, 1),)),
        "moon": Part("moon", moon, CREAM, shade=((1, 1),)),
        "wing_l": Part("wing_l", wing_l, WING, shade=((2, 2), (1, 3)), rim=True, cast=True),
        "wing_r": Part("wing_r", wing_r, WING, shade=((2, 2), (1, 3)), rim=True, cast=True),
        "horn_l": Part("horn_l", horn_l, BLUE, shade=((1, 1),)),
        "horn_r": Part("horn_r", horn_r, BLUE, shade=((1, 1),)),
        "body": Part("body", body, WING, sep=False, shade=((2, 3), (1, 3)), deep=((0, 2),), rim=True, cast=True),
        "face": Part("face", face, CREAM, sep=False, shade=((0, 2),)),
        "gem": Part("gem", gem, MINT, shade=((1, 1),)),
    }
    if back:
        order = ["horn_l", "horn_r", "body", "gem", "wing_l", "wing_r", "tail", "moon"]
        order = ["horn_l", "horn_r", "body", "tail", "moon"]
    else:
        order = ["tail", "moon", "horn_l", "horn_r", "body", "face", "gem"]
    arr = render([parts[n] for n in order], OL)
    # wing ribs + four mint star spots (two per wing)
    for pts in ([(22, 40), (14, 31), (7, 24)], [(42, 40), (50, 31), (57, 24)]):  # fin ribs
        paint(arr, sd_chain([E(*p) for p in pts], [R(0.5)] * 3) < 0, WING[2], ["body"])
    for (x, y, r), name in (((16, 35, 2), "body"), ((9.5, 27, 1), "body"), ((48, 35, 2), "body"), ((54.5, 27, 1), "body")):
        paint(arr, star(*E(x, y), r), MINT[1], [name])
        c = np.zeros((64, 64), bool)
        X, Y = E(x, y)
        c[int(Y), int(X)] = True
        paint(arr, c, "#ffffff", [name])
    if back:
        # dorsal: a pale back stripe instead of the face
        paint(arr, sd_chain([E(32, 31), E(32, 40), E(32, 49)], [R(1.2), R(1.6), R(0.8)]) < 0, BLUE[0], ["body"])
    eyes = None
    if not back:
        right = eye(arr, v.ix(34), v.iy(36.5), NEAR_EYE_6x8, "#0a0838", "#3a3ab0", "#8a8af0", rim=OL)
        left = eye(arr, v.ix(24), v.iy(36.5), NEAR_EYE_6x8, "#0a0838", "#3a3ab0", "#8a8af0", rim=OL)
        stamp(arr, v.ix(30), v.iy(46), ["D..D", ".DD."], {"D": OL})
        stamp(arr, v.ix(25), v.iy(44), ["PP"], {"P": "#f8b0c8"})
        stamp(arr, v.ix(37), v.iy(44), ["PP"], {"P": "#f8b0c8"})
        eyes = {"anatomy": "frontal", "style": "round", "near": right, "far": None, "second": left}
    return arr, eyes
