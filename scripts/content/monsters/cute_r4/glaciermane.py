"""glaciermane 글레이팽 — final snow lynx (flurrykit → rimepelt → glaciermane).

Round 5 (사용자 「이브이 닮음」 → 실루엣·갈기 전면 교체): no round white collar puff and no bushy upturned tail.
A heavy, low-slung snow lynx in side profile (one eye): big blocky paws, lynx cheek tufts, short black-tipped
bobtail, tall tufted ears with the line's star tufts, faint lavender rosettes. Signature: a jagged glacier ridge
of lavender ice shards rising from the crown and running down the nape and shoulders like a cape of icebergs.
"""
import math

from .kit import *  # noqa: F401,F403
from .kit import blob, leg2, paint, sd_chain, sd_ellipse


def shard(E, base_a, base_b, tip):
    """Angular ice shard: a wide base edge (a-b) tapering to a tip, with a slight shoulder."""
    (ax, ay), (bx, by), (tx, ty) = base_a, base_b, tip
    mx, my = (ax + bx) / 2, (ay + by) / 2
    sx, sy = mx + (tx - mx) * 0.55, my + (ty - my) * 0.55
    return poly([E(ax, ay), E(sx + (ax - bx) * 0.22, sy + (ay - by) * 0.22), E(tx, ty), E(sx - (ax - bx) * 0.05, sy - (ay - by) * 0.05), E(bx, by)])


