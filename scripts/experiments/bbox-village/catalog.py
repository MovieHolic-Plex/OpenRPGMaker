#!/usr/bin/env python3
"""bbox-village: English kit catalog for the layout model → <runs>/catalog.json (validator) + catalog.txt (prompt).
  python3 catalog.py <kits.json> <out dir>"""
import json, sys
K = {k["id"]: k for k in json.load(open(sys.argv[1]))}; out = sys.argv[2]
B = {  # building kits: id → English
 "bd-house-inn": "inn, red tile roof, big (town inn facing a square)", "bd-house-h124_0": "greengrocer shop house, red tile", "bd-house-h111_0": "fish shop house, red tile",
 "bd-house-h116_0": "bakery shop house, red tile", "bd-house-h119_0": "small bookshop, red tile", "bd-house-h134_0": "small greengrocer, red tile", "bd-house-h138_0": "small tavern house, red tile",
 "bd-house-h104_1": "house, red tile", "bd-house-h122_0": "wide house, red tile", "bd-house-h101_0": "house, red tile", "bd-house-h102_1": "narrow tall house, red tile",
 "bd-house-h103_2": "small house, red tile", "bd-house-h107_0": "house, red tile", "bd-house-h113_1": "small house, red tile", "bd-house-h129_0": "narrow house, red tile",
 "bd-farm-barn": "farm barn, wooden", "bd-house-mk-cottage": "one-storey cottage (medieval)", "bd-house-mk-gable-cottage": "gable-front cottage (medieval)",
 "bd-house-mk-jetty-house": "two-storey jettied house (medieval)", "bd-house-mk-merchant-house": "two-storey merchant house (medieval)", "bd-house-mk-cross-house": "cross-gabled house (medieval)",
 "bd-house-mk-thouse": "T-shaped house (medieval)", "bd-house-mk-l-farmhouse": "L-shaped farmhouse (medieval)", "bd-house-mk-longhouse": "longhouse (medieval)",
 "bd-house-mk-tower-house": "house with round watchtower (medieval)", "bd-house-mk-manor": "manor house (medieval)", "bd-house-mk-inn": "inn (medieval)",
 "bd-house-mk-smithy": "smithy (medieval)", "bd-house-mk-bakery": "bakery (medieval)", "bd-house-mk-chapel": "chapel with bell tower (medieval)", "bd-house-mk-market-hall": "open market hall on pillars (medieval)",
 "bd-house-mk-warehouse": "stepped-gable warehouse (medieval)", "bd-house-mk-granary-mill": "granary mill (medieval)", "bd-house-mk-tithe-barn": "big tithe barn (medieval)",
 "bd-house-mk-lighthouse": "lighthouse (medieval)", "bd-house-mk-dovecote": "dovecote tower",
}
P = {  # props: id → English
 "bd-prop-well_roofed": "roofed stone well", "bd-prop-stall_veg": "market stall: pumpkins and cabbages", "bd-prop-stall_herb_flower": "market stall: herbs and flowers",
 "bd-prop-flower_cart": "flower cart", "bd-prop-veg_cart": "vegetable handcart", "bd-prop-crate_apple": "apple crate", "bd-prop-crate_cabbage": "cabbage crate", "bd-prop-bench_wood": "wooden bench",
 "bd-prop-lamp_crook": "crooked street lamp", "bd-prop-fish_crates": "iced fish crates", "bd-prop-fish_barrel": "fish barrel", "bd-prop-crate_fish": "fish crate", "bd-prop-sandwich_board": "chalk sign board",
 "bd-prop-anchor_display": "anchor monument", "bd-prop-door_pots": "door pots (put against a house wall)", "bd-prop-laundry_rack": "laundry rack", "bd-prop-flowerbox_long": "long flower box",
 "bd-out-woodpile": "woodpile", "bd-prop-planter_round": "round stone planter", "bd-prop-net_rack": "fishing-net rack", "bd-prop-mooring_bollard": "mooring bollard (on the quay edge)",
 "bd-out-signpost": "wooden signpost", "bd-pick-riverside-mill-laundry-line": "laundry line", "bd-pick-riverside-mill-millstones": "millstones", "bd-pick-riverside-mill-flour-cart": "flour cart",
 "bd-pick-riverside-mill-haystack": "round haystack", "bd-pick-riverside-mill-wheat-stooks-a": "wheat stooks", "bd-pick-riverside-mill-wheat-stooks-b": "wheat stooks (b)",
 "bd-pick-riverside-mill-scarecrow": "scarecrow", "bd-pick-walled-market-sack-pile": "grain sack pile", "bd-pick-walled-market-hay-bales": "hay bales",
 "bd-pick-fishing-port-drying-rack-a": "net drying rack", "bd-pick-fishing-port-drying-rack-b": "net drying rack (wide)", "bd-pick-fishing-port-lobster-pots": "lobster pots",
 "bd-pick-fishing-port-upturned-boat": "upturned boat on land", "bd-pick-coast-cliff-road-rowboat": "rowboat (ON WATER only)", "bd-pick-swamp-stilt-rowboat": "small rowboat (ON WATER only)",
 "bd-pick-wizard-tower-bed-herb": "herb bed", "bd-pick-wizard-tower-bed-flower": "flower bed",
 "bd-pick-wheat-roman-road-wild-a": "wildflower tuft", "bd-pick-deep-forest-path-fern-a": "fern tuft", "bd-pick-deep-forest-path-stones-a": "stepping stones",
}
T = {  # trees
 "bd-tree-03a8f7": "round broadleaf tree", "bd-tree-a80c85": "round broadleaf tree", "bd-tree-3e8732": "broadleaf tree", "bd-tree-7ecdb8": "broadleaf tree",
 "bd-tree-1a786c": "tall broadleaf tree", "bd-tree-d61d7e": "tall broadleaf tree", "bd-tree-1e09f0": "tall broadleaf tree", "bd-tree-bdd36e": "tall broadleaf tree",
 "bd-tree-d43edd": "big oak", "bd-tree-5844f6": "big oak", "bd-tree-b1d104": "big oak",
 "bd-tree-e9d9b3": "small tree", "bd-tree-cc0fcb": "small tree", "bd-tree-47e17a": "small tree",
 "bd-tree-f4f319": "bush", "bd-tree-37f48b": "bush", "bd-tree-d105b2": "bush", "bd-tree-0f7ed1": "bush", "bd-mpart-bush-c": "dark round bush", "bd-mpart-bush-e": "light round bush",
}
kits, lines = {}, []
def add(d, kind):
    for i, en in d.items():
        k = K.get(i)
        if not k: print("missing", i); continue
        e = {"kind": kind, "w": k["w"], "h": k["h"], "en": en}
        if kind == "building":
            dr = k["door"]
            if not dr: print("no door", i); continue
            dy = dr["dy"] + max(1, dr.get("h") or 1) - 1 if i.startswith("bd-house-mk-") else dr["dy"]
            if dy != k["h"] - 1: print("door not at bottom", i); continue
            e["door"] = {"dx": dr["dx"], "dy": dy}
        if "ON WATER" in en: e["kind"] = "boat"
        kits[i] = e
