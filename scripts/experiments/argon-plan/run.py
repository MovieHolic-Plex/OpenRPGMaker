#!/usr/bin/env python3
"""bbox-walls-4 (round 4), one run: room hierarchy note, hall fill check, vertical doors drawn as openings; shell-first (one building mass = union of rectangles) then interior partitions; the model writes a walls-first layout JSON, code rasterizes/validates/lays it exactly (one shot + Rejected repairs).
New vs bbox-walls: exact multi-cell footprints/anchors/entry sides (stairs = 3x3 kit), empty-floor + rug + purpose checks, more floor types, object pool.
  python3 scripts/experiments/bbox-walls-8/run.py <inn|library|jail|manor> <sol|terra> <rep> [--critique N]   (from the worktree root)
--critique N (optional, default 0): after a valid layout, N self-critique rounds (the model sees its laid map and returns a full corrected layout).
Out: $BW_RUNS/<arm><rep>/<task>/ {prompt.txt, call-N.json, layout-N.json, check-N.json, layout.json, map.png, RUN.json}"""
import base64, json, os, re, subprocess, sys, time, urllib.error, urllib.request
task, arm, rep = sys.argv[1], sys.argv[2], sys.argv[3]
CRIT = int(sys.argv[sys.argv.index("--critique") + 1]) if "--critique" in sys.argv else 0
HOME = os.path.expanduser("~")
RUNS = os.environ.get("BW_RUNS", f"{HOME}/z-project/assistant-whole-game/suite/rooms/runs-argonplan")
G = f"{RUNS}/{arm}{rep}/{task}"; os.makedirs(G, exist_ok=True)
MODEL = {"sol": "gpt-6.1-sol", "terra": "gpt-6.1-terra", "astra": "gpt-6-astra", "argon": "gemini-4-argon-high", "argonA": "gemini-4-argon-high", "argonB": "gemini-4-argon-high", "argonG": "gemini-4-argon-high", "argonJ": "gemini-4-argon-high"}[arm]
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
  Doorways in vertical walls cannot take a gate leaf, so do not put cell doors in vertical walls.
