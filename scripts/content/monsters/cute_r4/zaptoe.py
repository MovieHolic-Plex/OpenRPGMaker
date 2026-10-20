"""zaptoe 볼트온 — baby electric gecko; signature: huge coiled copper-spring tail ending in a spark orb (→ coilcrest)."""
from .kit import *  # noqa: F401,F403
from .kit import band, inner, paint, shifted


def draw(side: str):
    v = View(side, 1.0)
    OL = "#451303"
    YEL = ("#fdfc9e", "#fdce2b", "#e69e1b", "#bc5014")
    FAR = ("#fdce2b", "#e69e1b", "#bc5014")
    BELLY = ("#fffbe8", "#fefadf", "#e6cdaf")
    COPPER = ("#ea7a27", "#bc5014", "#983a0e", "#6d2e0d")
    ORB = ("#ffffff", "#fefd08", "#fdce2b")
    E, R = v.p, v.r
    head = ellipse(*E(19, 44), R(12), R(10.3)) | ellipse(*E(10.5, 48), R(5.5), R(4.4))
    jaw = ellipse(*E(12.5, 52), R(7), R(2.6)) & head
    body = ellipse(*E(34, 54.5), R(12), R(6.2)) | ellipse(*E(27, 52.5), R(6.5), R(5.5))
    belly = ellipse(*E(31, 59.5), R(9), R(2.6)) & body

    def leg(x, top, dx, w):
        foot = E(x + dx, 61.2)
        m = capsule(E(x, top), foot, R(w / 2), R(w / 2 - 0.3))
        for k in (-2.0, 0, 2.0):  # three splayed toes with round pads
            m |= capsule(foot, (foot[0] + R(k) - R(0.8), foot[1] + R(0.8)), R(0.8), R(1.15))
        return m

    tail = chain([E(44, 55.5), E(48.5, 54.5), E(50.5, 51.5)], [R(3.2), R(3), R(2.8)])
    import math as _m
    coil_back = np.zeros((64, 64), bool)
    coil_front = np.zeros((64, 64), bool)
    cx0, cy0, crx, cry, pitch, turns = 50.5, 50.5, 6.2, 2.9, 6.2, 3.75
    pts = []
    for i in range(int(turns * 24) + 1):
        t = i / 24 * 2 * _m.pi
        pts.append((cx0 + crx * _m.cos(t + _m.pi), cy0 - pitch * t / (2 * _m.pi) + cry * _m.sin(t + _m.pi) + 1.6 * _m.cos(t + _m.pi), _m.sin(t + _m.pi) > 0))
    for (x1, y1, f1), (x2, y2, f2) in zip(pts, pts[1:]):
        seg = capsule(E(x1, y1), E(x2, y2), R(1.7), R(1.7))
        if f1 and f2:
            coil_front |= seg
        else:
            coil_back |= seg
    coil_back &= ~coil_front
    orb_c = E(50.5, 22.5)
    parts = {
        "far_front": Part("far_front", leg(14, 55, -3, 3.2), FAR, shade=((0, 2),)),
        "far_back": Part("far_back", leg(39, 57, 1.5, 3.2), FAR, shade=((0, 2),)),
        "tail": Part("tail", tail, YEL, shade=((0, 2),)),
    }
    parts["coil_back"] = Part("coil_back", coil_back, COPPER[1:] + (COPPER[3],), shade=((0, 1),))
    parts["coil_front"] = Part("coil_front", coil_front, COPPER, shade=((0, 1),), rim=True)
    parts["orb"] = Part("orb", ellipse(*orb_c, R(4.6), R(4.6)), ORB, shade=((1, 1), (0, 2)), spot=(orb_c[0] - R(1), orb_c[1] - R(1), R(1.4), R(1.4)))
    parts["body"] = Part("body", body, YEL, shade=((3, 3), (0, 4), (4, 1)), spot=(*E(35, 51), R(5), R(1.2)), cast=True)
    parts["belly"] = Part("belly", belly, BELLY, sep=False, shade=((0, 1),))
    parts["near_back"] = Part("near_back", leg(45, 57, 2.5, 3.8), YEL, sep="sides", shade=((1, 2), (0, 2)))
    parts["head"] = Part("head", head, YEL, shade=((3, 3), (1, 4), (4, 1)), rim=True, cast=True)
    parts["jaw"] = Part("jaw", jaw, BELLY, sep=False, shade=((0, 2), (2, 1)))
    parts["near_front"] = Part("near_front", leg(24.5, 56, -2.5, 4), YEL, sep="sides", shade=((1, 2), (0, 2)))
    ring_names = ["coil_back", "coil_front"]
    if v.back:
        order = ["far_front", "far_back", "near_front", "body", "near_back", "head", "tail"] + ring_names + ["orb"]
        parts["head"].sep = False
    else:
        order = ["far_front", "far_back", "tail"] + ring_names + ["orb", "body", "belly", "near_back", "head", "near_front"]
    arr = render([parts[n] for n in order], OL)
    # dark brown zigzag along the back
    zig = [(27, 48.5), (30, 51), (33, 48.5), (36, 51), (39, 48.5), (42, 51), (44.5, 49.5)]
    zm = np.zeros((64, 64), bool)
    for a, b in zip(zig, zig[1:]):
        zm |= capsule(E(*a), E(*b), R(1.0), R(1.0))
    paint(arr, zm, COPPER[3], ["body"])

    # spark rays around the orb

    eyes = None
    if not v.back:
        near = eye(arr, 19, 40, NEAR_EYE_6x8, "#2a0a02", "#7a3a0e", "#c87a26", rim="#451303")
        far = eye(arr, 11, 41, FAR_EYE_3x7, "#2a0a02", "#7a3a0e", "#c87a26", rim="#451303")
        stamp(arr, 11, 49, ["D...D", ".DDD."], {"D": OL})
        eyes = {"anatomy": "threequarter", "style": "round", "near": near, "far": far}
    return arr, eyes
