#!/usr/bin/env python3
"""bbox-village scoring (Opus 5.5 medium, mapvqa.pairwise both orders): every run (bbox and baseline) vs the 8 town anchors, and every bbox run vs both baselines of its brief.
  python3 judge.py → $BBOX_RUNS/results-opus.json"""
import json, os, sys, glob, concurrent.futures as cf
S = os.path.expanduser("~/z-project/assistant-whole-game/suite")
sys.path.insert(0, f"{S}/mapvqa")
import mapvqa
RUNS = os.environ.get("BBOX_RUNS", f"{S}/rooms/runs-bboxvillage")
JUDGES = ["teamclaude/claude-opus-5-5@medium"]
B = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "briefs.json")))
f = f"{RUNS}/results-opus.json"
res = json.load(open(f)) if os.path.exists(f) else {}
jobs = []
runs = {"/".join(g.split("/")[-3:-1]): g for g in glob.glob(f"{RUNS}/*/*/map.png") if not g.split("/")[-3].startswith("_")}
for run, png in sorted(runs.items()):
    brief = run.split("/")[1]
    for a in mapvqa.anchors_for("town"):
        k = f"{run}|{a['id']}"
        if k not in res: jobs.append((k, png, a["png"], brief))
    if not run.startswith("base"):
        for arm in ("base-sol", "base-terra"):
            o = f"{arm}/{brief}"
            if o in runs and f"{run}|{o}" not in res: jobs.append((f"{run}|{o}", png, runs[o], brief))
print("jobs", len(jobs), flush=True)
def one(j):
    k, x, y, brief = j
    per = mapvqa.pairwise(x, y, "town", B[brief]["ko"], judges=JUDGES)
    return k, {"run": k.split("|")[0], "vs": k.split("|")[1], "judges": per, "verdict": mapvqa.majority(per, JUDGES)}
with cf.ThreadPoolExecutor(4) as ex:   # 2 orders each → 8 calls at a time
    for k, v in ex.map(one, jobs):
        res[k] = v; json.dump(res, open(f, "w"), ensure_ascii=False, indent=1); print(k, v["verdict"], flush=True)
