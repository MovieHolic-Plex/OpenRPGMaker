#!/usr/bin/env python3
"""bbox-better (c) two-stage: a cheap model (terra) writes the coarse plan (map, regions, openings, entrance, landmark, carpets, daises,
named zones — no furniture), then sol fills in every object. The structure from stage 1 is locked in stage 2.
Each stage is validated by the same painter (Rejected / Fixed call, at most 2 repairs per stage).
  python3 scripts/experiments/bbox-better/twostage.py <inn|boss> <rep> [planner=terra] [filler=sol]
Out: $BBOX_RUNS/two-<planner><filler><rep>/<task>/ {plan.json, layout.json, layout.png, map.png, RUN.json}"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
task, rep = sys.argv[1:3]
PL = sys.argv[3] if len(sys.argv) > 3 else "terra"; FI = sys.argv[4] if len(sys.argv) > 4 else "sol"
G = f"{RUNS}/two-{PL}{FI}{rep}/{task}"; os.makedirs(G, exist_ok=True)
LOCK = ("map", "regions", "openings", "entrance")

STAGE1 = """# Stage 1 of 2 — you write the COARSE PLAN only
Another designer will fill in the furniture later, strictly inside your plan. You decide the room shape and the use of every floor area:
"map", "regions", "openings", "entrance", "landmark" (its catalog id and position), optional "carpets"/"daises", and "zones".
Do NOT write "objects". Instead write "zones": rectangles of floor that say what goes there, specific enough to furnish
(e.g. "reception: counter 4x1 facing the entrance, key board and inn sign on the wall behind", "dining: three dining 2x1 tables with chairs, fireplace on the north wall").
Every floor area must belong to a zone or be a deliberate walking path.
"zones": [{"id": "...", "x": X, "y": Y, "w": W, "h": H, "purpose": "..."}]
Use the output format below, but leave "objects" out and add "zones".

"""

STAGE2 = """# Stage 2 of 2 — you FILL IN the objects of a fixed coarse plan
The room shape is fixed: "map", "regions", "openings" and "entrance" below are locked and will be used exactly as given (any change you make to them is ignored).
You may adjust "landmark", "carpets" and "daises". Fill each zone with the objects its purpose asks for, and decorate walls and corners, so that no large floor area is empty.
Keep walking paths from the entrance to every zone.
Fixed coarse plan:
{plan}

Output the complete layout JSON (format below) including the locked fields as given and all "objects".

"""


def run_stage(arm, prompt, tag, fix):
    msgs = [{"role": "user", "content": [{"type": "text", "text": prompt}, {"type": "image_url", "image_url": {"url": palette(task)}}]}]
    calls, L, chk = [], None, None
    for n in range(3):
        text, c = call(arm, msgs, f"{G}/{tag}-call-{n}.json"); calls.append(c)
        msgs.append({"role": "assistant", "content": text})
        L = parse(text)
        if L is not None: L = fix(L)
        chk = lay(G, f"{tag}-{n}", L) if L else {"ok": False, "errors": ["Your answer was not one parseable JSON object."], "warnings": []}
        json.dump(chk, open(f"{G}/{tag}-check-{n}.json", "w"), indent=1)
        print(f"two {PL}{FI}{rep}/{task} {tag} call {n}: {c['secs']}s tok={c['tokens']} ok={chk['ok']} errors={len(chk['errors'])}", flush=True)
        if chk["ok"]: break
        if n < 2: msgs.append({"role": "user", "content": rejected_msg(chk)})
    return L, chk, calls


def no_objects(L):
    L = dict(L); L["objects"] = []; return L


plan, c1, calls1 = run_stage(PL, full_prompt(task, extra=STAGE1), "plan", no_objects)
res = {"task": task, "arm": f"two-{PL}{FI}", "rep": int(rep), "planner": MODEL[PL], "filler": MODEL[FI], "calls": calls1, "ok": False}
if plan: json.dump(plan, open(f"{G}/plan.json", "w"), indent=1); draw(f"{G}/plan.json", f"{G}/plan.png")
if c1["ok"]:
    def lock(L):
        L = dict(L)
        for k in LOCK: L[k] = plan[k]
        return L
    pj = json.dumps({k: plan[k] for k in ("map", "regions", "openings", "entrance", "landmark", "carpets", "daises", "zones") if k in plan}, ensure_ascii=False, indent=1)
    layout, c2, calls2 = run_stage(FI, full_prompt(task, extra=STAGE2.replace("{plan}", pj)), "fill", lock)
    res["calls"] += calls2; res["ok"] = c2["ok"]
    if layout: json.dump(layout, open(f"{G}/layout.json", "w"), indent=1)
    if c2["ok"]:
        fin = lay(G, "final", layout, render=True); res["warnings"] = fin.get("warnings"); res["stats"] = {k: v for k, v in (fin.get("stats") or {}).items() if k != "plan"}
    else: res["errors"] = c2["errors"][:20]
else: res["errors"] = ["stage 1: "] + c1["errors"][:20]
res["repairs"] = len(res["calls"]) - 2 if c1["ok"] else len(res["calls"]) - 1
res["secs"] = round(sum(c["secs"] for c in res["calls"]), 1); res["tokens"] = sum(c["tokens"] for c in res["calls"])
if os.path.exists(f"{G}/layout.json"): draw(f"{G}/layout.json", f"{G}/layout.png")
json.dump(res, open(f"{G}/RUN.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps(res)[:400])
