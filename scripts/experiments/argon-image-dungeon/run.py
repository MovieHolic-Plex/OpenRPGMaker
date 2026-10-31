#!/usr/bin/env python3
"""argon-image-dungeon, one run (from the worktree root):
  python3 scripts/experiments/argon-image-dungeon/run.py <crypt|flooded|demon|cave> <img|direct> [--grid]
img    : gemini-3.1-flash-image draws a natural top-down 3/4 JRPG dungeon picture of the brief (picture.png), then Argon (gemini-4-argon)
         gets that picture + the round-4 bbox prompt + palette sheet and writes the shape layout; code (bbox-dungeon/lay3.mts) validates
         with English Rejected/Fixed messages and lays tiles exactly. One call + at most 2 repairs (+1 soft call), same loop as bbox-dungeon/run4.py.
direct : Argon with the same round-4 prompt and palette, no picture (control).
--grid : the image prompt also asks for a faint 16px cell grid over the picture (arm name img-grid).
Out: $AID_RUNS/<arm>/<brief>/ {image-prompt.txt, picture.png, prompt.txt, call-N.json, layout-N.json, check-N.json, layout.json, map.png, RUN.json}
Transport: 8318 (key read from ~/.oprn-suite/openai-compat-endpoints.json, never printed); 502/503/empty retried 5 times with backoff, then the run is void."""
import base64, io, json, os, re, subprocess, sys, time, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import prompt_r4
from PIL import Image
brief, arm = sys.argv[1], sys.argv[2]
GRID = "--grid" in sys.argv
ROUND2 = "--r2" in sys.argv   # round 2: validator errors carry exact Fixed calls (BBD_FIXED=1), JSON syntax errors say where; same picture as round 1
MAXREP = int(sys.argv[sys.argv.index("--repairs") + 1]) if "--repairs" in sys.argv else 2   # round 3: --r2 messages + up to 6 repairs (Opus r4 had 2)
ARM = arm + ("-grid" if GRID else "") + ("-r3" if MAXREP > 2 else "-r2" if ROUND2 else "")
HOME = os.path.expanduser("~")
RUNS = os.environ.get("AID_RUNS", f"{HOME}/z-project/assistant-whole-game/suite/rooms/runs-argonimg")
G = f"{RUNS}/{ARM}/{brief}"; os.makedirs(G, exist_ok=True)
LAYOUT_MODEL, IMAGE_MODEL = "gemini-4-argon-high", "gemini-3.1-flash-image"   # 8318: plain gemini-4-argon drops attached images (empty answer, ~18 prompt tokens); the -high id keeps them
_ep = json.load(open(os.path.expanduser("~/.oprn-suite/openai-compat-endpoints.json")))["endpoints"]["openai-compat:proxy8318"]
URL = _ep["baseUrl"].rstrip("/") + "/chat/completions"
HDR = {"Content-Type": "application/json", "Authorization": f"Bearer {_ep['apiKey']}", **(_ep.get("headers") or {})}
ENV = dict(os.environ, OPRN_SHARED_CONTENT_SQLITE=f"{RUNS}/shared-content.sqlite", BBD_ROUND="4"); ENV.pop("BBD_POOL", None)
if ROUND2: ENV["BBD_FIXED"] = "1"
SUFFIX = " 다른 맵은 만들지 말고 이 던전 한 층만 지어 줘."
REQ = {"crypt": "교회 지하에 있는 지하 묘지 던전 한 층을 만들어 줘. 입구 계단으로 내려와 보스가 기다리는 곳까지 가는 던전이야." + SUFFIX,
       "flooded": "물에 잠긴 동굴 속 옛 신전 던전 한 층을 만들어 줘. 입구에서 들어와 깊은 곳의 보스까지 가는 던전이야." + SUFFIX,
       "demon": "마왕성 지하 던전 한 층을 만들어 줘. 입구 계단으로 내려와 마왕의 부하 보스가 기다리는 곳까지 가는 던전이야." + SUFFIX,
       "cave": "사람 손이 닿지 않은 자연 동굴 던전 한 층을 만들어 줘. 입구로 들어와 가장 깊은 곳에 사는 보스까지 가는 동굴이야." + SUFFIX}[brief]
SCENE = {"crypt": "a catacomb crypt beneath a church: grey crypt stone halls, stone coffins and sarcophagi, skull niches in the walls, a collapsed wing with rubble, an antechamber, and the boss's burial sanctum at the far end",
         "flooded": "an ancient temple sunk inside a flooded cave: pale temple stone halls half under water, natural rock caverns with pools and ragged shores, bridges over deep water, a raised ledge, an antechamber, and the boss's sanctum in the deepest part",
         "demon": "the dungeon level under the demon king's castle: dark castle stone halls and prison cells, braziers, iron gates, a lava or chasm hazard crossed by a bridge, an antechamber, and the throne-like lair of the demon king's lieutenant boss",
         "cave": "an untouched natural cave: irregular rock caverns of different sizes, winding narrow fissures, stalagmites and rubble along the walls, an underground pool, a chasm, raised rock ledges, and the lair of the boss in the deepest cavern"}[brief]
