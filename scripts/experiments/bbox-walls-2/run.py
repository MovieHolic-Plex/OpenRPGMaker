#!/usr/bin/env python3
"""bbox-walls-2, one run: the model writes a walls-first layout JSON, code rasterizes/validates/lays it exactly (one shot + Rejected repairs).
New vs bbox-walls: exact multi-cell footprints/anchors/entry sides (stairs = 3x3 kit), empty-floor + rug + purpose checks, more floor types, object pool.
  python3 scripts/experiments/bbox-walls-2/run.py <inn|library|jail|manor> <sol|terra> <rep> [--critique N]   (from the worktree root)
--critique N (optional, default 0): after a valid layout, N self-critique rounds (the model sees its laid map and returns a full corrected layout).
Out: $BW_RUNS/<arm><rep>/<task>/ {prompt.txt, call-N.json, layout-N.json, check-N.json, layout.json, map.png, RUN.json}"""
import base64, json, os, re, subprocess, sys, time, urllib.request
task, arm, rep = sys.argv[1], sys.argv[2], sys.argv[3]
CRIT = int(sys.argv[sys.argv.index("--critique") + 1]) if "--critique" in sys.argv else 0
HOME = os.path.expanduser("~")
RUNS = os.environ.get("BW_RUNS", f"{HOME}/z-project/assistant-whole-game/suite/rooms/runs-bboxwalls2")
G = f"{RUNS}/{arm}{rep}/{task}"; os.makedirs(G, exist_ok=True)
MODEL = {"sol": "gpt-6.1-sol", "terra": "gpt-6.1-terra"}[arm]
OCX = "http://127.0.0.1:10200/v1/chat/completions"
REQ = {"inn": "Build the ground floor of a small village inn: a common hall where guests are greeted at the reception counter and eat at tables, a kitchen, a staircase up, and two guest rooms.",
       "library": "Build an old town library: a hall of tall book stacks and a quiet reading room, plus whatever small rooms fit (an archive, the librarian's office).",
       "jail": "Build a town jail: a guard room at the entrance, a corridor, and a row of prison cells.",
       "manor": "Build the ground floor of a noble manor: an entrance hall, a drawing room, a dining room, a kitchen, and a staircase up."}[task]
catalog = open(f"{RUNS}/catalog-{task}.txt").read()
SERVES = {"inn": (["common hall", "kitchen", "guest room", "guest room"], ["corridor", "storage", "pantry", "washroom", "stair hall", "office"]),
          "library": (["book stacks", "reading room"], ["archive", "office", "corridor", "storage", "entrance hall", "stair hall"]),
          "jail": (["guard room", "corridor", "cell", "cell"], ["storage", "office", "armory", "interrogation room", "washroom"]),
          "manor": (["entrance hall", "drawing room", "dining room", "kitchen"], ["corridor", "pantry", "storage", "study", "stair hall", "washroom", "servants room"])}[task]
