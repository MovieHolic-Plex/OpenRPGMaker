#!/usr/bin/env python3
"""Elf treetop village parts for forest_harmony (deterministic pixel generator).

Writes public/assets/forest-harmony/treetop-parts.png (30 columns, 16 px),
tiledata/elf-treetop/parts.json (sheet index → role, passage, layer, backing) and
src/assets/forestHarmonyTreetopParts.json (the bundle forest_harmony grafts at 3131~, see
src/project/defaults/forestHarmonyTreetopParts.ts): slots, grafts, the deck autotile and the tile groups.

Sheet layout (index = row * 30 + col):
  0..46    deck autotile — 47 blob variants (8-neighbour mask, corners only count when both sides join).
           Light elven planks, a darker rim on open sides, a fascia beam under open south edges,
           transparent outside (drawn over the canopy depth through layerBacking).
  60..67   rope bridge, horizontal, 2 rows: 60 61 62 63 (top: post, slats, slats, post) / 64 65 66 67 (bottom)
  68..75   rope bridge, vertical, 2 columns: 68 69 top ends, 70 71 / 72 73 middles, 74 75 bottom ends
  90..     giant trunk (3 wide):  90 91 92 bark A · 93 94 95 bark B · 96 97 98 window row ·
           99 100 101 door top · 102 103 104 base with door bottom · 105 106 107 base (no door)
  120..    grand trunk (5 wide):  120..124 bark · 125..129 window row · 130..134 double door top ·
           135..139 base with double door
  150..    rope ladder down (150 top on the deck edge, 151 middle, 152 bottom) · 153 154 lantern post (top, foot)
           155 hanging leaf garland · 156 moss planter
  157..160 depth — the forest far below the crowns (lower layer between crowns, backing of deck/bridge edges)
  161      depth in the deck's shadow (the cell under an open south deck edge)
"""
import json, math, os, random
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
S, COLS = 16, 30
ROWS = 6
sheet = Image.new("RGBA", (COLS * S, ROWS * S), (0, 0, 0, 0))
meta = {}

def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)

# Elven planks: warm honey wood that sits in the forest_harmony greens; boards shade light → base → grain, dark gaps.
PLANK = [rgb("c99a62"), rgb("b4854f"), rgb("a67747"), rgb("93673c")]   # highlight, base A, base B, grain
PLANK_TONE = [(0, 0, 0), (5, 3, 0), (-6, -5, -2), (2, -1, -4)]       # per-board tint so boards read separately
SEAM = rgb("5a3d24")
LINE = rgb("3a2616")                                                  # outline where the deck meets the air
RIM = rgb("d9ad74")                                                   # sunlit top edge of the deck
RIM_D = rgb("7a5432")
FASCIA = [rgb("8a5e34"), rgb("76502c"), rgb("684626")]                # the beam face under an open south edge
FASCIA_HI = rgb("a47243")
FASCIA_D = rgb("3e2814")
ROPE = rgb("e0c890")
ROPE_M = rgb("b89c66")
ROPE_D = rgb("7d6440")
POST = rgb("6b4524")
POST_L = rgb("946434")
BARK = [rgb("9a7448"), rgb("80603a"), rgb("684c2e"), rgb("523a23"), rgb("3c2a19"), rgb("281b10")]  # light → dark
BARK_HI = rgb("b48a58")
MOSS = [rgb("6f9f34"), rgb("4f7f26"), rgb("8fbf4a"), rgb("37601c")]
GLOW = [rgb("ffdf96"), rgb("f2b04a"), rgb("fff4cc"), rgb("d98a2e")]
DOOR = [rgb("7a4a20"), rgb("5e3614"), rgb("93602c"), rgb("3f230c")]
IRON = rgb("2e2a26")

def tint(c, t):
    return tuple(max(0, min(255, c[i] + t[i])) for i in range(3)) + (c[3],)

def tile_img():
    return Image.new("RGBA", (S, S), (0, 0, 0, 0))

