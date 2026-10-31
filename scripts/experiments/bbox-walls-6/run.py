#!/usr/bin/env python3
"""bbox-walls-4 (round 4), one run: room hierarchy note, hall fill check, vertical doors drawn as openings; shell-first (one building mass = union of rectangles) then interior partitions; the model writes a walls-first layout JSON, code rasterizes/validates/lays it exactly (one shot + Rejected repairs).
New vs bbox-walls: exact multi-cell footprints/anchors/entry sides (stairs = 3x3 kit), empty-floor + rug + purpose checks, more floor types, object pool.
  python3 scripts/experiments/bbox-walls-6/run.py <inn|library|jail|manor> <sol|terra> <rep> [--critique N]   (from the worktree root)
--critique N (optional, default 0): after a valid layout, N self-critique rounds (the model sees its laid map and returns a full corrected layout).
Out: $BW_RUNS/<arm><rep>/<task>/ {prompt.txt, call-N.json, layout-N.json, check-N.json, layout.json, map.png, RUN.json}"""
import base64, json, os, re, subprocess, sys, time, urllib.error, urllib.request
task, arm, rep = sys.argv[1], sys.argv[2], sys.argv[3]
CRIT = int(sys.argv[sys.argv.index("--critique") + 1]) if "--critique" in sys.argv else 0
HOME = os.path.expanduser("~")
RUNS = os.environ.get("BW_RUNS", f"{HOME}/z-project/assistant-whole-game/suite/rooms/runs-bboxwalls6")
G = f"{RUNS}/{arm}{rep}/{task}"; os.makedirs(G, exist_ok=True)
MODEL = {"sol": "gpt-6.1-sol", "terra": "gpt-6.1-terra", "astra": "gpt-6-astra", "argon": "gemini-4-argon-high"}[arm]
OCX = "http://127.0.0.1:10200/v1/chat/completions"
REQ = {"inn": "Build the ground floor of a small village inn: a common hall where guests are greeted at the reception counter and eat at tables, a kitchen, a staircase up, and two guest rooms.",
       "library": "Build an old town library: a hall of tall book stacks and a quiet reading room, plus whatever small rooms fit (an archive, the librarian's office).",
       "jail": "Build a town jail: a guard room at the entrance, a corridor, and a row of prison cells.",
       "manor": "Build the ground floor of a noble manor: an entrance hall, a drawing room, a dining room, a kitchen, and a staircase up."}[task]
catalog = open(f"{RUNS}/catalog-{task}.txt").read()
IDEAS_MD = f"{HOME}/z-project/assistant-whole-game/suite/rooms/objpool/_structure_ideas.md"
IDEAS = open(IDEAS_MD).read().strip() if os.path.exists(IDEAS_MD) else ""
SERVES = {"inn": (["common hall", "kitchen", "guest room", "guest room"], ["corridor", "storage", "pantry", "washroom", "stair hall", "office"]),
          "library": (["book stacks", "reading room"], ["archive", "office", "corridor", "storage", "entrance hall", "stair hall"]),
          "jail": (["guard room", "corridor", "cell", "cell"], ["storage", "office", "armory", "interrogation room", "washroom"]),
          "manor": (["entrance hall", "drawing room", "dining room", "kitchen"], ["corridor", "pantry", "storage", "study", "stair hall", "washroom", "servants room"])}[task]
