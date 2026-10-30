#!/usr/bin/env python3
"""bbox-better (b) catalog format variants (one bbox call + at most 2 repairs, same as bbox-room/run.py):
  text      — text catalog only, no image
  examples  — text catalog + id palette image + 2 example layouts from author reference rooms (layout JSON + laid image);
              a fingerprint check rejects a layout that reuses an example's piece arrangement.
  (text + palette = the baseline bbox run, reused.)
  python3 scripts/experiments/bbox-better/variant.py <inn|boss> <text|examples> <arm> <rep>
Out: $BBOX_RUNS/var-<variant><rep>[-<arm>]/<task>/"""
import json, os, sys
from collections import Counter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
task, variant, arm, rep = sys.argv[1:5]
G = f"{RUNS}/var-{variant}{rep}{'' if arm == 'terra' else '-' + arm}/{task}"; os.makedirs(G, exist_ok=True)
cat = catalog(task)
EX = [json.load(open(f"{RUNS}/examples/{task}-{n}/layout.json")) for n in (1, 2)]

if variant == "text":
    cat = cat.replace(" The attached sheet shows every piece, labelled with its exact id, on a 16px grid.", "")
    content = [{"type": "text", "text": full_prompt(task, cat)}]
elif variant == "examples":
    extra = ("# Two example rooms from a human author (same chipset)\n"
             "They show how real rooms use this catalog: how wall pieces line the north wall, how tables get chairs on free sides, how a landmark anchors the room.\n"
             "Do NOT copy them. Your room must be your own design for this request; a fingerprint check rejects any layout that repeats an example's arrangement of pieces.\n"
             + "".join(f"Example {n} (laid image attached as example {n}):\n{json.dumps(e, ensure_ascii=False)}\n" for n, e in enumerate(EX, 1)) + "\n")
    content = [{"type": "text", "text": full_prompt(task, extra=extra)}, {"type": "image_url", "image_url": {"url": palette(task)}}]
    for n in (1, 2):
        x2(f"{RUNS}/examples/{task}-{n}/map.png", f"{G}/example-{n}.png")
        content += [{"type": "text", "text": f"Example {n} laid:"}, {"type": "image_url", "image_url": {"url": img_url(f"{G}/example-{n}.png")}}]
else: raise SystemExit("variant: text | examples")


def pieces(L):
    out = []
    for o in ([L["landmark"]] if L.get("landmark") else []) + (L.get("objects") or []):
        if not isinstance(o, dict) or not all(isinstance(o.get(k), int) for k in ("x", "y")): continue
        r = o.get("repeat") or {}
        for i in range(max(1, r.get("count", 1) if isinstance(r.get("count", 1), int) else 1)): out.append((o.get("id"), o["x"] + i * (r.get("dx", 0) or 0), o["y"] + i * (r.get("dy", 0) or 0)))
    return out


def fingerprint(L):
    """Best-translation overlap of (id, x, y) between the layout and each example. Copy = >=50% of the example's pieces or >=8 pieces."""
    mine = Counter(pieces(L)); worst = (0, 0, 0)
    for n, e in enumerate(EX, 1):
        ex = pieces(e)
        shifts = Counter((x - ex_x, y - ex_y) for (i, x, y) in mine for (j, ex_x, ex_y) in ex if i == j)
        for (tx, ty), _ in shifts.most_common(5):
            hit = sum(min(mine[(i, x + tx, y + ty)], 1) for (i, x, y) in ex)
            if hit > worst[1]: worst = (n, hit, len(ex))
    n, hit, tot = worst
    return {"example": n, "same": hit, "of": tot, "ratio": round(hit / tot, 2) if tot else 0, "copy": bool(tot) and (hit >= 8 or hit / tot >= 0.5)}


msgs = [{"role": "user", "content": content}]
calls, layout, chk, fps = [], None, None, []
for n in range(3):
    text, c = call(arm, msgs, f"{G}/call-{n}.json"); calls.append(c)
    msgs.append({"role": "assistant", "content": text})
    layout = parse(text)
    chk = lay(G, n, layout) if layout else {"ok": False, "errors": ["Your answer was not one parseable JSON object."], "warnings": []}
    if layout and variant == "examples":
        fp = fingerprint(layout); fps.append(fp)
        if fp["copy"]: chk = dict(chk, ok=False, errors=[f"Your layout copies example {fp['example']}: {fp['same']} of its {fp['of']} pieces sit in the same arrangement. Design your own room for the request; do not reuse the examples' placements."] + chk["errors"])
    json.dump(chk, open(f"{G}/check-{n}.json", "w"), indent=1)
    print(f"var-{variant}{rep} {arm}/{task} call {n}: {c['secs']}s tok={c['tokens']} ok={chk['ok']} errors={len(chk['errors'])}", flush=True)
    if chk["ok"]: break
    if n < 2: msgs.append({"role": "user", "content": rejected_msg(chk)})
res = {"task": task, "arm": arm, "variant": variant, "rep": int(rep), "model": MODEL[arm], "calls": calls, "repairs": len(calls) - 1, "ok": bool(chk and chk["ok"]),
       "secs": round(sum(c["secs"] for c in calls), 1), "tokens": sum(c["tokens"] for c in calls), "fingerprint": fps}
if layout: json.dump(layout, open(f"{G}/layout.json", "w"), indent=1)
if res["ok"]:
    fin = lay(G, "final", layout, render=True); res["warnings"] = fin.get("warnings"); res["stats"] = {k: v for k, v in (fin.get("stats") or {}).items() if k != "plan"}
else: res["errors"] = chk["errors"][:20] if chk else ["no answer"]
json.dump(res, open(f"{G}/RUN.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps(res)[:300])
