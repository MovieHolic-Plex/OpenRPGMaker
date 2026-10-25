#!/usr/bin/env python3
"""Option B: hand-dotted 4-direction field walking charsets for four Fallen Star
forest foes (wolf, spider, wisp, boar).

Output: out/option-b.png, RM2000 CharSet 288x256 (8 slots of 72x128, slots 0-3 used).
Inside a slot: 3 cols x 4 rows of 24x32 frames; rows = up, right, down, left;
col 1 = stand, cols 0/2 = walk steps (cycle 0,1,2,1).

Drawing method: fill-only row strings (one char = one pixel, '.' = empty) per
body part, legs placed per frame from small hand-picked coordinate tables, then
an automatic 1px outline in the creature's darkest colour. Palettes are taken
from each creature's 64x64 battler in public/assets/generated/pixel-enemy-portraits.
Left rows are mirrored from right rows (all four read fine mirrored).

NOT gated: this art has not passed the object-gate 3/4 check.
"""
from __future__ import annotations

import os
import sys
from PIL import Image

FW, FH = 24, 32
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out", "option-b.png")


def hexc(h: str):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


class Canvas:
    """24x32 grid of palette keys (None = empty)."""

    def __init__(self):
        self.g = [[None] * FW for _ in range(FH)]

    def put(self, x, y, k):
        if 0 <= x < FW and 0 <= y < FH and k is not None:
            self.g[y][x] = k

    def rows(self, y0, rows, dx=0, dy=0, under=False):
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch == ".":
                    continue
                x, y = i + dx, y0 + j + dy
                if under and 0 <= y < FH and 0 <= x < FW and self.g[y][x] is not None:
                    continue
                self.put(x, y, ch)

    def line(self, x0, y0, x1, y1, k, w=1, under=False):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for s in range(n + 1):
            x = round(x0 + (x1 - x0) * s / n)
            y = round(y0 + (y1 - y0) * s / n)
            for o in range(w):
                if under and self.g[y][x + o] is not None:
                    continue
                self.put(x + o, y, k)

    def outline(self, k="o"):
        add = []
        for y in range(FH):
            for x in range(FW):
                if self.g[y][x] is not None:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < FW and 0 <= yy < FH and self.g[yy][xx] not in (None, k):
                        add.append((x, y))
                        break
        for x, y in add:
            self.g[y][x] = k

    def image(self, pal):
        im = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        px = im.load()
        for y in range(FH):
            for x in range(FW):
                k = self.g[y][x]
                if k is not None:
                    px[x, y] = pal[k]
        return im


def sym(halves):
    """12-char left halves -> mirrored 24-char rows."""
    out = []
    for h in halves:
        assert len(h) == 12, (h, len(h))
        out.append(h + h[::-1])
    return out


def chk(rows):
    for r in rows:
        assert len(r) <= FW, (r, len(r))
    return rows


# ---------------------------------------------------------------- wolf
WOLF_PAL = {
    "o": hexc("#14161e"), "q": hexc("#323844"), "d": hexc("#464e5c"),
    "m": hexc("#6e7886"), "l": hexc("#96a0ac"), "h": hexc("#c4ccd4"),
    "c": hexc("#e2dece"), "s": hexc("#c4beae"), "y": hexc("#f0c838"),
}

WOLF_R = chk([  # y=11..22, facing right; light back = top surface
    "...............dd.d.....",
    "..............ddmdm.....",
    "..........h.h.mmmmmm....",
    ".........hlhlhmmmmymm...",
    "........lllllhmmmmmmmo..",
    "..dd...llllllmmmmmcccc..",
    ".dmm..lllllllmmmmcc.....",
    ".dl..llllllllmmmmc......",
    "..mllllllllllmmmmc......",
    "...dmmmmmmmmmmmmmc......",
    "....dmmmmmmmmmmmcc......",
    ".....dssssssssmmc.......",
])
# legs: (x_top, x_bottom, colour) for [far_back, near_back, far_front, near_front]
WOLF_R_LEGS = {
    1: [(6, 6, "d"), (8, 8, "m"), (13, 13, "d"), (15, 15, "m")],
    0: [(6, 8, "d"), (8, 5, "m"), (13, 11, "d"), (15, 18, "m")],
    2: [(6, 4, "d"), (8, 10, "m"), (13, 16, "d"), (15, 13, "m")],
}

