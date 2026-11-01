#!/usr/bin/env python3
"""Lead/worker split battery (from ../script-ab/ab2/readability.py, run dirs named <arm>__<task>__<rep>) — readability judge: how readable the event pages a run created/changed are for a non-coder.

  python3 scripts/qa/script-ab/ab2/readability.py <batch dir> <arm> <mech> <rep>
      shots: <batch>/shots/<arm>-<mech>-<rep>/*.png (event editor command lists, one per changed event, same viewer build
      for every arm)  →  <batch>/readability/<arm>-<mech>-<rep>.json {score, reason, shots, perEvent}

Opus 5.5 medium through the local Claude CLI with only the Read tool (it opens the screenshots itself).
"""
import json, os, re, subprocess, sys, glob

L, arm, mech, rep = sys.argv[1:5]
tag = f"{arm}__{mech}__{rep}"
shots = sorted(glob.glob(f"{L}/shots/{tag}/*.png"))
if not shots:
    sys.exit(f"no screenshots in {L}/shots/{tag}")
listing = "\n".join(f"- {s}" for s in shots)
prompt = f"""You rate the READABILITY of RPG event logic for a non-programmer game maker (someone who uses RPG Maker,
never wrote code). Each screenshot below shows one event's command list in the game editor (some commands may be short
code fragments shown inline). Open every screenshot with the Read tool, then judge only how easily such a person could
read, understand and safely edit the logic: plain event-style lines are easy; long code blocks, cryptic variable names,
deep nesting, magic numbers without explanation and duplicated sprawling command lists are hard. Do not judge
correctness or style preferences beyond that.

Screenshots:
{listing}

Reply with ONLY this JSON:
{{"score": <1-10 overall, 10 = a non-coder reads and edits it easily>, "reason": "<one line>",
 "perEvent": [{{"shot": "<file name>", "score": <1-10>}}]}}"""
r = subprocess.run(["claude", "-p", "--model", "claude-opus-5-5", "--effort", "medium", "--tools", "Read", "--allowedTools", "Read",
                    "--add-dir", os.path.dirname(shots[0]), "--no-session-persistence", "--strict-mcp-config", "--output-format", "json"],
                   input=prompt, capture_output=True, text=True, timeout=1800, cwd="/tmp")
d = json.loads(r.stdout)
out = json.loads(re.search(r"\{.*\}", d.get("result", ""), re.S).group(0))
out["shots"] = [os.path.relpath(s, L) for s in shots]
out["_cost"] = d.get("total_cost_usd")
os.makedirs(f"{L}/readability", exist_ok=True)
json.dump(out, open(f"{L}/readability/{tag}.json", "w"), ensure_ascii=False, indent=1)
print(arm, mech, rep, out["score"], out["reason"])
