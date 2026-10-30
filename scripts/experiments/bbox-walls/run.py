#!/usr/bin/env python3
"""bbox-walls test, one run: the model writes a walls-first layout JSON, code rasterizes/validates/lays it exactly.
  python3 scripts/experiments/bbox-walls/run.py <inn|library|jail|manor> <sol|terra> <rep>   (from the worktree root)
Out: $BW_RUNS/<arm><rep>/<task>/ {prompt.txt, call-N.json, layout-N.json, check-N.json, layout.json, map.png, RUN.json}"""
import base64, json, os, re, subprocess, sys, time, urllib.request
task, arm, rep = sys.argv[1], sys.argv[2], sys.argv[3]
HOME = os.path.expanduser("~")
RUNS = os.environ.get("BW_RUNS", f"{HOME}/z-project/assistant-whole-game/suite/rooms/runs-bboxwalls")
G = f"{RUNS}/{arm}{rep}/{task}"; os.makedirs(G, exist_ok=True)
MODEL = {"sol": "gpt-6.1-sol", "terra": "gpt-6.1-terra"}[arm]
OCX = "http://127.0.0.1:10200/v1/chat/completions"
REQ = {"inn": "Build the ground floor of a small village inn: a common hall where guests are greeted at the reception counter and eat at tables, a kitchen, a staircase up, and two guest rooms.",
       "library": "Build an old town library: a hall of tall book stacks and a quiet reading room, plus whatever small rooms fit (an archive, the librarian's office).",
       "jail": "Build a town jail: a guard room at the entrance, a corridor, and a row of prison cells.",
       "manor": "Build the ground floor of a noble manor: an entrance hall, a drawing room, a dining room, a kitchen, and a staircase up."}[task]
catalog = open(f"{RUNS}/catalog-{task}.txt").read()
PROMPT = f"""You design one RPG interior map (16px cells, 3/4 top-down view) as an exact layout. Code only executes your JSON: every wall, door and piece you write appears exactly where you put it, nothing is added or moved.

User request: {REQ}

{catalog}
# How walls work in this 3/4 view (read carefully)
Coordinates: x to the right, y down, origin top-left. A wall is a line of solid cells (seen from above as a dark cap).
- A wall shows a FACE only on its SOUTH side: the 2 cells directly below any wall cell are wall face (drawn as wall, not walkable). So a room's first 2 rows under its north wall are face; its floor starts 3 rows below the wall cell.
  Example: wall cells on row y=6 -> rows 7 and 8 are face -> floor starts at row 9.
- Vertical walls and the south side of the building show only the cap (no face). Nothing can hang on them.
- WALL-MOUNTED pieces (windows, shelves, signs, banners, pictures) hang on the UPPER face row: y = (wall row)+1, directly under a wall cell of the named wall.
- AGAINST-WALL pieces (fireplace, bookshelves, beds, cupboards, stairs up, kitchen range) stand on the first floor row: y = (wall row)+3, directly under the 2-row face of the named wall.
- Windows go on the outer wall only.

# Layout primitives
1. outer_wall: a closed ring of wall cells around the whole building: "path" = corner points [x,y], each segment horizontal or vertical, returning to the first point. Everything outside the ring is void. Its south side must run along the bottom map row y=H-1 where the entrance is. The ring may have notches (L, T, U shapes), not only a rectangle.
2. walls: interior partition walls, each a "path" of corner points (straight segments), "thickness" 1 (or 2 for a thick wall), and a "material". A partition must run from wall to wall: both ends must touch another wall (or the outer ring), so every room is fully closed. ("stub": true allows a freestanding wall piece with loose ends.)
3. doors: openings carved in a partition wall: {{"wall": id, "x", "y"}} where (x,y) is a cell of that wall.
   - In a horizontal wall: a 1-cell gap ("width" may be 2-3). It joins the room north of the wall with the room south of it.
   - In a vertical wall: a doorway is 3 cells tall: (x,y) is the walkable BOTTOM cell, and (x,y-1),(x,y-2) above it are also cut (they turn into wall face). All 3 cells must belong to that wall.
   - Optional "piece": "locked door" | "iron gate" | "iron gate open" puts a door leaf in the doorway.
4. entrance: one cell of the outer wall on the bottom row y=H-1, with a room cell directly above it. It is the only opening in the outer wall.
5. rooms: every space closed by walls is a room. Give each one: {{"id", "at": [x,y] any cell inside it, "floor": floor id, "purpose"}}. Every enclosed space needs exactly one room entry; two rooms in one connected space means a wall is not closed.
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
 "rooms": [{{"id": "hall", "at": [x,y], "floor": "<floor id>", "purpose": "..."}}],
 "wall_items": [{{"id": "<catalog id>", "wall": "outer", "x": X, "y": Y, "purpose": "..."}}],
 "objects": [{{"id": "<catalog id>", "x": X, "y": Y, "repeat": {{"count": 2, "dx": 3, "dy": 0}}, "purpose": "..."}}],
 "carpets": [{{"id": "<rug id>", "x": X, "y": Y, "w": W, "h": H}}],
 "rails": [{{"id": "bars", "path": [[x,y],[x,y]]}}]}}
Design real architecture for this request: distinct rooms of sensible sizes joined by doors (not boxes side by side), a building outline with some shape, each room furnished for its purpose with its landmark against a wall, windows along the outer walls, no large empty floor."""
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
    out = f"{G}/lay-{n}" if not render else G
    p = subprocess.run(["bun", "scripts/experiments/bbox-walls/lay.mts", f, out, f"{RUNS}/base"] + (["--render"] if render else []),
                       capture_output=True, text=True, env=dict(os.environ, OPRN_SHARED_CONTENT_SQLITE=f"{RUNS}/shared-content.sqlite"))
    try: return json.loads(p.stdout.strip().splitlines()[-1])
    except Exception: return {"ok": False, "errors": ["painter crashed: " + (p.stderr or p.stdout)[-500:]], "warnings": []}

