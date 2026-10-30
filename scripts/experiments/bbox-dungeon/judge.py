#!/usr/bin/env python3
"""bbox-dungeon scoring: Opus 5.5 medium, mapvqa.pairwise (both orders) of every bbox run vs the 5 dungeon reference maps
and vs the v2 builder maps of the same brief; v2 maps also vs the references (baseline). Re-runnable (skips done keys).
  python3 judge.py   → $BBOX_RUNS/results.json"""
import json, os, sys, glob, concurrent.futures as cf
S = os.path.expanduser("~/z-project/assistant-whole-game/suite")
sys.path.insert(0, f"{S}/mapvqa")
import mapvqa
RUNS = os.environ.get("BBOX_RUNS", f"{S}/rooms/runs-bboxdungeon")
REQ = {"crypt": "교회 지하 지하 묘지 던전 한 층", "flooded": "물에 잠긴 동굴 속 옛 신전 던전 한 층", "demon": "마왕성 지하 던전 한 층"}
JUDGES = ["teamclaude/claude-opus-5-5@medium"]
f = f"{RUNS}/" + os.environ.get("BBOX_RESULTS", "results.json")
res = json.load(open(f)) if os.path.exists(f) else {}
done_elsewhere = set()
for o in glob.glob(f"{RUNS}/results*.json"):
    if o != f: done_elsewhere |= set(json.load(open(o)))
skip_runs = set(os.environ.get("BBOX_SKIP_RUNS", "").split(","))
jobs = []
anchors = mapvqa.anchors_for("dungeon")
for g in sorted(glob.glob(f"{RUNS}/*/*/map.png")):
    run = "/".join(g.split("/")[-3:-1]); brief = run.split("/")[1]
    opp = [(a["id"], a["png"]) for a in anchors]
    if not run.startswith(("solv2", "terrav2")): opp += [(f"v2:{v}", p) for v in ("solv2", "terrav2") for p in [f"{RUNS}/{v}/{brief}/map.png"] if os.path.exists(p)]
    for oid, png in opp:
        k = f"{run}|{oid}"
        if k not in res and k not in done_elsewhere and run not in skip_runs: jobs.append((k, g, brief, png))
print("jobs", len(jobs), flush=True)
def one(j):
    k, png, brief, other = j
    per = mapvqa.pairwise(png, other, "dungeon", REQ[brief], judges=JUDGES)
    return k, {"run": k.split("|")[0], "vs": k.split("|")[1], "judges": per, "verdict": mapvqa.majority(per, JUDGES)}
with cf.ThreadPoolExecutor(4) as ex:   # 4 pairs × 2 orders = 8 concurrent judge calls
    for k, v in ex.map(one, jobs):
        res[k] = v; json.dump(res, open(f, "w"), ensure_ascii=False, indent=1); print(k, v["verdict"], flush=True)
