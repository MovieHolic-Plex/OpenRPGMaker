#!/usr/bin/env python3
"""bbox-dungeon, one run (from the worktree root):
  python3 scripts/experiments/bbox-dungeon/run.py <crypt|flooded|demon> <sol|terra> <rep>        bbox: model writes the whole floor cell by cell
  python3 scripts/experiments/bbox-dungeon/run.py <brief> <sol|terra> v2                          baseline: model writes a v2 dungeonDesign → author_dungeon
Out: $BBOX_RUNS/<arm><rep>/<brief>/ {prompt.txt, call-N.json, layout-N.json, check-N.json, layout.json, map.png, RUN.json}
Model: gpt-6.1-sol / gpt-6.1-terra high via local opencodex, one call + at most 2 repairs (English Rejected / Fixed call)."""
import base64, json, os, re, subprocess, sys, time, urllib.request
brief, arm, rep = sys.argv[1], sys.argv[2], sys.argv[3]
HOME = os.path.expanduser("~")
RUNS = os.environ.get("BBOX_RUNS", f"{HOME}/z-project/assistant-whole-game/suite/rooms/runs-bboxdungeon")
G = f"{RUNS}/{arm}{rep}/{brief}"; os.makedirs(G, exist_ok=True)
MODEL = {"sol": "gpt-6.1-sol", "terra": "gpt-6.1-terra"}[arm]
OCX = "http://127.0.0.1:10200/v1/chat/completions"
ENV = dict(os.environ, OPRN_SHARED_CONTENT_SQLITE=f"{RUNS}/shared-content.sqlite")
SUFFIX = " 다른 맵은 만들지 말고 이 던전 한 층만 지어 줘."
REQ = {"crypt": "교회 지하에 있는 지하 묘지 던전 한 층을 만들어 줘. 입구 계단으로 내려와 보스가 기다리는 곳까지 가는 던전이야." + SUFFIX,
       "flooded": "물에 잠긴 동굴 속 옛 신전 던전 한 층을 만들어 줘. 입구에서 들어와 깊은 곳의 보스까지 가는 던전이야." + SUFFIX,
       "demon": "마왕성 지하 던전 한 층을 만들어 줘. 입구 계단으로 내려와 마왕의 부하 보스가 기다리는 곳까지 가는 던전이야." + SUFFIX}[brief]
THEMEWORD = {"crypt": "지하묘지 catacomb", "flooded": "신전 temple", "demon": "성 castle"}[brief]

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
    PROMPT = f"""You design one whole RPG dungeon floor as an exact cell layout. Your JSON is laid onto the map cell by cell by code that only executes and checks it — every room, corridor, door, hazard and piece you write is exactly what appears; nothing is added, moved or decorated for you.

User request (Korean): {REQ}

{catalog}
# Grid rules (16px cells, x to the right, y down, origin top-left)
- Map size: w 16..80, h 16..70. Every cell outside rooms and corridors is solid rock. Wall art is derived from the open cells: the 3 solid rows directly above any open cell are drawn as its north wall face (tall stone wall); other solid cells are dark ceiling with a stone rim.
- So: keep at least 4 solid rows between an open area and any open cell above it in the same column (3 wall-face rows + 1 ceiling row). Side by side (left/right), 1 solid column is enough. Open areas: x 1..w-2, y 4..h-2.
- Rooms: one or more rects each (a rect union may form an L, T, cross or irregular shape). Rooms must not overlap or touch other rooms/corridors except at a door. Purposes: entrance, guard, puzzle, treasure, antechamber, boss, other. Exactly one entrance, one antechamber, one boss; at least one guard, puzzle and treasure.
- Corridors: a list of waypoints [[x,y],...]; consecutive waypoints share a row or column (add corner waypoints). Width 1..3: each path cell is widened to a width x width square going right/down from the path cell. A corridor may run into its own from/to rooms, never through other rooms.
- Doors: every corridor needs a door at each end, and every place where two rooms/corridors touch needs a door: {{"x","y","connects":[idA,idB],"locked":bool}}, on the open cell where they meet (within 1 cell of both). A locked door is drawn as iron bars.
- Hazards: rects of water, lava or pit inside rooms/corridors (not walkable). Bridges: rects over hazard cells (walkable). Hazards must leave a walkable path to every room.
- Entrance: exactly one "stairs up" piece on the entrance room's north wall face (its 2 cells are the 2 wall rows just above the room's top floor row; the floor cell right below it is where the player arrives). Optionally "stairs down" deeper in.
- Boss gating: every walking route from the entrance into the boss room must pass through the antechamber (the antechamber is the only way in).
- Pieces: x,y = top-left cell of the piece. Floor pieces need walkable floor under their bottom row and must not overlap other pieces; wall-mounted pieces only on wall face. Pieces with solid bases block walking — keep paths open. Chests are separate: {{"x","y"}} on walkable floor, reachable.
- Every room needs one landmark piece (a memorable centerpiece). Use torches/braziers for light, statues, traps on the path, and enough furniture that no big floor area is empty.

# Output: one JSON object only, no prose
{{"name": "...", "theme": "catacomb|castle|temple",
 "map": {{"w": W, "h": H}},
 "rooms": [{{"id": "...", "purpose": "entrance", "rects": [{{"x": X, "y": Y, "w": W, "h": H}}], "landmark": {{"id": "<piece id>", "x": X, "y": Y}}, "note": "..."}}],
 "corridors": [{{"id": "...", "from": "<room id>", "to": "<room id>", "width": 1, "path": [[X, Y], [X, Y]]}}],
 "doors": [{{"x": X, "y": Y, "connects": ["<id>", "<id>"], "locked": false}}],
 "hazards": [{{"kind": "water|lava|pit", "x": X, "y": Y, "w": W, "h": H}}],
 "bridges": [{{"x": X, "y": Y, "w": W, "h": H}}],
 "objects": [{{"id": "<piece id>", "x": X, "y": Y, "repeat": {{"count": 3, "dx": 2, "dy": 0}}}}],
 "traps": [{{"id": "<trap id>", "x": X, "y": Y}}],
 "chests": [{{"x": X, "y": Y}}]}}
"repeat" is optional. Theme picks the wall/floor art: catacomb = grey crypt stone, castle = castle stone, temple = pale temple stone.
Design a specific dungeon floor that fits the request: rooms of different sizes and shapes, a route with choices (a loop or side branch), hazards that shape the walk, and a clear climax at the boss."""
open(f"{G}/prompt.txt", "w").write(PROMPT)
content = [{"type": "text", "text": PROMPT}]
if rep != "v2": content.append({"type": "image_url", "image_url": {"url": "data:image/png;base64," + base64.b64encode(open(f"{RUNS}/palette.png", "rb").read()).decode()}})
msgs = [{"role": "user", "content": content}]

def call(n):
    body = json.dumps({"model": MODEL, "messages": msgs, "reasoning_effort": "high"}).encode()
    t0 = time.time()
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(OCX, body, {"content-type": "application/json"}), timeout=1200) as r: d = json.load(r)
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
    p = subprocess.run(["bun", "scripts/experiments/bbox-dungeon/lay.mts", f, out] + (["--render"] if render else []), capture_output=True, text=True, env=ENV)
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
else: res["errors"] = chk["errors"][:20] if chk else ["no answer"]
res["rendered"] = os.path.exists(f"{G}/map.png")
json.dump(res, open(f"{G}/RUN.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps(res, ensure_ascii=False)[:400])
