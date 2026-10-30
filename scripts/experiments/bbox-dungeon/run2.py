#!/usr/bin/env python3
"""bbox-dungeon round 2, one run (from the worktree root):
  python3 scripts/experiments/bbox-dungeon/run2.py <crypt|flooded|demon|cave> <sol|terra> <rep>     shape vocabulary: model writes the floor, code rasterises (lay2.mts)
  python3 scripts/experiments/bbox-dungeon/run2.py cave <sol|terra> v2                              baseline for the new cave brief (v2 builder)
Out: $BBOX_RUNS2/<arm><rep>/<brief>/ {prompt.txt, call-N.json, layout-N.json, check-N.json, layout.json, map.png, RUN.json}
Model: gpt-6.1-sol / gpt-6.1-terra high via local opencodex, one call + at most 2 repairs."""
import base64, json, os, re, subprocess, sys, time, urllib.request
brief, arm, rep = sys.argv[1], sys.argv[2], sys.argv[3]
HOME = os.path.expanduser("~")
RUNS = os.environ.get("BBOX_RUNS2", f"{HOME}/z-project/assistant-whole-game/suite/rooms/runs-bboxdungeon2")
G = f"{RUNS}/{arm}{rep}/{brief}"; os.makedirs(G, exist_ok=True)
MODEL = {"sol": "gpt-6.1-sol", "terra": "gpt-6.1-terra"}[arm]
OCX = "http://127.0.0.1:10200/v1/chat/completions"
ENV = dict(os.environ, OPRN_SHARED_CONTENT_SQLITE=f"{RUNS}/shared-content.sqlite")
SUFFIX = " 다른 맵은 만들지 말고 이 던전 한 층만 지어 줘."
REQ = {"crypt": "교회 지하에 있는 지하 묘지 던전 한 층을 만들어 줘. 입구 계단으로 내려와 보스가 기다리는 곳까지 가는 던전이야." + SUFFIX,
       "flooded": "물에 잠긴 동굴 속 옛 신전 던전 한 층을 만들어 줘. 입구에서 들어와 깊은 곳의 보스까지 가는 던전이야." + SUFFIX,
       "demon": "마왕성 지하 던전 한 층을 만들어 줘. 입구 계단으로 내려와 마왕의 부하 보스가 기다리는 곳까지 가는 던전이야." + SUFFIX,
       "cave": "사람 손이 닿지 않은 자연 동굴 던전 한 층을 만들어 줘. 입구로 들어와 가장 깊은 곳에 사는 보스까지 가는 동굴이야." + SUFFIX}[brief]
THEMEWORD = {"crypt": "지하묘지 catacomb", "flooded": "신전 temple", "demon": "성 castle", "cave": "동굴 cave"}[brief]

