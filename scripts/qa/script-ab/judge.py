#!/usr/bin/env python3
"""Script A/B PoC — Opus 5.5 medium judge (local Claude CLI, no tools).

  python3 scripts/qa/script-ab/judge.py audit <root> <arm>/<prompt>-<rep>     per-game mechanics audit → <run>/audit.json
  python3 scripts/qa/script-ab/judge.py pair  <root> <prompt> <rep>           A vs B, both orders → <root>/judge/<prompt>-<rep>.json

The judge sees the user request, the game logic (logic.json from logic_export.py) and the automated playthrough
result (walk.json checks). It is told that implementation style (TypeScript script vs event commands) is not a criterion.
"""
import json, os, subprocess, sys, re

PROMPTS = json.load(open(os.path.join(os.path.dirname(__file__), "prompts.json")))["prompts"]
MECHANICS = ["counter", "formula", "timer", "loop", "random", "inventory-check", "phase-change", "order-sequence",
             "time-of-day", "number-input", "one-time-guard", "branching-dialogue"]


def ask(prompt):
    r = subprocess.run(["claude", "-p", "--model", "claude-opus-5-5", "--effort", "medium", "--tools", "",
                        "--no-session-persistence", "--strict-mcp-config", "--output-format", "json"],
                       input=prompt, capture_output=True, text=True, timeout=1800, cwd="/tmp")
    d = json.loads(r.stdout)
    text = d.get("result", "")
    m = re.search(r"\{.*\}", text, re.S)
    return json.loads(m.group(0)), d.get("total_cost_usd")


def walk_summary(root, run):
    arm, rest = run.split("/")
    p = f"{root}/walk/{arm}-{rest}/walk.json"
    if not os.path.exists(p):
        return "(no playthrough)"
    w = json.load(open(p))
    return "\n".join(f"- {'PASS' if c['pass'] else 'FAIL'} {c['id']}: {c['note']}" for c in w["checks"])


def request_text(pid):
    return [p["text"] for p in PROMPTS if p["id"] == pid][0]


def audit(root, run):
    pid = run.split("/")[1].rsplit("-", 1)[0]
    logic = open(f"{root}/{run}/logic.json").read()
    prompt = f"""You audit one small RPG game that an editor assistant built from this user request (Korean):

<request>
{request_text(pid)}
</request>

Below is the complete game logic as JSON: maps with events (pages: trigger, conditions, commands), common events,
script library, troops (battle event pages), enemies, items, switches, variables. A command of kind "script" holds
TypeScript (field "source") that runs against a `game` API (game.getVar/setVar/addVar, showMessage, showChoices,
inputNumber, hasItem/addItem/removeItem, gold/addGold, time(), random(n), moveEvent, wait, battle …).
Other commands are ordinary RPG-maker event commands. Judge BEHAVIOUR only — do not prefer either implementation style.

<logic>
{logic}
</logic>

An automated playthrough in the shipped player gave:
<playthrough>
{walk_summary(root, run)}
</playthrough>

Tasks:
1. For each requested mechanic, decide whether it is realized and correct when played, and how it is implemented.
2. List concrete logic bugs a player could hit (wrong counter, wrong formula/rounding, missing phase change, softlock,
   switch that is set but never read / read but never set, double reward, unreachable ending, wrong text with raw
   control codes, …). Only real bugs that follow from the logic; no style remarks.
3. Classify which mechanic kinds the game actually contains, from this fixed list: {", ".join(MECHANICS)}.

Reply with ONLY this JSON:
{{"mechanics": [{{"requested": "<short name>", "realized": true|false, "correct": true|false, "impl": "script"|"commands"|"mixed"|"missing", "note": "<one line>"}}],
 "bugs": [{{"severity": "major"|"minor", "what": "<one line>"}}],
 "kinds": {{"<kind>": "script"|"commands"|"mixed"}},
 "score": <0-10 overall correctness of the requested logic>}}"""
    out, cost = ask(prompt)
    out["_cost"] = cost
    json.dump(out, open(f"{root}/{run}/audit.json", "w"), ensure_ascii=False, indent=1)
    print(run, out.get("score"), len(out.get("bugs", [])), "bugs")


def pair(root, pid, rep):
    a, b = f"A/{pid}-{rep}", f"B/{pid}-{rep}"
    results = []
    for first, second in ((a, b), (b, a)):
        prompt = f"""Two small RPG games were built by an editor assistant from the same user request (Korean):

<request>
{request_text(pid)}
</request>

Each game is given as its complete logic JSON (events with pages, conditions, commands; a command of kind "script"
holds TypeScript run against a `game` API — treat it exactly like the equivalent event commands) plus an automated
playthrough result from the shipped player. Compare them on:
- logic correctness: does every requested mechanic behave exactly as asked, including edge cases (wrong-code counter,
  price formula and rounding, time windows, one-time rewards, phase change, timers), and no softlocks or stranded flags;
- realization: how completely and faithfully the requested mechanics were realized.
Implementation style (script vs commands, length) is NOT a criterion. Judge only what a player would experience.

<game id="1">
<logic>{open(f"{root}/{first}/logic.json").read()}</logic>
<playthrough>
{walk_summary(root, first)}
</playthrough>
</game>

<game id="2">
<logic>{open(f"{root}/{second}/logic.json").read()}</logic>
<playthrough>
{walk_summary(root, second)}
</playthrough>
</game>

Reply with ONLY this JSON:
{{"winner": "1"|"2"|"tie", "correctness": {{"1": <0-10>, "2": <0-10>}}, "realization": {{"1": <0-10>, "2": <0-10>}},
 "decisive": "<the one or two differences that decided it>"}}"""
        out, cost = ask(prompt)
        mapping = {"1": first.split("/")[0], "2": second.split("/")[0]}
        results.append({"order": [first, second], "winner": mapping.get(str(out.get("winner")), "tie"),
                        "correctness": {mapping[k]: v for k, v in (out.get("correctness") or {}).items() if k in mapping},
                        "realization": {mapping[k]: v for k, v in (out.get("realization") or {}).items() if k in mapping},
                        "decisive": out.get("decisive"), "cost": cost})
    os.makedirs(f"{root}/judge", exist_ok=True)
    json.dump(results, open(f"{root}/judge/{pid}-{rep}.json", "w"), ensure_ascii=False, indent=1)
    print(pid, rep, [r["winner"] for r in results])


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "audit":
        audit(sys.argv[2], sys.argv[3])
    elif cmd == "pair":
        pair(sys.argv[2], sys.argv[3], sys.argv[4])
