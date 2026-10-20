"""astralhart 아스트록 — legendary spirit stag (grass/ghost, stage 3, standalone).

A graceful fawn-faced stag on four slender legs (soft shoulder and hock curves): pale-green coat with a few crisp
dark-green teardrop leaves, cream muzzle/throat/chest, one ear in profile, a short cream tail. Signature: a gigantic
V-shaped crown of glowing jade spirit-wood antlers, each antler a beam with 3-4 asymmetric forked boughs, and a
pale-yellow star on every tip at varied heights.

front: profile facing left (kit convention). back: a true rear 3/4 view facing away up-right — cream-tipped tail and
rump in the lower-left foreground, the torso foreshortened toward the upper right, back of the head and neck between
both ears, both antler trees splayed left and right. The back is its own geometry, not a mirror of the front.
"""
import math

from .kit import *  # noqa: F401,F403
from .kit import blob, leaf, paint, sd_capsule, sd_chain, sd_ellipse, shifted, dilate4

OL = "#17323a"  # navy-green outline
GREEN = ("#ecf8bc", "#b8dc7e", "#80b85a", "#4e8a40")
FAR = ("#b8dc7e", "#80b85a", "#4e8a40", "#4e8a40")
LEAF = ("#2a7a46", "#185530")
CREAM = ("#fffbea", "#f4e7c2", "#d5c294")
ANT = ("#ecfbdc", "#a9dcae", "#68a98c")  # jade / sage spirit wood
ANT_LINE = "#2e6650"
STAR = "#fff38a"
NAVY = "#2c3a64"
COAT = (GREEN[1], GREEN[1], GREEN[2])  # torso: one base + one shadow tone

YY = np.arange(64)[:, None]


def _spans(d, dy=0):
    m = np.zeros((64, 64), bool)
    for y, (x0, x1) in d.items():
        m[y + dy, x0:x1 + 1] = True
    return m


def _antlers(brs):
    """Union of tapered capsules along each branch polyline (canvas coords)."""
    m = np.zeros((64, 64), bool)
    for pts, w, _ in brs:
        n = len(pts) - 1
        for i, (a, b) in enumerate(zip(pts[:-1], pts[1:])):
            wa = w - 0.3 * i / max(n, 1)
            wb = w - 0.3 * (i + 1) / max(n, 1)
            m |= sd_capsule(a, b, wa, max(0.75, wb)) < 0
    return m


def _leg(pts, ws):
    return sd_chain(pts, [w / 2 for w in ws]) < 0


def _finish(arr, tips, legs, lit):
    """Shared post-pass: jade antler line, selective lit outline, navy hooves, star tips."""
    op = arr[:, :, 3] > 0
    ant = np.zeros((64, 64), bool)
    for n in ("ant_far", "ant_near"):
        ant |= render.idm == render.names.index(n)
    rim = dilate4(ant) & ~ant & op & np.all(arr[:, :, :3] == hexc(OL), axis=2)
    arr[rim & ~dilate4((render.idm >= 0) & ~ant), :3] = hexc(ANT_LINE)
    # lit top edges of the coat get the deep green instead of navy
    lit_ids = [render.names.index(n) for n in lit if n in render.names]
    is_ol = np.all(arr[:, :, :3] == hexc(OL), axis=2) & op
    below = np.isin(np.roll(render.idm, -1, axis=0), lit_ids)
    air_above = ~np.roll(op, 1, axis=0)
    arr[is_ol & below & air_above & (render.idm < 0) & (YY < 46), :3] = hexc(GREEN[3])
    for name in legs:
        lm = render.idm == render.names.index(name)
        ys = np.nonzero(lm.any(axis=1))[0]
        if len(ys):
            arr[lm & (YY >= ys.max() - 1), :3] = hexc(NAVY)
    for tx, ty in tips:
        ix, iy = int(math.floor(tx)), int(math.floor(ty))
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            arr[iy + dy, ix + dx] = (*hexc(STAR), 255)
        arr[iy, ix] = (*hexc(CREAM[0]), 255)


