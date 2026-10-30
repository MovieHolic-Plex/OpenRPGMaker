#!/usr/bin/env python3
"""bbox-chipsets (round 2), one run: same as bbox-room run.py, but the place picks a chipset and its generated catalog/palette.
  python3 scripts/experiments/bbox-chipsets/run.py <place> <sol|terra> <rep>     (run from the worktree root)
Out: $BBOX_RUNS/<arm><rep>/<task>/ {prompt.txt, call-N.json, layout-N.json, check-N.json, layout.json, layout.png, map.png, RUN.json}
Model: gpt-6.1-sol / gpt-6.1-terra high via local opencodex (127.0.0.1:10200), one direct chat call + at most 3 repair calls.
Round 2: the model may call find_pieces(category, tags) (answered from index-<place>.json, with a picture); the validator adds size/space checks (space.mts)."""
import base64, json, os, re, subprocess, sys, time, urllib.request
task, arm, rep = sys.argv[1], sys.argv[2], sys.argv[3]
HOME = os.path.expanduser("~")
RUNS = os.environ.get("BBOX_RUNS", f"{HOME}/z-project/assistant-whole-game/suite/rooms/runs-bbox-chipsets-2")
POOLD = f"{RUNS}/base/pool"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from places import PLACES
P = PLACES[task]; TS = P["tileset"]
G = f"{RUNS}/{arm}{rep}/{task}"; os.makedirs(G, exist_ok=True)
MODEL = {"sol": "gpt-6.1-sol", "terra": "gpt-6.1-terra"}[arm]
OCX = "http://127.0.0.1:10200/v1/chat/completions"
# same request text as img-room-test (run_one.sh)
SUFFIX = " 다른 맵은 만들지 말고 이 방 하나만 지어 줘."
REQ = P["request"] + SUFFIX
catalog = open(f"{RUNS}/cat/catalog-{task}.txt").read()
SF = f"{HOME}/z-project/assistant-whole-game/suite/rooms/objpool/_structure_ideas.md"
STRUCT = ("# Structure vocabulary (ideas to choose from — not templates to copy; use only what fits this room's purpose)\n" + open(SF).read().strip() + "\n\n") if os.path.exists(SF) else ""
PROMPT = f"""You design one RPG map room as an exact cell layout. Your JSON is laid onto the map cell by cell by code that only executes it — every floor, wall, opening and object you write is exactly what appears, nothing is added.

User request (Korean): {REQ}

{catalog}
# Grid rules (16px cells, x to the right, y down, origin top-left)
- Every cell outside all regions is solid (dark wall top / void). Regions are rectangles of interior space.
- Regions that touch or overlap merge into one open space. To put a wall between two regions, leave at least one solid cell between them, then carve openings.
- Wall face: inside any region, the two rows directly below a solid cell are the wall face (drawn as wall, not walkable). So a region's top two rows are its north wall; floor starts at row y+2.
  'wall-mounted' pieces go on the upper face row (row y of the region). 'against-wall' pieces go on the first floor row (y+2) right under the face.
- Openings are cells carved through solid cells. In a horizontal solid wall a 1-cell opening is a doorway. In a vertical solid wall an opening must be 3 cells tall (its top two cells become wall face; the bottom one is the walkable passage).
- Keep a solid border: regions inside x 1..w-2, y 1..h-2. The entrance is one cell on the bottom map row (y = h-1) directly below a region cell; the bottom row is otherwise solid.
- Footprints must not overlap each other, must lie on floor cells, and every piece needs a reachable free side. Keep walking paths from the entrance to every area. Decals/carpets/daises are walkable and may lie under furniture.
- Pieces with art taller than the footprint draw upward; leave that space free of other tall pieces.

# Output: one JSON object only, no prose
{{"map": {{"w": W, "h": H}},
 "landmark": {{"id": "...", "x": X, "y": Y, "purpose": "..."}},
 "regions": [{{"id": "hall", "x": X, "y": Y, "w": W, "h": H, "floor": "<floor id>", "wall": "<wall id>", "purpose": "..."}}],
 "openings": [{{"x": X, "y": Y, "w": 1, "h": 1, "purpose": "..."}}],
 "entrance": {{"x": X, "y": H-1}},
 "carpets": [{{"id": "<carpet id>", "x": X, "y": Y, "w": W, "h": H, "purpose": "..."}}],
 "daises": [{{"id": "<dais id>", "x": X, "y": Y, "w": W, "h": H}}],
 "objects": [{{"id": "<catalog id>", "x": X, "y": Y, "repeat": {{"count": 4, "dx": 2, "dy": 0}}, "purpose": "..."}}]}}
# Floors (a material per zone — code lays the tiles)
- A floor id is a material for a whole zone, not something you draw tile by tile. Give each room ONE dominant floor, plus at most one purposeful sub-zone of another floor (a genkan / entry strip, kitchen or bath tiles, a wet area) made as its own small region. Doorways and openings automatically take the floor of the room they open into; do not add floor strips for them.
- No single-cell floor patches of a different material.
- Tatami: if a region's floor is "tatami", add "jo": N (number of mats). Code lays whole 1x2-cell mats edge-aligned in the proper pattern (no point where four mat corners meet). Each mat is 2 floor cells, so the region's floor (w x (h-2)) must hold exactly 2*N cells as an even rectangle: 4 jo = 4x2, 6 jo = 4x3 or 6x2, 8 jo = 4x4, 12 jo = 4x6 or 6x4, 18 jo = 6x6 floor cells. Do not place tatami mats as objects.
x,y of a piece = the top-left cell of its footprint. "repeat" is optional (count copies, each shifted by dx,dy). carpets/daises only if the catalog lists them. Sized pieces go in "objects" with the size in the id (e.g. "<id> 3x2").
# Size and space (checked by the validator — a failing layout is sent back)
- Design principle: size each room to its content. First decide each room's furniture groups, then draw the region just big enough for them plus 1-cell aisles. A small full room beats a big empty one.
- A floor cell is bare when no standing piece is on it or next to it (8 neighbours). Wall-mounted pieces, decals and carpets do not count as standing pieces.
- Per region: at most 30% of its floor may be bare, and no bare rect with both sides >= 2 and area >= 14 (e.g. 2x7, 3x5, 4x4). Whole map: at most 25% bare.
- When a region fails, the validator names the empty rect; then either shrink the region or fill that rect with a purposeful group that belongs in that room.
{STRUCT}Design a specific, lived-in room that fits the request: not a plain rectangle — use several regions (side rooms, alcoves, an L or two-part shape), a clear landmark, distinct functional zones, and enough furniture and decoration that no large floor area is empty. Use the chipset's range: many different pieces (look them up with find_pieces), not the same few repeated."""
if P.get("mode") == "outdoor":
    PROMPT = f"""You design one RPG outdoor place as an exact cell layout. Your JSON is laid onto the map cell by cell by code that only executes it — every ground cell and every piece you write is exactly what appears, nothing is added.

User request (Korean): {REQ}

{catalog}
# Grid rules (16px cells, x to the right, y down, origin top-left, 3/4 top-down view: buildings show roof and front wall, the door is on the front (south) side)
- The whole map is first filled with the 'base' ground, then each 'grounds' zone is painted in order (later zones win), then each ground path. Autotile grounds (marked autotile in the catalog) draw their own soft edges against their neighbours — prefer them for zones that sit on grass, so the transitions are natural.
- Ground zones should have natural, irregular outlines, not boxes: give "shape" instead of x/y/w/h — {{"blob": [[cx, cy, r], ...]}} (overlapping round lumps), {{"poly": [[x, y], ...]}} (outline corners), {{"ellipse": [cx, cy, rx, ry]}} or {{"rect": [x, y, w, h]}} — and "edge": "rough" (or "smooth"/"none") to roughen the outline. A plain x/y/w/h rect is fine for paved courts inside walls.
- Paths are lines, and code renders them: {{"ground": id, "points": [...], "width": 1-3}} paints a continuous path of that ground along the polyline; {{"stones": piece id, "points": [...], "spacing": 2-4}} sets stepping stones along the line at an even spacing (cells already used by a piece are skipped). "curve": true smooths the line. Dirt grounds (yard*, road*, slab_dirt) have grass-rimmed edges, so dirt is never painted over dirt (those cells are left as they were): a dirt path or dirt zone belongs on grass; across a dirt yard use a stepping-stone path or paving. Draw the line between the places it connects (gate → madang → each wing's step stone, well → kitchen); do not place path stones one by one as objects.
- A piece is stamped whole at x,y = top-left of its art box. Two pieces may not both draw the same cell (only '.' cells of a piece may share a cell with another piece).
- X cells block walking; o cells are walkable (eaves/canopy you walk behind, or flat art). Pieces must lie inside the map.
- Every building needs a walkable approach to the cell right below its door (the bottom row of its art box). Walls are built from small wall pieces placed cell by cell (use "repeat").
- The entrance is one walkable cell on the map edge (usually the bottom row), where the player arrives. Keep walking paths from the entrance to every area and building door.

# Output: one JSON object only, no prose
{{"map": {{"w": W, "h": H}},
 "base": "<ground id>",
 "grounds": [{{"id": "<ground id>", "shape": {{"blob": [[CX, CY, R], [CX2, CY2, R2]]}}, "edge": "rough", "purpose": "...", "open": false}},
             {{"id": "<ground id>", "x": X, "y": Y, "w": W, "h": H, "purpose": "..."}}],
 "paths": [{{"ground": "<ground id>", "points": [[X, Y], [X, Y], [X, Y]], "width": 2, "curve": true, "purpose": "..."}},
           {{"stones": "<stepping-stone piece id>", "points": [[X, Y], [X, Y]], "spacing": 2, "curve": true, "purpose": "..."}}],
 "landmark": {{"id": "...", "x": X, "y": Y, "purpose": "..."}},
 "entrance": {{"x": X, "y": H-1}},
 "objects": [{{"id": "<catalog id>", "x": X, "y": Y, "repeat": {{"count": 4, "dx": 1, "dy": 0}}, "purpose": "..."}}]}}
"repeat" is optional (count copies, each shifted by dx,dy). Do not repeat the landmark inside "objects".
# Size and space (checked by the validator — a failing layout is sent back)
- Design principle: size the yard to its content. Decide the buildings and the groups between them first, then make the map just big enough.
- Bare ground = a walkable cell with no piece on it or next to it (8 neighbours). At most 40% of the walkable ground may be bare, the open courtyard included.
- An intentional open courtyard is allowed: mark at most one grounds rect with "open": true. Outside it, no bare rect with both sides >= 4 and area >= 20.
- When the check fails, the validator names the empty rect; then shrink the map/walls there or fill it with a purposeful group (jar terrace, well with its path, garden bed with trees and rocks, woodpile by the kitchen).
# How a Korean yangban house yard works (why the open centre is allowed)
- A hanok compound is zoned by function. The house wings take an ㄱ, ㄷ or ㅁ layout chosen by what they hold: the sarangchae (men's quarters, guests) near the gate, the anchae (family quarters) deeper inside, the kitchen at the end of the anchae wing, haengnang (servants, storage) along the gate wall.
- The madang (open yard) is a deliberate centre — work, ceremonies and light happen there — so it stays open. It is not leftover space: it is framed by purposeful edges.
- Typical edges: a jangdokdae (crock terrace) next to the kitchen wing, a well with a stone path to the kitchen, a vegetable patch, a firewood stack by the kitchen, drying racks / pepper mats, stepping-stone paths between the wings, and a back garden (hwagye terraces, trees, rocks) behind the anchae.
- So: choose the wing layout by function, put the open madang between the wings, and line its edges with these groups. The catalog's category list has these pieces — use find_pieces on the prop categories (e.g. prop-other, trees, bushes) to get them.
Design a specific, lived-in place that fits the request: a clear landmark, distinct functional zones, enclosing walls where they belong, and enough pieces that no large ground area is empty. Use the chipset's range: many different pieces (look them up with find_pieces), not the same few repeated."""
ARM = os.environ.get("BBOX_ARM", "json")   # round 4: "sketch" = ASCII floor plan first, then JSON for rooms/objects
ASKS = []
def ask_once(text):
    body = json.dumps({"model": MODEL, "messages": [{"role": "user", "content": text}], "reasoning_effort": "high"}).encode()
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(OCX, body, {"content-type": "application/json"}), timeout=600) as r: return json.load(r)["choices"][0]["message"]["content"] or ""
        except Exception:
            if attempt == 2: raise
            time.sleep(20)
