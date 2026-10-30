#!/usr/bin/env python3
"""bbox-room-test scoring: same judge/prompt as img-room-test (mapvqa.pairwise vs reference rooms of the same kind).
  python3 judge.py   → $BBOX_RUNS/results.json    boss → dungeon anchors (bdv 5), inn → room-hall anchors."""
import json, os, sys, glob, concurrent.futures as cf
S = os.path.expanduser("~/z-project/assistant-whole-game/suite")
sys.path.insert(0, f"{S}/mapvqa")
import mapvqa
RUNS = os.environ.get("BBOX_RUNS", f"{S}/rooms/runs-bboxroom")
KIND = {"boss": "dungeon", "inn": "room-hall"}
REQ = {"boss": "성 지하 깊은 곳, 마왕이 기다리는 던전 보스 방 / 던전 보스 방 하나", "inn": "작은 마을 여관 1층을 만들어 줘. 손님을 맞는 카운터와 밥 먹는 자리가 있는 곳이야. / 실내 방 하나"}
f = f"{RUNS}/results.json"
res = json.load(open(f)) if os.path.exists(f) else {}
jobs = []
for g in sorted(glob.glob(f"{RUNS}/*[0-9]/*/map.png")):
    run = "/".join(g.split("/")[-3:-1]); task = run.split("/")[1]
    for a in mapvqa.anchors_for(KIND[task]):
        k = f"{run}|{a['id']}"
        if k not in res: jobs.append((k, g, task, a))
print("jobs", len(jobs), mapvqa.JUDGES, flush=True)
def one(j):
    k, png, task, a = j
    per = mapvqa.pairwise(png, a["png"], KIND[task], REQ[task], judges=mapvqa.JUDGES)
    return k, {"run": k.split("|")[0], "anchor": a["id"], "judges": per, "verdict": mapvqa.majority(per, mapvqa.JUDGES)}
with cf.ThreadPoolExecutor(6) as ex:
    for k, v in ex.map(one, jobs):
        res[k] = v; json.dump(res, open(f, "w"), ensure_ascii=False, indent=1); print(k, v["verdict"], flush=True)
