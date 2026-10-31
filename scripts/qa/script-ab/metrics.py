#!/usr/bin/env python3
"""Script A/B PoC — per-run metrics from the session logs.

  python3 scripts/qa/script-ab/metrics.py <out-root>   (writes <out-root>/metrics.json, prints a table)

Per run (<root>/<arm>/<prompt>-<rep>/session/turns/NNN.json, operator-sent requests only):
  tokens (input · output · cacheRead · cacheWrite), costUsd, model calls (stats.turns), wall ms,
  tool calls total / by family / failed, retries (same tool called again right after it failed), get_event count,
  script tool calls, distinct tools.
"""
import json, os, sys, glob, re

FAMILIES = [
    ("script", re.compile(r"script")),
    ("validate", re.compile(r"^(run_scene_test|simulate_battle|play_walkthrough|check_|validate|lint_|inspect_|verify|game_check|dry_run)")),
    ("event-read", re.compile(r"^(get_event|find_events|get_database_records|get_story_state|find_switch_usage|list_endings|read_npc_layout|list_|read_|get_)")),
    ("event-write", re.compile(r"^(upsert_event|patch_event_page|add_event_page|remove_event|move_event|upsert_common_event|declare_story_flag|define_ending|place_|set_|upsert_|add_|create_|configure_|author_|make_)")),
    ("map", re.compile(r"^(make_place|stamp_|fill_|paint|build_|edit_map|remove_map|link_)")),
    ("todo", re.compile(r"^(todo|load_tools|write_blueprint|report|finish)")),
]


def family(name):
    for fam, rx in FAMILIES:
        if rx.search(name):
            return fam
    return "other"


def run_metrics(d):
    turns = sorted(glob.glob(f"{d}/session/turns/*.json"))
    m = dict(input=0, output=0, cacheRead=0, cacheWrite=0, cost=0.0, modelCalls=0, ms=0, tools=0, failed=0, retries=0,
             getEvent=0, scriptCalls=0, byFamily={}, byTool={}, steps=0, failedTools={})
    for f in turns:
        t = json.load(open(f))
        if t.get("kind") != "txt":
            continue
        m["steps"] += 1
        m["ms"] += t.get("elapsedMs") or 0
        for dn in t.get("done") or []:
            s = dn.get("stats") or {}
            u = s.get("usage") or {}
            for k in ("input", "output", "cacheRead", "cacheWrite"):
                m[k] += u.get(k) or 0
            m["cost"] += s.get("costUsd") or 0
            m["modelCalls"] += s.get("turns") or 0
        prev_fail = None
        for c in t.get("toolCalls") or []:
            if c.get("type") != "tool_end":
                continue
            n = c.get("name") or "?"
            m["tools"] += 1
            m["byTool"][n] = m["byTool"].get(n, 0) + 1
            fam = family(n)
            m["byFamily"][fam] = m["byFamily"].get(fam, 0) + 1
            if n == "get_event":
                m["getEvent"] += 1
            if "script" in n:
                m["scriptCalls"] += 1
            ok = c.get("ok") is not False
            if not ok:
                m["failed"] += 1
                m["failedTools"][n] = m["failedTools"].get(n, 0) + 1
            if prev_fail == n:
                m["retries"] += 1
            prev_fail = None if ok else n
    m["tokensTotal"] = m["input"] + m["output"] + m["cacheRead"] + m["cacheWrite"]
    m["distinctTools"] = len(m["byTool"])
    return m


def main():
    root = sys.argv[1]
    rows = {}
    for d in sorted(glob.glob(f"{root}/*/*")):
        if not os.path.isdir(f"{d}/session"):
            continue
        arm, run = d.split("/")[-2:]
        rows[f"{arm}/{run}"] = run_metrics(d)
    json.dump(rows, open(f"{root}/metrics.json", "w"), ensure_ascii=False, indent=1)
    print(f"{'run':18} {'steps':>5} {'min':>5} {'calls':>5} {'out':>7} {'cacheR':>9} {'cacheW':>8} {'$':>6} {'tools':>5} {'fail':>4} {'retry':>5} {'getEv':>5} {'scr':>4}")
    for k, m in rows.items():
        print(f"{k:18} {m['steps']:5} {m['ms']/60000:5.1f} {m['modelCalls']:5} {m['output']:7} {m['cacheRead']:9} {m['cacheWrite']:8} {m['cost']:6.2f} {m['tools']:5} {m['failed']:4} {m['retries']:5} {m['getEvent']:5} {m['scriptCalls']:4}")


if __name__ == "__main__":
    main()
