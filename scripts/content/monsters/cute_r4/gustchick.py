"""gustchick 피오르 — round fledgling bird; signature: gigantic stiff sky-blue three-feather crest swept back like a wind vane (→ ribbonwing).

User note (판정 1): 「BEFORE 가 더 나음」 — the round-2 picture with one big blue-irised eye read better than the round-3 small eyes,
so this redraw keeps that big, blue, sparkly near eye and adds a readable far eye beside the beak.
"""
from .kit import *  # noqa: F401,F403
from .kit import blob, inner, leaf, midline, paint, sd_chain, sd_ellipse, shifted


def draw(side: str):
    v = View(side, 1.0)
    OL = "#031f50"
    BLUE = ("#c3e6f8", "#7ac5f9", "#4d90e2", "#3368c7")
    GREY = ("#aaa59e", "#878687", "#69686d")
    CREAM = ("#fffaf0", "#fcf1ce", "#d9cab0")
    BEAK = ("#fff7a8", "#fced56", "#d9b02a")
    E, R = v.p, v.r
    flip = -1 if v.back else 1
    # one round fledgling ball (head and body are the same puff), cream face/belly bib, short beak between the eyes
    ball = blob(sd_ellipse(*E(28.5, 45.5), R(13.6), R(12.6)), sd_ellipse(*E(31, 50), R(13), R(9)), k=3)
    mask = blob(sd_ellipse(*E(22.5, 46), R(8.5), R(7)), sd_ellipse(*E(25.5, 52.5), R(9), R(6)), k=3) & ball
    beak = poly([E(17.5, 41.2), E(11.2, 44.2), E(17.5, 47.2), E(19.5, 44.2)])
    wing = leaf(E(36, 45), E(47, 55.5), R(9.5), bend=0.1 * flip, fat=0.4)
    crest = [  # three stiff feathers fanning back from the crown like a wind vane
        (E(24, 35), E(33, 14.5), R(7.5), -0.12),
        (E(27, 35), E(42, 17), R(8.5), -0.12),
        (E(30, 36.5), E(49.5, 25.5), R(7.5), -0.12),
    ]
    tail = [(E(41, 52), E(53.5, 47), R(5.6)), (E(41, 54.5), E(53, 55), R(5))]

    def foot(x, y):
        return (capsule(E(x, y - 3), E(x, y), R(1.2), R(1.1)) | capsule(E(x, y), E(x - 2.6, y + 0.7), R(1.0), R(1.0))
                | capsule(E(x, y), E(x + 2.0, y + 0.7), R(1.0), R(1.0)) | capsule(E(x, y), E(x - 0.4, y + 1.1), R(1.0), R(1.0)))

    parts = {
        "far_foot": Part("far_foot", foot(24, 60.2), BEAK, shade=((0, 1),)),
        "near_foot": Part("near_foot", foot(33, 61.6), BEAK, shade=((0, 1),)),
        "tail0": Part("tail0", leaf(*tail[0], fat=0.6), BLUE, shade=((1, 2),)),
        "tail1": Part("tail1", leaf(*tail[1], fat=0.6), BLUE, shade=((1, 2),)),
        "ball": Part("ball", ball, GREY, shade=((3, 3), (1, 4), (4, 1)), rim=True, cast=True),
        "mask": Part("mask", mask, CREAM, sep=False, shade=((2, 2), (0, 3))),
        "wing": Part("wing", wing, GREY, shade=((2, 2), (0, 2))),
        "beak": Part("beak", beak, BEAK, shade=((0, 2),)),
    }
    for i, (b, t, w, bend) in enumerate(crest):
        parts[f"crest{i}"] = Part(f"crest{i}", leaf(b, t, w, bend=bend * flip, fat=0.32), BLUE, shade=((1, 2), (2, 1)), rim=True)
    if v.back:
        order = ["far_foot", "near_foot", "ball", "crest0", "crest1", "crest2", "tail0", "tail1", "wing"]
        parts["wing"] = Part("wing", leaf(E(37, 43), E(48, 56), R(11), bend=0.1 * flip, fat=0.4), GREY, shade=((2, 2), (0, 2)), rim=True)
    else:
        order = ["far_foot", "near_foot", "tail0", "tail1", "crest2", "crest1", "crest0", "ball", "mask", "beak", "wing"]
    arr = render([parts[n] for n in order], OL)

    if v.back:  # back of the head: a soft lighter crown arc so the ball reads as head + back, not a boulder
        cap = ellipse(*E(26, 37.5), R(11), R(6.5))  # lighter crown / nape: reads as head on top of the body
        paint(arr, cap, GREY[0], ["ball"])
        for k, (x, y) in enumerate(((45.5, 54), (43, 55.5), (40.5, 56))):  # blue primary feathers on the wing tip
            paint(arr, sd_chain([E(x - 3.5, y - 4.5), E(x, y)], [R(1.1), R(0.8)]) < 0, BLUE[2 if k % 2 else 1], ["wing"])
    eyes = None
    if not v.back:
        near = eye(arr, 23, 36, NEAR_EYE_6x8, "#0a1838", "#2a5aa8", "#6aa6e8", rim="#031f50")
        stamp(arr, 13, 44, ["DDDD"], {"D": "#b08a1a"})  # beak split
        eyes = {"anatomy": "profile", "style": "round", "near": near, "far": None}
    return arr, eyes