if ARM == "sketch" and P.get("mode") != "outdoor":
    t = ask_once("List the things this map request explicitly asks to be in the place: named rooms/areas, and furniture or equipment the described activities need "
                 "(e.g. 'students practise at cauldrons' -> 'cauldron workstations for the students'). Only what the text says or directly implies; no extras. "
                 "Answer with a JSON array of 2-8 short English phrases only.\n\nRequest (Korean): " + REQ)
    m = re.search(r"\[.*\]", t, re.S)
    try: ASKS = [str(a).strip() for a in json.loads(m.group(0))][:8] if m else []
    except Exception: ASKS = []
    json.dump(ASKS, open(f"{G}/asks.json", "w"), ensure_ascii=False, indent=1)
    FLOORS = PROMPT[PROMPT.index("# Floors (a material"):PROMPT.index("x,y of a piece")]
    SPACE = PROMPT[PROMPT.index("# Size and space"):PROMPT.index("Design a specific")]
    PROMPT = f"""You design one RPG map room. First you draw its floor plan as a character grid, like an architect's sketch, at the real cell size; then a JSON object adds the rooms' floors and walls and every piece. Code executes both exactly — nothing is added.

User request (Korean): {REQ}

{catalog}
# Draw the plan like an architect (why it matters)
- Shape each room by its use, not by a default rectangle: how people move through it (circulation from the entrance to every room, no dead corridors), where light and views come from, which rooms open into each other and which are closed off. A kitchen hangs off the living room it serves; a tatami room sits apart, behind its own sliding door; a classroom has its teaching end and its working floor.
- Plain boxes lined up are what to avoid. Use the outline and the partitions that fit the purpose: an L-shaped or stepped room, a bay or alcove, a corridor that bends, a room opening into another without a wall (two letters touching = one open space with two floor zones), columns, a half-wall or counter dividing zones, a raised dais at the teaching or ceremonial end.
# Plan sketch rules (16px cells, x to the right, y down, origin top-left; every row exactly the map width)
- '#' solid wall or void outside. Room cells use the room's letter (A-Z, not D), on EVERY cell of that room. Walls between rooms are 1 cell of '#'.
- 'D' = a door/opening. In a horizontal wall: one 'D' with '#' left and right and rooms above and below. In a vertical wall: 3 'D' stacked (the top two become wall face, the bottom one is the passage).
- The outer border is all '#', except exactly one 'D' on the bottom row = the entrance, directly below a room cell.
- Inside any room, the two rows directly below a '#' are wall face (drawn as wall, not walkable): draw them with the room letter. So a room's top two rows are its north wall; walkable floor starts on the third row. 'wall-mounted' pieces go on the first of those rows; 'against-wall' pieces on the first walkable row.
- Optional, inside rooms: 'c' column, '=' half-wall / counter / railing / planter (each a 1x1 standing piece you name in "symbols"), '^' dais cells (a dais id from the catalog in "symbols"). These cells count as the room's floor.
# Output: a ```plan block, then a ```json block, nothing else
```plan
##########
#AAAA#BBB#
#AAAA#BBB#
#AAAA#BBB#
#AAcA##D##
#AAAAAAAA#
#AAAAAAAA#
####D#####
```
(example of the format only — not a template; your plan has the size and shape your room needs)
```json
{{"rooms": {{"A": {{"id": "hall", "floor": "<floor id>", "wall": "<wall id>", "purpose": "..."}}, "B": {{"id": "...", "floor": "...", "wall": "...", "purpose": "..."}}}},
 "symbols": {{"c": "<1x1 catalog piece id>", "=": "<1x1 catalog piece id>", "^": "<dais id>"}},
 "landmark": {{"id": "...", "x": X, "y": Y, "purpose": "..."}},
 "carpets": [{{"id": "<carpet id>", "x": X, "y": Y, "w": W, "h": H, "purpose": "..."}}],
 "objects": [{{"id": "<catalog id>", "x": X, "y": Y, "repeat": {{"count": 4, "dx": 2, "dy": 0}}, "purpose": "..."}}],
 "required": [{{"ask": "<required item, exactly as listed below>", "ids": ["<catalog ids you placed for it>"]}}]}}
```
x,y of a piece = the top-left cell of its footprint (same coordinates as the plan). "repeat" is optional. Footprints must not overlap, must lie on walkable floor, and every piece needs a reachable free side; keep paths from the entrance to every area. Sized pieces go in "objects" with the size in the id (e.g. "<id> 3x2"). "symbols" only for the characters you use; carpets only if the catalog lists them.
{FLOORS}{SPACE}# Required items (a todo list read from the request — each one must be in your layout)
""" + "\n".join(f"- {a}" for a in ASKS) + """
For each, find a fitting piece (use find_pieces with the item's words), place it sized and positioned for its use, and list it in "required" with the ids you placed. Only if the chipset truly has no fitting piece, give {"ask": ..., "missing": "<why nothing fits>"} instead of "ids".
""" + (STRUCT.replace("# Structure vocabulary", "# More structure ideas") if STRUCT else "") + "Design a specific, lived-in room that fits the request, with a clear landmark, distinct functional zones and enough furniture that no large floor area is empty. Use the chipset's range: many different pieces (look them up with find_pieces), not the same few repeated."
open(f"{G}/prompt.txt", "w").write(PROMPT)
IMG = "data:image/png;base64," + base64.b64encode(open(f"{RUNS}/cat/palette-{task}.png", "rb").read()).decode()
msgs = [{"role": "user", "content": [{"type": "text", "text": PROMPT}, {"type": "image_url", "image_url": {"url": IMG}}]}]