WOLF_D = sym([  # y=7..22 facing camera: tall ears, mane collar, narrow muzzle
    ".......d....",
    ".......dd...",
    ".......dhd..",
    "......ddhdmm",
    "..h.h.dmmmmm",
    "..hlhlmmmmmm",
    "..lllmmmmmmm",
    "..llmmmmymmm",
    "..dlmmmmmmcc",
    "..ddmmmmmscc",
    "...ddmmmmscc",
    "....ddmmmsco",
    ".....dddmmcc",
    "......dmmm..",
    "......dmmm..",
    "......dd....",
])
WOLF_U = sym([  # y=8..21 facing away: ears, mane, dark saddle down the spine
    ".......d....",
    ".......dd...",
    ".......ddmmm",
    ".......mmmmm",
    ".....h.hmmmm",
    "....hlhlhmmm",
    "...lllllllmm",
    "...lllllllmd",
    "...dllllllmd",
    "...dlllllllm",
    "....dllllllm",
    "....ddmmmmmm",
    ".....ddmmmmm",
    "......ddd...",
])
WOLF_U_TAIL = sym([  # y=19..26, bushy tail hanging toward camera, drawn over legs
    "..........dm",
    "..........ml",
    ".........dml",
    ".........dlh",
    ".........dlh",
    "..........dh",
    "..........dd",
    "............",
])


def wolf_frame(direction, f):
    c = Canvas()
    if direction == "right":
        c.rows(11, WOLF_R)
        legs = WOLF_R_LEGS[f]
        for xt, xb, k in legs:
            c.line(xt, 23, xb, 29, k, w=2)
            c.put(xb, 30, "q"); c.put(xb + 1, 30, "q")
    elif direction == "down":
        lift = {0: (0, 2), 1: (0, 0), 2: (2, 0)}[f]
        for x, k, top, l in ((3, "d", 16, lift[1]), (19, "d", 16, lift[0])):  # back legs, peeking out
            for y in range(top, 28 - l):
                c.put(x, y, k); c.put(x + 1, y, k)
        for (x, l) in ((6, lift[0]), (16, lift[1])):
            for y in range(20, 30 - l):
                c.put(x, y, "m"); c.put(x + 1, y, "m")
            c.put(x, 30 - l, "q"); c.put(x + 1, 30 - l, "q")
        c.rows(7, WOLF_D)
    elif direction == "up":
        lift = {0: (0, 2), 1: (0, 0), 2: (2, 0)}[f]
        for x, k, top, l in ((4, "d", 16, lift[1]), (18, "d", 16, lift[0])):
            for y in range(top, 27 - l):
                c.put(x, y, k); c.put(x + 1, y, k)
        for (x, l) in ((7, lift[0]), (15, lift[1])):
            for y in range(19, 30 - l):
                c.put(x, y, "m"); c.put(x + 1, y, "m")
            c.put(x, 30 - l, "q"); c.put(x + 1, 30 - l, "q")
        c.rows(8, WOLF_U)
        c.rows(19, WOLF_U_TAIL)
    c.outline("o")
    return c


# ---------------------------------------------------------------- spider
SPI_PAL = {
    "o": hexc("#18101e"), "q": hexc("#281e38"), "d": hexc("#3a2c4e"),
    "m": hexc("#5a4674"), "l": hexc("#80689c"), "h": hexc("#aa94c4"),
    "r": hexc("#c82832"), "f": hexc("#c8b482"), "e": hexc("#ff5a64"),
}
SPI_R_BODY = chk([  # y=13..25, abdomen left, head right
    "....lhhl................",
    "..lhhlllll..............",
    ".lhlllllmml.............",
    ".llllrrlmmmm............",
    "lllmllrlmmmm.lll........",
    "lllmlrrrmmmmlhllll......",
    "dlmmmmmmmmmmllllelm.....",
    "dmmmmmmmmmmdmmmmmmm.....",
    ".dmmmmmmmmdddmmmmmf.....",
    "..ddmmmmmdd..dmmmff.....",
    "....dddd......ddd.f.....",
])
# spider legs: list of (hip x, hip y, knee x, knee y, foot x) — foot y fixed 29/30
SPI_R_LEGS = {
    1: [(11, 20, 9, 16, 6), (12, 21, 11, 17, 10), (14, 21, 15, 17, 14), (15, 21, 18, 16, 20)],
    0: [(11, 20, 8, 16, 5), (12, 21, 12, 17, 11), (14, 21, 14, 17, 13), (15, 21, 19, 16, 21)],
    2: [(11, 20, 9, 17, 7), (12, 21, 10, 16, 9), (14, 21, 16, 16, 16), (15, 21, 17, 17, 19)],
}