calls, layout, chk = [], None, None
for n in range(3):   # first call + at most 2 repairs
    text, secs, u = call(n); calls.append({"secs": secs, "tokens": u.get("total_tokens", 0)})
    msgs.append({"role": "assistant", "content": text})
    layout = parse(text)
    chk = lay(n, layout) if layout else {"ok": False, "errors": ["Your answer was not one parseable JSON object."], "warnings": []}
    json.dump(chk, open(f"{G}/check-{n}.json", "w"), indent=1)
    print(f"{arm}{rep}/{task} call {n}: {secs}s tok={u.get('total_tokens')} ok={chk['ok']} errors={len(chk['errors'])}", flush=True)
    if chk["ok"]: break
    if n < 2:
        msgs.append({"role": "user", "content": "Rejected: the validator found these problems. Fix every one and return the full corrected layout JSON only (same format).\n- "
                     + "\n- ".join(chk["errors"][:40]) + ("\nWarnings (fix if you can):\n- " + "\n- ".join(chk["warnings"][:10]) if chk["warnings"] else "")})
res = {"task": task, "arm": arm, "rep": int(rep), "model": MODEL, "calls": calls, "repairs": len(calls) - 1, "ok": bool(chk and chk["ok"]),
       "secs": round(sum(c["secs"] for c in calls), 1), "tokens": sum(c["tokens"] for c in calls),
       "errorsPerCall": [len(json.load(open(f"{G}/check-{i}.json"))["errors"]) for i in range(len(calls))]}
if layout: json.dump(layout, open(f"{G}/layout.json", "w"), indent=1)
if res["ok"]:
    fin = lay("final", layout, render=True); res["warnings"] = fin.get("warnings"); res["stats"] = fin.get("stats")
    res["rendered"] = os.path.exists(f"{G}/map.png")
else:
    res["errors"] = chk["errors"][:20] if chk else ["no answer"]
json.dump(res, open(f"{G}/RUN.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps(res)[:300])