IDX = json.load(open(f"{RUNS}/cat/index-{task}.json"))
RAW = json.load(open(f"{RUNS}/cat/{task}.raw.json"))
TOOLS = [{"type": "function", "function": {"name": "find_pieces", "description":
          "Look up more pieces of this chipset. Returns every matching piece id with footprint, placement rule and description (catalog line format), and a picture of them. "
          "category = a category id from the catalog's category list (or \"\" for all categories); tags = words to match in names/descriptions/tags (any word may match; [] = whole category).",
          "parameters": {"type": "object", "properties": {"category": {"type": "string"}, "tags": {"type": "array", "items": {"type": "string"}}}, "required": ["category"]}}}]
lookups = []
def find_pieces(args):
    cat = (args.get("category") or "").strip(); tags = [str(t).lower() for t in (args.get("tags") or []) if str(t).strip()]
    cats = IDX["categories"]
    if cat and cat not in cats:   # accept a category name too
        hit = [c for c, v in cats.items() if cat.lower() in (c + " " + v["name"]).lower()]
        cat = hit[0] if len(hit) == 1 else cat
    pool = [p for p in IDX["pieces"] if not cat or p["cat"] == cat]
    if cat and cat not in cats: return f"unknown category '{cat}'. Categories: " + ", ".join(cats), []
    scored = [(sum(1 for t in tags if t in p["text"]), p) for p in pool]
    if tags: scored = [x for x in scored if x[0] > 0]
    scored.sort(key=lambda x: (-x[0], -x[1]["score"], x[1]["id"]))
    got = [p for _, p in scored[:30]]
    head = f"{len(scored)} match(es) in {cat or 'all categories'}{' for ' + ', '.join(tags) if tags else ''}" + (f"; showing 30 — narrow with tags" if len(scored) > 30 else "")
    return head + "\n" + "\n".join(p["line"] for p in got), got

