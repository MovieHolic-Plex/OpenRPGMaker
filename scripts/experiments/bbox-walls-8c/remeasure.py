#!/usr/bin/env python3
"""Re-measure earlier rounds' final layouts with the round-5 validator (metrics only; no render).
  python3 scripts/experiments/bbox-walls-8c/remeasure.py <round-root> <out.json>   (from the worktree root)"""
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
root, out = sys.argv[1], sys.argv[2]
HOME = os.path.expanduser("~"); RUNS = os.environ.get("BW_RUNS", f"{HOME}/z-project/assistant-whole-game/suite/rooms/runs-bboxwalls8c")
import re
jobs = [(k, t) for k in sorted(os.listdir(root)) if re.fullmatch(r"(sol|terra|astra)\d", k) for t in ("inn", "library", "jail", "manor") if os.path.exists(f"{root}/{k}/{t}/layout.json")]
def one(j):
    k, t = j
    p = subprocess.run(["bun", "scripts/experiments/bbox-walls-8c/lay.mts", f"{root}/{k}/{t}/layout.json", f"/tmp/bw5-remeasure/{os.path.basename(root)}/{k}/{t}", f"{RUNS}/base", "--task", t, "--cats", f"{RUNS}/cats-{t}.json"],
                       capture_output=True, text=True, env=dict(os.environ, BW_LENIENT_VDOOR="1", OPRN_SHARED_CONTENT_SQLITE=f"{RUNS}/shared-content.sqlite"))
    try: d = json.loads(p.stdout.strip().splitlines()[-1]); return f"{k}/{t}", (d.get("stats") or {}).get("measure")
    except Exception: return f"{k}/{t}", None
with ThreadPoolExecutor(8) as ex: res = dict(ex.map(one, jobs))
json.dump({k: v for k, v in res.items() if v}, open(out, "w"), indent=1)
print(out, sum(1 for v in res.values() if v), "/", len(res))
