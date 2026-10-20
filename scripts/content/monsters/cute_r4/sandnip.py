"""sandnip 스콜피 — baby desert scorpion (→ dunestalk → miragespike).

Round 7 (Argon review of round 6: cyclops faceplate, wrench claws, balloon bulb, mirrored back). Same palette,
rust banding, segmented tail and dark outline as dunestalk. Front: a side profile facing left — big round sandy
head-body, cream cheek/muzzle on the front edge with the eye near it and a small mouth in front-below, plump
mitten pincers with a small V notch (far one tucked above/behind the near one), rust plates on the rear of the
dome, stout legs, a thick segmented tail curling over the back into a faceted rose crystal. Back: drawn on its
own — seen from behind facing away up-right, plates banding the dome, head end foreshortened, pincers peeking.
"""
import math

from .kit import *  # noqa: F401,F403
from .kit import paint

OL = "#501307"
SAND = ("#fbc880", "#f8a33d", "#dc792c", "#a53d1f")
FARR = ("#f8a33d", "#dc792c", "#a53d1f", "#742113")
RUST = ("#dc792c", "#c85828", "#a53d1f", "#742113")
CREAM = ("#fff4dc", "#fde4b8", "#fbc880")
DARK = "#742113"
GLINT = "#fefdfc"
PINK = ("#fbcfd5", "#f89aa9", "#ed5e74", "#d93456")

NEAR_CMAP = {"O": OL, "L": SAND[0], "B": SAND[1], "S": SAND[2], "D": SAND[3], "T": DARK}
FAR_CMAP = {"O": OL, "L": SAND[1], "B": SAND[2], "S": SAND[3], "D": DARK, "T": DARK}
PINK_CMAP = {"O": OL, "W": GLINT, "A": PINK[0], "B": PINK[1], "C": PINK[2], "D": PINK[3]}

# rose crystal: a light crown facet (upper-left) cut off by a crisp darker facet edge, pavilion below, dark side right
BULB = [
    "....OOOOOOO.....",
    "...OAAAAAABOO...",
    "..OAWWAAAAABBO..",
    ".OAWWAAAAAACBBO.",
    "OAAAAAAAAACBBBCO",
    "OAAAAAAAACBBBBCO",
    "OBAAAAAACBBBBCCO",
    "OBBCCCCCBBBBACCO",
    "OBBBBBBBBBBACCDO",
    "OBBBBBBBBBACCCDO",
    "OCBBBBBBBBACCDDO",
    ".OCBBBBBBACCDDO.",
    "..OCCBBBACCDDO..",
    "...OOCCCCDDOO...",
    ".....OOOOOO.....",
]
NEAR_CLAW = [  # plump rounded mitten, small V notch at the front tip, dark finger tips
    "...OOOOO....",
    ".OOLLLLBOO..",
    "OLLLBBBBBSO.",
    "OLBBBBBBBBSO",
    "OTDBBBBBBBSO",
    ".OODBBBBBBSO",
    "..OODBBBBBSO",
    ".OODBBBBBSSO",
    "OTDBBBBBBSSO",
    "OSBBBBBBSSDO",
    ".OSSSSSSSDO.",
    "..OOOOOOOO..",
]
FAR_CLAW = [
    "..OOOOO..",
    ".OLLBBBO.",
    "OLBBBBBSO",
    "OTDBBBBSO",
    ".OODBBBSO",
    "OTDBBBSSO",
    "OSSSSSSDO",
    ".OOOOOOO.",
]
MITT_BACK = [  # a pincer seen from its back (notch faces away)
    "..OOOOO..",
    ".OLLBBBO.",
    "OLBBBBBSO",
    "OBBBBBBSO",
    "OBBBBBSSO",
    "OSBBBSSDO",
    ".OSSSSDO.",
    "..OOOOO..",
]
LEG_FRONT = [  # toe reaching forward-down
    "...OBBSO",
    "..OLBBSO",
    ".OLBBSO.",
    "OLBBSO..",
    "OBSDO...",
    "OTTO....",
    ".OO.....",
]
LEG_MID = [
    "OBBBSO",
    "OLBBSO",
    "OLBBSO",
    ".OBSDO",
    ".OBSDO",
    ".OTTO.",
    "..OO..",
]
LEG_REAR = [  # toe reaching back-down
    "OBBSO...",
    "OBBLO...",
    ".OSBBLO.",
    "..OSBBLO",
    "...ODSBO",
    "....OTTO",
    ".....OO.",
]
LEG_FAR = [  # far-side leg tip peeking between the near legs
    "OSDO",
    "OSDO",
    "OTTO",
    ".OO.",
]


def put(arr, x0, y0, rows, cmap, under=False, mirror=False):
    """Stamp hand rows at canvas (x0, y0). `under` only fills empty pixels."""
    if mirror:
        rows = [r[::-1] for r in rows]
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch == ".":
                continue
            x, y = x0 + dx, y0 + dy
            if not (0 <= x < 64 and 0 <= y < 64):
                continue
            if under and arr[y, x, 3]:
                continue
            arr[y, x, :3] = hexc(cmap[ch])
            arr[y, x, 3] = 255


def tail_parts(beads, end_a, end_b, ramp=SAND):
    parts = []
    for i, (c, r) in enumerate(beads):
        nxt = beads[i + 1][0] if i + 1 < len(beads) else end_b
        prv = beads[i - 1][0] if i else end_a
        a = math.degrees(math.atan2(nxt[1] - prv[1], nxt[0] - prv[0]))
        parts.append(Part(f"b{i}", ellipse(*c, r * 1.18, r, a), ramp, shade=((2, 2), (2, 0)), deep=((1, 1),), rim=True))
    return parts