def picture(pieces):
    from cards import Sheet, pack
    os.environ["BBOX_POOL_DIR"] = POOLD
    SH = Sheet(RAW); im = pack([(None, [SH.card(p["id"], [tuple(c) for c in p["cells"]]) for p in pieces])], 1200)
    import io; b = io.BytesIO(); im.save(b, "PNG"); return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()

def call(n):
    """one model turn = model answers, possibly after find_pieces lookups (at most 8 per run in total)."""
    t0 = time.time(); usage = {"total_tokens": 0, "prompt_tokens": 0, "completion_tokens": 0}; k = 0
    while True:
        tools_ok = len(lookups) < 8
        body = json.dumps({"model": MODEL, "messages": msgs, "reasoning_effort": "high", **({"tools": TOOLS} if tools_ok else {})}).encode()
        for attempt in range(3):
            try:
                with urllib.request.urlopen(urllib.request.Request(OCX, body, {"content-type": "application/json"}), timeout=900) as r: d = json.load(r)
                break
            except Exception as e:
                if attempt == 2: raise
                time.sleep(20)
        u = d.get("usage") or {}
        for key in usage: usage[key] += u.get(key, 0) or 0
        m = d["choices"][0]["message"]; tc = m.get("tool_calls") or []
        json.dump({"secs": round(time.time() - t0, 1), "usage": u, "model": d.get("model"), "text": m.get("content"), "tool_calls": tc}, open(f"{G}/call-{n}{'-t' + str(k) if tc else ''}.json", "w"), ensure_ascii=False, indent=1)
        if not tc: return m.get("content") or "", round(time.time() - t0, 1), usage
        msgs.append({"role": "assistant", "content": m.get("content"), "tool_calls": tc}); pics = []
        for c in tc:
            try: args = json.loads(c["function"]["arguments"] or "{}")
            except Exception: args = {}
            txt, got = find_pieces(args) if c["function"]["name"] == "find_pieces" else ("unknown tool", [])
            lookups.append({"call": n, "args": args, "found": len(got), "ids": [p["id"] for p in got]})
            msgs.append({"role": "tool", "tool_call_id": c["id"], "content": txt}); pics += got
        if pics: msgs.append({"role": "user", "content": [{"type": "text", "text": "Picture of the pieces find_pieces returned (labelled with their ids):"}, {"type": "image_url", "image_url": {"url": picture(pics[:40])}}]})
        k += 1

