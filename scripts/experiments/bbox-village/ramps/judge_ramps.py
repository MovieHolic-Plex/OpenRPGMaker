#!/usr/bin/env python3
"""bbox-village ramps scoring, Opus 5.5 medium, both orders (mapvqa.pairwise):
  1. whole map: every new run vs the previous bbox-village run of the same brief/model (stairs drawn as stone pillars) and vs both
     current v2 builder maps (base-sol, base-terra) — overall + the 'height' axis;
  2. crossings only: the zoom-crop contact sheet of the new run vs the old run's (which reads as a stair/ramp cut into the cliff,
     as tall as the face, in the chipset's style).
  python3 judge_ramps.py -> $RAMP_RUNS/results-opus.json"""
import json, os, sys, concurrent.futures as cf
S = os.path.expanduser("~/z-project/assistant-whole-game/suite")
sys.path.insert(0, f"{S}/mapvqa"); sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapvqa
from crops import contact
NEW = os.environ.get("RAMP_RUNS", f"{S}/rooms/runs-bboxramps"); OLD = f"{S}/rooms/runs-bboxvillage"
J = ["teamclaude/claude-opus-5-5@medium"]
B = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "briefs.json")))
CUT_PROMPT = """You compare two contact sheets of zoom crops from 2D RPG village maps (16px tiles, 3/4 top-down view). Each crop shows one place
where a path climbs a cliff between two terrace levels. Image 1 = sheet A, image 2 = sheet B (authors unknown).
Judge ONLY the level crossings: does each read as stairs or a ramp CUT INTO the cliff face (not an object standing in front of it),
is its drawn height the same as the cliff face it passes through, does it join the path above and below, does it match the chipset's
pixel style and colours? Ignore everything else in the crops.
Answer with one JSON object only: {"pick": "A" | "B" | "tie", "why": "<one or two sentences>"}"""
f = f"{NEW}/results-opus.json"; res = json.load(open(f)) if os.path.exists(f) else {}
jobs = []
for arm in ("sol", "terra"):
    for brief in ("port", "hill"):
        ok = [r for r in (f"{NEW}/{arm}{n}/{brief}" for n in (1, 2, 3)) if os.path.exists(f"{r}/map.png")]
        if not ok: continue
        run = ok[0]; tag = run.split("/")[-2]
        for vs, png in ((f"old-bbox-{arm}1", f"{OLD}/{arm}1/{brief}/map.png"), ("base-sol", f"{OLD}/base-sol/{brief}/map.png"), ("base-terra", f"{OLD}/base-terra/{brief}/map.png")):
            k = f"map|{tag}/{brief}|{vs}"
            if k not in res and os.path.exists(png): jobs.append(("map", k, f"{run}/map.png", png, brief))
        cn, co = f"{run}/cuts-contact.png", f"{NEW}/old-{arm}1-{brief}-contact.png"
        t = f"{NEW}/terrain-{brief}/terrain.json"
        if contact(run, t, cn, 3) and contact(f"{OLD}/{arm}1/{brief}", t, co, 3):
            k = f"cuts|{tag}/{brief}|old-bbox-{arm}1"
            if k not in res: jobs.append(("cuts", k, cn, co, brief))
print("jobs", len(jobs), flush=True)
def one(j):
    typ, k, x, y, brief = j
    if typ == "map":
        per = mapvqa.pairwise(x, y, "town", B[brief]["ko"], judges=J)
        p = per[J[0]]
        return k, {"verdict": mapvqa.majority(per, J), "height": p.get("axes", {}).get("height"), "why": p.get("why")}
    outs = [mapvqa.ask(J[0], CUT_PROMPT, [x, y] if od == "xy" else [y, x], f"cuts-{od}") for od in ("xy", "yx")]
    picks = [((o.get("result") or {}).get("pick") or "tie") for o in outs]
    v = [1 if p == ("A" if od == "xy" else "B") else -1 if p == ("B" if od == "xy" else "A") else 0 for p, od in zip(picks, ("xy", "yx"))]
    return k, {"verdict": v[0] if v[0] == v[1] else 0, "raw": v, "why": [(o.get("result") or {}).get("why") for o in outs]}
with cf.ThreadPoolExecutor(4) as ex:
    for k, v in ex.map(one, jobs):
        res[k] = v; json.dump(res, open(f, "w"), ensure_ascii=False, indent=1); print(k, v["verdict"], flush=True)
