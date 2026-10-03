#!/usr/bin/env python3
"""Revised kappa: original 64px idle art and nine individually drawn battle poses.

All forms, shell scutes and face clusters are painted on the final integer grid.
No input artwork, model, scaling during authoring, or shared humanoid template.
Direct invocation refreshes the original idle review. build-study-battles.py
exports the nine battle cells and public catalog assets.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw
from study_motion import deform, POSES

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "verify-shots/kappa-redraw"
CELL = 64
PAL = {
    "o": "#182831", "d": "#294344", "s": "#3b6151",
    "m": "#558867", "g": "#80ac78", "h": "#b1cb91", "i": "#d9dfac",
    "B": "#343736", "b": "#4b4d39", "t": "#6d7146", "T": "#969c60",
    "y": "#bdc384", "Y": "#dce0ad",
    "a": "#8b5c35", "A": "#c58d47", "e": "#e9b96b", "E": "#fbe0a1",
    "w": "#28556b", "W": "#438b9e", "c": "#83c6ce", "C": "#c2f0dd",
    "r": "#66383b", "R": "#dd7851", "p": "#fff1bf",
}
COLORS = {k: tuple(bytes.fromhex(v[1:])) + (255,) for k, v in PAL.items()}


def draw(pose="idle_a"):
    im = Image.new("RGBA", (CELL, CELL))
    pen = ImageDraw.Draw(im)
    authored = []
    part = "body"

    def point(x, y):
        return deform("kappa-01", pose, part, x, y)

    def poly(points, color, edge=False):
        assert all(type(x) is int and type(y) is int for x, y in points)
        points = [point(x, y) for x, y in points]
        authored.extend(points)
        pen.polygon(points, fill=COLORS[color])
        if edge:
            pen.line(points + points[:1], fill=COLORS["o"], width=1)

    def line(points, color, width=1):
        assert all(type(x) is int and type(y) is int for x, y in points)
        points = [point(x, y) for x, y in points]
        authored.extend(points)
        pen.line(points, fill=COLORS[color], width=width)

    def cluster(x, y, rows):
        assert type(x) is int and type(y) is int
        for dy, row in enumerate(rows):
            for dx, color in enumerate(row):
                if color != ".":
                    pos = point(x + dx, y + dy)
                    pen.point(pos, fill=COLORS[color])
                    authored.append(pos)

    if pose == "dead":
        return fallen(poly, line, cluster, im)

    part = "far_leg"
    # Far bent leg: the thigh is partly hidden by the plastron and shell.
    poly([(20, 39), (28, 40), (29, 45), (25, 49), (23, 53),
          (25, 56), (22, 58), (12, 58), (9, 56), (10, 54),
          (16, 51), (17, 47), (15, 44)], "s", True)
    poly([(20, 42), (25, 42), (26, 45), (21, 48), (20, 51),
          (16, 52), (18, 47)], "m")
    poly([(16, 53), (20, 52), (23, 55), (20, 56), (12, 56)], "m")
    line([(11, 55), (16, 55), (17, 56)], "g")
    line([(18, 53), (19, 55), (22, 56)], "g")
    cluster(10, 57, ["t.y...t.y..", ".b.....b..."])

    part = "far_arm"
    # The far arm is foreshortened, reaching forward below the bill.
    poly([(40, 28), (46, 27), (51, 30), (55, 31), (58, 29),
          (60, 31), (61, 35), (59, 38), (53, 38), (49, 35),
          (45, 36), (41, 34)], "s", True)
    poly([(46, 29), (50, 31), (55, 33), (56, 35), (53, 35),
          (49, 33), (45, 34)], "m")
    poly([(54, 32), (58, 30), (60, 31), (60, 32), (57, 33),
          (59, 33), (61, 34), (61, 35), (57, 35), (59, 36),
          (59, 38), (56, 37), (53, 35)], "s", True)
    line([(55, 32), (57, 32), (59, 31)], "g")
    line([(56, 34), (59, 34)], "m")
    line([(55, 35), (57, 36)], "m")
    cluster(60, 34, ["y", "b"])
    cluster(59, 30, ["yt"])

    part = "body"
    # Thick, vaulted carapace. The outline describes its bulge, not an ellipse.
    poly([(8, 24), (9, 19), (13, 15), (18, 12), (23, 12),
          (29, 14), (33, 18), (35, 24), (34, 32), (31, 40),
          (27, 45), (20, 46), (14, 43), (10, 38), (7, 31)], "b", True)
    poly([(10, 23), (12, 18), (18, 14), (24, 14), (29, 17),
          (32, 22), (31, 30), (28, 38), (22, 42), (16, 39),
          (11, 34), (9, 28)], "t")
    # Individual scutes follow the shell's cylindrical perspective.
    poly([(17, 16), (23, 14), (27, 16), (26, 21), (22, 23),
          (16, 22), (14, 19)], "T")
    line([(17, 17), (22, 15), (25, 16)], "y")
    line([(15, 20), (17, 22), (22, 23), (26, 21)], "b")
    poly([(12, 22), (15, 21), (18, 25), (17, 31), (12, 33),
          (10, 29), (10, 25)], "T")
    line([(12, 23), (14, 23), (16, 25)], "y")
    line([(12, 30), (14, 31), (16, 30)], "t")
    poly([(19, 25), (23, 24), (28, 27), (28, 32), (24, 36),
          (18, 33)], "T")
    poly([(20, 26), (23, 25), (26, 27), (25, 29), (20, 30)], "y")
    line([(19, 31), (21, 33), (24, 34), (26, 32)], "t")
    cluster(20, 26, ["YYy", ".y."])
    poly([(28, 19), (30, 20), (32, 24), (31, 29), (29, 27),
          (27, 23)], "t")
    line([(29, 20), (30, 23), (30, 25)], "T")
    poly([(13, 35), (17, 34), (21, 38), (21, 42), (17, 40)], "t")
    line([(14, 35), (17, 36), (19, 38)], "T")
    poly([(24, 37), (28, 34), (30, 34), (28, 39), (25, 42),
          (23, 42)], "t")
    line([(25, 37), (27, 36)], "T")
    # A moss seam and worn scute edges identify a river creature, without noise.
    cluster(11, 23, ["sgm.", "mgs.", ".st."])
    cluster(16, 30, ["s...", "dg..", ".mg.", "..st"])
    cluster(26, 20, ["mt", "s."])
    line([(22, 24), (22, 27), (24, 29)], "t")
    cluster(20, 35, ["sgm", ".st"])
    line([(9, 25), (9, 30), (12, 37), (16, 41), (20, 43),
          (25, 43), (29, 39), (32, 32)], "B")
    # Segmented lower rim, highlighted only on the upper left facing plane.
    line([(9, 22), (11, 18), (16, 14), (20, 13)], "y")
    cluster(9, 29, ["Tb", "Tb", ".b"])
    cluster(12, 37, ["Tb.", ".Tb", "..b"])
    cluster(18, 42, ["Ttb", ".bb"])
    cluster(25, 41, ["tb", "b."])

    # Squat torso, neck merging into the shoulders with a pale turtle plastron.
    poly([(30, 24), (38, 23), (44, 26), (47, 33), (44, 40),
          (40, 45), (30, 48), (24, 45), (23, 38), (26, 30)], "s", True)
    poly([(31, 25), (36, 25), (40, 27), (42, 31), (38, 34),
          (29, 35), (26, 32)], "m")
    poly([(28, 29), (32, 26), (36, 27), (36, 29), (32, 31),
          (29, 33), (26, 34)], "g")
    line([(31, 27), (33, 26), (35, 27)], "h")
    poly([(33, 32), (38, 31), (42, 33), (43, 38), (40, 44),
          (35, 46), (29, 44), (28, 39), (30, 35)], "a", True)
    poly([(33, 33), (37, 33), (41, 34), (41, 38), (38, 42),
          (33, 44), (30, 41), (30, 38)], "A")
    poly([(33, 34), (36, 34), (39, 35), (39, 37), (33, 37),
          (31, 36)], "e")
    line([(31, 39), (34, 40), (39, 39), (41, 37)], "a")
    line([(34, 42), (37, 41)], "e")
    line([(32, 35), (34, 34), (36, 34)], "E")
    line([(27, 37), (26, 40), (28, 44)], "d")
    cluster(25, 34, [".gm", "gms", ".ss"])
    line([(27, 33), (28, 32)], "h")

    part = "front_leg"
    # Near thigh folds forward over the abdomen; the heel folds back under it.
    poly([(30, 42), (35, 42), (40, 45), (43, 49), (42, 53),
          (38, 55), (39, 57), (45, 57), (49, 59), (49, 60),
          (34, 60), (31, 58), (31, 54), (33, 51), (29, 49),
          (27, 46)], "m", True)
    poly([(30, 44), (35, 44), (38, 47), (39, 49), (37, 51),
          (33, 49), (29, 48)], "g")
    line([(31, 45), (34, 45), (36, 47)], "h")
    cluster(29, 45, ["hg.", ".ms"])
    cluster(38, 48, ["gm", ".s"])
    poly([(36, 53), (39, 52), (37, 56), (36, 58), (41, 58),
          (44, 59), (34, 59), (33, 57)], "s")
    line([(34, 56), (35, 54), (36, 54)], "g")
    # Webbing fans outward into three short toes, rather than a boot-shaped foot.
    poly([(38, 56), (41, 56), (45, 58), (47, 57), (50, 59),
          (48, 60), (40, 60), (37, 58)], "m", True)
    line([(40, 57), (43, 59)], "g")
    line([(44, 58), (46, 59)], "g")
    cluster(46, 58, ["..yt", "y..t", "t..."])

    part = "near_arm"
    # Near shoulder/arm: broad upper arm, jutting elbow, sagging heavy forearm.
    poly([(40, 27), (46, 28), (51, 32), (52, 37), (49, 42),
          (48, 45), (51, 46), (54, 44), (56, 45), (57, 49),
          (55, 53), (51, 54), (47, 52), (44, 53), (41, 50),
          (39, 47), (40, 42), (43, 38), (42, 34), (38, 31)], "m", True)
    poly([(41, 29), (45, 30), (48, 33), (48, 36), (45, 38),
          (42, 36), (42, 33), (40, 31)], "g")
    line([(42, 30), (44, 30), (46, 32)], "h")
    poly([(49, 34), (50, 36), (48, 40), (45, 43), (43, 47),
          (41, 47), (42, 43), (45, 38)], "s")
    poly([(42, 46), (45, 43), (47, 43), (47, 47), (49, 49),
          (46, 50), (43, 49)], "g")
    line([(43, 46), (45, 45), (46, 45)], "h")
    # A heavy webbed grasp, with three individually shaped hooked fingers.
    poly([(47, 47), (51, 47), (55, 49), (55, 52), (52, 54),
          (48, 53), (45, 50)], "m", True)
    poly([(51, 47), (54, 45), (57, 43), (60, 44), (60, 46),
          (57, 46), (55, 50), (53, 51)], "m", True)
    poly([(54, 50), (57, 47), (60, 47), (61, 49), (60, 50),
          (57, 50), (56, 53), (53, 53)], "s", True)
    poly([(51, 52), (55, 51), (58, 52), (59, 54), (57, 55),
          (54, 54), (51, 54)], "s", True)
    poly([(49, 48), (52, 48), (55, 46), (55, 48), (53, 51),
          (50, 51), (47, 50)], "g")
    line([(50, 48), (52, 49), (53, 48)], "h")
    line([(56, 45), (58, 44)], "g")
    line([(57, 48), (59, 48)], "m")
    line([(54, 53), (56, 53)], "m")
    cluster(59, 44, ["ye", ".a"])
    cluster(60, 48, ["e", "a"])
    cluster(58, 53, ["e", "a"])
    line([(48, 51), (50, 52), (52, 52)], "s")
    line([(45, 39), (47, 39)], "d")
    cluster(47, 33, ["h.", "gm"])
    cluster(43, 34, ["hg.", ".ms"])
    cluster(44, 41, ["mg", ".s"])

    part = "head"
    # Neck and large amphibian head lean out of the shell toward the opponent.
    poly([(32, 13), (38, 12), (45, 13), (49, 16), (51, 21),
          (50, 25), (45, 29), (38, 30), (33, 26), (29, 22),
          (28, 17)], "m", True)
    poly([(34, 15), (40, 14), (46, 15), (48, 17), (47, 21),
          (43, 24), (36, 24), (32, 21), (31, 18)], "g")
    poly([(35, 15), (39, 14), (44, 15), (45, 17), (39, 17),
          (34, 19), (32, 18)], "h")
    poly([(30, 22), (34, 24), (37, 27), (43, 27), (46, 25),
          (48, 26), (44, 28), (38, 29), (34, 27)], "s")
    poly([(38, 22), (41, 21), (43, 22), (44, 24), (41, 25),
          (38, 24)], "m")
    line([(39, 23), (41, 24)], "g")
    # Small angular ear/temple behind the near eye, partly buried in hair.
    poly([(30, 17), (27, 18), (27, 21), (30, 24), (32, 21),
          (32, 18)], "s", True)
    cluster(28, 18, ["gg.", "mss", ".ms", ".do"])
    # Water dish is a recessed organic bowl with a visible front wall.
    poly([(28, 10), (30, 7), (35, 5), (42, 5), (47, 7),
          (50, 10), (49, 13), (46, 15), (32, 15), (28, 13)], "s", True)
    poly([(30, 9), (34, 7), (42, 7), (46, 8), (48, 10),
          (46, 12), (32, 12), (30, 11)], "g")
    poly([(32, 9), (36, 8), (42, 8), (46, 9), (46, 10),
          (43, 11), (34, 11), (32, 10)], "w")
    line([(34, 9), (38, 8), (42, 9), (44, 9)], "W")
    cluster(35, 9, ["cc..c.", ".WccW."])
    cluster(35, 8, ["CC..c"])
    line([(31, 9), (34, 7), (41, 6), (45, 7), (47, 8)], "h")
    line([(30, 12), (33, 14), (42, 14), (47, 12)], "d")
    line([(33, 12), (38, 13), (44, 12), (47, 11)], "g")
    cluster(33, 12, ["hh...h.", ".ggggg."])
    # Wet straggling fringe: a few purposeful points, not scattered noise.
    cluster(28, 12, ["do...", "odso.", ".odmo", "..ods", "...od"])
    cluster(47, 12, ["so..", "dso.", ".do.", ".ods"])
    cluster(32, 14, ["d.s..", "sdo..", ".dsd.", "..dd."])
    cluster(29, 22, ["o...", "ds..", ".ds.", ".ods", "..od"])
    # Two eyes: the far socket is one narrow cluster; the near eye owns the face.
    cluster(35, 18, ["dso", "pRo", "sod"])
    cluster(42, 17, [
        "sdddo..",
        ".ooodo.",
        "..ppRo.",
        "..ypRo.",
        "...dds.",
    ])
    line([(42, 17), (45, 18), (48, 18)], "d")
    cluster(43, 16, ["hg..", ".gms"])
    # The upper hooked beak emerges below the brow and ends well beyond the jaw.
    poly([(46, 21), (49, 20), (52, 21), (58, 22), (60, 24),
          (59, 26), (57, 27), (53, 26), (49, 27), (45, 25)], "a", True)
    poly([(48, 22), (51, 21), (53, 22), (57, 23), (59, 24),
          (57, 25), (51, 24), (47, 24)], "A")
    line([(49, 21), (52, 22), (56, 23), (58, 24)], "e")
    cluster(50, 21, ["E..", ".ee"])
    cluster(54, 23, ["ao", ".a"])
    line([(47, 25), (50, 26), (54, 25), (57, 26)], "o")
    # Lower bill/jaw visible as a small lit plane beneath a dark crooked mouth.
    poly([(46, 26), (49, 27), (54, 27), (52, 29), (48, 29),
          (45, 27)], "A", True)
    line([(48, 28), (51, 28)], "e")
    cluster(42, 23, ["mg.", ".ms", "..s"])
    line([(37, 24), (39, 26), (43, 26)], "d")
    cluster(36, 22, ["hg", ".m"])
    cluster(33, 20, ["gm", ".s"])
    cluster(39, 28, ["mmgg", ".ss."])

    assert all(0 <= x < CELL and 0 <= y < CELL for x, y in authored)
    return im


def fallen(poly, line, cluster, im):
    # Separate drawing: shell on its side, splayed limbs, closed eye, spilled water.
    poly([(22, 51), (27, 50), (30, 54), (27, 58), (20, 60),
          (9, 60), (8, 58), (14, 56), (18, 55)], "s", True)
    poly([(14, 57), (20, 56), (24, 55), (23, 58), (18, 59),
          (11, 59)], "m")
    line([(13, 58), (16, 58)], "g")
    cluster(9, 59, ["y..y..y"])
    poly([(28, 47), (36, 47), (43, 51), (47, 55), (46, 59),
          (37, 60), (29, 59), (23, 55)], "s", True)
    poly([(29, 49), (35, 49), (40, 52), (38, 56), (29, 56),
          (26, 53)], "m")
    poly([(34, 51), (40, 51), (44, 54), (42, 58), (36, 58),
          (32, 55)], "A", True)
    line([(35, 53), (39, 53), (42, 55)], "e")
    line([(35, 56), (40, 56)], "a")
    # Carapace rolls onto its broad side; scutes and moss seams are retained.
    poly([(7, 46), (10, 40), (15, 36), (22, 35), (29, 38),
          (33, 43), (34, 49), (31, 54), (25, 57), (16, 56),
          (10, 53)], "b", True)
    poly([(10, 44), (15, 39), (22, 37), (27, 40), (30, 45),
          (28, 51), (22, 54), (15, 52), (10, 49)], "t")
    poly([(16, 39), (21, 38), (25, 40), (24, 45), (18, 46),
          (13, 43)], "T")
    line([(17, 40), (21, 39), (23, 40)], "y")
    poly([(12, 45), (16, 46), (18, 50), (15, 52), (11, 49)], "T")
    line([(12, 46), (14, 47)], "y")
    poly([(20, 47), (25, 46), (28, 48), (26, 52), (21, 53)], "T")
    line([(21, 48), (24, 47), (26, 48)], "y")
    cluster(13, 44, ["sgm", ".st"])
    cluster(24, 43, ["mg", "s."])
    line([(8, 47), (10, 51), (15, 54), (23, 55), (29, 52)], "B")
    # One leg sprawls over the shell rim; the second web foot is stretched out.
    poly([(29, 53), (34, 52), (38, 55), (38, 58), (46, 59),
          (46, 60), (34, 60), (31, 57)], "m", True)
    line([(32, 54), (35, 54), (36, 56)], "g")
    cluster(39, 59, ["mgy.mgy", ".bt..bt"])
    poly([(41, 51), (45, 49), (49, 51), (48, 54), (53, 56),
          (58, 57), (60, 59), (58, 60), (52, 59), (47, 58),
          (42, 56)], "m", True)
    poly([(44, 51), (47, 52), (46, 55), (50, 57), (46, 57),
          (43, 55)], "g")
    cluster(53, 57, ["mg.y", ".sm.", "...y"])
    # Lowered head and tilted shallow water dish remain one creature.
    poly([(47, 49), (51, 47), (56, 49), (58, 52), (61, 54),
          (61, 56), (57, 57), (53, 59), (49, 57), (45, 53)], "m", True)
    poly([(49, 50), (53, 49), (56, 51), (56, 54), (52, 55),
          (48, 53)], "g")
    line([(49, 51), (51, 50)], "h")
    line([(53, 52), (54, 53), (57, 53)], "d")
    poly([(56, 54), (59, 54), (61, 55), (59, 57), (55, 56)], "A", True)
    line([(57, 55), (59, 55)], "e")
    poly([(47, 48), (49, 46), (54, 46), (57, 48), (56, 50),
          (50, 51)], "s", True)
    line([(49, 47), (53, 47), (55, 48)], "h")
    line([(50, 48), (53, 48), (55, 49)], "w")
    cluster(51, 48, ["Wc"])
    # Spilled water stays inside the native cell and on the contact plane.
    line([(56, 49), (58, 51), (59, 53)], "W")
    cluster(58, 57, ["wWc..", ".WwWc", "wcWw.", ".www."])
    return im


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    im = draw()
    im.save(OUT / "kappa-native.png")
    enlarged = im.resize((384, 384), Image.Resampling.NEAREST)
    display = Image.new("RGBA", (384, 384), "#242d3b")
    display.alpha_composite(enlarged)
    display.convert("RGB").save(OUT / "kappa-study-6x-v3.png")
    display3 = Image.new("RGBA", (192, 192), "#242d3b")
    display3.alpha_composite(im.resize((192, 192), Image.Resampling.NEAREST))
    display3.convert("RGB").save(OUT / "kappa-study-3x-v3.png")
    alpha = set(im.getchannel("A").get_flattened_data())
    used = set(im.get_flattened_data()) - {(0, 0, 0, 0)}
    assert alpha == {0, 255}
    assert len(used) <= 24
    saved = Image.open(OUT / "kappa-native.png").convert("RGBA")
    assert saved.tobytes() == im.tobytes()
    report = {"status": "unapproved single-pose art draft", "cell": CELL,
              "colors": len(used), "alpha": sorted(alpha), "bbox": im.getbbox(),
              "sha256": hashlib.sha256(im.tobytes()).hexdigest(),
              "catalogWritten": False}
    (OUT / "pixels.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