def parse(text):
    m = re.search(r"\{.*\}", text, re.S)
    try: return json.loads(m.group(0)) if m else None
    except Exception: return None

def lay(n, layout, render=False):
    f = f"{G}/layout-{n}.json"; json.dump(layout, open(f, "w"), indent=1)
    out = f"{G}/lay-{n}" if not render else G
    p = subprocess.run(["bun", "scripts/experiments/bbox-chipsets/" + ("lay_outdoor.mts" if P.get("mode") == "outdoor" else "lay.mts"), TS, f, out, f"{RUNS}/base"] + (["--render"] if render else []),
                       capture_output=True, text=True, env=dict(os.environ, OPRN_SHARED_CONTENT_SQLITE=f"{RUNS}/shared-content.sqlite", BBOX_POOL_DIR=POOLD))
    try: return json.loads(p.stdout.strip().splitlines()[-1])
    except Exception: return {"ok": False, "errors": ["painter crashed: " + (p.stderr or p.stdout)[-500:]], "warnings": []}

NUDGED, REQNOTES, SKINFO = set(), [], {}
def sketch_turn(n, text):
    """```plan block → layout (sketch.py), then the usual lay.mts check plus the required-items todo check."""
    import sketch
    pm = re.search(r"```plan\s*\n(.*?)```", text, re.S); jm = re.search(r"```json\s*\n(.*?)```", text, re.S)
    J = None
    try: J = json.loads(jm.group(1)) if jm else parse(text[pm.end():] if pm else text)
    except Exception: J = None
    if not pm: return None, {"ok": False, "errors": ["The answer has no ```plan block. Start with the plan sketch in a ```plan fenced block, then the ```json block."], "warnings": []}
    if not isinstance(J, dict): return None, {"ok": False, "errors": ["The ```json block is missing or not one parseable JSON object."], "warnings": []}
    layout, errs, info = sketch.to_layout(pm.group(1).split("\n"), J); SKINFO.update(info)
    if errs or layout is None:
        if layout: json.dump(layout, open(f"{G}/layout-{n}.json", "w"), indent=1)
        return layout, {"ok": False, "errors": errs, "warnings": []}
    chk = lay(n, layout)
    rerr, notes = sketch.required_check(J, ASKS, layout, IDX["pieces"], NUDGED); REQNOTES[:] = notes
    chk["errors"] = list(chk.get("errors", [])) + rerr; chk["ok"] = chk.get("ok", False) and not rerr
    return layout, chk

