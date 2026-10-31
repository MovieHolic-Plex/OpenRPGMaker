#!/usr/bin/env python3
"""Script A/B 2 — pairwise Opus 5.5 medium judge between two arms of the same mechanic and rep (both orders).

  python3 scripts/qa/script-ab/ab2/judge.py <batch dir> <mech> <rep> <armX> <armY>   → <batch>/judge/<mech>-<rep>-<x>-<y>.json

Each game = logic.json (logic_export.py of check/project.json, written here if missing) + walk.json checks. The judge
is told the stage (maps, named events) was prebuilt and the assistant got only the logic request.
"""
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
from judge import ask  # noqa: E402

P = json.load(open(os.path.join(HERE, "prompts.json")))


def text(key, mech):
    return [p["text"] for p in P[key] if p["id"] == mech][0]


def game(L, arm, mech, rep):
    d = f"{L}/{arm}/{mech}-{rep}"
    if not os.path.exists(f"{d}/logic.json"):
        with open(f"{d}/logic.json", "w") as f:
            subprocess.run([sys.executable, os.path.join(HERE, "..", "logic_export.py"), f"{d}/check/project.json"], stdout=f, check=True)
    w = f"{L}/walk/{arm}-{mech}-{rep}/walk.json"
    walk = "\n".join(f"- {'PASS' if c['pass'] else 'FAIL'} {c['id']}: {c['note']}" for c in json.load(open(w))["checks"]) if os.path.exists(w) else "(no playthrough)"
    return open(f"{d}/logic.json").read(), walk


def main():
    L, mech, rep, x, y = sys.argv[1:6]
    games = {a: game(L, a, mech, rep) for a in (x, y)}
    results = []
    for first, second in ((x, y), (y, x)):
        prompt = f"""Two small RPG games were built by an editor assistant. The stage (maps and named events with one-line placeholder
dialogue, no logic) was prebuilt identically for both; the assistant then got only this user request (Korean):

<request>
{text("prompts", mech)}
</request>

(For reference, the stage had been requested as: {text("stage", mech)})

Each game is given as its complete logic JSON (events with pages, conditions, commands; a command of kind "script"
holds TypeScript run against a `game` API — treat it exactly like the equivalent event commands) plus an automated
playthrough result from the shipped player. Compare them on:
- logic correctness: does every requested mechanic behave exactly as asked, including edge cases (wrong-code counter,
  price formula and rounding, time windows, one-time rewards, phase change, timers), and no softlocks or stranded flags;
- realization: how completely and faithfully the requested mechanics were realized.
Implementation style (script vs commands, length) is NOT a criterion. Judge only what a player would experience.

<game id="1">
<logic>{games[first][0]}</logic>
<playthrough>
{games[first][1]}
</playthrough>
</game>

<game id="2">
<logic>{games[second][0]}</logic>
<playthrough>
{games[second][1]}
</playthrough>
</game>

Reply with ONLY this JSON:
{{"winner": "1"|"2"|"tie", "correctness": {{"1": <0-10>, "2": <0-10>}}, "realization": {{"1": <0-10>, "2": <0-10>}},
 "decisive": "<the one or two differences that decided it>"}}"""
        out, cost = ask(prompt)
        mapping = {"1": first, "2": second}
        results.append({"order": [first, second], "winner": mapping.get(str(out.get("winner")), "tie"),
                        "correctness": {mapping[k]: v for k, v in (out.get("correctness") or {}).items() if k in mapping},
                        "realization": {mapping[k]: v for k, v in (out.get("realization") or {}).items() if k in mapping},
                        "decisive": out.get("decisive"), "cost": cost})
    os.makedirs(f"{L}/judge", exist_ok=True)
    json.dump(results, open(f"{L}/judge/{mech}-{rep}-{x}-{y}.json", "w"), ensure_ascii=False, indent=1)
    print(mech, rep, x, y, [r["winner"] for r in results])


if __name__ == "__main__":
    main()