def _teardrops(arr, drops, on):
    """Crisp dark-green teardrop leaves: solid fill, darker lower-right edge, no halo, only on the coat."""
    coat = np.zeros((64, 64), bool)
    for n in on:
        coat |= visible(n)
    for base, tip, w in drops:
        m = leaf(base, tip, w, fat=0.3) & coat
        arr[m, :3] = hexc(LEAF[0])
        edge = m & ~(shifted(m, 1, 0) & shifted(m, 0, 1))
        arr[edge, :3] = hexc(LEAF[1])


# ═══════════════════════════════════════════════════════════════════════════
def _front():
    D = 4  # head/neck lowered for antler headroom
    HEAD = {23: (16, 22), 24: (14, 24), 25: (13, 25), 26: (12, 26), 27: (12, 26), 28: (12, 27), 29: (12, 27),
            30: (11, 27), 31: (10, 26), 32: (9, 26), 33: (9, 26), 34: (10, 25), 35: (10, 24), 36: (12, 23),
            37: (16, 22)}
    FACE = {33: (10, 13), 34: (11, 13), 35: (11, 17), 36: (12, 20), 37: (16, 22)}
    head = _spans(HEAD, D)
    muzzle = _spans(FACE, D)
    ear = leaf((24.6, 29.0), (32.6, 25.4), 4.4, bend=-0.14, fat=0.42)
    neck = sd_chain([(29.4, 45.6), (25.8, 41.6), (23.4, 37.6)], [4.6, 3.3, 3.4]) < 0
    # curved torso: deep chest, withers, a soft dip in the back, round rump; belly tucks up toward the flank
    body = blob(sd_ellipse(27.6, 46.2, 5.0, 5.2), sd_ellipse(34.4, 45.6, 7.0, 4.0, -6),
                sd_ellipse(43.0, 45.0, 5.6, 5.0), sd_ellipse(25.8, 45.4, 3.9, 4.8, 15),
                sd_ellipse(29.6, 42.4, 3.4, 2.4), k=2.2)
    chest = ((sd_ellipse(25.0, 45.8, 3.4, 4.8, 15) < 0) & (body | neck)) | \
            ((sd_chain([(20.2, 39.2), (22.4, 42.4), (25.2, 45.4)], [1.6, 2.0, 2.6]) < 0) & neck)
    tail = blob(sd_ellipse(48.8, 42.2, 2.7, 2.0, -40), sd_ellipse(47.6, 43.8, 1.8, 1.8), k=1.2)
    tail_tip = sd_ellipse(49.6, 41.4, 1.7, 1.4, -40) < 0
    # legs: shoulder/thigh bulge at the top, knee / hock curve, slim cannon, planted hoof
    leg_ff = _leg([(29.8, 48.0), (30.2, 51.6), (29.0, 54.8), (29.8, 59.2), (29.4, 60.8), (28.6, 61.8)], [3.8, 2.8, 2.4, 1.9, 1.9, 2.1])
    leg_fb = _leg([(41.2, 47.8), (43.6, 52.6), (41.2, 57.0), (40.6, 61.6)], [4.6, 2.6, 2.0, 2.1])
    leg_nf = _leg([(25.8, 48.6), (25.2, 52.2), (23.8, 55.4), (24.8, 60.0), (24.2, 61.8), (23.2, 62.8)], [4.4, 3.0, 2.6, 2.0, 2.0, 2.2])
    leg_nb = _leg([(42.6, 48.6), (47.0, 54.0), (45.2, 58.4), (45.4, 62.6)], [5.8, 2.8, 2.1, 2.2])

    # antler crown: a V of two trees rising from the head; boughs fork outward and up, tips at varied heights
    # antler crown: two Y-forking trees (each fork splits left AND right) forming one arched canopy
    far_br = [
        ([(16.8, 27.4), (15.6, 24.2), (14.4, 21.4)], 1.55, False),
        ([(14.4, 21.4), (11.8, 19.4), (10.2, 17.8)], 1.15, False),
        ([(10.2, 17.8), (7.6, 18.8), (5.4, 20.4)], 0.85, True),
        ([(10.2, 17.8), (9.0, 14.6), (8.2, 12.4)], 0.85, True),
        ([(14.4, 21.4), (14.8, 17.8), (14.6, 15.2)], 1.1, False),
        ([(14.6, 15.2), (12.4, 12.8), (11.8, 10.4)], 0.85, True),
        ([(14.6, 15.2), (16.8, 12.8), (17.6, 10.6)], 0.85, True),
    ]
    near_br = [
        ([(21.4, 26.8), (23.4, 23.0), (25.4, 20.2)], 1.65, False),
        ([(25.4, 20.2), (24.6, 17.0), (24.2, 14.6)], 1.15, False),
        ([(24.2, 14.6), (22.0, 12.6), (21.4, 10.8)], 0.85, True),
        ([(24.2, 14.6), (26.2, 12.0), (27.0, 9.8)], 0.85, True),
        ([(25.4, 20.2), (29.2, 18.6), (32.6, 17.0)], 1.3, False),
        ([(32.6, 17.0), (33.0, 14.4), (32.4, 11.6)], 1.0, False),
        ([(32.4, 11.6), (30.6, 10.0)], 0.8, True),
        ([(32.4, 11.6), (34.6, 9.8)], 0.8, True),
        ([(32.6, 17.0), (37.2, 16.0), (40.4, 14.8)], 1.05, False),
        ([(40.4, 14.8), (40.6, 11.8), (39.4, 10.4)], 0.85, True),
        ([(40.4, 14.8), (44.0, 14.6), (46.4, 12.4)], 0.85, True),
        ([(40.4, 14.8), (44.4, 17.4), (47.0, 19.4)], 0.8, True),
    ]
    tips = [pts[-1] for pts, _, s in far_br + near_br if s]
    B = GREEN
    parts = [
        Part("ant_far", _antlers(far_br), ANT, line=ANT_LINE, shade=((1, 1),), rim=True),
        Part("leg_ff", leg_ff, FAR, shade=((1, 0), (1, 1)), sep="sides"),
        Part("leg_fb", leg_fb, FAR, shade=((1, 0), (1, 1)), sep="sides"),
        Part("tail", tail, B, shade=((1, 1),)),
        Part("tail_tip", tail_tip & tail, CREAM, sep=False, shade=((1, 1),)),
        Part("ear", ear, B, shade=((1, 1), (0, 2)), rim=True),
        Part("body", body | neck, COAT, shade=((0, 3), (2, 3))),
        Part("chest", chest, CREAM, sep=False, shade=((1, 2), (0, 3))),
        Part("leg_nb", leg_nb, B, sep="sides", shade=((1, 0), (1, 1)), rim=True),
        Part("leg_nf", leg_nf, B, sep="sides", shade=((1, 0), (1, 1)), rim=True),
        Part("head", head, B, shade=((2, 3), (0, 3)), deep=((0, 1),), rim=True, sep="below", cast=True),
        Part("muzzle", muzzle, CREAM, sep=False, shade=((0, 1),)),
        Part("ant_near", _antlers(near_br), ANT, line=ANT_LINE, shade=((1, 1),), rim=True),
    ]
    arr = render(parts, OL)
    _teardrops(arr, [((30.0, 47.6), (36.4, 43.6), 3.6), ((37.6, 49.8), (43.4, 46.6), 3.2), ((44.0, 43.6), (47.4, 47.4), 2.6)], ["body"])
    _finish(arr, tips, ("leg_ff", "leg_fb", "leg_nf", "leg_nb"), ("body", "head", "ear"))
    paint(arr, leaf((25.8, 28.4), (31.2, 26.0), 2.0, fat=0.42), CREAM[2], ["ear"])
    near = eye(arr, 16, 26 + D, NEAR_EYE_6x8, NAVY, LEAF[1], ANT[1], white=CREAM[0], rim=OL)
    # rounded muzzle tip written by hand (x7..13): small navy nose on the tip, a clean smile line curving up
    stamp(arr, 7, 33, [
        "....Olb",
        "...Ollb",
        "..ONbbb",
        ".ONNbbb",
        ".OcccOC",
        "..OOOcC",
        "...Okkc",
        "....OOk",
    ], {"O": OL, "l": GREEN[0], "b": GREEN[1], "N": NAVY, "c": CREAM[1], "C": CREAM[0], "k": CREAM[2]})
    return arr, {"anatomy": "profile", "style": "round", "near": near, "far": None}


