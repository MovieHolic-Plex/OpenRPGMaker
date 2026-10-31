#!/usr/bin/env python3
"""argon-image-dungeon scoring: Opus 5.5 medium, mapvqa.pairwise (both orders; split orders = draw). Never Argon as judge.
Per brief: img (Argon dots from the picture) vs direct (Argon, no picture), vs Opus r4 #1/#2; direct vs Opus r4 #1/#2;
img and direct vs the 5 reference dungeons (the bbox-dungeon-2 「기준 대비」 rubric; Opus r4 already has those in runs-bboxdungeon4/results-s*.json).
  python3 judge.py   → $AID_RUNS/results.json (re-runnable, skips done keys)"""
import json, os, sys, glob, concurrent.futures as cf
S = os.path.expanduser("~/z-project/assistant-whole-game/suite")
sys.path.insert(0, f"{S}/mapvqa")
import mapvqa
RUNS = os.environ.get("AID_RUNS", f"{S}/rooms/runs-argonimg"); R4 = f"{S}/rooms/runs-bboxdungeon4"
REQ = {"crypt": "교회 지하 지하 묘지 던전 한 층", "flooded": "물에 잠긴 동굴 속 옛 신전 던전 한 층", "demon": "마왕성 지하 던전 한 층", "cave": "사람 손이 닿지 않은 자연 동굴 던전 한 층"}
JUDGES = ["teamclaude/claude-opus-5-5@medium"]
f = f"{RUNS}/results.json"
res = json.load(open(f)) if os.path.exists(f) else {}
anchors = mapvqa.anchors_for("dungeon")
jobs = []
for brief in REQ:
    png = lambda arm: f"{RUNS}/{arm}/{brief}/map.png"
    IMGS, DIRECT = ("img-r3", "img-grid-r3"), "direct-r3"   # the round-3 protocol (Fixed-call messages, up to 6 repairs); round 1/2 passed nothing
    pairs = [(a, DIRECT, png(a), png(DIRECT)) for a in IMGS]
    for a in (*IMGS, DIRECT):
        pairs += [(a, f"opus{r}", png(a), f"{R4}/opus{r}/{brief}/map.png") for r in (1, 2)]
        pairs += [(a, f"ref:{x['id']}", png(a), x["png"]) for x in anchors]
    for a, b, pa, pb in pairs:
        k = f"{a}/{brief}|{b}"
        if k not in res and os.path.exists(pa) and os.path.exists(pb): jobs.append((k, pa, pb, brief))
print("jobs", len(jobs), flush=True)
def one(j):
    k, pa, pb, brief = j
    per = mapvqa.pairwise(pa, pb, "dungeon", REQ[brief], judges=JUDGES)
    return k, {"run": k.split("|")[0], "vs": k.split("|")[1], "judges": per, "verdict": mapvqa.majority(per, JUDGES)}
with cf.ThreadPoolExecutor(4) as ex:
    for k, v in ex.map(one, jobs):
        res[k] = v; json.dump(res, open(f, "w"), ensure_ascii=False, indent=1); print(k, v["verdict"], flush=True)
