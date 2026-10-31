#!/usr/bin/env python3
"""Script A/B 2 — collect per-run metrics, playthrough and judge results into one JSON (+ per-arm medians).

  python3 scripts/qa/script-ab/ab2/measure.py <batch dir> [--out ~/claude-viz/script-editor-live/measure.json]

Run rows come from <batch>/<arm>/<mech>-<rep>/ (session turns, RUN.txt, check/project.json), walk/<arm>-<mech>-<rep>/walk.json,
judge/<mech>-<rep>-<x>-<y>.json. The run is ONE logic request from a frozen stage checkpoint, so all usage numbers are that request.
Scripts written / reverted: distinct scripts the assistant authored (author_script by name, write_event_as_script and
upsert_script_module by target) that are absent from the final project.
"""
import json, os, sys, glob, statistics, datetime
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from metrics import run_metrics  # noqa: E402

ARMS = ["main", "off", "v1", "new"]  # v1 = a7456dd876 (first guidance), new = the next guidance PR
MECHS = ["escape", "village", "dungeon"]
WRITE_TOOLS = {"author_script", "write_event_as_script", "upsert_script_module"}


def script_cmds(v, acc):
    if isinstance(v, dict):
        if v.get("kind") == "script":
            acc.append(v)
        for x in v.values():
            script_cmds(x, acc)
    elif isinstance(v, list):
        for x in v:
            script_cmds(x, acc)
    return acc


def final_scripts(proj):
    if not os.path.exists(proj):
        return None
    p = json.load(open(proj))
    maps = p["maps"] if isinstance(p["maps"], list) else list(p["maps"].values())
    names, pages = set(), set()
    for m in maps:
        for e in m.get("events") or []:
            for i, pg in enumerate(e.get("pages") or []):
                found = script_cmds(pg, [])
                for c in found:
                    names.add(c.get("name") or "")
                if found:
                    pages.add(f'{e["id"]}/{i}')
    rest = script_cmds([p.get("commonEvents"), (p.get("database") or {}).get("troops")], [])
    names |= {c.get("name") or "" for c in rest}
    lib = p.get("scriptLibrary") or []
    lib_names = {x.get("name") or x.get("id") for x in (lib.values() if isinstance(lib, dict) else lib)}
    return {"count": sum(len(script_cmds(m.get("events") or [], [])) for m in maps) + len(rest), "names": names, "pages": pages, "modules": lib_names}


def script_writes(run_dir, final):
    written, ok_calls = set(), 0
    for f in sorted(glob.glob(f"{run_dir}/session/turns/*.json")):
        t = json.load(open(f))
        ok_calls += sum(1 for c in t.get("toolCalls") or [] if c.get("type") == "tool_end" and c.get("name") in WRITE_TOOLS and c.get("ok") is not False)
        for a in t.get("toolArgs") or []:
            n, g = a.get("name"), a.get("args") or {}
            if n == "author_script" and g.get("name"):
                written.add(("name", g["name"]))
            elif n == "write_event_as_script":
                written.add(("page", f'{g.get("eventId")}/{g.get("pageIndex", 0)}'))
            elif n == "upsert_script_module":
                written.add(("module", g.get("name") or g.get("id")))
    if final is None:
        return ok_calls, len(written), None
    gone = [w for w in written if not ((w[0] == "name" and w[1] in final["names"]) or (w[0] == "page" and w[1] in final["pages"]) or (w[0] == "module" and w[1] in final["modules"]))]
    return ok_calls, len(written), len(gone)


def logic_units(proj):
    """Map/common/troop events of a runtime project as {key: (label, canonical JSON of pages)} for the changed-events diff."""
    if not os.path.exists(proj):
        return None
    p = json.load(open(proj))
    maps = p["maps"] if isinstance(p["maps"], list) else list(p["maps"].values())
    units = {}
    for m in maps:
        for e in m.get("events") or []:
            units[f'map:{m["id"]}:{e["id"]}'] = (e.get("name") or e["id"], json.dumps(e.get("pages"), sort_keys=True, ensure_ascii=False))
    for c in p.get("commonEvents") or []:
        units[f'common:{c.get("id")}'] = (c.get("name") or str(c.get("id")), json.dumps(c, sort_keys=True, ensure_ascii=False))
    troops = (p.get("database") or {}).get("troops") or {}
    for t in (troops.values() if isinstance(troops, dict) else troops):
        units[f'troop:{t.get("id")}'] = (t.get("name") or t.get("id"), json.dumps(t.get("pages"), sort_keys=True, ensure_ascii=False))
    return units


def changed_events(L, mech, d):
    """Events/common events/troops the run created or changed, against the frozen stage checkpoint (readability input)."""
    base, now = logic_units(f"{L}/checkpoints/{mech}/check/project.json"), logic_units(f"{d}/check/project.json")
    if base is None or now is None:
        return None
    return [{"key": k, "name": v[0], "kind": "created" if k not in base else "changed"} for k, v in now.items() if k not in base or base[k][1] != v[1]]