add(B, "building"); add(P, "prop"); add(T, "tree")
# cliff cuts (ramps/stairs, experiment-local pieces from ramps/pieces.py): one id per kind x width x cliff height
for ck, cen in (("ramp", "packed-earth ramp (fits a track)"), ("stairs", "cobble stone steps (fits a paved main road / lane)")):
    for r in (1, 2, 3, 4):
        for w in (2, 3): kits[f"{ck}-h{r}-w{w}"] = {"kind": "cut", "cut": ck, "w": w, "rise": r, "en": cen}
json.dump({"kits": kits}, open(f"{out}/catalog.json", "w"), indent=0)
L = ["# Kit catalog (chipset beodeul_city, 16px cells). The attached sheet shows every kit drawn at its real size, labelled with its exact id.",
     "x,y of a kit = top-left cell of its footprint w x h. Footprints are the full rectangle (art may have transparent corners).", "",
     "## Buildings  (id | w x h | door front cell | description)",
     "The door is on the bottom row; the DOOR FRONT cell (just below the door, outside the building) must be a road/track/plaza cell."]
for i, e in kits.items():
    if e["kind"] == "building": L.append(f"{i} | {e['w']}x{e['h']} | (x+{e['door']['dx']}, y+{e['h']}) | {e['en']}")
