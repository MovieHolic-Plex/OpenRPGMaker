#!/usr/bin/env python3
"""argon-plan scoring (Opus 5.5 medium, mapvqa.pairwise = both orders): every rendered map vs the bbox-walls reference rooms,
plus head-to-head argonB<r>/<task> vs argonA<r>/<task>. Writes $BW_RUNS/results.json (anchors) and h2h.json. Re-runnable (skips done keys).
  python3 scripts/experiments/argon-plan/judge.py"""
import json, os, sys, glob, threading, concurrent.futures as cf
S = os.path.expanduser("~/z-project/assistant-whole-game/suite")
sys.path.insert(0, f"{S}/mapvqa")
import mapvqa
RUNS = os.environ.get("BW_RUNS", f"{S}/rooms/runs-argonplan")
J = "teamclaude/claude-opus-5-5@medium"
KIND = {"inn": "room-hall", "library": "room-study", "jail": "room-other", "manor": "room-hall"}
REQ = {"inn": "village inn ground floor: hall with reception counter and dining, kitchen, stairs up, two guest rooms",
       "library": "old town library: book stacks hall, reading room, small side rooms",
       "jail": "town jail: guard room, corridor, prison cells", "manor": "noble manor ground floor: entrance hall, drawing room, dining room, kitchen, stairs up"}
fres, fh = f"{RUNS}/results.json", f"{RUNS}/h2h.json"
res = json.load(open(fres)) if os.path.exists(fres) else {}
h2h = json.load(open(fh)) if os.path.exists(fh) else {}
lock = threading.Lock(); jobs = []
for g in sorted(glob.glob(f"{RUNS}/argon[ABGJ][0-9]/*/map.png")):
    run = "/".join(g.split("/")[-3:-1]); task = run.split("/")[-1]
    for a in mapvqa.anchors_for(KIND[task]):
        if f"{run}|{a['id']}" not in res: jobs.append(("pair", run, g, task, a))
    if run.startswith("argonB"):
        ra = run.replace("argonB", "argonA"); ga = f"{RUNS}/{ra}/map.png"
        if not os.path.exists(ga):   # same-rep A has no map: pair with another A rep of the same place
            alt = sorted(glob.glob(f"{RUNS}/argonA[0-9]/{task}/map.png")); ga = alt[0] if alt else ga
        if os.path.exists(ga) and run not in h2h: jobs.append(("h2h", run, g, task, ga))
    if run.startswith("argonG"):   # round 2: G vs A (round 1 control) and G vs J (grid as JSON, no picture)
        for other in ("argonA", "argonJ"):
            key = f"{other[-1]}:{run}"
            if key in h2h: continue
            go = f"{RUNS}/{run.replace('argonG', other)}/map.png"
            if not os.path.exists(go):
                alt = sorted(glob.glob(f"{RUNS}/{other}[0-9]/{task}/map.png")); go = alt[0] if alt else go
            if os.path.exists(go): jobs.append(("h2h", key, g, task, go))
print("jobs", len(jobs), flush=True)
def one(j):
    kind, run, png, task, a = j
    if kind == "pair":
        per = mapvqa.pairwise(png, a["png"], KIND[task], REQ[task], judges=[J])
        return kind, f"{run}|{a['id']}", {"run": run, "anchor": a["id"], "judges": per, "verdict": mapvqa.majority(per, [J])}
    per = mapvqa.pairwise(png, a, KIND[task], REQ[task], judges=[J])   # x = B, y = A; +1 = B better
    return kind, run, {"b": "/".join(png.split("/")[-3:-1]), "a": "/".join(a.split("/")[-3:-1]), "judges": per, "verdict": mapvqa.majority(per, [J])}
with cf.ThreadPoolExecutor(8) as ex:
    for kind, k, v in ex.map(one, jobs):
        with lock:
            (res if kind == "pair" else h2h)[k] = v
            json.dump(res, open(fres, "w"), ensure_ascii=False, indent=1); json.dump(h2h, open(fh, "w"), ensure_ascii=False, indent=1)
        print(kind, k, v.get("verdict"), flush=True)
