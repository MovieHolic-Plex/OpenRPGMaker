"""wickworm 루미링 — baby candle larva; signature: oversized candle flame on a curly wick (→ lanternwing → beaconmoth)."""
from .kit import *  # noqa: F401,F403
from .kit import blob, flame_shape, inner, paint, sd_capsule, sd_chain, sd_ellipse, shifted


def draw(side: str):
    v = View(side, 1.0)
    OL = "#380805"
    BUTTER = ("#fff6a0", "#fce452", "#f9b40f", "#b85f14")
    BAND = ("#d08a2a", "#b85f14", "#8a3a0c")
    CREAM = ("#fffdf0", "#fdf4bd", "#ecd690")
    FLAME = ("#f9b40f", "#f54d01", "#c42a02")
    E, R = v.p, v.r
    head = blob(sd_ellipse(*E(20, 46.5), R(11.6), R(10.6)), k=1)
    segs = [((30.5, 53.5), 7.2), ((38, 55), 6.4), ((44.5, 54.5), 5.5), ((49, 50.5), 4.5)]
    body = blob(*[sd_ellipse(*E(*c), R(r), R(r * 0.95)) for c, r in segs], k=2.2)
    belly = blob(sd_ellipse(*E(31, 59.5), R(7.5), R(2.6)), sd_ellipse(*E(39, 60.3), R(5.5), R(2.2)), sd_ellipse(*E(45.5, 59.4), R(4), R(1.8)), k=2) & body
    wick = sd_chain([E(20.5, 37.5), E(23.8, 36), E(23.8, 33.8), E(21, 33.2), E(21.4, 31), E(23.8, 29.5)], [R(1.1), R(1.0), R(0.95), R(0.9), R(0.9), R(0.85)]) < 0
    flame = (flame_shape(E, R, 24, 29.6, 19, 16) | ellipse(*E(24, 23), R(7.8), R(6.4)))
    core = flame_shape(E, R, 24, 29.2, 12, 9) & flame
    prolegs = [capsule(E(x, 58.8), E(x - 0.3, 61.3), R(1.5), R(1.3)) for x in (27, 34, 40.5, 46)]
    parts = {f"pro{i}": Part(f"pro{i}", m, BUTTER, shade=((0, 1),)) for i, m in enumerate(prolegs)}
    parts.update({
        "body": Part("body", body, BUTTER, shade=((2, 2), (0, 3)), rim=True, cast=True),
        "belly": Part("belly", belly, CREAM, sep=False, shade=((0, 1),)),
        "head": Part("head", head, BUTTER, shade=((3, 3), (1, 4), (4, 1)), rim=True, sep="down", cast=True),
        "wick": Part("wick", wick, BAND, shade=((1, 1),)),
        "flame": Part("flame", flame, FLAME, sep=False, shade=((2, 1), (1, 2))),
        "core": Part("core", core, ("#fffff0", "#fffe57", "#f9b40f"), sep=False, shade=((1, 2),)),
    })
    pro = [f"pro{i}" for i in range(4)]
    if v.back:
        order = pro + ["head", "wick", "flame", "core", "body"]
    else:
        order = pro + ["body", "belly", "head", "wick", "flame", "core"]
    arr = render([parts[n] for n in order], OL)
    # brown bands that wrap around each segment (curved toward the viewer)
    for (cx, cy), r in segs[:3]:
        x0 = cx + r * 0.5
        pts = [E(x0 + 0.4, cy - r * 0.95), E(x0 - 1.4, cy - r * 0.35), E(x0 - 1.8, cy + r * 0.25), E(x0 - 0.6, cy + r * 0.85)]
        paint(arr, sd_chain(pts, [R(1.1)] * 4) < 0, BAND[1], ["body"])
    eyes = None
    if not v.back:
        near = eye(arr, 15, 42, NEAR_EYE_6x8, "#2a0804", "#7a3a10", "#c07a2c", rim=OL)
        stamp(arr, 10, 52, ["D...", ".DTD"], {"D": OL, "T": "#f0606a"})
        eyes = {"anatomy": "profile", "style": "round", "near": near, "far": None}
    return arr, eyes
