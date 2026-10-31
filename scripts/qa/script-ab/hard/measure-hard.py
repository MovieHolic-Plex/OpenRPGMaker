#!/usr/bin/env python3
"""Hard-logic battery — one row per run: usage, list-price cost, tools, scripts vs events, playthrough, judges.

  python3 scripts/qa/script-ab/hard/measure-hard.py <batch dir>   → <batch>/measure.json
Cost = tokens × public list price per 1M (input / output / cache read / cache write):
  opus  Opus 5.5  $4 / $20 / $0.20 / $5      haiku Haiku 5.5 $0.10 / $0.50 / $0.01 / $0.125
(Claude Code's own costUsd bills haiku-5-5 at Opus rates and double-counts — not used.)
"""
import json, os, sys, glob, datetime
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
from metrics import run_metrics  # noqa: E402

PRICE = {"opus": (4, 20, 0.20, 5), "haiku": (0.10, 0.50, 0.01, 0.125)}
P = json.load(open(os.path.join(HERE, "prompts.json")))
MECHS = [m["id"] for m in P["mechanics"]]
STAGE = {m["id"]: m["stage"] for m in P["mechanics"]}


SKIP = {"conditions", "condition", "trigger", "graphic", "movement", "moveRoute", "effects", "explanation", "if", "when", "test"}


def cmd_list(cmds, acc):
    """Commands of a command list, nested branches included (conditions/triggers are not commands)."""
    for c in cmds or []:
        if not isinstance(c, dict):
            continue
        acc.append(c)
        for k, v in c.items():
            if k in SKIP:
                continue
            if isinstance(v, list) and v and all(isinstance(x, dict) for x in v):
                if all("kind" in x for x in v):
                    cmd_list(v, acc)
                else:
                    for x in v:
                        for k2, v2 in x.items():
                            if k2 not in SKIP and isinstance(v2, list) and v2 and all(isinstance(y, dict) and "kind" in y for y in v2):
                                cmd_list(v2, acc)
            elif isinstance(v, dict):
                for k2, v2 in v.items():
                    if k2 not in SKIP and isinstance(v2, list) and v2 and all(isinstance(y, dict) and "kind" in y for y in v2):
                        cmd_list(v2, acc)
    return acc


def walk_cmds(unit, acc):
    if isinstance(unit, list) and unit and isinstance(unit[0], dict) and "commands" in unit[0]:  # pages
        for pg in unit:
            cmd_list(pg.get("commands"), acc)
    elif isinstance(unit, list):
        cmd_list(unit, acc)
    return acc


def units(proj):
    if not os.path.exists(proj):
        return None
    p = json.load(open(proj)); p = p.get("project", p)
    maps = p["maps"] if isinstance(p["maps"], list) else list(p["maps"].values())
    u = {}
    for m in maps:
        for e in m.get("events") or []:
            u[f'map:{m["id"]}:{e["id"]}'] = (e.get("name") or (e.get("pages") or [{}])[0].get("name") or e["id"], e.get("pages"))
    for c in p.get("commonEvents") or []:
        u[f'common:{c.get("id")}'] = (c.get("name") or str(c.get("id")), c.get("commands"))
    tr = (p.get("database") or {}).get("troops") or {}
    for t in (tr.values() if isinstance(tr, dict) else tr):
        u[f'troop:{t.get("id")}'] = (t.get("name") or t.get("id"), t.get("pages"))
    return u


def logic_shape(L, mech, d):
    base = units(f"{L}/checkpoints/{STAGE[mech]}/check/project.json"); now = units(f"{d}/check/project.json")
    if now is None:
        return None
    changed = [k for k, v in now.items() if base is None or k not in base or json.dumps(base[k][1], sort_keys=True) != json.dumps(v[1], sort_keys=True)]
    scripts, cmds = [], 0
    for k in changed:
        for c in walk_cmds(now[k][1], []):
            if c.get("kind") == "script":
                scripts.append(c)
            elif c.get("kind") not in ("script",):
                cmds += 1
    lines = sum(len((s.get("source") or "").strip().splitlines()) for s in scripts)
    return {"changed": [{"key": k, "name": now[k][0], "kind": "created" if base is None or k not in base else "changed"} for k in changed],
            "eventsChanged": len(changed), "commands": cmds, "scripts": len(scripts), "scriptLines": lines,
            "scriptMax": max([len((s.get("source") or "").strip().splitlines()) for s in scripts] or [0])}