PROMPT = f"""You design one RPG interior map (16px cells, 3/4 top-down view) as an exact layout. Code only executes your JSON: every wall, door and piece you write appears exactly where you put it, nothing is added or moved.

User request: {REQ}

{catalog}
# How walls work in this 3/4 view (read carefully)
Coordinates: x to the right, y down, origin top-left. A wall is a line of solid cells (seen from above as a dark cap).
- A wall shows a FACE only on its SOUTH side: the 2 cells directly below any wall cell are wall face (drawn as wall, not walkable). So a room's first 2 rows under its north wall are face; its floor starts 3 rows below the wall cell.
  Example: wall cells on row y=6 -> rows 7 and 8 are face -> floor starts at row 9.
- Vertical walls and the south side of the building show only the cap (no face). Nothing can hang on them.
- WALL-MOUNTED pieces (windows, shelves, signs, banners, pictures) hang on the UPPER face row: y = (wall row)+1, directly under a wall cell of the named wall.
- AGAINST-WALL pieces (fireplace, bookshelves, beds, cupboards, kitchen range) stand on the first floor row: y = (wall row)+3, directly under the 2-row face of the named wall.
- STAIRS UP are a 3x3 kit: 3 columns wide, covering the wall's 2 face rows and the first floor row. Write x,y = the left cell of its floor row (y = wall row + 3). All 3 columns must be under one straight north wall (no door, corner or other wall piece in those 3 columns), and the 3 cells right below it (y+1) are its ENTRY: keep them free floor.
- Windows go on the outer wall only.

# Layout primitives
1. outer_wall: a closed ring of wall cells around the whole building: "path" = corner points [x,y], each segment horizontal or vertical, returning to the first point. Everything outside the ring is void. Its south side must run along the bottom map row y=H-1 where the entrance is. The ring may have notches (L, T, U shapes), not only a rectangle.
2. walls: interior partition walls, each a "path" of corner points (straight segments), "thickness" 1 (or 2 for a thick wall), and a "material". A partition must run from wall to wall: both ends must touch another wall (or the outer ring), so every room is fully closed. ("stub": true allows a freestanding wall piece with loose ends.)
3. doors: openings carved in a partition wall: {{"wall": id, "x", "y"}} where (x,y) is a cell of that wall.
   - In a horizontal wall: a 1-cell gap ("width" may be 2-3). It joins the room north of the wall with the room south of it.
   - In a vertical wall: a doorway is 3 cells tall: (x,y) is the walkable BOTTOM cell, and (x,y-1),(x,y-2) above it are also cut (they turn into wall face). All 3 cells must belong to that wall.
   - Optional "piece": "locked door" | "iron gate" | "iron gate open" puts a door leaf in the doorway.
4. entrance: one cell of the outer wall on the bottom row y=H-1, with a room cell directly above it. It is the only opening in the outer wall.
5. rooms: every space closed by walls is a room. Give each one: {{"id", "at": [x,y] any cell inside it, "floor": floor id, "serves": one purpose tag, "purpose"}}. Every enclosed space needs exactly one room entry; two rooms in one connected space means a wall is not closed.
   "serves" tags required by this request (each its own room): {", ".join(SERVES[0])}. Optional extra tags: {", ".join(SERVES[1])}.
5b. zones (optional): a second purpose inside one room only when it is clearly bounded: {{"room": room id, "serves": tag, "rect": [x,y,w,h], "floor": optional floor id}}. Every open side of the rect must be lined (at least half of it) with a 'fence' rail, counters or shelves; otherwise use walls and a door.
6. wall_items: wall-mounted and against-wall pieces, each with the "wall" it belongs to ("outer" or a partition id) and its exact x,y (see the rule above).
7. objects: floor pieces (furniture, decals, sized tables), x,y = top-left cell of the footprint. Optional "repeat": {{"count", "dx", "dy"}}.
8. carpets: rug rectangles; rails: barred lines (if the catalog lists them).
Footprints must not overlap, must be on floor cells (not face rows), and every room must stay reachable from the entrance: keep each doorway and the cells right in front of it free. Tall art draws upward; keep that space free of other tall pieces.

# Output: one JSON object only, no prose
{{"map": {{"w": W, "h": H}},
 "outer_wall": {{"material": "<wall id>", "path": [[x,y], ...]}},
 "walls": [{{"id": "w_kitchen", "material": "<wall id>", "thickness": 1, "path": [[x,y],[x,y]], "purpose": "..."}}],
 "doors": [{{"wall": "w_kitchen", "x": X, "y": Y, "piece": null, "purpose": "..."}}],
 "entrance": {{"x": X, "y": H-1}},
 "rooms": [{{"id": "hall", "at": [x,y], "floor": "<floor id>", "serves": "<tag>", "purpose": "..."}}],
 "zones": [],
 "wall_items": [{{"id": "<catalog id>", "wall": "outer", "x": X, "y": Y, "purpose": "..."}}],
 "objects": [{{"id": "<catalog id>", "x": X, "y": Y, "repeat": {{"count": 2, "dx": 3, "dy": 0}}, "purpose": "..."}}],
 "carpets": [{{"id": "<rug id>", "x": X, "y": Y, "w": W, "h": H}}],
 "rails": [{{"id": "bars", "path": [[x,y],[x,y]]}}]}}
# Design principles (the validator checks these)
- One purpose, one room: every required purpose above is its own room closed by walls with a door (or a bounded zone). Partition walls must actually divide the building into those rooms — not an open hall with a wall stub.
- Size each room to its contents: a room is as big as its furniture plus 1-2 cell walkways, no bigger. Floor with nothing in it or next to it is rejected when it forms an empty area of about 5x5 cells or more, or more than a quarter of a room. When a room comes out too big, shrink it (move the wall) rather than scatter filler; when you fill, use groups that belong to the room (a table with its chairs, a hearth corner with armchairs, a bar with stools, shelves with a ladder and a reading desk).
- Floors: give each room the floor that fits its use and vary floors between rooms (the catalog lists them). Rugs are an accent: at most 1 rug per room (2 in a hall of 150+ floor cells); round rug and runner count as rugs.
- Use many different catalog pieces; repeat a piece only where repetition is real (a row of beds, chairs around a table).
- Stairs: use the exact kit footprint above; never put furniture on their 3 entry cells.
Design real architecture for this request: distinct rooms of sensible sizes joined by doors, a building outline with some shape, each room furnished for its purpose with its landmark against a wall, windows along the outer walls."""
open(f"{G}/prompt.txt", "w").write(PROMPT)
IMG = "data:image/png;base64," + base64.b64encode(open(f"{RUNS}/pieces-{task}.png", "rb").read()).decode()
msgs = [{"role": "user", "content": [{"type": "text", "text": PROMPT}, {"type": "image_url", "image_url": {"url": IMG}}]}]