- Cells need not be identical: a real jail grew over the years and holds different prisoners, so its cells differ — a corner cell bent by the outline, a larger shared cell, a narrow solitary cell, a guard post or a niche between two cells, a cell with a bench instead of a cot. Cells that differ let the player tell them apart and give each one a story; a row of identical boxes reads as a spreadsheet. Keep the bars and gates on every cell; vary size, shape and contents.""" if task == "jail" else "")
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
5. rooms: every space closed by walls is a room. Give each one: {{"id", "at": [x,y] any cell inside it, "floor": floor id, "serves": one purpose tag, "purpose", optional "repeat": true for genuinely repeated rooms}}. Every enclosed space needs exactly one room entry; two rooms in one connected space means a wall is not closed. Rooms are entered through doors of 1-2 cells; add "openPlan": true to a room only when a wider opening into it is a deliberate open plan.
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
- Room hierarchy: rooms differ in size by importance and use — the main hall is the largest, then the dining or drawing room, then bedrooms, and closets, pantries and storage are the smallest. A visitor reads a building through these differences; a row of identical boxes reads as a grid, not a house. Only genuinely repeated rooms (inn guest rooms, prison cells) may share one size — mark each of those with "repeat": true (they may still differ a little).
- Fill big rooms with purpose: walkways up to 3 cells wide between doors may stay open, but the rest of a large room is furnished in groups that serve it (stacks: rows of shelves back to back with narrow aisles; reading room: rows of tables with chairs; hall: tables with benches, a bar, a hearth corner; entrance hall: a centrepiece with columns, benches and plants). Scattered single pieces do not count.
- Size each room to its contents: a room is as big as its furniture plus its walkways, no bigger. Walkways up to 3 cells wide between doors are not counted as empty; other floor with nothing in it or next to it is rejected when it forms an empty area of about 5x5 cells or more, or more than a quarter of a room. When a room comes out too big, shrink it (move the wall) rather than scatter filler; when you fill, use groups that belong to the room (a table with its chairs, a hearth corner with armchairs, a bar with stools, shelves with a ladder and a reading desk).
- Floors: give each room the floor that fits its use and vary floors between rooms (the catalog lists them). Rugs are an accent: at most 1 rug per room (2 in a hall of 150+ floor cells); round rug and runner count as rugs.
- Variety: real rooms collect different things over time, so a room furnished with the same object stamped again and again reads as a placeholder. Pick from the whole catalog (find_pieces(category) shows every piece of a category with its description) and give each room several distinct pieces that serve it; repeat one id only where the function really repeats (a row of chairs, cell after cell, guest bed after guest bed). The validator reports distinct pieces per room and notes a room that uses one id more than 4 times.
- Room shapes: a building where every room is a plain four-wall box reads as a spreadsheet. Give the important rooms character from their use — a bay of windows in the drawing room, a raised dais for the high table, columns in the entrance hall, a fenced bar corner, a bed alcove, an L-shaped hall wrapping the stairs. Not every room needs it; storage and cells stay simple. Choose shapes because the room's use calls for them.
- Stairs: use the exact kit footprint above; never put furniture on their 3 entry cells.{JAIL}
{("# Design vocabulary (ideas from real buildings — why they exist matters more than copying them; use one where it serves a room, not as a template)" + chr(10) + IDEAS + chr(10)) if IDEAS else ""}Design real architecture for this request: one building mass with a shaped outline, divided into distinct rooms of sensible sizes joined by doors, each room furnished for its purpose with its landmark against a wall, windows along the outer walls."""
if arm.startswith("argon"): PROMPT = f"(run {arm}{rep} / {sys.argv[0].split('/')[-2]})\n" + PROMPT   # the 8318 route returns identical answers to identical prompts; a run id makes reps independent
open(f"{G}/prompt.txt", "w").write(PROMPT)
NSH = json.load(open(f"{RUNS}/pieces-{task}.n"))
IMGS = [{"type": "image_url", "image_url": {"url": "data:image/png;base64," + base64.b64encode(open(f"{RUNS}/pieces-{task}-{k + 1}.png", "rb").read()).decode()}} for k in range(NSH)]
IMG = IMGS[0]["image_url"]["url"]
# ---- round 7: two steps. Step 1 = plan the building and declare room purposes (structure pieces only);
# step 2 = code sends the catalog expanded for those purposes (all variants, descriptions, a palette of just those categories), the model furnishes. ----
from PIL import Image as _I
NEEDS = [(r"guest room|bedroom|servants", ["bed", "cabinet & storage", "light & fire", "bath & wash", "rug & decal", "plant & vase", "wall decor & window"]),
         (r"kitchen|pantry", ["kitchen", "cabinet & storage", "table & desk", "shelf & bookcase", "light & fire"]),
         (r"common hall|dining", ["table & desk", "chair & bench", "sofa & armchair", "light & fire", "cabinet & storage", "shelf & bookcase", "wall decor & window", "plant & vase"]),
         (r"book stacks|archive", ["shelf & bookcase", "table & desk", "cabinet & storage", "light & fire", "chair & bench"]),
         (r"reading|study|office", ["table & desk", "chair & bench", "sofa & armchair", "shelf & bookcase", "light & fire", "plant & vase", "wall decor & window"]),
         (r"drawing", ["sofa & armchair", "table & desk", "plant & vase", "wall decor & window", "light & fire", "shelf & bookcase", "cabinet & storage"]),
         (r"entrance|stair hall|corridor", ["column, screen & platform", "plant & vase", "chair & bench", "wall decor & window", "light & fire", "cabinet & storage"]),
         (r"cell", ["bed", "cabinet & storage", "light & fire", "chair & bench"]),
         (r"guard|armory|interrogation", ["table & desk", "chair & bench", "cabinet & storage", "light & fire", "wall decor & window", "shelf & bookcase"]),
         (r"storage|washroom", ["cabinet & storage", "bath & wash", "shelf & bookcase", "light & fire"])]