SPI_D_BODY = sym([  # y=9..25 facing camera: abdomen behind (top), head front
    ".........lll",
    ".......lhhll",
    "......lhllll",
    "......llllrr",
    "......lllllr",
    "......dllrrr",
    ".......ddlll",
    "........mlll",
    ".......mlhll",
    ".......mllll",
    ".......mmlem",
    ".......dmmem",
    "........dmmm",
    "........dfmm",
    "........f.dm",
    "........f...",
])
SPI_U_BODY = sym([  # y=10..25 facing away: big abdomen toward camera
    ".........lll",
    "........lmml",
    "........dmml",
    ".........lll",
    ".......lhhll",
    "......lhllll",
    "......hlllll",
    ".....lllllrr",
    ".....lllllrr",
    ".....llllllr",
    ".....dllllrr",
    "......dlllll",
    ".......dmmmm",
    "........dddd",
])


def spider_frame(direction, f):
    c = Canvas()
    if direction == "right":
        for i, (hx, hy, kx, ky, fx) in enumerate(SPI_R_LEGS[f]):
            k = "d" if i % 2 == 0 else "m"
            c.line(hx, hy, kx, ky, k)
            c.line(kx, ky, fx, 29, k)
        c.rows(13, SPI_R_BODY)
    else:
        # 4 legs per side arching out; feet alternate lift
        up = direction == "up"
        base_y = 21 if not up else 20
        # (hip dx from centre, knee x, knee y, foot x) left side; mirrored right
        spec = [(3, 2, base_y - 8, 0), (3, 1, base_y - 4, 2), (3, 2, base_y - 1, 5), (2, 5, base_y + 2, 8)]
        for side in (-1, 1):
            for i, (hd, kx, ky, fx) in enumerate(spec):
                lift = 0
                if f == 0 and (i % 2 == (0 if side < 0 else 1)):
                    lift = 2
                if f == 2 and (i % 2 == (1 if side < 0 else 0)):
                    lift = 2
                fy = 29 - lift
                k = "m" if i % 2 else "d"
                if side < 0:
                    hx, kx2, fx2 = 12 - hd - 1, kx, fx
                else:
                    hx, kx2, fx2 = 11 + hd + 1, 23 - kx, 23 - fx
                hy = base_y - 1 + i
                c.line(hx, hy, kx2, ky - lift, k)
                c.line(kx2, ky - lift, fx2, fy, k)
        if up:
            c.rows(10, SPI_U_BODY)
        else:
            c.rows(9, SPI_D_BODY)
    c.outline("o")
    return c


