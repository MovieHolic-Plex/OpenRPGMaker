#!/usr/bin/env python3
"""Original, manually placed 48px pixels. No input images or image model.

Every silhouette, plane and highlight below is drawn on the final integer grid.
Only review images are enlarged (nearest neighbour); shipped cells stay 48px.
Run: python3 scripts/asset-gen/charset-battler/silver-swordswoman.py
"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
CELL = 48
ID = "silver-swordswoman"
PALETTE = {
    "o": "#1b2133", "d": "#30364d", "a": "#516377", "b": "#8cabc0",
    "c": "#cad6d4", "w": "#f3efda", "s": "#9b5550", "t": "#d18b70",
    "u": "#f1c59a", "k": "#442b49", "r": "#733c58", "R": "#ae5364",
    "h": "#de8586", "g": "#856442", "G": "#b99457", "L": "#edcb86",
}
POSES = [
    "idle", "attack", "hit", "defend", "dead", "victory",
    "walk_a", "walk_b", "walk_c", "attack_windup", "attack_strike", "attack_follow",
    "cast_charge", "cast_raise", "cast_release", "item", "weak", "evade",
    "guard_hit", "skill", "victory_b", "dying", "revive", "front",
]
CAST_TYPES = ["fire", "ice", "thunder", "heal", "dark", "arcane", "support"]


class Pixels:
    def __init__(self):
        self.im = Image.new("RGBA", (CELL, CELL))
        self.d = ImageDraw.Draw(self.im)

    def p(self, points, color):
        self.d.polygon(points, fill=PALETTE[color])

    def l(self, points, color, width=1):
        self.d.line(points, fill=PALETTE[color], width=width)

    def r(self, box, color):
        self.d.rectangle(box, fill=PALETTE[color])

    def dot(self, x, y, color):
        self.d.point((x, y), fill=PALETTE[color])


def head(p, x, y, hurt=False, front=False):
    """13px head: layered silver bangs, visible cheek and burgundy hair tie."""
    def pts(coords):
        return [(x + a, y + b) for a, b in coords]
    def poly(coords, c):
        p.p(pts(coords), c)
    def line(coords, c):
        p.l(pts(coords), c)
    def pixel(a, b, c):
        p.dot(x + a, y + b, c)
    # Hair crown and back of the head: no traced or sampled bitmap.
    poly([(0, 4), (1, 2), (4, 0), (9, 0), (12, 2), (14, 6), (13, 13),
          (10, 15), (7, 12), (2, 11), (-1, 8)], "o")
    poly([(1, 4), (3, 2), (8, 1), (11, 3), (12, 6), (12, 12),
          (10, 13), (8, 10), (2, 9), (0, 7)], "b")
    poly([(2, 4), (4, 2), (8, 2), (10, 3), (11, 6), (10, 10),
          (7, 9), (3, 8), (1, 7)], "b")
    poly([(3, 3), (5, 2), (8, 2), (9, 4), (7, 6), (3, 7), (1, 6)], "c")
    line([(4, 2), (7, 2), (8, 3)], "w")
    line([(2, 4), (2, 5)], "w")
    # Face is intentionally asymmetric in side view; leftward eye and nose.
    if front:
        poly([(3, 7), (10, 7), (10, 11), (8, 14), (5, 14), (3, 11)], "s")
        poly([(4, 7), (9, 7), (9, 11), (7, 13), (5, 12)], "u")
        line([(4, 9), (5, 9)], "o")
        line([(8, 9), (9, 9)], "o")
        pixel(4, 10, "b")
        pixel(8, 10, "b")
        line([(6, 12), (7, 12)], "s")
    else:
        poly([(1, 7), (8, 7), (9, 10), (7, 13), (3, 14), (1, 12),
              (0, 11), (0, 9)], "s")
        poly([(1, 8), (6, 7), (7, 10), (5, 12), (2, 12), (0, 11)], "t")
        poly([(1, 8), (5, 8), (5, 11), (2, 12), (0, 10)], "u")
        line([(0, 8), (3, 8)], "d")
        if hurt:
            line([(0, 9), (2, 10), (3, 9)], "o")
        else:
            line([(0, 9), (2, 9)], "o")
            pixel(1, 10, "b")
            pixel(2, 9, "w")
        pixel(0, 12, "s")
        pixel(3, 13, "u")
        # Fringe tucks behind the cheek rather than covering the only eye.
        poly([(5, 4), (10, 4), (12, 7), (11, 11), (9, 12), (8, 9),
              (7, 7), (4, 7), (2, 8), (2, 6)], "b")
        poly([(5, 4), (8, 4), (9, 6), (8, 9), (6, 6), (3, 7)], "c")
        line([(4, 4), (6, 5), (7, 7)], "w")
        line([(10, 7), (10, 10)], "a")
        pixel(5, 4, "w")
    line([(11, 12), (13, 12)], "r")
    line([(11, 13), (12, 13)], "h")
    pixel(10, 12, "L")


def sword(p, grip, tip):
    """Draw a 3px blade with a 1px light edge, hilt and crossguard."""
    gx, gy = grip
    tx, ty = tip
    # Dominant-axis stepped pixels keep the blade readable in all poses.
    dx, dy = tx - gx, ty - gy
    steps = max(abs(dx), abs(dy))
    axis = (1, 0) if abs(dy) >= abs(dx) else (0, 1)
    for i in range(3, steps + 1):
        x, y = gx + round(dx * i / steps), gy + round(dy * i / steps)
        if i == steps:
            p.dot(x, y, "w")
        else:
            p.dot(x - axis[0], y - axis[1], "o")
            p.dot(x, y, "b")
            p.dot(x + axis[0], y + axis[1], "c" if i % 4 else "w")
    # Guard is perpendicular to the blade.
    qx, qy = gx + round(dx * 2 / steps), gy + round(dy * 2 / steps)
    p.l([(qx - axis[0] * 3, qy - axis[1] * 3),
         (qx + axis[0] * 3, qy + axis[1] * 3)], "o", 3)
    p.l([(qx - axis[0] * 3, qy - axis[1] * 3),
         (qx + axis[0] * 3, qy + axis[1] * 3)], "G")
    p.dot(qx + axis[0] * 2, qy + axis[1] * 2, "L")
    p.r((gx - 1, gy - 1, gx + 1, gy + 1), "g")
    p.dot(gx, gy, "L")


def arm(p, shoulder, elbow, hand, near=True):
    sx, sy = shoulder
    ex, ey = elbow
    hx, hy = hand
    # Three connected filled planes, not a stick limb or resized cutout.
    p.l([shoulder, elbow, hand], "o", 5)
    p.l([shoulder, elbow], "a" if near else "d", 3)
    p.l([(sx - 1, sy), (ex - 1, ey)], "b" if near else "a")
    p.l([elbow, hand], "r" if near else "k", 3)
    p.l([(ex, ey - 1), (hx, hy - 1)], "G" if near else "g")
    p.r((hx - 1, hy - 1, hx + 1, hy + 1), "s")
    p.l([(hx - 1, hy - 1), (hx, hy - 1)], "u")
    p.dot(hx - 1, hy, "t")


def leg(p, hip, knee, ankle, near=True):
    hx, hy = hip
    kx, ky = knee
    ax, ay = ankle
    p.l([hip, knee, ankle], "o", 6)
    p.l([hip, knee], "d", 4)
    p.l([(hx - 1, hy), (kx - 1, ky)], "a" if near else "d", 2)
    # Silver greave, dark foot and bronze cuff.
    p.l([knee, ankle], "a" if near else "d", 4)
    p.l([(kx - 1, ky), (ax - 1, ay - 1)], "b" if near else "a")
    p.l([(kx - 1, ky), (kx + 1, ky)], "G" if near else "g")
    p.p([(ax - 3, ay), (ax + 2, ay), (ax + 2, 44), (ax - 5, 44),
         (ax - 5, 43)], "o")
    p.l([(ax - 4, 43), (ax + 1, 43)], "a" if near else "d")
    p.dot(ax - 3, 43, "b" if near else "a")


def standing(pose, cast=None):
    p = Pixels()
    # Integer joint targets, individually authored for each action.
    spec = {
        "idle": (0, 0, (22, 36, 19), (29, 36, 30), (16, 26), (9, 10), (31, 26)),
        "attack": (-4, 1, (17, 36, 12), (29, 37, 33), (14, 22), (2, 23), (23, 24)),
        "hit": (3, 1, (23, 36, 20), (32, 37, 32), (26, 27), (16, 39), (37, 22)),
        "defend": (-1, 3, (20, 37, 18), (28, 37, 31), (18, 25), (14, 8), (22, 26)),
        "victory": (0, -1, (21, 36, 19), (29, 36, 30), (18, 17), (11, 2), (35, 16)),
        "walk_a": (-1, 0, (19, 36, 14), (29, 36, 32), (17, 26), (9, 11), (32, 27)),
        "walk_b": (0, -1, (22, 36, 21), (28, 36, 28), (17, 26), (9, 10), (30, 27)),
        "walk_c": (1, 0, (25, 36, 28), (27, 36, 18), (18, 26), (10, 11), (31, 26)),
        "attack_windup": (2, -1, (23, 36, 20), (30, 36, 33), (32, 16), (42, 3), (32, 19)),
        "attack_strike": (-3, 0, (17, 36, 13), (28, 37, 33), (14, 20), (3, 7), (23, 23)),
        "attack_follow": (-4, 2, (17, 37, 12), (29, 37, 33), (14, 27), (4, 40), (23, 26)),
        "cast_charge": (0, 1, (22, 36, 20), (28, 36, 29), (17, 22), None, (19, 23)),
        "cast_raise": (0, -1, (22, 36, 20), (28, 36, 29), (17, 9), None, (32, 8)),
        "cast_release": (-2, 1, (20, 36, 18), (28, 36, 31), (10, 21), None, (14, 22)),
        "item": (0, 0, (22, 36, 20), (29, 36, 30), (14, 17), None, (31, 28)),
        "weak": (-2, 8, (16, 39, 16), (29, 41, 30), (19, 32), (10, 43), (25, 33)),
        "evade": (5, 2, (24, 36, 18), (33, 38, 38), (29, 27), (18, 39), (40, 22)),
        "guard_hit": (1, 4, (20, 37, 18), (30, 38, 33), (20, 26), (16, 9), (24, 27)),
        "skill": (-2, 0, (19, 37, 14), (29, 37, 33), (15, 19), (3, 4), (31, 17)),
        "victory_b": (0, 0, (21, 36, 19), (29, 36, 30), (18, 16), (10, 2), (36, 13)),
        "dying": (2, 12, (20, 41, 17), (30, 41, 31), (20, 39), (5, 42), (32, 37)),
        "revive": (-1, 6, (19, 39, 17), (29, 40, 30), (19, 32), (13, 43), (28, 30)),
        "front": (0, 0, (22, 36, 20), (29, 36, 30), (18, 28), (13, 12), (33, 28)),
    }
    ox, oy, left, right, hand, tip, backhand = spec[pose]
    bx, by = 25 + ox, 22 + oy
    hx, hy = 20 + ox, 4 + oy
    # Cloth and trailing silver hair silhouette behind armor and limbs.
    p.p([(bx + 5, by - 4), (bx + 10, by + 4), (bx + 13, 34),
         (bx + 10, 37), (bx + 5, 35), (bx + 2, by + 4)], "o")
    p.p([(bx + 6, by - 2), (bx + 9, by + 6), (bx + 11, 34),
         (bx + 8, 35), (bx + 4, 33), (bx + 3, by + 4)], "k")
    p.p([(bx + 6, by), (bx + 8, by + 5), (bx + 8, 33),
         (bx + 6, 32), (bx + 4, by + 4)], "r")
    p.l([(bx + 8, by + 6), (bx + 10, 34), (bx + 8, 35)], "R")
    p.dot(bx + 10, 35, "G")
    p.p([(hx + 11, hy + 8), (hx + 16, hy + 12), (hx + 18, hy + 20),
         (hx + 17, hy + 24), (hx + 14, hy + 27), (hx + 12, hy + 23),
         (hx + 10, hy + 21), (hx + 9, hy + 11)], "o")
    p.p([(hx + 12, hy + 10), (hx + 15, hy + 14), (hx + 17, hy + 20),
         (hx + 16, hy + 23), (hx + 14, hy + 25), (hx + 13, hy + 21),
         (hx + 11, hy + 19)], "a")
    p.p([(hx + 12, hy + 12), (hx + 14, hy + 14), (hx + 15, hy + 20),
         (hx + 14, hy + 22), (hx + 12, hy + 19)], "b")
    p.l([(hx + 12, hy + 13), (hx + 13, hy + 17), (hx + 14, hy + 19)], "c")
    p.dot(hx + 13, hy + 16, "w")
    # Back arm before torso; legs before split coat panels.
    arm(p, (bx + 5, by), (bx + 7, by + 5), backhand, near=False)
    leg(p, (bx + 3, min(by + 9, 35)), (right[0], right[1]), (right[2], 42), False)
    leg(p, (bx - 3, min(by + 9, 35)), (left[0], left[1]), (left[2], 42), True)
    # Neck, fitted breastplate, waist and burgundy split skirt.
    p.r((bx - 2, by - 5, bx + 2, by - 1), "s")
    p.r((bx - 2, by - 5, bx, by - 2), "u")
    p.p([(bx - 5, by - 2), (bx + 3, by - 3), (bx + 6, by),
         (bx + 3, by + 7), (bx - 3, by + 7), (bx - 6, by + 2)], "o")
    p.p([(bx - 4, by - 1), (bx + 2, by - 2), (bx + 4, by),
         (bx + 2, by + 5), (bx - 3, by + 5), (bx - 4, by + 2)], "a")
    p.p([(bx - 3, by - 1), (bx, by - 1), (bx + 1, by + 2),
         (bx - 1, by + 4), (bx - 3, by + 3)], "b")
    p.l([(bx - 3, by), (bx - 2, by + 2)], "c")
    p.l([(bx + 1, by - 1), (bx + 3, by), (bx + 2, by + 4)], "d")
    p.l([(bx - 4, by - 2), (bx - 1, by - 1), (bx + 2, by - 2)], "G")
    p.dot(bx - 2, by - 2, "L")
    p.p([(bx - 5, by + 7), (bx + 3, by + 7), (bx + 6, min(by + 13, 40)),
         (bx + 2, min(by + 14, 41)), (bx, by + 9),
         (bx - 2, min(by + 13, 40)), (bx - 7, min(by + 12, 39))], "o")
    p.p([(bx - 4, by + 8), (bx - 1, by + 8), (bx - 3, min(by + 12, 39)),
         (bx - 6, min(by + 11, 38))], "R")
    p.l([(bx - 4, by + 8), (bx - 5, min(by + 10, 37))], "h")
    p.p([(bx + 1, by + 8), (bx + 3, by + 8), (bx + 4, min(by + 12, 39)),
         (bx + 2, min(by + 13, 40))], "r")
    p.l([(bx - 5, min(by + 11, 39)), (bx - 3, min(by + 12, 40))], "G")
    p.l([(bx - 4, by + 6), (bx + 3, by + 6)], "g", 2)
    p.l([(bx - 3, by + 6), (bx + 2, by + 6)], "G")
    p.r((bx - 1, by + 5, bx, by + 7), "L")
    # Head and near shoulder are drawn over hair/cape.
    head(p, hx, hy, pose in {"hit", "guard_hit", "weak", "dying"}, pose == "front")
    if tip:
        sword(p, hand, tip)
    elbow = (round((bx - 4 + hand[0]) / 2) - 2, max(by + 3, hand[1] - 1))
    if pose in {"victory", "victory_b", "attack_windup", "cast_raise"}:
        elbow = (hand[0] + (2 if hand[0] < bx else -2), hand[1] + 5)
    arm(p, (bx - 5, by), elbow, hand)
    p.p([(bx - 7, by - 2), (bx - 4, by - 3), (bx - 1, by - 1),
         (bx - 2, by + 2), (bx - 7, by + 2), (bx - 8, by)], "o")
    p.p([(bx - 6, by - 2), (bx - 4, by - 2), (bx - 2, by - 1),
         (bx - 3, by + 1), (bx - 6, by + 1)], "b")
    p.l([(bx - 6, by - 2), (bx - 4, by - 2)], "c")
    p.l([(bx - 7, by + 1), (bx - 3, by + 1)], "G")
    if pose == "item":
        p.r((hand[0] - 2, hand[1] - 6, hand[0] + 1, hand[1] - 2), "o")
        p.r((hand[0] - 1, hand[1] - 5, hand[0], hand[1] - 2), "R")
        p.dot(hand[0] - 1, hand[1] - 5, "h")
        p.l([(hand[0] - 1, hand[1] - 7), (hand[0], hand[1] - 7)], "G")
    if cast is not None:
        kind, step = cast
        color = ["h", "c", "L", "u", "r", "b", "G"][kind]
        cx, cy = hand[0] - 4, hand[1] - 2
        # Sparse manually placed hand light; no blur or baked large spell effect.
        p.p([(cx, cy - 2), (cx + 2, cy), (cx, cy + 2), (cx - 2, cy)], color)
        p.dot(cx, cy, "w")
        p.dot(cx - 3, cy - 3 + step, color)
        p.dot(cx + 1, cy - 4, color)
    return p.im


def fallen():
    """Separate prone drawing, not the standing bitmap rotated sideways."""
    p = Pixels()
    # Long silver hair spreads on the floor under the head on the right.
    p.p([(30, 32), (37, 30), (42, 33), (44, 38), (42, 43),
         (33, 44), (29, 42), (32, 39)], "o")
    p.p([(33, 33), (39, 32), (42, 35), (42, 41), (34, 43), (31, 42)], "a")
    p.p([(36, 33), (40, 34), (41, 39), (36, 42), (33, 41)], "b")
    p.l([(37, 34), (40, 36), (40, 39), (37, 41)], "c")
    p.p([(9, 36), (22, 34), (31, 36), (34, 41), (30, 44), (14, 44), (9, 42)], "o")
    p.p([(12, 37), (22, 35), (28, 36), (31, 40), (27, 42), (13, 42)], "k")
    p.l([(14, 41), (23, 42), (28, 41)], "R")
    p.p([(7, 38), (18, 37), (21, 40), (18, 43), (5, 44), (3, 42)], "o")
    p.p([(7, 39), (16, 38), (17, 41), (7, 42)], "a")
    p.l([(9, 39), (15, 39)], "b")
    p.r((4, 42, 8, 43), "d")
    p.p([(23, 34), (30, 34), (34, 37), (32, 41), (26, 42), (23, 39)], "o")
    p.p([(25, 35), (29, 35), (32, 37), (30, 40), (26, 40)], "a")
    p.l([(26, 35), (29, 36), (30, 37)], "c")
    p.l([(23, 36), (23, 40)], "G")
    p.p([(34, 35), (39, 35), (40, 38), (38, 41), (33, 40), (32, 38)], "s")
    p.p([(34, 36), (38, 36), (38, 39), (34, 39)], "u")
    p.l([(35, 38), (37, 38)], "o")
    p.l([(28, 38), (27, 41), (33, 42)], "o", 4)
    p.l([(28, 38), (28, 40), (33, 41)], "r", 2)
    p.r((32, 40, 34, 42), "t")
    p.dot(33, 40, "u")
    sword(p, (12, 34), (2, 33))
    return p.im


def preview_cell(im, scale=8):
    out = Image.new("RGB", (CELL * scale, CELL * scale), "#242b3b")
    enlarged = im.resize(out.size, Image.Resampling.NEAREST)
    out.paste(enlarged, (0, 0), enlarged)
    return out


def main():
    public = ROOT / "public/assets/generated/charset-battlers"
    source = ROOT / "tiledata/charset-battlers" / ID
    review = ROOT / "verify-shots/silver-swordswoman"
    for folder in (public / "cast", source / "cast", review):
        folder.mkdir(parents=True, exist_ok=True)
    sheet = Image.new("RGBA", (144, 384))
    cells = []
    for i, pose in enumerate(POSES):
        im = fallen() if pose == "dead" else standing(pose)
        cells.append(im)
        im.save(source / f"{pose}.png")
        sheet.paste(im, ((i % 3) * CELL, (i // 3) * CELL))
    sheet.save(public / f"{ID}.png")
    cast_sheet = Image.new("RGBA", (144, 336))
    for row, kind in enumerate(CAST_TYPES):
        for col, pose in enumerate(["cast_charge", "cast_raise", "cast_release"]):
            im = standing(pose, (row, col))
            im.save(source / "cast" / f"{kind}-{col}.png")
            cast_sheet.paste(im, (col * CELL, row * CELL))
    cast_sheet.save(public / "cast" / f"{ID}.png")
    cells[0].save(review / "idle-native.png")
    preview_cell(cells[0]).save(review / "idle-8x.png")
    # Review contact sheet: labels outside cells, no smoothing.
    scale, label = 4, 18
    board = Image.new("RGB", (3 * CELL * scale, 8 * (CELL * scale + label)), "#242b3b")
    draw = ImageDraw.Draw(board)
    for i, (pose, im) in enumerate(zip(POSES, cells)):
        x, y = (i % 3) * CELL * scale, (i // 3) * (CELL * scale + label)
        draw.text((x + 8, y + 3), pose, fill="#cad6d4")
        board.paste(preview_cell(im, scale), (x, y + label))
    board.save(review / "poses-4x.png")
    # Authored-frame preview, not a recording or a fabricated game scene.
    sequence = [
        ("idle", 600), ("walk_a", 120), ("walk_b", 120), ("walk_c", 120),
        ("walk_b", 120), ("attack_windup", 240), ("attack_strike", 100),
        ("attack", 180), ("attack_follow", 240), ("idle", 400),
        ("defend", 500), ("guard_hit", 200), ("idle", 400),
        ("cast_charge", 400), ("cast_raise", 400), ("cast_release", 400),
        ("victory", 240), ("victory_b", 240), ("victory", 240),
        ("hit", 200), ("dying", 240), ("dead", 600), ("revive", 300),
    ]
    frames = [preview_cell(cells[POSES.index(pose)], 6) for pose, ms in sequence]
    frames[0].save(review / "authored-poses.gif", save_all=True, append_images=frames[1:],
                   duration=[ms for pose, ms in sequence], loop=0, disposal=2)
    receipt = {}
    for filename, image, rows in [(f"{ID}.png", sheet, 8), (f"cast/{ID}.png", cast_sheet, 7)]:
        # Reopen the shipped PNG, then inspect every cell on the final pixel grid.
        loaded = Image.open(public / filename).convert("RGBA")
        colors = loaded.getcolors(144 * rows * CELL)
        opaque = {rgba for count, rgba in colors if rgba[3]}
        assert loaded.size == (144, rows * CELL)
        assert len(opaque) <= 16
        assert {rgba[3] for count, rgba in colors} <= {0, 255}
        bounds = []
        for i in range(rows * 3):
            cell = loaded.crop(((i % 3) * CELL, (i // 3) * CELL,
                                (i % 3 + 1) * CELL, (i // 3 + 1) * CELL))
            bbox = cell.getbbox()
            assert bbox and bbox[0] > 0 and bbox[1] > 0 and bbox[2] < CELL and bbox[3] == 45, (filename, i, bbox)
            bounds.append(bbox)
        receipt[filename] = {"size": loaded.size, "opaqueColors": len(opaque),
                             "alpha": [0, 255], "bounds": bounds,
                             "sha256": hashlib.sha256((public / filename).read_bytes()).hexdigest()}
    (review / "pixels.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps({"resourceId": f"charset-battler-{ID}", "sheets": receipt}))


if __name__ == "__main__":
    main()
