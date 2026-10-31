#!/usr/bin/env python3
"""Viewing aid for layouts that never validated (same for both arms): drop the pieces the validator names as misplaced
("<id>" at (x,y) / ["<id>"@(x,y)]) and render what is left. Walls/rooms are never changed. Writes map.png + salvage.json
(dropped pieces, remaining errors) into the run folder. Runs that still cannot render (structural errors) stay without a map.
  python3 scripts/experiments/argon-plan/salvage.py"""
import glob, json, os, re, shutil, subprocess
HOME = os.path.expanduser("~"); R = os.environ.get("BW_RUNS", f"{HOME}/z-project/assistant-whole-game/suite/rooms/runs-argonplan")
PAT = [re.compile(r'"([^"]+)" at \((\d+),(\d+)\)'), re.compile(r'"([^"@]+)"@\((\d+),(\d+)\)')]
for g in sorted(glob.glob(f"{R}/argon[ABGJ][0-9]/*/RUN.json")):
    G = os.path.dirname(g); task = G.split("/")[-1]
    if os.path.exists(f"{G}/map.png") and not os.path.exists(f"{G}/salvage.json") and json.load(open(g)).get("rendered"): continue
    if os.path.exists(f"{G}/salvage.json") and json.load(open(f"{G}/salvage.json")).get("rendered"): continue
    cands = ["layout.json"] + [f"layout-{n}{h}.json" for n in range(9, -1, -1) for h in ("-harmonised", "") if os.path.exists(f"{G}/layout-{n}{h}.json")]
    for src in cands:   # the final layout first; if its walls cannot be drawn, the latest earlier answer that can
      L = json.load(open(f"{G}/{src}")); dropped = []; ok = False; errs = []
      for k in range(10):
          f = f"{G}/salvage-layout.json"; json.dump(L, open(f, "w"), indent=1); out = f"{G}/lay-salvage"
          p = subprocess.run(["bun", "scripts/experiments/argon-plan/lay.mts", f, out, f"{R}/base", "--task", task, "--cats", f"{R}/cats-{task}.json", "--render", "--force-render"],
                             capture_output=True, text=True, env=dict(os.environ, OPRN_SHARED_CONTENT_SQLITE=f"{R}/shared-content.sqlite"))
          try: chk = json.loads(p.stdout.strip().splitlines()[-1])
          except Exception: chk = {"errors": ["painter crashed"]}
          errs = chk.get("errors") or []
          if os.path.exists(f"{out}/map.png"):
              shutil.copy(f"{out}/map.png", f"{G}/map.png"); ok = True
              if chk.get("stats"): r = json.load(open(g)); r["salvageStats"] = chk["stats"]; json.dump(r, open(g, "w"), ensure_ascii=False, indent=1)
              break
          bad = set()
          for e in errs:
              for P in PAT:
                  for m in P.finditer(e): bad.add((m[1], int(m[2]), int(m[3])))
          n0 = len(dropped)
          for key in ("objects", "wall_items"):
              keep = []
              for o in L.get(key) or []:
                  if isinstance(o, dict) and (o.get("id"), o.get("x"), o.get("y")) in bad: dropped.append([o.get("id"), o.get("x"), o.get("y")])
                  else: keep.append(o)
              L[key] = keep
          if len(dropped) == n0: break
      if ok: break
    json.dump({"rendered": ok, "from": src, "dropped": dropped, "errorsLeft": errs[:10]}, open(f"{G}/salvage.json", "w"), ensure_ascii=False, indent=1)
    print(G.split("/")[-2] + "/" + task, "rendered" if ok else "NO RENDER", "dropped", len(dropped), (errs[:1] if not ok else ""), flush=True)
