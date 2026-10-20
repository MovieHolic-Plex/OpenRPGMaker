"""sandnip 스콜피 — baby desert scorpion; signature: short thick curled tail ending in a round pink crystal bulb (→ dunestalk)."""
from .kit import *  # noqa: F401,F403
from .kit import band, blob, inner, leaf, leg2, paint, sd_chain, sd_ellipse, shifted


def draw(side: str):
    v = View(side, 1.0)
    OL = "#501307"
    SAND = ("#fbc880", "#f8a33d", "#dc792c", "#a53d1f")
    FAR = ("#f8a33d", "#dc792c", "#a53d1f")
    CREAM = ("#fff4dc", "#fde4b8", "#ecc48a")
    PINK = ("#fbcfd5", "#f89aa9", "#ed5e74", "#d93456")
    E, R = v.p, v.r
    body = ellipse(*E(27, 47.5), R(13.2), R(11.2)) | ellipse(*E(33, 53), R(10), R(7))
    face = ellipse(*E(21, 52), R(10), R(6.5)) & body
    # tail curls up from the rear over the back; bulb hangs above the head
    tail_pts = [E(38.5, 47), E(43.5, 42), E(45.5, 35.5), E(43.5, 29.5), E(38.5, 26.5)]
    tail = chain(tail_pts, [R(4.2), R(4), R(3.6), R(3.2), R(3)])
    bulb_c = E(33.5, 23.5)
    # faceted crystal bulb (hexagonal gem) instead of a round balloon
    gx, gy = 33.5, 23.5
    bulb = poly([E(gx - 5.5, gy - 1.5), E(gx - 2.5, gy - 6.5), E(gx + 3, gy - 6.5), E(gx + 6, gy - 1.5), E(gx + 3.5, gy + 5.5), E(gx - 3, gy + 5.5)])
    stinger = poly([E(29, 28), E(27, 31), E(31, 29.5)])

    def claw(cx, cy, r, arm_from):
        """Pincer: one round claw with an open V notch facing forward (left), on a short thick arm."""
        ball = blob(sd_ellipse(*E(cx, cy), R(r), R(r * 0.88)), sd_ellipse(*E(cx + r * 0.5, cy + r * 0.2), R(r * 0.7), R(r * 0.6)), k=1.5)
        notch = poly([E(cx + r * 0.15, cy + r * 0.05), E(cx - r - 2, cy - r * 0.62), E(cx - r - 2, cy + r * 0.5)])
        arm = sd_chain([E(*arm_from), E(cx + r * 0.6, cy + r * 0.1)], [R(2.4), R(2.2)]) < 0
        return (ball & ~notch) | arm

    near_claw = claw(10.5, 54.5, 6, (19, 55.5))
    far_claw = claw(9.5, 45.5, 4.6, (17, 49))
    legs_far = [leg2(E, R, a, b, c, 2.8, 2.2, 3.0, paw_h=1.0, toe=0.6) for a, b, c in (((30, 55), (33.5, 55.5), (35, 59.4)), ((37, 55), (41, 55.5), (43, 59.4)))]
    legs_near = [leg2(E, R, a, b, c, 3.6, 2.8, 3.6, paw_h=1.2, toe=t) for a, b, c, t in (((25, 56), (21.5, 57.5), (20.5, 61.4), -0.6), ((31, 57), (30, 59), (29.5, 61.6), 0), ((37.5, 56.5), (41.5, 58), (43, 61.4), 0.6))]
    parts = {}
    for i, m in enumerate(legs_far):  # two far legs peek out behind
        parts[f"lf{i}"] = Part(f"lf{i}", m, FAR, shade=((0, 1),))
    parts["far_claw"] = Part("far_claw", far_claw, FAR, shade=((1, 2), (0, 2)))
    parts["tail"] = Part("tail", tail, SAND, shade=((2, 1), (1, 2)), rim=True)
    parts["bulb"] = Part("bulb", bulb, PINK, shade=((2, 1), (1, 2)), rim=True)
    parts["body"] = Part("body", body, SAND, shade=((3, 3), (1, 4), (4, 1)), rim=True, cast=True)
    parts["face"] = Part("face", face, CREAM, sep=False, shade=((0, 2), (2, 1)))
    for i, m in enumerate(legs_near):
        parts[f"ln{i}"] = Part(f"ln{i}", m, SAND, sep="sides", shade=((1, 1), (0, 1)))
    parts["near_claw"] = Part("near_claw", near_claw, SAND, shade=((2, 2), (0, 3)), spot=(*E(10, 52.5), R(2), R(1)))
    lf = [f"lf{i}" for i in range(len(legs_far))]
    ln = [f"ln{i}" for i in range(len(legs_near))]
    if v.back:
        order = ["far_claw", "near_claw"] + lf + ["body"] + ln + ["tail", "bulb"]
    else:
        order = lf + ["far_claw", "tail", "bulb", "body", "face"] + ln + ["near_claw"]
    arr = render([parts[n] for n in order], OL)
    # tail segment rings
    for t0, t1 in ((tail_pts[0], tail_pts[1]), (tail_pts[1], tail_pts[2]), (tail_pts[2], tail_pts[3])):
        mx, my = (t0[0] + t1[0]) / 2, (t0[1] + t1[1]) / 2
        dx, dy = t1[0] - t0[0], t1[1] - t0[1]
        L = (dx * dx + dy * dy) ** 0.5
        nx, ny = -dy / L, dx / L
        paint(arr, capsule((mx - nx * 4, my - ny * 4), (mx + nx * 4, my + ny * 4), 0.55, 0.55), SAND[3], ["tail"])
    # crystal facet line + pincer split
    # gem facets: a light top facet and a darker lower-right facet
    paint(arr, poly([E(gx - 4, gy - 1.5), E(gx - 1.8, gy - 5), E(gx + 1.5, gy - 5), E(gx - 0.5, gy - 1.5)]), PINK[0], ["bulb"])
    paint(arr, poly([E(gx + 0.5, gy + 0.5), E(gx + 5, gy - 1), E(gx + 3, gy + 4.5), E(gx - 0.5, gy + 4.5)]), PINK[2], ["bulb"])
    
    eyes = None
    if not v.back:
        near = eye(arr, 24, 42, NEAR_EYE_6x8, "#2a0804", "#7a2e0c", "#c86a2a", rim="#501307")
        far = eye(arr, 16, 43, FAR_EYE_3x7, "#2a0804", "#7a2e0c", "#c86a2a", rim="#501307")
        stamp(arr, 19, 50, ["D..D", ".DD."], {"D": OL})
        eyes = {"anatomy": "threequarter", "style": "round", "near": near, "far": far}
    return arr, eyes
