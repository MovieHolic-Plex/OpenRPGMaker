#!/usr/bin/env python3
"""bbox-chipsets: same space/variety numbers for round 1 and round 2 maps (and the reference maps), with the round-2 functions.
  python3 metrics.py   (run from the worktree root) → $BBOX_RUNS/metrics.json {"r1|sol1/jp-house": {...}, "r2|...": {...}, "ref|house-1f": {...}}
emptyPct = bare floor % (indoor: no standing piece on or next to the cell; outdoor: bare walkable ground %), types = distinct piece kinds."""
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from places import PLACES
H = os.path.expanduser("~"); S = f"{H}/z-project/assistant-whole-game/suite/rooms"
R1 = f"{S}/runs-bbox-chipsets"; RUNS = os.environ.get("BBOX_RUNS", f"{S}/runs-bbox-chipsets-3")
ROUNDS = [("r1", R1), ("r2", f"{S}/runs-bbox-chipsets-2"), ("r3", f"{S}/runs-bbox-chipsets-3")]
f = f"{RUNS}/metrics.json"; M = json.load(open(f)) if os.path.exists(f) else {}
D = "scripts/experiments/bbox-chipsets"
def env(base): return dict(os.environ, OPRN_SHARED_CONTENT_SQLITE=f"{RUNS}/shared-content.sqlite", BBOX_POOL_DIR=f"{RUNS}/base/pool")
def last(p):
    try: return json.loads(p.stdout.strip().splitlines()[-1])
    except Exception: return {"error": (p.stderr or p.stdout)[-300:]}
jobs = []
for rnd, root in ROUNDS:
    for place, P in PLACES.items():
        for slot in ("sol1", "sol2", "terra1", "terra2"):
            lf = f"{root}/{slot}/{place}/layout.json"; k = f"{rnd}|{slot}/{place}"
            if not os.path.exists(f"{root}/{slot}/{place}/map.png") or (k in M and M[k].get("mtime") == os.path.getmtime(lf)): continue
            if P.get("mode") == "outdoor":
                cmd = ["bun", f"{D}/lay_outdoor.mts", P["tileset"], lf, f"/tmp/bbox2-metrics/{rnd}-{slot}-{place}", f"{RUNS}/base"]
            else:
                cmd = ["bun", f"{D}/measure.mts", "indoor-layout", P["tileset"], lf, f"{RUNS}/base"]
            jobs.append((k, cmd, P.get("mode") == "outdoor", os.path.getmtime(lf)))
for ex in [("house-1f", "jp_city", "tiledata/jp-city/interior/examples/house-1f.json"), ("hiraya", "jp_city", "tiledata/jp-city/interior/examples/hiraya.json"),
           ("mokuchin", "jp_city", "tiledata/jp-city/interior/examples/mokuchin.json"), ("konbini", "modern_city", "tiledata/modern-city/interior/examples/konbini.json"),
           ("cafe", "modern_city", "tiledata/modern-city/interior/examples/cafe.json"), ("bank", "modern_city", "tiledata/modern-city/interior/examples/bank.json")]:
    if f"ref|{ex[0]}" not in M: jobs.append((f"ref|{ex[0]}", ["bun", f"{D}/measure.mts", "indoor-example", ex[1], ex[2], f"{RUNS}/base"], False, 0))
for name, crop in (("jv20-compound", "7,0,21,25"), ("jv20-compound-wide", "0,0,32,30")):
    if f"ref|{name}" not in M: jobs.append((f"ref|{name}", ["bun", f"{D}/measure.mts", "outdoor-map", "joseon_baram", "src/project/regionReferences/joseon-village.json", f"{RUNS}/base", "joseon_v20", crop], False, 0))
def one(j):
    k, cmd, out, mt = j
    r = last(subprocess.run(cmd, capture_output=True, text=True, env=env(None)))
    if out: r = {**(r.get("stats") or {}), "errors": r.get("errors")}
    r["mtime"] = mt; return k, r
with ThreadPoolExecutor(6) as ex:
    for k, r in ex.map(one, jobs): M[k] = r; print(k, r.get("emptyPct"), r.get("types"), flush=True)
json.dump(M, open(f, "w"), indent=1)