log = lambda *a: print(f"{ARM}/{brief}:", *a, flush=True)

def post(body, what):
    """One request with up to 5 tries (backoff 20/40/80/160 s) on HTTP errors, timeouts and empty answers. None = void."""
    data = json.dumps(body).encode()
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(URL, data, HDR), timeout=900) as r: d = json.load(r)
            m = (d.get("choices") or [{}])[0].get("message") or {}
            if what == "image" and m.get("images"): return d
            if what == "text" and (m.get("content") or "").strip(): return d
            raise RuntimeError("empty " + what + " answer: " + str(m.get("content"))[:120])
        except Exception as x:
            log(f"transport retry {attempt + 1}/5: {str(x)[:140]}")
            if attempt < 4: time.sleep(20 * 2 ** attempt)
    return None

def void(reason):
    json.dump({"brief": brief, "arm": ARM, "void": True, "ok": False, "reason": reason}, open(f"{G}/RUN.json", "w"), indent=1); log("VOID", reason); sys.exit(0)

PIC = f"{G}/picture.png"
if ROUND2 and arm == "img" and not os.path.exists(PIC) and os.path.exists(f"{RUNS}/{arm}{'-grid' if GRID else ''}/{brief}/picture.png"):
    import shutil; shutil.copy(f"{RUNS}/{arm}{'-grid' if GRID else ''}/{brief}/picture.png", PIC)
if arm == "img" and not os.path.exists(PIC):
    IP = (f"Generate one image (run {ARM}/{brief}): a complete top-down 3/4-view map of ONE dungeon floor for a 16-bit SNES-era JRPG, in pixel-art style like RPG Maker 2000 dungeon chipsets. "
          f"The dungeon is {SCENE}. Show the whole floor at once, seen from above with a slight 3/4 tilt: dark solid rock or ceiling mass around everything, the north side of every room shows a short vertical wall face, floors are flat. "
          "The player enters by stairs at the top of the entrance room; rooms of different sizes and shapes connect by corridors and openings, with at least one loop and one side branch to treasure; "
          "the route to the boss passes through an antechamber. It should look like a natural, hand-made game map, not a floor-plan diagram. No characters, no text, no labels, no UI." +
          (" Overlay a faint, evenly spaced square grid of 16-pixel cells across the whole map so tile positions are easy to read." if GRID else ""))
    open(f"{G}/image-prompt.txt", "w").write(IP)
    t0 = time.time(); d = post({"model": IMAGE_MODEL, "messages": [{"role": "user", "content": IP}]}, "image")
    if not d: void("image model never returned a picture")
    url = d["choices"][0]["message"]["images"][0]["image_url"]["url"]
    Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1]))).convert("RGB").save(PIC)
    json.dump({"secs": round(time.time() - t0, 1), "model": d.get("model"), "size": Image.open(PIC).size}, open(f"{G}/image-call.json", "w"), indent=1)
    log("picture", Image.open(PIC).size, round(time.time() - t0), "s")

if os.environ.get("AID_PIC_ONLY"): sys.exit(0)
PROMPT = prompt_r4.build(RUNS, REQ)
PROMPT = f"(run {ARM}/{brief})\n" + PROMPT   # the 8318 route answers identical prompts identically
if arm == "img":
    PROMPT += ("\n\n# Your reference picture\nThe FIRST attached image is an illustration of this dungeon floor, drawn for this same request; the second image is the piece sheet. "
               "Use the illustration as your design and realise it with the shapes above: read off where the entrance is, the shape, relative size and position of every room and cavern, "
               "how they connect (corridors, openings, loops, branches), water/lava/chasm areas and bridges, raised ledges and stairs, rock islands, and the landmark objects in each room. "
               "Choose W and H so the picture's proportions are kept, and place every region where it sits in the picture (scale the picture onto your cell grid). "
               "Built rooms that look straight-walled in the picture stay rects; irregular caverns become blobs/polys with rough edges. Keep its design; change it only where the rules above require "
               "(wall-face rows, spacing, entrance stairs, antechamber before the boss). Pieces must come from the catalog: pick the closest catalog piece for what the picture shows.")
open(f"{G}/prompt.txt", "w").write(PROMPT)
b64 = lambda p: "data:image/png;base64," + base64.b64encode(open(p, "rb").read()).decode()
content = [{"type": "text", "text": PROMPT}]
if arm == "img": content.append({"type": "image_url", "image_url": {"url": b64(PIC)}})
content.append({"type": "image_url", "image_url": {"url": b64(f"{RUNS}/palette.png")}})
msgs = [{"role": "user", "content": content}]

