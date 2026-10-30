#!/usr/bin/env python3
"""bbox-chipsets, one run: same as bbox-room run.py, but the place picks a chipset and its generated catalog/palette.
  python3 scripts/experiments/bbox-chipsets/run.py <place> <sol|terra> <rep>     (run from the worktree root)
Out: $BBOX_RUNS/<arm><rep>/<task>/ {prompt.txt, call-N.json, layout-N.json, check-N.json, layout.json, layout.png, map.png, RUN.json}
Model: gpt-6.1-sol / gpt-6.1-terra high via local opencodex (127.0.0.1:10200), one direct chat call + at most 2 repair calls."""
import base64, json, os, re, subprocess, sys, time, urllib.request
task, arm, rep = sys.argv[1], sys.argv[2], sys.argv[3]
HOME = os.path.expanduser("~")
RUNS = os.environ.get("BBOX_RUNS", f"{HOME}/z-project/assistant-whole-game/suite/rooms/runs-bbox-chipsets")
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
x,y of a piece = the top-left cell of its footprint. "repeat" is optional (count copies, each shifted by dx,dy). carpets/daises only if the catalog lists them. Sized pieces go in "objects" with the size in the id (e.g. "<id> 3x2").
Design a specific, lived-in room that fits the request: not a plain rectangle — use several regions (side rooms, alcoves, an L or two-part shape), a clear landmark, distinct functional zones, and enough furniture and decoration that no large floor area is empty."""
open(f"{G}/prompt.txt", "w").write(PROMPT)
IMG = "data:image/png;base64," + base64.b64encode(open(f"{RUNS}/cat/palette-{task}.png", "rb").read()).decode()
msgs = [{"role": "user", "content": [{"type": "text", "text": PROMPT}, {"type": "image_url", "image_url": {"url": IMG}}]}]

def call(n):
    body = json.dumps({"model": MODEL, "messages": msgs, "reasoning_effort": "high"}).encode()
    t0 = time.time()
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(OCX, body, {"content-type": "application/json"}), timeout=900) as r: d = json.load(r)
            break
        except Exception as e:
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
    f = f"{G}/layout-{n}.json"; json.dump(layout, open(f, "w"), indent=1)
    out = f"{G}/lay-{n}" if not render else G
    p = subprocess.run(["bun", "scripts/experiments/bbox-chipsets/lay.mts", TS, f, out, f"{RUNS}/base"] + (["--render"] if render else []),
                       capture_output=True, text=True, env=dict(os.environ, OPRN_SHARED_CONTENT_SQLITE=f"{RUNS}/shared-content.sqlite"))
    try: return json.loads(p.stdout.strip().splitlines()[-1])
    except Exception: return {"ok": False, "errors": ["painter crashed: " + (p.stderr or p.stdout)[-500:]], "warnings": []}

calls, layout, chk = [], None, None
for n in range(3):   # first call + at most 2 repairs
    text, secs, u = call(n); calls.append({"secs": secs, "tokens": u.get("total_tokens", 0), "in": u.get("prompt_tokens", 0), "out": u.get("completion_tokens", 0)})
    msgs.append({"role": "assistant", "content": text})
    layout = parse(text)
    chk = lay(n, layout) if layout else {"ok": False, "errors": ["Your answer was not one parseable JSON object."], "warnings": []}
    json.dump(chk, open(f"{G}/check-{n}.json", "w"), indent=1)
    print(f"{arm}{rep}/{task} call {n}: {secs}s tok={u.get('total_tokens')} ok={chk['ok']} errors={len(chk['errors'])}", flush=True)
    if chk["ok"]: break
    if n < 2:
        msgs.append({"role": "user", "content": "Fixed call: the layout was rejected by the validator. Fix every problem below and return the full corrected layout JSON only (same format).\n- "
                     + "\n- ".join(chk["errors"][:40]) + ("\nWarnings (fix if you can):\n- " + "\n- ".join(chk["warnings"][:10]) if chk["warnings"] else "")})
res = {"task": task, "tileset": TS, "arm": arm, "rep": int(rep), "model": MODEL, "calls": calls, "repairs": len(calls) - 1, "ok": bool(chk and chk["ok"]),
       "secs": round(sum(c["secs"] for c in calls), 1), "tokens": sum(c["tokens"] for c in calls)}
if res["ok"]:
    json.dump(layout, open(f"{G}/layout.json", "w"), indent=1)
    fin = lay("final", layout, render=True); res["warnings"] = fin.get("warnings"); res["stats"] = {k: v for k, v in (fin.get("stats") or {}).items() if k != "plan"}
    res["rendered"] = os.path.exists(f"{G}/map.png")
else:
    res["errors"] = chk["errors"][:20] if chk else ["no answer"]
    if layout: json.dump(layout, open(f"{G}/layout.json", "w"), indent=1)
json.dump(res, open(f"{G}/RUN.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps(res)[:400])
