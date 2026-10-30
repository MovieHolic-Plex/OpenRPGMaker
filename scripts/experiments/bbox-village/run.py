#!/usr/bin/env python3
"""bbox-village, one run: the model writes a cell-exact village layout on a code terrain; lay.mts validates (max 2 repairs) and paints it.
  python3 scripts/experiments/bbox-village/run.py <port|hill> <sol|terra> <rep>     (run from the worktree root)
Out: $BBOX_RUNS/<arm><rep>/<brief>/ {prompt.txt, call-N.json, layout-N.json, check-N.json, layout.json, map.png, RUN.json}"""
import base64, json, os, re, subprocess, sys, time, urllib.request
brief, arm, rep = sys.argv[1], sys.argv[2], sys.argv[3]
HOME = os.path.expanduser("~")
RUNS = os.environ.get("BBOX_RUNS", f"{HOME}/z-project/assistant-whole-game/suite/rooms/runs-bboxramps")
G = f"{RUNS}/{arm}{rep}/{brief}"; os.makedirs(G, exist_ok=True)
MODEL = {"sol": "gpt-6.1-sol", "terra": "gpt-6.1-terra"}[arm]
OCX = "http://127.0.0.1:10200/v1/chat/completions"
B = json.load(open("scripts/experiments/bbox-village/briefs.json"))[brief]
TD = f"{RUNS}/terrain-{brief}"; T = json.load(open(f"{TD}/terrain.json")); W, H = T["W"], T["H"]
catalog = open(f"{RUNS}/catalog.txt").read()

