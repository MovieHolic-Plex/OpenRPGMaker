#!/usr/bin/env python3
"""bbox-walls-2 scoring (same judge, references and wall prompt as bbox-walls) (Opus 5.5 medium): (1) mapvqa.pairwise vs reference rooms, both orders; (2) a wall-quality score per map
(also for the bbox-room baseline inn maps). Writes $BW_RUNS/results.json and walls.json. 8 calls at a time."""
import json, os, sys, glob, threading, concurrent.futures as cf
S = os.path.expanduser("~/z-project/assistant-whole-game/suite")
sys.path.insert(0, f"{S}/mapvqa")
import mapvqa
RUNS = os.environ.get("BW_RUNS", f"{S}/rooms/runs-bboxwalls8")
J = "teamclaude/claude-opus-5-5@medium"
KIND = {"inn": "room-hall", "library": "room-study", "jail": "room-other", "manor": "room-hall"}
REQ = {"inn": "village inn ground floor: hall with reception counter and dining, kitchen, stairs up, two guest rooms",
       "library": "old town library: book stacks hall, reading room, small side rooms",
       "jail": "town jail: guard room, corridor, prison cells", "manor": "noble manor ground floor: entrance hall, drawing room, dining room, kitchen, stairs up"}
WALL_PROMPT = """You judge only the WALLS and room structure of a 16px 3/4 top-down RPG interior map (walls show a 2-row face on their south side; dark cells are wall tops/void).
Request: {req}
Look for: gaps in walls that are not real doorways; partitions that stop short; wall pieces (fireplace, shelves, beds, windows, signs) floating mid-room instead of standing against or hanging on a wall face; rooms that are plain boxes side by side or one open hall instead of distinct rooms joined by doors; a building outline with architectural shape.
Score walls 0-10 (10 = every room closed, doors only where meant, every wall piece on a wall, convincing architecture). Write no files. Last line: one JSON only:
{{"walls": 0-10, "rooms": <number of distinct enclosed rooms>, "gaps": <unintended wall gaps>, "floating": <wall pieces not on a wall>, "why": "one line"}}"""
fres, fwall = f"{RUNS}/results.json", f"{RUNS}/walls.json"
res = json.load(open(fres)) if os.path.exists(fres) else {}
wal = json.load(open(fwall)) if os.path.exists(fwall) else {}
lock = threading.Lock()
jobs = []
for g in sorted(glob.glob(f"{RUNS}/*[0-9]/*/map.png")):
    run = "/".join(g.split("/")[-3:-1]); task = run.split("/")[-1]
    for a in mapvqa.anchors_for(KIND[task]):
        if f"{run}|{a['id']}" not in res: jobs.append(("pair", run, g, task, a))
    if run not in wal: jobs.append(("wall", run, g, task, None))
print("jobs", len(jobs), flush=True)
def one(j):
    kind, run, png, task, a = j
    if kind == "pair":
        per = mapvqa.pairwise(png, a["png"], KIND[task], REQ[task], judges=[J])
        return kind, f"{run}|{a['id']}", {"run": run, "anchor": a["id"], "judges": per, "verdict": mapvqa.majority(per, [J])}
    r = mapvqa.ask(J, WALL_PROMPT.format(req=REQ[task]), [png], "walls")
    return kind, run, dict(r.get("result") or {}, failed=r.get("result") is None)
with cf.ThreadPoolExecutor(8) as ex:
    for kind, k, v in ex.map(one, jobs):
        with lock:
            (res if kind == "pair" else wal)[k] = v
            json.dump(res, open(fres, "w"), ensure_ascii=False, indent=1); json.dump(wal, open(fwall, "w"), ensure_ascii=False, indent=1)
        print(kind, k, v.get("verdict", v.get("walls")), flush=True)
