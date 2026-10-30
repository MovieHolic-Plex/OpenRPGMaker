#!/usr/bin/env python3
"""bbox-dungeon round 2 scoring: Opus 5.5 medium, mapvqa.pairwise (both orders). Every round-2 run vs the 5 reference dungeons,
vs the round-1 run of the same brief/arm/rep, and vs the v2 builder maps (sol, terra) of the same brief. v2 cave maps vs references.
  python3 judge2.py   → $BBOX_RUNS2/results.json (re-runnable, skips done keys)"""
import json, os, sys, glob, concurrent.futures as cf
S = os.path.expanduser("~/z-project/assistant-whole-game/suite")
sys.path.insert(0, f"{S}/mapvqa")
import mapvqa
R1 = f"{S}/rooms/runs-bboxdungeon"
RUNS = os.environ.get("BBOX_RUNS2", f"{S}/rooms/runs-bboxdungeon2")
REQ = {"crypt": "교회 지하 지하 묘지 던전 한 층", "flooded": "물에 잠긴 동굴 속 옛 신전 던전 한 층", "demon": "마왕성 지하 던전 한 층", "cave": "사람 손이 닿지 않은 자연 동굴 던전 한 층"}
JUDGES = ["teamclaude/claude-opus-5-5@medium"]
f = f"{RUNS}/results.json"
res = json.load(open(f)) if os.path.exists(f) else {}
anchors = mapvqa.anchors_for("dungeon")
def v2png(v, brief): return f"{RUNS}/{v}/{brief}/map.png" if brief == "cave" else f"{R1}/{v}/{brief}/map.png"
jobs = []
for g in sorted(glob.glob(f"{RUNS}/*/*/map.png")):
    run = "/".join(g.split("/")[-3:-1]); armrep, brief = run.split("/")
    opp = [(a["id"], a["png"]) for a in anchors]
    if "v2" not in armrep:
        opp += [(f"r1:{armrep}", f"{R1}/{armrep}/{brief}/map.png")]
        opp += [(f"v2:{v}", v2png(v, brief)) for v in ("solv2", "terrav2")]
    for oid, png in opp:
        k = f"{run}|{oid}"
        if k not in res and os.path.exists(png): jobs.append((k, g, brief, png))
print("jobs", len(jobs), flush=True)
def one(j):
    k, png, brief, other = j
    per = mapvqa.pairwise(png, other, "dungeon", REQ[brief], judges=JUDGES)
    return k, {"run": k.split("|")[0], "vs": k.split("|")[1], "judges": per, "verdict": mapvqa.majority(per, JUDGES)}
with cf.ThreadPoolExecutor(4) as ex:
    for k, v in ex.map(one, jobs):
        res[k] = v; json.dump(res, open(f, "w"), ensure_ascii=False, indent=1); print(k, v["verdict"], flush=True)