if rep == "v2":
    parts = json.loads(subprocess.run(["bun", "scripts/experiments/bbox-dungeon/v2.mts", "parts", THEMEWORD], capture_output=True, text=True, env=ENV).stdout.strip().splitlines()[-1])
    PROMPT = f"""You design one dungeon floor for an RPG map builder. The builder (author_dungeon) lays it out from your design: you give rooms (role, size, shape, spot, water, features, level) and links; the builder places, carves and decorates.

User request (Korean): {REQ}

dungeon_parts result for this theme (vocabulary, examples, notes — Korean as the tool returns it):
{json.dumps(parts["parts"], ensure_ascii=False)}

dungeonDesign JSON schema:
{json.dumps(parts["schema"], ensure_ascii=False)}

# Output: one JSON object only, no prose: {{"name": "...", "dungeonDesign": {{...}}}}"""
else:
    catalog = open(f"{RUNS}/catalog.txt").read()
    PROMPT = f"""You design one whole RPG dungeon floor. You control the shapes; code only executes them: it rasterises every shape you write onto a 16px cell grid exactly and deterministically, derives wall and ceiling art from the open cells, stamps the pieces you name, and checks the result. Nothing is added, moved or decorated for you.

User request (Korean): {REQ}

{catalog}
# How to think about the floor (the why — use your judgement, these are not checklist items)
- Mix shapes by purpose. Rooms people built (crypt halls, castle cells, a temple sanctum) read as built when they are rectangular or a union of rects; places water or time carved (caves, flooded grottos, collapsed parts) read as natural when they are irregular: ellipses, polygons, blobs, rough or crumbled edges. A floor where every room is a plain rectangle reads as a spreadsheet, not a place. A natural cave has almost no straight wall.
- Loops and branches, not one line. A side branch to treasure and at least one loop give the player choices and a reason to explore; a single chain of rooms is a corridor with extra steps.
- Vary room sizes. One or two big spaces (the climax, a flooded hall) against small pockets and narrow squeezes give rhythm.
- Landmarks. Each room needs one thing a player would remember it by (a sunken idol, a crystal cluster, a great mosaic) — it is how they navigate.
- Sightlines. Put the landmark where the player sees it on entering; let a bridge or ledge show the goal before the path reaches it; guard the boss behind an antechamber that builds tension.
- Organic features make caves read as caves: rock islands that split a cavern, rubble and stalagmites scattered along walls, pools with ragged shores, chasms crossed by a bridge, raised ledges reached by stairs.

# Grid and shapes (cells; x right, y down, origin top-left)
- Map w 16..90, h 16..80. Everything not inside a room or corridor is solid rock. The rows just above an open area's top edge become its north wall face (3 rows for built themes, 2 for cave), drawn by code. Open cells must stay inside x 1..w-2, y 4..h-2.
- Vertically, keep at least 3 solid rows (4 for built themes looks best) between an open cell and any open cell above it in the same column — wall face plus ceiling need the space. Side by side, 1 solid column is enough.
- A shape is one of:
  {{"rect": [x, y, w, h]}}
  {{"poly": [[x, y], ...]}}  vertices on cell corners; a cell is in when its centre is inside
  {{"ellipse": [cx, cy, rx, ry]}}  covers about cx-rx..cx+rx, cy-ry..cy+ry (round chamber)
  {{"blob": [[x, y, r], ...]}}  cave blob: discs of radius r at your control points, joined by tapered capsules in order (a chain of points makes a winding cavern; one point is a disc)
  Several shapes in one "shapes" list are united (rect unions make L, T, cross; blob + ellipse make a lobed cave).
- "edge" (optional, default smooth): "smooth" = exactly the shape · "rough" = seeded jitter of amplitude 1 along the boundary (natural cave wall) · "crumbled" = finer jitter with occasional 2-deep bites (ruined, collapsed). Edge applies to rooms, corridors, hazards, rocks and ledges.
- Corridors: "points" waypoints (any angle), "path": "line" (straight segments) or "curve" (smooth spline through the points), "width" 1..4. A natural fissure is a curve with width 1-2 and edge "rough". A corridor may run into its own from/to rooms, never through other rooms.
- Regions connect by touching or overlapping: a corridor joins its from/to rooms; a room may list "joins": [room ids] to open directly into them (caverns flowing into each other). Unlinked regions must not touch. No doors are needed; "gates" are optional locked iron bars on a walkable cell.
- Hazards: water, lava or pit (chasm) with shapes + edge; only their cells inside open areas count. They are not walkable. Bridges: straight from:[x,y] to:[x,y] (same row or column), width 1..3, over hazard cells.
- Rocks: solid rock islands/pillars inside open areas (shapes + edge). Every column of a rock must be at least 3 rows tall (top = ceiling, the rows below = its rock face).
- Ledges: raised floor, "level" 1 or 2, shapes + edge, over open cells. A ledge is reached only by stairs: {{"x","y","up":"n|s|e|w","width":1..3}} where (x,y) is the ledge's edge cell next to the lower floor and "up" points into the ledge; the stairs climb (level difference + 1) cells into the ledge, so the ledge must be at least that deep there plus one landing cell. Prefer "up": "n" (stairs on a ledge's south edge read best). Lanes of a wider stair go right (n/s) or down (e/w).
- Entrance: exactly one "stairs up" piece on the entrance room's north wall face (its 2 cells are the 2 wall rows just above the room's top floor row; the floor cell right below it is where the player arrives). If an edge makes the wall line uneven, a wall-mounted piece is snapped up/down to the face in its column.
- Purposes: entrance, guard, puzzle, treasure, antechamber, boss, other. Exactly one entrance, antechamber and boss. Every walking route from the entrance into the boss room must pass through the antechamber.
- Pieces: x,y = top-left cell. Floor pieces need walkable floor under their bottom row (one level) and must not overlap; wall-mounted pieces only on wall face. Solid pieces block walking — keep paths open. "scatter": {{"id","in": "<room or corridor id>","count"}} asks code to place up to count copies at seeded free spots in that region, skipping spots that would cut a path (good for rubble, stalagmites, bones, glow moss). Chests: {{"x","y"}} on walkable floor, reachable.
- Themes (wall/floor art for the whole floor): catacomb = grey crypt stone, castle = castle stone, temple = pale temple stone, cave = natural rock walls and earth floor.

# Output: one JSON object only, no prose
{{"name": "...", "theme": "catacomb|castle|temple|cave",
 "map": {{"w": W, "h": H}},
 "rooms": [{{"id": "...", "purpose": "entrance", "shapes": [SHAPE, ...], "edge": "smooth|rough|crumbled", "joins": ["<room id>"], "landmark": {{"id": "<piece id>", "x": X, "y": Y}}, "note": "..."}}],
 "corridors": [{{"id": "...", "from": "<room id>", "to": "<room id>", "path": "line|curve", "width": 1, "points": [[X, Y], [X, Y]], "edge": "smooth"}}],
 "hazards": [{{"kind": "water|lava|pit", "shapes": [SHAPE], "edge": "rough"}}],
 "bridges": [{{"from": [X, Y], "to": [X, Y], "width": 1}}],
 "rocks": [{{"shapes": [SHAPE], "edge": "rough"}}],
 "ledges": [{{"level": 1, "shapes": [SHAPE], "edge": "smooth"}}],
 "stairs": [{{"x": X, "y": Y, "up": "n", "width": 2}}],
 "gates": [{{"x": X, "y": Y}}],
 "objects": [{{"id": "<piece id>", "x": X, "y": Y, "repeat": {{"count": 3, "dx": 2, "dy": 0}}}}],
 "scatter": [{{"id": "<piece id>", "in": "<region id>", "count": 5}}],
 "traps": [{{"id": "<trap id>", "x": X, "y": Y}}],
 "chests": [{{"x": X, "y": Y}}]}}
"joins", "edge", "repeat" and the feature lists are optional. Design a specific floor that fits the request."""
open(f"{G}/prompt.txt", "w").write(PROMPT)
content = [{"type": "text", "text": PROMPT}]
if rep != "v2": content.append({"type": "image_url", "image_url": {"url": "data:image/png;base64," + base64.b64encode(open(f"{RUNS}/palette.png", "rb").read()).decode()}})
msgs = [{"role": "user", "content": content}]