def terrain_text():
    lv, wa = T["levels"], T["water"]
    from collections import Counter
    cnt = Counter(lv[i] for i in range(W * H) if not wa[i])
    L = [f"# Terrain (made by code — you cannot change it). Map {W} x {H} cells, x to the right 0..{W-1}, y down 0..{H-1}.",
         f"Levels (height) present on dry land: " + ", ".join(f"level {k}: {v} cells" for k, v in sorted(cnt.items())) + ".",
         "One level = one cell of cliff face. Where a higher area lies north of a lower one, the drop is drawn as a cliff face on the south side, as many cells tall as the level difference (a 2-level step = a 2-cell-tall face).",
         "Water: " + ", ".join(n for n, v in (("river", 1), ("lake", 2), ("sea", 3)) if v in wa) + ". Nothing but piers/bridges (roads) and boats may be on water."]
    if T["river"]:
        a, b = T["river"][0], T["river"][-1]; L.append(f"River flows from ({a % W},{a // W}) to ({b % W},{b // W}). Good bridge spots (straight river, same level banks): " + " ".join(f"({k['x']},{k['y']},{k['dir']})" for k in T["crossings"][:6]))
    L.append("Flat areas (connected same-level land): " + "; ".join(f"level {a['level']} area {a['area']} cells, box ({a['x0']},{a['y0']})-({a['x1']},{a['y1']}), centre ({a['cx']},{a['cy']})" for a in T["areas"] if a["area"] >= 30))
    L.append("")
    L.append("Cell grid (one char per cell; digit = level of dry land, ~ = river, o = lake, = = sea). Row label = y. Column header = x (tens row, then units row).")
    L.append("    " + "".join(str((x // 10) % 10) for x in range(W)))
    L.append("    " + "".join(str(x % 10) for x in range(W)))
    for y in range(H):
        L.append(f"{y:3d} " + "".join({1: "~", 2: "o", 3: "="}.get(wa[y * W + x], str(lv[y * W + x])) for x in range(W)))
    return "\n".join(L)

PROMPT = f"""You design one RPG village map as an exact cell layout on top of an existing terrain. Your JSON is executed cell by cell by code that only paints what you write — every road, plaza, cut (ramp/stairs), building, field, fence, forest, tree and prop you write is exactly what appears, and NOTHING else is added (no automatic trees, roads or decoration). Empty cells stay plain grass.

Village request: {B['en']}

Image 1 = the terrain: lighter green = higher level, black lines = level borders (cliffs), blue = water; grid lines every 5 cells with x/y labels.
Image 2 = the kit sheet: every building/prop/tree drawn at real size with its exact id and size.

{terrain_text()}

{catalog}
# Rules (the validator rejects the layout if any is broken)
- Coordinates are cells. A rect is {{"x","y","w","h"}} covering x..x+w-1, y..y+h-1. Kits are placed by their top-left cell.
- Nothing may overlap, except: roads may cross/join other roads; props may stand on a plaza. Kits, fields, fences, forests must not cover road cells.
- Buildings, props, trees, fields, fences and plazas lie on ONE level each (no straddling a cliff) and on dry land. Boats lie fully on water.
- Do not put a building where higher ground lies within the 2 rows just south of it.
- Every building's door front cell (listed per kit) must be a road/track/plaza cell of the connected network, on the building's own level.
- All road/track/pier/plaza/cut cells must form ONE connected network (walking rules), and at least one road must reach a dry map edge cell (the entrance).
- Paths change level ONLY through a cliff cut (ramp or stairs, see the catalog), and only north-south. Pick the piece whose height equals the cliff's level difference there (ramp-h2-... for a 2-level step) and whose width matches the road (2 or 3). Place it by its foot: x,y = left cell of the lower-level row directly against the cliff; the row above (exit, higher level) and the row below (entry, lower level) must be road/track/plaza over the whole width. Use south-facing cliffs (higher level to the north, dir "north") — the 3/4 view shows only those faces. A cut through a north-facing cliff is rejected while the same level boundary has any south-facing face; route the road around to it (only a boundary with no south face may take {{..., "dir": "south", "northFace": true}}). Ramps suit tracks, stairs suit paved roads. Cut cells count as path; don't also list them as road.
- Adjacent path cells on different levels without a cut between them are an error.
- A road on a river is drawn as a plank bridge; only kind "pier" may go onto the sea (wooden piers from the shore).
- Fence: the rect is the fence ring itself (border cells), with one gate cell on the ring (not a corner); the cell just outside the gate must be a road/track cell.

# Output: one JSON object only, no prose
{{"name": "...",
 "zones": [{{"name": "harbour", "purpose": "...", "x": X, "y": Y, "w": W, "h": H}}],
 "roads": [{{"kind": "main|lane|track|pier", "purpose": "...", "rects": [{{"x": X, "y": Y, "w": W, "h": H}}, ...]}}],
 "plazas": [{{"x": X, "y": Y, "w": W, "h": H, "purpose": "..."}}],
 "cuts": [{{"id": "<ramp-hN-wW or stairs-hN-wW>", "x": X, "y": Y, "dir": "north"}}],
 "buildings": [{{"id": "<building id>", "x": X, "y": Y, "purpose": "..."}}],
 "fields": [{{"crop": "wheat|barley|rye|vines|herbs|flowers", "x": X, "y": Y, "w": W, "h": H}}],
 "fences": [{{"x": X, "y": Y, "w": W, "h": H, "gate": [GX, GY]}}],
 "forests": [{{"x": X, "y": Y, "w": W, "h": H}}],
 "trees": [{{"id": "<tree id>", "x": X, "y": Y}}],
 "props": [{{"id": "<prop id>", "x": X, "y": Y}}]}}
zones are labels only (the purpose of each part of the village: harbour, market, residential, farms, ...).
Design a specific, lived-in village that fits the request and uses the terrain: a clear centre and landmark, distinct zones with purpose, roads that follow the land, ramps or stairs cut into the cliffs where the village climbs, and enough fields, woods, orchards (rows of trees) and props that no large area is empty grass. Use the whole map."""
open(f"{G}/prompt.txt", "w").write(PROMPT)
img = lambda p: {"type": "image_url", "image_url": {"url": "data:image/png;base64," + base64.b64encode(open(p, "rb").read()).decode()}}
msgs = [{"role": "user", "content": [{"type": "text", "text": PROMPT}, img(f"{TD}/terrain-raw.png"), img(f"{RUNS}/sheet.png")]}]

def call(n):
    # streaming keeps long high-reasoning calls alive through the local gateway (non-stream sol calls got 502)
    body = json.dumps({"model": MODEL, "messages": msgs, "reasoning_effort": "high", "stream": True, "stream_options": {"include_usage": True}}).encode()
    t0 = time.time()
    for attempt in range(3):
        try:
            text, u, mdl = "", {}, None
            with urllib.request.urlopen(urllib.request.Request(OCX, body, {"content-type": "application/json"}), timeout=1800) as r:
                for line in r:
                    line = line.strip()
                    if not line.startswith(b"data:") or line == b"data: [DONE]": continue
                    ev = json.loads(line[5:]); mdl = ev.get("model") or mdl
                    if ev.get("usage"): u = ev["usage"]
                    for ch in ev.get("choices") or []: text += (ch.get("delta") or {}).get("content") or ""
            if not text.strip(): raise RuntimeError("empty answer")
            break
        except Exception as e:
            print("retry", e, flush=True)
            if attempt == 2: raise
            time.sleep(20)
    secs = round(time.time() - t0, 1)
    json.dump({"secs": secs, "usage": u, "model": mdl, "text": text}, open(f"{G}/call-{n}.json", "w"), ensure_ascii=False, indent=1)
    return text, secs, u

def parse(text):
    m = re.search(r"\{.*\}", text, re.S)
    try: return json.loads(m.group(0)) if m else None
    except Exception: return None

def lay(n, layout, render=False):
    f = f"{G}/layout-{n}.json"; json.dump(layout, open(f, "w"), indent=1)
    out = G if render else f"{G}/lay-{n}"
    p = subprocess.run(["bun", "scripts/experiments/bbox-village/lay.mts", f, f"{TD}/terrain.json", f"{RUNS}/catalog.json", out] + (["--render"] if render else []), capture_output=True, text=True)
    try: return json.loads(p.stdout.strip().splitlines()[-1])
    except Exception: return {"ok": False, "errors": ["painter crashed: " + (p.stderr or p.stdout)[-500:]], "warnings": []}

calls, layout, chk = [], None, None
for n in range(3):
    text, secs, u = call(n); calls.append({"secs": secs, "tokens": u.get("total_tokens", 0)})
    msgs.append({"role": "assistant", "content": text})
    layout = parse(text)
    chk = lay(n, layout) if layout else {"ok": False, "errors": ["Your answer was not one parseable JSON object."], "warnings": []}
    json.dump(chk, open(f"{G}/check-{n}.json", "w"), indent=1)
    print(f"{arm}{rep}/{brief} call {n}: {secs}s tok={u.get('total_tokens')} ok={chk['ok']} errors={len(chk['errors'])}", flush=True)
    if chk["ok"]: break
    if n < 2:
        msgs.append({"role": "user", "content": "Rejected: the validator found problems. Fixed call: fix every problem below and return the full corrected layout JSON only (same format).\n- "
                     + "\n- ".join(chk["errors"][:40]) + ("\nWarnings (fix if you can):\n- " + "\n- ".join(chk["warnings"][:10]) if chk["warnings"] else "")})
res = {"brief": brief, "arm": arm, "rep": int(rep), "model": MODEL, "calls": calls, "repairs": len(calls) - 1, "ok": bool(chk and chk["ok"]),
       "secs": round(sum(c["secs"] for c in calls), 1), "tokens": sum(c["tokens"] for c in calls)}
if layout: json.dump(layout, open(f"{G}/layout.json", "w"), indent=1)
if res["ok"]:
    fin = lay("final", layout, render=True); res["warnings"] = fin.get("warnings"); res["stats"] = fin.get("stats"); res["rendered"] = os.path.exists(f"{G}/map.png")
else:
    res["errors"] = chk["errors"][:20] if chk else ["no answer"]
json.dump(res, open(f"{G}/RUN.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps(res)[:400])
