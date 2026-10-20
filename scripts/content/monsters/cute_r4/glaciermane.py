"""glaciermane 글레이팽 — final snow lynx (flurrykit → rimepelt → glaciermane).

Signature: a gigantic crown of lavender ice crystals rising from a huge fluffy white collar mane around head and
shoulders. Grown-up and bigger than rimepelt, but the face stays a round feline face with big friendly eyes, lynx
ears with star-crystal tufts (like the earlier stages) and a big fluffy tail.
"""
import math

from .kit import *  # noqa: F401,F403
from .kit import blob, leaf, leg2, paint, sd_chain, sd_ellipse, sd_poly


def diamond(E, R, base, tip, w):
    bx, by = base
    tx, ty = tip
    mx, my = bx + (tx - bx) * 0.4, by + (ty - by) * 0.4
    dx, dy = tx - bx, ty - by
    L = math.hypot(dx, dy)
    nx, ny = -dy / L * w / 2, dx / L * w / 2
    return poly([E(bx, by), E(mx + nx, my + ny), E(tx, ty), E(mx - nx, my - ny)])


def star4(cx, cy):
    m = np.zeros((64, 64), bool)
    for dx, dy in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1), (0, -2), (-2, 0), (2, 0), (0, 2)):
        x, y = int(cx) + dx, int(cy) + dy
        if 0 <= x < 64 and 0 <= y < 64:
            m[y, x] = True
    return m