def call(n):
    body = json.dumps({"model": MODEL, "messages": msgs, "reasoning_effort": "high"}).encode()
    t0 = time.time()
    for attempt in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(OCX, body, {"content-type": "application/json"}), timeout=900) as r: d = json.load(r)
            break
        except Exception as e:
            print(f"{arm}{rep}/{task} call {n} attempt {attempt}: {e}", flush=True)
            if attempt == 5: raise
            time.sleep(15 * (attempt + 1))
    secs = round(time.time() - t0, 1); u = d.get("usage") or {}
    text = d["choices"][0]["message"]["content"] or ""
    json.dump({"secs": secs, "usage": u, "model": d.get("model"), "text": text}, open(f"{G}/call-{n}.json", "w"), ensure_ascii=False, indent=1)
    return text, secs, u

def parse(text):
    m = re.search(r"\{.*\}", text, re.S)
    try: return json.loads(m.group(0)) if m else None
    except Exception: return None

def lay(n, layout, render=False):
    f = f"{G}/layout-{n}.json"; json.dump(layout, open(f, "w"), indent=1)
    out = f"{G}/lay-{n}" if not render or n != "final" else G
    p = subprocess.run(["bun", "scripts/experiments/bbox-walls-2/lay.mts", f, out, f"{RUNS}/base", "--task", task] + (["--render", "--force-render"] if render else []),
                       capture_output=True, text=True, env=dict(os.environ, OPRN_SHARED_CONTENT_SQLITE=f"{RUNS}/shared-content.sqlite"))
    try: return json.loads(p.stdout.strip().splitlines()[-1])
    except Exception: return {"ok": False, "errors": ["painter crashed: " + (p.stderr or p.stdout)[-500:]], "warnings": []}