def stream_usage(d):
    """Per-message usage from the teed CLI stream (survives the run cap). Max per message id, summed."""
    f = f"{d}/claude-stream.jsonl"
    if not os.path.exists(f):
        return None
    msgs = {}
    for line in open(f, errors="ignore"):
        try:
            e = json.loads(line)
        except Exception:
            continue
        if e.get("type") != "assistant":
            continue
        m = e.get("message") or {}; u = m.get("usage") or {}
        k = m.get("id") or len(msgs)
        cur = msgs.setdefault(k, {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0})
        for a, b in (("input", "input_tokens"), ("output", "output_tokens"), ("cacheRead", "cache_read_input_tokens"), ("cacheWrite", "cache_creation_input_tokens")):
            cur[a] = max(cur[a], u.get(b) or 0)
    tot = {k: sum(v[k] for v in msgs.values()) for k in ("input", "output", "cacheRead", "cacheWrite")}
    tot["modelCalls"] = len(msgs)
    return tot


def row(L, arm, mech, rep):
    d = f"{L}/{arm}/{mech}-{rep}"
    run = open(f"{d}/RUN.txt").read() if os.path.exists(f"{d}/RUN.txt") else ""
    if "finished=" not in run:
        return {"arm": arm, "mech": mech, "rep": rep, "status": "running" if run else "queued"}
    m = run_metrics(d)
    pr = PRICE[arm]
    su = stream_usage(d)
    if su:
        m.update(su); m["tokensTotal"] = su["input"] + su["output"] + su["cacheRead"] + su["cacheWrite"]; m["usageFrom"] = "stream"
    cost = None if m["input"] is None else round((m["input"] * pr[0] + m["output"] * pr[1] + m["cacheRead"] * pr[2] + m["cacheWrite"] * pr[3]) / 1e6, 3)
    st = run.split("started=")[1].split()[0]; fin = run.split("finished=")[1].split()[0]
    wall = (datetime.datetime.fromisoformat(fin.replace("Z", "+00:00")) - datetime.datetime.fromisoformat(st.replace("Z", "+00:00"))).total_seconds() / 60
    turn_timeout = any(json.load(open(f)).get("outcome") == "timeout" for f in glob.glob(f"{d}/session/turns/*.json"))
    w = f"{L}/walk/{arm}-{mech}-{rep}/walk.json"
    walk = json.load(open(w)) if os.path.exists(w) else None
    j = f"{L}/judge/{arm}-{mech}-{rep}.json"
    judge = json.load(open(j)) if os.path.exists(j) else None
    rd = f"{L}/readability/{arm}-{mech}-{rep}.json"
    read = json.load(open(rd)) if os.path.exists(rd) else None
    hf = set((judge or {}).get("harnessFalseFails") or [])
    real_fails = [c["id"] for c in (walk or {}).get("checks", []) if not c["pass"] and c["id"] not in hf]
    return {"arm": arm, "mech": mech, "rep": rep, "status": "done", "capped": turn_timeout or "timeout=" in run,
            "costUsd": cost, "tokens": m["tokensTotal"], "input": m["input"], "output": m["output"], "cacheRead": m["cacheRead"], "cacheWrite": m["cacheWrite"],
            "usageFrom": m.get("usageFrom", "turns"), "modelCalls": m["modelCalls"], "toolCalls": m["tools"], "toolFailed": m["failed"], "failedTools": m["failedTools"], "scriptToolCalls": m["scriptCalls"],
            "turnMin": round(m["ms"] / 60000, 1), "wallMin": round(wall, 1), "shape": logic_shape(L, mech, d),
            "walkPass": walk and walk["pass"], "walkTotal": walk and walk["total"], "walkFails": walk and [c["id"] for c in walk["checks"] if not c["pass"]],
            "realFails": real_fails if walk else None,
            "fidelity": judge and judge.get("fidelity"), "works": judge and judge.get("works"), "summary": judge and judge.get("summary"),
            "issues": judge and judge.get("issues"), "readability": read and read.get("score"), "readReason": read and read.get("reason")}


def main():
    L = sys.argv[1]
    rows = []
    for a in ("opus", "haiku"):
        for mech in MECHS:
            for r in sorted({os.path.basename(x).rsplit("-", 1)[1] for x in glob.glob(f"{L}/{a}/{mech}-*")} or {"1"}):
                rows.append(row(L, a, mech, int(r)))
    doc = {"updated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "rows": rows}
    json.dump(doc, open(f"{L}/measure.json", "w"), ensure_ascii=False, indent=1)
    for r in rows:
        if r["status"] != "done":
            print(r["arm"], r["mech"], r["rep"], r["status"]); continue
        s = r["shape"] or {}
        print(f'{r["arm"]:5} {r["mech"]:9} r{r["rep"]} ${r["costUsd"]} {r["turnMin"]}m calls {r["modelCalls"]} tools {r["toolCalls"]}/{r["toolFailed"]} ev {s.get("eventsChanged")} cmd {s.get("commands")} scr {s.get("scripts")}/{s.get("scriptLines")}L walk {r["walkPass"]}/{r["walkTotal"]} fid {r["fidelity"]} read {r["readability"]}')


if __name__ == "__main__":
    main()
