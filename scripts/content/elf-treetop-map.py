#!/usr/bin/env python3
"""Elf treetop village map (엘프 나무 위 마을, 52×40) on forest_harmony + the treetop parts (3131~).

Deterministic. Reads tiledata/elf-treetop/parts.json (scripts/content/elf-treetop.py) and the grove autotile of
src/assets/forestHarmonyVillageExtension.json; writes tiledata/elf-treetop/catalog.json {plan, map arrays}.
Layers: lower = deep forest far below (157~160, 161 in a deck's shadow), plank decks (47-blob autotile), rope
bridges, trunk houses, the exit ladder; upper = grove crowns (round, lobed masses) with a 1-cell gap of depth round
every deck and bridge so the height reads, each trunk under its own crown, and the props.
"""
import json, os, random
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
P = json.load(open(os.path.join(ROOT, 'tiledata/elf-treetop/parts.json')))
BASE = 3131                     # first graft slot after the house parts (2760..3130)
DEPTH = [BASE + 157, BASE + 158, BASE + 159, BASE + 160]
_ext = json.load(open(os.path.join(ROOT, 'src/assets/forestHarmonyVillageExtension.json')))
_g = next(g for g in _ext['autotileGroups'] if g['id'] == 'forest_harmony_grove_47')
GROVE = {'variantMap': _g['variantMap'], 'interior': _g['interiorVariants']}
W, H = 52, 40
rnd = random.Random(7)
lower = [rnd.choice(DEPTH) for _ in range(W * H)]
upper = [-1] * (W * H)
at = lambda x, y: y * W + x
inside = lambda x, y: 0 <= x < W and 0 <= y < H

deck = set(); bridge = {}; trunk = {}; solid = set()
def rect(x0, y0, x1, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): deck.add((x, y))

def ellipse(cx, cy, rx, ry):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1.0: deck.add((x, y))
DECKS = {'hall': (25.5, 17.5, 9.0, 6.0), 'nw': (8.0, 11.5, 5.5, 4.2), 'ne': (43.0, 12.5, 5.5, 4.3),
         'garden': (7.0, 23.5, 5.0, 4.0), 'inn': (42.5, 24.0, 6.0, 4.5), 'gate': (25.5, 33.5, 5.5, 3.2)}
cells_of = {}
for k, r in DECKS.items():
    before = set(deck); ellipse(*r); cells_of[k] = deck - before | {c for c in deck if ((c[0] + 0.5 - r[0]) / r[2]) ** 2 + ((c[1] + 0.5 - r[1]) / r[3]) ** 2 <= 1.0}
# smooth the stepped ellipses: drop one-row slivers (no deck above and below) and one-column slivers
for _ in range(3):
    for c in sorted(deck):
        x, y = c
        if ((x, y - 1) not in deck and (x, y + 1) not in deck) or ((x - 1, y) not in deck and (x + 1, y) not in deck):
            deck.discard(c)
            for k in cells_of: cells_of[k].discard(c)
def hbridge(x0, x1, y):
    for x in range(x0, x1 + 1):
        part = 0 if x == x0 else 3 if x == x1 else (1 if (x - x0) % 2 else 2)
        bridge[(x, y)] = 60 + part; bridge[(x, y + 1)] = 64 + part
def vbridge(x, y0, y1):
    for y in range(y0, y1 + 1):
        part = 0 if y == y0 else 3 if y == y1 else (1 if (y - y0) % 2 else 2)
        bridge[(x, y)] = 68 + part * 2; bridge[(x + 1, y)] = 69 + part * 2
def hlink(a, b, y):
    rows = (y, y + 1)
    x0 = max(max(x for (x, yy) in cells_of[a] if yy == r) for r in rows) + 1
    x1 = min(min(x for (x, yy) in cells_of[b] if yy == r) for r in rows) - 1
    # the shorter of the two rows is filled out to the bridge so both rows land on deck
    for r in rows:
        for x in range(max(x for (x, yy) in cells_of[a] if yy == r) + 1, x0): deck.add((x, r))
        for x in range(x1 + 1, min(x for (x, yy) in cells_of[b] if yy == r)): deck.add((x, r))
    hbridge(x0, x1, y)
def vlink(a, b, x):
    y0 = max(y for (xx, y) in cells_of[a] if xx in (x, x + 1)) + 1
    y1 = min(y for (xx, y) in cells_of[b] if xx in (x, x + 1)) - 1
    vbridge(x, y0, y1)