calls, layout, chk = [], None, None
for n in range(4):   # first call + at most 3 repairs
    text, secs, u = call(n); calls.append({"secs": secs, "tokens": u.get("total_tokens", 0), "in": u.get("prompt_tokens", 0), "out": u.get("completion_tokens", 0)})
    msgs.append({"role": "assistant", "content": text})
    if ARM == "sketch" and P.get("mode") != "outdoor":
        layout, chk = sketch_turn(n, text)
    else:
        layout = parse(text)
        chk = lay(n, layout) if layout else {"ok": False, "errors": ["Your answer was not one parseable JSON object."], "warnings": []}
    json.dump(chk, open(f"{G}/check-{n}.json", "w"), indent=1)
    print(f"{arm}{rep}/{task} call {n}: {secs}s tok={u.get('total_tokens')} ok={chk['ok']} errors={len(chk['errors'])}", flush=True)
    if chk["ok"]: break
    if n < 3:
        msgs.append({"role": "user", "content": "Fixed call: the layout was rejected by the validator. Fix every problem below and return the full corrected answer only (same format" + (": the ```plan block and the ```json block" if ARM == "sketch" else " — the layout JSON") + ").\n- "
                     + "\n- ".join(chk["errors"][:40]) + ("\nWarnings (fix if you can):\n- " + "\n- ".join(chk["warnings"][:10]) if chk["warnings"] else "")})
