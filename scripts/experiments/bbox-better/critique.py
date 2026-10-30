#!/usr/bin/env python3
"""bbox-better (a) self-critique loop. Round 0 = the baseline bbox run (same prompt, read from runs-bboxroom).
Each round: the model sees its layout JSON + the laid map (2x) + its layout drawn as boxes, lists what looks wrong/empty,
and returns a layout patch. Code applies the patch exactly and validates it (Rejected / Fixed call, at most 2 repairs).
  python3 scripts/experiments/bbox-better/critique.py <inn|boss> <sol|terra> <rep> [rounds=2]
Out: $BBOX_RUNS/crit-<arm><rep>/<task>/r<k>/ {layout.json, layout.png, map.png, ROUND.json}"""
import copy, json, os, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
task, arm, rep = sys.argv[1:4]; ROUNDS = int(sys.argv[4]) if len(sys.argv) > 4 else 2
G = f"{RUNS}/crit-{arm}{rep}/{task}"; os.makedirs(G, exist_ok=True)

# round 0 = baseline
r0 = f"{G}/r0"; os.makedirs(r0, exist_ok=True)
B = f"{BASE_RUNS}/{arm}{rep}/{task}"
for f in ["layout.json", "map.png", "RUN.json"]: shutil.copy(f"{B}/{f}", f"{r0}/{f}")
b = json.load(open(f"{B}/RUN.json"))
json.dump({"round": 0, "ok": b["ok"], "calls": [dict(c, model=MODEL[arm]) for c in b["calls"]], "source": B}, open(f"{r0}/ROUND.json", "w"), indent=1)
draw(f"{r0}/layout.json", f"{r0}/layout.png")

CRIT = """Above is the layout JSON you wrote. Attached after it: (1) the map exactly as the game draws it from that layout (2x scale), (2) the same layout drawn as labelled boxes on the cell grid (yellow = landmark, dark band = the two north wall-face rows, green = openings/entrance).
List what looks wrong or empty as a player would see it, then output a layout patch.
Look at the rendered map as a player walking in: bare floor areas, zones that do not read as what they are for, odd or illogical placements, blocked or cramped paths, pieces that look wrong in the art, a weak landmark, a boring rectangle.

Answer with one JSON object only, no prose:
{"problems": ["short description with cells", "..."],
 "patch": {"remove_objects": [{"id": "<id>", "x": X, "y": Y}],
           "add_objects": [{"id": "<catalog id>", "x": X, "y": Y, "repeat": {"count": 2, "dx": 2, "dy": 0}, "purpose": "..."}],
           "replace": {"regions": [...], "openings": [...], "entrance": {...}, "map": {...}, "landmark": {...}, "carpets": [...], "daises": [...]}}}
- remove_objects matches an entry of "objects" by exact id and x,y (an entry with repeat is removed whole). To move a piece, remove it and add it at the new place.
- "replace" is optional: each key you give replaces that whole field of the layout (give the complete new list). Leave out fields you keep.
- The patch is applied to the layout above exactly, then validated with the same grid rules. Nothing is added for you."""


def apply(L, P):
    L = copy.deepcopy(L); errs = []
    if not isinstance(P, dict): return L, ["'patch' must be an object."]
    objs = L.get("objects", [])
    for r in P.get("remove_objects") or []:
        hit = [i for i, o in enumerate(objs) if o.get("id") == r.get("id") and o.get("x") == r.get("x") and o.get("y") == r.get("y")]
        if hit: objs.pop(hit[0])
        else: errs.append(f"remove_objects: no object entry with id \"{r.get('id')}\" at ({r.get('x')},{r.get('y')}) in the current layout — use the exact id and x,y of an entry in \"objects\".")
    objs += [o for o in (P.get("add_objects") or []) if isinstance(o, dict)]
    L["objects"] = objs
    for k, v in (P.get("replace") or {}).items():
        if k in ("regions", "openings", "entrance", "map", "landmark", "carpets", "daises", "objects"): L[k] = v
        else: errs.append(f"replace: unknown field \"{k}\".")
    return L, errs


prev = r0
for k in range(1, ROUNDS + 1):
    R = f"{G}/r{k}"; os.makedirs(R, exist_ok=True)
    L = json.load(open(f"{prev}/layout.json"))
    x2(f"{prev}/map.png", f"{R}/seen-map.png")
    content = [{"type": "text", "text": full_prompt(task)}, {"type": "image_url", "image_url": {"url": palette(task)}},
               {"type": "text", "text": "Your current layout:\n" + json.dumps(L, ensure_ascii=False)},
               {"type": "image_url", "image_url": {"url": img_url(f"{R}/seen-map.png")}},
               {"type": "image_url", "image_url": {"url": img_url(f"{prev}/layout.png")}},
               {"type": "text", "text": CRIT}]
    msgs = [{"role": "user", "content": content}]
    calls, chk, newL, critique = [], None, None, None
    for n in range(3):
        text, c = call(arm, msgs, f"{R}/call-{n}.json"); calls.append(c)
        msgs.append({"role": "assistant", "content": text})
        ans = parse(text)
        if not ans or "patch" not in ans:
            chk = {"ok": False, "errors": ["Your answer was not one parseable JSON object with \"problems\" and \"patch\"."], "warnings": []}
        else:
            critique = ans.get("problems")
            newL, perr = apply(L, ans["patch"])
            chk = lay(R, n, newL)
            if perr: chk = dict(chk, ok=False, errors=perr + chk["errors"])
        json.dump(chk, open(f"{R}/check-{n}.json", "w"), indent=1)
        print(f"crit {arm}{rep}/{task} r{k} call {n}: {c['secs']}s tok={c['tokens']} ok={chk['ok']} errors={len(chk['errors'])}", flush=True)
        if chk["ok"]: break
        if n < 2: msgs.append({"role": "user", "content": rejected_msg(chk, "answer JSON {\"problems\", \"patch\"} (the patch is applied to the same original layout)")})
    res = {"round": k, "ok": chk["ok"], "calls": calls, "problems": critique}
    if chk["ok"]:
        json.dump(newL, open(f"{R}/layout.json", "w"), indent=1)
        fin = lay(R, "final", newL, render=True); res["stats"] = {kk: v for kk, v in (fin.get("stats") or {}).items() if kk != "plan"}; res["warnings"] = fin.get("warnings")
    else:   # patch never validated: the round keeps the previous layout
        res["errors"] = chk["errors"][:20]; res["kept_previous"] = True
        for f in ["layout.json", "map.png"]: shutil.copy(f"{prev}/{f}", f"{R}/{f}")
    draw(f"{R}/layout.json", f"{R}/layout.png")
    json.dump(res, open(f"{R}/ROUND.json", "w"), ensure_ascii=False, indent=1)
    prev = R
print("done", G)