def cats_for(sv):
    for rx, cs in NEEDS:
        if re.search(rx, sv): return cs
    return ["table & desk", "cabinet & storage", "light & fire"]
slug = lambda c: re.sub(r"[^a-z]+", "-", c)
STRUCT = ["stairs & doors", "column, screen & platform"]
head, *groups = catalog.split("\n### "); tail = ""
if "\n## Sized pieces" in groups[-1]: groups[-1], tail = groups[-1].split("\n## Sized pieces", 1); tail = "\n## Sized pieces" + tail
G2 = {g.split("\n", 1)[0].strip(): g for g in groups}
plan_cat = head + "".join("\n### " + G2[c] for c in STRUCT if c in G2) + "".join(f"\n### {c}: {len(G2[c].strip().splitlines()) - 1} pieces — sent with your plan in the next turn\n" for c in G2 if c not in STRUCT) + tail
PROMPT_PLAN = PROMPT.replace(catalog, plan_cat) + """

# This turn: STEP 1 of 2 — plan the building
Return the layout JSON with the building only: map, shell, walls, doors, entrance, rooms (each with its "serves" tag), zones if any, and the structural pieces you already know you need (stairs up in wall_items, columns, daises, rails). Leave objects and the other wall_items empty for now.
Next turn I send, for every purpose you declared, the full set of pieces that serve it (every variant, with descriptions and a palette); then you furnish the rooms and return the full layout."""
def strip_imgs(cats):
    ims = [_I.open(f"{RUNS}/cat-{task}/{slug(c)}.png") for c in cats if os.path.exists(f"{RUNS}/cat-{task}/{slug(c)}.png")]
    out, cur, h = [], [], 0
    for im in ims:
        if cur and h + im.height > 2400: out.append(cur); cur, h = [], 0
        cur.append(im); h += im.height
    if cur: out.append(cur)
    res = []
    for k, grp in enumerate(out):
        sh = _I.new("RGB", (max(i.width for i in grp), sum(i.height for i in grp)), (24, 24, 30)); y = 0
        for i in grp: sh.paste(i, (0, y)); y += i.height
        p = f"{G}/palette-{k + 1}.png"; sh.save(p)
        res.append({"type": "image_url", "image_url": {"url": "data:image/png;base64," + base64.b64encode(open(p, "rb").read()).decode()}})
    return res
def tailored(plan):
    rooms = [r for r in (plan.get("rooms") or []) if isinstance(r, dict)]
    by = {}
    for r in rooms: by.setdefault(str(r.get("serves", "")).lower(), []).append(str(r.get("id")))
    for z in (plan.get("zones") or []):
        if isinstance(z, dict): by.setdefault(str(z.get("serves", "")).lower(), []).append(f"zone in {z.get('room')}")
    need, lines = [], ["# STEP 2 of 2 — furnish. Pieces for the purposes you declared (every variant; id | footprint | rises | placement | description):"]
    for sv, ids in by.items():
        cs = cats_for(sv); need += [c for c in cs if c not in need]
        lines.append(f"- {sv or '?'} ({', '.join(ids)}): {', '.join(cs)}")
    for c in need:
        if c in DETAIL: lines += ["", f"## {c} ({len(DETAIL[c])} variants)"] + DETAIL[c]
    lines += ["", "Furnish every room from its categories above (any other catalog piece is allowed too). Give each room several distinct pieces that serve it, and when several rooms share a purpose (guest rooms, cells, studies), furnish them differently — a different bed, wardrobe, lamp or chest in each — so each reads as its own room. The attached palette shows exactly these categories.",
              "Return the full layout JSON only (same format): your plan (adjust it if furnishing needs it) plus objects, wall_items, carpets, rails and zones."]
    return "\n".join(lines), strip_imgs(STRUCT + need)
