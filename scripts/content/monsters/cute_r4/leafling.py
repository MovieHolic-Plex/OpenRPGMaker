"""leafling 토리프 — grass fox starter; signature: two gigantic leaf ears + acorn cap (→ frondhare)."""
from .kit import *  # noqa: F401,F403
from .kit import blob, inner, leaf, leg2, midline, paint, sd_capsule, sd_ellipse, shifted


def draw(side: str):
    v = View(side, 0.95, dx=-1)
    OL = "#0f450f"
    LIME = ("#d8ff7a", "#a3f710", "#80db0e", "#459218")
    FUR = ("#c4ec74", "#91c645", "#5f9a2a", "#266e13")
    FAR = ("#91c645", "#5f9a2a", "#266e13")
    CREAM = ("#fffbe0", "#fdf1b7", "#e3cf8a")
    NUT = ("#c47934", "#9a5521", "#613110")
    E, R = v.p, v.r
    flip = -1 if v.back else 1
    # gigantic leaf ears, each about as long as the whole body, tilted outward
    far_ear_b, far_ear_t = E(18, 33), E(5.5, 11.5)
    near_ear_b, near_ear_t = E(27.5, 32), E(46, 10.5)
    far_ear = leaf(far_ear_b, far_ear_t, R(12.5), bend=0.07 * flip, fat=0.42)
    near_ear = leaf(near_ear_b, near_ear_t, R(14), bend=-0.07 * flip, fat=0.42)
    head = blob(sd_ellipse(*E(22.5, 41.5), R(11.4), R(10.2)), sd_ellipse(*E(14, 45.5), R(4.6), R(3.6)), k=2.5)
    face = blob(sd_ellipse(*E(17.5, 47.5), R(8.5), R(4.2)), sd_ellipse(*E(27.5, 47.5), R(4.5), R(3.2)), k=2) & head
    cap = blob(sd_ellipse(*E(22.5, 32.6), R(6.6), R(3.3)), sd_ellipse(*E(23, 28.8), R(1.1), R(1.8)), k=0.8)
    body = blob(sd_ellipse(*E(35, 53.5), R(8.4), R(5), v.ang(8)), sd_ellipse(*E(28, 51.5), R(5.6), R(5.6)), k=3)
    chest = blob(sd_ellipse(*E(20.5, 51.5), R(3.4), R(3)), sd_ellipse(*E(25, 52.5), R(3.6), R(3.2)), sd_ellipse(*E(22.5, 55), R(3.2), R(2.6)), sd_ellipse(*E(23, 50.5), R(4.5), R(2)), k=0.9)
    tail_b, tail_t = E(40, 52.5), E(51, 33.5)
    tail = leaf(tail_b, tail_t, R(11.5), bend=0.1 * flip, fat=0.55)
    far_front = leg2(E, R, (19.5, 55), (19.3, 57), (19, 58.8), 4, 3.4, 5)
    near_front = leg2(E, R, (26.5, 56), (26.2, 58.5), (26, 60.6), 4.8, 4, 6)
    far_back = leg2(E, R, (36.5, 55), (37, 57), (36.8, 58.8), 4, 3.4, 5, toe=-0.3)
    near_back = leg2(E, R, (41, 55.5), (41.8, 58.3), (41.3, 60.6), 5.2, 4, 6, toe=-0.3)
    parts = {
        "far_ear": Part("far_ear", far_ear, LIME, shade=((2, 1), (1, 2))),
        "far_front": Part("far_front", far_front, FAR, shade=((0, 2),)),
        "far_back": Part("far_back", far_back, FAR, shade=((0, 2),)),
        "tail": Part("tail", tail, LIME, shade=((2, 2), (0, 3))),
        "body": Part("body", body, FUR, shade=((3, 3), (1, 4)), rim=True, cast=True),
        "near_back": Part("near_back", near_back, FUR, sep="sides", shade=((1, 2), (0, 2))),
        "chest": Part("chest", chest, CREAM, shade=((2, 2), (0, 3)), sep="below"),
        "near_front": Part("near_front", near_front, FUR, sep="sides", shade=((1, 2), (0, 2))),
        "head": Part("head", head, FUR, shade=((3, 3), (1, 4), (4, 1)), rim=True, cast=True),
        "face": Part("face", face, CREAM, sep=False, shade=((0, 2), (2, 1))),
        "near_ear": Part("near_ear", near_ear, LIME, shade=((2, 1), (1, 2))),
        "cap": Part("cap", cap, NUT, shade=((0, 2), (2, 1)), rim=True),
    }
    if v.back:
        order = ["far_front", "far_back", "head", "far_ear", "near_ear", "cap", "body", "near_back", "near_front", "tail"]
    else:
        order = ["far_ear", "far_front", "far_back", "tail", "body", "near_back", "near_front", "head", "face", "chest", "near_ear", "cap"]
    arr = render([parts[n] for n in order], OL)
    for b, t, bend, name in ((far_ear_b, far_ear_t, 0.07, "far_ear"), (near_ear_b, near_ear_t, -0.07, "near_ear"), (tail_b, tail_t, 0.12, "tail")):
        vm = np.zeros((64, 64), bool)
        for x, y in midline(b, t, bend * flip, 0.18, 0.82):
            if 0 <= x < 64 and 0 <= y < 64:
                vm[y, x] = True
        paint(arr, vm, LIME[3], [name])
    # side veins (two per leaf, angled toward the tip)
    for b, t, name in ((far_ear_b, far_ear_t, "far_ear"), (near_ear_b, near_ear_t, "near_ear")):
        for f in (0.38, 0.6):
            mx, my = b[0] + (t[0] - b[0]) * f, b[1] + (t[1] - b[1]) * f
            dx, dy = t[0] - b[0], t[1] - b[1]
            L = (dx * dx + dy * dy) ** 0.5
            nx, ny = -dy / L, dx / L
            for sgn in (-1, 1):
                ex, ey = mx + nx * sgn * 3.2 + dx / L * 2.2, my + ny * sgn * 3.2 + dy / L * 2.2
                paint(arr, capsule((mx, my), (ex, ey), 0.45, 0.45), LIME[2], [name])
    hatch = np.zeros((64, 64), bool)
    hatch[(np.add.outer(np.arange(64), np.arange(64)) % 3 == 0) & (np.subtract.outer(np.arange(64), np.arange(64)) % 2 == 0)] = True
    paint(arr, hatch & inner(cap, 1), NUT[2], ["cap"])
    rim_y = v.iy(34.6)
    paint(arr, np.zeros((64, 64), bool) | (np.arange(64)[:, None] == rim_y) & cap, NUT[0], ["cap"])
    eyes = None
    if not v.back:
        near = eye(arr, v.ix(22), v.iy(38.5), NEAR_EYE_6x8, "#1e0d04", "#6a3a14", "#b0702c", rim="#2a1404")
        far = eye(arr, v.ix(15.5), v.iy(39.5), FAR_EYE_3x7, "#1e0d04", "#6a3a14", "#b0702c", rim="#2a1404")
        stamp(arr, v.ix(10), v.iy(43), ["NN", "N."], {"N": "#3a2410"})  # nose
        stamp(arr, v.ix(13), v.iy(47.5), ["D.D", ".D."], {"D": OL})  # small fox smile
        eyes = {"anatomy": "threequarter", "style": "hand", "near": near, "far": far}
    return arr, eyes