def call(n):
    t0 = time.time(); d = post({"model": LAYOUT_MODEL, "messages": msgs}, "text")
    if not d: void(f"layout call {n} never returned")
    secs = round(time.time() - t0, 1); u = d.get("usage") or {}; text = d["choices"][0]["message"]["content"] or ""
    json.dump({"secs": secs, "usage": u, "model": d.get("model"), "text": text}, open(f"{G}/call-{n}.json", "w"), ensure_ascii=False, indent=1)
    return text, secs, u

PARSE_ERR = ["Your answer was not one parseable JSON object."]
def parse(text):
    m = re.search(r"\{.*\}", text, re.S)
    try: return json.loads(m.group(0)) if m else None
    except json.JSONDecodeError as e:
        if ROUND2:
            t = m.group(0); a = max(0, e.pos - 60)
            PARSE_ERR[0] = f"Your answer was not valid JSON: {e.msg} at line {e.lineno} column {e.colno}, here: ...{t[a:e.pos]}<<HERE>>{t[e.pos:e.pos + 40]}... Fix the syntax (brackets must match: a rect is [x, y, w, h])."
        return None

def lay(n, layout, render=False):
    f = f"{G}/layout-{n}.json"; json.dump(layout, open(f, "w"), indent=1, ensure_ascii=False)
    out = G if render else f"{G}/lay-{n}"
    p = subprocess.run(["bun", "scripts/experiments/bbox-dungeon/lay3.mts", f, out] + (["--render"] if render else []), capture_output=True, text=True, env=ENV)
    try: return json.loads(p.stdout.strip().splitlines()[-1])
    except Exception: return {"ok": False, "errors": ["painter crashed: " + (p.stderr or p.stdout)[-500:]], "warnings": []}

calls, layout, chk = [], None, None
for n in range(MAXREP + 1):
    text, secs, u = call(n); calls.append({"secs": secs, "tokens": u.get("total_tokens", 0)})
    msgs.append({"role": "assistant", "content": text})
    layout = parse(text)
    chk = lay(n, layout) if layout else {"ok": False, "errors": list(PARSE_ERR), "warnings": []}
    json.dump(chk, open(f"{G}/check-{n}.json", "w"), indent=1, ensure_ascii=False)
    log(f"call {n}: {secs}s ok={chk['ok']} errors={len(chk['errors'])}")
    if chk["ok"]: break
    if n < MAXREP:
        msgs.append({"role": "user", "content": "Rejected: the validator found problems. Fixed call: fix every problem below and return the full corrected JSON only (same format).\n- "
                     + "\n- ".join(chk["errors"][:40]) + ("\nWarnings (fix if you can):\n- " + "\n- ".join(chk["warnings"][:10]) if chk.get("warnings") else "")})
soft = [w for w in (chk or {}).get("warnings", []) if w.startswith("Soft check")]
if chk and chk["ok"] and soft and len(calls) < MAXREP + 1:
    good = layout
    msgs.append({"role": "user", "content": "Accepted — the floor is valid. Optional improvement: " + soft[0] + " Return the full JSON again with that improved (same format); keep everything else that already works."})
    text, secs, u = call(len(calls)); calls.append({"secs": secs, "tokens": u.get("total_tokens", 0), "soft": True})
    msgs.append({"role": "assistant", "content": text})
    l2 = parse(text); c2 = lay(len(calls) - 1, l2) if l2 else {"ok": False, "errors": ["not parseable"], "warnings": []}
    json.dump(c2, open(f"{G}/check-{len(calls) - 1}.json", "w"), indent=1, ensure_ascii=False)
    log(f"soft call: {secs}s ok={c2['ok']}")
    if c2["ok"]: layout, chk = l2, c2
    else: layout = good
res = {"brief": brief, "arm": ARM, "model": LAYOUT_MODEL, "imageModel": IMAGE_MODEL if arm == "img" else None, "calls": calls,
       "repairs": len([c for c in calls if not c.get("soft")]) - 1, "softCall": any(c.get("soft") for c in calls), "ok": bool(chk and chk["ok"]),
       "secs": round(sum(c["secs"] for c in calls), 1), "tokens": sum(c["tokens"] for c in calls)}
if layout: json.dump(layout, open(f"{G}/layout.json", "w"), indent=1, ensure_ascii=False)
if res["ok"]:
    fin = lay("final", layout, render=True); res["warnings"] = fin.get("warnings"); res["stats"] = fin.get("stats")
else: res["errors"] = chk["errors"][:20] if chk else ["no answer"]; res["stats"] = (chk or {}).get("stats")
res["rendered"] = os.path.exists(f"{G}/map.png")
json.dump(res, open(f"{G}/RUN.json", "w"), ensure_ascii=False, indent=1)
log(json.dumps({k: res[k] for k in ("ok", "repairs", "secs", "rendered")}))