def call(n):
    body = json.dumps({"model": MODEL, "messages": msgs, "reasoning_effort": "high"}).encode()
    t0 = time.time()
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(OCX, body, {"content-type": "application/json"}), timeout=1500) as r: d = json.load(r)
            break
        except Exception:
            if attempt == 2: raise
            time.sleep(20)
    secs = round(time.time() - t0, 1); u = d.get("usage") or {}
    text = d["choices"][0]["message"]["content"] or ""
    json.dump({"secs": secs, "usage": u, "model": d.get("model"), "text": text}, open(f"{G}/call-{n}.json", "w"), ensure_ascii=False, indent=1)
    return text, secs, u

def parse(text):
    m = re.search(r"\{.*\}", text, re.S)
    try: return json.loads(m.group(0)) if m else None
    except Exception: return None

def lay(n, layout, render=False):
    f = f"{G}/layout-{n}.json"; json.dump(layout, open(f, "w"), indent=1, ensure_ascii=False)
    if rep == "v2":
        p = subprocess.run(["bun", "scripts/experiments/bbox-dungeon/v2.mts", "build", f, THEMEWORD, G], capture_output=True, text=True, env=ENV)
        try: r = json.loads(p.stdout.strip().splitlines()[-1]); return {"ok": r["ok"], "errors": [] if r["ok"] else [r["summary"]], "warnings": r["warnings"], "stats": {"size": r["size"]}}
        except Exception: return {"ok": False, "errors": ["builder crashed: " + (p.stderr or p.stdout)[-500:]], "warnings": []}
    out = G if render else f"{G}/lay-{n}"
    p = subprocess.run(["bun", "scripts/experiments/bbox-dungeon/lay2.mts", f, out] + (["--render"] if render else []), capture_output=True, text=True, env=ENV)
    try: return json.loads(p.stdout.strip().splitlines()[-1])
    except Exception: return {"ok": False, "errors": ["painter crashed: " + (p.stderr or p.stdout)[-500:]], "warnings": []}

calls, layout, chk = [], None, None
for n in range(3):
    text, secs, u = call(n); calls.append({"secs": secs, "tokens": u.get("total_tokens", 0)})
    msgs.append({"role": "assistant", "content": text})
    layout = parse(text)
    chk = lay(n, layout, render=(rep == "v2")) if layout else {"ok": False, "errors": ["Your answer was not one parseable JSON object."], "warnings": []}
    json.dump(chk, open(f"{G}/check-{n}.json", "w"), indent=1, ensure_ascii=False)
    print(f"{arm}{rep}/{brief} call {n}: {secs}s ok={chk['ok']} errors={len(chk['errors'])}", flush=True)
    if chk["ok"]: break
    if n < 2:
        msgs.append({"role": "user", "content": "Rejected: the validator found problems. Fixed call: fix every problem below and return the full corrected JSON only (same format).\n- "
                     + "\n- ".join(chk["errors"][:40]) + ("\nWarnings (fix if you can):\n- " + "\n- ".join(chk["warnings"][:10]) if chk.get("warnings") else "")})
res = {"brief": brief, "arm": arm, "rep": rep, "model": MODEL, "calls": calls, "repairs": len(calls) - 1, "ok": bool(chk and chk["ok"]),
       "secs": round(sum(c["secs"] for c in calls), 1), "tokens": sum(c["tokens"] for c in calls)}
if layout: json.dump(layout, open(f"{G}/layout.json", "w"), indent=1, ensure_ascii=False)
if res["ok"] and rep != "v2":
    fin = lay("final", layout, render=True); res["warnings"] = fin.get("warnings"); res["stats"] = fin.get("stats")
elif res["ok"]: res["warnings"] = chk.get("warnings"); res["stats"] = chk.get("stats")
else: res["errors"] = chk["errors"][:20] if chk else ["no answer"]; res["stats"] = (chk or {}).get("stats")
res["rendered"] = os.path.exists(f"{G}/map.png")
json.dump(res, open(f"{G}/RUN.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps(res, ensure_ascii=False)[:400])
