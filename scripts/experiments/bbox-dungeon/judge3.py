#!/usr/bin/env python3
"""bbox-dungeon round 3+ scoring (vs refs, vs round 2, vs v2): Opus 5.5 medium, mapvqa.pairwise (both orders). Every round-2 run vs the 5 reference dungeons,
vs the round-1 run of the same brief/arm/rep, and vs the v2 builder maps (sol, terra) of the same brief. v2 cave maps vs references.
  BBOX_RUNSN=<runs dir> python3 judge3.py   → <runs dir>/results.json (re-runnable, skips done keys)"""
import json, os, sys, glob, concurrent.futures as cf
S = os.path.expanduser("~/z-project/assistant-whole-game/suite")
sys.path.insert(0, f"{S}/mapvqa")
import mapvqa
R1 = f"{S}/rooms/runs-bboxdungeon"; R2 = f"{S}/rooms/runs-bboxdungeon2"
RUNS = os.environ.get("BBOX_RUNSN", f"{S}/rooms/runs-bboxdungeon3")
PREV = os.environ.get("BBOX_PREV", R2); PREVTAG = os.environ.get("BBOX_PREVTAG", "r2")
REQ = {"crypt": "교회 지하 지하 묘지 던전 한 층", "flooded": "물에 잠긴 동굴 속 옛 신전 던전 한 층", "demon": "마왕성 지하 던전 한 층", "cave": "사람 손이 닿지 않은 자연 동굴 던전 한 층"}
JUDGES = ["teamclaude/claude-opus-5-5@medium"]
SHARD = os.environ.get("BBOX_SHARD", "")   # "k/n": this process takes every n-th job, writes results-s<k>.json
f = f"{RUNS}/results.json" if not SHARD else f"{RUNS}/results-s{SHARD.split('/')[0]}.json"
res = json.load(open(f)) if os.path.exists(f) else {}
done_any = set()
for o in glob.glob(f"{RUNS}/results*.json"): done_any |= set(json.load(open(o)))
anchors = mapvqa.anchors_for("dungeon")
def v2png(v, brief): return f"{R2}/{v}/{brief}/map.png" if brief == "cave" else f"{R1}/{v}/{brief}/map.png"
jobs = []
for g in sorted(glob.glob(f"{RUNS}/*/*/map.png")):
    run = "/".join(g.split("/")[-3:-1]); armrep, brief = run.split("/")
    opp = [(a["id"], a["png"]) for a in anchors]
    if "v2" not in armrep:
        pp = f"{PREV}/{armrep}/{brief}/map.png"
        if armrep.startswith("opus"): pp = f"{PREV}/sol{armrep[4:]}/{brief}/map.png"   # opus stands in for sol in round 4 → compare with the previous round's sol run
        if not os.path.exists(pp) and armrep.endswith("2"): pp = f"{PREV}/{armrep[:-1]}1/{brief}/map.png"   # argon has one previous-round baseline run
        opp += [(f"{PREVTAG}:{armrep}", pp)]
        opp += [(f"v2:{v}", v2png(v, brief)) for v in ("solv2", "terrav2")]
    for oid, png in opp:
        k = f"{run}|{oid}"
        if k not in res and k not in done_any and os.path.exists(png): jobs.append((k, g, brief, png))
if SHARD: a, n = map(int, SHARD.split("/")); jobs = jobs[a::n]
print("jobs", len(jobs), flush=True)
def one(j):
    k, png, brief, other = j
    per = mapvqa.pairwise(png, other, "dungeon", REQ[brief], judges=JUDGES)
    return k, {"run": k.split("|")[0], "vs": k.split("|")[1], "judges": per, "verdict": mapvqa.majority(per, JUDGES)}
with cf.ThreadPoolExecutor(4) as ex:
    for k, v in ex.map(one, jobs):
        res[k] = v; json.dump(res, open(f, "w"), ensure_ascii=False, indent=1); print(k, v["verdict"], flush=True)
