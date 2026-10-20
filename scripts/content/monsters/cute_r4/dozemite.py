"""dozemite 몽환아 — baby sleepy mantis (→ trancescythe → oraclemantis).

Signature: two very long curly antennae, each ending in a round mint-green dream bubble. Sleepy half-lidded big eyes.
"""
from .kit import *  # noqa: F401,F403
from .kit import sickle, stamp_at
import math
from .kit import FAR_EYE_DROWSY_3x7, NEAR_EYE_DROWSY_7x8, blob, eye_lid, inner, paint, sd_chain, sd_ellipse, shifted


def draw(side: str):
    v = View(side, 0.93)
    OL = "#3f0469"
    LILAC = ("#f6dcfc", "#e8b3f8", "#bb8ae0", "#885cc0")
    VIOLET = ("#c08ce0", "#8e62c8", "#6e40a8")
    MINT = ("#e2ffe6", "#a8f3ac", "#6cd08a")
    CREAM = ("#ffffee", "#fdfddc", "#e8dcb0")
    E, R = v.p, v.r
    head = blob(sd_ellipse(*E(26, 35), R(11.6), R(10.6)), sd_ellipse(*E(17.5, 40), R(4.8), R(4.2)), k=5)
    cheek = (sd_ellipse(*E(16, 42.5), R(4.6), R(2.8)) < 0) & head
    body = blob(sd_ellipse(*E(30, 53), R(8.6), R(6.8)), sd_ellipse(*E(26, 49.5), R(4.5), R(4)), k=2.5)
    belly = (sd_ellipse(*E(25.5, 53), R(4.2), R(5.5)) < 0) & body
    neck = sd_ellipse(*E(26.5, 45), R(3.5), R(3)) < 0

    def antenna(*pts):  # long arch that hooks over like a shepherd's crook, bubble hanging from the end
        return sd_chain([E(*p) for p in pts], [R(0.85)] + [R(0.75)] * (len(pts) - 1)) < 0

    def curl(cx, cy, r0, a0, turns, sgn):  # a small spiral at the antenna end
        return [(cx + math.cos(a0 + sgn * t) * r0 * (1 - t / (turns * 2 * math.pi) * 0.6), cy + math.sin(a0 + sgn * t) * r0 * (1 - t / (turns * 2 * math.pi) * 0.6)) for t in [k * 0.6 for k in range(int(turns * 2 * math.pi / 0.6) + 1)]]

    ant_far = antenna((20, 25.5), (16.5, 17), (13, 12.5), *curl(10, 12.5, 3, 0.0, 0.8, -1))
    ant_near = antenna((29, 24.5), (33.5, 16), (37.5, 11.5), *curl(40.5, 11.5, 3, math.pi, 0.8, 1))
    bub_far = (E(6.5, 17.5), 3.4)
    bub_near = (E(44.5, 17), 3.8)

    def leg(hip, knee, foot):
        return sd_chain([E(*hip), E(*knee), E(*foot)], [R(1.7), R(1.5), R(1.4)]) < 0

    legs = {
        "leg_fb": leg((32, 56), (36.5, 55), (38, 60.2)),     # far back
        "leg_ff": leg((25.5, 56), (22, 55.5), (21, 60.2)),   # far front
        "leg_nb": leg((32, 58), (36, 57.5), (37.5, 62)),     # near back
        "leg_nf": leg((26.5, 58), (23, 58), (22.5, 62)),     # near front
    }
    # two little tucked forelegs folded against the chest (baby scythes)
    arm = sd_chain([E(24.5, 46.5), E(20.5, 49), E(22, 52)], [R(1.3), R(1.2), R(1.0)]) < 0
    arm_blade = sickle(E, R, (21.5, 51.5), (25.5, 53.5), 2.4, 0.2)
    parts = {name: Part(name, m, VIOLET, shade=((0, 1),)) for name, m in legs.items()}
    parts.update({
        "ant_far": Part("ant_far", ant_far, VIOLET, shade=()),
        "ant_near": Part("ant_near", ant_near, VIOLET, shade=()),
        "bub_far": Part("bub_far", ellipse(*bub_far[0], R(bub_far[1]), R(bub_far[1])), MINT, shade=((1, 2), (2, 1))),
        "bub_near": Part("bub_near", ellipse(*bub_near[0], R(bub_near[1]), R(bub_near[1])), MINT, shade=((1, 2), (2, 1))),
        "body": Part("body", body | neck, VIOLET, shade=((2, 2), (0, 3)), rim=True, cast=True),
        "belly": Part("belly", belly, LILAC, sep=False, shade=((0, 2),)),
        "arm": Part("arm", arm | arm_blade, LILAC, shade=((0, 1),)),
        "head": Part("head", head, LILAC, shade=((3, 3), (1, 4), (4, 1)), rim=True, sep="down", cast=True),
        "cheek": Part("cheek", cheek, CREAM, sep=False, shade=((0, 2),)),
    })
    if v.back:
        order = ["leg_ff", "leg_fb", "leg_nf", "leg_nb", "body", "head", "ant_far", "ant_near", "bub_far", "bub_near"]
        parts["head"].sep = False
    else:
        order = ["leg_fb", "leg_ff", "ant_far", "bub_far", "body", "belly", "leg_nb", "leg_nf", "arm", "head", "ant_near", "bub_near"]
    arr = render([parts[n] for n in order], OL)
    # bubble shine + belly segment lines
    for (c, r), name in ((bub_far, "bub_far"), (bub_near, "bub_near")):
        m = np.zeros((64, 64), bool)
        m[int(c[1] - r * 0.45), int(c[0] - r * 0.4)] = True
        m[int(c[1] - r * 0.45) + 1, int(c[0] - r * 0.4)] = True
        m[int(c[1] - r * 0.45), int(c[0] - r * 0.4) + 1] = True
        paint(arr, m, "#ffffff", [name])
    for y in (51.5, 55) if not v.back else ():
        paint(arr, sd_chain([E(23, y), E(27.5, y + 0.8)], [R(0.5), R(0.5)]) < 0, LILAC[2], ["belly"])
    eyes = None
    if not v.back:
        near = eye_lid(arr, v.ix(18), v.iy(32.5), NEAR_EYE_DROWSY_7x8, "#2a0848", "#6a3aa8", "#a07ad8", LILAC[1], rim=OL)
        stamp_at(arr, cheek, 2, -3, ["D..", ".DD"], {"D": OL})
        eyes = {"anatomy": "profile", "style": "round", "near": near, "far": None}
    return arr, eyes
