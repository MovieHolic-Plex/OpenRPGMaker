#!/usr/bin/env python3
"""Assistant cost A/B — per-arm medians: list-price cost, processed tokens, model calls, tool calls, minutes, playthrough, judge.

  python3 scripts/qa/assistant-cost/measure.py <batch dir> <base arm> <arm> [<arm>…]   → prints a table, writes <batch>/measure.json

Cost/tokens come from the per-request cache log (breakdown.py buckets), never from stats.costUsd. Playthrough = walk.json checks
passed/total in the shipped player. Judge = ab2/judge.py pairwise (both orders) of each arm vs the base arm on the same mechanic+rep.
"""
import glob, json, os, statistics, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from breakdown import split  # noqa: E402

L, BASE, ARMS = sys.argv[1], sys.argv[2], sys.argv[3:]


def run_row(arm, d):
    turns = sorted(glob.glob(f"{d}/session/turns/*.json"))
    b = split(turns)
    ms = tools = 0
    for f in turns:
        t = json.load(open(f))
        ms += t.get("elapsedMs") or 0
        tools += sum(1 for c in t.get("toolCalls") or [] if c.get("type") == "tool_end")
    w = f"{L}/walk/{arm}-{os.path.basename(d)}/walk.json"
    walk = json.load(open(w)) if os.path.exists(w) else None
    checks = walk["checks"] if walk else []
    return dict(run=os.path.basename(d), cost=b["total"], tokens=b["tokens"], calls=b["calls"], tools=tools, min=round(ms / 60000, 1),
                split=b["split"], walk=None if walk is None else [sum(c["pass"] for c in checks), len(checks)],
                capped="deadline" in open(f"{d}/RUN.txt").read() and not turns,
                nostats=bool(turns) and b["calls"] == 0)  # turn hit the cap: the client never got done stats, so cost is unknown


def med(xs):
    xs = [x for x in xs if x is not None]
    return round(statistics.median(xs), 2) if xs else None


out = {"base": BASE, "arms": {}}
for arm in [BASE, *ARMS]:
    rows = [run_row(arm, d) for d in sorted(glob.glob(f"{L}/{arm}/*-*")) if os.path.exists(f"{d}/RUN.txt") and "finished=" in open(f"{d}/RUN.txt").read()]
    walks = [r["walk"] for r in rows if r["walk"]]
    known = [r for r in rows if not r["nostats"]]
    out["arms"][arm] = dict(n=len(rows), nostats=[r["run"] for r in rows if r["nostats"]], cost=med([r["cost"] for r in known]),
                            costSum=round(sum(r["cost"] for r in known), 2),
                            tokens=med([r["tokens"] for r in known]), calls=med([r["calls"] for r in known]), tools=med([r["tools"] for r in rows]),
                            min=med([r["min"] for r in rows]), walk=[sum(w[0] for w in walks), sum(w[1] for w in walks)], rows=rows)
for arm in ARMS:
    wins = {"arm": 0, "base": 0, "tie": 0}; corr = {"arm": [], "base": []}
    for f in glob.glob(f"{L}/judge/*-{arm}-{BASE}.json"):
        for r in json.load(open(f)):
            wins["arm" if r["winner"] == arm else "base" if r["winner"] == BASE else "tie"] += 1
            for side, name in (("arm", arm), ("base", BASE)):
                c = (r.get("correctness") or {}).get(name)
                if isinstance(c, (int, float)):
                    corr[side].append(c)
    out["arms"][arm]["judge"] = dict(wins=wins, correctness={k: med(v) for k, v in corr.items()})
# paired cost: only runs every arm has cost for (a capped run has no stats and would look free)
common = set.intersection(*[{r["run"] for r in a["rows"] if not r["nostats"]} for a in out["arms"].values()])
for a in out["arms"].values():
    a["pairedSum"] = round(sum(r["cost"] for r in a["rows"] if r["run"] in common), 2)
out["paired"] = sorted(common)
json.dump(out, open(f"{L}/measure.json", "w"), ensure_ascii=False, indent=1)
print(f"{'arm':10} {'n':>2} {'cost$':>6} {'sum$':>6} {'tokens':>9} {'calls':>6} {'tools':>6} {'min':>5} {'walk':>7} {'paired$':>8}  judge(vs {BASE})")
for arm, a in out["arms"].items():
    j = a.get("judge")
    js = f"win {j['wins']['arm']} lose {j['wins']['base']} tie {j['wins']['tie']} · correctness {j['correctness']['arm']} vs {j['correctness']['base']}" if j else ""
    print(f"{arm:10} {a['n']:>2} {a['cost'] or 0:>6} {a['costSum']:>6} {a['tokens'] or 0:>9} {a['calls'] or 0:>6} {a['tools'] or 0:>6} {a['min'] or 0:>5} {a['walk'][0]:>3}/{a['walk'][1]:<3} {a['pairedSum']:>8}  {js}" + (f"  no-stats: {','.join(a['nostats'])}" if a["nostats"] else ""))
print(f"paired$ = cost sum over runs with stats in every arm: {', '.join(out['paired'])}")