calls, layout, chk = [], None, None
NC = 4
for n in range(NC):   # first call + at most 3 repairs
    text, secs, u = call(n); calls.append({"secs": secs, "tokens": u.get("total_tokens", 0)})
    msgs.append({"role": "assistant", "content": text})
    layout = parse(text)
    chk = lay(n, layout) if layout else {"ok": False, "errors": ["Your answer was not one parseable JSON object."], "warnings": []}
    json.dump(chk, open(f"{G}/check-{n}.json", "w"), indent=1)
    print(f"{arm}{rep}/{task} call {n}: {secs}s tok={u.get('total_tokens')} ok={chk['ok']} errors={len(chk['errors'])}", flush=True)
    if chk["ok"]: break
    if n < NC - 1:
        msgs.append({"role": "user", "content": "Rejected: the validator found these problems. Fix every one and return the full corrected layout JSON only (same format).\n- "
                     + "\n- ".join(chk["errors"][:40]) + ("\nWarnings (fix if you can):\n- " + "\n- ".join(chk["warnings"][:10]) if chk["warnings"] else "")})
res = {"task": task, "arm": arm, "rep": int(rep), "model": MODEL, "calls": calls, "repairs": len(calls) - 1, "ok": bool(chk and chk["ok"]),
       "secs": round(sum(c["secs"] for c in calls), 1), "tokens": sum(c["tokens"] for c in calls),
       "errorsPerCall": [len(json.load(open(f"{G}/check-{i}.json"))["errors"]) for i in range(len(calls))]}
if layout: json.dump(layout, open(f"{G}/layout.json", "w"), indent=1)
if res["ok"] and CRIT:   # optional self-critique: the model sees the laid map and returns a full corrected layout (kept only if it validates)
    lay("crit-base", layout, render=True); res["critique"] = []
    for k in range(CRIT):
        m = f"{G}/lay-crit-base/map.png" if k == 0 else f"{G}/lay-crit-{k - 1}/map.png"
        from PIL import Image
        im = Image.open(m); im.resize((im.width * 2, im.height * 2), Image.NEAREST).save(f"{G}/seen-{k}.png")
        cm = [{"role": "user", "content": [{"type": "text", "text": PROMPT}, {"type": "image_url", "image_url": {"url": IMG}},
              {"type": "text", "text": "Your current layout:\n" + json.dumps(layout)},
              {"type": "image_url", "image_url": {"url": "data:image/png;base64," + base64.b64encode(open(f"{G}/seen-{k}.png", "rb").read()).decode()}},
              {"type": "text", "text": "Above: the map exactly as the game draws your layout (2x). Look at it as a player walking in: empty floor, rooms that do not read as their purpose, cramped or blocked paths, odd placements. Then return the full corrected layout JSON only (same format)."}]}]
        msgs[:] = cm; ok2 = None
        for n in range(2):
            text, secs, u = call(f"crit{k}-{n}"); calls.append({"secs": secs, "tokens": u.get("total_tokens", 0)}); msgs.append({"role": "assistant", "content": text})
            L2 = parse(text); c2 = lay(f"crit{k}-{n}", L2) if L2 else {"ok": False, "errors": ["Your answer was not one parseable JSON object."], "warnings": []}
            if c2["ok"]: ok2 = L2; break
            msgs.append({"role": "user", "content": "Rejected:\n- " + "\n- ".join(c2["errors"][:40]) + "\nReturn the full corrected layout JSON only."})
        res["critique"].append({"round": k, "kept": ok2 is not None})
        if ok2: layout = ok2; json.dump(layout, open(f"{G}/layout.json", "w"), indent=1); lay(f"crit-{k}", layout, render=True)
    res["secs"] = round(sum(c["secs"] for c in calls), 1); res["tokens"] = sum(c["tokens"] for c in calls)
if layout:   # render + measure the final layout even when it failed validation (marked ok=false)
    fin = lay("final", layout, render=True); res["warnings"] = fin.get("warnings"); res["stats"] = fin.get("stats")
    res["rendered"] = os.path.exists(f"{G}/map.png")
if not res["ok"]:
    res["errors"] = chk["errors"][:20] if chk else ["no answer"]
json.dump(res, open(f"{G}/RUN.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps(res)[:300])