msgs = []
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
    if not arm.startswith("argon"): return OCX, {"content-type": "application/json"}
    ep = json.load(open(os.path.expanduser("~/.oprn-suite/openai-compat-endpoints.json")))["endpoints"]["openai-compat:proxy8318"]   # key read, never written
    return ep["baseUrl"].rstrip("/") + "/chat/completions", {"Authorization": f"Bearer {ep['apiKey']}", "Content-Type": "application/json", **(ep.get("headers") or {})}
def post(n, tools=True):
    body = json.dumps({"model": MODEL, "messages": msgs, **({} if arm.startswith("argon") else {"reasoning_effort": "high"}), **({"tools": TOOLS} if tools else {})}).encode()
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
    p = subprocess.run(["bun", "scripts/experiments/argon-plan/lay.mts", f, out, f"{RUNS}/base", "--task", task, "--cats", f"{RUNS}/cats-{task}.json"] + (["--render", "--force-render"] if render else []),
                       capture_output=True, text=True, env=dict(os.environ, OPRN_SHARED_CONTENT_SQLITE=f"{RUNS}/shared-content.sqlite"))
    try: return json.loads(p.stdout.strip().splitlines()[-1])
    except Exception: return {"ok": False, "errors": ["painter crashed: " + (p.stderr or p.stdout)[-500:]], "warnings": []}

# ---- arm B: step 1 = Argon draws a floor-plan PICTURE (SVG it writes itself; code only rasterises it), step 2 = the same flow as arm A with that picture attached ----
PIC = None
SVG_RULES = """

# This turn: draw the floor plan as a PICTURE (not JSON)
Before writing any layout, draw your floor plan as one SVG image in the style of a layout diagram:
- Canvas: 32 px per map cell. viewBox="0 0 {W*32} {H*32}" for your chosen map size W x H (cells). Dark background (#121216) with faint grid lines every 32 px.
- Walls (the shell rim and every partition): filled dark grey cells (#46464f), one 32x32 square per wall cell, exactly on the grid. Face rows (the 2 cells under a north wall) darker (#1c1c22).
- Rooms: a translucent coloured rectangle per room (each room its own colour, opacity about 0.35) with a solid outline in that colour, and a label at its bottom-left: "room name: floor id".
- Doors: green cells (#5ae66e) where a wall is opened. The entrance: a bright green cell on the bottom row with the text "IN".
- Furniture and floor pieces: a translucent blue box (#5aaaff, opacity 0.35, light blue outline) covering the piece's exact footprint in cells, with its catalog id written inside (top-left, 10 px font). Wall-mounted and against-wall pieces: the same but amber (#ffbe3c).
- Rugs: a red outline rectangle. Stairs up: a box labelled "stairs up".
Every box sits exactly on cell boundaries (x, y, width, height multiples of 32) and uses catalog ids, so the picture can be read back cell by cell. Plan the whole building in this picture: its shaped outline, rooms, doors, and furnishing for every room.
Return only the SVG (<svg ...>...</svg>), no prose and no JSON."""
if arm == "argonB":
    pic_prompt = PROMPT.split("# Output: one JSON object only")[0] + PROMPT[PROMPT.index("# Design principles"):] + SVG_RULES
    open(f"{G}/prompt-picture.txt", "w").write(pic_prompt)
    msgs = [{"role": "user", "content": [{"type": "text", "text": pic_prompt}] + IMGS}]
    svg = None
    for n in range(2):
        text, secs, u = call(f"pic{n}")
        m = re.search(r"<svg\b.*?</svg>", text or "", re.S)
        if m:
            svg = m.group(0)
            try:
                import cairosvg
                open(f"{G}/plan.svg", "w").write(svg)
                cairosvg.svg2png(bytestring=svg.encode(), write_to=f"{G}/plan-picture.png", background_color="#121216")
                PIC = f"{G}/plan-picture.png"; break
            except Exception as e:
                open(f"{G}/plan-svg-error.txt", "w").write(str(e)); msgs.append({"role": "assistant", "content": text}); msgs.append({"role": "user", "content": f"That SVG did not render ({str(e)[:200]}). Return one valid SVG only."})
        else:
            msgs.append({"role": "assistant", "content": text or ""}); msgs.append({"role": "user", "content": "Return the floor plan as one SVG only (<svg ...>...</svg>)."})
    print(f"{arm}{rep}/{task} picture: {'ok' if PIC else 'FAILED'}", flush=True)