JAIL = ("""
- Cell fronts (jail): a prison cell is shut on the corridor side by iron bars, so the guard can see every prisoner from the corridor and the player reads "cell" at a glance; an open doorway reads as an ordinary room. Two ways that draw correctly:
  (a) a row of cells along a HORIZONTAL wall: each cell's door is in that horizontal wall with "piece": "iron gate" (the gate leaf faces south, so it fits horizontal walls only);
  (b) a bars front: one long room split into cells by partition walls, its corridor side closed by a 'bars' rail line with a 1-cell gap holding an 'iron gate' object; give each cell a zone (serves "cell") or its own room.
  Doorways in vertical walls cannot take a gate leaf, so do not put cell doors in vertical walls.""" if task == "jail" else "")
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
1. shell — design this FIRST: the building as ONE mass, a union of rectangles {{"material": wall id, "parts": [[x,y,w,h], ...]}} (each rect includes its outer wall). The parts must overlap or touch so they form one connected footprint: an L, T, U, a main block with wings, a central hall with side rooms, a tower bay... Code draws the outer wall along the rim of the union; everything outside is void. Some part must reach the bottom map row y=H-1, where the entrance is.
2. walls: interior partition walls, each a "path" of corner points (straight segments), "thickness" 1 (or 2 for a thick wall), and a "material". Partitions divide the shell into rooms: rooms share these walls (one wall between two neighbours, never two parallel walls with a gap). A partition must run from wall to wall: both ends must touch another wall (or the outer wall), so every room is fully closed. ("stub": true allows a freestanding wall piece with loose ends.)
3. doors: openings carved in a partition wall: {{"wall": id, "x", "y"}} where (x,y) is a cell of that wall.
   - In a horizontal wall: a 1-cell gap ("width" may be 2-3). It joins the room north of the wall with the room south of it.
   - In a vertical wall: a doorway is 3 cells tall: (x,y) is the walkable BOTTOM cell, and (x,y-1),(x,y-2) above it are also cut (they turn into wall face). All 3 cells must belong to that wall.
   - Optional "piece": "locked door" | "iron gate" | "iron gate open" puts a door leaf in the doorway (horizontal walls only; a leaf faces south). Doorways in vertical walls stay open.
4. entrance: one cell of the outer wall on the bottom row y=H-1, with a room cell directly above it. It is the only opening in the outer wall.
5. rooms: every space closed by walls is a room. Give each one: {{"id", "at": [x,y] any cell inside it, "floor": floor id, "serves": one purpose tag, "purpose", optional "repeat": true for genuinely repeated rooms}}. Every enclosed space needs exactly one room entry; two rooms in one connected space means a wall is not closed.
   "serves" tags required by this request (each its own room): {", ".join(SERVES[0])}. Optional extra tags: {", ".join(SERVES[1])}.
5b. zones (optional): a second purpose inside one room only when it is clearly bounded: {{"room": room id, "serves": tag, "rect": [x,y,w,h], "floor": optional floor id}}. Every open side of the rect must be lined (at least half of it) with a 'fence' rail, counters or shelves; otherwise use walls and a door.
6. wall_items: wall-mounted and against-wall pieces, each with the "wall" it belongs to ("outer" or a partition id) and its exact x,y (see the rule above).
7. objects: floor pieces (furniture, decals, sized tables), x,y = top-left cell of the footprint. Optional "repeat": {{"count", "dx", "dy"}}.
8. carpets: rug rectangles; rails: barred lines (if the catalog lists them).
9. Shaping a room beyond four walls (all built from the primitives above):
   - bay or wing: an extra shell part sticking out of the room (e.g. a 3-5 cell bay on the outer wall with windows, a projecting entrance porch);
   - alcove or niche: a short partition with "stub": true (or two of them) that pinches a recess off the room — a bed alcove, a reading nook, a niche for a statue or shrine; it stays part of the same room;
   - L-shaped room: walls that wrap a room around a smaller one (a partition path with a corner);
   - columns: 'column ...' pieces in a row or a pair framing an entrance, splitting a hall into a nave and aisles;
   - half-wall: a 'fence' or 'altar rail' rail line that divides without closing (a bar counter area, a gallery edge, a platform front);
   - raised platform: 'dais WxH wood|marble|stone' in objects — a stage for the high table, a throne, the librarian's desk, a lectern; furniture may stand on it.
Footprints must not overlap, must be on floor cells (not face rows), and every room must stay reachable from the entrance: keep each doorway and the cells right in front of it free. Tall art draws upward; keep that space free of other tall pieces.