def draw(side: str):
    v = View(side, 0.98)
    OL = "#0b1a52"
    FUR = ("#ffffff", "#d3e6fa", "#9db6dc", "#7486bd")
    FAR = ("#c9dcf2", "#a4bce2", "#7e92c6")
    WHITE = ("#ffffff", "#f6f9ff", "#cfdcf4")
    ICE = ("#f3ecff", "#c6abeb", "#9c86d6", "#6f72bd")
    E, R = v.p, v.r
    # head in profile: round skull + forward snout
    head = blob(sd_ellipse(*E(18.5, 30), R(10.6), R(9.6)), sd_ellipse(*E(12.5, 33.5), R(4), R(3.4)), k=4)
    muzzle = (sd_ellipse(*E(11, 35.5), R(5.4), R(2.9)) < 0) & head
    cheek = poly([E(21, 32.5), E(29.5, 31), E(27, 34), E(31, 35.5), E(26.5, 37), E(27, 39.5), E(21, 38.5)])  # lynx sideburn tufts
    ear_far = poly([E(14.5, 24), E(11.5, 12.5), E(20, 21.5)])
    ear_near = poly([E(20, 22), E(23.5, 9.5), E(27.5, 23.5)])
    # heavy, low body; deep chest
    body = blob(sd_ellipse(*E(37, 45.5), R(13.5), R(7.2)), sd_ellipse(*E(27, 44.5), R(7.6), R(7.6)), k=3.5)
    chest = (sd_ellipse(*E(23.5, 47.5), R(4.6), R(5)) < 0) & body
    belly = (sd_ellipse(*E(38, 52.5), R(9.5), R(2)) < 0) & body
    bob = blob(sd_ellipse(*E(52, 42), R(4), R(3.4), v.ang(-30)), k=1)
    bob_tip = (sd_ellipse(*E(54.6, 40.2), R(2.2), R(2)) < 0) & bob
    # thick legs with big round paws
    leg_ff = leg2(E, R, (22, 49), (19.6, 54.5), (20.6, 59.4), 6.4, 5.2, 7.8, paw_h=2.3)
    leg_nf = leg2(E, R, (28, 50), (25.6, 56), (26.8, 61.4), 7.4, 6, 8.8, paw_h=2.5)
    leg_fb = leg2(E, R, (43, 50), (46.6, 54.5), (44, 59.4), 6.4, 5, 7.6, paw_h=2.3)
    haunch = ellipse(*E(46, 48), R(6.4), R(6.2))
    leg_nb = leg2(E, R, (47.5, 52), (51.4, 56.5), (48.6, 61.4), 7.4, 5.8, 8.6, paw_h=2.5)
    # glacier ridge: shards rooted on the crown, nape and shoulder line, raking back
    shards = [  # chunky faceted crystals, not quills: wide bases, short tips
        ((15.5, 23.5), (21, 22.5), (18, 12.5)),
        ((24, 24.5), (31.5, 31), (31, 10.5)),
        ((29.5, 31.5), (38.5, 38), (42, 18)),
        ((36.5, 38), (45.5, 41.5), (51, 29)),
    ]
    parts = {
        "leg_ff": Part("leg_ff", leg_ff, FAR, shade=((0, 2),)),
        "leg_fb": Part("leg_fb", leg_fb, FAR, shade=((0, 2),)),
        "bob": Part("bob", bob, FUR, shade=((1, 1),)),
        "bob_tip": Part("bob_tip", bob_tip, ("#4a5690", "#2e3a78", "#1c2660"), sep=False, shade=((1, 1),)),
        "body": Part("body", body, FUR, shade=((3, 3), (1, 4), (4, 1)), deep=((0, 5),), rim=True, cast=True),
        "chest": Part("chest", chest, WHITE, sep=False, shade=((0, 2),)),
        "belly": Part("belly", belly, WHITE, sep=False, shade=((0, 1),)),
        "haunch": Part("haunch", haunch, FUR, sep=False, shade=((2, 2), (0, 2)), rim=True),
        "leg_nb": Part("leg_nb", leg_nb, FUR, sep="sides", shade=((1, 2), (0, 2))),
        "leg_nf": Part("leg_nf", leg_nf, FUR, sep="sides", shade=((1, 2), (0, 2))),
        "ear_far": Part("ear_far", ear_far, FAR, shade=((1, 1),)),
        "cheek": Part("cheek", cheek, WHITE, sep="below", shade=((1, 1), (0, 2))),
        "head": Part("head", head, FUR, shade=((3, 3), (1, 3)), rim=True, sep="below", cast=True),
        "muzzle": Part("muzzle", muzzle, WHITE, sep=False, shade=((0, 2),)),
        "ear_near": Part("ear_near", ear_near, FUR, shade=((1, 1),)),
    }
    for i, (a, b, t) in enumerate(shards):
        parts[f"shard{i}"] = Part(f"shard{i}", shard(E, a, b, t), ICE, shade=((1, 0), (1, 1)), deep=((2, 1),), rim=True)
    sh = [f"shard{i}" for i in range(len(shards))]
    if v.back:
        order = ["leg_ff", "leg_nf", "body", "leg_fb", "haunch", "leg_nb", "bob", "bob_tip", "cheek", "head", "ear_far", "ear_near"] + sh
        parts["head"].sep = False
    else:
        order = sh[:0:-1] + ["leg_ff", "leg_fb", "bob", "bob_tip", "body", "chest", "belly", "haunch", "leg_nb", "leg_nf", "ear_far", sh[0], "head", "cheek", "muzzle", "ear_near"]
    arr = render([parts[n] for n in order], OL)
    # inner ears (front only) and star-crystal ear tufts (same motif as flurrykit / rimepelt)
    if not v.back:
        paint(arr, poly([E(21.6, 21.5), E(23.6, 13.5), E(26, 22)]), ICE[1], ["ear_near"])
    for (x, y) in ((11.5, 12.5), (23.5, 9.5)):
        X, Y = v.ix(x), v.iy(y)
        for dx, dy in ((0, 0), (0, -1), (0, -2), (0, -3), (-1, -1), (1, -1), (-2, -1), (2, -1), (-1, -2), (1, -2), (-1, 0), (1, 0)):
            if 0 <= Y + dy < 64 and 0 <= X + dx < 64:
                arr[Y + dy, X + dx] = (*hexc("#ffffff" if (dx, dy) == (0, -1) else (ICE[1] if abs(dx) + abs(dy + 1) == 2 else ICE[0])), 255)
    # crystal facet highlights
    for i, (a, b, t) in enumerate(shards):
        m = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        paint(arr, sd_chain([E(m[0] + (t[0] - m[0]) * 0.25 - 1, m[1] + (t[1] - m[1]) * 0.25), E(m[0] + (t[0] - m[0]) * 0.8 - 0.4, m[1] + (t[1] - m[1]) * 0.8)], [R(0.5), R(0.4)]) < 0, ICE[0], [f"shard{i}"])
    # faint lavender rosettes (snow-leopard spots) on the flank and haunch
    pass
    eyes = None
    if not v.back:
        near = eye(arr, v.ix(12.5), v.iy(26), NEAR_EYE_6x8, "#0a1240", "#3a5aa8", "#7aa2e0", rim=OL)
        stamp(arr, v.ix(8), v.iy(32.5), ["NN", "N."], {"N": "#5a4f9a"})  # nose at the snout tip
        stamp_at(arr, muzzle, 2, -2, ["D..", ".DD"], {"D": OL})  # small smile
        eyes = {"anatomy": "profile", "style": "round", "near": near, "far": None}
    return arr, eyes