def draw_front():
    head = ellipse(24, 45.2, 11.4, 10.6)
    # cream face on the front-lower part of the smooth dome; orange brow and crown above and behind the eye
    face = head & ellipse(14.5, 50.5, 10.2, 11.4) & ~ellipse(25, 36.2, 15, 4.4)
    ring = lambda r: ellipse(7.5, 47.5, r, r)
    top = PY < 51.5
    plates = [head & ~ring(22.4) & ring(25.8) & top, head & ~ring(25.8) & top]
    shoulder = ellipse(12.8, 55, 3.6, 2.7)  # short round shoulder joining the near mitten to the body

    beads = [((40.2, 30.6), 3.6), ((43.4, 35), 4.0), ((44.4, 40.6), 4.4), ((42, 46.2), 4.7), ((37.6, 50.2), 4.8)]
    parts = {p.name: p for p in tail_parts(beads, (35, 26), (33, 53))}
    parts["hb"] = Part("hb", head, SAND, shade=((3, 3), (1, 4), (4, 1)), deep=((1, 2),), rim=True, cast=True,
                       spot=(22.5, 37.6, 3.6, 1.3))
    for i, m in enumerate(plates):
        parts[f"dp{i}"] = Part(f"dp{i}", m, RUST, line=DARK, shade=((0, 2), (2, 1)) if i else ((0, 2),), rim=True)
    parts["face"] = Part("face", face, CREAM, sep=False, shade=((2, 2), (0, 3)))
    order = [f"b{i}" for i in range(len(beads))] + ["hb", "dp0", "dp1", "face"]
    arr = render([parts[n] for n in order], OL)
    # the pincers need room in front: everything is shifted X px right from here on
    X = 3
    arr = np.roll(arr, X, axis=1)
    put(arr, X + 5, 39, FAR_CLAW, FAR_CMAP, under=True)  # far mitten tucked against the head
    put(arr, X + 24, 16, BULB, PINK_CMAP)
    for x0 in (21, 30, 40):
        put(arr, X + x0, 57, LEG_FAR, FAR_CMAP, under=True)
    put(arr, X + 14, 55, LEG_FRONT, NEAR_CMAP)
    put(arr, X + 25, 55, LEG_MID, NEAR_CMAP)
    put(arr, X + 33, 55, LEG_REAR, NEAR_CMAP)
    over = np.roll(render([Part("shoulder", shoulder, SAND, shade=((0, 2), (1, 1)), rim=True)], OL), X, axis=1)
    m = over[:, :, 3] > 0
    arr[m] = over[m]
    put(arr, X - 2, 47, NEAR_CLAW, NEAR_CMAP)

    eye_box = eye(arr, X + 16, 41, NEAR_EYE_6x8, "#2a0804", DARK, "#c85828", white=GLINT, rim=OL)
    stamp(arr, X + 18, 51, ["D..", ".DD"], {"D": OL})
    return arr, {"anatomy": "profile", "style": "round", "near": eye_box, "far": None}


def draw_back():
    """True rear 3/4, facing away up-right: one big round sandy sphere banded by rust plates (head end at its
    upper right), tail rooted at the rear-left of the sphere arching overhead to the bulb, pincer tips and leg
    tips peeking out around it."""
    body = ellipse(35, 44.2, 13.4, 12.2)
    ring = lambda r: ellipse(48, 33, r * 1.08, r)
    # rust plate bands on the sandy sphere, with sand showing between them; the head end (upper right) stays sand
    bands = ((12.6, 15.4), (18.2, 21), (23.8, 26.6))
    plates = [body & ~ring(a) & ring(b) for a, b in bands]
    beads = [((29.6, 21.6), 3.6), ((23.6, 24.6), 4.0), ((19.4, 30), 4.4), ((19.2, 36.8), 4.8), ((22.6, 42.6), 5.2)]
    parts = [Part("body", body, SAND, shade=((3, 3), (1, 4), (4, 1)), deep=((1, 2),), rim=True, cast=True,
                  spot=(41.5, 36, 3, 1.4))]
    for i, m in enumerate(plates):
        parts.append(Part(f"dp{i}", m, RUST, line=DARK, shade=((0, 2), (2, 1)) if i == len(plates) - 1 else ((0, 2),), rim=True))
    parts += tail_parts(beads, (34, 18), (28, 48))
    arr = render(parts, OL)
    put(arr, 29, 9, BULB, PINK_CMAP)
    # pincer tips peeking past the upper right of the sphere
    put(arr, 45, 30, FAR_CLAW, FAR_CMAP, under=True, mirror=True)
    put(arr, 47, 38, MITT_BACK, FAR_CMAP, under=True)
    # rear leg tips splaying out below on both sides
    put(arr, 30, 56, LEG_FAR, FAR_CMAP, under=True)
    put(arr, 40, 56, LEG_FAR, FAR_CMAP, under=True)
    put(arr, 21, 53, LEG_FRONT, NEAR_CMAP)
    put(arr, 33, 56, LEG_MID, NEAR_CMAP)
    put(arr, 43, 53, LEG_REAR, NEAR_CMAP)
    return arr, None


def draw(side: str):
    return draw_back() if side == "back" else draw_front()
