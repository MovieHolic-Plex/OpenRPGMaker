"""solmane 솔라레온 — legendary sun lion, sitting proudly (stage 3, standalone).

Signature: a gigantic sunburst mane — a ring of alternating gold and orange flame spikes around a round face —
and a flame tuft on the tail tip. Face stays a cub-like round head with big friendly eyes.
"""
import math

from .kit import *  # noqa: F401,F403
from .kit import blob, flame_shape, leg2, paint, sd_chain, sd_ellipse


def draw(side: str):
    v = View(side, 1.0)
    OL = "#4b2007"
    GOLD = ("#fff3a0", "#fdd424", "#e5a404", "#b25029")
    ORANGE = ("#fdb040", "#fb6801", "#c84408")
    FAR = ("#fdd424", "#e5a404", "#b25029")
    CREAM = ("#fffaf0", "#fdeab8", "#e8c47e")
    E, R = v.p, v.r
    hc = (21, 27)
    head = blob(sd_ellipse(*E(*hc), R(8.4), R(7.8)), sd_ellipse(*E(15, 31), R(4.8), R(3.8)), k=2.5)
    muzzle = (sd_ellipse(*E(15.5, 32), R(5.8), R(3.2)) < 0) & head
    ear_far = ellipse(*E(15, 19.5), R(2.6), R(2.6))
    ear_near = ellipse(*E(26.5, 19), R(3), R(3))
    # mane: alternating spikes (big gold behind, smaller orange in front)
    def spikes(n, r_in, r_out, w, phase, cx, cy):
        m = np.zeros((64, 64), bool)
        for i in range(n):
            a = phase + i * 2 * math.pi / n
            ca, sa = math.cos(a), math.sin(a)
            tip = E(cx + ca * r_out, cy + sa * r_out * 0.95)
            l = E(cx + math.cos(a - w) * r_in, cy + math.sin(a - w) * r_in)
            r = E(cx + math.cos(a + w) * r_in, cy + math.sin(a + w) * r_in)
            m |= poly([l, tip, r])
        return m | ellipse(*E(cx, cy), R(r_in + 0.5), R(r_in + 0.5))
    mane_back = spikes(10, 11, 18.8, 0.38, -1.57, hc[0] + 3.5, hc[1] - 0.5)
    mane_front = spikes(10, 10.5, 15.5, 0.34, -1.57 + math.pi / 10, hc[0] + 3.5, hc[1] - 0.5)
    body = blob(sd_ellipse(*E(30, 47), R(8.5), R(10.5), v.ang(-15)), sd_ellipse(*E(38, 53.5), R(8.5), R(7)), k=3)
    chest = (sd_ellipse(*E(24.5, 44), R(4.5), R(8), v.ang(-10)) < 0) & body
    haunch = ellipse(*E(39, 53), R(7), R(7.5))
    tail = sd_chain([E(45, 58), E(51, 55), E(53.5, 49), E(52, 44)], [R(1.3), R(1.2), R(1.1), R(1)]) < 0
    tuft = flame_shape(E, R, 52, 45.5, 11, 8) | ellipse(*E(52, 42.5), R(3.6), R(3.4))
    tuft_core = flame_shape(E, R, 52, 45, 6.5, 4.5) & tuft
    leg_far = leg2(E, R, (22, 45), (20.6, 53), (20.2, 59.6), 4.8, 3.8, 6, paw_h=2.1)
    leg_near = leg2(E, R, (28, 47), (26.4, 55), (26, 61.2), 5.8, 4.6, 7.2, paw_h=2.2)
    hind_foot = ellipse(*E(41.5, 61.5), R(4.4), R(2.1))
    parts = {
        "mane_back": Part("mane_back", mane_back, GOLD, shade=((2, 2), (1, 3)), rim=True),
        "tail": Part("tail", tail, GOLD, shade=((0, 1),)),
        "tuft": Part("tuft", tuft, ORANGE, shade=((2, 1),)),
        "tuft_core": Part("tuft_core", tuft_core, ("#fffff0", "#fff3a0", "#fdd424"), sep=False, shade=((1, 1),)),
        "leg_far": Part("leg_far", leg_far, FAR, shade=((0, 2),)),
        "body": Part("body", body, GOLD, shade=((3, 3), (1, 4), (4, 1)), rim=True, cast=True),
        "chest": Part("chest", chest, CREAM, sep=False, shade=((0, 2),)),
        "haunch": Part("haunch", haunch, GOLD, sep=False, shade=((2, 2), (0, 3)), rim=True),
        "hind_foot": Part("hind_foot", hind_foot, GOLD, shade=((0, 1),)),
        "leg_near": Part("leg_near", leg_near, GOLD, sep="sides", shade=((1, 2), (0, 2))),
        "mane_front": Part("mane_front", mane_front, ORANGE, shade=((2, 2), (1, 2)), rim=True, cast=True),
        "ear_far": Part("ear_far", ear_far, GOLD, shade=((1, 1),)),
        "ear_near": Part("ear_near", ear_near, GOLD, shade=((1, 1),)),
        "head": Part("head", head, GOLD, shade=((3, 3), (1, 3)), rim=True, sep="below", cast=True),
        "muzzle": Part("muzzle", muzzle, CREAM, sep=False, shade=((0, 2),)),
    }
    if v.back:
        order = ["leg_far", "leg_near", "body", "hind_foot", "haunch", "head", "mane_back", "mane_front", "ear_far", "ear_near",
                 "tail", "tuft", "tuft_core"]
        parts["head"].sep = False
    else:
        order = ["mane_back", "tail", "tuft", "tuft_core", "leg_far", "body", "chest", "hind_foot", "haunch", "leg_near",
                 "mane_front", "ear_far", "ear_near", "head", "muzzle"]
    arr = render([parts[n] for n in order], OL)
    for name in (("ear_far", "ear_near") if not v.back else ()):
        if name in render.names:
            c = E(15, 20) if name == "ear_far" else E(26.5, 19.5)
            paint(arr, ellipse(*c, R(1.2), R(1.2)), ORANGE[1], [name])
    # flame strokes radiating through the mane (reads as fire, not a flat disc)
    cx, cy = hc[0] + 3.5, hc[1] - 0.5
    st = np.zeros((64, 64), bool)
    for i in range(10):
        a = -1.57 + (i + 0.5) * 2 * math.pi / 10
        st |= sd_chain([E(cx + math.cos(a) * 9, cy + math.sin(a) * 9), E(cx + math.cos(a) * 13.5, cy + math.sin(a) * 13)], [R(0.55), R(0.45)]) < 0
    paint(arr, st, ORANGE[2], ["mane_front"])
    paint(arr, st, GOLD[2], ["mane_back"])
    # cream toe splits on the front paws
    for name, x in (("leg_far", 20.5), ("leg_near", 26.5)):
        for dx in (-1.5, 0.5):
            m = np.zeros((64, 64), bool)
            X, Y = E(x + dx - 0.8, 61.4 if name == "leg_near" else 60)
            if 0 <= int(Y) < 64:
                m[int(Y), int(X)] = True
            paint(arr, m, GOLD[3], [name])
    eyes = None
    if not v.back:
        near = eye(arr, 21, 24, NEAR_EYE_6x8, "#2a0a02", "#8a4a10", "#d88a2a", rim=OL)
        far = eye(arr, 14, 24, FAR_EYE_3x7, "#2a0a02", "#8a4a10", "#d88a2a", rim=OL)
        stamp(arr, 11, 31, ["NN", "N."], {"N": "#b25029"})
        stamp(arr, 14, 33, ["D..D", ".DD."], {"D": OL})
        eyes = {"anatomy": "threequarter", "style": "round", "near": near, "far": far}
    return arr, eyes
