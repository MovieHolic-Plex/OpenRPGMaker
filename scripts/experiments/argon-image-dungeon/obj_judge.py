#!/usr/bin/env python3
"""Object step 3: Opus 5.5 medium judges (never Argon), via mapvqa.ask (cached by image hash + prompt).
 (1) per Argon object, absolute: does it read as the cropped object, fit the chipset style (style sheet attached), keep the 3/4 view?
 (2) per pair, Argon vs the Opus object-gen counterpart of the same type, both orders (A/B swapped); split orders = draw.
  python3 obj_judge.py   -> $AID_RUNS/objects/judge.json"""
import json, os, sys, concurrent.futures as cf
from pathlib import Path
from PIL import Image
S = Path.home() / "z-project/assistant-whole-game/suite"; sys.path.insert(0, str(S / "mapvqa")); import mapvqa
RUNS = Path(os.environ.get("AID_RUNS", S / "rooms/runs-argonimg")); O = RUNS / "objects"; POOL = S / "rooms/objpool"
SHEET = POOL / "_dungeon/style_sheet.png"; FLOOR = (36, 44, 56, 255); OPUS = "teamclaude/claude-opus-5-5@medium"
V = O / "view"; V.mkdir(exist_ok=True)
def on_floor(png, tag, k=6):
    """The object at k x on the dungeon floor colour, with a 1x copy at the corner (what the player sees)."""
    a = Image.open(png).convert("RGBA"); W, H = a.width * k + 8, a.height * k + 8
    bg = Image.new("RGBA", (W + a.width + 16, max(H, a.height + 8)), FLOOR)
    big = Image.new("RGBA", a.size, FLOOR); big.alpha_composite(a); bg.paste(big.resize((a.width * k, a.height * k), Image.NEAREST), (4, 4))
    small = Image.new("RGBA", a.size, FLOOR); small.alpha_composite(a); bg.paste(small, (W + 8, 4))
    p = V / f"{tag}.png"; bg.convert("RGB").save(p); return str(p)
ABS = """You judge one 16px pixel-art map object for a fantasy JRPG dungeon chipset (3/4 top-down view: you see the top face and a short front face).
Image 1 = a crop from a dungeon illustration: the object that was to be drawn ("{name}": {brief}).
Image 2 = the pixel-art object, at 6x on the dungeon floor colour, with its 1x size at the right.
Image 3 = the chipset's existing dungeon pieces (the style it must match).
Answer each with yes/partly/no and one short reason:
- reads: at 1x and 6x, does image 2 read as the same kind of object as image 1 (a player would name it the same)?
- style: does it fit image 3's craft (outline, shading steps, palette, detail density) so it could sit among those pieces?
- view34: is it seen in the chipset's 3/4 top-down view (top plane visible above a short front; flat decals straight from above; wall pieces face-on)?
- quality: overall, would you ship it in that chipset? (yes = as is, partly = with fixes, no = redraw)
Answer JSON only: {{"reads": "yes|partly|no", "style": "yes|partly|no", "view34": "yes|partly|no", "quality": "yes|partly|no", "why": "one line"}}"""
PAIR = """Two 16px pixel-art map objects for the same fantasy JRPG dungeon chipset, both meant as a "{kind}" (3/4 top-down view: top face above a short front).
Image 1 = A, image 2 = B, each at 6x on the dungeon floor colour with its 1x size at the right. Image 3 = the chipset's existing dungeon pieces (the style to match).
Which is the better map object? Weigh: reads instantly as that kind of object at 1x; matches image 3's craft (outline, shading steps, palette, detail);
correct 3/4 view; overall pixel quality. Smaller or simpler is not better by itself. "same" only if they are truly equal.
Answer JSON only: {{"pick": "A|B|same", "why": "one line"}}"""
d = json.load(open(O / "draw.json")); res = json.load(open(O / "judge.json")) if (O / "judge.json").exists() else {}
jobs = []
for cid, r in d.items():
    if not r["ok"]: continue
    ap = on_floor(r["png"], f"argon-{cid}")
    if f"abs|{cid}" not in res: jobs.append(("abs", cid, [r["crop"], ap, str(SHEET)], ABS.format(name=r["name"], brief=r["brief"])))
    if r["opus"]:
        op = on_floor(POOL / "beodeul_city" / f"{r['opus']}.png", f"opus-{r['opus']}")
        oj = json.load(open(POOL / "beodeul_city" / f"{r['opus']}.json"))
        if f"absopus|{r['opus']}" not in res and os.path.exists(oj.get("mockup_crop") or ""):   # the same absolute questions for the Opus piece, vs its own mockup crop
            jobs.append(("absopus", r["opus"], [oj["mockup_crop"], op, str(SHEET)], ABS.format(name=oj["name_en"].lower(), brief=oj["brief"])))
        kind = r["name"] + " / " + json.load(open(POOL / "beodeul_city" / f"{r['opus']}.json"))["name_en"].lower()
        for od in ("xy", "yx"):
            if f"pair|{cid}|{od}" not in res: jobs.append((f"pair-{od}", cid, [ap, op, str(SHEET)] if od == "xy" else [op, ap, str(SHEET)], PAIR.format(kind=kind)))
print("jobs", len(jobs), flush=True)
def one(j):
    kind, cid, imgs, prompt = j
    r = mapvqa.ask(OPUS, prompt, imgs, f"aid-{kind}")
    return kind, cid, r.get("result")
with cf.ThreadPoolExecutor(4) as ex:
    for kind, cid, out in ex.map(one, jobs):
        key = f"{kind}|{cid}" if kind in ("abs", "absopus") else f"pair|{cid}|{kind[5:]}"
        res[key] = out; json.dump(res, open(O / "judge.json", "w"), indent=1, ensure_ascii=False); print(key, json.dumps(out, ensure_ascii=False)[:160], flush=True)