# ---- round 2 (arms G and J): a cell-grid plan with a fixed legend, checked by code (<= 3 repairs) before step 2 ----
GRID_TXT = None
if arm in ("argonG", "argonJ"):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import gridplan
    GW, GH = {"inn": (22, 20), "library": (24, 22), "jail": (20, 18), "manor": (28, 24)}[task]
    FLOORS = re.findall(r"^floor:(\w+) \|", catalog, re.M)
    TEACH = f"""You design one RPG interior map (16px cells, 3/4 top-down view). This turn you only draw its FLOOR PLAN on a cell grid; next turn you turn the plan into the exact layout.

User request: {REQ}
Map size: exactly {GW} x {GH} cells. x = 0..{GW - 1} to the right, y = 0..{GH - 1} down, origin top-left.

{catalog}
# The 3/4 wall model (read carefully: the plan must draw walls the way the game draws them)
The camera looks down at the building from the south at an angle, so a wall shows its top and, on one side only, its front:
- Every wall, outer or inner, is a line exactly 1 cell thick of CEILING: the dark top of the wall seen from above. Ceiling lines are your walls; they must close every room and run unbroken around the whole building.
- A wall's front faces the viewer only on its south side. Under every ceiling cell that has room below it, the wall FACE is visible: exactly 2 rows of WALLFACE directly below the ceiling. Wallface is not walkable; windows, shelves, pictures and signs hang on it, and against-wall furniture (beds, cupboards, the kitchen range, the fireplace, stairs up) stands on the first floor row right below it.
- A vertical (north-south) wall shows only its ceiling line: its sides face east and west, away from the camera. The south outer wall shows no face either (its face points out of the map).
- Doors cut through the wall. In a horizontal wall a door replaces the ceiling cell and the 2 face cells below it (a 1-wide, 3-tall opening; 2 wide is fine). In a vertical wall a door is 3 cells of the ceiling line: the top 2 show the face of the wall above it (draw them as wallface), the bottom one is the walkable door.
- The entrance is a door in the outer ceiling line on the bottom row y={GH - 1}.
Why: the game draws exactly these cells. A face drawn without a ceiling above floats; a ceiling with floor right below it would show a face you did not plan; a gap in a ceiling line is a hole in the wall.

Tiny example ('#' ceiling, '=' wallface, 'W' window on the face, '.' floor, 'D' door). Left: a horizontal inner wall with a door. Right: a vertical inner wall with a door.
    #######        #########
    #=W===#        #===#===#
    #=====#        #===#===#
    #.....#        #...#...#
    ###D###        #...=...#
    #==D==#        #...=...#
    #==D==#        #...D...#
    #.....#        #...#...#
    ###D###        ####D####
(The vertical wall in the right example runs as ceiling through the north wall's face rows, so each room has its own face; the bottom row door is the entrance.)

# Legend (the only classes allowed)
- ceiling: wall top, 1 cell thick lines
- wallface: the 2 rows directly below a ceiling run that has room below it
- floor-<material>: the room floor, one of: {", ".join("floor-" + f for f in FLOORS)}
- door: a cut through a wall (see above)
- window: on a wallface cell of the outer wall
- object:<catalog id>: a piece, covering exactly its catalog footprint (e.g. object:armchair 1x1, object:dining 3x2 3x2 cells, object:stairs up wood 3x3 over the 2 face rows + the first floor row of a north wall). Wall-mounted pieces sit on wallface rows.
- label: room names
Later shapes paint over earlier ones: draw floors first, then ceiling lines, wallface, doors, windows, then objects.

Plan the whole building in this one plan: its shaped outline, every room the request needs with its floor, the doors, windows on the outer walls, and the furniture of every room (several distinct pieces per room, from the catalog).{JAIL}
"""
    if arm == "argonG":
        OUT = f"""
# Output
Below is the SVG skeleton: {GW}x{GH} cells, 16 px per cell, grid drawn, coordinates on the edges. Return it with your shapes added inside <g id="plan"> — only
  <rect class="..." x="16*i" y="16*j" width="16*k" height="16*m"/>   (x, y, width, height are whole multiples of 16)
  <text class="label" x="..." y="...">room name</text>
No other attributes or elements are needed (colours come from the class). Return only the SVG.

{gridplan.skeleton(GW, GH)}"""
    else:
        OUT = f"""
# Output
Return one JSON object only, in cells (not pixels):
{{"map": {{"w": {GW}, "h": {GH}}}, "cells": [{{"class": "floor-plank", "x": 1, "y": 3, "w": 6, "h": 5}}, {{"class": "ceiling", "x": 0, "y": 0, "w": {GW}, "h": 1}}, {{"class": "object:armchair", "x": 2, "y": 4, "w": 1, "h": 1}}, ...],
 "labels": [{{"x": 2, "y": 5, "text": "common hall"}}]}}
Each entry paints the rectangle x..x+w-1, y..y+h-1 with its class; later entries paint over earlier ones."""
    gp = TEACH + OUT; open(f"{G}/prompt-grid.txt", "w").write(gp)
    msgs = [{"role": "user", "content": [{"type": "text", "text": gp}] + IMGS}]
    grid_hist = []; plan_g = None
    for n in range(4):   # first plan + at most 3 repairs
        text, secs, u = call(f"grid{n}"); msgs.append({"role": "assistant", "content": text or ""})
        if arm == "argonG":
            m = re.search(r"<svg\b.*?</svg>", text or "", re.S)
            rects, labels = gridplan.parse_svg(m.group(0)) if m else ([], [])
            if m: open(f"{G}/grid-{n}.svg", "w").write(m.group(0))
            ok_parse = bool(m)
        else:
            dj = parse(text or ""); rects, labels = gridplan.parse_json(dj) if dj else ([], [])
            if dj: json.dump(dj, open(f"{G}/grid-{n}.json", "w"), indent=1)
            ok_parse = bool(dj)
        if not ok_parse:
            grid_hist.append({"call": n, "errors": ["unparseable"]})
            msgs.append({"role": "user", "content": "That was not one " + ("SVG (<svg ...>...</svg>)" if arm == "argonG" else "JSON object") + ". Return the plan only."}); continue
        plan_g, gerr = gridplan.validate(rects, GW, GH, catalog, FLOORS, as_json=(arm == "argonJ"), labels=labels)
        gridplan.render(plan_g, labels, GW, GH, f"{G}/grid-{n}.png")
        grid_hist.append({"call": n, "errors": gerr}); last_labels = labels; last_rects = rects
        print(f"{arm}{rep}/{task} grid {n}: {len(rects)} shapes, {len(gerr)} errors", flush=True)
        if not gerr: break
        if n < 3: msgs.append({"role": "user", "content": "Rejected: the plan checker found these problems. Apply every Fixed call (exact cells) and fix the rest, then return the full corrected plan only (same format).\n- " + "\n- ".join(gerr)})
    json.dump(grid_hist, open(f"{G}/grid-check.json", "w"), indent=1)
    if plan_g:
        gridplan.render(plan_g, last_labels, GW, GH, f"{G}/plan-picture.png")
        if arm == "argonG": PIC = f"{G}/plan-picture.png"
        else: GRID_TXT = json.dumps({"map": {"w": GW, "h": GH}, "cells": [dict(cls=r["cls"], x=int(r["x"] // 16), y=int(r["y"] // 16), w=int(r["w"] // 16), h=int(r["h"] // 16)) for r in last_rects], "labels": [{"x": a, "y": b, "text": t} for a, b, t in last_labels]}).replace('"cls"', '"class"')
    GRID_OK = bool(grid_hist and not grid_hist[-1]["errors"])
    REALISE = f" The map is {GW} x {GH} cells. Realise the plan: its ceiling lines are your walls (outer rim = shell, inner lines = partitions), its door cells are your doors and entrance, its floor classes are your room floors, its objects are your objects at the same x,y (wall-mounted and against-wall ones go in wall_items). Keep its design; change it only where the layout rules above require."
    PIC_NOTE_G = ("\n\n# Your floor plan\nThe attached picture (first image) is the floor plan you drew and the checker accepted" + ("" if GRID_OK else " (it still had problems)") + ": 32 px per cell, coordinates on the edges; dark = ceiling, brown = wallface, green = door, light blue bars = windows, boxes = objects with their ids." + REALISE) if PIC else ""
    PIC_NOTE_J = ("\n\n# Your floor plan (cells)\nThis is the grid plan you wrote" + ("" if GRID_OK else " (it still had problems)") + ":\n" + GRID_TXT + "\n" + REALISE) if GRID_TXT else ""
PIC_NOTE = PIC_NOTE_G if arm == "argonG" else PIC_NOTE_J if arm == "argonJ" else ("\n\n# Your floor-plan picture\nThe attached picture (first image) is the floor plan you drew for this building, 32 px per cell with a grid. Realise it: read your shell, walls, doors, rooms and pieces off the picture cell by cell and write them as the layout JSON. Keep its design; change it only where the rules above require.") if PIC else ""
PIC_IMG = [] if arm == "argonJ" else [{"type": "image_url", "image_url": {"url": "data:image/png;base64," + base64.b64encode(open(PIC, "rb").read()).decode()}}] if PIC else []
msgs = [{"role": "user", "content": [{"type": "text", "text": PROMPT_PLAN + PIC_NOTE}] + PIC_IMG + strip_imgs(["floors", "walls"] + STRUCT)}]
calls, layout, chk = [], None, None
plan, pinfo = None, {"secs": 0, "tokens": 0}
for n in range(2):
    text, secs, u = call(f"plan{n}"); pinfo["secs"] += secs; pinfo["tokens"] += u.get("total_tokens", 0)
    msgs.append({"role": "assistant", "content": text}); plan = parse(text)
    if plan and plan.get("rooms"): break
    msgs.append({"role": "user", "content": "That was not one parseable JSON object with rooms. Return the plan JSON only."})
json.dump(plan, open(f"{G}/plan.json", "w"), indent=1)
ttext, timgs = tailored(plan or {})
open(f"{G}/tailored.txt", "w").write(ttext)
msgs.append({"role": "user", "content": [{"type": "text", "text": ttext}] + timgs})
print(f"{arm}{rep}/{task} plan: {pinfo['secs']}s rooms={len((plan or {}).get('rooms') or [])} tailored={len(ttext)} chars, {len(timgs)} palette sheet(s)", flush=True)
NC, harmonised = 6, []   # round 8: up to 6 calls while wall structure is still wrong (4 otherwise)
STRUCT_RX = re.compile(r"^(wall |shell|outer|entrance|door |map\.|rooms? \"[^\"]*\" (and|are one)|the opening)")
for n in range(NC):   # first call + repairs
    text, secs, u = call(n); calls.append({"secs": secs, "tokens": u.get("total_tokens", 0)})
    msgs.append({"role": "assistant", "content": text})
    layout = parse(text)
    chk = lay(n, layout) if layout else {"ok": False, "errors": ["Your answer was not one parseable JSON object."], "warnings": []}
    if chk.get("repairs"): layout = chk["repaired"]; harmonised.append({"call": n, "repairs": chk["repairs"]}); json.dump(layout, open(f"{G}/layout-{n}-harmonised.json", "w"), indent=1)
    json.dump(chk, open(f"{G}/check-{n}.json", "w"), indent=1)
    print(f"{arm}{rep}/{task} call {n}: {secs}s tok={u.get('total_tokens')} ok={chk['ok']} errors={len(chk['errors'])}", flush=True)
    if chk["ok"]: break
    structural = any(STRUCT_RX.search(e) for e in chk["errors"])
    if n >= 3 and not structural: break
    if n < NC - 1:
        rp = ("Code applied these mechanical repairs to your layout (your design is otherwise unchanged; continue from the repaired layout below):\n- " + "\n- ".join(chk["repairs"]) + "\nRepaired layout:\n" + json.dumps(layout) + "\n\n") if chk.get("repairs") else ""
        msgs.append({"role": "user", "content": rp + "Rejected: the validator found these problems. Fix every one and return the full corrected layout JSON only (same format).\n- "
                     + "\n- ".join(chk["errors"][:40]) + ("\nWarnings (fix if you can):\n- " + "\n- ".join(chk["warnings"][:10]) if chk["warnings"] else "")})
res = {"harmonised": harmonised, "task": task, "arm": arm, "rep": int(rep), "model": MODEL, "plan": pinfo, "calls": calls, "repairs": len(calls) - 1, "ok": bool(chk and chk["ok"]),
       "secs": round(pinfo["secs"] + sum(c["secs"] for c in calls), 1), "tokens": pinfo["tokens"] + sum(c["tokens"] for c in calls),
       "errorsPerCall": [len(json.load(open(f"{G}/check-{i}.json"))["errors"]) for i in range(len(calls))]}
if layout: json.dump(layout, open(f"{G}/layout.json", "w"), indent=1)
if res["ok"] and chk.get("notes"):   # soft check: one chance to revise (kept only if the revision validates)
    res["notes"] = chk["notes"]
    msgs.append({"role": "user", "content": "Accepted, with notes:\n- " + "\n- ".join(chk["notes"]) + "\nReturn the full revised layout JSON only (same format). If you keep the layout as it is, return it unchanged."})
    kept = None
    for n in range(2):
        text, secs, u = call(f"note{n}"); calls.append({"secs": secs, "tokens": u.get("total_tokens", 0)}); msgs.append({"role": "assistant", "content": text})
        L2 = parse(text); c2 = lay(f"note{n}", L2) if L2 else {"ok": False, "errors": ["Your answer was not one parseable JSON object."], "warnings": []}
        if c2.get("repairs"): L2 = c2["repaired"]; harmonised.append({"call": f"note{n}", "repairs": c2["repairs"]})
        if c2["ok"]: kept = L2; break
        msgs.append({"role": "user", "content": "Rejected: the validator found these problems. Fix every one and return the full corrected layout JSON only (same format).\n- " + "\n- ".join(c2["errors"][:40])})
    res["noteRevision"] = "kept" if kept else "rejected-kept-previous"
    if kept: layout = kept; json.dump(layout, open(f"{G}/layout.json", "w"), indent=1)
    res["secs"] = round(pinfo["secs"] + sum(c["secs"] for c in calls), 1); res["tokens"] = pinfo["tokens"] + sum(c["tokens"] for c in calls)
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
    res["secs"] = round(pinfo["secs"] + sum(c["secs"] for c in calls), 1); res["tokens"] = pinfo["tokens"] + sum(c["tokens"] for c in calls)
if layout:   # render + measure the final layout even when it failed validation (marked ok=false)
    fin = lay("final", layout, render=True); res["warnings"] = fin.get("warnings"); res["stats"] = fin.get("stats")
    res["rendered"] = os.path.exists(f"{G}/map.png")
if not res["ok"]:
    res["errors"] = chk["errors"][:20] if chk else ["no answer"]
res["lookups"] = toolLog
json.dump(res, open(f"{G}/RUN.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps(res)[:300])