def put(index, img, role, passage, layer="lower", backing=None, label=""):
    sheet.paste(img, ((index % COLS) * S, (index // COLS) * S))
    meta[index] = {"role": role, "passage": passage, "layer": layer, "backing": backing, "label": label}

def noise(x, y, seed=0):
    h = (x * 374761393 + y * 668265263 + seed * 2147483647) & 0xFFFFFFFF
    h = (h ^ (h >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 65535.0

# ── deck autotile ────────────────────────────────────────────────────────────────────────────────────────
N, E, SO, W, NE, SE, SW, NW = 1, 2, 4, 8, 16, 32, 64, 128

def canon(mask):
    m = mask & (N | E | SO | W)
    if mask & NE and mask & N and mask & E: m |= NE
    if mask & SE and mask & SO and mask & E: m |= SE
    if mask & SW and mask & SO and mask & W: m |= SW
    if mask & NW and mask & N and mask & W: m |= NW
    return m

def plank_px(x, y, seed):
    """Tile-periodic planks (16 px) so the body never shows a grid: 4 px boards (light top row, base, grain, gap),
    one staggered joint per board, nail pairs beside each joint."""
    board, r = (y // 4) % 4, y % 4
    joint = (3, 11, 7, 14)[board]
    if r == 3: return SEAM
    if x == joint: return SEAM
    tone = PLANK_TONE[(board + (x > joint)) % 4]
    if r == 0:
        c = PLANK[0] if x != joint + 1 else RIM
    else:
        c = PLANK[1] if (board + (x > joint)) % 2 == 0 else PLANK[2]
        # grain: short darker streaks that run along the board
        if r == 2 and noise((x + board * 5) // 4, board, seed) > 0.7: c = PLANK[3]
    if r == 1 and x == joint + 1 and board == 1: c = SEAM                     # one nail pair per tile
    if r == 2 and x == joint + 1 and board == 1: c = PLANK[3]
    return tint(c, tone)

def deck_distance(mask, fx, fy):
    """Signed distance (px) from the deck silhouette at tile-local point (fx, fy); > 0 inside. Open sides are the tile
    border, open convex corners are rounded (r 3), open diagonals between two joined sides cut the corner point."""
    openN, openE, openS, openW = not mask & N, not mask & E, not mask & SO, not mask & W
    d = 99.0
    if openN: d = min(d, fy)
    if openS: d = min(d, S - fy)
    if openW: d = min(d, fx)
    if openE: d = min(d, S - fx)
    r = 3.0
    for oa, ob, cx, cy in ((openN, openW, r, r), (openN, openE, S - r, r), (openS, openW, r, S - r), (openS, openE, S - r, S - r)):
        if oa and ob and abs(fx - cx) <= r + 1e-9 and abs(fy - cy) <= r + 1e-9 and (fx < r) == (cx < S / 2) and (fy < r) == (cy < S / 2) \
                and ((fx - cx) * (1 if cx > S / 2 else -1) > 0) and ((fy - cy) * (1 if cy > S / 2 else -1) > 0):
            d = min(d, r - math.hypot(fx - cx, fy - cy))
    for bit, need, cx, cy in ((NE, N | E, S, 0), (NW, N | W, 0, 0), (SE, SO | E, S, S), (SW, SO | W, 0, S)):
        if mask & need == need and not mask & bit:
            d = min(d, math.hypot(fx - cx, fy - cy) - 1.0)
    return d

def draw_deck(mask, seed):
    img = tile_img(); px = img.load()
    D = lambda x, y: deck_distance(mask, x + 0.5, y + 0.5)
    FACE = 4                                           # beam height under an open south edge
    for y in range(S):
        for x in range(S):
            d = D(x, y)
            if d <= 0: continue
            # the pixel is on the beam face if the air is within FACE px straight below
            below = next((k for k in range(1, FACE + 1) if D(x, y + k) <= 0), None)
            if below is not None:
                k = below                              # 1 = bottom row of the face
                c = FASCIA[(x // 4 + k) % 3]
                if k == FACE: c = FASCIA_HI
                if k == 1 or d < 1: c = FASCIA_D
                if x % 8 == 5 and 1 < k < FACE: c = FASCIA_D   # peg heads along the beam
            elif d < 1:
                c = LINE
            elif d < 2:
                above_air = D(x, y - 1) <= 1
                c = RIM if above_air else RIM_D
            else:
                c = plank_px(x, y, seed)
            px[x, y] = c
    return img

deck_masks = sorted({canon(m) for m in range(256)}, key=lambda m: (bin(m & 15).count("1"), m))
assert len(deck_masks) == 47, len(deck_masks)
deck_variant = {}
for i, m in enumerate(deck_masks):
    put(i, draw_deck(m, 11), "deck", "passable", backing="depth", label=f"나무 위 데크 · 연결 {m}")
    deck_variant[m] = i
DECK_BODY = deck_variant[255]

# ── rope bridges ─────────────────────────────────────────────────────────────────────────────────────────
def draw_bridge_h(part, row):
    """part: 'l' post end, 'm' / 'n' middle slats, 'r' post end. row 0 = back rope, row 1 = front rope."""
    img = tile_img(); px = img.load()
    for y in range(S):
        for x in range(S):
            yy = y + row * S                           # 0..31 across the two rows
            slat = (x % 4) != 3
            if 5 <= yy <= 27 and slat:
                k = noise(x // 4, 0, 7 if part == "n" else 5)
                c = PLANK[1 + int(k * 1.99)]
                if yy in (5, 27): c = SEAM
                if yy in (6, 26) and x % 4 == 1: c = SEAM          # nail heads on the stringers
                if x % 4 == 0: c = PLANK[0]
                if x % 4 == 2 and noise(x, yy // 3, 3) > 0.6: c = PLANK[3]
                px[x, y] = c
            elif 5 <= yy <= 27:
                px[x, y] = (0, 0, 0, 0)
    # ropes: back rope sags a little in the middle tiles, front rope too
    for x in range(S):
        sag = 0 if part in "lr" else (1 if 4 <= x <= 11 else 0)
        twist = ROPE if x % 3 else ROPE_M
        for yy, col in ((3 + sag, twist), (4 + sag, ROPE_D), (28 + sag, twist), (29 + sag, ROPE_D)):
            y = yy - row * S
            if 0 <= y < S: px[x, y] = col
        # vertical hangers every 4 px
        if x % 4 == 1 and part in "mn":
            for yy in range(5 + sag, 28):
                y = yy - row * S
                if 0 <= y < S and (yy < 8 or yy > 24): px[x, y] = ROPE_D
    if part in "lr":
        x0 = 1 if part == "l" else S - 5
        for yy in range(0, 31):
            y = yy - row * S
            if 0 <= y < S:
                for x in range(x0, x0 + 4):
                    px[x, y] = POST_L if x == x0 else (FASCIA_D if x == x0 + 3 else POST)
        for yy in (0, 1):
            y = yy - row * S
            if 0 <= y < S:
                for x in range(x0 - 1, x0 + 5): px[x, y] = POST_L
    return img

for i, part in enumerate("lmnr"):
    for row in (0, 1):
        passage = "passable"
        put(60 + i + row * 4, draw_bridge_h(part, row), "bridge", passage, backing="depth",
            label=f"밧줄 다리 가로 · {'윗줄' if row == 0 else '아랫줄'} · {dict(l='왼 기둥', m='발판', n='발판 2', r='오른 기둥')[part]}")

def draw_bridge_v(part, col):
    """part: 't' top end, 'm' / 'n' middle, 'b' bottom end. col 0 = left (rope on the left), 1 = right."""
    img = tile_img(); px = img.load()
    for y in range(S):
        for x in range(S):
            xx = x + col * S                           # 0..31
            slat = (y % 4) != 3
            if 5 <= xx <= 26:
                if slat:
                    k = noise(0, y // 4, 17 if part == "n" else 13)
                    c = PLANK[1 + int(k * 2.9)]
                    if y % 4 == 0: c = PLANK[0]
                    if xx in (5, 26): c = SEAM
                    px[x, y] = c
    for y in range(S):
        sway = 0 if part in "tb" else (1 if 4 <= y <= 11 else 0)
        twist = ROPE if y % 3 else ROPE_M
        for xx, c in ((2 - sway, twist), (3 - sway, ROPE_D), (28 + sway, twist), (29 + sway, ROPE_D)):
            x = xx - col * S
            if 0 <= x < S: px[x, y] = c
    if part in "tb":
        y0 = 1 if part == "t" else S - 6
        for xx0 in (1, 27):
            for xx in range(xx0, xx0 + 4):
                x = xx - col * S
                if 0 <= x < S:
                    for y in range(y0, y0 + 5):
                        px[x, y] = POST_L if y == y0 else (FASCIA_D if y == y0 + 4 else POST)
    return img

for i, part in enumerate("tmnb"):
    for col in (0, 1):
        put(68 + i * 2 + col, draw_bridge_v(part, col), "bridge", "passable", backing="depth",
            label=f"밧줄 다리 세로 · {'왼' if col == 0 else '오른'} · {dict(t='위 기둥', m='발판', n='발판 2', b='아래 기둥')[part]}")

# ── giant trunks ─────────────────────────────────────────────────────────────────────────────────────────
def bark_px(x, y, width_px, seed):
    """Round trunk, tile-periodic in y (16 px) so any rows stack without a seam: cylinder shading lit from the
    upper left, vertical bark plates split by wavy furrows, a thin rim light on the dark side."""
    u = (x + 0.5) / width_px
    lit = math.cos((u - 0.35) * math.pi * 0.95)                 # 1 at the lit third, falls off to both sides
    yy = y % S
    plate = max(6.0, width_px / 7)
    wave = 1.1 * math.sin(2 * math.pi * yy / S + (int(x / plate) * 1.7))
    fx = (x + wave) % plate
    shade = lit - (0.45 if fx < 1.0 else 0.0) + (0.12 if 1.0 <= fx < 2.0 else 0.0)   # furrow dark, plate edge lit
    idx = int(round((1 - max(-0.2, min(1.0, shade))) * 4.2))
    c = BARK[max(0, min(5, idx))]
    if u > 0.93 and fx >= 1.0: c = BARK[2]                     # bounced rim light on the shadow side
    return c

def bark_details(px, wpx, hpx, seed):
    """Knots and moss clumps, kept 3 px off each tile's top/bottom so stacked rows still join."""
    rnd = random.Random(seed)
    for row in range(hpx // S):
        for _ in range(max(1, wpx // 24)):
            kx, ky = rnd.randint(4, wpx - 6), row * S + rnd.randint(5, 10)
            if rnd.random() < 0.5:                             # knot
                for dx, dy, c in ((0, 0, BARK[5]), (1, 0, BARK[4]), (0, 1, BARK[4]), (1, 1, BARK[3]), (-1, 0, BARK[1]), (0, -1, BARK[1])):
                    px[kx + dx, ky + dy] = c
            else:                                              # a second, fainter knot
                px[kx, ky] = BARK[4]; px[kx, ky + 1] = BARK[3]

def trunk_strip(width, rows, seed, feature=None):
    """Return a (width*16)×(rows*16) image of trunk bark; feature draws windows / doors on it."""
    wpx = width * S
    img = Image.new("RGBA", (wpx, rows * S), (0, 0, 0, 0)); px = img.load()
    for y in range(rows * S):
        for x in range(wpx):
            px[x, y] = bark_px(x, y, wpx, seed)
    bark_details(px, wpx, rows * S, seed)
    if feature: feature(px, wpx, rows * S)
    return img

def round_window(px, cx, cy, r=4):
    """Round lit window: bark lip (light top-left, dark bottom-right), wooden frame, warm glass lighter at the top,
    cross muntin."""
    for y in range(cy - r - 2, cy + r + 3):
        for x in range(cx - r - 2, cx + r + 3):
            dx, dy = x - cx + 0.5, y - cy + 0.5
            d = math.hypot(dx, dy)
            if d <= r - 0.6:
                c = GLOW[2] if dy < -r / 2 else (GLOW[0] if dy < r / 3 else GLOW[1])
                if abs(dx) < 0.6 or abs(dy) < 0.6: c = DOOR[1]
                px[x, y] = c
            elif d <= r + 0.5:
                px[x, y] = DOOR[3] if dy > 0 else DOOR[1]
            elif d <= r + 1.5:
                px[x, y] = BARK_HI if dx + dy < 0 else BARK[4]

def arched_door(px, x0, y0, w, h):
    """Door w wide, h tall with a round top, planks and an iron ring."""
    r = w / 2
    for y in range(y0, y0 + h):
        for x in range(x0 - 1, x0 + w + 1):
            top = y - y0
            inside_arch = top >= r or math.hypot(x - (x0 + r - 0.5), top - r + 0.5) <= r
            frame_arch = top >= r - 1 or math.hypot(x - (x0 + r - 0.5), top - r + 0.5) <= r + 1.2
            if x in (x0 - 1, x0 + w) and frame_arch:
                px[x, y] = BARK[3]
            elif x0 <= x < x0 + w and inside_arch:
                px[x, y] = DOOR[0] if (x - x0) % 3 else DOOR[1]
                if (x - x0) % 3 == 1 and noise(x, y, 4) > 0.7: px[x, y] = DOOR[2]
            elif x0 <= x < x0 + w and frame_arch:
                px[x, y] = BARK[3]
    ry = y0 + h // 2 + 2
    px[x0 + w - 3, ry] = IRON; px[x0 + w - 3, ry + 1] = IRON

def base_roots(px, wpx, hpx):
    """Bottom row: roots flare onto the deck; outside the trunk the pixels are cleared (the deck backing shows),
    the silhouette gets a dark outline and the deck right beside it a soft contact shadow."""
    y0 = hpx - S
    inside = {}
    for y in range(y0, hpx):
        t = (y - y0) / (S - 1)
        for x in range(wpx):
            edge = min(x, wpx - 1 - x)
            flare = int(3.2 * t * t) + (2 if t > 0.5 and noise(x // 3, 5, 9) > 0.5 else 0)
            inside[x, y] = edge >= 3 - flare
    for y in range(y0, hpx):
        for x in range(wpx):
            if not inside[x, y]:
                near = any(inside.get((x + dx, y), False) for dx in (-2, -1, 1, 2))
                px[x, y] = (20, 12, 6, 90) if near and y > y0 + 4 else (0, 0, 0, 0)
            elif not inside.get((x - 1, y), True) or not inside.get((x + 1, y), True):
                px[x, y] = BARK[5]
            elif (x // 5 + y) % 7 == 0 and y > hpx - 6:
                px[x, y] = BARK[1]                              # root ridges catching light
    for x in range(2, wpx // 2):                               # moss where the lit roots meet the deck
        for y in range(hpx - 5, hpx - 2):
            if inside[x, y] and px[x, y][3] == 255 and noise(x // 2, y, 41) > 0.45 - 0.12 * (y - hpx + 5):
                px[x, y] = MOSS[2] if y == hpx - 5 else MOSS[int(noise(x, y, 42) * 1.99)]
    for x in range(wpx):
        if inside[x, hpx - 1]: px[x, hpx - 1] = BARK[5]
        if inside[x, hpx - 2] and px[x, hpx - 2][3] == 255 and x % 5 != 2: px[x, hpx - 2] = BARK[4]

def cut(img, index0, width, row, role, passage, label, backing=None):
    for c in range(width):
        put(index0 + c, img.crop((c * S, row * S, (c + 1) * S, (row + 1) * S)), role, passage, backing=backing, label=f"{label} {c + 1}/{width}")

bark_a = trunk_strip(3, 1, 1); cut(bark_a, 90, 3, 0, "trunk", "solid", "큰 나무 줄기 A")
bark_b = trunk_strip(3, 1, 2); cut(bark_b, 93, 3, 0, "trunk", "solid", "큰 나무 줄기 B")
win = trunk_strip(3, 1, 3, lambda px, w, h: round_window(px, w // 2, h // 2)); cut(win, 96, 3, 0, "trunk", "solid", "큰 나무 줄기 · 둥근 창")
door2 = trunk_strip(3, 2, 4, lambda px, w, h: (arched_door(px, w // 2 - 5, 6, 10, h - 6), base_roots(px, w, h)))
cut(door2, 99, 3, 0, "trunk", "solid", "큰 나무 줄기 · 문 위")
cut(door2, 102, 3, 1, "trunk", "solid", "큰 나무 밑동 · 문", backing="deck")
base = trunk_strip(3, 1, 5, base_roots); cut(base, 105, 3, 0, "trunk", "solid", "큰 나무 밑동", backing="deck")

gbark = trunk_strip(5, 1, 6); cut(gbark, 120, 5, 0, "trunk", "solid", "장로 나무 줄기")
gwin = trunk_strip(5, 1, 7, lambda px, w, h: (round_window(px, 18, h // 2), round_window(px, w - 18, h // 2))); cut(gwin, 125, 5, 0, "trunk", "solid", "장로 나무 줄기 · 창")
gdoor = trunk_strip(5, 2, 8, lambda px, w, h: (arched_door(px, w // 2 - 9, 4, 18, h - 4), base_roots(px, w, h)))
cut(gdoor, 130, 5, 0, "trunk", "solid", "장로 나무 · 큰 문 위")
cut(gdoor, 135, 5, 1, "trunk", "solid", "장로 나무 밑동 · 큰 문", backing="deck")

# ── ladder, lantern, garland, planter ────────────────────────────────────────────────────────────────────
def ladder(part):
    img = tile_img(); px = img.load()
    for y in range(S):
        for x in (3, 12):
            px[x, y] = ROPE; px[x + 1, y] = ROPE_D
        if y % 5 == 2:
            for x in range(4, 12): px[x, y] = PLANK[1]
            for x in range(4, 12): px[x, y + 1 if y + 1 < S else y] = SEAM
    if part == "t":
        for x in range(1, 15):
            for y in (0, 1): px[x, y] = RIM
        for x in (2, 3, 12, 13): px[x, 2] = IRON
    if part == "b":
        for y in range(10, S):
            for x in range(S): px[x, y] = (0, 0, 0, 0)
        for x in (3, 4, 12, 13):
            for y in range(10, 13): px[x, y] = ROPE_D
    return img

put(150, ladder("t"), "ladder", "passable", backing="depth", label="밧줄 사다리 · 위(데크 끝)")
put(151, ladder("m"), "ladder", "passable", backing="depth", label="밧줄 사다리 · 가운데")
put(152, ladder("b"), "ladder", "passable", backing="depth", label="밧줄 사다리 · 아래 끝")

lan = Image.new("RGBA", (S, 2 * S), (0, 0, 0, 0)); px = lan.load()
for y in range(1, 13):                                       # warm halo (semi-transparent, drawn under the lamp)
    for x in range(0, S):
        d = math.hypot(x - 7.5, y - 6.5)
        if d < 7.5: px[x, y] = GLOW[0][:3] + (int(70 * (1 - d / 7.5) ** 1.4),)
for y in range(10, 30):
    px[7, y] = POST_L; px[8, y] = POST
for x in range(5, 11): px[x, 29] = POST; px[x, 30] = FASCIA_D
px[6, 28] = POST_L; px[9, 28] = POST
for x in range(5, 11):
    for y in range(3, 10):
        edge = x in (5, 10) or y in (3, 9)
        px[x, y] = DOOR[1] if edge else (GLOW[2] if y < 6 else (GLOW[0] if y < 8 else GLOW[1]))
px[7, 5] = px[8, 5] = rgb("ffffff")
for x in range(4, 12): px[x, 2] = MOSS[1]
for x in range(5, 11): px[x, 1] = MOSS[0]
for x in (6, 7, 8, 9): px[x, 0] = MOSS[2] if x in (7, 8) else MOSS[0]
px[4, 3] = MOSS[3]; px[11, 3] = MOSS[3]
put(153, lan.crop((0, 0, S, S)), "prop", "solid", layer="upper", label="요정 등불 기둥 · 위")
put(154, lan.crop((0, S, S, 2 * S)), "prop", "solid", layer="lower", backing="deck", label="요정 등불 기둥 · 밑")

gar = tile_img(); px = gar.load()
for x in range(S):
    y = 3 + int(2.5 * math.sin(math.pi * x / (S - 1)))
    px[x, y] = MOSS[1]; px[x, y - 1] = MOSS[0]
    if x % 4 == 1:
        px[x, y + 1] = MOSS[2]; px[x, y + 2] = rgb("e8a0c8") if x % 8 == 1 else rgb("f4e28a")
put(155, gar, "prop", "passable", layer="upper", label="잎 줄 장식")

pl = tile_img(); px = pl.load()
for y in range(8, 15):
    for x in range(2, 14):
        px[x, y] = FASCIA[1] if y > 9 else RIM
        if x in (2, 13) or y == 14: px[x, y] = FASCIA_D
for y in range(2, 9):
    for x in range(3, 13):
        if noise(x, y, 21) > 0.35 - 0.05 * (8 - y):
            px[x, y] = MOSS[int(noise(x, y, 22) * 2.99)]
            if noise(x, y, 23) > 0.9: px[x, y] = rgb("e8a0c8")
put(156, pl, "prop", "solid", layer="upper", backing="deck", label="이끼 화분")

# ── depth: the forest floor far below — near-black green with dim leaf clusters ─────────────────────────────
DEEP = [rgb("0c1610"), rgb("101d14"), rgb("15261a"), rgb("1b3121"), rgb("243f2a")]
def depth(seed, shadow=False):
    img = tile_img(); px = img.load()
    for y in range(S):
        for x in range(S):
            # world-periodic value noise so neighbouring variants still join
            v = 0.5 * noise(x // 3, y // 3, seed) + 0.3 * noise(x // 2, y // 2, seed + 1) + 0.2 * noise(x, y, seed + 2)
            k = int(v * 4.2)
            if shadow: k = max(0, k - 2) if y < 10 else max(0, k - 1)
            px[x, y] = DEEP[min(4, k)]
    return img
for i in range(4):
    put(157 + i, depth(31 + i), "depth", "solid", label=f"나무 아래 깊은 숲 {i + 1}")
put(161, depth(35, True), "depth", "solid", label="나무 아래 깊은 숲 · 데크 그늘")

out = os.path.join(ROOT, "public/assets/forest-harmony/treetop-parts.png")
sheet.save(out)
os.makedirs(os.path.join(ROOT, "tiledata/elf-treetop"), exist_ok=True)
deck_map = {str(m): deck_variant[canon(m)] for m in range(256)}
json.dump({"sheet": "public/assets/forest-harmony/treetop-parts.png", "columns": COLS, "tiles": meta,
           "deckVariantMap": deck_map, "deckBody": DECK_BODY}, open(os.path.join(ROOT, "tiledata/elf-treetop/parts.json"), "w"),
          ensure_ascii=False, indent=1)
# ── bundle for forest_harmony (tileGrafts from START) ────────────────────────────────────────────────────
START, FRAMES = 3131, COLS * ROWS
KEY = "tex_forest_harmony_treetop_parts"
backing_tile = {"depth": START + 157, "deck": START + DECK_BODY, None: None}
DESC = {
    "deck": "나무 위 마을 판자 데크(오토타일 forest_harmony_treetop_deck_47). 하위·통행 가능. 가장자리 바깥은 투명이라 받침(깊은 숲 3288)이 비친다.",
    "bridge": "밧줄 다리 조각. 하위·통행 가능(발판). 데크와 데크 사이 깊은 숲 위에 놓는다. 가로는 2줄, 세로는 2칸 폭.",
    "trunk": "큰 나무 줄기 집 조각. 하위·통행 불가. 위쪽 줄은 상위 수관(굽이숲)이 덮는다. 문 칸 앞(아래) 데크에 문 이벤트를 둔다.",
    "ladder": "밧줄 사다리. 데크 남쪽 끝에서 아래로 늘어뜨려 숲 바닥으로 내려가는 출구. 하위·통행 가능.",
    "prop": "나무 위 마을 소품.",
    "depth": "나무 위에서 내려다본 깊은 숲(데크·다리 사이 빈 곳). 하위·통행 불가.",
}
slots = []
for f in range(FRAMES):
    m = meta.get(f)
    if not m:
        slots.append({"name": f"blank-{f}", "passability": {"up": True, "down": True, "left": True, "right": True}, "priority": "lower", "terrain": 0,
                      "tileMeta": {"label": "", "description": ""}})
        continue
    ok = m["passage"] == "passable"
    tm = {"role": {"deck": "floor", "bridge": "floor", "trunk": "building", "ladder": "floor", "prop": "prop", "depth": "terrain"}[m["role"]],
          "label": m["label"], "description": DESC[m["role"]], "source": "user", "passage": m["passage"], "userLocked": True,
          "defaultLayer": m["layer"], "layerBacking": backing_tile[m["backing"]] if m["backing"] else "none"}
    slots.append({"name": f"treetop-{f}", "passability": {"up": ok, "down": ok, "left": ok, "right": ok},
                  "priority": "upper" if m["layer"] == "upper" else "lower", "terrain": 0, "tileMeta": tm})
grafts = [{"targetTile": START + f, "sourceChipset": KEY, "sourceTile": f} for f in sorted(meta)]
deck_members = [START + i for i in range(47)]
deck_group = {"id": "forest_harmony_treetop_deck_47", "name": "나무 위 데크 · 8방향 연결", "neighborhood": 8,
              "memberTileIds": deck_members, "connectTileIds": deck_members + [START + i for i in range(60, 76)],
              "variantMap": {k: START + v for k, v in deck_map.items()}}
def pm(w, h, lower, upper=None):
    return {"width": w, "height": h, "lowerTiles": [START + t if t >= 0 else -1 for t in lower],
            "upperTiles": [START + t if t >= 0 else -1 for t in (upper or [-1] * (w * h))]}
def group(gid, name, role, layer, tiles, desc, rules, preview):
    return {"id": gid, "name": name, "role": role, "source": "user", "confidence": "high", "defaultLayer": layer,
            "tileIds": [START + t for t in tiles], "description": desc, "placementRules": rules, "previewMap": preview}
t3 = [90, 91, 92, 93, 94, 95, 90, 91, 92, 96, 97, 98, 99, 100, 101, 102, 103, 104]
t5 = [120, 121, 122, 123, 124] * 3 + list(range(125, 140))
tile_groups = [
    group("treetop-trunk-house-3", "나무 위 마을 · 줄기 집 (3칸)", "building", "lower", sorted(set(t3)),
          "큰 나무 줄기에 둥근 창과 아치 문을 낸 엘프 집. 3×6: 줄기 3줄·창·문 위·밑동(문).",
          "데크 위, 밑동 줄이 데크에 닿게. 위 3줄은 상위 굽이숲 수관(좌우 2칸 넓게)으로 덮는다. 문 앞 두 칸은 비운다. 양옆에 요정 등불.", pm(3, 6, t3)),
    group("treetop-trunk-house-5", "나무 위 마을 · 장로 나무 (5칸)", "building", "lower", sorted(set(t5)),
          "장로 나무 줄기 집. 5×6: 줄기 3줄·창 둘·큰 문 위·밑동(큰 문).",
          "가장 큰 데크 한가운데 북쪽. 위 3줄은 넓은 수관으로 덮는다. 큰 문 앞은 광장처럼 비운다.", pm(5, 6, t5)),
    group("treetop-bridge-h", "나무 위 마을 · 밧줄 다리 가로", "terrain", "lower", list(range(60, 68)),
          "가로 밧줄 다리 2줄. 양 끝 기둥(60·63 / 64·67), 가운데 발판(61·62 / 65·66)을 번갈아 늘린다.",
          "두 데크 사이 깊은 숲 위, 같은 두 줄에 데크가 양쪽으로 닿게. 끝 기둥은 데크 가장자리 바로 바깥 칸.", pm(4, 2, [60, 61, 62, 63, 64, 65, 66, 67])),
    group("treetop-bridge-v", "나무 위 마을 · 밧줄 다리 세로", "terrain", "lower", list(range(68, 76)),
          "세로 밧줄 다리 2칸 폭. 위 기둥(68·69), 발판(70·71 / 72·73 번갈아), 아래 기둥(74·75).",
          "위 데크 남쪽 끝 바로 아래에서 아래 데크 북쪽 끝 바로 위까지.", pm(2, 4, [68, 69, 70, 71, 72, 73, 74, 75])),
    group("treetop-ladder", "나무 위 마을 · 밧줄 사다리(출구)", "terrain", "lower", [150, 151, 152],
          "데크 끝에서 숲 바닥으로 내려가는 밧줄 사다리. 위(150)·가운데(151 반복)·아래 끝(152).",
          "입구 데크 남쪽 끝 바로 아래부터 맵 가장자리까지. 맨 아래 칸에 맵 이동 이벤트.", pm(1, 3, [150, 151, 152])),
    group("treetop-lantern", "나무 위 마을 · 요정 등불 기둥", "prop", "upper", [153, 154],
          "이끼 갓을 쓴 등불 기둥. 위(153 상위)·밑(154 하위, 데크 받침).", "줄기 집 문 양옆, 입구 데크 양옆. 데크 위에만.",
          pm(1, 2, [-1, 154], [153, -1])),
    group("treetop-decor", "나무 위 마을 · 이끼 화분·잎 줄", "prop", "upper", [155, 156],
          "이끼 화분(156, 데크 위 상위)과 다리 기둥 사이 잎 줄 장식(155, 다리 윗줄 상위).",
          "화분은 데크 가장자리·집 곁에. 잎 줄은 가로 밧줄 다리 윗줄 위에만.", pm(2, 1, [-1, -1], [155, 156])),
    group("treetop-depth", "나무 위 마을 · 깊은 숲(아래)", "terrain", "lower", [157, 158, 159, 160, 161],
          "데크·다리 사이로 내려다보이는 깊은 숲. 157~160 섞어 깔고, 데크 남쪽 끝 바로 아래 칸은 그늘 161.",
          "맵 바닥 전체를 먼저 이것으로 깔고, 그 위(상위)에 굽이숲 수관 덩이를 둥글게 올린다. 데크·다리 둘레 한 칸은 수관 없이 비워 높이가 보이게.",
          pm(5, 1, [157, 158, 159, 160, 161])),
]
bundle = {"textureKey": KEY, "start": START, "count": START + FRAMES, "frames": FRAMES, "grafts": grafts, "slots": slots,
          "autotileGroups": [deck_group], "tileGroups": tile_groups}
json.dump(bundle, open(os.path.join(ROOT, "src/assets/forestHarmonyTreetopParts.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print("wrote", out, len(meta), "tiles")