# ---------------------------------------------------------------- wisp
WISP_PAL = {
    "o": hexc("#0e163a"), "d": hexc("#2446aa"), "m": hexc("#3c78e6"),
    "l": hexc("#78beff"), "w": hexc("#fafeff"), "p": hexc("#d2f0ff"),
}
# facing right: flame licks up, tail trails left, eye on the right
WISP_R = [
    chk([  # flicker A (y=6..25): tall crown spike, tail licks back left, eye right
        "...........m............",
        "...........mm...........",
        "..........mlm...........",
        "......m...mlm...m.......",
        "......mm.mllm..mm.......",
        ".......mmmllm.mlm.......",
        ".......mlmlllmllm.......",
        "..m....mllllllllmm......",
        "..mmm.mlllllllllllm.....",
        "...mlmllllllllllllmm....",
        "....mlllllllpplllwwm....",
        "..mmmllllllppwpllwwmm...",
        "...dmmlllllpwwplllllmd..",
        "....dmmlllllppllllllmd..",
        "...dmmmmlllllllllllmd...",
        "....ddmmmlllllllllmmd...",
        "......ddmmmmllllmmdd....",
        "........ddmmmmmmdd......",
        "..........dddddd........",
    ]),
    chk([  # flicker B
        "............m...........",
        "...........mm...........",
        "...........mlm..........",
        ".....m....mlm....m......",
        "......m..mllm...mm......",
        "......mm.mllm..mlm......",
        ".......mmlllmmmllm......",
        ".m.....mllllllllmm......",
        "..mm..mlllllllllllm.....",
        "..mlmmllllllllllllmm....",
        "...mmlllllllpplllwwm....",
        "...mmllllllppwpllwwmm...",
        "...dmmlllllpwwplllllmd..",
        "....dmmlllllppllllllmd..",
        "...dmmmmlllllllllllmd...",
        "....ddmmmlllllllllmmd...",
        "......ddmmmmllllmmdd....",
        "........ddmmmmmmdd......",
        "..........dddddd........",
    ]),
]
_WISP_TOP = [
    [  # flicker A
        "...........m",
        "...........m",
        "..........ml",
        "....m.....ml",
        "....mm...mll",
        ".....m...mll",
        ".....mm.mlll",
        ".m...mlmmlll",
        ".mm..mllllll",
        "..mmmlllllll",
    ],
    [  # flicker B
        "............",
        "..........mm",
        "..........ml",
        "...m......ml",
        "....m...mmll",
        "....mm..mlll",
        ".....mm.mlll",
        "..m..mlmmlll",
        "..mm.mllllll",
        "..mmmlllllll",
    ],
]
_WISP_D_LOW = [
    "...mllllllpp",
    "..dmlllllppw",
    "..dmllllpwww",
    "..dmllllpwwo",
    "..dmmlllpwww",
    "...dmlllllpp",
    "...dmmllllll",
    "....ddmmmlll",
    "......ddmmmm",
    "........dddd",
]
_WISP_U_LOW = [
    "...mllllllll",
    "..dmllllllll",
    "..dmmlllllll",
    "..dmmlllllll",
    "..dmmmllllll",
    "...dmmmlllll",
    "...ddmmmmlll",
    "....dddmmmmm",
    "......dddmmm",
    "........dddd",
]
WISP_D = [sym(t + _WISP_D_LOW) for t in _WISP_TOP]
WISP_U = [sym(t + _WISP_U_LOW) for t in _WISP_TOP]


def wisp_frame(direction, f):
    c = Canvas()
    bob = {0: 1, 1: 0, 2: -1}[f]
    flick = 0 if f != 2 else 1
    if direction == "right":
        c.rows(6, WISP_R[flick], dy=bob)
    elif direction == "down":
        c.rows(6, WISP_D[flick], dy=bob)
    else:
        c.rows(6, WISP_U[flick], dy=bob)
    c.outline("o")
    return c


