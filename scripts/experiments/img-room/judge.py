#!/usr/bin/env python3
"""img-room-test 채점: 판마다 같은 종류 기준 그림 전부와 mapvqa.pairwise(omo_judge 와 같은 판정자·같은 프롬프트) + B 판은 목업 충실도 한 번.
  python3 judge.py [runs dir]   → <runs>/results.json
종류: boss → dungeon(기준 bdv 5장, 보스 방 기준이 없어서), inn → room-hall(rooms2-28·29)."""
import json, os, sys, glob, concurrent.futures as cf
S = os.path.expanduser("~/z-project/assistant-whole-game/suite")
sys.path.insert(0, f"{S}/mapvqa")
import mapvqa
RUNS = sys.argv[1] if len(sys.argv) > 1 else f"{S}/rooms/runs-imgroom"
KIND = {"boss": "dungeon", "inn": "room-hall"}
REQ = {"boss": "성 지하 깊은 곳, 마왕이 기다리는 던전 보스 방 / 던전 보스 방 하나", "inn": "작은 마을 여관 1층을 만들어 줘. 손님을 맞는 카운터와 밥 먹는 자리가 있는 곳이야. / 실내 방 하나"}
FOLLOW = """Image 1 is a MOCKUP of a 16px RPG room drawn by an image model. Image 2 is the room an assistant actually built on the map from that mockup.
Judge only how faithfully image 2 follows image 1's design (not which looks better):
- outline: same overall room shape / parts (L or two-part shape, alcoves, side rooms, corridor)?
- zones: the same functional zones in roughly the same places (e.g. reception near entrance, dining area, kitchen alcove, antechamber, throne hall, treasure room)?
- landmark: the same landmark (fireplace / throne on dais / carpet runner…) in roughly the same place?
Answer JSON only: {"outline":0-10,"zones":0-10,"landmark":0-10,"overall":0-10,"why":"one or two sentences"}"""

def runs():
    out = []
    for g in sorted(glob.glob(f"{RUNS}/[ABG][0-9]/*/*")):
        cond, arm, task = g.split("/")[-3:]
        png = f"{g}/room/map.png"
        out.append(dict(dir=g, cond=cond[0], rep=int(cond[1:]), arm=arm, task=task, png=png if os.path.exists(png) else None,
                        mock=f"{g}/mockup.png" if os.path.exists(f"{g}/mockup.png") else None))
    return out

def main():
    f = f"{RUNS}/results.json"
    res = json.load(open(f)) if os.path.exists(f) else {}
    jobs = []
    for r in runs():
        if not r["png"]: continue
        for a in mapvqa.anchors_for(KIND[r["task"]]):
            k = f"{r['cond']}{r['rep']}/{r['arm']}/{r['task']}|{a['id']}"
            if k not in res: jobs.append(("pair", k, r, a))
        if r["mock"]:
            k = f"{r['cond']}{r['rep']}/{r['arm']}/{r['task']}|follow"
            if k not in res: jobs.append(("follow", k, r, None))
    print(f"jobs {len(jobs)} judges {mapvqa.JUDGES}")
    def one(job):
        kind, k, r, a = job
        if kind == "pair":
            per = mapvqa.pairwise(r["png"], a["png"], KIND[r["task"]], REQ[r["task"]], judges=mapvqa.JUDGES)
            return k, {"run": k.split("|")[0], "anchor": a["id"], "judges": per, "verdict": mapvqa.majority(per, mapvqa.JUDGES)}
        out = mapvqa.ask(mapvqa.JUDGES[0], FOLLOW, [r["mock"], r["png"]], f"follow-{k}")
        return k, {"run": k.split("|")[0], "follow": out.get("result"), "meta": out.get("meta"), "error": out.get("error")}
    with cf.ThreadPoolExecutor(6) as ex:
        for k, v in ex.map(one, jobs):
            res[k] = v; json.dump(res, open(f, "w"), ensure_ascii=False, indent=1)
    print("ok", len(res))

if __name__ == "__main__": main()