L += ["", "## Props  (id | w x h | description) — on dry land; props may also stand on a plaza; boats only on water"]
for i, e in kits.items():
    if e["kind"] in ("prop", "boat"): L.append(f"{i} | {e['w']}x{e['h']} | {e['en']}")
L += ["", "## Trees  (id | w x h | description) — the footprint includes the crown"]
for i, e in kits.items():
    if e["kind"] == "tree": L.append(f"{i} | {e['w']}x{e['h']} | {e['en']}")
L += ["", "## Cliff cuts: ramps and stairs  (id | footprint w x cliff height | description)",
      "A cut is drawn INTO a south-facing cliff face (higher level to the north) and is exactly as tall as that face: a cliff of",
      "height 2 (level difference 2) needs an -h2- piece. Place it by its FOOT: x,y = the left cell of the row on the LOWER level",
      "directly south of the cliff; it covers columns x..x+w-1. Entry = the row below (x..x+w-1, y+1), lower level; exit = the row above",
      "(x..x+w-1, y-1), higher level; both rows must be road/track/plaza cells. dir is \"north\" (walk north to climb). The foot row",
      "itself is path (do not list it as road). The cliff right beside the cut on BOTH sides (columns x-1 and x+w) must be the same face",
      "(same lower and higher level as the cut): never put a cut where the cliff steps.",
      "REVERSE CUT (north-facing cliff: higher level to the SOUTH of the lower ground): dir \"south\" (walk south to climb). Same ids.",
      "x,y = the left cell of the lower-level row directly NORTH of the cliff. It takes rise+2 rows on the lower level: rows",
      "y-rise-1..y, columns x..x+w-1, all one dry lower level (in 3/4 view the rise rows hide behind the terrace; 2 rows show the way",
      "down). Entry = row y-rise-2 (lower level), exit = row y+1 (higher level); both road/track/plaza. Same flank rule. Reverse cuts",
      "do not stack. Use whichever face your road actually meets — do not detour to a south face.",
      "STACKED FLIGHT (climbing two or more levels at once): where a cut's exit row is a ONE-row strip of a middle level with another",
      "cliff right behind it, put a second cut ON that strip: same columns (same x), same kind and width, its foot y = the strip row,",
      "each piece matching its OWN cliff height. The strip is the landing between the flights; the row behind the top flight must be",
      "road/track/plaza. Example: levels 0 (y=19), 2 (strip y=18), 4 (y=17): {\"id\": \"stairs-h2-w2\", \"x\": 22, \"y\": 19, \"dir\": \"north\"} +",
      "{\"id\": \"stairs-h2-w2\", \"x\": 22, \"y\": 18, \"dir\": \"north\"}, road on row 17 and row 20.",
      "A stack has at most two flights, and only the canonical split has art: lower = floor(total/2), upper = the rest",
      "(1+1, 1+2, 2+2, 2+3, 3+3, 3+4, 4+4). Other splits (e.g. 3 lower + 1 upper) are rejected — climb elsewhere."]
for i, e in kits.items():
    if e["kind"] == "cut": L.append(f"{i} | {e['w']} wide x {e['rise']} tall face | {e['en']}")
L += ["", "## Surfaces (rects, not kits)",
      "road kind main = paved stone road, lane = paved lane, track = sandy dirt path, pier = wooden plank pier (the only road that may go onto the sea; on a river any road becomes a plank bridge)",
      "plaza = paved stone square (props may stand on it)",
      "field crop: wheat | barley | rye (1-cell crop tiles, any size >= 2x2) · vines (vineyard rows, size a multiple of 8x4) · herbs | flowers (2x2 beds, even sizes)",
      "forest = continuous tree canopy (blocks walking), any rects; overlapping rects merge into one wood",
      "fence = wooden fence ring around a rect with one gate cell; cuts = ramps/stairs through cliffs (see above)"]
open(f"{out}/catalog.txt", "w").write("\n".join(L) + "\n")
print(len(kits), "kits")