hlink('nw', 'hall', 13)
hlink('hall', 'ne', 13)
hlink('garden', 'hall', 21)
hlink('hall', 'inn', 21)
vlink('hall', 'gate', 25)
xe = max(x for (x, y) in cells_of['inn'] if y in (24, 25)) + 1
hbridge(xe, W - 1, 24)
# Trunk houses: (x, baseY, width)
TRUNKS = [(23, 15, 5), (7, 11, 3), (42, 12, 3), (41, 23, 3)]
for tx, by, w in TRUNKS:
    big = w == 5
    rows = {by: (135 if big else 102), by - 1: (130 if big else 99), by - 2: (125 if big else 96),
            by - 3: (120 if big else 90), by - 4: (120 if big else 93), by - 5: (120 if big else 90)}
    for y, first in rows.items():
        for c in range(w): trunk[(tx + c, y)] = first + c

# Crowns: leaves everywhere that is not deck/bridge/trunk and not in the 1-cell ring round them
occupied = deck | set(bridge) | set(trunk)
ring = {(x + dx, y + dy) for (x, y) in deck | set(bridge) for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
crown = set()
free = lambda x, y: inside(x, y) and (x, y) not in ring and (x, y) not in occupied
cands = [(x + 0.5, y + 0.5) for y in range(H) for x in range(W)]
rnd.shuffle(cands)
centres = []
for cx, cy in cands:
    r = rnd.uniform(3.0, 5.2)
    if any((cx - ox) ** 2 + (cy - oy) ** 2 < (r + orr - 2.2) ** 2 for ox, oy, orr in centres): continue
    cells = [(x, y) for y in range(int(cy - r), int(cy + r) + 1) for x in range(int(cx - r), int(cx + r) + 1)
             if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r]
    ok = [c for c in cells if free(*c)]
    if len(ok) < 0.6 * len(cells): continue
    centres.append((cx, cy, r)); crown.update(ok)
# each trunk carries its own crown over its top rows (leaves overhang the deck behind the trunk)
for tx, by, w in TRUNKS:
    top = by - 5
    for y in range(top - 4, top + 3):
        for x in range(tx - 2, tx + w + 2):
            corner = (y in (top - 4,) and x in (tx - 2, tx + w + 1)) or (y == top + 2 and x in (tx - 2, tx - 1, tx + w, tx + w + 1))
            if inside(x, y) and not corner: crown.add((x, y))
    for y in range(top + 3, by + 1):
        for x in range(tx, tx + w): crown.discard((x, y))

for (x, y) in deck:
    m = 0
    for bit, (dx, dy) in enumerate([(0, -1), (1, 0), (0, 1), (-1, 0), (1, -1), (1, 1), (-1, 1), (-1, -1)]):
        n = (x + dx, y + dy)
        if n in deck or (n in bridge and bit < 4) or n in trunk: m |= 1 << bit
    lower[at(x, y)] = BASE + P['deckVariantMap'][str(m)]
for (x, y) in deck:
    if (x, y + 1) not in deck and (x, y + 1) not in bridge and (x, y + 1) not in trunk and inside(x, y + 1):
        lower[at(x, y + 1)] = BASE + 161
for (x, y), t in bridge.items():
    if inside(x, y): lower[at(x, y)] = BASE + t
for (x, y), t in trunk.items():
    lower[at(x, y)] = BASE + t

def grove_mask(x, y):
    m = 0
    for bit, (dx, dy) in enumerate([(0, -1), (1, 0), (0, 1), (-1, 0), (1, -1), (1, 1), (-1, 1), (-1, -1)]):
        n = (x + dx, y + dy)
        if n in crown or not inside(*n): m |= 1 << bit
    return m
for (x, y) in crown:
    upper[at(x, y)] = GROVE['variantMap'][str(grove_mask(x, y))]
    if upper[at(x, y)] == GROVE['variantMap']['255']:
        upper[at(x, y)] = rnd.choice(GROVE['interior'][0] if rnd.random() < 0.6 else GROVE['interior'][1])

# Ladder down from the gate deck (exit to the forest floor)
gy = max(y for (x, y) in cells_of['gate'] if x == 25) + 1
for k, y in enumerate(range(gy, H)):
    t = 150 if k == 0 else 152 if y == H - 1 else 151
    lower[at(25, y)] = BASE + t; upper[at(25, y)] = -1
    crown.discard((25, y))

# Props
def prop(x, y, t, layer='upper'):
    (upper if layer == 'upper' else lower)[at(x, y)] = t
taken = set(trunk) | {(x, y + d) for (x, y) in bridge for d in (0,)}
def ok(x, y): return (x, y) in deck and (x, y) not in taken and (x, y - 1) not in trunk
def place(x, y, t, layer='upper'):
    if ok(x, y): prop(x, y, t, layer); taken.add((x, y)); return True
    return False
for tx, by, w in TRUNKS:                        # lanterns flank each door
    for x in (tx - 1, tx + w):
        if place(x, by, BASE + 154, 'lower'): prop(x, by - 1, BASE + 153)
    door = tx + w // 2
    taken.update({(door, by + 1), (door, by + 2)})
for k in ('gate',):
    cx, cy = DECKS[k][:2]
    for x in (int(cx) - 3, int(cx) + 3):
        if place(x, int(cy), BASE + 154, 'lower'): prop(x, int(cy) - 1, BASE + 153)
gx, gy0 = DECKS['garden'][:2]
for i, (dx, dy) in enumerate([(-3, -1), (-1, -2), (2, -1), (-3, 2), (3, 2), (0, 2)]):
    place(int(gx) + dx, int(gy0) + dy, BASE + 156 if i % 2 == 0 else [2623, 2624][i % 2])
place(int(gx) - 2, int(gy0) + 0, 2622)
ix, iy = DECKS['inn'][:2]
place(int(ix) + 2, int(iy) + 3, 2628); place(int(ix) + 3, int(iy) + 3, 2629)
place(int(ix) - 4, int(iy) + 2, BASE + 156)
for k in ('nw', 'ne'):
    cx, cy = DECKS[k][:2]
    place(int(cx) - 4, int(cy) + 1, BASE + 156); place(int(cx) + 4, int(cy) - 1, 2622)
hx, hy = DECKS['hall'][:2]
hx, hy = int(hx), int(hy)
for dx in (-6, 6):
    place(hx + dx, hy + 2, BASE + 156)
for dx in (-4, -3, 2, 3):                        # flower beds either side of the hall walk
    place(hx + dx, hy + 3, 2616 + (dx % 2))
place(hx - 5, hy - 1, 2630); place(hx - 4, hy - 1, 2631)      # notice board by the elder's door
for dx, t in ((-5, 2638), (-4, 2638), (4, 2646)):
    place(int(ix) + dx, int(iy) - 1, t)           # barrels and a basket at the inn
for x in range(19, 23): prop(x, 13, BASE + 155) if (x, 13) in bridge else None
for x in range(35, 39): prop(x, 13, BASE + 155) if (x, 13) in bridge else None
doors = [{"x": tx + w // 2, "y": by, "front": [tx + w // 2, by + 1], "house": name}
         for (tx, by, w), name in zip(TRUNKS, ["장로 나무", "북서 줄기 집", "북동 줄기 집", "여관 줄기 집"])]
plan = {
    "id": "elf-treetop-village", "name": "엘프 나무 위 마을", "width": W, "height": H,
    "entry": [25, H - 1],
    "exits": [{"x": 25, "y": H - 1, "side": "south", "meets": "숲 바닥(밧줄 사다리 아래)"},
              {"x": W - 1, "y": 24, "side": "east", "meets": "동쪽 밧줄 다리 너머 다음 맵"}],
    "decks": {k: {"centre": [v[0], v[1]], "radius": [v[2], v[3]]} for k, v in DECKS.items()},
    "trunks": [{"x": tx, "baseY": by, "width": w} for tx, by, w in TRUNKS],
    "doors": doors,
    "counts": {"deck": len(deck), "bridge": len(bridge), "trunk": len(trunk), "crown": len(crown)},
    "note": "우듬지 위 판자 데크 여섯 곳(장로 나무 광장·줄기 집 셋·정원·입구)을 밧줄 다리로 잇는 엘프 마을. 데크 사이로 아래 깊은 숲이 어둡게 내려다보이고, 큰 나무 줄기에 둥근 창과 아치 문을 낸 집이 저마다 수관을 이고 선다. 남쪽 입구 데크에서 밧줄 사다리로 숲 바닥에 내려가고, 동쪽 밧줄 다리는 맵 밖으로 이어진다",
}
out = os.path.join(ROOT, 'tiledata/elf-treetop/catalog.json')
json.dump({"plan": plan, "map": {"lowerTiles": lower, "upperTiles": upper}}, open(out, 'w'))
print('wrote', out, plan['counts'])