# ---------------------------------------------------------------- boar
BOAR_PAL = {
    "o": hexc("#1e1410"), "b": hexc("#3a2218"), "d": hexc("#4e2e1e"),
    "m": hexc("#784a2e"), "l": hexc("#a06a42"), "t": hexc("#ded2b0"),
    "e": hexc("#d23c28"), "n": hexc("#5c3a26"),
}
BOAR_R = chk([  # y=13..24 facing right, head low, mane bristles on top
    "........b.b.b...........",
    ".......bbbbbbb.b........",
    "......bbbbbbbbbbb.......",
    "....lllllllllbbbmm......",
    "...llllllllllllmmmm.....",
    "..dlllllllllllmmmemm....",
    ".ddlmmmmmmmmmmmmmmmmnn..",
    ".dmmmmmmmmmmmmmmmmmmnnn.",
    "..dmmmmmmmmmmmmmmmtmm...",
    "...dmmmmmmmmmmmmmtt.....",
    "....ddmmmmmmmmmmdt......",
    ".....dddddddddddd.......",
])
BOAR_R_LEGS = {
    1: [(5, 5, "d"), (7, 7, "m"), (14, 14, "d"), (16, 16, "m")],
    0: [(5, 7, "d"), (7, 5, "m"), (14, 13, "d"), (16, 18, "m")],
    2: [(5, 4, "d"), (7, 9, "m"), (14, 16, "d"), (16, 15, "m")],
}
BOAR_D = sym([  # y=9..23 facing camera: mane hump, disc snout, upturned tusks
    "........b.b.",
    ".......bbbbb",
    ".....bbbbbbb",
    "...llbbbbbbb",
    "..lllllbbbbb",
    ".dlllmmmmbbb",
    ".dllmmmmmmmm",
    ".dlmmmmemmmm",
    ".ddmmmmmmmmm",
    "..dmmmtmmnnn",
    "..ddmmtmnnnn",
    "...dmmmtnbbn",
    "...ddmmmnnnn",
    ".....dddnnnn",
    ".......dddd.",
])
BOAR_U = sym([  # y=8..24 facing away: head far, mane down the spine, rump near
    "........d...",
    "........dmmm",
    ".......bmmmm",
    ".....b.lbbbb",
    "....blllbbbb",
    "...llllllbbb",
    "..lllllllbbb",
    "..llllllllbb",
    ".dlllllllllb",
    ".dlllllllllb",
    ".dmmmmmllllb",
    ".dmmmmmmmmml",
    "..dmmmmmmmmm",
    "..ddmmmmmmmm",
    "...ddmmmmmmm",
    "....dddmmmdd",
    "......dddd..",
])


def boar_frame(direction, f):
    c = Canvas()
    if direction == "right":
        c.rows(13, BOAR_R)
        for xt, xb, k in BOAR_R_LEGS[f]:
            c.line(xt, 25, xb, 29, k, w=2, under=True)
            c.put(xb, 30, "o"); c.put(xb + 1, 30, "o")
    elif direction in ("down", "up"):
        lift = {0: (0, 2), 1: (0, 0), 2: (2, 0)}[f]
        if direction == "down":
            for x, l in ((3, lift[1]), (19, lift[0])):
                for y in range(17, 28 - l):
                    c.put(x, y, "d"); c.put(x + 1, y, "d")
            for (x, l) in ((6, lift[0]), (16, lift[1])):
                for y in range(22, 30 - l):
                    c.put(x, y, "m"); c.put(x + 1, y, "m")
            c.rows(9, BOAR_D)
        else:
            for x, l in ((3, lift[1]), (19, lift[0])):
                for y in range(15, 27 - l):
                    c.put(x, y, "d"); c.put(x + 1, y, "d")
            for (x, l) in ((6, lift[0]), (16, lift[1])):
                for y in range(20, 30 - l):
                    c.put(x, y, "m"); c.put(x + 1, y, "m")
            c.rows(8, BOAR_U)
            c.put(11, 25, "b"); c.put(12, 25, "b"); c.put(12, 26, "b")  # tail tuft
    c.outline("o")
    return c


CREATURES = [
    ("wolf", wolf_frame, WOLF_PAL),
    ("spider", spider_frame, SPI_PAL),
    ("wisp", wisp_frame, WISP_PAL),
    ("boar", boar_frame, BOAR_PAL),
]
ROWS = ["up", "right", "down", "left"]


def frame_image(fn, pal, direction, f):
    if direction == "left":
        return fn("right", f).image(pal).transpose(Image.FLIP_LEFT_RIGHT)
    return fn(direction, f).image(pal)


def build():
    sheet = Image.new("RGBA", (288, 256), (0, 0, 0, 0))
    for k, (_, fn, pal) in enumerate(CREATURES):
        sx, sy = (k % 4) * 72, (k // 4) * 128
        for r, d in enumerate(ROWS):
            for f in range(3):
                sheet.alpha_composite(frame_image(fn, pal, d, f), (sx + f * FW, sy + r * FH))
    return sheet


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    sheet = build()
    sheet.save(OUT)
    print(OUT, sheet.size)


if __name__ == "__main__":
    main()
