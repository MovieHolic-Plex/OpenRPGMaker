#!/usr/bin/env python3
"""Lead/worker split battery — for each judged run, list the events the run created or changed (vs its stage checkpoint)
and write <batch>/shots/<arm>__<task>__<rep>/{run.json,events.json} for ../script-ab/ab2/capture-event-lists.mjs."""
import glob, json, os, sys
L = sys.argv[1]
P = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "prompts.json")))
CP = {t["id"]: t["cp"] for t in P["tasks"]}
base = {}
def evmap(p):
    out = {}
    maps = p["maps"] if isinstance(p["maps"], list) else list(p["maps"].values())
    for m in maps:
        for e in m.get("events") or []: out[f"map:{m['id']}:{e['id']}"] = json.dumps(e.get("pages"), sort_keys=True)
    for c in p.get("commonEvents") or []: out[f"common:{c['id']}"] = json.dumps(c.get("commands"), sort_keys=True)
    return out
for pulled in sorted(glob.glob(f"{L}/*/*/.pulled")):
    d = os.path.dirname(pulled); arm = os.path.basename(os.path.dirname(d)); task, rep = os.path.basename(d).rsplit("-", 1)
    tag = f"{arm}__{task}__{rep}"; sd = f"{L}/shots/{tag}"
    if os.path.exists(f"{sd}/events.json") or not os.path.exists(f"{d}/check/project.json"): continue
    cp = CP[task]
    if cp not in base: base[cp] = evmap(json.load(open(f"{L}/checkpoints/{cp}/check/project.json")))
    p = json.load(open(f"{d}/check/project.json")); now = evmap(p)
    changed = [k for k, v in now.items() if base[cp].get(k) != v]
    ev = []
    for k in changed:
        parts = k.split(":", 2)
        ev.append({"mapId": parts[1], "eventId": parts[2]} if parts[0] == "map" else {"commonEventId": parts[1]})
    os.makedirs(sd, exist_ok=True)
    p["tilesets"] = {}
    p["resourceProfiles"] = []; p["charsetLabels"] = []  # big and unused by the event list; the editor needs them iterable
    json.dump(p, open(f"{sd}/run.json", "w"), ensure_ascii=False)
    json.dump(ev[:20], open(f"{sd}/events.json", "w"), ensure_ascii=False)
    print(tag, len(changed))
