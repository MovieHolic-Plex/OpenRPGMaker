#!/usr/bin/env python3
"""Lead/worker split battery — absolute Opus 5.5 medium judge of ONE run (local Claude CLI, no tools).

  python3 scripts/qa/split-ab/judge.py <batch dir> <arm> <task> <rep>  → <batch>/judge/<arm>__<task>__<rep>.json

Sees: the request, an acceptance list written once per request (same for every arm), the run's logic JSON (export.py),
the shipped-player playthrough checks (logic requests only), the editor's game-check findings, and the assistant's final
report + todo state (to catch false «done» claims). Scores fidelity, per-item acceptance, dialogue quality and staging
(RPG/romance), structural soundness.
"""
import glob, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
L, arm, task, rep = sys.argv[1:5]
P = json.load(open(os.path.join(HERE, "prompts.json")))
T = [t for t in P["tasks"] if t["id"] == task][0]
d = f"{L}/{arm}/{task}-{rep}"
if not os.path.exists(f"{d}/logic.json"):
    with open(f"{d}/logic.json", "w") as f:
        subprocess.run([sys.executable, os.path.join(HERE, "export.py"), f"{d}/check/project.json"], stdout=f, check=True)
logic = open(f"{d}/logic.json").read()
if len(logic) > 240_000:
    logic = logic[:240_000] + "…(truncated)"
w = f"{L}/walk/{arm}__{task}__{rep}/walk.json"
walk = "(no automated playthrough for this request — trace the logic yourself)"
if os.path.exists(w):
    W = json.load(open(w))
    walk = "\n".join(f"- {'PASS' if c['pass'] else 'FAIL'} {c['id']}: {c['note']} | shown: {' / '.join(c.get('texts') or [])[:240]}" for c in W["checks"])
findings = []
for f in glob.glob(f"{d}/check/*.json"):
    if f.endswith("project.json"): continue
    try:
        j = json.load(open(f))
    except Exception:
        continue
    for k in ("findings", "issues", "problems", "errors", "warnings"):
        for x in (j.get(k) or []) if isinstance(j, dict) else []:
            findings.append(json.dumps(x, ensure_ascii=False)[:300])
answer, todo = "", ""
for f in sorted(glob.glob(f"{d}/session/turns/*.json")):
    t = json.load(open(f))
    if t.get("answer"): answer = str(t["answer"])
    for n in t.get("statusNotes") or []:
        if isinstance(n, str) and ("v2.todo.final" in n or "할 일 최종" in n): todo = n
genre = T["group"]
extra = ""
if genre in ("rpg", "romance"):
    extra = """5. dialogue 1-10: quality of the player-facing Korean lines the assistant wrote (natural Korean, not translationese,
   consistent character voice as requested, fits the scene). Quoted lines the user dictated count as given; judge the rest.
6. staging 1-10: presentation — portraits/expressions, camera moves, character movement, BGM/SE changes, screen fades,
   balloons — used where the request asks for them (and sensibly where it implies them). 1 = none of the asked staging."""
prompt = f"""An RPG editor assistant was given a prebuilt game stage (maps and named events with one-line placeholder
dialogue, no logic) and ONLY this request (Korean):
<request>{T['text']}</request>

Acceptance list for this request (the same list is used for every assistant being compared):
<acceptance>
{chr(10).join(f'{i+1}. {a}' for i, a in enumerate(T['accept']))}
</acceptance>

Below is the resulting game logic (events with pages, conditions, commands, move routes; database records it uses; map
settings). A command of kind "script" holds TypeScript run against a `game` API — treat it as the equivalent commands.
<logic>{logic}</logic>

Automated playthrough in the shipped player (a test harness — some FAILs can be harness artefacts; decide from the logic):
<playthrough>
{walk}
</playthrough>
Editor game-check findings: {chr(10).join(findings[:30]) or '(none)'}
Assistant's final report to the user (Korean, may overclaim): <report>{answer[:3000]}</report>
Final todo state: {todo[:800] or '(not recorded)'}

Judge as a player who plays this game:
1. checklist: for EVERY acceptance item, pass true/false with a short reason (trace the actual pages/conditions/commands;
   an item passes only if a player would really experience it).
2. fidelity 1-10: how exactly the whole request is realised, including failure paths and limits (10 = all exactly).
3. works: true if the core of the request is playable end to end.
4. structure: list concrete structural defects — switches/variables set but never read or read but never set, events or
   pages that can never trigger, dead ends, broken one-time guards, duplicates that shadow each other. Also falseDone:
   true if the final report claims something works that the logic shows is missing or broken.
{extra}

Reply with ONLY this JSON:
{{"checklist": [{{"item": <n>, "pass": true|false, "why": "<short Korean>"}}], "fidelity": <1-10>, "works": <true|false>,
 "structure": {{"defects": ["<short English>"], "falseDone": <true|false>}},
 "dialogue": <1-10 or null>, "staging": <1-10 or null>, "summary": "<one short Korean sentence>"}}"""
r = subprocess.run(["claude", "-p", "--model", "claude-opus-5-5", "--effort", "medium", "--tools", "",
                    "--no-session-persistence", "--strict-mcp-config", "--output-format", "json"],
                   input=prompt, capture_output=True, text=True, timeout=1800, cwd="/tmp")
dj = json.loads(r.stdout)
text = dj.get("result", "")
out = None
for i, ch in enumerate(text):
    if ch != "{": continue
    try:
        out, _ = json.JSONDecoder().raw_decode(text[i:])
        if isinstance(out, dict) and "checklist" in out: break
    except ValueError:
        continue
if not isinstance(out, dict): sys.exit(f"judge reply had no JSON: {text[:200]}")
out["_cost"] = dj.get("total_cost_usd")
os.makedirs(f"{L}/judge", exist_ok=True)
json.dump(out, open(f"{L}/judge/{arm}__{task}__{rep}.json", "w"), ensure_ascii=False, indent=1)
print(arm, task, rep, out.get("fidelity"), sum(1 for c in out.get("checklist", []) if c.get("pass")), "/", len(T["accept"]), out.get("summary"))
