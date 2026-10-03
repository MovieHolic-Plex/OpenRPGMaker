#!/usr/bin/env python3
"""Three individual native 64px battlers following the revised kappa.

Only painting helpers are shared. Anatomy and authored pixel clusters are unique
to each drawing. Pose controls deform authored points before painting; fallen
bodies are separate drawings. Direct invocation exports the idle art studies;
build-study-battles.py exports all nine cells and the public catalog assets.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw
from study_motion import deform, POSES

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "verify-shots/monster-redraw-studies"
CELL = 64


class Pixels:
    def __init__(self, palette, species=None, pose="idle_a"):
        self.im = Image.new("RGBA", (CELL, CELL))
        self.pen = ImageDraw.Draw(self.im)
        self.colors = {k: tuple(bytes.fromhex(v)) + (255,) for k, v in palette.items()}
        self.points = []
        self.species, self.pose, self.part = species, pose, "body"

    def point(self, p):
        x, y = p
        assert type(x) is int and type(y) is int
        if self.species:
            x, y = deform(self.species, self.pose, self.part, x, y)
        assert 0 <= x < CELL and 0 <= y < CELL, p
        self.points.append((x, y))
        return x, y

    def poly(self, points, color, edge=False):
        points = [self.point(p) for p in points]
        self.pen.polygon(points, fill=self.colors[color])
        if edge:
            self.pen.line(points + points[:1], fill=self.colors["o"], width=1)

    def line(self, points, color, width=1):
        self.pen.line([self.point(p) for p in points], fill=self.colors[color], width=width)

    def cluster(self, x, y, rows):
        for dy, row in enumerate(rows):
            for dx, color in enumerate(row):
                if color != ".":
                    self.pen.point(self.point((x + dx, y + dy)), fill=self.colors[color])


def wolf(pose="idle_a"):
    p = Pixels({
        "o": "1b2934", "d": "303f50", "s": "4b6070", "m": "708b96",
        "g": "9bb0ae", "h": "c2cdc0", "i": "e1ddbd",
        "b": "4d4249", "t": "816c69", "T": "b59785",
        "r": "603641", "R": "a45857", "a": "c58c47", "A": "f0c16c",
        "E": "fff2b0", "w": "f8efd3",
    }, "wolf-grey", pose)
    poly, line, cluster = p.poly, p.line, p.cluster
    if pose == "dead":
        return fallen_wolf(p)

    p.part = "far_hind"
    # Four staggered feet: distant limbs are darker and inset.
    poly([(17, 37), (24, 39), (23, 45), (20, 49), (20, 54),
          (24, 55), (25, 57), (16, 57), (15, 55), (17, 51),
          (17, 46), (14, 42)], "d", True)
    line([(19, 44), (19, 48), (18, 52), (18, 55)], "s", 2)
    cluster(19, 55, ["ssmss", "mdodd"])
    p.part = "far_front"
    poly([(43, 32), (48, 34), (48, 42), (46, 48), (46, 54),
          (50, 55), (51, 57), (43, 57), (42, 55), (43, 47),
          (41, 40)], "d", True)
    poly([(45, 38), (47, 37), (47, 42), (45, 48), (45, 54),
          (43, 54), (44, 47)], "s")
    line([(45, 55), (48, 55)], "m")
    cluster(47, 56, ["sds"])

    p.part = "tail"
    # The heavy low tail has a shaggy edge, not a smooth tube.
    poly([(18, 30), (13, 29), (9, 27), (5, 23), (4, 25),
          (3, 23), (3, 28), (4, 32), (3, 33), (6, 36),
          (6, 38), (11, 40), (16, 38), (20, 35)], "s", True)
    poly([(5, 28), (9, 31), (13, 32), (17, 32), (18, 35),
          (13, 37), (9, 36), (6, 33)], "m")
    line([(5, 30), (8, 33), (12, 34)], "g")
    cluster(6, 34, ["ggm", ".hm", "..g"])

    p.part = "body"
    # Low back, powerful haunch and shoulder: the belly rises between the legs.
    poly([(13, 29), (15, 24), (20, 21), (26, 20), (29, 19),
          (31, 21), (36, 19), (39, 21), (44, 23), (46, 29),
          (44, 36), (39, 40), (33, 42), (26, 41), (20, 44),
          (15, 40), (12, 34)], "s", True)
    poly([(15, 28), (20, 24), (27, 22), (32, 23), (36, 21),
          (40, 24), (39, 29), (32, 32), (23, 33), (16, 32)], "m")
    poly([(17, 27), (22, 24), (26, 23), (28, 25), (23, 27),
          (20, 31), (16, 31)], "g")
    line([(20, 26), (23, 24), (25, 24)], "h")
    poly([(28, 25), (33, 24), (37, 23), (37, 26), (33, 28),
          (31, 30), (28, 29)], "g")
    poly([(15, 34), (20, 36), (23, 39), (29, 40), (34, 39),
          (37, 36), (40, 37), (35, 40), (29, 41), (23, 40),
          (18, 41)], "d")
    # Fur locks lie along the body, with deliberate gaps between highlights.
    cluster(22, 28, ["gg..", ".hm.", "..ms"])
    cluster(28, 32, ["gm..", ".gs.", "..sd"])
    cluster(18, 34, ["ms..", ".gs.", "..s."])
    line([(31, 35), (34, 34), (37, 30)], "s")
    line([(25, 37), (27, 38), (30, 38)], "m")

    p.part = "hind_leg"
    # Near hind limb: broad upper thigh, raised hock, narrow ankle and big paw.
    poly([(18, 33), (25, 33), (29, 37), (29, 42), (26, 46),
          (25, 50), (22, 52), (23, 56), (27, 57), (29, 59),
          (28, 60), (18, 60), (16, 58), (17, 53), (20, 49),
          (21, 45), (17, 42), (15, 38)], "s", True)
    poly([(19, 34), (24, 35), (27, 38), (27, 41), (24, 44),
          (20, 42), (17, 39)], "m")
    poly([(19, 35), (23, 36), (25, 38), (24, 40), (20, 40),
          (18, 38)], "g")
    line([(21, 43), (24, 44), (23, 47), (21, 50)], "m")
    poly([(20, 53), (22, 52), (22, 56), (25, 57), (26, 59),
          (19, 59), (18, 57)], "m")
    line([(19, 56), (19, 58), (23, 58)], "g")
    cluster(23, 58, ["mggg", ".odo"])
    cluster(18, 37, ["hg", ".m"])

    p.part = "front_leg"
    # Foreground shoulder joins a sloping neck ruff; the wrist stays thick.
    poly([(36, 27), (42, 26), (46, 31), (45, 36), (43, 41),
          (43, 48), (41, 54), (42, 57), (48, 58), (50, 60),
          (39, 60), (37, 58), (38, 53), (38, 47), (37, 42),
          (34, 38), (32, 33)], "s", True)
    poly([(36, 29), (40, 28), (43, 31), (43, 35), (40, 39),
          (36, 36), (34, 33)], "m")
    poly([(38, 29), (41, 31), (41, 34), (38, 37), (35, 34)], "g")
    line([(39, 32), (40, 33), (39, 35)], "h")
    poly([(39, 40), (41, 39), (41, 46), (40, 49), (40, 54),
          (38, 55), (39, 48)], "m")
    line([(40, 43), (40, 46)], "g")
    poly([(40, 57), (44, 57), (47, 59), (40, 59), (38, 58)], "g")
    cluster(43, 58, ["hhh..", "gomom"])

    p.part = "neck"
    # Ruff contours are large locks; cheek fur breaks the neck silhouette.
    poly([(36, 20), (40, 16), (44, 16), (46, 19), (49, 23),
          (48, 28), (46, 28), (46, 32), (43, 31), (42, 35),
          (39, 33), (36, 34), (37, 31), (33, 29), (35, 26),
          (32, 25)], "m", True)
    poly([(37, 22), (40, 19), (43, 19), (45, 22), (44, 27),
          (41, 28), (40, 31), (37, 29), (35, 27)], "g")
    poly([(43, 26), (47, 25), (46, 29), (44, 28), (42, 32),
          (41, 30), (38, 29), (40, 26)], "h")
    line([(38, 23), (37, 25), (39, 26)], "h")
    cluster(36, 28, ["gm.", ".sd", "..d"])
    cluster(42, 29, ["im", "h."])

    p.part = "head"
    # Upright canine ears, inner warm planes kept smaller than the gray rim.
    poly([(39, 20), (38, 15), (40, 11), (43, 14), (46, 19)], "s", True)
    poly([(40, 14), (42, 15), (44, 18), (41, 18)], "t")
    line([(40, 12), (40, 14), (41, 15)], "h")
    poly([(47, 17), (48, 11), (50, 12), (53, 18), (52, 20)], "d", True)
    poly([(49, 13), (50, 15), (51, 18), (49, 17)], "b")
    line([(48, 13), (48, 15)], "m")
    # The muzzle is fleshy and tapered, with an inset black nose and short fangs.
    poly([(43, 16), (48, 16), (52, 19), (54, 22), (58, 22),
          (61, 24), (61, 26), (58, 28), (53, 28), (49, 31),
          (45, 30), (43, 27), (41, 26), (43, 22)], "m", True)
    poly([(44, 17), (48, 17), (50, 19), (49, 23), (46, 24),
          (43, 23)], "g")
    line([(45, 17), (47, 17), (48, 18)], "h")
    cluster(43, 18, ["hg", ".ms"])
    cluster(45, 22, ["gm", ".s"])
    poly([(50, 23), (54, 24), (58, 23), (60, 25), (57, 26),
          (52, 26), (48, 28), (46, 26)], "h")
    line([(53, 24), (55, 24), (57, 24)], "i")
    cluster(58, 23, [".oo", "odo", "ooo"])
    # Amber eye tucked under a strong slanted brow, facing right.
    cluster(47, 19, ["mdso..", ".oAAo.", "..EAo.", "...sd."])
    line([(47, 19), (49, 20), (51, 20)], "d")
    line([(53, 21), (54, 22)], "s")
    p.part = "jaw"
    poly([(49, 27), (53, 27), (57, 27), (56, 30), (52, 31),
          (48, 30)], "r", True)
    line([(51, 29), (53, 30), (55, 29)], "R")
    cluster(51, 27, ["w...w", "i...i"])
    line([(49, 30), (52, 32), (55, 31)], "g")
    cluster(45, 24, ["hg.", ".ms", "..s"])
    cluster(44, 28, ["hgm", ".ms"])
    return p.im


def bat(pose="idle_a"):
    p = Pixels({
        "o": "1d2734", "d": "303d50", "s": "495c6a", "m": "708a92",
        "g": "a0b4b0", "h": "cdd4bd", "i": "f0e3bd",
        "b": "3e3249", "t": "624557", "T": "906274", "y": "bd8991",
        "Y": "ddaca3", "r": "6c3545", "R": "b66061", "a": "b2825a",
        "A": "e2b967", "E": "fff0aa", "w": "fff0d0",
    }, "bat-cave", pose)
    poly, line, cluster = p.poly, p.line, p.cluster
    if pose == "dead":
        return fallen_bat(p)

    p.part = "far_wing"
    # A far, foreshortened wing. Finger tips descend into three scalloped webs.
    poly([(36, 31), (41, 25), (49, 19), (57, 10), (60, 6),
          (61, 10), (61, 20), (60, 33), (58, 31), (55, 31),
          (53, 34), (52, 38), (49, 35), (46, 35), (43, 38),
          (40, 37)], "t", True)
    poly([(44, 26), (50, 21), (58, 13), (59, 19), (58, 28),
          (55, 29), (52, 27), (49, 31), (44, 34), (40, 33)], "T")
    poly([(50, 22), (57, 16), (57, 20), (55, 24), (51, 27),
          (49, 31), (45, 32)], "y")
    poly([(52, 28), (55, 29), (52, 35), (50, 33), (48, 33)], "T")
    line([(39, 30), (47, 23), (55, 17), (60, 8)], "d", 2)
    line([(41, 29), (48, 23), (54, 18), (58, 11)], "m")
    line([(51, 21), (57, 24), (60, 33)], "b")
    line([(51, 21), (51, 29), (52, 37)], "b")
    line([(51, 22), (46, 30), (43, 37)], "b")
    line([(52, 23), (52, 27)], "y")
    line([(47, 29), (45, 32)], "y")
    cluster(58, 13, ["gm", ".s"])
    cluster(50, 20, ["g.", "ms"])

    p.part = "tail"
    # Uropatagium linking the feet and short tail under the furry abdomen.
    poly([(29, 43), (37, 44), (43, 45), (41, 50), (38, 56),
          (35, 58), (32, 53), (27, 48)], "t", True)
    poly([(30, 45), (36, 46), (39, 47), (37, 53), (35, 55),
          (33, 50)], "T")
    line([(34, 48), (35, 54), (35, 58)], "b")
    line([(34, 49), (35, 52)], "y")

    p.part = "near_wing"
    # Near wing: one large bowed forearm and four long fingers, not a triangle.
    poly([(31, 29), (25, 23), (18, 18), (11, 12), (7, 6),
          (5, 4), (4, 9), (3, 16), (3, 32), (6, 29),
          (8, 28), (10, 29), (12, 32), (13, 39), (16, 36),
          (18, 36), (21, 39), (23, 43), (25, 39), (28, 39),
          (31, 41), (33, 37)], "t", True)
    # The panels are shaded along the folded membrane, leaving a dark trailing rim.
    poly([(5, 9), (10, 14), (16, 19), (9, 22), (5, 27),
          (5, 20)], "T")
    poly([(7, 13), (12, 17), (13, 18), (8, 21), (6, 23)], "y")
    poly([(16, 20), (20, 24), (19, 28), (17, 33), (14, 35),
          (13, 30), (10, 27), (11, 23)], "T")
    poly([(15, 22), (16, 25), (15, 31), (14, 31), (13, 27),
          (12, 25)], "y")
    poly([(19, 24), (24, 27), (26, 31), (26, 37), (23, 39),
          (21, 35), (18, 34)], "T")
    poly([(20, 28), (22, 29), (24, 34), (23, 36), (21, 32)], "y")
    poly([(25, 28), (29, 30), (31, 35), (30, 38), (27, 36)], "T")
    # Wing fingers meet at the wrist. Their bright side is consistently above.
    line([(32, 30), (24, 25), (16, 18), (10, 12), (5, 5)], "d", 2)
    line([(31, 29), (24, 24), (16, 17), (10, 11), (6, 6)], "m")
    line([(14, 17), (9, 23), (3, 32)], "b")
    line([(14, 18), (11, 23), (6, 28)], "T")
    line([(15, 18), (15, 26), (13, 39)], "b")
    line([(16, 21), (16, 26), (15, 32)], "y")
    line([(16, 19), (21, 30), (23, 43)], "b")
    line([(18, 23), (21, 30), (22, 35)], "y")
    line([(16, 19), (26, 30), (31, 41)], "b")
    line([(24, 28), (27, 33)], "y")
    line([(4, 27), (5, 29)], "T")
    line([(14, 35), (14, 37)], "T")
    # Thumb claw curls up from the wrist, separate from the membrane fingers.
    poly([(13, 18), (12, 15), (13, 11), (16, 10), (18, 12),
          (16, 12), (15, 15), (16, 18)], "a", True)
    line([(13, 14), (14, 12), (16, 11)], "i")
    cluster(16, 16, ["hg", ".m"])

    p.part = "feet"
    # Short hooked feet, with two different ankle bends.
    poly([(30, 44), (32, 46), (31, 50), (33, 52), (32, 54),
          (29, 54), (27, 52), (27, 49), (29, 47)], "s", True)
    line([(30, 48), (29, 50), (30, 52)], "m")
    cluster(28, 52, ["aia.", "o.to", ".oo."])
    poly([(39, 44), (42, 45), (41, 49), (43, 51), (43, 53),
          (40, 53), (38, 51), (38, 47)], "s", True)
    line([(40, 47), (40, 49), (41, 51)], "g")
    cluster(39, 51, [".iaia", ".toto", "..o.o"])

    p.part = "body"
    # Compact furry body. The shoulder silhouette stays distinct from the wings.
    poly([(31, 26), (36, 25), (41, 28), (43, 33), (41, 38),
          (42, 40), (39, 43), (38, 47), (34, 48), (30, 45),
          (29, 46), (27, 41), (26, 40), (27, 35), (25, 31),
          (28, 28)], "s", True)
    poly([(31, 28), (36, 28), (39, 31), (39, 36), (37, 42),
          (34, 45), (30, 42), (28, 36), (29, 32)], "m")
    poly([(32, 30), (36, 30), (37, 32), (36, 36), (37, 38),
          (35, 42), (32, 41), (30, 37), (31, 34)], "g")
    line([(33, 32), (34, 31), (35, 32)], "h")
    cluster(31, 35, ["hg.", ".hm", "..g"])
    cluster(34, 40, ["hg", ".m"])
    poly([(39, 31), (41, 33), (39, 38), (40, 40), (37, 43),
          (37, 39)], "d")
    cluster(28, 31, ["gm.", ".ss"])
    cluster(29, 39, ["mg", ".s"])
    line([(34, 44), (35, 46)], "g")

    p.part = "head"
    # Huge leaf ears: the near ear has its own fold and a crooked ragged tip.
    poly([(31, 22), (29, 17), (29, 11), (27, 6), (29, 5),
          (33, 8), (36, 15), (35, 22)], "s", True)
    poly([(30, 10), (32, 11), (34, 17), (33, 21), (31, 18)], "T")
    line([(30, 12), (32, 15), (32, 18)], "y")
    line([(29, 7), (31, 9)], "m")
    poly([(39, 21), (41, 15), (44, 6), (46, 7), (46, 10),
          (48, 12), (46, 18), (43, 23)], "d", True)
    poly([(43, 14), (45, 10), (46, 13), (44, 19), (42, 20)], "T")
    line([(44, 13), (44, 15)], "y")
    line([(44, 7), (45, 8)], "m")

    # Bat face: broad muzzle, recessed bright eyes, and fangs below the nose leaf.
    poly([(32, 19), (37, 18), (41, 19), (44, 22), (46, 24),
          (47, 28), (44, 30), (43, 33), (40, 35), (36, 32),
          (31, 31), (32, 28), (29, 26), (30, 22)], "s", True)
    poly([(33, 20), (38, 20), (41, 22), (41, 25), (37, 27),
          (32, 25), (31, 23)], "m")
    poly([(33, 21), (36, 20), (38, 21), (36, 23), (33, 24)], "g")
    cluster(34, 20, ["hg", ".m"])
    poly([(31, 26), (34, 28), (37, 28), (35, 31), (32, 29)], "m")
    line([(32, 27), (34, 28)], "g")
    cluster(33, 24, ["odso", ".EAo", "..do"])
    cluster(40, 23, ["dsoo.", ".oAAo", "..EAo", "...ds"])
    line([(39, 23), (41, 24), (44, 24)], "d")
    # Short raised nose leaf, with a dark nostril on each side.
    poly([(40, 26), (42, 24), (44, 26), (47, 27), (46, 29),
          (42, 29), (39, 28)], "t", True)
    cluster(41, 26, ["Ty.", ".To", "odo"])
    poly([(37, 29), (41, 30), (45, 29), (44, 33), (40, 34),
          (37, 32)], "r", True)
    line([(40, 32), (42, 32)], "R")
    cluster(38, 29, ["wi...w", ".i...i", ".a...a"])
    line([(38, 33), (40, 35), (43, 34)], "m")
    cluster(36, 27, ["gm", ".s"])
    return p.im


def skeleton(pose="idle_a"):
    p = Pixels({
        "o": "1b2835", "d": "303e50", "s": "4c6270", "m": "748f96",
        "g": "a8bab5", "h": "d2d6bf", "i": "efe3b6", "w": "fff0ce",
        "b": "4c3d3f", "t": "816550", "T": "b39466", "y": "d8bb7a",
        "r": "603b49", "R": "9b5b58", "a": "c28c69",
        "C": "6c5547", "c": "a18f6a", "e": "e0b66c",
    }, "skeleton-knight", pose)
    poly, line, cluster = p.poly, p.line, p.cluster
    if pose == "dead":
        return fallen_skeleton(p)

    p.part = "weapon"
    # Blade is broad and tilted, with a ridge and a chipped lower edge.
    poly([(50, 27), (52, 21), (56, 8), (60, 4), (60, 11),
          (57, 21), (56, 21), (55, 27), (53, 29)], "s", True)
    poly([(53, 22), (57, 9), (59, 7), (59, 11), (55, 25),
          (53, 26)], "m")
    line([(54, 21), (57, 11), (59, 6)], "h")
    line([(52, 25), (56, 12)], "g")
    line([(56, 19), (55, 23)], "d")
    # Guard, wrapped grip and pommel. The hand will overlap the grip.
    poly([(48, 25), (49, 24), (52, 26), (55, 26), (58, 26),
          (58, 28), (55, 28), (52, 28), (48, 27)], "t", True)
    line([(49, 25), (51, 26), (55, 27), (57, 27)], "y")
    line([(52, 28), (50, 34)], "b", 3)
    cluster(50, 29, ["Tt.", ".bT", "Tb.", ".b."])
    cluster(48, 34, [".yT", "Ttb", ".oo"])

    p.part = "sword_arm"
    # Far upper arm and ulna rotate forward to support the sword.
    poly([(41, 27), (45, 27), (48, 31), (48, 34), (51, 32),
          (51, 29), (54, 29), (54, 33), (51, 36), (46, 37),
          (43, 34), (40, 31)], "c", True)
    line([(43, 29), (46, 32), (46, 34)], "i", 2)
    line([(47, 35), (50, 34), (52, 32)], "i", 2)
    cluster(46, 33, [".T.", "yCi", ".t."])
    cluster(51, 29, ["hio", "Cwo", "hio", ".co"])
    p.part = "body"
    # Far shoulder plate, dark enough to keep the skull in front.
    poly([(38, 25), (43, 25), (46, 28), (45, 31), (41, 32),
          (37, 29)], "d", True)
    poly([(40, 26), (43, 26), (45, 28), (43, 29), (40, 29)], "s")
    line([(40, 26), (43, 27)], "m")
    cluster(43, 29, ["tT", ".b"])

    p.part = "far_leg"
    # Far leg and foot. Tibia and fibula remain separate inside a thick outline.
    poly([(29, 40), (33, 41), (32, 47), (28, 51), (26, 56),
          (26, 59), (21, 60), (14, 60), (13, 58), (20, 57),
          (23, 54), (23, 50), (26, 46)], "C", True)
    line([(28, 44), (29, 47), (26, 50)], "i", 2)
    line([(25, 52), (24, 55), (23, 58)], "i", 2)
    line([(26, 52), (25, 55)], "c")
    cluster(25, 49, ["Tic", "ct."])
    cluster(16, 58, ["ciiii...", "ococicoo"])
    line([(20, 58), (23, 58)], "h")

    p.part = "body"
    # Tattered waist cloth connects pelvis and armour, cut into unequal strips.
    poly([(28, 36), (34, 35), (40, 38), (40, 43), (38, 46),
          (34, 45), (32, 49), (30, 45), (26, 48), (27, 43),
          (24, 43), (25, 39)], "r", True)
    poly([(28, 38), (32, 37), (34, 40), (31, 45), (29, 43),
          (27, 45)], "R")
    line([(28, 39), (29, 41), (29, 43)], "a")
    line([(34, 39), (37, 40), (37, 43)], "b")

    p.part = "front_leg"
    # Near leg bends outward, with a broad kneecap and a battered shin plate.
    poly([(35, 40), (39, 40), (41, 44), (45, 49), (45, 53),
          (42, 58), (47, 58), (51, 60), (50, 60), (40, 60),
          (37, 59), (39, 55), (40, 51), (38, 48), (34, 44)], "c", True)
    line([(37, 42), (38, 44), (42, 48)], "i", 2)
    line([(38, 44), (39, 46)], "h")
    cluster(41, 48, [".hi", "Twy", "ctc"])
    poly([(40, 52), (42, 51), (45, 52), (44, 55), (42, 58),
          (39, 57)], "d", True)
    poly([(41, 52), (43, 52), (43, 55), (41, 57), (40, 56)], "s")
    line([(42, 53), (42, 55)], "m")
    line([(40, 54), (43, 55)], "t")
    cluster(40, 58, ["ti....", ".hiih.", "chocio"])
    cluster(45, 59, [".iiih", "ococo"])

    p.part = "body"
    # A short exposed spine, clavicles, curved paired ribs and angular pelvis.
    poly([(32, 26), (36, 25), (40, 27), (42, 30), (40, 35),
          (38, 38), (38, 41), (33, 44), (28, 42), (28, 38),
          (30, 34), (29, 30)], "b", True)
    line([(35, 27), (35, 31), (34, 35), (33, 40)], "c", 2)
    cluster(34, 27, ["yi", "Cb", "hi", "Cb", "hi", "Cb", "hi", "Cb"])
    # Clavicles lean toward the far shoulder and disappear under the near plate.
    line([(30, 28), (33, 29), (35, 28), (39, 28), (41, 29)], "i")
    # Four rib arcs are drawn separately; dark intercostal gaps are intentional.
    line([(31, 30), (31, 31), (34, 32), (38, 32), (40, 30)], "i")
    line([(30, 33), (31, 34), (34, 35), (38, 34), (40, 33)], "i")
    line([(30, 36), (32, 37), (35, 37), (38, 36)], "h")
    line([(31, 39), (33, 40), (36, 39)], "c")
    cluster(30, 32, ["t..", ".c."])
    cluster(39, 31, ["c", "t"])
    poly([(29, 40), (32, 40), (33, 42), (36, 40), (38, 40),
          (37, 43), (33, 45), (29, 43)], "c", True)
    line([(30, 41), (31, 42), (33, 43), (36, 42)], "i")
    line([(34, 42), (35, 41)], "h")
    # Thin old belt: ochre buckle is small so the ribs remain the chest's focus.
    line([(28, 38), (32, 39), (37, 38)], "t")
    cluster(32, 38, ["yT", "Tb"])

    p.part = "shield_arm"
    # Near arm supporting the shield, humerus peeks behind the top right rim.
    poly([(28, 27), (32, 28), (34, 32), (32, 36), (29, 38),
          (24, 39), (22, 36), (26, 33), (26, 29)], "c", True)
    line([(29, 29), (31, 32), (29, 35)], "i", 2)
    line([(29, 36), (26, 37), (24, 36)], "h", 2)
    poly([(25, 25), (29, 24), (33, 27), (33, 30), (30, 32),
          (26, 31), (24, 28)], "s", True)
    poly([(26, 26), (29, 25), (32, 27), (31, 28), (26, 29)], "m")
    line([(27, 26), (29, 26), (30, 27)], "g")
    cluster(25, 29, ["tT.", ".bb"])
    cluster(31, 29, ["m", "d"])

    p.part = "shield"
    # The shield is a battered heater shape, with bevel, dents and worn heraldry.
    poly([(17, 28), (24, 28), (28, 31), (29, 37), (27, 44),
          (23, 48), (20, 51), (16, 48), (12, 44), (10, 37),
          (11, 31)], "s", True)
    poly([(17, 30), (23, 30), (26, 32), (27, 38), (25, 43),
          (20, 48), (15, 43), (12, 37), (13, 32)], "d")
    poly([(17, 31), (22, 31), (22, 36), (20, 43), (19, 46),
          (15, 41), (14, 36)], "s")
    poly([(17, 32), (20, 31), (20, 36), (18, 39), (16, 37)], "m")
    line([(12, 33), (12, 37), (14, 42), (18, 47), (20, 49)], "m")
    line([(14, 31), (17, 29), (23, 29), (26, 31)], "g")
    line([(27, 35), (27, 39), (25, 44), (21, 48)], "b")
    # A worn ochre crescent and central shield boss.
    cluster(17, 34, [".TTy.", "Ty..T", "yt...", "yt...", ".TTt."])
    cluster(19, 37, [".mi", "mog", ".dd"])
    line([(21, 33), (21, 42)], "d")
    # Two oblique slashes expose metal, with a dark edge below each scar.
    line([(23, 34), (21, 36), (16, 39)], "g")
    line([(23, 35), (21, 37), (16, 40)], "o")
    line([(22, 42), (20, 44), (18, 45)], "m")
    line([(22, 43), (20, 45)], "o")
    cluster(25, 31, ["tT", "bd"])
    cluster(12, 40, ["Tt", ".b"])
    cluster(16, 45, ["tT", ".b"])
    # Four gripping knuckles remain visible on the far edge.
    cluster(28, 35, ["ci", "oh", "ci", "oh", "ct"])

    p.part = "head"
    # A readable skull with an angular cheekbone and three separate jaw teeth.
    poly([(31, 12), (36, 12), (40, 14), (42, 18), (42, 21),
          (43, 23), (42, 24), (41, 25), (41, 28), (37, 29),
          (33, 27), (32, 24), (29, 23), (29, 18)], "c", True)
    poly([(32, 14), (36, 14), (39, 16), (40, 19), (38, 22),
          (35, 24), (31, 22), (30, 19)], "i")
    line([(33, 15), (35, 15), (36, 16)], "w")
    poly([(38, 22), (40, 21), (42, 22), (42, 23), (40, 24),
          (38, 23)], "i")
    cluster(30, 18, [".oo", "odo", "ot."])
    cluster(36, 18, [".ooo", "oddo", "odo.", ".t.."])
    cluster(39, 21, [".i.", ".oo", "ico", ".t."])
    line([(31, 22), (32, 23), (34, 23)], "h")
    line([(35, 25), (38, 25), (41, 24)], "o")
    cluster(35, 25, ["i.i.i", "wcihi", "htith"])
    line([(35, 27), (37, 28), (39, 27)], "h")
    # Corroded iron helm has a low dome, broken crest and sloping brow rim.
    poly([(28, 15), (28, 11), (30, 8), (35, 6), (39, 7),
          (42, 11), (42, 14), (44, 16), (44, 18), (40, 18),
          (35, 16), (30, 17)], "s", True)
    poly([(30, 11), (33, 8), (37, 8), (39, 10), (39, 13),
          (34, 13), (30, 14)], "m")
    line([(32, 9), (35, 8), (37, 9)], "g")
    poly([(39, 9), (41, 11), (41, 14), (39, 15), (36, 14)], "d")
    line([(29, 15), (33, 15), (37, 16), (42, 17)], "g")
    line([(30, 16), (33, 16), (37, 17), (43, 18)], "d")
    cluster(29, 11, ["tT", "b."])
    cluster(39, 13, ["tT", ".b"])
    cluster(35, 6, [".d", "ms"])
    # A rivet and short crack complete the helmet, without covering the face.
    cluster(30, 14, ["i"])
    line([(36, 9), (36, 11), (35, 12)], "s")
    return p.im


def fallen_wolf(p):
    poly, line, cluster = p.poly, p.line, p.cluster
    poly([(15, 49), (10, 46), (6, 46), (3, 49), (3, 55),
          (7, 59), (13, 59), (17, 56)], "s", True)
    line([(4, 51), (5, 55), (8, 57), (12, 57)], "g")
    poly([(18, 55), (24, 53), (30, 56), (34, 58), (34, 60),
          (18, 60), (15, 58)], "d", True)
    line([(22, 57), (27, 57), (31, 59)], "m")
    poly([(13, 49), (20, 45), (27, 45), (35, 47), (41, 51),
          (43, 55), (39, 59), (30, 60), (20, 59), (13, 57),
          (10, 53)], "s", True)
    poly([(14, 50), (21, 47), (27, 47), (31, 50), (28, 54),
          (19, 55), (12, 53)], "m")
    poly([(17, 50), (21, 48), (25, 48), (26, 50), (21, 52),
          (16, 52)], "g")
    line([(20, 49), (23, 48)], "h")
    cluster(27, 51, ["gm.", ".gs", "..s"])
    poly([(17, 54), (23, 53), (28, 56), (28, 59), (35, 58),
          (38, 59), (38, 60), (24, 60), (19, 58)], "m", True)
    poly([(19, 55), (23, 55), (25, 57), (22, 58), (19, 57)], "g")
    cluster(32, 59, ["ggmgm", "sodos"])
    poly([(36, 50), (40, 49), (45, 52), (48, 55), (55, 57),
          (56, 60), (39, 60), (35, 57), (32, 55)], "m", True)
    poly([(38, 51), (42, 52), (45, 55), (43, 57), (38, 56)], "g")
    poly([(41, 57), (45, 57), (51, 58), (53, 59), (42, 59)], "h")
    cluster(49, 59, ["hgmgm", ".odos"])
    # Sideways head rests on the paw, with folded ears and an unmistakably closed eye.
    poly([(42, 49), (43, 45), (46, 46), (48, 48), (50, 45),
          (53, 49), (55, 51), (60, 52), (61, 55), (58, 57),
          (50, 57), (46, 55), (41, 54)], "m", True)
    poly([(45, 49), (49, 49), (53, 51), (53, 54), (48, 54),
          (43, 52)], "g")
    line([(47, 49), (49, 49)], "h")
    poly([(52, 52), (56, 53), (60, 53), (59, 55), (53, 56),
          (50, 54)], "h")
    cluster(59, 53, ["oo", "do"])
    line([(50, 51), (51, 52), (54, 52)], "d")
    line([(52, 55), (57, 55)], "s")
    cluster(44, 47, ["t.", "Tm"])
    return p.im


def fallen_bat(p):
    poly, line, cluster = p.poly, p.line, p.cluster
    # Folded fingers run horizontally across the floor, leaving the wing identity.
    poly([(34, 49), (27, 46), (17, 49), (8, 47), (4, 50),
          (7, 52), (5, 57), (12, 55), (17, 59), (22, 55),
          (29, 59), (35, 56)], "t", True)
    poly([(9, 50), (18, 51), (25, 48), (29, 51), (24, 55),
          (19, 54), (15, 56), (12, 53)], "T")
    line([(33, 50), (26, 48), (18, 51), (8, 49), (4, 50)], "m")
    line([(18, 51), (7, 56)], "b")
    line([(18, 51), (17, 58)], "b")
    line([(18, 51), (28, 58)], "b")
    line([(20, 52), (25, 55)], "y")
    poly([(38, 50), (45, 48), (52, 50), (60, 50), (58, 54),
          (61, 57), (53, 55), (49, 59), (45, 56), (40, 58)], "t", True)
    poly([(44, 51), (51, 52), (55, 51), (54, 54), (49, 56),
          (46, 54)], "T")
    line([(42, 51), (48, 50), (55, 52), (60, 50)], "m")
    line([(49, 51), (49, 57)], "b")
    line([(51, 53), (57, 56)], "b")
    poly([(30, 50), (34, 47), (39, 48), (44, 52), (44, 57),
          (40, 60), (31, 60), (27, 57), (27, 54)], "s", True)
    poly([(31, 51), (35, 50), (39, 52), (41, 56), (37, 58),
          (31, 57), (29, 54)], "m")
    poly([(33, 52), (36, 52), (39, 55), (36, 57), (32, 55)], "g")
    cluster(33, 53, ["hg", ".m"])
    cluster(27, 50, ["oiai", "otoo", ".o.."])
    cluster(42, 54, [".ii", "aao", "oo."])
    # Folded ears fall sideways rather than retaining the live vertical silhouette.
    poly([(37, 51), (34, 48), (30, 45), (30, 44), (34, 44),
          (39, 48), (42, 50)], "s", True)
    line([(32, 46), (35, 47), (38, 50)], "T")
    poly([(40, 49), (45, 46), (50, 46), (48, 49), (45, 51)], "d", True)
    line([(43, 49), (46, 47)], "T")
    poly([(38, 50), (42, 49), (46, 52), (48, 54), (47, 57),
          (44, 59), (39, 57), (36, 54)], "s", True)
    poly([(39, 51), (42, 51), (45, 53), (44, 55), (40, 55)], "m")
    line([(39, 52), (41, 53)], "g")
    line([(42, 53), (43, 54), (46, 54)], "d")
    cluster(45, 55, ["tTo", "odo"])
    line([(41, 56), (44, 57)], "b")
    cluster(41, 56, ["i..i"])
    return p.im


def fallen_skeleton(p):
    poly, line, cluster = p.poly, p.line, p.cluster
    # Fallen sword lies in front of the bones, still recognisable by its bevel.
    poly([(4, 58), (9, 56), (32, 56), (35, 58), (31, 60),
          (10, 60)], "s", True)
    line([(8, 57), (30, 57)], "h")
    line([(9, 58), (31, 58)], "m")
    line([(35, 54), (35, 60)], "t", 2)
    line([(36, 58), (43, 58)], "b", 2)
    cluster(37, 57, ["T.bT.bT", ".T..T.."])
    # Bent femurs and split shin bones behind the shield and ribs.
    line([(21, 51), (25, 47), (28, 48), (33, 53)], "C", 4)
    line([(21, 50), (25, 48), (28, 49), (31, 52)], "i", 2)
    line([(31, 53), (36, 55), (40, 53)], "c", 3)
    line([(33, 53), (36, 54), (39, 53)], "h")
    line([(32, 51), (37, 46), (40, 46), (43, 52)], "C", 4)
    line([(34, 49), (37, 47), (40, 48), (42, 51)], "i", 2)
    cluster(41, 52, ["ciii", "otot"])
    # Empty ribcage turned onto its side; arcs no longer form an upright torso.
    poly([(27, 51), (31, 48), (36, 49), (40, 52), (38, 56),
          (31, 58), (26, 56)], "b", True)
    line([(29, 51), (31, 50), (33, 50), (36, 53), (35, 56)], "i")
    line([(32, 50), (34, 50), (38, 53), (37, 55)], "h")
    line([(27, 53), (30, 52), (33, 55), (32, 57)], "i")
    line([(27, 55), (29, 54), (31, 56)], "c")
    line([(28, 56), (37, 52)], "c")
    cluster(28, 55, ["i.i.i", ".C.C."])
    poly([(33, 55), (37, 54), (41, 55), (40, 58), (35, 58)], "r", True)
    line([(35, 56), (37, 55), (39, 56)], "R")
    # Shield is seen foreshortened on the ground, with matching worn crescent.
    poly([(10, 51), (15, 49), (22, 49), (27, 52), (27, 55),
          (23, 58), (16, 58), (11, 55)], "s", True)
    poly([(13, 52), (17, 51), (22, 51), (25, 53), (21, 56),
          (16, 56)], "d")
    line([(12, 51), (17, 50), (22, 50)], "m")
    cluster(16, 52, ["TyyT", "y..t", ".TT."])
    line([(23, 52), (17, 55)], "g")
    # Fallen skull and helmet form one low head beside a detached shoulder plate.
    poly([(43, 50), (49, 48), (54, 50), (55, 53), (58, 55),
          (56, 57), (52, 58), (49, 60), (45, 59), (42, 55)], "c", True)
    poly([(45, 51), (49, 50), (52, 51), (53, 54), (51, 56),
          (46, 56), (44, 54)], "i")
    cluster(48, 52, [".ooo", "oddo", ".od."])
    cluster(54, 54, ["io", "oo"])
    cluster(49, 57, ["i.i.i", "whihc", ".ttt."])
    poly([(41, 51), (42, 47), (45, 44), (50, 44), (53, 47),
          (54, 50), (50, 51), (46, 52)], "s", True)
    poly([(43, 48), (46, 45), (49, 46), (51, 48), (50, 49),
          (45, 50)], "m")
    line([(46, 46), (48, 46)], "g")
    line([(42, 51), (46, 51), (52, 50)], "g")
    cluster(51, 48, ["tT", ".b"])
    poly([(57, 56), (60, 55), (62, 57), (60, 60), (57, 59)], "s", True)
    line([(58, 57), (60, 57)], "m")
    return p.im


DRAWINGS = {"wolf-grey": wolf, "bat-cave": bat, "skeleton-knight": skeleton}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    report = []
    for slug, paint in DRAWINGS.items():
        im = paint()
        native = OUT / f"{slug}-native.png"
        im.save(native)
        check = Image.open(native).convert("RGBA")
        assert check.tobytes() == im.tobytes()
        colors = set(im.get_flattened_data()) - {(0, 0, 0, 0)}
        alpha = set(im.getchannel("A").get_flattened_data())
        assert alpha == {0, 255}
        assert len(colors) <= 24
        for factor in (3, 6):
            display = Image.new("RGBA", (CELL * factor, CELL * factor), "#242d3b")
            display.alpha_composite(im.resize(display.size, Image.Resampling.NEAREST))
            display.convert("RGB").save(OUT / f"{slug}-{factor}x-v2.png")
        report.append({"slug": slug, "cell": CELL, "bbox": im.getbbox(),
                       "colors": len(colors), "alpha": sorted(alpha),
                       "sha256": hashlib.sha256(im.tobytes()).hexdigest(),
                       "poses": 1, "catalogWritten": False})
    (OUT / "pixels.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