def run_row(L, arm, mech, rep):
    d = f"{L}/{arm}/{mech}-{rep}"
    run = open(f"{d}/RUN.txt").read() if os.path.exists(f"{d}/RUN.txt") else ""
    if "finished=" not in run:
        return {"arm": arm, "mech": mech, "rep": rep, "status": "running" if run else "queued"}
    m = run_metrics(d)
    final = final_scripts(f"{d}/check/project.json")
    calls, written, reverted = script_writes(d, final)
    st = run.split("started=")[1].split()[0]; fin = run.split("finished=")[1].split()[0]
    wall = (datetime.datetime.fromisoformat(fin.replace("Z", "+00:00")) - datetime.datetime.fromisoformat(st.replace("Z", "+00:00"))).total_seconds() / 60
    w = f"{L}/walk/{arm}-{mech}-{rep}/walk.json"
    walk = json.load(open(w)) if os.path.exists(w) else None
    turn_timeout = any((json.load(open(f)).get("outcome") == "timeout") for f in glob.glob(f"{d}/session/turns/*.json"))
    return {"arm": arm, "mech": mech, "rep": rep, "status": "done", "capped": turn_timeout or "timeout=" in run,
            "costUsd": None if m["cost"] is None else round(m["cost"], 2), "tokensTotal": m["tokensTotal"], "outputTokens": m["output"],
            "modelCalls": m["modelCalls"], "toolCalls": m["tools"], "toolFailed": m["failed"], "scriptToolCalls": m["scriptCalls"],
            "scriptWriteCalls": calls, "scriptsWritten": written, "scriptsReverted": reverted,
            "scriptsInGame": None if final is None else final["count"], "turnMin": round(m["ms"] / 60000, 1), "wallMin": round(wall, 1),
            "walkPass": walk and walk["pass"], "walkTotal": walk and walk["total"], "ending": walk and any(c["id"] == "ending" and c["pass"] for c in walk["checks"]),
            "walkFails": walk and [c["id"] for c in walk["checks"] if not c["pass"]],
            "changedEvents": changed_events(L, mech, d), "readability": readability(L, arm, mech, rep)}


def readability(L, arm, mech, rep):
    f = f"{L}/readability/{arm}-{mech}-{rep}.json"
    return json.load(open(f)) if os.path.exists(f) else None


def med(vals):
    vals = [v for v in vals if isinstance(v, (int, float)) and not isinstance(v, bool)]
    return round(statistics.median(vals), 2) if vals else None


def main():
    L = sys.argv[1]
    out = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else os.path.expanduser("~/claude-viz/script-editor-live/measure.json")
    rows = [run_row(L, a, m, r) for a in ARMS for m in MECHS for r in (1, 2) if os.path.isdir(f"{L}/{a}") or a != "new"]
    keys = ["costUsd", "tokensTotal", "outputTokens", "modelCalls", "toolCalls", "toolFailed", "scriptToolCalls", "scriptsWritten", "scriptsReverted", "scriptsInGame", "turnMin", "wallMin", "walkPass"]
    arms = {}
    for a in ARMS:
        done = [r for r in rows if r["arm"] == a and r["status"] == "done"]
        if not done:
            continue
        arms[a] = {"runs": len(done), "capped": sum(1 for r in done if r["capped"]), **{k: med([r.get(k) for r in done]) for k in keys},
                   "walkPassSum": sum(r["walkPass"] or 0 for r in done if r["walkPass"] is not None), "walkTotalSum": sum(r["walkTotal"] or 0 for r in done if r["walkTotal"] is not None),
                   "endings": sum(1 for r in done if r["ending"]), "walked": sum(1 for r in done if r["walkPass"] is not None),
                   "changedEvents": med([len(r["changedEvents"]) for r in done if r.get("changedEvents") is not None]),
                   "readability": (lambda xs: round(sum(xs) / len(xs), 2) if xs else None)([r["readability"]["score"] for r in done if r.get("readability")])}
    judge = {}
    for f in sorted(glob.glob(f"{L}/judge/*.json")):
        mech, rep, x, y = os.path.basename(f)[:-5].split("-")
        res = json.load(open(f))
        k = f"{x}-vs-{y}"
        j = judge.setdefault(k, {x: 0, y: 0, "tie": 0, "flips": 0, "games": []})
        for r in res:
            j[r["winner"] if r["winner"] in (x, y) else "tie"] += 1
        if len({r["winner"] for r in res}) > 1:
            j["flips"] += 1
        j["games"].append({"mech": mech, "rep": int(rep), "winners": [r["winner"] for r in res], "decisive": [r.get("decisive") for r in res],
                           "correctness": [r.get("correctness") for r in res]})
    doc = {"updated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "batch": os.path.basename(L.rstrip("/")),
           "armBuilds": {"main": "0b6bc12098", "off": "0b6bc12098 + OPRN_V2_SCRIPTS=0", "v1": "a7456dd876 (first guidance)", "new": "next guidance PR (pending)"},
           "design": "3 mechanics x 2 reps per arm; each run = one logic request on a frozen stage checkpoint; Opus 5.5 medium (local Claude CLI), v2; 15 min cap",
           "arms": arms, "runs": rows, "judgePairwise": judge}
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump(doc, open(out + ".tmp", "w"), ensure_ascii=False, indent=1); os.replace(out + ".tmp", out)
    for a, v in arms.items():
        print(a, {k: v[k] for k in ("runs", "capped", "costUsd", "tokensTotal", "modelCalls", "toolCalls", "toolFailed", "scriptToolCalls", "scriptsWritten", "scriptsReverted", "turnMin")}, f'walk {v["walkPassSum"]}/{v["walkTotalSum"]} endings {v["endings"]}/{v["walked"]}')
    for k, j in judge.items():
        print(k, {x: n for x, n in j.items() if x != "games"})


if __name__ == "__main__":
    main()
