#!/usr/bin/env python3
"""bbox-chipsets round 2 setup (run from the worktree root):
  python3 scripts/experiments/bbox-chipsets/prep.py [place ...]
1. $BBOX_RUNS gets its own shared-content copy (from round 1's copy — never ~/.local/share/oprn), refs and translation caches.
2. pool.py merges whatever exists in objpool/<chipset>/ into $BBOX_RUNS/base (re-run to pick up newer pool pieces).
3. catalog.mts / outdoor_catalog.mts + catalog.py build catalog-<place>.txt, palette-<place>.png, index-<place>.json."""
import os, shutil, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from places import PLACES
H = os.path.expanduser("~"); S = f"{H}/z-project/assistant-whole-game/suite/rooms"
R1 = f"{S}/runs-bbox-chipsets"; RUNS = os.environ.get("BBOX_RUNS", f"{S}/runs-bbox-chipsets-2"); POOL = f"{S}/objpool"
os.makedirs(f"{RUNS}/cat", exist_ok=True)
if not os.path.exists(f"{RUNS}/shared-content.sqlite"): shutil.copy(f"{R1}/shared-content.sqlite", f"{RUNS}/shared-content.sqlite")
if not os.path.exists(f"{RUNS}/refs"): shutil.copytree(f"{R1}/refs", f"{RUNS}/refs")
for f in os.listdir(f"{R1}/cat"):
    if f.startswith("en-") and not os.path.exists(f"{RUNS}/cat/{f}"): shutil.copy(f"{R1}/cat/{f}", f"{RUNS}/cat/{f}")
if os.path.exists(f"{RUNS}/base/before.json"): os.remove(f"{RUNS}/base/before.json")
print(subprocess.run(["python3", "scripts/experiments/bbox-chipsets/pool.py", f"{R1}/base", POOL, f"{RUNS}/base"], capture_output=True, text=True, check=True).stdout.strip())
env = dict(os.environ, OPRN_SHARED_CONTENT_SQLITE=f"{RUNS}/shared-content.sqlite", BBOX_POOL_DIR=f"{RUNS}/base/pool", BBOX_RUNS=RUNS)
for place in sys.argv[1:] or PLACES:
    P = PLACES[place]; raw = f"{RUNS}/cat/{place}.raw.json"
    if P.get("mode") == "outdoor":
        cmd = ["bun", "scripts/experiments/bbox-chipsets/outdoor_catalog.mts", f"{RUNS}/base", P["tileset"], raw, "--query", P["query"], "--max", str(P["max"])]
    else:
        cmd = ["bun", "scripts/experiments/bbox-chipsets/catalog.mts", f"{RUNS}/base", P["tileset"], raw, "--rooms", P["rooms"], "--query", P["query"], "--max", str(P["max"])]
    r = subprocess.run(cmd, capture_output=True, text=True, env=env); print(place, (r.stdout or r.stderr).strip().splitlines()[-1][:300])
    r = subprocess.run(["python3", "scripts/experiments/bbox-chipsets/catalog.py", place, raw, f"{RUNS}/cat"], capture_output=True, text=True, env=env)
    print(place, (r.stdout or r.stderr).strip().splitlines()[-1][:300])