# Output: one JSON object only, no prose
{{"map": {{"w": W, "h": H}},
 "shell": {{"material": "<wall id>", "parts": [[x,y,w,h], ...]}},
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
- One building, then rooms: real buildings are one mass with internal partitions, not separate boxes placed side by side. First shape the shell (wings, a projecting hall, a recessed entrance, a U around a court), then divide it with partition walls so neighbouring rooms share walls; a corridor between rooms is fine. Vary room sizes — a grand room (entrance hall, common hall, reading room, stacks hall) may be large if it is filled purposefully, while small service rooms stay small.
- One purpose, one room: every required purpose above is its own room closed by walls with a door (or a bounded zone). Partition walls must actually divide the building into those rooms — not an open hall with a wall stub.
- Room hierarchy: rooms differ in size by importance and use — the main hall is the largest, then the dining or drawing room, then bedrooms, and closets, pantries and storage are the smallest. A visitor reads a building through these differences; a row of identical boxes reads as a grid, not a house. Only genuinely repeated rooms (inn guest rooms, prison cells) share one size — mark each of those with "repeat": true.
- Fill big rooms with purpose: walkways up to 3 cells wide between doors may stay open, but the rest of a large room is furnished in groups that serve it (stacks: rows of shelves back to back with narrow aisles; reading room: rows of tables with chairs; hall: tables with benches, a bar, a hearth corner; entrance hall: a centrepiece with columns, benches and plants). Scattered single pieces do not count.
- Size each room to its contents: a room is as big as its furniture plus its walkways, no bigger. Walkways up to 3 cells wide between doors are not counted as empty; other floor with nothing in it or next to it is rejected when it forms an empty area of about 5x5 cells or more, or more than a quarter of a room. When a room comes out too big, shrink it (move the wall) rather than scatter filler; when you fill, use groups that belong to the room (a table with its chairs, a hearth corner with armchairs, a bar with stools, shelves with a ladder and a reading desk).
- Floors: give each room the floor that fits its use and vary floors between rooms (the catalog lists them). Rugs are an accent: at most 1 rug per room (2 in a hall of 150+ floor cells); round rug and runner count as rugs.
- Variety: real rooms collect different things over time, so a room furnished with the same object stamped again and again reads as a placeholder. Pick from the whole catalog (find_pieces(category) shows every piece of a category with its description) and give each room several distinct pieces that serve it; repeat one id only where the function really repeats (a row of chairs, cell after cell, guest bed after guest bed). The validator reports distinct pieces per room and notes a room that uses one id more than 4 times.
- Room shapes: a building where every room is a plain four-wall box reads as a spreadsheet. Give the important rooms character from their use — a bay of windows in the drawing room, a raised dais for the high table, columns in the entrance hall, a fenced bar corner, a bed alcove, an L-shaped hall wrapping the stairs. Not every room needs it; storage and cells stay simple. Choose shapes because the room's use calls for them.
- Stairs: use the exact kit footprint above; never put furniture on their 3 entry cells.{JAIL}
{("# Design vocabulary (ideas from real buildings — why they exist matters more than copying them; use one where it serves a room, not as a template)" + chr(10) + IDEAS + chr(10)) if IDEAS else ""}Design real architecture for this request: one building mass with a shaped outline, divided into distinct rooms of sensible sizes joined by doors, each room furnished for its purpose with its landmark against a wall, windows along the outer walls."""
open(f"{G}/prompt.txt", "w").write(PROMPT)
NSH = json.load(open(f"{RUNS}/pieces-{task}.n"))
IMGS = [{"type": "image_url", "image_url": {"url": "data:image/png;base64," + base64.b64encode(open(f"{RUNS}/pieces-{task}-{k + 1}.png", "rb").read()).decode()}} for k in range(NSH)]
IMG = IMGS[0]["image_url"]["url"]
msgs = [{"role": "user", "content": [{"type": "text", "text": PROMPT}] + IMGS}]
DETAIL = json.load(open(f"{RUNS}/detail-{task}.json"))
TOOLS = [{"type": "function", "function": {"name": "find_pieces", "description": "List every piece of one catalog category with its full placement rules, rise and a short description.",
          "parameters": {"type": "object", "properties": {"category": {"type": "string", "enum": list(DETAIL)}}, "required": ["category"]}}}]
toolLog = []

def call(n):
    t0 = time.time(); u = {}; text = ""
    for rnd in range(8):   # find_pieces lookups, then the answer
        d = post(n, tools=rnd < 7)
        for k, v in (d.get("usage") or {}).items():
            if isinstance(v, (int, float)): u[k] = u.get(k, 0) + v
        m = d["choices"][0]["message"]; tc = m.get("tool_calls") or []
        if not tc: text = m.get("content") or ""; break
        msgs.append({"role": "assistant", "content": m.get("content") or "", "tool_calls": tc})
        for t in tc:
            try: cat = json.loads(t["function"].get("arguments") or "{}").get("category", "")
            except Exception: cat = ""
            rows = DETAIL.get(cat); toolLog.append({"call": str(n), "category": cat})
            out = ("id | footprint | rises | placement | description\n" + "\n".join(rows)) if rows else f"Unknown category {cat!r}. Categories: {', '.join(DETAIL)}"
            msgs.append({"role": "tool", "tool_call_id": t.get("id"), "content": out})
    secs = round(time.time() - t0, 1)
    json.dump({"secs": secs, "usage": u, "model": d.get("model"), "text": text}, open(f"{G}/call-{n}.json", "w"), ensure_ascii=False, indent=1)
    return text, secs, u

QUOTA_RE = re.compile(r"\b429\b|quota|resource.?exhausted|rate.?limit|too many requests", re.I)
class Quota(Exception): pass
def _hook(t, v, tb):
    if t is Quota: open(f"{G}/QUOTA.txt", "w").write(str(v)); print(f"{arm}{rep}/{task} QUOTA: {v}", flush=True); sys.exit(2)
    sys.__excepthook__(t, v, tb)
sys.excepthook = _hook
def _route():
    if arm != "argon": return OCX, {"content-type": "application/json"}
    ep = json.load(open(os.path.expanduser("~/.oprn-suite/openai-compat-endpoints.json")))["endpoints"]["openai-compat:proxy8318"]   # key read, never written
    return ep["baseUrl"].rstrip("/") + "/chat/completions", {"Authorization": f"Bearer {ep['apiKey']}", "Content-Type": "application/json", **(ep.get("headers") or {})}
def post(n, tools=True):
    body = json.dumps({"model": MODEL, "messages": msgs, **({} if arm == "argon" else {"reasoning_effort": "high"}), **({"tools": TOOLS} if tools else {})}).encode()
    url, hdr = _route()
    for attempt in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, body, hdr), timeout=900) as r: d = json.load(r)
            break
        except urllib.error.HTTPError as e:   # quota: stop at once, no retry loop (user, 2026-10-31)
            t = e.read().decode("utf8", "replace")[:300]
            if e.code == 429 or QUOTA_RE.search(t): raise Quota(f"HTTP {e.code} {t}")
            print(f"{arm}{rep}/{task} call {n} attempt {attempt}: HTTP {e.code} {t[:120]}", flush=True)
            if attempt == 5: raise
            time.sleep(15 * (attempt + 1))
        except Exception as e:
            print(f"{arm}{rep}/{task} call {n} attempt {attempt}: {e}", flush=True)
            if attempt == 5: raise
            time.sleep(15 * (attempt + 1))
    return d

def parse(text):
    m = re.search(r"\{.*\}", text, re.S)
    try: return json.loads(m.group(0)) if m else None
    except Exception: return None

def lay(n, layout, render=False):
    f = f"{G}/layout-{n}.json"; json.dump(layout, open(f, "w"), indent=1)
    out = f"{G}/lay-{n}" if not render or n != "final" else G
    p = subprocess.run(["bun", "scripts/experiments/bbox-walls-6/lay.mts", f, out, f"{RUNS}/base", "--task", task, "--cats", f"{RUNS}/cats-{task}.json"] + (["--render", "--force-render"] if render else []),
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
if res["ok"] and chk.get("notes"):   # soft check: one chance to revise (kept only if the revision validates)
    res["notes"] = chk["notes"]
    msgs.append({"role": "user", "content": "Accepted, with notes:\n- " + "\n- ".join(chk["notes"]) + "\nReturn the full revised layout JSON only (same format). If you keep the layout as it is, return it unchanged."})
    kept = None
    for n in range(2):
        text, secs, u = call(f"note{n}"); calls.append({"secs": secs, "tokens": u.get("total_tokens", 0)}); msgs.append({"role": "assistant", "content": text})
        L2 = parse(text); c2 = lay(f"note{n}", L2) if L2 else {"ok": False, "errors": ["Your answer was not one parseable JSON object."], "warnings": []}
        if c2["ok"]: kept = L2; break
        msgs.append({"role": "user", "content": "Rejected: the validator found these problems. Fix every one and return the full corrected layout JSON only (same format).\n- " + "\n- ".join(c2["errors"][:40])})
    res["noteRevision"] = "kept" if kept else "rejected-kept-previous"
    if kept: layout = kept; json.dump(layout, open(f"{G}/layout.json", "w"), indent=1)
    res["secs"] = round(sum(c["secs"] for c in calls), 1); res["tokens"] = sum(c["tokens"] for c in calls)
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
res["lookups"] = toolLog
json.dump(res, open(f"{G}/RUN.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps(res)[:300])