# ═══════════════════════════════════════════════════════════════════════════
def _back():
    """Rear 3/4: rump + tail lower-left (near), torso receding up-right, head from behind with two ears."""
    rump = blob(sd_ellipse(24.4, 47.8, 8.4, 6.4), sd_ellipse(30.4, 44.6, 6.6, 5.2), k=3)
    torso = blob(sd_ellipse(35.4, 42.6, 6.6, 4.8, -20), sd_ellipse(39.6, 40.0, 4.4, 4.2), k=2.5)
    neck = sd_chain([(40.4, 40.4), (43.2, 35.6), (45.0, 31.6)], [4.2, 3.4, 3.4]) < 0
    head = blob(sd_ellipse(46.2, 28.4, 5.2, 5.0), sd_ellipse(47.4, 32.0, 3.8, 2.8), k=2)
    jaw = (sd_ellipse(50.0, 32.4, 2.2, 2.6) < 0) & head & ~shifted(head, 1, 0)
    ear_l = leaf((42.0, 26.0), (35.0, 23.2), 4.4, bend=0.12, fat=0.42)
    ear_r = leaf((50.4, 25.8), (57.2, 23.0), 4.2, bend=-0.12, fat=0.42)
    tail = blob(sd_ellipse(21.8, 42.2, 2.8, 2.4, 10), sd_ellipse(22.6, 44.6, 2.6, 2.0), k=1.2)
    tail_tip = (sd_ellipse(21.2, 41.0, 2.4, 1.8) < 0) & tail
    # hind legs (near, foreground) with the hock seen from behind; fore legs smaller and further back/up
    leg_hl = _leg([(19.6, 50.6), (18.4, 55.6), (19.0, 59.6), (18.8, 62.6)], [5.0, 3.0, 2.3, 2.4])
    leg_hr = _leg([(29.0, 50.6), (30.2, 55.6), (29.4, 59.6), (29.6, 62.6)], [5.0, 3.0, 2.3, 2.4])
    leg_fl = _leg([(36.0, 46.4), (35.6, 51.6), (34.8, 55.0), (35.4, 59.4), (35.0, 61.4)], [3.6, 2.4, 2.1, 1.9, 2.1])
    leg_fr = _leg([(41.4, 44.6), (42.0, 49.8), (41.2, 53.6), (41.8, 58.2), (41.6, 60.4)], [3.4, 2.3, 2.0, 1.8, 2.0])
    # antlers from behind: two trees splayed left and right of the head, boughs forking outward and up
    left_br = [
        ([(43.4, 23.6), (41.4, 21.0), (39.6, 18.8)], 1.55, False),
        ([(39.6, 18.8), (36.4, 17.8), (33.6, 17.2)], 1.15, False),
        ([(33.6, 17.2), (30.4, 17.8), (28.4, 19.6)], 0.85, True),
        ([(33.6, 17.2), (31.6, 14.6), (30.8, 12.0)], 0.85, True),
        ([(39.6, 18.8), (39.2, 15.6), (38.4, 13.2)], 1.05, False),
        ([(38.4, 13.2), (35.8, 11.6), (35.0, 9.8)], 0.8, True),
        ([(38.4, 13.2), (40.6, 11.2), (41.6, 9.8)], 0.8, True),
    ]
    right_br = [
        ([(48.6, 23.4), (50.4, 20.6), (52.2, 18.4)], 1.45, False),
        ([(52.2, 18.4), (51.6, 15.4), (50.4, 13.0)], 1.0, False),
        ([(50.4, 13.0), (47.8, 11.6)], 0.8, True),
        ([(50.4, 13.0), (52.6, 10.2)], 0.8, True),
        ([(52.2, 18.4), (55.6, 16.8), (57.4, 14.6)], 1.0, False),
        ([(57.4, 14.6), (56.8, 11.6)], 0.8, True),
        ([(57.4, 14.6), (60.4, 13.6)], 0.75, True),
        ([(55.6, 16.8), (58.8, 19.6)], 0.75, True),
    ]
    tips = [pts[-1] for pts, _, s in left_br + right_br if s]
    B = GREEN
    parts = [
        Part("leg_fr", leg_fr, FAR, shade=((1, 0), (1, 1)), sep="sides"),
        Part("leg_fl", leg_fl, FAR, shade=((1, 0), (1, 1)), sep="sides"),
        Part("ant_far", _antlers(right_br), ANT, line=ANT_LINE, shade=((1, 1),), rim=True),
        Part("ant_near", _antlers(left_br), ANT, line=ANT_LINE, shade=((1, 1),), rim=True),
        Part("ear_r", ear_r, B, shade=((1, 1), (0, 2)), rim=True),
        Part("ear_l", ear_l, B, shade=((1, 1), (0, 2)), rim=True),
        Part("torso", torso | neck, COAT, shade=((0, 3), (2, 3))),
        Part("head", head, COAT, shade=((0, 3), (2, 2)), rim=True, sep=False),
        Part("jaw", jaw, CREAM, sep=False, shade=((0, 1),)),
        Part("leg_hr", leg_hr, FAR, shade=((1, 0), (1, 1)), sep="sides"),
        Part("rump", rump, COAT, shade=((0, 3), (3, 2)), sep=True, cast=True),
        Part("leg_hl", leg_hl, B, shade=((1, 0), (1, 1)), sep="sides", rim=True),
        Part("tail", tail, COAT, shade=((1, 1),), sep=False),
        Part("tail_tip", tail_tip, CREAM, sep=False, shade=((1, 1),)),
    ]
    arr = render(parts, OL)
    # rump highlight: the near haunch catches the light (one light tone, upper-left)
    rv = visible("rump")
    hl = rv & (sd_ellipse(21.6, 46.0, 4.4, 2.8) < 0)
    arr[hl, :3] = hexc(GREEN[0])
    # back of the head: shadow on the right/lower side (light comes from the upper left)
    hv = visible("head")
    arr[hv & (sd_ellipse(48.6, 31.0, 4.0, 4.4) < 0) & ~np.all(arr[:, :, :3] == hexc(GREEN[3]), axis=2), :3] = hexc(GREEN[2])
    paint(arr, leaf((40.6, 25.4), (36.4, 23.8), 1.6, fat=0.42), GREEN[2], ["ear_l"])
    paint(arr, leaf((51.8, 25.2), (55.8, 23.6), 1.6, fat=0.42), GREEN[2], ["ear_r"])
    _teardrops(arr, [((27.4, 49.0), (33.2, 45.6), 3.4), ((34.0, 42.6), (39.4, 40.0), 2.8)], ["rump", "torso"])
    _finish(arr, tips, ("leg_fr", "leg_fl", "leg_hr", "leg_hl"), ("torso", "rump", "head", "ear_l", "ear_r"))
    return arr, None


def draw(side: str):
    return _back() if side == "back" else _front()
