#!/usr/bin/env python3
"""Script A/B PoC — print a one-screen brief of a run's dump.json (events, pages, conditions, scripts)."""
import json, sys
d = json.load(open(sys.argv[1]))
print("start", d["start"], "vars", [f"{v['id']}:{v.get('name','')}" for v in d["variables"]], "sw", [f"{s['id']}:{s.get('name','')}" for s in d["switches"]])
print("items", d["items"])
for m in d["maps"]:
    print(" MAP", m["id"], m.get("name"), m["size"])
    for e in m["events"]:
        pages = []
        for p in e["pages"]:
            trig = p["trigger"].get("kind") if isinstance(p["trigger"], dict) else p["trigger"]
            pages.append(f"[{trig} cond={json.dumps(p['cond'], ensure_ascii=False)[:90]} kinds={p['kinds']} scripts={p['scripts']} lines={p['lines'][:2]}]")
        print("  ", e["id"], e.get("name"), e["at"], " ".join(pages)[:700])