spaceOnly = bool(chk and not chk["ok"] and chk.get("structOk"))
res = {"task": task, "tileset": TS, "arm": arm, "rep": int(rep), "model": MODEL, "calls": calls, "repairs": len(calls) - 1, "ok": bool(chk and chk["ok"]),
       "structOk": bool(chk and chk.get("structOk")), "structVocab": bool(STRUCT), "arm2": ARM, "asks": ASKS, "requiredNotes": REQNOTES, "sketch": SKINFO, "spaceErrors": [e for e in (chk or {}).get("errors", []) if e.startswith("space:")], "lookups": lookups,
       "secs": round(sum(c["secs"] for c in calls), 1), "tokens": sum(c["tokens"] for c in calls)}
if res["ok"] or spaceOnly:
    json.dump(layout, open(f"{G}/layout.json", "w"), indent=1)
    fin = lay("final", layout, render=True); res["warnings"] = fin.get("warnings"); res["stats"] = {k: v for k, v in (fin.get("stats") or {}).items() if k != "plan"}
    res["rendered"] = os.path.exists(f"{G}/map.png")
    if spaceOnly: res["errors"] = chk["errors"][:20]
else:
    res["errors"] = chk["errors"][:20] if chk else ["no answer"]
    if layout: json.dump(layout, open(f"{G}/layout.json", "w"), indent=1)
json.dump(res, open(f"{G}/RUN.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps(res)[:400])
