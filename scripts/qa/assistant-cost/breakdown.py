#!/usr/bin/env python3
"""Where an assistant run's tokens and money go — from the per-request log the local CLI loop already writes.

  python3 scripts/qa/assistant-cost/breakdown.py <glob of session/turns/*.json> [...] [--json out.json]

Every turns/*.json `done[].stats.exposure.requests[]` row is one model call (cacheRead, cacheWrite, input, tools).
Cost uses Opus 5.5 list prices per MTok (input $4, output $20, cache read $0.20, cache write 5m $5) — do not trust
stats.costUsd from runs before 2026-11-01: it summed Claude Code's cumulative total_cost_usd per turn (2–9× too high).
Buckets:
  r_prefix      re-reading the fixed prefix (system prompt + tool list = the first call's context) on later calls
  r_hist        re-reading the conversation history above that prefix
  w_first       writing the prefix once per CLI session
  w_miss_load   full cache rewrite on the call after load_tools (the tool list changed → prefix invalid)
  w_miss_other  other full rewrites (forced/declared tools, fresh-context rounds, polish session)
  w_compact     partial rewrite after the CLI trimmed old history
  w_new         new history written once (tool results, tool-call args, text)
  out           output tokens (thinking, tool arguments, text)
"""
import collections, glob, json, sys

PRICE = dict(inp=4e-6, out=20e-6, read=0.2e-6, write=5e-6)


def split(files):
    s = collections.Counter(); runs = calls = 0; tools = collections.Counter(); kinds = collections.Counter(); tokens = 0
    for f in files:
        d = json.load(open(f))
        for dn in d.get("done") or []:
            st = dn.get("stats") or {}; R = (st.get("exposure") or {}).get("requests") or []
            if not R:
                continue
            runs += 1; calls += len(R); u = st.get("usage") or {}
            s["out"] += u.get("output", 0) * PRICE["out"]; s["inp"] += u.get("input", 0) * PRICE["inp"]
            ctx = [r["cacheRead"] + r["cacheWrite"] + r["input"] for r in R]; P = ctx[0]; tokens += sum(ctx) + u.get("output", 0)
            for i, r in enumerate(R):
                tools.update(r["tools"])
                t = r["tools"]
                kinds["todo-only" if t and all(x == "todo" for x in t) else "text-only" if not t else "other"] += 1
                if i == 0:
                    s["w_first"] += r["cacheWrite"] * PRICE["write"]; continue
                if r["cacheRead"] == 0:
                    s["w_miss_load" if "load_tools" in R[i - 1]["tools"] else "w_miss_other"] += r["cacheWrite"] * PRICE["write"]
                    continue
                s["w_compact" if r["cacheRead"] < ctx[i - 1] * 0.9 else "w_new"] += r["cacheWrite"] * PRICE["write"]
                s["r_prefix"] += min(P, r["cacheRead"]) * PRICE["read"]; s["r_hist"] += max(0, r["cacheRead"] - P) * PRICE["read"]
    total = sum(s.values())
    return dict(runs=runs, calls=calls, tokens=tokens, total=round(total, 2), split={k: round(v, 2) for k, v in s.items()},
                kinds=dict(kinds), tools=tools.most_common(15))


if __name__ == "__main__":
    args = sys.argv[1:]; out = None
    if "--json" in args:
        i = args.index("--json"); out = args[i + 1]; del args[i:i + 2]
    files = sorted({f for a in args for f in glob.glob(a)})
    r = split(files)
    print(json.dumps(r, indent=1, ensure_ascii=False))
    if out:
        json.dump(r, open(out, "w"), ensure_ascii=False)
