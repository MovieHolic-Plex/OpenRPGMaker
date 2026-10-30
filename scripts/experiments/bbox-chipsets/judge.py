#!/usr/bin/env python3
"""bbox-chipsets scoring: Opus 5.5 medium, pairwise (both orders) vs that chipset's own example maps (refs/<name>.png).
  python3 judge.py   → $BBOX_RUNS/results-opus.json  (incremental; 8 pairwise jobs at a time)"""
import json, os, sys, glob, concurrent.futures as cf
S = os.path.expanduser("~/z-project/assistant-whole-game/suite")
sys.path.insert(0, f"{S}/mapvqa"); sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapvqa
from places import PLACES
RUNS = os.environ.get("BBOX_RUNS", f"{S}/rooms/runs-bbox-chipsets")
JUDGES = ["teamclaude/claude-opus-5-5@medium"]
f = f"{RUNS}/results-opus.json"
res = json.load(open(f)) if os.path.exists(f) else {}
jobs = []
for g in sorted(glob.glob(f"{RUNS}/*[0-9]/*/map.png")):
    run = "/".join(g.split("/")[-3:-1]); place = run.split("/")[-1]
    for a in PLACES[place]["anchors"]:
        name = a.split(":")[1]; k = f"{run}|{name}"
        if k not in res: jobs.append((k, g, place, f"{RUNS}/refs/{name}.png"))
print("jobs", len(jobs), flush=True)
def one(j):
    k, png, place, ref = j
    per = mapvqa.pairwise(png, ref, PLACES[place]["kind"], PLACES[place]["request"], judges=JUDGES)
    return k, {"run": k.split("|")[0], "anchor": k.split("|")[1], "judges": per, "verdict": mapvqa.majority(per, JUDGES)}
with cf.ThreadPoolExecutor(8) as ex:
    for k, v in ex.map(one, jobs):
        res[k] = v; json.dump(res, open(f, "w"), ensure_ascii=False, indent=1); print(k, v["verdict"], flush=True)