def draw(side: str):
    v = View(side, 0.97)
    OL = "#091a56"
    FUR = ("#ffffff", "#d5e8fb", "#92afd9", "#6f7cb5")
    FAR = ("#d5e8fb", "#a8c2e6", "#7d92c8")
    WHITE = ("#ffffff", "#fdfdfc", "#cfdcf4")
    ICE = ("#f4ecff", "#c7a6e6", "#9a82d2", "#6f7cb5")
    E, R = v.p, v.r
    flip = -1 if v.back else 1
    head = blob(sd_ellipse(*E(19.5, 29.5), R(10), R(9)), sd_ellipse(*E(12.5, 33), R(4), R(3)), k=2.5)
    muzzle = (sd_ellipse(*E(14, 34), R(5), R(2.8)) < 0) & head
    ear_far = poly([E(11.5, 25), E(7.5, 13), E(16, 21.5)])
    ear_near = poly([E(19, 21.5), E(23, 10.5), E(27, 23)])
    # huge fluffy collar: scalloped puffs around the neck and chest
    puffs = [(9.5, 39), (12, 44), (17, 47.5), (23, 48.5), (28.5, 46), (32, 41), (33, 35), (30.5, 30)]
    ruff = blob(*[sd_ellipse(*E(x, y), R(4.2), R(3.8)) for x, y in puffs], sd_ellipse(*E(21, 40), R(10), R(7)), k=1.2)
    body = blob(sd_ellipse(*E(38, 45.5), R(11.5), R(7)), sd_ellipse(*E(30, 44), R(6), R(6.5)), k=3)
    belly = (sd_ellipse(*E(37, 51), R(9), R(2.4)) < 0) & body
    tail = blob(sd_chain([E(48, 45), E(53, 41), E(55, 34.5)], [R(3.4), R(4.6), R(5.2)]), sd_ellipse(*E(54, 33), R(5.2), R(6.4), v.ang(20)), sd_ellipse(*E(51.5, 28.5), R(3.2), R(3)), k=2.5)
    tail_tip = (sd_ellipse(*E(52.5, 27.5), R(4.6), R(4)) < 0) & tail
    # crown of ice crystals rising behind the head and over the shoulders (front-view coordinates)
    shards = [((16.5, 22), (16, 11.5), 4), ((27, 25), (30, 9.5), 5.5), ((30, 28), (38.5, 13), 6.5), ((32.5, 32), (44.5, 21), 6), ((33.5, 36.5), (47.5, 31), 4.5)]
    leg_ff = leg2(E, R, (20, 47), (19.4, 54), (18.6, 59), 5, 4.2, 6.2, paw_h=2.1)
    leg_nf = leg2(E, R, (26.5, 49), (26, 56), (25.2, 61.2), 6, 4.8, 7.2, paw_h=2.2)
    leg_fb = leg2(E, R, (42, 50), (44.5, 54.5), (43, 59), 5, 3.6, 5.4)
    haunch = ellipse(*E(45.5, 48.5), R(5.4), R(6))
    leg_nb = leg2(E, R, (47, 52), (49.5, 56.5), (48, 61.2), 6, 4.6, 7, paw_h=2.2)
    parts = {
        "leg_ff": Part("leg_ff", leg_ff, FAR, shade=((0, 2),)),
        "leg_fb": Part("leg_fb", leg_fb, FAR, shade=((0, 2),)),
        "tail": Part("tail", tail, FUR, shade=((2, 2), (0, 3)), rim=True),
        "tail_tip": Part("tail_tip", tail_tip, WHITE, sep=False, shade=((1, 1),)),
        "body": Part("body", body, FUR, shade=((3, 3), (1, 4), (4, 1)), rim=True, cast=True),
        "belly": Part("belly", belly, WHITE, sep=False, shade=((0, 1),)),
        "haunch": Part("haunch", haunch, FUR, sep=False, shade=((2, 2), (0, 2)), rim=True),
        "leg_nb": Part("leg_nb", leg_nb, FUR, sep="sides", shade=((1, 2), (0, 2))),
        "leg_nf": Part("leg_nf", leg_nf, FUR, sep="sides", shade=((1, 2), (0, 2))),
        "ear_far": Part("ear_far", ear_far, FUR, shade=((1, 1),)),
        "ruff": Part("ruff", ruff, WHITE, shade=((1, 2), (2, 1)), cast=True),
        "head": Part("head", head, FUR, shade=((3, 3), (1, 3)), rim=True, sep="below"),
        "muzzle": Part("muzzle", muzzle, WHITE, sep=False, shade=((0, 2),)),
        "ear_near": Part("ear_near", ear_near, FUR, shade=((1, 1),)),
    }
    for i, (b, t, w) in enumerate(shards):
        parts[f"shard{i}"] = Part(f"shard{i}", diamond(E, R, b, t, w), ICE, shade=((1, 0), (1, 1)), rim=True)
    sh = [f"shard{i}" for i in range(len(shards))]
    if v.back:
        order = ["leg_ff", "leg_nf", "body", "leg_fb", "haunch", "leg_nb", "ruff"] + sh + ["ear_far", "ear_near", "head", "tail", "tail_tip"]
        parts["head"].sep = False
    else:
        order = sh[::-1] + ["leg_ff", "leg_fb", "tail", "tail_tip", "body", "belly", "haunch", "leg_nb", "leg_nf", "ear_far", "ruff", "head", "muzzle", "ear_near"]
    arr = render([parts[n] for n in order], OL)
    # inner ears (front only), star-crystal ear tufts, crystal facets, a few lavender sparkles in the ruff
    if not v.back:
        paint(arr, poly([E(12.5, 23.5), E(9, 16), E(14.8, 21.5)]), ICE[1], ["ear_far"])
        paint(arr, poly([E(20.6, 21.5), E(23, 14), E(25.6, 22.5)]), ICE[1], ["ear_near"])
    # lynx ear tufts: short dark strokes rising from the ear tips
    for (x, y, dx) in ((7.5, 13, -0.6), (23, 10.5, 0.6)):
        for k in range(3):
            X, Y = E(x + dx * k, y - 1 - k)
            if 0 <= int(Y) < 64 and 0 <= int(X) < 64:
                arr[int(Y), int(X)] = (*hexc(OL), 255)
    for i, (b, t, w) in enumerate(shards):
        paint(arr, sd_chain([E(b[0] + (t[0] - b[0]) * 0.3, b[1] + (t[1] - b[1]) * 0.3), E(b[0] + (t[0] - b[0]) * 0.85, b[1] + (t[1] - b[1]) * 0.85)], [R(0.5), R(0.4)]) < 0, ICE[0], [f"shard{i}"])
    # soft lavender fur tips along the collar's lower scallops
    for x, y in ((12, 46.5), (18, 49.5), (24.5, 50), (30, 47.5)):
        paint(arr, sd_chain([E(x - 1, y - 1.2), E(x, y)], [R(0.5), R(0.5)]) < 0, ICE[1], ["ruff"])
    eyes = None
    if not v.back:
        near = eye(arr, v.ix(18), v.iy(26), NEAR_EYE_6x8, "#0a1240", "#3a5aa8", "#7aa2e0", rim=OL)
        far = eye(arr, v.ix(11), v.iy(27), FAR_EYE_3x7, "#0a1240", "#3a5aa8", "#7aa2e0", rim=OL)
        stamp(arr, v.ix(9), v.iy(32), ["NNN", ".N."], {"N": "#5a4f9a"})  # little cat nose
        stamp(arr, v.ix(11), v.iy(35), ["D.D", ".D."], {"D": OL})
        eyes = {"anatomy": "threequarter", "style": "round", "near": near, "far": far}
    return arr, eyes
