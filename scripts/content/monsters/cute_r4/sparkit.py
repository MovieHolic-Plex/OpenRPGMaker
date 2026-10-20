"""sparkit 파이린 — fire newt starter; signature: giant cracked charcoal ball tail club with a flame tuft (→ kilnclaw)."""
from .kit import *  # noqa: F401,F403
from .kit import band, blob, flame_shape, inner, leg2, paint, sd_capsule, sd_chain, sd_ellipse, sd_poly, shifted, smin, voronoi_cracks


def draw(side: str):
    v = View(side, 1.0)
    OL = "#380d04"
    ORANGE = ("#fdb24a", "#fb860c", "#da4004", "#be1f07")
    FAR = ("#fb860c", "#da4004", "#be1f07")
    CREAM = ("#fff4c4", "#fdea9b", "#ebb85c")
    COAL = ("#7a6b62", "#61534c", "#4a3931", "#3a2a24")
    FIRE = ("#fff6a0", "#fddf02", "#f86102")
    E, R = v.p, v.r
    # big round head up front, low plump sausage body, stubby legs, the club tail curls up behind on a short stem
    head = blob(sd_ellipse(*E(20.5, 39), R(11.4), R(10.6)), sd_ellipse(*E(13, 43.5), R(5.2), R(4.4)), k=3)
    body = blob(sd_capsule(E(25, 50.5), E(40, 51.5), R(6.6), R(5.6)), *( [sd_ellipse(*E(23, 48), R(6), R(5.5))] if not v.back else []), k=3)
    under = blob(sd_ellipse(*E(16, 47), R(7.5), R(2.8)), sd_capsule(E(18, 48.5), E(27, 54), R(2.6), R(3.2)), sd_ellipse(*E(34, 56), R(7.5), R(2.2)), k=3)
    tail = sd_chain([E(41, 52), E(46, 51), E(49.5, 47.5)], [R(3.6), R(3.2), R(3)]) < 0
    ball_c = (50.5, 39.5)
    ball = blob(sd_ellipse(*E(*ball_c), R(9.4), R(9)), sd_ellipse(*E(52, 43.5), R(7), R(5.5)), k=2)
    flame = (flame_shape(E, R, 49.5, 32.5, 10, 6.5) | flame_shape(E, R, 45.6, 33.5, 6.5, 4.5) | flame_shape(E, R, 54.2, 33.6, 7.5, 4.8))
    core = (flame_shape(E, R, 49.5, 32.2, 5.2, 3.4) | flame_shape(E, R, 54, 33.2, 3.6, 2.2)) & flame
    # stubby legs (5px), near pair on y≈62, far pair one step higher for 3/4 depth
    far_front = leg2(E, R, (17.5, 53), (17, 56), (16.5, 59), 4.6, 4, 6)
    near_front = leg2(E, R, (25, 54), (24.6, 57.5), (24, 60.6), 5.6, 4.8, 7)
    far_back = leg2(E, R, (36, 55), (36.5, 57), (36, 59), 4.6, 4, 5.6, toe=-0.4)
    near_back = leg2(E, R, (40.5, 55), (41, 58), (40.5, 60.6), 5.8, 4.8, 7, toe=-0.4)
    parts = {
        "far_front": Part("far_front", far_front, FAR, shade=((0, 2),)),
        "far_back": Part("far_back", far_back, FAR, shade=((0, 2),)),
        "tail": Part("tail", tail, ORANGE, shade=((0, 2), (2, 1))),
        "ball": Part("ball", ball, COAL, shade=((3, 3), (1, 4), (4, 1)), deep=((1, 1),)),
        "flame": Part("flame", flame, FIRE, shade=((1, 2),)),
        "core": Part("core", core, ("#ffffff", "#fff6a0", "#fddf02"), sep=False, shade=((0, 2),)),
        "body": Part("body", body, ORANGE, shade=((3, 3), (1, 4), (4, 1)), rim=True, cast=True),
        "under": Part("under", under & (body | head), CREAM, sep=False, shade=((0, 2),)),
        "near_back": Part("near_back", near_back, ORANGE, sep="sides", shade=((1, 2), (0, 2))),
        "head": Part("head", head, ORANGE, shade=((3, 3), (1, 4), (4, 1)), rim=True, sep="down", cast=True),
        "chin": Part("chin", under & head, CREAM, sep=False, shade=((0, 2), (2, 1))),
        "near_front": Part("near_front", near_front, ORANGE, sep="sides", shade=((1, 2), (0, 2))),
    }
    if v.back:
        # from behind: head beyond the shoulders, body and club tail closest to the viewer, no cream underside
        order = ["far_front", "far_back", "near_front", "body", "near_back", "head", "tail", "ball", "flame", "core"]
        parts["head"].sep = False
    else:
        order = ["far_front", "far_back", "tail", "ball", "flame", "core", "body", "under", "near_back", "head", "chin", "near_front"]
    arr = render([parts[n] for n in order], OL)
    # two dark-red stripes across the back (visible from both sides)
    for x0 in (31, 36.5):
        paint(arr, sd_chain([E(x0 + 0.8, 45), E(x0 - 0.2, 47.5), E(x0 + 0.4, 50)], [R(1.1), R(0.9), R(0.6)]) < 0, ORANGE[3], ["body"])
    # charcoal plates: irregular cells, each lit on its upper-left; glowing cracks between
    # irregular glowing lava fissures (three forked cracks), not a regular cell pattern
    core_ball = inner(ball, 1)
    cracks = [
        [(43.5, 36.5), (47.5, 39.5), (50.5, 38.5), (54.5, 34.5)],
        [(47.5, 39.5), (46.5, 44.5), (49, 47.5)],
        [(50.5, 38.5), (53.5, 42.5), (58, 43.5)],
        [(53.5, 42.5), (52.5, 47)],
        [(42.5, 42.5), (46.5, 44.5)],
    ]
    cr = np.zeros((64, 64), bool)
    for c in cracks:
        cr |= sd_chain([E(*q) for q in c], [R(0.55)] * len(c)) < 0
    cr &= core_ball
    glow = (shifted(cr, 0, -1) | shifted(cr, 1, 0)) & ~cr & core_ball
    arr[glow & ~visible_lines(), :3] = hexc(FIRE[2])
    arr[cr, :3] = hexc(FIRE[1])
    eyes = None
    if not v.back:
        near = eye(arr, 12, 35, NEAR_EYE_6x8, "#240802", "#7a2a10", "#c0562a", rim=OL)
        stamp(arr, 9, 45, ["D..", ".DD"], {"D": OL})
        eyes = {"anatomy": "profile", "style": "hand", "near": near, "far": None}
    return arr, eyes
