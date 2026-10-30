#!/usr/bin/env python3
"""bbox-better scoring: Opus 5.5 medium, pairwise vs the same reference rooms as bbox-room (both orders, mapvqa.pairwise), 8 at a time.
  python3 scripts/experiments/bbox-better/judge.py     → $BBOX_RUNS/results-opus.json   key = "<run dir rel. to RUNS>|<anchor>"
Judges every <RUNS>/**/map.png under crit-*/<task>/r<k>, two-*/<task>, var-*/<task>. Baseline maps hit the shared judge cache."""
import json, os, sys, glob, concurrent.futures as cf
S = os.path.expanduser("~/z-project/assistant-whole-game/suite")
sys.path.insert(0, f"{S}/mapvqa")
import mapvqa
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import RUNS
KIND = {"boss": "dungeon", "inn": "room-hall"}
REQ = {"boss": "성 지하 깊은 곳, 마왕이 기다리는 던전 보스 방 / 던전 보스 방 하나", "inn": "작은 마을 여관 1층을 만들어 줘. 손님을 맞는 카운터와 밥 먹는 자리가 있는 곳이야. / 실내 방 하나"}
JUDGES = ["teamclaude/claude-opus-5-5@medium"]
f = f"{RUNS}/results-opus.json"
res = json.load(open(f)) if os.path.exists(f) else {}
pngs = sorted(glob.glob(f"{RUNS}/crit-*/*/r[0-9]/map.png") + glob.glob(f"{RUNS}/two-*/*/map.png") + glob.glob(f"{RUNS}/var-*/*/map.png"))
jobs = []
for g in pngs:
    run = os.path.relpath(os.path.dirname(g), RUNS); task = "inn" if "/inn" in run else "boss"
    for a in mapvqa.anchors_for(KIND[task]):
        k = f"{run}|{a['id']}"
        if k not in res: jobs.append((k, g, task, a))
print("jobs", len(jobs), flush=True)
def one(j):
    k, png, task, a = j
    per = mapvqa.pairwise(png, a["png"], KIND[task], REQ[task], judges=JUDGES)
    return k, {"run": k.split("|")[0], "anchor": a["id"], "judges": per, "verdict": mapvqa.majority(per, JUDGES)}
with cf.ThreadPoolExecutor(8) as ex:
    for k, v in ex.map(one, jobs):
        res[k] = v; json.dump(res, open(f, "w"), ensure_ascii=False, indent=1); print(k, v["verdict"], flush=True)
