#!/usr/bin/env python3
"""Hard-logic battery — absolute Opus 5.5 medium judge of ONE run: mechanic fidelity 1-10 + failure root causes.

  python3 scripts/qa/script-ab/hard/judge-hard.py <batch dir> <arm> <mech> <rep>  → <batch>/judge/<arm>-<mech>-<rep>.json
Input: request text, stage text, logic JSON (movement kept), the shipped-player playthrough checks + transcript tail.
"""
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
from judge import ask  # noqa: E402

L, arm, mech, rep = sys.argv[1:5]
P = json.load(open(os.path.join(HERE, "prompts.json")))
M = [m for m in P["mechanics"] if m["id"] == mech][0]
stage = [s["text"] for s in P["stage"] if s["id"] == M["stage"]]
stage = stage[0] if stage else "(dungeon stage of the earlier A/B: 3 rooms, plates, door, lever, gate, boss event, enemy 「던전 보스」, troop 「보스전」)"
d = f"{L}/{arm}/{mech}-{rep}"
if not os.path.exists(f"{d}/logic.json"):
    with open(f"{d}/logic.json", "w") as f:
        subprocess.run([sys.executable, os.path.join(HERE, "logic_export_hard.py"), f"{d}/check/project.json"], stdout=f, check=True)
logic = open(f"{d}/logic.json").read()
if len(logic) > 260_000:
    logic = logic[:260_000] + "…(truncated)"
w = f"{L}/walk/{arm}-{mech}-{rep}/walk.json"
if os.path.exists(w):
    W = json.load(open(w))
    walk = "\n".join(f"- {'PASS' if c['pass'] else 'FAIL'} {c['id']}: {c['note']} | shown: {' / '.join(c.get('texts') or [])[:300]}" for c in W["checks"])
    tail = "\n".join(t["text"][:200] for t in (W.get("transcript") or [])[-80:])
else:
    walk, tail = "(no playthrough)", ""
prompt = f"""An editor assistant (model: {arm}) was asked to add game logic to a prebuilt RPG stage. The stage (maps and
named events with one-line placeholder dialogue, no logic) was built first from this request:
<stage>{stage}</stage>
Then the assistant got ONLY this request (Korean):
<request>{M['text']}</request>

Below is the resulting game's complete logic (events with pages, conditions, commands, movement; a command of kind
"script" holds TypeScript run against a `game` API — treat it as the equivalent event commands) and an automated
playthrough in the shipped player. The playthrough is a test harness: it teleports, jumps the clock, saves/reloads,
and some of its checks can fail because of the harness itself (wrong guess of a choice label, timing) — decide that
from the logic, do not trust a FAIL blindly, and do not trust a PASS blindly either.

<logic>{logic}</logic>
<playthrough_checks>
{walk}
</playthrough_checks>
<transcript_tail>
{tail}
</transcript_tail>

Judge:
1. fidelity 1-10: how exactly a player would experience every requested rule, including the failure paths, limits and
   persistence asked for (10 = all of it exactly, 5 = core works but several rules missing/wrong, 1 = not implemented).
2. works: true if the core mechanic is playable as requested end to end (success and failure path).
3. issues: every requested rule that is missing or wrong. For each give the root cause, one of:
   "assistant" (the model mis-built it although the editor could express it),
   "engine-gap" (the game engine / script API has no way to express it cleanly),
   "tool-contract" (an editor tool rejected or mangled a valid intent),
   "validator" (a checker blocked correct work), "runtime-bug" (the logic is right but the player runs it wrong),
   "harness" (only the playthrough harness is wrong).
   For engine-gap / runtime-bug / tool-contract name the concrete missing capability or command.
4. harnessFalseFails: ids of FAIL checks that are harness artifacts.

Reply with ONLY this JSON:
{{"fidelity": <1-10>, "works": <true|false>, "summary": "<one short Korean sentence>",
 "issues": [{{"rule": "<Korean, short>", "severity": "major|minor", "cause": "<one of the six>", "detail": "<English, concrete>"}}],
 "harnessFalseFails": ["<check id>"]}}"""
out, cost = ask(prompt)
out["_cost"] = cost
os.makedirs(f"{L}/judge", exist_ok=True)
json.dump(out, open(f"{L}/judge/{arm}-{mech}-{rep}.json", "w"), ensure_ascii=False, indent=1)
print(arm, mech, rep, out.get("fidelity"), out.get("summary"))
