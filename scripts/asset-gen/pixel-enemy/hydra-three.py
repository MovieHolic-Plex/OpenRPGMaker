#!/usr/bin/env python3
"""Original teal hydra: 9 native 96px battle poses.

Every cell is painted from authored integer geometry on its final grid.
Pose controls move individual joints before painting; no bitmap transforms.
The fallen body and necks have a separate drawing. No input image or model.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib
import json
import math

ROOT = Path(__file__).resolve().parents[3]
CELL = 96
GROUND = 92
POSES = ["idle_a", "idle_b", "idle_c", "windup", "move", "attack", "recover", "hit", "dead"]
PAL = {
    "o": "#172833", "d": "#253d4b", "s": "#355966", "m": "#428075",
    "g": "#68a78c", "h": "#a6ccb0", "z": "#dde0b9", "b": "#51414d",
    "c": "#83655a", "t": "#b9976f", "y": "#dbc78a", "i": "#f5e6b3",
    "w": "#fff3cf", "r": "#563143", "R": "#934d51", "p": "#cc7770",
    "q": "#e8a585", "f": "#5a3a3f", "F": "#a45a42", "a": "#d28b50",
    "A": "#eabe76", "e": "#ecb64b", "E": "#fff0a0", "v": "#596575",
}
C = {key: (*bytes.fromhex(value[1:]), 255) for key, value in PAL.items()}

# body dx/dy; each head's dx/dy/angle; foreground foot stride and lift.
RIG = {
 "idle_a": ((0, 0), (0, 0, 0), (0, 0, 0), (0, 0, 0), (0, 0), (0, 0)),
 "idle_b": ((0, 1), (0, 1, -3), (0, 1, -2), (-2, -1, -3), (0, 0), (0, 0)),
 "idle_c": ((0, 0), (1, -1, 3), (0, 0, 2), (-2, 1, 2), (0, 0), (0, 0)),
 "windup": ((-2, 2), (-5, 2, -12), (-7, 2, -15), (-9, -4, -16), (2, 0), (-2, 0)),
 "move": ((2, -1), (5, -3, 10), (2, 3, 12), (-3, 2, 10), (-3, -2), (4, 0)),
 "attack": ((3, 1), (9, 12, 24), (9, 10, 27), (-2, 8, 10), (-5, 0), (6, 0)),
 "recover": ((0, 1), (3, 5, 6), (3, 5, 10), (-3, 5, 6), (-1, 0), (2, 0)),
 "hit": ((-2, 3), (-4, 7, -18), (-7, 4, -15), (-7, 4, -20), (2, 0), (-3, 0)),
 "dead": ((0, 0), (0, 0, 0), (0, 0, 0), (0, 0, 0), (0, 0), (0, 0)),
}
HEADS = {
 "left_head": ((25, 36), 1), "central_head": ((56, 25), 2), "right_head": ((76, 49), 3),
}
FALLEN_HEADS = {
 "left_head": ((24, 75), 45), "central_head": ((44, 66), 70), "right_head": ((73, 74), 35),
}


def draw(pose):
    assert pose in POSES, pose
    im = Image.new("RGBA", (CELL, CELL))
    d = ImageDraw.Draw(im)
    body, left, center, right, hind, front = RIG[pose]
    part = "fallen"
    vertices = []

    def turned(x, y, pivot, dx, dy, angle):
        rad = math.radians(angle)
        a, b = x - pivot[0], y - pivot[1]
        return (pivot[0] + a * math.cos(rad) - b * math.sin(rad) + dx,
                pivot[1] + a * math.sin(rad) + b * math.cos(rad) + dy)

    def enabled():
        return pose != "dead" or part == "fallen" or part.endswith("_head")

    def point(x, y):
        if part.endswith("_head"):
            pivot, index = HEADS[part]
            # Windup closes the jaw; hit/dead use a smaller, relaxed jaw opening.
            hinge = {"left_head": 37, "central_head": 26, "right_head": 53}[part]
            factor = .52 if pose in ("hit", "dead") else (.7 if pose == "windup" else 1)
            if y > hinge:
                y = hinge + (y - hinge) * factor
            if pose == "dead":
                target, angle = FALLEN_HEADS[part]
                x, y = turned(x, y, pivot, target[0] - pivot[0], target[1] - pivot[1], angle)
            else:
                dx, dy, angle = RIG[pose][index]
                x, y = turned(x, y, pivot, dx, dy, angle)
        elif part.endswith("_neck"):
            head = part.replace("_neck", "_head")
            pivot, index = HEADS[head]
            dx, dy, angle = RIG[pose][index]
            anchor = {"left_neck": (68, 38), "central_neck": (68, 30), "right_neck": (76, 49)}[part]
            weight = max(0, min(1, (anchor[0] - y) / (anchor[0] - anchor[1])))
            weight = weight * weight * (3 - 2 * weight)
            tx, ty = turned(x, y, pivot, dx, dy, angle)
            x += weight * (tx - x) + (1 - weight) * body[0]
            y += weight * (ty - y) + (1 - weight) * body[1]
        elif part in ("hind_leg", "front_leg", "far_legs"):
            weight = max(0, min(1, (93 - y) / 20))
            foot = hind if part == "hind_leg" else (front if part == "front_leg" else (0, 0))
            x += body[0] * weight + foot[0] * (1 - weight)
            y += body[1] * weight + foot[1] * (1 - weight)
        elif part == "body":
            x += body[0]
            y += body[1]
        elif part == "tail":
            weight = max(0, min(1, (x - 12) / 26))
            x += body[0] * weight
            y += body[1] * weight
            if pose in ("idle_b", "move", "windup"):
                y -= 1 - weight
            if pose in ("idle_c", "attack", "hit"):
                x += 1 - weight
        # All grounded poses end on y=92; reserve three transparent rows below.
        if y >= 84:
            y = 84 + (y - 84) * 8 / 9
        out = (round(x), round(y))
        vertices.append(out)
        return out

    def poly(points, color, edge=False):
        if not enabled(): return
        points = [point(x, y) for x, y in points]
        d.polygon(points, fill=C[color])
        if edge:
            d.line(points + [points[0]], fill=C["o"], width=1)

    def line(points, color, width=1):
        if enabled():
            d.line([point(x, y) for x, y in points], fill=C[color], width=width)

    def dot(x, y, color):
        if enabled(): d.point(point(x, y), fill=C[color])

    def cluster(x, y, rows):
        for dy, row in enumerate(rows):
            for dx, color in enumerate(row):
                if color != ".": dot(x + dx, y + dy, color)

    def scales(coords, light="g", dark="s"):
        for x, y in coords:
            cluster(x, y, [light + light + ".", "." + dark + dark])

    if pose == "dead":
        # Separate collapsed tail, sprawled torso, folded limbs and three necks.
        poly([(30, 82), (24, 75), (15, 73), (8, 77), (7, 84), (12, 90),
              (24, 91), (31, 88), (32, 85), (26, 86), (18, 87), (12, 84),
              (13, 79), (18, 78), (25, 84)], "s", True)
        line([(10, 79), (10, 83), (13, 86), (18, 88), (24, 88)], "g")
        poly([(30, 75), (40, 70), (54, 71), (65, 77), (69, 83),
              (66, 89), (58, 93), (39, 93), (29, 89), (24, 84)], "m", True)
        poly([(29, 78), (39, 73), (47, 74), (48, 79), (42, 83),
              (33, 83), (28, 81)], "g")
        poly([(45, 77), (54, 75), (61, 79), (64, 85), (58, 90),
              (47, 90), (40, 86)], "c", True)
        poly([(45, 79), (53, 77), (59, 80), (60, 86), (53, 88), (46, 86)], "t")
        line([(44, 82), (51, 84), (59, 82)], "b")
        line([(46, 86), (53, 87), (60, 85)], "b")
        scales([(30, 78), (34, 74), (37, 80), (62, 79), (64, 85)], "g", "s")
        # Four small bent limbs; the nearest claws remain recognizable.
        for ox, oy in [(27, 84), (37, 86), (57, 85), (65, 87)]:
            poly([(ox, oy), (ox + 4, oy - 2), (ox + 7, oy),
                  (ox + 5, oy + 3), (ox, oy + 4), (ox - 3, oy + 2)], "s", True)
            line([(ox, oy), (ox + 3, oy - 1)], "g")
            cluster(ox - 2, oy + 2, ["ty.ty", ".i..i"])
        poly([(39, 81), (32, 79), (25, 74), (20, 73), (17, 76),
              (21, 82), (27, 85), (35, 85)], "s", True)
        line([(22, 78), (27, 81), (31, 82)], "t", 2)
        poly([(50, 80), (43, 76), (35, 70), (36, 65), (41, 63),
              (45, 67), (44, 71), (49, 75), (55, 77)], "m", True)
        line([(40, 66), (39, 69), (43, 74), (48, 78)], "t", 2)
        poly([(61, 84), (68, 81), (74, 77), (76, 72), (72, 69),
              (68, 72), (68, 77), (61, 80)], "s", True)
        line([(72, 73), (71, 77), (66, 81)], "t", 2)
    part = "tail"
    # Tail on the left, turning out of the body and curling around its hind foot.
    poly([(38, 68), (29, 63), (22, 58), (15, 56), (10, 59), (6, 66),
          (5, 75), (8, 81), (15, 86), (24, 87), (31, 84), (34, 80),
          (31, 76), (24, 79), (17, 78), (12, 74), (11, 68), (14, 64),
          (19, 64), (27, 69), (35, 76)], "s", True)
    poly([(31, 70), (21, 63), (15, 61), (11, 64), (9, 69), (9, 75),
          (13, 81), (20, 83), (27, 82), (30, 80), (28, 79), (22, 81),
          (17, 79), (11, 75), (11, 69), (14, 65), (19, 66), (27, 72)], "m")
    line([(10, 69), (10, 73), (13, 78), (18, 81), (22, 82)], "g")
    poly([(20, 79), (25, 78), (29, 77), (33, 79), (30, 82),
          (25, 84), (22, 83)], "g")
    line([(24, 79), (28, 78), (30, 79)], "h")
    poly([(28, 81), (32, 79), (36, 80), (32, 82)], "a", True)
    poly([(16, 58), (17, 51), (20, 59), (22, 60)], "F", True)
    poly([(11, 61), (9, 55), (9, 64)], "F", True)
    poly([(7, 67), (3, 63), (5, 71)], "F", True)
    line([(17, 55), (18, 58)], "A")
    scales([(15, 64), (21, 67), (25, 71), (12, 76), (16, 80)], "g", "s")

    part = "far_legs"
    # Distant legs under the barrel torso. Cooler and smaller than the foreground.
    poly([(37, 68), (42, 72), (43, 79), (40, 84), (39, 88),
          (33, 89), (30, 87), (33, 83), (34, 78), (32, 73)], "d", True)
    poly([(35, 79), (37, 80), (35, 85), (32, 87), (34, 88), (38, 86)], "s")
    poly([(64, 68), (71, 70), (73, 76), (71, 82), (75, 87),
          (74, 89), (62, 89), (59, 87), (64, 81), (63, 76)], "d", True)
    line([(66, 79), (66, 83), (63, 86)], "s")
    cluster(31, 86, ["ty", ".y"])
    cluster(62, 87, ["ty", ".y"])
    cluster(71, 87, ["ty", ".y"])

    part = "left_neck"
    # Left neck is behind the other two. Its outside contour stays visible.
    poly([(43, 69), (35, 64), (28, 57), (23, 48), (20, 42),
          (20, 36), (23, 32), (29, 32), (33, 36), (33, 41),
          (31, 45), (33, 50), (40, 56), (48, 60), (52, 67)], "s", True)
    poly([(25, 37), (29, 36), (30, 41), (28, 45), (30, 51),
          (36, 57), (44, 61), (46, 65), (40, 64), (32, 58),
          (26, 51), (23, 44)], "m")
    poly([(28, 41), (31, 41), (29, 45), (32, 52), (38, 58),
          (45, 62), (45, 65), (38, 62), (31, 56), (26, 48)], "c", True)
    poly([(29, 45), (30, 48), (33, 53), (38, 58), (43, 61),
          (42, 62), (37, 59), (30, 52), (28, 48)], "t")
    for points in [[(27, 47), (30, 47)], [(29, 51), (33, 51)],
                   [(31, 55), (35, 55)], [(35, 59), (39, 58)], [(39, 62), (42, 61)]]:
        line(points, "b")
    scales([(22, 43), (24, 49), (27, 54), (30, 58), (35, 61)], "m", "d")
    poly([(23, 48), (18, 47), (24, 53)], "F", True)
    poly([(28, 57), (22, 56), (29, 61)], "F", True)

    part = "body"
    # New low, wide torso, with a convex shoulder ridge and heavy belly plates.
    poly([(35, 62), (41, 58), (51, 59), (61, 63), (69, 68),
          (73, 75), (70, 82), (62, 87), (51, 88), (42, 86),
          (34, 81), (30, 73), (31, 66)], "m", True)
    poly([(34, 65), (42, 62), (51, 63), (55, 66), (51, 71),
          (41, 74), (33, 71)], "g")
    poly([(35, 67), (41, 65), (48, 65), (49, 67), (43, 69),
          (36, 69)], "h")
    poly([(51, 62), (61, 65), (68, 70), (70, 77), (64, 82),
          (57, 82), (60, 76), (56, 69)], "s")
    poly([(32, 72), (40, 74), (45, 79), (48, 85), (41, 83), (35, 79)], "s")
    poly([(48, 68), (55, 66), (62, 70), (65, 77), (61, 84),
          (54, 86), (48, 84), (45, 79), (45, 72)], "c", True)
    poly([(49, 69), (54, 68), (59, 71), (61, 77), (58, 82),
          (54, 83), (49, 81), (47, 76)], "t")
    poly([(49, 71), (53, 70), (56, 72), (57, 75), (52, 76),
          (48, 74)], "y")
    poly([(50, 78), (54, 78), (58, 76), (58, 80), (54, 82), (50, 80)], "y")
    line([(47, 74), (51, 76), (57, 75), (61, 73)], "b")
    line([(47, 78), (51, 79), (58, 78), (63, 76)], "b")
    line([(49, 82), (53, 83), (58, 82), (61, 80)], "b")
    line([(49, 71), (51, 70)], "i")
    line([(51, 79), (54, 79)], "i")
    scales([(34, 67), (40, 69), (43, 65), (36, 72), (39, 77), (44, 78),
            (61, 68), (64, 72), (65, 77), (60, 82), (57, 85)], "g", "s")
    poly([(33, 64), (32, 57), (37, 62), (39, 64)], "F", True)
    poly([(40, 62), (43, 55), (45, 62)], "F", True)
    line([(42, 59), (43, 61)], "A")

    part = "central_neck"
    # Tall central neck, bending left and then right rather than a straight stalk.
    poly([(46, 67), (40, 58), (39, 49), (42, 41), (48, 35),
          (51, 30), (51, 25), (56, 22), (62, 25), (63, 30),
          (59, 37), (53, 42), (51, 48), (52, 54), (57, 60),
          (59, 66), (55, 72)], "m", True)
    poly([(45, 60), (42, 52), (43, 46), (47, 40), (52, 35),
          (55, 29), (55, 26), (59, 27), (59, 31), (55, 38),
          (49, 44), (47, 50), (48, 56), (53, 62)], "g")
    line([(44, 50), (45, 47), (48, 43)], "h")
    line([(52, 36), (55, 32), (56, 29)], "h")
    poly([(59, 28), (61, 29), (57, 37), (52, 42), (50, 47),
          (50, 53), (55, 59), (58, 64), (54, 68), (50, 65),
          (45, 57), (44, 50), (46, 45), (51, 40), (56, 34)], "c", True)
    poly([(57, 34), (56, 38), (50, 44), (48, 49), (48, 54),
          (52, 61), (54, 64), (55, 65), (55, 63), (50, 55),
          (49, 50), (51, 44), (57, 37), (59, 32)], "t")
    line([(49, 48), (49, 52), (50, 55)], "y")
    line([(54, 39), (56, 36)], "y")
    for points in [[(57, 33), (60, 34)], [(54, 38), (57, 39)],
                   [(50, 42), (54, 43)], [(47, 47), (51, 48)],
                   [(46, 52), (50, 52)], [(48, 57), (52, 56)],
                   [(50, 62), (54, 60)], [(53, 66), (56, 64)]]:
        line(points, "b")
    scales([(43, 43), (41, 49), (41, 54), (43, 59), (47, 63),
            (49, 36), (52, 31)], "g", "s")
    # Coral frill sits on the outer bend, clear of the neck's bright belly edge.
    poly([(42, 42), (38, 36), (41, 45)], "F", True)
    poly([(40, 47), (34, 43), (39, 52)], "F", True)
    poly([(40, 54), (35, 54), (42, 60)], "F", True)
    line([(37, 46), (39, 48)], "a")
    line([(37, 55), (40, 57)], "a")

    part = "right_neck"
    # Right neck coils outward before lifting its lower, forward-facing head.
    poly([(61, 71), (69, 68), (76, 64), (79, 59), (77, 55),
          (71, 52), (69, 47), (70, 44), (76, 43), (81, 46),
          (85, 53), (88, 57), (88, 63), (84, 69), (78, 75),
          (72, 79), (65, 79), (60, 76)], "s", True)
    poly([(65, 72), (72, 70), (79, 65), (81, 61), (80, 57),
          (76, 54), (74, 50), (75, 47), (78, 47), (80, 51),
          (84, 56), (84, 62), (80, 68), (74, 73), (67, 76)], "m")
    poly([(75, 49), (77, 51), (80, 55), (83, 58), (83, 63),
          (79, 68), (73, 72), (68, 75), (66, 73), (73, 69),
          (78, 65), (80, 61), (79, 57), (75, 54)], "c", True)
    poly([(77, 53), (81, 58), (81, 62), (78, 66), (72, 71),
          (68, 73), (70, 73), (76, 69), (81, 64), (82, 61), (80, 57)], "t")
    line([(78, 65), (75, 68)], "y")
    for points in [[(76, 54), (79, 53)], [(79, 58), (82, 57)],
                   [(80, 62), (83, 62)], [(78, 65), (81, 67)],
                   [(74, 69), (77, 71)], [(70, 72), (72, 74)]]:
        line(points, "b")
    scales([(66, 71), (71, 68), (76, 65), (81, 60), (80, 53)], "g", "s")
    poly([(86, 57), (92, 56), (87, 61)], "F", True)
    poly([(86, 65), (92, 64), (82, 70)], "F", True)
    line([(88, 66), (85, 68)], "a")

    part = "hind_leg"
    # Foreground hind leg, broad haunch and an articulated, three-clawed foot.
    poly([(34, 72), (39, 73), (43, 78), (40, 83), (36, 87),
          (38, 90), (36, 92), (24, 92), (21, 90), (24, 86),
          (28, 84), (29, 78)], "m", True)
    poly([(33, 75), (36, 75), (38, 78), (35, 81), (31, 83), (30, 80)], "g")
    line([(32, 76), (34, 76)], "h")
    poly([(30, 84), (33, 84), (33, 87), (29, 90), (25, 90), (25, 88)], "s")
    line([(26, 88), (30, 86)], "g")
    for x, y in [(22, 89), (27, 90), (33, 90)]:
        poly([(x, y), (x + 3, y - 1), (x + 2, y + 2), (x - 1, y + 2)], "t", True)
        line([(x, y), (x + 1, y)], "i")
    scales([(30, 78), (34, 81), (29, 87)], "g", "s")
    part = "front_leg"
    # Closest front leg reaches forward; dark elbow separates it from the belly.
    poly([(62, 73), (67, 73), (70, 77), (69, 81), (64, 85),
          (66, 88), (73, 89), (76, 92), (72, 93), (58, 93),
          (55, 90), (59, 86), (58, 80)], "m", True)
    poly([(62, 76), (65, 75), (67, 78), (63, 81), (60, 80)], "g")
    line([(62, 76), (64, 76)], "h")
    poly([(60, 82), (64, 81), (63, 85), (60, 88), (61, 90),
          (57, 90), (58, 86)], "s")
    line([(60, 85), (59, 87)], "g")
    line([(62, 89), (67, 90)], "g")
    for x, y in [(59, 91), (65, 91), (71, 91)]:
        poly([(x, y), (x + 3, y - 1), (x + 3, y + 1), (x, y + 2)], "t", True)
        line([(x + 1, y), (x + 2, y)], "i")
    scales([(65, 79), (63, 87)], "g", "s")

    part = "left_head"
    # LEFT HEAD — closed, snarling jaw; low crown and an ear-like coral frill.
    poly([(21, 33), (15, 28), (17, 36), (21, 39)], "F", True)
    poly([(22, 29), (21, 22), (25, 26), (26, 31)], "t", True)
    line([(22, 25), (24, 27)], "i")
    poly([(22, 30), (27, 27), (32, 28), (35, 31), (40, 32),
          (43, 35), (42, 39), (37, 42), (30, 43), (25, 41),
          (23, 37), (20, 35)], "m", True)
    poly([(23, 31), (27, 29), (31, 30), (32, 33), (28, 35),
          (24, 35)], "g")
    line([(24, 31), (27, 30), (29, 31)], "h")
    poly([(32, 32), (37, 34), (41, 34), (41, 36), (37, 37), (31, 35)], "g")
    line([(36, 34), (39, 34)], "h")
    poly([(27, 36), (32, 37), (37, 38), (42, 37), (40, 40),
          (34, 41), (28, 40)], "r")
    line([(30, 37), (33, 38), (39, 39)], "R")
    cluster(34, 38, ["yi..y", ".i..."])
    poly([(27, 40), (32, 41), (37, 41), (40, 40), (37, 43),
          (30, 44), (26, 42)], "s", True)
    line([(29, 41), (32, 42), (35, 42)], "m")
    poly([(26, 33), (28, 32), (31, 33), (29, 35), (26, 35)], "o")
    line([(27, 33), (29, 33)], "e")
    dot(28, 33, "E")
    dot(29, 33, "r")
    line([(25, 32), (28, 31), (31, 32)], "s")
    dot(40, 35, "o")
    scales([(23, 35), (25, 38), (30, 30)], "g", "s")
    line([(32, 34), (34, 35)], "s")
    cluster(35, 34, ["hh.", ".mg"])
    poly([(31, 28), (32, 22), (34, 29)], "a", True)
    line([(32, 25), (33, 28)], "y")

    part = "central_head"
    # CENTRAL HEAD — broad plated crown and an open roaring mouth.
    # Horns fork backward while the snout projects to the right.
    poly([(52, 17), (48, 13), (47, 7), (49, 8), (51, 13),
          (55, 16)], "t", True)
    line([(49, 10), (50, 13)], "i")
    poly([(58, 13), (58, 7), (62, 3), (61, 8), (63, 12)], "t", True)
    line([(59, 7), (61, 5)], "i")
    poly([(52, 17), (56, 12), (62, 11), (67, 14), (69, 17),
          (76, 19), (80, 20), (82, 23), (80, 27), (73, 29),
          (67, 28), (62, 27), (59, 31), (55, 30), (53, 24), (49, 21)], "m", True)
    poly([(53, 18), (57, 14), (61, 13), (65, 15), (64, 18),
          (60, 20), (56, 22), (52, 21)], "g")
    poly([(57, 15), (60, 14), (62, 15), (60, 17), (57, 18)], "h")
    line([(57, 15), (59, 14)], "z")
    poly([(65, 18), (68, 20), (73, 21), (79, 22), (80, 24),
          (76, 25), (69, 24), (65, 22)], "g")
    line([(69, 21), (74, 22), (77, 22)], "h")
    line([(70, 23), (75, 24)], "s")
    dot(79, 23, "o")
    dot(78, 24, "s")
    # Jaw opening is a single dark shape, with separate upper and lower fang rows.
    poly([(61, 24), (65, 24), (68, 26), (73, 27), (79, 26),
          (80, 28), (77, 34), (72, 37), (66, 36), (62, 32), (60, 28)], "r", True)
    poly([(63, 26), (67, 28), (72, 30), (76, 29), (74, 33),
          (69, 34), (65, 32)], "R")
    poly([(67, 32), (70, 33), (74, 32), (73, 35), (69, 35)], "p")
    line([(69, 33), (71, 34)], "q")
    for x, y in [(64, 25), (69, 27), (75, 28)]:
        poly([(x, y), (x + 2, y), (x + 1, y + 3)], "y")
        dot(x + 1, y + 1, "i")
    for x, y in [(65, 34), (72, 35)]:
        poly([(x, y), (x + 1, y - 2), (x + 2, y)], "i")
    poly([(60, 29), (63, 32), (66, 36), (71, 37), (77, 34),
          (77, 37), (72, 40), (66, 39), (61, 35), (58, 33)], "s", True)
    line([(63, 34), (67, 38), (71, 39), (74, 37)], "g")
    line([(67, 37), (70, 38)], "h")
    # Central eye, narrowed by the brow plate; hot amber against the teal face.
    poly([(59, 19), (62, 17), (66, 18), (67, 20), (64, 23),
          (60, 22), (58, 21)], "o")
    line([(60, 20), (62, 19), (65, 19)], "e", 2)
    dot(61, 20, "E")
    line([(64, 19), (64, 21)], "r")
    dot(61, 19, "w")
    line([(59, 18), (62, 16), (66, 17)], "s")
    line([(60, 23), (63, 24), (65, 23)], "g")
    line([(64, 17), (67, 18), (66, 20)], "o")
    line([(66, 22), (68, 23)], "s")
    cluster(71, 21, ["hz.", ".mg"])
    line([(57, 23), (57, 25), (59, 26)], "s")
    poly([(53, 23), (48, 22), (51, 26), (54, 28)], "F", True)
    poly([(52, 26), (48, 28), (55, 30)], "F", True)
    line([(51, 24), (53, 26)], "a")
    scales([(54, 21), (55, 26), (67, 19)], "h", "m")
    poly([(66, 15), (69, 10), (70, 17)], "a", True)
    line([(68, 13), (69, 16)], "A")

    part = "right_head"
    # RIGHT HEAD — a long low snout, forward horns and exposed biting fangs.
    poly([(71, 47), (66, 42), (66, 38), (69, 40), (74, 43)], "F", True)
    line([(67, 41), (71, 44)], "a")
    poly([(75, 44), (76, 39), (80, 35), (79, 40), (79, 44)], "t", True)
    line([(77, 39), (79, 37)], "i")
    poly([(72, 46), (76, 42), (81, 43), (84, 46), (90, 47),
          (94, 49), (94, 53), (90, 55), (86, 56), (83, 59),
          (79, 59), (75, 56), (74, 52), (70, 50)], "m", True)
    poly([(74, 47), (77, 44), (81, 45), (82, 48), (79, 50),
          (74, 50)], "g")
    line([(75, 47), (78, 45), (80, 46)], "h")
    poly([(82, 48), (87, 49), (91, 49), (93, 51), (91, 53),
          (87, 53), (82, 51)], "g")
    line([(85, 50), (88, 50), (91, 51)], "h")
    dot(92, 51, "o")
    cluster(85, 50, ["hh.", ".mg"])
    poly([(79, 52), (83, 53), (88, 54), (92, 53), (91, 58),
          (88, 61), (83, 61), (79, 58)], "r", True)
    poly([(82, 55), (85, 56), (89, 56), (88, 59), (84, 59)], "R")
    line([(84, 58), (86, 59)], "p")
    poly([(81, 53), (84, 54), (82, 58)], "y")
    line([(82, 54), (82, 56)], "i")
    poly([(88, 54), (90, 54), (89, 57)], "i")
    poly([(78, 57), (82, 60), (86, 61), (91, 58), (90, 61),
          (86, 64), (82, 64), (78, 61)], "s", True)
    line([(81, 61), (84, 63), (87, 62)], "g")
    poly([(76, 49), (78, 47), (82, 48), (80, 51), (76, 51)], "o")
    line([(77, 49), (80, 49)], "e")
    dot(78, 49, "E")
    dot(80, 49, "r")
    line([(76, 47), (79, 46), (82, 47)], "s")
    scales([(73, 50), (76, 54), (82, 46)], "g", "s")
    poly([(83, 44), (85, 39), (86, 46)], "a", True)
    line([(84, 43), (85, 45)], "A")

    # Closed eyes are painted as small lid shapes on the final grid.
    if pose in ("hit", "dead", "idle_c"):
        lids = [
            ("left_head", [(26, 33), (28, 32), (31, 33), (29, 35), (26, 35)], [(26, 34), (29, 34)]),
            ("central_head", [(59, 19), (62, 17), (66, 18), (67, 20), (64, 23), (60, 22), (58, 21)], [(60, 20), (62, 21), (65, 20)]),
            ("right_head", [(76, 49), (78, 47), (82, 48), (80, 51), (76, 51)], [(77, 49), (79, 50), (81, 49)]),
        ]
        for part, box, lid in lids:
            if pose == "idle_c" and part != "left_head": continue
            poly(box, "m")
            line(lid, "o")
            if pose == "hit":
                line([(lid[0][0], lid[0][1]-1), (lid[-1][0], lid[-1][1]-1)], "s")
    bounds = [min(x for x, y in vertices), min(y for x, y in vertices),
              max(x for x, y in vertices), max(y for x, y in vertices)]
    assert bounds[0] > 0 and bounds[1] > 0 and bounds[2] < CELL-1 and bounds[3] <= GROUND, (pose, bounds)
    im.info["vertexBounds"] = bounds
    return im


def review_frame(frame, scale=4):
    out = Image.new("RGB", (CELL * scale, CELL * scale), "#242b3b")
    enlarged = frame.resize(out.size, Image.Resampling.NEAREST)
    out.paste(enlarged, (0, 0), enlarged)
    return out


def main():
    frames = [draw(pose) for pose in POSES]
    sheet = Image.new("RGBA", (CELL*3, CELL*3))
    source = ROOT / "tiledata/pixel-enemies/hydra-three"
    out = ROOT / "verify-shots/hydra-redesign"
    source.mkdir(parents=True, exist_ok=True)
    out.mkdir(parents=True, exist_ok=True)
    for i, (pose, frame) in enumerate(zip(POSES, frames)):
        sheet.paste(frame, (i%3*CELL, i//3*CELL))
        frame.save(source / f"{pose}.png")
    public = ROOT / "public/assets/generated"
    sheet.save(public / "pixel-enemies/hydra-three.png")
    frames[0].save(public / "pixel-enemy-portraits/hydra-three.png")
    sheet.save(out / "hydra-sheet.png")
    frames[0].save(out / "hydra-native.png")
    review_frame(frames[0]).save(out / "hydra-4x.png")
    board = Image.new("RGB", (576, 630), "#242b3b")
    labels = ImageDraw.Draw(board)
    for i, (pose, frame) in enumerate(zip(POSES, frames)):
        x, y = i%3*192, i//3*210
        labels.text((x+8, y+3), pose, fill=PAL["h"])
        board.paste(review_frame(frame, 2), (x, y+18))
    board.save(out / "poses-2x.png")
    timeline = [("idle_a",200),("idle_b",200),("idle_c",200),("idle_b",200),
                ("windup",350),("move",130),("attack",400),("recover",220),
                ("idle_a",350),("hit",250),("recover",180),("idle_a",350),
                ("dead",1000)]
    previews = []
    for pose, ms in timeline:
        frame = Image.new("RGB", (384, 408), "#242b3b")
        frame.paste(review_frame(frames[POSES.index(pose)]), (0,0))
        ImageDraw.Draw(frame).text((12,389), pose, fill=PAL["h"])
        previews.append(frame)
    previews[0].save(out / "poses.gif", save_all=True, append_images=previews[1:],
                     duration=[ms for pose,ms in timeline], loop=0, disposal=2)
    idle = [review_frame(frames[POSES.index(pose)]) for pose in ["idle_a","idle_b","idle_c","idle_b"]]
    idle[0].save(out / "idle.gif", save_all=True, append_images=idle[1:], duration=200, loop=0, disposal=2)
    # Reopen deployed PNGs and inspect the actual saved cells.
    loaded = Image.open(public / "pixel-enemies/hydra-three.png").convert("RGBA")
    portrait = Image.open(public / "pixel-enemy-portraits/hydra-three.png").convert("RGBA")
    assert loaded.size == (288,288) and portrait.size == (96,96)
    assert set(loaded.getchannel("A").tobytes()) == {0,255}
    colors = {rgba for count,rgba in loaded.getcolors(288*288) if rgba[3]}
    assert colors <= set(C.values())
    receipts = {}
    hashes = []
    for i, (pose, frame) in enumerate(zip(POSES,frames)):
        cell = loaded.crop((i%3*CELL,i//3*CELL,(i%3+1)*CELL,(i//3+1)*CELL))
        assert cell.tobytes() == frame.tobytes()
        bbox = cell.getbbox()
        assert bbox and bbox[0]>0 and bbox[1]>0 and bbox[2]<CELL and bbox[3]<=GROUND+1, (pose,bbox)
        digest = hashlib.sha256(cell.tobytes()).hexdigest()
        hashes.append(digest)
        receipts[pose] = {"bounds":bbox,"vertexBounds":frame.info["vertexBounds"],"sha256":digest}
    assert len(set(hashes)) == 9
    assert portrait.tobytes() == frames[0].tobytes()
    receipt = {"cell":96,"sheet":[288,288],"colors":len(colors),"alpha":[0,255],
               "distinctFrames":9,"imageInput":False,"imageModel":False,
               "frames":receipts,"sheetSha256":hashlib.sha256((public/"pixel-enemies/hydra-three.png").read_bytes()).hexdigest()}
    (out/"pixels.json").write_text(json.dumps(receipt,indent=2)+"\n")
    print(json.dumps(receipt))


if __name__ == "__main__":
    main()
